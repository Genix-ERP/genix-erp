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
  Settings, Eye, Wrench, Calendar, GitBranch, Clock, Cog, Factory,
  Timer, Users, ArrowRight, HelpCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";

// Field Help Component - Odoo-style tooltip for field explanations
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
const LabelWithHelp = ({ label, helpText, required, className = "" }) => (
  <label className={`text-sm font-medium text-slate-700 mb-1 flex items-center ${className}`}>
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

// BOM Types
const bomTypes = [
  { value: 'manufacturing', label: 'Manufacturing', description: 'For production/assembly' },
  { value: 'kit', label: 'Kit/Bundle', description: 'Sold as a set' },
  { value: 'phantom', label: 'Phantom/Subassembly', description: 'Intermediate assembly' },
];

// SAP BOM Status
const bomStatuses = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'pending_approval', label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-700' },
  { value: 'obsolete', label: 'Obsolete', color: 'bg-red-100 text-red-700' },
];

// SAP Work Center Types
const workCenterTypes = [
  { value: 'machine', label: 'Machine' },
  { value: 'labor', label: 'Labor' },
  { value: 'subcontracting', label: 'Subcontracting' },
  { value: 'overhead', label: 'Overhead' },
];

// Odoo Operation Types
const operationTypes = [
  { value: 'assembly', label: 'Assembly' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'welding', label: 'Welding' },
  { value: 'painting', label: 'Painting' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'testing', label: 'Quality Testing' },
  { value: 'other', label: 'Other' },
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
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

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
    // SAP Version Control
    version: '1.0',
    revision: 0,
    status: 'draft', // draft, pending_approval, approved, obsolete
    // SAP Effectivity Dates
    effective_from: '',
    effective_to: '',
    // SAP Alternative BOM
    is_alternative: false,
    alternative_priority: 1,
    // Routing/Operations (Odoo Manufacturing)
    has_routing: false,
    default_work_center: '',
    total_operation_time: 0, // minutes
    // By-products support
    has_byproducts: false,
    // Approval workflow
    created_by: '',
    approved_by: '',
    approval_date: '',
  });

  const [lineFormData, setLineFormData] = useState({
    component_id: '',
    quantity: 1,
    uom: 'pcs',
    notes: '',
    // SAP-style operation sequence
    operation_sequence: 10,
    // Alternative component (SAP)
    is_alternative: false,
    alternative_group: '',
    // Scrap factor
    scrap_percentage: 0,
  });

  // Operations state for routing
  const [operations, setOperations] = useState([]);
  const [showOperationsModal, setShowOperationsModal] = useState(false);
  const [operationForm, setOperationForm] = useState({
    sequence: 10,
    name: '',
    operation_type: 'assembly',
    work_center_type: 'labor',
    work_center: '',
    setup_time: 0, // minutes
    run_time: 0, // minutes per unit
    queue_time: 0, // minutes
    description: '',
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
      version: '1.0',
      revision: 0,
      status: 'draft',
      effective_from: '',
      effective_to: '',
      is_alternative: false,
      alternative_priority: 1,
      has_routing: false,
      default_work_center: '',
      total_operation_time: 0,
      has_byproducts: false,
      created_by: '',
      approved_by: '',
      approval_date: '',
    });
    setOperations([]);
  };

  // Add operation to routing
  const handleAddOperation = () => {
    const newOp = {
      ...operationForm,
      id: `op-${Date.now()}`,
      sequence: operations.length > 0 ? Math.max(...operations.map(o => o.sequence)) + 10 : 10,
    };
    setOperations([...operations, newOp].sort((a, b) => a.sequence - b.sequence));
    setOperationForm({
      sequence: newOp.sequence + 10,
      name: '',
      operation_type: 'assembly',
      work_center_type: 'labor',
      work_center: '',
      setup_time: 0,
      run_time: 0,
      queue_time: 0,
      description: '',
    });
  };

  // Remove operation
  const handleRemoveOperation = (opId) => {
    setOperations(operations.filter(o => o.id !== opId));
  };

  // Calculate total operation time
  const calculateTotalOperationTime = () => {
    return operations.reduce((total, op) => total + op.setup_time + op.run_time + op.queue_time, 0);
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
            {canCreate(MODULES.INVENTORY) && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('create_bom') || 'Create BOM'}
              </Button>
            )}
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
                              {canUpdate(MODULES.INVENTORY) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(bom)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              {canDelete(MODULES.INVENTORY) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(bom.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create_bom') || 'Create Bill of Materials'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <LabelWithHelp
                  label={t('product') || 'Product'}
                  required
                  helpText={t('help_bom_product') || "Tayyor mahsulot. BOM bu mahsulotni ishlab chiqarish uchun kerakli komponentlarni belgilaydi."}
                />
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
              <div>
                <LabelWithHelp
                  label={t('bom_type') || 'BOM Type'}
                  required
                  helpText={t('help_bom_type') || "BOM turi: Manufacturing - ishlab chiqarish, Kit - to'plam sifatida sotish, Phantom - oraliq yig'ish."}
                />
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bomTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="font-medium">{type.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <LabelWithHelp
                  label={t('bom_code') || 'BOM Code'}
                  required
                  helpText={t('help_bom_code') || "BOM kodi. Tizimda noyob identifikator sifatida ishlatiladi."}
                />
                <Input
                  placeholder="e.g., BOM-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <LabelWithHelp
                  label={t('bom_name') || 'BOM Name'}
                  required
                  helpText={t('help_bom_name') || "BOM nomi. Hisobotlarda va ro'yxatlarda ko'rsatiladi."}
                />
                <Input
                  placeholder="e.g., Standard Assembly"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <LabelWithHelp
                  label={t('quantity') || 'Quantity'}
                  required
                  helpText={t('help_bom_quantity') || "Bir BOM orqali ishlab chiqariladigan tayyor mahsulot soni."}
                />
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
            </div>

            {/* SAP Version Control */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> {t('version_control') || 'Version Control'} (SAP)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">{t('version') || 'Version'}</label>
                  <Input
                    className="h-9"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="1.0"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">{t('revision') || 'Revision'}</label>
                  <Input
                    type="number"
                    className="h-9"
                    min="0"
                    value={formData.revision}
                    onChange={(e) => setFormData({ ...formData, revision: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">{t('status') || 'Status'}</label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bomStatuses.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <Badge className={s.color}>{s.label}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* SAP Effectivity Dates */}
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t('effectivity_dates') || 'Effectivity Dates'} (SAP)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">{t('effective_from') || 'Effective From'}</label>
                  <Input
                    type="date"
                    className="h-9"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">{t('effective_to') || 'Effective To'}</label>
                  <Input
                    type="date"
                    className="h-9"
                    value={formData.effective_to}
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Routing/Operations Toggle */}
            {formData.type === 'manufacturing' && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Factory className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-purple-700">{t('routing_operations') || 'Routing/Operations'}</p>
                      <p className="text-xs text-purple-600">{t('routing_desc') || 'Define manufacturing steps'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.has_routing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowOperationsModal(true)}
                      >
                        <Cog className="w-4 h-4 mr-1" />
                        {operations.length} {t('operations') || 'operations'}
                      </Button>
                    )}
                    <input
                      type="checkbox"
                      checked={formData.has_routing}
                      onChange={(e) => setFormData({ ...formData, has_routing: e.target.checked })}
                      className="rounded"
                    />
                  </div>
                </div>
                {formData.has_routing && operations.length > 0 && (
                  <div className="mt-3 p-2 bg-white rounded border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-700">{t('total_operation_time') || 'Total Operation Time'}:</span>
                      <span className="font-bold text-purple-900">{calculateTotalOperationTime()} {t('minutes') || 'min'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

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

      {/* Operations Modal */}
      <Dialog open={showOperationsModal} onOpenChange={setShowOperationsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-purple-600" />
              {t('routing_operations') || 'Routing/Operations'}
            </DialogTitle>
            <DialogDescription>
              {t('define_manufacturing_steps') || 'Define the manufacturing steps for this BOM'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add Operation Form */}
            <div className="p-3 bg-slate-50 rounded-lg border">
              <p className="text-sm font-medium mb-3">{t('add_operation') || 'Add Operation'}</p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium">{t('sequence') || 'Seq'}</label>
                  <Input
                    type="number"
                    className="h-9"
                    value={operationForm.sequence}
                    onChange={(e) => setOperationForm({ ...operationForm, sequence: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium">{t('operation_name') || 'Operation Name'}</label>
                  <Input
                    className="h-9"
                    value={operationForm.name}
                    onChange={(e) => setOperationForm({ ...operationForm, name: e.target.value })}
                    placeholder="e.g., Assembly Step 1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">{t('type') || 'Type'}</label>
                  <Select value={operationForm.operation_type} onValueChange={(v) => setOperationForm({ ...operationForm, operation_type: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operationTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3">
                <div>
                  <label className="text-xs font-medium">{t('work_center') || 'Work Center'}</label>
                  <Select value={operationForm.work_center_type} onValueChange={(v) => setOperationForm({ ...operationForm, work_center_type: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workCenterTypes.map(w => (
                        <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">{t('setup_time') || 'Setup (min)'}</label>
                  <Input
                    type="number"
                    className="h-9"
                    min="0"
                    value={operationForm.setup_time}
                    onChange={(e) => setOperationForm({ ...operationForm, setup_time: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">{t('run_time') || 'Run (min/unit)'}</label>
                  <Input
                    type="number"
                    className="h-9"
                    min="0"
                    value={operationForm.run_time}
                    onChange={(e) => setOperationForm({ ...operationForm, run_time: parseInt(e.target.value) || 0 })}
                  />
                </div>
                {canCreate(MODULES.INVENTORY) && (
                  <div>
                    <Button
                      onClick={handleAddOperation}
                      disabled={!operationForm.name}
                      className="w-full mt-5 h-9"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t('add') || 'Add'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Operations List */}
            {operations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t('seq') || 'Seq'}</TableHead>
                    <TableHead>{t('operation') || 'Operation'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead>{t('work_center') || 'Work Center'}</TableHead>
                    <TableHead className="text-right">{t('setup') || 'Setup'}</TableHead>
                    <TableHead className="text-right">{t('run') || 'Run'}</TableHead>
                    <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((op, index) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono">{op.sequence}</TableCell>
                      <TableCell className="font-medium">{op.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{operationTypes.find(t => t.value === op.operation_type)?.label}</Badge>
                      </TableCell>
                      <TableCell>{workCenterTypes.find(w => w.value === op.work_center_type)?.label}</TableCell>
                      <TableCell className="text-right">{op.setup_time} min</TableCell>
                      <TableCell className="text-right">{op.run_time} min</TableCell>
                      <TableCell className="text-right font-medium">{op.setup_time + op.run_time} min</TableCell>
                      <TableCell>
                        {canDelete(MODULES.INVENTORY) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOperation(op.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Factory className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>{t('no_operations') || 'No operations added yet'}</p>
              </div>
            )}

            {operations.length > 0 && (
              <div className="p-3 bg-purple-100 rounded-lg flex items-center justify-between">
                <span className="font-medium text-purple-800">{t('total_manufacturing_time') || 'Total Manufacturing Time'}:</span>
                <span className="text-xl font-bold text-purple-900">{calculateTotalOperationTime()} {t('minutes') || 'minutes'}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOperationsModal(false)}>
              {t('done') || 'Done'}
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
                {canCreate(MODULES.INVENTORY) && (
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
                )}
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
                            {canDelete(MODULES.INVENTORY) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteLine(line.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
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
