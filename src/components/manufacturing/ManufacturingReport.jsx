import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  Factory, Package, Percent, Wallet, BarChart3, TrendingDown,
  Table2, Tag, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { productionOrdersService } from '@/api/services/manufacturing';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatAxisTick } from '@/utils/formatCurrency';
import {
  PAL, StatTile, ChartCard, EmptyNote, GlassTooltip, Segmented,
} from '@/components/shared/DashboardKit';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { getApiErrorMessage } from '@/utils/apiError';

const iso = (d) => d.toISOString().split('T')[0];

// Period pills → [from, to] for GET /production-orders/report.
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

const truncate = (v, n = 16) => (String(v ?? '').length > n ? `${String(v).slice(0, n - 1)}…` : String(v ?? ''));

// Hisobot — fully server-aggregated (GET /production-orders/report), so the
// numbers cover every order in the window instead of the 1000-row context
// cap the old client-side version silently truncated at.
export default function ManufacturingReport() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [range, setRange] = useState('month');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    productionOrdersService
      .getReport(rangeToDates(range))
      .then((data) => { if (alive) setReport(data); })
      .catch((e) => {
        console.error('Failed to load manufacturing report:', e);
        if (alive) { setReport(null); setError(getApiErrorMessage(e, t('mfg_report_error'))); }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const totals = report?.totals || {};
  const byProduct = useMemo(() => report?.by_product || [], [report]);
  const byCategory = report?.by_category || [];

  // Top ~10 products by produced qty for the bar chart.
  const topProducts = useMemo(
    () => [...byProduct]
      .filter((p) => (p.produced || 0) > 0)
      .sort((a, b) => (b.produced || 0) - (a.produced || 0))
      .slice(0, 10),
    [byProduct]
  );

  // Pareto — normalize cumulative_share defensively: accept both 0–1
  // fractions and 0–100 percentages from the backend.
  const pareto = useMemo(() => {
    const rows = (report?.scrap_pareto || []).filter((s) => (s.scrapped || 0) > 0);
    const maxCum = rows.reduce((m, s) => Math.max(m, s.cumulative_share || 0), 0);
    const factor = maxCum > 0 && maxCum <= 1 ? 100 : 1;
    return rows.map((s) => ({ ...s, cumulative_pct: (s.cumulative_share || 0) * factor }));
  }, [report]);

  const scrapRate = Number(totals.scrap_rate || 0);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-2xl" />
          <Skeleton className="h-[300px] rounded-2xl" />
        </div>
        <Skeleton className="h-[280px] rounded-2xl" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label={t('mfg_report_orders')}
          value={totals.orders ?? 0}
          icon={Factory}
          chip="bg-[#E6F1FB] text-[#0C447C]"
        />
        <StatTile
          label={t('mfg_report_produced')}
          value={totals.produced ?? 0}
          sub={`${t('mfg_chart_planned')}: ${totals.planned ?? 0}`}
          icon={Package}
          chip="bg-[#E1F5EE] text-[#085041]"
        />
        <StatTile
          label={t('mfg_kpi_scrap_rate')}
          value={`${scrapRate.toFixed(1)}%`}
          sub={`${totals.scrapped ?? 0} ${t('mfg_unit_pcs')}`}
          icon={Percent}
          chip={scrapRate > 5 ? 'bg-red-50 text-red-600' : 'bg-[#FAECE7] text-[#712B13]'}
          valueCls={scrapRate > 5 ? 'text-red-600' : 'text-slate-900'}
        />
        <StatTile
          label={t('mfg_report_total_cost')}
          value={formatCurrencyCompact(totals.total_cost || 0)}
          icon={Wallet}
          chip="bg-[#EEEDFE] text-[#3C3489]"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('mfg_report_by_product')} icon={BarChart3} className="min-h-[300px]">
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, topProducts.length * 38)}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 6, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" fontSize={11} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis
                  dataKey="product_name" type="category" fontSize={12} width={130}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#334155' }}
                  tickFormatter={(v) => truncate(v)}
                />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="produced" name={t('mfg_chart_produced')} fill={PAL[0].c} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={BarChart3} text={t('mfg_report_empty')} />
          )}
        </ChartCard>

        <ChartCard title={t('mfg_report_scrap_pareto')} icon={TrendingDown} className="min-h-[300px]">
          {pareto.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={pareto} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name" fontSize={11} tickLine={false} axisLine={false}
                  tick={{ fill: '#64748B' }} tickFormatter={(v) => truncate(v, 12)}
                  interval="preserveStartEnd" minTickGap={16}
                />
                <YAxis
                  yAxisId="qty" fontSize={11} tickFormatter={formatAxisTick}
                  tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} width={44}
                />
                <YAxis
                  yAxisId="pct" orientation="right" domain={[0, 100]} fontSize={11}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} width={40}
                />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend
                  verticalAlign="top"
                  height={26}
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-500">{v}</span>}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="scrapped"
                  name={t('mfg_report_col_scrap')}
                  fill={PAL[1].c}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="cumulative_pct"
                  name={t('mfg_report_cumulative')}
                  stroke={PAL[3].c}
                  strokeWidth={2}
                  dot={{ r: 3, fill: PAL[3].c, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={TrendingDown} text={t('mfg_report_empty')} />
          )}
        </ChartCard>
      </div>

      {/* By-product table */}
      <ChartCard title={t('mfg_report_by_product_table')} icon={Table2}>
        {byProduct.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-semibold">{t('product')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_report_orders')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_chart_planned')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_chart_produced')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_report_col_scrap')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_kpi_scrap_rate')}</th>
                  <th className="py-2 font-semibold text-right">{t('mfg_report_col_cost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byProduct.map((p, i) => {
                  const rowScrap = Number(p.scrap_rate || 0);
                  return (
                    <tr key={`${p.product_name}-${i}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3 font-medium text-slate-800 truncate max-w-[220px]">{p.product_name}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{p.orders ?? 0}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{p.planned ?? 0}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-slate-800">{p.produced ?? 0}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-red-600">{p.scrapped ?? 0}</td>
                      <td className={`py-2.5 pr-3 text-right tabular-nums font-medium ${rowScrap > 5 ? 'text-red-600' : 'text-slate-600'}`}>
                        {rowScrap.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{formatCurrency(p.total_cost || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyNote icon={Table2} text={t('mfg_report_empty')} />
        )}
      </ChartCard>

      {/* Compact by-category table */}
      <ChartCard title={t('mfg_report_by_category')} icon={Tag}>
        {byCategory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-semibold">{t('category')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_report_orders')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_chart_produced')}</th>
                  <th className="py-2 pr-3 font-semibold text-right">{t('mfg_report_col_scrap')}</th>
                  <th className="py-2 font-semibold text-right">{t('mfg_report_col_cost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byCategory.map((c, i) => (
                  <tr key={`${c.category_name}-${i}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3 font-medium text-slate-800 truncate max-w-[220px]">
                      {c.category_name || t('uncategorized')}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{c.orders ?? 0}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-slate-800">{c.produced ?? 0}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-red-600">{c.scrapped ?? 0}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700">{formatCurrency(c.total_cost || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyNote icon={Tag} text={t('mfg_report_empty')} />
        )}
      </ChartCard>
    </div>
  );
}
