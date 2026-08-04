import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// =====================================================
// ВОР PARSER
// =====================================================
//
// Output shape — every item carries its own `parent_item_number` which
// IS the section/stage path the row belongs to. To preserve the
// hierarchy that the spreadsheet implies (СЕКЦИЯ №1 → ПЕРЕКРЫТИЕ →
// МОНОЛИТНЫЕ УЧАСТКИ → ...) we encode the path with a single delimiter
// HIERARCHY_DELIM. The downstream UI (StagesTabV2.deriveStages) splits
// on the delimiter to nest sub-stages under their parent stages without
// requiring a schema change.
//
// Heuristics for the level of a header row:
//   • Top-level (sections):  "СЕКЦИЯ", "РАЗДЕЛ"
//   • Sub-stages:            keywords that mark sub-elements of a major
//                            structural element — МОНОЛИТНЫЕ УЧАСТКИ,
//                            ПОЯСА, ДИАФРАГМЫ, МЕТАЛЛИЧЕСКАЯ … etc.
//                            When matched, the sub-stage attaches to the
//                            most recent stage; if there's no current
//                            stage the sub-stage is promoted to a stage.
//   • Stage (default):       any other section-like row.
//
// The keyword list below was derived from the common BOP estimate files
// in /files_estimates (Жилдом Саттепо Авеню Блок 1.xlsx etc).
const HIERARCHY_DELIM = ' › ';
const SUB_STAGE_PATTERNS = [
  /^МОНОЛИТНЫЕ\s+УЧАСТКИ/i,
  /^ПОЯСА$/i,
  /^ДИАФРАГМ/i,
  /^МЕТАЛЛИЧЕСКАЯ\s/i,
  /^МЕТАЛЛИЧЕСКИЙ\s/i,
  /^КРЕПЕЖНЫЙ/i,
  /^ПЛАН\s+ПОКРЫТИЯ/i,
  // Interior-finishing sub-rooms (Гостиная, Ванная, Прихожая, …)
  /^(ГОСТИННАЯ|ГОСТИНАЯ|ВАННАЯ|ПРИХОЖАЯ|СПАЛЬНЯ|ОБЩАЯ|КУХНЯ|МАГАЗИН|ТЕХ\.?ПОМЕЩЕНИЯ?)/i,
];
function isSubStageHeader(name) {
  if (!name) return false;
  return SUB_STAGE_PATTERNS.some((re) => re.test(name));
}
const TOP_SECTION_PATTERNS = [/^СЕКЦИЯ/i, /^РАЗДЕЛ/i];
function isTopSectionHeader(name) {
  if (!name) return false;
  return TOP_SECTION_PATTERNS.some((re) => re.test(name));
}

// ─────────────────────────────────────────────────────────────────────
// HEADER-ROW ANCHORING (template-independent)
//
// The two smeta templates we ship support — Юксалиш (Госархстрой XLS)
// and Саттепо (modern XLSX) — share the same column-header text but
// stack a DIFFERENT number of banner rows above it. Hard-coding "data
// starts at row 12" (the old `for (let i = 11; ...)`) silently worked
// on Саттепо and silently mis-parsed Юксалиш:
//
//   • Юксалиш banner depth: 14 rows. Row 13 holds the numeric column
//     reference (1.0 2.0 3.0 4.0 5.0 6.0); starting at row 12 ingests
//     that row as a phantom "work #1" and skips the РАЗДЕЛ N. divider.
//   • Саттепо banner depth: 11 rows. Row 11 is the numeric reference;
//     starting at row 12 lands on real data, so the bug never showed
//     during development.
//
// `findHeaderAnchor` scans the first ~30 rows looking for the row whose
// columns spell out the standard ВОР / Единич header: "N п.п." in col A
// AND "Наименование" in col C (and ideally "Единица" in col D). That
// row is the structural pivot — three rows below it is guaranteed to
// be the first data row in every smeta template I've inspected:
//
//   header row     →  "N п.п. | Шифр | Наименование | Ед. изм. | Кол-во"
//   header + 1     →  merged sub-labels of "Количество"
//                     ("на ед. измерения | по проектным данным")
//   header + 2     →  numeric column reference (1 2 3 4 5 6 / 1.0 2.0 …)
//   header + 3     →  first data row (section divider or work).
//
// Returns { headerRowIdx, firstDataRowIdx } both ZERO-INDEXED, or null
// if no recognisable header was found in the first 30 rows (callers
// then fall back to the legacy index 11 so a brand-new template variant
// doesn't fail open with zero rows).
function findHeaderAnchor(rawData) {
  const MAX_SCAN = Math.min(30, rawData.length);
  for (let i = 0; i < MAX_SCAN; i++) {
    const row = rawData[i];
    if (!row) continue;
    const colA = row[0] != null ? String(row[0]).trim().toLowerCase() : '';
    const colC = row[2] != null ? String(row[2]).trim().toLowerCase() : '';
    const colD = row[3] != null ? String(row[3]).trim().toLowerCase() : '';
    // "N п.п." appears as "N п.п.", "№ п/п", "N п/п" depending on
    // template — accept any letter+ "п" combination with dot/slash.
    const isItemNoCol = /^[n№]\s*п[./]п/i.test(colA);
    const isNameCol   = colC.includes('наименование');
    const isUomCol    = colD.includes('единица') || colD.includes('ед.') || colD === '';
    if (isItemNoCol && isNameCol && isUomCol) {
      return { headerRowIdx: i, firstDataRowIdx: i + 3 };
    }
  }
  return null;
}

// Pulls the "object name" from rows ABOVE the column-header row. The
// legacy scan would happily grab parenthesised placeholder banners like
// "(наименование работ и затрат, наименование объекта)" because they
// contain the substring "объект" — that placeholder then became the
// imported section's name on the Saatepo / Юксалиш Тип-3 import.
//
// Rules:
//   1. Only scan rows STRICTLY ABOVE the column header (banner area).
//   2. Reject any cell that is wrapped in parentheses — those are
//      template placeholders, never real data.
//   3. Prefer cells that match the explicit "объект - <name>" or
//      "Блок ..." patterns; fall back to the first plain-text cell that
//      survives the placeholder filter.
function extractObjectName(rawData, headerRowIdx) {
  const stopRow = headerRowIdx > 0 ? headerRowIdx : Math.min(10, rawData.length);
  const isPlaceholder = (s) => /^\s*\(.*\)\s*$/.test(s);
  // First pass — look for the explicit "объект -" pattern.
  for (let r = 0; r < stopRow; r++) {
    const row = rawData[r];
    if (!row) continue;
    for (let c = 0; c < Math.min(8, row.length); c++) {
      const v = row[c];
      if (!v || typeof v !== 'string') continue;
      const s = v.trim();
      if (!s || isPlaceholder(s)) continue;
      const m = s.match(/объект\s*[-–:]\s*(.+)/i);
      if (m && m[1] && m[1].trim().length > 2) {
        return m[1].trim();
      }
    }
  }
  // Second pass — accept anything mentioning "Блок" or "блок".
  for (let r = 0; r < stopRow; r++) {
    const row = rawData[r];
    if (!row) continue;
    for (let c = 0; c < Math.min(8, row.length); c++) {
      const v = row[c];
      if (!v || typeof v !== 'string') continue;
      const s = v.trim();
      if (!s || isPlaceholder(s)) continue;
      if (/блок/i.test(s) && s.length > 5) {
        return s;
      }
    }
  }
  return '';
}

// Catalog-code shape validator. Real estimate work rows have a
// recognisable catalog code in col B (Е0101-..., Ц1008-..., С, or a
// bare numeric resource code on resource sub-rows). The phantom row
// "1.0 | 2.0 | 3.0 | 4.0 | 5.0 | 6.0" — the numeric column reference
// that lives 2 rows below the column-header — has col B = "2.0" which
// would slip past a naive "col B is truthy" check. This validator
// returns true when col B looks like ANY of the known catalog formats,
// false for bare integers ≤ 10 (those are the column-reference row).
function looksLikeCatalogCode(colB) {
  if (!colB) return false;
  const s = String(colB).trim();
  // Bare integer ≤ 10 → almost certainly the "1 2 3 4 5 6" reference row.
  // Real resource codes can be bare integers too (e.g. "1", "3", "258",
  // "1940" in ВОР sub-rows), but they're usually > 10 once you're past
  // the labor codes 1/3; the false positive on rows 1 and 3 is acceptable
  // because those are real resource lines with actual content beside them.
  if (/^\d+(?:\.0+)?$/.test(s) && Number(s) <= 6 && /^\d/.test(s)) {
    return false;
  }
  return true;
}

// Robust cell-to-number converter. The Excel imports here are
// Russian-locale files where decimal numbers display with a COMMA
// ("10,272" = 10.272). If a cell is text-formatted (common when
// users hand-edit XLSX), sheet_to_json returns it as a string, and
// the raw parseFloat truncates at the comma — "10,272" becomes 10,
// and "0,618" becomes 0. That's exactly how original_quantity could
// end up at 0 on the єдинич side and REJA renders 0 in Bosqichlar.
//
// This helper handles all three observed shapes:
//   • JS number cell                         → returned as-is.
//   • string "10,272" or "10 272,5"          → comma→dot, whitespace
//                                              stripped, parseFloat.
//   • null / undefined / empty / "—"         → 0.
function toNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/[\s ]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseVOR(workbook) {
  // Find ВОР sheet
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('вор')
  );
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const merges = sheet['!merges'] || [];

  // Find the column-header row ("N п.п. | Шифр | Наименование | Ед. изм. | Кол-во")
  // and derive the first data row from it. Falls back to the legacy
  // offset 11 if no recognisable header exists, so genuinely-broken
  // files still pretend to parse (yielding zero items) instead of
  // throwing — same behaviour as before.
  const anchor = findHeaderAnchor(rawData);
  const firstDataRowIdx = anchor ? anchor.firstDataRowIdx : 11;

  // Object name — only scan rows above the header, ignore parenthesised
  // template placeholders ("(наименование работ и затрат…)" etc.).
  const objectName = extractObjectName(rawData, anchor ? anchor.headerRowIdx : 8);

  // Parse data rows starting from firstDataRowIdx. The ВОР sheet has
  // up to three header levels: top-level sections (СЕКЦИЯ / РАЗДЕЛ),
  // stages, and sub-stages. We track the current header at each level
  // so every work row carries its full path in `parent_item_number`.
  //
  // The path is rebuilt on every header-level change. A new top-level
  // section resets stage + sub-stage; a new stage resets sub-stage; a
  // new sub-stage just sits under the current stage.
  const sections = [];
  let currentTopSection = '';
  let currentStage = '';
  let currentSubStage = '';
  let currentSection = { name: objectName || 'Imported', items: [] };
  // Helper to materialise the section bucket for the current path.
  // Sections are bucketed by their full path so works under different
  // sub-stages don't collapse into the same bucket downstream.
  const pathOf = () => {
    const parts = [];
    if (currentTopSection) parts.push(currentTopSection);
    if (currentStage)      parts.push(currentStage);
    if (currentSubStage)   parts.push(currentSubStage);
    return parts.join(HIERARCHY_DELIM) || (objectName || 'Imported');
  };
  const flushSection = () => {
    if (currentSection.items.length > 0) {
      sections.push(currentSection);
    }
  };
  const startSection = () => {
    flushSection();
    currentSection = { name: pathOf(), items: [] };
  };

  for (let i = firstDataRowIdx; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((cell) => cell == null || cell === '')) continue;

    const colA = row[0] != null ? String(row[0]).trim() : '';
    const colB = row[1] != null ? String(row[1]).trim() : '';
    const colC = row[2] != null ? String(row[2]).trim() : '';
    const colD = row[3] != null ? String(row[3]).trim() : '';
    // toNum handles Russian comma-decimal text cells safely.
    const colE = toNum(row[4]);

    // Skip ИТОГО / subtotal rows (text can sit in either col A or col C).
    if (colC.toUpperCase().includes('ИТОГО')) continue;
    if (colA.toUpperCase().includes('ИТОГО')) continue;

    // Detect section headers. Two distinct layouts we need to handle:
    //   1) "РАЗДЕЛ N.<NAME>" in col A only — Юксалиш / Госархстрой XLS.
    //      Cols B-F are blank; the divider sits entirely in column A.
    //   2) Classic: no item number in A, no code in B, uppercase text in
    //      col C — Саттепо and most modern XLSX templates.
    //   3) Numbered: integer in A, no uom (D), no quantity (E),
    //      all-uppercase text in C — older mixed templates.
    const isRazdelDivider = /^\s*РАЗДЕЛ\s+\d/i.test(colA) && !colB && !colC && !colD;
    if (isRazdelDivider) {
      // Strip the "РАЗДЕЛ N." prefix so the section name reads cleanly
      // ("ЗЕМЛЯНЫЕ РАБОТЫ" instead of "РАЗДЕЛ 1.ЗЕМЛЯНЫЕ РАБОТЫ").
      const divName = colA.replace(/^\s*РАЗДЕЛ\s+\d+\s*[.:]?\s*/i, '').trim() || colA;
      currentTopSection = divName;
      currentStage      = '';
      currentSubStage   = '';
      startSection();
      continue;
    }

    // Skip empty description rows AFTER the РАЗДЕЛ check (which lives in
    // col A, not col C).
    if (!colC) continue;
    const isClassicHeader =
      !colA &&
      !colB &&
      colC.length > 5 &&
      (colC === colC.toUpperCase() ||
        colC.includes('СЕКЦИЯ') ||
        colC.includes('РАЗДЕЛ'));
    const isNumberedHeader =
      colA &&
      /^\d+$/.test(colA) &&
      !colD &&
      (colE === 0 || isNaN(colE)) &&
      colC.length > 5 &&
      colC === colC.toUpperCase() &&
      !/\d{2,}/.test(colC); // exclude codes that look like all-caps but have many digits
    const isSectionHeader = isClassicHeader || isNumberedHeader;

    if (isSectionHeader) {
      // Decide which level of the header hierarchy this row sits at.
      if (isTopSectionHeader(colC)) {
        currentTopSection = colC;
        currentStage      = '';
        currentSubStage   = '';
      } else if (isSubStageHeader(colC) && currentStage) {
        // Genuine sub-stage: attaches under the current stage.
        currentSubStage = colC;
      } else {
        // Default: a regular stage. Resets sub-stage.
        currentStage    = colC;
        currentSubStage = '';
      }
      startSection();
      continue;
    }

    // Data row: must have something in A (item number) or at least a code in B
    if (!colA && !colB) continue;

    // Reject the numeric column-reference row that lives 2 rows below the
    // column-header. Its shape is "1 | 2 | 3 | 4 | 5 | 6" (or "1.0 | 2.0 |
    // ..." in Юксалиш XLS). It would otherwise sneak through as a phantom
    // work — col A "1.0" passes the truthy test, col B "2.0" passes the
    // truthy test, col D "4.0" passes the uom test, etc. Detected when
    // col A is a small integer (≤6) AND col C is also a small integer —
    // a real work would have a description in col C.
    const colAAsNum = Number(String(colA).replace(',', '.'));
    const colCAsNum = Number(String(colC).replace(',', '.'));
    if (
      Number.isFinite(colAAsNum) && colAAsNum <= 6 && colAAsNum > 0 &&
      Number.isFinite(colCAsNum) && colCAsNum <= 6 && colCAsNum > 0
    ) {
      continue;
    }

    currentSection.items.push({
      item_number: colA,
      code: colB,
      name: colC,
      uom: colD,
      quantity: isNaN(colE) ? 0 : colE,
    });
  }

  // Push last section
  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return { sections, objectName };
}

