import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { financeService, salesService } from '@/api/services';
import { useCompany } from './CompanyContext';
import { isDemoMode, checkBackendHealth, API_BASE_URL } from '@/config/dataMode';

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
  { id: 'acc_1', code: '1000', name: 'Cash and Cash Equivalents', type: 'asset', parent_id: null, balance: 50000, is_active: true },
  { id: 'acc_2', code: '1100', name: 'Cash on Hand', type: 'asset', parent_id: 'acc_1', balance: 5000, is_active: true },
  { id: 'acc_3', code: '1200', name: 'Bank Accounts', type: 'asset', parent_id: 'acc_1', balance: 45000, is_active: true },
  { id: 'acc_4', code: '1300', name: 'Accounts Receivable', type: 'asset', parent_id: null, balance: 25000, is_active: true },
  { id: 'acc_5', code: '2000', name: 'Current Liabilities', type: 'liability', parent_id: null, balance: 15000, is_active: true },
  { id: 'acc_6', code: '2100', name: 'Accounts Payable', type: 'liability', parent_id: 'acc_5', balance: 10000, is_active: true },
  { id: 'acc_7', code: '2200', name: 'Taxes Payable', type: 'liability', parent_id: 'acc_5', balance: 5000, is_active: true },
  { id: 'acc_8', code: '3000', name: 'Equity', type: 'equity', parent_id: null, balance: 100000, is_active: true },
  { id: 'acc_9', code: '4000', name: 'Revenue', type: 'revenue', parent_id: null, balance: 75000, is_active: true },
  { id: 'acc_10', code: '5000', name: 'Expenses', type: 'expense', parent_id: null, balance: 35000, is_active: true },
  { id: 'acc_11', code: '5100', name: 'Salaries Expense', type: 'expense', parent_id: 'acc_10', balance: 20000, is_active: true },
  { id: 'acc_12', code: '5200', name: 'Rent Expense', type: 'expense', parent_id: 'acc_10', balance: 10000, is_active: true },
  { id: 'acc_13', code: '5300', name: 'Utilities Expense', type: 'expense', parent_id: 'acc_10', balance: 5000, is_active: true },
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
  { code: 'EUR', name: 'Euro', symbol: '€', is_base: false, is_active: true, decimal_places: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', is_base: false, is_active: true, decimal_places: 2 },
];

const sampleExchangeRates = [
  { id: 'er_1', from_currency: 'USD', to_currency: 'UZS', rate: 12650, date: new Date().toISOString().split('T')[0], source: 'CBU' },
  { id: 'er_2', from_currency: 'EUR', to_currency: 'UZS', rate: 13750, date: new Date().toISOString().split('T')[0], source: 'CBU' },
  { id: 'er_3', from_currency: 'RUB', to_currency: 'UZS', rate: 135, date: new Date().toISOString().split('T')[0], source: 'CBU' },
  { id: 'er_4', from_currency: 'USD', to_currency: 'UZS', rate: 12600, date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], source: 'CBU' },
  { id: 'er_5', from_currency: 'EUR', to_currency: 'UZS', rate: 13700, date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], source: 'CBU' },
];

