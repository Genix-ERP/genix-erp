/**
 * Styled Excel exporters for the construction "Generate Report" dialog.
 *
 * Mirrors the visual style of exportReconciliationExcel.js: brand-colored header
 * band, info block in 2 columns, bordered data table, bolded totals, signature
 * block at the bottom. Uses dynamic import of exceljs so the library stays out
 * of the main bundle.
 */

import { format } from 'date-fns';

// ── Brand palette (matches exportReconciliationExcel.js) ──
const BRAND_DARK = '1E293B';
const BRAND_BLUE = '2563EB';
const HEADER_BG = '1E3A5F';
const HEADER_FG = 'FFFFFF';
const TOTAL_BG = 'E2E8F0';
const SECTION_BG = 'F1F5F9';
const BORDER_CLR = 'CBD5E1';
const ZEBRA_BG = 'F8FAFC';
const INFO_BG = 'F0F7FF';

const thin = { style: 'thin', color: { argb: BORDER_CLR } };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function formatDate(value) {
  if (!value) return '-';
  try {
    return format(new Date(value), 'dd.MM.yyyy');
  } catch {
    return '-';
  }
}

async function downloadWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Forma 2 (KS-2) — Completed Works Act
// ─────────────────────────────────────────────────────────────
export async function exportForma2Excel({ project, items = [], reportData = {}, labels = {} }) {
  const l = (key, fallback) => labels[key] || fallback;
  const ExcelJS = (await import('exceljs')).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenixERP';
  wb.created = new Date();

  const ws = wb.addWorksheet(l('forma_2', 'Forma 2'), {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // Columns: №, Code, Work, Unit, Qty, Unit Price, Total → 7 cols (A..G)
  ws.columns = [
    { width: 5 },   // A  №
    { width: 12 },  // B  Kod
    { width: 48 },  // C  Work name
    { width: 10 },  // D  Unit
    { width: 12 },  // E  Qty
    { width: 16 },  // F  Unit price
    { width: 18 },  // G  Amount
  ];
  const LAST_COL = 'G';

  const currency = project?.currency || 'UZS';
  let row = 1;

  // ── TITLE BAND ──
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const titleCell = ws.getCell(`A${row}`);
  titleCell.value = 'DALOLATNOMA';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: HEADER_FG } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getRow(row).height = 28;
  row++;

  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const subtitleCell = ws.getCell(`A${row}`);
  subtitleCell.value = "Bajarilgan qurilish-montaj ishlari qabul qilish to'g'risida (Forma 2 shakli)";
  subtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: HEADER_FG } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getRow(row).height = 18;
  row++;

  // spacer
  ws.getRow(row).height = 8;
  row++;

  // ── INFO BLOCK (2 columns, 4 rows) ──
  const infoPairs = [
    [
      // Buyurtmachi (Customer): form override wins, then project, then dash
      { k: 'Buyurtmachi', v: reportData.clientName || project?.client_name || '-' },
      { k: 'Shartnoma raqami', v: reportData.contractNumber || '-' },
    ],
    [
      { k: 'Pudratchi', v: reportData.contractorName || '-' },
      { k: 'Shartnoma sanasi', v: formatDate(reportData.contractDate) },
    ],
    [
      { k: 'Qurilish', v: project?.name || '-' },
      {
        k: 'Hisobot davri',
        v: `${formatDate(reportData.periodStart)} — ${formatDate(reportData.periodEnd)}`,
      },
    ],
    [
      {
        k: 'Manzil',
        v: [project?.address, project?.city, project?.region].filter(Boolean).join(', ') || '-',
      },
      { k: 'Dalolatnoma raqami', v: reportData.actNumber || '-' },
    ],
  ];

  const writeInfoCell = (addr, text, isLabel) => {
    const c = ws.getCell(addr);
    c.value = text;
    c.font = isLabel
      ? { name: 'Arial', size: 10, bold: true, color: { argb: BRAND_DARK } }
      : { name: 'Arial', size: 10, color: { argb: BRAND_DARK } };
    c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } };
    c.border = borders;
  };

  for (const pair of infoPairs) {
    // Left: A(label) B-C(value) | Right: D-E(label) F-G(value)
    writeInfoCell(`A${row}`, pair[0].k, true);
    ws.mergeCells(`B${row}:C${row}`);
    writeInfoCell(`B${row}`, pair[0].v, false);

    ws.mergeCells(`D${row}:E${row}`);
    writeInfoCell(`D${row}`, pair[1].k, true);
    ws.mergeCells(`F${row}:G${row}`);
    writeInfoCell(`F${row}`, pair[1].v, false);
    ws.getRow(row).height = 20;
    row++;
  }

  // spacer
  ws.getRow(row).height = 8;
  row++;

  // ── TABLE HEADER ──
  const headers = ['№', 'Kod', 'Ish nomi', 'Birlik', 'Miqdori', 'Birlik narxi', 'Jami summa'];
  headers.forEach((h, i) => {
    const c = ws.getRow(row).getCell(i + 1);
    c.value = h;
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: HEADER_FG } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = borders;
  });
  ws.getRow(row).height = 28;
  ws.views = [{ state: 'frozen', ySplit: row }]; // freeze header
  row++;

  // ── DATA ROWS ──
  let total = 0;
  items.forEach((item, idx) => {
    const qty = Number(item.quantity_completed || 0);
    const unitPrice = Number(item.unit_price || 0);
    const amount = qty * unitPrice;
    total += amount;

    const values = [idx + 1, item.code || '', item.name || '', item.unit || '', qty, unitPrice, amount];
    const r = ws.getRow(row);
    values.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v;
      c.font = { name: 'Arial', size: 10, color: { argb: BRAND_DARK } };
      c.border = borders;
      if (idx % 2 === 1) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG } };
      }
      if (i === 0) c.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (i === 2) c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      else if (i === 3) c.alignment = { horizontal: 'center', vertical: 'middle' };
      else {
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        if (i === 4) c.numFmt = '#,##0.##';
        else c.numFmt = '#,##0.00';
      }
    });
    r.height = 22;
    row++;
  });

  if (items.length === 0) {
    ws.mergeCells(`A${row}:${LAST_COL}${row}`);
    const empty = ws.getCell(`A${row}`);
    empty.value = 'Ma\'lumotlar mavjud emas';
    empty.font = { name: 'Arial', size: 10, italic: true, color: { argb: '64748B' } };
    empty.alignment = { horizontal: 'center', vertical: 'middle' };
    empty.border = borders;
    row++;
  }

  // ── TOTAL ROW ──
  ws.mergeCells(`A${row}:F${row}`);
  const totalLabelCell = ws.getCell(`A${row}`);
  totalLabelCell.value = `JAMI (${currency}):`;
  totalLabelCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: BRAND_DARK } };
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
  totalLabelCell.border = borders;

  const totalValueCell = ws.getCell(`G${row}`);
  totalValueCell.value = total;
  totalValueCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: BRAND_BLUE } };
  totalValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalValueCell.numFmt = '#,##0.00';
  totalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
  totalValueCell.border = borders;
  ws.getRow(row).height = 24;
  row++;

  // spacer
  ws.getRow(row).height = 12;
  row++;

  // ── CONFIRMATION TEXT ──
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const confirmCell = ws.getCell(`A${row}`);
  confirmCell.value = "Ushbu dalolatnoma yuqorida ko'rsatilgan ishlarning bajarilganligini tasdiqlaydi.";
  confirmCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: BRAND_DARK } };
  confirmCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  ws.getRow(row).height = 20;
  row += 2;

  // ── SIGNATURES ──
  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`A${row}`).value = 'Topshirdi (Pudratchi):';
  ws.getCell(`A${row}`).font = { name: 'Arial', size: 10, bold: true };

  ws.mergeCells(`E${row}:G${row}`);
  ws.getCell(`E${row}`).value = 'Qabul qildi (Buyurtmachi):';
  ws.getCell(`E${row}`).font = { name: 'Arial', size: 10, bold: true };
  row++;

  ws.getRow(row).height = 40;
  row++;

  // signature lines
  const sigBorder = { bottom: { style: 'thin', color: { argb: BRAND_DARK } } };
  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`A${row}`).border = sigBorder;
  ws.mergeCells(`E${row}:G${row}`);
  ws.getCell(`E${row}`).border = sigBorder;
  row++;

  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`A${row}`).value = 'F.I.O., imzo';
  ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
  ws.getCell(`A${row}`).font = { name: 'Arial', size: 9, italic: true, color: { argb: '64748B' } };

  ws.mergeCells(`E${row}:G${row}`);
  ws.getCell(`E${row}`).value = 'F.I.O., imzo';
  ws.getCell(`E${row}`).alignment = { horizontal: 'center' };
  ws.getCell(`E${row}`).font = { name: 'Arial', size: 9, italic: true, color: { argb: '64748B' } };
  row += 2;

  // date
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const dateCell = ws.getCell(`A${row}`);
  dateCell.value = `Sana: ${format(new Date(), 'dd.MM.yyyy')}`;
  dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
  dateCell.font = { name: 'Arial', size: 10, color: { argb: BRAND_DARK } };

  const safeName = (project?.code || project?.name || 'project')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .slice(0, 40);
  await downloadWorkbook(wb, `Forma2_${safeName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ─────────────────────────────────────────────────────────────
// Smeta Summary
// ─────────────────────────────────────────────────────────────
export async function exportSmetaSummaryExcel({ project, sections = [] }) {
  const ExcelJS = (await import('exceljs')).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenixERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Smeta', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  ws.columns = [
    { width: 5 },   // A  №
    { width: 14 },  // B  Kod
    { width: 50 },  // C  Bo'lim nomi
    { width: 20 },  // D  Summa
    { width: 14 },  // E  Holat
  ];
  const LAST_COL = 'E';
  const currency = project?.currency || 'UZS';

  let row = 1;

  // title
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const t = ws.getCell(`A${row}`);
  t.value = 'SMETA XULOSASI';
  t.font = { name: 'Arial', size: 16, bold: true, color: { argb: HEADER_FG } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getRow(row).height = 28;
  row++;

  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const sub = ws.getCell(`A${row}`);
  sub.value = project?.name || '';
  sub.font = { name: 'Arial', size: 11, italic: true, color: { argb: HEADER_FG } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getRow(row).height = 20;
  row++;

  ws.getRow(row).height = 10;
  row++;

  // project info block
  const infoRows = [
    ['Loyiha kodi', project?.code || '-'],
    ['Buyurtmachi', project?.client_name || '-'],
    ['Manzil', [project?.address, project?.city, project?.region].filter(Boolean).join(', ') || '-'],
    ['Shartnoma summasi', `${Number(project?.contract_amount || 0).toLocaleString()} ${currency}`],
  ];
  infoRows.forEach(([k, v]) => {
    const a = ws.getCell(`A${row}`);
    a.value = k;
    a.font = { name: 'Arial', size: 10, bold: true, color: { argb: BRAND_DARK } };
    a.border = borders;
    a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } };
    ws.mergeCells(`B${row}:${LAST_COL}${row}`);
    const b = ws.getCell(`B${row}`);
    b.value = v;
    b.font = { name: 'Arial', size: 10, color: { argb: BRAND_DARK } };
    b.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    b.border = borders;
    b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } };
    ws.getRow(row).height = 20;
    row++;
  });

  ws.getRow(row).height = 10;
  row++;

  // table header
  ['№', 'Kod', "Bo'lim nomi", 'Summa', 'Holat'].forEach((h, i) => {
    const c = ws.getRow(row).getCell(i + 1);
    c.value = h;
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: HEADER_FG } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = borders;
  });
  ws.getRow(row).height = 26;
  ws.views = [{ state: 'frozen', ySplit: row }];
  row++;

  // data rows
  let total = 0;
  sections.forEach((section, idx) => {
    const amt = Number(section.total_cost || 0);
    total += amt;
    const r = ws.getRow(row);
    const vals = [idx + 1, section.code || '', section.name || '', amt, section.status || 'draft'];
    vals.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v;
      c.border = borders;
      c.font = { name: 'Arial', size: 10, color: { argb: BRAND_DARK } };
      if (idx % 2 === 1) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG } };
      }
      if (i === 0 || i === 4) c.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (i === 2) c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      else if (i === 3) {
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.numFmt = '#,##0.00';
      } else c.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    r.height = 22;
    row++;
  });

  // total
  ws.mergeCells(`A${row}:C${row}`);
  const tl = ws.getCell(`A${row}`);
  tl.value = `JAMI SMETA (${currency}):`;
  tl.font = { name: 'Arial', size: 11, bold: true, color: { argb: BRAND_DARK } };
  tl.alignment = { horizontal: 'right', vertical: 'middle' };
  tl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
  tl.border = borders;

  const tv = ws.getCell(`D${row}`);
  tv.value = total;
  tv.numFmt = '#,##0.00';
  tv.font = { name: 'Arial', size: 11, bold: true, color: { argb: BRAND_BLUE } };
  tv.alignment = { horizontal: 'right', vertical: 'middle' };
  tv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
  tv.border = borders;
  ws.getCell(`E${row}`).border = borders;
  ws.getCell(`E${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
  ws.getRow(row).height = 24;
  row++;

  // diff row
  ws.getRow(row).height = 10;
  row++;
  ws.mergeCells(`A${row}:C${row}`);
  const dl = ws.getCell(`A${row}`);
  dl.value = 'Smeta - Shartnoma farqi:';
  dl.font = { name: 'Arial', size: 10, bold: true };
  dl.alignment = { horizontal: 'right', vertical: 'middle' };
  const dv = ws.getCell(`D${row}`);
  dv.value = total - Number(project?.contract_amount || 0);
  dv.numFmt = '#,##0.00';
  dv.font = { name: 'Arial', size: 10, bold: true, color: { argb: BRAND_BLUE } };
  dv.alignment = { horizontal: 'right', vertical: 'middle' };
  row += 2;

  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const dateCell = ws.getCell(`A${row}`);
  dateCell.value = `Tuzilgan sana: ${format(new Date(), 'dd.MM.yyyy')}`;
  dateCell.alignment = { horizontal: 'right' };
  dateCell.font = { name: 'Arial', size: 10 };

  const safeName = (project?.code || project?.name || 'project')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .slice(0, 40);
  await downloadWorkbook(wb, `Smeta_${safeName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ─────────────────────────────────────────────────────────────
// Progress Report
// ─────────────────────────────────────────────────────────────
export async function exportProgressReportExcel({ project, buildings = [], sections = [] }) {
  const ExcelJS = (await import('exceljs')).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenixERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Progress', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  ws.columns = [
    { width: 5 },   // A №
    { width: 28 },  // B name
    { width: 14 },  // C type
    { width: 14 },  // D area
    { width: 10 },  // E floors
    { width: 14 },  // F status
  ];
  const LAST_COL = 'F';
  const currency = project?.currency || 'UZS';

  let row = 1;

  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const t = ws.getCell(`A${row}`);
  t.value = 'PROGRESS HISOBOTI';
  t.font = { name: 'Arial', size: 16, bold: true, color: { argb: HEADER_FG } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getRow(row).height = 28;
  row++;

  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const sub = ws.getCell(`A${row}`);
  sub.value = `${project?.name || ''} (Kod: ${project?.code || '-'})`;
  sub.font = { name: 'Arial', size: 11, italic: true, color: { argb: HEADER_FG } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getRow(row).height = 20;
  row++;

  ws.getRow(row).height = 10;
  row++;

  // ── Progress hero ──
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const hero = ws.getCell(`A${row}`);
  hero.value = `${Number(project?.progress_percent || 0)}%  —  Umumiy bajarilish`;
  hero.font = { name: 'Arial', size: 20, bold: true, color: { argb: HEADER_FG } };
  hero.alignment = { horizontal: 'center', vertical: 'middle' };
  hero.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BLUE } };
  ws.getRow(row).height = 48;
  row++;

  ws.getRow(row).height = 10;
  row++;

  // ── Summary cards row ──
  const summary = [
    { label: 'Binolar soni', value: buildings.length },
    { label: "Smeta bo'limlari", value: sections.length },
    { label: 'Shartnoma summasi', value: `${Number(project?.contract_amount || 0).toLocaleString()} ${currency}` },
  ];
  const cardMerges = [['A', 'B'], ['C', 'D'], ['E', 'F']];
  summary.forEach((item, i) => {
    ws.mergeCells(`${cardMerges[i][0]}${row}:${cardMerges[i][1]}${row}`);
    const c = ws.getCell(`${cardMerges[i][0]}${row}`);
    c.value = item.label;
    c.font = { name: 'Arial', size: 9, color: { argb: '64748B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } };
    c.border = borders;
  });
  ws.getRow(row).height = 18;
  row++;
  summary.forEach((item, i) => {
    ws.mergeCells(`${cardMerges[i][0]}${row}:${cardMerges[i][1]}${row}`);
    const c = ws.getCell(`${cardMerges[i][0]}${row}`);
    c.value = item.value;
    c.font = { name: 'Arial', size: 14, bold: true, color: { argb: BRAND_DARK } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } };
    c.border = borders;
  });
  ws.getRow(row).height = 26;
  row += 2;

  // ── Buildings section header ──
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const secH = ws.getCell(`A${row}`);
  secH.value = "Binolar ro'yxati";
  secH.font = { name: 'Arial', size: 12, bold: true, color: { argb: BRAND_DARK } };
  secH.alignment = { horizontal: 'left', vertical: 'middle' };
  secH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_BG } };
  ws.getRow(row).height = 22;
  row++;

  // ── Buildings table header ──
  ['№', 'Bino nomi', 'Turi', 'Maydon (m²)', 'Qavatlar', 'Holat'].forEach((h, i) => {
    const c = ws.getRow(row).getCell(i + 1);
    c.value = h;
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: HEADER_FG } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = borders;
  });
  ws.getRow(row).height = 24;
  row++;

  buildings.forEach((b, idx) => {
    const r = ws.getRow(row);
    const vals = [idx + 1, b.name || '', b.building_type || '-', Number(b.total_area || 0), b.floors_count || '-', b.status || 'planned'];
    vals.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v;
      c.font = { name: 'Arial', size: 10, color: { argb: BRAND_DARK } };
      c.border = borders;
      if (idx % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG } };
      if (i === 0 || i === 2 || i === 4 || i === 5) c.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (i === 1) c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      else if (i === 3) {
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.numFmt = '#,##0.##';
      }
    });
    r.height = 22;
    row++;
  });

  if (buildings.length === 0) {
    ws.mergeCells(`A${row}:${LAST_COL}${row}`);
    const empty = ws.getCell(`A${row}`);
    empty.value = 'Binolar mavjud emas';
    empty.alignment = { horizontal: 'center', vertical: 'middle' };
    empty.font = { name: 'Arial', size: 10, italic: true, color: { argb: '64748B' } };
    empty.border = borders;
    row++;
  }

  row++;

  // ── Schedule block ──
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const schedH = ws.getCell(`A${row}`);
  schedH.value = 'Loyiha vaqt jadvali';
  schedH.font = { name: 'Arial', size: 12, bold: true, color: { argb: BRAND_DARK } };
  schedH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_BG } };
  schedH.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 22;
  row++;

  const scheduleRows = [
    ['Rejadagi boshlanish', formatDate(project?.planned_start_date)],
    ['Rejadagi tugash', formatDate(project?.planned_end_date)],
    ['Haqiqiy boshlanish', formatDate(project?.actual_start_date)],
  ];
  scheduleRows.forEach(([k, v]) => {
    ws.mergeCells(`A${row}:B${row}`);
    const a = ws.getCell(`A${row}`);
    a.value = k;
    a.font = { name: 'Arial', size: 10, bold: true, color: { argb: BRAND_DARK } };
    a.alignment = { horizontal: 'left', vertical: 'middle' };
    a.border = borders;
    a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } };

    ws.mergeCells(`C${row}:${LAST_COL}${row}`);
    const b = ws.getCell(`C${row}`);
    b.value = v;
    b.font = { name: 'Arial', size: 10, color: { argb: BRAND_DARK } };
    b.alignment = { horizontal: 'left', vertical: 'middle' };
    b.border = borders;
    b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INFO_BG } };
    ws.getRow(row).height = 20;
    row++;
  });

  row += 2;
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const dateCell = ws.getCell(`A${row}`);
  dateCell.value = `Hisobot sanasi: ${format(new Date(), 'dd.MM.yyyy')}`;
  dateCell.alignment = { horizontal: 'right' };
  dateCell.font = { name: 'Arial', size: 10 };

  const safeName = (project?.code || project?.name || 'project')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .slice(0, 40);
  await downloadWorkbook(wb, `Progress_${safeName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}
