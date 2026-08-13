import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { TrendingUp, Calculator, FileCheck, Save, FileDown, AlertTriangle, History } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { financeService } from '@/api/services/finance';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

// Profit-tax page — §6 + §8 of ТЗ_Ish_Haqi_Soliq_Tolik.docx.
//
// Accountants enter the period's revenue and the page recomputes the
// classic 3-number picture for Uzbekistan profit tax:
//    Accounting profit = income − (recognized + unrecognized)
//    Tax base          = income − recognized      ← the key distinction
//    Tax amount        = tax_base × rate (default 15%)
//    Net profit        = accounting_profit − tax_amount
//
// Expense totals come from the backend's GET /profit-tax endpoint, which
// sums expenses with is_recognized=TRUE vs. FALSE for the chosen period.
// The "income" field is still a manual override until the revenue ledger
// is wired up — we keep it prominent so the user remembers to enter it.

const PERIOD_TYPES = [
  { value: 'month', labelKey: 'period_month', fallback: "Oylik" },
  { value: 'quarter', labelKey: 'period_quarter', fallback: "Kvartal" },
  { value: 'year', labelKey: 'period_year', fallback: "Yillik" },
];

// Build a default period_key matching the selected type (today's UTC).
function currentPeriodKey(type, date = new Date()) {
  const d = new Date(date.getTime());
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (type === 'year') return String(y);
  if (type === 'quarter') {
    const q = Math.floor((m - 1) / 3) + 1;
    return `${y}-Q${q}`;
  }
  // default month
  return `${y}-${String(m).padStart(2, '0')}`;
}

