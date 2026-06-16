import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
// Lucide retained only for the Loader2 spinner; every other affordance
// in this tab uses emoji exactly as the v2 mockup does (📤 ✓ 🛠️ ↩ 🔒 …).
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useAuth } from '@/components/contexts/AuthContext';
import { useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { formatApiError } from '@/utils/apiErrors';
import AddResourcePickerModal from '@/components/construction/AddResourcePickerModal';
import AddSubWorkModal from '@/components/construction/AddSubWorkModal';
import { sortLinesManualFirst, sortLinesManualFirstInPlace } from '@/components/construction/utils/sortLines';

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

// Up to 6 fractional digits with trailing zeros dropped, so imported
// per-unit norms (e.g. 0.758) and partial-unit quantities don't get
// truncated to 2 decimals. Soum-rounded monetary values render unchanged.
const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 6 }).replace(/\u00A0/g, ' ');
};

// Aggressive name-key for cross-sheet lookups. Excel imports of the
// Единич and ВОР sheets disagree on whitespace around punctuation
// ("В7,5 / М-100/" vs "В7,5 /М-100/") often enough that a plain
// trim+lowercase missed real matches. Strip all whitespace (regular
// + non-breaking) and lowercase so the key reflects only the meaningful
// characters of the work name.
const normName = (s) => String(s || '').toLowerCase().replace(/[\s\u00A0]+/g, '');

