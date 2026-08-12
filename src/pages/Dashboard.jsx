import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  FileWarning,
  BarChart3,
  Filter,
  LineChart as LineChartIcon,
  CheckSquare,
  PackageSearch,
  Receipt,
  DollarSign,
} from "lucide-react";
import {
  BarChart,
  AreaChart,
  Area,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

import {
  StatTile,
  ChartCard,
  EmptyNote,
  Segmented,
} from "@/components/shared/DashboardKit";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { formatAxisTick } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { financeService } from "@/api/services/finance";
import { salesService } from "@/api/services/sales";
import { inventoryService } from "@/api/services/inventory";
import { procurementService } from "@/api/services/procurement";
import { crmReportsService } from "@/api/services/crm";
import apiClient from "@/api/client";

// Same accent set as Moliya's FinanceDashboard so the home KPIs and the
// finance module they drill into read as one system. The green/red pair is
// dataviz-validator clean (deutan ΔE 8.4, contrast ≥3:1 on white) — the old
// #1baf7a sat in the CVD warning band.
const INCOME_COLOR = "#0f8f63";
const EXPENSE_COLOR = "#e34948";
const CASH_COLOR = "#2a78d6";
const FUNNEL_BAR = "#534AB7";
const PRODUCT_BAR = "#185FA5";

// Same convention as CRM PipelineBoard.stageLabel: a stage still carrying its
// default English name gets the crm_stage_* translation; a user-renamed
// stage shows as-is.
const DEFAULT_STAGE_NAMES = {
  new: "New",
  contacted: "Contacted",
  in_progress: "In Progress",
  qualified: "Negotiation",
  won: "Won",
  lost: "Lost",
};

// pipeline_stages.color stores named colors (see CRM PipelineBoard
// STAGE_COLORS) — map to the matching Tailwind-500 hex for inline styles.
const STAGE_HEX = {
  blue: "#3b82f6",
  amber: "#f59e0b",
  purple: "#a855f7",
  green: "#22c55e",
  emerald: "#10b981",
  red: "#ef4444",
  gray: "#94a3b8",
  teal: "#14b8a6",
  pink: "#ec4899",
};

const MONTH_NAMES = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
};

const fmtDateISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Shared period presets — "Bu oy" default; every widget below follows this
// one control (the old panel mixed YTD, all-time and 28-day windows).
function presetRange(preset) {
  const now = new Date();
  switch (preset) {
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmtDateISO(start), to: fmtDateISO(end) };
    }
    case "quarter": {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { from: fmtDateISO(qStart), to: fmtDateISO(now) };
    }
    case "year":
      return { from: fmtDateISO(new Date(now.getFullYear(), 0, 1)), to: fmtDateISO(now) };
    case "this_month":
    default:
      return { from: fmtDateISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtDateISO(now) };
  }
}

