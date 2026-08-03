import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell,
  LineChart,
} from "recharts";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatAxisTick } from '@/utils/formatCurrency';
import financeService from "@/api/services/finance";

// Fixed-order categorical palette for the expense donut (dataviz-validated:
// lightness band, chroma, CVD separation and normal-vision floor all pass on
// the light surface; sub-3:1 contrast on slots 3-5 is mitigated by the
// always-visible labeled legend list under the chart).
const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'];

const INCOME_COLOR = '#1baf7a';
const EXPENSE_COLOR = '#e34948';
const NET_COLOR = '#4a3aa7';
const CASH_COLOR = '#2a78d6';

const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Shared period presets — "Bu oy" is the default; "Barcha vaqt" is available
// but never default (an all-time total answers no monthly decision).
function presetRange(preset) {
  const now = new Date();
  switch (preset) {
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmtDate(start), to: fmtDate(end) };
    }
    case 'quarter': {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { from: fmtDate(qStart), to: fmtDate(now) };
    }
    case 'year':
      return { from: fmtDate(new Date(now.getFullYear(), 0, 1)), to: fmtDate(now) };
    case 'all_time':
      return { from: '2000-01-01', to: fmtDate(now) };
    case 'this_month':
    default:
      return { from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtDate(now) };
  }
}

const PERIOD_PRESETS = ['this_month', 'last_month', 'quarter', 'year', 'all_time'];

