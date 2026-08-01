import { useState } from 'react';
import { Warehouse, DollarSign, Settings2, MapPin } from 'lucide-react';
import Warehouses from './Warehouses';
import InventoryValuation from './InventoryValuation';
import ValuationMethodCard from './ValuationMethodCard';
import OperationTypes from './OperationTypes';
import WarehouseLocations from './WarehouseLocations';

// Sozlamalar — the rarely-touched configuration surface
// (docs/ombor-audit.md §8): the warehouse list (was a whole top-level tab),
// valuation ("Baholash" stops being a daily destination — it's a setting
// plus a report), operation types and locations (previously orphan tabs
// with no visible trigger).
const SECTIONS = [
  { key: 'warehouses', tKey: 'inv_set_warehouses', icon: Warehouse, Component: () => <Warehouses hideSubTabs /> },
  { key: 'valuation', tKey: 'inv_set_valuation', icon: DollarSign, Component: null }, // rendered below with the method card
  { key: 'operation-types', tKey: 'inv_set_operation_types', icon: Settings2, Component: OperationTypes },
  { key: 'locations', tKey: 'inv_set_locations', icon: MapPin, Component: WarehouseLocations },
];

export default function InventorySettings({ t, initialSection = 'warehouses' }) {
  const [active, setActive] = useState(
    SECTIONS.some((s) => s.key === initialSection) ? initialSection : 'warehouses',
  );
  const ActiveComponent = SECTIONS.find((s) => s.key === active)?.Component;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(({ key, tKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
              active === key
                ? 'bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white border-transparent shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(tKey)}
          </button>
        ))}
      </div>
      {active === 'valuation' ? (
        <div className="space-y-4">
          <ValuationMethodCard t={t} />
          <InventoryValuation />
        </div>
      ) : (
        ActiveComponent && <ActiveComponent />
      )}
    </div>
  );
}
