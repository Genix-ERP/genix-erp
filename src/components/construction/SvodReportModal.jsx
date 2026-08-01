import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Printer, FileDown, Plus, Save, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { UploadFile } from '@/api/integrations';
import Loader from '@/components/ui/loader';
import { formatDate } from '@/utils/formatDate';

// SvodReportModal renders the FAKT side of the Uzbek "Сводная сметная"
// 12-line consolidated estimate (the "Жилдом Саттепо Авеню Свод.xlsx"
// layout). The backend ships per-building totals broken into four cost
// rows (R4 equipment, R5 labor, R6 machine ops, R7 materials); the modal
// layers user-editable percentages on top to derive the rest of the
// table live as the user types.
//
// User inputs (all editable in the toolbar):
//   • Прочие затраты подрядчика %  (default 18.11) — applied to R5+R6+R7
//   • Страхование %                (default 0.32)  — applied to R8+R9
//   • НДС / VAT 12%                (toggle, on by default)
//   • PQ-161 %                     (default 5)     — applied to total only
//
// Three exports: Print (window.print + @media print), Excel (ExcelJS),
// and CSV (Blob with UTF-8 BOM). Caller controls open/close via `open`.

const ROW_LABELS = {
  4: 'Затраты на оборудование, мебель и инвентарь',
  5: 'Основная з/плата рабочих строителей',
  6: 'Эксплуатация машин и механизмов',
  7: 'Строительные материалы',
  8: 'Итого прямых затрат',
  9: 'Прочие затраты подрядчика',
  10: 'Затраты на страхование строительства объектов',
  11: 'Итого',
  12: 'НДС',
  13: 'Всего стоимость строительства в текущих ценах',
  14: "PQ-161 qarori ijrosini ta'minlash harajatlari",
  15: 'Всего стоимость строительства в текущих ценах',
};

// Toolbar / UI strings that are NOT part of the printed document layout.
// The document body keeps its standard Russian labels (this is the form
// every Uzbek smetа follows and users expect to see exactly that), but
// the toolbar follows the user's selected UI language.
const TOOLBAR_T = {
  other_pct:        { uz: 'Boshqa %',         ru: 'Прочие %',       en: 'Other %' },
  insurance_pct:    { uz: "Sug'urta %",        ru: 'Страхование %',  en: 'Insurance %' },
  vat_short:        { uz: 'QQS 12%',           ru: 'НДС 12%',        en: 'VAT 12%' },
  pq_pct:           { uz: 'PQ-161 %',          ru: 'PQ-161 %',       en: 'PQ-161 %' },
  r4_manual:        { uz: "R4 qo'lda",         ru: 'R4 вручную',     en: 'R4 manual' },
  add_column:       { uz: 'Ustun',             ru: 'Столбец',        en: 'Column' },
  add_systems:      { uz: 'Tizimlar',          ru: 'Системы',        en: 'Systems' },
  print_btn:        { uz: 'Chop etish',        ru: 'Печать',         en: 'Print' },
  column_name:      { uz: "Ustun nomi",        ru: 'Имя столбца',    en: 'Column name' },
  delete_column:    { uz: "Ustunni o'chirish", ru: 'Удалить столбец',en: 'Delete column' },
  doc_subtitle:     { uz: "Bajarilgan ishlar asosida",
                      ru: 'На основе выполненных работ',
                      en: 'Based on actual completed work' },
  footnote:         { uz: "Foizlar o'zgartirilganda jadval avtomatik hisoblanadi.",
                      ru: 'При изменении процентов таблица пересчитывается автоматически.',
                      en: 'Table recalculates automatically when percentages change.' },
  period_label:     { uz: "Davr",              ru: 'Период',         en: 'Period' },
  save_to_files:    { uz: "Saqlash",           ru: 'Сохранить',      en: 'Save' },
  save_success:     { uz: "Hujjatlarga saqlandi", ru: 'Сохранено в документах', en: 'Saved to project files' },
  save_failed:      { uz: "Saqlab bo'lmadi",   ru: 'Не удалось сохранить', en: 'Save failed' },
  systems_added:    { uz: "Tizim ustunlari qo'shildi",
                      ru: 'Системные столбцы добавлены',
                      en: 'System columns added' },
  systems_existed:  { uz: "Tizim ustunlari allaqachon mavjud",
                      ru: 'Системные столбцы уже добавлены',
                      en: 'System columns already exist' },
  period_from:      { uz: "dan",               ru: 'с',              en: 'from' },
  period_to:        { uz: "gacha",             ru: 'по',             en: 'to' },
};
const tt = (key, lang) => TOOLBAR_T[key]?.[lang] || TOOLBAR_T[key]?.uz || key;

