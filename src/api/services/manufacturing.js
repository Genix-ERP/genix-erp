import apiClient from '../client';
import { checkBackendHealth, isDemoMode } from '@/config/dataMode';

// Storage keys
const WORK_CENTERS_KEY = 'genix_work_centers';
const PRODUCTION_ORDERS_KEY = 'genix_production_orders';
const WORK_ORDERS_KEY = 'genix_work_orders';
const QUALITY_CHECKS_KEY = 'genix_quality_checks';
const BOMS_KEY = 'genix_boms';

// Helper to get storage key with company prefix
const getStorageKey = (baseKey, companyId) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return companyId ? `${prefix}${baseKey}_${companyId}` : `${prefix}${baseKey}`;
};

// Generic local storage helpers
const getLocalData = (key, companyId) => {
  const storageKey = getStorageKey(key, companyId);
  const stored = localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalData = (key, data, companyId) => {
  const storageKey = getStorageKey(key, companyId);
  localStorage.setItem(storageKey, JSON.stringify(data));
};

// =====================================================
// WORK CENTERS SERVICE
// =====================================================
export const workCentersService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/work-centers', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch work centers from API:', error);
    }
    return getLocalData(WORK_CENTERS_KEY, companyId);
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/work-centers/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch work center from API:', error);
    }
    const items = getLocalData(WORK_CENTERS_KEY, companyId);
    return items.find(item => item.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/work-centers', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create work center via API:', error);
    }
    // Fallback to localStorage
    const items = getLocalData(WORK_CENTERS_KEY, companyId);
    const newItem = {
      id: `wc_${Date.now()}`,
      ...data,
      status: data.status || 'active',
      is_available: data.is_available !== false,
      capacity_per_hour: data.capacity_per_hour || 1,
      efficiency_factor: data.efficiency_factor || 100,
      oee_target: data.oee_target || 85,
      working_hours_per_day: data.working_hours_per_day || 8,
      hourly_cost: data.hourly_cost || 0,
      total_jobs_completed: 0,
      total_hours_worked: 0,
      current_utilization: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.unshift(newItem);
    saveLocalData(WORK_CENTERS_KEY, items, companyId);
    return newItem;
  },

  async update(id, data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/work-centers/${id}`, data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to update work center via API:', error);
    }
    const items = getLocalData(WORK_CENTERS_KEY, companyId);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
      saveLocalData(WORK_CENTERS_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async delete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/work-centers/${id}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete work center via API:', error);
    }
    const items = getLocalData(WORK_CENTERS_KEY, companyId);
    const filtered = items.filter(item => item.id !== id);
    saveLocalData(WORK_CENTERS_KEY, filtered, companyId);
    return true;
  }
};

// =====================================================
// PRODUCTION ORDERS SERVICE
// =====================================================
export const productionOrdersService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/production-orders', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch production orders from API:', error);
    }
    return getLocalData(PRODUCTION_ORDERS_KEY, companyId);
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/production-orders/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch production order from API:', error);
    }
    const items = getLocalData(PRODUCTION_ORDERS_KEY, companyId);
    return items.find(item => item.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/production-orders', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create production order via API:', error);
    }
    const items = getLocalData(PRODUCTION_ORDERS_KEY, companyId);
    const newItem = {
      id: `mo_${Date.now()}`,
      code: `MO-${Date.now().toString().slice(-8)}`,
      ...data,
      status: 'draft',
      quantity_produced: 0,
      quantity_scrapped: 0,
      progress_percent: 0,
      planned_cost: 0,
      actual_cost: 0,
      material_cost: 0,
      labor_cost: 0,
      overhead_cost: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.unshift(newItem);
    saveLocalData(PRODUCTION_ORDERS_KEY, items, companyId);
    return newItem;
  },

  async update(id, data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/production-orders/${id}`, data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to update production order via API:', error);
    }
    const items = getLocalData(PRODUCTION_ORDERS_KEY, companyId);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
      saveLocalData(PRODUCTION_ORDERS_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async delete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/production-orders/${id}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete production order via API:', error);
    }
    const items = getLocalData(PRODUCTION_ORDERS_KEY, companyId);
    const filtered = items.filter(item => item.id !== id);
    saveLocalData(PRODUCTION_ORDERS_KEY, filtered, companyId);
    return true;
  },

  async confirm(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/production-orders/${id}/confirm`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to confirm production order via API:', error);
    }
    return this.update(id, { status: 'confirmed', confirmed_at: new Date().toISOString() }, companyId);
  },

  async start(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/production-orders/${id}/start`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to start production order via API:', error);
    }
    return this.update(id, { status: 'in_progress', actual_start: new Date().toISOString() }, companyId);
  },

  async pause(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/production-orders/${id}/pause`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to pause production order via API:', error);
    }
    return this.update(id, { status: 'paused' }, companyId);
  },

  async complete(id, data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/production-orders/${id}/complete`, data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to complete production order via API:', error);
    }
    return this.update(id, {
      status: 'completed',
      actual_end: new Date().toISOString(),
      progress_percent: 100,
      ...data
    }, companyId);
  },

  async cancel(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/production-orders/${id}/cancel`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to cancel production order via API:', error);
    }
    return this.update(id, { status: 'cancelled' }, companyId);
  },

  async recordProduction(id, data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/production-orders/${id}/record-production`, data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to record production via API:', error);
    }
    const items = getLocalData(PRODUCTION_ORDERS_KEY, companyId);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      const order = items[index];
      const newProduced = (order.quantity_produced || 0) + (data.quantity_produced || 0);
      const newScrapped = (order.quantity_scrapped || 0) + (data.quantity_scrapped || 0);
      const progress = (newProduced / order.quantity_planned) * 100;
      items[index] = {
        ...order,
        quantity_produced: newProduced,
        quantity_scrapped: newScrapped,
        progress_percent: Math.min(progress, 100),
        updated_at: new Date().toISOString()
      };
      saveLocalData(PRODUCTION_ORDERS_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async getSchedule(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/production-orders/schedule', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch production schedule from API:', error);
    }
    // Return filtered local data for schedule view
    const items = getLocalData(PRODUCTION_ORDERS_KEY, companyId);
    return items.filter(item => item.status !== 'cancelled' && item.status !== 'closed');
  },

  async getStats(companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/production-orders/stats');
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch manufacturing stats from API:', error);
    }
    // Calculate from local data
    const orders = getLocalData(PRODUCTION_ORDERS_KEY, companyId);
    const workCenters = getLocalData(WORK_CENTERS_KEY, companyId);
    const qualityChecks = getLocalData(QUALITY_CHECKS_KEY, companyId);

    return {
      total_production_orders: orders.length,
      draft_orders: orders.filter(o => o.status === 'draft').length,
      confirmed_orders: orders.filter(o => o.status === 'confirmed').length,
      in_progress_orders: orders.filter(o => o.status === 'in_progress').length,
      completed_orders: orders.filter(o => o.status === 'completed').length,
      total_work_centers: workCenters.length,
      active_work_centers: workCenters.filter(wc => wc.status === 'active').length,
      total_quality_checks: qualityChecks.length,
      passed_checks: qualityChecks.filter(qc => qc.result === 'passed').length,
      failed_checks: qualityChecks.filter(qc => qc.result === 'failed').length
    };
  }
};

