import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { BarChart3 } from "lucide-react";

const RANK_COLORS = ["#6C5CE7", "#7C6DF0", "#8C7EF5", "#A29BFE", "#B8B2FF"];

function CustomTooltip({ active, payload, formatCurrency }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl p-3">
      <p className="text-xs font-semibold text-slate-700 mb-1">{d?.name}</p>
      <p className="text-sm font-bold text-[#6C5CE7]">{formatCurrency(d?.revenue)}</p>
    </div>
  );
}

export default function TopProductsChart({ salesOrders, inventory }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const chartData = useMemo(() => {
    const productRevenue = {};
    (salesOrders || []).forEach((order) => {
      const items = order.items || order.order_lines || [];
      items.forEach((item) => {
        const name = item.product_name || item.name || "Mahsulot";
        productRevenue[name] =
          (productRevenue[name] || 0) + (item.total || item.subtotal || item.quantity * (item.unit_price || 0));
      });
    });

    if (Object.keys(productRevenue).length === 0 && inventory?.length > 0) {
      inventory.slice(0, 5).forEach((item) => {
        productRevenue[item.name] = (item.current_stock || 0) * (item.unit_price || item.cost_price || 10000);
      });
    }

    return Object.entries(productRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, revenue]) => ({
        name: name.length > 18 ? name.slice(0, 16) + "..." : name,
        fullName: name,
        revenue,
      }));
  }, [salesOrders, inventory]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Top 5 mahsulot
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Daromad bo'yicha
        </p>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
            <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={RANK_COLORS[i]} fillOpacity={1 - i * 0.12} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[280px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <BarChart3 className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t("no_data") || "Ma'lumot yo'q"}</p>
        </div>
      )}
    </div>
  );
}
