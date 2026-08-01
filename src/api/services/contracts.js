import apiClient from '../client';

// Shartnomalar (Contracts) service — the rebuilt module API.
// Backend routes live in genix-backend/internal/handler/contracts*.go.
const unwrap = (res) => res.data?.data ?? res.data;

export default {
  // ── Registry ──
  // Returns { items, meta } so the table can paginate.
  async list(params = {}) {
    const res = await apiClient.get('/contracts', { params });
    return { items: res.data?.data ?? [], meta: res.data?.meta ?? null };
  },
  async getStats() {
    return unwrap(await apiClient.get('/contracts/stats'));
  },
  async getNextNumber() {
    return unwrap(await apiClient.get('/contracts/next-number'));
  },
  async get(id) {
    return unwrap(await apiClient.get(`/contracts/${id}`));
  },
  async create(data) {
    return unwrap(await apiClient.post('/contracts', data));
  },
  async update(id, data) {
    return unwrap(await apiClient.put(`/contracts/${id}`, data));
  },
  async remove(id) {
    return unwrap(await apiClient.delete(`/contracts/${id}`));
  },
  async changeStatus(id, status) {
    return unwrap(await apiClient.post(`/contracts/${id}/status`, { status }));
  },
  async archive(id) {
    return unwrap(await apiClient.post(`/contracts/${id}/archive`));
  },
  async unarchive(id) {
    return unwrap(await apiClient.post(`/contracts/${id}/unarchive`));
  },

  // ── Amendments (ilova / qo'shimcha kelishuv) ──
  async listAmendments(id) {
    return unwrap(await apiClient.get(`/contracts/${id}/amendments`));
  },
  // data: { number, date, amount_delta?, description?, file? (File) }
  async createAmendment(id, data) {
    const form = new FormData();
    form.append('number', data.number);
    form.append('date', data.date);
    if (data.amount_delta !== undefined && data.amount_delta !== null && data.amount_delta !== '') {
      form.append('amount_delta', String(data.amount_delta));
    }
    if (data.description) form.append('description', data.description);
    if (data.file) form.append('file', data.file);
    return unwrap(await apiClient.post(`/contracts/${id}/amendments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
  async updateAmendment(id, amendmentId, data) {
    return unwrap(await apiClient.put(`/contracts/${id}/amendments/${amendmentId}`, data));
  },
  async deleteAmendment(id, amendmentId) {
    return unwrap(await apiClient.delete(`/contracts/${id}/amendments/${amendmentId}`));
  },

  // ── Versioned files ──
  async listFiles(id) {
    return unwrap(await apiClient.get(`/contracts/${id}/files`));
  },
  async uploadFile(id, file) {
    const form = new FormData();
    form.append('file', file);
    return unwrap(await apiClient.post(`/contracts/${id}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
  // Attach a file already stored by aiExtract (no second upload).
  async attachFile(id, fileId) {
    return unwrap(await apiClient.post(`/contracts/${id}/files`, { file_id: fileId }));
  },
  async deleteFile(id, fileRowId) {
    return unwrap(await apiClient.delete(`/contracts/${id}/files/${fileRowId}`));
  },
  // Tenant-scoped download (auth header goes with the request).
  async downloadFile(id, fileRowId) {
    const res = await apiClient.get(`/contracts/${id}/files/${fileRowId}/download`, {
      responseType: 'blob',
    });
    return res.data;
  },
  async summarizeFile(id, fileRowId) {
    return unwrap(await apiClient.post(`/contracts/${id}/files/${fileRowId}/summary`));
  },

  // ── Cross-module links ──
  async listLinks(id) {
    return unwrap(await apiClient.get(`/contracts/${id}/links`));
  },
  async createLink(id, linkedModule, linkedId) {
    return unwrap(await apiClient.post(`/contracts/${id}/links`, {
      linked_module: linkedModule,
      linked_id: String(linkedId),
    }));
  },
  async deleteLink(id, linkId) {
    return unwrap(await apiClient.delete(`/contracts/${id}/links/${linkId}`));
  },

  // ── Payments / tasks / history ──
  // Returns { invoices, invoiced_total, paid_total, effective_amount, outstanding }
  async listInvoices(id) {
    return unwrap(await apiClient.get(`/contracts/${id}/invoices`));
  },
  // kind: 'sales' | 'purchase'
  async attachInvoice(id, invoiceId, kind, detach = false) {
    return unwrap(await apiClient.post(`/contracts/${id}/invoices`, {
      invoice_id: invoiceId, kind, detach,
    }));
  },
  async listTasks(id) {
    return unwrap(await apiClient.get(`/contracts/${id}/tasks`));
  },
  async listActivity(id, params = {}) {
    return unwrap(await apiClient.get(`/contracts/${id}/activity`, { params }));
  },

  // ── AI ──
  // Upload a document; returns { file_id, file_name, ai_configured, suggestions }.
  async aiExtract(file) {
    const form = new FormData();
    form.append('file', file);
    return unwrap(await apiClient.post('/contracts/ai/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
};
