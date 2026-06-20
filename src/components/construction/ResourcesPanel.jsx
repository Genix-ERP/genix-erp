import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, Users, Wrench, Package, Grid3x3, RotateCcw, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useAuth } from '@/components/contexts/AuthContext';
import { constructionService } from '@/api/services/construction';
import { formatApiError } from '@/utils/apiErrors';
import Loader from '@/components/ui/loader';

// ResourcesPanel — faithful port of the mockup's Resources page
// (files/Form2_Works_v2 (7).html → renderResourcesPage()).
//
// Visual = dark theme with teal/amber accents to match the rest of the
// Smeta boshqaruvi tab.
//
// Columns mirror the mockup exactly:
//   №  ·  Kat. tag  ·  Name  ·  Unit  ·  Material type  ·  Current price
//   ·  Original price  ·  Diff %  ·  History (count badge)

// Up to 6 fractional digits with trailing zeros dropped, so per-unit
// prices and small overhead amounts (e.g. 0.758) don't get silently
// truncated. Whole-soum and kopek-precision values render unchanged.
const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 })
    .format(v).replace(/\u00A0/g, ' ');
};

const CATEGORIES = [
  { key: 'all',       icon: Grid3x3, label: 'Barchasi' },
  { key: 'labor',     icon: Users,   label: 'Mehnat' },
  { key: 'equipment', icon: Wrench,  label: 'Mashina' },
  { key: 'material',  icon: Package, label: 'Material' },
];

// Embedded percentages help foremen pick the right bucket without
// having to look up the rates externally. Mirrors v23 MAT_TYPE_LABELS.
//
// Combined transport+storage rates per Госкомархитектстрой letter
// №352/12-05 of 2011 (transport per pt 2 + storage per pt 3):
//   • standard    = 5%    + 2%    = 7%
//   • equipment   = 2%    + 1.2%  = 3.2%
//   • cable       = 1.5%  + 2%    = 3.5%
//   • metal       = 5%    + 0.75% = 5.75%
//   • import      = 2%    + 2%    = 4%
const MATERIAL_TYPES = [
  { value: 'standard',  fallback: 'Oddiy material (7%)',             chip: 'Stroyamaterial 7%',   color: '#14B8A6' },
  { value: 'equipment', fallback: 'Uskuna (3,2%)',                   chip: 'Uskuna 3,2%',         color: '#A78BFA' },
  { value: 'cable',     fallback: 'Kabel-simli mahsulot (3,5%)',     chip: 'Kabel 3,5%',          color: '#F87171' },
  { value: 'metal',     fallback: 'Metall konstruksiya (5,75%)',     chip: 'Metall 5,75%',        color: '#F59E0B' },
  { value: 'import',    fallback: 'Import material (4%)',            chip: 'Import 4%',           color: '#FB7185' },
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
  // 'machinery' (Mashina mexanizm) buckets into the same MASHINA filter
  // as legacy 'equipment' — both render under the Mashina tag.
  if (['equipment', 'machine', 'mashina', 'masina', 'machinery'].includes(rt)) return 'equipment';
  return 'material';
}

const CAT_TAG = {
  labor:     { bg: 'rgba(245,158,11,0.1)',  fg: '#F59E0B', label: 'MEHNAT' },
  equipment: { bg: 'rgba(167,139,250,0.1)',  fg: '#A78BFA', label: 'MASHINA' },
  material:  { bg: 'rgba(20,184,166,0.1)',  fg: '#14B8A6', label: 'MATERIAL' },
};

