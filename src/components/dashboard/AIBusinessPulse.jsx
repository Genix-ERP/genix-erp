import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import {
  Brain,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Activity,
  ArrowRight,
  Target,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl p-3">
      <p className="text-xs font-semibold text-slate-700">{d?.axis}</p>
      <p className="text-lg font-bold text-[#6C5CE7]">{d?.score}/100</p>
    </div>
  );
}

export default function AIBusinessPulse({
  businessHealth,
  allInsights,
  allRecommendations,
  t: tProp,
}) {
  const { language } = useLanguage();
  const { t: tLocal } = useTranslation(language);
  const t = tProp || tLocal;

  const radarData = useMemo(() => {
    const dimensions = businessHealth?.dimensions || {};
    return [
      { axis: t("revenue") || "Revenue", score: dimensions.revenue?.score || dimensions.sales?.score || 75 },
      { axis: t("expenses") || "Expenses", score: dimensions.expenses?.score || dimensions.financial?.score || 70 },
      { axis: t("inventory") || "Inventory", score: dimensions.inventory?.score || 80 },
      { axis: t("customers") || "Customers", score: dimensions.customers?.score || dimensions.customer?.score || 65 },
      { axis: t("payments") || "Payments", score: dimensions.payments?.score || 72 },
      { axis: t("employees") || "Employees", score: dimensions.hr?.score || dimensions.employees?.score || 85 },
    ];
  }, [businessHealth]);

  const getInsightIcon = (type) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "negative":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const insights = allInsights || [];
  const recommendations = allRecommendations || [];

  return (
    <div className="space-y-4">
      {/* AI Pulse + Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <div className="glass-card rounded-2xl p-5 transition-all duration-300 glow-purple relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#6C5CE7]/[0.03] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] rounded-xl flex items-center justify-center shadow-lg shadow-purple-200/50">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">AI Business Pulse</h3>
                  <p className="text-[10px] text-slate-400">{t("realtime_business_health") || "Real-time business health"}</p>
                </div>
              </div>
              <span className="animate-pulse-live text-[10px] font-bold text-[#6C5CE7] bg-[#6C5CE7]/10 px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C5CE7]" />
                {t("live") || "LIVE"}
              </span>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#64748b" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Radar
                  dataKey="score"
                  stroke="#6C5CE7"
                  strokeWidth={2}
                  fill="#6C5CE7"
                  fillOpacity={0.15}
                  dot={{ r: 4, fill: "#6C5CE7", stroke: "#fff", strokeWidth: 2 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights */}
        <div className="glass-card rounded-2xl p-5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-indigo-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("ai_generated_insights") || "AI tahlillari"}
            </h3>
            <span className="animate-pulse-live text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wide ml-auto">
              {t("live") || "JONLI"}
            </span>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {insights.length > 0 ? (
              insights.map((insight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="mt-0.5 shrink-0">{getInsightIcon(insight.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-medium text-slate-800 truncate">
                        {insight.title}
                      </h4>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          insight.priority === "high" || insight.priority === "critical"
                            ? "bg-red-50 text-red-600"
                            : insight.priority === "medium"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {insight.description}
                    </p>
                    {insight.metric && (
                      <p className="text-base font-bold text-indigo-600 mt-1">
                        {insight.metric}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-300" />
                <p className="text-sm font-medium text-slate-600">
                  {t("all_systems_optimal") || "Barcha tizimlar yaxshi"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendations — 3 column grid */}
      {recommendations.length > 0 && (
        <div className="glass-card rounded-2xl p-5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-violet-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("ai_recommendations") || "AI tavsiyalari"}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.slice(0, 3).map((rec, i) => (
              <div
                key={i}
                className="relative p-4 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl font-black text-[#6C5CE7]/20 leading-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 mb-1">
                      {rec.action}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                      {rec.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          rec.impact === "high"
                            ? "bg-red-50 text-red-600"
                            : rec.impact === "medium"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {rec.impact === "high"
                          ? t("high_impact") || "Yuqori ta'sir"
                          : rec.impact === "medium"
                            ? t("medium_impact") || "O'rta ta'sir"
                            : t("low_impact") || "Past ta'sir"}
                      </span>
                      <button className="text-[11px] font-semibold text-[#6C5CE7] hover:text-[#5A4BD4] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t("execute") || "Execute"} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link to={createPageUrl("AIAssistant")} className="block mt-3">
            <button className="w-full text-sm text-slate-500 hover:text-[#6C5CE7] flex items-center justify-center gap-1 py-2 transition-colors">
              {t("get_more_ai_insights") || "Ko'proq AI tahlillar"} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
