import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Loader2, Search, Users, Wrench, Package, FileText, RefreshCw,
  Plus, Trash2, ChevronDown, RotateCcw, ListChecks, Boxes, Grid3x3,
  History as HistoryIcon, Activity, Eye, Edit3, DollarSign,
  Tag, Save as SaveIcon, ToggleLeft, Percent, User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useAuth } from '@/components/contexts/AuthContext';
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

// Color tokens — light theme. Was switched back to the v23 dark mockup
// briefly, but the user wants the Smeta boshqaruvi tab to read like a
// printed-sheet (white background, slate text) so it integrates with
// the rest of the white app shell. All JSX consumes these tokens by
// name; flipping back to dark is one palette change away.
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
  // Compact Uzbek labels matching the v23 mockup. Comma decimal separator
  // matches the rest of the app's ru/uz number formatting (e.g. "18,5 mln").
  const ru = (x, digits) => x.toLocaleString('ru-RU', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
  const a = Math.abs(v);
  if (a >= 1e12) return ru(v / 1e12, 1) + ' trln';
  if (a >= 1e9)  return ru(v / 1e9, 1)  + ' mlrd';
  if (a >= 1e6)  return ru(v / 1e6, 1)  + ' mln';
  if (a >= 1e3)  return ru(v / 1e3, 0)  + ' ming';
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
  // Current user — drives the "Foydalanuvchi" pill in the topbar so the
  // foreman can see at a glance whose account is making edits (every
  // mutation is also persisted into construction_smeta_audit with this
  // user's id + name on the server side).
  const { user } = useAuth();
  const userDisplay = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || ''
    : '';

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

  // ── Tarix (snapshots) and Jurnal (audit log) state ────────────────
  // Both are loaded lazily — only when the user actually opens the tab —
  // so the Ishlar/Resurslar pages stay snappy.
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [snapshotPreview, setSnapshotPreview] = useState(null); // full payload from getForm2Snapshot
  const [auditEntries, setAuditEntries] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

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

  // ── Tarix / Jurnal loaders ───────────────────────────────────────
  // Both callbacks use empty deps + eslint-disable (same pattern as
  // loadLines above). `t` from useTranslation is a fresh function every
  // render, so depending on it would re-create these callbacks every
  // render — and because they're in the effect deps below, the effect
  // would re-fire each render, triggering an infinite request loop
  // (one request per render × ~30 renders/s before the rate-limiter
  // returned 429s).
  const loadSnapshots = useCallback(async (id) => {
    if (!id) { setSnapshots([]); return; }
    setLoadingSnapshots(true);
    try {
      const rows = await constructionService.listForm2Snapshots(id);
      setSnapshots(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      setSnapshots([]);
    } finally {
      setLoadingSnapshots(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAudit = useCallback(async (id, action) => {
    if (!id) { setAuditEntries([]); return; }
    setLoadingAudit(true);
    try {
      const rows = await constructionService.listSmetaAudit(id, { limit: 200, action: action || undefined });
      setAuditEntries(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      setAuditEntries([]);
    } finally {
      setLoadingAudit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazily refresh whenever the user opens Tarix or Jurnal.
  // Deps must NOT include loadSnapshots/loadAudit — they're stable
  // (empty-dep useCallback), and listing them would put us right back
  // in the infinite loop if the empty-dep guarantee ever drifts.
  useEffect(() => {
    if (page === 'history') loadSnapshots(estimateId);
    if (page === 'audit')   loadAudit(estimateId, auditFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, estimateId, auditFilter]);

  // Background prefetch of snapshot + audit counts so the inner-tab badges
  // ("Formalar tarixi 2", "O'zgarishlar jurnali 13" in v23) show real
  // numbers even before the user opens those tabs. One request each per
  // estimate change; cheap because both endpoints return small payloads.
  useEffect(() => {
    if (!estimateId) return;
    let cancelled = false;
    if (page !== 'history') {
      constructionService.listForm2Snapshots(estimateId)
        .then((rows) => { if (!cancelled) setSnapshots(Array.isArray(rows) ? rows : []); })
        .catch(() => {});
    }
    if (page !== 'audit') {
      constructionService.listSmetaAudit(estimateId, { limit: 200 })
        .then((rows) => { if (!cancelled) setAuditEntries(Array.isArray(rows) ? rows : []); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId]);

  // ── Snapshot save / delete ───────────────────────────────────────
  // Same loop hazard as loadSnapshots/loadAudit: depending on `t` (which
  // changes identity every render) would re-create these handlers each
  // render. They're passed down to memo'd children, so a new identity
  // would defeat the memoisation and trigger renders of those subtrees.
  const handleSaveSnapshot = useCallback(async (payload) => {
    if (!estimateId) return;
    try {
      await constructionService.createForm2Snapshot(estimateId, payload);
      toast.success(t('snapshot_saved') || 'Forma 2 saqlandi');
      // If the user is currently viewing the History tab refresh the list.
      if (page === 'history') loadSnapshots(estimateId);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, page]);

  const handleDeleteSnapshot = useCallback(async (snap) => {
    if (!snap?.id) return;
    if (!window.confirm(t('snapshot_delete_confirm') || 'Saqlangan Forma 2 ni o\'chirilsinmi?')) return;
    try {
      await constructionService.deleteForm2Snapshot(snap.id);
      toast.success(t('deleted') || 'O\'chirildi');
      loadSnapshots(estimateId);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId]);

  const handleViewSnapshot = useCallback(async (snap) => {
    if (!snap?.id) return;
    try {
      const full = await constructionService.getForm2Snapshot(snap.id);
      setSnapshotPreview(full);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Resource count for the inner-tab badge ("Resurslar 554" in v23).
  // Counts unique (name, uom) buckets across every resource line in this
  // estimate — the same grouping ResourcesPanel uses internally.
  const resourceCount = useMemo(() => {
    const buckets = new Set();
    for (const ln of lines) {
      const rt = String(ln.resource_type || '').trim();
      if (!rt) continue; // skip work rows / sub-stages
      const key = `${(ln.name || '').toLowerCase()}::${(ln.uom || '').toLowerCase()}`;
      buckets.add(key);
    }
    return buckets.size;
  }, [lines]);

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

  // Bulk-zero every work qty in the selected estimate. Confirmation
  // required because this is destructive (the only way back is per-line
  // reset-to-original or re-import). Cascades to non-override sub-lines
  // server-side; we just refetch when it returns.
  const resetAllQuantities = useCallback(async () => {
    if (!estimateId) return;
    const msg = t('reset_all_qty_confirm')
      || "Bu smetadagi barcha ish hajmlari 0 ga tushiriladi. Davom etamizmi?";
    // eslint-disable-next-line no-alert
    if (!window.confirm(msg)) return;
    try {
      const result = await constructionService.resetAllEstimateQuantities(estimateId);
      toast.success(`${t('reset_all_qty_done') || 'Hajmlar tushirildi'} · ${result?.works_zeroed || 0}`);
      loadLines(estimateId);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [estimateId, loadLines, t]);

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
  // Section accordion bulk-toggle ("Ochish" / "Yopish" in the mockup).
  // Distinct from work-card toggling — the section row is the dark
  // expandable strip that wraps a list of works.
  const expandSections  = () => setCollapsedSections({});
  const collapseSections = () => {
    const next = {};
    for (const sec of sections) next[sec.name] = true;
    setCollapsedSections(next);
  };
  // Work-card bulk-toggle ("Hammasini yoqish" / "Hammasini o'chirish"
  // in the mockup). Opens / closes every individual work card AND its
  // sub-stages so the user can see the whole tree at once.
  const expandAll = () => {
    const all = new Set();
    for (const sec of sections) {
      for (const ln of sec.lines) {
        all.add(ln.id);
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
            {t('lokal_resurs_smeta') || 'Lokal resurs smeta'}
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
          {/* Current user pill — matches the v23 mockup's
             "Foydalanuvchi: …" indicator. Read-only because every
             mutation is already attributed server-side via the JWT;
             the pill is purely informational so the foreman knows
             which account is leaving an audit trail. Falls back to
             "— kiriting —" when not signed in (matches mockup copy). */}
          <div
            className="px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5"
            style={{
              background: C.inset,
              color: userDisplay ? C.text : C.muted,
              border: `1px solid ${C.border2}`,
            }}
            title={user?.email || ''}
          >
            <UserIcon className="w-3 h-3" style={{ color: C.muted }} />
            <span style={{ color: C.muted }}>{t('user_label') || 'Foydalanuvchi'}:</span>
            <span style={{ fontWeight: 500 }}>
              {userDisplay || (t('user_not_signed_in') || '— kiriting —')}
            </span>
          </div>
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
          { key: 'works',     icon: ListChecks,  label: t('inner_tab_works')     || 'Ishlar',              count: kpis.total },
          { key: 'resources', icon: Boxes,       label: t('inner_tab_resources') || 'Resurslar',           count: resourceCount },
          { key: 'history',   icon: HistoryIcon, label: t('inner_tab_history')   || 'Formalar tarixi',     count: snapshots.length },
          { key: 'audit',     icon: Activity,    label: t('inner_tab_audit')     || "O'zgarishlar jurnali", count: auditEntries.length },
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
              {(tab.count !== null && tab.count !== undefined) && (
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
              {/* Section accordion toggle — opens/closes the dark section
                 strips themselves. Distinct from the work-card bulk
                 buttons next to it. */}
              <button
                onClick={expandSections}
                disabled={sections.length === 0}
                className="px-3.5 py-2 rounded-md text-xs transition disabled:opacity-50"
                style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border2}` }}
              >
                {t('expand_all') || 'Ochish'}
              </button>
              <button
                onClick={collapseSections}
                disabled={sections.length === 0}
                className="px-3.5 py-2 rounded-md text-xs transition disabled:opacity-50"
                style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border2}` }}
              >
                {t('collapse_all') || 'Yopish'}
              </button>
              {/* Bulk-toggle every work card (and every sub-stage card) at
                 once. Mockup colours: green for "all on", red for "all off". */}
              <button
                onClick={expandAll}
                disabled={sections.length === 0}
                className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                style={{
                  background: 'rgba(13,148,136,0.1)', color: C.teal,
                  border: '1px solid rgba(13,148,136,0.4)',
                }}
                title={t('expand_all_works_hint') || 'Barcha ish kartalarini ochish'}
              >
                <span>✓</span>
                {t('expand_all_works') || "Hammasini yoqish"}
              </button>
              <button
                onClick={collapseAll}
                disabled={sections.length === 0}
                className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                style={{
                  background: 'rgba(220,38,38,0.08)', color: C.red,
                  border: '1px solid rgba(220,38,38,0.3)',
                }}
                title={t('collapse_all_works_hint') || 'Barcha ish kartalarini yopish'}
              >
                <span>×</span>
                {t('collapse_all_works') || "Hammasini o'chirish"}
              </button>
              {/* Reset all qty — destructive, hence the amber-tinted style.
                 Disabled when no estimate is selected. Confirms before firing. */}
              <button
                onClick={resetAllQuantities}
                disabled={!estimateId || loadingLines}
                className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                style={{ background: 'transparent', color: C.amber, border: `1px solid ${C.amber}` }}
                title={t('reset_all_qty') || "Barcha hajmlarni tushirish"}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('reset_all_qty') || "Hajmlarni tushirish"}
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

      {/* HISTORY (Tarix) PAGE — saved Forma 2 documents */}
      {page === 'history' && (
        <div className="px-8 pt-6 pb-12">
          <HistoryPage
            t={t}
            loading={loadingSnapshots}
            snapshots={snapshots}
            onView={handleViewSnapshot}
            onDelete={handleDeleteSnapshot}
            onRefresh={() => loadSnapshots(estimateId)}
            onSaveCurrent={() => setForm2Open(true)}
          />
        </div>
      )}

      {/* AUDIT (Jurnal) PAGE — chronological log of every mutation */}
      {page === 'audit' && (
        <div className="px-8 pt-6 pb-12">
          <AuditPage
            t={t}
            loading={loadingAudit}
            entries={auditEntries}
            filter={auditFilter}
            onFilterChange={(v) => setAuditFilter(v)}
            onRefresh={() => loadAudit(estimateId, auditFilter)}
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
              onSaveSnapshot={handleSaveSnapshot}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Snapshot preview — read-only Forma 2 rebuilt from the saved
          snapshot_data payload. We hand the saved lines to Form2Preview so
          the same renderer is reused; period/pct/vat are loaded from the
          snapshot's saved fields. */}
      <Dialog open={!!snapshotPreview} onOpenChange={(o) => { if (!o) setSnapshotPreview(null); }}>
        <DialogContent className="max-w-[1200px] w-[95vw] h-[95vh] p-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto bg-stone-100">
            {snapshotPreview && (
              <Form2Preview
                estimate={selectedEstimate}
                lines={(() => {
                  try {
                    const d = typeof snapshotPreview.snapshot_data === 'string'
                      ? JSON.parse(snapshotPreview.snapshot_data)
                      : snapshotPreview.snapshot_data;
                    return Array.isArray(d?.lines) && d.lines.length > 0 ? d.lines : (lines || []);
                  } catch { return lines || []; }
                })()}
                project={project}
                onClose={() => setSnapshotPreview(null)}
              />
            )}
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

// =====================================================================
// HistoryPage — Tarix tab. Lists every saved Forma 2 snapshot for the
// selected estimate. Each row has Ko'rish + O'chirish, plus a header
// "Yangisi" button that opens the live Forma 2 dialog (which has its own
// Saqlash button). The list endpoint omits the heavy snapshot_data blob;
// when the user clicks Ko'rish we fetch the full row and render it via
// Form2Preview in read-only mode.
// =====================================================================
function HistoryPage({ t, loading, snapshots, onView, onDelete, onRefresh, onSaveCurrent }) {
  const fmtDate = (s) => {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch { return s; }
  };
  const fmtPeriod = (a, b) => {
    if (!a && !b) return '—';
    const fmtD = (s) => s ? new Date(s).toLocaleDateString('ru-RU') : '—';
    return `${fmtD(a)} — ${fmtD(b)}`;
  };
  return (
    <div>
      <div className="rounded-[10px] p-3 flex items-center gap-2 mb-3"
           style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="text-[13px] font-semibold flex-1" style={{ color: C.text }}>
          {t('history_saved_form2') || "Saqlangan Forma 2 hujjatlari"}
        </h3>
        <button
          onClick={onRefresh}
          className="text-[12px] px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
          style={{ background: C.inset, border: `1px solid ${C.border2}`, color: C.dim }}
        >
          <RefreshCw className="w-3 h-3" />
          {t('refresh') || 'Yangilash'}
        </button>
        <button
          onClick={onSaveCurrent}
          className="text-[12px] px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
          style={{ background: C.teal, color: '#fff' }}
        >
          <SaveIcon className="w-3 h-3" />
          {t('history_save_current') || 'Joriy holatdan saqlash'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12" style={{ color: C.muted }}>
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('loading') || 'Yuklanmoqda...'}
        </div>
      ) : snapshots.length === 0 ? (
        <div className="rounded-[10px] py-12 text-center" style={{ background: C.card, border: `1px dashed ${C.border2}`, color: C.muted }}>
          <HistoryIcon className="w-6 h-6 mx-auto mb-2" />
          <div className="text-[13px]">{t('history_empty') || "Hali bironta saqlangan Forma 2 yo'q"}</div>
          <div className="text-[11px] mt-1">{t('history_empty_hint') || "Forma 2 ni oching va o'ng yuqoridagi 'Saqlash' tugmasini bosing"}</div>
        </div>
      ) : (
        <div className="rounded-[10px] overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.sec, borderBottom: `1px solid ${C.border}` }}>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted }}>{t('history_col_saved') || 'Sana'}</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted }}>{t('history_col_act') || 'Akt №'}</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted }}>{t('history_col_period') || 'Davr'}</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: C.muted }}>{t('history_col_total') || 'Jami'}</th>
                <th className="px-3 py-2 text-center font-medium" style={{ color: C.muted }}>{t('history_col_vat') || 'НДС'}</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted }}>{t('history_col_user') || 'Kim'}</th>
                <th className="px-3 py-2" style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="px-3 py-2 font-mono" style={{ color: C.text }}>{fmtDate(s.created_at)}</td>
                  <td className="px-3 py-2" style={{ color: C.dim }}>{s.act_number || '—'}</td>
                  <td className="px-3 py-2" style={{ color: C.dim }}>{fmtPeriod(s.period_from, s.period_to)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: C.amber }}>
                    {fmt(Number(s.use_vat ? s.total_with_vat : s.total_without_vat) || 0)}
                  </td>
                  <td className="px-3 py-2 text-center" style={{ color: s.use_vat ? C.teal : C.muted }}>
                    {s.use_vat ? '✓' : '—'}
                  </td>
                  <td className="px-3 py-2" style={{ color: C.dim }}>{s.created_by_name || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => onView(s)}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center"
                        title={t('view') || "Ko'rish"}
                        style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.teal }}
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDelete(s)}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center"
                        title={t('delete') || "O'chirish"}
                        style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.red }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// AuditPage — Jurnal tab. Newest-first audit log of every mutation done
// from the Smeta boshqaruvi UI. Each row has an action icon, target name,
// from/to values, free-form description, who did it and when. The header
// includes a filter dropdown that re-queries the backend with ?action=.
// =====================================================================
const AUDIT_ACTION_META = {
  qty_change:      { color: '#0D9488', icon: Edit3,        label_uz: 'Hajm',         label_ru: 'Объём' },
  price_change:    { color: '#D97706', icon: DollarSign,   label_uz: 'Narx',         label_ru: 'Цена' },
  mat_type:        { color: '#7C3AED', icon: Tag,          label_uz: 'Material',     label_ru: 'Тип материала' },
  subwork_add:     { color: '#16A34A', icon: Plus,         label_uz: 'Yangi etap',   label_ru: 'Новый этап' },
  subwork_del:     { color: '#DC2626', icon: Trash2,       label_uz: "Etap o'chdi",  label_ru: 'Этап удалён' },
  res_add:         { color: '#0D9488', icon: Plus,         label_uz: 'Resurs +',     label_ru: 'Ресурс +' },
  res_del:         { color: '#DC2626', icon: Trash2,       label_uz: "Resurs o'chdi",label_ru: 'Ресурс удалён' },
  reset_qty:       { color: '#475569', icon: RotateCcw,    label_uz: 'Hajm reset',   label_ru: 'Сброс объёма' },
  reset_qty_all:   { color: '#475569', icon: RotateCcw,    label_uz: 'Barcha hajm',  label_ru: 'Сброс всех объёмов' },
  reset_price:     { color: '#475569', icon: RotateCcw,    label_uz: 'Narx reset',   label_ru: 'Сброс цены' },
  reset_price_all: { color: '#475569', icon: RotateCcw,    label_uz: 'Barcha narx',  label_ru: 'Сброс всех цен' },
  form_save:       { color: '#0D9488', icon: SaveIcon,     label_uz: 'Forma 2',      label_ru: 'Сохр. Форма 2' },
  form_delete:     { color: '#DC2626', icon: Trash2,       label_uz: 'Forma 2 ←',    label_ru: 'Удал. Форма 2' },
  other_pct:       { color: '#7C3AED', icon: Percent,      label_uz: 'Прочие %',     label_ru: 'Прочие %' },
  use_vat:         { color: '#7C3AED', icon: ToggleLeft,   label_uz: 'НДС',          label_ru: 'НДС' },
};

function AuditPage({ t, loading, entries, filter, onFilterChange, onRefresh }) {
  const fmtDate = (s) => {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch { return s; }
  };
  return (
    <div>
      <div className="rounded-[10px] p-3 flex items-center gap-2 mb-3"
           style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="text-[13px] font-semibold flex-1" style={{ color: C.text }}>
          {t('audit_log_title') || "O'zgarishlar jurnali"}
        </h3>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-[12px] px-2.5 py-1.5 rounded-[6px]"
          style={{ background: C.inset, border: `1px solid ${C.border2}`, color: C.text, minWidth: 180 }}
        >
          <option value="">{t('audit_filter_all') || 'Barchasi'}</option>
          {Object.entries(AUDIT_ACTION_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label_uz}</option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          className="text-[12px] px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
          style={{ background: C.inset, border: `1px solid ${C.border2}`, color: C.dim }}
        >
          <RefreshCw className="w-3 h-3" />
          {t('refresh') || 'Yangilash'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12" style={{ color: C.muted }}>
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('loading') || 'Yuklanmoqda...'}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[10px] py-12 text-center" style={{ background: C.card, border: `1px dashed ${C.border2}`, color: C.muted }}>
          <Activity className="w-6 h-6 mx-auto mb-2" />
          <div className="text-[13px]">{t('audit_empty') || "Hech qanday o'zgarish yozib olinmagan"}</div>
        </div>
      ) : (
        <div className="rounded-[10px] overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.sec, borderBottom: `1px solid ${C.border}` }}>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted, width: 150 }}>{t('audit_col_when') || 'Vaqt'}</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted, width: 150 }}>{t('audit_col_action') || 'Harakat'}</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted }}>{t('audit_col_target') || "Ob'ekt"}</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted, width: 200 }}>{t('audit_col_change') || "O'zgarish"}</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted, width: 140 }}>{t('audit_col_user') || 'Kim'}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta = AUDIT_ACTION_META[e.action] || { color: C.muted, icon: Activity, label_uz: e.action };
                const Icon = meta.icon;
                return (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="px-3 py-2 font-mono" style={{ color: C.dim }}>{fmtDate(e.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-[4px] flex items-center justify-center"
                          style={{ background: `${meta.color}1a`, color: meta.color }}
                        >
                          <Icon className="w-3 h-3" />
                        </span>
                        <span className="text-[12px]" style={{ color: meta.color, fontWeight: 500 }}>{meta.label_uz}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2" style={{ color: C.text }}>
                      {e.target || '—'}
                      {e.description && (
                        <div className="text-[11px]" style={{ color: C.muted }}>{e.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono" style={{ color: C.dim }}>
                      {e.from_value || e.to_value
                        ? <>
                            {e.from_value && <span style={{ color: C.muted }}>{e.from_value}</span>}
                            {e.from_value && e.to_value && <span style={{ color: C.fade }}> → </span>}
                            {e.to_value && <span style={{ color: C.text, fontWeight: 600 }}>{e.to_value}</span>}
                          </>
                        : '—'}
                    </td>
                    <td className="px-3 py-2" style={{ color: C.dim }}>{e.user_name || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
