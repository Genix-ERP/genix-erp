import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Target, TrendingUp, TrendingDown, AlertTriangle, DollarSign,
  Edit2, Trash2, BarChart3, CheckCircle2, XCircle, Clock, ArrowLeft,
  ChevronRight, ChevronLeft, Send, ThumbsUp, ThumbsDown, RefreshCw,
  Wallet, CreditCard, ArrowUpRight, ArrowDownRight, Calendar,
  FileText, Star, Zap, LayoutDashboard, Eye,
  Building2, Loader2, Info
} from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import { format } from "date-fns";
import financeService from '@/api/services/finance';
import AccountCombobox from '@/components/shared/AccountCombobox';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUDGET_TYPES = [
  { value: 'combined', icon: BarChart3, color: 'blue', recommended: true },
  { value: 'cashflow', icon: Wallet, color: 'green' },
  { value: 'investment', icon: Target, color: 'purple' },
  { value: 'expense', icon: CreditCard, color: 'red' },
];

const APPROACHES = [
  { value: 'fixed', color: 'blue' },
  { value: 'flexible', color: 'green' },
  { value: 'zero_based', color: 'purple' },
  { value: 'rolling', color: 'amber' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const BUDGET_CATEGORIES = [
  { value: 'operational', label_en: 'Operational Expenses', label_uz: 'Operatsion xarajatlar', label_ru: 'Операционные расходы' },
  { value: 'salaries', label_en: 'Salaries & Wages', label_uz: 'Ish haqi va maosh', label_ru: 'Зарплаты и оклады' },
  { value: 'marketing', label_en: 'Marketing & Sales', label_uz: 'Marketing va sotish', label_ru: 'Маркетинг и продажи' },
  { value: 'infrastructure', label_en: 'Infrastructure & Rent', label_uz: 'Infratuzilma va ijara', label_ru: 'Инфраструктура и аренда' },
  { value: 'revenue', label_en: 'Revenue & Income', label_uz: 'Daromad va foyda', label_ru: 'Доход и прибыль' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateInput = (d) => (d ? d.substring(0, 10) : '');

const getStatusColor = (pct, type) => {
  if (type === 'revenue') {
    if (pct >= 90) return 'green';
    if (pct >= 70) return 'yellow';
    return 'red';
  }
  if (pct > 100) return 'red';
  if (pct >= 80) return 'yellow';
  return 'green';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status, approvalStatus }) => {
  if (approvalStatus === 'pending') return (
    <Badge className="bg-amber-100 text-amber-700 gap-1"><Clock className="w-3 h-3" />Pending approval</Badge>
  );
  switch (status) {
    case 'active': return <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle2 className="w-3 h-3" />Active</Badge>;
    case 'closed': return <Badge className="bg-slate-100 text-slate-600 gap-1"><XCircle className="w-3 h-3" />Closed</Badge>;
    default: return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Draft</Badge>;
  }
};

const TypeBadge = ({ type, t }) => {
  const map = {
    combined: 'bg-blue-100 text-blue-700',
    cashflow: 'bg-green-100 text-green-700',
    investment: 'bg-purple-100 text-purple-700',
    expense: 'bg-red-100 text-red-700',
    revenue: 'bg-emerald-100 text-emerald-700',
    production: 'bg-amber-100 text-amber-700',
  };
  return <Badge className={map[type] || 'bg-slate-100 text-slate-600'}>{t(`budget_type_${type}`) || type}</Badge>;
};

const UsageBar = ({ planned, actual, type, warningThreshold = 80, formatCurrency }) => {
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 150) : 0;
  const color = getStatusColor(pct, type);
  const barColor = color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-amber-500' : 'bg-red-500';
  const textColor = color === 'green' ? 'text-green-700' : color === 'yellow' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="min-w-[160px] space-y-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${textColor}`}>{pct.toFixed(0)}%</span>
        {pct > 100 && <Badge className="bg-red-100 text-red-700 text-[10px] px-1">Over</Badge>}
        {pct >= warningThreshold && pct <= 100 && <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1">&gt;{warningThreshold}%</Badge>}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="text-[11px] text-slate-500">{formatCurrency(actual)} / {formatCurrency(planned)}</div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BudgetManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    budgets = [], budgetLines = [], accounts = [], fiscalYears = [],
    createBudget, updateBudget, deleteBudget, activateBudget,
    createBudgetLine, updateBudgetLine,
  } = useFinancials();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [view, setView] = useState('list');
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [isSaving, setIsSaving] = useState(false);

  // Wizard
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardMode, setWizardMode] = useState('create');
  const [wizardData, setWizardData] = useState({
    name: '', code: '', budget_type: 'combined', approach: 'fixed',
    breakdown: 'monthly', start_date: '', end_date: '',
    fiscal_year_id: '', overspend_policy: 'warn', description: '',
    rolling_horizon_months: 3, auto_extend: true,
    default_expense_account_id: '', default_revenue_account_id: '',
  });
  const [wizardLines, setWizardLines] = useState([]);

  // Cash Flow
  const [cashFlowData, setCashFlowData] = useState(null);
  const [cashFlowLoading, setCashFlowLoading] = useState(false);

  // Plan vs Actual
  const [pvaData, setPvaData] = useState(null);
  const [pvaLoading, setPvaLoading] = useState(false);
  const [pvaBudgetId, setPvaBudgetId] = useState('');

  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Stats
  const activeBudgets = useMemo(() => budgets.filter(b => b.status === 'active').length, [budgets]);
  const totalPlanned = useMemo(() => budgetLines.reduce((s, l) => s + (l.budgeted_amount || l.planned_amount || 0), 0), [budgetLines]);
  const totalActual = useMemo(() => budgetLines.reduce((s, l) => s + (l.actual_amount || 0), 0), [budgetLines]);
  const variance = totalPlanned - totalActual;

  const filteredBudgets = useMemo(() => {
    if (typeFilter === 'all') return budgets;
    return budgets.filter(b => b.budget_type === typeFilter);
  }, [budgets, typeFilter]);

  const getBudgetLines = useCallback((id) => budgetLines.filter(l => l.budget_id === id), [budgetLines]);

  const calcUsage = useCallback((budget) => {
    const lines = getBudgetLines(budget.id);
    const planned = lines.reduce((s, l) => s + (l.budgeted_amount || l.planned_amount || 0), 0) || budget.total_amount || 0;
    const actual = lines.reduce((s, l) => s + (l.actual_amount || 0), 0);
    const pct = planned > 0 ? (actual / planned) * 100 : 0;
    const wt = budget.warning_threshold || 80;
    return { planned, actual, pct, isWarning: pct >= wt && pct <= 100, isOver: pct > 100 };
  }, [getBudgetLines]);

  const alerts = useMemo(() => {
    const out = [];
    budgets.filter(b => b.status === 'active').forEach(b => {
      const u = calcUsage(b);
      if (u.isOver) out.push({ type: 'overspent', budget: b, pct: u.pct });
    });
    budgets.filter(b => b.approval_status === 'pending').forEach(b => {
      out.push({ type: 'pending_approval', budget: b });
    });
    return out;
  }, [budgets, calcUsage]);

  // ── Wizard ──────────────────────────────────────────────────────────────────
  const initWizard = useCallback((mode, budget = null) => {
    setWizardMode(mode);
    setWizardStep(1);
    if (mode === 'edit' && budget) {
      setWizardData({
        name: budget.name || '', code: budget.code || '',
        budget_type: budget.budget_type || 'combined',
        approach: budget.approach || 'fixed',
        breakdown: budget.breakdown || 'monthly',
        start_date: toDateInput(budget.start_date), end_date: toDateInput(budget.end_date),
        fiscal_year_id: budget.fiscal_year_id || '',
        overspend_policy: budget.overspend_policy || 'warn',
        description: budget.description || '',
        rolling_horizon_months: budget.rolling_horizon_months || 3,
        auto_extend: budget.auto_extend !== false,
      });
      setWizardLines(getBudgetLines(budget.id).map(l => ({ ...l })));
    } else {
      const year = new Date().getFullYear();
      const num = (budgets.length || 0) + 1;
      setWizardData({
        name: '', code: `BUD-${year}-${String(num).padStart(2, '0')}`,
        budget_type: 'combined', approach: 'fixed', breakdown: 'monthly',
        start_date: '', end_date: '', fiscal_year_id: '',
        overspend_policy: 'warn', description: '',
        rolling_horizon_months: 3, auto_extend: true,
      });
      setWizardLines([]);
    }
    setView('wizard');
  }, [budgets, getBudgetLines]);

  const setQuarter = (q) => {
    const y = new Date().getFullYear();
    const s = ['01-01','04-01','07-01','10-01'][q];
    const e = ['03-31','06-30','09-30','12-31'][q];
    setWizardData(d => ({ ...d, start_date: `${y}-${s}`, end_date: `${y}-${e}` }));
  };

  const addLine = (lineType) => {
    const type = lineType || (wizardData.budget_type === 'revenue' ? 'revenue' : 'expense');
    const defaultAccountId = type === 'revenue'
      ? (wizardData.default_revenue_account_id || '')
      : (wizardData.default_expense_account_id || '');
    setWizardLines(prev => [...prev, {
      _id: Date.now(), account_id: defaultAccountId, category_name: '', line_type: type,
      budgeted_amount: 0, justification: '',
      period_1: 0, period_2: 0, period_3: 0, period_4: 0,
      period_5: 0, period_6: 0, period_7: 0, period_8: 0,
      period_9: 0, period_10: 0, period_11: 0, period_12: 0,
    }]);
  };

  const updateLine = (idx, key, val) => setWizardLines(prev => prev.map((l, i) => {
    if (i !== idx) return l;
    const u = { ...l, [key]: val };
    if (key.startsWith('period_')) {
      u.budgeted_amount = [1,2,3,4,5,6,7,8,9,10,11,12].reduce((s, n) => s + parseFloat(u[`period_${n}`] || 0), 0);
    }
    // When switching line_type, auto-fill account from default if current account is empty
    if (key === 'line_type' && !l.account_id) {
      u.account_id = val === 'revenue'
        ? (wizardData.default_revenue_account_id || '')
        : (wizardData.default_expense_account_id || '');
    }
    return u;
  }));

  const fillPeriods = (idx, v) => setWizardLines(prev => prev.map((l, i) => {
    if (i !== idx) return l;
    const u = { ...l };
    for (let n = 1; n <= 12; n++) u[`period_${n}`] = v;
    u.budgeted_amount = v * 12;
    return u;
  }));

  const removeLine = (idx) => setWizardLines(prev => prev.filter((_, i) => i !== idx));

  const totalRevenue = wizardLines.filter(l => l.line_type === 'revenue').reduce((s, l) => s + parseFloat(l.budgeted_amount || 0), 0);
  const totalExpense = wizardLines.filter(l => l.line_type !== 'revenue').reduce((s, l) => s + parseFloat(l.budgeted_amount || 0), 0);

  const getCategoryLabel = (cat) => {
    const c = BUDGET_CATEGORIES.find(b => b.value === cat);
    if (!c) return cat || '';
    if (language === 'uz') return c.label_uz;
    if (language === 'ru') return c.label_ru;
    return c.label_en;
  };

  const getFilteredAccounts = (lineType) => {
    return accounts.filter(a => {
      const code = String(a.code || '');
      if (lineType === 'revenue') {
        return a.account_type === 'revenue' || a.type === 'revenue' ||
          (code >= '4000' && code < '5000');
      }
      if (lineType === 'expense') {
        return a.account_type === 'expense' || a.type === 'expense' ||
          (code >= '5000' && code < '9000');
      }
      // investment or other — show all
      return true;
    });
  };

  const saveWizard = async (status = 'draft') => {
    setIsSaving(true);
    try {
      const payload = { ...wizardData, total_amount: totalRevenue + totalExpense, status };
      let saved;
      if (wizardMode === 'edit' && selectedBudget) {
        saved = await updateBudget(selectedBudget.id, payload);
      } else {
        saved = await createBudget(payload);
      }
      const budgetId = saved?.id || selectedBudget?.id;
      for (const line of wizardLines) {
        if (!line.account_id) continue;
        const lp = {
          budget_id: budgetId, account_id: line.account_id,
          budgeted_amount: parseFloat(line.budgeted_amount || 0),
          planned_amount: parseFloat(line.budgeted_amount || 0),
          line_type: line.line_type, category_name: line.category_name,
          justification: line.justification,
          period_1: line.period_1, period_2: line.period_2, period_3: line.period_3,
          period_4: line.period_4, period_5: line.period_5, period_6: line.period_6,
          period_7: line.period_7, period_8: line.period_8, period_9: line.period_9,
          period_10: line.period_10, period_11: line.period_11, period_12: line.period_12,
        };
        if (line.id) await updateBudgetLine(line.id, lp).catch(() => {});
        else await createBudgetLine(lp).catch(() => {});
      }
      setView('list');
    } catch (e) {
      console.error('Error saving budget:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const loadCashFlow = async () => {
    setCashFlowLoading(true);
    try { setCashFlowData(await financeService.getBudgetCashFlow()); }
    catch (e) { console.error(e); }
    finally { setCashFlowLoading(false); }
  };

  const loadPva = async (id) => {
    if (!id) return;
    setPvaLoading(true);
    try { setPvaData(await financeService.getBudgetPlanVsActual(id)); }
    catch (e) { console.error(e); }
    finally { setPvaLoading(false); }
  };

  useEffect(() => { if (view === 'cashflow') loadCashFlow(); }, [view]);
  useEffect(() => { if (view === 'pvsa' && pvaBudgetId) loadPva(pvaBudgetId); }, [view, pvaBudgetId]);

  const openDetail = (budget) => { setSelectedBudget(budget); setDetailTab('overview'); setView('detail'); };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try { await deleteBudget(deleteTarget.id); setDeleteTarget(null); }
    finally { setIsSaving(false); }
  };

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center shrink-0"><Target className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-purple-600 font-medium">{t('active_budgets') || 'Active Budgets'}</p><p className="text-xl font-bold text-purple-800">{activeBudgets}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center shrink-0"><BarChart3 className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-blue-600 font-medium">{t('total_planned') || 'Total Planned'}</p><p className="text-base font-bold text-blue-800 truncate">{formatCurrencyCompact(totalPlanned)}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-amber-600 font-medium">{t('total_actual') || 'Total Actual'}</p><p className="text-base font-bold text-amber-800 truncate">{formatCurrencyCompact(totalActual)}</p></div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${variance >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${variance >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
              {variance >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <p className={`text-xs font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t('variance') || 'Variance'}</p>
              <p className={`text-base font-bold truncate ${variance >= 0 ? 'text-green-800' : 'text-red-800'}`}>{formatCurrencyCompact(variance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${a.type === 'overspent' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 ${a.type === 'overspent' ? 'text-red-500' : 'text-amber-500'}`} />
              <span className="text-sm font-medium flex-1">
                {a.type === 'overspent' ? `${a.budget.name} overspent by ${a.pct.toFixed(0)}%` : `${a.budget.name} awaiting your approval`}
              </span>
              <Button size="sm" variant="ghost" onClick={() => openDetail(a.budget)}><Eye className="w-3 h-3 mr-1" />{t('view') || 'View'}</Button>
            </div>
          ))}
        </div>
      )}

      {/* Main card */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--genix-purple)]" />
              <CardTitle className="text-lg">{t('budget_management') || 'Budget Management'}</CardTitle>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder={t('all_types') || 'All Types'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types') || 'All Types'}</SelectItem>
                  <SelectItem value="combined">{t('budget_type_combined') || 'Revenue & Expenses'}</SelectItem>
                  <SelectItem value="cashflow">{t('budget_type_cashflow') || 'Cash Flow'}</SelectItem>
                  <SelectItem value="investment">{t('budget_type_investment') || 'Investment'}</SelectItem>
                  <SelectItem value="expense">{t('budget_type_expense') || 'Expenses Only'}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setView('cashflow')}><Wallet className="w-4 h-4 mr-2" />{t('cash_flow_bdds') || 'Cash Flow (BDDS)'}</Button>
              <Button variant="outline" onClick={() => { setPvaBudgetId(budgets[0]?.id || ''); setView('pvsa'); }}><BarChart3 className="w-4 h-4 mr-2" />{t('plan_vs_actual') || 'Plan vs Actual'}</Button>
              {canCreate(MODULES.FINANCIALS) && (
                <Button onClick={() => initWizard('create')} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                  <Plus className="w-4 h-4 mr-2" />{t('create_budget') || 'Create Budget'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBudgets.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Target className="w-8 h-8 text-slate-400" /></div>
              <h3 className="text-base font-semibold mb-2">{t('no_budgets') || 'No budgets yet'}</h3>
              <p className="text-sm text-slate-500 mb-5">{t('budget_empty_description') || 'Create your first budget.'}</p>
              {canCreate(MODULES.FINANCIALS) && (
                <Button onClick={() => initWizard('create')} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                  <Plus className="w-4 h-4 mr-2" />{t('create_first_budget') || 'Create First Budget'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
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
                  const u = calcUsage(budget);
                  return (
                    <TableRow key={budget.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(budget)}>
                      <TableCell>
                        <p className="font-semibold">{budget.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{budget.code}</p>
                      </TableCell>
                      <TableCell><TypeBadge type={budget.budget_type} t={t} /></TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {budget.start_date && budget.end_date ? `${format(new Date(budget.start_date), 'dd.MM.yy')} – ${format(new Date(budget.end_date), 'dd.MM.yy')}` : '—'}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <UsageBar planned={u.planned} actual={u.actual}
                          type={budget.budget_type === 'revenue' ? 'revenue' : 'expense'}
                          warningThreshold={budget.warning_threshold || 80}
                          formatCurrency={formatCurrency} />
                      </TableCell>
                      <TableCell><StatusBadge status={budget.status} approvalStatus={budget.approval_status} /></TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {budget.status === 'draft' && budget.approval_status !== 'pending' && canUpdate(MODULES.FINANCIALS) && (
                            <Button variant="ghost" size="sm" title={t('activate') || 'Activate'} onClick={() => activateBudget(budget.id)}>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                          {canUpdate(MODULES.FINANCIALS) && (
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBudget(budget); initWizard('edit', budget); }}>
                              <Edit2 className="w-4 h-4 text-slate-500" />
                            </Button>
                          )}
                          {canDelete(MODULES.FINANCIALS) && (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(budget)}>
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

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" />{t('delete_budget') || 'Delete Budget'}</DialogTitle>
            <DialogDescription>{t('confirm_delete_budget') || 'This action cannot be undone.'}</DialogDescription>
          </DialogHeader>
          <div className="py-3 px-4 bg-slate-50 rounded-lg">
            <p className="font-medium">{deleteTarget?.name}</p>
            <p className="text-sm text-slate-500 font-mono">{deleteTarget?.code}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('cancel') || 'Cancel'}</Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              {t('delete') || 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ── WIZARD ─────────────────────────────────────────────────────────────────
  if (view === 'wizard') {
    const totalSteps = 5;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setView('list')}><ArrowLeft className="w-4 h-4 mr-1" />{t('back') || 'Back'}</Button>
          <div>
            <h2 className="text-xl font-bold">{wizardMode === 'edit' ? t('edit_budget') || 'Edit Budget' : t('create_budget') || 'Create Budget'}</h2>
            <p className="text-sm text-slate-500">{t('step') || 'Step'} {wizardStep} {t('of') || 'of'} {totalSteps}</p>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] h-2 rounded-full transition-all" style={{ width: `${(wizardStep / totalSteps) * 100}%` }} />
        </div>

        {/* Step 1: Type */}
        {wizardStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('wizard_step1_title') || 'What are you planning?'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BUDGET_TYPES.map(({ value, icon: Icon, color, recommended }) => (
                <button key={value} onClick={() => setWizardData(d => ({ ...d, budget_type: value }))}
                  className={`relative text-left p-5 rounded-xl border-2 transition-all ${wizardData.budget_type === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  {recommended && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />{t('recommended') || 'Recommended'}
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <p className="font-semibold mb-1">{t(`budget_type_${value}_title`) || value}</p>
                  <p className="text-sm text-slate-500">{t(`budget_type_${value}_desc`) || ''}</p>
                </button>
              ))}
            </div>

            {/* Show account selector when expense or revenue type selected */}
            {(wizardData.budget_type === 'expense' || wizardData.budget_type === 'combined') && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-sm font-medium">
                  {t('default_expense_account') || 'Default Expense Account'}
                  <span className="text-slate-400 font-normal ml-1">({t('optional') || 'optional'})</span>
                </Label>
                <Select
                  value={wizardData.default_expense_account_id || '__none__'}
                  onValueChange={v => setWizardData(d => ({ ...d, default_expense_account_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_expense_account') || 'Select expense account'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-slate-400">{t('no_default_account') || 'No default (select per line)'}</span>
                    </SelectItem>
                    {accounts
                      .filter(a => {
                        const code = String(a.code || '');
                        const name = (a.name || '').toLowerCase();
                        // Expense accounts: typically 5xxx-8xxx range or type=expense
                        return a.account_type === 'expense' || a.type === 'expense' ||
                          name.includes('expense') || name.includes('xarajat') || name.includes('расход') ||
                          (code >= '5000' && code < '9000');
                      })
                      .map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  {t('default_expense_account_hint') || 'This account will be pre-filled for all expense lines. You can still change it per line.'}
                </p>
              </div>
            )}
            {(wizardData.budget_type === 'revenue' || wizardData.budget_type === 'combined') && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-sm font-medium">
                  {t('default_revenue_account') || 'Default Revenue Account'}
                  <span className="text-slate-400 font-normal ml-1">({t('optional') || 'optional'})</span>
                </Label>
                <Select
                  value={wizardData.default_revenue_account_id || '__none__'}
                  onValueChange={v => setWizardData(d => ({ ...d, default_revenue_account_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_revenue_account') || 'Select revenue account'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-slate-400">{t('no_default_account') || 'No default (select per line)'}</span>
                    </SelectItem>
                    {accounts
                      .filter(a => {
                        const code = String(a.code || '');
                        const name = (a.name || '').toLowerCase();
                        return a.account_type === 'revenue' || a.type === 'revenue' ||
                          name.includes('revenue') || name.includes('daromad') || name.includes('доход') ||
                          name.includes('sales') || name.includes('sotish') ||
                          (code >= '4000' && code < '5000');
                      })
                      .map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  {t('default_revenue_account_hint') || 'This account will be pre-filled for all revenue lines.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Approach */}
        {wizardStep === 2 && wizardData.budget_type !== 'cashflow' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('wizard_step2_title') || 'How will you plan numbers?'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {APPROACHES.map(({ value }) => (
                <button key={value} onClick={() => setWizardData(d => ({ ...d, approach: value }))}
                  className={`text-left p-5 rounded-xl border-2 transition-all ${wizardData.approach === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <p className="font-semibold mb-1">{t(`approach_${value}_title`) || value}</p>
                  <p className="text-sm text-slate-500">{t(`approach_${value}_desc`) || ''}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Period */}
        {wizardStep === 3 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold">{t('wizard_step3_title') || 'Period & Details'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('name') || 'Name'} *</Label>
                <Input value={wizardData.name} onChange={e => setWizardData(d => ({ ...d, name: e.target.value }))} placeholder={t('budget_name_placeholder') || 'e.g. Q1 2026 Budget'} />
              </div>
              <div className="space-y-2">
                <Label>{t('code') || 'Code'}</Label>
                <Input value={wizardData.code} readOnly className="bg-slate-50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('period') || 'Period'} *</Label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {[0,1,2,3].map(q => (
                  <Button key={q} variant="outline" size="sm" onClick={() => setQuarter(q)}>Q{q+1}</Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => {
                  const y = new Date().getFullYear();
                  setWizardData(d => ({ ...d, start_date: `${y}-01-01`, end_date: `${y}-12-31` }));
                }}>{t('full_year') || 'Full Year'}</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={wizardData.start_date} onChange={e => setWizardData(d => ({ ...d, start_date: e.target.value }))} />
                <Input type="date" value={wizardData.end_date} onChange={e => setWizardData(d => ({ ...d, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('fiscal_year') || 'Fiscal Year'}</Label>
                <Select value={wizardData.fiscal_year_id} onValueChange={v => setWizardData(d => ({ ...d, fiscal_year_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('select_fiscal_year') || 'Select fiscal year'} /></SelectTrigger>
                  <SelectContent>
                    {fiscalYears.filter(fy => fy.status === 'open').map(fy => (
                      <SelectItem key={fy.id} value={fy.id}>{fy.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('overspend_policy') || 'Overspend Policy'}</Label>
                <Select value={wizardData.overspend_policy} onValueChange={v => setWizardData(d => ({ ...d, overspend_policy: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warn">{t('policy_warn') || 'Warn only'}</SelectItem>
                    <SelectItem value="require_approval">{t('policy_require_approval') || 'Require approval'}</SelectItem>
                    <SelectItem value="block">{t('policy_block') || 'Block transaction'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('description') || 'Description'}</Label>
              <Textarea value={wizardData.description} onChange={e => setWizardData(d => ({ ...d, description: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        {/* Step 4: Budget Lines */}
        {wizardStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('wizard_step4_title') || 'Enter Budget Lines'}</h3>
              <Button variant="outline" size="sm" onClick={addLine}><Plus className="w-4 h-4 mr-1" />{t('add_line') || 'Add Line'}</Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-xs text-green-600">{t('total_revenue') || 'Revenue'}</p>
                <p className="text-base font-bold text-green-800">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-xs text-red-600">{t('total_expenses') || 'Expenses'}</p>
                <p className="text-base font-bold text-red-800">{formatCurrency(totalExpense)}</p>
              </div>
              <div className={`p-3 rounded-lg text-center border ${totalRevenue - totalExpense >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-xs text-blue-600">{t('profit') || 'Profit'}</p>
                <p className="text-base font-bold text-blue-800">{formatCurrency(totalRevenue - totalExpense)}</p>
              </div>
            </div>
            {wizardLines.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-slate-500 mb-3">{t('no_lines_yet') || 'No budget lines yet'}</p>
                <Button variant="outline" size="sm" onClick={addLine}><Plus className="w-4 h-4 mr-1" />{t('add_first_line') || 'Add Line'}</Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {wizardLines.map((line, idx) => (
                  <div key={line._id || line.id || idx} className="border rounded-lg p-3 bg-white space-y-3">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-4">
                        <Label className="text-xs mb-1 block">{t('category') || 'Category'} *</Label>
                        <Select value={line.category_name || ''} onValueChange={v => updateLine(idx, 'category_name', v)}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder={t('select_category') || 'Select category'} /></SelectTrigger>
                          <SelectContent>
                            {BUDGET_CATEGORIES.map(c => (
                              <SelectItem key={c.value} value={c.value}>{getCategoryLabel(c.value)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs mb-1 block">{t('account') || 'Account'}</Label>
                        <AccountCombobox
                          accounts={getFilteredAccounts(line.line_type)}
                          value={line.account_id}
                          onValueChange={v => updateLine(idx, 'account_id', v)}
                          placeholder={t('search_account') || 'Search account...'}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs mb-1 block">{t('type') || 'Type'}</Label>
                        <Select value={line.line_type} onValueChange={v => updateLine(idx, 'line_type', v)}>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="revenue">{t('revenue') || 'Revenue'}</SelectItem>
                            <SelectItem value="expense">{t('expense') || 'Expense'}</SelectItem>
                            <SelectItem value="investment">{t('investment') || 'Investment'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 pt-5 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                      </div>
                    </div>
                    {wizardData.approach === 'fixed' && wizardData.breakdown === 'monthly' ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-500">{t('monthly_breakdown') || 'Monthly'}</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => fillPeriods(idx, parseFloat(line.period_1 || 0))}>
                            {t('copy_jan_to_all') || 'Copy Jan → All'}
                          </Button>
                        </div>
                        <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
                          {MONTHS.map((m, n) => (
                            <div key={n}>
                              <p className="text-[10px] text-slate-400 text-center">{m}</p>
                              <Input type="number" className="text-xs px-1 py-1 h-7"
                                value={line[`period_${n+1}`] || ''}
                                onChange={e => updateLine(idx, `period_${n+1}`, parseFloat(e.target.value) || 0)} />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 text-right">{t('total') || 'Total'}: <strong>{formatCurrency(parseFloat(line.budgeted_amount || 0))}</strong></p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Label className="text-xs w-20">{t('total_amount') || 'Total'}</Label>
                        <Input type="number" className="w-40 text-sm" value={line.budgeted_amount || ''}
                          onChange={e => updateLine(idx, 'budgeted_amount', parseFloat(e.target.value) || 0)} />
                      </div>
                    )}
                    {wizardData.approach === 'zero_based' && (
                      <div>
                        <Label className="text-xs mb-1 block">{t('justification') || 'Justification'} *</Label>
                        <Input value={line.justification || ''} className="text-sm"
                          placeholder={t('justification_placeholder') || 'Explain this expense...'}
                          onChange={e => updateLine(idx, 'justification', e.target.value)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {wizardStep === 5 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold">{t('wizard_step5_title') || 'Review & Confirm'}</h3>
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl text-sm">
              {[
                [t('name') || 'Name', wizardData.name],
                [t('code') || 'Code', wizardData.code],
                [t('type') || 'Type', wizardData.budget_type],
                [t('approach') || 'Approach', wizardData.approach],
                [t('period') || 'Period', wizardData.start_date && wizardData.end_date ? `${wizardData.start_date} – ${wizardData.end_date}` : '—'],
                [t('overspend_policy') || 'Policy', wizardData.overspend_policy],
              ].map(([k, v]) => (
                <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-xs text-green-600">{t('total_revenue') || 'Revenue'}</p>
                <p className="font-bold text-green-800">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-green-600">{wizardLines.filter(l=>l.line_type==='revenue').length} lines</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-xs text-red-600">{t('total_expenses') || 'Expenses'}</p>
                <p className="font-bold text-red-800">{formatCurrency(totalExpense)}</p>
                <p className="text-xs text-red-600">{wizardLines.filter(l=>l.line_type!=='revenue').length} lines</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-xs text-blue-600">{t('planned_profit') || 'Profit'}</p>
                <p className="font-bold text-blue-800">{formatCurrency(totalRevenue - totalExpense)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" disabled={wizardStep === 1} onClick={() => setWizardStep(s => Math.max(1, s-1))}>
            <ChevronLeft className="w-4 h-4 mr-1" />{t('back') || 'Back'}
          </Button>
          <div className="flex gap-2">
            {wizardStep < totalSteps ? (
              <Button className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={wizardStep === 3 && !wizardData.name}
                onClick={() => {
                  if (wizardStep === 1 && wizardData.budget_type === 'cashflow') setWizardStep(3);
                  else setWizardStep(s => Math.min(totalSteps, s+1));
                }}>
                {t('next') || 'Next'}<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <>
                {(totalRevenue + totalExpense) <= 0 && (
                  <p className="text-sm text-red-500 mr-2 self-center">{t('budget_amount_required')}</p>
                )}
                <Button variant="outline" onClick={() => saveWizard('draft')} disabled={isSaving || (totalRevenue + totalExpense) <= 0}>
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  {t('save_as_draft') || 'Save as Draft'}
                </Button>
                <Button className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  onClick={() => saveWizard('active')} disabled={isSaving || (totalRevenue + totalExpense) <= 0}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  {t('save_and_activate') || 'Save & Activate'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL ─────────────────────────────────────────────────────────────────
  if (view === 'detail' && selectedBudget) {
    const lines = getBudgetLines(selectedBudget.id);
    const revLines = lines.filter(l => l.line_type === 'revenue');
    const expLines = lines.filter(l => l.line_type !== 'revenue');
    const revPlanned = revLines.reduce((s,l) => s + (l.budgeted_amount || l.planned_amount || 0), 0);
    const revActual = revLines.reduce((s,l) => s + (l.actual_amount || 0), 0);
    const expPlanned = expLines.reduce((s,l) => s + (l.budgeted_amount || l.planned_amount || 0), 0);
    const expActual = expLines.reduce((s,l) => s + (l.actual_amount || 0), 0);

    const renderLineTable = (lineArr, lineType) => (
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>{t('category') || 'Category'}</TableHead>
            <TableHead className="text-right">{t('planned') || 'Planned'}</TableHead>
            <TableHead className="text-right">{t('actual') || 'Actual'}</TableHead>
            <TableHead className="text-right">{t('remaining') || 'Remaining'}</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineArr.map(line => {
            const planned = line.budgeted_amount || line.planned_amount || 0;
            const actual = line.actual_amount || 0;
            const remaining = planned - actual;
            const pct = planned > 0 ? (actual / planned) * 100 : 0;
            const color = getStatusColor(pct, lineType);
            const badgeCls = color === 'green' ? 'bg-green-100 text-green-700' : color === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
            return (
              <TableRow key={line.id} className={pct > 100 && lineType !== 'revenue' ? 'bg-red-50' : ''}>
                <TableCell className="font-medium">
                  {line.category_name || line.account_name || line.account_code}
                  {pct > 100 && lineType !== 'revenue' && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(planned)}</TableCell>
                <TableCell className="text-right">{formatCurrency(actual)}</TableCell>
                <TableCell className={`text-right font-medium ${remaining < 0 ? 'text-red-600' : 'text-slate-600'}`}>{formatCurrency(remaining)}</TableCell>
                <TableCell className="text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>{pct.toFixed(0)}%</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setView('list')}><ArrowLeft className="w-4 h-4 mr-1" />{t('back') || 'Back'}</Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{selectedBudget.name}</h2>
                <StatusBadge status={selectedBudget.status} approvalStatus={selectedBudget.approval_status} />
              </div>
              <p className="text-sm text-slate-500 font-mono">{selectedBudget.code}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedBudget.status === 'draft' && selectedBudget.approval_status !== 'pending' && canUpdate(MODULES.FINANCIALS) && (
              <>
                <Button variant="outline" size="sm" onClick={async () => { try { await financeService.submitBudgetForApproval(selectedBudget.id); setView('list'); } catch(e) {} }}>
                  <Send className="w-4 h-4 mr-1" />{t('send_for_approval') || 'Send for Approval'}
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => activateBudget(selectedBudget.id).then(() => setView('list')).catch(()=>{})}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />{t('activate') || 'Activate'}
                </Button>
              </>
            )}
            {selectedBudget.approval_status === 'pending' && canUpdate(MODULES.FINANCIALS) && (
              <>
                <Button variant="outline" size="sm" className="border-red-300 text-red-600"
                  onClick={async () => { await financeService.rejectBudget(selectedBudget.id, ''); setView('list'); }}>
                  <ThumbsDown className="w-4 h-4 mr-1" />{t('reject') || 'Reject'}
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={async () => { await financeService.approveBudget(selectedBudget.id); setView('list'); }}>
                  <ThumbsUp className="w-4 h-4 mr-1" />{t('approve') || 'Approve'}
                </Button>
              </>
            )}
            {canUpdate(MODULES.FINANCIALS) && (
              <Button variant="outline" size="sm" onClick={() => initWizard('edit', selectedBudget)}>
                <Edit2 className="w-4 h-4 mr-1" />{t('edit') || 'Edit'}
              </Button>
            )}
          </div>
        </div>

        <Tabs value={detailTab} onValueChange={setDetailTab}>
          <TabsList>
            <TabsTrigger value="overview"><LayoutDashboard className="w-4 h-4 mr-1" />{t('overview') || 'Overview'}</TabsTrigger>
            <TabsTrigger value="calendar"><Calendar className="w-4 h-4 mr-1" />{t('calendar') || 'Calendar'}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {revLines.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" />{t('revenue') || 'Revenue'}</CardTitle>
                    <span className="text-sm text-green-600 font-medium">{formatCurrency(revActual)} / {formatCurrency(revPlanned)}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">{renderLineTable(revLines, 'revenue')}</CardContent>
              </Card>
            )}
            {expLines.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" />{t('expenses') || 'Expenses'}</CardTitle>
                    <span className="text-sm text-red-600 font-medium">{formatCurrency(expActual)} / {formatCurrency(expPlanned)}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">{renderLineTable(expLines, 'expense')}</CardContent>
              </Card>
            )}
            {lines.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p>{t('no_budget_lines') || 'No budget lines. Edit budget to add lines.'}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                  {MONTHS.map((m, idx) => {
                    const monthTotal = lines.reduce((s, l) => s + parseFloat(l[`period_${idx+1}`] || 0), 0);
                    return (
                      <div key={m} className="text-center border rounded-lg p-2">
                        <p className="text-xs text-slate-500 font-medium">{m}</p>
                        <p className="text-xs font-semibold mt-1 truncate">{monthTotal > 0 ? formatCurrency(monthTotal) : '—'}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ── CASH FLOW ───────────────────────────────────────────────────────────────
  if (view === 'cashflow') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => setView('list')}><ArrowLeft className="w-4 h-4 mr-1" />{t('back') || 'Back'}</Button>
        <div>
          <h2 className="text-xl font-bold">{t('cash_flow_bdds') || 'Cash Flow (BDDS)'}</h2>
          <p className="text-sm text-slate-500">{t('cash_flow_desc') || 'Real-time cash position and 30-day forecast'}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={loadCashFlow}>
          <RefreshCw className={`w-4 h-4 mr-1 ${cashFlowLoading ? 'animate-spin' : ''}`} />{t('refresh') || 'Refresh'}
        </Button>
      </div>

      {cashFlowLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-[var(--genix-blue)]" /></div>
      ) : cashFlowData ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={cashFlowData.summary?.current_balance < 0 ? 'border-red-300 bg-red-50' : 'border-green-200 bg-green-50'}>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">{t('current_balance') || 'Current Balance'}</p>
                <p className={`text-xl font-bold ${cashFlowData.summary?.current_balance < 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(cashFlowData.summary?.current_balance || 0)}</p>
                {cashFlowData.summary?.has_negative_accounts && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t('has_negative_accounts') || 'Some accounts negative'}</p>}
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">{t('expected_inflows') || 'Expected Inflows'}</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(cashFlowData.summary?.expected_inflows || 0)}</p>
                <p className="text-xs text-slate-500 mt-1">{cashFlowData.receivables?.length || 0} {t('invoices') || 'invoices'}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">{t('expected_outflows') || 'Expected Outflows'}</p>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(cashFlowData.summary?.expected_outflows || 0)}</p>
                <p className="text-xs text-slate-500 mt-1">{cashFlowData.payables?.length || 0} {t('bills') || 'bills'}</p>
              </CardContent>
            </Card>
            <Card className={(cashFlowData.summary?.forecast_30d || 0) < 0 ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-emerald-50'}>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">{t('forecast_30d') || '30-Day Forecast'}</p>
                <p className={`text-xl font-bold ${(cashFlowData.summary?.forecast_30d || 0) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCurrency(cashFlowData.summary?.forecast_30d || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2"><ArrowDownRight className="w-4 h-4 text-green-500" />{t('who_owes_us') || 'Who Owes Us'}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {!(cashFlowData.receivables?.length) ? (
                  <p className="text-sm text-slate-500 py-4 text-center">{t('no_receivables') || 'No outstanding receivables'}</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cashFlowData.receivables.map((r, i) => (
                      <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${r.urgency === 'overdue' ? 'bg-red-50 border border-red-200' : r.urgency === 'due_soon' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.counterparty}</p>
                          <p className="text-xs text-slate-500">{r.reference} · {r.due_date}</p>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <p className="font-semibold text-sm">{formatCurrency(r.amount)}</p>
                          {r.urgency === 'overdue' && <Badge className="bg-red-100 text-red-700 text-[10px]">OVERDUE</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-red-500" />{t('who_we_owe') || 'Who We Owe'}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {!(cashFlowData.payables?.length) ? (
                  <p className="text-sm text-slate-500 py-4 text-center">{t('no_payables') || 'No outstanding payables'}</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cashFlowData.payables.map((p, i) => (
                      <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${p.urgency === 'overdue' ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.counterparty}</p>
                          <p className="text-xs text-slate-500">{p.reference} · {p.due_date}</p>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <p className="font-semibold text-sm">{formatCurrency(p.amount)}</p>
                          {p.can_postpone && <Badge className="bg-slate-100 text-slate-600 text-[10px]">Can postpone</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />{t('payment_calendar') || 'Payment Calendar — Next 30 Days'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead className="text-right text-green-600">{t('inflows') || 'Inflows'}</TableHead>
                    <TableHead className="text-right text-red-600">{t('outflows') || 'Outflows'}</TableHead>
                    <TableHead className="text-right">{t('running_balance') || 'Balance'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cashFlowData.calendar || []).filter(d => d.inflows > 0 || d.outflows > 0 || d.is_negative).map((day, i) => (
                    <TableRow key={i} className={day.is_negative ? 'bg-red-50' : ''}>
                      <TableCell className="font-mono text-sm">{day.date}</TableCell>
                      <TableCell className="text-right text-green-700 font-medium">{day.inflows > 0 ? formatCurrency(day.inflows) : '—'}</TableCell>
                      <TableCell className="text-right text-red-700 font-medium">{day.outflows > 0 ? formatCurrency(day.outflows) : '—'}</TableCell>
                      <TableCell className={`text-right font-bold ${day.is_negative ? 'text-red-700' : 'text-slate-800'}`}>{formatCurrency(day.running_balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <Info className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p>{t('no_cashflow_data') || 'No cash flow data. Make sure you have invoices and vendor bills.'}</p>
        </div>
      )}
    </div>
  );

  // ── PLAN VS ACTUAL ───────────────────────────────────────────────────────────
  if (view === 'pvsa') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" onClick={() => setView('list')}><ArrowLeft className="w-4 h-4 mr-1" />{t('back') || 'Back'}</Button>
        <h2 className="text-xl font-bold">{t('plan_vs_actual') || 'Plan vs Actual'}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={pvaBudgetId} onValueChange={id => { setPvaBudgetId(id); loadPva(id); }}>
            <SelectTrigger className="w-64"><SelectValue placeholder={t('select_budget') || 'Select budget'} /></SelectTrigger>
            <SelectContent>{budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => pvaBudgetId && loadPva(pvaBudgetId)}>
            <RefreshCw className={`w-4 h-4 ${pvaLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {pvaLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-[var(--genix-blue)]" /></div>
      ) : pvaData ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              [t('planned_revenue') || 'Planned Revenue', pvaData.totals?.planned_revenue, 'text-green-700'],
              [t('actual_revenue') || 'Actual Revenue', pvaData.totals?.actual_revenue, 'text-emerald-700'],
              [t('planned_expenses') || 'Planned Expenses', pvaData.totals?.planned_expense, 'text-red-700'],
              [t('actual_expenses') || 'Actual Expenses', pvaData.totals?.actual_expense, 'text-orange-700'],
            ].map(([label, value, cls]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-xl font-bold ${cls}`}>{formatCurrency(value || 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-0 p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('category') || 'Category'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead className="text-right">{t('planned') || 'Planned'}</TableHead>
                    <TableHead className="text-right">{t('actual') || 'Actual'}</TableHead>
                    <TableHead className="text-right">{t('variance') || 'Variance'}</TableHead>
                    <TableHead className="text-right">{t('variance_pct') || 'Var%'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pvaData.items || []).map((item, i) => (
                    <TableRow key={i} className={item.status === 'overspent' ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{item.category || item.account_name}</TableCell>
                      <TableCell>
                        <Badge className={item.line_type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{item.line_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.planned)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.actual)}</TableCell>
                      <TableCell className={`text-right font-medium ${item.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                      </TableCell>
                      <TableCell className={`text-right text-sm ${item.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.variance_pct?.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          item.status === 'ok' ? 'bg-green-100 text-green-700' :
                          item.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                          item.status === 'overspent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        }>{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p>{t('select_budget_for_pva') || 'Select a budget above to see plan vs actual comparison.'}</p>
        </div>
      )}
    </div>
  );

  return null;
}
