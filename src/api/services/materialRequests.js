import apiClient from '../client';

// Material zayavkalari v2 (Qurilish → Ombor → Xarid yopiq halqa).
// Backend: /construction/material-requests-v2 (migration 470).
export const materialRequestsService = {
  async list(params = {}) {
    const response = await apiClient.get('/construction/material-requests-v2', { params });
    return response.data.data;
  },

  async listPaged(params = {}) {
    const response = await apiClient.get('/construction/material-requests-v2', { params });
    // Paginated envelope: { data, pagination }
    return response.data;
  },

  // params: { project_id } — loyiha detalidagi tab kartalari shu loyiha
  // ko'lamida hisoblanadi; bo'sh bo'lsa tenant bo'ylab.
  async stats(params = {}) {
    const response = await apiClient.get('/construction/material-requests-v2/stats', { params });
    return response.data.data;
  },

  // productIds: string[]; warehouseId yoki projectId (loyiha ombori) ixtiyoriy.
  async stockCheck({ productIds, warehouseId, projectId }) {
    const params = { product_ids: productIds.join(',') };
    if (warehouseId) params.warehouse_id = warehouseId;
    if (projectId) params.project_id = projectId;
    const response = await apiClient.get('/construction/material-requests-v2/stock-check', { params });
    return response.data.data;
  },

  async get(id) {
    const response = await apiClient.get(`/construction/material-requests-v2/${id}`);
    return response.data.data;
  },

  // { project_id, required_date, priority, warehouse_id?, notes, items: [{product_id, qty, unit?, note?}] }
  async create(data) {
    const response = await apiClient.post('/construction/material-requests-v2', data);
    return response.data.data;
  },

  async update(id, data) {
    const response = await apiClient.put(`/construction/material-requests-v2/${id}`, data);
    return response.data.data;
  },

  async cancel(id) {
    const response = await apiClient.post(`/construction/material-requests-v2/${id}/cancel`);
    return response.data.data;
  },

  // Prorab «Qabul qildim» — issued → closed.
  async accept(id) {
    const response = await apiClient.post(`/construction/material-requests-v2/${id}/accept`);
    return response.data.data;
  },

  // Omborchi ochdi — new → in_review (idempotent).
  async review(id) {
    const response = await apiClient.post(`/construction/material-requests-v2/${id}/review`);
    return response.data.data;
  },

  // lines ixtiyoriy: [{item_id, qty}] — bo'sh bo'lsa barcha qoldiq chiqariladi.
  async issue(id, { lines, note } = {}) {
    const response = await apiClient.post(`/construction/material-requests-v2/${id}/issue`, { lines, note });
    return response.data.data;
  },

  async sendToPurchase(id, { lines, note } = {}) {
    const response = await apiClient.post(`/construction/material-requests-v2/${id}/send-to-purchase`, { lines, note });
    return response.data.data;
  },

  // reason majburiy; item_ids bo'sh bo'lsa butun zayavka rad etiladi.
  async reject(id, { reason, item_ids } = {}) {
    const response = await apiClient.post(`/construction/material-requests-v2/${id}/reject`, { reason, item_ids });
    return response.data.data;
  },
};

export default materialRequestsService;
