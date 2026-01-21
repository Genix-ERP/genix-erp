import apiClient from '../client';

export const installedAppsService = {
  // Get all installed apps for the current tenant
  async getInstalledApps() {
    try {
      const response = await apiClient.get('/installed-apps');
      return response.data.data || response.data || [];
    } catch (error) {
      console.error('Error fetching installed apps:', error);
      throw error;
    }
  },

  // Install a new app
  async installApp(appData) {
    try {
      const response = await apiClient.post('/installed-apps', {
        app_id: appData.app_id,
        app_name: appData.app_name,
        app_description: appData.app_description || '',
        app_version: appData.app_version || '1.0',
        app_icon: appData.app_icon || '',
        app_color: appData.app_color || ''
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error installing app:', error);
      throw error;
    }
  },

  // Uninstall an app
  async uninstallApp(appId) {
    try {
      const response = await apiClient.delete(`/installed-apps/${appId}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error uninstalling app:', error);
      throw error;
    }
  },

  // Get a single installed app
  async getInstalledApp(appId) {
    try {
      const response = await apiClient.get(`/installed-apps/${appId}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching installed app:', error);
      throw error;
    }
  },

  // Update an installed app
  async updateInstalledApp(appId, data) {
    try {
      const response = await apiClient.put(`/installed-apps/${appId}`, data);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error updating installed app:', error);
      throw error;
    }
  }
};

export default installedAppsService;
