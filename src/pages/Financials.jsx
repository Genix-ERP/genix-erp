import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  BookOpen,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText
} from "lucide-react";

import FinanceDashboard from "@/components/finance/FinanceDashboard";
import GeneralLedger from "@/components/finance/GeneralLedger";
import AccountsPayable from "@/components/finance/AccountsPayable";
import AccountsReceivable from "@/components/finance/AccountsReceivable";
import FinancialReports from "@/components/finance/FinancialReports";

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
              value="ledger" 
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">{t('general_ledger')}</span>
              <span className="sm:hidden">GL</span>
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
          <TabsContent value="ledger" className="mt-6">
            <GeneralLedger />
          </TabsContent>
          <TabsContent value="payables" className="mt-6">
            <AccountsPayable />
          </TabsContent>
          <TabsContent value="receivables" className="mt-6">
            <AccountsReceivable />
          </TabsContent>
          <TabsContent value="reports" className="mt-6">
            <FinancialReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}