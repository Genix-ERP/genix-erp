import apiClient from '../client';

export const subscriptionService = {
  // Get the current tenant's trial / subscription status
  async getStatus() {
    const response = await apiClient.get('/subscription/status');
    return response.data.data;
  },

  // Activate / upgrade the subscription after payment
  async activate(plan = 'starter') {
    const response = await apiClient.post('/subscription/activate', { plan });
    return response.data.data;
  },
};

export default subscriptionService;
