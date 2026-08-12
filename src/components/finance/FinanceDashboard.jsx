import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  ArrowDownCircle,
  ArrowUpCircle,
  Info,
  ChevronDown,
  ChevronUp,
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
import { formatDate } from '@/utils/formatDate';
import financeService from "@/api/services/finance";

// Fixed-order categorical palette for the expense donut (dataviz-validated:
// lightness band, chroma, CVD separation and normal-vision floor all pass on
// the light surface; sub-3:1 contrast on slots 3-5 is mitigated by the
// always-visible labeled legend list under the chart).
const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'];

// Green/red pair is dataviz-validator clean (deutan ΔE 8.4, ≥3:1 on white);
// keep in sync with the home Dashboard's INCOME/EXPENSE constants.
const INCOME_COLOR = '#0f8f63';
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
// Preset ids feed presetRange(); 'quarter'/'year' have no standalone
// translations (the bare "year" key is a lowercase unit word), so their
// pill labels borrow the fully-translated this_quarter/this_year keys.
const PERIOD_LABEL_KEYS = { quarter: 'this_quarter', year: 'this_year' };

// ─── Biznes ko'rsatkichlari (conventions §3, /reports/finance-kpis) ───
// kind → how the value renders; signed → green/red by sign (margins, growth,
// ROA/ROE only — structural KPIs stay slate). `req` are the input keys the
// popover's substituted-formula line needs; `calc` rebuilds the formula with
// the actual backend inputs (m = compact money formatter). `story` turns the
// static caption into a value-substituted plain sentence ("Har 100 so'm aktiv
// 5,5 so'm zarar keltirdi") — a bare "-5.5%" answers nothing for an owner;
// it returns null when the phrasing wouldn't fit the value, and the static
// subKey caption is the fallback.
const tpl = (t, key, n) => t(key).replace('{n}', n);

