import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Send, DollarSign, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useSales } from '@/components/contexts/SalesContext';
import { useCustomers } from '@/components/contexts/CustomersContext';
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import { useAlertModal } from "@/hooks/useAlertModal";
import { getApiErrorMessage } from '@/utils/apiError';
import AlertModal from "@/components/shared/AlertModal";

const AGING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

// Helper to get date-fns locale
const getDateLocale = (lang) => {
  switch (lang) {
    case 'ru': return ru;
    case 'uz': return uz;
    default: return undefined;
  }
};

export default function AccountsReceivable() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const dateLocale = getDateLocale(language);
  const {
    createCustomerInvoice,
    updateCustomerInvoice,
    isLoading,
    refreshData
  } = useFinancials();
  // Use SalesContext invoices so newly created SO invoices appear immediately
  const { invoices: salesInvoices, recordPayment, refreshData: refreshSalesData } = useSales();
  const customerInvoices = salesInvoices || [];
  const { canCreate, canUpdate, MODULES } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { modal, showAlert, showError, showSuccess, close } = useAlertModal();

  const { customers: crmCustomers, isLoading: loadingCustomers } = useCustomers();

  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Map customers to a consistent format for the dropdown
  // Filter out locally-created customers (IDs starting with 'cust_') as they don't exist in the backend
  const customers = crmCustomers
    .filter(c => c.id && !String(c.id).startsWith('cust_'))
    .map(c => ({
      id: c.id,
      name: c.company_name || c.name || c.email || 'Unknown',
      company_name: c.company_name || c.name || '',
      email: c.email || ''
    }));

  const [newInvoice, setNewInvoice] = useState({
    invoice_number: '',
    customer_id: '',
    customer_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_terms: 'net_30',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    description: '',
    notes: ''
  });

  useEffect(() => {
    // Update overdue status
    const updated = customerInvoices.map(inv => {
      if (inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date()) {
        return { ...inv, status: 'overdue' };
      }
      return inv;
    });
    setFilteredInvoices(updated);
  }, [customerInvoices]);

  const getPaymentStatus = (invoice) => {
    const paid = invoice.amount_paid || 0;
    const total = invoice.total_amount || 0;
    if (total <= 0) return 'unpaid';
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
  };

  const getPaymentStatusBadge = (invoice) => {
    const status = getPaymentStatus(invoice);
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
    let filtered = customerInvoices.map(inv => {
      if (inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date()) {
        return { ...inv, status: 'overdue' };
      }
      return inv;
    });

    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(inv => getPaymentStatus(inv) === paymentStatusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(inv => {
        const customer = customers.find(c => c.id === inv.customer_id);
        const customerName = customer?.name || customer?.company_name || inv.customer_id || '';
        return inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customerName.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    setFilteredInvoices(filtered);
  }, [customerInvoices, searchQuery, statusFilter, paymentStatusFilter]);

  const handleCreateInvoice = async () => {
    const subtotal = parseFloat(newInvoice.subtotal) || 0;

    const invoiceData = {
      customer_id: newInvoice.customer_id,
      invoice_date: newInvoice.invoice_date,
      due_date: newInvoice.due_date,
      notes: newInvoice.notes || '',
      lines: [{
        description: newInvoice.description || 'Invoice item',
        quantity: 1,
        unit_price: subtotal,
        discount_amount: 0,
      }],
    };

    try {
      await createCustomerInvoice(invoiceData);
      setShowCreateModal(false);

      // Reset form
      setNewInvoice({
        invoice_number: '',
        customer_id: '',
        customer_name: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        payment_terms: 'net_30',
        subtotal: 0,
        tax_amount: 0,
        total_amount: 0,
        description: '',
        notes: ''
      });
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, 'Failed to create invoice');
      console.error('Invoice creation error:', err.response?.data || err);
      showError(errorMsg, 'Invoice yaratish xatosi');
    }
  };

  const sendReminder = (invoiceId) => {
    const invoice = customerInvoices.find(inv => inv.id === invoiceId);

    // Update dunning level
    updateCustomerInvoice(invoiceId, {
      dunning_level: (invoice.dunning_level || 0) + 1,
      last_dunning_date: new Date().toISOString().split('T')[0]
    });

    showSuccess(`Reminder sent for invoice ${invoice.invoice_number}. Dunning level increased.`);
  };

  const markAsPaid = async (invoiceId) => {
    const invoice = customerInvoices.find(inv => inv.id === invoiceId);
    const amountDue = (invoice.total_amount || 0) - (invoice.amount_paid || 0);

    if (amountDue <= 0) {
      showAlert('Invoice is already paid');
      return;
    }

    try {
      // The rendered rows live in SalesContext — its recordPayment posts the
      // payment AND merges the fresh invoice back into the list, so the row
      // flips to "To'langan" immediately. Calling salesService directly (as
      // before) updated the backend but left the visible list stale.
      await recordPayment(invoiceId, amountDue, 'bank_transfer', new Date().toISOString().split('T')[0]);
      // Financials metrics (AR totals, aging) read from the other context.
      await refreshData();
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, 'Failed to record payment');
      // "Already fully paid" means the visible row was stale (an earlier
      // payment went through without a list refresh) — resync instead of
      // showing a dead-end error.
      if (err.response?.status === 400 && /fully paid/i.test(errorMsg)) {
        try { await refreshSalesData(); } catch { /* list resync is best-effort */ }
        showAlert(language === 'ru'
          ? 'Счёт уже оплачен — список обновлён'
          : language === 'uz'
            ? "Bu faktura allaqachon to'langan — ro'yxat yangilandi"
            : 'Invoice is already paid — list refreshed');
        return;
      }
      console.error('Mark as paid error:', err.response?.data || err);
      showError(errorMsg, 'To\'lov xatosi');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      sent: 'bg-blue-100 text-blue-800 border-blue-200',
      paid: 'bg-green-100 text-green-800 border-green-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[status] || colors.draft;
  };

  // Calculate metrics
  const invoicesWithStatus = customerInvoices.map(inv => {
    if (inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date()) {
      return { ...inv, status: 'overdue' };
    }
    return inv;
  });

  // Calculate average days to pay from paid invoices
  const paidInvoices = invoicesWithStatus.filter(inv => inv.status === 'paid' && inv.invoice_date && inv.updated_at);
  const avgDaysToPay = paidInvoices.length > 0
    ? Math.round(paidInvoices.reduce((sum, inv) => {
        const invoiceDate = new Date(inv.invoice_date);
        const paidDate = new Date(inv.updated_at);
        const daysToPay = Math.max(0, Math.floor((paidDate - invoiceDate) / (1000 * 60 * 60 * 24)));
        return sum + daysToPay;
      }, 0) / paidInvoices.length)
    : 0;

  const metrics = {
    totalReceivable: invoicesWithStatus.reduce((sum, inv) => sum + (inv.amount_due || 0), 0),
    overdueAmount: invoicesWithStatus.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.amount_due || 0), 0),
    avgDaysToPay,
    overdueInvoices: invoicesWithStatus.filter(inv => inv.status === 'overdue').length
  };

  // Aging analysis
  const getAgingBucket = (invoice) => {
    if (invoice.status === 'paid' || !invoice.due_date) return null;
    const daysOverdue = Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) return 'current';
    if (daysOverdue <= 30) return '1-30';
    if (daysOverdue <= 60) return '31-60';
    return '90+';
  };

  const agingData = [
    { name: t('current'), value: invoicesWithStatus.filter(inv => getAgingBucket(inv) === 'current').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) },
    { name: t('days_1_30'), value: invoicesWithStatus.filter(inv => getAgingBucket(inv) === '1-30').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) },
    { name: t('days_31_60'), value: invoicesWithStatus.filter(inv => getAgingBucket(inv) === '31-60').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) },
    { name: t('days_90_plus'), value: invoicesWithStatus.filter(inv => getAgingBucket(inv) === '90+').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) }
  ].filter(d => d.value > 0);

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
            <p className="text-3xl font-bold text-blue-900">{metrics.avgDaysToPay}</p>
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
                  <Pie
                    data={agingData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={AGING_COLORS[index % AGING_COLORS.length]} />
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
                <CardTitle className="text-xl font-bold">{t('customer_invoices')}</CardTitle>
                {canCreate(MODULES.FINANCIALS) && (
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
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
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    <SelectItem value="sent">{t('sent') || 'Sent'}</SelectItem>
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
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-500">{t('no_data')}</p>
                {canCreate(MODULES.FINANCIALS) && (
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4" variant="outline">
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
                      <TableHead>{t('dunning')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const customer = customers.find(c => c.id === invoice.customer_id);
                      const customerName = customer?.name || customer?.company_name || invoice.customer_id || '-';
                      return (
                      <TableRow key={invoice.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                        <TableCell className="font-medium">{customerName}</TableCell>
                        <TableCell className="text-sm">
                          {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.due_date ? format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: dateLocale }) : '-'}
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(invoice.total_amount || 0)}</TableCell>
                        <TableCell>
                          {(() => {
                            const ps = getPaymentStatusBadge(invoice);
                            const amountDue = (invoice.total_amount || 0) - (invoice.amount_paid || 0);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <Badge className={ps.style}>{ps.label}</Badge>
                                {getPaymentStatus(invoice) === 'partial' && (
                                  <span className="text-xs text-slate-500">{t('due')}: {formatCurrency(amountDue)}</span>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(invoice.status)}>{t(invoice.status) || invoice.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.dunning_level > 0 && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700">
                              {invoice.dunning_level}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {canUpdate(MODULES.FINANCIALS) && invoice.status === 'overdue' && (
                              <Button size="sm" variant="ghost" onClick={() => sendReminder(invoice.id)} title={t('remind')}>
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {canUpdate(MODULES.FINANCIALS) && invoice.status !== 'paid' && (
                              <Button size="sm" variant="ghost" onClick={() => markAsPaid(invoice.id)} title={t('pay')}>
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('create_customer_invoice') || 'Create Customer Invoice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('customer')} *</label>
                <Select
                  value={newInvoice.customer_id}
                  onValueChange={(value) => {
                    const customer = customers.find(c => c.id === value);
                    setNewInvoice({
                      ...newInvoice,
                      customer_id: value,
                      customer_name: customer?.name || customer?.company_name || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCustomers ? t('loading') : t('select_customer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name || customer.company_name || customer.email}
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
                  value={newInvoice.invoice_date}
                  onChange={(e) => setNewInvoice({...newInvoice, invoice_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('due_date')} *</label>
                <Input
                  type="date"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice({...newInvoice, due_date: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('description')} *</label>
              <Input
                placeholder={t('description')}
                value={newInvoice.description}
                onChange={(e) => setNewInvoice({...newInvoice, description: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('subtotal')} *</label>
                <NumberInput
                  placeholder="0"
                  value={newInvoice.subtotal}
                  onChange={(raw) => {
                    const subtotal = parseFloat(raw) || 0;
                    const tax = subtotal * 0.1; // 10% tax
                    setNewInvoice({...newInvoice, subtotal, tax_amount: tax, total_amount: subtotal + tax});
                  }}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('tax') || 'Tax'}</label>
                <NumberInput
                  placeholder="0"
                  value={newInvoice.tax_amount}
                  disabled
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('total')}</label>
                <NumberInput
                  placeholder="0"
                  value={newInvoice.total_amount}
                  disabled
                  className="font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('notes')}</label>
              <Input
                placeholder={t('optional_notes') || 'Optional notes'}
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice({...newInvoice, notes: e.target.value})}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateInvoice}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={!newInvoice.customer_id || !newInvoice.due_date || !newInvoice.description}
              >
                {t('create_invoice') || 'Create Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal modal={modal} close={close} />
    </div>
  );
}
