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

function parseVOR(workbook) {
  // Find ВОР sheet
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('вор')
  );
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const merges = sheet['!merges'] || [];

  // Extract object name from row 7 (index 6) — merged cell in column C
  let objectName = '';
  for (let row = 4; row < 10; row++) {
    const rowData = rawData[row];
    if (rowData) {
      // Check columns B-F for object name (often in merged cells)
      for (let col = 1; col < 6; col++) {
        const val = rowData[col];
        if (val && typeof val === 'string' && val.includes('объект')) {
          // Extract the part after "объект - " or "объект:"
          const match = val.match(/объект\s*[-–:]\s*(.+)/i);
          if (match) objectName = match[1].trim();
          else objectName = val.trim();
          break;
        }
      }
    }
  }

  // Also check for merged cell values that might contain object name
  if (!objectName) {
    for (let row = 5; row < 9; row++) {
      const rowData = rawData[row];
      if (rowData) {
        for (let col = 0; col < 7; col++) {
          const val = rowData[col];
          if (val && typeof val === 'string' && (val.includes('Блок') || val.includes('блок'))) {
            objectName = val.trim();
            break;
          }
        }
      }
      if (objectName) break;
    }
  }

  // Parse data rows starting from row 12 (index 11)
  const sections = [];
  let currentSection = { name: objectName || 'Imported', items: [] };

  for (let i = 11; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((cell) => cell == null || cell === '')) continue;

    const colA = row[0] != null ? String(row[0]).trim() : '';
    const colB = row[1] != null ? String(row[1]).trim() : '';
    const colC = row[2] != null ? String(row[2]).trim() : '';
    const colD = row[3] != null ? String(row[3]).trim() : '';
    const colE = row[4] != null ? parseFloat(row[4]) : 0;

    // Skip empty description rows
    if (!colC) continue;

    // Skip ИТОГО / subtotal rows
    if (colC.toUpperCase().includes('ИТОГО')) continue;

    // Detect section headers: no item number in A, no code in B, just text in C
    // Section headers are often in all caps and contain keywords like СЕКЦИЯ, РАЗДЕЛ, РАБОТЫ
    const isSectionHeader =
      !colA &&
      !colB &&
      colC.length > 5 &&
      (colC === colC.toUpperCase() ||
        colC.includes('СЕКЦИЯ') ||
        colC.includes('РАЗДЕЛ'));

    if (isSectionHeader) {
      // Start new section if current one has items
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
        currentSection = { name: colC, items: [] };
      } else {
        currentSection.name = colC;
      }
      continue;
    }

    // Data row: must have something in A (item number) or at least a code in B
    if (!colA && !colB) continue;

    // Skip sub-items (like 1.1, 1.2) — these are resource breakdowns in ВОР
    // Actually in ВОР sheet, there are typically no sub-items. But if present, include them.

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

