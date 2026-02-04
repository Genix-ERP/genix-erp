import apiClient from '../client';

export const dropshippingService = {
  // ==================== DROPSHIP ORDERS ====================

  // List all dropship orders
  async listOrders(params = {}) {
    const response = await apiClient.get('/dropship/orders', { params });
    return response.data?.data;
  },

  // Get a single dropship order
  async getOrder(id) {
    const response = await apiClient.get(`/dropship/orders/${id}`);
    return response.data?.data;
  },

  // Create a dropship order from sales order
  async createOrder(data) {
    const response = await apiClient.post('/dropship/orders', data);
    return response.data?.data;
  },

  // Update a dropship order
  async updateOrder(id, data) {
    const response = await apiClient.put(`/dropship/orders/${id}`, data);
    return response.data?.data;
  },

  // Mark order as shipped
  async markShipped(id, data) {
    const response = await apiClient.post(`/dropship/orders/${id}/ship`, data);
    return response.data?.data;
  },

  // Mark order as delivered
  async markDelivered(id) {
    const response = await apiClient.post(`/dropship/orders/${id}/deliver`);
    return response.data?.data;
  },

  // Cancel a dropship order
  async cancelOrder(id) {
    const response = await apiClient.post(`/dropship/orders/${id}/cancel`);
    return response.data?.data;
  },

  // ==================== DROPSHIP STATS ====================

  // Get dropshipping statistics
  async getStats() {
    const response = await apiClient.get('/dropship/stats');
    return response.data?.data;
  },

  // ==================== DROPSHIP VENDOR SETTINGS ====================

  // List all dropship vendors
  async listVendors() {
    const response = await apiClient.get('/dropship/vendors');
    return response.data?.data;
  },

  // Create dropship vendor settings
  async createVendorSettings(data) {
    const response = await apiClient.post('/dropship/vendors', data);
    return response.data?.data;
  },

  // Update dropship vendor settings
  async updateVendorSettings(id, data) {
    const response = await apiClient.put(`/dropship/vendors/${id}`, data);
    return response.data?.data;
  },

  // Delete dropship vendor settings
  async deleteVendorSettings(id) {
    const response = await apiClient.delete(`/dropship/vendors/${id}`);
    return response.data?.data;
  },

  // ==================== PRODUCT-VENDOR LINKS ====================

  // List product-vendor links
  async listProductVendors(params = {}) {
    const response = await apiClient.get('/dropship/product-vendors', { params });
    return response.data?.data;
  },

  // Create product-vendor link
  async createProductVendor(data) {
    const response = await apiClient.post('/dropship/product-vendors', data);
    return response.data?.data;
  },

  // Update product-vendor link
  async updateProductVendor(id, data) {
    const response = await apiClient.put(`/dropship/product-vendors/${id}`, data);
    return response.data?.data;
  },

  // Delete product-vendor link
  async deleteProductVendor(id) {
    const response = await apiClient.delete(`/dropship/product-vendors/${id}`);
    return response.data?.data;
  },

  // ==================== DROPSHIPPABLE PRODUCTS ====================

  // Get dropshippable products
  async getDropshippableProducts() {
    const response = await apiClient.get('/dropship/products');
    return response.data?.data;
  },
};

export default dropshippingService;
