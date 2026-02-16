import axios from 'axios';

// API base URL - change this to your Go backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// --- Request concurrency limiter ---
const MAX_CONCURRENT_REQUESTS = 3;
let activeRequests = 0;
const requestQueue = [];

const processQueue = () => {
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const { resolve } = requestQueue.shift();
    activeRequests++;
    resolve();
  }
};

const enqueueRequest = () => {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestQueue.push({ resolve });
  });
};

const releaseRequest = () => {
  activeRequests--;
  processQueue();
};

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// --- GET request deduplication ---
// When multiple contexts request the same endpoint simultaneously,
// share a single in-flight request instead of making duplicates
const inflightGets = new Map();
const originalGet = apiClient.get.bind(apiClient);

apiClient.get = function deduplicatedGet(url, config) {
  const key = `${url}:${JSON.stringify(config?.params || '')}`;
  const existing = inflightGets.get(key);
  if (existing) return existing;

  const promise = originalGet(url, config).finally(() => {
    inflightGets.delete(key);
  });
  inflightGets.set(key, promise);
  return promise;
};

// Token management
let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

export const setTokens = (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem('accessToken', access);
  } else {
    localStorage.removeItem('accessToken');
  }
  if (refresh) {
    localStorage.setItem('refreshToken', refresh);
  } else {
    localStorage.removeItem('refreshToken');
  }
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tenantId');
};

// Request interceptor - add auth token + concurrency control
apiClient.interceptors.request.use(
  async (config) => {
    // Skip concurrency control for retries (they already released their slot)
    if (!config._isRetry) {
      await enqueueRequest();
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Add tenant header if available
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }
    // Add organization header if available
    const activeCompanyKey = Object.keys(localStorage).find(k => k.startsWith('genix_active_company_user_'));
    const organizationId = activeCompanyKey ? localStorage.getItem(activeCompanyKey) : null;
    if (organizationId) {
      config.headers['X-Organization-ID'] = organizationId;
    }
    return config;
  },
  (error) => {
    releaseRequest();
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh + 429 retry with backoff
apiClient.interceptors.response.use(
  (response) => {
    releaseRequest();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 429 Too Many Requests - retry with exponential backoff
    if (error.response?.status === 429) {
      const retryCount = originalRequest._retryCount || 0;
      const maxRetries = 3;

      if (retryCount < maxRetries) {
        originalRequest._retryCount = retryCount + 1;
        originalRequest._isRetry = true;

        // Use Retry-After header if available, otherwise exponential backoff
        const retryAfter = error.response.headers?.['retry-after'];
        let delay;
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else {
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
          const jitter = Math.random() * backoffMs * 0.3;
          delay = backoffMs + jitter;
        }

        releaseRequest();
        await new Promise(resolve => setTimeout(resolve, delay));
        return apiClient.request(originalRequest);
      }
    }

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;
      originalRequest._isRetry = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data.data;
        setTokens(access_token, refresh_token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        releaseRequest();
        return apiClient.request(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        clearTokens();
        releaseRequest();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    releaseRequest();
    return Promise.reject(error);
  }
);

export default apiClient;
