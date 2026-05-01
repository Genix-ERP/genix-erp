import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Percent, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import Loader from '@/components/ui/loader';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

const STATUS_BADGE = {
  normal: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  over_budget: 'bg-red-100 text-red-700',
};

const STATE_BADGE = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  terminated: 'bg-red-100 text-red-700',
};

const FinancialTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [pnl, setPnl] = useState(null);
  const [budgetVsActual, setBudgetVsActual] = useState(null);
  const [costTrend, setCostTrend] = useState(null);
  const [paymentSchedule, setPaymentSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPageBva, setCurrentPageBva] = useState(1);
  const [currentPagePayments, setCurrentPagePayments] = useState(1);
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [pnlData, bvaData, trendData, payData] = await Promise.all([
        constructionService.getProjectPnL(project.id),
        constructionService.getBudgetVsActual(project.id),
        constructionService.getCostTrend(project.id),
        constructionService.getPaymentSchedule(project.id),
      ]);
      setPnl(pnlData);
      setBudgetVsActual(bvaData);
      setCostTrend(trendData);
      setPaymentSchedule(payData);
    } catch (e) {
      setError(t('financial_load_error') || 'Moliyaviy ma\'lumotlarni yuklashda xatolik');
      toast.error(t('financial_load_error') || 'Moliyaviy ma\'lumotlarni yuklashda xatolik');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  // --- P&L data ---
  const contractAmount = pnl?.contract_amount || 0;
  const estimateAmount = pnl?.estimate_amount || 0;
  const actualCost = pnl?.actual_cost || 0;
  const remainingBudget = pnl?.remaining_budget || (estimateAmount - actualCost);
  const profitForecast = pnl?.profit_forecast || (contractAmount - estimateAmount);
  const marginPct = contractAmount > 0 ? ((profitForecast / contractAmount) * 100) : 0;
  const progressPct = estimateAmount > 0 ? ((actualCost / estimateAmount) * 100) : 0;
  const costBreakdown = pnl?.cost_breakdown || [];

  // --- Budget vs Actual data ---
  const bvaRows = budgetVsActual?.items || budgetVsActual?.rows || [];
  const bvaChartData = bvaRows.map(row => ({
    name: row.wbs_code || row.name,
    planned: row.planned || 0,
    actual: row.actual || 0,
    status: row.status || 'normal',
  }));

  // --- Cost Trend data ---
  const trendItems = costTrend?.items || costTrend?.months || [];

  // --- Payment Schedule data ---
  const payments = paymentSchedule?.items || paymentSchedule || [];

  const getBarColor = (status) => {
    if (status === 'over_budget') return '#ef4444';
    if (status === 'warning') return '#f59e0b';
    return '#3b82f6';
  };

  const CurrencyTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section 1: P&L Summary Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          {t('financial_analysis') || 'Moliyaviy tahlil'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('contract_amount') || 'Shartnoma summasi'}</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(contractAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('estimate_amount') || 'Smeta summasi'}</p>
              <p className="text-xl font-bold text-slate-700">{formatCurrency(estimateAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('actual_cost') || 'Haqiqiy xarajat'}</p>
              <p className="text-xl font-bold text-slate-700">{formatCurrency(actualCost)}</p>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${progressPct < 90 ? 'bg-green-500' : progressPct <= 100 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{progressPct.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('remaining_budget') || 'Qolgan byudjet'}</p>
              <p className={`text-xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(remainingBudget)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('profit_forecast') || 'Foyda prognozi'}</p>
              <p className={`text-xl font-bold ${profitForecast >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profitForecast >= 0 ? '+' : ''}{formatCurrency(profitForecast)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('margin_percent') || 'Marja %'}</p>
              <p className={`text-xl font-bold ${marginPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {marginPct.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cost Breakdown Pie Chart */}
        {costBreakdown.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-5 h-5" />
                {t('cost_breakdown') || 'Xarajatlar tarkibi'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                    >
                      {costBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 2: Budget vs Actual by WBS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t('budget_vs_actual') || 'Byudjet va haqiqiy xarajat (WBS bo\'yicha)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bvaRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {t('no_budget_data') || 'Byudjet ma\'lumotlari topilmadi'}
            </div>
          ) : (
            <>
              <div className="h-72 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bvaChartData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="planned"
                      name={t('planned') || 'Rejalashtirilgan'}
                      fill="#94a3b8"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="actual"
                      name={t('actual') || 'Haqiqiy'}
                      radius={[0, 4, 4, 0]}
                    >
                      {bvaChartData.map((entry, i) => (
                        <Cell key={i} fill={getBarColor(entry.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2 px-3">{t('wbs_code') || 'WBS kod'}</th>
                      <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                      <th className="text-right py-2 px-3">{t('planned') || 'Rejalashtirilgan'}</th>
                      <th className="text-right py-2 px-3">{t('actual') || 'Haqiqiy'}</th>
                      <th className="text-right py-2 px-3">{t('variance') || 'Farq'}</th>
                      <th className="text-right py-2 px-3">{t('variance_percent') || 'Farq %'}</th>
                      <th className="text-left py-2 px-3">{t('status') || 'Holat'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bvaRows.slice((currentPageBva - 1) * pageSize, currentPageBva * pageSize).map((row, i) => {
                      const variance = (row.planned || 0) - (row.actual || 0);
                      const variancePct = row.planned > 0 ? ((row.actual / row.planned) * 100) : 0;
                      // Color coding: green (<80%), yellow (80-100%), red (>100%)
                      const rowBg = variancePct > 100
                        ? 'bg-red-50 hover:bg-red-100'
                        : variancePct >= 80
                          ? 'bg-yellow-50 hover:bg-yellow-100'
                          : 'bg-green-50 hover:bg-green-100';
                      return (
                        <tr key={i} className={`border-b ${row.planned > 0 ? rowBg : 'hover:bg-slate-50'}`}>
                          <td className="py-2 px-3 font-mono">{row.wbs_code || '—'}</td>
                          <td className="py-2 px-3">{row.name || '—'}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(row.planned || 0)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(row.actual || 0)}</td>
                          <td className={`py-2 px-3 text-right ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                          </td>
                          <td className={`py-2 px-3 text-right font-medium ${
                            variancePct > 100 ? 'text-red-700' : variancePct >= 80 ? 'text-yellow-700' : 'text-green-700'
                          }`}>{variancePct.toFixed(1)}%</td>
                          <td className="py-2 px-3">
                            <Badge className={STATUS_BADGE[row.status] || STATUS_BADGE.normal}>
                              {row.status === 'over_budget'
                                ? (t('over_budget') || 'Oshib ketgan')
                                : row.status === 'warning'
                                  ? (t('warning') || 'Ogohlantirish')
                                  : (t('normal') || 'Normal')}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {Math.ceil(bvaRows.length / pageSize) > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-slate-500">
                    {(currentPageBva - 1) * pageSize + 1}-{Math.min(currentPageBva * pageSize, bvaRows.length)} / {bvaRows.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageBva === 1} onClick={() => setCurrentPageBva(1)}>1</button>
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageBva === 1} onClick={() => setCurrentPageBva(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-medium px-2">{currentPageBva} / {Math.ceil(bvaRows.length / pageSize)}</span>
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageBva >= Math.ceil(bvaRows.length / pageSize)} onClick={() => setCurrentPageBva(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPageBva >= Math.ceil(bvaRows.length / pageSize)} onClick={() => setCurrentPageBva(Math.ceil(bvaRows.length / pageSize))}>{Math.ceil(bvaRows.length / pageSize)}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Cost Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('cost_trend') || 'Xarajatlar dinamikasi'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {t('no_trend_data') || 'Xarajat dinamikasi ma\'lumotlari topilmadi'}
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendItems} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="actual"
                    name={t('monthly_cost') || 'Oylik xarajat'}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name={t('cumulative') || 'Jami'}
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Payment Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            {t('payment_schedule') || "To'lov jadvali"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {t('no_payment_data') || "To'lov jadvali ma'lumotlari topilmadi"}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 px-3">{t('subcontract_name') || 'Subpudrat nomi'}</th>
                    <th className="text-left py-2 px-3">{t('partner') || 'Hamkor'}</th>
                    <th className="text-right py-2 px-3">{t('contract_amount') || 'Shartnoma summasi'}</th>
                    <th className="text-right py-2 px-3">{t('completed') || 'Bajarilgan'}</th>
                    <th className="text-right py-2 px-3">{t('paid') || "To'langan"}</th>
                    <th className="text-right py-2 px-3">{t('outstanding') || 'Qoldiq'}</th>
                    <th className="text-left py-2 px-3">{t('state') || 'Holat'}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice((currentPagePayments - 1) * pageSize, currentPagePayments * pageSize).map((item, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3">{item.name || '—'}</td>
                      <td className="py-2 px-3">{item.partner_name || '—'}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(item.contract_amount || 0)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(item.completed || 0)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(item.paid || 0)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(item.outstanding || 0)}</td>
                      <td className="py-2 px-3">
                        <Badge className={STATE_BADGE[item.state] || STATE_BADGE.draft}>
                          {item.state === 'active'
                            ? (t('active') || 'Faol')
                            : item.state === 'completed'
                              ? (t('completed') || 'Tugallangan')
                              : item.state === 'terminated'
                                ? (t('terminated') || 'Bekor qilingan')
                                : (t('draft') || 'Qoralama')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.ceil(payments.length / pageSize) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-slate-500">
                  {(currentPagePayments - 1) * pageSize + 1}-{Math.min(currentPagePayments * pageSize, payments.length)} / {payments.length}
                </p>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPagePayments === 1} onClick={() => setCurrentPagePayments(1)}>1</button>
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPagePayments === 1} onClick={() => setCurrentPagePayments(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-medium px-2">{currentPagePayments} / {Math.ceil(payments.length / pageSize)}</span>
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPagePayments >= Math.ceil(payments.length / pageSize)} onClick={() => setCurrentPagePayments(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPagePayments >= Math.ceil(payments.length / pageSize)} onClick={() => setCurrentPagePayments(Math.ceil(payments.length / pageSize))}>{Math.ceil(payments.length / pageSize)}</button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialTab;
