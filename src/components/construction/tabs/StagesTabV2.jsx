import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
// Lucide retained only for the Loader2 spinner; every other affordance
// in this tab uses emoji exactly as the v2 mockup does (📤 ✓ 🛠️ ↩ 🔒 …).
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useAuth } from '@/components/contexts/AuthContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { formatApiError } from '@/utils/apiErrors';

// =====================================================================
// StagesTabV2 — full port of construction_module_v2.html
// (files/construction_module_v2.html). Implements:
//
//   • Three-role workflow (Прораб / Технадзор / Гл.инженер). The role
//     is fetched per project from the backend (construction_project_team
//     table). A "demo" switch is provided at the top so any user can
//     preview the other roles' UI without changing project data; role
//     enforcement still happens server-side on every action.
//
//   • Work-level approval pipeline (migration 353):
//       pending → in_progress → submitted → confirmed_supervisor →
//       confirmed_engineer (LOCKED).
//
//   • Block tabs — uses the project's existing buildings as blocks.
//     Each block carries its own estimate with stages = top-level
//     parent_item_number sections.
//
//   • Stat cards: blocks count, block readiness %, block budget
//     (hidden from foreman), stages/works counts.
//
//   • Stage cards expand to a work table with the v2 columns:
//       № · Name + code · Unit · Plan · Done · Progress micro-bar ·
//       (Unit price · Plan sum · Fact sum) · Status · Action.
//     Foremen never see the cost columns.
//
//   • Status badges + per-row action buttons drive the workflow.
//     Bulk actions ("All to review" / "Confirm all" / "Final all")
//     send the work_ids of the rows they apply to.
//
// All "demo role" switching is purely visual — every transition still
// goes through the server, which checks the user's actual project role.
// =====================================================================

// Role meta — single source of truth for emojis, colours, and the
// translation-key references for label + banner copy. Resolve via t()
// at render time so the UI fully respects the language switcher.
//
// Emojis mirror the v2 mockup's ROLE_LABELS (👷 / 🔍 / 🛠️) so the
// switcher pills look identical to the reference HTML.
const ROLE_META = {
  foreman: {
    labelKey:      'role_foreman',
    bannerKey:     'role_foreman_banner',
    emoji:         '👷',
    color:         '#3B82F6',
    bg:            '#DBEAFE',
    bannerBg:      'linear-gradient(90deg, #DBEAFE, #BFDBFE)',
    bannerColor:   '#1E40AF',
  },
  supervisor: {
    labelKey:      'role_supervisor',
    bannerKey:     'role_supervisor_banner',
    emoji:         '🔍',
    color:         '#F59E0B',
    bg:            '#FEF3C7',
    bannerBg:      'linear-gradient(90deg, #FEF3C7, #FDE68A)',
    bannerColor:   '#78350F',
  },
  engineer: {
    labelKey:      'role_engineer',
    bannerKey:     'role_engineer_banner',
    emoji:         '🛠️',
    color:         '#047857',
    bg:            '#D1FAE5',
    bannerBg:      'linear-gradient(90deg, #D1FAE5, #A7F3D0)',
    bannerColor:   '#065F46',
  },
};

// Status meta — colours and (optional) border match the v2 mockup's
// .status-badge classes 1:1 so the row badges look identical to the HTML.
//
// `longKey`  → STATUS_LABELS[*].label  in the mockup ("Не начат",
//              "В процессе", "✓ Финально подтверждён", …) — used on
//              the stage HEADER badge.
// `shortKey` → STATUS_LABELS[*].short  ("не начат", "финал ✓", …) —
//              used on the per-work ROW badge inside the table.
const STATUS_META = {
  pending:              { shortKey: 'work_status_pending',              longKey: 'work_status_pending_long',              bg: '#F1F5F9', fg: '#64748B', dot: '#64748B', border: 'transparent' },
  in_progress:          { shortKey: 'work_status_in_progress',          longKey: 'work_status_in_progress_long',          bg: '#DBEAFE', fg: '#1E40AF', dot: '#1E40AF', border: 'transparent' },
  submitted:            { shortKey: 'work_status_submitted',            longKey: 'work_status_submitted_long',            bg: '#FEF3C7', fg: '#B45309', dot: '#B45309', border: 'transparent' },
  confirmed_supervisor: { shortKey: 'work_status_confirmed_supervisor', longKey: 'work_status_confirmed_supervisor_long', bg: '#FED7AA', fg: '#9A3412', dot: '#9A3412', border: '#FB923C' },
  confirmed_engineer:   { shortKey: 'work_status_confirmed_engineer',   longKey: 'work_status_confirmed_engineer_long',   bg: '#D1FAE5', fg: '#065F46', dot: '#10B981', border: '#10B981' },
};

const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ');
};

// Estimate codes in the source files often look like:
//   "Е0101-197-14 ДОП. 11 ГОСАРХИТЕКТСТРОЙ РУЗ ПР. № 429 ОТ 15.12.17 Г."
//   "Е0102-057-02 . ТЧ П.3.187 КЗТР=1,2"
//   "Е310-1003 . СРН4.04.06-14 Р.3.Т.7 К=0,41"
// The suffix after the leading code is regulation/disposition metadata
// that the foreman never needs in the stages list. cleanCode strips
// everything from the first whitespace onwards so we render only the
// canonical code prefix (e.g. "Е0101-197-14") below the work name.
function cleanCode(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // Match the leading code: optional cyrillic/latin letter, then digits
  // and -/./digits/letters until the first whitespace.
  const m = s.match(/^([А-ЯЁA-Z]?[\d.\-]+(?:[А-ЯЁA-Z]?[\d.\-]*)*?)(\s|$)/);
  return (m ? m[1] : s.split(/\s+/)[0]) || '';
}
// fmtShort — compact number formatter with localised magnitude
// suffixes. Caller passes `t` so the suffix follows the active language
// (uz: ming/mln/mlrd, ru: тыс./млн/млрд, en: K/M/B).
const fmtShort = (n, t) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '0';
  const a = Math.abs(v);
  const ru = (x, d) => x.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  // Resolve the magnitude suffix via t() if available; fall back to
  // English K/M/B when no translator was passed (rare — only happens if
  // a caller forgets to thread t through).
  const suffix = (k, en) => (t ? t(k) : null) || en;
  if (a >= 1e9) return ru(v / 1e9, 1) + ' ' + suffix('num_billion',  'B');
  if (a >= 1e6) return ru(v / 1e6, 1) + ' ' + suffix('num_million',  'M');
  if (a >= 1e3) return ru(v / 1e3, 0) + ' ' + suffix('num_thousand', 'K');
  return fmt(v);
};

