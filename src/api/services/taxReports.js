import apiClient from '../client';

export const taxReportsService = {
  // Summary
  getSummary: async (startDate, endDate) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await apiClient.get('/tax-reports/summary', { params });
    return response.data.data;
  },

  // Transactions
  getTransactions: async (startDate, endDate, type = null) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (type) params.type = type;
    const response = await apiClient.get('/tax-reports/transactions', { params });
    return response.data.data || [];
  },

  // Periods
  listPeriods: async (params = {}) => {
    const response = await apiClient.get('/tax-reports/periods', { params });
    return response.data.data || [];
  },

  getPeriod: async (id) => {
    const response = await apiClient.get(`/tax-reports/periods/${id}`);
    return response.data.data;
  },

  createPeriod: async (data) => {
    const response = await apiClient.post('/tax-reports/periods', data);
    return response.data.data;
  },

  calculateReport: async (id) => {
    const response = await apiClient.post(`/tax-reports/periods/${id}/calculate`);
    return response.data.data;
  },

  fileReport: async (id, data = {}) => {
    const response = await apiClient.post(`/tax-reports/periods/${id}/file`, data);
    return response.data.data;
  },

  deletePeriod: async (id) => {
    const response = await apiClient.delete(`/tax-reports/periods/${id}`);
    return response.data.data;
  },
};
