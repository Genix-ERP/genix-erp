import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { financeService, salesService } from '@/api/services';
import { useCompany } from './CompanyContext';
import { useEmployeePermissions } from './EmployeePermissionsContext';
import { isDemoMode, checkBackendHealth, API_BASE_URL } from '@/config/dataMode';
import { useAdminSettings } from './AdminSettingsContext';
import { toast } from 'sonner';

const JOURNAL_ENTRIES_KEY = 'genix_journal_entries';
const JOURNAL_LINES_KEY = 'genix_journal_lines';
const VENDOR_BILLS_KEY = 'genix_vendor_bills';
const CUSTOMER_INVOICES_KEY = 'genix_customer_invoices';
const FINANCIAL_TRANSACTIONS_KEY = 'genix_financial_transactions';
const ACCOUNTS_KEY = 'genix_accounts';
const PAYMENTS_KEY = 'genix_payments';
const TAX_RATES_KEY = 'genix_tax_rates';
const BANK_ACCOUNTS_KEY = 'genix_bank_accounts';
const BANK_TRANSACTIONS_KEY = 'genix_bank_transactions';
const CASH_TRANSACTIONS_KEY = 'genix_cash_transactions';
const CURRENCIES_KEY = 'genix_currencies';
const EXCHANGE_RATES_KEY = 'genix_exchange_rates';
const FISCAL_YEARS_KEY = 'genix_fiscal_years';
const FISCAL_PERIODS_KEY = 'genix_fiscal_periods';
const BUDGETS_KEY = 'genix_budgets';
const BUDGET_LINES_KEY = 'genix_budget_lines';
const RECONCILIATION_ACTS_KEY = 'genix_reconciliation_acts';
const EXCHANGE_DIFFS_KEY = 'genix_exchange_diffs';

const FinancialsContext = createContext();

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return companyId ? `${prefix}${baseKey}_${companyId}` : `${prefix}${baseKey}`;
};

// Sample data for fallback mode
const sampleJournalEntries = [
  { id: 'je_1', journal_number: 'JE-2025-001', company_id: 'default', posting_date: new Date().toISOString().split('T')[0], description: 'Office supplies purchase', journal_type: 'manual', status: 'posted', total_debit: 1500, total_credit: 1500, currency: 'USD', created_date: new Date().toISOString() },
  { id: 'je_2', journal_number: 'JE-2025-002', company_id: 'default', posting_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], description: 'Monthly rent payment', journal_type: 'manual', status: 'posted', total_debit: 5000, total_credit: 5000, currency: 'USD', created_date: new Date().toISOString() }
];

const sampleJournalLines = [
  { id: 'jl_1', journal_entry_id: 'je_1', account_code: '6100', account_name: 'Office Supplies Expense', description: 'Printer paper', debit_amount: 1500, credit_amount: 0 },
  { id: 'jl_2', journal_entry_id: 'je_1', account_code: '1100', account_name: 'Cash', description: 'Cash payment', debit_amount: 0, credit_amount: 1500 }
];

const sampleVendorBills = [
  { id: 'vb_1', invoice_type: 'vendor_bill', invoice_number: 'BILL-2025-001', partner_id: 'Office Depot', invoice_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], due_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], total_amount: 2500, tax_amount: 250, subtotal: 2250, amount_due: 2500, amount_paid: 0, status: 'draft', created_date: new Date().toISOString() },
  { id: 'vb_2', invoice_type: 'vendor_bill', invoice_number: 'BILL-2025-002', partner_id: 'TechSupply Inc', invoice_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], total_amount: 15000, tax_amount: 1500, subtotal: 13500, amount_due: 15000, amount_paid: 0, status: 'confirmed', created_date: new Date().toISOString() }
];

const sampleCustomerInvoices = [
  { id: 'ci_1', invoice_type: 'customer_invoice', invoice_number: 'INV-2025-001', partner_id: 'Tech Solutions Inc', invoice_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], total_amount: 12500, tax_amount: 1250, subtotal: 11250, amount_due: 7500, amount_paid: 5000, status: 'sent', created_date: new Date().toISOString() },
  { id: 'ci_2', invoice_type: 'customer_invoice', invoice_number: 'INV-2025-002', partner_id: 'Global Industries', invoice_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], due_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], total_amount: 8750, tax_amount: 875, subtotal: 7875, amount_due: 8750, amount_paid: 0, status: 'sent', created_date: new Date().toISOString() }
];

const sampleFinancialTransactions = [
  { id: 'ft_1', transaction_type: 'income', amount: 12500, category: 'sales', description: 'Tech Solutions Inc payment', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_2', transaction_type: 'income', amount: 8750, category: 'sales', description: 'Global Industries invoice', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_3', transaction_type: 'expense', amount: 5000, category: 'rent', description: 'Monthly office rent', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_4', transaction_type: 'expense', amount: 15000, category: 'equipment', description: 'Computer equipment', date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_5', transaction_type: 'expense', amount: 2500, category: 'operations', description: 'Office supplies', date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }
];

const sampleAccounts = [
  { id: 'acc_1', code: '1000', name: 'Cash and Cash Equivalents', type: 'asset', internal_type: 'asset_cash', parent_id: null, currency: 'UZS', allow_reconciliation: true, deprecated: false, balance: 50000, is_active: true },
  { id: 'acc_2', code: '1100', name: 'Cash on Hand', type: 'asset', internal_type: 'asset_cash', parent_id: 'acc_1', currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 5000, is_active: true },
  { id: 'acc_3', code: '1200', name: 'Bank Accounts', type: 'asset', internal_type: 'asset_cash', parent_id: 'acc_1', currency: 'UZS', allow_reconciliation: true, deprecated: false, balance: 45000, is_active: true },
  { id: 'acc_4', code: '1300', name: 'Accounts Receivable', type: 'asset', internal_type: 'asset_receivable', parent_id: null, currency: 'UZS', allow_reconciliation: true, deprecated: false, balance: 25000, is_active: true },
  { id: 'acc_5', code: '2000', name: 'Current Liabilities', type: 'liability', internal_type: 'liability_current', parent_id: null, currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 15000, is_active: true },
  { id: 'acc_6', code: '2100', name: 'Accounts Payable', type: 'liability', internal_type: 'liability_payable', parent_id: 'acc_5', currency: 'UZS', allow_reconciliation: true, deprecated: false, balance: 10000, is_active: true },
  { id: 'acc_7', code: '2200', name: 'Taxes Payable', type: 'liability', internal_type: 'liability_current', parent_id: 'acc_5', currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 5000, is_active: true },
  { id: 'acc_8', code: '3000', name: 'Equity', type: 'equity', internal_type: 'equity', parent_id: null, currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 100000, is_active: true },
  { id: 'acc_9', code: '4000', name: 'Revenue', type: 'revenue', internal_type: 'income', parent_id: null, currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 75000, is_active: true },
  { id: 'acc_10', code: '5000', name: 'Expenses', type: 'expense', internal_type: 'expense', parent_id: null, currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 35000, is_active: true },
  { id: 'acc_11', code: '5100', name: 'Salaries Expense', type: 'expense', internal_type: 'expense', parent_id: 'acc_10', currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 20000, is_active: true },
  { id: 'acc_12', code: '5200', name: 'Rent Expense', type: 'expense', internal_type: 'expense', parent_id: 'acc_10', currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 10000, is_active: true },
  { id: 'acc_13', code: '5300', name: 'Utilities Expense', type: 'expense', internal_type: 'expense', parent_id: 'acc_10', currency: 'UZS', allow_reconciliation: false, deprecated: false, balance: 5000, is_active: true },
];

const samplePayments = [
  { id: 'pay_1', payment_number: 'PAY-2025-001', payment_type: 'outbound', partner_name: 'Office Depot', amount: 2500, payment_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], payment_method: 'bank_transfer', status: 'confirmed', reference: 'BILL-2025-001' },
  { id: 'pay_2', payment_number: 'PAY-2025-002', payment_type: 'inbound', partner_name: 'Tech Solutions Inc', amount: 5000, payment_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], payment_method: 'bank_transfer', status: 'confirmed', reference: 'INV-2025-001' },
  { id: 'pay_3', payment_number: 'PAY-2025-003', payment_type: 'outbound', partner_name: 'TechSupply Inc', amount: 15000, payment_date: new Date().toISOString().split('T')[0], payment_method: 'check', status: 'draft', reference: 'BILL-2025-002' },
];

const sampleTaxRates = [
  { id: 'tax_1', code: 'VAT12', name: 'VAT 12%', rate: 12, type: 'vat', is_default: true, is_active: true },
  { id: 'tax_2', code: 'VAT0', name: 'VAT 0% (Exempt)', rate: 0, type: 'vat', is_default: false, is_active: true },
  { id: 'tax_3', code: 'SALES', name: 'Sales Tax', rate: 10, type: 'sales', is_default: false, is_active: true },
];

const sampleBankAccounts = [
  { id: 'ba_1', name: 'Main Operating Account', bank_name: 'National Bank of Uzbekistan', account_number: '20208000123456789012', currency: 'UZS', account_type: 'checking', balance: 150000000, is_active: true, last_reconciled: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  { id: 'ba_2', name: 'USD Account', bank_name: 'Asaka Bank', account_number: '20208840987654321098', currency: 'USD', account_type: 'checking', balance: 25000, is_active: true, last_reconciled: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  { id: 'ba_3', name: 'Savings Account', bank_name: 'Ipoteka Bank', account_number: '22618000111222333444', currency: 'UZS', account_type: 'savings', balance: 500000000, is_active: true, last_reconciled: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
];

const sampleBankTransactions = [
  { id: 'bt_1', bank_account_id: 'ba_1', transaction_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], description: 'Customer payment - Tech Solutions', amount: 15000000, type: 'credit', reference: 'TRF-001', is_reconciled: true, reconciled_date: new Date().toISOString().split('T')[0] },
  { id: 'bt_2', bank_account_id: 'ba_1', transaction_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], description: 'Supplier payment - Office Depot', amount: 5000000, type: 'debit', reference: 'TRF-002', is_reconciled: true, reconciled_date: new Date().toISOString().split('T')[0] },
  { id: 'bt_3', bank_account_id: 'ba_1', transaction_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], description: 'Monthly rent payment', amount: 8000000, type: 'debit', reference: 'TRF-003', is_reconciled: false },
  { id: 'bt_4', bank_account_id: 'ba_1', transaction_date: new Date().toISOString().split('T')[0], description: 'Unknown transfer', amount: 2500000, type: 'credit', reference: 'TRF-004', is_reconciled: false },
  { id: 'bt_5', bank_account_id: 'ba_2', transaction_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], description: 'Export payment received', amount: 5000, type: 'credit', reference: 'SWIFT-001', is_reconciled: true, reconciled_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
];

