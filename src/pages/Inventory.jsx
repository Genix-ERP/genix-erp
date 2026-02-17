import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  TrendingUp,
  Filter,
  Download,
  Clock,
  Zap,
  Warehouse,
  LayoutDashboard,
  Box,
  ShoppingCart,
  ClipboardList,
  DollarSign,
  Settings2,
  MapPin,
  CalendarClock,
  BarChart3
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import InventoryForm from "@/components/inventory/InventoryForm";
import CompliancePanel from "@/components/inventory/CompliancePanel";
// COGSCalculator is now integrated into Products component
import Products from "@/components/inventory/Products";
import Warehouses from "@/components/inventory/Warehouses";
// StockCounting and ScrapManagement are now integrated into Warehouses component
// InventoryManagement (Stock Management) is now integrated into Warehouses component
// BOM moved to Manufacturing module - it's a manufacturing concept, not inventory
import InventoryValuation from "@/components/inventory/InventoryValuation";
import Planning from "@/components/inventory/Planning";
// ReorderRules and Replenishment are now integrated into Planning component
import OperationTypes from "@/components/inventory/OperationTypes";
import WarehouseLocations from "@/components/inventory/WarehouseLocations";
import StockReport from "@/components/inventory/StockReport";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const {
    items,
    products,
    warehouses,
    stockMovements,
    isLoading,
    createItem,
    updateItem,
    getInventorySummary
  } = useInventory();

  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [costingFilter, setCostingFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  // Cleanup on unmount to prevent blocking navigation
  useEffect(() => {
    return () => {
      setShowForm(false);
      setEditingItem(null);
    };
  }, []);

  // Get summary from context
  const summary = getInventorySummary();

  // Generate static compliance check
  // Note: t is not in deps to avoid infinite loop (it's a new function each render)
  const checkCompliance = useCallback(() => {
    // For empty inventory, show default compliant status with helpful info
    if (items.length === 0) {
      setCompliance({
        compliance_status: "compliant",
        standard_detected: "IFRS",
        issues: [],
        recommendations: [
          t('regular_inventory_audits_recommended') || 'Regular inventory audits recommended',
          t('maintain_proper_documentation') || 'Maintain proper documentation for all stock movements',
          t('review_costing_methods_annually') || 'Review costing methods annually'
        ],
        best_practices: [
          t('fifo_provides_better_matching') || 'FIFO provides better matching in inflationary periods',
          t('maintains_clear_audit_trail') || 'Maintains clear audit trail for all movements',
          t('supports_real_time_cogs') || 'Supports real-time COGS calculation',
          t('enables_accurate_valuation') || 'Enables accurate inventory valuation'
        ]
      });
      return;
    }

    const fifoCount = items.filter(i => i.costing_method === 'fifo').length;
    const wacCount = items.filter(i => i.costing_method === 'weighted_average').length;
    const lifoCount = items.filter(i => i.costing_method === 'lifo').length;

    const hasLifo = lifoCount > 0;

    setCompliance({
      compliance_status: hasLifo ? "partially_compliant" : "compliant",
      standard_detected: hasLifo ? "US_GAAP" : "IFRS",
      issues: hasLifo ? [
        {
          issue: t('lifo_costing_detected'),
          severity: "warning",
          solution: t('lifo_switch_recommendation')
        }
      ] : [],
      recommendations: [
        t('regular_inventory_audits_recommended'),
        t('maintain_proper_documentation'),
        t('review_costing_methods_annually')
      ],
      best_practices: [
        t('fifo_provides_better_matching') || 'FIFO provides better matching in inflationary periods',
        t('maintains_clear_audit_trail') || 'Maintains clear audit trail for all movements',
        t('supports_real_time_cogs') || 'Supports real-time COGS calculation',
        t('enables_accurate_valuation') || 'Enables accurate inventory valuation'
      ]
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, language]);

  const filterItems = useCallback(() => {
    let filtered = items;

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    if (costingFilter !== "all") {
      filtered = filtered.filter(item => item.costing_method === costingFilter);
    }

    setFilteredItems(filtered);
  }, [items, searchQuery, categoryFilter, statusFilter, costingFilter]);

  useEffect(() => {
    // Always generate compliance - even for empty inventory
    // This ensures new tenants see helpful information
    checkCompliance();
  }, [items, checkCompliance]);

  useEffect(() => {
    filterItems();
  }, [filterItems]);

  const handleSave = (itemData) => {
    if (editingItem) {
      updateItem(editingItem.id, itemData);
    } else {
      createItem(itemData);
    }
    setShowForm(false);
    setEditingItem(null);
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      low_stock: "bg-yellow-100 text-yellow-800",
      backordered: "bg-red-100 text-red-800",
      discontinued: "bg-gray-100 text-gray-800",
      overstock: "bg-blue-100 text-blue-800",
      dead_stock: "bg-purple-100 text-purple-800"
    };
    return colors[status] || colors.active;
  };

  const getCostingMethodColor = (method) => {
    const colors = {
      fifo: "bg-green-100 text-green-800",
      weighted_average: "bg-blue-100 text-blue-800",
      lifo: "bg-orange-100 text-orange-800"
    };
    return colors[method] || colors.fifo;
  };

  const calculateMetrics = () => {
    const totalValue = items.reduce((sum, item) => {
      const stock = parseFloat(item.current_stock) || parseFloat(item.quantity_on_hand) || parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.cost_price) || parseFloat(item.unit_cost) || parseFloat(item.price) || 0;
      return sum + (stock * cost);
    }, 0);
    const lowStockItems = items.filter(item => {
      const stock = parseFloat(item.current_stock) || parseFloat(item.quantity_on_hand) || parseFloat(item.quantity) || 0;
      const reorderLevel = parseFloat(item.reorder_level) || parseFloat(item.min_stock_level) || 10;
      return stock > 0 && stock <= reorderLevel;
    });
    const deadStockItems = items.filter(item => item.status === 'dead_stock');
    const expiringItems = items.filter(item =>
      item.expiration_date && new Date(item.expiration_date) < new Date(Date.now() + 30*24*60*60*1000)
    );

    return {
      totalValue: isNaN(totalValue) ? 0 : totalValue,
      lowStockCount: lowStockItems.length,
      deadStockCount: deadStockItems.length,
      expiringCount: expiringItems.length,
      totalItems: items.reduce((sum, item) => sum + (parseFloat(item.current_stock) || parseFloat(item.quantity_on_hand) || parseFloat(item.quantity) || 0), 0),
      totalSKUs: items.length,
      fifoItems: items.filter(item => item.costing_method === 'fifo').length,
      wacItems: items.filter(item => item.costing_method === 'weighted_average').length,
      lifoItems: items.filter(item => item.costing_method === 'lifo').length
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6 md:space-y-8">

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger
              value="dashboard"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="products"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t('products')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="warehouses"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Warehouse className="w-4 h-4" />
              <span className="hidden sm:inline">{t('warehouses')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="operations"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('operation_types') || "Operatsiya turlari"}</span>
              <span className="sm:hidden">{t('operations') || "Operatsiyalar"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="locations"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">{t('locations') || "Lokatsiyalar"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="valuation"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">{t('valuation') || 'Valuation'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="planning"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <CalendarClock className="w-4 h-4" />
              <span className="hidden sm:inline">{t('planning') || 'Planning'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="reports"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reports') || 'Reports'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">{t('total_value')}</p>
                      <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatCurrency(metrics.totalValue)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">{t('low_stock')}</p>
                      <p className="text-2xl md:text-3xl font-bold text-orange-600">{metrics.lowStockCount}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">{t('products')}</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-600">{products?.length || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">{t('warehouses')}</p>
                      <p className="text-2xl md:text-3xl font-bold text-purple-600">{warehouses?.length || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Warehouse className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Compliance Panel */}
            {compliance && <CompliancePanel compliance={compliance} />}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-6">
            <Products />
          </TabsContent>

          {/* Warehouses Tab */}
          <TabsContent value="warehouses" className="mt-6">
            <Warehouses />
          </TabsContent>

          {/* Operation Types Tab */}
          <TabsContent value="operations" className="mt-6">
            <OperationTypes />
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="mt-6">
            <WarehouseLocations />
          </TabsContent>

          {/* Inventory Valuation Tab */}
          <TabsContent value="valuation" className="mt-6">
            <InventoryValuation />
          </TabsContent>

          {/* Planning Tab (Reorder Rules + Replenishment) */}
          <TabsContent value="planning" className="mt-6">
            <Planning />
          </TabsContent>

          {/* Reports Tab (Stock Movements, Changes, Adjustment P&L) */}
          <TabsContent value="reports" className="mt-6">
            <StockReport />
          </TabsContent>
        </Tabs>

        {/* Form Modal */}
        {showForm && (
          <InventoryForm
            item={editingItem}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingItem(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
