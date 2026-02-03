import apiClient from '../client';

const posService = {
  // ==========================================
  // POS CONFIGURATION
  // ==========================================

  async listConfigs() {
    const response = await apiClient.get('/pos/configs');
    return response.data;
  },

  async createConfig(data) {
    const response = await apiClient.post('/pos/configs', data);
    return response.data;
  },

  async updateConfig(id, data) {
    const response = await apiClient.put(`/pos/configs/${id}`, data);
    return response.data;
  },

  // ==========================================
  // POS SESSIONS
  // ==========================================

  async listSessions(params = {}) {
    const response = await apiClient.get('/pos/sessions', { params });
    return response.data;
  },

  async openSession(data) {
    const response = await apiClient.post('/pos/sessions/open', data);
    return response.data;
  },

  async getCurrentSession() {
    const response = await apiClient.get('/pos/sessions/current');
    return response.data;
  },

  async closeSession(id, data) {
    const response = await apiClient.post(`/pos/sessions/${id}/close`, data);
    return response.data;
  },

  async getSessionSummary(id) {
    const response = await apiClient.get(`/pos/sessions/${id}/summary`);
    return response.data;
  },

  // ==========================================
  // POS ORDERS
  // ==========================================

  async listOrders(params = {}) {
    const response = await apiClient.get('/pos/orders', { params });
    return response.data;
  },

  async createOrder(data) {
    const response = await apiClient.post('/pos/orders', data);
    return response.data;
  },

  async getOrder(id) {
    const response = await apiClient.get(`/pos/orders/${id}`);
    return response.data;
  },

  // ==========================================
  // POS PRODUCTS
  // ==========================================

  async searchProducts(query = '', categoryId = null) {
    const params = {};
    if (query) params.q = query;
    if (categoryId) params.category_id = categoryId;
    const response = await apiClient.get('/pos/products', { params });
    return response.data;
  },
};

export default posService;
