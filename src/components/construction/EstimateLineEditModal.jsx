import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { constructionService } from '@/api/services/construction';

// EstimateLineEditModal — Full edit modal for any estimate line (parent or sub-line).
// Matches the same visual language as SublineModal so the UI feels cohesive.
//
// For parent (top-level) lines: shows name, code, uom, quantity, material_rate,
// labor_rate, equipment_rate. Computes unit_rate and total_amount live.
// For sub-lines: also shows norm_rate and hides the split rates, showing a
// single unit_price that maps to the rate column matching resource_type.

const UOM_PRESETS = ['MASH-CH', 'ISH-KUN', 'ISH-SOAT', 'dona', 'm3', 'kg', 'tn', 'm2', 'pog.m', 'l', 'kompl'];

const RESOURCE_TYPES = [
  { value: '',          label_uz: '—',                   label_ru: '—',                 label_en: '—' },
  { value: 'equipment', label_uz: 'Mashina / Mexanizm',  label_ru: 'Машина / Механизм', label_en: 'Machine' },
  { value: 'material',  label_uz: 'Material',            label_ru: 'Материал',          label_en: 'Material' },
  { value: 'labor',     label_uz: 'Ish',                 label_ru: 'Труд',              label_en: 'Labor' },
];

export default function EstimateLineEditModal({ open, onClose, line, parent, estimateId, onSaved }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const isSubline = !!line?.parent_line_id;

  const [form, setForm] = useState({
    item_number: '',
    code: '',
    name: '',
    uom: '',
    quantity: '',
    // `norma` doubles up: for parent works it maps to original_quantity
    // (the smeta-anchored NORMA pill); for resources it's already covered
    // by norm_rate below. Keeping a single field name on the form keeps
    // the JSX simple and the save handler routes it to the right column
    // based on isSubline.
    norma: '',
    resource_type: '',
    material_rate: '',
    labor_rate: '',
    equipment_rate: '',
    norm_rate: '',
    unit_price: '',
    // quantity_override (migration 342) — for sub-lines, when true the Hajm
    // is entered manually instead of being derived from parent.qty × norma.
    quantity_override: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !line) return;
    const rt = (line.resource_type || '').toLowerCase();
    const rateFromType =
      rt === 'labor' ? line.labor_rate
      : rt === 'material' ? line.material_rate
      : rt === 'equipment' ? line.equipment_rate
      : 0;
    setForm({
      item_number: line.item_number || '',
      code: line.code || '',
      name: line.name || '',
      uom: line.uom || '',
      quantity: String(line.quantity ?? ''),
      // Norma seed — parent works use original_quantity (Russian
      // smeta NORMA), resources fall through to norm_rate later.
      norma: String(line.original_quantity ?? '').replace('.', ','),
      resource_type: line.resource_type || '',
      material_rate: formatPriceInput(String(line.material_rate ?? 0)),
      labor_rate: formatPriceInput(String(line.labor_rate ?? 0)),
      equipment_rate: formatPriceInput(String(line.equipment_rate ?? 0)),
      norm_rate: String(line.norm_rate ?? '').replace('.', ','),
      unit_price: formatPriceInput(String(rateFromType || 0)),
      quantity_override: !!line.quantity_override,
    });
  }, [open, line]);

  const resourceTypeLabel = (v) => {
    const row = RESOURCE_TYPES.find((r) => r.value === v);
    if (!row) return v || '—';
    return row[`label_${language}`] || row.label_uz;
  };

  // Live derived values — match the backend's calculation formulas so what the
  // user sees in the modal matches what gets persisted.
  const derived = useMemo(() => {
    if (isSubline) {
      const norm = parseFloat(String(form.norm_rate).replace(',', '.')) || 0;
      const unitPrice = parseFloat(parsePriceInput(form.unit_price)) || 0;
      const parentQty = Number(parent?.quantity) || 0;
      // Manual override: the user-entered Hajm wins. Otherwise derive it
      // from parent.qty × norma (the default cascade).
      const manualQty = parseFloat(String(form.quantity).replace(',', '.')) || 0;
      const effectiveQty = form.quantity_override ? manualQty : parentQty * norm;
      return { quantity: effectiveQty, unitRate: unitPrice, total: effectiveQty * unitPrice };
    }
    const qty = parseFloat(String(form.quantity).replace(',', '.')) || 0;
    const mat = parseFloat(parsePriceInput(form.material_rate)) || 0;
    const lab = parseFloat(parsePriceInput(form.labor_rate)) || 0;
    const eq = parseFloat(parsePriceInput(form.equipment_rate)) || 0;
    const unitRate = mat + lab + eq;
    return { quantity: qty, unitRate, total: qty * unitRate };
  }, [isSubline, parent, form.norm_rate, form.unit_price, form.quantity, form.quantity_override, form.material_rate, form.labor_rate, form.equipment_rate]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('name_required') || 'Nom kerak');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        uom: form.uom || 'dona',
        code: form.code,
        item_number: form.item_number,
        resource_type: form.resource_type || undefined,
      };
      if (isSubline) {
        payload.norm_rate = parseFloat(String(form.norm_rate).replace(',', '.')) || 0;
        payload.unit_price = parseFloat(parsePriceInput(form.unit_price)) || 0;
        // quantity_override decides whether the backend re-derives the Hajm
        // from parent.qty × norma (false) or persists the user value (true).
        payload.quantity_override = !!form.quantity_override;
        if (form.quantity_override) {
          payload.quantity = parseFloat(String(form.quantity).replace(',', '.')) || 0;
        }
      } else {
        payload.quantity = parseFloat(String(form.quantity).replace(',', '.')) || 0;
        payload.material_rate = parseFloat(parsePriceInput(form.material_rate)) || 0;
        payload.labor_rate = parseFloat(parsePriceInput(form.labor_rate)) || 0;
        payload.equipment_rate = parseFloat(parsePriceInput(form.equipment_rate)) || 0;
        // NORMA edit for parent works — wired to original_quantity. Only
        // send when the user typed something so we don't clobber the
        // anchor with 0 on an otherwise unrelated save.
        const normaStr = String(form.norma || '').trim();
        if (normaStr !== '') {
          payload.original_quantity = parseFloat(normaStr.replace(',', '.')) || 0;
        }
      }

      await constructionService.updateEstimateLine(estimateId, line.id, payload);
      toast.success(t('saved') || 'Saqlandi');
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  if (!line) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isSubline
              ? `${t('edit_subline') || "Podkatorni tahrirlash"}${form.item_number ? ` — ${form.item_number}` : ''}`
              : `${t('edit_line') || "Qatorni tahrirlash"}${form.item_number ? ` — ${form.item_number}` : ''}`}
          </DialogTitle>
          {isSubline && parent && (
            <DialogDescription className="text-xs">
              {t('parent_line') || "Ota qator"}: <span className="font-mono">{parent.item_number}</span> — {parent.name}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t('item_number') || "Qator raqami"}</label>
              <Input
                value={form.item_number}
                onChange={(e) => setForm({ ...form, item_number: e.target.value })}
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('code') || 'Kod'}</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">{t('name') || "Nomi"} *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t('uom') || "O'lchov birligi"}</label>
              <Select value={form.uom || '__empty__'} onValueChange={(v) => setForm({ ...form, uom: v === '__empty__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {form.uom && !UOM_PRESETS.includes(form.uom) && (
                    <SelectItem key={form.uom} value={form.uom}>{form.uom}</SelectItem>
                  )}
                  {UOM_PRESETS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isSubline && (
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">{t('resource_type') || "Resurs turi"}</label>
                <Select
                  value={form.resource_type || '__empty__'}
                  onValueChange={(v) => setForm({ ...form, resource_type: v === '__empty__' ? '' : v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((rt) => (
                      <SelectItem key={rt.value || '__empty__'} value={rt.value || '__empty__'}>
                        {resourceTypeLabel(rt.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isSubline ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t('norma') || 'Norma'}</label>
                  <Input
                    value={form.norm_rate}
                    onChange={(e) => setForm({ ...form, norm_rate: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('unit_price_som') || "Birlik narxi (so'm)"}</label>
                  <Input
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
              </div>
              {/* Hajm (quantity). By default it's derived from parent.qty × norma.
                 Tick "Qo'lda" to enter it manually (quantity_override). */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">{t('quantity') || 'Hajm'}</label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer"
                      checked={form.quantity_override}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setForm((f) => {
                          const norm = parseFloat(String(f.norm_rate).replace(',', '.')) || 0;
                          const parentQty = Number(parent?.quantity) || 0;
                          return {
                            ...f,
                            quantity_override: on,
                            // Seed the manual field with the current auto value
                            // so the user starts from the derived number.
                            quantity: on ? String(parentQty * norm) : f.quantity,
                          };
                        });
                      }}
                    />
                    {t('manual_quantity') || "Qo'lda kiritish"}
                  </label>
                </div>
                <Input
                  value={form.quantity_override
                    ? form.quantity
                    : (Number.isFinite(derived.quantity) ? String(derived.quantity) : '')}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  disabled={!form.quantity_override}
                  inputMode="decimal"
                  className={form.quantity_override ? '' : 'opacity-60'}
                />
                {!form.quantity_override && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t('auto_quantity_hint') || 'Norma × ota qator hajmi asosida hisoblanadi'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* Norma — the imported smeta reja (original_quantity).
                     Editable so the user can correct an import error
                     without re-uploading the whole estimate. */}
                  <label className="text-xs text-muted-foreground">{t('norma') || 'Norma'}</label>
                  <Input
                    value={form.norma}
                    onChange={(e) => setForm({ ...form, norma: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('quantity') || "Hajm"}</label>
                  <Input
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t('material') || "Material"}</label>
                  <Input
                    value={form.material_rate}
                    onChange={(e) => setForm({ ...form, material_rate: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('labor') || "Ish haqi"}</label>
                  <Input
                    value={form.labor_rate}
                    onChange={(e) => setForm({ ...form, labor_rate: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('equipment') || "Jihozlar"}</label>
                  <Input
                    value={form.equipment_rate}
                    onChange={(e) => setForm({ ...form, equipment_rate: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
              </div>
            </>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 grid grid-cols-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">{t('quantity_short') || "Hajm"}</div>
              <div className="font-semibold">{derived.quantity.toFixed(2)} {form.uom}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('unit_rate') || "Birlik narxi"}</div>
              <div className="font-semibold">{formatCurrency(derived.unitRate)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t('total') || "Jami"}</div>
              <div className="text-lg font-bold text-blue-600">{formatCurrency(derived.total)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
              {t('cancel') || "Bekor qilish"}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('save') || "Saqlash"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