// =====================================================
// ЕДИНИЧ PARSER
// =====================================================

function detectResourceType(uom) {
  if (!uom) return 'material';
  const upper = uom.toUpperCase();
  if (upper.includes('ЧЕЛ') && upper.includes('Ч')) return 'labor';
  if (upper.includes('МАШ') && upper.includes('Ч')) return 'equipment';
  return 'material';
}

// Detects which sheet in the workbook actually carries the work +
// resource hierarchy. Same naming convention is used by two
// structurally-different smeta templates and they swap meaning:
//
//   XLSX (Саттепо / modern):  единич = work hierarchy ; ВОР = flat list
//   XLS  (Юксалиш / legacy):  ВОР    = work hierarchy ; единич = resource catalog
//
// The "work hierarchy" signature is the presence of dotted item
// numbers ("1.1", "1.2", "2.1", …) — resource sub-rows under a parent
// work. A flat resource catalog has only bare integers ("1", "2", "3"…)
// because the same item-number scheme restarts inside each catalog
// bucket (ТРУДОВЫЕ РЕСУРСЫ → СТРОИТЕЛЬНЫЕ МАШИНЫ → …).
//
// Returns the sheet name to use, or null if neither sheet looks like
// the work hierarchy. The caller can then keep the user's selection.
function pickWorkHierarchySheet(workbook) {
  const candidateNames = workbook.SheetNames.filter(
    (n) => /единич|вор/i.test(n),
  );
  if (candidateNames.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const name of candidateNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    // Two shapes of "work + resource sub-row" signature:
    //   • Dotted item numbers ("1.1", "1.2" …) — XLS Юксалиш ВОР style.
    //   • Empty-col-A rows immediately following an integer-col-A row,
    //     with col C carrying a resource name — XLSX Саттепо единич
    //     style. The work row sits at "648 / Ц1008-002-02 / ИЗВЕЩАТЕЛИ"
    //     and the labour/equipment children below have blank A/B and
    //     just the resource name in C.
    // Either signature counts as a "work hierarchy" indicator. A pure
    // resource catalog (XLS Юксалиш единич) hits neither — every row
    // has a bare integer in col A because numbering restarts within
    // each ТРУДОВЫЕ РЕСУРСЫ / СТРОИТЕЛЬНЫЕ МАШИНЫ … bucket.
    let score = 0;
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const row = rows[i];
      if (!row) continue;
      const colA = row[0] != null ? String(row[0]).trim() : '';
      const colB = row[1] != null ? String(row[1]).trim() : '';
      const colC = row[2] != null ? String(row[2]).trim() : '';
      const colD = row[3] != null ? String(row[3]).trim() : '';
      if (/^\d+\.\d+$/.test(colA)) {
        score++;
      } else if (!colA && !colB && colC && colC.length > 3 && colD) {
        // Resource sub-row: no item number, no catalog code, but a real
        // name AND a unit of measure (ЧЕЛ.-Ч / МАШ.-Ч / М3 / Т …).
        //
        // The UOM is what separates a true resource line from a wrapped
        // continuation-text row. The previous rule instead required the
        // PREVIOUS row to hold a bare integer, which scored only the
        // FIRST resource under each work — so a единич sheet with ~2000
        // resources scored ~20 while a works-only ВОР sheet scored ~28
        // on its no-UOM continuation rows. ВОР won, parseEdinich parsed
        // the works-only sheet, and every work imported with "0 resurs".
        // Counting every UOM-bearing sub-row makes the real hierarchy
        // sheet win by a wide margin (134 vs 0 on the Саттепо family)
        // while a flat XLS resource catalog — whose rows carry bare
        // integers in col A — still scores 0 and keeps ВОР the winner
        // for the Юксалиш Тип-3 layout.
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  // Need at least a handful of hierarchy rows to be confident. Below
  // that, fall back to the caller's pick (preserves single-sheet edge
  // cases like a brand-new template variant).
  return bestScore >= 5 ? best : null;
}

function parseEdinich(workbook) {
  // Prefer whichever sheet actually carries the work + resource hierarchy.
  // For XLSX (Саттепо) this is the единич sheet (work rows + dotted sub-
  // rows). For XLS (Юксалиш Тип-3) it's the ВОР sheet — the file's
  // единич sheet is a flat resource catalog (the ТРУДОВЫЕ РЕСУРСЫ /
  // СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ / МАТЕРИАЛЫ buckets with restart-
  // numbering) and parsing it as if it were a work hierarchy was the
  // root cause of "14 ish ЗАТРАТЫ ТРУДА duplicated 7× under a single
  // section" — 7 sub-bills × 2 labour codes, all bucketed identically.
  // pickWorkHierarchySheet probes both candidate sheets for dotted
  // resource sub-rows ("1.1", "1.2") and returns the one that scores
  // highest; falls back to whichever sheet name matches "единич" if
  // neither shows the work-hierarchy signature.
  const sheetName =
    pickWorkHierarchySheet(workbook) ||
    workbook.SheetNames.find((name) => name.toLowerCase().includes('единич'));
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const merges = sheet['!merges'] || [];

  // Find the column-header row and derive data start — same anchor rule
  // as parseVOR above. Юксалиш XLS pushes the header to row 12 (idx 11)
  // because of the deeper banner; Саттепо XLSX has it at row 9 (idx 8).
  // Old code assumed idx 8 globally and ingested the numeric reference
  // row (1.0 2.0 3.0 4.0 5.0 6.0) as a phantom work + skipped РАЗДЕЛ N.
  // section dividers because the section name lived in col A only.
  const anchor = findHeaderAnchor(rawData);
  const firstDataRowIdx = anchor ? anchor.firstDataRowIdx : 11;
  const headerRowIdx    = anchor ? anchor.headerRowIdx    : 8;

  // Merged-cell section headers — anchor the row floor to the actual
  // first-data row instead of the hard-coded 11 so deeper banners still
  // catch their merged-C section titles.
  const mergedSectionRows = new Set();
  for (const m of merges) {
    if (m.s.c === 2 && m.e.c > 2 && m.s.r >= firstDataRowIdx) {
      mergedSectionRows.add(m.s.r);
    }
  }

  // Object name — banner-row scan, placeholder-aware (rejects strings
  // wrapped in parens like "(наименование работ и затрат, наименование
  // объекта)" which the old scan happily accepted).
  const objectName = extractObjectName(rawData, headerRowIdx);

  // Юксалиш Тип-3 XLS structure note
  // ---------------------------------
  // Both the ВОР sheet and the единич sheet stack SEVEN
  // "Локальный ресурсный сметный расчет" sub-bills, one per discipline
  // (ОБЩЕСТРОИТЕЛЬНЫЕ РАБОТЫ(КЖ), ОБЩЕСТРОИТЕЛЬНЫЕ РАБОТЫ(АР),
  // ВОДОПРОВОД И КАНАЛИЗАЦИЯ (ВК), ОТОПЛЕНИЕ И ВЕНТИЛЯЦИЯ(ОВ),
  // ЭЛЕКТРОСНАБЖЕНИЕ(ЭС), СЛАБОТОЧНЫЕ СЕТИ (ВН_СКС), СЛАБОТОЧНЫЕ СЕТИ (ЛВС)).
  //
  // Each sub-bill begins with a row containing the literal word "на".
  // The discipline name sits in the cell IMMEDIATELY TO THE RIGHT of
  // "на" — but the two sheets use DIFFERENT columns for this:
  //
  //   единич sheet:  col A = '',   col B = 'на',  col C = discipline name
  //   ВОР    sheet:  col A = 'на', col B = discipline name, col C = ''
  //
  // We accept either layout. The discipline name often carries trailing
  // boilerplate after a comma ("...РАБОТЫ(КЖ), МНОГОЭТАЖНЫЙ ... ТИП-3");
  // strip everything from the first comma onwards so the resulting
  // stage names match what the user's existing XLSX-derived stages
  // look like (just "ОБЩЕСТРОИТЕЛЬНЫЕ РАБОТЫ(КЖ)" etc.).
  //
  // pickDisciplineFromRow → null if the row isn't a "на" marker,
  // otherwise the trimmed discipline name.
  const pickDisciplineFromRow = (row) => {
    if (!row) return null;
    const cA = row[0] != null ? String(row[0]).trim().toLowerCase() : '';
    const cB = row[1] != null ? String(row[1]).trim().toLowerCase() : '';
    let candidate = '';
    if (cA === 'на') {
      candidate = row[1] != null ? String(row[1]).trim() : '';
    } else if (cB === 'на') {
      candidate = row[2] != null ? String(row[2]).trim() : '';
    }
    if (!candidate || candidate.length < 4) return null;
    // Drop trailing project boilerplate after the first comma.
    const trimmed = candidate.split(',')[0].trim();
    return trimmed.length >= 4 ? trimmed : candidate;
  };

  // Sub-bill 1's "на" marker sits inside the banner area ABOVE the
  // column-header row, so we pre-scan rows 0..firstDataRowIdx to seed
  // `initialTopSection`. Sub-bills 2-7 fire inside the data loop via
  // the inline check below.
  let initialTopSection = '';
  for (let r = 0; r < firstDataRowIdx; r++) {
    const name = pickDisciplineFromRow(rawData[r]);
    if (name) { initialTopSection = name; break; }
  }

  // Parse data rows starting from firstDataRowIdx. See parseVOR above
  // for the rationale behind the three-level hierarchy bookkeeping —
  // same idea here, just adapted to the единич sheet.
  const sections = [];
  let currentTopSection = initialTopSection;
  let currentStage = '';
  let currentSubStage = '';
  let currentSection = {
    name: initialTopSection || objectName || 'Imported',
    items: [],
  };
  let lastParentNumber = '';
  const pathOf = () => {
    const parts = [];
    if (currentTopSection) parts.push(currentTopSection);
    if (currentStage)      parts.push(currentStage);
    if (currentSubStage)   parts.push(currentSubStage);
    return parts.join(HIERARCHY_DELIM) || (objectName || 'Imported');
  };
  const startSection = () => {
    if (currentSection.items.length > 0) sections.push(currentSection);
    currentSection = { name: pathOf(), items: [] };
  };

  for (let i = firstDataRowIdx; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((cell) => cell == null || cell === '')) continue;

    const colA = row[0] != null ? String(row[0]).trim() : '';
    const colB = row[1] != null ? String(row[1]).trim() : '';
    const colC = row[2] != null ? String(row[2]).trim() : '';
    const colD = row[3] != null ? String(row[3]).trim() : '';
    // toNum handles Russian comma-decimal cells and text-formatted
    // numbers — raw parseFloat would truncate "10,272" to 10 and
    // ultimately store original_quantity = 0, which is the root cause
    // of REJA showing 0 in Bosqichlar for files imported from
    // Russian-locale Excel.
    const colE = toNum(row[4]);
    const colF = toNum(row[5]);

    // Discipline marker (Юксалиш Тип-3 XLS sub-bill boundary). Two
    // layouts (handled by pickDisciplineFromRow above):
    //   единич sheet: col A empty, col B == "на",  col C == discipline
    //   ВОР    sheet: col A == "на", col B == discipline, col C empty
    //
    // Reset every level of the path because a new discipline starts
    // fresh: no carried-over current stage / sub-stage from the previous
    // sub-bill, no orphan resource parent pointer.
    const disciplineName = pickDisciplineFromRow(row);
    if (disciplineName) {
      currentTopSection = disciplineName;
      currentStage      = '';
      currentSubStage   = '';
      lastParentNumber  = '';
      startSection();
      continue;
    }

    // РАЗДЕЛ N.<NAME> divider in col A — Юксалиш / Госархстрой XLS
    // section format. The row carries no col B/C/D so the legacy
    // "skip if !colC" guard below would silently drop it.
    //
    // KEY DESIGN POINT: a РАЗДЕЛ nests UNDER whatever discipline is
    // already on `currentTopSection` (set by the "на" marker upstream),
    // not on top of it. Earlier this assigned `currentTopSection =
    // divName`, which threw away the discipline context — so КЖ's
    // ЗЕМЛЯНЫЕ РАБОТЫ + ФУНДАМЕНТНАЯ ПЛИТА + … and ВК's ХОЗ. ПИТЬЕВОЙ
    // ВОДОПРОВОД + … all surfaced as sibling top-level stages instead
    // of being grouped under their parent discipline. With each РАЗДЕЛ
    // restarting its work numbering at 1, the Bosqichlar tab ended up
    // showing "line number started from 1 multiple times" — the exact
    // symptom you reported.
    //
    // Now: РАЗДЕЛ becomes the STAGE (currentStage) under the current
    // discipline. If there is no discipline above (no "на" marker —
    // single-discipline file, e.g. earlier XLS templates), pathOf()
    // gracefully falls back to "<stage>" instead of "<discipline> ›
    // <stage>", so single-discipline behaviour is unchanged.
    if (/^\s*РАЗДЕЛ\s+\d/i.test(colA) && !colB && !colC && !colD) {
      const divName = colA.replace(/^\s*РАЗДЕЛ\s+\d+\s*[.:]?\s*/i, '').trim() || colA;
      currentStage      = divName;
      currentSubStage   = '';
      startSection();
      lastParentNumber  = '';
      continue;
    }

    // Reject the "1 2 3 4 5 6" numeric column-reference row that sits
    // 2 rows below the column-header. parseEdinich's "rows with bare
    // integer in A" branch (further down) would otherwise treat it as
    // a parent work and push a phantom row "{item_number:'1',
    // code:'2.0', name:'3.0', uom:'4.0', quantity:0}" into the imported
    // smeta — same symptom the screenshot showed on Юксалиш Тип-3.
    const colAAsNum = Number(String(colA).replace(',', '.'));
    const colCAsNum = Number(String(colC).replace(',', '.'));
    if (
      Number.isFinite(colAAsNum) && colAAsNum <= 6 && colAAsNum > 0 &&
      Number.isFinite(colCAsNum) && colCAsNum <= 6 && colCAsNum > 0
    ) {
      continue;
    }

    if (!colC) continue;
    if (colC.toUpperCase().includes('ИТОГО')) continue;

    // Section headers — three layouts now handled here:
    //   1) "Merged" (XLSX): col C spans into col D+, no item number.
    //      Carried over from the legacy parser; remains the primary
    //      check for the Саттепо / Block 1.xlsx / Block 3.xlsx family.
    //   2) "Numbered" (legacy): integer in col A, no UOM/qty, uppercase C.
    //   3) "Classic" (XLS resource catalogs): cols A and B both empty,
    //      uppercase text in col C. This is the rule that catches the
    //      ТРУДОВЫЕ РЕСУРСЫ / СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ / МАТЕРИАЛЫ
    //      dividers that the Юксалиш Тип-3 XLS sheet uses. SheetJS
    //      doesn't expose XLS merge metadata reliably so (1) didn't
    //      fire — every divider fell through to the resource sub-row
    //      branch below and got captured as a phantom resource under
    //      whichever work happened to precede it. Result was 684
    //      "works" all dumped into a single "Imported" bucket. With
    //      (3) in place those dividers become real section breaks
    //      again. Matches the structurally-identical rule parseVOR
    //      uses above, so XLSX behaviour is unchanged (the merged path
    //      already fired first there).
    const isMergedHeader = mergedSectionRows.has(i) && !colA;
    const isNumberedHeader = colA && /^\d+$/.test(colA) && !colD && (colE === 0) && colC.length > 5 && colC === colC.toUpperCase() && !/\d{2,}/.test(colC);
    const isClassicHeader =
      !colA &&
      !colB &&
      colC.length > 5 &&
      colC === colC.toUpperCase() &&
      !/\d{2,}/.test(colC) &&
      colE === 0;
    if (isMergedHeader || isNumberedHeader || isClassicHeader) {
      if (isTopSectionHeader(colC)) {
        currentTopSection = colC;
        currentStage      = '';
        currentSubStage   = '';
      } else if (isSubStageHeader(colC) && currentStage) {
        currentSubStage = colC;
      } else {
        currentStage    = colC;
        currentSubStage = '';
      }
      // Reset the parent pointer so an unrelated "empty A & B" resource
      // row in the new section doesn't get attributed to whichever work
      // happened to be the last parent in the previous section. Fixes
      // an orphan-attribution risk that became visible once the new
      // classic-header detection started firing on XLS files.
      lastParentNumber = '';
      startSection();
      continue;
    }

    // Rows with item number in A — parent work items or standalone materials
    if (colA && /^\d+$/.test(colA)) {
      const hasCode = colB && colB !== 'С';
      lastParentNumber = colA;

      // TEMPLATE MODE: parent works always start at quantity = 0 — the
      // user fills it in manually via the Bajarildi field. We capture
      // the file's "по проектным данным" total (colF) into a separate
      // `norma_quantity` so the Smeta boshqaruvi NORMA pill has a
      // reference value to display ("the original imported norm")
      // even though the live `quantity` ledger column starts at 0.
      // Without this the pill renders "—" and the user has no anchor
      // to compare against the value they type into Bajarildi.
      // Children's per-unit norm is captured below in
      // `quantity_per_unit`; child.quantity stays 0 so the cascade
      // `parent.qty × norm` resolves to 0 too.
      // Parent rows store their project quantity in COL E in most
      // Госархитектстрой templates (older files put it in col F).
      // We try col E first and fall back to col F. Reading just col F
      // historically left modern files with parent qty = 0 because
      // that column is blank for parents in their layout.
      //
      // We also keep NEGATIVE values — subtraction positions
      // ("ВЫЧИТАЕТСЯ ПОЗИЦИЯ") store a negative qty so the work
      // deducts from the totals. Dropping them to 0 would lose the
      // intended deduction.
      const parentRaw = colE !== 0 ? colE : colF;
      currentSection.items.push({
        item_number: colA,
        code: colB,
        name: colC,
        uom: colD,
        quantity: 0,
        norma_quantity: parentRaw,
        quantity_per_unit: 0,
        is_parent: hasCode,
        resource_type: '',
        parent_item_number: '',
      });
      continue;
    }

    // Child/resource rows — TWO shapes seen in real estimates:
    //
    //   shape A: empty A AND empty B (older Block 1-style files).
    //   shape B: dotted item-number like "1.1", "1.2", "2.1" in colA
    //            with the resource's normative code (numeric) in colB
    //            (Block 3 / Saatepo Avenyu-style files).
    //
    // Without shape B we silently dropped ~1400 resource rows per
    // estimate, which made every work display "0 resurs" in the Smeta
    // boshqaruvi tab and broke the auto-reservation pipeline. Shape B
    // is now treated identically to shape A: norm_rate goes in colE,
    // total quantity in colF, parent is the part before the dot.
    const dottedMatch = colA && /^(\d+)\.\d+$/.exec(colA);
    if ((!colA && !colB && lastParentNumber) || dottedMatch) {
      const resourceType = detectResourceType(colD);
      const parentNum = dottedMatch ? dottedMatch[1] : lastParentNumber;

      // TEMPLATE MODE for child resources: only the per-unit norm
      // (column E "на. ед. измерения") is used by the cascade math
      // (child.quantity = parent.quantity × norm). Column F's "по
      // проектным данным" — the file's pre-computed total for THIS
      // particular project — is captured into `norma_quantity` as a
      // DISPLAY-ONLY anchor. It is NOT used in any calculation; the
      // live cascade still drives child.quantity from parent qty +
      // norm_rate. We just want the user to be able to see what the
      // source file said for each resource row in the Smetalar list,
      // alongside the parent's project total. Without this, sub-rows
      // in the Единич table display "0" because templateMode zeroes
      // the live `quantity` ledger.
      currentSection.items.push({
        item_number: dottedMatch ? colA : '', // keep "1.1" so it round-trips
        code: dottedMatch ? colB : '',         // resource normative code
        name: colC,
        uom: colD,
        quantity: 0,
        // Display-only: file's project total for this resource row
        // (e.g. 300.1696 ЧЕЛ-Ч for a 25.035 × 1000 М3 work). Passed
        // through to the backend as imported_quantity (migration 413).
        // colE/colF already cleaned by toNum.
        norma_quantity: colF,
        quantity_per_unit: colE,
        is_parent: false,
        resource_type: resourceType,
        parent_item_number: parentNum,
      });
      continue;
    }
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  // Post-pass: derive any missing parent `norma_quantity` from its
  // children. In some Russian Excel templates the parent row's col F
  // (по проектным данным) is left blank — only the child resource rows
  // carry their project totals. Without this fallback REJA / Miqdor on
  // the parent renders as 0 for those files.
  //
  // Math: for a child resource, the file relation is
  //   child.colF (project total) = parent.qty × child.colE (per-unit norm)
  // so parent.qty = child.colF / child.colE. We pick the first child
  // whose colE > 0 to do the inversion (children with empty norms can't
  // help). If no usable child exists we leave the parent at 0 — there's
  // no way to derive it from the data we have.
  // Post-pass uses !== 0 instead of > 0 so NEGATIVE quantities also
  // get derived. Subtraction positions ("ВЫЧИТАЕТСЯ ПОЗИЦИЯ") store
  // negative values; the > 0 guard previously dropped them and made
  // the parent + every child render as 0.
  for (const sec of sections) {
    if (!Array.isArray(sec.items)) continue;
    for (let i = 0; i < sec.items.length; i++) {
      const it = sec.items[i];
      // Only parents whose own value was empty get patched.
      if (it.is_parent !== undefined && !it.is_parent) continue;
      if (Number(it.norma_quantity) !== 0) continue;
      const parentNumStr = String(it.item_number || '').trim();
      if (!parentNumStr) continue;
      for (let j = i + 1; j < sec.items.length; j++) {
        const child = sec.items[j];
        if (String(child.parent_item_number || '') !== parentNumStr) break;
        const childTotal = Number(child.norma_quantity || 0);
        const perUnit    = Number(child.quantity_per_unit || 0);
        if (childTotal !== 0 && perUnit !== 0) {
          it.norma_quantity = childTotal / perUnit;
          break;
        }
      }
    }
  }

  return { sections, objectName };
}

// =====================================================
// РЕСУРС PARSER
// =====================================================

// detectResourceSection — returns BOTH the broad resource_type bucket
// (labor / equipment / material) and the material sub-bucket
// (standard / cable / equipment) used by the v23 chips.
//
// The original implementation collapsed every material-side section
// down to a single string, which is why КАБЕЛЬНАЯ ПРОДУКЦИЯ rows ended
// up in "Stroyamaterial 7%" and ОБОРУДОВАНИЕ rows collided with the
// СТРОИТЕЛЬНЫЕ МАШИНЫ bucket. The Госкомархитектстрой regulation
// requires three different overhead %'s for these (7 / 3.2 / 1.5 / 2),
// so they MUST be tracked as distinct material_type values.
//
// Returns null when the text is not a recognised section header.
function detectResourceSection(text) {
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper.includes('ТРУДОВЫЕ РЕСУРСЫ') || upper.includes('ТРУДОВЫХ РЕСУРС')) {
    return { resourceType: 'labor', materialType: null };
  }
  // СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ → Mashina tab (МАШ.-Ч hours).
  // Note we use resource_type='equipment' here only because that's the
  // historical convention for МАШ.-Ч rows; it has nothing to do with
  // material_type='equipment' (which is for оборудование items).
  if (upper.includes('СТРОИТЕЛЬНЫЕ МАШИНЫ') || upper.includes('СТРОИТЕЛЬНЫХ МАШИН')) {
    return { resourceType: 'equipment', materialType: null };
  }
  if (upper.includes('КАБЕЛЬНАЯ ПРОДУКЦИЯ') || upper.includes('КАБЕЛЬНОЙ ПРОДУКЦИИ')) {
    return { resourceType: 'material', materialType: 'cable' };
  }
  if (upper.includes('ОБОРУДОВАНИЕ') || upper.includes('ОБОРУДОВАНИ')) {
    return { resourceType: 'material', materialType: 'equipment' };
  }
  if (upper.includes('МАТЕРИАЛЬНЫЕ РЕСУРСЫ') || upper.includes('МАТЕРИАЛЬНЫХ РЕСУРС')) {
    return { resourceType: 'material', materialType: 'standard' };
  }
  return null;
}

// Fallback classifier — runs per-item when the section header didn't
// disambiguate (Блок 1 has only one big МАТЕРИАЛЬНЫЕ РЕСУРСЫ bucket
// even though some files mix in cable/equipment items inline). Returns
// 'cable' / 'equipment' / null. The keyword lists are intentionally
// conservative — false negatives are easy to fix from the per-row
// dropdown later, false positives are not.
const CABLE_NAME_RE = /\b(КАБЕЛ|ПРОВОД(?!\s*НЫЙ\s*РАСЧ)|ВВГ|ВВГНГ|АВВГ|КГ-|ПВ-1|ПВ-3|СИП-|ПУГВ|ПУНП|ПВС|ШВВП|ППГ|ВРГ)/i;
const EQUIPMENT_NAME_RE = /(ШКАФ\b|ЩИТ\b|ЩИТОК|ЩМП|ВРУ-|УРЩ-|АВТОМАТ\.?\s+ВЫКЛ|РОЗЕТКА|ВЫКЛЮЧАТЕЛЬ\b|СВЕТИЛЬНИК|СЧ[ЕЁ]ТЧИК|ЛАМПА\b|ДАТЧИК\b|НАСОС\b|КОТ[ЕЁ]Л\b|КРАН\s+ШАРОВ|ВЕНТИЛЯТОР\b|РАДИАТОР\b|ТЕПЛОСЧ[ЕЁ]ТЧИК|ЗАДВИЖКА|ОБОРУДОВАНИ)/i;
function classifyMaterialByName(name) {
  if (!name) return null;
  const u = String(name).toUpperCase();
  if (CABLE_NAME_RE.test(u)) return 'cable';
  if (EQUIPMENT_NAME_RE.test(u)) return 'equipment';
  return null;
}

function parseResurs(workbook) {
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('ресурс')
  );
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Extract object name from rows 4-9
  let objectName = '';
  for (let row = 4; row < 10; row++) {
    const rowData = rawData[row];
    if (rowData) {
      for (let col = 0; col < 7; col++) {
        const val = rowData[col];
        if (val && typeof val === 'string' && (val.includes('Блок') || val.includes('блок') || val.includes('объект'))) {
          const match = val.match(/объект\s*[-–:]\s*(.+)/i);
          objectName = match ? match[1].trim() : val.trim();
          break;
        }
      }
      if (objectName) break;
    }
  }

  const sections = [];
  // currentSection tracks BOTH the broad bucket and the material sub-bucket.
  // materialType is null for non-material sections (labor / machines).
  let currentSection = {
    name: objectName || 'Resurslar',
    items: [],
    resourceType: 'material',
    materialType: 'standard',
  };

  // Imported-budget capture. The Ресурс sheet ends with a small block of
  // summary rows that carry the canonical project budget — we sum them
  // into the dedicated fields below so the Reja vs Fakt page can show
  // the real budget instead of computing it from per-line plan totals.
  //
  //   ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ      → materialBudget
  //   ТРАНСПОРТНЫЕ РАСХОДЫ НА МАТЕРИАЛЫ    → transportBudget
  //   ИТОГО ПРЯМЫЕ ЗАТРАТЫ                  → budgetTotal (the headline)
  //
  // The transport row also appears mid-sheet as per-section overhead
  // (which the parser already skips). The bottom block is identifiable
  // because it sits AFTER all the section data and its label appears in
  // colB or colC with no item number in colA.
  let materialBudget = 0;
  let transportBudget = 0;
  let budgetTotal = 0;

  // Pull the numeric total off a summary row. The total can live in
  // colE/F/G depending on the file — pick the first numeric one we find,
  // preferring the right-most column (that's where the file lays the
  // grand total). Falls back to scanning the whole row so weird padding
  // (extra empty columns) still works.
  const pickSummaryAmount = (row) => {
    if (!Array.isArray(row)) return 0;
    for (let c = row.length - 1; c >= 4; c--) {
      const cell = row[c];
      if (cell == null || cell === '') continue;
      const n = typeof cell === 'number' ? cell : parseFloat(String(cell).replace(/[\s ]/g, '').replace(',', '.'));
      if (!isNaN(n) && n > 0) return n;
    }
    return 0;
  };

  // Pre-scan: does the file declare explicit КАБЕЛЬНАЯ ПРОДУКЦИЯ / ОБОРУДОВАНИЕ
  // section headers? When it does, those sections are authoritative and we must
  // NOT let the name-based fallback re-bucket a material-section item (e.g. a
  // СВЕТИЛЬНИК listed under МАТЕРИАЛЬНЫЕ РЕСУРСЫ) into cable/equipment — that is
  // exactly what diverged from the Excel's section subtotals. The name fallback
  // is kept ONLY for single-bucket files (one big МАТЕРИАЛЬНЫЕ РЕСУРСЫ list).
  let hasExplicitSubBuckets = false;
  for (let k = 11; k < rawData.length; k++) {
    const rk = rawData[k];
    if (!rk) continue;
    const a = rk[0] != null ? String(rk[0]).trim() : '';
    const d = rk[3] != null ? String(rk[3]).trim() : '';
    const nm = rk[2] != null ? String(rk[2]).trim() : '';
    if (!a && !d) {
      const meta = detectResourceSection(nm);
      if (meta && (meta.materialType === 'cable' || meta.materialType === 'equipment')) {
        hasExplicitSubBuckets = true;
        break;
      }
    }
  }

  for (let i = 11; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((cell) => cell == null || cell === '')) continue;

    const colA = row[0] != null ? String(row[0]).trim() : '';
    const colB = row[1] != null ? String(row[1]).trim() : '';
    const colC = row[2] != null ? String(row[2]).trim() : '';
    const colD = row[3] != null ? String(row[3]).trim() : '';
    // toNum handles Russian comma-decimal text cells safely.
    const colE = toNum(row[4]);
    const colF = toNum(row[5]);
    const colG = toNum(row[6]);

    // Skip empty description
    if (!colC && !colB) continue;

    // Check for ИТОГО rows AND the per-section "ТРАНСПОРТНЫЕ РАСХОДЫ"
    // subtotals — those are calculated overhead lines that should never
    // be persisted as items.
    const textToCheck = (colC || colB || '').toUpperCase();
    if (textToCheck.includes('ИТОГО')) {
      // Capture the file's bottom-summary totals on the way through.
      // Only the bottom-block ИТОГО rows carry the project-wide totals
      // we want; per-section ИТОГО (which always have data above and
      // below them) are also caught here, but their numbers are smaller
      // than the project total so the MAX-style assignment below is
      // self-correcting on real files.
      const amount = pickSummaryAmount(row);
      if (amount > 0) {
        if (textToCheck.includes('ПРЯМЫЕ') && textToCheck.includes('ЗАТРАТ')) {
          // Headline: the WHOLE direct-cost budget for this estimate.
          if (amount > budgetTotal) budgetTotal = amount;
        } else if (textToCheck.includes('СТРОИТЕЛЬНЫМ') && textToCheck.includes('МАТЕРИАЛ')) {
          // Material-only sub-total (excludes transport / labor / machines).
          if (amount > materialBudget) materialBudget = amount;
        }
      }
      continue;
    }
    if (textToCheck.includes('ТРАНСПОРТНЫЕ') && textToCheck.includes('РАСХОД')) {
      // Pick up only the BOTTOM transport-overhead row — i.e. the one
      // that sums materials project-wide. The parser walks top-to-bottom,
      // so the LAST one we see is the project-level total. Overwriting
      // every time achieves that without needing extra book-keeping.
      const amount = pickSummaryAmount(row);
      if (amount > 0) transportBudget = amount;
      continue;
    }

    // Detect section header (resource type group) or numbered section header.
    // detectResourceSection now returns { resourceType, materialType }.
    //
    // CRITICAL: only treat the row as a typed section header when it
    // ACTUALLY looks like one — empty item number AND empty UOM. The
    // keyword check is a substring match (we want "КАБЕЛЬНОЙ ПРОДУКЦИИ"
    // to register), so without this guard a genuine line item like
    // "КРАНЫ НА АВТОМОБИЛЬНОМ ХОДУ ПРИ РАБОТЕ НА МОНТАЖЕ ТЕХНОЛОГИЧЕСКОГО
    // ОБОРУДОВАНИЯ" (a МАШ.-Ч machine entry) would re-classify every
    // following line as a material/equipment row.
    const looksLikeHeaderRow = !colA && !colD;
    const sectionMeta = looksLikeHeaderRow ? detectResourceSection(colC) : null;
    const isNumberedSectionHeader = colA && /^\d+$/.test(colA) && !colD && (colE === 0 || isNaN(colE)) && colC.length > 5 && colC === colC.toUpperCase() && !/\d{2,}/.test(colC);
    if (sectionMeta || isNumberedSectionHeader) {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        name: colC,
        items: [],
        resourceType: sectionMeta?.resourceType || currentSection.resourceType,
        // Inherit current material sub-bucket on numbered (non-typed)
        // headers so a sub-section under КАБЕЛЬНАЯ ПРОДУКЦИЯ stays cable.
        materialType: sectionMeta
          ? sectionMeta.materialType
          : currentSection.materialType,
      };
      continue;
    }

    // Skip rows without item number (non-data rows)
    if (!colA) continue;

    // Data row
    const unitPrice = isNaN(colF) ? 0 : colF;
    const total = isNaN(colG) ? 0 : colG;

    // Resource type — the UoM is the most reliable signal and takes
    // precedence over the section: ЧЕЛ-Ч is always labour and МАШ-Ч is
    // always a machine, no matter which section (if any) the row was
    // detected under. The section type is only the fallback for genuine
    // material rows. Previously this trusted the section alone, so a
    // machine/labour row that preceded an undetected section header (or
    // landed in the default 'material' bucket) was mis-tagged 'material'.
    // That produced a duplicate, 0-price catalog entry for the same
    // resource that the Единич import had already imported as 'equipment'.
    const uomType = detectResourceType(colD);
    const resType = (uomType === 'labor' || uomType === 'equipment')
      ? uomType
      : currentSection.resourceType;

    // Material-type resolution (only meaningful for material rows):
    //   1. Section's explicit material_type wins (КАБЕЛЬНАЯ ПРОДУКЦИЯ →
    //      'cable', ОБОРУДОВАНИЕ → 'equipment', МАТЕРИАЛЬНЫЕ РЕСУРСЫ →
    //      'standard').
    //   2. If the section is just "МАТЕРИАЛЬНЫЕ РЕСУРСЫ" (one big bucket
    //      like in Блок 1), let the item-name fallback try to spot the
    //      occasional cable or equipment line mixed in.
    let materialType = null;
    if (resType === 'material') {
      materialType = currentSection.materialType || 'standard';
      // Only name-guess when the file has NO explicit cable/equipment sections;
      // otherwise the section is authoritative and matches the Excel subtotals.
      if (materialType === 'standard' && !hasExplicitSubBuckets) {
        const guess = classifyMaterialByName(colC);
        if (guess) materialType = guess;
      }
    }

    currentSection.items.push({
      item_number: colA,
      code: '',
      name: colC,
      uom: colD,
      quantity: isNaN(colE) ? 0 : colE,
      unit_price: unitPrice,
      total_price: total,
      resource_type: resType,
      material_type: materialType,
    });
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  // If ИТОГО ПРЯМЫЕ ЗАТРАТЫ wasn't on the sheet (some older Ресурс
  // exports skip the grand-total row), fall back to materials + transport.
  // This still beats the per-line summation in the Reja vs Fakt handler
  // because it includes transport overhead.
  if (budgetTotal === 0 && (materialBudget > 0 || transportBudget > 0)) {
    budgetTotal = materialBudget + transportBudget;
  }

  return {
    sections,
    objectName,
    budgetTotal,
    materialBudget,
    transportBudget,
  };
}

