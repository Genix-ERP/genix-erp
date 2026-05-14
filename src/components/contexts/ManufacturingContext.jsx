import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  workCentersService,
  productionOrdersService,
  workOrdersService,
  bomsService,
  manufacturingCategoriesService
} from '@/api/services';
import { useCompany } from './CompanyContext';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';
import { useAdminSettings } from './AdminSettingsContext';

const ManufacturingContext = createContext();

// Sample data for demo mode
const sampleWorkCenters = [
  {
    id: 'wc_1',
    code: 'WC-001',
    name: 'Assembly Line A',
    status: 'active',
    is_available: true,
    capacity_per_hour: 50,
    efficiency_factor: 95,
    oee_target: 85,
    working_hours_per_day: 8,
    hourly_cost: 75,
    current_utilization: 78,
    total_jobs_completed: 156,
    total_hours_worked: 1248
  },
  {
    id: 'wc_2',
    code: 'WC-002',
    name: 'CNC Machine Center',
    status: 'active',
    is_available: true,
    capacity_per_hour: 25,
    efficiency_factor: 90,
    oee_target: 80,
    working_hours_per_day: 16,
    hourly_cost: 120,
    current_utilization: 85,
    total_jobs_completed: 89,
    total_hours_worked: 2136
  },
  {
    id: 'wc_3',
    code: 'WC-003',
    name: 'Quality Testing Station',
    status: 'active',
    is_available: true,
    capacity_per_hour: 100,
    efficiency_factor: 98,
    oee_target: 95,
    working_hours_per_day: 8,
    hourly_cost: 50,
    current_utilization: 65,
    total_jobs_completed: 312,
    total_hours_worked: 624
  }
];

const sampleProductionOrders = [
  {
    id: 'mo_1',
    code: 'MO-20250115-001',
    name: 'Widget Assembly Batch',
    product_name: 'Premium Widget',
    product_id: 'prod_1',
    quantity_planned: 500,
    quantity_produced: 350,
    quantity_scrapped: 5,
    uom: 'units',
    status: 'in_progress',
    priority: 1,
    progress_percent: 70,
    scheduled_start: '2025-01-10',
    scheduled_end: '2025-01-20',
    work_center_name: 'Assembly Line A'
  },
  {
    id: 'mo_2',
    code: 'MO-20250115-002',
    name: 'Custom Parts Production',
    product_name: 'Custom Part XL',
    product_id: 'prod_2',
    quantity_planned: 200,
    quantity_produced: 0,
    quantity_scrapped: 0,
    uom: 'units',
    status: 'confirmed',
    priority: 2,
    progress_percent: 0,
    scheduled_start: '2025-01-18',
    scheduled_end: '2025-01-25',
    work_center_name: 'CNC Machine Center'
  },
  {
    id: 'mo_3',
    code: 'MO-20250115-003',
    name: 'Electronic Assembly',
    product_name: 'Circuit Board V2',
    product_id: 'prod_3',
    quantity_planned: 1000,
    quantity_produced: 1000,
    quantity_scrapped: 12,
    uom: 'units',
    status: 'completed',
    priority: 3,
    progress_percent: 100,
    scheduled_start: '2025-01-01',
    scheduled_end: '2025-01-10',
    completed_at: '2025-01-09T15:30:00Z',
    work_center_name: 'Assembly Line A'
  }
];

const sampleWorkOrders = [
  {
    id: 'wo_1',
    code: 'WO-001',
    name: 'Cut and Shape',
    production_order_id: 'mo_1',
    production_order_code: 'MO-20250115-001',
    sequence: 1,
    work_center_name: 'CNC Machine Center',
    quantity_to_produce: 500,
    quantity_produced: 500,
    uom: 'units',
    status: 'completed',
    progress_percent: 100,
    planned_duration_hours: 8,
    actual_duration_hours: 7.5
  },
  {
    id: 'wo_2',
    code: 'WO-002',
    name: 'Assembly',
    production_order_id: 'mo_1',
    production_order_code: 'MO-20250115-001',
    sequence: 2,
    work_center_name: 'Assembly Line A',
    quantity_to_produce: 500,
    quantity_produced: 350,
    uom: 'units',
    status: 'in_progress',
    progress_percent: 70,
    planned_duration_hours: 16,
    actual_duration_hours: 11.2
  },
  {
    id: 'wo_3',
    code: 'WO-003',
    name: 'Quality Inspection',
    production_order_id: 'mo_1',
    production_order_code: 'MO-20250115-001',
    sequence: 3,
    work_center_name: 'Quality Testing Station',
    quantity_to_produce: 500,
    quantity_produced: 0,
    uom: 'units',
    status: 'pending',
    progress_percent: 0,
    planned_duration_hours: 4,
    actual_duration_hours: 0
  }
];

