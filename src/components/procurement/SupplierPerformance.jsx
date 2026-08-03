import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Award, AlertTriangle, Clock, ThumbsUp, Star, Search, Building2, Wallet, TrendingUp,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { procurementService } from '@/api/services/procurement';
import { StatTile, EmptyNote } from '@/components/shared/DashboardKit';

// Yetkazib beruvchilar KPI'lari — /purchase-orders/supplier-kpis dan.
// The old version recomputed a subset client-side over the context PO list;
// its issues/returns/lead-time columns were structurally always empty.
export default function SupplierPerformance() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrencyCompact } = useCurrencyFormatter();

  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    procurementService
      .getSupplierKPIs()
      .then((data) => { if (alive) setKpis(Array.isArray(data) ? data : []); })
      .catch((e) => console.error('Failed to load supplier KPIs:', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    let list = kpis;
    if (searchTerm) {
      list = list.filter((s) => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (performanceFilter !== 'all') {
      list = list.filter((s) => {
        if (s.on_time_rate == null) return false;
        if (performanceFilter === 'excellent') return s.on_time_rate >= 90;
        if (performanceFilter === 'good') return s.on_time_rate >= 80 && s.on_time_rate < 90;
        if (performanceFilter === 'poor') return s.on_time_rate < 80;
        return true;
      });
    }
    return list;
  }, [kpis, searchTerm, performanceFilter]);

  const withRate = kpis.filter((s) => s.on_time_rate != null);
  const avgOnTime = withRate.length
    ? withRate.reduce((sum, s) => sum + s.on_time_rate, 0) / withRate.length
    : null;
  const totalSpend = kpis.reduce((sum, s) => sum + (s.total_spend || 0), 0);
  const totalAP = kpis.reduce((sum, s) => sum + (s.ap_balance || 0), 0);

  const ratingStars = (rating) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
        </div>
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label={t('suppliers') || 'Yetkazib beruvchilar'}
          value={kpis.length}
          icon={Building2}
          chip="bg-[#E6F1FB] text-[#0C447C]"
        />
        <StatTile
          label={t('on_time_delivery') || 'O‘z vaqtida yetkazish'}
          value={avgOnTime != null ? `${avgOnTime.toFixed(0)}%` : '—'}
          icon={Clock}
          chip="bg-[#E1F5EE] text-[#085041]"
        />
        <StatTile
          label={t('total_spend') || 'Jami xarid'}
          value={formatCurrencyCompact(totalSpend)}
          icon={TrendingUp}
          chip="bg-[#FAEEDA] text-[#633806]"
        />
        <StatTile
          label={t('po_stat_payable') || 'Yetkazib beruvchilarga qarz'}
          value={formatCurrencyCompact(totalAP)}
          icon={Wallet}
          chip="bg-[#EEEDFE] text-[#3C3489]"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder={t('search_suppliers') || 'Yetkazib beruvchini qidirish...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_suppliers') || 'Hammasi'}</SelectItem>
            <SelectItem value="excellent">{t('excellent') || 'A’lo (90%+)'}</SelectItem>
            <SelectItem value="good">{t('good') || 'Yaxshi (80–89%)'}</SelectItem>
            <SelectItem value="poor">{t('poor') || 'Past (<80%)'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI table */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <EmptyNote
              icon={Award}
              text={t('no_supplier_kpis') || "Ma'lumot topilmadi — buyurtmalar va qabullar yig'ilgach KPI'lar shu yerda ko'rinadi"}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('supplier') || 'Yetkazib beruvchi'}</TableHead>
                    <TableHead className="text-right">{t('total_spend') || 'Jami xarid'}</TableHead>
                    <TableHead className="text-center">{t('open_pos') || 'Ochiq buyurtmalar'}</TableHead>
                    <TableHead className="text-right">{t('debt') || 'Qarz'}</TableHead>
                    <TableHead className="text-center">{t('avg_delivery_days') || 'O‘rt. yetkazish (kun)'}</TableHead>
                    <TableHead className="text-center">{t('on_time') || 'O‘z vaqtida'}</TableHead>
                    <TableHead className="text-center">{t('returns') || 'Qaytarishlar'}</TableHead>
                    <TableHead className="text-center">{t('rating') || 'Reyting'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.vendor_id}>
                      <TableCell className="font-medium text-slate-800">
                        {s.name}
                        {s.last_order_date && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {t('last_order') || 'Oxirgi buyurtma'}: {new Date(s.last_order_date).toLocaleDateString('ru-RU')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrencyCompact(s.total_spend || 0)}
                        <p className="text-[11px] text-slate-400 font-normal">{s.orders_count} {t('orders_short') || 'ta'}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        {s.open_pos > 0 ? (
                          <div>
                            <Badge variant="secondary">{s.open_pos}</Badge>
                            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{formatCurrencyCompact(s.open_amount || 0)}</p>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${s.ap_balance > 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                        {s.ap_balance ? formatCurrencyCompact(s.ap_balance) : '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {s.avg_delivery_days != null ? Math.round(s.avg_delivery_days) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.on_time_rate != null ? (
                          <span className={`text-sm font-medium ${s.on_time_rate >= 90 ? 'text-emerald-600' : s.on_time_rate >= 80 ? 'text-slate-700' : 'text-orange-600'}`}>
                            {s.on_time_rate.toFixed(0)}%
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.returns_count > 0 ? (
                          <Badge variant={s.returns_count > 3 ? 'destructive' : 'secondary'}>{s.returns_count}</Badge>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.rating != null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {ratingStars(s.rating)}
                            <span className="text-[11px] text-slate-400">{s.rating.toFixed(1)}</span>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action items — late or return-heavy suppliers */}
      {(() => {
        const flagged = kpis.filter(
          (s) => (s.on_time_rate != null && s.on_time_rate < 80) || s.returns_count > 3
        );
        if (flagged.length === 0) {
          return (
            <div className="text-center py-4 text-slate-400 text-sm flex items-center justify-center gap-2">
              <ThumbsUp className="w-4 h-4" />
              {t('no_action_items') || 'Barcha yetkazib beruvchilar yaxshi ishlayapti'}
            </div>
          );
        }
        return (
          <div className="space-y-2">
            {flagged.slice(0, 5).map((s) => (
              <div key={s.vendor_id} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-slate-800">{s.name}</span>
                  <span className="text-slate-600">
                    {s.on_time_rate != null && s.on_time_rate < 80 && ` — ${t('on_time_delivery') || "o'z vaqtida yetkazish"}: ${s.on_time_rate.toFixed(0)}%`}
                    {s.returns_count > 3 && ` — ${s.returns_count} ${t('returns') || 'qaytarish'}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
