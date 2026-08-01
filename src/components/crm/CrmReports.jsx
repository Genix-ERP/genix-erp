import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Filter, TrendingDown, Users, Globe2, XCircle } from 'lucide-react';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { crmReportsService } from '@/api/services/crm';

const iso = (d) => d.toISOString().slice(0, 10);

// Hisobotlar tab (CRM v2): four honest, server-computed reports —
// Voronka (stage conversion), Manbalar (win rate by source), Menejerlar
// (per-responsible), Yo'qotish sabablari. All share one date-range filter.
export default function CrmReports({ language = 'uz' }) {
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const money = (v) => (formatCurrency ? formatCurrency(v || 0) : (v || 0).toLocaleString());

  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 90 * 86400000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState(null);
  const [sources, setSources] = useState([]);
  const [managers, setManagers] = useState([]);
  const [lossReasons, setLossReasons] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { from, to };
    try {
      const [f, s, m, lr] = await Promise.all([
        crmReportsService.funnel(params).catch(() => null),
        crmReportsService.sources(params).catch(() => []),
        crmReportsService.managers(params).catch(() => []),
        crmReportsService.lossReasons(params).catch(() => null),
      ]);
      setFunnel(f);
      setSources(s);
      setManagers(m);
      setLossReasons(lr);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const funnelStages = (funnel?.stages || []).filter((s) => !s.is_won);
  const wonStageRow = (funnel?.stages || []).find((s) => s.is_won);
  const firstReached = funnelStages[0]?.reached || 0;

  return (
    <div className="space-y-6">
      {/* Date range */}
      <Card className="border-slate-200/60 bg-white/80 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <Filter className="h-4 w-4" />
            {t('crm_period') || 'Davr'}:
          </span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          <span className="text-slate-400">—</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          {funnel?.totals && (
            <span className="ml-auto text-sm text-slate-500">
              {t('crm_leads_created') || 'Yaratilgan lidlar'}: <b className="text-slate-800">{funnel.totals.created}</b>
              {' · '}{t('crm_won') || 'Yutilgan'}: <b className="text-emerald-600">{funnel.totals.won}</b> ({money(funnel.totals.won_value)})
              {' · '}{t('crm_lost') || "Yo'qotilgan"}: <b className="text-red-500">{funnel.totals.lost}</b>
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Voronka ── */}
        <Card className="border-slate-200/60 bg-white/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-[var(--genix-purple)]" />
              {t('crm_report_funnel') || 'Voronka (bosqich konversiyasi)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-4/5" /><Skeleton className="h-8 w-3/5" /></>
            ) : funnelStages.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('crm_no_data') || "Ma'lumot yo'q"}</p>
            ) : (
              <>
                {funnelStages.map((s, i) => {
                  const width = firstReached > 0 ? Math.max((s.reached / firstReached) * 100, 4) : 4;
                  const prev = i > 0 ? funnelStages[i - 1].reached : null;
                  const dropOff = prev > 0 ? Math.round(((prev - s.reached) / prev) * 100) : null;
                  return (
                    <div key={s.stage_id}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <span className="text-xs text-slate-500">
                          {s.reached} {t('crm_reached') || 'ta yetib keldi'}
                          {dropOff != null && dropOff > 0 && (
                            <span className="ml-1.5 text-red-400">−{dropOff}%</span>
                          )}
                        </span>
                      </div>
                      <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                        <div
                          className="flex h-full items-center rounded-md bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] px-2 text-[11px] font-medium text-white"
                          style={{ width: `${width}%` }}
                        >
                          {firstReached > 0 ? `${Math.round((s.reached / firstReached) * 100)}%` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {wonStageRow && (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                    <span className="font-medium text-emerald-700">{t('crm_won') || 'Yutilgan'}</span>
                    <span className="text-emerald-700">
                      {funnel.totals.won} {t('crm_pcs') || 'ta'} · {money(funnel.totals.won_value)}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Manbalar ── */}
        <Card className="border-slate-200/60 bg-white/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe2 className="h-4 w-4 text-[var(--genix-blue)]" />
              {t('crm_report_sources') || 'Manbalar'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : sources.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('crm_no_data') || "Ma'lumot yo'q"}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('source') || 'Manba'}</TableHead>
                    <TableHead className="text-right">{t('crm_leads') || 'Lidlar'}</TableHead>
                    <TableHead className="text-right">{t('crm_won') || 'Yutilgan'}</TableHead>
                    <TableHead className="text-right">{t('crm_win_rate') || 'Yutish %'}</TableHead>
                    <TableHead className="text-right">{t('crm_won_value') || 'Yutilgan summa'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s) => (
                    <TableRow key={s.source}>
                      <TableCell className="font-medium">{t(s.source) || s.source}</TableCell>
                      <TableCell className="text-right">{s.total}</TableCell>
                      <TableCell className="text-right">{s.won}</TableCell>
                      <TableCell className="text-right">{Math.round(s.win_rate)}%</TableCell>
                      <TableCell className="text-right">{money(s.won_value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Menejerlar ── */}
        <Card className="border-slate-200/60 bg-white/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-emerald-600" />
              {t('crm_report_managers') || 'Menejerlar'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : managers.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('crm_no_data') || "Ma'lumot yo'q"}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('crm_responsible') || "Mas'ul"}</TableHead>
                    <TableHead className="text-right">{t('crm_leads') || 'Lidlar'}</TableHead>
                    <TableHead className="text-right">{t('crm_won') || 'Yutilgan'}</TableHead>
                    <TableHead className="text-right">{t('crm_won_value') || 'Summa'}</TableHead>
                    <TableHead className="text-right">{t('crm_avg_cycle') || "O'rtacha sikl"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.map((m, i) => (
                    <TableRow key={m.employee_id || i}>
                      <TableCell className="font-medium">
                        {m.name || <span className="italic text-slate-400">{t('crm_unassigned') || "Mas'ul yo'q"}</span>}
                      </TableCell>
                      <TableCell className="text-right">{m.total}</TableCell>
                      <TableCell className="text-right">{m.won} ({Math.round(m.win_rate)}%)</TableCell>
                      <TableCell className="text-right">{money(m.won_value)}</TableCell>
                      <TableCell className="text-right">
                        {m.won > 0 ? `${Math.round(m.avg_cycle_days)} ${t('crm_days_short') || 'kun'}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Yo'qotish sabablari ── */}
        <Card className="border-slate-200/60 bg-white/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-red-500" />
              {t('crm_report_loss_reasons') || "Yo'qotish sabablari"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : !lossReasons || (lossReasons.reasons || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                {t('crm_no_losses') || "Bu davrda yo'qotilgan lidlar yo'q"}
              </p>
            ) : (
              <>
                {(lossReasons.reasons || []).map((r, i) => (
                  <div key={i}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {r.reason || <span className="italic text-slate-400">{t('crm_reason_unspecified') || "Sabab ko'rsatilmagan"}</span>}
                      </span>
                      <span className="text-xs text-slate-500">
                        {r.count} {t('crm_pcs') || 'ta'} · {Math.round(r.share)}%
                        {r.value > 0 && ` · ${money(r.value)}`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(r.share, 2)}%` }} />
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-xs text-slate-400">
                  {t('crm_total_lost') || "Jami yo'qotilgan"}: {lossReasons.total_lost}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
