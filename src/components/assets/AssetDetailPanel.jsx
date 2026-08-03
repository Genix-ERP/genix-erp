/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, CheckCircle2, PauseCircle, PlayCircle, LogOut, Printer, Wrench,
} from 'lucide-react';
import { fixedAssetsV2Service as fa } from '@/api/services/fixedAssetsV2';
import { errMsg, fmtDate, statusLabel, STATUS_META, today } from './assetUtils';

/**
 * Asset card side panel: identity, dates, financials (live from the register),
 * depreciation schedule preview + history, lifecycle actions with real dialogs
 * (the window.prompt era is over — audit finding #8), printable OS kartochkasi.
 */
export default function AssetDetailPanel({ assetId, onClose, onChanged, t, canUpdate, canApprove, formatCurrency }) {
  const [asset, setAsset] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [entries, setEntries] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // 'commission' | 'dispose' | 'maintenance'
  const [commDate, setCommDate] = useState(today());
  const [dispose, setDispose] = useState({ disposal_date: today(), disposal_type: 'sale', sale_price: '', reason: '' });
  const emptyMaint = {
    maintenance_type: 'regular_to', service_date: today(), cost: '',
    payment_method: 'credit', life_extension_months: '0', performed_by: '',
    description: '', next_service_date: '',
  };
  const [maint, setMaint] = useState(emptyMaint);

  const load = useCallback(() => {
    if (!assetId) return;
    setLoading(true);
    Promise.all([
      fa.getAsset(assetId),
      fa.getSchedule(assetId).catch(() => []),
      fa.getEntries(assetId).catch(() => []),
      fa.listMaintenance(assetId).catch(() => []),
    ])
      .then(([a, s, en, m]) => { setAsset(a); setSchedule(s); setEntries(en); setMaintenance(m); })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      setDialog(null);
      load();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const printCard = () => {
    if (!asset) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = [
      [t('inventory_number') || 'Inventar raqami', asset.inventory_number],
      [t('name') || 'Nomi', asset.name],
      [t('category') || 'Kategoriya', asset.category_name],
      [t('fa_cost_center') || "Bo'lim", asset.department_name],
      [t('serial_number') || 'Seriya raqami', asset.serial_number || '—'],
      [t('purchase_date') || 'Xarid sanasi', fmtDate(asset.purchase_date)],
      [t('commissioning_date') || 'Foydalanishga topshirish', fmtDate(asset.commissioning_date)],
      [t('cost') || 'Tannarx', formatCurrency(asset.cost)],
      [t('fa_salvage_value') || 'Likvidatsiya qiymati', formatCurrency(asset.salvage_value)],
      [t('fa_useful_life') || 'Muddat', `${asset.useful_life_months} oy`],
      [t('accumulated') || "Yig'ilgan iznos", formatCurrency(asset.accumulated_depreciation)],
      [t('book_value') || 'Qoldiq qiymat', formatCurrency(asset.book_value)],
      [t('fa_responsible_employee') || 'Javobgar shaxs', asset.assigned_employee_name || '—'],
      [t('fa_construction_object') || 'Obyekt', asset.construction_object_name || asset.location || '—'],
      [t('status') || 'Holat', statusLabel(t, asset.status)],
    ];
    w.document.write(`<!doctype html><html><head><title>${asset.inventory_number}</title>
      <style>body{font-family:sans-serif;padding:32px;max-width:640px;margin:auto}
      h1{font-size:18px}h2{font-size:13px;color:#666;font-weight:normal}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      td{border:1px solid #ccc;padding:6px 10px;font-size:13px}td:first-child{color:#555;width:45%}</style>
      </head><body><h1>${t('fa_os_card') || 'Asosiy vosita kartochkasi (OS-6)'}</h1>
      <h2>${new Date().toLocaleDateString('ru-RU')}</h2>
      <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v ?? '—'}</td></tr>`).join('')}</table>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Sheet open={!!assetId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {loading || !asset ? (
          <div className="space-y-3 mt-8">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-slate-500">{asset.inventory_number}</span>
                <span>{asset.name}</span>
                <Badge className={STATUS_META[asset.status]?.cls || ''}>{statusLabel(t, asset.status)}</Badge>
              </SheetTitle>
            </SheetHeader>

            {/* Financial strip */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                [t('cost') || 'Tannarx', formatCurrency(asset.cost)],
                [t('accumulated') || "Yig'ilgan iznos", formatCurrency(asset.accumulated_depreciation)],
                [t('book_value') || 'Qoldiq qiymat', formatCurrency(asset.book_value)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3">
                  <p className="text-[11px] text-slate-500">{label}</p>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Identity */}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                [t('category') || 'Kategoriya', asset.category_name],
                [t('fa_cost_center') || "Bo'lim", asset.department_name],
                [t('purchase_date') || 'Xarid sanasi', fmtDate(asset.purchase_date)],
                [t('commissioning_date') || 'Foydalanishga topshirish', fmtDate(asset.commissioning_date)],
                [t('fa_useful_life') || 'Muddat', `${asset.useful_life_months} ${t('fa_months') || 'oy'}`],
                [t('fa_salvage_value') || 'Likvidatsiya qiymati', formatCurrency(asset.salvage_value)],
                [t('fa_responsible_employee') || 'Javobgar shaxs', asset.assigned_employee_name || '—'],
                [t('fa_construction_object') || 'Obyekt / joylashuv', asset.construction_object_name || asset.location || '—'],
                [t('serial_number') || 'Seriya raqami', asset.serial_number || '—'],
                [t('fa_supplier') || 'Ta\'minotchi', asset.supplier_name || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] text-slate-400">{k}</dt>
                  <dd className="text-slate-800">{v}</dd>
                </div>
              ))}
              {asset.status === 'disposed' && (
                <div className="col-span-2 rounded-lg bg-red-50 border border-red-100 p-2 text-xs text-red-800">
                  {t('fa_disposed_on') || 'Chiqarilgan'}: {fmtDate(asset.disposal_date)}
                  {asset.disposal_amount != null && <> · {t('fa_sale_price') || 'Sotish narxi'}: {formatCurrency(asset.disposal_amount)}</>}
                  {asset.disposal_reason && <> · {asset.disposal_reason}</>}
                </div>
              )}
            </dl>

            {/* GL accounts (read-only) */}
            <p className="mt-3 text-[11px] text-slate-400">
              {t('fa_accounts_preview') || 'GL hisoblari'}: {asset.effective_asset_account || '—'} / {asset.effective_depreciation_account || '—'} / {asset.effective_expense_account || '—'}
            </p>

            {/* Lifecycle actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              {canUpdate && asset.status === 'draft' && (
                <Button size="sm" onClick={() => { setCommDate(today()); setDialog('commission'); }}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {t('commission') || 'Foydalanishga topshirish'}
                </Button>
              )}
              {canUpdate && asset.status === 'in_service' && (
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => act(() => fa.conserveAsset(asset.id), t('fa_conserved_ok') || 'Konservatsiyaga o\'tkazildi')}>
                  <PauseCircle className="w-4 h-4 mr-1.5" />
                  {t('fa_conserve') || 'Konservatsiya'}
                </Button>
              )}
              {canUpdate && asset.status === 'conserved' && (
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => act(() => fa.reactivateAsset(asset.id), t('fa_reactivated_ok') || 'Qayta ishga tushirildi')}>
                  <PlayCircle className="w-4 h-4 mr-1.5" />
                  {t('fa_reactivate') || 'Qayta ishga tushirish'}
                </Button>
              )}
              {canUpdate && (asset.status === 'in_service' || asset.status === 'conserved') && (
                <Button size="sm" variant="outline"
                  onClick={() => { setMaint(emptyMaint); setDialog('maintenance'); }}>
                  <Wrench className="w-4 h-4 mr-1.5" />
                  {t('fa_maintenance') || 'Texnik xizmat'}
                </Button>
              )}
              {canApprove && (asset.status === 'in_service' || asset.status === 'conserved') && (
                <Button size="sm" variant="destructive"
                  onClick={() => { setDispose({ disposal_date: today(), disposal_type: 'sale', sale_price: '', reason: '' }); setDialog('dispose'); }}>
                  <LogOut className="w-4 h-4 mr-1.5" />
                  {t('dispose') || 'Hisobdan chiqarish'}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={printCard}>
                <Printer className="w-4 h-4 mr-1.5" />
                {t('fa_os_card_short') || 'OS kartochkasi'}
              </Button>
            </div>

            {/* Maintenance history */}
            {maintenance.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  {t('fa_maintenance_history') || 'Texnik xizmat tarixi'}
                </h4>
                <div className="rounded-xl border border-slate-200/60 overflow-hidden max-h-44 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {maintenance.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 whitespace-nowrap">{fmtDate(m.service_date)}</td>
                          <td className="p-2">
                            {t(`fa_mt_${m.maintenance_type}`) || {
                              regular_to: 'Texnik xizmat', minor_repair: "Joriy ta'mirlash",
                              capital_repair: "Kapital ta'mirlash", modernization: 'Modernizatsiya',
                            }[m.maintenance_type] || m.maintenance_type}
                            {m.life_extension_months > 0 && (
                              <span className="text-slate-400"> (+{m.life_extension_months} {t('fa_months') || 'oy'})</span>
                            )}
                            {m.description && <p className="text-slate-400 truncate max-w-[220px]">{m.description}</p>}
                          </td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(m.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Depreciation history + schedule preview */}
            {entries.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{t('fa_depr_history') || 'Amortizatsiya tarixi'}</h4>
                <div className="rounded-xl border border-slate-200/60 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.id} className={`border-b border-slate-100 last:border-0 ${e.status === 'reversed' ? 'opacity-40 line-through' : ''}`}>
                          <td className="p-2 font-mono">{e.period}</td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(e.amount)}</td>
                          <td className="p-2 text-slate-400">{e.debit_account} / {e.credit_account}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {schedule.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  {t('fa_schedule_preview') || 'Kelgusi jadval (prognoz)'}
                </h4>
                <div className="rounded-xl border border-slate-200/60 overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-500">
                        <th className="p-2">{t('period') || 'Davr'}</th>
                        <th className="p-2 text-right">{t('amount') || 'Summa'}</th>
                        <th className="p-2 text-right">{t('accumulated') || "Yig'ilgan"}</th>
                        <th className="p-2 text-right">{t('book_value') || 'Qoldiq'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((s) => (
                        <tr key={s.period} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 font-mono">{s.period}</td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(s.amount)}</td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(s.accumulated)}</td>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(s.book_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Commission dialog */}
        <Dialog open={dialog === 'commission'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('commission') || 'Foydalanishga topshirish'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>{t('commissioning_date') || 'Sana'} *</Label>
              <Input type="date" value={commDate} onChange={(e) => setCommDate(e.target.value)} />
              <p className="text-xs text-slate-400">{t('fa_depr_starts_next_month') || 'Amortizatsiya keyingi oydan boshlanadi'}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>{t('cancel') || 'Bekor qilish'}</Button>
              <Button disabled={busy || !commDate}
                onClick={() => act(() => fa.commissionAsset(assetId, commDate), t('fa_commissioned_ok') || 'Foydalanishga topshirildi')}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('confirm') || 'Tasdiqlash'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Maintenance dialog — expense vs capitalize (cost/life increase) */}
        <Dialog open={dialog === 'maintenance'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('fa_maintenance') || 'Texnik xizmat'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('fa_mt_type') || 'Xizmat turi'} *</Label>
                  <Select value={maint.maintenance_type} onValueChange={(v) => setMaint((m) => ({ ...m, maintenance_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular_to">{t('fa_mt_regular_to') || 'Texnik xizmat (TO)'}</SelectItem>
                      <SelectItem value="minor_repair">{t('fa_mt_minor_repair') || "Joriy ta'mirlash"}</SelectItem>
                      <SelectItem value="capital_repair">{t('fa_mt_capital_repair') || "Kapital ta'mirlash"}</SelectItem>
                      <SelectItem value="modernization">{t('fa_mt_modernization') || 'Modernizatsiya'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('fa_mt_date') || 'Xizmat sanasi'} *</Label>
                  <Input type="date" value={maint.service_date} onChange={(e) => setMaint((m) => ({ ...m, service_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('cost') || 'Summa'}</Label>
                  <Input type="number" min="0" value={maint.cost} onChange={(e) => setMaint((m) => ({ ...m, cost: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('payment_method') || "To'lov usuli"}</Label>
                  <Select value={maint.payment_method} onValueChange={(v) => setMaint((m) => ({ ...m, payment_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">{t('fa_pay_credit') || 'Nasiya'}</SelectItem>
                      <SelectItem value="cash">{t('fa_pay_cash') || 'Naqd'}</SelectItem>
                      <SelectItem value="bank">{t('fa_pay_bank') || 'Bank'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(maint.maintenance_type === 'capital_repair' || maint.maintenance_type === 'modernization') && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 space-y-2">
                  <p className="text-xs text-blue-800">
                    {t('fa_mt_capitalize_note') || "Summa aktiv qiymatiga qo'shiladi (Dt aktiv hisobi); kelgusi amortizatsiya yangi qiymatdan hisoblanadi."}
                  </p>
                  <div className="space-y-1.5">
                    <Label>{t('fa_mt_life_extension') || 'Muddat uzayishi (oy)'}</Label>
                    <Input type="number" min="0" value={maint.life_extension_months}
                      onChange={(e) => setMaint((m) => ({ ...m, life_extension_months: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('fa_mt_performed_by') || 'Bajaruvchi'}</Label>
                  <Input value={maint.performed_by} onChange={(e) => setMaint((m) => ({ ...m, performed_by: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('fa_mt_next_date') || 'Keyingi xizmat sanasi'}</Label>
                  <Input type="date" value={maint.next_service_date} onChange={(e) => setMaint((m) => ({ ...m, next_service_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('notes') || 'Izoh'}</Label>
                <Textarea rows={2} value={maint.description} onChange={(e) => setMaint((m) => ({ ...m, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>{t('cancel') || 'Bekor qilish'}</Button>
              <Button
                disabled={busy || !maint.service_date}
                onClick={() => act(() => fa.recordMaintenance(assetId, {
                  maintenance_type: maint.maintenance_type,
                  service_date: maint.service_date,
                  cost: parseFloat(maint.cost) || 0,
                  payment_method: maint.payment_method,
                  life_extension_months: parseInt(maint.life_extension_months, 10) || 0,
                  performed_by: maint.performed_by,
                  description: maint.description,
                  next_service_date: maint.next_service_date,
                }), t('fa_mt_saved') || 'Xizmat qayd etildi')}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('save') || 'Saqlash'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dispose dialog — sale (price → gain/loss) or write-off */}
        <Dialog open={dialog === 'dispose'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('dispose') || 'Hisobdan chiqarish'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t('fa_disposal_type') || 'Chiqarish turi'}</Label>
                <Select value={dispose.disposal_type} onValueChange={(v) => setDispose((d) => ({ ...d, disposal_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{t('fa_disposal_sale') || 'Sotish'}</SelectItem>
                    <SelectItem value="writeoff">{t('fa_disposal_writeoff') || 'Spisaniye (yaroqsiz)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('fa_disposal_date') || 'Chiqarish sanasi'} *</Label>
                <Input type="date" value={dispose.disposal_date}
                  onChange={(e) => setDispose((d) => ({ ...d, disposal_date: e.target.value }))} />
              </div>
              {dispose.disposal_type === 'sale' && (
                <div className="space-y-1.5">
                  <Label>{t('fa_sale_price') || 'Sotish narxi'} *</Label>
                  <Input type="number" min="0" value={dispose.sale_price}
                    onChange={(e) => setDispose((d) => ({ ...d, sale_price: e.target.value }))} />
                  {asset && dispose.sale_price !== '' && (
                    <p className={`text-xs ${parseFloat(dispose.sale_price) >= asset.book_value ? 'text-green-600' : 'text-red-600'}`}>
                      {t('fa_gain_loss') || 'Foyda/zarar'}: {formatCurrency((parseFloat(dispose.sale_price) || 0) - asset.book_value)}
                      {' '}({t('book_value') || 'qoldiq'}: {formatCurrency(asset.book_value)})
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t('fa_disposal_reason') || 'Sababi'}</Label>
                <Input value={dispose.reason} onChange={(e) => setDispose((d) => ({ ...d, reason: e.target.value }))} />
              </div>
              <p className="text-xs text-slate-400">
                {t('fa_disposal_note') || "Chiqarish oyi uchun amortizatsiya avtomatik hisoblanadi; provodkalar Moliyaga yoziladi."}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>{t('cancel') || 'Bekor qilish'}</Button>
              <Button variant="destructive"
                disabled={busy || !dispose.disposal_date || (dispose.disposal_type === 'sale' && !(parseFloat(dispose.sale_price) > 0))}
                onClick={() => act(() => fa.disposeAsset(assetId, {
                  disposal_date: dispose.disposal_date,
                  disposal_type: dispose.disposal_type,
                  sale_price: parseFloat(dispose.sale_price) || 0,
                  reason: dispose.reason,
                }), t('fa_disposed_ok') || 'Hisobdan chiqarildi')}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('confirm') || 'Tasdiqlash'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
