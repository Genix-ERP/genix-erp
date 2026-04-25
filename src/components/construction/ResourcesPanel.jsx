import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, Search, Users, Wrench, Package, Grid3x3, RotateCcw, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { formatApiError } from '@/utils/apiErrors';

// ResourcesPanel — faithful port of the mockup's Resources page
// (files/Form2_Works_v2 (7).html → renderResourcesPage()).
//
// Visual = dark theme with teal/amber accents to match the rest of the
// Smeta boshqaruvi tab.
//
// Columns mirror the mockup exactly:
//   №  ·  Kat. tag  ·  Name  ·  Unit  ·  Material type  ·  Current price
//   ·  Original price  ·  Diff %  ·  History (count badge)

const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
    .format(v).replace(/\u00A0/g, ' ');
};

const CATEGORIES = [
  { key: 'all',       icon: Grid3x3, label: 'Barchasi' },
  { key: 'labor',     icon: Users,   label: 'Mehnat' },
  { key: 'equipment', icon: Wrench,  label: 'Mashina' },
  { key: 'material',  icon: Package, label: 'Material' },
];

const MATERIAL_TYPES = [
  { value: 'standard',  fallback: 'Oddiy', color: '#475569' },
  { value: 'equipment', fallback: 'Uskuna', color: '#7C3AED' },
  { value: 'cable',     fallback: 'Kabel-simli', color: '#0D9488' },
  { value: 'metal',     fallback: 'Metall konstr.', color: '#D97706' },
  { value: 'import',    fallback: 'Import', color: '#F87171' },
];
const MAT_LABEL_KEY = {
  standard: 'mat_type_standard',
  equipment: 'mat_type_equipment',
  cable: 'mat_type_cable',
  metal: 'mat_type_metal',
  import: 'mat_type_import',
};

function classify(rt) {
  rt = String(rt || '').toLowerCase();
  if (['labor', 'ish', 'ishchi', 'worker'].includes(rt)) return 'labor';
  if (['equipment', 'machine', 'mashina', 'masina'].includes(rt)) return 'equipment';
  return 'material';
}

const CAT_TAG = {
  labor:     { bg: 'rgba(217,119,6,0.1)',  fg: '#D97706', label: 'MEHNAT' },
  equipment: { bg: 'rgba(124,58,237,0.1)',  fg: '#7C3AED', label: 'MASHINA' },
  material:  { bg: 'rgba(13,148,136,0.1)',  fg: '#0D9488', label: 'MATERIAL' },
};