// Composite key for ВОР → Единич cross-sheet lookups. Some Excel files
// pack multiple sub-blocks into one ВОР sheet (e.g. the "Жавохир Авеню
// Блок 2 Угловой" file has TWO typologies under "Блок №2" with
// IDENTICAL work names — "УСТРОЙСТВО БЕТОННОЙ ПОДГОТОВКИ ..." appears
// twice, once with qty 0.598 and once with qty 0.2013). Keying the
// lookup map by name alone made the second occurrence overwrite the
// first, so Bosqichlar's REJA picked up 0.2013 instead of the matching
// 0.598. Folding section (parent_item_number) + uom into the key keeps
// duplicates separate; we still build a name-only fallback map for
// files where Единич and ВОР disagree on section labels.
const compoundKey = (section, name, uom) =>
  `${normName(section)}|${normName(name)}|${normName(uom)}`;

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
  const rt = String(line?.resource_type || '').trim().toLowerCase();
  if (rt !== '') return false; // anything with a resource_type is labour/machine/material — never a work
  const pid = line?.parent_line_id;
  if (pid != null && Number(pid) !== 0) {
    // It's attached to a parent. A sub-stage created via "Yangi etap" in
    // Smeta boshqaruvi has parent_line_id set + resource_type='' +
    // norm_rate=0; we want those to surface as their own work rows in
    // Bosqichlar (alongside the parent work, in the same section). A
    // sub-line with norm_rate>0 is a quantity-driven derivation row that
    // doesn't belong as its own work.
    const norm = Number(line?.norm_rate || 0);
    return norm === 0;
  }
  return true; // top-level work
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
  // For sub-stages we want to use the PARENT WORK'S parent_item_number
  // (the section path) as the bucket — not the sub-stage's own stored
  // parent_item_number, which is just the parent's item_number ("13") on
  // older data. Building a quick lookup so the bucketing pass below can
  // resolve a sub-stage's effective section in O(1).
  const linesById = new Map();
  for (const l of lines || []) {
    linesById.set(Number(l.id), l);
  }
  // First pass: bucket works by their full path string (so identical
  // paths land in the same bucket).
  const byPath = new Map();
  for (const w of works) {
    let path;
    const pid = Number(w.parent_line_id || 0);
    if (pid > 0) {
      // Sub-stage — inherit the parent work's section (parent_item_number
      // on the parent row). Fall back to the sub-stage's own field, then
      // UNCATEGORISED, in case the parent has been deleted.
      const parent = linesById.get(pid);
      const parentSection = parent?.parent_item_number ? String(parent.parent_item_number) : '';
      path = parentSection || (w.parent_item_number ? String(w.parent_item_number) : UNCATEGORISED_KEY);
    } else {
      path = w.parent_item_number ? String(w.parent_item_number) : UNCATEGORISED_KEY;
    }
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
// resolveQty(work) — caller-supplied lookup so the same helpers can use
// either the work's own qty (legacy / non-template estimates) or the
// matching ВОР Miqdor (template mode, where w.quantity is 0). Defaults
// to the legacy behaviour when no resolver is given.
function progressFromWorks(works, resolveQty) {
  if (!works || works.length === 0) return 0;
  let costPlan = 0, costDone = 0;
  let qtyRatioSum = 0, qtyRatioCount = 0;
  for (const w of works) {
    const cost  = Number(w.total_amount || 0);
    const qty   = resolveQty ? Number(resolveQty(w) || 0) : Number(w.quantity || 0);
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

function stageProgress(stage, resolveQty) {
  return progressFromWorks(allStageWorks(stage), resolveQty);
}

function blockProgress(stages, resolveQty) {
  let plan = 0, done = 0;
  let qtyRatioSum = 0, qtyRatioCount = 0;
  for (const s of stages) {
    for (const w of allStageWorks(s)) {
      const cost  = Number(w.total_amount || 0);
      const qty   = resolveQty ? Number(resolveQty(w) || 0) : Number(w.quantity || 0);
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
  const isAdminLike = (typeof isSiteAdmin === 'function' && isSiteAdmin())
    || (typeof isOwner === 'function' && isOwner());
  // Every workflow role the backend says this user holds on the project
  // (from my-role's `roles`). Drives the switcher for multi-role users.
  const [myRoles, setMyRoles] = useState([]);
  // The switcher shows for admins/owners (who can impersonate any role) and
  // for regular users assigned to MORE THAN ONE role, so they can act as
  // each of theirs. A single-role user just lives with that one role.
  const canSwitchRole = isAdminLike || myRoles.length > 1;
  // Permission gating for the per-stage trash button. Admins/owners/
  // site-admins are auto-true via the hook; regular employees only see
  // the delete affordance when their role grants `construction.delete`.
  const { canDelete: canDeletePermFn } = useEmployeePermissions();
  const canDeleteConstruction = canDeletePermFn('construction');

  // ── Data state ───────────────────────────────────────────────────
  const [buildings, setBuildings] = useState([]);    // act as v2's "blocks"
  const [estimates, setEstimates] = useState([]);    // current building → primary estimate
  const [activeBuildingId, setActiveBuildingId] = useState(null);
  const [lines, setLines] = useState([]);            // works of the active estimate
  const [activeEstimateId, setActiveEstimateId] = useState(null); // edinich estimate id of active building
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // bump to force a reload
  const [buildingStageCounts, setBuildingStageCounts] = useState({}); // buildingId → stage count

  // ── Infinite-scroll render window ─────────────────────────────────
  // The full lines/stages stay in memory (progress %, totals, Forma 2,
  // material engine all see everything); we only paint the first N
  // stages and reveal more as the user scrolls — no page button.
  const STAGES_PER_PAGE = 20;
  const [visibleStageCount, setVisibleStageCount] = useState(STAGES_PER_PAGE);
  const stagesLoadMoreRef = React.useRef(null);

  // Manually-added stages — rows from construction_stages that don't have
  // any works yet under their name. The Bosqichlar list is normally derived
  // from estimate-work parent paths (deriveStages below), so a stage with
  // zero works wouldn't render at all. We fetch listStages for the active
  // building and merge any whose name isn't already represented by derived
  // stages, rendered as empty cards (0 works, 0%, pending status).
  const [manualStages, setManualStages] = useState([]); // [{id, name, building_id, ...}]

  // "+ Bosqich qo'shish" modal state. null = closed; { name } = open with a
  // draft name field. Submission calls createStage on the server, then
  // bumps refreshTick so the merged list pulls the new row in.
  const [addStageModal, setAddStageModal] = useState(null);
  const [addStageBusy, setAddStageBusy] = useState(false);

  // ── Forma 2 iterations (migration 419) ───────────────────────────
  // Multi-run Forma 2 series. iterations[] is ordered oldest→newest by
  // iteration_seq. activeIterationId controls which tab is selected;
  // null/undefined means "the open one" (current). Frozen iterations
  // display read-only — the fakt inputs are disabled and the cumulative
  // progress is rendered as it stood at freeze time.
  //
  // Creating/freezing and deleting Forma 2 iterations lives on the Smeta
  // boshqaruvi tab. Here the strip is display-only — selecting a tab just
  // changes which iteration's period_fakt the works table shows.
  const [iterations, setIterations] = useState([]);             // [{id, iteration_seq, status, ...}]
  const [activeIterationId, setActiveIterationId] = useState(null);
  // Per-iteration period_fakt for the currently SELECTED iteration tab.
  // Map<estimate_line_id, period_fakt>. Rebuilt every time the user
  // switches tabs or the lines refresh. Used as the BAJARILDI input
  // value so the new iteration starts at 0 even though
  // line.done_quantity (the cumulative) carries the prior progress.
  // The PROGRESS bar still reads done_quantity so cumulative completion
  // stays visible across iterations — exactly what the user described:
  // "new tab takes fakt as 0 but progress stays same."
  const [periodFaktByLine, setPeriodFaktByLine] = useState(new Map());

  // IDs of stages the user added via "+ Bosqich qo'shish".
  //
  // Persisted in localStorage (per project) so the "user-added at top"
  // ordering survives page reloads. We can't infer this from the
  // backend alone because:
  //   • construction_stages has no `is_user_created` flag — both manual
  //     and auto-import paths use the same createStage endpoint.
  //   • Multiple єдинич estimates in a block produce many auto-stage
  //     rows; only ONE єдинич is loaded into `lines` at a time, so the
  //     other імports' stages appear "empty" and would otherwise outrank
  //     the user's own stage in an id-DESC sort.
  // Marking explicitly is the cleanest discriminator without a backend
  // change. Modal save handler below pushes the new id; the stages
  // useMemo filters by Set membership.
  const manualIdsStorageKey = project?.id ? `manualStageIds:${project.id}` : '';
  const [recentlyAddedStageIds, setRecentlyAddedStageIds] = useState(() => {
    if (!project?.id) return [];
    try {
      const raw = window.localStorage.getItem(`manualStageIds:${project.id}`);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    } catch { return []; }
  });
  const persistManualIds = useCallback((ids) => {
    if (!manualIdsStorageKey) return;
    try { window.localStorage.setItem(manualIdsStorageKey, JSON.stringify(ids)); }
    catch { /* quota / disabled — ignore, in-memory state still works */ }
  }, [manualIdsStorageKey]);

  // Parent stage name for the "+ Sub-bosqich" modal. When set, the
  // AddSubWorkModal opens in section mode and creates a new sub-stage
  // (an estimate line whose parent_item_number = `${parentStage} › ${name}`).
  // This gives the user the richer form (code/name/uom/qty) they
  // expected, mirroring the "Yangi qo'shimcha etap" dialog in Smeta
  // boshqaruvi instead of the simpler name-only AddStageModal.
  const [addSubBosqichParent, setAddSubBosqichParent] = useState(null);
  // ВОР Miqdor lookup for the active building. Bosqichlar drives its
  // works off the Единич estimate (which is now imported in template
  // mode with quantity=0), but the user-visible REJA column wants the
  // planned project quantity that lives in the ВОР smeta. We build a
  // name-keyed map of ВОР qty for the same building so each work row
  // can override its planQty without losing the cascade math elsewhere.
  // Map<lowercase-trimmed-name, number>
  // ВОР plan-quantity lookups. Holds two maps so duplicates in one
  // file (same work name in different sub-blocks of one ВОР sheet)
  // resolve correctly: `strict` keys by section + name + uom, `loose`
  // keys by name only. resolveWorkQty + the WorkTable JSX try strict
  // first, then fall back to loose.
  const [vorPlanByName, setVorPlanByName] = useState(() => ({
    // byItem — keyed by the row's item_number (the № column the user
    // sees on the printed smeta). When єдинич and ВОР come from the
    // same source XLSX their row numbers are aligned, so this gives a
    // deterministic match even when the SAME work name+code appears
    // in multiple sections (e.g. УСТРОЙСТВО ПОЯСОВ at rows 33, 52, 109
    // — all with code E0603-002-01 but different planned qtys).
    byItem: new Map(),
    strict: new Map(),
    loose: new Map(),
  }));

  // ── Add-resource modal ────────────────────────────────────────────
  // Foreman clicks "+" on a work row → modal lets them pick a resource
  // from the project's smeta resources, enter a quantity, and the new
  // sub-line attaches to the work via parent_line_id. From there the
  // standard reserve-on-submit / deduct-on-engineer-confirm pipeline
  // handles inventory automatically.
  const [addResWorkParent, setAddResWorkParent] = useState(null);

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

  // ── Per-work expansion (resource breakdown) ──────────────────────
  // The user wants to see "what gets consumed" per work — labour, machines,
  // materials sized as parent.done_quantity × subline.norm_rate. The data
  // is already in `lines` (every estimate sub-line has parent_line_id =
  // its work). We just toggle a Set of work IDs to control visibility.
  const [expandedWorks, setExpandedWorks] = useState(new Set());
  const toggleWork = useCallback((id) => setExpandedWorks((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  }), []);

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
        const list = (Array.isArray(rows) ? rows : []).slice().sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
        );
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
        setMyRoles(Array.isArray(r?.roles) ? r.roles : (r?.role ? [r.role] : []));
        // Default the viewer to the user's real (primary) role; tenant
        // admins (no role assigned) start in foreman view, matching the v2
        // mockup's default selection.
        setViewRole(r?.role || 'foreman');
      })
      .catch(() => { /* leave realRole empty → admin/demo mode */ });
    return () => { cancelled = true; };
  }, [project?.id]);

  // ── Load Forma 2 iterations ──────────────────────────────────────
  // Refresh on project change AND on refreshTick so the freeze button
  // can trigger a reload without re-running everything else.
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    constructionService.listForm2Iterations(project.id)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setIterations(list);
        // Default to the open iteration so the user lands on the
        // editable view. If none is open (shouldn't happen post-
        // migration 419), fall back to the newest.
        const openOne = list.find((it) => it.status === 'open');
        const fallback = list[list.length - 1];
        setActiveIterationId((cur) => {
          if (cur && list.some((it) => it.id === cur)) return cur;
          return (openOne || fallback)?.id ?? null;
        });
      })
      .catch(() => { /* iterations load is non-blocking; bosqichlar still renders */ });
    return () => { cancelled = true; };
  }, [project?.id, refreshTick]);

  // ── Load per-line period_fakt for the active iteration ───────────
  // Without this every BAJARILDI input would show the cumulative
  // done_quantity, defeating the whole "new iter starts at 0" point.
  // GetForm2IterationLines returns [{estimate_line_id, period_fakt}, …]
  // for the selected iter; we turn it into a Map keyed by line id so
  // the WorksTable can look up O(1) per row.
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
      .catch(() => { /* leave empty; rows default to 0 in the input */ });
    return () => { cancelled = true; };
  }, [project?.id, activeIterationId, refreshTick]);

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
        // Pick the LATEST єdinich for this block (highest id) when the
        // block has been re-imported multiple times. `find()` used to
        // pick whatever came first in the API order, which is typically
        // id ASC — so old imports without `original_quantity` (column
        // added by migration 349) would win, leaving REJA stuck at 0
        // even after the user reimported a fresh file. Sorting DESC by
        // id makes the most recent import authoritative.
        const sortedEdinich = sameBuilding
          .filter((e) => String(e.source_type || '').toLowerCase() === 'edinich')
          .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        let matchedEst = sortedEdinich[0] || null;
        // ВОР side-fetch — same building. Used only to source the user-
        // facing REJA quantity for each work; the actual stage tree
        // still comes from единич. Done in parallel with the единич
        // line fetch below to avoid a serial round-trip.
        // Same "latest wins" rule for ВОР as for єдинич — old ВОР
        // imports may not match the current єдинич's section structure.
        const sortedVor = sameBuilding
          .filter((e) => String(e.source_type || '').toLowerCase() === 'vor')
          .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        const vorEst = sortedVor[0] || null;
        if (!matchedEst) {
          setLines([]);
          setActiveEstimateId(null);
          setVorPlanByName({ byItem: new Map(), strict: new Map(), loose: new Map() });
          setLoading(false);
          return;
        }
        setActiveEstimateId(matchedEst.id);
        try {
          // ВОР side-fetch stays a SINGLE request: it isn't rendered, it
          // only feeds the REJA plan-qty maps below, which must be complete
          // before works show a correct planned quantity.
          const vorRows = vorEst
            ? await constructionService.listEstimateLines(vorEst.id, { page_size: 5000 }).catch(() => [])
            : [];
          if (cancelled) return;
          // Единич lines (the rendered stage tree) — pulled in ONE request.
          // The web app derives the whole stage tree, progress and budget
          // from the full set, so paging it 20-at-a-time only caused a slow,
          // flickering load on big blocks. (Mobile uses the 20-paged lines
          // endpoint + the /summary endpoint instead.) The `cancelled` guard
          // above already drops a stale load when the user switches block.
          const rows = await constructionService.listEstimateLines(matchedEst.id, { page_size: 5000 });
          if (cancelled) return;
          setLines(Array.isArray(rows) ? rows : (rows?.data || rows?.items || []));
          setLoading(false);
          // Build the name → qty map. Excel files often disagree on
          // whitespace between the Единич and ВОР sheets — e.g.
          // "В7,5 / М-100/" vs "В7,5 /М-100/" — so we normalise by
          // stripping ALL whitespace (regular + non-breaking) and
          // lowercasing. Plain lowercase-trim wasn't aggressive enough
          // and was missing matches where a single stray space lived
          // between a digit and a slash. A work missing from the map
          // still silently falls back to its own (zero) planQty.
          const vorList = Array.isArray(vorRows) ? vorRows : (vorRows?.data || vorRows?.items || []);
          // Build TWO maps: a strict (section + name + uom) one and a
          // loose (name only) fallback. resolveWorkQty below tries
          // strict first; this matters for files that pack multiple
          // sub-blocks into one ВОР sheet, where the same work name
          // appears with different quantities (e.g. "Жилдом Жавохир
          // Авеню Блок 2 Угловой" — see compoundKey doc above). For
          // files where Единич and ВОР disagree on section labels,
          // the loose map still rescues the lookup.
          const byItem = new Map();
          const strict = new Map();
          const loose = new Map();
          for (const r of vorList) {
            // Skip sub-lines (resource breakdown) — only top-level work
            // rows carry a planned project quantity.
            if (r.parent_line_id) continue;
            const n = normName(r.name);
            if (!n) continue;
            // Read the planned figure with the SAME priority the
            // Smetalar (EstimatesTab) tab uses to display it:
            //   1. imported_quantity — file's literal value preserved
            //      by migration 413 (col F on Единич / Кол-во on ВОР).
            //   2. original_quantity — parent-only anchor from
            //      migration 349 (for rows that predate 413).
            //   3. live `quantity` — last fallback for legacy rows.
            //
            // Without this priority chain, ВОР rows whose ledger
            // `quantity` was overwritten after import (or whose
            // template-mode import zero'd quantity but preserved
            // imported_quantity) feed Bosqichlar a wrong REJA — the
            // user sees Smetalar's 0.301 but Bosqichlar's 0.1893.
            const imp = Number(r.imported_quantity || 0);
            const oq  = Number(r.original_quantity || 0);
            const lq  = Number(r.quantity || 0);
            const q = imp > 0 ? imp : (oq > 0 ? oq : lq);
            if (!(q > 0)) continue;

            // byItem — keyed on item_number (the printed row #). This is
            // the user-confirmed disambiguator for files where the same
            // work name+code appears in multiple sections with different
            // planned qtys. We also key on (item_number, code) so a
            // mismatched code wouldn't accidentally hit the wrong row.
            const itemNum = String(r.item_number || '').trim();
            if (itemNum) {
              const codeKey = String(r.code || '').trim().toLowerCase();
              if (!byItem.has(itemNum)) byItem.set(itemNum, q);
              const dualKey = `${itemNum}|${codeKey}`;
              if (!byItem.has(dualKey)) byItem.set(dualKey, q);
            }

            const key = compoundKey(r.parent_item_number, r.name, r.uom);
            // First-write-wins for strict so the original section's qty
            // sticks; later duplicates land under their own section
            // anyway (different parent_item_number = different key).
            if (!strict.has(key)) strict.set(key, q);
            // For the loose map we ALSO want first-write-wins. Without
            // this guard the second occurrence of a duplicated name
            // (e.g. the second sub-typology in the same Excel) would
            // overwrite the first and reintroduce the original bug.
            if (!loose.has(n)) loose.set(n, q);
          }
          setVorPlanByName({ byItem, strict, loose });
        } catch (e) {
          if (!cancelled) toast.error(formatApiError(e, t, 'Xatolik'));
        }
      })
      .catch((e) => { if (!cancelled) toast.error(formatApiError(e, t, 'Xatolik')); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, activeBuildingId, refreshTick]);

  // Per-building stage counts — fetched once per estimates list change so
  // each block button can show its own etap count instead of repeating the
  // active building's count.
  useEffect(() => {
    if (!estimates || estimates.length === 0) {
      setBuildingStageCounts({});
      return;
    }
    let cancelled = false;
    const edinich = estimates.filter(
      (e) => String(e.source_type || '').toLowerCase() === 'edinich'
    );
    Promise.all(
      edinich.map((est) =>
        constructionService.listEstimateLines(est.id, { page_size: 5000 })
          .then((rows) => {
            const arr = Array.isArray(rows) ? rows : (rows?.data || rows?.items || []);
            return [Number(est.building_id), deriveStages(arr).length];
          })
          .catch(() => [Number(est.building_id), 0])
      )
    ).then((pairs) => {
      if (cancelled) return;
      // A building can have multiple единич estimates (re-imports stack
      // up as new rows). Picking just `counts[bid] = cnt` would let the
      // last one in the array win — and depending on the sort order
      // returned by listEstimates, "last" could mean the OLDEST half-
      // imported test row that has very few stages. Take the MAX so the
      // badge reflects the richest estimate, which is what the user
      // sees when they actually open the block.
      const counts = {};
      for (const [bid, cnt] of pairs) {
        counts[bid] = Math.max(counts[bid] || 0, cnt);
      }
      setBuildingStageCounts(counts);
    });
    return () => { cancelled = true; };
  }, [estimates]);

  const reload = () => setRefreshTick((n) => n + 1);

  // Cascade-delete a stage by name. Removes:
  //   • Every estimate line whose parent_item_number === stageName OR
  //     starts with `${stageName} › ` (so nested sub-stages go too).
  //   • The construction_stages row(s) sharing that name.
  // Confirmation in window.confirm shows how many works get deleted.
  // Wired to the trash button on each stage card header below.
  const removeStage = useCallback(async (stageName) => {
    if (!stageName) return;
    const matchingLines = lines.filter((ln) => {
      const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
      if (isSub) return false;
      const pin = String(ln.parent_item_number || '');
      return pin === stageName || pin.startsWith(`${stageName} › `);
    });
    const matchingStages = manualStages.filter((s) => {
      const n = String(s.name || '');
      return n === stageName || n.startsWith(`${stageName} › `);
    });
    const title = t('delete_stage') || "Bosqichni o'chirish";
    const body = (t('confirm_delete_stage_body')
      || "\"{stage}\" bosqichini va undagi {n} ta ishni o'chirmoqchimisiz?\n\nBu amalni qaytarib bo'lmaydi.")
      .replace('{stage}', stageName)
      .replace('{n}', String(matchingLines.length));
    askConfirm(title, body, async () => {
      try {
        for (const ln of matchingLines) {
          try {
            await constructionService.deleteEstimateLine(
              Number(ln.estimate_id || activeEstimateId || 0),
              ln.id,
            );
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
            /* already gone server-side; ignore */
          }
        }
        // Prune deleted IDs from the localStorage-tracked manual list
        // so it doesn't accumulate stale references over time.
        if (deletedIds.size > 0) {
          setRecentlyAddedStageIds((prev) => {
            const next = prev.filter((id) => !deletedIds.has(Number(id)));
            persistManualIds(next);
            return next;
          });
        }
        reload();
        toast.success(t('deleted') || "O'chirildi");
      } catch (e) {
        toast.error(formatApiError(e, t, 'Xatolik'));
      }
    }, t('delete') || "O'chirish");
  }, [lines, manualStages, activeEstimateId, t, askConfirm, persistManualIds]);

  // ── Fetch manually-created stages for the active building ────────
  // Stages are stored in construction_stages (migration 333 made them
  // building-scoped). Most of them are auto-created on import from the
  // Единич "СЕКЦИЯ" headers, but the user can also add them via the
  // "+ Bosqich qo'shish" button below — and those won't show up in the
  // path-derived list because they have no works yet.
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    const opts = activeBuildingId ? { buildingId: activeBuildingId } : undefined;
    constructionService.listStages(project.id, opts)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : (rows?.data || rows?.items || []);
        // Scope to the active building. listStages with a buildingId arg
        // already filters server-side; the local filter is a belt-and-
        // braces guard for the "Hammasi" case (no filter passed).
        // No sort — we preserve the backend's natural order. Newly-added
        // stages from THIS session are floated to the top separately via
        // recentlyAddedStageIds below, so we don't disturb the order of
        // auto-imported stages that already live in construction_stages.
        setManualStages(
          activeBuildingId
            ? list.filter((s) => Number(s.building_id) === Number(activeBuildingId))
            : list,
        );
      })
      .catch(() => { if (!cancelled) setManualStages([]); });
    return () => { cancelled = true; };
  }, [project?.id, activeBuildingId, refreshTick]);

  // ── Derived data ─────────────────────────────────────────────────
  // Path-derived stages (work-driven). These carry the actual progress,
  // cost, and approval state visible on each card.
  const derivedStages = useMemo(() => deriveStages(lines), [lines]);
  // Merge in manually-created empty stages — those whose name isn't
  // already represented by a derived stage. Empty stages render with
  // 0 works / 0% progress / "pending" status, which the existing
  // stage-card code path handles cleanly (stageStatus returns
  // 'pending' for ws.length === 0, progressFromWorks returns 0).
  // Once the user adds works under such a stage via Smeta boshqaruvi,
  // the derived stage takes over and the entry is no longer "empty".
  const stages = useMemo(() => {
    // Build a name → manual-stage-id index of every stage the user
    // explicitly added via "+ Bosqich qo'shish" (tracked in
    // localStorage so it survives page reloads). This lets us
    // recognise a manual stage in BOTH branches — whether it's still
    // empty (no works yet) or whether the user has since attached
    // works to it (which would otherwise have it appear in
    // derivedStages alongside imported stages).
    const userAddedSet = new Set(recentlyAddedStageIds.map(Number));
    const manualByName = new Map();
    for (const ms of manualStages) {
      if (!userAddedSet.has(Number(ms.id))) continue;
      const key = String(ms.name || '').trim().toLowerCase();
      if (!key) continue;
      if (!manualByName.has(key)) manualByName.set(key, Number(ms.id));
    }

    const derivedNames = new Set(
      derivedStages.map((s) => String(s.name || '').trim().toLowerCase()),
    );

    // Pull derived stages that match a user-added manual stage to the
    // FRONT of the list — these are user-added stages that already
    // have works, so they need their progress/cost from derived data
    // but their position must still be "pinned at top".
    //
    // A stage counts as manual when EITHER:
    //   1. Its name matches a construction_stages row tracked in
    //      localStorage (manualByName) — explicit user-add this session.
    //   2. Every work + sub-stage carries is_manual = TRUE (migration
    //      417 + backend writes).
    //
    // The earlier item_number-based heuristic was removed because it
    // false-positived for imported єдинич/ВОР works that lack a
    // pure-numeric item_number (common in files that use SHRNK codes
    // as the row identifier). Production users wanted imports left
    // in their original order — the heuristic was reshuffling them.
    const looksManualStage = (ds) => {
      const allWorks = [];
      const visit = (w) => {
        if (!w) return;
        allWorks.push(w);
        if (Array.isArray(w.subStages)) {
          for (const ss of w.subStages) visit(ss);
        }
      };
      for (const w of (ds.works || [])) visit(w);
      for (const ss of (ds.subStages || [])) visit(ss);
      if (allWorks.length === 0) return true;
      return allWorks.every((w) => w.is_manual === true);
    };

    const pinnedDerived = [];
    const restDerived   = [];
    for (const ds of derivedStages) {
      const key = String(ds.name || '').trim().toLowerCase();
      const mid = manualByName.get(key);
      if (mid != null) {
        pinnedDerived.push({ ...ds, manual_stage_id: mid });
      } else if (looksManualStage(ds)) {
        pinnedDerived.push({ ...ds, manual_stage_id: 0 });
      } else {
        restDerived.push(ds);
      }
    }

    // Empty user-added stages — those whose name isn't in
    // derivedStages because no works exist yet. Render as a 0% / 0
    // works card. Auto-import "ghost" stages (construction_stages
    // rows that AREN'T in the user-added set) are intentionally
    // hidden so they don't flood the list with empty extras.
    const userAddedEmpty = [];
    for (const ms of manualStages) {
      if (!userAddedSet.has(Number(ms.id))) continue;
      const key = String(ms.name || '').trim().toLowerCase();
      if (!key) continue;
      if (derivedNames.has(key)) continue; // covered by pinnedDerived above
      userAddedEmpty.push({
        name: ms.name,
        works: [],
        subStages: [],
        manual_stage_id: ms.id,
      });
    }

    // Newest add first (highest id) within each pinned bucket so the
    // most recent "+ Bosqich qo'shish" lands at the very top.
    const byNewest = (a, b) =>
      Number(b.manual_stage_id || 0) - Number(a.manual_stage_id || 0);
    userAddedEmpty.sort(byNewest);
    pinnedDerived.sort(byNewest);

    // Imported stages: sort by the MIN DB row id across every work they
    // contain (own works + nested sub-stage works). Bulk imports INSERT
    // rows in file order, so min id == "first row of this stage in the
    // source file." This is exactly the rule SmetaManagementTab uses for
    // its imported-section bucket — keeping the two tabs in sync is
    // important because the user navigates between them and expects the
    // same order in both.
    //
    // Item_number stays as a tiebreaker only. The earlier "sort by min
    // item_number" was correct for single-discipline files where each
    // РАЗДЕЛ continued the numbering (1, 7, 10, 17…). It broke on the
    // multi-discipline Юксалиш Тип-3 XLS where each discipline restarts
    // at 1 — KЖ's ЗЕМЛЯНЫЕ РАБОТЫ (item 1) and ВК's ХОЗ. ПИТЬЕВОЙ
    // ВОДОПРОВОД (also item 1) tied and the user got "line number
    // started from 1 multiple times" with the stages in arbitrary order.
    // Two sort keys, in priority order:
    //   1. min sort_order across every reachable work
    //   2. min line id (fallback for legacy rows with sort_order=0)
    //
    // sort_order is captured at import time as a continuously-incrementing
    // counter across the whole file (parseEdinich → buildImportPayloadFor),
    // so KЖ's rows have low sort_orders and ЛВС's rows have high ones —
    // exactly the file-order signal we need. line.id is more brittle
    // because re-imports / partial deletes can interleave the
    // auto-increment range across disciplines.
    //
    // The previous version walked w.subStages instead of node.works /
    // node.subStages, so stages whose works all lived inside sub-stages
    // (КЖ has 11 sub-stages, ZERO direct works) returned Infinity, and
    // ЛВС (no РАЗДЕЛ N. → flat works on the stage) floated to the top.
    const minStageKey = (stage, field) => {
      let min = Number.POSITIVE_INFINITY;
      const visit = (node) => {
        if (!node) return;
        const v = Number(node[field]);
        if (Number.isFinite(v) && v > 0 && v < min) min = v;
        if (Array.isArray(node.works)) {
          for (const w of node.works) visit(w);
        }
        if (Array.isArray(node.subStages)) {
          for (const ss of node.subStages) visit(ss);
        }
      };
      for (const w of (stage.works || [])) visit(w);
      for (const ss of (stage.subStages || [])) visit(ss);
      return min;
    };
    const minStageSortOrder = (stage) => minStageKey(stage, 'sort_order');
    const minStageLineId    = (stage) => minStageKey(stage, 'id');
    const minStageItemNum = (stage) => {
      let min = Number.POSITIVE_INFINITY;
      // Same recursion fix as minStageLineId above — walk node.works
      // AND node.subStages so multi-substage stages don't silently
      // tie at Infinity.
      const visit = (node) => {
        if (!node) return;
        const raw = String(node.item_number || '').trim();
        const m = raw.match(/^\d+(?:\.\d+)?/);
        if (m) {
          const n = Number(m[0]);
          if (Number.isFinite(n) && n < min) min = n;
        }
        if (Array.isArray(node.works)) {
          for (const w of node.works) visit(w);
        }
        if (Array.isArray(node.subStages)) {
          for (const ss of node.subStages) visit(ss);
        }
      };
      for (const w of (stage.works || [])) visit(w);
      for (const ss of (stage.subStages || [])) visit(ss);
      return min;
    };
    restDerived.sort((a, b) => {
      // Primary: file order via sort_order (set at import time,
      // continuously incremented across all sections — KЖ low, ЛВС high).
      const soa = minStageSortOrder(a);
      const sob = minStageSortOrder(b);
      if (soa !== sob && Number.isFinite(soa) && Number.isFinite(sob)) {
        return soa - sob;
      }
      // Secondary: min line.id (legacy / single-discipline fallback).
      const ida = minStageLineId(a);
      const idb = minStageLineId(b);
      if (ida !== idb) return ida - idb;
      // Tertiary: min item_number (last-ditch).
      const ka = minStageItemNum(a);
      const kb = minStageItemNum(b);
      if (ka !== kb) return ka - kb;
      return 0;
    });

    // Top: empty extras (no works yet) — most recent first.
    // Middle: user-added stages that now have works — most recent first.
    // Bottom: imported stages in printed-page (min item_number) order.
    return [...userAddedEmpty, ...pinnedDerived, ...restDerived];
  }, [derivedStages, manualStages, recentlyAddedStageIds]);

  // Render only the first N stages; reveal more on scroll. Full `stages`
  // is still used everywhere else (counts, progress, exports).
  const visibleStages = useMemo(
    () => stages.slice(0, visibleStageCount),
    [stages, visibleStageCount],
  );
  // Reset the window when the active block changes (fresh stage list).
  useEffect(() => {
    setVisibleStageCount(STAGES_PER_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBuildingId]);
  // Grow the window as the bottom sentinel scrolls into view.
  useEffect(() => {
    const el = stagesLoadMoreRef.current;
    if (!el) return undefined;
    if (visibleStageCount >= stages.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleStageCount((n) => Math.min(n + STAGES_PER_PAGE, stages.length));
      }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.length, visibleStageCount]);

  // Plan-quantity resolver for progress aggregations. Fallback chain:
  //   1. ВОР Miqdor (strict key: section + name + uom).
  //   2. ВОР Miqdor (loose: name only) — rescues files where section
  //      labels differ between Единич and ВОР.
  //   3. The Единич row's `original_quantity` (col F "по проектным
  //      данным", anchored at import via migration 349). This is the
  //      important fallback for projects with NO ВОР sheet: template-mode
  //      Единич imports zero out the live `quantity` ledger so the
  //      foreman can type FAKT, which made REJA render as 0 here without
  //      this fallback. original_quantity preserves the file value.
  //   4. The work's own live `quantity` — last-ditch fallback for
  //      legacy rows that predate the original_quantity anchor or for
  //      custom-added rows the user entered a value on.
  const resolveWorkQty = useCallback((w) => {
    if (!w) return 0;
    // Priority — ВОР is the project's Bill of Quantities, so its
    // (item_number, code) match wins first. It's the AUTHORITATIVE
    // project plan; when ВОР and єдинич disagree on the same row
    // (e.g. ВОР row 29 = 0.102, єдинич row 29 = 0.012 for an
    // arm-ie work that appears twice), the ВОР figure is the one
    // the foreman should target.
    //
    // Chain:
    //   1. ВОР byItem  (item_number + code) — deterministic
    //   2. ВОР strict  (section + name + uom)
    //   3. єдинич's original_quantity (col F anchor) — fallback when
    //      ВОР has no matching row at all (some єдинич-only works
    //      don't surface in the project's ВОР sheet).
    //   4. ВОР loose   (name only) — last-ditch ВОР rescue.
    //   5. live `quantity` — final fallback for legacy rows.
    const byItem = vorPlanByName?.byItem;
    const strict = vorPlanByName?.strict;
    const loose = vorPlanByName?.loose;
    if (byItem) {
      const itemNum = String(w.item_number || '').trim();
      if (itemNum) {
        const codeKey = String(w.code || '').trim().toLowerCase();
        const v = Number(byItem.get(`${itemNum}|${codeKey}`) || byItem.get(itemNum) || 0);
        if (v > 0) return v;
      }
    }
    if (strict) {
      const sk = compoundKey(w.parent_item_number, w.name, w.uom);
      const v = strict.get(sk) || 0;
      if (v > 0) return v;
    }
    const origQty = Number(w.original_quantity || 0);
    if (origQty > 0) return origQty;
    if (loose) {
      const v = loose.get(normName(w.name)) || 0;
      if (v > 0) return v;
    }
    return Number(w.quantity || 0);
  }, [vorPlanByName]);
  const blockProg = useMemo(() => blockProgress(stages, resolveWorkQty), [stages, resolveWorkQty]);
  // Total works in the active block — direct works of every stage PLUS
  // the works inside every sub-stage. Pre-fix this only counted
  // stage.works, so a block that was 100% sub-stages reported 0 works.
  const totalWorks = useMemo(
    () => stages.reduce((n, s) => n + allStageWorks(s).length, 0),
    [stages],
  );
  // ── Sub-resources index ─────────────────────────────────────────
  // Map from work-id → its resource sub-lines (labor, machine, material).
  //
  // The bulk import we use today doesn't populate parent_line_id (the FK
  // columns exist but BulkCreateEstimateLines never writes them). Instead,
  // children carry parent_item_number = parent.item_number (the local "1",
  // "2" etc. inside a section) and they always come right after their
  // parent in sort_order — that's how parseEdinich emits them.
  //
  // So we walk the lines sorted by sort_order: each top-level work resets
  // a "currentParent" pointer; each subsequent child line whose
  // parent_item_number equals currentParent.item_number is bucketed under
  // that work. This naturally resolves the cross-section "1" ambiguity
  // because we never look further than the most recent parent.
  //
  // We ALSO honour parent_line_id when it's set (for any future code path
  // that writes the FK directly), so callers don't need to choose.
  const subResourcesByWork = useMemo(() => {
    const m = new Map();
    if (!Array.isArray(lines) || lines.length === 0) return m;

    // Stable copy ordered by sort_order then id, mirroring how the backend
    // returns paginated estimate lines.
    const ordered = [...lines].sort((a, b) => {
      const sa = Number(a.sort_order || 0), sb = Number(b.sort_order || 0);
      if (sa !== sb) return sa - sb;
      return Number(a.id || 0) - Number(b.id || 0);
    });

    let currentParent = null;
    for (const l of ordered) {
      const pid = l?.parent_line_id;
      const isWork = isWorkRow(l); // top-level work: empty resource_type, no parent_line_id

      if (isWork) {
        currentParent = l;
        continue;
      }

      // Child sub-resource: prefer explicit parent_line_id, else fall back
      // to (currentParent.item_number == child.parent_item_number).
      let parentId = null;
      if (pid != null && Number(pid) !== 0) {
        parentId = Number(pid);
      } else if (currentParent) {
        const childParentNum = String(l.parent_item_number || '').trim();
        const curParentNum = String(currentParent.item_number || '').trim();
        if (childParentNum && childParentNum === curParentNum) {
          parentId = Number(currentParent.id);
        }
      }
      if (parentId == null) continue;
      if (!m.has(parentId)) m.set(parentId, []);
      m.get(parentId).push(l);
    }
    // Unified manuals-first sort — see utils/sortLines.js.
    for (const arr of m.values()) {
      sortLinesManualFirstInPlace(arr);
    }
    return m;
  }, [lines]);

  // Block budget = sum of every work's total_amount across direct + sub.
  // Falls back to a cost derived from sub-resources for works whose own
  // total_amount is zero (e.g. ВОР-only imports where the parent line is
  // just a header, all pricing lives on labour/machine/material sub-rows
  // — bug "tex nadzorda summa korinmayapti"). The fallback uses
  //   resolveQty(w) × Σ(sub.unit_rate × sub.norm_rate)
  // which mirrors the per-row computation used by the WorksTable so the
  // dashboard total and the row totals stay in sync.
  const blockBudget = useMemo(() => {
    let total = 0;
    for (const s of stages) {
      for (const w of allStageWorks(s)) {
        const stored = Number(w.total_amount || 0);
        if (stored > 0) {
          total += stored;
          continue;
        }
        const subs = subResourcesByWork?.get(Number(w.id)) || [];
        const derivedUnitRate = subs.reduce(
          (sum, sub) => sum + Number(sub.unit_rate || 0) * Number(sub.norm_rate || 0),
          0,
        );
        const planQty = Number(resolveWorkQty(w) || 0);
        total += derivedUnitRate * planQty;
      }
    }
    return total;
  }, [stages, subResourcesByWork, resolveWorkQty]);

  // Derived: which iteration is the user looking at, and is it frozen?
  // Declared BEFORE the permission helpers so canEditQty (below) can
  // reference isFrozenView without depending on TDZ-then-closure semantics.
  // Frozen iterations show historical state with read-only inputs —
  // attempts to type fakt are blocked client-side and the backend
  // wouldn't accept them anyway (UpdateWorkDoneQuantity only writes
  // into the currently-open iteration_line).
  const activeIteration = useMemo(
    () => iterations.find((it) => it.id === activeIterationId) || null,
    [iterations, activeIterationId],
  );
  const isFrozenView = activeIteration ? activeIteration.status === 'frozen' : false;

  // Permission helpers — based on viewRole (what the user is currently
  // simulating) for UI gating; the server independently enforces using
  // the real role on every action.
  const canSeeCost = viewRole !== 'foreman';
  const canEditQty = (w) =>
    !isFrozenView
    // isFrozenView gate (migration 419) — when the user is looking at a
    // frozen Forma 2 iteration tab, the fakt input is read-only. The
    // backend would reject writes against a frozen iter anyway (the open-
    // iter lookup wouldn't return the frozen one), but disabling the
    // input on the client gives a clearer UX than failing silently.
    && viewRole === 'foreman'
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
    if (isFrozenView) {
      // Belt-and-braces — the input is also disabled by JSX. This guard
      // catches any leftover keyboard handlers (e.g. Enter on a focused
      // disabled field with browser quirks).
      toast.error(t('forma2_frozen_readonly') || 'Bu Forma 2 muzlatilgan');
      return;
    }
    const v = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
    // Template-mode imports leave plan quantity = 0; the foreman's
    // BAJARILDI IS the recorded work volume. So the only constraint is
    // non-negative — we don't cap at work.quantity any more (which used
    // to lock everyone at 0 because the smeta plan was 0). The backend
    // also doesn't enforce a ceiling, so this matches.
    const newPeriod = Number.isFinite(v) ? Math.max(0, v) : 0;
    // The user's typed value is the THIS-PERIOD contribution (matches
    // what's shown in the BAJARILDI input). Skip the round-trip when it
    // equals the cached period_fakt for the active iteration.
    const prevPeriod = periodFaktByLine.get(Number(work.id)) || 0;
    if (Math.abs(newPeriod - prevPeriod) < 0.0001) return;
    try {
      // Backend treats body.done_quantity as the open iter's period_fakt
      // (see UpdateWorkDoneQuantity comment block, migration 419) — wire
      // field name stays `done_quantity` for backwards compatibility but
      // the semantics changed under the hood.
      await constructionService.updateWorkDoneQuantity(work.id, newPeriod);
      // Optimistic patch — the cumulative for this line is
      //   newCumulative = oldCumulative - prevPeriod + newPeriod
      // because all other iterations' period_fakt values are unchanged.
      // We also update the local periodFaktByLine map so the input
      // immediately shows the freshly-typed value as the new "starting
      // point" if the user blurs and re-focuses.
      const childParentId = Number(work.id);
      const oldCumulative = Number(work.done_quantity || 0);
      const newCumulative = oldCumulative - prevPeriod + newPeriod;
      setLines((rows) => rows.map((r) => {
        if (r.id === work.id) {
          return {
            ...r,
            done_quantity: newCumulative,
            quantity: newCumulative,
            total_amount: newCumulative * Number(r.unit_rate || 0),
            approval_status: newCumulative > 0 ? 'in_progress' : 'pending',
          };
        }
        if (Number(r.parent_line_id) === childParentId && !r.quantity_override) {
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
        n.set(Number(work.id), newPeriod);
        return n;
      });
      toast.success(t('saved'));
    } catch (e) {
      toast.error(formatApiError(e, t, 'Xatolik'));
      reload();
    }
  }, [t, isFrozenView, periodFaktByLine]);

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
  // Admins/owners can impersonate any role; a regular multi-role user only
  // gets buttons for the roles they actually hold.
  const switchableRoles = isAdminLike
    ? Object.keys(ROLE_META)
    : Object.keys(ROLE_META).filter((k) => myRoles.includes(k));
  const roleSwitcher = (
    <div className="rounded-xl border border-slate-200 bg-white p-2 flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mx-2">
        {t('switch_role')}
      </span>
      {switchableRoles.map((key) => {
        const meta = ROLE_META[key];
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
      {/* Role switcher — shown to admins/owners (who can impersonate any
         role) and to regular users who hold MORE THAN ONE project role, so
         they can act as each of theirs. Single-role users don't see it —
         they just live with their one resolved role. The backend enforces
         the action against the user's full role set on every transition.
         Portalled into the project topbar when the slot exists; otherwise
         it falls back to an inline render. */}
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

      {/* FORMA 2 ITERATION STRIP — migration 419. Read-only here.
         Each tab = one submission of the project's Forma 2. The latest tab
         carries "(joriy)" and is editable; older tabs are read-only and
         show the historical state at the moment of freeze. Creating and
         deleting Forma 2s lives on the Smeta boshqaruvi tab — this strip is
         display-only so the foreman can switch which iteration's numbers
         the works table shows. */}
      {iterations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-base font-bold text-slate-900">📄 {t('forma2_series') || 'Forma 2 iteratsiyalari'}</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {iterations.map((it) => {
              const active = activeIterationId === it.id;
              const isOpen = it.status === 'open';
              return (
                <button
                  key={it.id}
                  onClick={() => setActiveIterationId(it.id)}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition"
                  style={{
                    background: active ? '#0F172A' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#64748B',
                    border: `1.5px solid ${active ? '#0F172A' : '#E5E7EB'}`,
                  }}
                  title={isOpen
                    ? (t('forma2_open_editable') || 'Joriy iteratsiya — tahrirlash mumkin')
                    : (t('forma2_frozen_readonly') || 'Muzlatilgan — faqat ko\'rish')}
                >
                  <span>📄 Forma 2 #{it.iteration_seq}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{
                      background: active ? (isOpen ? '#047857' : '#64748B') : (isOpen ? '#D1FAE5' : '#E5E7EB'),
                      color:      active ? '#FFFFFF' : (isOpen ? '#047857' : '#64748B'),
                    }}
                  >
                    {isOpen ? (t('current_label') || 'joriy') : (t('frozen_label') || 'muzlatilgan')}
                  </span>
                </button>
              );
            })}
          </div>
          {isFrozenView && (
            <div className="mt-3 px-3 py-2 rounded-md text-[12px] bg-amber-50 border border-amber-200 text-amber-800">
              {t('forma2_frozen_notice') || "Bu Forma 2 muzlatilgan. Yangi fakt kiritish uchun #joriy ni tanlang."}
            </div>
          )}
        </div>
      )}

      {/* BLOCK TABS — the "Smeta yuklash" CTA used to live in this header
         row, but the user prefers the upload affordance to stay in
         Moliya → Smetalar where the actual import-from-Excel flow is.
         Removed per request. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold text-slate-900">📐 {t('blocks_section')}</h2>
          {/* "+ Bosqich qo'shish" — opens the create-stage modal. Disabled
             when no building is active because construction_stages rows
             must be scoped to a building (migration 333). Visible to any
             role with tab access; backend createStage still validates the
             user's project permissions. */}
          {activeBuildingId && (
            <button
              type="button"
              onClick={() => setAddStageModal({ name: '' })}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1.5"
            >
              <span className="text-[14px] leading-none">+</span>
              {t('add_stage') || "Bosqich qo'shish"}
            </button>
          )}
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
                    {hasEst ? `${buildingStageCounts[b.id] ?? '·'} ${t('stage_short_suffix')}` : t('empty')}
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
          {visibleStages.map((stage) => {
            const stKey = stage.name;
            const expanded = expandedStages.has(stKey);
            const status = stageStatus(stage);
            const stMeta = STATUS_META[status] || STATUS_META.pending;
            const pct = stageProgress(stage, resolveWorkQty);
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
                {/* Stage header — outer div so a trash button can sit next
                   to the toggle without nesting buttons. The toggle button
                   absorbs the bulk of the row (flex-1) so click-anywhere
                   to expand still works; the trash icon is a sibling that
                   only swallows its own click. */}
                <div className="w-full flex items-stretch hover:bg-slate-50 transition">
                <button
                  type="button"
                  onClick={() => toggleStage(stKey)}
                  className="flex-1 min-w-0 px-5 py-4 flex items-center gap-4 text-left"
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
                {/* Trash icon — cascade-deletes the whole stage (every
                   work under it AND any nested sub-stages). Hidden for
                   the synthetic "Uncategorized" bucket since that's a
                   virtual grouping not backed by a real name.
                   Permission gated via canDeleteConstruction: only
                   tenant admins/owners and employees with the
                   `construction.delete` permission see this button. */}
                {canDeleteConstruction && stage.name !== UNCATEGORISED_KEY && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeStage(stage.name); }}
                    className="px-3 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 border-l border-slate-100"
                    title={t('delete_stage') || "Bosqichni o'chirish"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
                </div>

                {/* Stage content — sub-stages if the works' item_numbers
                   carry a hierarchical layer, flat works table otherwise. */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    {/* "+ Sub-bosqich" — opens the richer AddSubWorkModal
                       (same form as "Yangi qo'shimcha etap" in Smeta
                       boshqaruvi: code, name, uom, qty). The modal saves
                       an estimate line with parent_item_number =
                       "PARENT_STAGE › NEW_NAME", which the deriveStages
                       grouping renders as a new sub-stage under this
                       stage. Disabled when there's no active єдинич
                       estimate to attach the line to. */}
                    <div className="flex justify-end mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!activeEstimateId) {
                            toast.error(t('no_estimate_for_work')
                              || "Bu blok uchun єдинич smeta topilmadi");
                            return;
                          }
                          setAddSubBosqichParent(stage.name);
                        }}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 inline-flex items-center gap-1"
                      >
                        <span className="text-[13px] leading-none font-bold">+</span>
                        {t('add_substage') || "Sub-bosqich qo'shish"}
                      </button>
                    </div>

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
                      periodFaktByLine={periodFaktByLine}
                      onUpdateDone={updateDone}
                      onSubmit={submitWork}
                      onConfirmSupervisor={confirmAsSupervisor}
                      onRejectSupervisor={rejectAsSupervisor}
                      onConfirmEngineer={confirmAsEngineer}
                      onRejectEngineer={rejectAsEngineer}
                      viewRole={viewRole}
                      vorPlanByName={vorPlanByName}
                      expandedWorks={expandedWorks}
                      toggleWork={toggleWork}
                      subResourcesByWork={subResourcesByWork}
                      onAddResource={(w) => {
                        // Auto-expand the work so the foreman can SEE the
                        // newly-added line as soon as the modal closes.
                        setExpandedWorks((s) => {
                          const n = new Set(s); n.add(Number(w.id)); return n;
                        });
                        setAddResWorkParent(w);
                      }}
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
          {/* Infinite-scroll sentinel — grows the window by another page
              of stages when it scrolls into view. */}
          {visibleStageCount < stages.length && (
            <div ref={stagesLoadMoreRef} className="py-6 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
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

      {/* Add-resource modal — opened from the per-row "+" button. The new
         sub-line attaches to the work via parent_line_id, so it shows up
         in the expanded sub-resources table immediately and is picked up
         by reserveMaterialsForWork on the next submit (and deducted from
         inventory on engineer-confirm). */}
      <AddResourcePickerModal
        open={!!addResWorkParent}
        onClose={() => setAddResWorkParent(null)}
        projectId={project?.id}
        estimateId={activeEstimateId}
        parent={addResWorkParent}
        nextSeq={(addResWorkParent && (subResourcesByWork.get(Number(addResWorkParent.id))?.length || 0) + 1) || 1}
        onSaved={() => {
          setAddResWorkParent(null);
          reload();
        }}
      />

      {/* "+ Sub-bosqich" modal — re-uses the AddSubWorkModal component in
         its "parentSection" mode so the user gets the familiar
         code / name / uom / qty form. The new line is saved with
         parent_item_number = `${stage.name} › ${name}`, which the
         deriveStages grouping picks up as a fresh sub-stage. */}
      <AddSubWorkModal
        open={!!addSubBosqichParent}
        onClose={() => setAddSubBosqichParent(null)}
        projectId={project?.id}
        estimateId={activeEstimateId}
        parentSection={addSubBosqichParent || ''}
        onSaved={() => {
          setAddSubBosqichParent(null);
          reload();
        }}
      />

      {/* Add-stage modal — manually create a stage for the active
         block. POSTs to construction_stages via createStage; once the
         list reload fires, the new (empty) stage shows up as a card on
         this tab because the manualStages → stages merge above adds
         zero-work stages whose name isn't already covered by a
         derived stage.

         When a parent stage is picked from the dropdown, the new
         stage's name is composed as "PARENT › CHILD" using the same
         " › " delimiter the importer uses. The hierarchical name is
         what other tabs (Smeta boshqaruvi) need to render the entry
         as a nested sub-stage. */}
      {addStageModal && (
        <AddStageModal
          value={addStageModal.name}
          parent={addStageModal.parent || ''}
          onChange={(name) => setAddStageModal((m) => ({ ...m, name }))}
          busy={addStageBusy}
          onCancel={() => { if (!addStageBusy) setAddStageModal(null); }}
          onConfirm={async () => {
            const rawName = (addStageModal.name || '').trim();
            if (!rawName) return;
            const parent = (addStageModal.parent || '').trim();
            const fullName = parent ? `${parent} › ${rawName}` : rawName;
            setAddStageBusy(true);
            try {
              const created = await constructionService.createStage(project.id, {
                name: fullName,
                status: 'not_started',
                planned_budget: 0,
                // Migration 333: stages are building-scoped. The button is
                // disabled when activeBuildingId is null so we can safely
                // pass it here without a guard.
                building_id: Number(activeBuildingId),
              });
              // Remember the new id so the stages useMemo can pin it to
              // the top of the list once listStages re-fetches.
              // Persisted to localStorage so the ordering survives reloads.
              if (created && created.id != null) {
                setRecentlyAddedStageIds((prev) => {
                  const next = [...prev, Number(created.id)];
                  persistManualIds(next);
                  return next;
                });
              }
              setAddStageModal(null);
              reload();
              toast.success(t('stage_added') || "Bosqich qo'shildi");
            } catch (e) {
              toast.error(formatApiError(e, t, 'Xatolik'));
            } finally {
              setAddStageBusy(false);
            }
          }}
          t={t}
        />
      )}
    </div>
  );
}

// =====================================================================
// ADD STAGE MODAL — two modes driven by the `parent` prop:
//
//   • parent empty → "Bosqich qo'shish" creates a top-level stage.
//   • parent set   → "Sub-bosqich qo'shish" with a fixed-parent badge
//     (no dropdown — the caller's expanded stage card already picked it).
//
// The composed name "PARENT › CHILD" is what the section-grouping logic
// elsewhere uses to nest the entry under its parent.
// =====================================================================
function AddStageModal({
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
            : (t('add_stage') || "Bosqich qo'shish")}
        </h3>
        <p className="text-[12px] text-slate-500 mb-4">
          {isSub
            ? (t('add_substage_hint') || "Yangi sub-bosqich nomi")
            : (t('add_stage_hint') || "Yangi bosqich nomi (masalan: \"Pardozlash\", \"Elektrika\")")}
        </p>

        {/* Parent breadcrumb pill — sub-stage mode only. The parent is
           fixed by the entry point (the "+ Sub-bosqich" button on the
           expanded stage card), so we show it read-only. */}
        {isSub && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-700">
            <span className="text-emerald-500 mr-1">{t('parent_section_label') || "Asosiy:"}</span>
            <span className="font-medium">{parent}</span>
          </div>
        )}

        <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
          {isSub
            ? (t('substage_name') || "Sub-bosqich nomi")
            : (t('stage_name') || "Bosqich nomi")}
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
            : (t('stage_name_placeholder') || "Poydevor, Karkos, Pardozlash")}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 mb-5"
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
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center gap-1.5 disabled:opacity-50 disabled:hover:bg-emerald-700"
          >
            {busy
              ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('saving') || "Saqlanmoqda..."}</>)
              : (t('add') || "Qo'shish")}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// CONFIRM MODAL
