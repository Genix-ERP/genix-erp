import React, { useState, useEffect } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Users } from 'lucide-react';
import { hrService } from '@/api/services';

export default function ConstructionSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const construction = settings.construction || {};
  const materialApproval = construction.material_approval || {};

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    setLoadingEmployees(true);
    hrService.listEmployees({ limit: 200, sort: 'first_name' })
      .then(res => {
        const data = res?.data || res || [];
        setEmployees(Array.isArray(data) ? data.filter(e => e.status === 'active' || !e.status) : []);
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, []);

  return (
    <div className="space-y-4">
      {/* Material Approval Settings */}
      <SettingsSection
        title={t('material_approval_settings')}
        description={t('material_approval_settings_desc')}
        icon={ShieldCheck}
        onReset={() => resetSection('construction')}
        resetLabel={t('reset')}
      >
        <div className="mb-4">
          <SettingsToggle
            label={t('require_material_approval')}
            description={t('require_material_approval_desc')}
            checked={materialApproval.require_approval !== false}
            onChange={(checked) => updateSetting('construction.material_approval.require_approval', checked)}
          />
        </div>

        <SettingsRow>
          <SettingsField label={t('material_approver')} description={t('material_approver_desc')}>
            <Select
              value={materialApproval.approver_user_id || ''}
              onValueChange={(value) => updateSetting('construction.material_approval.approver_user_id', value === '__none__' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingEmployees ? t('loading') : (t('select_approver'))} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Users className="w-4 h-4" />
                    {t('no_approver_set')}
                  </div>
                </SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>{[emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.email}</span>
                      {emp.job_position_name && (
                        <span className="text-xs text-slate-400">— {emp.job_position_name}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