function parseEdinich(workbook) {
  // Find единич sheet
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('единич')
  );
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const merges = sheet['!merges'] || [];

  // Build a set of merged-cell rows (C column merged across D+) — these are section headers
  const mergedSectionRows = new Set();
  for (const m of merges) {
    // Merged range starting at column C (index 2) and spanning to D or beyond
    if (m.s.c === 2 && m.e.c > 2 && m.s.r >= 11) {
      mergedSectionRows.add(m.s.r);
    }
  }

  // Extract object name from rows 1-10
  let objectName = '';
  for (let row = 0; row < 10; row++) {
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
  // Fallback: use project description from row 2 (index 1) if no object name found
  if (!objectName) {
    for (let row = 0; row < 5; row++) {
      const rowData = rawData[row];
      if (rowData) {
        for (let col = 0; col < 7; col++) {
          const val = rowData[col];
          if (val && typeof val === 'string' && val.length > 15 && !val.includes('наименование') && !val.includes('ведомость') && !val.includes('смета')) {
            objectName = val.trim().replace(/\.$/, '');
            break;
          }
        }
        if (objectName) break;
      }
    }
  }

  // Parse data rows starting from row 12 (index 11)
  const sections = [];
  let currentSection = { name: objectName || 'Imported', items: [] };
  let lastParentNumber = '';

  for (let i = 11; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((cell) => cell == null || cell === '')) continue;

    const colA = row[0] != null ? String(row[0]).trim() : '';
    const colB = row[1] != null ? String(row[1]).trim() : '';
    const colC = row[2] != null ? String(row[2]).trim() : '';
    const colD = row[3] != null ? String(row[3]).trim() : '';
    const colE = row[4] != null ? parseFloat(row[4]) : 0;
    const colF = row[5] != null ? parseFloat(row[5]) : 0;

    if (!colC) continue;
    if (colC.toUpperCase().includes('ИТОГО')) continue;

    // Section headers are merged cells (C spans into D+) with no item number
    if (mergedSectionRows.has(i) && !colA) {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
        currentSection = { name: colC, items: [] };
      } else {
        currentSection.name = colC;
      }
      continue;
    }

    // Rows with item number in A — parent work items or standalone materials
    if (colA && /^\d+$/.test(colA)) {
      const hasCode = colB && colB !== 'С';
      lastParentNumber = colA;

      currentSection.items.push({
        item_number: colA,
        code: colB,
        name: colC,
        uom: colD,
        quantity: isNaN(colE) ? 0 : colE,
        quantity_per_unit: 0,
        is_parent: hasCode,
        resource_type: '',
        parent_item_number: '',
      });
      continue;
    }

    // Child/resource rows: empty A and B, follow a parent row
    if (!colA && !colB && lastParentNumber) {
      const resourceType = detectResourceType(colD);

      currentSection.items.push({
        item_number: '',
        code: '',
        name: colC,
        uom: colD,
        quantity: isNaN(colF) ? 0 : colF,
        quantity_per_unit: isNaN(colE) ? 0 : colE,
        is_parent: false,
        resource_type: resourceType,
        parent_item_number: lastParentNumber,
      });
      continue;
    }
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return { sections, objectName };
}

// =====================================================
// РЕСУРС PARSER
// =====================================================

