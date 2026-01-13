// Data mode configuration
// Controls whether to use mock/demo data or real backend data

// Check if we're in demo mode
export const isDemoMode = () => {
  // Demo mode if explicitly set OR if no backend URL is configured
  const demoEnv = import.meta.env.VITE_DEMO_MODE;
  return demoEnv === 'true' || demoEnv === '1';
};

// Check if backend is configured
export const isBackendConfigured = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl && apiUrl.length > 0;
};

// API base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// Check if backend is available (async health check)
export const checkBackendHealth = async () => {
  if (!isBackendConfigured()) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(`${API_BASE_URL}/info`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Backend not available:', error.message);
    return false;
  }
};

// Storage key prefix for localStorage
export const getStorageKey = (baseKey, companyId) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return companyId ? `${prefix}${baseKey}_${companyId}` : `${prefix}${baseKey}`;
};

// Clear all demo data from localStorage
export const clearDemoData = () => {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('demo_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log(`Cleared ${keysToRemove.length} demo data entries`);
};

// Log current mode
export const logDataMode = () => {
  const mode = isDemoMode() ? 'DEMO' : 'PRODUCTION';
  const backend = isBackendConfigured() ? API_BASE_URL : 'Not configured';
  console.log(`[Genix ERP] Data mode: ${mode}, Backend: ${backend}`);
};

export default {
  isDemoMode,
  isBackendConfigured,
  API_BASE_URL,
  checkBackendHealth,
  getStorageKey,
  clearDemoData,
  logDataMode,
};
