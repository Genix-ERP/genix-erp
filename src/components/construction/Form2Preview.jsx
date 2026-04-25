import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, FileDown, X, Save, Calendar } from 'lucide-react';

// Form2Preview — print-ready ФОРМА № 2 (KS-2 / ВОР) document.
//
// Updated to v23 mockup (Form2_Works_v23_prochie_breakdown.html). Math now
// matches the current Госкомархитектстрой Письмо № 352/11-05 (31.01.2011)
// and ШНК 4.01.16-09 interpretation:
//
//   1. Direct costs       = Σ labor + Σ machines + Σ materials_by_type (5)
//   2. Combined overhead  = Σ matByType × combined_rate per material type
//                           (standard 7%, equipment 3.2%, cable 3.5%,
//                            metal 0%, import 0%) — replaces the old
//                           split transport+storage breakdown for the
//                           summary roll-up.
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
  transport: { standard: 5.0, equipment: 2.0, cable: 1.5, metal: 5.0,  import: 2.0 },
  storage:   { standard: 2.0, equipment: 1.2, cable: 2.0, metal: 0.75, import: 2.0 },
  combined:  { standard: 7.0, equipment: 3.2, cable: 3.5, metal: 5.75, import: 4.0 },
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
  metal: 'metall',
  import: 'import',
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
  if (['standard', 'equipment', 'cable', 'metal', 'import'].includes(mt)) return mt;
  return 'standard';
}

function getOverheadRate(line) {
  if (classifyResource(line) !== 'material') return 0;
  const t = getMaterialType(line);
  // v23 uses the combined transport+storage rate per material type
  // (standard 7%, equipment 3.2%, cable 3.5%, metal 0%, import 0%).
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
    const price = Number(r.unit_rate || 0);
    const qty = Number(r.quantity || 0);
    const b = price * qty;
    if (b <= 0) continue;
    base += b;
    overhead += b * getOverheadRate(r);
  }
  // If a work has NO sub-lines, its own total_amount IS the base.
  if (subLines.length === 0 && work) {
    base = Number(work.total_amount || 0);
  }
  return { base, overhead, total: base + overhead };
}

function buildSummary(lines, otherCostsPct, useVat) {
  let labor = 0, machines = 0;
  const matByType = { standard: 0, equipment: 0, cable: 0, metal: 0, import: 0 };

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
    const cost = Number(ln.unit_rate || 0) * Number(ln.quantity || 0);
    if (cost <= 0) continue;
    const cat = classifyResource(ln);
    if (cat === 'labor') labor += cost;
    else if (cat === 'equipment') machines += cost;
    else matByType[getMaterialType(ln)] += cost;
  }

  const matTotal = Object.values(matByType).reduce((a, b) => a + b, 0);
  const direct = labor + machines + matTotal;

  // Combined transport+storage overhead per material type — full set of
  // five buckets per Госкомархитектстрой 352/12-05. Earlier versions
  // zeroed metal/import; the regulatory letter actually defines them as
  // 5.75% (5% + 0.75%) and 4% (2% + 2%) respectively.
  const combined = {
    standard:  matByType.standard  * OVERHEAD_RATES.combined.standard  / 100,
    equipment: matByType.equipment * OVERHEAD_RATES.combined.equipment / 100,
    cable:     matByType.cable     * OVERHEAD_RATES.combined.cable     / 100,
    metal:     matByType.metal     * OVERHEAD_RATES.combined.metal     / 100,
    import:    matByType.import    * OVERHEAD_RATES.combined.import    / 100,
  };
  combined.total = combined.standard + combined.equipment + combined.cable
                 + combined.metal + combined.import;

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
    const cur = bySection.get(key) || { name: key, items: [], total: 0 };
    cur.items.push({ work: ln, qty, subs, brutto: wb });
    cur.total += wb.total;
    bySection.set(key, cur);
  }
  return Array.from(bySection.values());
}

