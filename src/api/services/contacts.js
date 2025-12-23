import apiClient from '../client';

export const contactsService = {
  // List all contacts (customers/vendors)
  async list(params = {}) {
    const response = await apiClient.get('/contacts', { params });
    return response.data.data;
  },

  // Get a single contact
  async get(id) {
    const response = await apiClient.get(`/contacts/${id}`);
    return response.data.data;
  },

  // Create a new contact
  async create(data) {
    const response = await apiClient.post('/contacts', data);
    return response.data.data;
  },

  // Update a contact
  async update(id, data) {
    const response = await apiClient.put(`/contacts/${id}`, data);
    return response.data.data;
  },

  // Delete a contact
  async delete(id) {
    await apiClient.delete(`/contacts/${id}`);
  },

  // List contact persons for a contact
  async listPersons(contactId) {
    const response = await apiClient.get(`/contacts/${contactId}/persons`);
    return response.data.data;
  },

  // Create a contact person
  async createPerson(contactId, data) {
    const response = await apiClient.post(`/contacts/${contactId}/persons`, data);
    return response.data.data;
  },
};

export default contactsService;
