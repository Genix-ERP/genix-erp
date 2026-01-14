import apiClient from '../client';
import { checkBackendHealth } from '@/config/dataMode';

// PBX Configuration stored in localStorage
const PBX_CONFIG_KEY = 'genix_pbx_config';
const CALL_LOGS_KEY = 'genix_call_logs';

// Get PBX configuration
const getConfig = () => {
  const stored = localStorage.getItem(PBX_CONFIG_KEY);
  return stored ? JSON.parse(stored) : null;
};

// Save PBX configuration
const saveConfig = (config) => {
  localStorage.setItem(PBX_CONFIG_KEY, JSON.stringify(config));
};

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
  // Configuration
  getConfig,
  saveConfig,

  // Check if PBX is configured
  isConfigured() {
    const config = getConfig();
    return config && config.enabled && config.serverUrl;
  },

  // Test PBX connection
  async testConnection(config) {
    try {
      const response = await fetch(`${config.serverUrl}/api/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.error('PBX connection test failed:', error);
      return false;
    }
  },

  // Get call logs from backend API
  async getCallLogs(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/call-logs', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch call logs from API, using local storage:', error);
    }
    // Fallback to localStorage
    return getLocalCallLogs(companyId);
  },

  // Create call log via API
  async createCallLog(callLogData) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/call-logs', callLogData);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create call log via API, saving locally:', error);
    }
    // Fallback: save locally
    const localLog = {
      id: `call_${Date.now()}`,
      ...callLogData,
      created_at: new Date().toISOString()
    };
    saveLocalCallLog(localLog, callLogData.companyId);
    return localLog;
  },

  // Update call log via API
  async updateCallLog(callId, updates, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.put(`/call-logs/${callId}`, updates);
        return true;
      }
    } catch (error) {
      console.warn('Failed to update call log via API, updating locally:', error);
    }
    // Fallback: update localStorage
    const key = companyId ? `${CALL_LOGS_KEY}_${companyId}` : CALL_LOGS_KEY;
    const logs = getLocalCallLogs(companyId);
    const index = logs.findIndex(log => log.id === callId);
    if (index !== -1) {
      logs[index] = { ...logs[index], ...updates };
      localStorage.setItem(key, JSON.stringify(logs));
    }
    return true;
  },

  // Delete call log via API
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
    // Fallback: remove from localStorage
    const key = companyId ? `${CALL_LOGS_KEY}_${companyId}` : CALL_LOGS_KEY;
    const logs = getLocalCallLogs(companyId);
    const filtered = logs.filter(log => log.id !== callId);
    localStorage.setItem(key, JSON.stringify(filtered));
    return true;
  },

  // Get call statistics from API
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
    // Fallback: calculate from local data
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

  // Make outbound call
  async makeCall(phoneNumber, options = {}) {
    const config = getConfig();

    // Create call log first
    const callLogData = {
      caller_number: phoneNumber,
      call_type: 'outbound',
      call_start_time: new Date().toISOString(),
      call_duration: 0,
      call_outcome: 'initiated',
      contact_id: options.customerId,
      customer_name: options.customerName
    };

    const callLog = await this.createCallLog(callLogData);

    // If PBX is configured, try to initiate call via PBX
    if (config && config.enabled && config.serverUrl && config.apiKey) {
      try {
        const response = await fetch(`${config.serverUrl}/api/calls/originate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            destination: phoneNumber,
            callerId: config.callerId || config.extension,
            extension: config.extension,
            ...options
          })
        });

        if (response.ok) {
          const pbxResult = await response.json();
          // Update call log with PBX call ID
          await this.updateCallLog(callLog.id, {
            pbx_call_id: pbxResult.callId,
            call_outcome: 'answered'
          }, options.companyId);
          return { success: true, callId: callLog.id, pbxCallId: pbxResult.callId };
        }
      } catch (error) {
        console.warn('PBX call initiation failed, falling back to tel:', error);
      }
    }

    // Fallback: Use tel: protocol for native dialing
    window.location.href = `tel:${phoneNumber}`;

    return { success: true, callId: callLog.id };
  },

  // End active call
  async endCall(callId, companyId) {
    const config = getConfig();

    // Update call log
    await this.updateCallLog(callId, {
      call_outcome: 'completed',
      call_end_time: new Date().toISOString()
    }, companyId);

    // Try to end via PBX if configured
    if (config && config.serverUrl && config.apiKey) {
      try {
        await fetch(`${config.serverUrl}/api/calls/${callId}/hangup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.warn('Failed to end call via PBX:', error);
      }
    }

    return { success: true };
  },

  // Get call status
  async getCallStatus(callId) {
    const config = getConfig();
    if (!config || !config.serverUrl) {
      return null;
    }

    try {
      const response = await fetch(`${config.serverUrl}/api/calls/${callId}/status`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to get call status:', error);
      return null;
    }
  },

  // Get active calls (from PBX server)
  async getActiveCalls() {
    const config = getConfig();
    if (!config || !config.serverUrl) {
      return [];
    }

    try {
      const response = await fetch(`${config.serverUrl}/api/calls/active`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to get active calls:', error);
      return [];
    }
  },

  // WebSocket connection for real-time call events
  connectWebSocket(onEvent) {
    const config = getConfig();
    if (!config || !config.serverUrl) {
      return null;
    }

    try {
      const wsUrl = config.serverUrl.replace('http', 'ws') + '/ws/calls';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('PBX WebSocket connected');
        ws.send(JSON.stringify({
          type: 'auth',
          token: config.apiKey,
          extension: config.extension
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onEvent(data);
      };

      ws.onerror = (error) => {
        console.error('PBX WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('PBX WebSocket disconnected');
      };

      return ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      return null;
    }
  },

  // Legacy methods for backward compatibility
  addCallLog(callLog, companyId) {
    return this.createCallLog({ ...callLog, companyId });
  }
};

export default pbxService;
