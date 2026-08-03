/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { aiService } from '@/api/services/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Settings2, Sparkles } from 'lucide-react';
import { fixedAssetsV2Service as fa } from '@/api/services/fixedAssetsV2';
import { hrService } from '@/api/services/hr';
import { constructionService } from '@/api/services/construction';
import { errMsg, today } from './assetUtils';

/**
 * The ONE unified asset form (audit finding #2 killed the three-form split).
 * Category-first: picking a category inherits the default useful life and
 * shows the resolved GL accounts read-only; the term is entered in months with
 * a live years hint (or vice versa via the yil/oy toggle).
 */
export default function AssetFormDialog({ open, onClose, onCreated, mapping, t, canEditSettings }) {
  const navigate = useNavigate();
  const categories = useMemo(
    () => (mapping?.categories || []).filter((c) => c.is_active !== false),
    [mapping],
  );
  const departments = useMemo(
    () => (mapping?.departments || []).filter((d) => d.is_active !== false),
    [mapping],
  );

  const empty = {
    name: '', category_id: '', department_id: '', cost: '', salvage_value: '0',
    useful_life_months: '', vat_amount: '0', purchase_date: today(),
    commissioning_date: today(), payment_method: 'credit', serial_number: '',
    location: '', notes: '', assigned_employee_id: '', construction_object_id: '',
    commission_now: true,
  };
  const [form, setForm] = useState(empty);
  const [lifeUnit, setLifeUnit] = useState('months'); // 'months' | 'years'
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [objects, setObjects] = useState([]);
  const fileRef = useRef(null);

  // AI intake: invoice photo/PDF -> draft field values (shared extractor used
  // by AP). Suggestions only — the user reviews before saving.
  const onInvoiceFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      toast.error(t('fa_ai_bad_file') || 'JPG/PNG/WEBP/PDF fayl yuklang');
      return;
    }
    setAiBusy(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await aiService.extractInvoice(base64, file.type);
      setForm((f) => ({
        ...f,
        name: f.name || data?.line_items?.[0]?.description || '',
        cost: data?.subtotal > 0 ? String(data.subtotal)
          : data?.total_amount > 0 ? String((data.total_amount - (data.tax_amount || 0)) || data.total_amount) : f.cost,
        vat_amount: data?.tax_amount > 0 ? String(data.tax_amount) : f.vat_amount,
        purchase_date: data?.invoice_date || f.purchase_date,
        notes: [f.notes, data?.vendor_name ? `${t('fa_supplier') || "Ta'minotchi"}: ${data.vendor_name}` : '',
          data?.invoice_number ? `${t('fa_ai_invoice_no') || 'Faktura'}: ${data.invoice_number}` : '']
          .filter(Boolean).join('\n'),
      }));
      toast.success(t('fa_ai_prefilled') || "Fakturadan to'ldirildi — tekshirib tasdiqlang");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setForm(empty);
    setLifeUnit('months');
    // Reference data is optional — the form works without it.
    hrService.listEmployees({ status: 'active' })
      .then((r) => setEmployees(Array.isArray(r) ? r : r?.data || r?.employees || []))
      .catch(() => setEmployees([]));
    constructionService.listProjects()
      .then((r) => setObjects(Array.isArray(r) ? r : r?.data || r?.projects || []))
      .catch(() => setObjects([]));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const category = categories.find((c) => c.id === form.category_id);
  const department = departments.find((d) => d.id === form.department_id);

  const onCategoryChange = (id) => {
    const cat = categories.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      category_id: id,
      useful_life_months: f.useful_life_months || (cat?.default_useful_life_months ? String(cat.default_useful_life_months) : ''),
    }));
  };

  const months = lifeUnit === 'months'
    ? parseInt(form.useful_life_months, 10) || 0
    : Math.round((parseFloat(form.useful_life_months) || 0) * 12);

  const submit = async () => {
    if (!form.name.trim() || !form.category_id || !form.department_id || !(parseFloat(form.cost) > 0) || months <= 0) {
      toast.error(t('fill_required') || "Majburiy maydonlarni to'ldiring");
      return;
    }
    if (form.commission_now && !form.commissioning_date) {
      toast.error(t('fa_commissioning_required') || 'Foydalanishga topshirish sanasi majburiy');
      return;
    }
    setBusy(true);
    try {
      await fa.createAsset({
        name: form.name.trim(),
        category_id: form.category_id,
        department_id: form.department_id,
        cost: parseFloat(form.cost),
        salvage_value: parseFloat(form.salvage_value) || 0,
        useful_life_months: months,
        vat_amount: parseFloat(form.vat_amount) || 0,
        purchase_date: form.purchase_date,
        commissioning_date: form.commission_now ? form.commissioning_date : '',
        commission_now: form.commission_now,
        payment_method: form.payment_method,
        serial_number: form.serial_number,
        location: form.location,
        notes: form.notes,
        assigned_employee_id: form.assigned_employee_id,
        construction_object_id: form.construction_object_id,
      });
      toast.success(t('asset_created') || 'Aktiv yaratildi');
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            {t('add_asset') || "Aktiv qo'shish"}
            <Button type="button" size="sm" variant="outline" disabled={aiBusy}
              onClick={() => fileRef.current?.click()}>
              {aiBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              {t('fa_ai_from_invoice') || "Fakturadan (AI)"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden" onChange={onInvoiceFile} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Category first — it drives life + accounts */}
          <div className="space-y-1.5">
            <Label>{t('category') || 'Kategoriya'} *</Label>
            <Select value={form.category_id} onValueChange={onCategoryChange}>
              <SelectTrigger><SelectValue placeholder={t('select') || 'Tanlang'} /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name_uz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fa_cost_center') || "Bo'lim (xarajat markazi)"} *</Label>
            <Select value={form.department_id} onValueChange={(v) => set('department_id', v)}>
              <SelectTrigger><SelectValue placeholder={t('select') || 'Tanlang'} /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name_uz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('name') || 'Nomi'} *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ekskavator CAT 320" />
          </div>

          <div className="space-y-1.5">
            <Label>{t('cost') || 'Tannarx (QQSsiz)'} *</Label>
            <Input type="number" min="0" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fa_vat_amount') || 'QQS summasi'}</Label>
            <Input type="number" min="0" value={form.vat_amount} onChange={(e) => set('vat_amount', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('fa_salvage_value') || 'Likvidatsiya qiymati'}</Label>
            <Input type="number" min="0" value={form.salvage_value} onChange={(e) => set('salvage_value', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t('fa_useful_life') || 'Foydali xizmat muddati'} *</Label>
              <div className="flex rounded-md bg-slate-100 p-0.5 text-xs">
                {['months', 'years'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setLifeUnit(u)}
                    className={`px-2 py-0.5 rounded ${lifeUnit === u ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    {u === 'months' ? (t('fa_months') || 'oy') : (t('fa_years') || 'yil')}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number" min="0" step={lifeUnit === 'years' ? '0.5' : '1'}
              value={form.useful_life_months}
              onChange={(e) => set('useful_life_months', e.target.value)}
            />
            {months > 0 && (
              <p className="text-xs text-slate-400">
                = {months} {t('fa_months') || 'oy'} ({(months / 12).toFixed(1)} {t('fa_years') || 'yil'})
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('purchase_date') || 'Xarid sanasi'} *</Label>
            <Input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('payment_method') || "To'lov usuli"}</Label>
            <Select value={form.payment_method} onValueChange={(v) => set('payment_method', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">{t('fa_pay_credit') || 'Nasiya (6010 da qoladi)'}</SelectItem>
                <SelectItem value="cash">{t('fa_pay_cash') || 'Naqd (kassa)'}</SelectItem>
                <SelectItem value="bank">{t('fa_pay_bank') || 'Bank orqali'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="commission_now"
                checked={form.commission_now}
                onCheckedChange={(v) => set('commission_now', !!v)}
              />
              <Label htmlFor="commission_now" className="cursor-pointer">
                {t('fa_commission_now') || 'Darhol foydalanishga topshirish'}
              </Label>
            </div>
            {form.commission_now && (
              <div className="space-y-1.5">
                <Label>{t('commissioning_date') || 'Foydalanishga topshirish sanasi'} *</Label>
                <Input
                  type="date" value={form.commissioning_date}
                  onChange={(e) => set('commissioning_date', e.target.value)}
                />
                <p className="text-xs text-slate-400">
                  {t('fa_depr_starts_next_month') || 'Amortizatsiya keyingi oydan boshlanadi'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('fa_responsible_employee') || 'Javobgar shaxs'}</Label>
            <Select value={form.assigned_employee_id || 'none'} onValueChange={(v) => set('assigned_employee_id', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name ? `${e.first_name} ${e.last_name || ''}` : e.name || e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fa_construction_object') || 'Qurilish obyekti'}</Label>
            <Select value={form.construction_object_id || 'none'} onValueChange={(v) => set('construction_object_id', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {objects.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('serial_number') || 'Seriya raqami'}</Label>
            <Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('location') || 'Joylashuv'}</Label>
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('notes') || 'Izoh'}</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {/* Accounts preview — read-only; configured in Settings, never here */}
          {(category || department) && (
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{t('fa_accounts_preview') || 'GL hisoblari (mapping)'}</span>
                {canEditSettings && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    onClick={() => navigate('/settings?tab=asset-mapping')}
                  >
                    <Settings2 className="w-3 h-3" />
                    {t('fa_edit_in_settings') || "Sozlamalarda o'zgartirish"}
                  </button>
                )}
              </div>
              <p>{t('fa_asset_account') || 'Aktiv hisobi'}: <b>{category?.asset_account || '—'}</b>{' · '}
                {t('fa_depreciation_account') || 'Amortizatsiya'}: <b>{category?.depreciable === false ? (t('fa_not_depreciable') || 'amortizatsiya yo‘q') : category?.depreciation_account || '—'}</b>{' · '}
                {t('fa_expense_account') || 'Xarajat'}: <b>{department?.expense_account || '—'}</b></p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('cancel') || 'Bekor qilish'}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('save') || 'Saqlash'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
