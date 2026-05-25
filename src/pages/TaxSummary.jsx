import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Calculator, PiggyBank, Receipt, Users, TrendingUp, FileSpreadsheet, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { taxCalculators } from '@/api/services/taxCalculators';
import { formatApiError } from '@/utils/apiErrors';
// Dividend posting flow (TZ §5.3) — surfaced inline below the calculator
// cards so the same page that shows "Dividend rate: 5%" also lets the
// admin post a real distribution.
import DividendDistribution from '@/components/finance/DividendDistribution';

// TaxSummary — "Umumiy soliq jamlanmasi" page per TZ §10 of
// ТЗ_Ish_Haqi_Soliq_Tolik.docx. A single director-level dashboard that
// shows the 8 TZ-listed taxes for a chosen period, with rates pulled live
// from Kompaniya soliqlari + Xodim soliqlari settings. Every number on
// this page moves when the admin changes a rate — TZ §11.9 in action.
//
// Why this page exists:
//   Before this, the Kompaniya soliqlari section stored rates but had no
//   visible consumer. The four calculators (NDS / Foyda / Aylanma /
//   Dividend) each have their own endpoint; this page is the aggregator
//   that shows them all together so the user can see Kompaniya soliqlari
//   is actually driving real numbers.

const PERIOD_TYPES = [
  { value: 'month',   labelKey: 'period_month',   fallback: 'Oylik' },
  { value: 'quarter', labelKey: 'period_quarter', fallback: 'Kvartal' },
  { value: 'year',    labelKey: 'period_year',    fallback: 'Yillik' },
];

