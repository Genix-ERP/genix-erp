import React, { useState, useEffect } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Factory,
  PackageCheck,
  ClipboardList,
  Cog,
  TrendingUp,
  Zap,
  CalendarDays,
  Monitor,
  Route,
  Wrench,
  Settings2
} from 'lucide-react';

import ManufacturingDashboard from '@/components/manufacturing/ManufacturingDashboard';
import ProductionOrders from '@/components/manufacturing/ProductionOrders';
import ProductionSchedule from '@/components/manufacturing/ProductionSchedule';
import BOMManagement from '@/components/manufacturing/BOMManagement';
import WorkCenters from '@/components/manufacturing/WorkCenters';
import QualityControl from '@/components/manufacturing/QualityControl';
import MRPPlanning from '@/components/manufacturing/MRPPlanning';
import ShopFloorControl from '@/components/manufacturing/ShopFloorControl';
import RoutingManagement from '@/components/manufacturing/RoutingManagement';
import EquipmentMaintenance from '@/components/manufacturing/EquipmentMaintenance';

import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

export default function Manufacturing() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard') || 'Dashboard'}</span>
            </TabsTrigger>
            <TabsTrigger value="production" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Factory className="w-4 h-4" />
              <span className="hidden sm:inline">{t('production') || 'Production'}</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">{t('schedule') || 'Schedule'}</span>
            </TabsTrigger>
            <TabsTrigger value="bom-routing" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">{t('bom_routing') || 'BOM & Routing'}</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('resources') || 'Resources'}</span>
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <PackageCheck className="w-4 h-4" />
              <span className="hidden sm:inline">{t('quality') || 'Quality'}</span>
            </TabsTrigger>
            <TabsTrigger value="mrp" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mrp') || 'MRP'}</span>
            </TabsTrigger>
            <TabsTrigger value="shopfloor" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">{t('shop_floor_control') || 'Shop Floor'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <ManufacturingDashboard />
          </TabsContent>

          <TabsContent value="production" className="mt-6">
            <ProductionOrders />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ProductionSchedule />
          </TabsContent>

          <TabsContent value="bom-routing" className="mt-6">
            <Tabs defaultValue="bom" className="w-full">
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
                <TabsTrigger
                  value="bom"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <ClipboardList className="w-4 h-4" />
                  {t('bom') || 'BOM'}
                </TabsTrigger>
                <TabsTrigger
                  value="routing"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <Route className="w-4 h-4" />
                  {t('routing') || 'Routing'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bom">
                <BOMManagement />
              </TabsContent>
              <TabsContent value="routing">
                <RoutingManagement />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="resources" className="mt-6">
            <Tabs defaultValue="workcenters" className="w-full">
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
                <TabsTrigger
                  value="workcenters"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <Cog className="w-4 h-4" />
                  {t('work_centers') || 'Work Centers'}
                </TabsTrigger>
                <TabsTrigger
                  value="equipment"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600"
                >
                  <Wrench className="w-4 h-4" />
                  {t('equipment') || 'Equipment'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="workcenters">
                <WorkCenters />
              </TabsContent>
              <TabsContent value="equipment">
                <EquipmentMaintenance />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="quality" className="mt-6">
            <QualityControl />
          </TabsContent>

          <TabsContent value="mrp" className="mt-6">
            <MRPPlanning />
          </TabsContent>

          <TabsContent value="shopfloor" className="mt-6">
            <ShopFloorControl />
          </TabsContent>

        </Tabs>

      </div>
    </div>
  );
}