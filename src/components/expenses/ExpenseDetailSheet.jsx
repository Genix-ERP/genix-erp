import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Send, CheckCircle2, XCircle, Banknote, Pencil, Trash2,
  User, Tag, CalendarDays, FileText, Receipt, Loader2, BookOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_META } from './constants';

function PropRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400">{label}</p>
        <div className="text-sm text-slate-800 mt-0.5 break-words">{children || <span className="text-slate-300">—</span>}</div>
      </div>
    </div>
  );
}

const fmtDT = (v) => {
  if (!v) return null;
  try { return format(new Date(v), 'dd.MM.yyyy HH:mm'); } catch { return null; }
};
const fmtD = (v) => {
  if (!v) return null;
  try { return format(new Date(v), 'dd.MM.yyyy'); } catch { return null; }
};

// Side-panel detail (same pattern as tasks/TaskDetailSheet): summary,
// properties, lifecycle timeline, and the status actions the current
// user is allowed to take.
export default function ExpenseDetailSheet({
  expense, onClose, onAction, busyAction, permissions, formatCurrency, t,
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!expense) return null;
  const meta = STATUS_META[expense.status] || STATUS_META.draft;
  const { canEditRecord, canApprove, canDelete } = permissions;
  const isBusy = Boolean(busyAction);

  const timeline = [
    { key: 'created', label: t('exp_tl_created'), at: expense.created_at, done: true },
    { key: 'submitted', label: t('exp_tl_submitted'), at: expense.submitted_at, done: Boolean(expense.submitted_at) },
    expense.status === 'rejected'
      ? { key: 'rejected', label: t('exp_tl_rejected'), at: expense.rejected_at, done: true, danger: true }
      : { key: 'approved', label: t('exp_tl_approved'), at: expense.approved_at, done: Boolean(expense.approved_at) },
    { key: 'paid', label: t('exp_tl_paid'), at: expense.paid_at, done: Boolean(expense.paid_at) },
  ];

  const act = (name, payload) => onAction(name, expense, payload);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-sm text-slate-500">{expense.expense_number}</p>
            <Badge variant="outline" className={meta.className}>{t(meta.tKey)}</Badge>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(expense.total_amount || expense.amount || 0)}
          </p>
          <p className="text-sm text-slate-500 mt-1 break-words">{expense.description}</p>
        </div>

        <div className="px-6 py-4 space-y-5">
          {expense.status === 'rejected' && expense.rejection_reason && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-600">{t('exp_rejection_reason')}</p>
              <p className="text-sm text-red-700 mt-1">{expense.rejection_reason}</p>
            </div>
          )}

          {/* Properties */}
          <div className="divide-y divide-slate-100">
            <PropRow icon={User} label={t('employee')}>{expense.employee_name}</PropRow>
            <PropRow icon={Tag} label={t('category')}>
              {expense.category ? (
                <span className="inline-flex items-center gap-1.5">
                  {expense.category_color && (
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: expense.category_color }} />
                  )}
                  {expense.category}
                </span>
              ) : null}
            </PropRow>
            <PropRow icon={CalendarDays} label={t('exp_date')}>{fmtD(expense.date)}</PropRow>
            {expense.vendor_name && (
              <PropRow icon={FileText} label={t('exp_vendor')}>{expense.vendor_name}</PropRow>
            )}
            {expense.receipt_url && (
              <PropRow icon={Receipt} label={t('exp_receipt')}>
                <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {t('exp_receipt_open')}
                </a>
              </PropRow>
            )}
            {expense.status === 'paid' && (
              <>
                {expense.payment_account_name && (
                  <PropRow icon={Banknote} label={t('exp_pay_account')}>{expense.payment_account_name}</PropRow>
                )}
                {expense.journal_entry_number && (
                  <PropRow icon={BookOpen} label={t('exp_journal_entry')}>
                    <span className="font-mono">{expense.journal_entry_number}</span>
                  </PropRow>
                )}
              </>
            )}
          </div>

          {/* Tax recognition */}
          <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">{t('exp_recognized_label')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('exp_recognized_help')}</p>
            </div>
            <Switch
              checked={expense.is_recognized !== false}
              disabled={!canApprove || isBusy}
              onCheckedChange={(v) => act('recognize', v)}
            />
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('exp_timeline')}</p>
            <ol className="space-y-2.5">
              {timeline.map((step) => (
                <li key={step.key} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: step.danger ? '#ef4444' : step.done ? '#10b981' : '#e2e8f0' }}
                  />
                  <span className={`text-sm flex-1 ${step.done ? 'text-slate-700' : 'text-slate-400'}`}>{step.label}</span>
                  <span className="text-xs text-slate-400">{fmtDT(step.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100 px-6 py-4 flex flex-wrap gap-2">
          {['draft', 'rejected'].includes(expense.status) && canEditRecord && (
            <Button size="sm" onClick={() => act('submit')} disabled={isBusy}>
              {busyAction === 'submit' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              {t('exp_action_submit')}
            </Button>
          )}
          {expense.status === 'submitted' && canApprove && (
            <>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => act('approve')} disabled={isBusy}>
                {busyAction === 'approve' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                {t('exp_action_approve')}
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectOpen(true)} disabled={isBusy}>
                <XCircle className="w-4 h-4 mr-1.5" />
                {t('exp_action_reject')}
              </Button>
            </>
          )}
          {expense.status === 'approved' && canApprove && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => act('pay')} disabled={isBusy}>
              {busyAction === 'pay' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Banknote className="w-4 h-4 mr-1.5" />}
              {t('exp_action_pay')}
            </Button>
          )}
          {['draft', 'submitted', 'rejected'].includes(expense.status) && canEditRecord && (
            <Button size="sm" variant="outline" onClick={() => act('edit')} disabled={isBusy}>
              <Pencil className="w-4 h-4 mr-1.5" />
              {t('edit')}
            </Button>
          )}
          {['draft', 'rejected'].includes(expense.status) && canDelete && (
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 ml-auto" onClick={() => act('delete')} disabled={isBusy}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              {t('delete')}
            </Button>
          )}
        </div>

        {/* Reject reason dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('exp_reject_title')}</DialogTitle>
            </DialogHeader>
            <Textarea
              rows={3}
              placeholder={t('exp_reject_placeholder')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>{t('cancel')}</Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || isBusy}
                onClick={() => { act('reject', rejectReason.trim()); setRejectOpen(false); setRejectReason(''); }}
              >
                {t('exp_action_reject')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
