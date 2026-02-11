import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Trash2, Edit } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { inventoryService, bomsService } from '@/api/services';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function BOMManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { boms, loading, createBOM, updateBOM } = useManufacturing();
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBom, setSelectedBom] = useState(null);
  const [editBom, setEditBom] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [products, setProducts] = useState([]);
  const [newBom, setNewBom] = useState({
    code: '',
    name: '',
    product_id: '',
    quantity: 1,
    bom_type: 'manufacturing',
    lines: []
  });

  const [newComponent, setNewComponent] = useState({
    component_id: '',
    quantity: 0,
    unit: 'pcs'
  });

  // Load products for selection
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const productsData = await inventoryService.listProducts();
        setProducts(productsData || []);
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };
    loadProducts();
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
    if (bom.product_code) return bom.product_code;
    if (bom.product_id) {
      const product = products.find(p => p.id === bom.product_id);
      return product?.sku || product?.code || '';
    }
    return '';
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

      await createBOM(bomData);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating BOM:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to create BOM: ${errorMsg}`);
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

  const [editComponent, setEditComponent] = useState({
    component_id: '',
    quantity: 0,
    unit: 'pcs'
  });

  const handleEditBom = async (bom, e) => {
    e.stopPropagation();
    try {
      const fullBom = await bomsService.get(bom.id);
      setEditBom({
        ...fullBom,
        lines: fullBom.lines || []
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Error fetching BOM details:', error);
      setEditBom({ ...bom, lines: bom.lines || [] });
      setShowEditModal(true);
    }
  };

  const handleUpdateBom = async () => {
    if (!editBom) return;

    setIsSubmitting(true);
    try {
      await updateBOM(editBom.id, editBom);
      setShowEditModal(false);
      setEditBom(null);
    } catch (error) {
      console.error('Error updating BOM:', error);
      alert('Failed to update BOM: ' + (error.message || 'Unknown error'));
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
    const updated = editBom.lines.filter((_, i) => i !== index);
    setEditBom({ ...editBom, lines: updated });
  };

  const resetForm = () => {
    setNewBom({
      code: '',
      name: '',
      product_id: '',
      quantity: 1,
      bom_type: 'manufacturing',
      lines: []
    });
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
                          <Button size="sm" variant="ghost" onClick={(e) => handleEditBom(bom, e)}>
                            <Edit className="w-4 h-4" />
                          </Button>
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
                  <label className="text-sm font-medium mb-1 block">{t('bom_code')}</label>
                  <Input
                    placeholder={t('auto_generated_if_empty')}
                    value={newBom.code}
                    onChange={(e) => setNewBom({...newBom, code: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('bom_name')} *</label>
                  <Input
                    placeholder={t('bom_name')}
                    value={newBom.name}
                    onChange={(e) => setNewBom({...newBom, name: e.target.value})}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">{t('product')} *</label>
                  <Select
                    value={newBom.product_id}
                    onValueChange={(value) => setNewBom({...newBom, product_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_product')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku || product.code || 'No SKU'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Components */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">{t('components_materials')}</h3>

              {/* Add Component Form */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Select
                    value={newComponent.component_id}
                    onValueChange={(value) => setNewComponent({...newComponent, component_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_component')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
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
                  <Input
                    placeholder={t('unit')}
                    value={newComponent.unit}
                    onChange={(e) => setNewComponent({...newComponent, unit: e.target.value})}
                  />
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
            </div>

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
                    <label className="text-sm font-medium mb-1 block">{t('bom_code')}</label>
                    <Input
                      value={editBom.code || ''}
                      onChange={(e) => setEditBom({...editBom, code: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('bom_name')} *</label>
                    <Input
                      value={editBom.name || ''}
                      onChange={(e) => setEditBom({...editBom, name: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">{t('product')} *</label>
                    <Select
                      value={editBom.product_id}
                      onValueChange={(value) => setEditBom({...editBom, product_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_product')} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku || product.code || 'No SKU'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Components */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">{t('components_materials')}</h3>

                {/* Add Component Form */}
                <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Select
                      value={editComponent.component_id}
                      onValueChange={(value) => setEditComponent({...editComponent, component_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_component')} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
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
                    <Input
                      placeholder={t('unit')}
                      value={editComponent.unit}
                      onChange={(e) => setEditComponent({...editComponent, unit: e.target.value})}
                    />
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
                              <TableCell>{component?.name || line.component_id}</TableCell>
                              <TableCell>{line.quantity}</TableCell>
                              <TableCell>{line.unit}</TableCell>
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
              </div>

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

    </div>
  );
}