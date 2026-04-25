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
const OVERHEAD_PCT = { standard: 7, equipment: 3.2, cable: 3.5, metal: 5.75, import: 4 };
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
  if (['equipment', 'machine', 'mashina', 'masina'].includes(rt)) return 'equipment';
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

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState('all');           // Barchasi / Mehnat / Mashina / Material
  const [matFilter, setMatFilter] = useState(''); // '' | 'standard' | 'equipment' | 'cable' | 'metal' | 'import'
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
    // The mat-type chips imply "show only material rows of this bucket".
    // Only material rows have a material_type, so picking a mat chip also
    // narrows the category filter to "material" automatically.
    if (matFilter) {
      xs = xs.filter((r) => classify(r.resource_type) === 'material'
        && String(r.material_type || 'standard').toLowerCase() === matFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.uom || '').toLowerCase().includes(q));
    }
    return xs;
  }, [items, cat, matFilter, search]);

  // Counts shown in the AVTO-ANIQLASH strip — how many material rows are
  // currently classified into each bucket. Updates live as the foreman
  // re-tags resources via the per-row dropdown.
  const matCounts = useMemo(() => {
    const c = { standard: 0, equipment: 0, cable: 0, metal: 0, import: 0 };
    for (const r of items) {
      if (classify(r.resource_type) !== 'material') continue;
      const mt = String(r.material_type || 'standard').toLowerCase();
      if (c[mt] !== undefined) c[mt] += 1;
    }
    return c;
  }, [items]);

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
      {/* Toolbar — category pills + material-type chips + search.
         Layout matches the v23 mockup: chips on the left, search on the
         right; the reset-all button gets its own row underneath. */}
      <div
        className="rounded-[10px] p-4 flex items-center gap-3 flex-wrap"
        style={{ background: '#1E293B', border: '1px solid #1E293B' }}
      >
        {/* Category pills */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#0B1220' }}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => { setCat(c.key); if (c.key !== 'material') setMatFilter(''); }}
                className="px-3.5 py-2 rounded-[5px] text-xs flex items-center gap-1.5 transition"
                style={{
                  background: active ? '#1E293B' : 'transparent',
                  color: active ? '#14B8A6' : '#CBD5E1',
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

        {/* Material-type chips (Stroyamaterial 7%, Uskuna 3,2%, Kabel 3,5%,
           etc.) — only the three most common surface in the v23 mockup
           top strip; the rest stay reachable via the per-row dropdown.
           Picking a chip auto-narrows category to "material". */}
        {[ 'standard', 'equipment', 'cable' ].map((mt) => {
          const meta = MATERIAL_TYPES.find((m) => m.value === mt);
          const active = matFilter === mt;
          return (
            <button
              key={mt}
              onClick={() => {
                setCat('material');
                setMatFilter(active ? '' : mt);
              }}
              className="px-3 py-2 rounded-md text-[12px] flex items-center gap-1.5 transition"
              style={{
                background: active ? `${meta.color}22` : 'transparent',
                color: meta.color,
                border: `1px solid ${active ? meta.color : 'rgba(148,163,184,0.25)'}`,
                cursor: 'pointer',
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: meta.color }} />
              {meta.chip}
            </button>
          );
        })}

        {/* Search */}
        <div className="relative" style={{ minWidth: 240, flex: 1 }}>
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_resource') || 'Resurs qidirish...'}
            className="w-full pl-9 pr-3 py-2.5 rounded-md text-[13px] outline-none"
            style={{ background: '#0B1220', color: '#F1F5F9', border: '1px solid #334155', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Reset-all on its own row (mockup layout). */}
      <div className="mt-3">
        <button
          onClick={resetAll}
          disabled={!anyModified || loading}
          className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-40"
          style={{
            background: 'transparent',
            color: anyModified ? '#F59E0B' : '#CBD5E1',
            border: `1px solid ${anyModified ? 'rgba(245,158,11,0.3)' : '#334155'}`,
            cursor: anyModified ? 'pointer' : 'not-allowed',
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('reset_all_prices') || 'Barcha narxlarni tiklash'}
        </button>
      </div>

      {/* AVTO-ANIQLASH — live count of material rows tagged into each
         bucket. Mirrors the v23 mockup's auto-detection summary so the
         foreman can see at a glance how many resources fall into each
         regulated transport+storage category. */}
      {(matCounts.standard + matCounts.equipment + matCounts.cable + matCounts.metal + matCounts.import) > 0 && (
        <div className="mt-3 rounded-[10px] px-4 py-3 flex items-center gap-3 flex-wrap"
             style={{ background: '#1E293B', border: '1px solid #1E293B' }}>
          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold" style={{ color: '#94A3B8' }}>
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
         carries a coloured header bar with a row count, and rows inside
         carry the new NAKRUTKA / NARX+NAKRUTKA columns so the foreman can
         see what each resource will contribute to the Form 2 totals
         after the regulated transport+storage uplift is applied. */}
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
          sections.map((sec) => (
            <div key={sec.key} className="mb-5 rounded-[10px] overflow-hidden"
                 style={{ background: '#1E293B', border: '1px solid #1E293B' }}>
              {/* Section header */}
              <div className="px-4 py-2.5 flex items-center gap-2"
                   style={{
                     background: `${sec.color}14`,
                     borderLeft: `3px solid ${sec.color}`,
                     borderBottom: '1px solid #334155',
                   }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: sec.color }} />
                <span className="text-[12px] uppercase tracking-[0.08em] font-bold" style={{ color: sec.color }}>
                  {sec.label}
                </span>
                <span className="text-[11px]" style={{ color: '#94A3B8' }}>
                  — {sec.rows.length} {t('resources_count_suffix') || 'ресурсов'}
                </span>
              </div>

              {/* table-layout: fixed honours <col> widths strictly so the
                 Joriy narx input no longer shrinks to fit long Nomi text.
                 Wrapped in an overflow-x-auto box so very-narrow viewports
                 can still scroll horizontally to reach the rightmost
                 columns instead of squashing the price input. */}
              <div className="overflow-x-auto">
              <table className="border-collapse text-[13px]" style={{ tableLayout: 'fixed', width: '100%', minWidth: 1380 }}>
                <colgroup>
                  <col style={{ width: 50  }} />
                  <col style={{ width: 90  }} />
                  <col />{/* Nomi — flexible */}
                  <col style={{ width: 80  }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 200 }} />{/* Joriy narx */}
                  <col style={{ width: 130 }} />{/* Nakrutka */}
                  <col style={{ width: 160 }} />{/* Narx + Nakrutka */}
                  <col style={{ width: 130 }} />{/* Asl narx */}
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
                      { l: 'Nakrutka',         align: 'right' },
                      { l: 'Narx + Nakrutka',  align: 'right' },
                      { l: 'Asl narx',         align: 'right' },
                      { l: 'Farq',             align: 'right' },
                      { l: 'Tarix',            align: 'left' },
                      { l: '',                 align: 'center' },
                    ].map((h, i) => (
                      <th
                        key={i}
                        className="text-[10px] uppercase tracking-[0.1em] font-semibold py-3 px-3.5"
                        style={{
                          background: '#1E293B',
                          color: '#94A3B8',
                          textAlign: h.align,
                          borderBottom: '1px solid #334155',
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

                    // Per-line transport+storage uplift. Only material rows
                    // attract overhead; labor/machine rows show a dash.
                    const overheadPct = isMaterial ? (OVERHEAD_PCT[matType] || 0) : 0;
                    const overheadAmt = curPrice * overheadPct / 100;
                    const totalWithOverhead = curPrice + overheadAmt;

                    return (
                      <tr
                        key={k}
                        style={{
                          background: isModified ? 'rgba(20,184,166,0.04)' : 'transparent',
                          borderTop: '1px solid #1E293B',
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
                        <td className="px-3.5 py-2.5 text-[12px]" style={{ color: '#F1F5F9' }}>
                          {row.name}
                        </td>
                        <td className="px-3.5 py-2.5 text-center" style={{ color: '#CBD5E1' }}>
                          {row.uom || ''}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {isMaterial ? (
                            <select
                              value={matType}
                              onChange={(e) => updateMatType(row, e.target.value)}
                              className="px-2 py-1.5 rounded text-[11px] outline-none cursor-pointer w-full"
                              style={{
                                background: '#0B1220',
                                color: matTypeColor,
                                border: '1px solid #334155',
                                fontFamily: 'inherit',
                              }}
                            >
                              {MATERIAL_TYPES.map((mt) => (
                                <option key={mt.value} value={mt.value} style={{ background: '#1E293B', color: '#F1F5F9' }}>
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
                              background: '#0B1220',
                              color: draftDirty ? '#14B8A6' : (isModified ? '#F59E0B' : '#F1F5F9'),
                              border: '1px solid #334155',
                              fontWeight: draftDirty || isModified ? 600 : 500,
                            }}
                          />
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                          {isMaterial && curPrice > 0 ? (
                            <span style={{ color: matTypeColor, fontWeight: 500 }}>
                              {fmt(overheadAmt)} <span className="text-[10px]" style={{ color: '#64748B' }}>({overheadPct}%)</span>
                            </span>
                          ) : (
                            <span style={{ color: '#64748B' }}>—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono tabular-nums" style={{ color: isMaterial ? '#F59E0B' : '#94A3B8', fontWeight: isMaterial ? 600 : 400 }}>
                          {isMaterial && curPrice > 0 ? fmt(totalWithOverhead) : '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono tabular-nums" style={{ color: '#94A3B8' }}>
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
                              background: 'rgba(20,184,166,0.08)',
                              color: '#14B8A6',
                              border: '1px solid rgba(20,184,166,0.2)',
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
                              style={{ background: '#1E293B', border: '1px solid #334155', color: '#F59E0B' }}
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
          <div style={{ borderBottom: '1px solid #1E293B' }} className="px-6 py-5 flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: '#94A3B8' }}>
                {t('price_history') || 'Narx tarixi'}
              </div>
              <DialogPrimitive.Title className="text-base font-semibold mt-1 truncate" style={{ color: '#F1F5F9' }}>
                {historyResource?.name}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1' }}
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="px-6 py-5">
            {historyLoading ? (
              <div className="py-8 text-center" style={{ color: '#94A3B8' }}>
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
                        background: '#0B1220',
                        border: i === 0 ? '1px solid #14B8A6' : '1px solid #334155',
                      }}
                    >
                      <div>
                        <div className="font-mono" style={{ color: '#CBD5E1' }}>
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
                          <span className="font-semibold" style={{ color: '#F59E0B' }}>{fmt(h.new_price)}</span>
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
