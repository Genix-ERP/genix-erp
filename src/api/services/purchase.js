import apiClient from '../client';

export const purchaseService = {
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

  async createBillFromPO(poId) {
    const response = await apiClient.post(`/purchase-orders/${poId}/bill`);
    return response.data.data;
  },
};

export default purchaseService;
