import apiClient from '../client';

export const procurementService = {
  // Suppliers
  async listSuppliers(params = {}) {
    const response = await apiClient.get('/contacts', {
      params: { ...params, type: 'vendor' }
    });
    return response.data.data;
  },

  async getSupplier(id) {
    const response = await apiClient.get(`/contacts/${id}`);
    return response.data.data;
  },

  async createSupplier(data) {
    // Backend expects 'type' not 'contact_type', and 'name' is required
    // Backend requires 'code' with validation - generate if not provided
    const payload = {
      ...data,
      type: 'vendor',
      name: data.name,
      code: data.code || `VEN-${Date.now()}`,
    };
    const response = await apiClient.post('/contacts', payload);
    return response.data.data;
  },

  async updateSupplier(id, data) {
    const response = await apiClient.put(`/contacts/${id}`, data);
    return response.data.data;
  },

  async deleteSupplier(id) {
    await apiClient.delete(`/contacts/${id}`);
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
};

export default procurementService;
