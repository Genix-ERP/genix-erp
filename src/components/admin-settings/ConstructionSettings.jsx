import React, { useState, useEffect, useMemo } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow } from './SettingsSection';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Users, Search } from 'lucide-react';
import { hrService } from '@/api/services';

// Construction settings — assigns the three workflow roles (foreman /
// supervisor / engineer) at the tenant level. Each role accepts ONE
// OR MORE employees. Renders as a scrollable checkbox list per role
// so admins can toggle several people without re-opening a dropdown.
//
// Storage shape:
//   construction.roles.foreman_user_ids:    ["uuid1","uuid2",...]
//   construction.roles.supervisor_user_ids: ["uuid1",...]
//   construction.roles.engineer_user_ids:   ["uuid1",...]
//
// Backward compat: legacy `*_user_id` (single string) values are still
// honoured by backend role resolution AND read here as the seed when
// no array is present, so existing tenants don't lose their assignment
// after this UI ships.
export default function ConstructionSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const construction = settings.construction || {};
  const roles = construction.roles || {};

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [search, setSearch] = useState('');

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

  const getSelectedIds = (slotKey) => {
    const arr = roles[`${slotKey}_user_ids`];
    if (Array.isArray(arr)) return arr.filter(Boolean);
    const legacy = roles[`${slotKey}_user_id`];
    return legacy ? [legacy] : [];
  };

  const setSlotIds = (slotKey, nextIds) => {
    updateSetting(`construction.roles.${slotKey}_user_ids`, nextIds);
    if (roles[`${slotKey}_user_id`]) {
      updateSetting(`construction.roles.${slotKey}_user_id`, '');
    }
  };

  const toggleSlot = (slotKey, userId, checked) => {
    const cur = getSelectedIds(slotKey);
    if (checked) {
      if (cur.includes(userId)) return;
      setSlotIds(slotKey, [...cur, userId]);
    } else {
      setSlotIds(slotKey, cur.filter((id) => id !== userId));
    }
  };

  // Pre-compute the display rows. We blend the live employees list with
  // any selected IDs that aren't in it (e.g. a user account that
  // has no matching employee row, or an employee filtered out by
  // status='active'). Those still need to appear with a checkbox so
  // the admin can untick them without losing the assignment to a
  // ghost UUID.
  const allSlotIds = useMemo(() => {
    const s = new Set();
    ROLE_SLOTS.forEach((slot) => getSelectedIds(slot.key).forEach((id) => s.add(id)));
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roles.foreman_user_ids, roles.foreman_user_id,
    roles.supervisor_user_ids, roles.supervisor_user_id,
    roles.engineer_user_ids, roles.engineer_user_id,
  ]);

  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(e.user_id || e.id, e));
    return m;
  }, [employees]);

  // Final per-slot row list, with stable ordering: known employees
  // alphabetically, then orphan IDs at the bottom.
  const orphanIds = useMemo(() => {
    return Array.from(allSlotIds).filter((id) => !empMap.has(id));
  }, [allSlotIds, empMap]);

  const formatName = (emp) =>
    [emp.first_name, emp.last_name].filter(Boolean).join(' ').trim() || emp.email || '';

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = formatName(e).toLowerCase();
      const pos  = (e.job_position_name || '').toLowerCase();
      const mail = (e.email || '').toLowerCase();
      return name.includes(q) || pos.includes(q) || mail.includes(q);
    });
  }, [employees, search]);

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
        {/* Shared employee search — filters every role's checkbox list
            at once so admins managing a long roster don't have to scroll
            three separate lists to find the same person. */}
        <div className="relative mb-3 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_employees') || 'Search employees…'}
            className="pl-8"
          />
        </div>

        {ROLE_SLOTS.map((slot) => {
          const selectedIds = getSelectedIds(slot.key);
          const selectedSet = new Set(selectedIds);
          const slotOrphans = orphanIds.filter((id) => selectedSet.has(id));

          return (
            <SettingsRow key={slot.key}>
              <SettingsField
                label={
                  <span className="inline-flex items-center gap-2">
                    <span className="text-base leading-none">{slot.emoji}</span>
                    {t(slot.labelKey)}
                    {selectedIds.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                        {selectedIds.length}
                      </span>
                    )}
                  </span>
                }
                description={t(slot.descKey)}
              >
                <div className="border border-slate-200 rounded-md bg-white">
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {loadingEmployees ? (
                      <div className="p-3 text-sm text-slate-400">{t('loading')}…</div>
                    ) : (
                      <>
                        {visibleEmployees.length === 0 && slotOrphans.length === 0 && (
                          <div className="p-3 text-sm text-slate-400">
                            {search ? (t('no_results') || 'No results') : (t('no_employees') || 'No employees')}
                          </div>
                        )}
                        {visibleEmployees.map((emp) => {
                          const uid = emp.user_id || emp.id;
                          const checked = selectedSet.has(uid);
                          return (
                            <label
                              key={emp.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => toggleSlot(slot.key, uid, v === true)}
                              />
                              <Users className="w-4 h-4 text-blue-500 shrink-0" />
                              <span className="text-sm text-slate-800 truncate">
                                {formatName(emp)}
                              </span>
                              {emp.job_position_name && (
                                <span className="text-xs text-slate-400 truncate">
                                  — {emp.job_position_name}
                                </span>
                              )}
                            </label>
                          );
                        })}

                        {/* Orphan IDs — selected but no matching employee
                            row in the active list. Show with a placeholder
                            so admin can still untick. */}
                        {slotOrphans.length > 0 && !search && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50">
                              {t('unknown_users') || 'Unknown / removed users'}
                            </div>
                            {slotOrphans.map((uid) => (
                              <label
                                key={uid}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                              >
                                <Checkbox
                                  checked
                                  onCheckedChange={(v) => toggleSlot(slot.key, uid, v === true)}
                                />
                                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-sm text-slate-500 truncate font-mono">
                                  {uid.slice(0, 8)}…
                                </span>
                              </label>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </SettingsField>
            </SettingsRow>
          );
        })}
      </SettingsSection>
    </div>
  );
}
