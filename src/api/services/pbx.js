import apiClient from '../client';
import { checkBackendHealth } from '@/config/dataMode';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

// PBX Configuration stored in localStorage (fallback only)
const PBX_CONFIG_KEY = 'genix_pbx_config';
const CALL_LOGS_KEY = 'genix_call_logs';

// Get call logs from localStorage (fallback)
const getLocalCallLogs = (companyId) => {
  const key = companyId ? `${CALL_LOGS_KEY}_${companyId}` : CALL_LOGS_KEY;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

// Save call log to localStorage (fallback)
const saveLocalCallLog = (callLog, companyId) => {
  const key = companyId ? `${CALL_LOGS_KEY}_${companyId}` : CALL_LOGS_KEY;
  const logs = getLocalCallLogs(companyId);
  logs.unshift(callLog);
  localStorage.setItem(key, JSON.stringify(logs.slice(0, 100)));
};

export const pbxService = {
  // ==========================================
  // PBX Configuration (stored in backend)
  // ==========================================

  async getConfig() {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/pbx/config');
        return response.data.data || null;
      }
    } catch (error) {
      console.warn('Failed to get PBX config from API:', error);
    }
    // Fallback to localStorage
    const stored = localStorage.getItem(PBX_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  async saveConfig(config) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.post('/pbx/config', config);
        return true;
      }
    } catch (error) {
      console.warn('Failed to save PBX config to API:', error);
    }
    // Fallback to localStorage
    localStorage.setItem(PBX_CONFIG_KEY, JSON.stringify(config));
    return true;
  },

  isConfigured(config) {
    return config && config.enabled && config.domain;
  },

  // ==========================================
  // Test Connection
  // ==========================================

  async testConnection(config) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/pbx/test-connection', {
          domain: config.domain,
          api_key: config.api_key,
        });
        return response.data.data?.connected || false;
      }
    } catch (error) {
      console.error('PBX connection test failed:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
    return false;
  },

  // ==========================================
  // Call Logs (backend API)
  // ==========================================

  async getCallLogs(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/call-logs', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch call logs from API:', error);
    }
    return getLocalCallLogs(companyId);
  },

  async createCallLog(callLogData) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/call-logs', callLogData);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create call log via API:', error);
    }
    const localLog = {
      id: `call_${Date.now()}`,
      ...callLogData,
      created_at: new Date().toISOString()
    };
    saveLocalCallLog(localLog, callLogData.companyId);
    return localLog;
  },

  async updateCallLog(callId, updates, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.put(`/call-logs/${callId}`, updates);
        return true;
      }
    } catch (error) {
      console.warn('Failed to update call log via API:', error);
    }
    const key = companyId ? `${CALL_LOGS_KEY}_${companyId}` : CALL_LOGS_KEY;
    const logs = getLocalCallLogs(companyId);
    const index = logs.findIndex(log => log.id === callId);
    if (index !== -1) {
      logs[index] = { ...logs[index], ...updates };
      localStorage.setItem(key, JSON.stringify(logs));
    }
    return true;
  },

  async deleteCallLog(callId, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/call-logs/${callId}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete call log via API:', error);
    }
    const key = companyId ? `${CALL_LOGS_KEY}_${companyId}` : CALL_LOGS_KEY;
    const logs = getLocalCallLogs(companyId);
    const filtered = logs.filter(log => log.id !== callId);
    localStorage.setItem(key, JSON.stringify(filtered));
    return true;
  },

  async getCallStats(params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/call-logs/stats', { params });
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch call stats from API:', error);
    }
    const logs = getLocalCallLogs();
    return {
      total_calls: logs.length,
      inbound_calls: logs.filter(l => l.call_type === 'inbound').length,
      outbound_calls: logs.filter(l => l.call_type === 'outbound').length,
      missed_calls: logs.filter(l => l.call_type === 'missed').length,
      total_duration: logs.reduce((sum, l) => sum + (l.call_duration || 0), 0),
      avg_duration: logs.length > 0 ? logs.reduce((sum, l) => sum + (l.call_duration || 0), 0) / logs.length : 0,
      answer_rate: 0,
      avg_sentiment: 0
    };
  },

  // ==========================================
  // Call Management (via backend → OnlinePBX)
  // ==========================================

  async makeCall(phoneNumber, options = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/pbx/call', {
          phone: phoneNumber,
          extension: options.extension,
          contact_id: options.customerId,
        });
        const data = response.data.data;
        return {
          success: data?.success || false,
          callId: data?.call_id,
          pbxCallId: data?.pbx_call_id,
        };
      }
    } catch (error) {
      // If backend returned an error (e.g. PBX rejected the call), throw it
      // so the UI can show the error instead of falling through to tel: fallback
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || 'PBX call failed';
      console.error('PBX call initiation failed:', errorMsg);
      throw new Error(errorMsg);
    }

    // Fallback only when backend is not available: use tel: protocol
    const callLog = await this.createCallLog({
      caller_number: phoneNumber,
      call_type: 'outbound',
      call_start_time: new Date().toISOString(),
      call_duration: 0,
      call_outcome: 'initiated',
      contact_id: options.customerId,
    });

    window.location.href = `tel:${phoneNumber}`;
    return { success: true, callId: callLog.id };
  },

  async endCall(callId, companyId) {
    await this.updateCallLog(callId, {
      call_outcome: 'completed',
      call_end_time: new Date().toISOString()
    }, companyId);
    return { success: true };
  },

  // Legacy methods for backward compatibility
  addCallLog(callLog, companyId) {
    return this.createCallLog({ ...callLog, companyId });
  }
};

export default pbxService;
