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
        {d.value >= 0 ? "+" : ""}{formatCurrency(d.value)}
      </p>
    </div>
  );
}

export default function CashFlowWaterfall({ transactions, customerInvoices, vendorBills }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const chartData = useMemo(() => {
    // Gather all money movements from multiple sources
    const allMovements = [];

    // From financial transactions
    (transactions || []).forEach((tx) => {
      allMovements.push({
        date: new Date(tx.date || 0),
        type: tx.transaction_type, // income or expense
        amount: tx.amount || 0,
      });
    });

    // From customer invoices (paid = inflow)
    (customerInvoices || []).forEach((inv) => {
      if (inv.status === "paid" || inv.status === "completed" || inv.amount_paid > 0) {
        allMovements.push({
          date: new Date(inv.invoice_date || inv.date || inv.created_date || 0),
          type: "income",
          amount: inv.amount_paid || inv.total_amount || inv.amount || 0,
        });
      }
    });

    // From vendor bills (paid = outflow)
    (vendorBills || []).forEach((bill) => {
      if (bill.status === "paid" || bill.status === "completed" || bill.amount_paid > 0) {
        allMovements.push({
          date: new Date(bill.invoice_date || bill.date || bill.created_date || 0),
          type: "expense",
          amount: bill.amount_paid || bill.total_amount || bill.amount || 0,
        });
      }
    });

    if (allMovements.length === 0) return [];

    // Group into last 4 weeks
    const now = new Date();
    const weekLabels = ["1-hafta", "2-hafta", "3-hafta", "4-hafta"];
    const result = [];

    for (let i = 0; i < 4; i++) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      const weekMovements = allMovements.filter(
        (m) => m.date >= weekStart && m.date < weekEnd
      );

      const inflow = weekMovements
        .filter((m) => m.type === "income")
        .reduce((s, m) => s + m.amount, 0);

      const outflow = weekMovements
        .filter((m) => m.type === "expense")
        .reduce((s, m) => s + m.amount, 0);

      result.unshift({
        weekLabel: weekLabels[3 - i],
        inflow,
        outflow,
      });
    }

    // Build waterfall bars
    const bars = [];
    result.forEach((w) => {
      if (w.inflow > 0) {
        bars.push({ name: `${w.weekLabel} +`, value: w.inflow, color: "#10b981", type: "inflow" });
      }
      if (w.outflow > 0) {
        bars.push({ name: `${w.weekLabel} -`, value: -w.outflow, color: "#ef4444", type: "outflow" });
      }
    });

    // Net balance
    const totalInflow = result.reduce((s, w) => s + w.inflow, 0);
    const totalOutflow = result.reduce((s, w) => s + w.outflow, 0);
    bars.push({
      name: "Balans",
      value: totalInflow - totalOutflow,
      color: "#6C5CE7",
      type: "net",
    });

    return bars;
  }, [transactions, customerInvoices, vendorBills]);

  const hasData = chartData.length > 0 && chartData.some((d) => d.value !== 0);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t("cash_flow") || "Naqd pul oqimi"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Oxirgi 30 kun
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-slate-400">{t("income") || "Daromad"}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-slate-400">{t("expense") || "Xarajat"}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#6C5CE7]" />
            <span className="text-[10px] text-slate-400">Balans</span>
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
          <p className="text-sm font-medium text-slate-500">Ma'lumotlar yo'q</p>
        </div>
      )}
    </div>
  );
}
