import React, { useState } from 'react';
import { useCargoContext } from '@/components/contexts/CargoContext';
import { useCompany } from '@/components/contexts/CompanyContext';
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
  DollarSign, TrendingUp, TrendingDown, Plus, Filter, Building2
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { format } from 'date-fns';

export default function CargoCashRegister() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    cargoCash,
    companyAccounts,
    addCashTransaction
  } = useCargoContext();
  const { companies } = useCompany();

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('income');
  const [filterType, setFilterType] = useState('all');
  const [filterCurrency, setFilterCurrency] = useState('all');

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
    { value: 'payment_from_b2b', label: 'B2B dan to\'lov' },
    { value: 'payment_from_b2c', label: 'B2C dan to\'lov' },
    { value: 'other_income', label: 'Boshqa kirim' }
  ];

  const expenseCategories = [
    { value: 'transport', label: 'Transport' },
    { value: 'customs', label: 'Bojxona' },
    { value: 'insurance', label: 'Sug\'urta' },
    { value: 'transfer_to_b2b', label: 'B2B ga o\'tkazma' },
    { value: 'other_expense', label: 'Boshqa xarajat' }
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
  };

  // Handle add transaction
  const handleAddTransaction = () => {
    if (!formData.amount || !formData.category) return;

    addCashTransaction({
      type: transactionType,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      category: formData.category,
      description: formData.description,
      company_id: formData.company_id || null
    });

    setShowTransactionModal(false);
    resetForm();
  };

  // Filter transactions
  const filteredTransactions = (cargoCash.transactions || []).filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCurrency !== 'all' && t.currency !== filterCurrency) return false;
    return true;
  });

  // Calculate totals
  const calculateTotals = () => {
    return filteredTransactions.reduce((acc, t) => {
      const key = t.currency === 'USD' ? 'usd' : 'uzs';
      if (t.type === 'income') {
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
              <span>UZS Balans</span>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-blue-900">
                {cargoCash.uzs_balance?.toLocaleString()} so'm
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-slate-600">Kirim:</span>
                  <span className="font-semibold">{totals.uzs.income.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-slate-600">Chiqim:</span>
                  <span className="font-semibold">{totals.uzs.expense.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* USD Balance */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>USD Balans</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-green-900">
                ${cargoCash.usd_balance?.toLocaleString()}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-slate-600">Kirim:</span>
                  <span className="font-semibold">${totals.usd.income.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-slate-600">Chiqim:</span>
                  <span className="font-semibold">${totals.usd.expense.toLocaleString()}</span>
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
              Kompaniya hisoblari
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
                          <span className="text-slate-500">Balans:</span>
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
            <CardTitle>{t('transactions') || 'Tranzaksiyalar'}</CardTitle>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="income">Kirim</SelectItem>
                  <SelectItem value="expense">Chiqim</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  <SelectItem value="UZS">UZS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => {
                  setTransactionType('income');
                  setShowTransactionModal(true);
                }}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('add') || 'Qo\'shish'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_transactions') || 'Tranzaksiyalar yo\'q'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead>Kategoriya</TableHead>
                  <TableHead>Tavsif</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...filteredTransactions].reverse().map((transaction) => {
                  const categoryLabel = transaction.type === 'income'
                    ? incomeCategories.find(c => c.value === transaction.category)?.label
                    : expenseCategories.find(c => c.value === transaction.category)?.label;

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {format(new Date(transaction.date), 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge className={transaction.type === 'income' ? 'bg-green-500' : 'bg-red-500'}>
                          {transaction.type === 'income' ? 'Kirim' : 'Chiqim'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{categoryLabel}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {transaction.description || '-'}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {transaction.currency === 'USD' ? '$' : ''}
                        {transaction.amount.toLocaleString()}
                        {transaction.currency === 'UZS' ? ' so\'m' : ''}
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
            <DialogTitle>{t('add_transaction') || 'Tranzaksiya qo\'shish'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Transaction Type */}
            <div>
              <Label>Turi</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Kirim</SelectItem>
                  <SelectItem value="expense">Chiqim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div>
              <Label>Valyuta</Label>
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
              <Label>Summa</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => handleFormChange('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Category */}
            <div>
              <Label>Kategoriya</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => handleFormChange('category', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tanlang" />
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
                <Label>Kompaniya ({t('optional') || 'ixtiyoriy'})</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(v) => handleFormChange('company_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tanlang" />
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
              <Label>Tavsif ({t('optional') || 'ixtiyoriy'})</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Izoh kiriting..."
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
                {t('add') || 'Qo\'shish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
