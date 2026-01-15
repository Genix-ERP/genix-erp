import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
  Bell,
  Package,
  Warehouse,
  Clock,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Filter
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";

export default function ReorderRules() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    products = [],
    warehouses = [],
    reorderRules = [],
    createReorderRule,
    updateReorderRule,
    deleteReorderRule,
    checkReorderNeeded,
    inventory = [],
    isLoading
  } = useInventory();

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedTab, setSelectedTab] = useState("rules");

  const [formData, setFormData] = useState({
    product_id: "",
    warehouse_id: "",
    min_qty: 10,
    max_qty: 100,
    reorder_qty: 50,
    trigger_type: "min_qty",
    lead_time_days: 7,
    is_active: true,
    auto_create_po: false,
    notes: ""
  });

  // Get products needing reorder
  const reorderNeeded = useMemo(() => {
    return checkReorderNeeded ? checkReorderNeeded() : [];
  }, [checkReorderNeeded]);

  // Filter rules
  const filteredRules = useMemo(() => {
    let filtered = reorderRules;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(rule => {
        const product = products.find(p => p.id === rule.product_id);
        return product?.name.toLowerCase().includes(query) ||
               product?.code?.toLowerCase().includes(query);
      });
    }

    if (activeFilter !== "all") {
      filtered = filtered.filter(rule =>
        activeFilter === "active" ? rule.is_active : !rule.is_active
      );
    }

    return filtered;
  }, [reorderRules, searchQuery, activeFilter, products]);

  // Trigger types
  const triggerTypes = [
    { value: 'min_qty', label: t('min_quantity') || 'Minimum Quantity' },
    { value: 'forecast', label: t('forecast_based') || 'Forecast Based' },
    { value: 'schedule', label: t('scheduled') || 'Scheduled' }
  ];

  const resetForm = () => {
    setFormData({
      product_id: "",
      warehouse_id: "",
      min_qty: 10,
      max_qty: 100,
      reorder_qty: 50,
      trigger_type: "min_qty",
      lead_time_days: 7,
      is_active: true,
      auto_create_po: false,
      notes: ""
    });
    setEditingRule(null);
  };

  const handleOpenForm = (rule = null) => {
    if (rule) {
      setFormData({ ...rule });
      setEditingRule(rule);
    } else {
      resetForm();
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.product_id) {
      alert(t('select_product') || 'Please select a product');
      return;
    }

    if (editingRule) {
      await updateReorderRule(editingRule.id, formData);
    } else {
      await createReorderRule(formData);
    }
    setShowForm(false);
    resetForm();
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirm_delete') || 'Are you sure you want to delete this rule?')) {
      await deleteReorderRule(id);
    }
  };

  const handleToggleActive = async (rule) => {
    await updateReorderRule(rule.id, { is_active: !rule.is_active });
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown';
  };

  const getWarehouseName = (warehouseId) => {
    if (!warehouseId) return t('all_warehouses') || 'All Warehouses';
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || 'Unknown';
  };

  const getCurrentStock = (productId, warehouseId) => {
    const invItems = inventory.filter(i =>
      i.product_id === productId &&
      (!warehouseId || i.warehouse_id === warehouseId)
    );
    return invItems.reduce((sum, i) => sum + i.quantity, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t('reorder_rules') || 'Reorder Rules'}
          </h2>
          <p className="text-sm text-slate-500">
            {t('reorder_rules_description') || 'Configure automatic reorder points and purchase suggestions'}
          </p>
        </div>
        <Button
          onClick={() => handleOpenForm()}
          className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('add_rule') || 'Add Rule'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_rules') || 'Total Rules'}</p>
                <p className="text-2xl font-bold text-slate-900">{reorderRules.length}</p>
              </div>
              <Bell className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('active_rules') || 'Active Rules'}</p>
                <p className="text-2xl font-bold text-green-600">
                  {reorderRules.filter(r => r.is_active).length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('need_reorder') || 'Need Reorder'}</p>
                <p className="text-2xl font-bold text-red-600">{reorderNeeded.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('products_covered') || 'Products Covered'}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {new Set(reorderRules.map(r => r.product_id)).size}
                </p>
              </div>
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="bg-white/80 p-1 rounded-lg border border-slate-200/60">
          <TabsTrigger value="rules" className="data-[state=active]:bg-blue-100">
            <Bell className="w-4 h-4 mr-2" />
            {t('rules') || 'Rules'}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-red-100">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {t('reorder_alerts') || 'Reorder Alerts'}
            {reorderNeeded.length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">{reorderNeeded.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t('search_rules') || 'Search by product...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                <SelectItem value="active">{t('active') || 'Active'}</SelectItem>
                <SelectItem value="inactive">{t('inactive') || 'Inactive'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rules Table */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('product') || 'Product'}</TableHead>
                    <TableHead>{t('warehouse') || 'Warehouse'}</TableHead>
                    <TableHead className="text-right">{t('min_qty') || 'Min Qty'}</TableHead>
                    <TableHead className="text-right">{t('max_qty') || 'Max Qty'}</TableHead>
                    <TableHead className="text-right">{t('reorder_qty') || 'Reorder Qty'}</TableHead>
                    <TableHead className="text-right">{t('current_stock') || 'Current Stock'}</TableHead>
                    <TableHead>{t('lead_time') || 'Lead Time'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        {t('no_reorder_rules') || 'No reorder rules found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRules.map((rule) => {
                      const currentStock = getCurrentStock(rule.product_id, rule.warehouse_id);
                      const isLow = currentStock <= rule.min_qty;
                      return (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">
                            {getProductName(rule.product_id)}
                          </TableCell>
                          <TableCell>{getWarehouseName(rule.warehouse_id)}</TableCell>
                          <TableCell className="text-right">{rule.min_qty}</TableCell>
                          <TableCell className="text-right">{rule.max_qty}</TableCell>
                          <TableCell className="text-right">{rule.reorder_qty}</TableCell>
                          <TableCell className="text-right">
                            <span className={isLow ? 'text-red-600 font-bold' : ''}>
                              {currentStock}
                            </span>
                          </TableCell>
                          <TableCell>{rule.lead_time_days} {t('days') || 'days'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={() => handleToggleActive(rule)}
                              />
                              {rule.is_active ? (
                                <Badge className="bg-green-100 text-green-800">
                                  {t('active') || 'Active'}
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-800">
                                  {t('inactive') || 'Inactive'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenForm(rule)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(rule.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="mt-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t('products_need_reorder') || 'Products Needing Reorder'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reorderNeeded.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-900">
                    {t('all_stock_ok') || 'All stock levels are OK'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t('no_reorder_needed') || 'No products need to be reordered at this time'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('product') || 'Product'}</TableHead>
                      <TableHead className="text-right">{t('current_stock') || 'Current Stock'}</TableHead>
                      <TableHead className="text-right">{t('min_qty') || 'Min Qty'}</TableHead>
                      <TableHead className="text-right">{t('shortage') || 'Shortage'}</TableHead>
                      <TableHead className="text-right">{t('suggested_order') || 'Suggested Order'}</TableHead>
                      <TableHead>{t('lead_time') || 'Lead Time'}</TableHead>
                      <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reorderNeeded.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.product?.name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-bold">
                          {item.current_stock}
                        </TableCell>
                        <TableCell className="text-right">{item.min_qty}</TableCell>
                        <TableCell className="text-right text-red-600">
                          -{item.shortage}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-bold">
                          {item.suggested_order}
                        </TableCell>
                        <TableCell>{item.lead_time_days} {t('days') || 'days'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {t('create_po') || 'Create PO'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? (t('edit_rule') || 'Edit Rule') : (t('add_rule') || 'Add Rule')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product */}
            <div className="space-y-2">
              <Label>{t('product') || 'Product'} *</Label>
              <Select
                value={formData.product_id}
                onValueChange={(value) => setFormData({ ...formData, product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product') || 'Select product'} />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.is_stockable !== false).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse */}
            <div className="space-y-2">
              <Label>{t('warehouse') || 'Warehouse'}</Label>
              <Select
                value={formData.warehouse_id || "all"}
                onValueChange={(value) => setFormData({ ...formData, warehouse_id: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_warehouses') || 'All Warehouses'}</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('min_qty') || 'Min Qty'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.min_qty}
                  onChange={(e) => setFormData({ ...formData, min_qty: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('max_qty') || 'Max Qty'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.max_qty}
                  onChange={(e) => setFormData({ ...formData, max_qty: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('reorder_qty') || 'Reorder Qty'}</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.reorder_qty}
                  onChange={(e) => setFormData({ ...formData, reorder_qty: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            {/* Trigger Type & Lead Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('trigger_type') || 'Trigger Type'}</Label>
                <Select
                  value={formData.trigger_type}
                  onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('lead_time_days') || 'Lead Time (days)'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>{t('auto_create_po') || 'Auto Create Purchase Order'}</Label>
                <p className="text-xs text-slate-500">
                  {t('auto_create_po_description') || 'Automatically create PO when stock is low'}
                </p>
              </div>
              <Switch
                checked={formData.auto_create_po}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_create_po: checked })}
              />
            </div>

            {/* Active */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>{t('active') || 'Active'}</Label>
                <p className="text-xs text-slate-500">
                  {t('rule_active_description') || 'Enable this rule for reorder alerts'}
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              {editingRule ? (t('save_changes') || 'Save Changes') : (t('create_rule') || 'Create Rule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
