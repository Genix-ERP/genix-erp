/**
 * DashboardKit — the glass-card dashboard primitives used by the rebuilt
 * module dashboards (Direktor paneli, Ombor, Xarajatlar carry local copies;
 * Xarid imports from here — new modules should too, and the local copies
 * can migrate over time).
 *
 * PAL order is the colorblind-safety mechanism: blue → orange → green →
 * violet → amber passes adjacent-pair CVD ΔE ≥ 8 (validated with the
 * dataviz palette validator); do NOT re-order it.
 */

export const PAL = [
  { c: '#185FA5', l: '#E6F1FB', d: '#0C447C' },
  { c: '#D85A30', l: '#FAECE7', d: '#712B13' },
  { c: '#1D9E75', l: '#E1F5EE', d: '#085041' },
  { c: '#534AB7', l: '#EEEDFE', d: '#3C3489' },
  { c: '#BA7517', l: '#FAEEDA', d: '#633806' },
];

const fmtCompact = (n) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
};

export function GlassTooltip({ active, payload, label, format = fmtCompact }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl px-3 py-2 min-w-[140px]">
      {label != null && label !== '' && (
        <p className="text-[11px] font-medium text-slate-400 mb-1">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-500 truncate">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-900 tabular-nums">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatTile({ label, value, sub, icon: Icon, chip, valueCls, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  // KPI figures must never be ellipsized — step the font down for long
  // values (e.g. "-143.4 mln so'm" in a 5-column row) and wrap as a last resort.
  const valueLen = String(value ?? '').length;
  const valueSize =
    valueLen > 14 ? 'text-lg tracking-tight' : valueLen > 10 ? 'text-xl' : 'text-2xl';
  return (
    <Tag
      onClick={onClick}
      className={`glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm overflow-hidden text-left w-full ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 leading-snug">{label}</p>
          <p className={`${valueSize} font-bold mt-1 leading-tight break-words ${valueCls || 'text-slate-900'}`}>{value}</p>
          {sub != null && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${chip}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Tag>
  );
}

export function ChartCard({ title, icon: Icon, children, className = '', action }) {
  return (
    <div className={`glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export function EmptyNote({ icon: Icon, text, cta }) {
  return (
    <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500 max-w-[280px]">{text}</p>
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}

export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      )}
      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              value === o.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
