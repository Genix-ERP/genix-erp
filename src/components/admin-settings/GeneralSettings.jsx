import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsDivider } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Calendar } from 'lucide-react';

const TIMEZONES = [
  { value: 'Asia/Tashkent', label: 'Tashkent (UTC+5)' },
  { value: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
  { value: 'America/New_York', label: 'New York (UTC-5)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' }
];

const CURRENCIES = [
  { value: 'UZS', label: "UZS - O'zbek so'mi", symbol: "so'm" },
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'RUB', label: 'RUB - Russian Ruble', symbol: '₽' }
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' }
];

const TIME_FORMATS = [
  { value: '24h', label: '24-hour (14:30)' },
  { value: '12h', label: '12-hour (2:30 PM)' }
];

export default function GeneralSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const MONTHS = [
    { value: 1, label: t('january') },
    { value: 2, label: t('february') },
    { value: 3, label: t('march') },
    { value: 4, label: t('april') },
    { value: 5, label: t('may') },
    { value: 6, label: t('june') },
    { value: 7, label: t('july') },
    { value: 8, label: t('august') },
    { value: 9, label: t('september') },
    { value: 10, label: t('october') },
    { value: 11, label: t('november') },
    { value: 12, label: t('december') }
  ];

  const general = settings.general || {};

  return (
    <div className="space-y-4">
      {/* Localization */}
      <SettingsSection
        title={t('localization')}
        description={t('localization_desc')}
        icon={Globe}
      >
        <SettingsRow>
          <SettingsField label={t('language')}>
            <Select
              value={general.localization?.language || 'uz'}
              onValueChange={(value) => updateSetting('general.localization.language', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uz">O'zbek</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('timezone')}>
            <Select
              value={general.localization?.timezone || 'Asia/Tashkent'}
              onValueChange={(value) => updateSetting('general.localization.timezone', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('currency')}>
            <Select
              value={general.localization?.currency || 'UZS'}
              onValueChange={(value) => {
                const currency = CURRENCIES.find(c => c.value === value);
                updateSetting('general.localization.currency', value);
                if (currency) {
                  updateSetting('general.localization.currency_symbol', currency.symbol);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>

        <SettingsRow>
          <SettingsField label={t('date_format')}>
            <Select
              value={general.localization?.date_format || 'DD/MM/YYYY'}
              onValueChange={(value) => updateSetting('general.localization.date_format', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('time_format')}>
            <Select
              value={general.localization?.time_format || '24h'}
              onValueChange={(value) => updateSetting('general.localization.time_format', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FORMATS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('currency_position')}>
            <Select
              value={general.localization?.currency_position || 'after'}
              onValueChange={(value) => updateSetting('general.localization.currency_position', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">{t('before_amount')} ($100)</SelectItem>
                <SelectItem value="after">{t('after_amount')} (100$)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>

        <SettingsRow>
          <SettingsField label={t('decimal_separator')}>
            <Select
              value={general.localization?.decimal_separator || ','}
              onValueChange={(value) => updateSetting('general.localization.decimal_separator', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma (1.234,56)</SelectItem>
                <SelectItem value=".">Dot (1,234.56)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('thousands_separator')}>
            <Select
              value={general.localization?.thousands_separator || ' '}
              onValueChange={(value) => updateSetting('general.localization.thousands_separator', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Space (1 234 567)</SelectItem>
                <SelectItem value=",">Comma (1,234,567)</SelectItem>
                <SelectItem value=".">Dot (1.234.567)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Fiscal Settings */}
      <SettingsSection
        title={t('fiscal_settings')}
        description={t('fiscal_settings_desc')}
        icon={Calendar}
      >
        <SettingsRow>
          <SettingsField label={t('fiscal_year_start_month')}>
            <Select
              value={String(general.fiscal?.fiscal_year_start_month || 1)}
              onValueChange={(value) => updateSetting('general.fiscal.fiscal_year_start_month', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('fiscal_year_start_day')}>
            <Select
              value={String(general.fiscal?.fiscal_year_start_day || 1)}
              onValueChange={(value) => updateSetting('general.fiscal.fiscal_year_start_day', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(28)].map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
