import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import financeService from '@/api/services/finance';

/**
 * «Xarajat kategoriyalari» tab — the Odoo "Expense Categories" idea: each
 * category names the GL account its expenses post from, so choosing a
 * category on an expense decides the accounting without the person entering
 * the expense ever seeing a chart of accounts. The backend has carried
 * account_id on expense_categories since migration 012 and PayExpense
 * already posts through it — this screen is the missing way to SET it.
 */
export default function ExpenseCategoriesTab({ t, canManage, onChanged }) {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', account_id: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await financeService.listExpenseCategories();
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {
      console.error('Failed to load expense categories:', e);
      toast.error(t('loading_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    financeService.listAccounts({ limit: 500 })
      .then((a) => setAccounts(Array.isArray(a) ? a : []))
      .catch(() => setAccounts([]));
  }, []);

  // The picker offers expense-type leaf accounts (9xxx in the UzNAS chart) —
  // posting to a group account is refused by the server, and a cash or AR
  // account here would be a mis-configuration. The currently linked account
  // stays listed even if it falls outside the filter, so editing an old
  // category never silently drops its account.
  const accountOptions = useMemo(() => {
    const leaves = accounts.filter((a) => a.is_leaf !== false);
    let expense = leaves.filter(
      (a) => (a.internal_type || '').includes('expense')
        || (a.type || '') === 'expense'
        || String(a.code || '').startsWith('9'),
    );
    if (expense.length === 0) expense = leaves;
    if (form.account_id && !expense.some((a) => a.id === form.account_id)) {
      const current = accounts.find((a) => a.id === form.account_id);
      if (current) expense = [current, ...expense];
    }
    return expense;
  }, [accounts, form.account_id]);

  const accountLabel = useCallback((id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} · ${a.name_uz || a.name}` : '—';
  }, [accounts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', account_id: '', description: '' });
    setFormOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name || '',
      account_id: cat.account_id || '',
      description: cat.description || '',
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t('exp_cat_name_required'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        account_id: form.account_id || null,
      };
      if (editing) await financeService.updateExpenseCategory(editing.id, payload);
      else await financeService.createExpenseCategory(payload);
      toast.success(t('exp_cat_saved'));
      setFormOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || t('exp_cat_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await financeService.deleteExpenseCategory(deleting.id);
      toast.success(t('exp_cat_deleted'));
      setDeleting(null);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || t('exp_cat_delete_failed'));
      setDeleting(null);
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">{t('exp_categories_title')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t('exp_categories_subtitle')}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t('exp_cat_add')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400 text-sm">{t('loading')}</div>
      ) : categories.length === 0 ? (
        <div className="p-10 text-center text-slate-400">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('exp_cat_empty')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('exp_cat_account')}</TableHead>
              <TableHead>{t('description')}</TableHead>
              {canManage && <TableHead className="w-24 text-right">{t('actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium text-slate-900">{cat.name}</TableCell>
                <TableCell className="text-slate-600 tabular-nums">
                  {cat.account_id ? accountLabel(cat.account_id) : (
                    <span className="text-slate-400">{t('exp_cat_no_account')}</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-500 max-w-[320px] truncate">{cat.description || '—'}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600"
                        onClick={() => setDeleting(cat)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('exp_cat_edit') : t('exp_cat_add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('name')} *</Label>
              <Input value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('exp_cat_name_placeholder')} />
            </div>
            <div>
              <Label>{t('exp_cat_account')}</Label>
              <Select value={form.account_id || 'none'}
                onValueChange={(v) => setForm((p) => ({ ...p, account_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">{t('exp_cat_no_account')}</SelectItem>
                  {accountOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} · {a.name_uz || a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">{t('exp_cat_account_hint')}</p>
            </div>
            <div>
              <Label>{t('description')}</Label>
              <Textarea rows={2} value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t('cancel')}</Button>
            <Button onClick={save} disabled={saving}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('exp_cat_delete')}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            {t('exp_cat_delete_confirm').replace('{name}', deleting?.name || '')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>{t('cancel')}</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
