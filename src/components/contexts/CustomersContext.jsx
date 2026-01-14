import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { contactsService, leadsService } from '@/api/services';
import { useCompany } from './CompanyContext';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';

const STORAGE_KEY = 'genix_customers';
const PARTNERS_STORAGE_KEY = 'genix_partners';
const LEADS_STORAGE_KEY = 'genix_leads';
const OPPORTUNITIES_STORAGE_KEY = 'genix_opportunities';

const CustomersContext = createContext();

// Helper to get company-specific storage key with demo prefix
const getStorageKey = (baseKey, companyId) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return companyId ? `${prefix}${baseKey}_${companyId}` : `${prefix}${baseKey}`;
};

// Sample data for demo purposes
const sampleCustomers = [
  {
    id: 'cust_1',
    company_name: 'Tech Solutions Inc',
    contact_name: 'John Smith',
    email: 'john@techsolutions.com',
    phone: '+1 555-0101',
    industry: 'technology',
    status: 'active',
    annual_revenue: 500000,
    employee_count: 25,
    monthly_value: 2500,
    subscription_tier: 'professional',
    address: { street: '123 Tech Ave', city: 'San Francisco', state: 'CA', zip: '94105', country: 'USA' },
    created_date: new Date().toISOString()
  },
  {
    id: 'cust_2',
    company_name: 'Healthcare Plus',
    contact_name: 'Sarah Johnson',
    email: 'sarah@healthcareplus.com',
    phone: '+1 555-0102',
    industry: 'healthcare',
    status: 'active',
    annual_revenue: 1200000,
    employee_count: 50,
    monthly_value: 5000,
    subscription_tier: 'enterprise',
    address: { street: '456 Medical Dr', city: 'Boston', state: 'MA', zip: '02101', country: 'USA' },
    created_date: new Date().toISOString()
  },
  {
    id: 'cust_3',
    company_name: 'Retail Masters',
    contact_name: 'Mike Chen',
    email: 'mike@retailmasters.com',
    phone: '+1 555-0103',
    industry: 'retail',
    status: 'prospect',
    annual_revenue: 300000,
    employee_count: 15,
    monthly_value: 1000,
    subscription_tier: 'basic',
    address: { street: '789 Shop St', city: 'New York', state: 'NY', zip: '10001', country: 'USA' },
    created_date: new Date().toISOString()
  }
];

const sampleLeads = [
  { id: 'lead_1', name: 'New Prospect A', company: 'ABC Corp', email: 'contact@abc.com', status: 'new', source: 'website', created_date: new Date().toISOString() },
  { id: 'lead_2', name: 'New Prospect B', company: 'XYZ Ltd', email: 'info@xyz.com', status: 'qualified', source: 'referral', created_date: new Date().toISOString() },
  { id: 'lead_3', name: 'Hot Lead', company: 'Big Corp', email: 'sales@bigcorp.com', status: 'qualified', source: 'trade_show', created_date: new Date().toISOString() }
];

const sampleOpportunities = [
  { id: 'opp_1', name: 'Enterprise Deal - ABC Corp', stage: 'qualification', expected_value: 50000, probability: 20, expected_close_date: '2025-02-15', created_date: new Date().toISOString() },
  { id: 'opp_2', name: 'Software License - XYZ', stage: 'proposal', expected_value: 25000, probability: 50, expected_close_date: '2025-01-30', created_date: new Date().toISOString() },
  { id: 'opp_3', name: 'Consulting Project', stage: 'negotiation', expected_value: 75000, probability: 70, expected_close_date: '2025-01-20', created_date: new Date().toISOString() },
  { id: 'opp_4', name: 'Annual Contract Renewal', stage: 'closed_won', expected_value: 30000, probability: 100, expected_close_date: '2025-01-10', created_date: new Date().toISOString() },
  { id: 'opp_5', name: 'New Market Expansion', stage: 'needs_analysis', expected_value: 100000, probability: 30, expected_close_date: '2025-03-01', created_date: new Date().toISOString() }
];

