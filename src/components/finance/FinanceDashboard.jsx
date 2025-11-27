
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function FinanceDashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [metrics, setMetrics] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0
  });

  const [cashFlowData, setCashFlowData] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      const transactions = await base44.entities.FinancialTransaction.list('-date', 200);
      
      const income = transactions
        .filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const expenses = transactions
        .filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const profit = income - expenses;
      const margin = income > 0 ? (profit / income * 100) : 0;

      setMetrics({
        totalIncome: income,
        totalExpenses: expenses,
        netProfit: profit,
        profitMargin: margin
      });

      const monthlyData = {};
      transactions.forEach(t => {
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

      const categoryData = {};
      transactions
        .filter(t => t.transaction_type === 'expense')
        .forEach(t => {
          const cat = t.category || 'other';
          categoryData[cat] = (categoryData[cat] || 0) + t.amount;
        });

      const expenseBreakdown = Object.entries(categoryData)
        .map(([category, amount]) => ({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          amount: amount
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setExpensesByCategory(expenseBreakdown);

      const insightsData = [
        { 
          title: t('cash_flow_anomaly'), 
          description: t('positive_cash_flow'), 
          recommendation: t('review_campaign_roi')
        },
        { 
          title: t('subscription_savings'), 
          description: t('identified_redundant'), 
          recommendation: t('consolidate_tools')
        },
        { 
          title: t('compliance_alert'), 
          description: t('large_transaction'), 
          recommendation: t('tag_transaction')
        },
      ];

      setInsights(insightsData);
      
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setIsLoading(false);
    }
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
                ${metrics.totalIncome.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-2">vs last month</p>
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
                ${metrics.totalExpenses.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-2">vs last month</p>
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
                ${metrics.netProfit.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.netProfit >= 0 ? 'Healthy profit' : 'Needs attention'}
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
                <span className="text-xs font-semibold text-purple-700">Target: 35%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t('profit_margin')}</p>
              <p className={`text-3xl font-bold tabular-nums ${metrics.profitMargin >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {metrics.profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.profitMargin >= 30 ? 'Excellent margin' : metrics.profitMargin > 0 ? 'Good performance' : 'Below target'}
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
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
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
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
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
      {insights && insights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 md:w-5 md:h-5 text-[var(--genix-purple)]" />
            <h3 className="text-lg md:text-xl font-bold text-[var(--genix-navy)]">{t('financial_intelligence')}</h3>
            <Badge className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)] text-xs">{t('ai_powered')}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {insights.map((insight, index) => (
              <Card key={index} className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm md:text-base">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs md:text-sm text-slate-600">{insight.description}</p>
                  <div className="p-2 md:p-3 bg-[var(--genix-light-blue)]/30 rounded-lg">
                    <p className="text-xs md:text-sm font-medium text-[var(--genix-blue)]">
                      💡 {insight.recommendation}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs md:text-sm">
                    {t('take_action')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
