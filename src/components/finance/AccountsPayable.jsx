import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, Search, FileText, AlertTriangle, CheckCircle, Clock, DollarSign, Plus,
  Printer, Eye, RotateCcw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';
import { financeService } from '@/api/services/finance';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

import {
  ImportModal, ExportModal, ImportExportButtons,
  PrintPreviewModal, BatchPrintModal, useAuditTrail,
} from '@/components/shared';

import ScanInvoiceModal from './accounts-payable/ScanInvoiceModal';
import CreateBillModal from './accounts-payable/CreateBillModal';
import DebitNoteModal from './accounts-payable/DebitNoteModal';
import BillDetailModal from './accounts-payable/BillDetailModal';
import { buildBillPrintConfig } from './accounts-payable/billPrintConfig';
import { toast } from 'sonner';
import {
  getPaymentStatus, getPaymentStatusBadge, getStatusColor, isOverdue, residualOf,
} from './accounts-payable/billHelpers';
import { getApiErrorMessage } from '@/utils/apiError';

const PAGE_SIZE = 20;

const getDateLocale = (lang) => {
  switch (lang) {
    case 'ru': return ru;
    case 'uz': return uz;
    default: return undefined;
  }
};

export default function AccountsPayable() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
  const dateLocale = getDateLocale(language);
  // `vendorBills` is deliberately not read here: the context fetches it
  // unparameterised, so it is the first twenty bills of the tenant and can
  // never answer a question about the whole set.
  const { createVendorBill, updateVendorBill, postVendorBill, payVendorBill } = useFinancials();
  const { canCreate, canUpdate } = useEmployeePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { addAuditLog } = useAuditTrail('vendor_bills');

  // --------------------------------------------------------------- state ---
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [billsLoading, setBillsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBills, setTotalBills] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  const [showScanModal, setShowScanModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitial, setCreateInitial] = useState(null);
  const [createError, setCreateError] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [printBill, setPrintBill] = useState(null);
  const [detailBill, setDetailBill] = useState(null);
  const [debitNoteTarget, setDebitNoteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ---------------------------------------------------------------- data ---
  // Rows and cards both from the server, through the same filters.
  //
  // Everything on this screen used to be folded in the browser over the
  // `vendorBills` array, which FinancialsContext fetches with NO parameters —
  // and the backend defaults page_size to 20. So "Jami to'lov" was the sum of
  // the first twenty bills presented as the tenant's total debt, wrong on any
  // real tenant and with nothing on screen to say so. Mobile reads
  // /purchase-invoices/stats, which is why the two never agreed.
  const buildParams = useCallback(() => {
    const params = {};
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (typeFilter !== 'all') params.invoice_type = typeFilter;
    if (paymentStatusFilter !== 'all') params.payment_status = paymentStatusFilter;
    // "Muddati o'tgan" is not a document status — it is a predicate over due
    // date and residual. The old code compared it against bill.status, so the
    // chip matched nothing at all.
    if (statusFilter === 'overdue') params.overdue = 'true';
    // "Tasdiqlangan" has to mean confirmed OR posted — posting does not
    // un-confirm a bill — and a single status= could not express that. The
    // server takes a comma-separated list and matches with = ANY().
    else if (statusFilter === 'confirmed') params.status = 'confirmed,posted';
    else if (statusFilter !== 'all') params.status = statusFilter;
    return params;
  }, [searchQuery, statusFilter, typeFilter, paymentStatusFilter]);

  const hasActiveFilter = searchQuery.trim() !== '' || statusFilter !== 'all'
    || typeFilter !== 'all' || paymentStatusFilter !== 'all';

  const fetchBills = useCallback(async () => {
    setBillsLoading(true);
    const params = buildParams();
    try {
      const [listResp, statsResp] = await Promise.all([
        financeService.listPurchaseInvoices({ ...params, page: currentPage, page_size: PAGE_SIZE }),
        // Same params, deliberately without page/page_size — a summary that
        // paginated would answer a different question than it appears to.
        financeService.getPurchaseInvoiceStats(params).catch(() => null),
      ]);
      const rows = Array.isArray(listResp?.data) ? listResp.data : Array.isArray(listResp) ? listResp : [];
      setBills(rows);
      const meta = listResp?.meta || {};
      setTotalBills(meta.total ?? rows.length);
      setTotalPages(meta.total_pages || Math.max(1, Math.ceil((meta.total ?? rows.length) / PAGE_SIZE)));
      setStats(statsResp);
    } catch (err) {
      console.error('Failed to load vendor bills:', err);
      setBills([]);
      setStats(null);
    } finally {
      setBillsLoading(false);
    }
  }, [buildParams, currentPage]);

  useEffect(() => { fetchBills(); }, [fetchBills]);
  // A filter change re-queries from page 1; staying on page 7 of the old
  // result set shows an empty table and reads as "no data".
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, typeFilter, paymentStatusFilter]);

  // Three figures over the WHOLE filtered set.
  //
  // outstanding_amount is the residual (total - paid) over everything not paid
  // or cancelled — not the stored amount_due column the old reduce summed.
  // amount_due is not maintained on every write path, which is the second
  // reason the card could drift from the rows beneath it.
  //
  // The screen calls the third card "Tasdiqlash kutilmoqda", but there is no
  // approval workflow in this schema: migration 478 pins the writable statuses
  // to draft/confirmed/posted/partial/paid/cancelled. draft_count is what "not
  // yet confirmed" actually means here.
  const metrics = {
    totalPayable: stats?.outstanding_amount ?? 0,
    overdueBills: stats?.overdue_count ?? 0,
    overdueAmount: stats?.overdue_amount ?? 0,
    pendingApproval: stats?.draft_count ?? 0,
  };

  // ------------------------------------------------------------- actions ---
  // Each re-queries the current page and the cards afterwards. Mutating context
  // state was enough while the list came from context; with the rows now
  // server-side, a confirmed bill would keep its old badge until a reload.
  const approveBill = async (bill) => {
    await updateVendorBill(bill.id, { status: 'confirmed' });
    addAuditLog('approve', bill.id, 'Vendor Bill', { oldStatus: 'draft', newStatus: 'confirmed' });
    setDetailBill(null);
    await fetchBills();
  };

  const postBill = async (bill) => {
    try {
      await postVendorBill(bill.id);
      addAuditLog('post', bill.id, 'Vendor Bill', { oldStatus: 'draft', newStatus: 'posted', note: 'Journal entry created' });
      setDetailBill(null);
      await fetchBills();
    } catch (err) {
      console.error('Failed to post bill:', err);
    }
  };

  // The bill is passed in rather than looked up by id: `vendorBills` holds at
  // most the context's twenty rows, so a bill on page 2 was not in it and the
  // amount came out NaN — payVendorBill then posted a payment for nothing.
  const payBill = async (bill) => {
    try {
      const residual = residualOf(bill);
      if (residual <= 0) return;
      await payVendorBill(bill.id, residual);
      addAuditLog('status_change', bill.id, 'Vendor Bill', { oldStatus: bill.status, newStatus: 'paid' });
      setDetailBill(null);
      await fetchBills();
    } catch (err) {
      console.error('Failed to pay bill:', err);
      // Surface the backend's refusal (e.g. kassa balansi yetarli emas) —
      // a silent catch made a refused payment look like a dead button.
      toast.error(getApiErrorMessage(err, t('payment_failed') || "To'lov amalga oshmadi"));
    }
  };

  const handleCreateBill = async (draft) => {
    setIsSaving(true);
    setCreateError(null);
    try {
      const created = await createVendorBill({
        ...draft,
        vendor_id: draft.partner_id,
        organization_id: activeCompany?.id,
        amount_due: parseFloat(draft.total_amount) || 0,
        amount_paid: 0,
        status: 'draft',
        three_way_match_status: 'pending',
      });
      addAuditLog('create', created?.id || 'new', draft.vendor_invoice_number);
      setShowCreateModal(false);
      setCreateInitial(null);
      await fetchBills();
    } catch (err) {
      console.error('Error creating vendor bill:', err.response?.data || err);
      // Shown in the dialog. This used to be a console.error only, so a
      // rejected create looked exactly like a button that did nothing.
      setCreateError(getApiErrorMessage(err, 'Failed to create vendor bill'));
    
      toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (data) => {
    // Awaited in sequence, not fired and forgotten: the previous loop called
    // createVendorBill without await, so the audit line was written — and the
    // list refreshed — before any bill existed, and a failing row was silent.
    for (const row of data) {
      await createVendorBill({
        partner_id: row.partner_id,
        vendor_id: row.partner_id,
        organization_id: activeCompany?.id,
        vendor_invoice_number: row.vendor_invoice_number || row.invoice_number || '',
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        subtotal: parseFloat(row.subtotal) || 0,
        tax_amount: (parseFloat(row.subtotal) || 0) * 0.12,
        total_amount: (parseFloat(row.subtotal) || 0) * 1.12,
        amount_due: (parseFloat(row.subtotal) || 0) * 1.12,
        amount_paid: 0,
        status: 'draft',
        three_way_match_status: 'pending',
      });
    }
    addAuditLog('create', 'batch', `${data.length} bills imported`);
    await fetchBills();
  };

  const handleDebitNoteSubmit = async () => {
    if (!debitNoteTarget?.reason?.trim()) return;
    setIsSaving(true);
    try {
      await financeService.createDebitNote(debitNoteTarget.bill.id, { reason: debitNoteTarget.reason });
      setDebitNoteTarget(null);
      // Re-query instead of window.location.reload(): a full reload threw away
      // the user's filters and their page in the list.
      await fetchBills();
    } catch (error) {
      console.error('Failed to create debit note:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDebitNote = async (debitNoteId) => {
    try {
      await financeService.confirmDebitNote(debitNoteId);
      await fetchBills();
    } catch (error) {
      console.error('Failed to confirm debit note:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  // -------------------------------------------------------- import/export ---
  const exportColumns = [
    { key: 'invoice_number', label: t('invoice_number') || 'Invoice Number' },
    { key: 'partner_name', label: t('vendor') || 'Vendor' },
    { key: 'invoice_date', label: t('date') || 'Date', render: (v) => (v ? format(new Date(v), 'dd.MM.yyyy') : '-') },
    { key: 'due_date', label: t('due_date') || 'Due Date', render: (v) => (v ? format(new Date(v), 'dd.MM.yyyy') : '-') },
    { key: 'total_amount', label: t('amount') || 'Amount', render: (v) => formatCurrency(v || 0) },
    { key: 'status', label: t('status') || 'Status', render: (v) => t(v) || v },
  ];

  const importColumns = [
    { key: 'partner_id', label: t('vendor') || 'Vendor', required: true },
    { key: 'vendor_invoice_number', label: t('vendor_ref') || 'Vendor doc №', required: true },
    { key: 'invoice_date', label: t('date') || 'Date', required: true },
    { key: 'due_date', label: t('due_date') || 'Due Date', required: true },
    { key: 'subtotal', label: t('amount') || 'Amount', required: true },
  ];

  const printConfigFor = (bill) => buildBillPrintConfig(bill, t, formatCurrency);

  // --------------------------------------------------------------- render ---
  return (
    <div className="space-y-6">

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalPayable)}</p>
            <p className="text-sm text-slate-600">{t('total_payable')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-orange-900">{metrics.overdueBills}</p>
            <p className="text-sm text-slate-600">{t('overdue_bills')}</p>
            {/* The count alone never said how much was at stake. */}
            <p className="text-xs text-orange-600 mt-0.5">{formatCurrencyCompact(metrics.overdueAmount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-900">{metrics.pendingApproval}</p>
            <p className="text-sm text-slate-600">{t('pending_approval')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bills List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-xl font-bold">{t('vendor_bills')}</CardTitle>
                {/* The table shows one page; say how many rows the filter
                    actually matched so the cards above are readable. */}
                <p className="text-sm text-slate-500 mt-1">{totalBills} {t('bills') || 'faktura'}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ImportExportButtons
                  onImport={() => setShowImportModal(true)}
                  onExport={() => setShowExportModal(true)}
                />
                <Button variant="outline" size="sm" onClick={() => setShowBatchPrint(true)} disabled={bills.length === 0}>
                  <Printer className="w-4 h-4 mr-1" />
                  {t('print') || 'Print'}
                </Button>
                {canCreate('financials') && (
                  <>
                    <Button variant="outline" onClick={() => setShowScanModal(true)}>
                      <Upload className="w-4 h-4 mr-2" /> {t('upload_invoice')}
                    </Button>
                    <Button
                      onClick={() => { setCreateInitial(null); setCreateError(null); setShowCreateModal(true); }}
                      className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                    >
                      <Plus className="w-4 h-4 mr-2" /> {t('new_entry')}
                    </Button>
                  </>
                )}
              </div>
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all')}</SelectItem>
                  <SelectItem value="invoice">{t('bills') || 'Bills'}</SelectItem>
                  <SelectItem value="debit_note">{t('debit_notes')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('filter_by_status') || 'Filter by status'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status')}</SelectItem>
                  <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                  <SelectItem value="confirmed">{t('confirmed')}</SelectItem>
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
          {billsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              {/* An empty filtered result is not an empty tenant — offering
                  "create your first bill" under an active filter is a lie. */}
              <p className="text-slate-500">
                {hasActiveFilter ? (t('no_results_found') || 'Natija topilmadi') : t('no_data')}
              </p>
              {!hasActiveFilter && canCreate('financials') && (
                <Button onClick={() => setShowCreateModal(true)} className="mt-4" variant="outline">
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_bill')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('invoice_number')}</TableHead>
                    <TableHead>{t('vendor')}</TableHead>
                    <TableHead>{t('po_reference') || 'PO Ref'}</TableHead>
                    <TableHead>{t('gr_reference') || 'GR Ref'}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('due_date')}</TableHead>
                    <TableHead>{t('amount')}</TableHead>
                    <TableHead>{t('payment_status') || 'Payment'}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((bill) => {
                    const overdue = isOverdue(bill);
                    const ps = getPaymentStatusBadge(bill, t);
                    return (
                      <TableRow key={bill.id} className={overdue ? 'bg-red-50/80 hover:bg-red-100/60' : 'hover:bg-slate-50'}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {bill.invoice_type === 'debit_note' && <RotateCcw className="w-4 h-4 text-orange-500" />}
                            {bill.invoice_number}
                            {bill.invoice_type === 'debit_note' && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">{t('debit_note')}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{bill.partner_name || bill.vendor_name || '-'}</TableCell>
                        <TableCell className="text-sm font-mono">{bill.purchase_order_number || '-'}</TableCell>
                        <TableCell className="text-sm font-mono">{bill.goods_receipt_number || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {bill.invoice_date ? format(new Date(bill.invoice_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                        </TableCell>
                        {/* days_overdue arrives from the same CURRENT_DATE the
                            flag does, and is negative while a bill is still
                            within term — so the sign chooses the wording. */}
                        <TableCell className={`text-sm ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                          {bill.due_date ? format(new Date(bill.due_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                          {overdue && bill.days_overdue > 0 && (
                            <span className="ml-1 text-xs">({bill.days_overdue}d)</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(bill.total_amount || 0)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge className={ps.style}>{ps.label}</Badge>
                            {getPaymentStatus(bill) === 'partial' && (
                              <span className="text-xs text-slate-500">{t('due')}: {formatCurrency(residualOf(bill))}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(bill.status)}>{t(bill.status) || bill.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setDetailBill(bill)} title={t('view') || 'View'}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canUpdate('financials') && bill.status === 'draft' && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => postBill(bill)}
                                  title={t('post') || 'Post (Create Journal Entry)'} className="text-green-600 hover:text-green-700">
                                  <FileText className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => approveBill(bill)} title={t('confirm') || 'Confirm'}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {canUpdate('financials') && (bill.status === 'confirmed' || bill.status === 'posted') && (bill.invoice_type || 'invoice') === 'invoice' && (
                              <Button size="sm" variant="ghost" onClick={() => payBill(bill)} title={t('pay') || 'Record Payment'}>
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                            {canCreate('financials') && (bill.invoice_type || 'invoice') === 'invoice' && bill.status !== 'draft' && bill.status !== 'cancelled' && (
                              <Button size="sm" variant="ghost" onClick={() => setDebitNoteTarget({ bill, reason: '' })}
                                title={t('create_debit_note')} className="text-orange-600 hover:text-orange-700">
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            {canUpdate('financials') && bill.invoice_type === 'debit_note' && bill.status === 'draft' && (
                              <Button size="sm" variant="ghost" onClick={() => handleConfirmDebitNote(bill.id)}
                                title={t('confirm_debit_note')} className="text-green-600 hover:text-green-700">
                                <CheckCircle className="w-4 h-4" />
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
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalBills)} / {totalBills}
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

      <ScanInvoiceModal
        open={showScanModal}
        onOpenChange={setShowScanModal}
        onApply={(extracted) => {
          setShowScanModal(false);
          setCreateInitial(extracted);
          setCreateError(null);
          setShowCreateModal(true);
        }}
      />

      <CreateBillModal
        open={showCreateModal}
        onOpenChange={(open) => { setShowCreateModal(open); if (!open) setCreateError(null); }}
        initial={createInitial}
        onSubmit={handleCreateBill}
        isSaving={isSaving}
        error={createError}
      />

      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        columns={importColumns}
        entityName={t('vendor_bill') || 'Vendor Bill'}
      />

      {/* Export and batch print cover the rows currently on screen, which is
          this page — the count beside the title says how many the filter
          matched in total. */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={bills}
        columns={exportColumns}
        entityName="vendor_bills"
        title={t('vendor_bills') || 'Vendor Bills'}
      />

      {printBill && (
        <PrintPreviewModal
          open={!!printBill}
          onClose={() => setPrintBill(null)}
          config={printConfigFor(printBill)}
          filename={`vendor_bill_${printBill.id}`}
        />
      )}

      <BatchPrintModal
        open={showBatchPrint}
        onClose={() => setShowBatchPrint(false)}
        documents={bills.map(b => ({
          id: b.id,
          name: b.invoice_number || `VB-${b.id}`,
          number: b.invoice_number,
          date: b.invoice_date ? format(new Date(b.invoice_date), 'dd.MM.yyyy') : '',
        }))}
        generateConfig={printConfigFor}
        entityName={t('invoice') || 'Invoice'}
      />

      <DebitNoteModal
        target={debitNoteTarget}
        onChange={setDebitNoteTarget}
        onSubmit={handleDebitNoteSubmit}
        isSaving={isSaving}
      />

      <BillDetailModal
        bill={detailBill}
        onClose={() => setDetailBill(null)}
        onPost={postBill}
        onApprove={approveBill}
        onPay={payBill}
        onPrint={(bill) => { setDetailBill(null); setPrintBill(bill); }}
      />
    </div>
  );
}
