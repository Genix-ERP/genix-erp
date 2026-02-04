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
  Bell
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
              value="payables"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('payables_ap')}</span>
              <span className="sm:hidden">AP</span>
            </TabsTrigger>

            <TabsTrigger
              value="receivables"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('receivables_ar')}</span>
              <span className="sm:hidden">AR</span>
            </TabsTrigger>

            <TabsTrigger
              value="followups"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">{t('followups') || 'Follow-ups'}</span>
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
          <TabsContent value="payables" className="mt-6">
            <AccountsPayable />
          </TabsContent>
          <TabsContent value="receivables" className="mt-6">
            <AccountsReceivable />
          </TabsContent>
          <TabsContent value="followups" className="mt-6">
            <CustomerFollowups />
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
        </Tabs>
      </div>
    </div>
  );
}
