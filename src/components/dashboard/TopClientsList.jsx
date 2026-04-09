import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { Crown } from "lucide-react";

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-pink-100 text-pink-700",
];

export default function TopClientsList({ customers, salesOrders }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const topClients = useMemo(() => {
    const clientRevenue = {};
    (salesOrders || []).forEach((order) => {
      const cid = order.customer_id || order.customer;
      const total = order.total_amount || order.total || 0;
      if (cid) {
        clientRevenue[cid] = (clientRevenue[cid] || 0) + total;
      }
    });

    const totalRev = Object.values(clientRevenue).reduce((s, v) => s + v, 0);

    const ranked = Object.entries(clientRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cid, revenue]) => {
        const cust = (customers || []).find(
          (c) => c.id === cid || c._id === cid
        );
        return {
          name: cust?.company_name || cust?.name || `Mijoz #${String(cid).slice(-4)}`,
          revenue,
          percentage: totalRev > 0 ? ((revenue / totalRev) * 100).toFixed(1) : 0,
          initial: (cust?.company_name || cust?.name || "M").charAt(0).toUpperCase(),
          sparkline: Array.from({ length: 6 }, () => ({
            v: Math.random() * revenue * 0.3 + revenue * 0.1,
          })),
        };
      });

    return ranked;
  }, [customers, salesOrders]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Top mijozlar
        </h3>
        <Crown className="w-4 h-4 text-amber-500" />
      </div>

      {topClients.length > 0 ? (
        <div className="space-y-2">
          {topClients.map((client, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${AVATAR_COLORS[i]}`}
              >
                {client.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {client.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatCurrency(client.revenue)}
                </p>
              </div>
              <div className="w-12 h-6 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={client.sparkline}>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="#6C5CE7"
                      strokeWidth={1}
                      fill="rgba(108,92,231,0.08)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded w-10 text-center shrink-0">
                {client.percentage}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[180px] flex flex-col items-center justify-center">
          <p className="text-sm text-slate-500">{t("no_data") || "Ma'lumot yo'q"}</p>
        </div>
      )}
    </div>
  );
}
