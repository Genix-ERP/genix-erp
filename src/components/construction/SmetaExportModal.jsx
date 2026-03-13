import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { constructionService } from '@/api/services/construction';

const EXPORT_TYPES = [
  { type: 'vor', label: 'ВОР', description: { uz: "Ishlar ro'yxati: №, shifr, ish nomi, birlik, miqdor", ru: 'Ведомость объёмов работ' } },
  { type: 'edinich', label: 'Единич', description: { uz: 'Batafsil: asosiy ish + resurslar', ru: 'Единичные расценки: работа + ресурсы' } },
  { type: 'resurs', label: 'Ресурс', description: { uz: 'Resurslar narxi: ishchi kuchi, material, jihozlar', ru: 'Ведомость ресурсов с ценами' } },
];

function saveAs(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SmetaExportModal({ open, onClose, estimates = [], estimateLines = {}, loadEstimateLines, selectedBuilding, project }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [selectedType, setSelectedType] = useState('vor');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Load all lines for filtered estimates if not already loaded
      const ests = estimates;
      const allLines = { ...estimateLines };
      for (const est of ests) {
        if (!allLines[est.id]) {
          try {
            const data = await constructionService.getEstimate(est.id);
            allLines[est.id] = data?.lines || [];
            if (loadEstimateLines) loadEstimateLines(est.id, data?.lines || []);
          } catch {
            allLines[est.id] = [];
          }
        }
      }

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

      const titleFont = { name: 'Times New Roman', size: 12, bold: true };
      const headerFont = { name: 'Times New Roman', size: 10, bold: true };
      const dataFont = { name: 'Times New Roman', size: 10 };
      const sectionFont = { name: 'Times New Roman', size: 10, bold: true, color: { argb: '1F4E79' } };
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

      const projectName = project?.name || 'Loyiha';
      const buildingName = selectedBuilding === 'project' ? 'Butun loyiha' : (selectedBuilding?.name || '');

      if (selectedType === 'vor') {
        const ws = wb.addWorksheet('ВОР');
        ws.columns = [
          { width: 8 }, { width: 18 }, { width: 50 }, { width: 14 }, { width: 16 }, { width: 16 },
        ];

        // Title
        ws.mergeCells('B2:F2');
        const titleCell = ws.getCell('B2');
        titleCell.value = projectName;
        titleCell.font = titleFont;
        titleCell.alignment = { horizontal: 'center' };

        // Object name
        ws.mergeCells('B6:F6');
        const objCell = ws.getCell('B6');
        objCell.value = `Объект - ${buildingName}`;
        objCell.font = { ...titleFont, size: 11 };
        objCell.alignment = { horizontal: 'center' };

        // Header rows
        const hdrRow = ws.getRow(8);
        ['№', 'Шифр', 'Наименование работ', 'Ед. изм.', 'Количество', ''].forEach((v, i) => {
          const cell = hdrRow.getCell(i + 1);
          cell.value = v; cell.font = headerFont; cell.fill = headerFill; cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
        const subRow = ws.getRow(9);
        ['', '', '', '', 'на ед.', 'по проекту'].forEach((v, i) => {
          const cell = subRow.getCell(i + 1);
          cell.value = v; cell.font = { ...headerFont, size: 8 }; cell.fill = headerFill; cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', wrapText: true };
        });
        ws.mergeCells('A8:A9'); ws.mergeCells('B8:B9'); ws.mergeCells('C8:C9'); ws.mergeCells('D8:D9');
        ws.mergeCells('E8:F8');

        // Column numbers
        const numRow = ws.getRow(10);
        [1, 2, 3, 4, 5, 6].forEach((v, i) => {
          const cell = numRow.getCell(i + 1);
          cell.value = v; cell.font = { ...dataFont, size: 8, color: { argb: '888888' } };
          cell.alignment = { horizontal: 'center' }; cell.border = thinBorder;
        });

        let rowIdx = 11;
        for (const est of ests) {
          // Section header = estimate name
          const secRow = ws.getRow(rowIdx);
          ws.mergeCells(`C${rowIdx}:D${rowIdx}`);
          secRow.getCell(3).value = est.name;
          for (let i = 1; i <= 6; i++) {
            secRow.getCell(i).font = sectionFont;
            secRow.getCell(i).fill = sectionFill;
            secRow.getCell(i).border = thinBorder;
          }
          rowIdx++;

          const lines = allLines[est.id] || [];
          for (const line of lines) {
            const r = ws.getRow(rowIdx);
            const vals = [line.item_number || '', line.code || '', line.name || '', line.uom || '', line.quantity || 0, null];
            vals.forEach((v, i) => {
              const cell = r.getCell(i + 1);
              cell.value = v; cell.font = dataFont; cell.border = thinBorder;
              if (i === 0) cell.alignment = { horizontal: 'center' };
              if (i >= 4 && typeof v === 'number') cell.numFmt = numFmt;
            });
            rowIdx++;
          }

          // ИТОГО row
          const totalRow = ws.getRow(rowIdx);
          totalRow.getCell(3).value = 'ИТОГО';
          totalRow.getCell(3).font = { ...headerFont };
          for (let i = 1; i <= 6; i++) {
            totalRow.getCell(i).fill = totalFill;
            totalRow.getCell(i).border = thinBorder;
          }
          rowIdx++;
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(buf, `VOR_${buildingName || projectName}.xlsx`);

      } else if (selectedType === 'edinich') {
        const ws = wb.addWorksheet('единич');
        ws.columns = [
          { width: 8 }, { width: 18 }, { width: 50 }, { width: 14 }, { width: 16 }, { width: 16 },
        ];

        ws.mergeCells('B2:F2');
        ws.getCell('B2').value = projectName;
        ws.getCell('B2').font = titleFont;
        ws.getCell('B2').alignment = { horizontal: 'center' };

        ws.mergeCells('B6:F6');
        ws.getCell('B6').value = `Объект - ${buildingName}`;
        ws.getCell('B6').font = { ...titleFont, size: 11 };
        ws.getCell('B6').alignment = { horizontal: 'center' };

        const hdrRow = ws.getRow(8);
        ['№', 'Шифр', 'Наименование работ', 'Ед. изм.', 'Количество', ''].forEach((v, i) => {
          const cell = hdrRow.getCell(i + 1);
          cell.value = v; cell.font = headerFont; cell.fill = headerFill; cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
        const subRow = ws.getRow(9);
        ['', '', '', '', 'на ед.', 'по проекту'].forEach((v, i) => {
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

        let rowIdx = 11;
        for (const est of ests) {
          const secRow = ws.getRow(rowIdx);
          ws.mergeCells(`C${rowIdx}:D${rowIdx}`);
          secRow.getCell(3).value = est.name;
          for (let i = 1; i <= 6; i++) {
            secRow.getCell(i).font = sectionFont;
            secRow.getCell(i).fill = sectionFill;
            secRow.getCell(i).border = thinBorder;
          }
          rowIdx++;

          const lines = allLines[est.id] || [];
          // Group: parent lines (with item_number) and child lines (resource_type set, parent_item_number set)
          const parentLines = lines.filter(l => l.item_number && !l.resource_type);
          const childLines = lines.filter(l => l.resource_type);

          for (const line of parentLines) {
            // Parent row (bold)
            const r = ws.getRow(rowIdx);
            [line.item_number || '', line.code || '', line.name || '', line.uom || '', line.quantity || 0, null].forEach((v, i) => {
              const cell = r.getCell(i + 1);
              cell.value = v; cell.font = { ...dataFont, bold: true }; cell.border = thinBorder;
              if (i === 0) cell.alignment = { horizontal: 'center' };
              if (i >= 4 && typeof v === 'number') cell.numFmt = numFmt;
            });
            rowIdx++;

            // Child rows for this parent
            const children = childLines.filter(c => c.parent_item_number === line.item_number);
            for (const child of children) {
              const cr = ws.getRow(rowIdx);
              ['', '', child.name || '', child.uom || '', child.quantity || 0, (child.quantity || 0) * (parentLines.length > 0 ? (line.quantity || 1) : 1)].forEach((v, i) => {
                const cell = cr.getCell(i + 1);
                cell.value = v;
                cell.font = { ...dataFont, size: 9, italic: true, color: { argb: '666666' } };
                cell.border = thinBorder;
                if (i >= 4 && typeof v === 'number') cell.numFmt = numFmt;
              });
              rowIdx++;
            }
          }

          // Lines without item_number and not resources (standalone)
          const standalone = lines.filter(l => !l.item_number && !l.resource_type);
          for (const line of standalone) {
            const r = ws.getRow(rowIdx);
            ['', line.code || '', line.name || '', line.uom || '', line.quantity || 0, null].forEach((v, i) => {
              const cell = r.getCell(i + 1);
              cell.value = v; cell.font = dataFont; cell.border = thinBorder;
              if (i >= 4 && typeof v === 'number') cell.numFmt = numFmt;
            });
            rowIdx++;
          }

          // ИТОГО
          const totalRow = ws.getRow(rowIdx);
          totalRow.getCell(3).value = 'ИТОГО';
          totalRow.getCell(3).font = headerFont;
          for (let i = 1; i <= 6; i++) { totalRow.getCell(i).fill = totalFill; totalRow.getCell(i).border = thinBorder; }
          rowIdx++;
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(buf, `Edinich_${buildingName || projectName}.xlsx`);

      } else if (selectedType === 'resurs') {
        const ws = wb.addWorksheet('ресурс');
        ws.columns = [
          { width: 8 }, { width: 16 }, { width: 45 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 20 },
        ];

        ws.mergeCells('B2:G2');
        ws.getCell('B2').value = projectName;
        ws.getCell('B2').font = titleFont;
        ws.getCell('B2').alignment = { horizontal: 'center' };

        ws.mergeCells('B6:G6');
        ws.getCell('B6').value = `Объект - ${buildingName}`;
        ws.getCell('B6').font = { ...titleFont, size: 11 };
        ws.getCell('B6').alignment = { horizontal: 'center' };

        const hdrRow = ws.getRow(8);
        ['№', 'Шифр', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена', 'Сумма'].forEach((v, i) => {
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

        let rowIdx = 11;
        for (const est of ests) {
          // Section header
          const secRow = ws.getRow(rowIdx);
          ws.mergeCells(`C${rowIdx}:D${rowIdx}`);
          secRow.getCell(3).value = est.name;
          for (let i = 1; i <= 7; i++) {
            secRow.getCell(i).font = sectionFont;
            secRow.getCell(i).fill = sectionFill;
            secRow.getCell(i).border = thinBorder;
          }
          rowIdx++;

          // Resource type section headers
          const lines = allLines[est.id] || [];
          const resourceTypes = { labor: 'Затраты труда', machine: 'Машины и механизмы', material: 'Материалы', equipment: 'Оборудование' };

          for (const [rType, rLabel] of Object.entries(resourceTypes)) {
            const typeLines = lines.filter(l => l.resource_type === rType);
            if (typeLines.length === 0) {
              // If no resource_type, try to export all lines as materials for ВОР-imported data
              if (rType === 'material') {
                const plainLines = lines.filter(l => !l.resource_type);
                if (plainLines.length > 0) {
                  const rtRow = ws.getRow(rowIdx);
                  rtRow.getCell(3).value = rLabel;
                  rtRow.getCell(3).font = { ...headerFont, italic: true };
                  for (let i = 1; i <= 7; i++) { rtRow.getCell(i).border = thinBorder; }
                  rowIdx++;

                  for (const line of plainLines) {
                    const unitPrice = line.unit_rate || ((line.material_rate || 0) + (line.labor_rate || 0) + (line.equipment_rate || 0));
                    const total = (line.quantity || 0) * unitPrice;
                    const r = ws.getRow(rowIdx);
                    [line.item_number || '', line.code || '', line.name || '', line.uom || '', line.quantity || 0, unitPrice, total].forEach((v, i) => {
                      const cell = r.getCell(i + 1);
                      cell.value = v; cell.font = dataFont; cell.border = thinBorder;
                      if (i === 0) cell.alignment = { horizontal: 'center' };
                      if (i >= 4 && typeof v === 'number') cell.numFmt = numFmt;
                    });
                    rowIdx++;
                  }
                }
              }
              continue;
            }

            // Resource type header
            const rtRow = ws.getRow(rowIdx);
            rtRow.getCell(3).value = rLabel;
            rtRow.getCell(3).font = { ...headerFont, italic: true };
            for (let i = 1; i <= 7; i++) { rtRow.getCell(i).border = thinBorder; }
            rowIdx++;

            for (const line of typeLines) {
              const unitPrice = line.unit_price || line.unit_rate || ((line.material_rate || 0) + (line.labor_rate || 0) + (line.equipment_rate || 0));
              const total = (line.quantity || 0) * unitPrice;
              const r = ws.getRow(rowIdx);
              [line.item_number || '', line.code || '', line.name || '', line.uom || '', line.quantity || 0, unitPrice, total].forEach((v, i) => {
                const cell = r.getCell(i + 1);
                cell.value = v; cell.font = dataFont; cell.border = thinBorder;
                if (i === 0) cell.alignment = { horizontal: 'center' };
                if (i >= 4 && typeof v === 'number') cell.numFmt = numFmt;
              });
              rowIdx++;
            }
          }

          // ИТОГО
          const totalAmt = lines.reduce((s, l) => s + (l.total_amount || 0), 0);
          const totalRow = ws.getRow(rowIdx);
          totalRow.getCell(3).value = 'ИТОГО';
          totalRow.getCell(3).font = headerFont;
          totalRow.getCell(7).value = totalAmt;
          totalRow.getCell(7).numFmt = numFmt;
          totalRow.getCell(7).font = headerFont;
          for (let i = 1; i <= 7; i++) { totalRow.getCell(i).fill = totalFill; totalRow.getCell(i).border = thinBorder; }
          rowIdx++;
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(buf, `Resurs_${buildingName || projectName}.xlsx`);
      }

      onClose();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            {t('export_estimate') || 'Smetani eksport qilish'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('select_export_type') || 'Eksport turini tanlang'}</Label>
            <div className="space-y-2">
              {EXPORT_TYPES.map(({ type, label, description }) => (
                <label
                  key={type}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedType === type ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportType"
                    value={type}
                    checked={selectedType === type}
                    onChange={() => setSelectedType(type)}
                    className="mt-1"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{label}</span>
                      <Badge variant="outline" className="text-xs">.xlsx</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {description[language === 'ru' ? 'ru' : 'uz']}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
            <FileSpreadsheet className="w-4 h-4 inline mr-1" />
            {estimates.length} {t('estimates_count') || 'smeta'} — {selectedBuilding === 'project'
              ? (t('entire_project') || 'Butun loyiha')
              : (selectedBuilding?.name || '')}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel') || 'Bekor qilish'}</Button>
          <Button onClick={handleExport} disabled={isExporting || estimates.length === 0}>
            {isExporting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('exporting') || 'Eksport...'}</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />{t('export') || 'Eksport'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
