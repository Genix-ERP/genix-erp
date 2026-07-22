import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText, Download, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, ChevronLeft, DollarSign,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Scale
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import financeService from '@/api/services/finance';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import DiagnosticsPanel from '@/components/finance/DiagnosticsPanel';

// Helper to get date range for period filter
const getDateParams = (period) => {
  const now = new Date();
  let periodFrom, periodTo;
  const asOfDate = now.toISOString().split('T')[0];

  switch (period) {
    case 'current_month':
      periodFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      periodTo = asOfDate;
      break;
    case 'quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      periodFrom = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString().split('T')[0];
      periodTo = asOfDate;
      break;
    case 'year':
      periodFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      periodTo = asOfDate;
      break;
    default:
      periodFrom = '2020-01-01';
      periodTo = asOfDate;
  }

  return { as_of_date: asOfDate, period_from: periodFrom, period_to: periodTo };
};

// Get period label for display
const getPeriodLabel = (period, language) => {
  const now = new Date();
  switch (period) {
    case 'current_month':
      return now.toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'en-US', { month: 'long', year: 'numeric' });
    case 'quarter':
      const q = Math.floor(now.getMonth() / 3) + 1;
      return language === 'uz' ? `${q}-chorak ${now.getFullYear()}` : `Q${q} ${now.getFullYear()}`;
    case 'year':
      return now.getFullYear().toString();
    default:
      return language === 'uz' ? 'Barcha vaqt' : 'All Time';
  }
};

// Collapsible P&L section component (Odoo-style)
// Helper to pick translated account name
const pickAccountName = (account, language) => {
  if (language === 'ru' && account.account_name_ru) return account.account_name_ru;
  if (language === 'en' && account.account_name_en) return account.account_name_en;
  if (language === 'uz' && account.account_name_uz) return account.account_name_uz;
  return account.account_name_uz || account.account_name;
};

function PnLSection({ title, items, total, formatCurrency, isCollapsible, language }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Section Header */}
      <tr
        className={`border-b border-slate-200 ${isCollapsible ? 'cursor-pointer hover:bg-slate-50' : ''}`}
        onClick={() => isCollapsible && setExpanded(!expanded)}
      >
        <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
          {isCollapsible && (
            expanded ?
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> :
              <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          {title}
        </td>
        <td className="py-3 px-4 text-right font-semibold text-slate-800 tabular-nums">
          {formatCurrency(total)}
        </td>
      </tr>
      {/* Expanded Items */}
      {expanded && items.map((item, idx) => (
        <tr key={item.account_id || idx} className="border-b border-slate-100 bg-slate-50/50">
          <td className="py-2 px-4 pl-12 text-slate-600">
            {item.account_code} {pickAccountName(item, language)}
          </td>
          <td className="py-2 px-4 text-right font-mono text-slate-600 tabular-nums">
            {formatCurrency(item.amount)}
          </td>
        </tr>
      ))}
    </>
  );
}