// =====================================================
// WORK ORDERS SERVICE
// =====================================================
export const workOrdersService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/work-orders', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch work orders from API:', error);
    }
    return getLocalData(WORK_ORDERS_KEY, companyId);
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/work-orders/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch work order from API:', error);
    }
    const items = getLocalData(WORK_ORDERS_KEY, companyId);
    return items.find(item => item.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/work-orders', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create work order via API:', error);
    }
    const items = getLocalData(WORK_ORDERS_KEY, companyId);
    const newItem = {
      id: `wo_${Date.now()}`,
      code: `WO-${Date.now().toString().slice(-8)}`,
      ...data,
      status: 'pending',
      quantity_produced: 0,
      quantity_scrapped: 0,
      progress_percent: 0,
      actual_duration_hours: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.unshift(newItem);
    saveLocalData(WORK_ORDERS_KEY, items, companyId);
    return newItem;
  },

  async start(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/work-orders/${id}/start`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to start work order via API:', error);
    }
    const items = getLocalData(WORK_ORDERS_KEY, companyId);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = {
        ...items[index],
        status: 'in_progress',
        actual_start: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      saveLocalData(WORK_ORDERS_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async complete(id, data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/work-orders/${id}/complete`, data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to complete work order via API:', error);
    }
    const items = getLocalData(WORK_ORDERS_KEY, companyId);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = {
        ...items[index],
        status: 'completed',
        actual_end: new Date().toISOString(),
        progress_percent: 100,
        ...data,
        updated_at: new Date().toISOString()
      };
      saveLocalData(WORK_ORDERS_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async recordTime(id, data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/work-orders/${id}/time`, data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to record time via API:', error);
    }
    const items = getLocalData(WORK_ORDERS_KEY, companyId);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      const currentDuration = items[index].actual_duration_hours || 0;
      items[index] = {
        ...items[index],
        actual_duration_hours: currentDuration + (data.duration_hours || 0),
        updated_at: new Date().toISOString()
      };
      saveLocalData(WORK_ORDERS_KEY, items, companyId);
      return items[index];
    }
    return null;
  }
};

// =====================================================
// QUALITY CHECKS SERVICE
// =====================================================
export const qualityChecksService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/quality-checks', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch quality checks from API:', error);
    }
    return getLocalData(QUALITY_CHECKS_KEY, companyId);
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/quality-checks/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch quality check from API:', error);
    }
    const items = getLocalData(QUALITY_CHECKS_KEY, companyId);
    return items.find(item => item.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/quality-checks', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create quality check via API:', error);
    }
    const items = getLocalData(QUALITY_CHECKS_KEY, companyId);

    // Determine result
    let result = 'pending';
    if (data.result) {
      result = data.result;
    } else if (data.quantity_failed > 0) {
      result = data.quantity_passed === 0 ? 'failed' : 'partial';
    } else if (data.quantity_passed > 0) {
      result = 'passed';
    }

    const passRate = data.quantity_inspected > 0
      ? (data.quantity_passed / data.quantity_inspected) * 100
      : 0;

    const newItem = {
      id: `qc_${Date.now()}`,
      code: `QC-${Date.now().toString().slice(-8)}`,
      ...data,
      result,
      pass_rate: passRate,
      inspection_date: data.inspection_date || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.unshift(newItem);
    saveLocalData(QUALITY_CHECKS_KEY, items, companyId);
    return newItem;
  },

  async getStats(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/quality-checks/stats', { params });
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch quality stats from API:', error);
    }
    const items = getLocalData(QUALITY_CHECKS_KEY, companyId);
    return {
      summary: {
        total_checks: items.length,
        passed: items.filter(qc => qc.result === 'passed').length,
        failed: items.filter(qc => qc.result === 'failed').length,
        partial: items.filter(qc => qc.result === 'partial').length,
        total_inspected: items.reduce((sum, qc) => sum + (qc.quantity_inspected || 0), 0),
        total_passed: items.reduce((sum, qc) => sum + (qc.quantity_passed || 0), 0),
        total_failed: items.reduce((sum, qc) => sum + (qc.quantity_failed || 0), 0),
        average_pass_rate: items.length > 0
          ? items.reduce((sum, qc) => sum + (qc.pass_rate || 0), 0) / items.length
          : 0
      },
      top_defects: []
    };
  },

  async listDefects(companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/quality-checks/defects');
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch quality defects from API:', error);
    }
    // Return default defect types
    return [
      { id: 'def_1', code: 'DIM', name: 'Dimensional Error', category: 'dimensional', severity: 'major' },
      { id: 'def_2', code: 'VIS', name: 'Visual Defect', category: 'visual', severity: 'minor' },
      { id: 'def_3', code: 'FUNC', name: 'Functional Failure', category: 'functional', severity: 'critical' },
      { id: 'def_4', code: 'MAT', name: 'Material Defect', category: 'material', severity: 'major' }
    ];
  },

  async createDefect(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/quality-checks/defects', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create quality defect via API:', error);
    }
    return {
      id: `def_${Date.now()}`,
      ...data,
      is_active: true,
      created_at: new Date().toISOString()
    };
  }
};

// =====================================================
// BILL OF MATERIALS (BOM) SERVICE
// =====================================================
export const bomsService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/boms', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch BOMs from API:', error);
    }
    return getLocalData(BOMS_KEY, companyId);
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/boms/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch BOM from API:', error);
    }
    const items = getLocalData(BOMS_KEY, companyId);
    return items.find(item => item.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/boms', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create BOM via API:', error);
    }
    // Fallback to localStorage
    const items = getLocalData(BOMS_KEY, companyId);
    const totalMaterialCost = (data.components || []).reduce((sum, c) => sum + ((c.cost || 0) * (c.quantity || 0)), 0);
    const totalOperationCost = (data.operations || []).reduce((sum, op) => sum + (((op.duration_minutes || 0) / 60) * (op.cost_per_hour || 0)), 0);

    const newItem = {
      id: `bom_${Date.now()}`,
      bom_reference: data.bom_reference || `BOM-${Date.now().toString().slice(-8)}`,
      ...data,
      status: data.status || 'active',
      total_material_cost: totalMaterialCost,
      total_operation_cost: totalOperationCost,
      total_cost: totalMaterialCost + totalOperationCost,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.unshift(newItem);
    saveLocalData(BOMS_KEY, items, companyId);
    return newItem;
  },

  async update(id, data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/boms/${id}`, data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to update BOM via API:', error);
    }
    // Fallback to localStorage
    const items = getLocalData(BOMS_KEY, companyId);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      const totalMaterialCost = (data.components || []).reduce((sum, c) => sum + ((c.cost || 0) * (c.quantity || 0)), 0);
      const totalOperationCost = (data.operations || []).reduce((sum, op) => sum + (((op.duration_minutes || 0) / 60) * (op.cost_per_hour || 0)), 0);

      items[index] = {
        ...items[index],
        ...data,
        total_material_cost: totalMaterialCost,
        total_operation_cost: totalOperationCost,
        total_cost: totalMaterialCost + totalOperationCost,
        updated_at: new Date().toISOString()
      };
      saveLocalData(BOMS_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async delete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/boms/${id}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete BOM via API:', error);
    }
    // Fallback to localStorage
    const items = getLocalData(BOMS_KEY, companyId);
    const filtered = items.filter(item => item.id !== id);
    saveLocalData(BOMS_KEY, filtered, companyId);
    return true;
  }
};

// Default export combining all services
export default {
  workCenters: workCentersService,
  productionOrders: productionOrdersService,
  workOrders: workOrdersService,
  qualityChecks: qualityChecksService,
  boms: bomsService
};
