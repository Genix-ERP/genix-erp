import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Edit, Trash2, Tag, Star, StarOff, Loader2,
  DollarSign, Percent, Calculator, Package, Users, Calendar
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { pricelistsService } from '@/api/services/pricelists';
import { inventoryService } from '@/api/services/inventory';
import { format } from 'date-fns';

export default function Pricelists() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [pricelists, setPricelists] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPricelist, setSelectedPricelist] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    pricelist_type: 'sale',
    start_date: '',
    end_date: '',
    priority: 100,
    show_discount: true,
    is_active: true,
    is_default: false,
    items: []
  });

  const [newItem, setNewItem] = useState({
    applied_on: 'all_products',
    product_id: '',
    category_id: '',
    min_quantity: 1,
    compute_price: 'fixed_price',
    fixed_price: '',
    percent_price: 0,
    price_base: 'list_price',
    price_discount: 0,
    price_surcharge: 0,
    date_start: '',
    date_end: '',
    sequence: 10
  });

  // Fetch pricelists
  const fetchPricelists = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await pricelistsService.list();
      setPricelists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch pricelists:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch products and categories
  const fetchProductsAndCategories = useCallback(async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        inventoryService.listProducts({ limit: 500 }),
        inventoryService.listProductCategories()
      ]);
      setProducts(Array.isArray(productsData) ? productsData : productsData?.items || []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : categoriesData?.items || []);
    } catch (error) {
      console.error('Failed to fetch products/categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchPricelists();
    fetchProductsAndCategories();
  }, [fetchPricelists, fetchProductsAndCategories]);

  // Filter pricelists
  const filteredPricelists = pricelists.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      pricelist_type: 'sale',
      start_date: '',
      end_date: '',
      priority: 100,
      show_discount: true,
      is_active: true,
      is_default: false,
      items: []
    });
    setNewItem({
      applied_on: 'all_products',
      product_id: '',
      category_id: '',
      min_quantity: 1,
      compute_price: 'fixed_price',
      fixed_price: '',
      percent_price: 0,
      price_base: 'list_price',
      price_discount: 0,
      price_surcharge: 0,
      date_start: '',
      date_end: '',
      sequence: 10
    });
  };

  // Handle create
  const handleCreate = async () => {
    if (!formData.name) return;

    setIsSaving(true);
    try {
      await pricelistsService.create(formData);
      await fetchPricelists();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create pricelist:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle edit
  const handleEdit = async () => {
    if (!selectedPricelist || !formData.name) return;

    setIsSaving(true);
    try {
      await pricelistsService.update(selectedPricelist.id, formData);
      await fetchPricelists();
      setShowEditModal(false);
      setSelectedPricelist(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update pricelist:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedPricelist) return;

    try {
      await pricelistsService.delete(selectedPricelist.id);
      await fetchPricelists();
      setShowDeleteDialog(false);
      setSelectedPricelist(null);
    } catch (error) {
      console.error('Failed to delete pricelist:', error);
    }
  };

  // Handle set default
  const handleSetDefault = async (pricelist) => {
    try {
      await pricelistsService.setDefault(pricelist.id);
      await fetchPricelists();
    } catch (error) {
      console.error('Failed to set default pricelist:', error);
    }
  };

  // Open edit modal
  const openEditModal = async (pricelist) => {
    try {
      const fullPricelist = await pricelistsService.get(pricelist.id);
      setSelectedPricelist(fullPricelist);
      setFormData({
        name: fullPricelist.name || '',
        code: fullPricelist.code || '',
        description: fullPricelist.description || '',
        pricelist_type: fullPricelist.pricelist_type || 'sale',
        start_date: fullPricelist.start_date ? format(new Date(fullPricelist.start_date), 'yyyy-MM-dd') : '',
        end_date: fullPricelist.end_date ? format(new Date(fullPricelist.end_date), 'yyyy-MM-dd') : '',
        priority: fullPricelist.priority || 100,
        show_discount: fullPricelist.show_discount ?? true,
        is_active: fullPricelist.is_active ?? true,
        is_default: fullPricelist.is_default ?? false,
        items: fullPricelist.items || []
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load pricelist:', error);
    }
  };

  // Add item to pricelist
  const addItem = () => {
    const item = { ...newItem };
    if (item.compute_price === 'fixed_price' && item.fixed_price) {
      item.fixed_price = parseFloat(item.fixed_price);
    }
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));
    setNewItem({
      applied_on: 'all_products',
      product_id: '',
      category_id: '',
      min_quantity: 1,
      compute_price: 'fixed_price',
      fixed_price: '',
      percent_price: 0,
      price_base: 'list_price',
      price_discount: 0,
      price_surcharge: 0,
      date_start: '',
      date_end: '',
      sequence: 10
    });
  };

  // Remove item from pricelist
  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Get applied on label
  const getAppliedOnLabel = (item) => {
    switch (item.applied_on) {
      case 'all_products':
        return t('all_products') || 'All Products';
      case 'product_category':
        return item.category?.name || categories.find(c => c.id === item.category_id)?.name || t('category');
      case 'product':
        return item.product?.name || products.find(p => p.id === item.product_id)?.name || t('product');
      default:
        return item.applied_on;
    }
  };

  // Get compute price label
  const getComputePriceLabel = (item) => {
    switch (item.compute_price) {
      case 'fixed_price':
        return formatCurrency(item.fixed_price || 0);
      case 'percentage':
        return `${item.percent_price}% ${t('discount') || 'discount'}`;
      case 'formula':
        return `${t('formula') || 'Formula'}: ${item.price_discount}% + ${item.price_surcharge}`;
      default:
        return '-';
    }
  };

  // Render pricelist form
  const renderForm = (isEdit = false) => (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="general">{t('general') || 'General'}</TabsTrigger>
        <TabsTrigger value="rules">{t('price_rules') || 'Price Rules'}</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('name') || 'Name'} *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('pricelist_name') || 'Pricelist name'}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('code') || 'Code'}</Label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g., VIP, WHOLESALE"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('description') || 'Description'}</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('pricelist_description') || 'Pricelist description'}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('type') || 'Type'}</Label>
            <Select
              value={formData.pricelist_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, pricelist_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">{t('sales') || 'Sales'}</SelectItem>
                <SelectItem value="purchase">{t('purchase') || 'Purchase'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('priority') || 'Priority'}</Label>
            <Input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
              min={1}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('start_date') || 'Start Date'}</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('end_date') || 'End Date'}</Label>
            <Input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-6 pt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label>{t('active') || 'Active'}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.show_discount}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_discount: checked }))}
            />
            <Label>{t('show_discount') || 'Show Discount'}</Label>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rules" className="space-y-4 mt-4">
        {/* Add new rule */}
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">{t('add_price_rule') || 'Add Price Rule'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('apply_to') || 'Apply To'}</Label>
                <Select
                  value={newItem.applied_on}
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, applied_on: value, product_id: '', category_id: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_products">{t('all_products') || 'All Products'}</SelectItem>
                    <SelectItem value="product_category">{t('product_category') || 'Product Category'}</SelectItem>
                    <SelectItem value="product">{t('specific_product') || 'Specific Product'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newItem.applied_on === 'product_category' && (
                <div className="space-y-2">
                  <Label>{t('category') || 'Category'}</Label>
                  <Select
                    value={newItem.category_id}
                    onValueChange={(value) => setNewItem(prev => ({ ...prev, category_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_category') || 'Select category'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newItem.applied_on === 'product' && (
                <div className="space-y-2">
                  <Label>{t('product') || 'Product'}</Label>
                  <Select
                    value={newItem.product_id}
                    onValueChange={(value) => setNewItem(prev => ({ ...prev, product_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_product') || 'Select product'} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(prod => (
                        <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('min_quantity') || 'Min Quantity'}</Label>
                <Input
                  type="number"
                  value={newItem.min_quantity}
                  onChange={(e) => setNewItem(prev => ({ ...prev, min_quantity: parseFloat(e.target.value) || 1 }))}
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('price_type') || 'Price Type'}</Label>
                <Select
                  value={newItem.compute_price}
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, compute_price: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_price">{t('fixed_price') || 'Fixed Price'}</SelectItem>
                    <SelectItem value="percentage">{t('percentage_discount') || 'Percentage Discount'}</SelectItem>
                    <SelectItem value="formula">{t('formula') || 'Formula'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newItem.compute_price === 'fixed_price' && (
                <div className="space-y-2">
                  <Label>{t('price') || 'Price'}</Label>
                  <Input
                    type="number"
                    value={newItem.fixed_price}
                    onChange={(e) => setNewItem(prev => ({ ...prev, fixed_price: e.target.value }))}
                    placeholder="0"
                    min={0}
                  />
                </div>
              )}

              {newItem.compute_price === 'percentage' && (
                <div className="space-y-2">
                  <Label>{t('discount_percent') || 'Discount %'}</Label>
                  <Input
                    type="number"
                    value={newItem.percent_price}
                    onChange={(e) => setNewItem(prev => ({ ...prev, percent_price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    min={0}
                    max={100}
                  />
                </div>
              )}

              {newItem.compute_price === 'formula' && (
                <div className="space-y-2">
                  <Label>{t('discount_percent') || 'Discount %'}</Label>
                  <Input
                    type="number"
                    value={newItem.price_discount}
                    onChange={(e) => setNewItem(prev => ({ ...prev, price_discount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            {newItem.compute_price === 'formula' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('based_on') || 'Based On'}</Label>
                  <Select
                    value={newItem.price_base}
                    onValueChange={(value) => setNewItem(prev => ({ ...prev, price_base: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="list_price">{t('list_price') || 'List Price'}</SelectItem>
                      <SelectItem value="cost_price">{t('cost_price') || 'Cost Price'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('surcharge') || 'Surcharge'}</Label>
                  <Input
                    type="number"
                    value={newItem.price_surcharge}
                    onChange={(e) => setNewItem(prev => ({ ...prev, price_surcharge: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <Button onClick={addItem} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              {t('add_rule') || 'Add Rule'}
            </Button>
          </CardContent>
        </Card>

        {/* Existing rules */}
        {formData.items.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">
                {t('price_rules') || 'Price Rules'} ({formData.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('apply_to') || 'Apply To'}</TableHead>
                    <TableHead>{t('min_qty') || 'Min Qty'}</TableHead>
                    <TableHead>{t('price') || 'Price'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{getAppliedOnLabel(item)}</TableCell>
                      <TableCell>{item.min_quantity}</TableCell>
                      <TableCell>{getComputePriceLabel(item)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('search_pricelists') || 'Search pricelists...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('new_pricelist') || 'New Pricelist'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Tag className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pricelists.length}</p>
                <p className="text-sm text-slate-500">{t('total_pricelists') || 'Total Pricelists'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pricelists.filter(p => p.pricelist_type === 'sale').length}</p>
                <p className="text-sm text-slate-500">{t('sales_pricelists') || 'Sales Pricelists'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pricelists.reduce((sum, p) => sum + (p.item_count || 0), 0)}</p>
                <p className="text-sm text-slate-500">{t('price_rules') || 'Price Rules'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pricelists.filter(p => p.is_default).length}</p>
                <p className="text-sm text-slate-500">{t('default') || 'Default'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricelists Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredPricelists.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                {t('no_pricelists') || 'No Pricelists'}
              </h3>
              <p className="text-sm text-slate-500">
                {t('create_first_pricelist') || 'Create your first pricelist to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name') || 'Name'}</TableHead>
                  <TableHead>{t('code') || 'Code'}</TableHead>
                  <TableHead>{t('type') || 'Type'}</TableHead>
                  <TableHead>{t('rules') || 'Rules'}</TableHead>
                  <TableHead>{t('validity') || 'Validity'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPricelists.map((pricelist) => (
                  <TableRow key={pricelist.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pricelist.name}</span>
                        {pricelist.is_default && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                            <Star className="w-3 h-3 mr-1" />
                            {t('default') || 'Default'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pricelist.code ? (
                        <Badge variant="outline">{pricelist.code}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pricelist.pricelist_type === 'sale' ? 'default' : 'secondary'}>
                        {pricelist.pricelist_type === 'sale' ? t('sales') || 'Sales' : t('purchase') || 'Purchase'}
                      </Badge>
                    </TableCell>
                    <TableCell>{pricelist.item_count || 0}</TableCell>
                    <TableCell>
                      {pricelist.start_date || pricelist.end_date ? (
                        <span className="text-sm text-slate-500">
                          {pricelist.start_date ? format(new Date(pricelist.start_date), 'dd.MM.yyyy') : '∞'}
                          {' - '}
                          {pricelist.end_date ? format(new Date(pricelist.end_date), 'dd.MM.yyyy') : '∞'}
                        </span>
                      ) : (
                        <span className="text-slate-400">{t('always') || 'Always'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pricelist.is_active ? 'default' : 'secondary'}
                        className={pricelist.is_active ? 'bg-green-100 text-green-700' : ''}>
                        {pricelist.is_active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!pricelist.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSetDefault(pricelist)}
                            title={t('set_as_default') || 'Set as Default'}
                          >
                            <StarOff className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(pricelist)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {!pricelist.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSelectedPricelist(pricelist); setShowDeleteDialog(true); }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('create_pricelist') || 'Create Pricelist'}</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !formData.name}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('create') || 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit_pricelist') || 'Edit Pricelist'}</DialogTitle>
          </DialogHeader>
          {renderForm(true)}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleEdit} disabled={isSaving || !formData.name}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('save') || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_pricelist') || 'Delete Pricelist'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_pricelist_confirm') || 'Are you sure you want to delete this pricelist? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
