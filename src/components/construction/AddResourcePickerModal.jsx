import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';

// AddResourcePickerModal — faithful port of the Form2_Works_v2 mockup's
// "Qo'shimcha resurs qo'shish" modal.
//
// Built directly on Radix Dialog primitives (no shadcn wrapper) so we
// own every CSS rule on the dialog content — no `w-full max-w-lg`
// defaults to fight, full pixel control via inline style.

const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
    .format(v).replace(/\u00A0/g, ' ');
};
const parseNum = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '')) || 0;

const CAT_TAG = {
  labor:     { bg: 'rgba(245,158,11,0.1)',  fg: '#F59E0B', label: 'MEHNAT' },
  equipment: { bg: 'rgba(167,139,250,0.1)',  fg: '#A78BFA', label: 'MASHINA' },
  material:  { bg: 'rgba(20,184,166,0.1)',  fg: '#14B8A6', label: 'MATERIAL' },
};

function classify(rt) {
  rt = String(rt || '').toLowerCase();
  if (['labor', 'ish', 'ishchi', 'worker'].includes(rt)) return 'labor';
  if (['equipment', 'machine', 'mashina', 'masina'].includes(rt)) return 'equipment';
  return 'material';
}

export default function AddResourcePickerModal({ open, onClose, projectId, estimateId, parent, nextSeq, onSaved }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [rate, setRate] = useState('1');
  const [totalQty, setTotalQty] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setSearch(''); setSelected(null); setRate('1'); setTotalQty('0'); }
  }, [open]);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    constructionService.listEstimateResources(projectId)
      .then((rows) => { if (!cancelled) setResources(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setResources([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let xs = resources;
    if (q) {
      xs = xs.filter((r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.uom  || '').toLowerCase().includes(q) ||
        (r.code || '').toLowerCase().includes(q),
      );
    }
    return xs.slice(0, 60);
  }, [resources, search]);

  const pickedPrice = useMemo(() => {
    if (!selected) return 0;
    const rt = String(selected.resource_type || '').toLowerCase();
    if (rt === 'labor')     return Number(selected.labor_rate)     || Number(selected.unit_rate) || 0;
    if (rt === 'equipment') return Number(selected.equipment_rate) || Number(selected.unit_rate) || 0;
    if (rt === 'material')  return Number(selected.material_rate)  || Number(selected.unit_rate) || 0;
    return Number(selected.unit_rate) || 0;
  }, [selected]);

  const summa = useMemo(() => pickedPrice * parseNum(totalQty), [pickedPrice, totalQty]);

  const handleConfirm = useCallback(async () => {
    if (!selected || !parent) return;
    const r = parseNum(rate);
    const tq = parseNum(totalQty);
    if (tq <= 0) {
      toast.error(t('total_qty_required') || 'Jami miqdorni kiriting');
      return;
    }
    setSaving(true);
    try {
      const parentNum = parent.item_number || String(parent.id || '');
      await constructionService.createEstimateLine(estimateId, {
        parent_line_id: parent.id,
        name: selected.name,
        uom: selected.uom || parent.uom || '',
        resource_type: String(selected.resource_type || 'material').toLowerCase(),
        norm_rate: r,
        unit_price: pickedPrice,
        item_number: parentNum ? `${parentNum}-${nextSeq || 1}` : undefined,
        quantity_override: true,
        quantity: tq,
      });
      toast.success(t('added') || "Qo'shildi");
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  }, [selected, parent, rate, totalQty, pickedPrice, estimateId, nextSeq, onSaved, onClose, t]);

  if (!parent) return null;
  const parentLabel = `#${parent.item_number || parent.id} · ${(parent.name || '').slice(0, 60)}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: "rgba(15,23,42,0.4)",
            backdropFilter: 'blur(4px)',
          }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100vw - 32px)',
            maxWidth: 760,
            maxHeight: 'calc(100vh - 64px)',
            zIndex: 101,
            background: '#1E293B',
            color: '#F1F5F9',
            border: '1px solid #334155',
            borderRadius: 12,
            fontFamily: "'Inter', system-ui, sans-serif",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: "0 10px 40px rgba(15,23,42,0.15)",
          }}
        >
          {/* Head */}
          <div
            className="px-6 py-5 flex justify-between items-start gap-4"
            style={{ borderBottom: '1px solid #1E293B', flexShrink: 0 }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.1em] mb-1" style={{ color: '#94A3B8' }}>
                {t('add_extra_resource_title') || "Qo'shimcha resurs qo'shish"}
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

          {/* Body — scrolls when content exceeds available height */}
          <div className="px-6 py-5" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <div className="mb-4">
              <label className="text-[11px] block mb-1.5" style={{ color: '#94A3B8' }}>
                {t('pick_resource') || 'Resursni tanlang'}
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('search_resource_by_name') || "Resurs nomi bo'yicha qidirish..."}
                  className="w-full pl-9 pr-3 py-2.5 rounded-md text-[13px] outline-none"
                  style={{ background: '#0B1220', color: '#F1F5F9', border: '1px solid #334155', fontFamily: 'inherit' }}
                  autoFocus
                />
              </div>
            </div>

            <div className="mb-4" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {loading ? (
                <div className="py-8 text-center" style={{ color: '#94A3B8' }}>
                  <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                  {t('loading') || 'Yuklanmoqda…'}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: '#94A3B8' }}>
                  {t('no_resources_found') || 'Hech narsa topilmadi'}
                </div>
              ) : (
                filtered.map((r) => {
                  const cat = classify(r.resource_type);
                  const tag = CAT_TAG[cat];
                  const rt = String(r.resource_type || '').toLowerCase();
                  const price = rt === 'labor' ? r.labor_rate
                    : rt === 'equipment' ? r.equipment_rate
                    : rt === 'material' ? r.material_rate
                    : r.unit_rate || 0;
                  const isSelected = selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r)}
                      className="w-full mb-1.5 px-3 py-2.5 rounded-md grid items-center gap-3 transition text-left"
                      style={{
                        background: isSelected ? '#1E293B' : '#0B1220',
                        border: `1px solid ${isSelected ? '#14B8A6' : '#334155'}`,
                        gridTemplateColumns: '90px 1fr 80px 130px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                        style={{ background: tag.bg, color: tag.fg, justifySelf: 'start' }}
                      >
                        {tag.label}
                      </span>
                      <span className="truncate" style={{ color: '#F1F5F9' }} title={r.name}>{r.name}</span>
                      <span className="text-center" style={{ color: '#CBD5E1' }}>{r.uom || ''}</span>
                      <span className="text-right font-mono tabular-nums" style={{ color: '#F59E0B' }}>{fmt(price)}</span>
                    </button>
                  );
                })
              )}
            </div>

            {selected && (
              <div
                className="rounded-lg p-4"
                style={{ background: '#0B1220', border: '1px solid #334155' }}
              >
                <label className="text-[11px] block mb-1.5" style={{ color: '#94A3B8' }}>
                  {t('selected_resource') || 'Tanlangan resurs'}
                </label>
                <div
                  className="px-3 py-2.5 rounded text-[13px] mb-4 flex items-center gap-2"
                  style={{ background: '#1E293B' }}
                >
                  {(() => {
                    const cat = classify(selected.resource_type);
                    const tag = CAT_TAG[cat];
                    return (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                        style={{ background: tag.bg, color: tag.fg }}
                      >
                        {tag.label}
                      </span>
                    );
                  })()}
                  <span className="truncate" title={selected.name}>{selected.name}</span>
                  <span className="text-[12px]" style={{ color: '#94A3B8' }}>
                    ({selected.uom || ''} · {fmt(pickedPrice)} so'm)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[11px] block mb-1.5" style={{ color: '#94A3B8' }}>
                      {t('norma_per_unit') || 'Norma (bir birlik uchun)'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2.5 rounded-md text-[13px] font-mono outline-none"
                      style={{ background: '#0B1220', color: '#F1F5F9', border: '1px solid #334155' }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] block mb-1.5" style={{ color: '#94A3B8' }}>
                      {t('total_qty') || 'Jami miqdor'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={totalQty}
                      onChange={(e) => setTotalQty(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2.5 rounded-md text-[13px] font-mono outline-none"
                      style={{ background: '#0B1220', color: '#F1F5F9', border: '1px solid #334155' }}
                    />
                  </div>
                </div>

                <div
                  className="px-3 py-3 rounded-md flex justify-between items-center font-mono text-[12px]"
                  style={{ background: '#1E293B' }}
                >
                  <span style={{ color: '#94A3B8' }}>{t('amount') || 'Summa'}:</span>
                  <span style={{ color: '#F59E0B', fontWeight: 600 }}>{fmt(summa)} so'm</span>
                </div>
              </div>
            )}
          </div>

          {/* Foot */}
          <div
            className="px-6 py-4 flex justify-end gap-2.5"
            style={{ borderTop: '1px solid #1E293B', flexShrink: 0 }}
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
              onClick={handleConfirm}
              disabled={!selected || saving}
              className="px-4 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#14B8A6', color: '#1E293B', border: 'none' }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('add') || "Qo'shish"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