export default function Form2Preview({ estimate, lines, project, onClose, onSaveSnapshot }) {
  const [otherCostsPct, setOtherCostsPct] = useState(0);
  // VAT is now a boolean toggle (matches v23 mockup) — when on, the fixed
  // 12% rate is added to the subtotal; when off, the grand total stops at
  // the subtotal. The percentage itself isn't user-editable any more.
  const [useVat, setUseVat] = useState(true);
  // Reporting period (давр) — user-editable date range that prints in the
  // document header and travels with the saved snapshot. Both fields are
  // optional so the doc can still be generated without a fixed window.
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const sections = useMemo(() => buildSections(lines || []), [lines]);
  const summary = useMemo(() => buildSummary(lines || [], otherCostsPct, useVat), [lines, otherCostsPct, useVat]);
  const today = new Date().toLocaleDateString('ru-RU');

  // Pretty-printed period for the document header and CSV export.
  const periodLabel = (() => {
    if (!periodFrom && !periodTo) return '';
    const fmtD = (s) => (s ? new Date(s).toLocaleDateString('ru-RU') : '…');
    return `${fmtD(periodFrom)} — ${fmtD(periodTo)}`;
  })();

  const exportCsv = () => {
    const rows = [];
    rows.push(['ФОРМА № 2 — ЛОКАЛЬНЫЙ РЕСУРСНЫЙ СМЕТНЫЙ РАСЧЁТ']);
    if (project?.name) rows.push([project.name]);
    rows.push(['Дата составления:', today]);
    if (periodLabel) rows.push(['Период:', periodLabel]);
    rows.push([]);
    rows.push(['№', 'Шифр', 'Наименование', 'Раздел', 'Ед.изм.', 'Кол-во', 'Цена', 'Сумма с накр.']);
    let num = 0;
    for (const sec of sections) {
      let secTotal = 0;
      for (const it of sec.items) {
        num++;
        const { work, qty, subs, brutto } = it;
        const pricePerUnit = qty > 0 ? brutto.total / qty : 0;
        rows.push([num, work.code || '', work.name || '', sec.name, work.uom || '', qty, Math.round(pricePerUnit * 100) / 100, Math.round(brutto.total * 100) / 100]);
        for (const r of subs) {
          if (isSubStage(r)) {
            const stageTotal = Number(r.total_amount || 0);
            if (stageTotal <= 0) continue;
            rows.push(['', 'ДОП.', '    ДОП. ' + (r.name || ''), '', r.uom || '', r.quantity || 0, r.unit_rate || 0, Math.round(stageTotal * 100) / 100]);
            continue;
          }
          const cost = Number(r.unit_rate || 0) * Number(r.quantity || 0);
          if (cost <= 0) continue;
          rows.push(['', CAT_COLORS[classifyResource(r)]?.name || '', '    ' + (r.name || ''), '', r.uom || '', r.quantity || 0, r.unit_rate || 0, Math.round(cost * 100) / 100]);
        }
        secTotal += brutto.total;
      }
      rows.push(['', '', `ИТОГО по разделу "${sec.name}":`, '', '', '', '', Math.round(secTotal * 100) / 100]);
    }
    rows.push([]);
    rows.push(['', '', `ВСЕГО ПО СМЕТЕ (${summary.useVat ? 'с НДС' : 'без НДС'}):`, '', '', '', '', Math.round(summary.grand * 100) / 100]);

    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Forma2_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="form2-preview-wrap">
      {/* Toolbar (hidden in print). Wraps onto two rows on narrower screens
         so all controls — period range, Прочие %, НДС toggle, Print, CSV,
         Save — stay reachable without horizontal scroll. */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white sticky top-0 z-10 print:hidden flex-wrap">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Yopish
          </Button>
        )}
        <div className="flex-1" />
        {/* Period (давр) — date range that prints in the doc header
           and travels with any saved snapshot. Both bounds optional. */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <label className="text-xs text-slate-500">Давр:</label>
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
          <label className="text-xs text-slate-500">Прочие %</label>
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
            НДС {VAT_PCT}%
          </label>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Chop etish
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
            onClick={async () => {
              // Optional Akt number — Foreman may type "12-2026" / "001/2026"
              // / etc. Empty string = no act assigned.
              const actNumber = (window.prompt('Akt № (ixtiyoriy):', '') || '').trim();
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
                    })),
                  },
                });
              } finally {
                setSavingSnapshot(false);
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4 mr-1" /> Saqlash
          </Button>
        )}
      </div>

      {/* Document body — light theme to match a printed page */}
      <div className="form2-doc max-w-[1100px] mx-auto my-6 p-10 bg-white text-slate-900 shadow-lg rounded">
        <div className="text-center mb-6 pb-4 border-b-2 border-slate-900">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Локальный ресурсный сметный расчёт</div>
          <div className="text-[22px] font-bold text-slate-900">ФОРМА № 2</div>
          {project?.name && <div className="text-sm text-slate-700 mt-2">{project.name}</div>}
          <div className="flex justify-between mt-3 text-xs text-slate-600 flex-wrap gap-2">
            {project?.building_name && (
              <div><span className="text-slate-400">Объект:</span> <strong className="text-slate-800">{project.building_name}</strong></div>
            )}
            <div><span className="text-slate-400">Дата составления:</span> <strong className="text-slate-800">{today}</strong></div>
            {periodLabel && (
              <div><span className="text-slate-400">Период:</span> <strong className="text-slate-800">{periodLabel}</strong></div>
            )}
            <div><span className="text-slate-400">Версия сметы:</span> <strong className="text-slate-800">v{estimate?.version || 1}</strong></div>
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-lg mb-2">📋 Форма 2 пустая</div>
            <div className="text-xs">Введите объёмы работ и Форма 2 заполнится автоматически</div>
          </div>
        ) : (
          (() => {
            let globalNum = 0;
            return sections.map((sec, i) => (
              <div key={sec.name} className="mt-5">
                <div className="bg-amber-50 border-l-4 border-orange-700 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 mb-0.5">
                  Раздел {ROMAN[i] || (i + 1)}. {sec.name}
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[50px]">№</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[100px]">Шифр</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700">Наименование</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[75px]">Ед.изм.</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[85px]">Кол-во</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[105px]">Цена, сум</th>
                      <th className="bg-amber-100 border border-amber-400 px-1.5 py-2 text-[10px] font-semibold text-slate-700 w-[135px]">Сумма с накр.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map(({ work, qty, subs, brutto }) => {
                      globalNum++;
                      const pricePerUnit = qty > 0 ? brutto.total / qty : 0;
                      return (
                        <React.Fragment key={work.id}>
                          <tr style={{ background: '#F8F4E8', borderTop: '2px solid #999' }}>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-center text-[12px] font-bold">{globalNum}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 font-mono text-[10px] font-semibold">{work.code || ''}</td>
                            <td className="border border-stone-300 px-2 py-1.5 font-semibold text-slate-900">{work.name}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-center font-semibold">{work.uom || ''}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-right font-mono font-semibold">{fmtRu(qty)}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-right font-mono font-semibold">{fmtRu(Math.round(pricePerUnit * 100) / 100)}</td>
                            <td className="border border-stone-300 px-1.5 py-1.5 text-right font-mono font-bold text-orange-700">{fmtRu(Math.round(brutto.total * 100) / 100)}</td>
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
                            if (base <= 0) return null;
                            const rate = getOverheadRate(r);
                            const overhead = base * rate;
                            const total = base + overhead;
                            const cat = classifyResource(r);
                            const cfg = CAT_COLORS[cat];
                            const mt = cat === 'material' ? getMaterialType(r) : null;
                            return (
                              <tr key={r.id} style={{ background: '#FDFBF5' }}>
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
                                  {rate > 0 ? (
                                    <>
                                      <div className="font-semibold">{fmtRu(Math.round(total * 100) / 100)}</div>
                                      <div className="text-[9px] text-slate-400">{fmtRu(Math.round(base * 100) / 100)} + {(rate * 100).toFixed(1)}%</div>
                                    </>
                                  ) : (
                                    <span>{fmtRu(Math.round(base * 100) / 100)}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    <tr style={{ background: '#FAF6EC', fontWeight: 700 }}>
                      <td className="border border-amber-300 px-2 py-2" colSpan={6} style={{ textAlign: 'right' }}>
                        ИТОГО по разделу {ROMAN[i] || (i + 1)} (с транспортом и складом):
                      </td>
                      <td className="border border-amber-300 px-2 py-2 text-right font-mono text-orange-700">
                        {fmtRu(Math.round(sec.total * 100) / 100)}
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
              Сводный расчёт сметной стоимости
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
                  <td colSpan={3} className="px-2 py-2.5">СВОДНЫЕ ИТОГИ ПО ПРЯМЫМ ЗАТРАТАМ</td>
                </tr>
                <tr>
                  <td className="pl-5 py-1.5">Затраты труда рабочих-строителей</td><td />
                  <td className="text-right font-mono">{fmtRu(Math.round(summary.labor * 100) / 100)}</td>
                </tr>
                <tr>
                  <td className="pl-5 py-1.5">Эксплуатация машин и механизмов</td><td />
                  <td className="text-right font-mono">{fmtRu(Math.round(summary.machines * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ И КОНСТРУКЦИИ:</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.standard * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">ИТОГО ПО ОБОРУДОВАНИЮ:</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.equipment * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.cable * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">ИТОГО ПО МЕТАЛЛОКОНСТРУКЦИЯМ:</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.metal * 100) / 100)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">ИТОГО ПО ИМПОРТНЫМ МАТЕРИАЛАМ:</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.matByType.import * 100) / 100)}</td>
                </tr>
                <tr className="font-bold border-t border-amber-400 bg-amber-50">
                  <td className="px-2 py-2">ИТОГО ПРЯМЫЕ ЗАТРАТЫ:</td><td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.direct * 100) / 100)}</td>
                </tr>

                {/* 2. Transport & storage — matches the v23 mockup's three-line
                   pattern per material bucket:
                     • ИТОГО ПО {bucket}:                        <base>
                     •    Транспорт и складское хранение (X+Y%)  <overhead>
                     • ИТОГО ПО {bucket} С НАКРУТКАМИ:           <base + overhead>
                   Always rendered for all five regulated buckets so the
                   document carries the regulatory structure intact even when
                   a particular bucket has no resources. */}
                <tr className="font-bold bg-amber-100">
                  <td colSpan={3} className="px-2 py-2.5">ТРАНСПОРТ И СКЛАДСКОЕ ХРАНЕНИЕ</td>
                </tr>
                {[
                  { key: 'standard',  base: 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ:',                with: 'ИТОГО ПО СТРОИТЕЛЬНЫМ МАТЕРИАЛАМ С НАКРУТКАМИ:',                split: '(5% + 2%)' },
                  { key: 'equipment', base: 'ИТОГО ПО ОБОРУДОВАНИЮ:',                            with: 'ИТОГО ПО ОБОРУДОВАНИЮ С НАКРУТКАМИ:',                            split: '(2% + 1,2%)' },
                  { key: 'cable',     base: 'ИТОГО ПО КАБЕЛЬНО-ПРОВОДНИКОВОЙ ПРОДУКЦИИ:',        with: 'ИТОГО ПО КАБЕЛЬНОЙ ПРОДУКЦИИ С НАКРУТКАМИ:',                     split: '(1,5% + 2%)' },
                  { key: 'metal',     base: 'ИТОГО ПО МЕТАЛЛОКОНСТРУКЦИЯМ:',                     with: 'ИТОГО ПО МЕТАЛЛОКОНСТРУКЦИЯМ С НАКРУТКАМИ:',                    split: '(5% + 0,75%)' },
                  { key: 'import',    base: 'ИТОГО ПО ИМПОРТНЫМ МАТЕРИАЛАМ:',                    with: 'ИТОГО ПО ИМПОРТНЫМ МАТЕРИАЛАМ С НАКРУТКАМИ:',                   split: '(2% + 2%)' },
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
                        Транспорт и складское хранение <span className="text-slate-400">{split}</span>
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
                  <td className="px-2 py-2">Итого транспорт и складское хранение:</td>
                  <td />
                  <td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.combined.total * 100) / 100)}</td>
                </tr>

                {/* 3. Прочие затраты по строительству — itemised base + % input
                   + ИТОГО ПО СТРОИТЕЛЬСТВУ. Equipment is intentionally
                   excluded from the base; it gets its own line below. */}
                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">3. ПРОЧИЕ ЗАТРАТЫ ПО СТРОИТЕЛЬСТВУ</td></tr>
                <tr style={{ background: '#FAF6EC' }}>
                  <td colSpan={3} className="px-3 py-2 text-[10.5px] italic text-amber-900 border-b border-stone-300">
                    📋 База для прочих расходов = всё, кроме оборудования (материалы + накрутки):
                  </td>
                </tr>
                {summary.labor > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ Оплата труда рабочих</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.labor * 100) / 100)}</td></tr>
                )}
                {summary.machines > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ Эксплуатация машин и механизмов</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.machines * 100) / 100)}</td></tr>
                )}
                {summary.matByType.standard > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ Стройматериалы (чистая сумма)</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.matByType.standard * 100) / 100)}</td></tr>
                )}
                {summary.matByType.cable > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ Кабельная продукция (чистая сумма)</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.matByType.cable * 100) / 100)}</td></tr>
                )}
                {summary.matByType.metal > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ Металлоконструкции</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.matByType.metal * 100) / 100)}</td></tr>
                )}
                {summary.matByType.import > 0 && (
                  <tr><td className="pl-8 py-1 text-slate-600">└ Импортные материалы</td><td /><td className="text-right font-mono text-slate-600">{fmtRu(Math.round(summary.matByType.import * 100) / 100)}</td></tr>
                )}
                {summary.combined.standard > 0 && (
                  <tr><td className="pl-8 py-1 text-teal-700">└ Накрутка стройматериалов (транспорт+склад, {OVERHEAD_RATES.combined.standard}%)</td><td /><td className="text-right font-mono text-teal-700">{fmtRu(Math.round(summary.combined.standard * 100) / 100)}</td></tr>
                )}
                {summary.combined.cable > 0 && (
                  <tr><td className="pl-8 py-1 text-pink-700">└ Накрутка кабеля (транспорт+склад, {OVERHEAD_RATES.combined.cable}%)</td><td /><td className="text-right font-mono text-pink-700">{fmtRu(Math.round(summary.combined.cable * 100) / 100)}</td></tr>
                )}
                <tr className="font-bold" style={{ background: '#F5EFE0' }}>
                  <td className="pl-5 py-2">ИТОГО БАЗА ДЛЯ ПРОЧИХ:</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.otherBase * 100) / 100)}</td>
                </tr>
                <tr style={{ background: 'linear-gradient(90deg,#FFF8DC 0%,#FFF4C2 100%)', borderLeft: '3px solid #D97706' }}>
                  <td className="pl-5 py-2.5 text-amber-900">
                    <strong className="text-amber-900">+ Прочие затраты производственного характера</strong>
                    <br />
                    <span className="text-[10px] italic text-amber-700">% от базы для прочих (применяется ТОЛЬКО к строительству)</span>
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
                  <td className="px-2 py-2.5">ИТОГО ПО СТРОИТЕЛЬСТВУ (база + прочие):</td><td /><td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.constructionTotal * 100) / 100)}</td>
                </tr>

                {/* 4. Equipment as its own line — never gets the прочие mult */}
                {summary.equipmentTotal > 0 && (
                  <>
                    <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">4. ОБОРУДОВАНИЕ (отдельно)</td></tr>
                    <tr className="font-bold bg-amber-50">
                      <td className="px-2 py-2.5">ИТОГО ПО ОБОРУДОВАНИЮ (с накрутками, без прочих):</td><td /><td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.equipmentTotal * 100) / 100)}</td>
                    </tr>
                  </>
                )}

                {/* 5. Subtotal + VAT */}
                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">5. ИТОГО И НАЛОГИ</td></tr>
                <tr style={{ background: '#111', color: '#fff' }} className="font-bold">
                  <td className="px-2 py-3.5">ИТОГО (стройка + оборудование, до НДС):</td><td /><td className="text-right font-mono text-base">{fmtRu(Math.round(summary.subtotal * 100) / 100)}</td>
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
                      Налог на добавленную стоимость (НДС)
                    </label>
                    <div className="text-[10px] italic text-slate-500 ml-6 mt-0.5">
                      {useVat ? 'включён в итог' : 'НЕ включён в итог'}
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
                ВСЕГО ПО СМЕТЕ ({useVat ? 'с НДС' : 'без НДС'})
              </div>
              <div className="text-[12px] text-stone-400 mt-1">
                Разделов: {sections.length} · Прочие расходы: {otherCostsPct}% (на стройку) · НДС: {useVat ? `${VAT_PCT}%` : 'не применяется'}
              </div>
            </div>
            <div className="text-[22px] font-bold font-mono">{fmtRu(Math.round(summary.grand * 100) / 100)} сум</div>
          </div>
        )}

        {/* Footnote citing the regulatory basis (mockup-faithful) */}
        {sections.length > 0 && (
          <div className="mt-6 p-4 border-l-4 border-orange-700 bg-stone-50 text-[10px] text-slate-600 leading-relaxed">
            <strong className="text-orange-700">Основание для накруток:</strong> Письмо Госкомархитектстроя РУз № 352/11-05 от 31.01.2011 г. · Правила ШНК 4.01.16-09 (п. 4.6 и п. 5.6). Накрутка «Транспорт и складское хранение» объединяет транспортные и заготовительно-складские расходы: для обычных стройматериалов 7% (5%+2%), для оборудования 3,2% (2%+1,2%), для кабельной продукции 3,5% (1,5%+2%). На металлоконструкции и импортные материалы — по согласованию с заказчиком.
          </div>
        )}

        {/* Signatures */}
        {sections.length > 0 && (
          <div className="mt-7 pt-4 border-t border-stone-300 grid grid-cols-2 gap-7 text-[11px] text-slate-700">
            <div>
              <div className="text-slate-500">Составил:</div>
              <div className="border-b border-slate-400 h-7 mt-2" />
              <div className="text-[10px] text-slate-400 mt-1">(подпись, Ф.И.О.)</div>
            </div>
            <div>
              <div className="text-slate-500">Проверил:</div>
              <div className="border-b border-slate-400 h-7 mt-2" />
              <div className="text-[10px] text-slate-400 mt-1">(подпись, Ф.И.О.)</div>
            </div>
          </div>
        )}

        {/* Legal footer */}
        {sections.length > 0 && (
          <div className="mt-6 p-3 bg-amber-50 border-l-2 border-orange-700 text-[10px] text-slate-600 leading-relaxed">
            <strong className="text-orange-800">Основание для накруток:</strong> Письмо Госкомархитектстроя РУз № 352/11-05 от 31.01.2011 г. · Правила ШНК 4.01.16-09 (п. 4.6 и п. 5.6).
            Транспортные и заготовительно-складские расходы применяются только к обычным стройматериалам, оборудованию и кабельной продукции.
            На металлоконструкции и импортные материалы — по согласованию с заказчиком.
          </div>
        )}
      </div>
    </div>
  );
}