// =====================================================================
function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, t }) {
  // Portal to document.body so the backdrop covers the FULL viewport,
  // including the project header / sub-pill nav at the top of the
  // Construction page. Rendering inline meant the modal was trapped
  // inside StagesTabV2's stacking context, leaving a visible "line" of
  // un-dimmed page chrome between the browser bar and the modal —
  // exactly the issue raised after the iteration freeze button shipped.
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center"
         style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}
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
    </div>,
    document.body,
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

  // Stage's direct works — same unified sort as Smeta boshqaruvi uses
  // for top-level work lines (utils/sortLines.js). One rule, no drift.
  const directWorks = useMemo(
    () => sortLinesManualFirst(props.stage.works || []),
    [props.stage.works],
  );

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
  periodFaktByLine,
  onUpdateDone, onSubmit,
  onConfirmSupervisor, onRejectSupervisor,
  onConfirmEngineer, onRejectEngineer,
  viewRole,
  vorPlanByName,
  expandedWorks,
  toggleWork,
  subResourcesByWork,
  onAddResource,
  t,
}) {
  // Infinite-scroll window — paint the first 20 works of this table and
  // reveal more as the sentinel row scrolls into view. Each WorksTable
  // (the stage's direct works, and one per sub-stage) keeps its own window.
  // A work's resources render inside its own expand row, so they're never
  // split by this. WorksTable unmounts when its stage collapses, so the
  // window resets naturally on the next expand.
  const WORKS_PER_PAGE = 20;
  const [visibleCount, setVisibleCount] = React.useState(WORKS_PER_PAGE);
  const moreRef = React.useRef(null);
  React.useEffect(() => { setVisibleCount(WORKS_PER_PAGE); }, [works.length]);
  React.useEffect(() => {
    const el = moreRef.current;
    if (!el) return undefined;
    if (visibleCount >= works.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleCount((n) => Math.min(n + WORKS_PER_PAGE, works.length));
      }
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, works.length]);
  const visibleWorks = works.slice(0, visibleCount);
  // Total column count (used for the colspan of the expanded sub-row).
  // 1 chevron + # + name + uom + plan + done + progress + status + action = 9
  // + (unit_price + plan_total + fact_total) when canSeeCost = 12
  const colCount = canSeeCost ? 12 : 9;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="py-2.5 px-2" style={{ width: 28 }} />
            {/* `#` column was 40 px — too narrow for hyphenated sub-stage
                item numbers like "4-1" / "13-1", which were wrapping
                to two lines ("4-" then "1") in the cell. Widened to
                64 px and the cell uses whiteSpace:nowrap below so even
                the longest realistic number ("13-12") stays on one line. */}
            <th className="text-center py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-slate-500" style={{ width: 64 }}>#</th>
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
          {visibleWorks.map((w, idx) => {
            const isLocked = w.approval_status === 'confirmed_engineer';
            const isSupConfirmed = w.approval_status === 'confirmed_supervisor';
            const rowBg = isLocked ? '#F0FDF4' : (isSupConfirmed ? '#FEF7E0' : 'transparent');
            // REJA priority — mirrors resolveWorkQty above:
            //   1. ВОР byItem (item_number + code) — the project's BoQ
            //      figure, deterministic and authoritative.
            //   2. ВОР strict (section + name + uom).
            //   3. єдинич's original_quantity — fallback when ВОР has
            //      no matching row.
            //   4. ВОР loose (name only) — last-ditch ВОР rescue.
            //   5. live `quantity` — final fallback.
            const origQty = Number(w.original_quantity || 0);
            const ownQty = Number(w.quantity || 0);
            let vorByItemQty = 0;
            if (vorPlanByName?.byItem) {
              const itemNum = String(w.item_number || '').trim();
              if (itemNum) {
                const codeKey = String(w.code || '').trim().toLowerCase();
                vorByItemQty = Number(
                  vorPlanByName.byItem.get(`${itemNum}|${codeKey}`)
                  || vorPlanByName.byItem.get(itemNum)
                  || 0
                );
              }
            }
            let vorStrictQty = 0;
            if (vorByItemQty <= 0 && vorPlanByName?.strict) {
              vorStrictQty = Number(vorPlanByName.strict.get(
                compoundKey(w.parent_item_number, w.name, w.uom),
              ) || 0);
            }
            let vorLooseQty = 0;
            if (vorByItemQty <= 0 && vorStrictQty <= 0
                && origQty <= 0 && vorPlanByName?.loose) {
              vorLooseQty = Number(vorPlanByName.loose.get(normName(w.name)) || 0);
            }
            const planQty =
              vorByItemQty > 0 ? vorByItemQty
              : vorStrictQty > 0 ? vorStrictQty
              : origQty > 0 ? origQty
              : vorLooseQty > 0 ? vorLooseQty
              : ownQty;
            const doneQty = Number(w.done_quantity || 0);
            const pct = planQty > 0 ? Math.min((doneQty / planQty) * 100, 100) : 0;
            const stMeta = STATUS_META[w.approval_status] || STATUS_META.pending;
            const draftKey = `q_${w.id}`;
            // PERIOD FAKT vs CUMULATIVE (migration 419) — the BAJARILDI
            // input shows THIS iteration's contribution (starts at 0 in
            // a fresh iter), while the PROGRESS bar above keeps using
            // doneQty (the cumulative) so completed lines still read
            // 100% after the freeze. Without this split the user
            // reported "i said new tab should take fakt as 0 but
            // progress stays same" — both columns were showing the
            // cumulative and the iter feature looked broken.
            const periodFakt = periodFaktByLine
              ? Number(periodFaktByLine.get(Number(w.id)) || 0)
              : doneQty;
            const inputValue = doneDraft[draftKey] !== undefined
              ? doneDraft[draftKey]
              : fmt(periodFakt);
            const subs = subResourcesByWork?.get(Number(w.id)) || [];
            const isExpanded = expandedWorks?.has(Number(w.id)) || false;
            const hasSubs = subs.length > 0;

            return (
              <React.Fragment key={w.id}>
              <tr style={{ background: rowBg, borderTop: '1px solid #F1F5F9' }}>
                <td className="text-center py-2.5 px-1">
                  {hasSubs && (
                    <button
                      type="button"
                      onClick={() => toggleWork(Number(w.id))}
                      title={t('show_consumption') || 'Sarflanishni ko\'rsatish'}
                      className="w-5 h-5 inline-flex items-center justify-center rounded hover:bg-slate-200 text-slate-500"
                    >
                      <span className="inline-block transition-transform text-[10px]"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
                    </button>
                  )}
                </td>
                <td className="text-center py-2.5 px-3 font-bold whitespace-nowrap">{w.item_number || (idx + 1)}</td>
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
                    <div className="inline-flex items-center gap-1.5">
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
                      {onAddResource && (
                        <button
                          type="button"
                          onClick={() => onAddResource(w)}
                          title={t('add_resource_to_work') || "Resurs qo'shish"}
                          className="w-6 h-6 inline-flex items-center justify-center rounded border border-teal-600 text-teal-600 hover:bg-teal-50 text-[14px] leading-none font-bold"
                        >
                          +
                        </button>
                      )}
                    </div>
                  ) : (
                    // Read-only BAJARILDI (frozen iter view, or non-foreman
                    // role). Show the period contribution for the active
                    // iteration so frozen tabs reproduce "what was reported
                    // this period" rather than the running total — which
                    // the PROGRESS column to the right already conveys.
                    <span className="font-mono text-slate-500">{fmt(periodFakt)}</span>
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
                {canSeeCost && (() => {
                  // Derive unit_rate from sub-resources when the parent work
                  // row was imported without one (a common case for some ВОР
                  // imports — the work line is just a header, all the actual
                  // pricing is on its labour/machine/material sub-rows).
                  // Per-unit cost of the work = Σ(sub.unit_rate × sub.norm_rate).
                  // Bug report: "tex nadzorda summa korinmayapti" — texnadzor
                  // sees BIRLIK NARXI / REJA JAMI / FAKT JAMI as zero even
                  // though the sub-rows clearly carry prices.
                  const storedUnitRate = Number(w.unit_rate || 0);
                  const derivedUnitRate = storedUnitRate > 0
                    ? storedUnitRate
                    : subs.reduce(
                        (sum, s) => sum + Number(s.unit_rate || 0) * Number(s.norm_rate || 0),
                        0,
                      );
                  const storedTotal = Number(w.total_amount || 0);
                  const planTotal = storedTotal > 0
                    ? storedTotal
                    : derivedUnitRate * planQty;
                  // FAKT JAMI = actual quantity × rate. We deliberately
                  // do NOT cap doneQty at planQty here — the user
                  // reported "REJA va BAJARILDI har xil bo'lsa ham
                  // jami bir xil" because the previous cap
                  // (Math.min(doneQty, planQty)) hid over-completion in
                  // the cost column. The done quantity already drives
                  // the sub-resource FAKT SARF column un-capped, so
                  // matching that here keeps the parent and child
                  // numbers consistent.
                  const factTotal = doneQty * derivedUnitRate;
                  return (<>
                    <td className="text-right py-2.5 px-3 font-mono">{fmt(derivedUnitRate)}</td>
                    <td className="text-right py-2.5 px-3 font-mono font-semibold">{fmt(Math.round(planTotal))}</td>
                    <td className="text-right py-2.5 px-3 font-mono text-emerald-700">
                      {fmt(Math.round(factTotal))}
                    </td>
                  </>);
                })()}
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
              {isExpanded && hasSubs && (
                <tr style={{ background: '#FAFAFA', borderTop: '1px dashed #E5E7EB' }}>
                  <td colSpan={colCount} className="py-3 px-6">
                    <SubResourcesTable
                      subs={subs}
                      doneQty={doneQty}
                      planQty={planQty}
                      canSeeCost={canSeeCost}
                      workStatus={w.approval_status}
                      t={t}
                    />
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
          {/* Infinite-scroll sentinel — reveals the next 20 works as it
              scrolls into view. */}
          {visibleCount < works.length && (
            <tr ref={moreRef}>
              <td colSpan={colCount} className="py-3 text-center">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline-block" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================================
// SUB-RESOURCES TABLE (consumed materials/labor/machines per work)
// =====================================================================
//
// What this is: a small table that opens INSIDE a work row when the
// foreman clicks the chevron. It shows every resource sub-line of that
// work (labour, machines, materials) with the consumption split into:
//   • plan_qty = sub.quantity            (planned: parent.qty × norm_rate)
//   • fact_qty = doneQty × sub.norm_rate (actual, recomputed live as the
//                                         foreman types BAJARILDI above)
//
// Material rows additionally surface a small status badge that reflects
// the warehouse step:
//   • work submitted        → "📦 bron qilindi"   (quantity_reserved += qty)
//   • work confirmed_engineer → "✅ skladdan yechildi" (on_hand decreased)
function SubResourcesTable({ subs, doneQty, planQty, canSeeCost, workStatus, t }) {
  const RES_TAG = {
    labor:     { bg: 'rgba(245,158,11,0.12)', fg: '#B45309', label: t('mehnat') || 'Mehnat' },
    equipment: { bg: 'rgba(167,139,250,0.12)', fg: '#6D28D9', label: t('mashina') || 'Mashina' },
    material:  { bg: 'rgba(20,184,166,0.12)', fg: '#0F766E', label: t('material') || 'Material' },
  };
  const isReserved  = workStatus === 'submitted' || workStatus === 'confirmed_supervisor';
  const isFinalised = workStatus === 'confirmed_engineer';
  const titleSuffix = isFinalised
    ? ` · ${t('deducted_from_warehouse') || 'Skladdan yechildi'}`
    : isReserved
      ? ` · ${t('materials_reserved') || 'Mahsulot bron qilindi'}`
      : '';

  // Sort: materials first (most actionable for warehouse), then
  // machines, then labour. Within the SAME category, newly added
  // resources (higher id) appear LAST so the originally-imported
  // ones (the foreman is used to seeing them in their imported order)
  // stay at the top, and manual additions land at the bottom of that
  // category — matching the user's mental model of "the new one I
  // just added should show up at the end of the list, not jump to
  // the top".
  //
  // Secondary key: subline_seq if present (set at import time so it
  // mirrors the file's row order), then id ASC as a stable fallback
  // for rows that don't have one.
  const order = { material: 0, equipment: 1, labor: 2 };
  const sortedSubs = [...subs].sort((a, b) => {
    const ra = order[String(a.resource_type || '').toLowerCase()] ?? 99;
    const rb = order[String(b.resource_type || '').toLowerCase()] ?? 99;
    if (ra !== rb) return ra - rb;
    const sa = Number(a.subline_seq ?? 0);
    const sb = Number(b.subline_seq ?? 0);
    if (sa !== sb) return sa - sb;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
        <span>📋 {t('consumed_resources_title') || 'Sarflanadigan resurslar'}{titleSuffix}</span>
        {(isReserved || isFinalised) && (
          <span
            className="px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-wide"
            style={{
              background: isFinalised ? '#D1FAE5' : '#DBEAFE',
              color: isFinalised ? '#065F46' : '#1E40AF',
            }}
          >
            {isFinalised
              ? `✅ ${t('deducted_from_warehouse') || 'Skladdan yechildi'}`
              : `📦 ${t('materials_reserved') || 'Bron qilindi'}`}
          </span>
        )}
      </div>
      <table className="w-full text-[11.5px] border-collapse bg-white rounded-md overflow-hidden border border-slate-200">
        <thead>
          <tr className="bg-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
            <th className="text-left   py-2 px-3" style={{ width: 80 }}>{t('type') || 'Tur'}</th>
            <th className="text-left   py-2 px-3">{t('resource_name') || 'Resurs nomi'}</th>
            <th className="text-center py-2 px-2" style={{ width: 70 }}>{t('unit') || "O'lchov"}</th>
            <th className="text-right  py-2 px-2" style={{ width: 90 }}>{t('plan_consumption') || 'Reja sarf'}</th>
            <th className="text-right  py-2 px-2" style={{ width: 100 }}>{t('fact_consumption') || 'Fakt sarf'}</th>
            {canSeeCost && (<>
              <th className="text-right py-2 px-2" style={{ width: 100 }}>{t('unit_price') || 'Birlik narxi'}</th>
              <th className="text-right py-2 px-2" style={{ width: 110 }}>{t('fact_total') || 'Fakt summa'}</th>
            </>)}
          </tr>
        </thead>
        <tbody>
          {sortedSubs.map((s) => {
            const rt = String(s.resource_type || '').toLowerCase();
            const tag = RES_TAG[rt] || RES_TAG.material;
            const norm = Number(s.norm_rate || 0);
            const planSubQty = Number(s.quantity || 0);
            // REJA SARF — planned consumption visible to the foreman.
            // We display the per-unit norm directly (column E "на. ед.
            // измерения" from the imported smeta) so the user sees the
            // resource's consumption rate even before any work has been
            // declared. If for some reason a row doesn't have a norm
            // (legacy / hand-added rows), fall back to its stored
            // quantity so the column still carries useful info.
            const rejaSarfDisplay = norm > 0 ? norm : planSubQty;
            // Live fact = parent's done × this sub's norm_rate. Recomputed
            // on every render so typing in BAJARILDI flows through here.
            const factSubQty = norm > 0 ? doneQty * norm : (planQty > 0 ? (doneQty / planQty) * planSubQty : 0);
            const unitPrice = Number(s.unit_rate || 0);
            const factTotal = factSubQty * unitPrice;
            return (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-1.5 px-3">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wide"
                    style={{ background: tag.bg, color: tag.fg }}
                  >
                    {tag.label}
                  </span>
                </td>
                <td className="py-1.5 px-3 text-slate-800">{s.name}</td>
                <td className="text-center py-1.5 px-2 text-slate-500">{s.uom || '—'}</td>
                <td className="text-right py-1.5 px-2 font-mono text-slate-600">
                  {rejaSarfDisplay > 0 ? fmt(rejaSarfDisplay) : '—'}
                </td>
                <td className="text-right py-1.5 px-2 font-mono font-semibold text-emerald-700">
                  {factSubQty > 0 ? fmt(factSubQty) : '—'}
                </td>
                {canSeeCost && (<>
                  <td className="text-right py-1.5 px-2 font-mono text-slate-600">{fmt(unitPrice)}</td>
                  <td className="text-right py-1.5 px-2 font-mono font-semibold text-slate-900">
                    {factTotal > 0 ? fmt(Math.round(factTotal)) : '—'}
                  </td>
                </>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
