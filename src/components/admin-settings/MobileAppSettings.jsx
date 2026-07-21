/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Smartphone, Apple, Loader2 } from 'lucide-react';
import { adminSettingsService } from '@/api/services/adminSettings';

const PLATFORMS = [
  { key: 'android', label: 'Android', icon: Smartphone, urlHint: 'Play Store yoki to‘g‘ridan-to‘g‘ri APK havolasi' },
  { key: 'ios', label: 'iOS', icon: Apple, urlHint: 'App Store havolasi' },
];

const EMPTY = { latest_version: '', min_version: '', update_url: '', release_notes: '', force_update: false, is_active: true };

// Very small semver check for the two version inputs (major.minor.patch, with
// an optional leading v and pre-release suffix). Mirrors the backend parser's
// leniency — we only block obviously-wrong input.
const isVersionish = (v) => /^v?\d+(\.\d+){0,2}([-+].*)?$/i.test(String(v || '').trim());

// One editable card per platform.
function PlatformCard({ platform, initial, t }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const latest = form.latest_version.trim();
    const min = form.min_version.trim();
    if (!isVersionish(latest) || !isVersionish(min)) {
      toast.error(t('mobile_invalid_version') || 'Versiya formati noto‘g‘ri (masalan 1.4.2)');
      return;
    }
    setSaving(true);
    try {
      await adminSettingsService.updateMobileVersion(platform.key, {
        latest_version: latest,
        min_version: min,
        update_url: form.update_url.trim(),
        release_notes: form.release_notes.trim(),
        force_update: !!form.force_update,
        is_active: !!form.is_active,
      });
      toast.success(t('mobile_version_saved') || `${platform.label} versiyasi saqlandi`);
    } catch (e) {
      // The backend rejects min_version > latest_version, etc.
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection title={platform.label} icon={platform.icon} defaultOpen={platform.key === 'android'}>
      <SettingsRow>
        <SettingsField
          label={t('mobile_latest_version') || 'Eng so‘nggi versiya'}
          description={t('mobile_latest_hint') || 'Bundan pastdagilarga yangilanish taklif qilinadi'}
          required
        >
          <Input value={form.latest_version} onChange={(e) => set('latest_version', e.target.value)} placeholder="1.4.2" />
        </SettingsField>
        <SettingsField
          label={t('mobile_min_version') || 'Minimal versiya'}
          description={t('mobile_min_hint') || 'Bundan pastdagilar majburiy yangilanadi'}
          required
        >
          <Input value={form.min_version} onChange={(e) => set('min_version', e.target.value)} placeholder="1.0.0" />
        </SettingsField>
      </SettingsRow>

      <SettingsField label={t('mobile_update_url') || 'Yangilash havolasi'} description={platform.urlHint}>
        <Input value={form.update_url} onChange={(e) => set('update_url', e.target.value)} placeholder="https://..." autoComplete="off" />
      </SettingsField>

      <SettingsField label={t('mobile_release_notes') || 'Yangilanish izohi (ixtiyoriy)'} className="mt-4">
        <Textarea rows={3} value={form.release_notes} onChange={(e) => set('release_notes', e.target.value)} placeholder={t('mobile_release_notes_ph') || 'Nima yangilandi...'} />
      </SettingsField>

      <div className="mt-4 space-y-2">
        <SettingsToggle
          label={t('mobile_force_update') || 'Majburiy yangilash'}
          description={t('mobile_force_update_hint') || 'Yoqilsa, barcha foydalanuvchilar (versiyadan qat‘i nazar) yangilashi shart'}
          checked={form.force_update}
          onChange={(v) => set('force_update', v)}
        />
        <SettingsToggle
          label={t('mobile_gate_active') || 'Faol'}
          description={t('mobile_gate_active_hint') || 'O‘chirilsa, ilova hech qanday yangilanish talab qilmaydi'}
          checked={form.is_active}
          onChange={(v) => set('is_active', v)}
        />
      </div>

      <div className="mt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t('save_settings') || 'Saqlash'}
        </Button>
      </div>
    </SettingsSection>
  );
}

// MobileAppSettings — global mobile-app update gate. The mobile app checks
// GET /mobile/version on launch; these values decide whether it offers or
// forces an update. Global config (one app for all tenants), system-admin only.
export default function MobileAppSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [byPlatform, setByPlatform] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await adminSettingsService.getMobileVersions();
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => { map[r.platform] = r; });
      setByPlatform(map);
    } catch {
      /* leave empty -> cards render with defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      <p className="text-sm text-slate-500 mb-4">
        {t('mobile_settings_intro') || 'Mobil ilova ochilganda versiyani tekshiradi va shu yerdagi sozlamalarga qarab yangilanishni taklif qiladi yoki majburiy qiladi.'}
      </p>
      {PLATFORMS.map((p) => (
        <PlatformCard key={p.key} platform={p} initial={byPlatform[p.key] || {}} t={t} />
      ))}
    </div>
  );
}
