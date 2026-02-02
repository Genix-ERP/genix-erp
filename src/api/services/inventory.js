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

  async listWarehouseLocations(warehouseId, params = {}) {
    const response = await apiClient.get(`/warehouses/${warehouseId}/locations`, { params });
    return response.data.data;
  },

  async createWarehouseLocation(warehouseId, data) {
    const response = await apiClient.post(`/warehouses/${warehouseId}/locations`, data);
    return response.data.data;
  },

  async updateWarehouseLocation(warehouseId, locationId, data) {
    const response = await apiClient.put(`/warehouses/${warehouseId}/locations/${locationId}`, data);
    return response.data.data;
  },

  async deleteWarehouseLocation(warehouseId, locationId) {
    await apiClient.delete(`/warehouses/${warehouseId}/locations/${locationId}`);
  },

  // All Locations (cross-warehouse view like Odoo)
  async listAllLocations(params = {}) {
    const response = await apiClient.get('/locations', { params });
    return response.data.data;
  },

  // Operation Types
  async listOperationTypes(params = {}) {
    const response = await apiClient.get('/operation-types', { params });
    return response.data.data;
  },

  async getWarehouseOperationTypes(warehouseId) {
    const response = await apiClient.get(`/warehouses/${warehouseId}/operation-types`);
    return response.data.data;
  },

  async createOperationType(data) {
    const response = await apiClient.post('/operation-types', data);
    return response.data.data;
  },

  async updateOperationType(id, data) {
    const response = await apiClient.put(`/operation-types/${id}`, data);
    return response.data.data;
  },

  async deleteOperationType(id) {
    await apiClient.delete(`/operation-types/${id}`);
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

  // Carriers
  async listCarriers(params = {}) {
    const response = await apiClient.get('/carriers', { params });
    return response.data.data;
  },

  async getCarrier(id) {
    const response = await apiClient.get(`/carriers/${id}`);
    return response.data.data;
  },

  async createCarrier(data) {
    const response = await apiClient.post('/carriers', data);
    return response.data.data;
  },

  async updateCarrier(id, data) {
    const response = await apiClient.put(`/carriers/${id}`, data);
    return response.data.data;
  },

  async deleteCarrier(id) {
    await apiClient.delete(`/carriers/${id}`);
  },

  // =====================================================
  // PRODUCT PACKAGINGS (Odoo-style - 6-pack, 12-pack, etc.)
  // =====================================================

  async listProductPackagings(params = {}) {
    const response = await apiClient.get('/product-packagings', { params });
    return response.data.data;
  },

  async listProductPackagingsByProduct(productId) {
    const response = await apiClient.get(`/products/${productId}/packagings`);
    return response.data.data;
  },

  async getProductPackaging(id) {
    const response = await apiClient.get(`/product-packagings/${id}`);
    return response.data.data;
  },

  async createProductPackaging(data) {
    const response = await apiClient.post('/product-packagings', data);
    return response.data.data;
  },

  async createProductPackagingForProduct(productId, data) {
    const response = await apiClient.post(`/products/${productId}/packagings`, data);
    return response.data.data;
  },

  async updateProductPackaging(id, data) {
    const response = await apiClient.put(`/product-packagings/${id}`, data);
    return response.data.data;
  },

  async deleteProductPackaging(id) {
    await apiClient.delete(`/product-packagings/${id}`);
  },

  // =====================================================
  // PACKAGE TYPES (box sizes, pallets, containers)
  // =====================================================

  async listPackageTypes(params = {}) {
    const response = await apiClient.get('/package-types', { params });
    return response.data.data;
  },

  async getPackageType(id) {
    const response = await apiClient.get(`/package-types/${id}`);
    return response.data.data;
  },

  async createPackageType(data) {
    const response = await apiClient.post('/package-types', data);
    return response.data.data;
  },

  async updatePackageType(id, data) {
    const response = await apiClient.put(`/package-types/${id}`, data);
    return response.data.data;
  },

  async deletePackageType(id) {
    await apiClient.delete(`/package-types/${id}`);
  },

  // =====================================================
  // PACKAGES (physical packages in warehouse)
  // =====================================================

  async listPackages(params = {}) {
    const response = await apiClient.get('/packages', { params });
    return response.data.data;
  },

  async getPackage(id) {
    const response = await apiClient.get(`/packages/${id}`);
    return response.data.data;
  },

  async createPackage(data = {}) {
    const response = await apiClient.post('/packages', data);
    return response.data.data;
  },

  async updatePackage(id, data) {
    const response = await apiClient.put(`/packages/${id}`, data);
    return response.data.data;
  },

  async deletePackage(id) {
    await apiClient.delete(`/packages/${id}`);
  },

  async addPackageContent(packageId, data) {
    const response = await apiClient.post(`/packages/${packageId}/contents`, data);
    return response.data.data;
  },

  async removePackageContent(packageId, contentId) {
    await apiClient.delete(`/packages/${packageId}/contents/${contentId}`);
  },
};

export default inventoryService;
