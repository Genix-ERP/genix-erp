import React, { useState } from 'react';
import { useCargoContext } from '@/components/contexts/CargoContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Ship,
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign,
  Building2,
  FileText
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// Import Cargo components
import CargoShipments from '@/components/cargo/CargoShipments';
import CargoTracking from '@/components/cargo/CargoTracking';
import CargoCashRegister from '@/components/cargo/CargoCashRegister';
import CargoReports from '@/components/cargo/CargoReports';

export default function Cargo() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    shipments,
    cargoCash,
    companyAccounts,
    SHIPMENT_STATUS
  } = useCargoContext();

  const [activeTab, setActiveTab] = useState('shipments');

  // Calculate metrics
  const metrics = {
    totalShipments: shipments.length,
    inTransit: shipments.filter(s => s.status === SHIPMENT_STATUS.IN_TRANSIT).length,
    received: shipments.filter(s => s.status === SHIPMENT_STATUS.RECEIVED).length,
    distributed: shipments.filter(s => s.status === SHIPMENT_STATUS.DISTRIBUTED).length,
    uzsBalance: cargoCash.uzs_balance || 0,
    usdBalance: cargoCash.usd_balance || 0,
    totalCompanies: companyAccounts.length,
    totalDebt: companyAccounts.reduce((sum, acc) => sum + (acc.debt || 0), 0)
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--genix-navy)]">
              {t('cargo_company') || 'Cargo kompaniyasi'}
            </h1>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Ship className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_shipments') || 'Jami yuklar'}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalShipments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('in_transit') || "Yo'lda"}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.inTransit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('received') || 'Qabul qilindi'}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.received}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('distributed') || 'Taqsimlandi'}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.distributed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">UZS {t('balance') || 'Balans'}</p>
                  <p className="text-lg font-bold text-slate-900 truncate">
                    {metrics.uzsBalance.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">USD {t('balance') || 'Balans'}</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${metrics.usdBalance.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('companies') || 'Kompaniyalar'}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalCompanies}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_debt') || 'Jami qarz'}</p>
                  <p className="text-lg font-bold text-slate-900 truncate">
                    {metrics.totalDebt.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="shipments" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Ship className="w-4 h-4" />
              <span>{t('shipments') || 'Yuklar'}</span>
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Clock className="w-4 h-4" />
              <span>{t('tracking') || 'Kuzatish'}</span>
            </TabsTrigger>
            <TabsTrigger value="cash" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <DollarSign className="w-4 h-4" />
              <span>{t('cash_register') || 'Kassa'}</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <FileText className="w-4 h-4" />
              <span>{t('reports') || 'Hisobotlar'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shipments" className="mt-6">
            <CargoShipments />
          </TabsContent>

          <TabsContent value="tracking" className="mt-6">
            <CargoTracking />
          </TabsContent>

          <TabsContent value="cash" className="mt-6">
            <CargoCashRegister />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <CargoReports />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
