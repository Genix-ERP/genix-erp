import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { financeService, salesService } from '@/api/services';
import { useCompany } from './CompanyContext';

const JOURNAL_ENTRIES_KEY = 'genix_journal_entries';
const JOURNAL_LINES_KEY = 'genix_journal_lines';
const VENDOR_BILLS_KEY = 'genix_vendor_bills';
const CUSTOMER_INVOICES_KEY = 'genix_customer_invoices';
const FINANCIAL_TRANSACTIONS_KEY = 'genix_financial_transactions';

const FinancialsContext = createContext();

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

// Check if backend is available
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const checkBackendAvailable = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/info`);
    return response.ok;
  } catch {
    return false;
  }
};

// Sample data for fallback mode
const sampleJournalEntries = [
  {
    id: 'je_1',
    journal_number: 'JE-2025-001',
    company_id: 'default',
    posting_date: new Date().toISOString().split('T')[0],
    description: 'Office supplies purchase',
    journal_type: 'manual',
    status: 'posted',
    total_debit: 1500,
    total_credit: 1500,
    currency: 'USD',
    created_date: new Date().toISOString()
  },
  {
    id: 'je_2',
    journal_number: 'JE-2025-002',
    company_id: 'default',
    posting_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Monthly rent payment',
    journal_type: 'manual',
    status: 'posted',
    total_debit: 5000,
    total_credit: 5000,
    currency: 'USD',
    created_date: new Date().toISOString()
  }
];

const sampleJournalLines = [
  { id: 'jl_1', journal_entry_id: 'je_1', account_code: '6100', account_name: 'Office Supplies Expense', description: 'Printer paper', debit_amount: 1500, credit_amount: 0 },
  { id: 'jl_2', journal_entry_id: 'je_1', account_code: '1100', account_name: 'Cash', description: 'Cash payment', debit_amount: 0, credit_amount: 1500 }
];

const sampleVendorBills = [
  {
    id: 'vb_1', invoice_type: 'vendor_bill', invoice_number: 'BILL-2025-001', partner_id: 'Office Depot',
    invoice_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    due_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    total_amount: 2500, tax_amount: 250, subtotal: 2250, amount_due: 2500, amount_paid: 0, status: 'draft',
    created_date: new Date().toISOString()
  },
  {
    id: 'vb_2', invoice_type: 'vendor_bill', invoice_number: 'BILL-2025-002', partner_id: 'TechSupply Inc',
    invoice_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    total_amount: 15000, tax_amount: 1500, subtotal: 13500, amount_due: 15000, amount_paid: 0, status: 'confirmed',
    created_date: new Date().toISOString()
  }
];

const sampleCustomerInvoices = [
  {
    id: 'ci_1', invoice_type: 'customer_invoice', invoice_number: 'INV-2025-001', partner_id: 'Tech Solutions Inc',
    invoice_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    total_amount: 12500, tax_amount: 1250, subtotal: 11250, amount_due: 7500, amount_paid: 5000, status: 'sent',
    created_date: new Date().toISOString()
  },
  {
    id: 'ci_2', invoice_type: 'customer_invoice', invoice_number: 'INV-2025-002', partner_id: 'Global Industries',
    invoice_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    due_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    total_amount: 8750, tax_amount: 875, subtotal: 7875, amount_due: 8750, amount_paid: 0, status: 'sent',
    created_date: new Date().toISOString()
  }
];

const sampleFinancialTransactions = [
  { id: 'ft_1', transaction_type: 'income', amount: 12500, category: 'sales', description: 'Tech Solutions Inc payment', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_2', transaction_type: 'income', amount: 8750, category: 'sales', description: 'Global Industries invoice', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_3', transaction_type: 'expense', amount: 5000, category: 'rent', description: 'Monthly office rent', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_4', transaction_type: 'expense', amount: 15000, category: 'equipment', description: 'Computer equipment', date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ft_5', transaction_type: 'expense', amount: 2500, category: 'operations', description: 'Office supplies', date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }
];

export function FinancialsProvider({ children }) {
  const { activeCompany } = useCompany();
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLines, setJournalLines] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [financialTransactions, setFinancialTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

  const loadFromLocalStorage = useCallback(() => {
    const companyId = activeCompany?.id;

    const storedEntries = localStorage.getItem(getStorageKey(JOURNAL_ENTRIES_KEY, companyId));
    setJournalEntries(storedEntries ? JSON.parse(storedEntries) : sampleJournalEntries);

    const storedLines = localStorage.getItem(getStorageKey(JOURNAL_LINES_KEY, companyId));
    setJournalLines(storedLines ? JSON.parse(storedLines) : sampleJournalLines);

    const storedVB = localStorage.getItem(getStorageKey(VENDOR_BILLS_KEY, companyId));
    setVendorBills(storedVB ? JSON.parse(storedVB) : sampleVendorBills);

    const storedCI = localStorage.getItem(getStorageKey(CUSTOMER_INVOICES_KEY, companyId));
    setCustomerInvoices(storedCI ? JSON.parse(storedCI) : sampleCustomerInvoices);

    const storedFT = localStorage.getItem(getStorageKey(FINANCIAL_TRANSACTIONS_KEY, companyId));
    setFinancialTransactions(storedFT ? JSON.parse(storedFT) : sampleFinancialTransactions);

    // Initialize localStorage if empty
    if (!storedEntries) localStorage.setItem(getStorageKey(JOURNAL_ENTRIES_KEY, companyId), JSON.stringify(sampleJournalEntries));
    if (!storedLines) localStorage.setItem(getStorageKey(JOURNAL_LINES_KEY, companyId), JSON.stringify(sampleJournalLines));
    if (!storedVB) localStorage.setItem(getStorageKey(VENDOR_BILLS_KEY, companyId), JSON.stringify(sampleVendorBills));
    if (!storedCI) localStorage.setItem(getStorageKey(CUSTOMER_INVOICES_KEY, companyId), JSON.stringify(sampleCustomerInvoices));
    if (!storedFT) localStorage.setItem(getStorageKey(FINANCIAL_TRANSACTIONS_KEY, companyId), JSON.stringify(sampleFinancialTransactions));
  }, [activeCompany]);

  // Load data from API or localStorage
  const loadData = useCallback(async () => {
    if (!activeCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        // Load from API
        try {
          const [entries, invoices] = await Promise.all([
            financeService.listJournalEntries(),
            salesService.listInvoices()
          ]);
          setJournalEntries(entries || []);
          setCustomerInvoices(invoices || []);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for company change events
  useEffect(() => {
    const handleCompanyChange = () => {
      loadData();
    };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadData]);

  // Journal Entry CRUD
  const createJournalEntry = useCallback(async (entryData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(JOURNAL_ENTRIES_KEY, companyId);

    if (backendAvailable) {
      try {
        const newEntry = await financeService.createJournalEntry({
          ...entryData,
          company_id: companyId
        });
        setJournalEntries(prev => [newEntry, ...prev]);
        return newEntry;
      } catch (err) {
        console.error('API error, falling back to local:', err);
      }
    }

    // Fallback to localStorage
    const newEntry = {
      id: `je_${Date.now()}`,
      journal_number: entryData.journal_number || `JE-${new Date().getFullYear()}-${String(journalEntries.length + 1).padStart(3, '0')}`,
      ...entryData,
      company_id: companyId,
      created_date: new Date().toISOString()
    };
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
        await financeService.postJournalEntry(id);
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const updated = journalEntries.map(entry =>
      entry.id === id ? { ...entry, ...entryData } : entry
    );
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

  const listJournalEntries = useCallback((sortField, limit) => {
    let sorted = [...journalEntries];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [journalEntries]);

  const getJournalLines = useCallback((journalEntryId) => {
    return journalLines.filter(line => line.journal_entry_id === journalEntryId);
  }, [journalLines]);

  const createJournalLine = useCallback((lineData) => {
    const companyId = activeCompany?.id;
    const newLine = { id: `jl_${Date.now()}`, ...lineData, company_id: companyId };
    const updated = [...journalLines, newLine];
    localStorage.setItem(getStorageKey(JOURNAL_LINES_KEY, companyId), JSON.stringify(updated));
    setJournalLines(updated);
    return newLine;
  }, [journalLines, activeCompany]);

  // Vendor Bills CRUD
  const createVendorBill = useCallback(async (billData) => {
    const companyId = activeCompany?.id;
    const newBill = {
      id: `vb_${Date.now()}`,
      invoice_type: 'vendor_bill',
      invoice_number: billData.invoice_number || `BILL-${Date.now()}`,
      ...billData,
      company_id: companyId,
      created_date: new Date().toISOString()
    };
    const updated = [newBill, ...vendorBills];
    localStorage.setItem(getStorageKey(VENDOR_BILLS_KEY, companyId), JSON.stringify(updated));
    setVendorBills(updated);
    return newBill;
  }, [vendorBills, activeCompany]);

  const updateVendorBill = useCallback((id, billData) => {
    const companyId = activeCompany?.id;
    const updated = vendorBills.map(bill =>
      bill.id === id ? { ...bill, ...billData } : bill
    );
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

  // Customer Invoices CRUD
  const createCustomerInvoice = useCallback(async (invoiceData) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        const newInvoice = await salesService.createInvoice({
          ...invoiceData,
          company_id: companyId
        });
        setCustomerInvoices(prev => [newInvoice, ...prev]);
        return newInvoice;
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const newInvoice = {
      id: `ci_${Date.now()}`,
      invoice_type: 'customer_invoice',
      invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`,
      ...invoiceData,
      company_id: companyId,
      created_date: new Date().toISOString()
    };
    const updated = [newInvoice, ...customerInvoices];
    localStorage.setItem(getStorageKey(CUSTOMER_INVOICES_KEY, companyId), JSON.stringify(updated));
    setCustomerInvoices(updated);
    return newInvoice;
  }, [backendAvailable, customerInvoices, activeCompany]);

  const updateCustomerInvoice = useCallback(async (id, invoiceData) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        await salesService.updateInvoice(id, invoiceData);
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const updated = customerInvoices.map(inv =>
      inv.id === id ? { ...inv, ...invoiceData } : inv
    );
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

  // Financial Transactions
  const listFinancialTransactions = useCallback((sortField, limit) => {
    let sorted = [...financialTransactions];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [financialTransactions]);

  // Financial Reports from API
  const getBalanceSheet = useCallback(async (params = {}) => {
    if (backendAvailable) {
      try {
        return await financeService.getBalanceSheet(params);
      } catch (err) {
        console.error('API error:', err);
      }
    }
    return null;
  }, [backendAvailable]);

  const getIncomeStatement = useCallback(async (params = {}) => {
    if (backendAvailable) {
      try {
        return await financeService.getIncomeStatement(params);
      } catch (err) {
        console.error('API error:', err);
      }
    }
    return null;
  }, [backendAvailable]);

  const getCashFlow = useCallback(async (params = {}) => {
    if (backendAvailable) {
      try {
        return await financeService.getCashFlow(params);
      } catch (err) {
        console.error('API error:', err);
      }
    }
    return null;
  }, [backendAvailable]);

  return (
    <FinancialsContext.Provider value={{
      journalEntries,
      journalLines,
      createJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      listJournalEntries,
      getJournalLines,
      createJournalLine,
      vendorBills,
      createVendorBill,
      updateVendorBill,
      listVendorBills,
      customerInvoices,
      createCustomerInvoice,
      updateCustomerInvoice,
      listCustomerInvoices,
      financialTransactions,
      listFinancialTransactions,
      getBalanceSheet,
      getIncomeStatement,
      getCashFlow,
      isLoading,
      backendAvailable,
      error,
      refreshData: loadData
    }}>
      {children}
    </FinancialsContext.Provider>
  );
}

export function useFinancials() {
  const context = useContext(FinancialsContext);
  if (!context) {
    throw new Error('useFinancials must be used within FinancialsProvider');
  }
  return context;
}
