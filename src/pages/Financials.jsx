import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  BookOpen,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  ListTree,
  CreditCard,
  Percent,
  Landmark,
  Wallet,
  Globe,
  Calendar,
  PiggyBank,
  Building2
} from "lucide-react";

import FinanceDashboard from "@/components/finance/FinanceDashboard";
import GeneralLedger from "@/components/finance/GeneralLedger";
import AccountsPayable from "@/components/finance/AccountsPayable";
import AccountsReceivable from "@/components/finance/AccountsReceivable";
import FinancialReports from "@/components/finance/FinancialReports";
import ChartOfAccounts from "@/components/finance/ChartOfAccounts";
import Payments from "@/components/finance/Payments";
import TaxRates from "@/components/finance/TaxRates";
import BankReconciliation from "@/components/finance/BankReconciliation";
import CashRegister from "@/components/finance/CashRegister";
import CurrencyManagement from "@/components/finance/CurrencyManagement";
import FiscalPeriods from "@/components/finance/FiscalPeriods";
import BudgetManagement from "@/components/finance/BudgetManagement";
import FixedAssets from "@/components/finance/FixedAssets";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Financials() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--genix-navy)]">{t('financials_title')}</h1>
          <p className="text-sm md:text-base text-slate-600 mt-2">{t('financials_subtitle')}</p>
        </div>

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
              <span className="hidden sm:inline">{t('chart_of_accounts') || 'Chart of Accounts'}</span>
              <span className="sm:hidden">COA</span>
            </TabsTrigger>

            <TabsTrigger
              value="ledger"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">{t('general_ledger')}</span>
              <span className="sm:hidden">GL</span>
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
              value="cash"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{t('cash_register')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="currency"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{t('currency')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="fiscal"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">{t('fiscal_periods') || 'Fiscal Periods'}</span>
              <span className="sm:hidden">FP</span>
            </TabsTrigger>

            <TabsTrigger
              value="budgets"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <PiggyBank className="w-4 h-4" />
              <span className="hidden sm:inline">{t('budgets') || 'Budgets'}</span>
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
              value="reports"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reports')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <FinanceDashboard />
          </TabsContent>
          <TabsContent value="accounts" className="mt-6">
            <ChartOfAccounts />
          </TabsContent>
          <TabsContent value="ledger" className="mt-6">
            <GeneralLedger />
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
          <TabsContent value="taxes" className="mt-6">
            <TaxRates />
          </TabsContent>
          <TabsContent value="bank" className="mt-6">
            <BankReconciliation />
          </TabsContent>
          <TabsContent value="cash" className="mt-6">
            <CashRegister />
          </TabsContent>
          <TabsContent value="currency" className="mt-6">
            <CurrencyManagement />
          </TabsContent>
          <TabsContent value="fiscal" className="mt-6">
            <FiscalPeriods />
          </TabsContent>
          <TabsContent value="budgets" className="mt-6">
            <BudgetManagement />
          </TabsContent>
          <TabsContent value="assets" className="mt-6">
            <FixedAssets />
          </TabsContent>
          <TabsContent value="reports" className="mt-6">
            <FinancialReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
