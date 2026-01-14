import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useFinancials } from "@/components/contexts/FinancialsContext";

export default function Payments() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    payments,
    accounts,
    createPayment,
    confirmPayment,
    isLoading
  } = useFinancials();

  const [filteredPayments, setFilteredPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newPayment, setNewPayment] = useState({
    payment_type: 'outbound',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'USD',
    reference: '',
    description: '',
    party_type: 'vendor',
    party_name: '',
    account_id: '',
  });

  // Summary calculations
  const summaryStats = {
    totalInbound: payments.filter(p => p.payment_type === 'inbound').reduce((sum, p) => sum + (p.amount || 0), 0),
    totalOutbound: payments.filter(p => p.payment_type === 'outbound').reduce((sum, p) => sum + (p.amount || 0), 0),
    pendingCount: payments.filter(p => p.status === 'draft' || p.status === 'pending').length,
    confirmedCount: payments.filter(p => p.status === 'confirmed' || p.status === 'posted').length,
  };

  useEffect(() => {
    setFilteredPayments(payments);
  }, [payments]);

  useEffect(() => {
    let filtered = payments;

    if (searchQuery) {
      filtered = filtered.filter(payment =>
        payment.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.party_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(payment => payment.payment_type === typeFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    setFilteredPayments(filtered);
  }, [searchQuery, typeFilter, statusFilter, payments]);

  const handleCreatePayment = () => {
    setIsSaving(true);
    try {
      const paymentData = {
        ...newPayment,
        amount: parseFloat(newPayment.amount) || 0
      };

      createPayment(paymentData);

      setNewPayment({
        payment_type: 'outbound',
        payment_method: 'bank_transfer',
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        currency: 'USD',
        reference: '',
        description: '',
        party_type: 'vendor',
        party_name: '',
        account_id: '',
      });

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

  const getPaymentTypeIcon = (type) => {
    return type === 'inbound' ? ArrowDownLeft : ArrowUpRight;
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      bank_transfer: 'Bank Transfer',
      cash: 'Cash',
      check: 'Check',
      credit_card: 'Credit Card',
      wire: 'Wire Transfer'
    };
    return labels[method] || method;
  };

  const bankAccounts = accounts.filter(a => a.account_type === 'asset' && a.code?.startsWith('1'));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_received')}</p>
                <p className="text-2xl font-bold text-green-600">
                  ${summaryStats.totalInbound.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_paid')}</p>
                <p className="text-2xl font-bold text-red-600">
                  ${summaryStats.totalOutbound.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-red-600" />
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
                  {t('payments')}
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] bg-slate-50">
                  <SelectValue placeholder={t('type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types')}</SelectItem>
                  <SelectItem value="inbound">{t('received')}</SelectItem>
                  <SelectItem value="outbound">{t('paid')}</SelectItem>
                </SelectContent>
              </Select>
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
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('new_payment')}
              </Button>
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
              {!searchQuery && (
                <Button
                  onClick={() => setShowCreateModal(true)}
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
                    <TableHead className="font-semibold text-slate-700">Type</TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Reference</TableHead>
                    <TableHead className="font-semibold text-slate-700">Party</TableHead>
                    <TableHead className="font-semibold text-slate-700">Method</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <DollarSign className="w-4 h-4" />
                        Amount
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(payment => {
                    const TypeIcon = getPaymentTypeIcon(payment.payment_type);
                    return (
                      <TableRow
                        key={payment.id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <TableCell>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            payment.payment_type === 'inbound'
                              ? 'bg-green-100'
                              : 'bg-red-100'
                          }`}>
                            <TypeIcon className={`w-4 h-4 ${
                              payment.payment_type === 'inbound'
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`} />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">
                          {payment.payment_date ? format(new Date(payment.payment_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-600">
                          {payment.reference || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {payment.party_type === 'customer' ? (
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
                          payment.payment_type === 'inbound' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {payment.payment_type === 'inbound' ? '+' : '-'}${(payment.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(payment.status)} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(payment.status)}
                            {payment.status}
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
                            {(payment.status === 'draft' || payment.status === 'pending') && (
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Payment Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--genix-purple)]" />
              New Payment
            </DialogTitle>
            <DialogDescription>
              Record a new payment transaction
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Payment Type *
                </label>
                <Select
                  value={newPayment.payment_type}
                  onValueChange={(value) => setNewPayment({...newPayment, payment_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">
                      <div className="flex items-center gap-2">
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                        Money Received
                      </div>
                    </SelectItem>
                    <SelectItem value="outbound">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-red-600" />
                        Money Paid
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Payment Date *
                </label>
                <Input
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({...newPayment, payment_date: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Party Type
                </label>
                <Select
                  value={newPayment.party_type}
                  onValueChange={(value) => setNewPayment({...newPayment, party_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Party Name *
                </label>
                <Input
                  placeholder="Enter name"
                  value={newPayment.party_name}
                  onChange={(e) => setNewPayment({...newPayment, party_name: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Payment Method *
                </label>
                <Select
                  value={newPayment.payment_method}
                  onValueChange={(value) => setNewPayment({...newPayment, payment_method: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Bank Account
                </label>
                <Select
                  value={newPayment.account_id}
                  onValueChange={(value) => setNewPayment({...newPayment, account_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Amount *
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
                  Reference
                </label>
                <Input
                  placeholder="Payment reference"
                  value={newPayment.reference}
                  onChange={(e) => setNewPayment({...newPayment, reference: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Description
              </label>
              <Input
                placeholder="Payment description"
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
                Cancel
              </Button>
              <Button
                onClick={handleCreatePayment}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !newPayment.amount || !newPayment.party_name || !newPayment.payment_date}
              >
                {isSaving ? 'Saving...' : 'Create Payment'}
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
              Payment Details
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
                      {selectedPayment.payment_type === 'inbound' ? 'Money Received' : 'Money Paid'}
                    </p>
                    <p className={`text-2xl font-bold ${
                      selectedPayment.payment_type === 'inbound' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${(selectedPayment.amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(selectedPayment.status)}>
                  {selectedPayment.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedPayment.payment_date
                      ? format(new Date(selectedPayment.payment_date), 'MMM dd, yyyy')
                      : '-'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Reference</p>
                  <p className="text-sm font-semibold text-slate-900 font-mono">
                    {selectedPayment.reference || '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Party</p>
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
                  <p className="text-xs text-slate-500 mb-1">Method</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {getPaymentMethodLabel(selectedPayment.payment_method)}
                  </p>
                </div>
              </div>

              {selectedPayment.description && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700">
                    {selectedPayment.description}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {(selectedPayment.status === 'draft' || selectedPayment.status === 'pending') && (
                  <Button
                    onClick={() => {
                      handleConfirmPayment(selectedPayment.id);
                      setShowDetailModal(false);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Payment
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
