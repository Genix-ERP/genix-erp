import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Building, FileText, Clock } from 'lucide-react';

const PAYMENT_TERMS = [
  'Immediate',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Net 90'
];

export default function PurchaseSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const purchase = settings.purchase || {};

  return (
    <div className="space-y-4">
      {/* Approval Workflow */}
      <SettingsSection
        title={t('approval_workflow')}
        description={t('approval_workflow_desc')}
        icon={ClipboardCheck}
        onReset={() => resetSection('purchase')}
        resetLabel={t('reset')}
      >
        <SettingsToggle
          label={t('enable_approval_workflow')}
          description={t('enable_approval_workflow_desc')}
          checked={purchase.approval?.workflow_enabled ?? false}
          onChange={(checked) => updateSetting('purchase.approval.workflow_enabled', checked)}
        />

        {purchase.approval?.workflow_enabled && (
          <div className="mt-4">
            <SettingsField label={t('approval_thresholds')} description={t('approval_thresholds_desc')}>
              <div className="space-y-3 mt-2">
                {(purchase.approval?.thresholds || []).map((threshold, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <span className="text-sm text-slate-600">{t('amount_above')}</span>
                      <Input
                        type="number"
                        min="0"
                        value={threshold.amount}
                        onChange={(e) => {
                          const newThresholds = [...(purchase.approval?.thresholds || [])];
                          newThresholds[index] = { ...newThresholds[index], amount: parseInt(e.target.value) || 0 };
                          updateSetting('purchase.approval.thresholds', newThresholds);
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-slate-600">{t('requires_approval_from')}</span>
                      <Select
                        value={threshold.approver_role}
                        onValueChange={(value) => {
                          const newThresholds = [...(purchase.approval?.thresholds || [])];
                          newThresholds[index] = { ...newThresholds[index], approver_role: value };
                          updateSetting('purchase.approval.thresholds', newThresholds);
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">{t('manager')}</SelectItem>
                          <SelectItem value="admin">{t('admin')}</SelectItem>
                          <SelectItem value="finance_manager">{t('finance_manager')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </SettingsField>
          </div>
        )}
      </SettingsSection>

      {/* Vendor Settings */}
      <SettingsSection
        title={t('vendor_settings')}
        description={t('vendor_settings_desc')}
        icon={Building}
      >
        <SettingsRow>
          <SettingsField label={t('default_vendor_payment_terms')}>
            <Select
              value={purchase.vendor?.default_payment_terms || 'Net 30'}
              onValueChange={(value) => updateSetting('purchase.vendor.default_payment_terms', value)}
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

        <div className="mt-4 space-y-3">
          <SettingsToggle
            label={t('enable_vendor_rating')}
            description={t('enable_vendor_rating_desc')}
            checked={purchase.vendor?.rating_enabled ?? true}
            onChange={(checked) => updateSetting('purchase.vendor.rating_enabled', checked)}
          />
          <SettingsToggle
            label={t('preferred_vendors_only')}
            description={t('preferred_vendors_only_desc')}
            checked={purchase.vendor?.preferred_vendors_only ?? false}
            onChange={(checked) => updateSetting('purchase.vendor.preferred_vendors_only', checked)}
          />
        </div>
      </SettingsSection>

      {/* RFQ Settings */}
      <SettingsSection
        title={t('rfq_settings')}
        description={t('rfq_settings_desc')}
        icon={FileText}
      >
        <SettingsRow>
          <SettingsField label={t('rfq_validity_days')}>
            <Input
              type="number"
              min="1"
              max="90"
              value={purchase.rfq?.validity_days || 15}
              onChange={(e) => updateSetting('purchase.rfq.validity_days', parseInt(e.target.value) || 15)}
            />
          </SettingsField>
        </SettingsRow>

        <div className="mt-4">
          <SettingsToggle
            label={t('auto_create_po_from_rfq')}
            description={t('auto_create_po_from_rfq_desc')}
            checked={purchase.rfq?.auto_create_po ?? false}
            onChange={(checked) => updateSetting('purchase.rfq.auto_create_po', checked)}
          />
        </div>
      </SettingsSection>

      {/* Lead Time Settings */}
      <SettingsSection
        title={t('lead_time_settings')}
        description={t('lead_time_settings_desc')}
        icon={Clock}
      >
        <SettingsRow>
          <SettingsField label={t('default_lead_time_days')}>
            <Input
              type="number"
              min="1"
              max="365"
              value={purchase.lead_time?.default_days || 7}
              onChange={(e) => updateSetting('purchase.lead_time.default_days', parseInt(e.target.value) || 7)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Blanket Orders */}
      <SettingsSection
        title={t('blanket_orders')}
        description={t('blanket_orders_desc')}
        icon={FileText}
      >
        <SettingsToggle
          label={t('enable_blanket_orders')}
          description={t('enable_blanket_orders_desc')}
          checked={purchase.blanket_orders?.enabled ?? false}
          onChange={(checked) => updateSetting('purchase.blanket_orders.enabled', checked)}
        />
      </SettingsSection>
    </div>
  );
}
