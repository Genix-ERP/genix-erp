import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, FileText, Trash2, Edit } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';

export default function BOMManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { boms, loading, createBOM, updateBOM } = useManufacturing();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBom, setSelectedBom] = useState(null);
  const [editBom, setEditBom] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newBom, setNewBom] = useState({
    bom_reference: '',
    product_name: '',
    product_code: '',
    product_quantity: 1,
    bom_type: 'manufacture',
    components: [],
    operations: [],
    status: 'active'
  });

  const [newComponent, setNewComponent] = useState({
    component_name: '',
    component_code: '',
    quantity: 0,
    unit: 'pcs',
    cost: 0
  });

  // Filter BOMs based on search query
  const filteredBoms = useMemo(() => {
    if (!searchQuery) return boms;
    return boms.filter(b =>
      b.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bom_reference?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [boms, searchQuery]);

  const handleCreateBom = async () => {
    setIsSubmitting(true);
    try {
      const bomData = {
        ...newBom,
        bom_reference: newBom.bom_reference || `BOM-${Date.now()}`
      };

      await createBOM(bomData);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating BOM:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addComponent = () => {
    if (newComponent.component_name && newComponent.quantity > 0) {
      setNewBom({
        ...newBom,
        components: [...newBom.components, {...newComponent}]
      });
      setNewComponent({
        component_name: '',
        component_code: '',
        quantity: 0,
        unit: 'pcs',
        cost: 0
      });
    }
  };

  const removeComponent = (index) => {
    const updated = newBom.components.filter((_, i) => i !== index);
    setNewBom({ ...newBom, components: updated });
  };

  const [editComponent, setEditComponent] = useState({
    component_name: '',
    component_code: '',
    quantity: 0,
    unit: 'pcs',
    cost: 0
  });

  const handleEditBom = (bom, e) => {
    e.stopPropagation();
    setEditBom({
      ...bom,
      components: bom.components || [],
      operations: bom.operations || []
    });
    setShowEditModal(true);
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
    if (editComponent.component_name && editComponent.quantity > 0) {
      setEditBom({
        ...editBom,
        components: [...editBom.components, {...editComponent}]
      });
      setEditComponent({
        component_name: '',
        component_code: '',
        quantity: 0,
        unit: 'pcs',
        cost: 0
      });
    }
  };

  const removeEditComponent = (index) => {
    const updated = editBom.components.filter((_, i) => i !== index);
    setEditBom({ ...editBom, components: updated });
  };

  const resetForm = () => {
    setNewBom({
      bom_reference: '',
      product_name: '',
      product_code: '',
      product_quantity: 1,
      bom_type: 'manufacture',
      components: [],
      operations: [],
      status: 'active'
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

  return (
    <div className="space-y-6">
      
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">{t('bill_of_materials')}</CardTitle>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> {t('new_bom')}
              </Button>
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
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> {t('create_first_bom')}
              </Button>
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
                      <TableCell className="font-mono text-sm">{bom.bom_reference}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{bom.product_name}</p>
                          <p className="text-xs text-slate-500">{bom.product_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{bom.bom_type}</Badge>
                      </TableCell>
                      <TableCell>{bom.components?.length || 0} items</TableCell>
                      <TableCell className="font-semibold">${(bom.total_cost || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(bom.status)}>{bom.status}</Badge>
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
                  <label className="text-sm font-medium mb-1 block">{t('bom_reference')}</label>
                  <Input
                    placeholder={t('auto_generated_if_empty')}
                    value={newBom.bom_reference}
                    onChange={(e) => setNewBom({...newBom, bom_reference: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('bom_type')}</label>
                  <Input value={newBom.bom_type} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('product_name')} *</label>
                  <Input
                    placeholder={t('final_product_name')}
                    value={newBom.product_name}
                    onChange={(e) => setNewBom({...newBom, product_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('product_code')} *</label>
                  <Input
                    placeholder={t('sku')}
                    value={newBom.product_code}
                    onChange={(e) => setNewBom({...newBom, product_code: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Components */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">{t('components_materials')}</h3>

              {/* Add Component Form */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="grid grid-cols-5 gap-3">
                  <Input
                    placeholder={t('component_name')}
                    value={newComponent.component_name}
                    onChange={(e) => setNewComponent({...newComponent, component_name: e.target.value})}
                  />
                  <Input
                    placeholder={t('code')}
                    value={newComponent.component_code}
                    onChange={(e) => setNewComponent({...newComponent, component_code: e.target.value})}
                  />
                  <Input
                    type="number"
                    placeholder={t('quantity')}
                    value={newComponent.quantity}
                    onChange={(e) => setNewComponent({...newComponent, quantity: parseFloat(e.target.value)})}
                  />
                  <Input
                    placeholder={t('unit')}
                    value={newComponent.unit}
                    onChange={(e) => setNewComponent({...newComponent, unit: e.target.value})}
                  />
                  <Input
                    type="number"
                    placeholder={t('cost')}
                    value={newComponent.cost}
                    onChange={(e) => setNewComponent({...newComponent, cost: parseFloat(e.target.value)})}
                  />
                </div>
                <Button onClick={addComponent} size="sm" className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> {t('add_component')}
                </Button>
              </div>

              {/* Components List */}
              {newBom.components.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('component')}</TableHead>
                        <TableHead>{t('code')}</TableHead>
                        <TableHead>{t('qty')}</TableHead>
                        <TableHead>{t('unit')}</TableHead>
                        <TableHead>{t('cost')}</TableHead>
                        <TableHead>{t('total')}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newBom.components.map((comp, index) => (
                        <TableRow key={index}>
                          <TableCell>{comp.component_name}</TableCell>
                          <TableCell>{comp.component_code}</TableCell>
                          <TableCell>{comp.quantity}</TableCell>
                          <TableCell>{comp.unit}</TableCell>
                          <TableCell>${comp.cost}</TableCell>
                          <TableCell className="font-semibold">${(comp.quantity * comp.cost).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => removeComponent(index)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
                disabled={!newBom.product_name || !newBom.product_code || newBom.components.length === 0}
              >
                {t('create_bom')}
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
                    <label className="text-sm font-medium mb-1 block">{t('bom_reference')}</label>
                    <Input
                      value={editBom.bom_reference}
                      onChange={(e) => setEditBom({...editBom, bom_reference: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('status')}</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={editBom.status}
                      onChange={(e) => setEditBom({...editBom, status: e.target.value})}
                    >
                      <option value="draft">{t('draft')}</option>
                      <option value="active">{t('active')}</option>
                      <option value="obsolete">{t('obsolete')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('product_name')} *</label>
                    <Input
                      value={editBom.product_name}
                      onChange={(e) => setEditBom({...editBom, product_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('product_code')} *</label>
                    <Input
                      value={editBom.product_code}
                      onChange={(e) => setEditBom({...editBom, product_code: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Components */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">{t('components_materials')}</h3>

                {/* Add Component Form */}
                <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-5 gap-3">
                    <Input
                      placeholder={t('component_name')}
                      value={editComponent.component_name}
                      onChange={(e) => setEditComponent({...editComponent, component_name: e.target.value})}
                    />
                    <Input
                      placeholder={t('code')}
                      value={editComponent.component_code}
                      onChange={(e) => setEditComponent({...editComponent, component_code: e.target.value})}
                    />
                    <Input
                      type="number"
                      placeholder={t('quantity')}
                      value={editComponent.quantity}
                      onChange={(e) => setEditComponent({...editComponent, quantity: parseFloat(e.target.value)})}
                    />
                    <Input
                      placeholder={t('unit')}
                      value={editComponent.unit}
                      onChange={(e) => setEditComponent({...editComponent, unit: e.target.value})}
                    />
                    <Input
                      type="number"
                      placeholder={t('cost')}
                      value={editComponent.cost}
                      onChange={(e) => setEditComponent({...editComponent, cost: parseFloat(e.target.value)})}
                    />
                  </div>
                  <Button onClick={addEditComponent} size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> {t('add_component')}
                  </Button>
                </div>

                {/* Components List */}
                {editBom.components.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('component')}</TableHead>
                          <TableHead>{t('code')}</TableHead>
                          <TableHead>{t('qty')}</TableHead>
                          <TableHead>{t('unit')}</TableHead>
                          <TableHead>{t('cost')}</TableHead>
                          <TableHead>{t('total')}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editBom.components.map((comp, index) => (
                          <TableRow key={index}>
                            <TableCell>{comp.component_name}</TableCell>
                            <TableCell>{comp.component_code}</TableCell>
                            <TableCell>{comp.quantity}</TableCell>
                            <TableCell>{comp.unit}</TableCell>
                            <TableCell>${comp.cost}</TableCell>
                            <TableCell className="font-semibold">${(comp.quantity * comp.cost).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => removeEditComponent(index)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
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
                  disabled={isSubmitting || !editBom.product_name || !editBom.product_code}
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