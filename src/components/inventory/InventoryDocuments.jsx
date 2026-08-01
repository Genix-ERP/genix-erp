import { useState } from 'react';
import {
  ClipboardList, ArrowLeftRight, ClipboardCheck, Trash2, Boxes, History,
} from 'lucide-react';
import StockOperations from './StockOperations';
import StockTransfers from './StockTransfers';
import StockCounting from './StockCounting';
import ScrapManagement from './ScrapManagement';
import InventoryManagement from './InventoryManagement';
import InventoryMovements from './InventoryMovements';

// Hujjatlar — the single home for every stock document flow
// (docs/ombor-audit.md §8). Previously these lived scattered across three
// top-level tabs (Ko'chirishlar) and sub-tabs buried inside Omborlar
// (stocktake, scrap, stock management) plus two orphan tabs reachable only
// by hand-typed URLs. One surface, filter chips on top. "Harakatlar" is the
// unified ledger view over all document types.
const SECTIONS = [
  { key: 'movements', tKey: 'inv_doc_movements', icon: History, Component: InventoryMovements },
  { key: 'operations', tKey: 'inv_doc_operations', icon: ClipboardList, Component: StockOperations },
  { key: 'transfers', tKey: 'inv_doc_transfers', icon: ArrowLeftRight, Component: StockTransfers },
  { key: 'stocktake', tKey: 'inv_doc_stocktake', icon: ClipboardCheck, Component: StockCounting },
  { key: 'scrap', tKey: 'inv_doc_scrap', icon: Trash2, Component: ScrapManagement },
  { key: 'balances', tKey: 'inv_doc_balances', icon: Boxes, Component: InventoryManagement },
];

export default function InventoryDocuments({ t, language, initialSection = 'movements' }) {
  const [active, setActive] = useState(
    SECTIONS.some((s) => s.key === initialSection) ? initialSection : 'movements',
  );
  const ActiveComponent = SECTIONS.find((s) => s.key === active)?.Component || InventoryMovements;

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
      {active === 'movements'
        ? <InventoryMovements t={t} language={language} />
        : <ActiveComponent />}
    </div>
  );
}
