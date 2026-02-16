import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FileText, Download, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, Users, Building2, DollarSign,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Scale
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import financeService from '@/api/services/finance';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

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
function PnLSection({ title, items, total, formatCurrency, isCollapsible }) {
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
            {item.account_code} {item.account_name}
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
                  {acc.account_name}
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

export default function FinancialReports() {
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
  const [agingReceivables, setAgingReceivables] = useState(null);
  const [agingPayables, setAgingPayables] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);

  // Expanded rows for aging reports
  const [expandedCustomers, setExpandedCustomers] = useState({});
  const [expandedVendors, setExpandedVendors] = useState({});

  // Fetch all reports when period changes
  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    setIsLoading(true);
    const params = getDateParams(period);

    try {
      const [tb, pnl, bs, ar, ap, cf] = await Promise.all([
        financeService.getTrialBalance(params).catch(() => null),
        financeService.getIncomeStatement(params).catch(() => null),
        financeService.getBalanceSheet(params).catch(() => null),
        financeService.getAgingReceivables(params).catch(() => null),
        financeService.getAgingPayables(params).catch(() => null),
        financeService.getCashFlow(params).catch(() => null)
      ]);

      setTrialBalance(tb);
      setIncomeStatement(pnl);
      setBalanceSheet(bs);
      setAgingReceivables(ar);
      setAgingPayables(ap);
      setCashFlow(cf);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle expanded state for aging reports
  const toggleCustomer = (id) => {
    setExpandedCustomers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleVendor = (id) => {
    setExpandedVendors(prev => ({ ...prev, [id]: !prev[id] }));
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
              <td>${a.account_code} - ${a.account_name}</td>
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
            ${incomeStatement.revenue.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          ${incomeStatement.cost_of_sales?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Sotish tannarxi' : 'Less Costs of Revenue'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.cost_of_sales.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.cost_of_sales.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          <tr style="background:#e2e8f0;font-weight:bold"><td><strong>${language === 'uz' ? 'Yalpi foyda' : 'Gross Profit'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.gross_profit)}</strong></td></tr>
          ${incomeStatement.operating_expenses?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Operatsion xarajatlar' : 'Less Operating Expenses'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.operating_expenses.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.operating_expenses.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          <tr style="background:#e2e8f0;font-weight:bold"><td><strong>${language === 'uz' ? 'Operatsion foyda' : 'Operating Income (or Loss)'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.operating_profit)}</strong></td></tr>
          ${incomeStatement.other_income?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Boshqa daromadlar' : 'Plus Other Income'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.other_income.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.other_income.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          ${incomeStatement.other_expenses?.length > 0 ? `
            <tr class="total-row"><td><strong>${language === 'uz' ? 'Boshqa xarajatlar' : 'Less Other Expenses'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.other_expenses.reduce((s,a) => s + a.amount, 0))}</strong></td></tr>
            ${incomeStatement.other_expenses.map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.amount)}</td></tr>`).join('')}
          ` : ''}
          <tr style="background:#cbd5e1;font-weight:bold;font-size:1.1em"><td><strong>${language === 'uz' ? 'Sof foyda' : 'Net Profit'}</strong></td><td class="amount"><strong>${formatCurrency(incomeStatement.net_income)}</strong></td></tr>
        </table>
        ` : ''}

        ${balanceSheet ? `
        <h2>${language === 'uz' ? 'Buxgalteriya Balansi' : 'Balance Sheet'}</h2>
        <p style="color:#64748b;font-size:12px">${language === 'uz' ? 'Sana' : 'As of'}: ${balanceSheet.as_of_date}</p>
        <table>
          <tr><th></th><th class="amount">${language === 'uz' ? 'Balans' : 'Balance'}</th></tr>
          <tr class="total-row"><td><strong>${language === 'uz' ? 'Aktivlar' : 'Assets'}</strong></td><td class="amount"><strong>${formatCurrency(balanceSheet.total_assets)}</strong></td></tr>
          ${balanceSheet.assets?.flatMap(s => s.accounts || []).map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.balance)}</td></tr>`).join('') || ''}
          <tr class="total-row"><td><strong>${language === 'uz' ? 'Majburiyatlar' : 'Liabilities'}</strong></td><td class="amount"><strong>${formatCurrency(balanceSheet.total_liabilities)}</strong></td></tr>
          ${balanceSheet.liabilities?.flatMap(s => s.accounts || []).map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.balance)}</td></tr>`).join('') || ''}
          <tr class="total-row"><td><strong>${language === 'uz' ? 'Kapital' : 'Equity'}</strong></td><td class="amount"><strong>${formatCurrency(balanceSheet.total_equity)}</strong></td></tr>
          ${balanceSheet.equity?.flatMap(s => s.accounts || []).map(a => `<tr><td style="padding-left:30px">${a.account_code} ${a.account_name}</td><td class="amount">${formatCurrency(a.balance)}</td></tr>`).join('') || ''}
          <tr style="background:#cbd5e1;font-weight:bold;font-size:1.1em"><td><strong>${language === 'uz' ? 'Majburiyatlar + Kapital' : 'Liabilities + Equity'}</strong></td><td class="amount"><strong>${formatCurrency((balanceSheet.total_liabilities || 0) + (balanceSheet.total_equity || 0))}</strong></td></tr>
        </table>
        ` : ''}

        ${agingReceivables ? `
        <h2>${language === 'uz' ? 'Debitorlik qarzi eskirishi' : 'Aged Receivables'}</h2>
        <table>
          <tr><th>Customer</th><th class="amount">Current</th><th class="amount">1-30</th><th class="amount">31-60</th><th class="amount">61-90</th><th class="amount">90+</th><th class="amount">Total</th></tr>
          ${agingReceivables.contacts?.map(c => `
            <tr>
              <td>${c.contact_name}</td>
              <td class="amount">${formatCurrency(c.current)}</td>
              <td class="amount">${formatCurrency(c.days_1_to_30)}</td>
              <td class="amount">${formatCurrency(c.days_31_to_60)}</td>
              <td class="amount">${formatCurrency(c.days_61_to_90)}</td>
              <td class="amount">${formatCurrency(c.over_90_days)}</td>
              <td class="amount">${formatCurrency(c.total_amount)}</td>
            </tr>
          `).join('') || ''}
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td class="amount"><strong>${formatCurrency(agingReceivables.current_total)}</strong></td>
            <td class="amount"><strong>${formatCurrency(agingReceivables.days_1_to_30)}</strong></td>
            <td class="amount"><strong>${formatCurrency(agingReceivables.days_31_to_60)}</strong></td>
            <td class="amount"><strong>${formatCurrency(agingReceivables.days_61_to_90)}</strong></td>
            <td class="amount"><strong>${formatCurrency(agingReceivables.over_90_days)}</strong></td>
            <td class="amount"><strong>${formatCurrency(agingReceivables.total_amount)}</strong></td>
          </tr>
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
      liability: 'bg-red-100 text-red-800',
      equity: 'bg-purple-100 text-purple-800',
      revenue: 'bg-green-100 text-green-800',
      expense: 'bg-orange-100 text-orange-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

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
                  {language === 'uz' ? 'Sinov balansi, Foyda va zarar, Balans, Eskirish, Pul oqimi' : 'Trial Balance, P&L, Balance Sheet, Aging, Cash Flow'}
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
      <Tabs defaultValue="trial-balance" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 bg-white/80">
          <TabsTrigger value="trial-balance">
            {language === 'uz' ? 'Sinov Balansi' : 'Trial Balance'}
          </TabsTrigger>
          <TabsTrigger value="profit-loss">
            {language === 'uz' ? 'Foyda va Zarar' : 'Profit & Loss'}
          </TabsTrigger>
          <TabsTrigger value="balance-sheet">
            {language === 'uz' ? 'Balans' : 'Balance Sheet'}
          </TabsTrigger>
          <TabsTrigger value="aged-receivables">
            {language === 'uz' ? 'Debitorlik' : 'Aged AR'}
          </TabsTrigger>
          <TabsTrigger value="aged-payables">
            {language === 'uz' ? 'Kreditorlik' : 'Aged AP'}
          </TabsTrigger>
          <TabsTrigger value="cash-flow">
            {language === 'uz' ? 'Pul Oqimi' : 'Cash Flow'}
          </TabsTrigger>
        </TabsList>

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
                      {trialBalance.accounts.map((account, idx) => (
                        <TableRow key={account.account_id || idx}>
                          <TableCell className="font-mono text-sm">{account.account_code}</TableCell>
                          <TableCell>{account.account_name}</TableCell>
                          <TableCell>
                            <Badge className={getCategoryColor(account.category)} variant="secondary">
                              {account.category}
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
                        />
                      )}

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

        {/* Aged Receivables Tab */}
        <TabsContent value="aged-receivables">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {language === 'uz' ? 'Debitorlik Qarzi Eskirishi' : 'Aged Receivables Report'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary Cards */}
              {agingReceivables && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">{language === 'uz' ? 'Jami' : 'Total'}</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(agingReceivables.total_amount)}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 uppercase">{language === 'uz' ? 'Joriy' : 'Current'}</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(agingReceivables.current_total)}</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-600 uppercase">1-30 {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-yellow-700">{formatCurrency(agingReceivables.days_1_to_30)}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-600 uppercase">31-60 {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-orange-700">{formatCurrency(agingReceivables.days_31_to_60)}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600 uppercase">61-90 {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-red-700">{formatCurrency(agingReceivables.days_61_to_90)}</p>
                  </div>
                  <div className="p-4 bg-red-100 rounded-lg">
                    <p className="text-xs text-red-700 uppercase">90+ {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-red-800">{formatCurrency(agingReceivables.over_90_days)}</p>
                  </div>
                </div>
              )}

              {/* Customer Table */}
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : agingReceivables?.contacts?.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>{language === 'uz' ? 'Mijoz' : 'Customer'}</TableHead>
                        <TableHead className="text-right">{language === 'uz' ? 'Joriy' : 'Current'}</TableHead>
                        <TableHead className="text-right">1-30</TableHead>
                        <TableHead className="text-right">31-60</TableHead>
                        <TableHead className="text-right">61-90</TableHead>
                        <TableHead className="text-right">90+</TableHead>
                        <TableHead className="text-right">{language === 'uz' ? 'Jami' : 'Total'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agingReceivables.contacts.map((contact) => (
                        <React.Fragment key={contact.contact_id}>
                          <TableRow
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => toggleCustomer(contact.contact_id)}
                          >
                            <TableCell>
                              {expandedCustomers[contact.contact_id] ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{contact.contact_name}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {contact.current > 0 ? formatCurrency(contact.current) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-yellow-600">
                              {contact.days_1_to_30 > 0 ? formatCurrency(contact.days_1_to_30) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-orange-600">
                              {contact.days_31_to_60 > 0 ? formatCurrency(contact.days_31_to_60) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {contact.days_61_to_90 > 0 ? formatCurrency(contact.days_61_to_90) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-700">
                              {contact.over_90_days > 0 ? formatCurrency(contact.over_90_days) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {formatCurrency(contact.total_amount)}
                            </TableCell>
                          </TableRow>
                          {/* Expanded Invoice Details */}
                          {expandedCustomers[contact.contact_id] && contact.invoices?.map((inv) => (
                            <TableRow key={inv.invoice_id} className="bg-slate-50/50">
                              <TableCell></TableCell>
                              <TableCell className="text-sm text-slate-600 pl-8">
                                {inv.invoice_number} - Due: {inv.due_date}
                                {inv.days_overdue > 0 && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {inv.days_overdue} {language === 'uz' ? 'kun' : 'days'}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell colSpan={5}></TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(inv.amount_due)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? 'To\'lanmagan hisob-fakturalar yo\'q' : 'No outstanding invoices'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aged Payables Tab */}
        <TabsContent value="aged-payables">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {language === 'uz' ? 'Kreditorlik Qarzi Eskirishi' : 'Aged Payables Report'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary Cards */}
              {agingPayables && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">{language === 'uz' ? 'Jami' : 'Total'}</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(agingPayables.total_amount)}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 uppercase">{language === 'uz' ? 'Joriy' : 'Current'}</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(agingPayables.current_total)}</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-600 uppercase">1-30 {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-yellow-700">{formatCurrency(agingPayables.days_1_to_30)}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-600 uppercase">31-60 {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-orange-700">{formatCurrency(agingPayables.days_31_to_60)}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600 uppercase">61-90 {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-red-700">{formatCurrency(agingPayables.days_61_to_90)}</p>
                  </div>
                  <div className="p-4 bg-red-100 rounded-lg">
                    <p className="text-xs text-red-700 uppercase">90+ {language === 'uz' ? 'kun' : 'days'}</p>
                    <p className="text-xl font-bold text-red-800">{formatCurrency(agingPayables.over_90_days)}</p>
                  </div>
                </div>
              )}

              {/* Vendor Table */}
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : agingPayables?.contacts?.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>{language === 'uz' ? 'Yetkazib beruvchi' : 'Vendor'}</TableHead>
                        <TableHead className="text-right">{language === 'uz' ? 'Joriy' : 'Current'}</TableHead>
                        <TableHead className="text-right">1-30</TableHead>
                        <TableHead className="text-right">31-60</TableHead>
                        <TableHead className="text-right">61-90</TableHead>
                        <TableHead className="text-right">90+</TableHead>
                        <TableHead className="text-right">{language === 'uz' ? 'Jami' : 'Total'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agingPayables.contacts.map((contact) => (
                        <React.Fragment key={contact.contact_id}>
                          <TableRow
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => toggleVendor(contact.contact_id)}
                          >
                            <TableCell>
                              {expandedVendors[contact.contact_id] ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{contact.contact_name}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {contact.current > 0 ? formatCurrency(contact.current) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-yellow-600">
                              {contact.days_1_to_30 > 0 ? formatCurrency(contact.days_1_to_30) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-orange-600">
                              {contact.days_31_to_60 > 0 ? formatCurrency(contact.days_31_to_60) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {contact.days_61_to_90 > 0 ? formatCurrency(contact.days_61_to_90) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-700">
                              {contact.over_90_days > 0 ? formatCurrency(contact.over_90_days) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {formatCurrency(contact.total_amount)}
                            </TableCell>
                          </TableRow>
                          {/* Expanded Bill Details */}
                          {expandedVendors[contact.contact_id] && contact.invoices?.map((inv) => (
                            <TableRow key={inv.invoice_id} className="bg-slate-50/50">
                              <TableCell></TableCell>
                              <TableCell className="text-sm text-slate-600 pl-8">
                                {inv.invoice_number} - Due: {inv.due_date}
                                {inv.days_overdue > 0 && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {inv.days_overdue} {language === 'uz' ? 'kun' : 'days'}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell colSpan={5}></TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(inv.amount_due)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {language === 'uz' ? 'To\'lanmagan hisob-fakturalar yo\'q' : 'No outstanding bills'}
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
      </Tabs>
    </div>
  );
}
