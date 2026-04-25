import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, FileDown, X } from 'lucide-react';

// Form2Preview — print-ready ФОРМА № 2 (KS-2 / ВОР) document.
//
// Faithful port of files/Form2_Works_v2 (7).html → renderForm2() and
// calcForm2Totals(). Implements the official accounting math per
// Госкомархитектстрой Письмо № 352/11-05 (31.01.2011) и ШНК 4.01.16-09:
//
//   1. Direct costs    = Σ labor + Σ machines + Σ materials_by_type (5)
//   2. Transport       = Σ matByType × transport_rate
//                        (standard 5%, equipment 2%, cable 1.5%, metal 0%, import 0%)
//   3. Storage         = Σ matByType × storage_rate
//                        (standard 2%, equipment 1.2%, cable 2%, metal 0%, import 0%)
//   4. Other costs     = (direct − equipment + transport_non_eq + storage_non_eq) × otherCostsPct%
//                        (note: equipment is *excluded* from the "other costs" base)
//   5. Subtotal        = direct + transport + storage + other
//   6. VAT             = subtotal × 12%
//   7. Grand total     = subtotal + VAT
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
  // % per Госкомархитектстрой 352/11-05
  transport: { standard: 5.0, equipment: 2.0, cable: 1.5, metal: 0, import: 0 },
  storage:   { standard: 2.0, equipment: 1.2, cable: 2.0, metal: 0, import: 0 },
};
const VAT_PCT_DEFAULT = 12;

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
  return (OVERHEAD_RATES.transport[t] + OVERHEAD_RATES.storage[t]) / 100;
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

