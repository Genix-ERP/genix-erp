/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Play, Loader2, RotateCcw, AlertTriangle, CalendarClock, CheckCircle2,
} from 'lucide-react';
import { EmptyNote } from '@/components/shared/DashboardKit';
import { fixedAssetsV2Service as fa } from '@/api/services/fixedAssetsV2';
import { errMsg, fmtDate } from './assetUtils';

const RUN_STATUS = {
  draft: { cls: 'bg-slate-100 text-slate-700', key: 'fa_run_draft', fb: 'Qoralama' },
  posted: { cls: 'bg-green-100 text-green-800', key: 'fa_run_posted', fb: "O'tkazilgan" },
  reversed: { cls: 'bg-red-100 text-red-700', key: 'fa_run_reversed', fb: 'Revers qilingan' },
};

/**
 * The Amortizatsiya tab is a run JOURNAL (1C/Odoo pattern): every period is a
 * row — status, total, who posted — with draft → review → post → reverse in
 * dialogs, a month picker instead of window.prompt, and unposted-gap warnings.
 */
export default function DepreciationRunsTab({ t, canApprove, formatCurrency, onPosted }) {
  const [data, setData] = useState(null); // { runs, unposted_gaps, suggested_period }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [run, setRun] = useState(null); // run detail modal

  const load = useCallback(() => {
    setLoading(true);
    fa.listRuns()
      .then((d) => { setData(d); setPeriod(d?.suggested_period || ''); })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const createRun = async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast.error(t('fa_invalid_period') || 'Davr formati YYYY-MM');
      return;
    }
    setBusy(true);
    try {
      const r = await fa.createRun(period);
      setCreateOpen(false);
      setRun(r);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const postRun = async () => {
    setBusy(true);
    try {
      const r = await fa.postRun(run.id);
      setRun(r);
      toast.success(t('run_posted') || "Reglament o'tkazildi");
      load();
      onPosted?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const reverseRun = async () => {
    setBusy(true);
    try {
      await fa.reverseRun(run.id);
      toast.success(t('run_reversed') || 'Revers qilindi');
      setRun(null);
      load();
      onPosted?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const openRun = (id) => {
    fa.getRun(id).then(setRun).catch((e) => toast.error(errMsg(e)));
  };

  const gaps = data?.unposted_gaps || [];
  const runs = data?.runs || [];

  return (
    <div className="space-y-4">
      {gaps.length > 0 && (
        <div className="glass-card rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">{t('fa_gap_warning_title') || "O'tkazilmagan davrlar bor"}</p>
            <p className="text-xs mt-0.5">
              {(t('fa_gap_warning_text') || 'Quyidagi oylar uchun amortizatsiya post qilinmagan:')}{' '}
              <span className="font-mono">{gaps.join(', ')}</span>
            </p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">{t('fa_run_journal') || 'Amortizatsiya reglamentlari'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('fa_run_journal_hint') || 'Har oy uchun bitta reglament: qoralama → tekshirish → o\'tkazish. Tuzatish faqat revers bilan.'}
            </p>
          </div>
          {canApprove && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Play className="w-4 h-4 mr-1.5" />
              {t('run_depreciation') || 'Amortizatsiyani hisoblash'}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : runs.length === 0 ? (
          <EmptyNote
            icon={CalendarClock}
            text={t('fa_no_runs') || "Hali reglament yo'q. Birinchi oylik amortizatsiyani hisoblang — tizim har oyning 1-kunida avtomatik qoralama ham yaratadi."}
            cta={canApprove && (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                {t('fa_first_run_cta') || 'Birinchi reglament'}
              </Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="p-3">{t('period') || 'Davr'}</th>
                  <th className="p-3">{t('status') || 'Holat'}</th>
                  <th className="p-3 text-right">{t('fa_run_total') || 'Jami summa'}</th>
                  <th className="p-3 text-right">{t('fa_run_lines') || 'Aktivlar'}</th>
                  <th className="p-3">{t('fa_posted_by') || 'Kim o\'tkazdi'}</th>
                  <th className="p-3">{t('fa_posted_at') || 'Sana'}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => openRun(r.id)}>
                    <td className="p-3 font-mono">{r.period}</td>
                    <td className="p-3">
                      <Badge className={RUN_STATUS[r.status]?.cls || ''}>
                        {t(RUN_STATUS[r.status]?.key) || RUN_STATUS[r.status]?.fb || r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatCurrency(r.total)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {r.line_count}
                      {r.skipped_count > 0 && <span className="text-amber-600"> (+{r.skipped_count} skip)</span>}
                    </td>
                    <td className="p-3 text-slate-500">{r.posted_by_name || '—'}</td>
                    <td className="p-3 text-slate-500">{r.posted_at ? fmtDate(r.posted_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create run — month picker, current month warned as incomplete */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('run_depreciation') || 'Amortizatsiyani hisoblash'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t('period') || 'Davr'} *</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            {period >= new Date().toISOString().slice(0, 7) && (
              <p className="text-xs text-amber-600">
                {t('fa_current_month_warning') || 'Bu oy hali tugamagan — odatda tugagan oy uchun hisoblanadi.'}
              </p>
            )}
            <p className="text-xs text-slate-400">
              {t('fa_run_hint') || "Qoralama yaratiladi; ko'rib chiqib keyin o'tkazasiz. Bir davr uchun faqat bitta reglament."}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={createRun} disabled={busy || !period}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('fa_create_draft') || 'Qoralama yaratish'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Run detail — lines, totals by pair, skipped, post/reverse */}
      <Dialog open={!!run} onOpenChange={(o) => !o && setRun(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {run && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(t('depreciation_run') || 'Reglament')} {run.period}
                  <Badge className={RUN_STATUS[run.status]?.cls || ''}>
                    {t(RUN_STATUS[run.status]?.key) || RUN_STATUS[run.status]?.fb || run.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="rounded-xl bg-slate-50 p-3 text-sm flex items-center justify-between">
                <span className="text-slate-500">{t('grand_total') || 'Jami'}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(run.grand_total)}</span>
              </div>
              {Object.entries(run.totals_by_pair || {}).map(([pair, amt]) => (
                <div key={pair} className="flex items-center justify-between text-xs text-slate-500 px-3">
                  <span className="font-mono">Дт/Кт {pair}</span>
                  <span className="tabular-nums">{formatCurrency(amt)}</span>
                </div>
              ))}

              {(run.lines || []).length > 0 && (
                <div className="rounded-xl border border-slate-200/60 overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-500">
                        <th className="p-2">{t('inventory_number') || 'Inv. raqam'}</th>
                        <th className="p-2">{t('name') || 'Nomi'}</th>
                        <th className="p-2">Дт/Кт</th>
                        <th className="p-2 text-right">{t('amount') || 'Summa'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.lines.map((l) => (
                        <tr key={l.asset_id} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 font-mono">{l.inventory_number}</td>
                          <td className="p-2">{l.name}</td>
                          <td className="p-2 text-slate-400">{l.debit_account}/{l.credit_account}</td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(run.skipped || []).length > 0 && (
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3">
                  <p className="text-xs font-medium text-amber-800 mb-1">
                    {t('fa_skipped_assets') || "O'tkazib yuborilganlar"}
                  </p>
                  {run.skipped.map((s, i) => (
                    <p key={i} className="text-xs text-amber-700 font-mono">
                      {s.inventory_number}: {s.reason}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                {canApprove && run.status === 'draft' && (
                  <Button onClick={postRun} disabled={busy || (run.lines || []).length === 0}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    {t('fa_post_run') || "O'tkazish (post)"}
                  </Button>
                )}
                {canApprove && run.status === 'posted' && (
                  <Button variant="destructive" onClick={reverseRun} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                    {t('reverse') || 'Revers'}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
