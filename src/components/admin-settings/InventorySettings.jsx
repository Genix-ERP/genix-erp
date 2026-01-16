import React from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Barcode, Box, Calculator, Warehouse } from 'lucide-react';

const COSTING_METHODS = [
  { value: 'FIFO', label: 'FIFO - First In, First Out', desc: 'Oldest inventory sold first' },
  { value: 'LIFO', label: 'LIFO - Last In, First Out', desc: 'Newest inventory sold first' },
  { value: 'AVCO', label: 'AVCO - Average Cost', desc: 'Weighted average cost' },
  { value: 'STANDARD', label: 'Standard Cost', desc: 'Fixed standard cost' }
];

const BARCODE_FORMATS = [
  { value: 'EAN13', label: 'EAN-13 (International)' },
  { value: 'EAN8', label: 'EAN-8 (Short)' },
  { value: 'UPC', label: 'UPC-A (US/Canada)' },
  { value: 'CODE128', label: 'Code 128 (Alphanumeric)' }
];

export default function InventorySettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const inventory = settings.inventory || {};

  return (
    <div className="space-y-4">
      {/* Traceability */}
      <SettingsSection
        title={t('traceability')}
        description={t('traceability_desc')}
        icon={Barcode}
        onReset={() => resetSection('inventory')}
        resetLabel={t('reset')}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('enable_traceability')}
            description={t('enable_traceability_desc')}
            checked={inventory.traceability?.enabled ?? true}
            onChange={(checked) => updateSetting('inventory.traceability.enabled', checked)}
          />
          <SettingsToggle
            label={t('lot_tracking')}
            description={t('lot_tracking_desc')}
            checked={inventory.traceability?.lot_tracking ?? true}
            onChange={(checked) => updateSetting('inventory.traceability.lot_tracking', checked)}
          />
          <SettingsToggle
            label={t('serial_number_tracking')}
            description={t('serial_number_tracking_desc')}
            checked={inventory.traceability?.serial_number_tracking ?? false}
            onChange={(checked) => updateSetting('inventory.traceability.serial_number_tracking', checked)}
          />
          <SettingsToggle
            label={t('expiry_date_tracking')}
            description={t('expiry_date_tracking_desc')}
            checked={inventory.traceability?.expiry_date_tracking ?? true}
            onChange={(checked) => updateSetting('inventory.traceability.expiry_date_tracking', checked)}
          />
        </div>
      </SettingsSection>

      {/* Costing */}
      <SettingsSection
        title={t('costing_method')}
        description={t('costing_method_desc')}
        icon={Calculator}
      >
        <SettingsRow>
          <SettingsField label={t('costing_method')} description={t('select_costing_method')}>
            <Select
              value={inventory.costing?.method || 'FIFO'}
              onValueChange={(value) => updateSetting('inventory.costing.method', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COSTING_METHODS.map(m => (
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
          <SettingsField label={t('inventory_valuation')}>
            <Select
              value={inventory.costing?.valuation || 'automatic'}
              onValueChange={(value) => updateSetting('inventory.costing.valuation', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">{t('automatic')}</SelectItem>
                <SelectItem value="manual">{t('manual')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Warehouse Defaults */}
      <SettingsSection
        title={t('warehouse_defaults')}
        description={t('warehouse_defaults_desc')}
        icon={Warehouse}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('allow_negative_stock')}
            description={t('allow_negative_stock_desc')}
            checked={inventory.warehouse?.allow_negative_stock ?? false}
            onChange={(checked) => updateSetting('inventory.warehouse.allow_negative_stock', checked)}
          />
          <SettingsToggle
            label={t('require_location')}
            description={t('require_location_desc')}
            checked={inventory.warehouse?.require_location ?? false}
            onChange={(checked) => updateSetting('inventory.warehouse.require_location', checked)}
          />
          <SettingsToggle
            label={t('multi_location')}
            description={t('multi_location_desc')}
            checked={inventory.warehouse?.multi_location ?? false}
            onChange={(checked) => updateSetting('inventory.warehouse.multi_location', checked)}
          />
        </div>
      </SettingsSection>

      {/* Reorder Settings */}
      <SettingsSection
        title={t('reorder_settings')}
        description={t('reorder_settings_desc')}
        icon={Box}
      >
        <SettingsToggle
          label={t('auto_reorder')}
          description={t('auto_reorder_desc')}
          checked={inventory.reorder?.auto_reorder ?? false}
          onChange={(checked) => updateSetting('inventory.reorder.auto_reorder', checked)}
        />
        <SettingsRow className="mt-4">
          <SettingsField label={t('default_reorder_quantity')}>
            <Input
              type="number"
              min="1"
              value={inventory.reorder?.default_reorder_quantity || 10}
              onChange={(e) => updateSetting('inventory.reorder.default_reorder_quantity', parseInt(e.target.value) || 10)}
            />
          </SettingsField>
          <SettingsField label={t('low_stock_threshold_percent')}>
            <Input
              type="number"
              min="1"
              max="100"
              value={inventory.reorder?.low_stock_threshold_percent || 20}
              onChange={(e) => updateSetting('inventory.reorder.low_stock_threshold_percent', parseInt(e.target.value) || 20)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Barcode Settings */}
      <SettingsSection
        title={t('barcode_settings')}
        description={t('barcode_settings_desc')}
        icon={Barcode}
      >
        <SettingsRow>
          <SettingsField label={t('barcode_format')}>
            <Select
              value={inventory.barcode?.format || 'EAN13'}
              onValueChange={(value) => updateSetting('inventory.barcode.format', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BARCODE_FORMATS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
        <div className="mt-4">
          <SettingsToggle
            label={t('auto_generate_barcode')}
            description={t('auto_generate_barcode_desc')}
            checked={inventory.barcode?.auto_generate ?? false}
            onChange={(checked) => updateSetting('inventory.barcode.auto_generate', checked)}
          />
        </div>
      </SettingsSection>

      {/* Units of Measure */}
      <SettingsSection
        title={t('units_of_measure')}
        description={t('units_of_measure_desc')}
        icon={Box}
      >
        <SettingsRow>
          <SettingsField label={t('default_unit')}>
            <Select
              value={inventory.units?.default_unit || 'Unit'}
              onValueChange={(value) => updateSetting('inventory.units.default_unit', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(inventory.units?.units_of_measure || []).map(u => (
                  <SelectItem key={u.name} value={u.name}>{u.name} ({u.symbol})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600 mb-2">{t('available_units')}:</p>
          <div className="flex flex-wrap gap-2">
            {(inventory.units?.units_of_measure || []).map(u => (
              <span key={u.name} className="px-2 py-1 bg-white border rounded text-xs">
                {u.name} ({u.symbol})
              </span>
            ))}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
