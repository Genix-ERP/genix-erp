import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, Edit, Trash2, Box, Eye, MapPin, Scale, Calendar, Layers
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { inventoryService } from "@/api/services/inventory";
import { toast } from 'sonner';

export default function Packages() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [packages, setPackages] = useState([]);
  const [filteredPackages, setFilteredPackages] = useState([]);
  const [packageTypes, setPackageTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const [createFormData, setCreateFormData] = useState({
    package_type_id: '',
    location_id: '',
    shipping_weight: '',
  });

  const [contentFormData, setContentFormData] = useState({
    product_id: '',
    quantity: '',
  });

  // Fetch data
  const fetchPackages = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.listPackages();
      setPackages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch packages:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackageTypes = async () => {
    try {
      const data = await inventoryService.listPackageTypes();
      setPackageTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch package types:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await inventoryService.listAllLocations();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await inventoryService.listProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchPackageTypes();
    fetchLocations();
    fetchProducts();
  }, []);

  // Filter packages
  useEffect(() => {
    let filtered = packages;

    if (searchQuery) {
      filtered = filtered.filter(pkg =>
        pkg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.package_type_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(pkg => pkg.package_type_id === typeFilter);
    }

    setFilteredPackages(filtered);
  }, [packages, searchQuery, typeFilter]);

  const handleCreatePackage = async () => {
    try {
      const payload = {
        package_type_id: createFormData.package_type_id || undefined,
        location_id: createFormData.location_id || undefined,
        shipping_weight: createFormData.shipping_weight ? parseFloat(createFormData.shipping_weight) : undefined,
      };

      await inventoryService.createPackage(payload);
      setShowCreateModal(false);
      setCreateFormData({ package_type_id: '', location_id: '', shipping_weight: '' });
      fetchPackages();
    } catch (error) {
      console.error('Failed to create package:', error);
      toast.error(t('error_creating') || 'Failed to create package');
    }
  };

  const handleViewPackage = async (pkg) => {
    try {
      const fullPackage = await inventoryService.getPackage(pkg.id);
      setSelectedPackage(fullPackage);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Failed to fetch package details:', error);
      setSelectedPackage(pkg);
      setShowDetailModal(true);
    }
  };

  const handleDeletePackage = async () => {
    if (!selectedPackage) return;
    try {
      await inventoryService.deletePackage(selectedPackage.id);
      setShowDeleteModal(false);
      setSelectedPackage(null);
      fetchPackages();
    } catch (error) {
      console.error('Failed to delete package:', error);
      toast.error(t('error_deleting') || 'Failed to delete package');
    }
  };

  const handleAddContent = async () => {
    if (!selectedPackage || !contentFormData.product_id || !contentFormData.quantity) {
      toast.error(t('fill_required_fields') || 'Please fill in all required fields');
      return;
    }

    try {
      await inventoryService.addPackageContent(selectedPackage.id, {
        product_id: contentFormData.product_id,
        quantity: parseFloat(contentFormData.quantity),
      });

      // Refresh package details
      const fullPackage = await inventoryService.getPackage(selectedPackage.id);
      setSelectedPackage(fullPackage);
      setShowAddContentModal(false);
      setContentFormData({ product_id: '', quantity: '' });
    } catch (error) {
      console.error('Failed to add content:', error);
      toast.error(t('error_adding_content') || 'Failed to add content to package');
    }
  };

  const handleRemoveContent = async (contentId) => {
    if (!selectedPackage) return;
    try {
      await inventoryService.removePackageContent(selectedPackage.id, contentId);
      const fullPackage = await inventoryService.getPackage(selectedPackage.id);
      setSelectedPackage(fullPackage);
    } catch (error) {
      console.error('Failed to remove content:', error);
      toast.error(t('error_removing_content') || 'Failed to remove content from package');
    }
  };

  const confirmDelete = (pkg) => {
    setSelectedPackage(pkg);
    setShowDeleteModal(true);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader className="border-b border-slate-200/60">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {t('packages') || 'Packages'}
                </CardTitle>
                {canCreate(MODULES.INVENTORY) && (
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('new_package') || 'New Package'}
                  </Button>
                )}
              </div>

              <p className="text-sm text-slate-500 mt-2">
                {t('packages_description') || 'Physical packages used for warehouse transfers and shipping'}
              </p>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_packages') || 'Search packages...'}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder={t('filter_by_type') || 'Filter by type'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_types') || 'All Types'}</SelectItem>
                    {packageTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-500">{t('loading') || 'Loading...'}</p>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">{t('no_packages') || 'No packages found'}</p>
            {canCreate(MODULES.INVENTORY) && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('create_first_package') || 'Create First Package'}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('package_name') || 'Package'}</TableHead>
                  <TableHead>{t('type') || 'Type'}</TableHead>
                  <TableHead>{t('location') || 'Location'}</TableHead>
                  <TableHead>{t('weight') || 'Weight'}</TableHead>
                  <TableHead>{t('items') || 'Items'}</TableHead>
                  <TableHead>{t('pack_date') || 'Pack Date'}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => (
                  <TableRow key={pkg.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span className="font-mono font-medium">{pkg.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pkg.package_type_name ? (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Box className="w-3 h-3 mr-1" />
                          {pkg.package_type_name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pkg.location_name ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {pkg.location_name}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pkg.shipping_weight ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Scale className="w-3 h-3 text-slate-400" />
                          {pkg.shipping_weight} kg
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 text-slate-800">
                        <Layers className="w-3 h-3 mr-1" />
                        {pkg.item_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Calendar className="w-3 h-3" />
                        {pkg.pack_date ? format(new Date(pkg.pack_date), 'dd.MM.yyyy') : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleViewPackage(pkg)}>
                          <Eye className="w-4 h-4 text-blue-500" />
                        </Button>
                        {canDelete(MODULES.INVENTORY) && (
                          <Button size="sm" variant="ghost" onClick={() => confirmDelete(pkg)}>
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

      {/* Create Package Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new_package') || 'New Package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              {t('package_auto_name') || 'A unique package name will be generated automatically.'}
            </p>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('package_type') || 'Package Type'}</label>
              <Select
                value={createFormData.package_type_id || 'none'}
                onValueChange={(v) => setCreateFormData({ ...createFormData, package_type_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_package_type') || 'Select package type (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('none') || 'None'}</SelectItem>
                  {packageTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('location') || 'Location'}</label>
              <Select
                value={createFormData.location_id || 'none'}
                onValueChange={(v) => setCreateFormData({ ...createFormData, location_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_location') || 'Select location (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('none') || 'None'}</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('shipping_weight') || 'Shipping Weight'} (kg)</label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-10"
                  placeholder={t('weight_placeholder') || 'e.g., 5.5'}
                  value={createFormData.shipping_weight}
                  onChange={(e) => setCreateFormData({ ...createFormData, shipping_weight: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleCreatePackage} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                {t('create_package') || 'Create Package'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Package Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {selectedPackage?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">{t('type') || 'Type'}</p>
                  <p className="font-medium">{selectedPackage.package_type_name || '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">{t('location') || 'Location'}</p>
                  <p className="font-medium">{selectedPackage.location_name || '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">{t('weight') || 'Weight'}</p>
                  <p className="font-medium">{selectedPackage.shipping_weight ? `${selectedPackage.shipping_weight} kg` : '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">{t('pack_date') || 'Pack Date'}</p>
                  <p className="font-medium">
                    {selectedPackage.pack_date ? format(new Date(selectedPackage.pack_date), 'dd.MM.yyyy HH:mm') : '-'}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{t('package_contents') || 'Package Contents'}</h4>
                  {canUpdate(MODULES.INVENTORY) && (
                    <Button size="sm" variant="outline" onClick={() => setShowAddContentModal(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      {t('add_product') || 'Add Product'}
                    </Button>
                  )}
                </div>

                {selectedPackage.contents && selectedPackage.contents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('product') || 'Product'}</TableHead>
                        <TableHead className="text-right">{t('quantity') || 'Quantity'}</TableHead>
                        <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPackage.contents.map((content) => (
                        <TableRow key={content.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{content.product_name}</span>
                              {content.product_code && (
                                <span className="text-xs text-slate-500 ml-2">[{content.product_code}]</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{content.quantity}</TableCell>
                          <TableCell className="text-right">
                            {canUpdate(MODULES.INVENTORY) && (
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveContent(content.id)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
                    <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">{t('no_contents') || 'No products in this package'}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Content Modal */}
      <Dialog open={showAddContentModal} onOpenChange={setShowAddContentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('add_product_to_package') || 'Add Product to Package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t('product') || 'Product'} *</label>
              <Select
                value={contentFormData.product_id}
                onValueChange={(v) => setContentFormData({ ...contentFormData, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product') || 'Select product'} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.code && `[${p.code}]`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('quantity') || 'Quantity'} *</label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={contentFormData.quantity}
                onChange={(e) => setContentFormData({ ...contentFormData, quantity: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowAddContentModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleAddContent} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                {t('add') || 'Add'}
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
              {t('delete_package_confirmation') || 'Are you sure you want to delete this package? All contents will be removed.'}
            </p>
            {selectedPackage && (
              <p className="mt-2 font-mono font-medium text-slate-900">{selectedPackage.name}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleDeletePackage} className="flex-1 bg-red-600 hover:bg-red-700">
              {t('delete') || 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </Card>
    </div>
  );
}
