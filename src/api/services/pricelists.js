import apiClient from '../client';

export const pricelistsService = {
  // List all pricelists
  async list(params = {}) {
    try {
      const response = await apiClient.get('/pricelists', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error fetching pricelists:', error);
      throw error;
    }
  },

  // Get a single pricelist with items
  async get(id) {
    try {
      const response = await apiClient.get(`/pricelists/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching pricelist:', error);
      throw error;
    }
  },

  // Create a new pricelist
  async create(data) {
    try {
      const response = await apiClient.post('/pricelists', data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating pricelist:', error);
      throw error;
    }
  },

  // Update a pricelist
  async update(id, data) {
    try {
      const response = await apiClient.put(`/pricelists/${id}`, data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating pricelist:', error);
      throw error;
    }
  },

  // Delete a pricelist
  async delete(id) {
    try {
      const response = await apiClient.delete(`/pricelists/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error deleting pricelist:', error);
      throw error;
    }
  },

  // Get default pricelist
  async getDefault() {
    try {
      const response = await apiClient.get('/pricelists/default');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching default pricelist:', error);
      throw error;
    }
  },

  // Set a pricelist as default
  async setDefault(id) {
    try {
      const response = await apiClient.post(`/pricelists/${id}/set-default`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error setting default pricelist:', error);
      throw error;
    }
  },

  // Get computed price for a product
  async getProductPrice(data) {
    try {
      const response = await apiClient.post('/pricelists/get-price', data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error getting product price:', error);
      throw error;
    }
  },

  // Get computed prices for multiple products
  async getBulkPrices(data) {
    try {
      const response = await apiClient.post('/pricelists/get-bulk-prices', data);
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error getting bulk prices:', error);
      throw error;
    }
  },

  // Assign a pricelist to a customer
  async assignToCustomer(data) {
    try {
      const response = await apiClient.post('/pricelists/assign-customer', data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error assigning pricelist to customer:', error);
      throw error;
    }
  },
};

export default pricelistsService;
