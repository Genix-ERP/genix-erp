import apiClient from '../client';

export const followupsService = {
  // Summary
  getSummary: async () => {
    const response = await apiClient.get('/followups/summary');
    return response.data;
  },

  // Customer follow-ups
  listCustomerFollowups: async (params = {}) => {
    const response = await apiClient.get('/followups/customers', { params });
    return response.data;
  },

  getCustomerDetails: async (customerId) => {
    const response = await apiClient.get(`/followups/customers/${customerId}`);
    return response.data;
  },

  // Actions
  createAction: async (data) => {
    const response = await apiClient.post('/followups/actions', data);
    return response.data;
  },

  sendReminder: async (data) => {
    const response = await apiClient.post('/followups/send-reminder', data);
    return response.data;
  },

  // Payment promises
  createPromise: async (data) => {
    const response = await apiClient.post('/followups/promises', data);
    return response.data;
  },

  updatePromiseStatus: async (id, status) => {
    const response = await apiClient.put(`/followups/promises/${id}/status`, { status });
    return response.data;
  },
};

export const followupLevelsService = {
  list: async () => {
    const response = await apiClient.get('/followup-levels');
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/followup-levels', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/followup-levels/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/followup-levels/${id}`);
    return response.data;
  },
};
