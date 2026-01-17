import React, { useState, useEffect, useMemo } from 'react';
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
  Plus, Search, ShoppingBag, TrendingUp, Package, DollarSign, Truck, Brain, AlertTriangle,
  CheckCircle, Target, Lightbulb, FileText, Receipt, RotateCcw, Tag, BarChart3, Upload, Download, Eye, Printer, Trash2, X
} from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { analyzeSales } from '@/api/services/aiAnalytics';
import { salesService } from '@/api/services/sales';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// Import sales components
import Quotations from '@/components/sales/Quotations';
import Invoices from '@/components/sales/Invoices';
import Returns from '@/components/sales/Returns';
import Discounts from '@/components/sales/Discounts';

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
  const { salesOrders = [], createSalesOrder, updateSalesOrder, isLoading: ordersLoading } = useModules();
  const { customers = [] } = useCustomers();
  const {
    quotations = [],
    invoices = [],
    returns = [],
    discounts = [],
    getAIInsights,
    isLoading: salesLoading
  } = useSales();

  const [activeTab, setActiveTab] = useState("orders");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { addAuditLog } = useAuditTrail('sales_orders');

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

  // AI Analysis - combining both contexts
  const salesAnalysis = useMemo(() => {
    try {
      return analyzeSales(salesOrders, customers, language) || {
        insights: [],
        recommendations: [],
        topCustomers: [],
        metrics: {}
      };
    } catch (error) {
      console.error('Error analyzing sales:', error);
      return {
        insights: [],
        recommendations: [],
        topCustomers: [],
        metrics: {}
      };
    }
  }, [salesOrders, customers, language]);
  const aiInsights = getAIInsights || { insights: [], recommendations: [], metrics: {} };

  const [newOrder, setNewOrder] = useState({
    order_number: '',
    customer_name: '',
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    lines: [{ product_name: '', quantity: 1, unit_price: 0, description: '' }],
    subtotal: 0,
    tax_amount: 0,
    shipping_cost: 0,
    total_amount: 0
  });
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

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

  const handleAddLine = (order, setOrder) => {
    setOrder({
      ...order,
      lines: [...order.lines, { product_name: '', quantity: 1, unit_price: 0, description: '' }]
    });
  };

  const handleRemoveLine = (order, setOrder, index) => {
    const newLines = order.lines.filter((_, i) => i !== index);
    setOrder({ ...order, lines: newLines.length > 0 ? newLines : [{ product_name: '', quantity: 1, unit_price: 0, description: '' }] });
  };

  const handleLineChange = (order, setOrder, index, field, value) => {
    const newLines = [...order.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setOrder({ ...order, lines: newLines });
  };

  const handleCreateOrder = () => {
    const subtotal = calculateOrderTotals(newOrder.lines);
    const taxAmount = parseFloat(newOrder.tax_amount) || 0;
    const shippingCost = parseFloat(newOrder.shipping_cost) || 0;
    const total = subtotal + taxAmount + shippingCost;

    createSalesOrder({
      ...newOrder,
      order_number: newOrder.order_number || `SO-${Date.now()}`,
      subtotal,
      tax_amount: taxAmount,
      shipping_cost: shippingCost,
      total_amount: total,
      status: 'quotation',
      payment_status: 'unpaid'
    });
    setShowCreateModal(false);
    resetOrderForm();
    addAuditLog('create', 'new', newOrder.order_number || `SO-${Date.now()}`);
  };

  const handleEditOrder = () => {
    const subtotal = calculateOrderTotals(editingOrder.lines);
    const taxAmount = parseFloat(editingOrder.tax_amount) || 0;
    const shippingCost = parseFloat(editingOrder.shipping_cost) || 0;
    const total = subtotal + taxAmount + shippingCost;

    updateSalesOrder(editingOrder.id, {
      ...editingOrder,
      subtotal,
      tax_amount: taxAmount,
      shipping_cost: shippingCost,
      total_amount: total
    });
    setShowEditModal(false);
    setEditingOrder(null);
    addAuditLog('update', editingOrder.id, editingOrder.order_number);
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
      delivery_date: '',
      lines: [{ product_name: '', quantity: 1, unit_price: 0, description: '' }],
      subtotal: 0,
      tax_amount: 0,
      shipping_cost: 0,
      total_amount: 0
    });
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateSalesOrder(orderId, { status: newStatus });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleViewOrder = async (order) => {
    try {
      // Fetch full order details including lines
      const fullOrder = await salesService.getOrder(order.id);
      setSelectedOrder(fullOrder);
      setShowPrintPreview(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      // Fallback to using the list order data
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
        const month = new Date(o.order_date).toLocaleDateString('en-US', { month: 'short' });
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
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 md:p-8 rounded-2xl text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <ShoppingBag className="w-8 h-8" />
              <h1 className="text-2xl md:text-3xl font-bold">{t('sales_and_crm')}</h1>
              <Badge className="bg-white/20 text-white border-white/30">
                <Brain className="w-3 h-3 mr-1" />
                {t('ai_powered') || 'AI-Powered'}
              </Badge>
            </div>
            <p className="text-white/90 text-base md:text-lg">
              {t('sales_description')}
            </p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Tag className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('active_discounts')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.activeDiscounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {((salesAnalysis?.insights?.length > 0) || (aiInsights?.insights?.length > 0) || (aiInsights?.recommendations?.length > 0)) && (
          <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-emerald-600" />
                {t('ai_sales_analysis')}
                <Badge className="bg-emerald-100 text-emerald-700 text-xs">{t('live')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Sales Context Insights */}
                {(aiInsights?.insights || []).slice(0, 2).map((insight, index) => (
                  <div key={`sales-${index}`} className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100">
                    <div className="flex items-start gap-3">
                      {insight.type === 'positive' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : insight.type === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">
                          {insight.titleKey ? t(insight.titleKey) : insight.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1">
                          {insight.descriptionKey ? t(insight.descriptionKey) : insight.description}
                        </p>
                        {insight.metric && (
                          <p className="text-lg font-bold text-emerald-600 mt-2">
                            {typeof insight.metric === 'number' ? formatCurrency(insight.metric) : insight.metric}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Top Customer from orders analysis */}
                {salesAnalysis?.topCustomers?.length > 0 && (
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-purple-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">{t('top_customer')}</h4>
                        <p className="text-xs text-slate-600 mt-1">{salesAnalysis.topCustomers[0].name}</p>
                        <p className="text-lg font-bold text-purple-600 mt-2">
                          {formatCurrency(salesAnalysis.topCustomers[0].revenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {aiInsights?.recommendations?.length > 0 && (
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100 md:col-span-2 lg:col-span-3">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm">{t('ai_recommendations')}</h4>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {(aiInsights?.recommendations || []).slice(0, 4).map((rec, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs bg-slate-50 rounded-full px-3 py-1">
                              <span className={`w-2 h-2 rounded-full ${
                                rec.impact === 'high' ? 'bg-red-400' : rec.impact === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                              }`} />
                              <span className="text-slate-700">
                                {rec.actionKey ? t(rec.actionKey) : rec.action}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="orders" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">{t('orders')}</span>
              {tabCounts.orders > 0 && (
                <Badge className="ml-2 bg-green-100 text-green-800">{tabCounts.orders}</Badge>
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
                <Badge className="ml-2 bg-emerald-100 text-emerald-800">{tabCounts.discounts}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('analytics')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

              {/* Orders Table */}
              <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm">
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
                      <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-green-600 to-emerald-600">
                        <Plus className="w-4 h-4 mr-2" /> {t('new_order')}
                      </Button>
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
                      <SelectTrigger className="w-[150px]">
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
                      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">{t('no_orders_found')}</p>
                      <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('create_first_order')}</Button>
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
                              <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
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
                                  {(order.status === 'draft' || order.status === 'quotation') && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'confirmed')} title={t('confirm')}>
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {order.status === 'confirmed' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'processing')} title={t('to_processing')}>
                                      <Package className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {order.status === 'processing' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'shipped')} title={t('ship')}>
                                      <Truck className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => handleViewOrder(order)} title={t('view')}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  {(order.status === 'draft' || order.status === 'quotation') && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingOrder({...order, lines: order.lines || [{ product_name: '', quantity: 1, unit_price: 0, description: '' }]});
                                        setShowEditModal(true);
                                      }}
                                      title={t('edit')}
                                    >
                                      <FileText className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {order.status !== 'cancelled' && (
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
            </div>
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
                      <p className="text-sm text-slate-600">{t('conversion_rate')}</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {aiInsights.metrics?.conversionRate?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">{t('return_rate')}</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {aiInsights.metrics?.returnRate?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">{t('outstanding_amount')}</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(aiInsights.metrics?.totalOutstanding || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Top Customers */}
                  {salesAnalysis?.topCustomers?.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium text-slate-900 mb-3">{t('top_customers')}</h4>
                      <div className="space-y-2">
                        {(salesAnalysis?.topCustomers || []).slice(0, 5).map((customer, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                            <span className="text-sm">{customer.name}</span>
                            <span className="font-medium text-green-600">{formatCurrency(customer.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    value={newOrder.customer_name}
                    onValueChange={(value) => {
                      const customer = customers.find(c => c.company_name === value);
                      setNewOrder({...newOrder, customer_name: value, customer_id: customer?.id || ''});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_customer')} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.company_name}>
                          {customer.company_name}
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
                  <Label>{t('delivery_date')}</Label>
                  <Input
                    type="date"
                    value={newOrder.delivery_date}
                    onChange={(e) => setNewOrder({...newOrder, delivery_date: e.target.value})}
                  />
                </div>
              </div>

              {/* Order Lines */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-semibold">{t('order_items')}</Label>
                  <Button size="sm" variant="outline" onClick={() => handleAddLine(newOrder, setNewOrder)}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_line')}
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {newOrder.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start bg-slate-50 p-3 rounded">
                      <div className="col-span-4">
                        <Input
                          placeholder={t('product_name')}
                          value={line.product_name}
                          onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'product_name', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder={t('quantity')}
                          value={line.quantity}
                          onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'quantity', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder={t('price')}
                          value={line.unit_price}
                          onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'unit_price', e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          placeholder={t('description')}
                          value={line.description}
                          onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'description', e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLine(newOrder, setNewOrder, index)}
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
                    value={newOrder.tax_amount}
                    onChange={(e) => setNewOrder({...newOrder, tax_amount: e.target.value})}
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
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t('subtotal')}:</span>
                    <span className="font-medium">{formatCurrency(calculateOrderTotals(newOrder.lines))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t('tax')}:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(newOrder.tax_amount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t('shipping')}:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(newOrder.shipping_cost || 0))}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-green-300">
                    <span className="font-semibold text-lg">{t('total_amount')}:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(calculateOrderTotals(newOrder.lines) + parseFloat(newOrder.tax_amount || 0) + parseFloat(newOrder.shipping_cost || 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); resetOrderForm(); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
                  disabled={!newOrder.customer_name || newOrder.lines.every(l => !l.product_name)}
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
          <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) setEditingOrder(null); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('edit_order')} - {editingOrder.order_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('customer')} *</Label>
                    <Select
                      value={editingOrder.customer_name}
                      onValueChange={(value) => {
                        const customer = customers.find(c => c.company_name === value);
                        setEditingOrder({...editingOrder, customer_name: value, customer_id: customer?.id || ''});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.company_name}>
                            {customer.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('delivery_date')}</Label>
                    <Input
                      type="date"
                      value={editingOrder.delivery_date || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, delivery_date: e.target.value})}
                    />
                  </div>
                </div>

                {/* Order Lines */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-semibold">{t('order_items')}</Label>
                    <Button size="sm" variant="outline" onClick={() => handleAddLine(editingOrder, setEditingOrder)}>
                      <Plus className="w-4 h-4 mr-1" /> {t('add_line')}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editingOrder.lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start bg-slate-50 p-3 rounded">
                        <div className="col-span-4">
                          <Input
                            placeholder={t('product_name')}
                            value={line.product_name}
                            onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'product_name', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder={t('quantity')}
                            value={line.quantity}
                            onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder={t('price')}
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'unit_price', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            placeholder={t('description')}
                            value={line.description || ''}
                            onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'description', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLine(editingOrder, setEditingOrder, index)}
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
                      value={editingOrder.tax_amount || 0}
                      onChange={(e) => setEditingOrder({...editingOrder, tax_amount: e.target.value})}
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
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('subtotal')}:</span>
                      <span className="font-medium">{formatCurrency(calculateOrderTotals(editingOrder.lines))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('tax')}:</span>
                      <span className="font-medium">{formatCurrency(parseFloat(editingOrder.tax_amount || 0))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('shipping')}:</span>
                      <span className="font-medium">{formatCurrency(parseFloat(editingOrder.shipping_cost || 0))}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                      <span className="font-semibold text-lg">{t('total_amount')}:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(calculateOrderTotals(editingOrder.lines) + parseFloat(editingOrder.tax_amount || 0) + parseFloat(editingOrder.shipping_cost || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingOrder(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleEditOrder}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                    disabled={!editingOrder.customer_name || editingOrder.lines.every(l => !l.product_name)}
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

      </div>
    </div>
  );
}
