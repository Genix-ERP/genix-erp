import { useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import ProcurementDashboard from '@/components/procurement/ProcurementDashboard';
import PurchaseOrders from '@/components/procurement/PurchaseOrders';
import Suppliers from '@/components/procurement/Suppliers';
import VendorPricelist from '@/components/procurement/VendorPricelist';
import PriceComparison from '@/components/procurement/PriceComparison';
import PriceHistory from '@/components/procurement/PriceHistory';
import RFQManagement from '@/components/procurement/RFQManagement';

import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

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
            <ProcurementDashboard t={t} language={language} onOpenTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <PurchaseOrders initialSubtab={initialOrdersSubtab} />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-6">
            <Suppliers />
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
                <VendorPricelist />
              </TabsContent>
              <TabsContent value="comparison" className="mt-0">
                <PriceComparison />
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <PriceHistory />
              </TabsContent>
              <TabsContent value="rfq" className="mt-0">
                <RFQManagement />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
