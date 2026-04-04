import apiClient from '../client';

export const subscriptionService = {
  async getStatus() {
    const response = await apiClient.get('/subscription/status');
    return response.data.data;
  },

  async getPlans() {
    const response = await apiClient.get('/subscription/plans');
    return response.data.data;
  },

  // Create a Multicard checkout session → returns { checkout_url, invoice_id, uuid }
  async createCheckout(plan) {
    const response = await apiClient.post('/subscription/checkout', { plan });
    return response.data.data;
  },

  // Manual activation (admin / testing only)
  async activate(plan = 'starter') {
    const response = await apiClient.post('/subscription/activate', { plan });
    return response.data.data;
  },
};

export default subscriptionService;
