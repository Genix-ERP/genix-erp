import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Loader2, Search, Users, Wrench, Package, FileText, RefreshCw,
  Plus, Trash2, ChevronDown, RotateCcw, ListChecks, Boxes, Grid3x3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { formatApiError } from '@/utils/apiErrors';
import Form2Preview from '@/components/construction/Form2Preview';
import ResourcesPanel from '@/components/construction/ResourcesPanel';
import AddResourcePickerModal from '@/components/construction/AddResourcePickerModal';
import AddSubWorkModal from '@/components/construction/AddSubWorkModal';

// SmetaManagementTab — full match to files/Form2_Works_v2 (7).html.
//
// Behaviour parity (everything the mockup does, the tab does):
//
//   - Sticky topbar (breadcrumb + title + estimate selector + Forma 2 btn)
//   - Sticky main-tabs strip (Ishlar / Resurslar) with live counts
//   - "X o'zgarish" status pill in the topbar — count of resource prices
//     that drifted from their original anchor
//   - 4 stat cards (Mehnat / Mashina / Material / JAMI gradient)
//   - Toolbar (search + section dropdown + Ochish/Yopish)
//   - Sections (collapsible) showing "X ish · YYY so'm"
//   - Work cards in 8-column grid; ⚠ 0 marker + amber border for empty qty
//   - Sub-stages render as their own TOP-LEVEL cards, inserted right after
//     their parent in the section list, with margin-left 32px and a teal
//     left border. They have their own qty input and resource breakdown.
//   - Two distinct add buttons inside an expanded work:
//       + Yangi etap        (amber dashed) → AddSubWorkModal
//       + Qo'shimcha resurs (teal dashed)  → AddResourcePickerModal
//   - Expanded sub-stages have an "Etap hajmi:" qty input + Resurs qo'shish
//     button + delete button
//   - Per-work footer: Mehnat / Mashina / Material / JAMI breakdown
//   - Pulse animation on empty qty inputs (matches mockup keyframe)

// Color tokens — light theme. Same role names as the original mockup
// palette (so the JSX doesn't change), but mapped to white-background
// equivalents so the tab reads like a clean printed sheet rather than
// the dark dashboard the mockup originally targeted.
const C = {
  bg:        '#FFFFFF',  // main background
  card:      '#FFFFFF',  // card surface
  inset:     '#F8FAFC',  // inputs, recessed surfaces (slate-50)
  border:    '#E2E8F0',  // hairline borders (slate-200)
  border2:   '#CBD5E1',  // input/button borders (slate-300)
  text:      '#0F172A',  // main text (slate-900)
  dim:       '#475569',  // secondary text (slate-600)
  muted:     '#64748B',  // muted labels (slate-500)
  fade:      '#94A3B8',  // very-faded text/icons (slate-400)
  teal:      '#0D9488',  // primary accent (teal-600) — readable on white
  tealSoft:  'rgba(13,148,136,0.1)',
  amber:     '#D97706',  // totals + amber highlights (amber-600)
  amberSoft: 'rgba(217,119,6,0.1)',
  purple:    '#7C3AED',  // machines accent (violet-600)
  red:       '#DC2626',  // destructive actions (red-600)
  hover:     '#F1F5F9',  // row hover / muted backgrounds (slate-100)
  sec:       '#F8FAFC',  // section header background (slate-50)
};

// Inline keyframes + scrollbar styling. Injected once on mount via a
// dedicated <style> tag so we don't pollute the global stylesheet.
const SMETA_STYLE = `
@keyframes smetaPulseBorder {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.3); }
  50%      { box-shadow: 0 0 0 3px rgba(217,119,6,0.15); }
}
.smeta-empty-pulse { animation: smetaPulseBorder 2s infinite; }
.smeta-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.smeta-scroll::-webkit-scrollbar-track { background: ${C.bg}; }
.smeta-scroll::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 4px; }
.smeta-scroll::-webkit-scrollbar-thumb:hover { background: ${C.fade}; }
`;

const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
    .format(v).replace(/\u00A0/g, ' ');
};
const fmtShort = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '0';
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + ' B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + ' M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + ' K';
  return fmt(v);
};
const parseNum = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '')) || 0;

function classifyResource(rt) {
  rt = String(rt || '').toLowerCase();
  if (['labor', 'ish', 'ishchi', 'worker'].includes(rt)) return 'labor';
  if (['equipment', 'machine', 'mashina', 'masina'].includes(rt)) return 'machines';
  if (['material', 'mat', 'materialy'].includes(rt)) return 'materials';
  return 'materials';
}
function isSubStageRow(sub) {
  const rt = String(sub?.resource_type || '').trim().toLowerCase();
  return rt === '' && Number(sub?.norm_rate || 0) === 0;
}

