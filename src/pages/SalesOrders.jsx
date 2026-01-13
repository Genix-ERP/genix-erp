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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, ShoppingBag, TrendingUp, Package, DollarSign, Truck, Brain, AlertTriangle,
  CheckCircle, Target, Lightbulb, FileText, Receipt, RotateCcw, Tag, BarChart3, Upload, Download, Eye, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { analyzeSales } from '@/api/services/aiAnalytics';

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
  const { salesOrders, createSalesOrder, updateSalesOrder, isLoading: ordersLoading } = useModules();
  const { customers } = useCustomers();
  const { quotations, invoices, returns, discounts, getAIInsights, isLoading: salesLoading } = useSales();

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
    { key: 'order_number', label: 'Buyurtma raqami' },
    { key: 'customer_name', label: 'Mijoz' },
    { key: 'order_date', label: 'Sana', render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'delivery_date', label: 'Yetkazish sanasi', render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'total_amount', label: 'Summa', render: (v) => `${(v || 0).toLocaleString()} UZS` },
    { key: 'status', label: 'Holat' },
    { key: 'payment_status', label: "To'lov holati" },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'customer_name', label: 'Mijoz', required: true },
    { key: 'order_date', label: 'Sana', required: true },
    { key: 'delivery_date', label: 'Yetkazish sanasi' },
    { key: 'subtotal', label: 'Summa', required: true },
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

  const generatePrintConfig = (order) => ({
    template: 'order',
    title: 'Sotuv buyurtmasi',
    documentNumber: order.order_number,
    documentDate: order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '',
    headerFields: [
      { label: 'Mijoz', value: order.customer_name },
      { label: 'Yetkazish sanasi', value: order.delivery_date ? format(new Date(order.delivery_date), 'dd.MM.yyyy') : '-' },
      { label: 'Holat', value: order.status },
      { label: "To'lov holati", value: order.payment_status },
    ],
    tableColumns: [
      { key: 'description', label: 'Tavsif' },
      { key: 'amount', label: 'Summa', align: 'right' },
    ],
    tableData: [
      { description: 'Asosiy summa', amount: `${(order.subtotal || 0).toLocaleString()} UZS` },
      { description: 'Soliq (12%)', amount: `${(order.tax_amount || 0).toLocaleString()} UZS` },
      { description: 'Yetkazib berish', amount: `${(order.shipping_cost || 0).toLocaleString()} UZS` },
    ],
    totals: [
      { label: 'Jami', value: `${(order.total_amount || 0).toLocaleString()} UZS`, bold: true },
    ],
  });

  // AI Analysis - combining both contexts
  const salesAnalysis = useMemo(() => analyzeSales(salesOrders, customers), [salesOrders, customers]);
  const aiInsights = getAIInsights;

  const [newOrder, setNewOrder] = useState({
    order_number: '',
    customer_name: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    subtotal: 0,
    tax_amount: 0,
    shipping_cost: 0,
    total_amount: 0
  });

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

  const handleCreateOrder = () => {
    const total = parseFloat(newOrder.subtotal) + parseFloat(newOrder.tax_amount) + parseFloat(newOrder.shipping_cost);
    createSalesOrder({
      ...newOrder,
      order_number: newOrder.order_number || `SO-${Date.now()}`,
      subtotal: parseFloat(newOrder.subtotal),
      tax_amount: parseFloat(newOrder.tax_amount),
      shipping_cost: parseFloat(newOrder.shipping_cost),
      total_amount: total,
      status: 'quotation',
      payment_status: 'unpaid'
    });
    setShowCreateModal(false);
    setNewOrder({
      order_number: '',
      customer_name: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: '',
      subtotal: 0,
      tax_amount: 0,
      shipping_cost: 0,
      total_amount: 0
    });
  };

  const handleUpdateStatus = (orderId, newStatus) => {
    updateSalesOrder(orderId, { status: newStatus });
  };

  const getStatusColor = (status) => {
    const colors = {
      quotation: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.quotation;
  };

  // Combined metrics from both contexts
  const metrics = useMemo(() => ({
    totalOrders: salesOrders.length,
    totalRevenue: salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    activeOrders: salesOrders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length,
    avgOrderValue: salesOrders.length > 0 ? salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / salesOrders.length : 0,
    totalQuotations: quotations.length,
    pendingQuotations: quotations.filter(q => q.status === 'sent').length,
    totalInvoices: invoices.length,
    unpaidInvoices: invoices.filter(i => i.payment_status !== 'paid').length,
    totalReturns: returns.length,
    pendingReturns: returns.filter(r => r.status === 'pending').length,
    activeDiscounts: discounts.filter(d => d.status === 'active').length,
  }), [salesOrders, quotations, invoices, returns, discounts]);

  const salesData = {};
  salesOrders.forEach(o => {
    const month = new Date(o.order_date).toLocaleDateString('en-US', { month: 'short' });
    salesData[month] = (salesData[month] || 0) + (o.total_amount || 0);
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
    return `${(amount || 0).toLocaleString()} so'm`;
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingBag className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Sotuvlar va CRM</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-white/90">Buyurtmalar, taklifnomalar, fakturalar va chegirmalarni AI yordamida boshqaring</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Buyurtmalar</p>
                  <p className="text-lg font-bold text-slate-900">{metrics.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Daromad</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(metrics.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Taklifnomalar</p>
                  <p className="text-lg font-bold text-slate-900">{metrics.totalQuotations}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Receipt className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">To'lanmagan</p>
                  <p className="text-lg font-bold text-slate-900">{metrics.unpaidInvoices}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <RotateCcw className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Qaytarishlar</p>
                  <p className="text-lg font-bold text-slate-900">{metrics.totalReturns}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Tag className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Faol chegirmalar</p>
                  <p className="text-lg font-bold text-slate-900">{metrics.activeDiscounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(salesAnalysis.insights.length > 0 || aiInsights.insights.length > 0 || aiInsights.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-emerald-600" />
                AI Sotuvlar Tahlili
                <Badge className="bg-emerald-100 text-emerald-700 text-xs">Jonli</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Sales Context Insights */}
                {aiInsights.insights.slice(0, 2).map((insight, index) => (
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
                        <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                        <p className="text-xs text-slate-600 mt-1">{insight.description}</p>
                        {insight.metric && (
                          <p className="text-lg font-bold text-emerald-600 mt-2">{insight.metric}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Top Customer from orders analysis */}
                {salesAnalysis.topCustomers.length > 0 && (
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-purple-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">Eng yaxshi mijoz</h4>
                        <p className="text-xs text-slate-600 mt-1">{salesAnalysis.topCustomers[0].name}</p>
                        <p className="text-lg font-bold text-purple-600 mt-2">
                          {formatCurrency(salesAnalysis.topCustomers[0].revenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {aiInsights.recommendations.length > 0 && (
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100 md:col-span-2 lg:col-span-3">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm">AI Tavsiyalari</h4>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {aiInsights.recommendations.slice(0, 4).map((rec, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs bg-slate-50 rounded-full px-3 py-1">
                              <span className={`w-2 h-2 rounded-full ${
                                rec.impact === 'high' ? 'bg-red-400' : rec.impact === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                              }`} />
                              <span className="text-slate-700">{rec.action}</span>
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
          <TabsList className="bg-white/80 p-1 rounded-xl shadow-sm border">
            <TabsTrigger value="orders" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Buyurtmalar
              {tabCounts.orders > 0 && (
                <Badge className="ml-2 bg-green-100 text-green-800">{tabCounts.orders}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quotations" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4">
              <FileText className="w-4 h-4 mr-2" />
              Taklifnomalar
              {tabCounts.quotations > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">{tabCounts.quotations}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4">
              <Receipt className="w-4 h-4 mr-2" />
              Fakturalar
              {tabCounts.invoices > 0 && (
                <Badge className="ml-2 bg-yellow-100 text-yellow-800">{tabCounts.invoices}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="returns" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4">
              <RotateCcw className="w-4 h-4 mr-2" />
              Qaytarishlar
              {tabCounts.returns > 0 && (
                <Badge className="ml-2 bg-red-100 text-red-800">{tabCounts.returns}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="discounts" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4">
              <Tag className="w-4 h-4 mr-2" />
              Chegirmalar
              {tabCounts.discounts > 0 && (
                <Badge className="ml-2 bg-emerald-100 text-emerald-800">{tabCounts.discounts}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg px-4">
              <BarChart3 className="w-4 h-4 mr-2" />
              Tahlil
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sales Trend Chart */}
              {chartData.length > 0 && (
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Sotuvlar trendi</CardTitle>
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
                    <CardTitle className="text-lg">Buyurtmalar</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <ImportExportButtons
                        onImport={() => setShowImportModal(true)}
                        onExport={() => setShowExportModal(true)}
                      />
                      <Button variant="outline" size="sm" onClick={() => setShowBatchPrint(true)} disabled={filteredOrders.length === 0}>
                        <Printer className="w-4 h-4 mr-1" />
                        Chop etish
                      </Button>
                      <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-green-600 to-emerald-600">
                        <Plus className="w-4 h-4 mr-2" /> Yangi buyurtma
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Qidirish..."
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
                        <SelectItem value="all">Barchasi</SelectItem>
                        <SelectItem value="quotation">Taklif</SelectItem>
                        <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
                        <SelectItem value="processing">Jarayonda</SelectItem>
                        <SelectItem value="shipped">Yetkazilmoqda</SelectItem>
                        <SelectItem value="delivered">Yetkazildi</SelectItem>
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
                      <p className="text-slate-500">Buyurtmalar topilmadi</p>
                      <Button onClick={() => setShowCreateModal(true)} className="mt-4">Birinchi buyurtmani yarating</Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Buyurtma №</TableHead>
                            <TableHead>Mijoz</TableHead>
                            <TableHead>Sana</TableHead>
                            <TableHead>Summa</TableHead>
                            <TableHead>Holat</TableHead>
                            <TableHead>Amallar</TableHead>
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
                                <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {order.status === 'quotation' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'confirmed')}>
                                      Tasdiqlash
                                    </Button>
                                  )}
                                  {order.status === 'confirmed' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'processing')}>
                                      Jarayonga
                                    </Button>
                                  )}
                                  {order.status === 'processing' && (
                                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'shipped')}>
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
                    Oylik daromad
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
                    Sotuvlar ko'rsatkichlari
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">O'rtacha buyurtma qiymati</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.avgOrderValue)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">Konversiya darajasi</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {aiInsights.metrics?.conversionRate?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">Qaytarish darajasi</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {aiInsights.metrics?.returnRate?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">To'lanmagan summa</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(aiInsights.metrics?.totalOutstanding || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Top Customers */}
                  {salesAnalysis.topCustomers.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium text-slate-900 mb-3">Top mijozlar</h4>
                      <div className="space-y-2">
                        {salesAnalysis.topCustomers.slice(0, 5).map((customer, index) => (
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
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Yangi buyurtma yaratish</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Buyurtma raqami</label>
                  <Input
                    placeholder="Avtomatik"
                    value={newOrder.order_number}
                    onChange={(e) => setNewOrder({...newOrder, order_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Mijoz *</label>
                  <Input
                    placeholder="Mijoz nomi"
                    value={newOrder.customer_name}
                    onChange={(e) => setNewOrder({...newOrder, customer_name: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Buyurtma sanasi *</label>
                  <Input
                    type="date"
                    value={newOrder.order_date}
                    onChange={(e) => setNewOrder({...newOrder, order_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Yetkazish sanasi</label>
                  <Input
                    type="date"
                    value={newOrder.delivery_date}
                    onChange={(e) => setNewOrder({...newOrder, delivery_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Summa *</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newOrder.subtotal}
                    onChange={(e) => setNewOrder({...newOrder, subtotal: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Soliq</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newOrder.tax_amount}
                    onChange={(e) => setNewOrder({...newOrder, tax_amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Yetkazish</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newOrder.shipping_cost}
                    onChange={(e) => setNewOrder({...newOrder, shipping_cost: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">Jami summa</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(parseFloat(newOrder.subtotal || 0) + parseFloat(newOrder.tax_amount || 0) + parseFloat(newOrder.shipping_cost || 0))}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Bekor qilish
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
                  disabled={!newOrder.customer_name || !newOrder.subtotal}
                >
                  Yaratish
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
          entityName="Sotuv buyurtmasi"
        />

        {/* Export Modal */}
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          data={filteredOrders}
          columns={exportColumns}
          entityName="Sotuv_buyurtmalari"
          title="Sotuv buyurtmalari"
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
          entityName="Buyurtma"
        />

      </div>
    </div>
  );
}
