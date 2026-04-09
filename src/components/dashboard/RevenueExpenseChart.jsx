import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { formatAxisTick } from "@/utils/formatCurrency";
import { TrendingUp } from "lucide-react";

const COLORS = {
  revenue: "#6C5CE7",
  expenses: "#E17055",
  profit: "#00CEC9",
};

function CustomTooltip({ active, payload, label, formatCurrency, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl p-3 min-w-[180px]">
      <p className="text-xs font-semibold text-slate-500 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-xs text-slate-600">{entry.name}</span>
          </div>
          <span className="text-xs font-semibold text-slate-900">
            {formatCurrency(entry.value)}
          </span>
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
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-xs font-medium text-slate-500">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RevenueExpenseChart({ data }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const months = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return months.map((m) => ({ month: m, revenue: 0, expenses: 0, profit: 0 }));
    }
    return data;
  }, [data]);

  const hasData = chartData.some((d) => d.revenue > 0 || d.expenses > 0);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t("revenue_trends") || "Daromad vs Xarajat vs Foyda"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("monthly_revenue") || "Oylik dinamika"}
          </p>
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.revenue} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLORS.revenue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.expenses} stopOpacity={0.2} />
                <stop offset="100%" stopColor={COLORS.expenses} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.profit} stopOpacity={0.2} />
                <stop offset="100%" stopColor={COLORS.profit} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={55} tickFormatter={formatAxisTick} />
            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} t={t} />} />
            <Legend content={<CustomLegend />} verticalAlign="top" />
            <Area
              type="monotone"
              dataKey="revenue"
              name={t("revenue") || "Daromad"}
              stroke={COLORS.revenue}
              strokeWidth={2.5}
              fill="url(#gradRevenue)"
              dot={false}
              activeDot={{ r: 5, stroke: COLORS.revenue, strokeWidth: 2, fill: "#fff" }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name={t("expenses") || "Xarajatlar"}
              stroke={COLORS.expenses}
              strokeWidth={2}
              fill="url(#gradExpenses)"
              dot={false}
              activeDot={{ r: 4, stroke: COLORS.expenses, strokeWidth: 2, fill: "#fff" }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name={t("net_profit") || "Sof foyda"}
              stroke={COLORS.profit}
              strokeWidth={2}
              fill="url(#gradProfit)"
              dot={false}
              activeDot={{ r: 4, stroke: COLORS.profit, strokeWidth: 2, fill: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <TrendingUp className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">
            {t("no_revenue_data") || "Ma'lumot yo'q"}
          </p>
          <p className="text-xs text-slate-400">
            {t("start_tracking_revenue") || "Daromadlarni kuzatishni boshlang"}
          </p>
        </div>
      )}
    </div>
  );
}
