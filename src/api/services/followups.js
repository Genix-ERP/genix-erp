import apiClient from '../client';

// Backend wraps every payload as { success, data, meta? } — unwrap .data.data
const unwrap = (response) => response.data?.data ?? null;

export const followupsService = {
  // Summary
  getSummary: async () => {
    const response = await apiClient.get('/followups/summary');
    return unwrap(response);
  },

  // Customer follow-ups
  listCustomerFollowups: async (params = {}) => {
    const response = await apiClient.get('/followups/customers', { params });
    return unwrap(response);
  },

  getCustomerDetails: async (customerId) => {
    const response = await apiClient.get(`/followups/customers/${customerId}`);
    return unwrap(response);
  },

  // Actions
  createAction: async (data) => {
    const response = await apiClient.post('/followups/actions', data);
    return unwrap(response);
  },

  sendReminder: async (data) => {
    const response = await apiClient.post('/followups/send-reminder', data);
    return unwrap(response);
  },

  // Payment promises
  createPromise: async (data) => {
    const response = await apiClient.post('/followups/promises', data);
    return unwrap(response);
  },

  updatePromiseStatus: async (id, status) => {
    const response = await apiClient.put(`/followups/promises/${id}/status`, { status });
    return unwrap(response);
  },
};

export const followupLevelsService = {
  list: async () => {
    const response = await apiClient.get('/followup-levels');
    return unwrap(response);
  },

  create: async (data) => {
    const response = await apiClient.post('/followup-levels', data);
    return unwrap(response);
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/followup-levels/${id}`, data);
    return unwrap(response);
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/followup-levels/${id}`);
    return unwrap(response);
  },
};
