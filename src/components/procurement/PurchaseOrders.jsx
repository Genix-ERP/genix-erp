import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductCombobox from "@/components/shared/ProductCombobox";
import QuickProductModal from "@/components/shared/QuickProductModal";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { inventoryService } from '@/api/services/inventory';
import { constructionService } from '@/api/services/construction';
import { fixedAssetsV2Service } from '@/api/services/fixedAssetsV2';
import { PrintButton, PrintPreviewModal } from '@/components/shared';
import apiClient from '@/api/client';
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Search,
  ShoppingCart,
  Truck,
  Edit,
  X,
  Eye,
  MessageSquareWarning,
  RotateCcw,
  ClipboardList,
  Layers,
  DollarSign,
  Trash2,
  Receipt,
  ChevronDown,
  Package,
  ScanLine,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Landmark,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useInventory } from '@/components/contexts/InventoryContext';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { procurementService } from '@/api/services/procurement';
import { financeService } from '@/api/services/finance';
import { useToast } from "@/components/ui/use-toast";
import { formatApiError } from "@/utils/apiErrors";
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import PurchaseReturns from './PurchaseReturns';
import BlanketOrders from './BlanketOrders';
import LandedCosts from './LandedCosts';
import GoodsReceipt from './GoodsReceipt';
import PurchaseRequisitions from '@/components/procurement/PurchaseRequisitions';

