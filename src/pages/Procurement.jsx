import React, { useState, useEffect, useMemo } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ShoppingCart, TrendingUp, AlertCircle, CheckCircle, Truck, Brain, AlertTriangle, Target, Lightbulb, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyzeProcurement } from '@/api/services/aiAnalytics';

export default function Procurement() {
  const { purchaseOrders, createPurchaseOrder, updatePurchaseOrder, isLoading } = useModules();
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
    vendor_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    total_amount: 0,
    payment_terms: 'net_30'
  });

  useEffect(() => {
    let filtered = purchaseOrders;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(po => po.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(po =>
        po.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredOrders(filtered);
  }, [purchaseOrders, searchQuery, statusFilter]);

  const handleCreatePO = async () => {
    if (!newPO.vendor_name || !newPO.total_amount) return;

    setIsSubmitting(true);
    try {
      const poData = {
        ...newPO,
        po_number: newPO.po_number || `PO-${Date.now()}`,
        total_amount: parseFloat(newPO.total_amount) || 0,
        status: 'draft',
        ai_price_validation: true
      };

      await createPurchaseOrder(poData);
      setShowCreateModal(false);

      setNewPO({
        po_number: '',
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
    if (!editPO || !editPO.vendor_name) return;

    setIsSubmitting(true);
    try {
      const updates = {
        po_number: editPO.po_number,
        vendor_name: editPO.vendor_name,
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

  const metrics = {
    totalPOs: purchaseOrders.length,
    totalValue: purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
    pendingPOs: purchaseOrders.filter(po => ['draft', 'sent', 'confirmed'].includes(po.status)).length,
    receivedPOs: purchaseOrders.filter(po => po.status === 'received').length
  };

  const vendorData = {};
  purchaseOrders.forEach(po => {
    vendorData[po.vendor_name] = (vendorData[po.vendor_name] || 0) + (po.total_amount || 0);
  });
  const chartData = Object.entries(vendorData).slice(0, 5).map(([vendor, value]) => ({
    vendor,
    value
  }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Procurement & Purchasing</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-white/90">Smart procurement with AI-driven vendor selection and price optimization</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalPOs}</p>
              <p className="text-sm text-slate-600">Total Purchase Orders</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalValue.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Total Value</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.pendingPOs}</p>
              <p className="text-sm text-slate-600">Pending Orders</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.receivedPOs}</p>
              <p className="text-sm text-slate-600">Received</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(procurementAnalysis.insights.length > 0 || procurementAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-indigo-600" />
                AI Procurement Insights
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
                        <h4 className="font-medium text-slate-900 text-sm">AI Recommendation</h4>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Vendor Spend Chart */}
          {chartData.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Top Vendors by Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="vendor" fontSize={12} angle={-45} textAnchor="end" height={80} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Purchase Orders */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Purchase Orders</CardTitle>
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                  <Plus className="w-4 h-4 mr-2" /> New PO
                </Button>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search POs..."
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
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
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
                  <p className="text-slate-500">No purchase orders yet</p>
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">Create First PO</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>PO #</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Delivery Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((po) => (
                        <TableRow key={po.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">{po.po_number}</TableCell>
                          <TableCell className="font-medium">{po.vendor_name}</TableCell>
                          <TableCell className="text-sm">
                            {po.order_date ? format(new Date(po.order_date), 'MMM dd, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'MMM dd, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">${(po.total_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(po.status)}>{po.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={(e) => handleEditPO(po, e)} title="Edit PO">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {po.status === 'draft' && (
                                <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'sent')}>
                                  Send
                                </Button>
                              )}
                              {po.status === 'sent' && (
                                <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'confirmed')}>
                                  Confirm
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
        </div>

        {/* Create PO Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">PO Number (Optional)</label>
                  <Input
                    placeholder="Auto-generated"
                    value={newPO.po_number}
                    onChange={(e) => setNewPO({...newPO, po_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Vendor *</label>
                  <Input
                    placeholder="Vendor name"
                    value={newPO.vendor_name}
                    onChange={(e) => setNewPO({...newPO, vendor_name: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Order Date *</label>
                  <Input
                    type="date"
                    value={newPO.order_date}
                    onChange={(e) => setNewPO({...newPO, order_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Expected Delivery</label>
                  <Input
                    type="date"
                    value={newPO.expected_delivery_date}
                    onChange={(e) => setNewPO({...newPO, expected_delivery_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Total Amount *</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newPO.total_amount}
                    onChange={(e) => setNewPO({...newPO, total_amount: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Terms</label>
                  <Select value={newPO.payment_terms} onValueChange={(value) => setNewPO({...newPO, payment_terms: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="net_30">Net 30</SelectItem>
                      <SelectItem value="net_60">Net 60</SelectItem>
                      <SelectItem value="net_90">Net 90</SelectItem>
                      <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePO}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  disabled={!newPO.vendor_name || !newPO.total_amount || isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create PO'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit PO Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Purchase Order</DialogTitle>
            </DialogHeader>
            {editPO && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">PO Number</label>
                    <Input
                      value={editPO.po_number}
                      onChange={(e) => setEditPO({...editPO, po_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Vendor *</label>
                    <Input
                      placeholder="Vendor name"
                      value={editPO.vendor_name}
                      onChange={(e) => setEditPO({...editPO, vendor_name: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Order Date *</label>
                    <Input
                      type="date"
                      value={editPO.order_date?.split('T')[0] || ''}
                      onChange={(e) => setEditPO({...editPO, order_date: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Expected Delivery</label>
                    <Input
                      type="date"
                      value={editPO.expected_delivery_date?.split('T')[0] || ''}
                      onChange={(e) => setEditPO({...editPO, expected_delivery_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Total Amount *</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={editPO.total_amount}
                      onChange={(e) => setEditPO({...editPO, total_amount: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Payment Terms</label>
                    <Select value={editPO.payment_terms || 'net_30'} onValueChange={(value) => setEditPO({...editPO, payment_terms: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net_30">Net 30</SelectItem>
                        <SelectItem value="net_60">Net 60</SelectItem>
                        <SelectItem value="net_90">Net 90</SelectItem>
                        <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={editPO.status || 'draft'} onValueChange={(value) => setEditPO({...editPO, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditPO(null); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdatePO}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                    disabled={!editPO.vendor_name || isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
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
