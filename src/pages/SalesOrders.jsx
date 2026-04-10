import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useModules } from '@/components/contexts/ModulesContext';
import { useCustomers } from '@/components/contexts/CustomersContext';
import { useSales } from '@/components/contexts/SalesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus, Search, ShoppingBag, TrendingUp, Package, DollarSign, Truck,
  CheckCircle, FileText, Receipt, RotateCcw, Tag, BarChart3, Upload, Download, Eye, Printer, Trash2, X,
  LayoutDashboard, Building2, Edit, ToggleLeft, ToggleRight, MessageSquareWarning, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { salesService } from '@/api/services/sales';
import { inventoryService } from '@/api/services/inventory';
import { projectsService } from '@/api/services/projects';
import apiClient from '@/api/client';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import ProductCombobox from "@/components/shared/ProductCombobox";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useInventory } from '@/components/contexts/InventoryContext';

// Import sales components
import QuotationsSection from '@/components/sales/QuotationsSection';
import Invoices from '@/components/sales/Invoices';
import Discounts from '@/components/sales/Discounts';
import DeliveryOrders from '@/components/sales/DeliveryOrders';
import Orders from '@/components/sales/Orders';
import Dropshipping from '@/components/sales/Dropshipping';

// Import universal ERP components
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  PrintPreviewModal,
  BatchPrintModal,
  useAuditTrail,
} from '@/components/shared';
import { useCompany } from '@/components/contexts/CompanyContext';
import { formatPriceInput, parsePriceInput, formatAxisTick } from '@/utils/formatCurrency';

