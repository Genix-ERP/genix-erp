import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, TrendingUp, TrendingDown, Package, Download,
  Calendar, Filter, PieChart, BarChart3, FileText, Warehouse,
  AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function InventoryValuation() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    products = [],
    inventory = [],
    warehouses = [],
    categories = [],
    stockMovements = [],
    isLoading
  } = useInventory();

  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [costingMethod, setCostingMethod] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate valuation data
  const valuationData = useMemo(() => {
    let filteredProducts = products.filter(p => p.track_inventory !== false);

    // Apply filters
    if (selectedCategory !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category_id === selectedCategory);
    }
    if (costingMethod !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.costing_method === costingMethod);
    }
    if (searchQuery) {
      filteredProducts = filteredProducts.filter(p =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filteredProducts.map(product => {
      // Get inventory for this product
      let productInventory = inventory.filter(inv => inv.product_id === product.id);

      if (selectedWarehouse !== 'all') {
        productInventory = productInventory.filter(inv => inv.warehouse_id === selectedWarehouse);
      }

      const totalQty = productInventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
      const unitCost = product.cost_price || 0;
      const totalValue = totalQty * unitCost;
      const listPrice = product.list_price || 0;
      const potentialRevenue = totalQty * listPrice;
      const potentialProfit = potentialRevenue - totalValue;
      const margin = listPrice > 0 ? ((listPrice - unitCost) / listPrice) * 100 : 0;

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: categories.find(c => c.id === product.category_id)?.name || t('uncategorized'),
        costingMethod: product.costing_method || 'FIFO',
        quantity: totalQty,
        unitCost,
        totalValue,
        listPrice,
        potentialRevenue,
        potentialProfit,
        margin,
        reorderLevel: product.reorder_level || 0,
        isLowStock: totalQty <= (product.reorder_level || 0),
      };
    });
  }, [products, inventory, categories, selectedWarehouse, selectedCategory, costingMethod, searchQuery]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalValue = valuationData.reduce((sum, item) => sum + item.totalValue, 0);
    const totalQty = valuationData.reduce((sum, item) => sum + item.quantity, 0);
    const totalPotentialRevenue = valuationData.reduce((sum, item) => sum + item.potentialRevenue, 0);
    const totalPotentialProfit = valuationData.reduce((sum, item) => sum + item.potentialProfit, 0);
    const lowStockItems = valuationData.filter(item => item.isLowStock).length;
    const avgMargin = valuationData.length > 0
      ? valuationData.reduce((sum, item) => sum + item.margin, 0) / valuationData.length
      : 0;

    // Category breakdown
    const categoryBreakdown = {};
    valuationData.forEach(item => {
      if (!categoryBreakdown[item.category]) {
        categoryBreakdown[item.category] = { value: 0, qty: 0, items: 0 };
      }
      categoryBreakdown[item.category].value += item.totalValue;
      categoryBreakdown[item.category].qty += item.quantity;
      categoryBreakdown[item.category].items += 1;
    });

    // Costing method breakdown
    const methodBreakdown = {
      FIFO: { value: 0, items: 0 },
      WAC: { value: 0, items: 0 },
      LIFO: { value: 0, items: 0 },
    };
    valuationData.forEach(item => {
      const method = item.costingMethod || 'FIFO';
      if (methodBreakdown[method]) {
        methodBreakdown[method].value += item.totalValue;
        methodBreakdown[method].items += 1;
      }
    });

    return {
      totalValue,
      totalQty,
      totalPotentialRevenue,
      totalPotentialProfit,
      lowStockItems,
      avgMargin,
      categoryBreakdown,
      methodBreakdown,
      itemCount: valuationData.length,
    };
  }, [valuationData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'decimal', minimumFractionDigits: 0 }).format(amount || 0);
  };

  const exportToCSV = () => {
    const headers = ['SKU', 'Product', 'Category', 'Costing Method', 'Quantity', 'Unit Cost', 'Total Value', 'List Price', 'Potential Revenue', 'Margin %'];
    const rows = valuationData.map(item => [
      item.sku || '',
      item.name,
      item.category,
      item.costingMethod,
      item.quantity,
      item.unitCost,
      item.totalValue,
      item.listPrice,
      item.potentialRevenue,
      item.margin.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_valuation_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">{t('total_inventory_value') || 'Total Inventory Value'}</p>
                <p className="text-2xl font-bold text-blue-800">{formatCurrency(summary.totalValue)}</p>
                <p className="text-xs text-blue-600">{summary.itemCount} {t('products') || 'products'}</p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">{t('potential_revenue') || 'Potential Revenue'}</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(summary.totalPotentialRevenue)}</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  {summary.avgMargin.toFixed(1)}% {t('avg_margin') || 'avg margin'}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">{t('potential_profit') || 'Potential Profit'}</p>
                <p className="text-2xl font-bold text-purple-800">{formatCurrency(summary.totalPotentialProfit)}</p>
                <p className="text-xs text-purple-600">{summary.totalQty.toLocaleString()} {t('units_in_stock') || 'units'}</p>
              </div>
              <BarChart3 className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">{t('low_stock_items') || 'Low Stock Items'}</p>
                <p className="text-2xl font-bold text-orange-800">{summary.lowStockItems}</p>
                <p className="text-xs text-orange-600">{t('need_attention') || 'need attention'}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('detailed_report') || 'Detailed Report'}
          </TabsTrigger>
          <TabsTrigger value="category" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            {t('by_category') || 'By Category'}
          </TabsTrigger>
          <TabsTrigger value="costing" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('by_costing_method') || 'By Costing Method'}
          </TabsTrigger>
        </TabsList>

        {/* Detailed Report Tab */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[var(--genix-blue)]" />
                  {t('inventory_valuation') || 'Inventory Valuation'}
                </CardTitle>
                <Button onClick={exportToCSV} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  {t('export_csv') || 'Export CSV'}
                </Button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
                <div className="md:col-span-2 relative">
                  <Input
                    placeholder={t('search_products') || 'Search products...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                </div>
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('all_warehouses') || 'All Warehouses'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_warehouses') || 'All Warehouses'}</SelectItem>
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('all_categories') || 'All Categories'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_categories') || 'All Categories'}</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={costingMethod} onValueChange={setCostingMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('costing_method') || 'Costing Method'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_methods') || 'All Methods'}</SelectItem>
                    <SelectItem value="FIFO">FIFO</SelectItem>
                    <SelectItem value="WAC">WAC</SelectItem>
                    <SelectItem value="LIFO">LIFO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--genix-blue)]" />
                </div>
              ) : valuationData.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">{t('no_products_found') || 'No products found'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('sku') || 'SKU'}</TableHead>
                        <TableHead>{t('product') || 'Product'}</TableHead>
                        <TableHead>{t('category') || 'Category'}</TableHead>
                        <TableHead>{t('method') || 'Method'}</TableHead>
                        <TableHead className="text-right">{t('quantity') || 'Qty'}</TableHead>
                        <TableHead className="text-right">{t('unit_cost') || 'Unit Cost'}</TableHead>
                        <TableHead className="text-right">{t('total_value') || 'Total Value'}</TableHead>
                        <TableHead className="text-right">{t('list_price') || 'List Price'}</TableHead>
                        <TableHead className="text-right">{t('margin') || 'Margin'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {valuationData.map(item => (
                        <TableRow key={item.id} className={item.isLowStock ? 'bg-orange-50' : ''}>
                          <TableCell className="font-mono text-sm">{item.sku || '-'}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              item.costingMethod === 'FIFO' ? 'bg-blue-100 text-blue-800' :
                              item.costingMethod === 'WAC' ? 'bg-green-100 text-green-800' :
                              'bg-purple-100 text-purple-800'
                            }>
                              {item.costingMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.totalValue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.listPrice)}</TableCell>
                          <TableCell className="text-right">
                            <span className={item.margin >= 20 ? 'text-green-600' : item.margin >= 10 ? 'text-orange-600' : 'text-red-600'}>
                              {item.margin.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.isLowStock ? (
                              <Badge className="bg-orange-100 text-orange-800">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {t('low_stock') || 'Low'}
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {t('ok') || 'OK'}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals Row */}
                  <div className="bg-slate-100 p-4 rounded-b-lg flex justify-between items-center">
                    <div className="text-sm text-slate-600">
                      {valuationData.length} {t('products') || 'products'} | {summary.totalQty.toLocaleString()} {t('total_units') || 'total units'}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600">{t('total_inventory_value') || 'Total Inventory Value'}</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.totalValue)} {t('uzs') || "so'm"}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Category Tab */}
        <TabsContent value="category" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[var(--genix-blue)]" />
                {t('valuation_by_category') || 'Valuation by Category'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(summary.categoryBreakdown)
                  .sort(([,a], [,b]) => b.value - a.value)
                  .map(([category, data], index) => {
                    const percentage = summary.totalValue > 0
                      ? (data.value / summary.totalValue * 100)
                      : 0;
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];

                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`} />
                            <span className="font-medium">{category}</span>
                            <Badge variant="outline" className="text-xs">{data.items} {t('items') || 'items'}</Badge>
                          </div>
                          <div className="text-right">
                            <span className="font-bold">{formatCurrency(data.value)} {t('uzs') || "so'm"}</span>
                            <span className="text-slate-500 text-sm ml-2">({percentage.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${colors[index % colors.length]}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                {Object.keys(summary.categoryBreakdown).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    {t('no_category_data') || 'No category data available'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Costing Method Tab */}
        <TabsContent value="costing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--genix-blue)]" />
                {t('valuation_by_costing') || 'Valuation by Costing Method'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(summary.methodBreakdown).map(([method, data]) => {
                  const percentage = summary.totalValue > 0
                    ? (data.value / summary.totalValue * 100)
                    : 0;

                  const methodColors = {
                    FIFO: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', bar: 'bg-blue-500' },
                    WAC: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', bar: 'bg-green-500' },
                    LIFO: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', bar: 'bg-purple-500' },
                  };
                  const colors = methodColors[method] || methodColors.FIFO;

                  return (
                    <Card key={method} className={`${colors.bg} ${colors.border}`}>
                      <CardContent className="p-6">
                        <div className="text-center">
                          <h3 className={`text-2xl font-bold ${colors.text}`}>{method}</h3>
                          <p className={`text-sm ${colors.text} opacity-70 mt-1`}>
                            {method === 'FIFO' && (t('first_in_first_out') || 'First In, First Out')}
                            {method === 'WAC' && (t('weighted_average') || 'Weighted Average Cost')}
                            {method === 'LIFO' && (t('last_in_first_out') || 'Last In, First Out')}
                          </p>
                          <div className="mt-4">
                            <p className={`text-3xl font-bold ${colors.text}`}>
                              {formatCurrency(data.value)}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              {data.items} {t('products') || 'products'}
                            </p>
                          </div>
                          <div className="mt-4">
                            <div className="w-full bg-white rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${colors.bar}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{percentage.toFixed(1)}% {t('of_total') || 'of total'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-6 bg-slate-100 p-4 rounded-lg">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="text-sm text-slate-600">{t('total_valued_products') || 'Total Valued Products'}</p>
                    <p className="text-xl font-bold">{summary.itemCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">{t('total_quantity') || 'Total Quantity'}</p>
                    <p className="text-xl font-bold">{summary.totalQty.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">{t('total_valuation') || 'Total Valuation'}</p>
                    <p className="text-2xl font-bold text-[var(--genix-blue)]">
                      {formatCurrency(summary.totalValue)} {t('uzs') || "so'm"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
