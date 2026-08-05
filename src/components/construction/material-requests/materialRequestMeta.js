// Material zayavkalari v2 — status/qator meta (4-bo'lim rang jadvali).
// Label'lar i18n kaliti orqali: t(key) || fallback.

export const MR_STATUS_META = {
  new: { tKey: 'mr_status_new', fallback: 'Yangi', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_review: { tKey: 'mr_status_in_review', fallback: "Ko'rib chiqilmoqda", className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  in_purchase: { tKey: 'mr_status_in_purchase', fallback: 'Xaridda', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  partially_fulfilled: { tKey: 'mr_status_partial', fallback: "Qisman ta'minlangan", className: 'bg-violet-50 text-violet-700 border-violet-200' },
  issued: { tKey: 'mr_status_issued', fallback: 'Chiqarilgan', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { tKey: 'mr_status_closed', fallback: 'Yopilgan', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  rejected: { tKey: 'mr_status_rejected', fallback: 'Rad etilgan', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { tKey: 'mr_status_cancelled', fallback: 'Bekor qilingan', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const MR_LINE_STATUS_META = {
  pending: { tKey: 'mr_line_pending', fallback: 'Kutilmoqda', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_purchase: { tKey: 'mr_status_in_purchase', fallback: 'Xaridda', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  partial: { tKey: 'mr_line_partial', fallback: 'Qisman', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  issued: { tKey: 'mr_status_issued', fallback: 'Chiqarilgan', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { tKey: 'mr_status_rejected', fallback: 'Rad etilgan', className: 'bg-red-50 text-red-700 border-red-200' },
};

// Ochiq (terminal bo'lmagan) statuslar — filtrlash uchun.
export const MR_OPEN_STATUSES = ['new', 'in_review', 'in_purchase', 'partially_fulfilled', 'issued'];

// Timeline action_type → i18n kalit + ikon nomi (lucide).
export const MR_ACTIVITY_META = {
  created: { tKey: 'mr_act_created', fallback: 'Zayavka yaratildi' },
  reviewed: { tKey: 'mr_act_reviewed', fallback: "Ko'rib chiqish boshlandi" },
  issued: { tKey: 'mr_act_issued', fallback: 'Materiallar chiqarildi' },
  sent_to_purchase: { tKey: 'mr_act_sent_to_purchase', fallback: 'Xaridga yuborildi' },
  po_created: { tKey: 'mr_act_po_created', fallback: 'Buyurtma (PO) yaratildi' },
  material_arrived: { tKey: 'mr_act_material_arrived', fallback: 'Material omborga keldi' },
  rejected: { tKey: 'mr_act_rejected', fallback: 'Rad etildi' },
  cancelled: { tKey: 'mr_act_cancelled', fallback: 'Bekor qilindi' },
  accepted: { tKey: 'mr_act_accepted', fallback: 'Prorab qabul qildi' },
  updated: { tKey: 'mr_act_updated', fallback: 'Tahrirlandi' },
};

export function mrStatusBadgeProps(status, t) {
  const meta = MR_STATUS_META[status] || { fallback: status, className: 'bg-slate-100 text-slate-600 border-slate-200' };
  return { label: (meta.tKey && t(meta.tKey)) || meta.fallback, className: meta.className };
}

export function mrLineStatusBadgeProps(status, t) {
  const meta = MR_LINE_STATUS_META[status] || { fallback: status, className: 'bg-slate-100 text-slate-600 border-slate-200' };
  return { label: (meta.tKey && t(meta.tKey)) || meta.fallback, className: meta.className };
}
