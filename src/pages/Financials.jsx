import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  Bell,
  RefreshCw,
  FileText,
  FileCheck,
  Percent,
  BookOpen,
  Clock,
  Scale,
  ListTree,
  Users,
  Target,
  Calendar,
  Globe,
} from "lucide-react";

import FinanceDashboard from "@/components/finance/FinanceDashboard";
import BudgetManagement from "@/components/finance/BudgetManagement";
import CurrencyManagement from "@/components/finance/CurrencyManagement";
import FiscalPeriodsV2 from "@/components/finance/FiscalPeriodsV2";
import CustomerFollowups from "@/components/finance/CustomerFollowups";
import ChartOfAccounts from "@/components/finance/ChartOfAccounts";
import Payments from "@/components/finance/Payments";
import Reconcile from "@/components/finance/Reconcile";
import BankReconciliation from "@/components/finance/BankReconciliation";
import RecurringJournalEntries from "@/components/finance/RecurringJournalEntries";
import FinancialReports from "@/components/finance/FinancialReports";
import ActSverka from "@/components/finance/ActSverka";
import TaxReports from "@/components/finance/TaxReports";
import GeneralLedger from "@/components/finance/GeneralLedger";
import AgedReceivables from "@/components/finance/AgedReceivables";
import AgedPayables from "@/components/finance/AgedPayables";
import AccountCard from "@/components/finance/AccountCard";
import AccountsReceivable from "@/components/finance/AccountsReceivable";
import AccountsPayable from "@/components/finance/AccountsPayable";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { financeService } from "@/api/services/finance";

const tabTriggerClass = "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900";
const subTabTriggerClass = "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600";

// 12 tabs → 6 → 7 (docs/moliya-audit.md §3, moliya-v2 IA). Old ?tab= values
// keep working: each legacy value maps onto its new home (tab + sub-tab).
const LEGACY_TAB_MAP = {
  accounts: { tab: "accounting", sub: "chart" },
  "journal-entries": { tab: "accounting", sub: "journal" },
  "account-card": { tab: "accounting", sub: "card" },
  recurring: { tab: "accounting", sub: "recurring" },
  payments: { tab: "receivables", sub: "customers" },
  "vendor-bills": { tab: "receivables", sub: "vendors" },
  reconcile: { tab: "receivables", sub: "match" },
  reconciliation: { tab: "receivables", sub: "akt" },
  bank: { tab: "cashflow" },
  "tax-reports": { tab: "taxes" },
};

// Sub-chips that moved OUT of the Pul oqimi component (moliya-v2 IA): budgets
// became a top-level tab; currency and both period chips live under
// Buxgalteriya now. Old ?tab=cashflow&sub=... deep links keep working.
const LEGACY_CASHFLOW_SUB_MAP = {
  budgets: { tab: "budgets" },
  currency: { tab: "accounting", sub: "currency" },
  fiscal: { tab: "accounting", sub: "periods" },
  "accounting-periods": { tab: "accounting", sub: "periods" },
};

