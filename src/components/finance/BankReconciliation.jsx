import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Building2, CreditCard, CheckCircle, Clock, AlertCircle,
  ArrowUpRight, ArrowDownLeft, RefreshCw, FileText, Upload, Download,
  MoreHorizontal, Eye, Check, X, Landmark, Wallet, TrendingUp, TrendingDown, Globe,
  Calendar, Target, Scale, Trash2, Pencil
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import CashRegister from "./CashRegister";
import CurrencyManagement from "./CurrencyManagement";
import FiscalPeriods from "./FiscalPeriods";
import BudgetManagement from "./BudgetManagement";
import ReconciliationWorkflow from "./ReconciliationWorkflow";
import BankStatementImport from "./BankStatementImport";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function BankReconciliation() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    bankAccounts,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    bankTransactions,
    loadBankTransactions,
    getBankTransactionsByAccount,
    createBankTransaction,
    reconcileBankTransaction,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showReconciliationWorkflow, setShowReconciliationWorkflow] = useState(false);
  const [reconciliationAccount, setReconciliationAccount] = useState(null);
  const [activeTab, setActiveTab] = useState("accounts");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState(null);
  const [editAccount, setEditAccount] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const [newBankAccount, setNewBankAccount] = useState({
    name: '',
    bank_name: '',
    account_number: '',
    currency: 'UZS',
    account_type: 'checking',
    balance: ''
  });

  const [newTransaction, setNewTransaction] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'credit',
    reference: ''
  });

  // Load transactions when bank account is selected
  useEffect(() => {
    if (selectedBankAccount?.id) {
      loadBankTransactions(selectedBankAccount.id);
    }
  }, [selectedBankAccount?.id, loadBankTransactions]);

  // Calculate summaries
  const accountSummary = {
    totalAccounts: bankAccounts.length,
    activeAccounts: bankAccounts.filter(a => a.is_active).length,
    totalBalanceUZS: bankAccounts.filter(a => a.currency === 'UZS').reduce((sum, a) => sum + (a.balance || 0), 0),
    totalBalanceUSD: bankAccounts.filter(a => a.currency === 'USD').reduce((sum, a) => sum + (a.balance || 0), 0),
  };

  const transactionSummary = selectedBankAccount ? (() => {
    const transactions = getBankTransactionsByAccount(selectedBankAccount.id);
    return {
      total: transactions.length,
      reconciled: transactions.filter(t => t.is_reconciled).length,
      unreconciled: transactions.filter(t => !t.is_reconciled).length,
      totalCredits: transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0),
      totalDebits: transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0),
    };
  })() : { total: 0, reconciled: 0, unreconciled: 0, totalCredits: 0, totalDebits: 0 };

  const handleCreateBankAccount = async () => {
    setIsSaving(true);
    try {
      await createBankAccount({
        ...newBankAccount,
        balance: parseFloat(newBankAccount.balance) || 0
      });
      setNewBankAccount({
        name: '',
        bank_name: '',
        account_number: '',
        currency: 'UZS',
        account_type: 'checking',
        balance: ''
      });
      setShowCreateAccountModal(false);
    } catch (err) {
      console.error('Error creating bank account:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBankAccount = async () => {
    if (!editAccount) return;
    setIsSaving(true);
    try {
      await updateBankAccount(editAccount.id, {
        name: editAccount.name,
        bank_name: editAccount.bank_name,
        account_number: editAccount.account_number,
        currency: editAccount.currency,
        account_type: editAccount.account_type
      });
      setEditAccount(null);
    } catch (err) {
      console.error('Error updating bank account:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!selectedBankAccount) return;
    setIsSaving(true);
    try {
      await createBankTransaction(selectedBankAccount.id, {
        ...newTransaction,
        amount: parseFloat(newTransaction.amount) || 0
      });
      setNewTransaction({
        transaction_date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'credit',
        reference: ''
      });
      setShowCreateTransactionModal(false);
    } catch (err) {
      console.error('Error creating transaction:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReconcile = async (transactionId) => {
    if (!selectedBankAccount) return;
    try {
      await reconcileBankTransaction(selectedBankAccount.id, transactionId);
    } catch (err) {
      console.error('Error reconciling transaction:', err);
    }
  };

  const getFilteredTransactions = () => {
    if (!selectedBankAccount) return [];
    let transactions = getBankTransactionsByAccount(selectedBankAccount.id);

    if (searchQuery) {
      transactions = transactions.filter(t =>
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus === 'reconciled') {
      transactions = transactions.filter(t => t.is_reconciled);
    } else if (filterStatus === 'unreconciled') {
      transactions = transactions.filter(t => !t.is_reconciled);
    }

    return transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
  };

  // Show reconciliation workflow if active
  if (showReconciliationWorkflow && reconciliationAccount) {
    return (
      <div className="space-y-6">
        <ReconciliationWorkflow
          bankAccount={reconciliationAccount}
          onClose={() => {
            setShowReconciliationWorkflow(false);
            setReconciliationAccount(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="bank" className="w-full">
        <TabsList className="bg-white/80 backdrop-blur-sm p-1 rounded-lg border border-slate-200/60 shadow-sm">
          <TabsTrigger
            value="bank"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <Landmark className="w-4 h-4" />
            {t('bank_accounts') || 'Bank Accounts'}
          </TabsTrigger>
          <TabsTrigger
            value="cash"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <Wallet className="w-4 h-4" />
            {t('cash_register') || 'Cash Register'}
          </TabsTrigger>
          <TabsTrigger
            value="currency"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <Globe className="w-4 h-4" />
            {t('currency') || 'Currency'}
          </TabsTrigger>
          <TabsTrigger
            value="fiscal"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <Calendar className="w-4 h-4" />
            {t('fiscal_periods') || 'Fiscal Periods'}
          </TabsTrigger>
          <TabsTrigger
            value="budgets"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <Target className="w-4 h-4" />
            {t('budgets') || 'Budgets'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bank" className="mt-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">{t('bank_accounts') || 'Bank Accounts'}</p>
                <p className="text-2xl font-bold text-blue-800">{accountSummary.totalAccounts}</p>
                <p className="text-xs text-blue-500">{accountSummary.activeAccounts} {t('active_accounts') || 'active'}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Landmark className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">{t('uzs_balance') || 'UZS Balance'}</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(accountSummary.totalBalanceUZS, 'UZS')}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">{t('usd_balance') || 'USD Balance'}</p>
                <p className="text-2xl font-bold text-purple-800">{formatCurrency(accountSummary.totalBalanceUSD, 'USD')}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">{t('unreconciled') || 'Unreconciled'}</p>
                <p className="text-2xl font-bold text-orange-800">{transactionSummary.unreconciled}</p>
                <p className="text-xs text-orange-500">{t('transactions_count') || 'transactions'}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <TabsList className="bg-white/80 backdrop-blur-sm p-1 rounded-lg border border-slate-200">
            <TabsTrigger value="accounts" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <Landmark className="w-4 h-4 mr-2" />
              {t('bank_accounts') || 'Bank Accounts'}
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('transactions') || 'Transactions'}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {activeTab === 'accounts' && canCreate(MODULES.FINANCIALS) && (
              <Button
                onClick={() => setShowCreateAccountModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('new_account') || 'New Account'}
              </Button>
            )}
            {activeTab === 'transactions' && selectedBankAccount && canCreate(MODULES.FINANCIALS) && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowImportModal(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {t('import_statement') || 'Import Statement'}
                </Button>
                <Button
                  onClick={() => setShowCreateTransactionModal(true)}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_transaction') || 'New Transaction'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Bank Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('account_name') || 'Account Name'}</TableHead>
                    <TableHead>{t('bank') || 'Bank'}</TableHead>
                    <TableHead>{t('account_number') || 'Account Number'}</TableHead>
                    <TableHead>{t('currency') || 'Currency'}</TableHead>
                    <TableHead>{t('balance') || 'Balance'}</TableHead>
                    <TableHead>{t('last_reconciliation') || 'Last Reconciliation'}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((account) => (
                    <TableRow
                      key={account.id}
                      className={`hover:bg-slate-50 cursor-pointer ${selectedBankAccount?.id === account.id ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        setSelectedBankAccount(account);
                        setActiveTab('transactions');
                      }}
                    >
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {account.bank_name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{account.account_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{account.currency}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(account.balance, account.currency)}
                      </TableCell>
                      <TableCell>
                        {account.last_reconciled ? format(new Date(account.last_reconciled), 'dd.MM.yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {account.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate(MODULES.FINANCIALS) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReconciliationAccount(account);
                                setShowReconciliationWorkflow(true);
                              }}
                              title={t('reconcile') || 'Reconcile'}
                            >
                              <Scale className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBankAccount(account);
                              setActiveTab('transactions');
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canUpdate(MODULES.FINANCIALS) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditAccount({ ...account });
                              }}
                            >
                              <Pencil className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}
                          {canDelete(MODULES.FINANCIALS) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteAccountId(account.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bankAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        {t('no_bank_accounts') || 'No bank accounts'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          {selectedBankAccount ? (
            <div className="space-y-4">
              {/* Selected Account Info */}
              <Card className="bg-gradient-to-r from-slate-50 to-slate-100">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedBankAccount.name}</h3>
                      <p className="text-sm text-slate-500">{selectedBankAccount.bank_name} - {selectedBankAccount.account_number}</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-500">{t('balance') || 'Balance'}</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(selectedBankAccount.balance, selectedBankAccount.currency)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500">{t('income') || 'Income'}</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(transactionSummary.totalCredits, selectedBankAccount.currency)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500">{t('expense') || 'Expense'}</p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(transactionSummary.totalDebits, selectedBankAccount.currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={t('search_transactions') || 'Search transactions...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t('filter_by_status') || 'Filter by status'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                    <SelectItem value="reconciled">{t('reconciled') || 'Reconciled'}</SelectItem>
                    <SelectItem value="unreconciled">{t('unreconciled') || 'Unreconciled'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transactions Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('date') || 'Date'}</TableHead>
                        <TableHead>{t('description')}</TableHead>
                        <TableHead>{t('reference')}</TableHead>
                        <TableHead>{t('type') || 'Type'}</TableHead>
                        <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead className="text-right">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredTransactions().map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-slate-50">
                          <TableCell>{format(new Date(transaction.transaction_date), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{transaction.description}</TableCell>
                          <TableCell className="font-mono text-sm">{transaction.reference}</TableCell>
                          <TableCell>
                            <Badge className={transaction.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {transaction.type === 'credit' ? (
                                <><ArrowDownLeft className="w-3 h-3 mr-1" /> {t('income') || 'Income'}</>
                              ) : (
                                <><ArrowUpRight className="w-3 h-3 mr-1" /> {t('expense') || 'Expense'}</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount, selectedBankAccount.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge className={transaction.is_reconciled ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                              {transaction.is_reconciled ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> {t('confirmed') || 'Confirmed'}</>
                              ) : (
                                <><Clock className="w-3 h-3 mr-1" /> {t('waiting') || 'Waiting'}</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!transaction.is_reconciled && canUpdate(MODULES.FINANCIALS) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReconcile(transaction.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                {t('confirm') || 'Confirm'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {getFilteredTransactions().length === 0 && (
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
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Landmark className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600">{t('select_bank_account') || 'Select a bank account'}</h3>
                <p className="text-sm text-slate-400 mt-2">{t('select_account_to_view') || 'Select an account to view transactions'}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab('accounts')}
                >
                  {t('view_bank_accounts') || 'View bank accounts'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Bank Account Modal */}
      <Dialog open={showCreateAccountModal} onOpenChange={setShowCreateAccountModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new_bank_account') || 'New Bank Account'}</DialogTitle>
            <DialogDescription>{t('enter_bank_account_info') || 'Enter bank account details'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">{t('account_name') || 'Account Name'}</label>
              <Input
                value={newBankAccount.name}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, name: e.target.value })}
                placeholder={t('main_account') || 'Main Account'}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('bank_name') || 'Bank Name'}</label>
              <Input
                value={newBankAccount.bank_name}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, bank_name: e.target.value })}
                placeholder={t('national_bank') || 'National Bank'}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('account_number') || 'Account Number'}</label>
              <Input
                value={newBankAccount.account_number}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, account_number: e.target.value })}
                placeholder="20208000123456789012"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('currency') || 'Currency'}</label>
                <Select
                  value={newBankAccount.currency}
                  onValueChange={(v) => setNewBankAccount({ ...newBankAccount, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS - So'm</SelectItem>
                    <SelectItem value="USD">USD - Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="RUB">RUB - Rubl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t('account_type') || 'Account Type'}</label>
                <Select
                  value={newBankAccount.account_type}
                  onValueChange={(v) => setNewBankAccount({ ...newBankAccount, account_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">{t('checking') || 'Checking'}</SelectItem>
                    <SelectItem value="savings">{t('savings') || 'Savings'}</SelectItem>
                    <SelectItem value="deposit">{t('deposit') || 'Deposit'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('initial_balance') || 'Initial Balance'}</label>
              <Input
                type="number"
                value={newBankAccount.balance}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, balance: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateAccountModal(false)}>{t('cancel')}</Button>
              <Button
                onClick={handleCreateBankAccount}
                disabled={isSaving || !newBankAccount.name || !newBankAccount.bank_name}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Transaction Modal */}
      <Dialog open={showCreateTransactionModal} onOpenChange={setShowCreateTransactionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new_transaction') || 'New Transaction'}</DialogTitle>
            <DialogDescription>
              {selectedBankAccount?.name} - {t('add_transaction') || 'add transaction'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">{t('date') || 'Date'}</label>
              <Input
                type="date"
                value={newTransaction.transaction_date}
                onChange={(e) => setNewTransaction({ ...newTransaction, transaction_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('description')}</label>
              <Input
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                placeholder={t('transaction_description') || 'Transaction description'}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('reference')}</label>
              <Input
                value={newTransaction.reference}
                onChange={(e) => setNewTransaction({ ...newTransaction, reference: e.target.value })}
                placeholder="TRF-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('type') || 'Type'}</label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(v) => setNewTransaction({ ...newTransaction, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">{t('income') || 'Income'}</SelectItem>
                    <SelectItem value="debit">{t('expense') || 'Expense'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t('amount') || 'Amount'}</label>
                <Input
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateTransactionModal(false)}>{t('cancel')}</Button>
              <Button
                onClick={handleCreateTransaction}
                disabled={isSaving || !newTransaction.description || !newTransaction.amount}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="cash" className="mt-4">
          <CashRegister />
        </TabsContent>

        <TabsContent value="currency" className="mt-4">
          <CurrencyManagement />
        </TabsContent>

        <TabsContent value="fiscal" className="mt-4">
          <FiscalPeriods />
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <BudgetManagement />
        </TabsContent>
      </Tabs>

      {/* Edit Bank Account Modal */}
      <Dialog open={!!editAccount} onOpenChange={(open) => !open && setEditAccount(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('edit_bank_account')}</DialogTitle>
            <DialogDescription>{t('edit_bank_account_info')}</DialogDescription>
          </DialogHeader>
          {editAccount && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">{t('account_name')}</label>
                <Input
                  value={editAccount.name}
                  onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('bank_name')}</label>
                <Input
                  value={editAccount.bank_name}
                  onChange={(e) => setEditAccount({ ...editAccount, bank_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('account_number')}</label>
                <Input
                  value={editAccount.account_number}
                  onChange={(e) => setEditAccount({ ...editAccount, account_number: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{t('currency')}</label>
                  <Select
                    value={editAccount.currency}
                    onValueChange={(v) => setEditAccount({ ...editAccount, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UZS">UZS - So'm</SelectItem>
                      <SelectItem value="USD">USD - Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="RUB">RUB - Rubl</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('account_type')}</label>
                  <Select
                    value={editAccount.account_type}
                    onValueChange={(v) => setEditAccount({ ...editAccount, account_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">{t('checking')}</SelectItem>
                      <SelectItem value="savings">{t('savings')}</SelectItem>
                      <SelectItem value="deposit">{t('deposit')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <Button variant="outline" onClick={() => setEditAccount(null)}>{t('cancel')}</Button>
                <Button
                  onClick={handleUpdateBankAccount}
                  disabled={isSaving || !editAccount.name || !editAccount.bank_name}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  {isSaving ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bank Statement Import */}
      <BankStatementImport
        open={showImportModal}
        onOpenChange={setShowImportModal}
        bankAccount={selectedBankAccount}
        onImportComplete={() => {
          if (selectedBankAccount?.id) {
            loadBankTransactions(selectedBankAccount.id);
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteAccountId} onOpenChange={(open) => !open && setDeleteAccountId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              {t('confirm_delete')}
            </DialogTitle>
            <DialogDescription>
              {t('confirm_delete_bank_account')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteAccountId(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                try {
                  await deleteBankAccount(deleteAccountId);
                  if (selectedBankAccount?.id === deleteAccountId) {
                    setSelectedBankAccount(null);
                  }
                } catch (err) {
                  console.error('Failed to delete bank account:', err);
                }
                setDeleteAccountId(null);
              }}
            >
              {t('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
