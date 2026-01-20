import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, Pencil, Trash2, Eye, DollarSign,
  Tag, Barcode, Box, Filter, MoreHorizontal, AlertCircle,
  CheckCircle, XCircle, ShoppingCart, Archive, Upload, Download, History,
  Layers, Printer
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import LotTracking from "./LotTracking";
import PriceLabelPrinting from "./PriceLabelPrinting";

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
  const [activeSubTab, setActiveSubTab] = useState("list");
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
    wholesale_price: '',
    is_stockable: true,
    track_inventory: true,
    min_stock_level: '',
    reorder_point: '',
    reorder_quantity: '',
    is_purchasable: true,
    is_sellable: true,
    is_active: true,
    tags: [],
    // New advanced fields
    brand: '',
    manufacturer: '',
    model_number: '',
    upc: '',
    ean: '',
    isbn: '',
    mpn: '', // Manufacturer Part Number
    // Weight & Dimensions
    weight: '',
    weight_unit: 'kg',
    length: '',
    width: '',
    height: '',
    dimension_unit: 'cm',
    // Additional info
    warranty_months: '',
    country_of_origin: '',
    hs_code: '', // Harmonized System code for customs
    tax_class: 'standard',
    // Variants
    has_variants: false,
    variant_attributes: [], // e.g., [{name: 'Color', values: ['Red', 'Blue']}, {name: 'Size', values: ['S', 'M', 'L']}]
    variants: [], // Generated variant combinations
    // Supplier info
    default_supplier_id: '',
    supplier_sku: '',
    lead_time_days: '',
    // Storage
    shelf_life_days: '',
    storage_conditions: '',
    requires_lot_tracking: false,
    requires_serial_tracking: false,
    // Media
    image_url: '',
    additional_images: [],
    // SEO/Web
    meta_title: '',
    meta_description: '',
    url_slug: '',
    // Units of Measure (SAP-style)
    inventory_uom: 'unit',
    sales_uom: 'unit',
    purchase_uom: 'unit',
    uom_conversion_factor: '1',
    // Invoicing Policy (Odoo-style)
    invoicing_policy: 'ordered', // 'ordered' or 'delivered'
    // Valuation Method per product
    valuation_method: 'fifo', // 'fifo', 'lifo', 'average', 'standard'
    standard_cost: '',
    // Customer Lead Time
    customer_lead_time_days: '',
    // Expiration tracking
    track_expiration: false,
    expiration_time_days: '', // Default expiration time from production/receipt
    use_expiration_date: false,
    use_best_before_date: false,
    removal_time_days: '', // Days before expiration to remove from available stock
    alert_time_days: '' // Days before expiration to show alert
  });

  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [newVariantAttribute, setNewVariantAttribute] = useState({ name: '', values: '' });

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
      wholesale_price: '',
      is_stockable: true,
      track_inventory: true,
      min_stock_level: '',
      reorder_point: '',
      reorder_quantity: '',
      is_purchasable: true,
      is_sellable: true,
      is_active: true,
      tags: [],
      // Advanced fields
      brand: '',
      manufacturer: '',
      model_number: '',
      upc: '',
      ean: '',
      isbn: '',
      mpn: '',
      weight: '',
      weight_unit: 'kg',
      length: '',
      width: '',
      height: '',
      dimension_unit: 'cm',
      warranty_months: '',
      country_of_origin: '',
      hs_code: '',
      tax_class: 'standard',
      has_variants: false,
      variant_attributes: [],
      variants: [],
      default_supplier_id: '',
      supplier_sku: '',
      lead_time_days: '',
      shelf_life_days: '',
      storage_conditions: '',
      requires_lot_tracking: false,
      requires_serial_tracking: false,
      image_url: '',
      additional_images: [],
      meta_title: '',
      meta_description: '',
      url_slug: '',
      // Units of Measure
      inventory_uom: 'unit',
      sales_uom: 'unit',
      purchase_uom: 'unit',
      uom_conversion_factor: '1',
      // Invoicing & Valuation
      invoicing_policy: 'ordered',
      valuation_method: 'fifo',
      standard_cost: '',
      // Customer Lead Time
      customer_lead_time_days: '',
      // Expiration tracking
      track_expiration: false,
      expiration_time_days: '',
      use_expiration_date: false,
      use_best_before_date: false,
      removal_time_days: '',
      alert_time_days: ''
    });
    setShowAdvancedFields(false);
    setNewVariantAttribute({ name: '', values: '' });
  };

  const handleCreate = () => {
    setIsSaving(true);
    try {
      const productData = {
        ...formData,
        cost_price: parseFloat(formData.cost_price) || 0,
        list_price: parseFloat(formData.list_price) || 0,
        min_price: parseFloat(formData.min_price) || 0,
        wholesale_price: parseFloat(formData.wholesale_price) || 0,
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        reorder_quantity: parseFloat(formData.reorder_quantity) || 0,
        weight: parseFloat(formData.weight) || null,
        length: parseFloat(formData.length) || null,
        width: parseFloat(formData.width) || null,
        height: parseFloat(formData.height) || null,
        warranty_months: parseInt(formData.warranty_months) || null,
        lead_time_days: parseInt(formData.lead_time_days) || null,
        shelf_life_days: parseInt(formData.shelf_life_days) || null,
        standard_cost: parseFloat(formData.standard_cost) || null,
        customer_lead_time_days: parseInt(formData.customer_lead_time_days) || null,
        expiration_time_days: parseInt(formData.expiration_time_days) || null,
        removal_time_days: parseInt(formData.removal_time_days) || null,
        alert_time_days: parseInt(formData.alert_time_days) || null,
        uom_conversion_factor: parseFloat(formData.uom_conversion_factor) || 1,
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
    const hasAdvancedData = product.brand || product.manufacturer || product.weight ||
                           product.has_variants || product.warranty_months || product.hs_code;
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
      wholesale_price: product.wholesale_price?.toString() || '',
      is_stockable: product.is_stockable !== false,
      track_inventory: product.track_inventory !== false,
      min_stock_level: product.min_stock_level?.toString() || '',
      reorder_point: product.reorder_point?.toString() || '',
      reorder_quantity: product.reorder_quantity?.toString() || '',
      is_purchasable: product.is_purchasable !== false,
      is_sellable: product.is_sellable !== false,
      is_active: product.is_active !== false,
      tags: product.tags || [],
      // Advanced fields
      brand: product.brand || '',
      manufacturer: product.manufacturer || '',
      model_number: product.model_number || '',
      upc: product.upc || '',
      ean: product.ean || '',
      isbn: product.isbn || '',
      mpn: product.mpn || '',
      weight: product.weight?.toString() || '',
      weight_unit: product.weight_unit || 'kg',
      length: product.length?.toString() || '',
      width: product.width?.toString() || '',
      height: product.height?.toString() || '',
      dimension_unit: product.dimension_unit || 'cm',
      warranty_months: product.warranty_months?.toString() || '',
      country_of_origin: product.country_of_origin || '',
      hs_code: product.hs_code || '',
      tax_class: product.tax_class || 'standard',
      has_variants: product.has_variants || false,
      variant_attributes: product.variant_attributes || [],
      variants: product.variants || [],
      default_supplier_id: product.default_supplier_id || '',
      supplier_sku: product.supplier_sku || '',
      lead_time_days: product.lead_time_days?.toString() || '',
      shelf_life_days: product.shelf_life_days?.toString() || '',
      storage_conditions: product.storage_conditions || '',
      requires_lot_tracking: product.requires_lot_tracking || false,
      requires_serial_tracking: product.requires_serial_tracking || false,
      image_url: product.image_url || '',
      additional_images: product.additional_images || [],
      meta_title: product.meta_title || '',
      meta_description: product.meta_description || '',
      url_slug: product.url_slug || '',
      // Units of Measure
      inventory_uom: product.inventory_uom || 'unit',
      sales_uom: product.sales_uom || 'unit',
      purchase_uom: product.purchase_uom || 'unit',
      uom_conversion_factor: product.uom_conversion_factor?.toString() || '1',
      // Invoicing & Valuation
      invoicing_policy: product.invoicing_policy || 'ordered',
      valuation_method: product.valuation_method || 'fifo',
      standard_cost: product.standard_cost?.toString() || '',
      // Customer Lead Time
      customer_lead_time_days: product.customer_lead_time_days?.toString() || '',
      // Expiration tracking
      track_expiration: product.track_expiration || false,
      expiration_time_days: product.expiration_time_days?.toString() || '',
      use_expiration_date: product.use_expiration_date || false,
      use_best_before_date: product.use_best_before_date || false,
      removal_time_days: product.removal_time_days?.toString() || '',
      alert_time_days: product.alert_time_days?.toString() || ''
    });
    setShowAdvancedFields(hasAdvancedData || product.track_expiration || product.valuation_method !== 'fifo');
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
        wholesale_price: parseFloat(formData.wholesale_price) || 0,
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        reorder_quantity: parseFloat(formData.reorder_quantity) || 0,
        weight: parseFloat(formData.weight) || null,
        length: parseFloat(formData.length) || null,
        width: parseFloat(formData.width) || null,
        height: parseFloat(formData.height) || null,
        warranty_months: parseInt(formData.warranty_months) || null,
        lead_time_days: parseInt(formData.lead_time_days) || null,
        shelf_life_days: parseInt(formData.shelf_life_days) || null,
        standard_cost: parseFloat(formData.standard_cost) || null,
        customer_lead_time_days: parseInt(formData.customer_lead_time_days) || null,
        expiration_time_days: parseInt(formData.expiration_time_days) || null,
        removal_time_days: parseInt(formData.removal_time_days) || null,
        alert_time_days: parseInt(formData.alert_time_days) || null,
        uom_conversion_factor: parseFloat(formData.uom_conversion_factor) || 1,
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
      {/* Sub-tabs for Products, Lots, Labels */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-lg mb-4">
          <TabsTrigger
            value="list"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Package className="w-4 h-4" />
            {t('products')}
          </TabsTrigger>
          <TabsTrigger
            value="lots"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Layers className="w-4 h-4" />
            {t('lots')}
          </TabsTrigger>
          <TabsTrigger
            value="labels"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Printer className="w-4 h-4" />
            {t('labels')}
          </TabsTrigger>
        </TabsList>

        {/* Products List Tab */}
        <TabsContent value="list" className="mt-0 space-y-4">
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
                {searchQuery ? t('no_products_found') || 'No products found' : t('no_products_yet') || 'No products yet'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? t('try_adjusting_search') || 'Try adjusting your search or filters'
                  : t('start_by_adding_product') || 'Start by adding your first product or service'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('add_first_product') || 'Add First Product'}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700 min-w-[200px]">{t('product')}</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">{t('sku_code')}</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-slate-700 min-w-[80px] whitespace-nowrap">{t('type')}</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">{t('category')}</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('cost')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('price')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('stock')}</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700 min-w-[80px] whitespace-nowrap">{t('status')}</TableHead>
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
                        <TableCell className="hidden sm:table-cell">
                          <div>
                            <p className="font-mono text-sm text-slate-700">{product.sku || '-'}</p>
                            <p className="text-xs text-slate-500">{product.code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge className={getTypeColor(product.type)}>
                            {product.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-slate-600">
                          {getCategoryName(product.category_id)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right font-medium text-slate-700 tabular-nums">
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
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={product.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }>
                            {product.is_active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
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
        </TabsContent>

        {/* Lots Tab */}
        <TabsContent value="lots" className="mt-0">
          <LotTracking />
        </TabsContent>

        {/* Labels Tab */}
        <TabsContent value="labels" className="mt-0">
          <PriceLabelPrinting />
        </TabsContent>
      </Tabs>

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

            {/* Advanced Fields Toggle */}
            <div className="border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--genix-blue)] hover:text-[var(--genix-purple)] transition-colors"
              >
                {showAdvancedFields ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    {t('hide_advanced_fields') || 'Hide Advanced Fields'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {t('show_advanced_fields') || 'Show Advanced Fields'}
                  </>
                )}
              </button>
            </div>

            {/* Advanced Fields Section */}
            {showAdvancedFields && (
              <>
                {/* Brand & Manufacturer */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('brand_manufacturer') || 'Brand & Manufacturer'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('brand') || 'Brand'}</label>
                      <Input
                        placeholder={t('brand_placeholder') || 'e.g., Samsung, Apple'}
                        value={formData.brand}
                        onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('manufacturer') || 'Manufacturer'}</label>
                      <Input
                        placeholder={t('manufacturer_placeholder') || 'e.g., Samsung Electronics'}
                        value={formData.manufacturer}
                        onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('model_number') || 'Model Number'}</label>
                      <Input
                        placeholder={t('model_placeholder') || 'e.g., SM-G998B'}
                        value={formData.model_number}
                        onChange={(e) => setFormData({...formData, model_number: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('mpn') || 'MPN (Manufacturer Part Number)'}</label>
                      <Input
                        placeholder={t('mpn_placeholder') || 'Manufacturer part number'}
                        value={formData.mpn}
                        onChange={(e) => setFormData({...formData, mpn: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Identifiers */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('additional_identifiers') || 'Additional Identifiers'}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('upc') || 'UPC'}</label>
                      <Input
                        placeholder="012345678901"
                        value={formData.upc}
                        onChange={(e) => setFormData({...formData, upc: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('ean') || 'EAN'}</label>
                      <Input
                        placeholder="0123456789012"
                        value={formData.ean}
                        onChange={(e) => setFormData({...formData, ean: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('isbn') || 'ISBN'}</label>
                      <Input
                        placeholder="978-0-123456-47-2"
                        value={formData.isbn}
                        onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Weight & Dimensions */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('weight_dimensions') || 'Weight & Dimensions'}</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('weight') || 'Weight'}</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.weight}
                          onChange={(e) => setFormData({...formData, weight: e.target.value})}
                          className="flex-1"
                        />
                        <Select
                          value={formData.weight_unit}
                          onValueChange={(value) => setFormData({...formData, weight_unit: value})}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="g">g</SelectItem>
                            <SelectItem value="lb">lb</SelectItem>
                            <SelectItem value="oz">oz</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('dimension_unit') || 'Dimension Unit'}</label>
                      <Select
                        value={formData.dimension_unit}
                        onValueChange={(value) => setFormData({...formData, dimension_unit: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cm">cm</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="in">in</SelectItem>
                          <SelectItem value="ft">ft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('length') || 'Length'}</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.length}
                        onChange={(e) => setFormData({...formData, length: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('width') || 'Width'}</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.width}
                        onChange={(e) => setFormData({...formData, width: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('height') || 'Height'}</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.height}
                        onChange={(e) => setFormData({...formData, height: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Product Variants */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    {t('product_variants') || 'Product Variants'}
                    <Badge className="bg-blue-100 text-blue-700 text-xs">{t('optional') || 'Optional'}</Badge>
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.has_variants}
                        onCheckedChange={(checked) => setFormData({...formData, has_variants: checked})}
                      />
                      <span className="text-sm text-slate-700">{t('this_product_has_variants') || 'This product has variants (e.g., Size, Color)'}</span>
                    </div>

                    {formData.has_variants && (
                      <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                        {/* Existing variant attributes */}
                        {formData.variant_attributes.length > 0 && (
                          <div className="space-y-2">
                            {formData.variant_attributes.map((attr, index) => (
                              <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                                <div className="flex-1">
                                  <span className="font-medium text-slate-700">{attr.name}:</span>
                                  <span className="text-slate-600 ml-2">{attr.values.join(', ')}</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newAttrs = formData.variant_attributes.filter((_, i) => i !== index);
                                    setFormData({...formData, variant_attributes: newAttrs});
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add new variant attribute */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Input
                              placeholder={t('attribute_name') || 'Attribute (e.g., Color)'}
                              value={newVariantAttribute.name}
                              onChange={(e) => setNewVariantAttribute({...newVariantAttribute, name: e.target.value})}
                            />
                          </div>
                          <div>
                            <Input
                              placeholder={t('attribute_values') || 'Values (comma separated)'}
                              value={newVariantAttribute.values}
                              onChange={(e) => setNewVariantAttribute({...newVariantAttribute, values: e.target.value})}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (newVariantAttribute.name && newVariantAttribute.values) {
                                const values = newVariantAttribute.values.split(',').map(v => v.trim()).filter(v => v);
                                setFormData({
                                  ...formData,
                                  variant_attributes: [
                                    ...formData.variant_attributes,
                                    { name: newVariantAttribute.name, values }
                                  ]
                                });
                                setNewVariantAttribute({ name: '', values: '' });
                              }
                            }}
                            disabled={!newVariantAttribute.name || !newVariantAttribute.values}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            {t('add_attribute') || 'Add'}
                          </Button>
                        </div>

                        {/* Variant preview */}
                        {formData.variant_attributes.length > 0 && (
                          <div className="text-sm text-slate-600">
                            <p className="font-medium mb-1">{t('variants_will_be_generated') || 'Variants will be generated for all combinations:'}</p>
                            <p className="text-xs text-slate-500">
                              {formData.variant_attributes.reduce((acc, attr) => acc * attr.values.length, 1)} {t('variants_total') || 'variants total'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Product Info */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('additional_info') || 'Additional Information'}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('warranty_months') || 'Warranty (Months)'}</label>
                      <Input
                        type="number"
                        placeholder="12"
                        value={formData.warranty_months}
                        onChange={(e) => setFormData({...formData, warranty_months: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('country_of_origin') || 'Country of Origin'}</label>
                      <Input
                        placeholder={t('country_placeholder') || 'e.g., China, USA'}
                        value={formData.country_of_origin}
                        onChange={(e) => setFormData({...formData, country_of_origin: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('hs_code') || 'HS Code (Customs)'}</label>
                      <Input
                        placeholder="8471.30.00"
                        value={formData.hs_code}
                        onChange={(e) => setFormData({...formData, hs_code: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('tax_class') || 'Tax Class'}</label>
                      <Select
                        value={formData.tax_class}
                        onValueChange={(value) => setFormData({...formData, tax_class: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">{t('standard') || 'Standard'}</SelectItem>
                          <SelectItem value="reduced">{t('reduced') || 'Reduced'}</SelectItem>
                          <SelectItem value="zero">{t('zero_rate') || 'Zero Rate'}</SelectItem>
                          <SelectItem value="exempt">{t('tax_exempt') || 'Tax Exempt'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('lead_time_days') || 'Lead Time (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="7"
                        value={formData.lead_time_days}
                        onChange={(e) => setFormData({...formData, lead_time_days: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('shelf_life_days') || 'Shelf Life (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="365"
                        value={formData.shelf_life_days}
                        onChange={(e) => setFormData({...formData, shelf_life_days: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Storage & Tracking */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('storage_tracking') || 'Storage & Tracking'}</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('storage_conditions') || 'Storage Conditions'}</label>
                      <Input
                        placeholder={t('storage_placeholder') || 'e.g., Keep in cool, dry place'}
                        value={formData.storage_conditions}
                        onChange={(e) => setFormData({...formData, storage_conditions: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.requires_lot_tracking}
                          onCheckedChange={(checked) => setFormData({...formData, requires_lot_tracking: checked})}
                        />
                        <span className="text-sm text-slate-700">{t('requires_lot_tracking') || 'Requires Lot/Batch Tracking'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.requires_serial_tracking}
                          onCheckedChange={(checked) => setFormData({...formData, requires_serial_tracking: checked})}
                        />
                        <span className="text-sm text-slate-700">{t('requires_serial_tracking') || 'Requires Serial Number Tracking'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wholesale Price */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('wholesale_pricing') || 'Wholesale Pricing'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('wholesale_price') || 'Wholesale Price'}</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-9"
                          value={formData.wholesale_price}
                          onChange={(e) => setFormData({...formData, wholesale_price: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Units of Measure (SAP-style) */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    {t('units_of_measure') || 'Units of Measure'}
                    <Badge className="bg-purple-100 text-purple-700 text-xs">SAP</Badge>
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('inventory_uom') || 'Inventory UoM'}</label>
                      <Select
                        value={formData.inventory_uom}
                        onValueChange={(value) => setFormData({...formData, inventory_uom: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unit">{t('uom_unit') || 'Unit (pc)'}</SelectItem>
                          <SelectItem value="kg">{t('uom_kg') || 'Kilogram (kg)'}</SelectItem>
                          <SelectItem value="g">{t('uom_g') || 'Gram (g)'}</SelectItem>
                          <SelectItem value="l">{t('uom_l') || 'Liter (L)'}</SelectItem>
                          <SelectItem value="ml">{t('uom_ml') || 'Milliliter (mL)'}</SelectItem>
                          <SelectItem value="m">{t('uom_m') || 'Meter (m)'}</SelectItem>
                          <SelectItem value="cm">{t('uom_cm') || 'Centimeter (cm)'}</SelectItem>
                          <SelectItem value="box">{t('uom_box') || 'Box'}</SelectItem>
                          <SelectItem value="pack">{t('uom_pack') || 'Pack'}</SelectItem>
                          <SelectItem value="dozen">{t('uom_dozen') || 'Dozen'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('sales_uom') || 'Sales UoM'}</label>
                      <Select
                        value={formData.sales_uom}
                        onValueChange={(value) => setFormData({...formData, sales_uom: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unit">{t('uom_unit') || 'Unit (pc)'}</SelectItem>
                          <SelectItem value="kg">{t('uom_kg') || 'Kilogram (kg)'}</SelectItem>
                          <SelectItem value="g">{t('uom_g') || 'Gram (g)'}</SelectItem>
                          <SelectItem value="l">{t('uom_l') || 'Liter (L)'}</SelectItem>
                          <SelectItem value="ml">{t('uom_ml') || 'Milliliter (mL)'}</SelectItem>
                          <SelectItem value="m">{t('uom_m') || 'Meter (m)'}</SelectItem>
                          <SelectItem value="cm">{t('uom_cm') || 'Centimeter (cm)'}</SelectItem>
                          <SelectItem value="box">{t('uom_box') || 'Box'}</SelectItem>
                          <SelectItem value="pack">{t('uom_pack') || 'Pack'}</SelectItem>
                          <SelectItem value="dozen">{t('uom_dozen') || 'Dozen'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('purchase_uom') || 'Purchase UoM'}</label>
                      <Select
                        value={formData.purchase_uom}
                        onValueChange={(value) => setFormData({...formData, purchase_uom: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unit">{t('uom_unit') || 'Unit (pc)'}</SelectItem>
                          <SelectItem value="kg">{t('uom_kg') || 'Kilogram (kg)'}</SelectItem>
                          <SelectItem value="g">{t('uom_g') || 'Gram (g)'}</SelectItem>
                          <SelectItem value="l">{t('uom_l') || 'Liter (L)'}</SelectItem>
                          <SelectItem value="ml">{t('uom_ml') || 'Milliliter (mL)'}</SelectItem>
                          <SelectItem value="m">{t('uom_m') || 'Meter (m)'}</SelectItem>
                          <SelectItem value="cm">{t('uom_cm') || 'Centimeter (cm)'}</SelectItem>
                          <SelectItem value="box">{t('uom_box') || 'Box'}</SelectItem>
                          <SelectItem value="pack">{t('uom_pack') || 'Pack'}</SelectItem>
                          <SelectItem value="dozen">{t('uom_dozen') || 'Dozen'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('uom_conversion') || 'Conversion Factor'}</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1"
                        value={formData.uom_conversion_factor}
                        onChange={(e) => setFormData({...formData, uom_conversion_factor: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Invoicing & Valuation (Odoo-style) */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    {t('invoicing_valuation') || 'Invoicing & Valuation'}
                    <Badge className="bg-orange-100 text-orange-700 text-xs">Odoo</Badge>
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('invoicing_policy') || 'Invoicing Policy'}</label>
                      <Select
                        value={formData.invoicing_policy}
                        onValueChange={(value) => setFormData({...formData, invoicing_policy: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ordered">{t('invoice_on_order') || 'Ordered Quantities'}</SelectItem>
                          <SelectItem value="delivered">{t('invoice_on_delivery') || 'Delivered Quantities'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        {formData.invoicing_policy === 'ordered'
                          ? (t('invoice_order_desc') || 'Invoice when order is confirmed')
                          : (t('invoice_delivery_desc') || 'Invoice when delivery is completed')
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('valuation_method') || 'Valuation Method'}</label>
                      <Select
                        value={formData.valuation_method}
                        onValueChange={(value) => setFormData({...formData, valuation_method: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fifo">{t('fifo') || 'FIFO (First In, First Out)'}</SelectItem>
                          <SelectItem value="lifo">{t('lifo') || 'LIFO (Last In, First Out)'}</SelectItem>
                          <SelectItem value="average">{t('weighted_average') || 'Weighted Average'}</SelectItem>
                          <SelectItem value="standard">{t('standard_cost') || 'Standard Cost'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.valuation_method === 'standard' && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">{t('standard_cost_value') || 'Standard Cost Value'}</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-9"
                            value={formData.standard_cost}
                            onChange={(e) => setFormData({...formData, standard_cost: e.target.value})}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Lead Time */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('delivery_lead_times') || 'Delivery & Lead Times'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('customer_lead_time') || 'Customer Lead Time (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="3"
                        value={formData.customer_lead_time_days}
                        onChange={(e) => setFormData({...formData, customer_lead_time_days: e.target.value})}
                      />
                      <p className="text-xs text-slate-500 mt-1">{t('customer_lead_time_desc') || 'Delivery time to customer from order'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('supplier_lead_time') || 'Supplier Lead Time (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="7"
                        value={formData.lead_time_days}
                        onChange={(e) => setFormData({...formData, lead_time_days: e.target.value})}
                      />
                      <p className="text-xs text-slate-500 mt-1">{t('supplier_lead_time_desc') || 'Time to receive from supplier'}</p>
                    </div>
                  </div>
                </div>

                {/* Expiration Tracking (Odoo-style) */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    {t('expiration_tracking') || 'Expiration & Best Before'}
                    <Badge className="bg-red-100 text-red-700 text-xs">{t('perishable') || 'Perishable'}</Badge>
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.track_expiration}
                        onCheckedChange={(checked) => setFormData({...formData, track_expiration: checked})}
                      />
                      <span className="text-sm text-slate-700">{t('enable_expiration_tracking') || 'Enable expiration date tracking for this product'}</span>
                    </div>

                    {formData.track_expiration && (
                      <div className="bg-red-50 p-4 rounded-lg space-y-4">
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={formData.use_expiration_date}
                              onCheckedChange={(checked) => setFormData({...formData, use_expiration_date: checked})}
                            />
                            <span className="text-sm text-slate-700">{t('use_expiration_date') || 'Use Expiration Date'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={formData.use_best_before_date}
                              onCheckedChange={(checked) => setFormData({...formData, use_best_before_date: checked})}
                            />
                            <span className="text-sm text-slate-700">{t('use_best_before_date') || 'Use Best Before Date'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('expiration_time') || 'Expiration Time (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="365"
                              value={formData.expiration_time_days}
                              onChange={(e) => setFormData({...formData, expiration_time_days: e.target.value})}
                            />
                            <p className="text-xs text-slate-500 mt-1">{t('from_production') || 'From production/receipt'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('best_before_time') || 'Best Before (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="300"
                              value={formData.shelf_life_days}
                              onChange={(e) => setFormData({...formData, shelf_life_days: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('removal_time') || 'Removal Time (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="30"
                              value={formData.removal_time_days}
                              onChange={(e) => setFormData({...formData, removal_time_days: e.target.value})}
                            />
                            <p className="text-xs text-slate-500 mt-1">{t('before_expiration') || 'Before expiration'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('alert_time') || 'Alert Time (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="60"
                              value={formData.alert_time_days}
                              onChange={(e) => setFormData({...formData, alert_time_days: e.target.value})}
                            />
                            <p className="text-xs text-slate-500 mt-1">{t('show_warning') || 'Show warning'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

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
              {t('product_details') || 'Product Details'}
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
                      {selectedProduct.is_active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('code') || 'Code'}</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedProduct.code}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('sku') || 'SKU'}</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedProduct.sku || '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('category') || 'Category'}</p>
                  <p className="text-sm font-semibold text-slate-900">{getCategoryName(selectedProduct.category_id)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('barcode') || 'Barcode'}</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedProduct.barcode || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">{t('cost_price') || 'Cost Price'}</p>
                  <p className="text-lg font-bold text-blue-700">${(selectedProduct.cost_price || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">{t('list_price') || 'List Price'}</p>
                  <p className="text-lg font-bold text-green-700">${(selectedProduct.list_price || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1">{t('current_stock') || 'Current Stock'}</p>
                  <p className="text-lg font-bold text-purple-700">
                    {selectedProduct.is_stockable ? getProductStock(selectedProduct.id) : 'N/A'}
                  </p>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('description') || 'Description'}</p>
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
                  <Pencil className="w-4 h-4 mr-2" /> {t('edit') || 'Edit'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1"
                >
                  {t('close') || 'Close'}
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
              {t('delete_product') || 'Delete Product'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('confirm_delete_product') || 'Are you sure you want to delete'}{' '}
              <span className="font-semibold text-slate-900">"{selectedProduct?.name}"</span>?
              {t('action_cannot_be_undone') || 'This action cannot be undone.'}
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  {t('delete_product_warning') || 'Deleting this product may affect existing inventory records and transactions.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete') || 'Delete'}
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
