import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Plus, Calendar, Lock, Unlock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, History, RotateCcw, FileText, ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { toast } from 'sonner';
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { financeService } from '@/api/services/finance';
import { getApiErrorMessage } from '@/utils/apiError';

// "Davrlar" — THE single period surface (moliya-v2 conventions §1).
// Replaces FiscalPeriods.jsx ("Moliyaviy davrlar") and AccountingPeriods.jsx
// ("Hisob davrlari") in the nav. fiscal_years → 12 monthly fiscal_periods
// (auto-created server-side, migration 478); the close action runs the REAL
// close procedure (POST /period-close/run: Dt=Kt check, no-drafts check,
// closing JE 9xxx→9900) — not a status label flip.

const glassCard = "bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-sm";

const fmtDate = (d) => {
  if (!d) return '-';
  try { return format(new Date(d), 'dd.MM.yyyy'); } catch { return '-'; }
};

export default function FiscalPeriodsV2() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [years, setYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [closings, setClosings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPeriodsLoading, setIsPeriodsLoading] = useState(false);
  const [actionId, setActionId] = useState(null); // period id with in-flight lock/unlock

  // "Yangi yil" dialog
  const [showYearModal, setShowYearModal] = useState(false);
  const [isSavingYear, setIsSavingYear] = useState(false);
  const [yearForm, setYearForm] = useState({ code: '', name: '', start_date: '', end_date: '' });

  // Close dialog
  const [closeTarget, setCloseTarget] = useState(null); // fiscal period row
  const [checklist, setChecklist] = useState(null);
  const [checklistState, setChecklistState] = useState('idle'); // idle|loading|ready|unavailable
  const [overrideClose, setOverrideClose] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [closeResult, setCloseResult] = useState(null); // period_closings summary after run
  const [closingJeNumber, setClosingJeNumber] = useState(null);

  // Reopen dialog
  const [reopenTarget, setReopenTarget] = useState(null); // closing row
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);

  const loadYears = useCallback(async () => {
    const data = await financeService.listFiscalYears();
    const list = Array.isArray(data) ? data : [];
    setYears(list);
    return list;
  }, []);

  const loadPeriods = useCallback(async (yearId) => {
    if (!yearId) { setPeriods([]); return; }
    setIsPeriodsLoading(true);
    try {
      const data = await financeService.listFiscalPeriods({ fiscal_year_id: yearId });
      setPeriods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load fiscal periods:', err);
      setPeriods([]);
    } finally {
      setIsPeriodsLoading(false);
    }
  }, []);

  const loadClosings = useCallback(async () => {
    try {
      const data = await financeService.listPeriodClosings();
      setClosings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load period closings:', err);
      setClosings([]);
    }
  }, []);

  // Initial load. (t is NOT a dep — useTranslation returns a new closure per
  // render; adding it causes an infinite fetch loop.)
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      try {
        const list = await loadYears();
        if (!alive) return;
        if (list.length > 0) {
          // Prefer the year covering today, else the newest.
          const today = new Date().toISOString().slice(0, 10);
          const current = list.find(y => y.start_date?.slice(0, 10) <= today && y.end_date?.slice(0, 10) >= today);
          setSelectedYearId((current || list[list.length - 1]).id);
        }
        await loadClosings();
      } catch (err) {
        console.error('Failed to load fiscal years:', err);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [loadYears, loadClosings]);

  useEffect(() => {
    loadPeriods(selectedYearId);
  }, [selectedYearId, loadPeriods]);

  const selectedYear = useMemo(
    () => years.find(y => y.id === selectedYearId) || null,
    [years, selectedYearId]
  );

  const periodStats = useMemo(() => ({
    open: periods.filter(p => p.status === 'open').length,
    locked: periods.filter(p => p.status === 'locked').length,
    closed: periods.filter(p => p.status === 'closed').length,
  }), [periods]);

  // ─── Year creation ─────────────────────────────────────────────
  const openYearModal = () => {
    const y = new Date().getFullYear() + (years.some(fy => fy.code === `FY${new Date().getFullYear()}`) ? 1 : 0);
    setYearForm({ code: `FY${y}`, name: `${y}`, start_date: `${y}-01-01`, end_date: `${y}-12-31` });
    setShowYearModal(true);
  };

  const handleCreateYear = async () => {
    setIsSavingYear(true);
    try {
      // Server auto-creates the 12 monthly fiscal_periods (migration 478).
      const created = await financeService.createFiscalYear({ ...yearForm, status: 'open' });
      const list = await loadYears();
      const target = created?.id || list[list.length - 1]?.id;
      if (target) setSelectedYearId(target);
      setShowYearModal(false);
      toast.success(t('pc_year_created') || 'Moliyaviy yil yaratildi');
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('pc_year_create_failed') || 'Yil yaratilmadi'));
    } finally {
      setIsSavingYear(false);
    }
  };

  // ─── Lock / unlock (soft admin lock) ───────────────────────────
  const handleLockToggle = async (period) => {
    setActionId(period.id);
    try {
      if (period.status === 'open') {
        await financeService.lockFiscalPeriod(period.id);
      } else if (period.status === 'locked') {
        await financeService.unlockFiscalPeriod(period.id);
      }
      await loadPeriods(selectedYearId);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('pc_lock_failed') || 'Amal bajarilmadi'));
    } finally {
      setActionId(null);
    }
  };

  // ─── Close flow ────────────────────────────────────────────────
  const openCloseDialog = async (period) => {
    setCloseTarget(period);
    setCloseResult(null);
    setClosingJeNumber(null);
    setOverrideClose(false);
    setCloseNotes('');
    setChecklist(null);
    setChecklistState('loading');
    try {
      const data = await financeService.getCloseChecklist({
        period_start: period.start_date?.slice(0, 10),
        period_end: period.end_date?.slice(0, 10),
      });
      setChecklist(data);
      setChecklistState('ready');
    } catch {
      // Route may be missing in older deployments — degrade gracefully.
      setChecklistState('unavailable');
    }
  };

  const closeDialogAndRefresh = () => {
    setCloseTarget(null);
    setCloseResult(null);
  };

  const handleRunClose = async () => {
    if (!closeTarget) return;
    setIsClosing(true);
    try {
      const summary = await financeService.closePeriod({
        period_start: closeTarget.start_date?.slice(0, 10),
        period_end: closeTarget.end_date?.slice(0, 10),
        notes: closeNotes,
      });
      setCloseResult(summary);
      if (summary?.closing_journal_entry_id) {
        try {
          const je = await financeService.getJournalEntry(summary.closing_journal_entry_id);
          setClosingJeNumber(je?.entry_number || null);
        } catch { /* reference stays id-less */ }
      }
      await Promise.all([loadPeriods(selectedYearId), loadClosings()]);
      if (summary?.status === 'closed') {
        toast.success(t('pc_close_done') || 'Davr yopildi');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('pc_close_failed') || 'Davrni yopib bo\'lmadi'));
    } finally {
      setIsClosing(false);
    }
  };

  // ─── Reopen flow ───────────────────────────────────────────────
  const handleReopen = async () => {
    if (!reopenTarget || !reopenReason.trim()) return;
    setIsReopening(true);
    try {
      await financeService.reopenPeriod(reopenTarget.id, reopenReason.trim());
      setReopenTarget(null);
      setReopenReason('');
      await Promise.all([loadPeriods(selectedYearId), loadClosings()]);
      toast.success(t('pc_reopened') || 'Davr qayta ochildi');
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('pc_reopen_failed') || 'Qayta ochib bo\'lmadi'));
    } finally {
      setIsReopening(false);
    }
  };

  // ─── Presentational bits ───────────────────────────────────────
  const statusChip = (status) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-slate-100 text-slate-700 border border-slate-200"><Unlock className="w-3 h-3 mr-1" /> {t('pc_status_open') || 'Ochiq'}</Badge>;
      case 'locked':
        return <Badge className="bg-amber-100 text-amber-700 border border-amber-200"><Lock className="w-3 h-3 mr-1" /> {t('pc_status_locked') || 'Qulflangan'}</Badge>;
      case 'closed':
        return <Badge className="bg-green-100 text-green-700 border border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> {t('pc_status_closed') || 'Yopilgan'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const closingStatusChip = (status) => {
    switch (status) {
      case 'closed':
        return <Badge className="bg-green-100 text-green-700">{t('pc_status_closed') || 'Yopilgan'}</Badge>;
      case 'reopened':
        return <Badge className="bg-amber-100 text-amber-700">{t('pc_status_reopened') || 'Qayta ochilgan'}</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">{t('pc_status_failed') || 'Muvaffaqiyatsiz'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const checkLabel = (name) => {
    const map = {
      balance_invariant: t('pc_check_balance') || 'Dt = Kt muvozanati',
      no_drafts: t('pc_check_no_drafts') || 'Qoralama yozuvlar yo\'q',
    };
    return map[name] || name;
  };

  const canPost = canUpdate(MODULES.FINANCIALS);
  const checklistReady = checklistState === 'ready' && checklist?.ready;
  const confirmEnabled = !isClosing && (
    checklistState === 'unavailable' || checklistReady || overrideClose
  );

  if (isLoading) {
    return (
      <div className={`${glassCard} p-12 flex items-center justify-center text-slate-500`}>
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> {t('loading') || 'Yuklanmoqda...'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year header */}
      <Card className={glassCard}>
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('pc_periods_title') || 'Davrlar'}</h2>
                <p className="text-sm text-slate-500">{t('pc_periods_subtitle') || 'Moliyaviy yil va oylik hisob davrlari'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {years.length > 0 && (
                <Select value={selectedYearId || ''} onValueChange={setSelectedYearId}>
                  <SelectTrigger className="w-[190px] bg-white">
                    <SelectValue placeholder={t('pc_select_year') || 'Yilni tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y.id} value={y.id}>{y.name || y.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canCreate(MODULES.FINANCIALS) && (
                <Button onClick={openYearModal} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                  <Plus className="w-4 h-4 mr-2" /> {t('pc_new_year') || 'Yangi yil'}
                </Button>
              )}
            </div>
          </div>

          {selectedYear && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-slate-50/80 border border-slate-200/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono font-semibold text-slate-800">{selectedYear.code}</span>
                <span className="text-slate-500">{fmtDate(selectedYear.start_date)} — {fmtDate(selectedYear.end_date)}</span>
                {statusChip(selectedYear.status)}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600"><span className="font-semibold text-slate-800">{periodStats.open}</span> {t('pc_count_open') || 'ochiq'}</span>
                <span className="text-amber-700"><span className="font-semibold">{periodStats.locked}</span> {t('pc_count_locked') || 'qulflangan'}</span>
                <span className="text-green-700"><span className="font-semibold">{periodStats.closed}</span> {t('pc_count_closed') || 'yopilgan'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly periods */}
      <Card className={glassCard}>
        <CardContent className="p-0">
          {!selectedYear ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('pc_no_years') || 'Moliyaviy yil yaratilmagan'}</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {t('pc_no_years_hint') || "Yil yaratilganda 12 oylik davr avtomatik ochiladi; davrlarni qulflash va yopish shu yerdan boshqariladi."}
              </p>
              {canCreate(MODULES.FINANCIALS) && (
                <Button onClick={openYearModal} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                  <Plus className="w-4 h-4 mr-2" /> {t('pc_new_year') || 'Yangi yil'}
                </Button>
              )}
            </div>
          ) : isPeriodsLoading ? (
            <div className="p-10 flex items-center justify-center text-slate-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> {t('loading') || 'Yuklanmoqda...'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('pc_period') || 'Davr'}</TableHead>
                  <TableHead>{t('pc_date_range') || 'Oraliq'}</TableHead>
                  <TableHead>{t('status') || 'Holat'}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Amallar'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">P{p.period_number}</Badge>
                        <span className="font-medium text-slate-800">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{fmtDate(p.start_date)} — {fmtDate(p.end_date)}</TableCell>
                    <TableCell>{statusChip(p.status)}</TableCell>
                    <TableCell className="text-right">
                      {canPost && p.status !== 'closed' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionId === p.id}
                            onClick={() => handleLockToggle(p)}
                            title={p.status === 'open' ? (t('pc_lock') || 'Qulflash') : (t('pc_unlock') || 'Ochish')}
                          >
                            {p.status === 'open' ? (
                              <><Lock className="w-4 h-4 mr-1 text-amber-600" /> {t('pc_lock') || 'Qulflash'}</>
                            ) : (
                              <><Unlock className="w-4 h-4 mr-1 text-slate-600" /> {t('pc_unlock') || 'Ochish'}</>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCloseDialog(p)}
                            className="text-green-700 border-green-200 hover:bg-green-50"
                          >
                            <ShieldCheck className="w-4 h-4 mr-1" /> {t('pc_close_period') || 'Davrni yopish'}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {periods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      {t('pc_no_periods') || 'Bu yil uchun davrlar topilmadi'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Closings history */}
      <Card className={glassCard}>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
              <History className="w-4 h-4 text-slate-600" />
            </div>
            <CardTitle className="text-base font-semibold">{t('pc_closings_history') || 'Yopishlar tarixi'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {closings.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              {t('pc_no_closings') || 'Hali davr yopilmagan'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('pc_period') || 'Davr'}</TableHead>
                  <TableHead>{t('status') || 'Holat'}</TableHead>
                  <TableHead className="text-right">{t('pc_net_profit') || 'Sof natija'}</TableHead>
                  <TableHead>{t('pc_balanced') || 'Muvozanat'}</TableHead>
                  <TableHead>{t('date') || 'Sana'}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Amallar'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closings.map((cl) => (
                  <TableRow key={cl.id} className="hover:bg-slate-50">
                    <TableCell className="text-slate-700">{fmtDate(cl.period_start)} — {fmtDate(cl.period_end)}</TableCell>
                    <TableCell>{closingStatusChip(cl.status)}</TableCell>
                    <TableCell className={`text-right font-semibold ${cl.net_profit < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatCurrency(cl.net_profit || 0)}
                    </TableCell>
                    <TableCell>
                      {cl.is_balanced ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {cl.completed_at ? format(new Date(cl.completed_at), 'dd.MM.yyyy HH:mm') : fmtDate(cl.started_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canPost && cl.status === 'closed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setReopenTarget(cl); setReopenReason(''); }}
                          className="text-amber-700 hover:bg-amber-50"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" /> {t('pc_reopen') || 'Qayta ochish'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Yangi yil dialog */}
      <Dialog open={showYearModal} onOpenChange={setShowYearModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('pc_new_year') || 'Yangi yil'}
            </DialogTitle>
            <DialogDescription>
              {t('pc_new_year_hint') || '12 oylik davr avtomatik yaratiladi.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('code') || 'Kod'} *</label>
                <Input value={yearForm.code} onChange={(e) => setYearForm({ ...yearForm, code: e.target.value })} placeholder="FY2026" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name') || 'Nomi'} *</label>
                <Input value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} placeholder="2026" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('start_date') || 'Boshlanish'} *</label>
                <Input type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('end_date') || 'Tugash'} *</label>
                <Input type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowYearModal(false)} disabled={isSavingYear}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button
              onClick={handleCreateYear}
              disabled={isSavingYear || !yearForm.code || !yearForm.name || !yearForm.start_date || !yearForm.end_date}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              {isSavingYear ? (t('creating') || 'Yaratilmoqda...') : (t('create') || 'Yaratish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Davrni yopish dialog */}
      <Dialog open={!!closeTarget} onOpenChange={(open) => { if (!open) closeDialogAndRefresh(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-700" />
              {t('pc_close_period') || 'Davrni yopish'}
              {closeTarget && <Badge variant="outline" className="ml-1 font-normal">{closeTarget.name}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {closeTarget && `${fmtDate(closeTarget.start_date)} — ${fmtDate(closeTarget.end_date)}`}
            </DialogDescription>
          </DialogHeader>

          {!closeResult ? (
            <div className="space-y-4">
              {/* Checklist */}
              {checklistState === 'loading' && (
                <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('pc_checklist_loading') || 'Tekshiruv yuklanmoqda...'}
                </div>
              )}
              {checklistState === 'unavailable' && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-slate-400" />
                  {t('pc_checklist_unavailable') || 'Tekshiruv mavjud emas'}
                </div>
              )}
              {checklistState === 'ready' && checklist && (
                <div className="space-y-2">
                  <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${checklist.draft_entries > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                    {checklist.draft_entries > 0 ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                    <div>
                      {checklist.draft_entries > 0 ? (
                        <>
                          <span className="font-semibold">{checklist.draft_entries}</span> {t('pc_draft_entries_warn') || "ta qoralama yozuv bor — yopishdan oldin o'tkazing yoki o'chiring"}
                          {checklist.draft_entries_total > 0 && (
                            <span className="block text-xs mt-0.5">{t('pc_draft_total') || 'Jami'}: {formatCurrency(checklist.draft_entries_total)}</span>
                          )}
                        </>
                      ) : (
                        t('pc_no_drafts_ok') || "Qoralama yozuvlar yo'q"
                      )}
                    </div>
                  </div>

                  {Array.isArray(checklist.missing_depreciation_months) && checklist.missing_depreciation_months.length > 0 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        {t('pc_missing_dep') || 'Amortizatsiya hisoblanmagan oylar'}:{' '}
                        <span className="font-mono">{checklist.missing_depreciation_months.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {(checklist.unmatched_vipiska_imports > 0 || checklist.unmatched_vipiska_lines > 0) && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        {t('pc_unmatched_vipiska') || 'Mos kelmagan vipiska yozuvlari'}:{' '}
                        {checklist.unmatched_vipiska_imports} {t('pc_imports_word') || 'import'} / {checklist.unmatched_vipiska_lines} {t('pc_lines_word') || 'qator'}
                      </div>
                    </div>
                  )}

                  {!checklist.ready && (
                    <label className="flex items-center gap-2 pt-1 text-sm text-slate-700 cursor-pointer select-none">
                      <Checkbox checked={overrideClose} onCheckedChange={(v) => setOverrideClose(!!v)} />
                      {t('pc_close_anyway') || 'Baribir yopish'}
                    </label>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('pc_notes') || 'Izoh'}</label>
                <Input value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder={t('pc_notes_placeholder') || 'Ixtiyoriy izoh...'} />
              </div>

              <p className="text-xs text-slate-500">
                {t('pc_close_explain') || "Yopish jarayoni Dt=Kt muvozanatini tekshiradi, 9xxx schyotlarni 9900 ga yopuvchi jurnal yozuvini kiritadi va davrni qulflaydi."}
              </p>

              <DialogFooter>
                <Button variant="outline" onClick={closeDialogAndRefresh} disabled={isClosing}>{t('cancel') || 'Bekor qilish'}</Button>
                <Button
                  onClick={handleRunClose}
                  disabled={!confirmEnabled}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  {isClosing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('pc_closing') || 'Yopilmoqda...'}</>
                  ) : (
                    t('pc_close_confirm') || 'Yopish'
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Result */}
              <div className={`rounded-lg border px-4 py-3 flex items-center gap-2 ${closeResult.status === 'closed' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {closeResult.status === 'closed' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <span className="font-semibold">
                  {closeResult.status === 'closed' ? (t('pc_close_done') || 'Davr yopildi') : (t('pc_close_failed') || "Davrni yopib bo'lmadi")}
                </span>
              </div>

              {Array.isArray(closeResult.checks) && closeResult.checks.length > 0 && (
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {closeResult.checks.map((ch, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        {ch.passed ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="text-slate-700">{checkLabel(ch.check_name)}</span>
                      </div>
                      <span className={`text-xs ${ch.passed ? 'text-green-700' : 'text-red-600'}`}>
                        {ch.message || (ch.passed ? 'OK' : `${ch.expected_value ?? ''} ≠ ${ch.actual_value ?? ''}`)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <span className="text-sm text-slate-600">{t('pc_net_profit') || 'Sof natija'}</span>
                <span className={`font-bold ${closeResult.net_profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatCurrency(closeResult.net_profit || 0)}
                </span>
              </div>

              {closeResult.closing_journal_entry_id && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {t('pc_closing_je') || 'Yopuvchi jurnal yozuvi'}:{' '}
                  <span className="font-mono text-[var(--genix-blue)] underline underline-offset-2">
                    {closingJeNumber || closeResult.closing_journal_entry_id.slice(0, 8)}
                  </span>
                </div>
              )}

              <DialogFooter>
                <Button onClick={closeDialogAndRefresh} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                  {t('close') || 'Yopish'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reopen dialog */}
      <Dialog open={!!reopenTarget} onOpenChange={(open) => { if (!open) setReopenTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <RotateCcw className="w-5 h-5" />
              {t('pc_reopen') || 'Qayta ochish'}
            </DialogTitle>
            <DialogDescription>
              {reopenTarget && `${fmtDate(reopenTarget.period_start)} — ${fmtDate(reopenTarget.period_end)}`}
              {' · '}{t('pc_reopen_hint') || 'Yopuvchi yozuv storno qilinadi, sabab majburiy.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-slate-700 block">{t('pc_reopen_reason') || 'Sabab'} *</label>
            <Input
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder={t('pc_reopen_reason_placeholder') || 'Nega qayta ochilmoqda?'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenTarget(null)} disabled={isReopening}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button
              onClick={handleReopen}
              disabled={isReopening || !reopenReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isReopening ? (t('saving') || 'Saqlanmoqda...') : (t('pc_reopen') || 'Qayta ochish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
