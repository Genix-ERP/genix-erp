import apiClient from '../client';

export const adminSettingsService = {
  // Get all settings for a company
  async getSettings(companyId) {
    try {
      const response = await apiClient.get('/admin/settings', {
        params: { company_id: companyId }
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching admin settings:', error);
      throw error;
    }
  },

  // Update entire settings object
  async updateSettings(companyId, settings) {
    try {
      const response = await apiClient.put('/admin/settings', {
        company_id: companyId,
        settings
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error updating admin settings:', error);
      throw error;
    }
  },

  // Update specific section (e.g., 'inventory', 'sales', 'crm')
  async updateSection(companyId, section, sectionData) {
    try {
      const response = await apiClient.patch(`/admin/settings/${section}`, {
        company_id: companyId,
        data: sectionData
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error(`Error updating ${section} settings:`, error);
      throw error;
    }
  },

  // Reset section to defaults
  async resetSection(companyId, section) {
    try {
      const response = await apiClient.post(`/admin/settings/${section}/reset`, {
        company_id: companyId
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error(`Error resetting ${section} settings:`, error);
      throw error;
    }
  },

  // Reset all settings to defaults
  async resetAllSettings(companyId) {
    try {
      const response = await apiClient.post('/admin/settings/reset', {
        company_id: companyId
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error resetting all settings:', error);
      throw error;
    }
  },

  // No history/export/import methods here: /admin/settings/history, /export
  // and /import were never routes on the server, and no screen called these —
  // the AdminSettings page's export/import buttons use the context's
  // client-side JSON versions (AdminSettingsContext.jsx), not the API.

  // --- AI settings (tenant-wide; the API key is never returned in full) ---

  // Returns { provider, model, has_key, key_preview }
  async getAISettings() {
    const response = await apiClient.get('/admin/ai-settings');
    return response.data.data || response.data;
  },

  // payload: { provider, model, api_key?, clear_key? }
  // Omit api_key (or send "") to keep the existing stored key.
  async updateAISettings(payload) {
    const response = await apiClient.put('/admin/ai-settings', payload);
    return response.data.data || response.data;
  }
};

export default adminSettingsService;
