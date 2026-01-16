
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  DollarSign,
  Zap,
  Bot,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Brain,
  Activity,
  Target,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

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

  // Get data from all contexts
  const { items: inventory, stockMovements } = useInventory();
  const { financialTransactions, customerInvoices, vendorBills } = useFinancials();
  const { customers, leads, opportunities } = useCustomers();
  const { employees, salesOrders, projects, expenses, payrolls } = useModules();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Small delay to let contexts load
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Run AI analytics on actual data
  const salesAnalysis = useMemo(() => analyzeSales(salesOrders, customers, language), [salesOrders, customers, language]);
  const inventoryAnalysis = useMemo(() => analyzeInventory(inventory, stockMovements, language), [inventory, stockMovements, language]);
  const financialAnalysis = useMemo(() => analyzeFinancials(financialTransactions, [], [], language), [financialTransactions, language]);
  const hrAnalysis = useMemo(() => analyzeHR(employees, payrolls, language), [employees, payrolls, language]);
  const projectAnalysis = useMemo(() => analyzeProjects(projects, language), [projects, language]);

  // Business health score
  const businessHealth = useMemo(() => analyzeBusinessHealth({
    salesOrders,
    inventory,
    transactions: financialTransactions,
    employees,
    projects,
    language
  }), [salesOrders, inventory, financialTransactions, employees, projects, language]);

  // Calculate metrics from real data
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

    // Calculate estimated cost savings from automation
    const automationSavings = salesOrders.length * 15 + // $15 per order automated
      inventory.length * 5 + // $5 per inventory item tracked
      employees.length * 50; // $50 per employee HR automation

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalCustomers: customers.length,
      lowStockItems,
      automationSavings
    };
  }, [financialTransactions, inventory, customers, salesOrders, employees]);

  // Revenue chart data from real transactions
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

  // Combine all AI insights
  const allInsights = useMemo(() => {
    const insights = [];

    // Add top insights from each analysis
    if (salesAnalysis.insights) insights.push(...salesAnalysis.insights.slice(0, 2));
    if (inventoryAnalysis.insights) insights.push(...inventoryAnalysis.insights.slice(0, 2));
    if (financialAnalysis.insights) insights.push(...financialAnalysis.insights.slice(0, 1));
    if (hrAnalysis.insights) insights.push(...hrAnalysis.insights.slice(0, 1));

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return insights.sort((a, b) =>
      (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
    ).slice(0, 6);
  }, [salesAnalysis, inventoryAnalysis, financialAnalysis, hrAnalysis]);

  const getInsightIcon = (type) => {
    switch (type) {
      case 'positive': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'negative': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5 text-blue-500" />;
    }
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthBg = (score) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-amber-500';
    if (score >= 40) return 'from-orange-500 to-red-400';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section with Business Health */}
        <div className="mb-6 md:mb-8">
          <div className="bg-gradient-to-r from-[var(--genix-blue)] via-[var(--genix-purple)] to-[var(--genix-blue)] p-6 md:p-8 rounded-2xl text-white relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Bot className="w-6 h-6 md:w-8 md:h-8" />
                    <h2 className="text-xl md:text-2xl font-bold">{t('welcome_message')}</h2>
                  </div>
                  <p className="text-white/90 text-base md:text-lg mb-4 md:mb-6">
                    {t('dashboard_subtitle')}
                  </p>
                  <Link to={createPageUrl("AIAssistant")}>
                    <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm">
                      <Sparkles className="w-4 h-4 mr-2" />
                      {t('ask_ai_assistant')}
                    </Button>
                  </Link>
                </div>

                {/* Business Health Score */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-sm font-medium">Business Health</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-5xl font-bold ${businessHealth.score >= 60 ? 'text-white' : 'text-orange-300'}`}>
                      {businessHealth.score}
                    </span>
                    <span className="text-white/70 mb-2">/100</span>
                  </div>
                  <div className="mt-2">
                    <Badge className={`bg-gradient-to-r ${getHealthBg(businessHealth.score)} text-white border-0`}>
                      {businessHealth.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  {businessHealth.criticalIssues.length > 0 && (
                    <p className="text-xs text-white/70 mt-2">
                      {businessHealth.criticalIssues.length} issue(s) need attention
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-white/5 rounded-full -translate-y-24 md:-translate-y-32 translate-x-24 md:translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-32 md:w-48 h-32 md:h-48 bg-white/5 rounded-full translate-y-16 md:translate-y-24 -translate-x-16 md:-translate-x-24"></div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <MetricCard
            title={t("revenue")}
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            change={salesAnalysis.metrics?.growthRate ? `${salesAnalysis.metrics.growthRate > 0 ? '+' : ''}${salesAnalysis.metrics.growthRate.toFixed(1)}%` : "N/A"}
            trend={salesAnalysis.metrics?.growthRate > 0 ? "up" : salesAnalysis.metrics?.growthRate < 0 ? "down" : "neutral"}
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            title={t("customers")}
            value={metrics.totalCustomers.toLocaleString()}
            change={`${leads.length} leads`}
            trend="up"
            icon={Users}
            color="blue"
          />
          <MetricCard
            title={t("low_stock_items")}
            value={metrics.lowStockItems.toString()}
            change={metrics.lowStockItems > 0 ? t("action_needed") : t("all_good")}
            trend={metrics.lowStockItems > 0 ? "warning" : "up"}
            icon={Package}
            color={metrics.lowStockItems > 0 ? "orange" : "green"}
          />
          <MetricCard
            title={t("cost_savings")}
            value={`$${metrics.automationSavings.toLocaleString()}/mo`}
            change={t("from_ai_automation")}
            trend="up"
            icon={Zap}
            color="purple"
          />
        </div>

        {/* AI Insights Section */}
        {allInsights.length > 0 && (
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <Brain className="w-5 h-5 md:w-6 md:h-6 text-[var(--genix-purple)]" />
              <h3 className="text-lg md:text-xl font-bold text-[var(--genix-navy)]">{t('ai_generated_insights')}</h3>
              <Badge variant="secondary" className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)]">
                {t('live')}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {allInsights.map((insight, index) => (
                <Card key={index} className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-slate-900">{insight.title}</h4>
                          <Badge className={`text-xs ${
                            insight.priority === 'high' || insight.priority === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : insight.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}>
                            {insight.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{insight.description}</p>
                      </div>
                    </div>
                    {insight.metric && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <span className="text-2xl font-bold text-[var(--genix-blue)]">{insight.metric}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2">
            <RevenueChart data={revenueChartData} />
          </div>

          {/* Inventory Alerts */}
          <div className="lg:col-span-1">
            <InventoryAlerts inventory={inventory} />
          </div>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mt-6 md:mt-8">
          <RecentCustomers customers={customers} />

          {/* AI Recommendations */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Target className="w-4 h-4 md:w-5 md:h-5 text-[var(--genix-purple)]" />
                {t('ai_recommendations')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Combine recommendations from all analyses */}
                {[
                  ...salesAnalysis.recommendations.slice(0, 2),
                  ...inventoryAnalysis.recommendations.slice(0, 2),
                  ...hrAnalysis.recommendations.slice(0, 1)
                ].slice(0, 5).map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-lg">
                    <div className={`w-2 h-2 mt-2 rounded-full ${
                      rec.impact === 'high' ? 'bg-red-500' : rec.impact === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900">{rec.action}</p>
                      <p className="text-xs text-slate-500 mt-1">{rec.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {rec.impact === 'high' ? t('high_impact') : rec.impact === 'medium' ? t('medium_impact') : t('low_impact')}
                    </Badge>
                  </div>
                ))}

                {salesAnalysis.recommendations.length === 0 &&
                 inventoryAnalysis.recommendations.length === 0 &&
                 hrAnalysis.recommendations.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
                    <p>{t('all_systems_optimal')}</p>
                    <p className="text-sm">{t('no_immediate_actions')}</p>
                  </div>
                )}

                <Link to={createPageUrl("AIAssistant")}>
                  <Button variant="outline" className="w-full mt-4 text-sm md:text-base">
                    {t('get_more_ai_insights')} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 md:mt-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/50">
            <CardContent className="p-4">
              <div className="text-sm text-blue-600 font-medium">{t('sales_orders')}</div>
              <div className="text-2xl font-bold text-blue-900">{salesOrders.length}</div>
              <div className="text-xs text-blue-600/70 mt-1">
                {salesOrders.filter(o => o.status === 'confirmed').length} {t('confirmed')}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200/50">
            <CardContent className="p-4">
              <div className="text-sm text-green-600 font-medium">{t('active_projects')}</div>
              <div className="text-2xl font-bold text-green-900">
                {projects.filter(p => p.status === 'active').length}
              </div>
              <div className="text-xs text-green-600/70 mt-1">
                {projects.length} {t('total')}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/50">
            <CardContent className="p-4">
              <div className="text-sm text-purple-600 font-medium">{t('employees')}</div>
              <div className="text-2xl font-bold text-purple-900">{employees.length}</div>
              <div className="text-xs text-purple-600/70 mt-1">
                {hrAnalysis.metrics?.highRiskCount || 0} {t('at_risk')}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/50">
            <CardContent className="p-4">
              <div className="text-sm text-orange-600 font-medium">{t('pipeline')}</div>
              <div className="text-2xl font-bold text-orange-900">
                ${opportunities.reduce((sum, o) => sum + (o.expected_value || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs text-orange-600/70 mt-1">
                {opportunities.length} {t('opportunities')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
