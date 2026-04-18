import apiClient from '../client';

export const salesService = {
  // Dashboard summary — single call returns pre-computed stats
  async getSummary() {
    const response = await apiClient.get('/reports/sales-summary');
    return response.data.data;
  },

  // Quotations
  async listQuotations(params = {}) {
    const response = await apiClient.get('/quotations', { params });
    return response.data.data;
  },

  async getQuotation(id) {
    const response = await apiClient.get(`/quotations/${id}`);
    return response.data.data;
  },

  async createQuotation(data) {
    const response = await apiClient.post('/quotations', data);
    return response.data.data;
  },

  async updateQuotation(id, data) {
    const response = await apiClient.put(`/quotations/${id}`, data);
    return response.data.data;
  },

  async deleteQuotation(id) {
    await apiClient.delete(`/quotations/${id}`);
  },

  async convertQuotationToOrder(id) {
    const response = await apiClient.post(`/quotations/${id}/convert`);
    return response.data.data;
  },

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

  async createCreditNote(invoiceId, data) {
    const response = await apiClient.post(`/sales-invoices/${invoiceId}/credit-note`, data);
    return response.data.data;
  },

  async confirmCreditNote(creditNoteId) {
    const response = await apiClient.post(`/sales-invoices/${creditNoteId}/confirm-credit-note`);
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

  async validateDeliveryOrder(id, options = {}) {
    const params = options.partial ? '?partial=true' : '';
    const response = await apiClient.post(`/sales/delivery-orders/${id}/validate${params}`);
    return response.data;
  },

  async cancelDeliveryOrder(id) {
    const response = await apiClient.post(`/sales/delivery-orders/${id}/cancel`);
    return response.data.data;
  },

  // Sales Returns
  async listReturns(params = {}) {
    const response = await apiClient.get('/sales-returns', { params });
    return response.data.data;
  },

  async getReturn(id) {
    const response = await apiClient.get(`/sales-returns/${id}`);
    return response.data.data;
  },

  async createReturn(data) {
    const response = await apiClient.post('/sales-returns', data);
    return response.data.data;
  },

  async updateReturn(id, data) {
    const response = await apiClient.put(`/sales-returns/${id}`, data);
    return response.data.data;
  },

  async deleteReturn(id) {
    await apiClient.delete(`/sales-returns/${id}`);
  },

  async approveReturn(id) {
    const response = await apiClient.post(`/sales-returns/${id}/approve`);
    return response.data.data;
  },

  async rejectReturn(id) {
    const response = await apiClient.post(`/sales-returns/${id}/reject`);
    return response.data.data;
  },

  async processRefund(id, data) {
    const response = await apiClient.post(`/sales-returns/${id}/refund`, data);
    return response.data.data;
  },

  // Discounts
  async listDiscounts(params = {}) {
    const response = await apiClient.get('/discounts', { params });
    return response.data.data;
  },

  async getDiscount(id) {
    const response = await apiClient.get(`/discounts/${id}`);
    return response.data.data;
  },

  async createDiscount(data) {
    const response = await apiClient.post('/discounts', data);
    return response.data.data;
  },

  async updateDiscount(id, data) {
    const response = await apiClient.put(`/discounts/${id}`, data);
    return response.data.data;
  },

  async deleteDiscount(id) {
    await apiClient.delete(`/discounts/${id}`);
  },

  async validateDiscountCode(data) {
    const response = await apiClient.post('/discounts/validate', data);
    return response.data.data;
  },

  async useDiscountCode(id, data) {
    const response = await apiClient.post(`/discounts/${id}/use`, data);
    return response.data.data;
  },
};

export default salesService;