const fmt = (v) => {
  if (!Number.isFinite(v)) return '0';
  // Uzbek locale uses space-separated thousands and "," decimal — match
  // the reference xlsx exactly. Round to whole soum (no fractional).
  return Math.round(v).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function SvodReportModal({
  open,
  onClose,
  projectId,
  projectName: projectNameProp,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // User-editable percentages. STORED AS STRINGS so the user can type
  // decimals naturally — `0.`, `18.`, `0.0` would otherwise be stripped
  // back to a number on every keystroke and the input would feel broken.
  // We parse to number only when computing the table.
  const [overheadStr, setOverheadStr] = useState('18.11');
  const [insuranceStr, setInsuranceStr] = useState('0.32');
  const [useVat, setUseVat] = useState(true);

  // PQ-161 — the user can either keep the auto 5% (% mode) or type a
  // specific soum amount in the row's Всего cell (manual mode). When
  // manual mode is active, `pq161ManualStr` overrides the % calc.
  const [pq161PctStr, setPq161PctStr] = useState('5');
  const [pq161ManualStr, setPq161ManualStr] = useState('');

  // R4 (installed equipment / furniture / inventory) override.
  // Auto-computed R4 is currently 0 from the backend (we don't track
  // installed equipment in GenixERP yet); the user types the project
  // total here and we split it across blocks for display.
  const [equipmentTotalStr, setEquipmentTotalStr] = useState('');
  const [useEquipmentOverride, setUseEquipmentOverride] = useState(false);

  // Custom user-added columns — for engineering systems (Водопровод,
  // Отопление, Благоустройство...) that the project doesn't have as
  // separate buildings yet. Each column has a name and four absolute
  // values (R4..R7); rows 8..15 derive the same way as auto columns.
  // Persisted only in modal state (not posted to backend).
  const [customCols, setCustomCols] = useState([]);

  // Reporting period (optional). Both bounds are independent dates
  // (ISO YYYY-MM-DD strings). Embedded into the printed/exported file
  // header and into the saved file's filename.
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  // Saving state — when true, the Saqlash button is disabled and shows
  // a spinner so the user can't double-fire the upload.
  const [saving, setSaving] = useState(false);

  const docRef = useRef(null);

  // Fetch on open
  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    constructionService.getSvodReport(projectId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        console.error('Failed to load svod report', e);
        toast.error(t('failed_to_load_report') || 'Hisobotni yuklab bo‘lmadi');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId]);

  // Build the 12-row × N-column table. Columns: Total + one per building +
  // any custom user-added columns. Backend ships paired plan/fakt fields;
  // we pick the right side based on `mode`. R4 (equipment) defaults to the
  // auto-computed value unless the user opts into a manual override.
  const table = useMemo(() => {
    if (!data) return null;

    const buildings = Array.isArray(data.buildings) ? data.buildings : [];
    // We only ever show Fakt (the user removed the Reja/Fakt toggle).
    const pick = (b, base) => Number(b[`${base}_fakt`]) || 0;

    // Parse percentage / amount inputs from string state to number.
    const overheadPct = parseNum(overheadStr);
    const insurancePct = parseNum(insuranceStr);
    const pq161Pct = parseNum(pq161PctStr);
    const pq161Manual = parseNum(pq161ManualStr);
    const equipmentTotal = parseNum(equipmentTotalStr);

    // Manual equipment override: split evenly across blocks for display
    // and use the typed grand-total in the "Всего" column.
    const overrideOn = useEquipmentOverride && equipmentTotal > 0;
    const eqOverridePerBuilding = overrideOn && buildings.length > 0
      ? equipmentTotal / buildings.length
      : 0;

    // Helper that takes raw R4..R7 and derives R8..R15 with the active
    // overhead/insurance/VAT/PQ161 settings. Used for both backend
    // building columns and user-added custom columns. `applyPQ` controls
    // whether R14 (PQ-161) fills — only the Total column does.
    const derive = (r4, r5, r6, r7, applyPQ = false) => {
      const r8 = r4 + r5 + r6 + r7;
      const r9 = (r8 - r4) * (overheadPct / 100);
      const r10 = (r8 + r9) * (insurancePct / 100);
      const r11 = r8 + r9 + r10;
      const r12 = useVat ? r11 * 0.12 : 0;
      const r13 = r11 + r12;
      const r14 = applyPQ
        ? (pq161ManualStr.trim() !== '' ? pq161Manual : r13 * (pq161Pct / 100))
        : 0;
      const r15 = r13 + r14;
      return { r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15 };
    };

    // Backend building columns
    const buildingCols = buildings.map((b) => ({
      id: `b-${b.id}`,
      name: b.name,
      kind: 'building',
      ...derive(
        overrideOn ? eqOverridePerBuilding : pick(b, 'equipment'),
        pick(b, 'labor'),
        pick(b, 'machine'),
        pick(b, 'material'),
      ),
    }));

    // User-added custom columns (engineering systems, etc.)
    const customColsBuilt = customCols.map((cc) => ({
      id: `c-${cc.key}`,
      name: cc.name || '—',
      kind: 'custom',
      ...derive(parseNum(cc.r4), parseNum(cc.r5), parseNum(cc.r6), parseNum(cc.r7)),
    }));

    const cols = [...buildingCols, ...customColsBuilt];

    // Total column = sum across all columns (or override for R4).
    const sum = (key) => cols.reduce((s, c) => s + (Number(c[key]) || 0), 0);
    const total = derive(
      overrideOn ? equipmentTotal : sum('r4'),
      sum('r5'),
      sum('r6'),
      sum('r7'),
      true, // PQ-161 applies to the Total column only
    );

    return { total, cols };
  }, [
    data, overheadStr, insuranceStr, useVat, pq161PctStr, pq161ManualStr,
    equipmentTotalStr, useEquipmentOverride, customCols,
  ]);

  // ===== Export helpers =====

  const handlePrint = () => {
    // We use a class-toggle on <body> + dedicated @media print rules
    // (defined inline below) so only the document area prints. After
    // the print dialog closes the class is removed automatically.
    document.body.classList.add('svod-printing');
    window.print();
    setTimeout(() => document.body.classList.remove('svod-printing'), 500);
  };

  const exportCsv = () => {
    if (!table) return;
    const headers = ['№', 'Наименование затрат', 'Всего', ...table.cols.map((c) => c.name || '')];
    const lines = [headers.map(csvEsc).join(',')];
    for (let r = 4; r <= 15; r++) {
      const row = [
        r - 3,
        ROW_LABELS[r],
        Math.round(Number(table.total[`r${r}`]) || 0),
        // PQ-161 lives only on the total column — emit empty string
        // for all other columns to match the reference xlsx layout.
        ...table.cols.map((c) => r === 14 ? '' : Math.round(Number(c[`r${r}`]) || 0)),
      ];
      lines.push(row.map(csvEsc).join(','));
    }
    // UTF-8 BOM (U+FEFF) so Excel correctly detects the encoding and
    // doesn't mojibake Cyrillic / Uzbek-Latin column headers.
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${projectNameSafe()}-Свод.csv`);
  };

  // Build an ExcelJS workbook buffer from current table state.
  // Used by both the "Excel" download button and the "Saqlash" upload
  // flow so they produce byte-identical files.
  const buildXlsxBuffer = async () => {
    if (!table) return null;
    let ExcelJS;
    try {
      const mod = await import('exceljs');
      ExcelJS = mod.default || mod;
    } catch (e) {
      toast.error('ExcelJS yuklanmadi');
      return null;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Свод');
    const colNames = table.cols.map((c) => c.name || '');
    const totalCols = 3 + colNames.length;

    // Title block (rows 1, 2) — merged, bold.
    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell(1, 1).value = '   РЕКОМЕНДУЕМАЯ РАСЧЕТНАЯ СТОИМОСТЬ ОБЪЕКТА В ТЕКУЩИХ ЦЕНАХ';
    ws.getCell(1, 1).font = { bold: true, size: 12 };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    let nextRow = 2;
    if (data.project?.name || data.project?.address) {
      ws.mergeCells(nextRow, 1, nextRow, totalCols);
      ws.getCell(nextRow, 1).value = [data.project?.name, data.project?.address].filter(Boolean).join(' — ');
      ws.getCell(nextRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      ws.getCell(nextRow, 1).font = { italic: true };
      nextRow++;
    }

    // Period line (only if at least one bound is set).
    if (periodFrom || periodTo) {
      ws.mergeCells(nextRow, 1, nextRow, totalCols);
      const fmtDate = (d) => d ? formatDate(d) : '—';
      ws.getCell(nextRow, 1).value = `${tt('period_label', language)}: ${fmtDate(periodFrom)} — ${fmtDate(periodTo)}`;
      ws.getCell(nextRow, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(nextRow, 1).font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
      nextRow++;
    }

    const headerRow = nextRow;
    const dataStartRow = headerRow + 1;

    // Header row
    const headers = ['№ п.п', 'Наименование затрат', 'Всего', ...colNames];
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
      cell.border = boxBorder();
    });

    // Data rows (R4..R15 → 12 rows starting at dataStartRow)
    for (let r = 4; r <= 15; r++) {
      const isComputed = [8, 11, 13, 15].includes(r);
      const xlsxRow = dataStartRow + (r - 4);
      const rowVals = [
        r - 3,
        ROW_LABELS[r],
        Math.round(Number(table.total[`r${r}`]) || 0),
        ...table.cols.map((c) => r === 14 ? '' : Math.round(Number(c[`r${r}`]) || 0)),
      ];
      rowVals.forEach((val, i) => {
        const cell = ws.getCell(xlsxRow, i + 1);
        cell.value = val;
        cell.border = boxBorder();
        if (i >= 2) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        } else if (i === 0) {
          cell.alignment = { horizontal: 'center' };
        }
        if (isComputed) {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        }
      });
    }

    // Column widths
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 50;
    ws.getColumn(3).width = 18;
    for (let i = 0; i < colNames.length; i++) {
      ws.getColumn(4 + i).width = 18;
    }

    return await wb.xlsx.writeBuffer();
  };

  // Download as .xlsx
  const exportXlsx = async () => {
    const buf = await buildXlsxBuffer();
    if (!buf) return;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerDownload(blob, `${svodFilename()}.xlsx`);
  };

  // Save the same .xlsx into the project's Hujjatlar (project files)
  // via the existing /files/upload + /construction/projects/:id/files
  // pipeline. The saved file's description records the period and
  // mode so it's findable later.
  const saveToProjectFiles = async () => {
    if (!projectId) {
      toast.error(tt('save_failed', language));
      return;
    }
    setSaving(true);
    try {
      const buf = await buildXlsxBuffer();
      if (!buf) { setSaving(false); return; }
      const filename = `${svodFilename()}.xlsx`;
      const file = new File(
        [buf],
        filename,
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      );
      const uploaded = await UploadFile(file);
      const fileUrl = uploaded?.url || uploaded?.file_url || uploaded;
      const fileId = uploaded?.id || uploaded?.file_id || filename;
      const description = [
        'Свод (Fakt)',
        (periodFrom || periodTo)
          ? `${periodFrom || '—'} → ${periodTo || '—'}`
          : null,
      ].filter(Boolean).join(' · ');
      await constructionService.createProjectFile(projectId, {
        file_id: String(fileId),
        file_url: String(fileUrl),
        filename,
        file_size: file.size,
        mime_type: file.type,
        description,
      });
      toast.success(tt('save_success', language));
    } catch (e) {
      console.error('Failed to save svod', e);
      toast.error(tt('save_failed', language));
    } finally {
      setSaving(false);
    }
  };

  // Filename helper — embeds project name + period bounds + mode so
  // saved files are findable later in the Hujjatlar tab.
  function svodFilename() {
    const parts = [`Свод-${projectNameSafe()}`];
    if (periodFrom) parts.push(periodFrom);
    if (periodTo)   parts.push(periodTo);
    parts.push('Fakt');
    return parts.join('_');
  }

  // ===== Helpers =====

  function csvEsc(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function projectNameSafe() {
    const n = data?.project?.name || projectNameProp || 'project';
    return n.replace(/[\/\\?%*:|"<>]/g, '').slice(0, 80);
  }

  // ===== Render =====

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden gap-0 flex flex-col"
      >
        {/* Print rules. We use the visibility-based pattern instead of
            display:none on direct body children, because Radix Dialog
            mounts our content INSIDE a portal sibling (not as a direct
            <body> child), so the old `body > *:not(...)` selector hid
            the modal too — that's the "blank page" the user reported.
            visibility:hidden + visibility:visible re-enables only the
            print root and its descendants regardless of nesting. */}
        <style>{`
          @media print {
            body.svod-printing * { visibility: hidden !important; }
            body.svod-printing [data-svod-print-root],
            body.svod-printing [data-svod-print-root] * { visibility: visible !important; }
            body.svod-printing [data-svod-print-root] {
              position: absolute !important;
              left: 0 !important; top: 0 !important;
              width: 100% !important; height: auto !important;
              max-width: none !important; max-height: none !important;
              overflow: visible !important;
              box-shadow: none !important; border: none !important;
              background: white !important;
            }
            body.svod-printing [data-svod-print-toolbar],
            body.svod-printing [data-svod-print-toolbar] * { visibility: hidden !important; display: none !important; }
            body.svod-printing .svod-doc { padding: 0 !important; box-shadow: none !important; }
            body.svod-printing input { border: none !important; padding: 0 !important; }
            @page { size: A3 landscape; margin: 12mm; }
          }
        `}</style>

        {/* Print root — flex-col with min-h-0 so the inner scroll area
            can grow/shrink correctly inside the dialog without overflow
            being clipped by the parent. */}
        <div data-svod-print-root className="flex flex-col h-full bg-white min-h-0">
          {/* Toolbar */}
          <div
            data-svod-print-toolbar
            className="flex items-center gap-2 px-4 py-3 border-b bg-white sticky top-0 z-10 flex-wrap"
          >
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4 mr-1" /> {t('close') || 'Yopish'}
            </Button>

            <div className="flex-1" />

            {/* Period (Davr) — date range for the report header. Both
                bounds are optional. Renders into the xlsx title block
                and into the saved file's description. */}
            <div className="ml-2 inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <label className="text-xs text-slate-500">{tt('period_label', language)}:</label>
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

            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-500">{tt('other_pct', language)}</label>
              <Input
                value={overheadStr}
                onChange={(e) => setOverheadStr(sanitizeNumStr(e.target.value))}
                className="w-20 h-8 text-right font-mono text-sm"
              />
              <label className="text-xs text-slate-500 ml-2">{tt('insurance_pct', language)}</label>
              <Input
                value={insuranceStr}
                onChange={(e) => setInsuranceStr(sanitizeNumStr(e.target.value))}
                className="w-20 h-8 text-right font-mono text-sm"
              />
              <label className="ml-2 inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={useVat}
                  onChange={(e) => setUseVat(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-emerald-700"
                />
                {tt('vat_short', language)}
              </label>
              <label className="text-xs text-slate-500 ml-2">{tt('pq_pct', language)}</label>
              <Input
                value={pq161PctStr}
                onChange={(e) => setPq161PctStr(sanitizeNumStr(e.target.value))}
                disabled={pq161ManualStr.trim() !== ''}
                className="w-20 h-8 text-right font-mono text-sm disabled:opacity-50"
              />
              <label
                className="ml-2 inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={useEquipmentOverride}
                  onChange={(e) => setUseEquipmentOverride(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-emerald-700"
                />
                {tt('r4_manual', language)}
              </label>
              <Input
                value={equipmentTotalStr}
                onChange={(e) => setEquipmentTotalStr(sanitizeNumStr(e.target.value))}
                disabled={!useEquipmentOverride}
                className="w-32 h-8 text-right font-mono text-sm disabled:opacity-50"
                placeholder="0"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomCols((c) => [
                  ...c,
                  { key: Date.now() + Math.random(), name: '', r4: '', r5: '', r6: '', r7: '' },
                ])}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> {tt('add_column', language)}
              </Button>
              {/* One-click preset: creates the 3 standard engineering-system
                  columns the reference Свод xlsx ships with — Водопровод,
                  Отопление, Благоустройство. Each column starts empty and
                  the user fills in totals from their corresponding ВК / ОВ
                  / Благ xlsx file (or from imported system estimates). */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const presets = [
                    'Водопровод и Канализация',
                    'Отопление и Вентиляция',
                    'Благоустройство и озеленение',
                  ];
                  let added = 0;
                  setCustomCols((cur) => {
                    const have = new Set(cur.map((x) => (x.name || '').trim()));
                    const additions = presets
                      .filter((n) => !have.has(n))
                      .map((n, i) => ({
                        key: Date.now() + i + Math.random(),
                        name: n,
                        r4: '', r5: '', r6: '', r7: '',
                      }));
                    added = additions.length;
                    return [...cur, ...additions];
                  });
                  // User feedback so the button never feels broken — shows
                  // "added" message on first click and "already exist" on
                  // re-click after all 3 presets are in place.
                  if (added > 0) {
                    toast.success(tt('systems_added', language));
                  } else {
                    toast.info(tt('systems_existed', language));
                  }
                }}
                className="text-xs"
                title="ВК, ОВ, Благ"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> {tt('add_systems', language)}
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> {tt('print_btn', language)}
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}>
              <FileDown className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <FileDown className="w-4 h-4 mr-1" /> CSV
            </Button>
            {/* Saqlash — uploads the same .xlsx into the project's
                Hujjatlar list so it can be reopened later. Disabled
                while the request is in flight to prevent double posts. */}
            <Button
              size="sm"
              disabled={saving}
              onClick={saveToProjectFiles}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="w-4 h-4 mr-1" /> {tt('save_to_files', language)}
            </Button>
          </div>

          {/* Document body — scrollable area */}
          {/* Scrollable document area. min-h-0 is required so flex-1
              actually grants growable space inside the dialog — without
              it, flex children default to min-height: auto and the
              overflow-auto never engages, leaving the modal un-scrollable
              when content + toolbar overflow the dialog height (the bug
              the user observed once "+ Tizimlar" added system columns). */}
          <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
            {loading ? (
              <Loader />
            ) : !data ? (
              <div className="text-center py-16 text-slate-400">
                {t('no_data') || "Ma'lumot yo'q"}
              </div>
            ) : (
              <div ref={docRef} className="svod-doc max-w-[1400px] mx-auto my-6 px-6 py-6 bg-white shadow-lg">
                {/* Title */}
                <div className="text-center mb-2">
                  <h1 className="font-bold text-base tracking-wide">
                    РЕКОМЕНДУЕМАЯ РАСЧЕТНАЯ СТОИМОСТЬ ОБЪЕКТА В ТЕКУЩИХ ЦЕНАХ
                  </h1>
                </div>
                {(data.project?.name || data.project?.address) && (
                  <div className="text-center text-sm italic text-slate-700 mb-1">
                    {[data.project?.name, data.project?.address].filter(Boolean).join(' — ')}
                  </div>
                )}
                {(periodFrom || periodTo) && (
                  <div className="text-center text-xs text-slate-600 mb-1">
                    {tt('period_label', language)}: {periodFrom ? formatDate(periodFrom) : '—'}
                    {' — '}
                    {periodTo ? formatDate(periodTo) : '—'}
                  </div>
                )}
                <div className="text-center text-xs text-slate-500 mb-4">
                  {tt('doc_subtitle', language)}
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-300">
                  <table className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr className="bg-[#D9EAD3] border-b border-slate-300">
                        <th className="px-2 py-2 border-r border-slate-300 font-semibold w-12">№ п.п</th>
                        <th className="px-3 py-2 border-r border-slate-300 font-semibold text-left min-w-[280px]">Наименование затрат</th>
                        <th className="px-3 py-2 border-r border-slate-300 font-semibold w-32">Всего</th>
                        {table?.cols?.map((c, idx) => (
                          <th
                            key={c.id}
                            className="px-2 py-2 border-r border-slate-300 font-semibold w-28 align-top"
                          >
                            {c.kind === 'custom' ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={customCols.find((x) => `c-${x.key}` === c.id)?.name || ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setCustomCols((cur) => cur.map((x) =>
                                      `c-${x.key}` === c.id ? { ...x, name: v } : x
                                    ));
                                  }}
                                  placeholder={tt('column_name', language)}
                                  className="w-full text-xs px-1 py-0.5 border border-slate-300 rounded font-semibold print:border-0 print:p-0"
                                />
                                <button
                                  type="button"
                                  data-svod-print-toolbar
                                  onClick={() => setCustomCols((cur) =>
                                    cur.filter((x) => `c-${x.key}` !== c.id)
                                  )}
                                  className="text-slate-400 hover:text-red-500 text-xs print:hidden"
                                  title={tt('delete_column', language)}
                                >×</button>
                              </div>
                            ) : (
                              c.name
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((r) => {
                        const isSummary = [8, 11, 13, 15].includes(r);
                        const isVat = r === 12;
                        const isPq = r === 14;
                        const label = ROW_LABELS[r];
                        // Inline percentage in the label rows that depend on them.
                        // Labels reflect the CURRENT input string so user sees their
                        // change reflected immediately, even mid-typing decimals.
                        let labelText = label;
                        if (r === 9)  labelText += ` - ${overheadStr || '0'}%`;
                        else if (r === 10) labelText += ` - ${insuranceStr || '0'}%`;
                        else if (r === 12) labelText += ` - 12%`;

                        // Total cell behavior depends on row:
                        //   • PQ-161 row (R14): editable input — user can type
                        //     an absolute soum amount; empty string falls back
                        //     to the auto % calc.
                        //   • Other rows: read-only display.
                        const totalCell = isPq ? (
                          <td className="px-2 py-1 border-r border-slate-300 text-right">
                            <NumCell
                              value={pq161ManualStr}
                              onChange={setPq161ManualStr}
                              placeholder={fmt(table?.total?.r14) || '0'}
                            />
                          </td>
                        ) : (
                          <td className="px-3 py-2 border-r border-slate-300 text-right font-mono">
                            {(isVat && !useVat) ? '0' : fmt(table?.total?.[`r${r}`])}
                          </td>
                        );

                        return (
                          <tr
                            key={r}
                            className={[
                              'border-b border-slate-300',
                              isSummary ? 'bg-[#D9EAD3] font-bold' : '',
                            ].join(' ')}
                          >
                            <td className="px-2 py-2 border-r border-slate-300 text-center">{r - 3}</td>
                            <td className="px-3 py-2 border-r border-slate-300">{labelText}</td>
                            {totalCell}
                            {table?.cols?.map((c) => {
                              // Custom columns let the user type R4..R7 values
                              // directly; derived rows (R8..R15) and PQ row are read-only.
                              const customEditableRow = c.kind === 'custom' && r >= 4 && r <= 7;
                              const cc = c.kind === 'custom'
                                ? customCols.find((x) => `c-${x.key}` === c.id)
                                : null;
                              const fieldKey = `r${r}`;

                              if (customEditableRow && cc) {
                                return (
                                  <td key={c.id} className="px-2 py-1 border-r border-slate-300">
                                    <NumCell
                                      value={cc[fieldKey] || ''}
                                      onChange={(v) => setCustomCols((cur) => cur.map((x) =>
                                        x.key === cc.key ? { ...x, [fieldKey]: v } : x
                                      ))}
                                      placeholder="0"
                                    />
                                  </td>
                                );
                              }
                              return (
                                <td key={c.id} className="px-3 py-2 border-r border-slate-300 text-right font-mono">
                                  {/* PQ-161 row exists only on the total column. */}
                                  {isPq ? '' : ((isVat && !useVat) ? '0' : fmt(c[`r${r}`]))}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footnote */}
                <div className="text-[11px] text-slate-500 mt-3 italic print:hidden">
                  {tt('footnote', language)}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// NumCell — uniform editable amount cell used inside the Свод table.
// Shows the value formatted with thousands separators when blurred so
// big numbers stay readable, and switches to raw digits while focused
// so the user can edit naturally without separator-induced cursor jumps.
function NumCell({ value, onChange, placeholder = '0' }) {
  const [focused, setFocused] = useState(false);
  const display = focused
    ? value
    : (value === '' || value == null
        ? ''
        : (Number.isFinite(parseNum(value))
            ? Math.round(parseNum(value)).toLocaleString('ru-RU').replace(/,/g, ' ')
            : value));
  return (
    <input
      type="text"
      value={display}
      onChange={(e) => onChange(sanitizeNumStr(e.target.value))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className="w-full h-8 px-2 text-right font-mono text-[12px] bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 print:border-0 print:p-0 print:bg-transparent"
    />
  );
}

// sanitizeNumStr — accept what the user types but reject obviously-bad
// characters. Lets `12.`, `0.`, `.5`, comma decimals, and intermediate
// states through unchanged so React inputs feel natural while typing
// decimals. We parse to number only when computing the table.
function sanitizeNumStr(raw) {
  let s = String(raw).replace(',', '.');
  // Strip everything that's not a digit, dot, or minus
  s = s.replace(/[^\d.\-]/g, '');
  // Collapse multiple dots — keep only the first
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  // Drop minus unless it's the leading char (no negatives anyway)
  s = s.replace(/-/g, '');
  return s;
}

// parseNum — string → number. Empty / invalid → 0.
function parseNum(s) {
  if (s == null) return 0;
  const v = Number(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}

function boxBorder() {
  return {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
  };
}
