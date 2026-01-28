import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, TrendingUp, TrendingDown, ArrowRightLeft, AlertTriangle, Plus, Search, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";

// SAP-style document types - using translation keys
const documentTypes = [
  { value: 'PO', labelKey: 'purchase_order' },
  { value: 'SO', labelKey: 'sales_order' },
  { value: 'GRN', labelKey: 'goods_receipt_note' },
  { value: 'GDN', labelKey: 'goods_delivery_note' },
  { value: 'TR', labelKey: 'transfer_order' },
  { value: 'ADJ', labelKey: 'adjustment' },
  { value: 'RET', labelKey: 'return' },
  { value: 'PROD', labelKey: 'production_order' },
];

// SAP quality statuses - using translation keys
const qualityStatuses = [
  { value: 'released', labelKey: 'released', color: 'bg-green-100 text-green-800' },
  { value: 'blocked', labelKey: 'blocked', color: 'bg-red-100 text-red-800' },
  { value: 'in_qc', labelKey: 'in_qc', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'quarantine', labelKey: 'quarantine', color: 'bg-orange-100 text-orange-800' },
];

export default function StockMovementTracker({ movements, items }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { adjustInventory, warehouses, products, lots = [] } = useInventory();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMovements, setFilteredMovements] = useState(movements || []);

  // New Movement Modal state
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cleanup on unmount to prevent blocking navigation
  React.useEffect(() => {
    return () => {
      setShowNewMovementModal(false);
    };
  }, []);

  const [newMovement, setNewMovement] = useState({
    product_id: '',
    warehouse_id: '',
    location_id: '', // SAP: bin-level tracking
    movement_type: 'inbound',
    quantity: '',
    unit_cost: '',
    reference: '',
    // SAP-style document references
    document_type: '', // PO, SO, GRN, GDN, Transfer
    document_number: '',
    // Batch/Lot tracking
    lot_id: '',
    // Quality status (SAP)
    quality_status: 'released', // released, blocked, in_qc, quarantine
    supplier_or_customer: '',
    notes: ''
  });

  React.useEffect(() => {
    if (searchQuery) {
      const filtered = (movements || []).filter(movement => {
        const product = products.find(p => p.id === movement.product_id);
        return movement.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          movement.supplier_or_customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setFilteredMovements(filtered);
    } else {
      setFilteredMovements(movements || []);
    }
  }, [searchQuery, movements, products]);

  const getMovementIcon = (type) => {
    const icons = {
      inbound: TrendingUp,
      outbound: TrendingDown,
      adjustment: AlertTriangle,
      transfer: ArrowRightLeft,
      expiry_write_off: AlertTriangle
    };
    return icons[type] || Activity;
  };

  const getMovementColor = (type) => {
    const colors = {
      inbound: "bg-green-100 text-green-800",
      outbound: "bg-red-100 text-red-800",
      adjustment: "bg-yellow-100 text-yellow-800",
      transfer: "bg-blue-100 text-blue-800",
      expiry_write_off: "bg-purple-100 text-purple-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getItemName = (movement) => {
    // Backend may provide product_name directly
    if (movement.product_name) return movement.product_name;
    const product = products.find(p => p.id === movement.product_id);
    return product ? product.name : t('unknown');
  };

  const getItemSku = (movement) => {
    // Backend may provide product_code directly
    if (movement.product_code) return movement.product_code;
    const product = products.find(p => p.id === movement.product_id);
    return product ? (product.sku || product.code) : 'N/A';
  };

  // Helper to get movement type (backend uses transaction_type)
  const getMovementType = (movement) => {
    const type = movement.transaction_type || movement.movement_type;
    // Map backend types to frontend display types
    if (type === 'receipt') return 'inbound';
    if (type === 'issue') return 'outbound';
    if (type === 'adjustment') return 'adjustment';
    if (type === 'transfer') return 'transfer';
    return type || 'unknown';
  };

  const calculateTotalValue = (movements) => {
    return movements.reduce((sum, movement) => {
      // Backend uses total_cost, fallback to total_value or calculate from quantity * unit_cost
      const value = movement.total_cost || movement.total_value || (Math.abs(movement.quantity || 0) * (movement.unit_cost || 0));
      return sum + value;
    }, 0);
  };

  const movementStats = React.useMemo(() => {
    const inbound = filteredMovements.filter(m => {
      const type = getMovementType(m);
      return type === 'inbound' || type === 'receipt' || (m.quantity > 0 && type !== 'transfer');
    });
    const outbound = filteredMovements.filter(m => {
      const type = getMovementType(m);
      return type === 'outbound' || type === 'issue' || (m.quantity < 0 && type !== 'transfer');
    });
    const adjustments = filteredMovements.filter(m => getMovementType(m) === 'adjustment');

    return {
      totalMovements: filteredMovements.length,
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      adjustmentCount: adjustments.length,
      inboundValue: calculateTotalValue(inbound),
      outboundValue: calculateTotalValue(outbound),
      netValue: calculateTotalValue(inbound) - calculateTotalValue(outbound)
    };
  }, [filteredMovements]);

  // Get warehouse locations for selected warehouse
  const getWarehouseLocations = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.locations || [];
  };

  // Get lots for selected product
  const getProductLots = (productId) => {
    return lots.filter(l => l.product_id === productId && l.status === 'active');
  };

  // Handler for opening new movement modal
  const handleNewMovementClick = () => {
    setNewMovement({
      product_id: '',
      warehouse_id: warehouses?.[0]?.id || '',
      location_id: '',
      movement_type: 'inbound',
      quantity: '',
      unit_cost: '',
      reference: '',
      document_type: '',
      document_number: '',
      lot_id: '',
      quality_status: 'released',
      supplier_or_customer: '',
      notes: ''
    });
    setShowNewMovementModal(true);
  };

  // Handler for creating new movement
  const handleCreateMovement = async () => {
    if (!newMovement.product_id || !newMovement.warehouse_id || !newMovement.quantity) {
      return;
    }

    setIsSubmitting(true);
    try {
      const quantity = newMovement.movement_type === 'outbound'
        ? -Math.abs(parseFloat(newMovement.quantity))
        : parseFloat(newMovement.quantity);

      await adjustInventory({
        product_id: newMovement.product_id,
        warehouse_id: newMovement.warehouse_id,
        movement_type: newMovement.movement_type,
        quantity: quantity,
        unit_cost: parseFloat(newMovement.unit_cost) || 0,
        reference: newMovement.reference || `${newMovement.movement_type.toUpperCase()}-${Date.now()}`,
        reason: newMovement.notes || newMovement.movement_type || 'Stock adjustment',
        notes: newMovement.notes,
        supplier_or_customer: newMovement.supplier_or_customer
      });

      setShowNewMovementModal(false);
      // Force refresh of movements display
      window.location.reload();
    } catch (error) {
      console.error('Error creating movement:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Movement Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_movements')}</p>
                <p className="text-2xl font-bold text-slate-900">{movementStats.totalMovements}</p>
              </div>
              <Activity className="w-6 h-6 text-[var(--genix-blue)]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('inbound_value')}</p>
                <p className="text-2xl font-bold text-green-600">${movementStats.inboundValue.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('outbound_value')}</p>
                <p className="text-2xl font-bold text-red-600">${movementStats.outboundValue.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('net_movement')}</p>
                <p className={`text-2xl font-bold ${movementStats.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${movementStats.netValue.toLocaleString()}
                </p>
              </div>
              <ArrowRightLeft className={`w-6 h-6 ${movementStats.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Movements Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--genix-blue)]" />
              <CardTitle>{t('stock_movement_history')}</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search_movements')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              {canCreate(MODULES.INVENTORY) && (
                <Button
                  onClick={handleNewMovementClick}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_movement')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date_time')}</TableHead>
                  <TableHead>{t('item')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead>{t('quantity')}</TableHead>
                  <TableHead>{t('unit_cost')}</TableHead>
                  <TableHead>{t('total_value')}</TableHead>
                  <TableHead>{t('reference')}</TableHead>
                  <TableHead>{t('cogs')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length > 0 ? (
                  filteredMovements.map((movement, index) => {
                    const movementType = getMovementType(movement);
                    const MovementIcon = getMovementIcon(movementType);
                    const movementDate = movement.transaction_date || movement.created_at;
                    const unitCost = movement.unit_cost || 0;
                    const totalValue = movement.total_cost || movement.total_value || (Math.abs(movement.quantity || 0) * unitCost);
                    const isPositive = (movement.quantity || 0) > 0;

                    return (
                      <TableRow key={movement.id || index} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div className="text-sm">
                            <div>{movementDate ? format(new Date(movementDate), 'MMM d, yyyy') : 'N/A'}</div>
                            <div className="text-slate-500">{movementDate ? format(new Date(movementDate), 'HH:mm') : ''}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{getItemName(movement)}</p>
                            <p className="text-sm text-slate-500">{getItemSku(movement)}</p>
                            {movement.batch_number && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {t('batch')}: {movement.batch_number}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MovementIcon className="w-4 h-4" />
                            <Badge className={getMovementColor(movementType)}>
                              {(movement.transaction_type || movement.movement_type || 'unknown').replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}{movement.quantity || 0}
                          </span>
                        </TableCell>
                        <TableCell>${unitCost.toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.abs(totalValue).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{movement.reference || 'N/A'}</div>
                            {movement.supplier_or_customer && (
                              <div className="text-slate-500">{movement.supplier_or_customer}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isPositive && (
                            <div>
                              <div className="font-medium">${(movement.cogs_calculated || 0).toFixed(2)}</div>
                              <Badge className="text-xs bg-slate-100 text-slate-800">
                                {movement.costing_method_used?.toUpperCase() || 'FIFO'}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>{t('no_stock_movements_found')}</p>
                      <p className="text-sm">{t('stock_movements_appear_here')}</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Movement Modal */}
      <Dialog open={showNewMovementModal} onOpenChange={setShowNewMovementModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('new_movement')}
            </DialogTitle>
            <DialogDescription>
              {t('add_stock_movement_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* SAP-style Document Reference Section */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                <Activity className="w-3 h-3" /> {t('document_reference') || 'Document Reference'} (SAP)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('document_type') || 'Document Type'}</Label>
                  <Select
                    value={newMovement.document_type}
                    onValueChange={(value) => setNewMovement(prev => ({ ...prev, document_type: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t('select_type') || 'Select type'} />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map(dt => (
                        <SelectItem key={dt.value} value={dt.value}>{t(dt.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('document_number') || 'Document Number'}</Label>
                  <Input
                    className="h-9"
                    value={newMovement.document_number}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, document_number: e.target.value }))}
                    placeholder="e.g., PO-2025-001"
                  />
                </div>
              </div>
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <Label>{t('select_product')} *</Label>
              <Select
                value={newMovement.product_id}
                onValueChange={(value) => {
                  const product = products?.find(p => p.id === value);
                  setNewMovement(prev => ({
                    ...prev,
                    product_id: value,
                    unit_cost: product?.cost_price?.toString() || '',
                    lot_id: '' // Reset lot when product changes
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product')} />
                </SelectTrigger>
                <SelectContent>
                  {(products || items || []).map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku || product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse and Location Selection (SAP bin-level) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('warehouse')} *</Label>
                <Select
                  value={newMovement.warehouse_id}
                  onValueChange={(value) => setNewMovement(prev => ({
                    ...prev,
                    warehouse_id: value,
                    location_id: '' // Reset location when warehouse changes
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_warehouse')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(warehouses || []).map(warehouse => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('location') || 'Location (Bin)'}</Label>
                <Select
                  value={newMovement.location_id || '__none__'}
                  onValueChange={(value) => setNewMovement(prev => ({ ...prev, location_id: value === '__none__' ? '' : value }))}
                  disabled={!newMovement.warehouse_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_location') || 'Select bin'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('no_specific_location') || 'No specific location'}</SelectItem>
                    {getWarehouseLocations(newMovement.warehouse_id).map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lot/Batch Selection (if product has lots) */}
            {newMovement.product_id && getProductLots(newMovement.product_id).length > 0 && (
              <div className="space-y-2">
                <Label>{t('lot_batch') || 'Lot/Batch'}</Label>
                <Select
                  value={newMovement.lot_id || '__none__'}
                  onValueChange={(value) => setNewMovement(prev => ({ ...prev, lot_id: value === '__none__' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_lot') || 'Select lot/batch'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('no_lot') || 'No lot tracking'}</SelectItem>
                    {getProductLots(newMovement.product_id).map(lot => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.lot_number} ({lot.quantity} {t('available') || 'available'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Movement Type */}
            <div className="space-y-2">
              <Label>{t('movement_type')} *</Label>
              <Select
                value={newMovement.movement_type}
                onValueChange={(value) => setNewMovement(prev => ({ ...prev, movement_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      {t('inbound')}
                    </div>
                  </SelectItem>
                  <SelectItem value="outbound">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      {t('outbound')}
                    </div>
                  </SelectItem>
                  <SelectItem value="adjustment">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      {t('adjustment')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quantity, Unit Cost, Quality Status */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t('quantity')} *</Label>
                <Input
                  type="number"
                  min="1"
                  value={newMovement.quantity}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('unit_cost')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newMovement.unit_cost}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, unit_cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('quality_status') || 'Quality Status'}</Label>
                <Select
                  value={newMovement.quality_status}
                  onValueChange={(value) => setNewMovement(prev => ({ ...prev, quality_status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {qualityStatuses.map(qs => (
                      <SelectItem key={qs.value} value={qs.value}>
                        <Badge className={qs.color}>{t(qs.labelKey)}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label>{t('reference')}</Label>
              <Input
                value={newMovement.reference}
                onChange={(e) => setNewMovement(prev => ({ ...prev, reference: e.target.value }))}
                placeholder={t('reference_number_placeholder') || 'Internal reference'}
              />
            </div>

            {/* Supplier/Customer */}
            <div className="space-y-2">
              <Label>{t('supplier_or_customer')}</Label>
              <Input
                value={newMovement.supplier_or_customer}
                onChange={(e) => setNewMovement(prev => ({ ...prev, supplier_or_customer: e.target.value }))}
                placeholder={t('supplier_or_customer_placeholder') || 'Supplier or customer name'}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Input
                value={newMovement.notes}
                onChange={(e) => setNewMovement(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('movement_notes_placeholder') || 'Additional notes'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewMovementModal(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreateMovement}
              disabled={isSubmitting || !newMovement.product_id || !newMovement.warehouse_id || !newMovement.quantity}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {isSubmitting ? t('loading') : t('add_movement')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}