// =====================================================
// СВОД PARSER
// =====================================================

function parseSvod(workbook) {
  // Find sheet with "старт" or "свод" in name
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('старт') || name.toLowerCase().includes('свод')
  );
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rawData.length < 4) return null;

  // Row 1 (index 0): Title
  // Row 2 (index 1): Project description
  // Row 3 (index 2): Column headers — A=№, B=Name, C=Всего, D+=Building columns
  const headerRow = rawData[2];
  if (!headerRow) return null;

  // Extract building column names starting from column D (index 3)
  const buildings = [];
  for (let col = 3; col < headerRow.length; col++) {
    const val = headerRow[col];
    if (val && typeof val === 'string' && val.trim()) {
      buildings.push({ col, name: val.trim() });
    } else if (val && typeof val === 'number') {
      buildings.push({ col, name: String(val).trim() });
    }
  }

  if (buildings.length === 0) return null;

  // Extract project name from row 2
  let projectName = '';
  const row2 = rawData[1];
  if (row2) {
    for (let col = 0; col < Math.min(row2.length, 10); col++) {
      const val = row2[col];
      if (val && typeof val === 'string' && val.length > 10) {
        projectName = val.trim();
        break;
      }
    }
  }

  // Parse data rows starting from row 4 (index 3)
  const categories = [];
  for (let i = 3; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    const colB = row[1] != null ? String(row[1]).trim() : '';
    if (!colB) continue;

    // Skip completely empty value rows
    const hasValues = buildings.some((b) => {
      const val = row[b.col];
      return val != null && val !== '' && val !== 0;
    });
    if (!hasValues && !row[2]) continue;

    const amounts = {};
    let totalAmount = 0;

    // Column C (index 2) = Всего (total)
    if (row[2] != null) {
      totalAmount = typeof row[2] === 'number' ? row[2] : parseFloat(row[2]) || 0;
    }

    for (const b of buildings) {
      const val = row[b.col];
      amounts[b.name] = val != null ? (typeof val === 'number' ? val : parseFloat(val) || 0) : 0;
    }

    categories.push({
      row_number: categories.length + 1,
      name: colB,
      total: totalAmount,
      amounts,
    });
  }

  return {
    buildings: buildings.map((b) => b.name),
    categories,
    projectName,
  };
}

