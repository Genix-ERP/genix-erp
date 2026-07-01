import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, KeyRound, Trash2, Eye, EyeOff } from 'lucide-react';
import { adminSettingsService } from '@/api/services/adminSettings';

// Model choices per provider for the dropdown. The receipt scanner needs a
// vision-capable model; these are all vision-capable.
const MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4-turbo'],
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
};

// AISettings — tenant-wide AI provider config (used by the purchase-receipt
// scanner and any future AI features). The user supplies their own API key and
// picks a provider + model. The saved key is never sent back to the browser in
// full; the backend returns only a masked preview.
export default function AISettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await adminSettingsService.getAISettings();
        if (cancelled) return;
        const p = (s?.provider === 'anthropic') ? 'anthropic' : 'openai';
        setProvider(p);
        setModel(s?.model || MODELS[p][0]);
        setEndpoint(s?.endpoint || '');
        setHasKey(!!s?.has_key);
        setKeyPreview(s?.key_preview || '');
      } catch {
        /* leave defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When the provider changes, suggest a default model if the field is empty.
  const onProviderChange = (p) => {
    setProvider(p);
    if (!model.trim()) setModel(MODELS[p][0]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // api_key blank → backend keeps the existing stored key.
      await adminSettingsService.updateAISettings({ provider, model: model.trim(), endpoint: endpoint.trim(), api_key: apiKey.trim() });
      toast.success(t('ai_settings_saved') || 'AI sozlamalari saqlandi');
      if (apiKey.trim()) {
        setHasKey(true);
        // Build a local preview so the UI reflects the new key immediately.
        const k = apiKey.trim();
        setKeyPreview(k.length <= 8 ? '•'.repeat(k.length) : `${k.slice(0, 3)}…${k.slice(-4)}`);
        setApiKey('');
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async () => {
    setSaving(true);
    try {
      await adminSettingsService.updateAISettings({ provider, model: model.trim(), endpoint: endpoint.trim(), clear_key: true });
      setHasKey(false);
      setKeyPreview('');
      setApiKey('');
      toast.success(t('ai_key_cleared') || 'Kalit o\'chirildi');
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SettingsSection
        title={t('ai_settings') || 'AI sozlamalari'}
        description={t('ai_settings_desc') || "Chek/hujjatlarni skanerlash kabi AI funksiyalari uchun o'z API kalitingizni kiriting"}
        icon={Sparkles}
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('loading') || 'Yuklanmoqda...'}
          </div>
        ) : (
          <>
            <SettingsRow>
              <SettingsField label={t('ai_provider') || 'Provayder'}>
                <Select value={provider} onValueChange={onProviderChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>

              <SettingsField label={t('ai_model') || 'Model'}>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  list="ai-model-suggestions"
                  placeholder={MODELS[provider][0]}
                />
                <datalist id="ai-model-suggestions">
                  {[...MODELS[provider], 'gemini-2.5-flash', 'gemini-2.5-pro'].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </SettingsField>
            </SettingsRow>

            <SettingsField
              label={t('ai_endpoint') || 'Endpoint (ixtiyoriy)'}
              description={t('ai_endpoint_hint') || "Bo'sh qoldirsangiz provayderning standart manzili ishlatiladi. OpenAI-mos endpoint (masalan Google Gemini yoki Azure) uchun to'liq URL kiriting."}
            >
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
                autoComplete="off"
              />
            </SettingsField>

            <SettingsField
              label={t('api_key') || 'API kalit'}
              description={hasKey
                ? `${t('ai_key_saved') || 'Saqlangan kalit'}: ${keyPreview} — ${t('ai_key_leave_blank') || 'o\'zgartirmaslik uchun bo\'sh qoldiring'}`
                : (t('ai_key_hint') || 'Provayder hisobingizdan olingan maxfiy kalit')}
            >
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showKey ? 'text' : 'password'}
                    className="pl-9 pr-9"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasKey ? '••••••••••••' : (provider === 'anthropic' ? 'sk-ant-...' : 'sk-...')}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {hasKey && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearKey}
                    disabled={saving}
                    className="text-slate-500 hover:text-red-600 hover:border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t('clear') || 'O\'chirish'}
                  </Button>
                )}
              </div>
            </SettingsField>

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
          </>
        )}
      </SettingsSection>
    </div>
  );
}
