import { useMemo } from "react";
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

export default function TopClientsList({ customers, salesOrders, customerInvoices }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const topClients = useMemo(() => {
    const clientRevenue = {};

    // From sales orders
    (salesOrders || []).forEach((order) => {
      const cid = order.customer_id || order.customer || order.partner_id;
      const total = order.total_amount || order.total || 0;
      if (cid && total > 0) {
        if (!clientRevenue[cid]) clientRevenue[cid] = { total: 0, orders: [] };
        clientRevenue[cid].total += total;
        clientRevenue[cid].orders.push(total);
      }
    });

    // From customer invoices if no sales orders
    if (Object.keys(clientRevenue).length === 0) {
      (customerInvoices || []).forEach((inv) => {
        const cid = inv.partner_id || inv.customer_id;
        const total = inv.total_amount || inv.amount || 0;
        if (cid && total > 0) {
          if (!clientRevenue[cid]) clientRevenue[cid] = { total: 0, orders: [] };
          clientRevenue[cid].total += total;
          clientRevenue[cid].orders.push(total);
        }
      });
    }

    const totalRev = Object.values(clientRevenue).reduce((s, v) => s + v.total, 0);

    const ranked = Object.entries(clientRevenue)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([cid, data]) => {
        const cust = (customers || []).find(
          (c) => c.id === cid || c._id === cid || String(c.id) === String(cid)
        );
        return {
          id: cid,
          name: cust?.company_name || cust?.name || cust?.contact_name || `Mijoz #${String(cid).slice(-4)}`,
          revenue: data.total,
          orderCount: data.orders.length,
          percentage: totalRev > 0 ? ((data.total / totalRev) * 100).toFixed(1) : 0,
          initial: (cust?.company_name || cust?.name || "M").charAt(0).toUpperCase(),
        };
      });

    return ranked;
  }, [customers, salesOrders, customerInvoices]);

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
              key={client.id}
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
                  {formatCurrency(client.revenue)} &middot; {client.orderCount} ta buyurtma
                </p>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded w-10 text-center shrink-0">
                {client.percentage}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[180px] flex flex-col items-center justify-center">
          <p className="text-sm text-slate-500">Ma'lumot yo'q</p>
        </div>
      )}
    </div>
  );
}
