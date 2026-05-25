import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Package, Pencil, Trash2, MoreHorizontal,
  Barcode, PackagePlus, ArrowRightLeft, Truck, Store, Settings2,
  GripVertical, ChevronRight, Shield, Clock, FileText, ArrowDown
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { inventoryService, financeService } from '@/api/services';
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

// Step templates
const STEP_TEMPLATES = [
  {
    key: 'simple_receipt',
    label: 'Oddiy qabul',
    steps: [{ name: 'Qabul qilish', responsible_role: 'warehouse_worker' }]
  },
  {
    key: 'checked_receipt',
    label: 'Tekshiruvli qabul',
    steps: [
      { name: 'Qabul qilish', responsible_role: 'warehouse_worker' },
      { name: 'Sifat tekshiruvi', responsible_role: 'quality_inspector', requires_approval: true }
    ]
  },
  {
    key: 'full_receipt',
    label: "To'liq qabul",
    steps: [
      { name: 'Qabul qilish', responsible_role: 'warehouse_worker' },
      { name: 'Sifat tekshiruvi', responsible_role: 'quality_inspector', requires_approval: true },
      { name: 'Joylashtirish', responsible_role: 'warehouse_worker' }
    ]
  },
  {
    key: 'simple_delivery',
    label: "Oddiy jo'natish",
    steps: [{ name: "Jo'natish", responsible_role: 'warehouse_worker' }]
  },
  {
    key: 'prepared_delivery',
    label: "Tayyorlashli jo'natish",
    steps: [
      { name: "Yig'ish", responsible_role: 'warehouse_worker' },
      { name: "Jo'natish", responsible_role: 'warehouse_worker' }
    ]
  },
  {
    key: 'full_delivery',
    label: "To'liq jo'natish",
    steps: [
      { name: "Yig'ish", responsible_role: 'warehouse_worker' },
      { name: 'Qadoqlash', responsible_role: 'warehouse_worker' },
      { name: "Jo'natish", responsible_role: 'warehouse_worker' }
    ]
  },
  {
    key: 'simple_writeoff',
    label: 'Oddiy hisobdan chiqarish',
    steps: [{ name: 'Hisobdan chiqarish', responsible_role: 'warehouse_manager' }]
  },
  {
    key: 'commission_writeoff',
    label: 'Komissiyali hisobdan chiqarish',
    steps: [
      { name: 'Tekshirish', responsible_role: 'quality_inspector' },
      { name: 'Tasdiqlash va chiqarish', responsible_role: 'warehouse_manager', requires_approval: true }
    ]
  },
];

const ROLE_OPTIONS = [
  { value: 'warehouse_worker', label: 'Omborchi' },
  { value: 'warehouse_manager', label: 'Ombor menejeri' },
  { value: 'quality_inspector', label: 'Sifat nazoratchi' },
  { value: 'supervisor', label: 'Boshqaruvchi' },
  { value: 'accountant', label: 'Buxgalter' },
];

const TIMEOUT_OPTIONS = [
  { value: 'notify', label: 'Xabarnoma yuborish' },
  { value: 'escalate', label: 'Eskalatsiya qilish' },
  { value: 'auto_proceed', label: 'Avtomatik davom ettirish' },
];

const emptyStep = () => ({
  _tempId: Date.now() + Math.random(),
  name: '',
  source_location_id: '',
  dest_location_id: '',
  responsible_role: 'warehouse_worker',
  requires_approval: false,
  approval_role: '',
  auto_proceed: false,
  max_duration_hours: '',
  on_timeout: 'notify',
  instructions: '',
});

