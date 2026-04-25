import React, { useState, useEffect } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow } from './SettingsSection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from 'lucide-react';
import { hrService } from '@/api/services';

// Construction settings — assigns the three workflow roles (foreman /
// supervisor / engineer) at the tenant level. The Bosqichlar v2 page
// reads these to gate the per-row actions; the backend's
// resolveProjectRole helper falls back to these tenant-wide values
// when a project-team-level role isn't set.
//
// The legacy "Material Approver" single-approver concept has been
// replaced by the three-role workflow — one person to "approve" stages
// is no longer enough now that we have explicit foreman → supervisor →
// engineer hand-offs.
export default function ConstructionSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const construction = settings.construction || {};
  const roles = construction.roles || {};

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

  // Each of the three slots renders the same dropdown shape — keep it
  // in one helper so the role keys, copy, and emoji stay consistent.
  const ROLE_SLOTS = [
    {
      key:   'foreman',
      emoji: '👷',
      labelKey:       'role_foreman',
      descKey:        'role_foreman_setting_desc',
    },
    {
      key:   'supervisor',
      emoji: '🔍',
      labelKey:       'role_supervisor',
      descKey:        'role_supervisor_setting_desc',
    },
    {
      key:   'engineer',
      emoji: '🛠️',
      labelKey:       'role_engineer',
      descKey:        'role_engineer_setting_desc',
    },
  ];

  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('construction_roles_title') || 'Construction roles'}
        description={t('construction_roles_desc')
          || 'Assign the foreman, tech supervisor, and chief engineer for the construction module. The Stages page hides costs from the foreman, lets the tech supervisor confirm submitted works, and lets the chief engineer finalise (lock) confirmed works.'}
        icon={Users}
        onReset={() => resetSection('construction')}
        resetLabel={t('reset')}
      >
        {ROLE_SLOTS.map((slot) => {
          const userId = roles[`${slot.key}_user_id`] || '';
          return (
            <SettingsRow key={slot.key}>
              <SettingsField
                label={
                  <span className="inline-flex items-center gap-2">
                    <span className="text-base leading-none">{slot.emoji}</span>
                    {t(slot.labelKey)}
                  </span>
                }
                description={t(slot.descKey)}
              >
                <Select
                  value={userId || '__none__'}
                  onValueChange={(value) =>
                    updateSetting(`construction.roles.${slot.key}_user_id`, value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingEmployees ? t('loading') : t('select_user')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Users className="w-4 h-4" />
                        {t('not_assigned')}
                      </div>
                    </SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span>
                            {[emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.email}
                          </span>
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
          );
        })}
      </SettingsSection>
    </div>
  );
}
