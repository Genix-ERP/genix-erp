/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection } from './SettingsSection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Landmark, Loader2, Plus, Trash2 } from 'lucide-react';
import { fixedAssetsV2Service } from '@/api/services/fixedAssetsV2';

// Allowed account groups per field (§8.11). We fetch all leaf accounts once and
// filter client-side so the dropdown physically cannot offer a wrong account.
const ASSET_GROUPS = ['01', '04'];
const DEPR_GROUPS = ['02', '05'];
const EXPENSE_GROUPS = ['20', '23', '25', '27', '94', '08'];

const inGroups = (code, groups) => groups.includes(String(code || '').slice(0, 2));

// A <select> of chart accounts filtered to the allowed groups.
function AccountSelect({ value, onChange, accounts, groups, disabled, placeholder }) {
  const opts = accounts.filter((a) => inGroups(a.code, groups));
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-sm disabled:opacity-50"
    >
      <option value="">{placeholder || '—'}</option>
      {opts.map((a) => (
        <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
      ))}
    </select>
  );
}

export default function FixedAssetsMappingSettings() {
  const { language } = useLanguage();
  // t() returns the key on a miss; wrap so `t('x') || 'fallback'` shows the fallback.
  const { t: t0 } = useTranslation(language);
  const t = (k) => { const v = t0(k); return v === k ? '' : v; };

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mapping, accts] = await Promise.all([
        fixedAssetsV2Service.getMapping(),
        fixedAssetsV2Service.accountsForGroup(''), // all leaf accounts; filtered client-side
      ]);
      setCategories(mapping?.categories || []);
      setDepartments(mapping?.departments || []);
      setAccounts(accts || []);
    } catch {
      /* leave empty */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setCat = (i, patch) => setCategories((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setDep = (i, patch) => setDepartments((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const addCat = () => setCategories((cs) => [...cs, { code: '', name_uz: '', asset_account: '', depreciation_account: '', depreciable: true, is_active: true }]);
  const addDep = () => setDepartments((ds) => [...ds, { code: '', name_uz: '', expense_account: '', is_active: true }]);
  const rmCat = (i) => setCategories((cs) => cs.filter((_, idx) => idx !== i));
  const rmDep = (i) => setDepartments((ds) => ds.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    // Client-side guard mirrors the backend so we fail fast with a clear message.
    for (const c of categories) {
      if (!c.code || !c.name_uz || !c.asset_account) {
        toast.error(`${c.code || '?'}: ${t('mapping_row_incomplete') || 'kod, nom va aktiv hisobi majburiy'}`);
        return;
      }
      if (c.depreciable && !c.depreciation_account) {
        toast.error(`${c.code}: ${t('mapping_need_depr') || 'iznos hisobi majburiy'}`);
        return;
      }
    }
    for (const d of departments) {
      if (!d.code || !d.name_uz || !d.expense_account) {
        toast.error(`${d.code || '?'}: ${t('mapping_row_incomplete') || 'kod, nom va xarajat hisobi majburiy'}`);
        return;
      }
    }
    setSaving(true);
    try {
      await fixedAssetsV2Service.updateMapping({ categories, departments });
      toast.success(t('mapping_saved') || 'Maplashtirish saqlandi');
      load();
    } catch (e) {
      const err = e?.response?.data?.error;
      toast.error(err?.message_uz || err?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('loading') || 'Yuklanmoqda...'}
      </div>
    );
  }

  return (
    <div>
      <SettingsSection
        title={t('asset_categories') || 'Aktiv kategoriyalari'}
        description={t('asset_categories_desc') || 'Har bir tur uchun aktiv va iznos hisobi. Yer kabi turlar iznos qilinmaydi.'}
        icon={Landmark}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2">{t('code') || 'Kod'}</th>
                <th className="py-2 pr-2">{t('name') || 'Nomi'}</th>
                <th className="py-2 pr-2">{t('asset_account') || 'Aktiv hisobi'} (01/04)</th>
                <th className="py-2 pr-2">{t('depreciation_account') || 'Iznos hisobi'} (02/05)</th>
                <th className="py-2 pr-2">{t('depreciable') || 'Iznos'}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-2"><Input value={c.code} onChange={(e) => setCat(i, { code: e.target.value })} className="h-9 w-28" /></td>
                  <td className="py-2 pr-2"><Input value={c.name_uz} onChange={(e) => setCat(i, { name_uz: e.target.value })} className="h-9 min-w-40" /></td>
                  <td className="py-2 pr-2 min-w-52"><AccountSelect value={c.asset_account} onChange={(v) => setCat(i, { asset_account: v })} accounts={accounts} groups={ASSET_GROUPS} /></td>
                  <td className="py-2 pr-2 min-w-52"><AccountSelect value={c.depreciation_account} onChange={(v) => setCat(i, { depreciation_account: v })} accounts={accounts} groups={DEPR_GROUPS} disabled={!c.depreciable} placeholder={c.depreciable ? '—' : t('not_depreciable') || 'iznossiz'} /></td>
                  <td className="py-2 pr-2 text-center"><input type="checkbox" checked={!!c.depreciable} onChange={(e) => setCat(i, { depreciable: e.target.checked, depreciation_account: e.target.checked ? c.depreciation_account : '' })} /></td>
                  <td className="py-2"><button onClick={() => rmCat(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={addCat} className="mt-3 gap-1"><Plus className="w-4 h-4" />{t('add_category') || 'Kategoriya'}</Button>
      </SettingsSection>

      <SettingsSection
        title={t('asset_departments') || "Bo'limlar (xarajat markazlari)"}
        description={t('asset_departments_desc') || "Har bir bo'lim uchun amortizatsiya xarajati hisobi."}
        icon={Landmark}
        defaultOpen={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2">{t('code') || 'Kod'}</th>
                <th className="py-2 pr-2">{t('name') || 'Nomi'}</th>
                <th className="py-2 pr-2">{t('expense_account') || 'Xarajat hisobi'} (20/23/25/27/94/08)</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-2"><Input value={d.code} onChange={(e) => setDep(i, { code: e.target.value })} className="h-9 w-28" /></td>
                  <td className="py-2 pr-2"><Input value={d.name_uz} onChange={(e) => setDep(i, { name_uz: e.target.value })} className="h-9 min-w-40" /></td>
                  <td className="py-2 pr-2 min-w-52"><AccountSelect value={d.expense_account} onChange={(v) => setDep(i, { expense_account: v })} accounts={accounts} groups={EXPENSE_GROUPS} /></td>
                  <td className="py-2"><button onClick={() => rmDep(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={addDep} className="mt-3 gap-1"><Plus className="w-4 h-4" />{t('add_department') || "Bo'lim"}</Button>
      </SettingsSection>

      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t('save_settings') || 'Saqlash'}
        </Button>
      </div>
    </div>
  );
}
