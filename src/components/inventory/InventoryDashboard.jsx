import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Wallet, AlertTriangle, Package, ArrowLeftRight,
  TrendingUp, BarChart3, ShoppingCart, History,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatAxisTick } from '@/utils/formatCurrency';
import inventoryService from '@/api/services/inventory';

const LOCALES = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

// Movement-type labels for the recent feed (ledger transaction_type →
// document language: Kirim/Chiqim/Ko'chirish/Inventarizatsiya).
const MOVE_LABELS = {
  receipt: { tKey: 'inv_move_receipt', cls: 'bg-emerald-50 text-emerald-600' },
  issue: { tKey: 'inv_move_issue', cls: 'bg-rose-50 text-rose-600' },
  transfer: { tKey: 'inv_move_transfer', cls: 'bg-sky-50 text-sky-600' },
  adjustment: { tKey: 'inv_move_adjustment', cls: 'bg-amber-50 text-amber-600' },
  count: { tKey: 'inv_move_count', cls: 'bg-violet-50 text-violet-600' },
  write_off: { tKey: 'inv_move_write_off', cls: 'bg-slate-100 text-slate-600' },
  scrap: { tKey: 'inv_move_write_off', cls: 'bg-slate-100 text-slate-600' },
};

function GlassTooltip({ active, payload, label, formatCompact }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl px-3 py-2">
      <span className="text-xs font-semibold text-slate-700">{payload[0]?.payload?.name ?? label}</span>
      <p className="text-sm font-bold text-slate-900 mt-0.5">{formatCompact(payload[0]?.value ?? 0)}</p>
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

// Asosiy panel — one GET /inventory/stats call feeds everything below
// (tiles, both charts, low-stock mini-table, recent feed). No context
// hydration, no client-side aggregation over 10k rows.
export default function InventoryDashboard({ t, language, formatCompact, onOpenTab }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await inventoryService.getInventoryStats();
        if (alive) setStats(data);
      } catch {
        if (alive) setStats(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totals = stats?.totals || {};

  const tiles = [
    {
      key: 'total_value', label: t('inv_stat_total_value'), icon: Wallet,
      chip: 'bg-emerald-50 text-emerald-600',
      value: formatCompact(totals.total_value || 0),
    },
    {
      key: 'low_stock', label: t('inv_stat_low_stock'), icon: AlertTriangle,
      chip: (totals.low_stock_count || 0) > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400',
      value: totals.low_stock_count || 0,
      valueCls: (totals.low_stock_count || 0) > 0 ? 'text-rose-600' : undefined,
      onClick: () => onOpenTab?.('planning'),
    },
    {
      key: 'products', label: t('inv_stat_products'), icon: Package,
      chip: 'bg-sky-50 text-sky-600',
      value: totals.product_count || 0,
      onClick: () => onOpenTab?.('products'),
    },
    {
      key: 'today_moves', label: t('inv_stat_today_moves'), icon: ArrowLeftRight,
      chip: 'bg-violet-50 text-violet-600',
      value: totals.today_movements || 0,
      onClick: () => onOpenTab?.('documents'),
    },
  ];

  const valueSeries = useMemo(() => {
    const locale = LOCALES[language] || LOCALES.uz;
    return (stats?.value_series || []).map((p) => {
      const [y, m] = (p.month || '').split('-').map(Number);
      const d = new Date(y || 2000, (m || 1) - 1, 1);
      return { name: d.toLocaleDateString(locale, { month: 'short' }), value: p.value || 0 };
    });
  }, [stats, language]);
  const hasValueSeries = valueSeries.some((p) => p.value > 0);

  const categoryData = useMemo(
    () => (stats?.category_values || []).map((c) => ({ name: c.name, value: c.value || 0 })),
    [stats],
  );

  const lowItems = stats?.low_stock_items || [];
  const recentMoves = stats?.recent_moves || [];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[110px] rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[290px] rounded-2xl" />
          <Skeleton className="h-[290px] rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[260px] rounded-2xl" />
          <Skeleton className="h-[260px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map(({ key, label, icon: Icon, chip, value, valueCls, onClick }) => (
          <div
            key={key}
            className={`glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            onClick={onClick}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm text-slate-500 truncate">{label}</p>
                <p className={`text-2xl font-bold mt-1 truncate ${valueCls || 'text-slate-900'}`}>{value}</p>
              </div>
              <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${chip}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('inv_chart_value_dynamics')} icon={TrendingUp}>
          {!hasValueSeries ? (
            <EmptyNote icon={TrendingUp} text={t('inv_chart_value_empty')} />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={valueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="invValueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#185FA5" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#185FA5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis
                  tickLine={false} axisLine={false} width={54}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={formatAxisTick}
                />
                <Tooltip content={<GlassTooltip formatCompact={formatCompact} />} />
                <Area type="monotone" dataKey="value" stroke="#185FA5" strokeWidth={2} fill="url(#invValueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('inv_chart_by_category')} icon={BarChart3}>
          {categoryData.length <= 1 ? (
            <EmptyNote icon={BarChart3} text={t('inv_chart_category_empty')} />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(230, categoryData.length * 36)}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number" tickLine={false} axisLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatAxisTick}
                />
                <YAxis
                  type="category" dataKey="name" width={110}
                  tickLine={false} axisLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<GlassTooltip formatCompact={formatCompact} />} />
                <Bar dataKey="value" fill="#185FA5" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Low stock + recent moves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">{t('inv_low_stock_title')}</h3>
            </div>
            {lowItems.length > 0 && (
              <Button
                size="sm" variant="outline" className="h-8 text-xs"
                onClick={() => navigate('/procurement')}
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                {t('inv_create_purchase')}
              </Button>
            )}
          </div>
          {lowItems.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t('inv_low_stock_empty')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowItems.map((it) => (
                <li key={it.product_id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{it.name}</p>
                    {it.code && <p className="text-xs text-slate-400">{it.code}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-rose-600 tabular-nums">{it.on_hand}</p>
                    <p className="text-[11px] text-slate-400 tabular-nums">min: {it.threshold}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">{t('inv_recent_moves_title')}</h3>
            </div>
            <Button
              size="sm" variant="ghost" className="h-8 text-xs text-slate-500"
              onClick={() => onOpenTab?.('documents')}
            >
              {t('inv_view_all')}
            </Button>
          </div>
          {recentMoves.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t('inv_recent_moves_empty')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentMoves.map((m) => {
                const meta = MOVE_LABELS[m.type] || MOVE_LABELS.adjustment;
                const qty = m.qty || 0;
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
                      {t(meta.tKey)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 truncate">{m.product_name}</p>
                      <p className="text-xs text-slate-400 truncate">{m.warehouse_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold tabular-nums ${qty >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {qty > 0 ? '+' : ''}{qty}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {m.date ? new Date(m.date).toLocaleDateString(LOCALES[language] || LOCALES.uz, { day: 'numeric', month: 'short' }) : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
