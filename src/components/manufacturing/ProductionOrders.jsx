import React, { useState, useEffect, useMemo } from 'react';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useInventory } from '@/components/contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Play, Pause, CheckCircle, X, Calendar, RefreshCw, Clock, DollarSign, Cog, Eye, ArrowRight, Package, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { inventoryService, bomsService, productionOrdersService } from '@/api/services';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function ProductionOrders() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const {
    productionOrders,
    isLoading,
    workOrders,
    createProductionOrder,
    updateProductionOrder,
    confirmProductionOrder,
    startProductionOrder,
    pauseProductionOrder,
    completeProductionOrder,
    cancelProductionOrder,
    deleteProductionOrder,
    refreshData,
    manufacturingCategories
  } = useManufacturing();
  const { refreshData: refreshInventory } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [boms, setBoms] = useState([]);

  // Default manufacturing stages (used when no BOM/routing available)
  const DEFAULT_STAGES = [
    { key: 'draft', label: t('stage_draft') || 'Qoralama', color: 'bg-gray-100 text-gray-700 border-gray-300' },
    { key: 'in_progress', label: t('in_progress') || 'Jarayonda', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { key: 'done', label: t('stage_done') || 'Tayyor', color: 'bg-green-100 text-green-700 border-green-300' }
  ];

  // Stage color palette for dynamic stages
  const STAGE_COLORS = [
    'bg-purple-100 text-purple-700 border-purple-300',
    'bg-blue-100 text-blue-700 border-blue-300',
    'bg-amber-100 text-amber-700 border-amber-300',
    'bg-orange-100 text-orange-700 border-orange-300',
    'bg-cyan-100 text-cyan-700 border-cyan-300',
    'bg-pink-100 text-pink-700 border-pink-300',
    'bg-indigo-100 text-indigo-700 border-indigo-300'
  ];

  // Get stages for a production order (from BOM operations or default)
  const getOrderStages = (order) => {
    if (!order) return DEFAULT_STAGES;

    // First, check if order has bom_operations directly (from backend)
    let operations = order.bom_operations;

    // If not, try to find the BOM in the boms array
    if (!operations && order.bom_id) {
      const bom = boms.find(b => b.id === order.bom_id);
      operations = bom?.operations;
    }

    // If we have operations, convert them to stages
    if (operations && operations.length > 0) {
      const stages = [
        { key: 'draft', label: t('stage_draft') || 'Qoralama', color: 'bg-gray-100 text-gray-700 border-gray-300' }
      ];

      operations.forEach((op, index) => {
        stages.push({
          key: `op_${op.sequence || index}`,
          label: op.name || op.operation_name || `${t('operation')} ${op.sequence || index + 1}`,
          color: STAGE_COLORS[index % STAGE_COLORS.length],
          operation: op
        });
      });

      stages.push({ key: 'done', label: t('stage_done') || 'Tayyor', color: 'bg-green-100 text-green-700 border-green-300' });
      return stages;
    }

    return DEFAULT_STAGES;
  };
  const [productBoms, setProductBoms] = useState([]); // BOMs filtered by selected product
  const [newOrder, setNewOrder] = useState({
    name: '',
    product_name: '',
    product_id: '',
    bom_id: '',
    quantity_planned: 0,
    uom: 'units',
    priority: 5,
    scheduled_start: new Date().toISOString().split('T')[0],
    scheduled_end: '',
    // Manufacturing-specific fields
    shift: '',
    manufacturing_category_id: ''
  });

  // Load products and BOMs
  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, bomsData] = await Promise.all([
          inventoryService.listProducts(),
          bomsService.list()
        ]);
        setProducts(productsData || []);
        setBoms(bomsData || []);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // Filter BOMs when product changes
  useEffect(() => {
    if (newOrder.product_id) {
      const filtered = boms.filter(b => b.product_id === newOrder.product_id);
      setProductBoms(filtered);
      // Auto-select if only one BOM
      if (filtered.length === 1) {
        setNewOrder(prev => ({ ...prev, bom_id: filtered[0].id }));
      } else if (filtered.length === 0) {
        setNewOrder(prev => ({ ...prev, bom_id: '' }));
      }
    } else {
      setProductBoms([]);
      setNewOrder(prev => ({ ...prev, bom_id: '' }));
    }
  }, [newOrder.product_id, boms]);

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
      const orderData = {
        ...newOrder,
        quantity_planned: parseFloat(newOrder.quantity_planned)
      };
      // Only include bom_id if selected
      if (!orderData.bom_id) {
        delete orderData.bom_id;
      }
      // Only include shift if selected
      if (!orderData.shift) {
        delete orderData.shift;
      }
      // Only include manufacturing_category_id if selected
      if (!orderData.manufacturing_category_id) {
        delete orderData.manufacturing_category_id;
      }
      await createProductionOrder(orderData);
      setShowCreateModal(false);

      // Reset form
      setNewOrder({
        name: '',
        product_name: '',
        product_id: '',
        bom_id: '',
        quantity_planned: 0,
        uom: 'units',
        priority: 5,
        scheduled_start: new Date().toISOString().split('T')[0],
        scheduled_end: '',
        // Manufacturing-specific fields
        shift: '',
        manufacturing_category_id: ''
      });
      setProductBoms([]);
    } catch (error) {
      console.error('Error creating production order:', error);
      const errorMsg = typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : error.response?.data?.error?.message || error.message;
      alert(`Failed to create production order: ${errorMsg}`);
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
          refreshInventory();
          break;
        case 'pause':
          await pauseProductionOrder(orderId);
          break;
        case 'complete':
          await completeProductionOrder(orderId);
          refreshInventory();
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
    if (priority <= 2) return { label: t('urgent') || 'Urgent', color: 'bg-red-100 text-red-700' };
    if (priority <= 4) return { label: t('high') || 'High', color: 'bg-orange-100 text-orange-700' };
    if (priority <= 6) return { label: t('normal') || 'Normal', color: 'bg-blue-100 text-blue-700' };
    return { label: t('low') || 'Low', color: 'bg-slate-100 text-slate-700' };
  };

  const getStatusLabel = (status) => {
    const statusKey = status?.toLowerCase();
    return t(statusKey) || status?.replace('_', ' ');
  };

  const getUnitLabel = (uom) => {
    return t(uom) || uom;
  };

  const getStageColor = (stage) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-amber-100 text-amber-700',
      mixing: 'bg-purple-100 text-purple-700',
      rising: 'bg-blue-100 text-blue-700',
      drying: 'bg-amber-100 text-amber-700',
      cutting: 'bg-orange-100 text-orange-700',
      packing: 'bg-cyan-100 text-cyan-700',
      done: 'bg-green-100 text-green-700'
    };
    if (colors[stage]) return colors[stage];
    // op_X stages get a blue color
    if (stage && stage.startsWith('op_')) return 'bg-blue-100 text-blue-700';
    return colors.draft;
  };

  const getStageLabel = (stage, order) => {
    const labels = {
      draft: t('stage_draft') || 'Draft',
      in_progress: t('in_progress') || 'In Progress',
      mixing: t('stage_mixing') || 'Mixing',
      rising: t('stage_rising') || 'Rising',
      drying: t('stage_drying') || 'Drying',
      cutting: t('stage_cutting') || 'Cutting',
      packing: t('stage_packing') || 'Packing',
      done: t('stage_done') || 'Done'
    };
    if (labels[stage]) return labels[stage];

    // For op_X stages, resolve operation name from work orders
    if (stage && stage.startsWith('op_') && order) {
      const seq = parseInt(stage.replace('op_', ''), 10);
      if (!isNaN(seq)) {
        const wo = (workOrders || []).find(
          w => w.production_order_id === order.id && (w.sequence === seq || w.sequence === seq)
        );
        if (wo?.name || wo?.operation_name) return wo.name || wo.operation_name;
      }
      // Fallback: try BOM operations
      const stages = getOrderStages(order);
      const found = stages.find(s => s.key === stage);
      if (found) return found.label;
    }
    return stage;
  };

  const getShiftLabel = (shift) => {
    if (!shift) return '-';
    return shift === 'day' ? (t('day_shift') || 'Day') : (t('night_shift') || 'Night');
  };

  const handleViewOrder = async (order) => {
    try {
      // Fetch full order details including BOM operations
      const fullOrder = await productionOrdersService.get(order.id);
      setSelectedOrder(fullOrder);
      setShowViewModal(true);
    } catch (error) {
      console.error('Failed to fetch production order:', error);
      // Fallback to cached order if fetch fails
      setSelectedOrder(order);
      setShowViewModal(true);
    }
  };

  const getCurrentStageIndex = (stage, stages) => {
    return stages.findIndex(s => s.key === (stage || 'draft'));
  };

  const handleAdvanceStage = async (orderId, currentStage, order) => {
    const stages = getOrderStages(order);
    const currentIndex = getCurrentStageIndex(currentStage, stages);
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1].key;
      try {
        await updateProductionOrder(orderId, { current_stage: nextStage });
        // Update selected order if viewing
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, current_stage: nextStage }));
        }
      } catch (error) {
        console.error('Error advancing stage:', error);
        alert(t('error_advancing_stage') || 'Failed to advance stage');
      }
    }
  };

  const handleRecordOutput = async (orderId, goodQty, rejectQty, packageCount) => {
    try {
      const outputData = {
        good_quantity: parseFloat(goodQty) || 0,
        reject_quantity: parseFloat(rejectQty) || 0,
        package_count: parseInt(packageCount) || 0
      };

      if (selectedOrder?.current_stage === 'done') {
        // Combine output update + completion in a single call
        await completeProductionOrder(orderId, outputData);
      } else {
        await updateProductionOrder(orderId, outputData);
      }

      setShowViewModal(false);
      setSelectedOrder(null);
      refreshData();
      refreshInventory();
    } catch (error) {
      console.error('Error recording output:', error);
      alert(t('error_recording_output') || 'Failed to record output: ' + (error.response?.data?.error?.message || error.message));
    }
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
                  <RefreshCw className="w-4 h-4 mr-2" /> {t('refresh') || 'Refresh'}
                </Button>
                {canCreate(MODULES.MANUFACTURING) && (
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                    <Plus className="w-4 h-4 mr-2" /> {t('new_production_order') || 'New Production Order'}
                  </Button>
                )}
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
                  <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                  <SelectItem value="confirmed">{t('confirmed') || 'Confirmed'}</SelectItem>
                  <SelectItem value="in_progress">{t('in_progress') || 'In Progress'}</SelectItem>
                  <SelectItem value="paused">{t('paused') || 'Paused'}</SelectItem>
                  <SelectItem value="completed">{t('completed') || 'Completed'}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
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
              {canCreate(MODULES.MANUFACTURING) && (
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_order') || 'Create First Order'}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">{t('order_code') || 'Order Code'}</TableHead>
                    <TableHead className="font-semibold">{t('product') || 'Product'}</TableHead>
                    <TableHead className="font-semibold">{t('quantity') || 'Quantity'}</TableHead>
                    <TableHead className="font-semibold">{t('stage') || 'Stage'}</TableHead>
                    <TableHead className="font-semibold">{t('output') || 'Output'}</TableHead>
                    <TableHead className="font-semibold">{t('priority') || 'Priority'}</TableHead>
                    <TableHead className="font-semibold">{t('status') || 'Status'}</TableHead>
                    <TableHead className="font-semibold">{t('shift') || 'Shift'}</TableHead>
                    <TableHead className="font-semibold">{t('progress') || 'Progress'}</TableHead>
                    <TableHead className="font-semibold">{t('actions') || 'Actions'}</TableHead>
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
                            <span className="text-xs text-slate-400 ml-1">{getUnitLabel(order.uom)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStageColor(order.current_stage || 'draft')}>
                            {getStageLabel(order.current_stage || 'draft', order)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-green-600 font-medium">{order.good_quantity || 0}</span>
                              <span className="text-slate-400">/</span>
                              <span className="text-red-500">{order.reject_quantity || 0}</span>
                            </div>
                            {order.package_count > 0 && (
                              <p className="text-slate-500 mt-0.5">{order.package_count} {t('packages_short') || 'pkg'}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getShiftLabel(order.shift)}</span>
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
                            <Button size="sm" variant="ghost" onClick={() => handleViewOrder(order)} title={t('view') || 'View'}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {order.status === 'draft' && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'confirm')} title={t('confirm') || 'Confirm'}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {canUpdate(MODULES.MANUFACTURING) && (order.status === 'confirmed' || order.status === 'paused') && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'start')} title={t('start') || 'Start'}>
                                <Play className="w-4 h-4" />
                              </Button>
                            )}
                            {canUpdate(MODULES.MANUFACTURING) && order.status === 'in_progress' && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'pause')} title={t('paused') || 'Pause'}>
                                  <Pause className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'complete')} title={t('completed') || 'Complete'}>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                </Button>
                              </>
                            )}
                            {canUpdate(MODULES.MANUFACTURING) && !['completed', 'cancelled', 'closed'].includes(order.status) && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(order.id, 'cancel')} title={t('cancel') || 'Cancel'}>
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                            {canDelete(MODULES.MANUFACTURING) && ['draft', 'cancelled', 'completed'].includes(order.status) && (
                              <Button size="sm" variant="ghost"
                                onClick={() => {
                                  if (window.confirm(t('confirm_delete') || 'Delete this production order?')) {
                                    deleteProductionOrder(order.id);
                                  }
                                }}
                                title={t('delete') || 'Delete'}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
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
                <label className="text-sm font-medium mb-1 block">{t('order_name') || 'Order Name'}</label>
                <Input
                  placeholder={t('enter_order_name') || 'Enter order name'}
                  value={newOrder.name}
                  onChange={(e) => setNewOrder({...newOrder, name: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('product') || 'Product'} *</label>
                <Select
                  value={newOrder.product_id}
                  onValueChange={(value) => {
                    const product = products.find(p => p.id === value);
                    setNewOrder({
                      ...newOrder,
                      product_id: value,
                      product_name: product?.name || '',
                      uom: product?.unit_of_measure || product?.uom || 'units',
                      bom_id: '' // Reset BOM when product changes
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_product') || 'Select a product'} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(product => product.id).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku || product.code || 'No SKU'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('bill_of_materials') || 'Bill of Materials'}</label>
                <Select
                  value={newOrder.bom_id}
                  onValueChange={(value) => setNewOrder({...newOrder, bom_id: value})}
                  disabled={!newOrder.product_id || productBoms.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={productBoms.length === 0 ? (t('no_bom_available') || 'No BOM available') : (t('select_bom') || 'Select BOM')} />
                  </SelectTrigger>
                  <SelectContent>
                    {productBoms.filter(bom => bom.id).map((bom) => (
                      <SelectItem key={bom.id} value={bom.id}>
                        {bom.name || bom.code} ({bom.line_count || 0} {t('components') || 'comp.'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newOrder.product_id && productBoms.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">{t('no_bom_for_product') || 'No BOM defined for this product'}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('quantity') || 'Quantity'} *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newOrder.quantity_planned}
                  onChange={(e) => setNewOrder({...newOrder, quantity_planned: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('unit') || 'Unit'}</label>
                <div className="h-10 px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-700 flex items-center">
                  {newOrder.uom || t('select_product_first') || 'Select product first'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('shift') || 'Shift'}</label>
                <Select value={newOrder.shift || 'none'} onValueChange={(value) => setNewOrder({...newOrder, shift: value === 'none' ? '' : value})}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_shift') || 'Select shift'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_shift') || 'Not specified'}</SelectItem>
                    <SelectItem value="day">{t('day_shift') || 'Day Shift'}</SelectItem>
                    <SelectItem value="night">{t('night_shift') || 'Night Shift'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('category') || 'Category'}</label>
                <Select value={newOrder.manufacturing_category_id || 'none'} onValueChange={(value) => setNewOrder({...newOrder, manufacturing_category_id: value === 'none' ? '' : value})}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_category') || 'Select category'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_category') || 'No category'}</SelectItem>
                    {(manufacturingCategories || []).filter(c => c.is_active).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('scheduled_start') || 'Scheduled Start'} *</label>
                <Input
                  type="date"
                  value={newOrder.scheduled_start}
                  onChange={(e) => setNewOrder({...newOrder, scheduled_start: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('scheduled_end') || 'Scheduled End'}</label>
                <Input
                  type="date"
                  value={newOrder.scheduled_end}
                  onChange={(e) => setNewOrder({...newOrder, scheduled_end: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateOrder}
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                disabled={!newOrder.product_name || !newOrder.product_id || !newOrder.quantity_planned}
              >
                {t('create_order') || 'Create Order'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Order / Stage Tracking Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cog className="w-5 h-5" />
              {selectedOrder?.code || selectedOrder?.name} - {t('stage_workflow') || 'Stage Workflow'}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6 py-4">
              {/* Order Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">{t('product') || 'Product'}</p>
                  <p className="font-semibold">{selectedOrder.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('quantity') || 'Quantity'}</p>
                  <p className="font-semibold">{selectedOrder.quantity_planned} {getUnitLabel(selectedOrder.uom)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('shift') || 'Shift'}</p>
                  <p className="font-semibold">{getShiftLabel(selectedOrder.shift)}</p>
                </div>
              </div>

              {/* Stage Workflow */}
              <div>
                <h4 className="font-semibold mb-4">{t('manufacturing_stages') || 'Ishlab chiqarish bosqichlari'}</h4>
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
                  {getOrderStages(selectedOrder).map((stage, index) => {
                    const stages = getOrderStages(selectedOrder);
                    const currentIndex = getCurrentStageIndex(selectedOrder.current_stage, stages);
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isPending = index > currentIndex;

                    return (
                      <React.Fragment key={stage.key}>
                        <div
                          className={`
                            flex flex-col items-center min-w-[80px] p-3 rounded-lg border-2 transition-all
                            ${isCompleted ? 'bg-green-50 border-green-400' : ''}
                            ${isCurrent ? stage.color + ' border-2 shadow-md' : ''}
                            ${isPending ? 'bg-slate-50 border-slate-200 opacity-60' : ''}
                          `}
                        >
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center mb-2
                            ${isCompleted ? 'bg-green-500 text-white' : ''}
                            ${isCurrent ? 'bg-slate-700 text-white' : ''}
                            ${isPending ? 'bg-slate-200 text-slate-400' : ''}
                          `}>
                            {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                          </div>
                          <span className="text-xs font-medium text-center">{stage.label}</span>
                        </div>
                        {index < stages.length - 1 && (
                          <ArrowRight className={`w-5 h-5 flex-shrink-0 ${index < currentIndex ? 'text-green-500' : 'text-slate-300'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Confirm & Start buttons for draft/confirmed orders */}
                {selectedOrder.status === 'draft' && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={async () => {
                        await handleStatusChange(selectedOrder.id, 'confirm');
                        setSelectedOrder(prev => ({ ...prev, status: 'confirmed' }));
                      }}
                      className="bg-gradient-to-r from-blue-600 to-blue-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('confirm') || 'Confirm'}
                    </Button>
                  </div>
                )}
                {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'paused') && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={async () => {
                        await handleStatusChange(selectedOrder.id, 'start');
                        setSelectedOrder(prev => ({ ...prev, status: 'in_progress' }));
                      }}
                      className="bg-gradient-to-r from-green-600 to-green-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {t('start_production') || 'Start Production'}
                    </Button>
                  </div>
                )}
                {/* Advance Stage Button */}
                {selectedOrder.current_stage !== 'done' && selectedOrder.status === 'in_progress' && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={() => handleAdvanceStage(selectedOrder.id, selectedOrder.current_stage, selectedOrder)}
                      className="bg-gradient-to-r from-slate-700 to-slate-800"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {t('advance_to_next_stage') || "Keyingi bosqichga o'tish"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Output Recording - Visible when production is active */}
              {(selectedOrder.status === 'in_progress' || selectedOrder.current_stage === 'done' || (selectedOrder.current_stage && selectedOrder.current_stage.startsWith('op_'))) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {t('production_output') || 'Production Output'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block text-green-700">
                        {t('good_quantity') || 'Good Quantity'}
                      </label>
                      <Input
                        type="number"
                        value={selectedOrder.good_quantity || 0}
                        onChange={(e) => setSelectedOrder(prev => ({ ...prev, good_quantity: e.target.value }))}
                        className="border-green-300 focus:border-green-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block text-red-700">
                        {t('reject_quantity') || 'Reject/Brak Quantity'}
                      </label>
                      <Input
                        type="number"
                        value={selectedOrder.reject_quantity || 0}
                        onChange={(e) => setSelectedOrder(prev => ({ ...prev, reject_quantity: e.target.value }))}
                        className="border-red-300 focus:border-red-500"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => handleRecordOutput(
                        selectedOrder.id,
                        selectedOrder.good_quantity,
                        selectedOrder.reject_quantity,
                        selectedOrder.package_count
                      )}
                      className="bg-gradient-to-r from-green-600 to-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('save_output') || 'Save Output'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Output Summary */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">{t('output_summary') || 'Output Summary'}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600">{t('good_quantity') || 'Good'}</p>
                    <p className="text-lg font-bold text-green-700">{selectedOrder.good_quantity || 0}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600">{t('reject_quantity') || 'Reject/Brak'}</p>
                    <p className="text-lg font-bold text-red-700">{selectedOrder.reject_quantity || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