const sampleBOMs = [
  {
    id: 'bom_1',
    bom_reference: 'BOM-001',
    product_name: 'Premium Widget',
    product_code: 'WIDGET-001',
    product_quantity: 1,
    bom_type: 'manufacture',
    status: 'active',
    components: [
      { component_name: 'Steel Frame', component_code: 'STL-001', quantity: 1, unit: 'pcs', cost: 15.00 },
      { component_name: 'Circuit Board', component_code: 'PCB-001', quantity: 2, unit: 'pcs', cost: 8.50 },
      { component_name: 'Fasteners Pack', component_code: 'FST-001', quantity: 1, unit: 'pack', cost: 2.00 }
    ],
    operations: [],
    total_material_cost: 34.00,
    total_operation_cost: 0,
    total_cost: 34.00,
    created_at: '2025-01-01T10:00:00Z'
  },
  {
    id: 'bom_2',
    bom_reference: 'BOM-002',
    product_name: 'Circuit Board V2',
    product_code: 'PCB-V2',
    product_quantity: 1,
    bom_type: 'manufacture',
    status: 'active',
    components: [
      { component_name: 'Raw PCB', component_code: 'RAW-PCB', quantity: 1, unit: 'pcs', cost: 3.00 },
      { component_name: 'Resistors', component_code: 'RES-001', quantity: 20, unit: 'pcs', cost: 0.05 },
      { component_name: 'Capacitors', component_code: 'CAP-001', quantity: 10, unit: 'pcs', cost: 0.10 },
      { component_name: 'IC Chips', component_code: 'IC-001', quantity: 5, unit: 'pcs', cost: 1.50 }
    ],
    operations: [
      { operation_name: 'SMT Assembly', duration_minutes: 15, cost_per_hour: 50 },
      { operation_name: 'Wave Soldering', duration_minutes: 5, cost_per_hour: 40 }
    ],
    total_material_cost: 12.50,
    total_operation_cost: 15.83,
    total_cost: 28.33,
    created_at: '2025-01-05T14:00:00Z'
  }
];

