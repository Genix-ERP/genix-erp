import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // used in Materials modal
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
  RefreshCw,
} from 'lucide-react';
import { Trash2, Paperclip, Upload, FileText, Image, X } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useInventory } from '@/components/contexts/InventoryContext';
import { workOrdersService, productionOrdersService } from '@/api/services/manufacturing';
import { toast } from 'sonner';
import { format, differenceInMinutes, parseISO } from 'date-fns';

const WORK_ORDER_STATUS = {
  pending: { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  ready: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  in_progress: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Play },
  paused: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Pause },
  completed: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  failed: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

function KanbanCard({ wo, labels, language, workCenters, productionOrders, currentTimer, calculateTimeSpent, onStart, onPause, onComplete, onMaterials, onAttachments }) {
  const StatusIcon = WORK_ORDER_STATUS[wo.status]?.icon || Clock;
  const timeSpent = calculateTimeSpent(wo);
  const totalQty = wo.quantity_to_produce || 0;
  const po = productionOrders?.find(p => p.id === wo.production_order_id);
  const wcName = wo.work_center_name || workCenters.find(wc => wc.id === wo.work_center_id)?.name || '-';

  const progress = (() => {
    if ((wo.quantity_produced || 0) > 0 && totalQty > 0) {
      return Math.min(100, (wo.quantity_produced / totalQty) * 100);
    }
    if (wo.status === 'in_progress' && wo.actual_start && (wo.expected_duration_minutes || 0) > 0) {
      void currentTimer;
      const elapsed = differenceInMinutes(new Date(), parseISO(wo.actual_start));
      return Math.min(99, (elapsed / wo.expected_duration_minutes) * 100);
    }
    return 0;
  })();

  const statusColors = {
    pending: 'bg-blue-50 border-l-blue-400',
    ready: 'bg-blue-50 border-l-blue-400',
    in_progress: 'bg-amber-50 border-l-amber-400',
    paused: 'bg-orange-50 border-l-orange-400',
    completed: 'bg-green-50 border-l-green-400',
    failed: 'bg-red-50 border-l-red-400',
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${statusColors[wo.status] || 'border-l-slate-300'} shadow-sm hover:shadow-md transition-shadow p-4 space-y-3`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{wo.operation_name || wo.name || '-'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{wo.work_order_number || wo.code || wo.id?.substring(0, 8)}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-xs ${WORK_ORDER_STATUS[wo.status]?.color}`}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {wo.status === 'in_progress' ? labels.in_progress : wo.status === 'paused' ? labels.paused : wo.status === 'completed' ? labels.completed : labels.pending}
        </Badge>
      </div>

      {/* Production order */}
      {po && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Package className="w-3.5 h-3.5 shrink-0 text-blue-400" />
          <span className="truncate font-medium text-slate-600">{po.code || po.product_name}</span>
          {po.product_name && po.code && <span className="truncate text-slate-400">— {po.product_name}</span>}
        </div>
      )}

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{labels.quantity}: <span className="font-medium text-slate-700">{wo.quantity_produced || 0} / {totalQty}</span></span>
          <span className="font-medium">{progress.toFixed(0)}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Time spent */}
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <Timer className="w-3.5 h-3.5" />
        <span>{timeSpent.formatted}</span>
      </div>

      {/* Actions */}
      {wo.status !== 'completed' && wo.status !== 'failed' && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMaterials(wo)}
            className="h-7 px-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Package className="w-3.5 h-3.5 mr-1" />
            {language === 'uz' ? 'Mat.' : language === 'ru' ? 'Мат.' : 'Mat.'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAttachments(wo)}
            className="h-7 px-2 text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            <Paperclip className="w-3.5 h-3.5 mr-1" />
            {language === 'uz' ? 'Fayllar' : language === 'ru' ? 'Файлы' : 'Files'}
          </Button>

          {(wo.status === 'pending' || wo.status === 'ready') && (
            <Button size="sm" onClick={() => onStart(wo)} className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 flex-1">
              <Play className="w-3.5 h-3.5 mr-1" />
              {labels.start}
            </Button>
          )}

          {wo.status === 'in_progress' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onPause(wo)} className="h-7 px-2 text-xs border-orange-200 text-orange-600 hover:bg-orange-50">
                <Pause className="w-3.5 h-3.5 mr-1" />
                {labels.pause}
              </Button>
              <Button size="sm" onClick={() => onComplete(wo)} className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 flex-1">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                {labels.complete}
              </Button>
            </>
          )}

          {wo.status === 'paused' && (
            <Button size="sm" onClick={() => onStart(wo)} className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 flex-1">
              <Play className="w-3.5 h-3.5 mr-1" />
              {labels.resume}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ title, count, headerColor, titleColor, countColor, workOrders, labels, language, workCenters, productionOrders, currentTimer, calculateTimeSpent, onStart, onPause, onComplete, onMaterials, onAttachments }) {
  return (
    <div className="w-72 shrink-0 flex flex-col gap-3 h-full">
      {/* Column header */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border shrink-0 ${headerColor}`}>
        <span className={`font-semibold text-sm ${titleColor}`}>{title}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${countColor}`}>{count}</span>
      </div>

      {/* Cards — scrollable within the fixed column height */}
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {workOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400 text-xs bg-slate-50/50">
            —
          </div>
        ) : (
          workOrders.map(wo => (
            <KanbanCard
              key={wo.id}
              wo={wo}
              labels={labels}
              language={language}
              workCenters={workCenters}
              productionOrders={productionOrders}
              currentTimer={currentTimer}
              calculateTimeSpent={calculateTimeSpent}
              onStart={onStart}
              onPause={onPause}
              onComplete={onComplete}
              onMaterials={onMaterials}
              onAttachments={onAttachments}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function ShopFloorControl({ isActive }) {
  const { language } = useLanguage();
  const { workOrders, workCenters, productionOrders, manufacturingCategories, startWorkOrder, pauseWorkOrder, completeWorkOrder, refreshData } = useManufacturing();
  const { refreshData: refreshInventory, products, warehouses } = useInventory();

  const [selectedWorkCenter, setSelectedWorkCenter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeWorkOrder, setActiveWorkOrder] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [timeLogs, setTimeLogs] = useState([]);
  const [currentTimer, setCurrentTimer] = useState(null);
  const autoCompletedRef = useRef(new Set()); // guard against firing multiple times

  const [completionData, setCompletionData] = useState({
    quantity_produced: 0,
    quantity_scrapped: 0,
    notes: '',
  });

  const [pauseData, setPauseData] = useState({
    reason: '',
    notes: '',
  });

  // Materials modal state
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [materialsWorkOrder, setMaterialsWorkOrder] = useState(null);
  const [woMaterials, setWoMaterials] = useState([]);
  const [woMaterialsTotalCost, setWoMaterialsTotalCost] = useState(0);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ product_id: '', quantity: '', unit_cost: '', notes: '' });
  const [productSearch, setProductSearch] = useState('');
  const [productSearchFocused, setProductSearchFocused] = useState(false);

  // Attachments modal state
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [attachmentsWorkOrder, setAttachmentsWorkOrder] = useState(null);
  const [woAttachments, setWoAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Split output modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitPoId, setSplitPoId] = useState(null);
  const [splitItems, setSplitItems] = useState([{ product_id: '', quantity: '', warehouse_id: '' }]);
  const [splitSubmitting, setSplitSubmitting] = useState(false);

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

  // Refresh data when tab becomes active
  useEffect(() => {
    if (isActive) {
      refreshData();
    }
  }, [isActive]);

  // Build a map of production_order_id -> manufacturing_category_id for category filtering
  const poCategoryMap = useMemo(() => {
    const map = {};
    (productionOrders || []).forEach(po => {
      if (po.manufacturing_category_id) {
        map[po.id] = po.manufacturing_category_id;
      }
    });
    return map;
  }, [productionOrders]);

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      const matchesWorkCenter = selectedWorkCenter === 'all' || wo.work_center_id === selectedWorkCenter;
      const matchesCategory = selectedCategory === 'all' || poCategoryMap[wo.production_order_id] === selectedCategory;
      return matchesWorkCenter && matchesCategory;
    });
  }, [workOrders, selectedWorkCenter, selectedCategory, poCategoryMap]);

  // Get available work orders (pending, ready, in_progress, or paused)
  const availableWorkOrders = useMemo(() => {
    return filteredWorkOrders.filter(wo =>
      wo.status === 'pending' || wo.status === 'ready' || wo.status === 'in_progress' || wo.status === 'paused'
    );
  }, [filteredWorkOrders]);

  // Timer effect — tick every second and auto-complete when planned duration is reached
  useEffect(() => {
    const hasInProgress = availableWorkOrders.some(wo => wo.status === 'in_progress');
    if (!hasInProgress) return;
    const interval = setInterval(() => {
      setCurrentTimer(Date.now());

      // Auto-complete any in_progress work order whose planned duration has elapsed
      availableWorkOrders.forEach(wo => {
        if (wo.status !== 'in_progress' || !wo.actual_start || !wo.expected_duration_minutes) return;
        if (autoCompletedRef.current.has(wo.id)) return;
        const elapsed = differenceInMinutes(new Date(), parseISO(wo.actual_start));
        if (elapsed >= wo.expected_duration_minutes) {
          autoCompletedRef.current.add(wo.id);
          completeWorkOrder(wo.id, {
            quantity_produced: wo.quantity_to_produce || 0,
            quantity_scrapped: 0,
            actual_duration: elapsed,
            notes: '',
          }).then(() => { refreshData(); refreshInventory(); }).catch(() => {
            autoCompletedRef.current.delete(wo.id); // retry next tick if failed
          });
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [availableWorkOrders, completeWorkOrder, refreshData]);

  // Kanban columns: group active work orders by work center (operation stage)
  const kanbanColumns = useMemo(() => {
    const active = filteredWorkOrders.filter(wo =>
      wo.status === 'pending' || wo.status === 'ready' ||
      wo.status === 'in_progress' || wo.status === 'paused'
    );
    // Collect unique work centers preserving first-seen order (sorted by sequence)
    const seen = new Map(); // id -> { id, name }
    active.forEach(wo => {
      const id = wo.work_center_id || '__none__';
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          name: wo.work_center_name || workCenters.find(wc => wc.id === id)?.name || (language === 'uz' ? 'Belgilanmagan' : language === 'ru' ? 'Не назначен' : 'Unassigned'),
        });
      }
    });
    return Array.from(seen.values()).map(wc => ({
      ...wc,
      workOrders: active.filter(wo => (wo.work_center_id || '__none__') === wc.id)
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0)),
    }));
  }, [filteredWorkOrders, workCenters, language]);

  // Calculate time spent using backend actual_start / actual_duration_minutes
  const calculateTimeSpent = (workOrder) => {
    let totalMinutes = 0;

    if (workOrder.status === 'in_progress' && workOrder.actual_start) {
      // Live: count from actual_start to now
      totalMinutes = differenceInMinutes(new Date(), parseISO(workOrder.actual_start));
    } else if (workOrder.actual_duration_minutes) {
      // Completed or paused: use stored duration
      totalMinutes = workOrder.actual_duration_minutes;
    }

    // currentTimer referenced so this re-runs every second while in progress
    void currentTimer;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes, formatted: `${hours}h ${minutes}m` };
  };

  // Handle start work order - directly starts without modal
  const handleStartWorkOrder = async (workOrder) => {
    try {
      await startWorkOrder(workOrder.id);
      refreshData(); // sync with backend (backend may auto-start next WO)
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
      refreshData();
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
      quantity_produced: workOrder.quantity_to_produce || 0,
      quantity_scrapped: 0,
      notes: '',
    });
    setShowCompleteModal(true);
  };

  const confirmCompleteWorkOrder = async () => {
    if (!activeWorkOrder) return;

    const poId = activeWorkOrder.production_order_id;

    // Capture values before closing the modal
    const produced = parseFloat(completionData.quantity_produced) || 0;
    const scrapped = parseFloat(completionData.quantity_scrapped) || 0;
    const notes = completionData.notes;

    // Close the complete modal first to avoid overlap with split modal
    setShowCompleteModal(false);
    setCompletionData({ quantity_produced: 0, quantity_scrapped: 0, notes: '' });

    try {
      const timeSpent = calculateTimeSpent(activeWorkOrder);

      await completeWorkOrder(activeWorkOrder.id, {
        quantity_produced: produced,
        scrap_quantity: scrapped,
        actual_duration: timeSpent.totalMinutes,
        notes: notes,
      });

      refreshData();
      refreshInventory();

      // Check if the production order moved to "packaging" (split output)
      if (poId) {
        try {
          const po = await productionOrdersService.get(poId);
          console.log('Split output check: PO status =', po?.status, 'has_split_output =', po?.has_split_output);
          if (po && (po.status === 'packaging' || (po.status === 'completed' && po.has_split_output))) {
            setSplitPoId(poId);
            setSplitItems([{ product_id: '', quantity: '', warehouse_id: '' }]);
            setShowSplitModal(true);
          }
        } catch (splitErr) {
          console.error('Failed to check split output status:', splitErr);
        }
      }
    } catch (error) {
      console.error('Failed to complete work order:', error);
    }

    setActiveWorkOrder(null);
  };

  // Split output handlers
  const handleSplitSubmit = async () => {
    const validItems = splitItems.filter(it => it.product_id && parseFloat(it.quantity) > 0);
    if (!validItems.length) return;

    setSplitSubmitting(true);
    try {
      await productionOrdersService.completeSplitOutput(splitPoId, {
        items: validItems.map(it => ({
          product_id: it.product_id,
          quantity: parseFloat(it.quantity),
          ...(it.warehouse_id ? { warehouse_id: it.warehouse_id } : {}),
        })),
      });
      toast.success(language === 'uz' ? 'Chiqish yakunlandi' : language === 'ru' ? 'Упаковка завершена' : 'Split output completed');
      setShowSplitModal(false);
      setSplitPoId(null);
      refreshData();
      refreshInventory();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    }
    setSplitSubmitting(false);
  };

  const addSplitItem = () => setSplitItems(prev => [...prev, { product_id: '', quantity: '', warehouse_id: '' }]);
  const removeSplitItem = (idx) => setSplitItems(prev => prev.filter((_, i) => i !== idx));
  const updateSplitItem = (idx, field, value) => setSplitItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  // Materials handlers
  const handleOpenMaterials = async (workOrder) => {
    setMaterialsWorkOrder(workOrder);
    setShowMaterialsModal(true);
    setMaterialsLoading(true);
    try {
      const data = await workOrdersService.getMaterials(workOrder.id);
      setWoMaterials(data?.materials || []);
      setWoMaterialsTotalCost(data?.total_cost || 0);
    } catch {
      setWoMaterials([]);
      setWoMaterialsTotalCost(0);
    }
    setMaterialsLoading(false);
  };

  const handleAddMaterial = async () => {
    if (!materialsWorkOrder || !newMaterial.product_id || !newMaterial.quantity) return;
    try {
      await workOrdersService.addMaterial(materialsWorkOrder.id, {
        product_id: newMaterial.product_id,
        quantity: parseFloat(newMaterial.quantity),
        unit_cost: parseFloat(newMaterial.unit_cost) || 0,
        notes: newMaterial.notes || null,
      });
      // Refresh materials list
      const data = await workOrdersService.getMaterials(materialsWorkOrder.id);
      setWoMaterials(data?.materials || []);
      setWoMaterialsTotalCost(data?.total_cost || 0);
      setNewMaterial({ product_id: '', quantity: '', unit_cost: '', notes: '' });
      setProductSearch('');
      toast.success('Material added');
    } catch (err) {
      toast.error('Failed to add material: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRemoveMaterial = async (materialId) => {
    if (!materialsWorkOrder) return;
    try {
      await workOrdersService.removeMaterial(materialsWorkOrder.id, materialId);
      const data = await workOrdersService.getMaterials(materialsWorkOrder.id);
      setWoMaterials(data?.materials || []);
      setWoMaterialsTotalCost(data?.total_cost || 0);
      toast.success('Material removed');
    } catch {
      toast.error('Failed to remove material');
    }
  };

  // Attachments handlers
  const handleOpenAttachments = async (workOrder) => {
    setAttachmentsWorkOrder(workOrder);
    setShowAttachmentsModal(true);
    setAttachmentsLoading(true);
    try {
      const data = await workOrdersService.getAttachments(workOrder.id);
      setWoAttachments(data || []);
    } catch {
      setWoAttachments([]);
    }
    setAttachmentsLoading(false);
  };

  const handleUploadAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !attachmentsWorkOrder) return;
    setUploadingFile(true);
    try {
      await workOrdersService.uploadAttachment(attachmentsWorkOrder.id, file);
      const data = await workOrdersService.getAttachments(attachmentsWorkOrder.id);
      setWoAttachments(data || []);
      toast.success(language === 'uz' ? 'Fayl yuklandi' : 'File uploaded');
    } catch {
      toast.error('Failed to upload file');
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!attachmentsWorkOrder) return;
    try {
      await workOrdersService.deleteAttachment(attachmentsWorkOrder.id, attachmentId);
      setWoAttachments(prev => prev.filter(a => a.id !== attachmentId));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return Image;
    return FileText;
  };

  const getApiBase = () => {
    const base = import.meta.env.VITE_API_URL || '';
    return base.replace('/api/v1', '');
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

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          size="sm"
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('all')}
          className={selectedCategory === 'all' ? 'bg-slate-800 text-white' : ''}
        >
          {labels.all || 'All'}
        </Button>
        {(manufacturingCategories || []).filter(c => c.is_active).map(cat => (
          <Button
            key={cat.id}
            size="sm"
            variant={selectedCategory === cat.id ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(cat.id)}
            className={selectedCategory === cat.id ? 'bg-slate-800 text-white' : ''}
          >
            {cat.name}
          </Button>
        ))}
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

      {/* Kanban Board — columns per work center / operation stage */}
      <div>
        <div className="flex items-center gap-2 px-1 mb-4">
          <Activity className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-800">{labels.active_work_orders}</h3>
          <span className="text-sm text-slate-400">({availableWorkOrders.length})</span>
        </div>

        {kanbanColumns.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="py-12 text-center text-slate-500">
              {labels.no_active_work_orders}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto" style={{ height: 'calc(100vh - 420px)', minHeight: '400px' }}>
            <div className="flex gap-4 min-w-max h-full">
              {kanbanColumns.map(col => (
                <KanbanColumn
                  key={col.id}
                  title={col.name}
                  count={col.workOrders.length}
                  headerColor="bg-slate-50 border-slate-200"
                  titleColor="text-slate-700"
                  countColor="bg-slate-200 text-slate-600"
                  workOrders={col.workOrders}
                  labels={labels}
                  language={language}
                  workCenters={workCenters}
                  productionOrders={productionOrders}
                  currentTimer={currentTimer}
                  calculateTimeSpent={calculateTimeSpent}
                  onStart={handleStartWorkOrder}
                  onPause={handlePauseWorkOrder}
                  onComplete={handleCompleteWorkOrder}
                  onMaterials={handleOpenMaterials}
                  onAttachments={handleOpenAttachments}
                />
              ))}
            </div>
          </div>
        )}
      </div>

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
                  <span className="font-medium">{activeWorkOrder.quantity_to_produce || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">{language === 'uz' ? "Allaqachon ishlab chiqarilgan" : language === 'ru' ? "Уже произведено" : "Already Produced"}</span>
                  <span className="font-medium text-green-700">{activeWorkOrder.quantity_produced || 0}</span>
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
                  onChange={e => {
                    const scrap = parseFloat(e.target.value) || 0;
                    const planned = activeWorkOrder?.quantity_to_produce || 0;
                    setCompletionData({
                      ...completionData,
                      quantity_scrapped: e.target.value,
                      quantity_produced: Math.max(0, planned - scrap),
                    });
                  }}
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

      {/* Materials Modal */}
      <Dialog open={showMaterialsModal} onOpenChange={(open) => { setShowMaterialsModal(open); if (!open) { setMaterialsWorkOrder(null); setWoMaterials([]); setNewMaterial({ product_id: '', quantity: '', unit_cost: '', notes: '' }); setProductSearch(''); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {language === 'uz' ? 'Ishlatilgan materiallar' : language === 'ru' ? 'Использованные материалы' : 'Used Materials'}
              {materialsWorkOrder && (
                <Badge variant="outline" className="ml-2">{materialsWorkOrder.name || materialsWorkOrder.code}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Existing materials list */}
            {materialsLoading ? (
              <div className="text-center py-6 text-slate-500">
                {language === 'uz' ? 'Yuklanmoqda...' : language === 'ru' ? 'Загрузка...' : 'Loading...'}
              </div>
            ) : woMaterials.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">{language === 'uz' ? 'Mahsulot' : language === 'ru' ? 'Продукт' : 'Product'}</TableHead>
                      <TableHead className="text-xs text-right">{language === 'uz' ? 'Miqdor' : language === 'ru' ? 'Кол-во' : 'Qty'}</TableHead>
                      <TableHead className="text-xs text-right">{language === 'uz' ? 'Narx' : language === 'ru' ? 'Цена' : 'Unit Cost'}</TableHead>
                      <TableHead className="text-xs text-right">{language === 'uz' ? 'Jami' : language === 'ru' ? 'Итого' : 'Total'}</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {woMaterials.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{m.product_name}</p>
                          {m.notes && <p className="text-xs text-slate-400">{m.notes}</p>}
                        </TableCell>
                        <TableCell className="text-right">{m.quantity} {m.uom}</TableCell>
                        <TableCell className="text-right">{Number(m.unit_cost).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{Number(m.total_cost).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveMaterial(m.id)}
                            className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-t font-medium text-sm">
                  <span>{language === 'uz' ? 'Jami xarajat' : language === 'ru' ? 'Общая стоимость' : 'Total Cost'}:</span>
                  <span className="text-lg">{Number(woMaterialsTotalCost).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-lg">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">
                  {language === 'uz' ? 'Materiallar hali qo\'shilmagan' : language === 'ru' ? 'Материалы еще не добавлены' : 'No materials added yet'}
                </p>
              </div>
            )}

            {/* Add new material form */}
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <p className="text-sm font-medium">
                {language === 'uz' ? 'Material qo\'shish' : language === 'ru' ? 'Добавить материал' : 'Add Material'}
              </p>

              {/* Product search and select */}
              <div>
                <Input
                  placeholder={language === 'uz' ? 'Mahsulot qidirish...' : language === 'ru' ? 'Поиск продукта...' : 'Search product...'}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onFocus={() => setProductSearchFocused(true)}
                  onBlur={() => setTimeout(() => setProductSearchFocused(false), 200)}
                />
                {productSearchFocused && (
                  <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto bg-white shadow-lg">
                    {(products || [])
                      .filter(p => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase()))
                      .slice(0, 15)
                      .map(p => (
                        <div
                          key={p.id}
                          className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm flex justify-between"
                          onClick={() => {
                            setNewMaterial(prev => ({ ...prev, product_id: p.id, unit_cost: p.cost_price || p.price || 0 }));
                            setProductSearch(p.name);
                            setProductSearchFocused(false);
                          }}
                        >
                          <span>{p.name}</span>
                          <span className="text-slate-400">{p.sku}</span>
                        </div>
                      ))}
                    {(products || []).filter(p => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-400 text-center">
                        {language === 'uz' ? 'Mahsulot topilmadi' : language === 'ru' ? 'Продукт не найден' : 'No products found'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">{language === 'uz' ? 'Miqdor' : language === 'ru' ? 'Кол-во' : 'Quantity'}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newMaterial.quantity}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{language === 'uz' ? 'Narx' : language === 'ru' ? 'Цена' : 'Unit Cost'}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newMaterial.unit_cost}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, unit_cost: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{language === 'uz' ? 'Izoh' : language === 'ru' ? 'Примечание' : 'Notes'}</Label>
                  <Input
                    placeholder=""
                    value={newMaterial.notes}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={handleAddMaterial}
                disabled={!newMaterial.product_id || !newMaterial.quantity}
                className="w-full bg-gradient-to-r from-slate-700 to-slate-800"
              >
                <Package className="w-4 h-4 mr-2" />
                {language === 'uz' ? 'Qo\'shish' : language === 'ru' ? 'Добавить' : 'Add'}
              </Button>
            </div>

            <Button variant="outline" onClick={() => setShowMaterialsModal(false)} className="w-full">
              {language === 'uz' ? 'Yopish' : language === 'ru' ? 'Закрыть' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachments Modal */}
      <Dialog open={showAttachmentsModal} onOpenChange={(open) => { setShowAttachmentsModal(open); if (!open) { setAttachmentsWorkOrder(null); setWoAttachments([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              {language === 'uz' ? 'Fayllar' : language === 'ru' ? 'Файлы' : 'Attachments'}
              {attachmentsWorkOrder && <span className="text-sm font-normal text-slate-500">— {attachmentsWorkOrder.name}</span>}
            </DialogTitle>
          </DialogHeader>

          {/* Upload button */}
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <input type="file" className="hidden" onChange={handleUploadAttachment} disabled={uploadingFile} accept="image/*,.pdf,.doc,.docx,.dwg,.dxf" />
              <div className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${uploadingFile ? 'border-slate-200 bg-slate-50' : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50'}`}>
                <Upload className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-purple-600 font-medium">
                  {uploadingFile
                    ? (language === 'uz' ? 'Yuklanmoqda...' : 'Uploading...')
                    : (language === 'uz' ? 'Fayl yuklash (rasm, chizma, PDF)' : language === 'ru' ? 'Загрузить файл (фото, чертёж, PDF)' : 'Upload file (image, drawing, PDF)')}
                </span>
              </div>
            </label>
          </div>

          {/* Attachments list */}
          {attachmentsLoading ? (
            <div className="text-center py-8 text-slate-400">{language === 'uz' ? 'Yuklanmoqda...' : 'Loading...'}</div>
          ) : woAttachments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {language === 'uz' ? 'Fayllar yo\'q' : language === 'ru' ? 'Файлов нет' : 'No files yet'}
            </div>
          ) : (
            <div className="grid gap-3">
              {woAttachments.map((att) => {
                const isImage = att.mime_type?.startsWith('image/');
                const FileIcon = getFileIcon(att.mime_type);
                const fileUrl = `${getApiBase()}${att.url}`;
                return (
                  <div key={att.id} className="border rounded-lg overflow-hidden">
                    {isImage && (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                        <img src={fileUrl} alt={att.original_name} className="w-full max-h-[300px] object-contain bg-slate-50" />
                      </a>
                    )}
                    <div className="flex items-center justify-between p-3 bg-white">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate">
                          {att.original_name}
                        </a>
                        <span className="text-xs text-slate-400 flex-shrink-0">{(att.file_size / 1024).toFixed(0)} KB</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAttachment(att.id)} className="text-red-500 hover:text-red-700 h-7 w-7 p-0 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Split Output Modal */}
      <Dialog open={showSplitModal} onOpenChange={setShowSplitModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'uz' ? 'Mahsulotlarga bo\'lish' : language === 'ru' ? 'Разделить на продукты' : 'Split Output — Packaging'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              {language === 'uz'
                ? 'Ommaviy mahsulot qanday qadoq mahsulotlarga bo\'linganini kiriting.'
                : language === 'ru'
                ? 'Укажите, на какие упакованные продукты разделяется выпуск.'
                : 'Enter how the bulk output is split into packaged products.'}
            </p>

            {splitItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border border-slate-100 rounded-lg p-3">
                <div className="col-span-5 space-y-1">
                  <Label className="text-xs">{language === 'uz' ? 'Mahsulot' : language === 'ru' ? 'Продукт' : 'Product'} *</Label>
                  <select
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white"
                    value={item.product_id}
                    onChange={(e) => updateSplitItem(idx, 'product_id', e.target.value)}
                  >
                    <option value="">— {language === 'uz' ? 'tanlang' : language === 'ru' ? 'выбрать' : 'select'} —</option>
                    {(products || []).filter(p => p.can_be_sold || p.is_sellable).map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.weight ? `(${p.weight} kg)` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">{language === 'uz' ? 'Dona soni' : language === 'ru' ? 'Кол-во шт.' : 'Quantity (pcs)'} *</Label>
                  <Input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={item.quantity}
                    onChange={(e) => updateSplitItem(idx, 'quantity', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">{language === 'uz' ? 'Sklad' : language === 'ru' ? 'Склад' : 'Warehouse'}</Label>
                  <select
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white"
                    value={item.warehouse_id}
                    onChange={(e) => updateSplitItem(idx, 'warehouse_id', e.target.value)}
                  >
                    <option value="">{language === 'uz' ? 'Tanlang' : language === 'ru' ? 'Выбрать' : 'Select'}</option>
                    {(warehouses || []).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex justify-center">
                  {splitItems.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeSplitItem(idx)} className="text-red-500 hover:text-red-700 p-1 h-auto">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addSplitItem} className="w-full border-dashed">
              + {language === 'uz' ? 'Qator qo\'shish' : language === 'ru' ? 'Добавить строку' : 'Add row'}
            </Button>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowSplitModal(false)} className="flex-1">
                {language === 'uz' ? 'Bekor qilish' : language === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
              <Button
                onClick={handleSplitSubmit}
                disabled={splitSubmitting || !splitItems.some(it => it.product_id && parseFloat(it.quantity) > 0)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {splitSubmitting
                  ? (language === 'uz' ? 'Saqlanmoqda...' : language === 'ru' ? 'Сохранение...' : 'Saving...')
                  : (language === 'uz' ? 'Yakunlash' : language === 'ru' ? 'Завершить' : 'Complete Packaging')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
