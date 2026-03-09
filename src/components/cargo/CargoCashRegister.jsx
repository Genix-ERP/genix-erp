import React, { useState } from 'react';
import { useCargoContext } from '@/components/contexts/CargoContext';
import { useCompany } from '@/components/contexts/CompanyContext';
import { cargoService } from '@/api/services/cargo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Filter, Building2, Edit, Trash2
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";

export default function CargoCashRegister() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const {
    cargoCash,
    setCargoCash,
    companyAccounts,
    addCashTransaction,
    loadCashSummary
  } = useCargoContext();
  const { companies, activeCompany } = useCompany();
  const { canCreate } = usePermissions();

  // Helper function to extract string from sql.NullString objects
  const extractString = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.String !== undefined) return value.String || '';
    return String(value);
  };

  // Helper function to safely format dates
  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    try {
      // Extract string from object if needed
      const dateStr = typeof dateValue === 'string' ? dateValue : (dateValue?.String || '');
      if (!dateStr || dateStr === '0001-01-01T00:00:00Z') return '-';

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';

      return format(date, 'dd MMM yyyy, HH:mm');
    } catch (error) {
      console.error('Date formatting error:', error);
      return '-';
    }
  };

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('income');
  const [filterType, setFilterType] = useState('all');
  const [filterCurrency, setFilterCurrency] = useState('all');
  const [editingTransactionId, setEditingTransactionId] = useState(null);

  // Transaction form state
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'UZS',
    category: '',
    description: '',
    company_id: ''
  });

  // Transaction categories
  const incomeCategories = [
    { value: 'payment_from_b2b', label: t('payment_from_b2b') },
    { value: 'payment_from_b2c', label: t('payment_from_b2c') },
    { value: 'other_income', label: t('other_income') }
  ];

  const expenseCategories = [
    { value: 'transport', label: t('transport') },
    { value: 'customs', label: t('customs') },
    { value: 'insurance', label: t('insurance') },
    { value: 'transfer_to_b2b', label: t('transfer_to_b2b') },
    { value: 'other_expense', label: t('other_expense') }
  ];

  // Handle form change
  const handleFormChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      amount: '',
      currency: 'UZS',
      category: '',
      description: '',
      company_id: ''
    });
    setEditingTransactionId(null);
    setTransactionType('income');
  };

  // Handle add/update transaction
  const handleAddTransaction = async () => {
    if (!formData.amount || !formData.category) return;

    // If editing, update the existing transaction
    if (editingTransactionId) {
      try {
        // Update via backend
        await cargoService.updateCashTransaction(editingTransactionId, {
          transaction_type: transactionType,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          category: formData.category,
          description: formData.description,
          related_company_id: formData.company_id || null
        });

        // Reload cash summary from backend to get fresh data
        await loadCashSummary();

        toast.success('Tranzaksiya muvaffaqiyatli yangilandi');
      } catch (error) {
        console.error('Error updating transaction:', error);
        toast.error('Tranzaksiyani yangilashda xatolik yuz berdi');
        return;
      }
    } else {
      // Add new transaction
      try {
        await addCashTransaction({
          type: transactionType,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          category: formData.category,
          description: formData.description,
          company_id: formData.company_id || null
        });
      } catch (error) {
        console.error('Error adding transaction:', error);
        toast.error('Tranzaksiya qo\'shishda xatolik yuz berdi');
        return;
      }
    }

    setShowTransactionModal(false);
    resetForm();
  };

  // Handle edit transaction
  const handleEditTransaction = (transaction) => {
    // Populate the form with transaction data
    // Backend returns transaction_type, not type
    const txType = extractString(transaction.transaction_type) || extractString(transaction.type);
    const transactionCategory = extractString(transaction.category);
    const transactionCurrency = extractString(transaction.currency);
    const transactionDescription = extractString(transaction.description);

    setEditingTransactionId(transaction.id);
    setTransactionType(txType || 'expense');
    setFormData({
      amount: transaction.amount.toString(),
      currency: transactionCurrency || 'USD',
      category: transactionCategory,
      description: transactionDescription,
      company_id: transaction.company_id || transaction.related_tenant_id || ''
    });
    setShowTransactionModal(true);
  };

  // Handle delete transaction
  const handleDeleteTransaction = async (transactionId) => {
    if (!confirm('Bu tranzaksiyani o\'chirishni xohlaysizmi?')) {
      return;
    }

    try {
      // Delete via backend
      await cargoService.deleteCashTransaction(transactionId);

      // Reload cash summary from backend to get fresh data
      await loadCashSummary();

      toast.success('Tranzaksiya muvaffaqiyatli o\'chirildi');
    } catch (error) {
      console.error('Error deleting transaction from backend:', error);
      toast.error('Tranzaksiyani o\'chirishda xatolik yuz berdi');
    }
  };

  // Filter transactions
  const filteredTransactions = (cargoCash.transactions || []).filter(t => {
    const txType = extractString(t.transaction_type) || extractString(t.type);
    if (filterType !== 'all' && txType !== filterType) return false;
    if (filterCurrency !== 'all' && extractString(t.currency) !== filterCurrency) return false;
    return true;
  });

  // Calculate totals
  const calculateTotals = () => {
    return filteredTransactions.reduce((acc, t) => {
      const key = extractString(t.currency) === 'USD' ? 'usd' : 'uzs';
      const txType = extractString(t.transaction_type) || extractString(t.type);
      if (txType === 'income') {
        acc[key].income += t.amount;
      } else {
        acc[key].expense += t.amount;
      }
      return acc;
    }, {
      uzs: { income: 0, expense: 0 },
      usd: { income: 0, expense: 0 }
    });
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* UZS Balance */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{t('uzs_balance')}</span>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-blue-900">
                {formatCurrency(cargoCash.uzs_balance || 0, 'UZS')}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-slate-600">{t('income')}:</span>
                  <span className="font-semibold">{formatCurrency(totals.uzs.income, 'UZS')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-slate-600">{t('expense')}:</span>
                  <span className="font-semibold">{formatCurrency(totals.uzs.expense, 'UZS')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* USD Balance */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{t('usd_balance')}</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-green-900">
                {formatCurrency(cargoCash.usd_balance || 0, 'USD')}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-slate-600">{t('income')}:</span>
                  <span className="font-semibold">{formatCurrency(totals.usd.income, 'USD')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-slate-600">{t('expense')}:</span>
                  <span className="font-semibold">{formatCurrency(totals.usd.expense, 'USD')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Accounts */}
      {companyAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t('company_accounts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companyAccounts.map((account) => (
                <div key={account.company_id} className="p-4 border rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{account.company_name}</h4>
                        <Badge variant={account.company_type === 'B2B' ? 'default' : 'secondary'}>
                          {account.company_type}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Qarz:</span>
                          <span className="font-semibold ml-1 text-red-600">
                            {account.debt?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Kredit:</span>
                          <span className="font-semibold ml-1 text-green-600">
                            {account.credit?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t('balance')}:</span>
                          <span className={`font-semibold ml-1 ${
                            account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {account.balance?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('transactions')}</CardTitle>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all')}</SelectItem>
                  <SelectItem value="income">{t('income')}</SelectItem>
                  <SelectItem value="expense">{t('expense')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all')}</SelectItem>
                  <SelectItem value="UZS">UZS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              {canCreate(MODULES.CARGO) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setTransactionType('income');
                    setShowTransactionModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_transactions')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead className="text-right">{t('amount')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...filteredTransactions].reverse().map((transaction) => {
                  // Backend returns transaction_type, not type
                  const txType = extractString(transaction.transaction_type) || extractString(transaction.type);
                  const transactionCategory = extractString(transaction.category);
                  const transactionCurrency = extractString(transaction.currency);

                  const categoryLabel = txType === 'income'
                    ? incomeCategories.find(c => c.value === transactionCategory)?.label
                    : expenseCategories.find(c => c.value === transactionCategory)?.label;

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {formatDate(transaction.transaction_date || transaction.date)}
                      </TableCell>
                      <TableCell>
                        <Badge className={txType === 'income' ? 'bg-green-500' : 'bg-red-500'}>
                          {txType === 'income' ? t('income') : t('expense')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{categoryLabel || transactionCategory}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {extractString(transaction.description) || '-'}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${
                        txType === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txType === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount, transactionCurrency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTransaction(transaction)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Modal */}
      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTransactionId ? t('edit_transaction') : t('add_transaction')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Transaction Type */}
            <div>
              <Label>{t('type')}</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t('income')}</SelectItem>
                  <SelectItem value="expense">{t('expense')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div>
              <Label>{t('currency')}</Label>
              <Select
                value={formData.currency}
                onValueChange={(v) => handleFormChange('currency', v)}
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

            {/* Amount */}
            <div>
              <Label>{t('amount')}</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => handleFormChange('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Category */}
            <div>
              <Label>{t('category')}</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => handleFormChange('category', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select')} />
                </SelectTrigger>
                <SelectContent>
                  {(transactionType === 'income' ? incomeCategories : expenseCategories).map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company (optional) */}
            {['payment_from_b2b', 'payment_from_b2c', 'transfer_to_b2b'].includes(formData.category) && (
              <div>
                <Label>{t('company')} ({t('optional')})</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(v) => handleFormChange('company_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description */}
            <div>
              <Label>{t('description')} ({t('optional')})</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder={t('enter_note')}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTransactionModal(false);
                  resetForm();
                }}
                className="flex-1"
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                onClick={handleAddTransaction}
                disabled={!formData.amount || !formData.category}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {editingTransactionId ? 'Yangilash' : (t('add') || 'Qo\'shish')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
