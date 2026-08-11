import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Warehouse, Edit, Trash2, Eye, MapPin, Phone,
  Mail, User, ChevronRight, ChevronDown, AlertCircle, CheckCircle,
  Building2, Package, LayoutGrid, Truck, PackageCheck, RotateCcw,
  ClipboardCheck, Barcode, Box, Layers, HelpCircle, ArrowLeftRight, Trash
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";
import InventoryManagement from "./InventoryManagement";
import StockCounting from "./StockCounting";
import ScrapManagement from "./ScrapManagement";
import { toast } from 'sonner';

// Field Help Component - Odoo-style tooltip for field explanations
// Note: TooltipProvider should be at a higher level, not per-component
const FieldHelp = ({ text }) => (
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
);

// Label with help tooltip
const LabelWithHelp = ({ label, helpText, required }) => (
  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center">
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

// hideSubTabs: when rendered inside the Sozlamalar surface the stocktake/
// scrap/stock-management flows already live under Hujjatlar, so only the
// warehouse list is shown and the internal tab strip is hidden.
export default function Warehouses({ hideSubTabs = false }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const {
    warehouses,
    inventory,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    createWarehouseLocation,
    updateWarehouseLocation,
    deleteWarehouseLocation,
    getWarehouseInventory,
    isLoading
  } = useInventory();

  const [activeSubTab, setActiveSubTab] = useState('warehouses');
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWarehouse, setExpandedWarehouse] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [showDeleteLocationModal, setShowDeleteLocationModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cleanup all modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowCreateModal(false);
      setShowEditModal(false);
      setShowDeleteModal(false);
      setShowDetailModal(false);
      setShowLocationModal(false);
      setShowEditLocationModal(false);
      setShowDeleteLocationModal(false);
    };
  }, []);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    warehouse_type: 'regular', // regular or scrap
    reception_steps: 1,  // 1=Direct, 2=Input+Stock, 3=Input+QC+Stock
    delivery_steps: 1,   // 1=Direct, 2=Pick+Ship, 3=Pick+Pack+Ship
    manufacturing_steps: 1  // 1=Simple, 2=Pick+Produce, 3=Pick+Produce+Store
  });

  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    type: 'storage', // storage, receiving, shipping, staging, returns, quality
    parent_id: '',
    // SAP-style hierarchical address
    aisle: '',
    rack: '',
    shelf: '',
    bin: '',
    // Capacity & tracking
    capacity: '',
    capacity_unit: 'units',
    is_scrap_location: false,
    is_return_location: false,
    is_replenish_location: false,
    barcode: '',
    is_active: true
  });

  // Summary calculations
  const summaryStats = {
    totalWarehouses: warehouses.length,
    activeWarehouses: warehouses.filter(w => w.is_active).length,
    totalLocations: warehouses.reduce((sum, w) => sum + (w.locations?.length || 0), 0),
    totalStock: inventory.reduce((sum, i) => sum + (i.quantity_on_hand ?? i.quantity ?? 0), 0)
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
      .reduce((sum, i) => sum + (i.quantity_on_hand ?? i.quantity ?? 0), 0);
  };

  const generateCode = (prefix, existingItems) => {
    const maxNum = (existingItems || []).reduce((max, item) => {
      const match = item.code?.match(new RegExp(`^${prefix}-(\\d+)$`));
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const resetForm = () => {
    setFormData({
      code: generateCode('WH', warehouses),
      name: '',
      address: '',
      city: '',
      state: '',
      country: '',
      warehouse_type: 'regular',
      reception_steps: 1,
      delivery_steps: 1,
      manufacturing_steps: 1
    });
  };

  const resetLocationForm = () => {
    const locCount = selectedWarehouse?.locations?.length || 0;
    setLocationForm({
      code: `LOC-${String(locCount + 1).padStart(3, '0')}`,
      name: '',
      type: 'storage',
      parent_id: '',
      aisle: '',
      rack: '',
      shelf: '',
      bin: '',
      capacity: '',
      capacity_unit: 'units',
      is_scrap_location: false,
      is_return_location: false,
      is_replenish_location: false,
      barcode: '',
      is_active: true
    });
  };

  // The server's `address` is a structured object — {street1, street2, city,
  // state, postal_code, country} (entity.Address) — while this form keeps one
  // street line plus separate city/state/country fields.
  //
  // The edit dialog used to drop the object straight into the street input,
  // which rendered as the literal string "[object Object]", and it read
  // city/state/country from the warehouse's top level, where the API has
  // never put them — so those three boxes always opened empty, even for a
  // warehouse with a full saved address. Saving then sent address as a plain
  // string, which the server rejects outright ({json:"address"} binds to a
  // struct), meaning the address could never be edited from this screen at
  // all.
  const addressToForm = (address) => {
    const a = (address && typeof address === 'object') ? address : {};
    return {
      // A legacy string address (pre-structured data) still shows rather
      // than disappearing.
      address: typeof address === 'string' ? address : [a.street1, a.street2].filter(Boolean).join(', '),
      city: a.city || '',
      state: a.state || '',
      country: a.country || '',
    };
  };

  const formToPayload = (data) => {
    const { address, city, state, country, ...rest } = data;
    const hasAddress = address || city || state || country;
    return {
      ...rest,
      // Omitted entirely when every field is blank: the input's address is
      // *Address with omitempty, and an empty object would overwrite a saved
      // address with nothing on an unrelated edit.
      ...(hasAddress ? { address: { street1: address || '', city: city || '', state: state || '', country: country || '' } } : {}),
    };
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      await createWarehouse(formToPayload(formData));
      resetForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating warehouse:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      code: warehouse.code || '',
      name: warehouse.name || '',
      ...addressToForm(warehouse.address),
      warehouse_type: warehouse.warehouse_type || 'regular',
      reception_steps: warehouse.reception_steps || 1,
      delivery_steps: warehouse.delivery_steps || 1,
      manufacturing_steps: warehouse.manufacturing_steps || 1
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await updateWarehouse(selectedWarehouse.id, formToPayload(formData));
      resetForm();
      setSelectedWarehouse(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating warehouse:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    try {
      await deleteWarehouse(selectedWarehouse.id);
      setSelectedWarehouse(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting warehouse:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
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

  const handleCreateLocation = async () => {
    setIsSaving(true);
    try {
      await createWarehouseLocation(selectedWarehouse.id, locationForm);
      resetLocationForm();
      setShowLocationModal(false);
    } catch (error) {
      console.error('Error creating location:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditLocation = (warehouse, location) => {
    setSelectedWarehouse(warehouse);
    setSelectedLocation(location);
    setLocationForm({
      code: location.code || '',
      name: location.name || '',
      type: location.type || 'storage',
      parent_id: location.parent_id || '',
      aisle: location.aisle || '',
      rack: location.rack || '',
      shelf: location.shelf || '',
      bin: location.bin || '',
      capacity: location.capacity?.toString() || '',
      capacity_unit: location.capacity_unit || 'units',
      is_scrap_location: location.is_scrap_location || false,
      is_return_location: location.is_return_location || false,
      is_replenish_location: location.is_replenish_location || false,
      barcode: location.barcode || '',
      is_active: location.is_active !== false
    });
    setShowEditLocationModal(true);
  };

  const handleUpdateLocation = async () => {
    setIsSaving(true);
    try {
      await updateWarehouseLocation(selectedWarehouse.id, selectedLocation.id, locationForm);
      resetLocationForm();
      setSelectedLocation(null);
      setShowEditLocationModal(false);
    } catch (error) {
      console.error('Error updating location:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocationClick = (warehouse, location) => {
    setSelectedWarehouse(warehouse);
    setSelectedLocation(location);
    setShowDeleteLocationModal(true);
  };

  const handleDeleteLocation = async () => {
    try {
      await deleteWarehouseLocation(selectedWarehouse.id, selectedLocation.id);
      setSelectedLocation(null);
      setShowDeleteLocationModal(false);
    } catch (error) {
      console.error('Error deleting location:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
    }
  };

  const toggleExpand = (warehouseId) => {
    setExpandedWarehouse(expandedWarehouse === warehouseId ? null : warehouseId);
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      {/* Sub-tabs for Warehouses, Stock Management, Stocktake, and Scrap */}
      <Tabs value={hideSubTabs ? 'warehouses' : activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        {!hideSubTabs && (
        <TabsList className="w-fit bg-slate-100/80 p-1 rounded-lg flex-wrap">
          <TabsTrigger value="warehouses" className="data-[state=active]:bg-white">
            <Warehouse className="w-4 h-4 mr-2" />
            {t('warehouses') || 'Warehouses'}
          </TabsTrigger>
          <TabsTrigger value="stock-management" className="data-[state=active]:bg-white">
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            {t('stock_management') || 'Stock Management'}
          </TabsTrigger>
          <TabsTrigger value="stocktake" className="data-[state=active]:bg-white">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            {t('stocktake') || 'Stocktake'}
          </TabsTrigger>
          <TabsTrigger value="scrap" className="data-[state=active]:bg-white">
            <Trash className="w-4 h-4 mr-2" />
            {t('scrap') || 'Scrap'}
          </TabsTrigger>
        </TabsList>
        )}

        {/* Warehouses Tab */}
        <TabsContent value="warehouses" className="mt-4 space-y-6">
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
              {canCreate(MODULES.INVENTORY) && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('new_warehouse')}
                </Button>
              )}
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
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? t('search')
                  : t('setup_first_warehouse')}
              </p>
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
                            {warehouse.warehouse_type === 'scrap' && (
                              <Badge variant="destructive" className="text-xs">{t('scrap')}</Badge>
                            )}
                            {/* A warehouse with no company is broken: every stock
                                query filters by company, so nothing inside it is
                                visible anywhere. It used to be hidden from this
                                list entirely, which made it unfixable. Saving it
                                now adopts it into the active company. */}
                            {!warehouse.organization_id && (
                              <Badge
                                variant="destructive"
                                className="text-xs"
                                title={t('help_warehouse_no_company') ||
                                  "Bu omborga kompaniya biriktirilmagan, shuning uchun undagi tovar hech qayerda ko'rinmaydi. Omborni ochib saqlasangiz, joriy kompaniyaga biriktiriladi."}
                              >
                                {t('warehouse_no_company') || "Kompaniyasiz — tovar ko'rinmaydi"}
                              </Badge>
                            )}
                          </div>
                          {warehouse.city && (
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-sm text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {warehouse.city}, {warehouse.state}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">{locationCount}</p>
                            <p className="text-xs text-slate-500">{t('locations')}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">{stockCount.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">{t('items')}</p>
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
                            {canUpdate(MODULES.INVENTORY) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(warehouse)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="w-4 h-4 text-slate-500" />
                              </Button>
                            )}
                            {canDelete(MODULES.INVENTORY) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(warehouse)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Locations */}
                    {isExpanded && (
                      <div className="bg-slate-50 px-4 pb-4">
                        <div className="ml-12 mt-2">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-slate-700">{t('locations')}</h4>
                            {canCreate(MODULES.INVENTORY) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddLocation(warehouse)}
                              >
                                <Plus className="w-3 h-3 mr-1" /> {t('add_location')}
                              </Button>
                            )}
                          </div>
                          {warehouse.locations?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {warehouse.locations.map(location => (
                                <div
                                  key={location.id}
                                  className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900">{location.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {t('code')}: {location.code} {location.zone && `| ${t('zone')}: ${location.zone}`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={location.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-slate-100 text-slate-600'
                                    }>
                                      {location.is_active ? t('active') : t('inactive')}
                                    </Badge>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {canUpdate(MODULES.INVENTORY) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditLocation(warehouse, location)}
                                          className="h-7 w-7 p-0"
                                        >
                                          <Edit className="w-3 h-3 text-slate-500" />
                                        </Button>
                                      )}
                                      {canDelete(MODULES.INVENTORY) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteLocationClick(warehouse, location)}
                                          className="h-7 w-7 p-0"
                                        >
                                          <Trash2 className="w-3 h-3 text-red-500" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 py-4 text-center bg-white rounded-lg border border-slate-200">
                              {t('no_locations_configured')}
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
        </TabsContent>

        {/* Stock Management Tab */}
        <TabsContent value="stock-management" className="mt-4">
          <InventoryManagement />
        </TabsContent>

        {/* Stocktake Tab */}
        <TabsContent value="stocktake" className="mt-4">
          <StockCounting />
        </TabsContent>

        {/* Scrap Tab */}
        <TabsContent value="scrap" className="mt-4">
          <ScrapManagement />
        </TabsContent>
      </Tabs>

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
              {showEditModal ? t('edit_warehouse') : t('new_warehouse')}
            </DialogTitle>
            <DialogDescription>
              {showEditModal ? t('update_warehouse_info') : t('add_warehouse_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <LabelWithHelp
                  label={t('code')}
                  required
                  helpText={t('help_warehouse_code') || "Avtomatik yaratilgan noyob ombor kodi."}
                />
                <Input
                  value={formData.code}
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <div>
                <LabelWithHelp
                  label={t('name')}
                  required
                  helpText={t('help_warehouse_name') || "Omborning to'liq nomi. Bu nom hisobotlarda va hujjatlarda ko'rsatiladi."}
                />
                <Input
                  placeholder={t('warehouse_name_placeholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <LabelWithHelp
                  label={t('warehouse_type')}
                  helpText={t('help_warehouse_type') || "Ombor turi: oddiy ombor yoki yaroqsiz mahsulotlar uchun ombor"}
                />
                <Select
                  value={formData.warehouse_type}
                  onValueChange={(value) => setFormData({...formData, warehouse_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">
                      <div className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4" />
                        {t('regular')}
                      </div>
                    </SelectItem>
                    <SelectItem value="scrap">
                      <div className="flex items-center gap-2">
                        <Trash className="w-4 h-4" />
                        {t('scrap')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <LabelWithHelp
                label={t('address')}
                helpText={t('help_warehouse_address') || "Omborning to'liq manzili. Yetkazib berish va logistika uchun ishlatiladi."}
              />
              <Input
                placeholder={t('street_address')}
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <LabelWithHelp
                  label={t('city')}
                  helpText={t('help_city') || "Shahar nomi. Mintaqaviy hisobotlar va filtrlash uchun ishlatiladi."}
                />
                <Input
                  placeholder={t('city')}
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>
              <div>
                <LabelWithHelp
                  label={t('state')}
                  helpText={t('help_state') || "Viloyat yoki hudud. Soliq va yetkazib berish hisob-kitoblari uchun ishlatilishi mumkin."}
                />
                <Input
                  placeholder={t('state')}
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                />
              </div>
              <div>
                <LabelWithHelp
                  label={t('country')}
                  helpText={t('help_country') || "Mamlakat. Xalqaro operatsiyalar va valyuta hisob-kitoblari uchun muhim."}
                />
                <Input
                  placeholder={t('country')}
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
            </div>

            {/* Warehouse Operations section hidden — simplified to 1-step */}
            <div className="pt-4 border-t border-slate-200" style={{display: 'none'}}>
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                {t('warehouse_operations') || 'Warehouse Operations'}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('reception_steps') || 'Incoming Shipments'}
                    helpText={t('help_reception_steps') || "Qabul qilish bosqichlari: 1-bosqich = to'g'ridan-to'g'ri omborga, 2-bosqich = kirish zonasi + ombor, 3-bosqich = kirish + sifat nazorati + ombor"}
                  />
                  <Select
                    value={String(formData.reception_steps)}
                    onValueChange={(value) => setFormData({...formData, reception_steps: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          {t('reception_1_step') || '1-step: Direct to Stock'}
                        </div>
                      </SelectItem>
                      <SelectItem value="2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          {t('reception_2_step') || '2-step: Input → Stock'}
                        </div>
                      </SelectItem>
                      <SelectItem value="3">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4" />
                          {t('reception_3_step') || '3-step: Input → QC → Stock'}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHelp
                    label={t('delivery_steps') || 'Outgoing Shipments'}
                    helpText={t('help_delivery_steps') || "Jo'natish bosqichlari: 1-bosqich = to'g'ridan-to'g'ri jo'natish, 2-bosqich = yig'ish + jo'natish, 3-bosqich = yig'ish + qadoqlash + jo'natish"}
                  />
                  <Select
                    value={String(formData.delivery_steps)}
                    onValueChange={(value) => setFormData({...formData, delivery_steps: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="w-4 h-4" />
                          {t('delivery_1_step') || '1-step: Direct from Stock'}
                        </div>
                      </SelectItem>
                      <SelectItem value="2">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          {t('delivery_2_step') || '2-step: Pick → Ship'}
                        </div>
                      </SelectItem>
                      <SelectItem value="3">
                        <div className="flex items-center gap-2">
                          <Box className="w-4 h-4" />
                          {t('delivery_3_step') || '3-step: Pick → Pack → Ship'}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHelp
                    label={t('manufacturing_steps') || 'Manufacturing'}
                    helpText={t('help_manufacturing_steps') || "Ishlab chiqarish bosqichlari: 1-bosqich = oddiy, 2-bosqich = komponentlarni yig'ish + ishlab chiqarish, 3-bosqich = yig'ish + ishlab chiqarish + saqlash"}
                  />
                  <Select
                    value={String(formData.manufacturing_steps)}
                    onValueChange={(value) => setFormData({...formData, manufacturing_steps: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {t('mfg_1_step') || '1-step: Simple (no transfers)'}
                        </div>
                      </SelectItem>
                      <SelectItem value="2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          {t('mfg_2_step') || '2-step: Pick → Produce'}
                        </div>
                      </SelectItem>
                      <SelectItem value="3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          {t('mfg_3_step') || '3-step: Pick → Produce → Store'}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Dynamic preview of operation types that will be created */}
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-600 mb-2">
                  {t('auto_created_operation_types') || "Avtomatik yaratiladigan operatsiya turlari:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* Reception chain */}
                  {formData.reception_steps >= 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                      {formData.code || '?'}/IN — {t('receipt') || "Qabul qilish"}
                    </span>
                  )}
                  {formData.reception_steps >= 2 && (
                    <>
                      <span className="text-slate-400 text-xs">→</span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-cyan-100 text-cyan-700">
                        {formData.code || '?'}/INPUT — {t('input_to_stock') || "Kirish → Ombor"}
                      </span>
                    </>
                  )}
                  {formData.reception_steps >= 3 && (
                    <>
                      <span className="text-slate-400 text-xs">→</span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-700">
                        {formData.code || '?'}/QC — {t('quality_control') || "Sifat nazorati"}
                      </span>
                    </>
                  )}

                  {/* Separator */}
                  <span className="text-slate-300 text-xs px-1">|</span>

                  {/* Internal transfer (always) */}
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                    {formData.code || '?'}/INT — {t('internal_transfers') || "Ichki o'tkazmalar"}
                  </span>

                  {/* Separator */}
                  <span className="text-slate-300 text-xs px-1">|</span>

                  {/* Delivery chain */}
                  {formData.delivery_steps >= 3 && (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700">
                        {formData.code || '?'}/PICK — {t('picking') || "Yig'ish"}
                      </span>
                      <span className="text-slate-400 text-xs">→</span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-pink-100 text-pink-700">
                        {formData.code || '?'}/PACK — {t('packing') || "Qadoqlash"}
                      </span>
                      <span className="text-slate-400 text-xs">→</span>
                    </>
                  )}
                  {formData.delivery_steps === 2 && (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700">
                        {formData.code || '?'}/PICK — {t('picking') || "Yig'ish"}
                      </span>
                      <span className="text-slate-400 text-xs">→</span>
                    </>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                    {formData.code || '?'}/OUT — {t('delivery') || "Yetkazib berish"}
                  </span>

                  {/* Separator */}
                  <span className="text-slate-300 text-xs px-1">|</span>

                  {/* POS (always) */}
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-violet-100 text-violet-700">
                    {formData.code || '?'}/POS — {t('pos_orders') || "Savdo nuqtasi"}
                  </span>
                </div>
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
                {t('cancel')}
              </Button>
              <Button
                onClick={showEditModal ? handleUpdate : handleCreate}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !formData.name || !formData.code}
              >
                {isSaving ? t('saving') : showEditModal ? t('update_warehouse') : t('create_warehouse')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Location Modal */}
      <Dialog open={showLocationModal} onOpenChange={setShowLocationModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('add_location')}
            </DialogTitle>
            <DialogDescription>
              {t('add_location_to')} {selectedWarehouse?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('basic_information')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('code')}
                    required
                    helpText={t('help_location_code') || "Avtomatik yaratilgan noyob joylashuv kodi."}
                  />
                  <Input
                    value={locationForm.code}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('name')}
                    required
                    helpText={t('help_location_name') || "Joylashuvning tavsifiy nomi. Xodimlar uchun oson tushunarli bo'lishi kerak."}
                  />
                  <Input
                    placeholder={t('location_name_placeholder') || 'e.g., Aisle A, Rack 1, Shelf 2'}
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({...locationForm, name: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <LabelWithHelp
                  label={t('location_type') || 'Location Type'}
                  helpText={t('help_location_type') || "Joylashuv turi operatsion qoidalarni belgilaydi: Saqlash - asosiy zaxira, Qabul - keluvchi tovarlar, Jo'natish - chiquvchi tovarlar."}
                />
                <Select
                  value={locationForm.type}
                  onValueChange={(value) => setLocationForm({...locationForm, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="storage">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4" />
                        {t('loc_type_storage') || 'Storage'}
                      </div>
                    </SelectItem>
                    <SelectItem value="receiving">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        {t('loc_type_receiving') || 'Receiving'}
                      </div>
                    </SelectItem>
                    <SelectItem value="shipping">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="w-4 h-4" />
                        {t('loc_type_shipping') || 'Shipping'}
                      </div>
                    </SelectItem>
                    <SelectItem value="staging">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        {t('loc_type_staging') || 'Staging'}
                      </div>
                    </SelectItem>
                    <SelectItem value="quality">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4" />
                        {t('loc_type_quality') || 'Quality Control'}
                      </div>
                    </SelectItem>
                    <SelectItem value="returns">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" />
                        {t('loc_type_returns') || 'Returns'}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedWarehouse?.locations?.length > 0 && (
                <div className="mt-4">
                  <LabelWithHelp
                    label={t('parent_location') || 'Parent Location'}
                    helpText={t('help_parent_location') || "Iyerarxik tuzilma yaratish uchun ota joylashuvni tanlang. Zona > Yo'lak > Stelling > Javon > Quti."}
                  />
                  <Select
                    value={locationForm.parent_id || '__none__'}
                    onValueChange={(value) => setLocationForm({...locationForm, parent_id: value === '__none__' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_parent') || 'None (Top Level)'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('none_top_level') || 'None (Top Level)'}</SelectItem>
                      {selectedWarehouse.locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.code} - {loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">{t('parent_location_desc') || 'Create hierarchical structure like SAP (Zone > Aisle > Rack > Shelf > Bin)'}</p>
                </div>
              )}
            </div>

            {/* SAP-style Address */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                {t('location_address') || 'Location Address'}
                <Badge className="bg-purple-100 text-purple-700 text-xs">SAP</Badge>
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('aisle') || 'Aisle'}
                    helpText={t('help_aisle') || "Yo'lak harfi yoki raqami (A, B, 1, 2). Omborning asosiy bo'linishi."}
                  />
                  <Input
                    placeholder="A"
                    value={locationForm.aisle}
                    onChange={(e) => setLocationForm({...locationForm, aisle: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('rack') || 'Rack'}
                    helpText={t('help_rack') || "Stelling raqami yo'lak ichida. Vertikal saqlash birliklarini belgilaydi."}
                  />
                  <Input
                    placeholder="01"
                    value={locationForm.rack}
                    onChange={(e) => setLocationForm({...locationForm, rack: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('shelf') || 'Shelf'}
                    helpText={t('help_shelf') || "Javon darajasi stelling ichida. Balandlik bo'yicha joylashuvni ko'rsatadi."}
                  />
                  <Input
                    placeholder="02"
                    value={locationForm.shelf}
                    onChange={(e) => setLocationForm({...locationForm, shelf: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('bin') || 'Bin'}
                    helpText={t('help_bin') || "Quti yoki bo'lim raqami. Eng kichik saqlash birligi."}
                  />
                  <Input
                    placeholder="03"
                    value={locationForm.bin}
                    onChange={(e) => setLocationForm({...locationForm, bin: e.target.value})}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">{t('location_address_desc') || 'Standard warehouse coordinate system: Aisle-Rack-Shelf-Bin (e.g., A-01-02-03)'}</p>
            </div>

            {/* Capacity */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('capacity_settings') || 'Capacity Settings'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('capacity') || 'Capacity'}
                    helpText={t('help_location_capacity') || "Joylashuvning maksimal sig'imi. Sig'im chegaralanganda ogohlantirish beriladi."}
                  />
                  <Input
                    type="number"
                    placeholder="100"
                    value={locationForm.capacity}
                    onChange={(e) => setLocationForm({...locationForm, capacity: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('capacity_unit') || 'Unit'}
                    helpText={t('help_capacity_unit') || "Sig'im o'lchov birligi: dona, kilogramm, kub metr yoki pallet."}
                  />
                  <Select
                    value={locationForm.capacity_unit}
                    onValueChange={(value) => setLocationForm({...locationForm, capacity_unit: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="units">{t('units') || 'Units'}</SelectItem>
                      <SelectItem value="kg">{t('kilograms') || 'Kilograms (kg)'}</SelectItem>
                      <SelectItem value="m3">{t('cubic_meters') || 'Cubic Meters (m³)'}</SelectItem>
                      <SelectItem value="pallets">{t('pallets') || 'Pallets'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Barcode */}
            <div>
              <LabelWithHelp
                label={
                  <span className="flex items-center gap-2">
                    <Barcode className="w-4 h-4" />
                    {t('location_barcode') || 'Location Barcode'}
                  </span>
                }
                helpText={t('help_location_barcode') || "Joylashuv shtrix kodi. Mobil skaner bilan tez aniqlash uchun ishlatiladi."}
              />
              <Input
                placeholder={t('barcode_placeholder') || 'Scan or enter barcode'}
                value={locationForm.barcode}
                onChange={(e) => setLocationForm({...locationForm, barcode: e.target.value})}
              />
            </div>

            {/* Special Location Types (Odoo-style) */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                {t('special_location_flags') || 'Special Location Flags'}
              </h4>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={locationForm.is_scrap_location}
                    onCheckedChange={(checked) => setLocationForm({...locationForm, is_scrap_location: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('is_scrap_location') || 'Scrap Location'}
                    <FieldHelp text={t('help_scrap_location') || "Chiqindilar joylashuvi. Yaroqsiz yoki buzilgan mahsulotlar bu yerga o'tkaziladi."} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={locationForm.is_return_location}
                    onCheckedChange={(checked) => setLocationForm({...locationForm, is_return_location: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('is_return_location') || 'Return Location'}
                    <FieldHelp text={t('help_return_location') || "Qaytarilgan tovarlar joylashuvi. Mijozlardan qaytgan mahsulotlar bu yerda tekshiriladi."} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={locationForm.is_replenish_location}
                    onCheckedChange={(checked) => setLocationForm({...locationForm, is_replenish_location: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('is_replenish_location') || 'Replenish Location'}
                    <FieldHelp text={t('help_replenish_location') || "To'ldirish joylashuvi. Avtomatik to'ldirish qoidalari bu joylashuvdan boshlanadi."} />
                  </span>
                </div>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2 border-t pt-4">
              <Switch
                checked={locationForm.is_active}
                onCheckedChange={(checked) => setLocationForm({...locationForm, is_active: checked})}
              />
              <span className="text-sm text-slate-700 flex items-center">
                {t('active')}
                <FieldHelp text={t('help_location_active') || "Faol joylashuvlar inventar operatsiyalarida ishlatiladi. Nofaol joylashuvlar yangi o'tkazmalar uchun mavjud emas."} />
              </span>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowLocationModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateLocation}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !locationForm.name || !locationForm.code}
              >
                {isSaving ? t('saving') : t('add_location')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Location Modal */}
      <Dialog open={showEditLocationModal} onOpenChange={setShowEditLocationModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_location')}
            </DialogTitle>
            <DialogDescription>
              {t('edit_location_in')} {selectedWarehouse?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('basic_information')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('code')}
                    required
                    helpText={t('help_location_code') || "Avtomatik yaratilgan noyob joylashuv kodi."}
                  />
                  <Input
                    value={locationForm.code}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('name')}
                    required
                    helpText={t('help_location_name') || "Joylashuvning tavsifiy nomi. Xodimlar uchun oson tushunarli bo'lishi kerak."}
                  />
                  <Input
                    placeholder={t('location_name_placeholder') || 'e.g., Aisle A, Rack 1, Shelf 2'}
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({...locationForm, name: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <LabelWithHelp
                  label={t('location_type') || 'Location Type'}
                  helpText={t('help_location_type') || "Joylashuv turi operatsion qoidalarni belgilaydi: Saqlash - asosiy zaxira, Qabul - keluvchi tovarlar, Jo'natish - chiquvchi tovarlar."}
                />
                <Select
                  value={locationForm.type}
                  onValueChange={(value) => setLocationForm({...locationForm, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="storage">{t('loc_type_storage') || 'Storage'}</SelectItem>
                    <SelectItem value="receiving">{t('loc_type_receiving') || 'Receiving'}</SelectItem>
                    <SelectItem value="shipping">{t('loc_type_shipping') || 'Shipping'}</SelectItem>
                    <SelectItem value="staging">{t('loc_type_staging') || 'Staging'}</SelectItem>
                    <SelectItem value="quality">{t('loc_type_quality') || 'Quality Control'}</SelectItem>
                    <SelectItem value="returns">{t('loc_type_returns') || 'Returns'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SAP-style Address */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                {t('location_address') || 'Location Address'}
                <Badge className="bg-purple-100 text-purple-700 text-xs">SAP</Badge>
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('aisle') || 'Aisle'}
                    helpText={t('help_aisle') || "Yo'lak harfi yoki raqami (A, B, 1, 2). Omborning asosiy bo'linishi."}
                  />
                  <Input
                    placeholder="A"
                    value={locationForm.aisle}
                    onChange={(e) => setLocationForm({...locationForm, aisle: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('rack') || 'Rack'}
                    helpText={t('help_rack') || "Stelling raqami yo'lak ichida. Vertikal saqlash birliklarini belgilaydi."}
                  />
                  <Input
                    placeholder="01"
                    value={locationForm.rack}
                    onChange={(e) => setLocationForm({...locationForm, rack: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('shelf') || 'Shelf'}
                    helpText={t('help_shelf') || "Javon darajasi stelling ichida. Balandlik bo'yicha joylashuvni ko'rsatadi."}
                  />
                  <Input
                    placeholder="02"
                    value={locationForm.shelf}
                    onChange={(e) => setLocationForm({...locationForm, shelf: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('bin') || 'Bin'}
                    helpText={t('help_bin') || "Quti yoki bo'lim raqami. Eng kichik saqlash birligi."}
                  />
                  <Input
                    placeholder="03"
                    value={locationForm.bin}
                    onChange={(e) => setLocationForm({...locationForm, bin: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Capacity */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('capacity_settings') || 'Capacity Settings'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('capacity') || 'Capacity'}
                    helpText={t('help_location_capacity') || "Joylashuvning maksimal sig'imi. Sig'im chegaralanganda ogohlantirish beriladi."}
                  />
                  <Input
                    type="number"
                    placeholder="100"
                    value={locationForm.capacity}
                    onChange={(e) => setLocationForm({...locationForm, capacity: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('capacity_unit') || 'Unit'}
                    helpText={t('help_capacity_unit') || "Sig'im o'lchov birligi: dona, kilogramm, kub metr yoki pallet."}
                  />
                  <Select
                    value={locationForm.capacity_unit}
                    onValueChange={(value) => setLocationForm({...locationForm, capacity_unit: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="units">{t('units') || 'Units'}</SelectItem>
                      <SelectItem value="kg">{t('kilograms') || 'Kilograms (kg)'}</SelectItem>
                      <SelectItem value="m3">{t('cubic_meters') || 'Cubic Meters (m³)'}</SelectItem>
                      <SelectItem value="pallets">{t('pallets') || 'Pallets'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Barcode */}
            <div>
              <LabelWithHelp
                label={
                  <span className="flex items-center gap-2">
                    <Barcode className="w-4 h-4" />
                    {t('location_barcode') || 'Location Barcode'}
                  </span>
                }
                helpText={t('help_location_barcode') || "Joylashuv shtrix kodi. Mobil skaner bilan tez aniqlash uchun ishlatiladi."}
              />
              <Input
                placeholder={t('barcode_placeholder') || 'Scan or enter barcode'}
                value={locationForm.barcode}
                onChange={(e) => setLocationForm({...locationForm, barcode: e.target.value})}
              />
            </div>

            {/* Special Location Flags */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('special_location_flags') || 'Special Location Flags'}</h4>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={locationForm.is_scrap_location}
                    onCheckedChange={(checked) => setLocationForm({...locationForm, is_scrap_location: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('is_scrap_location') || 'Scrap Location'}
                    <FieldHelp text={t('help_scrap_location') || "Chiqindilar joylashuvi. Yaroqsiz yoki buzilgan mahsulotlar bu yerga o'tkaziladi."} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={locationForm.is_return_location}
                    onCheckedChange={(checked) => setLocationForm({...locationForm, is_return_location: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('is_return_location') || 'Return Location'}
                    <FieldHelp text={t('help_return_location') || "Qaytarilgan tovarlar joylashuvi. Mijozlardan qaytgan mahsulotlar bu yerda tekshiriladi."} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={locationForm.is_replenish_location}
                    onCheckedChange={(checked) => setLocationForm({...locationForm, is_replenish_location: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('is_replenish_location') || 'Replenish Location'}
                    <FieldHelp text={t('help_replenish_location') || "To'ldirish joylashuvi. Avtomatik to'ldirish qoidalari bu joylashuvdan boshlanadi."} />
                  </span>
                </div>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2 border-t pt-4">
              <Switch
                checked={locationForm.is_active}
                onCheckedChange={(checked) => setLocationForm({...locationForm, is_active: checked})}
              />
              <span className="text-sm text-slate-700 flex items-center">
                {t('active')}
                <FieldHelp text={t('help_location_active') || "Faol joylashuvlar inventar operatsiyalarida ishlatiladi. Nofaol joylashuvlar yangi o'tkazmalar uchun mavjud emas."} />
              </span>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditLocationModal(false);
                  resetLocationForm();
                  setSelectedLocation(null);
                }}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleUpdateLocation}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !locationForm.name || !locationForm.code}
              >
                {isSaving ? t('saving') : t('save_changes')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Location Confirmation Modal */}
      <Dialog open={showDeleteLocationModal} onOpenChange={setShowDeleteLocationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('delete_location')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('delete_location_confirm')}{' '}
              <span className="font-semibold text-slate-900">"{selectedLocation?.name}"</span>
              {' '}{t('from')}{' '}
              <span className="font-semibold text-slate-900">"{selectedWarehouse?.name}"</span>?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteLocationModal(false);
                  setSelectedLocation(null);
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDeleteLocation}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
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
              {t('warehouse_details')}
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
                      <Badge className="bg-blue-100 text-blue-800">{t('default')}</Badge>
                    )}
                  </div>
                  <p className="text-slate-500 font-mono">{selectedWarehouse.code}</p>
                </div>
                <Badge className={selectedWarehouse.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600'
                }>
                  {selectedWarehouse.is_active ? t('active') : t('inactive')}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedWarehouse.address && (
                  <div className="p-3 bg-slate-50 rounded-lg col-span-2">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {t('address')}
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
                      <Phone className="w-3 h-3" /> {t('phone')}
                    </p>
                    <p className="text-sm font-medium text-slate-900">{selectedWarehouse.phone}</p>
                  </div>
                )}
                {selectedWarehouse.email && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {t('email')}
                    </p>
                    <p className="text-sm font-medium text-slate-900">{selectedWarehouse.email}</p>
                  </div>
                )}
                {selectedWarehouse.manager_name && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {t('manager')}
                    </p>
                    <p className="text-sm font-medium text-slate-900">{selectedWarehouse.manager_name}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">{t('locations')}</p>
                  <p className="text-lg font-bold text-blue-700">{selectedWarehouse.locations?.length || 0}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">{t('stock_items')}</p>
                  <p className="text-lg font-bold text-green-700">{getWarehouseStockCount(selectedWarehouse.id).toLocaleString()}</p>
                </div>
              </div>

              {/* Warehouse Operations Steps */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-orange-600 mb-1 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> {t('reception_steps') || 'Incoming'}
                  </p>
                  <p className="text-sm font-medium text-orange-700">
                    {selectedWarehouse.reception_steps === 1 && (t('reception_1_step') || '1-step: Direct')}
                    {selectedWarehouse.reception_steps === 2 && (t('reception_2_step') || '2-step: Input → Stock')}
                    {selectedWarehouse.reception_steps === 3 && (t('reception_3_step') || '3-step: Input → QC → Stock')}
                    {!selectedWarehouse.reception_steps && (t('reception_1_step') || '1-step: Direct')}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1 flex items-center gap-1">
                    <PackageCheck className="w-3 h-3" /> {t('delivery_steps') || 'Outgoing'}
                  </p>
                  <p className="text-sm font-medium text-purple-700">
                    {selectedWarehouse.delivery_steps === 1 && (t('delivery_1_step') || '1-step: Direct')}
                    {selectedWarehouse.delivery_steps === 2 && (t('delivery_2_step') || '2-step: Pick → Ship')}
                    {selectedWarehouse.delivery_steps === 3 && (t('delivery_3_step') || '3-step: Pick → Pack → Ship')}
                    {!selectedWarehouse.delivery_steps && (t('delivery_1_step') || '1-step: Direct')}
                  </p>
                </div>
                <div className="p-3 bg-cyan-50 rounded-lg">
                  <p className="text-xs text-cyan-600 mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {t('manufacturing_steps') || 'Manufacturing'}
                  </p>
                  <p className="text-sm font-medium text-cyan-700">
                    {selectedWarehouse.manufacturing_steps === 1 && (t('mfg_1_step') || '1-step: Simple')}
                    {selectedWarehouse.manufacturing_steps === 2 && (t('mfg_2_step') || '2-step: Pick → Produce')}
                    {selectedWarehouse.manufacturing_steps === 3 && (t('mfg_3_step') || '3-step: Pick → Produce → Store')}
                    {!selectedWarehouse.manufacturing_steps && (t('mfg_1_step') || '1-step: Simple')}
                  </p>
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
                  <Edit className="w-4 h-4 mr-2" /> {t('edit')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1"
                >
                  {t('close')}
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
              {t('delete_warehouse')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('delete_warehouse_confirm')}{' '}
              <span className="font-semibold text-slate-900">"{selectedWarehouse?.name}"</span>?
              {t('action_cannot_be_undone')}
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  {t('delete_warehouse_warning')}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
