import { Wallet, Clock3, Banknote, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Amount-first stat tiles fed by GET /expenses/stats (whole-tenant
// aggregates — the old page computed these over the first 20 rows only).
// Each tile: compact amount as the hero number, count underneath.
const TILES = [
  { key: 'total', tKey: 'exp_stat_total', icon: Wallet, chip: 'bg-sky-50 text-sky-600' },
  { key: 'pending_approval', tKey: 'exp_stat_pending_approval', icon: Clock3, chip: 'bg-amber-50 text-amber-600' },
  { key: 'pending_payment', tKey: 'exp_stat_pending_payment', icon: Banknote, chip: 'bg-violet-50 text-violet-600' },
  { key: 'paid', tKey: 'exp_stat_paid', icon: CheckCircle2, chip: 'bg-emerald-50 text-emerald-600' },
];

export default function ExpenseStatsCards({ stats, loading, formatCompact, t }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {TILES.map(({ key, tKey, icon: Icon, chip }) => {
        const bucket = stats?.[key] || { count: 0, amount: 0 };
        return (
          <div key={key} className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm text-slate-500 truncate">{t(tKey)}</p>
                {loading ? (
                  <Skeleton className="h-8 w-28 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-slate-900 mt-1 truncate">
                    {formatCompact(bucket.amount || 0)}
                  </p>
                )}
                {!loading && (
                  <p className="text-xs text-slate-400 mt-1">
                    {bucket.count || 0} {t('exp_records_suffix')}
                  </p>
                )}
              </div>
              <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${chip}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
