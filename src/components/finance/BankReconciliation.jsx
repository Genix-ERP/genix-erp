import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Building2, CreditCard, CheckCircle, Clock, AlertCircle,
  ArrowUpRight, ArrowDownLeft, RefreshCw, FileText, Upload, Download,
  MoreHorizontal, Eye, Check, X, Landmark, Wallet, TrendingUp, TrendingDown,
  Calendar, Scale, Trash2, Edit, FileSpreadsheet, AlertTriangle, Loader2
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from 'sonner';
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import CashRegister from "./CashRegister";
import ReconciliationWorkflow from "./ReconciliationWorkflow";
import BankStatementImport from "./BankStatementImport";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { financeService } from '@/api/services/finance';
import { getApiErrorMessage } from '@/utils/apiError';

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
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showReconciliationWorkflow, setShowReconciliationWorkflow] = useState(false);
  const [reconciliationAccount, setReconciliationAccount] = useState(null);
  const [activeTab, setActiveTab] = useState("accounts");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState(null);
  const [editAccount, setEditAccount] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // No `balance` field: the legacy manually-maintained column is dead — the
  // shown balance always comes from the linked GL account's ledger.
  const [newBankAccount, setNewBankAccount] = useState({
    name: '',
    bank_name: '',
    account_number: '',
    currency: 'UZS',
    account_type: 'checking'
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

  // Calculate summaries — balances come from the LEDGER (ledger_balance via the
  // linked GL account). The legacy manually-maintained `balance` column is dead
  // and must never be displayed.
  const accountSummary = {
    totalAccounts: bankAccounts.length,
    activeAccounts: bankAccounts.filter(a => a.is_active).length,
    totalBalanceUZS: bankAccounts.filter(a => a.currency === 'UZS').reduce((sum, a) => sum + (a.ledger_balance || 0), 0),
    totalBalanceUSD: bankAccounts.filter(a => a.currency === 'USD').reduce((sum, a) => sum + (a.ledger_balance || 0), 0),
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
      await createBankAccount({ ...newBankAccount });
      setNewBankAccount({
        name: '',
        bank_name: '',
        account_number: '',
        currency: 'UZS',
        account_type: 'checking'
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

  const bankActiveFilterCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (codeFilter ? 1 : 0);
  const clearBankFilters = () => { setDateFrom(''); setDateTo(''); setCodeFilter(''); setSearchQuery(''); setFilterStatus('all'); };

  const getFilteredTransactions = () => {
    if (!selectedBankAccount) return [];
    let transactions = getBankTransactionsByAccount(selectedBankAccount.id);

    if (searchQuery) {
      transactions = transactions.filter(t =>
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (codeFilter) {
      const cf = codeFilter.toLowerCase();
      transactions = transactions.filter(t =>
        t.reference?.toLowerCase().includes(cf)
      );
    }

    if (dateFrom) {
      transactions = transactions.filter(t => {
        const d = t.transaction_date?.split('T')[0];
        return d && d >= dateFrom;
      });
    }
    if (dateTo) {
      transactions = transactions.filter(t => {
        const d = t.transaction_date?.split('T')[0];
        return d && d <= dateTo;
      });
    }

    if (filterStatus === 'reconciled') {
      transactions = transactions.filter(t => t.is_reconciled);
    } else if (filterStatus === 'unreconciled') {
      transactions = transactions.filter(t => !t.is_reconciled);
    }

    return transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
  };

  // Export bank transactions to Excel
  const handleExportBankExcel = async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GenixERP';
    wb.created = new Date();
    const sheetName = (t('bank_transactions') || 'Bank tranzaksiyalari').substring(0, 31);
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const HEADER_BG = '1E3A5F';
    const HEADER_FG = 'FFFFFF';
    const BORDER_CLR = 'CBD5E1';
    const STRIPE_BG = 'F8FAFC';
    const TOTAL_BG = 'EEF2FF';
    const BRAND_BLUE = '4F46E5';
    const thin = { style: 'thin', color: { argb: BORDER_CLR } };
    const borders = { top: thin, bottom: thin, left: thin, right: thin };
    const thickTop = { style: 'medium', color: { argb: BRAND_BLUE } };
    ws.columns = [
      { width: 5.5 }, { width: 14 }, { width: 40 }, { width: 24 },
      { width: 14 }, { width: 20 }, { width: 16 },
    ];
    const data = getFilteredTransactions();
    const periodText = `${dateFrom || '...'} — ${dateTo || '...'}`;
    const acctName = selectedBankAccount?.name || '';
    const titleRow = ws.addRow([`${t('bank_transactions') || 'Bank tranzaksiyalari'} — ${acctName}`]);
    ws.mergeCells(`A${titleRow.number}:G${titleRow.number}`);
    titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: '1E293B' } };
    titleRow.getCell(1).alignment = { vertical: 'middle' };
    titleRow.height = 30;
    const subRow = ws.addRow([`${periodText}  •  ${data.length} ${t('entries_total') || 'yozuv'}`]);
    ws.mergeCells(`A${subRow.number}:G${subRow.number}`);
    subRow.getCell(1).font = { size: 10, color: { argb: '64748B' } };
    subRow.height = 18;
    ws.addRow([]);
    const headers = ['№', t('date') || 'Sana', t('description') || 'Tavsif', t('reference') || 'Havola', t('type') || 'Tur', t('amount') || 'Summa', t('status') || 'Holat'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 11, color: { argb: HEADER_FG } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borders;
    });
    let sumCredits = 0, sumDebits = 0;
    data.forEach((txn, idx) => {
      const amt = txn.amount || 0;
      if (txn.type === 'credit') sumCredits += amt; else sumDebits += amt;
      const isStripe = idx % 2 === 1;
      const row = ws.addRow([
        idx + 1,
        txn.transaction_date ? format(new Date(txn.transaction_date), 'dd.MM.yyyy') : '-',
        txn.description || '-',
        txn.reference || '-',
        txn.type === 'credit' ? (t('income') || 'Kirim') : (t('expense') || 'Chiqim'),
        amt,
        txn.is_reconciled ? (t('confirmed') || 'Tasdiqlangan') : (t('waiting') || 'Kutilmoqda'),
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10 };
        cell.border = borders;
        cell.alignment = { vertical: 'middle' };
        if (isStripe) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_BG } };
        if (colNumber === 6) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
        if (colNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });
    const totRow = ws.addRow(['', '', '', '', t('total') || 'Jami:', sumCredits - sumDebits, '']);
    totRow.height = 28;
    totRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      cell.border = { ...borders, top: { ...thickTop } };
      cell.font = { bold: true, size: 11, color: { argb: '1E293B' } };
      cell.alignment = { vertical: 'middle' };
      if (colNumber === 6) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
    });
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: 7 } };
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank_transactions_${dateFrom || 'all'}_${dateTo || 'all'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
            value="vipiska"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {language === 'ru' ? 'Выписка' : 'Vipiska'}
          </TabsTrigger>
          <TabsTrigger
            value="cash"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <Wallet className="w-4 h-4" />
            {t('cash_register') || 'Cash Register'}
          </TabsTrigger>
          {/* moliya-v2 IA: currency/fiscal/budgets/accounting-periods chips
              moved out — Byudjetlar is a top tab, Valyuta and Davrlar live
              under Buxgalteriya. Old ?tab=cashflow&sub=... URLs redirect in
              Financials.jsx. */}
        </TabsList>

        <TabsContent value="vipiska" className="mt-4">
          <VipiskaImportPanel
            bankAccounts={bankAccounts}
            canImport={canCreate(MODULES.FINANCIALS)}
            onOpenImport={(account) => {
              setSelectedBankAccount(account);
              setShowImportModal(true);
            }}
          />
        </TabsContent>

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
                <p className="text-2xl font-bold text-green-800">{formatCurrencyCompact(accountSummary.totalBalanceUZS)}</p>
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
                <p className="text-2xl font-bold text-purple-800">{formatCurrencyCompact(accountSummary.totalBalanceUSD)}</p>
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
                        <div className="flex items-center gap-2">
                          {formatCurrency(account.ledger_balance || 0, account.currency)}
                          {account.gl_linked === false && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] whitespace-nowrap"
                              title={t('gl_not_linked_tooltip') || "Balans ledgerdan hisoblanmaydi — hisobni GL schyotiga ulang"}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {t('gl_not_linked') || 'GL ulanmagan'}
                            </Badge>
                          )}
                        </div>
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
                              <Edit className="w-4 h-4 text-amber-600" />
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
                          {formatCurrency(selectedBankAccount.ledger_balance || 0, selectedBankAccount.currency)}
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

              {/* Search + Filters */}
              <div className="flex flex-col gap-3">
                {/* Search row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={t('search_transactions') || 'Tranzaksiyalarni qidirish...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 bg-slate-50 border-slate-200"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px] h-10 bg-slate-50">
                      <SelectValue placeholder={t('filter_by_status') || 'Holat bo\'yicha'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all') || 'Hammasi'}</SelectItem>
                      <SelectItem value="reconciled">{t('reconciled') || 'Tasdiqlangan'}</SelectItem>
                      <SelectItem value="unreconciled">{t('unreconciled') || 'Tasdiqlanmagan'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Always-visible filter row */}
                <div className="flex flex-wrap items-end gap-3 p-3 bg-gradient-to-r from-slate-50 to-blue-50/40 rounded-xl border border-slate-200/80">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('from_date') || 'Dan'}
                    </label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="h-9 w-[155px] bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex items-end pb-[6px]">
                    <span className="text-slate-400 text-sm font-medium">—</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('to_date') || 'Gacha'}
                    </label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="h-9 w-[155px] bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-sm"
                    />
                  </div>
                  <div className="w-px h-8 bg-slate-200 mx-1 self-end mb-[2px] hidden sm:block" />
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {t('reference') || 'Havola'}
                    </label>
                    <Input
                      placeholder={t('reference_code') || 'Kod...'}
                      value={codeFilter}
                      onChange={e => setCodeFilter(e.target.value)}
                      className="h-9 w-[160px] bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-sm"
                    />
                  </div>
                  {bankActiveFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearBankFilters} className="h-9 text-slate-500 hover:text-red-500 gap-1 transition-colors">
                      <X className="w-3.5 h-3.5" />
                      {t('clear') || 'Tozalash'}
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    onClick={handleExportBankExcel}
                    className="h-9 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-200/60 rounded-lg px-4"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('export') || 'Export'}</span>
                    <FileSpreadsheet className="w-4 h-4 opacity-70" />
                  </Button>
                </div>
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
            <p className="text-xs text-slate-500">
              {t('balance_from_gl_hint') || "Balans GL schyotidan hisoblanadi"}
            </p>
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
                <NumberInput
                  value={newTransaction.amount}
                  onChange={(raw) => setNewTransaction({ ...newTransaction, amount: raw })}
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

