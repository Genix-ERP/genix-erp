import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useInventory } from '@/components/contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Play, Pause, CheckCircle, X, Calendar, RefreshCw, Clock, DollarSign, Cog, Eye, ArrowRight, Package, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '@/api/client';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { inventoryService, bomsService, productionOrdersService } from '@/api/services';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { toast } from 'sonner';
import ProductCombobox from '@/components/shared/ProductCombobox';

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
  const { refreshData: refreshInventory, products: inventoryProducts, warehouses } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [boms, setBoms] = useState([]);

  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedOrders, setPaginatedOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const pageSize = 20;

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const params = { page: currentPage, limit: pageSize, sort_by: 'created_at', sort_order: 'desc' };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await apiClient.get('/production-orders', { params });
      const data = response.data?.data || [];
      const meta = response.data?.meta || {};
      setPaginatedOrders(data);
      setTotalOrders(meta.total || data.length);
      setTotalPages(meta.total_pages || Math.ceil((meta.total || data.length) / pageSize));
    } catch (e) {
      console.error('Failed to load production orders', e);
      setPaginatedOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  // Split output state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitPoId, setSplitPoId] = useState(null);
  const [splitBulkQty, setSplitBulkQty] = useState(0);
  const [splitBulkUnit, setSplitBulkUnit] = useState('');
  const [splitItems, setSplitItems] = useState([{ product_id: '', quantity: '', warehouse_id: '', materials: [] }]);
  const [splitSubmitting, setSplitSubmitting] = useState(false);

  // Final output modal state — shown when advancing to the last stage so the
  // operator MUST enter good/scrap quantities (and a reason if short of order)
  const [showFinalOutputModal, setShowFinalOutputModal] = useState(false);
  const [finalOutputOrder, setFinalOutputOrder] = useState(null);
  const [finalOutputData, setFinalOutputData] = useState({ good_quantity: '', reject_quantity: '', shortfall_reason: '' });
  const [finalOutputSubmitting, setFinalOutputSubmitting] = useState(false);

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
    manufacturing_category_id: '',
    has_split_output: false
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

  // Server handles search/status filtering; use paginated data directly
  const filteredOrders = paginatedOrders;

  const handleCreateOrder = async () => {
    try {
      const orderData = {
        ...newOrder,
        quantity_planned: parseFloat(newOrder.quantity_planned)
      };
      console.log('Creating order with has_split_output:', orderData.has_split_output, 'full data:', JSON.stringify(orderData));
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
      fetchOrders();

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
        manufacturing_category_id: '',
        has_split_output: false
      });
      setProductBoms([]);
    } catch (error) {
      console.error('Error creating production order:', error);
      const errorMsg = typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : error.response?.data?.error?.message || error.message;
      toast.error(`Failed to create production order: ${errorMsg}`);
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
      fetchOrders();
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

      // When advancing to the last stage ('done'), require explicit output entry
      console.log('Advance stage:', { nextStage, has_split_output: order.has_split_output, status: order.status, orderId });
      if (nextStage === 'done') {
        if (order.has_split_output) {
          // Split output — split modal handles quantity entry
          openSplitModal(orderId);
        } else {
          // No split — operator MUST enter good/scrap before MO closes.
          // Don't update current_stage here; the modal does it on submit.
          setFinalOutputOrder(order);
          setFinalOutputData({ good_quantity: '', reject_quantity: '', shortfall_reason: '' });
          setShowFinalOutputModal(true);
        }
        return;
      }

      try {
        await updateProductionOrder(orderId, { current_stage: nextStage });
        // Update selected order if viewing
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, current_stage: nextStage }));
        }
      } catch (error) {
        console.error('Error advancing stage:', error);
        toast.error(t('error_advancing_stage') || 'Failed to advance stage');
      }
    }
  };

  // Submit handler for the mandatory final output modal
  const handleFinalOutputSubmit = async () => {
    if (!finalOutputOrder) return;
    const good = parseFloat(finalOutputData.good_quantity) || 0;
    const reject = parseFloat(finalOutputData.reject_quantity) || 0;
    if (good <= 0 && reject <= 0) {
      toast.error(language === 'uz'
        ? 'Yaxshi yoki brak miqdorini kiriting'
        : language === 'ru'
        ? 'Введите количество годных или брака'
        : 'Enter at least good or reject quantity');
      return;
    }
    const ordered = parseFloat(finalOutputOrder.quantity_ordered ?? finalOutputOrder.quantity ?? 0) || 0;
    const total = good + reject;
    const isShort = ordered > 0 && total < ordered - 1e-6;
    if (isShort && !finalOutputData.shortfall_reason.trim()) {
      toast.error(language === 'uz'
        ? `Buyurtma miqdoridan kam: sabab kiriting`
        : language === 'ru'
        ? `Меньше заказанного: укажите причину`
        : `Below ordered quantity: shortfall reason required`);
      return;
    }
    setFinalOutputSubmitting(true);
    try {
      await completeProductionOrder(finalOutputOrder.id, {
        good_quantity: good,
        reject_quantity: reject,
        ...(isShort ? { shortfall_reason: finalOutputData.shortfall_reason.trim() } : {}),
      });
      toast.success(language === 'uz' ? 'Yakunlandi' : language === 'ru' ? 'Завершено' : 'Completed');
      setShowFinalOutputModal(false);
      setShowViewModal(false);
      setSelectedOrder(null);
      setFinalOutputOrder(null);
      refreshData();
      refreshInventory();
    } catch (err) {
      console.error('Final output submit error:', err);
      toast.error('Failed: ' + (err.response?.data?.error?.message || err.message));
    }
    setFinalOutputSubmitting(false);
  };

  // Split output helpers
  const openSplitModal = async (orderId) => {
    // Ensure the PO is in 'packaging' status before showing the modal
    try {
      await updateProductionOrder(orderId, {
        current_stage: 'packaging',
        status: 'packaging',
        progress_percent: 95
      });
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, current_stage: 'packaging', status: 'packaging' }));
      }
    } catch (error) {
      console.error('Error moving to packaging:', error);
      // Even if the status update fails, still try to show the modal
    }
    setSplitPoId(orderId);
    // Capture bulk produced quantity to constrain split totals
    const sourcePO = orders.find(o => o.id === orderId) || selectedOrder;
    const bulkQty = parseFloat(
      sourcePO?.quantity_produced ?? sourcePO?.good_quantity ?? sourcePO?.quantity ?? 0
    ) || 0;
    setSplitBulkQty(bulkQty);
    setSplitBulkUnit(sourcePO?.unit_name || sourcePO?.unit_code || '');
    setSplitItems([{ product_id: '', quantity: '', warehouse_id: '', materials: [] }]);
    setShowSplitModal(true);
  };

  // Live total of how much of the bulk has been allocated across split rows.
  // Each output product's `weight` field is its size factor (meters/kg per piece).
  const splitUsage = useMemo(() => {
    if (!splitBulkQty) return { used: 0, remaining: 0, over: false };
    const productList = inventoryProducts || products || [];
    const used = splitItems.reduce((sum, it) => {
      const qty = parseFloat(it.quantity) || 0;
      if (!qty || !it.product_id) return sum;
      const product = productList.find(p => p.id === it.product_id);
      const factor = parseFloat(product?.weight) || 1;
      return sum + qty * factor;
    }, 0);
    return { used, remaining: splitBulkQty - used, over: used > splitBulkQty + 1e-6 };
  }, [splitItems, inventoryProducts, products, splitBulkQty]);

  const handleSplitSubmit = async () => {
    const validItems = splitItems.filter(it => it.product_id && parseFloat(it.quantity) > 0);
    if (!validItems.length) return;

    // Guard against exceeding the produced bulk quantity
    if (splitBulkQty > 0) {
      const productList = inventoryProducts || products || [];
      const totalUsed = validItems.reduce((sum, it) => {
        const product = productList.find(p => p.id === it.product_id);
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
      // Make sure PO is in packaging status before calling completeSplitOutput
      try {
        await updateProductionOrder(splitPoId, { status: 'packaging' });
      } catch (e) { /* ignore - might already be in packaging */ }

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
      toast.success(language === 'uz' ? 'Mahsulotlarga bo\'lish yakunlandi' : language === 'ru' ? 'Разделение на продукты завершено' : 'Split output completed');
      setShowSplitModal(false);
      setSplitPoId(null);
      setShowViewModal(false);
      setSelectedOrder(null);
      refreshData();
      refreshInventory();
    } catch (err) {
      console.error('Split output error:', err);
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
      toast.error(t('error_recording_output') || 'Failed to record output: ' + (error.response?.data?.error?.message || error.message));
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
                <Button variant="outline" size="sm" onClick={() => { refreshData(); fetchOrders(); }}>
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
          {(isLoading || ordersLoading) ? (
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
                    <TableHead className="font-semibold">{t('date') || 'Date'}</TableHead>
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
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {order.created_at ? format(new Date(order.created_at), 'dd.MM.yyyy') : '-'}
                        </TableCell>
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
                                    deleteProductionOrder(order.id).then(() => fetchOrders());
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-slate-600">
                    {t('showing') || 'Showing'} {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalOrders)} {t('of') || 'of'} {totalOrders}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
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
                <ProductCombobox
                  products={products.filter(p => p.id && (p.can_be_sold || p.is_sellable))}
                  value={newOrder.product_id}
                  onValueChange={(value, productFromCombobox) => {
                    const product =
                      productFromCombobox ||
                      products.find(p => p.id === value);
                    setNewOrder({
                      ...newOrder,
                      product_id: value,
                      product_name: product?.name || '',
                      uom: product?.unit_name || product?.unit_code || product?.unit_of_measure || product?.uom || 'units',
                      bom_id: '' // Reset BOM when product changes
                    });
                  }}
                  placeholder={t('select_product') || 'Select a product'}
                  t={t}
                />
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
              {/* Order Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">{t('order_code') || 'Order Code'}</p>
                  <p className="font-semibold">{selectedOrder.code}</p>
                </div>
                {selectedOrder.name && (
                  <div>
                    <p className="text-xs text-slate-500">{t('order_name') || 'Order Name'}</p>
                    <p className="font-semibold">{selectedOrder.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500">{t('product') || 'Product'}</p>
                  <p className="font-semibold">{selectedOrder.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('quantity') || 'Quantity'}</p>
                  <p className="font-semibold">{selectedOrder.quantity_planned} {getUnitLabel(selectedOrder.uom)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={getStatusColor(selectedOrder.status)}>{getStatusLabel(selectedOrder.status)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('shift') || 'Shift'}</p>
                  <p className="font-semibold">{getShiftLabel(selectedOrder.shift) || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('scheduled_start') || 'Start Date'}</p>
                  <p className="font-semibold">{selectedOrder.scheduled_start ? format(new Date(selectedOrder.scheduled_start), 'dd.MM.yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('priority') || 'Priority'}</p>
                  <p className="font-semibold">{getPriorityLabel(selectedOrder.priority)?.label || '-'}</p>
                </div>
                {selectedOrder.bom_name && (
                  <div>
                    <p className="text-xs text-slate-500">{t('bom') || 'BOM'}</p>
                    <p className="font-semibold">{selectedOrder.bom_name}</p>
                  </div>
                )}
                {selectedOrder.sales_order_number && (
                  <div>
                    <p className="text-xs text-slate-500">{t('sales_order') || 'Sales Order'}</p>
                    <p className="font-semibold text-blue-700">{selectedOrder.sales_order_number}</p>
                  </div>
                )}
                {selectedOrder.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">{t('notes') || 'Notes'}</p>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                )}
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
                {selectedOrder.current_stage !== 'done' && selectedOrder.current_stage !== 'packaging' && selectedOrder.status === 'in_progress' && (
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
                {/* Split Output Button - shows when order has split output and reached final stages */}
                {selectedOrder.has_split_output && selectedOrder.status !== 'completed' && (
                  selectedOrder.current_stage === 'done' ||
                  selectedOrder.current_stage === 'packaging' ||
                  selectedOrder.status === 'packaging'
                ) && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={() => openSplitModal(selectedOrder.id)}
                      className="bg-gradient-to-r from-green-600 to-green-700"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      {language === 'uz' ? 'Mahsulotlarga bo\'lish' : language === 'ru' ? 'Разделить на продукты' : 'Split into Products'}
                    </Button>
                  </div>
                )}
              </div>

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
                {selectedOrder.shortfall_reason && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium mb-1">
                      {language === 'uz' ? 'Kamomad sababi' : language === 'ru' ? 'Причина недостачи' : 'Shortfall Reason'}
                    </p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedOrder.shortfall_reason}</p>
                  </div>
                )}
              </div>
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

            {/* Running usage summary */}
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
                    <label className="text-xs font-medium">{language === 'uz' ? 'Mahsulot' : language === 'ru' ? 'Продукт' : 'Product'} *</label>
                    <select
                      className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white"
                      value={item.product_id}
                      onChange={(e) => updateSplitItem(idx, 'product_id', e.target.value)}
                    >
                      <option value="">— {language === 'uz' ? 'tanlang' : language === 'ru' ? 'выбрать' : 'select'} —</option>
                      {(inventoryProducts || products || []).filter(p => p.can_be_sold || p.is_sellable).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.weight ? ` (${p.weight} ${splitBulkUnit || 'kg'} / ${language === 'uz' ? 'dona' : language === 'ru' ? 'шт.' : 'pc'})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs font-medium">{language === 'uz' ? 'Miqdori' : language === 'ru' ? 'Кол-во' : 'Quantity'} *</label>
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
                    <label className="text-xs font-medium">{language === 'uz' ? 'Sklad' : language === 'ru' ? 'Склад' : 'Warehouse'}</label>
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
                      <label className="text-xs font-medium text-slate-500">
                        {language === 'uz' ? "Qo'shimcha materiallar (dona uchun)" : language === 'ru' ? 'Доп. материалы (на штуку)' : 'Additional materials (per piece)'}
                      </label>
                      {item.materials.map((mat, matIdx) => (
                        <div key={matIdx} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-6">
                            <select
                              className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white"
                              value={mat.product_id}
                              onChange={(e) => updateSplitItemMaterial(idx, matIdx, 'product_id', e.target.value)}
                            >
                              <option value="">— {language === 'uz' ? 'Material tanlang' : language === 'ru' ? 'Выбрать материал' : 'Select material'} —</option>
                              {(inventoryProducts || products || []).map(p => (
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

      {/* Final Output Modal — required before MO can be closed (no auto-close) */}
      <Dialog open={showFinalOutputModal} onOpenChange={(open) => { if (!finalOutputSubmitting) setShowFinalOutputModal(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'uz' ? 'Yakuniy natijani kiriting' : language === 'ru' ? 'Введите итог' : 'Enter Final Output'}
            </DialogTitle>
          </DialogHeader>
          {finalOutputOrder && (() => {
            const ordered = parseFloat(finalOutputOrder.quantity_ordered ?? finalOutputOrder.quantity ?? 0) || 0;
            const good = parseFloat(finalOutputData.good_quantity) || 0;
            const reject = parseFloat(finalOutputData.reject_quantity) || 0;
            const total = good + reject;
            const isShort = ordered > 0 && total < ordered - 1e-6;
            const unit = finalOutputOrder.unit_name || finalOutputOrder.unit_code || '';
            return (
              <div className="space-y-4 py-2">
                <div className="rounded-lg p-3 border bg-slate-50 border-slate-200 text-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">{language === 'uz' ? 'Buyurtma' : language === 'ru' ? 'Заказано' : 'Ordered'}</div>
                    <div className="font-semibold tabular-nums">{ordered} {unit}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{language === 'uz' ? 'Jami kiritilgan' : language === 'ru' ? 'Введено всего' : 'Entered total'}</div>
                    <div className={`font-semibold tabular-nums ${isShort ? 'text-amber-600' : 'text-slate-900'}`}>{total.toFixed(2)} {unit}</div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">
                    {language === 'uz' ? 'Yaxshi miqdor' : language === 'ru' ? 'Годное количество' : 'Good Quantity'} *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={finalOutputData.good_quantity}
                    onChange={(e) => setFinalOutputData(prev => ({ ...prev, good_quantity: e.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">
                    {language === 'uz' ? 'Brak miqdor' : language === 'ru' ? 'Брак' : 'Reject Quantity'}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={finalOutputData.reject_quantity}
                    onChange={(e) => setFinalOutputData(prev => ({ ...prev, reject_quantity: e.target.value }))}
                    placeholder="0"
                  />
                </div>

                {isShort && (
                  <div>
                    <label className="text-xs font-medium block mb-1 text-amber-700">
                      {language === 'uz' ? 'Kamomad sababi' : language === 'ru' ? 'Причина недостачи' : 'Shortfall Reason'} *
                    </label>
                    <textarea
                      className="w-full border border-amber-300 rounded-md px-2 py-1.5 text-sm bg-white min-h-[80px]"
                      value={finalOutputData.shortfall_reason}
                      onChange={(e) => setFinalOutputData(prev => ({ ...prev, shortfall_reason: e.target.value }))}
                      placeholder={language === 'uz'
                        ? 'Nega kam ishlab chiqarildi? (smenada vaqt yetmadi, xom-ashyo tugadi, va h.k.)'
                        : language === 'ru'
                        ? 'Почему произведено меньше? (не хватило времени, материалов и т.д.)'
                        : 'Why was less produced? (not enough time, materials ran out, etc.)'}
                    />
                    <p className="text-xs text-amber-600 mt-1">
                      {language === 'uz'
                        ? `Buyurtma ${ordered}, kiritildi ${total.toFixed(2)}. Sabab kiritish majburiy.`
                        : language === 'ru'
                        ? `Заказано ${ordered}, введено ${total.toFixed(2)}. Причина обязательна.`
                        : `Ordered ${ordered}, entered ${total.toFixed(2)}. Reason required.`}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowFinalOutputModal(false)} className="flex-1" disabled={finalOutputSubmitting}>
                    {language === 'uz' ? 'Bekor qilish' : language === 'ru' ? 'Отмена' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={handleFinalOutputSubmit}
                    disabled={finalOutputSubmitting || (good <= 0 && reject <= 0) || (isShort && !finalOutputData.shortfall_reason.trim())}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {finalOutputSubmitting
                      ? (language === 'uz' ? 'Saqlanmoqda...' : language === 'ru' ? 'Сохранение...' : 'Saving...')
                      : (language === 'uz' ? 'Yakunlash' : language === 'ru' ? 'Завершить' : 'Complete')}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
