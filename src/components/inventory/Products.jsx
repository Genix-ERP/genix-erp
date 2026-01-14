import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, Pencil, Trash2, Eye, DollarSign,
  Tag, Barcode, Box, Filter, MoreHorizontal, AlertCircle,
  CheckCircle, XCircle, ShoppingCart, Archive, Upload, Download, History
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";

// Import universal ERP components
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  useAuditTrail,
} from '@/components/shared';

export default function Products() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    products,
    categories,
    inventory,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    updateCategory,
    deleteCategory,
    isLoading
  } = useInventory();

  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryManageModal, setShowCategoryManageModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');
  const { addAuditLog } = useAuditTrail('products');

  // Export columns configuration
  const exportColumns = [
    { key: 'code', label: 'Kod' },
    { key: 'name', label: 'Nomi' },
    { key: 'sku', label: 'SKU' },
    { key: 'barcode', label: 'Shtrix kod' },
    { key: 'type', label: 'Turi' },
    { key: 'cost_price', label: 'Tan narxi', render: (v) => `${(v || 0).toLocaleString()} UZS` },
    { key: 'list_price', label: 'Sotish narxi', render: (v) => `${(v || 0).toLocaleString()} UZS` },
    { key: 'is_active', label: 'Holat', render: (v) => v ? 'Faol' : 'Nofaol' },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'code', label: 'Kod', required: true },
    { key: 'name', label: 'Nomi', required: true },
    { key: 'sku', label: 'SKU' },
    { key: 'barcode', label: 'Shtrix kod' },
    { key: 'cost_price', label: 'Tan narxi' },
    { key: 'list_price', label: 'Sotish narxi', required: true },
  ];

  const handleImport = async (data) => {
    for (const row of data) {
      const productData = {
        code: row.code,
        name: row.name,
        sku: row.sku || '',
        barcode: row.barcode || '',
        type: 'product',
        cost_price: parseFloat(row.cost_price) || 0,
        list_price: parseFloat(row.list_price) || 0,
        is_stockable: true,
        track_inventory: true,
        is_purchasable: true,
        is_sellable: true,
        is_active: true,
      };
      createProduct(productData);
    }
    addAuditLog('create', 'batch', `${data.length} products imported`);
  };

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    sku: '',
    barcode: '',
    type: 'product',
    category_id: '',
    description: '',
    cost_price: '',
    list_price: '',
    min_price: '',
    is_stockable: true,
    track_inventory: true,
    min_stock_level: '',
    reorder_point: '',
    reorder_quantity: '',
    is_purchasable: true,
    is_sellable: true,
    is_active: true,
    tags: []
  });

  // Summary calculations
  const summaryStats = {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.is_active).length,
    stockableProducts: products.filter(p => p.is_stockable).length,
    serviceProducts: products.filter(p => p.type === 'service').length
  };

  useEffect(() => {
    setFilteredProducts(products);
  }, [products]);

  useEffect(() => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.includes(searchQuery)
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.category_id === categoryFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(product => product.type === typeFilter);
    }

    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        filtered = filtered.filter(product => product.is_active);
      } else if (statusFilter === "inactive") {
        filtered = filtered.filter(product => !product.is_active);
      }
    }

    setFilteredProducts(filtered);
  }, [searchQuery, categoryFilter, typeFilter, statusFilter, products]);

  const getProductStock = (productId) => {
    const stockItems = inventory.filter(i => i.product_id === productId);
    return stockItems.reduce((sum, i) => sum + i.quantity, 0);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      sku: '',
      barcode: '',
      type: 'product',
      category_id: '',
      description: '',
      cost_price: '',
      list_price: '',
      min_price: '',
      is_stockable: true,
      track_inventory: true,
      min_stock_level: '',
      reorder_point: '',
      reorder_quantity: '',
      is_purchasable: true,
      is_sellable: true,
      is_active: true,
      tags: []
    });
  };

  const handleCreate = () => {
    setIsSaving(true);
    try {
      const productData = {
        ...formData,
        cost_price: parseFloat(formData.cost_price) || 0,
        list_price: parseFloat(formData.list_price) || 0,
        min_price: parseFloat(formData.min_price) || 0,
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        reorder_quantity: parseFloat(formData.reorder_quantity) || 0
      };

      createProduct(productData);
      resetForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setFormData({
      code: product.code || '',
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      type: product.type || 'product',
      category_id: product.category_id || '',
      description: product.description || '',
      cost_price: product.cost_price?.toString() || '',
      list_price: product.list_price?.toString() || '',
      min_price: product.min_price?.toString() || '',
      is_stockable: product.is_stockable !== false,
      track_inventory: product.track_inventory !== false,
      min_stock_level: product.min_stock_level?.toString() || '',
      reorder_point: product.reorder_point?.toString() || '',
      reorder_quantity: product.reorder_quantity?.toString() || '',
      is_purchasable: product.is_purchasable !== false,
      is_sellable: product.is_sellable !== false,
      is_active: product.is_active !== false,
      tags: product.tags || []
    });
    setShowEditModal(true);
  };

  const handleUpdate = () => {
    setIsSaving(true);
    try {
      const productData = {
        ...formData,
        cost_price: parseFloat(formData.cost_price) || 0,
        list_price: parseFloat(formData.list_price) || 0,
        min_price: parseFloat(formData.min_price) || 0,
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        reorder_quantity: parseFloat(formData.reorder_quantity) || 0
      };

      updateProduct(selectedProduct.id, productData);
      resetForm();
      setSelectedProduct(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const handleDelete = () => {
    try {
      deleteProduct(selectedProduct.id);
      setSelectedProduct(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleViewDetail = (product) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;

    const categoryData = {
      code: newCategoryName.toUpperCase().replace(/\s+/g, '-').substring(0, 10),
      name: newCategoryName.trim(),
      description: '',
      parent_id: null,
      is_active: true
    };

    createCategory(categoryData);
    setNewCategoryName('');
    setShowCategoryModal(false);
  };

  const handleEditCategoryClick = (category) => {
    setSelectedCategory(category);
    setEditCategoryName(category.name);
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategory = () => {
    if (!editCategoryName.trim() || !selectedCategory) return;

    updateCategory(selectedCategory.id, {
      ...selectedCategory,
      name: editCategoryName.trim(),
      code: editCategoryName.toUpperCase().replace(/\s+/g, '-').substring(0, 10)
    });
    setEditCategoryName('');
    setSelectedCategory(null);
    setShowEditCategoryModal(false);
  };

  const handleDeleteCategoryClick = (category) => {
    setSelectedCategory(category);
    setShowDeleteCategoryModal(true);
  };

  const handleDeleteCategory = () => {
    if (!selectedCategory) return;

    deleteCategory(selectedCategory.id);
    setSelectedCategory(null);
    setShowDeleteCategoryModal(false);
  };

  const getTypeColor = (type) => {
    const colors = {
      product: 'bg-blue-100 text-blue-800 border-blue-200',
      service: 'bg-purple-100 text-purple-800 border-purple-200',
      bundle: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStockStatus = (product) => {
    if (!product.is_stockable) return null;
    const stock = getProductStock(product.id);
    if (stock === 0) return { label: t('out_of_stock'), color: 'bg-red-100 text-red-800 border-red-200' };
    if (stock <= product.min_stock_level) return { label: t('low_stock'), color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: t('in_stock'), color: 'bg-green-100 text-green-800 border-green-200' };
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || '-';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_products')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summaryStats.totalProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('active')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.activeProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('stockable')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {summaryStats.stockableProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Box className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('services')}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {summaryStats.serviceProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-[var(--genix-blue)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('products_services')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredProducts.length} {t('items')}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_products')}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px] bg-slate-50">
                    <SelectValue placeholder={t('category')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_categories')}</SelectItem>
                    {categories.filter(c => !c.parent_id).map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCategoryManageModal(true)}
                  title={t('manage_categories')}
                  className="h-10 w-10"
                >
                  <Tag className="w-4 h-4" />
                </Button>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] bg-slate-50">
                  <SelectValue placeholder={t('type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types')}</SelectItem>
                  <SelectItem value="product">{t('product')}</SelectItem>
                  <SelectItem value="service">{t('service')}</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] bg-slate-50">
                  <SelectValue placeholder={t('status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status')}</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="inactive">{t('inactive')}</SelectItem>
                </SelectContent>
              </Select>
              <ImportExportButtons
                onImport={() => setShowImportModal(true)}
                onExport={() => setShowExportModal(true)}
              />
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('new_product')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">{t('loading')}</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Package className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? 'No products found' : 'No products yet'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Start by adding your first product or service'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add First Product
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700 min-w-[200px]">{t('product')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">{t('sku_code')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 min-w-[80px] whitespace-nowrap">{t('type')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">{t('category')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('cost')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('price')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('stock')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 min-w-[80px] whitespace-nowrap">{t('status')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center min-w-[100px] whitespace-nowrap">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product);
                    const currentStock = getProductStock(product.id);
                    return (
                      <TableRow
                        key={product.id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{product.name}</p>
                              {product.barcode && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Barcode className="w-3 h-3" /> {product.barcode}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm text-slate-700">{product.sku || '-'}</p>
                            <p className="text-xs text-slate-500">{product.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(product.type)}>
                            {product.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {getCategoryName(product.category_id)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700 tabular-nums">
                          ${(product.cost_price || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 tabular-nums">
                          ${(product.list_price || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.is_stockable ? (
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-slate-900 tabular-nums">{currentStock}</span>
                              {stockStatus && (
                                <Badge className={`${stockStatus.color} text-xs mt-1`}>
                                  {stockStatus.label}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={product.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(product)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(product)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Product Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-[var(--genix-blue)]" />
              {showEditModal ? t('edit_product') : t('new_product')}
            </DialogTitle>
            <DialogDescription>
              {showEditModal ? t('update_product_info') : t('add_product_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('basic_information')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('code')} *</label>
                  <Input
                    placeholder={t('code_placeholder')}
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('type')} *</label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      type: value,
                      is_stockable: value === 'product',
                      track_inventory: value === 'product'
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">{t('product')}</SelectItem>
                      <SelectItem value="service">{t('service')}</SelectItem>
                      <SelectItem value="bundle">{t('bundle')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name')} *</label>
                <Input
                  placeholder={t('product_name_placeholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('sku')}</label>
                  <Input
                    placeholder={t('sku')}
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('barcode')}</label>
                  <Input
                    placeholder={t('barcode')}
                    value={formData.barcode}
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('category')}</label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({...formData, category_id: value})}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('select_category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowCategoryModal(true)}
                      title={t('add_category')}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description')}</label>
                <Textarea
                  placeholder={t('product_description_placeholder')}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={2}
                />
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('pricing')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('cost_price')}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('list_price')} *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.list_price}
                      onChange={(e) => setFormData({...formData, list_price: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('min_price')}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.min_price}
                      onChange={(e) => setFormData({...formData, min_price: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Settings */}
            {formData.type === 'product' && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">{t('inventory_settings')}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('min_stock_level')}</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('reorder_point')}</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.reorder_point}
                      onChange={(e) => setFormData({...formData, reorder_point: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('reorder_qty')}</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.reorder_quantity}
                      onChange={(e) => setFormData({...formData, reorder_quantity: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_stockable}
                      onCheckedChange={(checked) => setFormData({...formData, is_stockable: checked})}
                    />
                    <span className="text-sm text-slate-700">{t('stockable')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.track_inventory}
                      onCheckedChange={(checked) => setFormData({...formData, track_inventory: checked})}
                    />
                    <span className="text-sm text-slate-700">{t('track_inventory')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Options */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('options')}</h4>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_purchasable}
                    onCheckedChange={(checked) => setFormData({...formData, is_purchasable: checked})}
                  />
                  <span className="text-sm text-slate-700">{t('can_be_purchased')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_sellable}
                    onCheckedChange={(checked) => setFormData({...formData, is_sellable: checked})}
                  />
                  <span className="text-sm text-slate-700">{t('can_be_sold')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                  />
                  <span className="text-sm text-slate-700">{t('active')}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={showEditModal ? handleUpdate : handleCreate}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !formData.name || !formData.code}
              >
                {isSaving ? t('saving') : showEditModal ? t('update_product') : t('create_product')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-[var(--genix-blue)]" />
              Product Details
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Package className="w-8 h-8 text-slate-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getTypeColor(selectedProduct.type)}>
                      {selectedProduct.type}
                    </Badge>
                    <Badge className={selectedProduct.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-600'
                    }>
                      {selectedProduct.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Code</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedProduct.code}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">SKU</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedProduct.sku || '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Category</p>
                  <p className="text-sm font-semibold text-slate-900">{getCategoryName(selectedProduct.category_id)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Barcode</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedProduct.barcode || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Cost Price</p>
                  <p className="text-lg font-bold text-blue-700">${(selectedProduct.cost_price || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">List Price</p>
                  <p className="text-lg font-bold text-green-700">${(selectedProduct.list_price || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1">Current Stock</p>
                  <p className="text-lg font-bold text-purple-700">
                    {selectedProduct.is_stockable ? getProductStock(selectedProduct.id) : 'N/A'}
                  </p>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700">{selectedProduct.description}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedProduct);
                  }}
                  className="flex-1"
                >
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Product
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-900">"{selectedProduct?.name}"</span>?
              This action cannot be undone.
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Deleting this product may affect existing inventory records and transactions.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        columns={importColumns}
        entityName="Mahsulotlar"
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={filteredProducts}
        columns={exportColumns}
        entityName="Mahsulotlar"
        title="Mahsulotlar ro'yxati"
      />

      {/* Create Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('add_category')}
            </DialogTitle>
            <DialogDescription>
              {t('add_category_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('category_name')} *
              </label>
              <Input
                placeholder={t('category_name_placeholder')}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateCategory}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={!newCategoryName.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management Modal */}
      <Dialog open={showCategoryManageModal} onOpenChange={setShowCategoryManageModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[var(--genix-purple)]" />
              {t('manage_categories')}
            </DialogTitle>
            <DialogDescription>
              {t('manage_categories_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Add new category inline */}
            <div className="flex gap-2">
              <Input
                placeholder={t('category_name_placeholder')}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                className="flex-1"
              />
              <Button
                onClick={handleCreateCategory}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={!newCategoryName.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('add')}
              </Button>
            </div>

            {/* Categories list */}
            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  {t('no_categories_yet')}
                </div>
              ) : (
                categories.map(category => (
                  <div
                    key={category.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 group"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{category.name}</p>
                      <p className="text-xs text-slate-500">{t('code')}: {category.code}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCategoryClick(category)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategoryClick(category)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCategoryManageModal(false)}
              >
                {t('close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
      <Dialog open={showEditCategoryModal} onOpenChange={setShowEditCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_category')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('category_name')} *
              </label>
              <Input
                placeholder={t('category_name_placeholder')}
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory()}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditCategoryModal(false);
                  setEditCategoryName('');
                  setSelectedCategory(null);
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleUpdateCategory}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={!editCategoryName.trim()}
              >
                {t('save_changes')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Modal */}
      <Dialog open={showDeleteCategoryModal} onOpenChange={setShowDeleteCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('delete_category')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('delete_category_confirm')}{' '}
              <span className="font-semibold text-slate-900">"{selectedCategory?.name}"</span>?
            </p>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700">
                  {t('delete_category_warning')}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteCategoryModal(false);
                  setSelectedCategory(null);
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDeleteCategory}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
