import { formatDate } from '@/utils/formatDate';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Calculator,
  CheckCircle,
  Clock,
  Plus,
  MoreVertical,
  Eye,
  Trash2,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertCircle,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { taxReportsService } from '@/api/services/taxReports';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
// Profit tax (§8.1) and Tax summary (§10) used to be top-level tabs
// in Financials. They've been folded into Tax Reports as sub-tabs so
// every tax view lives in one place — TaxReports renders them inside
// the existing Overview / Periods / Transactions / Employee taxes
// strip, lazy-mounted only when the corresponding tab is opened.
import ProfitTax from '@/pages/ProfitTax';
import TaxSummary from '@/pages/TaxSummary';
import TaxSettings from '@/components/finance/TaxSettings';
import { getApiErrorMessage } from '@/utils/apiError';

export default function TaxReports() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const [, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  // Employee-taxes aggregation (migration 330) — loaded lazily when the tab is active
  const [employeeTaxReport, setEmployeeTaxReport] = useState({ rows: [], total_employee: 0, total_employer: 0, total: 0 });
  const [employeeTaxLoading, setEmployeeTaxLoading] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // Date filters — default to all time so all transactions are visible
  const now = new Date();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodTypeFilter, setPeriodTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(now.getFullYear().toString());

  // Modals
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);

  // Employee-tax payment dialog (migration 360 / Record Payment button on
  // each row of the Employee Taxes tab). Shape:
  //   { open, taxCode, taxName, pending, amount, paymentMethod, note, saving }
  const [taxPaymentDialog, setTaxPaymentDialog] = useState({ open: false });
  const submitTaxPayment = async () => {
    const tp = taxPaymentDialog;
    if (!tp || !tp.taxCode) return;
    const amt = Number(tp.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t('invalid_amount') || "Noto'g'ri summa");
      return;
    }
    if (!startDate || !endDate) {
      toast.error(t('select_period_first') || 'Davrini tanlang');
      return;
    }
    setTaxPaymentDialog((p) => ({ ...p, saving: true }));
    try {
      await taxReportsService.recordEmployeeTaxPayment({
        taxCode: tp.taxCode,
        periodStart: startDate,
        periodEnd: endDate,
        amount: amt,
        paymentMethod: tp.paymentMethod || 'bank_transfer',
        note: tp.note || undefined,
      });
      toast.success(t('payment_recorded') || "To'lov qayd qilindi");
      setTaxPaymentDialog({ open: false });
      // Refetch the employee-tax report so the Pending column updates.
      try {
        const data = await taxReportsService.getEmployeeTaxReport(startDate, endDate);
        setEmployeeTaxReport(data || { rows: [], total_employee: 0, total_employer: 0, total: 0 });
      } catch { /* ignore */ }
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message
        || (t('error_occurred') || 'Xatolik'));
      setTaxPaymentDialog((p) => ({ ...p, saving: false }));
    }
  };
  const [showPeriodDetails, setShowPeriodDetails] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payPeriodId, setPayPeriodId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [isPaying, setIsPaying] = useState(false);

  // Form data
  const [newPeriod, setNewPeriod] = useState({
    name: '',
    period_type: 'monthly',
    start_date: format(startOfMonth(now), 'yyyy-MM-dd'),
    end_date: format(endOfMonth(now), 'yyyy-MM-dd'),
    notes: '',
  });

  const [fileData, setFileData] = useState({
    filing_reference: '',
    notes: '',
  });

  // Load data on mount only
  useEffect(() => {
    loadSummary();
    loadPeriods();
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [periodTypeFilter, statusFilter, yearFilter]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions();
    }
    if (activeTab === 'employee-taxes') {
      loadEmployeeTaxReport();
    }
  }, [activeTab, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEmployeeTaxReport = async () => {
    setEmployeeTaxLoading(true);
    try {
      const data = await taxReportsService.getEmployeeTaxReport(startDate, endDate);
      setEmployeeTaxReport(data || { rows: [], total_employee: 0, total_employer: 0, total: 0 });
    } catch (e) {
      console.warn('Failed to load employee tax report', e);
    } finally {
      setEmployeeTaxLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      setIsLoading(true);
      const data = await taxReportsService.getSummary(startDate, endDate);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load tax summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPeriods = async () => {
    try {
      const params = {};
      if (periodTypeFilter !== 'all') params.period_type = periodTypeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (yearFilter) params.year = yearFilter;
      const data = await taxReportsService.listPeriods(params);
      setPeriods(data || []);
    } catch (error) {
      console.error('Failed to load tax periods:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await taxReportsService.getTransactions(startDate, endDate);
      setTransactions(data || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePeriod = async () => {
    try {
      setIsLoading(true);
      await taxReportsService.createPeriod(newPeriod);
      setShowCreatePeriod(false);
      setNewPeriod({
        name: '',
        period_type: 'monthly',
        start_date: format(startOfMonth(now), 'yyyy-MM-dd'),
        end_date: format(endOfMonth(now), 'yyyy-MM-dd'),
        notes: '',
      });
      loadPeriods();
    } catch (error) {
      console.error('Failed to create period:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateReport = async (periodId) => {
    try {
      setIsLoading(true);
      await taxReportsService.calculateReport(periodId);
      loadPeriods();
      if (selectedPeriod?.id === periodId) {
        const data = await taxReportsService.getPeriod(periodId);
        setSelectedPeriod(data);
      }
    } catch (error) {
      console.error('Failed to calculate report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileReport = async () => {
    if (!selectedPeriod) return;
    try {
      setIsLoading(true);
      await taxReportsService.fileReport(selectedPeriod.period.id, fileData);
      setShowFileDialog(false);
      setShowPeriodDetails(false);
      setFileData({ filing_reference: '', notes: '' });
      loadPeriods();
    } catch (error) {
      console.error('Failed to file report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePeriod = async (periodId) => {
    if (!confirm(t('confirm_delete') || 'Are you sure you want to delete this report?')) return;
    try {
      await taxReportsService.deletePeriod(periodId);
      loadPeriods();
    } catch (error) {
      console.error('Failed to delete period:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  const openPayDialog = (periodId = null) => {
    const id = periodId || periods.find(p => p.net_tax_liability > 0 && p.status !== 'draft' && !p.paid_at)?.id;
    if (!id) return;
    setPayPeriodId(id);
    setPaymentMethod('bank');
    setShowPayDialog(true);
  };

  const handlePayTax = async () => {
    if (!payPeriodId) return;
    try {
      setIsPaying(true);
      await taxReportsService.payPeriod(payPeriodId, { payment_method: paymentMethod });
      setShowPayDialog(false);
      setPayPeriodId(null);
      loadSummary();
      loadPeriods();
    } catch (error) {
      console.error('Failed to pay tax:', error);
    } finally {
      setIsPaying(false);
    }
  };

  const handleViewPeriod = async (period) => {
    try {
      setIsLoading(true);
      const data = await taxReportsService.getPeriod(period.id);
      setSelectedPeriod(data);
      setShowPeriodDetails(true);
    } catch (error) {
      console.error('Failed to load period details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick date range setters
  const setQuickRange = (type) => {
    const today = new Date();
    let start, end;

    switch (type) {
      case 'this_month':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'last_month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'this_quarter':
        start = startOfQuarter(today);
        end = endOfQuarter(today);
        break;
      case 'this_year':
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      default:
        return;
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  // Update period dates based on type
  const updatePeriodDates = (type) => {
    const today = new Date();
    let start, end, name;

    switch (type) {
      case 'monthly':
        start = startOfMonth(today);
        end = endOfMonth(today);
        name = format(today, 'MMMM yyyy') + ' Tax Report';
        break;
      case 'quarterly':
        start = startOfQuarter(today);
        end = endOfQuarter(today);
        const quarter = Math.ceil((today.getMonth() + 1) / 3);
        name = `Q${quarter} ${today.getFullYear()} Tax Report`;
        break;
      case 'yearly':
        start = startOfYear(today);
        end = endOfYear(today);
        name = `${today.getFullYear()} Annual Tax Report`;
        break;
      default:
        return;
    }

    setNewPeriod(prev => ({
      ...prev,
      period_type: type,
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
      name,
    }));
  };

  const getStatusBadge = (status, deadline) => {
    // Check if overdue: not filed and past deadline
    if (deadline && status !== 'filed' && new Date(deadline) < new Date()) {
      return <Badge className="bg-red-100 text-red-700">{t('overdue') || 'Overdue'}</Badge>;
    }
    const styles = {
      draft: 'bg-yellow-100 text-yellow-700',
      calculated: 'bg-blue-100 text-blue-700',
      submitted: 'bg-purple-100 text-purple-700',
      filed: 'bg-green-100 text-green-700',
    };
    return <Badge className={styles[status] || styles.draft}>{t(status) || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('output_vat') || 'Output VAT (Sales)'}</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrencyCompact(summary?.sales?.total_tax || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary?.sales?.transaction_count || 0} {t('transactions') || 'transactions'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('input_vat') || 'Input VAT (Purchases)'}</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrencyCompact(summary?.purchases?.total_tax || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary?.purchases?.transaction_count || 0} {t('transactions') || 'transactions'}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('net_tax_liability') || 'Net Tax Liability'}</p>
                <p className={`text-2xl font-bold ${(summary?.net_tax_liability || 0) >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                  {formatCurrencyCompact(Math.abs(summary?.net_tax_liability || 0))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(summary?.net_tax_liability || 0) >= 0 ? (t('to_pay') || 'To Pay') : (t('refundable') || 'Refundable')}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>
            {(summary?.net_tax_liability || 0) > 0 && (
              <Button
                size="sm"
                className="w-full mt-3 bg-orange-600 hover:bg-orange-700"
                onClick={() => openPayDialog()}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {t('record_payment') || "To'lovni qayd etish"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('reports') || 'Reports'}</p>
                <p className="text-2xl font-bold">
                  {summary?.reports?.filed_count || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary?.reports?.pending_count || 0} {t('pending') || 'pending'}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="overview">{t('overview') || 'Overview'}</TabsTrigger>
            <TabsTrigger value="periods">{t('report_periods') || 'Report Periods'}</TabsTrigger>
            <TabsTrigger value="transactions">{t('transactions') || 'Transactions'}</TabsTrigger>
            <TabsTrigger value="employee-taxes">{t('employee_taxes') || 'Xodim soliqlari'}</TabsTrigger>
            <TabsTrigger value="profit-tax">{t('profit_tax') || "Foyda solig'i"}</TabsTrigger>
            <TabsTrigger value="tax-summary">{t('tax_summary') || 'Umumiy soliq jamlanmasi'}</TabsTrigger>
            <TabsTrigger value="settings">{t('tax_settings') || 'Sozlamalar'}</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickRange('this_month')}>
              {t('this_month') || 'This Month'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange('this_quarter')}>
              {t('this_quarter') || 'This Quarter'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { loadSummary(); loadPeriods(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Date Range Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('period_filter') || 'Period Filter'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('start_date') || 'Start Date'}</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t('end_date') || 'End Date'}</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={loadSummary} className="w-full">
                  <Calculator className="w-4 h-4 mr-2" />
                  {t('calculate') || 'Calculate'}
                </Button>
              </CardContent>
            </Card>

            {/* Tax Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('tax_breakdown') || 'Tax Breakdown'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>{t('total_sales') || 'Total Sales'}</span>
                    <span className="font-medium">{formatCurrency(summary?.sales?.total_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>{t('sales_tax_collected') || 'Sales Tax Collected'}</span>
                    <span className="font-medium text-green-600">+ {formatCurrency(summary?.sales?.total_tax || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>{t('total_purchases') || 'Total Purchases'}</span>
                    <span className="font-medium">{formatCurrency(summary?.purchases?.total_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>{t('purchase_tax_paid') || 'Purchase Tax Paid'}</span>
                    <span className="font-medium text-red-600">- {formatCurrency(summary?.purchases?.total_tax || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-slate-50 px-2 rounded">
                    <span className="font-semibold">{t('net_tax_liability') || 'Net Tax Liability'}</span>
                    <span className={`font-bold ${(summary?.net_tax_liability || 0) >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                      {formatCurrency(summary?.net_tax_liability || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Report Periods Tab */}
        <TabsContent value="periods">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{t('tax_report_periods') || 'Tax Report Periods'}</CardTitle>
                {canCreate(MODULES.FINANCIALS) && (
                  <Button onClick={() => setShowCreatePeriod(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('new_period') || 'New Period'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <Select value={periodTypeFilter} onValueChange={setPeriodTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('period_type') || 'Period Type'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                    <SelectItem value="monthly">{t('monthly') || 'Monthly'}</SelectItem>
                    <SelectItem value="quarterly">{t('quarterly') || 'Quarterly'}</SelectItem>
                    <SelectItem value="yearly">{t('yearly') || 'Yearly'}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('status') || 'Status'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                    <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                    <SelectItem value="calculated">{t('calculated') || 'Calculated'}</SelectItem>
                    <SelectItem value="filed">{t('filed') || 'Filed'}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={language === 'ru' ? 'Год' : language === 'uz' ? 'Yil' : 'Year'} />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map(i => {
                      const year = now.getFullYear() - i;
                      return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={loadPeriods}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {/* Periods Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('name') || 'Name'}</TableHead>
                    <TableHead>{t('period') || 'Period'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead className="text-right">{t('sales_tax') || 'Sales Tax'}</TableHead>
                    <TableHead className="text-right">{t('purchase_tax') || 'Purchase Tax'}</TableHead>
                    <TableHead className="text-right">{t('net_liability') || 'Net Liability'}</TableHead>
                    <TableHead>{t('deadline') || 'Deadline'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        {t('no_periods') || 'No tax report periods found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    periods.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell className="font-medium">{period.name}</TableCell>
                        <TableCell>
                          {formatDate(period.start_date)} - {formatDate(period.end_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t(period.period_type) || period.period_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(period.total_sales_tax)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(period.total_purchase_tax)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${period.net_tax_liability >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                          {formatCurrency(period.net_tax_liability)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {period.deadline ? format(new Date(period.deadline), 'dd.MM.yyyy') : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(period.status, period.deadline)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewPeriod(period)}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('view_details') || 'View Details'}
                              </DropdownMenuItem>
                              {canUpdate(MODULES.FINANCIALS) && period.status !== 'filed' && (
                                <DropdownMenuItem onClick={() => handleCalculateReport(period.id)}>
                                  <Calculator className="w-4 h-4 mr-2" />
                                  {t('calculate') || 'Calculate'}
                                </DropdownMenuItem>
                              )}
                              {canUpdate(MODULES.FINANCIALS) && period.status !== 'draft' && !period.paid_at && period.net_tax_liability > 0 && (
                                <DropdownMenuItem onClick={() => openPayDialog(period.id)}>
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  {t('record_payment') || "To'lovni qayd etish"}
                                </DropdownMenuItem>
                              )}
                              {canDelete(MODULES.FINANCIALS) && period.status !== 'filed' && (
                                <DropdownMenuItem
                                  onClick={() => handleDeletePeriod(period.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {t('delete') || 'Delete'}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{t('tax_transactions') || 'Tax Transactions'}</CardTitle>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead>{t('number') || 'Number'}</TableHead>
                    <TableHead>{t('party') || 'Party'}</TableHead>
                    <TableHead>{t('tax_rate') || 'Tax Rate'}</TableHead>
                    <TableHead className="text-right">{t('taxable_amount') || 'Taxable Amount'}</TableHead>
                    <TableHead className="text-right">{t('tax_amount') || 'Tax Amount'}</TableHead>
                    <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {t('no_transactions') || 'No transactions found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                        <TableCell>
                          <Badge variant={tx.transaction_type === 'sales_invoice' ? 'default' : 'secondary'}>
                            {tx.transaction_type === 'sales_invoice' ? (t('sale') || 'Sale') : (t('purchase') || 'Purchase')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{tx.transaction_number}</TableCell>
                        <TableCell>{tx.party_name}</TableCell>
                        <TableCell>
                          {tx.tax_name} ({tx.tax_rate}%)
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(tx.taxable_amount)}</TableCell>
                        <TableCell className={`text-right ${tx.transaction_type === 'sales_invoice' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.transaction_type === 'sales_invoice' ? '+' : '-'}{formatCurrency(tx.tax_amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(tx.total_amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Taxes (migration 330) — per-tax breakdown across payroll entries */}
        <TabsContent value="employee-taxes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {t('employee_taxes') || 'Xodim soliqlari'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{t('employee_tax_total') || 'Xodimdan ushlab qolingan'}</div>
                  <div className="text-lg font-semibold text-red-600">{formatCurrency(employeeTaxReport.total_employee || 0)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{t('employer_tax_total') || 'Ish beruvchi xarajati'}</div>
                  <div className="text-lg font-semibold text-amber-700">{formatCurrency(employeeTaxReport.total_employer || 0)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{t('paid_amount') || "To'langan"}</div>
                  <div className="text-lg font-semibold text-emerald-600">{formatCurrency(employeeTaxReport.total_paid || 0)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-orange-50/40">
                  <div className="text-xs text-muted-foreground">{t('pending_amount') || "To'lanishi kerak"}</div>
                  <div className="text-lg font-semibold text-orange-600">{formatCurrency(employeeTaxReport.total_pending || 0)}</div>
                </div>
              </div>

              {employeeTaxLoading ? (
                <div className="py-8 text-center text-muted-foreground">{t('loading') || 'Yuklanmoqda…'}</div>
              ) : (employeeTaxReport.rows?.length || 0) === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t('no_employee_tax_data') || "Tanlangan davr uchun ma'lumot topilmadi"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('code') || 'Kod'}</TableHead>
                      <TableHead>{t('name') || 'Nomi'}</TableHead>
                      <TableHead>{t('payer') || "To'lovchi"}</TableHead>
                      <TableHead className="text-right">{t('entries') || 'Yozuvlar'}</TableHead>
                      <TableHead className="text-right">{t('tax_amount') || 'Hisoblangan'}</TableHead>
                      <TableHead className="text-right">{t('paid_amount') || "To'langan"}</TableHead>
                      <TableHead className="text-right">{t('pending_amount') || 'Qoldiq'}</TableHead>
                      <TableHead className="text-right">{t('actions') || 'Amal'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(employeeTaxReport.rows || []).map((row) => {
                      const accrued = Number(row.total_amount) || 0;
                      const paid    = Number(row.paid_amount)  || 0;
                      const pending = Number(row.pending)      || 0;
                      const fullyPaid = pending <= 0 && accrued > 0;
                      return (
                      <TableRow key={`${row.tax_code}-${row.payer}`}>
                        <TableCell className="font-mono text-xs">{row.tax_code}</TableCell>
                        <TableCell>{row.tax_name}</TableCell>
                        <TableCell>
                          {row.payer === 'employer'
                            ? <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{t('payer_employer') || 'Employer'}</Badge>
                            : <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{t('payer_employee') || 'Employee'}</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.entry_count}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${row.payer === 'employer' ? 'text-amber-700' : 'text-red-600'}`}>
                          {formatCurrency(accrued)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {formatCurrency(paid)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${
                          fullyPaid ? 'text-emerald-600' : pending > 0 ? 'text-orange-600' : 'text-slate-500'
                        }`}>
                          {fullyPaid ? '—' : formatCurrency(pending)}
                          {fullyPaid && (
                            <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200">
                              {t('paid') || "To'langan"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {pending > 0 && (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 bg-orange-500 hover:bg-orange-600"
                                onClick={() => setTaxPaymentDialog({
                                  open: true,
                                  taxCode: row.tax_code,
                                  taxName: row.tax_name,
                                  pending: pending,
                                  amount: String(pending),
                                  paymentMethod: 'bank_transfer',
                                  note: '',
                                  saving: false,
                                })}
                                title={t('record_tax_payment') || "To'lovni qayd qilish"}
                              >
                                {t('record_payment') || 'Record Payment'}
                              </Button>
                            )}
                            {/* Per-tax XML export for regulator filings
                                (NDFL→DSK quarterly, ESP→DSDMB monthly,
                                INPS→PFO'Z monthly — §10 of the TZ). */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await taxReportsService.exportEmployeeTaxXML({
                                    taxCode: row.tax_code,
                                    startDate,
                                    endDate,
                                  });
                                } catch (e) {
                                  console.error('XML export failed', e);
                                }
                              }}
                              disabled={!startDate || !endDate}
                              title={t('download_xml') || 'XML yuklab olish'}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit tax — moved here from a top-level Financials tab.
            ProfitTax is a self-contained page component that loads its
            own data; rendering it inside a TabsContent keeps lazy
            mounting (Radix Tabs only mounts the active tab content). */}
        <TabsContent value="profit-tax">
          <ProfitTax />
        </TabsContent>

        {/* Tax summary — same migration. The TaxSummary page
            aggregates VAT + INPS + ESP + NDFL + profit + dividend
            into one panel per §10 of TZ_Ish_Haqi_Soliq_Tolik. */}
        <TabsContent value="tax-summary">
          <TaxSummary />
        </TabsContent>

        {/* Tax constructor (genix_soliq_spec §2): enable/disable each tax with
            mandatory/regime/optional rules + the 1-billion regime monitor. */}
        <TabsContent value="settings">
          {activeTab === 'settings' && <TaxSettings />}
        </TabsContent>
      </Tabs>

      {/* Create Period Dialog */}
      <Dialog open={showCreatePeriod} onOpenChange={setShowCreatePeriod}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create_tax_period') || 'Create Tax Report Period'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('period_type') || 'Period Type'}</Label>
              <Select
                value={newPeriod.period_type}
                onValueChange={(v) => updatePeriodDates(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('monthly') || 'Monthly'}</SelectItem>
                  <SelectItem value="quarterly">{t('quarterly') || 'Quarterly'}</SelectItem>
                  <SelectItem value="yearly">{t('yearly') || 'Yearly'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('name') || 'Name'}</Label>
              <Input
                value={newPeriod.name}
                onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                placeholder={t('report_name') || 'Report name'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('start_date') || 'Start Date'}</Label>
                <Input
                  type="date"
                  value={newPeriod.start_date}
                  onChange={(e) => setNewPeriod({ ...newPeriod, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('end_date') || 'End Date'}</Label>
                <Input
                  type="date"
                  value={newPeriod.end_date}
                  onChange={(e) => setNewPeriod({ ...newPeriod, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t('notes') || 'Notes'}</Label>
              <Textarea
                value={newPeriod.notes}
                onChange={(e) => setNewPeriod({ ...newPeriod, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePeriod(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleCreatePeriod} disabled={!newPeriod.name || isLoading}>
              {t('create') || 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Period Details Dialog */}
      <Dialog open={showPeriodDetails} onOpenChange={setShowPeriodDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedPeriod?.period?.name}</DialogTitle>
          </DialogHeader>
          {selectedPeriod && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{t('sales_tax') || 'Sales Tax'}</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(selectedPeriod.period.total_sales_tax)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{t('purchase_tax') || 'Purchase Tax'}</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(selectedPeriod.period.total_purchase_tax)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{t('net_liability') || 'Net Liability'}</p>
                    <p className={`text-xl font-bold ${selectedPeriod.period.net_tax_liability >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                      {formatCurrency(selectedPeriod.period.net_tax_liability)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Lines breakdown */}
              {selectedPeriod.lines && selectedPeriod.lines.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">{t('breakdown_by_tax') || 'Breakdown by Tax Rate'}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('tax_rate') || 'Tax Rate'}</TableHead>
                        <TableHead>{t('type') || 'Type'}</TableHead>
                        <TableHead className="text-right">{t('taxable_amount') || 'Taxable'}</TableHead>
                        <TableHead className="text-right">{t('tax_amount') || 'Tax'}</TableHead>
                        <TableHead className="text-right">{t('count') || 'Count'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPeriod.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.tax_name} ({line.tax_rate}%)</TableCell>
                          <TableCell>
                            <Badge variant={line.transaction_type === 'sales' ? 'default' : 'secondary'}>
                              {t(line.transaction_type) || line.transaction_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(line.taxable_amount)}</TableCell>
                          <TableCell className={`text-right ${line.transaction_type === 'sales' ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(line.tax_amount)}
                          </TableCell>
                          <TableCell className="text-right">{line.transaction_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Status and actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('status') || 'Status'}:</span>
                  {getStatusBadge(selectedPeriod.period.status, selectedPeriod.period.deadline)}
                </div>
                <div className="flex gap-2">
                  {canUpdate(MODULES.FINANCIALS) && selectedPeriod.period.status !== 'filed' && (
                    <>
                      <Button variant="outline" onClick={() => handleCalculateReport(selectedPeriod.period.id)}>
                        <Calculator className="w-4 h-4 mr-2" />
                        {t('recalculate') || 'Recalculate'}
                      </Button>
                      {selectedPeriod.period.status === 'calculated' && (
                        <Button onClick={() => setShowFileDialog(true)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {t('file_report') || 'File Report'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File Report Dialog */}
      <Dialog open={showFileDialog} onOpenChange={setShowFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('file_tax_report') || 'File Tax Report'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">{t('filing_warning') || 'Warning'}</p>
                <p className="text-sm text-yellow-700">
                  {t('filing_warning_text') || 'Once filed, this report cannot be modified or deleted.'}
                </p>
              </div>
            </div>
            <div>
              <Label>{t('filing_reference') || 'Filing Reference'}</Label>
              <Input
                value={fileData.filing_reference}
                onChange={(e) => setFileData({ ...fileData, filing_reference: e.target.value })}
                placeholder={t('filing_reference_placeholder') || 'e.g., Tax office reference number'}
              />
            </div>
            <div>
              <Label>{t('notes') || 'Notes'}</Label>
              <Textarea
                value={fileData.notes}
                onChange={(e) => setFileData({ ...fileData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFileDialog(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleFileReport} disabled={isLoading}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('confirm_file') || 'Confirm & File'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Tax Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('record_tax_payment') || "Soliq to'lovini qayd etish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-600">{t('net_tax_liability') || 'Sof soliq majburiyati'}</p>
              <p className="text-2xl font-bold text-orange-700">{formatCurrency(summary?.net_tax_liability || 0)}</p>
            </div>
            <div>
              <Label>{t('payment_method') || "To'lov usuli"}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{t('bank_account') || 'Bank hisobi'}</SelectItem>
                  <SelectItem value="cash">{t('cash') || 'Naqd pul (Kassa)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('tax_payment_note') || "To'lov qayd etilganda avtomatik buxgalteriya provodkasi yaratiladi: Dt QQS majburiyat / Kt Bank"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handlePayTax}
              disabled={isPaying}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {isPaying ? (t('processing') || 'Jarayonda...') : (t('confirm_payment') || "To'lovni tasdiqlash")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee-tax payment dialog (migration 360). The selected
          tax + period range is captured when the user clicks the
          "Record Payment" button on the Employee Taxes tab; this
          modal lets them adjust the amount (defaults to the full
          pending balance), pick a payment method, and add a note.
          On submit POSTs /employee-taxes/payments which posts a
          Dr-liability / Cr-cash journal entry and refreshes the
          report so the Pending column drops by that amount. */}
      <Dialog open={!!taxPaymentDialog.open} onOpenChange={(o) => !o && setTaxPaymentDialog({ open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(t('record_tax_payment') || "Soliq to'lovini qayd qilish")}
              {taxPaymentDialog.taxName ? `: ${taxPaymentDialog.taxName}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('period') || 'Davr'}:</span>
                <span className="font-mono">{startDate} — {endDate}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">{t('pending_amount') || 'Qoldiq'}:</span>
                <span className="font-mono font-semibold text-orange-600">
                  {formatCurrency(taxPaymentDialog.pending || 0)}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('payment_amount') || "To'lov summasi"} *</Label>
              <NumberInput
                value={taxPaymentDialog.amount ?? ''}
                onChange={(raw) => setTaxPaymentDialog((p) => ({ ...p, amount: raw }))}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">{t('payment_method') || "To'lov usuli"}</Label>
              <Select
                value={taxPaymentDialog.paymentMethod || 'bank_transfer'}
                onValueChange={(v) => setTaxPaymentDialog((p) => ({ ...p, paymentMethod: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t('bank_transfer') || 'Bank o\'tkazmasi'}</SelectItem>
                  <SelectItem value="cash">{t('cash') || 'Naqd pul'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('note') || 'Izoh'}</Label>
              <Textarea
                rows={2}
                value={taxPaymentDialog.note || ''}
                onChange={(e) => setTaxPaymentDialog((p) => ({ ...p, note: e.target.value }))}
                placeholder={t('payment_note_placeholder') || "To'lov haqida izoh"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaxPaymentDialog({ open: false })}
                    disabled={taxPaymentDialog.saving}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button onClick={submitTaxPayment} disabled={taxPaymentDialog.saving}
                    className="bg-orange-500 hover:bg-orange-600">
              <CreditCard className="w-4 h-4 mr-2" />
              {taxPaymentDialog.saving
                ? (t('processing') || 'Jarayonda...')
                : (t('confirm_payment') || "To'lovni tasdiqlash")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