// Every data source loads independently and degrades independently:
// 'denied' (403) hides the widget instead of rendering a lie.
function useWidgetData(fetcher, deps) {
  const [state, setState] = useState({ status: "loading", data: null });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.data ? "refreshing" : "loading" }));
    try {
      const data = await fetcher();
      setState({ status: "ok", data });
    } catch (err) {
      const code = err?.response?.status;
      setState({ status: code === 403 || code === 402 ? "denied" : "error", data: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

function SkeletonTile() {
  return <div className="h-[104px] bg-slate-200/70 rounded-2xl animate-pulse" />;
}

function SkeletonCard({ h = "h-[340px]" }) {
  return <div className={`${h} bg-slate-200/70 rounded-2xl animate-pulse`} />;
}

// GlassTooltip variant with accounting semantics: negative values render red
// with the minus sign, and the net row is labeled foyda/zarar in words — a
// signed number alone still left readers asking "is this profit or loss?".
function FinTooltip({ active, payload, label, format, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-xl px-3 py-2 min-w-[160px]">
      {label != null && label !== "" && <p className="text-[11px] font-medium text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => {
        const neg = p.value < 0;
        const isNet = p.dataKey === "net";
        const word = isNet ? ` (${(neg ? t("loss") : t("profit")).toLowerCase()})` : "";
        return (
          <div key={i} className="flex items-center gap-2 text-xs py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-slate-500 truncate">{p.name}</span>
            <span className={`ml-auto pl-3 font-semibold tabular-nums ${neg ? "text-red-600" : "text-slate-900"}`}>
              {format(p.value)}
              {word}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QueueRow({ primary, secondary, right, rightCls }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{primary}</p>
        {secondary && <p className="text-[11px] text-slate-400 truncate">{secondary}</p>}
      </div>
      <span className={`text-xs font-semibold shrink-0 tabular-nums ${rightCls || "text-slate-600"}`}>{right}</span>
    </div>
  );
}

export default function Dashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const navigate = useNavigate();

  const [period, setPeriod] = useState("this_month");
  const range = useMemo(() => presetRange(period), [period]);
  const months = MONTH_NAMES[language] || MONTH_NAMES.uz;
  // Spans profit and loss months — the Forma-2 name fits both signs, unlike
  // a bare "Sof natija".
  const netLabel =
    language === "ru" ? "Прибыль (убыток)" : language === "uz" ? "Sof foyda (zarar)" : "Net profit (loss)";

  // One period-aware aggregate call per source — the ledger-backed
  // /reports/finance-dashboard replaces the old trial-balance sum + 12
  // income-statement loop + four context refreshes.
  const finance = useWidgetData(
    () => financeService.getFinanceDashboard({ period_from: range.from, period_to: range.to }),
    [range.from, range.to]
  );

  // Fixed trailing-12-months window for the trend chart, independent of the
  // KPI period (a one-month bar chart answers no trend question).
  const trend = useWidgetData(() => {
    const now = new Date();
    const from = fmtDateISO(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    return financeService.getFinanceDashboard({ period_from: from, period_to: fmtDateISO(now) });
  }, []);

  const funnel = useWidgetData(
    () => crmReportsService.funnel({ from: range.from, to: range.to }),
    [range.from, range.to]
  );

  const topProducts = useWidgetData(
    () =>
      apiClient
        .get("/dashboard/top-products", { params: { from: range.from, to: range.to } })
        .then((res) => res.data?.data),
    [range.from, range.to]
  );

  const salesStats = useWidgetData(
    () => salesService.getStats({ from: range.from, to: range.to }),
    [range.from, range.to]
  );

  const stock = useWidgetData(() => inventoryService.getInventoryStats(), []);

  const approvals = useWidgetData(
    () => procurementService.getMyPendingApprovals({ limit: 5 }),
    []
  );

  const fin = finance.data;
  const netResult = fin?.net_result ?? 0;
  const isLoss = netResult < 0;

  // Zero-fill the trailing 12 months — the endpoint only returns months that
  // have postings, and a skipped category would distort the time axis. Then
  // trim leading all-zero months (young tenants otherwise get a chart that is
  // 3/4 dead space), keeping at least 6 months so a short history still reads
  // as a timeline. Empty array = no postings at all → EmptyNote.
  const trendData = useMemo(() => {
    if (!trend.data) return [];
    const byMonth = new Map((trend.data.monthly || []).map((m) => [m.month, m]));
    const now = new Date();
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = byMonth.get(key);
      const income = m?.income || 0;
      const expense = m?.expense || 0;
      out.push({
        month: `${months[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`,
        income,
        expense,
        net: income - expense,
      });
    }
    const firstActive = out.findIndex((m) => m.income !== 0 || m.expense !== 0);
    if (firstActive === -1) return [];
    return out.slice(Math.min(firstActive, out.length - 6));
  }, [trend.data, months]);

  const cashSeries = useMemo(
    () =>
      (fin?.cash_series || []).map((p) => ({
        date: formatDate(p.date),
        balance: p.balance,
      })),
    [fin]
  );

  const funnelStages = useMemo(() => {
    const stages = funnel.data?.stages || [];
    const maxReached = Math.max(...stages.map((s) => s.reached), 1);
    return stages.map((s, i) => ({
      ...s,
      label: DEFAULT_STAGE_NAMES[s.code] === s.name ? t(`crm_stage_${s.code}`) : s.name,
      widthPct: Math.max((s.reached / maxReached) * 100, 4),
      // Same-cohort conversion: share of the previous stage's leads that
      // reached this one — monotonic by construction, unlike the old
      // cross-entity percentages.
      conversion: i > 0 && stages[i - 1].reached > 0 ? Math.round((s.reached / stages[i - 1].reached) * 100) : null,
    }));
  }, [funnel.data, t]);

  const products = useMemo(() => {
    const list = topProducts.data?.products || [];
    const max = Math.max(...list.map((p) => p.revenue), 1);
    const total = list.reduce((s, p) => s + p.revenue, 0);
    return list.map((p) => ({
      ...p,
      widthPct: (p.revenue / max) * 100,
      sharePct: total > 0 ? ((p.revenue / total) * 100).toFixed(1) : "0",
    }));
  }, [topProducts.data]);

  const funnelHasData = (funnel.data?.totals?.created ?? 0) > 0;
  const overdueList = salesStats.data?.overdue_invoices || [];
  const overdueCount = salesStats.data?.totals?.overdue_invoices ?? 0;
  const lowStockItems = stock.data?.low_stock_items || [];
  const lowStockCount = stock.data?.totals?.low_stock_count ?? 0;
  const approvalList = approvals.data || [];

  const periodOptions = [
    { id: "this_month", label: t("this_month") },
    { id: "last_month", label: t("last_month") },
    { id: "quarter", label: t("this_quarter") },
    { id: "year", label: t("this_year") },
  ];

  const everythingDenied =
    finance.status === "denied" &&
    funnel.status === "denied" &&
    topProducts.status === "denied" &&
    salesStats.status === "denied" &&
    stock.status === "denied";

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Toolbar — one period control drives every widget below */}
        <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          <Segmented options={periodOptions} value={period} onChange={setPeriod} />
          {fin && (
            <span className="ml-auto text-xs text-slate-500 tabular-nums">
              {formatDate(fin.period_from)} — {formatDate(fin.period_to)}
            </span>
          )}
        </div>

        {everythingDenied && (
          <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-8">
            <EmptyNote icon={FileWarning} text={t("no_permission")} />
          </div>
        )}

        {/* KPI row — accrual figures from the posted ledger, signed */}
        {finance.status === "loading" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        )}
        {fin && (
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch ${
              finance.status === "refreshing" ? "opacity-60" : ""
            }`}
          >
            <StatTile
              label={t("revenue")}
              value={formatCurrencyCompact(fin.total_income || 0)}
              sub={formatCurrency(fin.total_income || 0)}
              icon={DollarSign}
              chip="bg-emerald-50 text-emerald-600"
              onClick={() => navigate("/financials?tab=dashboard")}
            />
            <StatTile
              label={t("expenses")}
              value={formatCurrencyCompact(fin.total_expense || 0)}
              sub={
                fin.total_income > 0
                  ? `${Math.round((fin.total_expense / fin.total_income) * 100)}% ${t("of_revenue")}`
                  : formatCurrency(fin.total_expense || 0)
              }
              icon={Wallet}
              chip="bg-red-50 text-red-600"
              onClick={() => navigate("/financials?tab=dashboard")}
            />
            <StatTile
              /* The label states what the number IS: "Zarar" when negative,
                 "Sof foyda" when positive — a neutral "Sof natija" over a red
                 figure made the reader do the classification themselves. */
              label={
                isLoss
                  ? (language === "ru" ? "Убыток" : language === "uz" ? "Zarar" : "Loss")
                  : (language === "ru" ? "Чистая прибыль" : language === "uz" ? "Sof foyda" : "Net profit")
              }
              value={formatCurrencyCompact(netResult)}
              sub={
                fin.total_income > 0
                  ? `${Math.round((netResult / fin.total_income) * 100)}% ${t("margin").toLowerCase()}`
                  : undefined
              }
              icon={isLoss ? TrendingDown : TrendingUp}
              chip={isLoss ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}
              valueCls={isLoss ? "text-red-600" : "text-emerald-700"}
              onClick={() => navigate("/financials?tab=reports")}
            />
            <StatTile
              label={t("cash_position")}
              value={formatCurrencyCompact(fin.cash_balance || 0)}
              sub={formatCurrency(fin.cash_balance || 0)}
              icon={Landmark}
              chip="bg-blue-50 text-blue-600"
              valueCls={(fin.cash_balance || 0) < 0 ? "text-red-600" : undefined}
              onClick={() => navigate("/financials?tab=cashflow")}
            />
            <StatTile
              label={t("overdue_invoices")}
              value={formatCurrencyCompact(fin.receivables?.overdue || 0)}
              sub={
                (fin.receivables?.overdue_partners || 0) > 0
                  ? `${fin.receivables.overdue_partners} ${t("customers_lc")}`
                  : t("all_paid")
              }
              icon={FileWarning}
              chip={(fin.receivables?.overdue || 0) > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}
              onClick={() => navigate("/financials?tab=receivables")}
            />
          </div>
        )}
        {finance.status === "error" && (
          <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-6">
            <EmptyNote
              icon={FileWarning}
              text={t("error_loading_data")}
              cta={
                <button onClick={finance.reload} className="text-xs font-medium text-blue-600 hover:underline">
                  {t("retry")}
                </button>
              }
            />
          </div>
        )}

        {/* Trend row — flows and the signed result as two side-by-side cards
            over the same 12-month axis (one measure per chart, one axis each;
            syncId keeps hover aligned across the pair). The old single card
            squeezed both panels into 300px and neither could breathe. */}
        {(finance.status !== "denied" || trend.status === "ok") && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {trend.status === "loading" ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : trend.status === "ok" && trendData.length > 0 ? (
                <>
                  <ChartCard
                    title={`${t("revenue")} / ${t("expenses")} — ${trendData.length} ${t("months")}`}
                    icon={BarChart3}
                  >
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={trendData}
                        syncId="fin-trend"
                        margin={{ top: 8, right: 10, left: 10, bottom: 0 }}
                        barGap={2}
                      >
                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={70}
                          tickFormatter={formatAxisTick}
                        />
                        <Tooltip content={<FinTooltip format={formatCurrency} t={t} />} />
                        <Legend
                          verticalAlign="top"
                          height={28}
                          formatter={(value) => <span className="text-xs text-slate-500">{value}</span>}
                          iconType="circle"
                          iconSize={8}
                        />
                        <Bar dataKey="income" name={t("revenue")} fill={INCOME_COLOR} radius={[3, 3, 0, 0]} maxBarSize={26} />
                        <Bar dataKey="expense" name={t("expenses")} fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Diverging bars, colored by sign — "was the month
                      profitable?" answered at a glance. Single series, so the
                      title carries the name and there is no legend; top margin
                      matches the neighbor's legend strip so the synced plots
                      line up. */}
                  <ChartCard title={`${netLabel} — ${trendData.length} ${t("months")}`} icon={TrendingUp}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={trendData} syncId="fin-trend" margin={{ top: 36, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={70}
                          tickFormatter={formatAxisTick}
                        />
                        <Tooltip content={<FinTooltip format={formatCurrency} t={t} />} />
                        <ReferenceLine y={0} stroke="#cbd5e1" />
                        <Bar dataKey="net" name={netLabel} maxBarSize={26} radius={2}>
                          {trendData.map((m, i) => (
                            <Cell key={i} fill={m.net < 0 ? EXPENSE_COLOR : INCOME_COLOR} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </>
              ) : trend.status === "ok" ? (
                <ChartCard
                  title={`${t("revenue")} / ${t("expenses")}`}
                  icon={BarChart3}
                  className="lg:col-span-2"
                >
                  <EmptyNote icon={BarChart3} text={t("no_data")} />
                </ChartCard>
              ) : null}
            </div>

            {/* Cash position — a daily series earns the full row's width */}
            {finance.status === "loading" ? (
              <SkeletonCard h="h-[300px]" />
            ) : fin && cashSeries.length > 0 ? (
              <ChartCard title={t("cash_balance_dynamics")} icon={LineChartIcon}>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={cashSeries} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CASH_COLOR} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={CASH_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      tickFormatter={formatAxisTick}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={<FinTooltip format={formatCurrency} t={t} />} />
                    <ReferenceLine y={0} stroke="#e2e8f0" />
                    <Area
                      type="linear"
                      dataKey="balance"
                      name={t("cash_position")}
                      stroke={CASH_COLOR}
                      strokeWidth={2}
                      fill="url(#gradCash)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            ) : fin ? (
              <ChartCard title={t("cash_balance_dynamics")} icon={LineChartIcon}>
                <EmptyNote icon={LineChartIcon} text={t("no_data")} />
              </ChartCard>
            ) : null}
          </>
        )}

        {/* Funnel + top products */}
        {(funnel.status !== "denied" || topProducts.status !== "denied") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {funnel.status === "loading" ? (
              <SkeletonCard h="h-[300px]" />
            ) : funnel.data ? (
              <ChartCard
                title={t("sales_funnel")}
                icon={Filter}
                className={funnel.status === "refreshing" ? "opacity-60" : ""}
                action={
                  <button onClick={() => navigate("/customers")} className="text-xs font-medium text-blue-600 hover:underline">
                    {t("view_all")}
                  </button>
                }
              >
                {funnelStages.length > 0 && funnelHasData ? (
                  <div className="space-y-2">
                    {funnelStages.map((s) => (
                      <div key={s.stage_id} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-600 w-24 text-right shrink-0 truncate" title={s.label}>
                          {s.label}
                        </span>
                        <div className="flex-1">
                          <div
                            className="h-8 rounded-lg flex items-center px-3 min-w-[36px]"
                            style={{ width: `${s.widthPct}%`, background: STAGE_HEX[s.color] || FUNNEL_BAR }}
                          >
                            <span className="text-xs font-bold text-white tabular-nums">{s.reached}</span>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 w-12 shrink-0 text-right tabular-nums">
                          {s.conversion != null ? `${s.conversion}%` : ""}
                        </span>
                      </div>
                    ))}
                    {funnel.data?.totals && (
                      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                        {t("crm_leads")}: {funnel.data.totals.created ?? 0} · {t("crm_won")}: {funnel.data.totals.won ?? 0} (
                        {formatCurrencyCompact(funnel.data.totals.won_value || 0)}) · {t("crm_lost")}:{" "}
                        {funnel.data.totals.lost ?? 0}
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyNote icon={Filter} text={t("no_data")} />
                )}
              </ChartCard>
            ) : null}

            {topProducts.status === "loading" ? (
              <SkeletonCard h="h-[300px]" />
            ) : topProducts.data ? (
              <ChartCard
                title={t("top_5_products")}
                icon={BarChart3}
                className={topProducts.status === "refreshing" ? "opacity-60" : ""}
                action={
                  <button onClick={() => navigate("/salesorders")} className="text-xs font-medium text-blue-600 hover:underline">
                    {t("view_all")}
                  </button>
                }
              >
                {products.length > 0 ? (
                  <div className="space-y-3">
                    {products.map((p) => (
                      <div key={p.product_id}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-slate-700 truncate flex-1 mr-2" title={p.name}>
                            {p.name}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-500 shrink-0 tabular-nums">{p.sharePct}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.widthPct}%`, backgroundColor: PRODUCT_BAR }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 w-24 text-right tabular-nums">
                            {formatCurrencyCompact(p.revenue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyNote icon={BarChart3} text={t("no_data")} />
                )}
              </ChartCard>
            ) : null}
          </div>
        )}

        {/* Action queues — lists with destinations, not bare counts */}
        {(salesStats.status !== "denied" || approvals.status !== "denied" || stock.status !== "denied") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {salesStats.status === "loading" ? (
              <SkeletonCard h="h-[260px]" />
            ) : salesStats.data ? (
              <ChartCard
                title={`${t("overdue_invoices")}${overdueCount > 0 ? ` · ${overdueCount}` : ""}`}
                icon={Receipt}
                className={salesStats.status === "refreshing" ? "opacity-60" : ""}
                action={
                  <button
                    onClick={() => navigate("/financials?tab=receivables")}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {t("view_all")}
                  </button>
                }
              >
                {overdueList.length > 0 ? (
                  <div>
                    {overdueList.slice(0, 5).map((inv) => (
                      <QueueRow
                        key={inv.id}
                        primary={`${inv.invoice_number}${inv.customer_name ? ` — ${inv.customer_name}` : ""}`}
                        secondary={`${formatDate(inv.due_date)} · ${inv.days_overdue} ${t("days")}`}
                        right={formatCurrencyCompact(inv.amount_due)}
                        rightCls="text-red-600"
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyNote icon={Receipt} text={t("all_paid")} />
                )}
              </ChartCard>
            ) : null}

            {approvals.status === "loading" ? (
              <SkeletonCard h="h-[260px]" />
            ) : approvals.status === "ok" ? (
              <ChartCard
                title={t("pending_approvals")}
                icon={CheckSquare}
                action={
                  <button onClick={() => navigate("/workflows")} className="text-xs font-medium text-blue-600 hover:underline">
                    {t("view_all")}
                  </button>
                }
              >
                {approvalList.length > 0 ? (
                  <div>
                    {approvalList.map((a) => (
                      <QueueRow
                        key={a.id}
                        primary={a.document_number || a.document_type}
                        secondary={a.rule_name}
                        right={`${a.current_step}/${a.total_steps}`}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyNote icon={CheckSquare} text={t("no_data")} />
                )}
              </ChartCard>
            ) : null}

            {stock.status === "loading" ? (
              <SkeletonCard h="h-[260px]" />
            ) : stock.status === "ok" ? (
              <ChartCard
                title={`${t("low_stock")}${lowStockCount > 0 ? ` · ${lowStockCount}` : ""}`}
                icon={PackageSearch}
                action={
                  <button onClick={() => navigate("/inventory")} className="text-xs font-medium text-blue-600 hover:underline">
                    {t("view_all")}
                  </button>
                }
              >
                {lowStockItems.length > 0 ? (
                  <div>
                    {lowStockItems.slice(0, 5).map((item) => (
                      <QueueRow
                        key={item.product_id}
                        primary={item.name}
                        secondary={item.code}
                        right={`${item.on_hand} / ${item.threshold}`}
                        rightCls={item.on_hand <= 0 ? "text-red-600" : "text-amber-600"}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyNote icon={PackageSearch} text={t("no_data")} />
                )}
              </ChartCard>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
