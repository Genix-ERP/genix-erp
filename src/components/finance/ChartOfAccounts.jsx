import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Landmark, ChevronRight, ChevronDown, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown, Scale, Banknote, CreditCard, Building2, Wallet, Receipt, FileText, PiggyBank, Coins, AlertTriangle, ListTree, BookOpen } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import financeService from "@/api/services/finance";
import GeneralLedgerView from "./GeneralLedgerView";
import JournalManagement from "./JournalManagement";
import FixedAssets from "./FixedAssets";

const getAccountTypes = (t) => [
  { value: 'asset', label: t('asset') || 'Aktiv', icon: DollarSign, color: 'bg-blue-100 text-blue-800' },
  { value: 'contra_asset', label: t('contra_asset') || 'Contra-Asset (Zararlovchi aktiv)', icon: TrendingDown, color: 'bg-slate-100 text-slate-800' },
  { value: 'liability', label: t('liability') || 'Majburiyat', icon: TrendingDown, color: 'bg-red-100 text-red-800' },
  { value: 'equity', label: t('equity') || 'Kapital', icon: Scale, color: 'bg-purple-100 text-purple-800' },
  { value: 'revenue', label: t('revenue') || 'Daromad', icon: TrendingUp, color: 'bg-green-100 text-green-800' },
  { value: 'expense', label: t('expense') || 'Xarajat', icon: TrendingDown, color: 'bg-orange-100 text-orange-800' },
];

// Contra-asset accounts are displayed under "asset" category but with credit normal balance
const isContraAsset = (account) => {
  return account.category === 'asset' && account.normal_balance === 'credit';
};

// Odoo-like internal types for more detailed classification
const getInternalTypes = (t) => ({
  asset: [
    { value: 'asset_receivable', label: t('receivable') || 'Receivable', icon: FileText },
    { value: 'asset_cash', label: t('bank_and_cash') || 'Bank and Cash', icon: Banknote },
    { value: 'asset_current', label: t('current_assets') || 'Current Assets', icon: Wallet },
    { value: 'asset_non_current', label: t('non_current_assets') || 'Non-current Assets', icon: Building2 },
    { value: 'asset_prepayments', label: t('prepayments') || 'Prepayments', icon: CreditCard },
    { value: 'asset_fixed', label: t('fixed_assets') || 'Fixed Assets', icon: Building2 },
  ],
  liability: [
    { value: 'liability_payable', label: t('payable') || 'Payable', icon: Receipt },
    { value: 'liability_credit_card', label: t('credit_card') || 'Credit Card', icon: CreditCard },
    { value: 'liability_current', label: t('current_liabilities') || 'Current Liabilities', icon: FileText },
    { value: 'liability_non_current', label: t('non_current_liabilities') || 'Non-current Liabilities', icon: FileText },
  ],
  equity: [
    { value: 'equity', label: t('equity') || 'Equity', icon: Scale },
    { value: 'equity_unaffected', label: t('current_year_earnings') || 'Current Year Earnings', icon: TrendingUp },
  ],
  revenue: [
    { value: 'income', label: t('income') || 'Income', icon: TrendingUp },
    { value: 'income_other', label: t('other_income') || 'Other Income', icon: Coins },
  ],
  contra_asset: [
    { value: 'contra_asset_depreciation', label: t('accumulated_depreciation') || 'Eskirish (amortizatsiya)', icon: TrendingDown },
    { value: 'contra_asset_allowance', label: t('allowance') || 'Zaxira (shubhali qarzlar)', icon: AlertTriangle },
  ],
  expense: [
    { value: 'expense', label: t('expenses') || 'Expenses', icon: TrendingDown },
    { value: 'expense_depreciation', label: t('depreciation') || 'Depreciation', icon: TrendingDown },
    { value: 'expense_direct_cost', label: t('cost_of_revenue') || 'Cost of Revenue', icon: Receipt },
  ],
});

const getCurrencies = () => [
  { value: 'UZS', label: 'UZS - Узбекский сум', symbol: "so'm" },
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'RUB', label: 'RUB - Российский рубль', symbol: '₽' },
];

