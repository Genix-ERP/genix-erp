import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import {
  Plus, Search, ShoppingBag, TrendingUp, Package, DollarSign, Truck,
  CheckCircle, FileText, Receipt, RotateCcw, Tag, BarChart3, Upload, Download, Eye, Printer, Trash2, X,
  LayoutDashboard, Building2, Edit, ToggleLeft, ToggleRight, MessageSquareWarning
} from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { salesService } from '@/api/services/sales';
import { inventoryService } from '@/api/services/inventory';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";

// Import sales components
import Quotations from '@/components/sales/Quotations';
import Invoices from '@/components/sales/Invoices';
import Returns from '@/components/sales/Returns';
import Discounts from '@/components/sales/Discounts';
import DeliveryOrders from '@/components/sales/DeliveryOrders';

// Import universal ERP components
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  PrintPreviewModal,
  BatchPrintModal,
  useAuditTrail,
} from '@/components/shared';

export default function SalesOrders() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { salesOrders = [], createSalesOrder, updateSalesOrder, isLoading: ordersLoading, refreshData: refreshModulesData } = useModules();
  const { customers = [] } = useCustomers();
  const {
    quotations = [],
    invoices = [],
    returns = [],
    discounts = [],
    isLoading: salesLoading,
    confirmSalesOrder,
    createInvoiceFromOrder,
    refreshData: refreshSalesData
  } = useSales();

  const [activeTab, setActiveTab] = useState("dashboard");
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

  // Carrier state
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [newCarrier, setNewCarrier] = useState({
    code: '',
    name: '',
    tracking_url: '',
    phone: '',
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
    { key: 'total_amount', label: t('amount'), render: (v) => `${(v || 0).toLocaleString()} UZS` },
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
          unit_price: `${(line.unit_price || 0).toLocaleString()} UZS`,
          total: `${((line.quantity || 0) * (line.unit_price || 0)).toLocaleString()} UZS`,
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
        { label: t('subtotal'), value: `${(order.subtotal || 0).toLocaleString()} UZS` },
        { label: t('tax'), value: `${(order.tax_amount || 0).toLocaleString()} UZS` },
        { label: t('shipping'), value: `${(order.shipping_amount || order.shipping_cost || 0).toLocaleString()} UZS` },
        { label: t('total'), value: `${(order.total_amount || 0).toLocaleString()} UZS`, bold: true },
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
    lines: [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }],
    subtotal: 0,
    tax_percent: 0,
    tax_amount: 0,
    shipping_cost: 0,
    total_amount: 0
  });
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Products list for selection
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Warehouses list for selection
  const [warehouses, setWarehouses] = useState([]);

  // Carriers list for selection
  const [carriers, setCarriers] = useState([]);

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
        setProducts(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setProductsLoading(false);
      }
    };
    const fetchWarehouses = async () => {
      try {
        const data = await inventoryService.listWarehouses({ limit: 100 });
        setWarehouses(Array.isArray(data) ? data : data?.items || []);
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

  const handleLineChange = (order, setOrder, index, field, value, isManualDelivery) => {
    const newLines = [...order.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If changing product selection, also update lead_time_days and recalculate delivery date
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        newLines[index] = {
          ...newLines[index],
          product_name: selectedProduct.name,
          product_id: selectedProduct.id,
          unit_price: selectedProduct.list_price || selectedProduct.cost_price || 0,
          lead_time_days: selectedProduct.lead_time_days || 0,
          product: selectedProduct
        };

        // Recalculate delivery date if not manually set
        if (!isManualDelivery) {
          const newDeliveryDate = calculateDeliveryDate(newLines, order.order_date);
          setOrder({ ...order, lines: newLines, delivery_date: newDeliveryDate });
          return;
        }
      }
    }

    setOrder({ ...order, lines: newLines });
  };

  const handleCreateOrder = async () => {
    const subtotal = calculateOrderTotals(newOrder.lines);
    const taxPercent = parseFloat(newOrder.tax_percent) || 0;
    const taxAmount = subtotal * (taxPercent / 100);
    const shippingCost = parseFloat(newOrder.shipping_cost) || 0;
    const total = subtotal + taxAmount + shippingCost;

    // Filter and format lines - only include lines with valid product_id
    const validLines = newOrder.lines
      .filter(line => line.product_id && line.product_id.trim() !== '')
      .map(line => ({
        product_id: line.product_id,
        description: line.description || line.product_name || '',
        quantity: parseFloat(line.quantity) || 1,
        unit_price: parseFloat(line.unit_price) || 0,
      }));

    // Check if customer_id is a valid UUID (backend requires UUID format)
    const isValidUUID = (str) => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    const orderData = {
      order_number: newOrder.order_number || '',
      customer_name: newOrder.customer_name,
      // Only send customer_id if it's a valid UUID, otherwise backend will use customer_name
      ...(isValidUUID(newOrder.customer_id) && { customer_id: newOrder.customer_id }),
      order_date: newOrder.order_date,
      delivery_date: newOrder.delivery_date,
      expected_date: newOrder.delivery_date, // Backend uses expected_date
      warehouse_id: newOrder.warehouse_id || undefined,
      carrier: newOrder.carrier || undefined,
      subtotal,
      tax_amount: taxAmount,
      shipping_amount: shippingCost,
      shipping_cost: shippingCost,
      total_amount: total,
      status: 'draft',
      payment_status: 'unpaid',
      lines: validLines.length > 0 ? validLines : undefined, // Only send lines if valid
    };

    console.log('Creating sales order with data:', orderData);

    try {
      await createSalesOrder(orderData);
      setShowCreateModal(false);
      resetOrderForm();
      addAuditLog('create', 'new', orderData.order_number || `SO-${Date.now()}`);
    } catch (error) {
      console.error('Error creating sales order:', error);
      console.error('Error response:', error.response?.data);
      console.error('Order data sent:', orderData);
      // You could add a toast notification here
    }
  };

  const handleEditOrder = async () => {
    const subtotal = calculateOrderTotals(editingOrder.lines);
    const taxPercent = parseFloat(editingOrder.tax_percent) || 0;
    const taxAmount = subtotal * (taxPercent / 100);
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

  const handleDeleteOrder = () => {
    if (orderToDelete) {
      // Since we don't have a delete function in the context, we'll need to update the status to cancelled
      updateSalesOrder(orderToDelete.id, { status: 'cancelled' });
      addAuditLog('delete', orderToDelete.id, orderToDelete.order_number);
      setShowDeleteDialog(false);
      setOrderToDelete(null);
    }
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
      warehouse_id: '',
      carrier: '',
      lines: [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }],
      subtotal: 0,
      tax_percent: 0,
      tax_amount: 0,
      shipping_cost: 0,
      total_amount: 0
    });
    setIsDeliveryDateManual(false);
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      if (newStatus === 'confirmed') {
        // Use the confirm endpoint which creates delivery order
        await confirmSalesOrder(orderId);
        // Refresh to get updated data
        if (refreshSalesData) refreshSalesData();
        if (refreshModulesData) refreshModulesData();
      } else {
        await updateSalesOrder(orderId, { status: newStatus });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleCreateInvoice = async (orderId) => {
    try {
      await createInvoiceFromOrder(orderId);
      // Refresh to get updated invoices
      if (refreshSalesData) refreshSalesData();
      // Switch to invoices tab to show the new invoice
      setActiveTab('invoices');
    } catch (error) {
      console.error('Failed to create invoice:', error);
      alert(t('error_creating_invoice') || 'Failed to create invoice');
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
      alert(t('error_creating_carrier') || 'Failed to create carrier');
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
      alert(t('error_updating_carrier') || 'Failed to update carrier');
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
      alert(t('error_deleting_carrier') || 'Failed to delete carrier');
    }
  };

  const resetCarrierForm = () => {
    setNewCarrier({
      code: '',
      name: '',
      tracking_url: '',
      phone: '',
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

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString()} ${t('currency_symbol')}`;
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
            <TabsTrigger value="returns" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">{t('returns')}</span>
              {tabCounts.returns > 0 && (
                <Badge className="ml-2 bg-red-100 text-red-800">{tabCounts.returns}</Badge>
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
            <TabsTrigger value="analytics" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('analytics')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab - Stats */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      <p className="text-lg font-bold text-slate-900 truncate">{formatCurrency(metrics.totalRevenue)}</p>
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
                      <YAxis fontSize={12} />
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

            {/* Orders Table */}
            <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg">{t('orders')}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <ImportExportButtons
                        onImport={() => setShowImportModal(true)}
                        onExport={() => setShowExportModal(true)}
                      />
                      <Button variant="outline" size="sm" onClick={() => setShowBatchPrint(true)} disabled={filteredOrders.length === 0}>
                        <Printer className="w-4 h-4 mr-1" />
                        {t('print')}
                      </Button>
                      {canCreate(MODULES.SALES) && (
                        <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                          <Plus className="w-4 h-4 mr-2" /> {t('new_order')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder={t('search') + '...'}
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
                        <SelectItem value="all">{t('all')}</SelectItem>
                        <SelectItem value="quotation">{t('quotation')}</SelectItem>
                        <SelectItem value="confirmed">{t('confirmed')}</SelectItem>
                        <SelectItem value="processing">{t('processing')}</SelectItem>
                        <SelectItem value="shipped">{t('shipped')}</SelectItem>
                        <SelectItem value="delivered">{t('delivered')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {ordersLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">{t('no_orders_found')}</p>
                      {canCreate(MODULES.SALES) && (
                        <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('create_first_order')}</Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>{t('order_number')}</TableHead>
                            <TableHead>{t('customer')}</TableHead>
                            <TableHead>{t('date')}</TableHead>
                            <TableHead>{t('amount')}</TableHead>
                            <TableHead>{t('status')}</TableHead>
                            <TableHead>{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrders.map((order) => (
                            <TableRow key={order.id} className="hover:bg-slate-50">
                              <TableCell className="font-mono text-sm">
                                <div className="flex items-center gap-2">
                                  {order.order_number}
                                  {orderHasReturns(order.id) && (
                                    <MessageSquareWarning className="w-4 h-4 text-red-500" title={t('has_returns') || 'Has Returns'} />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{order.customer_name}</TableCell>
                              <TableCell className="text-sm">
                                {order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '-'}
                              </TableCell>
                              <TableCell className="font-semibold">{formatCurrency(order.total_amount)}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(order.status)}>{t(order.status)}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {canUpdate(MODULES.SALES) && (order.status === 'draft' || order.status === 'quotation') && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'confirmed')} title={t('confirm')}>
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {canUpdate(MODULES.SALES) && order.status === 'confirmed' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'processing')} title={t('to_processing')}>
                                      <Package className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {canUpdate(MODULES.SALES) && order.status === 'processing' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'shipped')} title={t('ship')}>
                                      <Truck className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {canCreate(MODULES.SALES) && ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) && !orderHasInvoice(order.id) && (
                                    <Button size="sm" variant="ghost" onClick={() => handleCreateInvoice(order.id)} title={t('create_invoice') || 'Create Invoice'}>
                                      <Receipt className="w-4 h-4 text-green-600" />
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => handleViewOrder(order)} title={t('view')}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handlePrintOrder(order)} title={t('print')}>
                                    <Printer className="w-4 h-4" />
                                  </Button>
                                  {canUpdate(MODULES.SALES) && (order.status === 'draft' || order.status === 'quotation') && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        try {
                                          // Fetch full order details including lines
                                          const fullOrder = await salesService.getOrder(order.id);
                                          setEditingOrder({
                                            ...fullOrder,
                                            delivery_date: fullOrder.expected_date || fullOrder.delivery_date || '',
                                            shipping_cost: fullOrder.shipping_amount || fullOrder.shipping_cost || 0,
                                            lines: fullOrder.lines || [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '' }]
                                          });
                                        } catch (error) {
                                          console.error('Failed to fetch order details:', error);
                                          // Fallback to list data
                                          setEditingOrder({...order, lines: order.lines || [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '' }]});
                                        }
                                        setShowEditModal(true);
                                      }}
                                      title={t('edit')}
                                    >
                                      <FileText className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {canDelete(MODULES.SALES) && order.status !== 'cancelled' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => { setOrderToDelete(order); setShowDeleteDialog(true); }}
                                      title={t('delete')}
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
                    </div>
                  )}
                </CardContent>
              </Card>
          </TabsContent>

          {/* Quotations Tab */}
          <TabsContent value="quotations">
            <Quotations />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Invoices />
          </TabsContent>

          {/* Returns Tab */}
          <TabsContent value="returns">
            <Returns />
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Chart */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    {t('monthly_revenue')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Sales Metrics */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    {t('sales_metrics')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">{t('average_order_value')}</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.avgOrderValue)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">{t('total_orders')}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.totalOrders}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">{t('returns')}</p>
                      <p className="text-2xl font-bold text-slate-900">{metrics.totalReturns}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">{t('unpaid_invoices')}</p>
                      <p className="text-2xl font-bold text-red-600">{metrics.unpaidInvoices}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Order Modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => { setShowCreateModal(open); if (!open) resetOrderForm(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('create_new_order')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('order_number')}</Label>
                  <Input
                    placeholder={t('automatic')}
                    value={newOrder.order_number}
                    onChange={(e) => setNewOrder({...newOrder, order_number: e.target.value})}
                  />
                </div>
                <div>
                  <Label>{t('customer')} *</Label>
                  <Select
                    value={newOrder.customer_id || ''}
                    onValueChange={(value) => {
                      const customer = customers.find(c => c.id === value);
                      setNewOrder({
                        ...newOrder,
                        customer_id: value,
                        customer_name: customer?.company_name || customer?.name || ''
                      });
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
              </div>

              {/* Order Lines */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-semibold">{t('order_items')}</Label>
                  <Button size="sm" variant="outline" onClick={() => handleAddLine(newOrder, setNewOrder, isDeliveryDateManual, setIsDeliveryDateManual)}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_line')}
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {newOrder.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start bg-slate-50 p-3 rounded">
                      <div className="col-span-4">
                        <Select
                          value={line.product_id || ''}
                          onValueChange={(value) => handleLineChange(newOrder, setNewOrder, index, 'product_id', value, isDeliveryDateManual)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('select_product')} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} {product.lead_time_days > 0 && `(${product.lead_time_days} ${t('days') || 'days'})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder={t('quantity')}
                          value={line.quantity}
                          onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'quantity', e.target.value, isDeliveryDateManual)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder={t('price')}
                          value={line.unit_price}
                          onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'unit_price', e.target.value, isDeliveryDateManual)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          placeholder={t('description')}
                          value={line.description}
                          onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'description', e.target.value, isDeliveryDateManual)}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLine(newOrder, setNewOrder, index, isDeliveryDateManual)}
                          disabled={newOrder.lines.length === 1}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax and Shipping */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label>{t('tax')} (%)</Label>
                  <Input
                    type="number"
                    placeholder="12"
                    value={newOrder.tax_percent}
                    onChange={(e) => setNewOrder({...newOrder, tax_percent: e.target.value})}
                  />
                </div>
                <div>
                  <Label>{t('shipping')}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newOrder.shipping_cost}
                    onChange={(e) => setNewOrder({...newOrder, shipping_cost: e.target.value})}
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="space-y-2">
                  {(() => {
                    const subtotal = calculateOrderTotals(newOrder.lines);
                    const taxPercent = parseFloat(newOrder.tax_percent) || 0;
                    const taxAmount = subtotal * (taxPercent / 100);
                    const shippingCost = parseFloat(newOrder.shipping_cost) || 0;
                    const total = subtotal + taxAmount + shippingCost;
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('subtotal')}:</span>
                          <span className="font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('tax')}:</span>
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
                </div>

                {selectedOrder.lines && selectedOrder.lines.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">{t('order_items') || 'Order Items'}</p>
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      {selectedOrder.lines.map((line, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                          <div>
                            <span className="font-medium">{line.description || line.product_name || 'Product'}</span>
                            <p className="text-xs text-slate-500">{t('quantity')}: {line.quantity}</p>
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editingOrder.lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start bg-slate-50 p-3 rounded">
                        <div className="col-span-4">
                          <Select
                            value={line.product_id || ''}
                            onValueChange={(value) => handleLineChange(editingOrder, setEditingOrder, index, 'product_id', value, isEditDeliveryDateManual)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={line.product_name || t('select_product')} />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} {product.lead_time_days > 0 && `(${product.lead_time_days} ${t('days') || 'days'})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder={t('quantity')}
                            value={line.quantity}
                            onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'quantity', e.target.value, isEditDeliveryDateManual)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder={t('price')}
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'unit_price', e.target.value, isEditDeliveryDateManual)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            placeholder={t('description')}
                            value={line.description || ''}
                            onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'description', e.target.value, isEditDeliveryDateManual)}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLine(editingOrder, setEditingOrder, index, isEditDeliveryDateManual)}
                            disabled={editingOrder.lines.length === 1}
                            className="text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tax and Shipping */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <Label>{t('tax')} (%)</Label>
                    <Input
                      type="number"
                      value={editingOrder.tax_percent || 0}
                      onChange={(e) => setEditingOrder({...editingOrder, tax_percent: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>{t('shipping')}</Label>
                    <Input
                      type="number"
                      value={editingOrder.shipping_cost || 0}
                      onChange={(e) => setEditingOrder({...editingOrder, shipping_cost: e.target.value})}
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    {(() => {
                      const subtotal = calculateOrderTotals(editingOrder.lines);
                      const taxPercent = parseFloat(editingOrder.tax_percent) || 0;
                      const taxAmount = subtotal * (taxPercent / 100);
                      const shippingCost = parseFloat(editingOrder.shipping_cost) || 0;
                      const total = subtotal + taxAmount + shippingCost;
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('subtotal')}:</span>
                            <span className="font-medium">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('tax')}:</span>
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
                    placeholder="+1 234 567 890"
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
