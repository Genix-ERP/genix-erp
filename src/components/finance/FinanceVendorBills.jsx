import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, Clock, CheckCircle, AlertCircle, AlertTriangle,
  Building2, Receipt, Ban, DollarSign, CreditCard, Eye
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useFinancials } from "@/components/contexts/FinancialsContext";
import financeService from "@/api/services/finance";

export default function FinanceVendorBills() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { vendorBills, isLoading } = useFinancials();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [isPaying, setIsPaying] = useState(false);

  const isOverdue = (bill) => {
    if (!bill.due_date) return false;
    const status = bill.status;
    if (status === 'paid' || status === 'cancelled') return false;
    return new Date(bill.due_date) < new Date(new Date().toDateString());
  };

  // Derive payment status from bill data
  const getPaymentStatus = (bill) => {
    const paid = bill.amount_paid || 0;
    const total = bill.total_amount || 0;
    const status = bill.status;

    if (status === 'cancelled') return 'cancelled';
    if (status === 'reversed') return 'reversed';
    if (status === 'draft') return 'draft';
    if (total <= 0) return 'not_paid';
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    if (isOverdue(bill)) return 'overdue';
    return 'not_paid';
  };

  const statusBadgeConfig = {
    draft: { color: "bg-gray-100 text-gray-700 border-gray-200", label: t('draft') || 'Draft', icon: Clock },
    not_paid: { color: "bg-orange-100 text-orange-800 border-orange-200", label: t('not_paid') || "To'lanmagan", icon: AlertCircle },
    partial: { color: "bg-blue-100 text-blue-800 border-blue-200", label: t('partially_paid') || 'Qisman', icon: Clock },
    paid: { color: "bg-green-100 text-green-800 border-green-200", label: t('paid') || "To'langan", icon: CheckCircle },
    overdue: { color: "bg-red-100 text-red-800 border-red-200", label: t('overdue') || "Muddati o'tgan", icon: AlertTriangle },
    cancelled: { color: "bg-red-100 text-red-800 border-red-200", label: t('cancelled') || 'Bekor qilingan', icon: Ban },
    reversed: { color: "bg-purple-100 text-purple-800 border-purple-200", label: t('reversed') || 'Reversed', icon: AlertCircle },
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    let filtered = vendorBills || [];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(bill =>
        bill.invoice_number?.toLowerCase().includes(query) ||
        bill.bill_number?.toLowerCase().includes(query) ||
        bill.vendor_name?.toLowerCase().includes(query) ||
        bill.partner_name?.toLowerCase().includes(query) ||
        bill.vendor_invoice_number?.toLowerCase().includes(query) ||
        bill.reference?.toLowerCase().includes(query) ||
        bill.origin?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(bill => {
        const payStatus = getPaymentStatus(bill);
        if (statusFilter === 'overdue') return isOverdue(bill);
        return payStatus === statusFilter;
      });
    }

    return filtered;
  }, [vendorBills, searchQuery, statusFilter]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const bills = vendorBills || [];
    return {
      total: bills.length,
      notPaid: bills.filter(b => {
        const s = getPaymentStatus(b);
        return s === 'not_paid' || s === 'draft';
      }).length,
      partial: bills.filter(b => getPaymentStatus(b) === 'partial').length,
      paid: bills.filter(b => getPaymentStatus(b) === 'paid').length,
      overdue: bills.filter(b => isOverdue(b)).length,
      totalAmount: bills.reduce((sum, b) => sum + (b.total_amount || 0), 0),
    };
  }, [vendorBills]);

  const handleViewDetail = (bill) => {
    setSelectedBill(bill);
    setShowDetailModal(true);
  };

  const handleOpenPayment = (bill, e) => {
    if (e) e.stopPropagation();
    const amountDue = bill.amount_due ?? ((bill.total_amount || 0) - (bill.amount_paid || 0));
    setPaymentBill(bill);
    setPaymentAmount(String(amountDue));
    setPaymentMethod("bank");
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = useCallback(async () => {
    if (!paymentBill || !paymentAmount || parseFloat(paymentAmount) <= 0) return;
    setIsPaying(true);
    try {
      await financeService.payPurchaseInvoice(paymentBill.id, parseFloat(paymentAmount), paymentMethod);
      setShowPaymentModal(false);
      setPaymentBill(null);
      setPaymentAmount("");
      // Reload page to refresh data
      window.location.reload();
    } catch (err) {
      console.error('Payment failed:', err);
    } finally {
      setIsPaying(false);
    }
  }, [paymentBill, paymentAmount]);

  const renderStatusBadge = (bill) => {
    let payStatus = getPaymentStatus(bill);
    // Override with overdue if applicable
    if (isOverdue(bill) && payStatus !== 'paid' && payStatus !== 'cancelled') {
      payStatus = 'overdue';
    }
    const config = statusBadgeConfig[payStatus] || statusBadgeConfig.not_paid;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const canPay = (bill) => {
    const status = getPaymentStatus(bill);
    return status === 'not_paid' || status === 'partial' || status === 'overdue' || isOverdue(bill);
  };

  const getJournalForMethod = (method) => {
    switch (method) {
      case 'cash': return 'CASH';
      case 'bank': return 'BANK';
      case 'card': return 'BANK';
      default: return 'BANK';
    }
  };

  const getProvodka = (method) => {
    switch (method) {
      case 'cash': return 'Dt 2000 Kreditor / Kt 1000 Kassa';
      case 'bank': return 'Dt 2000 Kreditor / Kt 1010 Bank';
      case 'card': return 'Dt 2000 Kreditor / Kt 1010 Bank';
      default: return 'Dt 2000 Kreditor / Kt 1010 Bank';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_bills') || 'Jami fakturalar'}</p>
                <p className="text-2xl font-bold text-slate-900">{summaryStats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('not_paid') || "To'lanmagan"}</p>
                <p className="text-2xl font-bold text-orange-600">{summaryStats.notPaid}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('partially_paid') || 'Qisman'}</p>
                <p className="text-2xl font-bold text-blue-600">{summaryStats.partial}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">{t('overdue') || "Muddati o'tgan"}</p>
                <p className="text-2xl font-bold text-red-700">{summaryStats.overdue}</p>
              </div>
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_amount') || 'Jami summa'}</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(summaryStats.totalAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bills Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('vendor_bills') || 'Yetkazib beruvchi hisob-fakturalari'}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredBills.length} {t('bills') || 'faktura'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search') || 'Qidirish...'}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-purple)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-slate-50">
                  <SelectValue placeholder={t('payment_status') || 'Holat'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status') || 'Barchasi'}</SelectItem>
                  <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                  <SelectItem value="not_paid">{t('not_paid') || "To'lanmagan"}</SelectItem>
                  <SelectItem value="partial">{t('partially_paid') || 'Qisman'}</SelectItem>
                  <SelectItem value="paid">{t('paid') || "To'langan"}</SelectItem>
                  <SelectItem value="overdue">{t('overdue') || "Muddati o'tgan"}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled') || 'Bekor qilingan'}</SelectItem>
                </SelectContent>
              </Select>
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
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Receipt className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery || statusFilter !== 'all'
                  ? (t('no_results_found') || 'Natija topilmadi')
                  : (t('no_vendor_bills') || 'Hali fakturalar yo\'q')}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? (t('try_adjusting_search') || 'Qidiruv yoki filtrlarni o\'zgartiring')
                  : (t('vendor_bills_desc') || 'Fakturalar xarid orderlari tasdiqlanganda paydo bo\'ladi')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700">{t('number') || 'Raqam'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {t('vendor') || 'Yetkazuvchi'}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('bill_date') || 'Sana'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('due_date') || "To'lov muddati"}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('reference') || 'Havola'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{t('tax') || 'QQS'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{t('total') || 'Jami'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{t('amount_due') || 'Qolgan qarz'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('status') || 'Holat'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{t('actions') || 'Amallar'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill, index) => {
                    const overdue = isOverdue(bill);
                    const amountDue = bill.amount_due ?? ((bill.total_amount || 0) - (bill.amount_paid || 0));
                    return (
                      <TableRow
                        key={bill.id || `bill-${index}`}
                        className={`transition-colors cursor-pointer ${
                          overdue
                            ? 'bg-red-50/80 hover:bg-red-100/60'
                            : 'hover:bg-blue-50/50'
                        }`}
                        onClick={() => handleViewDetail(bill)}
                      >
                        <TableCell className="font-mono text-sm font-medium text-slate-900">
                          {bill.invoice_number || bill.bill_number || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700">{bill.vendor_name || bill.partner_name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {(bill.invoice_date || bill.bill_date || bill.date)
                            ? format(new Date(bill.invoice_date || bill.bill_date || bill.date), 'dd/MM/yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell className={overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                          {bill.due_date
                            ? format(new Date(bill.due_date), 'dd/MM/yyyy')
                            : '-'}
                          {overdue && <span className="ml-1">⚠️</span>}
                        </TableCell>
                        <TableCell className="text-slate-600 max-w-[150px] truncate">
                          {bill.vendor_invoice_number || bill.reference || bill.origin || '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-600">
                          {formatCurrency(bill.tax_amount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                          {formatCurrency(bill.total_amount || 0)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${amountDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(amountDue)}
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(bill)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewDetail(bill); }}
                              title={t('view') || "Ko'rish"}
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                            </Button>
                            {canPay(bill) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleOpenPayment(bill, e)}
                                className={overdue ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                                title={t('pay') || "To'lash"}
                              >
                                <CreditCard className="w-4 h-4" />
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

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[var(--genix-purple)]" />
              {selectedBill?.invoice_number || selectedBill?.bill_number || t('vendor_bill')}
            </DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-6 py-4">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                {renderStatusBadge(selectedBill)}
                {isOverdue(selectedBill) && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('overdue') || "Muddati o'tgan"}
                  </Badge>
                )}
              </div>

              {/* Bill Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('vendor') || 'Yetkazuvchi'}</p>
                  <p className="font-medium text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {selectedBill.vendor_name || selectedBill.partner_name || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('bill_number') || 'Faktura raqami'}</p>
                  <p className="font-mono font-medium text-slate-900">
                    {selectedBill.invoice_number || selectedBill.bill_number || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('bill_date') || 'Faktura sanasi'}</p>
                  <p className="font-medium text-slate-900">
                    {(selectedBill.invoice_date || selectedBill.bill_date || selectedBill.date)
                      ? format(new Date(selectedBill.invoice_date || selectedBill.bill_date || selectedBill.date), 'dd.MM.yyyy')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('due_date') || "To'lov muddati"}</p>
                  <p className={`font-medium ${isOverdue(selectedBill) ? 'text-red-600' : 'text-slate-900'}`}>
                    {selectedBill.due_date
                      ? format(new Date(selectedBill.due_date), 'dd.MM.yyyy')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('vendor_ref') || 'Yetkazuvchi hujjat №'}</p>
                  <p className="font-medium text-slate-900">
                    {selectedBill.vendor_invoice_number || selectedBill.reference || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('purchase_order') || 'Xarid orderi'}</p>
                  <p className="font-medium text-slate-900">
                    {selectedBill.purchase_order_number || selectedBill.origin || '-'}
                  </p>
                </div>
              </div>

              {/* Amounts */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('tax_excluded') || 'Soliqsiz summa'}</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(selectedBill.subtotal || (selectedBill.total_amount || 0) - (selectedBill.tax_amount || 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('tax') || 'QQS'}</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(selectedBill.tax_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-3">
                  <span className="text-slate-900">{t('total') || 'Jami'}</span>
                  <span className="text-slate-900">
                    {formatCurrency(selectedBill.total_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('amount_paid') || "To'langan"}</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(selectedBill.amount_paid || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span className="text-slate-900">{t('amount_due') || 'Qolgan qarz'}</span>
                  <span className="text-red-600">
                    {formatCurrency(selectedBill.amount_due ?? ((selectedBill.total_amount || 0) - (selectedBill.amount_paid || 0)))}
                  </span>
                </div>
              </div>

              {/* Pay button in detail modal */}
              {canPay(selectedBill) && (
                <div className="border-t pt-4">
                  <Button
                    onClick={() => { setShowDetailModal(false); handleOpenPayment(selectedBill); }}
                    className={`w-full ${isOverdue(selectedBill)
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white'}`}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {t('pay') || "To'lov qilish"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              {t('record_payment') || "To'lov qilish"}
            </DialogTitle>
            <DialogDescription>
              {t('record_payment_desc') || "Yetkazuvchiga to'lovni qayd etish"}
            </DialogDescription>
          </DialogHeader>
          {paymentBill && (
            <div className="space-y-4 mt-2">
              {/* Bill info */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('bill') || 'Faktura'}</span>
                  <span className="font-mono font-medium">{paymentBill.invoice_number || paymentBill.bill_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('vendor') || 'Yetkazuvchi'}</span>
                  <span className="font-medium">{paymentBill.vendor_name || paymentBill.partner_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('total') || 'Jami summa'}</span>
                  <span className="font-semibold">{formatCurrency(paymentBill.total_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('amount_paid') || "To'langan"}</span>
                  <span className="font-medium text-green-600">{formatCurrency(paymentBill.amount_paid || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span className="text-orange-600">{t('amount_due') || 'Qolgan qarz'}</span>
                  <span className="text-orange-600">
                    {formatCurrency(paymentBill.amount_due ?? ((paymentBill.total_amount || 0) - (paymentBill.amount_paid || 0)))}
                  </span>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="text-sm font-medium">{t('payment_method') || "To'lov usuli"} *</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">{t('bank_transfer') || "Bank o'tkazmasi"}</SelectItem>
                    <SelectItem value="cash">{t('cash') || 'Naqd'}</SelectItem>
                    <SelectItem value="card">{t('credit_card') || 'Kredit karta'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-medium">{t('amount') || 'Summa'} *</label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* Journal + Provodka info */}
              <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">{t('journal') || 'Jurnal'}</span>
                  <span className="font-mono font-medium text-blue-800">{getJournalForMethod(paymentMethod)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">{t('accounting_entry') || 'Provodka'}</span>
                  <span className="font-mono text-xs text-blue-800">{getProvodka(paymentMethod)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                  {t('cancel') || 'Bekor qilish'}
                </Button>
                <Button
                  onClick={handleSubmitPayment}
                  disabled={isPaying || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isPaying
                    ? (t('loading') || "Yuklanmoqda...")
                    : (t('confirm_payment') || "To'lovni tasdiqlash")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
