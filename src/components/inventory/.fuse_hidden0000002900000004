import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, ArrowRightLeft, Building2, Filter,
  CheckCircle, Clock, Truck, Package, Eye, Trash2,
  HelpCircle, Banknote, ArrowRight, X, Check, Send
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCompany } from "@/components/contexts/CompanyContext";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";
import { intercompanyService, inventoryService } from "@/api/services";
import { toast } from "sonner";

// Status badge colors
const STATUS_CONFIG = {
  draft: { color: 'bg-slate-100 text-slate-700', icon: Clock },
  pending_approval: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { color: 'bg-blue-100 text-blue-700', icon: Check },
  in_transit: { color: 'bg-purple-100 text-purple-700', icon: Truck },
  received: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  invoiced: { color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
  settled: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  cancelled: { color: 'bg-red-100 text-red-700', icon: X },
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

// Field Help Component
const FieldHelp = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs bg-slate-800 text-white p-2 rounded-lg shadow-lg">
      <p>{text}</p>
    </TooltipContent>
  </Tooltip>
);

// Label with help tooltip
const LabelWithHelp = ({ label, helpText, required }) => (
  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center">
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

export default function IntercompanyTransfers() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { companies, activeCompany } = useCompany();
  const { products, warehouses } = useInventory();

  // State
  const [activeTab, setActiveTab] = useState('transfers');
  const [transfers, setTransfers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [balances, setBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    from_organization_id: '',
    to_organization_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    pricing_method: 'cost',
    markup_percent: 0,
    reason: '',
    notes: '',
    lines: [{ product_id: '', quantity: 1, transfer_price: 0, notes: '' }]
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    from_organization_id: '',
    to_organization_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference: '',
    description: '',
    notes: ''
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'transfers') {
        const result = await intercompanyService.listTransfers();
        setTransfers(result.data || []);
      } else if (activeTab === 'payments') {
        const result = await intercompanyService.listPayments();
        setPayments(result.data || []);
      } else if (activeTab === 'balances') {
        const result = await intercompanyService.getBalances();
        setBalances(result || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error(t('error_loading_data'));
    } finally {
      setIsLoading(false);
    }
  };

  // Get filtered warehouses by organization
  const getWarehousesByOrg = (orgId) => {
    if (!orgId) return [];
    return warehouses.filter(w => w.organization_id === orgId || !w.organization_id);
  };

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(transfer => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!transfer.transfer_number?.toLowerCase().includes(query) &&
            !transfer.from_organization_name?.toLowerCase().includes(query) &&
            !transfer.to_organization_name?.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (statusFilter !== 'all' && transfer.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [transfers, searchQuery, statusFilter]);

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!payment.payment_number?.toLowerCase().includes(query) &&
            !payment.from_organization_name?.toLowerCase().includes(query) &&
            !payment.to_organization_name?.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (statusFilter !== 'all' && payment.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [payments, searchQuery, statusFilter]);

  // Create transfer
  const handleCreateTransfer = async () => {
    if (!transferForm.from_organization_id || !transferForm.to_organization_id) {
      toast.error(t('select_both_organizations'));
      return;
    }
    if (transferForm.from_organization_id === transferForm.to_organization_id) {
      toast.error(t('organizations_must_be_different'));
      return;
    }
    if (!transferForm.from_warehouse_id || !transferForm.to_warehouse_id) {
      toast.error(t('select_both_warehouses'));
      return;
    }
    if (transferForm.lines.length === 0 || !transferForm.lines[0].product_id) {
      toast.error(t('add_at_least_one_product'));
      return;
    }

    setIsSaving(true);
    try {
      await intercompanyService.createTransfer(transferForm);
      toast.success(t('transfer_created'));
      setShowTransferModal(false);
      resetTransferForm();
      loadData();
    } catch (error) {
      console.error('Failed to create transfer:', error);
      toast.error(error.response?.data?.error || t('error_creating_transfer'));
    } finally {
      setIsSaving(false);
    }
  };

  // Create payment
  const handleCreatePayment = async () => {
    if (!paymentForm.from_organization_id || !paymentForm.to_organization_id) {
      toast.error(t('select_both_organizations'));
      return;
    }
    if (paymentForm.from_organization_id === paymentForm.to_organization_id) {
      toast.error(t('organizations_must_be_different'));
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error(t('enter_valid_amount'));
      return;
    }

    setIsSaving(true);
    try {
      await intercompanyService.createPayment({
        ...paymentForm,
        amount: parseFloat(paymentForm.amount)
      });
      toast.success(t('payment_created'));
      setShowPaymentModal(false);
      resetPaymentForm();
      loadData();
    } catch (error) {
      console.error('Failed to create payment:', error);
      toast.error(error.response?.data?.error || t('error_creating_payment'));
    } finally {
      setIsSaving(false);
    }
  };

  // Transfer actions
  const handleApproveTransfer = async (id) => {
    try {
      await intercompanyService.approveTransfer(id);
      toast.success(t('transfer_approved'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('error_approving_transfer'));
    }
  };

  const handleShipTransfer = async (id) => {
    try {
      await intercompanyService.shipTransfer(id);
      toast.success(t('transfer_shipped'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('error_shipping_transfer'));
    }
  };

  const handleReceiveTransfer = async (id) => {
    try {
      await intercompanyService.receiveTransfer(id);
      toast.success(t('transfer_received'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('error_receiving_transfer'));
    }
  };

  const handleDeleteTransfer = async (id) => {
    if (!confirm(t('confirm_delete_transfer'))) return;
    try {
      await intercompanyService.deleteTransfer(id);
      toast.success(t('transfer_deleted'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('error_deleting_transfer'));
    }
  };

  // Payment actions
  const handleApprovePayment = async (id) => {
    try {
      await intercompanyService.approvePayment(id);
      toast.success(t('payment_approved'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('error_approving_payment'));
    }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm(t('confirm_delete_payment'))) return;
    try {
      await intercompanyService.deletePayment(id);
      toast.success(t('payment_deleted'));
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('error_deleting_payment'));
    }
  };

  // View transfer detail
  const handleViewTransfer = async (id) => {
    try {
      const detail = await intercompanyService.getTransfer(id);
      setSelectedItem({ ...detail, type: 'transfer' });
      setShowDetailModal(true);
    } catch (error) {
      toast.error(t('error_loading_details'));
    }
  };

  // Reset forms
  const resetTransferForm = () => {
    setTransferForm({
      from_organization_id: '',
      to_organization_id: '',
      from_warehouse_id: '',
      to_warehouse_id: '',
      transfer_date: new Date().toISOString().split('T')[0],
      expected_date: '',
      pricing_method: 'cost',
      markup_percent: 0,
      reason: '',
      notes: '',
      lines: [{ product_id: '', quantity: 1, transfer_price: 0, notes: '' }]
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      from_organization_id: '',
      to_organization_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      reference: '',
      description: '',
      notes: ''
    });
  };

  // Add/remove transfer lines
  const addTransferLine = () => {
    setTransferForm(prev => ({
      ...prev,
      lines: [...prev.lines, { product_id: '', quantity: 1, transfer_price: 0, notes: '' }]
    }));
  };

  const removeTransferLine = (index) => {
    setTransferForm(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateTransferLine = (index, field, value) => {
    setTransferForm(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line)
    }));
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amount || 0);
  };

  // Get status badge
  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status?.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              {t('intercompany_transfers') || 'Inter-Company Transfers'}
            </h1>
            <p className="text-slate-500 mt-1">
              {t('intercompany_transfers_desc') || 'Transfer products and money between companies'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="transfers" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('product_transfers') || 'Product Transfers'}
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              {t('money_transfers') || 'Money Transfers'}
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              {t('balances') || 'Balances'}
            </TabsTrigger>
          </TabsList>

          {/* Product Transfers Tab */}
          <TabsContent value="transfers" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{t('product_transfers') || 'Product Transfers'}</CardTitle>
                  {canCreate(MODULES.INVENTORY) && (
                    <Button onClick={() => setShowTransferModal(true)} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {t('new_transfer') || 'New Transfer'}
                    </Button>
                  )}
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={t('search_transfers') || 'Search transfers...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t('status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_statuses') || 'All Statuses'}</SelectItem>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="approved">{t('approved')}</SelectItem>
                      <SelectItem value="in_transit">{t('in_transit') || 'In Transit'}</SelectItem>
                      <SelectItem value="received">{t('received')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('transfer_number') || 'Transfer #'}</TableHead>
                      <TableHead>{t('from_company') || 'From Company'}</TableHead>
                      <TableHead>{t('to_company') || 'To Company'}</TableHead>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead className="text-right">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('total_amount') || 'Total'}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          {t('loading')}...
                        </TableCell>
                      </TableRow>
                    ) : filteredTransfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          {t('no_transfers_found') || 'No transfers found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransfers.map((transfer) => (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-medium">{transfer.transfer_number}</TableCell>
                          <TableCell>{transfer.from_organization_name}</TableCell>
                          <TableCell>{transfer.to_organization_name}</TableCell>
                          <TableCell>{format(new Date(transfer.transfer_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(transfer.total_quantity)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(transfer.total_amount)}</TableCell>
                          <TableCell><StatusBadge status={transfer.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewTransfer(transfer.id)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {transfer.status === 'draft' && canUpdate(MODULES.INVENTORY) && (
                                <Button variant="ghost" size="sm" onClick={() => handleApproveTransfer(transfer.id)}>
                                  <Check className="w-4 h-4 text-blue-600" />
                                </Button>
                              )}
                              {transfer.status === 'approved' && canUpdate(MODULES.INVENTORY) && (
                                <Button variant="ghost" size="sm" onClick={() => handleShipTransfer(transfer.id)}>
                                  <Send className="w-4 h-4 text-purple-600" />
                                </Button>
                              )}
                              {transfer.status === 'in_transit' && canUpdate(MODULES.INVENTORY) && (
                                <Button variant="ghost" size="sm" onClick={() => handleReceiveTransfer(transfer.id)}>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                              {transfer.status === 'draft' && canDelete(MODULES.INVENTORY) && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteTransfer(transfer.id)}>
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Money Transfers Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{t('money_transfers') || 'Money Transfers'}</CardTitle>
                  {canCreate(MODULES.FINANCIALS) && (
                    <Button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {t('new_payment') || 'New Payment'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('payment_number') || 'Payment #'}</TableHead>
                      <TableHead>{t('from_company') || 'From Company'}</TableHead>
                      <TableHead>{t('to_company') || 'To Company'}</TableHead>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead className="text-right">{t('amount')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          {t('loading')}...
                        </TableCell>
                      </TableRow>
                    ) : filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          {t('no_payments_found') || 'No payments found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.payment_number}</TableCell>
                          <TableCell>{payment.from_organization_name}</TableCell>
                          <TableCell>{payment.to_organization_name}</TableCell>
                          <TableCell>{format(new Date(payment.payment_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(payment.amount)} {payment.currency_code}
                          </TableCell>
                          <TableCell><StatusBadge status={payment.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {payment.status === 'draft' && canUpdate(MODULES.FINANCIALS) && (
                                <Button variant="ghost" size="sm" onClick={() => handleApprovePayment(payment.id)}>
                                  <Check className="w-4 h-4 text-blue-600" />
                                </Button>
                              )}
                              {payment.status === 'draft' && canDelete(MODULES.FINANCIALS) && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(payment.id)}>
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balances Tab */}
          <TabsContent value="balances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('intercompany_balances') || 'Inter-Company Balances'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('organization')}</TableHead>
                      <TableHead>{t('partner_organization') || 'Partner'}</TableHead>
                      <TableHead className="text-right">{t('receivable')}</TableHead>
                      <TableHead className="text-right">{t('payable')}</TableHead>
                      <TableHead className="text-right">{t('net_balance') || 'Net Balance'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          {t('loading')}...
                        </TableCell>
                      </TableRow>
                    ) : balances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          {t('no_balances_found') || 'No balances found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      balances.map((balance, index) => (
                        <TableRow key={index}>
                          <TableCell>{balance.organization_name}</TableCell>
                          <TableCell>{balance.partner_organization_name}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(balance.receivable)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(balance.payable)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${balance.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(balance.net_balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Transfer Modal */}
        <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                {t('new_product_transfer') || 'New Product Transfer'}
              </DialogTitle>
              <DialogDescription>
                {t('transfer_products_between_companies') || 'Transfer products between companies'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Organizations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('from_company') || 'From Company'}
                    helpText={t('source_company_help') || 'Company sending the products'}
                    required
                  />
                  <Select
                    value={transferForm.from_organization_id}
                    onValueChange={(v) => setTransferForm(prev => ({ ...prev, from_organization_id: v, from_warehouse_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHelp
                    label={t('to_company') || 'To Company'}
                    helpText={t('destination_company_help') || 'Company receiving the products'}
                    required
                  />
                  <Select
                    value={transferForm.to_organization_id}
                    onValueChange={(v) => setTransferForm(prev => ({ ...prev, to_organization_id: v, to_warehouse_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.filter(c => c.id !== transferForm.from_organization_id).map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Warehouses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp label={t('from_warehouse')} required />
                  <Select
                    value={transferForm.from_warehouse_id}
                    onValueChange={(v) => setTransferForm(prev => ({ ...prev, from_warehouse_id: v }))}
                    disabled={!transferForm.from_organization_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_warehouse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {getWarehousesByOrg(transferForm.from_organization_id).map(wh => (
                        <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHelp label={t('to_warehouse')} required />
                  <Select
                    value={transferForm.to_warehouse_id}
                    onValueChange={(v) => setTransferForm(prev => ({ ...prev, to_warehouse_id: v }))}
                    disabled={!transferForm.to_organization_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_warehouse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {getWarehousesByOrg(transferForm.to_organization_id).map(wh => (
                        <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp label={t('transfer_date')} required />
                  <Input
                    type="date"
                    value={transferForm.transfer_date}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, transfer_date: e.target.value }))}
                  />
                </div>
                <div>
                  <LabelWithHelp label={t('expected_date')} />
                  <Input
                    type="date"
                    value={transferForm.expected_date}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, expected_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Products */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <LabelWithHelp label={t('products')} required />
                  <Button type="button" variant="outline" size="sm" onClick={addTransferLine}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_product')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {transferForm.lines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <Select
                        value={line.product_id}
                        onValueChange={(v) => updateTransferLine(index, 'product_id', v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t('select_product')} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.code} - {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder={t('quantity')}
                        value={line.quantity}
                        onChange={(e) => updateTransferLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-24"
                        min="0.01"
                        step="0.01"
                      />
                      {transferForm.lines.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeTransferLine(index)}>
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason/Notes */}
              <div>
                <LabelWithHelp label={t('reason')} />
                <Textarea
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={t('transfer_reason_placeholder') || 'Reason for transfer...'}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowTransferModal(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleCreateTransfer} disabled={isSaving}>
                {isSaving ? t('creating') : t('create_transfer') || 'Create Transfer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                {t('new_money_transfer') || 'New Money Transfer'}
              </DialogTitle>
              <DialogDescription>
                {t('transfer_money_between_companies') || 'Transfer money between companies'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp label={t('from_company')} required />
                  <Select
                    value={paymentForm.from_organization_id}
                    onValueChange={(v) => setPaymentForm(prev => ({ ...prev, from_organization_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHelp label={t('to_company')} required />
                  <Select
                    value={paymentForm.to_organization_id}
                    onValueChange={(v) => setPaymentForm(prev => ({ ...prev, to_organization_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.filter(c => c.id !== paymentForm.from_organization_id).map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp label={t('amount')} required />
                  <Input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <div>
                  <LabelWithHelp label={t('payment_date')} required />
                  <Input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <LabelWithHelp label={t('payment_method')} />
                <Select
                  value={paymentForm.payment_method}
                  onValueChange={(v) => setPaymentForm(prev => ({ ...prev, payment_method: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">{t('bank_transfer') || 'Bank Transfer'}</SelectItem>
                    <SelectItem value="cash">{t('cash')}</SelectItem>
                    <SelectItem value="internal_transfer">{t('internal_transfer') || 'Internal Transfer'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <LabelWithHelp label={t('reference')} />
                <Input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder={t('reference_placeholder') || 'Reference number...'}
                />
              </div>

              <div>
                <LabelWithHelp label={t('description')} />
                <Textarea
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('payment_description_placeholder') || 'Payment description...'}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleCreatePayment} disabled={isSaving}>
                {isSaving ? t('creating') : t('create_payment') || 'Create Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transfer Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                {selectedItem?.transfer_number}
              </DialogTitle>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-slate-500">{t('from_company')}</span>
                    <p className="font-medium">{selectedItem.from_organization_name}</p>
                    <p className="text-sm text-slate-500">{selectedItem.from_warehouse_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">{t('to_company')}</span>
                    <p className="font-medium">{selectedItem.to_organization_name}</p>
                    <p className="text-sm text-slate-500">{selectedItem.to_warehouse_name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-slate-500">{t('date')}</span>
                    <p className="font-medium">{selectedItem.transfer_date}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">{t('status')}</span>
                    <div className="mt-1"><StatusBadge status={selectedItem.status} /></div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">{t('total')}</span>
                    <p className="font-medium">{formatCurrency(selectedItem.total_amount)}</p>
                  </div>
                </div>

                {selectedItem.lines && selectedItem.lines.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{t('products')}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('product')}</TableHead>
                          <TableHead className="text-right">{t('requested')}</TableHead>
                          <TableHead className="text-right">{t('shipped')}</TableHead>
                          <TableHead className="text-right">{t('received')}</TableHead>
                          <TableHead className="text-right">{t('price')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItem.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div className="font-medium">{line.product_name}</div>
                              <div className="text-xs text-slate-500">{line.product_code}</div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(line.quantity_requested)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(line.quantity_shipped)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(line.quantity_received)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(line.transfer_price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {selectedItem.reason && (
                  <div>
                    <span className="text-sm text-slate-500">{t('reason')}</span>
                    <p>{selectedItem.reason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
