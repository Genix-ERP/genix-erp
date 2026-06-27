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

  // Bank Reconciliation
  async listBankReconciliations(bankAccountId) {
    const response = await apiClient.get(`/bank-accounts/${bankAccountId}/reconciliations`);
    return response.data.data;
  },

  async createBankReconciliation(bankAccountId, data) {
    const response = await apiClient.post(`/bank-accounts/${bankAccountId}/reconciliations`, data);
    return response.data.data;
  },

  async getBankReconciliation(bankAccountId, reconciliationId) {
    const response = await apiClient.get(`/bank-accounts/${bankAccountId}/reconciliations/${reconciliationId}`);
    return response.data.data;
  },

  async updateBankReconciliation(bankAccountId, reconciliationId, data) {
    const response = await apiClient.put(`/bank-accounts/${bankAccountId}/reconciliations/${reconciliationId}`, data);
    return response.data.data;
  },

  async completeBankReconciliation(bankAccountId, reconciliationId) {
    const response = await apiClient.post(`/bank-accounts/${bankAccountId}/reconciliations/${reconciliationId}/complete`);
    return response.data.data;
  },

  async deleteBankReconciliation(bankAccountId, reconciliationId) {
    await apiClient.delete(`/bank-accounts/${bankAccountId}/reconciliations/${reconciliationId}`);
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

  async getNextAccountCode(accountTypeId) {
    const response = await apiClient.get(`/accounts/next-code`, { params: { account_type_id: accountTypeId } });
    return response.data.data;
  },

  async getAccountTransactions(accountId, params = {}) {
    const response = await apiClient.get(`/accounts/${accountId}/transactions`, { params });
    return response.data.data;
  },

  // Journals (accounting journals like GEN, SAL, PUR, MISC)
  async listJournals() {
    const response = await apiClient.get('/journals');
    return response.data.data;
  },

  async listPaymentJournals() {
    const response = await apiClient.get('/journals/payment');
    return response.data.data;
  },

  async getJournal(id) {
    const response = await apiClient.get(`/journals/${id}`);
    return response.data.data;
  },

  async createJournal(data) {
    const response = await apiClient.post('/journals', data);
    return response.data.data;
  },

  async updateJournal(id, data) {
    const response = await apiClient.put(`/journals/${id}`, data);
    return response.data.data;
  },

  async deleteJournal(id) {
    const response = await apiClient.delete(`/journals/${id}`);
    return response.data;
  },

  // Payment Methods
  async listPaymentMethods() {
    const response = await apiClient.get('/payment-methods');
    return response.data.data;
  },

  async listJournalPaymentMethods(journalId) {
    const response = await apiClient.get(`/journals/${journalId}/payment-methods`);
    return response.data.data;
  },

  async addJournalPaymentMethod(journalId, data) {
    const response = await apiClient.post(`/journals/${journalId}/payment-methods`, data);
    return response.data.data;
  },

  async updateJournalPaymentMethod(journalId, pmId, data) {
    const response = await apiClient.put(`/journals/${journalId}/payment-methods/${pmId}`, data);
    return response.data.data;
  },

  async removeJournalPaymentMethod(journalId, pmId) {
    await apiClient.delete(`/journals/${journalId}/payment-methods/${pmId}`);
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

  async getJournalEntryAuditLogs(id) {
    const response = await apiClient.get(`/journal-entries/${id}/audit-logs`);
    return response.data.data;
  },

  async updateJournalEntry(id, data) {
    const response = await apiClient.put(`/journal-entries/${id}`, data);
    return response.data.data;
  },

  async deleteJournalEntry(id) {
    const response = await apiClient.delete(`/journal-entries/${id}`);
    return response.data.data;
  },

  async cancelJournalEntry(id) {
    const response = await apiClient.post(`/journal-entries/${id}/cancel`);
    return response.data.data;
  },

  async reverseJournalEntry(id, data = {}) {
    const response = await apiClient.post(`/journal-entries/${id}/reverse`, data);
    return response.data.data;
  },

  async resetJournalEntryToDraft(id) {
    const response = await apiClient.post(`/journal-entries/${id}/reset-to-draft`);
    return response.data.data;
  },

  // Valid correspondence counterpart accounts for a given account (шахматка).
  // Returns { in_matrix, account_ids }. Empty account_ids => no restriction.
  async getAccountCorrespondenceCounterparts(accountId) {
    const response = await apiClient.get('/account-correspondences/counterparts', { params: { account_id: accountId } });
    return response.data.data;
  },

  async lockFiscalPeriod(id) {
    const response = await apiClient.post(`/fiscal-periods/${id}/lock`);
    return response.data.data;
  },

  async unlockFiscalPeriod(id) {
    const response = await apiClient.post(`/fiscal-periods/${id}/unlock`);
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

  // Odoo-style: register a payment for a partner (no invoice picked).
  // data: { contact_id, amount, direction: 'customer'|'vendor', method, payment_date, notes }
  async registerPartnerPayment(data) {
    const response = await apiClient.post('/payments/register', data);
    return response.data.data;
  },

  async confirmPayment(id) {
    const response = await apiClient.post(`/payments/${id}/confirm`);
    return response.data.data;
  },

  // Odoo-style reconciliation
  // List each partner's invoiced/paid/due totals + unallocated credit.
  async getPartnerBalances(direction = 'customer') {
    const response = await apiClient.get('/payments/partner-balances', { params: { direction } });
    return response.data.data;
  },
  // One partner's open docs, available credit, and the payments behind it.
  async getPartnerLedger(contactId, direction = 'customer') {
    const response = await apiClient.get('/payments/partner-ledger', { params: { contact_id: contactId, direction } });
    return response.data.data;
  },
  // Apply a partner's unallocated payment credit to one of their open docs.
  // data: { contact_id, direction, document_id, amount }
  async reconcilePartnerCredit(data) {
    const response = await apiClient.post('/payments/reconcile', data);
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

  // ASQ per TT Buxgalteriya §6.1 — opening / turnover / closing breakdown
  async getTrialBalanceWithTurnover(params = {}) {
    const response = await apiClient.get('/reports/trial-balance/turnover', { params });
    return response.data.data;
  },

  // Streams an .xlsx file. Returns a Blob for the caller to trigger download.
  async exportTrialBalanceExcel(params = {}) {
    const response = await apiClient.get('/reports/trial-balance/excel', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  async getGeneralLedger(params = {}) {
    const response = await apiClient.get('/reports/general-ledger', { params });
    return response.data.data;
  },

  // Bosh kitob per TT Buxgalteriya §6.2 — monthly turnovers for a year
  async getGeneralLedgerMonthly(params = {}) {
    const response = await apiClient.get('/reports/general-ledger/monthly', { params });
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

  async getAccountCard(params = {}) {
    const response = await apiClient.get('/reports/account-card', { params });
    return response.data.data;
  },

  // BHMS №21 regulated reports (TT §6.4)
  async getForma1(params = {}) {
    const response = await apiClient.get('/reports/forma-1', { params });
    return response.data.data;
  },
  async getForma2(params = {}) {
    const response = await apiClient.get('/reports/forma-2', { params });
    return response.data.data;
  },
  async getForma3(params = {}) {
    const response = await apiClient.get('/reports/forma-3', { params });
    return response.data.data;
  },
  async exportFormasExcel(params = {}) {
    const response = await apiClient.get('/reports/formas/excel', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // Period Close (TT §4.3)
  async closePeriod(data) {
    const response = await apiClient.post('/period-close/run', data);
    return response.data.data;
  },
  async listPeriodClosings() {
    const response = await apiClient.get('/period-close');
    return response.data.data;
  },
  async getPeriodClosing(id) {
    const response = await apiClient.get(`/period-close/${id}`);
    return response.data.data;
  },
  async reopenPeriod(id, reason) {
    const response = await apiClient.post(`/period-close/${id}/reopen`, { reason });
    return response.data.data;
  },

  // Bank Statement Import (TT §8.1)
  async importBankStatement(file) {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post('/bank-statement-imports', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
  async listBankStatementImports() {
    const response = await apiClient.get('/bank-statement-imports');
    return response.data.data;
  },

  // Bank vipiska (Excel) import — parse + auto-classify + review (Phase 1)
  async importBankVipiska(file) {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post('/bank-statement-imports/vipiska', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
  async getBankVipiskaTransactions(importId) {
    const response = await apiClient.get(`/bank-statement-imports/${importId}/transactions`);
    return response.data.data;
  },

  // E-invoices (TT §8.2)
  async ingestEInvoice(payload) {
    const response = await apiClient.post('/einvoices/ingest', payload);
    return response.data.data;
  },
  async listEInvoices(params = {}) {
    const response = await apiClient.get('/einvoices', { params });
    return response.data.data;
  },
  async approveEInvoice(id, links = {}) {
    const response = await apiClient.post(`/einvoices/${id}/approve`, links);
    return response.data.data;
  },
  async rejectEInvoice(id, reason) {
    const response = await apiClient.post(`/einvoices/${id}/reject`, { reason });
    return response.data.data;
  },

  // Expense Categories — CRUD. The list endpoint surfaces account_id +
  // account_code + account_name + usage_count so the Settings UI can show
  // "Travel → 9410 Operating Expense (5 expenses)" without a second
  // roundtrip. Mutations return the same enriched shape so the local list
  // can splice in updates without a refetch.
  async listExpenseCategories(params = {}) {
    const response = await apiClient.get('/expense-categories', { params });
    return response.data.data;
  },

  async createExpenseCategory(data) {
    const response = await apiClient.post('/expense-categories', data);
    return response.data.data;
  },

  async updateExpenseCategory(id, data) {
    const response = await apiClient.put(`/expense-categories/${id}`, data);
    return response.data.data;
  },

  async deleteExpenseCategory(id) {
    await apiClient.delete(`/expense-categories/${id}`);
  },

  // Expenses
  // Accepts any of: status, category_id, employee_id, is_recognized (bool),
  // date_from / date_to (YYYY-MM-DD), page, limit. Passed through axios
  // params so snake_case keys survive on the wire.
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

  // Toggle an expense's profit-tax recognition flag (PATCH
  // /expenses/:id/recognize). See §7.2 of ТЗ_Ish_Haqi_Soliq_Tolik.docx —
  // dedicated endpoint so UI can fire a small request on each row click
  // without sending the full update payload.
  async recognizeExpense(id, isRecognized) {
    const response = await apiClient.patch(`/expenses/${id}/recognize`, {
      is_recognized: Boolean(isRecognized),
    });
    return response.data.data;
  },

  // ────────────── Profit-tax calculation ──────────────
  // Live re-compute for a period. `income` is passed as a manual override
  // until the revenue ledger is wired up; omit it to get a tax-base that
  // reflects only expenses.
  async getProfitTax({ periodType = 'month', periodKey, income, rate } = {}) {
    const params = { period_type: periodType };
    if (periodKey) params.period_key = periodKey;
    if (income !== undefined && income !== null && income !== '') params.income = income;
    if (rate !== undefined && rate !== null && rate !== '') params.rate = rate;
    const response = await apiClient.get('/profit-tax', { params });
    return response.data.data;
  },

  // Pull a period's revenue straight from the general ledger — sum of
  // credits net of debits on revenue-category accounts for posted
  // journal entries. Used by the "Pull from ledger" button on the Profit
  // Tax page so accountants don't have to type the number by hand.
  async getProfitTaxRevenue({ periodType = 'month', periodKey } = {}) {
    const params = { period_type: periodType };
    if (periodKey) params.period_key = periodKey;
    const response = await apiClient.get('/profit-tax/revenue', { params });
    return response.data.data;
  },

  // Freeze the current computed numbers into profit_tax_calc.
  async snapshotProfitTax({ periodType, periodKey, income, rate, notes } = {}) {
    const body = { period_type: periodType, period_key: periodKey };
    if (income !== undefined) body.income = income;
    if (rate !== undefined && rate !== null && rate !== '') body.rate = rate;
    if (notes) body.notes = notes;
    const response = await apiClient.post('/profit-tax/snapshot', body);
    return response.data.data;
  },

  // Listing for the snapshots tab / audit view.
  async listProfitTaxSnapshots({ year } = {}) {
    const params = {};
    if (year) params.year = year;
    const response = await apiClient.get('/profit-tax/snapshots', { params });
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

  async recordMaintenance(assetId, data) {
    const response = await apiClient.post(`/fixed-assets/${assetId}/maintenance`, data);
    return response.data.data;
  },

  async listMaintenance(assetId) {
    const response = await apiClient.get(`/fixed-assets/${assetId}/maintenance`);
    return response.data.data;
  },

  async recordAssetPayment(assetId, data) {
    const response = await apiClient.post(`/fixed-assets/${assetId}/payments`, data);
    return response.data.data;
  },

  async listAssetPayments(assetId) {
    const response = await apiClient.get(`/fixed-assets/${assetId}/payments`);
    return response.data.data;
  },

  async createAssetCategory(data) {
    const response = await apiClient.post('/asset-categories', data);
    return response.data.data;
  },

  async updateAssetCategory(id, data) {
    const response = await apiClient.put(`/asset-categories/${id}`, data);
    return response.data.data;
  },

  async deleteAssetCategory(id) {
    const response = await apiClient.delete(`/asset-categories/${id}`);
    return response.data.data;
  },

  async getAssetDashboard() {
    const response = await apiClient.get('/fixed-assets/dashboard');
    return response.data.data;
  },

  // Purchase Invoices (Vendor Bills)
  async listPurchaseInvoices(params = {}) {
    const response = await apiClient.get('/purchase-invoices', { params });
    return response.data;
  },

  async getPurchaseInvoiceStats() {
    const response = await apiClient.get('/purchase-invoices/stats');
    return response.data.data;
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

  async resetPurchaseInvoiceToDraft(id) {
    const response = await apiClient.post(`/purchase-invoices/${id}/reset-to-draft`);
    return response.data.data;
  },

  async payPurchaseInvoice(id, amount = 0, paymentMethod = 'bank') {
    const response = await apiClient.post(`/purchase-invoices/${id}/pay`, { amount, payment_method: paymentMethod });
    return response.data.data;
  },

  async postPurchaseInvoice(id) {
    const response = await apiClient.post(`/purchase-invoices/${id}/post`);
    return response.data.data;
  },

  async createDebitNote(invoiceId, data) {
    const response = await apiClient.post(`/purchase-invoices/${invoiceId}/debit-note`, data);
    return response.data.data;
  },

  async confirmDebitNote(debitNoteId) {
    const response = await apiClient.post(`/purchase-invoices/${debitNoteId}/confirm-debit-note`);
    return response.data.data;
  },

  // Fiscal Years
  async listFiscalYears(params = {}) {
    const response = await apiClient.get('/fiscal-years', { params });
    return response.data.data;
  },

  async getFiscalYear(id) {
    const response = await apiClient.get(`/fiscal-years/${id}`);
    return response.data.data;
  },

  async createFiscalYear(data) {
    const response = await apiClient.post('/fiscal-years', data);
    return response.data.data;
  },

  async updateFiscalYear(id, data) {
    const response = await apiClient.put(`/fiscal-years/${id}`, data);
    return response.data.data;
  },

  async closeFiscalYear(id) {
    const response = await apiClient.post(`/fiscal-years/${id}/close`);
    return response.data.data;
  },

  async deleteFiscalYear(id) {
    await apiClient.delete(`/fiscal-years/${id}`);
  },

  // Fiscal Periods
  async listFiscalPeriods(params = {}) {
    const response = await apiClient.get('/fiscal-periods', { params });
    return response.data.data;
  },

  async getFiscalPeriod(id) {
    const response = await apiClient.get(`/fiscal-periods/${id}`);
    return response.data.data;
  },

  async createFiscalPeriod(data) {
    const response = await apiClient.post('/fiscal-periods', data);
    return response.data.data;
  },

  async createFiscalPeriods(periods) {
    const response = await apiClient.post('/fiscal-periods/batch', { periods });
    return response.data.data;
  },

  async closeFiscalPeriod(id) {
    const response = await apiClient.post(`/fiscal-periods/${id}/close`);
    return response.data.data;
  },

  async reopenFiscalPeriod(id) {
    const response = await apiClient.post(`/fiscal-periods/${id}/reopen`);
    return response.data.data;
  },

  // Budgets
  async listBudgets(params = {}) {
    const response = await apiClient.get('/budgets', { params });
    return response.data.data;
  },

  async getBudget(id) {
    const response = await apiClient.get(`/budgets/${id}`);
    return response.data.data;
  },

  async createBudget(data) {
    const response = await apiClient.post('/budgets', data);
    return response.data.data;
  },

  async updateBudget(id, data) {
    const response = await apiClient.put(`/budgets/${id}`, data);
    return response.data.data;
  },

  async deleteBudget(id) {
    await apiClient.delete(`/budgets/${id}`);
  },

  async activateBudget(id) {
    const response = await apiClient.post(`/budgets/${id}/activate`);
    return response.data.data;
  },

  // Budget Lines
  async listBudgetLines(params = {}) {
    const response = await apiClient.get('/budget-lines', { params });
    return response.data.data;
  },

  async createBudgetLine(data) {
    const response = await apiClient.post('/budget-lines', data);
    return response.data.data;
  },

  async updateBudgetLine(id, data) {
    const response = await apiClient.put(`/budget-lines/${id}`, data);
    return response.data.data;
  },

  async deleteBudgetLine(id) {
    await apiClient.delete(`/budget-lines/${id}`);
  },

  // Recurring Journal Entries
  async listRecurringJournals(params = {}) {
    const response = await apiClient.get('/recurring-journals', { params });
    return response.data.data;
  },

  async getRecurringJournal(id) {
    const response = await apiClient.get(`/recurring-journals/${id}`);
    return response.data.data;
  },

  async createRecurringJournal(data) {
    const response = await apiClient.post('/recurring-journals', data);
    return response.data.data;
  },

  async updateRecurringJournal(id, data) {
    const response = await apiClient.put(`/recurring-journals/${id}`, data);
    return response.data.data;
  },

  async deleteRecurringJournal(id) {
    await apiClient.delete(`/recurring-journals/${id}`);
  },

  async generateRecurringEntry(id) {
    const response = await apiClient.post(`/recurring-journals/${id}/generate`);
    return response.data.data;
  },

  async getPendingRecurringEntries() {
    const response = await apiClient.get('/recurring-journals/pending');
    return response.data.data;
  },

  // ========== Cash Registers (Kassa) ==========
  async listCashRegisters(params = {}) {
    const response = await apiClient.get('/cash/registers', { params });
    return response.data.data;
  },

  async createCashRegister(data) {
    const response = await apiClient.post('/cash/registers', data);
    return response.data.data;
  },

  async updateCashRegister(id, data) {
    const response = await apiClient.put(`/cash/registers/${id}`, data);
    return response.data.data;
  },

  // ========== Cash Orders (PKO/RKO) ==========
  async listCashOrders(params = {}) {
    const response = await apiClient.get('/cash/orders', { params });
    return response.data.data;
  },

  async getCashOrder(id) {
    const response = await apiClient.get(`/cash/orders/${id}`);
    return response.data.data;
  },

  async createCashOrder(data) {
    const response = await apiClient.post('/cash/orders', data);
    return response.data.data;
  },

  async updateCashOrder(id, data) {
    const response = await apiClient.put(`/cash/orders/${id}`, data);
    return response.data.data;
  },

  async confirmCashOrder(id) {
    const response = await apiClient.post(`/cash/orders/${id}/confirm`);
    return response.data.data;
  },

  // ========== Cash Book (Kassa kitob) ==========
  async getCashBook(params = {}) {
    const response = await apiClient.get('/cash/book', { params });
    return response.data.data;
  },

  // ========== Currency Rate Sync & Revaluation ==========
  async syncExchangeRates(data = {}) {
    const response = await apiClient.post('/currency/rates/sync', data);
    return response.data.data;
  },

  async revalueCurrency(data) {
    const response = await apiClient.post('/currency/revalue', data);
    return response.data.data;
  },

  async listExchangeDiffs(params = {}) {
    const response = await apiClient.get('/currency/rates', { params });
    return response.data.data;
  },

  async getCurrencyDebtReport() {
    const response = await apiClient.get('/currency/debt-report');
    return response.data.data;
  },

  // ========== Reconciliation Acts (Akt sverka) ==========
  async listReconciliationActs(params = {}) {
    const response = await apiClient.get('/reconciliation', { params });
    return response.data.data;
  },

  async getReconciliationAct(id) {
    const response = await apiClient.get(`/reconciliation/${id}`);
    return response.data.data;
  },

  async createReconciliationAct(data) {
    const response = await apiClient.post('/reconciliation', data);
    return response.data.data;
  },

  async updateReconciliationAct(id, data) {
    const response = await apiClient.put(`/reconciliation/${id}`, data);
    return response.data.data;
  },

  async deleteReconciliationAct(id) {
    await apiClient.delete(`/reconciliation/${id}`);
  },

  async bulkGenerateReconciliation(data) {
    const response = await apiClient.post('/reconciliation/bulk-generate', data);
    return response.data.data;
  },

  async refreshReconciliationAct(id) {
    const response = await apiClient.post(`/reconciliation/${id}/refresh`);
    return response.data.data;
  },

  async exportReconciliationAct(id, format = 'pdf') {
    const response = await apiClient.get(`/reconciliation/${id}/export`, { params: { format } });
    return response.data.data;
  },

  async sendReconciliationAct(id, data) {
    const response = await apiClient.post(`/reconciliation/${id}/send`, data);
    return response.data.data;
  },

  async sendReconciliationReminder(id) {
    const response = await apiClient.post(`/reconciliation/${id}/remind`);
    return response.data.data;
  },

  // ========== Budget Consolidated ==========
  async getBudgetConsolidated(params = {}) {
    const response = await apiClient.get('/budget/consolidated', { params });
    return response.data.data;
  },

  // ========== Budget Cash Flow (BDDS) ==========
  async getBudgetCashFlow() {
    const response = await apiClient.get('/budget/cash-flow');
    return response.data.data;
  },

  // ========== Budget Plan vs Actual ==========
  async getBudgetPlanVsActual(budgetId, groupBy = 'category') {
    const response = await apiClient.get('/budget/plan-vs-actual', {
      params: { budget_id: budgetId, group_by: groupBy }
    });
    return response.data.data;
  },

  // ========== Budget Approval Workflow ==========
  async submitBudgetForApproval(id) {
    const response = await apiClient.post(`/budget/${id}/submit`);
    return response.data;
  },

  async approveBudget(id) {
    const response = await apiClient.post(`/budget/${id}/approve`);
    return response.data;
  },

  async rejectBudget(id, reason) {
    const response = await apiClient.post(`/budget/${id}/reject`, { reason });
    return response.data;
  },

  // ========== Accounting Periods ==========
  async listAccountingPeriods() {
    const response = await apiClient.get('/accounting-periods');
    return response.data.data;
  },

  async createAccountingPeriod(data) {
    const response = await apiClient.post('/accounting-periods', data);
    return response.data.data;
  },

  async lockAccountingPeriod(id) {
    const response = await apiClient.post(`/accounting-periods/${id}/lock`);
    return response.data.data;
  },

  async unlockAccountingPeriod(id) {
    const response = await apiClient.post(`/accounting-periods/${id}/unlock`);
    return response.data.data;
  },

  async autoCreatePeriods(year) {
    const response = await apiClient.post('/accounting-periods/auto-create', { year });
    return response.data.data;
  },
};

export default financeService;
