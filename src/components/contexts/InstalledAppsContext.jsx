import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCompany } from './CompanyContext';

const STORAGE_KEY = 'genix_installed_apps';

const InstalledAppsContext = createContext();

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

export function InstalledAppsProvider({ children }) {
  const { activeCompany } = useCompany();
  const [installedApps, setInstalledApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInstalledApps = useCallback(() => {
    if (!activeCompany) return;

    try {
      const companyId = activeCompany?.id;
      const storageKey = getStorageKey(STORAGE_KEY, companyId);
      const stored = localStorage.getItem(storageKey);
      const apps = stored ? JSON.parse(stored) : [];
      setInstalledApps(apps.filter(app => app.status === 'active'));
    } catch (error) {
      console.error('Error loading installed apps:', error);
      setInstalledApps([]);
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

  const installApp = useCallback((appData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

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
    return newApp;
  }, [installedApps, activeCompany]);

  const uninstallApp = useCallback((appId) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);

    const updated = installedApps.filter(app => app.app_id !== appId);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setInstalledApps(updated);
  }, [installedApps, activeCompany]);

  const refreshInstalledApps = useCallback(async () => {
    loadInstalledApps();
  }, [loadInstalledApps]);

  const isAppInstalled = useCallback((appId) => {
    return installedApps.some(app => app.app_id === appId);
  }, [installedApps]);

  return (
    <InstalledAppsContext.Provider value={{
      installedApps,
      isLoading,
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