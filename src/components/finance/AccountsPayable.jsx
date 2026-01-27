import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, FileText, AlertTriangle, CheckCircle, Clock, DollarSign, Brain, Plus, Download, Printer, History, Repeat, Eye, Building2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';
import { contactsService, aiService } from '@/api/services';

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
  AuditTrailPanel,
  AttachmentsCommentsCard,
  RecurringPanel,
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
  const dateLocale = getDateLocale(language);
  const {
    vendorBills,
    createVendorBill,
    updateVendorBill,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete } = useEmployeePermissions();

  const [filteredBills, setFilteredBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
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

  // Load vendors when create modal opens
  useEffect(() => {
    if (showCreateModal && vendors.length === 0) {
      setVendorsLoading(true);
      contactsService.list({ contact_type: 'vendor' })
        .then(data => {
          // Include all contacts as potential vendors
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
    { key: 'partner_id', label: t('vendor') || 'Vendor' },
    { key: 'invoice_date', label: t('date') || 'Date', render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'due_date', label: t('due_date') || 'Due Date', render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'total_amount', label: t('amount') || 'Amount', render: (v) => `${(v || 0).toLocaleString()} UZS` },
    { key: 'status', label: t('status') || 'Status' },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'partner_id', label: t('vendor') || 'Vendor', required: true },
    { key: 'invoice_date', label: t('date') || 'Date', required: true },
    { key: 'due_date', label: t('due_date') || 'Due Date', required: true },
    { key: 'subtotal', label: t('amount') || 'Amount', required: true },
  ];

  useEffect(() => {
    setFilteredBills(vendorBills);
  }, [vendorBills]);

  useEffect(() => {
    let filtered = vendorBills;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(b =>
        b.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.partner_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBills(filtered);
  }, [vendorBills, searchQuery, statusFilter]);

  const handleCreateBill = async () => {
    setIsSaving(true);
    try {
      // Get selected vendor info
      const selectedVendor = vendors.find(v => v.id === newBill.partner_id);

      const billData = {
        partner_id: newBill.partner_id, // UUID of the vendor
        vendor_id: newBill.partner_id,  // Backend expects vendor_id
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

  const payBill = (billId) => {
    const bill = vendorBills.find(b => b.id === billId);
    updateVendorBill(billId, {
      status: 'paid',
      amount_paid: bill.total_amount,
      amount_due: 0
    });
    addAuditLog('status_change', billId, 'Vendor Bill', { oldStatus: 'confirmed', newStatus: 'paid' });
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

  const generatePrintConfig = (bill) => ({
    template: 'invoice',
    title: t('vendor_bill') || 'Vendor Bill',
    documentNumber: bill.invoice_number || `VB-${bill.id}`,
    documentDate: bill.invoice_date ? format(new Date(bill.invoice_date), 'dd.MM.yyyy') : '',
    headerFields: [
      { label: t('vendor') || 'Vendor', value: bill.partner_id },
      { label: t('due_date') || 'Due Date', value: bill.due_date ? format(new Date(bill.due_date), 'dd.MM.yyyy') : '-' },
      { label: t('status') || 'Status', value: bill.status },
    ],
    tableColumns: [
      { key: 'description', label: t('description') || 'Description' },
      { key: 'amount', label: t('amount') || 'Amount', align: 'right' },
    ],
    tableData: [
      { description: t('subtotal') || 'Subtotal', amount: `${(bill.subtotal || 0).toLocaleString()} UZS` },
      { description: t('tax') + ' (12%)' || 'Tax (12%)', amount: `${(bill.tax_amount || 0).toLocaleString()} UZS` },
    ],
    totals: [
      { label: t('total') || 'Total', value: `${(bill.total_amount || 0).toLocaleString()} UZS`, bold: true },
    ],
  });

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      paid: 'bg-green-100 text-green-800 border-green-200',
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

  // Calculate metrics
  const metrics = {
    totalPayable: vendorBills.reduce((sum, b) => sum + (b.amount_due || 0), 0),
    overdueBills: vendorBills.filter(b => {
      if (!b.due_date || b.status === 'paid') return false;
      return new Date(b.due_date) < new Date();
    }).length,
    pendingApproval: vendorBills.filter(b => b.status === 'draft').length,
    aiExtracted: vendorBills.filter(b => b.ai_extracted).length
  };

  return (
    <div className="space-y-6">

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">${metrics.totalPayable.toLocaleString()}</p>
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

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-900">{metrics.aiExtracted}</p>
            <p className="text-sm text-slate-600">{t('ai_extracted')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Bills, Recurring, Audit */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/80 backdrop-blur-sm border border-slate-200/60">
          <TabsTrigger value="list" className="data-[state=active]:bg-blue-50">
            <FileText className="w-4 h-4 mr-2" />
            {t('invoices') || 'Invoices'}
          </TabsTrigger>
          <TabsTrigger value="recurring" className="data-[state=active]:bg-blue-50">
            <Repeat className="w-4 h-4 mr-2" />
            {t('recurring') || 'Recurring'}
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-blue-50">
            <History className="w-4 h-4 mr-2" />
            {t('history') || 'History'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
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
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('due_date')}</TableHead>
                    <TableHead>{t('amount')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('three_way_match')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill) => (
                    <TableRow key={bill.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {bill.invoice_number}
                          {bill.ai_extracted && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                              <Brain className="w-3 h-3 mr-1" />
                              AI
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{bill.partner_name || bill.vendor_name || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {bill.invoice_date ? format(new Date(bill.invoice_date), 'dd MMM yyyy', { locale: dateLocale }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {bill.due_date ? format(new Date(bill.due_date), 'dd MMM yyyy', { locale: dateLocale }) : '-'}
                      </TableCell>
                      <TableCell className="font-semibold">${(bill.total_amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(bill.status)}>{t(bill.status) || bill.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getMatchStatusColor(bill.three_way_match_status || 'not_applicable')}>
                          {t(bill.three_way_match_status) || bill.three_way_match_status || 'N/A'}
                        </Badge>
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
                          {bill.status === 'draft' && (
                            <Button size="sm" variant="ghost" onClick={() => approveBill(bill.id)}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {bill.status === 'confirmed' && (
                            <Button size="sm" variant="ghost" onClick={() => payBill(bill.id)}>
                              <DollarSign className="w-4 h-4" />
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
        </TabsContent>

        {/* Recurring Transactions Tab */}
        <TabsContent value="recurring">
          <RecurringPanel
            entityType="vendor_bills"
            entityName={t('payment') || 'Payment'}
            fields={[
              { key: 'partner_id', label: t('vendor') || 'Vendor', required: true },
              { key: 'amount', label: t('amount') || 'Amount', type: 'number', required: true },
              { key: 'description', label: t('description') || 'Description' },
            ]}
            onCreateTransaction={(data) => {
              const billData = {
                partner_id: data.partner_id,
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                subtotal: parseFloat(data.amount) || 0,
                tax_amount: (parseFloat(data.amount) || 0) * 0.12,
                total_amount: (parseFloat(data.amount) || 0) * 1.12,
                amount_due: (parseFloat(data.amount) || 0) * 1.12,
                amount_paid: 0,
                status: 'draft',
                description: data.description,
              };
              createVendorBill(billData);
            }}
          />
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit">
          <AuditTrailPanel entityType="vendor_bills" title={t('vendor_bills_history') || 'Vendor Bills History'} />
        </TabsContent>
      </Tabs>

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
              <Brain className="w-5 h-5 text-purple-600" />
              {t('ai_invoice_scan') || 'AI Invoice Scan'}
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
                    <br />
                    <span className="text-purple-600 font-medium">
                      {t('ai_will_extract') || 'AI will automatically extract all data'}
                    </span>
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
                      <Brain className="w-4 h-4 mr-2" />
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
                <label className="text-sm font-medium mb-1 block">{t('invoice_number_optional') || 'Invoice Number (Optional)'}</label>
                <Input
                  placeholder={t('auto_generated') || 'Auto-generated'}
                  value={newBill.invoice_number}
                  onChange={(e) => setNewBill({...newBill, invoice_number: e.target.value})}
                />
              </div>
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

      {/* Bill Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--genix-purple)]" />
              {t('bill_details') || 'Bill Details'}
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
                    ${(selectedBill.total_amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('invoice_date')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedBill.invoice_date
                      ? format(new Date(selectedBill.invoice_date), 'dd MMM yyyy', { locale: dateLocale })
                      : '-'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('due_date')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedBill.due_date
                      ? format(new Date(selectedBill.due_date), 'dd MMM yyyy', { locale: dateLocale })
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('subtotal')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    ${(selectedBill.subtotal || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('tax')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    ${(selectedBill.tax_amount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('amount_due')}</p>
                  <p className="text-sm font-semibold text-red-600">
                    ${(selectedBill.amount_due || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">{t('three_way_match')}</p>
                <Badge className={getMatchStatusColor(selectedBill.three_way_match_status || 'not_applicable')}>
                  {t(selectedBill.three_way_match_status) || selectedBill.three_way_match_status || 'N/A'}
                </Badge>
              </div>

              {selectedBill.notes && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('notes')}</p>
                  <p className="text-sm text-slate-700">{selectedBill.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedBill.status === 'draft' && (
                  <Button
                    onClick={() => {
                      approveBill(selectedBill.id);
                      setSelectedBill({ ...selectedBill, status: 'confirmed' });
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('approve') || 'Approve'}
                  </Button>
                )}
                {selectedBill.status === 'confirmed' && (
                  <Button
                    onClick={() => {
                      payBill(selectedBill.id);
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
