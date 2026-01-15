import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Wallet, DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Calendar, User, Receipt, Filter, Download, Printer, TrendingUp, TrendingDown,
  PiggyBank, Banknote, ArrowRightLeft
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";

export default function CashRegister() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    cashTransactions,
    createCashTransaction,
    updateCashTransaction,
    deleteCashTransaction,
    getCashBalance,
    isLoading
  } = useFinancials();

  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newTransaction, setNewTransaction] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'income',
    amount: '',
    currency: 'UZS',
    description: '',
    category: 'sales',
    cashier: ''
  });

  const getCategories = () => ({
    income: [
      { value: 'sales', label: t('sales_category') || 'Sales' },
      { value: 'services', label: t('services_category') || 'Services' },
      { value: 'refund', label: t('refund_category') || 'Refund' },
      { value: 'other_income', label: t('other_income_category') || 'Other Income' }
    ],
    expense: [
      { value: 'purchase', label: t('purchase_category') || 'Purchase' },
      { value: 'salary', label: t('salary_category') || 'Salary' },
      { value: 'rent', label: t('rent_category') || 'Rent' },
      { value: 'utilities', label: t('utilities_category') || 'Utilities' },
      { value: 'office', label: t('office_category') || 'Office' },
      { value: 'transport', label: t('transport_category') || 'Transport' },
      { value: 'other_expense', label: t('other_expense_category') || 'Other Expense' }
    ],
    transfer: [
      { value: 'bank_deposit', label: t('bank_deposit_category') || 'Bank Deposit' },
      { value: 'bank_withdrawal', label: t('bank_withdrawal_category') || 'Bank Withdrawal' }
    ]
  });

  const categories = getCategories();

  // Calculate summaries
  const today = new Date().toISOString().split('T')[0];
  const summaryStats = {
    currentBalance: getCashBalance(),
    todayIncome: cashTransactions
      .filter(t => t.transaction_date === today && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
    todayExpense: cashTransactions
      .filter(t => t.transaction_date === today && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
    todayTransfers: cashTransactions
      .filter(t => t.transaction_date === today && t.type === 'transfer')
      .reduce((sum, t) => sum + t.amount, 0),
    transactionCount: cashTransactions.filter(t => t.transaction_date === today).length
  };

  useEffect(() => {
    let filtered = [...cashTransactions];

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.cashier?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    if (dateFilter === "today") {
      filtered = filtered.filter(t => t.transaction_date === today);
    } else if (dateFilter === "week") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      filtered = filtered.filter(t => t.transaction_date >= weekAgo);
    } else if (dateFilter === "month") {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      filtered = filtered.filter(t => t.transaction_date >= monthAgo);
    }

    setFilteredTransactions(filtered.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)));
  }, [cashTransactions, searchQuery, typeFilter, dateFilter, today]);

  const handleCreateTransaction = async () => {
    setIsSaving(true);
    try {
      await createCashTransaction({
        ...newTransaction,
        amount: parseFloat(newTransaction.amount) || 0
      });
      setNewTransaction({
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'income',
        amount: '',
        currency: 'UZS',
        description: '',
        category: 'sales',
        cashier: ''
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating cash transaction:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount, currency = 'UZS') => {
    if (currency === 'UZS') {
      return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'income':
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case 'expense':
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case 'transfer':
        return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'income':
        return <Badge className="bg-green-100 text-green-700"><ArrowDownLeft className="w-3 h-3 mr-1" /> {t('income') || 'Income'}</Badge>;
      case 'expense':
        return <Badge className="bg-red-100 text-red-700"><ArrowUpRight className="w-3 h-3 mr-1" /> {t('expense') || 'Expense'}</Badge>;
      case 'transfer':
        return <Badge className="bg-blue-100 text-blue-700"><ArrowRightLeft className="w-3 h-3 mr-1" /> {t('transfer') || 'Transfer'}</Badge>;
      default:
        return null;
    }
  };

  const getCategoryLabel = (type, category) => {
    const cats = categories[type] || [];
    const found = cats.find(c => c.value === category);
    return found ? found.label : category;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">{t('cash_balance') || 'Cash Balance'}</p>
                <p className="text-3xl font-bold text-emerald-800">{formatCurrency(summaryStats.currentBalance)}</p>
                <p className="text-xs text-emerald-500 mt-1">{t('current_state') || 'Current state'}</p>
              </div>
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <PiggyBank className="w-7 h-7 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">{t('today_income') || 'Today Income'}</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(summaryStats.todayIncome)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">{t('today_expense') || 'Today Expense'}</p>
                <p className="text-2xl font-bold text-red-800">{formatCurrency(summaryStats.todayExpense)}</p>
              </div>
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">{t('today') || 'Today'}</p>
                <p className="text-2xl font-bold text-blue-800">{summaryStats.transactionCount}</p>
                <p className="text-xs text-blue-500">{t('transaction') || 'transaction'}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setNewTransaction({ ...newTransaction, type: 'income', category: 'sales' });
              setShowCreateModal(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <ArrowDownLeft className="w-4 h-4 mr-2" />
            {t('income') || 'Income'}
          </Button>
          <Button
            onClick={() => {
              setNewTransaction({ ...newTransaction, type: 'expense', category: 'purchase' });
              setShowCreateModal(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            {t('expense') || 'Expense'}
          </Button>
          <Button
            onClick={() => {
              setNewTransaction({ ...newTransaction, type: 'transfer', category: 'bank_deposit' });
              setShowCreateModal(true);
            }}
            variant="outline"
            className="border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            {t('transfer') || 'Transfer'}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            {t('print') || 'Print'}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            {t('export') || 'Export'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search_transaction') || 'Search transaction...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('type') || 'Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                <SelectItem value="income">{t('income') || 'Income'}</SelectItem>
                <SelectItem value="expense">{t('expense') || 'Expense'}</SelectItem>
                <SelectItem value="transfer">{t('transfer') || 'Transfer'}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('period') || 'Period'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                <SelectItem value="today">{t('today') || 'Today'}</SelectItem>
                <SelectItem value="week">{t('this_week') || 'This Week'}</SelectItem>
                <SelectItem value="month">{t('this_month') || 'This Month'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('cash_transactions') || 'Cash Transactions'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>{t('date') || 'Date'}</TableHead>
                <TableHead>{t('reference') || 'Reference'}</TableHead>
                <TableHead>{t('description') || 'Description'}</TableHead>
                <TableHead>{t('category') || 'Category'}</TableHead>
                <TableHead>{t('type') || 'Type'}</TableHead>
                <TableHead>{t('cashier') || 'Cashier'}</TableHead>
                <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-slate-50">
                  <TableCell>{format(new Date(transaction.transaction_date), 'dd.MM.yyyy')}</TableCell>
                  <TableCell className="font-mono text-sm">{transaction.reference}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{transaction.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCategoryLabel(transaction.type, transaction.category)}</Badge>
                  </TableCell>
                  <TableCell>{getTypeBadge(transaction.type)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      {transaction.cashier || '-'}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${
                    transaction.type === 'income' ? 'text-green-600' :
                    transaction.type === 'expense' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    {t('no_transactions') || 'No transactions'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Transaction Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {newTransaction.type === 'income' && (t('new_income') || 'New Income')}
              {newTransaction.type === 'expense' && (t('new_expense') || 'New Expense')}
              {newTransaction.type === 'transfer' && (t('new_transfer') || 'New Transfer')}
            </DialogTitle>
            <DialogDescription>{t('enter_cash_transaction') || 'Enter cash transaction'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('date') || 'Date'}</label>
                <Input
                  type="date"
                  value={newTransaction.transaction_date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, transaction_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('type') || 'Type'}</label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(v) => setNewTransaction({
                    ...newTransaction,
                    type: v,
                    category: v === 'income' ? 'sales' : v === 'expense' ? 'purchase' : 'bank_deposit'
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">{t('income') || 'Income'}</SelectItem>
                    <SelectItem value="expense">{t('expense') || 'Expense'}</SelectItem>
                    <SelectItem value="transfer">{t('transfer') || 'Transfer'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('category') || 'Category'}</label>
              <Select
                value={newTransaction.category}
                onValueChange={(v) => setNewTransaction({ ...newTransaction, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(categories[newTransaction.type] || []).map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('amount') || 'Amount'}</label>
                <Input
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('currency') || 'Currency'}</label>
                <Select
                  value={newTransaction.currency}
                  onValueChange={(v) => setNewTransaction({ ...newTransaction, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('description') || 'Description'}</label>
              <Textarea
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                placeholder={t('transaction_description') || 'Transaction description'}
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('cashier') || 'Cashier'}</label>
              <Input
                value={newTransaction.cashier}
                onChange={(e) => setNewTransaction({ ...newTransaction, cashier: e.target.value })}
                placeholder={t('cashier_name') || 'Cashier name'}
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('cancel') || 'Cancel'}</Button>
              <Button
                onClick={handleCreateTransaction}
                disabled={isSaving || !newTransaction.amount || !newTransaction.description}
                className={`text-white ${
                  newTransaction.type === 'income' ? 'bg-green-600 hover:bg-green-700' :
                  newTransaction.type === 'expense' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
