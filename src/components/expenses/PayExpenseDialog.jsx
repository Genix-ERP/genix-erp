import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Banknote } from 'lucide-react';
import { financeService } from '@/api/services/finance';

// "To'lash" dialog — asks WHICH account pays (kassa/bank) before posting.
// The server posts the journal entry (Dt category account / Kt this
// account) in the same transaction that flips the status to paid.
export default function PayExpenseDialog({ open, onClose, onPay, expense, paying, formatCurrency, t }) {
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [method, setMethod] = useState('cash');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!open) return;
    setAccountId('');
    setMethod('cash');
    setPaidDate(new Date().toISOString().split('T')[0]);
    setAccountsLoading(true);
    financeService.listAccounts({ limit: 500 })
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : rows?.items || [];
        setAccounts(list);
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false));
  }, [open]);

  // Money accounts on the BHMS chart: 50xx kassa, 51xx bank. Leaf only —
  // TT §4.2 forbids posting to group headers.
  const moneyAccounts = useMemo(
    () => accounts.filter((a) => {
      const code = String(a.code || '');
      return (code.startsWith('50') || code.startsWith('51')) && a.is_leaf !== false;
    }),
    [accounts]
  );

  useEffect(() => {
    if (!accountId && moneyAccounts.length > 0) {
      const preferred = moneyAccounts.find((a) => String(a.code) === '5010') || moneyAccounts[0];
      setAccountId(preferred.id);
      setMethod(String(preferred.code || '').startsWith('51') ? 'bank' : 'cash');
    }
  }, [moneyAccounts, accountId]);

  if (!expense) return null;

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
            <Label>{t('exp_pay_account')} *</Label>
            {accountsLoading ? (
              <p className="text-sm text-slate-400">{t('loading')}</p>
            ) : (
              <Select value={accountId} onValueChange={(v) => {
                setAccountId(v);
                const acc = moneyAccounts.find((a) => a.id === v);
                if (acc) setMethod(String(acc.code || '').startsWith('51') ? 'bank' : 'cash');
              }}>
                <SelectTrigger><SelectValue placeholder={t('exp_pay_account')} /></SelectTrigger>
                <SelectContent>
                  {moneyAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name_uz || a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('exp_pay_method')}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('exp_method_cash')}</SelectItem>
                  <SelectItem value="bank">{t('exp_method_bank')}</SelectItem>
                  <SelectItem value="card">{t('exp_method_card')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('exp_pay_date')}</Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={paying}>{t('cancel')}</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={paying || (!accountId && moneyAccounts.length > 0)}
            onClick={() => onPay({ payment_account_id: accountId || undefined, payment_method: method, paid_date: paidDate })}
          >
            {paying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('exp_pay_confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
