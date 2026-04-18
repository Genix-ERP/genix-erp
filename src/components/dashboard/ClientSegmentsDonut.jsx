import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { Users } from "lucide-react";

const SEGMENT_DEFS = [
  { key: "new", tKey: "new_customers", fallback: "New", color: "#6C5CE7" },
  { key: "regular", tKey: "regular_customers", fallback: "Regular", color: "#00CEC9" },
  { key: "at_risk", tKey: "at_risk", fallback: "At Risk", color: "#FDCB6E" },
  { key: "lost", tKey: "lost_customers", fallback: "Lost", color: "#E17055" },
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
        <span className="text-xs font-semibold text-slate-700">{d.label}</span>
      </div>
      <p className="text-sm font-bold text-slate-900">{d.value} ta</p>
    </div>
  );
}

export default function ClientSegmentsDonut({ customers, salesOrders }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const { data, total } = useMemo(() => {
    const all = customers || [];
    const total = all.length;

    if (total === 0) {
      return { data: [], total: 0 };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Customers with orders — build lookup from real sales data
    const customerOrderDates = {};
    (salesOrders || []).forEach((o) => {
      const cid = o.customer_id || o.customer || o.partner_id;
      const date = new Date(o.order_date || o.date || o.created_date || 0);
      if (cid) {
        if (!customerOrderDates[cid] || date > customerOrderDates[cid]) {
          customerOrderDates[cid] = date;
        }
      }
    });

    // New: created in last 30 days
    const newCustomers = all.filter((c) => {
      const created = new Date(c.created_at || c.createdAt || c.date_created || c.created_date || 0);
      return created >= thirtyDaysAgo;
    }).length;

    // Lost: status explicitly inactive/churned
    const lost = all.filter(
      (c) => c.status === "inactive" || c.status === "churned"
    ).length;

    // At risk: last order > 90 days ago, but not inactive
    const atRisk = all.filter((c) => {
      if (c.status === "inactive" || c.status === "churned") return false;
      const cid = c.id || c._id;
      const lastOrder = customerOrderDates[cid] || new Date(c.last_order_date || c.updated_at || 0);
      return lastOrder < ninetyDaysAgo && lastOrder.getTime() > 0;
    }).length;

    // Regular: everyone else
    const regular = Math.max(total - newCustomers - lost - atRisk, 0);

    const SEGMENTS = SEGMENT_DEFS.map(s => ({ ...s, label: t(s.tKey) || s.fallback }));
    const result = [
      { ...SEGMENTS[0], value: newCustomers },
      { ...SEGMENTS[1], value: regular },
      { ...SEGMENTS[2], value: atRisk },
      { ...SEGMENTS[3], value: lost },
    ].filter((s) => s.value > 0);

    return { data: result, total };
  }, [customers, salesOrders]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {t("client_segments") || "Client Segments"}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {t("distribution") || "Distribution"}
        </p>
      </div>

      {total > 0 ? (
        <div className="flex items-center gap-4">
          <div className="relative w-[160px] h-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-400">Jami</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5">
            {data.map((seg) => (
              <div key={seg.key} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className="text-xs text-slate-600 flex-1">{seg.label}</span>
                <span className="text-xs font-semibold text-slate-900">{seg.value}</span>
                <span className="text-[10px] text-slate-400 w-8 text-right">
                  {((seg.value / total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-[160px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <Users className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t("no_customers_yet")}</p>
        </div>
      )}
    </div>
  );
}
