import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle, SettingsDivider } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Receipt, Clock, MapPin, Wallet } from 'lucide-react';

const PAY_PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' }
];

export default function HRSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const hr = settings.hr || {};

  return (
    <div className="space-y-4">
      {/* Leave Management */}
      <SettingsSection
        title={t('leave_management')}
        description={t('leave_management_desc')}
        icon={Calendar}
        onReset={() => resetSection('hr')}
        resetLabel={t('reset')}
      >
        <SettingsToggle
          label={t('require_leave_approval')}
          description={t('require_leave_approval_desc')}
          checked={hr.leave?.approval_required ?? true}
          onChange={(checked) => updateSetting('hr.leave.approval_required', checked)}
        />

        <SettingsDivider label={t('leave_types')} />

        <div className="space-y-3">
          {(hr.leave?.types || []).map((leaveType, index) => (
            <div key={leaveType.id} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-slate-800">{leaveType.name}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500">{t('days_per_year')}</label>
                  <Input
                    type="number"
                    min="0"
                    value={leaveType.days_per_year}
                    onChange={(e) => {
                      const newTypes = [...(hr.leave?.types || [])];
                      newTypes[index] = { ...newTypes[index], days_per_year: parseInt(e.target.value) || 0 };
                      updateSetting('hr.leave.types', newTypes);
                    }}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    checked={leaveType.carry_forward}
                    onChange={(e) => {
                      const newTypes = [...(hr.leave?.types || [])];
                      newTypes[index] = { ...newTypes[index], carry_forward: e.target.checked };
                      updateSetting('hr.leave.types', newTypes);
                    }}
                    className="w-4 h-4"
                  />
                  <label className="text-sm">{t('allow_carry_forward')}</label>
                </div>
                {leaveType.carry_forward && (
                  <div>
                    <label className="text-xs text-slate-500">{t('max_carry_forward')}</label>
                    <Input
                      type="number"
                      min="0"
                      value={leaveType.max_carry_forward}
                      onChange={(e) => {
                        const newTypes = [...(hr.leave?.types || [])];
                        newTypes[index] = { ...newTypes[index], max_carry_forward: parseInt(e.target.value) || 0 };
                        updateSetting('hr.leave.types', newTypes);
                      }}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Expense Settings */}
      <SettingsSection
        title={t('expense_settings')}
        description={t('expense_settings_desc')}
        icon={Receipt}
      >
        <SettingsRow>
          <SettingsField label={t('auto_approval_limit')} description={t('auto_approval_limit_desc')}>
            <Input
              type="number"
              min="0"
              value={hr.expense?.auto_approval_limit || 100000}
              onChange={(e) => updateSetting('hr.expense.auto_approval_limit', parseInt(e.target.value) || 0)}
            />
          </SettingsField>
        </SettingsRow>

        <SettingsDivider label={t('expense_categories')} />

        <div className="space-y-2">
          {(hr.expense?.categories || []).map((category, index) => (
            <div key={category.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium">{category.name}</span>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={category.approval_required}
                  onChange={(e) => {
                    const newCategories = [...(hr.expense?.categories || [])];
                    newCategories[index] = { ...newCategories[index], approval_required: e.target.checked };
                    updateSetting('hr.expense.categories', newCategories);
                  }}
                  className="w-4 h-4"
                />
                <label className="text-xs text-slate-500">{t('requires_approval')}</label>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Work Hours */}
      <SettingsSection
        title={t('work_hours')}
        description={t('work_hours_desc')}
        icon={Clock}
      >
        <SettingsRow>
          <SettingsField label={t('hours_per_day')}>
            <Input
              type="number"
              min="1"
              max="24"
              value={hr.work?.hours_per_day || 8}
              onChange={(e) => updateSetting('hr.work.hours_per_day', parseInt(e.target.value) || 8)}
            />
          </SettingsField>
          <SettingsField label={t('days_per_week')}>
            <Input
              type="number"
              min="1"
              max="7"
              value={hr.work?.days_per_week || 5}
              onChange={(e) => updateSetting('hr.work.days_per_week', parseInt(e.target.value) || 5)}
            />
          </SettingsField>
          <SettingsField label={t('overtime_multiplier')}>
            <Input
              type="number"
              min="1"
              max="3"
              step="0.5"
              value={hr.work?.overtime_multiplier || 1.5}
              onChange={(e) => updateSetting('hr.work.overtime_multiplier', parseFloat(e.target.value) || 1.5)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Attendance Tracking */}
      <SettingsSection
        title={t('attendance_tracking')}
        description={t('attendance_tracking_desc')}
        icon={MapPin}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('enable_attendance_tracking')}
            description={t('enable_attendance_tracking_desc')}
            checked={hr.attendance?.tracking_enabled ?? false}
            onChange={(checked) => updateSetting('hr.attendance.tracking_enabled', checked)}
          />
          {hr.attendance?.tracking_enabled && (
            <SettingsToggle
              label={t('require_geolocation')}
              description={t('require_geolocation_desc')}
              checked={hr.attendance?.geolocation_required ?? false}
              onChange={(checked) => updateSetting('hr.attendance.geolocation_required', checked)}
            />
          )}
        </div>
      </SettingsSection>

      {/* Payroll Settings */}
      <SettingsSection
        title={t('payroll_settings')}
        description={t('payroll_settings_desc')}
        icon={Wallet}
      >
        <SettingsRow>
          <SettingsField label={t('pay_period')}>
            <Select
              value={hr.payroll?.pay_period || 'monthly'}
              onValueChange={(value) => updateSetting('hr.payroll.pay_period', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAY_PERIODS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('payroll_currency')}>
            <Select
              value={hr.payroll?.currency || 'UZS'}
              onValueChange={(value) => updateSetting('hr.payroll.currency', value)}
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
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
