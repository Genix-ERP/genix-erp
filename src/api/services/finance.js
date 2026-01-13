import apiClient from '../client';

export const financeService = {
  // Bank Accounts
  async listBankAccounts(params = {}) {
    const response = await apiClient.get('/bank-accounts', { params });
    return response.data.data;
  },

  async getBankAccount(id) {
    const response = await apiClient.get(`/bank-accounts/${id}`);
    return response.data.data;
  },

  async createBankAccount(data) {
    const response = await apiClient.post('/bank-accounts', data);
    return response.data.data;
  },

  async updateBankAccount(id, data) {
    const response = await apiClient.put(`/bank-accounts/${id}`, data);
    return response.data.data;
  },

  async deleteBankAccount(id) {
    await apiClient.delete(`/bank-accounts/${id}`);
  },

  // Bank Transactions (for reconciliation)
  async listBankTransactions(bankAccountId, params = {}) {
    const response = await apiClient.get(`/bank-accounts/${bankAccountId}/transactions`, { params });
    return response.data.data;
  },

  async createBankTransaction(bankAccountId, data) {
    const response = await apiClient.post(`/bank-accounts/${bankAccountId}/transactions`, data);
    return response.data.data;
  },

  async reconcileBankTransaction(bankAccountId, transactionId) {
    const response = await apiClient.post(`/bank-accounts/${bankAccountId}/transactions/${transactionId}/reconcile`);
    return response.data.data;
  },

  async importBankStatement(bankAccountId, data) {
    const response = await apiClient.post(`/bank-accounts/${bankAccountId}/import`, data);
    return response.data.data;
  },

  // Cash Transactions (Kassa)
  async listCashTransactions(params = {}) {
    const response = await apiClient.get('/cash-transactions', { params });
    return response.data.data;
  },

  async getCashTransaction(id) {
    const response = await apiClient.get(`/cash-transactions/${id}`);
    return response.data.data;
  },

  async createCashTransaction(data) {
    const response = await apiClient.post('/cash-transactions', data);
    return response.data.data;
  },

  async updateCashTransaction(id, data) {
    const response = await apiClient.put(`/cash-transactions/${id}`, data);
    return response.data.data;
  },

  async deleteCashTransaction(id) {
    await apiClient.delete(`/cash-transactions/${id}`);
  },

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
  async listCurrencies(params = {}) {
    const response = await apiClient.get('/currencies', { params });
    return response.data.data;
  },

  async getCurrency(code) {
    const response = await apiClient.get(`/currencies/${code}`);
    return response.data.data;
  },

  async createCurrency(data) {
    const response = await apiClient.post('/currencies', data);
    return response.data.data;
  },

  async updateCurrency(code, data) {
    const response = await apiClient.put(`/currencies/${code}`, data);
    return response.data.data;
  },

  async deleteCurrency(code) {
    await apiClient.delete(`/currencies/${code}`);
  },

  async getExchangeRate(code, date = null) {
    const params = date ? { date } : {};
    const response = await apiClient.get(`/currencies/${code}/rate`, { params });
    return response.data.data;
  },

  async setExchangeRate(code, data) {
    const response = await apiClient.post(`/currencies/${code}/rate`, data);
    return response.data.data;
  },

  async listExchangeRates(params = {}) {
    const response = await apiClient.get('/exchange-rates', { params });
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
