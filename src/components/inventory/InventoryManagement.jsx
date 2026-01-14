import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, ArrowRightLeft, TrendingUp, TrendingDown,
  Warehouse, RotateCcw, Filter, Calendar, AlertCircle, CheckCircle,
  ArrowUpRight, ArrowDownLeft, History, DollarSign
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";

export default function InventoryManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
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

  // Filter inventory items
  const filteredInventory = inventory.filter(item => {
    const product = products.find(p => p.id === item.product_id);
    const matchesSearch = !searchQuery ||
      product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product?.code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = warehouseFilter === "all" || item.warehouse_id === warehouseFilter;
    return matchesSearch && matchesWarehouse;
  });

  // Filter movements
  const filteredMovements = stockMovements.filter(movement => {
    const product = products.find(p => p.id === movement.product_id);
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
                <p className="text-sm text-slate-500">Total Value</p>
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
                <p className="text-sm text-slate-500">Total Items</p>
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
                <p className="text-sm text-slate-500">Products</p>
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
                <p className="text-sm text-slate-500">Low Stock</p>
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
                    Inventory Management
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetAdjustForm();
                      setShowAdjustModal(true);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Adjust Stock
                  </Button>
                  <Button
                    onClick={() => {
                      resetTransferForm();
                      setShowTransferModal(true);
                    }}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Transfer
                  </Button>
                </div>
              </div>
              <TabsList className="w-fit bg-slate-100/80 p-1">
                <TabsTrigger value="stock" className="data-[state=active]:bg-white">
                  <Package className="w-4 h-4 mr-2" /> Stock Levels
                </TabsTrigger>
                <TabsTrigger value="movements" className="data-[state=active]:bg-white">
                  <History className="w-4 h-4 mr-2" /> Movements
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
                    placeholder="Search products..."
                    className="pl-9 bg-slate-50 border-slate-200 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-50">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
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
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No inventory found</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery ? 'Try adjusting your search' : 'Stock will appear here once products are added'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Product</TableHead>
                        <TableHead className="font-semibold text-slate-700">Warehouse</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Quantity</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Reserved</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Available</TableHead>
                        <TableHead className="font-semibold text-slate-700">Lot #</TableHead>
                        <TableHead className="font-semibold text-slate-700">Status</TableHead>
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
                                <Badge className="bg-red-100 text-red-800 border-red-200">Out of Stock</Badge>
                              ) : isLowStock ? (
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Low Stock</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>
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
                    placeholder="Search movements..."
                    className="pl-9 bg-slate-50 border-slate-200 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                  <SelectTrigger className="w-[160px] bg-slate-50">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="shipment">Shipment</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
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
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No movements found</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery ? 'Try adjusting your search' : 'Stock movements will appear here'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Type</TableHead>
                        <TableHead className="font-semibold text-slate-700">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Date
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">Product</TableHead>
                        <TableHead className="font-semibold text-slate-700">Warehouse</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Quantity</TableHead>
                        <TableHead className="font-semibold text-slate-700">Reference</TableHead>
                        <TableHead className="font-semibold text-slate-700">Notes</TableHead>
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
              Adjust Stock
            </DialogTitle>
            <DialogDescription>
              Make a stock adjustment (positive or negative)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Product *</label>
              <Select
                value={adjustForm.product_id}
                onValueChange={(value) => setAdjustForm({...adjustForm, product_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
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
              <label className="text-sm font-medium text-slate-700 mb-1 block">Warehouse *</label>
              <Select
                value={adjustForm.warehouse_id}
                onValueChange={(value) => setAdjustForm({...adjustForm, warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
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
                  Current stock: {getAvailableStock(adjustForm.product_id, adjustForm.warehouse_id)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Quantity * <span className="text-slate-400">(use negative for decrease)</span>
              </label>
              <Input
                type="number"
                placeholder="e.g., 10 or -5"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({...adjustForm, quantity: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Reason *</label>
              <Textarea
                placeholder="Reason for adjustment"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({...adjustForm, reason: e.target.value})}
                rows={2}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Reference</label>
              <Input
                placeholder="Optional reference"
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
                Cancel
              </Button>
              <Button
                onClick={handleAdjust}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !adjustForm.product_id || !adjustForm.warehouse_id || !adjustForm.quantity || !adjustForm.reason}
              >
                {isSaving ? 'Saving...' : 'Adjust Stock'}
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
              Transfer Stock
            </DialogTitle>
            <DialogDescription>
              Transfer inventory between warehouses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Product *</label>
              <Select
                value={transferForm.product_id}
                onValueChange={(value) => setTransferForm({...transferForm, product_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
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
              <label className="text-sm font-medium text-slate-700 mb-1 block">From Warehouse *</label>
              <Select
                value={transferForm.from_warehouse_id}
                onValueChange={(value) => setTransferForm({...transferForm, from_warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
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
                  Available: {getAvailableStock(transferForm.product_id, transferForm.from_warehouse_id)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">To Warehouse *</label>
              <Select
                value={transferForm.to_warehouse_id}
                onValueChange={(value) => setTransferForm({...transferForm, to_warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
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
              <label className="text-sm font-medium text-slate-700 mb-1 block">Quantity *</label>
              <Input
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={transferForm.quantity}
                onChange={(e) => setTransferForm({...transferForm, quantity: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Notes</label>
              <Textarea
                placeholder="Optional notes"
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
                Cancel
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
                {isSaving ? 'Transferring...' : 'Transfer Stock'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
