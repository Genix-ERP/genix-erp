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

  async getOperationType(id) {
    const response = await apiClient.get(`/operation-types/${id}`);
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

  async listOperationTypeSteps(opTypeId) {
    const response = await apiClient.get(`/operation-types/${opTypeId}/steps`);
    return response.data.data;
  },

  async saveOperationTypeSteps(opTypeId, steps) {
    const response = await apiClient.put(`/operation-types/${opTypeId}/steps`, steps);
    return response.data.data;
  },

  // Stock Operations (TT: Receipt, Delivery, Internal Transfer, Write-off)
  async listStockOperations(params = {}) {
    const response = await apiClient.get('/stock-operations', { params });
    return response.data.data;
  },

  async getStockOperationSummary() {
    const response = await apiClient.get('/stock-operations/summary');
    return response.data.data;
  },

  async getStockOperation(id) {
    const response = await apiClient.get(`/stock-operations/${id}`);
    return response.data.data;
  },

  async createStockOperation(data) {
    const response = await apiClient.post('/stock-operations', data);
    return response.data.data;
  },

  async validateStockOperation(id) {
    const response = await apiClient.post(`/stock-operations/${id}/validate`);
    return response.data.data;
  },

  async advanceStockOperationStep(id) {
    const response = await apiClient.post(`/stock-operations/${id}/advance`);
    return response.data.data;
  },

  async cancelStockOperation(id) {
    const response = await apiClient.post(`/stock-operations/${id}/cancel`);
    return response.data.data;
  },

  async updateStockOperation(id, data) {
    const response = await apiClient.put(`/stock-operations/${id}`, data);
    return response.data.data;
  },

  async updateStockOperationLines(id, lines) {
    const response = await apiClient.put(`/stock-operations/${id}/lines`, { lines });
    return response.data.data;
  },

  async addStockOperationLine(id, data) {
    const response = await apiClient.post(`/stock-operations/${id}/lines`, data);
    return response.data.data;
  },

  async deleteStockOperationLine(id, lineId) {
    await apiClient.delete(`/stock-operations/${id}/lines/${lineId}`);
  },

  async createBackorder(id) {
    const response = await apiClient.post(`/stock-operations/${id}/backorder`);
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

  async getCOGSData() {
    const response = await apiClient.get('/inventory/cogs');
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
  // UNITS OF MEASURE
  // =====================================================

  async listUnitsOfMeasure(params = {}) {
    const response = await apiClient.get('/units-of-measure', { params });
    return response.data.data;
  },

  async createUnitOfMeasure(data) {
    const response = await apiClient.post('/units-of-measure', data);
    return response.data.data;
  },

  async updateUnitOfMeasure(id, data) {
    const response = await apiClient.put(`/units-of-measure/${id}`, data);
    return response.data.data;
  },

  async deleteUnitOfMeasure(id) {
    await apiClient.delete(`/units-of-measure/${id}`);
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

  // =====================================================
  // STOCK COUNTS (Inventarizatsiya)
  // =====================================================

  async listStockCounts(params = {}) {
    const response = await apiClient.get('/stock-counts', { params });
    return response.data.data;
  },

  async getStockCount(id) {
    const response = await apiClient.get(`/stock-counts/${id}`);
    return response.data.data;
  },

  async createStockCount(data) {
    const response = await apiClient.post('/stock-counts', data);
    return response.data.data;
  },

  async recordCountLine(countId, data) {
    const response = await apiClient.post(`/stock-counts/${countId}/record`, data);
    return response.data.data;
  },

  async completeStockCount(countId) {
    const response = await apiClient.post(`/stock-counts/${countId}/complete`);
    return response.data.data;
  },

  async deleteStockCount(id) {
    await apiClient.delete(`/stock-counts/${id}`);
  },

  // Scrap Orders
  async listScrapOrders(params) {
    const response = await apiClient.get('/scrap/orders', { params });
    return response.data.data;
  },

  async getScrapOrder(id) {
    const response = await apiClient.get(`/scrap/orders/${id}`);
    return response.data.data;
  },

  async createScrapOrder(data) {
    const response = await apiClient.post('/scrap/orders', data);
    return response.data.data;
  },

  async confirmScrapOrder(id) {
    const response = await apiClient.post(`/scrap/orders/${id}/confirm`);
    return response.data;
  },

  async cancelScrapOrder(id) {
    const response = await apiClient.post(`/scrap/orders/${id}/cancel`);
    return response.data;
  },

  async getScrapSummary() {
    const response = await apiClient.get('/scrap/summary');
    return response.data.data;
  },

  // Reorder Rules
  async listReorderRules(params = {}) {
    const response = await apiClient.get('/reorder-rules', { params });
    return response.data.data;
  },

  async getReorderRule(id) {
    const response = await apiClient.get(`/reorder-rules/${id}`);
    return response.data.data;
  },

  async createReorderRule(data) {
    const response = await apiClient.post('/reorder-rules', data);
    return response.data.data;
  },

  async updateReorderRule(id, data) {
    const response = await apiClient.put(`/reorder-rules/${id}`, data);
    return response.data.data;
  },

  async deleteReorderRule(id) {
    await apiClient.delete(`/reorder-rules/${id}`);
  },

  async getReorderAlerts(params = {}) {
    const response = await apiClient.get('/reorder-rules/alerts', { params });
    return response.data.data;
  },
};

export default inventoryService;
