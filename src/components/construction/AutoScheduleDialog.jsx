/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2, AlertTriangle, RotateCcw, CalendarRange } from 'lucide-react';
import constructionService from '@/api/services/construction';

// Avtomatik rejalashtirish vizardi (TZ §6.1–6.2, §6.5).
//   1-qadam «params»  — boshlanish sanasi, brigada, parallellik, ish kunlari, qamrov
//   2-qadam «preview» — nechta ish sana oladi, loyiha tugashi, deltalar, konfliktlar
//   3-qadam          — «Qo'llash» (bitta tranzaksiya + orqaga qaytariladigan yurgizish)
// Hech narsa tasdiqlanmaguncha yozilmaydi.

const WEEKDAYS = [
  { bit: 0, label: 'Du' }, { bit: 1, label: 'Se' }, { bit: 2, label: 'Ch' },
  { bit: 3, label: 'Pa' }, { bit: 4, label: 'Ju' }, { bit: 5, label: 'Sh' },
  { bit: 6, label: 'Ya' },
];

const errText = (e) =>
  e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || 'Xatolik';

// Konflikt sabablari backend'dan inglizcha kalit bo'lib keladi; foydalanuvchi
// "nega bu ish siljimadi" degan savolga shu yerdan javob topishi kerak.
const REASON_KEYS = {
  manual: ['gpr_reason_manual', "qo'lda qo'yilgan"],
  fixed: ['gpr_reason_fixed', 'muzlatilgan'],
  started: ['gpr_reason_started', 'boshlangan'],
  scope: ['gpr_reason_scope', 'qamrovdan tashqarida'],
};

const reasonLabel = (t, reason) => {
  const entry = REASON_KEYS[reason];
  if (!entry) return reason;
  return t(entry[0]) || entry[1];
};

