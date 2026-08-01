import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  Package,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { MODULES } from "@/config/permissions";
import { useProcurement } from '@/components/contexts/ProcurementContext';
import { inventoryService } from '@/api/services/inventory';
import { procurementService } from '@/api/services/procurement';
import { toast } from 'sonner';

export default function VendorPricelist() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const { suppliers } = useProcurement();

  const [vendorPrices, setVendorPrices] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [priceToDelete, setPriceToDelete] = useState(null);

  const [formData, setFormData] = useState({
    vendor_id: '',
    product_id: '',
    price: '',
    currency: 'UZS',
    min_quantity: 1,
    lead_time_days: 0,
    valid_from: '',
    valid_until: '',
    notes: '',
    is_active: true
  });

  // Fetch vendor prices
  useEffect(() => {
    const fetchVendorPrices = async () => {
      setIsLoading(true);
      try {
        const data = await procurementService.listVendorPrices();
        setVendorPrices(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch vendor prices:', error);
        setVendorPrices([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVendorPrices();
  }, []);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await inventoryService.listProducts({ limit: 1000 });
        setProducts(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    fetchProducts();
  }, []);


  // Filter vendor prices
  const filteredPrices = useMemo(() => {
    return vendorPrices.filter(price => {
      const vendor = suppliers.find(s => s.id === price.vendor_id);
      const product = products.find(p => p.id === price.product_id);

      const matchesSearch =
        vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesVendor = vendorFilter === 'all' || price.vendor_id === vendorFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && price.is_active) ||
        (statusFilter === 'inactive' && !price.is_active);

      return matchesSearch && matchesVendor && matchesStatus;
    });
  }, [vendorPrices, suppliers, products, searchTerm, vendorFilter, statusFilter]);

  const resetForm = () => {
    setFormData({
      vendor_id: '',
      product_id: '',
      price: '',
      currency: 'UZS',
      min_quantity: 1,
      lead_time_days: 0,
      valid_from: '',
      valid_until: '',
      notes: '',
      is_active: true
    });
    setEditingPrice(null);
  };

  const handleCreate = async () => {
    try {
      const priceData = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        min_quantity: parseFloat(formData.min_quantity) || 1,
        lead_time_days: parseInt(formData.lead_time_days) || 0
      };

      const newPrice = await procurementService.createVendorPrice(priceData);
      setVendorPrices(prev => [newPrice, ...prev]);
      setShowPriceDialog(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create vendor price:', error);
      toast.error(t('failed_to_create') || 'Failed to create vendor price');
    }
  };

  const handleUpdate = async () => {
    if (!editingPrice) return;

    try {
      const priceData = {
        price: parseFloat(formData.price) || 0,
        min_quantity: parseFloat(formData.min_quantity) || 1,
        lead_time_days: parseInt(formData.lead_time_days) || 0,
        currency: formData.currency,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        notes: formData.notes,
        is_active: formData.is_active
      };

      const updatedPrice = await procurementService.updateVendorPrice(editingPrice.id, priceData);
      setVendorPrices(prev => prev.map(p =>
        p.id === editingPrice.id ? updatedPrice : p
      ));
      setShowPriceDialog(false);
      resetForm();
    } catch (error) {
      console.error('Failed to update vendor price:', error);
      toast.error(t('failed_to_update') || 'Failed to update vendor price');
    }
  };

  const handleDelete = async () => {
    if (!priceToDelete) return;

    try {
      await procurementService.deleteVendorPrice(priceToDelete.id);
      setVendorPrices(prev => prev.filter(p => p.id !== priceToDelete.id));
      setShowDeleteDialog(false);
      setPriceToDelete(null);
    } catch (error) {
      console.error('Failed to delete vendor price:', error);
      toast.error(t('failed_to_delete') || 'Failed to delete vendor price');
    }
  };

  const handleEdit = (price) => {
    setEditingPrice(price);
    setFormData({
      vendor_id: price.vendor_id || '',
      product_id: price.product_id || '',
      price: price.price?.toString() || '',
      currency: price.currency || 'UZS',
      min_quantity: price.min_quantity || 1,
      lead_time_days: price.lead_time_days || 0,
      valid_from: price.valid_from?.split('T')[0] || '',
      valid_until: price.valid_until?.split('T')[0] || '',
      notes: price.notes || '',
      is_active: price.is_active !== false
    });
    setShowPriceDialog(true);
  };

  const toggleActive = async (price) => {
    const newStatus = !price.is_active;
    try {
      await procurementService.updateVendorPrice(price.id, { is_active: newStatus });
      setVendorPrices(prev => prev.map(p =>
        p.id === price.id ? { ...p, is_active: newStatus } : p
      ));
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = suppliers.find(s => s.id === vendorId);
    return vendor?.name || vendorId;
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || productId;
  };

  // Statistics
  const totalPrices = vendorPrices.length;
  const activePrices = vendorPrices.filter(p => p.is_active).length;
  const uniqueVendors = [...new Set(vendorPrices.map(p => p.vendor_id))].length;
  const uniqueProducts = [...new Set(vendorPrices.map(p => p.product_id))].length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6" />
            {t('vendor_pricelist') || 'Vendor Pricelist'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('vendor_pricelist_desc') || 'Manage product prices from different vendors'}
          </p>
        </div>
        {canCreate(MODULES.PURCHASES) && (
          <Button onClick={() => { resetForm(); setShowPriceDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t('add_price') || 'Add Price'}
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('total_prices') || 'Total Prices'}</CardDescription>
            <CardTitle className="text-3xl">{totalPrices}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {activePrices} {t('active') || 'active'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('vendors') || 'Vendors'}</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{uniqueVendors}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t('with_prices') || 'with prices'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('products') || 'Products'}</CardDescription>
            <CardTitle className="text-3xl text-green-600">{uniqueProducts}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t('in_pricelist') || 'in pricelist'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('active_prices') || 'Active'}</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{activePrices}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {totalPrices - activePrices} {t('inactive') || 'inactive'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('search_prices') || 'Search by vendor or product...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('all_vendors') || 'All Vendors'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_vendors') || 'All Vendors'}</SelectItem>
                {suppliers.map(vendor => (
                  <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses') || 'All'}</SelectItem>
                <SelectItem value="active">{t('active') || 'Active'}</SelectItem>
                <SelectItem value="inactive">{t('inactive') || 'Inactive'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Prices Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredPrices.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('no_prices_found') || 'No prices found'}</h3>
              <p className="text-muted-foreground mb-4">
                {t('no_prices_desc') || 'Add vendor prices to track product costs from different suppliers'}
              </p>
              {canCreate(MODULES.PURCHASES) && (
                <Button onClick={() => { resetForm(); setShowPriceDialog(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add_price') || 'Add Price'}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('vendor') || 'Vendor'}</TableHead>
                    <TableHead>{t('product') || 'Product'}</TableHead>
                    <TableHead className="text-right">{t('price') || 'Price'}</TableHead>
                    <TableHead className="text-right">{t('min_qty') || 'Min Qty'}</TableHead>
                    <TableHead className="text-center">{t('lead_time') || 'Lead Time'}</TableHead>
                    <TableHead>{t('validity') || 'Validity'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrices.map((price) => (
                    <TableRow key={price.id}>
                      <TableCell className="font-medium">{getVendorName(price.vendor_id)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          {getProductName(price.product_id)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(price.price, price.currency)}
                      </TableCell>
                      <TableCell className="text-right">{price.min_quantity || 1}</TableCell>
                      <TableCell className="text-center">
                        {price.lead_time_days > 0 ? (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit mx-auto">
                            <Clock className="w-3 h-3" />
                            {price.lead_time_days} {t('days') || 'days'}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {price.valid_from || price.valid_until ? (
                          <div className="text-xs">
                            {price.valid_from && <span>{format(new Date(price.valid_from), 'dd.MM.yyyy')}</span>}
                            {price.valid_from && price.valid_until && <span> - </span>}
                            {price.valid_until && <span>{format(new Date(price.valid_until), 'dd.MM.yyyy')}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={price.is_active ? 'default' : 'secondary'}
                          className={`cursor-pointer ${price.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                          onClick={() => canUpdate(MODULES.PURCHASES) && toggleActive(price)}
                        >
                          {price.is_active ? (
                            <><CheckCircle className="w-3 h-3 mr-1" />{t('active') || 'Active'}</>
                          ) : (
                            <><XCircle className="w-3 h-3 mr-1" />{t('inactive') || 'Inactive'}</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {canUpdate(MODULES.PURCHASES) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(price)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete(MODULES.PURCHASES) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setPriceToDelete(price); setShowDeleteDialog(true); }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
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

      {/* Add/Edit Price Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? (t('edit_price') || 'Edit Price') : (t('add_vendor_price') || 'Add Vendor Price')}
            </DialogTitle>
            <DialogDescription>
              {t('vendor_price_desc') || 'Set the price for a product from a specific vendor'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('vendor') || 'Vendor'} *</Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_vendor') || 'Select vendor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.status !== 'inactive').map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('product') || 'Product'} *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_product') || 'Select product'} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('price') || 'Price'} *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatPriceInput(formData.price)}
                  onChange={(e) => setFormData({ ...formData, price: parsePriceInput(e.target.value) })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('currency') || 'Currency'}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS (So'm)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('min_quantity') || 'Min Quantity'}</Label>
                <Input
                  type="number"
                  value={formData.min_quantity}
                  onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('lead_time_days') || 'Lead Time (days)'}</Label>
                <Input
                  type="number"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('valid_from') || 'Valid From'}</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('valid_until') || 'Valid Until'}</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('notes') || 'Notes'}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('enter_notes') || 'Additional notes...'}
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
              <Label htmlFor="is_active">{t('active') || 'Active'}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPriceDialog(false); resetForm(); }}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={editingPrice ? handleUpdate : handleCreate}
              disabled={!formData.vendor_id || !formData.product_id || !formData.price}
            >
              {editingPrice ? (t('update') || 'Update') : (t('add') || 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('delete_price') || 'Delete Price'}
            </DialogTitle>
            <DialogDescription>
              {t('delete_price_confirm') || 'Are you sure you want to delete this vendor price?'}
            </DialogDescription>
          </DialogHeader>

          {priceToDelete && (
            <div className="py-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('vendor') || 'Vendor'}:</span>
                <span className="font-medium">{getVendorName(priceToDelete.vendor_id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('product') || 'Product'}:</span>
                <span className="font-medium">{getProductName(priceToDelete.product_id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('price') || 'Price'}:</span>
                <span className="font-medium">{formatCurrency(priceToDelete.price, priceToDelete.currency)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setPriceToDelete(null); }}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('delete') || 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