// Balance Sheet section component (Odoo-style)
function BalanceSheetSection({ title, sections, total, formatCurrency, colorClass, language }) {
  const [expanded, setExpanded] = useState(true);
  const accounts = sections?.flatMap(s => s.accounts || []) || [];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Section Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer ${colorClass}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 font-bold">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {title}
        </div>
        <span className="font-bold tabular-nums">{formatCurrency(total)}</span>
      </div>
      {/* Account List */}
      {expanded && accounts.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {accounts.map((acc, idx) => (
              <tr key={acc.account_id || idx} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 px-4 pl-10 text-slate-700">
                  <span className="font-mono text-xs text-slate-400 mr-2">{acc.account_code}</span>
                  {pickAccountName(acc, language)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-700 tabular-nums w-48">
                  {formatCurrency(acc.balance)}
                </td>
              </tr>
            ))}
            {/* Section Total */}
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td className="py-2.5 px-4 pl-10 font-semibold text-slate-800">
                {language === 'uz' ? 'Jami' : 'Total'} {title}
              </td>
              <td className="py-2.5 px-4 text-right font-bold text-slate-800 tabular-nums w-48">
                {formatCurrency(total)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {expanded && accounts.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          {language === 'uz' ? 'Ma\'lumot yo\'q' : 'No accounts'}
        </div>
      )}
    </div>
  );
}

export default function FinancialReports({ defaultTab = 'trial-balance' }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const reportRef = useRef(null);

  const [period, setPeriod] = useState('current_month');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Report data states
  const [trialBalance, setTrialBalance] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [exchangeDiffs, setExchangeDiffs] = useState(null);
  const [currencyDebt, setCurrencyDebt] = useState(null);

  // Pagination states
  const pageSize = 20;
  const [currentPageTrial, setCurrentPageTrial] = useState(1);
  const [currentPageExchange, setCurrentPageExchange] = useState(1);
  const [currentPageCurrency, setCurrentPageCurrency] = useState(1);

  // Fetch all reports when period changes
  useEffect(() => {
    fetchReports();
    // Reset pagination when period changes
    setCurrentPageTrial(1);
    setCurrentPageExchange(1);
    setCurrentPageCurrency(1);
  }, [period]);

  const fetchReports = async () => {
    setIsLoading(true);
    const params = getDateParams(period);

    try {
      const [tb, pnl, bs, cf, ed, cd] = await Promise.all([
        financeService.getTrialBalance(params).catch(() => null),
        financeService.getIncomeStatement(params).catch(() => null),
        financeService.getBalanceSheet(params).catch(() => null),
        financeService.getCashFlow(params).catch(() => null),
        financeService.listExchangeDiffs({ date_from: params.period_from, date_to: params.period_to }).catch(() => null),
        financeService.getCurrencyDebtReport().catch(() => null),
      ]);

      setTrialBalance(tb);
      setIncomeStatement(pnl);
      setBalanceSheet(bs);
      setCashFlow(cf);
      setExchangeDiffs(ed);
      setCurrencyDebt(cd);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const periodLabel = getPeriodLabel(period, language);
      const printContent = generatePrintContent(periodLabel);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const generatePrintContent = (periodLabel) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${language === 'uz' ? 'Moliyaviy Hisobot' : 'Financial Report'} - ${periodLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
          h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
          h2 { color: #334155; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 600; }
          .amount { text-align: right; font-family: monospace; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          .total-row { background: #f1f5f9; font-weight: bold; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>${language === 'uz' ? 'Moliyaviy Hisobotlar' : 'Financial Reports'}</h1>
        <p>${periodLabel}</p>

        ${trialBalance ? `
        <h2>${language === 'uz' ? 'Sinov Balansi' : 'Trial Balance'}</h2>
        <table>
          <tr><th>Account</th><th class="amount">Debit</th><th class="amount">Credit</th></tr>
          ${trialBalance.accounts?.map(a => `
            <tr>
              <td>${a.account_code} - ${pickAccountName(a, language)}</td>
              <td class="amount">${formatCurrency(a.debit_balance)}</td>
              <td class="amount">${formatCurrency(a.credit_balance)}</td>
            </tr>
          `).join('') || ''}
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td class="amount"><strong>${formatCurrency(trialBalance.total_debit)}</strong></td>
            <td class="amount"><strong>${formatCurrency(trialBalance.total_credit)}</strong></td>
          </tr>
        </table>
        ` : ''}

        ${incomeStatement ? `
        <h2>${language === 'uz' ? 'Foyda va Zarar' : 'Profit and Loss'}</h2>
        <table>
          <tr><th></th><th class="amount">${getPeriodLabel(period, language)}</th></tr>
          ${incomeStatement.revenue?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Daromad' : 'Revenue'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.total_revenue)}</strong></td></tr>
            ${incomeStatement.revenue.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          ${incomeStatement.cost_of_sales?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Sotish tannarxi' : 'Less Costs of Revenue'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.cost_of_sales.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.cost_of_sales.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          <tr style="background:#e2e8f0;font-weight:bold"><td><strong>${language === 'uz' ? 'Yalpi foyda' : 'Gross Profit'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.gross_profit)}</strong></td></tr>
          ${incomeStatement.operating_expenses?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Operatsion xarajatlar' : 'Less Operating Expenses'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.operating_expenses.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.operating_expenses.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          <tr style="background:#e2e8f0;font-weight:bold"><td><strong>${language === 'uz' ? 'Operatsion foyda' : 'Operating Income (or Loss)'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.operating_profit)}</strong></td></tr>
          ${incomeStatement.other_income?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Boshqa daromadlar' : 'Plus Other Income'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.other_income.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.other_income.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          ${incomeStatement.other_expenses?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Boshqa xarajatlar' : 'Less Other Expenses'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.other_expenses.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.other_expenses.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          <tr style="background:#e2e8f0;font-weight:bold"><td><strong>${language === 'uz' ? 'Soliqdan oldingi foyda' : 'Pre-tax Profit'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.pre_tax_profit || 0)}</strong></td></tr>
          <tr><td style="padding-left:30px">${language === 'uz' ? "Daromad solig'i (15%)" : 'Income Tax (15%)'}</td><td class="amount negative">-${formatCurrency(incomeStatement.income_tax || 0)}</td></tr>
          <tr style="background:#cbd5e1;font-weight:bold;font-size:1.1em"><td><strong>${language === 'uz' ? 'Sof foyda' : 'Net Profit'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.net_income)}</strong></td></tr>
        </table>
        ` : ''}

        ${balanceSheet ? `
        <h2>${language === 'uz' ? 'Buxgalteriya Balansi' : 'Balance Sheet'}</h2>
        <p style="color:#64748b;font-size:12px">${language === 'uz' ? 'Sana' : 'As of'}: ${balanceSheet.as_of_date}</p>
        <table>
          <tr><th></th><th class="amount">${language === 'uz' ? 'Balans' : 'Balance'}</th></tr>
          <tr class="total-row"><td><strong>${language === 'uz' ? 'Aktivlar' : 'Assets'}</strong></td><td class="amount"><strong>${formatCurrency(balanceSheet.total_assets)}</strong></td></tr>
          ${balanceSheet.assets?.flatMap(s => s.accounts || []).map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.balance)}</td></tr>`).join('') || ''}
          <tr class="total-row"><td><strong>${language === 'uz' ? 'Majburiyatlar' : 'Liabilities'}</strong></td><td class="amount"><strong>${formatCurrency(balanceSheet.total_liabilities)}</strong></td></tr>
          ${balanceSheet.liabilities?.flatMap(s => s.accounts || []).map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.balance)}</td></tr>`).join('') || ''}
          <tr class="total-row"><td><strong>${language === 'uz' ? 'Kapital' : 'Equity'}</strong></td><td class="amount"><strong>${formatCurrency(balanceSheet.total_equity)}</strong></td></tr>
          ${balanceSheet.equity?.flatMap(s => s.accounts || []).map(a => `<tr><td style="padding-left:30px">${a.account_code} ${pickAccountName(a, language)}</td><td class="amount">${formatCurrency(a.balance)}</td></tr>`).join('') || ''}
          <tr style="background:#cbd5e1;font-weight:bold;font-size:1.1em"><td><strong>${language === 'uz' ? 'Majburiyatlar + Kapital' : 'Liabilities + Equity'}</strong></td><td class="amount"><strong>${formatCurrency((balanceSheet.total_liabilities || 0) + (balanceSheet.total_equity || 0))}</strong></td></tr>
        </table>
        ` : ''}

        ${cashFlow ? `
        <h2>${language === 'uz' ? 'Pul Oqimi' : 'Cash Flow Statement'}</h2>
        <p style="color:#64748b;font-size:12px">${cashFlow.period_from} - ${cashFlow.period_to}</p>
        <table>
          <tr><th></th><th class="amount">${language === 'uz' ? 'Summa' : 'Amount'}</th></tr>
          <tr><td>${language === 'uz' ? 'Boshlang\'ich qoldiq' : 'Opening Cash Balance'}</td><td class="amount">${formatCurrency(cashFlow.opening_cash_balance)}</td></tr>

          <tr class="total-row"><td><strong>${language === 'uz' ? 'Operatsion faoliyat' : 'Operating Activities'}</strong></td><td class="amount"><strong>${formatCurrency(cashFlow.operating_activities?.total || 0)}</strong></td></tr>
          ${cashFlow.operating_activities?.items?.map(item => `<tr><td style="padding-left:30px">${item.description || item.account_name || ''}</td><td class="amount ${item.amount >= 0 ? 'positive' : 'negative'}">${formatCurrency(item.amount)}</td></tr>`).join('') || ''}

          <tr class="total-row"><td><strong>${language === 'uz' ? 'Investitsion faoliyat' : 'Investing Activities'}</strong></td><td class="amount"><strong>${formatCurrency(cashFlow.investing_activities?.total || 0)}</strong></td></tr>
          ${cashFlow.investing_activities?.items?.map(item => `<tr><td style="padding-left:30px">${item.description || item.account_name || ''}</td><td class="amount ${item.amount >= 0 ? 'positive' : 'negative'}">${formatCurrency(item.amount)}</td></tr>`).join('') || ''}

          <tr class="total-row"><td><strong>${language === 'uz' ? 'Moliyaviy faoliyat' : 'Financing Activities'}</strong></td><td class="amount"><strong>${formatCurrency(cashFlow.financing_activities?.total || 0)}</strong></td></tr>
          ${cashFlow.financing_activities?.items?.map(item => `<tr><td style="padding-left:30px">${item.description || item.account_name || ''}</td><td class="amount ${item.amount >= 0 ? 'positive' : 'negative'}">${formatCurrency(item.amount)}</td></tr>`).join('') || ''}

          <tr style="background:#e2e8f0;font-weight:bold"><td><strong>${language === 'uz' ? 'Sof pul o\'zgarishi' : 'Net Cash Change'}</strong></td><td class="amount"><strong>${formatCurrency(cashFlow.net_cash_change || 0)}</strong></td></tr>
          <tr style="background:#cbd5e1;font-weight:bold;font-size:1.1em"><td><strong>${language === 'uz' ? 'Yakuniy qoldiq' : 'Closing Cash Balance'}</strong></td><td class="amount"><strong>${formatCurrency(cashFlow.closing_cash_balance)}</strong></td></tr>
        </table>
        ` : ''}

        <div class="footer">
          ${language === 'uz' ? 'Hisobot sanasi' : 'Generated'}: ${new Date().toLocaleString()} | Genix ERP
        </div>
      </body>
      </html>
    `;
  };

  // Category color helper
  const getCategoryColor = (category) => {
    const colors = {
      asset: 'bg-blue-100 text-blue-800',
      contra_asset: 'bg-blue-50 text-blue-600',
      liability: 'bg-red-100 text-red-800',
      equity: 'bg-purple-100 text-purple-800',
      revenue: 'bg-green-100 text-green-800',
      contra_revenue: 'bg-green-50 text-green-600',
      expense: 'bg-orange-100 text-orange-800',
      contra_expense: 'bg-orange-50 text-orange-600',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Translate category name
  const getCategoryLabel = (category) => {
    const labels = {
      uz: { asset: 'Aktiv', contra_asset: 'Kontra aktiv', liability: 'Majburiyat', equity: 'Kapital', revenue: 'Daromad', contra_revenue: 'Kontra daromad', expense: 'Xarajat', contra_expense: 'Kontra xarajat' },
      ru: { asset: 'Актив', contra_asset: 'Контра актив', liability: 'Обязательство', equity: 'Капитал', revenue: 'Доход', contra_revenue: 'Контра доход', expense: 'Расход', contra_expense: 'Контра расход' },
      en: { asset: 'Asset', contra_asset: 'Contra Asset', liability: 'Liability', equity: 'Equity', revenue: 'Revenue', contra_revenue: 'Contra Revenue', expense: 'Expense', contra_expense: 'Contra Expense' },
    };
    return labels[language]?.[category] || category;
  };

  // Get translated account name based on language (uses top-level pickAccountName helper)
  const getAccountName = (account) => pickAccountName(account, language);

  return (
    <div className="space-y-6" ref={reportRef}>

      {/* Header */}
      <Card className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <CardTitle className="text-2xl">
                  {language === 'uz' ? 'Moliyaviy Hisobotlar' : 'Financial Reports'}
                </CardTitle>
                <p className="text-sm text-white/80 mt-1">
                  {language === 'uz' ? 'Sinov balansi, Foyda va zarar, Balans, Pul oqimi' : 'Trial Balance, P&L, Balance Sheet, Cash Flow'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[180px] bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">{language === 'uz' ? 'Joriy oy' : 'Current Month'}</SelectItem>
                  <SelectItem value="quarter">{language === 'uz' ? 'Joriy chorak' : 'This Quarter'}</SelectItem>
                  <SelectItem value="year">{language === 'uz' ? 'Joriy yil' : 'This Year'}</SelectItem>
                  <SelectItem value="all">{language === 'uz' ? 'Barcha vaqt' : 'All Time'}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {t('export_pdf') || 'Export PDF'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Period Info */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Badge variant="outline">{getPeriodLabel(period, language)}</Badge>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 bg-white/80">
          <TabsTrigger value="trial-balance">
            {language === 'uz' ? 'Sinov Balansi' : 'Trial Balance'}
          </TabsTrigger>
          <TabsTrigger value="diagnostics">
            {language === 'uz' ? 'Diagnostika' : language === 'ru' ? 'Диагностика' : 'Diagnostics'}
          </TabsTrigger>
          <TabsTrigger value="profit-loss">
            {language === 'uz' ? 'Foyda va Zarar' : 'Profit & Loss'}
          </TabsTrigger>
          <TabsTrigger value="balance-sheet">
            {language === 'uz' ? 'Balans' : 'Balance Sheet'}
          </TabsTrigger>
          <TabsTrigger value="cash-flow">
            {language === 'uz' ? 'Pul Oqimi' : 'Cash Flow'}
          </TabsTrigger>
          <TabsTrigger value="exchange-diffs">
            {language === 'uz' ? 'Kurs Farqlari' : 'Exchange Diff'}
          </TabsTrigger>
          <TabsTrigger value="currency-debt">
            {language === 'uz' ? 'Valyuta Qarzi' : 'Currency Debt'}
          </TabsTrigger>
        </TabsList>

        {/* Diagnostics tab (genix_diagnostika §2.4) — anomaly scan over the ОСВ */}
        <TabsContent value="diagnostics">
          <DiagnosticsPanel />
        </TabsContent>

        {/* Trial Balance Tab */}
        <TabsContent value="trial-balance">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{language === 'uz' ? 'Sinov Balansi Hisoboti' : 'Trial Balance Report'}</CardTitle>
                {trialBalance && (
                  <Badge className={trialBalance.is_balanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {trialBalance.is_balanced ? (
                      <><CheckCircle2 className="w-4 h-4 mr-1" /> {language === 'uz' ? 'Balans' : 'Balanced'}</>
                    ) : (
                      <><AlertTriangle className="w-4 h-4 mr-1" /> {language === 'uz' ? 'Farq bor' : 'Out of Balance'}</>
                    )}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : trialBalance?.accounts?.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">{language === 'uz' ? 'Kod' : 'Code'}</TableHead>
                        <TableHead>{language === 'uz' ? 'Hisob nomi' : 'Account Name'}</TableHead>
                        <TableHead className="w-28">{language === 'uz' ? 'Turi' : 'Category'}</TableHead>
                        <TableHead className="text-right w-36">{language === 'uz' ? 'Debet' : 'Debit'}</TableHead>
                        <TableHead className="text-right w-36">{language === 'uz' ? 'Kredit' : 'Credit'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.accounts.slice((currentPageTrial - 1) * pageSize, currentPageTrial * pageSize).map((account, idx) => (
                        <TableRow key={account.account_id || idx}>
                          <TableCell className="font-mono text-sm">{account.account_code}</TableCell>
                          <TableCell>{getAccountName(account)}</TableCell>
                          <TableCell>
                            <Badge className={getCategoryColor(account.category)} variant="secondary">
                              {getCategoryLabel(account.category)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.debit_balance > 0 ? formatCurrency(account.debit_balance) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.credit_balance > 0 ? formatCurrency(account.credit_balance) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-slate-100 font-bold">
                        <TableCell colSpan={3} className="text-right">
                          {language === 'uz' ? 'Jami' : 'Total'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-lg">
                          {formatCurrency(trialBalance.total_debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-lg">
                          {formatCurrency(trialBalance.total_credit)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  {(() => {
                    const totalCount = trialBalance.accounts.length;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    return totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-slate-500">
                          {(currentPageTrial - 1) * pageSize + 1}-{Math.min(currentPageTrial * pageSize, totalCount)} / {totalCount}
                        </p>
                        <div className="flex items-center gap-2">
                          <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageTrial === 1} onClick={() => setCurrentPageTrial(1)}>1</button>
                          <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageTrial === 1} onClick={() => setCurrentPageTrial(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                          <span className="text-sm font-medium px-2">{currentPageTrial} / {totalPages}</span>
                          <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageTrial >= totalPages} onClick={() => setCurrentPageTrial(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                          <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageTrial >= totalPages} onClick={() => setCurrentPageTrial(totalPages)}>{totalPages}</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? 'Ma\'lumot topilmadi' : 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit & Loss Tab */}
        <TabsContent value="profit-loss">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {language === 'uz' ? 'Foyda va Zarar Hisoboti' : 'Profit and Loss'}
                </CardTitle>
                <Badge variant="outline">{getPeriodLabel(period, language)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : incomeStatement ? (
                <div className="space-y-0">
                  {/* P&L Table - Odoo style */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-300">
                        <th className="text-left py-3 px-4 font-semibold text-slate-700"></th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-700 w-48">
                          {getPeriodLabel(period, language)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Revenue Section */}
                      {incomeStatement.revenue?.length > 0 && (
                        <PnLSection
                          title={language === 'uz' ? 'Daromad' : 'Revenue'}
                          items={incomeStatement.revenue}
                          total={incomeStatement.total_revenue}
                          formatCurrency={formatCurrency}
                          isCollapsible
                          language={language}
                        />
                      )}

                      {/* Less Costs of Revenue (COGS) */}
                      {incomeStatement.cost_of_sales?.length > 0 && (
                        <PnLSection
                          title={language === 'uz' ? 'Sotish tannarxi' : 'Less Costs of Revenue'}
                          items={incomeStatement.cost_of_sales}
                          total={incomeStatement.cost_of_sales.reduce((s, a) => s + a.amount, 0)}
                          formatCurrency={formatCurrency}
                          isCollapsible
                          language={language}
                        />
                      )}

                      {/* Gross Profit */}
                      <tr className="bg-slate-100 border-y border-slate-300">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {language === 'uz' ? 'Yalpi foyda' : 'Gross Profit'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                          {formatCurrency(incomeStatement.gross_profit)}
                        </td>
                      </tr>

                      {/* Less Operating Expenses */}
                      {incomeStatement.operating_expenses?.length > 0 && (
                        <PnLSection
                          title={language === 'uz' ? 'Operatsion xarajatlar' : 'Less Operating Expenses'}
                          items={incomeStatement.operating_expenses}
                          total={incomeStatement.operating_expenses.reduce((s, a) => s + a.amount, 0)}
                          formatCurrency={formatCurrency}
                          isCollapsible
                          language={language}
                        />
                      )}

                      {/* Operating Income */}
                      <tr className="bg-slate-100 border-y border-slate-300">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {language === 'uz' ? 'Operatsion foyda (zarar)' : 'Operating Income (or Loss)'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                          {formatCurrency(incomeStatement.operating_profit)}
                        </td>
                      </tr>

                      {/* Plus Other Income */}
                      {incomeStatement.other_income?.length > 0 && (
                        <PnLSection
                          title={language === 'uz' ? 'Boshqa daromadlar' : 'Plus Other Income'}
                          items={incomeStatement.other_income}
                          total={incomeStatement.other_income.reduce((s, a) => s + a.amount, 0)}
                          formatCurrency={formatCurrency}
                          isCollapsible
                          language={language}
                        />
                      )}

                      {/* Less Other Expenses */}
                      {incomeStatement.other_expenses?.length > 0 && (
                        <PnLSection
                          title={language === 'uz' ? 'Boshqa xarajatlar' : 'Less Other Expenses'}
                          items={incomeStatement.other_expenses}
                          total={incomeStatement.other_expenses.reduce((s, a) => s + a.amount, 0)}
                          formatCurrency={formatCurrency}
                          isCollapsible
                          language={language}
                        />
                      )}

                      {/* Pre-tax Profit */}
                      <tr className="bg-slate-100 border-y border-slate-300">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {language === 'uz' ? 'Soliqdan oldingi foyda' : 'Pre-tax Profit'}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold tabular-nums ${(incomeStatement.pre_tax_profit || 0) >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                          {formatCurrency(incomeStatement.pre_tax_profit || 0)}
                        </td>
                      </tr>

                      {/* Income Tax */}
                      <tr className="border-b border-slate-200">
                        <td className="py-3 px-4 text-slate-700">
                          {language === 'uz' ? 'Daromad solig\'i (15%)' : 'Income Tax (15%)'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-red-600 tabular-nums">
                          {(incomeStatement.income_tax || 0) > 0 ? '-' : ''}{formatCurrency(incomeStatement.income_tax || 0)}
                        </td>
                      </tr>

                      {/* Net Profit */}
                      <tr className="bg-slate-200 border-y-2 border-slate-400">
                        <td className="py-4 px-4 font-bold text-lg text-slate-900">
                          {language === 'uz' ? 'Sof foyda' : 'Net Profit'}
                        </td>
                        <td className={`py-4 px-4 text-right font-bold text-lg tabular-nums ${incomeStatement.net_income >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(incomeStatement.net_income)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? 'Ma\'lumot topilmadi' : 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet Tab */}
        <TabsContent value="balance-sheet">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  {language === 'uz' ? 'Buxgalteriya Balansi' : 'Balance Sheet'}
                </CardTitle>
                <Badge variant="outline">
                  {language === 'uz' ? 'Sana' : 'As of'}: {balanceSheet?.as_of_date || getDateParams(period).as_of_date}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : balanceSheet ? (
                <div className="space-y-6">
                  {/* Assets Section */}
                  <BalanceSheetSection
                    title={language === 'uz' ? 'Aktivlar' : 'Assets'}
                    sections={balanceSheet.assets}
                    total={balanceSheet.total_assets}
                    formatCurrency={formatCurrency}
                    colorClass="text-blue-700 bg-blue-50 border-blue-200"
                    language={language}
                  />

                  {/* Liabilities Section */}
                  <BalanceSheetSection
                    title={language === 'uz' ? 'Majburiyatlar' : 'Liabilities'}
                    sections={balanceSheet.liabilities}
                    total={balanceSheet.total_liabilities}
                    formatCurrency={formatCurrency}
                    colorClass="text-red-700 bg-red-50 border-red-200"
                    language={language}
                  />

                  {/* Equity Section */}
                  <BalanceSheetSection
                    title={language === 'uz' ? 'Kapital' : 'Equity'}
                    sections={balanceSheet.equity}
                    total={balanceSheet.total_equity}
                    formatCurrency={formatCurrency}
                    colorClass="text-purple-700 bg-purple-50 border-purple-200"
                    language={language}
                  />

                  {/* Liabilities + Equity Total */}
                  <div className="border-t-2 border-slate-400 pt-4">
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-200 rounded-lg">
                      <span className="font-bold text-lg text-slate-900">
                        {language === 'uz' ? 'Majburiyatlar + Kapital' : 'Liabilities + Equity'}
                      </span>
                      <span className="font-bold text-lg text-slate-900 tabular-nums">
                        {formatCurrency((balanceSheet.total_liabilities || 0) + (balanceSheet.total_equity || 0))}
                      </span>
                    </div>
                    {/* Balance check */}
                    {Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity)) > 0.01 ? (
                      <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4" />
                        {language === 'uz'
                          ? `Balans tengligi buzilgan: Farq ${formatCurrency(Math.abs(balanceSheet.total_assets - balanceSheet.total_liabilities - balanceSheet.total_equity))}`
                          : `Balance equation doesn't hold: Difference ${formatCurrency(Math.abs(balanceSheet.total_assets - balanceSheet.total_liabilities - balanceSheet.total_equity))}`
                        }
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        <CheckCircle2 className="w-4 h-4" />
                        {language === 'uz' ? 'Balans tengligi to\'g\'ri: Aktivlar = Majburiyatlar + Kapital' : 'Balance equation holds: Assets = Liabilities + Equity'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? 'Ma\'lumot topilmadi' : 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cash-flow">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {language === 'uz' ? 'Pul Oqimi Hisoboti' : 'Cash Flow Statement'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : cashFlow ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 uppercase">
                        {language === 'uz' ? 'Boshlang\'ich balans' : 'Opening Balance'}
                      </p>
                      <p className="text-xl font-bold text-blue-700">{formatCurrency(cashFlow.opening_cash_balance)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600 uppercase">
                        {language === 'uz' ? 'Yakuniy balans' : 'Closing Balance'}
                      </p>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(cashFlow.closing_cash_balance)}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${(cashFlow.net_cash_change || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className={`text-xs uppercase ${(cashFlow.net_cash_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {language === 'uz' ? 'Sof o\'zgarish' : 'Net Change'}
                      </p>
                      <p className={`text-xl font-bold flex items-center gap-1 ${(cashFlow.net_cash_change || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {(cashFlow.net_cash_change || 0) >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                        {formatCurrency(Math.abs(cashFlow.net_cash_change || 0))}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 uppercase">
                        {language === 'uz' ? 'Davr' : 'Period'}
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        {cashFlow.period_from} - {cashFlow.period_to}
                      </p>
                    </div>
                  </div>

                  {/* Activities Sections */}
                  <div className="space-y-4">
                    {/* Operating Activities */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900">
                          {language === 'uz' ? 'Operatsion faoliyat' : 'Operating Activities'}
                        </h3>
                        <span className={`font-bold ${cashFlow.operating_activities?.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(cashFlow.operating_activities?.total || 0)}
                        </span>
                      </div>
                      {cashFlow.operating_activities?.items?.length > 0 ? (
                        <div className="space-y-2">
                          {cashFlow.operating_activities.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-slate-600">{item.description}</span>
                              <span className="font-mono">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                            <span>{language === 'uz' ? 'Operatsion faoliyatdan sof pul' : 'Net cash from operations'}</span>
                            <span className="font-mono">{formatCurrency(cashFlow.operating_activities?.total || 0)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">{language === 'uz' ? 'Ma\'lumot yo\'q' : 'No items'}</p>
                      )}
                    </div>

                    {/* Investing Activities */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900">
                          {language === 'uz' ? 'Investitsiya faoliyati' : 'Investing Activities'}
                        </h3>
                        <span className={`font-bold ${cashFlow.investing_activities?.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(cashFlow.investing_activities?.total || 0)}
                        </span>
                      </div>
                      {cashFlow.investing_activities?.items?.length > 0 ? (
                        <div className="space-y-2">
                          {cashFlow.investing_activities.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-slate-600">{item.description}</span>
                              <span className="font-mono">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                            <span>{language === 'uz' ? 'Investitsiya faoliyatidan sof pul' : 'Net cash from investing'}</span>
                            <span className="font-mono">{formatCurrency(cashFlow.investing_activities?.total || 0)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">{language === 'uz' ? 'Ma\'lumot yo\'q' : 'No items'}</p>
                      )}
                    </div>

                    {/* Financing Activities */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900">
                          {language === 'uz' ? 'Moliyaviy faoliyat' : 'Financing Activities'}
                        </h3>
                        <span className={`font-bold ${cashFlow.financing_activities?.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(cashFlow.financing_activities?.total || 0)}
                        </span>
                      </div>
                      {cashFlow.financing_activities?.items?.length > 0 ? (
                        <div className="space-y-2">
                          {cashFlow.financing_activities.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-slate-600">{item.description}</span>
                              <span className="font-mono">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                            <span>{language === 'uz' ? 'Moliyaviy faoliyatdan sof pul' : 'Net cash from financing'}</span>
                            <span className="font-mono">{formatCurrency(cashFlow.financing_activities?.total || 0)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">{language === 'uz' ? 'Ma\'lumot yo\'q' : 'No items'}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? 'Ma\'lumot topilmadi' : 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exchange Differences Tab */}
        <TabsContent value="exchange-diffs">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{language === 'uz' ? 'Kurs Farqlari Hisoboti' : 'Exchange Differences Report'}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : exchangeDiffs?.items?.length > 0 ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600 mb-1">{language === 'uz' ? 'Kurs foydasi' : 'Exchange Gain'}</p>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(exchangeDiffs.total_gain || 0)}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600 mb-1">{language === 'uz' ? 'Kurs zarari' : 'Exchange Loss'}</p>
                      <p className="text-xl font-bold text-red-700">{formatCurrency(exchangeDiffs.total_loss || 0)}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${(exchangeDiffs.net || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                      <p className="text-sm text-slate-600 mb-1">{language === 'uz' ? 'Sof farq' : 'Net Difference'}</p>
                      <p className={`text-xl font-bold ${(exchangeDiffs.net || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        {(exchangeDiffs.net || 0) >= 0 ? '+' : ''}{formatCurrency(exchangeDiffs.net || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Details Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'uz' ? 'Sana' : 'Date'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Hujjat №' : 'Document #'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Kontragent' : 'Counterparty'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Valyuta' : 'Currency'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'Miqdor' : 'Amount'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? "Boshlang'ich kurs" : 'Initial Rate'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'Yakuniy kurs' : 'Final Rate'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? "Farq (so'mda)" : 'Diff (UZS)'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exchangeDiffs.items.slice((currentPageExchange - 1) * pageSize, currentPageExchange * pageSize).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell className="font-mono text-sm">{item.document_number || '—'}</TableCell>
                            <TableCell className="text-sm">{item.counterparty || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.currency_code}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.foreign_amount ? Number(item.foreign_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.initial_rate ? Number(item.initial_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.final_rate ? Number(item.final_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${item.type === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                              {item.type === 'positive' ? '+' : '-'}{formatCurrency(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {(() => {
                      const totalCount = exchangeDiffs.items.length;
                      const totalPages = Math.ceil(totalCount / pageSize);
                      return totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <p className="text-sm text-slate-500">
                            {(currentPageExchange - 1) * pageSize + 1}-{Math.min(currentPageExchange * pageSize, totalCount)} / {totalCount}
                          </p>
                          <div className="flex items-center gap-2">
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageExchange === 1} onClick={() => setCurrentPageExchange(1)}>1</button>
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageExchange === 1} onClick={() => setCurrentPageExchange(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                            <span className="text-sm font-medium px-2">{currentPageExchange} / {totalPages}</span>
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageExchange >= totalPages} onClick={() => setCurrentPageExchange(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageExchange >= totalPages} onClick={() => setCurrentPageExchange(totalPages)}>{totalPages}</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? 'Kurs farqlari topilmadi' : 'No exchange differences found'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Currency Debt Tab */}
        <TabsContent value="currency-debt">
          <Card>
            <CardContent className="p-6">
              {currencyDebt && (currencyDebt.items || []).length > 0 ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardContent className="p-4">
                        <p className="text-sm text-blue-600 font-medium">
                          {language === 'uz' ? 'HF kursidagi qiymat' : 'Invoice Rate Value'}
                        </p>
                        <p className="text-xl font-bold text-blue-800">
                          {formatCurrency(currencyDebt.total_invoice_uzs)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardContent className="p-4">
                        <p className="text-sm text-purple-600 font-medium">
                          {language === 'uz' ? 'Joriy kursdagi qiymat' : 'Current Rate Value'}
                        </p>
                        <p className="text-xl font-bold text-purple-800">
                          {formatCurrency(currencyDebt.total_current_uzs)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className={`bg-gradient-to-br ${currencyDebt.total_diff >= 0 ? 'from-red-50 to-red-100 border-red-200' : 'from-green-50 to-green-100 border-green-200'}`}>
                      <CardContent className="p-4">
                        <p className={`text-sm font-medium ${currencyDebt.total_diff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {language === 'uz' ? 'Kurs farqi' : 'Rate Difference'}
                        </p>
                        <p className={`text-xl font-bold ${currencyDebt.total_diff >= 0 ? 'text-red-800' : 'text-green-800'}`}>
                          {currencyDebt.total_diff >= 0 ? '+' : ''}{formatCurrency(currencyDebt.total_diff)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Detail Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{language === 'uz' ? 'Hujjat' : 'Document'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Turi' : 'Type'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Hamkor' : 'Partner'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Valyuta' : 'Currency'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'Qoldiq' : 'Due'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'HF kursi' : 'Inv. Rate'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'Joriy kurs' : 'Curr. Rate'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'HF UZS' : 'Inv. UZS'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'Joriy UZS' : 'Curr. UZS'}</TableHead>
                          <TableHead className="text-right">{language === 'uz' ? 'Farq' : 'Diff'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currencyDebt.items.slice((currentPageCurrency - 1) * pageSize, currentPageCurrency * pageSize).map((item, idx) => (
                          <TableRow key={item.id || idx} className="hover:bg-slate-50">
                            <TableCell className="font-medium">{item.invoice_number}</TableCell>
                            <TableCell>
                              <Badge variant={item.type === 'sales' ? 'default' : 'secondary'}>
                                {item.type === 'sales'
                                  ? (language === 'uz' ? 'Sotish' : 'Sales')
                                  : (language === 'uz' ? 'Xarid' : 'Purchase')
                                }
                              </Badge>
                            </TableCell>
                            <TableCell>{item.partner_name}</TableCell>
                            <TableCell><Badge variant="outline">{item.currency_code}</Badge></TableCell>
                            <TableCell className="text-right font-mono">
                              {new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(item.amount_due)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {new Intl.NumberFormat('uz-UZ').format(item.invoice_rate)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {new Intl.NumberFormat('uz-UZ').format(item.current_rate)}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.invoice_uzs)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.current_uzs)}</TableCell>
                            <TableCell className={`text-right font-medium ${item.diff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {item.diff >= 0 ? '+' : ''}{formatCurrency(item.diff)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {(() => {
                      const totalCount = currencyDebt.items.length;
                      const totalPages = Math.ceil(totalCount / pageSize);
                      return totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <p className="text-sm text-slate-500">
                            {(currentPageCurrency - 1) * pageSize + 1}-{Math.min(currentPageCurrency * pageSize, totalCount)} / {totalCount}
                          </p>
                          <div className="flex items-center gap-2">
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageCurrency === 1} onClick={() => setCurrentPageCurrency(1)}>1</button>
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageCurrency === 1} onClick={() => setCurrentPageCurrency(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                            <span className="text-sm font-medium px-2">{currentPageCurrency} / {totalPages}</span>
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageCurrency >= totalPages} onClick={() => setCurrentPageCurrency(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                            <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageCurrency >= totalPages} onClick={() => setCurrentPageCurrency(totalPages)}>{totalPages}</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? "Valyutadagi to'lanmagan hisob-fakturalar topilmadi" : 'No unpaid foreign currency invoices found'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
