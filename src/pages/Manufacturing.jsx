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
  CalendarDays
} from 'lucide-react';

import ManufacturingDashboard from '@/components/manufacturing/ManufacturingDashboard';
import ProductionOrders from '@/components/manufacturing/ProductionOrders';
import ProductionSchedule from '@/components/manufacturing/ProductionSchedule';
import BOMManagement from '@/components/manufacturing/BOMManagement';
import WorkCenters from '@/components/manufacturing/WorkCenters';
import QualityControl from '@/components/manufacturing/QualityControl';
import MRPPlanning from '@/components/manufacturing/MRPPlanning';

import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

export default function Manufacturing() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-6 md:p-8 rounded-2xl text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Factory className="w-8 h-8" />
              <h1 className="text-2xl md:text-3xl font-bold">Manufacturing Operations</h1>
              <Badge className="bg-white/20 text-white border-white/30">
                <Brain className="w-3 h-3 mr-1" />
                AI-Powered
              </Badge>
            </div>
            <p className="text-white/90 text-base md:text-lg">
              Intelligent production planning, scheduling, and quality control powered by Genix AI
            </p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-xl shadow-sm">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="production" className="flex items-center gap-2">
              <Factory className="w-4 h-4" />
              <span className="hidden sm:inline">Production</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="bom" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">BOM</span>
            </TabsTrigger>
            <TabsTrigger value="workcenters" className="flex items-center gap-2">
              <Cog className="w-4 h-4" />
              <span className="hidden sm:inline">Work Centers</span>
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Quality</span>
            </TabsTrigger>
            <TabsTrigger value="mrp" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">MRP</span>
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
        </Tabs>

      </div>
    </div>
  );
}