const KPI_DEFS = {
  gross_margin: {
    kind: 'percent', signed: true,
    labelKey: 'fk_gross_margin', subKey: 'fk_gross_margin_sub', formulaKey: 'fk_gross_margin_f',
    req: ['revenue', 'cogs'],
    calc: (i, m) => `(${m(i.revenue)} − ${m(i.cogs)}) ÷ ${m(i.revenue)}`,
    story: (v, t) => (v >= 0 && v <= 100 ? tpl(t, 'fk_gross_margin_story', v.toFixed(1)) : null),
  },
  net_margin: {
    kind: 'percent', signed: true,
    labelKey: 'fk_net_margin', subKey: 'fk_net_margin_sub', formulaKey: 'fk_net_margin_f',
    req: ['net_result', 'revenue'],
    calc: (i, m) => `${m(i.net_result)} ÷ ${m(i.revenue)}`,
    story: (v, t) => tpl(t, v >= 0 ? 'fk_net_margin_story_profit' : 'fk_net_margin_story_loss', Math.abs(v).toFixed(1)),
  },
  roa: {
    kind: 'percent', signed: true, longKey: 'fk_roa_long',
    labelKey: 'fk_roa', subKey: 'fk_roa_sub', formulaKey: 'fk_roa_f',
    req: ['net_result', 'avg_assets'],
    calc: (i, m) => `${m(i.net_result)} ÷ ${m(i.avg_assets)}`,
    story: (v, t) => tpl(t, v >= 0 ? 'fk_roa_story_profit' : 'fk_roa_story_loss', Math.abs(v).toFixed(1)),
  },
  roe: {
    kind: 'percent', signed: true, longKey: 'fk_roe_long',
    labelKey: 'fk_roe', subKey: 'fk_roe_sub', formulaKey: 'fk_roe_f',
    req: ['net_result', 'avg_equity'],
    calc: (i, m) => `${m(i.net_result)} ÷ ${m(i.avg_equity)}`,
    story: (v, t) => tpl(t, v >= 0 ? 'fk_roe_story_profit' : 'fk_roe_story_loss', Math.abs(v).toFixed(1)),
  },
  current_ratio: {
    kind: 'ratio', health: true,
    labelKey: 'fk_current_ratio', subKey: 'fk_current_ratio_sub', formulaKey: 'fk_current_ratio_f',
    req: ['current_assets', 'current_liabilities'],
    calc: (i, m) => `${m(i.current_assets)} ÷ ${m(i.current_liabilities)}`,
  },
  operating_margin: {
    kind: 'percent', signed: true,
    labelKey: 'fk_operating_margin', subKey: 'fk_operating_margin_sub', formulaKey: 'fk_operating_margin_f',
    req: ['revenue', 'cogs', 'period_expenses'],
    calc: (i, m) => `(${m(i.revenue)} − ${m(i.cogs)} − ${m(i.period_expenses)}) ÷ ${m(i.revenue)}`,
  },
  equity: {
    kind: 'money',
    labelKey: 'fk_equity', subKey: 'fk_equity_sub', formulaKey: 'fk_equity_f',
    req: ['assets', 'liabilities'],
    calc: (i, m) => `${m(i.assets)} − ${m(i.liabilities)}`,
  },
  working_capital: {
    kind: 'money',
    labelKey: 'fk_working_capital', subKey: 'fk_working_capital_sub', formulaKey: 'fk_working_capital_f',
    req: ['current_assets', 'current_liabilities'],
    calc: (i, m) => `${m(i.current_assets)} − ${m(i.current_liabilities)}`,
  },
  cash_runway_months: {
    kind: 'months', hideWhenNull: true,
    labelKey: 'fk_cash_runway', subKey: 'fk_cash_runway_sub', formulaKey: 'fk_cash_runway_f',
    req: ['cash', 'avg_monthly_outflow'],
    calc: (i, m) => `${m(i.cash)} ÷ ${m(i.avg_monthly_outflow)}`,
    story: (v, t) => (v >= 0 ? tpl(t, 'fk_runway_story', Math.round(v * 10) / 10) : null),
  },
  dso: {
    kind: 'days',
    labelKey: 'fk_dso', subKey: 'fk_dso_sub', formulaKey: 'fk_dso_f',
    req: ['avg_ar', 'revenue', 'period_days'],
    calc: (i, m) => `${m(i.avg_ar)} ÷ ${m(i.revenue)} × ${i.period_days}`,
    story: (v, t) => (v >= 0 ? tpl(t, 'fk_dso_story', Math.round(v)) : null),
  },
  dpo: {
    kind: 'days',
    labelKey: 'fk_dpo', subKey: 'fk_dpo_sub', formulaKey: 'fk_dpo_f',
    req: ['avg_ap', 'purchases', 'period_days'],
    calc: (i, m) => `${m(i.avg_ap)} ÷ ${m(i.purchases)} × ${i.period_days}`,
    story: (v, t) => (v >= 0 ? tpl(t, 'fk_dpo_story', Math.round(v)) : null),
  },
  overdue_ar_pct: {
    kind: 'percent',
    labelKey: 'fk_overdue_ar', subKey: 'fk_overdue_ar_sub', formulaKey: 'fk_overdue_ar_f',
    req: ['overdue_ar', 'total_ar'],
    calc: (i, m) => `${m(i.overdue_ar)} ÷ ${m(i.total_ar)}`,
    story: (v, t) => (v >= 0 && v <= 100 ? tpl(t, 'fk_overdue_story', v.toFixed(0)) : null),
  },
  revenue_growth: {
    kind: 'percent', signed: true, plus: true,
    labelKey: 'fk_revenue_growth', subKey: 'fk_revenue_growth_sub', formulaKey: 'fk_revenue_growth_f',
    req: ['revenue', 'prev_revenue'],
    calc: (i, m) => `(${m(i.revenue)} − ${m(i.prev_revenue)}) ÷ ${m(i.prev_revenue)}`,
    story: (v, t) => tpl(t, v >= 0 ? 'fk_growth_story_up' : 'fk_growth_story_down', Math.abs(v).toFixed(1)),
  },
};

const PRIMARY_KPIS = ['gross_margin', 'net_margin', 'roa', 'roe', 'current_ratio'];
const DETAIL_KPIS = [
  'operating_margin', 'equity', 'working_capital', 'cash_runway_months',
  'dso', 'dpo', 'overdue_ar_pct', 'revenue_growth',
];

const hasAllInputs = (inputs, keys) =>
  keys.every((k) => inputs?.[k] !== null && inputs?.[k] !== undefined && Number.isFinite(Number(inputs[k])));

