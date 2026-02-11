import apiClient from '../client';

export const constructionService = {
  // =====================================================
  // CONSTRUCTION PROJECTS
  // =====================================================

  async listProjects(params = {}) {
    const response = await apiClient.get('/construction/projects', { params });
    return response.data.data;
  },

  async getProject(id) {
    const response = await apiClient.get(`/construction/projects/${id}`);
    return response.data.data;
  },

  async createProject(data) {
    const response = await apiClient.post('/construction/projects', data);
    return response.data.data;
  },

  async updateProject(id, data) {
    const response = await apiClient.put(`/construction/projects/${id}`, data);
    return response.data.data;
  },

  async deleteProject(id) {
    await apiClient.delete(`/construction/projects/${id}`);
  },

  async getProjectDashboard(id) {
    const response = await apiClient.get(`/construction/projects/${id}/dashboard`);
    return response.data.data;
  },

  // =====================================================
  // BUILDINGS/BLOCKS
  // =====================================================

  async listBuildings(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/buildings`);
    return response.data.data;
  },

  async createBuilding(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/buildings`, data);
    return response.data.data;
  },

  async updateBuilding(projectId, buildingId, data) {
    const response = await apiClient.put(`/construction/projects/${projectId}/buildings/${buildingId}`, data);
    return response.data.data;
  },

  async deleteBuilding(projectId, buildingId) {
    await apiClient.delete(`/construction/projects/${projectId}/buildings/${buildingId}`);
  },

  // =====================================================
  // SMETA SECTIONS
  // =====================================================

  async listSections(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/sections`);
    return response.data.data;
  },

  async createSection(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/sections`, data);
    return response.data.data;
  },

  async updateSection(id, data) {
    const response = await apiClient.put(`/construction/sections/${id}`, data);
    return response.data.data;
  },

  async deleteSection(id) {
    await apiClient.delete(`/construction/sections/${id}`);
  },

  async approveSection(id) {
    const response = await apiClient.put(`/construction/sections/${id}`, { status: 'approved' });
    return response.data.data;
  },

  // =====================================================
  // SMETA ITEMS
  // =====================================================

  async listItems(sectionId) {
    const response = await apiClient.get(`/construction/sections/${sectionId}/items`);
    return response.data.data;
  },

  async createItem(sectionId, data) {
    const response = await apiClient.post(`/construction/sections/${sectionId}/items`, data);
    return response.data.data;
  },

  async updateItem(id, data) {
    const response = await apiClient.put(`/construction/smeta-items/${id}`, data);
    return response.data.data;
  },

  async deleteItem(id) {
    await apiClient.delete(`/construction/smeta-items/${id}`);
  },

  // =====================================================
  // SMETA RESOURCES (Future)
  // =====================================================

  async listResources(itemId) {
    const response = await apiClient.get(`/construction/smeta-items/${itemId}/resources`);
    return response.data.data;
  },

  async createResource(itemId, data) {
    const response = await apiClient.post(`/construction/smeta-items/${itemId}/resources`, data);
    return response.data.data;
  },

  // =====================================================
  // PHOTO REPORTS (Future)
  // =====================================================

  async listPhotoReports(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/photo-reports`, { params });
    return response.data.data;
  },

  async createPhotoReport(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/photo-reports`, data);
    return response.data.data;
  },

  async reviewPhotoReport(id, data) {
    const response = await apiClient.put(`/construction/photo-reports/${id}/review`, data);
    return response.data.data;
  },

  // =====================================================
  // DAILY REPORTS (Future)
  // =====================================================

  async listDailyReports(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/daily-reports`, { params });
    return response.data.data;
  },

  async createDailyReport(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/daily-reports`, data);
    return response.data.data;
  },

  async verifyDailyReport(id, data) {
    const response = await apiClient.put(`/construction/daily-reports/${id}/verify`, data);
    return response.data.data;
  },

  async getDailyReport(id) {
    const response = await apiClient.get(`/construction/daily-reports/${id}`);
    return response.data.data;
  },

  async updateDailyReport(id, data) {
    const response = await apiClient.put(`/construction/daily-reports/${id}`, data);
    return response.data.data;
  },

  async deleteDailyReport(id) {
    await apiClient.delete(`/construction/daily-reports/${id}`);
  },

  // =====================================================
  // WORK PROGRESS (KS-2) (Future)
  // =====================================================

  async recordProgress(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/progress`, data);
    return response.data.data;
  },

  async verifyProgress(id, data) {
    const response = await apiClient.put(`/construction/progress/${id}/verify`, data);
    return response.data.data;
  },

  async getPlanVsActual(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/plan-vs-actual`);
    return response.data.data;
  },

  // =====================================================
  // MATERIAL REQUESTS (Future)
  // =====================================================

  async listMaterialRequests(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/material-requests`);
    return response.data.data;
  },

  async createMaterialRequest(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/material-requests`, data);
    return response.data.data;
  },

  async approveMaterialRequest(id, data) {
    const response = await apiClient.put(`/construction/material-requests/${id}/approve`, data);
    return response.data.data;
  },

  async updateMaterialRequest(id, data) {
    const response = await apiClient.put(`/construction/material-requests/${id}`, data);
    return response.data.data;
  },

  async deleteMaterialRequest(id) {
    await apiClient.delete(`/construction/material-requests/${id}`);
  },

  // =====================================================
  // PROJECT VENDORS (Future)
  // =====================================================

  async listProjectVendors(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/vendors`);
    return response.data.data;
  },

  async addProjectVendor(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/vendors`, data);
    return response.data.data;
  },

  async updateProjectVendor(id, data) {
    const response = await apiClient.put(`/construction/project-vendors/${id}`, data);
    return response.data.data;
  },

  async removeProjectVendor(id) {
    await apiClient.delete(`/construction/project-vendors/${id}`);
  },

  async getVendorSummary(id) {
    const response = await apiClient.get(`/construction/project-vendors/${id}/summary`);
    return response.data.data;
  },

  // =====================================================
  // MATERIAL DELIVERIES (Future)
  // =====================================================

  async listDeliveries(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/deliveries`);
    return response.data.data;
  },

  async createDelivery(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/deliveries`, data);
    return response.data.data;
  },

  async receiveDelivery(id, data) {
    const response = await apiClient.put(`/construction/deliveries/${id}/receive`, data);
    return response.data.data;
  },

  async inspectDelivery(id, data) {
    const response = await apiClient.put(`/construction/deliveries/${id}/inspect`, data);
    return response.data.data;
  },

  // =====================================================
  // SITE WAREHOUSES (Future)
  // =====================================================

  async listSiteWarehouses(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/warehouses`);
    return response.data.data;
  },

  async createSiteWarehouse(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/warehouses`, data);
    return response.data.data;
  },

  async getSiteInventory(warehouseId) {
    const response = await apiClient.get(`/construction/site-warehouses/${warehouseId}/inventory`);
    return response.data.data;
  },

  // =====================================================
  // PROJECT TEAM MEMBERS
  // =====================================================

  async listTeamMembers(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/team`);
    return response.data.data;
  },

  async addTeamMember(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/team`, data);
    return response.data.data;
  },

  async removeTeamMember(projectId, memberId) {
    await apiClient.delete(`/construction/projects/${projectId}/team/${memberId}`);
  },

  // =====================================================
  // VENDOR PAYMENTS (Future)
  // =====================================================

  async listVendorPayments(vendorId) {
    const response = await apiClient.get(`/construction/project-vendors/${vendorId}/payments`);
    return response.data.data;
  },

  async createPaymentMilestone(vendorId, data) {
    const response = await apiClient.post(`/construction/project-vendors/${vendorId}/payments`, data);
    return response.data.data;
  },

  async recordPayment(id, data) {
    const response = await apiClient.put(`/construction/vendor-payments/${id}/pay`, data);
    return response.data.data;
  },

  // =====================================================
  // ORGANIZATIONS (for vendor selection)
  // =====================================================

  async listOrganizations() {
    const response = await apiClient.get('/organizations');
    return response.data.data;
  },
};

export default constructionService;
