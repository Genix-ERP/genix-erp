import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Building2, CreditCard, CheckCircle, Clock, AlertCircle,
  ArrowUpRight, ArrowDownLeft, RefreshCw, FileText, Upload, Download,
  MoreHorizontal, Eye, Check, X, Landmark, Wallet, TrendingUp, TrendingDown
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";

export default function BankReconciliation() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    bankAccounts,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    bankTransactions,
    getBankTransactionsByAccount,
    createBankTransaction,
    reconcileBankTransaction,
    isLoading
  } = useFinancials();

  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [activeTab, setActiveTab] = useState("accounts");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

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

  const formatCurrency = (amount, currency = 'UZS') => {
    if (currency === 'UZS') {
      return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Bank Hisoblar</p>
                <p className="text-2xl font-bold text-blue-800">{accountSummary.totalAccounts}</p>
                <p className="text-xs text-blue-500">{accountSummary.activeAccounts} faol</p>
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
                <p className="text-sm text-green-600 font-medium">UZS Balans</p>
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
                <p className="text-sm text-purple-600 font-medium">USD Balans</p>
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
                <p className="text-sm text-orange-600 font-medium">Tasdiqlanmagan</p>
                <p className="text-2xl font-bold text-orange-800">{transactionSummary.unreconciled}</p>
                <p className="text-xs text-orange-500">tranzaksiyalar</p>
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
              Bank Hisoblar
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tranzaksiyalar
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {activeTab === 'accounts' && (
              <Button
                onClick={() => setShowCreateAccountModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yangi Hisob
              </Button>
            )}
            {activeTab === 'transactions' && selectedBankAccount && (
              <Button
                onClick={() => setShowCreateTransactionModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yangi Tranzaksiya
              </Button>
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
                    <TableHead>Hisob nomi</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Hisob raqami</TableHead>
                    <TableHead>Valyuta</TableHead>
                    <TableHead>Balans</TableHead>
                    <TableHead>Oxirgi solishtirish</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Amallar</TableHead>
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
                          {account.is_active ? 'Faol' : 'Nofaol'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bankAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        Bank hisoblar mavjud emas
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
                        <p className="text-xs text-slate-500">Balans</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(selectedBankAccount.balance, selectedBankAccount.currency)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500">Kirim</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(transactionSummary.totalCredits, selectedBankAccount.currency)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500">Chiqim</p>
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
                    placeholder="Tranzaksiya qidirish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Holat bo'yicha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    <SelectItem value="reconciled">Tasdiqlangan</SelectItem>
                    <SelectItem value="unreconciled">Tasdiqlanmagan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transactions Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Sana</TableHead>
                        <TableHead>Tavsif</TableHead>
                        <TableHead>Referens</TableHead>
                        <TableHead>Turi</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                        <TableHead>Holat</TableHead>
                        <TableHead className="text-right">Amallar</TableHead>
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
                                <><ArrowDownLeft className="w-3 h-3 mr-1" /> Kirim</>
                              ) : (
                                <><ArrowUpRight className="w-3 h-3 mr-1" /> Chiqim</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount, selectedBankAccount.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge className={transaction.is_reconciled ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                              {transaction.is_reconciled ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Tasdiqlangan</>
                              ) : (
                                <><Clock className="w-3 h-3 mr-1" /> Kutilmoqda</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!transaction.is_reconciled && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReconcile(transaction.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Tasdiqlash
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {getFilteredTransactions().length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                            Tranzaksiyalar mavjud emas
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
                <h3 className="text-lg font-medium text-slate-600">Bank hisobini tanlang</h3>
                <p className="text-sm text-slate-400 mt-2">Tranzaksiyalarni ko'rish uchun bank hisobini tanlang</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab('accounts')}
                >
                  Bank hisoblarini ko'rish
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
            <DialogTitle>Yangi Bank Hisob</DialogTitle>
            <DialogDescription>Bank hisobini qo'shish uchun ma'lumotlarni kiriting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Hisob nomi</label>
              <Input
                value={newBankAccount.name}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, name: e.target.value })}
                placeholder="Asosiy hisob"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Bank nomi</label>
              <Input
                value={newBankAccount.bank_name}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, bank_name: e.target.value })}
                placeholder="O'zbekiston Milliy Banki"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hisob raqami</label>
              <Input
                value={newBankAccount.account_number}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, account_number: e.target.value })}
                placeholder="20208000123456789012"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Valyuta</label>
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
                <label className="text-sm font-medium">Hisob turi</label>
                <Select
                  value={newBankAccount.account_type}
                  onValueChange={(v) => setNewBankAccount({ ...newBankAccount, account_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Joriy</SelectItem>
                    <SelectItem value="savings">Jamg'arma</SelectItem>
                    <SelectItem value="deposit">Depozit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Boshlang'ich balans</label>
              <Input
                type="number"
                value={newBankAccount.balance}
                onChange={(e) => setNewBankAccount({ ...newBankAccount, balance: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateAccountModal(false)}>Bekor qilish</Button>
              <Button
                onClick={handleCreateBankAccount}
                disabled={isSaving || !newBankAccount.name || !newBankAccount.bank_name}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Transaction Modal */}
      <Dialog open={showCreateTransactionModal} onOpenChange={setShowCreateTransactionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi Tranzaksiya</DialogTitle>
            <DialogDescription>
              {selectedBankAccount?.name} - tranzaksiya qo'shish
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Sana</label>
              <Input
                type="date"
                value={newTransaction.transaction_date}
                onChange={(e) => setNewTransaction({ ...newTransaction, transaction_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tavsif</label>
              <Input
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                placeholder="Tranzaksiya tavsifi"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Referens</label>
              <Input
                value={newTransaction.reference}
                onChange={(e) => setNewTransaction({ ...newTransaction, reference: e.target.value })}
                placeholder="TRF-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Turi</label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(v) => setNewTransaction({ ...newTransaction, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Kirim</SelectItem>
                    <SelectItem value="debit">Chiqim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Summa</label>
                <Input
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateTransactionModal(false)}>Bekor qilish</Button>
              <Button
                onClick={handleCreateTransaction}
                disabled={isSaving || !newTransaction.description || !newTransaction.amount}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
