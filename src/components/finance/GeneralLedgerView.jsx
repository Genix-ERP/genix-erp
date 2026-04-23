import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronDown, ChevronRight, Download, Loader2, Calendar, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Columns3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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

  // Column visibility (persisted to localStorage). The "account" column is
  // always on — it identifies the row, hiding it makes no sense.
  const COLUMN_PREFS_KEY = 'generalLedger:visibleColumns';
  const defaultVisibleColumns = {
    opening: true,
    debit_turnover: true,
    credit_turnover: true,
    debit_balance: true,
    credit_balance: true,
    closing: true,
  };
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLUMN_PREFS_KEY) || 'null');
      return saved ? { ...defaultVisibleColumns, ...saved } : defaultVisibleColumns;
    } catch {
      return defaultVisibleColumns;
    }
  });
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(visibleColumns)); } catch { /* ignore */ }
  }, [visibleColumns]);

  const toggleColumn = (key) =>
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));

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
    // Search filter — match against code and any of the localized names so users
    // can search by whatever label they see on screen.
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        acc.account_code || '',
        acc.account_name || '',
        acc.account_name_uz || '',
        acc.account_name_en || '',
        acc.account_name_ru || '',
      ].map((s) => s.toLowerCase());
      if (!haystack.some((h) => h.includes(q))) {
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

  // Summary totals — include debit/credit closing balances (BHMS-style ledger,
  // needed for the balance-integrity check at the bottom of the page).
  const totals = filteredAccounts.reduce(
    (sum, acc) => ({
      totalOpening: sum.totalOpening + (acc.opening_balance || 0),
      totalDebit: sum.totalDebit + (acc.total_debit || 0),
      totalCredit: sum.totalCredit + (acc.total_credit || 0),
      closingDebit: sum.closingDebit + (acc.closing_debit || 0),
      closingCredit: sum.closingCredit + (acc.closing_credit || 0),
    }),
    { totalOpening: 0, totalDebit: 0, totalCredit: 0, closingDebit: 0, closingCredit: 0 },
  );

  // Balance-integrity check: in a properly-posted double-entry ledger the total
  // debit closing balance should equal the total credit closing balance.
  // Allow a 1-so'm tolerance to absorb rounding noise.
  const balanceDelta = Math.abs((totals.closingDebit || 0) - (totals.closingCredit || 0));
  const isBalanced = balanceDelta < 1;

  // Pick the localized account name. Mirrors ChartOfAccounts.jsx's pattern so
  // both screens stay consistent: Russian → name_ru, English → name_en, else
  // fall back to name_uz, and ultimately to the legacy `name` column.
  const localizedAccountName = (acc) =>
    (language === 'ru' && acc.account_name_ru) ? acc.account_name_ru
    : (language === 'en' && acc.account_name_en) ? acc.account_name_en
    : (acc.account_name_uz || acc.account_name);

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
              <Dialog open={columnsDialogOpen} onOpenChange={setColumnsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 className="w-4 h-4 mr-1" />
                    {t('columns') || 'Columns'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t('toggle_columns') || 'Toggle columns'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    {[
                      { key: 'opening',         label: t('opening')                || 'Opening' },
                      { key: 'debit_turnover',  label: t('debit_turnover')         || 'Debit (turnover)' },
                      { key: 'credit_turnover', label: t('credit_turnover')        || 'Credit (turnover)' },
                      { key: 'debit_balance',   label: t('closing_debit_balance')  || "Debet qoldig'i" },
                      { key: 'credit_balance',  label: t('closing_credit_balance') || "Kredit qoldig'i" },
                      { key: 'closing',         label: t('closing')                || 'Closing' },
                    ].map((col) => (
                      <label key={col.key} className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={visibleColumns[col.key]}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        <span className="text-sm">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
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
        <div className="space-y-3">
          {/* KPI strip — 4 cards, with the two new debit/credit-closing cards
               outlined in brand colours and flagged "new" per the mockup. */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="p-3">
                <div className="text-xs text-slate-500">{t('total_debit_turnover') || "Jami debet (oborot)"}</div>
                <div className="text-xl font-bold text-slate-700 tabular-nums">{formatCurrency(totals.totalDebit)}</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="p-3">
                <div className="text-xs text-slate-500">{t('total_credit_turnover') || "Jami kredit (oborot)"}</div>
                <div className="text-xl font-bold text-slate-700 tabular-nums">{formatCurrency(totals.totalCredit)}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50/60 border-blue-300">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-blue-700">{t('closing_debit_balance') || "Debet qoldig'i"}</div>
                  <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-300">
                    {t('new') || "yangi"}
                  </Badge>
                </div>
                <div className="text-xl font-bold text-blue-700 tabular-nums">{formatCurrency(totals.closingDebit)}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50/60 border-emerald-300">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-emerald-700">{t('closing_credit_balance') || "Kredit qoldig'i"}</div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                    {t('new') || "yangi"}
                  </Badge>
                </div>
                <div className="text-xl font-bold text-emerald-700 tabular-nums">{formatCurrency(totals.closingCredit)}</div>
              </CardContent>
            </Card>
          </div>

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
            {/* Balance-integrity check */}
            <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border ${
              isBalanced
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {isBalanced
                ? <CheckCircle2 className="w-4 h-4" />
                : <AlertCircle className="w-4 h-4" />}
              <span className="font-medium">
                {t('balance_check') || "Balans tekshiruvi"}:
              </span>
              <span className="tabular-nums">{formatCurrency(totals.closingDebit)}</span>
              <span className="font-semibold">{isBalanced ? '=' : '≠'}</span>
              <span className="tabular-nums">{formatCurrency(totals.closingCredit)}</span>
              {!isBalanced && (
                <span className="text-xs">
                  (Δ {formatCurrency(balanceDelta)})
                </span>
              )}
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
                    {visibleColumns.opening && (
                      <TableHead className="w-[120px] text-right text-xs font-semibold">{t('opening') || 'Opening'}</TableHead>
                    )}
                    {visibleColumns.debit_turnover && (
                      <TableHead className="w-[120px] text-right text-xs font-semibold">{t('debit_turnover') || 'Debit (turnover)'}</TableHead>
                    )}
                    {visibleColumns.credit_turnover && (
                      <TableHead className="w-[120px] text-right text-xs font-semibold">{t('credit_turnover') || 'Credit (turnover)'}</TableHead>
                    )}
                    {visibleColumns.debit_balance && (
                      <TableHead className="w-[120px] text-right text-xs font-semibold bg-blue-50/60 text-blue-700">
                        {t('closing_debit_balance') || "Debet qoldig'i"}
                      </TableHead>
                    )}
                    {visibleColumns.credit_balance && (
                      <TableHead className="w-[120px] text-right text-xs font-semibold bg-emerald-50/60 text-emerald-700">
                        {t('closing_credit_balance') || "Kredit qoldig'i"}
                      </TableHead>
                    )}
                    {visibleColumns.closing && (
                      <TableHead className="w-[130px] text-right text-xs font-semibold">{t('closing') || 'Closing'}</TableHead>
                    )}
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
                              <span className="font-medium text-slate-800">{localizedAccountName(acc)}</span>
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
                          {visibleColumns.opening && (
                            <TableCell className="text-right py-3 text-sm font-medium">
                              {formatCurrency(acc.opening_balance)}
                            </TableCell>
                          )}
                          {visibleColumns.debit_turnover && (
                            <TableCell className="text-right py-3 text-sm font-medium text-blue-600">
                              {formatCurrency(acc.total_debit)}
                            </TableCell>
                          )}
                          {visibleColumns.credit_turnover && (
                            <TableCell className="text-right py-3 text-sm font-medium text-red-600">
                              {formatCurrency(acc.total_credit)}
                            </TableCell>
                          )}
                          {visibleColumns.debit_balance && (
                            <TableCell className="text-right py-3 text-sm font-semibold tabular-nums bg-blue-50/30 text-blue-700">
                              {(acc.closing_debit || 0) > 0 ? formatCurrency(acc.closing_debit) : '—'}
                            </TableCell>
                          )}
                          {visibleColumns.credit_balance && (
                            <TableCell className="text-right py-3 text-sm font-semibold tabular-nums bg-emerald-50/30 text-emerald-700">
                              {(acc.closing_credit || 0) > 0 ? formatCurrency(acc.closing_credit) : '—'}
                            </TableCell>
                          )}
                          {visibleColumns.closing && (
                            <TableCell className="text-right py-3 text-sm font-semibold">
                              {formatCurrency(acc.closing_balance)}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Expanded Transactions */}
                        {isExpanded && hasTransactions && (
                          <>
                            {/* Sub-header */}
                            <TableRow className="bg-slate-100/60">
                              <TableCell></TableCell>
                              <TableCell colSpan={1 + Object.values(visibleColumns).filter(Boolean).length} className="p-0">
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
                  {/* Grand totals row (Jami) — anchors the balance-integrity check */}
                  <TableRow className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
                    <TableCell></TableCell>
                    <TableCell className="py-3 text-sm">{t('total') || 'Jami'}</TableCell>
                    {visibleColumns.opening && (
                      <TableCell className="text-right py-3 text-sm tabular-nums">
                        {formatCurrency(totals.totalOpening)}
                      </TableCell>
                    )}
                    {visibleColumns.debit_turnover && (
                      <TableCell className="text-right py-3 text-sm tabular-nums text-blue-700">
                        {formatCurrency(totals.totalDebit)}
                      </TableCell>
                    )}
                    {visibleColumns.credit_turnover && (
                      <TableCell className="text-right py-3 text-sm tabular-nums text-red-700">
                        {formatCurrency(totals.totalCredit)}
                      </TableCell>
                    )}
                    {visibleColumns.debit_balance && (
                      <TableCell className="text-right py-3 text-sm tabular-nums bg-blue-100 text-blue-800">
                        {formatCurrency(totals.closingDebit)}
                      </TableCell>
                    )}
                    {visibleColumns.credit_balance && (
                      <TableCell className="text-right py-3 text-sm tabular-nums bg-emerald-100 text-emerald-800">
                        {formatCurrency(totals.closingCredit)}
                      </TableCell>
                    )}
                    {visibleColumns.closing && <TableCell></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
