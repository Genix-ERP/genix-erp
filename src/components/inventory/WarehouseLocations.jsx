import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Pencil, Trash2, MoreHorizontal, MapPin, Package,
  Check, X, Filter, ChevronDown, Settings2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { inventoryService } from '@/api/services';
import { usePermissions } from "@/hooks/usePermissions";
import { useInventory } from "@/components/contexts/InventoryContext";

// Location type options (matching Odoo)
const LOCATION_TYPES = [
  { value: 'internal', label: 'Internal Location', color: 'bg-blue-100 text-blue-800' },
  { value: 'storage', label: 'Storage', color: 'bg-green-100 text-green-800' },
  { value: 'receiving', label: 'Receiving', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'shipping', label: 'Shipping', color: 'bg-orange-100 text-orange-800' },
  { value: 'staging', label: 'Staging', color: 'bg-purple-100 text-purple-800' },
  { value: 'view', label: 'View', color: 'bg-slate-100 text-slate-800' },
  { value: 'transit', label: 'Transit', color: 'bg-cyan-100 text-cyan-800' },
];

export default function WarehouseLocations() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { warehouses: contextWarehouses } = useInventory();

  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Cleanup modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowCreateModal(false);
      setShowEditModal(false);
      setShowDeleteConfirm(false);
    };
  }, []);

  const [formData, setFormData] = useState({
    warehouse_id: '',
    code: '',
    name: '',
    type: 'internal',
    aisle: '',
    rack: '',
    shelf: '',
    bin: '',
    capacity: '',
    is_active: true
  });

  // Use warehouses from context
  useEffect(() => {
    if (contextWarehouses?.length) {
      setWarehouses(contextWarehouses);
    }
  }, [contextWarehouses]);

  // Fetch locations only
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoading(true);
      try {
        const locationsData = await inventoryService.listAllLocations({ include_inactive: true });
        setLocations(locationsData || []);
      } catch (err) {
        console.error('Error fetching locations:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  // Filter locations
  const filteredLocations = locations.filter(loc => {
    const matchesSearch = !searchQuery ||
      loc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWarehouse = selectedWarehouse === 'all' || loc.warehouse_id === selectedWarehouse;
    const matchesType = selectedType === 'all' || loc.type === selectedType;
    return matchesSearch && matchesWarehouse && matchesType;
  });

  const resetForm = () => {
    setFormData({
      warehouse_id: warehouses[0]?.id || '',
      code: '',
      name: '',
      type: 'internal',
      aisle: '',
      rack: '',
      shelf: '',
      bin: '',
      capacity: '',
      is_active: true
    });
  };

  const handleCreate = async () => {
    if (!formData.warehouse_id || !formData.code || !formData.name) return;

    setIsSaving(true);
    try {
      const data = {
        ...formData,
        capacity: formData.capacity ? parseFloat(formData.capacity) : null
      };
      const newLocation = await inventoryService.createWarehouseLocation(formData.warehouse_id, data);
      // Refresh to get warehouse info
      const updatedLocations = await inventoryService.listAllLocations({ include_inactive: true });
      setLocations(updatedLocations || []);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error('Error creating location:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedLocation) return;

    setIsSaving(true);
    try {
      const data = {
        name: formData.name,
        type: formData.type,
        aisle: formData.aisle || null,
        rack: formData.rack || null,
        shelf: formData.shelf || null,
        bin: formData.bin || null,
        capacity: formData.capacity ? parseFloat(formData.capacity) : null,
        is_active: formData.is_active
      };
      await inventoryService.updateWarehouseLocation(selectedLocation.warehouse_id, selectedLocation.id, data);
      // Refresh
      const updatedLocations = await inventoryService.listAllLocations({ include_inactive: true });
      setLocations(updatedLocations || []);
      setShowEditModal(false);
      setSelectedLocation(null);
    } catch (err) {
      console.error('Error updating location:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!locationToDelete) return;

    try {
      await inventoryService.deleteWarehouseLocation(locationToDelete.warehouse_id, locationToDelete.id);
      setLocations(prev => prev.filter(loc => loc.id !== locationToDelete.id));
      setShowDeleteConfirm(false);
      setLocationToDelete(null);
    } catch (err) {
      console.error('Error deleting location:', err);
      alert(err.response?.data?.error || 'Failed to delete location');
    }
  };

  const openEditModal = (loc) => {
    setSelectedLocation(loc);
    setFormData({
      warehouse_id: loc.warehouse_id,
      code: loc.code,
      name: loc.name,
      type: loc.type || 'internal',
      aisle: loc.aisle || '',
      rack: loc.rack || '',
      shelf: loc.shelf || '',
      bin: loc.bin || '',
      capacity: loc.capacity?.toString() || '',
      is_active: loc.is_active !== false
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

  const getLocationTypeInfo = (type) => {
    return LOCATION_TYPES.find(t => t.value === type) || LOCATION_TYPES[0];
  };

  // Select all checkbox handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedLocations(filteredLocations.map(loc => loc.id));
    } else {
      setSelectedLocations([]);
    }
  };

  const handleSelectLocation = (locationId, checked) => {
    if (checked) {
      setSelectedLocations(prev => [...prev, locationId]);
    } else {
      setSelectedLocations(prev => prev.filter(id => id !== locationId));
    }
  };

  const isAllSelected = filteredLocations.length > 0 && selectedLocations.length === filteredLocations.length;
  const isSomeSelected = selectedLocations.length > 0 && selectedLocations.length < filteredLocations.length;

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-transparent bg-clip-text">
            {t('locations') || "Lokatsiyalar"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('locations_desc') || "Ombor lokatsiyalarini boshqarish"}
          </p>
        </div>
        {canCreate(MODULES.INVENTORY) && (
          <Button onClick={openCreateModal} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
            <Plus className="w-4 h-4 mr-2" />
            {t('new') || "Yangi"}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search') || "Qidirish..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('all_types') || "Barcha turlar"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_types') || "Barcha turlar"}</SelectItem>
                {LOCATION_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(`location_type_${type.value}`) || type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className={isSomeSelected ? "data-[state=checked]:bg-slate-400" : ""}
                  />
                </TableHead>
                <TableHead>{t('location') || 'Lokatsiya'}</TableHead>
                <TableHead>{t('location_type') || 'Turi'}</TableHead>
                <TableHead>{t('is_empty') || "Bo'shmi"}</TableHead>
                <TableHead>{t('storage_category') || 'Kategoriya'}</TableHead>
                <TableHead>{t('company') || 'Kompaniya'}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">
                      {t('no_locations') || "Lokatsiyalar topilmadi"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t('no_locations_desc') || "Yangi lokatsiya qo'shish uchun \"Yangi\" tugmasini bosing"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLocations.map(loc => {
                  const typeInfo = getLocationTypeInfo(loc.type);
                  return (
                    <TableRow key={loc.id} className={!loc.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLocations.includes(loc.id)}
                          onCheckedChange={(checked) => handleSelectLocation(loc.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="font-medium">{loc.code}</div>
                            <div className="text-xs text-slate-500">{loc.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={typeInfo.color}>
                          {t(`location_type_${loc.type}`) || typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {loc.is_empty === true ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            {t('yes') || 'Ha'}
                          </Badge>
                        ) : loc.is_empty === false ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                            {t('no') || "Yo'q"}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {loc.aisle || loc.rack || loc.shelf ? (
                          <span className="text-xs text-slate-500">
                            {[loc.aisle, loc.rack, loc.shelf, loc.bin].filter(Boolean).join(' / ')}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{loc.warehouse_name}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canUpdate(MODULES.INVENTORY) && (
                              <DropdownMenuItem onClick={() => openEditModal(loc)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                {t('edit') || 'Tahrirlash'}
                              </DropdownMenuItem>
                            )}
                            {canDelete(MODULES.INVENTORY) && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setLocationToDelete(loc);
                                  setShowDeleteConfirm(true);
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete') || "O'chirish"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="text-sm text-slate-500 text-right">
        {filteredLocations.length} / {locations.length} {t('locations') || 'lokatsiya'}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('new_location') || "Yangi lokatsiya"}</DialogTitle>
            <DialogDescription>
              {t('create_location_desc') || "Yangi ombor lokatsiyasini yarating"}
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
                  placeholder="WH/Stock"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('name') || 'Nomi'} *
                </label>
                <Input
                  placeholder={t('location_name') || "Lokatsiya nomi"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('location_type') || 'Lokatsiya turi'}
              </label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(`location_type_${type.value}`) || type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('aisle') || 'Yo\'lak'}</label>
                <Input
                  placeholder="A"
                  value={formData.aisle}
                  onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('rack') || 'Stend'}</label>
                <Input
                  placeholder="1"
                  value={formData.rack}
                  onChange={(e) => setFormData({ ...formData, rack: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('shelf') || 'Polka'}</label>
                <Input
                  placeholder="1"
                  value={formData.shelf}
                  onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('bin') || 'Quti'}</label>
                <Input
                  placeholder="A"
                  value={formData.bin}
                  onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('capacity') || 'Sig\'imi'}
              </label>
              <Input
                type="number"
                placeholder="100"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
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
            <DialogTitle>{t('edit_location') || "Lokatsiyani tahrirlash"}</DialogTitle>
            <DialogDescription>
              {selectedLocation?.code}
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
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('location_type') || 'Lokatsiya turi'}
              </label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(`location_type_${type.value}`) || type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('aisle') || 'Yo\'lak'}</label>
                <Input
                  value={formData.aisle}
                  onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('rack') || 'Stend'}</label>
                <Input
                  value={formData.rack}
                  onChange={(e) => setFormData({ ...formData, rack: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('shelf') || 'Polka'}</label>
                <Input
                  value={formData.shelf}
                  onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('bin') || 'Quti'}</label>
                <Input
                  value={formData.bin}
                  onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('capacity') || 'Sig\'imi'}
              </label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">{t('active') || "Faol"}</p>
                <p className="text-xs text-slate-500">{t('location_active_desc') || "Lokatsiya faolmi"}</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
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

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirm_delete') || "O'chirishni tasdiqlang"}</DialogTitle>
            <DialogDescription>
              {t('delete_location_confirm') || "Ushbu lokatsiyani o'chirishni xohlaysizmi?"} <strong>{locationToDelete?.code}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('delete') || "O'chirish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