export default function ResourcesPanel({ project, estimateId, onResourceChanged }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [priceDraft, setPriceDraft] = useState({});

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyResource, setHistoryResource] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const rowKey = (r) => `${r.name}::${r.uom || ''}`;

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      // Pass estimateId so the catalog matches whatever estimate the
      // parent tab has selected. If estimateId is undefined we fall back
      // to the project-wide list.
      const data = await constructionService.listResourcePrices(project.id, { estimateId });
      setItems(Array.isArray(data) ? data : []);
      setPriceDraft({});
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, estimateId]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let xs = items;
    if (cat !== 'all') xs = xs.filter((r) => classify(r.resource_type) === cat);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.uom || '').toLowerCase().includes(q));
    }
    return xs;
  }, [items, cat, search]);

  const anyModified = items.some((r) =>
    Number(r.original_price || 0) > 0
    && Math.abs(Number(r.price || 0) - Number(r.original_price || 0)) > 0.01,
  );

  const commitPrice = useCallback(async (row, raw) => {
    const newPrice = Number(String(raw).replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, ''));
    if (!Number.isFinite(newPrice) || newPrice < 0) return;
    if (Math.abs(newPrice - Number(row.price || 0)) < 0.001) return;
    try {
      const result = await constructionService.bulkUpdateResourcePrice(project.id, {
        resource_name: row.name,
        uom: row.uom || '',
        resource_type: row.resource_type,
        new_price: newPrice,
      });
      setItems((rows) => rows.map((r) => rowKey(r) === rowKey(row)
        ? { ...r, price: newPrice, history_count: (r.history_count || 0) + 1 }
        : r));
      toast.success(`${t('saved') || 'Saqlandi'} · ${result?.lines_updated || 0} ${t('rows') || 'qator'}`);
      onResourceChanged?.();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      load();
    }
  }, [project?.id, t, onResourceChanged, load]);

  const updateMatType = useCallback(async (row, value) => {
    try {
      await constructionService.bulkUpdateResourceMaterialType(project.id, {
        resource_name: row.name,
        uom: row.uom || '',
        material_type: value,
      });
      setItems((rows) => rows.map((r) => rowKey(r) === rowKey(row) ? { ...r, material_type: value } : r));
      onResourceChanged?.();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [project?.id, t, onResourceChanged]);

  const resetPrice = useCallback(async (row) => {
    try {
      const result = await constructionService.resetResourcePrice(project.id, {
        resource_name: row.name,
        uom: row.uom || '',
      });
      const newP = Number(result?.new_price ?? row.original_price ?? row.price);
      setItems((rows) => rows.map((r) => rowKey(r) === rowKey(row)
        ? { ...r, price: newP, history_count: (r.history_count || 0) + 1 }
        : r));
      toast.success(t('reset_price_done') || 'Narx asl qiymatga qaytarildi');
      onResourceChanged?.();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      load();
    }
  }, [project?.id, t, onResourceChanged, load]);

  const resetAll = useCallback(async () => {
    const msg = t('reset_all_confirm') || 'Reset all modified prices?';
    // eslint-disable-next-line no-alert
    if (!window.confirm(msg)) return;
    try {
      const result = await constructionService.resetAllResourcePrices(project.id);
      const tmpl = t('reset_all_done') || 'Reset {count} resource(s) across {lines} line(s)';
      toast.success(tmpl
        .replace('{count}', String(result?.resources_affected || 0))
        .replace('{lines}', String(result?.lines_updated || 0)));
      onResourceChanged?.();
      load();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [project?.id, t, onResourceChanged, load]);

  const openHistory = useCallback(async (row) => {
    setHistoryResource(row);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryRows([]);
    try {
      const rows = await constructionService.getResourcePriceHistory(project.id, {
        name: row.name, uom: row.uom || '',
      });
      setHistoryRows(rows);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    } finally {
      setHistoryLoading(false);
    }
  }, [project?.id, t]);

  return (
    <div>
      {/* Toolbar — sub-tab pills + search + reset-all */}
      <div
        className="rounded-[10px] p-4 flex items-center gap-3 flex-wrap"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        {/* Sub-tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F8FAFC' }}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className="px-3.5 py-2 rounded-[5px] text-xs flex items-center gap-1.5 transition"
                style={{
                  background: active ? '#E2E8F0' : 'transparent',
                  color: active ? '#0D9488' : '#475569',
                  fontFamily: 'inherit',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`res_cat_${c.key === 'equipment' ? 'equipment' : c.key === 'material' ? 'material' : c.key}`) || c.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative" style={{ minWidth: 280, flex: 1 }}>
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_resource') || 'Resurs qidirish...'}
            className="w-full pl-9 pr-3 py-2.5 rounded-md text-[13px] outline-none"
            style={{ background: '#F8FAFC', color: '#0F172A', border: '1px solid #CBD5E1', fontFamily: 'inherit' }}
          />
        </div>

        {/* Reset-all */}
        <button
          onClick={resetAll}
          disabled={!anyModified || loading}
          className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-40"
          style={{
            background: 'transparent',
            color: anyModified ? '#D97706' : '#475569',
            border: `1px solid ${anyModified ? 'rgba(217,119,6,0.3)' : '#CBD5E1'}`,
            cursor: anyModified ? 'pointer' : 'not-allowed',
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('reset_all_prices') || 'Barcha narxlarni tiklash'}
        </button>
      </div>

      {/* Table */}
      <div className="mt-5">
        {loading && items.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#94A3B8' }}>
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            {t('loading') || 'Yuklanmoqda…'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#94A3B8' }}>
            {t('no_resources_found') || 'Hech narsa topilmadi'}
          </div>
        ) : (
          <div
            className="rounded-[10px] overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
          >
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    { l: '№',        w: 50,  align: 'left' },
                    { l: 'Kat.',     w: 90,  align: 'left' },
                    { l: 'Nomi',     w: null, align: 'left' },
                    { l: "O'lchov",  w: 80,  align: 'center' },
                    { l: 'Material turi', w: 160, align: 'left' },
                    { l: 'Joriy narx', w: 150, align: 'right' },
                    { l: 'Asl narx', w: 110, align: 'right' },
                    { l: 'Farq',     w: 80,  align: 'right' },
                    { l: 'Tarix',    w: 90,  align: 'left' },
                    { l: '',         w: 40,  align: 'center' },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="text-[10px] uppercase tracking-[0.1em] font-semibold py-3 px-3.5"
                      style={{
                        background: '#F1F5F9',
                        color: '#64748B',
                        textAlign: h.align,
                        width: h.w || 'auto',
                        borderBottom: '1px solid #CBD5E1',
                      }}
                    >
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const c = classify(row.resource_type);
                  const tag = CAT_TAG[c];
                  const k = rowKey(row);
                  const draft = priceDraft[k];
                  const priceVal = draft !== undefined ? draft : fmt(row.price);
                  const draftDirty = draft !== undefined && Number(String(draft).replace(/\s/g, '').replace(',', '.')) !== Number(row.price);
                  const isMaterial = c === 'material';

                  const origPrice = Number(row.original_price || 0);
                  const curPrice = Number(row.price || 0);
                  const isModified = origPrice > 0 && Math.abs(curPrice - origPrice) > 0.01;
                  const diff = curPrice - origPrice;
                  const diffPct = origPrice > 0 ? (diff / origPrice) * 100 : 0;

                  const matType = String(row.material_type || 'standard').toLowerCase();
                  const matTypeColor = MATERIAL_TYPES.find((m) => m.value === matType)?.color || '#475569';

                  return (
                    <tr
                      key={k}
                      style={{
                        background: isModified ? 'rgba(13,148,136,0.04)' : 'transparent',
                        borderTop: '1px solid #E2E8F0',
                      }}
                    >
                      <td className="px-3.5 py-2.5 font-mono" style={{ color: '#94A3B8' }}>{i + 1}</td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                          style={{ background: tag.bg, color: tag.fg }}
                        >
                          {tag.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[12px]" style={{ color: '#0F172A' }}>
                        {row.name}
                      </td>
                      <td className="px-3.5 py-2.5 text-center" style={{ color: '#475569' }}>
                        {row.uom || ''}
                      </td>
                      <td className="px-3.5 py-2.5">
                        {isMaterial ? (
                          <select
                            value={matType}
                            onChange={(e) => updateMatType(row, e.target.value)}
                            className="px-2 py-1.5 rounded text-[11px] outline-none cursor-pointer w-full"
                            style={{
                              background: '#F8FAFC',
                              color: matTypeColor,
                              border: '1px solid #CBD5E1',
                              fontFamily: 'inherit',
                            }}
                          >
                            {MATERIAL_TYPES.map((mt) => (
                              <option key={mt.value} value={mt.value} style={{ background: '#FFFFFF', color: '#0F172A' }}>
                                {t(MAT_LABEL_KEY[mt.value]) || mt.fallback}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px]" style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={priceVal ?? ''}
                          onChange={(e) => setPriceDraft((d) => ({ ...d, [k]: e.target.value }))}
                          onBlur={(e) => {
                            if (draftDirty) commitPrice(row, e.target.value);
                            setPriceDraft((d) => { const n = { ...d }; delete n[k]; return n; });
                          }}
                          onFocus={(e) => e.target.select()}
                          className="px-2.5 py-2 rounded-[5px] text-[13px] font-mono text-right outline-none transition w-full"
                          style={{
                            background: '#F8FAFC',
                            color: draftDirty ? '#0D9488' : (isModified ? '#D97706' : '#0F172A'),
                            border: '1px solid #CBD5E1',
                            fontWeight: draftDirty || isModified ? 600 : 500,
                          }}
                        />
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono tabular-nums" style={{ color: '#64748B' }}>
                        {origPrice > 0 ? fmt(origPrice) : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        {isModified ? (
                          <span style={{ color: diff >= 0 ? '#F87171' : '#4ADE80', fontWeight: 600 }}>
                            {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <button
                          onClick={() => openHistory(row)}
                          className="px-2 py-1 rounded text-[10px] flex items-center gap-1 transition"
                          style={{
                            background: 'rgba(13,148,136,0.08)',
                            color: '#0D9488',
                            border: '1px solid rgba(13,148,136,0.2)',
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          {row.history_count || 0}
                        </button>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        {isModified && (
                          <button
                            onClick={() => resetPrice(row)}
                            title={t('reset_to_original') || 'Asl qiymatga qaytarish'}
                            className="w-7 h-7 rounded-[5px] flex items-center justify-center transition mx-auto"
                            style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#D97706' }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History modal — Radix primitives directly so we control width. */}
      <DialogPrimitive.Root open={historyOpen} onOpenChange={setHistoryOpen}>
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
              maxWidth: 540,
              maxHeight: 'calc(100vh - 64px)',
              zIndex: 101,
              background: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #CBD5E1',
              borderRadius: 12,
              fontFamily: "'Inter', system-ui, sans-serif",
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: "0 10px 40px rgba(15,23,42,0.15)",
            }}
          >
          <div style={{ borderBottom: '1px solid #E2E8F0' }} className="px-6 py-5 flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: '#64748B' }}>
                {t('price_history') || 'Narx tarixi'}
              </div>
              <DialogPrimitive.Title className="text-base font-semibold mt-1 truncate" style={{ color: '#0F172A' }}>
                {historyResource?.name}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569' }}
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="px-6 py-5">
            {historyLoading ? (
              <div className="py-8 text-center" style={{ color: '#64748B' }}>
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                {t('loading') || 'Yuklanmoqda…'}
              </div>
            ) : historyRows.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: '#94A3B8' }}>
                {t('no_price_history') || "Tarix bo'sh"}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {historyRows.map((h, i) => {
                  const diff = h.new_price - h.old_price;
                  const pct = h.old_price > 0 ? (diff / h.old_price) * 100 : 0;
                  return (
                    <div
                      key={h.id}
                      className="px-3 py-2.5 rounded-md flex justify-between items-center text-xs"
                      style={{
                        background: '#F8FAFC',
                        border: i === 0 ? '1px solid #0D9488' : '1px solid #CBD5E1',
                      }}
                    >
                      <div>
                        <div className="font-mono" style={{ color: '#475569' }}>
                          {new Date(h.changed_at).toLocaleString()}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>
                          {h.changed_by_name || (t('system') || 'Tizim')}
                          {h.note ? ` · ${h.note}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono">
                          <span style={{ color: '#64748B' }}>{fmt(h.old_price)}</span>
                          <span className="mx-1" style={{ color: '#64748B' }}>→</span>
                          <span className="font-semibold" style={{ color: '#D97706' }}>{fmt(h.new_price)}</span>
                        </div>
                        {h.old_price > 0 && (
                          <div
                            className="text-[10px] mt-0.5"
                            style={{ color: diff >= 0 ? '#F87171' : '#4ADE80' }}
                          >
                            {diff >= 0 ? '+' : ''}{pct.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
