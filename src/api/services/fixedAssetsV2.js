import apiClient from '../client';

// Fixed Assets v2 — register, lifecycle, auto-depreciation, account mapping.
// Backend: TZ v1.0 (fa_* tables). All responses use { success, data } / structured
// { success:false, error:{ code, message_uz, message_ru } }.
export const fixedAssetsV2Service = {
  // ---- Register / lifecycle ----
  async listAssets() {
    const r = await apiClient.get('/assets');
    return r.data.data || [];
  },
  async getAsset(id) {
    const r = await apiClient.get(`/assets/${id}`);
    return r.data.data;
  },
  async createAsset(payload) {
    const r = await apiClient.post('/assets', payload);
    return r.data.data;
  },
  async commissionAsset(id, commissioning_date) {
    const r = await apiClient.post(`/assets/${id}/commission`, { commissioning_date });
    return r.data.data;
  },
  async conserveAsset(id, date) {
    const r = await apiClient.post(`/assets/${id}/conserve`, { date });
    return r.data.data;
  },
  async reactivateAsset(id, date) {
    const r = await apiClient.post(`/assets/${id}/reactivate`, { date });
    return r.data.data;
  },
  async disposeAsset(id, disposal_date, reason) {
    const r = await apiClient.post(`/assets/${id}/dispose`, { disposal_date, reason });
    return r.data.data;
  },
  async changeParams(id, payload) {
    const r = await apiClient.post(`/assets/${id}/change-params`, payload);
    return r.data.data;
  },
  async getSchedule(id) {
    const r = await apiClient.get(`/assets/${id}/schedule`);
    return r.data.data || [];
  },
  // Per-asset GL override (§2.6) — requires accounting.override_accounts.
  async overrideAccounts(id, payload) {
    const r = await apiClient.patch(`/assets/${id}/accounts`, payload);
    return r.data.data;
  },

  // ---- Depreciation runs ----
  async createRun(period) {
    const r = await apiClient.post('/depreciation/runs', { period });
    return r.data.data;
  },
  async getRun(id) {
    const r = await apiClient.get(`/depreciation/runs/${id}`);
    return r.data.data;
  },
  async excludeFromRun(id, asset_id, comment) {
    const r = await apiClient.post(`/depreciation/runs/${id}/exclude`, { asset_id, comment });
    return r.data.data;
  },
  async postRun(id) {
    const r = await apiClient.post(`/depreciation/runs/${id}/post`);
    return r.data.data;
  },
  async reverseRun(id) {
    const r = await apiClient.post(`/depreciation/runs/${id}/reverse`);
    return r.data.data;
  },

  // ---- Account mapping (§2.5) ----
  async getMapping() {
    const r = await apiClient.get('/settings/asset-mapping');
    return r.data.data;
  },
  async updateMapping(payload) {
    const r = await apiClient.put('/settings/asset-mapping', payload);
    return r.data.data;
  },
  // Group-filtered, leaf-only chart accounts for the mapping dropdowns.
  async accountsForGroup(group) {
    const r = await apiClient.get('/asset-mapping/accounts', { params: { group, leaf: true } });
    return r.data.data || [];
  },
};

export default fixedAssetsV2Service;
