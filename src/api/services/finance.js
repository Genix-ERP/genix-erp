import apiClient from '../client';

export const financeService = {
  // Chart of Accounts
  async listAccounts(params = {}) {
    const response = await apiClient.get('/accounts', { params });
    return response.data.data;
  },

  async getAccount(id) {
    const response = await apiClient.get(`/accounts/${id}`);
    return response.data.data;
  },

  async createAccount(data) {
    const response = await apiClient.post('/accounts', data);
    return response.data.data;
  },

  async updateAccount(id, data) {
    const response = await apiClient.put(`/accounts/${id}`, data);
    return response.data.data;
  },

  async deleteAccount(id) {
    await apiClient.delete(`/accounts/${id}`);
  },

  async getAccountTransactions(accountId, params = {}) {
    const response = await apiClient.get(`/accounts/${accountId}/transactions`, { params });
    return response.data.data;
  },

  // Journal Entries
  async listJournalEntries(params = {}) {
    const response = await apiClient.get('/journal-entries', { params });
    return response.data.data;
  },

  async getJournalEntry(id) {
    const response = await apiClient.get(`/journal-entries/${id}`);
    return response.data.data;
  },

  async createJournalEntry(data) {
    const response = await apiClient.post('/journal-entries', data);
    return response.data.data;
  },

  async postJournalEntry(id) {
    const response = await apiClient.post(`/journal-entries/${id}/post`);
    return response.data.data;
  },

  async reverseJournalEntry(id) {
    const response = await apiClient.post(`/journal-entries/${id}/reverse`);
    return response.data.data;
  },

  // Payments
  async listPayments(params = {}) {
    const response = await apiClient.get('/payments', { params });
    return response.data.data;
  },

  async getPayment(id) {
    const response = await apiClient.get(`/payments/${id}`);
    return response.data.data;
  },

  async createPayment(data) {
    const response = await apiClient.post('/payments', data);
    return response.data.data;
  },

  async confirmPayment(id) {
    const response = await apiClient.post(`/payments/${id}/confirm`);
    return response.data.data;
  },

  // Tax Rates
  async listTaxRates(params = {}) {
    const response = await apiClient.get('/tax-rates', { params });
    return response.data.data;
  },

  async createTaxRate(data) {
    const response = await apiClient.post('/tax-rates', data);
    return response.data.data;
  },

  async updateTaxRate(id, data) {
    const response = await apiClient.put(`/tax-rates/${id}`, data);
    return response.data.data;
  },

  async deleteTaxRate(id) {
    await apiClient.delete(`/tax-rates/${id}`);
  },

  // Currencies
  async listCurrencies() {
    const response = await apiClient.get('/currencies');
    return response.data.data;
  },

  async getExchangeRate(code) {
    const response = await apiClient.get(`/currencies/${code}/rate`);
    return response.data.data;
  },

  // Reports
  async getBalanceSheet(params = {}) {
    const response = await apiClient.get('/reports/balance-sheet', { params });
    return response.data.data;
  },

  async getIncomeStatement(params = {}) {
    const response = await apiClient.get('/reports/income-statement', { params });
    return response.data.data;
  },

  async getCashFlow(params = {}) {
    const response = await apiClient.get('/reports/cash-flow', { params });
    return response.data.data;
  },

  async getTrialBalance(params = {}) {
    const response = await apiClient.get('/reports/trial-balance', { params });
    return response.data.data;
  },

  async getGeneralLedger(params = {}) {
    const response = await apiClient.get('/reports/general-ledger', { params });
    return response.data.data;
  },

  async getAgingReceivables(params = {}) {
    const response = await apiClient.get('/reports/aging-receivables', { params });
    return response.data.data;
  },

  async getAgingPayables(params = {}) {
    const response = await apiClient.get('/reports/aging-payables', { params });
    return response.data.data;
  },
};

export default financeService;
