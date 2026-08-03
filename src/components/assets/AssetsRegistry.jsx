/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Search, Landmark, TrendingDown, Wallet, Activity, LineChart as LineChartIcon,
  MonitorX, Settings2,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  PAL, StatTile, ChartCard, EmptyNote, GlassTooltip, Segmented,
} from '@/components/shared/DashboardKit';
import { statusLabel, STATUS_META } from './assetUtils';

const fmtCompact = (n) => {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
};

/**
 * Aktivlar tab: stat strip → NBV trend → filterable registry table.
 * Row click opens the asset card panel (owned by the page).
 */
export default function AssetsRegistry({
  assets, stats, loading, mapping, t, formatCurrency,
  canCreate, canEditSettings, onAdd, onOpenAsset, onOpenSettings,
}) {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = useMemo(
    () => (mapping?.categories || []).filter((c) => c.is_active !== false),
    [mapping],
  );
  const noMapping = mapping && (categories.length === 0 || (mapping.departments || []).length === 0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (assets || []).filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && a.category_id !== categoryFilter) return false;
      if (needle && !`${a.name} ${a.inventory_number} ${a.serial_number}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [assets, q, statusFilter, categoryFilter]);

  const inService = stats?.by_status?.find((s) => s.status === 'in_service')?.count || 0;
  const conserved = stats?.by_status?.find((s) => s.status === 'conserved')?.count || 0;
  const trend = (stats?.nbv_trend || []).filter((p) => p.nbv !== 0 || stats?.total_book_value > 0);
  const hasTrend = trend.length >= 2 && trend.some((p) => p.nbv > 0);

  return (
    <div className="space-y-4">
      {noMapping && (
        <div className="glass-card rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            {t('mapping_missing_hint') || "Kategoriya/bo'lim hisoblari sozlanmagan — aktiv qo'shishdan oldin mapping kerak."}
          </p>
          {canEditSettings && (
            <Button size="sm" variant="outline" onClick={onOpenSettings}>
              <Settings2 className="w-4 h-4 mr-1.5" />
              {t('open_settings') || 'Sozlamalar'}
            </Button>
          )}
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label={t('total_assets') || 'Jami aktivlar'}
          value={loading ? '…' : `${stats?.total_count ?? 0}`}
          sub={loading ? '' : `${t('cost') || 'Tannarx'}: ${formatCurrency(stats?.total_cost || 0)}`}
          icon={Landmark} chip="bg-blue-50 text-blue-600"
        />
        <StatTile
          label={t('book_value') || 'Qoldiq qiymat'}
          value={loading ? '…' : formatCurrency(stats?.total_book_value || 0)}
          sub={stats?.fully_depreciated > 0
            ? `${stats.fully_depreciated} ${t('fa_fully_depreciated_short') || "to'liq amortizatsiyalangan"}`
            : undefined}
          icon={Wallet} chip="bg-emerald-50 text-emerald-600"
        />
        <StatTile
          label={t('fa_month_depreciation') || 'Bu oy amortizatsiya'}
          value={loading ? '…' : formatCurrency(stats?.month_depreciation || 0)}
          sub={stats?.month_period}
          icon={TrendingDown} chip="bg-orange-50 text-orange-600"
        />
        <StatTile
          label={t('fa_status_breakdown') || 'Holatlar'}
          value={loading ? '…' : `${inService} / ${conserved}`}
          sub={`${t('fa_status_in_service') || 'Foydalanishda'} / ${t('fa_status_conserved') || 'Konservatsiyada'}`}
          icon={Activity} chip="bg-violet-50 text-violet-600"
        />
      </div>

      {/* NBV trend — single series, house palette, hover tooltip */}
      <ChartCard title={t('fa_nbv_trend') || "Qoldiq qiymat dinamikasi (12 oy)"} icon={LineChartIcon} className="h-[260px]">
        {loading ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : !hasTrend ? (
          <EmptyNote
            icon={LineChartIcon}
            text={t('fa_nbv_trend_empty') || "Grafik uchun ma'lumot hali yetarli emas — aktivlar foydalanishga topshirilib, amortizatsiya post qilingach chiziq shakllanadi."}
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} />
              <Tooltip content={<GlassTooltip format={(v) => formatCurrency(v)} />} />
              <Line
                type="monotone" dataKey="nbv" name={t('book_value') || 'Qoldiq qiymat'}
                stroke={PAL[0].c} strokeWidth={2} dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Registry */}
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mr-auto">
            {t('fixed_assets') || 'Asosiy vositalar'}
            <span className="ml-2 text-xs font-normal text-slate-400">{filtered.length}</span>
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-8 h-9 w-52"
              placeholder={t('search') || 'Qidirish...'}
              value={q} onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Segmented
            options={[
              { id: 'all', label: t('all') || 'Barchasi' },
              { id: 'in_service', label: statusLabel(t, 'in_service') },
              { id: 'draft', label: statusLabel(t, 'draft') },
              { id: 'conserved', label: statusLabel(t, 'conserved') },
              { id: 'disposed', label: statusLabel(t, 'disposed') },
            ]}
            value={statusFilter} onChange={setStatusFilter}
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder={t('category') || 'Kategoriya'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_categories') || 'Barcha kategoriyalar'}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name_uz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button size="sm" onClick={onAdd} disabled={noMapping}>
              <Plus className="w-4 h-4 mr-1.5" />
              {t('add_asset') || "Aktiv qo'shish"}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyNote
            icon={MonitorX}
            text={
              (assets || []).length === 0
                ? (t('fa_empty_registry') || "Hali aktivlar yo'q. Ekskavator, kran yoki ofis jihozlari — birinchisini qo'shing, amortizatsiya avtomatik hisoblanadi.")
                : (t('fa_empty_filter') || 'Filtrga mos aktiv topilmadi.')
            }
            cta={canCreate && (assets || []).length === 0 && !noMapping && (
              <Button size="sm" onClick={onAdd}>
                <Plus className="w-4 h-4 mr-1.5" />
                {t('fa_add_first') || "Birinchi aktivni qo'shish"}
              </Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="p-3">{t('inventory_number') || 'Inv. raqam'}</th>
                  <th className="p-3">{t('name') || 'Nomi'}</th>
                  <th className="p-3">{t('category') || 'Kategoriya'}</th>
                  <th className="p-3">{t('fa_responsible_employee') || 'Javobgar'}</th>
                  <th className="p-3">{t('fa_location_object') || 'Obyekt / joy'}</th>
                  <th className="p-3 text-right">{t('cost') || 'Tannarx'}</th>
                  <th className="p-3 text-right">{t('accumulated') || "Yig'ilgan iznos"}</th>
                  <th className="p-3 text-right">{t('book_value') || 'Qoldiq qiymat'}</th>
                  <th className="p-3">{t('status') || 'Holat'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => onOpenAsset(a.id)}
                  >
                    <td className="p-3 font-mono text-xs">{a.inventory_number}</td>
                    <td className="p-3 font-medium text-slate-800">{a.name}</td>
                    <td className="p-3 text-slate-500">{a.category_name}</td>
                    <td className="p-3 text-slate-500">{a.assigned_employee_name || '—'}</td>
                    <td className="p-3 text-slate-500">{a.construction_object_name || '—'}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(a.cost)}</td>
                    <td className="p-3 text-right tabular-nums text-slate-500">{formatCurrency(a.accumulated_depreciation)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatCurrency(a.book_value)}</td>
                    <td className="p-3">
                      <Badge className={STATUS_META[a.status]?.cls || ''}>{statusLabel(t, a.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