export default function PurchaseOrders({ initialSubtab = 'orders' }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, MODULES } = usePermissions();
  const { getSetting } = useAdminSettings();
  const { taxRates = [] } = useFinancials();
  const { formatCurrency } = useCurrencyFormatter();
  const { toast } = useToast();
  const [, setSearchParams] = useSearchParams();

  // Get default tax from settings
  const defaultPurchaseTaxId = getSetting('purchase.tax.default_tax_id', '');
  const purchaseTaxRates = taxRates.filter(tr => tr.tax_type === 'purchase' || !tr.tax_type);
  // Prefer the explicitly configured default, fall back to first active purchase tax
  const defaultPurchaseTax = defaultPurchaseTaxId
    ? taxRates.find(tr => String(tr.id) === String(defaultPurchaseTaxId))
    : purchaseTaxRates.find(tr => tr.is_active !== false) || null;
  const defaultTaxPercent = defaultPurchaseTax?.rate || 0;

  const {
    suppliers,
    purchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    approvePurchaseOrder,
    receivePurchaseOrder,
    getSupplierById,
    isLoading,
    refreshData,
  } = useProcurement();
  const { refreshData: refreshInventory } = useInventory();
  const { activeCompany } = useCompany();

  const [activeTab, setActiveTab] = useState(initialSubtab);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Toggleable list columns (persisted per browser).
  const PO_COLS = [
    { key: 'po_number', label: t('po_number') || 'PO #' },
    { key: 'supplier', label: t('supplier') || 'Supplier' },
    { key: 'order_date', label: t('order_date') || 'Order Date' },
    { key: 'delivery_date', label: t('delivery_date') || 'Delivery Date' },
    { key: 'quantity', label: t('quantity') || 'Quantity' },
    { key: 'amount', label: t('amount') || 'Amount' },
    { key: 'payment_status', label: t('payment_status') || 'Payment' },
    { key: 'status', label: t('status') || 'Status' },
  ];
  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('po_visible_cols')); if (s && typeof s === 'object') return s; } catch { /* ignore */ }
    return { po_number: true, supplier: true, order_date: true, delivery_date: true, quantity: true, amount: true, payment_status: true, status: true };
  });
  useEffect(() => { try { localStorage.setItem('po_visible_cols', JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols]);
  const colOn = (k) => visibleCols[k] !== false;
  const toggleCol = (k) => setVisibleCols(prev => ({ ...prev, [k]: !colOn(k) }));
  const paymentStatusColor = (s) => ({
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100 text-red-700',
    pending: 'bg-slate-100 text-slate-600',
  }[s] || 'bg-slate-100 text-slate-600');
  const paymentStatusLabel = (s) => {
    if (s === 'partial') return t('partially_paid') || 'Partially paid';
    return t(s) || s || '-';
  };
  const [statusFilter, setStatusFilter] = useState('all');

  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedOrders, setPaginatedOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const pageSize = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editPO, setEditPO] = useState(null);
  const [detailPO, setDetailPO] = useState(null);
  // "Aktivga aylantirish" — capitalize a received PO line into the fixed-asset
  // register (reclass posting, no second supplier debt; audit finding #10).
  const [capLine, setCapLine] = useState(null);
  const [capMapping, setCapMapping] = useState(null);
  const [capForm, setCapForm] = useState({ category_id: '', department_id: '', useful_life_months: '', cost: '', name: '' });
  const [capBusy, setCapBusy] = useState(false);

  const openCapitalize = async (line) => {
    setCapLine(line);
    const lineTotal = line.line_total || (line.quantity || 0) * (line.unit_price || 0);
    setCapForm({
      category_id: '', department_id: '',
      useful_life_months: '',
      cost: String(lineTotal || ''),
      name: line.product_name || line.description || '',
    });
    if (!capMapping) {
      try { setCapMapping(await fixedAssetsV2Service.getMapping()); } catch { setCapMapping({ categories: [], departments: [] }); }
    }
  };

  const submitCapitalize = async () => {
    if (!capForm.category_id || !capForm.department_id || !(parseInt(capForm.useful_life_months, 10) > 0) || !(parseFloat(capForm.cost) > 0)) {
      toast({ title: t('fill_required') || "Majburiy maydonlarni to'ldiring", variant: 'destructive' });
      return;
    }
    setCapBusy(true);
    try {
      const r = await fixedAssetsV2Service.createFromPO({
        purchase_order_id: detailPO.id,
        line_id: capLine?.id || '',
        name: capForm.name,
        category_id: capForm.category_id,
        department_id: capForm.department_id,
        useful_life_months: parseInt(capForm.useful_life_months, 10),
        cost: parseFloat(capForm.cost),
      });
      toast({ title: t('po_capitalized_ok') || 'Aktiv yaratildi (ombordan kapitallashtirildi)', description: r?.inventory_number });
      setCapLine(null);
    } catch (e) {
      const err = e?.response?.data?.error;
      toast({ title: err?.message_uz || err?.message || 'Xatolik', variant: 'destructive' });
    } finally {
      setCapBusy(false);
    }
  };
  const [detailPOLines, setDetailPOLines] = useState([]);
  const [orderReturns, setOrderReturns] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Products list for selection
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  // Quick "create product" from a line's product dropdown. Shape:
  // { name, onPick(product) } | null. onPick selects the new product into the
  // line that triggered the create.
  const [quickCreate, setQuickCreate] = useState(null);

  // Warehouses for selection
  const [warehouses, setWarehouses] = useState([]);

  // Product variants
  const [productVariants, setProductVariants] = useState({});

  // Product packagings
  const [productPackagings, setProductPackagings] = useState({});

  // Track if delivery date was manually set
  const [isDeliveryDateManual, setIsDeliveryDateManual] = useState(false);

  // Track which POs already have vendor bills
  const [poBillMap, setPoBillMap] = useState({});

  // Receipt scan
  const receiptInputRef = useRef(null);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [unmatchedProducts, setUnmatchedProducts] = useState([]);

  const [newPO, setNewPO] = useState({
    po_number: '',
    supplier_id: '',
    vendor_name: '',
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    tax_percent: 0,
    tax_rate_id: '',
    payment_terms: 'net_30',
    vehicle_number: '',
    requires_shipping: true,
    construction_project_id: '',
    lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
  });

  // Construction projects for the optional PO ↔ obyekt link (migration 450):
  // received lines then feed the object's actual cost.
  const [constructionProjects, setConstructionProjects] = useState([]);
  useEffect(() => {
    constructionService.listProjects({ limit: 200 })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items || [];
        setConstructionProjects(list.filter(pr => pr.status !== 'completed' && pr.status !== 'cancelled'));
      })
      .catch(() => setConstructionProjects([]));
  }, []);

  // Print preview (shared jsPDF template — same pattern as vendor bills)
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Pre-fill default tax from settings
  useEffect(() => {
    if (defaultTaxPercent > 0 && newPO.tax_percent === 0) {
      setNewPO(prev => ({ ...prev, tax_percent: defaultTaxPercent, tax_rate_id: defaultPurchaseTax?.id || '' }));
    }
  }, [defaultTaxPercent]);

  // Fetch products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await inventoryService.listProducts({ limit: 1000 });
        setProducts(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();

    const fetchWarehouses = async () => {
      try {
        const data = await inventoryService.listWarehouses();
        const list = Array.isArray(data) ? data : data?.items || [];
        setWarehouses(list);
        if (list.length === 1) {
          setNewPO(prev => ({ ...prev, warehouse_id: list[0].id }));
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  // Fetch purchase returns
  useEffect(() => {
    const fetchReturns = async () => {
      try {
        const returns = await procurementService.listReturns();
        setPurchaseReturns(Array.isArray(returns) ? returns : []);
      } catch (error) {
        console.error('Failed to fetch purchase returns:', error);
      }
    };
    fetchReturns();
  }, []);

  // Fetch purchase invoices (vendor bills) to check which POs have bills
  useEffect(() => {
    const fetchBills = async () => {
      try {
        const bills = await financeService.listPurchaseInvoices({ page_size: 100 });
        const billList = Array.isArray(bills) ? bills : bills?.data || bills?.items || [];
        const map = {};
        billList.forEach(bill => {
          if (bill.purchase_order_id && bill.status !== 'cancelled') {
            map[bill.purchase_order_id] = true;
          }
        });
        setPoBillMap(map);
      } catch (error) {
        console.error('Failed to fetch purchase invoices:', error);
      }
    };
    fetchBills();
  }, []);

  // Check if an order already has a vendor bill
  const poHasBill = useCallback((poId) => {
    return !!poBillMap[poId];
  }, [poBillMap]);

  // Check if an order has returns
  const orderHasReturns = useCallback((poId) => {
    return purchaseReturns.some(r => r.purchase_order_id === poId);
  }, [purchaseReturns]);

  // Get returns for a specific order
  const getOrderReturns = useCallback((poId) => {
    return purchaseReturns.filter(r => r.purchase_order_id === poId);
  }, [purchaseReturns]);

  // Calculate delivery date based on product lead times
  const calculateDeliveryDate = useCallback((orderLines, orderDate) => {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const maxLeadTime = orderLines.reduce((max, line) => {
      const leadTime = line.product?.lead_time_days || line.lead_time_days || 0;
      return Math.max(max, leadTime);
    }, 0);

    if (maxLeadTime === 0) {
      return new Date().toISOString().split('T')[0];
    }

    const deliveryDate = new Date(baseDate);
    deliveryDate.setDate(deliveryDate.getDate() + maxLeadTime);
    return deliveryDate.toISOString().split('T')[0];
  }, []);

  // Server-side fetch for purchase orders
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const params = { page: currentPage, limit: pageSize };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await apiClient.get('/purchase-orders', { params });
      const rawData = response.data?.data || [];
      const meta = response.data?.meta || {};
      // Map backend fields to frontend format (same as ProcurementContext)
      const data = rawData.map(po => ({
        ...po,
        po_number: po.order_number || po.po_number,
        supplier_name: po.vendor_name || po.supplier_name,
      }));
      setPaginatedOrders(data);
      setTotalOrders(meta.total || data.length);
      setTotalPages(meta.total_pages || Math.ceil((meta.total || data.length) / pageSize));
    } catch (e) {
      console.error('Failed to load purchase orders', e);
      setPaginatedOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  // Sync filteredOrders from server-paginated data
  useEffect(() => {
    setFilteredOrders(paginatedOrders);
  }, [paginatedOrders]);

  // Calculate order total from line items
  const calculateOrderTotal = (lines) => {
    return lines.reduce((sum, line) => {
      const lineTotal = parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0);
      const deliveryTotal = line.has_delivery ? (parseFloat(line.quantity || 0) * parseFloat(line.delivery_price || 0)) : 0;
      return sum + lineTotal + deliveryTotal;
    }, 0);
  };

  const calculateDeliveryTotal = (lines) => {
    return lines.reduce((sum, line) => {
      if (!line.has_delivery) return sum;
      return sum + (parseFloat(line.quantity || 0) * parseFloat(line.delivery_price || 0));
    }, 0);
  };

  // Calculate tax considering price_include flag
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

  // Handle line item changes
  const handleAddLine = () => {
    const newLines = [...newPO.lines, { product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }];
    setNewPO({ ...newPO, lines: newLines });
  };

  const handleRemoveLine = (index) => {
    const newLines = newPO.lines.filter((_, i) => i !== index);
    const updatedLines = newLines.length > 0 ? newLines : [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }];

    if (!isDeliveryDateManual) {
      const newDeliveryDate = calculateDeliveryDate(updatedLines, newPO.order_date);
      setNewPO({ ...newPO, lines: updatedLines, expected_delivery_date: newDeliveryDate, total_amount: calculateOrderTotal(updatedLines) });
    } else {
      setNewPO({ ...newPO, lines: updatedLines, total_amount: calculateOrderTotal(updatedLines) });
    }
  };

  // Scan a receipt/check image and add matched products to order lines
  const handleScanReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-uploaded if needed
    e.target.value = '';

    setIsScanningReceipt(true);
    setUnmatchedProducts([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/purchase-orders/scan-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { matched = [], unmatched = [] } = res.data?.data || res.data || {};

      if (matched.length > 0) {
        // Build new lines from matched products, appended to existing non-empty lines
        const existingLines = newPO.lines.filter(l => l.product_id || l.product_name);
        const scannedLines = matched.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          lead_time_days: 0,
        }));
        const mergedLines = existingLines.length > 0
          ? [...existingLines, ...scannedLines]
          : scannedLines;
        setNewPO(prev => ({
          ...prev,
          lines: mergedLines,
          total_amount: calculateOrderTotal(mergedLines),
        }));
        toast({
          title: t('receipt_scanned') || 'Check skanerlandi',
          description: `${matched.length} ta mahsulot qo'shildi`,
        });
      } else {
        toast({
          title: t('no_products_found') || 'Mahsulot topilmadi',
          description: t('no_matching_products') || 'Checkdagi mahsulotlar katalogda topilmadi',
          variant: 'destructive',
        });
      }

      if (unmatched.length > 0) {
        setUnmatchedProducts(unmatched);
      }
    } catch (err) {
      toast({
        title: t('error') || 'Xato',
        description: err.response?.data?.message || err.message || 'Check skanerlanmadi',
        variant: 'destructive',
      });
    } finally {
      setIsScanningReceipt(false);
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

  // Fetch packagings for a product
  const fetchProductPackagings = useCallback(async (productId) => {
    if (!productId || productPackagings[productId]) return;
    try {
      const response = await apiClient.get(`/products/${productId}/packagings`);
      const packagings = (response.data?.data || []).filter(p => p.purchase !== false);
      setProductPackagings(prev => ({ ...prev, [productId]: packagings }));
    } catch (error) {
      console.error('Failed to fetch packagings:', error);
    }
  }, [productPackagings]);

  // Lookup vendor price for a product
  const lookupVendorPriceForProduct = useCallback(async (vendorId, productId) => {
    if (!vendorId || !productId) return null;
    try {
      const vendorPrice = await procurementService.lookupVendorPrice(vendorId, productId);
      return vendorPrice;
    } catch (error) {
      console.error('Failed to lookup vendor price:', error);
      return null;
    }
  }, []);

  const handleLineChange = async (index, field, value, productObj = null) => {
    const newLines = [...newPO.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // "Jami" lot-entry mode (goods bought as a lot — total known, per-unit price
    // unknown). Clicking the total clears Narx and opens a free-typing draft;
    // the = button (or leaving the field) derives unit_price = total / quantity
    // so it flows into inventory cost on receipt. Empty → the price is restored.
    if (field === 'jami_focus') {
      newLines[index] = { ...newLines[index], _prevNarx: newLines[index].unit_price, unit_price: '', jami_draft: '' };
      setNewPO({ ...newPO, lines: newLines, total_amount: calculateOrderTotal(newLines) });
      return;
    }
    if (field === 'jami_calc') {
      const ln = newLines[index];
      if (ln.jami_draft === undefined) return; // already committed
      const qty = parseFloat(ln.quantity || 0);
      const total = parseFloat(parsePriceInput(String(ln.jami_draft || '')) || 0);
      const up = (total > 0 && qty > 0) ? total / qty : (ln._prevNarx ?? 0);
      const { jami_draft, _prevNarx, jami_calc, ...rest } = ln;
      newLines[index] = { ...rest, unit_price: up };
      setNewPO({ ...newPO, lines: newLines, total_amount: calculateOrderTotal(newLines) });
      return;
    }

    if (field === 'product_id' && value) {
      // `productObj` fallback: a just-created product isn't in `products` yet
      // (setProducts is async), so use the passed object to populate price/name.
      const selectedProduct = products.find(p => p.id === value) || productObj;
      if (selectedProduct) {
        // Default to product's purchase price
        let unitPrice = selectedProduct.purchase_price || selectedProduct.cost_price || selectedProduct.price || 0;
        let leadTimeDays = selectedProduct.lead_time_days || 0;

        // Try to lookup vendor price if supplier is selected
        if (newPO.supplier_id) {
          const vendorPrice = await lookupVendorPriceForProduct(newPO.supplier_id, value);
          if (vendorPrice) {
            unitPrice = vendorPrice.price;
            leadTimeDays = vendorPrice.lead_time_days || leadTimeDays;
          }
        }

        // Auto-set UOM: prefer purchase_unit, fallback to default unit
        const unitId = selectedProduct.purchase_unit_id || selectedProduct.unit_id || null;
        const unitName = selectedProduct.purchase_unit_name || selectedProduct.unit_name || '';

        newLines[index] = {
          ...newLines[index],
          product_name: selectedProduct.name,
          product_id: selectedProduct.id,
          unit_price: unitPrice,
          lead_time_days: leadTimeDays,
          unit_id: unitId,
          unit_name: unitName,
          product: selectedProduct,
          has_delivery: selectedProduct.has_delivery || false,
          delivery_price: parseFloat(selectedProduct.delivery_price) || 0,
          variant_id: null,
          variant_name: null,
          packaging_id: null,
          packaging_qty: null,
          packaging_name: null,
          packaging_unit_qty: null
        };

        if (selectedProduct.has_variants) {
          fetchProductVariants(selectedProduct.id);
        }
        fetchProductPackagings(selectedProduct.id);

        if (!isDeliveryDateManual) {
          const newDeliveryDate = calculateDeliveryDate(newLines, newPO.order_date);
          setNewPO({ ...newPO, lines: newLines, expected_delivery_date: newDeliveryDate, total_amount: calculateOrderTotal(newLines) });
          return;
        }
      }
    }

    if (field === 'variant_id' && value) {
      const productId = newLines[index].product_id;
      const variants = productVariants[productId] || [];
      const selectedVariant = variants.find(v => v.id === value);
      if (selectedVariant) {
        newLines[index] = {
          ...newLines[index],
          variant_id: selectedVariant.id,
          variant_name: selectedVariant.variant_name,
          unit_price: selectedVariant.cost_price || newLines[index].unit_price
        };
      }
    }

    if (field === 'packaging_id') {
      const productId = newLines[index].product_id;
      if (value && value !== 'none') {
        const packagings = productPackagings[productId] || [];
        const selectedPackaging = packagings.find(p => p.id === value);
        if (selectedPackaging) {
          const packagingQty = newLines[index].packaging_qty || 1;
          newLines[index] = {
            ...newLines[index],
            packaging_id: selectedPackaging.id,
            packaging_name: selectedPackaging.name,
            packaging_unit_qty: selectedPackaging.qty,
            packaging_qty: packagingQty,
            quantity: packagingQty * selectedPackaging.qty
          };
        }
      } else {
        newLines[index] = {
          ...newLines[index],
          packaging_id: null,
          packaging_name: null,
          packaging_unit_qty: null,
          packaging_qty: null
        };
      }
    }

    if (field === 'packaging_qty' && newLines[index].packaging_id) {
      const packagingQty = parseFloat(value) || 1;
      const packagingUnitQty = newLines[index].packaging_unit_qty || 1;
      newLines[index] = {
        ...newLines[index],
        packaging_qty: packagingQty,
        quantity: packagingQty * packagingUnitQty
      };
    }

    setNewPO({ ...newPO, lines: newLines, total_amount: calculateOrderTotal(newLines) });
  };

  const handleCreatePO = async () => {
    if (!newPO.supplier_id && !newPO.vendor_name) return;

    setIsSubmitting(true);
    try {
      const supplier = getSupplierById(newPO.supplier_id);
      const rawSubtotal = calculateOrderTotal(newPO.lines);
      const taxPercent = parseFloat(newPO.tax_percent) || 0;
      const selectedTax = newPO.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newPO.tax_rate_id)) : defaultPurchaseTax;
      const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
      const subtotal = taxCalc.subtotal;
      const taxAmount = taxCalc.taxAmount;
      const totalAmount = subtotal + taxAmount;
      const poData = {
        ...newPO,
        po_number: '',
        vendor_name: supplier?.name || newPO.vendor_name,
        subtotal: subtotal,
        total_amount: totalAmount,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        status: 'draft',
        ai_price_validation: true
      };

      await createPurchaseOrder(poData);
      fetchOrders();
      setShowCreateModal(false);

      setNewPO({
        po_number: '',
        supplier_id: '',
        vendor_name: '',
        warehouse_id: warehouses.length === 1 ? warehouses[0].id : '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        tax_percent: defaultTaxPercent,
        shipping_cost: 0,
        payment_terms: 'net_30',
        vehicle_number: '',
        requires_shipping: true,
        lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
      });
      setIsDeliveryDateManual(false);
      setUnmatchedProducts([]);
    } catch (error) {
      console.error('Error creating PO:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enrich PO lines with `alt_name` = counterparty (seller) product's
  // name, matched via search_key. Mirrors the same-named helper on
  // the Sales Orders page so both sides of an intercompany flow see
  // both the buyer's and the seller's name when printing.
  const enrichLinesWithAltNames = async (lines) => {
    if (!Array.isArray(lines) || lines.length === 0) return lines;
    const keyByLine = new Map();
    for (const line of lines) {
      const prod = products.find(p => p.id === line.product_id);
      const key = prod?.search_key;
      if (key) keyByLine.set(line, key);
    }
    const uniqueKeys = [...new Set(keyByLine.values())];
    if (uniqueKeys.length === 0) return lines;

    const keyToMatches = new Map();
    await Promise.all(uniqueKeys.map(async (k) => {
      try {
        const res = await apiClient.get('/products/by-search-key', {
          params: {
            key: k,
            ...(activeCompany?.id ? { exclude_organization_id: activeCompany.id } : {}),
          },
        });
        const list = res.data?.data?.products ?? res.data?.products ?? [];
        keyToMatches.set(k, list);
      } catch { /* ignore */ }
    }));

    return lines.map(line => {
      const key = keyByLine.get(line);
      if (!key) return line;
      const matches = keyToMatches.get(key) || [];
      const alt = matches.find(m => m.id !== line.product_id && m.name);
      return alt ? { ...line, alt_name: alt.name } : line;
    });
  };

  const handleViewPO = async (po, e) => {
    e.stopPropagation();
    setIsLoadingDetails(true);
    setDetailPO(po);
    setShowDetailModal(true);

    try {
      const fullOrder = await procurementService.getOrder(po.id);
      setDetailPO(fullOrder);
      const enrichedLines = await enrichLinesWithAltNames(fullOrder.lines || []);
      setDetailPOLines(enrichedLines);

      const basicReturns = getOrderReturns(po.id);
      if (basicReturns.length > 0) {
        const detailedReturns = await Promise.all(
          basicReturns.map(async (ret) => {
            try {
              const fullReturn = await procurementService.getReturn(ret.id);
              return fullReturn;
            } catch {
              return ret;
            }
          })
        );
        setOrderReturns(detailedReturns);
      } else {
        setOrderReturns([]);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      setDetailPOLines([]);
      setOrderReturns([]);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleEditPO = async (po, e) => {
    e.stopPropagation();
    // Optimistic open with header info; fetch full PO + lines async so
    // the modal renders immediately and lines populate when ready.
    setEditPO({
      ...po,
      po_number: po.po_number || po.order_number,
      supplier_id: po.vendor_id || po.supplier_id || '',
      supplier_name: po.supplier_name || po.vendor_name,
      warehouse_id: po.warehouse_id || '',
      vehicle_number: po.vehicle_number || '',
      requires_shipping: po.requires_shipping !== false,
      tax_percent: po.tax_percent || 0,
      tax_rate_id: po.tax_rate_id || '',
      payment_terms: po.payment_terms || 'net_30',
      total_amount: po.total_amount || 0,
      expected_delivery_date: po.expected_delivery_date || po.expected_date || '',
      order_date: po.order_date ? (typeof po.order_date === 'string' ? po.order_date.split('T')[0] : po.order_date) : '',
      lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }],
      _linesLoading: true,
      // Snapshot the status as it came from the server so the save
      // handler can tell whether the user actually changed it. Some
      // statuses ('received', 'partial') are only writable via
      // dedicated endpoints — sending them through the generic PUT
      // is rejected by the backend, so we skip the status field
      // entirely when it hasn't changed.
      _originalStatus: po.status || '',
    });
    setShowEditModal(true);

    try {
      const fullOrder = await procurementService.getOrder(po.id);
      const lines = (fullOrder.lines || []).map(l => ({
        id: l.id,
        product_id: l.product_id || '',
        product_name: l.product_name || l.description || '',
        variant_id: l.variant_id || '',
        quantity: l.quantity || 1,
        unit_price: l.unit_price || 0,
        unit_name: l.unit_name || '',
        lead_time_days: l.lead_time_days || 0,
        packaging_id: l.packaging_id || null,
        packaging_qty: l.packaging_qty || 1,
        has_delivery: l.has_delivery || false,
        delivery_price: l.delivery_price || 0,
      }));
      // Derive tax_percent from the absolute tax/subtotal returned by
      // the API. The backend stores tax_percent per-line, not on the
      // header, so the GET response carries `tax_amount` and
      // `subtotal` but no `tax_percent` field. Without this derivation
      // the edit modal opens with Soliq=0 even when the PO has tax,
      // and saving wipes the line tax to zero.
      const apiSubtotal = parseFloat(fullOrder.subtotal) || 0;
      const apiTaxAmount = parseFloat(fullOrder.tax_amount) || 0;
      const derivedTaxPercent = apiSubtotal > 0
        ? Math.round((apiTaxAmount / apiSubtotal) * 10000) / 100  // 2dp
        : 0;
      // Pull tax_id off the first line if any — the API doesn't expose
      // a header-level tax_rate_id, but lines all share the same rate
      // in the create flow, so we sample the first one.
      const firstLineTaxID =
        (fullOrder.lines || []).find(l => l.tax_id)?.tax_id || '';

      setEditPO(prev => prev ? {
        ...prev,
        ...fullOrder,
        po_number: fullOrder.po_number || fullOrder.order_number || prev.po_number,
        supplier_id: fullOrder.vendor_id || fullOrder.supplier_id || prev.supplier_id,
        supplier_name: fullOrder.supplier_name || fullOrder.vendor_name || prev.supplier_name,
        warehouse_id: fullOrder.warehouse_id || prev.warehouse_id,
        vehicle_number: fullOrder.vehicle_number || prev.vehicle_number,
        requires_shipping: fullOrder.requires_shipping !== false,
        tax_percent: fullOrder.tax_percent || derivedTaxPercent || prev.tax_percent || 0,
        tax_rate_id: fullOrder.tax_rate_id || firstLineTaxID || prev.tax_rate_id || '',
        payment_terms: fullOrder.payment_terms || prev.payment_terms,
        order_date: fullOrder.order_date
          ? (typeof fullOrder.order_date === 'string' ? fullOrder.order_date.split('T')[0] : fullOrder.order_date)
          : prev.order_date,
        expected_delivery_date: fullOrder.expected_delivery_date || fullOrder.expected_date || prev.expected_delivery_date,
        lines: lines.length > 0 ? lines : prev.lines,
        _linesLoading: false,
        // Refresh the snapshot from the authoritative server response
        // (the list view's status can be stale; getOrder is canonical).
        _originalStatus: fullOrder.status || prev._originalStatus || '',
        // Snapshot the original lines so the save handler can detect
        // whether the user actually changed anything. Without this,
        // every save sends the lines payload and the backend's
        // billed/received guards block edits even when the user only
        // touched header fields like vehicle number.
        _originalLines: lines.length > 0 ? JSON.stringify(lines.map(l => ({
          id: l.id, product_id: l.product_id, quantity: l.quantity,
          unit_price: l.unit_price, packaging_id: l.packaging_id, packaging_qty: l.packaging_qty,
        }))) : '',
      } : prev);
    } catch (err) {
      console.warn('Failed to load PO details for edit:', err);
      setEditPO(prev => prev ? { ...prev, _linesLoading: false } : prev);
    }
  };

  // Line ops on editPO mirror the create-modal helpers (handleAddLine,
  // handleRemoveLine, handleLineChange) but operate on editPO.lines.
  // Kept separate so the create flow's behavior is untouched.
  const handleEditAddLine = () => {
    if (!editPO) return;
    setEditPO({
      ...editPO,
      lines: [...editPO.lines, { product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }],
    });
  };

  const handleEditRemoveLine = (index) => {
    if (!editPO || editPO.lines.length === 1) return;
    const newLines = editPO.lines.filter((_, i) => i !== index);
    setEditPO({
      ...editPO,
      lines: newLines,
      total_amount: calculateOrderTotal(newLines),
    });
  };

  const handleEditLineChange = async (index, field, value, productObj = null) => {
    if (!editPO) return;
    const newLines = [...editPO.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    // "Jami" lot-entry mode → clear Narx on focus, type the total, then derive
    // unit_price = total / quantity on = / blur (restore price if left empty).
    if (field === 'jami_focus') {
      newLines[index] = { ...newLines[index], _prevNarx: newLines[index].unit_price, unit_price: '', jami_draft: '' };
      setEditPO({ ...editPO, lines: newLines, total_amount: calculateOrderTotal(newLines) });
      return;
    }
    if (field === 'jami_calc') {
      const ln = newLines[index];
      if (ln.jami_draft === undefined) return;
      const qty = parseFloat(ln.quantity || 0);
      const total = parseFloat(parsePriceInput(String(ln.jami_draft || '')) || 0);
      const up = (total > 0 && qty > 0) ? total / qty : (ln._prevNarx ?? 0);
      const { jami_draft, _prevNarx, jami_calc, ...rest } = ln;
      newLines[index] = { ...rest, unit_price: up };
      setEditPO({ ...editPO, lines: newLines, total_amount: calculateOrderTotal(newLines) });
      return;
    }
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value) || productObj;
      if (product) {
        let unitPrice = product.purchase_price || product.cost_price || product.list_price || 0;
        let leadTimeDays = product.lead_time_days || 0;
        if (editPO.supplier_id) {
          const vp = await lookupVendorPriceForProduct(editPO.supplier_id, value);
          if (vp) {
            unitPrice = vp.price;
            leadTimeDays = vp.lead_time_days || leadTimeDays;
          }
        }
        newLines[index] = {
          ...newLines[index],
          product_name: product.name,
          unit_id: product.purchase_unit_id || product.unit_id || null,
          unit_name: product.purchase_unit_name || product.unit_name || '',
          unit_price: unitPrice,
          lead_time_days: leadTimeDays,
          has_delivery: product.has_delivery || false,
          delivery_price: parseFloat(product.delivery_price) || 0,
        };
      }
    }
    setEditPO({
      ...editPO,
      lines: newLines,
      total_amount: calculateOrderTotal(newLines),
    });
  };

  const handleUpdatePO = async () => {
    if (!editPO) return;

    setIsSubmitting(true);
    try {
      // Build the full update payload — backend's UpdatePurchaseOrderInput
      // accepts every field below as optional pointers, so missing ones
      // are left untouched. We send everything the user could have
      // changed; server-side audit log captures the diff.
      const updates = {};

      if (editPO.supplier_id) updates.vendor_id = editPO.supplier_id;
      if (editPO.warehouse_id !== undefined) updates.warehouse_id = editPO.warehouse_id || null;
      if (editPO.expected_delivery_date) updates.expected_date = editPO.expected_delivery_date;
      if (editPO.payment_terms) updates.payment_terms = editPO.payment_terms;
      if (editPO.vehicle_number !== undefined) updates.vehicle_number = editPO.vehicle_number || '';
      if (editPO.requires_shipping !== undefined) updates.requires_shipping = !!editPO.requires_shipping;
      // Status is only sent if the user explicitly changed it, AND the
      // new status is one the generic PUT accepts. 'received' and
      // 'partial' must go through the dedicated /receive endpoint —
      // the backend's UpdatePurchaseOrder rejects them with:
      //   "Status 'received' cannot be set via generic update."
      // Without this guard, every save on a received PO 500s because
      // the form preserves the existing 'received' value as-is.
      // 'cancelled' goes through POST /:id/cancel (state-machine guard +
      // stock check) — the PO is cancelled, NOT deleted, so its history stays.
      const STATUS_BLOCKED_VIA_GENERIC = new Set(['received', 'partial', 'cancelled']);
      if (
        editPO.status &&
        editPO.status !== editPO._originalStatus &&
        !STATUS_BLOCKED_VIA_GENERIC.has(editPO.status)
      ) {
        updates.status = editPO.status;
      }
      if (editPO.notes !== undefined) updates.notes = editPO.notes;
      if (editPO.vendor_reference !== undefined) updates.vendor_reference = editPO.vendor_reference;

      // Lines — only send if we actually loaded them, the user has
      // at least one valid product line, AND the lines actually
      // changed compared to what was loaded. The diff check matters
      // because the backend rejects line replacement on POs that
      // have already been billed/received; if the user only edited
      // the vehicle number we don't want to trip that guard.
      if (Array.isArray(editPO.lines) && editPO.lines.some(l => l.product_id)) {
        const headerTaxPercent = parseFloat(editPO.tax_percent) || 0;
        const currentLinesSnapshot = JSON.stringify(editPO.lines.map(l => ({
          id: l.id, product_id: l.product_id, quantity: l.quantity,
          unit_price: l.unit_price, packaging_id: l.packaging_id, packaging_qty: l.packaging_qty,
        })));
        const linesChanged = currentLinesSnapshot !== (editPO._originalLines || '');

        if (linesChanged) {
          updates.lines = editPO.lines
            .filter(l => l.product_id && parseFloat(l.quantity) > 0)
            .map(l => ({
              product_id: l.product_id,
              variant_id: l.variant_id || undefined,
              quantity: parseFloat(l.quantity) || 0,
              unit_price: parseFloat(l.unit_price) || 0,
              description: l.product_name || l.description || '',
              tax_percent: headerTaxPercent,
              tax_id: editPO.tax_rate_id || undefined,
              packaging_id: l.packaging_id || undefined,
              packaging_qty: l.packaging_id ? (parseFloat(l.packaging_qty) || 1) : undefined,
            }));
        }
      }

      if (Object.keys(updates).length > 0) {
        await updatePurchaseOrder(editPO.id, updates);
      }
      if (editPO.status === 'cancelled' && editPO._originalStatus !== 'cancelled') {
        await procurementService.cancelOrder(editPO.id);
      }
      setShowEditModal(false);
      setEditPO(null);
      await refreshData();
    } catch (error) {
      console.error('Error updating PO:', error);
      // Run through formatApiError so structured backend error codes
      // (PO_LINES_LOCKED_BILLED, etc.) get rendered in the user's
      // current language via apiErrors.js's catalog. Falls back to
      // the backend's English message if no translation exists yet.
      const apiMessage = formatApiError(
        error,
        t,
        t('failed_to_save') || 'Failed to save'
      );
      toast({
        variant: 'destructive',
        title: t('error') || 'Error',
        description: apiMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePOStatus = async (poId, newStatus) => {
    if (newStatus === 'cancelled') {
      await procurementService.cancelOrder(poId);
    } else {
      await updatePurchaseOrder(poId, { status: newStatus });
    }
    fetchOrders();
  };

  const handleCreateBill = async (poId) => {
    try {
      const result = await procurementService.createBillFromPO(poId);
      setPoBillMap(prev => ({ ...prev, [poId]: true }));
      toast({
        title: t('bill_created_successfully') || 'Vendor bill created successfully',
        description: result?.invoice_number ? `#${result.invoice_number}` : undefined,
      });
      setSearchParams({ tab: 'suppliers', subtab: 'bills' }, { replace: true });
    } catch (error) {
      console.error('Failed to create bill:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to create vendor bill';
      toast({
        title: msg,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-purple-100 text-purple-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Orders and Returns */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-fit bg-slate-100/80 p-1 rounded-lg">
          <TabsTrigger value="orders" className="data-[state=active]:bg-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            {t('orders') || 'Orders'}
          </TabsTrigger>
          <TabsTrigger value="receipts" className="data-[state=active]:bg-white">
            <Package className="w-4 h-4 mr-2" />
            {t('receiving') || 'Qabul qilish'}
          </TabsTrigger>
          <TabsTrigger value="requisitions" className="data-[state=active]:bg-white">
            <FileText className="w-4 h-4 mr-2" />
            {t('pr_title') || "So'rovlar"}
          </TabsTrigger>
          <TabsTrigger value="blanket-orders" className="data-[state=active]:bg-white">
            <Layers className="w-4 h-4 mr-2" />
            {t('blanket_orders') || 'Blanket Orders'}
          </TabsTrigger>
          <TabsTrigger value="returns" className="data-[state=active]:bg-white">
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('returns') || 'Returns'}
          </TabsTrigger>
          <TabsTrigger value="landed-costs" className="data-[state=active]:bg-white">
            <DollarSign className="w-4 h-4 mr-2" />
            {t('landed_costs') || 'Landed Costs'}
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{t('purchase_orders') || 'Purchase Orders'}</CardTitle>
                {canCreate(MODULES.PURCHASES) && (
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" /> {t('new_po') || 'New PO'}
                  </Button>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search') || 'Search...'}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                    <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                    <SelectItem value="sent">{t('sent') || 'Sent'}</SelectItem>
                    <SelectItem value="confirmed">{t('confirmed') || 'Confirmed'}</SelectItem>
                    <SelectItem value="received">{t('received') || 'Received'}</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 whitespace-nowrap">
                      <SlidersHorizontal className="w-4 h-4" />
                      {t('columns') || 'Columns'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56">
                    <p className="text-xs font-semibold text-slate-500 mb-2">{t('visible_columns') || 'Visible columns'}</p>
                    <div className="space-y-2">
                      {PO_COLS.map(c => (
                        <label key={c.key} className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                          <span>{c.label}</span>
                          <Switch checked={colOn(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(isLoading || ordersLoading) ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('orders_not_found') || 'Orders not found'}</p>
                  {canCreate(MODULES.PURCHASES) && (
                    <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('create_first_po') || 'Create First PO'}</Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        {colOn('po_number') && <TableHead>{t('po_number') || 'PO #'}</TableHead>}
                        {colOn('supplier') && <TableHead>{t('supplier') || 'Supplier'}</TableHead>}
                        {colOn('order_date') && <TableHead>{t('order_date') || 'Order Date'}</TableHead>}
                        {colOn('delivery_date') && <TableHead>{t('delivery_date') || 'Delivery Date'}</TableHead>}
                        {colOn('quantity') && <TableHead className="text-right">{t('quantity') || 'Quantity'}</TableHead>}
                        {colOn('amount') && <TableHead>{t('amount') || 'Amount'}</TableHead>}
                        {colOn('payment_status') && <TableHead>{t('payment_status') || 'Payment'}</TableHead>}
                        {colOn('status') && <TableHead>{t('status') || 'Status'}</TableHead>}
                        <TableHead>{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((po) => (
                        <TableRow key={po.id} className="hover:bg-slate-50">
                          {colOn('po_number') && (
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-2">
                                {po.po_number}
                                {orderHasReturns(po.id) && (
                                  <MessageSquareWarning className="w-4 h-4 text-red-500" title={t('has_returns') || 'Has Returns'} />
                                )}
                              </div>
                            </TableCell>
                          )}
                          {colOn('supplier') && <TableCell className="font-medium">{po.supplier_name || po.vendor_name}</TableCell>}
                          {colOn('order_date') && (
                            <TableCell className="text-sm">
                              {po.order_date ? format(new Date(po.order_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                          )}
                          {colOn('delivery_date') && (
                            <TableCell className="text-sm">
                              {(po.expected_delivery_date || po.expected_date) ? format(new Date(po.expected_delivery_date || po.expected_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                          )}
                          {colOn('quantity') && (
                            <TableCell className="text-right text-sm">
                              {po.total_quantity != null ? Number(po.total_quantity).toLocaleString() : '-'}
                            </TableCell>
                          )}
                          {colOn('amount') && <TableCell className="font-semibold">{formatCurrency(po.total_amount || 0)}</TableCell>}
                          {colOn('payment_status') && (
                            <TableCell>
                              <Badge className={`${paymentStatusColor(po.payment_status)} capitalize`}>{paymentStatusLabel(po.payment_status)}</Badge>
                            </TableCell>
                          )}
                          {colOn('status') && (
                            <TableCell>
                              <Badge className={getStatusColor(po.status)}>{t(po.status) || po.status}</Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={(e) => handleViewPO(po, e)} title={t('view_details') || 'View Details'}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canUpdate(MODULES.PURCHASES) && (po.status === 'draft' || po.status === 'cancelled') && (
                                <Button size="sm" variant="ghost" onClick={(e) => handleEditPO(po, e)} title={t('edit') || 'Edit'}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {canUpdate(MODULES.PURCHASES) && po.status === 'draft' && (
                                <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'sent')}>
                                  {t('send') || 'Send'}
                                </Button>
                              )}
                              {canUpdate(MODULES.PURCHASES) && (po.status === 'sent' || po.status === 'ordered') && (
                                <Button size="sm" variant="ghost" onClick={async () => {
                                  try {
                                    await approvePurchaseOrder(po.id);
                                    fetchOrders();
                                  } catch (err) {
                                    const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || '';
                                    if (msg.includes('NO_RECEIPT_WAREHOUSE')) {
                                      toast({ title: t('no_receipt_warehouse'), variant: 'destructive' });
                                    } else {
                                      toast({ title: msg || t('error'), variant: 'destructive' });
                                    }
                                  }
                                }}>
                                  {t('confirm') || 'Confirm'}
                                </Button>
                              )}
                              {['confirmed', 'received', 'partial'].includes(po.status) && !poHasBill(po.id) && (
                                <Button size="sm" variant="ghost" onClick={() => handleCreateBill(po.id)} title={t('create_bill') || 'Create Bill'}>
                                  <Receipt className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                              {canUpdate(MODULES.PURCHASES) && (po.status === 'draft' || po.status === 'cancelled') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteConfirm(po)}
                                  title={t('delete') || 'Delete'}
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
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <span className="text-sm text-slate-600">
                        {t('showing') || 'Showing'} {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalOrders)} {t('of') || 'of'} {totalOrders}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blanket Orders Tab */}
        <TabsContent value="blanket-orders" className="mt-4">
          <BlanketOrders />
        </TabsContent>

        {/* Receiving Tab — GR documents live WITH the orders they receive
            (Tovar qabulxonasi is no longer a separate top-level destination) */}
        <TabsContent value="receipts" className="mt-4">
          <GoodsReceipt />
        </TabsContent>

        {/* Requisitions Tab — zayavkalardan/MRPdan kelgan ichki so'rovlar */}
        <TabsContent value="requisitions" className="mt-4">
          <PurchaseRequisitions />
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="mt-4">
          <PurchaseReturns />
        </TabsContent>

        {/* Landed Costs Tab */}
        <TabsContent value="landed-costs" className="mt-4">
          <LandedCosts />
        </TabsContent>
      </Tabs>

      {/* Create PO Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) {
          setIsDeliveryDateManual(false);
          setNewPO({
            po_number: '',
            supplier_id: '',
            vendor_name: '',
            warehouse_id: warehouses.length === 1 ? warehouses[0].id : '',
            order_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: new Date().toISOString().split('T')[0],
            total_amount: 0,
            tax_percent: defaultTaxPercent || 0,
            shipping_cost: 0,
            payment_terms: 'net_30',
            vehicle_number: '',
            requires_shipping: true,
            lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
          });
        }
      }}>
        {/* Prevent accidental dismissal via outside-click or Escape so
            users don't lose half-filled forms. Closing requires the X
            button or Cancel button. */}
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('new_purchase_order') || 'New Purchase Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 min-w-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('supplier') || 'Supplier'} *</label>
                <Select
                  value={newPO.supplier_id}
                  onValueChange={async (value) => {
                    const supplier = suppliers.find(s => s.id === value);

                    // Update prices for existing lines based on new supplier
                    const updatedLines = await Promise.all(
                      newPO.lines.map(async (line) => {
                        if (line.product_id && value) {
                          const vendorPrice = await lookupVendorPriceForProduct(value, line.product_id);
                          if (vendorPrice) {
                            return {
                              ...line,
                              unit_price: vendorPrice.price,
                              lead_time_days: vendorPrice.lead_time_days || line.lead_time_days
                            };
                          }
                        }
                        return line;
                      })
                    );

                    const newDeliveryDate = !isDeliveryDateManual
                      ? calculateDeliveryDate(updatedLines, newPO.order_date)
                      : newPO.expected_delivery_date;

                    setNewPO({
                      ...newPO,
                      supplier_id: value,
                      vendor_name: supplier?.name || '',
                      lines: updatedLines,
                      expected_delivery_date: newDeliveryDate,
                      total_amount: calculateOrderTotal(updatedLines)
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_supplier') || 'Select supplier'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.is_active !== false && s.status !== 'inactive').map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('warehouse') || 'Warehouse'}</label>
                {warehouses.length === 1 ? (
                  <Input value={warehouses[0].name} disabled className="bg-slate-50" />
                ) : (
                  <Select
                    value={newPO.warehouse_id || '__none__'}
                    onValueChange={(value) => setNewPO({...newPO, warehouse_id: value === '__none__' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('auto_select') || 'Auto select'}</SelectItem>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Obyekt (optional): received lines feed the object's actual cost */}
            {constructionProjects.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">{t('construction_object') || 'Qurilish obyekti'} <span className="text-xs text-slate-400">({t('optional') || 'ixtiyoriy'})</span></label>
                <Select
                  value={newPO.construction_project_id ? String(newPO.construction_project_id) : '__none__'}
                  onValueChange={(value) => setNewPO({...newPO, construction_project_id: value === '__none__' ? '' : value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_object') || 'Obyekt tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('no_object') || 'Obyektsiz'}</SelectItem>
                    {constructionProjects.map((pr) => (
                      <SelectItem key={pr.id} value={String(pr.id)}>
                        {pr.code ? `${pr.code} — ${pr.name}` : pr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('order_date') || 'Order Date'} *</label>
                <Input
                  type="date"
                  value={newPO.order_date}
                  onChange={(e) => setNewPO({...newPO, order_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('delivery_date') || 'Delivery Date'} {!isDeliveryDateManual && <span className="text-xs text-slate-500">({t('auto_calculated') || 'Auto'})</span>}</label>
                <Input
                  type="date"
                  value={newPO.expected_delivery_date}
                  onChange={(e) => {
                    setNewPO({...newPO, expected_delivery_date: e.target.value});
                    setIsDeliveryDateManual(true);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('vehicle_number') || 'Vehicle Number'}</label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={newPO.vehicle_number || ''}
                    onChange={(e) => setNewPO({...newPO, vehicle_number: e.target.value})}
                    placeholder="01 A 123 AA"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-3">
                  <Switch
                    id="requires-shipping"
                    checked={newPO.requires_shipping}
                    onCheckedChange={(checked) => setNewPO({...newPO, requires_shipping: checked})}
                  />
                  <label htmlFor="requires-shipping" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                    <Package className="w-4 h-4 text-slate-500" />
                    {t('requires_shipping') || 'Requires Shipping'}
                  </label>
                </div>
              </div>
            </div>

            {/* Order Lines */}
            <div className="border-t pt-4 min-w-0">
              {/* Hidden file input for receipt scan */}
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleScanReceipt}
              />
              <div className="flex justify-between items-center mb-3">
                <label className="text-base font-semibold">{t('order_items') || 'Order Items'}</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={isScanningReceipt}
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    {isScanningReceipt
                      ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      : <ScanLine className="w-4 h-4 mr-1" />}
                    {isScanningReceipt
                      ? (t('scanning') || 'Skanerlanmoqda...')
                      : (t('scan_receipt') || 'Check yuklash')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleAddLine}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_line') || 'Add Line'}
                  </Button>
                </div>
              </div>

              {/* Unmatched products warning */}
              {unmatchedProducts.length > 0 && (
                <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-orange-800">
                        {t('products_not_in_catalog') || 'Quyidagi mahsulotlar bizda yo\'q:'}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {unmatchedProducts.map((name, i) => (
                          <li key={i} className="text-sm text-orange-700 truncate">• {name}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => setUnmatchedProducts([])}
                      className="text-orange-400 hover:text-orange-600 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-2 max-h-60 overflow-y-auto min-w-0">
                {newPO.lines.map((line, index) => {
                  const selectedProduct = products.find(p => p.id === line.product_id);
                  const hasVariants = selectedProduct?.has_variants && productVariants[line.product_id]?.length > 0;
                  const hasPackagings = productPackagings[line.product_id]?.length > 0;
                  return (
                  // min-w-0 chain: row → bg-slate-50 wrapper → space-y div.
                  // For the inner column's `flex-[2] min-w-0` to actually
                  // let the ProductCombobox shrink, every flex/block
                  // ancestor up to the modal must also allow shrinking.
                  // Without this chain, a long product name makes the
                  // column grow regardless of what we set on the
                  // combobox itself.
                  <div key={index} className="bg-slate-50 p-3 rounded space-y-2 min-w-0">
                    <div className="flex gap-2 items-end min-w-0">
                      <div className="flex-[2] min-w-0">
                        {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('product')}</label>}
                        <ProductCombobox
                          products={products}
                          value={line.product_id || ''}
                          onValueChange={(value) => handleLineChange(index, 'product_id', value)}
                          onCreateNew={(name) => setQuickCreate({
                            name,
                            onPick: (product) => handleLineChange(index, 'product_id', product.id, product),
                          })}
                          placeholder={t('select_product') || 'Mahsulot tanlang'}
                          t={t}
                        />
                      </div>
                      {hasVariants && (
                        <div className="flex-[2] min-w-0">
                          {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('variant')}</label>}
                          <Select
                            value={line.variant_id || ''}
                            onValueChange={(value) => handleLineChange(index, 'variant_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('select_variant') || 'Select variant'} />
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
                      <div className="flex-[1] min-w-0">
                        {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('qty')}</label>}
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder={t('qty') || 'Qty'}
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                          />
                          {line.unit_name && (
                            <span className="text-xs text-slate-500 whitespace-nowrap">{line.unit_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-[1.5] min-w-0">
                        {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('price')}</label>}
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={t('price') || 'Price'}
                          value={formatPriceInput(line.unit_price)}
                          onChange={(e) => handleLineChange(index, 'unit_price', parsePriceInput(e.target.value))}
                        />
                      </div>
                      <div className="flex-[1.5] min-w-0">
                        {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('total')}</label>}
                        {/* Editable lot total — click to clear Narx, type the total,
                            then press = (or leave) to derive Narx = Jami ÷ Miqdor. */}
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="text-right font-medium"
                            placeholder={t('total') || 'Total'}
                            value={line.jami_draft !== undefined ? formatPriceInput(line.jami_draft) : formatPriceInput(String((parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)).toFixed(2)))}
                            onFocus={() => { if (line.jami_draft === undefined) handleLineChange(index, 'jami_focus', true); }}
                            onChange={(e) => handleLineChange(index, 'jami_draft', parsePriceInput(e.target.value))}
                            onBlur={() => handleLineChange(index, 'jami_calc', true)}
                          />
                          {line.jami_draft !== undefined && (
                            <Button type="button" size="sm" variant="outline" className="h-9 px-2 shrink-0"
                              title="Narx = Jami / Miqdor" onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleLineChange(index, 'jami_calc', true)}>=</Button>
                          )}
                        </div>
                        {line.has_delivery && line.delivery_price > 0 && (
                          <div className="text-xs text-blue-600 text-right mt-0.5">
                            🚚 {formatPriceInput(String(line.delivery_price))} × {line.quantity} = {formatPriceInput(String((parseFloat(line.quantity || 0) * parseFloat(line.delivery_price || 0)).toFixed(2)))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLine(index)}
                          disabled={newPO.lines.length === 1}
                          className="text-red-600 h-9 w-9 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {hasPackagings && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <span className="text-xs text-slate-500 whitespace-nowrap">{t('packaging') || 'Packaging'}:</span>
                        <Select
                          value={line.packaging_id || 'none'}
                          onValueChange={(value) => handleLineChange(index, 'packaging_id', value === 'none' ? null : value)}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
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
                        {line.packaging_id ? (
                          <>
                            <span className="text-xs text-slate-500">×</span>
                            <Input
                              type="number"
                              min="1"
                              className="h-8 w-16 text-xs"
                              value={line.packaging_qty || 1}
                              onChange={(e) => handleLineChange(index, 'packaging_qty', e.target.value)}
                            />
                            <span className="text-xs text-indigo-600 font-medium">
                              = {line.quantity} {t('units') || 'units'}
                            </span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('tax')} (%)</label>
                <Popover>
                  <PopoverAnchor asChild>
                    <div className="flex">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newPO.tax_percent}
                        onChange={(e) => setNewPO({...newPO, tax_percent: e.target.value})}
                        className="rounded-r-none border-r-0"
                      />
                      {parseFloat(newPO.tax_percent) > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-none border-x-0 shrink-0 px-1 text-slate-400 hover:text-red-500"
                          onClick={() => setNewPO({...newPO, tax_percent: 0, tax_rate_id: ''})}
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
                      {purchaseTaxRates.map(tr => (
                        <PopoverTrigger asChild key={tr.id}>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors"
                            onClick={() => setNewPO({...newPO, tax_percent: tr.rate, tax_rate_id: tr.id})}
                          >
                            {tr.name} ({tr.rate}%){tr.price_include ? ` (${t('incl') || 'incl.'})` : ''}
                          </button>
                        </PopoverTrigger>
                      ))}
                      {purchaseTaxRates.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">{t('no_tax_rates') || 'No tax rates available'}</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('payment_terms') || 'Payment Terms'}</label>
                <Select value={newPO.payment_terms} onValueChange={(value) => setNewPO({...newPO, payment_terms: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">{t('prepaid') || 'Prepaid'}</SelectItem>
                    <SelectItem value="net_30">Net 30</SelectItem>
                    <SelectItem value="net_60">Net 60</SelectItem>
                    <SelectItem value="net_90">Net 90</SelectItem>
                    <SelectItem value="due_on_receipt">{t('due_on_receipt') || 'Due on Receipt'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <div className="space-y-2">
                {(() => {
                  const rawSubtotal = calculateOrderTotal(newPO.lines);
                  const deliveryTotal = calculateDeliveryTotal(newPO.lines);
                  const productSubtotal = rawSubtotal - deliveryTotal;
                  const taxPercent = parseFloat(newPO.tax_percent) || 0;
                  const selectedTax = newPO.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newPO.tax_rate_id)) : defaultPurchaseTax;
                  const taxCalc = calculateTaxFromRate(productSubtotal, taxPercent, selectedTax);
                  const subtotal = taxCalc.subtotal;
                  const taxAmount = taxCalc.taxAmount;
                  const total = subtotal + taxAmount + deliveryTotal;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('subtotal')}:</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      {deliveryTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{language === 'uz' ? 'Yetkazib berish:' : language === 'ru' ? 'Доставка:' : 'Delivery:'}</span>
                          <span className="font-medium text-blue-600">{formatCurrency(deliveryTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('tax')}{taxCalc.isInclusive ? ` (${t('incl') || 'incl.'})` : ''}:</span>
                        <span className="font-medium">{formatCurrency(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                        <span className="font-semibold text-lg">{t('total_amount')}:</span>
                        <span className="text-2xl font-bold text-indigo-600">
                          {formatCurrency(total)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowCreateModal(false); setUnmatchedProducts([]); }} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreatePO}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!newPO.supplier_id || newPO.lines.every(l => !l.product_id) || isSubmitting}
              >
                {isSubmitting ? (t('creating') || 'Creating...') : (t('create') || 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit PO Modal — full editor mirroring the create modal so
          users can change supplier, warehouse, vehicle, dates, lines,
          tax, payment terms, and status without recreating the order.
          Backend's UpdatePurchaseOrderInput supports all of these. */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('edit_order') || 'Edit Order'}</DialogTitle>
          </DialogHeader>
          {editPO && (
            <div className="space-y-4 py-4 min-w-0">
              {/* Read-only header — PO number is immutable */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('po_number') || 'PO Number'}</label>
                  <Input value={editPO.po_number || ''} disabled className="bg-slate-50 font-mono" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('status') || 'Status'}</label>
                  <Select value={editPO.status || 'draft'} onValueChange={(value) => setEditPO({...editPO, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                      <SelectItem value="sent">{t('sent') || 'Sent'}</SelectItem>
                      <SelectItem value="approved">{t('approved') || 'Approved'}</SelectItem>
                      <SelectItem value="ordered">{t('ordered') || 'Ordered'}</SelectItem>
                      <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Supplier + Warehouse */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('supplier') || 'Supplier'} *</label>
                  <Select
                    value={editPO.supplier_id || ''}
                    onValueChange={(value) => {
                      const supplier = suppliers.find(s => s.id === value);
                      setEditPO({
                        ...editPO,
                        supplier_id: value,
                        vendor_id: value,
                        supplier_name: supplier?.name || '',
                        vendor_name: supplier?.name || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_supplier') || 'Select supplier'} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.filter(s => s.is_active !== false && s.status !== 'inactive').map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('warehouse') || 'Warehouse'}</label>
                  {warehouses.length === 1 ? (
                    <Input value={warehouses[0].name} disabled className="bg-slate-50" />
                  ) : (
                    <Select
                      value={editPO.warehouse_id || '__none__'}
                      onValueChange={(value) => setEditPO({...editPO, warehouse_id: value === '__none__' ? '' : value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('auto_select') || 'Auto select'}</SelectItem>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.id} value={wh.id}>
                            {wh.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('order_date') || 'Order Date'}</label>
                  <Input
                    type="date"
                    value={editPO.order_date?.split('T')[0] || ''}
                    onChange={(e) => setEditPO({...editPO, order_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('delivery_date') || 'Delivery Date'}</label>
                  <Input
                    type="date"
                    value={editPO.expected_delivery_date?.split('T')[0] || ''}
                    onChange={(e) => setEditPO({...editPO, expected_delivery_date: e.target.value})}
                  />
                </div>
              </div>

              {/* Vehicle + Shipping toggle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('vehicle_number') || 'Vehicle Number'}</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={editPO.vehicle_number || ''}
                      onChange={(e) => setEditPO({...editPO, vehicle_number: e.target.value})}
                      placeholder="01 A 123 AA"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="edit-requires-shipping"
                      checked={!!editPO.requires_shipping}
                      onCheckedChange={(checked) => setEditPO({...editPO, requires_shipping: checked})}
                    />
                    <label htmlFor="edit-requires-shipping" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <Package className="w-4 h-4 text-slate-500" />
                      {t('requires_shipping') || 'Requires Shipping'}
                    </label>
                  </div>
                </div>
              </div>

              {/* Order Lines */}
              <div className="border-t pt-4 min-w-0">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-base font-semibold">{t('order_items') || 'Order Items'}</label>
                  <Button size="sm" variant="outline" onClick={handleEditAddLine}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_line') || 'Add Line'}
                  </Button>
                </div>

                {editPO._linesLoading ? (
                  <div className="flex items-center justify-center py-6 text-slate-500 text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('loading') || 'Loading...'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto min-w-0">
                    {(editPO.lines || []).map((line, index) => (
                      <div key={line.id || index} className="bg-slate-50 p-3 rounded space-y-2 min-w-0">
                        <div className="flex gap-2 items-end min-w-0">
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('product')}</label>}
                            <ProductCombobox
                              products={products}
                              value={line.product_id || ''}
                              valueLabel={line.product_name || line.description || ''}
                              onValueChange={(value) => handleEditLineChange(index, 'product_id', value)}
                              onCreateNew={(name) => setQuickCreate({
                                name,
                                onPick: (product) => handleEditLineChange(index, 'product_id', product.id, product),
                              })}
                              placeholder={t('select_product') || 'Mahsulot tanlang'}
                              t={t}
                            />
                          </div>
                          <div className="flex-[1] min-w-0">
                            {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('qty')}</label>}
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                placeholder={t('qty') || 'Qty'}
                                value={line.quantity}
                                onChange={(e) => handleEditLineChange(index, 'quantity', e.target.value)}
                              />
                              {line.unit_name && (
                                <span className="text-xs text-slate-500 whitespace-nowrap">{line.unit_name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-[1.5] min-w-0">
                            {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('price')}</label>}
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder={t('price') || 'Price'}
                              value={formatPriceInput(line.unit_price)}
                              onChange={(e) => handleEditLineChange(index, 'unit_price', parsePriceInput(e.target.value))}
                            />
                          </div>
                          <div className="flex-[1.5] min-w-0">
                            {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('total')}</label>}
                            {/* Editable lot total — click to clear Narx, type total, = to derive. */}
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="text-right font-medium"
                                placeholder={t('total') || 'Total'}
                                value={line.jami_draft !== undefined ? formatPriceInput(line.jami_draft) : formatPriceInput(String((parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)).toFixed(2)))}
                                onFocus={() => { if (line.jami_draft === undefined) handleEditLineChange(index, 'jami_focus', true); }}
                                onChange={(e) => handleEditLineChange(index, 'jami_draft', parsePriceInput(e.target.value))}
                                onBlur={() => handleEditLineChange(index, 'jami_calc', true)}
                              />
                              {line.jami_draft !== undefined && (
                                <Button type="button" size="sm" variant="outline" className="h-9 px-2 shrink-0"
                                  title="Narx = Jami / Miqdor" onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleEditLineChange(index, 'jami_calc', true)}>=</Button>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditRemoveLine(index)}
                              disabled={editPO.lines.length === 1}
                              className="text-red-600 h-9 w-9 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tax + Payment terms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('tax') || 'Tax'} (%)</label>
                  <div className="flex">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={editPO.tax_percent || 0}
                      onChange={(e) => setEditPO({...editPO, tax_percent: e.target.value})}
                      className={parseFloat(editPO.tax_percent) > 0 ? 'rounded-r-none border-r-0' : ''}
                    />
                    {parseFloat(editPO.tax_percent) > 0 && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-l-none shrink-0 px-1 text-slate-400 hover:text-red-500"
                        onClick={() => setEditPO({...editPO, tax_percent: 0, tax_rate_id: ''})}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payment_terms') || 'Payment Terms'}</label>
                  <Select value={editPO.payment_terms || 'net_30'} onValueChange={(value) => setEditPO({...editPO, payment_terms: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepaid">{t('prepaid') || 'Prepaid'}</SelectItem>
                      <SelectItem value="net_30">Net 30</SelectItem>
                      <SelectItem value="net_60">Net 60</SelectItem>
                      <SelectItem value="net_90">Net 90</SelectItem>
                      <SelectItem value="due_on_receipt">{t('due_on_receipt') || 'Due on Receipt'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Totals breakdown — recomputed live from edits */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="space-y-2">
                  {(() => {
                    const rawSubtotal = calculateOrderTotal(editPO.lines || []);
                    const taxPercent = parseFloat(editPO.tax_percent) || 0;
                    const selectedTax = editPO.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(editPO.tax_rate_id)) : defaultPurchaseTax;
                    const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
                    const subtotal = taxCalc.subtotal;
                    const taxAmount = taxCalc.taxAmount;
                    const total = subtotal + taxAmount;
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
                        <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                          <span className="font-semibold text-lg">{t('total_amount')}:</span>
                          <span className="text-2xl font-bold text-indigo-600">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowEditModal(false); setEditPO(null); }} className="flex-1">
                  {t('cancel') || 'Cancel'}
                </Button>
                <Button
                  onClick={handleUpdatePO}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  disabled={isSubmitting || !editPO.supplier_id}
                >
                  {isSubmitting ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      <Dialog open={showDetailModal} onOpenChange={(open) => { setShowDetailModal(open); if (!open) { setDetailPO(null); setDetailPOLines([]); setOrderReturns([]); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t('order_details') || 'Order Details'}
              {detailPO && orderHasReturns(detailPO.id) && (
                <Badge className="bg-red-100 text-red-700">
                  <MessageSquareWarning className="w-3 h-3 mr-1" />
                  {t('has_returns') || 'Has Returns'}
                </Badge>
              )}
              {detailPO && (
                <span className="ml-auto mr-6">
                  <PrintButton onClick={() => setShowPrintPreview(true)} label={t('print') || 'Chop etish'} />
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailPO && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">{t('po_number') || 'PO Number'}</p>
                  <p className="font-mono font-semibold">{detailPO.po_number || detailPO.order_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('supplier') || 'Supplier'}</p>
                  <p className="font-medium">{detailPO.supplier_name || detailPO.vendor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={getStatusColor(detailPO.status)}>{t(detailPO.status) || detailPO.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('total_amount') || 'Total Amount'}</p>
                  <p className="font-bold text-lg">{formatCurrency(detailPO.total_amount || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">{t('order_date') || 'Order Date'}</p>
                  <p className="font-medium">{detailPO.order_date ? format(new Date(detailPO.order_date), 'dd.MM.yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('delivery_date') || 'Delivery Date'}</p>
                  <p className="font-medium">{(detailPO.expected_delivery_date || detailPO.expected_date) ? format(new Date(detailPO.expected_delivery_date || detailPO.expected_date), 'dd.MM.yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('payment_terms') || 'Payment Terms'}</p>
                  <p className="font-medium">{detailPO.payment_terms || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('vendor_reference') || 'Vendor Reference'}</p>
                  <p className="font-medium">{detailPO.vendor_reference || '-'}</p>
                </div>
              </div>

              {/* Order Lines */}
              <div className="border-t pt-4">
                <h3 className="text-base font-semibold mb-3">{t('order_items') || 'Order Items'}</h3>
                {isLoadingDetails ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : detailPOLines.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">{t('no_items') || 'No items'}</p>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    {detailPOLines.map((line, idx) => (
                      <div key={line.id || idx} className="flex justify-between items-center border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                        <div>
                          <span className="font-medium">{line.product_name || line.description}</span>
                          {line.alt_name && line.alt_name !== (line.product_name || line.description) && (
                            <p className="text-xs text-indigo-600 italic">({line.alt_name})</p>
                          )}
                          <p className="text-xs text-slate-500">{t('quantity')}: {line.quantity}{line.unit_name ? ` ${line.unit_name}` : ''}</p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className="font-medium">{formatCurrency((line.quantity || 0) * (line.unit_price || 0))}</span>
                            <p className="text-xs text-slate-500">{formatCurrency(line.unit_price || 0)} x {line.quantity}</p>
                          </div>
                          {['received', 'partial'].includes(detailPO.status) && canCreate(MODULES.ASSETS) && (
                            <Button
                              size="sm" variant="outline" className="shrink-0"
                              title={t('po_capitalize') || 'Aktivga aylantirish'}
                              onClick={() => openCapitalize(line)}
                            >
                              <Landmark className="w-4 h-4 mr-1" />
                              {t('po_capitalize_short') || 'Aktivga'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              {detailPOLines.length > 0 && (() => {
                const subtotal = detailPOLines.reduce((sum, l) => sum + (l.quantity || 0) * (l.unit_price || 0), 0);
                const taxAmount = (detailPO.tax_amount != null) ? detailPO.tax_amount : subtotal * 0.12;
                const shippingCost = detailPO.shipping_cost || detailPO.shipping_amount || 0;
                const totalAmount = detailPO.total_amount || (subtotal + taxAmount + shippingCost);
                return (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('subtotal')}:</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('tax')}:</span>
                        <span className="font-medium">{formatCurrency(taxAmount)}</span>
                      </div>
                      {shippingCost > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('shipping')}:</span>
                          <span className="font-medium">{formatCurrency(shippingCost)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-indigo-300">
                        <span className="font-semibold text-lg">{t('total_amount')}:</span>
                        <span className="text-2xl font-bold text-indigo-600">{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Returns Section */}
              {orderReturns.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-red-600">
                    <RotateCcw className="w-4 h-4" />
                    {t('returns') || 'Returns'}
                  </h3>
                  <div className="space-y-3">
                    {orderReturns.map((ret) => (
                      <div key={ret.id} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-red-700">{ret.return_number}</span>
                            <Badge className={
                              ret.status === 'credited' ? 'bg-green-100 text-green-800' :
                              ret.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                              ret.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                              ret.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }>{t(ret.status) || ret.status}</Badge>
                          </div>
                          <span className="text-sm text-slate-500">
                            {ret.return_date ? format(new Date(ret.return_date), 'dd.MM.yyyy') : '-'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">{t('reason') || 'Reason'}:</span>
                            <span className="ml-1 font-medium">{t(ret.reason) || ret.reason}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{t('total_value') || 'Total Value'}:</span>
                            <span className="ml-1 font-semibold text-red-600">{(ret.total_value || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowDetailModal(false); setDetailPO(null); setDetailPOLines([]); setOrderReturns([]); }} className="flex-1">
                  {t('close') || 'Close'}
                </Button>
                {canUpdate(MODULES.PURCHASES) && (
                  <Button
                    onClick={(e) => { setShowDetailModal(false); handleEditPO(detailPO, e); }}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {t('edit') || 'Edit'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Preview — shared jsPDF template (buxgalter print form) */}
      {detailPO && (
        <PrintPreviewModal
          open={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          filename={`${detailPO.po_number || detailPO.order_number || 'PO'}`}
          config={{
            template: 'invoice',
            title: t('purchase_order') || 'Xarid buyurtmasi',
            documentNumber: detailPO.po_number || detailPO.order_number || '',
            documentDate: (detailPO.order_date || '').toString().split('T')[0],
            dateLabel: t('order_date') || 'Sana',
            headerFields: [
              { label: t('supplier') || 'Yetkazib beruvchi', value: detailPO.supplier_name || detailPO.vendor_name || '-' },
              { label: t('delivery_date') || 'Yetkazish sanasi', value: (detailPO.expected_delivery_date || detailPO.expected_date || '-').toString().split('T')[0] },
              { label: t('status') || 'Holat', value: t(detailPO.status) || detailPO.status || '-' },
            ],
            tableColumns: [
              { key: 'name', label: t('product') || 'Mahsulot', width: 70 },
              { key: 'qty', label: t('quantity') || 'Miqdor', align: 'right', width: 22 },
              { key: 'received', label: t('received') || 'Qabul', align: 'right', width: 22 },
              { key: 'price', label: t('unit_price') || 'Narx', align: 'right', width: 32 },
              { key: 'total', label: t('amount') || 'Summa', align: 'right', width: 34 },
            ],
            tableData: (detailPOLines || []).map((l) => ({
              name: l.product_name || l.description || '-',
              qty: String(l.quantity ?? ''),
              received: String(l.quantity_received ?? 0),
              price: formatCurrency(l.unit_price || 0),
              total: formatCurrency(l.line_total || (l.quantity || 0) * (l.unit_price || 0)),
            })),
            totals: [
              ...(detailPO.tax_amount > 0 ? [
                { label: t('subtotal') || 'Oraliq summa', value: formatCurrency(detailPO.subtotal || 0) },
                { label: t('tax') || 'QQS', value: formatCurrency(detailPO.tax_amount || 0) },
              ] : []),
              { label: t('total') || 'Jami', value: formatCurrency(detailPO.total_amount || 0), bold: true },
            ],
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('po_delete_title') || "Buyurtmani o'chirish"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(t('po_delete_message') || `"{number}" buyurtmani o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`)
                .replace('{number}', deleteConfirm?.po_number || deleteConfirm?.order_number || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (deleteConfirm) {
                  await deletePurchaseOrder(deleteConfirm.id);
                  fetchOrders();
                  setDeleteConfirm(null);
                }
              }}
            >
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick "create product" from a line's product dropdown. On success the
          new product is added to the list and selected into the line that
          triggered it. */}
      <QuickProductModal
        open={!!quickCreate}
        initialName={quickCreate?.name || ''}
        organizationIds={activeCompany?.id ? [activeCompany.id] : []}
        onClose={() => setQuickCreate(null)}
        onCreated={(product) => {
          if (product?.id) {
            setProducts((prev) => [product, ...prev]);
            quickCreate?.onPick?.(product);
          }
          setQuickCreate(null);
        }}
        t={t}
      />

      {/* "Aktivga aylantirish" — capitalize a received line into fa_assets.
          The backend posts a reclass (Дт 0810 / Кт inventory), NOT a second
          purchase, so the supplier debt is never doubled. */}
      <Dialog open={!!capLine} onOpenChange={(o) => !o && setCapLine(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('po_capitalize') || 'Aktivga aylantirish'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('name') || 'Nomi'} *</label>
              <Input value={capForm.name} onChange={(e) => setCapForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('category') || 'Kategoriya'} *</label>
                <Select
                  value={capForm.category_id}
                  onValueChange={(v) => {
                    const cat = (capMapping?.categories || []).find((c) => c.id === v);
                    setCapForm((f) => ({
                      ...f, category_id: v,
                      useful_life_months: f.useful_life_months || (cat?.default_useful_life_months ? String(cat.default_useful_life_months) : ''),
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={t('select') || 'Tanlang'} /></SelectTrigger>
                  <SelectContent>
                    {(capMapping?.categories || []).filter((c) => c.is_active !== false && c.depreciable !== false).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name_uz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('fa_cost_center') || "Bo'lim"} *</label>
                <Select value={capForm.department_id} onValueChange={(v) => setCapForm((f) => ({ ...f, department_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('select') || 'Tanlang'} /></SelectTrigger>
                  <SelectContent>
                    {(capMapping?.departments || []).filter((d) => d.is_active !== false).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name_uz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('cost') || 'Tannarx'} *</label>
                <Input type="number" min="0" value={capForm.cost} onChange={(e) => setCapForm((f) => ({ ...f, cost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('fa_useful_life') || 'Muddat'} ({t('fa_months') || 'oy'}) *</label>
                <Input type="number" min="1" value={capForm.useful_life_months} onChange={(e) => setCapForm((f) => ({ ...f, useful_life_months: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              {t('po_capitalize_note') || "Ombordan kapital qo'yilmaga reklassifikatsiya qilinadi — ta'minotchi qarzi ikkilanmaydi. Keyin Aktivlar sahifasida foydalanishga topshirasiz."}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCapLine(null)} disabled={capBusy}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={submitCapitalize} disabled={capBusy}>
              {capBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('po_capitalize') || 'Aktivga aylantirish'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
