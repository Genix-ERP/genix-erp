import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Banknote, Landmark, Wallet } from 'lucide-react';
import { financeService } from '@/api/services/finance';

// "To'lash" dialog — asks WHICH journal pays (naqd/bank). The paying GL
// account is resolved from the journal on the server, so there is no
// account picker here: choosing "Bank jurnali" pays from that journal's
// account. The server posts the entry (Dt category account / Kt journal
// account) in the same transaction that flips the status to paid.
export default function PayExpenseDialog({ open, onClose, onPay, expense, paying, formatCurrency, t }) {
  const [journals, setJournals] = useState([]);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalId, setJournalId] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!open) return;
    setJournalId('');
    setPaidDate(new Date().toISOString().split('T')[0]);
    setJournalsLoading(true);
    financeService.listPaymentJournals()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : rows?.items || [];
        setJournals(list);
      })
      .catch(() => setJournals([]))
      .finally(() => setJournalsLoading(false));
  }, [open]);

  // Cash journals first — paying from the kassa is the common case.
  const sortedJournals = useMemo(
    () => [...journals].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'cash' ? -1 : 1;
      return String(a.code || '').localeCompare(String(b.code || ''));
    }),
    [journals]
  );

  useEffect(() => {
    if (!journalId && sortedJournals.length > 0) {
      setJournalId(sortedJournals[0].id);
    }
  }, [sortedJournals, journalId]);

  if (!expense) return null;

  const selected = sortedJournals.find((j) => j.id === journalId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            {t('exp_pay_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">{expense.expense_number}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(expense.total_amount || expense.amount || 0)}</span>
          </div>
          <p className="text-slate-500 truncate mt-1">{expense.description}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('exp_pay_journal')} *</Label>
            {journalsLoading ? (
              <p className="text-sm text-slate-400">{t('loading')}</p>
            ) : sortedJournals.length === 0 ? (
              <p className="text-sm text-amber-600">{t('exp_pay_no_journals')}</p>
            ) : (
              <Select value={journalId} onValueChange={setJournalId}>
                <SelectTrigger><SelectValue placeholder={t('exp_pay_journal')} /></SelectTrigger>
                <SelectContent>
                  {sortedJournals.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      <span className="flex items-center gap-2">
                        {j.type === 'cash'
                          ? <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                          : <Landmark className="w-3.5 h-3.5 text-sky-600" />}
                        {j.name_uz || j.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selected && (
              <p className="text-xs text-slate-400">
                {selected.type === 'cash' ? t('exp_pay_hint_cash') : t('exp_pay_hint_bank')}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('exp_pay_date')}</Label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={paying}>{t('cancel')}</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={paying || !journalId}
            onClick={() => onPay({ journal_id: journalId, paid_date: paidDate })}
          >
            {paying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('exp_pay_confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