// ───────────────────────────────────────────────────────────────────────────
// Vipiska — the WORKING statement-import surface. Two routed flows:
//   1. 1C bank-klient TXT  → POST /bank-statement-imports (auto-match + JE)
//   2. Excel/OFX per account → /bank-accounts/:id/import (BankStatementImport
//      dialog, opened via onOpenImport)
// The old BankVipiskaImport component called five endpoints that were never
// routed (vipiska/lines review flow) and is intentionally unmounted.
// ───────────────────────────────────────────────────────────────────────────
function VipiskaImportPanel({ bankAccounts, canImport, onOpenImport }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [imports, setImports] = useState([]);
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const fileInputRef = useRef(null);

  const loadImports = useCallback(async () => {
    try {
      const data = await financeService.listBankStatementImports();
      setImports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load bank statement imports:', err);
    } finally {
      setIsLoadingImports(false);
    }
  }, []);

  // Mount-only fetch (tab content mounts on activation). `t` must never be a
  // dep here — new closure every render → infinite fetch loop.
  useEffect(() => {
    loadImports();
  }, [loadImports]);

  const handle1CFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    setUploadResult(null);
    try {
      const res = await financeService.importBankStatement1C(file);
      setUploadResult(res);
      await loadImports();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('vp_upload_failed') || 'Vipiska import qilinmadi'));
    } finally {
      setIsUploading(false);
    }
  };

  const importStatusBadge = (status) => {
    switch (status) {
      case 'completed':
      case 'matched':
        return <Badge className="bg-green-100 text-green-700">{t('vp_status_done') || 'Yakunlangan'}</Badge>;
      case 'partial':
        return <Badge className="bg-amber-100 text-amber-700">{t('vp_status_partial') || 'Qisman'}</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">{t('vp_status_failed') || 'Xato'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId) || null;

  return (
    <div className="space-y-4">
      {/* Import actions */}
      <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-[var(--genix-blue)]" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{t('vp_title') || 'Vipiska import'}</CardTitle>
              <p className="text-sm text-slate-500">{t('vp_subtitle') || 'Bank-klient (1C TXT) yoki Excel/OFX fayldan tranzaksiyalarni yuklash'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {canImport && (
            <div className="flex flex-wrap items-end gap-3">
              {/* 1C bank-klient TXT */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handle1CFile}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('vp_uploading') || 'Yuklanmoqda...'}</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> {t('vp_upload_1c') || '1C fayl yuklash'}</>
                  )}
                </Button>
              </div>

              <div className="w-px h-8 bg-slate-200 self-end mb-[2px] hidden sm:block" />

              {/* Excel/OFX per account */}
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">{t('vp_account_for_excel') || 'Excel/OFX uchun hisobvaraq'}</label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="w-[220px] h-9 bg-white">
                      <SelectValue placeholder={t('select_bank_account') || 'Hisobvaraqni tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={!selectedAccount}
                  onClick={() => selectedAccount && onOpenImport(selectedAccount)}
                >
                  <Upload className="w-4 h-4 mr-2" /> {t('vp_import_excel') || 'Excel/OFX import'}
                </Button>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4" />
                {t('vp_upload_done') || 'Import yakunlandi'}: {uploadResult.transaction_count ?? 0} {t('vp_txn_word') || 'tranzaksiya'}
              </div>
              {Array.isArray(uploadResult.warnings) && uploadResult.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {w}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import history */}
      <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-sm">
        <CardContent className="p-0">
          {isLoadingImports ? (
            <div className="p-8 flex items-center justify-center text-slate-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> {t('loading') || 'Yuklanmoqda...'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('vp_file') || 'Fayl'}</TableHead>
                  <TableHead>{t('date') || 'Sana'}</TableHead>
                  <TableHead className="text-right">{t('vp_txns') || 'Tranzaksiyalar'}</TableHead>
                  <TableHead className="text-right">{t('vp_matched') || 'Moslangan'}</TableHead>
                  <TableHead className="text-right">{t('vp_credit') || 'Kirim'}</TableHead>
                  <TableHead className="text-right">{t('vp_debit') || 'Chiqim'}</TableHead>
                  <TableHead>{t('status') || 'Holat'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp) => (
                  <TableRow key={imp.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium max-w-[220px] truncate" title={imp.file_name}>{imp.file_name}</TableCell>
                    <TableCell className="text-slate-600">
                      {imp.statement_date ? format(new Date(imp.statement_date), 'dd.MM.yyyy') : format(new Date(imp.imported_at), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-right">{imp.transaction_count}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-700">{imp.matched_count}</span>
                      {imp.unmatched_count > 0 && (
                        <span className="text-amber-600"> / {imp.unmatched_count} {t('vp_unmatched_short') || 'mos emas'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-green-700">{formatCurrency(imp.total_credit || 0)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(imp.total_debit || 0)}</TableCell>
                    <TableCell>{importStatusBadge(imp.status)}</TableCell>
                  </TableRow>
                ))}
                {imports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      {t('vp_no_imports') || 'Hali vipiska import qilinmagan'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
