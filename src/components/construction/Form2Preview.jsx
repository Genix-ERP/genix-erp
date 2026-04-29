import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, FileDown, X, Save, Calendar } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCompany } from '@/components/contexts/CompanyContext';
import ExcelJS from 'exceljs';

// Form2Preview — print-ready ФОРМА № 2 (KS-2 / ВОР) document.
//
// Updated to v23 mockup (Form2_Works_v23_prochie_breakdown.html). Math now
// matches the current Госкомархитектстрой Письмо № 352/11-05 (31.01.2011)
// and ШНК 4.01.16-09 interpretation:
//
//   1. Direct costs       = Σ labor + Σ machines + Σ materials_by_type (3)
//   2. Combined overhead  = Σ matByType × combined_rate per material type
//                           (standard 7%, equipment 3.2%, cable 3.5%) —
//                           replaces the old split transport+storage
//                           breakdown for the summary roll-up.
//   3. Прочие base        = (direct − equipment) + (combined − combined.equipment)
//                           — i.e. everything that belongs to "stroyka"
//                           (construction), excluding the equipment slice
//                           altogether.
//   4. Прочие             = base × otherCostsPct% (user input)
//   5. Construction total = base + прочие
//   6. Equipment total    = matByType.equipment + combined.equipment
//                           (calculated as a SEPARATE line; never gets the
//                            прочие multiplier applied to it)
//   7. Subtotal           = construction total + equipment total
//   8. VAT (12%)          = subtotal × 12%, only when the user has the
//                           "include VAT" toggle on. Otherwise 0.
//   9. Grand total        = subtotal + VAT
//
// The split transport / storage rates are still kept on the constant for
// reference and possible future per-line breakdowns, but the summary
// computation only uses `combined`.
//
// Inputs:
//   estimate          — { id, name, version, source_type, ... } header
//   lines             — array of construction_estimate_line rows
//   project           — { name, building_name, … } for the document header
// Lines with parent_line_id are "resources" (sub-lines); lines without are
// "works" (top-level rows). Sections are derived from `parent_item_number`
// on the top-level work row.
//
// Renders inline (caller wraps it in a Dialog/Sheet for the modal preview).
// Print: window.print() with `@media print` rules already in the document
// stylesheet. CSV export: Blob download with UTF-8 BOM for Excel.

const OVERHEAD_RATES = {
  // % per Госкомархитектстрой letter №352/12-05 of 2011 (points 2 + 3).
  //
  // Point 2 — Транспортные расходы (cap percentages of wholesale-shipping
  // prices from the Госархитектстрой catalog):
  //   • кабельно-проводниковая продукция .................. up to 1.5%
  //   • импортные материалы ............................... up to 2%
  //   • остальные строительные материалы, изделия и
  //     конструкции (== "standard" + "metal" buckets) ..... up to 5%
  //   • оборудование ...................................... up to 2%
  //
  // Point 3 — Заготовительно-складские расходы (% from same wholesale prices):
  //   • строительные материалы, изделия и конструкции ..... up to 2%
  //   • металлоконструкции ................................ up to 0.75%
  //   • оборудование ...................................... up to 1.2%
  //
  // `combined` = transport + storage and is what the v23 mockup's summary
  // roll-up uses; `transport`/`storage` remain for the per-bucket
  // ("5% + 2%") breakdown shown next to each line in the document body.
  // Metal-constructions and imported-material buckets were dropped at user
  // request — the document only carries the three regulated buckets that
  // every project actually uses. Lines arriving with material_type='metal'
  // or 'import' are folded into the standard bucket by getMaterialType().
  transport: { standard: 5.0, equipment: 2.0, cable: 1.5 },
  storage:   { standard: 2.0, equipment: 1.2, cable: 2.0 },
  combined:  { standard: 7.0, equipment: 3.2, cable: 3.5 },
};
const VAT_PCT = 12;

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

// Light-mode label colours for resource categories — match the mockup's
// f2 doc palette (not the dark sidebar palette).
const CAT_COLORS = {
  labor:     { hex: '#B8860B', name: 'Mehnat' },
  equipment: { hex: '#6B4CC7', name: 'Mashina' },
  material:  { hex: '#2E8B7F', name: 'Material' },
};

const MAT_TYPE_SHORT = {
  standard: 'oddiy',
  equipment: 'uskuna',
  cable: 'kabel',
};

function classifyResource(line) {
  const rt = String(line?.resource_type || '').toLowerCase();
  if (['labor', 'ish', 'ishchi', 'worker'].includes(rt)) return 'labor';
  if (['equipment', 'machine', 'mashina', 'masina'].includes(rt)) return 'equipment';
  if (['material', 'mat', 'materialy'].includes(rt)) return 'material';
  return 'material'; // unknown = treat as material so it flows into matByType
}

// Sub-stage detection — a sub-line with no resource_type and no norm_rate is
// a "Yangi etap" sub-stage (ДОП.) rather than a resource breakdown row.
// Same heuristic the Smeta UI uses to render the ДОП. green nested card.
function isSubStage(sub) {
  const rt = String(sub?.resource_type || '').trim().toLowerCase();
  const norm = Number(sub?.norm_rate || 0);
  return rt === '' && norm === 0;
}

function fmtRu(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(n)).replace(/\u00A0/g, ' ');
}

function getMaterialType(line) {
  const mt = String(line?.material_type || 'standard').toLowerCase();
  // metal/import buckets were retired — fold those rows into the standard
  // bucket so their costs still appear in the document, just without their
  // own итого line and накрутка row.
  if (['equipment', 'cable'].includes(mt)) return mt;
  return 'standard';
}

function getOverheadRate(line) {
  if (classifyResource(line) !== 'material') return 0;
  const t = getMaterialType(line);
  // v23 uses the combined transport+storage rate per material type
  // (standard 7%, equipment 3.2%, cable 3.5%).
  return OVERHEAD_RATES.combined[t] / 100;
}

