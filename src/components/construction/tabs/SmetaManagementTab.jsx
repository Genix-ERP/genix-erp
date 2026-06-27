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
import { useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { formatApiError } from '@/utils/apiErrors';
import Form2Preview from '@/components/construction/Form2Preview';
import MaterialConsolidationModal from '@/components/construction/MaterialConsolidationModal';
import ResourcesPanel from '@/components/construction/ResourcesPanel';
import AddResourcePickerModal from '@/components/construction/AddResourcePickerModal';
import AddSubWorkModal from '@/components/construction/AddSubWorkModal';
import EstimateLineEditModal from '@/components/construction/EstimateLineEditModal';
import { sortLinesManualFirst, sortLinesManualFirstInPlace } from '@/components/construction/utils/sortLines';

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
  // Permission gating for the section / sub-section delete buttons.
  // The hook returns true for tenant admins/owners/site-admins, so they
  // see the trash icons by default. Regular employees only see them
  // when their role grants `construction.delete`.
  const { canDelete: canDeletePermFn } = useEmployeePermissions();
  const canDeleteConstruction = canDeletePermFn('construction');

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
  // Subcontractor filter for the active block. null = project's own (in-house).
  const [subFilter, setSubFilter] = useState(null);
  const [lines, setLines] = useState([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage] = useState('works');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [openWorks, setOpenWorks] = useState(new Set());

  // ── Infinite-scroll render window ─────────────────────────────────
  // We keep the FULL lines array in memory (so the stat cards, "831"
  // counts, search, "Hammasini yoqish/o'chirish", Forma 2 freeze and
  // material hisobi all see every line). Only the RENDERED list is paged:
  // we draw the first WORKS_PER_PAGE *works* and reveal more as the user
  // scrolls a sentinel into view — no page button, no change to the data
  // layer. The window counts WORKS, never resources: a work's resources
  // are child rows that render inside its own card, so a work with 100
  // resources is one item and is never split across pages.
  const WORKS_PER_PAGE = 20;
  const [visibleWorkCount, setVisibleWorkCount] = useState(WORKS_PER_PAGE);
  const loadMoreRef = React.useRef(null);

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

  // Inline-edit modal — drives the full EstimateLineEditModal for any
  // estimate line (parent work OR resource sub-line). Carries the line
  // being edited plus the parent for context. Set to null = closed.
  const [editLineTarget, setEditLineTarget] = useState(null);

  const [form2Open, setForm2Open] = useState(false);
  // Forma 3 (КС-3) generator modal. Builds the certificate from
  // engineer-confirmed (YAKUNIY) works, split into the three КС-3 windows by
  // confirmation date relative to the chosen reporting month.
  // Material consolidation modal — toggled by the "Material yig'indisi"
  // button in the topbar next to "Forma 2 ni yaratish".
  const [matConsOpen, setMatConsOpen] = useState(false);
  const [qtyDraft, setQtyDraft] = useState({});

  // Forma 2 iterations (migration 419). The same tab strip Bosqichlar
  // shows — surfaced here so the foreman can also tell at a glance
  // which iteration the smeta edits will land in, and so the iteration
  // is read-only when the user is browsing a frozen one. Pressing
  // "+ Forma 2 ni yaratish" anywhere on the page advances this strip.
  const [iterations, setIterations] = useState([]);
  const [activeIterationId, setActiveIterationId] = useState(null);
  // Refresh tick bumped from handleSaveSnapshot success so the strip
  // reloads after the foreman freezes via the Forma 2 button.
  const [iterRefreshTick, setIterRefreshTick] = useState(0);
  // Per-line period_fakt for the active iteration. The FAKT input on
  // top-level work cards displays this (so a fresh iter shows 0)
  // instead of line.quantity (which carries the cumulative). Mirrors
  // the same plumbing in StagesTabV2 — the two pages stay in sync
  // because both flow through updateWorkDoneQuantity on save.
  const [periodFaktByLine, setPeriodFaktByLine] = useState(new Map());

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
  const [loadingMoreAudit, setLoadingMoreAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');
  // Server-side pagination of the Jurnal (20/page). auditTotal drives the
  // tab badge; auditPage/auditHasMore drive the scroll-to-load-more.
  const AUDIT_PAGE_SIZE = 20;
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoadError, setAuditLoadError] = useState(false);
  const auditMoreRef = React.useRef(null);

  // Generic confirmation modal — replaces window.confirm() calls for
  // destructive bulk actions (Hammasini yoqish / Hammasini o'chirish /
  // Hajmlarni tushirish / line-delete) so the prompt matches the rest of
  // the app's styling and runs through translations. Shape:
  //   { title, body, confirmLabel, tone: 'amber'|'red'|'teal', onConfirm }
  const [confirmModal, setConfirmModal] = useState(null);

  // Manually-added top-level sections. The `sections` useMemo below builds
  // section cards from each line's `parent_item_number`, so a section with
  // ZERO lines won't show at all. To let the user create a new section
  // (e.g. "ОТДЕЛКА") before they've added any work to it, we fetch the
  // construction_stages table — those names are merged into the section
  // list as empty cards. The names persist across reloads (they live in
  // the stages table), and Bosqichlar's "+ Bosqich qo'shish" populates the
  // same store, so the two tabs stay in sync.
  //
  // Stored as full rows ({id, name, ...}) rather than bare strings so the
  // useMemo below can sort by id DESC — newest-added stage floats to the
  // top of the list, matching the user expectation when they click
  // "+ Bo'lim qo'shish" and want to see the new entry immediately.
  const [manualSectionRows, setManualSectionRows] = useState([]); // [{id, name, ...}]
  const manualSectionNames = useMemo(
    () => manualSectionRows.map((s) => String(s.name || '').trim()).filter(Boolean),
    [manualSectionRows],
  );

  // IDs of construction_stages rows the user added via "+ Bo'lim qo'shish".
  //
  // Persisted in localStorage (per project) so the "user-added at top"
  // ordering survives page reloads. We can't infer this from the
  // backend alone because construction_stages has no `is_user_created`
  // flag — both manual and auto-import paths use createStage with
  // identical payloads. Multiple єdinich imports of the same block
  // also produce many auto-stage rows; without this marker any
  // unloaded import's stages would outrank truly user-added ones in an
  // id-DESC sort. Tagging explicitly keeps the ordering deterministic.
  const manualIdsStorageKey = project?.id ? `manualSectionIds:${project.id}` : '';
  const [recentlyAddedSectionIds, setRecentlyAddedSectionIds] = useState(() => {
    if (!project?.id) return [];
    try {
      const raw = window.localStorage.getItem(`manualSectionIds:${project.id}`);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    } catch { return []; }
  });
  const persistManualIds = useCallback((ids) => {
    if (!manualIdsStorageKey) return;
    try { window.localStorage.setItem(manualIdsStorageKey, JSON.stringify(ids)); }
    catch { /* quota / disabled — ignore */ }
  }, [manualIdsStorageKey]);
  const [addSectionModal, setAddSectionModal] = useState(null);     // { name } | null
  const [addSectionBusy, setAddSectionBusy] = useState(false);
  const [sectionRefreshTick, setSectionRefreshTick] = useState(0);

  // "+ Ish qo'shish" modal — creates a top-level estimate line whose
  // parent_item_number is the section's name, so the new work appears
  // INSIDE the section's expanded list and behaves identically to any
  // imported work (resource breakdowns, approval workflow, FAKT input,
  // top-ups, Forma 2 rollup — all of them key off the same estimate-line
  // record). Shape: { sectionName, name, uom, code } | null.
  const [addWorkModal, setAddWorkModal] = useState(null);
  const [addWorkBusy, setAddWorkBusy] = useState(false);

  // "+ Sub-bosqich qo'shish" target — when set, opens the AddSubWorkModal
  // in parentSection mode (same rich form as "Yangi qo'shimcha etap":
  // code / name / uom / qty). The created line nests as a sub-stage
  // under this section via parent_item_number = `${sectionName} › name`.
  const [addSubBosqichSection, setAddSubBosqichSection] = useState(null);

  // ── Load estimates ─────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setLoadingEstimates(true);
    constructionService.listEstimates(project.id, { scope: 'all' })
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
  // Subcontractors that have an edinich estimate for the active block.
  const blockSubcontractors = useMemo(() => {
    if (!activeBlock) return [];
    const map = new Map();
    for (const e of activeBlock.edinich) {
      if (e.subcontract_id) map.set(Number(e.subcontract_id), e.subcontract_name || `#${e.subcontract_id}`);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [activeBlock]);
  // Reset the subcontractor filter when the block changes.
  useEffect(() => { setSubFilter(null); }, [buildingId]);
  const activeEstimateIds = useMemo(() => {
    if (!activeBlock) return [];
    // null → project's own (subcontract_id NULL); number → that subcontractor.
    const matchesSub = (e) => subFilter ? Number(e.subcontract_id) === Number(subFilter) : !e.subcontract_id;
    return activeBlock.edinich.filter(matchesSub).map((e) => Number(e.id));
  }, [activeBlock, subFilter]);
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
  //
  // Block-switch cache: a project with thousands of lines was timing out
  // every time the user clicked between 1-Block / 2-Block / 3-Block /
  // 4-Block because the lines were refetched in full each time. Keep
  // an in-memory Map keyed by the sorted estimateId list — switching
  // back to a previously-loaded block now hydrates from cache instantly
  // and the network round-trip only happens on first visit or after the
  // user presses "Yangilash" (which calls forceReloadLines below).
  const linesCacheRef = React.useRef(new Map());
  // Monotonic token so a block-switch can invalidate an in-flight load: any
  // setLines from a stale invocation is dropped, preventing the "shaking"
  // (block A's load writing over block B after you switch).
  const loadTokenRef = React.useRef(0);
  // After a mutation that forces a reload (add resource / sub-stage), remember
  // which work to scroll back to once the fresh lines paint — otherwise the
  // loader swap drops the user at the top of the page.
  const pendingScrollWorkRef = React.useRef(null);
  const cacheKeyFor = useCallback((ids) => {
    const idList = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    return idList.slice().sort((a, b) => Number(a) - Number(b)).join(',');
  }, []);
  const loadLines = useCallback(async (ids, { force = false } = {}) => {
    const idList = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    // Invalidate any in-flight load — only the latest call may write state.
    const token = ++loadTokenRef.current;
    const isCurrent = () => token === loadTokenRef.current;
    if (idList.length === 0) { setLines([]); return; }
    const key = cacheKeyFor(idList);
    if (!force) {
      const cached = linesCacheRef.current.get(key);
      if (Array.isArray(cached)) {
        setLines(cached);
        setQtyDraft({});
        return;
      }
    }
    setLoadingLines(true);
    setQtyDraft({});
    try {
      // The web app needs the full estimate in memory (stat cards, "831"
      // count, search, "Hammasini yoqish/o'chirish", Forma 2 freeze,
      // material hisobi), so we pull it in ONE request per estimate — fast
      // and stable. (Mobile, which can't hold the whole estimate, uses the
      // 20-paged endpoint + the /summary endpoint instead.) Render windowing
      // keeps the painted DOM small regardless of how much is loaded.
      const all = [];
      for (const id of idList) {
        const rows = await constructionService.listEstimateLines(id, { page_size: 5000 });
        if (!isCurrent()) return; // a newer block switch superseded us
        const arr = Array.isArray(rows) ? rows : (rows?.data || rows?.items || []);
        all.push(...arr);
      }
      if (!isCurrent()) return;
      linesCacheRef.current.set(key, all);
      setLines(all);
    } catch (e) {
      if (!isCurrent()) return;
      toast.error(formatApiError(e, t, 'Xatolik'));
      setLines([]);
    } finally {
      if (isCurrent()) setLoadingLines(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKeyFor]);
  // Forced reload — bound to the "Yangilash" button. Drops the cache for
  // the current block before re-fetching so the user can still pull
  // fresh state when they suspect another user just mutated the smeta.
  const forceReloadLines = useCallback(() => {
    const key = cacheKeyFor(activeEstimateIds);
    linesCacheRef.current.delete(key);
    loadLines(activeEstimateIds, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEstimateIds, loadLines, cacheKeyFor]);
  // Block switch is the main caller; use the cache so coming back to a
  // previously-loaded block hydrates instantly. Mutation reloads call
  // loadLines with { force: true } so their fresh state replaces the
  // cached copy.
  useEffect(() => { loadLines(activeEstimateIds, { force: false }); }, [activeEstimateIds, loadLines]);

  // Reload that remembers a work to return to. Used by the add-resource /
  // add-sub-stage flows so the page doesn't jump to the top after saving.
  const reloadKeepingWork = useCallback((workId) => {
    if (workId != null) {
      pendingScrollWorkRef.current = Number(workId);
      // Keep the work expanded so its resource list is visible on return.
      setOpenWorks((s) => { const n = new Set(s); n.add(Number(workId)); return n; });
    }
    loadLines(activeEstimateIds, { force: true });
  }, [activeEstimateIds, loadLines]);

  // Once the forced reload finishes painting, scroll the remembered work back
  // into view. Two rAFs wait for the windowed list to re-render.
  useEffect(() => {
    if (loadingLines) return;
    const id = pendingScrollWorkRef.current;
    if (id == null) return;
    pendingScrollWorkRef.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`work-anchor-${id}`);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
    }));
  }, [loadingLines, lines]);

  // ── Manually-added sections (construction_stages) ─────────────────
  // Fetched whenever the active block changes or "+ Yangi seksiya" was
  // just used. Names with no matching parent_item_number on any line
  // are merged into the rendered section list as empty cards — see the
  // `sections` useMemo below.
  useEffect(() => {
    if (!project?.id) {
      setManualSectionRows([]);
      return;
    }
    let cancelled = false;
    const opts = (buildingId && buildingId !== '0')
      ? { buildingId: Number(buildingId) }
      : undefined;
    constructionService.listStages(project.id, opts)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : (rows?.data || rows?.items || []);
        // Scope: the listStages endpoint already filters by building when
        // we pass the param; we also defensively re-filter so the
        // "Butun loyiha" case (buildingId === '0' / unset) doesn't pull in
        // building-specific stages from other blocks.
        const scoped = (buildingId && buildingId !== '0')
          ? list.filter((s) => Number(s.building_id) === Number(buildingId))
          : list.filter((s) => !s.building_id);
        // No sort — preserve the backend's natural order. The
        // recentlyAddedSectionNames set (populated by the modal save
        // handler) is what bubbles freshly-added sections to the top
        // of the list, leaving everything else (including stages
        // auto-created during єdinich import) in place.
        setManualSectionRows(scoped);
      })
      .catch(() => { if (!cancelled) setManualSectionRows([]); });
    return () => { cancelled = true; };
  }, [project?.id, buildingId, sectionRefreshTick]);

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
    // Use the server-computed project-wide modified count (summary.modified_count)
    // — the endpoint is paginated now, so counting a single 20-row page client-side
    // would undercount. page_size=1 keeps the payload tiny; we only need the summary.
    constructionService.listResourcePrices(project.id, { pageSize: 1 })
      .then((res) => {
        if (cancelled) return;
        setChangedCount(Number(res?.summary?.modified_count || 0));
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
  // Formalar tarixi is scoped to the whole PROJECT, not the selected block.
  // Forma 2 iterations are project-level (one open per project), but each
  // freeze pins its snapshot to whichever block's estimate was active — so a
  // per-estimate query showed nothing whenever the user viewed a different
  // block than the one they froze from. Listing by project mirrors the
  // iteration strip; the "Blok" column shows which block each row came from.
  const loadSnapshots = useCallback(async (projId) => {
    if (!projId) { setSnapshots([]); return; }
    setLoadingSnapshots(true);
    try {
      const rows = await constructionService.listProjectForm2Snapshots(projId);
      setSnapshots(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      setSnapshots([]);
    } finally {
      setLoadingSnapshots(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Jurnal is PROJECT-scoped (like Formalar tarixi). Many changes —
  // notably resource price edits — are logged project-wide (estimate_id
  // NULL), and changes also happen across sibling blocks; an estimate-scoped
  // query would miss all of those and the journal would look empty even
  // though changes exist. `projId` is the project id.
  const loadAudit = useCallback(async (projId, action) => {
    if (!projId) { setAuditEntries([]); setAuditTotal(0); setAuditHasMore(false); return; }
    setLoadingAudit(true);
    setAuditLoadError(false);
    try {
      const { data, meta } = await constructionService.listProjectSmetaAudit(projId, {
        page: 1, page_size: AUDIT_PAGE_SIZE, action: action || undefined,
      });
      const rows = Array.isArray(data) ? data : [];
      setAuditEntries(rows);
      setAuditPage(1);
      setAuditTotal(meta?.total ?? rows.length);
      setAuditHasMore(meta?.has_next ?? (rows.length >= AUDIT_PAGE_SIZE));
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      setAuditEntries([]); setAuditTotal(0); setAuditHasMore(false);
    } finally {
      setLoadingAudit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the next page and append — driven by the scroll sentinel.
  const loadMoreAudit = useCallback(async () => {
    if (loadingMoreAudit || !auditHasMore || !project?.id) return;
    setLoadingMoreAudit(true);
    setAuditLoadError(false);
    const next = auditPage + 1;
    try {
      const { data, meta } = await constructionService.listProjectSmetaAudit(project.id, {
        page: next, page_size: AUDIT_PAGE_SIZE, action: auditFilter || undefined,
      });
      const rows = Array.isArray(data) ? data : [];
      setAuditEntries((prev) => [...prev, ...rows]);
      setAuditPage(next);
      setAuditHasMore(meta?.has_next ?? (rows.length >= AUDIT_PAGE_SIZE));
    } catch (err) {
      // Flag the error so the IntersectionObserver stops auto-retrying (which
      // otherwise spins forever); the user can retry via the explicit button.
      console.error('Failed to load more audit', err);
      setAuditLoadError(true);
    } finally {
      setLoadingMoreAudit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMoreAudit, auditHasMore, project?.id, auditPage, auditFilter]);

  // Lazily refresh whenever the user opens Tarix or Jurnal.
  // Deps must NOT include loadSnapshots/loadAudit — they're stable
  // (empty-dep useCallback), and listing them would put us right back
  // in the infinite loop if the empty-dep guarantee ever drifts.
  useEffect(() => {
    if (page === 'history') loadSnapshots(project?.id);
    if (page === 'audit')   loadAudit(project?.id, auditFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, estimateId, auditFilter, project?.id]);

  // Infinite scroll for the Jurnal — fetch the next 20 when the sentinel
  // at the bottom of the list scrolls into view.
  useEffect(() => {
    if (page !== 'audit') return undefined;
    if (auditLoadError) return undefined; // don't auto-retry a failed page
    const el = auditMoreRef.current;
    if (!el || !auditHasMore) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMoreAudit();
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [page, auditHasMore, auditLoadError, loadMoreAudit]);

  // Background prefetch of snapshot + audit counts so the inner-tab badges
  // ("Formalar tarixi 2", "O'zgarishlar jurnali 13" in v23) show real
  // numbers even before the user opens those tabs. One request each per
  // estimate change; cheap because both endpoints return small payloads.
  useEffect(() => {
    let cancelled = false;
    // Snapshot count badge is project-wide (see loadSnapshots note above).
    if (page !== 'history' && project?.id) {
      constructionService.listProjectForm2Snapshots(project.id)
        .then((rows) => { if (!cancelled) setSnapshots(Array.isArray(rows) ? rows : []); })
        .catch(() => {});
    }
    if (page !== 'audit' && project?.id) {
      constructionService.listProjectSmetaAudit(project.id, { page: 1, page_size: AUDIT_PAGE_SIZE })
        .then(({ data, meta }) => {
          if (cancelled) return;
          const rows = Array.isArray(data) ? data : [];
          setAuditEntries(rows);
          setAuditPage(1);
          setAuditTotal(meta?.total ?? rows.length);
          setAuditHasMore(meta?.has_next ?? (rows.length >= AUDIT_PAGE_SIZE));
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, project?.id]);

  // ── Load Forma 2 iterations ──────────────────────────────────────
  // Powers the iteration tab strip + the isFrozenView gate that puts
  // every quantity input into read-only mode when the user is browsing
  // a frozen iteration. Reloads on iterRefreshTick so a successful
  // freeze (handleSaveSnapshot below) immediately surfaces the new
  // open iter without a full page reload.
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    constructionService.listForm2Iterations(project.id)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setIterations(list);
        const openOne = list.find((it) => it.status === 'open');
        const fallback = list[list.length - 1];
        setActiveIterationId((cur) => {
          if (cur && list.some((it) => it.id === cur)) return cur;
          return (openOne || fallback)?.id ?? null;
        });
      })
      .catch(() => { /* iterations are non-blocking — page still renders */ });
    return () => { cancelled = true; };
  }, [project?.id, iterRefreshTick]);

  const activeIteration = useMemo(
    () => iterations.find((it) => it.id === activeIterationId) || null,
    [iterations, activeIterationId],
  );
  const isFrozenView = activeIteration ? activeIteration.status === 'frozen' : false;

  // The deletable Forma 2 is the current OPEN (joriy) one — deleting it
  // re-opens the frozen iteration before it (see handleDeleteIteration). That
  // is only possible when there's a frozen predecessor to roll back into.
  const hasFrozenIteration = useMemo(
    () => iterations.some((it) => it.status === 'frozen'),
    [iterations],
  );

  // ── Load per-line period_fakt for the active iteration ───────────
  // Same fetch StagesTabV2 does — keeps the Smeta boshqaruvi FAKT
  // input showing this iteration's contribution so a fresh iter
  // reads 0 across the board.
  useEffect(() => {
    if (!project?.id || !activeIterationId) {
      setPeriodFaktByLine(new Map());
      return;
    }
    let cancelled = false;
    constructionService.getForm2IterationLines(project.id, activeIterationId)
      .then((rows) => {
        if (cancelled) return;
        const m = new Map();
        for (const r of (Array.isArray(rows) ? rows : [])) {
          m.set(Number(r.estimate_line_id), Number(r.period_fakt || 0));
        }
        setPeriodFaktByLine(m);
      })
      .catch(() => { /* default to zeros when the endpoint is unavailable */ });
    return () => { cancelled = true; };
  }, [project?.id, activeIterationId, iterRefreshTick]);

  // ── Snapshot save / delete ───────────────────────────────────────
  // Same loop hazard as loadSnapshots/loadAudit: depending on `t` (which
  // changes identity every render) would re-create these handlers each
  // render. They're passed down to memo'd children, so a new identity
  // would defeat the memoisation and trigger renders of those subtrees.
  const handleSaveSnapshot = useCallback(async (payload) => {
    if (!estimateId) return;
    try {
      // Multi-iteration model (migration 419): "Forma 2 ni yaratish" now
      // does the FULL freeze — write a construction_form2_snapshot row
      // AND flip the open iteration to 'frozen' AND open the next
      // iteration with period_fakt = 0 on every line. The snapshot side
      // is still visible in Formalar tarixi exactly as before, but the
      // iteration tab strip on Bosqichlar now also shows the new entry,
      // and any period_fakt input the foreman fills in goes into the new
      // open iter instead of compounding into the previous Forma 2.
      // Falls back to project_id via estimate (the iteration endpoint
      // resolves its own estimate when caller pins one).
      await constructionService.createForm2Iteration(
        project?.id,
        { ...payload, estimate_id: estimateId },
      );
      toast.success(t('snapshot_saved') || 'Forma 2 saqlandi');
      // If the user is currently viewing the History tab refresh the list.
      if (page === 'history') loadSnapshots(project?.id);
      // Bump the iteration strip so the new open iter shows up and the
      // frozen one moves out of "joriy" without a full page reload.
      setIterRefreshTick((n) => n + 1);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, page, project?.id]);

  const handleDeleteSnapshot = useCallback((snap) => {
    if (!snap?.id) return;
    setConfirmModal({
      tone: 'red',
      title: t('delete_confirm_title') || "O'chirish",
      body: t('snapshot_delete_confirm') || "Saqlangan Forma 2 ni o'chirilsinmi?",
      confirmLabel: t('delete') || "O'chirish",
      onConfirm: async () => {
        try {
          await constructionService.deleteForm2Snapshot(snap.id);
          toast.success(t('deleted') || "O'chirildi");
          loadSnapshots(project?.id);
        } catch (e) {
          toast.error(formatApiError(e, t, 'Xatolik'));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Delete the current OPEN (joriy) Forma 2. The backend removes it and
  // re-opens the frozen iteration before it (dropping that one's snapshot),
  // so the strip rolls back one step. Refreshes the iteration strip and the
  // history list; the now-reopened predecessor becomes the active tab.
  const handleDeleteIteration = useCallback((iter) => {
    if (!iter?.id || !project?.id) return;
    setConfirmModal({
      tone: 'red',
      title: t('forma2_delete_title') || "Joriy Forma 2 ni o'chirish",
      body: t('forma2_delete_confirm')
        || "Joriy Forma 2 o'chiriladi va oldingisi muzlatishdan chiqariladi (qayta tahrirlash mumkin bo'ladi). Davom etilsinmi?",
      confirmLabel: t('delete') || "O'chirish",
      onConfirm: async () => {
        try {
          const res = await constructionService.deleteForm2Iteration(project.id, iter.id);
          toast.success(t('forma2_deleted') || "Forma 2 o'chirildi");
          if (res?.reopened_iteration_id) setActiveIterationId(res.reopened_iteration_id);
          setIterRefreshTick((n) => n + 1);
          if (page === 'history') loadSnapshots(project?.id);
        } catch (e) {
          toast.error(formatApiError(e, t, 'Xatolik'));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, page]);

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
    // Two distinct sub-line populations live under the same parent and
    // both render off this array — but in very different surfaces:
    //
    //   1. Sub-stages (isSubStageRow → resource_type='' AND norm_rate=0).
    //      These render as their own WorkCard rows BELOW the parent. We
    //      keep them in the unified "manuals at top → item_number ASC"
    //      order so a freshly-added sub-stage floats to the top and the
    //      imported ones follow file-page numbering.
    //
    //   2. Resource sub-lines (everything else). These render INSIDE the
    //      parent WorkCard's resource table. The user wants them grouped
    //      by category in a fixed display order — Material → Mashina →
    //      Mehnat — regardless of creation time. The screenshot symptom
    //      was that a newly added MASHINA line landed above the existing
    //      MATERIAL ones because the manual-first sort prioritised
    //      "newest" over "right bucket"; people read the resource table
    //      top-to-bottom expecting all materials first, then equipment,
    //      then labor.
    //
    // Sort order in the merged array:
    //   sub-stages (manual-first / item_number) — first
    //   resources, category bucket asc — Mehnat (labor) → Mashina →
    //     Material. The user's previous request was material→mashina→
    //     mehnat; they've since flipped the preference because resource
    //     tables in their workflow read top-to-bottom as workers first
    //     (labor hours decide the schedule), then equipment, then the
    //     materials those workers will install.
    //     Within each bucket: manuals first, then file order (id ASC).
    const catRank = (rt) => {
      const c = classifyResource(rt);
      if (c === 'labor')    return 0;
      if (c === 'machines') return 1;
      return 2; // materials
    };
    const naturalKey = (s) => String(s || '').trim();
    const isManualResource = (ln) =>
      ln?.is_manual === true || !naturalKey(ln?.item_number);
    for (const arr of m.values()) {
      // Split, sort each bucket with its own rule, recombine in place.
      const stages = arr.filter(isSubStageRow);
      const resources = arr.filter((s) => !isSubStageRow(s));
      sortLinesManualFirstInPlace(stages);
      resources.sort((a, b) => {
        const ra = catRank(a.resource_type);
        const rb = catRank(b.resource_type);
        if (ra !== rb) return ra - rb;
        // Same category — manual-added first (so a freshly added
        // resource lands at the top of its bucket where the user is
        // looking), then file-order (lower id = imported earlier).
        const aM = isManualResource(a);
        const bM = isManualResource(b);
        if (aM !== bM) return aM ? -1 : 1;
        return Number(a.id || 0) - Number(b.id || 0);
      });
      arr.length = 0;
      arr.push(...stages, ...resources);
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
    // Include manually-created sections (construction_stages rows) so the
    // user can filter by an empty section they just added — without this,
    // a brand-new section would only appear in the main list but be
    // absent from the dropdown.
    for (const name of manualSectionNames) {
      if (name) set.add(name);
    }
    return Array.from(set);
  }, [lines, t, manualSectionNames]);

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

  // Server-computed stat-card aggregates — the same numbers as `kpis` /
  // `resourceCount` but produced in SQL (see GetEstimateSummary), so a
  // client doesn't have to hold the whole estimate in memory. Summed across
  // the block's estimate ids. Falls back to the local kpis until it arrives
  // (or if the endpoint is unavailable), so the web app is never blocked.
  const [serverKpis, setServerKpis] = useState(null);
  useEffect(() => {
    if (activeEstimateIds.length === 0) { setServerKpis(null); return undefined; }
    let cancelled = false;
    Promise.all(activeEstimateIds.map((id) =>
      constructionService.getEstimateSummary(id).catch(() => null)))
      .then((rows) => {
        if (cancelled) return;
        const ok = rows.filter(Boolean);
        if (ok.length === 0) { setServerKpis(null); return; }
        setServerKpis(ok.reduce((a, r) => ({
          labor: a.labor + (Number(r.labor) || 0),
          machines: a.machines + (Number(r.machines) || 0),
          materials: a.materials + (Number(r.materials) || 0),
          grand: a.grand + (Number(r.grand) || 0),
          filled: a.filled + (Number(r.filled_count) || 0),
          total: a.total + (Number(r.work_count) || 0),
          resourceCount: a.resourceCount + (Number(r.resource_count) || 0),
        }), { labor: 0, machines: 0, materials: 0, grand: 0, filled: 0, total: 0, resourceCount: 0 }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEstimateIds]);

  // Stat cards prefer the server summary; everything falls back to the local
  // computation so behaviour is unchanged when the endpoint hasn't loaded.
  const displayKpis = serverKpis || kpis;
  const displayResourceCount = serverKpis ? serverKpis.resourceCount : resourceCount;

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

    // Names that have at least one imported estimate line — i.e. they
    // belong to the imported file's natural ordering and should NOT
    // float to the top.
    const linesSectionNames = new Set();
    for (const ln of lines) {
      const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
      if (isSub) continue;
      const k = ln.parent_item_number || (t('uncategorized') || 'Boshqalar');
      if (k) linesSectionNames.add(k);
    }

    const sectionMap = new Map();
    // Names of the manually-added sections we pin at the top. Captured
    // here so the post-loop sort can leave them alone (newest-first
    // manual at the top) and only sort the IMPORTED sections by their
    // lines' item_number.
    const manualPinnedNames = new Set();

    // Pre-seed with TOP-LEVEL sections the user explicitly added via
    // "+ Bo'lim qo'shish" (tracked by id in localStorage). Sorted by id
    // DESC so the newest addition lands at the very top. This is the
    // persistent equivalent of "what I just created" — it survives
    // page reloads and isn't fooled by auto-import stages from other
    // єдинич imports of the same block (which would otherwise appear
    // in extras and outrank the user's own additions in a naive
    // id-DESC sort).
    //
    // Multi-level paths ("PARENT › CHILD") are skipped here; those
    // attach as subSections on their parent further down. Imported
    // sections (the bulk of the list) are NOT in this pass — they get
    // added by the imported-lines loop below in natural file order.
    const DELIM_PRE = ' › ';
    const userAddedSet = new Set(recentlyAddedSectionIds.map(Number));
    const userAddedTop = [...manualSectionRows]
      .filter((s) => {
        const name = String(s.name || '').trim();
        if (!name) return false;
        if (name.includes(DELIM_PRE)) return false;
        return userAddedSet.has(Number(s.id));
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    for (const s of userAddedTop) {
      const name = String(s.name || '').trim();
      if (sectionFilter && sectionFilter !== name) continue;
      if (search) {
        if (!name.toLowerCase().includes(search.toLowerCase())) continue;
      }
      sectionMap.set(name, { name, lines: [], total: 0, is_empty_manual: true });
      manualPinnedNames.add(name);
    }

    for (const ln of lines) {
      const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
      if (isSub) continue;
      const secKey = ln.parent_item_number || (t('uncategorized') || 'Boshqalar');
      if (sectionFilter && secKey !== sectionFilter && !secKey.startsWith(`${sectionFilter} › `)) continue;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${ln.code || ''} ${ln.item_number || ''} ${ln.name || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      // Nested section paths ("PARENT › CHILD" or deeper) — park the
      // line on its parent's subSection bucket so it renders nested
      // inside the parent card instead of materialising as a sibling
      // top-level section. Previously the secKey was used verbatim,
      // which caused e.g. "Topshirish › topshirish 1-bosqich" to show
      // up as its own section header right next to "Topshirish".
      //
      // Split at the FIRST delimiter so the top-level is always the
      // leading segment. For deeper paths like "СЕКЦИЯ №1 › РАБОТЫ › 123"
      // the sub-section keeps the remaining segments as its display
      // name ("РАБОТЫ › 123") — flat one-level nesting but the parent
      // hierarchy still reads correctly.
      if (secKey.includes(' › ')) {
        const firstIdx = secKey.indexOf(' › ');
        const parentName = secKey.slice(0, firstIdx);
        const childName  = secKey.slice(firstIdx + 3);
        const par = sectionMap.get(parentName) || { name: parentName, lines: [], total: 0 };
        if (!par.subSections) par.subSections = [];
        let sub = par.subSections.find((s) => s.fullName === secKey);
        if (!sub) {
          sub = { name: childName, fullName: secKey, lines: [], total: 0 };
          par.subSections.push(sub);
        } else {
          // A previously-seeded empty manual sub-section gets repurposed
          // here — drop the "I'm an empty placeholder" flag now that real
          // lines are attached.
          delete sub.is_empty_manual;
        }
        sub.lines.push(ln);
        const eff = effByParent.get(Number(ln.id));
        const amt = eff != null ? eff : (Number(ln.total_amount) || 0);
        sub.total += amt;
        par.total += amt; // roll the sub-section's spend up into the parent header
        sectionMap.set(parentName, par);
        continue;
      }

      const cur = sectionMap.get(secKey) || { name: secKey, lines: [], total: 0 };
      cur.lines.push(ln);
      const eff = effByParent.get(Number(ln.id));
      cur.total += eff != null ? eff : (Number(ln.total_amount) || 0);
      sectionMap.set(secKey, cur);
    }

    // Attach manually-created SUB-sections ("PARENT › CHILD") onto their
    // parents as subSections[]. Top-level manual sections were already
    // pre-seeded into sectionMap above (before the imported-lines pass)
    // so they sort first in the rendered list. Here we only handle the
    // hierarchical ones — those whose name contains " › ". We split at
    // the FIRST delimiter so the parent is always the leading segment
    // (matches the lines-iteration rule above). Deeper paths keep their
    // remaining segments as the sub-section display name. Filter
    // targeting matches the parent OR the full nested name so the
    // section dropdown still surfaces children correctly.
    const DELIM = ' › ';
    const sortedManual = [...manualSectionNames].sort((a, b) =>
      String(a).length - String(b).length,
    );
    for (const name of sortedManual) {
      if (!name) continue;
      if (!name.includes(DELIM)) continue; // top-level handled above
      if (sectionMap.has(name)) continue;
      const firstIdx = name.indexOf(DELIM);
      const parent = name.slice(0, firstIdx);
      const child  = name.slice(firstIdx + DELIM.length);
      if (!sectionMap.has(parent)) continue;
      if (sectionFilter && sectionFilter !== parent && sectionFilter !== name) continue;
      if (search) {
        const q = search.toLowerCase();
        if (!name.toLowerCase().includes(q) && !child.toLowerCase().includes(q)) continue;
      }
      const par = sectionMap.get(parent);
      if (!par.subSections) par.subSections = [];
      // Skip if the work-line iteration above already created this sub-section
      // bucket (i.e. real lines live under "PARENT › CHILD") — pushing again
      // would render a duplicate empty placeholder card right next to it.
      if (par.subSections.some((s) => s.fullName === name)) continue;
      par.subSections.push({
        name: child,
        fullName: name,
        lines: [],
        total: 0,
        is_empty_manual: true,
      });
    }
    // Final ordering: manually-added (pinned) sections in insertion
    // order (newest first, as pre-seeded above) followed by imported
    // sections sorted by their min numeric item_number. Imported
    // sections without a numeric leading row land at the end, in
    // alphabetical order of section name to stay stable.
    //
    // Without this sort the imported sections came out in backend
    // sort_order order — which left ФУНДАМЕНТЫ (rows 8–48) ahead of
    // ЗЕМЛЯННЫЕ РАБОТЫ (rows 1–7) because that's how they landed in
    // the file. Sorting by item_number makes the section order follow
    // the printed smeta page numbering the user expects.
    const allSections = Array.from(sectionMap.values());
    const pinned = [];
    const imported = [];
    // Top-level "manual" detection — mirrors isManualSubData below so the
    // same rule applies to whole sections, not just sub-sections.
    //
    //   1. Explicitly pre-seeded via localStorage (manualPinnedNames) —
    //      this is the strongest signal and covers the "I just clicked
    //      + Bo'lim qo'shish" case on the active device.
    //   2. EVERY line under the section (direct + sub-section lines) is
    //      flagged is_manual = TRUE (migration 417). This catches sections
    //      the user built up entirely through "+ Ish" / clone-by-code /
    //      "+ Qo'shimcha resurs" — even on a different device where the
    //      localStorage marker was never recorded. ЗЕМЛЯННЫЕ РАБОТЫ on
    //      project 21 is the motivating case: the section header and all
    //      its works were added manually, but the manual-id marker only
    //      lives in the original device's localStorage so the localStorage
    //      check missed it and it slid to the bottom of the imported
    //      bucket.
    //
    // Strict "every line" — one imported line anchors the section to the
    // file and it stays in the imported bucket. Empty sections (no lines
    // at all) are treated as manual too: the only way they exist in
    // sectionMap is via the user-added pre-seed step above, which already
    // covers the manualPinnedNames path.
    const isManualTopSection = (sec) => {
      if (manualPinnedNames.has(sec.name)) return true;
      const direct = sec.lines || [];
      const subLines = (sec.subSections || []).flatMap((s) => s.lines || []);
      const all = [...direct, ...subLines];
      if (all.length === 0) return true;
      return all.every((ln) => ln.is_manual === true);
    };
    for (const sec of allSections) {
      if (isManualTopSection(sec)) pinned.push(sec);
      else imported.push(sec);
    }
    // Stable order within the pinned bucket: explicitly user-added sections
    // (manualPinnedNames) keep their newest-first order from the pre-seed
    // pass above; sections promoted to pinned by the all-lines-manual
    // heuristic fall in after them, also newest-first using the lowest
    // line id as a proxy (the section that contains the most recently
    // created lines lands at the top).
    if (pinned.length > 1) {
      const lowestLineId = (sec) => {
        let min = Infinity;
        for (const ln of (sec.lines || [])) {
          const id = Number(ln.id);
          if (Number.isFinite(id) && id < min) min = id;
        }
        for (const sub of (sec.subSections || [])) {
          for (const ln of (sub.lines || [])) {
            const id = Number(ln.id);
            if (Number.isFinite(id) && id < min) min = id;
          }
        }
        return min;
      };
      pinned.sort((a, b) => {
        const aPre = manualPinnedNames.has(a.name);
        const bPre = manualPinnedNames.has(b.name);
        if (aPre !== bPre) return aPre ? -1 : 1;
        // Within each pinning source, newest first — higher ids = more
        // recently created.
        return lowestLineId(b) - lowestLineId(a);
      });
    }
    // No re-sort for imported top-level sections — they stay in
    // the order the import wrote them, which mirrors the printed
    // page numbering by construction (lines are pushed in
    // file-row order). Re-sorting was misclassifying mixed
    // structures; the user's requirement is "manuals at top,
    // imports unchanged".
    const minItemNum = (sec) => {
      let min = Infinity;
      for (const ln of (sec.lines || [])) {
        const raw = String(ln.item_number || '').trim();
        const m = raw.match(/^\d+(?:\.\d+)?/);
        if (m) {
          const n = Number(m[0]);
          if (Number.isFinite(n) && n < min) min = n;
        }
      }
      return min;
    };

    // Insertion-order fallback. Some imported sections (notably ones that
    // pre-date row-numbered exports — e.g. ЗЕМЛЯННЫЕ РАБОТЫ in older Yuksalish
    // projects) come in with NULL/empty item_numbers on every line, so
    // minItemNum returns Infinity and they slide to the very bottom of the
    // imported bucket — past sections numbered 800+. The lines' DB ids still
    // reflect the order rows were inserted during import, so the lowest id
    // among a section's lines is a reliable proxy for "this section's first
    // row in the file." Used only when no numeric item_number exists, so it
    // never overrides the proper file-page sort when one is present.
    const minLineId = (sec) => {
      let min = Infinity;
      for (const ln of (sec.lines || [])) {
        const id = Number(ln.id);
        if (Number.isFinite(id) && id < min) min = id;
      }
      for (const sub of (sec.subSections || [])) {
        for (const ln of (sub.lines || [])) {
          const id = Number(ln.id);
          if (Number.isFinite(id) && id < min) min = id;
        }
      }
      return min;
    };
    // Also sort each section's sub-sections so manually-added ones
    // pin to the top (newest first) and imported sub-sections sort by
    // their min item_number. Without the manual-pin step, an empty
    // user-added sub-section (no item_number → Infinity sort key)
    // landed at the end of its parent's content — past every imported
    // row — which is the opposite of what the user expects when they
    // create a sub-stage and want to see it right away.
    // Strict manual-detection — see render-side isManualSub for the
    // reasoning. We never resort imported sub-sections by item_number
    // any more: the user wants imported order preserved exactly as
    // the file dictates, and the heuristic was misclassifying
    // imported єдинич works as manual when they lacked numeric
    // item_numbers.
    const recentlyAddedSet = new Set(
      (recentlyAddedSectionIds || []).map(Number),
    );
    const nameToManualId = new Map();
    for (const ms of (manualSectionRows || [])) {
      const name = String(ms?.name || '').trim();
      if (name && ms?.id != null) {
        nameToManualId.set(name, Number(ms.id));
      }
    }
    const isManualSubData = (sub) => {
      const full = String(sub.fullName || '').trim();
      const mid = nameToManualId.get(full);
      if (mid != null && recentlyAddedSet.has(mid)) return true;
      if (sub.is_empty_manual) return true;
      const lines = sub.lines || [];
      if (lines.length === 0) return true;
      return lines.every((ln) => ln.is_manual === true);
    };
    // Top-level work ordering uses the shared helper — manuals at top,
    // imports by natural item_number ASC. Same rule subByParent now uses
    // for sub-lines, so the two never disagree.
    const sortTopLines = (arr) => { sortLinesManualFirstInPlace(arr); };
    for (const sec of [...pinned, ...imported]) {
      sortTopLines(sec.lines);
      if (Array.isArray(sec.subSections) && sec.subSections.length > 0) {
        for (const sub of sec.subSections) sortTopLines(sub.lines);
      }
      if (Array.isArray(sec.subSections) && sec.subSections.length > 1) {
        // Two-bucket sort:
        //   1) Manual sub-sections (user-added) pin to the top.
        //   2) Imported sub-sections sort by their MIN item_number
        //      so the printed-page numbering is respected. The user
        //      reported "ZRP rows 1-7 are showing AFTER ФУНДАМЕНТЫ
        //      rows 8-47, fix this" — root cause was that sub-section
        //      order was driven by the lines-array iteration (which
        //      follows backend sort_order), but the original smeta
        //      file had ZRP's items numbered before ФУНДАМЕНТЫ's, so
        //      ZRP needs to come first. Sorting on min(item_number)
        //      matches the printed file order regardless of how the
        //      import wrote sort_order.
        const manualOnes = [];
        const importedOnes = [];
        for (const sub of sec.subSections) {
          if (isManualSubData(sub)) manualOnes.push(sub);
          else importedOnes.push(sub);
        }
        importedOnes.sort((a, b) => {
          const ka = minItemNum(a);
          const kb = minItemNum(b);
          if (ka !== kb) return ka - kb;
          return 0;
        });
        sec.subSections = [...manualOnes, ...importedOnes];
      }
    }
    // Sort TOP-LEVEL imported sections by the order their first row was
    // inserted during import (min line id). This is the most reliable
    // "import file order" signal:
    //
    //   • Bulk imports INSERT row-by-row in file order, so within a single
    //     import batch the lowest id in a section = the file row where
    //     that section started. Two sections from the same import sort
    //     in printed-page order automatically.
    //   • Sections whose lines have NULL/empty item_numbers (older Yuksalish
    //     exports — notably ЗЕМЛЯННЫЕ РАБОТЫ on project 21) used to fall to
    //     the very bottom because the item_number-based comparator returned
    //     Infinity. They now sort by id like everything else and end up at
    //     the position they actually occupy in the source file.
    //
    // item_number stays as a tiebreaker for the rare case where two
    // sections share the same min id (effectively never, but it costs
    // nothing and keeps the printed-page heuristic from earlier patches
    // intact for any future format that posts item_numbers without
    // monotonic ids).
    if (imported.length > 1) {
      imported.sort((a, b) => {
        const ida = minLineId(a);
        const idb = minLineId(b);
        if (ida !== idb) return ida - idb;
        const ka = (() => {
          let m = minItemNum(a);
          for (const sub of (a.subSections || [])) {
            const s = minItemNum(sub);
            if (s < m) m = s;
          }
          return m;
        })();
        const kb = (() => {
          let m = minItemNum(b);
          for (const sub of (b.subSections || [])) {
            const s = minItemNum(sub);
            if (s < m) m = s;
          }
          return m;
        })();
        if (ka !== kb) return ka - kb;
        return 0;
      });
    }
    return [...pinned, ...imported];
  }, [lines, search, sectionFilter, t, manualSectionNames, manualSectionRows, recentlyAddedSectionIds]);

  // Flatten every work (parent line) into render order so the window can
  // count works across sections. Mirrors the per-section interleave the
  // render uses (top-level lines + sub-section lines, ordered by the lead
  // number of item_number). Resources/sub-stage child rows are NOT counted
  // here — they belong to a work and render inside its card.
  const orderedWorkIds = useMemo(() => {
    const lead = (raw) => {
      const m = String(raw || '').trim().match(/^\d+(?:\.\d+)?/);
      return m ? Number(m[0]) : Infinity;
    };
    const ids = [];
    for (const sec of sections) {
      const entries = [];
      for (const ln of (sec.lines || [])) entries.push({ k: lead(ln.item_number), kind: 'line', ln });
      for (const sub of (sec.subSections || [])) {
        let min = Infinity;
        for (const s of (sub.lines || [])) { const n = lead(s.item_number); if (n < min) min = n; }
        entries.push({ k: min, kind: 'sub', sub });
      }
      entries.sort((a, b) => a.k - b.k);
      for (const e of entries) {
        if (e.kind === 'line') ids.push(Number(e.ln.id));
        else for (const s of (e.sub.lines || [])) ids.push(Number(s.id));
      }
    }
    return ids;
  }, [sections]);

  const totalWorks = orderedWorkIds.length;
  // The set of work ids currently allowed to paint. Everything outside it
  // is withheld until the user scrolls. Resources of a visible work always
  // render with it (they aren't in this set — they're WorkCard children).
  const visibleWorkIds = useMemo(
    () => new Set(orderedWorkIds.slice(0, visibleWorkCount)),
    [orderedWorkIds, visibleWorkCount],
  );

  // Reset the window whenever the view's context changes (block switch,
  // search, or section filter) so we don't keep a huge window afterwards.
  useEffect(() => {
    setVisibleWorkCount(WORKS_PER_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, search, sectionFilter]);

  // Grow the window as the bottom sentinel scrolls into view. Observing a
  // ref (vs. a scroll listener) keeps it cheap and works inside whatever
  // scroll container the page sits in.
  useEffect(() => {
    if (page !== 'works') return undefined;
    const el = loadMoreRef.current;
    if (!el) return undefined;
    if (visibleWorkCount >= totalWorks) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleWorkCount((n) => Math.min(n + WORKS_PER_PAGE, totalWorks));
      }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalWorks, visibleWorkCount]);

  // ── Mutations ─────────────────────────────────────────────────────
  // Each line carries its own line.estimate_id, so we route mutations
  // there rather than to the state's `estimateId`. That way edits work
  // even when a block has multiple Единич smetas and the user is editing
  // a row that belongs to one of the older versions in the concatenated
  // list. We fall back to estimateId when line.estimate_id is missing.
  const lineEst = (line) => Number(line.estimate_id || estimateId || 0);

  const commitQty = useCallback(async (line, raw) => {
    if (isFrozenView) {
      // Frozen iteration (migration 419) — quantity edits are blocked
      // server-side too (UpdateEstimateLine on a non-draft estimate, plus
      // the period_fakt write path only targets the open iter), but
      // short-circuiting here avoids a confusing toast cascade.
      toast.error(t('forma2_frozen_readonly') || 'Bu Forma 2 muzlatilgan');
      return;
    }
    const newQty = parseNum(raw);
    // For TOP-LEVEL work rows (no parent) the FAKT input now represents
    // this iteration's period contribution — same semantics as the
    // BAJARILDI input on Bosqichlar. Route the write through
    // updateWorkDoneQuantity so:
    //   • the server writes period_fakt for the open iter and
    //     recomputes done_quantity = Σ period_fakt
    //   • the parent-row mirror updates `quantity` (so other readers
    //     that still look at quantity stay consistent)
    //   • Bosqichlar's BAJARILDI input picks up the same number — the
    //     user's bidirectional sync question is answered "yes" because
    //     both pages now flow through the same write path.
    // Sub-line rows (resources / sub-stages with parent_line_id > 0)
    // keep using updateEstimateLine because their FAKT is the plan
    // override (quantity_override), not period contribution.
    const isParent = !line.parent_line_id || Number(line.parent_line_id) === 0;
    if (isParent) {
      const prevPeriod = Number(periodFaktByLine.get(Number(line.id)) || 0);
      if (Math.abs(newQty - prevPeriod) < 0.0001) return;
      try {
        await constructionService.updateWorkDoneQuantity(line.id, newQty);
        const prevCumulative = Number(line.quantity || 0);
        const newCumulative = prevCumulative - prevPeriod + newQty;
        setLines((rows) => rows.map((r) => {
          if (r.id === line.id) {
            return {
              ...r,
              quantity: newCumulative,
              done_quantity: newCumulative,
              total_amount: Number(r.unit_rate || 0) * newCumulative,
            };
          }
          if (Number(r.parent_line_id) === Number(line.id) && !r.quantity_override) {
            const norm = Number(r.norm_rate || 0);
            const childQty = newCumulative * norm;
            return {
              ...r,
              quantity: childQty,
              total_amount: childQty * Number(r.unit_rate || 0),
            };
          }
          return r;
        }));
        setPeriodFaktByLine((m) => {
          const n = new Map(m);
          n.set(Number(line.id), newQty);
          return n;
        });
        toast.success(t('saved') || 'Saqlandi');
        loadLines(activeEstimateIds, { force: true });
      } catch (e) {
        toast.error(formatApiError(e, t, 'Xatolik'));
        loadLines(activeEstimateIds, { force: true });
      }
      return;
    }
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
      loadLines(activeEstimateIds, { force: true });
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      loadLines(activeEstimateIds, { force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, activeEstimateIds, loadLines, t, isFrozenView, periodFaktByLine]);

  const resetQty = useCallback(async (line) => {
    try {
      await constructionService.resetLineQuantity(lineEst(line), line.id);
      toast.success(t('reset_qty_done') || "Hajm asl qiymatga qaytarildi");
      loadLines(activeEstimateIds, { force: true });
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, activeEstimateIds, loadLines, t]);

  const removeLine = useCallback((line) => {
    // Replaces window.confirm with the in-app SmetaConfirmModal so the
    // dialog uses our translation keys and matches the rest of the UI.
    setConfirmModal({
      tone: 'red',
      title: t('delete_confirm_title') || "O'chirish",
      body: t('confirm_delete_subline')
        || "Ushbu resurs / etapni o'chirishni tasdiqlaysizmi?",
      confirmLabel: t('delete') || "O'chirish",
      onConfirm: async () => {
        try {
          await constructionService.deleteEstimateLine(lineEst(line), line.id);
          setLines((rows) => rows.filter(
            (r) => r.id !== line.id && Number(r.parent_line_id) !== Number(line.id),
          ));
          toast.success(t('deleted') || "O'chirildi");
        } catch (e) {
          toast.error(formatApiError(e, t, 'Xatolik'));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, t]);

  // Cascade-delete an entire section (or sub-section) by name. Removes:
  //   • All estimate lines whose parent_item_number === sectionName,
  //     and any nested ones starting with `${sectionName} › `, plus
  //     their sub-lines (sub-line parents fall under the same delete
  //     loop because deleteEstimateLine on a parent typically cascades
  //     server-side, but we filter sub-lines out of the iteration so
  //     we don't double-delete).
  //   • The construction_stages row(s) whose name === sectionName or
  //     starts with `${sectionName} › ` (if any). Failures here are
  //     swallowed because the row may not exist (purely-imported
  //     section that never got a stage row).
  // Triggered from the trash icon on each section header.
  const removeSection = useCallback(async (sectionName) => {
    if (!sectionName) return;
    const matchingLines = lines.filter((ln) => {
      const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
      if (isSub) return false; // sub-lines cascade with their parent
      const pin = String(ln.parent_item_number || '');
      return pin === sectionName || pin.startsWith(`${sectionName} › `);
    });
    const matchingStages = manualSectionRows.filter((s) => {
      const n = String(s.name || '');
      return n === sectionName || n.startsWith(`${sectionName} › `);
    });
    setConfirmModal({
      tone: 'red',
      title: t('delete_section') || "Bo'limni o'chirish",
      body: (t('confirm_delete_section_body')
        || "\"{section}\" bo'limini va undagi {n} ta ishni o'chirmoqchimisiz?\n\nBu amalni qaytarib bo'lmaydi.")
        .replace('{section}', sectionName)
        .replace('{n}', String(matchingLines.length)),
      confirmLabel: t('delete') || "O'chirish",
      onConfirm: async () => {
        try {
          // Delete lines first so the section disappears from the
          // derived list even if the construction_stages cleanup below
          // fails. Individual failures are caught so a partial cleanup
          // still proceeds.
          for (const ln of matchingLines) {
            try {
              await constructionService.deleteEstimateLine(lineEst(ln), ln.id);
            } catch (e) {
              console.error('Failed to delete line', ln.id, e);
            }
          }
          const deletedIds = new Set();
          for (const s of matchingStages) {
            try {
              await constructionService.deleteStage(s.id);
              deletedIds.add(Number(s.id));
            } catch {
              /* row may have been deleted server-side already; ignore */
            }
          }
          // Prune the deleted IDs from the localStorage-tracked user-add
          // set so it doesn't accumulate stale references over time.
          if (deletedIds.size > 0) {
            setRecentlyAddedSectionIds((prev) => {
              const next = prev.filter((id) => !deletedIds.has(Number(id)));
              persistManualIds(next);
              return next;
            });
          }
          loadLines(activeEstimateIds, { force: true });
          setSectionRefreshTick((n) => n + 1);
          toast.success(t('deleted') || "O'chirildi");
        } catch (e) {
          toast.error(formatApiError(e, t, 'Xatolik'));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, manualSectionRows, activeEstimateIds, t]);

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
          loadLines(activeEstimateIds, { force: true });
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
      loadLines(activeEstimateIds, { force: true });
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
      loadLines(activeEstimateIds, { force: true });
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
          <div className="text-[13px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
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
              className="px-2.5 py-1 rounded text-[13px] font-medium flex items-center gap-1.5"
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
            className="px-2.5 py-1.5 rounded-md text-[13px] flex items-center gap-1.5"
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
          {/* Subcontractor filter — only when the block has subcontractor
              estimates. Empty value = project's own (in-house) estimate. */}
          {blockSubcontractors.length > 0 && (
            <select
              value={subFilter == null ? '' : String(subFilter)}
              onChange={(e) => setSubFilter(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 rounded-md text-xs outline-none cursor-pointer"
              style={{ background: C.inset, color: C.text, border: `1px solid ${C.border2}`, fontFamily: 'inherit', minWidth: 180 }}
              title={({ uz: 'Subpudratchi', ru: 'Субподрядчик', en: 'Subcontractor' })[language] || 'Subpudratchi'}
            >
              <option value="" style={{ background: C.card, color: C.text }}>
                {({ uz: 'Loyiha smetasi', ru: 'Смета проекта', en: 'Project estimate' })[language] || 'Loyiha smetasi'}
              </option>
              {blockSubcontractors.map((s) => (
                <option key={s.id} value={s.id} style={{ background: C.card, color: C.text }}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => loadLines(activeEstimateIds, { force: true })}
            disabled={activeEstimateIds.length === 0 || loadingLines}
            className="px-3 py-2 rounded-md text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border2}` }}
          >
            {loadingLines ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t('refresh') || 'Yangilash'}
          </button>
          {/* "+ Bo'lim qo'shish" — promoted from the toolbar to the topbar
             so it sits alongside the other primary actions (Forma 2 /
             Material yig'indisi). Same teal accent as the toolbar
             version, same modal flow on click. Visible to anyone with
             access to the Smeta boshqaruvi tab — the canBulkAdmin gate
             used to live here but was dropped per user request so
             project managers / supervisors / engineers can structure
             their own smeta without admin intervention. Backend still
             enforces tenant + project permissions on createStage. */}
          <button
            onClick={() => setAddSectionModal({ name: '' })}
            className="px-3.5 py-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition"
            style={{ background: C.sec, color: C.teal, border: '1px solid rgba(13,148,136,0.3)' }}
            title={t('add_section_hint') || "Yangi bo'lim qo'shish"}
          >
            <span className="text-[15px] leading-none font-bold">+</span>
            {t('add_section') || "Bo'lim qo'shish"}
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
          { key: 'resources', icon: Boxes,       label: t('inner_tab_resources') || 'Resurslar',           count: displayResourceCount },
          { key: 'history',   icon: HistoryIcon, label: t('inner_tab_history')   || 'Formalar tarixi',     count: snapshots.length },
          { key: 'audit',     icon: Activity,    label: t('inner_tab_audit')     || "O'zgarishlar jurnali", count: auditTotal },
        ].map((tab) => {
          const active = page === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setPage(tab.key)}
              className="px-5 py-3 text-[15px] font-medium flex items-center gap-2 transition"
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
                  className="text-[12px] font-mono px-1.5 py-0.5 rounded"
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
          {/* FORMA 2 ITERATION STRIP (migration 419) — same data the
              Bosqichlar tab shows. Selecting a frozen tab disables
              quantity edits (via isFrozenView in commitQty). "+ Forma 2
              ni yaratish" still lives in the topbar above and advances
              this strip on Save. */}
          {iterations.length > 0 && (
            <div className="px-8 pt-6">
              <div
                className="rounded-xl p-4"
                style={{ background: C.card, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    📄 {t('forma2_series') || 'Forma 2 iteratsiyalari'}
                  </h2>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {iterations.map((it) => {
                    const active = activeIterationId === it.id;
                    const isOpen = it.status === 'open';
                    // Only the current (joriy) Forma 2 is deletable — and only
                    // when there's a frozen iteration before it to unfreeze,
                    // and the user has construction delete permission.
                    const canDeleteThis = canDeleteConstruction && isOpen && hasFrozenIteration;
                    return (
                      <div
                        key={it.id}
                        className="flex items-center rounded-lg overflow-hidden"
                        style={{ border: `1.5px solid ${active ? '#0F172A' : '#E5E7EB'}` }}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveIterationId(it.id)}
                          className="px-4 py-2 text-[15px] font-semibold flex items-center gap-2 transition"
                          style={{
                            background: active ? '#0F172A' : '#FFFFFF',
                            color: active ? '#FFFFFF' : '#64748B',
                          }}
                          title={isOpen
                            ? (t('forma2_open_editable') || 'Joriy iteratsiya — tahrirlash mumkin')
                            : (t('forma2_frozen_readonly') || 'Muzlatilgan — faqat ko\'rish')}
                        >
                          <span>📄 Forma 2 #{it.iteration_seq}</span>
                          <span
                            className="text-[12px] px-2 py-0.5 rounded-full font-bold"
                            style={{
                              background: active ? (isOpen ? '#047857' : '#64748B') : (isOpen ? '#D1FAE5' : '#E5E7EB'),
                              color:      active ? '#FFFFFF' : (isOpen ? '#047857' : '#64748B'),
                            }}
                          >
                            {isOpen ? (t('current_label') || 'joriy') : (t('frozen_label') || 'muzlatilgan')}
                          </span>
                        </button>
                        {canDeleteThis && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteIteration(it); }}
                            className="h-full px-2 py-2 flex items-center justify-center transition hover:bg-red-50"
                            style={{
                              background: active ? '#1E293B' : '#FFFFFF',
                              color: '#EF4444',
                              borderLeft: `1px solid ${active ? '#334155' : '#E5E7EB'}`,
                            }}
                            title={t('forma2_delete_title') || "Forma 2 ni o'chirish"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {isFrozenView && (
                  <div className="mt-3 px-3 py-2 rounded-md text-[14px] bg-amber-50 border border-amber-200 text-amber-800">
                    {t('forma2_frozen_notice') || "Bu Forma 2 muzlatilgan. Yangi fakt kiritish uchun joriy iteratsiyani tanlang."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="px-8 py-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <StatCard icon={Users} variant="labor"     label={t('labor_resources')       || 'Mehnat resurslari'}     value={displayKpis.labor} />
            <StatCard icon={Wrench} variant="mach"     label={t('construction_machines') || 'Qurilish mashinalari'}  value={displayKpis.machines} />
            <StatCard icon={Package} variant="mat"     label={t('material_resources')    || 'Material resurslar'}    value={displayKpis.materials} />
            <StatCard
              icon={Grid3x3} variant="grand" label={t('total') || 'JAMI'} value={displayKpis.grand}
              meta={
                <>
                  Hajm kiritilgan: <span style={{ color: C.teal, fontWeight: 600 }}>{displayKpis.filled}</span> / {displayKpis.total}
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-md text-[15px] outline-none"
                  style={{ background: C.inset, color: C.text, border: `1px solid ${C.border2}`, fontFamily: 'inherit' }}
                />
              </div>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-3 py-2.5 rounded-md text-[15px] outline-none cursor-pointer"
                style={{ background: C.inset, color: C.text, border: `1px solid ${C.border2}`, minWidth: 200 }}
              >
                <option value="">{t('section_all') || "Barcha bo'limlar"}</option>
                {availableSections.map((s) => (
                  <option key={s} value={s} style={{ background: C.card, color: C.text }}>{s}</option>
                ))}
              </select>
              {/* The "+ Bo'lim qo'shish" button has been moved up to the
                 sticky topbar (next to Forma 2 / Material yig'indisi) so
                 the affordance is more prominent. No duplicate here. */}
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
                // Skip painting a section until at least one of its works
                // is inside the scroll window. Full data still computes the
                // counts/totals above — this only defers DOM.
                const secHasVisible =
                  (sec.lines || []).some((l) => visibleWorkIds.has(Number(l.id)))
                  || (sec.subSections || []).some((sub) =>
                    (sub.lines || []).some((l) => visibleWorkIds.has(Number(l.id))));
                if (!secHasVisible) return null;
                const collapsed = !!collapsedSections[sec.name];
                return (
                  <div key={sec.name} className="mb-6">
                    {/* Section header — flex row instead of a single button
                       so the chevron toggle and the "+ Sub-bosqich" action
                       button can sit side by side without nesting buttons.
                       The clickable area for toggling the section now
                       excludes the trailing action area, so clicking the
                       "+" doesn't collapse the section underneath it. */}
                    <div
                      className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg mb-2"
                      style={{ background: C.sec, border: `1px solid ${C.border2}` }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.name)}
                        className="flex-1 flex items-center gap-2.5 text-left"
                      >
                        <ChevronDown
                          className="w-3.5 h-3.5 transition"
                          style={{
                            color: C.muted,
                            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
                          }}
                        />
                        <span className="flex-1 text-left font-semibold text-[15px] tracking-[0.02em]">{sec.name}</span>
                        <span
                          className="text-[13px] font-mono px-2 py-0.5 rounded"
                          style={{ background: C.inset, color: C.muted }}
                        >
                          {sec.lines.length} {t('works_count_suffix') || 'ish'}
                        </span>
                        <span className="text-[15px] font-mono font-semibold" style={{ color: C.amber }}>
                          {fmt(sec.total)} {t('currency_som') || "so'm"}
                        </span>
                      </button>
                      {/* Inline action cluster:
                            • "+ Ish"          — add a real work line.
                            • "+ Sub-bosqich"  — add a nested section
                              under this one (saved as "PARENT › CHILD").
                         Both visible to anyone with tab access; the
                         backend createEstimateLine / createStage
                         endpoints still validate project permissions. */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddWorkModal({ sectionName: sec.name, name: '', uom: '', code: '' });
                        }}
                        className="ml-1 px-2.5 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-1 transition"
                        style={{
                          background: 'rgba(13,148,136,0.1)', color: C.teal,
                          border: '1px solid rgba(13,148,136,0.3)',
                        }}
                        title={t('add_work') || "Ish qo'shish"}
                      >
                        <span className="text-[15px] leading-none font-bold">+</span>
                        {t('add_work_short') || "Ish"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!estimateId) {
                            toast.error(t('no_estimate_for_work')
                              || "Bu blok uchun єдинич smeta topilmadi");
                            return;
                          }
                          setAddSubBosqichSection(sec.name);
                        }}
                        className="ml-1 px-2.5 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-1 transition"
                        style={{
                          background: C.inset, color: C.muted,
                          border: `1px solid ${C.border2}`,
                        }}
                        title={t('add_substage') || "Sub-bosqich qo'shish"}
                      >
                        <span className="text-[15px] leading-none font-bold">+</span>
                        {t('substage_short') || "Sub-bosqich"}
                      </button>
                      {/* Section delete — cascades through every estimate
                         line and construction_stages row that lives under
                         this section name. Confirmation in removeSection
                         shows how many works are about to disappear.
                         Permission gated: only users with
                         `construction.delete` (or tenant admins/owners)
                         see the trash icon. */}
                      {canDeleteConstruction && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSection(sec.name);
                          }}
                          className="ml-1 p-1.5 rounded-md flex items-center justify-center transition"
                          style={{
                            background: 'rgba(220,38,38,0.06)', color: C.red,
                            border: '1px solid rgba(220,38,38,0.25)',
                          }}
                          title={t('delete_section') || "Bo'limni o'chirish"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Interleaved render — top-level lines and
                       sub-sections are sorted into a SINGLE stream by
                       their first row's item_number. So a sub-section
                       whose work numbers start at 1 renders BEFORE a
                       top-level work numbered 8, matching the printed
                       smeta page order. Without this they'd be split
                       into "all lines first, then all sub-sections"
                       which buried row-1 sub-sections under row-47
                       top-level lines.

                       Each entry carries its sort key (leading numeric
                       run of item_number — same parser the section
                       useMemo uses) plus a render() function. After
                       sort, we just call render() for each. */}
                    {/* Interleaved render — top-level lines and
                       sub-sections are sorted into a SINGLE stream by
                       their first row's item_number. So a sub-section
                       whose work numbers start at 1 renders BEFORE a
                       top-level work numbered 8, matching the printed
                       smeta page order. */}
                    {!collapsed && (() => {
                      const leadNum = (raw) => {
                        const m = String(raw || '').trim().match(/^\d+(?:\.\d+)?/);
                        return m ? Number(m[0]) : Infinity;
                      };
                      const subMinItem = (sub) => {
                        let min = Infinity;
                        for (const sln of (sub.lines || [])) {
                          const n = leadNum(sln.item_number);
                          if (n < min) min = n;
                        }
                        return min;
                      };
                      const renderLineEntry = (ln) => {
                        // Outside the scroll window — withhold until scrolled to.
                        if (!visibleWorkIds.has(Number(ln.id))) return null;
                        const subs = subByParent.get(Number(ln.id)) || [];
                        const subStages = subs.filter(isSubStageRow);
                        return (
                          <React.Fragment key={`ln-${ln.id}`}>
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
                              editLine={setEditLineTarget}
                              t={t}
                              isSubStage={false}
                              periodFakt={periodFaktByLine.get(Number(ln.id))}
                            />
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
                                editLine={setEditLineTarget}
                                t={t}
                                isSubStage
                              />
                            ))}
                          </React.Fragment>
                        );
                      };
                      const renderSubEntry = (sub) => (
                        <React.Fragment key={`sub-${sub.fullName}`}>
                          <div
                            className="ml-6 mb-2 rounded-lg px-4 py-3 flex items-center gap-2.5 border-l-2"
                            style={{
                              background: C.inset,
                              border: `1px dashed ${C.border2}`,
                              borderLeftColor: C.teal,
                              borderLeftWidth: 3,
                            }}
                          >
                            <span className="text-[14px] text-slate-400">└</span>
                            <span className="flex-1 text-left font-medium text-[14px] text-slate-700">{sub.name}</span>
                            <span
                              className="text-[12px] font-mono px-2 py-0.5 rounded"
                              style={{ background: C.card, color: C.muted }}
                            >
                              {sub.lines.length} {t('works_count_suffix') || 'ish'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAddWorkModal({
                                sectionName: sub.fullName, name: '', uom: '', code: '',
                              })}
                              className="px-2 py-1 rounded text-[12px] font-medium flex items-center gap-1"
                              style={{
                                background: 'rgba(13,148,136,0.08)', color: C.teal,
                                border: '1px solid rgba(13,148,136,0.25)',
                              }}
                              title={t('add_work') || "Ish qo'shish"}
                            >
                              <span className="text-[14px] leading-none font-bold">+</span>
                              {t('add_work_short') || "Ish"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!estimateId) {
                                  toast.error(t('no_estimate_for_work')
                                    || "Bu blok uchun єдинич smeta topilmadi");
                                  return;
                                }
                                setAddSubBosqichSection(sub.fullName);
                              }}
                              className="px-2 py-1 rounded text-[12px] font-medium flex items-center gap-1"
                              style={{
                                background: C.card, color: C.muted,
                                border: `1px solid ${C.border2}`,
                              }}
                              title={t('add_substage') || "Sub-bosqich qo'shish"}
                            >
                              <span className="text-[14px] leading-none font-bold">+</span>
                              {t('substage_short') || "Sub-bosqich"}
                            </button>
                            {canDeleteConstruction && (
                              <button
                                type="button"
                                onClick={() => removeSection(sub.fullName)}
                                className="p-1 rounded flex items-center justify-center"
                                style={{
                                  background: 'rgba(220,38,38,0.06)', color: C.red,
                                  border: '1px solid rgba(220,38,38,0.25)',
                                }}
                                title={t('delete_substage') || "Sub-bosqichni o'chirish"}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {/* Hide ONE "bucket marker" line that
                             AddSubWorkModal creates with the same name as
                             the sub-section — but only the first such
                             line, so subsequent works the user adds with
                             the same name still show. A bucket marker is
                             a line whose name matches the sub-section's
                             child name AND has no resources of its own.
                             Keeping all real works visible (with their
                             resources, qty, etc.) is what was missing
                             when both "yangi" works got hidden together. */}
                          {(() => {
                            const normTxt = (s) => String(s || '').trim().toLowerCase();
                            const subName = normTxt(sub.name);
                            let bucketSkipped = false;
                            const visibleLines = (sub.lines || []).filter((ln) => {
                              // Outside the scroll window — withhold for now.
                              if (!visibleWorkIds.has(Number(ln.id))) return false;
                              if (bucketSkipped) return true;
                              if (normTxt(ln.name) !== subName) return true;
                              const lnSubs = subByParent.get(Number(ln.id)) || [];
                              const hasResources = lnSubs.some((s) => !isSubStageRow(s));
                              if (hasResources) return true;
                              // First name-match line with no resources is
                              // the bucket marker — skip it once.
                              bucketSkipped = true;
                              return false;
                            });
                            if (visibleLines.length === 0) return null;
                            return (
                            <div className="ml-6 mb-2">
                              {visibleLines.map((ln) => {
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
                                      editLine={setEditLineTarget}
                                      t={t}
                                      isSubStage={false}
                                      periodFakt={periodFaktByLine.get(Number(ln.id))}
                                    />
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
                                        editLine={setEditLineTarget}
                                        t={t}
                                        isSubStage
                                      />
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                            );
                          })()}
                        </React.Fragment>
                      );
                      // Manual sub-sections pin to the top. Detection
                      // chain — every signal here is a STRICT marker
                      // that the sub-section came from the UI, not the
                      // import path:
                      //
                      //   1. Construction_stages row id in
                      //      recentlyAddedSectionIds (localStorage of
                      //      explicit "+ Bo'lim qo'shish" additions).
                      //   2. is_empty_manual placeholder (pre-seeded).
                      //   3. Empty bucket (zero lines).
                      //   4. EVERY line carries is_manual = TRUE
                      //      (migration 417 + backend writes).
                      //
                      // The earlier item_number-based heuristic was
                      // removed — it false-positived for imported єдинич
                      // works that happen to lack a numeric item_number
                      // (common when the source file uses SHRNK codes
                      // as identifiers). Users on production who haven't
                      // run migration 417 + rebuilt the backend will
                      // need to do so for UI-added sub-sections to pin
                      // correctly; new adds in the current session still
                      // pin via recentlyAddedSectionIds.
                      const recentlyAdded = new Set(
                        (recentlyAddedSectionIds || []).map(Number),
                      );
                      const fullNameToManualId = new Map();
                      for (const ms of (manualSectionRows || [])) {
                        const name = String(ms?.name || '').trim();
                        if (name && ms?.id != null) {
                          fullNameToManualId.set(name, Number(ms.id));
                        }
                      }
                      const isManualSub = (sub) => {
                        const full = String(sub.fullName || '').trim();
                        const mid = fullNameToManualId.get(full);
                        if (mid != null && recentlyAdded.has(mid)) return true;
                        if (sub.is_empty_manual) return true;
                        const lines = sub.lines || [];
                        if (lines.length === 0) return true;
                        return lines.every((ln) => ln.is_manual === true);
                      };
                      // A sub-section that's just a one-work wrapper
                      // (created via "+ Sub-bosqich" with a SHRNK code,
                      // where AddSubWorkModal creates both a wrapper
                      // line and an inner work line of the same name)
                      // collapses to JUST the inner work — no wrapper
                      // card. The user explicitly asked for this:
                      // "tashqaridagini olib tashlab, ichidagisi
                      // koʻrinishi kerak" (drop the outer, show the
                      // inner). The inner work keeps its WorkCard with
                      // qty input + cloned resources + sub-stage
                      // affordances; the wrapper's "+ Ish" / "+ Sub-
                      // bosqich" controls would have been redundant.
                      const normTxt = (s) => String(s || '').trim().toLowerCase();
                      const collapseToInnerWork = (sub) => {
                        const lines = sub.lines || [];
                        if (lines.length !== 1) return null;
                        const ln = lines[0];
                        if (normTxt(ln.name) !== normTxt(sub.name)) return null;
                        return ln;
                      };

                      // Manual sub-sections render first (preserved in
                      // their existing order). Imported sub-sections and
                      // top-level lines render in their file order — no
                      // re-sorting. The user wants imported rows kept
                      // exactly where the import put them.
                      const manualSubs = [];
                      const importedEntries = [];
                      for (const ln of (sec.lines || [])) {
                        importedEntries.push({ kind: 'line', data: ln });
                      }
                      for (const sub of (sec.subSections || [])) {
                        const inner = collapseToInnerWork(sub);
                        const target = isManualSub(sub) ? manualSubs : importedEntries;
                        if (inner) {
                          // Collapse to inner work card — caller of
                          // renderLineEntry below will handle WorkCard +
                          // sub-stages + cloned resources naturally.
                          if (target === manualSubs) {
                            manualSubs.push({ kind: 'line', data: inner });
                          } else {
                            importedEntries.push({ kind: 'line', data: inner });
                          }
                        } else if (target === manualSubs) {
                          manualSubs.push({ kind: 'sub', data: sub });
                        } else {
                          importedEntries.push({ kind: 'sub', data: sub });
                        }
                      }

                      const renderEntry = (entry) =>
                        entry.kind === 'line' ? renderLineEntry(entry.data) : renderSubEntry(entry.data);

                      return [
                        ...manualSubs.map(renderEntry),
                        ...importedEntries.map(renderEntry),
                      ];
                    })()}

                    {/* Legacy sub-section render — left in place but
                       disabled because the interleaved render above
                       handles sub-sections inline. Kept as a fallback
                       reference; safe to delete in a future cleanup. */}
                    {false && !collapsed && Array.isArray(sec.subSections) && sec.subSections.map((sub) => (
                      <React.Fragment key={sub.fullName}>
                        <div
                          className="ml-6 mb-2 rounded-lg px-4 py-3 flex items-center gap-2.5 border-l-2"
                          style={{
                            background: C.inset,
                            border: `1px dashed ${C.border2}`,
                            borderLeftColor: C.teal,
                            borderLeftWidth: 3,
                          }}
                        >
                          <span className="text-[14px] text-slate-400">└</span>
                          <span className="flex-1 text-left font-medium text-[14px] text-slate-700">{sub.name}</span>
                          <span
                            className="text-[12px] font-mono px-2 py-0.5 rounded"
                            style={{ background: C.card, color: C.muted }}
                          >
                            {sub.lines.length} {t('works_count_suffix') || 'ish'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAddWorkModal({
                              sectionName: sub.fullName, name: '', uom: '', code: '',
                            })}
                            className="px-2 py-1 rounded text-[12px] font-medium flex items-center gap-1"
                            style={{
                              background: 'rgba(13,148,136,0.08)', color: C.teal,
                              border: '1px solid rgba(13,148,136,0.25)',
                            }}
                            title={t('add_work') || "Ish qo'shish"}
                          >
                            <span className="text-[14px] leading-none font-bold">+</span>
                            {t('add_work_short') || "Ish"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!estimateId) {
                                toast.error(t('no_estimate_for_work')
                                  || "Bu blok uchun єдинич smeta topilmadi");
                                return;
                              }
                              setAddSubBosqichSection(sub.fullName);
                            }}
                            className="px-2 py-1 rounded text-[12px] font-medium flex items-center gap-1"
                            style={{
                              background: C.card, color: C.muted,
                              border: `1px solid ${C.border2}`,
                            }}
                            title={t('add_substage') || "Sub-bosqich qo'shish"}
                          >
                            <span className="text-[14px] leading-none font-bold">+</span>
                            {t('substage_short') || "Sub-bosqich"}
                          </button>
                          {canDeleteConstruction && (
                            <button
                              type="button"
                              onClick={() => removeSection(sub.fullName)}
                              className="p-1 rounded flex items-center justify-center"
                              style={{
                                background: 'rgba(220,38,38,0.06)', color: C.red,
                                border: '1px solid rgba(220,38,38,0.25)',
                              }}
                              title={t('delete_substage') || "Sub-bosqichni o'chirish"}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Work cards belonging to this sub-section. Indented
                           so the nesting reads visually. Each card carries
                           the same controls as a top-level work (qty edit,
                           resources, sub-stages). */}
                        {Array.isArray(sub.lines) && sub.lines.length > 0 && (
                          <div className="ml-6 mb-2">
                            {sub.lines.map((ln) => {
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
                                    editLine={setEditLineTarget}
                                    t={t}
                                    isSubStage={false}
                                    periodFakt={periodFaktByLine.get(Number(ln.id))}
                                  />
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
                                      editLine={setEditLineTarget}
                                      t={t}
                                      isSubStage
                                    />
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })
            )}
            {/* Infinite-scroll sentinel — when it scrolls into view the
                window grows by another page of works. Rendered only while
                there are still works outside the window. */}
            {!loadingLines && visibleWorkCount < totalWorks && (
              <div ref={loadMoreRef} className="py-6 flex items-center justify-center">
                <Loader className="py-0" size="w-5 h-5" />
              </div>
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
            onRefresh={() => loadSnapshots(project?.id)}
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
            onRefresh={() => loadAudit(project?.id, auditFilter)}
            hasMore={auditHasMore}
            loadingMore={loadingMoreAudit}
            loadMoreRef={auditMoreRef}
            loadError={auditLoadError}
            onLoadMore={loadMoreAudit}
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
        onSaved={() => reloadKeepingWork(addTarget?.id)}
      />
      <AddSubWorkModal
        open={addStageOpen}
        onClose={() => { setAddStageOpen(false); setAddTarget(null); }}
        projectId={project?.id}
        estimateId={Number(estimateId)}
        parent={addTarget}
        nextSeq={addTarget ? nextSeqFor(addTarget.id) : 1}
        onSaved={() => reloadKeepingWork(addTarget?.id)}
      />

      {/* Second mount of the same modal in parentSection mode — handles
         the "+ Sub-bosqich" click on a section card. Creates a new
         estimate line with parent_item_number = `${section} › ${name}`
         so it groups as a sub-stage under the chosen section. Same form
         the user sees on the work-level "Yangi qo'shimcha etap" flow,
         so the two add-affordances feel identical. */}
      <AddSubWorkModal
        open={!!addSubBosqichSection}
        onClose={() => setAddSubBosqichSection(null)}
        projectId={project?.id}
        estimateId={Number(estimateId)}
        parentSection={addSubBosqichSection || ''}
        onSaved={() => {
          setAddSubBosqichSection(null);
          loadLines(activeEstimateIds, { force: true });
        }}
      />

      {/* Material consolidation modal — opened from the topbar button. */}
      <MaterialConsolidationModal
        open={matConsOpen}
        onClose={() => setMatConsOpen(false)}
        projectId={project?.id}
        projectName={project?.name}
      />


      {/* Generic estimate-line edit modal — opened from the pencil icon
         on any work card or any resource sub-line. Routes the save to the
         line's own estimate_id so multi-єдинич blocks edit the right row.
         On save we re-load the active estimate's lines so totals/badges
         update without a manual refresh. */}
      <EstimateLineEditModal
        open={!!editLineTarget}
        onClose={() => setEditLineTarget(null)}
        line={editLineTarget}
        estimateId={editLineTarget ? lineEst(editLineTarget) : (estimateId ? Number(estimateId) : undefined)}
        onSaved={() => {
          setEditLineTarget(null);
          loadLines(activeEstimateIds, { force: true });
        }}
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

      {/* Add-section modal — POSTs to construction_stages via createStage
         so the section persists across reloads + shows on Bosqichlar too.
         Once saved, the listStages effect picks it up and the section
         renders as an empty card with the standard "+ ish" affordance,
         letting the user populate it via the existing add-work flow.

         Parent dropdown: when the user picks an existing section as the
         parent, the new section's name is stored as
         "PARENT › CHILD" (using the same " › " delimiter the importer
         uses). The grouping logic in `sections` keys by parent_item_number
         verbatim, so each hierarchical name becomes its own card with
         the breadcrumb visible in the header — mirroring how imported
         multi-level sections ("СЕКЦИЯ №1 › ПОЛЫ › КУХНЯ") already
         display. */}
      {/* Add-work modal — creates a top-level estimate line whose
         parent_item_number is the chosen section name. The resulting
         row becomes a normal work in that section's list with full
         access to the existing flows: + resurs, + sub-stage on the
         WorkCard, FAKT input, approval pipeline, Forma 2 rollup.
         Requires at least one єdinich estimate in the active block;
         the button is hidden otherwise (estimateId === ''). */}
      {addWorkModal && (
        <SmetaAddWorkModal
          sectionName={addWorkModal.sectionName}
          name={addWorkModal.name}
          uom={addWorkModal.uom}
          code={addWorkModal.code}
          onChange={(patch) => setAddWorkModal((m) => ({ ...m, ...patch }))}
          busy={addWorkBusy}
          hasEstimate={!!estimateId}
          onCancel={() => { if (!addWorkBusy) setAddWorkModal(null); }}
          onConfirm={async () => {
            const name = (addWorkModal.name || '').trim();
            const uom = (addWorkModal.uom || '').trim();
            if (!name || !uom) return;
            if (!estimateId) {
              toast.error(t('no_estimate_for_work') || "Smeta yo'q — avval єдинич smeta yarating");
              return;
            }
            const code = (addWorkModal.code || '').trim();
            setAddWorkBusy(true);
            try {
              if (code) {
                // Code-match clone path — let the backend look for an
                // existing parent line with this code anywhere in the
                // project and copy its resources onto the new work. Falls
                // back to a plain insert when no match is found, so it's
                // safe to call this unconditionally when a code is set.
                const res = await constructionService.cloneEstimateLineByCode(Number(estimateId), {
                  source_code: code,
                  parent_item_number: addWorkModal.sectionName,
                  name,
                  uom,
                  code,
                  quantity: 0,
                });
                const cloned = Number(res?.cloned_resources || 0);
                if (cloned > 0) {
                  toast.success(
                    (t('cloned_with_resources') || "Ish qo'shildi va {n} ta resurs ko'chirildi")
                      .replace('{n}', String(cloned)),
                  );
                } else if (res?.source_id) {
                  toast.success(
                    t('cloned_source_empty')
                      || "Ish qo'shildi (mos kod topildi, lekin resurslari yo'q edi)",
                  );
                } else {
                  toast.success(
                    t('cloned_no_match')
                      || "Ish qo'shildi (kod loyihada topilmadi — resurslar ko'chirilmadi)",
                  );
                }
              } else {
                await constructionService.createEstimateLine(Number(estimateId), {
                  // No parent line — this is a top-level work (a "ish"),
                  // not a sub-line. parent_item_number carries the section
                  // grouping (= section's name).
                  parent_line_id: 0,
                  parent_item_number: addWorkModal.sectionName,
                  name,
                  uom,
                  code: undefined,
                  // Template-mode defaults: quantity starts at 0 so the
                  // foreman fills BAJARILDI. quantity_override=true so the
                  // value the foreman types isn't re-derived from a
                  // (non-existent) parent's cascade.
                  quantity: 0,
                  quantity_override: true,
                  resource_type: '',
                  material_rate: 0,
                  labor_rate: 0,
                  equipment_rate: 0,
                  norm_rate: 0,
                  unit_price: 0,
                });
                toast.success(t('work_added') || "Ish qo'shildi");
              }
              setAddWorkModal(null);
              loadLines(activeEstimateIds, { force: true });
            } catch (e) {
              toast.error(formatApiError(e, t, 'Xatolik'));
            } finally {
              setAddWorkBusy(false);
            }
          }}
          t={t}
        />
      )}

      {addSectionModal && (
        <SmetaAddSectionModal
          value={addSectionModal.name}
          parent={addSectionModal.parent || ''}
          onChange={(name) => setAddSectionModal((m) => ({ ...m, name }))}
          busy={addSectionBusy}
          onCancel={() => { if (!addSectionBusy) setAddSectionModal(null); }}
          onConfirm={async () => {
            const rawName = (addSectionModal.name || '').trim();
            if (!rawName) return;
            // Compose the full hierarchical name. If the user picked a
            // parent section, prefix it so the new entry slots in as a
            // sub-stage; otherwise it's a top-level section.
            const parent = (addSectionModal.parent || '').trim();
            const fullName = parent ? `${parent} › ${rawName}` : rawName;
            setAddSectionBusy(true);
            try {
              const created = await constructionService.createStage(project.id, {
                name: fullName,
                status: 'not_started',
                planned_budget: 0,
                building_id: (buildingId && buildingId !== '0')
                  ? Number(buildingId)
                  : 0,
              });
              // Track the new id in localStorage so the sections useMemo
              // can pin it to the top of the list across page reloads
              // (without disturbing imported / auto-stage rows).
              if (created && created.id != null) {
                setRecentlyAddedSectionIds((prev) => {
                  const next = [...prev, Number(created.id)];
                  persistManualIds(next);
                  return next;
                });
              }
              setAddSectionModal(null);
              setSectionRefreshTick((n) => n + 1);
              toast.success(t('section_added') || "Seksiya qo'shildi");
            } catch (e) {
              toast.error(formatApiError(e, t, 'Xatolik'));
            } finally {
              setAddSectionBusy(false);
            }
          }}
          t={t}
        />
      )}
    </div>
  );
}

// =====================================================================
// SmetaAddSectionModal — single-input dialog. Behaves in TWO modes:
//
//   • No `parent` → "Bo'lim qo'shish" creates a top-level section.
//   • `parent` set → "Sub-bosqich qo'shish": shown with a read-only
//     "asosiy: PARENT" pill so the user knows the new entry will be
//     nested. The composed name is saved as "PARENT › CHILD" so it
//     groups under the parent in the section list. The parent name
//     itself is decided by the caller (the "+ Sub-bosqich" button on
//     the expanded section header passes it in), so there's no
//     dropdown to confuse the user.
// =====================================================================
function SmetaAddSectionModal({
  value, onChange,
  parent,
  busy, onCancel, onConfirm, t,
}) {
  const isSub = !!(parent && String(parent).trim());
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
         style={{ background: 'rgba(15,23,42,0.5)' }}
         onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-[480px] w-[90%] shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          {isSub
            ? (t('add_substage') || "Sub-bosqich qo'shish")
            : (t('add_section') || "Bo'lim qo'shish")}
        </h3>
        <p className="text-[14px] text-slate-500 mb-4">
          {isSub
            ? (t('add_substage_hint') || "Yangi sub-bosqich nomi")
            : (t('add_section_hint_long') || "Yangi bo'lim nomi (masalan: \"Pardozlash\", \"Poydevorlar\")")}
        </p>

        {/* Parent breadcrumb pill — appears only in sub-stage mode so the
           user sees exactly which section they're adding under. No
           dropdown: the parent is fixed by the entry point. */}
        {isSub && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-[14px] text-teal-700">
            <span className="text-teal-500 mr-1">{t('parent_section_label') || "Asosiy:"}</span>
            <span className="font-medium">{parent}</span>
          </div>
        )}

        <label className="block text-[13px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
          {isSub
            ? (t('substage_name') || "Sub-bosqich nomi")
            : (t('section_name') || "Bo'lim nomi")}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={isSub
            ? (t('substage_name_placeholder') || "Sub-bosqich nomi")
            : (t('section_name_placeholder') || "Bo'lim nomi")}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 mb-5"
          autoFocus
          disabled={busy}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('cancel') || 'Bekor qilish'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !(value || '').trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white disabled:opacity-50 disabled:hover:bg-teal-700"
          >
            {busy ? (t('saving') || "Saqlanmoqda...") : (t('add') || "Qo'shish")}
          </button>
        </div>
      </div>
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
            <p className="text-[14px] text-slate-500 mt-1">
              {t('topup_modal_subtitle')
                || "Asl smeta saqlanib qoladi — qo'shimcha buyurtma alohida yoziladi."}
            </p>
          </div>
        </div>

        {/* Resource being topped up */}
        <div className="rounded-lg p-3 mb-4 text-[14px]" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="text-[13px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
            {t('resource') || 'Resurs'}
          </div>
          <div className="font-medium text-slate-800">{resource?.name || '—'}</div>
          <div className="flex flex-wrap gap-3 mt-1 text-[13px] text-slate-500">
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
            <label className="block text-[13px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
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
            <label className="block text-[13px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
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
            <label className="block text-[13px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
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
            <label className="block text-[13px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
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
          <label className="block text-[13px] uppercase font-semibold tracking-[0.06em] text-slate-500 mb-1">
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
// =====================================================================
// SmetaAddWorkModal — "+ Ish qo'shish" dialog for empty / new sections.
//
// Three fields:
//   • Name (required) — what the work is called.
//   • UoM  (required) — measurement unit; the existing import uses
//     Cyrillic forms like "ЧЕЛ.-Ч" / "1000 М3 ГРУНТА" — we accept any
//     free-text so the user can match the imported convention without
//     a hard-coded dropdown.
//   • Code (optional) — the shifr (e.g. "E0601-110-07") that appears
//     alongside the work in the section list. Useful when the user is
//     mirroring a printed Goskomarkhitektstroy norma.
//
// On confirm, the parent component calls createEstimateLine with
// parent_item_number = sectionName so the new row groups under the
// expected section in the rendered list.
// =====================================================================
function SmetaAddWorkModal({
  sectionName, name, uom, code,
  onChange, busy, hasEstimate, onCancel, onConfirm, t,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
         style={{ background: 'rgba(15,23,42,0.5)' }}
         onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-[520px] w-[90%] shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          {t('add_work') || "Ish qo'shish"}
        </h3>
        <p className="text-[14px] text-slate-500 mb-4">
          {t('add_work_hint') || "Bo'limga yangi ish qo'shing — keyin u uchun resurslar, FAKT, va Forma 2 ishlatish mumkin."}
        </p>

        {/* Section breadcrumb pill — fixed by the caller, so read-only. */}
        <div className="mb-4 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-[14px] text-teal-700">
          <span className="text-teal-500 mr-1">{t('parent_section_label') || "Asosiy:"}</span>
          <span className="font-medium">{sectionName}</span>
        </div>

        {!hasEstimate && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[13px] text-amber-700">
            {t('no_estimate_for_work_warn')
              || "Bu blok uchun єдинич smeta topilmadi. Avval Smeta boshqaruvi → smeta yarating yoki import qiling."}
          </div>
        )}

        <label className="block text-[13px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
          {t('work_name') || "Ish nomi"} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
          placeholder={t('work_name_placeholder') || "Masalan: РАЗРАБОТКА ГРУНТА..."}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 mb-3"
          autoFocus
          disabled={busy}
        />

        <div className="grid grid-cols-[1fr_1fr] gap-3 mb-5">
          <div>
            <label className="block text-[13px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
              {t('unit') || "O'lchov"} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={uom || ''}
              onChange={(e) => onChange({ uom: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
              placeholder="М3, ЧЕЛ.-Ч, КГ, ..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              disabled={busy}
            />
          </div>
          <div>
            <label className="block text-[13px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
              {t('code') || "Shifr"}
              <span className="ml-1 text-slate-400 normal-case font-normal">({t('optional_short') || 'ixtiyoriy'})</span>
            </label>
            <input
              type="text"
              value={code || ''}
              onChange={(e) => onChange({ code: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
              placeholder="E0601-110-07"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('cancel') || 'Bekor qilish'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !hasEstimate || !(name || '').trim() || !(uom || '').trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white disabled:opacity-50 disabled:hover:bg-teal-700"
          >
            {busy ? (t('saving') || "Saqlanmoqda...") : (t('add') || "Qo'shish")}
          </button>
        </div>
      </div>
    </div>
  );
}

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
            <span className="text-[15px] leading-none">✓</span>
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
        className="text-[13px] mb-1.5 relative"
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
      <div className="text-[12px] relative" style={{ color: C.fade }}>
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
  openAddResource, openAddStage, openTopup, removeTopup, editLine, t, isSubStage,
  periodFakt, // optional: when defined, FAKT input uses period_fakt (top-level works only)
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
  // When the parent passes a `periodFakt` (top-level work in the new
  // iteration model — migration 419), the FAKT input shows THIS
  // iteration's contribution starting at 0 on a fresh iter. The
  // NORMA badge below still reads original_quantity (smeta reja) and
  // the resource subtable below still computes off line.quantity
  // (cumulative), so nothing else flips semantics.
  const inputBase = periodFakt !== undefined ? Number(periodFakt) : qty;
  const qtyValue = draft !== undefined ? draft : inputBase;
  const qtyChanged = draft !== undefined && Number(parseNum(draft)) !== inputBase;
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
      // Stable anchor so the page can scroll this work back into view after a
      // mutation reload (add resource / sub-stage). scrollMarginTop keeps it
      // clear of the sticky header when scrolled to.
      id={`work-anchor-${line.id}`}
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
        scrollMarginTop: 90,
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
          className="font-mono text-[13px]"
          style={{ color: isSubStage ? C.teal : C.fade, fontWeight: isSubStage ? 600 : 400 }}
        >
          {line.item_number || ''}
        </div>
        <div
          className="font-mono text-[13px] font-medium truncate"
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
          className="text-[15px] font-medium leading-snug"
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
              className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-[0.05em]"
              style={{ background: 'rgba(13,148,136,0.15)', color: C.teal }}
            >
              {t('extra_short') || "Qo'shimcha"}
            </span>
          )}
        </div>
        <div className="text-[13px] text-center" style={{ color: C.dim }}>{line.uom || ''}</div>
        <div
          className="text-[14px] font-mono text-right tabular-nums"
          style={{
            color: isEmpty ? C.amber : (qtyModified ? C.teal : (isSubStage ? C.teal : C.text)),
            fontWeight: isEmpty || qtyModified || isSubStage ? 600 : 400,
          }}
        >
          {isEmpty ? '⚠ 0' : fmt(qty)}
        </div>
        <div className="text-[14px] font-mono text-right tabular-nums" style={{ color: C.dim }}>
          {subResources.length} {t('resources_count_suffix') || 'resurs'}
          {!isSubStage && (subs || []).filter(isSubStageRow).length > 0 && (
            <span style={{ color: C.amber }}> +{(subs || []).filter(isSubStageRow).length} etap</span>
          )}
        </div>
        <div
          className="text-[15px] font-mono font-bold text-right tabular-nums"
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
              <span className="text-[12px] uppercase tracking-[0.08em]" style={{ color: C.fade }}>
                {t('label_norma_short') || 'Norma'}
              </span>
              <span
                className="px-3 py-2 rounded-[5px] text-[15px] font-mono text-right tabular-nums inline-flex items-center justify-end"
                style={{
                  background: C.hover,
                  color: origQty > 0 ? C.text : C.muted,
                  border: `1px solid ${C.border2}`,
                  width: 120,
                  height: 38, // matches the input's computed height (text-[15px] + py-2 + 1px borders)
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
              <span className="text-[12px] uppercase tracking-[0.08em]" style={{ color: C.fade }}>
                {t('label_fakt_qilingan_hajm_short') || 'Fakt'}
              </span>
              {isLocked ? (
                <span
                  className="px-3 py-2 rounded-[5px] text-[15px] font-mono text-right tabular-nums inline-flex items-center justify-end"
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
                  className={`px-3 py-2 rounded-[5px] text-[15px] font-mono text-right outline-none transition ${isEmpty ? 'smeta-empty-pulse' : ''}`}
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
                className="px-2.5 py-1 rounded-md text-[13px] inline-flex items-center gap-1.5"
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
            {/* Edit pencil — opens the EstimateLineEditModal so the user
                can change name, code, uom, quantity, and rates without
                deleting and recreating the row. Hidden when locked. */}
            {!isLocked && editLine && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); editLine(line); }}
                title={t('edit') || 'Tahrirlash'}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center transition"
                style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.dim }}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Delete affordance — available for BOTH sub-stages and
                top-level works (and Yangi bosqich rows). The trash icon
                triggers removeLine, which routes through the
                SmetaConfirmModal so the user sees a translated
                confirm prompt before the row is wiped. Hidden when
                the line is YAKUNIY-locked. */}
            {!isLocked && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeLine(line); }}
                title={isSubStage
                  ? (t('delete_stage') || "Etapni o'chirish")
                  : (t('delete_work') || "Ishni o'chirish")}
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
              <table className="w-full border-collapse text-[14px] mt-3">
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
                        className="text-[12px] uppercase tracking-[0.1em] font-semibold py-2 px-2.5"
                        style={{
                          background: C.hover,
                          color: C.muted,
                          textAlign: h.align,
                          width: h.w || 'auto',
                        }}
                        title={h.lock ? "Narxni o'zgartirish uchun Resurslar tabiga o'ting" : undefined}
                      >
                        {h.l}
                        {h.lock && <span className="ml-1 text-[11px]" style={{ color: C.fade }}>🔒</span>}
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
                              className="px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-[0.05em]"
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
                                  className="px-2 py-0.5 rounded-full text-[12px] font-bold uppercase tracking-[0.06em] flex-shrink-0 inline-flex items-center gap-1"
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
                              {/* Edit pencil — opens the EstimateLineEditModal
                                 on this resource sub-line so the user can fix
                                 name / uom / norm / price without deleting
                                 and re-adding. */}
                              {editLine && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); editLine(sub); }}
                                  title={t('edit') || 'Tahrirlash'}
                                  className="w-7 h-7 rounded-[5px] flex items-center justify-center transition"
                                  style={{ background: C.hover, border: `1px solid ${C.border2}`, color: C.dim }}
                                >
                                  <Edit3 className="w-3 h-3" />
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
                                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-[0.05em]"
                                  style={{ background: 'rgba(13,148,136,0.15)', color: C.teal }}
                                  title={tp.note || ''}
                                >
                                  +ДОП
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 pl-7 text-[13px]" style={{ color: C.dim }}>
                                <span style={{ color: C.muted }}>↳ </span>
                                {t('topup_label') || "Qo'shimcha buyurtma"}
                                {tp.ordered_at ? (
                                  <span className="ml-2 text-[12px]" style={{ color: C.fade }}>
                                    {tp.ordered_at}
                                  </span>
                                ) : null}
                                {tp.note ? (
                                  <span className="ml-2 text-[12px] italic" style={{ color: C.fade }}>
                                    — {tp.note}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-2.5 py-1.5 text-center text-[13px]" style={{ color: C.fade }}>
                                {sub.uom || ''}
                              </td>
                              <td className="px-2.5 py-1.5"></td>
                              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-[13px]"
                                  style={{ color: C.dim }}>
                                {fmt(tpQty)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-[13px]"
                                  style={{ color: C.text }}>
                                {fmt(tpPrice)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-[13px]"
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
              <div className="flex justify-between items-center gap-5 pt-3 mt-1 text-[14px] flex-wrap">
                <div className="flex gap-5 flex-wrap">
                  <FooterItem label={t('footer_labor')   || 'Mehnat'}   value={breakdown.labor}    color={C.amber} />
                  <FooterItem label={t('footer_machine') || 'Mashina'}  value={breakdown.machines} color={C.purple} />
                  <FooterItem label={t('footer_material')|| 'Material'} value={breakdown.materials}color={C.teal} />
                </div>
                <div className="pl-5 flex items-center gap-2" style={{ borderLeft: `1px solid ${C.border2}` }}>
                  <span className="text-[13px]" style={{ color: C.muted }}>{t('label_total_caps') || 'JAMI'}:</span>
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
      <span className="text-[13px]" style={{ color: C.muted }}>{label}:</span>
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
        <h3 className="text-[15px] font-semibold flex-1" style={{ color: C.text }}>
          {t('history_saved_form2') || "Saqlangan Forma 2 hujjatlari"}
        </h3>
        <button
          onClick={onRefresh}
          className="text-[14px] px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
          style={{ background: C.inset, border: `1px solid ${C.border2}`, color: C.dim }}
        >
          <RefreshCw className="w-3 h-3" />
          {t('refresh') || 'Yangilash'}
        </button>
        <button
          onClick={onSaveCurrent}
          className="text-[14px] px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
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
          <div className="text-[15px]">{t('history_empty') || "Hali bironta saqlangan Forma 2 yo'q"}</div>
          <div className="text-[13px] mt-1">{t('history_empty_hint') || "Forma 2 ni oching va o'ng yuqoridagi 'Saqlash' tugmasini bosing"}</div>
        </div>
      ) : (
        <div className="rounded-[10px] overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse' }}>
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
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-medium"
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

function AuditPage({ t, language, loading, entries, filter, onFilterChange, onRefresh, hasMore, loadingMore, loadMoreRef, loadError, onLoadMore }) {
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
        <h3 className="text-[15px] font-semibold flex-1" style={{ color: C.text }}>
          {t('audit_log_title') || "O'zgarishlar jurnali"}
        </h3>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-[14px] px-2.5 py-1.5 rounded-[6px]"
          style={{ background: C.inset, border: `1px solid ${C.border2}`, color: C.text, minWidth: 180 }}
        >
          <option value="">{t('audit_filter_all') || 'Barchasi'}</option>
          {Object.entries(AUDIT_ACTION_META).map(([k, m]) => (
            <option key={k} value={k}>{auditActionLabel(m, language)}</option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          className="text-[14px] px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
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
          <div className="text-[15px]">{t('audit_empty') || "Hech qanday o'zgarish yozib olinmagan"}</div>
        </div>
      ) : (
        <div className="rounded-[10px] overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse' }}>
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
                        <span className="text-[14px]" style={{ color: meta.color, fontWeight: 500 }}>{actionLabel}</span>
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
                        <div className="text-[13px]" style={{ color: C.muted }}>{e.description}</div>
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
          {/* Load-more footer. The sentinel auto-fetches the next page on
              scroll; the button is an explicit fallback (and the only path
              after an error, since auto-retry is disabled then). */}
          {loadingMore ? (
            <div className="py-4 flex items-center justify-center">
              <Loader className="py-0" size="w-4 h-4" />
            </div>
          ) : loadError ? (
            <div className="py-4 flex flex-col items-center justify-center gap-2">
              <span className="text-[13px]" style={{ color: C.muted }}>
                {({ uz: "Yuklab bo'lmadi", ru: 'Не удалось загрузить', en: 'Failed to load' })[language]}
              </span>
              <button
                onClick={onLoadMore}
                className="text-[14px] px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
                style={{ background: C.inset, border: `1px solid ${C.border2}`, color: C.text }}
              >
                <RefreshCw className="w-3 h-3" />
                {({ uz: 'Qayta urinish', ru: 'Повторить', en: 'Retry' })[language]}
              </button>
            </div>
          ) : hasMore ? (
            <div ref={loadMoreRef} className="py-4 flex items-center justify-center">
              <button
                onClick={onLoadMore}
                className="text-[14px] px-3 py-1.5 rounded-[6px]"
                style={{ background: C.inset, border: `1px solid ${C.border2}`, color: C.dim }}
              >
                {({ uz: "Ko'proq yuklash", ru: 'Загрузить ещё', en: 'Load more' })[language]}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
