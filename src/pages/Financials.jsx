import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  ListTree,
  CreditCard,
  Percent,
  Landmark,
  Building2,
  Bell,
  RefreshCw,
  Receipt,
  FileText
} from "lucide-react";

import FinanceDashboard from "@/components/finance/FinanceDashboard";
import CustomerFollowups from "@/components/finance/CustomerFollowups";
import AccountsPayable from "@/components/finance/AccountsPayable";
import AccountsReceivable from "@/components/finance/AccountsReceivable";
import ChartOfAccounts from "@/components/finance/ChartOfAccounts";
import Payments from "@/components/finance/Payments";
import TaxRates from "@/components/finance/TaxRates";
import BankReconciliation from "@/components/finance/BankReconciliation";
import FixedAssets from "@/components/finance/FixedAssets";
import RecurringJournalEntries from "@/components/finance/RecurringJournalEntries";
import FinancialReports from "@/components/finance/FinancialReports";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";

export default function Financials() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger
              value="dashboard"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="accounts"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <ListTree className="w-4 h-4" />
              <span className="hidden sm:inline">{t('accounting') || 'Accounting'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="payments"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('payments') || 'Payments'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="ap-ar"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('ap_ar') || 'AP & AR'}</span>
              <span className="sm:hidden">AP/AR</span>
            </TabsTrigger>

            <TabsTrigger
              value="taxes"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tax_rates') || 'Tax Rates'}</span>
              <span className="sm:hidden">Tax</span>
            </TabsTrigger>

            <TabsTrigger
              value="bank"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Landmark className="w-4 h-4" />
              <span className="hidden sm:inline">{t('bank')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="assets"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('fixed_assets') || 'Fixed Assets'}</span>
              <span className="sm:hidden">FA</span>
            </TabsTrigger>

            <TabsTrigger
              value="recurring"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">{t('recurring') || 'Recurring'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="reports"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reports') || 'Reports'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <FinanceDashboard />
          </TabsContent>
          <TabsContent value="accounts" className="mt-6">
            <ChartOfAccounts />
          </TabsContent>
          <TabsContent value="payments" className="mt-6">
            <Payments />
          </TabsContent>
          <TabsContent value="ap-ar" className="mt-6">
            <Tabs defaultValue="payables" className="w-full">
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
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
                  value="followups"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <Bell className="w-4 h-4" />
                  {t('followups') || 'Follow-ups'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="payables">
                <AccountsPayable />
              </TabsContent>
              <TabsContent value="receivables">
                <AccountsReceivable />
              </TabsContent>
              <TabsContent value="followups">
                <CustomerFollowups />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="taxes" className="mt-6">
            <TaxRates />
          </TabsContent>
          <TabsContent value="bank" className="mt-6">
            <BankReconciliation />
          </TabsContent>
          <TabsContent value="assets" className="mt-6">
            <FixedAssets />
          </TabsContent>
          <TabsContent value="recurring" className="mt-6">
            <RecurringJournalEntries />
          </TabsContent>
          <TabsContent value="reports" className="mt-6">
            <FinancialReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
