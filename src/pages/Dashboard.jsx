
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  UserCheck,
  FileWarning,
} from "lucide-react";

import MetricCard from "@/components/dashboard/MetricCard";
import RevenueExpenseChart from "@/components/dashboard/RevenueExpenseChart";
import CashFlowWaterfall from "@/components/dashboard/CashFlowWaterfall";
import SalesFunnel from "@/components/dashboard/SalesFunnel";
import TopProductsChart from "@/components/dashboard/TopProductsChart";
import ClientSegmentsDonut from "@/components/dashboard/ClientSegmentsDonut";
import InventoryStackedBar from "@/components/dashboard/InventoryStackedBar";
import TodaysTasks from "@/components/dashboard/TodaysTasks";
import TopClientsList from "@/components/dashboard/TopClientsList";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import AIBusinessPulse from "@/components/dashboard/AIBusinessPulse";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useModules } from "@/components/contexts/ModulesContext";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { financeService } from "@/api/services/finance";

import {
  analyzeSales,
  analyzeInventory,
  analyzeFinancials,
  analyzeHR,
  analyzeBusinessHealth,
} from "@/api/services/aiAnalytics";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" },
  }),
};

export default function Dashboard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const { items: inventory, stockMovements, refreshData: refreshInventory } = useInventory();
  const { financialTransactions, customerInvoices, vendorBills, refreshData: refreshFinancials } = useFinancials();
  const { customers, leads, opportunities, refreshData: refreshCustomers } = useCustomers();
  const { employees, salesOrders, expenses, payrolls, refreshData: refreshModules } = useModules();

  const [isLoading, setIsLoading] = useState(true);

  // Year-to-date accrual totals from the trial balance.
  // The dashboard's revenue/expense metrics were derived from cash payments only —
  // so COGS journal entries (debits on class-9 accounts like 9110) never showed
  // up in "Xarajatlar". We fetch the trial balance turnover and use the
  // accrual figures whenever they exist, so the dashboard matches what
  // Buxgalteriya / Forma-2 reports.
  const [accrualTotals, setAccrualTotals] = useState({ revenue: 0, expenses: 0, byMonth: {} });

  useEffect(() => {
    refreshInventory();
    refreshFinancials();
    refreshCustomers();
    refreshModules();
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Pull YTD trial balance turnover and roll it up into a single
    // revenue / expense pair we can use on the metrics card. Then loop the
    // last 12 months of the income statement so the Revenue Trends and Cash
    // Flow charts have data — they were empty because they only saw the
    // payment-derived financialTransactions, while real activity (sales,
    // COGS, purchases) lives in journal entries.
    const loadAccruals = async () => {
      try {
        const now = new Date();
        const periodFrom = `${now.getFullYear()}-01-01`;
        const periodTo = now.toISOString().slice(0, 10);
        const tb = await financeService.getTrialBalanceWithTurnover({ period_from: periodFrom, period_to: periodTo });
        const rows = tb?.rows || tb?.accounts || [];
        let revenue = 0;
        let expenses = 0;
        for (const r of rows) {
          const category = (r.category || '').toLowerCase();
          if (category === 'revenue') {
            revenue += Number(r.turnover_credit || 0) - Number(r.turnover_debit || 0);
          } else if (category === 'expense') {
            expenses += Number(r.turnover_debit || 0) - Number(r.turnover_credit || 0);
          }
        }

        // Monthly buckets — fetch income statement for each of the last 12
        // months. byMonth[0..11] keyed by month index (Jan=0).
        const byMonth = {};
        const nowYear = now.getFullYear();
        const monthlyPromises = [];
        for (let m = 0; m <= now.getMonth(); m++) {
          const from = `${nowYear}-${String(m + 1).padStart(2, '0')}-01`;
          const lastDay = new Date(nowYear, m + 1, 0).getDate();
          const to = `${nowYear}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          monthlyPromises.push(
            financeService.getIncomeStatement({ period_from: from, period_to: to })
              .then((d) => {
                const inc = Number(d?.total_revenue || 0);
                const cogs = (d?.cost_of_sales || []).reduce((s, a) => s + Math.abs(Number(a.amount) || 0), 0);
                const opex = (d?.operating_expenses || []).reduce((s, a) => s + Math.abs(Number(a.amount) || 0), 0);
                const other = (d?.other_expenses || []).reduce((s, a) => s + Math.abs(Number(a.amount) || 0), 0);
                byMonth[m] = { revenue: inc, expenses: cogs + opex + other };
              })
              .catch(() => { byMonth[m] = { revenue: 0, expenses: 0 }; })
          );
        }
        await Promise.all(monthlyPromises);

        setAccrualTotals({
          revenue: Math.max(revenue, 0),
          expenses: Math.max(expenses, 0),
          byMonth,
        });
      } catch {
        // Silent — fall back to payment-derived numbers.
      }
    };
    loadAccruals();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // AI analyses
  const salesAnalysis = useMemo(() => analyzeSales(salesOrders, customers, language), [salesOrders, customers, language]);
  const inventoryAnalysis = useMemo(() => analyzeInventory(inventory, stockMovements, language), [inventory, stockMovements, language]);
  const financialAnalysis = useMemo(() => analyzeFinancials(financialTransactions, [], [], language), [financialTransactions, language]);
  const hrAnalysis = useMemo(() => analyzeHR(employees, payrolls, language), [employees, payrolls, language]);

  const businessHealth = useMemo(() => analyzeBusinessHealth({
    salesOrders, inventory, transactions: financialTransactions, employees, projects: [], language,
  }), [salesOrders, inventory, financialTransactions, employees, language]);

  // Metrics
  const metrics = useMemo(() => {
    const paymentRevenue = financialTransactions
      .filter((tx) => tx.transaction_type === "income")
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const paymentExpenses = financialTransactions
      .filter((tx) => tx.transaction_type === "expense")
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Prefer accrual numbers from the trial balance (includes COGS / 9xxx
    // expenses that never appear as cash payments). Fall back to payment
    // totals only when the trial balance is empty.
    const totalRevenue = accrualTotals.revenue > 0 ? accrualTotals.revenue : paymentRevenue;
    const totalExpenses = accrualTotals.expenses > 0 ? accrualTotals.expenses : paymentExpenses;

    const netProfit = totalRevenue - totalExpenses;

    const now = new Date();
    const newThisMonth = customers.filter((c) => {
      const created = new Date(c.created_at || c.createdAt || c.date_created || 0);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;

    const churnedCount = customers.filter((c) => c.status === "inactive" || c.status === "churned").length;

    const overdueInvoices = (customerInvoices || []).filter((inv) => {
      const due = new Date(inv.due_date);
      return due < now && inv.status !== "paid";
    });

    const overdueTotal = overdueInvoices.reduce((s, inv) => s + (inv.total_amount || inv.amount || 0), 0);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      totalCustomers: customers.length,
      newThisMonth,
      churnedCount,
      overdueCount: overdueInvoices.length,
      overdueTotal,
      lowStockItems: inventory.filter((item) => item.current_stock <= (item.reorder_level || 10)).length,
    };
  }, [financialTransactions, inventory, customers, customerInvoices, accrualTotals]);

  // Revenue vs Expenses chart data (monthly).
  // Prefers accrual buckets from accrualTotals.byMonth (sourced from the
  // monthly income statement); falls back to payment-derived buckets so the
  // chart still renders something on tenants with no journal entries yet.
  const revenueExpenseData = useMemo(() => {
    const monthKeys = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const months = monthKeys.map(k => t(k) || k);
    const monthMap = {};
    months.forEach((m, idx) => {
      monthMap[m] = { month: m, monthIndex: idx, revenue: 0, expenses: 0, profit: 0 };
    });

    // 1. Start from payment-derived (cash basis)
    financialTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      const monthIndex = d.getMonth();
      const m = months[monthIndex];
      if (!m) return;
      if (tx.transaction_type === "income") {
        monthMap[m].revenue += tx.amount || 0;
      } else if (tx.transaction_type === "expense") {
        monthMap[m].expenses += tx.amount || 0;
      }
    });

    // 2. Overlay accrual numbers (preferred) where they exist
    const byMonth = accrualTotals?.byMonth || {};
    Object.entries(byMonth).forEach(([idxStr, bucket]) => {
      const idx = Number(idxStr);
      const m = months[idx];
      if (!m) return;
      if (bucket.revenue > 0) monthMap[m].revenue = bucket.revenue;
      if (bucket.expenses > 0) monthMap[m].expenses = bucket.expenses;
    });

    Object.values(monthMap).forEach((entry) => {
      entry.profit = entry.revenue - entry.expenses;
      entry.revenue = Math.round(entry.revenue);
      entry.expenses = Math.round(entry.expenses);
      entry.profit = Math.round(entry.profit);
    });

    return Object.values(monthMap);
  }, [financialTransactions, accrualTotals, t]);

  // Sparkline data for metrics
  const revenueSparkline = useMemo(() => {
    return revenueExpenseData.filter((d) => d.revenue > 0).slice(-6).map((d) => ({ v: d.revenue }));
  }, [revenueExpenseData]);

  const expenseSparkline = useMemo(() => {
    return revenueExpenseData.filter((d) => d.expenses > 0).slice(-6).map((d) => ({ v: d.expenses }));
  }, [revenueExpenseData]);

  // AI Insights & Recommendations
  const allInsights = useMemo(() => {
    const insights = [];
    if (salesAnalysis.insights) insights.push(...salesAnalysis.insights.slice(0, 2));
    if (inventoryAnalysis.insights) insights.push(...inventoryAnalysis.insights.slice(0, 2));
    if (financialAnalysis.insights) insights.push(...financialAnalysis.insights.slice(0, 1));
    if (hrAnalysis.insights) insights.push(...hrAnalysis.insights.slice(0, 1));
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return insights
      .sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3))
      .slice(0, 6);
  }, [salesAnalysis, inventoryAnalysis, financialAnalysis, hrAnalysis]);

  const allRecommendations = useMemo(() => [
    ...salesAnalysis.recommendations.slice(0, 2),
    ...inventoryAnalysis.recommendations.slice(0, 2),
    ...hrAnalysis.recommendations.slice(0, 1),
  ].slice(0, 3), [salesAnalysis, inventoryAnalysis, hrAnalysis]);

  const revenueGrowth = salesAnalysis.metrics?.growthRate;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#6C5CE7] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">{t("loading") || "Loading..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 min-h-screen">
      <div className="max-w-[1440px] mx-auto space-y-5">

        {/* === KPI Cards Row (5 cards) === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
          {/* 1. Revenue */}
          <motion.div custom={0} initial="hidden" animate="visible" variants={fadeIn} className="h-full">
            <MetricCard
              title={t("revenue") || "Daromad"}
              value={formatCurrency(metrics.totalRevenue)}
              change={revenueGrowth ? `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%` : t("n_a") || "—"}
              trend={revenueGrowth > 0 ? "up" : revenueGrowth < 0 ? "down" : "neutral"}
              icon={DollarSign}
              color="green"
              sparklineData={revenueSparkline}
            />
          </motion.div>

          {/* 2. Expenses */}
          <motion.div custom={1} initial="hidden" animate="visible" variants={fadeIn} className="h-full">
            <MetricCard
              title={t("expenses") || "Xarajatlar"}
              value={formatCurrency(metrics.totalExpenses)}
              change={metrics.totalRevenue > 0 ? `${((metrics.totalExpenses / metrics.totalRevenue) * 100).toFixed(0)}% ${t("of_revenue") || "of revenue"}` : "—"}
              trend={metrics.totalExpenses > metrics.totalRevenue * 0.7 ? "warning" : "neutral"}
              icon={Wallet}
              color="coral"
              sparklineData={expenseSparkline}
              ratioBar={metrics.totalRevenue > 0 ? {
                percentage: (metrics.totalExpenses / metrics.totalRevenue) * 100,
                color: metrics.totalExpenses > metrics.totalRevenue * 0.7 ? "#E17055" : "#FDCB6E",
                label: `${((metrics.totalExpenses / metrics.totalRevenue) * 100).toFixed(0)}%`,
              } : undefined}
            />
          </motion.div>

          {/* 3. Net Profit */}
          <motion.div custom={2} initial="hidden" animate="visible" variants={fadeIn} className="h-full">
            <MetricCard
              title={t("net_profit") || "Sof foyda"}
              value={formatCurrency(Math.abs(metrics.netProfit))}
              change={metrics.netProfit >= 0 ? (t("profitable") || "Profitable") : (t("loss") || "Loss")}
              trend={metrics.netProfit >= 0 ? "up" : "down"}
              icon={TrendingUp}
              color={metrics.netProfit >= 0 ? "green" : "red"}
              badge={metrics.netProfit >= 0 ? undefined : "ZARAR"}
              badgeColor={metrics.netProfit >= 0 ? undefined : "bg-red-100 text-red-700"}
            />
          </motion.div>

          {/* 4. Active Clients */}
          <motion.div custom={3} initial="hidden" animate="visible" variants={fadeIn} className="h-full">
            <MetricCard
              title={t("customers") || "Mijozlar"}
              value={metrics.totalCustomers.toLocaleString()}
              change={`+${metrics.newThisMonth} ${t("new_lc") || "new"}`}
              trend="up"
              icon={UserCheck}
              color="teal"
              subtitle={metrics.churnedCount > 0 ? `${metrics.churnedCount} ${t("churned") || "churned"}` : undefined}
            />
          </motion.div>

          {/* 5. Overdue Invoices */}
          <motion.div custom={4} initial="hidden" animate="visible" variants={fadeIn} className="h-full">
            <MetricCard
              title={t("overdue") || "Overdue"}
              value={`${metrics.overdueCount} ta`}
              change={metrics.overdueTotal > 0 ? formatCurrency(metrics.overdueTotal) : (t("all_paid") || "All paid")}
              trend={metrics.overdueCount > 0 ? "warning" : "up"}
              icon={FileWarning}
              color={metrics.overdueCount > 0 ? "red" : "green"}
              badge={metrics.overdueCount > 0 ? (t("urgent") || "URGENT") : undefined}
              badgeColor="bg-red-100 text-red-700"
            />
          </motion.div>
        </div>

        {/* === Charts Section Row 1: Revenue + Cash Flow === */}
        <motion.div custom={5} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueExpenseChart data={revenueExpenseData} />
            <CashFlowWaterfall transactions={financialTransactions} customerInvoices={customerInvoices} vendorBills={vendorBills} />
          </div>
        </motion.div>

        {/* === Charts Section Row 2: Funnel + Top Products === */}
        <motion.div custom={6} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SalesFunnel
              leads={leads}
              opportunities={opportunities}
              salesOrders={salesOrders}
            />
            <TopProductsChart />
          </div>
        </motion.div>

        {/* === Charts Section Row 3: Client Segments + Inventory === */}
        <motion.div custom={7} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClientSegmentsDonut customers={customers} salesOrders={salesOrders} />
            <InventoryStackedBar inventory={inventory} />
          </div>
        </motion.div>

        {/* === Operational Panels: Tasks + Top Clients + Transactions === */}
        <motion.div custom={8} initial="hidden" animate="visible" variants={fadeIn}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TodaysTasks
              salesOrders={salesOrders}
              inventory={inventory}
              employees={employees}
              customerInvoices={customerInvoices}
            />
            <TopClientsList customers={customers} salesOrders={salesOrders} customerInvoices={customerInvoices} />
            <RecentTransactions
              financialTransactions={financialTransactions}
              customerInvoices={customerInvoices}
              vendorBills={vendorBills}
            />
          </div>
        </motion.div>

        {/* === AI Section (Full Width, Impressive) === */}
        <motion.div custom={9} initial="hidden" animate="visible" variants={fadeIn}>
          <AIBusinessPulse
            businessHealth={businessHealth}
            allInsights={allInsights}
            allRecommendations={allRecommendations}
            t={t}
          />
        </motion.div>
      </div>
    </div>
  );
}
