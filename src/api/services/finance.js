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

  // Account Types (for Chart of Accounts)
  async listAccountTypes() {
    const response = await apiClient.get('/account-types');
    return response.data.data;
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

  // Journals (accounting journals like GEN, SAL, PUR)
  async listJournals() {
    const response = await apiClient.get('/journals');
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

  // Expense Categories
  async listExpenseCategories(params = {}) {
    const response = await apiClient.get('/expense-categories', { params });
    return response.data.data;
  },

  // Expenses
  async listExpenses(params = {}) {
    const response = await apiClient.get('/expenses', { params });
    return response.data.data;
  },

  async getExpense(id) {
    const response = await apiClient.get(`/expenses/${id}`);
    return response.data.data;
  },

  async createExpense(data) {
    const response = await apiClient.post('/expenses', data);
    return response.data.data;
  },

  async updateExpense(id, data) {
    const response = await apiClient.put(`/expenses/${id}`, data);
    return response.data.data;
  },

  async deleteExpense(id) {
    await apiClient.delete(`/expenses/${id}`);
  },

  async approveExpense(id) {
    const response = await apiClient.post(`/expenses/${id}/approve`);
    return response.data.data;
  },

  // Asset Categories
  async listAssetCategories(params = {}) {
    const response = await apiClient.get('/asset-categories', { params });
    return response.data.data;
  },

  // Fixed Assets
  async listFixedAssets(params = {}) {
    const response = await apiClient.get('/fixed-assets', { params });
    return response.data.data;
  },

  async getFixedAsset(id) {
    const response = await apiClient.get(`/fixed-assets/${id}`);
    return response.data.data;
  },

  async createFixedAsset(data) {
    const response = await apiClient.post('/fixed-assets', data);
    return response.data.data;
  },

  async updateFixedAsset(id, data) {
    const response = await apiClient.put(`/fixed-assets/${id}`, data);
    return response.data.data;
  },

  async deleteFixedAsset(id) {
    await apiClient.delete(`/fixed-assets/${id}`);
  },

  async disposeFixedAsset(id, data) {
    const response = await apiClient.post(`/fixed-assets/${id}/dispose`, data);
    return response.data.data;
  },

  async getDepreciationEntries(id) {
    const response = await apiClient.get(`/fixed-assets/${id}/depreciation`);
    return response.data.data;
  },

  async runDepreciation(data) {
    const response = await apiClient.post('/run-depreciation', data);
    return response.data;
  },

  // Purchase Invoices (Vendor Bills)
  async listPurchaseInvoices(params = {}) {
    const response = await apiClient.get('/purchase-invoices', { params });
    return response.data;
  },

  async getPurchaseInvoice(id) {
    const response = await apiClient.get(`/purchase-invoices/${id}`);
    return response.data.data;
  },

  async createPurchaseInvoice(data) {
    const response = await apiClient.post('/purchase-invoices', data);
    return response.data.data;
  },

  async updatePurchaseInvoice(id, data) {
    const response = await apiClient.put(`/purchase-invoices/${id}`, data);
    return response.data.data;
  },

  async deletePurchaseInvoice(id) {
    await apiClient.delete(`/purchase-invoices/${id}`);
  },

  async confirmPurchaseInvoice(id) {
    const response = await apiClient.post(`/purchase-invoices/${id}/confirm`);
    return response.data.data;
  },

  async payPurchaseInvoice(id, amount = 0) {
    const response = await apiClient.post(`/purchase-invoices/${id}/pay`, { amount });
    return response.data.data;
  },
};

export default financeService;
