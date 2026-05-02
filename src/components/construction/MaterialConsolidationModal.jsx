import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer, FileDown, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';
import { UploadFile } from '@/api/integrations';
import Loader from '@/components/ui/loader';

// MaterialConsolidationModal renders a per-block + project-wide
// aggregation of MATERIAL fakt consumption from the project's estimates.
//
// Aggregation key: (name, UOM, unit_rate). Same name+UOM with the same
// unit_rate folds into one row with summed quantity. Same name+UOM with
// DIFFERENT unit_rates produce separate rows so the user can see which
// volume came at which price. Topups (resource purchases at a new price
// after the smeta was set) appear indented under their parent group.
//
// Modes
// ─────
// Fakt only — backend returns parent.done_quantity-scaled volumes. No
// Reja toggle (per user request). The modal is designed for "what
// materials have actually been consumed and at what prices, including
// any top-up purchases that came in at a different price".
//
// Toolbar
// ───────
// Yopish · Print · Excel · Saqlash (uploads to project files)

const T = {
  title:           { uz: "Material yig'indisi",            ru: 'Сводная по материалам',         en: 'Materials consolidation' },
  subtitle:        { uz: 'Bajarilgan ishlar bo\'yicha',    ru: 'По выполненным работам',         en: 'Based on completed work' },
  block_name:      { uz: 'Blok',                            ru: 'Блок',                            en: 'Block' },
  total_block:     { uz: 'BLOK JAMI',                       ru: 'ИТОГО ПО БЛОКУ',                  en: 'BLOCK TOTAL' },
  total_project:   { uz: 'LOYIHA UMUMIY JAMI',              ru: 'ИТОГО ПО ПРОЕКТУ',                en: 'PROJECT TOTAL' },
  th_name:         { uz: 'Material nomi',                   ru: 'Наименование',                    en: 'Material' },
  th_uom:          { uz: "O'lchov",                         ru: 'Ед.',                             en: 'Unit' },
  th_qty:          { uz: 'Hajm',                            ru: 'Объём',                           en: 'Volume' },
  th_price:        { uz: 'Birlik narxi',                    ru: 'Цена',                            en: 'Unit price' },
  th_sum:          { uz: 'Summa',                           ru: 'Сумма',                           en: 'Sum' },
  topup_label:     { uz: "Qo'shimcha xarid",                ru: 'Доп. закупка',                    en: 'Top-up purchase' },
  no_data:         { uz: "Ma'lumot yo'q",                   ru: 'Нет данных',                      en: 'No data' },
  no_materials:    { uz: 'Materiallar topilmadi',           ru: 'Материалы не найдены',            en: 'No materials found' },
  print_btn:       { uz: 'Chop etish',                      ru: 'Печать',                          en: 'Print' },
  save_to_files:   { uz: 'Saqlash',                         ru: 'Сохранить',                       en: 'Save' },
  save_success:    { uz: 'Hujjatlarga saqlandi',            ru: 'Сохранено в документах',          en: 'Saved to project files' },
  save_failed:     { uz: "Saqlab bo'lmadi",                 ru: 'Не удалось сохранить',            en: 'Save failed' },
  load_failed:     { uz: "Hisobotni yuklab bo'lmadi",       ru: 'Не удалось загрузить отчет',      en: 'Failed to load report' },
};
const tt = (key, lang) => T[key]?.[lang] || T[key]?.uz || key;

const fmt = (v) => {
  if (!Number.isFinite(Number(v))) return '0';
  return Math.round(Number(v)).toLocaleString('ru-RU').replace(/,/g, ' ');
};
const fmtQty = (v) => {
  // Quantities can be fractional (m3, kg etc.) — keep up to 4 decimals,
  // strip trailing zeros so the column reads cleanly.
  const n = Number(v) || 0;
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return Number(s).toLocaleString('ru-RU').replace(/,/g, ' ');
};

