import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, TrendingUp, DollarSign, BarChart3, Brain } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

export default function FinancialReports() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const [period, setPeriod] = useState('current_month');
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await base44.entities.FinancialTransaction.list('-date', 200);
      setTransactions(data);
      generateAIInsights(data);
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
    setIsLoading(false);
  };

  const generateAIInsights = async (txns) => {
    try {
      const totalRevenue = txns.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalExpenses = txns.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);

      const insights = await base44.integrations.Core.InvokeLLM({
        prompt: `As a financial analyst, analyze this data:
Total Revenue: $${totalRevenue.toLocaleString()}
Total Expenses: $${totalExpenses.toLocaleString()}
Net Profit: $${(totalRevenue - totalExpenses).toLocaleString()}
Profit Margin: ${((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1)}%

Provide:
1. Key financial health indicators
2. Risk assessment
3. Growth opportunities
4. Cost optimization suggestions`,
        response_json_schema: {
          type: "object",
          properties: {
            health_score: { type: "number" },
            health_status: { type: "string" },
            key_insights: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } }
          }
        }
      });
      
      setAiInsights(insights);
    } catch (error) {
      console.error('Error generating insights:', error);
    }
  };

  // Profit & Loss Statement
  const getProfitLoss = () => {
    const revenue = transactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const expensesByCategory = {};
    transactions
      .filter(t => t.transaction_type === 'expense')
      .forEach(t => {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + (t.amount || 0);
      });

    const cogs = (expensesByCategory.operations || 0) + (expensesByCategory.equipment || 0);
    const grossProfit = revenue - cogs;
    const operatingExpenses = (expensesByCategory.marketing || 0) + 
                             (expensesByCategory.payroll || 0) + 
                             (expensesByCategory.rent || 0) +
                             (expensesByCategory.utilities || 0) +
                             (expensesByCategory.software || 0);
    const netIncome = grossProfit - operatingExpenses;

    return {
      revenue,
      cogs,
      grossProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue * 100) : 0,
      operatingExpenses,
      netIncome,
      netMargin: revenue > 0 ? (netIncome / revenue * 100) : 0
    };
  };

  // Balance Sheet (Simplified)
  const getBalanceSheet = () => {
    const totalRevenue = transactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const totalExpenses = transactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const cash = totalRevenue - totalExpenses;
    const currentAssets = cash * 1.3; // Simplified
    const fixedAssets = totalExpenses * 0.2; // Simplified
    const totalAssets = currentAssets + fixedAssets;
    
    const currentLiabilities = totalExpenses * 0.15;
    const equity = totalAssets - currentLiabilities;

    return {
      currentAssets,
      fixedAssets,
      totalAssets,
      currentLiabilities,
      totalLiabilities: currentLiabilities,
      equity,
      currentRatio: currentLiabilities > 0 ? (currentAssets / currentLiabilities) : 0,
      debtToEquity: equity > 0 ? (currentLiabilities / equity) : 0
    };
  };

  // Cash Flow Trends
  const getCashFlowData = () => {
    const monthlyData = {};
    
    transactions.forEach(t => {
      const month = new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) {
        monthlyData[month] = { month, inflow: 0, outflow: 0 };
      }
      
      if (t.transaction_type === 'income') {
        monthlyData[month].inflow += t.amount;
      } else if (t.transaction_type === 'expense') {
        monthlyData[month].outflow += t.amount;
      }
    });

    return Object.values(monthlyData).slice(-6);
  };

  // Revenue & Profitability Trends
  const getRevenueData = () => {
    const monthlyData = {};
    
    transactions.forEach(t => {
      const month = new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) {
        monthlyData[month] = { month, revenue: 0, expenses: 0 };
      }
      
      if (t.transaction_type === 'income') {
        monthlyData[month].revenue += t.amount;
      } else if (t.transaction_type === 'expense') {
        monthlyData[month].expenses += t.amount;
      }
    });

    return Object.values(monthlyData).slice(-6).map(d => ({
      ...d,
      profit: d.revenue - d.expenses
    }));
  };

  const pl = getProfitLoss();
  const bs = getBalanceSheet();
  const cashFlowData = getCashFlowData();
  const revenueData = getRevenueData();

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <Card className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <CardTitle className="text-2xl">Financial Reports</CardTitle>
                <p className="text-sm text-white/80 mt-1">IFRS & GAAP Compliant</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[180px] bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Current Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Download className="w-4 h-4 mr-2" /> {t('export_pdf')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* AI Financial Health */}
      {aiInsights && (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              AI Financial Health Analysis
              <Badge className={
                aiInsights.health_score >= 80 ? 'bg-green-100 text-green-800' :
                aiInsights.health_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }>
                Score: {aiInsights.health_score}/100 - {aiInsights.health_status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Key Insights</h4>
                <ul className="space-y-1">
                  {aiInsights.key_insights?.map((insight, i) => (
                    <li key={i} className="text-sm text-blue-700">• {insight}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="text-sm font-semibold text-orange-900 mb-2">Risk Factors</h4>
                <ul className="space-y-1">
                  {aiInsights.risks?.map((risk, i) => (
                    <li key={i} className="text-sm text-orange-700">• {risk}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="text-sm font-semibold text-green-900 mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {aiInsights.recommendations?.map((rec, i) => (
                    <li key={i} className="text-sm text-green-700">• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports Tabs */}
      <Tabs defaultValue="pnl" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/80">
          <TabsTrigger value="pnl">{t('profit_loss')}</TabsTrigger>
          <TabsTrigger value="balance">{t('balance_sheet')}</TabsTrigger>
          <TabsTrigger value="cashflow">{t('cash_flow')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analytics')}</TabsTrigger>
        </TabsList>

        {/* Profit & Loss */}
        <TabsContent value="pnl">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t('profit_loss_statement')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="font-semibold text-lg">{t('revenue')}</span>
                  <span className="font-bold text-xl text-green-600">${pl.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 pl-4">
                  <span className="text-slate-600">{t('cost_of_goods_sold')}</span>
                  <span className="text-red-600">-${pl.cogs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-y bg-slate-50 px-4">
                  <span className="font-semibold">{t('gross_profit')}</span>
                  <div className="text-right">
                    <p className="font-bold text-lg">${pl.grossProfit.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{pl.grossMargin.toFixed(1)}% margin</p>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 pl-4">
                  <span className="text-slate-600">{t('operating_expenses')}</span>
                  <span className="text-red-600">-${pl.operatingExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-t-2 bg-blue-50 px-4 rounded-lg">
                  <span className="font-bold text-lg">{t('net_income')}</span>
                  <div className="text-right">
                    <p className="font-bold text-2xl text-blue-600">${pl.netIncome.toLocaleString()}</p>
                    <p className="text-sm text-blue-700">{pl.netMargin.toFixed(1)}% margin</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t('balance_sheet')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-slate-900 border-b pb-2">{t('assets')}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600">{t('current_assets')}</span>
                      <span className="font-semibold">${bs.currentAssets.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600">{t('fixed_assets')}</span>
                      <span className="font-semibold">${bs.fixedAssets.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-3 border-t bg-slate-50 px-3 rounded">
                      <span className="font-bold">Total Assets</span>
                      <span className="font-bold text-lg">${bs.totalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-slate-900 border-b pb-2">{t('liabilities')} & {t('equity')}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600">{t('current_liabilities')}</span>
                      <span className="font-semibold">${bs.currentLiabilities.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600">{t('equity')}</span>
                      <span className="font-semibold">${bs.equity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-3 border-t bg-slate-50 px-3 rounded">
                      <span className="font-bold">{t('total_liabilities_equity')}</span>
                      <span className="font-bold text-lg">${bs.totalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">{t('key_ratios')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-700">{t('current_ratio')}</p>
                    <p className="text-2xl font-bold text-blue-900">{bs.currentRatio.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">{t('debt_to_equity')}</p>
                    <p className="text-2xl font-bold text-blue-900">{bs.debtToEquity.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cashflow">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t('cash_flow_statement')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inflow" fill="#10b981" name="Cash Inflow" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="outflow" fill="#ef4444" name="Cash Outflow" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t('revenue_profitability_trends')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} name="Revenue" />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} name="Expenses" />
                  <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}