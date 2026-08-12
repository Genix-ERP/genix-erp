import { lazy, Suspense, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  Tag,
  FileQuestion,
  History,
  Award,
  ListChecks,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// Each tab is its own chunk (was one eager 275kB page bundle); Radix
// unmounts inactive TabsContent, so lazy() defers everything but the
// surface being looked at.
const ProcurementDashboard = lazy(() => import('@/components/procurement/ProcurementDashboard'));
const PurchaseOrders = lazy(() => import('@/components/procurement/PurchaseOrders'));
const Suppliers = lazy(() => import('@/components/procurement/Suppliers'));
const VendorPricelist = lazy(() => import('@/components/procurement/VendorPricelist'));
const PriceComparison = lazy(() => import('@/components/procurement/PriceComparison'));
const PriceHistory = lazy(() => import('@/components/procurement/PriceHistory'));
const RFQManagement = lazy(() => import('@/components/procurement/RFQManagement'));

function TabLoading() {
  return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );
}

// Xarid — 4 tabs (docs/xarid-audit.md §10). The old page had 5 top tabs
// plus an orphan requisitions TabsContent with no trigger; "Tovar
// qabulxonasi" split the ordering flow across two destinations and
// "Narxlash" hid the real price-list feature under Yetkazib beruvchilar.
// Now: receiving lives inside Buyurtmalar, all price surfaces under Narxlar.
const LEGACY_TAB_MAP = {
  'purchase-orders': 'orders',
  'goods-receipt': 'orders',
  requisitions: 'orders',
  pricing: 'prices',
  rfq: 'prices',
  'price-comparison': 'prices',
  'price-history': 'prices',
};

const TAB_STYLE =
  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ' +
  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] ' +
  'data-[state=active]:text-white data-[state=active]:shadow-md ' +
  'data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100';

const PRICE_SUB_STYLE =
  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ' +
  'data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600';

export default function Procurement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { refreshData } = useProcurement();

  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rawTab = searchParams.get('tab') || 'dashboard';
  const activeTab = LEGACY_TAB_MAP[rawTab] || rawTab;
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  // Old bookmarked URLs land on the sub-surface that now hosts that flow.
  const initialOrdersSubtab =
    rawTab === 'goods-receipt' ? 'receipts'
    : rawTab === 'requisitions' ? 'requisitions'
    : 'orders';
  const initialPriceSub = useMemo(() => {
    if (rawTab === 'rfq') return 'rfq';
    if (rawTab === 'price-history') return 'history';
    if (rawTab === 'price-comparison') return 'comparison';
    return 'pricelist';
  }, [rawTab]);

  const TABS = [
    { value: 'dashboard', icon: LayoutDashboard, label: t('dashboard') || 'Asosiy panel' },
    { value: 'orders', icon: ShoppingCart, label: t('xarid_tab_orders') || 'Buyurtmalar' },
    { value: 'suppliers', icon: Building2, label: t('suppliers') || 'Yetkazib beruvchilar' },
    { value: 'prices', icon: Tag, label: t('xarid_tab_prices') || 'Narxlar' },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white p-1.5 rounded-xl border border-slate-200 flex flex-wrap justify-start gap-1 h-auto">
            {TABS.map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value} className={TAB_STYLE}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <Suspense fallback={<TabLoading />}>
              <ProcurementDashboard t={t} language={language} onOpenTab={setActiveTab} />
            </Suspense>
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <Suspense fallback={<TabLoading />}>
              <PurchaseOrders initialSubtab={initialOrdersSubtab} />
            </Suspense>
          </TabsContent>

          <TabsContent value="suppliers" className="mt-6">
            <Suspense fallback={<TabLoading />}>
              <Suppliers />
            </Suspense>
          </TabsContent>

          {/* Narxlar — pricelists · comparison · history · RFQ in one place */}
          <TabsContent value="prices" className="mt-6">
            <Tabs defaultValue={initialPriceSub} className="w-full">
              <TabsList className="bg-slate-100 p-1 rounded-lg inline-flex gap-1 h-auto mb-4 flex-wrap">
                <TabsTrigger value="pricelist" className={PRICE_SUB_STYLE}>
                  <ListChecks className="w-4 h-4" />
                  {t('vendor_pricelists') || "Narx ro'yxatlari"}
                </TabsTrigger>
                <TabsTrigger value="comparison" className={PRICE_SUB_STYLE}>
                  <Award className="w-4 h-4" />
                  {t('price_comparison') || 'Narxlarni solishtirish'}
                </TabsTrigger>
                <TabsTrigger value="history" className={PRICE_SUB_STYLE}>
                  <History className="w-4 h-4" />
                  {t('price_history') || 'Narx tarixi'}
                </TabsTrigger>
                <TabsTrigger value="rfq" className={PRICE_SUB_STYLE}>
                  <FileQuestion className="w-4 h-4" />
                  {t('rfq') || 'Narx so‘rovi'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pricelist" className="mt-0">
                <Suspense fallback={<TabLoading />}>
                  <VendorPricelist />
                </Suspense>
              </TabsContent>
              <TabsContent value="comparison" className="mt-0">
                <Suspense fallback={<TabLoading />}>
                  <PriceComparison />
                </Suspense>
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <Suspense fallback={<TabLoading />}>
                  <PriceHistory />
                </Suspense>
              </TabsContent>
              <TabsContent value="rfq" className="mt-0">
                <Suspense fallback={<TabLoading />}>
                  <RFQManagement />
                </Suspense>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
