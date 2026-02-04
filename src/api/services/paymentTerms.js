import apiClient from '../client';

export const paymentTermsService = {
  // List all payment terms
  async list(params = {}) {
    const response = await apiClient.get('/payment-terms', { params });
    return response.data?.data;
  },

  // Get a single payment term
  async get(id) {
    const response = await apiClient.get(`/payment-terms/${id}`);
    return response.data?.data;
  },

  // Create a payment term
  async create(data) {
    const response = await apiClient.post('/payment-terms', data);
    return response.data?.data;
  },

  // Update a payment term
  async update(id, data) {
    const response = await apiClient.put(`/payment-terms/${id}`, data);
    return response.data?.data;
  },

  // Delete a payment term
  async delete(id) {
    const response = await apiClient.delete(`/payment-terms/${id}`);
    return response.data?.data;
  },

  // Get default payment term
  async getDefault() {
    const response = await apiClient.get('/payment-terms/default');
    return response.data?.data;
  },

  // Set a payment term as default
  async setDefault(id) {
    const response = await apiClient.post(`/payment-terms/${id}/set-default`);
    return response.data?.data;
  },

  // Get payment terms statistics
  async getStats() {
    const response = await apiClient.get('/payment-terms/stats');
    return response.data?.data;
  },

  // Calculate due date based on payment term and invoice date
  async calculateDueDate(paymentTermId, invoiceDate) {
    const response = await apiClient.post('/payment-terms/calculate-due-date', {
      payment_term_id: paymentTermId,
      invoice_date: invoiceDate,
    });
    return response.data?.data;
  },

  // Get payment terms for dropdowns (simplified list)
  async listForDropdown(params = {}) {
    const response = await apiClient.get('/payment-terms', {
      params: { ...params, is_active: true }
    });
    const terms = response.data?.data || [];
    return terms.map(term => ({
      id: term.id,
      code: term.code,
      name: term.name,
      due_days: term.due_days,
      is_default: term.is_default,
      description: term.description,
    }));
  },
};

export default paymentTermsService;
