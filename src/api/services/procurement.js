import apiClient from '../client';

export const procurementService = {
  // Suppliers
  async listSuppliers(params = {}) {
    const response = await apiClient.get('/contacts', {
      params: { ...params, type: 'vendor' }
    });
    // Convert backend fields to frontend format
    const suppliers = response.data.data || [];
    return suppliers.map(supplier => ({
      ...supplier,
      payment_terms: this._paymentTermsToString(supplier.payment_terms),
      categories: supplier.tags || [],
      status: supplier.is_active ? 'active' : 'inactive',
      rating: supplier.rating || 0,
      rating_count: supplier.rating_count || 0,
    }));
  },

  async getSupplier(id) {
    const response = await apiClient.get(`/contacts/${id}`);
    const supplier = response.data.data;
    return {
      ...supplier,
      payment_terms: this._paymentTermsToString(supplier.payment_terms),
      categories: supplier.tags || [],
      status: supplier.is_active ? 'active' : 'inactive',
      rating: supplier.rating || 0,
      rating_count: supplier.rating_count || 0,
    };
  },

  // Helper to convert payment terms integer to string
  _paymentTermsToString(days) {
    if (days === 0) return 'prepaid';
    if (days === 15) return 'net_15';
    if (days === 30) return 'net_30';
    if (days === 60) return 'net_60';
    if (days === 90) return 'net_90';
    return 'net_30'; // default
  },

  async createSupplier(data) {
    // Backend expects 'type' not 'contact_type', and 'name' is required
    // Backend requires 'code' with validation - generate if not provided
    // Convert payment_terms string to integer days
    const paymentTermsMap = {
      'prepaid': 0,
      'due_on_receipt': 0,
      'net_15': 15,
      'net_30': 30,
      'net_60': 60,
      'net_90': 90,
    };
    const payload = {
      ...data,
      type: 'vendor',
      name: data.name,
      code: data.code || `VEN-${Date.now()}`,
      payment_terms: paymentTermsMap[data.payment_terms] || parseInt(data.payment_terms) || 30,
      tags: data.categories || data.tags || [],
      is_active: data.status === 'active',
    };
    // Remove frontend-only fields
    delete payload.categories;
    delete payload.currency;
    delete payload.status;
    const response = await apiClient.post('/contacts', payload);
    return response.data.data;
  },

  async updateSupplier(id, data) {
    // Convert payment_terms string to integer days
    const paymentTermsMap = {
      'prepaid': 0,
      'due_on_receipt': 0,
      'net_15': 15,
      'net_30': 30,
      'net_60': 60,
      'net_90': 90,
    };
    const payload = {
      ...data,
      payment_terms: paymentTermsMap[data.payment_terms] || parseInt(data.payment_terms) || 30,
      tags: data.categories || data.tags || [],
      is_active: data.status === 'active',
    };
    // Remove frontend-only fields
    delete payload.categories;
    delete payload.currency;
    delete payload.status;
    const response = await apiClient.put(`/contacts/${id}`, payload);
    return response.data.data;
  },

  async deleteSupplier(id) {
    await apiClient.delete(`/contacts/${id}`);
  },

  async rateSupplier(id, rating, comment = '') {
    const response = await apiClient.post(`/contacts/${id}/rate`, { rating, comment });
    return response.data.data;
  },

  // Purchase Orders
  async listOrders(params = {}) {
    const response = await apiClient.get('/purchase-orders', { params });
    return response.data.data;
  },

  async getOrder(id) {
    const response = await apiClient.get(`/purchase-orders/${id}`);
    return response.data.data;
  },

  async createOrder(data) {
    const response = await apiClient.post('/purchase-orders', data);
    return response.data.data;
  },

  async updateOrder(id, data) {
    const response = await apiClient.put(`/purchase-orders/${id}`, data);
    return response.data.data;
  },

  async deleteOrder(id) {
    await apiClient.delete(`/purchase-orders/${id}`);
  },

  async approveOrder(id) {
    const response = await apiClient.post(`/purchase-orders/${id}/approve`);
    return response.data.data;
  },

  async receiveOrder(id, data) {
    const response = await apiClient.post(`/purchase-orders/${id}/receive`, data);
    return response.data.data;
  },

  async createBillFromPO(poId) {
    const response = await apiClient.post(`/purchase-orders/${poId}/bill`);
    return response.data.data;
  },

  // RFQs (Request for Quotations)
  async listRFQs(params = {}) {
    const response = await apiClient.get('/rfqs', { params });
    return response.data.data;
  },

  async getRFQ(id) {
    const response = await apiClient.get(`/rfqs/${id}`);
    return response.data.data;
  },

  async createRFQ(data) {
    const response = await apiClient.post('/rfqs', data);
    return response.data.data;
  },

  async updateRFQ(id, data) {
    const response = await apiClient.put(`/rfqs/${id}`, data);
    return response.data.data;
  },

  async deleteRFQ(id) {
    await apiClient.delete(`/rfqs/${id}`);
  },

  async openRFQ(id) {
    const response = await apiClient.post(`/rfqs/${id}/open`);
    return response.data.data;
  },

  async submitRFQResponse(rfqId, data) {
    const response = await apiClient.post(`/rfqs/${rfqId}/responses`, data);
    return response.data.data;
  },

  async selectRFQWinner(rfqId, responseId) {
    const response = await apiClient.post(`/rfqs/${rfqId}/select-winner`, { response_id: responseId });
    return response.data.data;
  },

  async convertRFQToPO(rfqId) {
    const response = await apiClient.post(`/rfqs/${rfqId}/convert-to-po`);
    return response.data.data;
  },

  // Contracts
  async listContracts(params = {}) {
    const response = await apiClient.get('/contracts', { params });
    return response.data.data;
  },

  async getContract(id) {
    const response = await apiClient.get(`/contracts/${id}`);
    return response.data.data;
  },

  async createContract(data) {
    const response = await apiClient.post('/contracts', data);
    return response.data.data;
  },

  async updateContract(id, data) {
    const response = await apiClient.put(`/contracts/${id}`, data);
    return response.data.data;
  },

  async deleteContract(id) {
    await apiClient.delete(`/contracts/${id}`);
  },

  async activateContract(id) {
    const response = await apiClient.post(`/contracts/${id}/activate`);
    return response.data.data;
  },

  async terminateContract(id) {
    const response = await apiClient.post(`/contracts/${id}/terminate`);
    return response.data.data;
  },

  // Purchase Requisitions
  async listRequisitions(params = {}) {
    const response = await apiClient.get('/purchase-requisitions', { params });
    return response.data.data;
  },

  async getRequisition(id) {
    const response = await apiClient.get(`/purchase-requisitions/${id}`);
    return response.data.data;
  },

  async createRequisition(data) {
    const response = await apiClient.post('/purchase-requisitions', data);
    return response.data.data;
  },

  async updateRequisition(id, data) {
    const response = await apiClient.put(`/purchase-requisitions/${id}`, data);
    return response.data.data;
  },

  async deleteRequisition(id) {
    await apiClient.delete(`/purchase-requisitions/${id}`);
  },

  async submitRequisition(id) {
    const response = await apiClient.post(`/purchase-requisitions/${id}/submit`);
    return response.data.data;
  },

  async approveRequisition(id, data) {
    const response = await apiClient.post(`/purchase-requisitions/${id}/approve`, data);
    return response.data.data;
  },

  async rejectRequisition(id, data) {
    const response = await apiClient.post(`/purchase-requisitions/${id}/reject`, data);
    return response.data.data;
  },

  async convertRequisitionToPO(id, data) {
    const response = await apiClient.post(`/purchase-requisitions/${id}/convert-to-po`, data);
    return response.data.data;
  },

  // Goods Receipts
  async listGoodsReceipts(params = {}) {
    const response = await apiClient.get('/goods-receipts', { params });
    return response.data.data;
  },

  async getGoodsReceipt(id) {
    const response = await apiClient.get(`/goods-receipts/${id}`);
    return response.data.data;
  },

  async createGoodsReceipt(data) {
    const response = await apiClient.post('/goods-receipts', data);
    return response.data.data;
  },

  async deleteGoodsReceipt(id) {
    await apiClient.delete(`/goods-receipts/${id}`);
  },

  async inspectGoodsReceipt(id, data) {
    const response = await apiClient.post(`/goods-receipts/${id}/inspect`, data);
    return response.data.data;
  },

  async completeGoodsReceipt(id, data) {
    const response = await apiClient.post(`/goods-receipts/${id}/complete`, data);
    return response.data.data;
  },

  async cancelGoodsReceipt(id) {
    const response = await apiClient.post(`/goods-receipts/${id}/cancel`);
    return response.data.data;
  },

  async getGRForLandedCost(id) {
    const response = await apiClient.get(`/goods-receipts/${id}/landed-cost-data`);
    return response.data.data;
  },

  // Landed Costs
  async listLandedCosts(params = {}) {
    const response = await apiClient.get('/landed-costs', { params });
    return response.data.data;
  },

  async getLandedCost(id) {
    const response = await apiClient.get(`/landed-costs/${id}`);
    return response.data.data;
  },

  async createLandedCost(data) {
    const response = await apiClient.post('/landed-costs', data);
    return response.data.data;
  },

  async validateLandedCost(id) {
    const response = await apiClient.post(`/landed-costs/${id}/validate`);
    return response.data.data;
  },

  async cancelLandedCost(id) {
    const response = await apiClient.post(`/landed-costs/${id}/cancel`);
    return response.data.data;
  },

  // Landed Cost Types
  async listLandedCostTypes() {
    const response = await apiClient.get('/landed-cost-types');
    return response.data.data;
  },

  async createLandedCostType(data) {
    const response = await apiClient.post('/landed-cost-types', data);
    return response.data.data;
  },

  // Purchase Returns
  async listReturns(params = {}) {
    const response = await apiClient.get('/purchase-returns', { params });
    return response.data.data;
  },

  async getReturn(id) {
    const response = await apiClient.get(`/purchase-returns/${id}`);
    return response.data.data;
  },

  async createReturn(data) {
    const response = await apiClient.post('/purchase-returns', data);
    return response.data.data;
  },

  async deleteReturn(id) {
    await apiClient.delete(`/purchase-returns/${id}`);
  },

  async submitReturn(id) {
    const response = await apiClient.post(`/purchase-returns/${id}/submit`);
    return response.data.data;
  },

  async approveReturn(id, data) {
    const response = await apiClient.post(`/purchase-returns/${id}/approve`, data);
    return response.data.data;
  },

  async rejectReturn(id, data) {
    const response = await apiClient.post(`/purchase-returns/${id}/reject`, data);
    return response.data.data;
  },

  async shipReturn(id, data) {
    const response = await apiClient.post(`/purchase-returns/${id}/ship`, data);
    return response.data.data;
  },

  async receiveReturn(id, data) {
    const response = await apiClient.post(`/purchase-returns/${id}/receive`, data);
    return response.data.data;
  },

  async applyCreditNote(id, data) {
    const response = await apiClient.post(`/purchase-returns/${id}/credit`, data);
    return response.data.data;
  },

  async cancelReturn(id) {
    const response = await apiClient.post(`/purchase-returns/${id}/cancel`);
    return response.data.data;
  },

  // Price History
  async listPriceHistory(params = {}) {
    const response = await apiClient.get('/price-history', { params });
    return response.data.data;
  },

  async listPriceHistoryGrouped(params = {}) {
    const response = await apiClient.get('/price-history', { params: { ...params, grouped: true } });
    return response.data.data;
  },

  async getPriceHistory(id) {
    const response = await apiClient.get(`/price-history/${id}`);
    return response.data.data;
  },

  async createPriceHistory(data) {
    const response = await apiClient.post('/price-history', data);
    return response.data.data;
  },

  async deletePriceHistory(id) {
    await apiClient.delete(`/price-history/${id}`);
  },

  // Vendor Prices (pricelist)
  async listVendorPrices(params = {}) {
    const response = await apiClient.get('/vendor-prices', { params });
    return response.data.data;
  },

  async getVendorPrice(id) {
    const response = await apiClient.get(`/vendor-prices/${id}`);
    return response.data.data;
  },

  async createVendorPrice(data) {
    const response = await apiClient.post('/vendor-prices', data);
    return response.data.data;
  },

  async updateVendorPrice(id, data) {
    const response = await apiClient.put(`/vendor-prices/${id}`, data);
    return response.data.data;
  },

  async deleteVendorPrice(id) {
    await apiClient.delete(`/vendor-prices/${id}`);
  },

  // Lookup vendor price for a specific vendor+product combination
  async lookupVendorPrice(vendorId, productId) {
    try {
      const response = await apiClient.get('/vendor-prices/lookup', {
        params: { vendor_id: vendorId, product_id: productId }
      });
      return response.data.data;
    } catch (error) {
      // Return null if no price found (404)
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Blanket Orders (Standing Orders / Call-off Contracts)
  async listBlanketOrders(params = {}) {
    const response = await apiClient.get('/blanket-orders', { params });
    return response.data.data;
  },

  async getBlanketOrder(id) {
    const response = await apiClient.get(`/blanket-orders/${id}`);
    return response.data.data;
  },

  async createBlanketOrder(data) {
    const response = await apiClient.post('/blanket-orders', data);
    return response.data.data;
  },

  async updateBlanketOrder(id, data) {
    const response = await apiClient.put(`/blanket-orders/${id}`, data);
    return response.data.data;
  },

  async deleteBlanketOrder(id) {
    await apiClient.delete(`/blanket-orders/${id}`);
  },

  async activateBlanketOrder(id) {
    const response = await apiClient.post(`/blanket-orders/${id}/activate`);
    return response.data.data;
  },

  // Blanket Order Releases (Call-offs)
  async listBlanketOrderReleases(blanketOrderId) {
    const response = await apiClient.get(`/blanket-orders/${blanketOrderId}/releases`);
    return response.data.data;
  },

  async createBlanketOrderRelease(blanketOrderId, data) {
    const response = await apiClient.post(`/blanket-orders/${blanketOrderId}/releases`, data);
    return response.data.data;
  },

  async confirmBlanketOrderRelease(blanketOrderId, releaseId) {
    const response = await apiClient.post(`/blanket-orders/${blanketOrderId}/releases/${releaseId}/confirm`);
    return response.data.data;
  },

  async cancelBlanketOrderRelease(blanketOrderId, releaseId) {
    const response = await apiClient.post(`/blanket-orders/${blanketOrderId}/releases/${releaseId}/cancel`);
    return response.data.data;
  },

  // Procurement Rules
  async listProcurementRules(params = {}) {
    const response = await apiClient.get('/procurement-rules', { params });
    return response.data.data;
  },

  async getProcurementRule(id) {
    const response = await apiClient.get(`/procurement-rules/${id}`);
    return response.data.data;
  },

  async createProcurementRule(data) {
    const response = await apiClient.post('/procurement-rules', data);
    return response.data.data;
  },

  async updateProcurementRule(id, data) {
    const response = await apiClient.put(`/procurement-rules/${id}`, data);
    return response.data.data;
  },

  async deleteProcurementRule(id) {
    await apiClient.delete(`/procurement-rules/${id}`);
  },

  // Approval Workflows
  async getMyPendingApprovals(params = {}) {
    const response = await apiClient.get('/approval-workflows/my-approvals', { params });
    return response.data.data;
  },

  async getWorkflowByDocument(documentType, documentId) {
    const response = await apiClient.get('/approval-workflows/by-document', {
      params: { document_type: documentType, document_id: documentId }
    });
    return response.data.data;
  },

  async getApprovalWorkflow(id) {
    const response = await apiClient.get(`/approval-workflows/${id}`);
    return response.data.data;
  },

  async approveWorkflowStep(workflowId, comments = '') {
    const response = await apiClient.post(`/approval-workflows/${workflowId}/approve`, { comments });
    return response.data.data;
  },

  async rejectWorkflowStep(workflowId, comments) {
    const response = await apiClient.post(`/approval-workflows/${workflowId}/reject`, { comments });
    return response.data.data;
  },

  // Submit PO for approval (with rule evaluation)
  async submitPOForApproval(orderId) {
    const response = await apiClient.post(`/purchase-orders/${orderId}/submit`);
    return response.data.data;
  },
};

export default procurementService;
