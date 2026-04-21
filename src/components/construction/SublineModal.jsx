import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { constructionService } from '@/api/services/construction';

// SublineModal — Add or edit a sub-line (podkator) under an existing estimate line.
// Matches the Claude Chrome design mock from the "Light Mode in Excel" chat.
//
// The name field is a SEARCHABLE DROPDOWN backed by
//   GET /construction/projects/:projectId/estimate-resources?type={equipment|labor|material}
// so users pick from existing project resources instead of retyping them.
// When a resource is picked: name, uom and unit_price auto-populate. Users can
// still type a free-form name — the dropdown shows a "Use as typed" entry.

const RESOURCE_TYPE_OPTIONS = [
  { value: 'equipment', tkey: 'machine_mechanism', fallback_uz: 'Mashina / Mexanizm', fallback_ru: 'Машина / Механизм', fallback_en: 'Machine / Mechanism' },
  { value: 'material',  tkey: 'material',          fallback_uz: 'Material',          fallback_ru: 'Материал',          fallback_en: 'Material' },
  { value: 'labor',     tkey: 'labor',             fallback_uz: 'Ish',               fallback_ru: 'Труд',              fallback_en: 'Labor' },
];

const UOM_PRESETS = ['MASH-CH', 'ISH-KUN', 'ISH-SOAT', 'dona', 'm3', 'kg', 'tn', 'm2', 'pog.m', 'l', 'kompl'];

