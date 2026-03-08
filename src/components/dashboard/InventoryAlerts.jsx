import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function InventoryAlerts({ inventory }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const lowStockItems = inventory.filter(item =>
    item.current_stock <= item.reorder_level
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{t('inventory_alerts')}</h3>
        {lowStockItems.length > 0 && (
          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            {lowStockItems.length} {t('action_needed').toLowerCase()}
          </span>
        )}
      </div>
      {lowStockItems.length > 0 ? (
        <div className="flex-1 space-y-2">
          {lowStockItems.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-400">SKU: {item.sku}</p>
              </div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                {item.current_stock} {t('left')}
              </span>
            </div>
          ))}
          <Link to={createPageUrl("Inventory")} className="block mt-auto pt-2">
            <button className="w-full text-sm text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1 py-2 transition-colors">
              {t('manage_inventory')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">{t('all_inventory_healthy')}</p>
          <p className="text-xs text-slate-400">{t('no_restocking_needed')}</p>
        </div>
      )}
    </div>
  );
}
