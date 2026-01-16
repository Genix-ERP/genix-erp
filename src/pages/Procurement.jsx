import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyzeProcurement } from '@/api/services/aiAnalytics';

import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

import Suppliers from '@/components/procurement/Suppliers';
import RFQManagement from '@/components/procurement/RFQManagement';
import Contracts from '@/components/procurement/Contracts';
import PriceHistory from '@/components/procurement/PriceHistory';
import PurchaseRequisitions from '@/components/procurement/PurchaseRequisitions';
import GoodsReceipt from '@/components/procurement/GoodsReceipt';
import PurchaseReturns from '@/components/procurement/PurchaseReturns';

export default function Procurement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
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
  const [editPO, setEditPO] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Analysis
  const procurementAnalysis = useMemo(() => analyzeProcurement(purchaseOrders), [purchaseOrders]);

  const [newPO, setNewPO] = useState({
    po_number: '',
    supplier_id: '',
    vendor_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    total_amount: 0,
    payment_terms: 'net_30'
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

  const handleCreatePO = async () => {
    if (!newPO.supplier_id && !newPO.vendor_name) return;

    setIsSubmitting(true);
    try {
      const supplier = getSupplierById(newPO.supplier_id);
      const poData = {
        ...newPO,
        po_number: newPO.po_number || `PO-${Date.now()}`,
        vendor_name: supplier?.name || newPO.vendor_name,
        total_amount: parseFloat(newPO.total_amount) || 0,
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
        expected_delivery_date: '',
        total_amount: 0,
        payment_terms: 'net_30'
      });
    } catch (error) {
      console.error('Error creating PO:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPO = (po, e) => {
    e.stopPropagation();
    setEditPO({
      ...po,
      total_amount: po.total_amount || 0
    });
    setShowEditModal(true);
  };

  const handleUpdatePO = async () => {
    if (!editPO || (!editPO.vendor_name && !editPO.supplier_name)) return;

    setIsSubmitting(true);
    try {
      const updates = {
        po_number: editPO.po_number,
        vendor_name: editPO.vendor_name || editPO.supplier_name,
        order_date: editPO.order_date,
        expected_delivery_date: editPO.expected_delivery_date,
        total_amount: parseFloat(editPO.total_amount) || 0,
        payment_terms: editPO.payment_terms,
        status: editPO.status
      };

      updatePurchaseOrder(editPO.id, updates);
      setShowEditModal(false);
      setEditPO(null);
    } catch (error) {
      console.error('Error updating PO:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePOStatus = (poId, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'received') {
      updates.actual_delivery_date = new Date().toISOString().split('T')[0];
    }
    updatePurchaseOrder(poId, updates);
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

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">{t('procurement_and_purchases') || 'Ta\'minot va Xaridlar'}</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              {t('ai_powered') || 'AI-Powered'}
            </Badge>
          </div>
          <p className="text-white/90">{t('procurement_subtitle') || 'Ta\'minotchilar, xarid buyurtmalari, shartnomalar va narxlarni boshqaring'}</p>
        </div>

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
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
                            <Badge className={getStatusColor(po.status)}>{po.status}</Badge>
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
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" /> {t('new_po') || 'New PO'}
                  </Button>
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
                    <SelectTrigger className="w-[150px]">
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
                    <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('create_first_po') || 'Create First PO'}</Button>
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
                            <TableCell className="font-mono text-sm">{po.po_number}</TableCell>
                            <TableCell className="font-medium">{po.supplier_name || po.vendor_name}</TableCell>
                            <TableCell className="text-sm">
                              {po.order_date ? format(new Date(po.order_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="font-semibold">{(po.total_amount || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(po.status)}>{po.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={(e) => handleEditPO(po, e)} title={t('edit') || 'Edit'}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                {po.status === 'draft' && (
                                  <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'sent')}>
                                    {t('send') || 'Send'}
                                  </Button>
                                )}
                                {po.status === 'sent' && (
                                  <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'confirmed')}>
                                    {t('confirm') || 'Confirm'}
                                  </Button>
                                )}
                                {po.status === 'confirmed' && (
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
        </Tabs>

        {/* Create PO Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
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
                      {suppliers.filter(s => s.status === 'active').map((supplier) => (
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
                  <label className="text-sm font-medium mb-1 block">{t('delivery_date') || 'Delivery Date'}</label>
                  <Input
                    type="date"
                    value={newPO.expected_delivery_date}
                    onChange={(e) => setNewPO({...newPO, expected_delivery_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('total_amount') || 'Total Amount'} *</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newPO.total_amount}
                    onChange={(e) => setNewPO({...newPO, total_amount: e.target.value})}
                    required
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
                  disabled={!newPO.supplier_id || !newPO.total_amount || isSubmitting}
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

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('status') || 'Status'}</label>
                  <Select value={editPO.status || 'draft'} onValueChange={(value) => setEditPO({...editPO, status: value})}>
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

      </div>
    </div>
  );
}
