import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cog, Factory, ClipboardCheck, Settings } from 'lucide-react';

const PLANNING_METHODS = [
  { value: 'MRP', label: 'MRP - Material Requirements Planning', desc: 'Plan based on demand forecast' },
  { value: 'MTO', label: 'MTO - Make to Order', desc: 'Produce only when order received' },
  { value: 'MTS', label: 'MTS - Make to Stock', desc: 'Produce for inventory' }
];

export default function ManufacturingSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const manufacturing = settings.manufacturing || {};

  return (
    <div className="space-y-4">
      {/* Production Planning */}
      <SettingsSection
        title={t('production_planning')}
        description={t('production_planning_desc')}
        icon={Factory}
        onReset={() => resetSection('manufacturing')}
        resetLabel={t('reset')}
      >
        <SettingsRow>
          <SettingsField label={t('planning_method')}>
            <Select
              value={manufacturing.planning?.method || 'MTO'}
              onValueChange={(value) => updateSetting('manufacturing.planning.method', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_METHODS.map(m => (
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
          <SettingsField label={t('default_production_lead_time')}>
            <Input
              type="number"
              min="1"
              max="365"
              value={manufacturing.planning?.default_lead_time_days || 5}
              onChange={(e) => updateSetting('manufacturing.planning.default_lead_time_days', parseInt(e.target.value) || 5)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Work Center Defaults */}
      <SettingsSection
        title={t('work_center_defaults')}
        description={t('work_center_defaults_desc')}
        icon={Cog}
      >
        <SettingsRow>
          <SettingsField label={t('default_capacity_hours')} description={t('default_capacity_hours_desc')}>
            <Input
              type="number"
              min="1"
              max="24"
              value={manufacturing.work_center?.default_capacity || 8}
              onChange={(e) => updateSetting('manufacturing.work_center.default_capacity', parseInt(e.target.value) || 8)}
            />
          </SettingsField>
          <SettingsField label={t('efficiency_rate_percent')} description={t('efficiency_rate_percent_desc')}>
            <Input
              type="number"
              min="1"
              max="150"
              value={manufacturing.work_center?.efficiency_rate || 100}
              onChange={(e) => updateSetting('manufacturing.work_center.efficiency_rate', parseInt(e.target.value) || 100)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Quality Control */}
      <SettingsSection
        title={t('quality_control')}
        description={t('quality_control_desc')}
        icon={ClipboardCheck}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('enable_quality_control')}
            description={t('enable_quality_control_desc')}
            checked={manufacturing.quality?.control_enabled ?? true}
            onChange={(checked) => updateSetting('manufacturing.quality.control_enabled', checked)}
          />
          <SettingsToggle
            label={t('require_inspection')}
            description={t('require_inspection_desc')}
            checked={manufacturing.quality?.inspection_required ?? true}
            onChange={(checked) => updateSetting('manufacturing.quality.inspection_required', checked)}
          />
        </div>
      </SettingsSection>

      {/* Production Settings */}
      <SettingsSection
        title={t('production_settings')}
        description={t('production_settings_desc')}
        icon={Settings}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('auto_consume_components')}
            description={t('auto_consume_components_desc')}
            checked={manufacturing.production?.auto_consume_components ?? false}
            onChange={(checked) => updateSetting('manufacturing.production.auto_consume_components', checked)}
          />
          <SettingsToggle
            label={t('enable_backflush')}
            description={t('enable_backflush_desc')}
            checked={manufacturing.production?.backflush_enabled ?? false}
            onChange={(checked) => updateSetting('manufacturing.production.backflush_enabled', checked)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