function currentPeriodKey(type, date = new Date()) {
  const d = new Date(date.getTime());
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (type === 'year') return String(y);
  if (type === 'quarter') {
    const q = Math.floor((m - 1) / 3) + 1;
    return `${y}-Q${q}`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export default function TaxSummary() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [periodType, setPeriodType] = useState('month');
  const [periodKey,  setPeriodKey]  = useState(() => currentPeriodKey('month'));
  const [manualIncome, setManualIncome] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taxCalculators.combined({
        periodType,
        periodKey,
        income: manualIncome,
      });
      setSummary(data);
    } catch (e) {
      toast.error(formatApiError(e, t, t('error_occurred') || 'Xatolik'));
    } finally {
      setLoading(false);
    }
    // `t` is intentionally NOT in the deps. useTranslation returns a fresh
    // function reference on every render, so including it here would make
    // `load` recompute every render → useEffect([load]) would re-fire →
    // setState → re-render → infinite GET /tax-summary/combined loop. The
    // toast just needs the *current* `t` at error time, which is captured
    // by closure regardless of whether it's in the dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodKey, manualIncome]);

  useEffect(() => { load(); }, [load]);

  // When the user switches period type, default the period key to the
  // canonical format for the new type so they don't have to retype.
  const onPeriodTypeChange = (v) => {
    setPeriodType(v);
    setPeriodKey(currentPeriodKey(v));
  };

  const nds      = summary?.nds      || {};
  const profit   = summary?.profit   || {};
  const turnover = summary?.turnover || {};
  const dividend = summary?.dividend || {};
  const payroll  = summary?.payroll  || {};

  const payrollRows = useMemo(() => {
    return (payroll.buckets || []).slice().sort((a, b) => {
      // Group employee withholdings first, then employer contributions.
      if (a.payer !== b.payer) return a.payer === 'employee' ? -1 : 1;
      return (a.code || '').localeCompare(b.code || '');
    });
  }, [payroll.buckets]);

  // ── Exports (TZ §10 "Umumiy soliq jamlanmasi" — PDF & Excel). The
  // page already shows everything the report needs, so the exports are
  // pure data-shape conversions — no extra fetches.
  const exportFileBase = `tax-summary-${periodKey || 'period'}`;

  const exportXlsx = () => {
    if (!summary) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Headline
    const headline = [
      [t('tax_summary_title') || 'Umumiy soliq jamlanmasi'],
      [t('period_key') || 'Davr', `${summary.period_start} — ${summary.period_end}`],
      [],
      [t('tax_summary_company_total') || 'Kompaniya soliq majburiyatlari', summary.company_tax_total || 0],
      [],
      [t('nds_tax') || 'NDS', `${Number(nds.rate || 0).toFixed(2)}%`],
      [t('nds_realizatsiya') || 'Realizatsiya', nds.realizatsiya || 0],
      [t('nds_zachet') || 'Zachet', nds.zachet || 0],
      [t('nds_balansi') || "To'lov", nds.balansi || 0],
      [],
      [t('profit_tax') || "Foyda solig'i", `${Number(profit.rate || 0).toFixed(2)}%`],
      [t('income') || 'Daromad', profit.income || 0],
      [t('recognized_expenses') || 'Tan olingan xarajatlar', profit.recognized || 0],
      [t('tax_base') || 'Soliq bazasi', profit.tax_base || 0],
      [t('profit_tax_amount') || "Foyda solig'i", profit.tax_amount || 0],
      [],
      [t('turnover_tax') || "Aylanma solig'i", `${Number(turnover.rate || 0).toFixed(2)}%`],
      [t('turnover') || 'Aylanma', turnover.turnover || 0],
      [t('turnover_tax_amount') || "Aylanma solig'i", turnover.tax_amount || 0],
      [],
      [t('dividend_tax') || "Dividend solig'i", `${Number(dividend.rate || 0).toFixed(2)}%`],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headline), 'Summary');

    // Sheet 2 — Per-employee-tax breakdown for the period
    if (payrollRows.length > 0) {
      const header = [
        t('code') || 'Kod',
        t('name') || 'Nomi',
        t('payer') || "To'lovchi",
        t('rate') || 'Stavka',
        t('amount') || 'Summa',
      ];
      const body = payrollRows.map((r) => [
        r.code, r.name,
        r.payer === 'employer' ? (t('employer') || 'Ish beruvchi') : (t('employee') || 'Xodim'),
        Number(r.rate || 0),
        Number(r.amount || 0),
      ]);
      body.push([]);
      body.push(['', '', t('employee_total_withhold') || 'Xodimdan ushlangan', '', payroll.employee_withhold || 0]);
      body.push(['', '', t('employer_total_contrib') || "Ish beruvchi to'laydi", '', payroll.employer_contrib || 0]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), 'Payroll');
    }

    XLSX.writeFile(wb, `${exportFileBase}.xlsx`);
  };

  const exportPdf = () => {
    if (!summary) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.text(t('tax_summary_title') || 'Umumiy soliq jamlanmasi', 14, 16);
    doc.setFontSize(10);
    doc.text(`${t('period_key') || 'Davr'}: ${summary.period_start} — ${summary.period_end}`, 14, 22);
    doc.setFontSize(12);
    doc.text(
      `${t('tax_summary_company_total') || 'Kompaniya soliq majburiyatlari'}: ${formatCurrency(summary.company_tax_total || 0)}`,
      14, 30,
    );

    autoTable(doc, {
      startY: 36,
      head: [[t('name') || 'Tax', t('rate') || '%', t('amount') || 'Amount']],
      body: [
        [t('nds_tax') || 'NDS — realizatsiya', `${Number(nds.rate || 0).toFixed(2)}%`, formatCurrency(nds.realizatsiya || 0)],
        [t('nds_zachet') || 'NDS — zachet', '', `− ${formatCurrency(nds.zachet || 0)}`],
        [t('nds_balansi') || 'NDS — net', '', formatCurrency(nds.balansi || 0)],
        [t('profit_tax') || "Foyda solig'i", `${Number(profit.rate || 0).toFixed(2)}%`, formatCurrency(profit.tax_amount || 0)],
        [t('turnover_tax') || "Aylanma solig'i", `${Number(turnover.rate || 0).toFixed(2)}%`, formatCurrency(turnover.tax_amount || 0)],
        [t('dividend_tax') || "Dividend solig'i", `${Number(dividend.rate || 0).toFixed(2)}%`, '—'],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 95, 165] }, // §8.3 brand blue
    });

    if (payrollRows.length > 0) {
      autoTable(doc, {
        head: [[t('code') || 'Kod', t('name') || 'Nomi', t('payer') || "To'lovchi", t('rate') || '%', t('amount') || 'Summa']],
        body: payrollRows.map((r) => [
          r.code, r.name,
          r.payer === 'employer' ? (t('employer') || 'Ish beruvchi') : (t('employee') || 'Xodim'),
          `${Number(r.rate || 0).toFixed(2)}%`,
          formatCurrency(r.amount || 0),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [29, 158, 117] }, // §8.3 green for netto
      });
    }

    doc.save(`${exportFileBase}.pdf`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('tax_summary_title') || "Umumiy soliq jamlanmasi"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('tax_summary_subtitle') ||
              "Barcha soliqlar bitta sahifada. Stavkalar Sozlamalar bo'limidan olinadi."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {summary?.regime_conflict && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t('tax_regime_conflict_badge') || 'NDS va Aylanma bir vaqtda faol'}
            </Badge>
          )}
          {summary && (
            <>
              <Button variant="outline" size="sm" onClick={exportXlsx}>
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                {t('export_excel') || 'Excel'}
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <FileDown className="w-4 h-4 mr-1.5" />
                {t('export_pdf') || 'PDF'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>{t('period_type') || 'Davr turi'}</Label>
            <Select value={periodType} onValueChange={onPeriodTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {t(p.labelKey) || p.fallback}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('period_key') || 'Davr'}</Label>
            <Input value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>{t('income_override') || "Daromad (manual — bo'sh qoldirsangiz bosh kitobdan olinadi)"}</Label>
            <Input
              inputMode="decimal"
              value={manualIncome}
              onChange={(e) => setManualIncome(e.target.value)}
              placeholder={t('auto_from_ledger') || 'avtomatik'}
            />
          </div>
        </CardContent>
      </Card>

      {loading && !summary && (
        <div className="text-center py-10 text-muted-foreground">
          {t('loading') || 'Yuklanmoqda…'}
        </div>
      )}

      {summary && (
        <>
          {/* Headline — company tax total */}
          <Card className="border-2 border-blue-600/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4" />
                {t('tax_summary_company_total') || "Kompaniya soliq majburiyatlari (davr uchun)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-blue-700 tabular-nums">
                {formatCurrency(summary.company_tax_total || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {summary.period_start} — {summary.period_end}
              </div>
            </CardContent>
          </Card>

          {/* 4 activity taxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NDS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-4 h-4" />
                  {t('nds_tax') || 'NDS (QQS)'}
                  <Badge variant="outline" className="ml-auto">{Number(nds.rate || 0).toFixed(2)}%</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('nds_realizatsiya') || "Realizatsiya (sotuvdan)"}</span>
                  <span className="tabular-nums">{formatCurrency(nds.realizatsiya || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('nds_zachet') || "Zachet (xariddan)"}</span>
                  <span className="tabular-nums">− {formatCurrency(nds.zachet || 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>{t('nds_balansi') || "To'lov (balansi)"}</span>
                  <span className={`tabular-nums ${nds.payable ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(nds.balansi || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Foyda */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PiggyBank className="w-4 h-4" />
                  {t('profit_tax') || "Foyda solig'i"}
                  <Badge variant="outline" className="ml-auto">{Number(profit.rate || 0).toFixed(2)}%</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('income') || 'Daromad'} <span className="text-[10px] text-muted-foreground">({profit.income_source || '—'})</span></span>
                  <span className="tabular-nums">{formatCurrency(profit.income || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('recognized_expenses') || "Tan olingan xarajatlar"}</span>
                  <span className="tabular-nums">− {formatCurrency(profit.recognized || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('tax_base') || "Soliq bazasi"}</span>
                  <span className="tabular-nums">{formatCurrency(profit.tax_base || 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>{t('profit_tax_amount') || "Foyda solig'i"}</span>
                  <span className="tabular-nums text-red-600">{formatCurrency(profit.tax_amount || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Aylanma */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calculator className="w-4 h-4" />
                  {t('turnover_tax') || "Aylanma solig'i"}
                  <Badge variant="outline" className="ml-auto">{Number(turnover.rate || 0).toFixed(2)}%</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('turnover') || 'Aylanma'}</span>
                  <span className="tabular-nums">{formatCurrency(turnover.turnover || 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>{t('turnover_tax_amount') || "Aylanma solig'i"}</span>
                  <span className="tabular-nums text-red-600">{formatCurrency(turnover.tax_amount || 0)}</span>
                </div>
                {summary.regime_conflict && (
                  <p className="text-xs text-red-600 mt-1">
                    {t('tax_regime_conflict_hint') ||
                      "NDS bilan Aylanma bir vaqtda faol — birini o'chiring."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Dividend — rate only, per-distribution calculator lives elsewhere */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4" />
                  {t('dividend_tax') || "Dividend solig'i"}
                  <Badge variant="outline" className="ml-auto">{Number(dividend.rate || 0).toFixed(2)}%</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="text-muted-foreground">
                  {t('dividend_per_distribution_hint') ||
                    "Dividend solig'i har bir taqsimotda hisoblanadi. POST /dividend-distributions orqali rasmiylashtiriladi."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dividend distribution form — TZ §5.3 consumer flow.
              Lives next to the dividend rate card so the section is
              self-contained: read the rate, post a payout. */}
          <DividendDistribution />

          {/* Payroll breakdown */}
          {payrollRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4" />
                  {t('payroll_taxes') || 'Xodim soliqlari (davr uchun)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('code') || 'Kod'}</TableHead>
                      <TableHead>{t('name') || 'Nomi'}</TableHead>
                      <TableHead>{t('payer') || "To'lovchi"}</TableHead>
                      <TableHead className="text-right">{t('rate') || 'Stavka'}</TableHead>
                      <TableHead className="text-right">{t('amount') || 'Summa'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRows.map((row, i) => (
                      <TableRow key={`${row.code}-${i}`}>
                        <TableCell className="font-mono text-xs">{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>
                          <Badge variant={row.payer === 'employer' ? 'secondary' : 'outline'}>
                            {row.payer === 'employer'
                              ? (t('employer') || 'Ish beruvchi')
                              : (t('employee') || 'Xodim')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{Number(row.rate || 0).toFixed(2)}%</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.amount || 0)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell colSpan={4}>{t('employee_total_withhold') || 'Xodimdan ushlangan'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(payroll.employee_withhold || 0)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell colSpan={4}>{t('employer_total_contrib') || "Ish beruvchi o'zi to'laydi"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(payroll.employer_contrib || 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
