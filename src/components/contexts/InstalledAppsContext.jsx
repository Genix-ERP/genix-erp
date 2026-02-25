import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCompany } from './CompanyContext';
import { installedAppsService } from '@/api/services/installedApps';
import { checkBackendHealth } from '@/config/dataMode';

const STORAGE_KEY = 'genix_installed_apps';

const InstalledAppsContext = createContext();

// Helper to get company-specific storage key (fallback for offline mode)
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

export function InstalledAppsProvider({ children }) {
  const { activeCompany } = useCompany();

  // Initialize from localStorage cache immediately to avoid delay
  const [installedApps, setInstalledApps] = useState(() => {
    try {
      const companyId = activeCompany?.id;
      const storageKey = getStorageKey(STORAGE_KEY, companyId);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const apps = JSON.parse(stored);
        return (apps || []).filter(app => app.status === 'active');
      }
    } catch (e) { /* ignore */ }
    return [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Load installed apps from backend or localStorage
  const loadInstalledApps = useCallback(async () => {
    if (!activeCompany) {
      setInstalledApps([]);
      setIsLoading(false);
      return;
    }

    // Load from localStorage immediately (no blocking)
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const apps = JSON.parse(stored);
        const activeApps = (apps || []).filter(app => app.status === 'active');
        if (activeApps.length > 0) {
          setInstalledApps(activeApps);
          setIsLoading(false);
        }
      }
    } catch (e) { /* ignore */ }

    // Then fetch from backend in background (non-blocking update)
    try {
      const isAvailable = await checkBackendHealth();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        const apps = await installedAppsService.getInstalledApps();
        const activeApps = (apps || []).filter(app => app.status === 'active');
        setInstalledApps(activeApps);
        localStorage.setItem(storageKey, JSON.stringify(activeApps));
      }
    } catch (error) {
      console.error('Error loading installed apps from backend:', error);
    }

    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadInstalledApps();
  }, [loadInstalledApps]);

  // Listen for company change events
  useEffect(() => {
    const handleCompanyChange = () => {
      loadInstalledApps();
    };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadInstalledApps]);

  const installApp = useCallback(async (appData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    try {
      // Check backend availability fresh each time
      const isAvailable = await checkBackendHealth();

      if (isAvailable) {
        // Install via backend
        await installedAppsService.installApp({
          app_id: appData.app_id,
          app_name: appData.app_name,
          app_description: appData.description || '',
          app_version: appData.version || '1.0',
          app_icon: appData.icon || '',
          app_color: appData.color || ''
        });

        // Reload from backend to get fresh data
        await loadInstalledApps();
      } else {
        // Fallback to localStorage
        const newApp = {
          id: `app_${Date.now()}`,
          ...appData,
          company_id: companyId,
          installed_date: new Date().toISOString(),
          status: 'active'
        };
        const updated = [...installedApps, newApp];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setInstalledApps(updated);
      }
    } catch (error) {
      console.error('Error installing app:', error);
      // Fallback to localStorage on error
      const newApp = {
        id: `app_${Date.now()}`,
        ...appData,
        company_id: companyId,
        installed_date: new Date().toISOString(),
        status: 'active'
      };
      const updated = [...installedApps, newApp];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setInstalledApps(updated);
    }
  }, [installedApps, activeCompany, loadInstalledApps]);

  const uninstallApp = useCallback(async (appId) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    try {
      // Check backend availability fresh each time
      const isAvailable = await checkBackendHealth();

      if (isAvailable) {
        // Uninstall via backend
        await installedAppsService.uninstallApp(appId);

        // Reload from backend to get fresh data
        await loadInstalledApps();
      } else {
        // Fallback to localStorage
        const updated = installedApps.filter(app => app.app_id !== appId);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setInstalledApps(updated);
      }
    } catch (error) {
      console.error('Error uninstalling app:', error);
      // Fallback to localStorage on error
      const updated = installedApps.filter(app => app.app_id !== appId);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setInstalledApps(updated);
    }
  }, [installedApps, activeCompany, loadInstalledApps]);

  const refreshInstalledApps = useCallback(async () => {
    await loadInstalledApps();
  }, [loadInstalledApps]);

  const isAppInstalled = useCallback((appId) => {
    return installedApps.some(app => app.app_id === appId);
  }, [installedApps]);

  return (
    <InstalledAppsContext.Provider value={{
      installedApps,
      isLoading,
      backendAvailable,
      refreshInstalledApps,
      isAppInstalled,
      installApp,
      uninstallApp
    }}>
      {children}
    </InstalledAppsContext.Provider>
  );
}

export function useInstalledApps() {
  const context = useContext(InstalledAppsContext);
  if (!context) {
    throw new Error('useInstalledApps must be used within InstalledAppsProvider');
  }
  return context;
}
