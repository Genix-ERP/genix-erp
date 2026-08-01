import apiClient from '../client';

// Ish jarayonlari (automation rules) service.
const unwrap = (res) => res.data?.data ?? res.data;

export default {
  // ── Rules ──
  async listRules(params = {}) {
    return unwrap(await apiClient.get('/workflow-rules', { params }));
  },
  async getRule(id) {
    return unwrap(await apiClient.get(`/workflow-rules/${id}`));
  },
  async createRule(data) {
    return unwrap(await apiClient.post('/workflow-rules', data));
  },
  async updateRule(id, data) {
    return unwrap(await apiClient.put(`/workflow-rules/${id}`, data));
  },
  async deleteRule(id) {
    return unwrap(await apiClient.delete(`/workflow-rules/${id}`));
  },
  async toggleRule(id, isActive) {
    return unwrap(await apiClient.put(`/workflow-rules/${id}`, { is_active: isActive }));
  },
  // Dry run: evaluates conditions against sample data, no side effects
  async testRule(id, data = null) {
    return unwrap(await apiClient.post(`/workflow-rules/${id}/test`, data ? { data } : {}));
  },
  async duplicateRule(id) {
    return unwrap(await apiClient.post(`/workflow-rules/${id}/duplicate`));
  },

  // ── Trigger-event catalog (server-side source of truth) ──
  async listEvents() {
    return unwrap(await apiClient.get('/workflow-events'));
  },

  // ── Execution log ──
  async listLogs(params = {}) {
    return unwrap(await apiClient.get('/workflow-logs', { params }));
  },
  async retryLog(id) {
    return unwrap(await apiClient.post(`/workflow-logs/${id}/retry`));
  },
};
