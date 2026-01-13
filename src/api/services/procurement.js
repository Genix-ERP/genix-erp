import apiClient from '../client';

export const procurementService = {
  // Suppliers
  async listSuppliers(params = {}) {
    const response = await apiClient.get('/contacts', {
      params: { ...params, contact_type: 'vendor' }
    });
    return response.data.data;
  },

  async getSupplier(id) {
    const response = await apiClient.get(`/contacts/${id}`);
    return response.data.data;
  },

  async createSupplier(data) {
    const response = await apiClient.post('/contacts', { ...data, contact_type: 'vendor' });
    return response.data.data;
  },

  async updateSupplier(id, data) {
    const response = await apiClient.put(`/contacts/${id}`, data);
    return response.data.data;
  },

  async deleteSupplier(id) {
    await apiClient.delete(`/contacts/${id}`);
  },

  // Purchase Orders
  async listOrders(params = {}) {
    const response = await apiClient.get('/purchase-orders', { params });
    return response.data.data;
  },

  async getOrder(id) {
    const response = await apiClient.get(`/purchase-orders/${id}`);
    return response.data.data;
  },

  async createOrder(data) {
    const response = await apiClient.post('/purchase-orders', data);
    return response.data.data;
  },

  async updateOrder(id, data) {
    const response = await apiClient.put(`/purchase-orders/${id}`, data);
    return response.data.data;
  },

  async deleteOrder(id) {
    await apiClient.delete(`/purchase-orders/${id}`);
  },

  async approveOrder(id) {
    const response = await apiClient.post(`/purchase-orders/${id}/approve`);
    return response.data.data;
  },

  async receiveOrder(id, data) {
    const response = await apiClient.post(`/purchase-orders/${id}/receive`, data);
    return response.data.data;
  },

  // RFQs (Request for Quotations)
  async listRFQs(params = {}) {
    const response = await apiClient.get('/rfqs', { params });
    return response.data.data;
  },

  async getRFQ(id) {
    const response = await apiClient.get(`/rfqs/${id}`);
    return response.data.data;
  },

  async createRFQ(data) {
    const response = await apiClient.post('/rfqs', data);
    return response.data.data;
  },

  async updateRFQ(id, data) {
    const response = await apiClient.put(`/rfqs/${id}`, data);
    return response.data.data;
  },

  async deleteRFQ(id) {
    await apiClient.delete(`/rfqs/${id}`);
  },

  // Contracts
  async listContracts(params = {}) {
    const response = await apiClient.get('/contracts', { params });
    return response.data.data;
  },

  async getContract(id) {
    const response = await apiClient.get(`/contracts/${id}`);
    return response.data.data;
  },

  async createContract(data) {
    const response = await apiClient.post('/contracts', data);
    return response.data.data;
  },

  async updateContract(id, data) {
    const response = await apiClient.put(`/contracts/${id}`, data);
    return response.data.data;
  },

  async deleteContract(id) {
    await apiClient.delete(`/contracts/${id}`);
  },
};

export default procurementService;