// Sum brutto (base + transport+storage overhead) for a single work or
// sub-stage given its sub-line resources.
//
// Sub-stage rows (ДОП.) are themselves standalone works — their
// total_amount already includes everything they carry. We add their total
// straight to the base without applying overhead a second time.
function calcWorkBrutto(work, subLines) {
  let base = 0, overhead = 0;
  for (const r of subLines) {
    if (isSubStage(r)) {
      base += Number(r.total_amount || 0);
      continue;
    }
    // Resource top-ups (migration 358) REPLACE the planned qty × unit_rate
    // when their total quantity covers the planned qty (Σ tp.qty ≥
    // r.quantity). Otherwise they're a partial side-record and the
    // planned cost still drives the row — adding the partial sum on
    // top would inflate the work, replacing it would understate it.
    // Overhead (transport+storage накрутка) tracks the effective base.
    const tps = Array.isArray(r.topups) ? r.topups : [];
    const rQty = Number(r.quantity || 0);
    let effective;
    if (tps.length > 0) {
      const tpQty = tps.reduce((m, tp) => m + (Number(tp.extra_quantity) || 0), 0);
      if (tpQty >= rQty) {
        effective = tps.reduce(
          (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
          0,
        );
      } else {
        effective = Number(r.unit_rate || 0) * rQty;
      }
    } else {
      effective = Number(r.unit_rate || 0) * rQty;
    }
    if (effective > 0) {
      base += effective;
      overhead += effective * getOverheadRate(r);
    }
  }
  // If a work has NO sub-lines, its own total_amount IS the base.
  if (subLines.length === 0 && work) {
    base = Number(work.total_amount || 0);
  }
  return { base, overhead, total: base + overhead };
}

function buildSummary(lines, otherCostsPct, useVat) {
  let labor = 0, machines = 0;
  const matByType = { standard: 0, equipment: 0, cable: 0 };

  for (const ln of lines) {
    const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
    // Aggregate ONLY sub-line resources (the leaf rows that carry real
    // resource costs). Top-level work rows in the resource model are
    // headers — their total_amount is the sum of their sub-lines.
    if (!isSub) continue;
    // Sub-stages aren't resources; their total_amount is rolled up via
    // their own sub-lines (recursively handled by the grouping below) or
    // already included in the parent's `total_amount`. Skip here so they
    // don't double-count.
    if (isSubStage(ln)) continue;
    // Top-ups (migration 358), when present AND covering the planned
    // qty, REPLACE the planned cost. Partial top-ups
    // (Σ tp.qty < line.qty) leave the planned cost in place — they're
    // just side-records of part of the purchase. Bucket goes by the
    // parent resource's classification (cable top-ups stay cable, etc).
    const tps = Array.isArray(ln.topups) ? ln.topups : [];
    const lnQty = Number(ln.quantity || 0);
    let cost;
    if (tps.length > 0) {
      const tpQty = tps.reduce((m, tp) => m + (Number(tp.extra_quantity) || 0), 0);
      if (tpQty >= lnQty) {
        cost = tps.reduce(
          (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
          0,
        );
      } else {
        cost = Number(ln.unit_rate || 0) * lnQty;
      }
    } else {
      cost = Number(ln.unit_rate || 0) * lnQty;
    }
    if (cost <= 0) continue;
    const cat = classifyResource(ln);
    if (cat === 'labor') labor += cost;
    else if (cat === 'equipment') machines += cost;
    else matByType[getMaterialType(ln)] += cost;
  }

  const matTotal = Object.values(matByType).reduce((a, b) => a + b, 0);
  const direct = labor + machines + matTotal;

  // Combined transport+storage overhead per material type. Only the three
  // regulated buckets the project actually uses — стройматериалы 7%,
  // оборудование 3.2%, кабель 3.5%. Metal-constructions and imported
  // materials buckets were retired at user request.
  const combined = {
    standard:  matByType.standard  * OVERHEAD_RATES.combined.standard  / 100,
    equipment: matByType.equipment * OVERHEAD_RATES.combined.equipment / 100,
    cable:     matByType.cable     * OVERHEAD_RATES.combined.cable     / 100,
  };
  combined.total = combined.standard + combined.equipment + combined.cable;

  // "Stroyka" base for прочие = everything that isn't equipment.
  // Equipment (the construction-machinery material bucket, e.g. lifts,
  // pumps installed in the building) is calculated as a separate line and
  // never receives the прочие multiplier per the v23 mockup.
  const constructionDirect   = direct          - matByType.equipment;
  const constructionCombined = combined.total  - combined.equipment;
  const baseForOther         = constructionDirect + constructionCombined;
  const other                = baseForOther * (Number(otherCostsPct) || 0) / 100;
  const constructionTotal    = baseForOther + other;

  // Equipment as its own line: material cost + its own overhead.
  const equipmentTotal = matByType.equipment + combined.equipment;

  const subtotal = constructionTotal + equipmentTotal;
  const vat      = useVat ? subtotal * VAT_PCT / 100 : 0;
  const grand    = subtotal + vat;

  return {
    labor, machines, matByType, matTotal, direct,
    combined, other, otherBase: baseForOther,
    constructionTotal, equipmentTotal,
    subtotal, vat, grand, useVat: !!useVat,
  };
}

function buildSections(lines) {
  const subByParent = new Map();
  for (const ln of lines) {
    const pid = ln.parent_line_id;
    if (pid != null && Number(pid) > 0) {
      const arr = subByParent.get(pid) || [];
      arr.push(ln);
      subByParent.set(pid, arr);
    }
  }
  const bySection = new Map();
  for (const ln of lines) {
    const isSub = ln.parent_line_id != null && Number(ln.parent_line_id) > 0;
    if (isSub) continue;
    const qty = Number(ln.quantity || 0);
    if (qty <= 0) continue;
    const subs = subByParent.get(ln.id) || [];
    const wb = calcWorkBrutto(ln, subs);
    if (wb.total <= 0) continue;
    const key = ln.parent_item_number || 'Boshqalar';
    // Section accumulators carry both the pre-overhead `base` (used in
    // the per-row Сумма column of this section table — which the
    // regulation expects to be tax-free; transport+storage накрутки
    // appear separately in the СВОДНЫЕ ИТОГИ block below) and the
    // brutto `total` (kept for legacy callers like the CSV exporter
    // that historically summed the with-overhead figure).
    const cur = bySection.get(key) || { name: key, items: [], total: 0, base: 0 };
    cur.items.push({ work: ln, qty, subs, brutto: wb });
    cur.total += wb.total;
    cur.base  += wb.base;
    bySection.set(key, cur);
  }
  return Array.from(bySection.values());
}

export default function Form2Preview({ estimate, lines, project, onClose, onSaveSnapshot, snapshot }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  // Active company → Заказчик. CompanyContext exposes the user's currently
  // selected organization; we surface its name on the Form 2 header so the
  // printed AKT carries the right contractor.
  const { activeCompany } = useCompany();
  const customerName = activeCompany?.company_name
    || activeCompany?.name
    || project?.tenant_name
    || project?.organization_name
    || '';
  // ── Snapshot-aware initial state ────────────────────────────────
  // When the parent re-opens a saved snapshot it passes the row through
  // as `snapshot`. We seed the period / VAT / other-costs-pct state
  // from those saved fields so the document re-renders exactly as it
  // was saved — without this, opening a snapshot from "Formalar tarixi"
  // produced an empty "Hisobot davri: —" because the inputs were
  // freshly initialised to '' / 12% / true regardless of the saved
  // payload (user-reported bug, two screenshots: history row had
  // 01.01.2026 — 01.07.2026 but the printed Form 2 was empty).
  // Date strings are stored as ISO yyyy-mm-dd (matches the <input
  // type="date"> value format); strip a possible trailing time
  // component the API serialises for postgres DATEs.
  const isoDate = (s) => {
    if (!s) return '';
    const str = String(s);
    const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  };
  const [otherCostsPct, setOtherCostsPct] = useState(
    snapshot?.other_costs_pct != null ? Number(snapshot.other_costs_pct) : 0,
  );
  // VAT is a boolean toggle (matches v23 mockup) — when on, the fixed
  // 12% rate is added to the subtotal; when off, the grand total stops
  // at the subtotal. The percentage itself isn't user-editable any more.
  const [useVat, setUseVat] = useState(
    snapshot?.use_vat != null ? Boolean(snapshot.use_vat) : true,
  );
  // Reporting period (давр) — user-editable date range that prints in
  // the document header and travels with the saved snapshot. Both
  // fields are optional so the doc can still be generated without a
  // fixed window.
  const [periodFrom, setPeriodFrom] = useState(isoDate(snapshot?.period_from));
  const [periodTo, setPeriodTo] = useState(isoDate(snapshot?.period_to));
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Akt № modal state. The browser's window.prompt() is jarring on a
  // custom-styled page (it pops the OS-default dialog mid-document), so
  // the Saqlash button now opens an in-app modal with the same purpose.
  const [aktModalOpen, setAktModalOpen] = useState(false);
  const [aktNumber, setAktNumber] = useState('');

  // Print plumbing — clone the form into an isolated popup window so
  // Chrome paginates a clean linear document. Printing inside the
  // Radix Dialog tree was producing duplicated headers and broken
  // pagination because the dialog's overlay + `position: fixed` +
  // `overflow: hidden` + `h-[95vh]` cage forced Chrome to repeatedly
  // restart the layout per page. The popup approach has no overlay,
  // no scroll container, no parent height ceiling — just the document.
  const docRef = useRef(null);
  const handlePrint = () => {
    const node = docRef.current;
    if (!node) { window.print(); return; }

    // Snapshot the form HTML.
    const html = node.outerHTML;

    // Pull every stylesheet on the live page into the popup. We try
    // direct rule cloning first (works for same-origin sheets) and
    // fall back to a `<link>` import for CORS-restricted ones (Vite's
    // dev-mode hot-reload sheets, third-party fonts, etc.).
    const styleParts = [];
    const linkParts = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
          if (rules) styleParts.push(rules);
        }
      } catch (e) {
        // SecurityError — CORS-blocked. Reference by URL instead.
        if (sheet.href) linkParts.push(`<link rel="stylesheet" href="${sheet.href}">`);
      }
    }

    // Open the popup. Browsers may block this if the click handler
    // isn't on the synchronous call stack — but we're firing it
    // straight from a button onClick so the user gesture is preserved.
    // We do NOT pass `noopener` because we need to write into the
    // popup's document.
    const w = window.open('', '_blank', 'width=1100,height=900');
    if (!w) {
      // Popup blocked — fall back to in-page print so something works.
      window.print();
      return;
    }

    w.document.open();
    w.document.write(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Форма 2 — Акт выполненных работ</title>
${linkParts.join('\n')}
<style>${styleParts.join('\n')}</style>
<style>
  /* Reset the popup body so the form renders without page chrome
     or modal positioning artefacts from the parent app. */
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { padding: 16px; }
  .form2-doc {
    max-width: none !important;
    margin: 0 auto !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  /* Repeat table column headers on each printed page. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  table { break-inside: auto; }
  /* Hide any leftover modal-style buttons that snuck in via outerHTML. */
  .print\\:hidden, [class*="print:hidden"] { display: none !important; }
  /* Override the parent app's @media print rules that got cloned in
     via document.styleSheets — those rules hide everything except
     elements with the .form2-printing class, which only exists in
     the parent DOM. In this popup we WANT everything visible. */
  @media print {
    body, body * {
      visibility: visible !important;
    }
    body { padding: 0 !important; }
    /* Re-assert form positioning since the parent app's print rules
       force .form2-printing { position: absolute; inset: 0 ... } and
       that rule may have leaked through cloned sheets. */
    .form2-doc {
      position: static !important;
      inset: auto !important;
      width: auto !important;
      padding: 0 !important;
    }
  }
</style>
</head>
<body>${html}</body>
</html>`);
    w.document.close();

    // Wait for the popup's stylesheets to apply, then trigger print.
    // `onload` is the right hook, but if the stylesheets are inlined
    // it can fire before they parse — a small timeout covers both
    // cases reliably.
    const fire = () => {
      try {
        w.focus();
        w.print();
      } finally {
        // Close after print returns. Some browsers fire `afterprint`
        // synchronously; others don't fire it at all. Either way the
        // popup is dismissable by the user too.
        setTimeout(() => { try { w.close(); } catch (_) { /* ignore */ } }, 500);
      }
    };
    if (w.document.readyState === 'complete') {
      setTimeout(fire, 200);
    } else {
      w.addEventListener('load', () => setTimeout(fire, 200));
      // Hard fallback — if `load` never fires within 2s, print anyway.
      setTimeout(fire, 2000);
    }
  };

  const sections = useMemo(() => buildSections(lines || []), [lines]);
  const summary = useMemo(() => buildSummary(lines || [], otherCostsPct, useVat), [lines, otherCostsPct, useVat]);
  const today = new Date().toLocaleDateString('ru-RU');

  // Pretty-printed period for the document header and CSV export.
  const periodLabel = (() => {
    if (!periodFrom && !periodTo) return '';
    const fmtD = (s) => (s ? new Date(s).toLocaleDateString('ru-RU') : '…');
    return `${fmtD(periodFrom)} — ${fmtD(periodTo)}`;
  })();

  // Build the СВОДНЫЕ ИТОГИ rollup as a list of 8-wide rows ready to
  // splice into either CSV or XLSX. Mirrors what the on-screen modal
  // renders below the section table (СВОДНЫЕ ИТОГИ ПО ПРЯМЫМ ЗАТРАТАМ
  // + ТРАНСПОРТ И СКЛАДСКОЕ ХРАНЕНИЕ + 3. ПРОЧИЕ ЗАТРАТЫ + 4.
  // ОБОРУДОВАНИЕ + 5. ИТОГО И НАЛОГИ) so the file's last section
  // matches the printed document instead of cutting off after the
  // section subtotals.
  const buildRollupRows = () => {
    const out = [];
    // r2 keeps `null` / `undefined` / empty-string as empty cells (used
    // for rollup section banner rows like "СВОДНЫЕ ИТОГИ ПО ПРЯМЫМ
    // ЗАТРАТАМ" that have no monetary value attached). Real numbers
    // get rounded to 2 decimals.
    const r2 = (n) => {
      if (n == null || n === '') return '';
      const v = Number(n);
      return Number.isFinite(v) ? Math.round(v * 100) / 100 : '';
    };
    const blank = ['', '', '', '', '', '', '', ''];
    const labelRow = (label, amount) => ['', '', label, '', '', '', '', r2(amount)];
    const sumByType = summary.matByType || { standard: 0, equipment: 0, cable: 0 };
    const combined = summary.combined || { standard: 0, equipment: 0, cable: 0, total: 0 };

    out.push(blank);
    out.push(labelRow('СВОДНЫЕ ИТОГИ ПО ПРЯМЫМ ЗАТРАТАМ', '')); // header strip
    out.push(labelRow('Затраты труда рабочих-строителей', summary.labor));
    out.push(labelRow('Эксплуатация машин и механизмов', summary.machines));
    out.push(labelRow('ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ И КОНСТРУКЦИИ:', sumByType.standard));
    out.push(labelRow('ИТОГО ПО ОБОРУДОВАНИЮ:', sumByType.equipment));
    out.push(labelRow('ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:', sumByType.cable));
    out.push(labelRow('ИТОГО ПРЯМЫЕ ЗАТРАТЫ:', summary.direct));

    out.push(labelRow('ТРАНСПОРТ И СКЛАДСКОЕ ХРАНЕНИЕ', ''));
    const buckets = [
      { key: 'standard',  base: 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ:',         with: 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ С НАКРУТКАМИ:',     split: '(5% + 2%)' },
      { key: 'equipment', base: 'ИТОГО ПО ОБОРУДОВАНИЮ:',                     with: 'ИТОГО ПО ОБОРУДОВАНИЮ С НАКРУТКАМИ:',                 split: '(2% + 1,2%)' },
      { key: 'cable',     base: 'ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:', with: 'ИТОГО ПО КАБЕЛЬНОЙ ПРОДУКЦИИ С НАКРУТКАМИ:',          split: '(1,5% + 2%)' },
    ];
    for (const b of buckets) {
      out.push(labelRow(b.base, sumByType[b.key]));
      out.push(labelRow(`    Транспорт и складское хранение ${b.split}`, combined[b.key]));
      out.push(labelRow(b.with, (sumByType[b.key] || 0) + (combined[b.key] || 0)));
    }
    out.push(labelRow('Итого транспорт и складское хранение:', combined.total));

    out.push(labelRow('3. ПРОЧИЕ ЗАТРАТЫ ПО СТРОИТЕЛЬСТВУ', ''));
    out.push(labelRow('ИТОГО БАЗА ДЛЯ ПРОЧИХ:', summary.otherBase));
    out.push(labelRow(`+ Прочие затраты производственного характера (${otherCostsPct || 0}%)`, summary.other));
    out.push(labelRow('ИТОГО ПО СТРОИТЕЛЬСТВУ (база + прочие):', summary.constructionTotal));

    if ((summary.equipmentTotal || 0) > 0) {
      out.push(labelRow('4. ОБОРУДОВАНИЕ (отдельно, с накрутками, без прочих):', summary.equipmentTotal));
    }

    out.push(labelRow('ИТОГО (стройка + оборудование, до НДС):', summary.subtotal));
    if (summary.useVat) {
      out.push(labelRow(`Налог на добавленную стоимость (НДС ${VAT_PCT}%):`, summary.vat));
    }
    out.push(labelRow(
      `ВСЕГО ПО СМЕТЕ (${summary.useVat ? 'с НДС' : 'без НДС'}):`,
      summary.grand,
    ));
    return out;
  };

  const exportCsv = () => {
    const rows = [];
    rows.push(['ФОРМА № 2 — ЛОКАЛЬНЫЙ РЕСУРСНЫЙ СМЕТНЫЙ РАСЧЁТ']);
    if (project?.name) rows.push([project.name]);
    rows.push(['Дата составления:', today]);
    if (periodLabel) rows.push(['Период:', periodLabel]);
    if (customerName) rows.push(['Заказчик:', customerName]);
    rows.push([]);
    // Сумма column is the pre-overhead base — matches what the user
    // sees on the Form 2 preview's section table; накрутки are
    // accumulated separately in the СВОДНЫЕ ИТОГИ block.
    rows.push(['№', 'Шифр', 'Наименование', 'Раздел', 'Ед.изм.', 'Кол-во', 'Цена', 'Сумма']);
    let num = 0;
    for (const sec of sections) {
      let secBase = 0;
      for (const it of sec.items) {
        num++;
        const { work, qty, subs, brutto } = it;
        const pricePerUnit = qty > 0 ? brutto.base / qty : 0;
        rows.push([num, work.code || '', work.name || '', sec.name, work.uom || '', qty, Math.round(pricePerUnit * 100) / 100, Math.round(brutto.base * 100) / 100]);
        for (const r of subs) {
          if (isSubStage(r)) {
            const stageTotal = Number(r.total_amount || 0);
            if (stageTotal <= 0) continue;
            rows.push(['', 'ДОП.', '    ДОП. ' + (r.name || ''), '', r.uom || '', r.quantity || 0, r.unit_rate || 0, Math.round(stageTotal * 100) / 100]);
            continue;
          }
          const rQty = Number(r.quantity || 0);
          const baseCost = Number(r.unit_rate || 0) * rQty;
          const tps = Array.isArray(r.topups) ? r.topups : [];
          const tpQty = tps.reduce(
            (m, tp) => m + (Number(tp.extra_quantity) || 0),
            0,
          );
          const tpSum = tps.reduce(
            (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
            0,
          );
          if (baseCost <= 0 && tpSum <= 0) continue;
          // Same coverage rule as the modal: top-ups replace the
          // planned base ONLY when their total quantity covers the
          // planned qty. Partial top-ups leave the base in place.
          const topupsCover = tps.length > 0 && tpQty >= rQty;
          const summaForRow = topupsCover ? tpSum : baseCost;
          rows.push(['', CAT_COLORS[classifyResource(r)]?.name || '', '    ' + (r.name || ''), '', r.uom || '', r.quantity || 0, r.unit_rate || 0, Math.round(summaForRow * 100) / 100]);
          for (const tp of tps) {
            const tpQty = Number(tp.extra_quantity) || 0;
            const tpPrice = Number(tp.new_price) || 0;
            const tpTotal = tpQty * tpPrice;
            if (tpTotal <= 0) continue;
            const note = tp.note ? `  — ${tp.note}` : '';
            const dateStr = tp.ordered_at ? ` (${tp.ordered_at})` : '';
            rows.push(['', '+ДОП', `        ↳ Қўшимча буюртма${dateStr}${note}`, '', r.uom || '', tpQty, tpPrice, Math.round(tpTotal * 100) / 100]);
          }
        }
        secBase += brutto.base;
      }
      rows.push(['', '', `ИТОГО по разделу "${sec.name}":`, '', '', '', '', Math.round(secBase * 100) / 100]);
    }
    // Append the full СВОДНЫЕ ИТОГИ rollup so the file ends with the
    // same accounting structure the on-screen modal renders — direct
    // costs, transport+storage накрутки per bucket, прочие, equipment
    // line, НДС, grand total. Previously the CSV cut off after the
    // section subtotals, which made the file useless for handing off
    // to an accountant.
    for (const r of buildRollupRows()) rows.push(r);

    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Forma2_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Excel export — uses ExcelJS so the file actually carries the
  // same visual structure the modal renders: bold/centered title
  // banner, amber-50 section bands with an orange left rule, distinct
  // styling for parent works vs resource sub-rows, ИТОГО rows tinted
  // amber, and a properly merged + accent-colored СВОДНЫЕ ИТОГИ
  // rollup. The previous sheetjs-only path emitted a flat AOA grid
  // with no styling at all, which the user (correctly) refused to
  // hand to an accountant.
  const exportXlsx = async () => {
    // Palette — keyed off the Tailwind classes the modal uses.
    const C = {
      slate900:  '0F172A',
      slate700:  '334155',
      slate500:  '64748B',
      slate300:  'CBD5E1',
      slate100:  'F1F5F9',
      orange700: 'C2410C',
      amber50:   'FAF6EC',
      amber100:  'FEF3C7',
      amber400:  'FBBF24',
      stone200:  'E7E5E4',
      stone50:   'FAFAF9',
      workBg:    'F8F4E8',
      subBg:     'FDFBF5',
      headerBg:  '1E3A5F',
      headerFg:  'FFFFFF',
    };
    const thin = (clr) => ({ style: 'thin', color: { argb: clr || C.stone200 } });
    const border = {
      top: thin(C.stone200),
      bottom: thin(C.stone200),
      left: thin(C.stone200),
      right: thin(C.stone200),
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GenixERP';
    wb.created = new Date();

    const ws = wb.addWorksheet('Форма 2', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      },
    });

    // 7 columns: №, Шифр / Тип, Наименование, Ед.изм., Кол-во, Цена, Сумма.
    // (The "Раздел" column from the legacy AOA grid was redundant once
    // each section gets its own banner row — dropping it gives column C
    // way more room for long Cyrillic names.)
    ws.columns = [
      { width: 6 },   // A — №
      { width: 22 },  // B — Шифр / Тип
      { width: 80 },  // C — Наименование
      { width: 14 },  // D — Ед.изм.
      { width: 14 },  // E — Кол-во
      { width: 20 },  // F — Цена
      { width: 22 },  // G — Сумма
    ];
    const LAST_COL = 7;
    const lastColLetter = (n) => String.fromCharCode('A'.charCodeAt(0) + n - 1);

    let r = 1;

    // ── Title block ──
    const titleCell = ws.getCell(`A${r}`);
    ws.mergeCells(`A${r}:${lastColLetter(LAST_COL)}${r}`);
    titleCell.value = `${t('f2_form_label') || 'ФОРМА'} № 2 — ${t('f2_act_title') || 'АКТ ВЫПОЛНЕННЫХ РАБОТ'}`;
    titleCell.font = { bold: true, size: 18, color: { argb: C.slate900 } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 32;
    r++;

    const subCell = ws.getCell(`A${r}`);
    ws.mergeCells(`A${r}:${lastColLetter(LAST_COL)}${r}`);
    subCell.value = t('f2_local_resource_estimate') || 'Локальный ресурсный сметный расчёт';
    subCell.font = { italic: true, size: 11, color: { argb: C.slate500 } };
    subCell.alignment = { horizontal: 'center' };
    r++;

    // Mirror the on-screen header: object full name (above), project
    // name (middle, bold-ish), and joined address (below) — all centred
    // so the printed Excel matches what the user sees in the modal.
    const objectFullNameXlsx = String(project?.object_full_name || '').trim();
    if (objectFullNameXlsx) {
      ws.mergeCells(`A${r}:${lastColLetter(LAST_COL)}${r}`);
      const c = ws.getCell(`A${r}`);
      c.value = objectFullNameXlsx;
      c.font = { size: 11, color: { argb: C.slate700 } };
      c.alignment = { horizontal: 'center' };
      r++;
    }
    if (project?.name) {
      ws.mergeCells(`A${r}:${lastColLetter(LAST_COL)}${r}`);
      const projCell = ws.getCell(`A${r}`);
      projCell.value = project.name;
      projCell.font = { size: 11, bold: true, color: { argb: C.slate900 } };
      projCell.alignment = { horizontal: 'center' };
      r++;
    }
    const locationXlsx = [
      project?.region,
      project?.city,
      project?.district,
      project?.address,
    ]
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .join(', ');
    if (locationXlsx) {
      ws.mergeCells(`A${r}:${lastColLetter(LAST_COL)}${r}`);
      const c = ws.getCell(`A${r}`);
      c.value = locationXlsx;
      c.font = { size: 10, color: { argb: C.slate500 } };
      c.alignment = { horizontal: 'center' };
      r++;
    }

    r++; // blank spacer

    // ── Meta rows ──
    const metaRow = (label, value) => {
      ws.getCell(`A${r}`).value = label;
      ws.getCell(`A${r}`).font = { color: { argb: C.slate500 }, size: 10 };
      ws.mergeCells(`B${r}:${lastColLetter(LAST_COL)}${r}`);
      const v = ws.getCell(`B${r}`);
      v.value = value;
      v.font = { bold: true, color: { argb: C.slate900 }, size: 10 };
      r++;
    };
    // Same fallback as the on-screen header — when the project entity
    // doesn't carry a building_name (most cases), use the active estimate's.
    const blockNameXlsx = project?.building_name || estimate?.building_name || '';
    if (blockNameXlsx) metaRow(`${t('f2_object') || 'Объект'}:`, blockNameXlsx);
    metaRow(`${t('f2_period') || 'Отчётный период'}:`, periodLabel || '—');
    if (customerName) metaRow(`${t('f2_customer') || 'Заказчик'}:`, customerName);

    r++; // blank spacer

    // Helper for styling number cells.
    const styleNumber = (cell, fmt = '#,##0.00') => {
      cell.numFmt = fmt;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    };

    // ── Sections ──
    let globalNum = 0;
    for (const [secIdx, sec] of sections.entries()) {
      // Section banner — amber tint with thick orange left border.
      ws.mergeCells(`A${r}:${lastColLetter(LAST_COL)}${r}`);
      const banner = ws.getCell(`A${r}`);
      banner.value = `${t('f2_section') || 'Раздел'} ${ROMAN[secIdx] || (secIdx + 1)}. ${sec.name}`;
      banner.font = { bold: true, size: 11, color: { argb: C.slate900 } };
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amber50 } };
      banner.alignment = { vertical: 'middle' };
      banner.border = {
        ...border,
        left: { style: 'thick', color: { argb: C.orange700 } },
      };
      ws.getRow(r).height = 22;
      r++;

      // Column headers for this section.
      const headers = [
        t('f2_col_no') || '№',
        t('f2_col_code') || 'Шифр / Тип',
        t('f2_col_name') || 'Наименование работ, затрат и ресурсов',
        t('f2_col_unit') || 'Ед.изм.',
        t('f2_col_qty') || 'Кол-во',
        t('f2_col_price') || 'Цена, сум',
        t('f2_col_amount') || 'Сумма, сум',
      ];
      for (let c = 1; c <= LAST_COL; c++) {
        const cell = ws.getCell(r, c);
        cell.value = headers[c - 1];
        cell.font = { bold: true, size: 9, color: { argb: C.slate700 } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amber100 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          ...border,
          top: { style: 'medium', color: { argb: C.amber400 } },
          bottom: { style: 'medium', color: { argb: C.amber400 } },
        };
      }
      ws.getRow(r).height = 30;
      r++;

      // Data rows.
      let secBase = 0;
      for (const it of sec.items) {
        globalNum++;
        const { work, qty, subs, brutto } = it;
        const pricePerUnit = qty > 0 ? brutto.base / qty : 0;

        // Parent work row — dark amber background, bold name, orange total.
        const wRow = r;
        ws.getCell(wRow, 1).value = globalNum;
        ws.getCell(wRow, 2).value = work.code || '';
        ws.getCell(wRow, 3).value = work.name || '';
        ws.getCell(wRow, 4).value = work.uom || '';
        ws.getCell(wRow, 5).value = Number(qty);
        ws.getCell(wRow, 6).value = Math.round(pricePerUnit * 100) / 100;
        ws.getCell(wRow, 7).value = Math.round(brutto.base * 100) / 100;
        for (let c = 1; c <= LAST_COL; c++) {
          const cell = ws.getCell(wRow, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.workBg } };
          cell.border = border;
          cell.font = { bold: true, size: 10, color: { argb: C.slate900 } };
          cell.alignment = { vertical: 'middle', wrapText: c === 3 };
        }
        ws.getCell(wRow, 1).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(wRow, 2).font = { bold: false, size: 9, color: { argb: C.slate700 }, name: 'Consolas' };
        ws.getCell(wRow, 4).alignment = { horizontal: 'center', vertical: 'middle' };
        styleNumber(ws.getCell(wRow, 5), '#,##0.######');
        styleNumber(ws.getCell(wRow, 6));
        styleNumber(ws.getCell(wRow, 7));
        ws.getCell(wRow, 7).font = { bold: true, size: 10, color: { argb: C.orange700 } };
        r++;

        // Resource sub-rows.
        for (const res of subs) {
          if (isSubStage(res)) {
            const stageTotal = Number(res.total_amount || 0);
            if (stageTotal <= 0) continue;
            ws.getCell(r, 1).value = '';
            ws.getCell(r, 2).value = 'ДОП.';
            ws.getCell(r, 3).value = '    ДОП. ' + (res.name || '');
            ws.getCell(r, 4).value = res.uom || '';
            ws.getCell(r, 5).value = Number(res.quantity || 0);
            ws.getCell(r, 6).value = Number(res.unit_rate || 0);
            ws.getCell(r, 7).value = Math.round(stageTotal * 100) / 100;
            for (let c = 1; c <= LAST_COL; c++) {
              const cell = ws.getCell(r, c);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ECFDF5' } };
              cell.border = border;
              cell.font = { size: 9, color: { argb: '047857' } };
            }
            ws.getCell(r, 4).alignment = { horizontal: 'center' };
            styleNumber(ws.getCell(r, 5), '#,##0.######');
            styleNumber(ws.getCell(r, 6));
            styleNumber(ws.getCell(r, 7));
            r++;
            continue;
          }
          const resQty = Number(res.quantity || 0);
          const baseCost = Number(res.unit_rate || 0) * resQty;
          const tps = Array.isArray(res.topups) ? res.topups : [];
          const tpQty = tps.reduce(
            (m, tp) => m + (Number(tp.extra_quantity) || 0),
            0,
          );
          const tpSum = tps.reduce(
            (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
            0,
          );
          if (baseCost <= 0 && tpSum <= 0) continue;
          // Same coverage rule as the modal/CSV: top-ups replace the
          // planned base ONLY when their total qty covers the
          // resource's planned qty.
          const topupsCover = tps.length > 0 && tpQty >= resQty;
          const summaForRow = topupsCover ? tpSum : baseCost;
          {
            ws.getCell(r, 1).value = '';
            ws.getCell(r, 2).value = CAT_COLORS[classifyResource(res)]?.name || '';
            ws.getCell(r, 3).value = '    ' + (res.name || '');
            ws.getCell(r, 4).value = res.uom || '';
            ws.getCell(r, 5).value = Number(res.quantity || 0);
            ws.getCell(r, 6).value = Number(res.unit_rate || 0);
            ws.getCell(r, 7).value = Math.round(summaForRow * 100) / 100;
            for (let c = 1; c <= LAST_COL; c++) {
              const cell = ws.getCell(r, c);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.subBg } };
              cell.border = border;
              cell.font = { size: 9, color: { argb: C.slate700 } };
            }
            ws.getCell(r, 4).alignment = { horizontal: 'center' };
            styleNumber(ws.getCell(r, 5), '#,##0.######');
            styleNumber(ws.getCell(r, 6));
            styleNumber(ws.getCell(r, 7));
            r++;
          }
          // Top-up rows (migration 358) — extra purchases at new prices.
          // Render as indented sub-rows with a teal tint so they're
          // visually distinct from both works and base resources.
          for (const tp of tps) {
            const tpQty = Number(tp.extra_quantity) || 0;
            const tpPrice = Number(tp.new_price) || 0;
            const tpTotal = tpQty * tpPrice;
            if (tpTotal <= 0) continue;
            const note = tp.note ? `  — ${tp.note}` : '';
            const dateStr = tp.ordered_at ? ` (${tp.ordered_at})` : '';
            ws.getCell(r, 1).value = '';
            ws.getCell(r, 2).value = '+ДОП';
            ws.getCell(r, 3).value = `        ↳ Қўшимча буюртма${dateStr}${note}`;
            ws.getCell(r, 4).value = res.uom || '';
            ws.getCell(r, 5).value = tpQty;
            ws.getCell(r, 6).value = tpPrice;
            ws.getCell(r, 7).value = Math.round(tpTotal * 100) / 100;
            for (let c = 1; c <= LAST_COL; c++) {
              const cell = ws.getCell(r, c);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDFA' } };
              cell.border = border;
              cell.font = { size: 9, color: { argb: '0F766E' }, italic: true };
            }
            ws.getCell(r, 4).alignment = { horizontal: 'center' };
            styleNumber(ws.getCell(r, 5), '#,##0.######');
            styleNumber(ws.getCell(r, 6));
            styleNumber(ws.getCell(r, 7));
            r++;
          }
        }
        secBase += brutto.base;
      }

      // Section ИТОГО.
      ws.mergeCells(`A${r}:F${r}`);
      const itogoLabel = ws.getCell(`A${r}`);
      itogoLabel.value = `ИТОГО по разделу ${ROMAN[secIdx] || (secIdx + 1)} (без транспорта и склада):`;
      itogoLabel.font = { bold: true, color: { argb: C.slate900 } };
      itogoLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amber50 } };
      itogoLabel.alignment = { horizontal: 'right', vertical: 'middle' };
      itogoLabel.border = { ...border, top: { style: 'medium', color: { argb: C.amber400 } } };

      const itogoVal = ws.getCell(r, 7);
      itogoVal.value = Math.round(secBase * 100) / 100;
      itogoVal.numFmt = '#,##0.00';
      itogoVal.font = { bold: true, color: { argb: C.orange700 } };
      itogoVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amber50 } };
      itogoVal.alignment = { horizontal: 'right', vertical: 'middle' };
      itogoVal.border = { ...border, top: { style: 'medium', color: { argb: C.amber400 } } };
      ws.getRow(r).height = 22;
      r++;
      r++; // spacer between sections
    }

    // ── СВОДНЫЕ ИТОГИ rollup ──
    // Each row is either a banner (amber-100, bold, merged A:G) or
    // an aggregator row (label in A:F, value in G).
    const sumByType = summary.matByType || { standard: 0, equipment: 0, cable: 0 };
    const combined = summary.combined || { standard: 0, equipment: 0, cable: 0, total: 0 };

    const banner = (text, color = C.amber100) => {
      ws.mergeCells(`A${r}:${lastColLetter(LAST_COL)}${r}`);
      const cell = ws.getCell(`A${r}`);
      cell.value = text;
      cell.font = { bold: true, size: 11, color: { argb: C.slate900 } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { vertical: 'middle' };
      cell.border = border;
      ws.getRow(r).height = 22;
      r++;
    };
    const lineRow = (label, amount, opts = {}) => {
      ws.mergeCells(`A${r}:F${r}`);
      const lab = ws.getCell(`A${r}`);
      lab.value = label;
      lab.alignment = { horizontal: 'right', vertical: 'middle', indent: opts.indent || 0 };
      lab.font = {
        bold: !!opts.bold,
        size: opts.size || 10,
        color: { argb: opts.labelColor || C.slate700 },
        italic: !!opts.italic,
      };
      lab.border = border;
      if (opts.fill) lab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };

      const val = ws.getCell(r, 7);
      val.value = (amount == null || amount === '') ? '' : Math.round(Number(amount) * 100) / 100;
      val.numFmt = '#,##0.00';
      val.font = {
        bold: !!opts.bold,
        size: opts.size || 10,
        color: { argb: opts.valueColor || opts.labelColor || C.slate900 },
      };
      val.alignment = { horizontal: 'right', vertical: 'middle' };
      val.border = border;
      if (opts.fill) val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
      r++;
    };

    banner(t('f2_block_direct') || 'СВОДНЫЕ ИТОГИ ПО ПРЯМЫМ ЗАТРАТАМ');
    lineRow(t('f2_labor_costs') || 'Затраты труда рабочих-строителей', summary.labor);
    lineRow(t('f2_machine_ops') || 'Эксплуатация машин и механизмов', summary.machines);
    lineRow(t('f2_total_construction_materials_full') || 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ И КОНСТРУКЦИИ:', sumByType.standard, { bold: true });
    lineRow(t('f2_total_equipment') || 'ИТОГО ПО ОБОРУДОВАНИЮ:', sumByType.equipment, { bold: true });
    lineRow(t('f2_total_cable') || 'ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:', sumByType.cable, { bold: true });
    lineRow(t('f2_total_direct_costs') || 'ИТОГО ПРЯМЫЕ ЗАТРАТЫ:', summary.direct, {
      bold: true, size: 11, fill: C.amber50, valueColor: C.orange700,
    });

    banner(t('f2_block_transport') || 'ТРАНСПОРТ И СКЛАДСКОЕ ХРАНЕНИЕ');
    const buckets = [
      { key: 'standard',  base: t('f2_total_construction_materials')          || 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ:',         with: t('f2_total_construction_materials_with_overhead') || 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ С НАКРУТКАМИ:', split: '(5% + 2%)' },
      { key: 'equipment', base: t('f2_total_equipment')                       || 'ИТОГО ПО ОБОРУДОВАНИЮ:',                     with: t('f2_total_equipment_with_overhead')              || 'ИТОГО ПО ОБОРУДОВАНИЮ С НАКРУТКАМИ:',             split: '(2% + 1,2%)' },
      { key: 'cable',     base: t('f2_total_cable')                           || 'ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:', with: t('f2_total_cable_with_overhead')                  || 'ИТОГО ПО КАБЕЛЬНОЙ ПРОДУКЦИИ С НАКРУТКАМИ:',      split: '(1,5% + 2%)' },
    ];
    for (const b of buckets) {
      lineRow(b.base, sumByType[b.key], { bold: true });
      lineRow(`${t('f2_transport_storage') || 'Транспорт и складское хранение'} ${b.split}`, combined[b.key], {
        size: 9, italic: true, labelColor: C.slate500,
      });
      lineRow(b.with, (sumByType[b.key] || 0) + (combined[b.key] || 0), {
        bold: true, valueColor: C.orange700,
      });
    }
    lineRow(t('f2_transport_storage_total') || 'Итого транспорт и складское хранение:', combined.total, {
      bold: true, fill: C.amber50, valueColor: C.orange700,
    });

    banner(t('f2_block_other') || '3. ПРОЧИЕ ЗАТРАТЫ ПО СТРОИТЕЛЬСТВУ');
    lineRow(t('f2_total_other_base') || 'ИТОГО БАЗА ДЛЯ ПРОЧИХ:', summary.otherBase, { bold: true });
    lineRow(
      `+ ${t('f2_other_costs') || 'Прочие расходы'} (${otherCostsPct || 0}%)`,
      summary.other,
      { italic: true },
    );
    lineRow(t('f2_total_construction') || 'ИТОГО ПО СТРОИТЕЛЬСТВУ (база + прочие):', summary.constructionTotal, {
      bold: true, size: 11, fill: C.amber50, valueColor: C.orange700,
    });

    if ((summary.equipmentTotal || 0) > 0) {
      banner(t('f2_block_equipment_separate') || '4. ОБОРУДОВАНИЕ (отдельно)');
      lineRow(t('f2_total_equipment_separate') || 'ИТОГО ПО ОБОРУДОВАНИЮ (с накрутками, без прочих):', summary.equipmentTotal, {
        bold: true, fill: C.amber50, valueColor: C.orange700,
      });
    }

    banner(t('f2_block_total_taxes') || '5. ИТОГО И НАЛОГИ');
    lineRow(t('f2_total_before_vat') || 'ИТОГО (стройка + оборудование, до НДС):', summary.subtotal, {
      bold: true, size: 11, fill: '111111', labelColor: 'FFFFFF', valueColor: 'FFFFFF',
    });
    if (summary.useVat) {
      lineRow(`${t('f2_vat_full') || 'Налог на добавленную стоимость (НДС)'} (${t('f2_vat_label') || 'НДС'} ${VAT_PCT}%)`, summary.vat, {
        italic: true, labelColor: C.slate700,
      });
    }
    lineRow(
      `ВСЕГО ПО СМЕТЕ (${summary.useVat ? 'с НДС' : 'без НДС'}):`,
      summary.grand,
      { bold: true, size: 13, fill: C.orange700, labelColor: 'FFFFFF', valueColor: 'FFFFFF' },
    );

    // ── Save ──
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Forma2_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Actually fire the snapshot save once the Akt № modal collected its
  // number. Extracted from the inline onClick so both the OK button and
  // the Enter key can trigger it without code duplication.
  const submitSnapshot = async (actNumberRaw) => {
    if (!onSaveSnapshot) return;
    const actNumber = String(actNumberRaw || '').trim();
    setAktModalOpen(false);
    setSavingSnapshot(true);
    try {
      await onSaveSnapshot({
        period_from: periodFrom || null,
        period_to: periodTo || null,
        other_costs_pct: otherCostsPct,
        use_vat: useVat,
        total_with_vat: useVat ? summary.grand : summary.subtotal + summary.subtotal * VAT_PCT / 100,
        total_without_vat: summary.subtotal,
        construction_total: summary.constructionTotal,
        equipment_total: summary.equipmentTotal,
        act_number: actNumber,
        // Full immutable capture of what the user is looking at.
        // Re-opening the snapshot from the Tarix tab restores
        // exactly this — even if the underlying estimate changes.
        snapshot_data: {
          saved_at:    new Date().toISOString(),
          estimate_id: estimate?.id || null,
          project_id:  project?.id  || null,
          period: { from: periodFrom || null, to: periodTo || null },
          other_costs_pct: otherCostsPct,
          use_vat: useVat,
          summary,
          lines: (lines || []).map((l) => ({
            id: l.id, name: l.name, uom: l.uom,
            quantity: l.quantity, unit_rate: l.unit_rate, total_amount: l.total_amount,
            material_rate: l.material_rate, labor_rate: l.labor_rate, equipment_rate: l.equipment_rate,
            material_type: l.material_type, resource_type: l.resource_type,
            parent_line_id: l.parent_line_id, item_number: l.item_number, code: l.code,
            // Persist top-ups so re-opening a saved Forma 2 shows the
            // exact spend that was approved at save time, even if the
            // live estimate has since been edited.
            topups: Array.isArray(l.topups) ? l.topups.map((tp) => ({
              id: tp.id, extra_quantity: tp.extra_quantity, new_price: tp.new_price,
              ordered_at: tp.ordered_at, note: tp.note,
            })) : undefined,
          })),
        },
      });
    } finally {
      setSavingSnapshot(false);
    }
  };

  return (
    <div className="form2-preview-wrap">
      {/* Toolbar (hidden in print). Wraps onto two rows on narrower screens
         so all controls — period range, Прочие %, НДС toggle, Print, CSV,
         Save — stay reachable without horizontal scroll. */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white sticky top-0 z-10 print:hidden flex-wrap">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> {t('close') || 'Yopish'}
          </Button>
        )}
        <div className="flex-1" />
        {/* Period (давр) — date range that prints in the doc header
           and travels with any saved snapshot. Both bounds optional. */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <label className="text-xs text-slate-500">{t('period_label') || 'Давр'}:</label>
          <Input
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            className="w-[140px] h-8 text-xs"
          />
          <span className="text-slate-400 text-xs">—</span>
          <Input
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            className="w-[140px] h-8 text-xs"
            min={periodFrom || undefined}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">{t('other_costs_pct') || 'Прочие %'}</label>
          <Input
            value={otherCostsPct}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0 && v <= 100) setOtherCostsPct(v);
            }}
            className="w-20 h-8 text-right font-mono text-sm"
          />
          {/* VAT is a toggle now — fixed 12% rate, just decides whether to
             include or exclude it in the grand total. */}
          <label className="ml-2 inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
            <input
              type="checkbox"
              checked={useVat}
              onChange={(e) => setUseVat(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-amber-700"
            />
            {t('vat_short') || 'НДС'} {VAT_PCT}%
          </label>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-1" /> {t('print') || 'Chop etish'}
        </Button>
        <Button variant="outline" size="sm" onClick={exportXlsx}>
          <FileDown className="w-4 h-4 mr-1" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <FileDown className="w-4 h-4 mr-1" /> CSV
        </Button>
        {/* Save snapshot — only rendered when a save handler is supplied
           by the parent (SmetaManagementTab). Captures the current state
           — period, otherCostsPct, useVat, summary totals — so the user
           can re-open it later from the Tarix tab. */}
        {onSaveSnapshot && (
          <Button
            size="sm"
            disabled={savingSnapshot}
            onClick={() => { setAktNumber(''); setAktModalOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4 mr-1" /> {t('save') || 'Saqlash'}
          </Button>
        )}
      </div>

      {/* Document body — light theme to match a printed page.
         Layout mirrors the v23 mockup (Form2_Works_v23_prochie_breakdown.html):
         left-aligned "ФОРМА № 2" stamp box next to a centered title block,
         a meta row underneath (Объект / Отчётный период / Дата составления),
         and a Заказчик line aligned to the right. */}
      <div ref={docRef} className="form2-doc max-w-[1100px] mx-auto my-6 p-10 bg-white text-slate-900 shadow-lg rounded">
        <div className="mb-6 pb-4 border-b-2 border-slate-900">
          <div className="flex items-start gap-6">
            {/* ФОРМА № 2 stamp — left-aligned styled box. */}
            <div
              className="shrink-0 border-2 border-slate-900 rounded px-3 py-2 text-center leading-tight"
              style={{ minWidth: 84 }}
            >
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{t('f2_form_label') || 'ФОРМА'}</div>
              <div className="text-[22px] font-bold text-slate-900">№ 2</div>
            </div>

            {/* Centered title block — recibo header.
                The mockup (Form2_Works_v23_prochie_breakdown.html) prints
                three lines under the title: the construction object's
                full name (object_full_name from the project), the
                project's display name, and a free-form address built from
                the project's region / city / district / address fields.
                Without this the printed Form 2 only carried the project
                name — the user reported "shu nomlari smetada bor shular
                chiqishi kerak" (these names exist in the smeta, they
                should appear here). */}
            <div className="flex-1 text-center">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">
                {t('f2_local_resource_estimate') || 'Локальный ресурсный сметный расчёт'}
              </div>
              <div className="text-[26px] font-extrabold text-slate-900 tracking-wide">
                {t('f2_act_title') || 'АКТ ВЫПОЛНЕННЫХ РАБОТ'}
              </div>
              {(() => {
                // Object full name (e.g. "Строительство многоэтажных
                // жилых домов") goes ABOVE the bare project name when
                // present — it's the regulatory description the smeta
                // was issued against.
                const objectFullName = String(project?.object_full_name || '').trim();
                // Address line — joined from whichever of the four
                // location fields the project has filled in. We skip
                // empties and de-dup so a project that only has region
                // doesn't render "г.Самарканд, , , ".
                const locationParts = [
                  project?.region,
                  project?.city,
                  project?.district,
                  project?.address,
                ]
                  .map((p) => String(p || '').trim())
                  .filter(Boolean);
                const locationLine = locationParts.join(', ');
                return (
                  <>
                    {objectFullName && (
                      <div className="text-[13px] text-slate-700 mt-2 max-w-[640px] mx-auto">
                        {objectFullName}
                      </div>
                    )}
                    {project?.name && (
                      <div className="text-[13px] font-semibold text-slate-800 mt-1.5 max-w-[640px] mx-auto">
                        {project.name}
                      </div>
                    )}
                    {locationLine && (
                      <div className="text-[12px] text-slate-500 mt-1 max-w-[640px] mx-auto">
                        {locationLine}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Meta row — Объект (left) | Отчётный период (center) | Заказчик
             (right). Дата составления + Версия сметы were removed per
             product feedback ("period itself enough" + the act is dated by
             when it's signed, not by today's render time). The customer
             name comes from the user's active company in CompanyContext. */}
          {(() => {
            // Block name resolution — prefer the project-level building_name
            // (set when the project owns just one block), then fall back to
            // the active estimate's building_name (Smeta boshqaruvi → Blok
            // dropdown). Without this fallback the print preview rendered
            // an empty Объект cell whenever the user opened Forma 2 from
            // the Smeta tab — see screenshot bug report.
            const blockName = project?.building_name || estimate?.building_name || '';
            return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-slate-600">
            <div>
              {blockName && (
                <>
                  <span className="text-slate-400">{t('f2_object') || 'Объект'}:</span>{' '}
                  <strong className="text-slate-800">{blockName}</strong>
                </>
              )}
            </div>
            <div className="md:text-center">
              <span className="text-slate-400">{t('f2_period') || 'Отчётный период'}:</span>{' '}
              <strong className="text-slate-800">{periodLabel || '—'}</strong>
            </div>
            <div className="md:text-right">
              {customerName && (
                <>
                  <span className="text-slate-400">{t('f2_customer') || 'Заказчик'}:</span>{' '}
                  <strong className="text-slate-800 uppercase tracking-wide">
                    {customerName}
                  </strong>
                </>
              )}
            </div>
          </div>
            );
          })()}
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-lg mb-2">📋 {t('form2_empty_title') || 'Форма 2 пустая'}</div>
            <div className="text-xs">{t('form2_empty_hint') || 'Введите объёмы работ и Форма 2 заполнится автоматически'}</div>
          </div>
        ) : (
          (() => {
            let globalNum = 0;
            return sections.map((sec, i) => (
              <div key={sec.name} className="mt-5">
                <div className="bg-amber-50 border-l-4 border-orange-700 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 mb-0.5">
                  {t('f2_section') || 'Раздел'} {ROMAN[i] || (i + 1)}. {sec.name}
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[50px]">{t('f2_col_no') || '№'}</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[110px]">{t('f2_col_code') || 'Шифр / Тип'}</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700">{t('f2_col_name') || 'Наименование работ, затрат и ресурсов'}</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[75px]">{t('f2_col_unit') || 'Ед.изм.'}</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[85px]">{t('f2_col_qty') || 'Кол-во'}</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[105px]">{t('f2_col_price') || 'Цена, сум'}</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[135px]">{t('f2_col_amount') || 'Сумма, сум'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map(({ work, qty, subs, brutto }) => {
                      globalNum++;
                      // Per-row Цена / Сумма are deliberately
                      // pre-overhead (base only). The transport+storage
                      // накрутки are accumulated separately in the
                      // СВОДНЫЕ ИТОГИ block below; folding them into
                      // the per-row Сумма too would double-count them
                      // visually and inflate the section subtotal.
                      const pricePerUnit = qty > 0 ? brutto.base / qty : 0;
                      return (
                        <React.Fragment key={work.id}>
                          <tr style={{ background: '#F8F4E8', borderTop: '2px solid #999' }}>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-center text-[12px] font-bold">{globalNum}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 font-mono text-[10px] font-semibold">{work.code || ''}</td>
                            <td className="border border-stone-300 px-2 py-1.5 font-semibold text-slate-900">{work.name}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-center font-semibold">{work.uom || ''}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-right font-mono font-semibold">{fmtRu(qty)}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-right font-mono font-semibold">{fmtRu(Math.round(pricePerUnit * 100) / 100)}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-right font-mono font-bold text-orange-700">{fmtRu(Math.round(brutto.base * 100) / 100)}</td>
                          </tr>
                          {subs.map((r) => {
                            // ДОП. sub-stage row: green background, dedicated
                            // label badge, total comes straight from the
                            // sub-stage's stored total_amount (already net of
                            // its own resource breakdown).
                            if (isSubStage(r)) {
                              const stageTotal = Number(r.total_amount || 0);
                              if (stageTotal <= 0) return null;
                              return (
                                <tr key={r.id} style={{ background: '#ECFDF5' }}>
                                  <td className="border border-emerald-200 px-1.5 py-1.5 text-center text-[10px] text-emerald-700 font-mono">{r.item_number || ''}</td>
                                  <td className="border border-emerald-200 px-1.5 py-1.5 font-mono text-[10px] font-bold" style={{ color: '#047857' }}>ДОП.</td>
                                  <td className="border border-emerald-200 px-2 py-1.5 pl-5 text-emerald-900 font-medium">
                                    <span className="inline-block mr-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-600 text-white tracking-wider">ДОП.</span>
                                    {r.name}
                                  </td>
                                  <td className="border border-emerald-200 px-1.5 py-1.5 text-center text-emerald-700">{r.uom || ''}</td>
                                  <td className="border border-emerald-200 px-1.5 py-1.5 text-right font-mono text-emerald-700">{fmtRu(Number(r.quantity || 0))}</td>
                                  <td className="border border-emerald-200 px-1.5 py-1.5 text-right font-mono text-emerald-700">{fmtRu(Number(r.unit_rate || 0))}</td>
                                  <td className="border border-emerald-200 px-1.5 py-1.5 text-right font-mono font-semibold text-emerald-800">
                                    {fmtRu(Math.round(stageTotal * 100) / 100)}
                                  </td>
                                </tr>
                              );
                            }
                            const price = Number(r.unit_rate || 0);
                            const totQ = Number(r.quantity || 0);
                            const base = price * totQ;
                            // Resource top-ups (migration 358) — extra
                            // purchases at a possibly different price.
                            // Render as indented child rows beneath the
                            // resource so the audit trail is visible in
                            // the printed document.
                            const topups = Array.isArray(r.topups) ? r.topups : [];
                            const topupSum = topups.reduce(
                              (m, tp) => m + (Number(tp.extra_quantity) || 0) * (Number(tp.new_price) || 0),
                              0,
                            );
                            if (base <= 0 && topupSum <= 0) return null;
                            const cat = classifyResource(r);
                            const cfg = CAT_COLORS[cat];
                            const mt = cat === 'material' ? getMaterialType(r) : null;
                            // Sub-row Сумма is the bare base — no
                            // transport+storage накрутка folded in.
                            // The full накрутка breakdown lives in the
                            // СВОДНЫЕ ИТОГИ block below, applied once
                            // against the section subtotals.
                            // When the resource carries top-ups whose
                            // total quantity covers the planned qty,
                            // the displayed Сумма becomes the topup-
                            // sum (replaces the planned base — same
                            // rule as Smeta tab). Partial top-ups
                            // (Σ tp.qty < r.qty) leave the planned
                            // base in place; the +ДОП rows are still
                            // listed for traceability.
                            const topupQty = topups.reduce(
                              (m, tp) => m + (Number(tp.extra_quantity) || 0),
                              0,
                            );
                            const topupsCover = topups.length > 0 && topupQty >= totQ;
                            const summaForRow = topupsCover ? topupSum : base;
                            return (
                              <React.Fragment key={r.id}>
                                <tr style={{ background: '#FDFBF5' }}>
                                  <td className="border border-stone-200 px-1.5 py-1.5 text-center text-[10px] text-slate-400 font-mono">{r.item_number || ''}</td>
                                  <td className="border border-stone-200 px-1.5 py-1.5 font-mono text-[10px] font-semibold" style={{ color: cfg?.hex }}>{cfg?.name}</td>
                                  <td className="border border-stone-200 px-2 py-1.5 pl-5 text-slate-700">
                                    {r.name}
                                    {mt && (
                                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-stone-200 text-slate-600 tracking-wider">{MAT_TYPE_SHORT[mt]}</span>
                                    )}
                                  </td>
                                  <td className="border border-stone-200 px-1.5 py-1.5 text-center text-slate-600">{r.uom || ''}</td>
                                  <td className="border border-stone-200 px-1.5 py-1.5 text-right font-mono text-slate-600">{fmtRu(totQ)}</td>
                                  <td className="border border-stone-200 px-1.5 py-1.5 text-right font-mono text-slate-600">{fmtRu(price)}</td>
                                  <td className="border border-stone-200 px-1.5 py-1.5 text-right font-mono">
                                    {fmtRu(Math.round(summaForRow * 100) / 100)}
                                  </td>
                                </tr>
                                {topups.map((tp) => {
                                  const tpQty = Number(tp.extra_quantity) || 0;
                                  const tpPrice = Number(tp.new_price) || 0;
                                  const tpTotal = tpQty * tpPrice;
                                  if (tpTotal <= 0) return null;
                                  return (
                                    <tr key={`r${r.id}-tp${tp.id}`} style={{ background: '#F0FDFA' }}>
                                      <td className="border border-teal-200 px-1.5 py-1 text-center text-[9px] text-teal-700 font-mono">+ДОП</td>
                                      <td className="border border-teal-200 px-1.5 py-1 font-mono text-[10px] font-semibold text-teal-700">ЗАКАЗ</td>
                                      <td className="border border-teal-200 px-2 py-1 pl-9 text-teal-900 text-[11px]">
                                        <span className="text-teal-500 mr-1">↳</span>
                                        Қўшимча буюртма
                                        {tp.ordered_at ? (
                                          <span className="ml-2 text-[9px] text-slate-500">({tp.ordered_at})</span>
                                        ) : null}
                                        {tp.note ? (
                                          <span className="ml-2 text-[9px] italic text-slate-500">— {tp.note}</span>
                                        ) : null}
                                      </td>
                                      <td className="border border-teal-200 px-1.5 py-1 text-center text-[10px] text-teal-700">{r.uom || ''}</td>
                                      <td className="border border-teal-200 px-1.5 py-1 text-right font-mono text-[10px] text-teal-700">{fmtRu(tpQty)}</td>
                                      <td className="border border-teal-200 px-1.5 py-1 text-right font-mono text-[10px] text-teal-700">{fmtRu(tpPrice)}</td>
                                      <td className="border border-teal-200 px-1.5 py-1 text-right font-mono text-[10px] font-semibold text-teal-800">
                                        {fmtRu(Math.round(tpTotal * 100) / 100)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    <tr style={{ background: '#FAF6EC', fontWeight: 700 }}>
                      <td className="border border-amber-300 px-2 py-2" colSpan={6} style={{ textAlign: 'right' }}>
                        {t('f2_section_total_no_overhead') || 'ИТОГО по разделу (без транспорта и склада)'} {ROMAN[i] || (i + 1)}:
                      </td>
                      <td className="border border-amber-300 px-2 py-2 text-right font-mono text-orange-700">
                        {fmtRu(Math.round((sec.base ?? sec.total) * 100) / 100)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ));
          })()
        )}

        {/* Summary block — v23 structure: direct costs → combined
           transport+storage by material → ПРОЧИЕ with itemised base
           → separate ОБОРУДОВАНИЕ line → VAT toggle → grand total. */}
        {sections.length > 0 && (
          <div className="mt-8 p-6 bg-stone-50 border border-stone-300 rounded">
            <div className="text-sm font-bold uppercase tracking-wide pb-3 border-b-2 border-slate-900 mb-4">
              {t('f2_summary_title') || 'Сводный расчёт сметной стоимости'}
            </div>

            <table className="w-full text-[12px]">
              <tbody>
                {/* 1. Direct costs — exactly the v23 mockup's
                   "СВОДНЫЕ ИТОГИ ПО ПРЯМЫМ ЗАТРАТАМ" panel. Labor + machine
                   ops are rendered indented; each material bucket gets its
                   own bold "ИТОГО ПО …" row, even when the bucket is zero,
                   so the document layout is identical regardless of which
                   buckets the estimate actually uses. */}
                <tr className="font-bold bg-amber-100">
                  <td colSpan={3} className="px-2 py-2.5">{t('f2_block_direct') || 'СВОДНЫЕ ИТОГИ ПО ПРЯМЫМ ЗАТРАТАМ'}</td>
                </tr>
                <tr>
                  <td className="pl-5 py-1.5">{t('f2_labor_costs') || 'Затраты труда рабочих-строителей'}</td><td />
                  <td className="text-right font-mono">{fmtRu(Math.round(summary.labor * 100) / 100)}</td>
                </tr>
                <tr>
                  <td className="pl-5 py-1.5">{t('f2_machine_ops') || 'Эксплуатация машин и механизмов'}</td><td />
                  <td className="text-right font-mono">{fmtRu(Math.round(summary.machines * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">{t('f2_total_construction_materials_full') || 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ И КОНСТРУКЦИИ:'}</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.standard * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">{t('f2_total_equipment') || 'ИТОГО ПО ОБОРУДОВАНИЮ:'}</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.equipment * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">{t('f2_total_cable') || 'ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:'}</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.cable * 100) / 100)}</td>
                </tr>
                <tr className="font-bold border-t border-amber-400 bg-amber-50">
                  <td className="px-2 py-2">{t('f2_total_direct_costs') || 'ИТОГО ПРЯМЫЕ ЗАТРАТЫ:'}</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.direct * 100) / 100)}</td>
                </tr>

                {/* 2. Transport & storage — matches the v23 mockup's three-line
                   pattern per material bucket:
                     • ИТОГО ПО {bucket}:                        <base>
                     •    Транспорт и складское хранение (X+Y%)  <overhead>
                     • ИТОГО ПО {bucket} С НАКРУТКАМИ:           <base + overhead>
                   Three buckets: standard, equipment, cable. Metal-
                   constructions and imported-materials накрутки were
                   retired at user request — those lines flow into the
                   standard bucket and inherit its 7% rate. */}
                <tr className="font-bold bg-amber-100">
                  <td colSpan={3} className="px-2 py-2.5">{t('f2_block_transport') || 'ТРАНСПОРТ И СКЛАДСКОЕ ХРАНЕНИЕ'}</td>
                </tr>
                {[
                  { key: 'standard',  base: t('f2_total_construction_materials')          || 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ:',         with: t('f2_total_construction_materials_with_overhead') || 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ С НАКРУТКАМИ:', split: '(5% + 2%)' },
                  { key: 'equipment', base: t('f2_total_equipment')                       || 'ИТОГО ПО ОБОРУДОВАНИЮ:',                     with: t('f2_total_equipment_with_overhead')              || 'ИТОГО ПО ОБОРУДОВАНИЮ С НАКРУТКАМИ:',             split: '(2% + 1,2%)' },
                  { key: 'cable',     base: t('f2_total_cable')                           || 'ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:', with: t('f2_total_cable_with_overhead')                  || 'ИТОГО ПО КАБЕЛЬНОЙ ПРОДУКЦИИ С НАКРУТКАМИ:',      split: '(1,5% + 2%)' },
                ].map(({ key, base, with: withMarkup, split }) => (
                  <React.Fragment key={key}>
                    <tr className="font-semibold">
                      <td className="px-2 py-1.5">{base}</td><td />
                      <td className="text-right font-mono text-orange-700">
                        {fmtRu(Math.round(summary.matByType[key] * 100) / 100)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pl-8 py-1.5 text-slate-700">
                        {t('f2_transport_storage') || 'Транспорт и складское хранение'} <span className="text-slate-400">{split}</span>
                      </td>
                      <td className="text-center text-slate-500 font-mono">{OVERHEAD_RATES.combined[key]}%</td>
                      <td className="text-right font-mono">{fmtRu(Math.round(summary.combined[key] * 100) / 100)}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="px-2 py-1.5 text-orange-700">{withMarkup}</td><td />
                      <td className="text-right font-mono text-orange-700">
                        {fmtRu(Math.round((summary.matByType[key] + summary.combined[key]) * 100) / 100)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                <tr className="font-bold border-t border-amber-400 bg-amber-50">
                  <td className="px-2 py-2">{t('f2_transport_storage_total') || 'Итого транспорт и складское хранение:'}</td>
                  <td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.combined.total * 100) / 100)}</td>
                </tr>

                {/* 3. Прочие затраты по строительству — itemised base + % input
                   + ИТОГО ПО СТРОИТЕЛЬСТВУ. Equipment is intentionally
                   excluded from the base; it gets its own line below. */}
                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">{t('f2_block_other') || '3. ПРОЧИЕ ЗАТРАТЫ ПО СТРОИТЕЛЬСТВУ'}</td></tr>
                <tr style={{ background: '#FAF6EC' }}>
                  <td colSpan={3} className="px-3 py-2 text-[10.5px] italic text-amber-900 border-b border-stone-300">
                    📋 {t('f2_other_base_hint') || 'База для прочих расходов = всё, кроме оборудования (материалы + накрутки)'}:
                  </td>
                </tr>
                {summary.labor > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ {t('f2_breakdown_labor') || 'Оплата труда рабочих'}</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.labor * 100) / 100)}</td></tr>
                )}
                {summary.machines > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ {t('f2_breakdown_machines') || 'Эксплуатация машин и механизмов'}</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.machines * 100) / 100)}</td></tr>
                )}
                {summary.matByType.standard > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ {t('f2_breakdown_materials') || 'Стройматериалы (чистая сумма)'}</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.matByType.standard * 100) / 100)}</td></tr>
                )}
                {summary.matByType.cable > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ {t('f2_breakdown_cable') || 'Кабельная продукция (чистая сумма)'}</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.matByType.cable * 100) / 100)}</td></tr>
                )}
                {summary.combined.standard > 0 && (
                  <tr><td className="pl-8 py-1 text-teal-700">└ {(t('f2_breakdown_overhead_materials') || 'Накрутка стройматериалов (транспорт+склад, {pct}%)').replace('{pct}', OVERHEAD_RATES.combined.standard)}</td><td /><td className="text-right font-mono text-teal-700">{fmtRu(Math.round(summary.combined.standard * 100) / 100)}</td></tr>
                )}
                {summary.combined.cable > 0 && (
                  <tr><td className="pl-8 py-1 text-pink-700">└ {(t('f2_breakdown_overhead_cable') || 'Накрутка кабеля (транспорт+склад, {pct}%)').replace('{pct}', OVERHEAD_RATES.combined.cable)}</td><td /><td className="text-right font-mono text-pink-700">{fmtRu(Math.round(summary.combined.cable * 100) / 100)}</td></tr>
                )}
                <tr className="font-bold" style={{ background: '#F5EFE0' }}>
                  <td className="pl-5 py-2">{t('f2_total_other_base') || 'ИТОГО БАЗА ДЛЯ ПРОЧИХ:'}</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.otherBase * 100) / 100)}</td>
                </tr>
                <tr style={{ background: 'linear-gradient(90deg,#FFF8DC 0%,#FFF4C2 100%)', borderLeft: '3px solid #D97706' }}>
                  <td className="pl-5 py-2.5 text-amber-900">
                    <strong className="text-amber-900">+ {t('f2_other_costs_label') || 'Прочие затраты производственного характера'}</strong>
                    <br />
                    <span className="text-[10px] italic text-amber-700">{t('f2_other_costs_hint') || '% от базы для прочих (применяется ТОЛЬКО к строительству)'}</span>
                  </td>
                  <td className="text-center bg-amber-50">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={otherCostsPct}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 0 && v <= 100) setOtherCostsPct(v);
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-14 text-center font-mono font-bold text-amber-900 bg-amber-50 border-2 border-amber-600 rounded outline-none px-1 py-0.5 text-[11.5px]"
                    />%
                  </td>
                  <td className="text-right font-mono font-bold text-amber-900 bg-amber-50">{fmtRu(Math.round(summary.other * 100) / 100)}</td>
                </tr>
                <tr className="font-bold bg-amber-50 border-t border-amber-400">
                  <td className="px-2 py-2.5">{t('f2_total_construction') || 'ИТОГО ПО СТРОИТЕЛЬСТВУ (база + прочие):'}</td><td /><td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.constructionTotal * 100) / 100)}</td>
                </tr>

                {/* 4. Equipment as its own line — never gets the прочие mult */}
                {summary.equipmentTotal > 0 && (
                  <>
                    <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">{t('f2_block_equipment_separate') || '4. ОБОРУДОВАНИЕ (отдельно)'}</td></tr>
                    <tr className="font-bold bg-amber-50">
                      <td className="px-2 py-2.5">{t('f2_total_equipment_separate') || 'ИТОГО ПО ОБОРУДОВАНИЮ (с накрутками, без прочих):'}</td><td /><td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.equipmentTotal * 100) / 100)}</td>
                    </tr>
                  </>
                )}

                {/* 5. Subtotal + VAT */}
                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">{t('f2_block_total_taxes') || '5. ИТОГО И НАЛОГИ'}</td></tr>
                <tr style={{ background: '#111', color: '#fff' }} className="font-bold">
                  <td className="px-2 py-3.5">{t('f2_total_before_vat') || 'ИТОГО (стройка + оборудование, до НДС):'}</td><td /><td className="text-right font-mono text-base">{fmtRu(Math.round(summary.subtotal * 100) / 100)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-900">
                      <input
                        type="checkbox"
                        checked={useVat}
                        onChange={(e) => setUseVat(e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-amber-700"
                      />
                      {t('f2_vat_full') || 'Налог на добавленную стоимость (НДС)'}
                    </label>
                    <div className="text-[10px] italic text-slate-500 ml-6 mt-0.5">
                      {useVat ? (t('f2_vat_included') || 'включён в итог') : (t('f2_vat_excluded') || 'НЕ включён в итог')}
                    </div>
                  </td>
                  <td className="text-center font-mono">{useVat ? `${VAT_PCT}%` : '—'}</td>
                  <td className={`text-right font-mono ${useVat ? '' : 'text-slate-400'}`}>{useVat ? fmtRu(Math.round(summary.vat * 100) / 100) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Grand total */}
        {sections.length > 0 && (
          <div className="mt-7 p-4 bg-slate-900 text-white flex justify-between items-center">
            <div>
              <div className="text-[11px] tracking-widest uppercase text-stone-300">
                {t('f2_grand_total') || 'ВСЕГО ПО СМЕТЕ'} ({useVat ? (t('f2_with_vat') || 'с НДС') : (t('f2_without_vat') || 'без НДС')})
              </div>
              <div className="text-[12px] text-stone-400 mt-1">
                {t('f2_sections_count') || 'Разделов'}: {sections.length} · {t('f2_other_costs') || 'Прочие расходы'}: {otherCostsPct}% ({t('f2_on_construction') || 'на стройку'}) · {t('f2_vat_label') || 'НДС'}: {useVat ? `${VAT_PCT}%` : (t('f2_vat_not_applied') || 'не применяется')}
              </div>
            </div>
            <div className="text-[22px] font-bold font-mono">{fmtRu(Math.round(summary.grand * 100) / 100)} сум</div>
          </div>
        )}

        {/* Footnote citing the regulatory basis (mockup-faithful) */}
        {sections.length > 0 && (
          <div className="mt-6 p-4 border-l-4 border-orange-700 bg-stone-50 text-[10px] text-slate-600 leading-relaxed">
            <strong className="text-orange-700">{t('f2_overhead_basis_label') || 'Основание для накруток:'}</strong> {t('f2_overhead_basis_text') || 'Письмо Госкомархитектстроя РУз № 352/11-05 от 31.01.2011 г. · Правила ШНК 4.01.16-09 (п. 4.6 и п. 5.6). Накрутка «Транспорт и складское хранение» объединяет транспортные и заготовительно-складские расходы: для обычных стройматериалов 7% (5%+2%), для оборудования 3,2% (2%+1,2%), для кабельной продукции 3,5% (1,5%+2%).'}
          </div>
        )}

        {/* Signatures */}
        {sections.length > 0 && (
          <div className="mt-7 pt-4 border-t border-stone-300 grid grid-cols-2 gap-7 text-[11px] text-slate-700">
            <div>
              <div className="text-slate-500">{t('f2_compiled_by') || 'Составил'}:</div>
              <div className="border-b border-slate-400 h-7 mt-2" />
              <div className="text-[10px] text-slate-400 mt-1">{t('f2_signature_caption') || '(подпись, Ф.И.О.)'}</div>
            </div>
            <div>
              <div className="text-slate-500">{t('f2_checked_by') || 'Проверил'}:</div>
              <div className="border-b border-slate-400 h-7 mt-2" />
              <div className="text-[10px] text-slate-400 mt-1">{t('f2_signature_caption') || '(подпись, Ф.И.О.)'}</div>
            </div>
          </div>
        )}

        {/* Legal footer */}
        {sections.length > 0 && (
          <div className="mt-6 p-3 bg-amber-50 border-l-2 border-orange-700 text-[10px] text-slate-600 leading-relaxed">
            <strong className="text-orange-800">{t('f2_overhead_basis_label') || 'Основание для накруток:'}</strong>{' '}
            {t('f2_overhead_scope_text') || 'Транспортные и заготовительно-складские расходы применяются только к обычным стройматериалам, оборудованию и кабельной продукции.'}
          </div>
        )}
      </div>

      {/* Akt № modal — replaces window.prompt() with an in-app dialog so
         the styled Form 2 preview isn't interrupted by the OS-default
         alert. Submitting (OK / Enter) triggers submitSnapshot with the
         entered number; Cancel / Esc closes without saving. */}
      {aktModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => setAktModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-[440px] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="text-[15px] font-semibold text-slate-900">
                {t('save_form2_snapshot') || 'Forma 2 ni saqlash'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('act_number_optional_hint')
                  || "Akt raqamini kiriting (ixtiyoriy). Bo'sh qoldirsa raqam tayinlanmaydi."}
              </div>
            </div>
            <div className="px-5 py-4">
              <label className="text-[11px] uppercase tracking-wider text-slate-500 block mb-1.5">
                {t('act_number_optional_prompt') || 'Akt № (ixtiyoriy):'}
              </label>
              <input
                type="text"
                value={aktNumber}
                onChange={(e) => setAktNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); submitSnapshot(aktNumber); }
                  if (e.key === 'Escape') { setAktModalOpen(false); }
                }}
                placeholder="12-2026"
                autoFocus
                className="w-full px-3 py-2.5 rounded-md text-[13px] outline-none border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAktModalOpen(false)}
                disabled={savingSnapshot}
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                size="sm"
                onClick={() => submitSnapshot(aktNumber)}
                disabled={savingSnapshot}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {t('save') || 'Saqlash'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
