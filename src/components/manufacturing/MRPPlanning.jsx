import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Zap, PackageSearch, AlertTriangle, RotateCcw, ShoppingCart, Factory,
  Play, CheckCircle2, ListChecks,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { productionOrdersService, mrpService } from '@/api/services/manufacturing';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDate } from '@/utils/formatDate';
import { EmptyNote, Segmented } from '@/components/shared/DashboardKit';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// MRP v2 — the server-side netting engine drives this tab. "MRP hisoblash"
// recomputes demand/supply/recommendations; each recommendation's Bajarish
// only ever creates a DRAFT purchase requisition or DRAFT production order
// after an explicit confirm (human-approves guardrail, no auto-ordering).
// The stats-endpoint shortages stay below as a quick-glance secondary card.
export default function MRPPlanning() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();

  // Recommendations (main card)
  const [recs, setRecs] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsError, setRecsError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [reloadKey, setReloadKey] = useState(0);
  const [running, setRunning] = useState(false);
  const [runDenied, setRunDenied] = useState(false);
  const [executingIds, setExecutingIds] = useState(() => new Set());
  const [confirmRec, setConfirmRec] = useState(null);

  // Shortages (secondary card, from the stats endpoint)
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setRecsLoading(true);
    setRecsError(null);
    mrpService
      .listRecommendations(filter === 'all' ? { status: 'all' } : {})
      .then((data) => { if (alive) setRecs(Array.isArray(data) ? data : []); })
      .catch((e) => {
        console.error('Failed to load MRP recommendations:', e);
        if (alive) { setRecs([]); setRecsError(getApiErrorMessage(e, t('mrp_v2_load_failed'))); }
      })
      .finally(() => { if (alive) setRecsLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, reloadKey]);

  useEffect(() => {
    let alive = true;
    setStatsLoading(true);
    productionOrdersService
      .getStats()
      .then((data) => { if (alive) setStats(data); })
      .catch((e) => { console.error('Failed to load production shortages:', e); if (alive) setStats(null); })
      .finally(() => { if (alive) setStatsLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const runMRP = useCallback(async () => {
    setRunning(true);
    try {
      const res = await mrpService.run();
      toast.success(
        `${res?.recommendations ?? 0} ${t('mrp_v2_sum_recs')}, ${res?.demand_rows ?? 0} ${t('mrp_v2_sum_demand')}`
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      if (e?.response?.status === 403) {
        setRunDenied(true);
      } else {
        toast.error(getApiErrorMessage(e, t('mrp_v2_run_failed')));
      }
    } finally {
      setRunning(false);
    }
     
  }, [t]);

  const executeRec = useCallback(async (rec) => {
    setConfirmRec(null);
    setExecutingIds((prev) => new Set(prev).add(rec.id));
    try {
      const res = await mrpService.executeRecommendation(rec.id);
      const isMO = res?.executed_type === 'production_order';
      toast.success(isMO ? t('mrp_v2_exec_success_manufacture') : t('mrp_v2_exec_success_purchase'), {
        action: {
          label: isMO ? t('mrp_v2_open_mo') : t('mrp_v2_open_purchasing'),
          onClick: () => navigate(isMO ? '/manufacturing?tab=execute&sub=orders' : '/procurement?tab=orders'),
        },
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('mrp_v2_exec_failed')));
    } finally {
      setExecutingIds((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
     
  }, [t, navigate]);

  const shortages = useMemo(
    () => [...(stats?.shortages || [])].sort((a, b) => (b.missing || 0) - (a.missing || 0)),
    [stats]
  );

  const FILTER_OPTIONS = [
    { id: 'pending', label: t('mrp_v2_filter_pending') },
    { id: 'all', label: t('mrp_v2_filter_all') },
  ];

  const typeBadge = (type) => (
    type === 'manufacture' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EEEDFE] text-[#3C3489] whitespace-nowrap">
        <Factory className="w-3 h-3" />
        {t('mrp_v2_type_manufacture')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F1FB] text-[#0C447C] whitespace-nowrap">
        <ShoppingCart className="w-3 h-3" />
        {t('mrp_v2_type_purchase')}
      </span>
    )
  );

  const isExecuted = (rec) => rec.status === 'executed' || !!rec.executed_id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-slate-700" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl">{t('mrp_title')}</CardTitle>
                <p className="text-sm text-slate-500 mt-1">{t('mrp_subtitle_v2')}</p>
              </div>
            </div>
            {runDenied ? (
              <p className="text-xs text-slate-400">{t('mrp_v2_run_denied')}</p>
            ) : (
              <Button
                onClick={runMRP}
                disabled={running}
                className="gap-2 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shrink-0"
              >
                {running ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('mrp_v2_running')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('mrp_v2_run')}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Recommendations (main card) */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-slate-400" />
              {t('mrp_v2_recs_title')}
            </CardTitle>
            <Segmented options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recsLoading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : recsError ? (
            <EmptyNote
              icon={AlertTriangle}
              text={recsError}
              cta={(
                <Button size="sm" variant="outline" onClick={retry} className="gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  {t('retry')}
                </Button>
              )}
            />
          ) : recs.length === 0 ? (
            <EmptyNote
              icon={Zap}
              text={t('mrp_v2_empty')}
              cta={!runDenied && (
                <Button size="sm" onClick={runMRP} disabled={running} className="gap-1.5">
                  <Play className="w-4 h-4" />
                  {t('mrp_v2_run')}
                </Button>
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>{t('mrp_v2_type')}</TableHead>
                    <TableHead>{t('product')}</TableHead>
                    <TableHead className="text-right">{t('quantity')}</TableHead>
                    <TableHead>{t('mrp_v2_required_date')}</TableHead>
                    <TableHead>{t('mrp_v2_recommended_date')}</TableHead>
                    <TableHead>{t('mrp_v2_urgency')}</TableHead>
                    <TableHead>{t('mrp_v2_reason')}</TableHead>
                    <TableHead className="text-right w-36">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recs.map((rec) => (
                    <TableRow key={rec.id} className="hover:bg-slate-50/50">
                      <TableCell>{typeBadge(rec.recommendation_type)}</TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{rec.product_name}</p>
                          {rec.product_code && (
                            <p className="text-[11px] font-mono text-slate-400 truncate">{rec.product_code}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">
                        {rec.quantity ?? 0} {rec.uom || ''}
                      </TableCell>
                      <TableCell className="tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDate(rec.required_date)}
                      </TableCell>
                      <TableCell className="tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDate(rec.recommended_date)}
                      </TableCell>
                      <TableCell>
                        {rec.urgency === 'high' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 whitespace-nowrap">
                            {t('mrp_v2_urgent')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">{t('mrp_v2_normal')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-slate-500 truncate max-w-[240px]" title={rec.reason || ''}>
                          {rec.reason || '—'}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {isExecuted(rec) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E1F5EE] text-[#085041] whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('mrp_v2_executed')}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            disabled={executingIds.has(rec.id)}
                            onClick={() => setConfirmRec(rec)}
                          >
                            {executingIds.has(rec.id) ? (
                              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            {t('mrp_v2_execute')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shortages quick-glance (secondary card, stats endpoint) */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageSearch className="w-4 h-4 text-slate-400" />
            {t('mfg_shortages_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {statsLoading ? (
            <div className="p-4 space-y-3">
              {[0, 1].map((i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
            </div>
          ) : shortages.length === 0 ? (
            <EmptyNote icon={PackageSearch} text={t('mfg_shortages_empty')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>{t('product')}</TableHead>
                  <TableHead className="text-right">{t('mrp_col_required')}</TableHead>
                  <TableHead className="text-right">{t('mrp_col_on_hand')}</TableHead>
                  <TableHead className="text-right">{t('mrp_col_on_order')}</TableHead>
                  <TableHead className="text-right">{t('mrp_col_missing')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortages.map((s, i) => (
                  <TableRow key={`${s.product_name}-${i}`} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-800">{s.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">{s.required ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">{s.on_hand ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">{s.on_order ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">
                        {s.missing ?? 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Execute confirm — human-approves guardrail */}
      <AlertDialog open={!!confirmRec} onOpenChange={(open) => { if (!open) setConfirmRec(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mrp_v2_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {confirmRec && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeBadge(confirmRec.recommendation_type)}
                    <span className="text-sm font-medium text-slate-700">
                      {confirmRec.product_name} — {confirmRec.quantity ?? 0} {confirmRec.uom || ''}
                    </span>
                  </div>
                )}
                <p className="text-sm text-slate-500">
                  {confirmRec?.recommendation_type === 'manufacture'
                    ? t('mrp_v2_confirm_manufacture')
                    : t('mrp_v2_confirm_purchase')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRec && executeRec(confirmRec)}>
              {t('mrp_v2_execute')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
