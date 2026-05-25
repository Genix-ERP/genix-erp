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

  // Monthly vedomost — aggregated per-period payroll view with every tax
  // pivoted into its own column. Returns { period, tax_columns, rows,
  // totals, employee_count }. Used to populate the Excel export button
  // on the Payroll page (§7.4 / §10 of ТЗ_Ish_Haqi_Soliq_Tolik.docx).
  async getPayrollVedomost(periodId) {
    const response = await apiClient.get(`/payroll-periods/${periodId}/vedomost`);
    return response.data.data;
  },

  async createPayrollEntry(periodId, data) {
    const response = await apiClient.post(`/payroll-periods/${periodId}/entries`, data);
    return response.data.data;
  },

  async updatePayrollEntry(periodId, entryId, data) {
    const response = await apiClient.put(`/payroll-periods/${periodId}/entries/${entryId}`, data);
    return response.data.data;
  },

  // ────────── TT "Ish haqi" module (simple advance/remainder flow) ──────────
  async getPayrollSettings() {
    const response = await apiClient.get('/payroll/settings');
    return response.data.data;
  },
  async updatePayrollSettings(data) {
    const response = await apiClient.put('/payroll/settings', data);
    return response.data.data;
  },
  // Auto-create or fetch the payroll period for a given YYYY-MM (default = this month)
  async getOrCreateCurrentMonthPayroll(month) {
    const params = month ? { month } : {};
    const response = await apiClient.post('/payroll/periods/current-or-create', null, { params });
    return response.data.data;
  },
  async markAdvancePaid(entryId, { paid, day } = { paid: true }) {
    const response = await apiClient.post(`/payroll/entries/${entryId}/advance-paid`, { paid, day });
    return response.data.data;
  },
  async markRemainderPaid(entryId, { paid, day } = { paid: true }) {
    const response = await apiClient.post(`/payroll/entries/${entryId}/remainder-paid`, { paid, day });
    return response.data.data;
  },
  // Backup dump — returns a Blob (application/json attachment)
  async exportPayrollBackup() {
    const response = await apiClient.get('/payroll/export', { responseType: 'blob' });
    return response.data;
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
  async confirmSalaryPayment(periodId, entryId, data = {}) {
    const response = await apiClient.post(`/payroll-periods/${periodId}/entries/${entryId}/confirm`, data);
    return response.data.data;
  },

  // Employee Loans
  async listEmployeeLoans(params = {}) {
    const response = await apiClient.get('/employee-loans', { params });
    return response.data;
  },

  async getEmployeeLoan(id) {
    const response = await apiClient.get(`/employee-loans/${id}`);
    return response.data.data;
  },

  async createEmployeeLoan(data) {
    const response = await apiClient.post('/employee-loans', data);
    return response.data.data;
  },

  async markLoanPaymentPaid(loanId, paymentId) {
    const response = await apiClient.post(`/employee-loans/${loanId}/payments/${paymentId}/mark-paid`);
    return response.data.data;
  },

  // Employee Self-Service Portal
  async getMyProfile() {
    const response = await apiClient.get('/my/profile');
    return response.data.data;
  },

  async getMyPayrollHistory() {
    const response = await apiClient.get('/my/payroll-history');
    return response.data.data;
  },

  async getMyLoan() {
    const response = await apiClient.get('/my/loan');
    return response.data.data;
  },
};

export default hrService;