export default function AutoScheduleDialog({ open, onClose, projectId, t, onApplied }) {
  const [step, setStep] = useState('params');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);      // { unplanned, total_works, server_today }
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const [runs, setRuns] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await constructionService.getScheduleParams(projectId);
      const p = data?.params || {};
      setInfo(data);
      setForm({
        // Standart boshlanish — server sanasi (front hech qachon new Date() ga
        // tayanmaydi, TZ §0.5).
        start_date: p.start_date ? String(p.start_date).slice(0, 10) : data.server_today,
        parallel_limit: p.parallel_limit ?? 2,
        crew_size: p.crew_size ?? 4,
        hours_per_shift: p.hours_per_shift ?? 8,
        shifts: p.shifts ?? 1,
        workdays_mask: p.workdays_mask ?? 63,
        scope: 'unplanned',
        release_manual: false,
        save_params: true,
      });
      constructionService.listScheduleRuns(projectId).then(setRuns).catch(() => {});
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) { setStep('params'); setPreview(null); load(); }
  }, [open, load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (bit) => set('workdays_mask', form.workdays_mask ^ (1 << bit));

  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await constructionService.previewAutoSchedule(projectId, form);
      setPreview(res);
      setStep('preview');
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const res = await constructionService.applyAutoSchedule(projectId, form);
      toast.success(
        (t('gpr_auto_applied') || '{n} ta ish rejalashtirildi').replace('{n}', String(res.affected_count ?? 0))
      );
      onApplied?.();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const undo = async (runId) => {
    setBusy(true);
    try {
      await constructionService.undoScheduleRun(runId);
      toast.success(t('gpr_run_undone') || 'Yurgizish orqaga qaytarildi');
      onApplied?.();
      constructionService.listScheduleRuns(projectId).then(setRuns).catch(() => {});
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            {t('gpr_auto_schedule') || 'Avtomatik rejalashtirish'}
          </DialogTitle>
        </DialogHeader>

        {loading || !form ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin" />{t('loading') || 'Yuklanmoqda...'}
          </div>
        ) : step === 'params' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {(t('gpr_auto_intro') || 'Tizim smeta hajmlari va mehnat normalaridan davomiylikni hisoblab, ish kunlari bo\'yicha sanalarni o\'zi qo\'yadi.')}
              {info?.unplanned > 0 && (
                <> <b>{info.unplanned}</b> {t('gpr_unscheduled') || 'Rejalashtirilmagan'}.</>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label={t('gpr_start_date') || 'Boshlanish sanasi'}>
                <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              </Field>
              <Field label={t('gpr_parallel') || 'Parallel ishlar (brigadalar)'}>
                <Input type="number" min={1} value={form.parallel_limit}
                  onChange={(e) => set('parallel_limit', Number(e.target.value))} />
              </Field>
              <Field label={t('gpr_crew_size') || 'Brigada (kishi)'}>
                <Input type="number" min={1} value={form.crew_size}
                  onChange={(e) => set('crew_size', Number(e.target.value))} />
              </Field>
              <Field label={t('gpr_hours_shift') || 'Smena (soat)'}>
                <Input type="number" min={1} value={form.hours_per_shift}
                  onChange={(e) => set('hours_per_shift', Number(e.target.value))} />
              </Field>
              <Field label={t('gpr_shifts') || 'Smenalar soni'}>
                <Input type="number" min={1} value={form.shifts}
                  onChange={(e) => set('shifts', Number(e.target.value))} />
              </Field>
              <Field label={t('gpr_scope') || 'Qamrov'}>
                <select value={form.scope} onChange={(e) => set('scope', e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-sm">
                  <option value="unplanned">{t('gpr_scope_unplanned') || 'Faqat rejalashtirilmaganlar'}</option>
                  <option value="all">{t('gpr_scope_all') || 'Barcha ishlar'}</option>
                  <option value="overdue">{t('gpr_scope_overdue') || "Muddati o'tganlarni qayta hisoblash"}</option>
                </select>
              </Field>
            </div>

            {/* Avtoreja paydo bo'lishidan oldin sanasi bor bo'lgan har bir ish
                'manual' deb belgilangan (495-migratsiya), shuning uchun eski
                loyihalarda "Barcha ishlar" ham hech narsani siljita olmaydi.
                Bu belgi o'sha himoyani shu yugurish uchun olib tashlaydi. */}
            {form.scope !== 'unplanned' && (
              <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!form.release_manual}
                  onChange={(e) => set('release_manual', e.target.checked)}
                />
                <span className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800 block">
                    {t('gpr_release_manual') || "Qo'lda qo'yilgan sanalarni ham qayta hisoblash"}
                  </span>
                  {t('gpr_release_manual_hint')
                    || "Muzlatilgan va boshlangan ishlarga baribir tegilmaydi."}
                </span>
              </label>
            )}

            <Field label={t('gpr_workdays') || 'Ish kunlari'}>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = (form.workdays_mask & (1 << d.bit)) !== 0;
                  return (
                    <button key={d.bit} type="button" onClick={() => toggleDay(d.bit)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        on ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {runs.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  {t('gpr_run_history') || 'Yurgizishlar tarixi'}
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {runs.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        {new Date(r.created_date).toLocaleString()} · {r.affected_count} ta ish
                        {r.undone && <Badge variant="secondary" className="ml-1">undone</Badge>}
                      </span>
                      {!r.undone && (
                        <button onClick={() => undo(r.id)} disabled={busy}
                          className="text-slate-400 hover:text-red-500 inline-flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />{t('gpr_undo_run') || 'Qaytarish'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>{t('cancel') || 'Bekor qilish'}</Button>
              <Button onClick={runPreview} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarRange className="w-4 h-4" />}
                {t('gpr_preview') || 'Hisoblash'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t('gpr_will_be_planned') || 'Sana oladi'} value={preview?.affected_count ?? 0} />
              <Stat label={t('gpr_project_end') || 'Loyiha tugashi'} value={preview?.project_end || '—'} />
              <Stat label={t('gpr_norm_missing') || 'Normasiz'} value={preview?.norm_missing ?? 0}
                tone={preview?.norm_missing ? 'amber' : 'slate'} />
            </div>

            {preview?.conflicts?.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('gpr_conflicts') || 'Konfliktlar'} ({preview.conflicts.length}) —
                  {t('gpr_conflicts_hint') || " qotirilgan/qo'lda sanalar siljitilmaydi"}
                </div>
                <div className="max-h-24 overflow-y-auto text-[11px] text-amber-800 space-y-0.5">
                  {preview.conflicts.slice(0, 20).map((c, i) => (
                    <div key={i}>
                      {c.label}: {c.current_start} ← {c.wanted_start} ({reasonLabel(t, c.reason)})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border rounded-md overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-slate-500">
                      <th className="p-2">{t('gpr_work') || 'Ish'}</th>
                      <th className="p-2">{t('gpr_was') || 'Edi'}</th>
                      <th className="p-2">{t('gpr_will_be') || "Bo'ladi"}</th>
                      <th className="p-2 text-right">{t('gpr_days') || 'Kun'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview?.deltas || []).slice(0, 300).map((d) => (
                      <tr key={d.line_id} className="border-t">
                        <td className="p-2">
                          <span className="text-slate-400 mr-1">{d.item_number}</span>
                          {d.name?.slice(0, 60)}
                          {d.norm_missing && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">
                              {t('gpr_no_norm') || 'normasiz'}
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-slate-400">{d.start_before || '—'}</td>
                        <td className="p-2 font-medium">{d.start_after} → {d.end_after}</td>
                        <td className="p-2 text-right tabular-nums">{d.duration_after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(preview?.deltas || []).length > 300 && (
                <div className="p-1.5 text-[11px] text-slate-400 text-center border-t">
                  {(t('gpr_and_more') || 'va yana {n} ta').replace('{n}', String(preview.deltas.length - 300))}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep('params')}>{t('back') || 'Orqaga'}</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>{t('cancel') || 'Bekor qilish'}</Button>
                <Button onClick={apply} disabled={busy || !preview?.affected_count} className="gap-1.5">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('gpr_apply') || "Qo'llash"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone = 'slate' }) {
  const toneCls = tone === 'amber' ? 'text-amber-700 bg-amber-50' : 'text-slate-900 bg-slate-50';
  return (
    <div className={`rounded-md p-2 ${toneCls}`}>
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
