import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, Pencil, Trash2, Eye, DollarSign,
  Tag, Barcode, Box, Boxes, Filter, MoreHorizontal, AlertCircle,
  CheckCircle, XCircle, ShoppingCart, Archive, Upload, Download, History,
  Layers, Printer, HelpCircle, Truck, Calculator, RefreshCw, Scale
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useInventory } from "@/components/contexts/InventoryContext";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import LotTracking from "./LotTracking";
import PriceLabelPrinting from "./PriceLabelPrinting";
import ProductVariants from "./ProductVariants";
import Packages from "./Packages";
import PackageTypes from "./PackageTypes";
import COGSCalculator from "./COGSCalculator";
import UnitsOfMeasure from "./UnitsOfMeasure";
import apiClient from '@/api/client';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/api\/v1\/?$/, '');
const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return API_ORIGIN + url;
};
import { useToast } from "@/components/ui/use-toast";

// Import universal ERP components
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  useAuditTrail,
} from '@/components/shared';

// Field Help Component - Odoo-style tooltip for field explanations
// Note: TooltipProvider should be at a higher level, not per-component
const FieldHelp = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs bg-slate-800 text-white p-2 rounded-lg shadow-lg">
      <p>{text}</p>
    </TooltipContent>
  </Tooltip>
);