export default function ProfitTax() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [periodType, setPeriodType] = useState('month');
  const [periodKey, setPeriodKey] = useState(() => currentPeriodKey('month'));
  const [incomeInput, setIncomeInput] = useState('0'); // formatted string
  // Empty = use the tenant's configured company_tax_rates 'profit' rate
  // (server default). The old hardcoded '15' was ALWAYS sent, so the
  // configured rate never applied on this tab while "Umumiy soliq
  // jamlanmasi" used it — two tabs, two answers (soliq audit 2026-08-13).
  const [rate, setRate] = useState(''); // percent override, '' = server default

  const [result, setResult] = useState(null); // ProfitTaxCalcResult shape
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [pullingRevenue, setPullingRevenue] = useState(false);

  // When period type flips, reset period_key to the matching format so we
  // don't send "2026-04" to the /year branch etc.
  useEffect(() => {
    setPeriodKey(prev => {
      // Heuristic: if the current key already looks valid for the new
      // type, keep it. Otherwise derive from today.
      if (periodType === 'year' && /^\d{4}$/.test(prev)) return prev;
      if (periodType === 'quarter' && /^\d{4}-Q[1-4]$/.test(prev)) return prev;
      if (periodType === 'month' && /^\d{4}-\d{2}$/.test(prev)) return prev;
      return currentPeriodKey(periodType);
    });
  }, [periodType]);

  const income = useMemo(() => {
    const parsed = parseFloat(parsePriceInput(incomeInput));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [incomeInput]);

  const load = useCallback(async () => {
    if (!periodKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await financeService.getProfitTax({
        periodType,
        periodKey,
        income,
        rate: rate !== '' ? (parseFloat(rate) || undefined) : undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Error');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [periodType, periodKey, income, rate]);

  // Debounced: income/rate are keystroke-hot inputs — firing a request per
  // character raced responses out of order (soliq audit 2026-08-13).
  useEffect(() => {
    const id = setTimeout(load, 350);
    return () => clearTimeout(id);
  }, [load]);

  // "Pull from ledger" — replaces the manual income field with the sum
  // of revenue account credits for the current period. Drops right into
  // the same formatted input so the user can still tweak the value.
  const handlePullRevenue = async () => {
    setPullingRevenue(true);
    try {
      const data = await financeService.getProfitTaxRevenue({ periodType, periodKey });
      if (data) {
        setIncomeInput(formatPriceInput(String(data.income || 0)));
        if (data.entry_count === 0) {
          toast.info(
            t('profit_tax_revenue_empty') ||
              "Davrda daromad hisobidagi qaydlar topilmadi. 0 so'm qo'yildi.",
          );
        } else {
          toast.success(
            `${t('profit_tax_revenue_loaded') || 'Daromad yuklandi'} (${data.entry_count} ${t('entries') || 'qaydlar'})`,
          );
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setPullingRevenue(false);
    }
  };

  const handleSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      await financeService.snapshotProfitTax({
        periodType,
        periodKey,
        income,
        rate: parseFloat(rate) || undefined,
      });
      toast.success(t('profit_tax_snapshot_saved') || "Snapshot saqlandi");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || "Xatolik");
    } finally {
      setSavingSnapshot(false);
    }
  };

  // Tax base is typically LARGER than accounting profit when there are
  // unrecognized expenses — the TZ calls this out explicitly. Compute the
  // difference so we can show a warning strip when it's non-zero.
  const unrecognizedDelta = result
    ? Math.round((result.tax_base - result.accounting_profit) * 100) / 100
    : 0;

  // ── Unrecognized expenses tab ──
  // Uses the new is_recognized / date_from / date_to filters on the
  // expenses endpoint so the tab shows exactly the rows feeding into
  // `result.unrecognized_exp`. See §10 report #5 of the TZ.
  const [unrecognizedList, setUnrecognizedList] = useState([]);
  const [unrecognizedLoading, setUnrecognizedLoading] = useState(false);
  const loadUnrecognized = useCallback(async () => {
    if (!result?.period_start || !result?.period_end) return;
    setUnrecognizedLoading(true);
    try {
      const data = await financeService.listExpenses({
        is_recognized: 'false',
        date_from: result.period_start,
        date_to: result.period_end,
        limit: 200,
      });
      // Backend returns either an array (Success) or { data, meta } with
      // pagination — normalize both.
      const items = Array.isArray(data) ? data : (data?.data || data?.items || []);
      setUnrecognizedList(items);
    } catch (e) {
      setUnrecognizedList([]);
    } finally {
      setUnrecognizedLoading(false);
    }
  }, [result?.period_start, result?.period_end]);

  // Load the unrecognized list whenever the calculator changes the period
  // window — user might flip months without switching tabs.
  useEffect(() => { loadUnrecognized(); }, [loadUnrecognized]);

  // ── Snapshots tab ──
  const [snapYear, setSnapYear] = useState(() => new Date().getUTCFullYear());
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const loadSnapshots = useCallback(async () => {
    setSnapshotsLoading(true);
    try {
      const rows = await financeService.listProfitTaxSnapshots({ year: String(snapYear) });
      setSnapshots(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setSnapshots([]);
    } finally {
      setSnapshotsLoading(false);
    }
  }, [snapYear]);
  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  // ── Excel export ──
  // Single workbook, three sheets: "Summary" with the formula breakdown,
  // "Unrecognized" with the expense rows, "Snapshots" with the year's
  // closed periods. Follows §10 of the TZ — this file is what the
  // accountant hands to the profit-tax declaration (#6).
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const handleExportXlsx = async () => {
    if (!result) return;
    setExportingXlsx(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1 — summary + formula
      const summary = [
        [t('profit_tax') || "Foyda solig'i"],
        [t('period') || 'Davr', `${result.period_start} — ${result.period_end}`],
        [t('rate_percent') || 'Stavka (%)', result.rate],
        [],
        [t('income') || 'Daromad', result.income],
        [t('recognized_expenses') || 'Tan olingan xarajat', result.recognized_exp],
        [t('unrecognized_expenses') || 'Tan olinmagan xarajat', result.unrecognized_exp],
        [t('total_expenses') || 'Jami xarajat', result.total_expenses],
        [],
        [t('accounting_profit') || 'Buxgalteriya foydasi', result.accounting_profit],
        [t('tax_base') || 'Soliq bazasi', result.tax_base],
        [`${t('profit_tax') || "Foyda solig'i"} (${result.rate}%)`, result.tax_amount],
        [t('net_profit') || 'Sof foyda', result.net_profit],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summary);
      wsSummary['!cols'] = [{ wch: 32 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Sheet 2 — unrecognized expenses
      const unrecHeader = [
        '№',
        t('date') || 'Sana',
        t('employee') || 'Xodim',
        t('description') || 'Izoh',
        t('amount') || 'Miqdor',
      ];
      const unrecBody = unrecognizedList.map((e, i) => [
        i + 1,
        e.date || e.expense_date || '',
        e.employee_name || '',
        e.description || '',
        Number(e.total_amount || e.amount || 0),
      ]);
      const unrecTotal = unrecBody.reduce((s, r) => s + (Number(r[4]) || 0), 0);
      unrecBody.push(['', '', '', t('total') || 'JAMI', unrecTotal]);
      const wsUnrec = XLSX.utils.aoa_to_sheet([unrecHeader, ...unrecBody]);
      wsUnrec['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 22 }, { wch: 42 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsUnrec, 'Unrecognized');

      // Sheet 3 — snapshots for the selected year
      const snapHeader = [
        t('period') || 'Davr',
        t('income') || 'Daromad',
        t('recognized_expenses') || 'Tan olingan',
        t('unrecognized_expenses') || 'Tan olinmagan',
        t('accounting_profit') || 'Buxgalteriya',
        t('tax_base') || 'Soliq bazasi',
        `${t('profit_tax') || "Foyda solig'i"} (%)`,
        t('tax_amount') || 'Soliq summasi',
        t('net_profit') || 'Sof foyda',
      ];
      const snapBody = snapshots.map(s => [
        s.period_key,
        Number(s.income) || 0,
        Number(s.recognized_exp) || 0,
        Number(s.unrecognized_exp) || 0,
        Number(s.accounting_profit) || 0,
        Number(s.tax_base) || 0,
        Number(s.rate_snapshot) || 0,
        Number(s.tax_amount) || 0,
        Number(s.net_profit) || 0,
      ]);
      const wsSnap = XLSX.utils.aoa_to_sheet([snapHeader, ...snapBody]);
      wsSnap['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsSnap, 'Snapshots');

      const today = format(new Date(), 'yyyy-MM-dd');
      XLSX.writeFile(wb, `profit-tax-${result.period_key}-${today}.xlsx`);
      toast.success(t('export_success') || "Excel yuklandi");
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || "Xatolik");
    } finally {
      setExportingXlsx(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            {t('profit_tax') || "Foyda solig'i"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('profit_tax_subtitle') ||
              "Tan olingan va tan olinmagan xarajatlarni ajratib, soliq bazasini to'g'ri hisoblash."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <Calculator className="w-4 h-4 mr-2" />
            {t('recalculate') || "Qayta hisoblash"}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportXlsx}
            disabled={!result || exportingXlsx || loading}
          >
            <FileDown className="w-4 h-4 mr-2" />
            {exportingXlsx ? (t('exporting') || "Yuklanmoqda...") : 'Excel'}
          </Button>
          <Button onClick={handleSnapshot} disabled={savingSnapshot || loading}>
            <Save className="w-4 h-4 mr-2" />
            {savingSnapshot
              ? (t('saving') || 'Saqlanmoqda...')
              : (t('snapshot_save') || 'Snapshot saqlash')}
          </Button>
        </div>
      </div>

      {/* Period + income inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t('period_and_revenue') || 'Davr va daromad'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">
                {t('period_type') || 'Davr turi'}
              </Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {t(p.labelKey) || p.fallback}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">
                {t('period') || 'Davr'}
              </Label>
              <Input
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
                placeholder={
                  periodType === 'year'
                    ? 'YYYY'
                    : periodType === 'quarter'
                      ? 'YYYY-Qn'
                      : 'YYYY-MM'
                }
                className="font-mono"
              />
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">
                {t('income') || 'Daromad'} (so'm)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(formatPriceInput(e.target.value))}
                  inputMode="decimal"
                  placeholder="100 000 000"
                  className="font-mono"
                />
                {/* Pull from the general ledger for this period. Keeps the
                    same input editable afterwards so the accountant can
                    still override. */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePullRevenue}
                  disabled={pullingRevenue || loading}
                  title={t('profit_tax_pull_revenue_tooltip') ||
                    "Ushbu davr uchun bosh kitobdagi daromad schyotlari yig'indisini olish"}
                >
                  {pullingRevenue ? '…' : (t('from_ledger') || "Kitob")}
                </Button>
              </div>
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">
                {t('rate_percent') || 'Stavka (%)'}
              </Label>
              <Input
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                placeholder={result?.rate != null ? String(result.rate) : '15'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/*
        Three tabs:
          • Calculator   — the live summary + formula (original content).
          • Unrecognized — every expense with is_recognized=false in the
                           active period; populates §10 report #5 of the TZ.
          • Snapshots    — persisted closed-period calculations for the year.
      */}
      <Tabs defaultValue="calculator" className="w-full">
        <TabsList>
          <TabsTrigger value="calculator">
            <Calculator className="w-4 h-4 mr-2" />
            {t('calculator') || 'Hisoblash'}
          </TabsTrigger>
          <TabsTrigger value="unrecognized">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {t('unrecognized_expenses') || 'Tan olinmagan'}
            {unrecognizedList.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unrecognizedList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="snapshots">
            <History className="w-4 h-4 mr-2" />
            {t('snapshots') || 'Snapshotlar'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6 mt-4">

      {/* Summary cards — colour palette per §8.3 of the TZ. */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard
            label={t('income') || 'Daromad'}
            value={formatCurrency(result.income)}
            tone="blue"
          />
          <StatCard
            label={t('recognized_expenses') || 'Tan olingan xarajat'}
            value={formatCurrency(result.recognized_exp)}
            tone="emerald"
          />
          <StatCard
            label={t('unrecognized_expenses') || 'Tan olinmagan xarajat'}
            value={formatCurrency(result.unrecognized_exp)}
            tone="red"
          />
          <StatCard
            label={t('accounting_profit') || "Buxgalteriya foydasi"}
            value={formatCurrency(result.accounting_profit)}
            tone="slate"
            help={t('accounting_profit_help') ||
              'Daromad − barcha xarajatlar (tan olingan + tan olinmagan).'}
          />
          <StatCard
            label={t('tax_base') || 'Soliq bazasi'}
            value={formatCurrency(result.tax_base)}
            tone="amber"
            help={t('tax_base_help') ||
              'Daromad − faqat tan olingan xarajatlar. Soliq shu bazadan olinadi.'}
          />
          <StatCard
            label={`${t('profit_tax') || "Foyda solig'i"} (${result.rate}%)`}
            value={formatCurrency(result.tax_amount)}
            tone="red-strong"
          />
        </div>
      )}

      {/* Formula card */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              {t('profit_tax_formula') || "Hisoblash formulasi"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <FormulaLine
              left={t('accounting_profit') || "Buxgalteriya foydasi"}
              formula={`${formatCurrency(result.income)} − ${formatCurrency(result.total_expenses)}`}
              right={formatCurrency(result.accounting_profit)}
            />
            <FormulaLine
              left={t('tax_base') || 'Soliq bazasi'}
              formula={`${formatCurrency(result.income)} − ${formatCurrency(result.recognized_exp)}`}
              right={formatCurrency(result.tax_base)}
              highlight
            />
            <FormulaLine
              left={`${t('profit_tax') || "Foyda solig'i"}`}
              formula={`${formatCurrency(result.tax_base)} × ${result.rate}%`}
              right={formatCurrency(result.tax_amount)}
            />
            <FormulaLine
              left={t('net_profit') || 'Sof foyda'}
              formula={`${formatCurrency(result.accounting_profit)} − ${formatCurrency(result.tax_amount)}`}
              right={formatCurrency(result.net_profit)}
            />

            {/* Warning strip when unrecognized expenses inflate the tax base. */}
            {unrecognizedDelta > 0 && (
              <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <b>{t('profit_tax_warning_title') || 'Diqqat'}:</b>{' '}
                  {(t('profit_tax_warning_body') || 'Tan olinmagan xarajatlar tufayli soliq bazasi buxgalteriya foydasidan katta. Farq:')} <b>{formatCurrency(unrecognizedDelta)}</b>.
                </div>
              </div>
            )}

            {/* Progress bar showing recognized vs unrecognized breakdown. */}
            {result.total_expenses > 0 && (
              <div className="pt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('expense_recognition_breakdown') || 'Xarajatlarning tan olish bo\'yicha ulushi'}</span>
                  <span>
                    {Math.round((result.recognized_exp / result.total_expenses) * 100)}% {t('recognized') || 'tan olingan'}
                  </span>
                </div>
                <Progress
                  value={(result.recognized_exp / result.total_expenses) * 100}
                  className="h-2"
                />
              </div>
            )}

            {result.snapshotted && (
              <div className="pt-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {t('profit_tax_snapshot_exists') || 'Ushbu davr uchun snapshot saqlangan'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty/loading state */}
      {loading && !result && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {t('loading') || 'Yuklanmoqda...'}
        </div>
      )}
        </TabsContent>

        {/* ── Unrecognized expenses tab ── */}
        <TabsContent value="unrecognized" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                {t('unrecognized_expenses') || "Tan olinmagan xarajatlar"}
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  {result?.period_start} — {result?.period_end}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unrecognizedLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {t('loading') || 'Yuklanmoqda...'}
                </div>
              ) : unrecognizedList.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {t('no_unrecognized_expenses') ||
                    "Tan olinmagan xarajat yo'q — soliq bazasi va buxgalteriya foydasi teng."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>{t('date') || 'Sana'}</TableHead>
                      <TableHead>{t('employee') || 'Xodim'}</TableHead>
                      <TableHead>{t('description') || 'Izoh'}</TableHead>
                      <TableHead className="text-right">{t('amount') || 'Miqdor'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unrecognizedList.map((e, i) => (
                      <TableRow key={e.id || i} className="bg-red-50/30">
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {e.date || e.expense_date || '—'}
                        </TableCell>
                        <TableCell className="font-medium">{e.employee_name || '—'}</TableCell>
                        <TableCell className="max-w-[320px] truncate" title={e.description}>
                          {e.description || '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(Number(e.total_amount || e.amount) || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={4} className="font-semibold">
                        {t('total') || 'JAMI'}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatCurrency(
                          unrecognizedList.reduce(
                            (s, e) => s + (Number(e.total_amount || e.amount) || 0),
                            0,
                          ),
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Snapshots tab ── */}
        <TabsContent value="snapshots" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" />
                  {t('closed_periods') || "Yopilgan davrlar"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">{t('year') || 'Yil'}</Label>
                  <Input
                    value={snapYear}
                    onChange={(e) => setSnapYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                    className="w-20 font-mono text-center"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {snapshotsLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {t('loading') || 'Yuklanmoqda...'}
                </div>
              ) : snapshots.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {t('no_snapshots') || "Saqlangan snapshot yo'q."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('period') || 'Davr'}</TableHead>
                      <TableHead className="text-right">{t('income') || 'Daromad'}</TableHead>
                      <TableHead className="text-right">{t('recognized') || 'Tan olingan'}</TableHead>
                      <TableHead className="text-right">{t('unrecognized') || 'Tan olinmagan'}</TableHead>
                      <TableHead className="text-right">{t('tax_base') || 'Soliq bazasi'}</TableHead>
                      <TableHead className="text-right">{t('rate_percent') || 'Stavka (%)'}</TableHead>
                      <TableHead className="text-right">{t('tax_amount') || 'Soliq'}</TableHead>
                      <TableHead className="text-right">{t('net_profit') || 'Sof foyda'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono">{s.period_key}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(s.income)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(s.recognized_exp)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">
                          {formatCurrency(s.unrecognized_exp)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(s.tax_base)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(s.rate_snapshot).toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatCurrency(s.tax_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(s.net_profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Small card used for the 6-up summary row. `tone` maps to the colour
// palette in §8.3 of the TZ so the visual language matches other modules.
function StatCard({ label, value, tone, help }) {
  const toneClass = {
    blue:       'text-blue-600',
    emerald:    'text-emerald-600',
    red:        'text-red-600',
    'red-strong': 'text-red-700 font-semibold',
    amber:      'text-amber-700',
    slate:      'text-slate-700',
  }[tone] || 'text-slate-700';

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground truncate" title={help || undefined}>
          {label}
        </p>
        <p className={`text-lg font-bold truncate ${toneClass}`} title={value}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// Single "left = formula → right" row used inside the formula card.
function FormulaLine({ left, formula, right, highlight }) {
  return (
    <div
      className={`grid grid-cols-12 gap-2 items-center py-1 ${
        highlight ? 'bg-amber-50 rounded px-2' : ''
      }`}
    >
      <div className="col-span-3 text-sm font-medium">{left}</div>
      <div className="col-span-6 text-xs text-muted-foreground font-mono">{formula}</div>
      <div className="col-span-3 text-sm font-semibold text-right tabular-nums">{right}</div>
    </div>
  );
}
