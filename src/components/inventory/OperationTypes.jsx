import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, Pencil, Trash2, Eye, MoreHorizontal,
  CheckCircle, Clock, AlertTriangle, RotateCcw, Barcode,
  PackagePlus, ArrowRightLeft, Truck, Store, Settings2, X
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { inventoryService } from '@/api/services';
import { usePermissions } from "@/hooks/usePermissions";

// Icon mapping for operation types (by type field: receipt, delivery, internal, pos)
const getOperationIcon = (type) => {
  switch (type) {
    case 'receipt':
      return <PackagePlus className="w-5 h-5" />;
    case 'internal':
      return <ArrowRightLeft className="w-5 h-5" />;
    case 'delivery':
      return <Truck className="w-5 h-5" />;
    case 'pos':
      return <Store className="w-5 h-5" />;
    default:
      return <Package className="w-5 h-5" />;
  }
};

// Icon mapping by operation_type (incoming, outgoing, internal)
const getOperationDirectionIcon = (operationType, className = "w-4 h-4") => {
  switch (operationType) {
    case 'incoming':
      return <PackagePlus className={className} />;
    case 'outgoing':
      return <Truck className={className} />;
    case 'internal':
      return <ArrowRightLeft className={className} />;
    default:
      return <Package className={className} />;
  }
};

