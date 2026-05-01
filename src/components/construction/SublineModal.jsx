import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { constructionService } from '@/api/services/construction';
import Loader from '@/components/ui/loader';

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

// Display-time formatter for the ShRNK normasi input: keeps the Uzbek
// convention of comma-for-decimal while adding a non-breaking-looking space
// as the thousands separator. Accepts either comma or dot as the user types.
// Example: "10000"  → "10 000"
//          "1000,5" → "1 000,5"
//          "1.5"    → "1,5"
function formatNormInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  // Normalize: strip whitespace and fold any dots into commas so the decimal
  // separator is consistent regardless of what the user typed.
  const normalized = String(value).replace(/\s/g, '').replace(/\./g, ',');
  // Keep the first comma and drop any subsequent ones (avoids "1,2,3" typos).
  const commaIdx = normalized.indexOf(',');
  const intRaw = (commaIdx >= 0 ? normalized.slice(0, commaIdx) : normalized).replace(/[^\d]/g, '');
  const fracRaw = commaIdx >= 0 ? normalized.slice(commaIdx + 1).replace(/[^\d]/g, '') : '';
  const intWithSpaces = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return commaIdx >= 0 ? `${intWithSpaces},${fracRaw}` : intWithSpaces;
}

// Parse back to a numeric string (dot as decimal separator) for submission.
function parseNormInput(value) {
  return String(value ?? '').replace(/\s/g, '').replace(',', '.');
}

