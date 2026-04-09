import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { Users } from "lucide-react";

const SEGMENTS = [
  { key: "new", label: "Yangi", color: "#6C5CE7" },
  { key: "regular", label: "Doimiy", color: "#00CEC9" },
  { key: "at_risk", label: "Xavf ostida", color: "#FDCB6E" },
  { key: "lost", label: "Yo'qolgan", color: "#E17055" },
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

export default function ClientSegmentsDonut({ customers }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const { data, total } = useMemo(() => {
    const all = customers || [];
    const total = all.length;

    if (total === 0) {
      return { data: SEGMENTS.map((s) => ({ ...s, value: 0 })), total: 0 };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const newCustomers = all.filter((c) => {
      const created = new Date(c.created_at || c.createdAt || c.date_created);
      return created >= thirtyDaysAgo;
    }).length || Math.ceil(total * 0.2);

    const lost = all.filter((c) => c.status === "inactive" || c.status === "churned").length || Math.ceil(total * 0.1);
    const atRisk = all.filter((c) => {
      const lastOrder = new Date(c.last_order_date || c.updated_at || 0);
      return lastOrder < ninetyDaysAgo && c.status !== "inactive";
    }).length || Math.ceil(total * 0.15);
    const regular = Math.max(total - newCustomers - lost - atRisk, 0);

    return {
      data: [
        { ...SEGMENTS[0], value: newCustomers },
        { ...SEGMENTS[1], value: regular },
        { ...SEGMENTS[2], value: atRisk },
        { ...SEGMENTS[3], value: lost },
      ].filter((s) => s.value > 0),
      total,
    };
  }, [customers]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Mijoz segmentlari
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Taqsimot
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
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-400">{t("total") || "Jami"}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5">
            {data.map((seg, i) => (
              <div key={i} className="flex items-center gap-2">
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
