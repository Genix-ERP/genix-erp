import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { Warehouse } from "lucide-react";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl p-3">
      <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-xs text-slate-600">{entry.name}</span>
          </div>
          <span className="text-xs font-semibold text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }) {
  return (
    <div className="flex items-center gap-4 mb-1">
      {payload?.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-xs font-medium text-slate-500">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function InventoryStackedBar({ inventory }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const chartData = useMemo(() => {
    const warehouseMap = {};
    (inventory || []).forEach((item) => {
      const wh = item.warehouse || item.location || "Asosiy ombor";
      if (!warehouseMap[wh]) {
        warehouseMap[wh] = { name: wh, inStock: 0, reserved: 0, low: 0 };
      }
      const stock = item.current_stock || 0;
      const reorder = item.reorder_level || 10;
      const reserved = item.reserved_stock || 0;

      if (stock <= reorder) {
        warehouseMap[wh].low += stock;
      } else {
        warehouseMap[wh].inStock += stock - reserved;
        warehouseMap[wh].reserved += reserved;
      }
    });

    const result = Object.values(warehouseMap);
    if (result.length === 0) return [];

    return result.map((wh) => ({
      ...wh,
      name: wh.name.length > 14 ? wh.name.slice(0, 12) + "..." : wh.name,
    }));
  }, [inventory]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Ombor holati
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Omborlar bo'yicha
        </p>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} verticalAlign="top" />
            <Bar dataKey="inStock" name={t("in_stock") || "Mavjud"} stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={36} />
            <Bar dataKey="reserved" name={t("reserved") || "Band"} stackId="a" fill="#FDCB6E" radius={[0, 0, 0, 0]} maxBarSize={36} />
            <Bar dataKey="low" name={t("low_stock") || "Kam"} stackId="a" fill="#E17055" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[260px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <Warehouse className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t("no_data") || "Ma'lumot yo'q"}</p>
        </div>
      )}
    </div>
  );
}