// ≥1.2 healthy · 1.0–1.2 borderline · <1.0 risky (conventions §3)
const ratioHealth = (v) =>
  v >= 1.2
    ? { dot: 'bg-emerald-500', text: 'text-emerald-600', key: 'kpi_health_good' }
    : v >= 1.0
      ? { dot: 'bg-amber-500', text: 'text-amber-600', key: 'kpi_health_border' }
      : { dot: 'bg-red-500', text: 'text-red-600', key: 'kpi_health_risky' };

function kpiValueText(def, v, t, fmtCompact) {
  switch (def.kind) {
    case 'percent': return `${def.plus && v > 0 ? '+' : ''}${v.toFixed(1)}%`;
    case 'ratio': return v.toFixed(2);
    case 'money': return fmtCompact(v);
    case 'months': return `${Math.round(v * 10) / 10} ${t('kpi_months_short')}`;
    case 'days': return `${Math.round(v)} ${t('kpi_days_short')}`;
    default: return String(v);
  }
}

function KpiCard({ id, kpi, t, fmtCompact }) {
  const def = KPI_DEFS[id];
  const v = kpi?.value;
  const isNull = v === null || v === undefined;
  const valueColor = !isNull && def.signed
    ? (v >= 0 ? 'text-emerald-600' : 'text-red-600')
    : 'text-slate-900';
  const health = def.health && !isNull ? ratioHealth(v) : null;
  const calcLine = !isNull && hasAllInputs(kpi?.inputs, def.req)
    ? def.calc(kpi.inputs, fmtCompact)
    : null;
  // Value-substituted plain sentence beats the generic caption; ROA/ROE tiles
  // also lead with the full Uzbek name — a bare acronym explains nothing.
  const caption = (!isNull && def.story && def.story(v, t)) || t(def.subKey);
  const label = def.longKey ? `${t(def.longKey)} (${t(def.labelKey)})` : t(def.labelKey);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white/70 p-4 min-h-[116px]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-600 leading-snug">{label}</p>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('kpi_whats_this')}
              className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 -mt-0.5"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t(def.subKey)}</p>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5">
              <p className="text-xs font-medium text-slate-700">{t(def.formulaKey)}</p>
              {calcLine && <p className="text-xs text-slate-500 tabular-nums mt-1">= {calcLine}</p>}
              {isNull && <p className="text-xs text-slate-400 mt-1">{t('kpi_no_data')}</p>}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {isNull ? (
        <p className="text-sm font-medium text-slate-400 mt-2">{t('kpi_no_data')}</p>
      ) : (
        <p className={`text-xl font-bold tabular-nums mt-1.5 ${valueColor}`}>
          {kpiValueText(def, v, t, fmtCompact)}
        </p>
      )}
      <p className="text-[11px] text-slate-500 leading-snug mt-auto pt-1.5">{caption}</p>
      {health && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`w-2 h-2 rounded-full ${health.dot}`} />
          <span className={`text-[11px] font-medium ${health.text}`}>{t(health.key)}</span>
        </div>
      )}
    </div>
  );
}

