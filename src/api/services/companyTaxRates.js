import apiClient from '../client';

// companyTaxRates.js — admin/catalog CRUD for activity-level taxes
// (NDS / Profit / Turnover / Dividend). Separate from employee_taxes
// (which drives payroll) — see migration 340 and the handler at
// handler/company_tax_rates.go.

export const companyTaxRatesService = {
  // List all configured rates. Pass onlyActive=true to narrow to the
  // ones that should be applied by reports / posting flows.
  list: async ({ onlyActive = false } = {}) => {
    const params = {};
    if (onlyActive) params.only_active = true;
    const response = await apiClient.get('/company-tax-rates', { params });
    return response.data.data || [];
  },

  create: async (data) => {
    const response = await apiClient.post('/company-tax-rates', data);
    return response.data.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/company-tax-rates/${id}`, data);
    return response.data.data;
  },

  remove: async (id) => {
    const response = await apiClient.delete(`/company-tax-rates/${id}`);
    return response.data.data;
  },
};

export default companyTaxRatesService;
