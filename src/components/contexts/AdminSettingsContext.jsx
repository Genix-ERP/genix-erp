import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminSettingsService } from '@/api/services/adminSettings';
import { useCompany } from './CompanyContext';
import { useAuth } from './AuthContext';
import { isDemoMode, checkBackendHealth, getStorageKey } from '@/config/dataMode';
import { DEFAULT_ADMIN_SETTINGS, deepMerge, getSetting as getSettingValue, setSetting as setSettingValue } from '@/config/defaultSettings';

const ADMIN_SETTINGS_STORAGE_KEY = 'genix_admin_settings';

const AdminSettingsContext = createContext();

export function AdminSettingsProvider({ children }) {
  const { activeCompany } = useCompany();
  const { user, isSiteAdmin, isOwner } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_ADMIN_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState(DEFAULT_ADMIN_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  // Check if current user can manage settings
  const canManageSettings = useCallback(() => {
    if (!user) return false;
    return isSiteAdmin() || isOwner() || user.role === 'admin' || user.role === 'system_admin';
  }, [user, isSiteAdmin, isOwner]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  // Get storage key for the active company
  const getCompanyStorageKey = useCallback(() => {
    return getStorageKey(ADMIN_SETTINGS_STORAGE_KEY, activeCompany?.id);
  }, [activeCompany]);

  // Load settings from localStorage
  const loadFromLocalStorage = useCallback(() => {
    try {
      const storageKey = getCompanyStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Deep merge with defaults to ensure all fields exist
        return deepMerge(DEFAULT_ADMIN_SETTINGS, parsed);
      }
    } catch (err) {
      console.error('Error loading settings from localStorage:', err);
    }
    return DEFAULT_ADMIN_SETTINGS;
  }, [getCompanyStorageKey]);

  // Save settings to localStorage
  const saveToLocalStorage = useCallback((settingsData) => {
    try {
      const storageKey = getCompanyStorageKey();
      localStorage.setItem(storageKey, JSON.stringify({
        ...settingsData,
        _updated_at: new Date().toISOString(),
        _updated_by: user?.id || 'system'
      }));
    } catch (err) {
      console.error('Error saving settings to localStorage:', err);
    }
  }, [getCompanyStorageKey, user]);

  // Load settings
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const isAvailable = await checkBackendHealth();
      setBackendAvailable(isAvailable);

      if (isAvailable && activeCompany?.id) {
        try {
          const apiSettings = await adminSettingsService.getSettings(activeCompany.id);
          if (apiSettings && Object.keys(apiSettings).length > 0) {
            const mergedSettings = deepMerge(DEFAULT_ADMIN_SETTINGS, apiSettings);
            setSettings(mergedSettings);
            setOriginalSettings(mergedSettings);
            // Also cache in localStorage
            saveToLocalStorage(mergedSettings);
          } else {
            // No settings from API, use defaults
            setSettings(DEFAULT_ADMIN_SETTINGS);
            setOriginalSettings(DEFAULT_ADMIN_SETTINGS);
          }
        } catch (apiError) {
          console.warn('API failed, falling back to localStorage:', apiError);
          const localSettings = loadFromLocalStorage();
          setSettings(localSettings);
          setOriginalSettings(localSettings);
        }
      } else {
        // No backend available, use localStorage
        const localSettings = loadFromLocalStorage();
        setSettings(localSettings);
        setOriginalSettings(localSettings);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err.message);
      // Fall back to defaults
      setSettings(DEFAULT_ADMIN_SETTINGS);
      setOriginalSettings(DEFAULT_ADMIN_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadFromLocalStorage, saveToLocalStorage]);

  // Load settings when company changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Get a specific setting value by path (e.g., 'inventory.costing.method')
  const getSetting = useCallback((path, defaultValue = null) => {
    return getSettingValue(settings, path, defaultValue);
  }, [settings]);

  // Update a specific setting value by path
  const updateSetting = useCallback((path, value) => {
    setSettings(prev => {
      const newSettings = JSON.parse(JSON.stringify(prev)); // Deep clone
      return setSettingValue(newSettings, path, value);
    });
  }, []);

  // Update an entire section
  const updateSection = useCallback((section, sectionData) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...sectionData
      }
    }));
  }, []);

  // Save all settings
  const saveSettings = useCallback(async () => {
    if (!canManageSettings()) {
      setError('Permission denied: Only administrators can save settings');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (backendAvailable && activeCompany?.id) {
        try {
          await adminSettingsService.updateSettings(activeCompany.id, settings);
        } catch (apiError) {
          console.warn('API save failed, saving to localStorage only:', apiError);
        }
      }

      // Always save to localStorage
      saveToLocalStorage(settings);
      setOriginalSettings(settings);
      setLastSaved(new Date());
      return true;
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [settings, canManageSettings, backendAvailable, activeCompany, saveToLocalStorage]);

  // Save a specific section
  const saveSection = useCallback(async (section) => {
    if (!canManageSettings()) {
      setError('Permission denied: Only administrators can save settings');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (backendAvailable && activeCompany?.id) {
        try {
          await adminSettingsService.updateSection(activeCompany.id, section, settings[section]);
        } catch (apiError) {
          console.warn('API save failed, saving to localStorage only:', apiError);
        }
      }

      // Always save to localStorage
      saveToLocalStorage(settings);
      setOriginalSettings(prev => ({
        ...prev,
        [section]: settings[section]
      }));
      setLastSaved(new Date());
      return true;
    } catch (err) {
      console.error('Error saving section:', err);
      setError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [settings, canManageSettings, backendAvailable, activeCompany, saveToLocalStorage]);

  // Reset a specific section to defaults
  const resetSection = useCallback((section) => {
    setSettings(prev => ({
      ...prev,
      [section]: DEFAULT_ADMIN_SETTINGS[section]
    }));
  }, []);

  // Reset all settings to defaults
  const resetAllSettings = useCallback(() => {
    setSettings(DEFAULT_ADMIN_SETTINGS);
  }, []);

  // Discard unsaved changes
  const discardChanges = useCallback(() => {
    setSettings(originalSettings);
  }, [originalSettings]);

  // Export settings as JSON
  const exportSettings = useCallback(() => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `genix_settings_${activeCompany?.name || 'export'}_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [settings, activeCompany]);

  // Import settings from JSON
  const importSettings = useCallback((settingsData) => {
    try {
      const importedSettings = typeof settingsData === 'string'
        ? JSON.parse(settingsData)
        : settingsData;

      // Validate and merge with defaults
      const mergedSettings = deepMerge(DEFAULT_ADMIN_SETTINGS, importedSettings);
      setSettings(mergedSettings);
      return true;
    } catch (err) {
      console.error('Error importing settings:', err);
      setError('Invalid settings format');
      return false;
    }
  }, []);

  const value = {
    // State
    settings,
    isLoading,
    isSaving,
    error,
    lastSaved,
    backendAvailable,

    // Computed
    canManageSettings,
    hasUnsavedChanges,

    // Methods
    getSetting,
    updateSetting,
    updateSection,
    saveSettings,
    saveSection,
    resetSection,
    resetAllSettings,
    discardChanges,
    refreshSettings: loadSettings,
    exportSettings,
    importSettings,

    // Default settings reference
    DEFAULT_SETTINGS: DEFAULT_ADMIN_SETTINGS
  };

  return (
    <AdminSettingsContext.Provider value={value}>
      {children}
    </AdminSettingsContext.Provider>
  );
}

export function useAdminSettings() {
  const context = useContext(AdminSettingsContext);
  if (!context) {
    throw new Error('useAdminSettings must be used within AdminSettingsProvider');
  }
  return context;
}

export default AdminSettingsContext;