// A work in the v2 sense = a top-level row whose `resource_type` is
// empty (i.e. a real work item, not a resource line).
//
// Estimates can be loaded from either:
//   • ВОР    — has actual works grouped under construction stages.
//              Top-level rows have NO resource_type. ✓ these are works.
//   • ресурс — flat resource catalogue grouped under three category
//              headers (ТРУДОВЫЕ РЕСУРСЫ / СТРОИТЕЛЬНЫЕ МАШИНЫ /
//              МАТЕРИАЛЬНЫЕ РЕСУРСЫ). Top-level rows DO have a
//              resource_type. ✗ these are NOT works — the Bosqichlar
//              page must skip them so the resource categories don't
//              show up as fake stages.
function isWorkRow(line) {
  const pid = line?.parent_line_id;
  if (pid != null && Number(pid) !== 0) return false; // sub-line / resource child
  const rt = String(line?.resource_type || '').trim().toLowerCase();
  return rt === '';
}

// A stage in the v2 sense = the unique parent_item_number value across
// the works of the selected estimate. Works without a parent_item_number
// fall into a synthetic "uncategorised" bucket; the bucket label itself
// is resolved through t() at render time so it follows the language
// switcher. Internally we use a fixed sentinel key so the lookup is
// stable regardless of locale.
const UNCATEGORISED_KEY = '__uncategorised__';

// SmetaImportModal encodes a row's full section path as
//   "СЕКЦИЯ №1 › ПЕРЕКРЫТИЕ › МОНОЛИТНЫЕ УЧАСТКИ"
// using this delimiter. Splitting on it turns the flat
// parent_item_number column into a 1-3 level hierarchy that we can nest.
const HIERARCHY_DELIM = ' › ';

function splitPath(parent) {
  if (!parent) return [];
  return String(parent).split(HIERARCHY_DELIM).map((s) => s.trim()).filter(Boolean);
}