// Label with help tooltip
const LabelWithHelp = ({ label, helpText, required }) => (
  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center">
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

export default function Products() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const {
    products,
    categories,
    inventory,
    items,
    stockMovements,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    updateCategory,
    deleteCategory,
    isLoading
  } = useInventory();
  const { accounts } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { toast } = useToast();

  const emptyCategoryAccounts = {
    income_account_id: '',
    expense_account_id: '',
    stock_valuation_account_id: '',
    stock_input_account_id: '',
    stock_output_account_id: '',
  };

  // Compute default accounts by account_type code
  const defaultCategoryAccounts = useMemo(() => {
    const findByType = (typeCode) => accounts.find(a => a.account_type?.code === typeCode)?.id || '';
    return {
      income_account_id: findByType('REVENUE'),
      expense_account_id: findByType('COGS'),
      stock_valuation_account_id: findByType('INV'),
      stock_input_account_id: findByType('INV'),
      stock_output_account_id: findByType('COGS'),
    };
  }, [accounts]);

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
  const [categoryAccounts, setCategoryAccounts] = useState({ ...emptyCategoryAccounts });

  // Units of Measure (fetched from DB for dynamic selects)
  const [uomList, setUomList] = useState([]);

  // Variant management state (for edit modal)
  const [editProductAttributes, setEditProductAttributes] = useState([]);
  const [allAttributes, setAllAttributes] = useState([]);
  const [editProductVariants, setEditProductVariants] = useState([]);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

  // Set defaults when accounts load
  useEffect(() => {
    if (defaultCategoryAccounts.income_account_id && !showCategoryModal && !showEditCategoryModal) {
      setCategoryAccounts({ ...defaultCategoryAccounts });
    }
  }, [defaultCategoryAccounts]);
  const { addAuditLog } = useAuditTrail('products');

  // Fetch units of measure for dynamic selects
  useEffect(() => {
    const fetchUom = async () => {
      try {
        const res = await apiClient.get('/units-of-measure', { params: { limit: 200 } });
        setUomList(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        console.error('Failed to fetch UOM:', err);
      }
    };
    fetchUom();
  }, []);

  // Format number with thousands separators for display in price inputs
  const formatPriceDisplay = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const str = String(value);
    // Allow typing decimal point
    const parts = str.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (parts.length > 1) return intPart + '.' + parts[1];
    return intPart;
  };

  const handlePriceChange = (field, rawValue) => {
    // Strip everything except digits and dot
    const cleaned = rawValue.replace(/[^\d.]/g, '');
    // Prevent multiple dots
    const dotIndex = cleaned.indexOf('.');
    const sanitized = dotIndex >= 0
      ? cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '')
      : cleaned;
    setFormData(prev => ({ ...prev, [field]: sanitized }));
  };

  // Cleanup all modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowCreateModal(false);
      setShowEditModal(false);
      setShowDeleteModal(false);
      setShowDetailModal(false);
      setShowImportModal(false);
      setShowExportModal(false);
      setShowCategoryModal(false);
      setShowCategoryManageModal(false);
      setShowEditCategoryModal(false);
      setShowDeleteCategoryModal(false);
    };
  }, []);

  // Export columns configuration - comprehensive product fields
  const exportColumns = [
    // Basic Info
    { key: 'name', label: 'Nomi' },
    { key: 'barcode', label: 'Shtrix kod' },
    { key: 'type', label: 'Turi' },
    { key: 'category_id', label: 'Kategoriya', render: (v) => categories.find(c => c.id === v)?.name || '-' },
    { key: 'description', label: 'Tavsif' },
    { key: 'tags', label: 'Teglar', render: (v) => (v || []).join(', ') },

    // Pricing
    { key: 'cost_price', label: 'Tan narxi', render: (v) => formatCurrency(v || 0) },
    { key: 'list_price', label: 'Sotish narxi', render: (v) => formatCurrency(v || 0) },
    { key: 'min_price', label: 'Minimal narx', render: (v) => v ? formatCurrency(v) : '-' },
    { key: 'wholesale_price', label: 'Ulgurji narx', render: (v) => v ? formatCurrency(v) : '-' },

    // Stock Settings
    { key: 'is_stockable', label: 'Zaxira qilinadimi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'track_inventory', label: 'Inventar kuzatish', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'min_stock_level', label: 'Minimal zaxira' },
    { key: 'reorder_point', label: 'Qayta buyurtma nuqtasi' },
    { key: 'reorder_quantity', label: 'Qayta buyurtma miqdori' },

    // Sales & Purchase
    { key: 'is_purchasable', label: 'Sotib olinadimi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'is_sellable', label: 'Sotiladimi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'is_active', label: 'Holat', render: (v) => v ? 'Faol' : 'Nofaol' },

    // Module Visibility (Odoo-style)
    { key: 'can_be_sold', label: 'Sotish modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_purchased', label: 'Sotib olish modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'available_in_pos', label: 'POS modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_expensed', label: 'Xarajatlar modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_rented', label: 'Ijara modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_subcontracted', label: 'Subpudrat sifatida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'is_overhead_expense', label: 'Nakladnoy xarajat', render: (v) => v ? 'Ha' : 'Yo\'q' },

    // Identification
    { key: 'brand', label: 'Brend' },
    { key: 'manufacturer', label: 'Ishlab chiqaruvchi' },
    { key: 'model_number', label: 'Model raqami' },
    { key: 'upc', label: 'UPC' },
    { key: 'ean', label: 'EAN' },
    { key: 'isbn', label: 'ISBN' },
    { key: 'mpn', label: 'MPN' },

    // Physical Properties
    { key: 'weight', label: 'Og\'irlik' },
    { key: 'weight_unit', label: 'Og\'irlik birligi' },
    { key: 'length', label: 'Uzunlik' },
    { key: 'width', label: 'Kenglik' },
    { key: 'height', label: 'Balandlik' },
    { key: 'dimension_unit', label: 'O\'lcham birligi' },

    // Additional Info
    { key: 'warranty_months', label: 'Kafolat (oy)' },
    { key: 'country_of_origin', label: 'Kelib chiqish mamlakatiy' },
    { key: 'hs_code', label: 'HS kodi' },
    { key: 'tax_class', label: 'Soliq sinfi' },

    // Supplier Info
    { key: 'supplier_sku', label: 'Yetkazib beruvchi SKU' },
    { key: 'lead_time_days', label: 'Yetkazib berish muddati (kun)' },

    // Storage
    { key: 'shelf_life_days', label: 'Saqlash muddati (kun)' },
    { key: 'storage_conditions', label: 'Saqlash sharoitlari' },
    { key: 'requires_lot_tracking', label: 'Partiya kuzatuvi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'requires_serial_tracking', label: 'Seriya kuzatuvi', render: (v) => v ? 'Ha' : 'Yo\'q' },

    // Units of Measure
    { key: 'inventory_uom', label: 'Inventar birligi' },
    { key: 'sales_uom', label: 'Sotish birligi' },
    { key: 'purchase_uom', label: 'Sotib olish birligi' },
    { key: 'uom_conversion_factor', label: 'Birlik konvertatsiyasi' },

    // Expiration
    { key: 'track_expiration', label: 'Muddatni kuzatish', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'expiration_time_days', label: 'Yaroqlilik muddati (kun)' },
    { key: 'removal_time_days', label: 'Olib tashlash muddati (kun)' },
    { key: 'alert_time_days', label: 'Ogohlantirish muddati (kun)' },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'name', label: 'Nomi', required: true },
    { key: 'barcode', label: 'Shtrix kod' },
    { key: 'tags', label: 'Teglar' },
    { key: 'cost_price', label: 'Tan narxi' },
    { key: 'list_price', label: 'Sotish narxi', required: true },
  ];

  const handleImport = async (data) => {
    for (const row of data) {
      const generatedCode = row.barcode || row.name.toUpperCase().replace(/\s+/g, '-').substring(0, 50);
      const productData = {
        name: row.name,
        code: generatedCode,
        barcode: row.barcode || '',
        tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
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
    name: '',
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
    // Module visibility (Odoo-style)
    can_be_sold: true,
    can_be_purchased: true,
    available_in_pos: false,
    can_be_expensed: false,
    can_be_rented: false,
    can_be_subcontracted: false,
    is_overhead_expense: false,
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
    // Bundle/Combo items (for type 'combo')
    bundle_items: [], // [{product_id: '', quantity: 1, product_name: ''}]
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

  // Backend product attributes for variant selection
  const [backendAttributes, setBackendAttributes] = useState([]);
  const [selectedAttributeId, setSelectedAttributeId] = useState('');
  const [selectedValueIds, setSelectedValueIds] = useState([]);
  const [showCreateAttribute, setShowCreateAttribute] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrInlineValues, setNewAttrInlineValues] = useState([]); // [{name, price_extra}]
  const [newAttrValName, setNewAttrValName] = useState('');
  const [newAttrValPrice, setNewAttrValPrice] = useState('');
  const [isCreatingAttr, setIsCreatingAttr] = useState(false);
  const [showAddValue, setShowAddValue] = useState(false);
  const [newValueName, setNewValueName] = useState('');
  const [newValuePriceExtra, setNewValuePriceExtra] = useState('');
  const [isAddingValue, setIsAddingValue] = useState(false);

  const fetchBackendAttributes = async () => {
    try {
      const response = await apiClient.get('/product-attributes');
      setBackendAttributes(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load product attributes:', err);
    }
  };

  useEffect(() => {
    fetchBackendAttributes();
  }, []);

  const handleCreateInlineAttribute = async () => {
    if (!newAttrName.trim() || newAttrInlineValues.length === 0) return;
    setIsCreatingAttr(true);
    try {
      // Create attribute first (backend inline values don't support price_extra)
      const res = await apiClient.post('/product-attributes', {
        name: newAttrName.trim(),
        display_type: 'select',
        create_variant: true,
        values: [],
      });
      const attrId = res.data?.data?.id || res.data?.id;
      // Add each value with price_extra via separate endpoint
      if (attrId) {
        for (let i = 0; i < newAttrInlineValues.length; i++) {
          const v = newAttrInlineValues[i];
          await apiClient.post(`/product-attributes/${attrId}/values`, {
            name: v.name,
            price_extra: v.price_extra || 0,
            sort_order: i,
          });
        }
      }
      await fetchBackendAttributes();
      setNewAttrName('');
      setNewAttrInlineValues([]);
      setNewAttrValName('');
      setNewAttrValPrice('');
      setShowCreateAttribute(false);
    } catch (err) {
      console.error('Failed to create attribute:', err);
    } finally {
      setIsCreatingAttr(false);
    }
  };

  const handleAddValueToAttribute = async () => {
    if (!selectedAttributeId || !newValueName.trim()) return;
    setIsAddingValue(true);
    try {
      await apiClient.post(`/product-attributes/${selectedAttributeId}/values`, {
        name: newValueName.trim(),
        price_extra: parseFloat(newValuePriceExtra) || 0,
      });
      await fetchBackendAttributes();
      setNewValueName('');
      setNewValuePriceExtra('');
      setShowAddValue(false);
    } catch (err) {
      console.error('Failed to add value:', err);
    } finally {
      setIsAddingValue(false);
    }
  };

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
        product.barcode?.includes(searchQuery) ||
        (product.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
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
    return stockItems.reduce((sum, i) => sum + (i.quantity_on_hand ?? i.quantity ?? 0), 0);
  };

  const resetForm = () => {
    setFormData({
      name: '',
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
      // Module visibility (Odoo-style)
      can_be_sold: true,
      can_be_purchased: true,
      available_in_pos: false,
      can_be_expensed: false,
      can_be_rented: false,
      can_be_subcontracted: false,
      is_overhead_expense: false,
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
      bundle_items: [],
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
    setSelectedAttributeId('');
    setSelectedValueIds([]);
    setShowCreateAttribute(false);
    setNewAttrName('');
    setNewAttrInlineValues([]);
    setNewAttrValName('');
    setNewAttrValPrice('');
    setShowAddValue(false);
    setNewValueName('');
    setNewValuePriceExtra('');
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      // Generate code from barcode or name (backend requires 'code' field)
      const generatedCode = formData.barcode || formData.name.toUpperCase().replace(/\s+/g, '-').substring(0, 50);
      const productData = {
        ...formData,
        code: generatedCode,
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
        customer_lead_time_days: parseInt(formData.customer_lead_time_days) || null,
        expiration_time_days: parseInt(formData.expiration_time_days) || null,
        removal_time_days: parseInt(formData.removal_time_days) || null,
        alert_time_days: parseInt(formData.alert_time_days) || null,
        uom_conversion_factor: parseFloat(formData.uom_conversion_factor) || 1,
      };

      const newProduct = await createProduct(productData);

      // If product has variants, link attributes and generate variants
      if (formData.has_variants && formData.variant_attributes.length > 0 && newProduct?.id) {
        try {
          // Link each attribute + selected values to the product
          for (const attr of formData.variant_attributes) {
            await apiClient.post(`/products/${newProduct.id}/attributes`, {
              product_id: newProduct.id,
              attribute_id: attr.attribute_id,
              value_ids: attr.values.map(v => v.id),
            });
          }
          // Auto-generate variant combinations
          await apiClient.post('/product-variants/generate', {
            product_id: newProduct.id,
          });
        } catch (variantErr) {
          console.error('Error setting up variants:', variantErr);
        }
      }

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
      name: product.name || '',
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
      // Module visibility (Odoo-style)
      can_be_sold: product.can_be_sold !== false,
      can_be_purchased: product.can_be_purchased !== false,
      available_in_pos: product.available_in_pos || false,
      can_be_expensed: product.can_be_expensed || false,
      can_be_rented: product.can_be_rented || false,
      can_be_subcontracted: product.can_be_subcontracted || false,
      is_overhead_expense: product.is_overhead_expense || false,
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
      bundle_items: product.bundle_items || [],
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
    setShowAdvancedFields(hasAdvancedData || product.track_expiration);
    setShowEditModal(true);
    loadEditProductData(product.id);
  };

  // Load attributes and variants for the product being edited
  const loadEditProductData = async (productId) => {
    try {
      const [attrsRes, variantsRes, allAttrsRes] = await Promise.all([
        apiClient.get(`/products/${productId}/attributes`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/product-variants?product_id=${productId}`).catch(() => ({ data: { data: [] } })),
        apiClient.get('/product-attributes').catch(() => ({ data: { data: [] } })),
      ]);
      setEditProductAttributes(attrsRes.data?.data || []);
      const variantData = variantsRes.data?.data;
      setEditProductVariants(Array.isArray(variantData) ? variantData : variantData?.items || []);
      setAllAttributes(allAttrsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load product variant data:', err);
    }
  };

  const handleAddAttrToProduct = async (attributeId, valueIds) => {
    if (!selectedProduct) return;
    try {
      await apiClient.post(`/products/${selectedProduct.id}/attributes`, {
        product_id: selectedProduct.id,
        attribute_id: attributeId,
        value_ids: valueIds,
      });
      toast({ title: t('success'), description: t('attribute_added_to_product') || 'Attribute added' });
      loadEditProductData(selectedProduct.id);
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleGenerateProductVariants = async () => {
    if (!selectedProduct) return;
    setIsGeneratingVariants(true);
    try {
      const response = await apiClient.post('/product-variants/generate', {
        product_id: selectedProduct.id,
      });
      const count = response.data?.data?.created_count || 0;
      toast({ title: t('success'), description: `${t('generated') || 'Generated'} ${count} ${t('variants') || 'variants'}` });
      loadEditProductData(selectedProduct.id);
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const handleDeleteProductVariant = async (variantId) => {
    try {
      await apiClient.delete(`/product-variants/${variantId}`);
      toast({ title: t('success'), description: t('variant_deleted') || 'Variant deleted' });
      loadEditProductData(selectedProduct.id);
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
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
      is_active: true,
      income_account_id: categoryAccounts.income_account_id || null,
      expense_account_id: categoryAccounts.expense_account_id || null,
      stock_valuation_account_id: categoryAccounts.stock_valuation_account_id || null,
      stock_input_account_id: categoryAccounts.stock_input_account_id || null,
      stock_output_account_id: categoryAccounts.stock_output_account_id || null,
    };

    createCategory(categoryData);
    setNewCategoryName('');
    setCategoryAccounts({ ...defaultCategoryAccounts });
    setShowCategoryModal(false);
  };

  const handleEditCategoryClick = (category) => {
    setSelectedCategory(category);
    setEditCategoryName(category.name);
    setCategoryAccounts({
      income_account_id: category.income_account_id || defaultCategoryAccounts.income_account_id,
      expense_account_id: category.expense_account_id || defaultCategoryAccounts.expense_account_id,
      stock_valuation_account_id: category.stock_valuation_account_id || defaultCategoryAccounts.stock_valuation_account_id,
      stock_input_account_id: category.stock_input_account_id || defaultCategoryAccounts.stock_input_account_id,
      stock_output_account_id: category.stock_output_account_id || defaultCategoryAccounts.stock_output_account_id,
    });
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategory = () => {
    if (!editCategoryName.trim() || !selectedCategory) return;

    updateCategory(selectedCategory.id, {
      name: editCategoryName.trim(),
      code: editCategoryName.toUpperCase().replace(/\s+/g, '-').substring(0, 10),
      income_account_id: categoryAccounts.income_account_id || '',
      expense_account_id: categoryAccounts.expense_account_id || '',
      stock_valuation_account_id: categoryAccounts.stock_valuation_account_id || '',
      stock_input_account_id: categoryAccounts.stock_input_account_id || '',
      stock_output_account_id: categoryAccounts.stock_output_account_id || '',
    });
    setEditCategoryName('');
    setCategoryAccounts({ ...defaultCategoryAccounts });
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
    <TooltipProvider delayDuration={200}>
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
            value="categories"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Tag className="w-4 h-4" />
            {t('categories')}
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
          <TabsTrigger
            value="variants"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Layers className="w-4 h-4" />
            {t('variants')}
          </TabsTrigger>
          <TabsTrigger
            value="packages"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Boxes className="w-4 h-4" />
            {t('packages')}
          </TabsTrigger>
          <TabsTrigger
            value="package-types"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Box className="w-4 h-4" />
            {t('package_types') || 'Package Types'}
          </TabsTrigger>
          <TabsTrigger
            value="cogs"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Calculator className="w-4 h-4" />
            {t('cogs') || 'COGS'}
          </TabsTrigger>
          <TabsTrigger
            value="units"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Scale className="w-4 h-4" />
            {t('units_of_measure')}
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
              {canCreate(MODULES.INVENTORY) && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('new_product')}
                </Button>
              )}
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
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? t('try_adjusting_search') || 'Try adjusting your search or filters'
                  : t('start_by_adding_product') || 'Start by adding your first product or service'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700 min-w-[200px]">{t('product')}</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">{t('tags')}</TableHead>
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
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                              {product.image_url ? (
                                <img src={getImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-slate-500" />
                              )}
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
                          <div className="flex flex-wrap gap-1">
                            {product.tags && product.tags.length > 0 ? (
                              product.tags.slice(0, 2).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                            {product.tags && product.tags.length > 2 && (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5">
                                +{product.tags.length - 2}
                              </Badge>
                            )}
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
                          {formatCurrency(product.cost_price || 0)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(product.list_price || 0)}
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
                            {canUpdate(MODULES.INVENTORY) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(product)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4 text-slate-500" />
                              </Button>
                            )}
                            {canDelete(MODULES.INVENTORY) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(product)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
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

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-0">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-xl flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      {t('product_categories')}
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      {t('manage_categories_description')}
                    </p>
                  </div>
                </div>
                {canCreate(MODULES.INVENTORY) && (
                  <Button
                    onClick={() => setShowCategoryModal(true)}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_category')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Tag className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-medium">{t('no_categories_yet')}</p>
                  <p className="text-sm">{t('add_first_category')}</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-semibold text-slate-700">{t('category_name')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('code')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('description')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">{t('products_count')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => {
                        const productCount = products.filter(p => p.category_id === category.id).length;
                        return (
                          <TableRow key={category.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                                  <Tag className="w-4 h-4 text-blue-600" />
                                </div>
                                {category.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 font-mono text-xs">
                                {category.code}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600 max-w-[200px] truncate">
                              {category.description || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={productCount > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}>
                                {productCount} {t('products').toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={category.is_active !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {category.is_active !== false ? t('active') : t('inactive')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canUpdate(MODULES.INVENTORY) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditCategoryClick(category)}
                                    className="h-8 w-8 p-0 hover:bg-blue-50"
                                  >
                                    <Pencil className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                                  </Button>
                                )}
                                {canDelete(MODULES.INVENTORY) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCategoryClick(category)}
                                    className="h-8 w-8 p-0 hover:bg-red-50"
                                    disabled={productCount > 0}
                                  >
                                    <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                  </Button>
                                )}
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

        {/* Variants Tab */}
        <TabsContent value="variants" className="mt-0">
          <ProductVariants />
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="mt-0">
          <Packages />
        </TabsContent>

        {/* Package Types Tab */}
        <TabsContent value="package-types" className="mt-0">
          <PackageTypes />
        </TabsContent>

        {/* COGS Tab */}
        <TabsContent value="cogs" className="mt-0">
          <COGSCalculator />
        </TabsContent>

        {/* Units of Measure Tab */}
        <TabsContent value="units" className="mt-0">
          <UnitsOfMeasure />
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
            {/* Product Image */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('product_image') || 'Product Image'}</h4>
              <div className="flex items-start gap-4">
                {formData.image_url ? (
                  <div className="relative">
                    <img
                      src={getImageUrl(formData.image_url)}
                      alt={formData.name || 'Product'}
                      className="w-28 h-28 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, image_url: ''})}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="w-28 h-28 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500">{t('upload') || 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const fd = new FormData();
                          fd.append('file', file);
                          const res = await apiClient.post('/files/upload', fd, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          const url = res.data?.data?.url || res.data?.url;
                          if (url) setFormData({...formData, image_url: url});
                        } catch (err) {
                          console.error('Image upload failed:', err);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('basic_information')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('name')}
                    required
                    helpText={t('help_product_name') || "Mahsulot nomi sotuvda va hisobotlarda ko'rsatiladi"}
                  />
                  <Input
                    placeholder={t('product_name_placeholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('type')}
                    required
                    helpText={t('help_product_type') || "Mahsulot - omborda saqlanadi. Xizmat - omborda saqlanmaydi. To'plam - bir nechta mahsulotlardan tashkil topgan"}
                  />
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      type: value,
                      is_stockable: value === 'product',
                      track_inventory: value === 'product',
                      bundle_items: value === 'bundle' ? formData.bundle_items : []
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
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <LabelWithHelp
                    label={t('barcode')}
                    helpText={t('help_barcode') || "Mahsulotning shtrix-kodi. Skaner yordamida tez qidirish uchun ishlatiladi"}
                  />
                  <Input
                    placeholder={t('barcode')}
                    value={formData.barcode}
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('category')}
                    helpText={t('help_category') || "Mahsulotlar kategoriyasi. Hisobotlar va filtrlar uchun ishlatiladi"}
                  />
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
                    {canCreate(MODULES.INVENTORY) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowCategoryModal(true)}
                        title={t('add_category')}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <LabelWithHelp
                  label={t('tags')}
                  helpText={t('help_tags') || "Teglar mahsulotlarni guruhlash va qidirish uchun ishlatiladi"}
                />
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50 min-h-[42px]">
                  {(formData.tags || []).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-700 px-2 py-1 flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = formData.tags.filter((_, i) => i !== index);
                          setFormData({...formData, tags: newTags});
                        }}
                        className="ml-1 hover:text-red-500"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    placeholder={t('add_tag_placeholder') || "Teg qo'shish (Enter bosing)"}
                    className="border-0 bg-transparent p-0 h-6 min-w-[120px] flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault();
                        const newTag = e.target.value.trim();
                        if (!formData.tags?.includes(newTag)) {
                          setFormData({...formData, tags: [...(formData.tags || []), newTag]});
                        }
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('tags_hint') || "Teglarni qo'shish uchun yozing va Enter bosing"}</p>
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

              {/* Bundle Items - Only show when type is 'bundle' */}
              {formData.type === 'bundle' && (
                <div className="mt-4 p-4 border border-orange-200 rounded-lg bg-orange-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-orange-600" />
                      {t('bundle_items') || "To'plam tarkibi"}
                    </h4>
                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                      {formData.bundle_items?.length || 0} {t('items') || "element"}
                    </Badge>
                  </div>

                  {/* Bundle items list */}
                  {formData.bundle_items && formData.bundle_items.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {formData.bundle_items.map((item, index) => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {product?.name || item.product_name || t('unknown_product')}
                              </p>
                              <p className="text-xs text-slate-500">
                                {t('price')}: {formatCurrency(product?.list_price || 0)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...formData.bundle_items];
                                  newItems[index].quantity = parseInt(e.target.value) || 1;
                                  setFormData({...formData, bundle_items: newItems});
                                }}
                                className="w-16 h-8 text-center text-sm"
                              />
                              <span className="text-xs text-slate-500">{t('qty') || 'dona'}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newItems = formData.bundle_items.filter((_, i) => i !== index);
                                  setFormData({...formData, bundle_items: newItems});
                                }}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add product to bundle */}
                  <div className="flex gap-2">
                    <Select
                      value=""
                      onValueChange={(productId) => {
                        if (productId && !formData.bundle_items?.some(item => item.product_id === productId)) {
                          const product = products.find(p => p.id === productId);
                          setFormData({
                            ...formData,
                            bundle_items: [
                              ...(formData.bundle_items || []),
                              { product_id: productId, quantity: 1, product_name: product?.name || '' }
                            ]
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('select_product_to_add') || "Mahsulot qo'shish..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {products
                          .filter(p => p.type !== 'bundle' && p.is_active && !formData.bundle_items?.some(item => item.product_id === p.id))
                          .map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              <div className="flex items-center gap-2">
                                <span>{product.name}</span>
                                <span className="text-slate-500">- {formatCurrency(product.list_price || 0)}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bundle price summary */}
                  {formData.bundle_items && formData.bundle_items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-orange-200">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{t('total_items_price') || "Elementlar narxi jami"}:</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(formData.bundle_items.reduce((sum, item) => {
                            const product = products.find(p => p.id === item.product_id);
                            return sum + ((product?.list_price || 0) * (item.quantity || 1));
                          }, 0))}
                        </span>
                      </div>
                      <p className="text-xs text-orange-600 mt-1">
                        {t('bundle_price_hint') || "To'plam narxini quyida alohida belgilashingiz mumkin"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pricing */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('pricing')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('cost_price')}
                    helpText={t('help_cost_price') || "Mahsulotning sotib olish narxi. Foyda hisoblash uchun ishlatiladi"}
                  />
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className="pl-9"
                      value={formatPriceDisplay(formData.cost_price)}
                      onChange={(e) => handlePriceChange('cost_price', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <LabelWithHelp
                    label={t('list_price')}
                    required
                    helpText={t('help_list_price') || "Sotish narxi. Bu narx mijozlarga ko'rsatiladi"}
                  />
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className="pl-9"
                      value={formatPriceDisplay(formData.list_price)}
                      onChange={(e) => handlePriceChange('list_price', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <LabelWithHelp
                    label={t('min_price')}
                    helpText={t('help_min_price') || "Minimal sotish narxi. Chegirma berilganda ham bu narxdan past bo'lmasligi kerak"}
                  />
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className="pl-9"
                      value={formatPriceDisplay(formData.min_price)}
                      onChange={(e) => handlePriceChange('min_price', e.target.value)}
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
                    <LabelWithHelp
                      label={t('min_stock_level')}
                      helpText={t('help_min_stock') || "Minimal zaxira miqdori. Omborda shu miqdordan kam bo'lmasligi kerak"}
                    />
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label={t('reorder_point')}
                      helpText={t('help_reorder_point') || "Qayta buyurtma nuqtasi. Zaxira shu miqdorga tushganda ogohlantirish beriladi"}
                    />
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.reorder_point}
                      onChange={(e) => setFormData({...formData, reorder_point: e.target.value})}
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label={t('reorder_qty')}
                      helpText={t('help_reorder_qty') || "Qayta buyurtma miqdori. Avtomatik buyurtmada tavsiya etiladigan miqdor"}
                    />
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
                    <span className="text-sm text-slate-700 flex items-center">
                      {t('stockable')}
                      <FieldHelp text={t('help_stockable') || "Omborda saqlanadigan mahsulot. O'chirilsa, ombor hisobi yuritilmaydi"} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.track_inventory}
                      onCheckedChange={(checked) => setFormData({...formData, track_inventory: checked})}
                    />
                    <span className="text-sm text-slate-700 flex items-center">
                      {t('track_inventory')}
                      <FieldHelp text={t('help_track_inventory') || "Ombor harakatlarini kuzatish. Kirim va chiqimlar qayd etiladi"} />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Weight & Dimensions */}
            {formData.type === 'product' && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">{t('weight_dimensions') || 'Weight & Dimensions'}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('weight') || 'Weight'}</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.weight}
                      onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('unit_of_measure') || 'Unit of Measure'}</label>
                    <Select
                      value={formData.inventory_uom}
                      onValueChange={(value) => setFormData({...formData, inventory_uom: value, sales_uom: value, purchase_uom: value, weight_unit: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {uomList.map(u => (
                          <SelectItem key={u.code} value={u.code}>{u.name} ({u.code})</SelectItem>
                        ))}
                        {uomList.length === 0 && (
                          <SelectItem value="unit">Unit</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
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
            )}

            {/* Options */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('options')}</h4>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_purchasable && formData.is_sellable}
                    onCheckedChange={(checked) => setFormData({...formData, is_purchasable: checked, is_sellable: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('can_buy_sell') || "Sotish/Sotib olish"}
                    <FieldHelp text={t('help_can_buy_sell') || "Bu mahsulotni sotib olish va sotish mumkin. O'chirilsa, mahsulot faqat ko'rish uchun bo'ladi"} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                  />
                  <span className="text-sm text-slate-700 flex items-center">
                    {t('active')}
                    <FieldHelp text={t('help_active') || "Faol mahsulot. O'chirilsa, mahsulot sotuvda ko'rinmaydi"} />
                  </span>
                </div>
              </div>
            </div>

            {/* Module Visibility */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                {t('module_visibility') || "Modul ko'rinishi"}
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                {t('module_visibility_desc') || "Mahsulot qaysi modullarda ko'rinishini belgilang"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_sold"
                    checked={formData.can_be_sold}
                    onChange={(e) => setFormData({...formData, can_be_sold: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="can_be_sold" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <ShoppingCart className="w-4 h-4 mr-1 text-blue-500" />
                    {t('sales') || 'Sotish'}
                    <FieldHelp text={t('help_can_be_sold') || "Bu mahsulot Sotish modulida ko'rinadi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_purchased"
                    checked={formData.can_be_purchased}
                    onChange={(e) => setFormData({...formData, can_be_purchased: e.target.checked})}
                    className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                  />
                  <label htmlFor="can_be_purchased" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <Archive className="w-4 h-4 mr-1 text-green-500" />
                    {t('purchase') || 'Sotib olish'}
                    <FieldHelp text={t('help_can_be_purchased') || "Bu mahsulot Sotib olish modulida ko'rinadi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="available_in_pos"
                    checked={formData.available_in_pos}
                    onChange={(e) => setFormData({...formData, available_in_pos: e.target.checked})}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <label htmlFor="available_in_pos" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <Printer className="w-4 h-4 mr-1 text-purple-500" />
                    {t('pos') || 'Savdo nuqtasi'}
                    <FieldHelp text={t('help_available_in_pos') || "Bu mahsulot POS (Savdo nuqtasi) modulida ko'rinadi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_expensed"
                    checked={formData.can_be_expensed}
                    onChange={(e) => setFormData({...formData, can_be_expensed: e.target.checked})}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <label htmlFor="can_be_expensed" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <DollarSign className="w-4 h-4 mr-1 text-orange-500" />
                    {t('expenses') || 'Xarajatlar'}
                    <FieldHelp text={t('help_can_be_expensed') || "Bu mahsulot Xarajatlar modulida ko'rinadi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-cyan-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_rented"
                    checked={formData.can_be_rented}
                    onChange={(e) => setFormData({...formData, can_be_rented: e.target.checked})}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                  />
                  <label htmlFor="can_be_rented" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <History className="w-4 h-4 mr-1 text-cyan-500" />
                    {t('rental') || 'Ijara'}
                    <FieldHelp text={t('help_can_be_rented') || "Bu mahsulot Ijara modulida ko'rinadi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_subcontracted"
                    checked={formData.can_be_subcontracted}
                    onChange={(e) => setFormData({...formData, can_be_subcontracted: e.target.checked})}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                  <label htmlFor="can_be_subcontracted" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <Layers className="w-4 h-4 mr-1 text-red-500" />
                    {t('subcontracting') || 'Subpudrat'}
                    <FieldHelp text={t('help_can_be_subcontracted') || "Bu mahsulot Ishlab chiqarish modulida subpudrat sifatida ishlatiladi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="is_overhead_expense"
                    checked={formData.is_overhead_expense}
                    onChange={(e) => setFormData({...formData, is_overhead_expense: e.target.checked})}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <label htmlFor="is_overhead_expense" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <Truck className="w-4 h-4 mr-1 text-amber-500" />
                    {t('overhead_expense') || 'Nakladnoy xarajat'}
                    <FieldHelp text={t('help_is_overhead_expense') || "Bu mahsulot nakladnoy xarajatlar (transport, bojxona, yuk tashish) sifatida ishlatiladi"} />
                  </label>
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
                        {/* Added variant attributes */}
                        {formData.variant_attributes.length > 0 && (
                          <div className="space-y-2">
                            {formData.variant_attributes.map((attr, index) => (
                              <div key={index} className="flex items-center gap-2 bg-white p-3 rounded-lg border">
                                <div className="flex-1">
                                  <span className="font-medium text-slate-700">{attr.name}:</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {attr.values.map((val, vi) => (
                                      <Badge key={vi} variant="secondary" className="text-xs">
                                        {val.name}
                                        {val.price_extra > 0 && (
                                          <span className="text-green-600 ml-1">+{val.price_extra}</span>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
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

                        {/* Select existing attribute or create new */}
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Select
                                value={selectedAttributeId}
                                onValueChange={(val) => {
                                  setSelectedAttributeId(val);
                                  setSelectedValueIds([]);
                                  setShowAddValue(false);
                                  setNewValueName('');
                                  setNewValuePriceExtra('');
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('select_attribute')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {backendAttributes
                                    .filter(a => !formData.variant_attributes.some(va => va.attribute_id === a.id))
                                    .map(attr => (
                                      <SelectItem key={attr.id} value={attr.id}>
                                        {attr.name} ({(attr.values || []).length})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const attr = backendAttributes.find(a => a.id === selectedAttributeId);
                                if (attr && selectedValueIds.length > 0) {
                                  const selectedValues = (attr.values || []).filter(v => selectedValueIds.includes(v.id));
                                  setFormData({
                                    ...formData,
                                    variant_attributes: [
                                      ...formData.variant_attributes,
                                      {
                                        attribute_id: attr.id,
                                        name: attr.name,
                                        values: selectedValues.map(v => ({ id: v.id, name: v.name, price_extra: v.price_extra || 0 }))
                                      }
                                    ]
                                  });
                                  setSelectedAttributeId('');
                                  setSelectedValueIds([]);
                                }
                              }}
                              disabled={!selectedAttributeId || selectedValueIds.length === 0}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              {t('add_attribute')}
                            </Button>
                          </div>

                          {/* Show values of selected attribute */}
                          {selectedAttributeId && (() => {
                            const attr = backendAttributes.find(a => a.id === selectedAttributeId);
                            const values = attr?.values || [];
                            return (
                              <div className="bg-white border rounded-lg p-3 space-y-3">
                                {values.length > 0 && (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-slate-700">{t('select_values')}:</p>
                                      <button
                                        type="button"
                                        className="text-xs text-blue-600 hover:underline"
                                        onClick={() => setSelectedValueIds(
                                          selectedValueIds.length === values.length ? [] : values.map(v => v.id)
                                        )}
                                      >
                                        {selectedValueIds.length === values.length ? t('deselect_all') : t('select_all')}
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {values.map(val => {
                                        const isSelected = selectedValueIds.includes(val.id);
                                        return (
                                          <button
                                            key={val.id}
                                            type="button"
                                            onClick={() => setSelectedValueIds(
                                              isSelected
                                                ? selectedValueIds.filter(id => id !== val.id)
                                                : [...selectedValueIds, val.id]
                                            )}
                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                              isSelected
                                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                          >
                                            {val.html_color && (
                                              <span
                                                className="inline-block w-3 h-3 rounded-full mr-1.5 border border-slate-300"
                                                style={{ backgroundColor: val.html_color }}
                                              />
                                            )}
                                            {val.name}
                                            {val.price_extra > 0 && (
                                              <span className="text-green-600 ml-1 text-xs">+{val.price_extra}</span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                                {values.length === 0 && (
                                  <p className="text-xs text-slate-500">{t('no_values')}</p>
                                )}
                                {/* Add new value inline */}
                                {!showAddValue ? (
                                  <button
                                    type="button"
                                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                                    onClick={() => setShowAddValue(true)}
                                  >
                                    <Plus className="w-3 h-3" />
                                    {t('add_value')}
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2 pt-1 border-t">
                                    <Input
                                      className="h-8 text-sm"
                                      placeholder={t('value_placeholder')}
                                      value={newValueName}
                                      onChange={(e) => setNewValueName(e.target.value)}
                                    />
                                    <Input
                                      className="h-8 text-sm w-28"
                                      placeholder={t('price_extra')}
                                      type="text"
                                      inputMode="decimal"
                                      value={newValuePriceExtra}
                                      onChange={(e) => setNewValuePriceExtra(e.target.value)}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 shrink-0"
                                      onClick={handleAddValueToAttribute}
                                      disabled={!newValueName.trim() || isAddingValue}
                                    >
                                      {isAddingValue ? '...' : t('add')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 shrink-0"
                                      onClick={() => { setShowAddValue(false); setNewValueName(''); setNewValuePriceExtra(''); }}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Create new attribute inline */}
                          {!showCreateAttribute ? (
                            <button
                              type="button"
                              className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                              onClick={() => setShowCreateAttribute(true)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {t('create_new_attribute')}
                            </button>
                          ) : (
                            <div className="bg-white border rounded-lg p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-700">{t('create_new_attribute')}</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setShowCreateAttribute(false); setNewAttrName(''); setNewAttrInlineValues([]); setNewAttrValName(''); setNewAttrValPrice(''); }}
                                  className="h-6 w-6 p-0"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                              <Input
                                placeholder={t('attribute_name') || 'Attribute'}
                                value={newAttrName}
                                onChange={(e) => setNewAttrName(e.target.value)}
                              />
                              {/* Added values list */}
                              {newAttrInlineValues.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {newAttrInlineValues.map((v, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                                      {v.name}
                                      {v.price_extra > 0 && <span className="text-green-600">+{v.price_extra}</span>}
                                      <button
                                        type="button"
                                        onClick={() => setNewAttrInlineValues(newAttrInlineValues.filter((_, idx) => idx !== i))}
                                        className="ml-0.5 text-slate-400 hover:text-red-500"
                                      >×</button>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {/* Add value row */}
                              <div className="flex items-center gap-2">
                                <Input
                                  className="h-8 text-sm"
                                  placeholder={t('value_name') || 'Value'}
                                  value={newAttrValName}
                                  onChange={(e) => setNewAttrValName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newAttrValName.trim()) {
                                      e.preventDefault();
                                      setNewAttrInlineValues([...newAttrInlineValues, { name: newAttrValName.trim(), price_extra: parseFloat(newAttrValPrice) || 0 }]);
                                      setNewAttrValName('');
                                      setNewAttrValPrice('');
                                    }
                                  }}
                                />
                                <Input
                                  className="h-8 text-sm w-28"
                                  placeholder={t('price_extra')}
                                  type="text"
                                  inputMode="decimal"
                                  value={newAttrValPrice}
                                  onChange={(e) => setNewAttrValPrice(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newAttrValName.trim()) {
                                      e.preventDefault();
                                      setNewAttrInlineValues([...newAttrInlineValues, { name: newAttrValName.trim(), price_extra: parseFloat(newAttrValPrice) || 0 }]);
                                      setNewAttrValName('');
                                      setNewAttrValPrice('');
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 shrink-0"
                                  onClick={() => {
                                    if (newAttrValName.trim()) {
                                      setNewAttrInlineValues([...newAttrInlineValues, { name: newAttrValName.trim(), price_extra: parseFloat(newAttrValPrice) || 0 }]);
                                      setNewAttrValName('');
                                      setNewAttrValPrice('');
                                    }
                                  }}
                                  disabled={!newAttrValName.trim()}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleCreateInlineAttribute}
                                disabled={!newAttrName.trim() || newAttrInlineValues.length === 0 || isCreatingAttr}
                              >
                                {isCreatingAttr ? t('creating') : t('create_attribute')}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Variant preview */}
                        {formData.variant_attributes.length > 0 && (
                          <div className="text-sm text-slate-600 bg-white border rounded-lg p-3">
                            <p className="font-medium mb-1">{t('variants_will_be_generated')}</p>
                            <p className="text-xs text-slate-500">
                              {formData.variant_attributes.reduce((acc, attr) => acc * attr.values.length, 1)} {t('variants_total')}
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
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          className="pl-9"
                          value={formatPriceDisplay(formData.wholesale_price)}
                          onChange={(e) => handlePriceChange('wholesale_price', e.target.value)}
                        />
                      </div>
                    </div>
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

            {/* Attributes & Variants Section - Only in Edit Mode */}
            {showEditModal && (
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--genix-purple)]" />
                  {t('attributes_and_variants') || "Atributlar va variantlar"}
                </h4>

                {/* Currently configured attributes */}
                {editProductAttributes.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {editProductAttributes.map(pa => {
                      const fullAttr = allAttributes.find(a => a.id === pa.attribute_id);
                      const configuredValueIds = (pa.values || []).map(v => v.value_id);
                      const missingValues = fullAttr?.values?.filter(v => !configuredValueIds.includes(v.id)) || [];

                      return (
                        <div key={pa.pta_id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="font-medium text-sm text-slate-700">{pa.attribute_name}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {pa.values?.map(v => (
                              <Badge key={v.ptav_id} variant="outline" className="text-xs">
                                {v.html_color && (
                                  <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: v.html_color }} />
                                )}
                                {v.value_name}
                                {v.price_extra > 0 && ` (+${formatCurrency(v.price_extra)})`}
                              </Badge>
                            ))}
                          </div>
                          {/* Add missing values */}
                          {missingValues.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-xs text-slate-500 mb-1">{t('add_new_values') || "Yangi qiymatlar qo'shish"}:</p>
                              <div className="flex flex-wrap gap-1">
                                {missingValues.map(val => (
                                  <Button
                                    key={val.id}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-6"
                                    onClick={() => handleAddAttrToProduct(pa.attribute_id, [val.id])}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    {val.html_color && (
                                      <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: val.html_color }} />
                                    )}
                                    {val.name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 mb-4">{t('no_attributes_configured') || "Atributlar sozlanmagan"}</p>
                )}

                {/* Add new attribute */}
                {(() => {
                  const availableAttrs = allAttributes.filter(
                    a => !editProductAttributes.some(pa => pa.attribute_id === a.id)
                  );
                  if (availableAttrs.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t('add_attribute_to_product') || "Atribut qo'shish"}
                      </label>
                      <Select
                        value=""
                        onValueChange={(attrId) => {
                          const attr = allAttributes.find(a => a.id === attrId);
                          if (attr && attr.values?.length > 0) {
                            handleAddAttrToProduct(attrId, attr.values.map(v => v.id));
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('select_attribute') || "Atributni tanlang"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAttrs.map(attr => (
                            <SelectItem key={attr.id} value={attr.id}>
                              {attr.name} ({attr.values?.length || 0} {t('values') || 'values'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {/* Existing variants */}
                {editProductVariants.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-slate-700 mb-2">
                      {t('product_variants_list') || "Mahsulot variantlari"} ({editProductVariants.length})
                    </h5>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">{t('variant') || 'Variant'}</TableHead>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs text-right">{t('cost_price') || 'Cost'}</TableHead>
                            <TableHead className="text-xs text-right">{t('list_price') || 'Price'}</TableHead>
                            <TableHead className="text-xs text-right">{t('stock') || 'Stock'}</TableHead>
                            <TableHead className="text-xs text-right">{t('actions') || ''}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editProductVariants.map(v => (
                            <TableRow key={v.id}>
                              <TableCell className="text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {v.attributes?.map((attr, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {attr.html_color && (
                                        <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: attr.html_color }} />
                                      )}
                                      {attr.value_name}
                                    </Badge>
                                  )) || v.variant_name || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-slate-500">{v.sku || '-'}</TableCell>
                              <TableCell className="text-xs text-right">{v.cost_price ? formatCurrency(v.cost_price) : '-'}</TableCell>
                              <TableCell className="text-xs text-right">{v.list_price ? formatCurrency(v.list_price) : '-'}</TableCell>
                              <TableCell className="text-xs text-right">{v.stock_quantity || 0}</TableCell>
                              <TableCell className="text-xs text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteProductVariant(v.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {editProductVariants.length === 0 && editProductAttributes.length > 0 && (
                  <p className="text-sm text-slate-400 mb-4">{t('no_variants_generated') || "Variantlar hali yaratilmagan"}</p>
                )}

                {/* Generate Variants button */}
                {editProductAttributes.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateProductVariants}
                    disabled={isGeneratingVariants}
                    className="w-full"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingVariants ? 'animate-spin' : ''}`} />
                    {isGeneratingVariants
                      ? (t('generating') || "Yaratilmoqda...")
                      : (t('generate_variants') || "Variantlarni yaratish")}
                  </Button>
                )}
              </div>
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
                disabled={isSaving || !formData.name}
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
                  <p className="text-xs text-slate-500 mb-1">{t('category') || 'Category'}</p>
                  <p className="text-sm font-semibold text-slate-900">{getCategoryName(selectedProduct.category_id)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('barcode') || 'Barcode'}</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedProduct.barcode || '-'}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">{t('tags') || 'Tags'}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.tags && selectedProduct.tags.length > 0 ? (
                    selectedProduct.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-700 px-2 py-1">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-400 text-sm">-</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">{t('cost_price') || 'Cost Price'}</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedProduct.cost_price || 0)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">{t('list_price') || 'List Price'}</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(selectedProduct.list_price || 0)}</p>
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

              {/* Bundle Items in Detail Modal */}
              {selectedProduct.type === 'bundle' && selectedProduct.bundle_items && selectedProduct.bundle_items.length > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-600 mb-2 font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {t('bundle_items') || "To'plam tarkibi"}
                  </p>
                  <div className="space-y-2">
                    {selectedProduct.bundle_items.map((item, idx) => {
                      const product = products.find(p => p.id === item.product_id);
                      return (
                        <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-orange-100">
                          <span className="text-slate-700">{product?.name || item.product_name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              x{item.quantity}
                            </Badge>
                            <span className="text-slate-500">{formatCurrency((product?.list_price || 0) * item.quantity)}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-orange-200 flex justify-between text-sm font-semibold">
                      <span className="text-orange-700">{t('total_items_price') || "Jami"}:</span>
                      <span className="text-orange-700">
                        {formatCurrency(selectedProduct.bundle_items.reduce((sum, item) => {
                          const product = products.find(p => p.id === item.product_id);
                          return sum + ((product?.list_price || 0) * (item.quantity || 1));
                        }, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {canUpdate(MODULES.INVENTORY) && (
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
                )}
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
      <Dialog open={showCategoryModal} onOpenChange={(open) => {
        setShowCategoryModal(open);
        if (!open) { setNewCategoryName(''); setCategoryAccounts({ ...defaultCategoryAccounts }); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              />
            </div>

            {/* GL Account Selectors */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">{t('accounting_accounts')}</h4>
              <div className="space-y-3">
                {[
                  { key: 'income_account_id', label: t('income_account') },
                  { key: 'expense_account_id', label: t('expense_account') },
                  { key: 'stock_valuation_account_id', label: t('stock_valuation_account') },
                  { key: 'stock_input_account_id', label: t('stock_input_account') },
                  { key: 'stock_output_account_id', label: t('stock_output_account') },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">{label}</label>
                    <Select
                      value={categoryAccounts[key] || 'none'}
                      onValueChange={(v) => setCategoryAccounts(prev => ({ ...prev, [key]: v === 'none' ? '' : v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('select_account')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— {t('none')} —</SelectItem>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                  setCategoryAccounts({ ...defaultCategoryAccounts });
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              {canCreate(MODULES.INVENTORY) && (
                <Button
                  onClick={handleCreateCategory}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('create')}
                </Button>
              )}
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
            {canCreate(MODULES.INVENTORY) && (
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
            )}

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
                      {canUpdate(MODULES.INVENTORY) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCategoryClick(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                      )}
                      {canDelete(MODULES.INVENTORY) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategoryClick(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
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
      <Dialog open={showEditCategoryModal} onOpenChange={(open) => {
        setShowEditCategoryModal(open);
        if (!open) { setEditCategoryName(''); setSelectedCategory(null); setCategoryAccounts({ ...defaultCategoryAccounts }); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              />
            </div>

            {/* GL Account Selectors */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">{t('accounting_accounts')}</h4>
              <div className="space-y-3">
                {[
                  { key: 'income_account_id', label: t('income_account') },
                  { key: 'expense_account_id', label: t('expense_account') },
                  { key: 'stock_valuation_account_id', label: t('stock_valuation_account') },
                  { key: 'stock_input_account_id', label: t('stock_input_account') },
                  { key: 'stock_output_account_id', label: t('stock_output_account') },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">{label}</label>
                    <Select
                      value={categoryAccounts[key] || 'none'}
                      onValueChange={(v) => setCategoryAccounts(prev => ({ ...prev, [key]: v === 'none' ? '' : v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('select_account')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— {t('none')} —</SelectItem>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditCategoryModal(false);
                  setEditCategoryName('');
                  setSelectedCategory(null);
                  setCategoryAccounts({ ...defaultCategoryAccounts });
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
    </TooltipProvider>
  );
}