export default function FinanceDashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const [, setSearchParams] = useSearchParams();

  const [period, setPeriod] = useState('this_month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState(false);
  const [showKpiDetails, setShowKpiDetails] = useState(false);

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

  // Loaded alongside the dashboard for the same period; fails independently
  // so a KPI outage never blanks the rest of the page.
  const loadKpis = useCallback(async (preset) => {
    setKpisLoading(true);
    setKpisError(false);
    try {
      const range = presetRange(preset);
      const res = await financeService.getFinanceKPIs({
        period_from: range.from,
        period_to: range.to,
      });
      setKpis(res?.kpis || null);
    } catch (err) {
      console.error('Failed to fetch finance KPIs:', err);
      setKpisError(true);
    } finally {
      setKpisLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(period);
    loadKpis(period);
  }, [period, loadDashboard, loadKpis]);

  const monthlyData = useMemo(() => {
    const monthNames = {
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
      ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    };
    const names = monthNames[language] || monthNames.en;
    // v2: `trend` is a rolling last-6-full-months + current month-to-date
    // window, independent of the period filter — so "Bu oy" still shows
    // context. Falls back to period-bound `monthly` on older backends.
    const src = (data?.trend?.length ? data.trend : data?.monthly) || [];
    return src.map((m) => {
      const [y, mo] = m.month.split('-');
      return {
        month: `${names[parseInt(mo, 10) - 1]} '${y.slice(-2)}`,
        income: m.income,
        expense: m.expense,
        net: m.net ?? (m.income - m.expense),
      };
    });
  }, [data, language]);

  const hasTrendData = useMemo(
    () => monthlyData.some((m) => (m.income || 0) !== 0 || (m.expense || 0) !== 0),
    [monthlyData]
  );

  // Top 6 categories + "Boshqa" fold — never more slices than fixed hues.
  // Zero/negative rows are dropped first so an all-zero breakdown lands in
  // the empty state instead of rendering an invisible donut.
  const donutData = useMemo(() => {
    const items = (data?.expense_breakdown || []).filter((i) => (i.amount || 0) > 0);
    if (items.length <= 7) return items.map((i) => ({ category: i.label, amount: i.amount }));
    const top = items.slice(0, 6).map((i) => ({ category: i.label, amount: i.amount }));
    const rest = items.slice(6).reduce((s, i) => s + i.amount, 0);
    return [...top, { category: t('other') || 'Boshqa', amount: rest }];
  }, [data, t]);

  const cashSeries = useMemo(() =>
    (data?.cash_series || []).map((p) => ({ date: p.date.slice(5), balance: p.balance })),
  [data]);

  const hasCashData = useMemo(
    () => cashSeries.some((p) => (p.balance || 0) !== 0),
    [cashSeries]
  );

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
            {t(PERIOD_LABEL_KEYS[p] || p)}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-xs text-slate-500 tabular-nums">
            {formatDate(data.period_from)} — {formatDate(data.period_to)}
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
            {/* uz honesty: a negative result is "Zarar", never "Sof zarar";
                "Foyda marjasi" only when there is profit — plain "Marja" otherwise. */}
            {netResult < 0 && (
              <p className="text-xs font-medium text-red-600 mt-2">{t('loss_caption')}</p>
            )}
            {(data?.total_income || 0) > 0 && (
              <p className={`text-xs text-slate-500 tabular-nums ${netResult < 0 ? 'mt-0.5' : 'mt-2'}`}>
                {netResult >= 0 ? t('profit_margin') : t('margin_label')}: {((netResult / data.total_income) * 100).toFixed(1)}%
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

      {/* Biznes ko'rsatkichlari — /reports/finance-kpis, same period as above */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base md:text-lg">{t('biznes_korsatkichlari')}</CardTitle>
          <button
            type="button"
            onClick={() => setShowKpiDetails((s) => !s)}
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {showKpiDetails ? t('kpi_collapse') : t('kpi_details')}
            {showKpiDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>
        <CardContent>
          {kpisLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-pulse">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
            </div>
          ) : kpisError ? (
            <p className="text-sm text-red-600 py-4">{t('kpi_error')}</p>
          ) : kpis ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {PRIMARY_KPIS.map((id) => (
                  <KpiCard key={id} id={id} kpi={kpis[id]} t={t} fmtCompact={formatCurrencyCompact} />
                ))}
              </div>
              {showKpiDetails && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                  {DETAIL_KPIS
                    .filter((id) => !(KPI_DEFS[id].hideWhenNull && (kpis[id]?.value ?? null) === null))
                    .map((id) => (
                      <KpiCard key={id} id={id} kpi={kpis[id]} t={t} fmtCompact={formatCurrencyCompact} />
                    ))}
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">{t('income_expense_trends') || "Kirim/Chiqim oylar bo'yicha"}</CardTitle>
            {/* Rolling window ≠ the period selector — say so. */}
            <p className="text-xs text-slate-500">{t('trend_caption')}</p>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 && hasTrendData ? (
              <ResponsiveContainer width="100%" height={260}>
                {/* top margin keeps the highest Y-axis tick from clipping */}
                <ComposedChart data={monthlyData} barGap={2} margin={{ top: 12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} />
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
              <div className="h-[260px] flex flex-col items-center justify-center text-center px-8">
                <p className="text-sm text-slate-500">{t('no_data')}</p>
                <p className="text-xs text-slate-400 mt-1.5">{t('donut_empty_cta')}</p>
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
          {cashSeries.length > 1 && hasCashData ? (
            <ResponsiveContainer width="100%" height={220}>
              {/* top margin keeps the highest Y-axis tick from clipping */}
              <LineChart data={cashSeries} margin={{ top: 12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={formatAxisTick} tickLine={false} axisLine={false} />
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
