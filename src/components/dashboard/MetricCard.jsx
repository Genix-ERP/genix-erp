import { TrendingUp, TrendingDown, AlertTriangle, Minus } from "lucide-react";

export default function MetricCard({ title, value, change, trend, icon: Icon, color = "blue" }) {
  const colors = {
    green: { icon: "text-emerald-600 bg-emerald-50", accent: "text-emerald-600" },
    blue: { icon: "text-blue-600 bg-blue-50", accent: "text-blue-600" },
    purple: { icon: "text-violet-600 bg-violet-50", accent: "text-violet-600" },
    orange: { icon: "text-amber-600 bg-amber-50", accent: "text-amber-600" },
    red: { icon: "text-red-600 bg-red-50", accent: "text-red-600" },
  };

  const c = colors[color] || colors.blue;

  const TrendIcon = trend === "up" ? TrendingUp
    : trend === "down" ? TrendingDown
    : trend === "warning" ? AlertTriangle
    : Minus;

  const trendColor = trend === "warning" ? "text-amber-600" : trend === "down" ? "text-red-500" : c.accent;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-all duration-200">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.icon}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <p className="text-sm text-slate-500">{title}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900 tracking-tight mb-1">{value}</p>
      <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
        <TrendIcon className="w-3.5 h-3.5" />
        <span>{change}</span>
      </div>
    </div>
  );
}
