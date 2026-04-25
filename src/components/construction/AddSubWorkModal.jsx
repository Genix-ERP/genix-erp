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

const UOMS_BY_CATEGORY = {
  labor:    ['ЧЕЛ.-Ч', 'CHEL-SOAT', 'ISH-KUN'],
  machines: ['МАШ.-Ч', 'MASH-CHAS', 'MASH-SOAT'],
  material: ['M3', 'M2', 'KG', 'TN', 'DONA', 'POG.M', 'L', 'KOMPL', '1000 M3 GRUNTA', '100 M3', 'M3 GRUNTA'],
};

export default function AddSubWorkModal({ open, onClose, projectId, estimateId, parent, nextSeq, onSaved }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [name, setName] = useState('');
  const [uom, setUom] = useState('');
  const [qty, setQty] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(''); setUom(''); setQty('0'); }
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
    setSaving(true);
    try {
      const parentNum = parent?.item_number || String(parent?.id || '');
      await constructionService.createEstimateLine(estimateId, {
        parent_line_id: parent?.id,
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
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  if (!parent) return null;
  const parentLabel = `#${parent.item_number || parent.id} · ${(parent.name || '').slice(0, 60)}`;

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
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100vw - 32px)',
            maxWidth: 620,
            zIndex: 101,
            background: '#1E293B',
            color: '#F1F5F9',
            border: '1px solid #334155',
            borderRadius: 12,
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
            boxShadow: "0 10px 40px rgba(15,23,42,0.15)",
          }}
        >
          {/* Head */}
          <div
            className="px-6 py-5 flex justify-between items-start gap-4"
            style={{ borderBottom: '1px solid #1E293B' }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.1em] mb-1" style={{ color: '#94A3B8' }}>
                {t('new_extra_stage') || "Yangi qo'shimcha etap"}
              </div>
              <DialogPrimitive.Title className="text-base font-semibold truncate" title={parentLabel}>
                {parentLabel}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1' }}
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="mb-4">
              <label className="text-[11px] block mb-1.5" style={{ color: '#94A3B8' }}>
                {/* `stage_name` translation already includes "*" — don't double it. */}
                {t('stage_name') || 'Etap nomi *'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('stage_name_placeholder') || "Masalan: Qo'shimcha bo'yoq ishlari"}
                className="w-full px-3 py-2.5 rounded-md text-[13px] outline-none"
                style={{ background: '#0B1220', color: '#F1F5F9', border: '1px solid #334155', fontFamily: 'inherit' }}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] block mb-1.5" style={{ color: '#94A3B8' }}>
                  {t('uom') || "O'lchov birligi"} *
                </label>
                <select
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md text-[13px] outline-none cursor-pointer"
                  style={{ background: '#0B1220', color: '#F1F5F9', border: '1px solid #334155', fontFamily: 'inherit' }}
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
                      style={{ background: '#0B1220', color: '#14B8A6', fontWeight: 600 }}
                    >
                      {units.map((u) => (
                        <option key={u} value={u} style={{ background: '#1E293B', color: '#F1F5F9' }}>{u}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] block mb-1.5" style={{ color: '#94A3B8' }}>
                  {t('initial_qty_optional') || 'Hajmi (keyinroq kiritish mumkin)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2.5 rounded-md text-[13px] font-mono outline-none"
                  style={{ background: '#0B1220', color: '#F1F5F9', border: '1px solid #334155' }}
                />
              </div>
            </div>

            <div
              className="px-3 py-3 rounded-md text-[12px]"
              style={{
                background: 'rgba(20,184,166,0.05)',
                border: '1px solid rgba(20,184,166,0.15)',
                color: '#CBD5E1',
              }}
            >
              <strong style={{ color: '#14B8A6' }}>{t('info') || "Ma'lumot"}:</strong>{' '}
              {t('stage_info_hint')
                || "Etap yaratilgandan so'ng unga resurs (material / mashina-soat / odam-soat) qo'shishingiz mumkin."}
            </div>
          </div>

          {/* Foot */}
          <div
            className="px-6 py-4 flex justify-end gap-2.5"
            style={{ borderTop: '1px solid #1E293B' }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-md text-xs disabled:opacity-50"
              style={{ background: 'transparent', color: '#CBD5E1', border: '1px solid #334155' }}
            >
              {t('cancel') || 'Bekor qilish'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#14B8A6', color: '#1E293B', border: 'none' }}
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
