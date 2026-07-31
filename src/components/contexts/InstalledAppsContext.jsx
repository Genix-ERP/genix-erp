import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useCompany } from './CompanyContext';
import { installedAppsService } from '@/api/services/installedApps';
import { checkBackendHealth } from '@/config/dataMode';
import apiClient from '@/api/client';

const STORAGE_KEY = 'genix_installed_apps';

const InstalledAppsContext = createContext();

// Helper to get company-specific storage key (fallback for offline mode)
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

export function InstalledAppsProvider({ children }) {
  const { activeCompany, companies, refreshCompanies, isLoading: companiesLoading } = useCompany();

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
      // Companies may still be hydrating/fetching — don't wipe the
      // cache-hydrated list until we know there's really no company.
      if (!companiesLoading) {
        setInstalledApps([]);
        setIsLoading(false);
      }
      return;
    }

    // Load from localStorage immediately (no blocking)
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STORAGE_KEY, companyId);
    let localApps = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const apps = JSON.parse(stored);
        localApps = (apps || []).filter(app => app.status === 'active');
        if (localApps.length > 0) {
          setInstalledApps(localApps);
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
        const backendApps = (apps || []).filter(app => app.status === 'active');

        // Merge: backend is source of truth for apps it knows about,
        // but preserve local-only apps (pending sync / offline installs).
        // This prevents clobbering local installs when backend returns empty
        // due to auth issues, empty tenant state, or partial outages.
        const backendIds = new Set(backendApps.map(a => a.app_id));
        const localOnly = localApps.filter(a => !backendIds.has(a.app_id) && a._localOnly);
        const merged = [...backendApps, ...localOnly];

        setInstalledApps(merged);
        localStorage.setItem(storageKey, JSON.stringify(merged));
      }
    } catch (error) {
      console.error('Error loading installed apps from backend:', error);
      // Keep whatever was loaded from localStorage; don't clear on network error.
    }

    setIsLoading(false);
  }, [activeCompany, companiesLoading]);

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

  // Per-org hide list (migration 386). Apps in the active company's
  // `hidden_apps` are still "installed" tenant-wide but should not
  // appear in the sidebar while operating inside that organization.
  const isAppHiddenInActiveCompany = useCallback((appId) => {
    const list = activeCompany?.hidden_apps;
    return Array.isArray(list) && list.includes(appId);
  }, [activeCompany]);

  // Returns the set of organization IDs that currently hide the given app.
  // Used by the Apps page modal to show which companies have unchecked
  // visibility for an app.
  const getOrgsHidingApp = useCallback((appId) => {
    return (companies || [])
      .filter(c => Array.isArray(c.hidden_apps) && c.hidden_apps.includes(appId))
      .map(c => c.id);
  }, [companies]);

  // Set the visibility of `appId` for a specific organization. `hidden`=true
  // adds the app to that org's hidden_apps; false removes it. Issues a
  // PATCH against /organizations/:id with the next array, then refreshes
  // the companies list so the sidebar re-evaluates immediately.
  const setAppHiddenForOrg = useCallback(async (appId, orgId, hidden) => {
    const org = (companies || []).find(c => c.id === orgId);
    if (!org) return;
    const current = Array.isArray(org.hidden_apps) ? org.hidden_apps : [];
    let next;
    if (hidden) {
      if (current.includes(appId)) return; // already hidden
      next = [...current, appId];
    } else {
      if (!current.includes(appId)) return; // already visible
      next = current.filter(a => a !== appId);
    }
    await apiClient.put(`/organizations/${orgId}`, { hidden_apps: next });
    if (refreshCompanies) {
      await refreshCompanies();
    }
  }, [companies, refreshCompanies]);

  const value = useMemo(() => ({
    installedApps,
    isLoading,
    backendAvailable,
    refreshInstalledApps,
    isAppInstalled,
    installApp,
    uninstallApp,
    isAppHiddenInActiveCompany,
    getOrgsHidingApp,
    setAppHiddenForOrg,
  }), [installedApps, isLoading, backendAvailable, refreshInstalledApps, isAppInstalled, installApp, uninstallApp, isAppHiddenInActiveCompany, getOrgsHidingApp, setAppHiddenForOrg]);

  return (
    <InstalledAppsContext.Provider value={value}>
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