export function FinancialsProvider({ children }) {
  const { activeCompany } = useCompany();
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLines, setJournalLines] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [financialTransactions, setFinancialTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [cashTransactions, setCashTransactions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

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
          const [entries, invoices, accountsData, paymentsData, taxRatesData] = await Promise.all([
            financeService.listJournalEntries(),
            salesService.listInvoices(),
            financeService.listAccounts(),
            financeService.listPayments(),
            financeService.listTaxRates()
          ]);
          setJournalEntries(entries || []);
          setCustomerInvoices(invoices || []);
          setAccounts(accountsData || []);
          setPayments(paymentsData || []);
          setTaxRates(taxRatesData || []);
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
  }, [activeCompany, loadFromLocalStorage]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleCompanyChange = () => { loadData(); };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadData]);

  // ==================== ACCOUNTS CRUD ====================
  const createAccount = useCallback(async (accountData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        const newAccount = await financeService.createAccount(accountData);
        setAccounts(prev => [newAccount, ...prev]);
        return newAccount;
      } catch (err) { console.error('API error, falling back to local:', err); }
    }
    const newAccount = { id: `acc_${Date.now()}`, ...accountData, balance: 0, is_active: true, created_at: new Date().toISOString() };
    const updated = [newAccount, ...accounts];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setAccounts(updated);
    return newAccount;
  }, [backendAvailable, accounts, activeCompany]);

  const updateAccount = useCallback(async (id, accountData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        const updated = await financeService.updateAccount(id, accountData);
        setAccounts(prev => prev.map(acc => acc.id === id ? updated : acc));
        return updated;
      } catch (err) { console.error('API error:', err); }
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
      } catch (err) { console.error('API error:', err); }
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
    if (backendAvailable) {
      try {
        const newPayment = await financeService.createPayment(paymentData);
        setPayments(prev => [newPayment, ...prev]);
        return newPayment;
      } catch (err) { console.error('API error, falling back to local:', err); }
    }
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
        const confirmed = await financeService.confirmPayment(id);
        setPayments(prev => prev.map(p => p.id === id ? confirmed : p));
        return confirmed;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = payments.map(p => p.id === id ? { ...p, status: 'confirmed' } : p);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setPayments(updated);
  }, [backendAvailable, payments, activeCompany]);

  // ==================== TAX RATES CRUD ====================
  const createTaxRate = useCallback(async (taxData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(TAX_RATES_KEY, companyId);
    if (backendAvailable) {
      try {
        const newTax = await financeService.createTaxRate(taxData);
        setTaxRates(prev => [newTax, ...prev]);
        return newTax;
      } catch (err) { console.error('API error, falling back to local:', err); }
    }
    const newTax = { id: `tax_${Date.now()}`, ...taxData, is_active: true, created_at: new Date().toISOString() };
    const updated = [newTax, ...taxRates];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setTaxRates(updated);
    return newTax;
  }, [backendAvailable, taxRates, activeCompany]);

  const updateTaxRate = useCallback(async (id, taxData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(TAX_RATES_KEY, companyId);
    if (backendAvailable) {
      try {
        const updated = await financeService.updateTaxRate(id, taxData);
        setTaxRates(prev => prev.map(t => t.id === id ? updated : t));
        return updated;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = taxRates.map(t => t.id === id ? { ...t, ...taxData } : t);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setTaxRates(updated);
  }, [backendAvailable, taxRates, activeCompany]);

  const deleteTaxRate = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(TAX_RATES_KEY, companyId);
    if (backendAvailable) {
      try {
        await financeService.deleteTaxRate(id);
        setTaxRates(prev => prev.filter(t => t.id !== id));
        return;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = taxRates.filter(t => t.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setTaxRates(updated);
  }, [backendAvailable, taxRates, activeCompany]);

  // ==================== BANK ACCOUNTS CRUD ====================
  const createBankAccount = useCallback(async (accountData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BANK_ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        const newAccount = await financeService.createBankAccount(accountData);
        setBankAccounts(prev => [newAccount, ...prev]);
        return newAccount;
      } catch (err) { console.error('API error, falling back to local:', err); }
    }
    const newAccount = { id: `ba_${Date.now()}`, ...accountData, balance: accountData.balance || 0, is_active: true, created_at: new Date().toISOString() };
    const updated = [newAccount, ...bankAccounts];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBankAccounts(updated);
    return newAccount;
  }, [backendAvailable, bankAccounts, activeCompany]);

  const updateBankAccount = useCallback(async (id, accountData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BANK_ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        const updated = await financeService.updateBankAccount(id, accountData);
        setBankAccounts(prev => prev.map(acc => acc.id === id ? updated : acc));
        return updated;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = bankAccounts.map(acc => acc.id === id ? { ...acc, ...accountData } : acc);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBankAccounts(updated);
  }, [backendAvailable, bankAccounts, activeCompany]);

  const deleteBankAccount = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BANK_ACCOUNTS_KEY, companyId);
    if (backendAvailable) {
      try {
        await financeService.deleteBankAccount(id);
        setBankAccounts(prev => prev.filter(acc => acc.id !== id));
        return;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = bankAccounts.filter(acc => acc.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBankAccounts(updated);
  }, [backendAvailable, bankAccounts, activeCompany]);

  // ==================== BANK TRANSACTIONS CRUD ====================
  const getBankTransactionsByAccount = useCallback((bankAccountId) => {
    return bankTransactions.filter(t => t.bank_account_id === bankAccountId);
  }, [bankTransactions]);

  const createBankTransaction = useCallback(async (bankAccountId, transactionData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BANK_TRANSACTIONS_KEY, companyId);
    if (backendAvailable) {
      try {
        const newTransaction = await financeService.createBankTransaction(bankAccountId, transactionData);
        setBankTransactions(prev => [newTransaction, ...prev]);
        return newTransaction;
      } catch (err) { console.error('API error, falling back to local:', err); }
    }
    const newTransaction = { id: `bt_${Date.now()}`, bank_account_id: bankAccountId, ...transactionData, is_reconciled: false, created_at: new Date().toISOString() };
    const updated = [newTransaction, ...bankTransactions];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBankTransactions(updated);
    // Update bank account balance
    const bankAccountsKey = getStorageKey(BANK_ACCOUNTS_KEY, companyId);
    const balanceChange = transactionData.type === 'credit' ? transactionData.amount : -transactionData.amount;
    const updatedAccounts = bankAccounts.map(acc => acc.id === bankAccountId ? { ...acc, balance: acc.balance + balanceChange } : acc);
    localStorage.setItem(bankAccountsKey, JSON.stringify(updatedAccounts));
    setBankAccounts(updatedAccounts);
    return newTransaction;
  }, [backendAvailable, bankTransactions, bankAccounts, activeCompany]);

  const reconcileBankTransaction = useCallback(async (bankAccountId, transactionId) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BANK_TRANSACTIONS_KEY, companyId);
    if (backendAvailable) {
      try {
        const reconciled = await financeService.reconcileBankTransaction(bankAccountId, transactionId);
        setBankTransactions(prev => prev.map(t => t.id === transactionId ? reconciled : t));
        return reconciled;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = bankTransactions.map(t => t.id === transactionId ? { ...t, is_reconciled: true, reconciled_date: new Date().toISOString().split('T')[0] } : t);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBankTransactions(updated);
    // Update bank account last_reconciled date
    const bankAccountsKey = getStorageKey(BANK_ACCOUNTS_KEY, companyId);
    const updatedAccounts = bankAccounts.map(acc => acc.id === bankAccountId ? { ...acc, last_reconciled: new Date().toISOString().split('T')[0] } : acc);
    localStorage.setItem(bankAccountsKey, JSON.stringify(updatedAccounts));
    setBankAccounts(updatedAccounts);
  }, [backendAvailable, bankTransactions, bankAccounts, activeCompany]);

  // ==================== CASH TRANSACTIONS CRUD ====================
  const createCashTransaction = useCallback(async (transactionData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(CASH_TRANSACTIONS_KEY, companyId);
    if (backendAvailable) {
      try {
        const newTransaction = await financeService.createCashTransaction(transactionData);
        setCashTransactions(prev => [newTransaction, ...prev]);
        return newTransaction;
      } catch (err) { console.error('API error, falling back to local:', err); }
    }
    const newTransaction = { id: `ct_${Date.now()}`, reference: `CASH-${String(cashTransactions.length + 1).padStart(3, '0')}`, ...transactionData, created_at: new Date().toISOString() };
    const updated = [newTransaction, ...cashTransactions];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCashTransactions(updated);
    return newTransaction;
  }, [backendAvailable, cashTransactions, activeCompany]);

  const updateCashTransaction = useCallback(async (id, transactionData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(CASH_TRANSACTIONS_KEY, companyId);
    if (backendAvailable) {
      try {
        const updated = await financeService.updateCashTransaction(id, transactionData);
        setCashTransactions(prev => prev.map(t => t.id === id ? updated : t));
        return updated;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = cashTransactions.map(t => t.id === id ? { ...t, ...transactionData } : t);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCashTransactions(updated);
  }, [backendAvailable, cashTransactions, activeCompany]);

  const deleteCashTransaction = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(CASH_TRANSACTIONS_KEY, companyId);
    if (backendAvailable) {
      try {
        await financeService.deleteCashTransaction(id);
        setCashTransactions(prev => prev.filter(t => t.id !== id));
        return;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = cashTransactions.filter(t => t.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCashTransactions(updated);
  }, [backendAvailable, cashTransactions, activeCompany]);

  const getCashBalance = useCallback(() => {
    return cashTransactions.reduce((balance, t) => {
      if (t.type === 'income') return balance + t.amount;
      if (t.type === 'expense') return balance - t.amount;
      if (t.type === 'transfer') return balance - t.amount;
      return balance;
    }, 0);
  }, [cashTransactions]);

  // ==================== CURRENCIES CRUD ====================
  const createCurrency = useCallback(async (currencyData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(CURRENCIES_KEY, companyId);
    if (backendAvailable) {
      try {
        const newCurrency = await financeService.createCurrency(currencyData);
        setCurrencies(prev => [newCurrency, ...prev]);
        return newCurrency;
      } catch (err) { console.error('API error, falling back to local:', err); }
    }
    const newCurrency = { ...currencyData, is_active: true };
    const updated = [newCurrency, ...currencies];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCurrencies(updated);
    return newCurrency;
  }, [backendAvailable, currencies, activeCompany]);

  const updateCurrency = useCallback(async (code, currencyData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(CURRENCIES_KEY, companyId);
    if (backendAvailable) {
      try {
        const updated = await financeService.updateCurrency(code, currencyData);
        setCurrencies(prev => prev.map(c => c.code === code ? updated : c));
        return updated;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = currencies.map(c => c.code === code ? { ...c, ...currencyData } : c);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCurrencies(updated);
  }, [backendAvailable, currencies, activeCompany]);

  const deleteCurrency = useCallback(async (code) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(CURRENCIES_KEY, companyId);
    if (backendAvailable) {
      try {
        await financeService.deleteCurrency(code);
        setCurrencies(prev => prev.filter(c => c.code !== code));
        return;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = currencies.filter(c => c.code !== code);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCurrencies(updated);
  }, [backendAvailable, currencies, activeCompany]);

  // ==================== EXCHANGE RATES CRUD ====================
  const setExchangeRate = useCallback(async (code, rateData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(EXCHANGE_RATES_KEY, companyId);
    if (backendAvailable) {
      try {
        const newRate = await financeService.setExchangeRate(code, rateData);
        setExchangeRates(prev => [newRate, ...prev]);
        return newRate;
      } catch (err) { console.error('API error, falling back to local:', err); }
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
    return rates.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  }, [exchangeRates]);

  const convertCurrency = useCallback((amount, fromCurrency, toCurrency = 'UZS') => {
    if (fromCurrency === toCurrency) return amount;
    const rate = getLatestExchangeRate(fromCurrency, toCurrency);
    if (!rate) return null;
    return amount * rate.rate;
  }, [getLatestExchangeRate]);

  // ==================== JOURNAL ENTRIES CRUD ====================
  const createJournalEntry = useCallback(async (entryData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(JOURNAL_ENTRIES_KEY, companyId);
    if (backendAvailable) {
      try {
        const newEntry = await financeService.createJournalEntry({ ...entryData, company_id: companyId });
        setJournalEntries(prev => [newEntry, ...prev]);
        return newEntry;
      } catch (err) { console.error('API error, falling back to local:', err); }
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
    if (backendAvailable) { try { await financeService.postJournalEntry(id); } catch (err) { console.error('API error:', err); } }
    const updated = journalEntries.map(entry => entry.id === id ? { ...entry, ...entryData } : entry);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setJournalEntries(updated);
  }, [backendAvailable, journalEntries, activeCompany]);

  const deleteJournalEntry = useCallback((id) => {
    const companyId = activeCompany?.id;
    const updated = journalEntries.filter(entry => entry.id !== id);
    localStorage.setItem(getStorageKey(JOURNAL_ENTRIES_KEY, companyId), JSON.stringify(updated));
    setJournalEntries(updated);
    const updatedLines = journalLines.filter(line => line.journal_entry_id !== id);
    localStorage.setItem(getStorageKey(JOURNAL_LINES_KEY, companyId), JSON.stringify(updatedLines));
    setJournalLines(updatedLines);
  }, [journalEntries, journalLines, activeCompany]);

  const postJournalEntry = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        const posted = await financeService.postJournalEntry(id);
        setJournalEntries(prev => prev.map(e => e.id === id ? posted : e));
        return posted;
      } catch (err) { console.error('API error:', err); }
    }
    const updated = journalEntries.map(e => e.id === id ? { ...e, status: 'posted' } : e);
    const companyId = activeCompany?.id;
    localStorage.setItem(getStorageKey(JOURNAL_ENTRIES_KEY, companyId), JSON.stringify(updated));
    setJournalEntries(updated);
  }, [backendAvailable, journalEntries, activeCompany]);

  const reverseJournalEntry = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        const reversed = await financeService.reverseJournalEntry(id);
        setJournalEntries(prev => [reversed, ...prev.map(e => e.id === id ? { ...e, status: 'reversed' } : e)]);
        return reversed;
      } catch (err) { console.error('API error:', err); }
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
    const newBill = { id: `vb_${Date.now()}`, invoice_type: 'vendor_bill', invoice_number: billData.invoice_number || `BILL-${Date.now()}`, ...billData, company_id: companyId, created_date: new Date().toISOString() };
    const updated = [newBill, ...vendorBills];
    localStorage.setItem(getStorageKey(VENDOR_BILLS_KEY, companyId), JSON.stringify(updated));
    setVendorBills(updated);
    return newBill;
  }, [vendorBills, activeCompany]);

  const updateVendorBill = useCallback((id, billData) => {
    const companyId = activeCompany?.id;
    const updated = vendorBills.map(bill => bill.id === id ? { ...bill, ...billData } : bill);
    localStorage.setItem(getStorageKey(VENDOR_BILLS_KEY, companyId), JSON.stringify(updated));
    setVendorBills(updated);
  }, [vendorBills, activeCompany]);

  const listVendorBills = useCallback((sortField, limit) => {
    let sorted = [...vendorBills];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [vendorBills]);

  // ==================== CUSTOMER INVOICES CRUD ====================
  const createCustomerInvoice = useCallback(async (invoiceData) => {
    const companyId = activeCompany?.id;
    if (backendAvailable) {
      try {
        const newInvoice = await salesService.createInvoice({ ...invoiceData, company_id: companyId });
        setCustomerInvoices(prev => [newInvoice, ...prev]);
        return newInvoice;
      } catch (err) { console.error('API error:', err); }
    }
    const newInvoice = { id: `ci_${Date.now()}`, invoice_type: 'customer_invoice', invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`, ...invoiceData, company_id: companyId, created_date: new Date().toISOString() };
    const updated = [newInvoice, ...customerInvoices];
    localStorage.setItem(getStorageKey(CUSTOMER_INVOICES_KEY, companyId), JSON.stringify(updated));
    setCustomerInvoices(updated);
    return newInvoice;
  }, [backendAvailable, customerInvoices, activeCompany]);

  const updateCustomerInvoice = useCallback(async (id, invoiceData) => {
    const companyId = activeCompany?.id;
    if (backendAvailable) { try { await salesService.updateInvoice(id, invoiceData); } catch (err) { console.error('API error:', err); } }
    const updated = customerInvoices.map(inv => inv.id === id ? { ...inv, ...invoiceData } : inv);
    localStorage.setItem(getStorageKey(CUSTOMER_INVOICES_KEY, companyId), JSON.stringify(updated));
    setCustomerInvoices(updated);
  }, [backendAvailable, customerInvoices, activeCompany]);

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

  return (
    <FinancialsContext.Provider value={{
      journalEntries, journalLines, createJournalEntry, updateJournalEntry, deleteJournalEntry, postJournalEntry, reverseJournalEntry, listJournalEntries, getJournalLines, createJournalLine,
      accounts, createAccount, updateAccount, deleteAccount, getAccountTransactions,
      payments, createPayment, confirmPayment,
      taxRates, createTaxRate, updateTaxRate, deleteTaxRate,
      // Bank Accounts & Transactions
      bankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
      bankTransactions, getBankTransactionsByAccount, createBankTransaction, reconcileBankTransaction,
      // Cash Transactions (Kassa)
      cashTransactions, createCashTransaction, updateCashTransaction, deleteCashTransaction, getCashBalance,
      // Currencies & Exchange Rates
      currencies, createCurrency, updateCurrency, deleteCurrency,
      exchangeRates, setExchangeRate, getLatestExchangeRate, convertCurrency,
      // Invoices & Bills
      vendorBills, createVendorBill, updateVendorBill, listVendorBills,
      customerInvoices, createCustomerInvoice, updateCustomerInvoice, listCustomerInvoices,
      financialTransactions, listFinancialTransactions,
      // Reports
      getBalanceSheet, getIncomeStatement, getCashFlow, getTrialBalance, getGeneralLedger, getAgingReceivables, getAgingPayables,
      isLoading, backendAvailable, error, refreshData: loadData
    }}>
      {children}
    </FinancialsContext.Provider>
  );
}

export function useFinancials() {
  const context = useContext(FinancialsContext);
  if (!context) { throw new Error('useFinancials must be used within FinancialsProvider'); }
  return context;
}
