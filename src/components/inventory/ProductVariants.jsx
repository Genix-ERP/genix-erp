import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Layers, Pencil, Trash2, Package, Palette,
  RefreshCw, ChevronDown, ChevronRight, Settings, Barcode, DollarSign, Eye, PackagePlus
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import apiClient from "@/api/client";
import { useToast } from "@/components/ui/use-toast";

export default function ProductVariants() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { products } = useInventory();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("variants");
  const [attributes, setAttributes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");

  // Modals
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [showVariantDetailsModal, setShowVariantDetailsModal] = useState(false);
  const [showEditVariantModal, setShowEditVariantModal] = useState(false);
  const [showAttributeDetailsModal, setShowAttributeDetailsModal] = useState(false);
  const [showEditAttributeModal, setShowEditAttributeModal] = useState(false);
  const [showProductConfigDetailsModal, setShowProductConfigDetailsModal] = useState(false);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);

  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [editAttributeData, setEditAttributeData] = useState({
    name: '',
    code: '',
    display_type: 'select',
    create_variant: true
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [productAttributes, setProductAttributes] = useState([]);
  const [editVariantData, setEditVariantData] = useState({
    sku: '',
    barcode: '',
    cost_price: '',
    list_price: '',
    is_active: true
  });

  // Form states
  const [newAttribute, setNewAttribute] = useState({
    name: '',
    code: '',
    display_type: 'select',
    create_variant: true,
    values: []
  });
  const [newValue, setNewValue] = useState({ name: '', code: '', html_color: '', price_extra: '' });
  const [warehouses, setWarehouses] = useState([]);
  const [stockAdjustment, setStockAdjustment] = useState({
    warehouse_id: '',
    quantity: '',
    reason: 'initial_stock',
    notes: ''
  });
  const [newVariant, setNewVariant] = useState({
    product_id: '',
    sku: '',
    barcode: '',
    cost_price: '',
    list_price: '',
    attribute_value_ids: []
  });

  // Load data
  const loadAttributes = useCallback(async () => {
    try {
      const response = await apiClient.get('/product-attributes');
      setAttributes(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load attributes:', error);
    }
  }, []);

  const loadVariants = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = productFilter !== 'all' ? { product_id: productFilter } : {};
      const response = await apiClient.get('/product-variants', { params });
      setVariants(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load variants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [productFilter]);

  const loadProductAttributes = useCallback(async (productId) => {
    try {
      const response = await apiClient.get(`/products/${productId}/attributes`);
      setProductAttributes(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load product attributes:', error);
      setProductAttributes([]);
    }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const response = await apiClient.get('/warehouses');
      setWarehouses(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load warehouses:', error);
    }
  }, []);

  useEffect(() => {
    loadAttributes();
    loadVariants();
    loadWarehouses();
  }, [loadAttributes, loadVariants, loadWarehouses]);

  // Filter variants
  const filteredVariants = variants.filter(v => {
    const matchesSearch = !searchQuery ||
      v.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Handlers
  const handleCreateAttribute = async () => {
    try {
      await apiClient.post('/product-attributes', newAttribute);
      toast({ title: t('success'), description: t('attribute_created') });
      setShowAttributeModal(false);
      setNewAttribute({ name: '', code: '', display_type: 'select', create_variant: true, values: [] });
      loadAttributes();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleAddValue = async () => {
    if (!selectedAttribute) return;
    try {
      await apiClient.post(`/product-attributes/${selectedAttribute.id}/values`, newValue);
      toast({ title: t('success'), description: t('value_added') });
      setShowValueModal(false);
      setNewValue({ name: '', code: '', html_color: '', price_extra: '' });
      loadAttributes();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteAttribute = async (id) => {
    if (!confirm(t('confirm_delete_attribute'))) return;
    try {
      await apiClient.delete(`/product-attributes/${id}`);
      toast({ title: t('success'), description: t('attribute_deleted') });
      loadAttributes();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteValue = async (attrId, valueId) => {
    if (!confirm(t('confirm_delete_value'))) return;
    try {
      await apiClient.delete(`/product-attributes/${attrId}/values/${valueId}`);
      toast({ title: t('success'), description: t('value_deleted') });
      loadAttributes();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleConfigureProduct = (product) => {
    setSelectedProduct(product);
    loadProductAttributes(product.id);
    setShowConfigureModal(true);
  };

  const handleViewProductConfig = (product) => {
    setSelectedProduct(product);
    loadProductAttributes(product.id);
    setShowProductConfigDetailsModal(true);
  };

  const handleAddAttributeToProduct = async (attributeId, valueIds) => {
    if (!selectedProduct) return;
    try {
      await apiClient.post(`/products/${selectedProduct.id}/attributes`, {
        product_id: selectedProduct.id,
        attribute_id: attributeId,
        value_ids: valueIds
      });
      toast({ title: t('success'), description: t('attribute_added_to_product') });
      loadProductAttributes(selectedProduct.id);
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleGenerateVariants = async () => {
    if (!selectedProduct) return;
    try {
      const response = await apiClient.post('/product-variants/generate', {
        product_id: selectedProduct.id
      });
      toast({
        title: t('success'),
        description: `${t('generated')} ${response.data?.data?.created_count || 0} ${t('variants')}`
      });
      setShowGenerateModal(false);
      loadVariants();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteVariant = async (id) => {
    if (!confirm(t('confirm_delete_variant'))) return;
    try {
      await apiClient.delete(`/product-variants/${id}`);
      toast({ title: t('success'), description: t('variant_deleted') });
      loadVariants();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleViewVariant = (variant) => {
    setSelectedVariant(variant);
    setShowVariantDetailsModal(true);
  };

  const handleOpenEditVariant = (variant) => {
    setSelectedVariant(variant);
    setEditVariantData({
      sku: variant.sku || '',
      barcode: variant.barcode || '',
      cost_price: variant.cost_price || '',
      list_price: variant.list_price || '',
      is_active: variant.is_active !== false
    });
    setShowVariantDetailsModal(false);
    setShowEditVariantModal(true);
  };

  const handleUpdateVariant = async () => {
    if (!selectedVariant) return;
    try {
      await apiClient.put(`/product-variants/${selectedVariant.id}`, editVariantData);
      toast({ title: t('success'), description: t('variant_updated') });
      setShowEditVariantModal(false);
      setSelectedVariant(null);
      loadVariants();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleViewAttribute = (attr) => {
    setSelectedAttribute(attr);
    setShowAttributeDetailsModal(true);
  };

  const handleOpenEditAttribute = (attr) => {
    setSelectedAttribute(attr);
    setEditAttributeData({
      name: attr.name || '',
      code: attr.code || '',
      display_type: attr.display_type || 'select',
      create_variant: attr.create_variant !== false
    });
    setShowAttributeDetailsModal(false);
    setShowEditAttributeModal(true);
  };

  const handleUpdateAttribute = async () => {
    if (!selectedAttribute) return;
    try {
      await apiClient.put(`/product-attributes/${selectedAttribute.id}`, editAttributeData);
      toast({ title: t('success'), description: t('attribute_updated') });
      setShowEditAttributeModal(false);
      setSelectedAttribute(null);
      loadAttributes();
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleOpenAdjustStock = (variant) => {
    setSelectedVariant(variant);
    setStockAdjustment({
      warehouse_id: warehouses.length > 0 ? warehouses[0].id : '',
      quantity: '',
      reason: 'initial_stock',
      notes: ''
    });
    setShowAdjustStockModal(true);
  };

  const handleAdjustStock = async () => {
    if (!selectedVariant || !stockAdjustment.warehouse_id || !stockAdjustment.quantity) {
      toast({ title: t('error'), description: t('fill_required_fields'), variant: 'destructive' });
      return;
    }
    try {
      await apiClient.post('/inventory/adjust', {
        product_id: selectedVariant.product_id,
        variant_id: selectedVariant.id,
        warehouse_id: stockAdjustment.warehouse_id,
        quantity: parseFloat(stockAdjustment.quantity),
        reason: stockAdjustment.reason,
        notes: stockAdjustment.notes
      });
      toast({ title: t('success'), description: t('stock_adjusted') });
      setShowAdjustStockModal(false);
      setSelectedVariant(null);
      loadVariants();
    } catch (error) {
      toast({ title: t('error'), description: error.response?.data?.message || error.message, variant: 'destructive' });
    }
  };

  // Products with variants capability
  const productsWithVariants = products.filter(p => p.type === 'product' || !p.type);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-lg mb-4">
          <TabsTrigger value="variants" className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Layers className="w-4 h-4" />
            {t('variants')}
          </TabsTrigger>
          <TabsTrigger value="attributes" className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Settings className="w-4 h-4" />
            {t('attributes')}
          </TabsTrigger>
          <TabsTrigger value="configure" className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Package className="w-4 h-4" />
            {t('configure_products')}
          </TabsTrigger>
        </TabsList>

        {/* Variants Tab */}
        <TabsContent value="variants" className="mt-0 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white/80 border-slate-200/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t('total_variants')}</p>
                    <p className="text-2xl font-bold">{variants.length}</p>
                  </div>
                  <Layers className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 border-slate-200/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t('products_with_variants')}</p>
                    <p className="text-2xl font-bold">{new Set(variants.map(v => v.product_id)).size}</p>
                  </div>
                  <Package className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 border-slate-200/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t('total_attributes')}</p>
                    <p className="text-2xl font-bold">{attributes.length}</p>
                  </div>
                  <Palette className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white/80 border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder={t('search_variants')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t('all_products')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_products')}</SelectItem>
                    {productsWithVariants.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={loadVariants}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('refresh')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Variants Table */}
          <Card className="bg-white/80 border-slate-200/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('product')}</TableHead>
                    <TableHead>{t('variant')}</TableHead>
                    <TableHead>{t('sku')}</TableHead>
                    <TableHead>{t('barcode')}</TableHead>
                    <TableHead className="text-right">{t('cost_price')}</TableHead>
                    <TableHead className="text-right">{t('list_price')}</TableHead>
                    <TableHead className="text-right">{t('stock')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">{t('loading')}</TableCell>
                    </TableRow>
                  ) : filteredVariants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        {t('no_variants_found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVariants.map(variant => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium">{variant.product_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {variant.attributes?.map((attr, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {attr.html_color && (
                                  <span
                                    className="w-3 h-3 rounded-full mr-1 inline-block"
                                    style={{ backgroundColor: attr.html_color }}
                                  />
                                )}
                                {attr.value_name}
                              </Badge>
                            ))}
                            {(!variant.attributes || variant.attributes.length === 0) && (
                              <span className="text-slate-400">{variant.variant_name || '-'}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{variant.sku || '-'}</TableCell>
                        <TableCell>{variant.barcode || '-'}</TableCell>
                        <TableCell className="text-right">
                          {variant.cost_price ? `$${Number(variant.cost_price).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {variant.list_price ? `$${Number(variant.list_price).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{variant.stock_quantity || 0}</TableCell>
                        <TableCell>
                          <Badge className={variant.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                            {variant.is_active ? t('active') : t('inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenAdjustStock(variant)} title={t('adjust_stock')}>
                              <PackagePlus className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleViewVariant(variant)}>
                              <Eye className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteVariant(variant.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attributes Tab */}
        <TabsContent value="attributes" className="mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{t('product_attributes')}</h3>
            <Button onClick={() => setShowAttributeModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('add_attribute')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attributes.map(attr => (
              <Card key={attr.id} className="bg-white/80 border-slate-200/60">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{attr.name}</CardTitle>
                      {attr.code && <p className="text-xs text-slate-500">{attr.code}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAttribute(attr)}
                      >
                        <Eye className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedAttribute(attr);
                          setShowValueModal(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAttribute(attr.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {attr.values?.map(val => (
                      <Badge
                        key={val.id}
                        variant="outline"
                        className="flex items-center gap-1 pr-1"
                      >
                        {val.html_color && (
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: val.html_color }}
                          />
                        )}
                        {val.name}
                        <button
                          onClick={() => handleDeleteValue(attr.id, val.id)}
                          className="ml-1 text-slate-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    {(!attr.values || attr.values.length === 0) && (
                      <span className="text-sm text-slate-400">{t('no_values')}</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {t('display_type')}: {attr.display_type}
                  </div>
                </CardContent>
              </Card>
            ))}
            {attributes.length === 0 && (
              <Card className="col-span-full bg-slate-50 border-dashed">
                <CardContent className="p-8 text-center">
                  <Palette className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_attributes_yet')}</p>
                  <p className="text-sm text-slate-400 mt-1">{t('create_attributes_hint')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Configure Products Tab */}
        <TabsContent value="configure" className="mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{t('configure_product_variants')}</h3>
          </div>

          <Card className="bg-white/80 border-slate-200/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('product')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('has_variants')}</TableHead>
                    <TableHead>{t('variant_count')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsWithVariants.map(product => {
                    const productVariantCount = variants.filter(v => v.product_id === product.id).length;
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.type || 'product'}</Badge>
                        </TableCell>
                        <TableCell>
                          {product.has_variants ? (
                            <Badge className="bg-green-100 text-green-800">{t('yes')}</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600">{t('no')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{productVariantCount}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewProductConfig(product)}
                            >
                              <Eye className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConfigureProduct(product)}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              {t('configure')}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowGenerateModal(true);
                              }}
                              disabled={!product.has_variants && productVariantCount === 0}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              {t('generate')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Attribute Modal */}
      <Dialog open={showAttributeModal} onOpenChange={setShowAttributeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('create_attribute')}</DialogTitle>
            <DialogDescription>{t('create_attribute_description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{t('name')} *</label>
              <Input
                value={newAttribute.name}
                onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
                placeholder={t('attribute_name_placeholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('code')}</label>
              <Input
                value={newAttribute.code}
                onChange={(e) => setNewAttribute({ ...newAttribute, code: e.target.value })}
                placeholder={t('attribute_code_placeholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('display_type')}</label>
              <Select
                value={newAttribute.display_type}
                onValueChange={(v) => setNewAttribute({ ...newAttribute, display_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">{t('dropdown')}</SelectItem>
                  <SelectItem value="radio">{t('radio_buttons')}</SelectItem>
                  <SelectItem value="color">{t('color_picker')}</SelectItem>
                  <SelectItem value="pills">{t('pills')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('create_variants')}</label>
              <Switch
                checked={newAttribute.create_variant}
                onCheckedChange={(v) => setNewAttribute({ ...newAttribute, create_variant: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttributeModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleCreateAttribute} disabled={!newAttribute.name}>{t('create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Value Modal */}
      <Dialog open={showValueModal} onOpenChange={setShowValueModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('add_value')}</DialogTitle>
            <DialogDescription>
              {t('add_value_to')} {selectedAttribute?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{t('value_name')} *</label>
              <Input
                value={newValue.name}
                onChange={(e) => setNewValue({ ...newValue, name: e.target.value })}
                placeholder={t('value_placeholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('code')}</label>
              <Input
                value={newValue.code}
                onChange={(e) => setNewValue({ ...newValue, code: e.target.value })}
              />
            </div>
            {selectedAttribute?.display_type === 'color' && (
              <div>
                <label className="text-sm font-medium">{t('color')}</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={newValue.html_color || '#000000'}
                    onChange={(e) => setNewValue({ ...newValue, html_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={newValue.html_color}
                    onChange={(e) => setNewValue({ ...newValue, html_color: e.target.value })}
                    placeholder="#FF0000"
                    className="flex-1"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{t('price_extra')}</label>
              <Input
                type="number"
                step="0.01"
                value={newValue.price_extra}
                onChange={(e) => setNewValue({ ...newValue, price_extra: e.target.value })}
                placeholder="0.00"
              />
              <p className="text-xs text-slate-500 mt-1">{t('price_extra_hint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValueModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleAddValue} disabled={!newValue.name}>{t('add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Product Modal */}
      <Dialog open={showConfigureModal} onOpenChange={setShowConfigureModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('configure_variants_for')} {selectedProduct?.name}</DialogTitle>
            <DialogDescription>{t('select_attributes_and_values')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Current product attributes with option to add new values */}
            {productAttributes.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">{t('current_attributes')}</h4>
                {productAttributes.map(pa => {
                  // Find the full attribute to check for new values
                  const fullAttr = attributes.find(a => a.id === pa.attribute_id);
                  // Get IDs of values already configured for this product
                  const configuredValueIds = (pa.values || []).map(v => v.value_id);
                  // Find values that exist in the attribute but aren't configured for this product
                  const missingValues = fullAttr?.values?.filter(v => !configuredValueIds.includes(v.id)) || [];

                  return (
                    <div key={pa.pta_id} className="p-3 bg-slate-50 rounded-lg mb-2">
                      <div className="font-medium">{pa.attribute_name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pa.values?.map(v => (
                          <Badge key={v.ptav_id} variant="outline" className="text-xs">
                            {v.html_color && (
                              <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: v.html_color }} />
                            )}
                            {v.value_name}
                            {v.price_extra > 0 && ` (+$${v.price_extra})`}
                          </Badge>
                        ))}
                      </div>
                      {/* Show option to add missing values */}
                      {missingValues.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-500 mb-1">{t('add_new_values')}:</p>
                          <div className="flex flex-wrap gap-1">
                            {missingValues.map(val => (
                              <Button
                                key={val.id}
                                variant="outline"
                                size="sm"
                                className="text-xs h-6"
                                onClick={() => handleAddAttributeToProduct(pa.attribute_id, [val.id])}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                {val.html_color && (
                                  <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: val.html_color }} />
                                )}
                                {val.name}
                              </Button>
                            ))}
                            {missingValues.length > 1 && (
                              <Button
                                variant="link"
                                size="sm"
                                className="text-xs h-6 p-0"
                                onClick={() => handleAddAttributeToProduct(pa.attribute_id, missingValues.map(v => v.id))}
                              >
                                {t('add_all_new')}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new attributes */}
            <h4 className="font-medium">{t('add_attributes')}</h4>
            {attributes.map(attr => {
              const alreadyAdded = productAttributes.some(pa => pa.attribute_id === attr.id);
              if (alreadyAdded) return null;
              return (
                <div key={attr.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{attr.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attr.values?.map(val => (
                      <Button
                        key={val.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddAttributeToProduct(attr.id, [val.id])}
                      >
                        {val.html_color && (
                          <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: val.html_color }} />
                        )}
                        {val.name}
                      </Button>
                    ))}
                  </div>
                  {attr.values && attr.values.length > 1 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 p-0"
                      onClick={() => handleAddAttributeToProduct(attr.id, attr.values.map(v => v.id))}
                    >
                      {t('add_all_values')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigureModal(false)}>{t('close')}</Button>
            <Button
              onClick={() => {
                setShowConfigureModal(false);
                setShowGenerateModal(true);
              }}
              disabled={productAttributes.length === 0}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('generate_variants')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Variants Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('generate_variants')}</DialogTitle>
            <DialogDescription>
              {t('generate_variants_for')} {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600">
              {t('generate_variants_description')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleGenerateVariants}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Details Modal */}
      <Dialog open={showVariantDetailsModal} onOpenChange={setShowVariantDetailsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('variant_details')}</DialogTitle>
            <DialogDescription>
              {selectedVariant?.product_name} - {selectedVariant?.variant_name || selectedVariant?.display_name}
            </DialogDescription>
          </DialogHeader>
          {selectedVariant && (
            <div className="space-y-4 py-4">
              {/* Product Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('product')}</label>
                  <p className="font-medium">{selectedVariant.product_name}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('status')}</label>
                  <div>
                    <Badge className={selectedVariant.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                      {selectedVariant.is_active ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Variant Attributes */}
              {selectedVariant.attributes && selectedVariant.attributes.length > 0 && (
                <div>
                  <label className="text-sm text-slate-500">{t('attributes')}</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedVariant.attributes.map((attr, i) => (
                      <Badge key={i} variant="outline" className="text-sm">
                        {attr.html_color && (
                          <span
                            className="w-3 h-3 rounded-full mr-1 inline-block"
                            style={{ backgroundColor: attr.html_color }}
                          />
                        )}
                        <span className="text-slate-500 mr-1">{attr.attribute_name}:</span>
                        {attr.value_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* SKU & Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('sku')}</label>
                  <p className="font-medium">{selectedVariant.sku || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('barcode')}</label>
                  <p className="font-medium">{selectedVariant.barcode || '-'}</p>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('cost_price')}</label>
                  <p className="font-medium text-lg">
                    {selectedVariant.cost_price ? `$${Number(selectedVariant.cost_price).toFixed(2)}` : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('list_price')}</label>
                  <p className="font-medium text-lg text-green-600">
                    {selectedVariant.list_price ? `$${Number(selectedVariant.list_price).toFixed(2)}` : '-'}
                  </p>
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="text-sm text-slate-500">{t('stock_quantity')}</label>
                <p className="font-medium text-lg">{selectedVariant.stock_quantity || 0}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVariantDetailsModal(false)}>
              {t('close')}
            </Button>
            <Button onClick={() => handleOpenEditVariant(selectedVariant)}>
              <Pencil className="w-4 h-4 mr-2" />
              {t('edit_variant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Variant Modal */}
      <Dialog open={showEditVariantModal} onOpenChange={setShowEditVariantModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('edit_variant')}</DialogTitle>
            <DialogDescription>
              {selectedVariant?.product_name} - {selectedVariant?.variant_name || selectedVariant?.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{t('sku')}</label>
              <Input
                value={editVariantData.sku}
                onChange={(e) => setEditVariantData({ ...editVariantData, sku: e.target.value })}
                placeholder={t('enter_sku')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('barcode')}</label>
              <Input
                value={editVariantData.barcode}
                onChange={(e) => setEditVariantData({ ...editVariantData, barcode: e.target.value })}
                placeholder={t('enter_barcode')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('cost_price')}</label>
              <Input
                type="number"
                step="0.01"
                value={editVariantData.cost_price}
                onChange={(e) => setEditVariantData({ ...editVariantData, cost_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('list_price')}</label>
              <Input
                type="number"
                step="0.01"
                value={editVariantData.list_price}
                onChange={(e) => setEditVariantData({ ...editVariantData, list_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('is_active')}</label>
              <Switch
                checked={editVariantData.is_active}
                onCheckedChange={(v) => setEditVariantData({ ...editVariantData, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditVariantModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleUpdateVariant}>
              {t('save_changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attribute Details Modal */}
      <Dialog open={showAttributeDetailsModal} onOpenChange={setShowAttributeDetailsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('attribute_details')}</DialogTitle>
            <DialogDescription>
              {selectedAttribute?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedAttribute && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('name')}</label>
                  <p className="font-medium">{selectedAttribute.name}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('code')}</label>
                  <p className="font-medium">{selectedAttribute.code || '-'}</p>
                </div>
              </div>

              {/* Display Type & Create Variant */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('display_type')}</label>
                  <p className="font-medium capitalize">{selectedAttribute.display_type || 'select'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('create_variants')}</label>
                  <div>
                    <Badge className={selectedAttribute.create_variant !== false ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                      {selectedAttribute.create_variant !== false ? t('yes') : t('no')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Values */}
              <div>
                <label className="text-sm text-slate-500">{t('values')} ({selectedAttribute.values?.length || 0})</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAttribute.values?.map(val => (
                    <Badge key={val.id} variant="outline" className="text-sm py-1 px-2">
                      {val.html_color && (
                        <span
                          className="w-3 h-3 rounded-full mr-2 inline-block"
                          style={{ backgroundColor: val.html_color }}
                        />
                      )}
                      {val.name}
                      {val.code && <span className="text-slate-400 ml-1">({val.code})</span>}
                      {val.price_extra > 0 && (
                        <span className="text-green-600 ml-1">(+${Number(val.price_extra).toFixed(2)})</span>
                      )}
                    </Badge>
                  ))}
                  {(!selectedAttribute.values || selectedAttribute.values.length === 0) && (
                    <span className="text-slate-400">{t('no_values')}</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttributeDetailsModal(false)}>
              {t('close')}
            </Button>
            <Button onClick={() => handleOpenEditAttribute(selectedAttribute)}>
              <Pencil className="w-4 h-4 mr-2" />
              {t('edit_attribute')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Attribute Modal */}
      <Dialog open={showEditAttributeModal} onOpenChange={setShowEditAttributeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('edit_attribute')}</DialogTitle>
            <DialogDescription>
              {selectedAttribute?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{t('name')} *</label>
              <Input
                value={editAttributeData.name}
                onChange={(e) => setEditAttributeData({ ...editAttributeData, name: e.target.value })}
                placeholder={t('attribute_name_placeholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('code')}</label>
              <Input
                value={editAttributeData.code}
                onChange={(e) => setEditAttributeData({ ...editAttributeData, code: e.target.value })}
                placeholder={t('attribute_code_placeholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('display_type')}</label>
              <Select
                value={editAttributeData.display_type}
                onValueChange={(v) => setEditAttributeData({ ...editAttributeData, display_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">{t('dropdown')}</SelectItem>
                  <SelectItem value="radio">{t('radio_buttons')}</SelectItem>
                  <SelectItem value="color">{t('color_picker')}</SelectItem>
                  <SelectItem value="pills">{t('pills')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('create_variants')}</label>
              <Switch
                checked={editAttributeData.create_variant}
                onCheckedChange={(v) => setEditAttributeData({ ...editAttributeData, create_variant: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAttributeModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleUpdateAttribute} disabled={!editAttributeData.name}>
              {t('save_changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Configuration Details Modal */}
      <Dialog open={showProductConfigDetailsModal} onOpenChange={setShowProductConfigDetailsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('product_configuration')}</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              {/* Product Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('product')}</label>
                  <p className="font-medium">{selectedProduct.name}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('has_variants')}</label>
                  <div>
                    <Badge className={selectedProduct.has_variants ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                      {selectedProduct.has_variants ? t('yes') : t('no')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Product Type & Variant Count */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('type')}</label>
                  <p className="font-medium capitalize">{selectedProduct.type || 'product'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('variant_count')}</label>
                  <p className="font-medium">{variants.filter(v => v.product_id === selectedProduct.id).length}</p>
                </div>
              </div>

              {/* Base Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">{t('cost_price')}</label>
                  <p className="font-medium">{selectedProduct.cost_price ? `$${Number(selectedProduct.cost_price).toFixed(2)}` : '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">{t('list_price')}</label>
                  <p className="font-medium text-green-600">{selectedProduct.list_price ? `$${Number(selectedProduct.list_price).toFixed(2)}` : '-'}</p>
                </div>
              </div>

              {/* Configured Attributes */}
              <div>
                <label className="text-sm text-slate-500">{t('configured_attributes')} ({productAttributes.length})</label>
                {productAttributes.length > 0 ? (
                  <div className="space-y-3 mt-2">
                    {productAttributes.map(pa => {
                      // Find the full attribute to check for new values
                      const fullAttr = attributes.find(a => a.id === pa.attribute_id);
                      // Get IDs of values already configured for this product
                      const configuredValueIds = (pa.values || []).map(v => v.value_id);
                      // Find values that exist in the attribute but aren't configured for this product
                      const missingValues = fullAttr?.values?.filter(v => !configuredValueIds.includes(v.id)) || [];

                      return (
                        <div key={pa.pta_id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="font-medium text-sm">{pa.attribute_name}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pa.values?.map(v => (
                              <Badge key={v.ptav_id} variant="outline" className="text-xs">
                                {v.html_color && (
                                  <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: v.html_color }} />
                                )}
                                {v.value_name}
                                {v.price_extra > 0 && (
                                  <span className="text-green-600 ml-1">(+${Number(v.price_extra).toFixed(2)})</span>
                                )}
                              </Badge>
                            ))}
                          </div>
                          {/* Show missing values that can be added */}
                          {missingValues.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-xs text-amber-600">{t('new_values_available')}: {missingValues.map(v => v.name).join(', ')}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm mt-2">{t('no_attributes_configured')}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductConfigDetailsModal(false)}>
              {t('close')}
            </Button>
            <Button onClick={() => {
              setShowProductConfigDetailsModal(false);
              handleConfigureProduct(selectedProduct);
            }}>
              <Settings className="w-4 h-4 mr-2" />
              {t('edit_configuration')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Modal */}
      <Dialog open={showAdjustStockModal} onOpenChange={setShowAdjustStockModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('adjust_stock')}</DialogTitle>
            <DialogDescription>
              {selectedVariant?.display_name || selectedVariant?.variant_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">{t('current_stock')}</div>
              <div className="text-2xl font-bold">{selectedVariant?.stock_quantity || 0}</div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('warehouse')} *</label>
              <Select
                value={stockAdjustment.warehouse_id}
                onValueChange={(v) => setStockAdjustment({ ...stockAdjustment, warehouse_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_warehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('quantity')} *</label>
              <Input
                type="number"
                value={stockAdjustment.quantity}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                placeholder={t('enter_quantity_hint')}
              />
              <p className="text-xs text-slate-500 mt-1">{t('quantity_adjustment_hint')}</p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('reason')} *</label>
              <Select
                value={stockAdjustment.reason}
                onValueChange={(v) => setStockAdjustment({ ...stockAdjustment, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial_stock">{t('initial_stock')}</SelectItem>
                  <SelectItem value="received">{t('received')}</SelectItem>
                  <SelectItem value="adjustment">{t('adjustment')}</SelectItem>
                  <SelectItem value="damaged">{t('damaged')}</SelectItem>
                  <SelectItem value="lost">{t('lost')}</SelectItem>
                  <SelectItem value="returned">{t('returned')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('notes')}</label>
              <Textarea
                value={stockAdjustment.notes}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, notes: e.target.value })}
                placeholder={t('optional_notes')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustStockModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleAdjustStock} disabled={!stockAdjustment.warehouse_id || !stockAdjustment.quantity}>
              <PackagePlus className="w-4 h-4 mr-2" />
              {t('adjust_stock')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
