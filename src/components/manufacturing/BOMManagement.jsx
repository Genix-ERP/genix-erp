import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, FileText, Trash2, Edit, Cog, Package, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { inventoryService, bomsService, workCentersService } from '@/api/services';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { toast } from 'sonner';

export default function BOMManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { boms, loading, createBOM, updateBOM, deleteBOM, refreshData } = useManufacturing();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedBom, setSelectedBom] = useState(null);
  const [viewBom, setViewBom] = useState(null);
  const [editBom, setEditBom] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [products, setProducts] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [newBom, setNewBom] = useState({
    name: '',
    product_id: '',
    quantity: 1,
    bom_type: 'manufacturing',
    lines: [],
    operations: []
  });

  const [newComponent, setNewComponent] = useState({
    component_id: '',
    quantity: 0,
    unit: 'pcs'
  });

  const [newOperation, setNewOperation] = useState({
    operation_name: '',
    work_center_id: '',
    setup_time_minutes: 0,
    run_time_minutes: 0,
    notes: ''
  });

  // Load products and work centers
  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, workCentersData] = await Promise.all([
          inventoryService.listProducts(),
          workCentersService.list()
        ]);
        setProducts(productsData || []);
        setWorkCenters(workCentersData || []);

      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // Helper function to get product name from product_id
  const getProductName = (bom) => {
    if (bom.product_name) return bom.product_name;
    if (bom.product_id) {
      const product = products.find(p => p.id === bom.product_id);
      return product?.name || bom.name || '-';
    }
    return bom.name || '-';
  };

  // Helper function to get product code from product_id
  const getProductCode = (bom) => {
    let code = '';
    if (bom.product_code) {
      code = bom.product_code;
    } else if (bom.product_id) {
      const product = products.find(p => p.id === bom.product_id);
      code = product?.sku || product?.code || '';
    }
    // Translate "no barcode" if present
    return code === 'no barcode' ? t('no barcode') : code;
  };

  // Filter BOMs based on search query
  const filteredBoms = useMemo(() => {
    if (!searchQuery) return boms;
    return boms.filter(b =>
      b.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bom_reference?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [boms, searchQuery]);

  const handleCreateBom = async () => {
    setIsSubmitting(true);
    try {
      const bomData = {
        code: newBom.code || `BOM-${Date.now()}`,
        name: newBom.name,
        product_id: newBom.product_id,
        bom_type: newBom.bom_type,
        quantity: newBom.quantity,
        lines: newBom.lines
      };

      const createdBom = await createBOM(bomData);

      // Create operations if any
      if (newBom.operations && newBom.operations.length > 0 && createdBom?.id) {
        for (const op of newBom.operations) {
          await bomsService.createOperation(createdBom.id, {
            sequence: op.sequence,
            operation_name: op.operation_name,
            work_center_id: op.work_center_id || null,
            setup_time_minutes: op.setup_time_minutes || 0,
            run_time_minutes: op.run_time_minutes || 0,
            notes: op.notes || ''
          });
        }
      }

      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating BOM:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Failed to create BOM: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addComponent = () => {
    if (newComponent.component_id && newComponent.quantity > 0) {
      setNewBom({
        ...newBom,
        lines: [...newBom.lines, {...newComponent}]
      });
      setNewComponent({
        component_id: '',
        quantity: 0,
        unit: 'pcs'
      });
    }
  };

  const removeComponent = (index) => {
    const updated = newBom.lines.filter((_, i) => i !== index);
    setNewBom({ ...newBom, lines: updated });
  };

  // Operation management for new BOM
  const addOperation = () => {
    if (newOperation.operation_name) {
      const sequence = (newBom.operations?.length || 0) * 10 + 10;
      setNewBom({
        ...newBom,
        operations: [...(newBom.operations || []), { ...newOperation, sequence }]
      });
      setNewOperation({
        operation_name: '',
        work_center_id: '',
        setup_time_minutes: 0,
        run_time_minutes: 0,
        notes: ''
      });
    }
  };

  const removeOperation = (index) => {
    const updated = (newBom.operations || []).filter((_, i) => i !== index);
    setNewBom({ ...newBom, operations: updated });
  };

  const moveOperation = (index, direction) => {
    const ops = [...(newBom.operations || [])];
    if (direction === 'up' && index > 0) {
      [ops[index], ops[index - 1]] = [ops[index - 1], ops[index]];
    } else if (direction === 'down' && index < ops.length - 1) {
      [ops[index], ops[index + 1]] = [ops[index + 1], ops[index]];
    }
    // Update sequences
    ops.forEach((op, i) => op.sequence = (i + 1) * 10);
    setNewBom({ ...newBom, operations: ops });
  };

  const [editComponent, setEditComponent] = useState({
    component_id: '',
    quantity: 0,
    unit: 'pcs'
  });

  const [editOperation, setEditOperation] = useState({
    operation_name: '',
    work_center_id: '',
    setup_time_minutes: 0,
    run_time_minutes: 0,
    notes: ''
  });

  const handleViewBom = async (bom, e) => {
    e.stopPropagation();
    try {
      const [fullBom, operations] = await Promise.all([
        bomsService.get(bom.id),
        bomsService.listOperations(bom.id).catch(() => [])
      ]);
      setViewBom({
        ...fullBom,
        lines: fullBom.lines || [],
        operations: operations || []
      });
      setShowViewModal(true);
    } catch (error) {
      console.error('Error fetching BOM details:', error);
      setViewBom({ ...bom, lines: bom.lines || [], operations: [] });
      setShowViewModal(true);
    }
  };

  const handleEditBom = async (bom, e) => {
    e.stopPropagation();
    try {
      const [fullBom, operations] = await Promise.all([
        bomsService.get(bom.id),
        bomsService.listOperations(bom.id).catch(() => [])
      ]);
      setEditBom({
        ...fullBom,
        lines: fullBom.lines || [],
        operations: operations || []
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Error fetching BOM details:', error);
      setEditBom({ ...bom, lines: bom.lines || [], operations: [] });
      setShowEditModal(true);
    }
  };

  const handleDeleteBom = async (bom, e) => {
    e.stopPropagation();
    if (!confirm(t('confirm_delete_bom') || `Are you sure you want to delete BOM "${bom.name || bom.code}"?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteBOM(bom.id);
    } catch (error) {
      console.error('Error deleting BOM:', error);
      toast.error(t('failed_to_delete_bom') || 'Failed to delete BOM');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateBom = async () => {
    if (!editBom) return;

    setIsSubmitting(true);
    try {
      // Update BOM basic info
      await updateBOM(editBom.id, editBom);

      // Handle operations CRUD
      const bomId = editBom.id;

      // 1. Delete removed operations
      if (editBom.deletedOperations && editBom.deletedOperations.length > 0) {
        for (const opId of editBom.deletedOperations) {
          try {
            await bomsService.deleteOperation(bomId, opId);
          } catch (error) {
            console.error('Error deleting operation:', opId, error);
          }
        }
      }

      // 2. Create new operations and update existing ones
      if (editBom.operations && editBom.operations.length > 0) {
        for (const op of editBom.operations) {
          const opData = {
            sequence: op.sequence,
            operation_name: op.operation_name,
            work_center_id: op.work_center_id || null,
            setup_time_minutes: op.setup_time_minutes || 0,
            run_time_minutes: op.run_time_minutes || 0,
            notes: op.notes || ''
          };

          if (op.isNew) {
            // Create new operation
            await bomsService.createOperation(bomId, opData);
          } else if (op.id) {
            // Update existing operation
            await bomsService.updateOperation(bomId, op.id, opData);
          }
        }
      }

      // Handle BOM lines CRUD
      // 1. Delete removed lines
      if (editBom.deletedLines && editBom.deletedLines.length > 0) {
        for (const lineId of editBom.deletedLines) {
          try {
            await bomsService.deleteLine(bomId, lineId);
          } catch (error) {
            console.error('Error deleting BOM line:', lineId, error);
          }
        }
      }

      // 2. Create new lines (those without an id)
      for (const line of editBom.lines) {
        if (!line.id) {
          try {
            await bomsService.createLine(bomId, {
              component_id: line.component_id,
              quantity: line.quantity,
              unit_of_measure: line.unit || 'pcs',
              scrap_percent: line.scrap_percent || 0,
              is_optional: line.is_optional || false,
              operation_sequence: line.operation_sequence || 0,
              notes: line.notes || ''
            });
          } catch (error) {
            console.error('Error creating BOM line:', error);
          }
        }
      }

      await refreshData();
      setShowEditModal(false);
      setEditBom(null);
    } catch (error) {
      console.error('Error updating BOM:', error);
      toast.error('Failed to update BOM: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addEditComponent = () => {
    if (editComponent.component_id && editComponent.quantity > 0) {
      setEditBom({
        ...editBom,
        lines: [...editBom.lines, {...editComponent}]
      });
      setEditComponent({
        component_id: '',
        quantity: 0,
        unit: 'pcs'
      });
    }
  };

  const removeEditComponent = (index) => {
    const line = editBom.lines[index];
    const updated = editBom.lines.filter((_, i) => i !== index);
    const deletedLines = [...(editBom.deletedLines || [])];
    if (line.id) deletedLines.push(line.id);
    setEditBom({ ...editBom, lines: updated, deletedLines });
  };

  // Edit operation handlers
  const addEditOperation = () => {
    if (editOperation.operation_name) {
      const sequence = (editBom.operations?.length || 0) * 10 + 10;
      setEditBom({
        ...editBom,
        operations: [...(editBom.operations || []), { ...editOperation, sequence, isNew: true }]
      });
      setEditOperation({
        operation_name: '',
        work_center_id: '',
        setup_time_minutes: 0,
        run_time_minutes: 0,
        notes: ''
      });
    }
  };

  const removeEditOperation = (index) => {
    const op = editBom.operations[index];
    const updated = editBom.operations.filter((_, i) => i !== index);
    // Mark for deletion if it has an ID (existing in DB)
    if (op.id && !op.isNew) {
      setEditBom({
        ...editBom,
        operations: updated,
        deletedOperations: [...(editBom.deletedOperations || []), op.id]
      });
    } else {
      setEditBom({ ...editBom, operations: updated });
    }
  };

  const moveEditOperation = (index, direction) => {
    const ops = [...(editBom.operations || [])];
    if (direction === 'up' && index > 0) {
      [ops[index], ops[index - 1]] = [ops[index - 1], ops[index]];
    } else if (direction === 'down' && index < ops.length - 1) {
      [ops[index], ops[index + 1]] = [ops[index + 1], ops[index]];
    }
    ops.forEach((op, i) => op.sequence = (i + 1) * 10);
    setEditBom({ ...editBom, operations: ops });
  };

  const resetForm = () => {
    setNewBom({
      name: '',
      product_id: '',
      quantity: 1,
      bom_type: 'manufacturing',
      lines: [],
      operations: []
    });
    setNewOperation({
      operation_name: '',
      work_center_id: '',
      setup_time_minutes: 0,
      run_time_minutes: 0,
      notes: ''
    });
  };

  // Get work center name by ID
  const getWorkCenterName = (wcId) => {
    const wc = workCenters.find(w => w.id === wcId);
    return wc?.name || wcId || '-';
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      obsolete: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.draft;
  };

  const getStatusLabel = (status) => {
    return t(status) || status;
  };

  const getBomTypeLabel = (bomType) => {
    return t(bomType) || bomType;
  };

  return (
    <div className="space-y-6">
      
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">{t('bill_of_materials')}</CardTitle>
              {canCreate(MODULES.MANUFACTURING) && (
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                  <Plus className="w-4 h-4 mr-2" /> {t('new_bom')}
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('search_boms')}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">{t('loading_boms')}</p>
              </div>
            </div>
          ) : filteredBoms.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('no_boms_created_yet')}</h3>
              <p className="text-sm text-slate-500 mb-6">{t('create_bom_description')}</p>
              {canCreate(MODULES.MANUFACTURING) && (
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_bom')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">{t('bom_reference')}</TableHead>
                    <TableHead className="font-semibold">{t('product')}</TableHead>
                    <TableHead className="font-semibold">{t('type')}</TableHead>
                    <TableHead className="font-semibold">{t('components_materials')}</TableHead>
                    <TableHead className="font-semibold">{t('total_cost')}</TableHead>
                    <TableHead className="font-semibold">{t('status')}</TableHead>
                    <TableHead className="font-semibold">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBoms.map((bom) => (
                    <TableRow key={bom.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedBom(bom)}>
                      <TableCell className="font-mono text-sm">{bom.code || bom.bom_reference || '-'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{getProductName(bom)}</p>
                          <p className="text-xs text-slate-500">{getProductCode(bom)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getBomTypeLabel(bom.bom_type || 'manufacturing')}</Badge>
                      </TableCell>
                      <TableCell>{bom.line_count || bom.lines?.length || 0} {t('items') || 'items'}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(bom.total_cost || 0)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(bom.status || (bom.is_active ? 'active' : 'draft'))}>
                          {getStatusLabel(bom.status || (bom.is_active ? 'active' : 'draft'))}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canUpdate(MODULES.MANUFACTURING) && (
                            <Button size="sm" variant="ghost" onClick={(e) => handleEditBom(bom, e)} title={t('edit') || 'Edit'}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={(e) => handleViewBom(bom, e)} title={t('view') || 'View'}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canDelete(MODULES.MANUFACTURING) && (
                            <Button size="sm" variant="ghost" onClick={(e) => handleDeleteBom(bom, e)} disabled={isDeleting} title={t('delete') || 'Delete'}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create BOM Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('create_bill_of_materials')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">{t('product_information')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('bom_name')} *</label>
                  <Input
                    placeholder={t('bom_name')}
                    value={newBom.name}
                    onChange={(e) => setNewBom({...newBom, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('product')} *</label>
                  <Select
                    value={newBom.product_id}
                    onValueChange={(value) => setNewBom({...newBom, product_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_product')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter(product => product.id).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku || product.code || 'No SKU'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Tabs for Components and Operations */}
            <Tabs defaultValue="components" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="components" className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t('components_materials')} ({newBom.lines.length})
                </TabsTrigger>
                <TabsTrigger value="operations" className="flex items-center gap-2">
                  <Cog className="w-4 h-4" />
                  {t('operations') || 'Operations'} ({newBom.operations?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Components Tab */}
              <TabsContent value="components" className="space-y-4 mt-4">
                {/* Add Component Form */}
                <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Select
                      value={newComponent.component_id}
                      onValueChange={(value) => {
                        const selectedProduct = products.find(p => p.id === value);
                        setNewComponent({
                          ...newComponent,
                          component_id: value,
                          unit: selectedProduct?.unit_name || selectedProduct?.purchase_unit_name || 'pcs'
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_component')} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter(product => product.id).map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku || product.code || 'No SKU'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder={t('quantity')}
                      value={newComponent.quantity || ''}
                      onChange={(e) => setNewComponent({...newComponent, quantity: parseFloat(e.target.value) || 0})}
                    />
                    <div className="h-10 px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-700 flex items-center">
                      {newComponent.unit || t('select_component_first') || 'Select component first'}
                    </div>
                  </div>
                  <Button onClick={addComponent} size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> {t('add_component')}
                  </Button>
                </div>

                {/* Components List */}
                {newBom.lines.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('component')}</TableHead>
                          <TableHead>{t('qty')}</TableHead>
                          <TableHead>{t('unit')}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {newBom.lines.map((line, index) => {
                          const component = products.find(p => p.id === line.component_id);
                          return (
                            <TableRow key={index}>
                              <TableCell>{component?.name || line.component_id}</TableCell>
                              <TableCell>{line.quantity}</TableCell>
                              <TableCell>{line.unit}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" onClick={() => removeComponent(index)}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Operations Tab */}
              <TabsContent value="operations" className="space-y-4 mt-4">
                {/* Add Operation Form */}
                <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('operation_name') || 'Operation Name'} *</label>
                      <Input
                        placeholder={t('operation_name') || 'Operation name'}
                        value={newOperation.operation_name}
                        onChange={(e) => setNewOperation({...newOperation, operation_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('work_center') || 'Work Center'}</label>
                      <Select
                        value={newOperation.work_center_id}
                        onValueChange={(value) => setNewOperation({...newOperation, work_center_id: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_work_center') || 'Select work center'} />
                        </SelectTrigger>
                        <SelectContent>
                          {workCenters.filter(wc => wc.id).map((wc) => (
                            <SelectItem key={wc.id} value={wc.id}>
                              {wc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('setup_time') || 'Setup Time'} ({t('minutes') || 'min'})</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newOperation.setup_time_minutes || ''}
                        onChange={(e) => setNewOperation({...newOperation, setup_time_minutes: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('run_time') || 'Run Time'} ({t('minutes') || 'min'})</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newOperation.run_time_minutes || ''}
                        onChange={(e) => setNewOperation({...newOperation, run_time_minutes: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-1 block">{t('notes') || 'Notes'}</label>
                      <Input
                        placeholder={t('operation_notes') || 'Notes about the operation'}
                        value={newOperation.notes}
                        onChange={(e) => setNewOperation({...newOperation, notes: e.target.value})}
                      />
                    </div>
                  </div>
                  <Button onClick={addOperation} size="sm" className="w-full" disabled={!newOperation.operation_name}>
                    <Plus className="w-4 h-4 mr-2" /> {t('add_operation') || 'Add Operation'}
                  </Button>
                </div>

                {/* Operations List */}
                {newBom.operations && newBom.operations.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-16">{t('seq') || '#'}</TableHead>
                          <TableHead>{t('operation') || 'Operation'}</TableHead>
                          <TableHead>{t('work_center') || 'Work Center'}</TableHead>
                          <TableHead>{t('setup') || 'Setup'}</TableHead>
                          <TableHead>{t('run') || 'Run'}</TableHead>
                          <TableHead className="w-32"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {newBom.operations.map((op, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm">{op.sequence}</TableCell>
                            <TableCell className="font-medium">{op.operation_name}</TableCell>
                            <TableCell>{getWorkCenterName(op.work_center_id)}</TableCell>
                            <TableCell>{op.setup_time_minutes || 0} {t('min') || 'min'}</TableCell>
                            <TableCell>{op.run_time_minutes || 0} {t('min') || 'min'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => moveOperation(index, 'up')} disabled={index === 0}>
                                  <ArrowUp className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => moveOperation(index, 'down')} disabled={index === newBom.operations.length - 1}>
                                  <ArrowDown className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => removeOperation(index)}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {(!newBom.operations || newBom.operations.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    <Cog className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>{t('no_operations_added') || 'No operations added yet'}</p>
                    <p className="text-sm">{t('add_operations_description') || 'Add operations to define the manufacturing process'}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }} className="flex-1">
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateBom}
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                disabled={!newBom.name || !newBom.product_id || newBom.lines.length === 0 || isSubmitting}
              >
                {isSubmitting ? t('saving') : t('create_bom')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit BOM Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit_bill_of_materials')}</DialogTitle>
          </DialogHeader>
          {editBom && (
            <div className="space-y-6 py-4">

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">{t('product_information')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('bom_name')} *</label>
                    <Input
                      value={editBom.name || ''}
                      onChange={(e) => setEditBom({...editBom, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('product')} *</label>
                    <Select
                      value={editBom.product_id}
                      onValueChange={(value) => setEditBom({...editBom, product_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_product')} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter(product => product.id).map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku || product.code || 'No SKU'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Tabs for Components and Operations */}
              <Tabs defaultValue="components" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="components" className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('components_materials')} ({editBom.lines?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="operations" className="flex items-center gap-2">
                    <Cog className="w-4 h-4" />
                    {t('operations') || 'Operations'} ({editBom.operations?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* Components Tab */}
                <TabsContent value="components" className="space-y-4 mt-4">
                  {/* Add Component Form */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <Select
                        value={editComponent.component_id}
                        onValueChange={(value) => {
                          const selectedProduct = products.find(p => p.id === value);
                          setEditComponent({
                            ...editComponent,
                            component_id: value,
                            unit: selectedProduct?.unit_name || selectedProduct?.purchase_unit_name || editComponent.unit
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_component')} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.filter(product => product.id).map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.sku || product.code || 'No SKU'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder={t('quantity')}
                        value={editComponent.quantity || ''}
                        onChange={(e) => setEditComponent({...editComponent, quantity: parseFloat(e.target.value) || 0})}
                      />
                      <div className="h-10 px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-700 flex items-center">
                        {editComponent.unit || t('select_component_first') || 'Select component first'}
                      </div>
                    </div>
                    <Button onClick={addEditComponent} size="sm" className="w-full">
                      <Plus className="w-4 h-4 mr-2" /> {t('add_component')}
                    </Button>
                  </div>

                  {/* Components List */}
                  {editBom.lines && editBom.lines.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>{t('component')}</TableHead>
                            <TableHead>{t('qty')}</TableHead>
                            <TableHead>{t('unit')}</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editBom.lines.map((line, index) => {
                            const component = products.find(p => p.id === line.component_id);
                            return (
                              <TableRow key={index}>
                                <TableCell>{component?.name || line.component_name || line.component_id}</TableCell>
                                <TableCell>{line.quantity}</TableCell>
                                <TableCell>{line.unit || line.unit_of_measure}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" onClick={() => removeEditComponent(index)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Operations Tab */}
                <TabsContent value="operations" className="space-y-4 mt-4">
                  {/* Add Operation Form */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">{t('operation_name') || 'Operation Name'} *</label>
                        <Input
                          placeholder={t('operation_name') || 'Operation name'}
                          value={editOperation.operation_name}
                          onChange={(e) => setEditOperation({...editOperation, operation_name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">{t('work_center') || 'Work Center'}</label>
                        <Select
                          value={editOperation.work_center_id}
                          onValueChange={(value) => setEditOperation({...editOperation, work_center_id: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('select_work_center') || 'Select work center'} />
                          </SelectTrigger>
                          <SelectContent>
                            {workCenters.filter(wc => wc.id).map((wc) => (
                              <SelectItem key={wc.id} value={wc.id}>
                                {wc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">{t('setup_time') || 'Setup Time'} ({t('minutes') || 'min'})</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={editOperation.setup_time_minutes || ''}
                          onChange={(e) => setEditOperation({...editOperation, setup_time_minutes: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">{t('run_time') || 'Run Time'} ({t('minutes') || 'min'})</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={editOperation.run_time_minutes || ''}
                          onChange={(e) => setEditOperation({...editOperation, run_time_minutes: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium mb-1 block">{t('notes') || 'Notes'}</label>
                        <Input
                          placeholder={t('operation_notes') || 'Notes about the operation'}
                          value={editOperation.notes}
                          onChange={(e) => setEditOperation({...editOperation, notes: e.target.value})}
                        />
                      </div>
                    </div>
                    <Button onClick={addEditOperation} size="sm" className="w-full" disabled={!editOperation.operation_name}>
                      <Plus className="w-4 h-4 mr-2" /> {t('add_operation') || 'Add Operation'}
                    </Button>
                  </div>

                  {/* Operations List */}
                  {editBom.operations && editBom.operations.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="w-16">{t('seq') || '#'}</TableHead>
                            <TableHead>{t('operation') || 'Operation'}</TableHead>
                            <TableHead>{t('work_center') || 'Work Center'}</TableHead>
                            <TableHead>{t('setup') || 'Setup'}</TableHead>
                            <TableHead>{t('run') || 'Run'}</TableHead>
                            <TableHead className="w-32"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editBom.operations.map((op, index) => (
                            <TableRow key={op.id || index}>
                              <TableCell className="font-mono text-sm">{op.sequence}</TableCell>
                              <TableCell className="font-medium">{op.operation_name}</TableCell>
                              <TableCell>{getWorkCenterName(op.work_center_id)}</TableCell>
                              <TableCell>{op.setup_time_minutes || 0} {t('min') || 'min'}</TableCell>
                              <TableCell>{op.run_time_minutes || 0} {t('min') || 'min'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => moveEditOperation(index, 'up')} disabled={index === 0}>
                                    <ArrowUp className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => moveEditOperation(index, 'down')} disabled={index === editBom.operations.length - 1}>
                                    <ArrowDown className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => removeEditOperation(index)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {(!editBom.operations || editBom.operations.length === 0) && (
                    <div className="text-center py-8 text-slate-500">
                      <Cog className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>{t('no_operations_added') || 'No operations added yet'}</p>
                      <p className="text-sm">{t('add_operations_description') || 'Add operations to define the manufacturing process'}</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowEditModal(false); setEditBom(null); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleUpdateBom}
                  className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                  disabled={isSubmitting || !editBom.name || !editBom.product_id}
                >
                  {isSubmitting ? t('saving') : t('update_bom')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View BOM Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('view_bill_of_materials') || 'View Bill of Materials'}</DialogTitle>
          </DialogHeader>
          {viewBom && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-500">{t('bom_code')}</label>
                  <p className="font-mono">{viewBom.code || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">{t('bom_name')}</label>
                  <p className="font-medium">{viewBom.name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">{t('product')}</label>
                  <p>{viewBom.product_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">{t('status')}</label>
                  <Badge className={getStatusColor(viewBom.status || (viewBom.is_active ? 'active' : 'draft'))}>
                    {getStatusLabel(viewBom.status || (viewBom.is_active ? 'active' : 'draft'))}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">{t('total_cost')}</label>
                  <p className="font-semibold">{formatCurrency(viewBom.total_cost || 0)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">{t('type')}</label>
                  <p>{getBomTypeLabel(viewBom.bom_type || 'manufacturing')}</p>
                </div>
              </div>

              {/* Tabs for Components and Operations */}
              <Tabs defaultValue="components" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="components" className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('components_materials')} ({viewBom.lines?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="operations" className="flex items-center gap-2">
                    <Cog className="w-4 h-4" />
                    {t('operations') || 'Operations'} ({viewBom.operations?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* Components Tab */}
                <TabsContent value="components" className="mt-4">
                  {viewBom.lines && viewBom.lines.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>{t('component')}</TableHead>
                            <TableHead>{t('qty')}</TableHead>
                            <TableHead>{t('unit')}</TableHead>
                            <TableHead>{t('unit_cost')}</TableHead>
                            <TableHead>{t('total')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewBom.lines.map((line, index) => {
                            const component = products.find(p => p.id === line.component_id);
                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{component?.name || line.component_name || line.component_id}</TableCell>
                                <TableCell>{line.quantity}</TableCell>
                                <TableCell>{line.unit || line.unit_of_measure}</TableCell>
                                <TableCell>{formatCurrency(line.unit_cost || 0)}</TableCell>
                                <TableCell className="font-semibold">{formatCurrency(line.total_cost || (line.quantity * (line.unit_cost || 0)))}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>{t('no_components') || 'No components added'}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Operations Tab */}
                <TabsContent value="operations" className="mt-4">
                  {viewBom.operations && viewBom.operations.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="w-16">{t('seq') || '#'}</TableHead>
                            <TableHead>{t('operation') || 'Operation'}</TableHead>
                            <TableHead>{t('work_center') || 'Work Center'}</TableHead>
                            <TableHead>{t('setup_time') || 'Setup'}</TableHead>
                            <TableHead>{t('run_time') || 'Run Time'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewBom.operations.map((op, index) => (
                            <TableRow key={op.id || index}>
                              <TableCell className="font-mono text-sm">{op.sequence}</TableCell>
                              <TableCell className="font-medium">{op.operation_name}</TableCell>
                              <TableCell>{getWorkCenterName(op.work_center_id)}</TableCell>
                              <TableCell>{op.setup_time_minutes || 0} {t('min') || 'min'}</TableCell>
                              <TableCell>{op.run_time_minutes || 0} {t('min') || 'min'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Cog className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>{t('no_operations') || 'No operations defined'}</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowViewModal(false); setViewBom(null); }} className="flex-1">
                  {t('close') || 'Close'}
                </Button>
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditBom(viewBom, { stopPropagation: () => {} });
                  }}
                  className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                >
                  <Edit className="w-4 h-4 mr-2" /> {t('edit') || 'Edit'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}