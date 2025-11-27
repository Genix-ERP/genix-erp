import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

const colorVariants = {
  green: {
    bg: "from-emerald-50 to-green-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    trend: "text-emerald-600",
    accent: "from-emerald-500 to-green-600"
  },
  blue: {
    bg: "from-blue-50 to-cyan-50", 
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    trend: "text-blue-600",
    accent: "from-blue-500 to-cyan-600"
  },
  purple: {
    bg: "from-purple-50 to-violet-50",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600", 
    trend: "text-purple-600",
    accent: "from-purple-500 to-violet-600"
  },
  orange: {
    bg: "from-orange-50 to-amber-50",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    trend: "text-orange-600",
    accent: "from-orange-500 to-amber-600"
  }
};

export default function MetricCard({ title, value, change, trend, icon: Icon, color = "blue" }) {
  const colorScheme = colorVariants[color];
  
  const getTrendIcon = () => {
    switch(trend) {
      case "up":
        return <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />;
      case "down": 
        return <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />;
      case "warning":
        return <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />;
      default:
        return <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />;
    }
  };

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${colorScheme.bg} border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300`}>
      <CardContent className="p-5 md:p-6">
        {/* Icon at top */}
        <div className={`w-12 h-12 md:w-14 md:h-14 ${colorScheme.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
          <Icon className={`w-6 h-6 md:w-7 md:h-7 ${colorScheme.iconColor}`} />
        </div>
        
        {/* Content */}
        <div className="space-y-2">
          <p className="text-xs md:text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{value}</p>
          
          {/* Trend indicator */}
          <div className={`flex items-center gap-1.5 text-xs md:text-sm font-semibold ${
            trend === "warning" ? "text-orange-600" : colorScheme.trend
          }`}>
            {getTrendIcon()}
            <span>{change}</span>
          </div>
        </div>

        {/* Decorative gradient accent */}
        <div className={`absolute -bottom-1 -right-1 w-24 h-24 bg-gradient-to-br ${colorScheme.accent} opacity-5 rounded-full blur-2xl`}></div>
      </CardContent>
    </Card>
  );
}