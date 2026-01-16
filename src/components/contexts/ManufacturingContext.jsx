import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  workCentersService,
  productionOrdersService,
  workOrdersService,
  qualityChecksService,
  bomsService
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

const sampleQualityChecks = [
  {
    id: 'qc_1',
    code: 'QC-001',
    production_order_code: 'MO-20250115-003',
    product_name: 'Circuit Board V2',
    inspection_date: '2025-01-09T14:00:00Z',
    inspector_name: 'John Smith',
    quantity_inspected: 1000,
    quantity_passed: 988,
    quantity_failed: 12,
    result: 'passed',
    pass_rate: 98.8,
    defect_type: 'Visual Defect',
    notes: 'Minor cosmetic issues on 12 units'
  },
  {
    id: 'qc_2',
    code: 'QC-002',
    production_order_code: 'MO-20250115-001',
    product_name: 'Premium Widget',
    inspection_date: '2025-01-14T10:00:00Z',
    inspector_name: 'Jane Doe',
    quantity_inspected: 200,
    quantity_passed: 198,
    quantity_failed: 2,
    result: 'passed',
    pass_rate: 99.0,
    notes: '2 units with dimensional errors'
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
  const [qualityChecks, setQualityChecks] = useState([]);
  const [boms, setBoms] = useState([]);
  const [manufacturingStats, setManufacturingStats] = useState(null);
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

    // Quality
    qualityControlEnabled: getSetting('manufacturing.quality.control_enabled', true),
    inspectionRequired: getSetting('manufacturing.quality.inspection_required', true),

    // Production
    autoConsumeComponents: getSetting('manufacturing.production.auto_consume_components', false),
    backflushEnabled: getSetting('manufacturing.production.backflush_enabled', false)
  }), [getSetting]);

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
        try {
          // Load all manufacturing data from API
          const [wcData, poData, woData, qcData, bomData, statsData] = await Promise.all([
            workCentersService.list(companyId),
            productionOrdersService.list(companyId),
            workOrdersService.list(companyId),
            qualityChecksService.list(companyId),
            bomsService.list(companyId),
            productionOrdersService.getStats(companyId)
          ]);

          setWorkCenters(Array.isArray(wcData) ? wcData : (demoMode ? sampleWorkCenters : []));
          setProductionOrders(Array.isArray(poData) ? poData : (demoMode ? sampleProductionOrders : []));
          setWorkOrders(Array.isArray(woData) ? woData : (demoMode ? sampleWorkOrders : []));
          setQualityChecks(Array.isArray(qcData) ? qcData : (demoMode ? sampleQualityChecks : []));
          setBoms(Array.isArray(bomData) ? bomData : (demoMode ? sampleBOMs : []));
          setManufacturingStats(statsData);
        } catch (apiError) {
          console.warn('API call failed, falling back to demo data:', apiError);
          loadDemoData(demoMode);
        }
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
  }, [activeCompany]);

  const loadDemoData = (demoMode) => {
    setWorkCenters(demoMode ? sampleWorkCenters : []);
    setProductionOrders(demoMode ? sampleProductionOrders : []);
    setWorkOrders(demoMode ? sampleWorkOrders : []);
    setQualityChecks(demoMode ? sampleQualityChecks : []);
    setBoms(demoMode ? sampleBOMs : []);
    setManufacturingStats(null);
  };

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
  // QUALITY CHECK OPERATIONS
  // =====================================================
  const createQualityCheck = useCallback(async (data) => {
    const companyId = activeCompany?.id;
    try {
      const newQc = await qualityChecksService.create(data, companyId);
      setQualityChecks(prev => [newQc, ...prev]);
      return newQc;
    } catch (error) {
      console.error('Failed to create quality check:', error);
      throw error;
    }
  }, [activeCompany]);

  const getQualityStats = useCallback(async (params = {}) => {
    const companyId = activeCompany?.id;
    try {
      return await qualityChecksService.getStats(companyId, params);
    } catch (error) {
      console.error('Failed to get quality stats:', error);
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

  const qualityRate = qualityChecks.length > 0
    ? qualityChecks.reduce((sum, qc) => sum + (qc.pass_rate || 0), 0) / qualityChecks.length
    : 100;

  return (
    <ManufacturingContext.Provider value={{
      // State
      workCenters,
      productionOrders,
      workOrders,
      qualityChecks,
      boms,
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
      qualityRate,

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
      completeWorkOrder,
      recordWorkOrderTime,

      // Quality Check Operations
      createQualityCheck,
      getQualityStats,

      // BOM Operations
      createBOM,
      updateBOM,
      deleteBOM,

      // Refresh
      refreshData: loadData,

      // Admin Settings (from Admin Settings page)
      settings: manufacturingSettings,
      // Helper functions for settings
      getPlanningMethod: () => manufacturingSettings.planningMethod,
      getDefaultLeadTime: () => manufacturingSettings.defaultLeadTimeDays,
      getDefaultCapacity: () => manufacturingSettings.defaultCapacityHours,
      getDefaultEfficiency: () => manufacturingSettings.defaultEfficiencyRate,
      isQualityControlEnabled: () => manufacturingSettings.qualityControlEnabled,
      isInspectionRequired: () => manufacturingSettings.inspectionRequired,
      isAutoConsumeEnabled: () => manufacturingSettings.autoConsumeComponents,
      isBackflushEnabled: () => manufacturingSettings.backflushEnabled
    }}>
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
