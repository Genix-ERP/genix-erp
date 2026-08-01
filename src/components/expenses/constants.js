// Shared visual + lifecycle tokens for the Xarajatlar module.
// Status vocabulary mirrors the backend CHECK constraint (migration 444):
// draft → submitted → approved → paid, plus rejected and (legacy) cancelled.

export const EXPENSE_STATUSES = ['draft', 'submitted', 'approved', 'paid', 'rejected'];

// tKey → translations.jsx keys (exp_status_*); className → badge tint;
// dot → the little status dot used in the detail sheet timeline.
export const STATUS_META = {
  draft: { tKey: 'exp_status_draft', className: 'bg-slate-100 text-slate-700 border-slate-200', dot: '#94a3b8' },
  submitted: { tKey: 'exp_status_submitted', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: '#f59e0b' },
  approved: { tKey: 'exp_status_approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#10b981' },
  paid: { tKey: 'exp_status_paid', className: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: '#6366f1' },
  rejected: { tKey: 'exp_status_rejected', className: 'bg-red-50 text-red-700 border-red-200', dot: '#ef4444' },
  cancelled: { tKey: 'exp_status_cancelled', className: 'bg-slate-100 text-slate-500 border-slate-200', dot: '#cbd5e1' },
};

// Fallback palette for categories that have no color of their own —
// same family as the Direktor paneli EC palette.
export const CATEGORY_FALLBACK_COLORS = [
  '#185FA5', '#1D9E75', '#EF9F27', '#534AB7', '#0E9AA7',
  '#D9534F', '#8A6D3B', '#888780', '#6C5CE7', '#00CEC9',
];

export const categoryColor = (cat, index = 0) =>
  (cat && cat.color) || CATEGORY_FALLBACK_COLORS[index % CATEGORY_FALLBACK_COLORS.length];

// Which lifecycle actions make sense per status. The page additionally
// gates each action by the user's module permission.
export const STATUS_ACTIONS = {
  draft: ['submit', 'edit', 'delete'],
  submitted: ['approve', 'reject', 'edit'],
  approved: ['pay'],
  paid: [],
  rejected: ['submit', 'edit', 'delete'],
  cancelled: ['delete'],
};
