import ExcelJS from 'exceljs';

/**
 * Export a reconciliation act (Akt Sverka) to a beautifully styled Excel file.
 *
 * @param {Object} params
 * @param {Object} params.act - The reconciliation act detail object
 * @param {Function} params.formatCurrency - Currency formatter function
 * @param {Object} params.labels - Translated label strings
 */
export async function exportReconciliationToExcel({ act, formatCurrency, labels = {} }) {
  const l = (key, fallback) => labels[key] || fallback;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenixERP';
  wb.created = new Date();

  const ws = wb.addWorksheet(l('reconciliation_act', 'Akt sverka'), {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });

  // ── Palette ──
  const BRAND_DARK = '1E293B';    // slate-800
  const BRAND_BLUE = '2563EB';    // blue-600
  const BRAND_RED = 'DC2626';     // red-600
  const HEADER_BG = '1E3A5F';     // deep navy
  const HEADER_FG = 'FFFFFF';
  const SUMMARY_BG = 'F0F7FF';    // light blue tint
  const OPENING_BG = 'F8FAFC';    // slate-50
  const TOTAL_BG = 'E2E8F0';      // slate-200
  const CLOSING_BG = 'F1F5F9';    // slate-100
  const BORDER_COLOR = 'CBD5E1';   // slate-300
  const LIGHT_STRIPE = 'F8FAFC';  // alternating row

  const thinBorder = { style: 'thin', color: { argb: BORDER_COLOR } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  // ── Column widths ──
  ws.columns = [
    { width: 5 },   // A — №
    { width: 14 },  // B — Date
    { width: 18 },  // C — Document
    { width: 44 },  // D — Description
    { width: 18 },  // E — Debit
    { width: 18 },  // F — Credit
    { width: 20 },  // G — Balance
  ];

  let row = 1;

  // ══════════════════════════════════════════════
  // TITLE SECTION
  // ══════════════════════════════════════════════
  ws.mergeCells(`A${row}:G${row}`);
  const titleCell = ws.getCell(`A${row}`);
  titleCell.value = `${l('reconciliation_act', 'Akt sverka')} — ${act.partner_name || ''}`;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: BRAND_DARK } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 30;
  row++;

  // Period subtitle
  ws.mergeCells(`A${row}:G${row}`);
  const periodCell = ws.getCell(`A${row}`);
  periodCell.value = `${l('period', 'Davr')}: ${act.period_start || ''} — ${act.period_end || ''}`;
  periodCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: '64748B' } };
  periodCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 18;
  row++;

  // Spacer
  ws.getRow(row).height = 8;
  row++;

  // ══════════════════════════════════════════════
  // SUMMARY CARDS (single row with 4 mini-sections)
  // ══════════════════════════════════════════════
  const closingBalance = (act.opening_balance || 0) + (act.our_debit_total || 0) - (act.our_credit_total || 0);
  const summaryItems = [
    { label: l('opening_balance', 'Davr boshi qoldiq'), value: act.opening_balance || 0, color: BRAND_DARK },
    { label: l('total_debit', 'Jami debet'), value: act.our_debit_total || 0, color: BRAND_BLUE },
    { label: l('total_credit', 'Jami kredit'), value: act.our_credit_total || 0, color: BRAND_RED },
    { label: l('closing_balance', 'Davr oxiri qoldiq'), value: closingBalance, color: BRAND_DARK },
  ];

  // Summary labels row
  const summaryLabelRow = ws.getRow(row);
  summaryLabelRow.height = 16;
  const labelCols = ['A', 'B', 'D', 'F'];
  const valueMerges = [['A', 'A'], ['B', 'C'], ['D', 'E'], ['F', 'G']];
  summaryItems.forEach((item, i) => {
    const col = labelCols[i];
    if (valueMerges[i][0] !== valueMerges[i][1]) {
      ws.mergeCells(`${valueMerges[i][0]}${row}:${valueMerges[i][1]}${row}`);
    }
    const cell = ws.getCell(`${valueMerges[i][0]}${row}`);
    cell.value = item.label;
    cell.font = { name: 'Arial', size: 8, color: { argb: '64748B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allBorders;
  });
  row++;

  // Summary values row
  const summaryValueRow = ws.getRow(row);
  summaryValueRow.height = 24;
  summaryItems.forEach((item, i) => {
    if (valueMerges[i][0] !== valueMerges[i][1]) {
      ws.mergeCells(`${valueMerges[i][0]}${row}:${valueMerges[i][1]}${row}`);
    }
    const cell = ws.getCell(`${valueMerges[i][0]}${row}`);
    cell.value = formatCurrency(item.value);
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: item.color } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allBorders;
  });
  row++;

  // Spacer
  ws.getRow(row).height = 10;
  row++;

  // ══════════════════════════════════════════════
  // TABLE HEADER
  // ══════════════════════════════════════════════
  const headerLabels = [
    '№',
    l('date', 'Sana'),
    l('document', 'Hujjat'),
    l('description', 'Tavsif'),
    l('debit', 'Debet'),
    l('credit', 'Kredit'),
    l('balance', 'Balans'),
  ];

  const headerRow = ws.getRow(row);
  headerRow.height = 22;
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: HEADER_FG } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = {
      horizontal: i >= 4 ? 'right' : (i === 0 ? 'center' : 'left'),
      vertical: 'middle',
    };
    cell.border = allBorders;
  });
  row++;

  // ══════════════════════════════════════════════
  // OPENING BALANCE ROW
  // ══════════════════════════════════════════════
  const openingRow = ws.getRow(row);
  openingRow.height = 20;
  for (let c = 1; c <= 7; c++) {
    const cell = openingRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OPENING_BG } };
    cell.border = allBorders;
    cell.font = { name: 'Arial', size: 9, italic: true, bold: true, color: { argb: '475569' } };
  }
  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = l('opening_balance', 'Davr boshidagi qoldiq');
  ws.getCell(`G${row}`).value = formatCurrency(act.opening_balance || 0);
  ws.getCell(`G${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  row++;

  // ══════════════════════════════════════════════
  // TRANSACTION LINES
  // ══════════════════════════════════════════════
  const lines = act.lines || [];
  lines.forEach((line, idx) => {
    const dataRow = ws.getRow(row);
    dataRow.height = 18;
    const isStripe = idx % 2 === 1;

    // №
    const numCell = dataRow.getCell(1);
    numCell.value = idx + 1;
    numCell.alignment = { horizontal: 'center', vertical: 'middle' };
    numCell.font = { name: 'Arial', size: 9, color: { argb: '64748B' } };

    // Date
    const dateCell = dataRow.getCell(2);
    dateCell.value = line.date || '';
    dateCell.font = { name: 'Arial', size: 9, color: { argb: '475569' } };

    // Document
    const docCell = dataRow.getCell(3);
    docCell.value = line.document || '';
    docCell.font = { name: 'Consolas', size: 9, color: { argb: '475569' } };

    // Description
    const descCell = dataRow.getCell(4);
    descCell.value = line.description || '';
    descCell.font = { name: 'Arial', size: 9, color: { argb: '334155' } };

    // Debit
    const debitCell = dataRow.getCell(5);
    if (line.debit > 0) {
      debitCell.value = formatCurrency(line.debit);
      debitCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BRAND_BLUE } };
    } else {
      debitCell.value = '-';
      debitCell.font = { name: 'Arial', size: 9, color: { argb: '94A3B8' } };
    }
    debitCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Credit
    const creditCell = dataRow.getCell(6);
    if (line.credit > 0) {
      creditCell.value = formatCurrency(line.credit);
      creditCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BRAND_RED } };
    } else {
      creditCell.value = '-';
      creditCell.font = { name: 'Arial', size: 9, color: { argb: '94A3B8' } };
    }
    creditCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Running balance
    const balCell = dataRow.getCell(7);
    balCell.value = formatCurrency(line.running_balance);
    balCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BRAND_DARK } };
    balCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Borders + stripe
    for (let c = 1; c <= 7; c++) {
      const cell = dataRow.getCell(c);
      cell.border = allBorders;
      if (isStripe) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_STRIPE } };
      }
    }

    row++;
  });

  // ══════════════════════════════════════════════
  // PERIOD TURNOVER ROW
  // ══════════════════════════════════════════════
  const turnoverRow = ws.getRow(row);
  turnoverRow.height = 22;
  for (let c = 1; c <= 7; c++) {
    const cell = turnoverRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    cell.border = { ...allBorders, top: { style: 'medium', color: { argb: '94A3B8' } } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '334155' } };
  }
  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = l('period_turnover', "Davr bo'yicha aylanma");
  ws.getCell(`E${row}`).value = formatCurrency(act.our_debit_total || 0);
  ws.getCell(`E${row}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: '1D4ED8' } };
  ws.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(`F${row}`).value = formatCurrency(act.our_credit_total || 0);
  ws.getCell(`F${row}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'B91C1C' } };
  ws.getCell(`F${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  row++;

  // ══════════════════════════════════════════════
  // CLOSING BALANCE ROW
  // ══════════════════════════════════════════════
  const closingRow = ws.getRow(row);
  closingRow.height = 22;
  for (let c = 1; c <= 7; c++) {
    const cell = closingRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLOSING_BG } };
    cell.border = allBorders;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: BRAND_DARK } };
  }
  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = l('closing_balance', 'Davr oxiridagi qoldiq');
  ws.getCell(`G${row}`).value = formatCurrency(closingBalance);
  ws.getCell(`G${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  row++;

  // Spacer
  row++;

  // ══════════════════════════════════════════════
  // SIGNATURE BLOCK
  // ══════════════════════════════════════════════
  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`A${row}`).value = l('on_behalf_org', "Tashkilot nomidan") + ':';
  ws.getCell(`A${row}`).font = { name: 'Arial', size: 9, bold: true, color: { argb: '475569' } };
  ws.mergeCells(`E${row}:G${row}`);
  ws.getCell(`E${row}`).value = l('on_behalf_partner', "Kontragent nomidan") + ':';
  ws.getCell(`E${row}`).font = { name: 'Arial', size: 9, bold: true, color: { argb: '475569' } };
  row += 2;

  // Signature lines
  ws.mergeCells(`A${row}:C${row}`);
  const sigLeft = ws.getCell(`A${row}`);
  sigLeft.border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
  ws.mergeCells(`E${row}:G${row}`);
  const sigRight = ws.getCell(`E${row}`);
  sigRight.border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
  row++;

  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`A${row}`).value = l('signature_hint', "F.I.O. / imzo / muhr");
  ws.getCell(`A${row}`).font = { name: 'Arial', size: 8, italic: true, color: { argb: '94A3B8' } };
  ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
  ws.mergeCells(`E${row}:G${row}`);
  ws.getCell(`E${row}`).value = l('signature_hint', "F.I.O. / imzo / muhr");
  ws.getCell(`E${row}`).font = { name: 'Arial', size: 8, italic: true, color: { argb: '94A3B8' } };
  ws.getCell(`E${row}`).alignment = { horizontal: 'center' };

  // ── Print area ──
  ws.pageSetup.printArea = `A1:G${row}`;

  // ══════════════════════════════════════════════
  // GENERATE & DOWNLOAD
  // ══════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (act.partner_name || 'partner').replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF ]/g, '_');
  a.download = `Akt_sverka_${safeName}_${act.period_start}_${act.period_end}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
