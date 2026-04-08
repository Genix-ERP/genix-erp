
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  TrendingUp,
  Users,
  Package,
  DollarSign,
  Zap,
  Brain,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Activity,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Briefcase,
  UserCheck,
  Target
} from "lucide-react";

import MetricCard from "@/components/dashboard/MetricCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import RecentCustomers from "@/components/dashboard/RecentCustomers";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useModules } from "@/components/contexts/ModulesContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

import {
  analyzeSales,
  analyzeInventory,
  analyzeFinancials,
  analyzeHR,
  analyzeProjects,
  analyzeBusinessHealth
} from "@/api/services/aiAnalytics";

export default function Dashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const { items: inventory, stockMovements, refreshData: refreshInventory } = useInventory();
  const { financialTransactions, customerInvoices, vendorBills, refreshData: refreshFinancials } = useFinancials();
  const { customers, leads, opportunities, refreshData: refreshCustomers } = useCustomers();
  const { employees, salesOrders, projects, expenses, payrolls, refreshData: refreshModules } = useModules();

  const [isLoading, setIsLoading] = useState(true);

  // Refresh all data when navigating to dashboard
  useEffect(() => {
    refreshInventory();
    refreshFinancials();
    refreshCustomers();
    refreshModules();
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const salesAnalysis = useMemo(() => analyzeSales(salesOrders, customers, language), [salesOrders, customers, language]);
  const inventoryAnalysis = useMemo(() => analyzeInventory(inventory, stockMovements, language), [inventory, stockMovements, language]);
  const financialAnalysis = useMemo(() => analyzeFinancials(financialTransactions, [], [], language), [financialTransactions, language]);
  const hrAnalysis = useMemo(() => analyzeHR(employees, payrolls, language), [employees, payrolls, language]);
  const projectAnalysis = useMemo(() => analyzeProjects(projects, language), [projects, language]);

  const businessHealth = useMemo(() => analyzeBusinessHealth({
    salesOrders,
    inventory,
    transactions: financialTransactions,
    employees,
    projects,
    language
  }), [salesOrders, inventory, financialTransactions, employees, projects, language]);

  const metrics = useMemo(() => {
    const totalRevenue = financialTransactions
      .filter(t => t.transaction_type === "income")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenses = financialTransactions
      .filter(t => t.transaction_type === "expense")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const lowStockItems = inventory.filter(item =>
      item.current_stock <= (item.reorder_level || 10)
    ).length;

    const automationSavings = salesOrders.length * 15 +
      inventory.length * 5 +
      employees.length * 50;

    return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, totalCustomers: customers.length, lowStockItems, automationSavings };
  }, [financialTransactions, inventory, customers, salesOrders, employees]);

  const revenueChartData = useMemo(() => {
    const monthlyRevenue = {};
    financialTransactions
      .filter(t => t.transaction_type === "income")
      .forEach(t => {
        const month = new Date(t.date).toLocaleString('default', { month: 'short' });
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + t.amount;
      });
    return Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue)
    }));
  }, [financialTransactions]);

  const allInsights = useMemo(() => {
    const insights = [];
    if (salesAnalysis.insights) insights.push(...salesAnalysis.insights.slice(0, 2));
    if (inventoryAnalysis.insights) insights.push(...inventoryAnalysis.insights.slice(0, 2));
    if (financialAnalysis.insights) insights.push(...financialAnalysis.insights.slice(0, 1));
    if (hrAnalysis.insights) insights.push(...hrAnalysis.insights.slice(0, 1));
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return insights.sort((a, b) =>
      (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
    ).slice(0, 4);
  }, [salesAnalysis, inventoryAnalysis, financialAnalysis, hrAnalysis]);

  const allRecommendations = useMemo(() => [
    ...salesAnalysis.recommendations.slice(0, 2),
    ...inventoryAnalysis.recommendations.slice(0, 2),
    ...hrAnalysis.recommendations.slice(0, 1)
  ].slice(0, 4), [salesAnalysis, inventoryAnalysis, hrAnalysis]);

  const getInsightIcon = (type) => {
    switch (type) {
      case 'positive': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'negative': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const healthScore = businessHealth.score;
  const healthColor = healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-amber-600' : 'text-red-600';
  const healthBg = healthScore >= 80 ? 'bg-emerald-50' : healthScore >= 60 ? 'bg-amber-50' : 'bg-red-50';
  const healthBadge = healthScore >= 80 ? 'bg-emerald-100 text-emerald-700' : healthScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  const healthRing = healthScore >= 80 ? 'stroke-emerald-500' : healthScore >= 60 ? 'stroke-amber-500' : 'stroke-red-500';

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Health Score + Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Health Score */}
          <div className={`${healthBg} rounded-2xl border border-slate-100 p-5 flex flex-col items-center justify-center`}>
            <div className="relative w-20 h-20 mb-3">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  className={healthRing}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(healthScore / 100) * 213.6} 213.6`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-1">{t('business_health')}</p>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${healthBadge}`}>
              {t(businessHealth.status).toUpperCase()}
            </span>
          </div>

          {/* Metric Cards */}
          <MetricCard
            title={t("revenue")}
            value={formatCurrency(metrics.totalRevenue)}
            change={salesAnalysis.metrics?.growthRate ? `${salesAnalysis.metrics.growthRate > 0 ? '+' : ''}${salesAnalysis.metrics.growthRate.toFixed(1)}%` : t("n_a")}
            trend={salesAnalysis.metrics?.growthRate > 0 ? "up" : salesAnalysis.metrics?.growthRate < 0 ? "down" : "neutral"}
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            title={t("customers")}
            value={metrics.totalCustomers.toLocaleString()}
            change={`${leads.length} ${t("leads")}`}
            trend="up"
            icon={Users}
            color="blue"
          />
          <MetricCard
            title={t("low_stock_items")}
            value={metrics.lowStockItems.toString()}
            change={metrics.lowStockItems > 0 ? `${metrics.lowStockItems} ${t("items")}` : t("all_good")}
            trend={metrics.lowStockItems > 0 ? "warning" : "up"}
            icon={Package}
            color={metrics.lowStockItems > 0 ? "orange" : "green"}
          />
        </div>

        {/* Charts + Inventory */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart data={revenueChartData} />
          </div>
          <div className="lg:col-span-1">
            <InventoryAlerts inventory={inventory} />
          </div>
        </div>

        {/* AI Insights + Recommendations */}
        {allInsights.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Insights */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-indigo-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{t('ai_generated_insights')}</h3>
                <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wide ml-auto">
                  {t('live')}
                </span>
              </div>
              <div className="space-y-2">
                {allInsights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100/50">
                    <div className="mt-0.5 shrink-0">{getInsightIcon(insight.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-medium text-slate-800 truncate">{insight.title}</h4>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          insight.priority === 'high' || insight.priority === 'critical'
                            ? 'bg-red-50 text-red-600'
                            : insight.priority === 'medium'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-blue-50 text-blue-600'
                        }`}>
                          {t(`priority_${insight.priority}`) || insight.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{insight.description}</p>
                      {insight.metric && (
                        <p className="text-base font-bold text-indigo-600 mt-1.5">{insight.metric}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 text-violet-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{t('ai_recommendations')}</h3>
              </div>
              {allRecommendations.length > 0 ? (
                <div className="space-y-2">
                  {allRecommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100/50">
                      <div className={`w-1.5 h-1.5 mt-2 rounded-full shrink-0 ${
                        rec.impact === 'high' ? 'bg-red-400' : rec.impact === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{rec.action}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{rec.description}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                        rec.impact === 'high' ? 'bg-red-50 text-red-600' : rec.impact === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {rec.impact === 'high' ? t('high_impact') : rec.impact === 'medium' ? t('medium_impact') : t('low_impact')}
                      </span>
                    </div>
                  ))}
                  <Link to={createPageUrl("AIAssistant")}>
                    <button className="w-full text-sm text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1 py-2 mt-1 transition-colors">
                      {t('get_more_ai_insights')} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-10">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-300" />
                  <p className="text-sm font-medium text-slate-600">{t('all_systems_optimal')}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('no_immediate_actions')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Customers + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RecentCustomers customers={customers} />
          </div>
          <div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('quick_overview') || t('pipeline')}</h3>
              <div className="space-y-1">
                <QuickStat
                  icon={ShoppingBag}
                  label={t('sales_orders')}
                  value={salesOrders.length}
                  sub={`${salesOrders.filter(o => o.status === 'confirmed').length} ${t('confirmed')}`}
                  color="blue"
                />
                <QuickStat
                  icon={Briefcase}
                  label={t('active_projects')}
                  value={projects.filter(p => {
                    const s = typeof p.status === 'string' ? p.status : (p.status?.String || '');
                    return s === 'active' || s === 'planning' || s === 'in_progress';
                  }).length}
                  sub={`${projects.length} ${t('total')}`}
                  color="emerald"
                />
                <QuickStat
                  icon={UserCheck}
                  label={t('employees')}
                  value={employees.filter(e => e.employment_status === 'active' || !e.employment_status).length}
                  sub={`${employees.filter(e => e.employment_status === 'on_leave').length} ${t('on_leave')}`}
                  color="violet"
                />
                <QuickStat
                  icon={Target}
                  label={t('pipeline')}
                  value={formatCurrency(opportunities.reduce((sum, o) => sum + (o.expected_value || 0), 0))}
                  sub={`${opportunities.length} ${t('opportunities')}`}
                  color="amber"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, sub, color }) {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    violet: "text-violet-600 bg-violet-50",
    amber: "text-amber-600 bg-amber-50",
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-base font-semibold text-slate-900 leading-tight">{value}</p>
      </div>
      <span className="text-xs text-slate-400">{sub}</span>
    </div>
  );
}
