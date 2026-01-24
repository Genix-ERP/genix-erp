import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, GitBranch, Users, Copy } from 'lucide-react';

export default function CRMSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const crm = settings.crm || {};

  const ASSIGNMENT_METHODS = [
    { value: 'manual', label: t('manual_assignment'), desc: t('manual_assignment_desc') },
    { value: 'round_robin', label: t('round_robin'), desc: t('round_robin_desc') },
    { value: 'load_balanced', label: t('load_balanced'), desc: t('load_balanced_desc') }
  ];

  const DUPLICATE_CHECK_FIELDS = [
    { value: 'email', label: t('email_address') },
    { value: 'phone', label: t('phone_number') },
    { value: 'company_name', label: t('company_name') }
  ];

  const DEFAULT_STAGES = [
    t('stage_new'),
    t('stage_qualified'),
    t('stage_proposal'),
    t('stage_negotiation'),
    t('stage_won'),
    t('stage_lost')
  ];

  return (
    <div className="space-y-4">
      {/* Lead Scoring */}
      <SettingsSection
        title={t('lead_scoring')}
        description={t('lead_scoring_desc')}
        icon={Target}
        onReset={() => resetSection('crm')}
        resetLabel={t('reset')}
      >
        <SettingsToggle
          label={t('enable_lead_scoring')}
          description={t('enable_lead_scoring_desc')}
          checked={crm.lead_scoring?.enabled ?? false}
          onChange={(checked) => updateSetting('crm.lead_scoring.enabled', checked)}
        />
        {crm.lead_scoring?.enabled && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              {t('lead_scoring_rules_info')}
            </p>
          </div>
        )}
      </SettingsSection>

      {/* Pipeline Settings */}
      <SettingsSection
        title={t('pipeline_settings')}
        description={t('pipeline_settings_desc')}
        icon={GitBranch}
      >
        <SettingsToggle
          label={t('auto_create_opportunity')}
          description={t('auto_create_opportunity_desc')}
          checked={crm.pipeline?.auto_create_opportunity ?? true}
          onChange={(checked) => updateSetting('crm.pipeline.auto_create_opportunity', checked)}
        />
        <div className="mt-4">
          <SettingsField label={t('default_pipeline_stages')} description={t('default_pipeline_stages_desc')}>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {(crm.pipeline?.default_stages || DEFAULT_STAGES).map((stage, index) => (
                  <div key={index} className="flex items-center gap-1 px-3 py-1 bg-white border rounded-full text-sm">
                    <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                      {index + 1}
                    </span>
                    {stage}
                  </div>
                ))}
              </div>
            </div>
          </SettingsField>
        </div>
      </SettingsSection>

      {/* Lead Assignment */}
      <SettingsSection
        title={t('lead_assignment')}
        description={t('lead_assignment_desc')}
        icon={Users}
      >
        <SettingsToggle
          label={t('auto_assign_leads')}
          description={t('auto_assign_leads_desc')}
          checked={crm.assignment?.auto_assign_leads ?? false}
          onChange={(checked) => updateSetting('crm.assignment.auto_assign_leads', checked)}
        />

        {crm.assignment?.auto_assign_leads && (
          <SettingsRow className="mt-4">
            <SettingsField label={t('assignment_method')}>
              <Select
                value={crm.assignment?.assignment_method || 'manual'}
                onValueChange={(value) => updateSetting('crm.assignment.assignment_method', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <div>
                        <div className="font-medium">{m.label}</div>
                        <div className="text-xs text-slate-500">{m.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>
          </SettingsRow>
        )}

        <SettingsRow className="mt-4">
          <SettingsField label={t('follow_up_reminder_days')} description={t('follow_up_reminder_days_desc')}>
            <Input
              type="number"
              min="1"
              max="30"
              value={crm.assignment?.follow_up_reminder_days || 3}
              onChange={(e) => updateSetting('crm.assignment.follow_up_reminder_days', parseInt(e.target.value) || 3)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Duplicate Detection */}
      <SettingsSection
        title={t('duplicate_detection')}
        description={t('duplicate_detection_desc')}
        icon={Copy}
      >
        <SettingsToggle
          label={t('enable_duplicate_detection')}
          description={t('enable_duplicate_detection_desc')}
          checked={crm.duplicate_detection?.enabled ?? true}
          onChange={(checked) => updateSetting('crm.duplicate_detection.enabled', checked)}
        />

        {crm.duplicate_detection?.enabled && (
          <div className="mt-4">
            <SettingsField label={t('check_fields')} description={t('check_fields_desc')}>
              <div className="flex flex-wrap gap-2 mt-2">
                {DUPLICATE_CHECK_FIELDS.map(field => {
                  const isChecked = (crm.duplicate_detection?.check_fields || ['email', 'phone']).includes(field.value);
                  return (
                    <label
                      key={field.value}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentFields = crm.duplicate_detection?.check_fields || ['email', 'phone'];
                          const newFields = e.target.checked
                            ? [...currentFields, field.value]
                            : currentFields.filter(f => f !== field.value);
                          updateSetting('crm.duplicate_detection.check_fields', newFields);
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">{field.label}</span>
                    </label>
                  );
                })}
              </div>
            </SettingsField>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
