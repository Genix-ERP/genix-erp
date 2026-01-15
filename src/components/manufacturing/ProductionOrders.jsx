import React, { useState, useEffect, useMemo } from 'react';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Play, Pause, CheckCircle, X, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

export default function ProductionOrders() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const {
    productionOrders,
    isLoading,
    createProductionOrder,
    updateProductionOrder,
    confirmProductionOrder,
    startProductionOrder,
    pauseProductionOrder,
    completeProductionOrder,
    cancelProductionOrder,
    refreshData
  } = useManufacturing();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    name: '',
    product_name: '',
    product_id: '',
    quantity_planned: 0,
    uom: 'units',
    priority: 5,
    scheduled_start: new Date().toISOString().split('T')[0],
    scheduled_end: ''
  });

  const filteredOrders = useMemo(() => {
    let filtered = productionOrders;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(o =>
        o.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [productionOrders, searchQuery, statusFilter]);

  const handleCreateOrder = async () => {
    try {
      await createProductionOrder({
        ...newOrder,
        quantity_planned: parseFloat(newOrder.quantity_planned)
      });
      setShowCreateModal(false);

      // Reset form
      setNewOrder({
        name: '',
        product_name: '',
        product_id: '',
        quantity_planned: 0,
        uom: 'units',
        priority: 5,
        scheduled_start: new Date().toISOString().split('T')[0],
        scheduled_end: ''
      });
    } catch (error) {
      console.error('Error creating production order:', error);
    }
  };

  const handleStatusChange = async (orderId, action) => {
    try {
      switch (action) {
        case 'confirm':
          await confirmProductionOrder(orderId);
          break;
        case 'start':
          await startProductionOrder(orderId);
          break;
        case 'pause':
          await pauseProductionOrder(orderId);
          break;
        case 'complete':
          await completeProductionOrder(orderId);
          break;
        case 'cancel':
          await cancelProductionOrder(orderId);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      ready: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      paused: 'bg-orange-100 text-orange-800 border-orange-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      closed: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[status] || colors.draft;
  };

  const getPriorityLabel = (priority) => {
    if (priority <= 2) return { label: 'Urgent', color: 'bg-red-100 text-red-700' };
    if (priority <= 4) return { label: 'High', color: 'bg-orange-100 text-orange-700' };
    if (priority <= 6) return { label: 'Normal', color: 'bg-blue-100 text-blue-700' };
    return { label: 'Low', color: 'bg-slate-100 text-slate-700' };
  };

  return (
    <div className="space-y-6">

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">{t('production_orders') || 'Production Orders'}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refreshData}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                  <Plus className="w-4 h-4 mr-2" /> {t('new_production_order') || 'New Production Order'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_orders') || 'Search orders...'}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('filter_by_status') || 'Filter by status'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status') || 'All Statuses'}</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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
                <p className="text-slate-600">{t('loading_orders') || 'Loading orders...'}</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Plus className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('no_production_orders_yet') || 'No production orders yet'}</h3>
              <p className="text-sm text-slate-500 mb-6">{t('create_first_production_order') || 'Create your first production order to get started'}</p>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> {t('create_first_order') || 'Create First Order'}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Order Code</TableHead>
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
                  {filteredOrders.map((order) => {
                    const priorityInfo = getPriorityLabel(order.priority);
                    return (
                      <TableRow key={order.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-sm">{order.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.product_name || order.name}</p>
                            {order.product_code && <p className="text-xs text-slate-500">{order.product_code}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-semibold">{order.quantity_produced || 0}</span>
                            <span className="text-slate-500"> / {order.quantity_planned}</span>
                            <span className="text-xs text-slate-400 ml-1">{order.uom}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>{order.status?.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="text-slate-600">
                              Start: {order.scheduled_start ? format(new Date(order.scheduled_start), 'MMM dd') : '-'}
                            </p>
                            <p className="text-slate-600">
                              End: {order.scheduled_end ? format(new Date(order.scheduled_end), 'MMM dd') : '-'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-2 min-w-[60px]">
                              <div
                                className="bg-green-600 h-2 rounded-full transition-all"
                                style={{ width: `${order.progress_percent || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold">{Math.round(order.progress_percent || 0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {order.status === 'draft' && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'confirm')} title="Confirm">
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {(order.status === 'confirmed' || order.status === 'paused') && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'start')} title="Start">
                                <Play className="w-4 h-4" />
                              </Button>
                            )}
                            {order.status === 'in_progress' && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'pause')} title="Pause">
                                  <Pause className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'complete')} title="Complete">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                </Button>
                              </>
                            )}
                            {!['completed', 'cancelled', 'closed'].includes(order.status) && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'cancel')} title="Cancel">
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
            <DialogTitle>{t('create_production_order') || 'Create Production Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Order Name</label>
                <Input
                  placeholder="Enter order name"
                  value={newOrder.name}
                  onChange={(e) => setNewOrder({...newOrder, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority (1-10) *</label>
                <Select value={String(newOrder.priority)} onValueChange={(value) => setNewOrder({...newOrder, priority: parseInt(value)})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Urgent</SelectItem>
                    <SelectItem value="3">3 - High</SelectItem>
                    <SelectItem value="5">5 - Normal</SelectItem>
                    <SelectItem value="7">7 - Low</SelectItem>
                    <SelectItem value="10">10 - Lowest</SelectItem>
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

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Product ID *</label>
                <Input
                  placeholder="Product ID"
                  value={newOrder.product_id}
                  onChange={(e) => setNewOrder({...newOrder, product_id: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantity *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newOrder.quantity_planned}
                  onChange={(e) => setNewOrder({...newOrder, quantity_planned: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Unit</label>
                <Select value={newOrder.uom} onValueChange={(value) => setNewOrder({...newOrder, uom: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="units">Units</SelectItem>
                    <SelectItem value="pcs">Pieces</SelectItem>
                    <SelectItem value="kg">Kilograms</SelectItem>
                    <SelectItem value="liters">Liters</SelectItem>
                    <SelectItem value="boxes">Boxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Scheduled Start *</label>
                <Input
                  type="date"
                  value={newOrder.scheduled_start}
                  onChange={(e) => setNewOrder({...newOrder, scheduled_start: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Scheduled End</label>
                <Input
                  type="date"
                  value={newOrder.scheduled_end}
                  onChange={(e) => setNewOrder({...newOrder, scheduled_end: e.target.value})}
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
                disabled={!newOrder.product_name || !newOrder.product_id || !newOrder.quantity_planned}
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
