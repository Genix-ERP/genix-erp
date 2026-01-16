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

  // Get settings history/audit log
  async getSettingsHistory(companyId, params = {}) {
    try {
      const response = await apiClient.get('/admin/settings/history', {
        params: { company_id: companyId, ...params }
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching settings history:', error);
      throw error;
    }
  },

  // Export settings as JSON
  async exportSettings(companyId) {
    try {
      const response = await apiClient.get('/admin/settings/export', {
        params: { company_id: companyId },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting settings:', error);
      throw error;
    }
  },

  // Import settings from JSON
  async importSettings(companyId, settingsData) {
    try {
      const response = await apiClient.post('/admin/settings/import', {
        company_id: companyId,
        settings: settingsData
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error importing settings:', error);
      throw error;
    }
  }
};

export default adminSettingsService;