export default function FinanceDashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const [, setSearchParams] = useSearchParams();

  const [period, setPeriod] = useState('this_month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDashboard = useCallback(async (preset) => {
    setLoading(true);
    setError(false);
    try {
      const range = presetRange(preset);
      const d = await financeService.getFinanceDashboard({
        period_from: range.from,
        period_to: range.to,
      });
      setData(d);
    } catch (err) {
      console.error('Failed to fetch finance dashboard:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(period);
  }, [period, loadDashboard]);

  const monthlyData = useMemo(() => {
    const monthNames = {
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
      ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    };
    const names = monthNames[language] || monthNames.en;
    return (data?.monthly || []).map((m) => {
      const [y, mo] = m.month.split('-');
      return {
        month: `${names[parseInt(mo, 10) - 1]} '${y.slice(-2)}`,
        income: m.income,
        expense: m.expense,
        net: m.income - m.expense,
      };
    });
  }, [data, language]);

  // Top 6 categories + "Boshqa" fold — never more slices than fixed hues.
  const donutData = useMemo(() => {
    const items = data?.expense_breakdown || [];
    if (items.length <= 7) return items.map((i) => ({ category: i.label, amount: i.amount }));
    const top = items.slice(0, 6).map((i) => ({ category: i.label, amount: i.amount }));
    const rest = items.slice(6).reduce((s, i) => s + i.amount, 0);
    return [...top, { category: t('other') || 'Boshqa', amount: rest }];
  }, [data, t]);

  const cashSeries = useMemo(() =>
    (data?.cash_series || []).map((p) => ({ date: p.date.slice(5), balance: p.balance })),
  [data]);

  const netResult = data?.net_result ?? 0;
  const goToTab = (tab) => setSearchParams({ tab }, { replace: false });

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-96 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-slate-200 rounded-xl" />
          <div className="h-72 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector — one shared control driving every number below */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              period === p
                ? 'bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t(p) || p}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-xs text-slate-500 tabular-nums">
            {data.period_from} — {data.period_to}
          </span>
        )}
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 text-sm text-red-700">
            {t('error_loading_data') || "Ma'lumotlarni yuklab bo'lmadi"}
          </CardContent>
        </Card>
      )}

      {/* Stat cards: Kirim · Chiqim · Sof natija · Pul qoldig'i (hozir) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/30 border-emerald-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 md:p-6">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">{t('income') || 'Kirim'}</p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-600 tabular-nums">
              {formatCurrency(data?.total_income || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-red-50/30 border-red-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 md:p-6">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">{t('expense') || 'Chiqim'}</p>
            <p className="text-2xl md:text-3xl font-bold text-red-600 tabular-nums">
              {formatCurrency(data?.total_expense || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className={`relative overflow-hidden bg-gradient-to-br shadow-lg hover:shadow-xl transition-all duration-300 ${netResult >= 0 ? 'from-white to-emerald-50/30 border-emerald-200/50' : 'from-white to-red-50/30 border-red-200/50'}`}>
          <CardContent className="p-5 md:p-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${netResult >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <Scale className={`w-6 h-6 ${netResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">{t('net_result') || 'Sof natija'}</p>
            <p className={`text-2xl md:text-3xl font-bold tabular-nums ${netResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(netResult)}
            </p>
            {(data?.total_income || 0) > 0 && (
              <p className="text-xs text-slate-500 mt-2 tabular-nums">
                {t('profit_margin')}: {((netResult / data.total_income) * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-blue-50/30 border-blue-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 md:p-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">{t('cash_position') || "Pul qoldig'i"}</p>
            <p className="text-2xl md:text-3xl font-bold text-blue-600 tabular-nums">
              {formatCurrency(data?.cash_balance || 0)}
            </p>
            {(data?.cash_accounts || []).length > 0 && (
              <div className="mt-2 space-y-0.5">
                {data.cash_accounts.slice(0, 3).map((a) => (
                  <p key={a.code} className="text-xs text-slate-500 tabular-nums flex justify-between">
                    <span>{a.name}</span>
                    <span>{formatCurrencyCompact(a.balance)}</span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AR / AP mini-cards → Qarzdorlik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <button onClick={() => goToTab('receivables')} className="text-left">
          <Card className="border-slate-200/60 shadow hover:shadow-md transition-all duration-200 hover:border-emerald-300/60">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-600">{t('owed_to_you') || 'Sizga qarzdor'}</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {formatCurrency(data?.receivables?.total || 0)}
                  <span className="ml-2 text-xs font-medium text-slate-500">
                    ({data?.receivables?.partners || 0} {t('customers_short') || 'mijoz'})
                  </span>
                </p>
                {(data?.receivables?.overdue || 0) > 0 && (
                  <p className="text-xs text-red-600 tabular-nums">
                    {t('overdue') || "Muddati o'tgan"}: {formatCurrencyCompact(data.receivables.overdue)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </button>
        <button onClick={() => goToTab('receivables')} className="text-left">
          <Card className="border-slate-200/60 shadow hover:shadow-md transition-all duration-200 hover:border-red-300/60">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
                <ArrowUpCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-600">{t('you_owe') || 'Siz qarzdorsiz'}</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {formatCurrency(data?.payables?.total || 0)}
                  <span className="ml-2 text-xs font-medium text-slate-500">
                    ({data?.payables?.partners || 0} {t('vendors_short') || 'yetkazib beruvchi'})
                  </span>
                </p>
                {(data?.payables?.overdue || 0) > 0 && (
                  <p className="text-xs text-red-600 tabular-nums">
                    {t('overdue') || "Muddati o'tgan"}: {formatCurrencyCompact(data.payables.overdue)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">{t('income_expense_trends') || "Kirim/Chiqim oylar bo'yicha"}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthlyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill={INCOME_COLOR} name={t('income')} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" fill={EXPENSE_COLOR} name={t('expense')} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line dataKey="net" stroke={NET_COLOR} name={t('net_result') || 'Sof natija'} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-slate-500 text-sm">
                {t('no_data')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">{t('expenses_by_category') || "Xarajatlar kategoriya bo'yicha"}</CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={190}>
                  <RechartsPieChart>
                    <Pie
                      data={donutData}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5 max-h-[130px] overflow-y-auto">
                  {donutData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-xs px-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                        <span className="text-slate-600 truncate">{item.category}</span>
                      </div>
                      <span className="font-medium text-slate-900 tabular-nums">{formatCurrencyCompact(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-slate-500 text-sm">
                {t('no_data')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash balance dynamics — "pul tugayaptimi?" */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">{t('cash_balance_dynamics') || "Pul qoldig'i dinamikasi"}</CardTitle>
        </CardHeader>
        <CardContent>
          {cashSeries.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cashSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line dataKey="balance" stroke={CASH_COLOR} strokeWidth={2} dot={false} type="monotone" name={t('cash_position') || "Pul qoldig'i"} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
              {t('no_data')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
