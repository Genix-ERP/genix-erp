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
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Brain,
  CalendarDays,
  Monitor,
  Route,
  Wrench
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
            <TabsTrigger value="bom" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">{t('bom') || 'BOM'}</span>
            </TabsTrigger>
            <TabsTrigger value="workcenters" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Cog className="w-4 h-4" />
              <span className="hidden sm:inline">{t('work_centers') || 'Work Centers'}</span>
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
            <TabsTrigger value="routing" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Route className="w-4 h-4" />
              <span className="hidden sm:inline">{t('routing_management') || 'Routing'}</span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">{t('equipment_maintenance') || 'Equipment'}</span>
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

          <TabsContent value="bom" className="mt-6">
            <BOMManagement />
          </TabsContent>

          <TabsContent value="workcenters" className="mt-6">
            <WorkCenters />
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

          <TabsContent value="routing" className="mt-6">
            <RoutingManagement />
          </TabsContent>

          <TabsContent value="equipment" className="mt-6">
            <EquipmentMaintenance />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}