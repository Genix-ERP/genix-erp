import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Loader from '@/components/ui/loader';
import {
  Loader2, Search, Users, Wrench, Package, FileText, RefreshCw,
  Plus, Trash2, ChevronDown, RotateCcw, ListChecks, Boxes, Grid3x3,
  History as HistoryIcon, Activity, Eye, Edit3, DollarSign,
  Tag, Save as SaveIcon, ToggleLeft, Percent, User as UserIcon, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useAuth } from '@/components/contexts/AuthContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { formatApiError } from '@/utils/apiErrors';
import Form2Preview from '@/components/construction/Form2Preview';
import MaterialConsolidationModal from '@/components/construction/MaterialConsolidationModal';
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

// Up to 6 fractional digits with trailing zeros dropped. Imports often
// carry small per-unit norms like 0.758 or quantities like 0.0125, and
// truncating them to 2 decimals (the old behaviour) silently widened
// estimates by tens of thousands of soums on multi-million-row totals.
// Monetary values that already sit on integer or kopek precision look
// identical (1 234 567,89 stays as 1 234 567,89) — only sub-kopek detail
// becomes visible.
const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 })
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
  const { user, isSiteAdmin, isOwner } = useAuth();
  const userDisplay = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || ''
    : '';
  // Bulk toolbar buttons that can wipe a lot of state with one click
  // ("Yopish" = close all sections, "Hammasini o'chirish" = collapse all
  // work cards, "Hajmlarni tushirish" = zero every quantity in the
  // smeta) are gated to system admins / tenant owners. Regular users
  // can still open / close individual sections + cards by clicking
  // their headers — only the bulk shortcuts go away.
  const canBulkAdmin = isSiteAdmin?.() || isOwner?.();

  const [estimates, setEstimates] = useState([]);
  // Block-level selector. Each option in the dropdown represents a building
  // ("blok"). Behind the scenes we resolve the block to ALL of its Единич
  // estimates and load their lines concatenated — so when a block has
  // several Единич smetas (re-imports / period-based smetas) the user sees
  // the works back-to-back in one list. We only consider Единич here and
  // skip ВОР entirely (per product feedback "we don't need BOP").
  //
  // estimateId is the PRIMARY edinich estimate of the selected block —
  // used for things that need a single concrete id (Form 2 generation,
  // snapshots, audit log filter, "+resurs" modal). It's whichever Единич
  // for the block has the highest id (latest import).
  // Block selection persists across tab navigation (Smeta boshqaruvi
  // remounts every time the user comes back from another tab, so a
  // plain `useState('')` would reset to the first block on every
  // return). We stash the selection in localStorage, scoped per
  // project id so different projects keep their own last-block. The
  // value is hydrated lazily on first render and re-written below
  // whenever the user picks a new block.
  const blockStorageKey = project?.id ? `smeta:lastBlockId:${project.id}` : '';
  const [buildingId, setBuildingIdRaw] = useState(() => {
    if (!blockStorageKey) return '';
    try { return window.localStorage.getItem(blockStorageKey) || ''; }
    catch { return ''; }
  });
  const setBuildingId = useCallback((next) => {
    setBuildingIdRaw(next);
    if (blockStorageKey) {
      try {
        if (next == null || next === '') window.localStorage.removeItem(blockStorageKey);
        else window.localStorage.setItem(blockStorageKey, String(next));
      } catch { /* localStorage may be unavailable (private mode); ignore. */ }
    }
  }, [blockStorageKey]);
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

  // Resource top-up modal (migration 358). Foreman ordered MORE of a
  // resource than the smeta planned, often at a different price. The
  // shortfall + new price is recorded as a separate row so the
  // original smeta plan stays immutable for audit.
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupTarget, setTopupTarget] = useState(null);

  const [form2Open, setForm2Open] = useState(false);
  // Material consolidation modal — toggled by the "Material yig'indisi"
  // button in the topbar next to "Forma 2 ni yaratish".
  const [matConsOpen, setMatConsOpen] = useState(false);
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

  // Generic confirmation modal — replaces window.confirm() calls for
  // destructive bulk actions (Hammasini yoqish / Hammasini o'chirish /
  // Hajmlarni tushirish / line-delete) so the prompt matches the rest of
  // the app's styling and runs through translations. Shape:
  //   { title, body, confirmLabel, tone: 'amber'|'red'|'teal', onConfirm }
  const [confirmModal, setConfirmModal] = useState(null);

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
      })
      .catch((e) => { if (!cancelled) toast.error(formatApiError(e, t, 'Xatolik')); })
      .finally(() => { if (!cancelled) setLoadingEstimates(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // ── Block options (one option per building, Единич only) ──────────
  // Group estimates by building_id. Within each block, keep only Единич
  // smetas — that's what this tab is built around. ВОР is excluded
  // entirely; Ресурс still feeds prices via the backend propagation step
  // but doesn't show in the block selector.
  //
  // IMPORTANT: this useMemo MUST NOT depend on `t` — useTranslation
  // returns a fresh `t` function reference on every render, so including
  // it in the deps list would re-create blockOptions on every render,
  // which cascades through activeBlock → activeEstimateIds → the
  // loadLines useEffect → an infinite request loop. We use a static
  // English fallback name here; the dropdown re-resolves the localized
  // label at render time below if needed.
  const blockOptions = useMemo(() => {
    const buckets = new Map(); // key = building_id (or '0'), value = { name, edinich: [] }
    for (const e of estimates) {
      const st = String(e.source_type || '').toLowerCase();
      if (st !== 'edinich') continue;
      const bid = e.building_id ? String(e.building_id) : '0';
      const bname = e.building_name || (bid === '0' ? 'Butun loyiha' : `#${bid}`);
      if (!buckets.has(bid)) buckets.set(bid, { id: bid, name: bname, edinich: [] });
      buckets.get(bid).edinich.push(e);
    }
    // Sort each block's edinich estimates by id DESC so [0] is the latest.
    const opts = Array.from(buckets.values()).map((b) => ({
      ...b,
      edinich: [...b.edinich].sort((a, c) => Number(c.id) - Number(a.id)),
    }));
    // Sort blocks by name for stable display order.
    opts.sort((a, c) => String(a.name).localeCompare(String(c.name)));
    return opts;
  }, [estimates]);

  // Pick a default block when the list first loads. If localStorage
  // gave us an id that's no longer in the available block list (e.g.
  // the block was deleted, or the user is hopping between projects
  // with the same key), fall back to the first option so the page
  // doesn't show an empty selection.
  useEffect(() => {
    if (blockOptions.length === 0) return;
    const exists = blockOptions.some((b) => String(b.id) === String(buildingId));
    if (!buildingId || !exists) {
      setBuildingId(blockOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockOptions, buildingId]);

  // Resolve buildingId → primary estimateId (latest едиinич of that block)
  // + the full id-list to load lines from.
  const activeBlock = useMemo(
    () => blockOptions.find((b) => String(b.id) === String(buildingId)) || null,
    [blockOptions, buildingId],
  );
  const activeEstimateIds = useMemo(
    () => (activeBlock ? activeBlock.edinich.map((e) => Number(e.id)) : []),
    [activeBlock],
  );
  // Sync estimateId to the latest едиinич of the selected block. This is
  // what the mutation handlers / Form 2 / audit / "+resurs" modal use as
  // a concrete single-estimate target.
  useEffect(() => {
    if (activeEstimateIds.length > 0) {
      setEstimateId(String(activeEstimateIds[0]));
    } else {
      setEstimateId('');
    }
  }, [activeEstimateIds]);

  // ── Load lines (concatenated across all едиinich smetas of block) ──
  // The list endpoint is per-estimate, so we fan out and concat. Each
  // line carries its own .estimate_id which mutations key off, so we
  // don't lose track of where any individual row belongs.
  const loadLines = useCallback(async (ids) => {
    const idList = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    if (idList.length === 0) { setLines([]); return; }
    setLoadingLines(true);
    try {
      const all = [];
      for (const id of idList) {
        const rows = await constructionService.listEstimateLines(id, { page_size: 5000 });
        const arr = Array.isArray(rows) ? rows : (rows?.data || rows?.items || []);
        all.push(...arr);
      }
      setLines(all);
      setQtyDraft({});
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      setLines([]);
    } finally {
      setLoadingLines(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { loadLines(activeEstimateIds); }, [activeEstimateIds, loadLines]);

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
    // Per-parent effective cost = Σ resource cost across its sub-lines,
    // where each sub-line follows the same plan-vs-topup rule used in
    // WorkCard.resourceCost: top-ups replace the planned cost ONLY when
    // their total quantity covers the resource quantity. A partial
    // top-up (Σ tp.qty < line.quantity) leaves the planned cost in
    // place. When a parent has no resource breakdown at all, fall
    // back to its own total_amount.
    const effByParent = new Map();
    for (const ln of lines) {
      const pid = Number(ln.parent_line_id || 0);
      if (!pid) continue;
      const tps = Array.isArray(ln.topups) ? ln.topups : [];
      const lnQty = Number(ln.quantity || 0);
      let c;
      if (tps.length > 0) {
        const tpQty = tps.reduce((m, tp) => m + (Number(tp.extra_quantity) || 0), 0);
        if (tpQty >= lnQty) {
          c = tps.reduce(
            (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
            0,
          );
        } else {
          c = Number(ln.unit_rate || 0) * lnQty;
        }
      } else {
        c = Number(ln.unit_rate || 0) * lnQty;
      }
      if (!c) continue;
      effByParent.set(pid, (effByParent.get(pid) || 0) + c);
    }

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
      const eff = effByParent.get(Number(ln.id));
      cur.total += eff != null ? eff : (Number(ln.total_amount) || 0);
      sectionMap.set(secKey, cur);
    }
    return Array.from(sectionMap.values());
  }, [lines, search, sectionFilter, t]);

  // ── Mutations ─────────────────────────────────────────────────────
  // Each line carries its own line.estimate_id, so we route mutations
  // there rather than to the state's `estimateId`. That way edits work
  // even when a block has multiple Единич smetas and the user is editing
  // a row that belongs to one of the older versions in the concatenated
  // list. We fall back to estimateId when line.estimate_id is missing.
  const lineEst = (line) => Number(line.estimate_id || estimateId || 0);

  const commitQty = useCallback(async (line, raw) => {
    const newQty = parseNum(raw);
    if (Math.abs(newQty - Number(line.quantity || 0)) < 0.0001) return;
    try {
      await constructionService.updateEstimateLine(lineEst(line), line.id, { quantity: newQty });
      // Optimistic local patch — the backend now also mirrors
      // quantity → done_quantity for parent works (so Bosqichlar's
      // BAJARILDI matches what the user just typed here) and cascades
      // non-override sub-line quantities to parent.qty × norm_rate.
      // Patch all three locally for snappier UX; loadLines below
      // pulls the authoritative state.
      const isParent = !line.parent_line_id;
      const parentId = Number(line.id);
      setLines((rows) => rows.map((r) => {
        if (r.id === line.id) {
          return {
            ...r,
            quantity: newQty,
            total_amount: Number(r.unit_rate || 0) * newQty,
            ...(isParent ? {
              done_quantity: newQty,
              approval_status:
                ['confirmed_supervisor', 'confirmed_engineer', 'submitted'].includes(r.approval_status)
                  ? r.approval_status
                  : (newQty > 0 ? 'in_progress' : 'pending'),
            } : {}),
          };
        }
        if (isParent && Number(r.parent_line_id) === parentId && !r.quantity_override) {
          const norm = Number(r.norm_rate || 0);
          const childQty = newQty * norm;
          return {
            ...r,
            quantity: childQty,
            total_amount: childQty * Number(r.unit_rate || 0),
          };
        }
        return r;
      }));
      toast.success(t('saved') || 'Saqlandi');
      // Pull authoritative state for cascading qty changes.
      loadLines(activeEstimateIds);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      loadLines(activeEstimateIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, activeEstimateIds, loadLines, t]);

  const resetQty = useCallback(async (line) => {
    try {
      await constructionService.resetLineQuantity(lineEst(line), line.id);
      toast.success(t('reset_qty_done') || "Hajm asl qiymatga qaytarildi");
      loadLines(activeEstimateIds);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, activeEstimateIds, loadLines, t]);

  const removeLine = useCallback(async (line) => {
    if (!window.confirm(t('confirm_delete_subline') || "O'chirishni tasdiqlaysizmi?")) return;
    try {
      await constructionService.deleteEstimateLine(lineEst(line), line.id);
      setLines((rows) => rows.filter((r) => r.id !== line.id && Number(r.parent_line_id) !== Number(line.id)));
      toast.success(t('deleted') || "O'chirildi");
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, t]);

  // Bulk-zero every work qty across every Единич smeta of the selected
  // block. Confirmation required because this is destructive. Cascades
  // to non-override sub-lines server-side; we refetch when it returns.
  const resetAllQuantities = useCallback(() => {
    if (activeEstimateIds.length === 0) return;
    setConfirmModal({
      tone: 'amber',
      title: t('reset_all_qty') || "Hajmlarni tushirish",
      body: t('reset_all_qty_confirm')
        || "Bu smetadagi barcha ish hajmlari 0 ga tushiriladi. Davom etamizmi?",
      confirmLabel: t('reset_all_qty') || "Hajmlarni tushirish",
      onConfirm: async () => {
        try {
          let totalZeroed = 0;
          for (const id of activeEstimateIds) {
            const result = await constructionService.resetAllEstimateQuantities(id);
            totalZeroed += Number(result?.works_zeroed || 0);
          }
          toast.success(`${t('reset_all_qty_done') || 'Hajmlar tushirildi'} · ${totalZeroed}`);
          loadLines(activeEstimateIds);
        } catch (e) {
          toast.error(formatApiError(e, t, 'Xatolik'));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEstimateIds, loadLines, t]);

  // ── Add-flow handlers — open the right modal with the right parent ─
  const openAddStage = (work) => { setAddTarget(work); setAddStageOpen(true); };
  const openAddResource = (parentRow) => { setAddTarget(parentRow); setAddResOpen(true); };

  // Resource top-up (migration 358). The "+" button next to delete on
  // each resource sub-row opens this modal so the foreman can record
  // an additional purchase at a (possibly different) price without
  // touching the original smeta plan.
  const openTopup = (resourceLine) => {
    setTopupTarget(resourceLine);
    setTopupOpen(true);
  };
  const submitTopup = useCallback(async (payload) => {
    if (!topupTarget) return;
    const eid = lineEst(topupTarget);
    if (!eid) {
      toast.error(t('error') || 'Xatolik');
      return;
    }
    try {
      const created = await constructionService.createResourceTopup(
        eid, topupTarget.id, payload,
      );
      // Append the new top-up to the in-memory line so the UI updates
      // without a full reload.
      setLines((rows) => rows.map((r) => {
        if (r.id !== topupTarget.id) return r;
        const list = Array.isArray(r.topups) ? r.topups.slice() : [];
        list.push(created);
        return { ...r, topups: list };
      }));
      setTopupOpen(false);
      setTopupTarget(null);
      toast.success(t('saved') || 'Saqlandi');
      // Refresh totals so the section subtotal + estimate amount_total
      // reflect the new top-up immediately.
      loadLines(activeEstimateIds);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topupTarget, activeEstimateIds, loadLines, t]);
  const removeTopup = useCallback(async (resourceLine, topup) => {
    const eid = lineEst(resourceLine);
    if (!eid) return;
    try {
      await constructionService.deleteResourceTopup(eid, resourceLine.id, topup.id);
      setLines((rows) => rows.map((r) => {
        if (r.id !== resourceLine.id) return r;
        const list = (r.topups || []).filter((tp) => tp.id !== topup.id);
        return { ...r, topups: list };
      }));
      toast.success(t('deleted') || "O'chirildi");
      loadLines(activeEstimateIds);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEstimateIds, loadLines, t]);
  // nextSeqFor returns the next sequence number to use when composing a
  // new sub-stage's item_number ("13-1", "13-2", …). It must count ONLY
  // existing sub-stages — not the resource children (Mehnat/Mashina/
  // Material) that also live under the same parent_line_id. Counting all
  // children was the cause of "added etap got numbered 13-4 instead of
  // 13-1": work #13 had 3 resources, so MAX(subline_seq)+1 = 4.
  const nextSeqFor = (parentId) => {
    if (!parentId) return 1;
    const subStages = lines.filter(
      (r) => Number(r.parent_line_id) === Number(parentId) && isSubStageRow(r),
    );
    return subStages.length + 1;
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
  // sub-stages so the user can see the whole tree at once. Wrapped in
  // confirm modals so the user doesn't accidentally fan out / fold up
  // a long estimate after a stray click — same UX pattern as the other
  // bulk actions on this toolbar.
  const doExpandAll = () => {
    const all = new Set();
    for (const sec of sections) {
      for (const ln of sec.lines) {
        all.add(ln.id);
        for (const ss of (subByParent.get(Number(ln.id)) || []).filter(isSubStageRow)) all.add(ss.id);
      }
    }
    setOpenWorks(all);
  };
  const doCollapseAll = () => setOpenWorks(new Set());
  const expandAll = () => {
    if (sections.length === 0) return;
    setConfirmModal({
      tone: 'teal',
      title: t('expand_all_works') || "Hammasini yoqish",
      body: t('expand_all_works_confirm')
        || "Barcha ish kartalari va kichik etaplari ochiladi. Davom etamizmi?",
      confirmLabel: t('expand_all_works') || "Hammasini yoqish",
      onConfirm: doExpandAll,
    });
  };
  const collapseAll = () => {
    if (sections.length === 0) return;
    setConfirmModal({
      tone: 'red',
      title: t('collapse_all_works') || "Hammasini o'chirish",
      body: t('collapse_all_works_confirm')
        || "Barcha ish kartalari yopiladi. Davom etamizmi?",
      confirmLabel: t('collapse_all_works') || "Hammasini o'chirish",
      onConfirm: doCollapseAll,
    });
  };

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
            {t('production') || 'Ishlab chiqarish'} · {t('form2_breadcrumb') || 'Форма 2'} · {t('source_type_vor') || 'ВОР'}
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
          {/* Block selector — one option per building. Each option resolves
             to all Единич smetas of that block; their lines are loaded
             concatenated so when a block has several Единич imports the
             user sees the works back-to-back. ВОР is excluded entirely
             ("we don't need BOP" per product feedback); Ресурс stays in
             the database as the source of resource prices but doesn't
             show up in the selector. */}
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            disabled={loadingEstimates || blockOptions.length === 0}
            className="px-3 py-2 rounded-md text-xs outline-none cursor-pointer"
            style={{ background: C.inset, color: C.text, border: `1px solid ${C.border2}`, fontFamily: 'inherit', minWidth: 200 }}
          >
            {loadingEstimates && <option value="">…</option>}
            {!loadingEstimates && blockOptions.length === 0 && <option value="">{t('no_estimates') || "Smeta yo'q"}</option>}
            {blockOptions.map((b) => (
              <option key={b.id} value={b.id} style={{ background: C.card, color: C.text }}>
                {b.name}
                {b.edinich.length > 1 ? ` · ${b.edinich.length} ${t('estimates_count') || 'smeta'}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadLines(activeEstimateIds)}
            disabled={activeEstimateIds.length === 0 || loadingLines}
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
          {/* Material consolidation — sits next to "Forma 2 ni yaratish".
              Same visual weight as the form2 button; opens a modal that
              shows per-block material aggregation in Fakt mode. */}
          <button
            onClick={() => setMatConsOpen(true)}
            className="px-3.5 py-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition"
            style={{ background: C.sec, color: C.teal, border: '1px solid rgba(13,148,136,0.3)' }}
            title={({
              uz: "Material yig'indisi",
              ru: 'Сводная по материалам',
              en: 'Materials consolidation',
            })[language] || "Material yig'indisi"}
          >
            <Package className="w-3.5 h-3.5" />
            {({
              uz: "Material yig'indisi",
              ru: 'Сводная по материалам',
              en: 'Materials consolidation',
            })[language] || "Material yig'indisi"}
          </button>
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
              {canBulkAdmin && (
                <button
                  onClick={collapseSections}
                  disabled={sections.length === 0}
                  className="px-3.5 py-2 rounded-md text-xs transition disabled:opacity-50"
                  style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border2}` }}
                >
                  {t('collapse_all') || 'Yopish'}
                </button>
              )}
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
              {canBulkAdmin && (
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
              )}
              {/* Reset all qty — destructive, hence the amber-tinted style.
                 Disabled when no estimate is selected. Confirms before firing.
                 Admin/owner only — regular users mustn't wipe quantities. */}
              {canBulkAdmin && (
                <button
                  onClick={resetAllQuantities}
                  disabled={activeEstimateIds.length === 0 || loadingLines}
                  className="px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  style={{ background: 'transparent', color: C.amber, border: `1px solid ${C.amber}` }}
                  title={t('reset_all_qty') || "Barcha hajmlarni tushirish"}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('reset_all_qty') || "Hajmlarni tushirish"}
                </button>
              )}
            </div>
          </div>

          {/* Section list */}
          <div className="px-8 pb-12">
            {loadingLines ? (
              <Loader className="py-12" />
            ) : activeEstimateIds.length === 0 ? (
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
                        {sec.lines.length} {t('works_count_suffix') || 'ish'}
                      </span>
                      <span className="text-[13px] font-mono font-semibold" style={{ color: C.amber }}>
                        {fmt(sec.total)} {t('currency_som') || "so'm"}
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
                            openTopup={openTopup}
                            removeTopup={removeTopup}
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
                              openTopup={openTopup}
                              removeTopup={removeTopup}
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
            // Scope to the estimate selected at the top of the page so each
            // block carries its own resource list AND its own prices. User
            // explicitly asked: changing Block 1's price must not touch
            // Block 2 — that's enforced both by filtering the catalog
            // (here) and by passing estimate_id to the bulk-update calls.
            estimateId={estimateId ? Number(estimateId) : undefined}
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
            language={language}
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
        onSaved={() => loadLines(activeEstimateIds)}
      />
      <AddSubWorkModal
        open={addStageOpen}
        onClose={() => { setAddStageOpen(false); setAddTarget(null); }}
        projectId={project?.id}
        estimateId={Number(estimateId)}
        parent={addTarget}
        nextSeq={addTarget ? nextSeqFor(addTarget.id) : 1}
        onSaved={() => loadLines(activeEstimateIds)}
      />

      {/* Material consolidation modal — opened from the topbar button. */}
      <MaterialConsolidationModal
        open={matConsOpen}
        onClose={() => setMatConsOpen(false)}
        projectId={project?.id}
        projectName={project?.name}
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
              // `key` forces React to remount Form2Preview when switching
              // between snapshots — its date / VAT / other-costs state is
              // seeded from `snapshot` in useState() initializers, which
              // only run once per mount. Without the key, the second
              // snapshot you opened would reuse the first snapshot's
              // state.
              <Form2Preview
                key={`snap-${snapshotPreview.id}`}
                estimate={selectedEstimate}
                snapshot={snapshotPreview}
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

      {/* Resource top-up modal — opens from the "+" button next to
          delete on each resource sub-row. Records an additional
          purchase quantity at the (possibly different) new price, on
          a date the foreman can specify, with an optional note. */}
      {topupOpen && topupTarget && (
        <ResourceTopupModal
          resource={topupTarget}
          onSubmit={submitTopup}
          onCancel={() => { setTopupOpen(false); setTopupTarget(null); }}
          t={t}
        />
      )}

      {/* Generic confirm modal — fires for the bulk toolbar actions
          (Hammasini yoqish / Hammasini o'chirish / Hajmlarni tushirish)
          so the prompt matches the rest of the UI instead of using the
          OS-default window.confirm() dialog. The owner of `confirmModal`
          state handles closing it after the action runs. */}
      {confirmModal && (
        <SmetaConfirmModal
          tone={confirmModal.tone}
          title={confirmModal.title}
          body={confirmModal.body}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={() => {
            const cb = confirmModal.onConfirm;
            setConfirmModal(null);
            if (cb) cb();
          }}
          onCancel={() => setConfirmModal(null)}
          t={t}
        />
      )}
    </div>
  );
}

// =====================================================================
// ResourceTopupModal — entry form for an additional purchase against
// a smeta resource sub-line (migration 358). The original plan stays
// untouched; we capture extra_quantity at a new_price so the cost
// rollup can show real spend without losing the audit trail.
// =====================================================================
function ResourceTopupModal({ resource, onSubmit, onCancel, t }) {
  const [extra, setExtra] = React.useState('');
  const [price, setPrice] = React.useState(
    resource?.unit_rate != null ? String(resource.unit_rate) : '',
  );
  const [orderedAt, setOrderedAt] = React.useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !submitting) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  // Live preview — same rule the section subtotal will use.
  const num = (v) => {
    const n = Number(String(v).replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const extraN = num(extra);
  const priceN = num(price);
  const subtotal = extraN * priceN;
  const valid = extraN > 0 && priceN >= 0;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        extra_quantity: extraN,
        new_price: priceN,
        ordered_at: orderedAt || undefined,
        note: note.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)' }}
      onClick={() => { if (!submitting) onCancel?.(); }}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-[560px] w-[92%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('topup_modal_title') || "Qo'shimcha buyurtma qo'shish"}
            </h3>
            <p className="text-[12px] text-slate-500 mt-1">
              {t('topup_modal_subtitle')
                || "Asl smeta saqlanib qoladi — qo'shimcha buyurtma alohida yoziladi."}
            </p>
          </div>
        </div>

        {/* Resource being topped up */}
        <div className="rounded-lg p-3 mb-4 text-[12px]" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="text-[11px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
            {t('resource') || 'Resurs'}
          </div>
          <div className="font-medium text-slate-800">{resource?.name || '—'}</div>
          <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500">
            <span>
              {t('uom') || "O'lchov"}: <span className="text-slate-700">{resource?.uom || '—'}</span>
            </span>
            <span>
              {t('original_quantity') || 'Reja miqdor'}:{' '}
              <span className="text-slate-700 font-mono">{fmt(Number(resource?.quantity || 0))}</span>
            </span>
            <span>
              {t('original_price') || 'Reja narx'}:{' '}
              <span className="text-slate-700 font-mono">{fmt(Number(resource?.unit_rate || 0))}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
              {t('topup_extra_qty') || "Qo'shimcha miqdor"} *
            </label>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-md border text-sm font-mono tabular-nums"
              style={{ borderColor: '#CBD5E1' }}
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
              {t('topup_new_price') || 'Yangi narx'} *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-md border text-sm font-mono tabular-nums"
              style={{ borderColor: '#CBD5E1' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
              {t('topup_ordered_at') || 'Buyurtma sanasi'}
            </label>
            <input
              type="date"
              value={orderedAt}
              onChange={(e) => setOrderedAt(e.target.value)}
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={{ borderColor: '#CBD5E1' }}
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
              {t('topup_subtotal') || 'Summa'}
            </label>
            <div
              className="px-3 py-2 rounded-md text-sm font-mono tabular-nums"
              style={{ background: 'rgba(13,148,136,0.08)', color: '#0D9488', fontWeight: 600 }}
            >
              {fmt(subtotal)} so'm
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
            {t('topup_note') || 'Izoh (ixtiyoriy)'}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t('topup_note_placeholder') || "Yetkazib beruvchi, sabab, va h.k."}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ borderColor: '#CBD5E1' }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {t('cancel') || 'Bekor qilish'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60"
          >
            <Plus className="w-3.5 h-3.5" />
            {submitting ? (t('saving') || 'Saqlanmoqda...') : (t('add') || "Qo'shish")}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SmetaConfirmModal — styled confirm dialog used by the bulk toolbar
// actions on this tab. Tone picks the accent colour on the confirm
// button: amber for "destructive but reversible" (qty reset), red for
// "collapse all", teal for "expand all". Click outside / Esc cancels.
// =====================================================================
function SmetaConfirmModal({ tone = 'amber', title, body, confirmLabel, onConfirm, onCancel, t }) {
  const palette = {
    amber: { bg: 'bg-amber-600 hover:bg-amber-700' },
    red:   { bg: 'bg-rose-600 hover:bg-rose-700' },
    teal:  { bg: 'bg-emerald-700 hover:bg-emerald-800' },
  }[tone] || { bg: 'bg-emerald-700 hover:bg-emerald-800' };
  // Esc to dismiss without confirming.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-[520px] w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed mb-5 whitespace-pre-line">{body}</p>
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
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 ${palette.bg}`}
          >
            <span className="text-[14px] leading-none">✓</span>
            {confirmLabel || (t('confirm') || 'Tasdiqlash')}
          </button>
        </div>
      </div>
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
  openAddResource, openAddStage, openTopup, removeTopup, t, isSubStage,
}) {
  // Resource-level top-up expansion. Collapsed by default so a row
  // with several top-ups doesn't blow up the card height; the user
  // sees a "+N" badge on the resource row and clicks the chevron to
  // unfold the indented top-up child rows.
  const [expandedTopups, setExpandedTopups] = React.useState(() => new Set());
  const toggleTopups = (subId) => setExpandedTopups((s) => {
    const n = new Set(s);
    if (n.has(subId)) n.delete(subId); else n.add(subId);
    return n;
  });

  const qty = Number(line.quantity) || 0;
  const isEmpty = qty <= 0;
  const draft = qtyDraft;
  const qtyValue = draft !== undefined ? draft : qty;
  const qtyChanged = draft !== undefined && Number(parseNum(draft)) !== qty;
  const origQty = Number(line.original_quantity || 0);
  const qtyModified = origQty > 0 && Math.abs(qty - origQty) > 0.0001;

  // YAKUNIY (confirmed_engineer) → row is permanently locked per the v2
  // workflow spec (migration 353): no role can change quantity, status,
  // or anything else without an explicit engineer-side unlock action.
  // We disable the Fakt input and hide every per-row affordance that
  // would mutate the line. The engineer's unlock flow is on the
  // Bosqichlar (StagesTabV2) page, not here, so there's no inline
  // "unlock" button on Smeta boshqaruvi.
  const isLocked = line.approval_status === 'confirmed_engineer';

  // Sub-stage cards never carry sub-stages of their own (we don't allow
  // nesting), so all subs of a sub-stage are resources.
  const subResources = (subs || []).filter((s) => !isSubStageRow(s));

  // Per-resource effective cost. Three regimes:
  //   - No top-ups → qty × unit_rate (planned, original behavior).
  //   - Top-ups whose total qty covers the main resource qty
  //     (Σ topup.extra_quantity ≥ resource.quantity) → use the
  //     top-up sum. The foreman has now recorded what was actually
  //     purchased for the FULL planned amount at the prices that
  //     applied at order time, so the planned qty × unit_rate is
  //     replaced.
  //   - Top-ups whose total qty is SMALLER than the main resource qty
  //     → fall back to the main's own qty × unit_rate. A partial
  //     top-up is just a side-record (e.g. the foreman split the
  //     purchase) — it doesn't represent the whole spend, so using
  //     the planned cost gives the correct sum.
  const resourceCost = (s) => {
    const tps = Array.isArray(s.topups) ? s.topups : [];
    const mainQty = Number(s.quantity || 0);
    if (tps.length > 0) {
      const tpQty = tps.reduce((m, tp) => m + (Number(tp.extra_quantity) || 0), 0);
      if (tpQty >= mainQty) {
        return tps.reduce(
          (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
          0,
        );
      }
    }
    return Number(s.unit_rate || 0) * mainQty;
  };
  const breakdown = subResources.reduce(
    (acc, s) => {
      const c = resourceCost(s);
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
          {/* Sub-stages: show user-entered code if any, otherwise fall
              back to the "QO'SH." badge so legacy rows without a code
              still render. Top-level works always show their own code
              (or blank). Per user feedback: "kodini qoshdim qosh
              sozini orniga chiqishi kerak chiqmadi" — when a code
              exists, it must replace the QO'SH. label. */}
          {isSubStage ? (line.code || "QO'SH.") : (line.code || '')}
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
          {subResources.length} {t('resources_count_suffix') || 'resurs'}
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
          {/* Qty row + add buttons.
              Layout: NORMA (read-only, reja from smeta = original_quantity)
              alongside FAKT QILINGAN HAJM (editable, current quantity). The
              Bosqichlar tab already shows REJA + BAJARILDI side-by-side; this
              brings the same pair to Smeta boshqaruvi so the user can see how
              far the entered quantity has drifted from the imported smeta
              norm without flipping tabs. Label removed per product feedback —
              the per-pill labels (Norma / Fakt) below are explicit enough. */}
          <div
            className="flex items-center gap-3 py-3 mb-3 flex-wrap"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            {/* NORMA — reja quantity from the imported smeta. Read-only.
                Sized identically to the Fakt input below (same width /
                padding / font / height) so the two read as a matched pair
                in the row. */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: C.fade }}>
                {t('label_norma_short') || 'Norma'}
              </span>
              <span
                className="px-3 py-2 rounded-[5px] text-[13px] font-mono text-right tabular-nums inline-flex items-center justify-end"
                style={{
                  background: C.hover,
                  color: origQty > 0 ? C.text : C.muted,
                  border: `1px solid ${C.border2}`,
                  width: 120,
                  height: 38, // matches the input's computed height (text-[13px] + py-2 + 1px borders)
                  boxSizing: 'border-box',
                }}
                title={t('reja_smeta_hint') || "Smeta bo'yicha reja miqdor"}
              >
                {origQty > 0 ? fmt(origQty) : '—'}
              </span>
            </div>
            {/* FAKT QILINGAN HAJM — editable while the work is open;
                read-only once the engineer confirms (YAKUNIY). The
                read-only path swaps the <input> for a styled <span> so
                no role accidentally types into a locked row even if a
                browser plugin re-enables disabled inputs. */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: C.fade }}>
                {t('label_fakt_qilingan_hajm_short') || 'Fakt'}
              </span>
              {isLocked ? (
                <span
                  className="px-3 py-2 rounded-[5px] text-[13px] font-mono text-right tabular-nums inline-flex items-center justify-end"
                  style={{
                    background: C.hover,
                    color: C.muted,
                    border: `1px solid ${C.border2}`,
                    width: 120,
                    height: 38,
                    boxSizing: 'border-box',
                  }}
                  title={t('locked_by_engineer') || 'YAKUNIY: faqat bosh muhandis tahrirlay oladi'}
                >
                  {qty > 0 ? fmt(qty) : '—'}
                </span>
              ) : (
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
                    width: 120,
                    height: 38, // pinned to match the Norma chip exactly
                    boxSizing: 'border-box',
                    fontWeight: qtyChanged || isEmpty ? 600 : 400,
                  }}
                />
              )}
            </div>
            <span className="text-xs" style={{ color: C.muted }}>{line.uom || ''}</span>
            {qtyModified && !isLocked && (
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
            {/* Locked banner — replaces the add/delete buttons when the
                work is YAKUNIY. Tells the user the row is read-only and
                whose role can change that. */}
            {isLocked && (
              <span
                className="px-2.5 py-1 rounded-md text-[11px] inline-flex items-center gap-1.5"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  color: '#065F46',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}
                title={t('locked_by_engineer') || 'YAKUNIY: faqat bosh muhandis tahrirlay oladi'}
              >
                <Lock className="w-3 h-3" />
                {t('locked') || 'Qulflangan'}
              </span>
            )}
            {/* Top-level works get BOTH buttons. Sub-stages only get
                "Resurs qo'shish" — we don't support nested stages.
                Both are hidden when the row is locked so a foreman can't
                graft new sub-rows onto a finalised work. */}
            {!isSubStage && !isLocked && (
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
            {!isLocked && (
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
            )}
            {/* Sub-stages can be deleted from their own header — except
                when locked. */}
            {isSubStage && !isLocked && (
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
                      { l: t('col_tur')           || 'Tur',         w: 60,  align: 'left' },
                      { l: t('col_resource_name') || 'Resurs nomi', w: null, align: 'left' },
                      { l: t('col_unit')          || "O'lchov",     w: 70,  align: 'center' },
                      { l: t('col_norm')          || 'Norma',       w: 90,  align: 'right' },
                      { l: t('col_total_qty')     || 'Jami',        w: 100, align: 'right' },
                      { l: t('col_price')         || 'Narx',        w: 130, align: 'right', lock: true },
                      { l: t('col_amount')        || 'Summa',       w: 130, align: 'right' },
                      { l: '',                                       w: 70,  align: 'left' },
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
                    const baseCost = price * sq;
                    const topups = Array.isArray(sub.topups) ? sub.topups : [];
                    const topupTotal = topups.reduce(
                      (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
                      0,
                    );
                    const topupQty = topups.reduce(
                      (m, tp) => m + (Number(tp.extra_quantity) || 0),
                      0,
                    );
                    // Replace the planned cost with the top-up sum
                    // ONLY when the top-ups together cover the full
                    // planned quantity (Σ topup.qty ≥ resource.qty).
                    // For partial top-ups (Σ topup.qty < resource.qty)
                    // the foreman has just side-recorded part of the
                    // purchase; the resource still owes the rest at
                    // the planned rate, so we keep qty × unit_rate.
                    const topupsCover = topups.length > 0 && topupQty >= sq;
                    const cost = topupsCover ? topupTotal : baseCost;
                    const isResourceLike = ['material', 'labor', 'equipment', 'machine', 'machines'].includes(
                      String(sub.resource_type || '').toLowerCase(),
                    );
                    const hasTopups = topups.length > 0;
                    const topupsOpen = hasTopups && expandedTopups.has(sub.id);
                    return (
                      <React.Fragment key={sub.id}>
                        <tr
                          style={{
                            borderTop: `1px solid ${C.border}`,
                            cursor: hasTopups ? 'pointer' : 'default',
                            background: topupsOpen ? 'rgba(13,148,136,0.03)' : 'transparent',
                          }}
                          onClick={hasTopups ? () => toggleTopups(sub.id) : undefined}
                        >
                          <td className="px-2.5 py-2">
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                              style={{ background: tag.tagBg, color: tag.tagText }}
                            >
                              {CAT_LABEL[cat]}
                            </span>
                          </td>
                          <td className="px-2.5 py-2" style={{ color: C.text }}>
                            <div className="flex items-center gap-2">
                              {hasTopups && (
                                <span
                                  className="inline-flex items-center justify-center rounded-md flex-shrink-0 transition"
                                  style={{
                                    width: 22,
                                    height: 22,
                                    background: topupsOpen ? C.teal : 'rgba(13,148,136,0.18)',
                                    color: topupsOpen ? '#FFFFFF' : C.teal,
                                    border: `1px solid ${topupsOpen ? C.teal : 'rgba(13,148,136,0.45)'}`,
                                    boxShadow: topupsOpen ? '0 1px 3px rgba(13,148,136,0.35)' : 'none',
                                  }}
                                  title={topupsOpen
                                    ? (t('collapse') || 'Yopish')
                                    : `${t('expand') || 'Ochish'}: ${topups.length} ${t('topup_label') || "qo'shimcha"}`}
                                >
                                  <ChevronDown
                                    className="w-4 h-4 transition"
                                    strokeWidth={2.75}
                                    style={{
                                      transform: topupsOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                    }}
                                  />
                                </span>
                              )}
                              <span>{sub.name}</span>
                              {hasTopups && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.06em] flex-shrink-0 inline-flex items-center gap-1"
                                  style={{
                                    background: C.teal,
                                    color: '#FFFFFF',
                                    boxShadow: '0 1px 2px rgba(13,148,136,0.35)',
                                  }}
                                  title={`${topups.length} ${t('topup_label') || "qo'shimcha buyurtma"}`}
                                >
                                  +{topups.length} ДОП
                                </span>
                              )}
                            </div>
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
                            <div className="flex items-center gap-1">
                              {/* "+" — record an additional purchase
                                 (top-up) at a possibly-different price
                                 without touching the original smeta plan.
                                 Hidden for non-resource rows just in case. */}
                              {isResourceLike && openTopup && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openTopup(sub); }}
                                  title={t('topup_add') || "Qo'shimcha buyurtma"}
                                  className="w-7 h-7 rounded-[5px] flex items-center justify-center transition"
                                  style={{ background: C.tealSoft, border: `1px solid ${C.border2}`, color: C.teal }}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeLine(sub); }}
                                title={t('delete') || "O'chirish"}
                                className="w-7 h-7 rounded-[5px] flex items-center justify-center transition"
                                style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.red }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Top-up rows — indented child rows that appear
                           directly under their parent resource, but
                           only when the parent has been expanded
                           (collapsed by default to keep card height
                           sane when there are several top-ups). Each
                           row shows extra_quantity × new_price + a
                           delete button. They never move with sort
                           order; they always stick to their parent. */}
                        {topupsOpen && topups.map((tp) => {
                          const tpQty = Number(tp.extra_quantity) || 0;
                          const tpPrice = Number(tp.new_price) || 0;
                          const tpCost = tpQty * tpPrice;
                          return (
                            <tr key={`tp-${tp.id}`} style={{
                              background: 'rgba(13,148,136,0.04)',
                              borderTop: `1px dashed ${C.border}`,
                            }}>
                              <td className="px-2.5 py-1.5">
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.05em]"
                                  style={{ background: 'rgba(13,148,136,0.15)', color: C.teal }}
                                  title={tp.note || ''}
                                >
                                  +ДОП
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 pl-7 text-[11px]" style={{ color: C.dim }}>
                                <span style={{ color: C.muted }}>↳ </span>
                                {t('topup_label') || "Qo'shimcha buyurtma"}
                                {tp.ordered_at ? (
                                  <span className="ml-2 text-[10px]" style={{ color: C.fade }}>
                                    {tp.ordered_at}
                                  </span>
                                ) : null}
                                {tp.note ? (
                                  <span className="ml-2 text-[10px] italic" style={{ color: C.fade }}>
                                    — {tp.note}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-2.5 py-1.5 text-center text-[11px]" style={{ color: C.fade }}>
                                {sub.uom || ''}
                              </td>
                              <td className="px-2.5 py-1.5"></td>
                              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-[11px]"
                                  style={{ color: C.dim }}>
                                {fmt(tpQty)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-[11px]"
                                  style={{ color: C.text }}>
                                {fmt(tpPrice)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-[11px]"
                                  style={{ color: C.teal, fontWeight: 600 }}>
                                {fmt(tpCost)}
                              </td>
                              <td className="px-2.5 py-1.5">
                                {removeTopup && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeTopup(sub, tp); }}
                                    title={t('delete') || "O'chirish"}
                                    className="w-6 h-6 rounded-[5px] flex items-center justify-center transition"
                                    style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.red }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
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
                  <span className="text-[11px]" style={{ color: C.muted }}>{t('label_total_caps') || 'JAMI'}:</span>
                  <span className="font-mono font-semibold text-[15px]" style={{ color: C.amber }}>
                    {fmt(workTotal)} {t('currency_som') || "so'm"}
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
        <Loader className="py-12" size="w-5 h-5" />
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
                <th className="px-3 py-2 text-left font-medium" style={{ color: C.muted }}>{t('history_col_block') || 'Blok'}</th>
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
                  <td className="px-3 py-2">
                    {s.building_name ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: C.inset, color: C.teal, border: `1px solid ${C.border2}` }}
                      >
                        {s.building_name}
                      </span>
                    ) : (
                      <span style={{ color: C.muted }}>—</span>
                    )}
                  </td>
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
// AUDIT_ACTION_META — display metadata per audit action code. Each entry
// carries the trio of locale labels (uz / ru / en) so the table doesn't
// render Uzbek strings against a Russian-mode UI. New action codes shipped
// by the backend MUST land here too — without an entry the table falls
// back to printing the raw code (the bug user reported with `topup_add` /
// `topup_del` showing as "topup_add" / "topup_del").
const AUDIT_ACTION_META = {
  qty_change:      { color: '#0D9488', icon: Edit3,        label_uz: 'Hajm',                 label_ru: 'Объём',              label_en: 'Quantity' },
  price_change:    { color: '#D97706', icon: DollarSign,   label_uz: 'Narx',                 label_ru: 'Цена',               label_en: 'Price' },
  mat_type:        { color: '#7C3AED', icon: Tag,          label_uz: 'Material turi',        label_ru: 'Тип материала',      label_en: 'Material type' },
  subwork_add:     { color: '#16A34A', icon: Plus,         label_uz: 'Yangi etap',           label_ru: 'Новый этап',         label_en: 'New stage' },
  subwork_del:     { color: '#DC2626', icon: Trash2,       label_uz: "Etap o'chdi",          label_ru: 'Этап удалён',        label_en: 'Stage deleted' },
  res_add:         { color: '#0D9488', icon: Plus,         label_uz: "Resurs qo'shildi",     label_ru: 'Ресурс добавлен',    label_en: 'Resource added' },
  res_del:         { color: '#DC2626', icon: Trash2,       label_uz: "Resurs o'chdi",        label_ru: 'Ресурс удалён',      label_en: 'Resource deleted' },
  reset_qty:       { color: '#475569', icon: RotateCcw,    label_uz: 'Hajm reset',           label_ru: 'Сброс объёма',       label_en: 'Quantity reset' },
  reset_qty_all:   { color: '#475569', icon: RotateCcw,    label_uz: "Barcha hajm reset",    label_ru: 'Сброс всех объёмов', label_en: 'All quantities reset' },
  reset_price:     { color: '#475569', icon: RotateCcw,    label_uz: 'Narx reset',           label_ru: 'Сброс цены',         label_en: 'Price reset' },
  reset_price_all: { color: '#475569', icon: RotateCcw,    label_uz: 'Barcha narx reset',    label_ru: 'Сброс всех цен',     label_en: 'All prices reset' },
  form_save:       { color: '#0D9488', icon: SaveIcon,     label_uz: 'Forma 2 saqlandi',     label_ru: 'Форма 2 сохранена',  label_en: 'Forma 2 saved' },
  form_delete:     { color: '#DC2626', icon: Trash2,       label_uz: "Forma 2 o'chdi",       label_ru: 'Форма 2 удалена',    label_en: 'Forma 2 deleted' },
  other_pct:       { color: '#7C3AED', icon: Percent,      label_uz: 'Boshqa xarajat %',     label_ru: 'Прочие %',           label_en: 'Other costs %' },
  use_vat:         { color: '#7C3AED', icon: ToggleLeft,   label_uz: 'QQS',                  label_ru: 'НДС',                label_en: 'VAT' },
  // Top-up actions — the foreman recording an extra purchase that
  // covers (or partially covers) a planned resource at a different
  // price. Backend writes these from construction_resource_topup.go.
  topup_add:       { color: '#0D9488', icon: Plus,         label_uz: "Qo'shimcha buyurtma",  label_ru: 'Доп. заказ',         label_en: 'Top-up added' },
  topup_del:       { color: '#DC2626', icon: Trash2,       label_uz: "Qo'shimcha o'chdi",    label_ru: 'Доп. удалён',        label_en: 'Top-up deleted' },
};

// Pick the locale-appropriate label for an action meta record. Called
// from the action cell + the filter dropdown so both stay in sync with
// the current language.
function auditActionLabel(meta, language) {
  if (!meta) return '';
  if (language === 'ru' && meta.label_ru) return meta.label_ru;
  if (language === 'en' && meta.label_en) return meta.label_en;
  return meta.label_uz || meta.label_ru || meta.label_en || '';
}

// Approval-status codes the backend writes into audit `from_value` /
// `to_value` cells when transitionWork() flips a row's
// approval_status. The audit table renders these raw, so they used to
// surface as English machine codes ("in_progress → submitted") in any
// language. This helper passes them through the existing
// work_status_*_long translation keys so the column reads "Jarayonda
// → Tekshiruvda" / "В процессе → На проверке" / "In progress → In
// review" depending on the active language. Numeric / arbitrary values
// (qty changes, price changes, etc.) fall through unchanged.
const AUDIT_STATUS_CODES = new Set([
  'pending', 'in_progress', 'submitted',
  'confirmed_supervisor', 'confirmed_engineer',
]);
function localizeAuditValue(t, raw) {
  if (raw == null) return raw;
  const s = String(raw).trim();
  if (!AUDIT_STATUS_CODES.has(s)) return raw;
  return t(`work_status_${s}_long`) || raw;
}

function AuditPage({ t, language, loading, entries, filter, onFilterChange, onRefresh }) {
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
            <option key={k} value={k}>{auditActionLabel(m, language)}</option>
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
        <Loader className="py-12" size="w-5 h-5" />
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
                // Unknown action codes get a neutral icon + the raw code
                // as label (so a brand-new backend action shows up
                // identifiably rather than disappearing). Once the action
                // is added to AUDIT_ACTION_META it gets the proper label.
                const meta = AUDIT_ACTION_META[e.action] || { color: C.muted, icon: Activity, label_uz: e.action, label_ru: e.action, label_en: e.action };
                const Icon = meta.icon;
                const actionLabel = auditActionLabel(meta, language);
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
                        <span className="text-[12px]" style={{ color: meta.color, fontWeight: 500 }}>{actionLabel}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2" style={{ color: C.text }}>
                      {/* Hide the literal "topup" target written by older
                          versions of the topup endpoint — the row's
                          description already starts with the resource
                          name ("ЗАТРАТЫ ТРУДА … uchun qo'shimcha
                          buyurtma: …"), so the bare "topup" headline
                          adds nothing. New rows carry the actual
                          resource line name in `target` and render
                          normally. */}
                      {e.target && e.target !== 'topup' ? e.target : null}
                      {!e.target || e.target === 'topup' ? (e.description ? null : '—') : null}
                      {e.description && (
                        <div className="text-[11px]" style={{ color: C.muted }}>{e.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono" style={{ color: C.dim }}>
                      {e.from_value || e.to_value
                        ? <>
                            {e.from_value && <span style={{ color: C.muted }}>{localizeAuditValue(t, e.from_value)}</span>}
                            {e.from_value && e.to_value && <span style={{ color: C.fade }}> → </span>}
                            {e.to_value && <span style={{ color: C.text, fontWeight: 600 }}>{localizeAuditValue(t, e.to_value)}</span>}
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
