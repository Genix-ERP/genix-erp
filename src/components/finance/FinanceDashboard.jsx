
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { Badge } from "@/components/ui/badge";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { analyzeFinancialsFromMetrics } from "@/api/services/aiAnalytics";
import financeService from "@/api/services/finance";

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

export default function FinanceDashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { isLoading } = useFinancials();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [monthlyFlowData, setMonthlyFlowData] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);

  // Fetch metrics from Income Statement API (same source as P&L report)
  const [metrics, setMetrics] = useState({ totalIncome: 0, totalExpenses: 0, netProfit: 0, profitMargin: 0 });

  // AI Analysis using real Income Statement metrics
  const financialAnalysis = useMemo(() =>
    analyzeFinancialsFromMetrics({ ...metrics, expensesByCategory }, language, formatCurrency),
    [metrics, expensesByCategory, language, formatCurrency]
  );

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await financeService.getIncomeStatement();
        if (data) {
          const totalIncome = data.total_revenue || 0;
          const cogsItems = data.cost_of_sales || [];
          const opexItems = data.operating_expenses || [];
          const otherExpItems = data.other_expenses || [];
          const cogsTotal = cogsItems.reduce((s, a) => s + Math.abs(a.amount || 0), 0);
          const opexTotal = opexItems.reduce((s, a) => s + Math.abs(a.amount || 0), 0);
          const otherExpTotal = otherExpItems.reduce((s, a) => s + Math.abs(a.amount || 0), 0);
          const totalExpenses = cogsTotal + opexTotal + otherExpTotal;
          const netProfit = data.net_income ?? (totalIncome - totalExpenses);
          const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
          setMetrics({ totalIncome, totalExpenses, netProfit, profitMargin });

          // Map English account names to translation keys
          const accountNameMap = {
            'Cost of Goods Sold': 'cost_of_goods_sold',
            'Salaries & Wages': 'salaries_wages',
            'Rent Expense': 'rent_expense',
            'Utilities': 'utilities',
            'Office Supplies': 'office_supplies',
            'Marketing': 'marketing',
            'Insurance': 'insurance',
            'Depreciation': 'depreciation',
            'Interest Expense': 'interest_expense',
          };
          const translateAccountName = (name) => {
            const key = accountNameMap[name];
            if (key) {
              const translated = t(key);
              if (translated !== key) return translated;
            }
            return name;
          };

          // Build expense breakdown by individual accounts
          const categoryBreakdown = [];
          [...cogsItems, ...opexItems, ...otherExpItems].forEach(item => {
            const amount = Math.abs(item.amount || 0);
            if (amount > 0) {
              categoryBreakdown.push({
                category: translateAccountName(item.account_name || item.name) || t('other'),
                amount,
              });
            }
          });
          categoryBreakdown.sort((a, b) => b.amount - a.amount);
          setExpensesByCategory(categoryBreakdown.slice(0, 8));
        }
      } catch (err) {
        console.error('Failed to fetch income statement for dashboard:', err);
      }

      // Fetch monthly income/expense flow for chart
      try {
        const now = new Date();
        const monthlyData = [];
        // Fetch last 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          const monthNames = {
            en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
            ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
          };
          const names = monthNames[language] || monthNames.en;
          const label = `${names[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
          monthlyData.push({ month: label, from, to });
        }

        const results = await Promise.all(
          monthlyData.map(m => financeService.getIncomeStatement({ period_from: m.from, period_to: m.to }).catch(() => null))
        );

        const flowData = monthlyData.map((m, i) => {
          const d = results[i];
          const income = d?.total_revenue || 0;
          const cogs = (d?.cost_of_sales || []).reduce((s, a) => s + Math.abs(a.amount || 0), 0);
          const opex = (d?.operating_expenses || []).reduce((s, a) => s + Math.abs(a.amount || 0), 0);
          const other = (d?.other_expenses || []).reduce((s, a) => s + Math.abs(a.amount || 0), 0);
          return { month: m.month, income, expenses: cogs + opex + other };
        });
        setMonthlyFlowData(flowData);
      } catch (err) {
        console.error('Failed to fetch monthly flow:', err);
      }
    };
    fetchDashboardData();
  }, []);

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
              <p className="text-xs text-slate-500 mt-2">{t('vs_last_month')}</p>
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
              <p className="text-xs text-slate-500 mt-2">{t('vs_last_month')}</p>
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
                {metrics.netProfit >= 0 ? t('healthy_profit') : t('needs_attention')}
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
                <span className="text-xs font-semibold text-purple-700">{t('target')}: 35%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t('profit_margin')}</p>
              <p className={`text-3xl font-bold tabular-nums ${metrics.profitMargin >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {metrics.profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {metrics.profitMargin >= 30 ? t('excellent_margin') : metrics.profitMargin > 0 ? t('good_performance') : t('below_target')}
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
            <CardTitle className="text-base md:text-lg">{t('income_expense_trends') || t('cash_flow_trends')}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyFlowData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(v)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill="#10b981" name={t('income')} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name={t('expense')} radius={[4, 4, 0, 0]} />
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
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPieChart>
                    <Pie
                      data={expensesByCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {expensesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5 max-h-[120px] overflow-y-auto">
                  {expensesByCategory.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-xs px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-slate-600 truncate max-w-[150px]">{item.category}</span>
                      </div>
                      <span className="font-medium text-slate-900">{formatCurrencyCompact(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
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
              {t('ai_financial_intelligence')}
              <Badge className="bg-green-100 text-green-700 text-xs">{t('live')}</Badge>
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
                    <h4 className="font-medium text-slate-900 text-sm mb-2">{t('ai_recommendations')}</h4>
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
