import { formatDate as fmtDdMmYyyy } from './formatDate';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

/**
 * Export project time entries to a beautifully styled Excel file.
 */
export async function exportTimeEntriesToExcel({ projectName = '', entries = [], tasksById = {}, labels = {}, formatDate }) {
  const l = (k, fb) => labels[k] || fb;
  const fd = formatDate || ((d) => (d ? formatDate(d) : ''));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenixERP';
  wb.created = new Date();
  const ws = wb.addWorksheet(l('time_entries', 'Time Entries'), {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Palette
  const HEADER_BG = '1E3A5F';
  const HEADER_FG = 'FFFFFF';
  const TITLE_FG = '1E293B';
  const SUMMARY_BG = 'EEF2FF';
  const STRIPE = 'F8FAFC';
  const TOTAL_BG = 'E2E8F0';
  const BORDER_CLR = 'CBD5E1';
  const GREEN = '16A34A';
  const thin = { style: 'thin', color: { argb: BORDER_CLR } };
  const borders = { top: thin, bottom: thin, left: thin, right: thin };

  ws.columns = [
    { width: 14 },  // A Date
    { width: 22 },  // B Employee
    { width: 32 },  // C Task
    { width: 9 },   // D Hours
    { width: 14 },  // E Billable
    { width: 16 },  // F Rate
    { width: 16 },  // G Amount
    { width: 30 },  // H Description
  ];
  const LAST = 8;

  // Title
  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = `${l('time_entries', 'Time Entries')}${projectName ? ' — ' + projectName : ''}`;
  title.font = { bold: true, size: 15, color: { argb: TITLE_FG } };
  title.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 26;

  // Summary
  const totalHours = entries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
  const billableHours = entries.filter(e => e.billable).reduce((s, e) => s + (Number(e.hours) || 0), 0);
  const billableAmount = entries.filter(e => e.billable).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  ws.mergeCells('A2:H2');
  const sum = ws.getCell('A2');
  sum.value = `${l('total_hours', 'Total hours')}: ${totalHours.toFixed(1)}   •   ${l('billable_hours', 'Billable')}: ${billableHours.toFixed(1)}   •   ${l('billable_amount', 'Billable amount')}: ${billableAmount.toLocaleString()}`;
  sum.font = { size: 11, color: { argb: '475569' } };
  sum.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } };
  sum.alignment = { vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Header row (row 4)
  const headerRow = 4;
  const headers = [
    l('date', 'Date'), l('employee', 'Employee'), l('task', 'Task'), l('hours', 'Hours'),
    l('billable', 'Billable'), l('hourly_rate', 'Hourly rate'), l('amount', 'Amount'), l('description', 'Description'),
  ];
  headers.forEach((h, i) => {
    const cell = ws.getRow(headerRow).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: HEADER_FG } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 3 && i <= 6 ? 'center' : 'left' };
    cell.border = borders;
  });
  ws.getRow(headerRow).height = 22;

  // Data rows
  let r = headerRow + 1;
  entries.forEach((e, idx) => {
    const row = ws.getRow(r);
    const taskTitle = e.task_id ? (tasksById[e.task_id] || '') : '';
    row.getCell(1).value = e.date ? fd(e.date) : '';
    row.getCell(2).value = e.employee_name || '';
    row.getCell(3).value = taskTitle;
    row.getCell(4).value = Number(e.hours) || 0;
    row.getCell(4).numFmt = '0.0';
    row.getCell(5).value = e.billable ? l('yes', 'Yes') : l('no', 'No');
    row.getCell(6).value = Number(e.hourly_rate) || 0;
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).value = Number(e.amount) || 0;
    row.getCell(7).numFmt = '#,##0';
    row.getCell(8).value = e.description || '';
    for (let c = 1; c <= LAST; c++) {
      const cell = row.getCell(c);
      cell.border = borders;
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } };
      cell.alignment = { vertical: 'middle', horizontal: c >= 4 && c <= 7 ? (c === 5 ? 'center' : 'right') : 'left' };
    }
    if (e.billable) row.getCell(5).font = { color: { argb: GREEN }, bold: true };
    r++;
  });

  // Totals row
  const totalRow = ws.getRow(r);
  totalRow.getCell(1).value = l('total', 'Total');
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(4).value = totalHours; totalRow.getCell(4).numFmt = '0.0';
  totalRow.getCell(7).value = billableAmount; totalRow.getCell(7).numFmt = '#,##0';
  for (let c = 1; c <= LAST; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    cell.border = borders;
    cell.font = { bold: true, ...(cell.font || {}) };
    cell.alignment = { vertical: 'middle', horizontal: c >= 4 && c <= 7 ? 'right' : 'left' };
  }

  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(projectName || 'time_entries').replace(/[^a-z0-9]+/gi, '_')}_time_entries.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded Excel/CSV file into row objects. The header row is detected
 * by content (so a styled export with a title/summary above the table still
 * imports correctly), and any totals row is skipped.
 */
export async function parseTimeEntriesFile(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const KNOWN = ['sana', 'date', 'дата', 'xodim', 'employee', 'сотрудник', 'soat', 'hours', 'часы'];
  let hi = aoa.findIndex(r => Array.isArray(r) && r.some(c => KNOWN.includes(String(c).trim().toLowerCase())));
  if (hi < 0) hi = 0;

  const headers = (aoa[hi] || []).map(h => String(h).trim());
  const TOTALS = ['total', 'jami', 'итого', 'umumiy'];
  const rows = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const arr = aoa[i] || [];
    if (arr.every(c => c === '' || c == null)) continue;
    if (TOTALS.includes(String(arr[0] || '').trim().toLowerCase())) continue;
    const obj = {};
    headers.forEach((h, idx) => { if (h) obj[h] = arr[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}
