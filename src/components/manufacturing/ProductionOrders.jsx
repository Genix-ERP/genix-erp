import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Play, Pause, CheckCircle, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function ProductionOrders() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newOrder, setNewOrder] = useState({
    order_number: '',
    product_name: '',
    product_code: '',
    quantity_to_produce: 0,
    priority: 'normal',
    scheduled_start_date: new Date().toISOString().split('T')[0],
    scheduled_end_date: '',
    source: 'manual'
  });

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let filtered = orders;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(o =>
        o.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredOrders(filtered);
  }, [orders, searchQuery, statusFilter]);

  const loadOrders = async () => {
    try {
      const data = await base44.entities.ProductionOrder.list('-created_date', 100);
      setOrders(data);
      setFilteredOrders(data);
    } catch (error) {
      console.error('Error loading production orders:', error);
    }
    setIsLoading(false);
  };

  const handleCreateOrder = async () => {
    try {
      const orderData = {
        ...newOrder,
        order_number: newOrder.order_number || `PO-${Date.now()}`,
        quantity_to_produce: parseFloat(newOrder.quantity_to_produce),
        status: 'confirmed'
      };
      
      await base44.entities.ProductionOrder.create(orderData);
      setShowCreateModal(false);
      loadOrders();
      
      // Reset form
      setNewOrder({
        order_number: '',
        product_name: '',
        product_code: '',
        quantity_to_produce: 0,
        priority: 'normal',
        scheduled_start_date: new Date().toISOString().split('T')[0],
        scheduled_end_date: '',
        source: 'manual'
      });
    } catch (error) {
      console.error('Error creating production order:', error);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const updates = { status: newStatus };
      
      if (newStatus === 'in_progress' && !order.actual_start_date) {
        updates.actual_start_date = new Date().toISOString().split('T')[0];
      }
      
      if (newStatus === 'done') {
        updates.actual_end_date = new Date().toISOString().split('T')[0];
        updates.quantity_produced = order.quantity_to_produce;
        updates.completion_percentage = 100;
      }
      
      await base44.entities.ProductionOrder.update(orderId, updates);
      loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      done: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || colors.draft;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-slate-100 text-slate-700',
      normal: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return colors[priority] || colors.normal;
  };

  return (
    <div className="space-y-6">
      
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Production Orders</CardTitle>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> New Production Order
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading orders...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Plus className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No production orders yet</h3>
              <p className="text-sm text-slate-500 mb-6">Create your first production order to start manufacturing</p>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> Create First Order
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Order #</TableHead>
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Quantity</TableHead>
                    <TableHead className="font-semibold">Priority</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Schedule</TableHead>
                    <TableHead className="font-semibold">Progress</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.product_name}</p>
                          <p className="text-xs text-slate-500">{order.product_code}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{order.quantity_to_produce}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(order.priority)}>{order.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="text-slate-600">Start: {order.scheduled_start_date ? format(new Date(order.scheduled_start_date), 'MMM dd') : '-'}</p>
                          <p className="text-slate-600">End: {order.scheduled_end_date ? format(new Date(order.scheduled_end_date), 'MMM dd') : '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${order.completion_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{order.completion_percentage || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {order.status === 'confirmed' && (
                            <Button size="sm" variant="ghost" onClick={() => updateOrderStatus(order.id, 'in_progress')}>
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          {order.status === 'in_progress' && (
                            <Button size="sm" variant="ghost" onClick={() => updateOrderStatus(order.id, 'done')}>
                              <CheckCircle className="w-4 h-4" />
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

      {/* Create Order Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Order Number (Optional)</label>
                <Input
                  placeholder="Auto-generated if empty"
                  value={newOrder.order_number}
                  onChange={(e) => setNewOrder({...newOrder, order_number: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority *</label>
                <Select value={newOrder.priority} onValueChange={(value) => setNewOrder({...newOrder, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Product Name *</label>
              <Input
                placeholder="Enter product name"
                value={newOrder.product_name}
                onChange={(e) => setNewOrder({...newOrder, product_name: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Product Code *</label>
                <Input
                  placeholder="SKU or product code"
                  value={newOrder.product_code}
                  onChange={(e) => setNewOrder({...newOrder, product_code: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantity *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newOrder.quantity_to_produce}
                  onChange={(e) => setNewOrder({...newOrder, quantity_to_produce: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Scheduled Start *</label>
                <Input
                  type="date"
                  value={newOrder.scheduled_start_date}
                  onChange={(e) => setNewOrder({...newOrder, scheduled_start_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Scheduled End</label>
                <Input
                  type="date"
                  value={newOrder.scheduled_end_date}
                  onChange={(e) => setNewOrder({...newOrder, scheduled_end_date: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateOrder} 
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                disabled={!newOrder.product_name || !newOrder.product_code || !newOrder.quantity_to_produce}
              >
                Create Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}