import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Tag, CreditCard, Receipt } from 'lucide-react';

const PRICING_STRATEGIES = [
  { value: 'standard', label: 'Standard Pricing', desc: 'Single price for all customers' },
  { value: 'tiered', label: 'Tiered Pricing', desc: 'Volume-based pricing tiers' },
  { value: 'customer_specific', label: 'Customer-Specific', desc: 'Individual pricing per customer' }
];

const PAYMENT_TERMS = [
  'Immediate',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Net 90'
];

export default function SalesSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const sales = settings.sales || {};

  return (
    <div className="space-y-4">
      {/* Quotation Settings */}
      <SettingsSection
        title={t('quotation_settings')}
        description={t('quotation_settings_desc')}
        icon={FileText}
        onReset={() => resetSection('sales')}
        resetLabel={t('reset')}
      >
        <SettingsRow>
          <SettingsField label={t('quotation_validity_days')} description={t('quotation_validity_days_desc')}>
            <Input
              type="number"
              min="1"
              max="365"
              value={sales.quotation?.validity_days || 30}
              onChange={(e) => updateSetting('sales.quotation.validity_days', parseInt(e.target.value) || 30)}
            />
          </SettingsField>
          <SettingsField label={t('approval_threshold')} description={t('approval_threshold_desc')}>
            <Input
              type="number"
              min="0"
              value={sales.quotation?.approval_threshold || 0}
              onChange={(e) => updateSetting('sales.quotation.approval_threshold', parseInt(e.target.value) || 0)}
            />
          </SettingsField>
        </SettingsRow>
        <div className="mt-4 space-y-3">
          <SettingsToggle
            label={t('auto_confirm_quotations')}
            description={t('auto_confirm_quotations_desc')}
            checked={sales.quotation?.auto_confirm ?? false}
            onChange={(checked) => updateSetting('sales.quotation.auto_confirm', checked)}
          />
          <SettingsToggle
            label={t('require_approval')}
            description={t('require_approval_desc')}
            checked={sales.quotation?.require_approval ?? false}
            onChange={(checked) => updateSetting('sales.quotation.require_approval', checked)}
          />
        </div>
      </SettingsSection>

      {/* Pricing Settings */}
      <SettingsSection
        title={t('pricing_settings')}
        description={t('pricing_settings_desc')}
        icon={Tag}
      >
        <SettingsRow>
          <SettingsField label={t('pricing_strategy')}>
            <Select
              value={sales.pricing?.strategy || 'standard'}
              onValueChange={(value) => updateSetting('sales.pricing.strategy', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_STRATEGIES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <div>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs text-slate-500">{s.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>

        <div className="mt-4 space-y-3">
          <SettingsToggle
            label={t('allow_discounts')}
            description={t('allow_discounts_desc')}
            checked={sales.pricing?.allow_discounts ?? true}
            onChange={(checked) => updateSetting('sales.pricing.allow_discounts', checked)}
          />
        </div>

        {sales.pricing?.allow_discounts && (
          <SettingsRow className="mt-4">
            <SettingsField label={t('max_discount_percent')}>
              <Input
                type="number"
                min="0"
                max="100"
                value={sales.pricing?.max_discount_percent || 20}
                onChange={(e) => updateSetting('sales.pricing.max_discount_percent', parseInt(e.target.value) || 20)}
              />
            </SettingsField>
            <SettingsField label={t('discount_approval_threshold')} description={t('discount_approval_threshold_desc')}>
              <Input
                type="number"
                min="0"
                max="100"
                value={sales.pricing?.discount_approval_threshold || 10}
                onChange={(e) => updateSetting('sales.pricing.discount_approval_threshold', parseInt(e.target.value) || 10)}
              />
            </SettingsField>
          </SettingsRow>
        )}
      </SettingsSection>

      {/* Payment Terms */}
      <SettingsSection
        title={t('payment_terms')}
        description={t('payment_terms_desc')}
        icon={CreditCard}
      >
        <SettingsRow>
          <SettingsField label={t('default_payment_terms')}>
            <Select
              value={sales.payment?.default_terms || 'Net 30'}
              onValueChange={(value) => updateSetting('sales.payment.default_terms', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map(term => (
                  <SelectItem key={term} value={term}>{term}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600 mb-2">{t('available_payment_terms')}:</p>
          <div className="flex flex-wrap gap-2">
            {(sales.payment?.available_terms || PAYMENT_TERMS).map(term => (
              <span key={term} className="px-2 py-1 bg-white border rounded text-xs">
                {term}
              </span>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* Invoice Settings */}
      <SettingsSection
        title={t('invoice_settings')}
        description={t('invoice_settings_desc')}
        icon={Receipt}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('auto_generate_invoice')}
            description={t('auto_generate_invoice_desc')}
            checked={sales.invoice?.auto_generate ?? true}
            onChange={(checked) => updateSetting('sales.invoice.auto_generate', checked)}
          />
          <SettingsToggle
            label={t('auto_send_invoice')}
            description={t('auto_send_invoice_desc')}
            checked={sales.invoice?.auto_send ?? false}
            onChange={(checked) => updateSetting('sales.invoice.auto_send', checked)}
          />
        </div>
      </SettingsSection>

      {/* Credit Settings */}
      <SettingsSection
        title={t('credit_settings')}
        description={t('credit_settings_desc')}
        icon={CreditCard}
      >
        <SettingsToggle
          label={t('enable_credit_limit')}
          description={t('enable_credit_limit_desc')}
          checked={sales.credit?.enable_credit_limit ?? false}
          onChange={(checked) => updateSetting('sales.credit.enable_credit_limit', checked)}
        />
        {sales.credit?.enable_credit_limit && (
          <SettingsRow className="mt-4">
            <SettingsField label={t('default_credit_limit')}>
              <Input
                type="number"
                min="0"
                value={sales.credit?.default_credit_limit || 0}
                onChange={(e) => updateSetting('sales.credit.default_credit_limit', parseInt(e.target.value) || 0)}
              />
            </SettingsField>
          </SettingsRow>
        )}
      </SettingsSection>
    </div>
  );
}
