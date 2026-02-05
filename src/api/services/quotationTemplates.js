import apiClient from '../client';

export const quotationTemplatesService = {
  // List all quotation templates
  async listTemplates(params = {}) {
    const response = await apiClient.get('/quotation-templates', { params });
    return response.data.data;
  },

  // Get a single quotation template
  async getTemplate(id) {
    const response = await apiClient.get(`/quotation-templates/${id}`);
    return response.data.data;
  },

  // Create a new quotation template
  async createTemplate(data) {
    const response = await apiClient.post('/quotation-templates', data);
    return response.data.data;
  },

  // Update an existing quotation template
  async updateTemplate(id, data) {
    const response = await apiClient.put(`/quotation-templates/${id}`, data);
    return response.data.data;
  },

  // Delete a quotation template
  async deleteTemplate(id) {
    await apiClient.delete(`/quotation-templates/${id}`);
  },

  // Duplicate a quotation template
  async duplicateTemplate(id) {
    const response = await apiClient.post(`/quotation-templates/${id}/duplicate`);
    return response.data.data;
  },
};

export default quotationTemplatesService;