const sampleCashTransactions = [
  { id: 'ct_1', transaction_date: new Date().toISOString().split('T')[0], type: 'income', amount: 500000, currency: 'UZS', description: 'Cash sale - Walk-in customer', category: 'sales', reference: 'CASH-001', cashier: 'Aziz Karimov' },
  { id: 'ct_2', transaction_date: new Date().toISOString().split('T')[0], type: 'expense', amount: 150000, currency: 'UZS', description: 'Office supplies', category: 'office', reference: 'CASH-002', cashier: 'Aziz Karimov' },
  { id: 'ct_3', transaction_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], type: 'income', amount: 1200000, currency: 'UZS', description: 'Service payment', category: 'services', reference: 'CASH-003', cashier: 'Dilnoza Rahimova' },
  { id: 'ct_4', transaction_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], type: 'expense', amount: 80000, currency: 'UZS', description: 'Transportation', category: 'transport', reference: 'CASH-004', cashier: 'Aziz Karimov' },
  { id: 'ct_5', transaction_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], type: 'transfer', amount: 5000000, currency: 'UZS', description: 'Bank deposit', category: 'transfer', reference: 'CASH-005', cashier: 'Dilnoza Rahimova' },
];

const sampleCurrencies = [
  { code: 'UZS', name: 'Uzbek Som', symbol: "so'm", is_base: true, is_active: true, decimal_places: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', is_base: false, is_active: true, decimal_places: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', is_base: false, is_active: true, decimal_places: 2 },
];

const sampleExchangeRates = [
  { id: 'er_1', from_currency: 'USD', to_currency: 'UZS', rate: 12650, date: new Date().toISOString().split('T')[0], source: 'CBU' },
  { id: 'er_2', from_currency: 'RUB', to_currency: 'UZS', rate: 135, date: new Date().toISOString().split('T')[0], source: 'CBU' },
  { id: 'er_3', from_currency: 'USD', to_currency: 'UZS', rate: 12600, date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], source: 'CBU' },
];

const sampleFiscalYears = [
  { id: 'fy_1', code: 'FY2025', name: 'Fiscal Year 2025', start_date: '2025-01-01', end_date: '2025-12-31', status: 'open', created_at: new Date().toISOString() },
  { id: 'fy_2', code: 'FY2024', name: 'Fiscal Year 2024', start_date: '2024-01-01', end_date: '2024-12-31', status: 'closed', created_at: new Date().toISOString() },
];

const sampleFiscalPeriods = [
  { id: 'fp_1', fiscal_year_id: 'fy_1', code: 'FY2025-P01', name: 'January 2025', period_number: 1, start_date: '2025-01-01', end_date: '2025-01-31', status: 'closed' },
  { id: 'fp_2', fiscal_year_id: 'fy_1', code: 'FY2025-P02', name: 'February 2025', period_number: 2, start_date: '2025-02-01', end_date: '2025-02-28', status: 'open' },
  { id: 'fp_3', fiscal_year_id: 'fy_1', code: 'FY2025-P03', name: 'March 2025', period_number: 3, start_date: '2025-03-01', end_date: '2025-03-31', status: 'open' },
];

const sampleBudgets = [
  { id: 'bud_1', code: 'BUD-2025-EXP', name: 'Operating Expenses 2025', budget_type: 'expense', start_date: '2025-01-01', end_date: '2025-12-31', total_amount: 500000000, status: 'active', description: 'Annual operating expense budget', created_at: new Date().toISOString() },
  { id: 'bud_2', code: 'BUD-2025-REV', name: 'Revenue Budget 2025', budget_type: 'revenue', start_date: '2025-01-01', end_date: '2025-12-31', total_amount: 1000000000, status: 'active', description: 'Annual revenue target', created_at: new Date().toISOString() },
];

const sampleBudgetLines = [
  { id: 'bl_1', budget_id: 'bud_1', account_id: 'acc_11', planned_amount: 200000000, actual_amount: 45000000, notes: 'Monthly salaries' },
  { id: 'bl_2', budget_id: 'bud_1', account_id: 'acc_12', planned_amount: 100000000, actual_amount: 20000000, notes: 'Office rent' },
  { id: 'bl_3', budget_id: 'bud_1', account_id: 'acc_13', planned_amount: 50000000, actual_amount: 8000000, notes: 'Utilities' },
];

// Cash registers/orders intentionally have NO sample data and NO localStorage
// fallback: kassa documents are ledger-backed documents — if the API fails they
// must fail loudly instead of becoming browser-only ghosts (see 2026-08-10
// cash-truth audit: PKO-2026-13647 existed only in localStorage).

const sampleReconciliationActs = [
  { id: 'ra_1', partner_id: 'c_1', partner_name: 'Tech Solutions LLC', period_start: '2026-01-01', period_end: '2026-03-31', opening_balance: 5000000, our_debit_total: 15000000, our_credit_total: 8500000, our_balance: 11500000, partner_debit_total: 8500000, partner_credit_total: 15000000, partner_balance: 11500000, difference: 0, status: 'confirmed', created_at: new Date().toISOString() },
  { id: 'ra_2', partner_id: 'c_2', partner_name: 'Global Industries', period_start: '2026-01-01', period_end: '2026-03-31', opening_balance: 0, our_debit_total: 25000000, our_credit_total: 20000000, our_balance: 5000000, partner_debit_total: 20000000, partner_credit_total: 24500000, partner_balance: 4500000, difference: 500000, status: 'disputed', created_at: new Date().toISOString() },
  { id: 'ra_3', partner_id: 'c_3', partner_name: 'Qurilish Materials', period_start: '2026-01-01', period_end: '2026-03-31', opening_balance: 3000000, our_debit_total: 8000000, our_credit_total: 10000000, our_balance: 1000000, partner_debit_total: 10000000, partner_credit_total: 8000000, partner_balance: 1000000, difference: 0, status: 'draft', created_at: new Date().toISOString() },
];

const sampleExchangeDiffs = [
  { id: 'ed_1', currency_code: 'USD', amount_uzs: 3500000, diff_type: 'positive', period_start: '2026-01-01', period_end: '2026-01-31', description: 'USD kurs farqi — Yanvar 2026' },
  { id: 'ed_2', currency_code: 'EUR', amount_uzs: -1200000, diff_type: 'negative', period_start: '2026-01-01', period_end: '2026-01-31', description: 'EUR kurs farqi — Yanvar 2026' },
];

