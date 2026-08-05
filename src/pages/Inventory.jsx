import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Package,
  FileText,
  LayoutDashboard,
  CalendarClock,
  BarChart3,
  Settings,
  Inbox,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import InventoryDashboard from "@/components/inventory/InventoryDashboard";
import MaterialRequestsPanel from "@/components/construction/material-requests/MaterialRequestsPanel";
import materialRequestsService from "@/api/services/materialRequests";
import InventoryDocuments from "@/components/inventory/InventoryDocuments";
import InventorySettings from "@/components/inventory/InventorySettings";
import Products from "@/components/inventory/Products";
import Planning from "@/components/inventory/Planning";
import StockReport from "@/components/inventory/StockReport";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

// Ombor — 5 daily tabs + a settings surface (docs/ombor-audit.md §8).
// The old page had 7 visible tabs plus 3 orphan TabsContent blocks with no
// trigger; Omborlar and Baholash were rarely-touched settings promoted to
// tabs, while inventarizatsiya/scrap/transfers were document flows buried
// in different places. Now: daily work in the first three tabs, documents
// unified under Hujjatlar, configuration under Sozlamalar.
const LEGACY_TAB_MAP = {
  warehouses: "settings",
  valuation: "settings",
  operations: "settings",
  locations: "settings",
  transfers: "documents",
  "stock-ops": "documents",
};

const TAB_STYLE =
  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 " +
  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] " +
  "data-[state=active]:text-white data-[state=active]:shadow-md " +
  "data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100";

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrencyCompact } = useCurrencyFormatter();

  const rawTab = searchParams.get("tab") || "dashboard";
  const activeTab = LEGACY_TAB_MAP[rawTab] || rawTab;
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  // Old bookmarked URLs (?tab=transfers, ?tab=warehouses…) land on the
  // section that now hosts that flow.
  const initialDocSection = useMemo(() => {
    if (rawTab === "transfers") return "transfers";
    if (rawTab === "stock-ops") return "operations";
    return "operations";
  }, [rawTab]);

  const initialSettingsSection = useMemo(() => {
    if (rawTab === "valuation") return "valuation";
    if (rawTab === "operations") return "operation-types";
    if (rawTab === "locations") return "locations";
    return "warehouses";
  }, [rawTab]);

  // «Kiruvchi zayavkalar» badge — ochiq zayavkalar soni (60s yangilanadi).
  // Ruxsat bo'lmasa (403) badge ko'rinmaydi, tab esa qoladi.
  const [inboxCount, setInboxCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchCount = () =>
      materialRequestsService.stats()
        .then((s) => { if (!cancelled) setInboxCount(s?.inbox_count || 0); })
        .catch(() => {});
    fetchCount();
    const timer = setInterval(fetchCount, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const TABS = [
    { value: "dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { value: "products", icon: Package, label: t("products") },
    { value: "documents", icon: FileText, label: t("inv_tab_documents") },
    { value: "requests", icon: Inbox, label: t("inv_tab_requests") || "Zayavkalar", badge: inboxCount },
    { value: "planning", icon: CalendarClock, label: t("planning") },
    { value: "reports", icon: BarChart3, label: t("reports") },
    { value: "settings", icon: Settings, label: t("inv_tab_settings") },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white p-1.5 rounded-xl border border-slate-200 flex flex-wrap justify-start gap-1 h-auto">
            {TABS.map(({ value, icon: Icon, label, badge }) => (
              <TabsTrigger key={value} value={value} className={TAB_STYLE}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {badge > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <InventoryDashboard
              t={t}
              language={language}
              formatCompact={formatCurrencyCompact}
              onOpenTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <Products />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <InventoryDocuments t={t} language={language} initialSection={initialDocSection} />
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <MaterialRequestsPanel mode="warehouse" />
          </TabsContent>

          <TabsContent value="planning" className="mt-6">
            <Planning />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <StockReport />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <InventorySettings t={t} initialSection={initialSettingsSection} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
