import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, FileText, Percent, Coins, Landmark, BookOpen } from 'lucide-react';

const CHART_TEMPLATES = [
  { value: 'standard', label: 'Standard Chart of Accounts' },
  { value: 'IFRS', label: 'IFRS (International Financial Reporting Standards)' },
  { value: 'local_GAAP', label: 'Local GAAP (Uzbekistan)' }
];

const TAX_ROUNDING = [
  { value: 'line', label: 'Round per Line Item' },
  { value: 'document', label: 'Round per Document' }
];

const EXCHANGE_SOURCES = [
  { value: 'manual', label: 'Manual Entry' },
  { value: 'api', label: 'Automatic (API)' }
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

export default function FinanceSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const finance = settings.finance || {};

  return (
    <div className="space-y-4">
      {/* Fiscal Year */}
      <SettingsSection
        title={t('fiscal_year')}
        description={t('fiscal_year_desc')}
        icon={Calendar}
        onReset={() => resetSection('finance')}
        resetLabel={t('reset')}
      >
        <SettingsRow>
          <SettingsField label={t('fiscal_year_start_month')}>
            <Select
              value={String(finance.fiscal_year?.start_month || 1)}
              onValueChange={(value) => updateSetting('finance.fiscal_year.start_month', parseInt(value))}
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
              value={String(finance.fiscal_year?.start_day || 1)}
              onValueChange={(value) => updateSetting('finance.fiscal_year.start_day', parseInt(value))}
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

      {/* Chart of Accounts */}
      <SettingsSection
        title={t('chart_of_accounts')}
        description={t('chart_of_accounts_desc')}
        icon={FileText}
      >
        <SettingsRow>
          <SettingsField label={t('chart_template')}>
            <Select
              value={finance.accounts?.chart_template || 'standard'}
              onValueChange={(value) => updateSetting('finance.accounts.chart_template', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TEMPLATES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>

        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm font-medium text-slate-700 mb-3">{t('default_accounts')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">{t('sales_account')}</label>
              <Input
                value={finance.accounts?.default_sales_account || ''}
                onChange={(e) => updateSetting('finance.accounts.default_sales_account', e.target.value)}
                placeholder={t('enter_account_code')}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('purchase_account')}</label>
              <Input
                value={finance.accounts?.default_purchase_account || ''}
                onChange={(e) => updateSetting('finance.accounts.default_purchase_account', e.target.value)}
                placeholder={t('enter_account_code')}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('inventory_account')}</label>
              <Input
                value={finance.accounts?.default_inventory_account || ''}
                onChange={(e) => updateSetting('finance.accounts.default_inventory_account', e.target.value)}
                placeholder={t('enter_account_code')}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('receivables_account')}</label>
              <Input
                value={finance.accounts?.default_receivables_account || ''}
                onChange={(e) => updateSetting('finance.accounts.default_receivables_account', e.target.value)}
                placeholder={t('enter_account_code')}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('payables_account')}</label>
              <Input
                value={finance.accounts?.default_payables_account || ''}
                onChange={(e) => updateSetting('finance.accounts.default_payables_account', e.target.value)}
                placeholder={t('enter_account_code')}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Tax Configuration */}
      <SettingsSection
        title={t('tax_configuration')}
        description={t('tax_configuration_desc')}
        icon={Percent}
      >
        <SettingsRow>
          <SettingsField label={t('default_sales_tax_percent')}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={finance.tax?.default_sales_tax || 12}
              onChange={(e) => updateSetting('finance.tax.default_sales_tax', parseFloat(e.target.value) || 0)}
            />
          </SettingsField>
          <SettingsField label={t('default_purchase_tax_percent')}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={finance.tax?.default_purchase_tax || 12}
              onChange={(e) => updateSetting('finance.tax.default_purchase_tax', parseFloat(e.target.value) || 0)}
            />
          </SettingsField>
          <SettingsField label={t('tax_rounding')}>
            <Select
              value={finance.tax?.tax_rounding || 'line'}
              onValueChange={(value) => updateSetting('finance.tax.tax_rounding', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_ROUNDING.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>

        <div className="mt-4">
          <SettingsToggle
            label={t('price_includes_tax')}
            description={t('price_includes_tax_desc')}
            checked={finance.tax?.price_includes_tax ?? false}
            onChange={(checked) => updateSetting('finance.tax.price_includes_tax', checked)}
          />
        </div>
      </SettingsSection>

      {/* Multi-Currency */}
      <SettingsSection
        title={t('multi_currency')}
        description={t('multi_currency_desc')}
        icon={Coins}
      >
        <SettingsToggle
          label={t('enable_multi_currency')}
          description={t('enable_multi_currency_desc')}
          checked={finance.currency?.multi_currency_enabled ?? false}
          onChange={(checked) => updateSetting('finance.currency.multi_currency_enabled', checked)}
        />

        {finance.currency?.multi_currency_enabled && (
          <SettingsRow className="mt-4">
            <SettingsField label={t('base_currency')}>
              <Select
                value={finance.currency?.base_currency || 'UZS'}
                onValueChange={(value) => updateSetting('finance.currency.base_currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">UZS - O'zbek so'mi</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>
            <SettingsField label={t('exchange_rate_source')}>
              <Select
                value={finance.currency?.exchange_rate_source || 'manual'}
                onValueChange={(value) => updateSetting('finance.currency.exchange_rate_source', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXCHANGE_SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>
          </SettingsRow>
        )}
      </SettingsSection>

      {/* Banking */}
      <SettingsSection
        title={t('banking_settings')}
        description={t('banking_settings_desc')}
        icon={Landmark}
      >
        <SettingsRow>
          <SettingsField label={t('reconciliation_tolerance')} description={t('reconciliation_tolerance_desc')}>
            <Input
              type="number"
              min="0"
              value={finance.banking?.reconciliation_tolerance || 0}
              onChange={(e) => updateSetting('finance.banking.reconciliation_tolerance', parseFloat(e.target.value) || 0)}
            />
          </SettingsField>
        </SettingsRow>
        <div className="mt-4">
          <SettingsToggle
            label={t('auto_match_transactions')}
            description={t('auto_match_transactions_desc')}
            checked={finance.banking?.auto_match_transactions ?? true}
            onChange={(checked) => updateSetting('finance.banking.auto_match_transactions', checked)}
          />
        </div>
      </SettingsSection>

      {/* Journal Entries */}
      <SettingsSection
        title={t('journal_entries')}
        description={t('journal_entries_desc')}
        icon={BookOpen}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('auto_post_journal_entries')}
            description={t('auto_post_journal_entries_desc')}
            checked={finance.journal?.auto_post_entries ?? false}
            onChange={(checked) => updateSetting('finance.journal.auto_post_entries', checked)}
          />
          <SettingsToggle
            label={t('require_journal_approval')}
            description={t('require_journal_approval_desc')}
            checked={finance.journal?.require_approval ?? true}
            onChange={(checked) => updateSetting('finance.journal.require_approval', checked)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
