import apiClient from '../client';

export const salesService = {
  // Sales Orders
  async listOrders(params = {}) {
    const response = await apiClient.get('/sales-orders', { params });
    return response.data.data;
  },

  async getOrder(id) {
    const response = await apiClient.get(`/sales-orders/${id}`);
    return response.data.data;
  },

  async createOrder(data) {
    const response = await apiClient.post('/sales-orders', data);
    return response.data.data;
  },

  async updateOrder(id, data) {
    const response = await apiClient.put(`/sales-orders/${id}`, data);
    return response.data.data;
  },

  async deleteOrder(id) {
    await apiClient.delete(`/sales-orders/${id}`);
  },

  async confirmOrder(id) {
    const response = await apiClient.post(`/sales-orders/${id}/confirm`);
    return response.data.data;
  },

  async cancelOrder(id) {
    const response = await apiClient.post(`/sales-orders/${id}/cancel`);
    return response.data.data;
  },

  async createInvoiceFromOrder(orderId) {
    const response = await apiClient.post(`/sales-orders/${orderId}/invoice`);
    return response.data.data;
  },

  // Sales Invoices
  async listInvoices(params = {}) {
    const response = await apiClient.get('/sales-invoices', { params });
    return response.data.data;
  },

  async getInvoice(id) {
    const response = await apiClient.get(`/sales-invoices/${id}`);
    return response.data.data;
  },

  async createInvoice(data) {
    const response = await apiClient.post('/sales-invoices', data);
    return response.data.data;
  },

  async updateInvoice(id, data) {
    const response = await apiClient.put(`/sales-invoices/${id}`, data);
    return response.data.data;
  },

  async deleteInvoice(id) {
    await apiClient.delete(`/sales-invoices/${id}`);
  },

  async sendInvoice(id) {
    const response = await apiClient.post(`/sales-invoices/${id}/send`);
    return response.data.data;
  },

  async recordPayment(invoiceId, data) {
    const response = await apiClient.post(`/sales-invoices/${invoiceId}/record-payment`, data);
    return response.data.data;
  },

  // Reports
  async getSalesSummary(params = {}) {
    const response = await apiClient.get('/reports/sales-summary', { params });
    return response.data.data;
  },

  // Delivery Orders
  async listDeliveryOrders(params = {}) {
    const response = await apiClient.get('/sales/delivery-orders', { params });
    return response.data;
  },

  async getDeliveryOrder(id) {
    const response = await apiClient.get(`/sales/delivery-orders/${id}`);
    return response.data.data;
  },

  async createDeliveryOrder(data) {
    const response = await apiClient.post('/sales/delivery-orders', data);
    return response.data.data;
  },

  async updateDeliveryOrder(id, data) {
    const response = await apiClient.put(`/sales/delivery-orders/${id}`, data);
    return response.data.data;
  },

  async validateDeliveryOrder(id) {
    const response = await apiClient.post(`/sales/delivery-orders/${id}/validate`);
    return response.data.data;
  },

  async cancelDeliveryOrder(id) {
    const response = await apiClient.post(`/sales/delivery-orders/${id}/cancel`);
    return response.data.data;
  },
};

export default salesService;
