import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Award,
  X,
  Eye,
  MessageSquareWarning,
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyzeProcurement } from '@/api/services/aiAnalytics';
import { formatAxisTick } from '@/utils/formatCurrency';

import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { procurementService } from '@/api/services/procurement';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

import Suppliers from '@/components/procurement/Suppliers';
import RFQManagement from '@/components/procurement/RFQManagement';
import Contracts from '@/components/procurement/Contracts';
import PriceHistory from '@/components/procurement/PriceHistory';
import PurchaseRequisitions from '@/components/procurement/PurchaseRequisitions';
import GoodsReceipt from '@/components/procurement/GoodsReceipt';
import PurchaseOrders from '@/components/procurement/PurchaseOrders';

export default function Procurement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
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

  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
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
  const procurementAnalysis = useMemo(() => analyzeProcurement(purchaseOrders, suppliers, language), [purchaseOrders, suppliers, language]);

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
                        {formatCurrencyCompact(metrics.totalValue)}
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
                    <Badge className="bg-indigo-100 text-indigo-700 text-xs">{t('live')}</Badge>
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
                        <YAxis fontSize={12} width={55} tickFormatter={formatAxisTick} />
                        <Tooltip formatter={(value) => [formatCurrency(value), t('amount') || 'Amount']} />
                        <Bar dataKey="value" name={t('amount') || 'Amount'} fill="#8b5cf6" radius={[8, 8, 0, 0]} />
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
                              {formatCurrencyCompact(po.total_amount || 0)}
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
            <PurchaseOrders />
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

        </Tabs>

      </div>
    </div>
  );
}