export default function SalesOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { salesOrders = [], createSalesOrder, updateSalesOrder, isLoading: ordersLoading, refreshData: refreshModulesData } = useModules();
  const { customers = [] } = useCustomers();
  const { getSetting } = useAdminSettings();
  const { taxRates = [], journals = [], paymentJournals = [] } = useFinancials();
  const bankCashJournals = paymentJournals.length > 0 ? paymentJournals : journals.filter(j => j.type === 'bank' || j.type === 'cash');
  const { getProductStock } = useInventory();

  // Get default tax from settings
  const defaultSalesTaxId = getSetting('sales.tax.default_tax_id', '');
  const salesTaxRates = taxRates.filter(tr => tr.tax_type === 'sales' || !tr.tax_type);
  // Prefer the explicitly configured default, fall back to first active sales tax
  const defaultSalesTax = defaultSalesTaxId
    ? taxRates.find(tr => String(tr.id) === String(defaultSalesTaxId))
    : salesTaxRates.find(tr => tr.is_active !== false) || null;
  const defaultTaxPercent = defaultSalesTax?.rate || 0;
  const {
    quotations = [],
    invoices = [],
    returns = [],
    discounts = [],
    isLoading: salesLoading,
    confirmSalesOrder,
    getOrder,
    createInvoiceFromOrder,
    refreshData: refreshSalesData,
    applyDiscount,
    useDiscountCode,
  } = useSales();

  // Refresh data when navigating to this page
  useEffect(() => {
    refreshSalesData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const location = useLocation();
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderReturns, setOrderReturns] = useState([]);
  const { addAuditLog } = useAuditTrail('sales_orders');

  // Check if an order has returns
  const orderHasReturns = useCallback((orderId) => {
    return returns.some(r => r.sales_order_id === orderId);
  }, [returns]);

  // Get returns for a specific order
  const getOrderReturns = useCallback((orderId) => {
    return returns.filter(r => r.sales_order_id === orderId);
  }, [returns]);

  // Check if an order already has an invoice
  const orderHasInvoice = useCallback((orderId) => {
    return invoices.some(inv => inv.sales_order_id === orderId && inv.status !== 'cancelled');
  }, [invoices]);

  // Track newly created invoice to auto-open it
  const [newInvoiceId, setNewInvoiceId] = useState(null);

  // Carrier state
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [newCarrier, setNewCarrier] = useState({
    code: '',
    name: '',
    tracking_url: '',
    phone: '+998',
    email: '',
    website: '',
    notes: '',
    is_active: true,
  });

  // Export columns configuration
  const exportColumns = [
    { key: 'order_number', label: t('order_number') },
    { key: 'customer_name', label: t('customer') },
    { key: 'order_date', label: t('date'), render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'delivery_date', label: t('delivery_date'), render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'total_amount', label: t('amount'), render: (v) => formatCurrency(v || 0) },
    { key: 'status', label: t('status') },
    { key: 'payment_status', label: t('payment_status') },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'customer_name', label: t('customer'), required: true },
    { key: 'order_date', label: t('date'), required: true },
    { key: 'delivery_date', label: t('delivery_date') },
    { key: 'subtotal', label: t('amount'), required: true },
  ];

  const handleImport = async (data) => {
    for (const row of data) {
      const subtotal = parseFloat(row.subtotal) || 0;
      const taxAmount = subtotal * 0.12;
      const orderData = {
        order_number: `SO-${Date.now()}`,
        customer_name: row.customer_name,
        order_date: row.order_date,
        delivery_date: row.delivery_date,
        subtotal,
        tax_amount: taxAmount,
        shipping_cost: 0,
        total_amount: subtotal + taxAmount,
        status: 'quotation',
        payment_status: 'unpaid',
      };
      createSalesOrder(orderData);
    }
    addAuditLog('create', 'batch', `${data.length} orders imported`);
  };

  const generatePrintConfig = (order) => {
    // Build table data from order lines if available
    const lines = order.lines || [];
    const tableData = lines.length > 0
      ? lines.map((line, idx) => ({
          no: idx + 1,
          description: line.description || line.product_name || '-',
          quantity: line.quantity || 0,
          unit_price: formatCurrency(line.unit_price || 0),
          total: formatCurrency((line.quantity || 0) * (line.unit_price || 0)),
        }))
      : [{ no: 1, description: t('no_items'), quantity: '-', unit_price: '-', total: '-' }];

    return {
      template: 'order',
      title: t('sales_order'),
      documentNumber: order.order_number,
      documentDate: order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '',
      headerFields: [
        { label: t('customer'), value: order.customer_name },
        { label: t('delivery_date'), value: order.delivery_date || order.expected_date ? format(new Date(order.delivery_date || order.expected_date), 'dd.MM.yyyy') : '-' },
        ...(order.vehicle_number ? [{ label: t('vehicle_number') || 'Moshina raqami', value: order.vehicle_number }] : []),
        { label: t('status'), value: t(order.status) },
        { label: t('payment_status'), value: t(order.payment_status) },
      ],
      tableColumns: [
        { key: 'no', label: '№', width: 10 },
        { key: 'description', label: t('description') },
        { key: 'quantity', label: t('quantity'), align: 'center', width: 20 },
        { key: 'unit_price', label: t('price'), align: 'right', width: 30 },
        { key: 'total', label: t('total'), align: 'right', width: 35 },
      ],
      tableData,
      totals: [
        { label: t('subtotal'), value: formatCurrency(order.subtotal || 0) },
        { label: t('tax'), value: formatCurrency(order.tax_amount || 0) },
        { label: t('shipping'), value: formatCurrency(order.shipping_amount || order.shipping_cost || 0) },
        { label: t('total'), value: formatCurrency(order.total_amount || 0), bold: true },
      ],
    };
  };

  const [newOrder, setNewOrder] = useState({
    order_number: '',
    customer_name: '',
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0], // Default to today
    warehouse_id: '',
    carrier: '',
    vehicle_number: '',
    project_id: '',
    project_name: '',
    lines: [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }],
    subtotal: 0,
    tax_percent: 0,
    tax_rate_id: '',
    tax_amount: 0,
    shipping_cost: 0,
    total_amount: 0,
    discount_code: '',
    discount_id: '',
    discount_name: '',
    discount_type: '',
    discount_value: 0,
    max_discount_amount: null,
  });
  // Pre-fill default tax from settings
  useEffect(() => {
    if (defaultTaxPercent > 0 && newOrder.tax_percent === 0) {
      setNewOrder(prev => ({ ...prev, tax_percent: defaultTaxPercent, tax_rate_id: defaultSalesTax?.id || '' }));
    }
  }, [defaultTaxPercent]);

  // Open create modal pre-filled with customer from navigation state
  useEffect(() => {
    if (location.state?.createOrderForCustomer) {
      const { id, company_name, name } = location.state.createOrderForCustomer;
      setNewOrder(prev => ({
        ...prev,
        customer_id: id,
        customer_name: company_name || name || '',
      }));
      setShowCreateModal(true);
      // Clear state so refresh doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [discountValidation, setDiscountValidation] = useState({ valid: false, message: '' });
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Stock warning modal for warehouse processing
  const [showStockWarningModal, setShowStockWarningModal] = useState(false);
  const [stockWarningDetails, setStockWarningDetails] = useState([]);
  const [stockWarningOrderId, setStockWarningOrderId] = useState(null);
  const [stockWarningFullOrder, setStockWarningFullOrder] = useState(null);
  const [stockWarningInventory, setStockWarningInventory] = useState(null);
  const [stockWarningTargetStatus, setStockWarningTargetStatus] = useState(null);
  const [hasPartialStock, setHasPartialStock] = useState(false);

  // Products list for selection
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Product variants
  const [productVariants, setProductVariants] = useState({}); // { productId: variants[] }

  // Product packagings (e.g., 6-pack, case of 24)
  const [productPackagings, setProductPackagings] = useState({}); // { productId: packagings[] }

  // Warehouses list for selection
  const [warehouses, setWarehouses] = useState([]);

  // Carriers list for selection
  const [carriers, setCarriers] = useState([]);

  // Intercompany projects (loaded when customer has source_organization_id)
  const [intercompanyProjects, setIntercompanyProjects] = useState([]);
  const [loadingIntercompanyProjects, setLoadingIntercompanyProjects] = useState(false);

  // Track if delivery date was manually set (for new order)
  const [isDeliveryDateManual, setIsDeliveryDateManual] = useState(false);
  // Track if delivery date was manually set (for editing order)
  const [isEditDeliveryDateManual, setIsEditDeliveryDateManual] = useState(false);

  // Fetch products and warehouses on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await inventoryService.listProducts({ limit: 1000 });
        const all = Array.isArray(data) ? data : data?.items || [];
        setProducts(all.filter(p => p.can_be_sold !== false && p.is_sellable !== false));
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setProductsLoading(false);
      }
    };
    const fetchWarehouses = async () => {
      try {
        const data = await inventoryService.listWarehouses({ limit: 100 });
        const list = Array.isArray(data) ? data : data?.items || [];
        setWarehouses(list);
        if (list.length === 1) {
          setNewOrder(prev => ({ ...prev, warehouse_id: list[0].id }));
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    const fetchCarriers = async () => {
      try {
        const data = await inventoryService.listCarriers({ active: 'true' });
        setCarriers(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch carriers:', error);
      }
    };
    fetchProducts();
    fetchWarehouses();
    fetchCarriers();
  }, []);

  // Calculate delivery date based on product lead times
  const calculateDeliveryDate = useCallback((orderLines, orderDate) => {
    const baseDate = orderDate ? new Date(orderDate) : new Date();

    // Get max lead time from all products in order lines
    const maxLeadTime = orderLines.reduce((max, line) => {
      const leadTime = line.product?.lead_time_days || line.lead_time_days || 0;
      return Math.max(max, leadTime);
    }, 0);

    // If no lead times, return today's date
    if (maxLeadTime === 0) {
      return new Date().toISOString().split('T')[0];
    }

    // Add lead time days to base date
    const deliveryDate = new Date(baseDate);
    deliveryDate.setDate(deliveryDate.getDate() + maxLeadTime);
    return deliveryDate.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    let filtered = salesOrders;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredOrders(filtered);
  }, [salesOrders, searchQuery, statusFilter]);

  // Calculate order totals from line items
  const calculateOrderTotals = (lines) => {
    const subtotal = lines.reduce((sum, line) => sum + (parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)), 0);
    return subtotal;
  };

  // Calculate tax considering price_include flag (like Odoo)
  // When price_include=true, the entered prices already contain tax, so we back-calculate
  const calculateTaxFromRate = (rawSubtotal, taxPercent, taxRateObj) => {
    const rate = parseFloat(taxPercent) || 0;
    if (rate <= 0) return { subtotal: rawSubtotal, taxAmount: 0, isInclusive: false };
    if (taxRateObj?.price_include) {
      const taxAmount = rawSubtotal * rate / (100 + rate);
      return { subtotal: rawSubtotal - taxAmount, taxAmount, isInclusive: true };
    }
    const taxAmount = rawSubtotal * rate / 100;
    return { subtotal: rawSubtotal, taxAmount, isInclusive: false };
  };

  const handleAddLine = (order, setOrder, isManualDelivery, setManualDelivery) => {
    const newLines = [...order.lines, { product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }];
    setOrder({
      ...order,
      lines: newLines
    });
    // Note: Adding empty line doesn't change delivery date
  };

  const handleRemoveLine = (order, setOrder, index, isManualDelivery) => {
    const newLines = order.lines.filter((_, i) => i !== index);
    const updatedLines = newLines.length > 0 ? newLines : [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }];

    // Recalculate delivery date if not manually set
    if (!isManualDelivery) {
      const newDeliveryDate = calculateDeliveryDate(updatedLines, order.order_date);
      setOrder({ ...order, lines: updatedLines, delivery_date: newDeliveryDate });
    } else {
      setOrder({ ...order, lines: updatedLines });
    }
  };

  // Fetch variants for a product
  const fetchProductVariants = useCallback(async (productId) => {
    if (!productId || productVariants[productId]) return;
    try {
      const response = await apiClient.get('/product-variants', { params: { product_id: productId } });
      setProductVariants(prev => ({ ...prev, [productId]: response.data?.data || [] }));
    } catch (error) {
      console.error('Failed to fetch variants:', error);
    }
  }, [productVariants]);

  // Fetch packagings for a product (e.g., 6-pack, case of 24)
  const fetchProductPackagings = useCallback(async (productId) => {
    if (!productId || productPackagings[productId]) return;
    try {
      const data = await inventoryService.listProductPackagingsByProduct(productId);
      // Only show packagings available for sales
      const salesPackagings = (Array.isArray(data) ? data : []).filter(p => p.sales);
      setProductPackagings(prev => ({ ...prev, [productId]: salesPackagings }));
    } catch (error) {
      console.error('Failed to fetch packagings:', error);
    }
  }, [productPackagings]);

  // Get total available stock for a product across all warehouses (or specific warehouse)
  const getAvailableStock = useCallback((productId, warehouseId) => {
    if (!productId) return null;
    const stockRecords = getProductStock(productId);
    if (!stockRecords || stockRecords.length === 0) return null;
    if (warehouseId) {
      const record = stockRecords.find(s => s.warehouse_id === warehouseId);
      return record ? (record.quantity_available ?? record.available_quantity ?? record.quantity_on_hand ?? record.quantity ?? 0) : null;
    }
    return stockRecords.reduce((sum, s) => sum + (s.quantity_available ?? s.available_quantity ?? s.quantity_on_hand ?? s.quantity ?? 0), 0);
  }, [getProductStock]);

  // Check stock warning for a line item
  const getStockWarning = useCallback((line, warehouseId) => {
    if (!line.product_id) return null;
    const available = getAvailableStock(line.product_id, warehouseId);
    if (available === null) return null;
    const qty = parseFloat(line.quantity) || 0;
    if (available <= 0) return { type: 'error', message: t('stock_not_available'), available: 0 };
    if (qty > available) return { type: 'warning', message: t('stock_exceeded').replace('{qty}', available), available };
    return null;
  }, [getAvailableStock, t]);

  const handleLineChange = (order, setOrder, index, field, value, isManualDelivery) => {
    const newLines = [...order.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If changing product selection, also update lead_time_days and recalculate delivery date
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        // Auto-set UOM: prefer sales_unit, fallback to default unit
        const unitId = selectedProduct.sales_unit_id || selectedProduct.unit_id || null;
        const unitName = selectedProduct.sales_unit_name || selectedProduct.unit_name || '';

        newLines[index] = {
          ...newLines[index],
          product_name: selectedProduct.name,
          product_id: selectedProduct.id,
          unit_price: selectedProduct.list_price || selectedProduct.cost_price || 0,
          lead_time_days: selectedProduct.lead_time_days || 0,
          unit_id: unitId,
          unit_name: unitName,
          product: selectedProduct,
          variant_id: null, // Reset variant when product changes
          variant_name: null,
          packaging_id: null, // Reset packaging when product changes
          packaging_qty: null,
          packaging_name: null,
          packaging_unit_qty: null
        };

        // Fetch variants if product has variants
        if (selectedProduct.has_variants) {
          fetchProductVariants(selectedProduct.id);
        }

        // Always fetch packagings for the product
        fetchProductPackagings(selectedProduct.id);

        // Recalculate delivery date if not manually set
        if (!isManualDelivery) {
          const newDeliveryDate = calculateDeliveryDate(newLines, order.order_date);
          setOrder({ ...order, lines: newLines, delivery_date: newDeliveryDate });
          return;
        }
      }
    }

    // If changing variant selection
    if (field === 'variant_id' && value) {
      const productId = newLines[index].product_id;
      const variants = productVariants[productId] || [];
      const selectedVariant = variants.find(v => v.id === value);
      if (selectedVariant) {
        newLines[index] = {
          ...newLines[index],
          variant_id: selectedVariant.id,
          variant_name: selectedVariant.variant_name,
          unit_price: selectedVariant.list_price || newLines[index].unit_price
        };
      }
    }

    // If changing packaging selection
    if (field === 'packaging_id') {
      if (value) {
        const productId = newLines[index].product_id;
        const packagings = productPackagings[productId] || [];
        const selectedPackaging = packagings.find(p => p.id === value);
        if (selectedPackaging) {
          // Auto-calculate quantity based on packaging
          const packagingQty = newLines[index].packaging_qty || 1;
          newLines[index] = {
            ...newLines[index],
            packaging_id: selectedPackaging.id,
            packaging_name: selectedPackaging.name,
            packaging_unit_qty: selectedPackaging.qty,
            packaging_qty: packagingQty,
            quantity: packagingQty * selectedPackaging.qty // Auto-calculate total quantity
          };
        }
      } else {
        // Clear packaging fields if "None" selected
        newLines[index] = {
          ...newLines[index],
          packaging_id: null,
          packaging_name: null,
          packaging_unit_qty: null,
          packaging_qty: null
        };
      }
    }

    // If changing packaging quantity
    if (field === 'packaging_qty' && newLines[index].packaging_id) {
      const packagingQty = parseFloat(value) || 1;
      const packagingUnitQty = newLines[index].packaging_unit_qty || 1;
      newLines[index] = {
        ...newLines[index],
        packaging_qty: packagingQty,
        quantity: packagingQty * packagingUnitQty // Auto-calculate total quantity
      };
    }

    setOrder({ ...order, lines: newLines });
  };

  // Calculate discount amount based on subtotal and discount settings
  const calculateDiscountAmount = (subtotal, discount) => {
    if (!discount) return 0;

    let discountAmount = 0;
    if (discount.discount_type === 'percentage') {
      discountAmount = (subtotal * discount.discount_value) / 100;
    } else {
      discountAmount = discount.discount_value;
    }

    // Apply max discount cap
    if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
      discountAmount = discount.max_discount_amount;
    }

    // Don't discount more than the subtotal
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    return discountAmount;
  };

  // Handle applying discount code
  const handleApplyDiscount = () => {
    if (!discountCodeInput.trim()) {
      setDiscountValidation({ valid: false, message: t('enter_discount_code') || 'Please enter a discount code' });
      return;
    }

    const subtotal = calculateOrderTotals(newOrder.lines);
    const result = applyDiscount(discountCodeInput.trim(), subtotal, false);

    if (result.valid) {
      // Store the discount details, not just the calculated amount
      setNewOrder({
        ...newOrder,
        discount_code: discountCodeInput.trim(),
        discount_id: result.discount.id,
        discount_name: result.discount.name,
        discount_type: result.discount.discount_type,
        discount_value: result.discount.discount_value,
        max_discount_amount: result.discount.max_discount_amount || null,
      });
      setDiscountValidation({ valid: true, message: result.message });
    } else {
      setDiscountValidation({ valid: false, message: t(result.messageKey) || 'Invalid discount code' });
      setNewOrder({
        ...newOrder,
        discount_code: '',
        discount_id: '',
        discount_name: '',
        discount_type: '',
        discount_value: 0,
        max_discount_amount: null,
      });
    }
  };

  // Handle removing discount
  const handleRemoveDiscount = () => {
    setNewOrder({
      ...newOrder,
      discount_code: '',
      discount_id: '',
      discount_name: '',
      discount_type: '',
      discount_value: 0,
      max_discount_amount: null,
    });
    setDiscountCodeInput('');
    setDiscountValidation({ valid: false, message: '' });
  };

  const handleCreateOrder = async () => {
    const rawSubtotal = calculateOrderTotals(newOrder.lines);
    const taxPercent = parseFloat(newOrder.tax_percent) || 0;
    const selectedTax = newOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newOrder.tax_rate_id)) : defaultSalesTax;
    const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
    const subtotal = taxCalc.subtotal;
    const taxAmount = taxCalc.taxAmount;
    const shippingCost = parseFloat(newOrder.shipping_cost) || 0;

    // Calculate discount dynamically based on current subtotal
    const discountAmount = newOrder.discount_id ? calculateDiscountAmount(subtotal, {
      discount_type: newOrder.discount_type,
      discount_value: newOrder.discount_value,
      max_discount_amount: newOrder.max_discount_amount,
    }) : 0;

    const total = subtotal + taxAmount + shippingCost - discountAmount;

    // Filter and format lines - only include lines with valid product_id
    const validLines = newOrder.lines
      .filter(line => line.product_id && line.product_id.trim() !== '')
      .map(line => ({
        product_id: line.product_id,
        description: line.description || line.product_name || '',
        quantity: parseFloat(line.quantity) || 1,
        unit_price: parseFloat(line.unit_price) || 0,
        packaging_id: line.packaging_id || undefined,
        packaging_qty: line.packaging_id ? (parseFloat(line.packaging_qty) || 1) : undefined,
      }));

    // Check if customer_id is a valid UUID (backend requires UUID format)
    const isValidUUID = (str) => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    const orderData = {
      order_number: newOrder.order_number || '',
      organization_id: activeCompany?.id,
      customer_name: newOrder.customer_name,
      // Only send customer_id if it's a valid UUID, otherwise backend will use customer_name
      ...(isValidUUID(newOrder.customer_id) && { customer_id: newOrder.customer_id }),
      order_date: newOrder.order_date,
      delivery_date: newOrder.delivery_date,
      expected_date: newOrder.delivery_date, // Backend uses expected_date
      warehouse_id: newOrder.warehouse_id || undefined,
      carrier: newOrder.carrier || undefined,
      vehicle_number: newOrder.vehicle_number || undefined,
      project_id: newOrder.project_id || undefined,
      project_name: newOrder.project_name || undefined,
      subtotal,
      tax_amount: taxAmount,
      shipping_amount: shippingCost,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      discount_code: newOrder.discount_code || undefined,
      total_amount: total,
      status: 'draft',
      payment_status: 'unpaid',
      payment_journal_id: newOrder.payment_journal_id || undefined,
      lines: validLines.length > 0 ? validLines : undefined, // Only send lines if valid
    };

    // Validate: intercompany orders must have a project selected
    const selectedCustomer = customers.find(c => c.id === newOrder.customer_id);
    if (selectedCustomer?.source_organization_id && !newOrder.project_id) {
      alert(t('intercompany_project_required') || 'Kompaniyalararo buyurtma uchun loyihani tanlash majburiy');
      return;
    }

    try {
      const createdOrder = await createSalesOrder(orderData);

      // Record discount usage if discount was applied
      if (newOrder.discount_id && discountAmount > 0) {
        try {
          await useDiscountCode(
            newOrder.discount_id,
            newOrder.customer_id || null,
            createdOrder?.id || null,
            discountAmount
          );
        } catch (discountError) {
          console.error('Error recording discount usage:', discountError);
        }
      }

      setShowCreateModal(false);
      resetOrderForm();
      setDiscountCodeInput('');
      setDiscountValidation({ valid: false, message: '' });
      addAuditLog('create', 'new', orderData.order_number || `SO-${Date.now()}`);
    } catch (error) {
      console.error('Error creating sales order:', error);
      console.error('Error response:', error.response?.data);
      console.error('Order data sent:', orderData);
      // You could add a toast notification here
    }
  };

  const handleEditOrder = async () => {
    const rawSubtotal = calculateOrderTotals(editingOrder.lines);
    const taxPercent = parseFloat(editingOrder.tax_percent) || 0;
    const selectedTax = editingOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(editingOrder.tax_rate_id)) : defaultSalesTax;
    const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
    const subtotal = taxCalc.subtotal;
    const taxAmount = taxCalc.taxAmount;
    const shippingCost = parseFloat(editingOrder.shipping_cost) || 0;
    const total = subtotal + taxAmount + shippingCost;

    // Filter and format lines - only include lines with valid product_id
    const validLines = editingOrder.lines
      .filter(line => line.product_id && line.product_id.trim() !== '')
      .map(line => ({
        product_id: line.product_id,
        description: line.description || line.product_name || '',
        quantity: parseFloat(line.quantity) || 1,
        unit_price: parseFloat(line.unit_price) || 0,
        packaging_id: line.packaging_id || undefined,
        packaging_qty: line.packaging_id ? (parseFloat(line.packaging_qty) || 1) : undefined,
      }));

    // Check if customer_id is a valid UUID
    const isValidUUID = (str) => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    try {
      await updateSalesOrder(editingOrder.id, {
        customer_name: editingOrder.customer_name,
        ...(isValidUUID(editingOrder.customer_id) && { customer_id: editingOrder.customer_id }),
        delivery_date: editingOrder.delivery_date,
        expected_date: editingOrder.delivery_date,
        warehouse_id: editingOrder.warehouse_id || undefined,
        carrier: editingOrder.carrier || undefined,
        subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingCost,
        total_amount: total,
        lines: validLines.length > 0 ? validLines : undefined,
      });
      setShowEditModal(false);
      setEditingOrder(null);
      addAuditLog('update', editingOrder.id, editingOrder.order_number);
    } catch (error) {
      console.error('Error updating sales order:', error);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    const id = orderId || orderToDelete?.id;
    if (!id) return;
    try {
      await salesService.cancelOrder(id);
      await salesService.deleteOrder(id);
      addAuditLog('delete', id, orderToDelete?.order_number || orderId);
      await refreshModulesData();
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
    setShowDeleteDialog(false);
    setOrderToDelete(null);
  };

  const handleUpdatePaymentStatus = async (orderId, paymentStatus) => {
    try {
      await updateSalesOrder(orderId, { payment_status: paymentStatus });
      addAuditLog('update', orderId, `Payment status: ${paymentStatus}`);
    } catch (error) {
      console.error('Failed to update payment status:', error);
    }
  };

  const resetOrderForm = () => {
    setNewOrder({
      order_number: '',
      customer_name: '',
      customer_id: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date().toISOString().split('T')[0], // Default to today
      warehouse_id: warehouses.length === 1 ? warehouses[0].id : '',
      carrier: '',
      vehicle_number: '',
      project_id: '',
      project_name: '',
      lines: [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }],
      subtotal: 0,
      tax_percent: defaultTaxPercent,
      discount_code: '',
      discount_id: '',
      discount_name: '',
      discount_type: '',
      discount_value: 0,
      max_discount_amount: null,
      tax_amount: 0,
      shipping_cost: 0,
      total_amount: 0,
      payment_journal_id: '',
    });
    setDiscountCodeInput('');
    setDiscountValidation({ valid: false, message: '' });
    setIsDeliveryDateManual(false);
    setIntercompanyProjects([]);
  };

  // Helper: check stock for order lines, returns { issues, inStock, outOfStock }
  const checkOrderStock = async (orderId) => {
    let fullOrder;
    try {
      fullOrder = await getOrder(orderId);
    } catch {
      fullOrder = salesOrders.find(o => o.id === orderId);
    }

    const orderLines = fullOrder?.lines || fullOrder?.order_lines || [];

    // Fetch fresh inventory data
    let inventoryData = null;
    try {
      inventoryData = await inventoryService.listInventory() || [];
    } catch {
      inventoryData = null;
    }

    const inStock = [];
    const outOfStock = [];

    for (const line of orderLines) {
      if (!line.product_id) continue;
      const qty = parseFloat(line.quantity) || 0;

      let available = 0;
      if (inventoryData) {
        const stockRecords = inventoryData.filter(inv =>
          inv.product_id === line.product_id &&
          (!fullOrder.warehouse_id || inv.warehouse_id === fullOrder.warehouse_id)
        );
        available = stockRecords.reduce((sum, s) => sum + (s.quantity_available ?? s.available_quantity ?? s.quantity_on_hand ?? s.quantity ?? 0), 0);
      } else {
        available = getAvailableStock(line.product_id, fullOrder.warehouse_id);
      }

      const product = products.find(p => p.id === line.product_id);
      const lineInfo = {
        ...line,
        product_name: product?.name || line.product_name || line.description || line.product_id,
        requested: qty,
        available: Math.max(0, available),
      };

      if (qty > available) {
        outOfStock.push(lineInfo);
      } else {
        inStock.push(lineInfo);
      }
    }

    return { fullOrder, inventoryData, inStock, outOfStock };
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      if (newStatus === 'confirmed') {
        await confirmSalesOrder(orderId);
      } else {
        await updateSalesOrder(orderId, { status: newStatus });
      }
      if (refreshSalesData) refreshSalesData();
      if (refreshModulesData) refreshModulesData();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Handle partial fulfillment: process available items, create backorder for the rest
  const handlePartialFulfillment = async () => {
    if (!stockWarningOrderId || !stockWarningFullOrder) return;
    try {
      const fullOrder = stockWarningFullOrder;
      const orderLines = fullOrder?.lines || fullOrder?.order_lines || [];
      const outOfStockProductIds = new Set(stockWarningDetails.map(d => {
        // Find the product_id from the original line
        const line = orderLines.find(l =>
          (products.find(p => p.id === l.product_id)?.name || l.product_name || l.description) === d.product_name
        );
        return line?.product_id;
      }).filter(Boolean));

      // Lines that can be fulfilled
      const fulfillableLines = orderLines.filter(l => l.product_id && !outOfStockProductIds.has(l.product_id));
      // Lines that need a backorder
      const backorderLines = orderLines.filter(l => l.product_id && outOfStockProductIds.has(l.product_id));

      if (fulfillableLines.length > 0) {
        // Update the current order to only include fulfillable lines, then confirm/process
        const fulfillableFormatted = fulfillableLines.map(line => ({
          product_id: line.product_id,
          description: line.description || line.product_name || '',
          quantity: parseFloat(line.quantity) || 1,
          unit_price: parseFloat(line.unit_price) || 0,
          packaging_id: line.packaging_id || undefined,
          packaging_qty: line.packaging_id ? (parseFloat(line.packaging_qty) || 1) : undefined,
        }));

        const newSubtotal = fulfillableFormatted.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

        // First update lines, then apply the target status
        await updateSalesOrder(stockWarningOrderId, {
          lines: fulfillableFormatted,
          subtotal: newSubtotal,
          total_amount: newSubtotal + (parseFloat(fullOrder.tax_amount) || 0) + (parseFloat(fullOrder.shipping_cost || fullOrder.shipping_amount) || 0),
        });

        // Now apply the target status transition
        if (stockWarningTargetStatus === 'confirmed') {
          await confirmSalesOrder(stockWarningOrderId);
        } else {
          await updateSalesOrder(stockWarningOrderId, { status: stockWarningTargetStatus || 'processing' });
        }
      }

      // Create a new backorder for out-of-stock items
      if (backorderLines.length > 0) {
        const backorderFormatted = backorderLines.map(line => ({
          product_id: line.product_id,
          description: line.description || line.product_name || '',
          quantity: parseFloat(line.quantity) || 1,
          unit_price: parseFloat(line.unit_price) || 0,
          packaging_id: line.packaging_id || undefined,
          packaging_qty: line.packaging_id ? (parseFloat(line.packaging_qty) || 1) : undefined,
        }));

        const backorderSubtotal = backorderFormatted.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
        await createSalesOrder({
          order_number: `${fullOrder.order_number || ''}-BO`,
          organization_id: fullOrder.organization_id || activeCompany?.id,
          customer_name: fullOrder.customer_name,
          customer_id: fullOrder.customer_id || undefined,
          order_date: new Date().toISOString().split('T')[0],
          delivery_date: fullOrder.delivery_date || fullOrder.expected_date,
          warehouse_id: fullOrder.warehouse_id || undefined,
          subtotal: backorderSubtotal,
          tax_amount: 0,
          shipping_cost: 0,
          total_amount: backorderSubtotal,
          status: 'draft',
          payment_status: 'unpaid',
          lines: backorderFormatted,
        });

        toast.success(t('backorder_created') || 'Yangi buyurtma yaratildi');
      }

      setShowStockWarningModal(false);
      setStockWarningOrderId(null);
      setStockWarningFullOrder(null);
      setStockWarningDetails([]);
      setStockWarningTargetStatus(null);
      setHasPartialStock(false);
      if (refreshSalesData) refreshSalesData();
      if (refreshModulesData) refreshModulesData();
    } catch (error) {
      console.error('Partial fulfillment error:', error);
      toast.error(t('error') || 'Xatolik yuz berdi');
    }
  };

  const handleCreateInvoice = async (orderId) => {
    try {
      const newInvoice = await createInvoiceFromOrder(orderId);
      // Refresh both contexts to get updated invoices and order has_invoice flags
      if (refreshSalesData) refreshSalesData();
      if (refreshModulesData) refreshModulesData();
      // Set the new invoice ID so Invoices component auto-opens it
      if (newInvoice?.id) {
        setNewInvoiceId(newInvoice.id);
      }
      // Switch to invoices tab to show the new invoice
      setActiveTab('invoices');
    } catch (error) {
      console.error('Failed to create invoice:', error);
      // If invoice already exists (400), refresh data silently to hide the button
      if (error?.response?.status === 400) {
        if (refreshSalesData) refreshSalesData();
        if (refreshModulesData) refreshModulesData();
        setActiveTab('invoices');
      } else {
        toast.error(t('error_creating_invoice') || 'Failed to create invoice');
      }
    }
  };

  const handleViewOrder = async (order) => {
    try {
      // Fetch full order details including lines
      const fullOrder = await salesService.getOrder(order.id);
      setSelectedOrder(fullOrder);
      // Get returns for this order
      const orderReturnsData = getOrderReturns(order.id);
      setOrderReturns(orderReturnsData);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      // Fallback to using the list order data
      setSelectedOrder(order);
      setOrderReturns(getOrderReturns(order.id));
      setShowDetailModal(true);
    }
  };

  // Carrier handlers
  const handleCreateCarrier = async () => {
    try {
      const created = await inventoryService.createCarrier(newCarrier);
      setCarriers(prev => [...prev, created]);
      setShowCarrierModal(false);
      resetCarrierForm();
    } catch (error) {
      console.error('Failed to create carrier:', error);
      toast.error(t('error_creating_carrier') || 'Failed to create carrier');
    }
  };

  const handleUpdateCarrier = async () => {
    if (!editingCarrier) return;
    try {
      const updated = await inventoryService.updateCarrier(editingCarrier.id, editingCarrier);
      setCarriers(prev => prev.map(c => c.id === editingCarrier.id ? updated : c));
      setShowCarrierModal(false);
      setEditingCarrier(null);
    } catch (error) {
      console.error('Failed to update carrier:', error);
      toast.error(t('error_updating_carrier') || 'Failed to update carrier');
    }
  };

  const handleEditCarrier = (carrier) => {
    setEditingCarrier({ ...carrier });
    setShowCarrierModal(true);
  };

  const handleToggleCarrierStatus = async (carrier) => {
    try {
      const updated = await inventoryService.updateCarrier(carrier.id, { is_active: !carrier.is_active });
      setCarriers(prev => prev.map(c => c.id === carrier.id ? updated : c));
    } catch (error) {
      console.error('Failed to toggle carrier status:', error);
    }
  };

  const handleDeleteCarrier = async (carrier) => {
    if (!confirm((t('confirm_delete_carrier') || 'Are you sure you want to delete this carrier?'))) return;
    try {
      await inventoryService.deleteCarrier(carrier.id);
      setCarriers(prev => prev.filter(c => c.id !== carrier.id));
    } catch (error) {
      console.error('Failed to delete carrier:', error);
      toast.error(t('error_deleting_carrier') || 'Failed to delete carrier');
    }
  };

  const resetCarrierForm = () => {
    setNewCarrier({
      code: '',
      name: '',
      tracking_url: '',
      phone: '+998',
      email: '',
      website: '',
      notes: '',
      is_active: true,
    });
  };

  const handlePrintOrder = async (order) => {
    try {
      const fullOrder = await salesService.getOrder(order.id);
      setSelectedOrder(fullOrder);
      setShowPrintPreview(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      setSelectedOrder(order);
      setShowPrintPreview(true);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-slate-100 text-slate-800',
      quotation: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.draft;
  };

  // Combined metrics from both contexts
  const metrics = useMemo(() => ({
    totalOrders: salesOrders?.length || 0,
    totalRevenue: salesOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
    activeOrders: salesOrders?.filter(o => ['draft', 'confirmed', 'processing', 'shipped'].includes(o.status)).length || 0,
    avgOrderValue: salesOrders?.length > 0 ? salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / salesOrders.length : 0,
    totalQuotations: quotations?.length || 0,
    pendingQuotations: quotations?.filter(q => q.status === 'sent').length || 0,
    totalInvoices: invoices?.length || 0,
    unpaidInvoices: invoices?.filter(i => i.payment_status !== 'paid').length || 0,
    totalReturns: returns?.length || 0,
    pendingReturns: returns?.filter(r => r.status === 'pending').length || 0,
    activeDiscounts: discounts?.filter(d => d.status === 'active').length || 0,
  }), [salesOrders, quotations, invoices, returns, discounts]);

  const salesData = {};
  salesOrders?.forEach(o => {
    if (o.order_date) {
      try {
        const locale = language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US';
        const month = new Date(o.order_date).toLocaleDateString(locale, { month: 'short' });
        salesData[month] = (salesData[month] || 0) + (o.total_amount || 0);
      } catch (e) {
        // Skip invalid dates
      }
    }
  });
  const chartData = Object.entries(salesData).slice(-6).map(([month, revenue]) => ({ month, revenue }));

  // Tab badges
  const tabCounts = {
    orders: metrics.activeOrders,
    quotations: metrics.pendingQuotations,
    invoices: metrics.unpaidInvoices,
    returns: metrics.pendingReturns,
    discounts: metrics.activeDiscounts,
  };

  // Loading state
  if (ordersLoading || salesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">{t('loading')}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">

        {/* Main Content with Tabs - MOVED ABOVE STATS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard') || 'Dashboard'}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">{t('orders')}</span>
              {tabCounts.orders > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">{tabCounts.orders}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quotations" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('quotations')}</span>
              {tabCounts.quotations > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">{tabCounts.quotations}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('invoices')}</span>
              {tabCounts.invoices > 0 && (
                <Badge className="ml-2 bg-yellow-100 text-yellow-800">{tabCounts.invoices}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="discounts" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">{t('discounts')}</span>
              {tabCounts.discounts > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">{tabCounts.discounts}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">{t('deliveries') || 'Deliveries'}</span>
            </TabsTrigger>
            <TabsTrigger value="carriers" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('carriers') || 'Carriers'}</span>
            </TabsTrigger>
            <TabsTrigger value="dropshipping" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dropshipping') || 'Dropshipping'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab - Stats */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">{t('orders')}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.totalOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-600">{t('revenue')}</p>
                      <p className="text-lg font-bold text-slate-900 truncate">{formatCurrencyCompact(metrics.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">{t('quotations')}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.totalQuotations}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">{t('unpaid')}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.unpaidInvoices}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <RotateCcw className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">{t('returns')}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.totalReturns}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Tag className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">{t('active_discounts')}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.activeDiscounts}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sales Trend Chart */}
            {chartData.length > 0 && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{t('sales_trend')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} width={55} tickFormatter={formatAxisTick} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <Orders
              onCreateOrder={() => setShowCreateModal(true)}
              onEditOrder={async (order) => {
                try {
                  const fullOrder = await salesService.getOrder(order.id);
                  setEditingOrder({
                    ...fullOrder,
                    delivery_date: fullOrder.expected_date || fullOrder.delivery_date || '',
                    shipping_cost: fullOrder.shipping_amount || fullOrder.shipping_cost || 0,
                    lines: fullOrder.lines || [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '' }]
                  });
                } catch (error) {
                  console.error('Failed to fetch order details:', error);
                  setEditingOrder({...order, lines: order.lines || [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '' }]});
                }
                setShowEditModal(true);
              }}
              onViewOrder={handleViewOrder}
              onPrintOrder={handlePrintOrder}
              onUpdateStatus={handleUpdateStatus}
              onCreateInvoice={handleCreateInvoice}
              onDeleteOrder={handleDeleteOrder}
              showImportModal={showImportModal}
              setShowImportModal={setShowImportModal}
              showExportModal={showExportModal}
              setShowExportModal={setShowExportModal}
              showBatchPrint={showBatchPrint}
              setShowBatchPrint={setShowBatchPrint}
            />
          </TabsContent>

          {/* Quotations Tab (with Pricelists and Templates sub-tabs) */}
          <TabsContent value="quotations">
            <QuotationsSection />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Invoices openInvoiceId={newInvoiceId} onInvoiceOpened={() => setNewInvoiceId(null)} />
          </TabsContent>

          {/* Discounts Tab */}
          <TabsContent value="discounts">
            <Discounts />
          </TabsContent>

          {/* Deliveries Tab */}
          <TabsContent value="deliveries">
            <DeliveryOrders />
          </TabsContent>

          {/* Carriers Tab */}
          <TabsContent value="carriers" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg">{t('carriers') || 'Carriers'}</CardTitle>
                  <Button onClick={() => setShowCarrierModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                    <Plus className="w-4 h-4 mr-2" /> {t('new_carrier') || 'New Carrier'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {carriers.length === 0 ? (
                  <div className="text-center py-16">
                    <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">{t('no_carriers_found') || 'No carriers found'}</p>
                    <Button onClick={() => setShowCarrierModal(true)} className="mt-4">{t('create_first_carrier') || 'Create First Carrier'}</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('code') || 'Code'}</TableHead>
                          <TableHead>{t('name') || 'Name'}</TableHead>
                          <TableHead>{t('phone') || 'Phone'}</TableHead>
                          <TableHead>{t('website') || 'Website'}</TableHead>
                          <TableHead>{t('status') || 'Status'}</TableHead>
                          <TableHead>{t('actions') || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carriers.map((carrier) => (
                          <TableRow key={carrier.id} className="hover:bg-slate-50">
                            <TableCell className="font-mono text-sm">{carrier.code}</TableCell>
                            <TableCell className="font-medium">{carrier.name}</TableCell>
                            <TableCell className="text-sm">{carrier.phone || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {carrier.website ? (
                                <a href={carrier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {carrier.website}
                                </a>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className={carrier.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                                {carrier.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleEditCarrier(carrier)} title={t('edit') || 'Edit'}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleToggleCarrierStatus(carrier)} title={carrier.is_active ? (t('deactivate') || 'Deactivate') : (t('activate') || 'Activate')}>
                                  {carrier.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteCarrier(carrier)} title={t('delete') || 'Delete'}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
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
          </TabsContent>

          {/* Dropshipping Tab */}
          <TabsContent value="dropshipping">
            <Dropshipping />
          </TabsContent>
        </Tabs>

        {/* Create Order Modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => { setShowCreateModal(open); if (!open) resetOrderForm(); }}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('create_new_order')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('customer')} *</Label>
                  <Select
                    value={newOrder.customer_id || ''}
                    onValueChange={async (value) => {
                      const customer = customers.find(c => c.id === value);
                      setNewOrder({
                        ...newOrder,
                        customer_id: value,
                        customer_name: customer?.company_name || customer?.name || '',
                        project_id: '',
                        project_name: '',
                      });
                      // If customer is intercompany (has source_organization_id), fetch their projects
                      setIntercompanyProjects([]);
                      if (customer?.source_organization_id) {
                        setLoadingIntercompanyProjects(true);
                        try {
                          const res = await apiClient.get('/projects/by-organization', {
                            params: { organization_id: customer.source_organization_id }
                          });
                          setIntercompanyProjects(res.data?.data || []);
                        } catch (err) {
                          console.error('Failed to fetch intercompany projects:', err);
                        } finally {
                          setLoadingIntercompanyProjects(false);
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_customer') || 'Select customer'} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.company_name || customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('order_date')} *</Label>
                  <Input
                    type="date"
                    value={newOrder.order_date}
                    onChange={(e) => setNewOrder({...newOrder, order_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label>{t('delivery_date')} {!isDeliveryDateManual && <span className="text-xs text-slate-500">({t('auto_calculated') || 'Auto'})</span>}</Label>
                  <Input
                    type="date"
                    value={newOrder.delivery_date}
                    onChange={(e) => {
                      setNewOrder({...newOrder, delivery_date: e.target.value});
                      setIsDeliveryDateManual(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('warehouse') || 'Warehouse'}</Label>
                  {warehouses.length === 1 ? (
                    <Input value={warehouses[0].name} disabled className="bg-slate-50" />
                  ) : (
                    <Select
                      value={newOrder.warehouse_id || ''}
                      onValueChange={(value) => setNewOrder({...newOrder, warehouse_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>{t('carrier') || 'Carrier'}</Label>
                  <Select
                    value={newOrder.carrier || ''}
                    onValueChange={(value) => setNewOrder({...newOrder, carrier: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_carrier') || 'Select carrier'} />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((carrier) => (
                        <SelectItem key={carrier.id} value={carrier.name}>
                          {carrier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('vehicle_number') || 'Moshina raqami'}</Label>
                  <Input
                    placeholder="01 A 123 AA"
                    value={newOrder.vehicle_number || ''}
                    onChange={(e) => setNewOrder({...newOrder, vehicle_number: e.target.value})}
                  />
                </div>
              </div>

              {/* Intercompany Project Selection */}
              {(() => {
                const selectedCustomer = customers.find(c => c.id === newOrder.customer_id);
                if (!selectedCustomer?.source_organization_id) return null;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <Label className="text-sm font-semibold text-blue-800">
                        {t('intercompany_project') || 'Kompaniyalararo loyiha'} <span className="text-red-500">*</span>
                      </Label>
                    </div>
                    <p className="text-xs text-blue-600 mb-2">
                      {t('intercompany_project_hint') || "Buyurtma qaysi loyihaga tegishli ekanligini tanlang"}
                    </p>
                    <Select
                      value={newOrder.project_id || ''}
                      onValueChange={(value) => {
                        const project = intercompanyProjects.find(p => p.id === value);
                        setNewOrder({
                          ...newOrder,
                          project_id: value,
                          project_name: project?.project_name || '',
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          loadingIntercompanyProjects
                            ? (t('loading') || 'Loading...')
                            : (t('select_project') || 'Loyihani tanlang')
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {intercompanyProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.project_code} — {project.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}

              {/* Order Lines */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-semibold">{t('order_items')}</Label>
                  <Button size="sm" variant="outline" onClick={() => handleAddLine(newOrder, setNewOrder, isDeliveryDateManual, setIsDeliveryDateManual)}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_line')}
                  </Button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {newOrder.lines.map((line, index) => {
                    const selectedProduct = products.find(p => p.id === line.product_id);
                    const hasVariants = selectedProduct?.has_variants && productVariants[line.product_id]?.length > 0;
                    const hasPackagings = productPackagings[line.product_id]?.length > 0;
                    return (
                    <div key={index} className="bg-slate-50 p-3 rounded space-y-2">
                      <div className="flex gap-2 items-end">
                        <div className="flex-[2] min-w-0">
                          {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('product')}</Label>}
                          <ProductCombobox
                            products={products}
                            value={line.product_id || ''}
                            onValueChange={(value) => handleLineChange(newOrder, setNewOrder, index, 'product_id', value, isDeliveryDateManual)}
                            placeholder={t('select_product')}
                            t={t}
                          />
                        </div>
                        {hasVariants && (
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('variant')}</Label>}
                            <Select
                              value={line.variant_id || ''}
                              onValueChange={(value) => handleLineChange(newOrder, setNewOrder, index, 'variant_id', value, isDeliveryDateManual)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_variant') || 'Variant'} />
                              </SelectTrigger>
                              <SelectContent>
                                {productVariants[line.product_id]?.map((variant) => (
                                  <SelectItem key={variant.id} value={variant.id}>
                                    {variant.variant_name || variant.display_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {hasPackagings && (
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packaging')}</Label>}
                            <Select
                              value={line.packaging_id || 'none'}
                              onValueChange={(value) => handleLineChange(newOrder, setNewOrder, index, 'packaging_id', value === 'none' ? null : value, isDeliveryDateManual)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('packaging') || 'Packaging'} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t('none') || 'None (units)'}</SelectItem>
                                {productPackagings[line.product_id]?.map((pkg) => (
                                  <SelectItem key={pkg.id} value={pkg.id}>
                                    {pkg.name} ({pkg.qty} {t('units') || 'units'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {line.packaging_id ? (
                          <>
                            <div className="flex-[1] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packs') || 'Packs'}</Label>}
                              <Input
                                type="number"
                                min="1"
                                placeholder={t('packs') || 'Packs'}
                                value={line.packaging_qty || 1}
                                onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'packaging_qty', e.target.value, isDeliveryDateManual)}
                              />
                            </div>
                            <div className="flex-[1] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total_qty') || 'Total'}</Label>}
                              <Input
                                type="number"
                                placeholder={t('total_qty') || 'Total'}
                                value={line.quantity}
                                disabled
                                className="bg-slate-100"
                                title={`${line.packaging_qty || 1} × ${line.packaging_unit_qty || 1} = ${line.quantity}`}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex-[1] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('qty')}</Label>}
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                placeholder={t('qty')}
                                value={line.quantity}
                                onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'quantity', e.target.value, isDeliveryDateManual)}
                              />
                              {line.unit_name && (
                                <span className="text-xs text-slate-500 whitespace-nowrap">{line.unit_name}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex-[1.5] min-w-0">
                          {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('price')}</Label>}
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder={t('price')}
                            value={formatPriceInput(line.unit_price)}
                            onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'unit_price', parsePriceInput(e.target.value), isDeliveryDateManual)}
                          />
                        </div>
                        <div className="flex-[1.5] min-w-0">
                          {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total')}</Label>}
                          <div className="h-9 flex items-center justify-end px-3 bg-white border rounded-md text-sm font-medium text-slate-700">
                            {formatPriceInput(String((parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)).toFixed(2)))}
                          </div>
                        </div>
                        {!line.packaging_id && (
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('note')}</Label>}
                            <Input
                              placeholder={t('note')}
                              value={line.description}
                              onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'description', e.target.value, isDeliveryDateManual)}
                            />
                          </div>
                        )}
                        <div className="flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLine(newOrder, setNewOrder, index, isDeliveryDateManual)}
                            disabled={newOrder.lines.length === 1}
                            className="text-red-600 h-9 w-9 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {line.variant_name && (
                        <div className="text-xs text-slate-500 pl-1">
                          {t('variant')}: {line.variant_name}
                        </div>
                      )}
                      {line.product?.has_delivery && (
                        <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded mt-1 bg-blue-50 text-blue-600 border border-blue-200">
                          <span>🚚 {t('delivery_price') || 'Yetkazib berish'}: {formatCurrency(line.product.delivery_price || 0)}</span>
                        </div>
                      )}
                      {(() => {
                        const warning = getStockWarning(line, newOrder.warehouse_id);
                        if (!warning) return null;
                        return (
                          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded mt-1 ${
                            warning.type === 'error'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}>
                            <MessageSquareWarning className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{warning.message}</span>
                          </div>
                        );
                      })()}
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Tax and Shipping */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label>{t('tax')} (%)</Label>
                  <Popover>
                    <PopoverAnchor asChild>
                      <div className="flex">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={newOrder.tax_percent}
                          onChange={(e) => setNewOrder({...newOrder, tax_percent: e.target.value})}
                          className="rounded-r-none border-r-0"
                        />
                        {parseFloat(newOrder.tax_percent) > 0 && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-none border-x-0 shrink-0 px-1 text-slate-400 hover:text-red-500"
                            onClick={() => setNewOrder({...newOrder, tax_percent: 0, tax_rate_id: ''})}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-l-none border-l-0 shrink-0 px-2">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                      </div>
                    </PopoverAnchor>
                    <PopoverContent className="w-56 p-1" align="end">
                      <div className="space-y-0.5">
                        {salesTaxRates.map(tr => (
                          <PopoverTrigger asChild key={tr.id}>
                            <button
                              className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors"
                              onClick={() => setNewOrder({...newOrder, tax_percent: tr.rate, tax_rate_id: tr.id})}
                            >
                              {tr.name} ({tr.rate}%){tr.price_include ? ` (${t('incl') || 'incl.'})` : ''}
                            </button>
                          </PopoverTrigger>
                        ))}
                        {salesTaxRates.length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-500">{t('no_tax_rates') || 'No tax rates available'}</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>{t('shipping')}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatPriceInput(newOrder.shipping_cost)}
                    onChange={(e) => setNewOrder({...newOrder, shipping_cost: parsePriceInput(e.target.value)})}
                  />
                </div>
              </div>

              {/* Discount Code */}
              <div className="border-t pt-4">
                <Label>{t('discount_code') || 'Discount Code'}</Label>
                <div className="flex gap-2 mt-1">
                  {!newOrder.discount_id ? (
                    <>
                      <Input
                        placeholder={t('enter_code') || 'Enter discount code'}
                        value={discountCodeInput}
                        onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleApplyDiscount}
                        disabled={!discountCodeInput.trim()}
                      >
                        {t('apply') || 'Apply'}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full p-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-700">{newOrder.discount_code}</span>
                        <span className="text-green-600">- {newOrder.discount_name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveDiscount}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {discountValidation.message && !newOrder.discount_id && (
                  <p className={`text-sm mt-1 ${discountValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                    {discountValidation.message}
                  </p>
                )}
              </div>

              {/* Payment Journal */}
              {bankCashJournals.length > 0 && (
                <div>
                  <Label>{t('payment_journal') || "To'lov jurnali"}</Label>
                  <Select
                    value={newOrder.payment_journal_id || ''}
                    onValueChange={(value) => setNewOrder({...newOrder, payment_journal_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_journal') || "Jurnal tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankCashJournals.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.name} ({j.type === 'bank' ? t('bank') || 'Bank' : t('cash') || 'Naqd'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Totals */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="space-y-2">
                  {(() => {
                    const rawSubtotal = calculateOrderTotals(newOrder.lines);
                    const taxPercent = parseFloat(newOrder.tax_percent) || 0;
                    const selectedTax = newOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newOrder.tax_rate_id)) : defaultSalesTax;
                    const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
                    const subtotal = taxCalc.subtotal;
                    const taxAmount = taxCalc.taxAmount;
                    const shippingCost = parseFloat(newOrder.shipping_cost) || 0;
                    const discountAmount = newOrder.discount_id ? calculateDiscountAmount(subtotal, {
                      discount_type: newOrder.discount_type,
                      discount_value: newOrder.discount_value,
                      max_discount_amount: newOrder.max_discount_amount,
                    }) : 0;
                    const total = subtotal + taxAmount + shippingCost - discountAmount;
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('subtotal')}:</span>
                          <span className="font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>{t('discount')} ({newOrder.discount_code}):</span>
                            <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('tax')}{taxCalc.isInclusive ? ` (${t('incl') || 'incl.'})` : ''}:</span>
                          <span className="font-medium">{formatCurrency(taxAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('shipping')}:</span>
                          <span className="font-medium">{formatCurrency(shippingCost)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                          <span className="font-semibold text-lg">{t('total_amount')}:</span>
                          <span className="text-2xl font-bold text-blue-600">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); resetOrderForm(); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newOrder.customer_name || newOrder.lines.every(l => !l.product_id && !l.product_name)}
                >
                  {t('create')}
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
          entityName={t('sales_order')}
        />

        {/* Export Modal */}
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          data={filteredOrders}
          columns={exportColumns}
          entityName={t('sales_orders')}
          title={t('sales_orders')}
        />

        {/* Print Preview Modal */}
        {selectedOrder && (
          <PrintPreviewModal
            open={showPrintPreview}
            onClose={() => {
              setShowPrintPreview(false);
              setSelectedOrder(null);
            }}
            config={generatePrintConfig(selectedOrder)}
            filename={`sales_order_${selectedOrder.id}`}
          />
        )}

        {/* Order Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={(open) => { setShowDetailModal(open); if (!open) { setSelectedOrder(null); setOrderReturns([]); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {t('order_details') || 'Order Details'}
                {selectedOrder && orderHasReturns(selectedOrder.id) && (
                  <Badge className="bg-red-100 text-red-700">
                    <MessageSquareWarning className="w-3 h-3 mr-1" />
                    {t('has_returns') || 'Has Returns'}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{t('order_number') || 'Order Number'}</p>
                    <p className="font-mono font-medium">{selectedOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('status') || 'Status'}</p>
                    <Badge className={getStatusColor(selectedOrder.status)}>{t(selectedOrder.status)}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('customer') || 'Customer'}</p>
                    <p className="font-medium">{selectedOrder.customer_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('order_date') || 'Order Date'}</p>
                    <p className="font-medium">
                      {selectedOrder.order_date ? format(new Date(selectedOrder.order_date), 'dd.MM.yyyy') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('delivery_date') || 'Delivery Date'}</p>
                    <p className="font-medium">
                      {(selectedOrder.expected_date || selectedOrder.delivery_date || selectedOrder.expected_delivery_date)
                        ? format(new Date(selectedOrder.expected_date || selectedOrder.delivery_date || selectedOrder.expected_delivery_date), 'dd.MM.yyyy')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('payment_status') || 'Payment Status'}</p>
                    <Badge className={
                      selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                      selectedOrder.payment_status === 'partial' || selectedOrder.payment_status === 'partial_paid' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {t(selectedOrder.payment_status) || selectedOrder.payment_status || t('unpaid') || 'Unpaid'}
                    </Badge>
                  </div>
                  {selectedOrder.carrier && (
                    <div>
                      <p className="text-sm text-slate-500">{t('carrier') || 'Tashuvchi'}</p>
                      <p className="font-medium">{selectedOrder.carrier}</p>
                    </div>
                  )}
                  {selectedOrder.vehicle_number && (
                    <div>
                      <p className="text-sm text-slate-500">{t('vehicle_number') || 'Moshina raqami'}</p>
                      <p className="font-medium">{selectedOrder.vehicle_number}</p>
                    </div>
                  )}
                  {selectedOrder.project_name && (
                    <div>
                      <p className="text-sm text-slate-500">{t('project') || 'Loyiha'}</p>
                      <p className="font-medium flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-500" />
                        {selectedOrder.project_name}
                      </p>
                    </div>
                  )}
                </div>

                {selectedOrder.lines && selectedOrder.lines.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">{t('order_items') || 'Order Items'}</p>
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      {selectedOrder.lines.map((line, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                          <div>
                            <span className="font-medium">{line.description || line.product_name || 'Product'}</span>
                            <p className="text-xs text-slate-500">{t('quantity')}: {line.quantity}{line.unit_name ? ` ${line.unit_name}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{formatCurrency(line.quantity * line.unit_price)}</span>
                            <p className="text-xs text-slate-500">{formatCurrency(line.unit_price)} x {line.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('subtotal')}:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('tax')}:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('shipping')}:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.shipping_amount || selectedOrder.shipping_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                      <span className="font-semibold text-lg">{t('total_amount')}:</span>
                      <span className="text-2xl font-bold text-blue-600">{formatCurrency(selectedOrder.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Returns Section */}
                {orderReturns.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2 flex items-center gap-2 text-red-600">
                      <RotateCcw className="w-4 h-4" />
                      {t('returns') || 'Returns'}
                    </p>
                    <div className="space-y-3">
                      {orderReturns.map((ret) => (
                        <div key={ret.id} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-red-700">{ret.return_number}</span>
                              <Badge className={
                                ret.status === 'completed' || ret.status === 'refunded' ? 'bg-green-100 text-green-800' :
                                ret.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                ret.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                ret.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                                'bg-gray-100 text-gray-800'
                              }>{t(ret.status) || ret.status}</Badge>
                            </div>
                            <span className="text-sm text-slate-500">
                              {ret.return_date ? format(new Date(ret.return_date), 'dd.MM.yyyy') : '-'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-500">{t('reason') || 'Reason'}:</span>
                              <span className="ml-1 font-medium">{t(ret.return_reason) || ret.return_reason}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{t('total_value') || 'Total Value'}:</span>
                              <span className="ml-1 font-semibold text-red-600">{formatCurrency(ret.total_amount || ret.refund_amount || 0)}</span>
                            </div>
                          </div>
                          {/* Returned Items */}
                          {ret.items && ret.items.length > 0 && (
                            <div className="mt-2 border-t border-red-100 pt-2">
                              <p className="text-xs text-slate-500 mb-1">{t('returned_items') || 'Returned Items'}:</p>
                              <div className="space-y-1">
                                {ret.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm bg-white/50 px-2 py-1 rounded">
                                    <span className="font-medium">{item.product_name}</span>
                                    <span className="text-red-600 font-semibold">
                                      {item.quantity} {t('pcs') || 'pcs'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {ret.notes && (
                            <p className="text-sm text-slate-600 mt-2 border-t border-red-100 pt-2">{ret.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div>
                    <p className="text-sm text-slate-500">{t('notes') || 'Notes'}</p>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowDetailModal(false); setSelectedOrder(null); setOrderReturns([]); }} className="flex-1">
                    {t('close') || 'Close'}
                  </Button>
                  <Button onClick={() => { setShowDetailModal(false); handlePrintOrder(selectedOrder); }} className="flex-1">
                    <Printer className="w-4 h-4 mr-2" /> {t('print') || 'Print'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Batch Print Modal */}
        <BatchPrintModal
          open={showBatchPrint}
          onClose={() => setShowBatchPrint(false)}
          documents={filteredOrders.map(o => ({
            id: o.id,
            name: o.order_number,
            number: o.order_number,
            date: o.order_date ? format(new Date(o.order_date), 'dd.MM.yyyy') : '',
          }))}
          generateConfig={generatePrintConfig}
          entityName={t('order')}
        />

        {/* Edit Order Modal */}
        {editingOrder && (
          <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) { setEditingOrder(null); setIsEditDeliveryDateManual(false); } }}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('edit_order')} - {editingOrder.order_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('customer')} *</Label>
                    <Select
                      value={editingOrder.customer_id || ''}
                      onValueChange={(value) => {
                        const customer = customers.find(c => c.id === value);
                        setEditingOrder({
                          ...editingOrder,
                          customer_id: value,
                          customer_name: customer?.company_name || customer?.name || ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={editingOrder.customer_name || t('select_customer') || 'Select customer'} />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.company_name || customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('delivery_date')} {!isEditDeliveryDateManual && <span className="text-xs text-slate-500">({t('auto_calculated') || 'Auto'})</span>}</Label>
                    <Input
                      type="date"
                      value={editingOrder.delivery_date || ''}
                      onChange={(e) => {
                        setEditingOrder({...editingOrder, delivery_date: e.target.value});
                        setIsEditDeliveryDateManual(true);
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('warehouse') || 'Warehouse'}</Label>
                    {warehouses.length === 1 ? (
                      <Input value={warehouses[0].name} disabled className="bg-slate-50" />
                    ) : (
                      <Select
                        value={editingOrder.warehouse_id || ''}
                        onValueChange={(value) => setEditingOrder({...editingOrder, warehouse_id: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label>{t('carrier') || 'Carrier'}</Label>
                    <Select
                      value={editingOrder.carrier || ''}
                      onValueChange={(value) => setEditingOrder({...editingOrder, carrier: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_carrier') || 'Select carrier'} />
                      </SelectTrigger>
                      <SelectContent>
                        {carriers.map((carrier) => (
                          <SelectItem key={carrier.id} value={carrier.name}>
                            {carrier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Order Lines */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-semibold">{t('order_items')}</Label>
                    <Button size="sm" variant="outline" onClick={() => handleAddLine(editingOrder, setEditingOrder, isEditDeliveryDateManual, setIsEditDeliveryDateManual)}>
                      <Plus className="w-4 h-4 mr-1" /> {t('add_line')}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {editingOrder.lines.map((line, index) => {
                      const selectedProduct = products.find(p => p.id === line.product_id);
                      const hasVariants = selectedProduct?.has_variants && productVariants[line.product_id]?.length > 0;
                      const hasPackagings = productPackagings[line.product_id]?.length > 0;
                      return (
                      <div key={index} className="bg-slate-50 p-3 rounded space-y-2">
                        <div className="flex gap-2 items-end">
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('product')}</Label>}
                            <ProductCombobox
                              products={products}
                              value={line.product_id || ''}
                              onValueChange={(value) => handleLineChange(editingOrder, setEditingOrder, index, 'product_id', value, isEditDeliveryDateManual)}
                              placeholder={line.product_name || t('select_product')}
                              t={t}
                            />
                          </div>
                          {hasVariants && (
                            <div className="flex-[2] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('variant')}</Label>}
                              <Select
                                value={line.variant_id || ''}
                                onValueChange={(value) => handleLineChange(editingOrder, setEditingOrder, index, 'variant_id', value, isEditDeliveryDateManual)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('select_variant') || 'Variant'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {productVariants[line.product_id]?.map((variant) => (
                                    <SelectItem key={variant.id} value={variant.id}>
                                      {variant.variant_name || variant.display_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {hasPackagings && (
                            <div className="flex-[2] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packaging')}</Label>}
                              <Select
                                value={line.packaging_id || 'none'}
                                onValueChange={(value) => handleLineChange(editingOrder, setEditingOrder, index, 'packaging_id', value === 'none' ? null : value, isEditDeliveryDateManual)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('packaging') || 'Packaging'} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t('none') || 'None (units)'}</SelectItem>
                                  {productPackagings[line.product_id]?.map((pkg) => (
                                    <SelectItem key={pkg.id} value={pkg.id}>
                                      {pkg.name} ({pkg.qty} {t('units') || 'units'})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {line.packaging_id ? (
                            <>
                              <div className="flex-[1] min-w-0">
                                {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packs') || 'Packs'}</Label>}
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder={t('packs') || 'Packs'}
                                  value={line.packaging_qty || 1}
                                  onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'packaging_qty', e.target.value, isEditDeliveryDateManual)}
                                />
                              </div>
                              <div className="flex-[1] min-w-0">
                                {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total_qty') || 'Total'}</Label>}
                                <Input
                                  type="number"
                                  placeholder={t('total_qty') || 'Total'}
                                  value={line.quantity}
                                  disabled
                                  className="bg-slate-100"
                                  title={`${line.packaging_qty || 1} × ${line.packaging_unit_qty || 1} = ${line.quantity}`}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="flex-[1] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('qty')}</Label>}
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  placeholder={t('qty')}
                                  value={line.quantity}
                                  onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'quantity', e.target.value, isEditDeliveryDateManual)}
                                />
                                {line.unit_name && (
                                  <span className="text-xs text-slate-500 whitespace-nowrap">{line.unit_name}</span>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex-[1.5] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('price')}</Label>}
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder={t('price')}
                              value={formatPriceInput(line.unit_price)}
                              onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'unit_price', parsePriceInput(e.target.value), isEditDeliveryDateManual)}
                            />
                          </div>
                          <div className="flex-[1.5] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total')}</Label>}
                            <div className="h-9 flex items-center justify-end px-3 bg-white border rounded-md text-sm font-medium text-slate-700">
                              {formatPriceInput(String((parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)).toFixed(2)))}
                            </div>
                          </div>
                          {!line.packaging_id && (
                            <div className="flex-[2] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('note')}</Label>}
                              <Input
                                placeholder={t('note')}
                                value={line.description || ''}
                                onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'description', e.target.value, isEditDeliveryDateManual)}
                              />
                            </div>
                          )}
                          <div className="flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveLine(editingOrder, setEditingOrder, index, isEditDeliveryDateManual)}
                              disabled={editingOrder.lines.length === 1}
                              className="text-red-600 h-9 w-9 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {line.packaging_name && (
                          <div className="text-xs text-slate-500 pl-1">
                            {t('packaging')}: {line.packaging_name} ({line.packaging_qty || 1} × {line.packaging_unit_qty || 1} = {line.quantity} {t('units') || 'units'})
                          </div>
                        )}
                        {line.product?.has_delivery && (
                          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded mt-1 bg-blue-50 text-blue-600 border border-blue-200">
                            <span>🚚 {t('delivery_price') || 'Yetkazib berish'}: {formatCurrency(line.product.delivery_price || 0)}</span>
                          </div>
                        )}
                        {(() => {
                          const warning = getStockWarning(line, editingOrder.warehouse_id);
                          if (!warning) return null;
                          return (
                            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded mt-1 ${
                              warning.type === 'error'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}>
                              <MessageSquareWarning className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{warning.message}</span>
                            </div>
                          );
                        })()}
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tax and Shipping */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <Label>{t('tax')} (%)</Label>
                    <Popover>
                      <PopoverAnchor asChild>
                        <div className="flex">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={editingOrder.tax_percent || 0}
                            onChange={(e) => setEditingOrder({...editingOrder, tax_percent: e.target.value})}
                            className="rounded-r-none border-r-0"
                          />
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-l-none border-l-0 shrink-0 px-2">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                        </div>
                      </PopoverAnchor>
                      <PopoverContent className="w-56 p-1" align="end">
                        <div className="space-y-0.5">
                          {salesTaxRates.map(tr => (
                            <PopoverTrigger asChild key={tr.id}>
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors"
                                onClick={() => setEditingOrder({...editingOrder, tax_percent: tr.rate})}
                              >
                                {tr.name} ({tr.rate}%)
                              </button>
                            </PopoverTrigger>
                          ))}
                          {salesTaxRates.length === 0 && (
                            <div className="px-3 py-2 text-sm text-slate-500">{t('no_tax_rates') || 'No tax rates available'}</div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>{t('shipping')}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formatPriceInput(editingOrder.shipping_cost || 0)}
                      onChange={(e) => setEditingOrder({...editingOrder, shipping_cost: parsePriceInput(e.target.value)})}
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    {(() => {
                      const rawSubtotal = calculateOrderTotals(editingOrder.lines);
                      const taxPercent = parseFloat(editingOrder.tax_percent) || 0;
                      const selectedTax = editingOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(editingOrder.tax_rate_id)) : defaultSalesTax;
                      const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
                      const subtotal = taxCalc.subtotal;
                      const taxAmount = taxCalc.taxAmount;
                      const shippingCost = parseFloat(editingOrder.shipping_cost) || 0;
                      const total = subtotal + taxAmount + shippingCost;
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('subtotal')}:</span>
                            <span className="font-medium">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('tax')}{taxCalc.isInclusive ? ` (${t('incl') || 'incl.'})` : ''}:</span>
                            <span className="font-medium">{formatCurrency(taxAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('shipping')}:</span>
                            <span className="font-medium">{formatCurrency(shippingCost)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                            <span className="font-semibold text-lg">{t('total_amount')}:</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {formatCurrency(total)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingOrder(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleEditOrder}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                    disabled={!editingOrder.customer_name || editingOrder.lines.every(l => !l.product_id && !l.product_name)}
                  >
                    {t('save_changes')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_order_confirm')} <strong>{orderToDelete?.order_number}</strong>? {t('action_cannot_undone')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setOrderToDelete(null); }}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOrder}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Stock Warning Modal */}
        <AlertDialog open={showStockWarningModal} onOpenChange={(open) => {
          if (!open) {
            setShowStockWarningModal(false);
            setStockWarningOrderId(null);
            setStockWarningFullOrder(null);
            setStockWarningDetails([]);
            setStockWarningTargetStatus(null);
            setHasPartialStock(false);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <MessageSquareWarning className="w-5 h-5" />
                {t('insufficient_stock')}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    {hasPartialStock
                      ? (t('partial_stock_message') || "Ba'zi mahsulotlar omborda mavjud emas. Mavjud mahsulotlarni tasdiqlab, qolganlar uchun yangi buyurtma yaratilsinmi?")
                      : (t('cannot_confirm_order_stock'))
                    }
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    {stockWarningDetails.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{item.product_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{t('qty')}: {item.requested}</span>
                          <span className={item.available <= 0 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                            {t('available_stock')}: {item.available}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-2">
              <AlertDialogCancel onClick={() => {
                setShowStockWarningModal(false);
                setStockWarningOrderId(null);
                setStockWarningFullOrder(null);
                setStockWarningDetails([]);
                setStockWarningTargetStatus(null);
                setHasPartialStock(false);
              }}>
                {t('cancel')}
              </AlertDialogCancel>
              {hasPartialStock && (
                <AlertDialogAction
                  onClick={handlePartialFulfillment}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {t('confirm_available_create_backorder') || "Mavjudlarini tasdiqlash"}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Carrier Modal */}
        <Dialog open={showCarrierModal} onOpenChange={(open) => { setShowCarrierModal(open); if (!open) { setEditingCarrier(null); resetCarrierForm(); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCarrier ? (t('edit_carrier') || 'Edit Carrier') : (t('create_carrier') || 'Create Carrier')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('code') || 'Code'} *</Label>
                  <Input
                    placeholder="e.g. DHL"
                    value={editingCarrier ? editingCarrier.code : newCarrier.code}
                    onChange={(e) => editingCarrier
                      ? setEditingCarrier({...editingCarrier, code: e.target.value})
                      : setNewCarrier({...newCarrier, code: e.target.value})
                    }
                  />
                </div>
                <div>
                  <Label>{t('name') || 'Name'} *</Label>
                  <Input
                    placeholder="e.g. DHL Express"
                    value={editingCarrier ? editingCarrier.name : newCarrier.name}
                    onChange={(e) => editingCarrier
                      ? setEditingCarrier({...editingCarrier, name: e.target.value})
                      : setNewCarrier({...newCarrier, name: e.target.value})
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('phone') || 'Phone'}</Label>
                  <Input
                    placeholder="+998 90 123 45 67"
                    value={editingCarrier ? (editingCarrier.phone || '') : newCarrier.phone}
                    onChange={(e) => editingCarrier
                      ? setEditingCarrier({...editingCarrier, phone: e.target.value})
                      : setNewCarrier({...newCarrier, phone: e.target.value})
                    }
                  />
                </div>
                <div>
                  <Label>{t('email') || 'Email'}</Label>
                  <Input
                    type="email"
                    placeholder="support@carrier.com"
                    value={editingCarrier ? (editingCarrier.email || '') : newCarrier.email}
                    onChange={(e) => editingCarrier
                      ? setEditingCarrier({...editingCarrier, email: e.target.value})
                      : setNewCarrier({...newCarrier, email: e.target.value})
                    }
                  />
                </div>
              </div>

              <div>
                <Label>{t('website') || 'Website'}</Label>
                <Input
                  placeholder="https://www.carrier.com"
                  value={editingCarrier ? (editingCarrier.website || '') : newCarrier.website}
                  onChange={(e) => editingCarrier
                    ? setEditingCarrier({...editingCarrier, website: e.target.value})
                    : setNewCarrier({...newCarrier, website: e.target.value})
                  }
                />
              </div>

              <div>
                <Label>{t('tracking_url') || 'Tracking URL'}</Label>
                <Input
                  placeholder="https://track.carrier.com/?id={tracking_number}"
                  value={editingCarrier ? (editingCarrier.tracking_url || '') : newCarrier.tracking_url}
                  onChange={(e) => editingCarrier
                    ? setEditingCarrier({...editingCarrier, tracking_url: e.target.value})
                    : setNewCarrier({...newCarrier, tracking_url: e.target.value})
                  }
                />
                <p className="text-xs text-slate-500 mt-1">{t('tracking_url_hint') || 'Use {tracking_number} as placeholder'}</p>
              </div>

              <div>
                <Label>{t('notes') || 'Notes'}</Label>
                <Input
                  placeholder={t('notes_placeholder') || 'Additional notes...'}
                  value={editingCarrier ? (editingCarrier.notes || '') : newCarrier.notes}
                  onChange={(e) => editingCarrier
                    ? setEditingCarrier({...editingCarrier, notes: e.target.value})
                    : setNewCarrier({...newCarrier, notes: e.target.value})
                  }
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowCarrierModal(false); setEditingCarrier(null); resetCarrierForm(); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={editingCarrier ? handleUpdateCarrier : handleCreateCarrier}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={editingCarrier ? (!editingCarrier.code || !editingCarrier.name) : (!newCarrier.code || !newCarrier.name)}
                >
                  {editingCarrier ? (t('save_changes') || 'Save Changes') : (t('create') || 'Create')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
