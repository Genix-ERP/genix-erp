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
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
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
  const { workOrders, workCenters, startWorkOrder, pauseWorkOrder, completeWorkOrder, refreshData } = useManufacturing();

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
      await pauseWorkOrder(activeWorkOrder.id);

      // End current time log
      setTimeLogs(prev => prev.map(log => {
        if (log.work_order_id === activeWorkOrder.id && !log.end_time) {
          return { ...log, end_time: new Date().toISOString() };
        }
        return log;
      }));
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

  // Local translations for Shop Floor Control
  const labels = useMemo(() => {
    const tr = {
      uz: {
        title: "Ishlab chiqarish nazorati",
        subtitle: "Ish buyurtmalarini bajarish paneli",
        all_work_centers: "Barcha ish markazlari",
        in_progress: "Jarayonda",
        pending: "Kutilmoqda",
        completed: "Tugallandi",
        paused: "To'xtatilgan",
        active_work_orders: "Faol ish buyurtmalari",
        work_order: "Ish buyurtmasi",
        operation: "Operatsiya",
        work_center: "Ish markazi",
        quantity: "Miqdor",
        progress: "Jarayon",
        time_spent: "Sarflangan vaqt",
        status: "Holat",
        actions: "Amallar",
        no_active_work_orders: "Faol ish buyurtmalari yo'q",
        start: "Boshlash",
        pause: "To'xtatish",
        complete: "Tugatish",
        resume: "Davom etish",
      },
      ru: {
        title: "Управление цехом",
        subtitle: "Панель выполнения нарядов",
        all_work_centers: "Все рабочие центры",
        in_progress: "В процессе",
        pending: "Ожидание",
        completed: "Завершено",
        paused: "Приостановлено",
        active_work_orders: "Активные наряды",
        work_order: "Наряд",
        operation: "Операция",
        work_center: "Рабочий центр",
        quantity: "Количество",
        progress: "Прогресс",
        time_spent: "Затраченное время",
        status: "Статус",
        actions: "Действия",
        no_active_work_orders: "Нет активных нарядов",
        start: "Начать",
        pause: "Пауза",
        complete: "Завершить",
        resume: "Продолжить",
      },
      en: {
        title: "Shop Floor Control",
        subtitle: "Worker dashboard for executing work orders",
        all_work_centers: "All Work Centers",
        in_progress: "In Progress",
        pending: "Pending",
        completed: "Completed",
        paused: "Paused",
        active_work_orders: "Active Work Orders",
        work_order: "Work Order",
        operation: "Operation",
        work_center: "Work Center",
        quantity: "Quantity",
        progress: "Progress",
        time_spent: "Time Spent",
        status: "Status",
        actions: "Actions",
        no_active_work_orders: "No active work orders",
        start: "Start",
        pause: "Pause",
        complete: "Complete",
        resume: "Resume",
      }
    };
    return tr[language] || tr.en;
  }, [language]);

  const statusLabel = (status) => {
    const map = { in_progress: labels.in_progress, pending: labels.pending, completed: labels.completed, paused: labels.paused };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{labels.title}</h2>
          <p className="text-slate-600 mt-1">{labels.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedWorkCenter} onValueChange={setSelectedWorkCenter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={labels.all_work_centers} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labels.all_work_centers}</SelectItem>
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
                <p className="text-sm text-slate-500">{labels.in_progress}</p>
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
                <p className="text-sm text-slate-500">{labels.pending}</p>
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
                <p className="text-sm text-slate-500">{labels.completed}</p>
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
                <p className="text-sm text-slate-500">{labels.paused}</p>
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
            {labels.active_work_orders}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.work_order}</TableHead>
                <TableHead>{labels.operation}</TableHead>
                <TableHead>{labels.work_center}</TableHead>
                <TableHead>{labels.quantity}</TableHead>
                <TableHead>{labels.progress}</TableHead>
                <TableHead>{labels.time_spent}</TableHead>
                <TableHead>{labels.status}</TableHead>
                <TableHead className="text-right">{labels.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableWorkOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {labels.no_active_work_orders}
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
                          {statusLabel(wo.status)}
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
                              {labels.start}
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
                                {labels.pause}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleCompleteWorkOrder(wo)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {labels.complete}
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
                              {labels.resume}
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
            <DialogTitle>{language === 'uz' ? "Ish buyurtmasini to'xtatish" : language === 'ru' ? "Приостановить наряд" : "Pause Work Order"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'uz' ? "To'xtatish sababi" : language === 'ru' ? "Причина приостановки" : "Pause Reason"} *</Label>
              <Select
                value={pauseData.reason}
                onValueChange={value => setPauseData({ ...pauseData, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'uz' ? "Sababni tanlang" : language === 'ru' ? "Выберите причину" : "Select reason"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="break">{language === 'uz' ? "Tanaffus" : language === 'ru' ? "Перерыв" : "Break"}</SelectItem>
                  <SelectItem value="material_shortage">{language === 'uz' ? "Material yetishmovchiligi" : language === 'ru' ? "Нехватка материала" : "Material Shortage"}</SelectItem>
                  <SelectItem value="equipment_issue">{language === 'uz' ? "Jihoz muammosi" : language === 'ru' ? "Проблема с оборудованием" : "Equipment Issue"}</SelectItem>
                  <SelectItem value="quality_issue">{language === 'uz' ? "Sifat muammosi" : language === 'ru' ? "Проблема качества" : "Quality Issue"}</SelectItem>
                  <SelectItem value="other">{language === 'uz' ? "Boshqa" : language === 'ru' ? "Другое" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'uz' ? "Izohlar" : language === 'ru' ? "Примечания" : "Notes"}</Label>
              <Textarea
                value={pauseData.notes}
                onChange={e => setPauseData({ ...pauseData, notes: e.target.value })}
                placeholder={language === 'uz' ? "Izoh kiriting..." : language === 'ru' ? "Введите заметки..." : "Enter notes..."}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowPauseModal(false)}>
                {language === 'uz' ? "Bekor qilish" : language === 'ru' ? "Отмена" : "Cancel"}
              </Button>
              <Button
                onClick={confirmPauseWorkOrder}
                disabled={!pauseData.reason}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Pause className="w-4 h-4 mr-2" />
                {language === 'uz' ? "To'xtatish" : language === 'ru' ? "Приостановить" : "Pause"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Work Order Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'uz' ? "Ish buyurtmasini tugatish" : language === 'ru' ? "Завершить наряд" : "Complete Work Order"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {activeWorkOrder && (
              <div className="p-4 bg-green-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{language === 'uz' ? "Ish buyurtmasi" : language === 'ru' ? "Наряд" : "Work Order"}</span>
                  <span className="font-medium">{activeWorkOrder.work_order_number || activeWorkOrder.code || activeWorkOrder.id?.substring(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{language === 'uz' ? "Rejalashtirilgan" : language === 'ru' ? "Запланировано" : "Planned Quantity"}</span>
                  <span className="font-medium">{activeWorkOrder.quantity_to_produce || activeWorkOrder.quantity_planned}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'uz' ? "Ishlab chiqarildi" : language === 'ru' ? "Произведено" : "Quantity Produced"} *</Label>
                <Input
                  type="number"
                  value={completionData.quantity_produced}
                  onChange={e => setCompletionData({ ...completionData, quantity_produced: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'uz' ? "Yaroqsiz" : language === 'ru' ? "Брак" : "Scrapped"}</Label>
                <Input
                  type="number"
                  value={completionData.quantity_scrapped}
                  onChange={e => setCompletionData({ ...completionData, quantity_scrapped: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'uz' ? "Izohlar" : language === 'ru' ? "Примечания" : "Notes"}</Label>
              <Textarea
                value={completionData.notes}
                onChange={e => setCompletionData({ ...completionData, notes: e.target.value })}
                placeholder={language === 'uz' ? "Tugatish haqida izoh..." : language === 'ru' ? "Заметки о завершении..." : "Completion notes..."}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
                {language === 'uz' ? "Bekor qilish" : language === 'ru' ? "Отмена" : "Cancel"}
              </Button>
              <Button
                onClick={confirmCompleteWorkOrder}
                disabled={!completionData.quantity_produced || parseFloat(completionData.quantity_produced) <= 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {language === 'uz' ? "Ishni tugatish" : language === 'ru' ? "Завершить" : "Complete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
