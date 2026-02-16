import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LabelWithHelp } from "@/components/ui/field-help";
import {
  Plus, Target, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, Edit2, Trash2, BarChart3, PieChart, CheckCircle2,
  XCircle, Clock, Copy
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import { format } from "date-fns";

export default function BudgetManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    budgets = [],
    budgetLines = [],
    accounts = [],
    fiscalYears = [],
    createBudget,
    updateBudget,
    deleteBudget,
    createBudgetLine,
    updateBudgetLine,
    deleteBudgetLine,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLinesModal, setShowLinesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    fiscal_year_id: '',
    budget_type: 'expense', // expense, revenue, both
    start_date: '',
    end_date: '',
    total_amount: '',
    description: '',
    status: 'draft',
  });

  const [lineFormData, setLineFormData] = useState({
    account_id: '',
    planned_amount: '',
    period_1: '', period_2: '', period_3: '', period_4: '',
    period_5: '', period_6: '', period_7: '', period_8: '',
    period_9: '', period_10: '', period_11: '', period_12: '',
    notes: '',
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    const activeBudgets = budgets.filter(b => b.status === 'active').length;
    const totalBudgeted = budgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalActual = budgetLines.reduce((sum, l) => sum + (l.actual_amount || 0), 0);
    const totalPlanned = budgetLines.reduce((sum, l) => sum + (l.planned_amount || 0), 0);
    const variance = totalPlanned - totalActual;
    const variancePercent = totalPlanned > 0 ? ((variance / totalPlanned) * 100).toFixed(1) : 0;

    return { activeBudgets, totalBudgeted, totalActual, totalPlanned, variance, variancePercent };
  }, [budgets, budgetLines]);

  // Filter budgets
  const filteredBudgets = useMemo(() => {
    if (typeFilter === 'all') return budgets;
    return budgets.filter(b => b.budget_type === typeFilter);
  }, [budgets, typeFilter]);

  const handleCreateBudget = async () => {
    setIsSaving(true);
    try {
      await createBudget({
        ...formData,
        total_amount: parseFloat(formData.total_amount) || 0,
      });
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating budget:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBudget = async () => {
    if (!selectedBudget) return;
    setIsSaving(true);
    try {
      await updateBudget(selectedBudget.id, {
        ...formData,
        total_amount: parseFloat(formData.total_amount) || 0,
      });
      setShowEditModal(false);
      setSelectedBudget(null);
      resetForm();
    } catch (error) {
      console.error('Error updating budget:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async () => {
    if (!budgetToDelete) return;
    setIsSaving(true);
    try {
      await deleteBudget(budgetToDelete.id);
      setShowDeleteModal(false);
      setBudgetToDelete(null);
    } catch (error) {
      console.error('Error deleting budget:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (budget) => {
    setBudgetToDelete(budget);
    setShowDeleteModal(true);
  };

  const handleAddBudgetLine = async () => {
    if (!selectedBudget) return;
    setIsSaving(true);
    try {
      const monthlyAmounts = {};
      for (let i = 1; i <= 12; i++) {
        monthlyAmounts[`period_${i}`] = parseFloat(lineFormData[`period_${i}`]) || 0;
      }

      await createBudgetLine({
        budget_id: selectedBudget.id,
        account_id: lineFormData.account_id,
        planned_amount: parseFloat(lineFormData.planned_amount) || 0,
        actual_amount: 0,
        ...monthlyAmounts,
        notes: lineFormData.notes,
      });
      resetLineForm();
    } catch (error) {
      console.error('Error creating budget line:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (budget) => {
    setSelectedBudget(budget);
    setFormData({
      name: budget.name || '',
      code: budget.code || '',
      fiscal_year_id: budget.fiscal_year_id || '',
      budget_type: budget.budget_type || 'expense',
      start_date: budget.start_date || '',
      end_date: budget.end_date || '',
      total_amount: budget.total_amount?.toString() || '',
      description: budget.description || '',
      status: budget.status || 'draft',
    });
    setShowEditModal(true);
  };

  const openLinesModal = (budget) => {
    setSelectedBudget(budget);
    setShowLinesModal(true);
  };

  const resetForm = () => {
    const year = new Date().getFullYear();
    const num = (budgets?.length || 0) + 1;
    setFormData({
      name: '',
      code: `BUD-${year}-${String(num).padStart(2, '0')}`,
      fiscal_year_id: '',
      budget_type: 'expense',
      start_date: '',
      end_date: '',
      total_amount: '',
      description: '',
      status: 'draft',
    });
  };

  const resetLineForm = () => {
    setLineFormData({
      account_id: '',
      planned_amount: '',
      period_1: '', period_2: '', period_3: '', period_4: '',
      period_5: '', period_6: '', period_7: '', period_8: '',
      period_9: '', period_10: '', period_11: '', period_12: '',
      notes: '',
    });
  };

  const getBudgetLines = (budgetId) => {
    return budgetLines.filter(l => l.budget_id === budgetId);
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> {t('draft') || 'Draft'}</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> {t('active') || 'Active'}</Badge>;
      case 'closed':
        return <Badge className="bg-slate-100 text-slate-700"><XCircle className="w-3 h-3 mr-1" /> {t('closed') || 'Closed'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'expense':
        return <Badge className="bg-red-100 text-red-700"><TrendingDown className="w-3 h-3 mr-1" /> {t('expense') || 'Expense'}</Badge>;
      case 'revenue':
        return <Badge className="bg-green-100 text-green-700"><TrendingUp className="w-3 h-3 mr-1" /> {t('revenue') || 'Revenue'}</Badge>;
      case 'income':
        return <Badge className="bg-emerald-100 text-emerald-700"><TrendingUp className="w-3 h-3 mr-1" /> {t('income_budget') || 'Income'}</Badge>;
      case 'cashflow':
        return <Badge className="bg-blue-100 text-blue-700"><BarChart3 className="w-3 h-3 mr-1" /> {t('cashflow_budget') || 'Cash Flow'}</Badge>;
      case 'investment':
        return <Badge className="bg-purple-100 text-purple-700"><Target className="w-3 h-3 mr-1" /> {t('investment_budget') || 'Investment'}</Badge>;
      case 'production':
        return <Badge className="bg-amber-100 text-amber-700"><PieChart className="w-3 h-3 mr-1" /> {t('production_budget') || 'Production'}</Badge>;
      case 'both':
        return <Badge className="bg-blue-100 text-blue-700"><BarChart3 className="w-3 h-3 mr-1" /> {t('both') || 'Both'}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const calculateBudgetUsage = (budget) => {
    const lines = getBudgetLines(budget.id);
    const totalPlanned = lines.reduce((sum, l) => sum + (l.planned_amount || 0), 0);
    const totalActual = lines.reduce((sum, l) => sum + (l.actual_amount || 0), 0);
    const percentage = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
    const warningThreshold = budget.warning_threshold || 80;
    const isWarning = percentage >= warningThreshold && percentage < 100;
    const isOverBudget = percentage >= 100;
    return { totalPlanned, totalActual, percentage, warningThreshold, isWarning, isOverBudget };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600 font-medium">{t('active_budgets') || 'Active Budgets'}</p>
                <p className="text-2xl font-bold text-purple-800">{stats.activeBudgets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">{t('total_planned') || 'Total Planned'}</p>
                <p className="text-lg font-bold text-blue-800">{formatCurrency(stats.totalPlanned)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-medium">{t('total_actual') || 'Total Actual'}</p>
                <p className="text-lg font-bold text-amber-800">{formatCurrency(stats.totalActual)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${stats.variance >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${stats.variance >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-lg flex items-center justify-center`}>
                {stats.variance >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <p className={`text-xs font-medium ${stats.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {t('variance') || 'Variance'}
                </p>
                <p className={`text-lg font-bold ${stats.variance >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {stats.variancePercent}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{t('budget_management') || 'Budget Management'}</CardTitle>
                <p className="text-sm text-slate-500">{t('budget_description') || 'Plan and track your financial budgets'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('all_types') || 'All Types'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types') || 'All Types'}</SelectItem>
                  <SelectItem value="expense">{t('expense') || 'Expense'}</SelectItem>
                  <SelectItem value="revenue">{t('revenue') || 'Revenue'}</SelectItem>
                  <SelectItem value="income">{t('income_budget') || 'Income'}</SelectItem>
                  <SelectItem value="cashflow">{t('cashflow_budget') || 'Cash Flow'}</SelectItem>
                  <SelectItem value="investment">{t('investment_budget') || 'Investment'}</SelectItem>
                  <SelectItem value="production">{t('production_budget') || 'Production'}</SelectItem>
                </SelectContent>
              </Select>
              {canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => { resetForm(); setShowCreateModal(true); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('new_budget') || 'New Budget'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBudgets.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Target className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {t('no_budgets') || 'No budgets found'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {t('budget_empty_description') || 'Create budgets to plan and control your income and expenses.'}
              </p>
              {canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => { resetForm(); setShowCreateModal(true); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_budget') || 'Create First Budget'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('code') || 'Code'}</TableHead>
                  <TableHead>{t('name') || 'Name'}</TableHead>
                  <TableHead>{t('type') || 'Type'}</TableHead>
                  <TableHead>{t('period') || 'Period'}</TableHead>
                  <TableHead>{t('budget_usage') || 'Usage'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBudgets.map((budget) => {
                  const usage = calculateBudgetUsage(budget);

                  return (
                    <TableRow key={budget.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-medium">{budget.code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{budget.name}</p>
                          {budget.description && (
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{budget.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(budget.budget_type)}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {budget.start_date && budget.end_date ? (
                          <>
                            {format(new Date(budget.start_date), 'dd.MM.yy')} - {format(new Date(budget.end_date), 'dd.MM.yy')}
                          </>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span className={usage.isOverBudget ? 'text-red-600 font-medium' : usage.isWarning ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                              {usage.percentage.toFixed(0)}%
                            </span>
                            <span className="text-slate-400">
                              {formatCurrency(usage.totalActual)}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(usage.percentage, 100)}
                            className={`h-2 ${usage.isOverBudget ? '[&>div]:bg-red-500' : usage.isWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                          />
                          {usage.isWarning && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span className="text-[10px] text-amber-600">{t('budget_warning') || 'Warning'} ({usage.warningThreshold}%)</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(budget.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openLinesModal(budget)} title={t('budget_lines') || 'Budget Lines'}>
                            <BarChart3 className="w-4 h-4 text-slate-500" />
                          </Button>
                          {canUpdate(MODULES.FINANCIALS) && (
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(budget)} title={t('edit') || 'Edit'}>
                              <Edit2 className="w-4 h-4 text-slate-500" />
                            </Button>
                          )}
                          {canDelete(MODULES.FINANCIALS) && (
                            <Button variant="ghost" size="sm" onClick={() => openDeleteModal(budget)} title={t('delete') || 'Delete'}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
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

      {/* Create/Edit Budget Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedBudget(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--genix-blue)]" />
              {showEditModal ? (t('edit_budget') || 'Edit Budget') : (t('create_budget') || 'Create Budget')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="budget_code" label={t('code') || 'Code'} helpText={t('help_budget_code')} required />
                <Input
                  id="budget_code"
                  value={formData.code}
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="budget_type" label={t('budget_type') || 'Budget Type'} helpText={t('help_budget_type')} required />
                <Select value={formData.budget_type} onValueChange={(v) => setFormData({ ...formData, budget_type: v })}>
                  <SelectTrigger id="budget_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{t('expense') || 'Expense'}</SelectItem>
                    <SelectItem value="revenue">{t('revenue') || 'Revenue'}</SelectItem>
                    <SelectItem value="income">{t('income_budget') || 'Income'}</SelectItem>
                    <SelectItem value="cashflow">{t('cashflow_budget') || 'Cash Flow'}</SelectItem>
                    <SelectItem value="investment">{t('investment_budget') || 'Investment'}</SelectItem>
                    <SelectItem value="production">{t('production_budget') || 'Production'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <LabelWithHelp htmlFor="budget_name" label={t('name') || 'Name'} helpText={t('help_budget_name')} required />
              <Input
                id="budget_name"
                placeholder={t('budget_name') || 'Budget name'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <LabelWithHelp htmlFor="fiscal_year" label={t('fiscal_year') || 'Fiscal Year'} helpText={t('help_budget_fiscal_year')} required />
              <Select value={formData.fiscal_year_id} onValueChange={(v) => setFormData({ ...formData, fiscal_year_id: v })}>
                <SelectTrigger id="fiscal_year">
                  <SelectValue placeholder={t('select_fiscal_year') || 'Select fiscal year'} />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.filter(fy => fy.status === 'open').map(fy => (
                    <SelectItem key={fy.id} value={fy.id}>
                      {fy.name} ({fy.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="start_date" label={t('start_date') || 'Start Date'} helpText={t('help_budget_period')} required />
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="end_date" label={t('end_date') || 'End Date'} helpText={t('help_budget_period')} required />
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="total_amount" label={t('total_amount') || 'Total Amount'} helpText={t('help_budget_amount')} />
                <Input
                  id="total_amount"
                  type="number"
                  placeholder="0"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="budget_status" label={t('status') || 'Status'} helpText={t('help_budget_status')} />
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger id="budget_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                    <SelectItem value="active">{t('active') || 'Active'}</SelectItem>
                    <SelectItem value="closed">{t('closed') || 'Closed'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <LabelWithHelp htmlFor="budget_description" label={t('description') || 'Description'} helpText={t('help_budget_description')} />
              <Textarea
                id="budget_description"
                placeholder={t('budget_description_placeholder') || 'Budget description...'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={showEditModal ? handleUpdateBudget : handleCreateBudget}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.code || !formData.name}
            >
              {isSaving ? (t('saving') || 'Saving...') : showEditModal ? (t('save') || 'Save') : (t('create') || 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Lines Modal */}
      <Dialog open={showLinesModal} onOpenChange={(open) => {
        if (!open) {
          setShowLinesModal(false);
          setSelectedBudget(null);
          resetLineForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('budget_lines') || 'Budget Lines'} - {selectedBudget?.name}
            </DialogTitle>
            <DialogDescription>
              {t('budget_lines_description') || 'Add and manage budget allocations by account.'}
            </DialogDescription>
          </DialogHeader>

          {/* Add new line form */}
          <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
            <h4 className="font-medium text-slate-700">{t('add_budget_line') || 'Add Budget Line'}</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <LabelWithHelp htmlFor="line_account" label={t('account') || 'Account'} helpText={t('help_budget_account')} />
                <Select value={lineFormData.account_id} onValueChange={(v) => setLineFormData({ ...lineFormData, account_id: v })}>
                  <SelectTrigger id="line_account">
                    <SelectValue placeholder={t('select_account') || 'Select account'} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter(a => selectedBudget?.budget_type === 'both' ||
                        (selectedBudget?.budget_type === 'expense' && a.type === 'expense') ||
                        (selectedBudget?.budget_type === 'revenue' && a.type === 'revenue'))
                      .map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="planned_amount" label={t('planned_amount') || 'Planned Amount'} helpText={t('help_budget_planned')} />
                <Input
                  id="planned_amount"
                  type="number"
                  placeholder="0"
                  value={lineFormData.planned_amount}
                  onChange={(e) => setLineFormData({ ...lineFormData, planned_amount: e.target.value })}
                />
              </div>
            </div>
            <Button
              onClick={handleAddBudgetLine}
              disabled={isSaving || !lineFormData.account_id || !lineFormData.planned_amount}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" /> {t('add_line') || 'Add Line'}
            </Button>
          </div>

          {/* Existing lines */}
          <div className="mt-4">
            {selectedBudget && getBudgetLines(selectedBudget.id).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('account') || 'Account'}</TableHead>
                    <TableHead className="text-right">{t('planned') || 'Planned'}</TableHead>
                    <TableHead className="text-right">{t('actual') || 'Actual'}</TableHead>
                    <TableHead className="text-right">{t('variance') || 'Variance'}</TableHead>
                    <TableHead>{t('progress') || 'Progress'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getBudgetLines(selectedBudget.id).map((line) => {
                    const variance = (line.planned_amount || 0) - (line.actual_amount || 0);
                    const usage = line.planned_amount > 0 ? ((line.actual_amount || 0) / line.planned_amount) * 100 : 0;
                    const isOverBudget = usage > 100;

                    return (
                      <TableRow key={line.id}>
                        <TableCell>{getAccountName(line.account_id)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(line.planned_amount || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.actual_amount || 0)}</TableCell>
                        <TableCell className={`text-right font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                        </TableCell>
                        <TableCell>
                          <div className="w-24">
                            <Progress
                              value={Math.min(usage, 100)}
                              className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`}
                            />
                            <span className={`text-xs ${isOverBudget ? 'text-red-600' : 'text-slate-500'}`}>
                              {usage.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-slate-500">
                {t('no_budget_lines') || 'No budget lines yet. Add accounts above.'}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinesModal(false)}>
              {t('close') || 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteModal(false);
          setBudgetToDelete(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {t('delete_budget') || 'Delete Budget'}
            </DialogTitle>
            <DialogDescription>
              {t('confirm_delete_budget') || 'Are you sure you want to delete this budget?'}
            </DialogDescription>
          </DialogHeader>
          {budgetToDelete && (
            <div className="py-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">{t('code') || 'Code'}:</span>
                  <span className="font-mono font-medium">{budgetToDelete.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">{t('name') || 'Name'}:</span>
                  <span className="font-medium">{budgetToDelete.name}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleDeleteBudget}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isSaving}
            >
              {isSaving ? (t('deleting') || 'Deleting...') : (t('delete') || 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
