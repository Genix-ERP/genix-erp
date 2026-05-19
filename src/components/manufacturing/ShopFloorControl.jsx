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
  Star,
} from 'lucide-react';
import { Trash2, Paperclip, Upload, FileText, Image, X } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useInventory } from '@/components/contexts/InventoryContext';
import { workOrdersService, productionOrdersService } from '@/api/services/manufacturing';
import { toast } from 'sonner';
import apiClient from '@/api/client';
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
    if (wo.status === 'in_progress' && wo.actual_start) {
      void currentTimer;
      const expectedMin = (wo.expected_duration_minutes || 0)
        || (wo.planned_duration_hours || 0) * 60
        || (wo.planned_duration || 0) * 60
        || 480; // default 8 hours if nothing set
      const elapsed = differenceInMinutes(new Date(), parseISO(wo.actual_start));
      return Math.min(99, (elapsed / expectedMin) * 100);
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

  // Per-user default category filter (persists in localStorage)
  const defaultCategoryStorageKey = useMemo(() => {
    let userId = 'default';
    try {
      const userData = localStorage.getItem('genixerp_user') || localStorage.getItem('user');
      if (userData) {
        const u = JSON.parse(userData);
        userId = u.id || u.email || 'default';
      }
    } catch { /* ignore */ }
    return `genix_shopfloor_default_category_${userId}`;
  }, []);

  const [selectedWorkCenter, setSelectedWorkCenter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    try { return localStorage.getItem(defaultCategoryStorageKey) || 'all'; } catch { return 'all'; }
  });
  const [defaultCategory, setDefaultCategory] = useState(() => {
    try { return localStorage.getItem(defaultCategoryStorageKey) || 'all'; } catch { return 'all'; }
  });

  const setAsDefaultCategory = (catId) => {
    try {
      localStorage.setItem(defaultCategoryStorageKey, catId);
      setDefaultCategory(catId);
      toast.success(language === 'uz' ? 'Standart filter saqlandi' : language === 'ru' ? 'Фильтр по умолчанию сохранён' : 'Default filter saved');
    } catch {
      toast.error('Failed to save default');
    }
  };
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
  const [splitBulkQty, setSplitBulkQty] = useState(0);
  const [splitBulkUnit, setSplitBulkUnit] = useState('');
  const [splitItems, setSplitItems] = useState([{ product_id: '', quantity: '', warehouse_id: '', materials: [] }]);
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

  // Rows: group all work orders (including completed) by production order, sorted by sequence
  // Each row = one manufacturing order, steps shown horizontally in order
  const orderRows = useMemo(() => {
    const map = new Map(); // poId -> { po, workOrders[] }
    filteredWorkOrders.forEach(wo => {
      const poId = wo.production_order_id || '__none__';
      if (!map.has(poId)) {
        const po = (productionOrders || []).find(p => p.id === poId);
        map.set(poId, { poId, po, workOrders: [] });
      }
      map.get(poId).workOrders.push(wo);
    });
    // Sort each row's WOs by sequence; sort rows by latest activity (in-progress first, then pending, then completed)
    const rows = Array.from(map.values()).map(row => ({
      ...row,
      workOrders: row.workOrders.sort((a, b) => (a.sequence || 0) - (b.sequence || 0)),
    }));
    const rowPriority = (row) => {
      if (row.workOrders.some(w => w.status === 'in_progress')) return 0;
      if (row.workOrders.some(w => w.status === 'paused')) return 1;
      if (row.workOrders.some(w => w.status === 'pending' || w.status === 'ready')) return 2;
      return 3; // all completed/failed
    };
    rows.sort((a, b) => {
      const p = rowPriority(a) - rowPriority(b);
      if (p !== 0) return p;
      return (a.po?.code || '').localeCompare(b.po?.code || '');
    });
    return rows.filter(row => !row.workOrders.every(w => w.status === 'completed' || w.status === 'done' || w.status === 'cancelled'));
  }, [filteredWorkOrders, productionOrders]);

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
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [operatorWO, setOperatorWO] = useState(null);
  const [wcEmployees, setWcEmployees] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');

  const handleStartWorkOrder = async (workOrder) => {
    // Check if the work center requires an operator
    const wc = workCenters.find(w => w.id === workOrder.work_center_id);
    if (wc?.require_operator) {
      setOperatorWO(workOrder);
      setSelectedOperator('');
      try {
        const res = await apiClient.get(`/work-centers/${wc.id}/employees`);
        const emps = res.data?.data;
        setWcEmployees(Array.isArray(emps) ? emps : []);
      } catch (e) { setWcEmployees([]); }
      setShowOperatorModal(true);
      return;
    }
    try {
      await startWorkOrder(workOrder.id);
      refreshData();
    } catch (error) {
      console.error('Failed to start work order:', error);
    }
  };

  const confirmStartWithOperator = async () => {
    if (!operatorWO || !selectedOperator) return;
    try {
      await startWorkOrder(operatorWO.id, { operator_id: selectedOperator });
      // Update work order with operator
      await apiClient.put(`/work-orders/${operatorWO.id}`, { operator_id: selectedOperator });
      setShowOperatorModal(false);
      setOperatorWO(null);
      refreshData();
    } catch (error) {
      console.error('Failed to start work order:', error);
      toast.error(language === 'uz' ? 'Xatolik' : 'Failed to start');
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
    const shortfallReason = completionData.shortfall_reason || '';

    // Close the complete modal first to avoid overlap with split modal
    setShowCompleteModal(false);
    setCompletionData({ quantity_produced: 0, quantity_scrapped: 0, notes: '', shortfall_reason: '' });

    try {
      const timeSpent = calculateTimeSpent(activeWorkOrder);

      await completeWorkOrder(activeWorkOrder.id, {
        quantity_produced: produced,
        scrap_quantity: scrapped,
        actual_duration: timeSpent.totalMinutes,
        notes: notes,
        ...(shortfallReason ? { shortfall_reason: shortfallReason } : {}),
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
            // Capture the bulk quantity that was produced — used to constrain split totals
            const bulkQty = parseFloat(po.quantity_produced ?? po.quantity ?? produced) || 0;
            setSplitBulkQty(bulkQty);
            setSplitBulkUnit(po.unit_name || po.unit_code || '');
            setSplitItems([{ product_id: '', quantity: '', warehouse_id: '', materials: [] }]);
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

    // Guard: prevent submitting more than what was produced
    if (splitBulkQty > 0) {
      const totalUsed = validItems.reduce((sum, it) => {
        const product = (products || []).find(p => p.id === it.product_id);
        const factor = parseFloat(product?.weight) || 1;
        return sum + (parseFloat(it.quantity) || 0) * factor;
      }, 0);
      if (totalUsed > splitBulkQty + 1e-6) {
        toast.error(language === 'uz'
          ? `Ishlab chiqarilgan miqdordan oshib ketdi: ${totalUsed.toFixed(2)} / ${splitBulkQty} ${splitBulkUnit}`
          : language === 'ru'
          ? `Превышено произведённое количество: ${totalUsed.toFixed(2)} / ${splitBulkQty} ${splitBulkUnit}`
          : `Exceeds produced quantity: ${totalUsed.toFixed(2)} / ${splitBulkQty} ${splitBulkUnit}`);
        return;
      }
    }

    setSplitSubmitting(true);
    try {
      await productionOrdersService.completeSplitOutput(splitPoId, {
        items: validItems.map(it => ({
          product_id: it.product_id,
          quantity: parseFloat(it.quantity),
          ...(it.warehouse_id ? { warehouse_id: it.warehouse_id } : {}),
          ...(it.materials && it.materials.length > 0 ? {
            materials: it.materials
              .filter(m => m.product_id && parseFloat(m.quantity_per_piece) > 0)
              .map(m => ({
                product_id: m.product_id,
                quantity_per_piece: parseFloat(m.quantity_per_piece),
              }))
          } : {}),
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

  const addSplitItem = () => setSplitItems(prev => [...prev, { product_id: '', quantity: '', warehouse_id: '', materials: [] }]);
  const removeSplitItem = (idx) => setSplitItems(prev => prev.filter((_, i) => i !== idx));
  const updateSplitItem = async (idx, field, value) => {
    setSplitItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'product_id' && value) {
      try {
        const res = await apiClient.get(`/products/${value}/packaging-materials`);
        const defaultMats = (res.data?.data || []).map(m => ({
          product_id: m.material_id,
          quantity_per_piece: m.quantity_per_piece.toString(),
        }));
        if (defaultMats.length > 0) {
          setSplitItems(prev => prev.map((it, i) =>
            i === idx && it.materials.length === 0 ? { ...it, materials: defaultMats } : it
          ));
        }
      } catch (e) { /* ignore */ }
    }
  };
  const addSplitItemMaterial = (idx) => setSplitItems(prev => prev.map((it, i) => i === idx ? { ...it, materials: [...it.materials, { product_id: '', quantity_per_piece: '' }] } : it));
  const removeSplitItemMaterial = (itemIdx, matIdx) => setSplitItems(prev => prev.map((it, i) => i === itemIdx ? { ...it, materials: it.materials.filter((_, mi) => mi !== matIdx) } : it));
  const updateSplitItemMaterial = (itemIdx, matIdx, field, value) => setSplitItems(prev => prev.map((it, i) => i === itemIdx ? { ...it, materials: it.materials.map((m, mi) => mi === matIdx ? { ...m, [field]: value } : m) } : it));

  // Compute how much of the bulk has been allocated across split rows.
  // Each output product's `weight` field is its size factor — meters per piece,
  // kg per piece, etc. — relative to the bulk material's unit.
  const splitUsage = useMemo(() => {
    if (!splitBulkQty) return { used: 0, remaining: 0, over: false };
    const used = splitItems.reduce((sum, it) => {
      const qty = parseFloat(it.quantity) || 0;
      if (!qty || !it.product_id) return sum;
      const product = (products || []).find(p => p.id === it.product_id);
      const factor = parseFloat(product?.weight) || 1;
      return sum + qty * factor;
    }, 0);
    const remaining = splitBulkQty - used;
    return { used, remaining, over: used > splitBulkQty + 1e-6 };
  }, [splitItems, products, splitBulkQty]);

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
        <div className="inline-flex items-center rounded-md border overflow-hidden">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-sm ${selectedCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'}`}
          >
            {labels.all || 'All'}
          </button>
          <button
            onClick={() => setAsDefaultCategory('all')}
            title={language === 'uz' ? 'Standart filter sifatida belgilash' : language === 'ru' ? 'Установить как фильтр по умолчанию' : 'Set as default filter'}
            className={`px-2 py-1.5 border-l ${defaultCategory === 'all' ? 'bg-amber-50 text-amber-500' : 'bg-white text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}
          >
            <Star className="w-3.5 h-3.5" fill={defaultCategory === 'all' ? 'currentColor' : 'none'} />
          </button>
        </div>
        {(manufacturingCategories || []).filter(c => c.is_active).map(cat => (
          <div key={cat.id} className="inline-flex items-center rounded-md border overflow-hidden">
            <button
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-sm ${selectedCategory === cat.id ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              {cat.name}
            </button>
            <button
              onClick={() => setAsDefaultCategory(cat.id)}
              title={language === 'uz' ? 'Standart filter sifatida belgilash' : language === 'ru' ? 'Установить как фильтр по умолчанию' : 'Set as default filter'}
              className={`px-2 py-1.5 border-l ${defaultCategory === cat.id ? 'bg-amber-50 text-amber-500' : 'bg-white text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}
            >
              <Star className="w-3.5 h-3.5" fill={defaultCategory === cat.id ? 'currentColor' : 'none'} />
            </button>
          </div>
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

        {orderRows.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="py-12 text-center text-slate-500">
              {labels.no_active_work_orders}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orderRows.map(row => {
              const totalSteps = row.workOrders.length;
              const completedSteps = row.workOrders.filter(w => w.status === 'completed').length;
              const isFullyDone = completedSteps === totalSteps && totalSteps > 0;
              return (
                <div key={row.poId} className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  {/* Row header: production order info */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${isFullyDone ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'} rounded-t-xl`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isFullyDone ? 'bg-green-100' : 'bg-blue-100'}`}>
                        <Package className={`w-5 h-5 ${isFullyDone ? 'text-green-600' : 'text-blue-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">
                          {row.po?.code || row.po?.order_number || (language === 'uz' ? 'Buyurtma' : language === 'ru' ? 'Заказ' : 'Order')}
                          {row.po?.product_name && <span className="text-slate-500 font-normal"> — {row.po.product_name}</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {language === 'uz' ? 'Bosqichlar' : language === 'ru' ? 'Шаги' : 'Steps'}: {completedSteps}/{totalSteps}
                          {row.po?.quantity_to_produce ? ` · ${language === 'uz' ? 'Miqdor' : language === 'ru' ? 'Кол-во' : 'Qty'}: ${row.po.quantity_to_produce}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="w-40 shrink-0">
                      <Progress value={totalSteps ? (completedSteps / totalSteps) * 100 : 0} className="h-2" />
                    </div>
                  </div>

                  {/* Horizontal sequence of step cards */}
                  <div className="overflow-x-auto p-4">
                    <div className="flex items-stretch gap-3 min-w-max">
                      {row.workOrders.map((wo, idx) => (
                        <React.Fragment key={wo.id}>
                          <div className="w-72 shrink-0">
                            <KanbanCard
                              wo={wo}
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
                          </div>
                          {idx < row.workOrders.length - 1 && (
                            <div className="flex items-center text-slate-300 select-none px-1">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M13 6l6 6-6 6" />
                              </svg>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
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

            {(() => {
              const planned = activeWorkOrder?.quantity_to_produce || 0;
              const alreadyProduced = activeWorkOrder?.quantity_produced || 0;
              const remaining = planned - alreadyProduced;
              const produced = parseFloat(completionData.quantity_produced) || 0;
              const scrapped = parseFloat(completionData.quantity_scrapped) || 0;
              const isShort = produced > 0 && (produced + scrapped) < remaining;
              return isShort ? (
                <div className="space-y-2">
                  <Label className="text-amber-700">
                    {language === 'uz' ? 'Kamomad sababi' : language === 'ru' ? 'Причина недостачи' : 'Shortfall Reason'} *
                  </Label>
                  <Textarea
                    value={completionData.shortfall_reason || ''}
                    onChange={e => setCompletionData({ ...completionData, shortfall_reason: e.target.value })}
                    placeholder={language === 'uz' ? 'Nima uchun kamroq ishlab chiqarildi...' : language === 'ru' ? 'Укажите причину недостачи...' : 'Why was less produced...'}
                    rows={2}
                  />
                </div>
              ) : null;
            })()}

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
                disabled={!completionData.quantity_produced || parseFloat(completionData.quantity_produced) <= 0 || (() => {
                  const planned = activeWorkOrder?.quantity_to_produce || 0;
                  const alreadyProduced = activeWorkOrder?.quantity_produced || 0;
                  const remaining = planned - alreadyProduced;
                  const produced = parseFloat(completionData.quantity_produced) || 0;
                  const scrapped = parseFloat(completionData.quantity_scrapped) || 0;
                  return produced > 0 && (produced + scrapped) < remaining && !(completionData.shortfall_reason || '').trim();
                })()}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {language === 'uz' ? "Ishni tugatish" : language === 'ru' ? "Завершить" : "Complete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Operator Selection Modal */}
      <Dialog open={showOperatorModal} onOpenChange={setShowOperatorModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'uz' ? 'Operatorni tanlang' : language === 'ru' ? 'Выберите оператора' : 'Select Operator'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'uz' ? 'Xodimni tanlang...' : language === 'ru' ? 'Выберите сотрудника...' : 'Select employee...'} />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(wcEmployees) ? wcEmployees : []).map(emp => (
                  <SelectItem key={emp.employee_id || emp.id} value={emp.employee_id || emp.id}>
                    {emp.employee_name || emp.name || emp.employee_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowOperatorModal(false)}>
                {language === 'uz' ? 'Bekor qilish' : language === 'ru' ? 'Отмена' : 'Cancel'}
              </Button>
              <Button onClick={confirmStartWithOperator} disabled={!selectedOperator} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-1" />
                {language === 'uz' ? 'Boshlash' : language === 'ru' ? 'Начать' : 'Start'}
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

            {/* Running usage summary — total bulk vs used vs remaining */}
            {splitBulkQty > 0 && (
              <div className={`rounded-lg p-3 border text-sm flex items-center justify-between ${
                splitUsage.over ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs text-slate-500">{language === 'uz' ? 'Jami' : language === 'ru' ? 'Всего' : 'Total'}</div>
                    <div className="font-semibold text-slate-900 tabular-nums">
                      {splitBulkQty} {splitBulkUnit}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{language === 'uz' ? 'Ishlatilgan' : language === 'ru' ? 'Использовано' : 'Used'}</div>
                    <div className={`font-semibold tabular-nums ${splitUsage.over ? 'text-red-600' : 'text-slate-900'}`}>
                      {splitUsage.used.toFixed(2)} {splitBulkUnit}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{language === 'uz' ? 'Qoldi' : language === 'ru' ? 'Осталось' : 'Remaining'}</div>
                    <div className={`font-semibold tabular-nums ${splitUsage.over ? 'text-red-600' : 'text-green-700'}`}>
                      {splitUsage.remaining.toFixed(2)} {splitBulkUnit}
                    </div>
                  </div>
                </div>
                {splitUsage.over && (
                  <div className="text-red-600 text-xs font-medium">
                    {language === 'uz'
                      ? 'Ishlab chiqarilgan miqdordan oshib ketdi!'
                      : language === 'ru'
                      ? 'Превышено произведённое количество!'
                      : 'Exceeds produced quantity!'}
                  </div>
                )}
              </div>
            )}

            {splitItems.map((item, idx) => (
              <div key={idx} className="border border-slate-100 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs">{language === 'uz' ? 'Mahsulot' : language === 'ru' ? 'Продукт' : 'Product'} *</Label>
                    <select
                      className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white"
                      value={item.product_id}
                      onChange={(e) => updateSplitItem(idx, 'product_id', e.target.value)}
                    >
                      <option value="">— {language === 'uz' ? 'tanlang' : language === 'ru' ? 'выбрать' : 'select'} —</option>
                      {(products || []).filter(p => p.can_be_sold || p.is_sellable).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.weight ? ` (${p.weight} ${splitBulkUnit || 'kg'} / ${language === 'uz' ? 'dona' : language === 'ru' ? 'шт.' : 'pc'})` : ''}
                        </option>
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

                {/* Additional materials per piece */}
                <div className="pl-2">
                  {item.materials.length > 0 && (
                    <div className="space-y-1.5 mt-1">
                      <Label className="text-xs text-slate-500">
                        {language === 'uz' ? "Qo'shimcha materiallar (dona uchun)" : language === 'ru' ? 'Доп. материалы (на штуку)' : 'Additional materials (per piece)'}
                      </Label>
                      {item.materials.map((mat, matIdx) => (
                        <div key={matIdx} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-6">
                            <select
                              className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white"
                              value={mat.product_id}
                              onChange={(e) => updateSplitItemMaterial(idx, matIdx, 'product_id', e.target.value)}
                            >
                              <option value="">— {language === 'uz' ? 'Material tanlang' : language === 'ru' ? 'Выбрать материал' : 'Select material'} —</option>
                              {(products || []).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-4">
                            <Input
                              type="number"
                              min="0.0001"
                              step="any"
                              value={mat.quantity_per_piece}
                              onChange={(e) => updateSplitItemMaterial(idx, matIdx, 'quantity_per_piece', e.target.value)}
                              placeholder={language === 'uz' ? 'Dona uchun' : language === 'ru' ? 'На шт.' : 'Per piece'}
                              className="text-xs h-8"
                            />
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <Button variant="ghost" size="sm" onClick={() => removeSplitItemMaterial(idx, matIdx)} className="text-red-400 hover:text-red-600 p-0.5 h-auto">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addSplitItemMaterial(idx)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-1 h-auto"
                    >
                      + {language === 'uz' ? "Qo'shimcha materiallar" : language === 'ru' ? 'Доп. материалы' : 'Additional materials'}
                    </Button>
                    {item.materials.length > 0 && item.product_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-blue-600"
                        onClick={async () => {
                          const validMats = item.materials.filter(m => m.product_id && parseFloat(m.quantity_per_piece) > 0);
                          if (validMats.length > 0) {
                            try {
                              await apiClient.post(`/products/${item.product_id}/packaging-materials`, {
                                materials: validMats.map(m => ({ material_id: m.product_id, quantity_per_piece: parseFloat(m.quantity_per_piece) }))
                              });
                              toast.success(language === 'uz' ? 'Standart materiallar saqlandi' : language === 'ru' ? 'Стандартные материалы сохранены' : 'Default materials saved');
                            } catch(e) { toast.error(language === 'uz' ? 'Xatolik' : 'Failed to save'); }
                          }
                        }}
                      >
                        {language === 'uz' ? 'Standart qilib saqlash' : language === 'ru' ? 'Сохранить как стандарт' : 'Save as default'}
                      </Button>
                    )}
                  </div>
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
                disabled={splitSubmitting || !splitItems.some(it => it.product_id && parseFloat(it.quantity) > 0) || splitUsage.over}
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
