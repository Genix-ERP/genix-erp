import apiClient from '../client';

export const cargoService = {
  // =====================================================
  // SHIPMENTS
  // =====================================================

  async listShipments(params = {}) {
    const response = await apiClient.get('/cargo/shipments', { params });
    return response.data.data;
  },

  async getShipment(id) {
    const response = await apiClient.get(`/cargo/shipments/${id}`);
    return response.data.data;
  },

  async createShipment(data) {
    const response = await apiClient.post('/cargo/shipments', data);
    return response.data.data;
  },

  async updateShipment(id, data) {
    const response = await apiClient.put(`/cargo/shipments/${id}`, data);
    return response.data.data;
  },

  async updateShipmentStatus(id, data) {
    const response = await apiClient.put(`/cargo/shipments/${id}/status`, data);
    return response.data.data;
  },

  async deleteShipment(id) {
    await apiClient.delete(`/cargo/shipments/${id}`);
  },

  // =====================================================
  // DISTRIBUTIONS
  // =====================================================

  async createDistribution(shipmentId, data) {
    const response = await apiClient.post(`/cargo/shipments/${shipmentId}/distribution`, data);
    return response.data.data;
  },

  // =====================================================
  // CASH REGISTER
  // =====================================================

  async listCashTransactions(params = {}) {
    const response = await apiClient.get('/cargo/cash', { params });
    return response.data.data;
  },

  async createCashTransaction(data) {
    const response = await apiClient.post('/cargo/cash', data);
    return response.data.data;
  },

  async updateCashTransaction(id, data) {
    const response = await apiClient.put(`/cargo/cash/${id}`, data);
    return response.data.data;
  },

  async deleteCashTransaction(id) {
    await apiClient.delete(`/cargo/cash/${id}`);
  },

  async getCashSummary() {
    const response = await apiClient.get('/cargo/cash/summary');
    return response.data.data;
  }
};

export default cargoService;
