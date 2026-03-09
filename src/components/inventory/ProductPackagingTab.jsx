import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Pencil, Trash2, Package, Barcode, ShoppingCart, Truck, X, Check
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { inventoryService } from "@/api/services/inventory";
import { toast } from 'sonner';

export default function ProductPackagingTab({ productId, productName }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [packagings, setPackagings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPackaging, setSelectedPackaging] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    qty: '',
    barcode: '',
    sales: true,
    purchase: true,
  });

  // Fetch packagings for this product
  const fetchPackagings = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await inventoryService.listProductPackagingsByProduct(productId);
      setPackagings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch packagings:', error);
      setPackagings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackagings();
  }, [productId]);

  const handleOpenModal = (packaging = null) => {
    if (packaging) {
      setEditingPackaging(packaging);
      setFormData({
        name: packaging.name || '',
        qty: packaging.qty?.toString() || '',
        barcode: packaging.barcode || '',
        sales: packaging.sales ?? true,
        purchase: packaging.purchase ?? true,
      });
    } else {
      setEditingPackaging(null);
      setFormData({
        name: '',
        qty: '',
        barcode: '',
        sales: true,
        purchase: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.qty) {
      toast.error(t('please_fill_required_fields') || 'Please fill in all required fields');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        qty: parseFloat(formData.qty),
        barcode: formData.barcode || undefined,
        sales: formData.sales,
        purchase: formData.purchase,
      };

      if (editingPackaging) {
        await inventoryService.updateProductPackaging(editingPackaging.id, payload);
      } else {
        await inventoryService.createProductPackagingForProduct(productId, payload);
      }

      setShowModal(false);
      fetchPackagings();
    } catch (error) {
      console.error('Failed to save packaging:', error);
      toast.error(t('error_saving') || 'Failed to save packaging');
    }
  };

  const handleDelete = async () => {
    if (!selectedPackaging) return;
    try {
      await inventoryService.deleteProductPackaging(selectedPackaging.id);
      setShowDeleteModal(false);
      setSelectedPackaging(null);
      fetchPackagings();
    } catch (error) {
      console.error('Failed to delete packaging:', error);
      toast.error(t('error_deleting') || 'Failed to delete packaging');
    }
  };

  const confirmDelete = (packaging) => {
    setSelectedPackaging(packaging);
    setShowDeleteModal(true);
  };

  if (!productId) {
    return (
      <div className="text-center py-8 text-slate-500">
        {t('save_product_first') || 'Please save the product first to add packagings'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t('product_packagings') || 'Product Packagings'}
          </h3>
          <p className="text-sm text-slate-500">
            {t('packaging_description') || 'Define how this product can be sold or purchased in bulk (e.g., 6-pack, case of 24)'}
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-gradient-to-r from-indigo-600 to-purple-600">
          <Plus className="w-4 h-4 mr-2" />
          {t('add_packaging') || 'Add Packaging'}
        </Button>
      </div>

      {/* Packagings List */}
      {loading ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-2 animate-pulse" />
          <p className="text-slate-500">{t('loading') || 'Loading...'}</p>
        </div>
      ) : packagings.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 mb-3">{t('no_packagings') || 'No packagings defined'}</p>
          <Button variant="outline" onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            {t('add_first_packaging') || 'Add First Packaging'}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>{t('packaging_name') || 'Packaging'}</TableHead>
              <TableHead className="text-right">{t('quantity') || 'Quantity'}</TableHead>
              <TableHead>{t('barcode') || 'Barcode'}</TableHead>
              <TableHead className="text-center">{t('sales') || 'Sales'}</TableHead>
              <TableHead className="text-center">{t('purchase') || 'Purchase'}</TableHead>
              <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packagings.map((packaging) => (
              <TableRow key={packaging.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{packaging.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {packaging.qty} {t('units') || 'units'}
                </TableCell>
                <TableCell>
                  {packaging.barcode ? (
                    <div className="flex items-center gap-1 text-slate-600">
                      <Barcode className="w-3 h-3" />
                      <span className="font-mono text-sm">{packaging.barcode}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {packaging.sales ? (
                    <Badge className="bg-green-100 text-green-800">
                      <ShoppingCart className="w-3 h-3 mr-1" />
                      {t('yes') || 'Yes'}
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600">{t('no') || 'No'}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {packaging.purchase ? (
                    <Badge className="bg-blue-100 text-blue-800">
                      <Truck className="w-3 h-3 mr-1" />
                      {t('yes') || 'Yes'}
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600">{t('no') || 'No'}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleOpenModal(packaging)}>
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => confirmDelete(packaging)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPackaging
                ? (t('edit_packaging') || 'Edit Packaging')
                : (t('new_packaging') || 'New Packaging')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t('packaging_name') || 'Packaging Name'} *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('packaging_name_placeholder') || 'e.g., 6-Pack, Case of 24, Pallet'}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                {t('quantity_in_packaging') || 'Quantity in Packaging'} *
              </label>
              <Input
                type="number"
                min="1"
                step="0.001"
                value={formData.qty}
                onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                placeholder={t('quantity_placeholder') || 'Number of units in this packaging'}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                {t('barcode') || 'Barcode'}
              </label>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-10"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder={t('barcode_placeholder') || 'Packaging-specific barcode'}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">{t('available_for_sales') || 'Available for Sales'}</span>
              </div>
              <Switch
                checked={formData.sales}
                onCheckedChange={(checked) => setFormData({ ...formData, sales: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">{t('available_for_purchase') || 'Available for Purchase'}</span>
              </div>
              <Switch
                checked={formData.purchase}
                onCheckedChange={(checked) => setFormData({ ...formData, purchase: checked })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                {editingPackaging ? (t('save_changes') || 'Save Changes') : (t('create') || 'Create')}
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
              {t('delete_packaging_confirmation') || 'Are you sure you want to delete this packaging?'}
            </p>
            {selectedPackaging && (
              <p className="mt-2 font-medium text-slate-900">{selectedPackaging.name}</p>
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
    </div>
  );
}
