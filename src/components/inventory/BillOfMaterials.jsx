import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Layers, ChevronRight, ChevronDown, Edit2, Trash2,
  Package, Copy, FileText, Calculator, AlertTriangle, CheckCircle2,
  Settings, Eye, Wrench
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";

// BOM Types
const bomTypes = [
  { value: 'manufacturing', label: 'Manufacturing', description: 'For production/assembly' },
  { value: 'kit', label: 'Kit/Bundle', description: 'Sold as a set' },
  { value: 'phantom', label: 'Phantom/Subassembly', description: 'Intermediate assembly' },
];

export default function BillOfMaterials() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    products = [],
    boms = [],
    bomLines = [],
    createBOM,
    updateBOM,
    deleteBOM,
    createBOMLine,
    updateBOMLine,
    deleteBOMLine,
    getBOMLinesByBOM,
    calculateBOMCost,
    isLoading
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLinesModal, setShowLinesModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState(null);
  const [expandedBOMs, setExpandedBOMs] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    code: '',
    type: 'manufacturing',
    quantity: 1,
    description: '',
    is_active: true,
  });

  const [lineFormData, setLineFormData] = useState({
    component_id: '',
    quantity: 1,
    uom: 'pcs',
    notes: '',
  });

  // Filter BOMs
  const filteredBOMs = useMemo(() => {
    return boms.filter(bom => {
      const matchesSearch = !searchQuery ||
        bom.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bom.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        products.find(p => p.id === bom.product_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || bom.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [boms, searchQuery, typeFilter, products]);

  // Calculate stats
  const stats = useMemo(() => {
    const active = boms.filter(b => b.is_active).length;
    const manufacturing = boms.filter(b => b.type === 'manufacturing').length;
    const kits = boms.filter(b => b.type === 'kit').length;
    return { total: boms.length, active, manufacturing, kits };
  }, [boms]);

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? `${product.sku || ''} - ${product.name}` : 'Unknown';
  };

  const getProductInfo = (productId) => {
    return products.find(p => p.id === productId);
  };

  const handleCreate = async () => {
    if (!formData.product_id || !formData.name) return;
    setIsSaving(true);
    try {
      await createBOM({
        ...formData,
        quantity: parseFloat(formData.quantity) || 1,
      });
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating BOM:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedBOM) return;
    setIsSaving(true);
    try {
      await updateBOM(selectedBOM.id, {
        ...formData,
        quantity: parseFloat(formData.quantity) || 1,
      });
      setShowEditModal(false);
      setSelectedBOM(null);
      resetForm();
    } catch (error) {
      console.error('Error updating BOM:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirm_delete_bom') || 'Are you sure you want to delete this BOM?')) {
      await deleteBOM(id);
    }
  };

  const handleAddLine = async () => {
    if (!selectedBOM || !lineFormData.component_id) return;
    setIsSaving(true);
    try {
      await createBOMLine({
        bom_id: selectedBOM.id,
        ...lineFormData,
        quantity: parseFloat(lineFormData.quantity) || 1,
      });
      setLineFormData({ component_id: '', quantity: 1, uom: 'pcs', notes: '' });
    } catch (error) {
      console.error('Error adding BOM line:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLine = async (lineId) => {
    if (window.confirm(t('confirm_delete_line') || 'Delete this component?')) {
      await deleteBOMLine(lineId);
    }
  };

  const openEditModal = (bom) => {
    setSelectedBOM(bom);
    setFormData({
      product_id: bom.product_id || '',
      name: bom.name || '',
      code: bom.code || '',
      type: bom.type || 'manufacturing',
      quantity: bom.quantity || 1,
      description: bom.description || '',
      is_active: bom.is_active !== false,
    });
    setShowEditModal(true);
  };

  const openLinesModal = (bom) => {
    setSelectedBOM(bom);
    setShowLinesModal(true);
  };

  const openCostModal = (bom) => {
    setSelectedBOM(bom);
    setShowCostModal(true);
  };

  const resetForm = () => {
    setFormData({
      product_id: '',
      name: '',
      code: '',
      type: 'manufacturing',
      quantity: 1,
      description: '',
      is_active: true,
    });
  };

  const toggleExpand = (bomId) => {
    const newExpanded = new Set(expandedBOMs);
    if (newExpanded.has(bomId)) {
      newExpanded.delete(bomId);
    } else {
      newExpanded.add(bomId);
    }
    setExpandedBOMs(newExpanded);
  };

  const getBOMLines = (bomId) => {
    return bomLines.filter(l => l.bom_id === bomId);
  };

  const calculateTotalCost = (bom) => {
    const lines = getBOMLines(bom.id);
    return lines.reduce((total, line) => {
      const product = getProductInfo(line.component_id);
      const cost = product?.cost_price || 0;
      return total + (cost * line.quantity);
    }, 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'decimal', minimumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">{t('total_boms') || 'Total BOMs'}</p>
                <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
              </div>
              <Layers className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">{t('active') || 'Active'}</p>
                <p className="text-2xl font-bold text-green-800">{stats.active}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">{t('manufacturing') || 'Manufacturing'}</p>
                <p className="text-2xl font-bold text-purple-800">{stats.manufacturing}</p>
              </div>
              <Wrench className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">{t('kits') || 'Kits/Bundles'}</p>
                <p className="text-2xl font-bold text-orange-800">{stats.kits}</p>
              </div>
              <Package className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('bill_of_materials') || 'Bill of Materials'}
            </CardTitle>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('create_bom') || 'Create BOM'}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t('search_bom') || 'Search BOMs...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('filter_by_type') || 'Filter by type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_types') || 'All Types'}</SelectItem>
                {bomTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--genix-blue)]" />
            </div>
          ) : filteredBOMs.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">{t('no_boms') || 'No Bill of Materials found'}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                {t('create_first_bom') || 'Create your first BOM'}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{t('code') || 'Code'}</TableHead>
                    <TableHead>{t('product') || 'Product'}</TableHead>
                    <TableHead>{t('name') || 'Name'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead className="text-right">{t('quantity') || 'Qty'}</TableHead>
                    <TableHead className="text-right">{t('components') || 'Components'}</TableHead>
                    <TableHead className="text-right">{t('cost') || 'Cost'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBOMs.map(bom => {
                    const lines = getBOMLines(bom.id);
                    const isExpanded = expandedBOMs.has(bom.id);
                    const totalCost = calculateTotalCost(bom);
                    const product = getProductInfo(bom.product_id);

                    return (
                      <React.Fragment key={bom.id}>
                        <TableRow className="hover:bg-slate-50">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(bom.id)}
                              disabled={lines.length === 0}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{bom.code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span className="font-medium">{product?.name || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{bom.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              bom.type === 'manufacturing' ? 'border-purple-300 text-purple-700' :
                              bom.type === 'kit' ? 'border-orange-300 text-orange-700' :
                              'border-slate-300 text-slate-700'
                            }>
                              {bomTypes.find(t => t.value === bom.type)?.label || bom.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{bom.quantity}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{lines.length}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(totalCost)} {t('uzs') || "so'm"}
                          </TableCell>
                          <TableCell>
                            <Badge className={bom.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
                              {bom.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openLinesModal(bom)}
                                title={t('manage_components') || 'Manage Components'}
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCostModal(bom)}
                                title={t('view_cost') || 'View Cost'}
                              >
                                <Calculator className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(bom)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(bom.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Components */}
                        {isExpanded && lines.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-slate-50 p-0">
                              <div className="p-4 pl-12">
                                <p className="text-sm font-medium text-slate-600 mb-2">
                                  {t('components') || 'Components'}:
                                </p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t('component') || 'Component'}</TableHead>
                                      <TableHead className="text-right">{t('quantity') || 'Qty'}</TableHead>
                                      <TableHead>{t('uom') || 'UoM'}</TableHead>
                                      <TableHead className="text-right">{t('unit_cost') || 'Unit Cost'}</TableHead>
                                      <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {lines.map(line => {
                                      const comp = getProductInfo(line.component_id);
                                      const lineCost = (comp?.cost_price || 0) * line.quantity;
                                      return (
                                        <TableRow key={line.id}>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Package className="w-4 h-4 text-slate-400" />
                                              {comp?.name || 'Unknown'}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right">{line.quantity}</TableCell>
                                          <TableCell>{line.uom}</TableCell>
                                          <TableCell className="text-right">
                                            {formatCurrency(comp?.cost_price || 0)}
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency(lineCost)}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create BOM Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create_bom') || 'Create Bill of Materials'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('product') || 'Product'} *
              </label>
              <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product') || 'Select product'} />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.product_type !== 'service').map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.sku && `${product.sku} - `}{product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('bom_code') || 'BOM Code'} *
                </label>
                <Input
                  placeholder="e.g., BOM-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('quantity') || 'Quantity'} *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('bom_name') || 'BOM Name'} *
              </label>
              <Input
                placeholder={t('bom_name_placeholder') || 'e.g., Standard Assembly'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('bom_type') || 'BOM Type'} *
              </label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bomTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <span className="font-medium">{type.label}</span>
                        <span className="text-slate-500 text-xs ml-2">({type.description})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('description') || 'Description'}
              </label>
              <Textarea
                placeholder={t('optional_description') || 'Optional description'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.product_id || !formData.name || !formData.code}
            >
              {isSaving ? (t('saving') || 'Saving...') : (t('create') || 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit BOM Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_bom') || 'Edit Bill of Materials'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('product') || 'Product'}
              </label>
              <Input value={getProductName(formData.product_id)} disabled className="bg-slate-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('bom_code') || 'BOM Code'}
                </label>
                <Input value={formData.code} disabled className="bg-slate-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('quantity') || 'Quantity'} *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('bom_name') || 'BOM Name'} *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('bom_type') || 'BOM Type'} *
              </label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bomTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('description') || 'Description'}
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm text-slate-700">
                {t('is_active') || 'Active'}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleEdit}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.name}
            >
              {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Components Modal */}
      <Dialog open={showLinesModal} onOpenChange={setShowLinesModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('manage_components') || 'Manage Components'} - {selectedBOM?.name}
            </DialogTitle>
            <DialogDescription>
              {t('add_components_desc') || 'Add and manage components that make up this product'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add Component Form */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium text-slate-700">{t('add_component') || 'Add Component'}</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Select
                    value={lineFormData.component_id}
                    onValueChange={(v) => setLineFormData({ ...lineFormData, component_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_component') || 'Select component'} />
                    </SelectTrigger>
                    <SelectContent>
                      {products
                        .filter(p => p.id !== selectedBOM?.product_id)
                        .map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.sku && `${product.sku} - `}{product.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={t('quantity') || 'Qty'}
                    value={lineFormData.quantity}
                    onChange={(e) => setLineFormData({ ...lineFormData, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Button
                    onClick={handleAddLine}
                    disabled={!lineFormData.component_id || isSaving}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('add') || 'Add'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Components List */}
            {selectedBOM && (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('component') || 'Component'}</TableHead>
                      <TableHead className="text-right">{t('quantity') || 'Qty'}</TableHead>
                      <TableHead>{t('uom') || 'UoM'}</TableHead>
                      <TableHead className="text-right">{t('unit_cost') || 'Unit Cost'}</TableHead>
                      <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getBOMLines(selectedBOM.id).map(line => {
                      const comp = getProductInfo(line.component_id);
                      const lineCost = (comp?.cost_price || 0) * line.quantity;
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="font-medium">{comp?.name || 'Unknown'}</p>
                                {comp?.sku && <p className="text-xs text-slate-500">{comp.sku}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell>{line.uom}</TableCell>
                          <TableCell className="text-right">{formatCurrency(comp?.cost_price || 0)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(lineCost)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLine(line.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {getBOMLines(selectedBOM.id).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          {t('no_components') || 'No components added yet'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {getBOMLines(selectedBOM.id).length > 0 && (
                  <div className="flex justify-end mt-4 p-3 bg-slate-100 rounded-lg">
                    <div className="text-right">
                      <p className="text-sm text-slate-600">{t('total_cost') || 'Total Cost'}:</p>
                      <p className="text-xl font-bold text-slate-900">
                        {formatCurrency(calculateTotalCost(selectedBOM))} {t('uzs') || "so'm"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinesModal(false)}>
              {t('close') || 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cost Breakdown Modal */}
      <Dialog open={showCostModal} onOpenChange={setShowCostModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('cost_breakdown') || 'Cost Breakdown'} - {selectedBOM?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedBOM && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">{t('finished_product') || 'Finished Product'}</p>
                    <p className="text-lg font-bold text-blue-900">
                      {getProductInfo(selectedBOM.product_id)?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-600">{t('produces') || 'Produces'}</p>
                    <p className="text-lg font-bold text-blue-900">{selectedBOM.quantity} {t('units') || 'units'}</p>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('component') || 'Component'}</TableHead>
                    <TableHead className="text-right">{t('quantity') || 'Qty'}</TableHead>
                    <TableHead className="text-right">{t('unit_cost') || 'Unit Cost'}</TableHead>
                    <TableHead className="text-right">{t('extended_cost') || 'Extended'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getBOMLines(selectedBOM.id).map(line => {
                    const comp = getProductInfo(line.component_id);
                    const lineCost = (comp?.cost_price || 0) * line.quantity;
                    return (
                      <TableRow key={line.id}>
                        <TableCell>{comp?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(comp?.cost_price || 0)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(lineCost)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-lg">
                  <span className="font-medium">{t('total_material_cost') || 'Total Material Cost'}:</span>
                  <span className="font-bold">{formatCurrency(calculateTotalCost(selectedBOM))} {t('uzs') || "so'm"}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t('cost_per_unit') || 'Cost per Unit'}:</span>
                  <span className="font-medium">
                    {formatCurrency(calculateTotalCost(selectedBOM) / (selectedBOM.quantity || 1))} {t('uzs') || "so'm"}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCostModal(false)}>
              {t('close') || 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
