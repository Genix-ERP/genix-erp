import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Factory,
  ClipboardList,
  Cog,
  Zap,
  CalendarDays,
  Monitor,
  Route,
  Wrench,
  Tag,
  BarChart3,
  Calculator,
  LayoutDashboard,
  DraftingCompass,
  LineChart,
  PlayCircle,
} from 'lucide-react';

import ManufacturingDashboard from '@/components/manufacturing/ManufacturingDashboard';
import ProductionOrders from '@/components/manufacturing/ProductionOrders';
import ProductionSchedule from '@/components/manufacturing/ProductionSchedule';
import BOMManagement from '@/components/manufacturing/BOMManagement';
import WorkCenters from '@/components/manufacturing/WorkCenters';
import MRPPlanning from '@/components/manufacturing/MRPPlanning';
import ShopFloorControl from '@/components/manufacturing/ShopFloorControl';
import RoutingManagement from '@/components/manufacturing/RoutingManagement';
import EquipmentMaintenance from '@/components/manufacturing/EquipmentMaintenance';
import ManufacturingCategories from '@/components/manufacturing/ManufacturingCategories';
import ManufacturingReport from '@/components/manufacturing/ManufacturingReport';
import CostCalculation from '@/components/manufacturing/CostCalculation';

import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// Ishlab chiqarish — 4 workflow groups (Reja · Bajarish · Muhandislik ·
// Tahlil) instead of the old 10 flat tabs that wrapped to a second row.
// Each group hosts its surfaces as sub-tabs; both levels live in the URL
// (?tab=<group>&sub=<subtab>) so views stay linkable.
const TAB_STYLE =
  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ' +
  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] ' +
  'data-[state=active]:text-white data-[state=active]:shadow-md ' +
  'data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100';

const SUB_TAB_STYLE =
  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ' +
  'data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600';

const GROUPS = ['plan', 'execute', 'engineering', 'analysis'];

const GROUP_SUBS = {
  plan: ['dashboard', 'mrp', 'schedule'],
  execute: ['orders', 'shopfloor'],
  engineering: ['bom', 'routing', 'workcenters', 'equipment', 'categories'],
  analysis: ['costcalc', 'report'],
};

const GROUP_DEFAULT_SUB = {
  plan: 'dashboard',
  execute: 'orders',
  engineering: 'bom',
  analysis: 'costcalc',
};

// Old 10-tab ?tab= URLs land on the group+sub that now hosts that surface,
// so bookmarks and cross-module links keep working.
const LEGACY_TAB_MAP = {
  dashboard: { tab: 'plan', sub: 'dashboard' },
  mrp: { tab: 'plan', sub: 'mrp' },
  schedule: { tab: 'plan', sub: 'schedule' },
  production: { tab: 'execute', sub: 'orders' },
  shopfloor: { tab: 'execute', sub: 'shopfloor' },
  'bom-routing': { tab: 'engineering', sub: 'bom' },
  resources: { tab: 'engineering', sub: 'workcenters' },
  categories: { tab: 'engineering', sub: 'categories' },
  'cost-calc': { tab: 'analysis', sub: 'costcalc' },
  report: { tab: 'analysis', sub: 'report' },
};

