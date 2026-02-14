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
  FileText,
  Wallet,
  Globe,
  FileCheck,
  Target
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
import CashRegister from "@/components/finance/CashRegister";
import CurrencyManagement from "@/components/finance/CurrencyManagement";
import BudgetManagement from "@/components/finance/BudgetManagement";
import ActSverka from "@/components/finance/ActSverka";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";

const tabTriggerClass = "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900";

export default function Financials() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        <Tabs defaultValue="dashboard" className="w-full">
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

            {/* 3. Kassa (YANGI) */}
            <TabsTrigger value="cash" className={tabTriggerClass}>
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{t('cash_register') || 'Kassa'}</span>
            </TabsTrigger>

            {/* 4. To'lovlar */}
            <TabsTrigger value="payments" className={tabTriggerClass}>
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('payments') || "To'lovlar"}</span>
            </TabsTrigger>

            {/* 5. Kreditor va Debitor */}
            <TabsTrigger value="ap-ar" className={tabTriggerClass}>
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('ap_ar') || 'Kreditor/Debitor'}</span>
              <span className="sm:hidden">KD</span>
            </TabsTrigger>

            {/* 6. Akt sverka (YANGI) */}
            <TabsTrigger value="reconciliation" className={tabTriggerClass}>
              <FileCheck className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reconciliation_act') || 'Akt sverka'}</span>
            </TabsTrigger>

            {/* 7. Valyuta operatsiyalari (YANGI) */}
            <TabsTrigger value="currency" className={tabTriggerClass}>
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{t('currency_operations') || 'Valyuta'}</span>
            </TabsTrigger>

            {/* 8. Soliq stavkalari */}
            <TabsTrigger value="taxes" className={tabTriggerClass}>
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tax_rates') || 'Soliq'}</span>
            </TabsTrigger>

            {/* 9. Bank */}
            <TabsTrigger value="bank" className={tabTriggerClass}>
              <Landmark className="w-4 h-4" />
              <span className="hidden sm:inline">{t('bank')}</span>
            </TabsTrigger>

            {/* 10. Asosiy vositalar */}
            <TabsTrigger value="assets" className={tabTriggerClass}>
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('fixed_assets') || 'Asosiy vositalar'}</span>
              <span className="sm:hidden">AV</span>
            </TabsTrigger>

            {/* 11. Byudjetlashtirish (YANGI) */}
            <TabsTrigger value="budget" className={tabTriggerClass}>
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">{t('budgeting') || 'Byudjet'}</span>
            </TabsTrigger>

            {/* 12. Qaytariladigan */}
            <TabsTrigger value="recurring" className={tabTriggerClass}>
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">{t('recurring') || 'Qaytariladigan'}</span>
            </TabsTrigger>

            {/* 13. Hisobotlar */}
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
          <TabsContent value="cash" className="mt-6">
            <CashRegister />
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
          <TabsContent value="reconciliation" className="mt-6">
            <ActSverka />
          </TabsContent>
          <TabsContent value="currency" className="mt-6">
            <CurrencyManagement />
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
          <TabsContent value="budget" className="mt-6">
            <BudgetManagement />
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