export function FinancialsProvider({ children }) {
  const { activeCompany } = useCompany();
  const { getSetting } = useAdminSettings();
  const { canAccessModule, isAdmin } = useEmployeePermissions();
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLines, setJournalLines] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [financialTransactions, setFinancialTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [journals, setJournals] = useState([]);
  const [paymentJournals, setPaymentJournals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [cashTransactions, setCashTransactions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [fiscalPeriods, setFiscalPeriods] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [budgetLines, setBudgetLines] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);
  const [cashOrders, setCashOrders] = useState([]);
  // Ledger-derived cash position from GET /cash/balance — THE single cash
  // engine: { total, as_of, accounts: [{account_id, code, name, balance, kind}] }
  const [cashPosition, setCashPosition] = useState({
    total: 0, cash_total: 0, bank_total: 0, currency_total: 0, as_of: null, accounts: [],
  });
  const [reconciliationActs, setReconciliationActs] = useState([]);
  const [exchangeDiffs, setExchangeDiffs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

  // Admin settings for finance module - these affect module behavior
  const financeSettings = useMemo(() => ({
    // Fiscal year
    fiscalYearStartMonth: getSetting('finance.fiscal_year.start_month', 1),
    fiscalYearStartDay: getSetting('finance.fiscal_year.start_day', 1),

    // Accounts
    chartTemplate: getSetting('finance.accounts.chart_template', 'standard'),
    defaultSalesAccount: getSetting('finance.accounts.default_sales_account', null),
    defaultPurchaseAccount: getSetting('finance.accounts.default_purchase_account', null),
    defaultInventoryAccount: getSetting('finance.accounts.default_inventory_account', null),
    defaultReceivablesAccount: getSetting('finance.accounts.default_receivables_account', null),
    defaultPayablesAccount: getSetting('finance.accounts.default_payables_account', null),

    // Tax
    defaultSalesTax: getSetting('finance.tax.default_sales_tax', 12),
    defaultPurchaseTax: getSetting('finance.tax.default_purchase_tax', 12),
    taxRounding: getSetting('finance.tax.tax_rounding', 'line'),
    priceIncludesTax: getSetting('finance.tax.price_includes_tax', false),

    // Currency
    multiCurrencyEnabled: getSetting('finance.currency.multi_currency_enabled', false),
    exchangeRateSource: getSetting('finance.currency.exchange_rate_source', 'manual'),
    baseCurrency: getSetting('finance.currency.base_currency', 'UZS'),

    // Banking
    reconciliationTolerance: getSetting('finance.banking.reconciliation_tolerance', 0),
    autoMatchTransactions: getSetting('finance.banking.auto_match_transactions', true),

    // Journal
    autoPostEntries: getSetting('finance.journal.auto_post_entries', false),
    requireApproval: getSetting('finance.journal.require_approval', true)
  }), [getSetting]);

  const loadFromLocalStorage = useCallback(() => {
    const companyId = activeCompany?.id;
    const demoMode = isDemoMode();

    // Helper to get data - only use sample data in demo mode when localStorage is empty
    const getData = (key, sampleData) => {
      const stored = localStorage.getItem(getStorageKey(key, companyId));
      if (stored) return JSON.parse(stored);
      return demoMode ? sampleData : [];
    };

    setJournalEntries(getData(JOURNAL_ENTRIES_KEY, sampleJournalEntries));
    setJournalLines(getData(JOURNAL_LINES_KEY, sampleJournalLines));
    setVendorBills(getData(VENDOR_BILLS_KEY, sampleVendorBills));
    setCustomerInvoices(getData(CUSTOMER_INVOICES_KEY, sampleCustomerInvoices));
    setFinancialTransactions(getData(FINANCIAL_TRANSACTIONS_KEY, sampleFinancialTransactions));
    setAccounts(getData(ACCOUNTS_KEY, sampleAccounts));
    setPayments(getData(PAYMENTS_KEY, samplePayments));
    setTaxRates(getData(TAX_RATES_KEY, sampleTaxRates));
    setBankAccounts(getData(BANK_ACCOUNTS_KEY, sampleBankAccounts));
    setBankTransactions(getData(BANK_TRANSACTIONS_KEY, sampleBankTransactions));
    setCashTransactions(getData(CASH_TRANSACTIONS_KEY, sampleCashTransactions));
    setCurrencies(getData(CURRENCIES_KEY, sampleCurrencies));
    setExchangeRates(getData(EXCHANGE_RATES_KEY, sampleExchangeRates));
    // New ERP modules
    setFiscalYears(getData(FISCAL_YEARS_KEY, sampleFiscalYears));
    setFiscalPeriods(getData(FISCAL_PERIODS_KEY, sampleFiscalPeriods));
    setBudgets(getData(BUDGETS_KEY, sampleBudgets));
    setBudgetLines(getData(BUDGET_LINES_KEY, sampleBudgetLines));
    // Finance extra modules
    // Cash registers/orders: no localStorage fallback — server documents only.
    setCashRegisters([]);
    setCashOrders([]);
    setReconciliationActs(getData(RECONCILIATION_ACTS_KEY, sampleReconciliationActs));
    setExchangeDiffs(getData(EXCHANGE_DIFFS_KEY, sampleExchangeDiffs));

    // Only initialize localStorage with sample data in demo mode
    if (demoMode) {
      const initIfEmpty = (key, sampleData) => {
        const storageKey = getStorageKey(key, companyId);
        if (!localStorage.getItem(storageKey)) {
          localStorage.setItem(storageKey, JSON.stringify(sampleData));
        }
      };

      initIfEmpty(JOURNAL_ENTRIES_KEY, sampleJournalEntries);
      initIfEmpty(JOURNAL_LINES_KEY, sampleJournalLines);
      initIfEmpty(VENDOR_BILLS_KEY, sampleVendorBills);
      initIfEmpty(CUSTOMER_INVOICES_KEY, sampleCustomerInvoices);
      initIfEmpty(FINANCIAL_TRANSACTIONS_KEY, sampleFinancialTransactions);
      initIfEmpty(ACCOUNTS_KEY, sampleAccounts);
      initIfEmpty(PAYMENTS_KEY, samplePayments);
      initIfEmpty(TAX_RATES_KEY, sampleTaxRates);
      initIfEmpty(BANK_ACCOUNTS_KEY, sampleBankAccounts);
      initIfEmpty(BANK_TRANSACTIONS_KEY, sampleBankTransactions);
      initIfEmpty(CASH_TRANSACTIONS_KEY, sampleCashTransactions);
      initIfEmpty(CURRENCIES_KEY, sampleCurrencies);
      initIfEmpty(EXCHANGE_RATES_KEY, sampleExchangeRates);
      // New ERP modules
      initIfEmpty(FISCAL_YEARS_KEY, sampleFiscalYears);
      initIfEmpty(FISCAL_PERIODS_KEY, sampleFiscalPeriods);
      initIfEmpty(BUDGETS_KEY, sampleBudgets);
      initIfEmpty(BUDGET_LINES_KEY, sampleBudgetLines);
      // Finance extra modules
      initIfEmpty(RECONCILIATION_ACTS_KEY, sampleReconciliationActs);
      initIfEmpty(EXCHANGE_DIFFS_KEY, sampleExchangeDiffs);
    }
  }, [activeCompany]);

  const loadData = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    setError(null);
    try {
      const isAvailable = await checkBackendHealth();
      setBackendAvailable(isAvailable);
      if (isAvailable) {
        try {
          // Gate every backend call by the user's actual module permissions.
          // Without these gates, FinancialsContext fires ~22 list endpoints on
          // every page mount, and any user without finance/sales/purchase
          // access gets a wall of 403s in the console. Admins skip all gates.
          const allow = (m) => isAdmin || canAccessModule(m);
          const skip  = () => Promise.resolve([]);
          const skipP = () => Promise.resolve({ data: [] });
          const finance = allow('finance');
          const sales   = allow('sales');
          const purch   = allow('purchase');

          const [entries, invoicesResponse, accountsData, paymentsData, taxRatesData, accountTypesData, vendorBillsData, bankAccountsData, cashTransactionsData, currenciesData, exchangeRatesData, fiscalYearsData, fiscalPeriodsData, budgetsData, budgetLinesData, journalsData, cashRegistersData, cashOrdersData, reconciliationActsData, exchangeDiffsData, paymentJournalsData, cashBalanceData] = await Promise.all([
            finance ? financeService.listJournalEntries({ limit: 1000 }).catch(() => []) : skip(),
            sales   ? salesService.listInvoices().catch(() => [])                         : skip(),
            finance ? financeService.listAccounts({ organization_id: activeCompany.id, limit: 500 }).catch(() => []) : skip(),
            finance ? financeService.listPayments({ limit: 100 }).catch(() => [])         : skip(),
            finance ? financeService.listTaxRates().catch(() => [])                       : skip(),
            finance ? financeService.listAccountTypes().catch(() => [])                   : skip(),
            purch   ? financeService.listPurchaseInvoices().catch(() => ({ data: [] }))   : skipP(),
            finance ? financeService.listBankAccounts().catch(() => [])                   : skip(),
            finance ? financeService.listCashTransactions().catch(() => [])               : skip(),
            finance ? financeService.listCurrencies().catch(() => [])                     : skip(),
            finance ? financeService.listExchangeRates().catch(() => [])                  : skip(),
            finance ? financeService.listFiscalYears().catch(() => [])                    : skip(),
            finance ? financeService.listFiscalPeriods().catch(() => [])                  : skip(),
            finance ? financeService.listBudgets().catch(() => [])                        : skip(),
            finance ? financeService.listBudgetLines().catch(() => [])                    : skip(),
            finance ? financeService.listJournals().catch(() => [])                       : skip(),
            finance ? financeService.listCashRegisters().catch(() => [])                  : skip(),
            finance ? financeService.listCashOrders().catch(() => [])                     : skip(),
            // Akt sverka fetches its own page (ActSverka.jsx) and nothing else
            // reads reconciliationActs — verified with
            // `grep -rn reconciliationActs src/`. Fetching every act at app
            // boot was an unpaginated full-table read for no reader at all.
            // The slot stays because this Promise.all is destructured
            // positionally; only the request is gone.
            skip(),
            finance ? financeService.listExchangeDiffs().catch(() => [])                  : skip(),
            finance ? financeService.listPaymentJournals().catch(() => [])                : skip(),
            finance ? financeService.getCashBalance().catch(() => null)                   : Promise.resolve(null)
          ]);
          setJournalEntries(entries || []);
          // Handle paginated response - could be array directly or { items: [...] }
          const invoicesArray = Array.isArray(invoicesResponse) ? invoicesResponse : (invoicesResponse?.items || []);
          // Map backend invoice response to frontend format
          const mappedInvoices = invoicesArray.map(inv => ({
            ...inv,
            invoice_type: 'customer_invoice',
            total_amount: inv.total_amount || 0,
            amount_due: inv.amount_due ?? (inv.total_amount - (inv.amount_paid || 0)),
            amount_paid: inv.amount_paid || 0,
          }));
          setCustomerInvoices(mappedInvoices);
          setAccounts(accountsData || []);
          // Map backend payment response to frontend format
          const mappedPayments = (paymentsData || []).map(p => ({
            ...p,
            payment_type: p.type === 'receipt' ? 'inbound' : 'outbound',
            party_name: p.contact_name || '',
            payment_method: p.payment_method || (p.journal_name?.toLowerCase().includes('cash') ? 'cash' : 'bank_transfer'),
          }));
          setPayments(mappedPayments);
          setTaxRates(taxRatesData || []);
          setAccountTypes(accountTypesData || []);
          setJournals(journalsData || []);
          setPaymentJournals(paymentJournalsData || []);
          // Map backend vendor bills to frontend format
          const rawBills = Array.isArray(vendorBillsData?.data) ? vendorBillsData.data : Array.isArray(vendorBillsData) ? vendorBillsData : [];
          const mappedBills = rawBills.map(b => ({
            ...b,
            invoice_type: b.invoice_type || 'invoice',
            partner_id: b.vendor_id || b.partner_id,
            partner_name: b.vendor_name || b.partner_name || '',
          }));
          setVendorBills(mappedBills);
          // Set bank accounts from backend
          setBankAccounts(bankAccountsData || []);
          // Set cash transactions from backend
          setCashTransactions(cashTransactionsData || []);
          // Set currencies from backend
          setCurrencies(currenciesData || []);
          // Set exchange rates from backend
          setExchangeRates(exchangeRatesData || []);
          // Set fiscal years and periods from backend
          setFiscalYears(fiscalYearsData || []);
          setFiscalPeriods(fiscalPeriodsData || []);
          // Set budgets and budget lines from backend
          setBudgets(budgetsData || []);
          setBudgetLines(budgetLinesData || []);
          // Finance extra modules — cash registers/orders come from the API
          // only (no localStorage merge: ghost documents must not exist).
          setCashRegisters(Array.isArray(cashRegistersData) ? cashRegistersData : (cashRegistersData?.items || []));
          setCashOrders(Array.isArray(cashOrdersData) ? cashOrdersData : (cashOrdersData?.items || []));
          // Ledger-derived cash position (GET /cash/balance)
          setCashPosition(cashBalanceData && typeof cashBalanceData === 'object'
            ? { total: cashBalanceData.total || 0, as_of: cashBalanceData.as_of || null, accounts: cashBalanceData.accounts || [] }
            : { total: 0, as_of: null, accounts: [] });
          setReconciliationActs(reconciliationActsData || []);
          setExchangeDiffs(Array.isArray(exchangeDiffsData) ? exchangeDiffsData : []);

          // Derive financialTransactions from real payments for dashboard metrics
          const derivedTransactions = mappedPayments.map(p => ({
            id: p.id,
            transaction_type: p.payment_type === 'inbound' ? 'income' : 'expense',
            amount: p.amount || 0,
            category: p.payment_type === 'inbound' ? 'sales' : 'operations',
            description: p.memo || p.reference || p.payment_number || '',
            date: p.payment_date || p.created_at,
          }));
          setFinancialTransactions(derivedTransactions);
        } catch (apiError) {
          console.warn('API call failed, falling back to localStorage:', apiError);
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    } catch (err) {
      console.error('Error loading financial data:', err);
      setError(err.message);
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadFromLocalStorage, canAccessModule, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleCompanyChange = () => { loadData(); };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadData]);

  // ==================== ACCOUNTS CRUD ====================
  // Helper to map frontend type to backend account_type_id
  const getAccountTypeId = useCallback((type) => {
    // Account types from backend have a 'category' field: asset, liability, equity, revenue, expense, contra_asset
    // For contra_asset, also try matching by code 'CONTRA_ASSET'
    let matchingType = accountTypes.find(at => at.category === type);

    if (!matchingType && type === 'contra_asset') {
      matchingType = accountTypes.find(at => at.code === 'CONTRA_ASSET');
    }

    if (!matchingType) {
      console.warn('No matching account type found for category:', type, 'Available types:', accountTypes);
    }

    return matchingType?.id || null;
  }, [accountTypes]);

  const createAccount = useCallback(async (accountData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        // Map frontend fields to backend expected format
        const backendData = {
          code: accountData.code,
          name: accountData.name,
          description: accountData.description || '',
          account_type_id: getAccountTypeId(accountData.type),
          parent_id: accountData.parent_id || null,
          is_bank_account: accountData.is_bank_account || false,
          is_reconcilable: accountData.allow_reconciliation || false,
          is_control_account: false,
          budget_tracking: false,
          opening_balance: 0
        };

        if (!backendData.account_type_id) {
          console.warn('Could not map account type:', accountData.type);
          throw new Error('Invalid account type');
        }

        const newAccount = await financeService.createAccount(backendData);
        setAccounts(prev => [newAccount, ...prev]);
        return newAccount;
      } catch (err) { console.error('API error, falling back to local:', err); 
        toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
      }
    }
    const newAccount = { id: `acc_${Date.now()}`, ...accountData, balance: 0, is_active: true, created_at: new Date().toISOString() };
    const updated = [newAccount, ...accounts];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setAccounts(updated);
    return newAccount;
  }, [backendAvailable, accounts, activeCompany, getAccountTypeId]);

  const updateAccount = useCallback(async (id, accountData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        const updated = await financeService.updateAccount(id, accountData);
        setAccounts(prev => prev.map(acc => acc.id === id ? updated : acc));
        return updated;
      } catch (err) { console.error('API error:', err); 
        toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
      }
    }
    const updated = accounts.map(acc => acc.id === id ? { ...acc, ...accountData } : acc);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setAccounts(updated);
  }, [backendAvailable, accounts, activeCompany]);

  const deleteAccount = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        await financeService.deleteAccount(id);
        setAccounts(prev => prev.filter(acc => acc.id !== id));
        return;
      } catch (err) { console.error('API error:', err); 
        toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
      }
    }
    const updated = accounts.filter(acc => acc.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setAccounts(updated);
  }, [backendAvailable, accounts, activeCompany]);

  const getAccountTransactions = useCallback(async (accountId, params = {}) => {
    if (backendAvailable) {
      try { return await financeService.getAccountTransactions(accountId, params); }
      catch (err) { console.error('API error:', err); }
    }
    return [];
  }, [backendAvailable]);

  // ==================== PAYMENTS CRUD ====================
  const createPayment = useCallback(async (paymentData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(PAYMENTS_KEY, companyId);

    // Only call backend API if required fields are present (contact_id for backend)
    const hasBackendRequiredFields = paymentData.contact_id && paymentData.type && paymentData.payment_date;

    if (backendAvailable && hasBackendRequiredFields) {
      try {
        const apiPayment = await financeService.createPayment({
          type: paymentData.type,
          contact_id: paymentData.contact_id,
          payment_date: paymentData.payment_date,
          amount: paymentData.amount,
          reference: paymentData.reference || '',
          notes: paymentData.notes || paymentData.description || '',
          bank_account_id: paymentData.bank_account_id || undefined,
          journal_id: paymentData.journal_id || undefined,
          allocations: paymentData.allocations || undefined,
        });
        // Map backend response to frontend format for UI consistency
        const newPayment = {
          ...apiPayment,
          payment_type: apiPayment.type === 'receipt' ? 'inbound' : 'outbound',
          party_name: apiPayment.contact_name || paymentData.party_name || '',
          payment_method: paymentData.payment_method || 'bank_transfer',
        };
        setPayments(prev => [newPayment, ...prev]);
        return newPayment;
      } catch (err) {
        console.error('API error, falling back to local:', err);
        throw err; // Re-throw to let the UI handle the error
      }
    }

    // Fallback to local storage for demo mode or when backend is not available
    const newPayment = { id: `pay_${Date.now()}`, payment_number: `PAY-${new Date().getFullYear()}-${String(payments.length + 1).padStart(3, '0')}`, ...paymentData, status: 'draft', created_at: new Date().toISOString() };
    const updated = [newPayment, ...payments];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setPayments(updated);
    return newPayment;
  }, [backendAvailable, payments, activeCompany]);

  const confirmPayment = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(PAYMENTS_KEY, companyId);
    if (backendAvailable) {
      try {
        await financeService.confirmPayment(id);
        setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'confirmed' } : p));
        // Refetch invoices and bills since confirming a payment updates their paid amounts
        salesService.listInvoices().then(resp => {
          const arr = Array.isArray(resp) ? resp : (resp?.items || []);
          setCustomerInvoices(arr.map(inv => ({
            ...inv,
            invoice_type: 'customer_invoice',
            total_amount: inv.total_amount || 0,
            amount_due: inv.amount_due ?? (inv.total_amount - (inv.amount_paid || 0)),
            amount_paid: inv.amount_paid || 0,
          })));
        }).catch(() => {});
        financeService.listPurchaseInvoices().then(resp => {
          const arr = Array.isArray(resp) ? resp : (resp?.data || resp?.items || []);
          setVendorBills(arr);
        }).catch(() => {});
        return;
      } catch (err) {
        console.error('API error:', err);
        throw err;
      }
    }
    const updated = payments.map(p => p.id === id ? { ...p, status: 'confirmed' } : p);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setPayments(updated);
  }, [backendAvailable, payments, activeCompany]);

  // ==================== TAX RATES CRUD ====================
  const createTaxRate = useCallback(async (taxData) => {
    try {
      const newTax = await financeService.createTaxRate(taxData);
      setTaxRates(prev => [newTax, ...prev]);
      return newTax;
    } catch (err) {
      console.error('API error creating tax rate:', err);
      throw err;
    }
  }, []);

  const updateTaxRate = useCallback(async (id, taxData) => {
    try {
      const updated = await financeService.updateTaxRate(id, taxData);
      setTaxRates(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
      return updated;
    } catch (err) {
      console.error('API error updating tax rate:', err);
      throw err;
    }
  }, []);

  const deleteTaxRate = useCallback(async (id) => {
    try {
      await financeService.deleteTaxRate(id);
      setTaxRates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('API error deleting tax rate:', err);
      throw err;
    }
  }, []);

  // ==================== JOURNALS CRUD ====================
  const createJournal = useCallback(async (journalData) => {
    try {
      const newJournal = await financeService.createJournal(journalData);
      setJournals(prev => [newJournal, ...prev]);
      return newJournal;
    } catch (err) {
      console.error('API error creating journal:', err);
      throw err;
    }
  }, []);

  const updateJournal = useCallback(async (id, journalData) => {
    try {
      const updated = await financeService.updateJournal(id, journalData);
      setJournals(prev => prev.map(j => j.id === id ? { ...j, ...updated } : j));
      return updated;
    } catch (err) {
      console.error('API error updating journal:', err);
      throw err;
    }
  }, []);

  const deleteJournal = useCallback(async (id) => {
    try {
      await financeService.deleteJournal(id);
      setJournals(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      console.error('API error deleting journal:', err);
      throw err;
    }
  }, []);

  // ==================== BANK ACCOUNTS CRUD ====================
  const createBankAccount = useCallback(async (accountData) => {
    try {
      const newAccount = await financeService.createBankAccount(accountData);
      setBankAccounts(prev => [newAccount, ...prev]);
      return newAccount;
    } catch (err) {
      console.error('Failed to create bank account:', err);
      throw err;
    }
  }, []);

  const updateBankAccount = useCallback(async (id, accountData) => {
    try {
      const updated = await financeService.updateBankAccount(id, accountData);
      setBankAccounts(prev => prev.map(acc => acc.id === id ? updated : acc));
      return updated;
    } catch (err) {
      console.error('Failed to update bank account:', err);
      throw err;
    }
  }, []);

  const deleteBankAccount = useCallback(async (id) => {
    try {
      await financeService.deleteBankAccount(id);
      setBankAccounts(prev => prev.filter(acc => acc.id !== id));
    } catch (err) {
      console.error('Failed to delete bank account:', err);
      throw err;
    }
  }, []);

  // ==================== BANK TRANSACTIONS CRUD ====================
  const loadBankTransactions = useCallback(async (bankAccountId) => {
    try {
      const transactions = await financeService.listBankTransactions(bankAccountId);
      setBankTransactions(transactions || []);
      return transactions || [];
    } catch (err) {
      console.error('Failed to load bank transactions:', err);
      return [];
    }
  }, []);

  const getBankTransactionsByAccount = useCallback((bankAccountId) => {
    return bankTransactions.filter(t => t.bank_account_id === bankAccountId);
  }, [bankTransactions]);

  const createBankTransaction = useCallback(async (bankAccountId, transactionData) => {
    try {
      const newTransaction = await financeService.createBankTransaction(bankAccountId, transactionData);
      setBankTransactions(prev => [newTransaction, ...prev]);
      // Refresh bank accounts to get updated balance
      const bankAccountsData = await financeService.listBankAccounts().catch(() => []);
      setBankAccounts(bankAccountsData || []);
      return newTransaction;
    } catch (err) {
      console.error('Failed to create bank transaction:', err);
      throw err;
    }
  }, []);

  const reconcileBankTransaction = useCallback(async (bankAccountId, transactionId) => {
    try {
      await financeService.reconcileBankTransaction(bankAccountId, transactionId);
      setBankTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, is_reconciled: true, status: 'reconciled' } : t));
      // Refresh bank accounts to get updated last_reconciled date
      const bankAccountsData = await financeService.listBankAccounts().catch(() => []);
      setBankAccounts(bankAccountsData || []);
    } catch (err) {
      console.error('Failed to reconcile bank transaction:', err);
      throw err;
    }
  }, []);

  // ==================== CASH TRANSACTIONS CRUD ====================
  const createCashTransaction = useCallback(async (transactionData) => {
    try {
      // Format data for backend
      const backendData = {
        transaction_date: transactionData.transaction_date || new Date().toISOString().split('T')[0],
        type: transactionData.type,
        amount: transactionData.amount,
        currency: transactionData.currency || 'UZS',
        description: transactionData.description,
        category: transactionData.category || '',
        reference: transactionData.reference || '',
        cashier: transactionData.cashier || ''
      };
      const newTransaction = await financeService.createCashTransaction(backendData);
      setCashTransactions(prev => [newTransaction, ...prev]);
      return newTransaction;
    } catch (err) {
      console.error('Failed to create cash transaction:', err);
      throw err;
    }
  }, []);

  const updateCashTransaction = useCallback(async (id, transactionData) => {
    try {
      const updated = await financeService.updateCashTransaction(id, transactionData);
      setCashTransactions(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err) {
      console.error('Failed to update cash transaction:', err);
      throw err;
    }
  }, []);

  const deleteCashTransaction = useCallback(async (id) => {
    try {
      await financeService.deleteCashTransaction(id);
      setCashTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete cash transaction:', err);
      throw err;
    }
  }, []);

  // Kassa balansi — the server's own cash_total, not a reduce over accounts[].
  //
  // GET /cash/balance already returns cash_total (5010 leaves), bank_total and
  // currency_total. Summing kind === 'cash' here meant the rule for "what
  // counts as kassa" lived in two places, and the browser's copy kept whatever
  // the backend used to mean: while the server tagged every 50xx account
  // 'cash', this card showed kassa + bank + valyuta added together — the same
  // money the Bank hisobvaraqlari tab shows, counted twice, one tab apart.
  //
  // Reading the field means the card follows the server's classification
  // without a frontend release.
  const getCashBalance = useCallback(() => cashPosition?.cash_total ?? 0, [cashPosition]);

  const refreshCashPosition = useCallback(async (params = {}) => {
    if (!backendAvailable) return null;
    try {
      const data = await financeService.getCashBalance(params);
      if (data && typeof data === 'object') {
        // The subtotals were dropped here, which is why the card had to
        // recompute one: cash_total arrived and was thrown away.
        setCashPosition({
          total: data.total || 0,
          cash_total: data.cash_total || 0,
          bank_total: data.bank_total || 0,
          currency_total: data.currency_total || 0,
          as_of: data.as_of || null,
          accounts: data.accounts || [],
        });
      }
      return data;
    } catch (err) {
      console.error('Failed to refresh cash position:', err);
      return null;
    }
  }, [backendAvailable]);

  // ==================== CURRENCIES CRUD ====================
  const createCurrency = useCallback(async (currencyData) => {
    try {
      // Format data for backend
      const backendData = {
        code: currencyData.code,
        name: currencyData.name,
        symbol: currencyData.symbol,
        decimal_places: currencyData.decimal_places ?? 2,
        is_base_currency: currencyData.is_base ?? false
      };
      const newCurrency = await financeService.createCurrency(backendData);
      setCurrencies(prev => [newCurrency, ...prev]);
      return newCurrency;
    } catch (err) {
      console.error('Failed to create currency:', err);
      throw err;
    }
  }, []);

  const updateCurrency = useCallback(async (code, currencyData) => {
    try {
      const updated = await financeService.updateCurrency(code, currencyData);
      setCurrencies(prev => prev.map(c => c.code === code ? updated : c));
      return updated;
    } catch (err) {
      console.error('Failed to update currency:', err);
      throw err;
    }
  }, []);

  const deleteCurrency = useCallback(async (code) => {
    try {
      await financeService.deleteCurrency(code);
      setCurrencies(prev => prev.filter(c => c.code !== code));
    } catch (err) {
      console.error('Failed to delete currency:', err);
      throw err;
    }
  }, []);

  // ==================== EXCHANGE RATES CRUD ====================
  const setExchangeRate = useCallback(async (code, rateData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(EXCHANGE_RATES_KEY, companyId);
    if (backendAvailable) {
      try {
        const newRate = await financeService.setExchangeRate(code, rateData);
        // Reload exchange rates to get the full list with proper IDs
        const allRates = await financeService.listExchangeRates().catch(() => []);
        setExchangeRates(allRates || []);
        return newRate;
      } catch (err) {
        console.error('API error, falling back to local:', err);
        throw err;
      }
    }
    const newRate = { id: `er_${Date.now()}`, from_currency: code, to_currency: 'UZS', ...rateData, date: rateData.date || new Date().toISOString().split('T')[0] };
    const updated = [newRate, ...exchangeRates];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setExchangeRates(updated);
    return newRate;
  }, [backendAvailable, exchangeRates, activeCompany]);

  const getLatestExchangeRate = useCallback((fromCurrency, toCurrency = 'UZS') => {
    const rates = exchangeRates.filter(r => r.from_currency === fromCurrency && r.to_currency === toCurrency);
    if (rates.length === 0) return null;
    // Handle both date and effective_date field names
    return rates.sort((a, b) => new Date(b.effective_date || b.date) - new Date(a.effective_date || a.date))[0];
  }, [exchangeRates]);

  const convertCurrency = useCallback((amount, fromCurrency, toCurrency = 'UZS') => {
    if (fromCurrency === toCurrency) return amount;
    // Try direct rate first (e.g. USD -> UZS)
    const directRate = getLatestExchangeRate(fromCurrency, toCurrency);
    if (directRate) return amount * directRate.rate;
    // Try reverse rate (e.g. for UZS -> USD, use the USD -> UZS rate and divide)
    const reverseRate = getLatestExchangeRate(toCurrency, fromCurrency);
    if (reverseRate && reverseRate.rate > 0) return amount / reverseRate.rate;
    return null;
  }, [getLatestExchangeRate]);

  // ==================== JOURNAL ENTRIES CRUD ====================
  const createJournalEntry = useCallback(async (entryData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(JOURNAL_ENTRIES_KEY, companyId);
    if (backendAvailable) {
      try {
        const newEntry = await financeService.createJournalEntry({ ...entryData, organization_id: companyId });
        setJournalEntries(prev => [newEntry, ...prev]);
        return newEntry;
      } catch (err) {
          console.error('API error creating journal entry:', err?.response?.data || err);
          throw err;
        }
    }
    const newEntry = { id: `je_${Date.now()}`, journal_number: entryData.journal_number || `JE-${new Date().getFullYear()}-${String(journalEntries.length + 1).padStart(3, '0')}`, ...entryData, company_id: companyId, created_date: new Date().toISOString() };
    const updated = [newEntry, ...journalEntries];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setJournalEntries(updated);
    return newEntry;
  }, [backendAvailable, journalEntries, activeCompany]);

  const updateJournalEntry = useCallback(async (id, entryData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(JOURNAL_ENTRIES_KEY, companyId);
    if (backendAvailable) {
      try {
        await financeService.updateJournalEntry(id, entryData);
        // Reload to get latest
        const fresh = await financeService.getJournalEntry(id);
        setJournalEntries(prev => prev.map(e => e.id === id ? fresh : e));
        return fresh;
      } catch (err) {
        console.error('API error:', err);
        throw err;
      }
    }
    const updated = journalEntries.map(entry => entry.id === id ? { ...entry, ...entryData } : entry);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setJournalEntries(updated);
  }, [backendAvailable, journalEntries, activeCompany]);

  const deleteJournalEntry = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await financeService.deleteJournalEntry(id);
      } catch (err) {
        console.error('API error:', err);
        throw err;
      }
    }
    const companyId = activeCompany?.id;
    const updated = journalEntries.filter(entry => entry.id !== id);
    localStorage.setItem(getStorageKey(JOURNAL_ENTRIES_KEY, companyId), JSON.stringify(updated));
    setJournalEntries(updated);
    const updatedLines = journalLines.filter(line => line.journal_entry_id !== id);
    localStorage.setItem(getStorageKey(JOURNAL_LINES_KEY, companyId), JSON.stringify(updatedLines));
    setJournalLines(updatedLines);
  }, [backendAvailable, journalEntries, journalLines, activeCompany]);

  const cancelJournalEntry = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await financeService.cancelJournalEntry(id);
        setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'cancelled' } : e));
      } catch (err) {
        console.error('API error:', err);
        throw err;
      }
    }
  }, [backendAvailable]);

  const postJournalEntry = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await financeService.postJournalEntry(id);
        // Reload to get posted_at etc.
        const fresh = await financeService.getJournalEntry(id);
        setJournalEntries(prev => prev.map(e => e.id === id ? fresh : e));
        return fresh;
      } catch (err) {
        console.error('API error:', err);
        throw err;
      }
    }
    const updated = journalEntries.map(e => e.id === id ? { ...e, status: 'posted' } : e);
    const companyId = activeCompany?.id;
    localStorage.setItem(getStorageKey(JOURNAL_ENTRIES_KEY, companyId), JSON.stringify(updated));
    setJournalEntries(updated);
  }, [backendAvailable, journalEntries, activeCompany]);

  const reverseJournalEntry = useCallback(async (id, data = {}) => {
    if (backendAvailable) {
      try {
        const result = await financeService.reverseJournalEntry(id, data);
        // Reload entries list
        const entries = await financeService.listJournalEntries({ limit: 1000 });
        setJournalEntries(entries || []);
        return result;
      } catch (err) {
        console.error('API error:', err);
        throw err;
      }
    }
  }, [backendAvailable]);

  const resetJournalEntryToDraft = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        const result = await financeService.resetJournalEntryToDraft(id);
        const entries = await financeService.listJournalEntries({ limit: 1000 });
        setJournalEntries(entries || []);
        return result;
      } catch (err) {
        console.error('API error:', err);
        throw err;
      }
    }
  }, [backendAvailable]);

  const listJournalEntries = useCallback((sortField, limit) => {
    let sorted = [...journalEntries];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [journalEntries]);

  const getJournalLines = useCallback((journalEntryId) => journalLines.filter(line => line.journal_entry_id === journalEntryId), [journalLines]);

  const createJournalLine = useCallback((lineData) => {
    const companyId = activeCompany?.id;
    const newLine = { id: `jl_${Date.now()}`, ...lineData, company_id: companyId };
    const updated = [...journalLines, newLine];
    localStorage.setItem(getStorageKey(JOURNAL_LINES_KEY, companyId), JSON.stringify(updated));
    setJournalLines(updated);
    return newLine;
  }, [journalLines, activeCompany]);

  // ==================== VENDOR BILLS CRUD ====================
  const createVendorBill = useCallback(async (billData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDOR_BILLS_KEY, companyId);

    // Call backend API if available
    if (backendAvailable) {
      try {
        const apiBill = await financeService.createPurchaseInvoice({
          vendor_id: billData.partner_id || billData.vendor_id,
          organization_id: billData.organization_id || companyId,
          // POST /purchase-invoices marks this binding:"required". It was not
          // in the payload at all, so every create from the AP screen returned
          // 400 and the only trace was a console message — the button looked
          // like it did nothing.
          vendor_invoice_number: billData.vendor_invoice_number || billData.invoice_number || '',
          invoice_date: billData.invoice_date,
          due_date: billData.due_date,
          subtotal: billData.subtotal || 0,
          // Recorded alongside the amount so the stored bill says which rate
          // produced its tax.
          ...(billData.tax_rate_id ? { tax_rate_id: billData.tax_rate_id } : {}),
          tax_amount: billData.tax_amount || 0,
          total_amount: billData.total_amount || 0,
          notes: billData.description || billData.notes || '',
        });
        // Map backend response to frontend format
        const newBill = {
          ...apiBill,
          invoice_type: 'vendor_bill',
          partner_id: apiBill.vendor_id || apiBill.partner_id,
          partner_name: apiBill.vendor_name || apiBill.partner_name || '',
        };
        setVendorBills(prev => [newBill, ...prev]);
        return newBill;
      } catch (err) {
        console.error('API error creating vendor bill:', err);
        throw err;
      }
    }

    // Fallback to localStorage
    const newBill = { id: `vb_${Date.now()}`, invoice_type: 'vendor_bill', invoice_number: billData.invoice_number || `BILL-${Date.now()}`, ...billData, company_id: companyId, created_date: new Date().toISOString() };
    const updated = [newBill, ...vendorBills];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setVendorBills(updated);
    return newBill;
  }, [backendAvailable, vendorBills, activeCompany]);

  const updateVendorBill = useCallback(async (id, billData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDOR_BILLS_KEY, companyId);

    if (backendAvailable) {
      try {
        const updated = await financeService.updatePurchaseInvoice(id, billData);
        setVendorBills(prev => prev.map(bill => bill.id === id ? { ...bill, ...updated } : bill));
        return updated;
      } catch (err) {
        console.error('API error updating vendor bill:', err);
      
        toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
      }
    }

    const updated = vendorBills.map(bill => bill.id === id ? { ...bill, ...billData } : bill);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setVendorBills(updated);
  }, [backendAvailable, vendorBills, activeCompany]);

  const listVendorBills = useCallback((sortField, limit) => {
    let sorted = [...vendorBills];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [vendorBills]);

  // Post vendor bill - creates journal entry
  const postVendorBill = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        const updated = await financeService.postPurchaseInvoice(id);
        setVendorBills(prev => prev.map(bill => bill.id === id ? { ...bill, status: 'posted', ...updated } : bill));
        return updated;
      } catch (err) {
        console.error('API error posting vendor bill:', err);
        throw err;
      }
    }

    // Fallback for localStorage mode
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDOR_BILLS_KEY, companyId);
    const updated = vendorBills.map(bill => bill.id === id ? { ...bill, status: 'posted' } : bill);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setVendorBills(updated);
    return updated.find(b => b.id === id);
  }, [backendAvailable, vendorBills, activeCompany]);

  // Pay vendor bill - creates payment record and journal entry
  const payVendorBill = useCallback(async (id, amount = 0) => {
    if (backendAvailable) {
      try {
        const updated = await financeService.payPurchaseInvoice(id, amount);
        setVendorBills(prev => prev.map(bill => bill.id === id ? { ...bill, ...updated } : bill));
        // Refresh payments list to show the new payment
        const paymentsData = await financeService.listPayments();
        if (paymentsData) {
          const mappedPayments = (paymentsData.data || paymentsData || []).map(p => ({
            ...p,
            payment_type: p.type === 'receipt' ? 'inbound' : 'outbound',
            party_name: p.contact_name || '',
            payment_method: p.payment_method || (p.journal_name?.toLowerCase().includes('cash') ? 'cash' : 'bank_transfer'),
          }));
          setPayments(mappedPayments);
        }
        return updated;
      } catch (err) {
        console.error('API error paying vendor bill:', err);
        throw err;
      }
    }

    // Fallback for localStorage mode
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDOR_BILLS_KEY, companyId);
    const bill = vendorBills.find(b => b.id === id);
    const payAmount = amount || (bill?.total_amount - (bill?.amount_paid || 0));
    const newAmountPaid = (bill?.amount_paid || 0) + payAmount;
    const newStatus = newAmountPaid >= bill?.total_amount ? 'paid' : 'partial';
    const updated = vendorBills.map(b => b.id === id ? { ...b, amount_paid: newAmountPaid, status: newStatus } : b);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setVendorBills(updated);
    return updated.find(b => b.id === id);
  }, [backendAvailable, vendorBills, activeCompany]);

  // ==================== CUSTOMER INVOICES CRUD ====================
  const createCustomerInvoice = useCallback(async (invoiceData) => {
    const companyId = activeCompany?.id;
    try {
      const newInvoice = await salesService.createInvoice({ ...invoiceData, company_id: companyId });
      setCustomerInvoices(prev => [newInvoice, ...prev]);
      return newInvoice;
    } catch (err) {
      console.error('API error creating customer invoice:', err);
      throw err;
    }
  }, [activeCompany]);

  const updateCustomerInvoice = useCallback(async (id, invoiceData) => {
    try {
      const updated = await salesService.updateInvoice(id, invoiceData);
      setCustomerInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updated } : inv));
      return updated;
    } catch (err) {
      console.error('API error updating customer invoice:', err);
      throw err;
    }
  }, []);

  const listCustomerInvoices = useCallback((sortField, limit) => {
    let sorted = [...customerInvoices];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [customerInvoices]);

  const listFinancialTransactions = useCallback((sortField, limit) => {
    let sorted = [...financialTransactions];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [financialTransactions]);

  // ==================== FINANCIAL REPORTS ====================
  const getBalanceSheet = useCallback(async (params = {}) => {
    if (backendAvailable) { try { return await financeService.getBalanceSheet(params); } catch (err) { console.error('API error:', err); } }
    return null;
  }, [backendAvailable]);

  const getIncomeStatement = useCallback(async (params = {}) => {
    if (backendAvailable) { try { return await financeService.getIncomeStatement(params); } catch (err) { console.error('API error:', err); } }
    return null;
  }, [backendAvailable]);

  const getCashFlow = useCallback(async (params = {}) => {
    if (backendAvailable) { try { return await financeService.getCashFlow(params); } catch (err) { console.error('API error:', err); } }
    return null;
  }, [backendAvailable]);

  const getTrialBalance = useCallback(async (params = {}) => {
    if (backendAvailable) { try { return await financeService.getTrialBalance(params); } catch (err) { console.error('API error:', err); } }
    return null;
  }, [backendAvailable]);

  const getGeneralLedger = useCallback(async (params = {}) => {
    if (backendAvailable) { try { return await financeService.getGeneralLedger(params); } catch (err) { console.error('API error:', err); } }
    return null;
  }, [backendAvailable]);

  const getAgingReceivables = useCallback(async (params = {}) => {
    if (backendAvailable) { try { return await financeService.getAgingReceivables(params); } catch (err) { console.error('API error:', err); } }
    return null;
  }, [backendAvailable]);

  const getAgingPayables = useCallback(async (params = {}) => {
    if (backendAvailable) { try { return await financeService.getAgingPayables(params); } catch (err) { console.error('API error:', err); } }
    return null;
  }, [backendAvailable]);

  // ==================== FISCAL YEARS CRUD ====================
  const createFiscalYear = useCallback(async (yearData) => {
    try {
      const newYear = await financeService.createFiscalYear(yearData);
      setFiscalYears(prev => [newYear, ...prev]);
      return newYear;
    } catch (error) {
      console.error('Failed to create fiscal year:', error);
      throw error;
    }
  }, []);

  const updateFiscalYear = useCallback(async (id, yearData) => {
    try {
      const updated = await financeService.updateFiscalYear(id, yearData);
      setFiscalYears(prev => prev.map(fy => fy.id === id ? updated : fy));
      return updated;
    } catch (error) {
      console.error('Failed to update fiscal year:', error);
      throw error;
    }
  }, []);

  const closeFiscalYear = useCallback(async (id) => {
    try {
      await financeService.closeFiscalYear(id);
      // Update local state to reflect closed status
      setFiscalYears(prev => prev.map(fy => fy.id === id ? { ...fy, status: 'closed' } : fy));
      setFiscalPeriods(prev => prev.map(fp => fp.fiscal_year_id === id ? { ...fp, status: 'closed' } : fp));
    } catch (error) {
      console.error('Failed to close fiscal year:', error);
      throw error;
    }
  }, []);

  const deleteFiscalYear = useCallback(async (id) => {
    try {
      await financeService.deleteFiscalYear(id);
      // Update local state to remove deleted fiscal year and its periods
      setFiscalYears(prev => prev.filter(fy => fy.id !== id));
      setFiscalPeriods(prev => prev.filter(fp => fp.fiscal_year_id !== id));
    } catch (error) {
      console.error('Failed to delete fiscal year:', error);
      throw error;
    }
  }, []);

  // ==================== FISCAL PERIODS CRUD ====================
  const createFiscalPeriod = useCallback(async (periodData) => {
    try {
      const newPeriod = await financeService.createFiscalPeriod(periodData);
      setFiscalPeriods(prev => [...prev, newPeriod]);
      return newPeriod;
    } catch (error) {
      console.error('Failed to create fiscal period:', error);
      throw error;
    }
  }, []);

  const createFiscalPeriods = useCallback(async (periods) => {
    try {
      const newPeriods = await financeService.createFiscalPeriods(periods);
      setFiscalPeriods(prev => [...prev, ...newPeriods]);
      return newPeriods;
    } catch (error) {
      console.error('Failed to create fiscal periods:', error);
      throw error;
    }
  }, []);

  const closeFiscalPeriod = useCallback(async (id) => {
    try {
      await financeService.closeFiscalPeriod(id);
      setFiscalPeriods(prev => prev.map(fp => fp.id === id ? { ...fp, status: 'closed' } : fp));
    } catch (error) {
      console.error('Failed to close fiscal period:', error);
      throw error;
    }
  }, []);

  const reopenFiscalPeriod = useCallback(async (id) => {
    try {
      await financeService.reopenFiscalPeriod(id);
      setFiscalPeriods(prev => prev.map(fp => fp.id === id ? { ...fp, status: 'open' } : fp));
    } catch (error) {
      console.error('Failed to reopen fiscal period:', error);
      throw error;
    }
  }, []);

  const getFiscalPeriodsByYear = useCallback((fiscalYearId) => {
    return fiscalPeriods.filter(fp => fp.fiscal_year_id === fiscalYearId)
      .sort((a, b) => a.period_number - b.period_number);
  }, [fiscalPeriods]);

  // ==================== BUDGETS CRUD ====================
  const createBudget = useCallback(async (budgetData) => {
    try {
      const newBudget = await financeService.createBudget(budgetData);
      setBudgets(prev => [newBudget, ...prev]);
      return newBudget;
    } catch (error) {
      console.error('Failed to create budget:', error);
      throw error;
    }
  }, []);

  const updateBudget = useCallback(async (id, budgetData) => {
    try {
      const updated = await financeService.updateBudget(id, budgetData);
      setBudgets(prev => prev.map(b => b.id === id ? updated : b));
      return updated;
    } catch (error) {
      console.error('Failed to update budget:', error);
      throw error;
    }
  }, []);

  const deleteBudget = useCallback(async (id) => {
    try {
      await financeService.deleteBudget(id);
      setBudgets(prev => prev.filter(b => b.id !== id));
      setBudgetLines(prev => prev.filter(bl => bl.budget_id !== id));
    } catch (error) {
      console.error('Failed to delete budget:', error);
      throw error;
    }
  }, []);

  const activateBudget = useCallback(async (id) => {
    try {
      await financeService.activateBudget(id);
      setBudgets(prev => prev.map(b => b.id === id ? { ...b, status: 'active' } : b));
    } catch (error) {
      console.error('Failed to activate budget:', error);
      throw error;
    }
  }, []);

  // ==================== BUDGET LINES CRUD ====================
  const createBudgetLine = useCallback(async (lineData) => {
    try {
      const newLine = await financeService.createBudgetLine(lineData);
      // Re-fetch all budget lines to get computed actual amounts from journal entries
      const refreshedLines = await financeService.listBudgetLines().catch(() => null);
      if (refreshedLines) {
        setBudgetLines(refreshedLines);
      } else {
        setBudgetLines(prev => [...prev, newLine]);
      }
      return newLine;
    } catch (error) {
      console.error('Failed to create budget line:', error);
      throw error;
    }
  }, []);

  const updateBudgetLine = useCallback(async (id, lineData) => {
    try {
      const updated = await financeService.updateBudgetLine(id, lineData);
      setBudgetLines(prev => prev.map(bl => bl.id === id ? updated : bl));
      return updated;
    } catch (error) {
      console.error('Failed to update budget line:', error);
      throw error;
    }
  }, []);

  const deleteBudgetLine = useCallback(async (id) => {
    try {
      await financeService.deleteBudgetLine(id);
      setBudgetLines(prev => prev.filter(bl => bl.id !== id));
    } catch (error) {
      console.error('Failed to delete budget line:', error);
      throw error;
    }
  }, []);

  const getBudgetLinesByBudget = useCallback((budgetId) => {
    return budgetLines.filter(bl => bl.budget_id === budgetId);
  }, [budgetLines]);

  const getBudgetVariance = useCallback((budgetId) => {
    const lines = budgetLines.filter(bl => bl.budget_id === budgetId);
    const totalPlanned = lines.reduce((sum, l) => sum + (l.budgeted_amount || l.planned_amount || 0), 0);
    const totalActual = lines.reduce((sum, l) => sum + (l.actual_amount || 0), 0);
    return {
      planned: totalPlanned,
      actual: totalActual,
      variance: totalPlanned - totalActual,
      variancePercent: totalPlanned > 0 ? ((totalPlanned - totalActual) / totalPlanned) * 100 : 0,
      usagePercent: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0
    };
  }, [budgetLines]);

  // Fixed assets moved to the unified v2 module ('@/api/services/fixedAssetsV2',
  // pages/Assets.jsx). The legacy CRUD + client-side depreciation engine that
  // lived here was removed with the 453 migration (2026-08-03).

  // ========== Cash Registers (Kassa) ==========
  // Server documents only. No localStorage fallback, no client-side numbering:
  // any API failure is thrown to the caller (surface it via getApiErrorMessage).
  const createCashRegister = useCallback(async (data) => {
    const result = await financeService.createCashRegister(data);
    setCashRegisters(prev => [...prev, result]);
    return result;
  }, []);

  // ========== Cash Orders (PKO/RKO) ==========
  // POST /cash/orders → 201 draft with SERVER-generated order_number.
  const createCashOrder = useCallback(async (data) => {
    const result = await financeService.createCashOrder(data);
    setCashOrders(prev => [result, ...prev]);
    return result;
  }, []);

  // POST /cash/orders/:id/confirm → one-tx balanced JE; response carries
  // {status:'confirmed', journal_entry_id, entry_number} — proof of posting.
  const confirmCashOrder = useCallback(async (id) => {
    const result = await financeService.confirmCashOrder(id);
    setCashOrders(prev => prev.map(o => o.id === id
      ? { ...o, ...(result && typeof result === 'object' ? result : {}), status: 'confirmed' }
      : o));
    // Confirm posts to the ledger — refresh the cash position and the
    // per-register ledger balances from it.
    refreshCashPosition();
    financeService.listCashRegisters()
      .then(regs => setCashRegisters(Array.isArray(regs) ? regs : (regs?.items || [])))
      .catch(() => {});
    return result;
  }, [refreshCashPosition]);

  const updateCashOrder = useCallback(async (id, data) => {
    const result = await financeService.updateCashOrder(id, data);
    setCashOrders(prev => prev.map(o => o.id === id ? { ...o, ...(result || data) } : o));
    return result;
  }, []);

  // Drafts only — confirmed orders are immutable (storno = opposite order).
  const cancelCashOrder = useCallback(async (id) => {
    const result = await financeService.cancelCashOrder(id);
    setCashOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
    return result;
  }, []);

  const getCashBook = useCallback(async (params) => {
    if (backendAvailable) {
      return await financeService.getCashBook(params);
    }
    return null;
  }, [backendAvailable]);

  // ========== Reconciliation Acts (Akt sverka) ==========
  const createReconciliationAct = useCallback(async (data) => {
    if (backendAvailable) {
      const result = await financeService.createReconciliationAct(data);
      setReconciliationActs(prev => [...prev, result]);
      return result;
    }
    const newItem = { id: `ra_${Date.now()}`, status: 'draft', difference: 0, our_balance: 0, partner_balance: 0, opening_balance: 0, our_debit_total: 0, our_credit_total: 0, partner_debit_total: 0, partner_credit_total: 0, created_at: new Date().toISOString(), ...data };
    setReconciliationActs(prev => { const updated = [...prev, newItem]; localStorage.setItem(getStorageKey(RECONCILIATION_ACTS_KEY, activeCompany?.id), JSON.stringify(updated)); return updated; });
    return newItem;
  }, [backendAvailable, activeCompany]);

  const updateReconciliationAct = useCallback(async (id, data) => {
    if (backendAvailable) {
      const result = await financeService.updateReconciliationAct(id, data);
      setReconciliationActs(prev => prev.map(a => a.id === id ? { ...a, ...result } : a));
      return result;
    }
    setReconciliationActs(prev => { const updated = prev.map(a => a.id === id ? { ...a, ...data } : a); localStorage.setItem(getStorageKey(RECONCILIATION_ACTS_KEY, activeCompany?.id), JSON.stringify(updated)); return updated; });
  }, [backendAvailable, activeCompany]);

  const deleteReconciliationAct = useCallback(async (id) => {
    if (backendAvailable) {
      await financeService.deleteReconciliationAct(id);
    }
    setReconciliationActs(prev => { const updated = prev.filter(a => a.id !== id); localStorage.setItem(getStorageKey(RECONCILIATION_ACTS_KEY, activeCompany?.id), JSON.stringify(updated)); return updated; });
  }, [backendAvailable, activeCompany]);

  const bulkGenerateReconciliation = useCallback(async (data) => {
    if (backendAvailable) {
      const result = await financeService.bulkGenerateReconciliation(data);
      // No reload here: the screen that shows these owns its own paginated
      // list and refreshes itself after the call returns.
      return result;
    }
    return { count: 0, message: 'Backend not available' };
  }, [backendAvailable]);

  const refreshReconciliationAct = useCallback(async (id) => {
    if (backendAvailable) {
      const result = await financeService.refreshReconciliationAct(id);
      setReconciliationActs(prev => prev.map(a => a.id === id ? { ...a, ...result } : a));
      return result;
    }
    return null;
  }, [backendAvailable]);

  const exportReconciliationAct = useCallback(async (id, format) => {
    if (backendAvailable) {
      return await financeService.exportReconciliationAct(id, format);
    }
    return null;
  }, [backendAvailable]);

  // ========== Exchange Diffs (Kurs farqi) ==========
  const syncExchangeRates = useCallback(async (data) => {
    if (backendAvailable) {
      const result = await financeService.syncExchangeRates(data);
      // Reload exchange rates after sync
      const allRates = await financeService.listExchangeRates().catch(() => []);
      setExchangeRates(allRates || []);
      return result;
    }
    return { message: 'Backend not available' };
  }, [backendAvailable]);

  const revalueCurrency = useCallback(async (data) => {
    if (backendAvailable) {
      const result = await financeService.revalueCurrency(data);
      const diffs = await financeService.listExchangeDiffs();
      setExchangeDiffs(diffs || []);
      return result;
    }
    return { message: 'Backend not available' };
  }, [backendAvailable]);

  const value = useMemo(() => ({
    journalEntries, journalLines, createJournalEntry, updateJournalEntry, deleteJournalEntry, cancelJournalEntry, postJournalEntry, reverseJournalEntry, resetJournalEntryToDraft, listJournalEntries, getJournalLines, createJournalLine,
    accounts, accountTypes, createAccount, updateAccount, deleteAccount, getAccountTransactions,
    payments, createPayment, confirmPayment,
    taxRates, createTaxRate, updateTaxRate, deleteTaxRate,
    journals, paymentJournals, createJournal, updateJournal, deleteJournal,
    bankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
    bankTransactions, loadBankTransactions, getBankTransactionsByAccount, createBankTransaction, reconcileBankTransaction,
    cashTransactions, createCashTransaction, updateCashTransaction, deleteCashTransaction, getCashBalance, cashPosition, refreshCashPosition,
    currencies, createCurrency, updateCurrency, deleteCurrency,
    exchangeRates, setExchangeRate, getLatestExchangeRate, convertCurrency,
    vendorBills, createVendorBill, updateVendorBill, listVendorBills, postVendorBill, payVendorBill,
    customerInvoices, createCustomerInvoice, updateCustomerInvoice, listCustomerInvoices,
    financialTransactions, listFinancialTransactions,
    fiscalYears, createFiscalYear, updateFiscalYear, closeFiscalYear, deleteFiscalYear,
    fiscalPeriods, createFiscalPeriod, createFiscalPeriods, closeFiscalPeriod, reopenFiscalPeriod, getFiscalPeriodsByYear,
    budgets, createBudget, updateBudget, deleteBudget, activateBudget,
    budgetLines, createBudgetLine, updateBudgetLine, deleteBudgetLine, getBudgetLinesByBudget, getBudgetVariance,
    cashRegisters, createCashRegister,
    cashOrders, createCashOrder, confirmCashOrder, updateCashOrder, cancelCashOrder, getCashBook,
    reconciliationActs, createReconciliationAct, updateReconciliationAct, deleteReconciliationAct, bulkGenerateReconciliation, refreshReconciliationAct, exportReconciliationAct,
    exchangeDiffs, syncExchangeRates, revalueCurrency,
    getBalanceSheet, getIncomeStatement, getCashFlow, getTrialBalance, getGeneralLedger, getAgingReceivables, getAgingPayables,
    isLoading, backendAvailable, error, refreshData: loadData,
    settings: financeSettings,
    getFiscalYearStart: () => ({ month: financeSettings.fiscalYearStartMonth, day: financeSettings.fiscalYearStartDay }),
    getDefaultSalesTax: () => financeSettings.defaultSalesTax,
    getDefaultPurchaseTax: () => financeSettings.defaultPurchaseTax,
    getTaxRounding: () => financeSettings.taxRounding,
    isPriceIncludesTax: () => financeSettings.priceIncludesTax,
    isMultiCurrencyEnabled: () => financeSettings.multiCurrencyEnabled,
    getBaseCurrency: () => financeSettings.baseCurrency,
    getReconciliationTolerance: () => financeSettings.reconciliationTolerance,
    isAutoMatchEnabled: () => financeSettings.autoMatchTransactions,
    isAutoPostEnabled: () => financeSettings.autoPostEntries,
    isJournalApprovalRequired: () => financeSettings.requireApproval,
    getDefaultAccounts: () => ({
      sales: financeSettings.defaultSalesAccount,
      purchase: financeSettings.defaultPurchaseAccount,
      inventory: financeSettings.defaultInventoryAccount,
      receivables: financeSettings.defaultReceivablesAccount,
      payables: financeSettings.defaultPayablesAccount
    })
  }), [journalEntries, journalLines, createJournalEntry, updateJournalEntry, deleteJournalEntry, cancelJournalEntry, postJournalEntry, reverseJournalEntry, resetJournalEntryToDraft, listJournalEntries, getJournalLines, createJournalLine, accounts, accountTypes, createAccount, updateAccount, deleteAccount, getAccountTransactions, payments, createPayment, confirmPayment, taxRates, createTaxRate, updateTaxRate, deleteTaxRate, journals, createJournal, updateJournal, deleteJournal, bankAccounts, createBankAccount, updateBankAccount, deleteBankAccount, bankTransactions, loadBankTransactions, getBankTransactionsByAccount, createBankTransaction, reconcileBankTransaction, cashTransactions, createCashTransaction, updateCashTransaction, deleteCashTransaction, getCashBalance, cashPosition, refreshCashPosition, currencies, createCurrency, updateCurrency, deleteCurrency, exchangeRates, setExchangeRate, getLatestExchangeRate, convertCurrency, vendorBills, createVendorBill, updateVendorBill, listVendorBills, postVendorBill, payVendorBill, customerInvoices, createCustomerInvoice, updateCustomerInvoice, listCustomerInvoices, financialTransactions, listFinancialTransactions, fiscalYears, createFiscalYear, updateFiscalYear, closeFiscalYear, deleteFiscalYear, fiscalPeriods, createFiscalPeriod, createFiscalPeriods, closeFiscalPeriod, reopenFiscalPeriod, getFiscalPeriodsByYear, budgets, createBudget, updateBudget, deleteBudget, activateBudget, budgetLines, createBudgetLine, updateBudgetLine, deleteBudgetLine, getBudgetLinesByBudget, getBudgetVariance, cashRegisters, createCashRegister, cashOrders, createCashOrder, confirmCashOrder, updateCashOrder, cancelCashOrder, getCashBook, reconciliationActs, createReconciliationAct, updateReconciliationAct, deleteReconciliationAct, bulkGenerateReconciliation, refreshReconciliationAct, exportReconciliationAct, exchangeDiffs, syncExchangeRates, revalueCurrency, getBalanceSheet, getIncomeStatement, getCashFlow, getTrialBalance, getGeneralLedger, getAgingReceivables, getAgingPayables, isLoading, backendAvailable, error, loadData, financeSettings]);

  return (
    <FinancialsContext.Provider value={value}>
      {children}
    </FinancialsContext.Provider>
  );
}

export function useFinancials() {
  const context = useContext(FinancialsContext);
  if (!context) { throw new Error('useFinancials must be used within FinancialsProvider'); }
  return context;
}
