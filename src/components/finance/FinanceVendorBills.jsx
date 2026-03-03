import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, Clock, CheckCircle, AlertCircle,
  Building2, Receipt, Ban
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useFinancials } from "@/components/contexts/FinancialsContext";

export default function FinanceVendorBills() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { vendorBills, isLoading } = useFinancials();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
    return 'not_paid';
  };

  const statusBadgeConfig = {
    draft: { color: "bg-gray-100 text-gray-700 border-gray-200", label: t('draft') || 'Draft', icon: Clock },
    not_paid: { color: "bg-orange-100 text-orange-800 border-orange-200", label: t('not_paid') || 'Not Paid', icon: AlertCircle },
    partial: { color: "bg-blue-100 text-blue-800 border-blue-200", label: t('partially_paid') || 'Partially Paid', icon: Clock },
    paid: { color: "bg-green-100 text-green-800 border-green-200", label: t('paid') || 'Paid', icon: CheckCircle },
    cancelled: { color: "bg-red-100 text-red-800 border-red-200", label: t('cancelled') || 'Cancelled', icon: Ban },
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
        bill.reference?.toLowerCase().includes(query) ||
        bill.origin?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(bill => {
        const payStatus = getPaymentStatus(bill);
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
      paid: bills.filter(b => getPaymentStatus(b) === 'paid').length,
      totalAmount: bills.reduce((sum, b) => sum + (b.total_amount || 0), 0),
    };
  }, [vendorBills]);

  const handleViewDetail = (bill) => {
    setSelectedBill(bill);
    setShowDetailModal(true);
  };

  const renderStatusBadge = (bill) => {
    const payStatus = getPaymentStatus(bill);
    const config = statusBadgeConfig[payStatus] || statusBadgeConfig.not_paid;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_bills') || 'Total Bills'}</p>
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
                <p className="text-sm text-slate-500">{t('not_paid') || 'Not Paid'}</p>
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
                <p className="text-sm text-slate-500">{t('paid') || 'Paid'}</p>
                <p className="text-2xl font-bold text-green-600">{summaryStats.paid}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_amount') || 'Total Amount'}</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(summaryStats.totalAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
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
                  {t('vendor_bills') || 'Vendor Bills'}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredBills.length} {t('bills') || 'bills'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search') || 'Search...'}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-purple)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-slate-50">
                  <SelectValue placeholder={t('payment_status') || 'Payment Status'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status') || 'All'}</SelectItem>
                  <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                  <SelectItem value="not_paid">{t('not_paid') || 'Not Paid'}</SelectItem>
                  <SelectItem value="partial">{t('partially_paid') || 'Partially Paid'}</SelectItem>
                  <SelectItem value="paid">{t('paid') || 'Paid'}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
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
                  ? (t('no_results_found') || 'No results found')
                  : (t('no_vendor_bills') || 'No vendor bills yet')}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? (t('try_adjusting_search') || 'Try adjusting your search or filters')
                  : (t('vendor_bills_desc') || 'Vendor bills will appear here when purchase orders are invoiced')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700">{t('number') || 'Number'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {t('vendor') || 'Vendor'}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('bill_date') || 'Bill Date'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('due_date') || 'Due Date'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('reference') || 'Reference'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{t('tax_excluded') || 'Tax Excluded'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{t('total') || 'Total'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('payment_status') || 'Payment Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill, index) => (
                    <TableRow
                      key={bill.id || `bill-${index}`}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer"
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
                          ? format(new Date(bill.invoice_date || bill.bill_date || bill.date), 'MM/dd/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {bill.due_date
                          ? format(new Date(bill.due_date), 'MM/dd/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-[150px] truncate">
                        {bill.reference || bill.origin || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-700">
                        {formatCurrency((bill.subtotal || (bill.total_amount || 0) - (bill.tax_amount || 0)))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                        {formatCurrency(bill.total_amount || 0)}
                      </TableCell>
                      <TableCell>
                        {renderStatusBadge(bill)}
                      </TableCell>
                    </TableRow>
                  ))}
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
              </div>

              {/* Bill Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('vendor') || 'Vendor'}</p>
                  <p className="font-medium text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {selectedBill.vendor_name || selectedBill.partner_name || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('bill_number') || 'Bill Number'}</p>
                  <p className="font-mono font-medium text-slate-900">
                    {selectedBill.invoice_number || selectedBill.bill_number || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('bill_date') || 'Bill Date'}</p>
                  <p className="font-medium text-slate-900">
                    {(selectedBill.invoice_date || selectedBill.bill_date || selectedBill.date)
                      ? format(new Date(selectedBill.invoice_date || selectedBill.bill_date || selectedBill.date), 'MMM dd, yyyy')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('due_date') || 'Due Date'}</p>
                  <p className="font-medium text-slate-900">
                    {selectedBill.due_date
                      ? format(new Date(selectedBill.due_date), 'MMM dd, yyyy')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('reference') || 'Reference'}</p>
                  <p className="font-medium text-slate-900">
                    {selectedBill.reference || selectedBill.origin || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t('source') || 'Source'}</p>
                  <p className="font-medium text-slate-900">
                    {selectedBill.origin || '-'}
                  </p>
                </div>
              </div>

              {/* Amounts */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('tax_excluded') || 'Tax Excluded'}</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(selectedBill.subtotal || (selectedBill.total_amount || 0) - (selectedBill.tax_amount || 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('tax') || 'Tax'}</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(selectedBill.tax_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-3">
                  <span className="text-slate-900">{t('total') || 'Total'}</span>
                  <span className="text-slate-900">
                    {formatCurrency(selectedBill.total_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('amount_paid') || 'Amount Paid'}</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(selectedBill.amount_paid || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span className="text-slate-900">{t('amount_due') || 'Amount Due'}</span>
                  <span className="text-red-600">
                    {formatCurrency(selectedBill.amount_due ?? ((selectedBill.total_amount || 0) - (selectedBill.amount_paid || 0)))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
