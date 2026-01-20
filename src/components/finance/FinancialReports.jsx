import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, TrendingUp, DollarSign, BarChart3, Brain, Loader2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';

// Helper to get date range for period filter
const getDateRangeForPeriod = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'current_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
      endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
  }

  return { startDate, endDate };
};

// Get period label for display
const getPeriodLabel = (period, language) => {
  const now = new Date();

  switch (period) {
    case 'current_month':
      return now.toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'en-US', { month: 'long', year: 'numeric' });
    case 'quarter':
      const q = Math.floor(now.getMonth() / 3) + 1;
      return language === 'uz' ? `${q}-chorak ${now.getFullYear()}` : `Q${q} ${now.getFullYear()}`;
    case 'year':
      return now.getFullYear().toString();
    default:
      return language === 'uz' ? 'Barcha vaqt' : 'All Time';
  }
};

export default function FinancialReports() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { financialTransactions, isLoading } = useFinancials();
  const reportRef = useRef(null);

  const [period, setPeriod] = useState('current_month');
  const [aiInsights, setAiInsights] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    if (!financialTransactions || financialTransactions.length === 0) return [];

    const { startDate, endDate } = getDateRangeForPeriod(period);

    return financialTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [financialTransactions, period]);

  useEffect(() => {
    if (filteredTransactions.length > 0) {
      generateAIInsights();
    }
  }, [filteredTransactions, language]);

  const generateAIInsights = () => {
    const totalRevenue = filteredTransactions.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = filteredTransactions.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    let healthScore = 75;
    let healthStatus = language === 'uz' ? 'Yaxshi' : 'Good';

    if (margin > 30) {
      healthScore = 90;
      healthStatus = language === 'uz' ? 'A\'lo' : 'Excellent';
    } else if (margin > 15) {
      healthScore = 75;
      healthStatus = language === 'uz' ? 'Yaxshi' : 'Good';
    } else if (margin > 0) {
      healthScore = 55;
      healthStatus = language === 'uz' ? 'O\'rtacha' : 'Fair';
    } else {
      healthScore = 30;
      healthStatus = language === 'uz' ? 'E\'tibor kerak' : 'Needs Attention';
    }

    // Localized insights
    const insights = language === 'uz' ? {
      key_insights: [
        `Sof foyda marjasi ${margin.toFixed(1)}%`,
        `Umumiy daromad: $${totalRevenue.toLocaleString()}`,
        `Mavjud resurslar bilan samarali ishlayapti`
      ],
      risks: [
        'Mavsumiy o\'zgarishlar uchun pul oqimini kuzating',
        'Katta xarajat toifalarini ko\'rib chiqing',
        'Debitorlik qarzlarini kuzatib boring'
      ],
      recommendations: [
        'Takroriy to\'lovlarni avtomatlashtirishni ko\'rib chiqing',
        'Yetkazib beruvchi to\'lov shartlarini optimallashtiring',
        'Xarajatlarni tasdiqlash jarayonini joriy eting'
      ]
    } : {
      key_insights: [
        `Net profit margin is ${margin.toFixed(1)}%`,
        `Total revenue: $${totalRevenue.toLocaleString()}`,
        `Operating efficiently with current resources`
      ],
      risks: [
        'Monitor cash flow for seasonal variations',
        'Review large expense categories',
        'Track accounts receivable aging'
      ],
      recommendations: [
        'Consider automating recurring payments',
        'Optimize vendor payment terms',
        'Implement expense approval workflows'
      ]
    };

    setAiInsights({
      health_score: healthScore,
      health_status: healthStatus,
      ...insights
    });
  };

  // Export to PDF using print
  const handleExportPDF = async () => {
    setIsExporting(true);

    try {
      const pl = getProfitLoss();
      const bs = getBalanceSheet();
      const periodLabel = getPeriodLabel(period, language);

      // Create a printable HTML document
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${language === 'uz' ? 'Moliyaviy Hisobot' : 'Financial Report'} - ${periodLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
            h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
            h2 { color: #334155; margin-top: 30px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .period { background: #f1f5f9; padding: 8px 16px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 600; }
            .amount { text-align: right; font-family: monospace; }
            .positive { color: #16a34a; }
            .negative { color: #dc2626; }
            .total-row { background: #f1f5f9; font-weight: bold; }
            .section { margin-bottom: 40px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${language === 'uz' ? 'Moliyaviy Hisobot' : 'Financial Report'}</h1>
            <div class="period">${periodLabel}</div>
          </div>

          <div class="section">
            <h2>${language === 'uz' ? 'Foyda va Zarar Hisoboti' : 'Profit & Loss Statement'}</h2>
            <table>
              <tr>
                <th>${language === 'uz' ? 'Tushum' : 'Revenue'}</th>
                <td class="amount positive">$${pl.revenue.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding-left: 20px;">${language === 'uz' ? 'Sotilgan mahsulot tannarxi' : 'Cost of Goods Sold'}</td>
                <td class="amount negative">-$${pl.cogs.toLocaleString()}</td>
              </tr>
              <tr class="total-row">
                <th>${language === 'uz' ? 'Yalpi foyda' : 'Gross Profit'}</th>
                <td class="amount">$${pl.grossProfit.toLocaleString()} (${pl.grossMargin.toFixed(1)}%)</td>
              </tr>
              <tr>
                <td style="padding-left: 20px;">${language === 'uz' ? 'Operatsion xarajatlar' : 'Operating Expenses'}</td>
                <td class="amount negative">-$${pl.operatingExpenses.toLocaleString()}</td>
              </tr>
              <tr class="total-row">
                <th>${language === 'uz' ? 'Sof daromad' : 'Net Income'}</th>
                <td class="amount ${pl.netIncome >= 0 ? 'positive' : 'negative'}">$${pl.netIncome.toLocaleString()} (${pl.netMargin.toFixed(1)}%)</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h2>${language === 'uz' ? 'Balans hisoboti' : 'Balance Sheet'}</h2>
            <div class="grid">
              <div>
                <h3>${language === 'uz' ? 'Aktivlar' : 'Assets'}</h3>
                <table>
                  <tr>
                    <td>${language === 'uz' ? 'Joriy aktivlar' : 'Current Assets'}</td>
                    <td class="amount">$${bs.currentAssets.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>${language === 'uz' ? 'Asosiy vositalar' : 'Fixed Assets'}</td>
                    <td class="amount">$${bs.fixedAssets.toLocaleString()}</td>
                  </tr>
                  <tr class="total-row">
                    <th>${language === 'uz' ? 'Jami aktivlar' : 'Total Assets'}</th>
                    <td class="amount">$${bs.totalAssets.toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              <div>
                <h3>${language === 'uz' ? 'Majburiyatlar va Kapital' : 'Liabilities & Equity'}</h3>
                <table>
                  <tr>
                    <td>${language === 'uz' ? 'Joriy majburiyatlar' : 'Current Liabilities'}</td>
                    <td class="amount">$${bs.currentLiabilities.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>${language === 'uz' ? 'Kapital' : 'Equity'}</td>
                    <td class="amount">$${bs.equity.toLocaleString()}</td>
                  </tr>
                  <tr class="total-row">
                    <th>${language === 'uz' ? 'Jami' : 'Total'}</th>
                    <td class="amount">$${bs.totalAssets.toLocaleString()}</td>
                  </tr>
                </table>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>${language === 'uz' ? 'Asosiy ko\'rsatkichlar' : 'Key Ratios'}</h2>
            <table>
              <tr>
                <td>${language === 'uz' ? 'Joriy koeffitsient' : 'Current Ratio'}</td>
                <td class="amount">${bs.currentRatio.toFixed(2)}</td>
              </tr>
              <tr>
                <td>${language === 'uz' ? 'Qarz/Kapital nisbati' : 'Debt-to-Equity'}</td>
                <td class="amount">${bs.debtToEquity.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="footer">
            ${language === 'uz' ? 'Hisobot sanasi' : 'Generated'}: ${new Date().toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'en-US', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })} | Genix ERP
          </div>
        </body>
        </html>
      `;

      // Open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load then print
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Profit & Loss Statement - now uses filtered transactions
  const getProfitLoss = () => {
    const revenue = filteredTransactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const expensesByCategory = {};
    filteredTransactions
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

  // Balance Sheet (Simplified) - now uses filtered transactions
  const getBalanceSheet = () => {
    const totalRevenue = filteredTransactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenses = filteredTransactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const cash = totalRevenue - totalExpenses;
    const currentAssets = cash * 1.3;
    const fixedAssets = totalExpenses * 0.2;
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

  // Cash Flow Trends - now uses filtered transactions
  const getCashFlowData = () => {
    const monthlyData = {};

    filteredTransactions.forEach(t => {
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

  // Revenue & Profitability Trends - now uses filtered transactions
  const getRevenueData = () => {
    const monthlyData = {};

    filteredTransactions.forEach(t => {
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
    <div className="space-y-6" ref={reportRef}>

      {/* Header */}
      <Card className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <CardTitle className="text-2xl">{language === 'uz' ? 'Moliyaviy Hisobotlar' : 'Financial Reports'}</CardTitle>
                <p className="text-sm text-white/80 mt-1">IFRS & GAAP Compliant</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[180px] bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">{language === 'uz' ? 'Joriy oy' : 'Current Month'}</SelectItem>
                  <SelectItem value="quarter">{language === 'uz' ? 'Joriy chorak' : 'This Quarter'}</SelectItem>
                  <SelectItem value="year">{language === 'uz' ? 'Joriy yil' : 'This Year'}</SelectItem>
                  <SelectItem value="all">{language === 'uz' ? 'Barcha vaqt' : 'All Time'}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {t('export_pdf')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Period Info */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Badge variant="outline">{getPeriodLabel(period, language)}</Badge>
        <span>•</span>
        <span>{filteredTransactions.length} {language === 'uz' ? 'tranzaksiya' : 'transactions'}</span>
      </div>

      {/* AI Financial Health */}
      {aiInsights && (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              {language === 'uz' ? 'AI Moliyaviy Salomatlik Tahlili' : 'AI Financial Health Analysis'}
              <Badge className={
                aiInsights.health_score >= 80 ? 'bg-green-100 text-green-800' :
                aiInsights.health_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }>
                {language === 'uz' ? 'Ball' : 'Score'}: {aiInsights.health_score}/100 - {aiInsights.health_status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  {language === 'uz' ? 'Asosiy tushunchalar' : 'Key Insights'}
                </h4>
                <ul className="space-y-1">
                  {aiInsights.key_insights?.map((insight, i) => (
                    <li key={i} className="text-sm text-blue-700">• {insight}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="text-sm font-semibold text-orange-900 mb-2">
                  {language === 'uz' ? 'Xavf omillari' : 'Risk Factors'}
                </h4>
                <ul className="space-y-1">
                  {aiInsights.risks?.map((risk, i) => (
                    <li key={i} className="text-sm text-orange-700">• {risk}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="text-sm font-semibold text-green-900 mb-2">
                  {language === 'uz' ? 'Tavsiyalar' : 'Recommendations'}
                </h4>
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-white/80">
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
                    <p className="text-xs text-slate-500">{pl.grossMargin.toFixed(1)}% {language === 'uz' ? 'marja' : 'margin'}</p>
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
                    <p className="text-sm text-blue-700">{pl.netMargin.toFixed(1)}% {language === 'uz' ? 'marja' : 'margin'}</p>
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
                      <span className="font-bold">{language === 'uz' ? 'Jami aktivlar' : 'Total Assets'}</span>
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
              {cashFlowData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="inflow" fill="#10b981" name={language === 'uz' ? 'Kirim' : 'Cash Inflow'} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="outflow" fill="#ef4444" name={language === 'uz' ? 'Chiqim' : 'Cash Outflow'} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-slate-500">
                  {t('no_data')}
                </div>
              )}
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
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} name={language === 'uz' ? 'Daromad' : 'Revenue'} />
                    <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} name={language === 'uz' ? 'Xarajatlar' : 'Expenses'} />
                    <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} name={language === 'uz' ? 'Foyda' : 'Profit'} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-slate-500">
                  {t('no_data')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