export default function Manufacturing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const rawTab = searchParams.get('tab') || 'plan';
  const legacy = LEGACY_TAB_MAP[rawTab];
  const activeGroup = legacy ? legacy.tab : (GROUPS.includes(rawTab) ? rawTab : 'plan');
  const rawSub = legacy ? legacy.sub : searchParams.get('sub');
  const activeSub = GROUP_SUBS[activeGroup].includes(rawSub) ? rawSub : GROUP_DEFAULT_SUB[activeGroup];

  const openTab = (tab, sub) =>
    setSearchParams({ tab, sub: GROUP_SUBS[tab]?.includes(sub) ? sub : GROUP_DEFAULT_SUB[tab] }, { replace: true });

  const subTabsProps = {
    value: activeSub,
    onValueChange: (s) => openTab(activeGroup, s),
    className: 'w-full',
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        <Tabs value={activeGroup} onValueChange={(g) => openTab(g)} className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="plan" className={TAB_STYLE}>
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mfg_group_plan')}</span>
            </TabsTrigger>
            <TabsTrigger value="execute" className={TAB_STYLE}>
              <PlayCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mfg_group_execute')}</span>
            </TabsTrigger>
            <TabsTrigger value="engineering" className={TAB_STYLE}>
              <DraftingCompass className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mfg_group_engineering')}</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className={TAB_STYLE}>
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('mfg_group_analysis')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Reja — dashboard · MRP · muddatlar */}
          <TabsContent value="plan" className="mt-6">
            <Tabs {...subTabsProps}>
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
                <TabsTrigger value="dashboard" className={SUB_TAB_STYLE}>
                  <LayoutDashboard className="w-4 h-4" />
                  {t('mfg_sub_dashboard')}
                </TabsTrigger>
                <TabsTrigger value="mrp" className={SUB_TAB_STYLE}>
                  <Zap className="w-4 h-4" />
                  {t('mfg_sub_mrp')}
                </TabsTrigger>
                <TabsTrigger value="schedule" className={SUB_TAB_STYLE}>
                  <CalendarDays className="w-4 h-4" />
                  {t('mfg_sub_schedule')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                <ManufacturingDashboard t={t} language={language} onOpenTab={openTab} />
              </TabsContent>
              <TabsContent value="mrp">
                <MRPPlanning />
              </TabsContent>
              <TabsContent value="schedule">
                <ProductionSchedule />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Bajarish — buyurtmalar · ustaxona */}
          <TabsContent value="execute" className="mt-6">
            <Tabs {...subTabsProps}>
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
                <TabsTrigger value="orders" className={SUB_TAB_STYLE}>
                  <Factory className="w-4 h-4" />
                  {t('mfg_sub_orders')}
                </TabsTrigger>
                <TabsTrigger value="shopfloor" className={SUB_TAB_STYLE}>
                  <Monitor className="w-4 h-4" />
                  {t('shop_floor')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="orders">
                <ProductionOrders />
              </TabsContent>
              <TabsContent value="shopfloor">
                <ShopFloorControl isActive={activeGroup === 'execute' && activeSub === 'shopfloor'} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Muhandislik — texnologiya · marshrutlar · ish markazlari · uskunalar · kategoriyalar */}
          <TabsContent value="engineering" className="mt-6">
            <Tabs {...subTabsProps}>
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4 flex flex-wrap justify-start gap-1 h-auto">
                <TabsTrigger value="bom" className={SUB_TAB_STYLE}>
                  <ClipboardList className="w-4 h-4" />
                  {t('mfg_sub_bom')}
                </TabsTrigger>
                <TabsTrigger value="routing" className={SUB_TAB_STYLE}>
                  <Route className="w-4 h-4" />
                  {t('mfg_sub_routing')}
                </TabsTrigger>
                <TabsTrigger value="workcenters" className={SUB_TAB_STYLE}>
                  <Cog className="w-4 h-4" />
                  {t('mfg_sub_work_centers')}
                </TabsTrigger>
                <TabsTrigger value="equipment" className={SUB_TAB_STYLE}>
                  <Wrench className="w-4 h-4" />
                  {t('mfg_sub_equipment')}
                </TabsTrigger>
                <TabsTrigger value="categories" className={SUB_TAB_STYLE}>
                  <Tag className="w-4 h-4" />
                  {t('mfg_sub_categories')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bom">
                <BOMManagement />
              </TabsContent>
              <TabsContent value="routing">
                <RoutingManagement />
              </TabsContent>
              <TabsContent value="workcenters">
                <WorkCenters />
              </TabsContent>
              <TabsContent value="equipment">
                <EquipmentMaintenance />
              </TabsContent>
              <TabsContent value="categories">
                <ManufacturingCategories />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Tahlil — kalkulyatsiya · hisobot */}
          <TabsContent value="analysis" className="mt-6">
            <Tabs {...subTabsProps}>
              <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
                <TabsTrigger value="costcalc" className={SUB_TAB_STYLE}>
                  <Calculator className="w-4 h-4" />
                  {t('mfg_sub_cost_calc')}
                </TabsTrigger>
                <TabsTrigger value="report" className={SUB_TAB_STYLE}>
                  <BarChart3 className="w-4 h-4" />
                  {t('mfg_sub_report')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="costcalc">
                <CostCalculation />
              </TabsContent>
              <TabsContent value="report">
                <ManufacturingReport />
              </TabsContent>
            </Tabs>
          </TabsContent>

        </Tabs>

      </div>
    </div>
  );
}
