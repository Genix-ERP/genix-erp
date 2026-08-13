import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  Factory, CheckCircle2, CalendarClock, Percent, Timer, Wallet,
  BarChart3, Layers, Gauge, PackageSearch, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { productionOrdersService } from '@/api/services/manufacturing';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatAxisTick } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import {
  PAL, StatTile, ChartCard, EmptyNote, GlassTooltip, Segmented,
} from '@/components/shared/DashboardKit';
import { getApiErrorMessage } from '@/utils/apiError';

const iso = (d) => d.toISOString().split('T')[0];

// Period pills → [from, to] for GET /production-orders/stats.
const rangeToDates = (range) => {
  const now = new Date();
  switch (range) {
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(from), to: iso(to) };
    }
    case 'quarter':
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: iso(now) };
    case 'year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    case 'month':
    default:
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  }
};

// 'YYYY-MM-DD' → 'DD.MM' without going through Date/locale APIs — the app
// convention is dd.mm in every language (no en-US "Jul 3" labels).
const shortDay = (dateStr) => {
  const [, m, d] = String(dateStr || '').split('-');
  return m && d ? `${d}.${m}` : String(dateStr || '');
};

// Status → bar color. Matches the badge colors used across the module
// (identity is carried by the axis label; color is a redundant cue).
const STATUS_BAR_COLORS = {
  draft: '#94A3B8',
  confirmed: PAL[0].c,
  in_progress: PAL[4].c,
  paused: PAL[1].c,
  completed: PAL[2].c,
  done: PAL[2].c,
  cancelled: '#DC2626',
};

