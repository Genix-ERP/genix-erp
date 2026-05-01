import { Loader2 } from 'lucide-react';

/**
 * Loader — a centered spinner with no accompanying text.
 *
 * Replaces the older "Yuklanmoqda..." text placeholders. Defaults to
 * a vertically padded block; pass `inline` for an inline spinner
 * (e.g. inside a table cell or dropdown <option>).
 *
 * Props
 *   size      — Tailwind size class (default w-6 h-6).
 *   inline    — render inline (no centering wrapper).
 *   className — extra wrapper classes (block mode only).
 *   color     — Tailwind text color (default text-slate-400).
 */
export default function Loader({
  size = 'w-6 h-6',
  inline = false,
  className = '',
  color = 'text-slate-400',
}) {
  if (inline) {
    return <Loader2 className={`${size} ${color} animate-spin inline-block`} />;
  }
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <Loader2 className={`${size} ${color} animate-spin`} />
    </div>
  );
}
