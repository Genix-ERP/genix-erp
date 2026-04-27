// ExpensesSettings — manages the dynamic list of expense categories and
// the chart-of-account each one posts to. Unlike the other admin-settings
// tabs (which write JSON keys into tenant_settings via AdminSettingsContext),
// this one operates directly on the `expense_categories` table through
// dedicated REST endpoints, because categories are a relational entity:
// each row can be referenced from `expenses.category_id`, and deleting a
// category that's still in use must be blocked server-side.
//
// Layout — single full-width card with a "+ Add" button on top, a table
// below, and inline edit / delete controls on each row. The "Add" /
// "Edit" form lives in a small Dialog that fetches `accounts` once on
// open so the dropdown shows the tenant's full chart of accounts.

import React, { useEffect, useMemo, useState } from 'react';
import { financeService } from '@/api/services/finance';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { formatApiError } from '@/utils/apiErrors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Plus,
  Receipt,
  Edit2,
  Trash2,
  Loader2,
  Info,
  AlertCircle,
} from 'lucide-react';

// Sentinel value used in the Account <Select> for "no account assigned".
// shadcn's <SelectItem> rejects an empty string, so we use a distinct
// token and translate it back to null when shaping the API payload.
const NO_ACCOUNT_VALUE = '__none__';

export default function ExpensesSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create, object = edit
  const [form, setForm] = useState({ name: '', description: '', account_id: NO_ACCOUNT_VALUE });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const accountOptions = useMemo(
    () =>
      accounts
        .slice()
        .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''))),
    [accounts],
  );

  const loadCategories = async () => {
    try {
      const rows = await financeService.listExpenseCategories();
      setCategories(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Failed to load categories'));
    }
  };

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const rows = await financeService.listAccounts({ limit: 500 });
      // The accounts endpoint paginates; some shapes wrap in { items: [...] }.
      const list = Array.isArray(rows) ? rows : Array.isArray(rows?.items) ? rows.items : [];
      setAccounts(list);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Failed to load accounts'));
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadCategories(), loadAccounts()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', account_id: NO_ACCOUNT_VALUE });
    setFormOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name || '',
      description: cat.description || '',
      account_id: cat.account_id || NO_ACCOUNT_VALUE,
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    const name = (form.name || '').trim();
    if (!name) {
      toast.error(t('expense_category_name_required') || 'Name is required');
      return;
    }
    const payload = {
      name,
      description: form.description || null,
      account_id: form.account_id === NO_ACCOUNT_VALUE ? null : form.account_id,
    };
    setSaving(true);
    try {
      if (editing) {
        const updated = await financeService.updateExpenseCategory(editing.id, payload);
        setCategories((prev) => prev.map((c) => (c.id === editing.id ? updated : c)));
        toast.success(t('expense_category_updated') || 'Category updated');
      } else {
        const created = await financeService.createExpenseCategory(payload);
        setCategories((prev) => [...prev, created].sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''))));
        toast.success(t('expense_category_created') || 'Category created');
      }
      setFormOpen(false);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Failed to save category'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await financeService.deleteExpenseCategory(deleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(t('expense_category_deleted') || 'Category deleted');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(formatApiError(e, t, 'Failed to delete category'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header card — title + "+ Add" button. Mirrors the visual rhythm
         of the other admin-settings sections (icon left, action right). */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t('expense_categories') || 'Expense categories'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('expense_categories_desc')
                  || 'Create the categories employees pick when they submit a claim, and choose the chart-of-account each one posts to.'}
              </p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('add_category') || 'Add category'}
          </Button>
        </div>

        {/* Empty / loading / table */}
        <div className="mt-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t('loading') || 'Loading…'}
            </div>
          ) : categories.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-lg py-10 text-center">
              <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">
                {t('no_categories_yet') || 'No categories yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {t('no_categories_hint')
                  || 'Press "Add category" to create your first one.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="text-left font-semibold py-2.5 pr-4">
                      {t('name') || 'Name'}
                    </th>
                    <th className="text-left font-semibold py-2.5 pr-4">
                      {t('chart_account') || 'Chart account'}
                    </th>
                    <th className="text-left font-semibold py-2.5 pr-4">
                      {t('description') || 'Description'}
                    </th>
                    <th className="text-right font-semibold py-2.5 pr-4">
                      {t('usage') || 'Usage'}
                    </th>
                    <th className="text-right font-semibold py-2.5">{''}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr
                      key={cat.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {cat.name}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {cat.code}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">
                        {cat.account_code ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs">
                              {cat.account_code}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {cat.account_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">
                            {t('no_account_assigned') || 'No account'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 max-w-[260px]">
                        {cat.description || (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-700 font-mono">
                        {cat.usage_count || 0}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(cat)}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(cat)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create / edit dialog. Single form keyed off `editing` — null
         means create, populated means edit. Account dropdown sources the
         live `accounts` list so users post to the right GL line. */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('edit_expense_category') || 'Edit category'
                : t('add_category') || 'Add category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600">
                {t('name') || 'Name'} *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('category_name_placeholder') || 'e.g. Travel'}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                {t('chart_account') || 'Chart account'}
              </label>
              <Select
                value={form.account_id}
                onValueChange={(v) => setForm((f) => ({ ...f, account_id: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={
                      accountsLoading
                        ? t('loading') || 'Loading…'
                        : t('select_account') || 'Select account'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT_VALUE}>
                    {t('no_account_assigned') || 'No account'}
                  </SelectItem>
                  {accountOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono text-xs mr-2">{a.code}</span>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10.5px] text-slate-500 mt-1">
                {t('chart_account_hint')
                  || 'Expenses in this category will post to the chosen GL account when approved.'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                {t('description') || 'Description'}
              </label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={submitForm}
              disabled={saving}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? t('save') || 'Save' : t('create') || 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm — `usage_count > 0` already disables the request
         server-side, but we still warn here so the user has a chance to
         cancel before the server returns the friendlier 400. */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              {t('delete_expense_category') || 'Delete category?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.usage_count > 0
                ? (t('category_in_use_warning')
                    || 'This category is used by {count} expense(s). Reassign them before deleting.')
                    .replace('{count}', String(deleteTarget?.usage_count || 0))
                : t('delete_category_confirm')
                    || 'This category will be permanently removed. Continue?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('cancel') || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting || (deleteTarget?.usage_count || 0) > 0}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
