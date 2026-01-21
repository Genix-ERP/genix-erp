import React, { useState, useEffect, useCallback } from "react";
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
  BarChart3,
  Calculator,
  Clock,
  Target,
  Zap,
  Warehouse,
  ArrowRightLeft,
  LayoutDashboard,
  Box,
  ShoppingCart,
  ClipboardList,
  DollarSign,
  Bell,
  Trash2,
  Settings2,
  MapPin
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import InventoryForm from "@/components/inventory/InventoryForm";
import InventoryInsights from "@/components/inventory/InventoryInsights";
import COGSCalculator from "@/components/inventory/COGSCalculator";
import StockMovementTracker from "@/components/inventory/StockMovementTracker";
import CompliancePanel from "@/components/inventory/CompliancePanel";
import ReorderOptimizer from "@/components/inventory/ReorderOptimizer";
import Products from "@/components/inventory/Products";
import Warehouses from "@/components/inventory/Warehouses";
import InventoryManagement from "@/components/inventory/InventoryManagement";
import StockCounting from "@/components/inventory/StockCounting";
import StockTransfers from "@/components/inventory/StockTransfers";
// BOM moved to Manufacturing module - it's a manufacturing concept, not inventory
import InventoryValuation from "@/components/inventory/InventoryValuation";
import ReorderRules from "@/components/inventory/ReorderRules";
import ScrapManagement from "@/components/inventory/ScrapManagement";
import OperationTypes from "@/components/inventory/OperationTypes";
import WarehouseLocations from "@/components/inventory/WarehouseLocations";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { analyzeInventory } from "@/api/services/aiAnalytics";

export default function Inventory() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
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
  const [insights, setInsights] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Get summary from context
  const summary = getInventorySummary();

  // Generate AI-powered insights based on current data
  const generateInsights = useCallback(() => {
    const analysis = analyzeInventory(items, stockMovements, language);

    // Convert AI analytics insights to the expected format
    const aiInsights = analysis.insights.map(insight => ({
      title: insight.title,
      description: insight.description,
      recommendation: insight.items ? `${t('items')}: ${insight.items.slice(0, 3).join(', ')}${insight.items.length > 3 ? '...' : ''}` : t('review_and_take_action'),
      financial_impact: insight.metric || t('see_details'),
      priority: insight.priority,
      action_required: insight.type === 'warning' || insight.type === 'negative' ? t('immediate_action_required') : t('monitor_regularly')
    }));

    // Add recommendations as insights
    const recInsights = analysis.recommendations.map(rec => ({
      title: rec.action,
      description: rec.description,
      recommendation: rec.action,
      financial_impact: `${t('impact')}: ${rec.impact}`,
      priority: rec.impact === 'high' ? 'high' : 'medium',
      action_required: rec.action
    }));

    setInsights([...aiInsights, ...recInsights].slice(0, 6));
  }, [items, stockMovements, language, t]);

  // Generate static compliance check
  const checkCompliance = useCallback(() => {
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
      ]
    });
  }, [items, t]);

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
    if (items.length > 0) {
      generateInsights();
      checkCompliance();
    }
  }, [items, generateInsights, checkCompliance]);

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
    const totalValue = items.reduce((sum, item) => sum + (item.current_stock * (item.unit_cost || item.cost_price || 0)), 0);
    const lowStockItems = items.filter(item => item.current_stock <= (item.reorder_level || item.min_stock_level || 10));
    const deadStockItems = items.filter(item => item.status === 'dead_stock');
    const expiringItems = items.filter(item =>
      item.expiration_date && new Date(item.expiration_date) < new Date(Date.now() + 30*24*60*60*1000)
    );

    return {
      totalValue,
      lowStockCount: lowStockItems.length,
      deadStockCount: deadStockItems.length,
      expiringCount: expiringItems.length,
      totalItems: items.reduce((sum, item) => sum + item.current_stock, 0),
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
              value="stock"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Box className="w-4 h-4" />
              <span className="hidden sm:inline">{t('stock_management')}</span>
              <span className="sm:hidden">{t('stock')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="transfers"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('transfers') || "Ko'chirishlar"}</span>
              <span className="sm:hidden">{t('transfers') || "Ko'chirish"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="cogs"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">{t('cogs')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="reorder"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reorder')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="analytics"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('analytics')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="counting"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">{t('stocktake')}</span>
              <span className="sm:hidden">{t('stocktake')}</span>
            </TabsTrigger>

            <TabsTrigger
              value="valuation"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">{t('valuation') || 'Valuation'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="reorder-rules"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">{t('reorder_rules') || 'Reorder Rules'}</span>
              <span className="sm:hidden">{t('rules') || 'Rules'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="scrap"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('scrap') || 'Scrap'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('total_value')}</p>
                      <p className="text-lg font-bold text-slate-900">${metrics.totalValue.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('low_stock')}</p>
                      <p className="text-lg font-bold text-orange-600">{metrics.lowStockCount}</p>
                    </div>
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('products')}</p>
                      <p className="text-lg font-bold text-blue-600">{products?.length || 0}</p>
                    </div>
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('warehouses')}</p>
                      <p className="text-lg font-bold text-purple-600">{warehouses?.length || 0}</p>
                    </div>
                    <Warehouse className="w-6 h-6 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Compliance Panel */}
            {compliance && <CompliancePanel compliance={compliance} />}

            {/* AI Insights */}
            {insights && <InventoryInsights insights={insights} />}
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

          {/* Stock Management Tab */}
          <TabsContent value="stock" className="mt-6">
            <InventoryManagement />
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers" className="mt-6">
            <StockTransfers />
          </TabsContent>

          {/* COGS Tab */}
          <TabsContent value="cogs" className="mt-6">
            <COGSCalculator items={items} movements={stockMovements} />
          </TabsContent>

          {/* Reorder Tab */}
          <TabsContent value="reorder" className="mt-6">
            <ReorderOptimizer items={items} movements={stockMovements} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>{t('stock_movements')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <StockMovementTracker movements={stockMovements} items={items} />
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>{t('abc_analysis')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {items.filter(i => i.abc_classification === 'A').length}
                        </div>
                        <div className="text-sm text-slate-600">{t('a_items')}</div>
                        <div className="text-xs text-slate-500">{t('high')}</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {items.filter(i => i.abc_classification === 'B').length}
                        </div>
                        <div className="text-sm text-slate-600">{t('b_items')}</div>
                        <div className="text-xs text-slate-500">{t('medium')}</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-slate-600">
                          {items.filter(i => i.abc_classification === 'C' || !i.abc_classification).length}
                        </div>
                        <div className="text-sm text-slate-600">{t('c_items')}</div>
                        <div className="text-xs text-slate-500">{t('low')}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Stock Counting Tab */}
          <TabsContent value="counting" className="mt-6">
            <StockCounting />
          </TabsContent>

          {/* Inventory Valuation Tab */}
          <TabsContent value="valuation" className="mt-6">
            <InventoryValuation />
          </TabsContent>

          {/* Reorder Rules Tab */}
          <TabsContent value="reorder-rules" className="mt-6">
            <ReorderRules />
          </TabsContent>

          {/* Scrap Management Tab */}
          <TabsContent value="scrap" className="mt-6">
            <ScrapManagement />
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
