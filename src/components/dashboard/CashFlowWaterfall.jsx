import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { formatAxisTick } from "@/utils/formatCurrency";
import { ArrowDownUp } from "lucide-react";

function CustomTooltip({ active, payload, formatCurrency }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl p-3">
      <p className="text-xs font-semibold text-slate-700 mb-1">{d.name}</p>
      <p className="text-sm font-bold" style={{ color: d.color }}>
        {formatCurrency(Math.abs(d.value))}
      </p>
    </div>
  );
}

export default function CashFlowWaterfall({ transactions }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const chartData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recent = (transactions || []).filter((tx) => {
      const d = new Date(tx.date);
      return d >= thirtyDaysAgo && d <= now;
    });

    const weeklyData = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(thirtyDaysAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const weekTxs = recent.filter((tx) => {
        const d = new Date(tx.date);
        return d >= weekStart && d < weekEnd;
      });

      const inflow = weekTxs
        .filter((tx) => tx.transaction_type === "income")
        .reduce((s, tx) => s + (tx.amount || 0), 0);
      const outflow = weekTxs
        .filter((tx) => tx.transaction_type === "expense")
        .reduce((s, tx) => s + (tx.amount || 0), 0);

      weeklyData.push({
        name: `${i + 1}-hafta`,
        inflow,
        outflow: -outflow,
        net: inflow - outflow,
      });
    }

    return [
      ...weeklyData.map((w) => [
        { name: `${w.name} +`, value: w.inflow, color: "#10b981", type: "inflow" },
        { name: `${w.name} -`, value: w.outflow, color: "#ef4444", type: "outflow" },
      ]).flat(),
      {
        name: "Balans",
        value: weeklyData.reduce((s, w) => s + w.net, 0),
        color: "#6C5CE7",
        type: "net",
      },
    ];
  }, [transactions]);

  const hasData = chartData.some((d) => d.value !== 0);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t("cash_flow") || "Pul oqimi"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("last_30_days") || "Oxirgi 30 kun"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-slate-400">{t("income") || "Kirim"}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-slate-400">{t("expense") || "Chiqim"}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#6C5CE7]" />
            <span className="text-[10px] text-slate-400">{t("balance") || "Balans"}</span>
          </div>
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={55} tickFormatter={formatAxisTick} />
            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
            <ReferenceLine y={0} stroke="#e2e8f0" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={entry.type === "net" ? 1 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <ArrowDownUp className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t("no_data") || "Ma'lumot yo'q"}</p>
        </div>
      )}
    </div>
  );
}
