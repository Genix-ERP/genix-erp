import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Search, Package, Pencil, Trash2, Box, Barcode, Scale, Ruler, RefreshCw
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { inventoryService } from "@/api/services/inventory";

export default function PackageTypes() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [packageTypes, setPackageTypes] = useState([]);
  const [filteredTypes, setFilteredTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [useFilter, setUseFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    length_mm: '',
    width_mm: '',
    height_mm: '',
    max_weight: '',
    barcode: '',
    package_use: 'disposable',
  });

  // Fetch package types
  const fetchPackageTypes = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.listPackageTypes();
      setPackageTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch package types:', error);
      setPackageTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackageTypes();
  }, []);

  // Filter package types
  useEffect(() => {
    let filtered = packageTypes;

    if (searchQuery) {
      filtered = filtered.filter(pt =>
        pt.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pt.code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (useFilter !== 'all') {
      filtered = filtered.filter(pt => pt.package_use === useFilter);
    }

    setFilteredTypes(filtered);
  }, [packageTypes, searchQuery, useFilter]);

  const handleOpenModal = (packageType = null) => {
    if (packageType) {
      setEditingType(packageType);
      setFormData({
        name: packageType.name || '',
        code: packageType.code || '',
        length_mm: packageType.length_mm?.toString() || '',
        width_mm: packageType.width_mm?.toString() || '',
        height_mm: packageType.height_mm?.toString() || '',
        max_weight: packageType.max_weight?.toString() || '',
        barcode: packageType.barcode || '',
        package_use: packageType.package_use || 'disposable',
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        code: '',
        length_mm: '',
        width_mm: '',
        height_mm: '',
        max_weight: '',
        barcode: '',
        package_use: 'disposable',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert(t('name_required') || 'Name is required');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        code: formData.code || undefined,
        length_mm: formData.length_mm ? parseInt(formData.length_mm) : undefined,
        width_mm: formData.width_mm ? parseInt(formData.width_mm) : undefined,
        height_mm: formData.height_mm ? parseInt(formData.height_mm) : undefined,
        max_weight: formData.max_weight ? parseFloat(formData.max_weight) : undefined,
        barcode: formData.barcode || undefined,
        package_use: formData.package_use,
      };

      if (editingType) {
        await inventoryService.updatePackageType(editingType.id, payload);
      } else {
        await inventoryService.createPackageType(payload);
      }

      setShowModal(false);
      fetchPackageTypes();
    } catch (error) {
      console.error('Failed to save package type:', error);
      alert(t('error_saving') || 'Failed to save package type');
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;
    try {
      await inventoryService.deletePackageType(selectedType.id);
      setShowDeleteModal(false);
      setSelectedType(null);
      fetchPackageTypes();
    } catch (error) {
      console.error('Failed to delete package type:', error);
      alert(t('error_deleting') || 'Failed to delete package type');
    }
  };

  const confirmDelete = (packageType) => {
    setSelectedType(packageType);
    setShowDeleteModal(true);
  };

  const getUseColor = (use) => {
    return use === 'reusable'
      ? 'bg-green-100 text-green-800'
      : 'bg-blue-100 text-blue-800';
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader className="border-b border-slate-200/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Box className="w-5 h-5" />
            {t('package_types') || 'Package Types'}
          </CardTitle>
          {canCreate(MODULES.INVENTORY) && (
            <Button onClick={() => handleOpenModal()} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" />
              {t('new_package_type') || 'New Package Type'}
            </Button>
          )}
        </div>

        <p className="text-sm text-slate-500 mt-2">
          {t('package_types_description') || 'Define box sizes, pallets, and container specifications for shipping'}
        </p>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('search_package_types') || 'Search package types...'}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={useFilter} onValueChange={setUseFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('filter_by_use') || 'Filter by use'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all') || 'All'}</SelectItem>
              <SelectItem value="reusable">{t('reusable') || 'Reusable'}</SelectItem>
              <SelectItem value="disposable">{t('disposable') || 'Disposable'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-16">
            <Box className="w-16 h-16 text-slate-300 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-500">{t('loading') || 'Loading...'}</p>
          </div>
        ) : filteredTypes.length === 0 ? (
          <div className="text-center py-16">
            <Box className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">{t('no_package_types') || 'No package types found'}</p>
            {canCreate(MODULES.INVENTORY) && (
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-2" />
                {t('create_first_package_type') || 'Create First Package Type'}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('name') || 'Name'}</TableHead>
                  <TableHead>{t('code') || 'Code'}</TableHead>
                  <TableHead>{t('dimensions') || 'Dimensions'}</TableHead>
                  <TableHead>{t('max_weight') || 'Max Weight'}</TableHead>
                  <TableHead>{t('barcode') || 'Barcode'}</TableHead>
                  <TableHead>{t('type') || 'Type'}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.map((pt) => (
                  <TableRow key={pt.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{pt.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pt.code ? (
                        <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{pt.code}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pt.dimensions || (pt.length_mm && pt.width_mm && pt.height_mm) ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Ruler className="w-3 h-3 text-slate-400" />
                          <span>{pt.dimensions || `${pt.length_mm}×${pt.width_mm}×${pt.height_mm} mm`}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pt.max_weight ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Scale className="w-3 h-3 text-slate-400" />
                          <span>{pt.max_weight} kg</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pt.barcode ? (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Barcode className="w-3 h-3" />
                          <span className="font-mono text-sm">{pt.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getUseColor(pt.package_use)}>
                        {pt.package_use === 'reusable' ? (
                          <><RefreshCw className="w-3 h-3 mr-1" /> {t('reusable') || 'Reusable'}</>
                        ) : (
                          <>{t('disposable') || 'Disposable'}</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate(MODULES.INVENTORY) && (
                          <Button size="sm" variant="ghost" onClick={() => handleOpenModal(pt)}>
                            <Pencil className="w-4 h-4 text-slate-500" />
                          </Button>
                        )}
                        {canDelete(MODULES.INVENTORY) && (
                          <Button size="sm" variant="ghost" onClick={() => confirmDelete(pt)}>
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

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingType
                ? (t('edit_package_type') || 'Edit Package Type')
                : (t('new_package_type') || 'New Package Type')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('name') || 'Name'} *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('package_type_name') || 'e.g., Small Box, Pallet'}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('code') || 'Code'}</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={t('package_type_code') || 'e.g., SBOX, PALLET'}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('dimensions_mm') || 'Dimensions (mm)'}</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500">{t('length') || 'Length'}</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.length_mm}
                    onChange={(e) => setFormData({ ...formData, length_mm: e.target.value })}
                    placeholder="L"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">{t('width') || 'Width'}</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.width_mm}
                    onChange={(e) => setFormData({ ...formData, width_mm: e.target.value })}
                    placeholder="W"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">{t('height') || 'Height'}</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.height_mm}
                    onChange={(e) => setFormData({ ...formData, height_mm: e.target.value })}
                    placeholder="H"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('max_weight_kg') || 'Max Weight (kg)'}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.max_weight}
                  onChange={(e) => setFormData({ ...formData, max_weight: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('barcode') || 'Barcode'}</label>
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder={t('package_barcode') || 'Package type barcode'}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('package_use') || 'Package Use'}</label>
              <Select value={formData.package_use} onValueChange={(v) => setFormData({ ...formData, package_use: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disposable">{t('disposable') || 'Disposable'} - {t('disposable_desc') || 'For shipping to customers'}</SelectItem>
                  <SelectItem value="reusable">{t('reusable') || 'Reusable'} - {t('reusable_desc') || 'For internal warehouse use'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                {editingType ? (t('save_changes') || 'Save Changes') : (t('create') || 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('confirm_delete') || 'Confirm Delete'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('delete_package_type_confirmation') || 'Are you sure you want to delete this package type?'}
            </p>
            {selectedType && (
              <p className="mt-2 font-medium text-slate-900">{selectedType.name}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700">
              {t('delete') || 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
