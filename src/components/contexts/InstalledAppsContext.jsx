import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const InstalledAppsContext = createContext();

export function InstalledAppsProvider({ children }) {
  const [installedApps, setInstalledApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInstalledApps = async () => {
    try {
      const apps = await base44.entities.InstalledApp.list();
      setInstalledApps(apps.filter(app => app.status === 'active'));
    } catch (error) {
      console.error('Error loading installed apps:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadInstalledApps();
  }, []);

  const refreshInstalledApps = () => {
    loadInstalledApps();
  };

  const isAppInstalled = (appId) => {
    return installedApps.some(app => app.app_id === appId);
  };

  return (
    <InstalledAppsContext.Provider value={{ 
      installedApps, 
      isLoading, 
      refreshInstalledApps,
      isAppInstalled 
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