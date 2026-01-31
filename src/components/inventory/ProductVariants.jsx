import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Layers, Pencil, Trash2, Package, Palette,
  RefreshCw, ChevronDown, ChevronRight, Settings, Barcode, DollarSign
} from "lucide-react";
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

  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productAttributes, setProductAttributes] = useState([]);

  // Form states
  const [newAttribute, setNewAttribute] = useState({
    name: '',
    code: '',
    display_type: 'select',
    create_variant: true,
    values: []
  });
  const [newValue, setNewValue] = useState({ name: '', code: '', html_color: '' });
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

  useEffect(() => {
    loadAttributes();
    loadVariants();
  }, [loadAttributes, loadVariants]);

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
      setNewValue({ name: '', code: '', html_color: '' });
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
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteVariant(variant.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
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
            {/* Current product attributes */}
            {productAttributes.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">{t('current_attributes')}</h4>
                {productAttributes.map(pa => (
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
                  </div>
                ))}
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
    </div>
  );
}
