import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, FileText, AlertTriangle, CheckCircle, Clock, DollarSign, Brain, Plus, Download, Printer, History, Repeat, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';

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

export default function AccountsPayable() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    vendorBills,
    createVendorBill,
    updateVendorBill,
    isLoading
  } = useFinancials();

  const [filteredBills, setFilteredBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
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

  // Export columns configuration
  const exportColumns = [
    { key: 'invoice_number', label: 'Hisob-faktura raqami' },
    { key: 'partner_id', label: 'Yetkazib beruvchi' },
    { key: 'invoice_date', label: 'Sana', render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'due_date', label: "To'lov muddati", render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'total_amount', label: 'Summa', render: (v) => `${(v || 0).toLocaleString()} UZS` },
    { key: 'status', label: 'Holat' },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'partner_id', label: 'Yetkazib beruvchi', required: true },
    { key: 'invoice_date', label: 'Sana', required: true },
    { key: 'due_date', label: "To'lov muddati", required: true },
    { key: 'subtotal', label: 'Summa', required: true },
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

  const handleCreateBill = () => {
    const billData = {
      partner_id: newBill.partner_id,
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

    const created = createVendorBill(billData);
    addAuditLog('create', created?.id || 'new', newBill.partner_id);
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
    title: 'Yetkazib beruvchi hisob-fakturasi',
    documentNumber: bill.invoice_number || `VB-${bill.id}`,
    documentDate: bill.invoice_date ? format(new Date(bill.invoice_date), 'dd.MM.yyyy') : '',
    headerFields: [
      { label: 'Yetkazib beruvchi', value: bill.partner_id },
      { label: "To'lov muddati", value: bill.due_date ? format(new Date(bill.due_date), 'dd.MM.yyyy') : '-' },
      { label: 'Holat', value: bill.status },
    ],
    tableColumns: [
      { key: 'description', label: 'Tavsif' },
      { key: 'amount', label: 'Summa', align: 'right' },
    ],
    tableData: [
      { description: 'Asosiy summa', amount: `${(bill.subtotal || 0).toLocaleString()} UZS` },
      { description: 'Soliq (12%)', amount: `${(bill.tax_amount || 0).toLocaleString()} UZS` },
    ],
    totals: [
      { label: 'Jami', value: `${(bill.total_amount || 0).toLocaleString()} UZS`, bold: true },
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
            Hisob-fakturalar
          </TabsTrigger>
          <TabsTrigger value="recurring" className="data-[state=active]:bg-blue-50">
            <Repeat className="w-4 h-4 mr-2" />
            Qaytariladigan
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-blue-50">
            <History className="w-4 h-4 mr-2" />
            Tarix
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
                      Chop etish
                    </Button>
                    <Button variant="outline" onClick={() => setShowUploadModal(true)}>
                      <Upload className="w-4 h-4 mr-2" /> {t('upload_invoice')}
                    </Button>
                    <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                      <Plus className="w-4 h-4 mr-2" /> {t('new_entry')}
                    </Button>
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
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_status')}</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="confirmed">{t('confirmed')}</SelectItem>
                      <SelectItem value="paid">{t('paid')}</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
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
              <Button onClick={() => setShowCreateModal(true)} className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-2" /> {t('create_first_bill')}
              </Button>
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
                      <TableCell className="font-medium">{bill.partner_id}</TableCell>
                      <TableCell className="text-sm">
                        {bill.invoice_date ? format(new Date(bill.invoice_date), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {bill.due_date ? format(new Date(bill.due_date), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="font-semibold">${(bill.total_amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(bill.status)}>{bill.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getMatchStatusColor(bill.three_way_match_status || 'not_applicable')}>
                          {bill.three_way_match_status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBill(bill);
                              setShowPrintPreview(true);
                            }}
                            title="Ko'rish va chop etish"
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
            entityName="To'lov"
            fields={[
              { key: 'partner_id', label: 'Yetkazib beruvchi', required: true },
              { key: 'amount', label: 'Summa', type: 'number', required: true },
              { key: 'description', label: 'Tavsif' },
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
          <AuditTrailPanel entityType="vendor_bills" title="Yetkazib beruvchi hisob-fakturalari tarixi" />
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              AI-Powered Invoice Upload
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-sm text-slate-600 mb-4">
                Upload vendor invoice (PDF, Image)
                <br />
                AI will automatically extract all data
              </p>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="cursor-pointer"
              />
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> AI extraction will be available when connected to the backend.
                For now, please use manual entry.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Bill Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Vendor Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice Number (Optional)</label>
                <Input
                  placeholder="Auto-generated"
                  value={newBill.invoice_number}
                  onChange={(e) => setNewBill({...newBill, invoice_number: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Vendor *</label>
                <Input
                  placeholder="Vendor name"
                  value={newBill.partner_id}
                  onChange={(e) => setNewBill({...newBill, partner_id: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice Date *</label>
                <Input
                  type="date"
                  value={newBill.invoice_date}
                  onChange={(e) => setNewBill({...newBill, invoice_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Due Date *</label>
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
                <label className="text-sm font-medium mb-1 block">Subtotal *</label>
                <Input
                  type="number"
                  placeholder="0.00"
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
                <label className="text-sm font-medium mb-1 block">Tax</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newBill.tax_amount}
                  disabled
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Total</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newBill.total_amount}
                  disabled
                  className="font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateBill}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={!newBill.partner_id || !newBill.due_date}
              >
                Create Bill
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
        entityName="Yetkazib beruvchi hisob-fakturasi"
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={filteredBills}
        columns={exportColumns}
        entityName="Yetkazib_beruvchi_hisob_fakturalari"
        title="Yetkazib beruvchi hisob-fakturalari"
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
        entityName="Hisob_faktura"
      />

    </div>
  );
}
