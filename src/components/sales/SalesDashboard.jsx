import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  ShoppingBag, Wallet, AlertTriangle, Truck, BarChart3, Users, Receipt, Plus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { salesService } from '@/api/services/sales';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatAxisTick } from '@/utils/formatCurrency';
import {
  PAL, StatTile, ChartCard, EmptyNote, GlassTooltip, Segmented,
} from '@/components/shared/DashboardKit';
import { ORDER_STATUS_STYLES } from './orderStatus';

const MONTHS = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const iso = (d) => d.toISOString().split('T')[0];

// Period pills → [from, to] for GET /sales-orders/stats (order_date window).
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

function StatusChip({ status, t }) {
  const meta = ORDER_STATUS_STYLES[status] || ORDER_STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${meta.className}`}>
      {t(meta.tKey) || status}
    </span>
  );
}

export default function SalesDashboard({ t, language, onOpenTab }) {
  const { formatCurrencyCompact } = useCurrencyFormatter();
  const [range, setRange] = useState('month');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    salesService
      .getStats(rangeToDates(range))
      .then((data) => { if (alive) setStats(data); })
      .catch((e) => { console.error('Failed to load sales stats:', e); if (alive) setStats(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [range]);

  const months = MONTHS[language] || MONTHS.uz;
  const monthLabel = (key) => {
    const m = parseInt(String(key).split('-')[1], 10);
    return Number.isNaN(m) ? key : months[m - 1];
  };

  const totals = stats?.totals || {};
  const monthly = useMemo(
    () => (stats?.monthly_series || []).map((p) => ({ ...p, label: monthLabel(p.month) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, language]
  );
  const customers = stats?.top_customers || [];
  const recent = stats?.recent_orders || [];
  const overdue = stats?.overdue_invoices || [];
  const hasMonthlyData = monthly.some((p) => (p.orders_sum || 0) > 0 || (p.paid_sum || 0) > 0);
  const unpaidOver30 = totals.unpaid_over_30d || 0;

  const RANGE_OPTIONS = [
    { id: 'month', label: t('range_this_month') || 'Bu oy' },
    { id: 'last_month', label: t('range_last_month') || "O'tgan oy" },
    { id: 'quarter', label: t('range_3_months') || '3 oy' },
    { id: 'year', label: t('range_this_year') || 'Bu yil' },
  ];

  const fmtDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[280px] rounded-2xl" />
          <Skeleton className="h-[280px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-end">
        <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label={t('sales_dashboard_orders') || 'Buyurtmalar'}
          value={totals.orders_count ?? 0}
          sub={formatCurrencyCompact(totals.orders_sum || 0)}
          icon={ShoppingBag}
          chip="bg-[#E6F1FB] text-[#0C447C]"
          onClick={() => onOpenTab('orders')}
        />
        <StatTile
          label={t('sales_dashboard_revenue_paid') || "Daromad (to'langan)"}
          value={formatCurrencyCompact(totals.revenue_paid || 0)}
          icon={Wallet}
          chip="bg-[#E1F5EE] text-[#085041]"
          onClick={() => onOpenTab('invoices')}
        />
        <StatTile
          label={t('sales_dashboard_unpaid') || "To'lanmagan"}
          value={formatCurrencyCompact(totals.unpaid_total || 0)}
          sub={unpaidOver30 > 0
            ? `${t('sales_dashboard_unpaid_over30') || '30+ kun'}: ${formatCurrencyCompact(unpaidOver30)}`
            : ' '}
          icon={AlertTriangle}
          chip={unpaidOver30 > 0 ? 'bg-red-50 text-red-600' : 'bg-[#FAEEDA] text-[#633806]'}
          valueCls={unpaidOver30 > 0 ? 'text-red-600' : 'text-slate-900'}
          onClick={() => onOpenTab('invoices')}
        />
        <StatTile
          label={t('sales_dashboard_undelivered') || 'Yetkazilmagan buyurtmalar'}
          value={totals.undelivered_orders ?? 0}
          icon={Truck}
          chip="bg-[#EEEDFE] text-[#3C3489]"
          onClick={() => onOpenTab('orders')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('sales_dynamics') || 'Savdo dinamikasi'} icon={BarChart3} className="min-h-[300px]">
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthly} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} />
                <YAxis fontSize={11} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} width={52} />
                <Tooltip content={<GlassTooltip format={formatCurrencyCompact} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend
                  verticalAlign="top"
                  height={26}
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-500">{v}</span>}
                />
                <Bar
                  dataKey="orders_sum"
                  name={t('sales_chart_orders') || 'Buyurtmalar'}
                  fill={PAL[0].c}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                />
                <Line
                  type="monotone"
                  dataKey="paid_sum"
                  name={t('sales_chart_paid') || "To'langan"}
                  stroke={PAL[2].c}
                  strokeWidth={2}
                  dot={{ r: 3, fill: PAL[2].c, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={BarChart3} text={t('sales_dynamics_empty') || "Oxirgi 6 oyda savdo bo'lmagan"} />
          )}
        </ChartCard>

        <ChartCard title={t('top_customers') || 'Top mijozlar'} icon={Users} className="min-h-[300px]">
          {customers.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, customers.length * 38)}>
              <BarChart data={customers} layout="vertical" margin={{ left: 6, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" fontSize={11} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis
                  dataKey="name" type="category" fontSize={12} width={130}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#334155' }}
                  tickFormatter={(v) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                />
                <Tooltip content={<GlassTooltip format={formatCurrencyCompact} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="total" name={t('sales_chart_orders') || 'Savdo summasi'} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {customers.map((c, i) => (
                    <Cell key={i} fill={c.name === 'Boshqa' ? '#94A3B8' : PAL[i % PAL.length].c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={Users} text={t('top_customers_empty') || "Bu davrda mijozlarga savdo bo'lmagan"} />
          )}
        </ChartCard>
      </div>

      {/* Recent orders + overdue invoices (the daily chase list) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('recent_orders') || "So'nggi buyurtmalar"} icon={ShoppingBag}>
          {recent.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recent.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onOpenTab('orders')}
                  className="w-full flex items-center justify-between gap-3 py-2.5 px-1 text-left hover:bg-slate-50/70 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 font-mono truncate">{o.order_number}</p>
                    <p className="text-xs text-slate-500 truncate">{o.customer_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusChip status={o.status} t={t} />
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">{formatCurrencyCompact(o.total_amount || 0)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyNote
              icon={ShoppingBag}
              text={t('po_empty_orders') || "Hali buyurtmalar yo'q"}
              cta={(
                <Button size="sm" onClick={() => onOpenTab('orders')} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  {t('po_empty_orders_cta') || 'Birinchi buyurtmani yaratish'}
                </Button>
              )}
            />
          )}
        </ChartCard>

        <ChartCard title={t('overdue_invoices') || "Muddati o'tgan hisob-fakturalar"} icon={Receipt}>
          {overdue.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3 font-semibold">{t('invoice_number') || 'Hisob-faktura'}</th>
                    <th className="py-2 pr-3 font-semibold">{t('customer') || 'Mijoz'}</th>
                    <th className="py-2 pr-3 font-semibold">{t('due_date') || 'Muddat'}</th>
                    <th className="py-2 font-semibold text-right">{t('amount') || 'Summa'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdue.map((inv) => (
                    <tr
                      key={inv.id}
                      className="cursor-pointer hover:bg-slate-50/70"
                      onClick={() => onOpenTab('invoices')}
                    >
                      <td className="py-2.5 pr-3 font-mono text-slate-800">{inv.invoice_number}</td>
                      <td className="py-2.5 pr-3 text-slate-600 truncate max-w-[140px]">{inv.customer_name}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-600">
                        {fmtDate(inv.due_date)}
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold whitespace-nowrap">
                          +{inv.days_overdue} {t('days_overdue_short') || 'kun'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-medium text-red-600">
                        {formatCurrencyCompact(inv.amount_due || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyNote icon={Receipt} text={t('sales_overdue_empty') || "Muddati o'tgan hisob-fakturalar yo'q"} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
