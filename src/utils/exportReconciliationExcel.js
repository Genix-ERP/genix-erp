import ExcelJS from 'exceljs';

/**
 * Export a reconciliation act (Akt Sverka) to a beautifully styled Excel file.
 */
export async function exportReconciliationToExcel({ act, formatCurrency, labels = {} }) {
  const l = (key, fallback) => labels[key] || fallback;
  const LAST_COL = 11; // A..K
  const LAST_COL_LETTER = 'K';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenixERP';
  wb.created = new Date();

  const ws = wb.addWorksheet(l('reconciliation_act', 'Akt sverka'), {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // ── Palette ──
  const BRAND_DARK  = '1E293B';
  const BRAND_BLUE  = '2563EB';
  const BRAND_RED   = 'DC2626';
  const BRAND_AMBER = 'B45309';
  const HEADER_BG   = '1E3A5F';
  const HEADER_FG   = 'FFFFFF';
  const SUMMARY_BG  = 'F0F7FF';
  const OPENING_BG  = 'F8FAFC';
  const TOTAL_BG    = 'E2E8F0';
  const CLOSING_BG  = 'F1F5F9';
  const BORDER_CLR  = 'CBD5E1';
  const LIGHT_STRIPE = 'F8FAFC';
  const DETAIL_BG   = 'FFFBEB';  // warm amber-50 for product sub-rows
  const DETAIL_HDR  = 'FEF3C7';  // amber-100 for product sub-header

  const thin = { style: 'thin', color: { argb: BORDER_CLR } };
  const borders = { top: thin, bottom: thin, left: thin, right: thin };
  const dotBorder = { style: 'hair', color: { argb: BORDER_CLR } };
  const detailBorders = { top: dotBorder, bottom: dotBorder, left: thin, right: thin };

  // ── Columns: A(№) B(Date) C(Doc) D(Description) E(Vehicle) F(Product) G(Qty) H(Price) I(Total) J(Debit) K(Credit) — but we also need Balance ──
  // Actually let's do 12 columns to include Balance
  // A=№  B=Date  C=Doc  D=Desc  E=Vehicle  F=Product  G=Qty  H=UnitPrice  I=ItemTotal  J=Debit  K=Credit  L=Balance
  const COLS = 12;
  const COL_L = 'L';

  ws.columns = [
    { width: 4.5 },   // A — №
    { width: 12 },    // B — Date
    { width: 17 },    // C — Document
    { width: 28 },    // D — Description
    { width: 14 },    // E — Vehicle Number
    { width: 20 },    // F — Product
    { width: 8 },     // G — Quantity
    { width: 13 },    // H — Unit Price
    { width: 14 },    // I — Item Total
    { width: 16 },    // J — Debit
    { width: 16 },    // K — Credit
    { width: 16 },    // L — Balance
  ];

  const applyToRow = (r, count, fn) => { for (let c = 1; c <= count; c++) fn(ws.getRow(r).getCell(c), c); };

  let row = 1;

  // ══════════════════════════════════════════════
  // TITLE
  // ══════════════════════════════════════════════
  ws.mergeCells(`A${row}:${COL_L}${row}`);
  const titleCell = ws.getCell(`A${row}`);
  titleCell.value = `${l('reconciliation_act', 'Akt sverka')} — ${act.partner_name || ''}`;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: BRAND_DARK } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 30;
  row++;

  // Period
  ws.mergeCells(`A${row}:${COL_L}${row}`);
  const periodCell = ws.getCell(`A${row}`);
  periodCell.value = `${l('period', 'Davr')}: ${act.period_start || ''} — ${act.period_end || ''}`;
  periodCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: '64748B' } };
  periodCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 18;
  row++;

  ws.getRow(row).height = 8;
  row++;

  // ══════════════════════════════════════════════
  // SUMMARY CARDS
  // ══════════════════════════════════════════════
  const closingBalance = (act.opening_balance || 0) + (act.our_debit_total || 0) - (act.our_credit_total || 0);
  const summaryItems = [
    { label: l('opening_balance', 'Davr boshi qoldiq'), value: act.opening_balance || 0, color: BRAND_DARK },
    { label: l('total_debit', 'Jami debet'), value: act.our_debit_total || 0, color: BRAND_BLUE },
    { label: l('total_credit', 'Jami kredit'), value: act.our_credit_total || 0, color: BRAND_RED },
    { label: l('closing_balance', 'Davr oxiri qoldiq'), value: closingBalance, color: BRAND_DARK },
  ];

  // Each summary card spans 3 columns: A-C, D-F, G-I, J-L
  const cardMerges = [['A','C'], ['D','F'], ['G','I'], ['J','L']];

  // Labels row
  ws.getRow(row).height = 16;
  summaryItems.forEach((item, i) => {
    ws.mergeCells(`${cardMerges[i][0]}${row}:${cardMerges[i][1]}${row}`);
    const cell = ws.getCell(`${cardMerges[i][0]}${row}`);
    cell.value = item.label;
    cell.font = { name: 'Arial', size: 8, color: { argb: '64748B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borders;
  });
  row++;

  // Values row
  ws.getRow(row).height = 24;
  summaryItems.forEach((item, i) => {
    ws.mergeCells(`${cardMerges[i][0]}${row}:${cardMerges[i][1]}${row}`);
    const cell = ws.getCell(`${cardMerges[i][0]}${row}`);
    cell.value = formatCurrency(item.value);
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: item.color } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borders;
  });
  row++;

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
    l('vehicle_number', 'Mashina raqami'),
    l('product', 'Mahsulot'),
    l('quantity', 'Miqdor'),
    l('unit_price', 'Narx'),
    l('item_total', 'Jami'),
    l('debit', 'Debet'),
    l('credit', 'Kredit'),
    l('balance', 'Balans'),
  ];
  const rightAlignCols = new Set([7, 8, 9, 10, 11, 12]); // G..L
  const centerCols = new Set([1]); // A

  const headerRow = ws.getRow(row);
  headerRow.height = 24;
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: HEADER_FG } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = {
      horizontal: rightAlignCols.has(i + 1) ? 'right' : (centerCols.has(i + 1) ? 'center' : 'left'),
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = borders;
  });
  row++;

  // ══════════════════════════════════════════════
  // OPENING BALANCE
  // ══════════════════════════════════════════════
  ws.getRow(row).height = 20;
  applyToRow(row, COLS, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OPENING_BG } };
    cell.border = borders;
    cell.font = { name: 'Arial', size: 9, italic: true, bold: true, color: { argb: '475569' } };
  });
  ws.mergeCells(`B${row}:I${row}`);
  ws.getCell(`B${row}`).value = l('opening_balance', 'Davr boshidagi qoldiq');
  ws.getCell(`${COL_L}${row}`).value = formatCurrency(act.opening_balance || 0);
  ws.getCell(`${COL_L}${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  row++;

  // ══════════════════════════════════════════════
  // TRANSACTION LINES + PRODUCT SUB-ROWS
  // ══════════════════════════════════════════════
  const lines = act.lines || [];
  lines.forEach((line, idx) => {
    const hasItems = line.items && line.items.length > 0;
    const isStripe = idx % 2 === 1;
    const stripeFill = isStripe ? { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_STRIPE } } : undefined;

    // ── Main transaction row ──
    const dataRow = ws.getRow(row);
    dataRow.height = 18;

    // №
    const numCell = dataRow.getCell(1);
    numCell.value = idx + 1;
    numCell.alignment = { horizontal: 'center', vertical: 'middle' };
    numCell.font = { name: 'Arial', size: 9, color: { argb: '64748B' } };

    // Date
    dataRow.getCell(2).value = line.date || '';
    dataRow.getCell(2).font = { name: 'Arial', size: 9, color: { argb: '475569' } };

    // Document
    dataRow.getCell(3).value = line.document || '';
    dataRow.getCell(3).font = { name: 'Consolas', size: 9, color: { argb: '475569' } };

    // Description
    dataRow.getCell(4).value = line.description || '';
    dataRow.getCell(4).font = { name: 'Arial', size: 9, color: { argb: '334155' } };

    // Vehicle number
    const vehCell = dataRow.getCell(5);
    if (line.vehicle_number) {
      vehCell.value = line.vehicle_number;
      vehCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BRAND_AMBER } };
    }
    vehCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Product / Qty / Price / ItemTotal — show first item inline if single item, leave blank if multiple (sub-rows)
    if (hasItems && line.items.length === 1) {
      const item = line.items[0];
      dataRow.getCell(6).value = item.product_name || '';
      dataRow.getCell(6).font = { name: 'Arial', size: 9, color: { argb: '334155' } };
      dataRow.getCell(7).value = item.quantity;
      dataRow.getCell(7).font = { name: 'Arial', size: 9, color: { argb: '475569' } };
      dataRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      dataRow.getCell(8).value = formatCurrency(item.unit_price);
      dataRow.getCell(8).font = { name: 'Arial', size: 9, color: { argb: '475569' } };
      dataRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      dataRow.getCell(9).value = formatCurrency(item.line_total);
      dataRow.getCell(9).font = { name: 'Arial', size: 9, bold: true, color: { argb: '334155' } };
      dataRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (hasItems && line.items.length > 1) {
      dataRow.getCell(6).value = `(${line.items.length} ${l('products', 'mahsulot')})`;
      dataRow.getCell(6).font = { name: 'Arial', size: 8, italic: true, color: { argb: '94A3B8' } };
    }

    // Debit
    const debitCell = dataRow.getCell(10);
    if (line.debit > 0) {
      debitCell.value = formatCurrency(line.debit);
      debitCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BRAND_BLUE } };
    } else {
      debitCell.value = '-';
      debitCell.font = { name: 'Arial', size: 9, color: { argb: '94A3B8' } };
    }
    debitCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Credit
    const creditCell = dataRow.getCell(11);
    if (line.credit > 0) {
      creditCell.value = formatCurrency(line.credit);
      creditCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BRAND_RED } };
    } else {
      creditCell.value = '-';
      creditCell.font = { name: 'Arial', size: 9, color: { argb: '94A3B8' } };
    }
    creditCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Balance
    const balCell = dataRow.getCell(12);
    balCell.value = formatCurrency(line.running_balance);
    balCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: BRAND_DARK } };
    balCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Borders + stripe
    for (let c = 1; c <= COLS; c++) {
      const cell = dataRow.getCell(c);
      cell.border = borders;
      if (stripeFill) cell.fill = stripeFill;
    }
    row++;

    // ── Product sub-rows (only if multiple items) ──
    if (hasItems && line.items.length > 1) {
      line.items.forEach((item, itemIdx) => {
        const subRow = ws.getRow(row);
        subRow.height = 16;

        // Empty columns A-E, but fill & border all
        for (let c = 1; c <= COLS; c++) {
          const cell = subRow.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DETAIL_BG } };
          cell.border = detailBorders;
        }

        // Product name
        subRow.getCell(6).value = item.product_name || '';
        subRow.getCell(6).font = { name: 'Arial', size: 8, color: { argb: '92400E' } };

        // Quantity
        subRow.getCell(7).value = item.quantity;
        subRow.getCell(7).font = { name: 'Arial', size: 8, color: { argb: '78716C' } };
        subRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

        // Unit price
        subRow.getCell(8).value = formatCurrency(item.unit_price);
        subRow.getCell(8).font = { name: 'Arial', size: 8, color: { argb: '78716C' } };
        subRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

        // Line total
        subRow.getCell(9).value = formatCurrency(item.line_total);
        subRow.getCell(9).font = { name: 'Arial', size: 8, bold: true, color: { argb: '92400E' } };
        subRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

        row++;
      });
    }
  });

  // ══════════════════════════════════════════════
  // PERIOD TURNOVER
  // ══════════════════════════════════════════════
  ws.getRow(row).height = 22;
  applyToRow(row, COLS, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    cell.border = { ...borders, top: { style: 'medium', color: { argb: '94A3B8' } } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '334155' } };
  });
  ws.mergeCells(`B${row}:I${row}`);
  ws.getCell(`B${row}`).value = l('period_turnover', "Davr bo'yicha aylanma");

  const debitTotalCell = ws.getCell(`J${row}`);
  debitTotalCell.value = formatCurrency(act.our_debit_total || 0);
  debitTotalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '1D4ED8' } };
  debitTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const creditTotalCell = ws.getCell(`K${row}`);
  creditTotalCell.value = formatCurrency(act.our_credit_total || 0);
  creditTotalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'B91C1C' } };
  creditTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };
  row++;

  // ══════════════════════════════════════════════
  // CLOSING BALANCE
  // ══════════════════════════════════════════════
  ws.getRow(row).height = 22;
  applyToRow(row, COLS, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLOSING_BG } };
    cell.border = borders;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: BRAND_DARK } };
  });
  ws.mergeCells(`B${row}:I${row}`);
  ws.getCell(`B${row}`).value = l('closing_balance', 'Davr oxiridagi qoldiq');
  ws.getCell(`${COL_L}${row}`).value = formatCurrency(closingBalance);
  ws.getCell(`${COL_L}${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  row++;

  // Spacer
  row++;

  // ══════════════════════════════════════════════
  // SIGNATURE BLOCK
  // ══════════════════════════════════════════════
  ws.mergeCells(`A${row}:E${row}`);
  ws.getCell(`A${row}`).value = l('on_behalf_org', "Tashkilot nomidan") + ':';
  ws.getCell(`A${row}`).font = { name: 'Arial', size: 9, bold: true, color: { argb: '475569' } };
  ws.mergeCells(`H${row}:${COL_L}${row}`);
  ws.getCell(`H${row}`).value = l('on_behalf_partner', "Kontragent nomidan") + ':';
  ws.getCell(`H${row}`).font = { name: 'Arial', size: 9, bold: true, color: { argb: '475569' } };
  row += 2;

  ws.mergeCells(`A${row}:E${row}`);
  ws.getCell(`A${row}`).border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
  ws.mergeCells(`H${row}:${COL_L}${row}`);
  ws.getCell(`H${row}`).border = { bottom: { style: 'thin', color: { argb: '94A3B8' } } };
  row++;

  ws.mergeCells(`A${row}:E${row}`);
  ws.getCell(`A${row}`).value = l('signature_hint', "F.I.O. / imzo / muhr");
  ws.getCell(`A${row}`).font = { name: 'Arial', size: 8, italic: true, color: { argb: '94A3B8' } };
  ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
  ws.mergeCells(`H${row}:${COL_L}${row}`);
  ws.getCell(`H${row}`).value = l('signature_hint', "F.I.O. / imzo / muhr");
  ws.getCell(`H${row}`).font = { name: 'Arial', size: 8, italic: true, color: { argb: '94A3B8' } };
  ws.getCell(`H${row}`).alignment = { horizontal: 'center' };

  // Print area
  ws.pageSetup.printArea = `A1:${COL_L}${row}`;

  // ══════════════════════════════════════════════
  // DOWNLOAD
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
