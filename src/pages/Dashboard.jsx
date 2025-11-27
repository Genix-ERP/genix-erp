
import React, { useState, useEffect } from "react";
import { Customer, InventoryItem, FinancialTransaction, Workflow } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
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
  Brain
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

import MetricCard from "@/components/dashboard/MetricCard";
import AIInsightCard from "@/components/dashboard/AIInsightCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import InventoryAlerts from "@/components/dashboard/InventoryAlerts";
import RecentCustomers from "@/components/dashboard/RecentCustomers";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Dashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
    generateAIInsights();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [customerData, inventoryData, transactionData, workflowData] = await Promise.all([
        Customer.list("-created_date", 10),
        InventoryItem.list("-created_date", 20),
        FinancialTransaction.list("-date", 50),
        Workflow.list("-created_date", 10)
      ]);

      setCustomers(customerData);
      setInventory(inventoryData);
      setTransactions(transactionData);
      setWorkflows(workflowData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const generateAIInsights = async () => {
    try {
      const insights = await InvokeLLM({
        prompt: `As an AI business analyst for an ERP system, provide 3 key business insights and recommendations. Focus on:
        1. Revenue trends and opportunities
        2. Operational efficiency improvements
        3. Risk management suggestions

        Make insights actionable and specific to SMB needs. Each insight should have a confidence level and suggested action.`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  confidence: { type: "number" },
                  action: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        }
      });
      setAiInsights(insights.insights);
    } catch (error) {
      console.error("Error generating AI insights:", error);
    }
  };

  const calculateMetrics = () => {
    const totalRevenue = transactions
      .filter(t => t.transaction_type === "income")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenses = transactions
      .filter(t => t.transaction_type === "expense")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const lowStockItems = inventory.filter(item =>
      item.current_stock <= item.reorder_level
    ).length;

    const activeWorkflows = workflows.filter(w => w.status === "active").length;

    const avgCostSavings = workflows
      .filter(w => w.cost_savings)
      .reduce((sum, w) => sum + w.cost_savings, 0);

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalCustomers: customers.length,
      lowStockItems,
      activeWorkflows,
      avgCostSavings
    };
  };

  const metrics = calculateMetrics();

  const revenueChartData = React.useMemo(() => {
    const monthlyRevenue = {};
    transactions
      .filter(t => t.transaction_type === "income")
      .forEach(t => {
        const month = new Date(t.date).toLocaleString('default', { month: 'short' });
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + t.amount;
      });

    return Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue)
    }));
  }, [transactions]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-6 md:mb-8">
          <div className="bg-gradient-to-r from-[var(--genix-blue)] via-[var(--genix-purple)] to-[var(--genix-blue)] p-6 md:p-8 rounded-2xl text-white relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
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
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-white/5 rounded-full -translate-y-24 md:-translate-y-32 translate-x-24 md:translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-32 md:w-48 h-32 md:h-48 bg-white/5 rounded-full translate-y-16 md:translate-y-24 -translate-x-16 md:-translate-x-24"></div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <MetricCard
            title={t("revenue")}
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            change="+12%"
            trend="up"
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            title={t("customers")}
            value={metrics.totalCustomers.toLocaleString()}
            change="+8%"
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
            value={`$${metrics.avgCostSavings.toLocaleString()}/mo`}
            change={t("from_ai_automation")}
            trend="up"
            icon={Zap}
            color="purple"
          />
        </div>

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

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mt-6 md:mt-8">
          <RecentCustomers customers={customers} />

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-[var(--genix-purple)]" />
                {t('active_workflows')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workflows.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {workflows.slice(0, 5).map((workflow) => (
                    <div key={workflow.id} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base text-slate-900 truncate">{workflow.name}</p>
                        <p className="text-xs md:text-sm text-slate-500 truncate">{workflow.category}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <Badge
                          variant={workflow.status === "active" ? "default" : "secondary"}
                          className={workflow.status === "active" ? "bg-[var(--genix-green)]/10 text-[var(--genix-green)]" : ""}
                        >
                          {workflow.status}
                        </Badge>
                        {workflow.success_rate && (
                          <span className="text-xs md:text-sm text-slate-600 hidden sm:inline">{workflow.success_rate}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <Link to={createPageUrl("Workflows")}>
                    <Button variant="outline" className="w-full mt-4 text-sm md:text-base">
                      {t('view_all_workflows')} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Zap className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm md:text-base">{t('no_workflows_configured')}</p>
                  <Link to={createPageUrl("Workflows")}>
                    <Button className="mt-4 text-sm md:text-base">{t('create_first_workflow')}</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Insights - Moved to bottom */}
        {aiInsights && aiInsights.length > 0 && (
          <div className="mb-6 md:mb-8 mt-6 md:mt-8"> {/* Added margin top for separation */}
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <Brain className="w-5 h-5 md:w-6 md:h-6 text-[var(--genix-purple)]" />
              <h3 className="text-lg md:text-xl font-bold text-[var(--genix-navy)]">{t('ai_generated_insights')}</h3>
              <Badge variant="secondary" className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)]">
                {t('live')}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {aiInsights.map((insight, index) => (
                <AIInsightCard key={index} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