// =====================================================
// DETECT AVAILABLE SHEETS
// =====================================================

function detectSheets(workbook) {
  const sheets = [];
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (lower.includes('вор')) {
      sheets.push({ name, type: 'vor', label: 'ВОР', enabled: true });
    } else if (lower.includes('единич')) {
      sheets.push({ name, type: 'edinich', label: 'Единич', enabled: true });
    } else if (lower.includes('ресурс')) {
      sheets.push({ name, type: 'resurs', label: 'Ресурс', enabled: true });
    } else if (lower.includes('старт') || lower.includes('свод')) {
      sheets.push({ name, type: 'svod', label: 'Свод', enabled: true });
    }
  }
  return sheets;
}

// =====================================================
// TEMPLATE GENERATORS (using ExcelJS for styled output)
// =====================================================

async function downloadTemplate(type) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  const titleFont = { name: 'Times New Roman', size: 12, bold: true };
  const headerFont = { name: 'Times New Roman', size: 10, bold: true };
  const dataFont = { name: 'Times New Roman', size: 10 };
  const sectionFont = { name: 'Times New Roman', size: 10, bold: true, color: { argb: '1F4E79' } };
  const childFont = { name: 'Times New Roman', size: 9, italic: true, color: { argb: '666666' } };
  const numFmt = '#,##0.00';

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D6E4F0' } };
  const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };
  const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE4D6' } };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'B4C6E7' } },
    left: { style: 'thin', color: { argb: 'B4C6E7' } },
    bottom: { style: 'thin', color: { argb: 'B4C6E7' } },
    right: { style: 'thin', color: { argb: 'B4C6E7' } },
  };

  if (type === 'vor') {
    const ws = wb.addWorksheet('ВОР');
    ws.columns = [
      { width: 8 }, { width: 18 }, { width: 45 }, { width: 14 }, { width: 16 }, { width: 16 },
    ];

    // Title
    ws.mergeCells('B2:F2');
    const titleCell = ws.getCell('B2');
    titleCell.value = 'LOYIHA NOMI / НАЗВАНИЕ ПРОЕКТА';
    titleCell.font = titleFont;
    titleCell.alignment = { horizontal: 'center' };

    // Object name
    ws.mergeCells('B6:F6');
    const objCell = ws.getCell('B6');
    objCell.value = 'Obyekt - Blok №1 / Объект - Блок №1';
    objCell.font = { ...titleFont, size: 11 };
    objCell.alignment = { horizontal: 'center' };

    // Table header row 8
    const hdrRow = ws.getRow(8);
    ['№', 'Shifr / Шифр', 'Ish nomi / Наименование работ', 'Birlik / Ед. изм.', 'Miqdori / Количество', ''].forEach((v, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = v;
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    // Sub-header row 9
    const subRow = ws.getRow(9);
    ['', '', '', '', 'birlikka / на ед.', "loyiha b-cha / по проекту"].forEach((v, i) => {
      const cell = subRow.getCell(i + 1);
      cell.value = v;
      cell.font = { ...headerFont, size: 8 };
      cell.fill = headerFill;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', wrapText: true };
    });
    ws.mergeCells('A8:A9'); ws.mergeCells('B8:B9'); ws.mergeCells('C8:C9'); ws.mergeCells('D8:D9');
    ws.mergeCells('E8:F8');

    // Column numbers row 10
    const numRow = ws.getRow(10);
    [1, 2, 3, 4, 5, 6].forEach((v, i) => {
      const cell = numRow.getCell(i + 1);
      cell.value = v;
      cell.font = { ...dataFont, size: 8, color: { argb: '888888' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = thinBorder;
    });

    // Section header row 11
    ws.mergeCells('C11:D11');
    const secRow = ws.getRow(11);
    secRow.getCell(1).value = '';
    secRow.getCell(3).value = "BO'LIM NOMI / СЕКЦИЯ ЗЕМЛЯНЫЕ РАБОТЫ";
    for (let i = 1; i <= 6; i++) {
      secRow.getCell(i).font = sectionFont;
      secRow.getCell(i).fill = sectionFill;
      secRow.getCell(i).border = thinBorder;
    }

    // Data rows
    const dataRows = [
      [1, 'Ц0101-001-01', 'Yer ishlari / Разработка грунта', 'м3', 150, null],
      [2, 'С', 'Material nomi / Песок строительный', 'м3', 50, null],
      [3, 'Ц0201-005-02', 'Beton ishlari / Укладка бетона', 'м3', 80, null],
      [4, '', 'Jihoz nomi / Оборудование', 'шт', 5, null],
    ];
    dataRows.forEach((vals, idx) => {
      const r = ws.getRow(12 + idx);
      vals.forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v;
        cell.font = dataFont;
        cell.border = thinBorder;
        if (i === 0) cell.alignment = { horizontal: 'center' };
        if (i >= 4 && v) cell.numFmt = numFmt;
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(buf, 'shablon_VOR.xlsx');

  } else if (type === 'edinich') {
    const ws = wb.addWorksheet('единич');
    ws.columns = [
      { width: 8 }, { width: 18 }, { width: 45 }, { width: 14 }, { width: 16 }, { width: 16 },
    ];

    ws.mergeCells('B2:F2');
    ws.getCell('B2').value = 'LOYIHA NOMI / НАЗВАНИЕ ПРОЕКТА';
    ws.getCell('B2').font = titleFont;
    ws.getCell('B2').alignment = { horizontal: 'center' };

    ws.mergeCells('B6:F6');
    ws.getCell('B6').value = 'Obyekt - Blok №1 / Объект - Блок №1';
    ws.getCell('B6').font = { ...titleFont, size: 11 };
    ws.getCell('B6').alignment = { horizontal: 'center' };

    const hdrRow = ws.getRow(8);
    ['№', 'Shifr / Шифр', 'Ish nomi / Наименование работ', 'Birlik / Ед. изм.', 'Miqdori / Количество', ''].forEach((v, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = v; cell.font = headerFont; cell.fill = headerFill; cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    const subRow = ws.getRow(9);
    ['', '', '', '', 'birlikka / на ед.', "loyiha b-cha / по проекту"].forEach((v, i) => {
      const cell = subRow.getCell(i + 1);
      cell.value = v; cell.font = { ...headerFont, size: 8 }; cell.fill = headerFill; cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', wrapText: true };
    });
    ws.mergeCells('A8:A9'); ws.mergeCells('B8:B9'); ws.mergeCells('C8:C9'); ws.mergeCells('D8:D9');
    ws.mergeCells('E8:F8');

    const numRow = ws.getRow(10);
    [1, 2, 3, 4, 5, 6].forEach((v, i) => {
      const cell = numRow.getCell(i + 1);
      cell.value = v; cell.font = { ...dataFont, size: 8, color: { argb: '888888' } };
      cell.alignment = { horizontal: 'center' }; cell.border = thinBorder;
    });

    // Section
    ws.mergeCells('C11:D11');
    const secRow = ws.getRow(11);
    secRow.getCell(3).value = "BO'LIM NOMI / СЕКЦИЯ";
    for (let i = 1; i <= 6; i++) { secRow.getCell(i).font = sectionFont; secRow.getCell(i).fill = sectionFill; secRow.getCell(i).border = thinBorder; }

    // Parent row
    const p1 = ws.getRow(12);
    [648, 'Ц1008-002-02', 'Asosiy ish / Основная работа', 'шт', 282, null].forEach((v, i) => {
      const cell = p1.getCell(i + 1);
      cell.value = v; cell.font = { ...dataFont, bold: true }; cell.border = thinBorder;
      if (i === 0) cell.alignment = { horizontal: 'center' };
    });

    // Child rows
    const children = [
      ['', '', 'Ishchi kuchi / ЗАТРАТЫ ТРУДА РАБОЧИХ', 'чел-ч', 1.68, 473.76],
      ['', '', 'Mashina / ДРЕЛИ ЭЛЕКТРИЧЕСКИЕ', 'маш-ч', 0.16, 45.12],
      ['', '', 'Material / Материал', 'шт', 1, 282],
    ];
    children.forEach((vals, idx) => {
      const r = ws.getRow(13 + idx);
      vals.forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v; cell.font = childFont; cell.border = thinBorder;
        if (i >= 4 && v) cell.numFmt = numFmt;
      });
    });

    // More parent rows
    const p2 = ws.getRow(16);
    [649, 'С', 'Alohida material / Материал отдельный', 'шт', 272, null].forEach((v, i) => {
      const cell = p2.getCell(i + 1);
      cell.value = v; cell.font = dataFont; cell.border = thinBorder;
      if (i === 0) cell.alignment = { horizontal: 'center' };
    });
    const p3 = ws.getRow(17);
    [650, '', 'Jihoz / Оборудование', 'шт', 10, null].forEach((v, i) => {
      const cell = p3.getCell(i + 1);
      cell.value = v; cell.font = dataFont; cell.border = thinBorder;
      if (i === 0) cell.alignment = { horizontal: 'center' };
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(buf, 'shablon_edinich.xlsx');

  } else if (type === 'resurs') {
    const ws = wb.addWorksheet('ресурс');
    ws.columns = [
      { width: 8 }, { width: 16 }, { width: 40 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 20 },
    ];

    ws.mergeCells('B2:G2');
    ws.getCell('B2').value = 'LOYIHA NOMI / НАЗВАНИЕ ПРОЕКТА';
    ws.getCell('B2').font = titleFont;
    ws.getCell('B2').alignment = { horizontal: 'center' };

    ws.mergeCells('B6:G6');
    ws.getCell('B6').value = 'Obyekt - Blok №1 / Объект - Блок №1';
    ws.getCell('B6').font = { ...titleFont, size: 11 };
    ws.getCell('B6').alignment = { horizontal: 'center' };

    const hdrRow = ws.getRow(8);
    ['№', 'Shifr / Шифр', 'Nomi / Наименование', 'Birlik / Ед. изм.', 'Miqdori / Кол-во', 'Narxi / Цена', 'Summasi / Сумма'].forEach((v, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = v; cell.font = headerFont; cell.fill = headerFill; cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    const numRow = ws.getRow(10);
    [1, 2, 3, 4, 5, 6, 7].forEach((v, i) => {
      const cell = numRow.getCell(i + 1);
      cell.value = v; cell.font = { ...dataFont, size: 8, color: { argb: '888888' } };
      cell.alignment = { horizontal: 'center' }; cell.border = thinBorder;
    });

    // Resource sections with data
    const sections = [
      { name: "ISHCHI KUCHI / ТРУДОВЫЕ РЕСУРСЫ", items: [
        [1, '', 'Ishchi kuchi / Затраты труда рабочих', 'чел-ч', 1190.40, 25581.74, 30452503.30],
      ]},
      { name: "MASHINA VA MEXANIZMLAR / СТРОИТЕЛЬНЫЕ МАШИНЫ", items: [
        [2, '', 'Drel / Дрели электрические', 'маш-ч', 45.93, 950, 43637.30],
      ]},
      { name: "MATERIALLAR / МАТЕРИАЛЬНЫЕ РЕСУРСЫ", items: [
        [3, '', 'Material 1 / Болты', 'т', 0.0012, 15402000, 18482.40],
        [4, '', 'Material 2 / Кабель', 'м', 2300, 3348, 7700400],
      ]},
      { name: "JIHOZLAR / ОБОРУДОВАНИЕ", items: [
        [5, '', 'Jihoz 1 / Шкаф коммуникационный', 'шт', 10, 1570800, 15708000],
      ]},
    ];

    let rowIdx = 11;
    for (const sec of sections) {
      const secRow = ws.getRow(rowIdx);
      secRow.getCell(3).value = sec.name;
      for (let i = 1; i <= 7; i++) { secRow.getCell(i).font = sectionFont; secRow.getCell(i).fill = sectionFill; secRow.getCell(i).border = thinBorder; }
      rowIdx++;
      for (const vals of sec.items) {
        const r = ws.getRow(rowIdx);
        vals.forEach((v, i) => {
          const cell = r.getCell(i + 1);
          cell.value = v; cell.font = dataFont; cell.border = thinBorder;
          if (i === 0) cell.alignment = { horizontal: 'center' };
          if (i >= 4 && v) cell.numFmt = numFmt;
        });
        rowIdx++;
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(buf, 'shablon_resurs.xlsx');

  } else if (type === 'svod') {
    const ws = wb.addWorksheet('старт');
    ws.columns = [
      { width: 6 }, { width: 42 }, { width: 22 }, { width: 20 }, { width: 20 }, { width: 20 },
    ];

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = "HISOB-KITOB QIYMATI / РАСЧЕТНАЯ СТОИМОСТЬ ОБЪЕКТА";
    ws.getCell('A1').font = titleFont;
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = "Loyiha nomi / Строительство объекта";
    ws.getCell('A2').font = { ...dataFont, italic: true };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    // Header row 3
    const hdrRow = ws.getRow(3);
    ['№', 'Xarajat turi / Наименование затрат', 'Jami / Всего', 'Blok №1', 'Blok №2', 'Blok №3'].forEach((v, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = v; cell.font = headerFont; cell.fill = headerFill; cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    const rows = [
      [1, 'Jihozlar, mebel / Затраты на оборудование', 5000000, 2000000, 2000000, 1000000, false],
      [2, 'Ishchilar maoshi / Основная з/плата рабочих', 18000000, 6000000, 6000000, 6000000, false],
      [3, 'Mashina va mexanizmlar / Эксплуатация машин', 3900000, 1300000, 1300000, 1300000, false],
      [4, 'Qurilish materiallari / Строительные материалы', 51000000, 17000000, 17000000, 17000000, false],
      [5, "Jami to'g'ri xarajatlar / Итого прямых затрат", 77900000, 26300000, 26300000, 25300000, true],
      [6, 'Pudratchi xarajatlari / Прочие затраты - 18,11%', 14107690, 4762930, 4762930, 4581830, false],
      [7, "Sug'urta / Затраты на страхование - 0,32%", 249280, 84160, 84160, 80960, false],
      [8, 'Jami / Итого', 92256970, 31147090, 31147090, 29962790, true],
    ];

    rows.forEach((vals, idx) => {
      const r = ws.getRow(4 + idx);
      const isTotal = vals[6];
      for (let i = 0; i < 6; i++) {
        const cell = r.getCell(i + 1);
        cell.value = vals[i];
        cell.font = isTotal ? { ...dataFont, bold: true } : dataFont;
        cell.border = thinBorder;
        if (isTotal) cell.fill = totalFill;
        if (i === 0) cell.alignment = { horizontal: 'center' };
        if (i >= 2) cell.numFmt = numFmt;
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(buf, 'shablon_svod.xlsx');
  }
}

function saveAs(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const typeDescriptions = {
  vor: {
    uz: "Ishlar ro'yxati: №, shifr, ish nomi, birlik, miqdor",
    ru: 'Ведомость объёмов работ: №, шифр, наименование, ед.изм., количество',
  },
  edinich: {
    uz: "Batafsil miqdor: asosiy ish + resurslar (ishchi kuchi, mashina, material)",
    ru: 'Единичные расценки: работа + ресурсы (труд, машины, материалы)',
  },
  resurs: {
    uz: "Resurslar narxi: ishchi kuchi, mashinalar, materiallar, jihozlar",
    ru: 'Ведомость ресурсов: труд, машины, материалы, оборудование с ценами',
  },
  svod: {
    uz: "Loyiha svodi: xarajat turlari × binolar jadval ko'rinishida",
    ru: 'Сводная таблица: виды затрат × здания',
  },
};

// =====================================================
// SMETA IMPORT MODAL
// =====================================================

export default function SmetaImportModal({ open, onClose, onImport, onImportSvod, buildings = [], project, subcontracts = [], scope }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [availableSheets, setAvailableSheets] = useState([]);
  // `selectedType` is the type currently focused in the preview (step 3).
  // `selectedTypes` is the full set the user has ticked for import.
  // Keeping them separate means every downstream render that references
  // `selectedType` (e.g. the preview table branch) keeps working while the
  // outer flow iterates over `selectedTypes` on import.
  const [selectedType, setSelectedType] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [parsedData, setParsedData] = useState(null);
  // Per-type parsed results so we can switch the preview between types
  // without re-parsing. Keys are 'vor' | 'edinich' | 'resurs' | 'svod'.
  const [parsedResults, setParsedResults] = useState({});
  // Per-type estimate names so the user can name each one. Keyed the
  // same way. Svod uses the project name and doesn't need this.
  const [estimateNames, setEstimateNames] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [estimateName, setEstimateName] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedSubcontractId, setSelectedSubcontractId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);

  const handleClose = useCallback(() => {
    setStep(1);
    setFile(null);
    setWorkbook(null);
    setAvailableSheets([]);
    setSelectedType(null);
    setSelectedTypes([]);
    setParsedData(null);
    setParsedResults({});
    setEstimateNames({});
    setExpandedSections({});
    setEstimateName('');
    setSelectedBuildingId('');
    setSelectedSubcontractId('');
    setIsProcessing(false);
    setErrors([]);
    setImportResult(null);
    onClose();
  }, [onClose]);

  // Step 1: File upload
  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);

    try {
      const data = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(data);

      const decodeQuotedPrintable = (s) =>
        s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

      const tryParseString = (text) => {
        if (!text || text.length < 10) return null;
        try {
          const w = XLSX.read(text, { type: 'string' });
          if (w && w.SheetNames && w.SheetNames.length > 0) return w;
        } catch { /* try next */ }
        return null;
      };

      let wb = null;

      // 1) Native binary (xlsx/xls/binary csv/etc.)
      try { wb = XLSX.read(data, { type: 'array' }); } catch { /* fall through */ }

      // 2) Text with multiple encodings (HTML, SpreadsheetML XML, CSV)
      if (!wb) {
        const candidates = [];
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) candidates.push(['utf-16le', 2]);
        else if (bytes[0] === 0xFE && bytes[1] === 0xFF) candidates.push(['utf-16be', 2]);
        else if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) candidates.push(['utf-8', 3]);
        else candidates.push(['utf-8', 0], ['utf-16le', 0], ['windows-1251', 0]);

        for (const [enc, offset] of candidates) {
          let text;
          try { text = new TextDecoder(enc, { fatal: false }).decode(bytes.slice(offset)); }
          catch { continue; }
          wb = tryParseString(text);
          if (wb) break;

          // MHTML — extract embedded HTML and decode quoted-printable if needed
          if (/MIME-Version\s*:|Content-Type\s*:\s*multipart/i.test(text.slice(0, 2000))) {
            const start = text.search(/<html[\s>]/i);
            const endIdx = text.toLowerCase().lastIndexOf('</html>');
            if (start >= 0 && endIdx > start) {
              let html = text.slice(start, endIdx + 7);
              if (/=\r?\n|=[0-9A-Fa-f]{2}/.test(html)) html = decodeQuotedPrintable(html);
              wb = tryParseString(html);
              if (wb) break;
            }
          }

          // Plain HTML where there IS a <table> — try parsing even if SheetJS picked another path
          if (/<table/i.test(text)) {
            wb = tryParseString(text);
            if (wb) break;
          }
        }
      }

      if (!wb) {
        const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 80))
          .replace(/[\x00-\x1F]/g, '·');
        setErrors([
          "Faylni o'qib bo'lmadi — bu Excel (.xlsx/.xls), HTML jadval yoki MHTML emas.",
          `Hajmi: ${(selectedFile.size / 1024).toFixed(1)} KB · boshlanishi: "${head.slice(0, 60)}"`,
          "Excel'da oching va File → Save As → Excel Workbook (.xlsx) qilib qayta saqlang.",
        ]);
        return;
      }
      setWorkbook(wb);

      const sheets = detectSheets(wb);
      setAvailableSheets(sheets);

      // Auto-select ВОР if available. Single-element selection matches the
      // old default; the user can tick additional checkboxes in step 2.
      const vorSheet = sheets.find((s) => s.type === 'vor' && s.enabled);
      if (vorSheet) {
        setSelectedType('vor');
        setSelectedTypes(['vor']);
      }

      if (sheets.length === 0) {
        setErrors(["Fayl tanilmagan formatda. ВОР, Единич yoki Ресурс varaqlari topilmadi."]);
      } else {
        setStep(2);
      }
    } catch (error) {
      const msg = String(error?.message || error);
      if (msg.includes('Invalid HTML') || msg.includes('could not find <table>')) {
        setErrors([
          "Fayl Excel emas (HTML ko'rinishida saqlangan, lekin jadval yo'q). Excel'da oching va File → Save As → Excel Workbook (.xlsx) qilib qayta saqlang.",
        ]);
      } else {
        setErrors(["Faylni o'qishda xatolik: " + msg]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Pure parser dispatcher — no side effects, so we can reuse it both for
  // the single-type path and the multi-type loop.
  const parseByType = (type) => {
    if (type === 'vor')      return parseVOR(workbook);
    if (type === 'edinich')  return parseEdinich(workbook);
    if (type === 'resurs')   return parseResurs(workbook);
    if (type === 'svod')     return parseSvod(workbook);
    return null;
  };

  const isParsedOk = (type, result) => {
    if (!result) return false;
    if (type === 'svod')  return Array.isArray(result.categories) && result.categories.length > 0;
    return Array.isArray(result.sections) && result.sections.length > 0;
  };

  // Step 2: Parse every selected type. Results are stashed in
  // `parsedResults` keyed by type so the preview can flip between them
  // without re-parsing. Per-type names are seeded here too.
  const handleParseSheet = () => {
    if (!workbook) return;
    // Honour the multi-select, but fall back to single selectedType so
    // legacy callers keep working.
    const types = (selectedTypes && selectedTypes.length > 0)
      ? selectedTypes
      : (selectedType ? [selectedType] : []);
    if (types.length === 0) return;

    setIsProcessing(true);
    setErrors([]);

    try {
      const results = {};
      const names = {};
      const failed = [];
      for (const type of types) {
        const result = parseByType(type);
        if (!isParsedOk(type, result)) {
          failed.push(type);
          continue;
        }
        results[type] = result;
        names[type] = type === 'svod'
          ? (result.projectName || '')
          : (result.objectName || '');
      }

      if (Object.keys(results).length === 0) {
        setErrors([
          "Ma'lumot topilmadi. Fayl formati to'g'ri ekanligini tekshiring."
          + (failed.length ? ` (${failed.join(', ')})` : ''),
        ]);
        setIsProcessing(false);
        return;
      }
      if (failed.length > 0) {
        // Non-fatal: we still proceed with the types that parsed, but
        // surface the problem so the user knows some sheets were skipped.
        setErrors([
          `Quyidagi turlar uchun ma'lumot topilmadi, o'tkazib yuborildi: ${failed.join(', ')}`,
        ]);
      }

      setParsedResults(results);
      setEstimateNames(names);

      // Pick the first successfully-parsed type as the initial preview
      // focus. Prefer the user's previously-selected type if it's still
      // valid so the UI doesn't jump unexpectedly.
      const firstType = results[selectedType] ? selectedType : Object.keys(results)[0];
      setSelectedType(firstType);
      setParsedData(results[firstType]);
      setEstimateName(names[firstType] || '');
      if (results[firstType]?.sections?.length > 0) {
        setExpandedSections({ 0: true });
      }
      setStep(3);
    } catch (error) {
      setErrors(["Ma'lumotlarni tahlil qilishda xatolik: " + error.message]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Switch the preview to a different parsed type without leaving step 3.
  // Saves the current type's editable estimate name first so it isn't
  // lost if the user comes back to it.
  const switchPreviewType = (type) => {
    if (!parsedResults[type]) return;
    setEstimateNames((prev) => ({ ...prev, [selectedType]: estimateName }));
    setSelectedType(type);
    setParsedData(parsedResults[type]);
    setEstimateName(estimateNames[type] || '');
    setExpandedSections(parsedResults[type]?.sections?.length > 0 ? { 0: true } : {});
  };

  // Build the per-type payload for `onImport` from a parsed result.
  // Extracted so the multi-type loop below can reuse the exact same
  // transformation that the single-type flow used to do inline.
  //
  // IMPORTANT: every item inherits its containing section's `name` as
  // its `parent_item_number` unless the parser already gave it a
  // hand-tagged value (e.g. единич's resource children that point at
  // their numeric parent line). Without this fallback every section
  // collapses into a single anonymous bucket on the backend, which is
  // why the v2 Bosqichlar tab showed only "Boshqalar" with all 277
  // works after import.
  const buildImportPayloadFor = (type, result, nameOverride) => {
    const allLines = [];
    let sortIdx = 0;
    let importedCount = 0;
    // TEMPLATE MODE applies only to Единич (and the resource catalog).
    // ВОР is the source of the planned project Miqdor — those values
    // need to be preserved verbatim because the Bosqichlar tab now
    // sources its REJA column from the ВОР row matched by name. If we
    // strip ВОР quantities to 0 too, REJA stays at 0 across the
    // workflow.
    const templateMode = String(type || '').toLowerCase() !== 'vor';
    const isEdinich = String(type || '').toLowerCase() === 'edinich';
    for (const section of result.sections || []) {
      if (!section.items || section.items.length === 0) continue;
      const sectionPath = section.name || '';
      // Display-only "imported" capture (migration 413). Two sources:
      //   • Ресурс sheet — item.quantity (Количество) + item.total_price
      //     (Сметная стоимость в базисном уровне) are the file's verbatim
      //     numbers and ARE the headline columns the user wants to see.
      //   • Единич sheet — item.norma_quantity (column F "по проектным
      //     данным") is the file's per-row project total. For parent
      //     works it's the work volume (e.g. 25.035 × 1000 М3); for child
      //     resources it's the resource consumption (e.g. 300.1696 ЧЕЛ-Ч).
      //     Without this, Единич sub-rows display "0" in the Smetalar
      //     list because templateMode zeroes the live `quantity` ledger.
      // ВОР keeps its quantity in the live ledger, so it doesn't need a
      // parallel display field — but inheriting `norma_quantity` if the
      // parser ever sets it costs nothing.
      const isResurs = String(type || '').toLowerCase() === 'resurs';
      for (const item of section.items) {
        sortIdx++;
        const unitPrice = item.unit_price || 0;
        const rt = item.resource_type || '';
        // Resurs: file Количество. Other sheets: norma_quantity (Единич's
        // colF). undefined ⇒ NULL in DB; the UI falls back to
        // original_quantity / live quantity for legacy rows.
        let importedQuantity;
        if (isResurs && item.quantity != null) {
          importedQuantity = Number(item.quantity) || 0;
        } else if (item.norma_quantity != null && Number(item.norma_quantity) !== 0) {
          // !== 0 instead of > 0 so NEGATIVE quantities survive the
          // round-trip. Subtraction positions ("ВЫЧИТАЕТСЯ ПОЗИЦИЯ")
          // legitimately store negative qtys; dropping them as
          // undefined would render them as 0 on the Smetalar tab.
          importedQuantity = Number(item.norma_quantity);
        } else {
          importedQuantity = undefined;
        }
        // Total cost is Resurs-only — Единич/ВОР have no per-row cost
        // total in their source sheets.
        const importedTotal = isResurs && item.total_price != null
          ? Number(item.total_price) || 0
          : undefined;
        allLines.push({
          name: item.name,
          uom: item.uom || 'шт',
          // Единич / Ресурс → 0 (the foreman's Bajarildi field drives
          // the cascade). ВОР → keep the file's Miqdor so the planned
          // project volume survives the round-trip.
          quantity: templateMode ? 0 : Number(item.quantity || 0),
          // Migration 400 — file values preserved verbatim for display
          // only. NEVER consumed by any cost / cascade / ledger code
          // path; rendered alongside the live columns in EstimatesTab so
          // the user can see what the source file said.
          imported_quantity: importedQuantity,
          imported_total: importedTotal,
          // Norma anchor (migration 349). Parents in template mode keep
          // the file's planned project quantity (colF) as the
          // original_quantity even though the live quantity is 0; the
          // Smeta boshqaruvi NORMA pill reads this. Children pass 0
          // (their norm-driven quantity is computed from parent on the
          // fly, no anchor needed). Non-template (ВОР) imports omit
          // it so the trigger defaults to the live quantity, matching
          // pre-existing behaviour.
          original_quantity: templateMode
            ? Number(item.norma_quantity || 0)
            : undefined,
          material_rate: rt === 'material' ? unitPrice : 0,
          labor_rate: rt === 'labor' ? unitPrice : 0,
          equipment_rate: rt === 'equipment' ? unitPrice : 0,
          code: item.code || '',
          item_number: item.item_number || '',
          resource_type: rt,
          // norm_rate (per parent unit) — the единич parser sets this in
          // `quantity_per_unit` for child resource rows. We carry it
          // through so the Bosqichlar tab can compute live consumption
          // as `parent.done_quantity × norm_rate` when the foreman types.
          norm_rate: item.quantity_per_unit || 0,
          // Material sub-bucket — defaults to 'standard' on the backend
          // when omitted; the РЕСУРС parser fills this in based on the
          // section header (КАБЕЛЬНАЯ ПРОДУКЦИЯ → 'cable', ОБОРУДОВАНИЕ
          // → 'equipment') so the new resource gets bucketed into the
          // right Stroyamaterial / Uskuna / Kabel chip on import.
          material_type: item.material_type || undefined,
          // Use the parser's explicit value first (resource sub-lines
          // point at their numeric parent), otherwise fall back to the
          // section path so the v2 hierarchy survives the round-trip.
          parent_item_number: item.parent_item_number || sectionPath,
          sort_order: sortIdx,
        });

        // Direct-material works (shifr "С" in the source file) have
        // no labor/machine breakdown — the work IS the material. The
        // file lists them as a single line and stops, which means
        // after import the work shows "0 resurs" and zero cost. To
        // drive the smeta math correctly we auto-attach a single
        // material child that mirrors the parent: same name + uom,
        // norm_rate = 1 so the cascade sets child.qty = parent.qty,
        // and the post-import resource-price propagation pipeline
        // (matches by name against the Ресурс catalog) fills in the
        // unit_rate on the backend. Only fires for Единич imports —
        // ВОР keeps standalone "С" rows as project-qty entries, and
        // the Ресурс sheet has no "С" rows of its own.
        const codeStr = String(item.code || '').trim().toUpperCase();
        if (
          isEdinich
          && codeStr === 'С'
          && item.item_number
          && !item.parent_item_number  // skip if it's already a child
        ) {
          sortIdx++;
          // norm_rate = 1 because the work IS the material (1:1 ratio).
          // The user enters the work qty as the total project amount
          // (e.g. 6.316 T of armatura), and the cascade gives
          // child.qty = work.qty × 1 = 6.316 T — which matches both
          // the source file's project qty and the ВОР's REJA.
          allLines.push({
            name: item.name,
            uom: item.uom || 'шт',
            quantity: 0,
            material_rate: 0,
            labor_rate: 0,
            equipment_rate: 0,
            code: '',
            item_number: '',
            resource_type: 'material',
            norm_rate: 1,
            material_type: item.material_type || undefined,
            parent_item_number: item.item_number,
            sort_order: sortIdx,
          });
        }
      }
      importedCount += section.items.length;
    }
    const sectionNames = (result.sections || [])
      .filter((s) => s.items?.length > 0 && s.name)
      .map((s) => s.name);
    return {
      lines: allLines,
      sectionNames,
      importedCount,
      sectionCount: result.sections?.length || 0,
      defaultName: nameOverride || result.objectName || result.sections?.[0]?.name || 'Imported',
      // Imported budget totals — populated only by parseResurs (the only
      // sheet that carries project-wide totals at the bottom). Other
      // parsers leave these as 0/undefined so the existing Reja-jami
      // computation stays in charge.
      budgetTotal: Number(result.budgetTotal || 0),
      materialBudget: Number(result.materialBudget || 0),
      transportBudget: Number(result.transportBudget || 0),
    };
  };

  // Step 3 → Step 4: Execute import. Iterates over every type the user
  // ticked in step 2 so a single file can seed multiple estimates in one
  // click. Svod is handled via the dedicated `onImportSvod` callback; all
  // other types go through `onImport` one-by-one.
  const handleImport = async () => {
    // Honour the multi-select, but fall back to the single focused type.
    const types = (selectedTypes && selectedTypes.length > 0)
      ? selectedTypes.filter((t) => parsedResults[t])
      : (selectedType && parsedResults[selectedType] ? [selectedType] : []);
    if (types.length === 0) {
      setErrors(["Import uchun tur tanlanmagan"]);
      return;
    }

    // Non-svod types need a building; if at least one non-svod type is
    // selected, building is required.
    const anyNonSvod = types.some((t) => t !== 'svod');
    if (anyNonSvod && !selectedBuildingId) {
      setErrors(["Binoni tanlang"]);
      return;
    }

    // Commit any in-flight name edit on the focused tab before we loop.
    const names = { ...estimateNames, [selectedType]: estimateName };

    setIsProcessing(true);
    setErrors([]);
    setStep(4);

    try {
      let totalLines = 0;
      let totalSections = 0;
      let estimatesCreated = 0;
      let svodImported = false;
      const buildingId = selectedBuildingId === 'project' ? 0 : parseInt(selectedBuildingId);
      const subcontractId = selectedSubcontractId ? parseInt(selectedSubcontractId) : undefined;

      for (const type of types) {
        const result = parsedResults[type];
        if (!result) continue;

        if (type === 'svod') {
          // Svod cross-tab → flat rows, like the old single-type branch.
          const rows = [];
          for (const cat of result.categories || []) {
            for (const buildingName of result.buildings || []) {
              rows.push({
                row_number: cat.row_number,
                category_name: cat.name,
                building_column: buildingName,
                amount: cat.amounts?.[buildingName] || 0,
              });
            }
          }
          if (onImportSvod) await onImportSvod(rows);
          svodImported = true;
          totalLines += result.categories?.length || 0;
          continue;
        }

        const payload = buildImportPayloadFor(type, result, names[type]);
        if (payload.lines.length === 0) continue;
        await onImport({
          estimateName: payload.defaultName,
          buildingId,
          sourceType: type,
          // Forwarding the uploaded file name lets the backend's Forma 2
          // auto-create dedupe by it — every estimate type extracted from
          // this same file merges into the same Forma 2 draft.
          sourceFileName: file?.name || '',
          lines: payload.lines,
          sectionNames: payload.sectionNames,
          subcontractId,
          // Imported budget — Ресурс sheet only. The handler forwards
          // these to the backend so the Reja vs Fakt page can show the
          // file's grand total instead of a derived sum.
          budgetTotal: payload.budgetTotal,
          materialBudget: payload.materialBudget,
          transportBudget: payload.transportBudget,
        });
        totalLines += payload.importedCount;
        totalSections += payload.sectionCount;
        estimatesCreated += 1;
      }

      setImportResult({
        success: true,
        count: totalLines,
        sections: totalSections,
        estimatesCreated,
        isSvod: svodImported && estimatesCreated === 0, // keep old message shape when svod-only
        typeCount: types.length,
      });
    } catch (error) {
      setErrors(["Import xatolik: " + error.message]);
      setImportResult({ success: false });
    } finally {
      setIsProcessing(false);
    }
  };

  const totalItems = parsedData
    ? (selectedType === 'svod'
      ? (parsedData.categories?.length || 0)
      : parsedData.sections?.reduce((sum, s) => sum + s.items.length, 0) || 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Smeta import
            {step > 1 && (
              <Badge variant="outline" className="ml-2">
                {step}/4
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-slate-500 pb-2 border-b">
          <span className={step >= 1 ? 'text-blue-600 font-medium' : ''}>{t('import_step_upload') || '1. Fayl yuklash'}</span>
          <ArrowRight className="w-3 h-3" />
          <span className={step >= 2 ? 'text-blue-600 font-medium' : ''}>{t('import_step_select_type') || '2. Tur tanlash'}</span>
          <ArrowRight className="w-3 h-3" />
          <span className={step >= 3 ? 'text-blue-600 font-medium' : ''}>{t('import_step_preview') || "3. Ko'rish"}</span>
          <ArrowRight className="w-3 h-3" />
          <span className={step >= 4 ? 'text-blue-600 font-medium' : ''}>{t('import_step_import') || '4. Import'}</span>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: File Upload */}
        {step === 1 && (
          <div className="flex-1 space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-sm text-slate-600">Fayl o'qilmoqda...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-10 h-10 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Excel faylni bu yerga tashlang yoki bosing
                    </p>
                    <p className="text-xs text-slate-500 mt-1">.xlsx formatdagi smeta fayli</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
              />
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-600 mb-2">
                {language === 'uz' ? 'Namuna shablonlarni yuklab oling:' : 'Скачать шаблоны:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {['vor', 'edinich', 'resurs', 'svod'].map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => { e.stopPropagation(); downloadTemplate(type); }}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {language === 'uz'
                      ? { vor: "Ishlar ro'yxati", edinich: 'Batafsil miqdor', resurs: 'Resurslar', svod: 'Svod' }[type]
                      : { vor: 'ВОР', edinich: 'Единич', resurs: 'Ресурс', svod: 'Свод' }[type]
                    }
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Sheet/Type Selection */}
        {step === 2 && (
          <div className="flex-1 space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium">{file?.name}</span> — {availableSheets.length} varaq topildi
            </p>

            <div className="space-y-2">
              {/* Multi-select: user can tick any combination of detected
                  types. Each ticked type will end up as its own estimate
                  after import (svod stays a summary import as before). */}
              <Label>Import turlari (bir nechtasini tanlashingiz mumkin):</Label>
              {availableSheets.map((sheet) => {
                const isChecked = selectedTypes.includes(sheet.type);
                const isFocused = selectedType === sheet.type;
                const toggle = () => {
                  if (!sheet.enabled) return;
                  setSelectedTypes((prev) => {
                    const next = prev.includes(sheet.type)
                      ? prev.filter((t) => t !== sheet.type)
                      : [...prev, sheet.type];
                    // Keep `selectedType` consistent with the set so the
                    // preview focus is always on a currently-checked type.
                    if (next.length === 0) setSelectedType(null);
                    else if (!next.includes(selectedType)) setSelectedType(next[next.length - 1]);
                    else if (!selectedType) setSelectedType(next[0]);
                    return next;
                  });
                };
                return (
                  <div
                    key={sheet.type}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      !sheet.enabled
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : isChecked
                        ? (isFocused ? 'border-blue-500 bg-blue-50' : 'border-blue-300 bg-blue-50/40')
                        : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                    onClick={toggle}
                  >
                    {/* Square checkbox (multi-select), not a radio. */}
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isChecked ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div>
                        <span className="font-medium text-sm">
                          {language === 'uz'
                            ? { vor: "Ishlar ro'yxati (ВОР)", edinich: 'Batafsil miqdor (Единич)', resurs: 'Resurslar (Ресурс)', svod: 'Svod' }[sheet.type] || sheet.label
                            : sheet.label
                          }
                        </span>
                        <span className="text-xs text-slate-500 ml-2">({sheet.name})</span>
                      </div>
                      {typeDescriptions[sheet.type] && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {language === 'uz' ? typeDescriptions[sheet.type].uz : typeDescriptions[sheet.type].ru}
                        </p>
                      )}
                    </div>
                    {sheet.enabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-slate-500 hover:text-slate-700"
                        onClick={(e) => { e.stopPropagation(); downloadTemplate(sheet.type); }}
                        title={language === 'uz' ? 'Namuna yuklab olish' : 'Скачать шаблон'}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {!sheet.enabled && (
                      <Badge variant="secondary" className="text-xs">
                        Tez kunda
                      </Badge>
                    )}
                  </div>
                );
              })}
              {selectedTypes.length > 1 && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 mt-2">
                  {language === 'uz'
                    ? `${selectedTypes.length} tur tanlangan — keyingi qadamda har biri uchun alohida smeta yaratiladi.`
                    : `Выбрано ${selectedTypes.length} типа — на следующем шаге создастся отдельная смета для каждого.`}
                </p>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> {t('import_back') || 'Orqaga'}
              </Button>
              <Button onClick={handleParseSheet} disabled={selectedTypes.length === 0 || isProcessing}>
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-1" />
                )}
                Davom etish
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview + Configure */}
        {step === 3 && parsedData && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Type switcher — lets the user jump between previews of the
                types they ticked in step 2 without leaving step 3. Hidden
                when only one type is selected so the UI isn't noisy for
                the single-type case. */}
            {Object.keys(parsedResults).length > 1 && (
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-lg border">
                {Object.keys(parsedResults).map((type) => {
                  const r = parsedResults[type];
                  const active = selectedType === type;
                  const count = type === 'svod'
                    ? (r.categories?.length || 0)
                    : (r.sections?.reduce((s, sec) => s + (sec.items?.length || 0), 0) || 0);
                  const label = language === 'uz'
                    ? { vor: 'ВОР', edinich: 'Единич', resurs: 'Ресурс', svod: 'Свод' }[type] || type
                    : { vor: 'ВОР', edinich: 'Единич', resurs: 'Ресурс', svod: 'Свод' }[type] || type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => switchPreviewType(type)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        active
                          ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      {label}
                      <span className="ml-1.5 text-slate-400">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                <span className="font-medium">{totalItems}</span> {t('rows_count_suffix') || 'qator'}
                {selectedType !== 'svod' && (
                  <>, <span className="font-medium">{parsedData.sections?.length || 0}</span> {t('sections_count_suffix') || "bo'lim"}</>
                )}
                {selectedType === 'svod' && parsedData.buildings && (
                  <>, <span className="font-medium">{parsedData.buildings.length}</span> bino</>
                )}
              </div>
            </div>

            {/* Estimate name input (for single section, non-svod) */}
            {selectedType !== 'svod' && parsedData.sections?.length === 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm shrink-0">Smeta nomi:</Label>
                <Input
                  value={estimateName}
                  onChange={(e) => setEstimateName(e.target.value)}
                  placeholder="Smeta nomi"
                  className="max-w-xs"
                />
              </div>
            )}

            {/* Building selector (not needed for svod) */}
            {selectedType !== 'svod' && (
              <div className="flex items-center gap-2">
                <Label className="text-sm shrink-0">{t('building') || 'Bino'}:</Label>
                <select
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm max-w-xs"
                >
                  <option value="">{t('select_building_placeholder') || 'Binoni tanlang...'}</option>
                  <option value="project">Butun loyiha</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Subcontract selector (when in subcontract scope) */}
            {subcontracts.length > 0 && selectedType !== 'svod' && (
              <div className="flex items-center gap-2">
                <Label className="text-sm shrink-0">Subpudratchi:</Label>
                <select
                  value={selectedSubcontractId}
                  onChange={(e) => setSelectedSubcontractId(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm max-w-xs"
                >
                  <option value="">Subpudratchi tanlang...</option>
                  {subcontracts.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.partner_name || sc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview table */}
            <ScrollArea className="flex-1 border rounded-lg min-h-0" style={{ maxHeight: '400px' }}>
              <div className="p-2">
                {/* Svod preview: cross-tab */}
                {selectedType === 'svod' && parsedData.categories && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">№</TableHead>
                          <TableHead className="min-w-[200px]">Xarajat turi</TableHead>
                          <TableHead className="w-32 text-right">Jami</TableHead>
                          {parsedData.buildings.map((b) => (
                            <TableHead key={b} className="w-28 text-right text-xs">{b}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.categories.map((cat, idx) => {
                          const isTotal = cat.name.toUpperCase().includes('ИТОГО') || cat.name.toUpperCase().includes('ВСЕГО');
                          return (
                            <TableRow key={idx} className={isTotal ? 'bg-slate-50 font-medium' : ''}>
                              <TableCell className="text-xs text-slate-500">{cat.row_number}</TableCell>
                              <TableCell className="text-xs">{cat.name}</TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                {cat.total ? cat.total.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—'}
                              </TableCell>
                              {parsedData.buildings.map((b) => (
                                <TableCell key={b} className="text-xs text-right">
                                  {cat.amounts[b] ? cat.amounts[b].toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—'}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Non-svod preview: sections with items */}
                {selectedType !== 'svod' && parsedData.sections?.map((section, sIdx) => (
                  <div key={sIdx} className="mb-3">
                    {/* Section header */}
                    <div
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100"
                      onClick={() =>
                        setExpandedSections((prev) => ({ ...prev, [sIdx]: !prev[sIdx] }))
                      }
                    >
                      {expandedSections[sIdx] ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="font-medium text-sm">{section.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {section.items.length} {t('rows_count_suffix') || 'qator'}
                      </Badge>
                    </div>

                    {/* Section items */}
                    {expandedSections[sIdx] && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">№</TableHead>
                            <TableHead className="w-28">Kod</TableHead>
                            <TableHead>Nomi</TableHead>
                            <TableHead className="w-20">Birlik</TableHead>
                            <TableHead className="w-20 text-right">Miqdor</TableHead>
                            {selectedType === 'resurs' && (
                              <>
                                <TableHead className="w-24 text-right">Narxi</TableHead>
                                <TableHead className="w-28 text-right">Jami</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.items.map((item, idx) => (
                            <TableRow key={idx} className={item.resource_type ? 'bg-slate-50/50' : ''}>
                              <TableCell className="text-xs text-slate-500">
                                {item.resource_type ? (
                                  <span className="pl-3">{item.item_number}</span>
                                ) : (
                                  <span className="font-medium">{item.item_number}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{item.code}</TableCell>
                              <TableCell className="text-xs max-w-md truncate" title={item.name}>
                                {item.resource_type && (
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                                    item.resource_type === 'labor' ? 'bg-blue-400' :
                                    item.resource_type === 'equipment' ? 'bg-amber-400' : 'bg-green-400'
                                  }`} />
                                )}
                                {item.name}
                              </TableCell>
                              <TableCell className="text-xs">{item.uom}</TableCell>
                              <TableCell className="text-xs text-right">
                                {item.quantity ? item.quantity.toLocaleString('ru-RU') : '—'}
                              </TableCell>
                              {selectedType === 'resurs' && (
                                <>
                                  <TableCell className="text-xs text-right">
                                    {item.unit_price ? item.unit_price.toLocaleString('ru-RU') : '—'}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-medium">
                                    {item.total_price ? item.total_price.toLocaleString('ru-RU') : '—'}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> {t('import_back') || 'Orqaga'}
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  // Building is required only if at least one non-svod
                  // type is in the selection set.
                  (selectedTypes.some((t) => t !== 'svod') && !selectedBuildingId) ||
                  isProcessing
                }
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-1" />
                )}
                {(() => {
                  // Aggregate line count across every parsed type so the
                  // button reflects the full import scope, not just the
                  // currently-focused preview.
                  const total = Object.entries(parsedResults).reduce((acc, [type, r]) => {
                    if (!r) return acc;
                    if (type === 'svod') return acc + (r.categories?.length || 0);
                    return acc + (r.sections?.reduce((s, sec) => s + (sec.items?.length || 0), 0) || 0);
                  }, 0);
                  const typeCount = Object.keys(parsedResults).length;
                  const importLabel = t('import_button_label') || 'Import';
                  const rowsSuffix = t('rows_count_suffix') || 'qator';
                  return typeCount > 1
                    ? `${importLabel} (${typeCount} ${t('types_count_suffix') || 'tur'}, ${total} ${rowsSuffix})`
                    : `${importLabel} (${total} ${rowsSuffix})`;
                })()}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Import Progress/Result */}
        {step === 4 && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            {isProcessing ? (
              <div className="text-center space-y-3">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                <p className="text-sm text-slate-600">{t('import_in_progress') || "Import jarayoni..."}</p>
              </div>
            ) : importResult?.success ? (
              <div className="text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <p className="text-lg font-medium text-slate-800">{t('import_success') || "Import muvaffaqiyatli!"}</p>
                <p className="text-sm text-slate-600">
                  {importResult.isSvod ? (
                    `${importResult.count} ${t('categories_imported') || "kategoriya import qilindi"}`
                  ) : (importResult.estimatesCreated || 0) > 1 ? (
                    // Multi-type path: mention both the estimate count and
                    // the total line count so the user can see what landed.
                    language === 'uz'
                      ? `${importResult.estimatesCreated} ta smeta, ${importResult.count} qator import qilindi`
                      : `Импортировано ${importResult.estimatesCreated} смет, ${importResult.count} строк`
                  ) : (
                    `${importResult.count} ${t('lines_imported') || "qator import qilindi"}`
                  )}
                </p>
                <Button onClick={handleClose} className="mt-4">
                  {t('close') || "Yopish"}
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-lg font-medium text-slate-800">{t('import_error') || "Import xatolik"}</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    {t('back') || "Orqaga"}
                  </Button>
                  <Button onClick={handleImport}>{t('retry') || "Qayta urinish"}</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