export default function OperationTypes() {
  const navigate = useNavigate();
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

  // Steps state
  const [steps, setSteps] = useState([]);
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [editingStepIndex, setEditingStepIndex] = useState(-1);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsSaving, setStepsSaving] = useState(false);

  // Accounting data
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [locations, setLocations] = useState([]);

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
    operation_type: 'internal',
    type: 'custom',
    color: '#6366f1',
    show_operations: true,
    barcode_enabled: true,
    create_backorder: true,
    reservation_method: 'at_confirm',
    sequence: 10,
    approval_rule: 'never',
    approval_amount_threshold: '',
    approval_quantity_threshold: '',
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

  // Load journals, accounts, locations when edit modal opens
  const loadEditData = useCallback(async (opType) => {
    try {
      const [journalsData, accountsData, locationsData, fullOpType] = await Promise.all([
        financeService.listJournals(),
        financeService.listAccounts(),
        inventoryService.listAllLocations(),
        inventoryService.getOperationType(opType.id)
      ]);
      setJournals(journalsData || []);
      setAccounts(accountsData || []);
      setLocations(locationsData || []);
      // Update form with accounting fields from full opType data
      if (fullOpType) {
        setFormData(prev => ({
          ...prev,
          journal_id: fullOpType.journal_id || '',
          debit_account_id: fullOpType.debit_account_id || '',
          credit_account_id: fullOpType.credit_account_id || '',
          auto_post_accounting: fullOpType.auto_post_accounting || false,
        }));
      }
    } catch (err) {
      console.error('Error loading edit data:', err);
    }

    // Load steps
    setStepsLoading(true);
    try {
      const stepsData = await inventoryService.listOperationTypeSteps(opType.id);
      setSteps((stepsData || []).map(s => ({
        ...s,
        _tempId: s.id || Date.now() + Math.random(),
        source_location_id: s.source_location_id || '',
        dest_location_id: s.dest_location_id || '',
        max_duration_hours: s.max_duration_hours || '',
        instructions: s.instructions || '',
        approval_role: s.approval_role || '',
        on_timeout: s.on_timeout || 'notify',
      })));
    } catch (err) {
      console.error('Error loading steps:', err);
      setSteps([]);
    } finally {
      setStepsLoading(false);
    }
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
      operation_type: 'internal',
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
        sequence: formData.sequence,
        journal_id: formData.journal_id || '',
        debit_account_id: formData.debit_account_id || '',
        credit_account_id: formData.credit_account_id || '',
        auto_post_accounting: formData.auto_post_accounting || false,
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
      sequence: ot.sequence || 10,
      journal_id: ot.journal_id || '',
      debit_account_id: ot.debit_account_id || '',
      credit_account_id: ot.credit_account_id || '',
      auto_post_accounting: ot.auto_post_accounting || false,
      approval_rule: ot.approval_rule || 'never',
      approval_amount_threshold: ot.approval_amount_threshold || '',
      approval_quantity_threshold: ot.approval_quantity_threshold || '',
    });
    setShowEditModal(true);
    loadEditData(ot);
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

  // --- Steps management ---
  const handleSaveSteps = async () => {
    if (!selectedType) return;
    setStepsSaving(true);
    try {
      const payload = steps.map((s, idx) => ({
        sequence: idx + 1,
        name: s.name,
        source_location_id: s.source_location_id || null,
        dest_location_id: s.dest_location_id || null,
        responsible_role: s.responsible_role || 'warehouse_worker',
        requires_approval: s.requires_approval || false,
        approval_role: s.approval_role || '',
        auto_proceed: s.auto_proceed || false,
        max_duration_hours: s.max_duration_hours ? parseFloat(s.max_duration_hours) : null,
        on_timeout: s.on_timeout || 'notify',
        instructions: s.instructions || '',
      }));
      await inventoryService.saveOperationTypeSteps(selectedType.id, payload);
    } catch (err) {
      console.error('Error saving steps:', err);
    } finally {
      setStepsSaving(false);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(steps);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setSteps(reordered);
  };

  const addStep = () => {
    const step = emptyStep();
    setEditingStep(step);
    setEditingStepIndex(-1);
    setShowStepModal(true);
  };

  const editStep = (step, index) => {
    setEditingStep({ ...step });
    setEditingStepIndex(index);
    setShowStepModal(true);
  };

  const deleteStep = (index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const saveStepModal = () => {
    if (!editingStep?.name) return;
    if (editingStepIndex === -1) {
      setSteps(prev => [...prev, { ...editingStep, _tempId: Date.now() + Math.random() }]);
    } else {
      setSteps(prev => prev.map((s, i) => i === editingStepIndex ? { ...editingStep } : s));
    }
    setShowStepModal(false);
    setEditingStep(null);
    setEditingStepIndex(-1);
  };

  const loadTemplate = (template) => {
    const newSteps = template.steps.map((s, idx) => ({
      ...emptyStep(),
      _tempId: Date.now() + Math.random() + idx,
      name: s.name,
      responsible_role: s.responsible_role || 'warehouse_worker',
      requires_approval: s.requires_approval || false,
    }));
    setSteps(newSteps);
  };

  // Operation Type Card Component
  const OperationTypeCard = ({ opType }) => {
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

          {/* Counters */}
          <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-slate-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="text-center p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/inventory/operation-type/${opType.id}?state=in_progress`)}
                >
                  <div className="text-lg font-bold text-blue-600">{opType.count_picking_ready || 0}</div>
                  <div className="text-[9px] text-blue-700 uppercase tracking-wide">{t('in_progress') || 'Jarayonda'}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('in_progress') || 'Jarayonda'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="text-center p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/inventory/operation-type/${opType.id}?state=waiting`)}
                >
                  <div className="text-lg font-bold text-amber-600">{opType.count_picking_waiting || 0}</div>
                  <div className="text-[9px] text-amber-700 uppercase tracking-wide">{t('waiting') || 'Kutilmoqda'}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('waiting') || 'Kutilmoqda'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="text-center p-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/inventory/operation-type/${opType.id}?state=done`)}
                >
                  <div className="text-lg font-bold text-green-600">{opType.count_picking_backorders || 0}</div>
                  <div className="text-[9px] text-green-700 uppercase tracking-wide">{t('done') || 'Bajarildi'}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('done') || 'Bajarildi'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="text-center p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/inventory/operation-type/${opType.id}?state=late`)}
                >
                  <div className="text-lg font-bold text-red-600">{opType.count_picking_late || 0}</div>
                  <div className="text-[9px] text-red-700 uppercase tracking-wide">{t('late') || 'Kechikkan'}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('late') || 'Kechikkan'}</TooltipContent>
            </Tooltip>
          </div>

          {/* Open button */}
          <Button
            variant="outline"
            className="w-full mt-3 text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(`/inventory/operation-type/${opType.id}`)}
          >
            {t('open') || 'Ochiq'}
          </Button>
        </div>
      </div>
    );
  };

  // Role label helper
  const getRoleLabel = (roleValue) => {
    return ROLE_OPTIONS.find(r => r.value === roleValue)?.label || roleValue;
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

            {/* Write-off / Approval Rules */}
            <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700">{t('approval_rules') || "Tasdiqlash qoidalari"}</p>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{t('approval_rule') || "Tasdiqlash turi"}</label>
                <Select value={formData.approval_rule} onValueChange={(v) => setFormData({ ...formData, approval_rule: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">{t('approval_never') || "Hech qachon"}</SelectItem>
                    <SelectItem value="always">{t('approval_always') || "Doim"}</SelectItem>
                    <SelectItem value="by_amount">{t('approval_by_amount') || "Summaga qarab"}</SelectItem>
                    <SelectItem value="by_quantity">{t('approval_by_quantity') || "Miqdorga qarab"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.approval_rule === 'by_amount' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">{t('amount_threshold') || "Summa chegarasi"}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1000000"
                    value={formData.approval_amount_threshold}
                    onChange={(e) => setFormData({ ...formData, approval_amount_threshold: e.target.value })}
                  />
                </div>
              )}
              {formData.approval_rule === 'by_quantity' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">{t('quantity_threshold') || "Miqdor chegarasi"}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="100"
                    value={formData.approval_quantity_threshold}
                    onChange={(e) => setFormData({ ...formData, approval_quantity_threshold: e.target.value })}
                  />
                </div>
              )}
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
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) {
          setSelectedType(null);
          setSteps([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit_operation_type') || "Operatsiya turini tahrirlash"}</DialogTitle>
            <DialogDescription>
              {selectedType?.code}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">{t('general') || "Umumiy"}</TabsTrigger>
              <TabsTrigger value="steps">
                {"Bosqichlar"}
                {steps.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                    {steps.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="accounting">{"Buxgalteriya"}</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
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

              {/* Approval Rules */}
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-700">{t('approval_rules') || "Tasdiqlash qoidalari"}</p>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">{t('approval_rule') || "Tasdiqlash turi"}</label>
                  <Select value={formData.approval_rule || 'never'} onValueChange={(v) => setFormData({ ...formData, approval_rule: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">{t('approval_never') || "Hech qachon"}</SelectItem>
                      <SelectItem value="always">{t('approval_always') || "Doim"}</SelectItem>
                      <SelectItem value="by_amount">{t('approval_by_amount') || "Summaga qarab"}</SelectItem>
                      <SelectItem value="by_quantity">{t('approval_by_quantity') || "Miqdorga qarab"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.approval_rule === 'by_amount' && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t('amount_threshold') || "Summa chegarasi"}</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="1000000"
                      value={formData.approval_amount_threshold || ''}
                      onChange={(e) => setFormData({ ...formData, approval_amount_threshold: e.target.value })}
                    />
                  </div>
                )}
                {formData.approval_rule === 'by_quantity' && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t('quantity_threshold') || "Miqdor chegarasi"}</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="100"
                      value={formData.approval_quantity_threshold || ''}
                      onChange={(e) => setFormData({ ...formData, approval_quantity_threshold: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Steps Tab */}
            <TabsContent value="steps" className="space-y-4 mt-4">
              {/* Template selector */}
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="w-4 h-4" />
                      {"Shablondan yuklash"}
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {STEP_TEMPLATES.map(tmpl => (
                      <DropdownMenuItem key={tmpl.key} onClick={() => loadTemplate(tmpl)}>
                        <div>
                          <p className="font-medium">{tmpl.label}</p>
                          <p className="text-xs text-slate-500">
                            {tmpl.steps.map(s => s.name).join(' → ')}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {stepsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--genix-blue)]" />
                </div>
              ) : steps.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-500 mb-3">{"Bosqichlar hali qo'shilmagan"}</p>
                  <Button variant="outline" size="sm" onClick={addStep}>
                    <Plus className="w-4 h-4 mr-1" />
                    {"Bosqich qo'shish"}
                  </Button>
                </div>
              ) : (
                <>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="steps-list">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                          {steps.map((step, index) => (
                            <Draggable key={String(step._tempId)} draggableId={String(step._tempId)} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                    snapshot.isDragging ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white border-slate-200'
                                  }`}
                                >
                                  <div {...provided.dragHandleProps} className="cursor-grab text-slate-400 hover:text-slate-600">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className="w-7 h-7 rounded-full bg-[var(--genix-blue)] text-white text-xs flex items-center justify-center font-bold shrink-0">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-slate-900 truncate">{step.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-slate-500">{getRoleLabel(step.responsible_role)}</span>
                                      {step.requires_approval && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200 bg-amber-50">
                                          <Shield className="w-2.5 h-2.5 mr-0.5" />
                                          {"Tasdiqlash"}
                                        </Badge>
                                      )}
                                      {step.max_duration_hours && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500">
                                          <Clock className="w-2.5 h-2.5 mr-0.5" />
                                          {step.max_duration_hours}{"s"}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {index < steps.length - 1 && (
                                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                  )}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => editStep(step, index)}>
                                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteStep(index)}>
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  <Button variant="outline" size="sm" onClick={addStep} className="w-full">
                    <Plus className="w-4 h-4 mr-1" />
                    {"Bosqich qo'shish"}
                  </Button>
                </>
              )}

              {steps.length > 0 && (
                <Button
                  onClick={handleSaveSteps}
                  disabled={stepsSaving}
                  size="sm"
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  {stepsSaving ? "Saqlanmoqda..." : "Bosqichlarni saqlash"}
                </Button>
              )}
            </TabsContent>

            {/* Accounting Tab */}
            <TabsContent value="accounting" className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {"Jurnal"}
                </label>
                <Select
                  value={formData.journal_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, journal_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={"Jurnalni tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{"Tanlanmagan"}</SelectItem>
                    {journals.map(j => (
                      <SelectItem key={j.id} value={j.id}>{j.name} ({j.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {"Debet hisob"}
                </label>
                <Select
                  value={formData.debit_account_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, debit_account_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={"Hisobni tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{"Tanlanmagan"}</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {"Kredit hisob"}
                </label>
                <Select
                  value={formData.credit_account_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, credit_account_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={"Hisobni tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{"Tanlanmagan"}</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{"Avtomatik buxgalteriya yozuvi"}</p>
                  <p className="text-xs text-slate-500">{"Operatsiya tugaganda avtomatik jurnal yozuvi yaratish"}</p>
                </div>
                <Switch
                  checked={formData.auto_post_accounting || false}
                  onCheckedChange={(v) => setFormData({ ...formData, auto_post_accounting: v })}
                />
              </div>
            </TabsContent>
          </Tabs>

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

      {/* Step Edit Modal */}
      <Dialog open={showStepModal} onOpenChange={(open) => {
        setShowStepModal(open);
        if (!open) {
          setEditingStep(null);
          setEditingStepIndex(-1);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStepIndex === -1 ? "Yangi bosqich" : "Bosqichni tahrirlash"}
            </DialogTitle>
          </DialogHeader>

          {editingStep && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {"Nomi"} *
                </label>
                <Input
                  value={editingStep.name}
                  onChange={(e) => setEditingStep({ ...editingStep, name: e.target.value })}
                  placeholder={"Bosqich nomi"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {"Manba lokatsiya"}
                  </label>
                  <Select
                    value={editingStep.source_location_id || 'none'}
                    onValueChange={(v) => setEditingStep({ ...editingStep, source_location_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={"Tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{"Tanlanmagan"}</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.complete_name || loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {"Maqsad lokatsiya"}
                  </label>
                  <Select
                    value={editingStep.dest_location_id || 'none'}
                    onValueChange={(v) => setEditingStep({ ...editingStep, dest_location_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={"Tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{"Tanlanmagan"}</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.complete_name || loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {"Mas'ul rol"}
                </label>
                <Select
                  value={editingStep.responsible_role}
                  onValueChange={(v) => setEditingStep({ ...editingStep, responsible_role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{"Tasdiqlash talab etiladi"}</p>
                </div>
                <Switch
                  checked={editingStep.requires_approval}
                  onCheckedChange={(v) => setEditingStep({ ...editingStep, requires_approval: v })}
                />
              </div>

              {editingStep.requires_approval && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {"Tasdiqlash roli"}
                  </label>
                  <Select
                    value={editingStep.approval_role || 'none'}
                    onValueChange={(v) => setEditingStep({ ...editingStep, approval_role: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{"Tanlanmagan"}</SelectItem>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{"Avtomatik davom ettirish"}</p>
                  <p className="text-xs text-slate-500">{"Bosqich tugaganda keyingisiga o'tish"}</p>
                </div>
                <Switch
                  checked={editingStep.auto_proceed}
                  onCheckedChange={(v) => setEditingStep({ ...editingStep, auto_proceed: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {"Maks. muddat (soat)"}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editingStep.max_duration_hours}
                    onChange={(e) => setEditingStep({ ...editingStep, max_duration_hours: e.target.value })}
                    placeholder={"24"}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {"Muddat o'tganda"}
                  </label>
                  <Select
                    value={editingStep.on_timeout}
                    onValueChange={(v) => setEditingStep({ ...editingStep, on_timeout: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {"Ko'rsatmalar"}
                </label>
                <Textarea
                  value={editingStep.instructions}
                  onChange={(e) => setEditingStep({ ...editingStep, instructions: e.target.value })}
                  placeholder={"Bosqich bo'yicha ko'rsatmalar..."}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepModal(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              onClick={saveStepModal}
              disabled={!editingStep?.name}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {editingStepIndex === -1 ? "Qo'shish" : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
