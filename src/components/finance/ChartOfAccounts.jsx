import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Landmark, ChevronRight, ChevronDown, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";

const accountTypes = [
  { value: 'asset', label: 'Asset', icon: DollarSign, color: 'bg-blue-100 text-blue-800' },
  { value: 'liability', label: 'Liability', icon: TrendingDown, color: 'bg-red-100 text-red-800' },
  { value: 'equity', label: 'Equity', icon: Scale, color: 'bg-purple-100 text-purple-800' },
  { value: 'revenue', label: 'Revenue', icon: TrendingUp, color: 'bg-green-100 text-green-800' },
  { value: 'expense', label: 'Expense', icon: TrendingDown, color: 'bg-orange-100 text-orange-800' },
];

export default function ChartOfAccounts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { accounts, createAccount, updateAccount, deleteAccount, isLoading } = useFinancials();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'asset',
    parent_id: '',
    description: '',
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

  // Calculate totals by type
  const totals = useMemo(() => {
    const result = { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 };
    accounts.forEach(acc => {
      if (result[acc.type] !== undefined) {
        result[acc.type] += acc.balance || 0;
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
        parent_id: formData.parent_id || null,
        description: formData.description || null,
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
        parent_id: formData.parent_id || null,
        description: formData.description || null,
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

  const handleDelete = async (account) => {
    if (window.confirm(`Are you sure you want to delete account "${account.name}"?`)) {
      try {
        await deleteAccount(account.id);
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
      parent_id: account.parent_id || '',
      description: account.description || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'asset',
      parent_id: '',
      description: '',
    });
  };

  const getTypeInfo = (type) => {
    return accountTypes.find(t => t.value === type) || accountTypes[0];
  };

  const renderAccountRow = (account, level = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const typeInfo = getTypeInfo(account.type);
    const TypeIcon = typeInfo.icon;

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
              <span className="font-medium text-slate-900">{account.name}</span>
            </div>
          </TableCell>
          <TableCell>
            <Badge className={`${typeInfo.color} flex items-center gap-1 w-fit`}>
              <TypeIcon className="w-3 h-3" />
              {typeInfo.label}
            </Badge>
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">
            ${(account.balance || 0).toLocaleString()}
          </TableCell>
          <TableCell>
            <Badge variant={account.is_active ? "default" : "secondary"}>
              {account.is_active ? t('active') : t('inactive')}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEditModal(account)}>
                <Edit2 className="w-4 h-4 text-slate-500" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(account)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && account.children.map(child => renderAccountRow(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
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
                      ${totals[type.value].toLocaleString()}
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
              <Button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('new_account') || 'New Account'}
              </Button>
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
                  ? 'Try adjusting your search or filter'
                  : 'Start by creating your first account to organize your finances'}
              </p>
              {!searchQuery && typeFilter === 'all' && (
                <Button
                  onClick={() => { resetForm(); setShowCreateModal(true); }}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create_account') || 'Create Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('type') || 'Type'} *</label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
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
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('parent_account') || 'Parent Account'}</label>
              <Select value={formData.parent_id} onValueChange={(v) => setFormData({ ...formData, parent_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_parent') || 'Select parent (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('none') || 'None (Root Account)'}</SelectItem>
                  {accounts.filter(a => a.type === formData.type).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description') || 'Description'}</label>
              <Input
                placeholder={t('optional_description') || 'Optional description'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.code || !formData.name}
            >
              {isSaving ? t('saving') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_account') || 'Edit Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('code') || 'Code'}</label>
                <Input value={formData.code} disabled className="bg-slate-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('type') || 'Type'} *</label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
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
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('parent_account') || 'Parent Account'}</label>
              <Select value={formData.parent_id} onValueChange={(v) => setFormData({ ...formData, parent_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_parent') || 'Select parent (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('none') || 'None (Root Account)'}</SelectItem>
                  {accounts.filter(a => a.type === formData.type && a.id !== selectedAccount?.id).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description') || 'Description'}</label>
              <Input
                placeholder={t('optional_description') || 'Optional description'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleEdit}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.name}
            >
              {isSaving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
