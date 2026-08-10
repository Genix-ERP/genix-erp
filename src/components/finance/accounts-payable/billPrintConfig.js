import { format } from 'date-fns';

// Print/PDF description of a vendor bill, for PrintPreviewModal and
// BatchPrintModal. Takes `t` and `formatCurrency` so it stays a plain function
// rather than something only callable from inside the AP screen.
export function buildBillPrintConfig(bill, t, formatCurrency) {
  const statusMap = {
    draft: t('draft') || 'Draft',
    confirmed: t('confirmed') || 'Confirmed',
    posted: t('posted') || 'Posted',
    paid: t('paid') || 'Paid',
    partial: t('partial') || 'Partial',
    overdue: t('overdue') || 'Overdue',
    cancelled: t('cancelled') || 'Cancelled',
  };

  const hasLines = Boolean(bill.lines && bill.lines.length > 0);

  // Line items when they exist, otherwise a subtotal/tax summary.
  const tableData = [];
  if (hasLines) {
    bill.lines.forEach((line) => {
      tableData.push({
        description: line.description || line.product_name || '-',
        quantity: line.quantity || 1,
        unit_price: formatCurrency(line.unit_price || 0),
        amount: formatCurrency(line.line_total || (line.quantity * line.unit_price) || 0),
      });
    });
  } else {
    tableData.push({
      description: t('subtotal') || 'Subtotal',
      quantity: '', unit_price: '',
      amount: formatCurrency(bill.subtotal || bill.total_amount || 0),
    });
    if (bill.tax_amount > 0) {
      tableData.push({
        description: t('tax') || 'Tax',
        quantity: '', unit_price: '',
        amount: formatCurrency(bill.tax_amount),
      });
    }
  }

  return {
    template: 'invoice',
    title: t('vendor_bill') || 'Vendor Bill',
    documentNumber: bill.invoice_number || `VB-${bill.id}`,
    documentDate: bill.invoice_date ? format(new Date(bill.invoice_date), 'dd.MM.yyyy') : '',
    dateLabel: t('date') || 'Date',
    headerFields: [
      { label: t('vendor') || 'Vendor', value: bill.partner_name || bill.vendor_name || '-' },
      { label: t('due_date') || 'Due Date', value: bill.due_date ? format(new Date(bill.due_date), 'dd.MM.yyyy') : '-' },
      { label: t('status') || 'Status', value: statusMap[bill.status] || bill.status || '-' },
      { label: t('po_reference') || 'PO Reference', value: bill.po_number || bill.purchase_order_id || '-' },
    ],
    tableColumns: hasLines ? [
      { key: 'description', label: t('description') || 'Description', width: 70 },
      { key: 'quantity', label: t('quantity') || 'Qty', align: 'right', width: 20 },
      { key: 'unit_price', label: t('unit_price') || 'Unit Price', align: 'right', width: 35 },
      { key: 'amount', label: t('amount') || 'Amount', align: 'right', width: 35 },
    ] : [
      { key: 'description', label: t('description') || 'Description' },
      { key: 'amount', label: t('amount') || 'Amount', align: 'right' },
    ],
    tableData,
    totals: [
      ...(bill.tax_amount > 0 && hasLines ? [
        { label: t('subtotal') || 'Subtotal', value: formatCurrency(bill.subtotal || 0) },
        { label: t('tax') || 'Tax', value: formatCurrency(bill.tax_amount || 0) },
      ] : []),
      { label: t('total') || 'Total', value: formatCurrency(bill.total_amount || 0), bold: true },
      ...(bill.amount_paid > 0 ? [
        { label: t('amount_paid') || 'Paid', value: formatCurrency(bill.amount_paid || 0) },
        { label: t('amount_due') || 'Due', value: formatCurrency(bill.amount_due ?? (bill.total_amount - (bill.amount_paid || 0))), bold: true },
      ] : []),
    ],
  };
}
