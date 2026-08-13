import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Loader2,
  PackageCheck,
  ShoppingCart,
  XCircle,
  Ban,
  CheckCheck,
  Copy,
  FileText,
  History,
  AlarmClock,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';

import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useAuth } from '@/components/contexts/AuthContext';
import materialRequestsService from '@/api/services/materialRequests';

import {
  mrStatusBadgeProps,
  mrLineStatusBadgeProps,
  MR_ACTIVITY_META,
} from './materialRequestMeta';
import { getApiErrorMessage } from '@/utils/apiError';

const ACTIONABLE = new Set(['new', 'in_review', 'in_purchase', 'partially_fulfilled']);

// Zayavka detali: qatorlar, bog'liq hujjatlar, timeline va rolga qarab
// amallar (7-bo'lim matritsasi). mode="warehouse" — omborchi ko'rinishi.
export default function MaterialRequestDetailSheet({
  requestId,
  mode = 'construction',
  canWarehouseAct = false,
  onClose,
  onChanged,
  onCopy,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Omborchi qator tanlovi: {itemId: {checked, qty}}
  const [selection, setSelection] = useState({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await materialRequestsService.get(requestId);
      setData(d);
      // Default tanlov: barcha faol (rad etilmagan) qatorlar, qty = qoldiq
      const sel = {};
      (d?.items || []).forEach((it) => {
        const remaining = Math.max(0, (it.qty_requested || 0) - (it.qty_issued || 0));
        if (it.line_status !== 'rejected' && remaining > 0) {
          sel[it.id] = { checked: true, qty: remaining };
        }
      });
      setSelection(sel);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('mr_load_failed') || "Zayavkani yuklab bo'lmadi"));
      onClose?.();
    } finally {
      setLoading(false);
    }
    // `t` (har render yangi closure) va `onClose` (parentdan inline arrow)
    // ataylab deps'da emas — aks holda load har render qayta yaratilib,
    // useEffect cheksiz so'rov tsikliga tushadi (429 rate-limit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  // Omborchi ochganda: new → in_review (avto, 3.1-stsenariy 4-qadam)
  useEffect(() => {
    if (mode === 'warehouse' && canWarehouseAct && data?.status === 'new') {
      materialRequestsService.review(requestId)
        .then(() => { setData((prev) => (prev ? { ...prev, status: 'in_review' } : prev)); onChanged?.(); })
        .catch(() => { /* huquq bo'lmasa jim — ko'rish davom etadi */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, canWarehouseAct, data?.status, requestId]);

  const isOwner = data?.requested_by_user_id && user?.id && String(data.requested_by_user_id) === String(user.id);
  const actionable = data && ACTIONABLE.has(data.status);

  const checkedLines = useMemo(() => {
    if (!data) return [];
    return (data.items || [])
      .filter((it) => selection[it.id]?.checked && Number(selection[it.id]?.qty) > 0)
      .map((it) => ({ item_id: it.id, qty: Number(selection[it.id].qty) }));
  }, [data, selection]);

  const runAction = async (fn, successMsg) => {
    if (acting) return;
    setActing(true);
    try {
      await fn();
      toast.success(successMsg);
      await load();
      onChanged?.();
    } catch (e) {
      // 422 INSUFFICIENT_STOCK — qatorlar bo'yicha batafsil xabar
      const errs = e?.response?.data?.errors;
      if (Array.isArray(errs) && errs.length > 0) {
        toast.error(
          `${t('mr_insufficient_stock') || 'Omborda yetarli qoldiq yo‘q'}: ` +
          errs.map((x) => `${x.product_name} (${x.available})`).join(', ')
        );
      } else {
        toast.error(getApiErrorMessage(e, t('error_occurred') || 'Xatolik yuz berdi'));
      }
    } finally {
      setActing(false);
    }
  };

  const handleIssue = () =>
    runAction(
      () => materialRequestsService.issue(requestId, { lines: checkedLines }),
      t('mr_issued_toast') || 'Materiallar chiqarildi'
    );

  const handlePurchase = () =>
    runAction(
      () => materialRequestsService.sendToPurchase(requestId, {
        lines: checkedLines.map((l) => {
          // Xaridga: qoldiqdan xariddagini ham ayirish kerak
          const it = (data.items || []).find((x) => x.id === l.item_id);
          const rem = Math.max(0, (it?.qty_requested || 0) - (it?.qty_issued || 0) - (it?.qty_in_purchase || 0));
          return { item_id: l.item_id, qty: Math.min(l.qty, rem) };
        }).filter((l) => l.qty > 0),
      }),
      t('mr_sent_purchase_toast') || 'Xarid so‘rovi yaratildi'
    );

  const handleReject = () =>
    runAction(async () => {
      await materialRequestsService.reject(requestId, { reason: rejectReason });
      setRejectOpen(false);
      setRejectReason('');
    }, t('mr_rejected_toast') || 'Zayavka rad etildi');

  const handleCancel = () =>
    runAction(async () => {
      await materialRequestsService.cancel(requestId);
      setCancelOpen(false);
    }, t('mr_cancelled_toast') || 'Zayavka bekor qilindi');

  const handleAccept = () =>
    runAction(
      () => materialRequestsService.accept(requestId),
      t('mr_accepted_toast') || 'Zayavka yopildi'
    );

  const badge = data ? mrStatusBadgeProps(data.status, t) : null;
  const showWarehouseActions = canWarehouseAct && actionable;
  const showAccept = isOwner || mode !== 'warehouse';

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {loading || !data ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-lg font-bold text-slate-900">
                  {data.request_number}
                </SheetTitle>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
                {data.priority === 'urgent' && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                    <Flame className="w-3 h-3" />
                    {t('mr_priority_urgent') || 'Shoshilinch'}
                  </span>
                )}
                {data.required_date && new Date(data.required_date) < new Date() && ACTIONABLE.has(data.status) && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                    <AlarmClock className="w-3 h-3" />
                    {t('mr_overdue') || 'Kechikmoqda'}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-500 space-y-0.5 mt-1">
                <p>{data.project_name}</p>
                <p>
                  {(t('mr_requester') || 'Mas\'ul')}: {data.requester_name || '—'}
                  {' · '}
                  {(t('mr_needed_by') || 'Kerak sana')}: {data.required_date ? String(data.required_date).slice(0, 10) : '—'}
                  {data.warehouse_name ? ` · ${t('warehouse') || 'Ombor'}: ${data.warehouse_name}` : ''}
                </p>
                {data.notes && <p className="text-slate-600">{data.notes}</p>}
                {data.rejected_reason && (
                  <p className="text-red-600">
                    {(t('mr_reject_reason') || 'Rad sababi')}: {data.rejected_reason}
                  </p>
                )}
              </div>
            </SheetHeader>

            <div className="px-6 py-4 space-y-6 flex-1">
              {/* ── Qatorlar ── */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  {t('mr_materials') || 'Materiallar'}
                </h3>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-400">
                          {showWarehouseActions && <th className="px-3 py-2 w-8" />}
                          <th className="px-3 py-2 text-left font-semibold">{t('mr_material') || 'Material'}</th>
                          <th className="px-3 py-2 text-right font-semibold">{t('mr_requested') || "So'ralgan"}</th>
                          <th className="px-3 py-2 text-right font-semibold">{t('mr_issued_qty') || 'Chiqarilgan'}</th>
                          <th className="px-3 py-2 text-right font-semibold">{t('mr_in_purchase_qty') || 'Xaridda'}</th>
                          {showWarehouseActions && (
                            <th className="px-3 py-2 text-right font-semibold">{t('mr_stock') || 'Qoldiq'}</th>
                          )}
                          {showWarehouseActions && (
                            <th className="px-3 py-2 text-right font-semibold w-24">{t('mr_qty') || 'Miqdor'}</th>
                          )}
                          <th className="px-3 py-2 text-left font-semibold">{t('status') || 'Holat'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data.items || []).map((it) => {
                          const lb = mrLineStatusBadgeProps(it.line_status, t);
                          const sel = selection[it.id];
                          const selectable = showWarehouseActions && it.line_status !== 'rejected'
                            && (it.qty_requested - it.qty_issued) > 0;
                          return (
                            <tr key={it.id} className="bg-white">
                              {showWarehouseActions && (
                                <td className="px-3 py-2">
                                  {selectable && (
                                    <Checkbox
                                      checked={!!sel?.checked}
                                      onCheckedChange={(v) =>
                                        setSelection((prev) => ({
                                          ...prev,
                                          [it.id]: { ...(prev[it.id] || { qty: it.qty_requested - it.qty_issued }), checked: !!v },
                                        }))
                                      }
                                    />
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                <p className="text-slate-800">{it.product_name}</p>
                                <p className="text-[11px] text-slate-400">{it.unit}</p>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{it.qty_requested}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{it.qty_issued || 0}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-orange-600">{it.qty_in_purchase || 0}</td>
                              {showWarehouseActions && (
                                <td className={`px-3 py-2 text-right tabular-nums ${
                                  (it.on_hand ?? 0) >= (it.qty_requested - it.qty_issued)
                                    ? 'text-emerald-600'
                                    : (it.on_hand ?? 0) > 0 ? 'text-amber-600' : 'text-red-500'
                                }`}>
                                  {it.on_hand ?? '—'}
                                </td>
                              )}
                              {showWarehouseActions && (
                                <td className="px-3 py-2">
                                  {selectable && (
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="any"
                                      value={sel?.qty ?? ''}
                                      onChange={(e) =>
                                        setSelection((prev) => ({
                                          ...prev,
                                          [it.id]: { ...(prev[it.id] || { checked: true }), qty: e.target.value },
                                        }))
                                      }
                                      className="h-8 w-20 text-right text-sm ml-auto"
                                    />
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${lb.className}`}>
                                  {lb.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* ── Omborchi amallari ── */}
              {showWarehouseActions && (
                <section className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleIssue}
                    disabled={acting || checkedLines.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {acting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-1.5" />}
                    {t('mr_action_issue') || 'Tasdiqlash va chiqarish'}
                  </Button>
                  <Button
                    onClick={handlePurchase}
                    disabled={acting || checkedLines.length === 0}
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <ShoppingCart className="w-4 h-4 mr-1.5" />
                    {t('mr_action_purchase') || 'Xaridga yuborish'}
                  </Button>
                  {(data.status === 'new' || data.status === 'in_review') && (
                    <Button
                      onClick={() => setRejectOpen(true)}
                      disabled={acting}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      {t('mr_action_reject') || 'Rad etish'}
                    </Button>
                  )}
                </section>
              )}

              {/* ── Prorab amallari ── */}
              <section className="flex flex-wrap gap-2">
                {data.status === 'issued' && showAccept && (
                  <Button
                    onClick={handleAccept}
                    disabled={acting}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                  >
                    <CheckCheck className="w-4 h-4 mr-1.5" />
                    {t('mr_action_accept') || 'Qabul qildim'}
                  </Button>
                )}
                {data.status === 'new' && isOwner && (
                  <Button
                    onClick={() => setCancelOpen(true)}
                    disabled={acting}
                    variant="outline"
                    className="border-slate-300 text-slate-600"
                  >
                    <Ban className="w-4 h-4 mr-1.5" />
                    {t('mr_action_cancel') || 'Bekor qilish'}
                  </Button>
                )}
                {(data.status === 'rejected' || data.status === 'cancelled') && onCopy && (
                  <Button
                    onClick={() => onCopy(data)}
                    variant="outline"
                  >
                    <Copy className="w-4 h-4 mr-1.5" />
                    {t('mr_action_copy') || 'Nusxalab qayta yuborish'}
                  </Button>
                )}
              </section>

              {/* ── Bog'liq hujjatlar ── */}
              {((data.issues || []).length > 0 || (data.purchases || []).length > 0) && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {t('mr_linked_docs') || "Bog'liq hujjatlar"}
                  </h3>
                  <ul className="space-y-1.5">
                    {(data.issues || []).map((doc) => (
                      <li key={doc.id}>
                        <button
                          type="button"
                          onClick={() => navigate('/inventory?tab=documents')}
                          className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-[var(--genix-blue)] transition-colors"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate">{t('mr_issue_doc') || 'Chiqim'}: {doc.name}</span>
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">{doc.state}</span>
                        </button>
                      </li>
                    ))}
                    {(data.purchases || []).map((doc) => (
                      <li key={doc.id}>
                        <button
                          type="button"
                          onClick={() => navigate('/procurement?tab=requisitions')}
                          className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-[var(--genix-blue)] transition-colors"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <ShoppingCart className="w-4 h-4 text-orange-600 shrink-0" />
                            <span className="truncate">
                              {doc.pr_number}
                              {doc.po_number ? ` → ${doc.po_number}` : ''}
                            </span>
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">
                            {doc.po_status || doc.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ── Timeline ── */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-400" />
                  {t('mr_timeline') || 'Tarix'}
                </h3>
                {(data.timeline || []).length === 0 ? (
                  <p className="text-sm text-slate-400">—</p>
                ) : (
                  <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                    {data.timeline.map((ev, i) => {
                      const meta = MR_ACTIVITY_META[ev.action_type];
                      const label = (meta?.tKey && t(meta.tKey)) || meta?.fallback || ev.action_type;
                      return (
                        <li key={i} className="ml-4">
                          <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[var(--genix-blue)] border-2 border-white" />
                          <p className="text-sm font-medium text-slate-800">{label}</p>
                          {ev.description && ev.description !== label && (
                            <p className="text-xs text-slate-500">{ev.description}</p>
                          )}
                          <p className="text-[11px] text-slate-400">
                            {ev.user_name ? `${ev.user_name} · ` : ''}
                            {new Date(ev.created_at).toLocaleString(language === 'ru' ? 'ru-RU' : 'uz-UZ')}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>
          </div>
        )}

        {/* Rad etish dialogi — sabab majburiy */}
        <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('mr_reject_title') || 'Zayavkani rad etish'}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('mr_reject_desc') || 'Rad etish sababini yozing — prorab uni ko\'radi.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder={t('mr_reject_reason') || 'Rad sababi'}
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction
                disabled={!rejectReason.trim() || acting}
                onClick={handleReject}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('mr_action_reject') || 'Rad etish'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bekor qilish tasdiq dialogi */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('mr_cancel_title') || 'Zayavkani bekor qilish'}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('mr_cancel_desc') || 'Bekor qilingan zayavkani qayta ochib bo\'lmaydi. Davom etasizmi?'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('back') || 'Orqaga'}</AlertDialogCancel>
              <AlertDialogAction disabled={acting} onClick={handleCancel}>
                {t('mr_action_cancel') || 'Bekor qilish'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