function detectResourceSection(text) {
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper.includes('ТРУДОВЫЕ РЕСУРСЫ') || upper.includes('ТРУДОВЫХ РЕСУРС')) return 'labor';
  if (upper.includes('СТРОИТЕЛЬНЫЕ МАШИНЫ') || upper.includes('СТРОИТЕЛЬНЫХ МАШИН')) return 'equipment';
  if (upper.includes('МАТЕРИАЛЬНЫЕ РЕСУРСЫ') || upper.includes('МАТЕРИАЛЬНЫХ РЕСУРС')) return 'material';
  if (upper.includes('КАБЕЛЬНАЯ ПРОДУКЦИЯ') || upper.includes('КАБЕЛЬНОЙ ПРОДУКЦИИ')) return 'material';
  if (upper.includes('ОБОРУДОВАНИЕ') || upper.includes('ОБОРУДОВАНИ')) return 'equipment';
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
  let currentSection = { name: objectName || 'Resurslar', items: [], resourceType: 'material' };

  for (let i = 11; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((cell) => cell == null || cell === '')) continue;

    const colA = row[0] != null ? String(row[0]).trim() : '';
    const colB = row[1] != null ? String(row[1]).trim() : '';
    const colC = row[2] != null ? String(row[2]).trim() : '';
    const colD = row[3] != null ? String(row[3]).trim() : '';
    const colE = row[4] != null ? parseFloat(row[4]) : 0;
    const colF = row[5] != null ? parseFloat(row[5]) : 0;
    const colG = row[6] != null ? parseFloat(row[6]) : 0;

    // Skip empty description
    if (!colC && !colB) continue;

    // Check for ИТОГО rows
    const textToCheck = (colC || colB || '').toUpperCase();
    if (textToCheck.includes('ИТОГО')) continue;

    // Detect section header (resource type group)
    const sectionType = detectResourceSection(colC);
    if (sectionType) {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name: colC, items: [], resourceType: sectionType };
      continue;
    }

    // Skip rows without item number (non-data rows)
    if (!colA) continue;

    // Data row
    const unitPrice = isNaN(colF) ? 0 : colF;
    const total = isNaN(colG) ? 0 : colG;

    currentSection.items.push({
      item_number: colA,
      code: '',
      name: colC,
      uom: colD,
      quantity: isNaN(colE) ? 0 : colE,
      unit_price: unitPrice,
      total_price: total,
      resource_type: currentSection.resourceType,
    });
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return { sections, objectName };
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
  const [selectedType, setSelectedType] = useState(null);
  const [parsedData, setParsedData] = useState(null);
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
    setParsedData(null);
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
      const wb = XLSX.read(data, { type: 'array' });
      setWorkbook(wb);

      const sheets = detectSheets(wb);
      setAvailableSheets(sheets);

      // Auto-select ВОР if available
      const vorSheet = sheets.find((s) => s.type === 'vor' && s.enabled);
      if (vorSheet) {
        setSelectedType('vor');
      }

      if (sheets.length === 0) {
        setErrors(["Fayl tanilmagan formatda. ВОР, Единич yoki Ресурс varaqlari topilmadi."]);
      } else {
        setStep(2);
      }
    } catch (error) {
      setErrors(["Faylni o'qishda xatolik: " + error.message]);
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

  // Step 2: Parse selected sheet type
  const handleParseSheet = () => {
    if (!workbook || !selectedType) return;
    setIsProcessing(true);
    setErrors([]);

    try {
      let result = null;
      if (selectedType === 'vor') {
        result = parseVOR(workbook);
      } else if (selectedType === 'edinich') {
        result = parseEdinich(workbook);
      } else if (selectedType === 'resurs') {
        result = parseResurs(workbook);
      } else if (selectedType === 'svod') {
        result = parseSvod(workbook);
      }

      if (!result) {
        setErrors(["Ma'lumot topilmadi. Fayl formati to'g'ri ekanligini tekshiring."]);
        setIsProcessing(false);
        return;
      }

      // Svod has categories, others have sections
      if (selectedType === 'svod') {
        if (!result.categories || result.categories.length === 0) {
          setErrors(["Ma'lumot topilmadi. Fayl formati to'g'ri ekanligini tekshiring."]);
          setIsProcessing(false);
          return;
        }
      } else if (!result.sections || result.sections.length === 0) {
        setErrors(["Ma'lumot topilmadi. Fayl formati to'g'ri ekanligini tekshiring."]);
        setIsProcessing(false);
        return;
      }

      setParsedData(result);
      setEstimateName(selectedType === 'svod' ? (result.projectName || '') : (result.objectName || ''));
      // Expand first section by default
      if (result.sections && result.sections.length > 0) {
        setExpandedSections({ 0: true });
      }
      setStep(3);
    } catch (error) {
      setErrors(["Ma'lumotlarni tahlil qilishda xatolik: " + error.message]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 3 → Step 4: Execute import
  const handleImport = async () => {
    // Svod doesn't require building selection
    if (!parsedData || (selectedType !== 'svod' && !selectedBuildingId)) {
      setErrors(["Binoni tanlang"]);
      return;
    }

    setIsProcessing(true);
    setErrors([]);
    setStep(4);

    try {
      if (selectedType === 'svod') {
        // Svod import: flatten cross-tab into rows
        const rows = [];
        for (const cat of parsedData.categories) {
          for (const buildingName of parsedData.buildings) {
            rows.push({
              row_number: cat.row_number,
              category_name: cat.name,
              building_column: buildingName,
              amount: cat.amounts[buildingName] || 0,
            });
          }
        }

        await onImportSvod(rows);

        setImportResult({
          success: true,
          count: parsedData.categories.length,
          sections: 1,
          isSvod: true,
        });
      } else {
        const buildingId = selectedBuildingId === 'project' ? 0 : parseInt(selectedBuildingId);
        let importedCount = 0;

        // Merge all sections into a single estimate with all lines
        const allLines = [];
        let sortIdx = 0;
        for (const section of parsedData.sections) {
          if (section.items.length === 0) continue;
          for (const item of section.items) {
            sortIdx++;
            const unitPrice = item.unit_price || 0;
            const rt = item.resource_type || '';
            allLines.push({
              name: item.name,
              uom: item.uom || 'шт',
              quantity: item.quantity || 0,
              material_rate: rt === 'material' ? unitPrice : 0,
              labor_rate: rt === 'labor' ? unitPrice : 0,
              equipment_rate: rt === 'equipment' ? unitPrice : 0,
              code: item.code || '',
              item_number: item.item_number || '',
              resource_type: rt,
              parent_item_number: item.parent_item_number || '',
              sort_order: sortIdx,
            });
          }
          importedCount += section.items.length;
        }

        if (allLines.length > 0) {
          await onImport({
            estimateName: estimateName || parsedData.objectName || parsedData.sections[0]?.name || 'Imported',
            buildingId,
            sourceType: selectedType,
            lines: allLines,
            subcontractId: selectedSubcontractId ? parseInt(selectedSubcontractId) : undefined,
          });
        }

        setImportResult({
          success: true,
          count: importedCount,
          sections: parsedData.sections.length,
        });
      }
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
          <span className={step >= 1 ? 'text-blue-600 font-medium' : ''}>1. Fayl yuklash</span>
          <ArrowRight className="w-3 h-3" />
          <span className={step >= 2 ? 'text-blue-600 font-medium' : ''}>2. Tur tanlash</span>
          <ArrowRight className="w-3 h-3" />
          <span className={step >= 3 ? 'text-blue-600 font-medium' : ''}>3. Ko'rish</span>
          <ArrowRight className="w-3 h-3" />
          <span className={step >= 4 ? 'text-blue-600 font-medium' : ''}>4. Import</span>
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
              <Label>Import turini tanlang:</Label>
              {availableSheets.map((sheet) => (
                <div
                  key={sheet.type}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedType === sheet.type
                      ? 'border-blue-500 bg-blue-50'
                      : sheet.enabled
                      ? 'border-slate-200 hover:border-slate-300'
                      : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => sheet.enabled && setSelectedType(sheet.type)}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedType === sheet.type ? 'border-blue-500' : 'border-slate-300'
                    }`}
                  >
                    {selectedType === sheet.type && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
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
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Orqaga
              </Button>
              <Button onClick={handleParseSheet} disabled={!selectedType || isProcessing}>
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
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                <span className="font-medium">{totalItems}</span> qator
                {selectedType !== 'svod' && (
                  <>, <span className="font-medium">{parsedData.sections?.length || 0}</span> bo'lim</>
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
                <Label className="text-sm shrink-0">Bino:</Label>
                <select
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm max-w-xs"
                >
                  <option value="">Binoni tanlang...</option>
                  <option value="project">Butun loyiha</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code ? `${b.code} - ${b.name}` : b.name}
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
                        {section.items.length} qator
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
                <ArrowLeft className="w-4 h-4 mr-1" /> Orqaga
              </Button>
              <Button
                onClick={handleImport}
                disabled={(selectedType !== 'svod' && !selectedBuildingId) || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-1" />
                )}
                Import ({totalItems} qator)
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
                <p className="text-sm text-slate-600">Import jarayoni...</p>
              </div>
            ) : importResult?.success ? (
              <div className="text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <p className="text-lg font-medium text-slate-800">Import muvaffaqiyatli!</p>
                <p className="text-sm text-slate-600">
                  {importResult.isSvod
                    ? `${importResult.count} kategoriya import qilindi`
                    : `${importResult.count} qator, ${importResult.sections} smeta import qilindi`
                  }
                </p>
                <Button onClick={handleClose} className="mt-4">
                  Yopish
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-lg font-medium text-slate-800">Import xatolik</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Orqaga
                  </Button>
                  <Button onClick={handleImport}>Qayta urinish</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