// Drop the СЕКЦИЯ / РАЗДЕЛ prefix from a path. The estimate parser
// emits 3-segment paths for works that live two levels deep:
//
//   "СЕКЦИЯ №2 › ПЕРЕКРЫТИЕ › МОНОЛИТНЫЕ УЧАСТКИ"
//
// The first segment is the regulatory grouping (one per file); on the
// stages page it would just bloat every label with the same prefix.
// We collapse it so:
//
//   [СЕКЦИЯ №2, ПЕРЕКРЫТИЕ, МОНОЛИТНЫЕ УЧАСТКИ] → [ПЕРЕКРЫТИЕ, МОНОЛИТНЫЕ УЧАСТКИ]
//   [СЕКЦИЯ №2, ЗЕМЛЯННЫЕ РАБОТЫ]               → [ЗЕМЛЯННЫЕ РАБОТЫ]
//   [СЕКЦИЯ №2]                                  → []  (no works at section level)
// Note: \b is ASCII-only in JS regex — it doesn't recognise Cyrillic
// characters as word chars, so /^СЕКЦИЯ\b/.test('СЕКЦИЯ №2') is false.
// Use a simple "followed by space, end of string, or punctuation" check.
const SECTION_PREFIX_RE = /^(СЕКЦИЯ|РАЗДЕЛ)(\s|$|[№#:])/i;
function dropSectionPrefix(parts) {
  if (parts.length > 0 && SECTION_PREFIX_RE.test(parts[0])) {
    return parts.slice(1);
  }
  return parts;
}

// Group works into a hierarchy. Returns:
//   [
//     { name: "ПЕРЕКРЫТИЕ", works: [...direct works...],
//       subStages: [{ name: "МОНОЛИТНЫЕ УЧАСТКИ", works: [...] }, ...] },
//     ...
//   ]
//
// After dropSectionPrefix, every path is at most 2 segments deep:
//   • one segment   → top-level stage with direct works
//   • two segments  → sub-stage (second segment) of the first segment
//   • zero segments → the works lived only under the top section header,
//                     so they fall into UNCATEGORISED for safety.
function deriveStages(lines) {
  const works = (lines || []).filter(isWorkRow);
  // First pass: bucket works by their full path string (so identical
  // paths land in the same bucket).
  const byPath = new Map();
  for (const w of works) {
    const path = w.parent_item_number ? String(w.parent_item_number) : UNCATEGORISED_KEY;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(w);
  }

  // Second pass: group into stages + their sub-stages.
  const stages = new Map();
  for (const [path, ws] of byPath.entries()) {
    if (path === UNCATEGORISED_KEY) {
      const k = UNCATEGORISED_KEY;
      if (!stages.has(k)) stages.set(k, { name: k, works: [], subStages: new Map() });
      stages.get(k).works.push(...ws);
      continue;
    }
    const parts = dropSectionPrefix(splitPath(path));
    if (parts.length === 0) {
      // Path was only the section header (no stage given). Skip — the
      // section itself isn't a "stage" in the v2 sense.
      const k = UNCATEGORISED_KEY;
      if (!stages.has(k)) stages.set(k, { name: k, works: [], subStages: new Map() });
      stages.get(k).works.push(...ws);
      continue;
    }
    if (parts.length === 1) {
      const k = parts[0];
      if (!stages.has(k)) stages.set(k, { name: k, works: [], subStages: new Map() });
      stages.get(k).works.push(...ws);
    } else {
      // 2+ remaining segments: first is the stage, last is the sub-stage,
      // anything in the middle is folded into the sub-stage name as a
      // breadcrumb (rare — usually exactly two segments here).
      const stageName = parts[0];
      const subName   = parts.slice(1).join(HIERARCHY_DELIM);
      if (!stages.has(stageName)) stages.set(stageName, { name: stageName, works: [], subStages: new Map() });
      const stage = stages.get(stageName);
      if (!stage.subStages.has(subName)) stage.subStages.set(subName, { name: subName, works: [] });
      stage.subStages.get(subName).works.push(...ws);
    }
  }

  return Array.from(stages.values()).map((s) => ({
    name: s.name,
    works: s.works,
    subStages: Array.from(s.subStages.values()),
  }));
}

function stageStatus(stage) {
  const ws = stage.works;
  if (ws.length === 0) return 'pending';
  if (ws.every((w) => w.approval_status === 'confirmed_engineer')) return 'confirmed_engineer';
  if (ws.every((w) => ['submitted', 'confirmed_supervisor', 'confirmed_engineer'].includes(w.approval_status))) {
    if (ws.every((w) => ['confirmed_supervisor', 'confirmed_engineer'].includes(w.approval_status))) return 'confirmed_supervisor';
    return 'submitted';
  }
  if (ws.some((w) => Number(w.done_quantity || 0) > 0)) return 'in_progress';
  return 'pending';
}

// Walk every work that belongs to a stage — its direct works plus the
// works of every sub-stage. The stage progress / cost summaries need
// to see all of them, otherwise a stage that puts everything under
// sub-stages reports 0 works / 0 progress.
function allStageWorks(stage) {
  const out = [];
  if (Array.isArray(stage?.works)) out.push(...stage.works);
  if (Array.isArray(stage?.subStages)) {
    for (const ss of stage.subStages) {
      if (Array.isArray(ss?.works)) out.push(...ss.works);
    }
  }
  return out;
}

// Cost-weighted progress when total_amount is populated (Единич / Ресурс
// imports), with a quantity-based fallback for ВОР imports where
// unit_rate / total_amount are zero. Without this fallback the v2
// mockup's progress stays at 0% on a freshly-imported BOP file even
// after the foreman fills in done quantities — the original mockup
// hardcoded `unitPrice` per row, so it never hit this case.
function progressFromWorks(works) {
  if (!works || works.length === 0) return 0;
  let costPlan = 0, costDone = 0;
  let qtyRatioSum = 0, qtyRatioCount = 0;
  for (const w of works) {
    const cost  = Number(w.total_amount || 0);
    const qty   = Number(w.quantity || 0);
    const doneQ = Number(w.done_quantity || 0);
    const ratio = qty > 0 ? Math.min(doneQ / qty, 1) : 0;
    costPlan += cost;
    costDone += cost * ratio;
    qtyRatioSum   += ratio;
    qtyRatioCount += 1;
  }
  if (costPlan > 0) return (costDone / costPlan) * 100;
  if (qtyRatioCount > 0) return (qtyRatioSum / qtyRatioCount) * 100;
  return 0;
}

function stageProgress(stage) {
  return progressFromWorks(allStageWorks(stage));
}

function blockProgress(stages) {
  let plan = 0, done = 0;
  let qtyRatioSum = 0, qtyRatioCount = 0;
  for (const s of stages) {
    for (const w of allStageWorks(s)) {
      const cost  = Number(w.total_amount || 0);
      const qty   = Number(w.quantity || 0);
      const doneQ = Number(w.done_quantity || 0);
      const ratio = qty > 0 ? Math.min(doneQ / qty, 1) : 0;
      plan += cost;
      done += cost * ratio;
      qtyRatioSum   += ratio;
      qtyRatioCount += 1;
    }
  }
  // Caller expects { plan, done } so it can compute the overall ratio
  // and also display the budget. When costs are zero we synthesise the
  // ratio onto plan=count / done=ratio-sum so the readiness % is
  // still correct, while the budget stat-card stays at 0/—.
  if (plan > 0) return { plan, done, costMode: true };
  return { plan: qtyRatioCount, done: qtyRatioSum, costMode: false };
}

// Detect a hierarchical sub-stage layer inside a flat list of works.
//
// The v2 mockup nests works under sub-stages (e.g. stage "ПЕРЕКРЫТИЕ" →
// sub-stages "ПОЯСА", "МУ-1", "МУ-2"). Our backend stores works flat
// under parent_item_number, so we discover the sub-stage layer by
// looking at the works' item_number prefix:
//
//   item_number "4-1" / "4-1-2" / "4.1" / "4.1.2"  → sub-stage key "1"
//
// If at least two distinct sub-stage keys are present we render the
// nested layout; otherwise we fall back to a flat works table under the
// stage. This means BOP estimates that don't use hierarchical numbering
// keep their existing flat layout, while estimates that DO use it
// automatically get the v2 nested look.
function buildSubStages(works) {
  if (!Array.isArray(works) || works.length < 2) return null;

  // Pull the second segment of the item_number — that's the sub-stage id.
  // Accept "-" or "." as the delimiter; ignore any third+ segment.
  const subKey = (w) => {
    const s = String(w?.item_number || '').trim();
    if (!s) return null;
    const m = s.match(/^[^.\-]+[.\-]([^.\-]+)/);
    return m ? m[1] : null;
  };

  const groups = new Map();
  let withKey = 0;
  for (const w of works) {
    const k = subKey(w);
    if (k == null) continue;
    withKey++;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(w);
  }

  // Need at least 2 distinct sub-keys AND most works covered to commit
  // to the nested layout. Otherwise we'd drop "uncategorised" works on
  // the floor whenever someone has mixed numbering styles.
  if (groups.size < 2 || withKey < works.length * 0.7) return null;

  // Use the first work in each bucket as the sub-stage's display name.
  // Prefer a short prefix from its name (everything before the first
  // double-space or dash) so the sub-stage label stays terse.
  return Array.from(groups.entries()).map(([key, ws]) => {
    const first = ws[0];
    let label = String(first?.name || '').trim();
    // Trim very long names down to ~50 chars + ellipsis.
    if (label.length > 60) label = label.slice(0, 57).trimEnd() + '…';
    return {
      key,
      // Defer label resolution to render time when the work has no
      // descriptive name — caller substitutes the localised "subgroup"
      // word in front of the bucket key.
      name: label || null,
      works: ws,
    };
  });
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function StagesTabV2({ project, setActiveGroup, setActiveTab }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  // Auth — used both for the user-pill display and for gating the
  // role-switcher visibility. Only system admins and tenant owners see
  // the switcher; ordinary users get whichever role the backend
  // resolved for them, which the page renders implicitly.
  const { user, isSiteAdmin, isOwner } = useAuth();
  const canSwitchRole = (typeof isSiteAdmin === 'function' && isSiteAdmin())
    || (typeof isOwner === 'function' && isOwner());

  // ── Data state ───────────────────────────────────────────────────
  const [buildings, setBuildings] = useState([]);    // act as v2's "blocks"
  const [estimates, setEstimates] = useState([]);    // current building → primary estimate
  const [activeBuildingId, setActiveBuildingId] = useState(null);
  const [lines, setLines] = useState([]);            // works of the active estimate
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // bump to force a reload

  // ── Role state ────────────────────────────────────────────────────
  // `realRole` = role the backend reports for the current project.
  // `viewRole` = role the user is currently impersonating (the v2
  //              mockup's "Сменить роль (демо)" switcher). Defaults
  //              to realRole. Server still enforces realRole on every
  //              transition — viewRole only affects what the UI shows.
  const [realRole, setRealRole] = useState('');
  const [viewRole, setViewRole] = useState('foreman');

  // ── Stage expansion ──────────────────────────────────────────────
  const [expandedStages, setExpandedStages] = useState(new Set());
  const toggleStage = (key) => setExpandedStages((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  // ── Local optimistic draft for done-quantity inputs ──────────────
  const [doneDraft, setDoneDraft] = useState({});

  // ── Custom confirmation modal ────────────────────────────────────
  // The mockup uses a styled modal for the "this will lock the work"
  // prompt instead of a browser confirm dialog. State shape:
  //   { title, body, confirmLabel, onConfirm }
  // Setting confirmModal to null closes it.
  const [confirmModal, setConfirmModal] = useState(null);
  const askConfirm = useCallback((title, body, onConfirm, confirmLabel = '') => {
    setConfirmModal({ title, body, onConfirm, confirmLabel });
  }, []);

  // ── Load buildings ───────────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    constructionService.listBuildings(project.id)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setBuildings(list);
        if (list.length > 0 && !activeBuildingId) setActiveBuildingId(list[0].id);
      })
      .catch((e) => { if (!cancelled) toast.error(formatApiError(e, t, 'Xatolik')); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // ── Resolve project role ─────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    constructionService.getMyProjectRole(project.id)
      .then((r) => {
        if (cancelled) return;
        setRealRole(r?.role || '');
        // Default the viewer to the user's real role; tenant admins
        // (no role assigned) start in foreman view, matching the v2
        // mockup's default selection.
        setViewRole(r?.role || 'foreman');
      })
      .catch(() => { /* leave realRole empty → admin/demo mode */ });
    return () => { cancelled = true; };
  }, [project?.id]);

  // ── Load estimate + lines when active building changes ───────────
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setLoading(true);
    setLines([]);
    setEstimates([]);

    constructionService.listEstimates(project.id)
      .then(async (rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setEstimates(list);
        // Pick the right estimate for this building. The Bosqichlar tab
        // is now driven EXCLUSIVELY by `edinich`-type estimates — the
        // ВОР flavour's "sections" are just block names and the Ресурс
        // flavour's "sections" are resource-type buckets, so neither
        // produces meaningful stages. Only единич has the work-category
        // hierarchy that maps to real construction stages and works.
        //
        // If a building has no единич estimate, the tab shows the empty
        // state — we do NOT silently fall back to ВОР/Ресурс anymore
        // because that would put fake stages back on the page.
        const sameBuilding = list.filter((e) =>
          activeBuildingId ? Number(e.building_id) === Number(activeBuildingId) : !e.building_id);
        let matchedEst = sameBuilding.find(
          (e) => String(e.source_type || '').toLowerCase() === 'edinich'
        ) || null;
        if (!matchedEst) {
          setLines([]);
          setLoading(false);
          return;
        }
        try {
          const lineRows = await constructionService.listEstimateLines(matchedEst.id, { page_size: 5000 });
          if (cancelled) return;
          setLines(Array.isArray(lineRows) ? lineRows : (lineRows?.data || lineRows?.items || []));
        } catch (e) {
          if (!cancelled) toast.error(formatApiError(e, t, 'Xatolik'));
        }
      })
      .catch((e) => { if (!cancelled) toast.error(formatApiError(e, t, 'Xatolik')); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, activeBuildingId, refreshTick]);

  const reload = () => setRefreshTick((n) => n + 1);

  // ── Derived data ─────────────────────────────────────────────────
  const stages = useMemo(() => deriveStages(lines), [lines]);
  const blockProg = useMemo(() => blockProgress(stages), [stages]);
  // Total works in the active block — direct works of every stage PLUS
  // the works inside every sub-stage. Pre-fix this only counted
  // stage.works, so a block that was 100% sub-stages reported 0 works.
  const totalWorks = useMemo(
    () => stages.reduce((n, s) => n + allStageWorks(s).length, 0),
    [stages],
  );
  // Block budget = sum of every work's total_amount across direct + sub.
  // Will be 0 for a ВОР-only import (no unit_rate); the stat-card falls
  // back to '—' in that case.
  const blockBudget = useMemo(
    () => stages.reduce((n, s) => n + allStageWorks(s).reduce(
      (m, w) => m + Number(w.total_amount || 0), 0), 0),
    [stages],
  );

  // Permission helpers — based on viewRole (what the user is currently
  // simulating) for UI gating; the server independently enforces using
  // the real role on every action.
  const canSeeCost = viewRole !== 'foreman';
  const canEditQty = (w) =>
    viewRole === 'foreman'
    && (w.approval_status === 'pending' || w.approval_status === 'in_progress');
  const canSubmitToSupervisor = (w) =>
    viewRole === 'foreman'
    && Number(w.done_quantity || 0) > 0
    && (w.approval_status === 'pending' || w.approval_status === 'in_progress');
  const canConfirmAsSupervisor = (w) => viewRole === 'supervisor' && w.approval_status === 'submitted';
  const canRejectAsSupervisor  = (w) => viewRole === 'supervisor' && w.approval_status === 'submitted';
  const canConfirmAsEngineer   = (w) => viewRole === 'engineer'   && w.approval_status === 'confirmed_supervisor';
  const canRejectAsEngineer    = (w) => viewRole === 'engineer'   && w.approval_status === 'confirmed_supervisor';

  // ── Action handlers ──────────────────────────────────────────────
  const updateDone = useCallback(async (work, raw) => {
    const v = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
    const newQty = Number.isFinite(v) ? Math.max(0, Math.min(v, Number(work.quantity || 0))) : 0;
    if (Math.abs(newQty - Number(work.done_quantity || 0)) < 0.0001) return;
    try {
      await constructionService.updateWorkDoneQuantity(work.id, newQty);
      // Optimistic patch — server will confirm on next reload.
      setLines((rows) => rows.map((r) => r.id === work.id
        ? { ...r, done_quantity: newQty, approval_status: newQty > 0 ? 'in_progress' : 'pending' }
        : r));
      toast.success(t('saved'));
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      reload();
    }
  }, [t]);

  const transitionRow = useCallback(async (label, fn) => {
    try {
      await fn();
      toast.success(label);
      reload();
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
    }
  }, [t]);

  const submitWork              = (w) => transitionRow(t('sent_for_review'),     () => constructionService.submitWork(w.id));
  const confirmAsSupervisor     = (w) => transitionRow(t('confirmed'),                    () => constructionService.confirmWorkSupervisor(w.id));
  const rejectAsSupervisor      = (w) => transitionRow(t('rejected'),                     () => constructionService.rejectWorkSupervisor(w.id));
  const confirmAsEngineer       = (w) => {
    askConfirm(
      t('engineer_final_confirm_title'),
      t('engineer_final_confirm'),
      () => transitionRow(t('finalised'), () => constructionService.confirmWorkEngineer(w.id)),
      t('finalize'),
    );
  };
  const rejectAsEngineer        = (w) => transitionRow(t('rejected'), () => constructionService.rejectWorkEngineer(w.id));

  // Bulk handlers — pick eligible IDs from the stage and POST them.
  const submitAllInStage = (stage) => {
    const ids = stage.works.filter((w) => canSubmitToSupervisor(w)).map((w) => w.id);
    if (ids.length === 0) return;
    transitionRow(`${t('sent_for_review')} · ${ids.length}`,
      () => constructionService.bulkSubmitWorks(ids));
  };
  const confirmAllSupervisor = (stage) => {
    const ids = stage.works.filter((w) => canConfirmAsSupervisor(w)).map((w) => w.id);
    if (ids.length === 0) return;
    transitionRow(`${t('confirmed')} · ${ids.length}`,
      () => constructionService.bulkConfirmSupervisor(ids));
  };
  const confirmAllEngineer = (stage) => {
    const ids = stage.works.filter((w) => canConfirmAsEngineer(w)).map((w) => w.id);
    if (ids.length === 0) return;
    askConfirm(
      t('engineer_final_confirm_title'),
      (t('engineer_final_bulk_confirm'))
        .replace('{n}', String(ids.length)),
      () => transitionRow(`${t('finalised')} · ${ids.length}`,
        () => constructionService.bulkConfirmEngineer(ids)),
      t('finalize'),
    );
  };

  // ── RENDER ───────────────────────────────────────────────────────

  // The role switcher (mockup's `.role-card` in the topbar-right) is
  // teleported into the parent's topbar via a portal so it sits next
  // to the project title rather than below the navigation tabs. The
  // parent renders an empty <div id="stages-tab-topbar-slot"> next to
  // the report-generator button; we render into it only when that
  // node exists, otherwise we fall back to inline rendering at the
  // top of the tab content.
  const roleSwitcher = (
    <div className="rounded-xl border border-slate-200 bg-white p-2 flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mx-2">
        {t('switch_role')}
      </span>
      {Object.entries(ROLE_META).map(([key, meta]) => {
        const active = viewRole === key;
        return (
          <button
            key={key}
            onClick={() => setViewRole(key)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5"
            style={{
              background: active ? meta.color : '#F8FAFC',
              color: active ? '#FFFFFF' : '#64748B',
              border: '1.5px solid transparent',
            }}
          >
            <span className="text-[14px] leading-none">{meta.emoji}</span>
            {t(meta.labelKey)}
          </button>
        );
      })}
    </div>
  );

  // Look up the slot lazily on every render so it stays in sync with
  // the parent (e.g. when the parent re-mounts on tab change).
  const topbarSlot = typeof document !== 'undefined'
    ? document.getElementById('stages-tab-topbar-slot')
    : null;

  return (
    <div className="space-y-4">
      {/* Role switcher — only system admins / tenant owners see it.
         Everyone else lives with whichever role the backend resolved
         for them via tenant_settings + project-team lookup, so the
         switcher would just be a confusing toy for them.
         The switcher is portalled into the project topbar when the
         slot exists; otherwise it falls back to an inline render. */}
      {canSwitchRole && (
        topbarSlot
          ? createPortal(roleSwitcher, topbarSlot)
          : <div className="flex justify-end">{roleSwitcher}</div>
      )}

      {/* Your-role label — single source of truth for "you are the
         foreman / supervisor / engineer". Shown to every user who has a
         resolved role. Hidden entirely for users without one (the
         banner below covers context, and the demo-mode hint was just
         noise once admins gained the dedicated switcher). */}
      {realRole && (
        <div className="text-sm text-slate-500">
          {t('your_role_is')}:{' '}
          <span className="font-semibold" style={{ color: ROLE_META[realRole]?.color || '#0F172A' }}>
            {t(ROLE_META[realRole]?.labelKey)}
          </span>
        </div>
      )}

      {/* ROLE BANNER */}
      {ROLE_META[viewRole] && (
        <div
          className="rounded-lg px-4 py-3 text-[13px]"
          style={{
            background: ROLE_META[viewRole].bannerBg,
            color: ROLE_META[viewRole].bannerColor,
            borderLeft: `4px solid ${ROLE_META[viewRole].color}`,
          }}
        >
          <strong>{t(ROLE_META[viewRole].labelKey)}</strong> — {t(ROLE_META[viewRole].bannerKey)}
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t('blocks_total')}
          value={String(buildings.length)}
          sub={t('in_project')}
        />
        {/* Mockup convention: when the block has no smeta loaded yet,
           progress + budget show a dash instead of a 0%. Keeps the
           dashboard from misleadingly reading "0%" for an unstarted block. */}
        <StatCard
          label={t('block_readiness')}
          value={blockProg.plan > 0
            ? `${(blockProg.done / blockProg.plan * 100).toFixed(1)}%`
            : '—'}
          sub={t('avg_progress_by_stages')}
          variant="green"
        />
        <StatCard
          label={canSeeCost ? t('block_budget') : t('budget_hidden')}
          value={!canSeeCost
            ? '🔒'
            : (blockBudget > 0 ? fmtShort(Math.round(blockBudget), t) : '—')}
          sub={canSeeCost ? t('soum_per_estimate') : t('hidden_from_foreman')}
          variant="amber"
        />
        <StatCard
          label={t('stages_works')}
          value={`${stages.length} / ${totalWorks}`}
          sub={t('in_current_block')}
          variant="blue"
        />
      </div>

      {/* BLOCK TABS — the "Smeta yuklash" CTA used to live in this header
         row, but the user prefers the upload affordance to stay in
         Moliya → Smetalar where the actual import-from-Excel flow is.
         Removed per request. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold text-slate-900">📐 {t('blocks_section')}</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {buildings.length === 0 ? (
            <div className="text-sm text-slate-400">{t('no_buildings')}</div>
          ) : (
            buildings.map((b) => {
              const active = activeBuildingId === b.id;
              const hasEst = estimates.some((e) => Number(e.building_id) === Number(b.id));
              return (
                <button
                  key={b.id}
                  onClick={() => setActiveBuildingId(b.id)}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition"
                  style={{
                    background: active ? '#0F172A' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#64748B',
                    border: `1.5px solid ${active ? '#0F172A' : '#E5E7EB'}`,
                  }}
                >
                  <span>📐 {b.name}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{
                      background: active ? '#047857' : (hasEst ? '#E5E7EB' : '#FEF3C7'),
                      color: active ? '#FFFFFF' : (hasEst ? '#64748B' : '#B45309'),
                    }}
                  >
                    {hasEst ? `${stages.length || '·'} ${t('stage_short_suffix')}` : t('empty')}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* STAGES LIST */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
          {t('loading')}
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {t('no_stages_for_block')}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {t('no_stages_hint')}
          </p>
          {/* The Smeta yuklash CTA used to live here too. Removed per
             user request — uploads are exclusively handled from
             Moliya → Smetalar. */}
        </div>
      ) : (
        <div className="space-y-3">
          {stages.map((stage) => {
            const stKey = stage.name;
            const expanded = expandedStages.has(stKey);
            const status = stageStatus(stage);
            const stMeta = STATUS_META[status] || STATUS_META.pending;
            const pct = stageProgress(stage);
            const cost = stage.works.reduce((m, w) => m + Number(w.total_amount || 0), 0);
            const isLocked = status === 'confirmed_engineer';
            const hasSubmitted = stage.works.some((w) => w.approval_status === 'submitted');

            return (
              <div
                key={stKey}
                className="rounded-xl border bg-white overflow-hidden"
                style={{
                  borderColor: isLocked ? '#047857' : (hasSubmitted ? '#F59E0B' : '#E5E7EB'),
                  boxShadow: isLocked
                    ? '0 0 0 1px rgba(4,120,87,0.08)'
                    : (hasSubmitted ? '0 0 0 1px rgba(245,158,11,0.08)' : 'none'),
                }}
              >
                {/* Stage header */}
                <button
                  type="button"
                  onClick={() => toggleStage(stKey)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition text-left"
                >
                  {/* Stage chevron — mockup uses a CSS-rotated ▶ arrow. */}
                  <span
                    className="text-slate-400 text-[14px] leading-none transition-transform inline-block w-4"
                    style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}
                  >▶</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <div className="font-bold text-slate-900 text-[14px]">
                        {stage.name === UNCATEGORISED_KEY ? t('uncategorized') : stage.name}
                      </div>
                      <span
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: stMeta.bg,
                          color: stMeta.fg,
                          border: `1px solid ${stMeta.border}`,
                        }}
                      >
                        {t(stMeta.longKey)}
                      </span>
                      {isLocked && (
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <span className="text-[12px] leading-none">🔒</span> {t('locked')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-slate-500">
                      {/* Mockup: "1 подэтап · 6 работ" — show the sub-stage
                         count when the stage has any, before the work count. */}
                      {(stage.subStages?.length || 0) > 0 && (
                        <>
                          {stage.subStages.length} {t('substages_suffix')} ·
                        </>
                      )}
                      {stage.works.length + (stage.subStages || []).reduce((m, s) => m + s.works.length, 0)} {t('works_suffix')}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 min-w-[160px]">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      {/* Stage progress fill — exact gradient from
                         construction_module_v2.html .stage-progress-fill. */}
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #0E9484, #047857)',
                        }}
                      />
                    </div>
                    <div className="text-[11px] font-bold text-emerald-700 min-w-[36px] text-right">
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                  <div
                    className="hidden md:flex items-center justify-end gap-1.5 text-[13px] font-bold min-w-[140px] text-right"
                    style={{ color: canSeeCost ? '#0F172A' : '#CBD5E1', fontStyle: canSeeCost ? 'normal' : 'italic' }}
                  >
                    {canSeeCost
                      ? <span>{fmt(Math.round(cost))} {t('soum')}</span>
                      : <span className="inline-flex items-center gap-1.5"><span className="text-[14px] leading-none">🔒</span> {t('hidden')}</span>}
                  </div>
                </button>

                {/* Stage content — sub-stages if the works' item_numbers
                   carry a hierarchical layer, flat works table otherwise. */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <StageBody
                      stage={stage}
                      canSeeCost={canSeeCost}
                      canEditQty={canEditQty}
                      canSubmitToSupervisor={canSubmitToSupervisor}
                      canConfirmAsSupervisor={canConfirmAsSupervisor}
                      canRejectAsSupervisor={canRejectAsSupervisor}
                      canConfirmAsEngineer={canConfirmAsEngineer}
                      canRejectAsEngineer={canRejectAsEngineer}
                      doneDraft={doneDraft}
                      setDoneDraft={setDoneDraft}
                      onUpdateDone={updateDone}
                      onSubmit={submitWork}
                      onConfirmSupervisor={confirmAsSupervisor}
                      onRejectSupervisor={rejectAsSupervisor}
                      onConfirmEngineer={confirmAsEngineer}
                      onRejectEngineer={rejectAsEngineer}
                      viewRole={viewRole}
                      t={t}
                    />

                    {/* Stage-level batch actions */}
                    <StageActions
                      stage={stage}
                      viewRole={viewRole}
                      onSubmitAll={submitAllInStage}
                      onConfirmAllSupervisor={confirmAllSupervisor}
                      onConfirmAllEngineer={confirmAllEngineer}
                      t={t}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom confirmation modal — replaces window.confirm() so the
         lock prompt matches the v2 mockup styling. */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          body={confirmModal.body}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={() => { const cb = confirmModal.onConfirm; setConfirmModal(null); cb && cb(); }}
          onCancel={() => setConfirmModal(null)}
          t={t}
        />
      )}
    </div>
  );
}

// =====================================================================
// CONFIRM MODAL
// =====================================================================
function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, t }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
         style={{ background: 'rgba(15,23,42,0.5)' }}
         onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-[520px] w-[90%] shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed mb-5 whitespace-pre-line">{body}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center gap-1.5"
          >
            <span className="text-[14px] leading-none">✓</span>
            {confirmLabel || (t('confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// STAGE BODY — renders sub-stages declared by the importer (preferred)
// or falls back to the item-number heuristic. Direct works of the stage
// (works that live at the parent's level, NOT under any sub-stage) are
// rendered first, before the sub-stage cards.
// =====================================================================
function StageBody(props) {
  // Prefer the explicit hierarchy emitted by SmetaImportModal /
  // deriveStages: each sub-stage already carries its own works list.
  const explicitSubs = props.stage.subStages || [];
  // Fall back to the item_number heuristic only when no explicit subs
  // came through, AND the works themselves carry hierarchical numbering.
  const heuristicSubs = useMemo(
    () => (explicitSubs.length === 0 ? buildSubStages(props.stage.works) : null),
    [props.stage.works, explicitSubs.length],
  );

  const subs = explicitSubs.length > 0
    ? explicitSubs.map((s) => ({ key: s.name, name: s.name, works: s.works }))
    : (heuristicSubs || []);

  const directWorks = props.stage.works;

  if (subs.length === 0) {
    // Flat layout: just a works table.
    return <WorksTable {...props} works={directWorks} />;
  }

  return (
    <div className="space-y-3">
      {/* Stage's own works (e.g. ПЕРЕКРЫТИЕ has works of its own AND
         a МОНОЛИТНЫЕ УЧАСТКИ sub-stage). Render them first so the
         direct work list isn't visually buried under the sub-stages. */}
      {directWorks.length > 0 && (
        <WorksTable {...props} works={directWorks} />
      )}
      {subs.map((ss) => (
        <SubStageCard key={ss.key || ss.name} sub={ss} {...props} />
      ))}
    </div>
  );
}

function SubStageCard({ sub, ...props }) {
  const [open, setOpen] = useState(true);
  const pct = (() => {
    let plan = 0, done = 0;
    for (const w of sub.works) {
      const c = Number(w.total_amount || 0);
      plan += c;
      const ratio = Number(w.quantity || 0) > 0
        ? Math.min(Number(w.done_quantity || 0) / Number(w.quantity || 0), 1)
        : 0;
      done += c * ratio;
    }
    return plan > 0 ? (done / plan) * 100 : 0;
  })();
  const cost = sub.works.reduce((m, w) => m + Number(w.total_amount || 0), 0);
  const finalised = sub.works.filter((w) => w.approval_status === 'confirmed_engineer').length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 bg-slate-50 hover:bg-slate-100 transition text-left"
      >
        <span className="text-slate-400 text-[12px] leading-none transition-transform inline-block w-3"
              style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        <span className="text-base leading-none">📂</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-blue-700 truncate">
            {sub.name || `${props.t('subgroup')} ${sub.key}`}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 min-w-[160px]">
          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden min-w-[60px]">
            <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10.5px] font-bold text-emerald-700 min-w-[28px] text-right">
            {pct.toFixed(0)}%
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
          {finalised}/{sub.works.length} {props.t('works_suffix')}
        </span>
        {props.canSeeCost && (
          <span className="hidden md:inline-block font-mono text-[11.5px] text-slate-700 min-w-[120px] text-right font-semibold">
            {fmt(Math.round(cost))} {props.t('soum')}
          </span>
        )}
      </button>
      {open && (
        <div className="p-2">
          <WorksTable {...props} works={sub.works} />
        </div>
      )}
    </div>
  );
}

// =====================================================================
// STAT CARD
// =====================================================================
function StatCard({ label, value, sub, variant }) {
  const valueColor = {
    green: '#047857',
    amber: '#B45309',
    blue: '#1E40AF',
  }[variant] || '#0F172A';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] text-slate-500 mb-1.5">{label}</div>
      <div className="text-[22px] font-bold font-mono tabular-nums" style={{ color: valueColor }}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

// =====================================================================
// STAGE ACTIONS
// =====================================================================
function StageActions({ stage, viewRole, onSubmitAll, onConfirmAllSupervisor, onConfirmAllEngineer, t }) {
  const works = stage.works;
  const submittedCount   = works.filter((w) => w.approval_status === 'submitted').length;
  const supConfirmed     = works.filter((w) => w.approval_status === 'confirmed_supervisor').length;
  const engConfirmed     = works.filter((w) => w.approval_status === 'confirmed_engineer').length;

  const canSubmitAny  = viewRole === 'foreman'    && works.some((w) => Number(w.done_quantity || 0) > 0 && (w.approval_status === 'pending' || w.approval_status === 'in_progress'));
  const canConfirmAny = viewRole === 'supervisor' && works.some((w) => w.approval_status === 'submitted');
  const canFinalAny   = viewRole === 'engineer'   && works.some((w) => w.approval_status === 'confirmed_supervisor');

  return (
    <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200 flex items-center justify-between flex-wrap gap-2">
      <div className="text-[11.5px] text-slate-500">
        {t('total_works')}: <b className="text-slate-900">{works.length}</b>
        {' · '}{t('on_review')}: <b>{submittedCount}</b>
        {' · '}{t('supervisor_confirmed')}: <b>{supConfirmed}</b>
        {' · '}<span className="text-emerald-700">{t('finally_confirmed')}: <b>{engConfirmed}</b></span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {canSubmitAny && (
          <button onClick={() => onSubmitAll(stage)}
                  className="px-4 py-2 rounded-md text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white inline-flex items-center gap-1.5">
            <span className="text-[14px] leading-none">📤</span> {t('all_to_review')}
          </button>
        )}
        {canConfirmAny && (
          <button onClick={() => onConfirmAllSupervisor(stage)}
                  className="px-4 py-2 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white inline-flex items-center gap-1.5">
            <span className="text-[14px] leading-none">✓</span> {t('confirm_all_supervisor')}
          </button>
        )}
        {canFinalAny && (
          <button onClick={() => onConfirmAllEngineer(stage)}
                  className="px-4 py-2 rounded-md text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center gap-1.5">
            <span className="text-[14px] leading-none">🛠️</span> {t('finalize_all')}
          </button>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// WORKS TABLE
// =====================================================================
function WorksTable({
  works,
  canSeeCost,
  canEditQty,
  canSubmitToSupervisor,
  canConfirmAsSupervisor,
  canRejectAsSupervisor,
  canConfirmAsEngineer,
  canRejectAsEngineer,
  doneDraft, setDoneDraft,
  onUpdateDone, onSubmit,
  onConfirmSupervisor, onRejectSupervisor,
  onConfirmEngineer, onRejectEngineer,
  viewRole, t,
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-center py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 40 }}>#</th>
            <th className="text-left   py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500">{t('work_name')}</th>
            <th className="text-center py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 90 }}>{t('unit')}</th>
            <th className="text-right  py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 100 }}>{t('plan')}</th>
            <th className="text-right  py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 130 }}>{t('done')}</th>
            <th className="text-center py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 130 }}>{t('progress')}</th>
            {canSeeCost && (<>
              <th className="text-right py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 120 }}>{t('unit_price')}</th>
              <th className="text-right py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 150 }}>{t('plan_total')}</th>
              <th className="text-right py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 150 }}>{t('fact_total')}</th>
            </>)}
            <th className="text-center py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 130 }}>{t('status')}</th>
            <th className="text-center py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 200 }}>{t('action')}</th>
          </tr>
        </thead>
        <tbody>
          {works.map((w, idx) => {
            const isLocked = w.approval_status === 'confirmed_engineer';
            const isSupConfirmed = w.approval_status === 'confirmed_supervisor';
            const rowBg = isLocked ? '#F0FDF4' : (isSupConfirmed ? '#FEF7E0' : 'transparent');
            const planQty = Number(w.quantity || 0);
            const doneQty = Number(w.done_quantity || 0);
            const pct = planQty > 0 ? Math.min((doneQty / planQty) * 100, 100) : 0;
            const stMeta = STATUS_META[w.approval_status] || STATUS_META.pending;
            const draftKey = `q_${w.id}`;
            const inputValue = doneDraft[draftKey] !== undefined ? doneDraft[draftKey] : fmt(doneQty);

            return (
              <tr key={w.id} style={{ background: rowBg, borderTop: '1px solid #F1F5F9' }}>
                <td className="text-center py-2.5 px-3 font-bold">{w.item_number || (idx + 1)}</td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-slate-900">{w.name}</div>
                  {w.code && (
                    <div className="text-[10.5px] text-slate-400 font-mono">{cleanCode(w.code)}</div>
                  )}
                </td>
                <td className="text-center py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10.5px] font-semibold">
                    {w.uom || ''}
                  </span>
                </td>
                <td className="text-right py-2.5 px-3 font-mono">{fmt(planQty)}</td>
                <td className="text-right py-2.5 px-3">
                  {canEditQty(w) ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inputValue}
                      onChange={(e) => setDoneDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
                      onBlur={(e) => {
                        const draft = doneDraft[draftKey];
                        if (draft !== undefined) {
                          onUpdateDone(w, e.target.value);
                          setDoneDraft((d) => { const n = { ...d }; delete n[draftKey]; return n; });
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-[90px] px-2 py-1 rounded border border-slate-300 font-mono text-right text-[11.5px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  ) : (
                    <span className="font-mono text-slate-500">{fmt(doneQty)}</span>
                  )}
                </td>
                <td className="text-center py-2.5 px-3">
                  <div className="inline-flex items-center gap-2 min-w-[100px]">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden min-w-[50px]">
                      <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10.5px] font-bold text-emerald-700 min-w-[28px] text-right">
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                </td>
                {canSeeCost && (<>
                  <td className="text-right py-2.5 px-3 font-mono">{fmt(Number(w.unit_rate || 0))}</td>
                  <td className="text-right py-2.5 px-3 font-mono font-semibold">{fmt(Math.round(Number(w.total_amount || 0)))}</td>
                  <td className="text-right py-2.5 px-3 font-mono text-emerald-700">
                    {fmt(Math.round(Math.min(doneQty, planQty) * Number(w.unit_rate || 0)))}
                  </td>
                </>)}
                <td className="text-center py-2.5 px-3">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full inline-flex items-center gap-1"
                    style={{
                      background: stMeta.bg,
                      color: stMeta.fg,
                      border: `1px solid ${stMeta.border}`,
                    }}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: stMeta.dot }} />
                    {t(stMeta.shortKey)}
                  </span>
                </td>
                <td className="text-center py-2.5 px-3">
                  {isLocked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                      <span className="text-[12px] leading-none">🔒</span> {t('locked')}
                    </span>
                  ) : canSubmitToSupervisor(w) ? (
                    <button onClick={() => onSubmit(w)}
                            className="px-3 py-1 rounded-md text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 text-white inline-flex items-center gap-1">
                      <span className="text-[12px] leading-none">📤</span> {t('to_review')}
                    </button>
                  ) : canConfirmAsSupervisor(w) ? (
                    <div className="inline-flex gap-1">
                      <button onClick={() => onConfirmSupervisor(w)}
                              className="px-3 py-1 rounded-md text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white inline-flex items-center gap-1">
                        <span className="text-[12px] leading-none">✓</span> {t('confirm')}
                      </button>
                      <button onClick={() => onRejectSupervisor(w)}
                              title={t('reject_to_foreman')}
                              className="w-7 h-7 rounded-md inline-flex items-center justify-center bg-white text-red-600 border border-red-300 hover:bg-red-50">
                        <span className="text-[12px] leading-none">↩</span>
                      </button>
                    </div>
                  ) : canConfirmAsEngineer(w) ? (
                    <div className="inline-flex gap-1">
                      <button onClick={() => onConfirmEngineer(w)}
                              className="px-3 py-1 rounded-md text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center gap-1">
                        <span className="text-[12px] leading-none">🛠️</span> {t('finalize')}
                      </button>
                      <button onClick={() => onRejectEngineer(w)}
                              title={t('reject_to_supervisor')}
                              className="w-7 h-7 rounded-md inline-flex items-center justify-center bg-white text-red-600 border border-red-300 hover:bg-red-50">
                        <span className="text-[12px] leading-none">↩</span>
                      </button>
                    </div>
                  ) : w.approval_status === 'submitted' && viewRole !== 'supervisor' ? (
                    <span className="text-[11px] text-slate-400">{t('waits_supervisor')}</span>
                  ) : w.approval_status === 'confirmed_supervisor' && viewRole !== 'engineer' ? (
                    <span className="text-[11px] text-slate-400">{t('waits_engineer')}</span>
                  ) : (
                    <span className="text-[11px] text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
