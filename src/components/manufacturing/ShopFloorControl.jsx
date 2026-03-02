import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play,
  Pause,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Package,
  Users,
  Activity,
  Timer,
  BarChart3,
  Hammer,
  Settings as SettingsIcon,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { workOrdersService } from '@/api/services/manufacturing';
import { format, differenceInMinutes, parseISO } from 'date-fns';

const WORK_ORDER_STATUS = {
  pending: { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  ready: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  in_progress: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Play },
  paused: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Pause },
  completed: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  failed: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

export default function ShopFloorControl() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { workOrders, workCenters, startWorkOrder, completeWorkOrder, refreshData } = useManufacturing();

  const [selectedWorkCenter, setSelectedWorkCenter] = useState('all');
  const [activeWorkOrder, setActiveWorkOrder] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [timeLogs, setTimeLogs] = useState([]);
  const [currentTimer, setCurrentTimer] = useState(null);

  const [completionData, setCompletionData] = useState({
    quantity_produced: 0,
    quantity_scrapped: 0,
    notes: '',
  });

  const [pauseData, setPauseData] = useState({
    reason: '',
    notes: '',
  });

  // Load time logs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('genix_work_order_time_logs');
    if (stored) {
      setTimeLogs(JSON.parse(stored));
    }
  }, []);

  // Save time logs to localStorage
  useEffect(() => {
    if (timeLogs.length > 0) {
      localStorage.setItem('genix_work_order_time_logs', JSON.stringify(timeLogs));
    }
  }, [timeLogs]);

  // Timer effect
  useEffect(() => {
    if (activeWorkOrder && activeWorkOrder.status === 'in_progress') {
      const interval = setInterval(() => {
        setCurrentTimer(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeWorkOrder]);

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      const matchesWorkCenter = selectedWorkCenter === 'all' || wo.work_center_id === selectedWorkCenter;
      return matchesWorkCenter;
    });
  }, [workOrders, selectedWorkCenter]);

  // Get available work orders (pending, ready, in_progress, or paused)
  const availableWorkOrders = useMemo(() => {
    return filteredWorkOrders.filter(wo =>
      wo.status === 'pending' || wo.status === 'ready' || wo.status === 'in_progress' || wo.status === 'paused'
    );
  }, [filteredWorkOrders]);

  // Calculate time spent
  const calculateTimeSpent = (workOrder) => {
    const logs = timeLogs.filter(log => log.work_order_id === workOrder.id);
    const totalMinutes = logs.reduce((sum, log) => {
      if (log.end_time) {
        return sum + differenceInMinutes(parseISO(log.end_time), parseISO(log.start_time));
      } else if (workOrder.status === 'in_progress') {
        // Currently running
        return sum + differenceInMinutes(new Date(), parseISO(log.start_time));
      }
      return sum;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes, formatted: `${hours}h ${minutes}m` };
  };

  // Handle start work order - directly starts without modal
  const handleStartWorkOrder = async (workOrder) => {
    try {
      await startWorkOrder(workOrder.id);

      // Create time log
      const newLog = {
        id: `TL-${Date.now()}`,
        work_order_id: workOrder.id,
        start_time: new Date().toISOString(),
        end_time: null,
      };
      setTimeLogs(prev => [...prev, newLog]);
    } catch (error) {
      console.error('Failed to start work order:', error);
    }
  };

  // Handle pause work order
  const handlePauseWorkOrder = (workOrder) => {
    setActiveWorkOrder(workOrder);
    setShowPauseModal(true);
  };

  const confirmPauseWorkOrder = async () => {
    if (!activeWorkOrder) return;

    try {
      await workOrdersService.pause(activeWorkOrder.id);

      // End current time log
      setTimeLogs(prev => prev.map(log => {
        if (log.work_order_id === activeWorkOrder.id && !log.end_time) {
          return { ...log, end_time: new Date().toISOString() };
        }
        return log;
      }));

      await refreshData();
    } catch (error) {
      console.error('Failed to pause work order:', error);
    }

    setShowPauseModal(false);
    setPauseData({ reason: '', notes: '' });
    setActiveWorkOrder(null);
  };

  // Handle complete work order
  const handleCompleteWorkOrder = (workOrder) => {
    setActiveWorkOrder(workOrder);
    setCompletionData({
      quantity_produced: workOrder.quantity_planned || 0,
      quantity_scrapped: 0,
      notes: '',
    });
    setShowCompleteModal(true);
  };

  const confirmCompleteWorkOrder = async () => {
    if (!activeWorkOrder) return;

    try {
      const timeSpent = calculateTimeSpent(activeWorkOrder);

      await completeWorkOrder(activeWorkOrder.id, {
        quantity_produced: parseFloat(completionData.quantity_produced) || 0,
        quantity_scrapped: parseFloat(completionData.quantity_scrapped) || 0,
        actual_duration: timeSpent.totalMinutes,
        notes: completionData.notes,
      });

      // End current time log
      setTimeLogs(prev => prev.map(log => {
        if (log.work_order_id === activeWorkOrder.id && !log.end_time) {
          return { ...log, end_time: new Date().toISOString() };
        }
        return log;
      }));
    } catch (error) {
      console.error('Failed to complete work order:', error);
    }

    setShowCompleteModal(false);
    setCompletionData({ quantity_produced: 0, quantity_scrapped: 0, notes: '' });
    setActiveWorkOrder(null);
  };

  // Statistics
  const stats = useMemo(() => {
    const inProgress = workOrders.filter(wo => wo.status === 'in_progress').length;
    const completed = workOrders.filter(wo => wo.status === 'completed').length;
    const pending = workOrders.filter(wo => wo.status === 'ready' || wo.status === 'pending').length;
    const paused = workOrders.filter(wo => wo.status === 'paused').length;

    return { inProgress, completed, pending, paused };
  }, [workOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t('shop_floor_control') || "Ishlab chiqarish nazorati"}</h2>
          <p className="text-slate-600 mt-1">{t('shop_floor_desc') || "Ish buyurtmalarini boshqaring va bajarish jarayonini kuzating"}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedWorkCenter} onValueChange={setSelectedWorkCenter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('select_work_center') || "Ish markazini tanlang"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_work_centers') || "Barcha markazlar"}</SelectItem>
              {workCenters.filter(wc => wc.id).map(wc => (
                <SelectItem key={wc.id} value={wc.id}>{wc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Play className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-sm text-slate-500">{t('in_progress') || "Jarayonda"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-slate-500">{t('pending') || "Kutilmoqda"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-slate-500">{t('completed') || "Tugallandi"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Pause className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.paused}</p>
                <p className="text-sm text-slate-500">{t('paused') || "To'xtatilgan"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Work Orders */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            {t('active_work_orders') || "Faol ish buyurtmalari"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('work_order') || "Ish buyurtmasi"}</TableHead>
                <TableHead>{t('operation') || "Operatsiya"}</TableHead>
                <TableHead>{t('work_center') || "Ish markazi"}</TableHead>
                <TableHead>{t('quantity') || "Miqdor"}</TableHead>
                <TableHead>{t('progress') || "Progress"}</TableHead>
                <TableHead>{t('time_spent') || "Sarflangan vaqt"}</TableHead>
                <TableHead>{t('status') || "Holat"}</TableHead>
                <TableHead className="text-right">{t('actions') || "Amallar"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableWorkOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {t('no_active_work_orders') || "Faol ish buyurtmalari yo'q"}
                  </TableCell>
                </TableRow>
              ) : (
                availableWorkOrders.map(wo => {
                  const StatusIcon = WORK_ORDER_STATUS[wo.status]?.icon || Clock;
                  const timeSpent = calculateTimeSpent(wo);
                  const totalQty = wo.quantity_to_produce || wo.quantity_planned || 0;
                  const progress = totalQty ? ((wo.quantity_produced || 0) / totalQty) * 100 : 0;

                  return (
                    <TableRow key={wo.id}>
                      <TableCell className="font-medium">{wo.work_order_number || wo.code || wo.id?.substring(0, 8)}</TableCell>
                      <TableCell>{wo.operation_name || wo.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {wo.work_center_name || workCenters.find(wc => wc.id === wo.work_center_id)?.name || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{wo.quantity_produced || 0}</span>
                        <span className="text-slate-400"> / {wo.quantity_to_produce || wo.quantity_planned}</span>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-slate-500 mt-1">{progress.toFixed(0)}%</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Timer className="w-4 h-4 text-slate-400" />
                          <span className="text-sm">{timeSpent.formatted}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={WORK_ORDER_STATUS[wo.status]?.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {t(wo.status) || wo.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(wo.status === 'ready' || wo.status === 'pending') && (
                            <Button
                              size="sm"
                              onClick={() => handleStartWorkOrder(wo)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              {t('start') || "Boshlash"}
                            </Button>
                          )}
                          {wo.status === 'in_progress' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePauseWorkOrder(wo)}
                                className="border-orange-200 text-orange-600 hover:bg-orange-50"
                              >
                                <Pause className="w-4 h-4 mr-1" />
                                {t('pause') || "To'xtatish"}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleCompleteWorkOrder(wo)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {t('complete') || "Tugatish"}
                              </Button>
                            </>
                          )}
                          {wo.status === 'paused' && (
                            <Button
                              size="sm"
                              onClick={() => handleStartWorkOrder(wo)}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              {t('resume') || "Davom etish"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pause Work Order Modal */}
      <Dialog open={showPauseModal} onOpenChange={setShowPauseModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pause_work_order') || "Ish buyurtmasini to'xtatish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('pause_reason') || "To'xtatish sababi"} *</Label>
              <Select
                value={pauseData.reason}
                onValueChange={value => setPauseData({ ...pauseData, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_reason') || "Sababni tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="break">{t('break') || "Tanaffus"}</SelectItem>
                  <SelectItem value="material_shortage">{t('material_shortage') || "Material yetishmovchiligi"}</SelectItem>
                  <SelectItem value="equipment_issue">{t('equipment_issue') || "Jihoz muammosi"}</SelectItem>
                  <SelectItem value="quality_issue">{t('quality_issue') || "Sifat muammosi"}</SelectItem>
                  <SelectItem value="other">{t('other') || "Boshqa"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('notes') || "Izohlar"}</Label>
              <Textarea
                value={pauseData.notes}
                onChange={e => setPauseData({ ...pauseData, notes: e.target.value })}
                placeholder={t('enter_notes') || "Izoh kiriting..."}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowPauseModal(false)}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={confirmPauseWorkOrder}
                disabled={!pauseData.reason}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Pause className="w-4 h-4 mr-2" />
                {t('pause') || "To'xtatish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Work Order Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('complete_work_order') || "Ish buyurtmasini tugatish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {activeWorkOrder && (
              <div className="p-4 bg-green-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('work_order') || "Ish buyurtmasi"}</span>
                  <span className="font-medium">{activeWorkOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{t('planned_quantity') || "Rejalashtirilgan"}</span>
                  <span className="font-medium">{activeWorkOrder.quantity_planned}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('quantity_produced') || "Ishlab chiqarildi"} *</Label>
                <Input
                  type="number"
                  value={completionData.quantity_produced}
                  onChange={e => setCompletionData({ ...completionData, quantity_produced: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('quantity_scrapped') || "Yaroqsiz"}</Label>
                <Input
                  type="number"
                  value={completionData.quantity_scrapped}
                  onChange={e => setCompletionData({ ...completionData, quantity_scrapped: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('completion_notes') || "Izohlar"}</Label>
              <Textarea
                value={completionData.notes}
                onChange={e => setCompletionData({ ...completionData, notes: e.target.value })}
                placeholder={t('enter_completion_notes') || "Tugatish haqida izoh..."}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={confirmCompleteWorkOrder}
                disabled={!completionData.quantity_produced || parseFloat(completionData.quantity_produced) <= 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('complete_work') || "Ishni tugatish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
