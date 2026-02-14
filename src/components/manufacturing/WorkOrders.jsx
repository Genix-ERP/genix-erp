import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Play, Pause, CheckCircle, Search, RefreshCw, Clock,
  Cog, Eye, ArrowRight, Timer, User, Package, AlertCircle,
  Truck, ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { workOrdersService, manufacturingTransfersService, productionOrdersService } from '@/api/services';

export default function WorkOrders() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canUpdate } = usePermissions();

  const [workOrders, setWorkOrders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('work_orders');

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  // Action states
  const [completeForm, setCompleteForm] = useState({
    quantity_produced: 0,
    scrap_quantity: 0,
    scrap_reason: '',
    quality_check_passed: true
  });

  // Load data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [woData, transferData] = await Promise.all([
        workOrdersService.list(),
        manufacturingTransfersService.list()
      ]);
      setWorkOrders(woData || []);
      setTransfers(transferData || []);
    } catch (error) {
      console.error('Failed to load work orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    let filtered = workOrders;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(wo =>
        wo.work_order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wo.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wo.operation_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wo.production_order_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [workOrders, searchQuery, statusFilter]);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    let filtered = transfers;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.transfer_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.production_order_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [transfers, searchQuery, statusFilter]);

  // Status helpers
  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      waiting: 'bg-amber-100 text-amber-800 border-amber-200',
      ready: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
      done: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || colors.draft;
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: t('draft') || 'Draft',
      waiting: t('waiting') || 'Waiting',
      ready: t('ready') || 'Ready',
      in_progress: t('in_progress') || 'In Progress',
      done: t('done') || 'Done',
      cancelled: t('cancelled') || 'Cancelled'
    };
    return labels[status] || status;
  };

  const getTransferTypeLabel = (type) => {
    const labels = {
      pick_components: t('pick_components') || 'Pick Components',
      store_finished: t('store_finished') || 'Store Finished'
    };
    return labels[type] || type;
  };

  const getTransferTypeColor = (type) => {
    return type === 'pick_components'
      ? 'bg-orange-100 text-orange-700 border-orange-300'
      : 'bg-green-100 text-green-700 border-green-300';
  };

  // Action handlers
  const handleStartWorkOrder = async (woId) => {
    try {
      await workOrdersService.start(woId);
      loadData();
    } catch (error) {
      console.error('Failed to start work order:', error);
      alert(t('error_starting_work_order') || 'Failed to start work order');
    }
  };

  const handlePauseWorkOrder = async (woId) => {
    try {
      await workOrdersService.pause(woId);
      loadData();
    } catch (error) {
      console.error('Failed to pause work order:', error);
      alert(t('error_pausing_work_order') || 'Failed to pause work order');
    }
  };

  const handleCompleteWorkOrder = async () => {
    if (!selectedWorkOrder) return;
    try {
      await workOrdersService.complete(selectedWorkOrder.id, completeForm);
      setShowDetailModal(false);
      setSelectedWorkOrder(null);
      setCompleteForm({
        quantity_produced: 0,
        scrap_quantity: 0,
        scrap_reason: '',
        quality_check_passed: true
      });
      loadData();
    } catch (error) {
      console.error('Failed to complete work order:', error);
      alert(t('error_completing_work_order') || 'Failed to complete work order');
    }
  };

  const handleValidateTransfer = async (transferId) => {
    try {
      await manufacturingTransfersService.validate(transferId);
      setShowTransferModal(false);
      setSelectedTransfer(null);
      loadData();
    } catch (error) {
      console.error('Failed to validate transfer:', error);
      alert(t('error_validating_transfer') || 'Failed to validate transfer');
    }
  };

  const handleViewWorkOrder = async (wo) => {
    setSelectedWorkOrder(wo);
    setCompleteForm({
      quantity_produced: wo.quantity_to_produce - wo.quantity_produced,
      scrap_quantity: 0,
      scrap_reason: '',
      quality_check_passed: true
    });
    setShowDetailModal(true);
  };

  const handleViewTransfer = async (transfer) => {
    try {
      const fullTransfer = await manufacturingTransfersService.get(transfer.id);
      setSelectedTransfer(fullTransfer);
      setShowTransferModal(true);
    } catch (error) {
      console.error('Failed to load transfer details:', error);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const woStats = {
      total: workOrders.length,
      draft: workOrders.filter(wo => wo.status === 'draft').length,
      in_progress: workOrders.filter(wo => wo.status === 'in_progress').length,
      done: workOrders.filter(wo => wo.status === 'done').length,
      waiting: workOrders.filter(wo => wo.status === 'waiting' || wo.status === 'ready').length
    };

    const transferStats = {
      total: transfers.length,
      pick_pending: transfers.filter(t => t.transfer_type === 'pick_components' && t.status !== 'done').length,
      store_pending: transfers.filter(t => t.transfer_type === 'store_finished' && t.status !== 'done').length,
      done: transfers.filter(t => t.status === 'done').length
    };

    return { wo: woStats, transfers: transferStats };
  }, [workOrders, transfers]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">{t('in_progress') || 'In Progress'}</p>
                <p className="text-2xl font-bold text-blue-700">{stats.wo.in_progress}</p>
              </div>
              <Play className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">{t('waiting') || 'Waiting'}</p>
                <p className="text-2xl font-bold text-amber-700">{stats.wo.waiting}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 font-medium">{t('pending_picks') || 'Pending Picks'}</p>
                <p className="text-2xl font-bold text-orange-700">{stats.transfers.pick_pending}</p>
              </div>
              <Package className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">{t('completed') || 'Completed'}</p>
                <p className="text-2xl font-bold text-green-700">{stats.wo.done}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Cog className="w-5 h-5" />
                {t('work_orders') || 'Work Orders & Transfers'}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" /> {t('refresh') || 'Refresh'}
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="work_orders" className="flex items-center gap-2">
                  <Cog className="w-4 h-4" />
                  {t('work_orders') || 'Work Orders'}
                  {stats.wo.in_progress > 0 && (
                    <Badge className="ml-1 bg-blue-500">{stats.wo.in_progress}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="transfers" className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {t('transfers') || 'Transfers'}
                  {(stats.transfers.pick_pending + stats.transfers.store_pending) > 0 && (
                    <Badge className="ml-1 bg-orange-500">
                      {stats.transfers.pick_pending + stats.transfers.store_pending}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col sm:flex-row gap-3">
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('filter_by_status') || 'Filter by status'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status') || 'All Statuses'}</SelectItem>
                  <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                  <SelectItem value="waiting">{t('waiting') || 'Waiting'}</SelectItem>
                  <SelectItem value="ready">{t('ready') || 'Ready'}</SelectItem>
                  <SelectItem value="in_progress">{t('in_progress') || 'In Progress'}</SelectItem>
                  <SelectItem value="done">{t('done') || 'Done'}</SelectItem>
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
                <p className="text-slate-600">{t('loading') || 'Loading...'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Work Orders Tab */}
              {activeTab === 'work_orders' && (
                filteredWorkOrders.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Cog className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {t('no_work_orders') || 'No work orders found'}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t('work_orders_hint') || 'Work orders are automatically created when a production order with BOM operations is confirmed.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">{t('work_order') || 'Work Order'}</TableHead>
                          <TableHead className="font-semibold">{t('production_order') || 'MO'}</TableHead>
                          <TableHead className="font-semibold">{t('operation') || 'Operation'}</TableHead>
                          <TableHead className="font-semibold">{t('work_center') || 'Work Center'}</TableHead>
                          <TableHead className="font-semibold">{t('progress') || 'Progress'}</TableHead>
                          <TableHead className="font-semibold">{t('status') || 'Status'}</TableHead>
                          <TableHead className="font-semibold">{t('duration') || 'Duration'}</TableHead>
                          <TableHead className="font-semibold">{t('actions') || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWorkOrders.map((wo) => (
                          <TableRow key={wo.id} className="hover:bg-slate-50">
                            <TableCell>
                              <div>
                                <p className="font-mono text-sm">{wo.work_order_number}</p>
                                <p className="text-xs text-slate-500">{wo.name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{wo.production_order_number}</p>
                              <p className="text-xs text-slate-500">{wo.product_name}</p>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{wo.operation_name || '-'}</p>
                              <p className="text-xs text-slate-500">Seq: {wo.sequence}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{wo.work_center_name || '-'}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={wo.progress || 0}
                                  className="w-20 h-2"
                                />
                                <span className="text-xs font-semibold">
                                  {wo.quantity_produced}/{wo.quantity_to_produce}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(wo.status)}>
                                {wo.status_label || getStatusLabel(wo.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <p>
                                  <span className="text-slate-500">{t('expected') || 'Exp'}:</span> {wo.expected_duration_minutes || 0}m
                                </p>
                                <p>
                                  <span className="text-slate-500">{t('actual') || 'Act'}:</span> {wo.actual_duration_minutes || 0}m
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewWorkOrder(wo)}
                                  title={t('view') || 'View'}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>

                                {canUpdate(MODULES.MANUFACTURING) && (
                                  <>
                                    {(wo.status === 'draft' || wo.status === 'ready' || wo.status === 'waiting') && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleStartWorkOrder(wo.id)}
                                        title={t('start') || 'Start'}
                                        className="text-green-600 hover:text-green-700"
                                      >
                                        <Play className="w-4 h-4" />
                                      </Button>
                                    )}

                                    {wo.status === 'in_progress' && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handlePauseWorkOrder(wo.id)}
                                          title={t('pause') || 'Pause'}
                                          className="text-amber-600 hover:text-amber-700"
                                        >
                                          <Pause className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleViewWorkOrder(wo)}
                                          title={t('complete') || 'Complete'}
                                          className="text-green-600 hover:text-green-700"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}

              {/* Transfers Tab */}
              {activeTab === 'transfers' && (
                filteredTransfers.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Truck className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {t('no_transfers') || 'No manufacturing transfers'}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t('transfers_hint') || 'Transfers are created based on warehouse manufacturing steps (2 or 3 step process).'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">{t('transfer') || 'Transfer'}</TableHead>
                          <TableHead className="font-semibold">{t('type') || 'Type'}</TableHead>
                          <TableHead className="font-semibold">{t('production_order') || 'MO'}</TableHead>
                          <TableHead className="font-semibold">{t('from') || 'From'}</TableHead>
                          <TableHead className="font-semibold">{t('to') || 'To'}</TableHead>
                          <TableHead className="font-semibold">{t('status') || 'Status'}</TableHead>
                          <TableHead className="font-semibold">{t('actions') || 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransfers.map((transfer) => (
                          <TableRow key={transfer.id} className="hover:bg-slate-50">
                            <TableCell>
                              <p className="font-mono text-sm">{transfer.transfer_number}</p>
                            </TableCell>
                            <TableCell>
                              <Badge className={getTransferTypeColor(transfer.transfer_type)}>
                                {transfer.transfer_type_label || getTransferTypeLabel(transfer.transfer_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{transfer.production_order_number}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{transfer.source_location_name || '-'}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{transfer.destination_location_name || '-'}</p>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(transfer.status)}>
                                {transfer.status_label || getStatusLabel(transfer.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewTransfer(transfer)}
                                  title={t('view') || 'View'}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>

                                {canUpdate(MODULES.MANUFACTURING) && transfer.status !== 'done' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleValidateTransfer(transfer.id)}
                                    title={t('validate') || 'Validate'}
                                    className="text-green-600 hover:text-green-700"
                                  >
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
                )
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Work Order Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cog className="w-5 h-5" />
              {selectedWorkOrder?.work_order_number} - {selectedWorkOrder?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedWorkOrder && (
            <div className="space-y-6 py-4">
              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">{t('production_order') || 'Production Order'}</p>
                  <p className="font-semibold">{selectedWorkOrder.production_order_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('operation') || 'Operation'}</p>
                  <p className="font-semibold">{selectedWorkOrder.operation_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('work_center') || 'Work Center'}</p>
                  <p className="font-semibold">{selectedWorkOrder.work_center_name || '-'}</p>
                </div>
              </div>

              {/* Progress */}
              <div>
                <h4 className="font-semibold mb-3">{t('progress') || 'Progress'}</h4>
                <div className="flex items-center gap-4">
                  <Progress
                    value={selectedWorkOrder.progress || 0}
                    className="flex-1 h-4"
                  />
                  <span className="font-bold text-lg">
                    {selectedWorkOrder.quantity_produced} / {selectedWorkOrder.quantity_to_produce}
                  </span>
                </div>
              </div>

              {/* Time Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-blue-600 font-medium">{t('expected_duration') || 'Expected Duration'}</p>
                  </div>
                  <p className="text-lg font-bold text-blue-700">
                    {selectedWorkOrder.expected_duration_minutes} {t('minutes') || 'min'}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-green-600 font-medium">{t('actual_duration') || 'Actual Duration'}</p>
                  </div>
                  <p className="text-lg font-bold text-green-700">
                    {selectedWorkOrder.actual_duration_minutes} {t('minutes') || 'min'}
                  </p>
                </div>
              </div>

              {/* Operator */}
              {selectedWorkOrder.operator_name && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                  <User className="w-5 h-5 text-slate-600" />
                  <div>
                    <p className="text-xs text-slate-500">{t('operator') || 'Operator'}</p>
                    <p className="font-medium">{selectedWorkOrder.operator_name}</p>
                  </div>
                </div>
              )}

              {/* Complete Form - Show only for in_progress */}
              {selectedWorkOrder.status === 'in_progress' && canUpdate(MODULES.MANUFACTURING) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    {t('complete_work_order') || 'Complete Work Order'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        {t('quantity_produced') || 'Quantity Produced'} *
                      </label>
                      <Input
                        type="number"
                        value={completeForm.quantity_produced}
                        onChange={(e) => setCompleteForm({...completeForm, quantity_produced: parseFloat(e.target.value) || 0})}
                        min="0"
                        max={selectedWorkOrder.quantity_to_produce - selectedWorkOrder.quantity_produced}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        {t('scrap_quantity') || 'Scrap Quantity'}
                      </label>
                      <Input
                        type="number"
                        value={completeForm.scrap_quantity}
                        onChange={(e) => setCompleteForm({...completeForm, scrap_quantity: parseFloat(e.target.value) || 0})}
                        min="0"
                      />
                    </div>
                    {completeForm.scrap_quantity > 0 && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium mb-1 block">
                          {t('scrap_reason') || 'Scrap Reason'}
                        </label>
                        <Input
                          value={completeForm.scrap_reason}
                          onChange={(e) => setCompleteForm({...completeForm, scrap_reason: e.target.value})}
                          placeholder={t('enter_scrap_reason') || 'Enter reason for scrap...'}
                        />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={completeForm.quality_check_passed}
                          onChange={(e) => setCompleteForm({...completeForm, quality_check_passed: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">
                          {t('quality_check_passed') || 'Quality Check Passed'}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={handleCompleteWorkOrder}
                      className="bg-gradient-to-r from-green-600 to-green-700"
                      disabled={completeForm.quantity_produced <= 0}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('mark_as_done') || 'Mark as Done'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Detail Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {selectedTransfer?.transfer_number}
              <Badge className={getTransferTypeColor(selectedTransfer?.transfer_type)}>
                {getTransferTypeLabel(selectedTransfer?.transfer_type)}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedTransfer && (
            <div className="space-y-6 py-4">
              {/* Transfer Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">{t('production_order') || 'Production Order'}</p>
                  <p className="font-semibold">{selectedTransfer.production_order_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('warehouse') || 'Warehouse'}</p>
                  <p className="font-semibold">{selectedTransfer.warehouse_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={getStatusColor(selectedTransfer.status)}>
                    {getStatusLabel(selectedTransfer.status)}
                  </Badge>
                </div>
              </div>

              {/* Location Flow */}
              <div className="flex items-center justify-center gap-4 p-4 bg-gradient-to-r from-orange-50 via-white to-green-50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-slate-500">{t('from') || 'From'}</p>
                  <p className="font-semibold">{selectedTransfer.source_location_name || '-'}</p>
                </div>
                <ChevronRight className="w-6 h-6 text-slate-400" />
                <div className="text-center">
                  <p className="text-xs text-slate-500">{t('to') || 'To'}</p>
                  <p className="font-semibold">{selectedTransfer.destination_location_name || '-'}</p>
                </div>
              </div>

              {/* Transfer Lines */}
              {selectedTransfer.lines && selectedTransfer.lines.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">{t('items_to_transfer') || 'Items to Transfer'}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('product') || 'Product'}</TableHead>
                        <TableHead>{t('demanded') || 'Demanded'}</TableHead>
                        <TableHead>{t('done') || 'Done'}</TableHead>
                        <TableHead>{t('lot') || 'Lot'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTransfer.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <p className="font-medium">{line.product_name}</p>
                            <p className="text-xs text-slate-500">{line.product_code}</p>
                          </TableCell>
                          <TableCell>{line.quantity_demanded} {line.uom}</TableCell>
                          <TableCell>
                            <span className={line.quantity_done >= line.quantity_demanded ? 'text-green-600 font-medium' : ''}>
                              {line.quantity_done}
                            </span>
                          </TableCell>
                          <TableCell>{line.lot_number || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Validate Button */}
              {selectedTransfer.status !== 'done' && canUpdate(MODULES.MANUFACTURING) && (
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => handleValidateTransfer(selectedTransfer.id)}
                    className="bg-gradient-to-r from-green-600 to-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('validate_transfer') || 'Validate Transfer'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