const CAT_LABEL = { labor: 'MEHNAT', machines: 'MASHINA', materials: 'MATERIAL' };
const CAT_COLOR = {
  labor:     { tagBg: C.amberSoft, tagText: C.amber },
  machines:  { tagBg: 'rgba(124,58,237,0.1)',  tagText: C.purple },
  materials: { tagBg: C.tealSoft,  tagText: C.teal },
};

export default function SmetaManagementTab({ project }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [estimates, setEstimates] = useState([]);
  const [estimateId, setEstimateId] = useState('');
  const [lines, setLines] = useState([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage] = useState('works');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [openWorks, setOpenWorks] = useState(new Set());

  // Modal state — separate flags so the two adds are independently
  // controllable. `addTarget` carries the parent line context (could be a
  // work OR a sub-stage when adding resources to a sub-stage).
  const [addResOpen, setAddResOpen] = useState(false);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [addTarget, setAddTarget] = useState(null);

  const [form2Open, setForm2Open] = useState(false);
  const [qtyDraft, setQtyDraft] = useState({});

  // "X o'zgarish" badge — count of resources whose price drifted from
  // original. Pulled separately from the main lines query because resource
  // pricing is bucketed per (name, uom), not per line.
  const [changedCount, setChangedCount] = useState(0);

  // ── Load estimates ─────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setLoadingEstimates(true);
    constructionService.listEstimates(project.id)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setEstimates(list);
        if (list.length > 0 && !estimateId) setEstimateId(String(list[0].id));
      })
      .catch((e) => { if (!cancelled) toast.error(formatApiError(e, t, 'Xatolik')); })
      .finally(() => { if (!cancelled) setLoadingEstimates(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // ── Load lines ────────────────────────────────────────────────────
  const loadLines = useCallback(async (id) => {
    if (!id) { setLines([]); return; }
    setLoadingLines(true);
    try {
      const rows = await constructionService.listEstimateLines(id, { page_size: 5000 });
      setLines(Array.isArray(rows) ? rows : (rows?.data || rows?.items || []));
      setQtyDraft({});
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      setLines([]);
    } finally {
      setLoadingLines(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { loadLines(estimateId); }, [estimateId, loadLines]);

  // ── Changed-prices badge ──────────────────────────────────────────
  // Refreshed any time the underlying lines change (we don't poll — the
  // count moves only when the user edits a price or resets, both of which
  // already trigger loadLines).
  useEffect(() => {
    if (!project?.id) { setChangedCount(0); return; }
    let cancelled = false;
    // Project-wide count — matches the Resurslar tab's project-wide scope.
    // Resources are a project-level concept (one cement price across every
    // estimate), so the badge counts every drifted resource regardless of
    // which estimate is selected.
    constructionService.listResourcePrices(project.id)
      .then((rows) => {
        if (cancelled) return;
        const n = (rows || []).filter((r) =>
          Number(r.original_price || 0) > 0
          && Math.abs(Number(r.price || 0) - Number(r.original_price || 0)) > 0.01,
        ).length;
        setChangedCount(n);
      })
      .catch(() => { if (!cancelled) setChangedCount(0); });
    return () => { cancelled = true; };
  }, [project?.id, lines]);

  // ── Build child map and sections ──────────────────────────────────
  const subByParent = useMemo(() => {
    const m = new Map();
    for (const ln of lines) {
      const pid = ln.parent_line_id;
      if (pid != null && Number(pid) > 0) {
        const arr = m.get(Number(pid)) || [];
        arr.push(ln);
        m.set(Number(pid), arr);
      }
    }
    return m;
  }, [lines]);

  const availableSections = useMemo(() => {
    const set = new Set();
    for (const ln of lines) {
      const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
      if (isSub) continue;
      set.add(ln.parent_item_number || (t('uncategorized') || 'Boshqalar'));
    }
    return Array.from(set);
  }, [lines, t]);

  // KPIs — sum across resource sub-lines (one level deep is enough
  // for the top KPI; sub-stage internals roll up via their own resources).
  const kpis = useMemo(() => {
    let labor = 0, machines = 0, materials = 0, grand = 0, filled = 0, total = 0;
    for (const ln of lines) {
      const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
      if (isSub) continue;
      total += 1;
      if ((Number(ln.quantity) || 0) > 0) filled += 1;
      const subs = subByParent.get(Number(ln.id)) || [];
      const subResources = subs.filter((s) => !isSubStageRow(s));
      let rowAmt = 0;
      for (const s of subResources) {
        const c = Number(s.unit_rate || 0) * Number(s.quantity || 0);
        if (c <= 0) continue;
        const cat = classifyResource(s.resource_type);
        if (cat === 'labor') labor += c;
        else if (cat === 'machines') machines += c;
        else materials += c;
        rowAmt += c;
      }
      if (subResources.length === 0) rowAmt = Number(ln.total_amount) || 0;
      // Sub-stages contribute their own rolled-up totals to the parent's
      // grand total. Their internal resources also flow into the labor /
      // machines / materials buckets via their own sub-resources further
      // down the tree.
      for (const ss of subs.filter(isSubStageRow)) {
        const ssSubs = subByParent.get(Number(ss.id)) || [];
        let ssAmt = 0;
        for (const sr of ssSubs) {
          const c = Number(sr.unit_rate || 0) * Number(sr.quantity || 0);
          if (c <= 0) continue;
          const cat = classifyResource(sr.resource_type);
          if (cat === 'labor') labor += c;
          else if (cat === 'machines') machines += c;
          else materials += c;
          ssAmt += c;
        }
        if (ssSubs.length === 0) ssAmt = Number(ss.total_amount) || 0;
        rowAmt += ssAmt;
      }
      grand += rowAmt;
    }
    return { labor, machines, materials, grand, filled, total };
  }, [lines, subByParent]);

  const sections = useMemo(() => {
    const sectionMap = new Map();
    for (const ln of lines) {
      const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
      if (isSub) continue;
      const secKey = ln.parent_item_number || (t('uncategorized') || 'Boshqalar');
      if (sectionFilter && secKey !== sectionFilter) continue;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${ln.code || ''} ${ln.item_number || ''} ${ln.name || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const cur = sectionMap.get(secKey) || { name: secKey, lines: [], total: 0 };
      cur.lines.push(ln);
      cur.total += Number(ln.total_amount) || 0;
      sectionMap.set(secKey, cur);
    }
    return Array.from(sectionMap.values());
  }, [lines, search, sectionFilter, t]);

  // ── Mutations ─────────────────────────────────────────────────────
  const commitQty = useCallback(async (line, raw) => {
    const newQty = parseNum(raw);
    if (Math.abs(newQty - Number(line.quantity || 0)) < 0.0001) return;
    try {
      await constructionService.updateEstimateLine(estimateId, line.id, { quantity: newQty });
      // Optimistic local patch — the backend cascades non-override
      // sub-line quantities, but a refetch is the only authoritative way
      // to mirror that. Patch here just for snappier perceived UX.
      setLines((rows) => rows.map((r) => r.id === line.id
        ? { ...r, quantity: newQty, total_amount: Number(r.unit_rate || 0) * newQty }
        : r));
      toast.success(t('saved') || 'Saqlandi');
      // Pull authoritative state for cascading qty changes.
      loadLines(estimateId);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      loadLines(estimateId);
    }
  }, [estimateId, loadLines, t]);

  const resetQty = useCallback(async (line) => {
    try {
      await constructionService.resetLineQuantity(estimateId, line.id);
      toast.success(t('reset_qty_done') || "Hajm asl qiymatga qaytarildi");
      loadLines(estimateId);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [estimateId, loadLines, t]);

  const removeLine = useCallback(async (line) => {
    if (!window.confirm(t('confirm_delete_subline') || "O'chirishni tasdiqlaysizmi?")) return;
    try {
      await constructionService.deleteEstimateLine(estimateId, line.id);
      setLines((rows) => rows.filter((r) => r.id !== line.id && Number(r.parent_line_id) !== Number(line.id)));
      toast.success(t('deleted') || "O'chirildi");
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [estimateId, t]);

  // ── Add-flow handlers — open the right modal with the right parent ─
  const openAddStage = (work) => { setAddTarget(work); setAddStageOpen(true); };
  const openAddResource = (parentRow) => { setAddTarget(parentRow); setAddResOpen(true); };
  const nextSeqFor = (parentId) => {
    if (!parentId) return 1;
    const subs = lines.filter((r) => Number(r.parent_line_id) === Number(parentId));
    return subs.reduce((m, s) => Math.max(m, Number(s.subline_seq) || 0), 0) + 1;
  };

  // ── UI helpers ────────────────────────────────────────────────────
  const toggleSection = (k) => setCollapsedSections((s) => ({ ...s, [k]: !s[k] }));
  const toggleWork = (id) => setOpenWorks((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const expandAll = () => {
    const all = new Set();
    for (const sec of sections) {
      for (const ln of sec.lines) {
        all.add(ln.id);
        // Auto-open sub-stages too so the user sees the whole tree.
        for (const ss of (subByParent.get(Number(ln.id)) || []).filter(isSubStageRow)) all.add(ss.id);
      }
    }
    setOpenWorks(all);
  };
  const collapseAll = () => setOpenWorks(new Set());

  const selectedEstimate = estimates.find((e) => String(e.id) === String(estimateId));

  return (
    <div
      className="rounded-lg overflow-hidden smeta-scroll"
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        minHeight: '600px',
      }}
    >
      <style>{SMETA_STYLE}</style>

      {/* TOPBAR — sticky inside the tab container */}
      <div
        className="px-8 py-5 flex flex-wrap items-end justify-between gap-4"
        style={{
          borderBottom: `1px solid ${C.border}`,
          background: C.bg,
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
            Ishlab chiqarish · Форма 2 · ВОР
          </div>
          <h1 className="text-[22px] font-semibold mt-1" style={{ color: C.text }}>
            {t('nav_smeta_management') || 'Lokal resurs smeta'}
          </h1>
          <div className="text-xs mt-1" style={{ color: C.muted }}>
            {project?.name || ''}
            {project?.building_name && (
              <> · <span style={{ color: C.teal }}>{project.building_name}</span></>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Changed-count badge — only renders when something drifted. */}
          {changedCount > 0 && (
            <div
              className="px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5"
              style={{
                background: C.tealSoft,
                color: C.teal,
                border: '1px solid rgba(13,148,136,0.2)',
              }}
            >
              <span
                style={{ width: 5, height: 5, borderRadius: '50%', background: C.teal, display: 'inline-block' }}
              />
              <span>{changedCount}</span>&nbsp;{t('changes') || "o'zgarish"}
            </div>
          )}
          <select
            value={estimateId}
            onChange={(e) => setEstimateId(e.target.value)}
            disabled={loadingEstimates || estimates.length === 0}
            className="px-3 py-2 rounded-md text-xs outline-none cursor-pointer"
            style={{ background: C.inset, color: C.text, border: `1px solid ${C.border2}`, fontFamily: 'inherit', minWidth: 200 }}
          >
            {loadingEstimates && <option value="">{t('loading') || 'Yuklanmoqda…'}</option>}
            {!loadingEstimates && estimates.length === 0 && <option value="">{t('no_estimates') || "Smeta yo'q"}</option>}
            {estimates.map((est) => (
              <option key={est.id} value={String(est.id)} style={{ background: C.card, color: C.text }}>
                v{est.version || 1} · {est.name || est.source_type || `#${est.id}`} · {est.state || 'draft'}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadLines(estimateId)}
            disabled={!estimateId || loadingLines}
            className="px-3 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border2}` }}
          >
            {loadingLines ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t('refresh') || 'Yangilash'}
          </button>
          {selectedEstimate && (
            <button
              onClick={() => setForm2Open(true)}
              className="px-3.5 py-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition"
              style={{ background: C.sec, color: C.amber, border: '1px solid rgba(217,119,6,0.3)' }}
            >
              <FileText className="w-3.5 h-3.5" />
              {t('create_form2') || "Forma 2 ni yaratish"}
            </button>
          )}
        </div>
      </div>

      {/* MAIN TABS — sticky too, just under the topbar */}
      <div
        className="px-8 flex gap-1"
        style={{
          borderBottom: `1px solid ${C.border}`,
          background: C.bg,
          position: 'sticky',
          top: 0,
          zIndex: 19,
        }}
      >
        {[
          { key: 'works',     icon: ListChecks, label: t('inner_tab_works')     || 'Ishlar',    count: kpis.total },
          { key: 'resources', icon: Boxes,      label: t('inner_tab_resources') || 'Resurslar', count: null },
        ].map((tab) => {
          const active = page === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setPage(tab.key)}
              className="px-5 py-3 text-[13px] font-medium flex items-center gap-2 transition"
              style={{
                color: active ? C.teal : C.dim,
                borderBottom: active ? `2px solid ${C.teal}` : '2px solid transparent',
                background: 'transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: active ? C.tealSoft : C.hover,
                    color: active ? C.teal : C.muted,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* WORKS PAGE */}
      {page === 'works' && (
        <div>
          {/* Stats */}
          <div className="px-8 py-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <StatCard icon={Users} variant="labor"     label={t('labor_resources')       || 'Mehnat resurslari'}     value={kpis.labor} />
            <StatCard icon={Wrench} variant="mach"     label={t('construction_machines') || 'Qurilish mashinalari'}  value={kpis.machines} />
            <StatCard icon={Package} variant="mat"     label={t('material_resources')    || 'Material resurslar'}    value={kpis.materials} />
            <StatCard
              icon={Grid3x3} variant="grand" label={t('total') || 'JAMI'} value={kpis.grand}
              meta={
                <>
                  Hajm kiritilgan: <span style={{ color: C.teal, fontWeight: 600 }}>{kpis.filled}</span> / {kpis.total}
                </>
              }
            />
          </div>

          {/* Toolbar */}
          <div className="px-8 pb-4">
            <div
              className="rounded-[10px] p-3 flex flex-wrap items-center gap-2"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <div className="relative flex-1" style={{ minWidth: 240 }}>
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('search_work_or_code') || "Ish nomi yoki shifr bo'yicha qidirish..."}
                  className="w-full pl-9 pr-3 py-2.5 rounded-md text-[13px] outline-none"
                  style={{ background: C.inset, color: C.text, border: `1px solid ${C.border2}`, fontFamily: 'inherit' }}
                />
              </div>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-3 py-2.5 rounded-md text-[13px] outline-none cursor-pointer"
                style={{ background: C.inset, color: C.text, border: `1px solid ${C.border2}`, minWidth: 200 }}
              >
                <option value="">{t('section_all') || "Barcha bo'limlar"}</option>
                {availableSections.map((s) => (
                  <option key={s} value={s} style={{ background: C.card, color: C.text }}>{s}</option>
                ))}
              </select>
              <button
                onClick={expandAll}
                disabled={sections.length === 0}
                className="px-3.5 py-2 rounded-md text-xs transition disabled:opacity-50"
                style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border2}` }}
              >
                {t('expand_all') || 'Ochish'}
              </button>
              <button
                onClick={collapseAll}
                disabled={sections.length === 0}
                className="px-3.5 py-2 rounded-md text-xs transition disabled:opacity-50"
                style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border2}` }}
              >
                {t('collapse_all') || 'Yopish'}
              </button>
            </div>
          </div>

          {/* Section list */}
          <div className="px-8 pb-12">
            {loadingLines ? (
              <div className="text-center py-12" style={{ color: C.fade }}>
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                {t('loading') || 'Yuklanmoqda…'}
              </div>
            ) : !estimateId ? (
              <div className="text-center py-12" style={{ color: C.fade }}>
                {t('select_estimate_to_continue') || 'Davom etish uchun smetani tanlang'}
              </div>
            ) : sections.length === 0 ? (
              <div className="text-center py-12" style={{ color: C.fade }}>
                {t('no_lines_in_estimate') || 'Hech narsa topilmadi'}
              </div>
            ) : (
              sections.map((sec) => {
                const collapsed = !!collapsedSections[sec.name];
                return (
                  <div key={sec.name} className="mb-6">
                    <button
                      type="button"
                      onClick={() => toggleSection(sec.name)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg mb-2 transition"
                      style={{ background: C.sec, border: `1px solid ${C.border2}` }}
                    >
                      <ChevronDown
                        className="w-3.5 h-3.5 transition"
                        style={{
                          color: C.muted,
                          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
                        }}
                      />
                      <span className="flex-1 text-left font-semibold text-[13px] tracking-[0.02em]">{sec.name}</span>
                      <span
                        className="text-[11px] font-mono px-2 py-0.5 rounded"
                        style={{ background: C.inset, color: C.muted }}
                      >
                        {sec.lines.length} ish
                      </span>
                      <span className="text-[13px] font-mono font-semibold" style={{ color: C.amber }}>
                        {fmt(sec.total)} so'm
                      </span>
                    </button>

                    {!collapsed && sec.lines.map((ln) => {
                      const subs = subByParent.get(Number(ln.id)) || [];
                      const subStages = subs.filter(isSubStageRow);
                      return (
                        <React.Fragment key={ln.id}>
                          <WorkCard
                            line={ln}
                            subs={subs}
                            isOpen={openWorks.has(ln.id)}
                            onToggle={() => toggleWork(ln.id)}
                            qtyDraft={qtyDraft[ln.id]}
                            setQtyDraft={(v) => setQtyDraft((d) => ({ ...d, [ln.id]: v }))}
                            clearQtyDraft={() => setQtyDraft((d) => { const n = { ...d }; delete n[ln.id]; return n; })}
                            commitQty={commitQty}
                            resetQty={resetQty}
                            removeLine={removeLine}
                            openAddResource={openAddResource}
                            openAddStage={openAddStage}
                            t={t}
                            isSubStage={false}
                          />
                          {/* Sub-stage cards — rendered as their own cards
                             RIGHT AFTER their parent in the section list.
                             Each gets its own expand/collapse, qty input,
                             and resource breakdown. */}
                          {subStages.map((ss) => (
                            <WorkCard
                              key={ss.id}
                              line={ss}
                              subs={subByParent.get(Number(ss.id)) || []}
                              isOpen={openWorks.has(ss.id)}
                              onToggle={() => toggleWork(ss.id)}
                              qtyDraft={qtyDraft[ss.id]}
                              setQtyDraft={(v) => setQtyDraft((d) => ({ ...d, [ss.id]: v }))}
                              clearQtyDraft={() => setQtyDraft((d) => { const n = { ...d }; delete n[ss.id]; return n; })}
                              commitQty={commitQty}
                              resetQty={resetQty}
                              removeLine={removeLine}
                              openAddResource={openAddResource}
                              openAddStage={openAddStage}
                              t={t}
                              isSubStage
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* RESOURCES PAGE */}
      {page === 'resources' && (
        <div className="px-8 pt-6 pb-12">
          <ResourcesPanel
            project={project}
            // Intentionally NOT scoped to a single estimate — resources are
            // project-wide (one cement price for the project regardless of
            // which estimate uses it). User wants to see every resource in
            // the project, including those that only appear in Ресурс-type
            // estimates with a flat line structure.
            onResourceChanged={() => loadLines(estimateId)}
          />
        </div>
      )}

      {/* MODALS */}
      <AddResourcePickerModal
        open={addResOpen}
        onClose={() => { setAddResOpen(false); setAddTarget(null); }}
        projectId={project?.id}
        estimateId={Number(estimateId)}
        parent={addTarget}
        nextSeq={addTarget ? nextSeqFor(addTarget.id) : 1}
        onSaved={() => loadLines(estimateId)}
      />
      <AddSubWorkModal
        open={addStageOpen}
        onClose={() => { setAddStageOpen(false); setAddTarget(null); }}
        projectId={project?.id}
        estimateId={Number(estimateId)}
        parent={addTarget}
        nextSeq={addTarget ? nextSeqFor(addTarget.id) : 1}
        onSaved={() => loadLines(estimateId)}
      />

      <Dialog open={form2Open} onOpenChange={setForm2Open}>
        <DialogContent className="max-w-[1200px] w-[95vw] h-[95vh] p-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto bg-stone-100">
            <Form2Preview
              estimate={selectedEstimate}
              lines={lines}
              project={project}
              onClose={() => setForm2Open(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =====================================================================
// StatCard — replicates `.stat-card` / `.stat-grand` from the mockup.
// =====================================================================
function StatCard({ icon: Icon, variant, label, value, meta }) {
  const isGrand = variant === 'grand';
  const iconColor = {
    labor: { bg: C.amberSoft,                fg: C.amber },
    mach:  { bg: 'rgba(124,58,237,0.1)',     fg: C.purple },
    mat:   { bg: C.tealSoft,                 fg: C.teal },
    grand: { bg: C.tealSoft,                 fg: C.teal },
  }[variant];
  return (
    <div
      className="rounded-[10px] p-[18px] relative overflow-hidden"
      style={{
        background: isGrand ? `linear-gradient(135deg, ${C.sec}, ${C.card})` : C.card,
        border: isGrand ? `1px solid ${C.teal}` : `1px solid ${C.border}`,
      }}
    >
      {isGrand && (
        <div
          className="absolute"
          style={{
            top: -20, right: -20, width: 100, height: 100,
            background: 'radial-gradient(circle,rgba(13,148,136,0.15),transparent 70%)',
          }}
        />
      )}
      <div className="flex justify-between items-start mb-3.5 relative">
        <div
          className="w-[34px] h-[34px] rounded-lg flex items-center justify-center"
          style={{ background: iconColor.bg, color: iconColor.fg }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div
        className="text-[11px] mb-1.5 relative"
        style={{
          color: isGrand ? C.teal : C.muted,
          letterSpacing: isGrand ? '0.1em' : 'normal',
          textTransform: isGrand ? 'uppercase' : 'none',
          fontWeight: isGrand ? 600 : 400,
        }}
      >
        {label}
      </div>
      <div className="text-[20px] font-semibold mb-1 font-mono tabular-nums relative" style={{ color: C.text }}>
        {fmtShort(value)}
      </div>
      <div className="text-[10px] relative" style={{ color: C.fade }}>
        {meta || "so'm"}
      </div>
    </div>
  );
}

// =====================================================================
// WorkCard — reused for both top-level works AND sub-stages. The
// `isSubStage` flag toggles the teal-tinted styling, item-number color,
// "QO'SH." code label, and the available add buttons (sub-stages only
// get "Resurs qo'shish" — no nested stages allowed).
// =====================================================================
function WorkCard({
  line, subs, isOpen, onToggle,
  qtyDraft, setQtyDraft, clearQtyDraft, commitQty, resetQty, removeLine,
  openAddResource, openAddStage, t, isSubStage,
}) {
  const qty = Number(line.quantity) || 0;
  const isEmpty = qty <= 0;
  const draft = qtyDraft;
  const qtyValue = draft !== undefined ? draft : qty;
  const qtyChanged = draft !== undefined && Number(parseNum(draft)) !== qty;
  const origQty = Number(line.original_quantity || 0);
  const qtyModified = origQty > 0 && Math.abs(qty - origQty) > 0.0001;

  // Sub-stage cards never carry sub-stages of their own (we don't allow
  // nesting), so all subs of a sub-stage are resources.
  const subResources = (subs || []).filter((s) => !isSubStageRow(s));

  // Per-work category breakdown.
  const breakdown = subResources.reduce(
    (acc, s) => {
      const c = Number(s.unit_rate || 0) * Number(s.quantity || 0);
      const cat = classifyResource(s.resource_type);
      if (cat === 'labor') acc.labor += c;
      else if (cat === 'machines') acc.machines += c;
      else acc.materials += c;
      return acc;
    },
    { labor: 0, machines: 0, materials: 0 },
  );
  const breakdownTotal = breakdown.labor + breakdown.machines + breakdown.materials;
  const workTotal = breakdownTotal > 0 ? breakdownTotal : Number(line.total_amount) || 0;

  return (
    <div
      className="rounded-lg mb-1.5 overflow-hidden transition"
      style={{
        background: isSubStage
          ? `linear-gradient(90deg, rgba(13,148,136,0.04) 0%, ${C.card} 60%)`
          : C.card,
        border: `1px solid ${isEmpty && !isOpen ? C.amber : C.border}`,
        borderLeft: isSubStage
          ? `3px solid ${C.teal}`
          : isEmpty
          ? `3px solid ${C.amber}`
          : `1px solid ${C.border}`,
        marginLeft: isSubStage ? 32 : 0,
        opacity: isEmpty && !isOpen ? 0.7 : 1,
      }}
    >
      {/* Head row */}
      <div
        onClick={onToggle}
        className="px-4 py-3 grid items-center gap-3 cursor-pointer transition"
        style={{
          gridTemplateColumns: '32px 80px 1fr 100px 120px 140px 140px 32px',
          background: isSubStage ? 'rgba(13,148,136,0.02)' : 'transparent',
        }}
      >
        <div
          className="font-mono text-[11px]"
          style={{ color: isSubStage ? C.teal : C.fade, fontWeight: isSubStage ? 600 : 400 }}
        >
          {line.item_number || ''}
        </div>
        <div
          className="font-mono text-[11px] font-medium truncate"
          style={{ color: C.teal }}
          title={line.code || ''}
        >
          {isSubStage ? "QO'SH." : (line.code || '')}
        </div>
        <div
          className="text-[13px] font-medium leading-snug"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: C.text,
          }}
          title={line.name}
        >
          {line.name}
          {isSubStage && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
              style={{ background: 'rgba(13,148,136,0.15)', color: C.teal }}
            >
              {t('extra_short') || "Qo'shimcha"}
            </span>
          )}
        </div>
        <div className="text-[11px] text-center" style={{ color: C.dim }}>{line.uom || ''}</div>
        <div
          className="text-[12px] font-mono text-right tabular-nums"
          style={{
            color: isEmpty ? C.amber : (qtyModified ? C.teal : (isSubStage ? C.teal : C.text)),
            fontWeight: isEmpty || qtyModified || isSubStage ? 600 : 400,
          }}
        >
          {isEmpty ? '⚠ 0' : fmt(qty)}
        </div>
        <div className="text-[12px] font-mono text-right tabular-nums" style={{ color: C.dim }}>
          {subResources.length} resurs
          {!isSubStage && (subs || []).filter(isSubStageRow).length > 0 && (
            <span style={{ color: C.amber }}> +{(subs || []).filter(isSubStageRow).length} etap</span>
          )}
        </div>
        <div
          className="text-[13px] font-mono font-bold text-right tabular-nums"
          style={{ color: isEmpty ? C.fade : C.amber }}
        >
          {fmt(workTotal)}
        </div>
        <ChevronDown
          className="w-4 h-4 ml-auto transition"
          style={{ color: C.muted, transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </div>

      {/* Body */}
      {isOpen && (
        <div
          style={{
            background: C.bg,
            borderTop: `1px solid ${C.border}`,
            padding: '0 16px 14px 16px',
          }}
        >
          {/* Qty row + add buttons */}
          <div
            className="flex items-center gap-3 py-3 mb-3 flex-wrap"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <label
              className="text-[11px] uppercase tracking-[0.1em]"
              style={{ color: C.muted }}
            >
              {isSubStage ? (t('stage_qty') || 'Etap hajmi') : (t('work_qty') || 'Ish hajmi')}:
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={qtyValue ?? ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setQtyDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                if (qtyChanged) commitQty(line, e.target.value);
                clearQtyDraft();
              }}
              className={`px-3 py-2 rounded-[5px] text-[13px] font-mono text-right outline-none transition ${isEmpty ? 'smeta-empty-pulse' : ''}`}
              style={{
                background: isEmpty ? 'rgba(217,119,6,0.05)' : C.inset,
                color: isEmpty ? C.amber : (qtyChanged ? C.teal : C.text),
                border: `1px solid ${isEmpty ? C.amber : C.border2}`,
                width: 140,
                fontWeight: qtyChanged || isEmpty ? 600 : 400,
              }}
            />
            <span className="text-xs" style={{ color: C.muted }}>{line.uom || ''}</span>
            {qtyModified && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); resetQty(line); }}
                title={`${t('reset_qty_to_original') || 'Asl qiymatga qaytarish'}: ${fmt(origQty)}`}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center transition"
                style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.dim }}
              >
                <RotateCcw className="w-[13px] h-[13px]" />
              </button>
            )}
            <div className="flex-1" />
            {/* Top-level works get BOTH buttons. Sub-stages only get
                "Resurs qo'shish" — we don't support nested stages. */}
            {!isSubStage && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openAddStage(line); }}
                className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition"
                style={{
                  background: C.amberSoft,
                  color: C.amber,
                  border: '1px dashed rgba(217,119,6,0.3)',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                {t('new_stage') || "Yangi etap"}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openAddResource(line); }}
              className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition"
              style={{
                background: 'rgba(13,148,136,0.08)',
                color: C.teal,
                border: '1px dashed rgba(13,148,136,0.3)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubStage ? (t('add_resource') || "Resurs qo'shish") : (t('extra_resource_btn') || "Qo'shimcha resurs")}
            </button>
            {/* Sub-stages can be deleted from their own header. */}
            {isSubStage && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeLine(line); }}
                title={t('delete_stage') || "Etapni o'chirish"}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center transition"
                style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.red }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Resource table */}
          {subResources.length === 0 ? (
            <div className="py-4 text-center text-xs" style={{ color: C.fade }}>
              {t('no_resources_hint') || "Resurs yo'q. Yuqoridagi tugma orqali qo'shing."}
            </div>
          ) : (
            <>
              <table className="w-full border-collapse text-[12px] mt-3">
                <thead>
                  <tr>
                    {[
                      { l: 'Tur',         w: 60,  align: 'left' },
                      { l: 'Resurs nomi', w: null, align: 'left' },
                      { l: "O'lchov",     w: 70,  align: 'center' },
                      { l: 'Norma',       w: 90,  align: 'right' },
                      { l: 'Jami',        w: 100, align: 'right' },
                      { l: 'Narx',        w: 130, align: 'right', lock: true },
                      { l: 'Summa',       w: 130, align: 'right' },
                      { l: '',            w: 32,  align: 'left' },
                    ].map((h, i) => (
                      <th
                        key={i}
                        className="text-[10px] uppercase tracking-[0.1em] font-semibold py-2 px-2.5"
                        style={{
                          background: C.hover,
                          color: C.muted,
                          textAlign: h.align,
                          width: h.w || 'auto',
                        }}
                        title={h.lock ? "Narxni o'zgartirish uchun Resurslar tabiga o'ting" : undefined}
                      >
                        {h.l}
                        {h.lock && <span className="ml-1 text-[9px]" style={{ color: C.fade }}>🔒</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subResources.map((sub) => {
                    const cat = classifyResource(sub.resource_type);
                    const tag = CAT_COLOR[cat];
                    const price = Number(sub.unit_rate || 0);
                    const sq = Number(sub.quantity || 0);
                    const cost = price * sq;
                    return (
                      <tr key={sub.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td className="px-2.5 py-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                            style={{ background: tag.tagBg, color: tag.tagText }}
                          >
                            {CAT_LABEL[cat]}
                          </span>
                        </td>
                        <td className="px-2.5 py-2" style={{ color: C.text }}>
                          {sub.name}
                        </td>
                        <td className="px-2.5 py-2 text-center" style={{ color: C.dim }}>
                          {sub.uom || ''}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono tabular-nums" style={{ color: C.text }}>
                          {fmt(Number(sub.norm_rate || 0))}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono tabular-nums" style={{ color: C.dim }}>
                          {fmt(sq)}
                        </td>
                        <td
                          className="px-2.5 py-2 text-right font-mono tabular-nums"
                          style={{ color: C.text, fontWeight: 500 }}
                        >
                          {fmt(price)}
                        </td>
                        <td
                          className="px-2.5 py-2 text-right font-mono tabular-nums"
                          style={{ color: C.amber, fontWeight: 600 }}
                        >
                          {fmt(cost)}
                        </td>
                        <td className="px-2.5 py-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeLine(sub); }}
                            title={t('delete') || "O'chirish"}
                            className="w-7 h-7 rounded-[5px] flex items-center justify-center transition"
                            style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.red }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer */}
              <div className="flex justify-between items-center gap-5 pt-3 mt-1 text-[12px] flex-wrap">
                <div className="flex gap-5 flex-wrap">
                  <FooterItem label={t('footer_labor')   || 'Mehnat'}   value={breakdown.labor}    color={C.amber} />
                  <FooterItem label={t('footer_machine') || 'Mashina'}  value={breakdown.machines} color={C.purple} />
                  <FooterItem label={t('footer_material')|| 'Material'} value={breakdown.materials}color={C.teal} />
                </div>
                <div className="pl-5 flex items-center gap-2" style={{ borderLeft: `1px solid ${C.border2}` }}>
                  <span className="text-[11px]" style={{ color: C.muted }}>JAMI:</span>
                  <span className="font-mono font-semibold text-[15px]" style={{ color: C.amber }}>
                    {fmt(workTotal)} so'm
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FooterItem({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px]" style={{ color: C.muted }}>{label}:</span>
      <span className="font-mono font-semibold" style={{ color }}>{fmt(value)}</span>
    </div>
  );
}
