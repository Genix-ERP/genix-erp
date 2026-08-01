import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Receipt, Download, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { financeService } from '@/api/services/finance';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { STATUS_META, EXPENSE_STATUSES, categoryColor } from '@/components/expenses/constants';
import ExpenseStatsCards from '@/components/expenses/ExpenseStatsCards';
import ExpenseCharts from '@/components/expenses/ExpenseCharts';
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal';
import ExpenseDetailSheet from '@/components/expenses/ExpenseDetailSheet';
import PayExpenseDialog from '@/components/expenses/PayExpenseDialog';

// Date-range presets driving stats + charts + table together.
const RANGES = ['this_month', 'last_month', 'quarter', 'year', 'all'];

function rangeToDates(key) {
  const now = new Date();
  const iso = (d) => d.toISOString().split('T')[0];
  const startOfMonth = (y, m) => new Date(y, m, 1);
  switch (key) {
    case 'this_month':
      return { date_from: iso(startOfMonth(now.getFullYear(), now.getMonth())), date_to: iso(now) };
    case 'last_month': {
      const from = startOfMonth(now.getFullYear(), now.getMonth() - 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { date_from: iso(from), date_to: iso(to) };
    }
    case 'quarter': {
      const qStart = startOfMonth(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3);
      return { date_from: iso(qStart), date_to: iso(now) };
    }
    case 'year':
      return { date_from: iso(new Date(now.getFullYear(), 0, 1)), date_to: iso(now) };
    default:
      return {};
  }
}

export default function Expenses() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { employees } = useModules();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  // Module gating: the route is the `expenses` module, but finance staff
  // (FINANCIALS) traditionally manage this page too — accept either.
  const mayCreate = canCreate(MODULES.EXPENSES) || canCreate(MODULES.FINANCIALS);
  const mayEdit = canUpdate(MODULES.EXPENSES) || canUpdate(MODULES.FINANCIALS);
  const mayDelete = canDelete(MODULES.EXPENSES) || canDelete(MODULES.FINANCIALS);
  // Approve/reject/pay are finance actions (backend: finance:expense:approve,
  // granted through can_update on the finance/expenses module).
  const mayApprove = canUpdate(MODULES.FINANCIALS) || canUpdate(MODULES.EXPENSES);

  const [rangeKey, setRangeKey] = useState('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const [expenses, setExpenses] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [selected, setSelected] = useState(null); // detail sheet
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [paying, setPaying] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [checkedIds, setCheckedIds] = useState(() => new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const rangeDates = useMemo(() => rangeToDates(rangeKey), [rangeKey]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await financeService.getExpenseStats(rangeDates));
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [rangeDates]);

  const loadExpenses = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { limit: 500, ...rangeDates };
      if (debouncedSearch) params.q = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category_id = categoryFilter;
      if (employeeFilter !== 'all') params.employee_id = employeeFilter;
      const rows = await financeService.listExpenses(params);
      setExpenses(Array.isArray(rows) ? rows : rows?.items || []);
    } catch {
      setExpenses([]);
    } finally {
      setListLoading(false);
    }
  }, [rangeDates, debouncedSearch, statusFilter, categoryFilter, employeeFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  useEffect(() => {
    let cancelled = false;
    financeService.listExpenseCategories()
      .then((rows) => { if (!cancelled) setCategories(Array.isArray(rows) ? rows : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const refreshAll = useCallback(async (updatedRecord) => {
    if (updatedRecord) {
      setExpenses((prev) => prev.map((e) => (e.id === updatedRecord.id ? updatedRecord : e)));
      setSelected((prev) => (prev && prev.id === updatedRecord.id ? updatedRecord : prev));
    }
    await Promise.all([loadStats(), loadExpenses()]);
  }, [loadStats, loadExpenses]);

  const apiError = (err) =>
    err?.response?.data?.error?.message || err?.response?.data?.message || t('exp_error_generic');

  // ── Lifecycle actions (shared by table buttons and the detail sheet) ──
  const runAction = async (name, expense, payload) => {
    if (name === 'edit') { setEditing(expense); setFormOpen(true); return; }
    if (name === 'delete') { setDeleteTarget(expense); return; }
    if (name === 'pay') { setPayTarget(expense); return; }

    setBusyAction(name);
    try {
      let updated;
      if (name === 'submit') updated = await financeService.submitExpense(expense.id);
      else if (name === 'approve') updated = await financeService.approveExpense(expense.id);
      else if (name === 'reject') updated = await financeService.rejectExpense(expense.id, payload);
      else if (name === 'recognize') updated = await financeService.recognizeExpense(expense.id, payload);
      await refreshAll(updated);
      toast.success(t(`exp_toast_${name}`));
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing?.id) {
        const updated = await financeService.updateExpense(editing.id, payload);
        await refreshAll(updated);
        toast.success(t('exp_toast_saved'));
      } else {
        await financeService.createExpense(payload);
        await refreshAll();
        toast.success(payload.status === 'draft' ? t('exp_toast_draft') : t('exp_toast_submit'));
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (payload) => {
    if (!payTarget) return;
    setPaying(true);
    try {
      const updated = await financeService.payExpense(payTarget.id, payload);
      await refreshAll(updated);
      toast.success(t('exp_toast_pay'));
      setPayTarget(null);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await financeService.deleteExpense(deleteTarget.id);
      setSelected((prev) => (prev && prev.id === deleteTarget.id ? null : prev));
      await refreshAll();
      toast.success(t('exp_toast_deleted'));
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Bulk approve (managers) ──
  const submittedIds = useMemo(
    () => new Set(expenses.filter((e) => e.status === 'submitted').map((e) => e.id)),
    [expenses]
  );
  const toggleChecked = (id) => setCheckedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const bulkApprove = async () => {
    const ids = [...checkedIds].filter((id) => submittedIds.has(id));
    if (!ids.length) return;
    setBusyAction('bulk');
    let ok = 0;
    for (const id of ids) {
      try { await financeService.approveExpense(id); ok += 1; } catch { /* per-row failure reported below */ }
    }
    setCheckedIds(new Set());
    await refreshAll();
    setBusyAction(null);
    if (ok > 0) toast.success(`${ok} ${t('exp_toast_bulk_approved')}`);
    if (ok < ids.length) toast.error(`${ids.length - ok} ${t('exp_toast_bulk_failed')}`);
  };

  // ── Export ──
  const handleExport = () => {
    const rows = expenses.map((e) => ({
      [t('exp_col_number')]: e.expense_number,
      [t('exp_col_date')]: e.date ? format(new Date(e.date), 'dd.MM.yyyy') : '',
      [t('employee')]: e.employee_name || '',
      [t('category')]: e.category || '',
      [t('exp_description')]: e.description || '',
      [t('exp_amount')]: e.total_amount ?? e.amount ?? 0,
      [t('exp_currency')]: e.currency || 'UZS',
      [t('status')]: t(STATUS_META[e.status]?.tKey || e.status),
      [t('exp_recognized_label')]: e.is_recognized !== false ? t('yes') : t('no'),
      [t('exp_paid_date')]: e.paid_at ? format(new Date(e.paid_at), 'dd.MM.yyyy') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 15 }, { wch: 11 }, { wch: 22 }, { wch: 16 }, { wch: 36 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('expenses'));
    XLSX.writeFile(wb, `xarajatlar_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const hasFilters = debouncedSearch || statusFilter !== 'all' || categoryFilter !== 'all' || employeeFilter !== 'all';
  const showBulkBar = mayApprove && checkedIds.size > 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('expenses')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('exp_page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!expenses.length}>
            <Download className="w-4 h-4 mr-2" />
            {t('export')}
          </Button>
          {mayCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('exp_add_button')}
            </Button>
          )}
        </div>
      </div>

      {/* Date-range pills — drive stats, charts and table together */}
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((key) => (
          <button
            key={key}
            onClick={() => setRangeKey(key)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              rangeKey === key
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t(`exp_range_${key}`)}
          </button>
        ))}
      </div>

      <ExpenseStatsCards stats={stats} loading={statsLoading} formatCompact={formatCurrencyCompact} t={t} />

      <ExpenseCharts stats={stats} loading={statsLoading} formatCompact={formatCurrencyCompact} t={t} language={language} />

      {/* Table card */}
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder={t('exp_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status')}</SelectItem>
                  {EXPENSE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(STATUS_META[s].tKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('exp_all_categories')}</SelectItem>
                  {categories.map((c, i) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: categoryColor(c, i) }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('exp_all_employees')}</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {`${e.first_name || ''} ${e.last_name || ''}`.trim() || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showBulkBar && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
              <span className="text-sm text-emerald-700">
                {checkedIds.size} {t('exp_selected_count')}
              </span>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={bulkApprove} disabled={busyAction === 'bulk'}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {t('exp_bulk_approve')}
              </Button>
            </div>
          )}
        </div>

        {listLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Receipt className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium">
              {hasFilters ? t('exp_empty_filtered') : t('exp_empty_title')}
            </p>
            {!hasFilters && (
              <>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">{t('exp_empty_hint')}</p>
                {mayCreate && (
                  <Button className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('exp_add_button')}
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {mayApprove && <TableHead className="w-10" />}
                  <TableHead>{t('exp_col_number')}</TableHead>
                  <TableHead>{t('exp_col_date')}</TableHead>
                  <TableHead>{t('employee')}</TableHead>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead className="max-w-[260px]">{t('exp_description')}</TableHead>
                  <TableHead className="text-right">{t('exp_amount')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => {
                  const meta = STATUS_META[e.status] || STATUS_META.draft;
                  return (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => setSelected(e)}
                    >
                      {mayApprove && (
                        <TableCell onClick={(ev) => ev.stopPropagation()} className="w-10">
                          {e.status === 'submitted' && (
                            <Checkbox
                              checked={checkedIds.has(e.id)}
                              onCheckedChange={() => toggleChecked(e.id)}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">{e.expense_number}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {e.date ? format(new Date(e.date), 'dd.MM.yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.employee_name || <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell>
                        {e.category ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: e.category_color || '#94a3b8' }}
                            />
                            {e.category}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <p className="truncate text-sm text-slate-600" title={e.description}>{e.description}</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {formatCurrency(e.total_amount ?? e.amount ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.className}>{t(meta.tKey)}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail side panel */}
      {selected && (
        <ExpenseDetailSheet
          expense={selected}
          onClose={() => setSelected(null)}
          onAction={runAction}
          busyAction={busyAction}
          permissions={{ canEditRecord: mayEdit || mayCreate, canApprove: mayApprove, canDelete: mayDelete }}
          formatCurrency={formatCurrency}
          t={t}
        />
      )}

      <ExpenseFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={handleSave}
        expense={editing}
        employees={employees}
        categories={categories}
        categoriesLoading={categoriesLoading}
        saving={saving}
        t={t}
      />

      <PayExpenseDialog
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onPay={handlePay}
        expense={payTarget}
        paying={paying}
        formatCurrency={formatCurrency}
        t={t}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('exp_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('exp_delete_confirm')} {deleteTarget?.expense_number}. {t('action_cannot_undone')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
