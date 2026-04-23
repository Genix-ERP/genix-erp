import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { companyTaxRatesService } from "@/api/services/companyTaxRates";
import { financeService } from "@/api/services/finance";

// CompanyTaxRates — admin settings component for activity-level taxes
// (NDS / Profit / Turnover / Dividend / …). Complements the existing
// EmployeeTaxes component so Settings → Finance exposes the full 8-tax
// default catalog from TZ §1.2. Migration 340 seeds the four defaults.

const APPLIES_TO_OPTIONS = [
  // [value, fallback label — translations can override via t('company_tax_applies_<value>')]
  ['sales',    'Sotuv aylanmasidan'],
  ['profit',   'Foydadan'],
  ['turnover', 'Umumiy aylanmadan'],
  ['dividend', 'Dividenddan'],
  ['other',    'Boshqa'],
];

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  rate: '',
  applies_to: 'sales',
  account_id: null,
  is_active: true,
  sort_order: 0,
};

export default function CompanyTaxRates() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [rates, setRates] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadRates = async () => {
    setLoading(true);
    try {
      const [rateList, acctList] = await Promise.all([
        companyTaxRatesService.list(),
        financeService.listAccounts({ limit: 500 }).catch(() => []),
      ]);
      setRates(rateList);
      const items = Array.isArray(acctList) ? acctList : (acctList?.data || acctList?.items || []);
      setAccounts(items);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRates(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (rate) => {
    setEditing(rate);
    setForm({
      code: rate.code || '',
      name: rate.name || '',
      description: rate.description || '',
      rate: String(rate.rate ?? ''),
      applies_to: rate.applies_to || 'other',
      account_id: rate.account_id || null,
      is_active: rate.is_active !== false,
      sort_order: rate.sort_order || 0,
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
        applies_to: form.applies_to || 'other',
        account_id: form.account_id || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editing) {
        await companyTaxRatesService.update(editing.id, {
          ...payload,
          clear_account: !payload.account_id,
        });
      } else {
        await companyTaxRatesService.create(payload);
      }
      toast.success(t('saved') || 'Saved');
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      loadRates();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await companyTaxRatesService.remove(confirmDelete.id);
      toast.success(t('deleted') || 'Deleted');
      setConfirmDelete(null);
      loadRates();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    }
  };

  const renderAccountLabel = (acct) =>
    acct ? `${acct.code || ''}${acct.code ? ' — ' : ''}${acct.name || ''}` : '';

  const findAccountLabel = (id) => {
    if (!id) return '—';
    const a = accounts.find((x) => x.id === id);
    return a ? renderAccountLabel(a) : '—';
  };

  const appliesToLabel = (v) => {
    const found = APPLIES_TO_OPTIONS.find(([val]) => val === v);
    const key = `company_tax_applies_${v}`;
    return t(key) || (found ? found[1] : v);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">
            {t('company_tax_rates') || "Kompaniya solig'lari"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('company_tax_rates_desc') ||
              "Sotuv, foyda, aylanma va dividend faoliyatidan olinadigan soliq stavkalari"}
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
                <TableHead>{t('applies_to') || "Qo'llaniladi"}</TableHead>
                <TableHead>{t('liability_account') || 'Majburiyat hisobi'}</TableHead>
                <TableHead>{t('active') || 'Faol'}</TableHead>
                <TableHead className="w-[100px] text-right">{t('actions') || 'Amallar'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t('no_company_tax_rates') || "Hali soliqlar qo'shilmagan"}
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.rate).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-50">{appliesToLabel(r.applies_to)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{findAccountLabel(r.account_id)}</TableCell>
                    <TableCell>
                      {r.is_active
                        ? <Badge className="bg-green-100 text-green-700 border-green-200">{t('yes') || 'Ha'}</Badge>
                        : <Badge variant="secondary">{t('no') || "Yo'q"}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(r)}>
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
              {t('company_tax_form_hint') ||
                "Kompaniya faoliyatidan olinadigan soliq stavkasi"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('code') || 'Kod'} *</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="NDS"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('rate') || 'Stavka'} (%) *</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="12"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t('name') || 'Nomi'} *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="QQS (NDS)"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                {t('description') || 'Tavsif'}
              </label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder=""
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                {t('applies_to') || "Qo'llaniladi"}
              </label>
              <Select
                value={form.applies_to}
                onValueChange={(v) => setForm({ ...form, applies_to: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPLIES_TO_OPTIONS.map(([val]) => (
                    <SelectItem key={val} value={val}>
                      {appliesToLabel(val)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                {t('liability_account') || 'Majburiyat hisobi'}
              </label>
              <Select
                value={form.account_id || '__none__'}
                onValueChange={(v) => setForm({ ...form, account_id: v === '__none__' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_account') || 'Hisobni tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t('none') || 'tanlanmagan'} —</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {renderAccountLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm">
                <p className="font-medium">{t('active') || 'Faol'}</p>
                <p className="text-xs text-muted-foreground">
                  {t('company_tax_active_hint') ||
                    "Faol soliqlar avtomatik hisoblashga qo'shiladi"}
                </p>
              </div>
              <Switch
                checked={!!form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: !!v })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
            <AlertDialogTitle>{t('confirm_delete') || "O'chirishni tasdiqlaysizmi?"}</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{confirmDelete?.name}</b> — {t('confirm_delete_hint') || "bu harakatni bekor qilib bo'lmaydi."}
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