function buildSummary(lines, otherCostsPct, vatPct) {
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

  const transport = {
    standard: matByType.standard * OVERHEAD_RATES.transport.standard / 100,
    equipment: matByType.equipment * OVERHEAD_RATES.transport.equipment / 100,
    cable: matByType.cable * OVERHEAD_RATES.transport.cable / 100,
    metal: 0, import: 0,
  };
  transport.total = transport.standard + transport.equipment + transport.cable;

  const storage = {
    standard: matByType.standard * OVERHEAD_RATES.storage.standard / 100,
    equipment: matByType.equipment * OVERHEAD_RATES.storage.equipment / 100,
    cable: matByType.cable * OVERHEAD_RATES.storage.cable / 100,
    metal: 0, import: 0,
  };
  storage.total = storage.standard + storage.equipment + storage.cable;

  // "Other costs" base excludes equipment line (per the source mockup).
  const otherBase =
    direct - matByType.equipment + (transport.total - transport.equipment) + (storage.total - storage.equipment);
  const other = otherBase * (Number(otherCostsPct) || 0) / 100;

  const subtotal = direct + transport.total + storage.total + other;
  const vat = subtotal * (Number(vatPct) || 0) / 100;
  const grand = subtotal + vat;

  return { labor, machines, matByType, matTotal, direct, transport, storage, other, otherBase, subtotal, vat, grand };
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

export default function Form2Preview({ estimate, lines, project, onClose }) {
  const [otherCostsPct, setOtherCostsPct] = useState(0);
  const [vatPct, setVatPct] = useState(VAT_PCT_DEFAULT);

  const sections = useMemo(() => buildSections(lines || []), [lines]);
  const summary = useMemo(() => buildSummary(lines || [], otherCostsPct, vatPct), [lines, otherCostsPct, vatPct]);
  const today = new Date().toLocaleDateString('ru-RU');

  const exportCsv = () => {
    const rows = [];
    rows.push(['ФОРМА № 2 — ЛОКАЛЬНЫЙ РЕСУРСНЫЙ СМЕТНЫЙ РАСЧЁТ']);
    if (project?.name) rows.push([project.name]);
    rows.push(['Дата составления:', today]);
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
    rows.push(['', '', 'ВСЕГО ПО СМЕТЕ (с НДС):', '', '', '', '', Math.round(summary.grand * 100) / 100]);

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
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white sticky top-0 z-10 print:hidden">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Yopish
          </Button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Прочие %</label>
          <Input
            value={otherCostsPct}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0 && v <= 100) setOtherCostsPct(v);
            }}
            className="w-20 h-8 text-right font-mono text-sm"
          />
          <label className="text-xs text-slate-500 ml-2">НДС %</label>
          <Input
            value={vatPct}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0 && v <= 100) setVatPct(v);
            }}
            className="w-16 h-8 text-right font-mono text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Chop etish
        </Button>
        <Button size="sm" onClick={exportCsv}>
          <FileDown className="w-4 h-4 mr-1" /> CSV yuklab olish
        </Button>
      </div>

      {/* Document body — light theme to match a printed page */}
      <div className="form2-doc max-w-[1100px] mx-auto my-6 p-10 bg-white text-slate-900 shadow-lg rounded">
        <div className="text-center mb-6 pb-4 border-b-2 border-slate-900">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Локальный ресурсный сметный расчёт</div>
          <div className="text-[22px] font-bold text-slate-900">ФОРМА № 2</div>
          {project?.name && <div className="text-sm text-slate-700 mt-2">{project.name}</div>}
          <div className="flex justify-between mt-3 text-xs text-slate-600">
            {project?.building_name && (
              <div><span className="text-slate-400">Объект:</span> <strong className="text-slate-800">{project.building_name}</strong></div>
            )}
            <div><span className="text-slate-400">Дата составления:</span> <strong className="text-slate-800">{today}</strong></div>
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

        {/* Summary block — overheads + VAT (per Госкомархитектстрой 352/11-05) */}
        {sections.length > 0 && (
          <div className="mt-8 p-6 bg-stone-50 border border-stone-300 rounded">
            <div className="text-sm font-bold uppercase tracking-wide pb-3 border-b-2 border-slate-900 mb-4">
              Сводный расчёт сметной стоимости
            </div>

            <table className="w-full text-[12px]">
              <tbody>
                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">1. ПРЯМЫЕ ЗАТРАТЫ</td></tr>
                <tr><td className="pl-5 py-1.5">Заработная плата</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.labor * 100) / 100)}</td></tr>
                <tr><td className="pl-5 py-1.5">Эксплуатация машин и механизмов</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.machines * 100) / 100)}</td></tr>
                {summary.matByType.standard > 0 && (
                  <tr><td className="pl-5 py-1.5">Материалы — обычные стройматериалы</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.matByType.standard * 100) / 100)}</td></tr>
                )}
                {summary.matByType.metal > 0 && (
                  <tr><td className="pl-5 py-1.5">Материалы — металлоконструкции</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.matByType.metal * 100) / 100)}</td></tr>
                )}
                {summary.matByType.import > 0 && (
                  <tr><td className="pl-5 py-1.5">Материалы — импортные</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.matByType.import * 100) / 100)}</td></tr>
                )}
                {summary.matByType.equipment > 0 && (
                  <tr><td className="pl-5 py-1.5">Оборудование</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.matByType.equipment * 100) / 100)}</td></tr>
                )}
                {summary.matByType.cable > 0 && (
                  <tr><td className="pl-5 py-1.5">Кабельно-проводниковая продукция</td><td /><td className="text-right font-mono">{fmtRu(Math.round(summary.matByType.cable * 100) / 100)}</td></tr>
                )}
                <tr className="font-bold border-t border-amber-400 bg-amber-50">
                  <td className="px-2 py-2">Итого прямые затраты:</td><td /><td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.direct * 100) / 100)}</td>
                </tr>

                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">2. ТРАНСПОРТНЫЕ РАСХОДЫ</td></tr>
                {summary.matByType.standard > 0 && (
                  <tr><td className="pl-5 py-1.5">Обычные стройматериалы</td><td className="text-center text-slate-500 font-mono">{OVERHEAD_RATES.transport.standard}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.transport.standard * 100) / 100)}</td></tr>
                )}
                {summary.matByType.equipment > 0 && (
                  <tr><td className="pl-5 py-1.5">Оборудование</td><td className="text-center text-slate-500 font-mono">{OVERHEAD_RATES.transport.equipment}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.transport.equipment * 100) / 100)}</td></tr>
                )}
                {summary.matByType.cable > 0 && (
                  <tr><td className="pl-5 py-1.5">Кабельно-проводниковая продукция</td><td className="text-center text-slate-500 font-mono">{OVERHEAD_RATES.transport.cable}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.transport.cable * 100) / 100)}</td></tr>
                )}
                <tr className="font-bold border-t border-amber-400 bg-amber-50">
                  <td className="px-2 py-2">Итого транспортные расходы:</td><td /><td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.transport.total * 100) / 100)}</td>
                </tr>

                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">3. ЗАГОТОВИТЕЛЬНО-СКЛАДСКИЕ РАСХОДЫ</td></tr>
                {summary.matByType.standard > 0 && (
                  <tr><td className="pl-5 py-1.5">Обычные стройматериалы</td><td className="text-center text-slate-500 font-mono">{OVERHEAD_RATES.storage.standard}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.storage.standard * 100) / 100)}</td></tr>
                )}
                {summary.matByType.equipment > 0 && (
                  <tr><td className="pl-5 py-1.5">Оборудование</td><td className="text-center text-slate-500 font-mono">{OVERHEAD_RATES.storage.equipment}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.storage.equipment * 100) / 100)}</td></tr>
                )}
                {summary.matByType.cable > 0 && (
                  <tr><td className="pl-5 py-1.5">Кабельно-проводниковая продукция</td><td className="text-center text-slate-500 font-mono">{OVERHEAD_RATES.storage.cable}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.storage.cable * 100) / 100)}</td></tr>
                )}
                <tr className="font-bold border-t border-amber-400 bg-amber-50">
                  <td className="px-2 py-2">Итого заготовительно-складские:</td><td /><td className="text-right font-mono text-orange-700">{fmtRu(Math.round(summary.storage.total * 100) / 100)}</td>
                </tr>

                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">4. ПРОЧИЕ ЗАТРАТЫ (на всё кроме оборудования)</td></tr>
                <tr><td className="pl-5 py-1.5">Прочие затраты производственного характера</td><td className="text-center font-mono text-orange-700">{otherCostsPct}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.other * 100) / 100)}</td></tr>

                <tr style={{ background: '#111', color: '#fff' }} className="font-bold">
                  <td className="px-2 py-3.5">ИТОГО С НАКРУТКАМИ:</td><td /><td className="text-right font-mono text-base">{fmtRu(Math.round(summary.subtotal * 100) / 100)}</td>
                </tr>
                <tr className="font-bold bg-amber-100"><td colSpan={3} className="px-2 py-2.5">5. НАЛОГ НА ДОБАВЛЕННУЮ СТОИМОСТЬ</td></tr>
                <tr><td className="pl-5 py-1.5">НДС</td><td className="text-center font-mono">{vatPct}%</td><td className="text-right font-mono">{fmtRu(Math.round(summary.vat * 100) / 100)}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Grand total */}
        {sections.length > 0 && (
          <div className="mt-7 p-4 bg-slate-900 text-white flex justify-between items-center">
            <div>
              <div className="text-[11px] tracking-widest uppercase text-stone-300">ВСЕГО ПО СМЕТЕ (с НДС)</div>
              <div className="text-[12px] text-stone-400 mt-1">
                Разделов: {sections.length} · Прочие: {otherCostsPct}% · НДС: {vatPct}%
              </div>
            </div>
            <div className="text-[22px] font-bold font-mono">{fmtRu(Math.round(summary.grand * 100) / 100)} сум</div>
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
