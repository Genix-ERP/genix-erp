import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inventoryService } from '@/api/services/inventory';
import apiClient from '@/api/client';
import {
  Plus,
  Search,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Truck,
  Brain,
  AlertTriangle,
  Target,
  Lightbulb,
  Edit2,
  LayoutDashboard,
  Building2,
  FileQuestion,
  FileText,
  History,
  DollarSign,
  ClipboardList,
  Package,
  RotateCcw,
  Receipt,
  Award,
  X,
  Eye,
  MessageSquareWarning,
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyzeProcurement } from '@/api/services/aiAnalytics';

import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { procurementService } from '@/api/services/procurement';

import Suppliers from '@/components/procurement/Suppliers';
import RFQManagement from '@/components/procurement/RFQManagement';
import Contracts from '@/components/procurement/Contracts';
import PriceHistory from '@/components/procurement/PriceHistory';
import PurchaseRequisitions from '@/components/procurement/PurchaseRequisitions';
import GoodsReceipt from '@/components/procurement/GoodsReceipt';
import PurchaseReturns from '@/components/procurement/PurchaseReturns';
import VendorBills from '@/components/procurement/VendorBills';
import SupplierPerformance from '@/components/procurement/SupplierPerformance';

export default function Procurement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const {
    suppliers,
    purchaseOrders,
    rfqs,
    contracts,
    createPurchaseOrder,
    updatePurchaseOrder,
    getSupplierById,
    getSupplierStats,
    isLoading,
  } = useProcurement();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editPO, setEditPO] = useState(null);
  const [detailPO, setDetailPO] = useState(null);
  const [detailPOLines, setDetailPOLines] = useState([]);
  const [orderReturns, setOrderReturns] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Products list for selection
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Product variants
  const [productVariants, setProductVariants] = useState({}); // { productId: variants[] }

  // Product packagings (e.g., 6-pack, case of 24)
  const [productPackagings, setProductPackagings] = useState({}); // { productId: packagings[] }

  // Track if delivery date was manually set
  const [isDeliveryDateManual, setIsDeliveryDateManual] = useState(false);
  const [isEditDeliveryDateManual, setIsEditDeliveryDateManual] = useState(false);

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
  }, []);

  // Fetch purchase returns to identify orders with returns
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

  // AI Analysis
  const procurementAnalysis = useMemo(() => analyzeProcurement(purchaseOrders), [purchaseOrders]);

  const [newPO, setNewPO] = useState({
    po_number: '',
    supplier_id: '',
    vendor_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: new Date().toISOString().split('T')[0], // Default to today
    total_amount: 0,
    payment_terms: 'net_30',
    lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
  });

  // Filter purchase orders
  React.useEffect(() => {
    let filtered = purchaseOrders;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(po => po.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(po =>
        po.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredOrders(filtered);
  }, [purchaseOrders, searchQuery, statusFilter]);

  // Calculate order total from line items
  const calculateOrderTotal = (lines) => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)), 0);
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
      const response = await apiClient.get(`/products/${productId}/packagings`);
      // Only show packagings available for purchase
      const packagings = (response.data?.data || []).filter(p => p.purchase !== false);
      setProductPackagings(prev => ({ ...prev, [productId]: packagings }));
    } catch (error) {
      console.error('Failed to fetch packagings:', error);
    }
  }, [productPackagings]);

  const handleLineChange = (index, field, value) => {
    const newLines = [...newPO.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If changing product selection, also update lead_time_days and recalculate delivery date
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        newLines[index] = {
          ...newLines[index],
          product_name: selectedProduct.name,
          product_id: selectedProduct.id,
          unit_price: selectedProduct.purchase_price || selectedProduct.cost_price || selectedProduct.price || 0,
          lead_time_days: selectedProduct.lead_time_days || 0,
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
        if (!isDeliveryDateManual) {
          const newDeliveryDate = calculateDeliveryDate(newLines, newPO.order_date);
          setNewPO({ ...newPO, lines: newLines, expected_delivery_date: newDeliveryDate, total_amount: calculateOrderTotal(newLines) });
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
          unit_price: selectedVariant.cost_price || newLines[index].unit_price
        };
      }
    }

    // If changing packaging selection
    if (field === 'packaging_id') {
      const productId = newLines[index].product_id;
      if (value && value !== 'none') {
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

    setNewPO({ ...newPO, lines: newLines, total_amount: calculateOrderTotal(newLines) });
  };

  const handleCreatePO = async () => {
    if (!newPO.supplier_id && !newPO.vendor_name) return;

    setIsSubmitting(true);
    try {
      const supplier = getSupplierById(newPO.supplier_id);
      const totalAmount = calculateOrderTotal(newPO.lines);
      const poData = {
        ...newPO,
        po_number: newPO.po_number || `PO-${Date.now()}`,
        vendor_name: supplier?.name || newPO.vendor_name,
        total_amount: totalAmount,
        status: 'draft',
        ai_price_validation: true
      };

      await createPurchaseOrder(poData);
      setShowCreateModal(false);

      setNewPO({
        po_number: '',
        supplier_id: '',
        vendor_name: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        payment_terms: 'net_30',
        lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
      });
      setIsDeliveryDateManual(false);
    } catch (error) {
      console.error('Error creating PO:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPO = async (po, e) => {
    e.stopPropagation();
    setIsLoadingDetails(true);
    setDetailPO(po);
    setShowDetailModal(true);

    try {
      // Fetch full order details with lines
      const fullOrder = await procurementService.getOrder(po.id);
      setDetailPO(fullOrder);
      setDetailPOLines(fullOrder.lines || []);

      // Get returns for this order and fetch their details (with lines)
      const basicReturns = getOrderReturns(po.id);
      if (basicReturns.length > 0) {
        // Fetch full details for each return to get the lines
        const detailedReturns = await Promise.all(
          basicReturns.map(async (ret) => {
            try {
              const fullReturn = await procurementService.getReturn(ret.id);
              return fullReturn;
            } catch {
              return ret; // fallback to basic return if fetch fails
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

  const handleEditPO = (po, e) => {
    e.stopPropagation();
    setEditPO({
      ...po,
      // Map backend field names to frontend field names
      po_number: po.po_number || po.order_number,
      supplier_name: po.supplier_name || po.vendor_name,
      total_amount: po.total_amount || 0,
      expected_delivery_date: po.expected_delivery_date || po.expected_date || '',
      order_date: po.order_date ? (typeof po.order_date === 'string' ? po.order_date.split('T')[0] : po.order_date) : '',
    });
    setShowEditModal(true);
  };

  const handleUpdatePO = async () => {
    if (!editPO) return;

    setIsSubmitting(true);
    try {
      // Backend expects these specific field names (see UpdatePurchaseOrderInput)
      const updates = {};

      // Only include fields that have changed and are supported by backend
      if (editPO.expected_delivery_date) {
        updates.expected_date = editPO.expected_delivery_date;
      }
      if (editPO.payment_terms) {
        updates.payment_terms = editPO.payment_terms;
      }
      if (editPO.status) {
        updates.status = editPO.status;
      }
      if (editPO.notes !== undefined) {
        updates.notes = editPO.notes;
      }
      if (editPO.vendor_reference !== undefined) {
        updates.vendor_reference = editPO.vendor_reference;
      }

      // Only call update if there are changes
      if (Object.keys(updates).length > 0) {
        await updatePurchaseOrder(editPO.id, updates);
      }
      setShowEditModal(false);
      setEditPO(null);
    } catch (error) {
      console.error('Error updating PO:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePOStatus = async (poId, newStatus) => {
    // Backend only accepts 'status' field for update
    const updates = { status: newStatus };
    await updatePurchaseOrder(poId, updates);
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

  // Statistics
  const supplierStats = getSupplierStats();
  const metrics = {
    totalPOs: purchaseOrders.length,
    totalValue: purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
    pendingPOs: purchaseOrders.filter(po => ['draft', 'sent', 'confirmed'].includes(po.status)).length,
    receivedPOs: purchaseOrders.filter(po => po.status === 'received').length
  };

  // Chart data
  const vendorData = {};
  purchaseOrders.forEach(po => {
    const name = po.supplier_name || po.vendor_name || 'Unknown';
    vendorData[name] = (vendorData[name] || 0) + (po.total_amount || 0);
  });
  const chartData = Object.entries(vendorData).slice(0, 5).map(([vendor, value]) => ({
    vendor: vendor.length > 15 ? vendor.substring(0, 15) + '...' : vendor,
    value
  }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger
              value="dashboard"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard') || 'Dashboard'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="suppliers"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('suppliers') || 'Suppliers'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="purchase-orders"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">{t('purchase_orders') || 'Purchase Orders'}</span>
              <span className="sm:hidden">PO</span>
            </TabsTrigger>

            <TabsTrigger
              value="rfq"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <FileQuestion className="w-4 h-4" />
              <span className="hidden sm:inline">{t('rfq') || 'RFQ'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="contracts"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('contracts') || 'Contracts'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="price-history"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">{t('price_history') || 'Price History'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="requisitions"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">{t('requisitions') || 'Requisitions'}</span>
              <span className="sm:hidden">PR</span>
            </TabsTrigger>

            <TabsTrigger
              value="goods-receipt"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t('goods_receipt') || 'Goods Receipt'}</span>
              <span className="sm:hidden">GR</span>
            </TabsTrigger>

            <TabsTrigger
              value="returns"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">{t('returns') || 'Returns'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="vendor-bills"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('vendor_bills') || 'Bills'}</span>
            </TabsTrigger>

            <TabsTrigger
              value="performance"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              <Award className="w-4 h-4" />
              <span className="hidden sm:inline">{t('supplier_performance') || 'Performance'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('total_po') || 'Total PO'}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.totalPOs}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('total_value') || 'Total Value'}</p>
                      <p className="text-lg font-bold text-green-600">
                        {metrics.totalValue > 1000000
                          ? `${(metrics.totalValue / 1000000).toFixed(1)}M`
                          : metrics.totalValue.toLocaleString()}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('pending') || 'Pending'}</p>
                      <p className="text-2xl font-bold text-yellow-600">{metrics.pendingPOs}</p>
                    </div>
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('received') || 'Received'}</p>
                      <p className="text-2xl font-bold text-purple-600">{metrics.receivedPOs}</p>
                    </div>
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('suppliers') || 'Suppliers'}</p>
                      <p className="text-2xl font-bold text-indigo-600">{supplierStats.activeSuppliers}</p>
                    </div>
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{t('contracts') || 'Contracts'}</p>
                      <p className="text-2xl font-bold text-pink-600">{contracts.filter(c => c.status === 'active').length}</p>
                    </div>
                    <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-pink-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Insights Panel */}
            {(procurementAnalysis.insights.length > 0 || procurementAnalysis.recommendations.length > 0) && (
              <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="w-5 h-5 text-indigo-600" />
                    {t('ai_analysis') || 'AI Analysis'}
                    <Badge className="bg-indigo-100 text-indigo-700 text-xs">Live</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {procurementAnalysis.insights.slice(0, 2).map((insight, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-indigo-100">
                        <div className="flex items-start gap-3">
                          {insight.type === 'positive' ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                          ) : insight.type === 'warning' ? (
                            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                          ) : (
                            <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                          )}
                          <div>
                            <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                            <p className="text-xs text-slate-600 mt-0.5">{insight.description}</p>
                            {insight.metric && (
                              <p className="text-lg font-bold text-indigo-600 mt-1">{insight.metric}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {procurementAnalysis.recommendations.length > 0 && (
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-indigo-100">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-slate-900 text-sm">{t('ai_recommendation') || 'AI Recommendation'}</h4>
                            <p className="text-xs text-slate-600 mt-0.5">{procurementAnalysis.recommendations[0].action}</p>
                            <p className="text-xs text-slate-500 mt-1">{procurementAnalysis.recommendations[0].description}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartData.length > 0 && (
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>{t('purchases_by_supplier') || 'Purchases by Supplier'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="vendor" fontSize={11} angle={-45} textAnchor="end" height={80} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Recent POs */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t('recent_orders') || 'Recent Orders'}</CardTitle>
                </CardHeader>
                <CardContent>
                  {purchaseOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">{t('no_orders_yet') || 'No orders yet'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {purchaseOrders.slice(0, 5).map((po) => (
                        <div key={po.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{po.po_number}</p>
                            <p className="text-xs text-slate-500">{po.supplier_name || po.vendor_name}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(po.status)}>{t(po.status) || po.status}</Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              {(po.total_amount || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Suppliers Tab */}
          <TabsContent value="suppliers" className="mt-6">
            <Suppliers />
          </TabsContent>

          {/* Purchase Orders Tab */}
          <TabsContent value="purchase-orders" className="mt-6">
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
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
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
                          <TableHead>{t('po_number') || 'PO #'}</TableHead>
                          <TableHead>{t('supplier') || 'Supplier'}</TableHead>
                          <TableHead>{t('order_date') || 'Order Date'}</TableHead>
                          <TableHead>{t('delivery_date') || 'Delivery Date'}</TableHead>
                          <TableHead>{t('amount') || 'Amount'}</TableHead>
                          <TableHead>{t('status') || 'Status'}</TableHead>
                          <TableHead>{t('actions') || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((po) => (
                          <TableRow key={po.id} className="hover:bg-slate-50">
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-2">
                                {po.po_number}
                                {orderHasReturns(po.id) && (
                                  <MessageSquareWarning className="w-4 h-4 text-red-500" title={t('has_returns') || 'Has Returns'} />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{po.supplier_name || po.vendor_name}</TableCell>
                            <TableCell className="text-sm">
                              {po.order_date ? format(new Date(po.order_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {(po.expected_delivery_date || po.expected_date) ? format(new Date(po.expected_delivery_date || po.expected_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="font-semibold">{(po.total_amount || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(po.status)}>{t(po.status) || po.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={(e) => handleViewPO(po, e)} title={t('view_details') || 'View Details'}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {canUpdate(MODULES.PURCHASES) && (
                                  <Button size="sm" variant="ghost" onClick={(e) => handleEditPO(po, e)} title={t('edit') || 'Edit'}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                )}
                                {canUpdate(MODULES.PURCHASES) && po.status === 'draft' && (
                                  <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'sent')}>
                                    {t('send') || 'Send'}
                                  </Button>
                                )}
                                {canUpdate(MODULES.PURCHASES) && po.status === 'sent' && (
                                  <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'confirmed')}>
                                    {t('confirm') || 'Confirm'}
                                  </Button>
                                )}
                                {canUpdate(MODULES.PURCHASES) && po.status === 'confirmed' && (
                                  <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'received')}>
                                    <Truck className="w-4 h-4" />
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
          </TabsContent>

          {/* RFQ Tab */}
          <TabsContent value="rfq" className="mt-6">
            <RFQManagement />
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="mt-6">
            <Contracts />
          </TabsContent>

          {/* Price History Tab */}
          <TabsContent value="price-history" className="mt-6">
            <PriceHistory />
          </TabsContent>

          {/* Purchase Requisitions Tab */}
          <TabsContent value="requisitions" className="mt-6">
            <PurchaseRequisitions />
          </TabsContent>

          {/* Goods Receipt Tab */}
          <TabsContent value="goods-receipt" className="mt-6">
            <GoodsReceipt />
          </TabsContent>

          {/* Purchase Returns Tab */}
          <TabsContent value="returns" className="mt-6">
            <PurchaseReturns />
          </TabsContent>

          {/* Vendor Bills Tab */}
          <TabsContent value="vendor-bills" className="mt-6">
            <VendorBills />
          </TabsContent>

          {/* Supplier Performance Tab */}
          <TabsContent value="performance" className="mt-6">
            <SupplierPerformance />
          </TabsContent>
        </Tabs>

        {/* Create PO Modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => { setShowCreateModal(open); if (!open) setIsDeliveryDateManual(false); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('new_purchase_order') || 'New Purchase Order'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('po_number_optional') || 'PO Number (Optional)'}</label>
                  <Input
                    placeholder={t('auto_generate') || 'Auto generate'}
                    value={newPO.po_number}
                    onChange={(e) => setNewPO({...newPO, po_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('supplier') || 'Supplier'} *</label>
                  <Select
                    value={newPO.supplier_id}
                    onValueChange={(value) => {
                      const supplier = suppliers.find(s => s.id === value);
                      setNewPO({
                        ...newPO,
                        supplier_id: value,
                        vendor_name: supplier?.name || ''
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
              </div>

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

              {/* Order Lines */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-base font-semibold">{t('order_items') || 'Order Items'}</label>
                  <Button size="sm" variant="outline" onClick={handleAddLine}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_line') || 'Add Line'}
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {newPO.lines.map((line, index) => {
                    const selectedProduct = products.find(p => p.id === line.product_id);
                    const hasVariants = selectedProduct?.has_variants && productVariants[line.product_id]?.length > 0;
                    const hasPackagings = productPackagings[line.product_id]?.length > 0;
                    return (
                    <div key={index} className="bg-slate-50 p-3 rounded space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className={hasVariants ? "col-span-4" : "col-span-5"}>
                          <Select
                            value={line.product_id || ''}
                            onValueChange={(value) => handleLineChange(index, 'product_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('select_product') || 'Select product'} />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} {product.has_variants && '(V)'} {product.lead_time_days > 0 && `(${product.lead_time_days} ${t('days') || 'days'})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {hasVariants && (
                          <div className="col-span-3">
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
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder={t('quantity') || 'Qty'}
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className={hasVariants ? "col-span-2" : "col-span-3"}>
                          <Input
                            type="number"
                            placeholder={t('price') || 'Price'}
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLine(index)}
                            disabled={newPO.lines.length === 1}
                            className="text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Packaging selector row */}
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
                              <span
                                className="text-xs text-indigo-600 font-medium"
                                title={`${line.packaging_qty || 1} × ${line.packaging_unit_qty || 1} = ${line.quantity}`}
                              >
                                = {line.quantity} {t('units') || 'units'}
                              </span>
                            </>
                          ) : null}
                        </div>
                      )}
                      {line.variant_name && (
                        <div className="text-xs text-slate-500 pl-1">
                          {t('variant')}: {line.variant_name}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('total_amount') || 'Total Amount'}</label>
                  <Input
                    type="number"
                    value={calculateOrderTotal(newPO.lines)}
                    disabled
                    className="bg-slate-100"
                  />
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

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
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

        {/* Edit PO Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('edit_order') || 'Edit Order'}</DialogTitle>
            </DialogHeader>
            {editPO && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('po_number') || 'PO Number'}</label>
                    <Input
                      value={editPO.po_number}
                      onChange={(e) => setEditPO({...editPO, po_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('supplier') || 'Supplier'}</label>
                    <Input
                      value={editPO.supplier_name || editPO.vendor_name}
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('order_date') || 'Order Date'} *</label>
                    <Input
                      type="date"
                      value={editPO.order_date?.split('T')[0] || ''}
                      onChange={(e) => setEditPO({...editPO, order_date: e.target.value})}
                      required
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('total_amount') || 'Total Amount'} *</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editPO.total_amount}
                      onChange={(e) => setEditPO({...editPO, total_amount: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('payment_terms') || 'Payment Terms'}</label>
                    <Select value={editPO.payment_terms && editPO.payment_terms !== '' ? editPO.payment_terms : 'net_30'} onValueChange={(value) => setEditPO({...editPO, payment_terms: value})}>
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

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('status') || 'Status'}</label>
                  <Select value={editPO.status && editPO.status !== '' ? editPO.status : 'draft'} onValueChange={(value) => setEditPO({...editPO, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                      <SelectItem value="sent">{t('sent') || 'Sent'}</SelectItem>
                      <SelectItem value="confirmed">{t('confirmed') || 'Confirmed'}</SelectItem>
                      <SelectItem value="received">{t('received') || 'Received'}</SelectItem>
                      <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditPO(null); }} className="flex-1">
                    {t('cancel') || 'Cancel'}
                  </Button>
                  <Button
                    onClick={handleUpdatePO}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                    disabled={isSubmitting}
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
              </DialogTitle>
            </DialogHeader>
            {detailPO && (
              <div className="space-y-6 py-4">
                {/* Order Header Info */}
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
                    <p className="font-bold text-lg">{(detailPO.total_amount || 0).toLocaleString()}</p>
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
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>{t('product') || 'Product'}</TableHead>
                            <TableHead className="text-right">{t('quantity') || 'Quantity'}</TableHead>
                            <TableHead className="text-right">{t('unit_price') || 'Unit Price'}</TableHead>
                            <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailPOLines.map((line, idx) => (
                            <TableRow key={line.id || idx}>
                              <TableCell className="font-medium">{line.product_name || line.description}</TableCell>
                              <TableCell className="text-right">{line.quantity}</TableCell>
                              <TableCell className="text-right">{(line.unit_price || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right font-semibold">{((line.quantity || 0) * (line.unit_price || 0)).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

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
                                ret.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
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
                            {ret.credit_note_number && (
                              <div>
                                <span className="text-slate-500">{t('credit_note') || 'Credit Note'}:</span>
                                <span className="ml-1 font-mono">{ret.credit_note_number}</span>
                              </div>
                            )}
                            {ret.tracking_number && (
                              <div>
                                <span className="text-slate-500">{t('tracking') || 'Tracking'}:</span>
                                <span className="ml-1 font-mono">{ret.tracking_number}</span>
                              </div>
                            )}
                          </div>
                          {/* Returned Items */}
                          {ret.lines && ret.lines.length > 0 && (
                            <div className="mt-3 border-t border-red-100 pt-3">
                              <p className="text-xs text-slate-500 mb-2">{t('returned_items') || 'Returned Items'}:</p>
                              <div className="space-y-1">
                                {ret.lines.map((line, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm bg-white/50 px-2 py-1 rounded">
                                    <span className="font-medium">{line.product_name}</span>
                                    <span className="text-red-600 font-semibold">
                                      {line.return_quantity || line.quantity} {line.unit || t('pcs') || 'pcs'}
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

                {/* Notes */}
                {detailPO.notes && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-2">{t('notes') || 'Notes'}</h3>
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">{detailPO.notes}</p>
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
                      <Edit2 className="w-4 h-4 mr-2" />
                      {t('edit') || 'Edit'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
