import { useState, useEffect, useCallback } from 'react';
import { History, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import inventoryService from '@/api/services/inventory';

// Yagona harakatlar ro'yxati (ledger) — Hujjatlar tabining "Harakatlar"
// bo'limi. Server-side filtrlar: type + pagination; hujjat tilida
// (Kirim/Chiqim/Ko'chirish/...) chip filtrlar.
const TYPE_CHIPS = [
  { key: '', tKey: 'inv_mv_all' },
  { key: 'receipt', tKey: 'inv_move_receipt' },
  { key: 'issue', tKey: 'inv_move_issue' },
  { key: 'transfer', tKey: 'inv_move_transfer' },
  { key: 'adjustment', tKey: 'inv_move_adjustment' },
  { key: 'count', tKey: 'inv_move_count' },
  { key: 'write_off', tKey: 'inv_move_write_off' },
];

const TYPE_BADGES = {
  receipt: 'bg-emerald-50 text-emerald-600',
  issue: 'bg-rose-50 text-rose-600',
  transfer: 'bg-sky-50 text-sky-600',
  transfer_in: 'bg-sky-50 text-sky-600',
  transfer_out: 'bg-sky-50 text-sky-600',
  adjustment: 'bg-amber-50 text-amber-600',
  count: 'bg-violet-50 text-violet-600',
  write_off: 'bg-slate-100 text-slate-600',
  scrap: 'bg-slate-100 text-slate-600',
};

const PAGE_SIZE = 25;

export default function InventoryMovements({ t, language }) {
  const { formatCurrencyCompact } = useCurrencyFormatter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total: totalCount } = await inventoryService.listInventoryMovementsPaged({
        page,
        limit: PAGE_SIZE,
        ...(typeFilter ? { type: typeFilter } : {}),
      });
      setRows(items);
      setTotal(totalCount || items.length);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const locale = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }[language] || 'uz-UZ';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TYPE_CHIPS.map(({ key, tKey }) => (
          <button
            key={key || 'all'}
            type="button"
            onClick={() => { setTypeFilter(key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === key
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t(tKey)}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-14 flex flex-col items-center text-center px-6">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <History className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">{t('inv_recent_moves_empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="px-4 py-3 font-medium">{t('inv_mv_date')}</th>
                  <th className="px-4 py-3 font-medium">{t('inv_mv_type')}</th>
                  <th className="px-4 py-3 font-medium">{t('inv_mv_product')}</th>
                  <th className="px-4 py-3 font-medium">{t('inv_mv_warehouse')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('inv_mv_qty')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('inv_mv_value')}</th>
                  <th className="px-4 py-3 font-medium">{t('inv_mv_reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((m) => {
                  const qty = Number(m.quantity) || 0;
                  const badge = TYPE_BADGES[m.transaction_type] || TYPE_BADGES.adjustment;
                  const chip = TYPE_CHIPS.find((c) => c.key === m.transaction_type);
                  const wh = m.transaction_type === 'transfer'
                    ? `${m.from_warehouse_name || '—'} → ${m.to_warehouse_name || '—'}`
                    : (m.to_warehouse_name || m.from_warehouse_name || '—');
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {m.transaction_date
                          ? new Date(m.transaction_date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
                          : ''}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badge}`}>
                          {chip ? t(chip.tKey) : m.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-800 max-w-[220px] truncate" title={m.product_name}>{m.product_name}</p>
                        {m.product_code && <p className="text-xs text-slate-400">{m.product_code}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 max-w-[180px] truncate">{wh}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${qty >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {qty > 0 ? '+' : ''}{qty}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums whitespace-nowrap">
                        {formatCurrencyCompact(Number(m.total_cost) || 0)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 max-w-[220px] truncate" title={m.reason || m.notes}>
                        {m.reason || m.notes || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-slate-400">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" className="h-8 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
