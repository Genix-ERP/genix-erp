
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain,
  AlertTriangle,
  CheckCircle,
  Target,
  Lightbulb
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { analyzeFinancials } from "@/api/services/aiAnalytics";

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function FinanceDashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { financialTransactions, isLoading } = useFinancials();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  // AI Analysis using real data
  const financialAnalysis = useMemo(() =>
    analyzeFinancials(financialTransactions, [], [], language, formatCurrency),
    [financialTransactions, language, formatCurrency]
  );

  const [cashFlowData, setCashFlowData] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);

  useEffect(() => {
    if (financialTransactions.length > 0) {
      calculateChartData();
    }
  }, [financialTransactions, language]);

  const calculateChartData = () => {
    // Calculate monthly data for charts
    const monthlyData = {};
    financialTransactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, income: 0, expenses: 0 };
      }

      if (t.transaction_type === 'income') {
        monthlyData[monthKey].income += t.amount;
      } else if (t.transaction_type === 'expense') {
        monthlyData[monthKey].expenses += t.amount;
      }
    });

    const cashFlow = Object.values(monthlyData)
      .sort((a, b) => new Date(a.month) - new Date(b.month))
      .slice(-6);

    setCashFlowData(cashFlow);

    // Calculate expenses by category
    const categoryData = {};
    financialTransactions
      .filter(t => t.transaction_type === 'expense')
      .forEach(t => {
        const cat = t.category || 'other';
        categoryData[cat] = (categoryData[cat] || 0) + t.amount;
      });

    const expenseBreakdown = Object.entries(categoryData)
      .map(([category, amount]) => ({
        category: t(category) || category.charAt(0).toUpperCase() + category.slice(1),
        amount: amount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    setExpensesByCategory(expenseBreakdown);
  };

  // Get metrics from AI analysis
  const metrics = {
    totalIncome: financialAnalysis.metrics?.totalIncome || 0,
    totalExpenses: financialAnalysis.metrics?.totalExpenses || 0,
    netProfit: financialAnalysis.metrics?.netProfit || 0,
    profitMargin: financialAnalysis.metrics?.profitMargin || 0
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Income Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-green-50/30 border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="px-2.5 py-1 bg-green-100 rounded-full">
                <span className="text-xs font-semibold text-green-700">+12%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t('total_income')}</p>
              <p className="text-3xl font-bold text-green-600 tabular-nums">
                {formatCurrencyCompact(metrics.totalIncome)}
              </p>
              <p className="text-xs text-slate-500 mt-2">{t('vs_last_month') || 'vs last month'}</p>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-green-500/5 rounded-tl-full"></div>
          </CardContent>
        </Card>

        {/* Total Expenses Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-red-50/30 border-red-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div className="px-2.5 py-1 bg-red-100 rounded-full">
                <span className="text-xs font-semibold text-red-700">+8%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t('total_expenses')}</p>
              <p className="text-3xl font-bold text-red-600 tabular-nums">
                {formatCurrencyCompact(metrics.totalExpenses)}
              </p>
              <p className="text-xs text-slate-500 mt-2">{t('vs_last_month') || 'vs last month'}</p>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-500/5 rounded-tl-full"></div>
          </CardContent>
        </Card>

        {/* Net Profit Card */}
        <Card className={`relative overflow-hidden bg-gradient-to-br ${metrics.netProfit >= 0 ? 'from-white to-emerald-50/30 border-emerald-200/50' : 'from-white to-red-50/30 border-red-200/50'} shadow-lg hover:shadow-xl transition-all duration-300`}>
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${metrics.netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-xl flex items-center justify-center`}>
                <DollarSign className={`w-6 h-6 ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
              {metrics.netProfit >= 0 && (
                <div className="px-2.5 py-1 bg-emerald-100 rounded-full">
                  <span className="text-xs font-semibold text-emerald-700">+15%</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t('net_profit')}</p>
              <p className={`text-3xl font-bold tabular-nums ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrencyCompact(metrics.netProfit)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.netProfit >= 0 ? t('healthy_profit') || 'Healthy profit' : t('needs_attention') || 'Needs attention'}
              </p>
            </div>
            <div className={`absolute bottom-0 right-0 w-24 h-24 ${metrics.netProfit >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'} rounded-tl-full`}></div>
          </CardContent>
        </Card>

        {/* Profit Margin Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-purple-50/30 border-purple-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="px-2.5 py-1 bg-purple-100 rounded-full">
                <span className="text-xs font-semibold text-purple-700">{t('target') || 'Target'}: 35%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t('profit_margin')}</p>
              <p className={`text-3xl font-bold tabular-nums ${metrics.profitMargin >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {metrics.profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.profitMargin >= 30 ? t('excellent_margin') || 'Excellent margin' : metrics.profitMargin > 0 ? t('good_performance') || 'Good performance' : t('below_target') || 'Below target'}
              </p>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-purple-500/5 rounded-tl-full"></div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">{t('cash_flow_trends')}</CardTitle>
          </CardHeader>
          <CardContent>
            {cashFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrencyCompact(v)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="income" fill="#10b981" name={t('income')} />
                  <Bar dataKey="expenses" fill="#ef4444" name={t('expense')} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-500">
                {t('no_data')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">{t('expenses_by_category')}</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPieChart>
                  <Pie
                    data={expensesByCategory}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                    labelStyle={{ fontSize: 10 }}
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-500">
                {t('no_data')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Financial Intelligence - Moved to bottom */}
      {(financialAnalysis.insights.length > 0 || financialAnalysis.recommendations.length > 0) && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="w-5 h-5 text-green-600" />
              {t('ai_financial_intelligence') || 'AI Financial Intelligence'}
              <Badge className="bg-green-100 text-green-700 text-xs">{t('live') || 'Live'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* AI Insights */}
              {financialAnalysis.insights.slice(0, 3).map((insight, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                  <div className="flex items-start gap-3">
                    {insight.type === 'positive' ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    ) : insight.type === 'warning' || insight.type === 'negative' ? (
                      <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                    ) : (
                      <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{insight.description}</p>
                      {insight.metric && (
                        <p className="text-lg font-bold text-green-600 mt-2">{insight.metric}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Recommendations */}
            {financialAnalysis.recommendations.length > 0 && (
              <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-green-100">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 text-sm mb-2">{t('ai_recommendations') || 'AI Recommendations'}</h4>
                    <div className="flex flex-wrap gap-2">
                      {financialAnalysis.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs bg-slate-50 rounded-full px-3 py-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            rec.impact === 'high' ? 'bg-red-400' : rec.impact === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                          }`} />
                          <span className="text-slate-700">{rec.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
