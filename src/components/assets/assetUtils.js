// Shared helpers for the Aktivlar module (2026-08-03 rebuild).

export const STATUS_META = {
  draft: { key: 'fa_status_draft', fallback: 'Qoralama', cls: 'bg-slate-100 text-slate-700' },
  in_service: { key: 'fa_status_in_service', fallback: 'Foydalanishda', cls: 'bg-green-100 text-green-800' },
  conserved: { key: 'fa_status_conserved', fallback: 'Konservatsiyada', cls: 'bg-amber-100 text-amber-800' },
  disposed: { key: 'fa_status_disposed', fallback: 'Hisobdan chiqarilgan', cls: 'bg-red-100 text-red-700' },
};

export const statusLabel = (t, status) => {
  const m = STATUS_META[status];
  if (!m) return status;
  return t(m.key) || m.fallback;
};

export const errMsg = (e) =>
  e?.response?.data?.error?.message_uz || e?.response?.data?.error?.message || e?.message || 'Xatolik';

export const thisPeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM
export const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('ru-RU');
};

// The app's t() returns the key itself on a miss; wrap so `t('x') || 'fallback'`
// degrades to the fallback instead of painting a raw key (the "classic" bug).
export const safeT = (t0) => (k) => {
  const v = t0(k);
  return v === k ? '' : v;
};
