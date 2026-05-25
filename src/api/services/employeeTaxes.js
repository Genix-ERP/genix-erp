import apiClient from '../client';

// employeeTaxes.js — admin/catalog CRUD for configurable per-tenant employee taxes,
// plus the preview endpoint used by the create-payroll modal.
// Backed by migration 330 and handler/employee_taxes.go.

export const employeeTaxesService = {
  // List all configured taxes (settings screen). Pass onlyActive=true to narrow
  // to the ones that are applied automatically when creating payroll.
  list: async ({ onlyActive = false } = {}) => {
    const params = {};
    if (onlyActive) params.only_active = true;
    const response = await apiClient.get('/employee-taxes', { params });
    return response.data.data || [];
  },

  create: async (data) => {
    const response = await apiClient.post('/employee-taxes', data);
    return response.data.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/employee-taxes/${id}`, data);
    return response.data.data;
  },

  remove: async (id) => {
    const response = await apiClient.delete(`/employee-taxes/${id}`);
    return response.data.data;
  },

  // Show what would be applied to a hypothetical payroll entry. Used by the
  // create-payroll modal to render the tax rows (each with an X to exclude) and
  // recompute net pay as the user edits salary fields.
  preview: async ({ baseSalary = 0, overtimeAmount = 0, bonus = 0, allowances = 0, excludedTaxIds = [] } = {}) => {
    const response = await apiClient.post('/employee-taxes/preview', {
      base_salary: Number(baseSalary) || 0,
      overtime_amount: Number(overtimeAmount) || 0,
      bonus: Number(bonus) || 0,
      allowances: Number(allowances) || 0,
      excluded_tax_ids: excludedTaxIds,
    });
    return response.data.data;
  },

  // Read the persisted tax snapshot rows for a single payroll entry.
  listForEntry: async (periodId, entryId) => {
    const response = await apiClient.get(`/payroll-periods/${periodId}/entries/${entryId}/taxes`);
    return response.data.data || [];
  },
};

export default employeeTaxesService;
