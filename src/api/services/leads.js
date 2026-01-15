import apiClient from '../client';
import { checkBackendHealth, isDemoMode } from '@/config/dataMode';

// Leads stored in localStorage (fallback)
const LEADS_KEY = 'genix_leads';

// Get storage key with company ID
const getStorageKey = (companyId) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return companyId ? `${prefix}${LEADS_KEY}_${companyId}` : `${prefix}${LEADS_KEY}`;
};

// Get leads from localStorage (fallback)
const getLocalLeads = (companyId) => {
  const key = getStorageKey(companyId);
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

// Save leads to localStorage
const saveLocalLeads = (leads, companyId) => {
  const key = getStorageKey(companyId);
  localStorage.setItem(key, JSON.stringify(leads));
};

export const leadsService = {
  // Get all leads
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/leads', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch leads from API, using local storage:', error);
    }
    // Fallback to localStorage
    return getLocalLeads(companyId);
  },

  // Get a single lead by ID
  async get(leadId, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/leads/${leadId}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch lead from API:', error);
    }
    // Fallback: find in localStorage
    const leads = getLocalLeads(companyId);
    return leads.find(l => l.id === leadId);
  },

  // Create a new lead
  async create(leadData, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/leads', leadData);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create lead via API, saving locally:', error);
    }
    // Fallback: save locally
    const localLead = {
      id: `lead_${Date.now()}`,
      ...leadData,
      company_id: companyId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const leads = getLocalLeads(companyId);
    leads.unshift(localLead);
    saveLocalLeads(leads, companyId);
    return localLead;
  },

  // Update an existing lead
  async update(leadId, updates, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/leads/${leadId}`, updates);
        return response.data.data || { id: leadId, ...updates };
      }
    } catch (error) {
      console.warn('Failed to update lead via API, updating locally:', error);
    }
    // Fallback: update localStorage
    const leads = getLocalLeads(companyId);
    const index = leads.findIndex(l => l.id === leadId);
    if (index !== -1) {
      leads[index] = {
        ...leads[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      saveLocalLeads(leads, companyId);
      return leads[index];
    }
    return null;
  },

  // Delete a lead
  async delete(leadId, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/leads/${leadId}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete lead via API:', error);
    }
    // Fallback: remove from localStorage
    const leads = getLocalLeads(companyId);
    const filtered = leads.filter(l => l.id !== leadId);
    saveLocalLeads(filtered, companyId);
    return true;
  },

  // Get lead statistics
  async getStats(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/leads/stats', { params });
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch lead stats from API:', error);
    }
    // Fallback: calculate from local data
    const leads = getLocalLeads(companyId);
    return {
      total_leads: leads.length,
      new_leads: leads.filter(l => l.status === 'new').length,
      contacted_leads: leads.filter(l => l.status === 'contacted').length,
      in_progress_leads: leads.filter(l => l.status === 'in_progress').length,
      qualified_leads: leads.filter(l => l.status === 'qualified').length,
      lost_leads: leads.filter(l => l.status === 'lost').length,
      conversion_rate: leads.length > 0
        ? (leads.filter(l => l.status === 'qualified').length / leads.length) * 100
        : 0,
      total_value: leads.reduce((sum, l) => sum + (l.expected_value || 0), 0)
    };
  },

  // Bulk update leads (for drag & drop status changes)
  async bulkUpdateStatus(leadIds, newStatus, companyId) {
    const updates = [];
    for (const leadId of leadIds) {
      const result = await this.update(leadId, { status: newStatus }, companyId);
      if (result) updates.push(result);
    }
    return updates;
  },

  // Convert lead to contact/customer
  async convertToCustomer(leadId, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/leads/${leadId}/convert`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to convert lead via API:', error);
    }
    // Fallback: update status to qualified locally
    return this.update(leadId, { status: 'qualified' }, companyId);
  }
};

export default leadsService;
