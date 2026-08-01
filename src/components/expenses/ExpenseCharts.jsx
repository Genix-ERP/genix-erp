import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatAxisTick } from '@/utils/formatCurrency';
import { CATEGORY_FALLBACK_COLORS } from './constants';

const LOCALES = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

function GlassTooltip({ active, payload, formatCompact }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl px-3 py-2">
      <div className="flex items-center gap-2">
        {d.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />}
        <span className="text-xs font-semibold text-slate-700 max-w-[180px] truncate">{d.name}</span>
      </div>
      <p className="text-sm font-bold text-slate-900 mt-0.5">{formatCompact(d.value)}</p>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="flex-1 min-h-[220px]">{children}</div>
    </div>
  );
}

function EmptyNote({ icon: Icon, text }) {
  return (
    <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500 max-w-[280px]">{text}</p>
    </div>
  );
}

// Category donut (top 5 + "Boshqa" aggregate, center total, % legend) and
// 6-month bar chart, side by side. Data comes from GET /expenses/stats.
export default function ExpenseCharts({ stats, loading, formatCompact, t, language }) {
  const donutData = useMemo(() => {
    const rows = (stats?.by_category || []).filter((r) => (r.amount || 0) > 0);
    const named = rows.map((r, i) => ({
      name: r.name || t('exp_uncategorized'),
      value: r.amount,
      color: r.color || CATEGORY_FALLBACK_COLORS[i % CATEGORY_FALLBACK_COLORS.length],
    }));
    if (named.length <= 6) return named;
    const top = named.slice(0, 5);
    const rest = named.slice(5);
    top.push({
      name: t('exp_other_aggregate'),
      value: rest.reduce((s, r) => s + r.value, 0),
      color: '#888780',
    });
    return top;
  }, [stats, t]);

  const donutTotal = useMemo(() => donutData.reduce((s, r) => s + r.value, 0), [donutData]);

  const monthData = useMemo(() => {
    const byMonth = new Map((stats?.by_month || []).map((r) => [r.month, r.amount]));
    const locale = LOCALES[language] || LOCALES.uz;
    const out = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({
        name: d.toLocaleDateString(locale, { month: 'short' }),
        value: byMonth.get(key) || 0,
      });
    }
    return out;
  }, [stats, language]);

  const hasMonthData = monthData.some((m) => m.value > 0);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[290px] rounded-2xl" />
        <Skeleton className="h-[290px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title={t('exp_chart_by_category')} icon={PieIcon}>
        {donutData.length <= 1 ? (
          <EmptyNote icon={PieIcon} text={t('exp_chart_category_empty')} />
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4 h-full">
            <div className="relative w-[180px] h-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData} dataKey="value" nameKey="name"
                    innerRadius={56} outerRadius={82} paddingAngle={2} strokeWidth={0}
                  >
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<GlassTooltip formatCompact={formatCompact} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-slate-400">{t('exp_chart_total')}</span>
                <span className="text-sm font-bold text-slate-800 max-w-[100px] text-center leading-tight">
                  {formatCompact(donutTotal)}
                </span>
              </div>
            </div>
            <ul className="flex-1 w-full space-y-1.5 min-w-0">
              {donutData.map((d, i) => {
                const pct = donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0;
                return (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600 truncate flex-1" title={d.name}>{d.name}</span>
                    <span className="text-slate-900 font-medium whitespace-nowrap">{formatCompact(d.value)}</span>
                    <span className="text-slate-400 w-9 text-right tabular-nums">{pct}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </ChartCard>

      <ChartCard title={t('exp_chart_by_month')} icon={BarChart3}>
        {!hasMonthData ? (
          <EmptyNote icon={BarChart3} text={t('exp_chart_month_empty')} />
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={monthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis
                tickLine={false} axisLine={false} width={54}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={formatAxisTick}
              />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<GlassTooltip formatCompact={formatCompact} />} />
              <Bar dataKey="value" fill="#185FA5" radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
