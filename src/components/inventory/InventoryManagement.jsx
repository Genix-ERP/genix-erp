import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, ArrowRightLeft, TrendingUp, TrendingDown,
  Warehouse, RotateCcw, Filter, Calendar, AlertCircle, CheckCircle,
  ArrowUpRight, ArrowDownLeft, History, DollarSign, HelpCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";

// Field Help Component - Odoo-style tooltip for field explanations
const FieldHelp = ({ text }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs bg-slate-800 text-white p-2 rounded-lg shadow-lg">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// Label with help tooltip
const LabelWithHelp = ({ label, helpText, required }) => (
  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center">
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

export default function InventoryManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const {
    products,
    warehouses,
    inventory,
    stockMovements,
    adjustInventory,
    transferInventory,
    getInventorySummary,
    isLoading
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [adjustForm, setAdjustForm] = useState({
    product_id: '',
    warehouse_id: '',
    quantity: '',
    reason: '',
    reference: ''
  });

  const [transferForm, setTransferForm] = useState({
    product_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    quantity: '',
    notes: '',
    reference: ''
  });

  // Get summary stats with safety defaults
  const rawSummary = getInventorySummary();
  const summary = {
    totalValue: rawSummary?.totalValue || 0,
    totalItems: rawSummary?.totalItems || 0,
    totalProducts: rawSummary?.totalProducts || 0,
    lowStockCount: rawSummary?.lowStockCount || 0
  };

  // Filter inventory items - only show items with valid products and warehouses
  const filteredInventory = inventory.filter(item => {
    const product = products.find(p => p.id === item.product_id);
    const warehouse = warehouses.find(w => w.id === item.warehouse_id);
    // Skip inventory items without matching product or warehouse (orphaned mock data)
    if (!product || !warehouse) return false;
    const matchesSearch = !searchQuery ||
      product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product?.code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = warehouseFilter === "all" || item.warehouse_id === warehouseFilter;
    return matchesSearch && matchesWarehouse;
  });

  // Filter movements - only show movements with valid products and warehouses
  const filteredMovements = stockMovements.filter(movement => {
    const product = products.find(p => p.id === movement.product_id);
    const warehouse = warehouses.find(w => w.id === movement.warehouse_id);
    // Skip movements without matching product or warehouse (orphaned mock data)
    if (!product || !warehouse) return false;
    const matchesSearch = !searchQuery ||
      product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = movementTypeFilter === "all" || movement.movement_type === movementTypeFilter;
    return matchesSearch && matchesType;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const resetAdjustForm = () => {
    setAdjustForm({
      product_id: '',
      warehouse_id: '',
      quantity: '',
      reason: '',
      reference: ''
    });
  };

  const resetTransferForm = () => {
    setTransferForm({
      product_id: '',
      from_warehouse_id: '',
      to_warehouse_id: '',
      quantity: '',
      notes: '',
      reference: ''
    });
  };

  const handleAdjust = () => {
    setIsSaving(true);
    try {
      adjustInventory({
        product_id: adjustForm.product_id,
        warehouse_id: adjustForm.warehouse_id,
        quantity: parseInt(adjustForm.quantity),
        reason: adjustForm.reason,
        reference: adjustForm.reference || `ADJ-${Date.now()}`
      });
      resetAdjustForm();
      setShowAdjustModal(false);
    } catch (error) {
      console.error('Error adjusting inventory:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransfer = () => {
    setIsSaving(true);
    try {
      transferInventory({
        product_id: transferForm.product_id,
        from_warehouse_id: transferForm.from_warehouse_id,
        to_warehouse_id: transferForm.to_warehouse_id,
        quantity: parseInt(transferForm.quantity),
        notes: transferForm.notes,
        reference: transferForm.reference || `TRF-${Date.now()}`
      });
      resetTransferForm();
      setShowTransferModal(false);
    } catch (error) {
      console.error('Error transferring inventory:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  const getProductCode = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.code || '';
  };

  const getWarehouseName = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || 'Unknown Warehouse';
  };

  const getMovementTypeColor = (type) => {
    const colors = {
      receipt: 'bg-green-100 text-green-800 border-green-200',
      shipment: 'bg-red-100 text-red-800 border-red-200',
      adjustment: 'bg-blue-100 text-blue-800 border-blue-200',
      transfer: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getMovementTypeIcon = (type, quantity) => {
    if (type === 'transfer') return ArrowRightLeft;
    if (type === 'adjustment') return RotateCcw;
    return quantity > 0 ? ArrowDownLeft : ArrowUpRight;
  };

  const getAvailableStock = (productId, warehouseId) => {
    const item = inventory.find(i => i.product_id === productId && i.warehouse_id === warehouseId);
    return item?.quantity || 0;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_value')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${summary.totalValue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_items')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {summary.totalItems.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('products')}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {summary.totalProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('low_stock')}</p>
                <p className="text-2xl font-bold text-red-600">
                  {summary.lowStockCount}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <Tabs defaultValue="stock" className="w-full">
          <CardHeader className="border-b border-slate-100 pb-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-[var(--genix-blue)]" />
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    {t('inventory_management')}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  {canUpdate(MODULES.INVENTORY) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetAdjustForm();
                        setShowAdjustModal(true);
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" /> {t('adjust_stock')}
                    </Button>
                  )}
                  {canCreate(MODULES.INVENTORY) && (
                    <Button
                      onClick={() => {
                        resetTransferForm();
                        setShowTransferModal(true);
                      }}
                      className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90"
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" /> {t('transfer')}
                    </Button>
                  )}
                </div>
              </div>
              <TabsList className="w-fit bg-slate-100/80 p-1">
                <TabsTrigger value="stock" className="data-[state=active]:bg-white">
                  <Package className="w-4 h-4 mr-2" /> {t('stock_levels')}
                </TabsTrigger>
                <TabsTrigger value="movements" className="data-[state=active]:bg-white">
                  <History className="w-4 h-4 mr-2" /> {t('movements')}
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          {/* Stock Levels Tab */}
          <TabsContent value="stock" className="mt-0">
            <div className="p-4 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_products')}
                    className="pl-9 bg-slate-50 border-slate-200 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-50">
                    <SelectValue placeholder={t('warehouse')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_warehouses')}</SelectItem>
                    {warehouses.map(warehouse => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('no_inventory_found')}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery ? t('try_adjusting_search') : t('stock_will_appear_here')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">{t('product')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('warehouse')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('quantity')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('reserved')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('available')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('lot_number')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map(item => {
                        const product = products.find(p => p.id === item.product_id);
                        const warehouse = warehouses.find(w => w.id === item.warehouse_id);
                        const quantity = item.quantity || 0;
                        const isLowStock = product?.min_stock_level && quantity <= product.min_stock_level;
                        const isOutOfStock = quantity === 0;

                        return (
                          <TableRow key={item.id} className="hover:bg-blue-50/50">
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{getProductName(item.product_id)}</p>
                                <p className="text-xs text-slate-500">{getProductCode(item.product_id)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Warehouse className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-700">{warehouse?.name || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-slate-900 tabular-nums">
                              {(item.quantity || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-slate-600 tabular-nums">
                              {(item.reserved_quantity || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600 tabular-nums">
                              {(item.available_quantity || item.quantity || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-slate-600">
                              {item.lot_number || '-'}
                            </TableCell>
                            <TableCell>
                              {isOutOfStock ? (
                                <Badge className="bg-red-100 text-red-800 border-red-200">{t('out_of_stock')}</Badge>
                              ) : isLowStock ? (
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{t('low_stock')}</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-green-200">{t('in_stock')}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </TabsContent>

          {/* Movements Tab */}
          <TabsContent value="movements" className="mt-0">
            <div className="p-4 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search')}
                    className="pl-9 bg-slate-50 border-slate-200 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                  <SelectTrigger className="w-[160px] bg-slate-50">
                    <SelectValue placeholder={t('type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_types')}</SelectItem>
                    <SelectItem value="receipt">{t('receipt')}</SelectItem>
                    <SelectItem value="shipment">{t('shipment')}</SelectItem>
                    <SelectItem value="adjustment">{t('adjustment')}</SelectItem>
                    <SelectItem value="transfer">{t('transfer')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('no_movements_found')}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery ? t('try_adjusting_search') : t('movements_will_appear_here')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">{t('type')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> {t('date')}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('product')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('warehouse')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('quantity')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('reference')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('notes')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.map(movement => {
                        const movementQty = movement.quantity || 0;
                        const TypeIcon = getMovementTypeIcon(movement.movement_type, movementQty);
                        const isPositive = movementQty > 0;

                        return (
                          <TableRow key={movement.id} className="hover:bg-blue-50/50">
                            <TableCell>
                              <Badge className={getMovementTypeColor(movement.movement_type)}>
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {movement.movement_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-700">
                              {movement.created_at
                                ? format(new Date(movement.created_at), 'MMM dd, yyyy HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{getProductName(movement.product_id)}</p>
                                <p className="text-xs text-slate-500">{getProductCode(movement.product_id)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-slate-700">
                                <Warehouse className="w-4 h-4 text-slate-400" />
                                {getWarehouseName(movement.warehouse_id)}
                                {movement.to_warehouse_id && (
                                  <>
                                    <ArrowRightLeft className="w-3 h-3 mx-1 text-slate-400" />
                                    {getWarehouseName(movement.to_warehouse_id)}
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={`text-right font-semibold tabular-nums ${
                              isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isPositive ? '+' : ''}{(movement.quantity || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-slate-600">
                              {movement.reference || '-'}
                            </TableCell>
                            <TableCell className="text-slate-500 max-w-[200px] truncate">
                              {movement.notes || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Adjust Stock Modal */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('adjust_stock')}
            </DialogTitle>
            <DialogDescription>
              {t('make_stock_adjustment')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <LabelWithHelp
                label={t('product')}
                required
                helpText={t('help_adjust_product') || "Zaxirasini tuzatmoqchi bo'lgan mahsulotni tanlang. Faqat zaxira qilinadigan mahsulotlar ko'rsatiladi."}
              />
              <Select
                value={adjustForm.product_id}
                onValueChange={(value) => setAdjustForm({...adjustForm, product_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product')} />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.is_stockable).map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <LabelWithHelp
                label={t('warehouse')}
                required
                helpText={t('help_adjust_warehouse') || "Zaxira tuzatiladigan omborni tanlang. Faqat faol omborlar ko'rsatiladi."}
              />
              <Select
                value={adjustForm.warehouse_id}
                onValueChange={(value) => setAdjustForm({...adjustForm, warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_warehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.is_active).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {adjustForm.product_id && adjustForm.warehouse_id && (
                <p className="text-xs text-slate-500 mt-1">
                  {t('stock')}: {getAvailableStock(adjustForm.product_id, adjustForm.warehouse_id)}
                </p>
              )}
            </div>

            <div>
              <LabelWithHelp
                label={`${t('quantity')} (${t('use_negative_for_decrease')})`}
                required
                helpText={t('help_adjust_quantity') || "Tuzatish miqdori. Ijobiy son zaxirani oshiradi, manfiy son kamaytiradi. Masalan: +10 qo'shadi, -5 ayiradi."}
              />
              <Input
                type="number"
                placeholder={t('enter_quantity')}
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({...adjustForm, quantity: e.target.value})}
                required
              />
            </div>

            <div>
              <LabelWithHelp
                label={t('reason')}
                required
                helpText={t('help_adjust_reason') || "Tuzatish sababi. Bu ma'lumot audit izlari va hisobotlar uchun saqlanadi."}
              />
              <Textarea
                placeholder={t('reason_for_adjustment')}
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({...adjustForm, reason: e.target.value})}
                rows={2}
                required
              />
            </div>

            <div>
              <LabelWithHelp
                label={t('reference')}
                helpText={t('help_adjust_reference') || "Ixtiyoriy mos yozuv raqami. Tashqi hujjatlar yoki tizimlar bilan bog'lash uchun."}
              />
              <Input
                placeholder={t('optional_reference')}
                value={adjustForm.reference}
                onChange={(e) => setAdjustForm({...adjustForm, reference: e.target.value})}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAdjustModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleAdjust}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !adjustForm.product_id || !adjustForm.warehouse_id || !adjustForm.quantity || !adjustForm.reason}
              >
                {isSaving ? t('saving') : t('adjust_stock')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Stock Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[var(--genix-purple)]" />
              {t('transfer_stock')}
            </DialogTitle>
            <DialogDescription>
              {t('transfer_inventory_between_warehouses')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <LabelWithHelp
                label={t('product')}
                required
                helpText={t('help_transfer_product') || "Ko'chirmoqchi bo'lgan mahsulotni tanlang. Faqat zaxira qilinadigan mahsulotlar ko'rsatiladi."}
              />
              <Select
                value={transferForm.product_id}
                onValueChange={(value) => setTransferForm({...transferForm, product_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product')} />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.is_stockable).map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <LabelWithHelp
                label={t('from_warehouse')}
                required
                helpText={t('help_from_warehouse') || "Mahsulot olinadigan manba ombori. Mavjud zaxira miqdori ko'rsatiladi."}
              />
              <Select
                value={transferForm.from_warehouse_id}
                onValueChange={(value) => setTransferForm({...transferForm, from_warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_source')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.is_active).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferForm.product_id && transferForm.from_warehouse_id && (
                <p className="text-xs text-slate-500 mt-1">
                  {t('available')}: {getAvailableStock(transferForm.product_id, transferForm.from_warehouse_id)}
                </p>
              )}
            </div>

            <div>
              <LabelWithHelp
                label={t('to_warehouse')}
                required
                helpText={t('help_to_warehouse') || "Mahsulot yuboriladigan manzil ombori. Manba omboridan farqli bo'lishi kerak."}
              />
              <Select
                value={transferForm.to_warehouse_id}
                onValueChange={(value) => setTransferForm({...transferForm, to_warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_destination')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter(w => w.is_active && w.id !== transferForm.from_warehouse_id)
                    .map(warehouse => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <LabelWithHelp
                label={t('quantity')}
                required
                helpText={t('help_transfer_quantity') || "Ko'chirish miqdori. Manba omboridagi mavjud miqdordan oshmasligi kerak."}
              />
              <Input
                type="number"
                min="1"
                placeholder={t('enter_quantity')}
                value={transferForm.quantity}
                onChange={(e) => setTransferForm({...transferForm, quantity: e.target.value})}
                required
              />
            </div>

            <div>
              <LabelWithHelp
                label={t('notes')}
                helpText={t('help_transfer_notes') || "Ko'chirish haqida qo'shimcha izohlar. Tarix va hisobotlarda ko'rsatiladi."}
              />
              <Textarea
                placeholder={t('optional_notes')}
                value={transferForm.notes}
                onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowTransferModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleTransfer}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={
                  isSaving ||
                  !transferForm.product_id ||
                  !transferForm.from_warehouse_id ||
                  !transferForm.to_warehouse_id ||
                  !transferForm.quantity ||
                  transferForm.from_warehouse_id === transferForm.to_warehouse_id
                }
              >
                {isSaving ? t('transferring') : t('transfer_stock')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
