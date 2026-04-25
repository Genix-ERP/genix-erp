import apiClient from '../client';

// taxCalculators.js — thin service wrappers for the 4 activity-tax
// calculators shipped for TZ_Ish_Haqi_Soliq_Tolik.docx §5 + §10.
//
// Every endpoint takes the same period shape:
//   period_type: 'month' | 'quarter' | 'year'
//   period_key:  'YYYY-MM' | 'YYYY-Qn' | 'YYYY'
// and resolves its rate from company_tax_rates so admin settings
// changes immediately propagate (TZ §11.9).

function periodParams({ periodType = 'month', periodKey } = {}) {
  const params = { period_type: periodType };
  if (periodKey) params.period_key = periodKey;
  return params;
}

export const taxCalculators = {
  /** Combined director-level snapshot — TZ §10 "Umumiy soliq jamlanmasi". */
  async combined({ periodType, periodKey, income } = {}) {
    const params = periodParams({ periodType, periodKey });
    if (income !== undefined && income !== null && income !== '') params.income = income;
    const response = await apiClient.get('/tax-summary/combined', { params });
    return response.data.data;
  },

  /** NDS (QQS) calculator — TZ §5.1. realizatsiya / zachet / balansi. */
  async nds({ periodType, periodKey } = {}) {
    const response = await apiClient.get('/nds-tax', { params: periodParams({ periodType, periodKey }) });
    return response.data.data;
  },

  /** Profit tax — TZ §6. income / recognized / unrecognized / tax_base / tax_amount. */
  async profit({ periodType, periodKey, income } = {}) {
    const params = periodParams({ periodType, periodKey });
    if (income !== undefined && income !== null && income !== '') params.income = income;
    const response = await apiClient.get('/profit-tax', { params });
    return response.data.data;
  },

  /** Turnover tax — TZ §5.2. For simplified-regime tenants. */
  async turnover({ periodType, periodKey } = {}) {
    const response = await apiClient.get('/turnover-tax', { params: periodParams({ periodType, periodKey }) });
    return response.data.data;
  },

  /**
   * Dividend withholding preview — TZ §5.3. Compute-only; no posting.
   * Pass `{ amount, rate? }`. Rate defaults to company_tax_rates(dividend).
   */
  async dividendPreview({ amount, rate } = {}) {
    const body = { amount };
    if (rate !== undefined) body.rate = rate;
    const response = await apiClient.post('/dividend-tax/compute', body);
    return response.data.data;
  },

  /**
   * Post an actual dividend distribution to the ledger — creates a
   * journal entry (Dr Retained Earnings, Cr Cash, Cr Tax Liability).
   * Requires retained_earnings_account_id + cash_account_id; tax liability
   * account falls back to company_tax_rates(dividend).account_id.
   */
  async distributeDividend(payload) {
    const response = await apiClient.post('/dividend-distributions', payload);
    return response.data.data;
  },
};

export default taxCalculators;
