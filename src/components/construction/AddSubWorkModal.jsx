import React, { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';

// AddSubWorkModal — faithful port of the Form2_Works_v2 mockup's
// "Yangi qo'shimcha etap" modal.
//
// Uses Radix Dialog PRIMITIVES directly (not shadcn's wrapper) because
// shadcn's DialogContent ships hard-coded `w-full max-w-lg` classes that
// fight any size override (tailwind-merge keeps both, !important inline
// styles get out-cascaded by class rules). Going direct gives us full
// pixel control with zero fight.

// One canonical entry per physical unit — the previous list duplicated
// the same hour-unit in three different transliterations (ЧЕЛ.-Ч /
// CHEL-SOAT / ISH-KUN; МАШ.-Ч / MASH-CHAS / MASH-SOAT) which made the
// dropdown read like three separate UOMs and produced inconsistent
// labels in the saved smeta. We keep the Russian forms because the
// imported Goskomarkhitektstroy smetas use exactly those strings, and
// matching the imported casing keeps cross-sheet joins (REJA vs FAKT,
// resource lookups by name+uom) intact.
const UOMS_BY_CATEGORY = {
  labor:    ['ЧЕЛ.-Ч'],
  machines: ['МАШ.-Ч'],
  material: ['M3', 'M2', 'KG', 'TN', 'DONA', 'POG.M', 'L', 'KOMPL', '1000 M3 GRUNTA', '100 M3', 'M3 GRUNTA'],
};

export default function AddSubWorkModal({
  open, onClose, projectId, estimateId,
  parent, nextSeq, onSaved,
  // Sub-section mode — when `parentSection` is a non-empty string the
  // modal switches semantics: instead of attaching the new line to a
  // parent WORK via parent_line_id (the original use case), it creates
  // a top-level work whose `parent_item_number` is
  // "PARENT_SECTION › NEW_NAME". The grouping logic in
  // StagesTabV2.deriveStages / SmetaManagementTab.sections renders
  // that as a new sub-stage under PARENT_SECTION containing this one
  // work. Callers pass either `parent` OR `parentSection`, never both.
  parentSection,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const isSection = !!(parentSection && String(parentSection).trim());

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [uom, setUom] = useState('');
  // Custom UoM mode — when true the user sees a free-text input
  // instead of the preset dropdown. Triggered by picking the
  // "+ Boshqa..." sentinel option below, so the user can enter any
  // unit not in UOMS_BY_CATEGORY (e.g. "ШТ", "RUL", "ПОГ.М²").
  const [customUomMode, setCustomUomMode] = useState(false);
  const [qty, setQty] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setCode(''); setName(''); setUom(''); setCustomUomMode(false); setQty('0'); }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('stage_name_required') || 'Etap nomini kiriting');
      return;
    }
    if (!uom.trim()) {
      toast.error(t('uom_required') || "O'lchov birligini kiriting");
      return;
    }
    const q = Number(String(qty).replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '')) || 0;
    const trimmedCode = code.trim();
    setSaving(true);
    try {
      // Code-match clone path — when the user typed a SHRNK code, ask the
      // backend to look for an existing parent line with the same code
      // anywhere in the project and copy its resources onto the new line.
      // The endpoint falls back to a plain insert when no match is found,
      // so it's safe to use it unconditionally whenever code is present.
      if (trimmedCode) {
        const body = isSection
          ? {
              source_code: trimmedCode,
              parent_item_number: `${parentSection} › ${name.trim()}`,
              name: name.trim(),
              uom,
              code: trimmedCode,
              quantity: q,
            }
          : {
              source_code: trimmedCode,
              parent_line_id: parent?.id,
              name: name.trim(),
              uom,
              code: trimmedCode,
              quantity: q,
              item_number: (parent?.item_number || String(parent?.id || ''))
                ? `${parent?.item_number || parent?.id}-${nextSeq || 1}`
                : undefined,
            };
        const res = await constructionService.cloneEstimateLineByCode(estimateId, body);
        const cloned = Number(res?.cloned_resources || 0);
        if (cloned > 0) {
          toast.success(
            (t('cloned_with_resources') || "Etap yaratildi va {n} ta resurs ko'chirildi")
              .replace('{n}', String(cloned)),
          );
        } else if (res?.source_id) {
          // Source matched but had no resources to copy.
          toast.success(
            t('cloned_source_empty')
              || "Etap yaratildi (mos kod topildi, lekin resurslari yo'q edi)",
          );
        } else {
          // No matching code in the project — fell through to a plain insert.
          toast.success(
            t('cloned_no_match')
              || "Etap yaratildi (kod loyihada topilmadi — resurslar ko'chirilmadi)",
          );
        }
      } else if (isSection) {
        // Sub-section / sub-stage mode — top-level line under a section
        // path. parent_item_number = "PARENT › NEW_NAME" so the
        // hierarchical grouping treats this as a new sub-stage under
        // the parent stage.
        await constructionService.createEstimateLine(estimateId, {
          parent_line_id: 0,
          parent_item_number: `${parentSection} › ${name.trim()}`,
          code: undefined,
          name: name.trim(),
          uom,
          resource_type: '',
          norm_rate: 0,
          unit_price: 0,
          quantity_override: true,
          quantity: q,
          material_rate: 0,
          labor_rate: 0,
          equipment_rate: 0,
        });
        toast.success(t('stage_created') || 'Etap yaratildi');
      } else {
        const parentNum = parent?.item_number || String(parent?.id || '');
        await constructionService.createEstimateLine(estimateId, {
          parent_line_id: parent?.id,
          code: undefined,
          name: name.trim(),
          uom,
          resource_type: '',
          norm_rate: 0,
          unit_price: 0,
          quantity_override: true,
          quantity: q,
          item_number: parentNum ? `${parentNum}-${nextSeq || 1}` : undefined,
        });
        toast.success(t('stage_created') || 'Etap yaratildi');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  if (!isSection && !parent) return null;
  const parentLabel = isSection
    ? parentSection
    : `#${parent.item_number || parent.id} · ${(parent.name || '').slice(0, 60)}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogPrimitive.Portal>
        {/* Overlay — full-screen darken with blur, mirrors the mockup's
           rgba(0,0,0,0.7) + backdrop-filter blur(4px). */}
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: "rgba(15,23,42,0.4)",
            backdropFilter: 'blur(4px)',
          }}
        />
        {/* Content — centered fixed-position panel with EXPLICIT pixel
           width. Width comes from inline style only — no Tailwind classes
           in play, so nothing can override. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            // Light-theme rewrite — was a dark-mode panel matching the v2
            // mockup, but the user asked for the modals to match the rest
            // of the construction page (white surface, slate-200 borders,
            // slate-900 text).
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100vw - 32px)',
            maxWidth: 620,
            zIndex: 101,
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
            boxShadow: "0 10px 40px rgba(15,23,42,0.15)",
          }}
        >
          {/* Head */}
          <div
            className="px-6 py-5 flex justify-between items-start gap-4"
            style={{ borderBottom: '1px solid #E2E8F0' }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.1em] mb-1" style={{ color: '#64748B' }}>
                {t('new_extra_stage') || "Yangi qo'shimcha etap"}
              </div>
              <DialogPrimitive.Title className="text-base font-semibold truncate" title={parentLabel} style={{ color: '#0F172A' }}>
                {parentLabel}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 hover:bg-slate-50"
              style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B' }}
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {/* Two-column header row — `Etap kodi / shifri` (optional) + `Etap
                nomi *` (required). The code is a free-form short identifier
                (e.g. "1A", "K-2", "3.1") the user can pin so the printed
                Forma 2 lines up with their numbering convention. Mockup:
                Form2_Works_v23_prochie_breakdown.html. */}
            <div className="grid grid-cols-[140px_1fr] gap-4 mb-4">
              <div>
                <label className="text-[11px] block mb-1.5" style={{ color: '#64748B' }}>
                  {t('stage_code') || 'Etap kodi / shifri'}
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('stage_code_placeholder') || 'Masalan: 1A, 2-3, K-1, 5b'}
                  className="w-full px-3 py-2.5 rounded-md text-[13px] outline-none font-mono"
                  style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                />
              </div>
              <div>
                <label className="text-[11px] block mb-1.5" style={{ color: '#64748B' }}>
                  {/* `stage_name` translation already includes "*" — don't double it. */}
                  {t('stage_name') || 'Etap nomi *'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('stage_name_placeholder') || "Masalan: Qo'shimcha bo'yoq ishlari"}
                  className="w-full px-3 py-2.5 rounded-md text-[13px] outline-none"
                  style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: 'inherit' }}
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="text-[11px]" style={{ color: '#64748B' }}>
                    {t('uom') || "O'lchov birligi"} *
                  </label>
                  {customUomMode && (
                    // Small "back to list" link so the user can revert to
                    // the dropdown if they picked custom by mistake. Clears
                    // the typed value to avoid carrying a half-typed string
                    // into the saved estimate line.
                    <button
                      type="button"
                      onClick={() => { setCustomUomMode(false); setUom(''); }}
                      className="text-[11px] underline cursor-pointer"
                      style={{ color: '#0F766E', background: 'transparent', border: 'none', padding: 0 }}
                    >
                      {t('uom_back_to_list') || "ro'yxatdan tanlash"}
                    </button>
                  )}
                </div>
                {customUomMode ? (
                  <input
                    type="text"
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    placeholder={t('uom_custom_placeholder') || "Masalan: ШТ, RUL, M²"}
                    className="w-full px-3 py-2.5 rounded-md text-[13px] outline-none"
                    style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: 'inherit' }}
                    autoFocus
                  />
                ) : (
                  <select
                    value={uom}
                    onChange={(e) => {
                      // Sentinel value "__custom__" switches the field into
                      // free-text mode. Anything else just assigns the
                      // chosen preset unit. The sentinel is never persisted
                      // because we don't store the value until the user
                      // either picks a preset or types something while in
                      // custom mode.
                      if (e.target.value === '__custom__') {
                        setCustomUomMode(true);
                        setUom('');
                      } else {
                        setUom(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-md text-[13px] outline-none cursor-pointer"
                    style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: 'inherit' }}
                  >
                    <option value="">{t('select') || '— tanlang —'}</option>
                    {Object.entries(UOMS_BY_CATEGORY).map(([cat, units]) => (
                      <optgroup
                        key={cat}
                        label={
                          cat === 'labor'    ? (t('group_labor')    || "Mehnat (chel-soat)")
                        : cat === 'machines' ? (t('group_machines') || "Mashina (mashina-soat)")
                                             : (t('group_material') || "Material (o'lchov)")
                        }
                        style={{ background: '#FFFFFF', color: '#0F766E', fontWeight: 600 }}
                      >
                        {units.map((u) => (
                          <option key={u} value={u} style={{ background: '#FFFFFF', color: '#0F172A' }}>{u}</option>
                        ))}
                      </optgroup>
                    ))}
                    {/* "+ Boshqa..." sentinel — selecting it flips the field
                       into the free-text input above so the user can enter
                       a UoM that isn't in the preset list (the construction
                       industry has plenty: ШТ, ПОГ.М², ТУБ, etc.). */}
                    <option value="__custom__" style={{ background: '#FFFFFF', color: '#0F766E', fontWeight: 600 }}>
                      + {t('uom_other') || 'Boshqa...'}
                    </option>
                  </select>
                )}
              </div>
              <div>
                <label className="text-[11px] block mb-1.5" style={{ color: '#64748B' }}>
                  {t('initial_qty_optional') || 'Hajmi (keyinroq kiritish mumkin)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2.5 rounded-md text-[13px] font-mono outline-none"
                  style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1' }}
                />
              </div>
            </div>

            <div
              className="px-3 py-3 rounded-md text-[12px]"
              style={{
                background: 'rgba(20,184,166,0.06)',
                border: '1px solid rgba(20,184,166,0.25)',
                color: '#475569',
              }}
            >
              <strong style={{ color: '#0F766E' }}>{t('info') || "Ma'lumot"}:</strong>{' '}
              {t('stage_info_hint')
                || "Etap yaratilgandan so'ng unga resurs (material / mashina-soat / odam-soat) qo'shishingiz mumkin."}
            </div>
          </div>

          {/* Foot */}
          <div
            className="px-6 py-4 flex justify-end gap-2.5"
            style={{ borderTop: '1px solid #E2E8F0' }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-md text-xs disabled:opacity-50"
              style={{ background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1' }}
            >
              {t('cancel') || 'Bekor qilish'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#14B8A6', color: '#FFFFFF', border: 'none' }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('create') || 'Yaratish'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