export default function MaterialConsolidationModal({
  open,
  onClose,
  projectId,
  projectName: projectNameProp,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    constructionService.getMaterialConsolidationReport(projectId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        console.error('Failed to load material consolidation', e);
        toast.error(tt('load_failed', language));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId, language]);

  // Compute project grand total. The backend already provides one but
  // we recompute on the client so any UI-side filtering (future) stays
  // in sync. For now this matches the backend's `total.total_amount`.
  const projectTotal = useMemo(() => {
    if (!data) return 0;
    let sum = 0;
    for (const blk of data.blocks || []) {
      sum += Number(blk.total_amount) || 0;
    }
    return sum;
  }, [data]);

  // ─────────────── Exports ───────────────

  const handlePrint = () => {
    document.body.classList.add('matcons-printing');
    window.print();
    setTimeout(() => document.body.classList.remove('matcons-printing'), 500);
  };

  const buildXlsxBuffer = async () => {
    if (!data) return null;
    let ExcelJS;
    try {
      const mod = await import('exceljs');
      ExcelJS = mod.default || mod;
    } catch (e) {
      toast.error('ExcelJS yuklanmadi');
      return null;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Materiallar');

    // Title block
    ws.mergeCells(1, 1, 1, 5);
    ws.getCell(1, 1).value = tt('title', language).toUpperCase();
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    if (data.project?.name || data.project?.address) {
      ws.mergeCells(2, 1, 2, 5);
      ws.getCell(2, 1).value = [data.project?.name, data.project?.address].filter(Boolean).join(' — ');
      ws.getCell(2, 1).font = { italic: true };
      ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    let row = 4;
    const writeHeader = () => {
      const headers = [tt('th_name', language), tt('th_uom', language), tt('th_qty', language), tt('th_price', language), tt('th_sum', language)];
      headers.forEach((h, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        cell.border = box();
        cell.alignment = { horizontal: i === 0 ? 'left' : 'center' };
      });
      row++;
    };

    const writeBlock = (label, groups, total) => {
      // Block heading
      ws.mergeCells(row, 1, row, 5);
      ws.getCell(row, 1).value = label;
      ws.getCell(row, 1).font = { bold: true, size: 11 };
      ws.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      ws.getCell(row, 1).border = box();
      row++;
      writeHeader();
      groups.forEach((g) => {
        const r = row;
        ws.getCell(r, 1).value = g.name;
        ws.getCell(r, 2).value = g.uom;
        ws.getCell(r, 3).value = Number(g.fakt_quantity) || 0;
        ws.getCell(r, 4).value = Number(g.unit_rate) || 0;
        ws.getCell(r, 5).value = Number(g.fakt_amount) || 0;
        for (let c = 1; c <= 5; c++) {
          ws.getCell(r, c).border = box();
          if (c >= 3) {
            ws.getCell(r, c).numFmt = c === 3 ? '#,##0.####' : '#,##0';
            ws.getCell(r, c).alignment = { horizontal: 'right' };
          }
        }
        row++;
        // Topups indented
        (g.topups || []).forEach((tp) => {
          ws.getCell(row, 1).value = `   ↳ ${tt('topup_label', language)}${tp.note ? ' — ' + tp.note : ''}`;
          ws.getCell(row, 2).value = g.uom;
          ws.getCell(row, 3).value = Number(tp.extra_quantity) || 0;
          ws.getCell(row, 4).value = Number(tp.new_price) || 0;
          ws.getCell(row, 5).value = Number(tp.amount) || 0;
          for (let c = 1; c <= 5; c++) {
            ws.getCell(row, c).border = box();
            ws.getCell(row, c).font = { italic: true, color: { argb: 'FF64748B' } };
            if (c >= 3) {
              ws.getCell(row, c).numFmt = c === 3 ? '#,##0.####' : '#,##0';
              ws.getCell(row, c).alignment = { horizontal: 'right' };
            }
          }
          row++;
        });
      });
      // Block total
      ws.mergeCells(row, 1, row, 4);
      ws.getCell(row, 1).value = tt('total_block', language);
      ws.getCell(row, 1).font = { bold: true };
      ws.getCell(row, 1).alignment = { horizontal: 'right' };
      ws.getCell(row, 5).value = Number(total) || 0;
      ws.getCell(row, 5).font = { bold: true };
      ws.getCell(row, 5).numFmt = '#,##0';
      ws.getCell(row, 5).alignment = { horizontal: 'right' };
      for (let c = 1; c <= 5; c++) {
        ws.getCell(row, c).border = box();
        ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
      }
      row += 2;
    };

    (data.blocks || []).forEach((blk) => {
      writeBlock(`${tt('block_name', language)}: ${blk.name}`, blk.groups || [], blk.total_amount);
    });

    // Project total
    if (data.total) {
      writeBlock(tt('total_project', language), data.total.groups || [], data.total.total_amount);
    }

    ws.getColumn(1).width = 50;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 18;

    return await wb.xlsx.writeBuffer();
  };

  const exportXlsx = async () => {
    const buf = await buildXlsxBuffer();
    if (!buf) return;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerDownload(blob, `${filename()}.xlsx`);
  };

  const saveToProjectFiles = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const buf = await buildXlsxBuffer();
      if (!buf) { setSaving(false); return; }
      const fname = `${filename()}.xlsx`;
      const file = new File([buf], fname, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const uploaded = await UploadFile(file);
      const fileUrl = uploaded?.url || uploaded?.file_url || uploaded;
      const fileId = uploaded?.id || uploaded?.file_id || fname;
      await constructionService.createProjectFile(projectId, {
        file_id: String(fileId),
        file_url: String(fileUrl),
        filename: fname,
        file_size: file.size,
        mime_type: file.type,
        description: tt('title', language),
      });
      toast.success(tt('save_success', language));
    } catch (e) {
      console.error('Failed to save material consolidation', e);
      toast.error(tt('save_failed', language));
    } finally {
      setSaving(false);
    }
  };

  function projectNameSafe() {
    const n = data?.project?.name || projectNameProp || 'project';
    return n.replace(/[\/\\?%*:|"<>]/g, '').slice(0, 80);
  }
  function filename() {
    return `Materials-${projectNameSafe()}-Fakt`;
  }
  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function box() {
    return {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  // ─────────────── Render ───────────────

  if (!open) return null;

  const blocks = data?.blocks || [];
  const totalGroups = data?.total?.groups || [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden gap-0 flex flex-col">
        {/* Print isolation — visibility-based pattern same as Svod modal. */}
        <style>{`
          @media print {
            body.matcons-printing * { visibility: hidden !important; }
            body.matcons-printing [data-matcons-print-root],
            body.matcons-printing [data-matcons-print-root] * { visibility: visible !important; }
            body.matcons-printing [data-matcons-print-root] {
              position: absolute !important; left: 0 !important; top: 0 !important;
              width: 100% !important; height: auto !important;
              box-shadow: none !important; border: none !important;
              background: white !important;
            }
            body.matcons-printing [data-matcons-print-toolbar],
            body.matcons-printing [data-matcons-print-toolbar] * { visibility: hidden !important; display: none !important; }
            @page { size: A4 portrait; margin: 12mm; }
          }
        `}</style>

        <div data-matcons-print-root className="flex flex-col h-full bg-white min-h-0">
          {/* Toolbar */}
          <div
            data-matcons-print-toolbar
            className="flex items-center gap-2 px-4 py-3 border-b bg-white sticky top-0 z-10 flex-wrap"
          >
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4 mr-1" /> {t('close') || 'Yopish'}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> {tt('print_btn', language)}
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}>
              <FileDown className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={saveToProjectFiles}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="w-4 h-4 mr-1" /> {tt('save_to_files', language)}
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
            {loading ? (
              <Loader />
            ) : !data ? (
              <div className="text-center py-16 text-slate-400">{tt('no_data', language)}</div>
            ) : (
              <div className="max-w-[1100px] mx-auto my-6 px-6 py-6 bg-white shadow-lg">
                <div className="text-center mb-1">
                  <h1 className="font-bold text-base tracking-wide uppercase">{tt('title', language)}</h1>
                </div>
                {(data.project?.name || data.project?.address) && (
                  <div className="text-center text-sm italic text-slate-700 mb-1">
                    {[data.project?.name, data.project?.address].filter(Boolean).join(' — ')}
                  </div>
                )}
                <div className="text-center text-xs text-slate-500 mb-4">
                  {tt('subtitle', language)}
                </div>

                {/* Per-block sections */}
                {blocks.length === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-8">{tt('no_materials', language)}</div>
                ) : (
                  blocks.map((blk) => (
                    <BlockSection
                      key={blk.id}
                      label={`${tt('block_name', language)}: ${blk.name}`}
                      groups={blk.groups || []}
                      totalAmount={blk.total_amount}
                      language={language}
                      totalLabel={tt('total_block', language)}
                    />
                  ))
                )}

                {/* Project-wide total section — combines same name+UOM+price
                    across blocks, so the user gets ONE consolidated row per
                    distinct material/price tuple at the bottom. */}
                {totalGroups.length > 0 && (
                  <BlockSection
                    label={tt('total_project', language)}
                    groups={totalGroups}
                    totalAmount={projectTotal}
                    language={language}
                    totalLabel={tt('total_project', language)}
                    isProjectTotal
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── BlockSection (extracted for clarity) ───────────────
function BlockSection({ label, groups, totalAmount, language, totalLabel, isProjectTotal = false }) {
  // Defensive frontend filter — drops any group whose actually-consumed
  // quantity is zero AND has no top-up purchases. The backend already
  // filters with HAVING SUM(fakt_quantity) > 0, but we also clean up
  // here in case (a) the backend hasn't been redeployed yet, (b) the
  // user is viewing a cached response, or (c) someone hits this
  // component with manually-constructed data. Topup-only rows are
  // preserved so a material that was bought via a top-up at a new
  // price still surfaces.
  const visibleGroups = (groups || []).filter((g) => {
    const qty = Number(g.fakt_quantity) || 0;
    if (qty > 0) return true;
    const hasTopups = Array.isArray(g.topups) && g.topups.some(
      (t) => (Number(t.extra_quantity) || 0) > 0,
    );
    return hasTopups;
  });

  // If the section has nothing left after filtering AND no aggregate
  // total worth showing, hide the entire block — keeps the report
  // tight when one of the blocks has no actual consumption.
  if (visibleGroups.length === 0 && !(Number(totalAmount) > 0)) {
    return null;
  }

  return (
    <div className="mb-6">
      <div
        className={[
          'px-3 py-2 font-semibold text-sm uppercase border border-slate-300',
          isProjectTotal ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-800',
        ].join(' ')}
      >
        {label}
      </div>
      <div className="overflow-x-auto border border-t-0 border-slate-300">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-[#D9EAD3] border-b border-slate-300 text-[11px]">
              <th className="px-3 py-2 border-r border-slate-300 font-semibold text-left min-w-[280px]">{tt('th_name', language)}</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-20">{tt('th_uom', language)}</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-28 text-right">{tt('th_qty', language)}</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-32 text-right">{tt('th_price', language)}</th>
              <th className="px-3 py-2 font-semibold w-36 text-right">{tt('th_sum', language)}</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-3">—</td>
              </tr>
            ) : visibleGroups.map((g, i) => (
              <React.Fragment key={`${g.name}|${g.uom}|${g.unit_rate}|${i}`}>
                <tr className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-1.5 border-r border-slate-200">{g.name}</td>
                  <td className="px-3 py-1.5 border-r border-slate-200 text-center text-slate-600">{g.uom}</td>
                  <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono">{fmtQty(g.fakt_quantity)}</td>
                  <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono">{fmt(g.unit_rate)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{fmt(g.fakt_amount)}</td>
                </tr>
                {/* Indented topup rows under the parent material */}
                {(g.topups || []).map((tp, ti) => (
                  <tr key={`tp-${i}-${ti}`} className="border-b border-slate-100 bg-amber-50/30 italic text-slate-600">
                    <td className="px-3 py-1 border-r border-slate-200 pl-8">
                      ↳ {tt('topup_label', language)}
                      {tp.note ? <span className="ml-1 text-slate-500">— {tp.note}</span> : null}
                      {tp.ordered_at ? <span className="ml-2 text-[10px] text-slate-400">{String(tp.ordered_at).slice(0, 10)}</span> : null}
                    </td>
                    <td className="px-3 py-1 border-r border-slate-200 text-center">{g.uom}</td>
                    <td className="px-3 py-1 border-r border-slate-200 text-right font-mono">{fmtQty(tp.extra_quantity)}</td>
                    <td className="px-3 py-1 border-r border-slate-200 text-right font-mono">{fmt(tp.new_price)}</td>
                    <td className="px-3 py-1 text-right font-mono">{fmt(tp.amount)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#D9EAD3] font-semibold border-t border-slate-300">
              <td colSpan={4} className="px-3 py-2 border-r border-slate-300 text-right">{totalLabel}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
