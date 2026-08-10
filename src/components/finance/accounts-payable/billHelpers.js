// Vendor-bill predicates and badge styling, shared by the list and its modals.
//
// These lived inside AccountsPayable.jsx, which is how AccountsPayable and
// FinanceVendorBills ended up with two different answers to "is this bill
// overdue" on the same row. One definition, imported by both callers.

// The server emits payment_status from the same SQL expression the
// payment_status= filter uses, so the badge and the chip cannot disagree about
// a row. The local derivation is only a fallback for a bill that arrived from
// somewhere other than a list response.
export function getPaymentStatus(bill) {
  if (bill.payment_status) return bill.payment_status;
  const paid = bill.amount_paid || 0;
  const total = bill.total_amount || 0;
  if (total <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

// is_overdue comes from Postgres CURRENT_DATE and requires a residual. The
// browser comparison it replaces used the user's clock and no amount test, so
// a fully-settled invoice past its due date counted as overdue on screen and
// not on the server.
export function isOverdue(bill) {
  if (bill.is_overdue !== undefined) return bill.is_overdue;
  if (!bill.due_date || bill.status === 'paid' || bill.status === 'cancelled') return false;
  return (bill.total_amount || 0) - (bill.amount_paid || 0) > 0
    && new Date(bill.due_date) < new Date(new Date().toDateString());
}

export function residualOf(bill) {
  return bill.amount_residual ?? ((bill.total_amount || 0) - (bill.amount_paid || 0));
}

const PAYMENT_STATUS_STYLE = {
  paid: 'bg-green-100 text-green-800 border-green-200',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  unpaid: 'bg-red-100 text-red-800 border-red-200',
};

// Takes `t` rather than calling a hook, so it stays a plain function usable
// from anywhere in the tree.
export function getPaymentStatusBadge(bill, t) {
  const status = getPaymentStatus(bill);
  return {
    style: PAYMENT_STATUS_STYLE[status],
    label: {
      paid: t('paid'),
      partial: t('partial') || 'Partial',
      unpaid: t('unpaid') || 'Unpaid',
    }[status],
  };
}

const STATUS_COLOR = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  posted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  overdue: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-slate-100 text-slate-800 border-slate-200',
};

export function getStatusColor(status) {
  return STATUS_COLOR[status] || STATUS_COLOR.draft;
}

const MATCH_STATUS_COLOR = {
  pending: 'bg-yellow-100 text-yellow-800',
  matched: 'bg-green-100 text-green-800',
  exception: 'bg-red-100 text-red-800',
  not_applicable: 'bg-gray-100 text-gray-800',
};

export function getMatchStatusColor(status) {
  return MATCH_STATUS_COLOR[status] || MATCH_STATUS_COLOR.pending;
}
