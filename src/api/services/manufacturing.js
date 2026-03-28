import apiClient from '../client';

// =====================================================
// WORK CENTERS SERVICE
// =====================================================
export const workCentersService = {
  async list(companyId, params = {}) {
    const response = await apiClient.get('/work-centers', { params });
    return response.data.data || [];
  },

  async get(id) {
    const response = await apiClient.get(`/work-centers/${id}`);
    return response.data.data;
  },

  async create(data) {
    const response = await apiClient.post('/work-centers', data);
    return response.data.data;
  },

  async update(id, data) {
    const response = await apiClient.put(`/work-centers/${id}`, data);
    return response.data.data;
  },

  async delete(id) {
    await apiClient.delete(`/work-centers/${id}`);
    return true;
  },

  async getEmployees(id) {
    const response = await apiClient.get(`/work-centers/${id}/employees`);
    return response.data.data?.employees || [];
  },

  async assignEmployees(id, data) {
    const response = await apiClient.post(`/work-centers/${id}/employees`, data);
    return response.data;
  },

  async removeEmployee(wcId, employeeId) {
    await apiClient.delete(`/work-centers/${wcId}/employees/${employeeId}`);
    return true;
  }
};

// =====================================================
// PRODUCTION ORDERS SERVICE
// =====================================================
export const productionOrdersService = {
  async list(companyId, params = {}) {
    try {
      const response = await apiClient.get('/production-orders', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('Error listing production orders:', error.response?.data || error.message);
      throw error;
    }
  },

  async get(id) {
    try {
      const response = await apiClient.get(`/production-orders/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting production order:', error.response?.data || error.message);
      throw error;
    }
  },

  async create(data) {
    try {
      const response = await apiClient.post('/production-orders', data);
      return response.data.data;
    } catch (error) {
      console.error('Error creating production order:');
      console.error('Response data:', error.response?.data);
      console.error('Error message:', error.message);
      throw error;
    }
  },

  async update(id, data) {
    const response = await apiClient.put(`/production-orders/${id}`, data);
    return response.data.data;
  },

  async delete(id) {
    await apiClient.delete(`/production-orders/${id}`);
    return true;
  },

  async confirm(id) {
    const response = await apiClient.post(`/production-orders/${id}/confirm`);
    return response.data.data;
  },

  async start(id) {
    const response = await apiClient.post(`/production-orders/${id}/start`);
    return response.data.data;
  },

  async pause(id) {
    const response = await apiClient.post(`/production-orders/${id}/pause`);
    return response.data.data;
  },

  async complete(id, data = {}) {
    const response = await apiClient.post(`/production-orders/${id}/complete`, data);
    return response.data.data;
  },

  async cancel(id) {
    const response = await apiClient.post(`/production-orders/${id}/cancel`);
    return response.data.data;
  },

  async recordProduction(id, data) {
    const response = await apiClient.post(`/production-orders/${id}/record-production`, data);
    return response.data.data;
  },

  async getStats(companyId) {
    const response = await apiClient.get('/production-orders/stats');
    return response.data.data;
  },

  async getSchedule(params = {}) {
    const response = await apiClient.get('/production-orders/schedule', { params });
    return response.data.data || [];
  }
};

// =====================================================
// WORK ORDERS SERVICE
// =====================================================
export const workOrdersService = {
  async list(companyId, params = {}) {
    const response = await apiClient.get('/work-orders', { params: { limit: 100, ...params } });
    return response.data.data || [];
  },

  async get(id) {
    const response = await apiClient.get(`/work-orders/${id}`);
    return response.data.data;
  },

  async create(data) {
    const response = await apiClient.post('/work-orders', data);
    return response.data.data;
  },

  async update(id, data) {
    const response = await apiClient.put(`/work-orders/${id}`, data);
    return response.data.data;
  },

  async delete(id) {
    await apiClient.delete(`/work-orders/${id}`);
    return true;
  },

  async start(id, data = {}) {
    const response = await apiClient.post(`/work-orders/${id}/start`, data);
    return response.data.data;
  },

  async pause(id) {
    const response = await apiClient.post(`/work-orders/${id}/pause`);
    return response.data.data;
  },

  async complete(id, data) {
    const response = await apiClient.post(`/work-orders/${id}/complete`, data);
    return response.data.data;
  },

  async recordTime(id, data) {
    const response = await apiClient.post(`/work-orders/${id}/time`, data);
    return response.data.data;
  }
};

// =====================================================
// MANUFACTURING TRANSFERS SERVICE
// =====================================================
export const manufacturingTransfersService = {
  async list(params = {}) {
    const response = await apiClient.get('/manufacturing-transfers', { params });
    return response.data.data || [];
  },

  async get(id) {
    const response = await apiClient.get(`/manufacturing-transfers/${id}`);
    return response.data.data;
  },

  async validate(id, data = {}) {
    const response = await apiClient.post(`/manufacturing-transfers/${id}/validate`, data);
    return response.data.data;
  }
};

// =====================================================
// BOMS SERVICE
// =====================================================
export const bomsService = {
  async list(companyId, params = {}) {
    const response = await apiClient.get('/boms', { params });
    return response.data.data || [];
  },

  async get(id) {
    const response = await apiClient.get(`/boms/${id}`);
    return response.data.data;
  },

  async create(data) {
    const response = await apiClient.post('/boms', data);
    return response.data.data;
  },

  async update(id, data) {
    const response = await apiClient.put(`/boms/${id}`, data);
    return response.data.data;
  },

  async delete(id) {
    await apiClient.delete(`/boms/${id}`);
    return true;
  },

  // BOM Lines (components)
  async createLine(bomId, data) {
    const response = await apiClient.post(`/boms/${bomId}/lines`, data);
    return response.data.data;
  },

  async deleteLine(bomId, lineId) {
    await apiClient.delete(`/boms/${bomId}/lines/${lineId}`);
    return true;
  },

  // BOM Operations (routing)
  async listOperations(bomId) {
    const response = await apiClient.get(`/boms/${bomId}/operations`);
    return response.data.data || [];
  },

  async createOperation(bomId, data) {
    const response = await apiClient.post(`/boms/${bomId}/operations`, data);
    return response.data.data;
  },

  async updateOperation(bomId, operationId, data) {
    const response = await apiClient.put(`/boms/${bomId}/operations/${operationId}`, data);
    return response.data.data;
  },

  async deleteOperation(bomId, operationId) {
    await apiClient.delete(`/boms/${bomId}/operations/${operationId}`);
    return true;
  }
};

// =====================================================
// EQUIPMENT SERVICE
// =====================================================
export const equipmentService = {
  async list(params = {}) {
    const response = await apiClient.get('/equipment', { params });
    return response.data.data || [];
  },

  async create(data) {
    const response = await apiClient.post('/equipment', data);
    return response.data.data;
  },

  async update(id, data) {
    const response = await apiClient.put(`/equipment/${id}`, data);
    return response.data.data;
  },

  async delete(id) {
    await apiClient.delete(`/equipment/${id}`);
    return true;
  },

  async listMaintenance(equipmentId) {
    const response = await apiClient.get(`/equipment/${equipmentId}/maintenance`);
    return response.data.data || [];
  },

  async createMaintenance(equipmentId, data) {
    const response = await apiClient.post(`/equipment/${equipmentId}/maintenance`, data);
    return response.data.data;
  },

  async completeMaintenance(equipmentId, taskId, data) {
    const response = await apiClient.put(`/equipment/${equipmentId}/maintenance/${taskId}`, data);
    return response.data.data;
  },

  async updateMaintenance(equipmentId, taskId, data) {
    const response = await apiClient.patch(`/equipment/${equipmentId}/maintenance/${taskId}`, data);
    return response.data.data;
  }
};

// =====================================================
// MANUFACTURING CATEGORIES SERVICE
// =====================================================
export const manufacturingCategoriesService = {
  async list() {
    const response = await apiClient.get('/manufacturing-categories');
    return response.data.data || [];
  },

  async create(data) {
    const response = await apiClient.post('/manufacturing-categories', data);
    return response.data.data;
  },

  async update(id, data) {
    const response = await apiClient.put(`/manufacturing-categories/${id}`, data);
    return response.data.data;
  },

  async delete(id) {
    await apiClient.delete(`/manufacturing-categories/${id}`);
    return true;
  }
};
