/**
 * Single source of truth for sales-order status chips.
 *
 * SalesOrders.jsx and Orders.jsx used to carry two diverging copies
 * (quotation gray vs blue, confirmed blue vs purple) — the same order
 * changed color depending on which screen you looked at. Both now
 * import this map; the dashboard's recent-orders chips use it too.
 *
 * tKey values are existing translation keys present in en/uz/ru.
 */
export const ORDER_STATUS_STYLES = {
  draft: { tKey: 'draft', className: 'bg-slate-100 text-slate-700' },
  quotation: { tKey: 'quotation', className: 'bg-blue-50 text-blue-700' },
  confirmed: { tKey: 'confirmed', className: 'bg-violet-50 text-violet-700' },
  processing: { tKey: 'processing', className: 'bg-amber-50 text-amber-700' },
  shipped: { tKey: 'shipped', className: 'bg-indigo-50 text-indigo-700' },
  delivered: { tKey: 'delivered', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { tKey: 'cancelled', className: 'bg-red-50 text-red-600' },
};

export function orderStatusClass(status) {
  return (ORDER_STATUS_STYLES[status] || ORDER_STATUS_STYLES.draft).className;
}

export function orderStatusLabel(t, status) {
  const meta = ORDER_STATUS_STYLES[status];
  return meta ? (t(meta.tKey) || status) : (t(status) || status || '-');
}
