import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  ShoppingCart, Clock, AlertTriangle, Wallet, BarChart3, Building2, Truck, Plus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { procurementService } from '@/api/services/procurement';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatAxisTick } from '@/utils/formatCurrency';
import {
  PAL, StatTile, ChartCard, EmptyNote, GlassTooltip, Segmented,
} from '@/components/shared/DashboardKit';

// Backend statuses → chip meta. Human words, no PO jargon.
export const PO_STATUS_META = {
  draft: { tKey: 'po_status_draft', className: 'bg-slate-100 text-slate-700' },
  pending_approval: { tKey: 'po_status_pending_approval', className: 'bg-amber-50 text-amber-700' },
  approved: { tKey: 'po_status_approved', className: 'bg-blue-50 text-blue-700' },
  ordered: { tKey: 'po_status_ordered', className: 'bg-indigo-50 text-indigo-700' },
  partial: { tKey: 'po_status_partial', className: 'bg-violet-50 text-violet-700' },
  received: { tKey: 'po_status_received', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { tKey: 'po_status_cancelled', className: 'bg-red-50 text-red-600' },
};

const MONTHS = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const iso = (d) => d.toISOString().split('T')[0];

// Period pills → [from, to] for the stats endpoint (order_date window).
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

export function StatusChip({ status, t }) {
  const meta = PO_STATUS_META[status] || PO_STATUS_META.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${meta.className}`}>
      {t(meta.tKey) || status}
    </span>
  );
}

export default function ProcurementDashboard({ t, language, onOpenTab }) {
  const navigate = useNavigate();
  const { formatCurrencyCompact } = useCurrencyFormatter();
  const [range, setRange] = useState('month');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    procurementService
      .getOrderStats(rangeToDates(range))
      .then((data) => { if (alive) setStats(data); })
      .catch((e) => { console.error('Failed to load purchase stats:', e); if (alive) setStats(null); })
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
  const suppliers = stats?.top_suppliers || [];
  const recent = stats?.recent_orders || [];
  const upcoming = stats?.upcoming_deliveries || [];
  const hasAnyOrders = recent.length > 0;
  const hasMonthlyData = monthly.some((p) => p.value > 0);

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
          label={t('po_stat_orders') || 'Buyurtmalar'}
          value={totals.orders_count ?? 0}
          sub={formatCurrencyCompact(totals.orders_sum || 0)}
          icon={ShoppingCart}
          chip="bg-[#E6F1FB] text-[#0C447C]"
          onClick={() => onOpenTab('orders')}
        />
        <StatTile
          label={t('po_stat_pending') || 'Kutilmoqda'}
          value={totals.pending_count ?? 0}
          sub={formatCurrencyCompact(totals.pending_sum || 0)}
          icon={Clock}
          chip="bg-[#FAEEDA] text-[#633806]"
          onClick={() => onOpenTab('orders')}
        />
        <StatTile
          label={t('po_stat_overdue') || 'Kechikkan yetkazmalar'}
          value={totals.overdue_count ?? 0}
          sub={totals.overdue_count > 0 ? (t('po_overdue_hint') || 'Muddati o‘tgan') : ' '}
          icon={AlertTriangle}
          chip="bg-red-50 text-red-600"
          valueCls={totals.overdue_count > 0 ? 'text-red-600' : 'text-slate-900'}
          onClick={() => onOpenTab('orders')}
        />
        <StatTile
          label={t('po_stat_payable') || 'Yetkazib beruvchilarga qarz'}
          value={formatCurrencyCompact(totals.payable_total || 0)}
          icon={Wallet}
          chip="bg-[#EEEDFE] text-[#3C3489]"
          onClick={() => navigate('/finance?tab=payables')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('po_chart_dynamics') || 'Xaridlar dinamikasi'} icon={BarChart3} className="min-h-[300px]">
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} />
                <YAxis fontSize={11} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} width={52} />
                <Tooltip content={<GlassTooltip format={formatCurrencyCompact} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="value" name={t('po_chart_purchases') || 'Xaridlar'} fill={PAL[0].c} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={BarChart3} text={t('po_chart_dynamics_empty') || "Oxirgi 6 oyda xaridlar bo'lmagan"} />
          )}
        </ChartCard>

        <ChartCard title={t('po_chart_top_suppliers') || 'Top yetkazib beruvchilar'} icon={Building2} className="min-h-[300px]">
          {suppliers.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, suppliers.length * 38)}>
              <BarChart data={suppliers} layout="vertical" margin={{ left: 6, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" fontSize={11} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis
                  dataKey="name" type="category" fontSize={12} width={130}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#334155' }}
                  tickFormatter={(v) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                />
                <Tooltip content={<GlassTooltip format={formatCurrencyCompact} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="value" name={t('po_chart_spend') || 'Xarid summasi'} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {suppliers.map((s, i) => (
                    <Cell key={i} fill={s.name === 'Boshqa' ? '#94A3B8' : PAL[i % PAL.length].c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote icon={Building2} text={t('po_chart_suppliers_empty') || "Bu davrda yetkazib beruvchilardan xarid bo'lmagan"} />
          )}
        </ChartCard>
      </div>

      {/* Recent orders + upcoming deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('recent_orders') || "So'nggi buyurtmalar"} icon={ShoppingCart}>
          {hasAnyOrders ? (
            <div className="divide-y divide-slate-100">
              {recent.map((po) => (
                <button
                  key={po.id}
                  onClick={() => onOpenTab('orders')}
                  className="w-full flex items-center justify-between gap-3 py-2.5 px-1 text-left hover:bg-slate-50/70 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 font-mono truncate">{po.order_number}</p>
                    <p className="text-xs text-slate-500 truncate">{po.vendor_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusChip status={po.status} t={t} />
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">{formatCurrencyCompact(po.total_amount || 0)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyNote
              icon={ShoppingCart}
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

        <ChartCard title={t('po_upcoming_deliveries') || 'Kutilayotgan yetkazmalar'} icon={Truck}>
          {upcoming.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3 font-semibold">{t('order') || 'Buyurtma'}</th>
                    <th className="py-2 pr-3 font-semibold">{t('supplier') || 'Yetkazib beruvchi'}</th>
                    <th className="py-2 pr-3 font-semibold">{t('po_expected_date') || 'Kutilgan sana'}</th>
                    <th className="py-2 font-semibold text-right">{t('amount') || 'Summa'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcoming.map((po) => (
                    <tr
                      key={po.id}
                      className={`cursor-pointer hover:bg-slate-50/70 ${po.overdue ? 'bg-red-50/60' : ''}`}
                      onClick={() => onOpenTab('orders')}
                    >
                      <td className="py-2.5 pr-3 font-mono text-slate-800">{po.order_number}</td>
                      <td className="py-2.5 pr-3 text-slate-600 truncate max-w-[160px]">{po.vendor_name}</td>
                      <td className={`py-2.5 pr-3 tabular-nums ${po.overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                        {fmtDate(po.expected_date)}
                        {po.overdue && (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase">{t('po_overdue_chip') || 'kechikkan'}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{formatCurrencyCompact(po.total_amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyNote icon={Truck} text={t('po_upcoming_empty') || "Kutilayotgan yetkazmalar yo'q"} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
