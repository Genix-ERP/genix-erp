import apiClient from '../client';

// Fetch every page of a list endpoint.
//
// Callers used to ask for `limit: 10000` and assume that meant "all". It does
// not: the server clamps limit — products at 5000, inventory at 10000 — and
// returns the clamped page with no indication that anything was cut. A tenant
// past the cap silently lost rows, and because the products screen derives its
// stock figures from the inventory array, the numbers it showed were simply
// wrong with nothing to suggest it.
//
// Paging until a short page arrives cannot truncate, whatever the server's cap
// happens to be. `hardCap` exists only to stop a runaway loop if a server ever
// ignores paging entirely; reaching it is logged rather than passed off as a
// complete result.
export async function fetchAllPages(fetchPage, { pageSize = 500, hardCap = 100000, label = 'list' } = {}) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await fetchPage({ page, limit: pageSize, page_size: pageSize });
    const rows = Array.isArray(batch) ? batch : (batch?.data ?? batch?.items ?? []);
    all.push(...rows);
    if (rows.length < pageSize) break;
    if (all.length >= hardCap) {
      console.warn(`fetchAllPages(${label}): stopped at ${all.length} rows — server appears to ignore paging`);
      break;
    }
  }
  return all;
}

export const inventoryService = {
  // Products
  async listProducts(params = {}) {
    const response = await apiClient.get('/products', { params });
    return response.data.data;
  },
  async listProductsPaginated(params = {}) {
    const response = await apiClient.get('/products', { params });
    return { data: response.data.data, meta: response.data.meta };
  },

  async getProduct(id) {
    const response = await apiClient.get(`/products/${id}`);
    return response.data.data;
  },

  async createProduct(data) {
    const response = await apiClient.post('/products', data);
    return response.data.data;
  },

  // Bulk create — used by the import flow on Products.jsx.
  // Sends an entire xlsx in one request. Response shape:
  //   { created, skipped, failed, total, outcomes: [{row, name, status, reason, id}] }
  // The caller can show a summary + list of skipped/failed rows.
  async bulkCreateProducts({ products, organization_ids } = {}) {
    const response = await apiClient.post('/products/bulk', {
      products: products || [],
      organization_ids: organization_ids || [],
    });
    return response.data.data;
  },

  async updateProduct(id, data) {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data.data;
  },

  async deleteProduct(id) {
    await apiClient.delete(`/products/${id}`);
  },

  // Product Variants
  async listProductVariants(productId) {
    const response = await apiClient.get('/product-variants', { params: { product_id: productId } });
    return response.data.data;
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

  async advanceStockOperationStep(id, params = {}) {
    const response = await apiClient.post(`/stock-operations/${id}/advance`, params);
    return response.data.data;
  },

  async cancelStockOperation(id) {
    const response = await apiClient.post(`/stock-operations/${id}/cancel`);
    return response.data.data;
  },

  async approveStockOperationStep(id) {
    const response = await apiClient.post(`/stock-operations/${id}/approve`);
    return response.data.data;
  },

  async rejectStockOperationStep(id, reason) {
    const response = await apiClient.post(`/stock-operations/${id}/reject`, { reason });
    return response.data.data;
  },

  async addStepDocument(operationId, stepSequence, documentData) {
    const response = await apiClient.post(`/stock-operations/${operationId}/steps/${stepSequence}/documents`, documentData);
    return response.data.data;
  },

  // Warehouse Alerts
  async getWarehouseAlerts() {
    const response = await apiClient.get('/warehouse-alerts');
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

  // Paged variant that preserves the meta block (total/total_pages) for
  // server-side pagination in the Hujjatlar → Harakatlar list.
  async listInventoryMovementsPaged(params = {}) {
    const response = await apiClient.get('/inventory/movements', { params });
    return {
      items: response.data.data || [],
      total: response.data.meta?.total ?? 0,
    };
  },

  // Tannarx usuli (AVECO/FIFO) — tenant-level valuation setting
  async getValuationSettings() {
    const response = await apiClient.get('/inventory/valuation-settings');
    return response.data.data;
  },

  async updateValuationSettings(method) {
    const response = await apiClient.put('/inventory/valuation-settings', { method });
    return response.data.data;
  },

  // As-of date stock report. Replays inventory_transactions on the
  // backend up to `asOf` (YYYY-MM-DD) and returns per-product /
  // per-warehouse quantity + weighted-average cost. Soft-deleted
  // products are included by default — they're the whole reason this
  // endpoint exists (so a user can see SKUs that existed on that day
  // but have since been removed).
  //
  // opts:
  //   warehouse_id    — uuid, filter to a single warehouse
  //   product_id      — uuid, filter to a single product
  //   include_deleted — bool, default true
  async getStockAtDate(asOf, opts = {}) {
    const params = { as_of: asOf, ...opts };
    Object.keys(params).forEach((k) => {
      if (params[k] === undefined || params[k] === null || params[k] === '' || params[k] === 'all') {
        delete params[k];
      }
    });
    const response = await apiClient.get('/inventory/stock-at-date', { params });
    return response.data.data;
  },

  // Per-(product, warehouse) turnover sheet for a date range. The backend
  // replays inventory_transactions and returns, per row: opening balance
  // (before date_from), kirim/chiqim during the period, closing balance,
  // weighted-average cost and closing value. Powers the "Ombor holati"
  // report sub-tab. Soft-deleted products are included by default.
  //
  // params:
  //   date_from       — YYYY-MM-DD (required) period start, inclusive
  //   date_to         — YYYY-MM-DD (required) period end, inclusive
  //   warehouse_id    — uuid, filter to a single warehouse
  //   product_id      — uuid, filter to a single product
  //   include_deleted — bool, default true
  async getInventoryTurnover(params = {}) {
    const clean = { include_deleted: true, ...params };
    Object.keys(clean).forEach((k) => {
      if (clean[k] === undefined || clean[k] === null || clean[k] === '' || clean[k] === 'all') {
        delete clean[k];
      }
    });
    const response = await apiClient.get('/inventory/turnover', { params: clean });
    return response.data.data;
  },

  // Single-call dashboard payload for the Ombor Asosiy panel: totals
  // (total_value, low_stock_count, product_count, warehouse_count,
  // today_movements), value_series (6 months), category_values (top 6 +
  // Boshqa), low_stock_items (top 10) and recent_moves (last 10).
  async getInventoryStats() {
    const response = await apiClient.get('/inventory/stats');
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

  // Stock Count Line — shortage assignment
  async assignResponsible(lineId, data) {
    const response = await apiClient.post(`/stock-count-lines/${lineId}/assign`, data);
    return response.data.data;
  },

  // Employee Deductions
  async listAllDeductions(params = {}) {
    const response = await apiClient.get('/employee-deductions', { params });
    return response.data.data;
  },

  // Scrap Reasons
  async listScrapReasons() {
    const response = await apiClient.get('/scrap/reasons');
    return response.data.data;
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

  // =====================================================
  // INVENTORY LOTS (Partiyalar)
  // =====================================================

  async listLots(params = {}) {
    const response = await apiClient.get('/inventory/lots', { params });
    return response.data;
  },

  async getLot(id) {
    const response = await apiClient.get(`/inventory/lots/${id}`);
    return response.data.data;
  },

  async createLot(data) {
    const response = await apiClient.post('/inventory/lots', data);
    return response.data.data;
  },

  async updateLot(id, data) {
    const response = await apiClient.put(`/inventory/lots/${id}`, data);
    return response.data.data;
  },

  async deleteLot(id) {
    await apiClient.delete(`/inventory/lots/${id}`);
  },

  // ─── Material Reservations ──────────────────────────────────────

  async listReservations(params = {}) {
    const response = await apiClient.get('/material-reservations', { params });
    return response.data.data;
  },

  async createReservation(data) {
    const response = await apiClient.post('/material-reservations', data);
    return response.data.data;
  },

  async approveReservation(id) {
    const response = await apiClient.put(`/material-reservations/${id}/approve`);
    return response.data;
  },

  async rejectReservation(id) {
    const response = await apiClient.put(`/material-reservations/${id}/reject`);
    return response.data;
  },

  async deleteReservation(id) {
    await apiClient.delete(`/material-reservations/${id}`);
  },
};

export default inventoryService;
