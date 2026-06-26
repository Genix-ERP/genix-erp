import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  ListTree,
  CreditCard,
  Landmark,
  Bell,
  RefreshCw,
  FileText,
  FileCheck,
  Percent,
  BookOpen,
  Clock,
  Receipt,
  TrendingUp,
  Calculator,
  Scale
} from "lucide-react";

import FinanceDashboard from "@/components/finance/FinanceDashboard";
import CustomerFollowups from "@/components/finance/CustomerFollowups";
import AccountsPayable from "@/components/finance/AccountsPayable";
import AccountsReceivable from "@/components/finance/AccountsReceivable";
import ChartOfAccounts from "@/components/finance/ChartOfAccounts";
import Payments from "@/components/finance/Payments";
import Reconcile from "@/components/finance/Reconcile";
import BankReconciliation from "@/components/finance/BankReconciliation";
import RecurringJournalEntries from "@/components/finance/RecurringJournalEntries";
import FinancialReports from "@/components/finance/FinancialReports";
import ActSverka from "@/components/finance/ActSverka";
import TaxReports from "@/components/finance/TaxReports";
// Profit-tax calculator — §8.1 "Фойда солиғи / Солиқ ҳисоби" tab of
// ТЗ_Ish_Haqi_Soliq_Tolik.docx. Mounted here as a tab inside Financials
// (not a standalone sidebar page); see Layout.jsx for the rationale.
import ProfitTax from "@/pages/ProfitTax";
// TaxSummary — director-level dashboard aggregating the 8 TZ-listed
// taxes for a period. Sits next to ProfitTax; each is useful on its own
// but TaxSummary is the "headline" view that shows Kompaniya soliqlari
// rates actually driving numbers.
import TaxSummary from "@/pages/TaxSummary";
import GeneralLedger from "@/components/finance/GeneralLedger";
import AgedReceivables from "@/components/finance/AgedReceivables";
import AgedPayables from "@/components/finance/AgedPayables";
import AccountCard from "@/components/finance/AccountCard";
import FinanceVendorBills from "@/components/finance/FinanceVendorBills";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { useFinancials } from "@/components/contexts/FinancialsContext";

const tabTriggerClass = "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900";