export default function ChartOfAccounts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { accounts, accountTypes: backendAccountTypes, createAccount, updateAccount, deleteAccount, isLoading } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const accountTypes = getAccountTypes(t);
  const internalTypes = getInternalTypes(t);
  const currencies = getCurrencies();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cleanup modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowCreateModal(false);
      setShowEditModal(false);
      setShowDeleteConfirm(false);
    };
  }, []);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'asset',
    internal_type: 'asset_current',
    parent_id: '',
    currency: 'UZS',
    allow_reconciliation: false,
    deprecated: false,
    description: '',
    default_tax_id: '',
  });

  // Build hierarchical structure
  const accountTree = useMemo(() => {
    const rootAccounts = [];
    const accountMap = new Map();

    // First pass: create map
    accounts.forEach(acc => {
      accountMap.set(acc.id, { ...acc, children: [] });
    });

    // Second pass: build tree
    accounts.forEach(acc => {
      const node = accountMap.get(acc.id);
      if (acc.parent_id && accountMap.has(acc.parent_id)) {
        accountMap.get(acc.parent_id).children.push(node);
      } else {
        rootAccounts.push(node);
      }
    });

    return rootAccounts;
  }, [accounts]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;

    if (searchQuery) {
      filtered = filtered.filter(acc =>
        acc.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(acc => acc.type === typeFilter);
    }

    return filtered;
  }, [accounts, searchQuery, typeFilter]);

  // Calculate totals by type (category from backend)
  // Contra-asset accounts (normal_balance=credit) reduce the asset total
  const totals = useMemo(() => {
    const result = { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 };
    accounts.forEach(acc => {
      const category = acc.category || acc.type;
      if (result[category] !== undefined) {
        if (isContraAsset(acc)) {
          result[category] -= Math.abs(acc.current_balance || 0);
        } else {
          result[category] += acc.current_balance || 0;
        }
      }
    });
    return result;
  }, [accounts]);

  const toggleExpand = (accountId) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      await createAccount({
        code: formData.code,
        name: formData.name,
        type: formData.type,
        internal_type: formData.internal_type,
        parent_id: formData.parent_id || null,
        currency: formData.currency,
        allow_reconciliation: formData.allow_reconciliation,
        deprecated: formData.deprecated,
        description: formData.description || null,
        default_tax_id: formData.default_tax_id || null,
      });
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating account:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedAccount) return;
    setIsSaving(true);
    try {
      await updateAccount(selectedAccount.id, {
        name: formData.name,
        type: formData.type,
        internal_type: formData.internal_type,
        parent_id: formData.parent_id || null,
        currency: formData.currency,
        allow_reconciliation: formData.allow_reconciliation,
        deprecated: formData.deprecated,
        description: formData.description || null,
        default_tax_id: formData.default_tax_id || null,
      });
      setShowEditModal(false);
      setSelectedAccount(null);
      resetForm();
    } catch (error) {
      console.error('Error updating account:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (account) => {
    setAccountToDelete(account);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (accountToDelete) {
      try {
        await deleteAccount(accountToDelete.id);
        setShowDeleteConfirm(false);
        setAccountToDelete(null);
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const openEditModal = (account) => {
    setSelectedAccount(account);
    setFormData({
      code: account.code || '',
      name: account.name || '',
      type: account.type || 'asset',
      internal_type: account.internal_type || 'asset_current',
      parent_id: account.parent_id || '',
      currency: account.currency || 'UZS',
      allow_reconciliation: account.allow_reconciliation || false,
      deprecated: account.deprecated || false,
      description: account.description || '',
      default_tax_id: account.default_tax_id || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'asset',
      internal_type: 'asset_current',
      parent_id: '',
      currency: 'UZS',
      allow_reconciliation: false,
      deprecated: false,
      description: '',
      default_tax_id: '',
    });
  };

  // Fetch next available code for a given category
  const fetchNextCode = async (category) => {
    try {
      const matchingType = backendAccountTypes.find(at => at.category === category);
      if (!matchingType) return;
      const result = await financeService.getNextAccountCode(matchingType.id);
      if (result?.code) {
        setFormData(prev => ({ ...prev, code: result.code }));
      }
    } catch (err) {
      // Silently ignore - user can still enter code manually
    }
  };

  // Update internal type when main type changes
  const handleTypeChange = (newType) => {
    const defaultInternalType = internalTypes[newType]?.[0]?.value || newType;
    setFormData({
      ...formData,
      type: newType,
      internal_type: defaultInternalType,
      category: '' // Reset parent when type changes
    });
    fetchNextCode(newType);
  };

  const getTypeInfo = (type) => {
    return accountTypes.find(t => t.value === type) || accountTypes[0];
  };

  const renderAccountRow = (account, level = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const contraAsset = isContraAsset(account);
    const typeInfo = getTypeInfo(account.category || account.type);
    const TypeIcon = typeInfo.icon;
    const displayName = language === 'uz' && account.name_uz ? account.name_uz : account.name;

    return (
      <React.Fragment key={account.id}>
        <TableRow className="hover:bg-slate-50 transition-colors">
          <TableCell className="font-mono text-sm">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              ) : (
                <span className="w-6" />
              )}
              <span className="text-slate-600">{account.code}</span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{displayName}</span>
            </div>
          </TableCell>
          <TableCell>
            {contraAsset ? (
              <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                <AlertTriangle className="w-3 h-3" />
                {t('contra_asset') || 'Contra-Asset'}
              </Badge>
            ) : (
              <Badge className={`${typeInfo.color} flex items-center gap-1 w-fit`}>
                <TypeIcon className="w-3 h-3" />
                {typeInfo.label}
              </Badge>
            )}
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">
            {formatCurrency(account.current_balance || 0)}
          </TableCell>
          <TableCell>
            <Badge variant={account.is_active ? "default" : "secondary"}>
              {account.is_active ? t('active') : t('inactive')}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              {canUpdate(MODULES.FINANCIALS) && (
                <Button variant="ghost" size="sm" onClick={() => openEditModal(account)}>
                  <Edit2 className="w-4 h-4 text-slate-500" />
                </Button>
              )}
              {canDelete(MODULES.FINANCIALS) && (
                <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(account)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && account.children.map(child => renderAccountRow(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="coa" className="w-full">
        <TabsList className="bg-white/80 backdrop-blur-sm p-1 rounded-lg border border-slate-200/60 shadow-sm">
          <TabsTrigger
            value="coa"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <ListTree className="w-4 h-4" />
            {t('chart_of_accounts') || 'Chart of Accounts'}
          </TabsTrigger>
          <TabsTrigger
            value="ledger"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <BookOpen className="w-4 h-4" />
            {t('general_ledger') || 'General Ledger'}
          </TabsTrigger>
          <TabsTrigger
            value="journals"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <BookOpen className="w-4 h-4" />
            {t('journals') || 'Journals'}
          </TabsTrigger>
          <TabsTrigger
            value="fixed-assets"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
          >
            <Building2 className="w-4 h-4" />
            {t('fixed_assets') || 'Asosiy vositalar'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coa" className="mt-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {accountTypes.map(type => {
          const Icon = type.icon;
          return (
            <Card key={type.value} className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${type.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{type.label}</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrencyCompact(totals[type.value])}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Table Card */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Landmark className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('chart_of_accounts') || 'Chart of Accounts'}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {accounts.length} {t('accounts_total') || 'accounts'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_accounts') || 'Search accounts...'}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40 bg-slate-50">
                  <SelectValue placeholder={t('all_types') || 'All Types'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types') || 'All Types'}</SelectItem>
                  {accountTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => { resetForm(); setShowCreateModal(true); fetchNextCode('asset'); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('new_account') || 'New Account'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">{t('loading')}</p>
              </div>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Landmark className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery || typeFilter !== 'all' ? t('no_results_found') : t('no_accounts') || 'No accounts found'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery || typeFilter !== 'all'
                  ? t('try_adjusting_search') || 'Try adjusting your search or filter'
                  : t('start_creating_account') || 'Start by creating your first account to organize your finances'}
              </p>
              {!searchQuery && typeFilter === 'all' && canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => { resetForm(); setShowCreateModal(true); fetchNextCode('asset'); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_account') || 'Create First Account'}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700 w-32">{t('code') || 'Code'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('name') || 'Name'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 w-32">{t('type') || 'Type'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right w-32">{t('balance') || 'Balance'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 w-24">{t('status') || 'Status'}</TableHead>
                    <TableHead className="font-semibold text-slate-700 w-24">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchQuery || typeFilter !== 'all'
                    ? filteredAccounts.map(account => renderAccountRow(account, 0))
                    : accountTree.map(account => renderAccountRow(account, 0))
                  }
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create_account') || 'Create Account'}
            </DialogTitle>
            <DialogDescription>
              {t('create_account_description') || 'Add a new account to your chart of accounts.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Row 1: Code and Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('code') || 'Code'} *</label>
                <Input
                  placeholder="e.g., 1000"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name') || 'Name'} *</label>
                <Input
                  placeholder={t('account_name') || 'Account name'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Row 2: Type and Internal Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('type') || 'Type'} *</label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('account_type') || 'Account Type'} *</label>
                <Select value={formData.internal_type} onValueChange={(v) => setFormData({ ...formData, internal_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(internalTypes[formData.type] || []).map(itype => (
                      <SelectItem key={itype.value} value={itype.value}>{itype.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Currency and Parent Account */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('currency') || 'Currency'}</label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(curr => (
                      <SelectItem key={curr.value} value={curr.value}>{curr.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('parent_account') || 'Parent Account'}</label>
                <Select value={formData.parent_id || 'none'} onValueChange={(v) => setFormData({ ...formData, parent_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_parent') || 'Select parent (optional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('none') || 'None (Root Account)'}</SelectItem>
                    {accounts.filter(a => a.type === formData.type).map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Default Tax (optional) */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('default_tax') || 'Default Tax'}</label>
              <Select value={formData.default_tax_id || 'none'} onValueChange={(v) => setFormData({ ...formData, default_tax_id: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_tax') || 'Select tax (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('no_tax') || 'No Tax'}</SelectItem>
                  <SelectItem value="vat_12">НДС 12%</SelectItem>
                  <SelectItem value="vat_0">НДС 0%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 5: Description */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description') || 'Description'}</label>
              <Textarea
                placeholder={t('optional_description') || 'Optional description'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Row 6: Checkboxes */}
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow_reconciliation"
                  checked={formData.allow_reconciliation}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_reconciliation: checked })}
                />
                <label htmlFor="allow_reconciliation" className="text-sm font-medium text-slate-700 cursor-pointer">
                  {t('allow_reconciliation') || 'Allow Reconciliation'}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deprecated"
                  checked={formData.deprecated}
                  onCheckedChange={(checked) => setFormData({ ...formData, deprecated: checked })}
                />
                <label htmlFor="deprecated" className="text-sm font-medium text-slate-700 cursor-pointer">
                  {t('deprecated') || 'Deprecated'}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.code || !formData.name}
            >
              {isSaving ? (t('saving') || 'Saving...') : (t('create') || 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_account') || 'Edit Account'}
            </DialogTitle>
            <DialogDescription>
              {t('edit_account_description') || 'Modify the account details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Row 1: Code and Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('code') || 'Code'}</label>
                <Input value={formData.code} disabled className="bg-slate-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name') || 'Name'} *</label>
                <Input
                  placeholder={t('account_name') || 'Account name'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Row 2: Type and Internal Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('type') || 'Type'} *</label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('account_type') || 'Account Type'} *</label>
                <Select value={formData.internal_type} onValueChange={(v) => setFormData({ ...formData, internal_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(internalTypes[formData.type] || []).map(itype => (
                      <SelectItem key={itype.value} value={itype.value}>{itype.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Currency and Parent Account */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('currency') || 'Currency'}</label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(curr => (
                      <SelectItem key={curr.value} value={curr.value}>{curr.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('parent_account') || 'Parent Account'}</label>
                <Select value={formData.parent_id || 'none'} onValueChange={(v) => setFormData({ ...formData, parent_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_parent') || 'Select parent (optional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('none') || 'None (Root Account)'}</SelectItem>
                    {accounts.filter(a => a.type === formData.type && a.id !== selectedAccount?.id).map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Default Tax */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('default_tax') || 'Default Tax'}</label>
              <Select value={formData.default_tax_id || 'none'} onValueChange={(v) => setFormData({ ...formData, default_tax_id: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_tax') || 'Select tax (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('no_tax') || 'No Tax'}</SelectItem>
                  <SelectItem value="vat_12">НДС 12%</SelectItem>
                  <SelectItem value="vat_0">НДС 0%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 5: Description */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description') || 'Description'}</label>
              <Textarea
                placeholder={t('optional_description') || 'Optional description'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Row 6: Checkboxes */}
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_allow_reconciliation"
                  checked={formData.allow_reconciliation}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_reconciliation: checked })}
                />
                <label htmlFor="edit_allow_reconciliation" className="text-sm font-medium text-slate-700 cursor-pointer">
                  {t('allow_reconciliation') || 'Allow Reconciliation'}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_deprecated"
                  checked={formData.deprecated}
                  onCheckedChange={(checked) => setFormData({ ...formData, deprecated: checked })}
                />
                <label htmlFor="edit_deprecated" className="text-sm font-medium text-slate-700 cursor-pointer">
                  {t('deprecated') || 'Deprecated'}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleEdit}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.name}
            >
              {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('confirm_delete') || 'Confirm Delete'}
            </DialogTitle>
            <DialogDescription>
              {t('delete_account_confirmation') || 'Are you sure you want to delete this account?'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {accountToDelete && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="font-mono text-sm text-slate-500">{accountToDelete.code}</p>
                <p className="font-medium">{accountToDelete.name}</p>
                <Badge className={`mt-2 ${getTypeInfo(accountToDelete.type).color}`}>
                  {getTypeInfo(accountToDelete.type).label}
                </Badge>
              </div>
            )}
            <p className="mt-3 text-sm text-red-600">
              {t('action_cannot_be_undone') || 'This action cannot be undone.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('delete') || 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <GeneralLedgerView />
        </TabsContent>

        <TabsContent value="journals" className="mt-4">
          <JournalManagement />
        </TabsContent>

        <TabsContent value="fixed-assets" className="mt-4">
          <FixedAssets />
        </TabsContent>
      </Tabs>
    </div>
  );
}
