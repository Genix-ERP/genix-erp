import apiClient from '../client';

export const hrService = {
  // Employees
  async listEmployees(params = {}) {
    const response = await apiClient.get('/employees', { params });
    return response.data.data;
  },

  async getEmployee(id) {
    const response = await apiClient.get(`/employees/${id}`);
    return response.data.data;
  },

  async createEmployee(data) {
    const response = await apiClient.post('/employees', data);
    return response.data.data;
  },

  async updateEmployee(id, data) {
    const response = await apiClient.put(`/employees/${id}`, data);
    return response.data.data;
  },

  async deleteEmployee(id) {
    await apiClient.delete(`/employees/${id}`);
  },

  // Payroll Periods
  async listPayrollPeriods(params = {}) {
    const response = await apiClient.get('/payroll-periods', { params });
    return response.data.data;
  },

  async getPayrollPeriod(id) {
    const response = await apiClient.get(`/payroll-periods/${id}`);
    return response.data.data;
  },

  async createPayrollPeriod(data) {
    const response = await apiClient.post('/payroll-periods', data);
    return response.data.data;
  },

  async updatePayrollPeriod(id, data) {
    const response = await apiClient.put(`/payroll-periods/${id}`, data);
    return response.data.data;
  },

  async deletePayrollPeriod(id) {
    await apiClient.delete(`/payroll-periods/${id}`);
  },

  async processPayroll(id) {
    const response = await apiClient.post(`/payroll-periods/${id}/process`);
    return response.data.data;
  },

  // Payroll Entries
  async listPayrollEntries(periodId, params = {}) {
    const response = await apiClient.get(`/payroll-periods/${periodId}/entries`, { params });
    return response.data.data;
  },

  async createPayrollEntry(periodId, data) {
    const response = await apiClient.post(`/payroll-periods/${periodId}/entries`, data);
    return response.data.data;
  },
};

export default hrService;
