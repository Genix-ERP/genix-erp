/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Play, Loader2, CalendarClock, LogOut, CheckCircle2, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { fixedAssetsV2Service as fa } from '@/api/services/fixedAssetsV2';

const STATUS_STYLE = {
  draft: 'bg-slate-100 text-slate-700',
  in_service: 'bg-green-100 text-green-800',
  conserved: 'bg-amber-100 text-amber-800',
  disposed: 'bg-red-100 text-red-700',
};

const errMsg = (e) => e?.response?.data?.error?.message_uz || e?.response?.data?.error?.message || e?.message || 'Xatolik';
const thisPeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export default function FixedAssetsV2Panel() {
  const { language } = useLanguage();
  // The app's t() returns the key itself when a translation is missing; wrap it
  // to return '' on a miss so the `t('x') || 'fallback'` pattern shows the
  // Uzbek fallback instead of a raw key.
  const { t: t0 } = useTranslation(language);
  const t = (k) => { const v = t0(k); return v === k ? '' : v; };
  const { formatCurrency } = useCurrencyFormatter();
  const navigate = useNavigate();

  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [run, setRun] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([fa.listAssets(), fa.getMapping()]);
      setAssets(a || []);
      setCategories(m?.categories?.filter((c) => c.is_active !== false) || []);
      setDepartments(m?.departments?.filter((d) => d.is_active !== false) || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ---- depreciation run ----
  const runDepreciation = async () => {
    const period = window.prompt(t('enter_period') || 'Davr (YYYY-MM):', thisPeriod());
    if (!period) return;
    setBusy(true);
    try {
      const r = await fa.createRun(period);
      setRun(r);
      setShowRun(true);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const postRun = async () => {
    setBusy(true);
    try {
      const r = await fa.postRun(run.id);
      setRun(r);
      toast.success(t('run_posted') || 'Reglament o\'tkazildi');
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const reverseRun = async () => {
    setBusy(true);
    try {
      await fa.reverseRun(run.id);
      toast.success(t('run_reversed') || 'Reglament reverslandi');
      setShowRun(false);
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  // ---- row actions ----
  const commission = async (a) => {
    const d = window.prompt(t('commissioning_date') || 'Foydalanishga topshirish sanasi (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!d) return;
    try { await fa.commissionAsset(a.id, d); toast.success('OK'); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const dispose = async (a) => {
    const d = window.prompt(t('disposal_date') || 'Chiqarish sanasi (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!d) return;
    const reason = window.prompt(t('reason') || 'Sabab:') || '';
    try { await fa.disposeAsset(a.id, d, reason); toast.success('OK'); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const openSchedule = async (a) => {
    try { setSchedule({ asset: a, rows: await fa.getSchedule(a.id) }); } catch (e) { toast.error(errMsg(e)); }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="w-4 h-4 animate-spin" />{t('loading') || 'Yuklanmoqda...'}</div>;
  }

  const noMapping = categories.length === 0 || departments.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{t('fixed_assets') || 'Asosiy vositalar'}</h2>
          <p className="text-sm text-slate-500">{assets.length} {t('assets') || 'aktiv'}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runDepreciation} disabled={busy} variant="outline" className="gap-1">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {t('run_depreciation') || 'Amortizatsiyani hisoblash'}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
            <Plus className="w-4 h-4" />{t('add_asset') || 'Aktiv qo\'shish'}
          </Button>
        </div>
      </div>

      {noMapping && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3 text-sm text-amber-800">
            {t('mapping_missing_hint') || 'Kategoriya/bo\'lim hisoblari sozlanmagan.'}{' '}
            <button className="underline font-medium" onClick={() => navigate('/settings?tab=asset-mapping')}>{t('open_settings') || 'Sozlamalarni ochish'}</button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b bg-slate-50">
                <th className="p-3">{t('inventory_number') || 'Inv. raqam'}</th>
                <th className="p-3">{t('name') || 'Nomi'}</th>
                <th className="p-3">{t('category') || 'Kategoriya'}</th>
                <th className="p-3">{t('department') || 'Bo\'lim'}</th>
                <th className="p-3 text-right">{t('cost') || 'Qiymat'}</th>
                <th className="p-3 text-right">{t('accumulated') || 'Yig\'ilgan iznos'}</th>
                <th className="p-3 text-right">{t('book_value') || 'Qoldiq qiymat'}</th>
                <th className="p-3">{t('status') || 'Holat'}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-slate-400">{t('no_assets') || 'Aktivlar yo\'q'}</td></tr>
              )}
              {assets.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs">{a.inventory_number}</td>
                  <td className="p-3">{a.name}</td>
                  <td className="p-3">{a.category_name}</td>
                  <td className="p-3">{a.department_name}</td>
                  <td className="p-3 text-right">{formatCurrency(a.cost)}</td>
                  <td className="p-3 text-right">{formatCurrency(a.accumulated_depreciation)}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(a.book_value)}</td>
                  <td className="p-3"><Badge className={STATUS_STYLE[a.status] || ''}>{a.status}</Badge></td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      {a.status === 'draft' && <Button size="sm" variant="ghost" title={t('commission') || 'Ishga tushirish'} onClick={() => commission(a)}><CheckCircle2 className="w-4 h-4" /></Button>}
                      <Button size="sm" variant="ghost" title={t('schedule') || 'Grafik'} onClick={() => openSchedule(a)}><CalendarClock className="w-4 h-4" /></Button>
                      {(a.status === 'in_service' || a.status === 'conserved') && <Button size="sm" variant="ghost" title={t('dispose') || 'Chiqarish'} onClick={() => dispose(a)}><LogOut className="w-4 h-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {showCreate && (
        <CreateAssetModal
          t={t} categories={categories} departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {showRun && run && (
        <RunSummaryModal t={t} run={run} formatCurrency={formatCurrency} busy={busy}
          onClose={() => setShowRun(false)} onPost={postRun} onReverse={reverseRun} />
      )}

      {schedule && (
        <ScheduleModal t={t} data={schedule} formatCurrency={formatCurrency} onClose={() => setSchedule(null)} />
      )}
    </div>
  );
}

// ---- Create form: NO account fields (§2.2). Bo'lim required (§2.3). ----
function CreateAssetModal({ t, categories, departments, onClose, onCreated }) {
  const [f, setF] = useState({
    name: '', category_id: '', department_id: '', serial_number: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    cost: '', salvage_value: '0', useful_life_months: '', vat_amount: '0',
    payment_method: 'credit', commission_now: true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const years = f.useful_life_months ? (Number(f.useful_life_months) / 12).toFixed(1) : null;

  const submit = async () => {
    if (!f.name || !f.category_id || !f.department_id || !f.cost || !f.useful_life_months) {
      toast.error(t('fill_required') || 'Majburiy maydonlarni to\'ldiring');
      return;
    }
    setSaving(true);
    try {
      await fa.createAsset({
        ...f,
        cost: Number(f.cost),
        salvage_value: Number(f.salvage_value || 0),
        useful_life_months: Number(f.useful_life_months),
        vat_amount: Number(f.vat_amount || 0),
      });
      toast.success(t('asset_created') || 'Aktiv yaratildi');
      onCreated();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  const inputCls = 'w-full h-9 rounded-md border border-slate-200 px-2 text-sm';
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('add_asset') || 'Aktiv qo\'shish'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={t('name') || 'Nomi'} required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('category') || 'Kategoriya'} required>
              <select className={inputCls} value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name_uz}</option>)}
              </select>
            </Field>
            <Field label={t('department') || 'Bo\'lim'} required>
              <select className={inputCls} value={f.department_id} onChange={(e) => set('department_id', e.target.value)}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name_uz}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('cost') || 'Qiymat'} required><Input type="number" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
            <Field label={t('salvage_value') || 'Likvidatsiya qiymati'}><Input type="number" value={f.salvage_value} onChange={(e) => set('salvage_value', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t('useful_life_months') || 'Xizmat muddati (oy)'}${years ? ` = ${years} ${t('years') || 'yil'}` : ''}`} required>
              <Input type="number" value={f.useful_life_months} onChange={(e) => set('useful_life_months', e.target.value)} />
            </Field>
            <Field label={t('vat') || 'QQS summasi'}><Input type="number" value={f.vat_amount} onChange={(e) => set('vat_amount', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('purchase_date') || 'Xarid sanasi'}><Input type="date" value={f.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} /></Field>
            <Field label={t('payment_method') || 'To\'lov usuli'}>
              <select className={inputCls} value={f.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
                <option value="credit">{t('credit') || 'Qarzga'}</option>
                <option value="cash">{t('cash') || 'Naqd'}</option>
                <option value="bank">{t('bank') || 'Bank'}</option>
              </select>
            </Field>
          </div>
          <Field label={t('serial_number') || 'Seriya raqami'}><Input value={f.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.commission_now} onChange={(e) => set('commission_now', e.target.checked)} />
            {t('commission_now') || 'Darhol foydalanishga topshirildi'}
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t('cancel') || 'Bekor qilish'}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('create') || 'Yaratish')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunSummaryModal({ t, run, formatCurrency, busy, onClose, onPost, onReverse }) {
  const pairs = Object.entries(run.totals_by_pair || {});
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t('depreciation_run') || 'Amortizatsiya reglamenti'} · {run.period} · <Badge>{run.status}</Badge></DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="text-sm">
            <div className="font-medium mb-1">{t('totals_by_pair') || 'Hisob juftlari bo\'yicha jami'}</div>
            {pairs.length === 0 && <div className="text-slate-400">—</div>}
            {pairs.map(([pair, amt]) => (
              <div key={pair} className="flex justify-between border-b py-1"><span className="font-mono">{pair}</span><span>{formatCurrency(amt)}</span></div>
            ))}
            <div className="flex justify-between pt-2 font-semibold"><span>{t('grand_total') || 'Jami'}</span><span>{formatCurrency(run.grand_total || 0)}</span></div>
          </div>
          {(run.lines || []).length > 0 && (
            <div className="text-sm">
              <div className="font-medium mb-1">{t('lines') || 'Qatorlar'} ({run.lines.length})</div>
              <table className="w-full">
                <tbody>
                  {run.lines.map((l, i) => (
                    <tr key={i} className="border-b"><td className="py-1 font-mono text-xs">{l.inventory_number}</td><td className="py-1">{l.name}</td><td className="py-1 font-mono text-xs">{l.debit_account}/{l.credit_account}</td><td className="py-1 text-right">{formatCurrency(l.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(run.skipped || []).length > 0 && (
            <div className="text-sm">
              <div className="font-medium mb-1 text-amber-700">{t('skipped') || 'O\'tkazilmaganlar'} ({run.skipped.length})</div>
              {run.skipped.map((s, i) => <div key={i} className="text-amber-700 text-xs">{s.inventory_number} — {s.reason}</div>)}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          {run.status === 'draft' && <Button onClick={onPost} disabled={busy} className="gap-1"><CheckCircle2 className="w-4 h-4" />{t('post') || 'O\'tkazish'}</Button>}
          {run.status === 'posted' && <Button onClick={onReverse} disabled={busy} variant="outline" className="gap-1"><RotateCcw className="w-4 h-4" />{t('reverse') || 'Revers'}</Button>}
          <Button variant="outline" onClick={onClose}>{t('close') || 'Yopish'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleModal({ t, data, formatCurrency, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('schedule') || 'Amortizatsiya grafigi'} · {data.asset.inventory_number}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b"><th className="py-1">{t('period') || 'Davr'}</th><th className="py-1 text-right">{t('amount') || 'Summa'}</th><th className="py-1 text-right">{t('accumulated') || 'Yig\'ilgan'}</th><th className="py-1 text-right">{t('book_value') || 'Qoldiq'}</th></tr></thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-b"><td className="py-1">{r.period}</td><td className="py-1 text-right">{formatCurrency(r.amount)}</td><td className="py-1 text-right">{formatCurrency(r.accumulated)}</td><td className="py-1 text-right">{formatCurrency(r.book_value)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
