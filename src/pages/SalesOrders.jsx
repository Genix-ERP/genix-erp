import React, { useState, useEffect, useMemo } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { useCustomers } from '@/components/contexts/CustomersContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ShoppingBag, TrendingUp, Package, DollarSign, Truck, Brain, AlertTriangle, CheckCircle, Target, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyzeSales } from '@/api/services/aiAnalytics';

export default function SalesOrders() {
  const { salesOrders, createSalesOrder, updateSalesOrder, isLoading } = useModules();
  const { customers } = useCustomers();
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // AI Analysis
  const salesAnalysis = useMemo(() => analyzeSales(salesOrders, customers), [salesOrders, customers]);

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

  const metrics = {
    totalOrders: salesOrders.length,
    totalRevenue: salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    activeOrders: salesOrders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length,
    avgOrderValue: salesOrders.length > 0 ? salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / salesOrders.length : 0
  };

  const salesData = {};
  salesOrders.forEach(o => {
    const month = new Date(o.order_date).toLocaleDateString('en-US', { month: 'short' });
    salesData[month] = (salesData[month] || 0) + (o.total_amount || 0);
  });
  const chartData = Object.entries(salesData).slice(-6).map(([month, revenue]) => ({ month, revenue }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingBag className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Sales Orders</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-white/90">Manage orders from quote to delivery with AI-powered insights</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalOrders}</p>
              <p className="text-sm text-slate-600">Total Orders</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalRevenue.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Total Revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.activeOrders}</p>
              <p className="text-sm text-slate-600">Active Orders</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.avgOrderValue.toFixed(0)}</p>
              <p className="text-sm text-slate-600">Avg Order Value</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(salesAnalysis.insights.length > 0 || salesAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-emerald-600" />
                AI Sales Insights
                <Badge className="bg-emerald-100 text-emerald-700 text-xs">Live</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Insights */}
                {salesAnalysis.insights.slice(0, 2).map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100">
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

                {/* Top Customer */}
                {salesAnalysis.topCustomers.length > 0 && (
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-purple-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">Top Customer</h4>
                        <p className="text-xs text-slate-600 mt-1">{salesAnalysis.topCustomers[0].name}</p>
                        <p className="text-lg font-bold text-purple-600 mt-2">
                          ${salesAnalysis.topCustomers[0].revenue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                {salesAnalysis.recommendations.length > 0 && (
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100 md:col-span-2 lg:col-span-3">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm">AI Recommendation</h4>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {salesAnalysis.recommendations.slice(0, 3).map((rec, index) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Sales Trend */}
          {chartData.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Orders Table */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Orders</CardTitle>
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-green-600 to-emerald-600">
                  <Plus className="w-4 h-4 mr-2" /> New Order
                </Button>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search orders..."
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
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="quotation">Quotation</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No orders yet</p>
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">Create First Order</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                          <TableCell className="font-medium">{order.customer_name}</TableCell>
                          <TableCell className="text-sm">
                            {order.order_date ? format(new Date(order.order_date), 'MMM dd, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">${(order.total_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {order.status === 'quotation' && (
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'confirmed')}>
                                  Confirm
                                </Button>
                              )}
                              {order.status === 'confirmed' && (
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(order.id, 'processing')}>
                                  Process
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

        {/* Create Order Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Sales Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Order Number</label>
                  <Input
                    placeholder="Auto-generated"
                    value={newOrder.order_number}
                    onChange={(e) => setNewOrder({...newOrder, order_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer *</label>
                  <Input
                    placeholder="Customer name"
                    value={newOrder.customer_name}
                    onChange={(e) => setNewOrder({...newOrder, customer_name: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Order Date *</label>
                  <Input
                    type="date"
                    value={newOrder.order_date}
                    onChange={(e) => setNewOrder({...newOrder, order_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Delivery Date</label>
                  <Input
                    type="date"
                    value={newOrder.delivery_date}
                    onChange={(e) => setNewOrder({...newOrder, delivery_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Subtotal *</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newOrder.subtotal}
                    onChange={(e) => setNewOrder({...newOrder, subtotal: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tax</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newOrder.tax_amount}
                    onChange={(e) => setNewOrder({...newOrder, tax_amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Shipping</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newOrder.shipping_cost}
                    onChange={(e) => setNewOrder({...newOrder, shipping_cost: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">Total Amount</span>
                  <span className="text-2xl font-bold text-green-600">
                    ${(parseFloat(newOrder.subtotal || 0) + parseFloat(newOrder.tax_amount || 0) + parseFloat(newOrder.shipping_cost || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
                  disabled={!newOrder.customer_name || !newOrder.subtotal}
                >
                  Create Order
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