export default function Financials() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { refreshData } = useFinancials();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") || "dashboard";

  // Refresh financial data when navigating to Financials page
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            {/* 1. Boshqaruv paneli */}
            <TabsTrigger value="dashboard" className={tabTriggerClass}>
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard')}</span>
            </TabsTrigger>

            {/* 2. Buxgalteriya */}
            <TabsTrigger value="accounts" className={tabTriggerClass}>
              <ListTree className="w-4 h-4" />
              <span className="hidden sm:inline">{t('accounting') || 'Buxgalteriya'}</span>
            </TabsTrigger>

            {/* 3. Jurnal yozuvlari */}
            <TabsTrigger value="journal-entries" className={tabTriggerClass}>
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">{t('journal_entries') || 'Jurnal yozuvlari'}</span>
            </TabsTrigger>

            {/* 3.5. Hisob kartochkasi */}
            <TabsTrigger value="account-card" className={tabTriggerClass}>
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Карточка счёта' : language === 'uz' ? 'Kartochka' : 'Account Card'}</span>
            </TabsTrigger>

            {/* 4. To'lovlar */}
            <TabsTrigger value="payments" className={tabTriggerClass}>
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('payments') || "To'lovlar"}</span>
            </TabsTrigger>

            {/* 5. Vendor Bills */}
            <TabsTrigger value="vendor-bills" className={tabTriggerClass}>
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('vendor_bills') || 'Vendor Bills'}</span>
            </TabsTrigger>

            {/* 5b. Reconcile (Odoo-style) */}
            <TabsTrigger value="reconcile" className={tabTriggerClass}>
              <Scale className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Сопоставление' : language === 'uz' ? 'Solishtirish' : 'Reconcile'}</span>
            </TabsTrigger>

            {/* 6. Akt sverka */}
            <TabsTrigger value="reconciliation" className={tabTriggerClass}>
              <FileCheck className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reconciliation_act') || 'Akt sverka'}</span>
            </TabsTrigger>

            {/* 7. Bank */}
            <TabsTrigger value="bank" className={tabTriggerClass}>
              <Landmark className="w-4 h-4" />
              <span className="hidden sm:inline">{t('bank')}</span>
            </TabsTrigger>

            {/* 8. Qaytariladigan */}
            <TabsTrigger value="recurring" className={tabTriggerClass}>
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">{t('recurring') || 'Qaytariladigan'}</span>
            </TabsTrigger>

            {/* 13. Soliq hisobotlari — Profit tax (§8.1) and Tax
                summary (§10) used to live as their own top-level
                tabs but now nest inside Tax Reports as sub-tabs
                (Overview / Report Periods / Transactions /
                Employee taxes / Profit tax / Tax summary). One
                place for all tax data. */}
            <TabsTrigger value="tax-reports" className={tabTriggerClass}>
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tax_reports') || 'Soliq hisobotlari'}</span>
            </TabsTrigger>

            {/* 15. Hisobotlar */}
            <TabsTrigger value="reports" className={tabTriggerClass}>
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reports') || 'Hisobotlar'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <FinanceDashboard />
          </TabsContent>
          <TabsContent value="accounts" className="mt-6">
            <ChartOfAccounts />
          </TabsContent>
          <TabsContent value="journal-entries" className="mt-6">
            <GeneralLedger />
          </TabsContent>
          <TabsContent value="account-card" className="mt-6">
            <AccountCard />
          </TabsContent>
          <TabsContent value="payments" className="mt-6">
            <Payments />
          </TabsContent>
          <TabsContent value="vendor-bills" className="mt-6">
            <FinanceVendorBills />
          </TabsContent>
          <TabsContent value="reconcile" className="mt-6">
            <Reconcile />
          </TabsContent>
          <TabsContent value="reconciliation" className="mt-6">
            <ActSverka />
          </TabsContent>
          <TabsContent value="bank" className="mt-6">
            <BankReconciliation />
          </TabsContent>
          <TabsContent value="recurring" className="mt-6">
            <RecurringJournalEntries />
          </TabsContent>
          <TabsContent value="tax-reports" className="mt-6">
            <TaxReports />
          </TabsContent>
          {/* "profit-tax" and "tax-summary" tabs were merged into the
              Tax Reports component (rendered as sub-tabs there). The
              standalone TabsContent slots are kept commented out for
              reference only — not mounted anywhere now. */}
          <TabsContent value="reports" className="mt-6">
            <Tabs defaultValue="financial-reports" className="w-full">
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
                <TabsTrigger
                  value="financial-reports"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <FileText className="w-4 h-4" />
                  {t('reports') || 'Reports'}
                </TabsTrigger>
                <TabsTrigger
                  value="payables"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  {t('payables_ap')}
                </TabsTrigger>
                <TabsTrigger
                  value="receivables"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  {t('receivables_ar')}
                </TabsTrigger>
                <TabsTrigger
                  value="aged-receivables"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <Clock className="w-4 h-4" />
                  {t('aged_receivables') || 'Aged Receivables'}
                </TabsTrigger>
                <TabsTrigger
                  value="aged-payables"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <Clock className="w-4 h-4" />
                  {t('aged_payables') || 'Aged Payables'}
                </TabsTrigger>
                <TabsTrigger
                  value="followups"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <Bell className="w-4 h-4" />
                  {t('followups') || 'Follow-ups'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="financial-reports">
                <FinancialReports />
              </TabsContent>
              <TabsContent value="payables">
                <AccountsPayable />
              </TabsContent>
              <TabsContent value="receivables">
                <AccountsReceivable />
              </TabsContent>
              <TabsContent value="aged-receivables">
                <AgedReceivables />
              </TabsContent>
              <TabsContent value="aged-payables">
                <AgedPayables />
              </TabsContent>
              <TabsContent value="followups">
                <CustomerFollowups />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
