import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { categoryColor } from './constants';

const emptyForm = () => ({
  employee_id: '',
  date: new Date().toISOString().split('T')[0],
  category_id: '',
  amount: '',
  description: '',
  is_recognized: true,
});

// Create/edit form. Persists employee_id (the FK — the old form only sent
// a name string, which is why the Xodim column was empty) and requires a
// category (backend rejects without one; that's what keeps the donut alive).
export default function ExpenseFormModal({
  open, onClose, onSave, expense, employees, categories, categoriesLoading, saving, t,
}) {
  const isEdit = Boolean(expense?.id);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        employee_id: expense.employee_id || '',
        date: expense.date || expense.expense_date || new Date().toISOString().split('T')[0],
        category_id: expense.category_id || '',
        amount: expense.amount != null ? String(expense.amount) : '',
        description: expense.description || '',
        is_recognized: expense.is_recognized !== false,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, isEdit, expense]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const amountNumber = parseFloat(parsePriceInput(form.amount || '')) || 0;
  const valid = amountNumber > 0 && form.employee_id && form.category_id && form.date && form.description.trim();

  const buildPayload = () => ({
    employee_id: form.employee_id,
    date: form.date,
    category_id: form.category_id,
    amount: amountNumber,
    description: form.description.trim(),
    is_recognized: form.is_recognized,
  });

  const activeCategories = categories.filter((c) => c.is_active !== false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('exp_edit_title') : t('exp_new_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('employee')} *</Label>
              <Select value={form.employee_id} onValueChange={set('employee_id')}>
                <SelectTrigger><SelectValue placeholder={t('exp_select_employee')} /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {`${e.first_name || ''} ${e.last_name || ''}`.trim() || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('exp_date')} *</Label>
              <Input type="date" value={form.date} onChange={(e) => set('date')(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('category')} *</Label>
            {categoriesLoading ? (
              <p className="text-sm text-slate-400">{t('loading')}</p>
            ) : activeCategories.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('no_categories_yet')}{' '}
                <Link to="/settings?tab=expenses" className="text-blue-600 hover:underline">
                  {t('create_in_settings')}
                </Link>
              </p>
            ) : (
              <Select value={form.category_id} onValueChange={set('category_id')}>
                <SelectTrigger><SelectValue placeholder={t('select_category')} /></SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c, i) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: categoryColor(c, i) }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('exp_amount')} *</Label>
            <Input
              inputMode="decimal"
              placeholder="0"
              value={formatPriceInput(form.amount)}
              onChange={(e) => set('amount')(parsePriceInput(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('exp_description')} *</Label>
            <Textarea
              rows={2}
              placeholder={t('exp_description_placeholder')}
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">{t('exp_recognized_label')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('exp_recognized_help')}</p>
            </div>
            <Switch checked={form.is_recognized} onCheckedChange={set('is_recognized')} />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          {!isEdit && (
            <Button
              variant="secondary"
              disabled={!valid || saving}
              onClick={() => onSave({ ...buildPayload(), status: 'draft' })}
            >
              {t('exp_save_draft')}
            </Button>
          )}
          <Button
            disabled={!valid || saving}
            onClick={() => onSave(isEdit ? buildPayload() : { ...buildPayload(), status: 'submitted' })}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? t('save_changes') : t('exp_create_submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
