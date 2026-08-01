import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search, FileText, AlertTriangle, CheckCircle, Clock, DollarSign, Plus, Download, Printer, Eye, Building2, Loader2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';
import { contactsService, aiService } from '@/api/services';
import { financeService } from '@/api/services/finance';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Import universal ERP components
import {
  StatusBadge,
  WorkflowActions,
  WorkflowTimeline,
  ImportModal,
  ExportModal,
  ImportExportButtons,
  PrintButton,
  PrintPreviewModal,
  BatchPrintModal,
  generateDocumentPDF,
  useAuditTrail,
  AttachmentsCommentsCard,
} from '@/components/shared';

// Helper to get date-fns locale
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
  const {
    vendorBills,
    createVendorBill,
    updateVendorBill,
    postVendorBill,
    payVendorBill,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete } = useEmployeePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [filteredBills, setFilteredBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [debitNoteBill, setDebitNoteBill] = useState(null);
  const [debitNoteReason, setDebitNoteReason] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const { addAuditLog } = useAuditTrail('vendor_bills');
  const [newBill, setNewBill] = useState({
    partner_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    total_amount: 0,
    tax_amount: 0,
    subtotal: 0
  });
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [extractionError, setExtractionError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Load vendors when create modal opens or recurring tab is active
  useEffect(() => {
    if (showCreateModal && vendors.length === 0) {
      setVendorsLoading(true);
      contactsService.list({ contact_type: 'vendor' })
        .then(data => {
          const allContacts = data?.data || data || [];
          setVendors(allContacts);
        })
        .catch(err => {
          console.error('Failed to load vendors:', err);
        })
        .finally(() => {
          setVendorsLoading(false);
        });
    }
  }, [showCreateModal, vendors.length]);

  // Handle file selection for AI extraction
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData(null);
      setExtractionError(null);
    }
  };

  // Handle AI extraction
  const handleAIExtract = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setExtractionError(null);

    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const result = await aiService.extractInvoice(base64, selectedFile.type);
      setExtractedData(result);
    } catch (err) {
      console.error('AI extraction failed:', err);
      setExtractionError(err.response?.data?.message || err.message || t('ai_extraction_failed') || 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  // Apply extracted data to create bill form
  const handleApplyExtractedData = () => {
    if (!extractedData?.extracted_data) return;

    const data = extractedData.extracted_data;

    setNewBill({
      partner_id: '', // User needs to select vendor manually
      invoice_number: data.invoice_number || '',
      invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date || '',
      total_amount: data.total_amount || 0,
      tax_amount: data.tax_amount || 0,
      subtotal: data.subtotal || 0,
    });

    // Close upload modal and open create modal
    setShowUploadModal(false);
    setShowCreateModal(true);
    setExtractedData(null);
    setSelectedFile(null);
  };

  // Export columns configuration
  const exportColumns = [
    { key: 'invoice_number', label: t('invoice_number') || 'Invoice Number' },
    { key: 'partner_name', label: t('vendor') || 'Vendor' },
    { key: 'invoice_date', label: t('date') || 'Date', render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'due_date', label: t('due_date') || 'Due Date', render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'total_amount', label: t('amount') || 'Amount', render: (v) => formatCurrency(v || 0) },
    { key: 'status', label: t('status') || 'Status', render: (v) => t(v) || v },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'partner_id', label: t('vendor') || 'Vendor', required: true },
    { key: 'invoice_date', label: t('date') || 'Date', required: true },
    { key: 'due_date', label: t('due_date') || 'Due Date', required: true },
    { key: 'subtotal', label: t('amount') || 'Amount', required: true },
  ];

  const getPaymentStatus = (bill) => {
    const paid = bill.amount_paid || 0;
    const total = bill.total_amount || 0;
    if (total <= 0) return 'unpaid';
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
  };

  const getPaymentStatusBadge = (bill) => {
    const status = getPaymentStatus(bill);
    const styles = {
      paid: 'bg-green-100 text-green-800 border-green-200',
      partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      unpaid: 'bg-red-100 text-red-800 border-red-200',
    };
    const labels = {
      paid: t('paid'),
      partial: t('partial') || 'Partial',
      unpaid: t('unpaid') || 'Unpaid',
    };
    return { style: styles[status], label: labels[status] };
  };

  useEffect(() => {
    setFilteredBills(vendorBills);
  }, [vendorBills]);

  useEffect(() => {
    let filtered = vendorBills;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(b => (b.invoice_type || 'invoice') === typeFilter);
    }

    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(b => getPaymentStatus(b) === paymentStatusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(b =>
        b.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.partner_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBills(filtered);
  }, [vendorBills, searchQuery, statusFilter, typeFilter, paymentStatusFilter]);

  const handleCreateBill = async () => {
    setIsSaving(true);
    try {
      // Get selected vendor info
      const selectedVendor = vendors.find(v => v.id === newBill.partner_id);

      const billData = {
        partner_id: newBill.partner_id, // UUID of the vendor
        vendor_id: newBill.partner_id,  // Backend expects vendor_id
        organization_id: activeCompany?.id,
        partner_name: selectedVendor?.name || selectedVendor?.company_name || '',
        invoice_date: newBill.invoice_date,
        due_date: newBill.due_date,
        total_amount: parseFloat(newBill.total_amount) || 0,
        tax_amount: parseFloat(newBill.tax_amount) || 0,
        subtotal: parseFloat(newBill.subtotal) || 0,
        amount_due: parseFloat(newBill.total_amount) || 0,
        amount_paid: 0,
        status: 'draft',
        three_way_match_status: 'pending'
      };

      const created = await createVendorBill(billData);
      addAuditLog('create', created?.id || 'new', billData.partner_name);
      setShowCreateModal(false);
      setNewBill({
        partner_id: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        total_amount: 0,
        tax_amount: 0,
        subtotal: 0
      });
    } catch (error) {
      console.error('Error creating vendor bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const approveBill = (billId) => {
    updateVendorBill(billId, { status: 'confirmed' });
    addAuditLog('approve', billId, 'Vendor Bill', { oldStatus: 'draft', newStatus: 'confirmed' });
  };

  const postBill = async (billId) => {
    try {
      await postVendorBill(billId);
      addAuditLog('post', billId, 'Vendor Bill', { oldStatus: 'draft', newStatus: 'posted', note: 'Journal entry created' });
    } catch (err) {
      console.error('Failed to post bill:', err);
    }
  };

  const payBill = async (billId) => {
    try {
      const bill = vendorBills.find(b => b.id === billId);
      // Use payVendorBill which creates a Payment record and journal entry
      await payVendorBill(billId, bill?.total_amount - (bill?.amount_paid || 0));
      addAuditLog('status_change', billId, 'Vendor Bill', { oldStatus: bill?.status, newStatus: 'paid' });
    } catch (err) {
      console.error('Failed to pay bill:', err);
    }
  };

  const handleStatusChange = (billId, newStatus, comment) => {
    const bill = vendorBills.find(b => b.id === billId);
    updateVendorBill(billId, { status: newStatus });
    addAuditLog('status_change', billId, bill?.partner_id, { oldStatus: bill?.status, newStatus, comment });
  };

  const handleImport = async (data) => {
    for (const row of data) {
      const billData = {
        partner_id: row.partner_id,
        organization_id: activeCompany?.id,
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        subtotal: parseFloat(row.subtotal) || 0,
        tax_amount: (parseFloat(row.subtotal) || 0) * 0.12,
        total_amount: (parseFloat(row.subtotal) || 0) * 1.12,
        amount_due: (parseFloat(row.subtotal) || 0) * 1.12,
        amount_paid: 0,
        status: 'draft',
        three_way_match_status: 'pending'
      };
      createVendorBill(billData);
    }
    addAuditLog('create', 'batch', `${data.length} bills imported`);
  };

  const generatePrintConfig = (bill) => {
    const statusMap = {
      draft: t('draft') || 'Draft',
      confirmed: t('confirmed') || 'Confirmed',
      posted: t('posted') || 'Posted',
      paid: t('paid') || 'Paid',
      partial: t('partial') || 'Partial',
      overdue: t('overdue') || 'Overdue',
      cancelled: t('cancelled') || 'Cancelled',
    };

    // Build table: show line items if available, otherwise summary
    const tableData = [];
    if (bill.lines && bill.lines.length > 0) {
      bill.lines.forEach(line => {
        tableData.push({
          description: line.description || line.product_name || '-',
          quantity: line.quantity || 1,
          unit_price: formatCurrency(line.unit_price || 0),
          amount: formatCurrency(line.line_total || (line.quantity * line.unit_price) || 0),
        });
      });
    } else {
      tableData.push(
        { description: t('subtotal') || 'Subtotal', quantity: '', unit_price: '', amount: formatCurrency(bill.subtotal || bill.total_amount || 0) },
      );
      if (bill.tax_amount > 0) {
        tableData.push(
          { description: t('tax') || 'Tax', quantity: '', unit_price: '', amount: formatCurrency(bill.tax_amount) },
        );
      }
    }

    const hasLines = bill.lines && bill.lines.length > 0;

    return {
      template: 'invoice',
      title: t('vendor_bill') || 'Vendor Bill',
      documentNumber: bill.invoice_number || `VB-${bill.id}`,
      documentDate: bill.invoice_date ? format(new Date(bill.invoice_date), 'dd.MM.yyyy') : '',
      dateLabel: t('date') || 'Date',
      headerFields: [
        { label: t('vendor') || 'Vendor', value: bill.partner_name || bill.vendor_name || '-' },
        { label: t('due_date') || 'Due Date', value: bill.due_date ? format(new Date(bill.due_date), 'dd.MM.yyyy') : '-' },
        { label: t('status') || 'Status', value: statusMap[bill.status] || bill.status || '-' },
        { label: t('po_reference') || 'PO Reference', value: bill.po_number || bill.purchase_order_id || '-' },
      ],
      tableColumns: hasLines ? [
        { key: 'description', label: t('description') || 'Description', width: 70 },
        { key: 'quantity', label: t('quantity') || 'Qty', align: 'right', width: 20 },
        { key: 'unit_price', label: t('unit_price') || 'Unit Price', align: 'right', width: 35 },
        { key: 'amount', label: t('amount') || 'Amount', align: 'right', width: 35 },
      ] : [
        { key: 'description', label: t('description') || 'Description' },
        { key: 'amount', label: t('amount') || 'Amount', align: 'right' },
      ],
      tableData,
      totals: [
        ...(bill.tax_amount > 0 && hasLines ? [
          { label: t('subtotal') || 'Subtotal', value: formatCurrency(bill.subtotal || 0) },
          { label: t('tax') || 'Tax', value: formatCurrency(bill.tax_amount || 0) },
        ] : []),
        { label: t('total') || 'Total', value: formatCurrency(bill.total_amount || 0), bold: true },
        ...(bill.amount_paid > 0 ? [
          { label: t('amount_paid') || 'Paid', value: formatCurrency(bill.amount_paid || 0) },
          { label: t('amount_due') || 'Due', value: formatCurrency(bill.amount_due ?? (bill.total_amount - (bill.amount_paid || 0))), bold: true },
        ] : []),
      ],
    };
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      posted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      paid: 'bg-green-100 text-green-800 border-green-200',
      partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[status] || colors.draft;
  };

  const getMatchStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      matched: 'bg-green-100 text-green-800',
      exception: 'bg-red-100 text-red-800',
      not_applicable: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.pending;
  };

  const handleCreateDebitNote = (bill) => {
    setDebitNoteBill(bill);
    setDebitNoteReason('');
    setShowDebitNoteModal(true);
  };

  const handleDebitNoteSubmit = async () => {
    if (!debitNoteBill || !debitNoteReason.trim()) return;
    setIsSaving(true);
    try {
      await financeService.createDebitNote(debitNoteBill.id, {
        reason: debitNoteReason,
      });
      setShowDebitNoteModal(false);
      setDebitNoteBill(null);
      setDebitNoteReason('');
      window.location.reload();
    } catch (error) {
      console.error('Failed to create debit note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDebitNote = async (debitNoteId) => {
    try {
      await financeService.confirmDebitNote(debitNoteId);
      window.location.reload();
    } catch (error) {
      console.error('Failed to confirm debit note:', error);
    }
  };

  // Calculate metrics
  const metrics = {
    totalPayable: vendorBills.reduce((sum, b) => sum + (b.amount_due || 0), 0),
    overdueBills: vendorBills.filter(b => {
      if (!b.due_date || b.status === 'paid') return false;
      return new Date(b.due_date) < new Date();
    }).length,
    pendingApproval: vendorBills.filter(b => b.status === 'draft').length
  };

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
                  <CardTitle className="text-xl font-bold">{t('vendor_bills')}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <ImportExportButtons
                      onImport={() => setShowImportModal(true)}
                      onExport={() => setShowExportModal(true)}
                    />
                    <Button variant="outline" size="sm" onClick={() => setShowBatchPrint(true)} disabled={filteredBills.length === 0}>
                      <Printer className="w-4 h-4 mr-1" />
                      {t('print') || 'Print'}
                    </Button>
                    {canCreate('financials') && (
                      <>
                        <Button variant="outline" onClick={() => setShowUploadModal(true)}>
                          <Upload className="w-4 h-4 mr-2" /> {t('upload_invoice')}
                        </Button>
                        <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
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
                      <SelectItem value="overdue">{t('overdue') || 'Overdue'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_data')}</p>
              {canCreate('financials') && (
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
                  {filteredBills.map((bill) => (
                    <TableRow key={bill.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {bill.invoice_type === 'debit_note' && (
                            <RotateCcw className="w-4 h-4 text-orange-500" />
                          )}
                          {bill.invoice_number}
                          {bill.invoice_type === 'debit_note' && (
                            <Badge className="bg-orange-100 text-orange-700 text-xs">{t('debit_note')}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{bill.partner_name || bill.vendor_name || '-'}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {bill.purchase_order_number || '-'}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {bill.goods_receipt_number || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {bill.invoice_date ? format(new Date(bill.invoice_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {bill.due_date ? format(new Date(bill.due_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(bill.total_amount || 0)}</TableCell>
                      <TableCell>
                        {(() => {
                          const ps = getPaymentStatusBadge(bill);
                          const amountDue = (bill.total_amount || 0) - (bill.amount_paid || 0);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <Badge className={ps.style}>{ps.label}</Badge>
                              {getPaymentStatus(bill) === 'partial' && (
                                <span className="text-xs text-slate-500">{t('due')}: {formatCurrency(amountDue)}</span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(bill.status)}>{t(bill.status) || bill.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBill(bill);
                              setShowDetailModal(true);
                            }}
                            title={t('view') || 'View'}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canUpdate('financials') && bill.status === 'draft' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => postBill(bill.id)}
                                title={t('post') || 'Post (Create Journal Entry)'}
                                className="text-green-600 hover:text-green-700"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => approveBill(bill.id)} title={t('confirm') || 'Confirm'}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {canUpdate('financials') && (bill.status === 'confirmed' || bill.status === 'posted') && (bill.invoice_type || 'invoice') === 'invoice' && (
                            <Button size="sm" variant="ghost" onClick={() => payBill(bill.id)} title={t('pay') || 'Record Payment'}>
                              <DollarSign className="w-4 h-4" />
                            </Button>
                          )}
                          {canCreate('financials') && (bill.invoice_type || 'invoice') === 'invoice' && bill.status !== 'draft' && bill.status !== 'cancelled' && (
                            <Button size="sm" variant="ghost" onClick={() => handleCreateDebitNote(bill)} title={t('create_debit_note')} className="text-orange-600 hover:text-orange-700">
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {canUpdate('financials') && bill.invoice_type === 'debit_note' && bill.status === 'draft' && (
                            <Button size="sm" variant="ghost" onClick={() => handleConfirmDebitNote(bill.id)} title={t('confirm_debit_note')} className="text-green-600 hover:text-green-700">
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
          </Card>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={(open) => {
        setShowUploadModal(open);
        if (!open) {
          setSelectedFile(null);
          setExtractedData(null);
          setExtractionError(null);
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-600" />
              {t('scan_invoice') || 'Scan Invoice'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File Upload Area */}
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              selectedFile ? 'border-purple-400 bg-purple-50' : 'border-slate-300 hover:border-purple-300'
            }`}>
              {!selectedFile ? (
                <>
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-3">
                    {t('upload_invoice_description') || 'Upload vendor invoice (PDF, Image)'}
                  </p>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="cursor-pointer max-w-xs mx-auto"
                    onChange={handleFileSelect}
                  />
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-purple-600" />
                    <div className="text-left">
                      <p className="font-medium text-slate-900 truncate max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setExtractedData(null);
                      setExtractionError(null);
                    }}
                  >
                    {t('change_file') || 'Change file'}
                  </Button>
                </div>
              )}
            </div>

            {/* Extraction Error */}
            {extractionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {extractionError}
                </p>
              </div>
            )}

            {/* Extracted Data Preview */}
            {extractedData?.extracted_data && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-green-800 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  {t('data_extracted') || 'Data extracted successfully'}
                  {extractedData.extracted_data.confidence > 0 && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 ml-auto">
                      {Math.round(extractedData.extracted_data.confidence * 100)}% {t('confidence') || 'confidence'}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">{t('vendor')}:</span>
                    <span className="ml-2 font-medium">{extractedData.extracted_data.vendor_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('invoice_number')}:</span>
                    <span className="ml-2 font-medium">{extractedData.extracted_data.invoice_number || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('invoice_date')}:</span>
                    <span className="ml-2 font-medium">{extractedData.extracted_data.invoice_date || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('due_date')}:</span>
                    <span className="ml-2 font-medium">{extractedData.extracted_data.due_date || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('subtotal')}:</span>
                    <span className="ml-2 font-medium">
                      {extractedData.extracted_data.subtotal?.toLocaleString() || '0'} {extractedData.extracted_data.currency || 'UZS'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('total')}:</span>
                    <span className="ml-2 font-medium text-green-700">
                      {extractedData.extracted_data.total_amount?.toLocaleString() || '0'} {extractedData.extracted_data.currency || 'UZS'}
                    </span>
                  </div>
                </div>
                {extractedData.model === 'demo' && (
                  <p className="text-xs text-amber-600 mt-2">
                    {t('demo_mode_note') || 'Demo mode - Configure AI provider for real extraction'}
                  </p>
                )}
              </div>
            )}

            {/* Info Note */}
            {!extractedData && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{t('supported_formats') || 'Supported formats'}:</strong> PDF, PNG, JPG, JPEG, WebP
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowUploadModal(false)}
                className="flex-1"
                disabled={isExtracting}
              >
                {t('cancel')}
              </Button>
              {!extractedData ? (
                <Button
                  onClick={handleAIExtract}
                  disabled={!selectedFile || isExtracting}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('extracting') || 'Extracting...'}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      {t('extract_data') || 'Extract Data'}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleApplyExtractedData}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('use_extracted_data') || 'Use Extracted Data'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Bill Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('create_vendor_bill') || 'Create Vendor Bill'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('vendor')} *</label>
                <Select
                  value={newBill.partner_id}
                  onValueChange={(value) => setNewBill({...newBill, partner_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={vendorsLoading ? t('loading') : t('select_vendor') || 'Select vendor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-orange-500" />
                          {vendor.company_name || vendor.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('invoice_date')} *</label>
                <Input
                  type="date"
                  value={newBill.invoice_date}
                  onChange={(e) => setNewBill({...newBill, invoice_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('due_date')} *</label>
                <Input
                  type="date"
                  value={newBill.due_date}
                  onChange={(e) => setNewBill({...newBill, due_date: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('subtotal')} *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newBill.subtotal}
                  onChange={(e) => {
                    const subtotal = parseFloat(e.target.value) || 0;
                    const tax = subtotal * 0.1;
                    setNewBill({...newBill, subtotal, tax_amount: tax, total_amount: subtotal + tax});
                  }}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('tax') || 'Tax'}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newBill.tax_amount}
                  disabled
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('total')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newBill.total_amount}
                  disabled
                  className="font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1" disabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateBill}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !newBill.partner_id || !newBill.due_date}
              >
                {isSaving ? t('saving') || 'Saving...' : t('create_bill') || 'Create Bill'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        columns={importColumns}
        entityName={t('vendor_bill') || 'Vendor Bill'}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={filteredBills}
        columns={exportColumns}
        entityName="vendor_bills"
        title={t('vendor_bills') || 'Vendor Bills'}
      />

      {/* Print Preview Modal */}
      {selectedBill && (
        <PrintPreviewModal
          open={showPrintPreview}
          onClose={() => {
            setShowPrintPreview(false);
            setSelectedBill(null);
          }}
          config={generatePrintConfig(selectedBill)}
          filename={`vendor_bill_${selectedBill.id}`}
        />
      )}

      {/* Batch Print Modal */}
      <BatchPrintModal
        open={showBatchPrint}
        onClose={() => setShowBatchPrint(false)}
        documents={filteredBills.map(b => ({
          id: b.id,
          name: b.invoice_number || `VB-${b.id}`,
          number: b.invoice_number,
          date: b.invoice_date ? format(new Date(b.invoice_date), 'dd.MM.yyyy') : '',
        }))}
        generateConfig={generatePrintConfig}
        entityName={t('invoice') || 'Invoice'}
      />

      {/* Debit Note Modal */}
      <Dialog open={showDebitNoteModal} onOpenChange={setShowDebitNoteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              {t('create_debit_note')}
            </DialogTitle>
          </DialogHeader>
          {debitNoteBill && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('invoice_number')}:</span>
                  <span className="font-medium">{debitNoteBill.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('vendor')}:</span>
                  <span className="font-medium">{debitNoteBill.partner_name || debitNoteBill.vendor_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('amount')}:</span>
                  <span className="font-semibold">{formatCurrency(debitNoteBill.total_amount || 0)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('debit_note_reason') || 'Reason'} *</Label>
                <Textarea
                  value={debitNoteReason}
                  onChange={(e) => setDebitNoteReason(e.target.value)}
                  placeholder={t('debit_note_reason_placeholder') || 'Enter reason for debit note...'}
                  rows={3}
                />
              </div>
              <p className="text-xs text-slate-500">
                {t('debit_note_description') || 'A full debit note will be created for the total bill amount. Confirm it later to post GL entries and reduce vendor balance.'}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowDebitNoteModal(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleDebitNoteSubmit}
                  disabled={!debitNoteReason.trim() || isSaving}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isSaving ? t('creating') || 'Creating...' : t('create_debit_note')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bill Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--genix-purple)]" />
              {selectedBill?.invoice_type === 'debit_note' ? (t('debit_note_details') || 'Debit Note Details') : (t('bill_details') || 'Bill Details')}
            </DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm text-slate-500">{t('invoice_number')}</p>
                  <p className="text-lg font-bold text-slate-900 font-mono">{selectedBill.invoice_number}</p>
                </div>
                <Badge className={getStatusColor(selectedBill.status)}>
                  {t(selectedBill.status) || selectedBill.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('vendor')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedBill.partner_name || selectedBill.vendor_name || '-'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('total')}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatCurrency(selectedBill.total_amount || 0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('invoice_date')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedBill.invoice_date
                      ? format(new Date(selectedBill.invoice_date), 'dd.MM.yyyy', { locale: dateLocale })
                      : '-'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('due_date')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedBill.due_date
                      ? format(new Date(selectedBill.due_date), 'dd.MM.yyyy', { locale: dateLocale })
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('subtotal')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(selectedBill.subtotal || 0)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('tax')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(selectedBill.tax_amount || 0)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('amount_due')}</p>
                  <p className="text-sm font-semibold text-red-600">
                    {formatCurrency(selectedBill.amount_due || 0)}
                  </p>
                </div>
              </div>

              {(selectedBill.purchase_order_number || selectedBill.goods_receipt_number) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">{t('po_reference') || 'PO Reference'}</p>
                    <p className="text-sm font-semibold text-blue-800 font-mono">
                      {selectedBill.purchase_order_number || '-'}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">{t('gr_reference') || 'GR Reference'}</p>
                    <p className="text-sm font-semibold text-purple-800 font-mono">
                      {selectedBill.goods_receipt_number || '-'}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">{t('three_way_match')}</p>
                <Badge className={getMatchStatusColor(selectedBill.three_way_match_status || 'not_applicable')}>
                  {t(selectedBill.three_way_match_status || 'not_applicable') || selectedBill.three_way_match_status || 'N/A'}
                </Badge>
              </div>

              {selectedBill.invoice_type === 'debit_note' && selectedBill.reason && (
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('reason')}</p>
                  <p className="text-sm text-orange-700">{selectedBill.reason}</p>
                </div>
              )}

              {selectedBill.notes && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('notes')}</p>
                  <p className="text-sm text-slate-700">{selectedBill.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedBill.status === 'draft' && (
                  <>
                    <Button
                      onClick={async () => {
                        await postBill(selectedBill.id);
                        setSelectedBill({ ...selectedBill, status: 'posted' });
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {t('post') || 'Post'}
                    </Button>
                    <Button
                      onClick={() => {
                        approveBill(selectedBill.id);
                        setSelectedBill({ ...selectedBill, status: 'confirmed' });
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('confirm') || 'Confirm'}
                    </Button>
                  </>
                )}
                {(selectedBill.status === 'confirmed' || selectedBill.status === 'posted') && (
                  <Button
                    onClick={async () => {
                      await payBill(selectedBill.id);
                      setSelectedBill({ ...selectedBill, status: 'paid', amount_due: 0 });
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    {t('mark_as_paid') || 'Mark as Paid'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowPrintPreview(true);
                  }}
                  className="flex-1"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {t('print') || 'Print'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                >
                  {t('close')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