export default function ManufacturingDashboard({ t, language, onOpenTab }) {
  const { formatCurrencyCompact } = useCurrencyFormatter();
  const [range, setRange] = useState('month');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    productionOrdersService
      .getStats(rangeToDates(range))
      .then((data) => { if (alive) setStats(data); })
      .catch((e) => {
        console.error('Failed to load production stats:', e);
        if (alive) { setStats(null); setError(getApiErrorMessage(e, t('mfg_stats_error'))); }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const totals = stats?.totals || {};

  const daily = useMemo(
    () => (stats?.daily_series || []).map((p) => ({ ...p, label: shortDay(p.date) })),
    [stats]
  );
  const hasDaily = daily.some((p) => (p.planned || 0) > 0 || (p.produced || 0) > 0);

  const statusData = useMemo(
    () => (stats?.status_counts || []).map((s) => {
      // t() returns the KEY itself when a translation is missing, so compare
      // against the key to fall back to the raw status (a `||` never fires).
      const key = `status_${s.status}`;
      const label = t(key);
      return { ...s, label: label === key ? s.status : label };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, language]
  );
  const hasStatusData = statusData.some((s) => (s.count || 0) > 0);

  const wcLoad = stats?.work_center_load || [];
  const lateOrders = stats?.late_orders || [];
  const shortages = stats?.shortages || [];

  const scrapRate = Number(totals.scrap_rate || 0);
  const overdueCount = totals.overdue_orders ?? 0;

  const RANGE_OPTIONS = [
    { id: 'month', label: t('range_this_month') },
    { id: 'last_month', label: t('range_last_month') },
    { id: 'quarter', label: t('range_3_months') },
    { id: 'year', label: t('range_this_year') },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end"><Skeleton className="h-8 w-64 rounded-lg" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[300px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[300px] rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[280px] rounded-2xl" />
          <Skeleton className="h-[280px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm">
        <EmptyNote
          icon={AlertTriangle}
          text={error}
          cta={(
            <Button size="sm" variant="outline" onClick={retry} className="gap-1.5">
              <RotateCcw className="w-4 h-4" />
              {t('retry')}
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-end">
        <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatTile
          label={t('mfg_kpi_active_orders')}
          value={totals.active_orders ?? 0}
          sub={`${t('mfg_kpi_draft')}: ${totals.draft_orders ?? 0}`}
          icon={Factory}
          chip="bg-[#E6F1FB] text-[#0C447C]"
          onClick={() => onOpenTab('execute', 'orders')}
        />
        <StatTile
          label={t('mfg_kpi_completed_period')}
          value={totals.completed_period ?? 0}
          sub={`${totals.quantity_produced ?? 0} ${t('mfg_unit_pcs')}`}
          icon={CheckCircle2}
          chip="bg-[#E1F5EE] text-[#085041]"
          onClick={() => onOpenTab('execute', 'orders')}
        />
        <StatTile
          label={t('mfg_kpi_overdue')}
          value={overdueCount}
          icon={CalendarClock}
          chip={overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-[#FAEEDA] text-[#633806]'}
          valueCls={overdueCount > 0 ? 'text-red-600' : 'text-slate-900'}
          onClick={() => onOpenTab('execute', 'orders')}
        />
        <StatTile
          label={t('mfg_kpi_scrap_rate')}
          value={`${scrapRate.toFixed(1)}%`}
          sub={`${totals.quantity_scrapped ?? 0} ${t('mfg_unit_pcs')}`}
          icon={Percent}
          chip={scrapRate > 5 ? 'bg-red-50 text-red-600' : 'bg-[#FAECE7] text-[#712B13]'}
          valueCls={scrapRate > 5 ? 'text-red-600' : 'text-slate-900'}
        />
        <StatTile
          label={t('mfg_kpi_otd')}
          value={`${Number(totals.otd_rate || 0).toFixed(0)}%`}
          icon={Timer}
          chip="bg-[#E6F1FB] text-[#0C447C]"
        />
        <StatTile
          label={t('mfg_kpi_wip')}
          value={formatCurrencyCompact(totals.wip_value || 0)}
          icon={Wallet}
          chip="bg-[#EEEDFE] text-[#3C3489]"
        />
      </div>

      {/* Charts: plan-vs-actual + status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title={t('mfg_chart_plan_fact')} icon={BarChart3} className="min-h-[300px] lg:col-span-2">
          {hasDaily ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={daily} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="label" fontSize={11} tickLine={false} axisLine={false}
                  tick={{ fill: '#64748B' }} interval="preserveStartEnd" minTickGap={24}
                />
                <YAxis fontSize={11} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} width={44} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend
                  verticalAlign="top"
                  height={26}
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-500">{v}</span>}
                />
                <Bar
                  dataKey="produced"
                  name={t('mfg_chart_produced')}
                  fill={PAL[0].c}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  type="monotone"
                  dataKey="planned"
                  name={t('mfg_chart_planned')}
                  stroke={PAL[1].c}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={BarChart3} text={t('mfg_dash_empty_series')} />
          )}
        </ChartCard>

        <ChartCard title={t('mfg_chart_status_dist')} icon={Layers} className="min-h-[300px]">
          {hasStatusData ? (
            <ResponsiveContainer width="100%" height={Math.max(220, statusData.length * 38)}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 6, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis
                  dataKey="label" type="category" fontSize={12} width={110}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#334155' }}
                />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="count" name={t('mfg_chart_orders_axis')} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {statusData.map((s, i) => (
                    <Cell key={i} fill={STATUS_BAR_COLORS[s.status] || '#94A3B8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={Layers} text={t('mfg_dash_empty_status')} />
          )}
        </ChartCard>
      </div>

      {/* Work center load + late orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('mfg_chart_wc_load')} icon={Gauge} className="min-h-[280px]">
          {wcLoad.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, wcLoad.length * 38)}>
              <BarChart data={wcLoad} layout="vertical" margin={{ left: 6, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis
                  type="number" fontSize={11} tickLine={false} axisLine={false}
                  tick={{ fill: '#94A3B8' }} tickFormatter={(v) => `${v}%`}
                  domain={[0, (max) => Math.max(110, Math.ceil(max / 10) * 10)]}
                />
                <YAxis
                  dataKey="name" type="category" fontSize={12} width={130}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#334155' }}
                  tickFormatter={(v) => (String(v).length > 16 ? `${String(v).slice(0, 15)}…` : v)}
                />
                <Tooltip
                  content={<GlassTooltip format={(v) => `${Math.round(Number(v) || 0)}%`} />}
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                />
                <ReferenceLine x={100} stroke="#DC2626" strokeDasharray="4 4" />
                <Bar dataKey="load_percent" name={t('mfg_chart_load_pct')} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {wcLoad.map((wc, i) => (
                    <Cell key={i} fill={(wc.load_percent || 0) > 100 ? '#DC2626' : PAL[0].c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={Gauge} text={t('mfg_dash_empty_wc')} />
          )}
        </ChartCard>

        <ChartCard title={t('mfg_late_orders_title')} icon={CalendarClock} className="min-h-[280px]">
          {lateOrders.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {lateOrders.map((o, i) => (
                <button
                  key={`${o.code}-${i}`}
                  onClick={() => onOpenTab('execute', 'orders')}
                  className="w-full flex items-center justify-between gap-3 py-2.5 px-1 text-left hover:bg-slate-50/70 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 font-mono truncate">{o.code}</p>
                    <p className="text-xs text-slate-500 truncate">{o.product_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-semibold whitespace-nowrap">
                      +{o.days_late ?? 0} {t('mfg_days_late_short')}
                    </span>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">{formatDate(o.scheduled_end)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyNote icon={CalendarClock} text={t('mfg_late_orders_empty')} />
          )}
        </ChartCard>
      </div>

      {/* Critical material shortages (MRP-lite preview) */}
      <ChartCard title={t('mfg_shortages_title')} icon={PackageSearch}>
        {shortages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-semibold">{t('product')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mrp_col_required')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mrp_col_on_hand')}</th>
                  <th className="py-2 font-semibold text-right">{t('mrp_col_missing')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shortages.map((s, i) => (
                  <tr key={`${s.product_name}-${i}`}>
                    <td className="py-2.5 pr-3 text-slate-800 truncate max-w-[220px]">{s.product_name}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{s.required ?? 0}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{s.on_hand ?? 0}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-red-600">{s.missing ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-right">
              <Button size="sm" variant="outline" onClick={() => onOpenTab('plan', 'mrp')}>
                {t('mfg_open_mrp')}
              </Button>
            </div>
          </div>
        ) : (
          <EmptyNote
            icon={PackageSearch}
            text={t('mfg_shortages_empty')}
            cta={(
              <Button size="sm" variant="outline" onClick={() => onOpenTab('plan', 'mrp')}>
                {t('mfg_open_mrp')}
              </Button>
            )}
          />
        )}
      </ChartCard>
    </div>
  );
}
