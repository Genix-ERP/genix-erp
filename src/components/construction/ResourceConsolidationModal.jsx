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

// ResourceConsolidationModal renders a per-block + project-wide aggregation of
// the PLANNED NORMA quantities of resources (materials, equipment, labor) from
// a project's estimates. The user picks which blocks AND which resource types
// to include. NORMA quantity = sum of each resource sub-line's planned quantity
// (parent_qty × norm) across all sections of the selected blocks.

const T = {
  title:           { uz: 'Resurslar normasi',               ru: 'Нормы ресурсов',                  en: 'Resource norms' },
  subtitle:        { uz: 'Reja (NORMA) bo\'yicha',          ru: 'По плану (НОРМА)',                en: 'By plan (NORMA)' },
  block_name:      { uz: 'Blok',                            ru: 'Блок',                            en: 'Block' },
  total_block:     { uz: 'BLOK JAMI',                       ru: 'ИТОГО ПО БЛОКУ',                  en: 'BLOCK TOTAL' },
  total_project:   { uz: 'LOYIHA UMUMIY JAMI',              ru: 'ИТОГО ПО ПРОЕКТУ',                en: 'PROJECT TOTAL' },
  th_type:         { uz: 'Turi',                            ru: 'Тип',                             en: 'Type' },
  th_name:         { uz: 'Resurs nomi',                     ru: 'Наименование',                    en: 'Resource' },
  th_uom:          { uz: "O'lchov",                         ru: 'Ед.',                             en: 'Unit' },
  th_qty:          { uz: 'NORMA',                            ru: 'НОРМА',                           en: 'NORMA' },
  th_price:        { uz: 'Birlik narxi',                    ru: 'Цена',                            en: 'Unit price' },
  th_sum:          { uz: 'Summa',                           ru: 'Сумма',                           en: 'Sum' },
  no_data:         { uz: "Ma'lumot yo'q",                   ru: 'Нет данных',                      en: 'No data' },
  no_rows:         { uz: 'Resurslar topilmadi',             ru: 'Ресурсы не найдены',              en: 'No resources found' },
  print_btn:       { uz: 'Chop etish',                      ru: 'Печать',                          en: 'Print' },
  save_to_files:   { uz: 'Saqlash',                         ru: 'Сохранить',                       en: 'Save' },
  save_success:    { uz: 'Hujjatlarga saqlandi',            ru: 'Сохранено в документах',          en: 'Saved to project files' },
  save_failed:     { uz: "Saqlab bo'lmadi",                 ru: 'Не удалось сохранить',            en: 'Save failed' },
  load_failed:     { uz: "Hisobotni yuklab bo'lmadi",       ru: 'Не удалось загрузить отчет',      en: 'Failed to load report' },
  blocks_label:    { uz: 'Bloklar',                          ru: 'Блоки',                           en: 'Blocks' },
  types_label:     { uz: 'Resurs turi',                      ru: 'Тип ресурса',                     en: 'Resource type' },
  count_fmt:       { uz: '{n}/{m}',                          ru: '{n}/{m}',                         en: '{n}/{m}' },
  select_all:      { uz: 'Hammasi',                          ru: 'Все',                             en: 'All' },
  select_none:     { uz: 'Hech qaysi',                       ru: 'Никакие',                         en: 'None' },
  no_blocks_picked:{ uz: 'Hech qaysi blok tanlanmagan',      ru: 'Не выбрано ни одного блока',     en: 'No blocks selected' },
  no_types_picked: { uz: 'Hech qaysi tur tanlanmagan',       ru: 'Не выбран ни один тип',          en: 'No types selected' },
  t_material:      { uz: 'Material',                          ru: 'Материал',                        en: 'Material' },
  t_cable:         { uz: 'Kabel',                             ru: 'Кабель',                          en: 'Cable' },
  t_installed:     { uz: 'Uskuna',                            ru: 'Оборудование',                    en: 'Equipment' },
  t_equipment:     { uz: 'Mexanizm',                          ru: 'Машины/Механизмы',                en: 'Machinery' },
  t_labor:         { uz: 'Mehnat',                            ru: 'Трудозатраты',                    en: 'Labor' },
  transport_pct:   { uz: 'Transport %',                       ru: 'Транспорт %',                     en: 'Transport %' },
  transport_label: { uz: 'Transport xarajatlari',            ru: 'Транспортные расходы',            en: 'Transport costs' },
  total_with_transport: { uz: 'JAMI (transport bilan)',       ru: 'ИТОГО (с транспортом)',           en: 'TOTAL (with transport)' },
};
const tt = (key, lang) => T[key]?.[lang] || T[key]?.uz || key;
const RES_TYPES = ['material', 'cable', 'installed', 'equipment', 'labor'];
// Default transport-overhead percentages by resource type. Materials 5%,
// cable 1.5%, оборудование 2% (Госкомархитектстрой norms); machines & labour
// carry no transport. Editable in the modal so projects with other rates fit.
const DEFAULT_TRANSPORT_PCT = { material: 5, cable: 1.5, installed: 2, equipment: 0, labor: 0 };
// Transport amount for a set of groups given a percentage map.
const transportOf = (groups, pct) =>
  (groups || []).reduce((s, g) => s + (Number(g.norma_amount) || 0) * ((Number(pct?.[g.type]) || 0) / 100), 0);
