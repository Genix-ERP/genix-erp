import apiClient from '../client';

export const intercompanyService = {
  // =====================================================
  // INTERCOMPANY TRANSFERS (Product Transfers)
  // =====================================================

  // List all inter-company transfers with pagination and filters
  async listTransfers(params = {}) {
    const response = await apiClient.get('/intercompany-transfers', { params });
    return response.data;
  },

  // Get a single transfer by ID
  async getTransfer(id) {
    const response = await apiClient.get(`/intercompany-transfers/${id}`);
    return response.data.data;
  },

  // Create a new inter-company transfer
  async createTransfer(data) {
    const response = await apiClient.post('/intercompany-transfers', data);
    return response.data.data;
  },

  // Update an existing transfer (draft status only)
  async updateTransfer(id, data) {
    const response = await apiClient.put(`/intercompany-transfers/${id}`, data);
    return response.data.data;
  },

  // Delete a transfer (draft status only)
  async deleteTransfer(id) {
    await apiClient.delete(`/intercompany-transfers/${id}`);
  },

  // Approve a transfer (draft/pending_approval -> approved)
  async approveTransfer(id) {
    const response = await apiClient.post(`/intercompany-transfers/${id}/approve`);
    return response.data.data;
  },

  // Ship a transfer (approved -> in_transit)
  async shipTransfer(id) {
    const response = await apiClient.post(`/intercompany-transfers/${id}/ship`);
    return response.data.data;
  },

  // Receive a transfer (in_transit -> received)
  async receiveTransfer(id) {
    const response = await apiClient.post(`/intercompany-transfers/${id}/receive`);
    return response.data.data;
  },

  // =====================================================
  // INTERCOMPANY PAYMENTS (Money Transfers)
  // =====================================================

  // List all inter-company payments with pagination and filters
  async listPayments(params = {}) {
    const response = await apiClient.get('/intercompany-payments', { params });
    return response.data;
  },

  // Get a single payment by ID
  async getPayment(id) {
    const response = await apiClient.get(`/intercompany-payments/${id}`);
    return response.data.data;
  },

  // Create a new inter-company payment
  async createPayment(data) {
    const response = await apiClient.post('/intercompany-payments', data);
    return response.data.data;
  },

  // Approve and complete a payment (draft -> completed)
  async approvePayment(id) {
    const response = await apiClient.post(`/intercompany-payments/${id}/approve`);
    return response.data.data;
  },

  // Delete a payment (draft status only)
  async deletePayment(id) {
    await apiClient.delete(`/intercompany-payments/${id}`);
  },

  // =====================================================
  // INTERCOMPANY BALANCES
  // =====================================================

  // Get balances between organizations
  async getBalances(params = {}) {
    const response = await apiClient.get('/intercompany-balances', { params });
    return response.data.data;
  },
};

export default intercompanyService;
