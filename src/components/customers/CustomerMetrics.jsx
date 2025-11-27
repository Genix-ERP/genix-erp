import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, DollarSign, TrendingUp } from "lucide-react";
import { useTranslation } from "@/components/utils/translations";

export default function CustomerMetrics({ customers, leads, opportunities, language = 'en' }) {
  const { t } = useTranslation(language);
  
  const metrics = React.useMemo(() => {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status === 'active').length;
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(l => l.status === 'qualified').length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.monthly_value || 0), 0) * 12;
    const avgDealSize = opportunities.length > 0 
      ? opportunities.reduce((sum, o) => sum + (o.expected_value || 0), 0) / opportunities.length 
      : 0;

    return {
      totalCustomers,
      activeCustomers,
      totalLeads,
      qualifiedLeads,
      totalRevenue,
      avgDealSize
    };
  }, [customers, leads, opportunities]);

  const metricCards = [
    {
      title: t('total_customers'),
      value: metrics.totalCustomers.toLocaleString(),
      change: "+12%",
      changeText: t('vs_last_month'),
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      gradient: "from-blue-50 to-blue-100/50"
    },
    {
      title: t('active_customers'),
      value: metrics.activeCustomers.toLocaleString(),
      change: "+8%",
      changeText: t('vs_last_month'),
      icon: UserPlus,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      gradient: "from-green-50 to-green-100/50"
    },
    {
      title: t('annual_revenue'),
      value: `$${metrics.totalRevenue.toLocaleString()}`,
      change: "+15%",
      changeText: t('vs_last_month'),
      icon: DollarSign,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      gradient: "from-emerald-50 to-emerald-100/50"
    },
    {
      title: t('avg_deal_size'),
      value: `$${Math.round(metrics.avgDealSize).toLocaleString()}`,
      change: "+5%",
      changeText: t('vs_last_month'),
      icon: TrendingUp,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      gradient: "from-purple-50 to-purple-100/50"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {metricCards.map((metric, index) => (
        <Card 
          key={index} 
          className="bg-white border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 mb-1">{metric.title}</p>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">{metric.value}</p>
              </div>
              <div className={`${metric.iconBg} p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <metric.icon className={`w-6 h-6 ${metric.iconColor}`} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-600">{metric.change}</span>
              <span className="text-xs text-slate-500">{metric.changeText}</span>
            </div>
            <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10`}></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}