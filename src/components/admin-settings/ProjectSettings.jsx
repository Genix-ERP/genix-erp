import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Clock, ListTodo, GitBranch } from 'lucide-react';

// Arrays are defined inside component to use translations

export default function ProjectSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const projects = settings.projects || {};

  const BILLING_TYPES = [
    { value: 'fixed_price', label: t('fixed_price'), desc: t('fixed_price_desc') },
    { value: 'time_materials', label: t('time_and_materials'), desc: t('time_and_materials_desc') },
    { value: 'milestone', label: t('milestone_based'), desc: t('milestone_based_desc') }
  ];

  const DEFAULT_PROJECT_STAGES = [
    t('project_stage_planning'),
    t('project_stage_in_progress'),
    t('project_stage_review'),
    t('project_stage_completed'),
    t('project_stage_on_hold'),
    t('project_stage_cancelled')
  ];

  return (
    <div className="space-y-4">
      {/* Billing Settings */}
      <SettingsSection
        title={t('billing_settings')}
        description={t('billing_settings_desc')}
        icon={Receipt}
        onReset={() => resetSection('projects')}
        resetLabel={t('reset')}
      >
        <SettingsRow>
          <SettingsField label={t('default_billing_type')}>
            <Select
              value={projects.billing?.default_type || 'time_materials'}
              onValueChange={(value) => updateSetting('projects.billing.default_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_TYPES.map(b => (
                  <SelectItem key={b.value} value={b.value}>
                    <div>
                      <div className="font-medium">{b.label}</div>
                      <div className="text-xs text-slate-500">{b.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('default_hourly_rate')}>
            <Input
              type="number"
              min="0"
              value={projects.billing?.default_hourly_rate || 0}
              onChange={(e) => updateSetting('projects.billing.default_hourly_rate', parseFloat(e.target.value) || 0)}
            />
          </SettingsField>
        </SettingsRow>

        <div className="mt-4">
          <SettingsToggle
            label={t('allow_overtime_billing')}
            description={t('allow_overtime_billing_desc')}
            checked={projects.billing?.allow_overtime_billing ?? true}
            onChange={(checked) => updateSetting('projects.billing.allow_overtime_billing', checked)}
          />
        </div>
      </SettingsSection>

      {/* Timesheet Settings */}
      <SettingsSection
        title={t('timesheet_settings')}
        description={t('timesheet_settings_desc')}
        icon={Clock}
      >
        <SettingsToggle
          label={t('require_timesheet_approval')}
          description={t('require_timesheet_approval_desc')}
          checked={projects.timesheet?.approval_required ?? true}
          onChange={(checked) => updateSetting('projects.timesheet.approval_required', checked)}
        />

        <SettingsRow className="mt-4">
          <SettingsField label={t('max_hours_per_day')}>
            <Input
              type="number"
              min="1"
              max="24"
              value={projects.timesheet?.max_hours_per_day || 12}
              onChange={(e) => updateSetting('projects.timesheet.max_hours_per_day', parseInt(e.target.value) || 12)}
            />
          </SettingsField>
        </SettingsRow>

        <div className="mt-4">
          <SettingsToggle
            label={t('enable_timesheet_reminder')}
            description={t('enable_timesheet_reminder_desc')}
            checked={projects.timesheet?.reminder_enabled ?? true}
            onChange={(checked) => updateSetting('projects.timesheet.reminder_enabled', checked)}
          />
        </div>
      </SettingsSection>

      {/* Task Settings */}
      <SettingsSection
        title={t('task_settings')}
        description={t('task_settings_desc')}
        icon={ListTodo}
      >
        <SettingsRow>
          <SettingsField label={t('default_task_hours')}>
            <Input
              type="number"
              min="1"
              max="100"
              value={projects.task?.default_hours || 8}
              onChange={(e) => updateSetting('projects.task.default_hours', parseInt(e.target.value) || 8)}
            />
          </SettingsField>
        </SettingsRow>

        <div className="mt-4">
          <SettingsToggle
            label={t('allow_subtasks')}
            description={t('allow_subtasks_desc')}
            checked={projects.task?.allow_subtasks ?? true}
            onChange={(checked) => updateSetting('projects.task.allow_subtasks', checked)}
          />
        </div>
      </SettingsSection>

      {/* Project Stages */}
      <SettingsSection
        title={t('project_stages')}
        description={t('project_stages_desc')}
        icon={GitBranch}
      >
        <SettingsField label={t('default_project_stages')} description={t('default_project_stages_desc')}>
          <div className="p-4 bg-slate-50 rounded-lg mt-2">
            <div className="flex flex-wrap gap-2">
              {(projects.stages || DEFAULT_PROJECT_STAGES).map((stage, index) => (
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
      </SettingsSection>
    </div>
  );
}
