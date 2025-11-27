import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, FileText, Trash2, Edit } from 'lucide-react';

export default function BOMManagement() {
  const [boms, setBoms] = useState([]);
  const [filteredBoms, setFilteredBoms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBom, setSelectedBom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    loadBoms();
  }, []);

  useEffect(() => {
    let filtered = boms;
    if (searchQuery) {
      filtered = boms.filter(b =>
        b.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bom_reference?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredBoms(filtered);
  }, [boms, searchQuery]);

  const loadBoms = async () => {
    try {
      const data = await base44.entities.BillOfMaterials.list('-created_date', 100);
      setBoms(data);
      setFilteredBoms(data);
    } catch (error) {
      console.error('Error loading BOMs:', error);
    }
    setIsLoading(false);
  };

  const handleCreateBom = async () => {
    try {
      const total_material_cost = newBom.components.reduce((sum, c) => sum + (c.cost * c.quantity), 0);
      const total_operation_cost = newBom.operations.reduce((sum, op) => sum + ((op.duration_minutes / 60) * op.cost_per_hour), 0);
      
      const bomData = {
        ...newBom,
        bom_reference: newBom.bom_reference || `BOM-${Date.now()}`,
        total_material_cost,
        total_operation_cost,
        total_cost: total_material_cost + total_operation_cost
      };
      
      await base44.entities.BillOfMaterials.create(bomData);
      setShowCreateModal(false);
      loadBoms();
      resetForm();
    } catch (error) {
      console.error('Error creating BOM:', error);
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
              <CardTitle className="text-xl font-bold">Bill of Materials (BOM)</CardTitle>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> New BOM
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search BOMs..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading BOMs...</p>
              </div>
            </div>
          ) : filteredBoms.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No BOMs created yet</h3>
              <p className="text-sm text-slate-500 mb-6">Create your first Bill of Materials to define product recipes</p>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> Create First BOM
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">BOM Reference</TableHead>
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Components</TableHead>
                    <TableHead className="font-semibold">Total Cost</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
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
                          <Button size="sm" variant="ghost"><Edit className="w-4 h-4" /></Button>
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
            <DialogTitle>Create Bill of Materials</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Product Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">BOM Reference</label>
                  <Input
                    placeholder="Auto-generated if empty"
                    value={newBom.bom_reference}
                    onChange={(e) => setNewBom({...newBom, bom_reference: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">BOM Type</label>
                  <Input value={newBom.bom_type} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Product Name *</label>
                  <Input
                    placeholder="Final product name"
                    value={newBom.product_name}
                    onChange={(e) => setNewBom({...newBom, product_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Product Code *</label>
                  <Input
                    placeholder="SKU"
                    value={newBom.product_code}
                    onChange={(e) => setNewBom({...newBom, product_code: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Components */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Components / Materials</h3>
              
              {/* Add Component Form */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="grid grid-cols-5 gap-3">
                  <Input
                    placeholder="Component name"
                    value={newComponent.component_name}
                    onChange={(e) => setNewComponent({...newComponent, component_name: e.target.value})}
                  />
                  <Input
                    placeholder="Code"
                    value={newComponent.component_code}
                    onChange={(e) => setNewComponent({...newComponent, component_code: e.target.value})}
                  />
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={newComponent.quantity}
                    onChange={(e) => setNewComponent({...newComponent, quantity: parseFloat(e.target.value)})}
                  />
                  <Input
                    placeholder="Unit"
                    value={newComponent.unit}
                    onChange={(e) => setNewComponent({...newComponent, unit: e.target.value})}
                  />
                  <Input
                    type="number"
                    placeholder="Cost"
                    value={newComponent.cost}
                    onChange={(e) => setNewComponent({...newComponent, cost: parseFloat(e.target.value)})}
                  />
                </div>
                <Button onClick={addComponent} size="sm" className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Component
                </Button>
              </div>

              {/* Components List */}
              {newBom.components.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Component</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Total</TableHead>
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
                Cancel
              </Button>
              <Button 
                onClick={handleCreateBom} 
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                disabled={!newBom.product_name || !newBom.product_code || newBom.components.length === 0}
              >
                Create BOM
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}