// Color picker presets
const colorPresets = [
  { color: '#22c55e', name: 'Green' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#f97316', name: 'Orange' },
  { color: '#a855f7', name: 'Purple' },
  { color: '#ef4444', name: 'Red' },
  { color: '#eab308', name: 'Yellow' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#6366f1', name: 'Indigo' },
  { color: '#64748b', name: 'Slate' },
];

export default function OperationTypes() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [operationTypes, setOperationTypes] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cleanup modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowCreateModal(false);
      setShowEditModal(false);
    };
  }, []);

  const [formData, setFormData] = useState({
    warehouse_id: '',
    code: '',
    name: '',
    operation_type: 'internal', // incoming, outgoing, internal
    type: 'custom',
    color: '#6366f1',
    show_operations: true,
    barcode_enabled: true,
    create_backorder: true,
    reservation_method: 'at_confirm',
    sequence: 10
  });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [typesData, warehousesData] = await Promise.all([
          inventoryService.listOperationTypes({ include_inactive: true }),
          inventoryService.listWarehouses()
        ]);
        setOperationTypes(typesData || []);
        setWarehouses(warehousesData || []);
      } catch (err) {
        console.error('Error fetching operation types:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter operation types
  const filteredTypes = operationTypes.filter(ot => {
    const matchesSearch = !searchQuery ||
      ot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ot.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = selectedWarehouse === 'all' || ot.warehouse_id === selectedWarehouse;
    return matchesSearch && matchesWarehouse;
  });

  // Group by warehouse
  const groupedByWarehouse = filteredTypes.reduce((acc, ot) => {
    const whId = ot.warehouse_id;
    if (!acc[whId]) {
      acc[whId] = {
        warehouse: warehouses.find(w => w.id === whId) || { name: ot.warehouse_name || 'Unknown' },
        types: []
      };
    }
    acc[whId].types.push(ot);
    return acc;
  }, {});

  const resetForm = () => {
    setFormData({
      warehouse_id: warehouses[0]?.id || '',
      code: '',
      name: '',
      operation_type: 'internal', // incoming, outgoing, internal
      type: 'custom',
      color: '#6366f1',
      show_operations: true,
      barcode_enabled: true,
      create_backorder: true,
      reservation_method: 'at_confirm',
      sequence: 10
    });
  };

  const handleCreate = async () => {
    if (!formData.warehouse_id || !formData.code || !formData.name) return;

    setIsSaving(true);
    try {
      const newType = await inventoryService.createOperationType(formData);
      setOperationTypes(prev => [...prev, newType]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error('Error creating operation type:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedType) return;

    setIsSaving(true);
    try {
      const updated = await inventoryService.updateOperationType(selectedType.id, {
        name: formData.name,
        color: formData.color,
        show_operations: formData.show_operations,
        barcode_enabled: formData.barcode_enabled,
        create_backorder: formData.create_backorder,
        reservation_method: formData.reservation_method,
        is_active: formData.is_active,
        sequence: formData.sequence
      });
      setOperationTypes(prev => prev.map(ot => ot.id === selectedType.id ? { ...ot, ...updated } : ot));
      setShowEditModal(false);
      setSelectedType(null);
    } catch (err) {
      console.error('Error updating operation type:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (typeId) => {
    try {
      await inventoryService.deleteOperationType(typeId);
      setOperationTypes(prev => prev.filter(ot => ot.id !== typeId));
    } catch (err) {
      console.error('Error deleting operation type:', err);
    }
  };

  const openEditModal = (ot) => {
    setSelectedType(ot);
    setFormData({
      name: ot.name,
      color: ot.color,
      show_operations: ot.show_operations,
      barcode_enabled: ot.barcode_enabled !== false,
      create_backorder: ot.create_backorder !== false,
      reservation_method: ot.reservation_method || 'at_confirm',
      is_active: ot.is_active,
      sequence: ot.sequence || 10
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    if (selectedWarehouse !== 'all') {
      setFormData(prev => ({ ...prev, warehouse_id: selectedWarehouse }));
    } else if (warehouses.length > 0) {
      setFormData(prev => ({ ...prev, warehouse_id: warehouses[0].id }));
    }
    setShowCreateModal(true);
  };

  // Operation Type Card Component
  const OperationTypeCard = ({ opType }) => {
    const totalCount = (opType.count_picking_ready || 0) +
                       (opType.count_picking_waiting || 0) +
                       (opType.count_picking_late || 0);

    return (
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
        style={{ borderTopColor: opType.color, borderTopWidth: '4px' }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: opType.color }}
              >
                {getOperationIcon(opType.type)}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">{opType.name}</h4>
                <p className="text-xs text-slate-500">{opType.code}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUpdate(MODULES.INVENTORY) && (
                  <DropdownMenuItem onClick={() => openEditModal(opType)}>
                    <Settings2 className="w-4 h-4 mr-2" />
                    {t('settings') || 'Settings'}
                  </DropdownMenuItem>
                )}
                {opType.type === 'custom' && canDelete(MODULES.INVENTORY) && (
                  <DropdownMenuItem onClick={() => handleDelete(opType.id)} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('delete') || 'Delete'}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            {!opType.is_active && (
              <Badge variant="outline" className="text-slate-500 border-slate-300">
                {t('inactive') || 'Inactive'}
              </Badge>
            )}
            {opType.barcode_enabled && (
              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                <Barcode className="w-3 h-3 mr-1" />
                {t('barcode') || 'Barcode'}
              </Badge>
            )}
          </div>

          {/* Counters - Odoo style */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors cursor-pointer">
                  <div className="text-lg font-bold text-green-600">{opType.count_picking_ready || 0}</div>
                  <div className="text-[10px] text-green-700 uppercase tracking-wide">{t('ready') || 'Ready'}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('ready_operations') || 'Operations ready to process'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer">
                  <div className="text-lg font-bold text-amber-600">{opType.count_picking_waiting || 0}</div>
                  <div className="text-[10px] text-amber-700 uppercase tracking-wide">{t('waiting') || 'Waiting'}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('waiting_operations') || 'Operations waiting for stock'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors cursor-pointer">
                  <div className="text-lg font-bold text-red-600">{opType.count_picking_late || 0}</div>
                  <div className="text-[10px] text-red-700 uppercase tracking-wide">{t('late') || 'Late'}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('late_operations') || 'Overdue operations'}</TooltipContent>
            </Tooltip>
          </div>

          {/* Open button */}
          <Button
            variant="outline"
            className="w-full mt-3 text-slate-700 hover:bg-slate-50"
            onClick={() => {/* Navigate to operations list */}}
          >
            {t('open') || 'Open'}
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--genix-blue)] mx-auto mb-4" />
          <p className="text-slate-500">{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-transparent bg-clip-text">
            {t('inventory_overview') || "Ombor holati"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('operation_types_desc') || "Ombor operatsiya turlari va ularning holati"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('search') || "Qidirish..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('all_warehouses') || "Barcha omborlar"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_warehouses') || "Barcha omborlar"}</SelectItem>
              {warehouses.map(wh => (
                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate(MODULES.INVENTORY) && (
            <Button onClick={openCreateModal} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
              <Plus className="w-4 h-4 mr-2" />
              {t('new_operation_type') || "Yangi tur"}
            </Button>
          )}
        </div>
      </div>

      {/* Operation Types by Warehouse */}
      {Object.entries(groupedByWarehouse).map(([whId, { warehouse, types }]) => (
        <Card key={whId}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-[var(--genix-blue)]" />
              {warehouse.name}
              <Badge variant="secondary" className="ml-2">
                {types.length} {t('types') || 'tur'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {types.sort((a, b) => a.sequence - b.sequence).map(opType => (
                <OperationTypeCard key={opType.id} opType={opType} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {Object.keys(groupedByWarehouse).length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              {t('no_operation_types') || "Operatsiya turlari topilmadi"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t('no_operation_types_desc') || "Ombor yaratganingizda avtomatik ravishda 4 ta defolt operatsiya turi yaratiladi"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('new_operation_type') || "Yangi operatsiya turi"}</DialogTitle>
            <DialogDescription>
              {t('create_operation_type_desc') || "Yangi ombor operatsiya turini yarating"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('warehouse') || 'Ombor'} *
              </label>
              <Select value={formData.warehouse_id} onValueChange={(v) => setFormData({ ...formData, warehouse_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_warehouse') || "Omborni tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(wh => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('code') || 'Kod'} *
                </label>
                <Input
                  placeholder="WH/CUSTOM"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('name') || 'Nomi'} *
                </label>
                <Input
                  placeholder={t('operation_type_name') || "Operatsiya turi nomi"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('operation_direction') || 'Operatsiya yo\'nalishi'} *
              </label>
              <Select value={formData.operation_type} onValueChange={(v) => setFormData({ ...formData, operation_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">{t('incoming') || 'Kiruvchi (Receipts)'}</SelectItem>
                  <SelectItem value="outgoing">{t('outgoing') || 'Chiquvchi (Deliveries)'}</SelectItem>
                  <SelectItem value="internal">{t('internal') || 'Ichki (Transfers)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                {t('color') || 'Rang'}
              </label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map(({ color, name }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                    title={name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">{t('show_in_dashboard') || "Dashboard'da ko'rsatish"}</p>
                <p className="text-xs text-slate-500">{t('show_in_dashboard_desc') || "Ombor holatida ko'rinadi"}</p>
              </div>
              <Switch
                checked={formData.show_operations}
                onCheckedChange={(v) => setFormData({ ...formData, show_operations: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !formData.warehouse_id || !formData.code || !formData.name}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {isSaving ? t('saving') || 'Saqlanmoqda...' : t('create') || 'Yaratish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('edit_operation_type') || "Operatsiya turini tahrirlash"}</DialogTitle>
            <DialogDescription>
              {selectedType?.code}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('name') || 'Nomi'}
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                {t('color') || 'Rang'}
              </label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map(({ color, name }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                    title={name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('active') || "Faol"}</p>
                  <p className="text-xs text-slate-500">{t('active_desc') || "Operatsiya turi faolmi"}</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('show_in_dashboard') || "Dashboard'da ko'rsatish"}</p>
                </div>
                <Switch
                  checked={formData.show_operations}
                  onCheckedChange={(v) => setFormData({ ...formData, show_operations: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('barcode_scanning') || "Barkod skanerlash"}</p>
                </div>
                <Switch
                  checked={formData.barcode_enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, barcode_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('create_backorder') || "Backorder yaratish"}</p>
                  <p className="text-xs text-slate-500">{t('create_backorder_desc') || "Qisman yetkazib berishda avtomatik backorder"}</p>
                </div>
                <Switch
                  checked={formData.create_backorder}
                  onCheckedChange={(v) => setFormData({ ...formData, create_backorder: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSaving}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {isSaving ? t('saving') || 'Saqlanmoqda...' : t('save') || 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
