import apiClient from '../client';

export const inventoryService = {
  // Products
  async listProducts(params = {}) {
    const response = await apiClient.get('/products', { params });
    return response.data.data;
  },

  async getProduct(id) {
    const response = await apiClient.get(`/products/${id}`);
    return response.data.data;
  },

  async createProduct(data) {
    const response = await apiClient.post('/products', data);
    return response.data.data;
  },

  async updateProduct(id, data) {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data.data;
  },

  async deleteProduct(id) {
    await apiClient.delete(`/products/${id}`);
  },

  // Product Categories
  async listCategories(params = {}) {
    const response = await apiClient.get('/product-categories', { params });
    return response.data.data;
  },

  async createCategory(data) {
    const response = await apiClient.post('/product-categories', data);
    return response.data.data;
  },

  async updateCategory(id, data) {
    const response = await apiClient.put(`/product-categories/${id}`, data);
    return response.data.data;
  },

  async deleteCategory(id) {
    await apiClient.delete(`/product-categories/${id}`);
  },

  // Warehouses
  async listWarehouses(params = {}) {
    const response = await apiClient.get('/warehouses', { params });
    return response.data.data;
  },

  async getWarehouse(id) {
    const response = await apiClient.get(`/warehouses/${id}`);
    return response.data.data;
  },

  async createWarehouse(data) {
    const response = await apiClient.post('/warehouses', data);
    return response.data.data;
  },

  async updateWarehouse(id, data) {
    const response = await apiClient.put(`/warehouses/${id}`, data);
    return response.data.data;
  },

  async deleteWarehouse(id) {
    await apiClient.delete(`/warehouses/${id}`);
  },

  async listWarehouseLocations(warehouseId) {
    const response = await apiClient.get(`/warehouses/${warehouseId}/locations`);
    return response.data.data;
  },

  async createWarehouseLocation(warehouseId, data) {
    const response = await apiClient.post(`/warehouses/${warehouseId}/locations`, data);
    return response.data.data;
  },

  // Inventory Stock
  async listInventory(params = {}) {
    const response = await apiClient.get('/inventory', { params });
    return response.data.data;
  },

  async getInventorySummary() {
    const response = await apiClient.get('/inventory/summary');
    return response.data.data;
  },

  async adjustInventory(data) {
    const response = await apiClient.post('/inventory/adjust', data);
    return response.data.data;
  },

  async transferInventory(data) {
    const response = await apiClient.post('/inventory/transfer', data);
    return response.data.data;
  },

  async listInventoryMovements(params = {}) {
    const response = await apiClient.get('/inventory/movements', { params });
    return response.data.data;
  },

  async getInventoryValuation() {
    const response = await apiClient.get('/inventory/valuation');
    return response.data.data;
  },
};

export default inventoryService;