const typeLabel = (type, lang) => tt(`t_${type}`, lang);

const fmt = (v) => {
  if (!Number.isFinite(Number(v))) return '0';
  return Math.round(Number(v)).toLocaleString('ru-RU').replace(/,/g, ' ');
};
const fmtQty = (v) => {
  const n = Number(v) || 0;
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return Number(s).toLocaleString('ru-RU');
};

export default function ResourceConsolidationModal({ open, onClose, projectId, projectName: projectNameProp }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  // Editable transport-overhead percentages (added to the totals, not to the
  // resource rows themselves) so the modal matches the Excel Свод.
  const [transportPct, setTransportPct] = useState(DEFAULT_TRANSPORT_PCT);

  const [selectedBlockIds, setSelectedBlockIds] = useState(() => new Set());
  const [selectedTypes, setSelectedTypes] = useState(() => new Set(RES_TYPES));
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const blockPickerRef = useRef(null);
  const typePickerRef = useRef(null);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    constructionService.getResourceConsolidationReport(projectId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const ids = new Set();
        for (const b of (d?.blocks || [])) { if (b?.id != null) ids.add(Number(b.id)); }
        setSelectedBlockIds(ids);
        setSelectedTypes(new Set(RES_TYPES));
      })
      .catch((e) => {
        console.error('Failed to load resource consolidation', e);
        toast.error(tt('load_failed', language));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId, language]);

  useEffect(() => {
    if (!blockPickerOpen && !typePickerOpen) return;
    const handler = (e) => {
      if (blockPickerRef.current && !blockPickerRef.current.contains(e.target)) setBlockPickerOpen(false);
      if (typePickerRef.current && !typePickerRef.current.contains(e.target)) setTypePickerOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [blockPickerOpen, typePickerOpen]);

  const typeOk = (g) => selectedTypes.has(g.type);

  // Blocks the user opted into, each with rows filtered to the selected types.
  const filteredBlocks = useMemo(() => {
    if (!data) return [];
    return (data.blocks || [])
      .filter((b) => selectedBlockIds.has(Number(b.id)))
      .map((b) => ({ ...b, groups: (b.groups || []).filter(typeOk) }))
      .map((b) => ({ ...b, total_amount: b.groups.reduce((s, g) => s + (Number(g.norma_amount) || 0), 0) }));
  }, [data, selectedBlockIds, selectedTypes]);

  // Project total re-aggregated across selected blocks on (type,name,uom,rate).
  const totalGroups = useMemo(() => {
    const keyOf = (g) => `${g.type}|${String(g.name || '').trim().toLowerCase()}|${String(g.uom || '').trim().toLowerCase()}|${Number(g.unit_rate) || 0}`;
    const buckets = new Map();
    for (const blk of filteredBlocks) {
      for (const g of (blk.groups || [])) {
        const k = keyOf(g);
        if (!buckets.has(k)) {
          buckets.set(k, { type: g.type, name: g.name, uom: g.uom, unit_rate: Number(g.unit_rate) || 0, norma_quantity: 0, norma_amount: 0 });
        }
        const cur = buckets.get(k);
        cur.norma_quantity += Number(g.norma_quantity) || 0;
        cur.norma_amount += Number(g.norma_amount) || 0;
      }
    }
    return Array.from(buckets.values()).sort((a, b) =>
      RES_TYPES.indexOf(a.type) - RES_TYPES.indexOf(b.type) ||
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
  }, [filteredBlocks]);

  const projectTotal = useMemo(
    () => filteredBlocks.reduce((s, b) => s + (Number(b.total_amount) || 0), 0),
    [filteredBlocks]);

  // When every block is selected, show ONE combined table instead of splitting
  // per block — the user wants the whole-project roll-up in that case.
  const allBlocksSelected = (data?.blocks?.length || 0) > 0
    && selectedBlockIds.size === (data?.blocks?.length || 0);

  // ─────────────── Exports ───────────────
  const handlePrint = () => {
    document.body.classList.add('rescons-printing');
    window.print();
    setTimeout(() => document.body.classList.remove('rescons-printing'), 500);
  };

  const buildXlsxBuffer = async () => {
    if (!data) return null;
    let ExcelJS;
    try { const mod = await import('exceljs'); ExcelJS = mod.default || mod; }
    catch (e) { toast.error('ExcelJS yuklanmadi'); return null; }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Resurslar');
    const NCOL = 7;

    ws.mergeCells(1, 1, 1, NCOL);
    ws.getCell(1, 1).value = tt('title', language).toUpperCase();
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    if (data.project?.name || data.project?.address) {
      ws.mergeCells(2, 1, 2, NCOL);
      ws.getCell(2, 1).value = [data.project?.name, data.project?.address].filter(Boolean).join(' — ');
      ws.getCell(2, 1).font = { italic: true };
      ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    let row = 4;
    const writeHeader = () => {
      const headers = ['№', tt('th_type', language), tt('th_name', language), tt('th_uom', language), tt('th_qty', language), tt('th_price', language), tt('th_sum', language)];
      headers.forEach((h, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = h; cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        cell.border = box();
        cell.alignment = { horizontal: i === 0 || i === 3 ? 'center' : i === 2 ? 'left' : i === 1 ? 'left' : 'right' };
      });
      row++;
    };
    const writeBlock = (label, groups, total) => {
      ws.mergeCells(row, 1, row, NCOL);
      ws.getCell(row, 1).value = label;
      ws.getCell(row, 1).font = { bold: true, size: 11 };
      ws.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      ws.getCell(row, 1).border = box();
      row++;
      writeHeader();
      groups.forEach((g, idx) => {
        const r = row;
        ws.getCell(r, 1).value = idx + 1;
        ws.getCell(r, 2).value = typeLabel(g.type, language);
        ws.getCell(r, 3).value = g.name;
        ws.getCell(r, 4).value = g.uom;
        ws.getCell(r, 5).value = Number(g.norma_quantity) || 0;
        ws.getCell(r, 6).value = Number(g.unit_rate) || 0;
        ws.getCell(r, 7).value = Number(g.norma_amount) || 0;
        for (let c = 1; c <= NCOL; c++) {
          ws.getCell(r, c).border = box();
          if (c === 1 || c === 4) ws.getCell(r, c).alignment = { horizontal: 'center' };
          else if (c >= 5) { ws.getCell(r, c).numFmt = c === 5 ? '#,##0.####' : '#,##0'; ws.getCell(r, c).alignment = { horizontal: 'right' }; }
        }
        row++;
      });
      ws.mergeCells(row, 1, row, NCOL - 1);
      ws.getCell(row, 1).value = tt(label.startsWith(tt('total_project', language)) ? 'total_project' : 'total_block', language);
      ws.getCell(row, 1).font = { bold: true };
      ws.getCell(row, 1).alignment = { horizontal: 'right' };
      ws.getCell(row, NCOL).value = Number(total) || 0;
      ws.getCell(row, NCOL).font = { bold: true };
      ws.getCell(row, NCOL).numFmt = '#,##0';
      ws.getCell(row, NCOL).alignment = { horizontal: 'right' };
      for (let c = 1; c <= NCOL; c++) {
        ws.getCell(row, c).border = box();
        ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
      }
      row++;
      // Transport overhead + grand total with transport (added to totals only).
      const tAmount = transportOf(groups, transportPct);
      if (tAmount > 0) {
        ws.mergeCells(row, 1, row, NCOL - 1);
        ws.getCell(row, 1).value = tt('transport_label', language);
        ws.getCell(row, 1).alignment = { horizontal: 'right' };
        ws.getCell(row, NCOL).value = Math.round(tAmount);
        ws.getCell(row, NCOL).numFmt = '#,##0';
        ws.getCell(row, NCOL).alignment = { horizontal: 'right' };
        for (let c = 1; c <= NCOL; c++) ws.getCell(row, c).border = box();
        row++;
        ws.mergeCells(row, 1, row, NCOL - 1);
        ws.getCell(row, 1).value = tt('total_with_transport', language);
        ws.getCell(row, 1).font = { bold: true };
        ws.getCell(row, 1).alignment = { horizontal: 'right' };
        ws.getCell(row, NCOL).value = Math.round((Number(total) || 0) + tAmount);
        ws.getCell(row, NCOL).font = { bold: true };
        ws.getCell(row, NCOL).numFmt = '#,##0';
        ws.getCell(row, NCOL).alignment = { horizontal: 'right' };
        for (let c = 1; c <= NCOL; c++) {
          ws.getCell(row, c).border = box();
          ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        }
        row++;
      }
      row += 1;
    };

    if (allBlocksSelected) {
      // Combined whole-project table only.
      if (totalGroups.length > 0) writeBlock(tt('total_project', language), totalGroups, projectTotal);
    } else {
      filteredBlocks.forEach((blk) => {
        if ((blk.groups || []).length) writeBlock(`${tt('block_name', language)}: ${blk.name}`, blk.groups, blk.total_amount);
      });
      if (totalGroups.length > 0) writeBlock(tt('total_project', language), totalGroups, projectTotal);
    }

    ws.getColumn(1).width = 5; ws.getColumn(2).width = 14; ws.getColumn(3).width = 48;
    ws.getColumn(4).width = 10; ws.getColumn(5).width = 14; ws.getColumn(6).width = 14; ws.getColumn(7).width = 18;
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
      const file = new File([buf], fname, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const uploaded = await UploadFile(file);
      const fileUrl = uploaded?.url || uploaded?.file_url || uploaded;
      const fileId = uploaded?.id || uploaded?.file_id || fname;
      await constructionService.createProjectFile(projectId, {
        file_id: String(fileId), file_url: String(fileUrl), filename: fname,
        file_size: file.size, mime_type: file.type, description: tt('title', language),
      });
      toast.success(tt('save_success', language));
    } catch (e) {
      console.error('Failed to save resource consolidation', e);
      toast.error(tt('save_failed', language));
    } finally { setSaving(false); }
  };

  function projectNameSafe() {
    const n = data?.project?.name || projectNameProp || 'project';
    return n.replace(/[\/\\?%*:|"<>]/g, '').slice(0, 80);
  }
  function filename() { return `Resources-${projectNameSafe()}-NORMA`; }
  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
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

  if (!open) return null;

  const blocks = data?.blocks || [];
  const toggleBlock = (id) => setSelectedBlockIds((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const selectAllBlocks = () => {
    const ids = new Set(); for (const b of blocks) if (b?.id != null) ids.add(Number(b.id)); setSelectedBlockIds(ids);
  };
  const clearAllBlocks = () => setSelectedBlockIds(new Set());
  const toggleType = (ty) => setSelectedTypes((prev) => {
    const next = new Set(prev); next.has(ty) ? next.delete(ty) : next.add(ty); return next;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden gap-0 flex flex-col">
        <style>{`
          @media print {
            body.rescons-printing * { visibility: hidden !important; }
            body.rescons-printing [data-rescons-print-root],
            body.rescons-printing [data-rescons-print-root] * { visibility: visible !important; }
            body.rescons-printing [data-rescons-print-root] {
              position: absolute !important; left: 0 !important; top: 0 !important;
              width: 100% !important; height: auto !important;
              box-shadow: none !important; border: none !important; background: white !important;
            }
            body.rescons-printing [data-rescons-print-toolbar],
            body.rescons-printing [data-rescons-print-toolbar] * { visibility: hidden !important; display: none !important; }
            @page { size: A4 portrait; margin: 12mm; }
          }
        `}</style>

        <div data-rescons-print-root className="flex flex-col h-full bg-white min-h-0">
          {/* Toolbar */}
          <div data-rescons-print-toolbar className="flex items-center gap-2 px-4 py-3 border-b bg-white sticky top-0 z-10 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4 mr-1" /> {t('close') || 'Yopish'}
            </Button>

            {/* Block picker */}
            <div ref={blockPickerRef} className="relative ml-2">
              <button type="button" onClick={() => { setBlockPickerOpen((v) => !v); setTypePickerOpen(false); }}
                disabled={blocks.length === 0}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <span>{tt('blocks_label', language)}</span>
                <span className="font-mono text-xs text-slate-500">
                  {tt('count_fmt', language).replace('{n}', String(selectedBlockIds.size)).replace('{m}', String(blocks.length))}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {blockPickerOpen && blocks.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-lg w-64 max-h-80 overflow-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 sticky top-0 bg-white">
                    <button type="button" onClick={selectAllBlocks} className="text-xs text-emerald-700 hover:text-emerald-800">{tt('select_all', language)}</button>
                    <button type="button" onClick={clearAllBlocks} className="text-xs text-slate-500 hover:text-slate-700">{tt('select_none', language)}</button>
                  </div>
                  <ul className="py-1">
                    {blocks.map((b) => {
                      const id = Number(b.id);
                      return (
                        <li key={id}>
                          <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 text-sm">
                            <Checkbox checked={selectedBlockIds.has(id)} onCheckedChange={() => toggleBlock(id)} />
                            <span className="flex-1 truncate" title={b.name || ''}>{b.name || `#${id}`}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Resource-type picker */}
            <div ref={typePickerRef} className="relative">
              <button type="button" onClick={() => { setTypePickerOpen((v) => !v); setBlockPickerOpen(false); }}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                <span>{tt('types_label', language)}</span>
                <span className="font-mono text-xs text-slate-500">
                  {tt('count_fmt', language).replace('{n}', String(selectedTypes.size)).replace('{m}', String(RES_TYPES.length))}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {typePickerOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-lg w-56">
                  <ul className="py-1">
                    {RES_TYPES.map((ty) => (
                      <li key={ty}>
                        <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 text-sm">
                          <Checkbox checked={selectedTypes.has(ty)} onCheckedChange={() => toggleType(ty)} />
                          <span className="flex-1">{typeLabel(ty, language)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Transport overhead percentages — added to the totals only. */}
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-600">
              <span className="font-medium">{tt('transport_pct', language)}:</span>
              {['material', 'cable', 'installed'].map((ty) => (
                <span key={ty} className="inline-flex items-center gap-0.5" title={typeLabel(ty, language)}>
                  <span className="text-[10px] text-slate-400">{typeLabel(ty, language).slice(0, 3)}</span>
                  <input
                    type="number" step="0.1" min="0"
                    value={transportPct[ty]}
                    onChange={(e) => setTransportPct((p) => ({ ...p, [ty]: Number(e.target.value) || 0 }))}
                    className="w-12 px-1 py-0.5 rounded border border-slate-200 text-right text-xs"
                  />
                </span>
              ))}
            </div>

            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> {tt('print_btn', language)}</Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}><FileDown className="w-4 h-4 mr-1" /> Excel</Button>
            <Button size="sm" disabled={saving} onClick={saveToProjectFiles} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
                <div className="text-center text-xs text-slate-500 mb-4">{tt('subtitle', language)}</div>

                {selectedBlockIds.size === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-8">{tt('no_blocks_picked', language)}</div>
                ) : selectedTypes.size === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-8">{tt('no_types_picked', language)}</div>
                ) : allBlocksSelected ? (
                  // All blocks selected → a single combined table (no per-block split).
                  totalGroups.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 py-8">{tt('no_rows', language)}</div>
                  ) : (
                    <ResBlockSection label={tt('total_project', language)} groups={totalGroups}
                      totalAmount={projectTotal} language={language} totalLabel={tt('total_project', language)} transportPct={transportPct} isProjectTotal />
                  )
                ) : (
                  <>
                    {filteredBlocks.filter((b) => (b.groups || []).length).length === 0 ? (
                      <div className="text-center text-sm text-slate-500 py-8">{tt('no_rows', language)}</div>
                    ) : (
                      filteredBlocks.map((blk) => (
                        (blk.groups || []).length ? (
                          <ResBlockSection key={blk.id} label={`${tt('block_name', language)}: ${blk.name}`}
                            groups={blk.groups} totalAmount={blk.total_amount} language={language} totalLabel={tt('total_block', language)} transportPct={transportPct} />
                        ) : null
                      ))
                    )}
                    {totalGroups.length > 0 && (
                      <ResBlockSection label={tt('total_project', language)} groups={totalGroups}
                        totalAmount={projectTotal} language={language} totalLabel={tt('total_project', language)} transportPct={transportPct} isProjectTotal />
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

function ResBlockSection({ label, groups, totalAmount, language, totalLabel, transportPct, isProjectTotal = false }) {
  const visibleGroups = (groups || []).filter((g) => (Number(g.norma_quantity) || 0) > 0);
  if (visibleGroups.length === 0 && !(Number(totalAmount) > 0)) return null;
  const transportAmount = transportOf(groups, transportPct);
  const totalWithTransport = (Number(totalAmount) || 0) + transportAmount;

  return (
    <div className="mb-6">
      <div className={['px-3 py-2 font-semibold text-sm uppercase border border-slate-300', isProjectTotal ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-800'].join(' ')}>
        {label}
      </div>
      <div className="overflow-x-auto border border-t-0 border-slate-300">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-[#D9EAD3] border-b border-slate-300 text-[11px]">
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-10 text-center">№</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-24 text-left">{tt('th_type', language)}</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold text-left min-w-[240px]">{tt('th_name', language)}</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-20">{tt('th_uom', language)}</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-28 text-right">{tt('th_qty', language)}</th>
              <th className="px-3 py-2 border-r border-slate-300 font-semibold w-32 text-right">{tt('th_price', language)}</th>
              <th className="px-3 py-2 font-semibold w-36 text-right">{tt('th_sum', language)}</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-slate-400 py-3">—</td></tr>
            ) : visibleGroups.map((g, i) => (
              <tr key={`${g.type}|${g.name}|${g.uom}|${g.unit_rate}|${i}`}
                className={['border-b border-slate-200', g.subcontractor ? 'bg-orange-50/60 hover:bg-orange-50' : 'hover:bg-slate-50'].join(' ')}>
                <td className="px-3 py-1.5 border-r border-slate-200 text-center text-slate-500 font-mono">{i + 1}</td>
                <td className="px-3 py-1.5 border-r border-slate-200">
                  <span className={['inline-block px-1.5 py-0.5 rounded text-[10px] font-medium', {
                    material: 'bg-blue-50 text-blue-700',
                    cable: 'bg-rose-50 text-rose-700',
                    installed: 'bg-violet-50 text-violet-700',
                    equipment: 'bg-amber-50 text-amber-700',
                    labor: 'bg-emerald-50 text-emerald-700',
                  }[g.type] || 'bg-slate-50 text-slate-700'].join(' ')}>
                    {typeLabel(g.type, language)}
                  </span>
                </td>
                <td className="px-3 py-1.5 border-r border-slate-200">
                  {g.name}
                  {g.subcontractor && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 align-middle">
                      {g.subcontractor}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 border-r border-slate-200 text-center text-slate-600">{g.uom}</td>
                <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono">{fmtQty(g.norma_quantity)}</td>
                <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono">{fmt(g.unit_rate)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-medium">{fmt(g.norma_amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#D9EAD3] font-semibold border-t border-slate-300">
              <td colSpan={6} className="px-3 py-2 border-r border-slate-300 text-right">{totalLabel}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(totalAmount)}</td>
            </tr>
            {transportAmount > 0 && (
              <>
                <tr className="border-t border-slate-200 text-slate-700">
                  <td colSpan={6} className="px-3 py-1.5 border-r border-slate-200 text-right italic">{tt('transport_label', language)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmt(transportAmount)}</td>
                </tr>
                <tr className={['font-bold border-t border-slate-300', isProjectTotal ? 'bg-emerald-100' : 'bg-[#D9EAD3]'].join(' ')}>
                  <td colSpan={6} className="px-3 py-2 border-r border-slate-300 text-right">{tt('total_with_transport', language)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(totalWithTransport)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
