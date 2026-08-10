import { formatDate } from '@/utils/formatDate';
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users, Building2, Search, ChevronDown, ChevronRight, ArrowUpDown, Loader2,
  Calendar, FileText, AlertTriangle, ChevronLeft,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import financeService from '@/api/services/finance';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

// One aging screen, two variants.
//
// AgedReceivables (391 lines) and AgedPayables (370) were a copy of each other
// that had drifted: AP prepended "-" without testing the sign, so a vendor
// overpayment rendered as a larger debt, and only AR used the same empty-value
// helper for all six cards. Two files meant every fix had to be made twice, and
// twice it wasn't. The differences that are real — endpoint, wording, accent
// colour and the payable sign convention — are the only things parameterised.

const PAGE_SIZE = 20;

// Server field names, so the sort parameter is the name the row already shows.
const SORT_FIELDS = {
  name: 'contact_name',
  current: 'current',
  '1-30': 'days_1_to_30',
  '31-60': 'days_31_to_60',
  '61-90': 'days_61_to_90',
  '90+': 'over_90_days',
  total: 'total_amount',
};

const BUCKET_COLOR = {
  current: 'text-green-600',
  '1-30': 'text-yellow-600',
  '31-60': 'text-orange-600',
  '61-90': 'text-red-600',
  '90+': 'text-red-800',
};

