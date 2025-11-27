import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Send, DollarSign, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const AGING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function AccountsReceivable() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [newInvoice, setNewInvoice] = useState({
    invoice_number: '',
    partner_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_terms: 'net_30',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    let filtered = invoices;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.partner_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredInvoices(filtered);
  }, [invoices, searchQuery, statusFilter]);

  const loadInvoices = async () => {
    try {
      const data = await base44.entities.Invoice.filter({ invoice_type: 'customer_invoice' }, '-created_date', 100);
      
      // Update overdue status
      const updated = data.map(inv => {
        if (inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date()) {
          return { ...inv, status: 'overdue' };
        }
        return inv;
      });
      
      setInvoices(updated);
      setFilteredInvoices(updated);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
    setIsLoading(false);
  };

  const handleCreateInvoice = async () => {
    try {
      const invoiceData = {
        invoice_type: 'customer_invoice',
        invoice_number: newInvoice.invoice_number || `INV-${Date.now()}`,
        partner_id: newInvoice.partner_id,
        company_id: 'default',
        invoice_date: newInvoice.invoice_date,
        due_date: newInvoice.due_date,
        payment_terms: newInvoice.payment_terms,
        subtotal: parseFloat(newInvoice.subtotal),
        tax_amount: parseFloat(newInvoice.tax_amount),
        total_amount: parseFloat(newInvoice.total_amount),
        amount_due: parseFloat(newInvoice.total_amount),
        status: 'sent',
        dunning_level: 0
      };
      
      await base44.entities.Invoice.create(invoiceData);
      setShowCreateModal(false);
      loadInvoices();
      
      // Reset form
      setNewInvoice({
        invoice_number: '',
        partner_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        payment_terms: 'net_30',
        subtotal: 0,
        tax_amount: 0,
        total_amount: 0
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const sendReminder = async (invoiceId) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      
      // AI generates personalized reminder
      const reminder = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a polite payment reminder email for:
Customer: ${invoice.partner_id}
Invoice: ${invoice.invoice_number}
Amount: $${invoice.amount_due}
Days overdue: ${Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24))}

Make it professional and friendly.`,
        response_json_schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" }
          }
        }
      });
      
      await base44.integrations.Core.SendEmail({
        to: invoice.partner_id,
        subject: reminder.subject,
        body: reminder.body
      });
      
      // Update dunning level
      await base44.entities.Invoice.update(invoiceId, {
        dunning_level: (invoice.dunning_level || 0) + 1,
        last_dunning_date: new Date().toISOString().split('T')[0]
      });
      
      loadInvoices();
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  };

  const markAsPaid = async (invoiceId) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      await base44.entities.Invoice.update(invoiceId, {
        status: 'paid',
        amount_paid: invoice.total_amount,
        amount_due: 0
      });
      loadInvoices();
    } catch (error) {
      console.error('Error marking as paid:', error);
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
  const metrics = {
    totalReceivable: invoices.reduce((sum, inv) => sum + (inv.amount_due || 0), 0),
    overdueAmount: invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.amount_due || 0), 0),
    avgDaysToPay: 35, // This would be calculated from historical data
    overdueInvoices: invoices.filter(inv => inv.status === 'overdue').length
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
    { name: t('current'), value: invoices.filter(inv => getAgingBucket(inv) === 'current').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) },
    { name: t('days_1_30'), value: invoices.filter(inv => getAgingBucket(inv) === '1-30').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) },
    { name: t('days_31_60'), value: invoices.filter(inv => getAgingBucket(inv) === '31-60').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) },
    { name: t('days_90_plus'), value: invoices.filter(inv => getAgingBucket(inv) === '90+').reduce((sum, inv) => sum + (inv.amount_due || 0), 0) }
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
            <p className="text-3xl font-bold text-slate-900">${metrics.totalReceivable.toLocaleString()}</p>
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
            <p className="text-3xl font-bold text-red-900">${metrics.overdueAmount.toLocaleString()}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
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
                    label={(entry) => `${entry.name}: $${entry.value.toLocaleString()}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={AGING_COLORS[index % AGING_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Invoices List */}
        <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold">{t('customer_invoices')}</CardTitle>
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                  <Plus className="w-4 h-4 mr-2" /> {t('new_invoice')}
                </Button>
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
                    <SelectItem value="sent">Sent</SelectItem>
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
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-500">{t('no_data')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('invoice_number')}</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('due_date')}</TableHead>
                      <TableHead>{t('amount')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('dunning')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                        <TableCell className="font-medium">{invoice.partner_id}</TableCell>
                        <TableCell className="text-sm">
                          {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.due_date ? format(new Date(invoice.due_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-semibold">${(invoice.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.dunning_level > 0 && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700">
                              Level {invoice.dunning_level}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {invoice.status === 'overdue' && (
                              <Button size="sm" variant="ghost" onClick={() => sendReminder(invoice.id)} title={t('remind')}>
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {invoice.status !== 'paid' && (
                              <Button size="sm" variant="ghost" onClick={() => markAsPaid(invoice.id)} title={t('pay')}>
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

      </div>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Customer Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice Number {t('optional')}</label>
                <Input
                  placeholder="Auto-generated"
                  value={newInvoice.invoice_number}
                  onChange={(e) => setNewInvoice({...newInvoice, invoice_number: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Customer *</label>
                <Input
                  placeholder="Customer name or email"
                  value={newInvoice.partner_id}
                  onChange={(e) => setNewInvoice({...newInvoice, partner_id: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice Date *</label>
                <Input
                  type="date"
                  value={newInvoice.invoice_date}
                  onChange={(e) => setNewInvoice({...newInvoice, invoice_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Due Date *</label>
                <Input
                  type="date"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice({...newInvoice, due_date: e.target.value})}
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
                  value={newInvoice.subtotal}
                  onChange={(e) => {
                    const subtotal = parseFloat(e.target.value) || 0;
                    const tax = subtotal * 0.1; // 10% tax
                    setNewInvoice({...newInvoice, subtotal, tax_amount: tax, total_amount: subtotal + tax});
                  }}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tax</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newInvoice.tax_amount}
                  disabled
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Total</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newInvoice.total_amount}
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
                onClick={handleCreateInvoice} 
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={!newInvoice.partner_id || !newInvoice.due_date}
              >
                Create Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}