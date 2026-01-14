import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Warehouse, Pencil, Trash2, Eye, MapPin, Phone,
  Mail, User, ChevronRight, ChevronDown, AlertCircle, CheckCircle,
  Building2, Package, LayoutGrid
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";

export default function Warehouses() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    warehouses,
    inventory,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    createWarehouseLocation,
    getWarehouseInventory,
    isLoading
  } = useInventory();

  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWarehouse, setExpandedWarehouse] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    phone: '',
    email: '',
    manager_name: '',
    is_active: true,
    is_default: false
  });

  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    zone: '',
    is_active: true
  });

  // Summary calculations
  const summaryStats = {
    totalWarehouses: warehouses.length,
    activeWarehouses: warehouses.filter(w => w.is_active).length,
    totalLocations: warehouses.reduce((sum, w) => sum + (w.locations?.length || 0), 0),
    totalStock: inventory.reduce((sum, i) => sum + i.quantity, 0)
  };

  useEffect(() => {
    setFilteredWarehouses(warehouses);
  }, [warehouses]);

  useEffect(() => {
    let filtered = warehouses;

    if (searchQuery) {
      filtered = filtered.filter(warehouse =>
        warehouse.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        warehouse.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        warehouse.city?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredWarehouses(filtered);
  }, [searchQuery, warehouses]);

  const getWarehouseStockCount = (warehouseId) => {
    return inventory
      .filter(i => i.warehouse_id === warehouseId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      phone: '',
      email: '',
      manager_name: '',
      is_active: true,
      is_default: false
    });
  };

  const resetLocationForm = () => {
    setLocationForm({
      code: '',
      name: '',
      zone: '',
      is_active: true
    });
  };

  const handleCreate = () => {
    setIsSaving(true);
    try {
      createWarehouse(formData);
      resetForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating warehouse:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      code: warehouse.code || '',
      name: warehouse.name || '',
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      country: warehouse.country || '',
      postal_code: warehouse.postal_code || '',
      phone: warehouse.phone || '',
      email: warehouse.email || '',
      manager_name: warehouse.manager_name || '',
      is_active: warehouse.is_active !== false,
      is_default: warehouse.is_default || false
    });
    setShowEditModal(true);
  };

  const handleUpdate = () => {
    setIsSaving(true);
    try {
      updateWarehouse(selectedWarehouse.id, formData);
      resetForm();
      setSelectedWarehouse(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating warehouse:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowDeleteModal(true);
  };

  const handleDelete = () => {
    try {
      deleteWarehouse(selectedWarehouse.id);
      setSelectedWarehouse(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting warehouse:', error);
    }
  };

  const handleViewDetail = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowDetailModal(true);
  };

  const handleAddLocation = (warehouse) => {
    setSelectedWarehouse(warehouse);
    resetLocationForm();
    setShowLocationModal(true);
  };

  const handleCreateLocation = () => {
    setIsSaving(true);
    try {
      createWarehouseLocation(selectedWarehouse.id, locationForm);
      resetLocationForm();
      setShowLocationModal(false);
    } catch (error) {
      console.error('Error creating location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (warehouseId) => {
    setExpandedWarehouse(expandedWarehouse === warehouseId ? null : warehouseId);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_warehouses')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summaryStats.totalWarehouses}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Warehouse className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('active')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.activeWarehouses}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_locations')}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {summaryStats.totalLocations}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <LayoutGrid className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_stock')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summaryStats.totalStock.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouses List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Warehouse className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('warehouses')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredWarehouses.length} {t('warehouses').toLowerCase()}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search') + '...'}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-purple)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('new_warehouse')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[var(--genix-purple)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">{t('loading')}</p>
              </div>
            </div>
          ) : filteredWarehouses.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Warehouse className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? t('no_results_found') : t('no_warehouses_yet')}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? t('search')
                  : t('setup_first_warehouse')}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_warehouse')}
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredWarehouses.map(warehouse => {
                const isExpanded = expandedWarehouse === warehouse.id;
                const stockCount = getWarehouseStockCount(warehouse.id);
                const locationCount = warehouse.locations?.length || 0;

                return (
                  <div key={warehouse.id}>
                    {/* Warehouse Row */}
                    <div className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(warehouse.id)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          )}
                        </Button>

                        <div className="w-12 h-12 bg-gradient-to-br from-[var(--genix-blue)]/10 to-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                          <Warehouse className="w-6 h-6 text-[var(--genix-purple)]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{warehouse.name}</h3>
                            {warehouse.is_default && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                                Default
                              </Badge>
                            )}
                            <Badge className={warehouse.is_active
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                            }>
                              {warehouse.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-slate-500 font-mono">{warehouse.code}</span>
                            {warehouse.city && (
                              <span className="text-sm text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {warehouse.city}, {warehouse.state}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">{locationCount}</p>
                            <p className="text-xs text-slate-500">Locations</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">{stockCount.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">Items</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(warehouse)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(warehouse)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(warehouse)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Locations */}
                    {isExpanded && (
                      <div className="bg-slate-50 px-4 pb-4">
                        <div className="ml-12 mt-2">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-slate-700">Locations</h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddLocation(warehouse)}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Add Location
                            </Button>
                          </div>
                          {warehouse.locations?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {warehouse.locations.map(location => (
                                <div
                                  key={location.id}
                                  className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="font-medium text-slate-900">{location.name}</p>
                                    <p className="text-xs text-slate-500">
                                      Code: {location.code} {location.zone && `| Zone: ${location.zone}`}
                                    </p>
                                  </div>
                                  <Badge className={location.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-slate-100 text-slate-600'
                                  }>
                                    {location.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 py-4 text-center bg-white rounded-lg border border-slate-200">
                              No locations configured for this warehouse
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Warehouse Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-[var(--genix-purple)]" />
              {showEditModal ? 'Edit Warehouse' : 'New Warehouse'}
            </DialogTitle>
            <DialogDescription>
              {showEditModal ? 'Update warehouse information' : 'Add a new warehouse location'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Code *</label>
                <Input
                  placeholder="e.g., WH-001"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Name *</label>
                <Input
                  placeholder="Warehouse name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Address</label>
              <Input
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">City</label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">State</label>
                <Input
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Country</label>
                <Input
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Postal Code</label>
                <Input
                  placeholder="ZIP"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Phone</label>
                <Input
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
                <Input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Manager</label>
                <Input
                  placeholder="Manager name"
                  value={formData.manager_name}
                  onChange={(e) => setFormData({...formData, manager_name: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
                <span className="text-sm text-slate-700">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({...formData, is_default: checked})}
                />
                <span className="text-sm text-slate-700">Default Warehouse</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="flex-1"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={showEditModal ? handleUpdate : handleCreate}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !formData.name || !formData.code}
              >
                {isSaving ? 'Saving...' : showEditModal ? 'Update Warehouse' : 'Create Warehouse'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Location Modal */}
      <Dialog open={showLocationModal} onOpenChange={setShowLocationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-[var(--genix-blue)]" />
              Add Location
            </DialogTitle>
            <DialogDescription>
              Add a new location to {selectedWarehouse?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Code *</label>
                <Input
                  placeholder="e.g., A-1"
                  value={locationForm.code}
                  onChange={(e) => setLocationForm({...locationForm, code: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Zone</label>
                <Input
                  placeholder="e.g., A"
                  value={locationForm.zone}
                  onChange={(e) => setLocationForm({...locationForm, zone: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Name *</label>
              <Input
                placeholder="Location name"
                value={locationForm.name}
                onChange={(e) => setLocationForm({...locationForm, name: e.target.value})}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={locationForm.is_active}
                onCheckedChange={(checked) => setLocationForm({...locationForm, is_active: checked})}
              />
              <span className="text-sm text-slate-700">Active</span>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowLocationModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLocation}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !locationForm.name || !locationForm.code}
              >
                {isSaving ? 'Saving...' : 'Add Location'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warehouse Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-[var(--genix-purple)]" />
              Warehouse Details
            </DialogTitle>
          </DialogHeader>
          {selectedWarehouse && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--genix-blue)]/10 to-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                  <Warehouse className="w-8 h-8 text-[var(--genix-purple)]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{selectedWarehouse.name}</h3>
                    {selectedWarehouse.is_default && (
                      <Badge className="bg-blue-100 text-blue-800">Default</Badge>
                    )}
                  </div>
                  <p className="text-slate-500 font-mono">{selectedWarehouse.code}</p>
                </div>
                <Badge className={selectedWarehouse.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600'
                }>
                  {selectedWarehouse.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedWarehouse.address && (
                  <div className="p-3 bg-slate-50 rounded-lg col-span-2">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Address
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {selectedWarehouse.address}
                      {selectedWarehouse.city && `, ${selectedWarehouse.city}`}
                      {selectedWarehouse.state && `, ${selectedWarehouse.state}`}
                      {selectedWarehouse.postal_code && ` ${selectedWarehouse.postal_code}`}
                    </p>
                  </div>
                )}
                {selectedWarehouse.phone && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </p>
                    <p className="text-sm font-medium text-slate-900">{selectedWarehouse.phone}</p>
                  </div>
                )}
                {selectedWarehouse.email && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </p>
                    <p className="text-sm font-medium text-slate-900">{selectedWarehouse.email}</p>
                  </div>
                )}
                {selectedWarehouse.manager_name && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> Manager
                    </p>
                    <p className="text-sm font-medium text-slate-900">{selectedWarehouse.manager_name}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Locations</p>
                  <p className="text-lg font-bold text-blue-700">{selectedWarehouse.locations?.length || 0}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Stock Items</p>
                  <p className="text-lg font-bold text-green-700">{getWarehouseStockCount(selectedWarehouse.id).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedWarehouse);
                  }}
                  className="flex-1"
                >
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Warehouse
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-900">"{selectedWarehouse?.name}"</span>?
              This action cannot be undone.
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Deleting this warehouse will affect all associated inventory records and locations.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
