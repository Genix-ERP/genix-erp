import { TrendingUp, TrendingDown, AlertTriangle, Minus } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export default function MetricCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color = "blue",
  sparklineData,
  badge,
  badgeColor,
  subtitle,
  ratioBar,
}) {
  const colors = {
    green: {
      icon: "text-emerald-600 bg-emerald-50",
      accent: "text-emerald-600",
      spark: "#10b981",
    },
    blue: {
      icon: "text-blue-600 bg-blue-50",
      accent: "text-blue-600",
      spark: "#3b82f6",
    },
    purple: {
      icon: "text-violet-600 bg-violet-50",
      accent: "text-violet-600",
      spark: "#6C5CE7",
    },
    orange: {
      icon: "text-amber-600 bg-amber-50",
      accent: "text-amber-600",
      spark: "#f59e0b",
    },
    red: {
      icon: "text-red-600 bg-red-50",
      accent: "text-red-600",
      spark: "#ef4444",
    },
    teal: {
      icon: "text-teal-600 bg-teal-50",
      accent: "text-teal-600",
      spark: "#00CEC9",
    },
    coral: {
      icon: "text-orange-600 bg-orange-50",
      accent: "text-orange-600",
      spark: "#E17055",
    },
  };

  const c = colors[color] || colors.blue;

  const TrendIcon =
    trend === "up"
      ? TrendingUp
      : trend === "down"
        ? TrendingDown
        : trend === "warning"
          ? AlertTriangle
          : Minus;

  const trendColor =
    trend === "warning"
      ? "text-amber-600"
      : trend === "down"
        ? "text-red-500"
        : trend === "up"
          ? "text-emerald-600"
          : "text-slate-400";

  return (
    <div className="glass-card rounded-2xl p-4 transition-all duration-300 group relative overflow-hidden h-full flex flex-col justify-between">
      {/* Subtle gradient accent */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.04] -translate-y-8 translate-x-8"
        style={{ background: c.spark }}
      />

      {/* Top: Icon + Badge row */}
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.icon} shadow-sm`}>
          <Icon className="w-4 h-4" />
        </div>
        {badge && (
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
              badgeColor || "bg-red-100 text-red-700"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      {/* Title */}
      <p className="text-[12px] font-medium text-slate-500 leading-tight mb-1">{title}</p>

      {/* Middle: Value */}
      <div className="mb-1">
        <p className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Bottom: Trend + Sparkline */}
      <div>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1 text-[11px] font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span className="truncate">{change}</span>
          </div>

          {sparklineData && sparklineData.length > 1 && (
            <div className="w-14 h-6 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.spark} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={c.spark} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={c.spark}
                    strokeWidth={1.5}
                    fill={`url(#spark-${color})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Ratio bar — always reserves space */}
        {ratioBar && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(ratioBar.percentage, 100)}%`,
                  background: ratioBar.color || c.spark,
                }}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              {ratioBar.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
