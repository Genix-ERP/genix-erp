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
  // users: number of users, billing: 'monthly' | 'yearly'
  async createCheckout(users, billing) {
    const response = await apiClient.post('/subscription/checkout', { users, billing });
    return response.data.data;
  },

  async getPayments() {
    const response = await apiClient.get('/subscription/payments');
    return response.data.data;
  },

  async verifyPayment(invoiceId) {
    const response = await apiClient.post('/subscription/verify-payment', { invoice_id: invoiceId });
    return response.data.data;
  },

  // Manual activation (admin / testing only)
  async activate(plan = 'starter') {
    const response = await apiClient.post('/subscription/activate', { plan });
    return response.data.data;
  },
};

export default subscriptionService;