export default function Financials() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { refreshData } = useFinancials();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab") || "dashboard";
  const rawSub = searchParams.get("sub") || undefined;
  const legacy =
    LEGACY_TAB_MAP[rawTab] ||
    (rawTab === "cashflow" && rawSub ? LEGACY_CASHFLOW_SUB_MAP[rawSub] : undefined);
  const activeTab = legacy ? legacy.tab : rawTab;
  const activeSub = legacy ? legacy.sub : rawSub;

  // Live tab signal: red dot on Qarzdorlik when overdue receivables exist.
  // One light fetch of the server dashboard aggregate on mount; no new
  // endpoint, no polling.
  const [hasOverdueAR, setHasOverdueAR] = useState(false);
  useEffect(() => {
    let alive = true;
    financeService
      .getFinanceDashboard()
      .then((d) => {
        if (alive) setHasOverdueAR((d?.receivables?.overdue || 0) > 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };
  const handleSubChange = (value) => {
    setSearchParams({ tab: activeTab, sub: value }, { replace: true });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            {/* 1. Asosiy panel */}
            <TabsTrigger value="dashboard" className={tabTriggerClass}>
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard')}</span>
            </TabsTrigger>

            {/* 2. Pul oqimi — bank/kassa accounts, transactions, reconciliation */}
            <TabsTrigger value="cashflow" className={tabTriggerClass}>
              <Landmark className="w-4 h-4" />
              <span className="hidden sm:inline">{t('pul_oqimi') || 'Pul oqimi'}</span>
            </TabsTrigger>

            {/* 3. Qarzdorlik — AR + AP + aging + akt sverka + follow-ups */}
            <TabsTrigger value="receivables" className={tabTriggerClass}>
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t('qarzdorlik') || 'Qarzdorlik'}</span>
              {hasOverdueAR && (
                <span
                  className="w-2 h-2 rounded-full bg-red-500 shrink-0"
                  title={t('overdue') || "Muddati o'tgan qarzdorlik bor"}
                  aria-hidden="true"
                />
              )}
            </TabsTrigger>

            {/* 4. Byudjetlar — top-level (moved out of Pul oqimi chips) */}
            <TabsTrigger value="budgets" className={tabTriggerClass}>
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">{t('budgets') || 'Byudjetlar'}</span>
            </TabsTrigger>

            {/* 5. Buxgalteriya — chart, journal, kartochka, recurring, davrlar, valyuta */}
            <TabsTrigger value="accounting" className={tabTriggerClass}>
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">{t('accounting') || 'Buxgalteriya'}</span>
            </TabsTrigger>

            {/* 6. Soliq */}
            <TabsTrigger value="taxes" className={tabTriggerClass}>
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">{t('taxes') || 'Soliq'}</span>
            </TabsTrigger>

            {/* 7. Hisobotlar */}
            <TabsTrigger value="reports" className={tabTriggerClass}>
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reports') || 'Hisobotlar'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <FinanceDashboard />
          </TabsContent>

          <TabsContent value="cashflow" className="mt-6">
            <BankReconciliation />
          </TabsContent>

          <TabsContent value="budgets" className="mt-6">
            <BudgetManagement />
          </TabsContent>

          <TabsContent value="receivables" className="mt-6">
            <Tabs value={activeSub || "customers"} onValueChange={handleSubChange} className="w-full">
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4 flex flex-wrap justify-start gap-1 h-auto">
                <TabsTrigger value="customers" className={subTabTriggerClass}>
                  <ArrowDownCircle className="w-4 h-4" />
                  {t('customers') || 'Mijozlar'}
                </TabsTrigger>
                <TabsTrigger value="vendors" className={subTabTriggerClass}>
                  <ArrowUpCircle className="w-4 h-4" />
                  {t('vendors') || 'Yetkazib beruvchilar'}
                </TabsTrigger>
                <TabsTrigger value="ar-list" className={subTabTriggerClass}>
                  <FileText className="w-4 h-4" />
                  {t('receivables_ar') || 'Debitorlik'}
                </TabsTrigger>
                <TabsTrigger value="ap-list" className={subTabTriggerClass}>
                  <FileText className="w-4 h-4" />
                  {t('payables_ap') || 'Kreditorlik'}
                </TabsTrigger>
                <TabsTrigger value="aging" className={subTabTriggerClass}>
                  <Clock className="w-4 h-4" />
                  {t('aging_tab') || "Muddati o'tgan"}
                </TabsTrigger>
                <TabsTrigger value="akt" className={subTabTriggerClass}>
                  <FileCheck className="w-4 h-4" />
                  {t('reconciliation_act') || 'Akt sverka'}
                </TabsTrigger>
                <TabsTrigger value="match" className={subTabTriggerClass}>
                  <Scale className="w-4 h-4" />
                  {language === 'ru' ? 'Сопоставление' : language === 'uz' ? 'Solishtirish' : 'Reconcile'}
                </TabsTrigger>
                <TabsTrigger value="followups" className={subTabTriggerClass}>
                  <Bell className="w-4 h-4" />
                  {t('followups') || 'Eslatmalar'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="customers">
                <Payments side="customer" />
              </TabsContent>
              <TabsContent value="vendors">
                <Payments side="vendor" />
              </TabsContent>
              <TabsContent value="ar-list">
                <AccountsReceivable />
              </TabsContent>
              <TabsContent value="ap-list">
                <AccountsPayable />
              </TabsContent>
              <TabsContent value="aging" className="space-y-8">
                <AgedReceivables />
                <AgedPayables />
              </TabsContent>
              <TabsContent value="akt">
                <ActSverka />
              </TabsContent>
              <TabsContent value="match">
                <Reconcile />
              </TabsContent>
              <TabsContent value="followups">
                <CustomerFollowups />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="accounting" className="mt-6">
            <Tabs value={activeSub || "chart"} onValueChange={handleSubChange} className="w-full">
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4 flex flex-wrap justify-start gap-1 h-auto">
                <TabsTrigger value="chart" className={subTabTriggerClass}>
                  <ListTree className="w-4 h-4" />
                  {t('chart_of_accounts_tab') || 'Hisoblar rejasi'}
                </TabsTrigger>
                <TabsTrigger value="journal" className={subTabTriggerClass}>
                  <BookOpen className="w-4 h-4" />
                  {t('journal_entries') || 'Jurnal yozuvlari'}
                </TabsTrigger>
                <TabsTrigger value="card" className={subTabTriggerClass}>
                  <FileText className="w-4 h-4" />
                  {language === 'ru' ? 'Карточка счёта' : language === 'uz' ? 'Kartochka' : 'Account Card'}
                </TabsTrigger>
                {/* "Qaytariladigan" was a mistranslation — these are RECURRING
                    journal templates, so the tab now says "Takrorlanuvchi". */}
                <TabsTrigger value="recurring" className={subTabTriggerClass}>
                  <RefreshCw className="w-4 h-4" />
                  {t('takrorlanuvchi') || 'Takrorlanuvchi'}
                </TabsTrigger>
                {/* Davrlar — THE single period system (replaces "Moliyaviy
                    davrlar" + "Hisob davrlari" chips from Pul oqimi) */}
                <TabsTrigger value="periods" className={subTabTriggerClass}>
                  <Calendar className="w-4 h-4" />
                  {t('pc_periods_title') || 'Davrlar'}
                </TabsTrigger>
                {/* Valyuta — settings/rates surface, moved out of Pul oqimi */}
                <TabsTrigger value="currency" className={subTabTriggerClass}>
                  <Globe className="w-4 h-4" />
                  {t('currency') || 'Valyuta'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="chart">
                <ChartOfAccounts />
              </TabsContent>
              <TabsContent value="journal">
                <GeneralLedger />
              </TabsContent>
              <TabsContent value="card">
                <AccountCard />
              </TabsContent>
              <TabsContent value="recurring">
                <RecurringJournalEntries />
              </TabsContent>
              <TabsContent value="periods">
                <FiscalPeriodsV2 />
              </TabsContent>
              <TabsContent value="currency">
                <CurrencyManagement />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="taxes" className="mt-6">
            <TaxReports />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <FinancialReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