export default function SublineModal({ open, onClose, parent, estimateId, projectId, nextSeq, initial, onSaved }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const isEdit = !!initial;

  const [form, setForm] = useState({
    item_number: '',
    resource_type: 'equipment',
    name: '',
    norm_rate: '',
    unit_price: '',
    uom: '',
  });
  const [saving, setSaving] = useState(false);

  // Resource catalog state (loaded per selected resource_type)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');

  // Initialise form on open / parent change
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      const rateFromType = (() => {
        const rt = (initial.resource_type || '').toLowerCase();
        if (rt === 'labor') return initial.labor_rate;
        if (rt === 'material') return initial.material_rate;
        return initial.equipment_rate;
      })();
      setForm({
        item_number: initial.item_number || '',
        resource_type: initial.resource_type || 'equipment',
        name: initial.name || '',
        norm_rate: String(initial.norm_rate ?? '').replace('.', ','),
        unit_price: formatPriceInput(String(rateFromType ?? 0)),
        uom: initial.uom || '',
      });
    } else {
      const parentNum = parent?.item_number || String(parent?.id || '');
      setForm({
        item_number: parentNum ? `${parentNum}-${nextSeq || 1}` : '',
        resource_type: 'equipment',
        name: '',
        norm_rate: '',
        unit_price: '',
        uom: '',
      });
    }
    setResourceSearch('');
  }, [open, parent, nextSeq, isEdit, initial]);

  // Load resources filtered by current resource_type. Re-fetch when the user
  // changes type so the dropdown is always scoped correctly.
  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoadingResources(true);
    constructionService
      .listEstimateResources(projectId, form.resource_type)
      .then((rows) => {
        if (!cancelled) setResources(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setResources([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingResources(false);
      });
    return () => { cancelled = true; };
  }, [open, projectId, form.resource_type]);

  // Derived preview values
  const preview = useMemo(() => {
    const norm = parseFloat(String(form.norm_rate).replace(',', '.')) || 0;
    const unitPrice = parseFloat(parsePriceInput(form.unit_price)) || 0;
    const parentQty = Number(parent?.quantity) || 0;
    const effectiveQty = parentQty * norm;
    const amount = effectiveQty * unitPrice;
    return { norm, unitPrice, parentQty, effectiveQty, amount };
  }, [form.norm_rate, form.unit_price, parent]);

  const resourceTypeLabel = (v) => {
    const row = RESOURCE_TYPE_OPTIONS.find((r) => r.value === v);
    if (!row) return v;
    return t(row.tkey) || row[`fallback_${language}`] || row.fallback_uz;
  };

  // Client-side search over the catalog returned by the API. The catalog is
  // already scoped to the chosen resource_type, so we just filter on the query.
  const filteredResources = useMemo(() => {
    const q = resourceSearch.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.code || '').toLowerCase().includes(q) ||
      (r.uom || '').toLowerCase().includes(q)
    );
  }, [resources, resourceSearch]);

  const pickResource = (r) => {
    const rt = (form.resource_type || '').toLowerCase();
    const rate =
      rt === 'labor' ? r.labor_rate
      : rt === 'material' ? r.material_rate
      : rt === 'equipment' ? r.equipment_rate
      : (r.unit_rate || r.equipment_rate || r.material_rate || r.labor_rate || 0);
    setForm((f) => ({
      ...f,
      name: r.name || '',
      uom: r.uom || f.uom,
      unit_price: formatPriceInput(String(rate || r.unit_rate || 0)),
    }));
    setPickerOpen(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('resource_name_required') || "Resurs nomi kiritilishi kerak");
      return;
    }
    const norm = parseFloat(String(form.norm_rate).replace(',', '.')) || 0;
    const unitPrice = parseFloat(parsePriceInput(form.unit_price)) || 0;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        uom: form.uom || parent?.uom || '',
        resource_type: form.resource_type,
        norm_rate: norm,
        unit_price: unitPrice,
        item_number: form.item_number || undefined,
      };
      if (isEdit) {
        await constructionService.updateEstimateLine(estimateId, initial.id, payload);
        toast.success(t('saved') || "Saqlandi");
      } else {
        payload.parent_line_id = parent?.id;
        await constructionService.createEstimateLine(estimateId, payload);
        toast.success(t('added') || "Qo'shildi");
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  if (!parent) return null;

  const parentLabel = parent?.item_number || String(parent?.id || '');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? (t('edit_subline') || "Podkatorni tahrirlash")
              : `${parentLabel}-${t('row_to_add_subline') || "qatorga podkator qo'shish"}`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {parent.name}
            {parent.code ? <> — <span className="font-mono">{parent.code}</span></> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t('subline_number') || "Podkator raqami"}</label>
              <Input
                value={form.item_number}
                onChange={(e) => setForm({ ...form, item_number: e.target.value })}
                placeholder={`${parentLabel}-${nextSeq || 1}`}
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('resource_type') || "Resurs turi"}</label>
              <Select
                value={form.resource_type}
                onValueChange={(v) => setForm((f) => ({ ...f, resource_type: v, name: '', uom: '', unit_price: '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPE_OPTIONS.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {resourceTypeLabel(rt.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resource name — searchable dropdown backed by project's estimate-resources */}
          <div>
            <label className="text-xs text-muted-foreground">{t('resource_name') || "Resurs nomi"} *</label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className={form.name ? '' : 'text-muted-foreground'}>
                    {form.name || (t('pick_resource') || "Resursni tanlang")}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
                onWheel={(e) => e.stopPropagation()}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    value={resourceSearch}
                    onValueChange={setResourceSearch}
                    placeholder={t('search_resource') || "Resurs qidirish…"}
                  />
                  <CommandList>
                    {loadingResources && (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                        {t('loading_resources') || "Yuklanmoqda…"}
                      </div>
                    )}
                    {!loadingResources && filteredResources.length === 0 && (
                      <CommandEmpty>
                        <div className="py-2 text-xs text-muted-foreground">
                          {t('no_resources_found') || "Resurs topilmadi"}
                        </div>
                        {resourceSearch && (
                          <button
                            type="button"
                            className="w-full text-left px-2 py-2 text-sm hover:bg-accent rounded"
                            onClick={() => {
                              setForm((f) => ({ ...f, name: resourceSearch }));
                              setPickerOpen(false);
                            }}
                          >
                            {t('type_to_create') || "Yangi nom kiritish"}: <b>{resourceSearch}</b>
                          </button>
                        )}
                      </CommandEmpty>
                    )}
                    {!loadingResources && filteredResources.length > 0 && (
                      <CommandGroup>
                        {filteredResources.map((r) => (
                          <CommandItem
                            key={r.id}
                            value={String(r.id)}
                            onSelect={() => pickResource(r)}
                            className="cursor-pointer"
                          >
                            <Check className={`mr-2 h-4 w-4 ${form.name === r.name ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm truncate">{r.name}</div>
                              <div className="text-[10px] text-muted-foreground flex gap-2">
                                {r.uom && <span>{r.uom}</span>}
                                {r.code && <span className="font-mono">{r.code}</span>}
                                {(() => {
                                  const rt = (form.resource_type || '').toLowerCase();
                                  const rate = rt === 'labor' ? r.labor_rate : rt === 'material' ? r.material_rate : r.equipment_rate;
                                  if (rate) return <span>{formatCurrency(rate)}</span>;
                                  return null;
                                })()}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t('shrnk_norm') || "ShRNK normasi"}</label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.norm_rate}
                onChange={(e) => setForm({ ...form, norm_rate: e.target.value })}
                placeholder="0,204"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('unit_price_som') || "Birlik narxi (so'm)"}</label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                placeholder="16 430"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('uom') || "O'lchov birligi"}</label>
              <Select value={form.uom || '__empty__'} onValueChange={(v) => setForm({ ...form, uom: v === '__empty__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {/* Show current uom (if not in preset list) so it stays visible */}
                  {form.uom && !UOM_PRESETS.includes(form.uom) && (
                    <SelectItem key={form.uom} value={form.uom}>{form.uom}</SelectItem>
                  )}
                  {UOM_PRESETS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Live preview card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-blue-600">
                  {form.item_number || `${parentLabel}-${nextSeq || 1}`}
                </div>
                <div className="text-sm font-medium truncate">
                  {form.name || (t('enter_resource_name') || "Resurs nomini kiriting")}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                  <span>
                    {t('norm') || "Norma"}: <b>{preview.norm || 0}</b> {form.uom || ''}
                  </span>
                  <span>
                    {t('price') || "Narx"}: <b>{formatCurrency(preview.unitPrice)}</b>
                  </span>
                  <span>
                    {t('quantity_short') || "Hajm"}: {preview.parentQty} × {preview.norm || 0} = <b>{preview.effectiveQty.toFixed(2)}</b>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t('amount') || "Summa"}</div>
                <div className="text-lg font-semibold text-blue-600">{formatCurrency(preview.amount)}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {t('subline_save_hint') || "Saqlangandan so'ng"}{' '}
              <span className="font-mono text-slate-600">
                {form.item_number || `${parentLabel}-${nextSeq || 1}`}
              </span>{' '}
              {t('subline_save_hint_suffix') || "sifatida jadvalga qo'shiladi"}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEdit
                  ? (t('save') || "Saqlash")
                  : `${t('add_arrow') || "Qo'shish →"} ${form.item_number || `${parentLabel}-${nextSeq || 1}`}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
