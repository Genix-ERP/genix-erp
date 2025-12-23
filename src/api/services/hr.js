import apiClient from '../client';

export const hrService = {
  // Employees
  async listEmployees(params = {}) {
    const response = await apiClient.get('/employees', { params });
    return response.data.data;
  },

  async getEmployee(id) {
    const response = await apiClient.get(`/employees/${id}`);
    return response.data.data;
  },

  async createEmployee(data) {
    const response = await apiClient.post('/employees', data);
    return response.data.data;
  },

  async updateEmployee(id, data) {
    const response = await apiClient.put(`/employees/${id}`, data);
    return response.data.data;
  },

  async deleteEmployee(id) {
    await apiClient.delete(`/employees/${id}`);
  },
};

export default hrService;