export default function AgingReport({ variant }) {
  const isPayable = variant === 'payable';
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [sortField, setSortField] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  // Typing must not fire a request per keystroke — the report walks the whole
  // ledger and applies FIFO before it can answer.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        as_of_date: asOfDate,
        page,
        page_size: PAGE_SIZE,
        sort: SORT_FIELDS[sortField] || 'total_amount',
        order: sortDir,
      };
      if (search) params.search = search;
      const fetcher = isPayable ? financeService.getAgingPayables : financeService.getAgingReceivables;
      setData(await fetcher(params));
    } catch (err) {
      console.error('Failed to load aging report:', err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate, page, sortField, sortDir, search, isPayable]);

  useEffect(() => { loadData(); }, [loadData]);
  // Anything that changes the result set returns to page 1; staying on page 7
  // of the previous set renders an empty table that reads as "no data".
  useEffect(() => { setPage(1); }, [asOfDate, search, sortField, sortDir]);

  const contacts = data?.contacts || [];
  const meta = data?.meta || null;
  const totalPages = meta?.total_pages || 1;
  const totalContacts = meta?.total ?? contacts.length;

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSort = (field) => {
    if (sortField === field) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  // Search, sort and paging are all server parameters now. Doing them here
  // meant sorting twenty of the tenant's partners and calling the result "the
  // largest debts", and it made the cards describe the search result while the
  // label still said "Jami".
  const totals = {
    current: data?.current_total || 0,
    days1to30: data?.days_1_to_30 || 0,
    days31to60: data?.days_31_to_60 || 0,
    days61to90: data?.days_61_to_90 || 0,
    over90: data?.over_90_days || 0,
    total: data?.total_amount || 0,
  };

  // The server's denominator is the sum of the POSITIVE buckets, so a negative
  // grand total no longer short-circuits every bucket to "0.0%" — the old guard
  // printed a confident 0.0 beside a real 32.5m in 90+ whenever credits
  // outweighed invoices. null means "not meaningful": render an em dash.
  const pct = (key) => {
    const v = data?.percentages?.[key];
    return v === undefined || v === null ? '—' : v.toFixed(1);
  };

  // Sign handling, the one genuine difference between the two variants.
  //
  // Payables are liabilities, so a positive balance displays negative — but the
  // sign MUST be tested first. A vendor overpayment leaves total_amount
  // negative through the same FIFO-leftover path receivables have, and
  // prepending "-" unconditionally turned that credit into a bigger apparent
  // debt.
  const withSign = (amount, fmt) => {
    if (!amount) return '-';
    const abs = fmt(Math.abs(amount));
    if (isPayable) return amount < 0 ? abs : `-${abs}`;
    return amount < 0 ? `-${abs}` : abs;
  };
  // Both the compact card figures and the full table figures go through the
  // same helper, so 0 renders as "-" everywhere. Previously Total and Not-Due
  // used one helper and the four bucket cards another, giving one screen two
  // different empties.
  const formatAmount = (amount) => withSign(amount, formatCurrency);
  const formatAmountCompact = (amount) => withSign(amount, formatCurrencyCompact);

  // Blue marks money flowing the other way: a customer credit on AR, a vendor
  // credit on AP. Zero is neutral.
  const amountColor = (amount, bucketColor) => {
    if (amount < 0) return 'text-blue-600';
    if (amount > 0) return bucketColor;
    return '';
  };
  // The grand-total column: a payable in credit is money coming back, so it
  // reads blue on both screens; an outstanding payable is red, an outstanding
  // receivable neutral.
  const totalColor = (amount) => {
    if (amount < 0) return 'text-blue-600';
    if (amount > 0) return isPayable ? 'text-red-700' : 'text-slate-900';
    return 'text-slate-500';
  };

  // Written out in full, never interpolated: Tailwind scans source text, so a
  // class built as `bg-${accent}-50` is never generated and the element ends up
  // unstyled.
  const accent = isPayable
    ? { iconBg: 'bg-purple-50', icon: 'text-purple-600', sortActive: 'text-purple-600', rowHover: 'hover:bg-purple-50/40' }
    : { iconBg: 'bg-blue-50', icon: 'text-blue-600', sortActive: 'text-blue-600', rowHover: 'hover:bg-blue-50/40' };
  const Icon = isPayable ? Building2 : Users;
  const partyLabel = isPayable ? (t('vendor') || 'Vendor') : (t('partner') || 'Partner');
  const partyCountLabel = isPayable ? (t('vendors') || 'vendors') : (t('partners') || 'partners');

  const SortHeader = ({ field, children, className = '' }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-slate-50 ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? accent.sortActive : 'text-slate-300'}`} />
      </div>
    </TableHead>
  );

  const cards = [
    { key: null, label: t('total') || 'Total', value: totals.total, border: 'border-slate-200/60', labelColor: 'text-slate-500' },
    { key: 'current', label: t('not_due') || 'Not Due', value: totals.current, border: 'border-green-200/60', labelColor: 'text-green-600' },
    { key: 'days_1_to_30', label: `1-30 ${t('days') || 'days'}`, value: totals.days1to30, border: 'border-yellow-200/60', labelColor: 'text-yellow-600' },
    { key: 'days_31_to_60', label: `31-60 ${t('days') || 'days'}`, value: totals.days31to60, border: 'border-orange-200/60', labelColor: 'text-orange-600' },
    { key: 'days_61_to_90', label: `61-90 ${t('days') || 'days'}`, value: totals.days61to90, border: 'border-red-200/60', labelColor: 'text-red-600' },
    { key: 'over_90_days', label: `90+ ${t('days') || 'days'}`, value: totals.over90, border: 'border-red-300/60', labelColor: 'text-red-700' },
  ];

  const BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'];
  const bucketValue = (contact, bucket) => ({
    current: contact.current,
    '1-30': contact.days_1_to_30,
    '31-60': contact.days_31_to_60,
    '61-90': contact.days_61_to_90,
    '90+': contact.over_90_days,
  }[bucket]);
  const totalsValue = (bucket) => ({
    current: totals.current,
    '1-30': totals.days1to30,
    '31-60': totals.days31to60,
    '61-90': totals.days61to90,
    '90+': totals.over90,
  }[bucket]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${accent.iconBg} rounded-lg`}>
            <Icon className={`w-5 h-5 ${accent.icon}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isPayable ? (t('aged_payables') || 'Aged Payables') : (t('aged_receivables') || 'Aged Receivables')}
            </h2>
            <p className="text-sm text-slate-500">
              {isPayable
                ? (t('aged_payables_desc') || 'Outstanding vendor bills by aging period')
                : (t('aged_receivables_desc') || 'Outstanding customer invoices by aging period')}
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-48 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map((card) => (
            <Card key={card.label} className={`bg-white/80 backdrop-blur-sm ${card.border}`}>
              <CardContent className="p-4">
                <p className={`text-xs font-medium ${card.labelColor} uppercase tracking-wide`}>{card.label}</p>
                <p className={`text-lg font-bold mt-1 ${card.key === null ? totalColor(card.value) : amountColor(card.value, card.labelColor) || 'text-slate-900'}`}>
                  {formatAmountCompact(card.value)}
                </p>
                {/* Totals follow the search, so the count beside them must too:
                    meta.total is the size of the FILTERED set, not the page. */}
                {card.key === null
                  ? <p className="text-xs text-slate-400 mt-0.5">{totalContacts} {partyCountLabel}</p>
                  : <p className={`text-xs ${card.labelColor} mt-0.5`}>{pct(card.key)}%</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : contacts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-8"></TableHead>
                    <SortHeader field="name">{partyLabel}</SortHeader>
                    <SortHeader field="current" className="text-right">{t('not_due') || 'Not Due'}</SortHeader>
                    <SortHeader field="1-30" className="text-right">1-30</SortHeader>
                    <SortHeader field="31-60" className="text-right">31-60</SortHeader>
                    <SortHeader field="61-90" className="text-right">61-90</SortHeader>
                    <SortHeader field="90+" className="text-right">90+</SortHeader>
                    <SortHeader field="total" className="text-right">{t('total') || 'Total'}</SortHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <React.Fragment key={contact.contact_id}>
                      <TableRow
                        className={`cursor-pointer ${accent.rowHover} transition-colors`}
                        onClick={() => toggleRow(contact.contact_id)}
                      >
                        <TableCell className="w-8 px-3">
                          {expandedRows[contact.contact_id]
                            ? <ChevronDown className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">{contact.contact_name}</TableCell>
                        {BUCKETS.map((bucket) => (
                          <TableCell key={bucket}
                            className={`text-right font-mono text-sm ${amountColor(bucketValue(contact, bucket), BUCKET_COLOR[bucket])}`}>
                            {formatAmount(bucketValue(contact, bucket))}
                          </TableCell>
                        ))}
                        <TableCell className={`text-right font-mono text-sm font-bold ${totalColor(contact.total_amount)}`}>
                          {formatAmount(contact.total_amount)}
                        </TableCell>
                      </TableRow>

                      {/* Expanded document rows */}
                      {expandedRows[contact.contact_id] && contact.invoices?.map((inv) => {
                        const isCredit = inv.amount_due < 0;
                        return (
                          <TableRow key={inv.invoice_id} className={isCredit ? 'bg-blue-50/40' : 'bg-slate-50/60'}>
                            <TableCell></TableCell>
                            <TableCell className="pl-8">
                              <div className="flex items-center gap-2">
                                <FileText className={`w-3.5 h-3.5 ${isCredit ? 'text-blue-400' : 'text-slate-400'}`} />
                                <span className={`text-sm ${isCredit ? 'text-blue-700' : 'text-slate-700'}`}>{inv.invoice_number}</span>
                                {isCredit ? (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 text-blue-600 border-blue-200">
                                    {t('payment') || "To'lov"}
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
                            {BUCKETS.map((bucket) => (
                              <TableCell key={bucket}
                                className={`text-right font-mono text-xs ${inv.aging_bucket === bucket ? amountColor(inv.amount_due, BUCKET_COLOR[bucket]) : ''}`}>
                                {inv.aging_bucket === bucket ? formatAmount(inv.amount_due) : ''}
                              </TableCell>
                            ))}
                            <TableCell className={`text-right font-mono text-xs ${inv.amount_due < 0 ? 'text-blue-600' : 'text-slate-600'}`}>
                              {formatAmount(inv.amount_due)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  {/* Totals row — the whole filtered set, not this page. */}
                  <TableRow className="bg-slate-100/80 border-t-2 border-slate-300">
                    <TableCell></TableCell>
                    <TableCell className="font-bold text-slate-900">{t('total') || 'Total'}</TableCell>
                    {BUCKETS.map((bucket) => (
                      <TableCell key={bucket}
                        className={`text-right font-mono font-bold ${amountColor(totalsValue(bucket), BUCKET_COLOR[bucket])}`}>
                        {formatAmount(totalsValue(bucket))}
                      </TableCell>
                    ))}
                    <TableCell className={`text-right font-mono font-bold ${totalColor(totals.total)}`}>
                      {formatAmount(totals.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-slate-600">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalContacts)} / {totalContacts}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <AlertTriangle className="w-10 h-10 mb-3 text-slate-300" />
              {/* An empty search result is not an empty ledger. */}
              <p>
                {search
                  ? (t('no_results_found') || 'Natija topilmadi')
                  : isPayable
                    ? (t('no_outstanding_payables') || 'No outstanding payables')
                    : (t('no_outstanding_receivables') || 'No outstanding receivables')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
