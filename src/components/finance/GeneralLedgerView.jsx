import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronDown, ChevronRight, Download, Loader2, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import financeService from "@/api/services/finance";

export default function GeneralLedgerView() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { accounts } = useFinancials();
  const { formatCurrency } = useCurrencyFormatter();

  const [ledgerData, setLedgerData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');

  // Date range - default to current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [periodFrom, setPeriodFrom] = useState(format(firstOfMonth, 'yyyy-MM-dd'));
  const [periodTo, setPeriodTo] = useState(format(now, 'yyyy-MM-dd'));

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await financeService.getGeneralLedger({
        period_from: periodFrom,
        period_to: periodTo,
      });
      setLedgerData(data);
    } catch (err) {
      console.error('Failed to fetch general ledger:', err);
      setError(err.message || 'Failed to load general ledger');
    } finally {
      setIsLoading(false);
    }
  }, [periodFrom, periodTo]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const toggleAccount = (accountId) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const expandAll = () => {
    if (!ledgerData?.accounts) return;
    const all = {};
    ledgerData.accounts.forEach(acc => { all[acc.account_id] = true; });
    setExpandedAccounts(all);
  };

  const collapseAll = () => {
    setExpandedAccounts({});
  };

  // Get account type category from accounts context
  const getAccountType = (accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc?.account_type?.category || '';
  };

  // Filter accounts
  const filteredAccounts = (ledgerData?.accounts || []).filter(acc => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!acc.account_code.toLowerCase().includes(q) && !acc.account_name.toLowerCase().includes(q)) {
        return false;
      }
    }
    // Account type filter
    if (accountTypeFilter !== 'all') {
      const type = getAccountType(acc.account_id);
      if (type !== accountTypeFilter) return false;
    }
    return true;
  });

  // Summary totals
  const totals = filteredAccounts.reduce((sum, acc) => ({
    totalDebit: sum.totalDebit + acc.total_debit,
    totalCredit: sum.totalCredit + acc.total_credit,
  }), { totalDebit: 0, totalCredit: 0 });

  const accountTypeLabel = (type) => {
    const labels = {
      asset: t('asset') || 'Asset',
      liability: t('liability') || 'Liability',
      equity: t('equity') || 'Equity',
      income: t('income') || 'Income',
      expense: t('expense') || 'Expense',
    };
    return labels[type] || type;
  };

  const accountTypeColor = (type) => {
    const colors = {
      asset: 'bg-blue-100 text-blue-800',
      liability: 'bg-red-100 text-red-800',
      equity: 'bg-purple-100 text-purple-800',
      income: 'bg-green-100 text-green-800',
      expense: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">{t('start_date') || 'Start Date'}</label>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">{t('end_date') || 'End Date'}</label>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="w-40"
              />
            </div>

            {/* Account Type Filter */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">{t('account_type') || 'Account Type'}</label>
              <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                  <SelectItem value="asset">{t('asset') || 'Asset'}</SelectItem>
                  <SelectItem value="liability">{t('liability') || 'Liability'}</SelectItem>
                  <SelectItem value="equity">{t('equity') || 'Equity'}</SelectItem>
                  <SelectItem value="income">{t('income') || 'Income'}</SelectItem>
                  <SelectItem value="expense">{t('expense') || 'Expense'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-slate-500 font-medium">{t('search') || 'Search'}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search_accounts') || 'Search accounts...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                {t('expand_all') || 'Expand All'}
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                {t('collapse_all') || 'Collapse All'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">{t('loading') || 'Loading...'}</span>
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-red-500">{error}</div>
      )}

      {/* Ledger Content */}
      {!isLoading && !error && ledgerData && (
        <div className="space-y-2">
          {/* Period info */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>
                {ledgerData.period_from} — {ledgerData.period_to}
              </span>
              <span className="text-slate-400">|</span>
              <span>{filteredAccounts.length} {t('accounts') || 'accounts'}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500">
                {t('total_debit') || 'Total Debit'}: <span className="font-semibold text-slate-700">{formatCurrency(totals.totalDebit)}</span>
              </span>
              <span className="text-slate-500">
                {t('total_credit') || 'Total Credit'}: <span className="font-semibold text-slate-700">{formatCurrency(totals.totalCredit)}</span>
              </span>
            </div>
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {t('no_data') || 'No data found'}
            </div>
          ) : (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-xs font-semibold">{t('account') || 'Account'}</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{t('opening') || 'Opening'}</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{t('debit') || 'Debit'}</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{t('credit') || 'Credit'}</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{t('closing') || 'Closing'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map(acc => {
                    const isExpanded = expandedAccounts[acc.account_id];
                    const accType = getAccountType(acc.account_id);
                    const hasTransactions = acc.transactions && acc.transactions.length > 0;

                    return (
                      <React.Fragment key={acc.account_id}>
                        {/* Account Row */}
                        <TableRow
                          className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50/60' : ''}`}
                          onClick={() => hasTransactions && toggleAccount(acc.account_id)}
                        >
                          <TableCell className="px-2 py-3">
                            {hasTransactions ? (
                              isExpanded ?
                                <ChevronDown className="w-4 h-4 text-slate-400" /> :
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            ) : (
                              <div className="w-4" />
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-slate-500">{acc.account_code}</span>
                              <span className="font-medium text-slate-800">{acc.account_name}</span>
                              {accType && (
                                <Badge variant="outline" className={`text-xs ${accountTypeColor(accType)}`}>
                                  {accountTypeLabel(accType)}
                                </Badge>
                              )}
                              {hasTransactions && (
                                <span className="text-xs text-slate-400">
                                  ({acc.transactions.length} {t('transactions') || 'transactions'})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm font-medium">
                            {formatCurrency(acc.opening_balance)}
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm font-medium text-blue-600">
                            {formatCurrency(acc.total_debit)}
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm font-medium text-red-600">
                            {formatCurrency(acc.total_credit)}
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm font-semibold">
                            {formatCurrency(acc.closing_balance)}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Transactions */}
                        {isExpanded && hasTransactions && (
                          <>
                            {/* Sub-header */}
                            <TableRow className="bg-slate-100/60">
                              <TableCell></TableCell>
                              <TableCell colSpan={5} className="p-0">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-slate-100/60 border-0">
                                      <TableHead className="w-[100px] text-xs">{t('date') || 'Date'}</TableHead>
                                      <TableHead className="w-[120px] text-xs">{t('entry_number') || 'Entry #'}</TableHead>
                                      <TableHead className="text-xs">{t('description') || 'Description'}</TableHead>
                                      <TableHead className="w-[120px] text-xs">{t('reference') || 'Reference'}</TableHead>
                                      <TableHead className="w-[120px] text-right text-xs">{t('debit') || 'Debit'}</TableHead>
                                      <TableHead className="w-[120px] text-right text-xs">{t('credit') || 'Credit'}</TableHead>
                                      <TableHead className="w-[130px] text-right text-xs">{t('balance') || 'Balance'}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {/* Opening balance row */}
                                    <TableRow className="bg-slate-50/30">
                                      <TableCell colSpan={6} className="text-xs font-medium text-slate-500 italic">
                                        {t('opening_balance') || 'Opening Balance'}
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-medium">
                                        {formatCurrency(acc.opening_balance)}
                                      </TableCell>
                                    </TableRow>
                                    {acc.transactions.map((tx, idx) => (
                                      <TableRow key={idx} className="hover:bg-slate-50/50">
                                        <TableCell className="text-xs text-slate-600">{tx.date}</TableCell>
                                        <TableCell className="text-xs font-mono text-slate-600">{tx.entry_number}</TableCell>
                                        <TableCell className="text-xs text-slate-700">{tx.description || '-'}</TableCell>
                                        <TableCell className="text-xs text-slate-500">{tx.reference || '-'}</TableCell>
                                        <TableCell className="text-right text-xs">
                                          {tx.debit_amount > 0 ? (
                                            <span className="text-blue-600">{formatCurrency(tx.debit_amount)}</span>
                                          ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-xs">
                                          {tx.credit_amount > 0 ? (
                                            <span className="text-red-600">{formatCurrency(tx.credit_amount)}</span>
                                          ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-medium">
                                          {formatCurrency(tx.running_balance)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    {/* Closing balance row */}
                                    <TableRow className="bg-slate-50/50 border-t-2 border-slate-200">
                                      <TableCell colSpan={4} className="text-xs font-semibold text-slate-600">
                                        {t('closing_balance') || 'Closing Balance'}
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-semibold text-blue-700">
                                        {formatCurrency(acc.total_debit)}
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-semibold text-red-700">
                                        {formatCurrency(acc.total_credit)}
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-bold">
                                        {formatCurrency(acc.closing_balance)}
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
