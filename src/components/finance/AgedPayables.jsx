import { formatDate } from '@/utils/formatDate';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Search, ChevronDown, ChevronRight, ArrowUpDown, Loader2,
  Calendar, FileText, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import financeService from '@/api/services/finance';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function AgedPayables() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [sortField, setSortField] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const loadData = async (date) => {
    setIsLoading(true);
    try {
      const result = await financeService.getAgingPayables({ as_of_date: date });
      setData(result);
    } catch (err) {
      console.error('Failed to load aging payables:', err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(asOfDate);
  }, [asOfDate]);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredContacts = useMemo(() => {
    if (!data?.contacts) return [];
    let list = data.contacts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.contact_name?.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      const fieldMap = {
        name: 'contact_name',
        current: 'current',
        '1-30': 'days_1_to_30',
        '31-60': 'days_31_to_60',
        '61-90': 'days_61_to_90',
        '90+': 'over_90_days',
        total: 'total_amount',
      };
      const key = fieldMap[sortField] || 'total_amount';
      const aVal = key === 'contact_name' ? (a[key] || '') : (a[key] || 0);
      const bVal = key === 'contact_name' ? (b[key] || '') : (b[key] || 0);
      if (key === 'contact_name') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [data, searchQuery, sortField, sortDir]);

  const totals = useMemo(() => {
    return filteredContacts.reduce((acc, c) => ({
      current: acc.current + (c.current || 0),
      days1to30: acc.days1to30 + (c.days_1_to_30 || 0),
      days31to60: acc.days31to60 + (c.days_31_to_60 || 0),
      days61to90: acc.days61to90 + (c.days_61_to_90 || 0),
      over90: acc.over90 + (c.over_90_days || 0),
      total: acc.total + (c.total_amount || 0),
    }), { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 });
  }, [filteredContacts]);

  const pct = (val) => totals.total > 0 ? ((val / totals.total) * 100).toFixed(1) : '0.0';

  // Payables are liabilities — display as negative amounts
  const formatPayableAmount = (amount) => {
    if (amount === 0 || amount === undefined || amount === null) return '-';
    return `-${formatCurrency(amount)}`;
  };
  const formatPayableAmountCompact = (amount) => {
    if (amount === 0 || amount === undefined || amount === null) return '-';
    return `-${formatCurrencyCompact(amount)}`;
  };

  const SortHeader = ({ field, children, className = '' }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-slate-50 ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-purple-600' : 'text-slate-300'}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {t('aged_payables') || 'Aged Payables'}
            </h2>
            <p className="text-sm text-slate-500">
              {t('aged_payables_desc') || 'Outstanding vendor bills by aging period'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-40 h-9 text-sm"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder={t('search') || 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('total') || 'Total'}</p>
              <p className="text-lg font-bold text-red-700 mt-1">{formatPayableAmountCompact(totals.total)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{filteredContacts.length} {t('vendors') || 'vendors'}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-green-200/60">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide">{t('not_due') || 'Not Due'}</p>
              <p className="text-lg font-bold text-green-700 mt-1">{formatPayableAmountCompact(totals.current)}</p>
              <p className="text-xs text-green-500 mt-0.5">{pct(totals.current)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-yellow-200/60">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">1-30 {t('days') || 'days'}</p>
              <p className="text-lg font-bold text-yellow-700 mt-1">{formatPayableAmountCompact(totals.days1to30)}</p>
              <p className="text-xs text-yellow-500 mt-0.5">{pct(totals.days1to30)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-orange-200/60">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">31-60 {t('days') || 'days'}</p>
              <p className="text-lg font-bold text-orange-700 mt-1">{formatPayableAmountCompact(totals.days31to60)}</p>
              <p className="text-xs text-orange-500 mt-0.5">{pct(totals.days31to60)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-red-200/60">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide">61-90 {t('days') || 'days'}</p>
              <p className="text-lg font-bold text-red-700 mt-1">{formatPayableAmountCompact(totals.days61to90)}</p>
              <p className="text-xs text-red-500 mt-0.5">{pct(totals.days61to90)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-red-300/60">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-red-700 uppercase tracking-wide">90+ {t('days') || 'days'}</p>
              <p className="text-lg font-bold text-red-800 mt-1">{formatPayableAmountCompact(totals.over90)}</p>
              <p className="text-xs text-red-600 mt-0.5">{pct(totals.over90)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredContacts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-8"></TableHead>
                    <SortHeader field="name">{t('vendor') || 'Vendor'}</SortHeader>
                    <SortHeader field="current" className="text-right">{t('not_due') || 'Not Due'}</SortHeader>
                    <SortHeader field="1-30" className="text-right">1-30</SortHeader>
                    <SortHeader field="31-60" className="text-right">31-60</SortHeader>
                    <SortHeader field="61-90" className="text-right">61-90</SortHeader>
                    <SortHeader field="90+" className="text-right">90+</SortHeader>
                    <SortHeader field="total" className="text-right">{t('total') || 'Total'}</SortHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <React.Fragment key={contact.contact_id}>
                      <TableRow
                        className="cursor-pointer hover:bg-purple-50/40 transition-colors"
                        onClick={() => toggleRow(contact.contact_id)}
                      >
                        <TableCell className="w-8 px-3">
                          {expandedRows[contact.contact_id]
                            ? <ChevronDown className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />
                          }
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">{contact.contact_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600">
                          {contact.current > 0 ? formatPayableAmount(contact.current) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-yellow-600">
                          {contact.days_1_to_30 > 0 ? formatPayableAmount(contact.days_1_to_30) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-orange-600">
                          {contact.days_31_to_60 > 0 ? formatPayableAmount(contact.days_31_to_60) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-600">
                          {contact.days_61_to_90 > 0 ? formatPayableAmount(contact.days_61_to_90) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-800">
                          {contact.over_90_days > 0 ? formatPayableAmount(contact.over_90_days) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-red-700">
                          {formatPayableAmount(contact.total_amount)}
                        </TableCell>
                      </TableRow>

                      {expandedRows[contact.contact_id] && contact.invoices?.map((inv) => {
                        const isPayment = inv.amount_due < 0;
                        const formatAmt = (amt) => {
                          if (amt === 0 || amt === undefined || amt === null) return '-';
                          if (amt < 0) return formatCurrency(Math.abs(amt));
                          return `-${formatCurrency(amt)}`;
                        };
                        return (
                        <TableRow key={inv.invoice_id} className={isPayment ? "bg-blue-50/40" : "bg-slate-50/60"}>
                          <TableCell></TableCell>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-2">
                              <FileText className={`w-3.5 h-3.5 ${isPayment ? 'text-blue-400' : 'text-slate-400'}`} />
                              <span className={`text-sm ${isPayment ? 'text-blue-700' : 'text-slate-700'}`}>{inv.invoice_number}</span>
                              {isPayment ? (
                                <Badge variant="outline" className="text-xs px-1.5 py-0 text-blue-600 border-blue-200">
                                  {t('payment') || 'To\'lov'}
                                </Badge>
                              ) : (
                                <>
                                  <span className="text-xs text-slate-400">
                                    {t('due') || 'Due'}: {formatDate(inv.due_date)}
                                  </span>
                                  {inv.days_overdue > 0 && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0 text-red-600 border-red-200">
                                      {inv.days_overdue}d
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs ${inv.aging_bucket === 'current' ? (isPayment ? 'text-blue-600' : 'text-green-600') : ''}`}>
                            {inv.aging_bucket === 'current' ? formatAmt(inv.amount_due) : ''}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs ${inv.aging_bucket === '1-30' ? (isPayment ? 'text-blue-600' : 'text-yellow-600') : ''}`}>
                            {inv.aging_bucket === '1-30' ? formatAmt(inv.amount_due) : ''}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs ${inv.aging_bucket === '31-60' ? (isPayment ? 'text-blue-600' : 'text-orange-600') : ''}`}>
                            {inv.aging_bucket === '31-60' ? formatAmt(inv.amount_due) : ''}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs ${inv.aging_bucket === '61-90' ? (isPayment ? 'text-blue-600' : 'text-red-600') : ''}`}>
                            {inv.aging_bucket === '61-90' ? formatAmt(inv.amount_due) : ''}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs ${inv.aging_bucket === '90+' ? (isPayment ? 'text-blue-600' : 'text-red-800') : ''}`}>
                            {inv.aging_bucket === '90+' ? formatAmt(inv.amount_due) : ''}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs ${isPayment ? 'text-blue-600' : 'text-slate-600'}`}>
                            {formatAmt(inv.amount_due)}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  {/* Totals row */}
                  <TableRow className="bg-slate-100/80 border-t-2 border-slate-300">
                    <TableCell></TableCell>
                    <TableCell className="font-bold text-slate-900">{t('total') || 'Total'}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-green-700">
                      {totals.current > 0 ? formatPayableAmount(totals.current) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-yellow-700">
                      {totals.days1to30 > 0 ? formatPayableAmount(totals.days1to30) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-orange-700">
                      {totals.days31to60 > 0 ? formatPayableAmount(totals.days31to60) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-700">
                      {totals.days61to90 > 0 ? formatPayableAmount(totals.days61to90) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-800">
                      {totals.over90 > 0 ? formatPayableAmount(totals.over90) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-700">
                      {formatPayableAmount(totals.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <AlertTriangle className="w-10 h-10 mb-3 text-slate-300" />
              <p>{t('no_outstanding_payables') || 'No outstanding payables'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
