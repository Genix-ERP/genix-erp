import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { contactsService, leadsService, opportunitiesService, activitiesService, tasksService, leadConversionService, pipelineStagesService } from '@/api/services';
import { useCompany } from './CompanyContext';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';

const STORAGE_KEY = 'genix_customers';
const PARTNERS_STORAGE_KEY = 'genix_partners';
const LEADS_STORAGE_KEY = 'genix_leads';
const OPPORTUNITIES_STORAGE_KEY = 'genix_opportunities';
const ACTIVITIES_STORAGE_KEY = 'genix_activities';
const TASKS_STORAGE_KEY = 'genix_tasks';
const PIPELINE_STAGES_STORAGE_KEY = 'genix_pipeline_stages';

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

// Sample activities for demo
const sampleActivities = [
  { id: 'act_1', activity_type: 'call', subject: 'Follow-up call with Tech Solutions', status: 'completed', start_datetime: new Date().toISOString() },
  { id: 'act_2', activity_type: 'meeting', subject: 'Demo presentation', status: 'planned', start_datetime: new Date(Date.now() + 86400000).toISOString() },
  { id: 'act_3', activity_type: 'email', subject: 'Send proposal document', status: 'completed', start_datetime: new Date().toISOString() }
];

// Sample tasks for demo
const sampleTasks = [
  { id: 'task_1', title: 'Prepare quarterly report', task_type: 'general', priority: 'high', status: 'in_progress', due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
  { id: 'task_2', title: 'Review contract terms', task_type: 'review', priority: 'medium', status: 'pending', due_date: new Date(Date.now() + 172800000).toISOString().split('T')[0] },
  { id: 'task_3', title: 'Schedule client meeting', task_type: 'meeting', priority: 'high', status: 'pending', due_date: new Date().toISOString().split('T')[0] }
];

// Default pipeline stages
const defaultPipelineStages = [
  { id: 'stage_1', name: 'Qualification', code: 'qualification', sequence: 1, probability: 10, is_won: false, is_lost: false, color: '#6B7280' },
  { id: 'stage_2', name: 'Needs Analysis', code: 'needs_analysis', sequence: 2, probability: 25, is_won: false, is_lost: false, color: '#3B82F6' },
  { id: 'stage_3', name: 'Proposal', code: 'proposal', sequence: 3, probability: 50, is_won: false, is_lost: false, color: '#8B5CF6' },
  { id: 'stage_4', name: 'Negotiation', code: 'negotiation', sequence: 4, probability: 75, is_won: false, is_lost: false, color: '#F59E0B' },
  { id: 'stage_5', name: 'Closed Won', code: 'closed_won', sequence: 5, probability: 100, is_won: true, is_lost: false, color: '#10B981' },
  { id: 'stage_6', name: 'Closed Lost', code: 'closed_lost', sequence: 6, probability: 0, is_won: false, is_lost: true, color: '#EF4444' },
];

export function CustomersProvider({ children }) {
  const { activeCompany } = useCompany();
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [pipelineStages, setPipelineStages] = useState(defaultPipelineStages);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

  const loadFromLocalStorage = useCallback(() => {
    const companyId = activeCompany?.id;
    const demoMode = isDemoMode();

    const customersKey = getStorageKey(STORAGE_KEY, companyId);
    const leadsKey = getStorageKey(LEADS_STORAGE_KEY, companyId);
    const opportunitiesKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);
    const activitiesKey = getStorageKey(ACTIVITIES_STORAGE_KEY, companyId);
    const tasksKey = getStorageKey(TASKS_STORAGE_KEY, companyId);
    const pipelineKey = getStorageKey(PIPELINE_STAGES_STORAGE_KEY, companyId);

    const getData = (storageKey, sampleData) => {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
      return demoMode ? sampleData : [];
    };

    setCustomers(getData(customersKey, sampleCustomers));
    setLeads(getData(leadsKey, sampleLeads));
    setOpportunities(getData(opportunitiesKey, sampleOpportunities));
    setActivities(getData(activitiesKey, sampleActivities));
    setTasks(getData(tasksKey, sampleTasks));
    setPipelineStages(getData(pipelineKey, defaultPipelineStages));

    // Initialize localStorage if empty - only in demo mode
    if (demoMode) {
      if (!localStorage.getItem(customersKey)) localStorage.setItem(customersKey, JSON.stringify(sampleCustomers));
      if (!localStorage.getItem(leadsKey)) localStorage.setItem(leadsKey, JSON.stringify(sampleLeads));
      if (!localStorage.getItem(opportunitiesKey)) localStorage.setItem(opportunitiesKey, JSON.stringify(sampleOpportunities));
      if (!localStorage.getItem(activitiesKey)) localStorage.setItem(activitiesKey, JSON.stringify(sampleActivities));
      if (!localStorage.getItem(tasksKey)) localStorage.setItem(tasksKey, JSON.stringify(sampleTasks));
      if (!localStorage.getItem(pipelineKey)) localStorage.setItem(pipelineKey, JSON.stringify(defaultPipelineStages));
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
          const contacts = await contactsService.list({ type: 'customer' });
          const contactsArray = Array.isArray(contacts) ? contacts : (contacts?.items || []);
          const customerContacts = contactsArray.filter(c => c.type === 'customer' || !c.type);

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
            // Map backend response to frontend format
            const mappedCustomers = customerContacts.map(c => {
              // Extract CRM fields from custom_fields if available
              const customFields = c.custom_fields || {};
              // Map billing_address (backend uses street1/postal_code, frontend uses street/zip)
              const billingAddr = c.billing_address || {};
              const address = {
                street: billingAddr.street1 || billingAddr.street || '',
                city: billingAddr.city || '',
                state: billingAddr.state || '',
                zip: billingAddr.postal_code || billingAddr.zip || '',
                country: billingAddr.country || ''
              };
              return {
                id: c.id,
                company_name: c.name || '',
                contact_name: c.legal_name || '',
                email: c.email || '',
                phone: c.phone || '',
                industry: c.industry || (c.tags && c.tags[0]) || 'other',
                status: customFields.status || (c.tags && c.tags.find(t => ['prospect', 'active', 'inactive', 'churned'].includes(t))) || (c.is_active ? 'active' : 'inactive'),
                annual_revenue: customFields.annual_revenue || c.annual_revenue || 0,
                employee_count: customFields.employee_count || c.employee_count || 0,
                monthly_value: customFields.monthly_value || c.monthly_value || 0,
                subscription_tier: customFields.subscription_tier || c.subscription_tier || 'freemium',
                address: address,
                created_date: c.created_at || new Date().toISOString()
              };
            });
            setCustomers(mappedCustomers);
          }

          // Load leads from API
          const apiLeads = await leadsService.list(companyId);
          const leadsArray = Array.isArray(apiLeads) ? apiLeads : [];

          // If API returns empty, check localStorage for any locally stored leads
          if (leadsArray.length === 0) {
            const leadsKey = getStorageKey(LEADS_STORAGE_KEY, companyId);
            const localLeads = localStorage.getItem(leadsKey);
            if (localLeads) {
              setLeads(JSON.parse(localLeads));
            } else {
              setLeads(demoMode ? sampleLeads : []);
            }
          } else {
            setLeads(leadsArray);
          }

          // Load opportunities from API
          const apiOpportunities = await opportunitiesService.list(companyId);
          const opportunitiesArray = Array.isArray(apiOpportunities) ? apiOpportunities : [];
          if (opportunitiesArray.length === 0) {
            const opportunitiesKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);
            const localOpportunities = localStorage.getItem(opportunitiesKey);
            if (localOpportunities) {
              setOpportunities(JSON.parse(localOpportunities));
            } else {
              setOpportunities(demoMode ? sampleOpportunities : []);
            }
          } else {
            setOpportunities(opportunitiesArray);
          }

          // Load activities from API
          const apiActivities = await activitiesService.list(companyId);
          const activitiesArray = Array.isArray(apiActivities) ? apiActivities : [];
          if (activitiesArray.length === 0) {
            const activitiesKey = getStorageKey(ACTIVITIES_STORAGE_KEY, companyId);
            const localActivities = localStorage.getItem(activitiesKey);
            if (localActivities) {
              setActivities(JSON.parse(localActivities));
            } else {
              setActivities(demoMode ? sampleActivities : []);
            }
          } else {
            setActivities(activitiesArray);
          }

          // Load tasks from API
          const apiTasks = await tasksService.list(companyId, { include_completed: true });
          const tasksArray = Array.isArray(apiTasks) ? apiTasks : [];
          if (tasksArray.length === 0) {
            const tasksKey = getStorageKey(TASKS_STORAGE_KEY, companyId);
            const localTasks = localStorage.getItem(tasksKey);
            if (localTasks) {
              setTasks(JSON.parse(localTasks));
            } else {
              setTasks(demoMode ? sampleTasks : []);
            }
          } else {
            setTasks(tasksArray);
          }

          // Load pipeline stages from API
          const apiStages = await pipelineStagesService.list(companyId);
          const stagesArray = Array.isArray(apiStages) ? apiStages : [];
          if (stagesArray.length > 0) {
            setPipelineStages(stagesArray);
          } else {
            setPipelineStages(defaultPipelineStages);
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

  // Customer CRUD - uses backend with localStorage as cache
  const createCustomer = useCallback(async (customerData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    // Map frontend fields to backend expected format
    // Generate a unique code for the customer
    const customerName = customerData.company_name || customerData.name || 'CUST';
    const code = customerData.code || `CUST-${customerName.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    const backendData = {
      type: 'customer',
      code: code,
      name: customerName,
      legal_name: customerData.contact_name || '',
      email: customerData.email || '',
      phone: customerData.phone || '',
      industry: customerData.industry || '',
      billing_address: customerData.address ? {
        street1: customerData.address.street || '',
        city: customerData.address.city || '',
        state: customerData.address.state || '',
        postal_code: customerData.address.zip || '',
        country: customerData.address.country || ''
      } : null,
      notes: customerData.notes || '',
      tags: customerData.status ? [customerData.status] : [],
      // Store additional CRM fields in custom_fields
      custom_fields: {
        annual_revenue: customerData.annual_revenue || 0,
        employee_count: customerData.employee_count || 0,
        monthly_value: customerData.monthly_value || 0,
        subscription_tier: customerData.subscription_tier || 'freemium',
        status: customerData.status || 'prospect'
      }
    };

    try {
      const result = await contactsService.create(backendData);

      // Map backend response back to frontend format for consistent state
      const newCustomer = {
        id: result.id,
        company_name: result.name,
        contact_name: result.legal_name || '',
        email: result.email || '',
        phone: result.phone || '',
        industry: customerData.industry || '',
        status: customerData.status || 'prospect',
        annual_revenue: customerData.annual_revenue || 0,
        employee_count: customerData.employee_count || 0,
        monthly_value: customerData.monthly_value || 0,
        subscription_tier: customerData.subscription_tier || 'freemium',
        address: customerData.address || {},
        company_id: companyId,
        created_date: result.created_at || new Date().toISOString()
      };

      // Update state and localStorage cache
      const updated = [...customers, newCustomer];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setCustomers(updated);
      return newCustomer;
    } catch (err) {
      console.error('API error creating customer:', err);
      throw err;
    }
  }, [customers, activeCompany]);

  const updateCustomer = useCallback(async (id, customerData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        // Map frontend fields to backend expected format
        const backendData = {};
        if (customerData.company_name !== undefined) backendData.name = customerData.company_name;
        if (customerData.contact_name !== undefined) backendData.legal_name = customerData.contact_name;
        if (customerData.email !== undefined) backendData.email = customerData.email;
        if (customerData.phone !== undefined) backendData.phone = customerData.phone;
        if (customerData.industry !== undefined) backendData.industry = customerData.industry;
        if (customerData.address !== undefined) {
          backendData.billing_address = {
            street1: customerData.address.street || '',
            city: customerData.address.city || '',
            state: customerData.address.state || '',
            postal_code: customerData.address.zip || '',
            country: customerData.address.country || ''
          };
        }

        // Store CRM fields in custom_fields
        const customFields = {};
        if (customerData.annual_revenue !== undefined) customFields.annual_revenue = customerData.annual_revenue;
        if (customerData.employee_count !== undefined) customFields.employee_count = customerData.employee_count;
        if (customerData.monthly_value !== undefined) customFields.monthly_value = customerData.monthly_value;
        if (customerData.subscription_tier !== undefined) customFields.subscription_tier = customerData.subscription_tier;
        if (customerData.status !== undefined) customFields.status = customerData.status;

        if (Object.keys(customFields).length > 0) {
          backendData.custom_fields = customFields;
        }

        await contactsService.update(id, backendData);
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

  // Opportunity CRUD - uses opportunitiesService for API calls with localStorage fallback
  const createOpportunity = useCallback(async (oppData) => {
    const companyId = activeCompany?.id;

    try {
      const newOpp = await opportunitiesService.create(oppData, companyId);
      setOpportunities(prev => [newOpp, ...prev]);
      return newOpp;
    } catch (error) {
      console.error('Failed to create opportunity:', error);
      const storageKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);
      const localOpp = {
        id: `opp_${Date.now()}`,
        ...oppData,
        company_id: companyId,
        created_at: new Date().toISOString()
      };
      const updated = [localOpp, ...opportunities];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setOpportunities(updated);
      return localOpp;
    }
  }, [opportunities, activeCompany]);

  const updateOpportunity = useCallback(async (id, oppData) => {
    const companyId = activeCompany?.id;

    try {
      const updatedOpp = await opportunitiesService.update(id, oppData, companyId);
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, ...oppData, ...updatedOpp } : o));
      return updatedOpp;
    } catch (error) {
      console.error('Failed to update opportunity:', error);
      const storageKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);
      const updated = opportunities.map(o => o.id === id ? { ...o, ...oppData } : o);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setOpportunities(updated);
    }
  }, [opportunities, activeCompany]);

  const deleteOpportunity = useCallback(async (id) => {
    const companyId = activeCompany?.id;

    try {
      await opportunitiesService.delete(id, companyId);
      setOpportunities(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Failed to delete opportunity:', error);
      const storageKey = getStorageKey(OPPORTUNITIES_STORAGE_KEY, companyId);
      const updated = opportunities.filter(o => o.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setOpportunities(updated);
    }
  }, [opportunities, activeCompany]);

  // Activity CRUD - uses activitiesService for API calls with localStorage fallback
  const createActivity = useCallback(async (activityData) => {
    const companyId = activeCompany?.id;

    try {
      const newActivity = await activitiesService.create(activityData, companyId);
      setActivities(prev => [newActivity, ...prev]);
      return newActivity;
    } catch (error) {
      console.error('Failed to create activity:', error);
      const storageKey = getStorageKey(ACTIVITIES_STORAGE_KEY, companyId);
      const localActivity = {
        id: `act_${Date.now()}`,
        ...activityData,
        company_id: companyId,
        created_at: new Date().toISOString()
      };
      const updated = [localActivity, ...activities];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setActivities(updated);
      return localActivity;
    }
  }, [activities, activeCompany]);

  const updateActivity = useCallback(async (id, activityData) => {
    const companyId = activeCompany?.id;

    try {
      const updatedActivity = await activitiesService.update(id, activityData, companyId);
      setActivities(prev => prev.map(a => a.id === id ? { ...a, ...activityData, ...updatedActivity } : a));
      return updatedActivity;
    } catch (error) {
      console.error('Failed to update activity:', error);
      const storageKey = getStorageKey(ACTIVITIES_STORAGE_KEY, companyId);
      const updated = activities.map(a => a.id === id ? { ...a, ...activityData } : a);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setActivities(updated);
    }
  }, [activities, activeCompany]);

  const deleteActivity = useCallback(async (id) => {
    const companyId = activeCompany?.id;

    try {
      await activitiesService.delete(id, companyId);
      setActivities(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete activity:', error);
      const storageKey = getStorageKey(ACTIVITIES_STORAGE_KEY, companyId);
      const updated = activities.filter(a => a.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setActivities(updated);
    }
  }, [activities, activeCompany]);

  const completeActivity = useCallback(async (id, outcome) => {
    return updateActivity(id, { status: 'completed', outcome });
  }, [updateActivity]);

  // Task CRUD - uses tasksService for API calls with localStorage fallback
  const createTask = useCallback(async (taskData) => {
    const companyId = activeCompany?.id;

    try {
      const newTask = await tasksService.create(taskData, companyId);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (error) {
      console.error('Failed to create task:', error);
      const storageKey = getStorageKey(TASKS_STORAGE_KEY, companyId);
      const localTask = {
        id: `task_${Date.now()}`,
        ...taskData,
        status: taskData.status || 'pending',
        priority: taskData.priority || 'medium',
        company_id: companyId,
        created_at: new Date().toISOString()
      };
      const updated = [localTask, ...tasks];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setTasks(updated);
      return localTask;
    }
  }, [tasks, activeCompany]);

  const updateTask = useCallback(async (id, taskData) => {
    const companyId = activeCompany?.id;

    try {
      const updatedTask = await tasksService.update(id, taskData, companyId);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...taskData, ...updatedTask } : t));
      return updatedTask;
    } catch (error) {
      console.error('Failed to update task:', error);
      const storageKey = getStorageKey(TASKS_STORAGE_KEY, companyId);
      const updated = tasks.map(t => t.id === id ? { ...t, ...taskData } : t);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setTasks(updated);
    }
  }, [tasks, activeCompany]);

  const deleteTask = useCallback(async (id) => {
    const companyId = activeCompany?.id;

    try {
      await tasksService.delete(id, companyId);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete task:', error);
      const storageKey = getStorageKey(TASKS_STORAGE_KEY, companyId);
      const updated = tasks.filter(t => t.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setTasks(updated);
    }
  }, [tasks, activeCompany]);

  const completeTask = useCallback(async (id) => {
    const companyId = activeCompany?.id;

    try {
      const result = await tasksService.complete(id, companyId);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed', progress_percent: 100, completed_at: new Date().toISOString() } : t));
      return result;
    } catch (error) {
      console.error('Failed to complete task:', error);
      return updateTask(id, { status: 'completed', progress_percent: 100, completed_at: new Date().toISOString() });
    }
  }, [activeCompany, updateTask]);

  // Lead conversion
  const convertLead = useCallback(async (leadId, options) => {
    const companyId = activeCompany?.id;

    try {
      const result = await leadConversionService.convert(leadId, options, companyId);
      // Refresh data after conversion
      await loadData();
      return result;
    } catch (error) {
      console.error('Failed to convert lead:', error);
      throw error;
    }
  }, [activeCompany, loadData]);

  return (
    <CustomersContext.Provider value={{
      // State
      customers,
      leads,
      opportunities,
      activities,
      tasks,
      pipelineStages,
      isLoading,
      backendAvailable,
      error,
      // Customer CRUD
      createCustomer,
      updateCustomer,
      deleteCustomer,
      // Lead CRUD
      createLead,
      updateLead,
      deleteLead,
      convertLead,
      // Opportunity CRUD
      createOpportunity,
      updateOpportunity,
      deleteOpportunity,
      // Activity CRUD
      createActivity,
      updateActivity,
      deleteActivity,
      completeActivity,
      // Task CRUD
      createTask,
      updateTask,
      deleteTask,
      completeTask,
      // Refresh
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
