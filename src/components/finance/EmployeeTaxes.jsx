import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { employeeTaxesService } from "@/api/services/employeeTaxes";
import { financeService } from "@/api/services/finance";

// EmployeeTaxes — admin settings component that manages the per-tenant
// employee-tax catalog (migration 330). Rendered inside Settings → Finance.
// Each row defines one tax (code, rate, base, payer, GL account). The taxes
// defined here are applied to every new payroll entry unless the user opts
// them out via the X button in the create-payroll modal.

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  rate: '',
  base_type: 'gross',
  payer: 'employee',
  account_id: null,
  expense_account_id: null,
  is_active: true,
  sort_order: 0,
};

export default function EmployeeTaxes() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [taxes, setTaxes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadTaxes = async () => {
    setLoading(true);
    try {
      const [taxList, acctList] = await Promise.all([
        employeeTaxesService.list(),
        financeService.listAccounts({ limit: 500 }),
      ]);
      setTaxes(taxList);
      // listAccounts returns {data: [...], meta:...} shape — normalize
      const items = Array.isArray(acctList) ? acctList : (acctList?.data || acctList?.items || []);
      setAccounts(items);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (tax) => {
    setEditing(tax);
    setForm({
      code: tax.code || '',
      name: tax.name || '',
      description: tax.description || '',
      rate: String(tax.rate ?? ''),
      base_type: tax.base_type || 'gross',
      payer: tax.payer || 'employee',
      account_id: tax.account_id || null,
      expense_account_id: tax.expense_account_id || null,
      is_active: tax.is_active !== false,
      sort_order: tax.sort_order || 0,
    });
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(t('code_and_name_required') || 'Code and name are required');
      return;
    }
    const rateNum = Number(form.rate);
    if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) {
      toast.error(t('rate_must_be_0_100') || 'Rate must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description,
        rate: rateNum,
        base_type: form.base_type,
        payer: form.payer,
        account_id: form.account_id || null,
        expense_account_id: form.payer === 'employer' ? (form.expense_account_id || null) : null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editing) {
        // Use clear_* flags when user cleared the account rather than leaving it unchanged
        const updatePayload = {
          ...payload,
          clear_account: !payload.account_id,
          clear_expense_account: !payload.expense_account_id,
        };
        await employeeTaxesService.update(editing.id, updatePayload);
        toast.success(t('saved') || 'Saved');
      } else {
        await employeeTaxesService.create(payload);
        toast.success(t('saved') || 'Saved');
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      loadTaxes();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await employeeTaxesService.remove(confirmDelete.id);
      toast.success(t('deleted') || 'Deleted');
      setConfirmDelete(null);
      loadTaxes();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    }
  };

  const renderAccountLabel = (acct) => {
    if (!acct) return '';
    return `${acct.code || ''}${acct.code ? ' — ' : ''}${acct.name || ''}`;
  };

  const findAccountLabel = (id) => {
    if (!id) return '—';
    const a = accounts.find((x) => x.id === id);
    return a ? renderAccountLabel(a) : '—';
  };

  const baseTypeLabel = (bt) => {
    switch (bt) {
      case 'base_salary': return t('base_salary') || 'Base salary';
      case 'taxable':     return t('taxable_income') || 'Taxable income';
      default:            return t('gross_salary') || 'Gross salary';
    }
  };

  const payerBadge = (p) => (
    p === 'employer'
      ? <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{t('payer_employer') || 'Employer'}</Badge>
      : <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{t('payer_employee') || 'Employee'}</Badge>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">{t('employee_taxes') || 'Xodim soliqlari'}</h3>
          <p className="text-sm text-muted-foreground">
            {t('employee_taxes_desc') || "Ish haqi hisoblashda avtomatik qo'llaniladigan soliqlar"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t('new_tax') || 'Yangi soliq'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('code') || 'Kod'}</TableHead>
                <TableHead>{t('name') || 'Nomi'}</TableHead>
                <TableHead className="text-right">{t('rate') || 'Stavka'}</TableHead>
                <TableHead>{t('base') || 'Baza'}</TableHead>
                <TableHead>{t('payer') || "To'lovchi"}</TableHead>
                <TableHead>{t('liability_account') || 'Majburiyat hisobi'}</TableHead>
                <TableHead>{t('active') || 'Faol'}</TableHead>
                <TableHead className="w-[100px] text-right">{t('actions') || 'Amallar'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t('no_employee_taxes') || "Hali soliqlar qo'shilmagan"}
                  </TableCell>
                </TableRow>
              ) : (
                taxes.map((tax) => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-mono text-xs">{tax.code}</TableCell>
                    <TableCell>{tax.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(tax.rate).toFixed(2)}%</TableCell>
                    <TableCell>{baseTypeLabel(tax.base_type)}</TableCell>
                    <TableCell>{payerBadge(tax.payer)}</TableCell>
                    <TableCell className="text-xs">{findAccountLabel(tax.account_id)}</TableCell>
                    <TableCell>
                      {tax.is_active
                        ? <Badge className="bg-green-100 text-green-700 border-green-200">{t('yes') || 'Ha'}</Badge>
                        : <Badge variant="secondary">{t('no') || "Yo'q"}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(tax)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(tax)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? (t('edit_tax') || 'Soliqni tahrirlash')
                : (t('new_tax') || 'Yangi soliq')}
            </DialogTitle>
            <DialogDescription>
              {t('employee_tax_form_hint') || "Ish haqi hisoblashda avtomatik qo'llaniladigan soliq"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('code') || 'Kod'} *</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="NDFL"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('rate') || 'Stavka'} (%) *</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="12.00"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t('name') || 'Nomi'} *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Daromad solig'i (NDFL)"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t('description') || 'Tavsif'}</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('base') || 'Baza'}</label>
                <Select
                  value={form.base_type}
                  onValueChange={(v) => setForm({ ...form, base_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">{t('gross_salary') || 'Brutto maosh'}</SelectItem>
                    <SelectItem value="base_salary">{t('base_salary') || 'Asosiy maosh'}</SelectItem>
                    <SelectItem value="taxable">{t('taxable_income') || "Soliqqa tortiladigan daromad"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('payer') || "To'lovchi"}</label>
                <Select
                  value={form.payer}
                  onValueChange={(v) => setForm({ ...form, payer: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{t('payer_employee') || 'Xodim (maoshdan ushlab qolinadi)'}</SelectItem>
                    <SelectItem value="employer">{t('payer_employer') || 'Ish beruvchi (kompaniya xarajati)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t('liability_account') || 'Majburiyat hisobi'}</label>
              <Select
                value={form.account_id || '__none__'}
                onValueChange={(v) => setForm({ ...form, account_id: v === '__none__' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder={t('select_account') || 'Hisobni tanlang'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('no_account_selected') || '— tanlanmagan —'}</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{renderAccountLabel(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.payer === 'employer' && (
              <div>
                <label className="text-xs text-muted-foreground">{t('expense_account') || 'Xarajat hisobi'}</label>
                <Select
                  value={form.expense_account_id || '__none__'}
                  onValueChange={(v) => setForm({ ...form, expense_account_id: v === '__none__' ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder={t('select_account') || 'Hisobni tanlang'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('no_account_selected') || '— tanlanmagan —'}</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{renderAccountLabel(a)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <div className="text-sm font-medium">{t('active') || 'Faol'}</div>
                <div className="text-xs text-muted-foreground">{t('active_tax_desc') || "Ish haqi hisoblashda qo'llanadi"}</div>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('save') || 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete') || "O'chirishni tasdiqlang"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
