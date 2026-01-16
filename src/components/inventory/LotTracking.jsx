import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, Calendar, AlertTriangle, Clock, CheckCircle,
  Warehouse, Tag, Hash, Layers, TrendingDown, ChevronDown, ChevronRight,
  FileText, Barcode, Eye, Edit, Trash2, MoreHorizontal, Shield, Globe,
  Award, FileCheck, ClipboardCheck, QrCode, Beaker
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, differenceInDays } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";

// SAP Quality Status options
const qualityStatuses = [
  { value: 'released', label: 'Released', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'in_qc', label: 'In QC', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'quarantine', label: 'Quarantine', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'rejected', label: 'Rejected', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

// Lot grades (SAP)
const lotGrades = [
  { value: 'A', label: 'Grade A (Premium)' },
  { value: 'B', label: 'Grade B (Standard)' },
  { value: 'C', label: 'Grade C (Economy)' },
  { value: 'X', label: 'Grade X (Defective)' },
];

export default function LotTracking() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    lots,
    products,
    warehouses,
    createLot,
    updateLot,
    deleteLot,
    getProductLots,
    getExpiringLots,
    isLoading
  } = useInventory();

  const [filteredLots, setFilteredLots] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [expandedLots, setExpandedLots] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [newLot, setNewLot] = useState({
    lot_number: '',
    product_id: '',
    warehouse_id: '',
    quantity: '',
    unit_cost: '',
    manufacture_date: '',
    expiry_date: '',
    supplier: '',
    received_date: new Date().toISOString().split('T')[0],
    serial_numbers: '',
    // SAP/Odoo Quality Management
    quality_status: 'released', // released, blocked, in_qc, quarantine, rejected
    // GS1 Standards
    gtin: '', // Global Trade Item Number
    gs1_batch: '', // GS1-128 batch code
    // Lot Attributes (SAP)
    lot_grade: '', // A, B, C grades
    lot_color: '',
    lot_size: '',
    // Certificate tracking (SAP QM)
    certificate_of_analysis: '', // COA document URL
    test_results: '',
    inspection_date: '',
    inspector_name: '',
    // Country of origin (important for compliance)
    country_of_origin: ''
  });

  // Calculate summaries
  const summary = {
    totalLots: lots.filter(l => l.status === 'active').length,
    expiringLots: getExpiringLots(30).length,
    totalValue: lots.filter(l => l.status === 'active').reduce((sum, l) => sum + (l.quantity * l.unit_cost), 0),
    lowStockLots: lots.filter(l => l.status === 'active' && l.quantity < l.original_quantity * 0.2).length
  };

  useEffect(() => {
    let filtered = [...lots];

    if (searchQuery) {
      filtered = filtered.filter(lot =>
        lot.lot_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        products.find(p => p.id === lot.product_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(lot => lot.status === statusFilter);
    }

    if (productFilter !== "all") {
      filtered = filtered.filter(lot => lot.product_id === productFilter);
    }

    setFilteredLots(filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  }, [lots, searchQuery, statusFilter, productFilter, products]);

  const handleCreateLot = async () => {
    setIsSaving(true);
    try {
      const serialNumbers = newLot.serial_numbers
        ? newLot.serial_numbers.split(',').map(s => s.trim()).filter(s => s)
        : [];

      await createLot({
        ...newLot,
        quantity: parseInt(newLot.quantity) || 0,
        unit_cost: parseFloat(newLot.unit_cost) || 0,
        serial_numbers: serialNumbers
      });

      setNewLot({
        lot_number: '',
        product_id: '',
        warehouse_id: '',
        quantity: '',
        unit_cost: '',
        manufacture_date: '',
        expiry_date: '',
        supplier: '',
        received_date: new Date().toISOString().split('T')[0],
        serial_numbers: ''
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating lot:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return { status: 'expired', label: t('expired'), color: 'bg-red-100 text-red-700' };
    if (days <= 30) return { status: 'expiring', label: `${days} ${t('days_left')}`, color: 'bg-orange-100 text-orange-700' };
    if (days <= 90) return { status: 'soon', label: `${days} ${t('days')}`, color: 'bg-yellow-100 text-yellow-700' };
    return { status: 'ok', label: `${days} ${t('days')}`, color: 'bg-green-100 text-green-700' };
  };

  const toggleLotExpand = (lotId) => {
    setExpandedLots(prev => ({ ...prev, [lotId]: !prev[lotId] }));
  };

  const handleViewLot = (lot) => {
    setSelectedLot(lot);
    setShowViewModal(true);
  };

  const handleEditLot = (lot) => {
    setSelectedLot(lot);
    setNewLot({
      lot_number: lot.lot_number || '',
      product_id: lot.product_id || '',
      warehouse_id: lot.warehouse_id || '',
      quantity: lot.quantity?.toString() || '',
      unit_cost: lot.unit_cost?.toString() || '',
      manufacture_date: lot.manufacture_date || '',
      expiry_date: lot.expiry_date || '',
      supplier: lot.supplier || '',
      received_date: lot.received_date || '',
      serial_numbers: lot.serial_numbers?.join(', ') || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateLot = async () => {
    if (!selectedLot) return;
    setIsSaving(true);
    try {
      const serialNumbers = newLot.serial_numbers
        ? newLot.serial_numbers.split(',').map(s => s.trim()).filter(s => s)
        : [];

      await updateLot(selectedLot.id, {
        lot_number: newLot.lot_number,
        product_id: newLot.product_id,
        warehouse_id: newLot.warehouse_id,
        quantity: parseInt(newLot.quantity) || 0,
        unit_cost: parseFloat(newLot.unit_cost) || 0,
        manufacture_date: newLot.manufacture_date,
        expiry_date: newLot.expiry_date,
        supplier: newLot.supplier,
        received_date: newLot.received_date,
        serial_numbers: serialNumbers
      });

      setShowEditModal(false);
      setSelectedLot(null);
    } catch (err) {
      console.error('Error updating lot:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLot = async () => {
    if (!selectedLot) return;
    setIsSaving(true);
    try {
      await deleteLot(selectedLot.id);
      setShowDeleteModal(false);
      setSelectedLot(null);
    } catch (err) {
      console.error('Error deleting lot:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const expiringLots = getExpiringLots(30);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">{t('active_lots')}</p>
                <p className="text-2xl font-bold text-blue-800">{summary.totalLots}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Layers className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">{t('expiring_soon')}</p>
                <p className="text-2xl font-bold text-orange-800">{summary.expiringLots}</p>
                <p className="text-xs text-orange-500">{t('within_30_days')}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">{t('total_value')}</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(summary.totalValue)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">{t('low_stock')}</p>
                <p className="text-2xl font-bold text-red-800">{summary.lowStockLots}</p>
                <p className="text-xs text-red-500">{t('less_than_20_percent')}</p>
              </div>
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Lots Alert */}
      {expiringLots.length > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-700 flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5" />
              {t('expiring_lots')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringLots.slice(0, 5).map(lot => (
                <div key={lot.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">{lot.lot_number}</Badge>
                    <span className="font-medium">{lot.product?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{lot.quantity} {t('units')}</span>
                    <Badge className={lot.daysUntilExpiry <= 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                      {lot.daysUntilExpiry <= 0 ? t('expired') : `${lot.daysUntilExpiry} ${t('days_left')}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('search_lots')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="depleted">{t('depleted')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('product')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_products')}</SelectItem>
              {products.filter(p => p.is_stockable).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('new_lot')}
        </Button>
      </div>

      {/* Lots Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-8"></TableHead>
                <TableHead>{t('lot_number')}</TableHead>
                <TableHead>{t('product')}</TableHead>
                <TableHead>{t('warehouse')}</TableHead>
                <TableHead>{t('quantity')}</TableHead>
                <TableHead>{t('unit_cost')}</TableHead>
                <TableHead>{t('received_date')}</TableHead>
                <TableHead>{t('expiry')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLots.map((lot) => {
                const product = products.find(p => p.id === lot.product_id);
                const warehouse = warehouses.find(w => w.id === lot.warehouse_id);
                const expiryStatus = getExpiryStatus(lot.expiry_date);
                const isExpanded = expandedLots[lot.id];

                return (
                  <React.Fragment key={lot.id}>
                    <TableRow className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleLotExpand(lot.id)}>
                      <TableCell className="w-8">
                        {lot.serial_numbers?.length > 0 && (
                          isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-medium">{lot.lot_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          {product?.name || t('unknown')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Warehouse className="w-4 h-4 text-slate-400" />
                          {warehouse?.name || t('unknown')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{lot.quantity}</span>
                          <span className="text-slate-400 text-sm">/ {lot.original_quantity}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(lot.unit_cost)}</TableCell>
                      <TableCell>{lot.received_date ? format(new Date(lot.received_date), 'dd.MM.yyyy') : '-'}</TableCell>
                      <TableCell>
                        {expiryStatus ? (
                          <Badge className={expiryStatus.color}>{expiryStatus.label}</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={lot.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {lot.status === 'active' ? t('active') : t('depleted')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewLot(lot)}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('view')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditLot(lot)}>
                              <Edit className="w-4 h-4 mr-2" />
                              {t('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedLot(lot);
                                setShowDeleteModal(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && lot.serial_numbers?.length > 0 && (
                      <TableRow className="bg-slate-50">
                        <TableCell colSpan={10} className="py-3">
                          <div className="pl-8">
                            <p className="text-sm font-medium text-slate-600 mb-2">{t('serial_numbers')}:</p>
                            <div className="flex flex-wrap gap-2">
                              {lot.serial_numbers.map((sn, idx) => (
                                <Badge key={idx} variant="outline" className="font-mono">
                                  <Barcode className="w-3 h-3 mr-1" />
                                  {sn}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredLots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    {t('no_lots_found')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Lot Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('create_new_lot')}</DialogTitle>
            <DialogDescription>{t('enter_lot_details')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
            {/* Basic Information */}
            <div className="p-3 bg-slate-50 rounded-lg border">
              <p className="text-xs font-medium text-slate-600 mb-3 flex items-center gap-1">
                <Package className="w-3 h-3" /> {t('basic_information') || 'Basic Information'}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('lot_number')} *</label>
                  <Input
                    value={newLot.lot_number}
                    onChange={(e) => setNewLot({ ...newLot, lot_number: e.target.value })}
                    placeholder="LOT-2025-001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('received_date')}</label>
                  <Input
                    type="date"
                    value={newLot.received_date}
                    onChange={(e) => setNewLot({ ...newLot, received_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('quality_status') || 'Quality Status'}</label>
                  <Select
                    value={newLot.quality_status}
                    onValueChange={(v) => setNewLot({ ...newLot, quality_status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {qualityStatuses.map(qs => (
                        <SelectItem key={qs.value} value={qs.value}>
                          <Badge className={qs.color}>{qs.label}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-sm font-medium">{t('product')} *</label>
                  <Select
                    value={newLot.product_id}
                    onValueChange={(v) => setNewLot({ ...newLot, product_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_product')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.is_stockable).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('warehouse')} *</label>
                  <Select
                    value={newLot.warehouse_id}
                    onValueChange={(v) => setNewLot({ ...newLot, warehouse_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_warehouse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-sm font-medium">{t('quantity')} *</label>
                  <Input
                    type="number"
                    value={newLot.quantity}
                    onChange={(e) => setNewLot({ ...newLot, quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('unit_cost')}</label>
                  <Input
                    type="number"
                    value={newLot.unit_cost}
                    onChange={(e) => setNewLot({ ...newLot, unit_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* GS1 Standards Section */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-700 mb-3 flex items-center gap-1">
                <QrCode className="w-3 h-3" /> {t('gs1_standards') || 'GS1 Standards'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('gtin') || 'GTIN (Barcode)'}</label>
                  <Input
                    value={newLot.gtin}
                    onChange={(e) => setNewLot({ ...newLot, gtin: e.target.value })}
                    placeholder="e.g., 01234567890123"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('gs1_batch') || 'GS1-128 Batch'}</label>
                  <Input
                    value={newLot.gs1_batch}
                    onChange={(e) => setNewLot({ ...newLot, gs1_batch: e.target.value })}
                    placeholder="e.g., 10ABC123"
                  />
                </div>
              </div>
            </div>

            {/* Lot Attributes (SAP) */}
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs font-medium text-purple-700 mb-3 flex items-center gap-1">
                <Award className="w-3 h-3" /> {t('lot_attributes') || 'Lot Attributes'} (SAP)
              </p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('grade') || 'Grade'}</label>
                  <Select
                    value={newLot.lot_grade || '__none__'}
                    onValueChange={(v) => setNewLot({ ...newLot, lot_grade: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select') || 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('none') || 'None'}</SelectItem>
                      {lotGrades.map(g => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('color') || 'Color'}</label>
                  <Input
                    value={newLot.lot_color}
                    onChange={(e) => setNewLot({ ...newLot, lot_color: e.target.value })}
                    placeholder="e.g., Red"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('size') || 'Size'}</label>
                  <Input
                    value={newLot.lot_size}
                    onChange={(e) => setNewLot({ ...newLot, lot_size: e.target.value })}
                    placeholder="e.g., Large"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('country_of_origin') || 'Origin'}</label>
                  <Input
                    value={newLot.country_of_origin}
                    onChange={(e) => setNewLot({ ...newLot, country_of_origin: e.target.value })}
                    placeholder="e.g., USA"
                  />
                </div>
              </div>
            </div>

            {/* Dates Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('manufacture_date')}</label>
                <Input
                  type="date"
                  value={newLot.manufacture_date}
                  onChange={(e) => setNewLot({ ...newLot, manufacture_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('expiry_date')}</label>
                <Input
                  type="date"
                  value={newLot.expiry_date}
                  onChange={(e) => setNewLot({ ...newLot, expiry_date: e.target.value })}
                />
              </div>
            </div>

            {/* Certificate Tracking (SAP QM) */}
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-medium text-green-700 mb-3 flex items-center gap-1">
                <FileCheck className="w-3 h-3" /> {t('certificate_tracking') || 'Certificate Tracking'} (QM)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('coa_url') || 'Certificate of Analysis URL'}</label>
                  <Input
                    value={newLot.certificate_of_analysis}
                    onChange={(e) => setNewLot({ ...newLot, certificate_of_analysis: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('test_results') || 'Test Results'}</label>
                  <Input
                    value={newLot.test_results}
                    onChange={(e) => setNewLot({ ...newLot, test_results: e.target.value })}
                    placeholder={t('test_results_placeholder') || 'Pass/Fail or details'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-sm font-medium">{t('inspection_date') || 'Inspection Date'}</label>
                  <Input
                    type="date"
                    value={newLot.inspection_date}
                    onChange={(e) => setNewLot({ ...newLot, inspection_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('inspector_name') || 'Inspector Name'}</label>
                  <Input
                    value={newLot.inspector_name}
                    onChange={(e) => setNewLot({ ...newLot, inspector_name: e.target.value })}
                    placeholder={t('inspector_name_placeholder') || 'Name of inspector'}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('supplier')}</label>
              <Input
                value={newLot.supplier}
                onChange={(e) => setNewLot({ ...newLot, supplier: e.target.value })}
                placeholder={t('supplier_name_placeholder')}
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('serial_numbers_comma_separated')}</label>
              <Input
                value={newLot.serial_numbers}
                onChange={(e) => setNewLot({ ...newLot, serial_numbers: e.target.value })}
                placeholder="SN-001, SN-002, SN-003"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('cancel')}</Button>
              <Button
                onClick={handleCreateLot}
                disabled={isSaving || !newLot.product_id || !newLot.warehouse_id || !newLot.quantity}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Lot Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('lot_details')}
            </DialogTitle>
          </DialogHeader>
          {selectedLot && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('lot_number')}</p>
                  <p className="font-mono font-semibold">{selectedLot.lot_number}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('status')}</p>
                  <Badge className={selectedLot.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {selectedLot.status === 'active' ? t('active') : t('depleted')}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('product')}</p>
                  <p className="font-medium">{products.find(p => p.id === selectedLot.product_id)?.name || t('unknown')}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('warehouse')}</p>
                  <p className="font-medium">{warehouses.find(w => w.id === selectedLot.warehouse_id)?.name || t('unknown')}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('quantity')}</p>
                  <p className="font-semibold">{selectedLot.quantity} / {selectedLot.original_quantity}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('unit_cost')}</p>
                  <p className="font-semibold">{formatCurrency(selectedLot.unit_cost)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('total_value')}</p>
                  <p className="font-semibold">{formatCurrency(selectedLot.quantity * selectedLot.unit_cost)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('received_date')}</p>
                  <p className="font-medium">{selectedLot.received_date ? format(new Date(selectedLot.received_date), 'dd.MM.yyyy') : '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('manufacture_date')}</p>
                  <p className="font-medium">{selectedLot.manufacture_date ? format(new Date(selectedLot.manufacture_date), 'dd.MM.yyyy') : '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('expiry_date')}</p>
                  <p className="font-medium">{selectedLot.expiry_date ? format(new Date(selectedLot.expiry_date), 'dd.MM.yyyy') : '-'}</p>
                </div>
              </div>

              {selectedLot.supplier && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('supplier')}</p>
                  <p className="font-medium">{selectedLot.supplier}</p>
                </div>
              )}

              {selectedLot.serial_numbers?.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-2">{t('serial_numbers')}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLot.serial_numbers.map((sn, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono">
                        <Barcode className="w-3 h-3 mr-1" />
                        {sn}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                  {t('close')}
                </Button>
                <Button onClick={() => { setShowViewModal(false); handleEditLot(selectedLot); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  {t('edit')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lot Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('edit_lot')}</DialogTitle>
            <DialogDescription>{t('update_lot_details')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('lot_number')}</label>
                <Input
                  value={newLot.lot_number}
                  onChange={(e) => setNewLot({ ...newLot, lot_number: e.target.value })}
                  placeholder="LOT-2025-001"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('received_date')}</label>
                <Input
                  type="date"
                  value={newLot.received_date}
                  onChange={(e) => setNewLot({ ...newLot, received_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('product')}</label>
              <Select
                value={newLot.product_id}
                onValueChange={(v) => setNewLot({ ...newLot, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product')} />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.is_stockable).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">{t('warehouse')}</label>
              <Select
                value={newLot.warehouse_id}
                onValueChange={(v) => setNewLot({ ...newLot, warehouse_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_warehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('quantity')}</label>
                <Input
                  type="number"
                  value={newLot.quantity}
                  onChange={(e) => setNewLot({ ...newLot, quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('unit_cost')}</label>
                <Input
                  type="number"
                  value={newLot.unit_cost}
                  onChange={(e) => setNewLot({ ...newLot, unit_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('manufacture_date')}</label>
                <Input
                  type="date"
                  value={newLot.manufacture_date}
                  onChange={(e) => setNewLot({ ...newLot, manufacture_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('expiry_date')}</label>
                <Input
                  type="date"
                  value={newLot.expiry_date}
                  onChange={(e) => setNewLot({ ...newLot, expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('supplier')}</label>
              <Input
                value={newLot.supplier}
                onChange={(e) => setNewLot({ ...newLot, supplier: e.target.value })}
                placeholder={t('supplier_name_placeholder')}
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('serial_numbers_comma_separated')}</label>
              <Input
                value={newLot.serial_numbers}
                onChange={(e) => setNewLot({ ...newLot, serial_numbers: e.target.value })}
                placeholder="SN-001, SN-002, SN-003"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>{t('cancel')}</Button>
              <Button
                onClick={handleUpdateLot}
                disabled={isSaving || !newLot.product_id || !newLot.warehouse_id || !newLot.quantity}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? t('saving') : t('update')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">{t('delete_lot')}</DialogTitle>
            <DialogDescription>
              {t('delete_lot_confirmation')}
            </DialogDescription>
          </DialogHeader>
          {selectedLot && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {t('lot_number')}: <strong>{selectedLot.lot_number}</strong>
                </p>
                <p className="text-sm text-red-600 mt-1">
                  {t('this_action_cannot_be_undone')}
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteLot}
                  disabled={isSaving}
                >
                  {isSaving ? t('deleting') : t('delete')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
