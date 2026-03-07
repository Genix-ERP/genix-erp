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

  // Employee Permissions
  async getEmployeePermissions(employeeId) {
    const response = await apiClient.get(`/employees/${employeeId}/permissions`);
    return response.data.data;
  },

  async updateEmployeePermissions(employeeId, permissions) {
    const response = await apiClient.put(`/employees/${employeeId}/permissions`, { permissions });
    return response.data.data;
  },

  async updateEmployeeModulePermission(employeeId, modulePermission) {
    const response = await apiClient.put(`/employees/${employeeId}/permissions/module`, modulePermission);
    return response.data.data;
  },

  async deleteEmployeePermissions(employeeId) {
    await apiClient.delete(`/employees/${employeeId}/permissions`);
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

  // Employee Deductions
  async listEmployeeDeductions(employeeId, params = {}) {
    const response = await apiClient.get(`/employees/${employeeId}/deductions`, { params });
    return response.data.data;
  },

  async cancelDeduction(employeeId, deductionId, data) {
    const response = await apiClient.post(`/employees/${employeeId}/deductions/${deductionId}/cancel`, data);
    return response.data.data;
  },

  // Salary calculation with deductions
  async calculateSalary(employeeId) {
    const response = await apiClient.get(`/employees/${employeeId}/salary-calculate`);
    return response.data.data;
  },

  // Confirm salary payment (marks deductions as deducted)
  async confirmSalaryPayment(periodId, entryId) {
    const response = await apiClient.post(`/payroll-periods/${periodId}/entries/${entryId}/confirm`);
    return response.data.data;
  },
};

export default hrService;