export default function SublineModal({ open, onClose, parent, estimateId, projectId, nextSeq, initial, onSaved }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const isEdit = !!initial;

  // `quantity_override` toggles the sub-line between AUTO (quantity derived
  // from parent.quantity × norm_rate) and MANUAL (user types the quantity
  // directly — used e.g. when booking "10 pump-hours" regardless of what the
  // parent volume × norm would produce). `manual_quantity` holds the raw
  // user input while in MANUAL mode so it survives re-renders.
  const [form, setForm] = useState({
    item_number: '',
    resource_type: 'equipment',
    name: '',
    norm_rate: '',
    unit_price: '',
    uom: '',
    quantity_override: false,
    manual_quantity: '',
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
        norm_rate: formatNormInput(String(initial.norm_rate ?? '').replace('.', ',')),
        unit_price: formatPriceInput(String(rateFromType ?? 0)),
        uom: initial.uom || '',
        quantity_override: !!initial.quantity_override,
        manual_quantity: initial.quantity_override
          ? formatNormInput(String(initial.quantity ?? '').replace('.', ','))
          : '',
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
        quantity_override: false,
        manual_quantity: '',
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

  // Derived preview values.
  //
  // AUTO mode (default): effectiveQty = parent.quantity × norm_rate.
  // MANUAL mode (quantity_override): effectiveQty = user-entered value. The
  // norm_rate stays visible as a reference figure but no longer drives the
  // amount, matching the "10 pump-hours independent of parent volume" case.
  const preview = useMemo(() => {
    const norm = parseFloat(parseNormInput(form.norm_rate)) || 0;
    const unitPrice = parseFloat(parsePriceInput(form.unit_price)) || 0;
    const parentQty = Number(parent?.quantity) || 0;
    const manualQty = parseFloat(parseNormInput(form.manual_quantity)) || 0;
    const effectiveQty = form.quantity_override ? manualQty : parentQty * norm;
    const amount = effectiveQty * unitPrice;
    return { norm, unitPrice, parentQty, manualQty, effectiveQty, amount };
  }, [form.norm_rate, form.unit_price, form.manual_quantity, form.quantity_override, parent]);

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
    const norm = parseFloat(parseNormInput(form.norm_rate)) || 0;
    const unitPrice = parseFloat(parsePriceInput(form.unit_price)) || 0;
    const manualQty = parseFloat(parseNormInput(form.manual_quantity)) || 0;

    if (form.quantity_override && manualQty <= 0) {
      toast.error(t('manual_quantity_required') || "Qo'lda kiritilgan hajm musbat bo'lishi kerak");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        uom: form.uom || parent?.uom || '',
        resource_type: form.resource_type,
        norm_rate: norm,
        unit_price: unitPrice,
        item_number: form.item_number || undefined,
        // Migration 342: when the sub-line is in MANUAL mode, send the user-
        // entered quantity AND the override flag so the backend skips its
        // parent.quantity × norm_rate derivation.
        quantity_override: !!form.quantity_override,
        ...(form.quantity_override ? { quantity: manualQty } : {}),
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

  // Full parent label (name + code) surfaced as a native tooltip on the
  // clamped DialogDescription so users can still read the whole string.
  const parentFullLabel = `${parent.name || ''}${parent.code ? ` — ${parent.code}` : ''}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      {/*
        Three-layer defense against any child widening the modal past
        `max-w-2xl`:
          1. `overflow-hidden` on DialogContent — any overflow is visually
             clipped, never spills onto other UI. Popovers/Selects render
             through Radix portals so they're not affected.
          2. `min-w-0` on every direct grid/flex child (DialogHeader,
             content wrapper, each grid cell) — lets `truncate`/`line-clamp`
             inside actually take effect inside CSS grid cells, which
             otherwise default to `minmax(auto, 1fr)` and grow with content.
          3. Per-child truncation/line-clamp on every text node that can
             carry user- or data-driven length (title, description, name
             trigger, preview labels, save hint + button label).
        Together these make the modal's height and width fully deterministic
        regardless of name length — no scrollbar needed.
      */}
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader className="min-w-0">
          {/* pr-8 reserves room for the absolutely-positioned X close
              button (top-right of DialogContent) so a truncated title
              never runs into the close icon. */}
          <DialogTitle
            className="truncate pr-8"
            title={
              isEdit
                ? (t('edit_subline') || "Podkatorni tahrirlash")
                : `${parentLabel}-${t('row_to_add_subline') || "qatorga podkator qo'shish"}`
            }
          >
            {isEdit
              ? (t('edit_subline') || "Podkatorni tahrirlash")
              : `${parentLabel}-${t('row_to_add_subline') || "qatorga podkator qo'shish"}`}
          </DialogTitle>
          {/*
            Parent lines in resurs estimates routinely carry multi-line
            names (SNiP item + dopolnenie clause + resolution number).
            Clamping to two lines + `break-words` keeps the header a
            deterministic height while still showing enough context; the
            full string remains reachable via the tooltip.
          */}
          <DialogDescription
            className="text-xs line-clamp-2 break-words pr-8"
            title={parentFullLabel}
          >
            {parent.name}
            {parent.code ? <> — <span className="font-mono">{parent.code}</span></> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">{t('subline_number') || "Podkator raqami"}</label>
              <Input
                value={form.item_number}
                onChange={(e) => setForm({ ...form, item_number: e.target.value })}
                placeholder={`${parentLabel}-${nextSeq || 1}`}
                className="font-mono"
              />
            </div>
            <div className="min-w-0">
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
          <div className="min-w-0">
            <label className="text-xs text-muted-foreground">{t('resource_name') || "Resurs nomi"} *</label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
              <PopoverTrigger asChild>
                {/* `min-w-0` + flex-child layout is required so very long
                    Russian/Uzbek resource names truncate with an ellipsis
                    instead of pushing the trigger (and the modal behind it)
                    past its container. `text-left` keeps the label flush
                    left, matching a standard combobox. */}
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full min-w-0 justify-between font-normal text-left"
                >
                  <span
                    className={`truncate min-w-0 flex-1 ${form.name ? '' : 'text-muted-foreground'}`}
                    title={form.name || undefined}
                  >
                    {form.name || (t('pick_resource') || "Resursni tanlang")}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
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
                      <Loader className="py-4" size="w-4 h-4" />
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

          {/*
            Manual-vs-auto mode toggle. Default is AUTO (quantity derived from
            parent.quantity × ShRNK norma). Flipping to MANUAL surfaces an
            editable Hajm field so foremen can book the real figure (e.g. 10
            pump-hours) without the parent's volume rewriting it. This directly
            addresses the field-team concern raised against the normative
            auto-calculation being too rigid for real-world resource bookings.
          */}
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3 min-w-0">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-medium">
                {t('manual_quantity') || "Hajmni qo'lda kiritish"}
              </p>
              <p className="text-xs text-muted-foreground">
                {form.quantity_override
                  ? (t('manual_quantity_hint') || "Hajm qo'lda kiritiladi, ota qatordan olinmaydi")
                  : (t('auto_quantity_hint') || "Hajm avtomatik: ota qator hajmi × ShRNK normasi")}
              </p>
            </div>
            <Switch
              checked={!!form.quantity_override}
              onCheckedChange={(v) => setForm((f) => ({
                ...f,
                quantity_override: !!v,
                // Preload the manual field with the current auto-derived value
                // the moment the user flips into MANUAL mode — so they have a
                // reasonable starting point to edit from (instead of "0").
                manual_quantity: v && !f.manual_quantity
                  ? formatNormInput(String(preview.effectiveQty || '').replace('.', ','))
                  : f.manual_quantity,
              }))}
            />
          </div>

          {form.quantity_override && (
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">
                {t('manual_quantity') || "Qo'lda kiritilgan hajm"} *
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.manual_quantity}
                onChange={(e) => setForm({ ...form, manual_quantity: formatNormInput(e.target.value) })}
                placeholder="10"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">{t('shrnk_norm') || "ShRNK normasi"}</label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.norm_rate}
                onChange={(e) => setForm({ ...form, norm_rate: formatNormInput(e.target.value) })}
                placeholder="0,204"
                // In MANUAL mode the norm is informational only — it no longer
                // drives the quantity. The field is disabled to make this
                // explicit: the user's typed Hajm is the single source of
                // truth for the sub-line amount.
                disabled={form.quantity_override}
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">{t('unit_price_som') || "Birlik narxi (so'm)"}</label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                placeholder="16 430"
              />
            </div>
            <div className="min-w-0">
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

          {/* Live preview card — every text block inside the left column
              truncates so user-supplied values (item_number, name) can never
              widen the card past the right-hand Summa block. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-blue-600 truncate">
                  {form.item_number || `${parentLabel}-${nextSeq || 1}`}
                </div>
                <div
                  className="text-sm font-medium truncate"
                  title={form.name || undefined}
                >
                  {form.name || (t('enter_resource_name') || "Resurs nomini kiriting")}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap min-w-0">
                  <span className="truncate">
                    {t('norm') || "Norma"}: <b>{preview.norm || 0}</b> {form.uom || ''}
                  </span>
                  <span className="truncate">
                    {t('price') || "Narx"}: <b>{formatCurrency(preview.unitPrice)}</b>
                  </span>
                  {/*
                    Quantity display forks on mode so the formula matches what
                    will actually be persisted: auto → parent × norm, manual
                    → the user-typed value in plain form (no multiplication).
                  */}
                  {form.quantity_override ? (
                    <span className="truncate">
                      {t('quantity_short') || "Hajm"} ({t('manual_short') || "qo'lda"}): <b>{preview.effectiveQty.toFixed(2)}</b>
                    </span>
                  ) : (
                    <span className="truncate">
                      {t('quantity_short') || "Hajm"}: {preview.parentQty} × {preview.norm || 0} = <b>{preview.effectiveQty.toFixed(2)}</b>
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">{t('amount') || "Summa"}</div>
                <div className="text-lg font-semibold text-blue-600 whitespace-nowrap">{formatCurrency(preview.amount)}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            {/*
              min-w-0 lets the hint div shrink below its content's intrinsic
              width, so `truncate` actually takes effect and the buttons on
              the right keep their natural width.
            */}
            <div className="text-xs text-muted-foreground min-w-0 flex-1 truncate">
              {t('subline_save_hint') || "Saqlangandan so'ng"}{' '}
              <span className="font-mono text-slate-600">
                {form.item_number || `${parentLabel}-${nextSeq || 1}`}
              </span>{' '}
              {t('subline_save_hint_suffix') || "sifatida jadvalga qo'shiladi"}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving} className="max-w-[280px]">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />}
                {isEdit ? (
                  t('save') || "Saqlash"
                ) : (
                  <span className="truncate">
                    {`${t('add_arrow') || "Qo'shish →"} ${form.item_number || `${parentLabel}-${nextSeq || 1}`}`}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
