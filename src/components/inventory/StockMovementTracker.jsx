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

export default function StockMovementTracker({ movements, items }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { adjustInventory, warehouses, products } = useInventory();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMovements, setFilteredMovements] = useState(movements || []);

  // New Movement Modal state
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMovement, setNewMovement] = useState({
    product_id: '',
    warehouse_id: '',
    movement_type: 'inbound',
    quantity: '',
    unit_cost: '',
    reference: '',
    supplier_or_customer: '',
    notes: ''
  });

  React.useEffect(() => {
    if (searchQuery) {
      const filtered = (movements || []).filter(movement => 
        movement.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.supplier_or_customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        items.find(item => item.id === movement.inventory_item_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMovements(filtered);
    } else {
      setFilteredMovements(movements || []);
    }
  }, [searchQuery, movements, items]);

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

  const getItemName = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item ? item.name : 'Unknown Item';
  };

  const getItemSku = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item ? item.sku : 'N/A';
  };

  const calculateTotalValue = (movements) => {
    return movements.reduce((sum, movement) => sum + (movement.total_value || 0), 0);
  };

  const movementStats = React.useMemo(() => {
    const inbound = filteredMovements.filter(m => m.movement_type === 'inbound');
    const outbound = filteredMovements.filter(m => m.movement_type === 'outbound');
    const adjustments = filteredMovements.filter(m => m.movement_type === 'adjustment');

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

  // Handler for opening new movement modal
  const handleNewMovementClick = () => {
    setNewMovement({
      product_id: '',
      warehouse_id: warehouses?.[0]?.id || '',
      movement_type: 'inbound',
      quantity: '',
      unit_cost: '',
      reference: '',
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
        quantity: quantity,
        unit_cost: parseFloat(newMovement.unit_cost) || 0,
        reference: newMovement.reference || `${newMovement.movement_type.toUpperCase()}-${Date.now()}`,
        reason: newMovement.notes,
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--genix-blue)]" />
              <CardTitle>{t('stock_movement_history')}</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search_movements')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button
                onClick={handleNewMovementClick}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('new_movement')}
              </Button>
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
                    const MovementIcon = getMovementIcon(movement.movement_type);
                    return (
                      <TableRow key={movement.id || index} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div className="text-sm">
                            <div>{movement.movement_date ? format(new Date(movement.movement_date), 'MMM d, yyyy') : 'N/A'}</div>
                            <div className="text-slate-500">{movement.movement_date ? format(new Date(movement.movement_date), 'HH:mm') : ''}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{getItemName(movement.inventory_item_id)}</p>
                            <p className="text-sm text-slate-500">{getItemSku(movement.inventory_item_id)}</p>
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
                            <Badge className={getMovementColor(movement.movement_type)}>
                              {movement.movement_type?.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${movement.movement_type === 'inbound' ? 'text-green-600' : movement.movement_type === 'outbound' ? 'text-red-600' : 'text-slate-600'}`}>
                            {movement.movement_type === 'inbound' ? '+' : movement.movement_type === 'outbound' ? '-' : ''}
                            {movement.quantity || 0}
                          </span>
                        </TableCell>
                        <TableCell>${(movement.unit_cost || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${movement.movement_type === 'inbound' ? 'text-green-600' : movement.movement_type === 'outbound' ? 'text-red-600' : 'text-slate-600'}`}>
                            ${(movement.total_value || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{movement.reference_number || 'N/A'}</div>
                            {movement.supplier_or_customer && (
                              <div className="text-slate-500">{movement.supplier_or_customer}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {movement.movement_type === 'outbound' && (
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

          <div className="space-y-4 py-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label>{t('select_product')}</Label>
              <Select
                value={newMovement.product_id}
                onValueChange={(value) => {
                  const product = products?.find(p => p.id === value);
                  setNewMovement(prev => ({
                    ...prev,
                    product_id: value,
                    unit_cost: product?.cost_price?.toString() || ''
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

            {/* Warehouse Selection */}
            <div className="space-y-2">
              <Label>{t('warehouse')}</Label>
              <Select
                value={newMovement.warehouse_id}
                onValueChange={(value) => setNewMovement(prev => ({ ...prev, warehouse_id: value }))}
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

            {/* Movement Type */}
            <div className="space-y-2">
              <Label>{t('movement_type')}</Label>
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

            {/* Quantity and Unit Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('quantity')}</Label>
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
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label>{t('reference')}</Label>
              <Input
                value={newMovement.reference}
                onChange={(e) => setNewMovement(prev => ({ ...prev, reference: e.target.value }))}
                placeholder={t('reference_number_placeholder')}
              />
            </div>

            {/* Supplier/Customer */}
            <div className="space-y-2">
              <Label>{t('supplier_or_customer')}</Label>
              <Input
                value={newMovement.supplier_or_customer}
                onChange={(e) => setNewMovement(prev => ({ ...prev, supplier_or_customer: e.target.value }))}
                placeholder={t('supplier_or_customer_placeholder')}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Input
                value={newMovement.notes}
                onChange={(e) => setNewMovement(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('movement_notes_placeholder')}
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