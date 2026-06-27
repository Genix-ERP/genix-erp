import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Printer, FileDown, Save, ChevronDown } from 'lucide-react';
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
  all_blocks:      { uz: 'Hamma bloklar',                   ru: 'Все блоки',                       en: 'All blocks' },
  all_blocks_hint: { uz: 'Bloklar bo\'yicha bo\'linmasdan, bitta jadvalda ko\'rsatish',
                     ru: 'Показать всё в одной таблице без разделения по блокам',
                     en: 'Show everything in a single table instead of splitting by block' },
  blocks_label:    { uz: 'Bloklar',                          ru: 'Блоки',                           en: 'Blocks' },
  blocks_count:    { uz: '{n}/{m}',                          ru: '{n}/{m}',                         en: '{n}/{m}' },
  select_all:      { uz: 'Hammasi',                          ru: 'Все',                             en: 'All' },
  select_none:     { uz: 'Hech qaysi',                       ru: 'Никакие',                         en: 'None' },
  no_blocks_picked:{ uz: 'Hech qaysi blok tanlanmagan',      ru: 'Не выбрано ни одного блока',     en: 'No blocks selected' },
};
const tt = (key, lang) => T[key]?.[lang] || T[key]?.uz || key;

const fmt = (v) => {
  if (!Number.isFinite(Number(v))) return '0';
  return Math.round(Number(v)).toLocaleString('ru-RU').replace(/,/g, ' ');
};
const fmtQty = (v) => {
  // Quantities can be fractional (m3, kg etc.) — keep up to 4 decimals,
  // strip trailing zeros so the column reads cleanly.
  //
  // ru-RU formats decimals with a comma ("0,333") and uses a
  // non-breaking space as the thousand separator. Earlier we did
  // `.replace(/,/g, ' ')` to "normalise" thousand separators — but that
  // ALSO clobbered the decimal comma, rendering "0,333" as "0 333".
  // Only the NBSP needs swapping for a regular space.
  const n = Number(v) || 0;
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return Number(s).toLocaleString('ru-RU').replace(/ /g, ' ');
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
  // When true, hide the per-block tables and show ONLY the project-wide
  // consolidated table. The backend already returns `data.total.groups`
  // pre-merged across blocks, so the toggle is a render-side switch
  // with no extra fetch.
  const [allBlocks, setAllBlocks] = useState(false);

  // Per-block selection — Set of block ids included in the display/exports.
  // Defaults to "all blocks selected" on each fresh load. The user can
  // narrow it down via the Bloklar dropdown so the printed/Excel report
  // only carries the subset they care about.
  const [selectedBlockIds, setSelectedBlockIds] = useState(() => new Set());
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const blockPickerRef = useRef(null);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    constructionService.getMaterialConsolidationReport(projectId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Seed the selection with every block returned. Falls back to an
        // empty set if no blocks (then no per-block sections render and
        // the picker disables itself).
        const ids = new Set();
        for (const b of (d?.blocks || [])) {
          if (b?.id != null) ids.add(Number(b.id));
        }
        setSelectedBlockIds(ids);
      })
      .catch((e) => {
        console.error('Failed to load material consolidation', e);
        toast.error(tt('load_failed', language));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId, language]);

  // Close the block picker on outside-click. Pointerdown so the close
  // fires before any click inside the toolbar re-toggles state.
  useEffect(() => {
    if (!blockPickerOpen) return;
    const handler = (e) => {
      if (blockPickerRef.current && !blockPickerRef.current.contains(e.target)) {
        setBlockPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [blockPickerOpen]);

  // Blocks the user has actually opted-in to. When `selectedBlockIds` is
  // empty (e.g. user deselected everything) we render nothing for the
  // per-block sections but keep the toolbar usable — the empty-state
  // message tells them to pick at least one.
  const filteredBlocks = useMemo(() => {
    if (!data) return [];
    return (data.blocks || []).filter((b) => selectedBlockIds.has(Number(b.id)));
  }, [data, selectedBlockIds]);

  // Re-aggregate the project-wide totals from the SELECTED blocks only.
  // Same grouping key the backend uses: (name, UOM, unit_rate). Top-ups
  // attached to each block-group are carried over so the indented price
  // breakdown stays intact across blocks.
  const filteredTotalGroups = useMemo(() => {
    if (filteredBlocks.length === 0) return [];
    const keyOf = (name, uom, rate) =>
      `${String(name || '').trim().toLowerCase()}|${String(uom || '').trim().toLowerCase()}|${Number(rate) || 0}`;
    const buckets = new Map();
    for (const blk of filteredBlocks) {
      for (const g of (blk.groups || [])) {
        const k = keyOf(g.name, g.uom, g.unit_rate);
        if (!buckets.has(k)) {
          buckets.set(k, {
            name: g.name,
            uom: g.uom,
            unit_rate: Number(g.unit_rate) || 0,
            fakt_quantity: 0,
            fakt_amount: 0,
            topups: [],
          });
        }
        const cur = buckets.get(k);
        cur.fakt_quantity += Number(g.fakt_quantity) || 0;
        cur.fakt_amount += Number(g.fakt_amount) || 0;
        if (Array.isArray(g.topups)) {
          for (const tp of g.topups) cur.topups.push(tp);
        }
      }
    }
    return Array.from(buckets.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }),
    );
  }, [filteredBlocks]);

  // Compute project grand total over the selected blocks. Previously
  // summed across every block returned by the backend; we now respect
  // the user's per-block selection so the bottom-of-report total matches
  // the visible sections.
  const projectTotal = useMemo(() => {
    let sum = 0;
    for (const blk of filteredBlocks) {
      sum += Number(blk.total_amount) || 0;
    }
    return sum;
  }, [filteredBlocks]);

  // "All blocks" view: keep same material at the SAME price as one row
  // (sum quantities across blocks), but DIFFERENT prices stay as a
  // hierarchical breakdown — the row with the largest quantity at its
  // price becomes the "main" line, every other (name, UOM, price)
  // variant is demoted into a topup-style indented sub-row beneath it.
  // Any explicit backend topups are carried over so the hierarchy
  // mirrors the per-block view: one main row per material, with each
  // distinct purchase price visible underneath.
  //
  // Sourced from filteredTotalGroups so the per-block selection
  // narrows the consolidated table as well.
  const mergedTotalGroups = useMemo(() => {
    const src = filteredTotalGroups;
    if (src.length === 0) return [];

    const keyOf = (name, uom) =>
      `${String(name || '').trim().toLowerCase()}|${String(uom || '').trim().toLowerCase()}`;

    // Bucket source groups by (name, UOM) so different-price variants
    // of the same material land together.
    const byKey = new Map();
    for (const g of src) {
      const k = keyOf(g.name, g.uom);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(g);
    }

    const result = [];
    for (const list of byKey.values()) {
      if (list.length === 1) {
        // Single price variant — keep the backend row exactly as is so
        // its own topups (e.g. real top-up purchases) still render.
        result.push(list[0]);
        continue;
      }
      // Multiple price variants — pick the largest-quantity row as
      // the main line. The rest become topup-style sub-rows so the
      // user still sees each distinct price under the parent.
      const sorted = [...list].sort(
        (a, b) => (Number(b.fakt_quantity) || 0) - (Number(a.fakt_quantity) || 0)
      );
      const main = sorted[0];
      const extraTopups = [];
      for (let i = 1; i < sorted.length; i++) {
        const r = sorted[i];
        extraTopups.push({
          extra_quantity: r.fakt_quantity,
          new_price:      r.unit_rate,
          amount:         r.fakt_amount,
          note:           '',
          ordered_at:     null,
        });
        // Preserve r's own topups too, so nothing in the hierarchy is
        // lost when the variant is demoted under `main`.
        for (const tp of r.topups || []) extraTopups.push(tp);
      }
      result.push({
        ...main,
        topups: [...(main.topups || []), ...extraTopups],
      });
    }

    // Stable alphabetical order for a tidy report.
    result.sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );
    return result;
  }, [filteredTotalGroups]);

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

    // Title block — 6 columns wide now (added № column).
    ws.mergeCells(1, 1, 1, 6);
    ws.getCell(1, 1).value = tt('title', language).toUpperCase();
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    if (data.project?.name || data.project?.address) {
      ws.mergeCells(2, 1, 2, 6);
      ws.getCell(2, 1).value = [data.project?.name, data.project?.address].filter(Boolean).join(' — ');
      ws.getCell(2, 1).font = { italic: true };
      ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    let row = 4;
    const writeHeader = () => {
      // 6 columns: №, Name, UOM, Qty, Price, Sum.
      const headers = ['№', tt('th_name', language), tt('th_uom', language), tt('th_qty', language), tt('th_price', language), tt('th_sum', language)];
      headers.forEach((h, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        cell.border = box();
        cell.alignment = { horizontal: i === 0 || i === 2 ? 'center' : i === 1 ? 'left' : 'right' };
      });
      row++;
    };

    const writeBlock = (label, groups, total) => {
      // Block heading
      ws.mergeCells(row, 1, row, 6);
      ws.getCell(row, 1).value = label;
      ws.getCell(row, 1).font = { bold: true, size: 11 };
      ws.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      ws.getCell(row, 1).border = box();
      row++;
      writeHeader();
      groups.forEach((g, idx) => {
        const r = row;
        ws.getCell(r, 1).value = idx + 1;
        ws.getCell(r, 2).value = g.name;
        ws.getCell(r, 3).value = g.uom;
        ws.getCell(r, 4).value = Number(g.fakt_quantity) || 0;
        ws.getCell(r, 5).value = Number(g.unit_rate) || 0;
        ws.getCell(r, 6).value = Number(g.fakt_amount) || 0;
        for (let c = 1; c <= 6; c++) {
          ws.getCell(r, c).border = box();
          if (c === 1) {
            ws.getCell(r, c).alignment = { horizontal: 'center' };
          } else if (c >= 4) {
            ws.getCell(r, c).numFmt = c === 4 ? '#,##0.####' : '#,##0';
            ws.getCell(r, c).alignment = { horizontal: 'right' };
          }
        }
        row++;
        // Topups indented
        (g.topups || []).forEach((tp) => {
          ws.getCell(row, 1).value = '';
          ws.getCell(row, 2).value = `   ↳ ${tt('topup_label', language)}${tp.note ? ' — ' + tp.note : ''}`;
          ws.getCell(row, 3).value = g.uom;
          ws.getCell(row, 4).value = Number(tp.extra_quantity) || 0;
          ws.getCell(row, 5).value = Number(tp.new_price) || 0;
          ws.getCell(row, 6).value = Number(tp.amount) || 0;
          for (let c = 1; c <= 6; c++) {
            ws.getCell(row, c).border = box();
            ws.getCell(row, c).font = { italic: true, color: { argb: 'FF64748B' } };
            if (c >= 4) {
              ws.getCell(row, c).numFmt = c === 4 ? '#,##0.####' : '#,##0';
              ws.getCell(row, c).alignment = { horizontal: 'right' };
            }
          }
          row++;
        });
      });
      // Block total
      ws.mergeCells(row, 1, row, 5);
      ws.getCell(row, 1).value = tt('total_block', language);
      ws.getCell(row, 1).font = { bold: true };
      ws.getCell(row, 1).alignment = { horizontal: 'right' };
      ws.getCell(row, 6).value = Number(total) || 0;
      ws.getCell(row, 6).font = { bold: true };
      ws.getCell(row, 6).numFmt = '#,##0';
      ws.getCell(row, 6).alignment = { horizontal: 'right' };
      for (let c = 1; c <= 6; c++) {
        ws.getCell(row, c).border = box();
        ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
      }
      row += 2;
    };

    // Match the on-screen toggle AND the per-block selection: when
    // "All blocks" is on, the Excel file contains ONLY the consolidated
    // project table — with same material merged across the SELECTED
    // blocks AND price variations. When off, it includes the per-block
    // breakdown (selected blocks only) followed by the project total
    // re-aggregated from the same selection.
    if (allBlocks) {
      if (mergedTotalGroups.length > 0) {
        writeBlock(tt('total_project', language), mergedTotalGroups, projectTotal);
      }
    } else {
      filteredBlocks.forEach((blk) => {
        writeBlock(`${tt('block_name', language)}: ${blk.name}`, blk.groups || [], blk.total_amount);
      });
      if (filteredTotalGroups.length > 0) {
        writeBlock(tt('total_project', language), filteredTotalGroups, projectTotal);
      }
    }

    ws.getColumn(1).width = 5;   // №
    ws.getColumn(2).width = 50;  // Material nomi
    ws.getColumn(3).width = 10;  // O'lchov
    ws.getColumn(4).width = 14;  // Hajm
    ws.getColumn(5).width = 14;  // Birlik narxi
    ws.getColumn(6).width = 18;  // Summa

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
  // Per-block picker helpers — used by the dropdown in the toolbar.
  const toggleBlock = (id) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllBlocks = () => {
    const ids = new Set();
    for (const b of blocks) if (b?.id != null) ids.add(Number(b.id));
    setSelectedBlockIds(ids);
  };
  const clearAllBlocks = () => setSelectedBlockIds(new Set());

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

            {/* Per-block selection — popover with checkboxes for each
               block. Drives display + print + Excel + Save. Defaults to
               every block checked; user can narrow down to publish a
               single block's materials or any subset. */}
            <div ref={blockPickerRef} className="relative ml-2">
              <button
                type="button"
                onClick={() => setBlockPickerOpen((v) => !v)}
                disabled={blocks.length === 0}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <span>{tt('blocks_label', language)}</span>
                <span className="font-mono text-xs text-slate-500">
                  {tt('blocks_count', language)
                    .replace('{n}', String(selectedBlockIds.size))
                    .replace('{m}', String(blocks.length))}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {blockPickerOpen && blocks.length > 0 && (
                <div
                  className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-lg w-64 max-h-80 overflow-auto"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 sticky top-0 bg-white">
                    <button
                      type="button"
                      onClick={selectAllBlocks}
                      className="text-xs text-emerald-700 hover:text-emerald-800"
                    >
                      {tt('select_all', language)}
                    </button>
                    <button
                      type="button"
                      onClick={clearAllBlocks}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      {tt('select_none', language)}
                    </button>
                  </div>
                  <ul className="py-1">
                    {blocks.map((b) => {
                      const id = Number(b.id);
                      const checked = selectedBlockIds.has(id);
                      return (
                        <li key={id}>
                          <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleBlock(id)}
                            />
                            <span className="flex-1 truncate" title={b.name || ''}>{b.name || `#${id}`}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

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

                {/* When "All blocks" is OFF: per-block sections (filtered to
                    the user's block selection) + project total underneath.
                    When ON: render ONLY the project-wide consolidated table —
                    same name+UOM+price merged across the SELECTED blocks. */}
                {selectedBlockIds.size === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-8">{tt('no_blocks_picked', language)}</div>
                ) : allBlocks ? (
                  mergedTotalGroups.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 py-8">{tt('no_materials', language)}</div>
                  ) : (
                    <BlockSection
                      label={tt('total_project', language)}
                      groups={mergedTotalGroups}
                      totalAmount={projectTotal}
                      language={language}
                      totalLabel={tt('total_project', language)}
                      isProjectTotal
                    />
                  )
                ) : (
                  <>
                    {filteredBlocks.length === 0 ? (
                      <div className="text-center text-sm text-slate-500 py-8">{tt('no_materials', language)}</div>
                    ) : (
                      filteredBlocks.map((blk) => (
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
                        across the SELECTED blocks, so the user gets ONE
                        consolidated row per distinct material/price tuple at
                        the bottom of the report. */}
                    {filteredTotalGroups.length > 0 && (
                      <BlockSection
                        label={tt('total_project', language)}
                        groups={filteredTotalGroups}
                        totalAmount={projectTotal}
                        language={language}
                        totalLabel={tt('total_project', language)}
                        isProjectTotal
                      />
                    )}
                  </>
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
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-10 text-center">№</th>
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
                <td colSpan={6} className="text-center text-slate-400 py-3">—</td>
              </tr>
            ) : visibleGroups.map((g, i) => (
              <React.Fragment key={`${g.name}|${g.uom}|${g.unit_rate}|${i}`}>
                <tr className={['border-b border-slate-200', g.subcontractor ? 'bg-orange-50/60 hover:bg-orange-50' : 'hover:bg-slate-50'].join(' ')}>
                  <td className="px-3 py-1.5 border-r border-slate-200 text-center text-slate-500 font-mono">{i + 1}</td>
                  <td className="px-3 py-1.5 border-r border-slate-200">
                    {g.name}
                    {g.subcontractor && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 align-middle">
                        {g.subcontractor}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 border-r border-slate-200 text-center text-slate-600">{g.uom}</td>
                  <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono">{fmtQty(g.fakt_quantity)}</td>
                  <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono">{fmt(g.unit_rate)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{fmt(g.fakt_amount)}</td>
                </tr>
                {/* Indented topup rows under the parent material */}
                {(g.topups || []).map((tp, ti) => (
                  <tr key={`tp-${i}-${ti}`} className="border-b border-slate-100 bg-amber-50/30 italic text-slate-600">
                    <td className="px-3 py-1 border-r border-slate-200" />
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
              <td colSpan={5} className="px-3 py-2 border-r border-slate-300 text-right">{totalLabel}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
