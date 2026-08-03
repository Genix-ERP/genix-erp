import apiClient from '../client';

// Tax constructor + catalog (genix_soliq_spec §2–3): per-tenant tax on/off
// toggles, date-versioned rates and the regime / 1-billion threshold monitor.
export const taxService = {
  async getTaxTypes() {
    const r = await apiClient.get('/taxes/types');
    return r.data.data;
  },
  async getTaxRates(onDate) {
    const r = await apiClient.get('/taxes/rates', { params: onDate ? { on_date: onDate } : {} });
    return r.data.data; // { on_date, rates: [...] }
  },
  async getSettings() {
    const r = await apiClient.get('/taxes/settings');
    return r.data.data; // { regime, taxes: [{code,name_uz,name_ru,category,mandatory,enabled,rate,can_toggle,lock_reason}] }
  },
  async updateSetting(payload) {
    // payload: { tax_code, enabled, valid_from?, rate_variant? }
    const r = await apiClient.put('/taxes/settings', payload);
    return r.data.data;
  },
  async getRegime() {
    const r = await apiClient.get('/taxes/regime');
    return r.data.data; // { regime, income_ytd, threshold, percent, alert_level }
  },
};

export default taxService;
