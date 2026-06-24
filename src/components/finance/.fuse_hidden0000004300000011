import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Loader2, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { taxCalculators } from '@/api/services/taxCalculators';
import { financeService } from '@/api/services/finance';
import { companyTaxRatesService } from '@/api/services/companyTaxRates';
import { formatApiError } from '@/utils/apiErrors';

// DividendDistribution — UI for TZ §5.3 dividend payout flow.
//
// Flow:
//   1. Admin enters: gross amount, shareholder name, distribution date.
//   2. Admin picks 3 accounts (retained earnings, cash/bank, tax liability).
//      The tax liability account auto-fills from the configured DIVIDEND
//      row's account_id (company_tax_rates) so the common case is "click
//      submit"; admins can still override.
//   3. Live preview shows tax amount + net to shareholder using the rate
//      from company_tax_rates(dividend) — defaults 5% per TZ §5.3.
//   4. Submit → backend creates a balanced journal entry
//      (Dr Retained Earnings / Cr Cash / Cr Tax Liability) and returns
//      the entry_number for audit.

export default function DividendDistribution() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [accounts, setAccounts] = useState([]);
  const [dividendRate, setDividendRate] = useState(5);
  const [defaultTaxLiabilityId, setDefaultTaxLiabilityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // form
  const [amount, setAmount] = useState('');
  const [shareholder, setShareholder] = useState('');
  const [distDate, setDistDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [retainedAcctId, setRetainedAcctId] = useState('');
  const [cashAcctId, setCashAcctId] = useState('');
  const [taxLiabAcctId, setTaxLiabAcctId] = useState('');
  const [notes, setNotes] = useState('');

  // Load accounts + the dividend row's configured rate + account once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accs, rates] = await Promise.all([
          financeService.listAccounts({ limit: 1000 }).catch(() => ({ data: [] })),
          companyTaxRatesService.list({ onlyActive: true }).catch(() => []),
        ]);
        if (cancelled) return;
        const list = Array.isArray(accs) ? accs : (accs?.data || accs?.items || []);
        setAccounts(list);

        // Pick the active DIVIDEND row to seed rate + tax liability acct.
        const div = (rates || []).find(
          (r) => r.applies_to === 'dividend' && r.is_active !== false,
        );
        if (div) {
          if (div.rate) setDividendRate(Number(div.rate) || 5);
          if (div.account_id) {
            setDefaultTaxLiabilityId(String(div.account_id));
            setTaxLiabAcctId(String(div.account_id));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const numericAmount = Number(String(amount).replace(/[^\d.-]/g, '')) || 0;
  const taxAmount = useMemo(
    () => Math.round(numericAmount * dividendRate / 100),
    [numericAmount, dividendRate],
  );
  const netToShareholder = Math.max(0, numericAmount - taxAmount);

  const valid = numericAmount > 0
    && shareholder.trim().length > 0
    && retainedAcctId
    && cashAcctId;

  const submit = async () => {
    if (!valid) {
      toast.error(t('dividend_form_invalid') || "Maydonlarni to'ldiring");
      return;
    }
    setPosting(true);
    try {
      const result = await taxCalculators.distributeDividend({
        amount: numericAmount,
        shareholder_name: shareholder.trim(),
        distribution_date: distDate,
        retained_earnings_account_id: retainedAcctId,
        cash_account_id: cashAcctId,
        tax_liability_account_id: taxLiabAcctId || undefined,
        notes: notes || undefined,
      });
      setLastResult(result);
      toast.success(t('dividend_posted') || "Dividend tarqatildi");
      // Reset most fields but keep account selections — admin will likely
      // post several distributions back-to-back to different shareholders.
      setAmount('');
      setShareholder('');
      setNotes('');
    } catch (e) {
      toast.error(formatApiError(e, t, t('error_occurred') || 'Xatolik'));
    } finally {
      setPosting(false);
    }
  };

  const accountLabel = (a) => `${a.code || ''}${a.code ? ' — ' : ''}${a.name || ''}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            {t('dividend_distribution_title') || "Dividend taqsimoti"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>{t('dividend_amount') || "Taqsimlanadigan summa"} *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10 000 000"
                disabled={loading}
              />
            </div>
            <div>
              <Label>{t('dividend_shareholder') || "Ta'sischi (ism)"} *</Label>
              <Input
                value={shareholder}
                onChange={(e) => setShareholder(e.target.value)}
                placeholder={t('dividend_shareholder_placeholder') || "Ism va familiya"}
                disabled={loading}
              />
            </div>
            <div>
              <Label>{t('dividend_date') || "Taqsimot sanasi"}</Label>
              <Input
                type="date"
                value={distDate}
                onChange={(e) => setDistDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <Label>{t('dividend_rate') || "Stavka"} (%)</Label>
              <Input
                value={dividendRate}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0 && v <= 100) setDividendRate(v);
                }}
                disabled={loading}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('dividend_rate_hint') || "Sozlamalar bo'limidagi Dividend qatoridan olingan"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3">
            <div>
              <Label>{t('retained_earnings_account') || "Foyda hisobi (debit)"} *</Label>
              <Select value={retainedAcctId} onValueChange={setRetainedAcctId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder={t('select_account') || "Hisobni tanlang"} /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{accountLabel(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('cash_account') || "Naqd / Bank (kredit)"} *</Label>
              <Select value={cashAcctId} onValueChange={setCashAcctId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder={t('select_account') || "Hisobni tanlang"} /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{accountLabel(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('tax_liability_account') || "Soliq majburiyati (kredit)"}</Label>
              <Select value={taxLiabAcctId} onValueChange={setTaxLiabAcctId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder={defaultTaxLiabilityId ? (t('default_from_settings') || "sozlamalar") : (t('select_account') || "Hisobni tanlang")} /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{accountLabel(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('tax_liability_account_hint') || "Bo'sh qoldirsangiz, Sozlamalar dagi Dividend qatorining hisobi ishlatiladi"}
              </p>
            </div>
          </div>

          <div>
            <Label>{t('notes') || "Izohlar"}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={submit} disabled={!valid || posting || loading}>
              {posting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('dividend_submit') || "Taqsimotni rasmiylashtirish"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live preview / receipt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="w-4 h-4" />
            {t('dividend_preview') || "Hisoblash"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>{t('dividend_amount') || "Taqsimlanadigan summa"}</span>
            <span className="tabular-nums font-medium">{formatCurrency(numericAmount)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t('dividend_rate') || "Stavka"} ({dividendRate}%)</span>
            <span className="tabular-nums">− {formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>{t('dividend_net') || "Ta'sischiga"}</span>
            <span className="tabular-nums text-green-700">{formatCurrency(netToShareholder)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t('dividend_tax_to_budget') || "Soliq (budjetga)"}</span>
            <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
          </div>

          {lastResult && (
            <div className="border-t pt-3 mt-3 space-y-1 text-xs">
              <p className="font-medium">
                {t('dividend_posted_label') || "Oxirgi taqsimot"}
                {' · '}
                <span className="font-mono">{lastResult.entry_number}</span>
              </p>
              <p className="text-muted-foreground">
                {lastResult.shareholder_name} · {lastResult.distribution_date}
              </p>
              <p className="text-muted-foreground">
                {t('dividend_amount') || "Summa"}: {formatCurrency(lastResult.gross_distribution)}
                {' · '}
                {t('dividend_tax_to_budget') || "Soliq"}: {formatCurrency(lastResult.tax_amount)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
