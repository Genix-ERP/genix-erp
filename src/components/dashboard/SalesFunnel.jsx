import { useMemo } from "react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { Filter } from "lucide-react";

const STAGE_COLORS = [
  { bg: "#6C5CE7", light: "rgba(108,92,231,0.1)" },
  { bg: "#A29BFE", light: "rgba(162,155,254,0.1)" },
  { bg: "#00CEC9", light: "rgba(0,206,201,0.1)" },
  { bg: "#FDCB6E", light: "rgba(253,203,110,0.15)" },
  { bg: "#10b981", light: "rgba(16,185,129,0.1)" },
];

export default function SalesFunnel({ leads, opportunities, salesOrders }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const stages = useMemo(() => {
    const allOpps = opportunities || [];
    const allOrders = salesOrders || [];
    const allLeads = leads || [];

    // Count by actual stage from real data
    const leadCount = allLeads.length;

    const offerCount = allOpps.filter(
      (o) => o.stage === "proposal" || o.stage === "qualification" || o.stage === "prospecting"
    ).length;

    const negotiationCount = allOpps.filter(
      (o) => o.stage === "negotiation" || o.stage === "value_proposition"
    ).length;

    const contractCount = allOrders.filter(
      (o) => o.status === "confirmed" || o.status === "processing"
    ).length;

    const paidCount = allOrders.filter(
      (o) => o.status === "completed" || o.status === "delivered"
    ).length;

    // Real values from actual opportunity/order data
    const offerValue = allOpps
      .filter((o) => o.stage === "proposal" || o.stage === "qualification" || o.stage === "prospecting")
      .reduce((s, o) => s + (o.expected_value || o.amount || 0), 0);

    const negotiationValue = allOpps
      .filter((o) => o.stage === "negotiation" || o.stage === "value_proposition")
      .reduce((s, o) => s + (o.expected_value || o.amount || 0), 0);

    const contractValue = allOrders
      .filter((o) => o.status === "confirmed" || o.status === "processing")
      .reduce((s, o) => s + (o.total_amount || o.total || 0), 0);

    const paidValue = allOrders
      .filter((o) => o.status === "completed" || o.status === "delivered")
      .reduce((s, o) => s + (o.total_amount || o.total || 0), 0);

    // Lead value estimated from average opportunity value
    const avgOppValue = allOpps.length > 0
      ? allOpps.reduce((s, o) => s + (o.expected_value || 0), 0) / allOpps.length
      : 0;
    const leadValue = leadCount * avgOppValue;

    const data = [
      { name: "Lead", count: leadCount, value: leadValue },
      { name: "Taklif", count: offerCount, value: offerValue },
      { name: "Muzokara", count: negotiationCount, value: negotiationValue },
      { name: "Shartnoma", count: contractCount, value: contractValue },
      { name: "To'lov", count: paidCount, value: paidValue },
    ];

    return data.map((stage, i) => ({
      ...stage,
      color: STAGE_COLORS[i],
      conversion:
        i > 0 && data[i - 1].count > 0
          ? ((stage.count / data[i - 1].count) * 100).toFixed(0)
          : null,
    }));
  }, [leads, opportunities, salesOrders]);

  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const hasData = stages.some((s) => s.count > 0);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Savdo bosqichlari
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Lead → To'lov
          </p>
        </div>
      </div>

      {hasData ? (
        <div className="space-y-2">
          {stages.map((stage, i) => {
            const widthPct = Math.max((stage.count / maxCount) * 100, 12);
            return (
              <div key={stage.name}>
                {stage.conversion && (
                  <div className="flex items-center justify-center mb-1">
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                      ↓ {stage.conversion}%
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 w-20 text-right shrink-0">
                    {stage.name}
                  </span>
                  <div className="flex-1 relative">
                    <div
                      className="h-9 rounded-lg flex items-center px-3 transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        background: `linear-gradient(135deg, ${stage.color.bg}, ${stage.color.bg}dd)`,
                      }}
                    >
                      <span className="text-xs font-bold text-white whitespace-nowrap">
                        {stage.count}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 w-24 shrink-0 text-right">
                    {stage.value > 0 ? formatCurrency(stage.value) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-[240px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <Filter className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">
            Ma'lumot yo'q
          </p>
        </div>
      )}
    </div>
  );
}