export function ManufacturingProvider({ children }) {
  const { activeCompany } = useCompany();
  const { getSetting } = useAdminSettings();
  const [workCenters, setWorkCenters] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [boms, setBoms] = useState([]);
  const [manufacturingStats, setManufacturingStats] = useState(null);
  const [manufacturingCategories, setManufacturingCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

  // Admin settings for manufacturing module - these affect module behavior
  const manufacturingSettings = useMemo(() => ({
    // Planning
    planningMethod: getSetting('manufacturing.planning.method', 'MTO'),
    defaultLeadTimeDays: getSetting('manufacturing.planning.default_lead_time_days', 5),

    // Work Center
    defaultCapacityHours: getSetting('manufacturing.work_center.default_capacity', 8),
    defaultEfficiencyRate: getSetting('manufacturing.work_center.efficiency_rate', 100),

    // Production
    autoConsumeComponents: getSetting('manufacturing.production.auto_consume_components', false),
    backflushEnabled: getSetting('manufacturing.production.backflush_enabled', false)
  }), [getSetting]);

  // Helper function to load demo data
  const loadDemoData = useCallback((demoMode) => {
    setWorkCenters(demoMode ? sampleWorkCenters : []);
    setProductionOrders(demoMode ? sampleProductionOrders : []);
    setWorkOrders(demoMode ? sampleWorkOrders : []);
    setBoms(demoMode ? sampleBOMs : []);
    setManufacturingStats(null);
  }, []);

  // Load data from API or localStorage
  const loadData = useCallback(async () => {
    if (!activeCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      const companyId = activeCompany.id;
      const demoMode = isDemoMode();
      const isBackendAvailable = await checkBackendHealth();
      setBackendAvailable(isBackendAvailable);

      if (isBackendAvailable) {
        // Load all manufacturing data from API
        const [wcData, poData, woData, bomData, statsData, catData] = await Promise.all([
          workCentersService.list(companyId, { limit: 200 }).catch(err => {
            console.error('Failed to load work centers:', err);
            return [];
          }),
          productionOrdersService.list(companyId, { limit: 1000 }).catch(err => {
            console.error('Failed to load production orders:', err);
            return [];
          }),
          workOrdersService.list(companyId, { limit: 1000 }).catch(err => {
            console.error('Failed to load work orders:', err);
            return [];
          }),
          bomsService.list(companyId, { limit: 500 }).catch(err => {
            console.error('Failed to load BOMs:', err);
            return [];
          }),
          productionOrdersService.getStats(companyId).catch(err => {
            console.error('Failed to load stats:', err);
            return null;
          }),
          manufacturingCategoriesService.list().catch(err => {
            console.error('Failed to load manufacturing categories:', err);
            return [];
          })
        ]);

        setWorkCenters(wcData || []);
        setProductionOrders(poData || []);
        setWorkOrders(woData || []);
        setBoms(bomData || []);
        setManufacturingStats(statsData);
        setManufacturingCategories(catData || []);
      } else {
        loadDemoData(demoMode);
      }
    } catch (err) {
      console.error('Error loading manufacturing data:', err);
      setError(err.message);
      loadDemoData(isDemoMode());
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadDemoData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =====================================================
  // WORK CENTER OPERATIONS
  // =====================================================
  const createWorkCenter = useCallback(async (data) => {
    const companyId = activeCompany?.id;
    try {
      const newWc = await workCentersService.create(data, companyId);
      setWorkCenters(prev => [newWc, ...prev]);
      return newWc;
    } catch (error) {
      console.error('Failed to create work center:', error);
      throw error;
    }
  }, [activeCompany]);

  const updateWorkCenter = useCallback(async (id, data) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await workCentersService.update(id, data, companyId);
      setWorkCenters(prev => prev.map(wc => wc.id === id ? { ...wc, ...data, ...updated } : wc));
      return updated;
    } catch (error) {
      console.error('Failed to update work center:', error);
      throw error;
    }
  }, [activeCompany]);

  const deleteWorkCenter = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      await workCentersService.delete(id, companyId);
      setWorkCenters(prev => prev.filter(wc => wc.id !== id));
    } catch (error) {
      console.error('Failed to delete work center:', error);
      throw error;
    }
  }, [activeCompany]);

  // =====================================================
  // PRODUCTION ORDER OPERATIONS
  // =====================================================
  const createProductionOrder = useCallback(async (data) => {
    const companyId = activeCompany?.id;
    try {
      const newPo = await productionOrdersService.create(data, companyId);
      setProductionOrders(prev => [newPo, ...prev]);
      return newPo;
    } catch (error) {
      console.error('Failed to create production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const updateProductionOrder = useCallback(async (id, data) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await productionOrdersService.update(id, data, companyId);
      setProductionOrders(prev => prev.map(po => po.id === id ? { ...po, ...data, ...updated } : po));
      return updated;
    } catch (error) {
      console.error('Failed to update production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const deleteProductionOrder = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      await productionOrdersService.delete(id, companyId);
      setProductionOrders(prev => prev.filter(po => po.id !== id));
    } catch (error) {
      console.error('Failed to delete production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const confirmProductionOrder = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await productionOrdersService.confirm(id, companyId);
      setProductionOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'confirmed', ...updated } : po));
      // Re-fetch work orders since confirm creates them from BOM operations
      const woData = await workOrdersService.list(companyId, { limit: 1000 });
      setWorkOrders(woData || []);
      return updated;
    } catch (error) {
      console.error('Failed to confirm production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const startProductionOrder = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await productionOrdersService.start(id, companyId);
      setProductionOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'in_progress', ...updated } : po));
      // Re-fetch work orders since start may create them (fallback) and auto-starts first one
      const woData = await workOrdersService.list(companyId, { limit: 1000 });
      setWorkOrders(woData || []);
      return updated;
    } catch (error) {
      console.error('Failed to start production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const pauseProductionOrder = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await productionOrdersService.pause(id, companyId);
      setProductionOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'paused', ...updated } : po));
      return updated;
    } catch (error) {
      console.error('Failed to pause production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const completeProductionOrder = useCallback(async (id, data = {}) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await productionOrdersService.complete(id, data, companyId);
      setProductionOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'completed', progress_percent: 100, ...updated } : po));
      return updated;
    } catch (error) {
      console.error('Failed to complete production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const cancelProductionOrder = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await productionOrdersService.cancel(id, companyId);
      setProductionOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'cancelled', ...updated } : po));
      return updated;
    } catch (error) {
      console.error('Failed to cancel production order:', error);
      throw error;
    }
  }, [activeCompany]);

  const recordProduction = useCallback(async (id, data) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await productionOrdersService.recordProduction(id, data, companyId);
      setProductionOrders(prev => prev.map(po => po.id === id ? { ...po, ...updated } : po));
      return updated;
    } catch (error) {
      console.error('Failed to record production:', error);
      throw error;
    }
  }, [activeCompany]);

  // =====================================================
  // WORK ORDER OPERATIONS
  // =====================================================
  const createWorkOrder = useCallback(async (data) => {
    const companyId = activeCompany?.id;
    try {
      const newWo = await workOrdersService.create(data, companyId);
      setWorkOrders(prev => [newWo, ...prev]);
      return newWo;
    } catch (error) {
      console.error('Failed to create work order:', error);
      throw error;
    }
  }, [activeCompany]);

  const startWorkOrder = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await workOrdersService.start(id, companyId);
      setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status: 'in_progress', ...updated } : wo));
      return updated;
    } catch (error) {
      console.error('Failed to start work order:', error);
      throw error;
    }
  }, [activeCompany]);

  const pauseWorkOrder = useCallback(async (id) => {
    try {
      const updated = await workOrdersService.pause(id);
      setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status: 'paused', ...updated } : wo));
      return updated;
    } catch (error) {
      console.error('Failed to pause work order:', error);
      throw error;
    }
  }, []);

  const completeWorkOrder = useCallback(async (id, data = {}) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await workOrdersService.complete(id, data, companyId);
      setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status: 'completed', progress_percent: 100, ...updated } : wo));
      return updated;
    } catch (error) {
      console.error('Failed to complete work order:', error);
      throw error;
    }
  }, [activeCompany]);

  const recordWorkOrderTime = useCallback(async (id, data) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await workOrdersService.recordTime(id, data, companyId);
      setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, ...updated } : wo));
      return updated;
    } catch (error) {
      console.error('Failed to record work order time:', error);
      throw error;
    }
  }, [activeCompany]);

  // =====================================================
  // BOM OPERATIONS
  // =====================================================
  const createBOM = useCallback(async (data) => {
    const companyId = activeCompany?.id;
    try {
      const newBom = await bomsService.create(data, companyId);
      setBoms(prev => [newBom, ...prev]);
      return newBom;
    } catch (error) {
      console.error('Failed to create BOM:', error);
      throw error;
    }
  }, [activeCompany]);

  const updateBOM = useCallback(async (id, data) => {
    const companyId = activeCompany?.id;
    try {
      const updated = await bomsService.update(id, data, companyId);
      setBoms(prev => prev.map(bom => bom.id === id ? { ...bom, ...data, ...updated } : bom));
      return updated;
    } catch (error) {
      console.error('Failed to update BOM:', error);
      throw error;
    }
  }, [activeCompany]);

  const deleteBOM = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    try {
      await bomsService.delete(id, companyId);
      setBoms(prev => prev.filter(bom => bom.id !== id));
    } catch (error) {
      console.error('Failed to delete BOM:', error);
      throw error;
    }
  }, [activeCompany]);

  // =====================================================
  // COMPUTED VALUES
  // =====================================================
  const activeProductionOrders = productionOrders.filter(po =>
    ['confirmed', 'in_progress'].includes(po.status)
  );

  // =====================================================
  // MANUFACTURING CATEGORY OPERATIONS
  // =====================================================
  const createManufacturingCategory = useCallback(async (data) => {
    try {
      const newCat = await manufacturingCategoriesService.create(data);
      setManufacturingCategories(prev => [...prev, newCat]);
      return newCat;
    } catch (error) {
      console.error('Failed to create manufacturing category:', error);
      throw error;
    }
  }, []);

  const updateManufacturingCategory = useCallback(async (id, data) => {
    try {
      await manufacturingCategoriesService.update(id, data);
      setManufacturingCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...data } : cat));
    } catch (error) {
      console.error('Failed to update manufacturing category:', error);
      throw error;
    }
  }, []);

  const deleteManufacturingCategory = useCallback(async (id) => {
    try {
      await manufacturingCategoriesService.delete(id);
      setManufacturingCategories(prev => prev.filter(cat => cat.id !== id));
    } catch (error) {
      console.error('Failed to delete manufacturing category:', error);
      throw error;
    }
  }, []);

  const completedToday = productionOrders.filter(po => {
    if (po.status !== 'completed' || !po.completed_at) return false;
    const completedDate = new Date(po.completed_at).toDateString();
    const today = new Date().toDateString();
    return completedDate === today;
  });

  const availableWorkCenters = workCenters.filter(wc =>
    wc.status === 'active' && wc.is_available
  );

  const averageOEE = workCenters.length > 0
    ? workCenters.reduce((sum, wc) => sum + (wc.current_utilization || 0), 0) / workCenters.length
    : 0;

  const value = useMemo(() => ({
    // State
    workCenters: Array.isArray(workCenters) ? workCenters : [],
    productionOrders: Array.isArray(productionOrders) ? productionOrders : [],
    workOrders: Array.isArray(workOrders) ? workOrders : [],
    boms: Array.isArray(boms) ? boms : [],
    manufacturingStats,
    isLoading,
    loading: isLoading,
    backendAvailable,
    error,

    // Computed
    activeProductionOrders,
    completedToday,
    availableWorkCenters,
    averageOEE,

    // Work Center Operations
    createWorkCenter,
    updateWorkCenter,
    deleteWorkCenter,

    // Production Order Operations
    createProductionOrder,
    updateProductionOrder,
    deleteProductionOrder,
    confirmProductionOrder,
    startProductionOrder,
    pauseProductionOrder,
    completeProductionOrder,
    cancelProductionOrder,
    recordProduction,

    // Work Order Operations
    createWorkOrder,
    startWorkOrder,
    pauseWorkOrder,
    completeWorkOrder,
    recordWorkOrderTime,

    // BOM Operations
    createBOM,
    updateBOM,
    deleteBOM,

    // Manufacturing Categories
    manufacturingCategories: Array.isArray(manufacturingCategories) ? manufacturingCategories : [],
    createManufacturingCategory,
    updateManufacturingCategory,
    deleteManufacturingCategory,

    // Refresh
    refreshData: loadData,

    // Admin Settings (from Admin Settings page)
    settings: manufacturingSettings,
    // Helper functions for settings
    getPlanningMethod: () => manufacturingSettings.planningMethod,
    getDefaultLeadTime: () => manufacturingSettings.defaultLeadTimeDays,
    getDefaultCapacity: () => manufacturingSettings.defaultCapacityHours,
    getDefaultEfficiency: () => manufacturingSettings.defaultEfficiencyRate,
    isAutoConsumeEnabled: () => manufacturingSettings.autoConsumeComponents,
    isBackflushEnabled: () => manufacturingSettings.backflushEnabled
  }), [workCenters, productionOrders, workOrders, boms, manufacturingStats, isLoading, backendAvailable, error, activeProductionOrders, completedToday, availableWorkCenters, averageOEE, createWorkCenter, updateWorkCenter, deleteWorkCenter, createProductionOrder, updateProductionOrder, deleteProductionOrder, confirmProductionOrder, startProductionOrder, pauseProductionOrder, completeProductionOrder, cancelProductionOrder, recordProduction, createWorkOrder, startWorkOrder, pauseWorkOrder, completeWorkOrder, recordWorkOrderTime, createBOM, updateBOM, deleteBOM, manufacturingCategories, createManufacturingCategory, updateManufacturingCategory, deleteManufacturingCategory, loadData, manufacturingSettings]);

  return (
    <ManufacturingContext.Provider value={value}>
      {children}
    </ManufacturingContext.Provider>
  );
}

export function useManufacturing() {
  const context = useContext(ManufacturingContext);
  if (!context) {
    throw new Error('useManufacturing must be used within ManufacturingProvider');
  }
  return context;
}