export default function ResourcesPanel({ project, estimateId, onResourceChanged }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  // Bulk reset is destructive (rolls every resource price in the project
  // back to its original) so it's gated to system admin + tenant owner.
  // Foremen / engineers see the panel but the orange Reset-all button
  // simply doesn't render for them.
  const { isSiteAdmin, isOwner } = useAuth();
  const canResetAll = (isSiteAdmin?.() || isOwner?.()) === true;

  const PAGE_SIZE = 20;

  const [items, setItems] = useState([]);          // accumulated across pages
  const [loading, setLoading] = useState(false);    // initial / filter-change load
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  // Server-computed counts (stable regardless of the active page/filter) —
  // the endpoint is paginated, so deriving these from the loaded rows would
  // only reflect the current page.
  const [matCounts, setMatCounts] = useState({ standard: 0, equipment: 0, cable: 0, metal: 0, import: 0 });
  const [modifiedCount, setModifiedCount] = useState(0);

  const [cat, setCat] = useState('all');           // Barchasi / Mehnat / Mashina / Material
  const [matFilter, setMatFilter] = useState(''); // '' | 'standard' | 'equipment' | 'cable' | 'metal' | 'import'
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priceDraft, setPriceDraft] = useState({});

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyResource, setHistoryResource] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const rowKey = (r) => `${r.name}::${r.uom || ''}`;

  // Debounce the free-text search so each keystroke doesn't fire a request.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Fetch one page. append=false replaces (filter change / reload),
  // append=true adds to the bottom (infinite scroll). All filtering happens
  // server-side now — category, material-type chip and search are sent as
  // query params so pagination stays correct across the whole catalog.
  const fetchPage = useCallback(async (pageToLoad, { append }) => {
    if (!project?.id) return;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await constructionService.listResourcePrices(project.id, {
        estimateId,
        type: cat === 'all' ? undefined : cat,
        materialType: matFilter || undefined,
        q: debouncedSearch || undefined,
        page: pageToLoad,
        pageSize: PAGE_SIZE,
      });
      const rows = res.data || [];
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      setPage(res.meta?.page || pageToLoad);
      setHasNext(!!res.meta?.has_next);
      const mc = res.summary?.material_type_counts || {};
      setMatCounts({
        standard: mc.standard || 0, equipment: mc.equipment || 0,
        cable: mc.cable || 0, metal: mc.metal || 0, import: mc.import || 0,
      });
      setModifiedCount(Number(res.summary?.modified_count || 0));
      if (!append) setPriceDraft({});
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      if (!append) setItems([]);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, estimateId, cat, matFilter, debouncedSearch]);

  // Reload from page 1 whenever the project, scope or any filter changes.
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasNext(false);
    fetchPage(1, { append: false });
  }, [fetchPage]);

  const reload = useCallback(() => fetchPage(1, { append: false }), [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasNext) return;
    fetchPage(page + 1, { append: true });
  }, [loading, loadingMore, hasNext, page, fetchPage]);

  // Infinite scroll — observe a sentinel at the bottom of the list.
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Server already applied category / material-type / search filters, so the
  // loaded rows ARE the filtered set.
  const filtered = items;

  // Group filtered rows into the v23 "ТРУД И МАШИНЫ — N ресурсов" /
  // "СТРОЙМАТЕРИАЛЫ — N ресурсов" / "КАБЕЛЬНАЯ ПРОДУКЦИЯ — N ресурсов" /
  // etc sections. Sections preserve order so the document feels stable.
  const sections = useMemo(() => {
    const labelOf = (r) => {
      const c = classify(r.resource_type);
      if (c !== 'material') return { key: 'labor_machines', label: 'ТРУД И МАШИНЫ', color: '#F59E0B' };
      const mt = String(r.material_type || 'standard').toLowerCase();
      switch (mt) {
        case 'equipment': return { key: 'equipment', label: 'ОБОРУДОВАНИЕ',                color: '#A78BFA' };
        case 'cable':     return { key: 'cable',     label: 'КАБЕЛЬНО-ПРОВОДНИКОВАЯ',     color: '#F87171' };
        case 'metal':     return { key: 'metal',     label: 'МЕТАЛЛОКОНСТРУКЦИИ',         color: '#FBBF24' };
        case 'import':    return { key: 'import',    label: 'ИМПОРТНЫЕ МАТЕРИАЛЫ',        color: '#FB7185' };
        default:          return { key: 'standard',  label: 'СТРОЙМАТЕРИАЛЫ',             color: '#14B8A6' };
      }
    };
    const buckets = new Map();
    for (const r of filtered) {
      const meta = labelOf(r);
      if (!buckets.has(meta.key)) buckets.set(meta.key, { ...meta, rows: [] });
      buckets.get(meta.key).rows.push(r);
    }
    // Stable section order matching the regulation cascade.
    const order = ['labor_machines', 'standard', 'equipment', 'cable', 'metal', 'import'];
    return order.map((k) => buckets.get(k)).filter(Boolean);
  }, [filtered]);

  // Server-computed, project/estimate-wide — not limited to the loaded page.
  const anyModified = modifiedCount > 0;

  // Refresh ONLY the scope-wide summary (chip counts + modified count) after a
  // mutation, without re-fetching the list or disturbing scroll position.
  // material_type_counts / modified_count ignore the active filters, so a
  // 1-row page is enough to read them.
  const refreshSummary = useCallback(async () => {
    if (!project?.id) return;
    try {
      const res = await constructionService.listResourcePrices(project.id, { estimateId, pageSize: 1 });
      const mc = res.summary?.material_type_counts || {};
      setMatCounts({
        standard: mc.standard || 0, equipment: mc.equipment || 0,
        cable: mc.cable || 0, metal: mc.metal || 0, import: mc.import || 0,
      });
      setModifiedCount(Number(res.summary?.modified_count || 0));
    } catch {
      /* non-critical — counts refresh on next full load */
    }
  }, [project?.id, estimateId]);

  // Every mutation below carries `estimateId` when set so the UPDATE on
  // the backend is scoped to a single estimate (block). Without this,
  // editing Block 1's cement price would also overwrite Block 2's row,
  // which is exactly what the user asked us to stop doing.
  const commitPrice = useCallback(async (row, raw) => {
    const newPrice = Number(String(raw).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(newPrice) || newPrice < 0) return;
    if (Math.abs(newPrice - Number(row.price || 0)) < 0.001) return;
    try {
      const result = await constructionService.bulkUpdateResourcePrice(project.id, {
        resource_name: row.name,
        uom: row.uom || '',
        resource_type: row.resource_type,
        new_price: newPrice,
        estimate_id: estimateId || undefined,
      });
      setItems((rows) => rows.map((r) => rowKey(r) === rowKey(row)
        ? { ...r, price: newPrice, history_count: (r.history_count || 0) + 1 }
        : r));
      toast.success(`${t('saved') || 'Saqlandi'} · ${result?.lines_updated || 0} ${t('rows') || 'qator'}`);
      onResourceChanged?.();
      refreshSummary();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      reload();
    }
  }, [project?.id, estimateId, t, onResourceChanged, reload, refreshSummary]);

  const updateMatType = useCallback(async (row, value) => {
    try {
      await constructionService.bulkUpdateResourceMaterialType(project.id, {
        resource_name: row.name,
        uom: row.uom || '',
        material_type: value,
        estimate_id: estimateId || undefined,
      });
      setItems((rows) => rows.map((r) => rowKey(r) === rowKey(row) ? { ...r, material_type: value } : r));
      onResourceChanged?.();
      refreshSummary();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [project?.id, estimateId, t, onResourceChanged, refreshSummary]);

  const resetPrice = useCallback(async (row) => {
    try {
      const result = await constructionService.resetResourcePrice(project.id, {
        resource_name: row.name,
        uom: row.uom || '',
        estimate_id: estimateId || undefined,
      });
      const newP = Number(result?.new_price ?? row.original_price ?? row.price);
      setItems((rows) => rows.map((r) => rowKey(r) === rowKey(row)
        ? { ...r, price: newP, history_count: (r.history_count || 0) + 1 }
        : r));
      toast.success(t('reset_price_done') || 'Narx asl qiymatga qaytarildi');
      onResourceChanged?.();
      refreshSummary();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      reload();
    }
  }, [project?.id, estimateId, t, onResourceChanged, reload, refreshSummary]);

  // Confirm modal state — replaces window.confirm() for the reset-all
  // bulk action so the prompt matches the rest of the app's styling and
  // can be translated. Shape: { onConfirm } or null when closed.
  const [resetAllConfirm, setResetAllConfirm] = useState(false);

  const performResetAll = useCallback(async () => {
    try {
      const result = await constructionService.resetAllResourcePrices(project.id, {
        estimateId: estimateId || undefined,
      });
      const tmpl = t('reset_all_done') || 'Reset {count} resource(s) across {lines} line(s)';
      toast.success(tmpl
        .replace('{count}', String(result?.resources_affected || 0))
        .replace('{lines}', String(result?.lines_updated || 0)));
      onResourceChanged?.();
      reload();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [project?.id, estimateId, t, onResourceChanged, reload]);

  const resetAll = useCallback(() => {
    setResetAllConfirm(true);
  }, []);

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
      {/* Toolbar — category pills + material-type chips + search.
         Light theme matches the rest of the Smeta boshqaruvi tab:
         white card with slate-200 border, slate-50 inset for the pill
         track, white pill background when active. */}
      <div
        className="rounded-[10px] p-4 flex items-center gap-3 flex-wrap"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        {/* Category pills */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F1F5F9' }}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => { setCat(c.key); if (c.key !== 'material') setMatFilter(''); }}
                className="px-3.5 py-2 rounded-[5px] text-xs flex items-center gap-1.5 transition"
                style={{
                  background: active ? '#FFFFFF' : 'transparent',
                  color: active ? '#0D9488' : '#475569',
                  fontFamily: 'inherit',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`res_cat_${c.key === 'equipment' ? 'equipment' : c.key === 'material' ? 'material' : c.key}`) || c.label}
              </button>
            );
          })}
        </div>

        {/* Material-type chips (Stroyamaterial 7%, Uskuna 3,2%, Kabel 3,5%,
           etc.) — only the three most common surface in the v23 mockup
           top strip; the rest stay reachable via the per-row dropdown.
           Picking a chip auto-narrows category to "material". */}
        {[ 'standard', 'equipment', 'cable' ].map((mt) => {
          const meta = MATERIAL_TYPES.find((m) => m.value === mt);
          const active = matFilter === mt;
          const count = matCounts[mt] || 0;
          // Strip the trailing "%" rate from the chip label so the count
          // reads as the headline metric (the % is repeated everywhere
          // else — material-turi dropdown, Form 2 footnote, etc.).
          // Examples: "Stroyamaterial 7%" → "Stroyamaterial · 12".
          const baseLabel = meta.chip.replace(/\s*\d+([.,]\d+)?\s*%\s*$/, '').trim();
          return (
            <button
              key={mt}
              onClick={() => {
                setCat('material');
                setMatFilter(active ? '' : mt);
              }}
              className="px-3 py-2 rounded-md text-[12px] flex items-center gap-1.5 transition"
              style={{
                background: active ? `${meta.color}1a` : '#FFFFFF',
                color: meta.color,
                border: `1px solid ${active ? meta.color : '#E2E8F0'}`,
                cursor: 'pointer',
                fontWeight: active ? 600 : 500,
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: meta.color }} />
              {baseLabel}
              <span
                className="ml-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold tabular-nums"
                style={{
                  background: active ? `${meta.color}26` : '#F1F5F9',
                  color: meta.color,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}

        {/* Search */}
        <div className="relative" style={{ minWidth: 240, flex: 1 }}>
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_resource') || 'Resurs qidirish...'}
            className="w-full pl-9 pr-3 py-2.5 rounded-md text-[13px] outline-none"
            style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid #E2E8F0', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Reset-all on its own row (mockup layout). Visible only to
         system admin / tenant owner — wiping every price back to its
         original isn't something a foreman should be able to do. */}
      {canResetAll && (
        <div className="mt-3">
          <button
            onClick={resetAll}
            disabled={!anyModified || loading}
            className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-40"
            style={{
              background: '#FFFFFF',
              color: anyModified ? '#D97706' : '#94A3B8',
              border: `1px solid ${anyModified ? 'rgba(217,119,6,0.4)' : '#E2E8F0'}`,
              cursor: anyModified ? 'pointer' : 'not-allowed',
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('reset_all_prices') || 'Barcha narxlarni tiklash'}
          </button>
        </div>
      )}

      {/* AVTO-ANIQLASH — live count of material rows tagged into each
         bucket. Mirrors the v23 mockup's auto-detection summary so the
         foreman can see at a glance how many resources fall into each
         regulated transport+storage category. */}
      {(matCounts.standard + matCounts.equipment + matCounts.cable + matCounts.metal + matCounts.import) > 0 && (
        <div className="mt-3 rounded-[10px] px-4 py-3 flex items-center gap-3 flex-wrap"
             style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold" style={{ color: '#64748B' }}>
            {t('auto_detection') || 'AVTO-ANIQLASH'}:
          </span>
          {[
            { mt: 'standard',  label: 'Oddiy material (7%)' },
            { mt: 'equipment', label: 'Uskuna (3,2%)' },
            { mt: 'cable',     label: 'Kabel (3,5%)' },
            { mt: 'metal',     label: 'Metall (5,75%)' },
            { mt: 'import',    label: 'Import (4%)' },
          ].filter(({ mt }) => matCounts[mt] > 0).map(({ mt, label }) => {
            const meta = MATERIAL_TYPES.find((m) => m.value === mt);
            return (
              <span key={mt}
                    className="px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1.5"
                    style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}33` }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                {label}: <span className="font-semibold">{matCounts[mt]}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Table — section-grouped per the v23 mockup layout. Each section
         carries a coloured header bar with a row count. Rows show Joriy
         narx and Nakrutka as separate columns so the user sees the raw
         resource price next to the regulated transport+storage накрутка
         without them being baked together. */}
      <div className="mt-5">
        {loading && items.length === 0 ? (
          <Loader className="py-12" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#64748B' }}>
            {t('no_resources_found') || 'Hech narsa topilmadi'}
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec.key} className="mb-5 rounded-[10px] overflow-hidden"
                 style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              {/* Section header */}
              <div className="px-4 py-2.5 flex items-center gap-2"
                   style={{
                     background: `${sec.color}10`,
                     borderLeft: `3px solid ${sec.color}`,
                     borderBottom: '1px solid #E2E8F0',
                   }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: sec.color }} />
                <span className="text-[12px] uppercase tracking-[0.08em] font-bold" style={{ color: sec.color }}>
                  {sec.label}
                </span>
                <span className="text-[11px]" style={{ color: '#64748B' }}>
                  — {sec.rows.length} {t('resources_count_suffix') || 'ресурсов'}
                </span>
              </div>

              {/* table-layout: fixed honours <col> widths strictly so the
                 Joriy narx input no longer shrinks to fit long Nomi text.
                 Wrapped in an overflow-x-auto box so very-narrow viewports
                 can still scroll horizontally to reach the rightmost
                 columns instead of squashing the price input. */}
              <div className="overflow-x-auto">
              <table className="border-collapse text-[13px]" style={{ tableLayout: 'fixed', width: '100%', minWidth: 960 }}>
                <colgroup>
                  <col style={{ width: 50  }} />
                  <col style={{ width: 90  }} />
                  <col />{/* Nomi — flexible */}
                  <col style={{ width: 80  }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 200 }} />{/* Joriy narx */}
                  <col style={{ width: 80  }} />
                  <col style={{ width: 80  }} />
                  <col style={{ width: 50  }} />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      { l: '№',                align: 'left' },
                      { l: 'Kat.',             align: 'left' },
                      { l: 'Nomi',             align: 'left' },
                      { l: "O'lchov",          align: 'center' },
                      { l: 'Material turi',    align: 'left' },
                      { l: 'Joriy narx',       align: 'right' },
                      { l: 'Farq',             align: 'right' },
                      { l: 'Tarix',            align: 'left' },
                      { l: '',                 align: 'center' },
                    ].map((h, i) => (
                      <th
                        key={i}
                        className="text-[10px] uppercase tracking-[0.1em] font-semibold py-3 px-3.5"
                        style={{
                          background: '#F8FAFC',
                          color: '#64748B',
                          textAlign: h.align,
                          borderBottom: '1px solid #E2E8F0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h.l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.map((row, i) => {
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
                    const matTypeColor = MATERIAL_TYPES.find((m) => m.value === matType)?.color || '#CBD5E1';

                    return (
                      <tr
                        key={k}
                        style={{
                          background: isModified ? 'rgba(13,148,136,0.04)' : 'transparent',
                          borderTop: '1px solid #F1F5F9',
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
                                background: '#FFFFFF',
                                color: matTypeColor,
                                border: '1px solid #E2E8F0',
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
                            // Labor / mashina rows don't have a material
                            // sub-bucket, but the user wants the column
                            // to always read meaningfully (a column full
                            // of dashes was unsettling in the Barchasi
                            // view). Show a tinted tag matching the
                            // resource category so the column still
                            // tells you what kind of resource the row is.
                            <span
                              className="inline-block px-2 py-1 rounded text-[10.5px] font-semibold"
                              style={{
                                background: c === 'labor' ? 'rgba(245,158,11,0.1)' : 'rgba(167,139,250,0.1)',
                                color: c === 'labor' ? '#D97706' : '#7C3AED',
                              }}
                            >
                              {c === 'labor'
                                ? (t('mat_type_labor') || 'Mehnat')
                                : (t('res_cat_equipment') || 'Mashina')}
                            </span>
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
                              background: '#FFFFFF',
                              color: draftDirty ? '#0D9488' : (isModified ? '#D97706' : '#0F172A'),
                              border: `1px solid ${draftDirty ? '#0D9488' : (isModified ? '#FCD34D' : '#E2E8F0')}`,
                              fontWeight: draftDirty || isModified ? 600 : 500,
                            }}
                          />
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {isModified ? (
                            <span style={{ color: diff >= 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                              {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <button
                            onClick={() => openHistory(row)}
                            className="px-2 py-1 rounded text-[10px] flex items-center gap-1 transition"
                            style={{
                              background: 'rgba(13,148,136,0.08)',
                              color: '#0D9488',
                              border: '1px solid rgba(13,148,136,0.25)',
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
                              style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#D97706' }}
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
            </div>
          ))
        )}

        {/* Infinite-scroll sentinel + "loading more" row. The observer fires
           when this element scrolls into view and there's another page. */}
        {!loading && hasNext && (
          <div ref={sentinelRef} className="py-6 flex items-center justify-center">
            {loadingMore
              ? <Loader />
              : <span className="text-[12px]" style={{ color: '#94A3B8' }}>{t('loading') || 'Yuklanmoqda…'}</span>}
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
              border: '1px solid #E2E8F0',
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
              style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B' }}
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="px-6 py-5">
            {historyLoading ? (
              <Loader />
            ) : historyRows.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: '#64748B' }}>
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
                        border: i === 0 ? '1px solid #0D9488' : '1px solid #E2E8F0',
                      }}
                    >
                      <div>
                        <div className="font-mono" style={{ color: '#475569' }}>
                          {new Date(h.changed_at).toLocaleString()}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
                          {h.changed_by_name || (t('system') || 'Tizim')}
                          {h.note ? ` · ${h.note}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono">
                          <span style={{ color: '#94A3B8' }}>{fmt(h.old_price)}</span>
                          <span className="mx-1" style={{ color: '#94A3B8' }}>→</span>
                          <span className="font-semibold" style={{ color: '#D97706' }}>{fmt(h.new_price)}</span>
                        </div>
                        {h.old_price > 0 && (
                          <div
                            className="text-[10px] mt-0.5"
                            style={{ color: diff >= 0 ? '#DC2626' : '#16A34A' }}
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

      {/* Reset-all confirm modal — replaces window.confirm() so the
         prompt is themed and translated like the rest of the app. */}
      {resetAllConfirm && (
        <ResetAllConfirmModal
          t={t}
          onCancel={() => setResetAllConfirm(false)}
          onConfirm={() => { setResetAllConfirm(false); performResetAll(); }}
        />
      )}
    </div>
  );
}

// =====================================================================
// ResetAllConfirmModal — styled confirm dialog used for the
// "Barcha narxlarni qaytarish" bulk action. Click outside / Esc cancels.
// =====================================================================
function ResetAllConfirmModal({ t, onConfirm, onCancel }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-[520px] w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-900 mb-3">
          {t('reset_all_prices') || 'Barcha narxlarni qaytarish'}
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed mb-5 whitespace-pre-line">
          {t('reset_all_confirm') || 'O\'zgartirilgan barcha narxlar asl qiymatlariga qaytariladi. Davom etamizmi?'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            {t('cancel') || 'Bekor qilish'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-1.5"
          >
            <span className="text-[14px] leading-none">↻</span>
            {t('reset_all_prices') || 'Barcha narxlarni qaytarish'}
          </button>
        </div>
      </div>
    </div>
  );
}
