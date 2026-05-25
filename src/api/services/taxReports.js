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

  // Employee taxes aggregation (migration 330) — per-tax breakdown of payroll taxes
  getEmployeeTaxReport: async (startDate, endDate) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await apiClient.get('/tax-reports/employee-taxes', { params });
    return response.data.data;
  },

  // Per-tax XML export for regulator filings — NDFL quarterly, ESP
  // monthly, INPS monthly. Backend streams application/xml with a
  // Content-Disposition attachment header; we trigger the download on
  // the client by creating a blob URL so the filename from the server
  // is preserved.
  exportEmployeeTaxXML: async ({ taxCode, startDate, endDate }) => {
    const response = await apiClient.get('/tax-reports/employee-taxes/xml', {
      params: { tax_code: taxCode, start_date: startDate, end_date: endDate },
      responseType: 'blob',
    });
    const disposition = response.headers?.['content-disposition'] || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const filename = (match && match[1]) ||
      `tax-report-${String(taxCode).toLowerCase()}-${startDate}-${endDate}.xml`;
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    return { filename };
  },

  // Record a payment against an accrued employee-tax liability. The
  // backend (migration 360) inserts a row in employee_tax_payments and
  // posts a Dr-liability / Cr-cash journal entry. After this returns,
  // re-fetch getEmployeeTaxReport — the row's `pending` value drops
  // by the paid amount.
  recordEmployeeTaxPayment: async ({ taxCode, periodStart, periodEnd, amount, paymentMethod, bankAccountId, note }) => {
    const response = await apiClient.post('/employee-taxes/payments', {
      tax_code: taxCode,
      period_start: periodStart,
      period_end: periodEnd,
      amount: Number(amount),
      payment_method: paymentMethod || undefined,
      bank_account_id: bankAccountId || undefined,
      note: note || undefined,
    });
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

  payPeriod: async (id, data = {}) => {
    const response = await apiClient.post(`/tax-reports/periods/${id}/pay`, data);
    return response.data.data;
  },
};
