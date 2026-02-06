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
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import financeService from '@/api/services/finance';

// Helper to format currency
const formatCurrency = (amount, decimals = 2) => {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
};

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

export default function FinancialReports() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const reportRef = useRef(null);

  const [period, setPeriod] = useState('current_month');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Report data states
  const [trialBalance, setTrialBalance] = useState(null);
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
      const [tb, ar, ap, cf] = await Promise.all([
        financeService.getTrialBalance(params).catch(() => null),
        financeService.getAgingReceivables(params).catch(() => null),
        financeService.getAgingPayables(params).catch(() => null),
        financeService.getCashFlow(params).catch(() => null)
      ]);

      setTrialBalance(tb);
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
                  {language === 'uz' ? 'Sinov balansi, Eskirish, Pul oqimi' : 'Trial Balance, Aging, Cash Flow'}
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-white/80">
          <TabsTrigger value="trial-balance">
            {language === 'uz' ? 'Sinov Balansi' : 'Trial Balance'}
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
