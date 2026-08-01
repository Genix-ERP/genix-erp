// App-wide date display formatting. The product convention is dd.mm.yyyy in
// every language (matches the dominant date-fns 'dd.MM.yyyy' usage) — do NOT
// use locale-dependent toLocaleDateString for displaying dates.
//
// These are for DISPLAY only. <input type="date"> values and API payloads
// stay ISO (yyyy-mm-dd).

const pad = (n) => String(n).padStart(2, '0');

// formatDate('2026-08-01T00:00:00Z' | Date | timestamp) → '01.08.2026'
export function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// formatDateTime(...) → '01.08.2026 14:30'
export function formatDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
