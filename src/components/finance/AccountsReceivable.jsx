import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, DollarSign, TrendingUp, Clock, AlertCircle, Pencil, Trash2,
  RotateCcw, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useSales } from '@/components/contexts/SalesContext';
import { useCustomers } from '@/components/contexts/CustomersContext';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useCompany } from '@/components/contexts/CompanyContext';
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAlertModal } from "@/hooks/useAlertModal";
import AlertModal from "@/components/shared/AlertModal";
import salesService from '@/api/services/sales';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

// One colour per bucket, in the order the server returns them. The fifth entry
// exists because the fifth bucket does: the browser version jumped from `<= 60`
// straight to '90+', so every 61-90 day debt was reported as 90+ and the bucket
// simply had no colour to be drawn in.
const AGING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];

const PAGE_SIZE = 20;

const getDateLocale = (lang) => {
  switch (lang) {
    case 'ru': return ru;
    case 'uz': return uz;
    default: return undefined;
  }
};

const emptyLine = () => ({ description: '', quantity: 1, unit_price: 0, discount_amount: 0 });

export default function AccountsReceivable() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const dateLocale = getDateLocale(language);
  const { activeCompany } = useCompany();
  const { taxRates = [] } = useFinancials();
  const { getSetting } = useAdminSettings();
  const {
    createInvoice, updateInvoice, deleteInvoice, recordPayment,
  } = useSales();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { modal, showAlert, showError, close } = useAlertModal();

  const { customers: crmCustomers, isLoading: loadingCustomers } = useCustomers();

  // ---------------------------------------------------------------- data ---
  // Rows and cards both come from the server, through the same filters.
  //
  // Before this, SalesContext fetched page_size=1000 once and every card, every
  // aging bucket and all three filters ran over that array in the browser. Past
  // the thousandth invoice the screen was quietly wrong, with nothing to show
  // it; mobile paginates at 10 and so could not copy the approach at all, which
  // is why the two apps never agreed on the same tenant.
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [creditNoteTarget, setCreditNoteTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const customers = useMemo(() => crmCustomers
    .filter(c => c.id && !String(c.id).startsWith('cust_'))
    .map(c => ({
      id: c.id,
      name: c.company_name || c.name || c.email || 'Unknown',
      company_name: c.company_name || c.name || '',
      email: c.email || '',
    })), [crmCustomers]);

  // The configured sales tax, resolved exactly the way Invoices.jsx resolves it
  // so the two forms cannot quote different VAT on the same tenant.
  const defaultSalesTaxId = getSetting('sales.tax.default_tax_id', '');
  const salesTaxRates = useMemo(
    () => taxRates.filter(tr => tr.tax_type === 'sales' || !tr.tax_type),
    [taxRates]);
  const defaultSalesTax = useMemo(() => (defaultSalesTaxId
    ? taxRates.find(tr => String(tr.id) === String(defaultSalesTaxId))
    : salesTaxRates.find(tr => tr.is_active !== false)) || null,
  [taxRates, salesTaxRates, defaultSalesTaxId]);

  const [form, setForm] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    tax_id: '',
    lines: [emptyLine()],
  });

  // The one place filters become query parameters, so the cards and the rows
  // are always answers about the same set.
  const buildParams = useCallback(() => {
    const params = {};
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (paymentStatusFilter !== 'all') params.payment_status = paymentStatusFilter;
    // "Muddati o'tgan" is a predicate over due_date and the residual, not a
    // document status. The old code rewrote status to 'overdue' in the browser
    // and then filtered on it, which destroyed the real status (a sent invoice
    // could no longer be found under "Sent") and disagreed with the server's
    // CURRENT_DATE whenever the two clocks differed.
    if (statusFilter === 'overdue') params.overdue = 'true';
    else if (statusFilter !== 'all') params.status = statusFilter;
    return params;
  }, [searchQuery, statusFilter, paymentStatusFilter]);

  const hasActiveFilter = searchQuery.trim() !== ''
    || statusFilter !== 'all' || paymentStatusFilter !== 'all';

  const fetchInvoices = useCallback(async () => {
    setListLoading(true);
    const params = buildParams();
    try {
      const [list, sum] = await Promise.all([
        salesService.listInvoicesPaged({ ...params, page: currentPage, page_size: PAGE_SIZE }),
        // Same filters, deliberately no page/page_size: a summary that
        // paginated would answer a different question than it appears to.
        salesService.getInvoicesSummary(params).catch(() => null),
      ]);
      setInvoices(list.data);
      setTotalInvoices(list.meta?.total ?? list.data.length);
      setTotalPages(list.meta?.total_pages || Math.max(1, Math.ceil((list.meta?.total ?? list.data.length) / PAGE_SIZE)));
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load receivables:', err);
      setInvoices([]);
      setSummary(null);
    } finally {
      setListLoading(false);
    }
  }, [buildParams, currentPage]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, paymentStatusFilter]);

  // -------------------------------------------------------------- metrics ---
  // Five figures and five buckets, all from /sales-invoices/summary.
  //
  // avg_days_to_pay is null when no fully-paid invoice has a confirmed payment
  // allocation. That is "unknown", not zero — the browser version derived it
  // from updated_at, so an invoice edited months after settlement reported
  // months to pay, and an empty set reported 0, which reads as "paid same day".
  const metrics = {
    totalReceivable: summary?.total_receivable ?? 0,
    overdueAmount: summary?.overdue_amount ?? 0,
    overdueInvoices: summary?.overdue_invoices ?? 0,
    avgDaysToPay: summary?.avg_days_to_pay,
  };

  const agingData = useMemo(() => {
    const a = summary?.aging;
    if (!a) return [];
    return [
      // `not_due`, not `current`: the uz table translates "current" as "Faol"
      // (active), which is a different word about a different thing. The aging
      // screens already use not_due for this bucket.
      { name: t('not_due'), value: a.current || 0 },
      { name: t('days_1_30'), value: a.days_1_30 || 0 },
      { name: t('days_31_60'), value: a.days_31_60 || 0 },
      { name: t('days_61_90'), value: a.days_61_90 || 0 },
      { name: t('days_90_plus'), value: a.days_90_plus || 0 },
    ].filter(d => d.value > 0);
  }, [summary, t]);

  // ---------------------------------------------------------------- rows ---
  const customerNameOf = (invoice) =>
    invoice.customer_name
    || customers.find(c => c.id === invoice.customer_id)?.name
    || '-';

  // payment_status arrives from the same SQL expression the payment_status=
  // filter uses, so the badge and the chip cannot disagree about a row.
  const paymentStatusOf = (invoice) => {
    if (invoice.payment_status) return invoice.payment_status;
    const paid = invoice.amount_paid || 0;
    const total = invoice.total_amount || 0;
    if (total <= 0) return 'unpaid';
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
  };

  const paymentStatusBadge = (invoice) => {
    const status = paymentStatusOf(invoice);
    return {
      style: {
        paid: 'bg-green-100 text-green-800 border-green-200',
        partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        unpaid: 'bg-red-100 text-red-800 border-red-200',
      }[status],
      label: { paid: t('paid'), partial: t('partial') || 'Partial', unpaid: t('unpaid') || 'Unpaid' }[status],
    };
  };

  const getStatusColor = (status) => ({
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    sent: 'bg-blue-100 text-blue-800 border-blue-200',
    partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    paid: 'bg-green-100 text-green-800 border-green-200',
    overdue: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-slate-100 text-slate-800 border-slate-200',
  }[status] || 'bg-gray-100 text-gray-800 border-gray-200');

  const residualOf = (invoice) => (invoice.total_amount || 0) - (invoice.amount_paid || 0);

  // ---------------------------------------------------------------- form ---
  const resetForm = () => setForm({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    tax_id: defaultSalesTax?.id ? String(defaultSalesTax.id) : '',
    lines: [emptyLine()],
  });

  const openCreate = () => { resetForm(); setShowCreateModal(true); };

  const updateLine = (index, patch) => setForm(prev => ({
    ...prev,
    lines: prev.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
  }));

  const selectedTax = taxRates.find(tr => String(tr.id) === String(form.tax_id)) || null;

  // Preview only. The authoritative figures are the ones the backend computes
  // from each line's tax_id against tax_rates — this exists so the number on
  // screen and the number stored come from the same rate, which is precisely
  // what a hardcoded 10% could not guarantee.
  const totals = useMemo(() => {
    const subtotal = form.lines.reduce(
      (sum, l) => sum + ((parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) - (parseFloat(l.discount_amount) || 0)),
      0);
    const rate = parseFloat(selectedTax?.rate) || 0;
    const tax = subtotal * rate / 100;
    return { subtotal, tax, total: subtotal + tax, rate };
  }, [form.lines, selectedTax]);

  const handleCreateInvoice = async () => {
    setIsSaving(true);
    try {
      await createInvoice({
        customer_id: form.customer_id,
        organization_id: activeCompany?.id,
        invoice_date: form.invoice_date,
        ...(form.due_date ? { due_date: form.due_date } : {}),
        notes: form.notes || '',
        lines: form.lines
          .filter(l => (parseFloat(l.quantity) || 0) > 0)
          .map(l => ({
            description: l.description || t('invoice_item') || 'Invoice item',
            quantity: parseFloat(l.quantity) || 0,
            unit_price: parseFloat(l.unit_price) || 0,
            discount_amount: parseFloat(l.discount_amount) || 0,
            // Without this the backend resolved no rate and stored tax 0, while
            // the form displayed an invented 10% — the user saw 110 000 and
            // 100 000 was written.
            ...(form.tax_id ? { tax_id: String(form.tax_id) } : {}),
          })),
      }, customers.find(c => c.id === form.customer_id)?.name);
      setShowCreateModal(false);
      resetForm();
      await fetchInvoices();
    } catch (err) {
      console.error('Invoice creation error:', err.response?.data || err);
      showError(getApiErrorMessage(err, 'Failed to create invoice'), t('error') || 'Xato');
    
      toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  // The backend accepts due_date, reference, po_number, notes, terms and status
  // on update, and only while the invoice is draft. The form offers exactly
  // that rather than fields the server would silently drop.
  const handleUpdateInvoice = async () => {
    if (!editInvoice) return;
    setIsSaving(true);
    try {
      await updateInvoice(editInvoice.id, {
        due_date: editInvoice.due_date || undefined,
        notes: editInvoice.notes || '',
        po_number: editInvoice.po_number || '',
      });
      setEditInvoice(null);
      await fetchInvoices();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to update invoice'), t('error') || 'Xato');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await deleteInvoice(deleteTarget.id);
      setDeleteTarget(null);
      await fetchInvoices();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to delete invoice'), t('error') || 'Xato');
    } finally {
      setIsSaving(false);
    }
  };

  // Partial payment. markAsPaid always settled the full residual, so a customer
  // paying half could not be recorded at all on this screen.
  const handleRecordPayment = async () => {
    if (!paymentTarget) return;
    const amount = parseFloat(paymentTarget.amount) || 0;
    if (amount <= 0) return;
    setIsSaving(true);
    try {
      await recordPayment(
        paymentTarget.invoice.id, amount,
        paymentTarget.method || 'bank_transfer', paymentTarget.date);
      setPaymentTarget(null);
      await fetchInvoices();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to record payment');
      // "Already fully paid" means the visible row was stale — resync rather
      // than leaving the user at a dead end.
      if (err.response?.status === 400 && /fully paid/i.test(msg)) {
        setPaymentTarget(null);
        await fetchInvoices();
        showAlert(language === 'ru'
          ? 'Счёт уже оплачен — список обновлён'
          : language === 'uz'
            ? "Bu faktura allaqachon to'langan — ro'yxat yangilandi"
            : 'Invoice is already paid — list refreshed');
        return;
      }
      showError(msg, t('error') || 'Xato');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreditNote = async () => {
    if (!creditNoteTarget?.reason?.trim()) return;
    setIsSaving(true);
    try {
      await salesService.createCreditNote(creditNoteTarget.invoice.id, {
        reason: creditNoteTarget.reason.trim(),
      });
      setCreditNoteTarget(null);
      await fetchInvoices();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Failed to create credit note'), t('error') || 'Xato');
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------------------- render ---
  return (
    <div className="space-y-6">

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalReceivable)}</p>
            <p className="text-sm text-slate-600">{t('total_receivable')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-900">{formatCurrencyCompact(metrics.overdueAmount)}</p>
            <p className="text-sm text-slate-600">{t('overdue_amount')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            {/* null is "unknown", and an em dash says so. Rendering 0 would
                claim invoices are settled the day they are issued. */}
            <p className="text-3xl font-bold text-blue-900">
              {metrics.avgDaysToPay === null || metrics.avgDaysToPay === undefined
                ? '—'
                : Math.round(metrics.avgDaysToPay)}
            </p>
            <p className="text-sm text-slate-600">{t('avg_days_to_pay')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-orange-900">{metrics.overdueInvoices}</p>
            <p className="text-sm text-slate-600">{t('overdue_invoices')}</p>
          </CardContent>
        </Card>
      </div>

      <div className={`grid grid-cols-1 ${agingData.length > 0 ? 'lg:grid-cols-3' : ''} gap-6`}>

        {/* Aging Report */}
        {agingData.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold">{t('aging_report')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={agingData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={AGING_COLORS[index % AGING_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrencyCompact(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Invoices List */}
        <Card className={`${agingData.length > 0 ? 'lg:col-span-2' : ''} bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg`}>
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">{t('customer_invoices')}</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">{totalInvoices} {t('invoices') || 'faktura'}</p>
                </div>
                {canCreate(MODULES.FINANCIALS) && (
                  <Button onClick={openCreate} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                    <Plus className="w-4 h-4 mr-2" /> {t('new_invoice')}
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_invoices')}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                    <SelectItem value="sent">{t('sent') || 'Sent'}</SelectItem>
                    <SelectItem value="paid">{t('paid')}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
                    <SelectItem value="overdue">{t('overdue') || 'Overdue'}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_payments') || 'All Payments'}</SelectItem>
                    <SelectItem value="unpaid">{t('unpaid') || 'Unpaid'}</SelectItem>
                    <SelectItem value="partial">{t('partial') || 'Partial'}</SelectItem>
                    <SelectItem value="paid">{t('paid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {listLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-16">
                {/* An empty filtered result is not an empty tenant. */}
                <p className="text-slate-500">
                  {hasActiveFilter ? (t('no_results_found') || 'Natija topilmadi') : t('no_data')}
                </p>
                {!hasActiveFilter && canCreate(MODULES.FINANCIALS) && (
                  <Button onClick={openCreate} className="mt-4" variant="outline">
                    <Plus className="w-4 h-4 mr-2" /> {t('create_first_invoice')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('invoice_number')}</TableHead>
                      <TableHead>{t('customer')}</TableHead>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('due_date')}</TableHead>
                      <TableHead>{t('amount')}</TableHead>
                      <TableHead>{t('payment_status') || 'Payment'}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const ps = paymentStatusBadge(invoice);
                      const residual = residualOf(invoice);
                      return (
                        <TableRow key={invoice.id} className={invoice.is_overdue ? 'bg-red-50/70 hover:bg-red-100/50' : 'hover:bg-slate-50'}>
                          <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                          <TableCell className="font-medium">{customerNameOf(invoice)}</TableCell>
                          <TableCell className="text-sm">
                            {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                          </TableCell>
                          {/* is_overdue and days_overdue both come from the
                              server's CURRENT_DATE, so this badge and the
                              "Muddati o'tgan" filter always agree. */}
                          <TableCell className={`text-sm ${invoice.is_overdue ? 'text-red-600 font-semibold' : ''}`}>
                            {invoice.due_date ? format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                            {invoice.is_overdue && invoice.days_overdue > 0 && (
                              <span className="ml-1 text-xs">({invoice.days_overdue}d)</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(invoice.total_amount || 0)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Badge className={ps.style}>{ps.label}</Badge>
                              {paymentStatusOf(invoice) === 'partial' && (
                                <span className="text-xs text-slate-500">{t('due')}: {formatCurrency(residual)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 items-start">
                              {/* The document status is shown as it is. It used
                                  to be overwritten with 'overdue' in the
                                  browser, which erased the real value. */}
                              <Badge className={getStatusColor(invoice.status)}>{t(invoice.status) || invoice.status}</Badge>
                              {invoice.is_overdue && (
                                <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                  {t('overdue') || "Muddati o'tgan"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {canUpdate(MODULES.FINANCIALS) && residual > 0 && invoice.status !== 'cancelled' && (
                                <Button
                                  size="sm" variant="ghost" title={t('record_payment') || "To'lov"}
                                  onClick={() => setPaymentTarget({
                                    invoice,
                                    amount: String(residual),
                                    method: 'bank_transfer',
                                    date: new Date().toISOString().split('T')[0],
                                  })}
                                >
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                              )}
                              {canUpdate(MODULES.FINANCIALS) && invoice.status === 'draft' && (
                                <Button
                                  size="sm" variant="ghost" title={t('edit')}
                                  onClick={() => setEditInvoice({ ...invoice })}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {canCreate(MODULES.FINANCIALS) && invoice.status !== 'draft' && invoice.status !== 'cancelled' && (invoice.invoice_type || 'invoice') === 'invoice' && (
                                <Button
                                  size="sm" variant="ghost" className="text-orange-600 hover:text-orange-700"
                                  title={t('create_credit_note') || 'Kredit-nota'}
                                  onClick={() => setCreditNoteTarget({ invoice, reason: '' })}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              )}
                              {canDelete(MODULES.FINANCIALS) && invoice.status === 'draft' && (
                                <Button
                                  size="sm" variant="ghost" className="text-red-600 hover:text-red-700"
                                  title={t('delete')}
                                  onClick={() => setDeleteTarget(invoice)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-slate-600">
                      {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalInvoices)} / {totalInvoices}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('create_customer_invoice') || 'Create Customer Invoice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('customer')} *</label>
                <Select value={form.customer_id} onValueChange={(value) => setForm(prev => ({ ...prev, customer_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCustomers ? t('loading') : t('select_customer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('tax') || 'Soliq'}</label>
                {/* The rate is chosen here and sent as tax_id; the backend
                    resolves it against tax_rates. Nothing about VAT is
                    computed in the browser any more. */}
                <Select
                  value={form.tax_id || 'none'}
                  onValueChange={(v) => setForm(prev => ({ ...prev, tax_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_tax') || 'Soliqsiz'}</SelectItem>
                    {salesTaxRates.map((tr) => (
                      <SelectItem key={tr.id} value={String(tr.id)}>
                        {tr.name} ({tr.rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('invoice_date')} *</label>
                <Input type="date" value={form.invoice_date}
                  onChange={(e) => setForm(prev => ({ ...prev, invoice_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('due_date')}</label>
                {/* Optional: left empty, the backend derives it from the
                    customer's payment term. */}
                <Input type="date" value={form.due_date}
                  onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))} />
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('items') || 'Satrlar'} *</label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setForm(prev => ({ ...prev, lines: [...prev.lines, emptyLine()] }))}>
                  <Plus className="w-4 h-4 mr-1" /> {t('add_item') || 'Satr'}
                </Button>
              </div>
              {form.lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input placeholder={t('description')} value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <NumberInput placeholder={t('quantity') || 'Soni'} value={line.quantity}
                      onChange={(raw) => updateLine(index, { quantity: raw })} />
                  </div>
                  <div className="col-span-2">
                    <NumberInput placeholder={t('unit_price') || 'Narx'} value={line.unit_price}
                      onChange={(raw) => updateLine(index, { unit_price: raw })} />
                  </div>
                  <div className="col-span-2">
                    <NumberInput placeholder={t('discount') || 'Chegirma'} value={line.discount_amount}
                      onChange={(raw) => updateLine(index, { discount_amount: raw })} />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="sm" disabled={form.lines.length === 1}
                      onClick={() => setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }))}>
                      <X className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('subtotal')}</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tax') || 'Soliq'} ({totals.rate}%)</span>
                <span className="font-medium">{formatCurrency(totals.tax)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span>{t('total')}</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('notes')}</label>
              <Input placeholder={t('optional_notes') || 'Optional notes'} value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1" disabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateInvoice}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !form.customer_id || !form.lines.some(l => (parseFloat(l.quantity) || 0) > 0 && l.description.trim())}
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('create_invoice') || 'Create Invoice')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editInvoice} onOpenChange={(open) => !open && setEditInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('edit_invoice') || 'Fakturani tahrirlash'} {editInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {editInvoice && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('due_date')}</label>
                <Input type="date" value={editInvoice.due_date || ''}
                  onChange={(e) => setEditInvoice({ ...editInvoice, due_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('po_number') || 'PO №'}</label>
                <Input value={editInvoice.po_number || ''}
                  onChange={(e) => setEditInvoice({ ...editInvoice, po_number: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('notes')}</label>
                <Textarea rows={3} value={editInvoice.notes || ''}
                  onChange={(e) => setEditInvoice({ ...editInvoice, notes: e.target.value })} />
              </div>
              <p className="text-xs text-slate-500">
                {t('edit_draft_only_note')
                  || "Faqat qoralama fakturaning muddati, PO raqami va izohini o'zgartirish mumkin. Summani o'zgartirish uchun fakturani bekor qilib, yangisini yarating."}
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditInvoice(null)} className="flex-1" disabled={isSaving}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleUpdateInvoice} className="flex-1" disabled={isSaving}>
                  {isSaving ? (t('saving') || 'Saving...') : t('save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={!!paymentTarget} onOpenChange={(open) => !open && setPaymentTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('record_payment') || "To'lov qayd etish"}</DialogTitle>
          </DialogHeader>
          {paymentTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('invoice_number')}</span>
                  <span className="font-mono font-medium">{paymentTarget.invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('total')}</span>
                  <span className="font-medium">{formatCurrency(paymentTarget.invoice.total_amount || 0)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-orange-600">{t('amount_due') || 'Qolgan qarz'}</span>
                  <span className="text-orange-600">{formatCurrency(residualOf(paymentTarget.invoice))}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('amount')} *</label>
                {/* Editable, so a part payment can be recorded. The old button
                    always settled the whole residual. */}
                <NumberInput value={paymentTarget.amount}
                  onChange={(raw) => setPaymentTarget(prev => ({ ...prev, amount: raw }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payment_method') || "To'lov usuli"}</label>
                  <Select value={paymentTarget.method}
                    onValueChange={(v) => setPaymentTarget(prev => ({ ...prev, method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">{t('bank_transfer') || "Bank o'tkazmasi"}</SelectItem>
                      <SelectItem value="cash">{t('cash') || 'Naqd'}</SelectItem>
                      <SelectItem value="card">{t('card') || 'Karta'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('date')}</label>
                  <Input type="date" value={paymentTarget.date}
                    onChange={(e) => setPaymentTarget(prev => ({ ...prev, date: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setPaymentTarget(null)} className="flex-1" disabled={isSaving}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleRecordPayment} className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isSaving || !(parseFloat(paymentTarget.amount) > 0)}
                >
                  {isSaving ? (t('saving') || 'Saving...') : (t('confirm_payment') || "Tasdiqlash")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit Note Modal */}
      <Dialog open={!!creditNoteTarget} onOpenChange={(open) => !open && setCreditNoteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              {t('create_credit_note') || 'Kredit-nota yaratish'}
            </DialogTitle>
          </DialogHeader>
          {creditNoteTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('invoice_number')}</span>
                  <span className="font-mono font-medium">{creditNoteTarget.invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('amount')}</span>
                  <span className="font-semibold">{formatCurrency(creditNoteTarget.invoice.total_amount || 0)}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('reason')} *</label>
                <Textarea rows={3} value={creditNoteTarget.reason}
                  onChange={(e) => setCreditNoteTarget(prev => ({ ...prev, reason: e.target.value }))} />
              </div>
              <p className="text-xs text-slate-500">
                {t('credit_note_full_note')
                  || "To'liq kredit-nota qoralama holatida yaratiladi. Tasdiqlangandan keyin provodkalar yoziladi va mijoz qarzi kamayadi."}
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setCreditNoteTarget(null)} className="flex-1" disabled={isSaving}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleCreditNote} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={isSaving || !creditNoteTarget.reason.trim()}>
                  {isSaving ? (t('creating') || 'Creating...') : (t('create_credit_note') || 'Kredit-nota')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('delete_invoice') || "Fakturani o'chirish"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {deleteTarget?.invoice_number} — {t('confirm_delete') || "O'chirishni tasdiqlaysizmi?"}
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1" disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={isSaving}>
              {isSaving ? (t('saving') || 'Saving...') : t('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal modal={modal} close={close} />
    </div>
  );
}
