import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, CreditCard, Calendar, DollarSign, CheckCircle, Clock,
  AlertCircle, ArrowUpRight, ArrowDownLeft, Building2, User, Wallet,
  Filter, Download, MoreHorizontal, Eye
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { contactsService } from "@/api/services";

export default function Payments() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const {
    payments,
    accounts,
    vendorBills,
    customerInvoices,
    createPayment,
    confirmPayment,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [activeTab, setActiveTab] = useState("customer");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [newPayment, setNewPayment] = useState({
    payment_type: 'inbound',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'USD',
    reference: '',
    description: '',
    contact_id: '',
    account_id: '',
    bill_id: '',
    invoice_id: '',
    invoice_party_name: '',
  });

  // Get unpaid vendor bills for bill selector
  const unpaidBills = vendorBills.filter(b =>
    b.status === 'posted' || b.status === 'confirmed' || b.status === 'draft'
  ).filter(b => (b.amount_due || b.total_amount || 0) > 0);

  // Get unpaid customer invoices for invoice selector
  const unpaidInvoices = (customerInvoices || []).filter(inv =>
    inv.status !== 'cancelled' && inv.status !== 'paid'
  ).filter(inv => ((inv.total_amount || 0) - (inv.amount_paid || 0)) > 0);

  // Load contacts when modal opens
  useEffect(() => {
    if (showCreateModal && contacts.length === 0) {
      setContactsLoading(true);
      contactsService.list()
        .then(data => {
          setContacts(data || []);
        })
        .catch(err => {
          console.error('Failed to load contacts:', err);
        })
        .finally(() => {
          setContactsLoading(false);
        });
    }
  }, [showCreateModal, contacts.length]);

  // Split payments by type
  const customerPayments = useMemo(() =>
    payments.filter(p => p.payment_type === 'inbound'), [payments]);
  const vendorPayments = useMemo(() =>
    payments.filter(p => p.payment_type === 'outbound'), [payments]);

  // Get current tab's payments
  const currentPayments = activeTab === 'customer' ? customerPayments : vendorPayments;

  // Filter payments
  const filteredPayments = useMemo(() => {
    let filtered = currentPayments;

    if (searchQuery) {
      filtered = filtered.filter(payment =>
        payment.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.party_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    return filtered;
  }, [currentPayments, searchQuery, statusFilter]);

  // Summary stats per tab
  const summaryStats = useMemo(() => {
    const tabPayments = currentPayments;
    return {
      totalAmount: tabPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      pendingCount: tabPayments.filter(p => p.status === 'draft' || p.status === 'pending').length,
      confirmedCount: tabPayments.filter(p => p.status === 'confirmed' || p.status === 'posted').length,
    };
  }, [currentPayments]);

  const handleOpenCreate = () => {
    setNewPayment({
      payment_type: activeTab === 'customer' ? 'inbound' : 'outbound',
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      amount: '',
      currency: 'USD',
      reference: '',
      description: '',
      contact_id: '',
      account_id: '',
      bill_id: '',
      invoice_id: '',
      invoice_party_name: '',
    });
    setShowCreateModal(true);
  };

  const handleCreatePayment = async () => {
    setIsSaving(true);
    try {
      const backendType = newPayment.payment_type === 'inbound' ? 'receipt' : 'payment';
      const selectedContact = contacts.find(c => c.id === newPayment.contact_id);

      // Build allocations array if linked to an invoice/bill
      const allocations = [];
      const paymentAmount = parseFloat(newPayment.amount) || 0;
      if (newPayment.bill_id) {
        allocations.push({
          document_type: 'purchase_invoice',
          document_id: newPayment.bill_id,
          amount: paymentAmount,
        });
      } else if (newPayment.invoice_id) {
        allocations.push({
          document_type: 'sales_invoice',
          document_id: newPayment.invoice_id,
          amount: paymentAmount,
        });
      }

      const paymentData = {
        type: backendType,
        contact_id: newPayment.contact_id,
        payment_date: newPayment.payment_date,
        amount: paymentAmount,
        reference: newPayment.reference,
        notes: newPayment.description,
        bank_account_id: newPayment.account_id || undefined,
        payment_type: newPayment.payment_type,
        payment_method: newPayment.payment_method,
        party_name: newPayment.invoice_party_name || selectedContact?.company_name || selectedContact?.contact_name || selectedContact?.name || '',
        allocations: allocations.length > 0 ? allocations : undefined,
      };

      await createPayment(paymentData);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating payment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPayment = (paymentId) => {
    confirmPayment(paymentId);
    if (selectedPayment?.id === paymentId) {
      setSelectedPayment({...selectedPayment, status: 'confirmed'});
    }
  };

  const handleViewDetail = (payment) => {
    setSelectedPayment(payment);
    setShowDetailModal(true);
  };

  // Pay an invoice directly from the invoices table
  const handlePayInvoice = (invoice, isCustomer) => {
    const amountDue = (invoice.total_amount || 0) - (invoice.amount_paid || 0);
    const contactId = isCustomer
      ? (invoice.customer_id || '')
      : (invoice.vendor_id || invoice.partner_id || '');
    const partyName = isCustomer
      ? (invoice.customer_name || '')
      : (invoice.partner_name || invoice.vendor_name || '');

    setNewPayment({
      payment_type: isCustomer ? 'inbound' : 'outbound',
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      amount: amountDue.toString(),
      currency: 'USD',
      reference: `${t('payment_for') || 'Payment for'} ${invoice.invoice_number}`,
      description: '',
      contact_id: contactId,
      account_id: '',
      bill_id: !isCustomer ? invoice.id : '',
      invoice_id: isCustomer ? invoice.id : '',
      invoice_party_name: partyName,
    });

    // Ensure contacts are loaded
    if (contacts.length === 0) {
      setContactsLoading(true);
      contactsService.list()
        .then(data => setContacts(data || []))
        .catch(err => console.error('Failed to load contacts:', err))
        .finally(() => setContactsLoading(false));
    }

    setShowCreateModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      confirmed: "bg-green-100 text-green-800 border-green-200",
      posted: "bg-green-100 text-green-800 border-green-200",
      draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
      pending: "bg-blue-100 text-blue-800 border-blue-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
      failed: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    const icons = {
      confirmed: CheckCircle,
      posted: CheckCircle,
      draft: Clock,
      pending: Clock,
      cancelled: AlertCircle,
      failed: AlertCircle
    };
    const Icon = icons[status] || Clock;
    return <Icon className="w-3 h-3" />;
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      bank_transfer: t('bank_transfer') || 'Bank Transfer',
      cash: t('cash') || 'Cash',
      check: t('check') || 'Check',
      credit_card: t('credit_card') || 'Credit Card',
      wire: t('wire_transfer') || 'Wire Transfer'
    };
    return labels[method] || method;
  };

  const bankAccounts = accounts.filter(a => a.is_bank_account || (a.category === 'asset' && a.code?.startsWith('1')));

  const isCustomerTab = activeTab === 'customer';

  // Payment status helpers for invoices/bills
  const getPaymentStatus = (inv) => {
    const paid = inv.amount_paid || 0;
    const total = inv.total_amount || 0;
    if (total <= 0) return 'unpaid';
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
  };

  const paymentStatusStyle = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    unpaid: 'bg-red-100 text-red-800',
  };

  const paymentStatusLabel = {
    paid: t('paid') || 'Paid',
    partial: t('partial') || 'Partial',
    unpaid: t('unpaid') || 'Unpaid',
  };

  const subTabClass = "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600";

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSearchQuery(''); setStatusFilter('all'); }}>
        <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
          <TabsTrigger value="customer" className={subTabClass}>
            <ArrowDownLeft className="w-4 h-4" />
            {t('customer_payments') || 'Customer Payments'}
          </TabsTrigger>
          <TabsTrigger value="vendor" className={subTabClass}>
            <ArrowUpRight className="w-4 h-4" />
            {t('vendor_payments') || 'Vendor Payments'}
          </TabsTrigger>
        </TabsList>

        {/* Both tabs share the same content structure */}
        <TabsContent value="customer">
          <PaymentContent />
        </TabsContent>
        <TabsContent value="vendor">
          <PaymentContent />
        </TabsContent>
      </Tabs>

      {/* Create Payment Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--genix-purple)]" />
              {isCustomerTab ? (t('receive_payment') || 'Receive Payment') : (t('make_payment') || 'Make Payment')}
            </DialogTitle>
            <DialogDescription>
              {isCustomerTab
                ? (t('record_customer_payment') || 'Record a payment received from a customer')
                : (t('record_vendor_payment') || 'Record a payment made to a vendor')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('payment_date')} *
                </label>
                <Input
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({...newPayment, payment_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('payment_method')} *
                </label>
                <Select
                  value={newPayment.payment_method}
                  onValueChange={(value) => setNewPayment({...newPayment, payment_method: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">{t('bank_transfer')}</SelectItem>
                    <SelectItem value="cash">{t('cash')}</SelectItem>
                    <SelectItem value="check">{t('check')}</SelectItem>
                    <SelectItem value="credit_card">{t('credit_card')}</SelectItem>
                    <SelectItem value="wire">{t('wire_transfer')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {isCustomerTab ? (t('customer') || 'Customer') : (t('vendor') || 'Vendor')} *
              </label>
              <Select
                value={newPayment.contact_id}
                onValueChange={(value) => setNewPayment({...newPayment, contact_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={contactsLoading ? t('loading') : t('select_contact')} />
                </SelectTrigger>
                <SelectContent>
                  {contacts
                    .filter(c => isCustomerTab ? c.contact_type === 'customer' : c.contact_type === 'vendor')
                    .map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          {isCustomerTab ? (
                            <User className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Building2 className="w-4 h-4 text-orange-500" />
                          )}
                          {contact.company_name || contact.contact_name || contact.name}
                        </div>
                      </SelectItem>
                    ))}
                  {contacts.filter(c => isCustomerTab ? c.contact_type === 'customer' : c.contact_type === 'vendor').length === 0 && !contactsLoading && (
                    contacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          {contact.contact_type === 'customer' ? (
                            <User className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Building2 className="w-4 h-4 text-orange-500" />
                          )}
                          {contact.company_name || contact.contact_name || contact.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Selector - Only show for customer payments */}
            {isCustomerTab && unpaidInvoices.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('apply_to_invoice') || 'Apply to Invoice'} ({t('optional') || 'Optional'})
                </label>
                <Select
                  value={newPayment.invoice_id || '__none__'}
                  onValueChange={(value) => {
                    if (value === '__none__') {
                      setNewPayment({...newPayment, invoice_id: ''});
                      return;
                    }
                    const selectedInv = unpaidInvoices.find(inv => inv.id === value);
                    if (selectedInv) {
                      const due = (selectedInv.total_amount || 0) - (selectedInv.amount_paid || 0);
                      setNewPayment({
                        ...newPayment,
                        invoice_id: value,
                        amount: due.toString(),
                        contact_id: selectedInv.customer_id || '',
                        reference: `${t('payment_for') || 'Payment for'} ${selectedInv.invoice_number}`,
                      });
                    } else {
                      setNewPayment({...newPayment, invoice_id: value});
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_invoice') || 'Select an invoice'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-slate-500">{t('no_specific_invoice') || 'No specific invoice'}</span>
                    </SelectItem>
                    {unpaidInvoices.map(inv => {
                      const due = (inv.total_amount || 0) - (inv.amount_paid || 0);
                      return (
                        <SelectItem key={inv.id} value={inv.id}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span className="font-mono text-sm">{inv.invoice_number}</span>
                            <span className="text-slate-500">
                              {inv.customer_name || '-'}
                            </span>
                            <span className="font-semibold text-red-600">
                              {formatCurrency(due)}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Bill Selector - Only show for vendor payments */}
            {!isCustomerTab && unpaidBills.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('apply_to_bill') || 'Apply to Bill'} ({t('optional') || 'Optional'})
                </label>
                <Select
                  value={newPayment.bill_id}
                  onValueChange={(value) => {
                    if (value === '__none__') {
                      setNewPayment({...newPayment, bill_id: ''});
                      return;
                    }
                    const selectedBill = unpaidBills.find(b => b.id === value);
                    if (selectedBill) {
                      setNewPayment({
                        ...newPayment,
                        bill_id: value,
                        amount: (selectedBill.amount_due || selectedBill.total_amount || 0).toString(),
                        contact_id: selectedBill.vendor_id || selectedBill.partner_id || '',
                        reference: `Payment for ${selectedBill.invoice_number}`,
                      });
                    } else {
                      setNewPayment({...newPayment, bill_id: value});
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_bill') || 'Select a bill to pay'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-slate-500">{t('no_bill') || 'No specific bill'}</span>
                    </SelectItem>
                    {unpaidBills.map(bill => (
                      <SelectItem key={bill.id} value={bill.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span className="font-mono text-sm">{bill.invoice_number}</span>
                          <span className="text-slate-500">
                            {bill.partner_name || bill.vendor_name}
                          </span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(bill.amount_due || bill.total_amount || 0)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('amount')} *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-9"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('bank_account')}
                </label>
                <Select
                  value={newPayment.account_id}
                  onValueChange={(value) => setNewPayment({...newPayment, account_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_account')} />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('reference')}
              </label>
              <Input
                placeholder={t('payment_reference')}
                value={newPayment.reference}
                onChange={(e) => setNewPayment({...newPayment, reference: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('description')}
              </label>
              <Input
                placeholder={t('payment_description')}
                value={newPayment.description}
                onChange={(e) => setNewPayment({...newPayment, description: e.target.value})}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreatePayment}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !newPayment.amount || !newPayment.contact_id || !newPayment.payment_date}
              >
                {isSaving ? t('saving') : t('create_payment')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[var(--genix-purple)]" />
              {t('payment_details')}
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    selectedPayment.payment_type === 'inbound'
                      ? 'bg-green-100'
                      : 'bg-red-100'
                  }`}>
                    {selectedPayment.payment_type === 'inbound' ? (
                      <ArrowDownLeft className="w-6 h-6 text-green-600" />
                    ) : (
                      <ArrowUpRight className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      {selectedPayment.payment_type === 'inbound' ? t('money_received') : t('money_paid')}
                    </p>
                    <p className={`text-2xl font-bold ${
                      selectedPayment.payment_type === 'inbound' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(selectedPayment.amount || 0)}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(selectedPayment.status)}>
                  {t(selectedPayment.status) || selectedPayment.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('date')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedPayment.payment_date
                      ? format(new Date(selectedPayment.payment_date), 'MMM dd, yyyy')
                      : '-'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('reference')}</p>
                  <p className="text-sm font-semibold text-slate-900 font-mono">
                    {selectedPayment.reference || '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('party')}</p>
                  <div className="flex items-center gap-2">
                    {selectedPayment.party_type === 'customer' ? (
                      <User className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-400" />
                    )}
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedPayment.party_name || '-'}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('method')}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {getPaymentMethodLabel(selectedPayment.payment_method)}
                  </p>
                </div>
              </div>

              {selectedPayment.description && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('description')}</p>
                  <p className="text-sm text-slate-700">
                    {selectedPayment.description}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {(selectedPayment.status === 'draft' || selectedPayment.status === 'pending') && canUpdate(MODULES.FINANCIALS) && (
                  <Button
                    onClick={() => {
                      handleConfirmPayment(selectedPayment.id);
                      setShowDetailModal(false);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('confirm_payment')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1"
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

  // Inner content rendered for both tabs
  function PaymentContent() {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    {isCustomerTab ? t('total_received') : t('total_paid')}
                  </p>
                  <p className={`text-2xl font-bold ${isCustomerTab ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summaryStats.totalAmount)}
                  </p>
                </div>
                <div className={`w-12 h-12 ${isCustomerTab ? 'bg-green-100' : 'bg-red-100'} rounded-xl flex items-center justify-center`}>
                  {isCustomerTab
                    ? <ArrowDownLeft className="w-6 h-6 text-green-600" />
                    : <ArrowUpRight className="w-6 h-6 text-red-600" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t('pending')}</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {summaryStats.pendingCount}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t('confirmed')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {summaryStats.confirmedCount}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader className="border-b border-slate-100 pb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[var(--genix-purple)]" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    {isCustomerTab ? (t('customer_payments') || 'Customer Payments') : (t('vendor_payments') || 'Vendor Payments')}
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {filteredPayments.length} {t('payments_total')}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_payments')}
                    className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-purple)]/20 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-slate-50">
                    <SelectValue placeholder={t('status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    <SelectItem value="draft">{t('draft')}</SelectItem>
                    <SelectItem value="pending">{t('pending')}</SelectItem>
                    <SelectItem value="confirmed">{t('confirmed')}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
                {canCreate(MODULES.FINANCIALS) && (
                  <Button
                    onClick={handleOpenCreate}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                  >
                    <Plus className="w-4 h-4 mr-2" /> {t('new_payment')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-[var(--genix-purple)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600 text-sm">{t('loading')}</p>
                </div>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CreditCard className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {searchQuery ? t('no_payments_found') : t('no_payments_yet')}
                </h3>
                <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                  {searchQuery
                    ? t('try_adjusting_search') || 'Try adjusting your search or filters'
                    : t('record_first_payment')}
                </p>
                {!searchQuery && canCreate(MODULES.FINANCIALS) && (
                  <Button
                    onClick={handleOpenCreate}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  >
                    <Plus className="w-4 h-4 mr-2" /> {t('create_first_payment')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {t('date')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('reference')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">
                        {isCustomerTab ? (t('customer') || 'Customer') : (t('vendor') || 'Vendor')}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('method')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <DollarSign className="w-4 h-4" />
                          {t('amount')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-center">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment, index) => (
                      <TableRow
                        key={payment.id || `payment-${index}`}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <TableCell className="font-medium text-slate-700">
                          {payment.payment_date ? format(new Date(payment.payment_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-600">
                          {payment.reference || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isCustomerTab ? (
                              <User className="w-4 h-4 text-slate-400" />
                            ) : (
                              <Building2 className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="text-slate-700">{payment.party_name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {getPaymentMethodLabel(payment.payment_method)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${
                          isCustomerTab ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(payment.amount || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(payment.status)} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(payment.status)}
                            {t(payment.status) || payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(payment)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                            </Button>
                            {(payment.status === 'draft' || payment.status === 'pending') && canUpdate(MODULES.FINANCIALS) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConfirmPayment(payment.id)}
                                className="h-8 w-8 p-0"
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
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

        {/* Related Invoices / Bills */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-bold text-slate-900">
              {isCustomerTab
                ? (t('sales_invoices') || 'Sales Invoices')
                : (t('vendor_bills') || 'Vendor Bills')}
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {isCustomerTab
                ? (t('invoices_payment_status_desc') || 'Invoice payment statuses')
                : (t('bills_payment_status_desc') || 'Bill payment statuses')}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {(() => {
              const items = isCustomerTab
                ? (customerInvoices || []).filter(inv => inv.status !== 'cancelled')
                : (vendorBills || []).filter(b => b.status !== 'cancelled');

              if (items.length === 0) {
                return (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    {isCustomerTab
                      ? (t('no_invoices') || 'No invoices')
                      : (t('no_bills') || 'No bills')}
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">{t('invoice_number') || 'Invoice #'}</TableHead>
                        <TableHead className="font-semibold text-slate-700">
                          {isCustomerTab ? (t('customer') || 'Customer') : (t('vendor') || 'Vendor')}
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('date') || 'Date'}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('total') || 'Total'}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('paid') || 'Paid'}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('due') || 'Due'}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('payment_status') || 'Status'}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const ps = getPaymentStatus(item);
                        const amountDue = (item.total_amount || 0) - (item.amount_paid || 0);
                        const partyName = isCustomerTab
                          ? (item.customer_name || item.customer_id || '-')
                          : (item.partner_name || item.vendor_name || '-');
                        const itemDate = item.invoice_date || item.bill_date;
                        return (
                          <TableRow key={item.id} className="hover:bg-blue-50/50">
                            <TableCell className="font-mono text-sm">{item.invoice_number || '-'}</TableCell>
                            <TableCell className="text-slate-700">{partyName}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {itemDate ? format(new Date(itemDate), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatCurrency(item.total_amount || 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-green-600">
                              {formatCurrency(item.amount_paid || 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-red-600">
                              {amountDue > 0 ? formatCurrency(amountDue) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className={paymentStatusStyle[ps]}>
                                {paymentStatusLabel[ps]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {ps !== 'paid' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50"
                                  onClick={() => handlePayInvoice(item, isCustomerTab)}
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  {t('record_payment') || 'Record Payment'}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    );
  }
}
