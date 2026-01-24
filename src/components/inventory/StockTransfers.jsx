import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, ArrowRightLeft, Warehouse, Filter, Calendar,
  CheckCircle, Clock, ArrowRight, Package, Building2, HelpCircle,
  Truck, MapPin, FileText, AlertCircle
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
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";

// Field Help Component
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

export default function StockTransfers() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const {
    products,
    warehouses,
    inventory,
    stockMovements,
    transferInventory,
    isLoading
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceWarehouseFilter, setSourceWarehouseFilter] = useState("all");
  const [destWarehouseFilter, setDestWarehouseFilter] = useState("all");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [transferForm, setTransferForm] = useState({
    product_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    quantity: '',
    notes: '',
    reference: ''
  });

  // Get transfer movements only
  const transferMovements = useMemo(() => {
    return stockMovements
      .filter(m => m.movement_type === 'transfer')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [stockMovements]);

  // Filter transfers based on search and warehouse filters
  const filteredTransfers = useMemo(() => {
    return transferMovements.filter(transfer => {
      const product = products.find(p => p.id === transfer.product_id);
      const fromWarehouse = warehouses.find(w => w.id === transfer.warehouse_id);
      const toWarehouse = warehouses.find(w => w.id === transfer.to_warehouse_id);

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchProduct = product?.name?.toLowerCase().includes(query) ||
                            product?.code?.toLowerCase().includes(query);
        const matchWarehouse = fromWarehouse?.name?.toLowerCase().includes(query) ||
                              toWarehouse?.name?.toLowerCase().includes(query);
        const matchRef = transfer.reference?.toLowerCase().includes(query);
        if (!matchProduct && !matchWarehouse && !matchRef) return false;
      }

      // Source warehouse filter
      if (sourceWarehouseFilter !== "all" && transfer.warehouse_id !== sourceWarehouseFilter) {
        return false;
      }

      // Destination warehouse filter
      if (destWarehouseFilter !== "all" && transfer.to_warehouse_id !== destWarehouseFilter) {
        return false;
      }

      return true;
    });
  }, [transferMovements, searchQuery, sourceWarehouseFilter, destWarehouseFilter, products, warehouses]);

  // Get available stock for a product in a warehouse
  const getAvailableStock = (productId, warehouseId) => {
    const stockItem = inventory.find(
      i => i.product_id === productId && i.warehouse_id === warehouseId
    );
    return stockItem?.quantity || 0;
  };

  // Calculate transfer statistics
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransfers = transferMovements.filter(t => {
      const transferDate = new Date(t.created_at);
      transferDate.setHours(0, 0, 0, 0);
      return transferDate.getTime() === today.getTime();
    });

    const thisMonth = transferMovements.filter(t => {
      const transferDate = new Date(t.created_at);
      return transferDate.getMonth() === today.getMonth() &&
             transferDate.getFullYear() === today.getFullYear();
    });

    return {
      total: transferMovements.length,
      today: todayTransfers.length,
      thisMonth: thisMonth.length,
      totalQuantity: transferMovements.reduce((sum, t) => sum + (t.quantity || 0), 0)
    };
  }, [transferMovements]);

  const handleTransfer = async () => {
    if (!transferForm.product_id || !transferForm.from_warehouse_id ||
        !transferForm.to_warehouse_id || !transferForm.quantity) {
      return;
    }

    setIsSaving(true);
    try {
      await transferInventory({
        product_id: transferForm.product_id,
        from_warehouse_id: transferForm.from_warehouse_id,
        to_warehouse_id: transferForm.to_warehouse_id,
        quantity: parseInt(transferForm.quantity),
        notes: transferForm.notes,
        reference: transferForm.reference || `TRF-${Date.now()}`
      });

      setShowTransferModal(false);
      setTransferForm({
        product_id: '',
        from_warehouse_id: '',
        to_warehouse_id: '',
        quantity: '',
        notes: '',
        reference: ''
      });
    } catch (error) {
      console.error('Transfer error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSourceWarehouseFilter("all");
    setDestWarehouseFilter("all");
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? `${product.name} (${product.code})` : productId;
  };

  const getWarehouseName = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || warehouseId;
  };

  const getWarehouseType = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.is_default ? 'main' : 'branch';
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)] flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-[var(--genix-purple)]" />
            {t('stock_transfers') || "Mahsulot ko'chirishlari"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('stock_transfers_desc') || "Omborlar o'rtasida mahsulotlarni ko'chirish va tarixini ko'rish"}
          </p>
        </div>
        {canCreate(MODULES.INVENTORY) && (
          <Button
            onClick={() => setShowTransferModal(true)}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('new_transfer') || "Yangi ko'chirish"}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_transfers') || "Jami ko'chirishlar"}</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('today') || "Bugun"}</p>
                <p className="text-2xl font-bold text-blue-600">{stats.today}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('this_month') || "Bu oy"}</p>
                <p className="text-2xl font-bold text-green-600">{stats.thisMonth}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_quantity') || "Jami miqdor"}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalQuantity.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search_transfers') || "Ko'chirishlarni qidirish..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sourceWarehouseFilter} onValueChange={setSourceWarehouseFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('source_warehouse') || "Manba ombori"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_warehouses') || "Barcha omborlar"}</SelectItem>
                {warehouses.filter(w => w.is_active).map(warehouse => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={destWarehouseFilter} onValueChange={setDestWarehouseFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('destination_warehouse') || "Manzil ombori"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_warehouses') || "Barcha omborlar"}</SelectItem>
                {warehouses.filter(w => w.is_active).map(warehouse => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || sourceWarehouseFilter !== "all" || destWarehouseFilter !== "all") && (
              <Button variant="outline" onClick={resetFilters}>
                <Filter className="w-4 h-4 mr-2" />
                {t('reset') || "Tozalash"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--genix-purple)]" />
            {t('transfer_history') || "Ko'chirish tarixi"}
            <Badge variant="secondary" className="ml-2">{filteredTransfers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <ArrowRightLeft className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">
                {t('no_transfers_yet') || "Hali ko'chirishlar yo'q"}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {t('no_transfers_desc') || "Omborlar o'rtasida mahsulot ko'chirish uchun yuqoridagi tugmani bosing"}
              </p>
              {canCreate(MODULES.INVENTORY) && (
                <Button
                  onClick={() => setShowTransferModal(true)}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_transfer') || "Yangi ko'chirish"}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reference') || "Havola"}</TableHead>
                    <TableHead>{t('product')}</TableHead>
                    <TableHead>{t('from_warehouse') || "Manba"}</TableHead>
                    <TableHead className="text-center">
                      <ArrowRight className="w-4 h-4 inline" />
                    </TableHead>
                    <TableHead>{t('to_warehouse') || "Manzil"}</TableHead>
                    <TableHead className="text-right">{t('quantity')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('notes') || "Izoh"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer) => {
                    const fromType = getWarehouseType(transfer.warehouse_id);
                    const toType = getWarehouseType(transfer.to_warehouse_id);

                    return (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {transfer.reference || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{getProductName(transfer.product_id)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {fromType === 'main' ? (
                              <Building2 className="w-4 h-4 text-blue-500" />
                            ) : (
                              <MapPin className="w-4 h-4 text-green-500" />
                            )}
                            <span>{getWarehouseName(transfer.warehouse_id)}</span>
                            {fromType === 'main' && (
                              <Badge variant="secondary" className="text-[10px] px-1">
                                {t('main') || "Bosh"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <ArrowRight className="w-4 h-4 text-slate-400 inline" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {toType === 'main' ? (
                              <Building2 className="w-4 h-4 text-blue-500" />
                            ) : (
                              <MapPin className="w-4 h-4 text-green-500" />
                            )}
                            <span>{getWarehouseName(transfer.to_warehouse_id)}</span>
                            {toType === 'main' && (
                              <Badge variant="secondary" className="text-[10px] px-1">
                                {t('main') || "Bosh"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-purple-600">
                            {transfer.quantity?.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">
                            {format(new Date(transfer.created_at), 'dd.MM.yyyy HH:mm')}
                          </span>
                        </TableCell>
                        <TableCell>
                          {transfer.notes ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <FileText className="w-4 h-4 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{transfer.notes}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-slate-300">-</span>
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
      </Card>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[var(--genix-purple)]" />
              {t('new_transfer') || "Yangi ko'chirish"}
            </DialogTitle>
            <DialogDescription>
              {t('transfer_inventory_between_warehouses') || "Omborlar o'rtasida mahsulot ko'chirish"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Product Selection */}
            <div>
              <LabelWithHelp
                label={t('product')}
                required
                helpText={t('help_transfer_product') || "Ko'chirmoqchi bo'lgan mahsulotni tanlang"}
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

            {/* From Warehouse */}
            <div>
              <LabelWithHelp
                label={t('from_warehouse') || "Manba ombori"}
                required
                helpText={t('help_from_warehouse') || "Mahsulot olinadigan ombor"}
              />
              <Select
                value={transferForm.from_warehouse_id}
                onValueChange={(value) => setTransferForm({...transferForm, from_warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_source') || "Manba tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.is_active).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      <div className="flex items-center gap-2">
                        {warehouse.is_default ? (
                          <Building2 className="w-4 h-4 text-blue-500" />
                        ) : (
                          <MapPin className="w-4 h-4 text-green-500" />
                        )}
                        {warehouse.name}
                        {warehouse.is_default && (
                          <Badge variant="secondary" className="text-[10px] px-1 ml-1">
                            {t('main') || "Bosh"}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferForm.product_id && transferForm.from_warehouse_id && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {t('available') || "Mavjud"}: {getAvailableStock(transferForm.product_id, transferForm.from_warehouse_id)}
                </p>
              )}
            </div>

            {/* To Warehouse */}
            <div>
              <LabelWithHelp
                label={t('to_warehouse') || "Manzil ombori"}
                required
                helpText={t('help_to_warehouse') || "Mahsulot yuboriladigan ombor"}
              />
              <Select
                value={transferForm.to_warehouse_id}
                onValueChange={(value) => setTransferForm({...transferForm, to_warehouse_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_destination') || "Manzil tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter(w => w.is_active && w.id !== transferForm.from_warehouse_id)
                    .map(warehouse => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        <div className="flex items-center gap-2">
                          {warehouse.is_default ? (
                            <Building2 className="w-4 h-4 text-blue-500" />
                          ) : (
                            <MapPin className="w-4 h-4 text-green-500" />
                          )}
                          {warehouse.name}
                          {warehouse.is_default && (
                            <Badge variant="secondary" className="text-[10px] px-1 ml-1">
                              {t('main') || "Bosh"}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div>
              <LabelWithHelp
                label={t('quantity')}
                required
                helpText={t('help_transfer_quantity') || "Ko'chirish miqdori"}
              />
              <Input
                type="number"
                min="1"
                max={transferForm.from_warehouse_id ? getAvailableStock(transferForm.product_id, transferForm.from_warehouse_id) : undefined}
                placeholder={t('enter_quantity') || "Miqdorni kiriting"}
                value={transferForm.quantity}
                onChange={(e) => setTransferForm({...transferForm, quantity: e.target.value})}
                required
              />
              {transferForm.product_id && transferForm.from_warehouse_id && parseInt(transferForm.quantity) > getAvailableStock(transferForm.product_id, transferForm.from_warehouse_id) && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {t('quantity_exceeds_available') || "Miqdor mavjud zaxiradan oshib ketdi"}
                </p>
              )}
            </div>

            {/* Reference */}
            <div>
              <LabelWithHelp
                label={t('reference') || "Havola raqami"}
                helpText={t('help_transfer_reference') || "Avtomatik yaratiladigan havola raqami (ixtiyoriy)"}
              />
              <Input
                placeholder={`TRF-${Date.now()}`}
                value={transferForm.reference}
                onChange={(e) => setTransferForm({...transferForm, reference: e.target.value})}
              />
            </div>

            {/* Notes */}
            <div>
              <LabelWithHelp
                label={t('notes') || "Izohlar"}
                helpText={t('help_transfer_notes') || "Ko'chirish haqida qo'shimcha izohlar"}
              />
              <Textarea
                placeholder={t('optional_notes') || "Izoh qo'shing (ixtiyoriy)"}
                value={transferForm.notes}
                onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})}
                rows={2}
              />
            </div>

            {/* Actions */}
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
                  parseInt(transferForm.quantity) <= 0 ||
                  parseInt(transferForm.quantity) > getAvailableStock(transferForm.product_id, transferForm.from_warehouse_id)
                }
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {t('transferring') || "Ko'chirilmoqda..."}
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    {t('transfer') || "Ko'chirish"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