export function CustomersProvider({ children }) {
  const { activeCompany } = useCompany();
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

  const loadFromLocalStorage = useCallback(() => {
    const companyId = activeCompany?.id;
    const demoMode = isDemoMode();

    const customersKey = getStorageKey(STORAGE_KEY, companyId);
    const leadsKey = getStorageKey(LEADS_STORAGE_KEY, companyId);
    const opportunitiesKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);

    const getData = (storageKey, sampleData) => {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
      return demoMode ? sampleData : [];
    };

    setCustomers(getData(customersKey, sampleCustomers));
    setLeads(getData(leadsKey, sampleLeads));
    setOpportunities(getData(opportunitiesKey, sampleOpportunities));

    // Initialize localStorage if empty - only in demo mode
    if (demoMode) {
      if (!localStorage.getItem(customersKey)) localStorage.setItem(customersKey, JSON.stringify(sampleCustomers));
      if (!localStorage.getItem(leadsKey)) localStorage.setItem(leadsKey, JSON.stringify(sampleLeads));
      if (!localStorage.getItem(opportunitiesKey)) localStorage.setItem(opportunitiesKey, JSON.stringify(sampleOpportunities));
    }
  }, [activeCompany]);

  const loadData = useCallback(async () => {
    if (!activeCompany) return; // Wait for company to be loaded

    setIsLoading(true);
    setError(null);

    try {
      const isAvailable = await checkBackendHealth();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        try {
          const companyId = activeCompany?.id;
          const demoMode = isDemoMode();

          // Load contacts (customers) from API
          const contacts = await contactsService.list();
          const customerContacts = (contacts || []).filter(c => c.contact_type === 'customer' || !c.contact_type);

          // If API returns empty, check localStorage for any locally stored customers
          if (customerContacts.length === 0) {
            const customersKey = getStorageKey(STORAGE_KEY, companyId);
            const localCustomers = localStorage.getItem(customersKey);
            if (localCustomers) {
              setCustomers(JSON.parse(localCustomers));
            } else {
              setCustomers(demoMode ? sampleCustomers : []);
            }
          } else {
            setCustomers(customerContacts);
          }

          // Load leads from API
          const apiLeads = await leadsService.list(companyId);

          // If API returns empty, check localStorage for any locally stored leads
          if (apiLeads.length === 0) {
            const leadsKey = getStorageKey(LEADS_STORAGE_KEY, companyId);
            const localLeads = localStorage.getItem(leadsKey);
            if (localLeads) {
              setLeads(JSON.parse(localLeads));
            } else {
              setLeads(demoMode ? sampleLeads : []);
            }
          } else {
            setLeads(apiLeads);
          }
        } catch (apiError) {
          console.warn('API call failed, falling back to localStorage:', apiError);
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    } catch (err) {
      console.error('Error loading CRM data:', err);
      setError(err.message);
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadFromLocalStorage]);

  // Load data when active company changes
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

  // Customer CRUD - always saves to localStorage for persistence
  const createCustomer = useCallback(async (customerData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    let newCustomer;

    if (backendAvailable) {
      try {
        newCustomer = await contactsService.create({
          ...customerData,
          contact_type: 'customer',
          company_id: companyId
        });
      } catch (err) {
        console.error('API error, falling back to local:', err);
      }
    }

    // If API call failed or backend not available, create local customer
    if (!newCustomer) {
      newCustomer = {
        id: `cust_${Date.now()}`,
        ...customerData,
        company_id: companyId,
        created_date: new Date().toISOString()
      };
    }

    // Always update state and localStorage
    const updated = [...customers, newCustomer];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCustomers(updated);
    return newCustomer;
  }, [backendAvailable, customers, activeCompany]);

  const updateCustomer = useCallback(async (id, customerData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        await contactsService.update(id, customerData);
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const updated = customers.map(c => c.id === id ? { ...c, ...customerData } : c);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCustomers(updated);
  }, [backendAvailable, customers, activeCompany]);

  const deleteCustomer = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        await contactsService.delete(id);
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const updated = customers.filter(c => c.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCustomers(updated);
  }, [backendAvailable, customers, activeCompany]);

  // Lead CRUD - uses leadsService for API calls with localStorage fallback
  const createLead = useCallback(async (leadData) => {
    const companyId = activeCompany?.id;

    try {
      const newLead = await leadsService.create(leadData, companyId);
      setLeads(prev => [newLead, ...prev]);
      return newLead;
    } catch (error) {
      console.error('Failed to create lead:', error);
      // Fallback to local storage
      const storageKey = getStorageKey(LEADS_STORAGE_KEY, companyId);
      const localLead = {
        id: `lead_${Date.now()}`,
        ...leadData,
        company_id: companyId,
        created_at: new Date().toISOString()
      };
      const updated = [localLead, ...leads];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setLeads(updated);
      return localLead;
    }
  }, [leads, activeCompany]);

  const updateLead = useCallback(async (id, leadData) => {
    const companyId = activeCompany?.id;

    try {
      const updatedLead = await leadsService.update(id, leadData, companyId);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...leadData, ...updatedLead } : l));
      return updatedLead;
    } catch (error) {
      console.error('Failed to update lead:', error);
      // Fallback to local storage
      const storageKey = getStorageKey(LEADS_STORAGE_KEY, companyId);
      const updated = leads.map(l => l.id === id ? { ...l, ...leadData } : l);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setLeads(updated);
    }
  }, [leads, activeCompany]);

  const deleteLead = useCallback(async (id) => {
    const companyId = activeCompany?.id;

    try {
      await leadsService.delete(id, companyId);
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Failed to delete lead:', error);
      // Fallback to local storage
      const storageKey = getStorageKey(LEADS_STORAGE_KEY, companyId);
      const updated = leads.filter(l => l.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setLeads(updated);
    }
  }, [leads, activeCompany]);

  // Opportunity CRUD (local only for now)
  const createOpportunity = useCallback((oppData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);

    const newOpp = {
      id: `opp_${Date.now()}`,
      ...oppData,
      company_id: companyId,
      created_date: new Date().toISOString()
    };
    const updated = [...opportunities, newOpp];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setOpportunities(updated);
    return newOpp;
  }, [opportunities, activeCompany]);

  const updateOpportunity = useCallback((id, oppData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);

    const updated = opportunities.map(o => o.id === id ? { ...o, ...oppData } : o);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setOpportunities(updated);
  }, [opportunities, activeCompany]);

  const deleteOpportunity = useCallback((id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);

    const updated = opportunities.filter(o => o.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setOpportunities(updated);
  }, [opportunities, activeCompany]);

  return (
    <CustomersContext.Provider value={{
      customers,
      leads,
      opportunities,
      isLoading,
      backendAvailable,
      error,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      createLead,
      updateLead,
      deleteLead,
      createOpportunity,
      updateOpportunity,
      deleteOpportunity,
      refreshData: loadData
    }}>
      {children}
    </CustomersContext.Provider>
  );
}

export function useCustomers() {
  const context = useContext(CustomersContext);
  if (!context) {
    throw new Error('useCustomers must be used within CustomersProvider');
  }
  return context;
}
