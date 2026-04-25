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
  // BUILDING FILES
  // =====================================================

  async listBuildingFiles(projectId, buildingId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/buildings/${buildingId}/files`);
    return response.data.data;
  },

  async createBuildingFile(projectId, buildingId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/buildings/${buildingId}/files`, data);
    return response.data.data;
  },

  async deleteBuildingFile(projectId, buildingId, fileId) {
    await apiClient.delete(`/construction/projects/${projectId}/buildings/${buildingId}/files/${fileId}`);
  },

  // =====================================================
  // PROJECT FILES
  // =====================================================

  async listProjectFiles(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/files`);
    return response.data.data;
  },

  async createProjectFile(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/files`, data);
    return response.data.data;
  },

  async deleteProjectFile(projectId, fileId) {
    await apiClient.delete(`/construction/projects/${projectId}/files/${fileId}`);
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

  async getPhotoReport(id) {
    const response = await apiClient.get(`/construction/photo-reports/${id}`);
    return response.data.data;
  },

  async updatePhotoReport(id, data) {
    const response = await apiClient.put(`/construction/photo-reports/${id}`, data);
    return response.data.data;
  },

  async deletePhotoReport(id) {
    const response = await apiClient.delete(`/construction/photo-reports/${id}`);
    return response.data;
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

  async listProjectMaterials(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/project-materials`);
    return response.data.data;
  },

  // Estimate resources by type (for substage dropdowns)
  async listEstimateResources(projectId, type) {
    const params = type ? { type } : {};
    const response = await apiClient.get(`/construction/projects/${projectId}/estimate-resources`, { params });
    return response.data.data;
  },

  // Resource prices — backs the Smeta boshqaruvi → Resurslar tab.
  // Wraps the bulk-edit + history endpoints introduced by migration 348.
  // `estimateId` is optional. When supplied, the catalog is scoped to the
  // resources used by that one estimate so the Resurslar tab stays in sync
  // with the estimate selector at the top of the page. Without it, the
  // response covers every estimate in the project (mockup-faithful behaviour).
  async listResourcePrices(projectId, { type, estimateId } = {}) {
    const params = {};
    if (type) params.type = type;
    if (estimateId) params.estimate_id = estimateId;
    const response = await apiClient.get(`/construction/projects/${projectId}/resource-prices`, { params });
    return response.data.data || [];
  },
  async bulkUpdateResourcePrice(projectId, payload) {
    // payload: { resource_name, uom, resource_type, new_price, note? }
    const response = await apiClient.post(`/construction/projects/${projectId}/resource-prices/bulk-update`, payload);
    return response.data.data;
  },
  async bulkUpdateResourceMaterialType(projectId, payload) {
    // payload: { resource_name, uom, material_type }
    const response = await apiClient.post(`/construction/projects/${projectId}/resource-prices/material-type`, payload);
    return response.data.data;
  },
  async getResourcePriceHistory(projectId, { name, uom } = {}) {
    const params = { name };
    if (uom) params.uom = uom;
    const response = await apiClient.get(`/construction/projects/${projectId}/resource-prices/history`, { params });
    return response.data.data || [];
  },
  // Reset endpoints (migration 349 anchors).
  // Per-resource: revert unit_rate to original_unit_rate for every matching line.
  async resetResourcePrice(projectId, payload) {
    // payload: { resource_name, uom }
    const response = await apiClient.post(`/construction/projects/${projectId}/resource-prices/reset`, payload);
    return response.data.data;
  },
  // Project-wide: revert every line's price to its original anchor.
  async resetAllResourcePrices(projectId) {
    const response = await apiClient.post(`/construction/projects/${projectId}/resource-prices/reset-all`, {});
    return response.data.data;
  },
  // Per-line: revert one work's quantity to original_quantity. The handler
  // also re-derives any non-override sub-line quantities downstream.
  async resetLineQuantity(estimateId, lineId) {
    const response = await apiClient.post(
      `/construction/estimates/${estimateId}/lines/${lineId}/reset-quantity`,
      {},
    );
    return response.data.data;
  },
  // Bulk: zero every top-level work qty in the estimate. Cascades to
  // non-override sub-line qtys via parent.qty × norm_rate. Used by the
  // "Reset all quantities" button on Smeta boshqaruvi.
  async resetAllEstimateQuantities(estimateId) {
    const response = await apiClient.post(
      `/construction/estimates/${estimateId}/reset-quantities`,
      {},
    );
    return response.data.data;
  },

  // =====================================================
  // FORMA 2 SNAPSHOTS  (Smeta boshqaruvi → Tarix tab)
  // =====================================================
  // Saved versions of a Form 2 (KS-2) document for an estimate. The list
  // endpoint omits the heavy snapshot_data payload; call getForm2Snapshot
  // to fetch the full saved state when re-opening a row.

  async listForm2Snapshots(estimateId) {
    const response = await apiClient.get(
      `/construction/estimates/${estimateId}/form2-snapshots`,
    );
    return response.data.data || [];
  },

  async getForm2Snapshot(snapshotId) {
    const response = await apiClient.get(
      `/construction/form2-snapshots/${snapshotId}`,
    );
    return response.data.data;
  },

  async createForm2Snapshot(estimateId, payload) {
    // payload: {
    //   period_from, period_to,           // ISO date strings or null
    //   other_costs_pct, use_vat,
    //   total_with_vat, total_without_vat,
    //   construction_total, equipment_total,
    //   act_number,                       // optional KS-2 number
    //   snapshot_data,                    // full JSON state of the lines
    // }
    const response = await apiClient.post(
      `/construction/estimates/${estimateId}/form2-snapshots`,
      payload,
    );
    return response.data.data;
  },

  async deleteForm2Snapshot(snapshotId) {
    const response = await apiClient.delete(
      `/construction/form2-snapshots/${snapshotId}`,
    );
    return response.data.data;
  },

  // =====================================================
  // SMETA AUDIT LOG  (Smeta boshqaruvi → Jurnal tab)
  // =====================================================

  async listSmetaAudit(estimateId, { limit = 200, action } = {}) {
    const params = { limit };
    if (action) params.action = action;
    const response = await apiClient.get(
      `/construction/estimates/${estimateId}/audit`,
      { params },
    );
    return response.data.data || [];
  },

  async listProjectSmetaAudit(projectId, { limit = 500 } = {}) {
    const response = await apiClient.get(
      `/construction/projects/${projectId}/smeta-audit`,
      { params: { limit } },
    );
    return response.data.data || [];
  },

  // =====================================================
  // BOSQICHLAR v2  — work approval workflow
  // =====================================================
  // Per construction_module_v2.html. Each "work" is a construction_estimate_line
  // row with an approval_status field (migration 353). Three roles drive the
  // transitions: foreman / supervisor / engineer.
  //
  // The frontend resolves the user's role for a project via getMyProjectRole;
  // the backend enforces it again on every transition.

  async getMyProjectRole(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/my-role`);
    return response.data.data; // { role, assigned }
  },

  // Foreman.
  async updateWorkDoneQuantity(workId, doneQuantity) {
    const response = await apiClient.post(
      `/construction/works/${workId}/done-quantity`,
      { done_quantity: Number(doneQuantity) || 0 },
    );
    return response.data.data;
  },
  async submitWork(workId) {
    const response = await apiClient.post(`/construction/works/${workId}/submit`, {});
    return response.data.data;
  },
  async bulkSubmitWorks(workIds) {
    const response = await apiClient.post(
      `/construction/works/bulk-submit`,
      { work_ids: workIds },
    );
    return response.data.data;
  },

  // Supervisor.
  async confirmWorkSupervisor(workId) {
    const response = await apiClient.post(`/construction/works/${workId}/confirm-supervisor`, {});
    return response.data.data;
  },
  async rejectWorkSupervisor(workId, note = '') {
    const response = await apiClient.post(
      `/construction/works/${workId}/reject-supervisor`,
      { note },
    );
    return response.data.data;
  },
  async bulkConfirmSupervisor(workIds) {
    const response = await apiClient.post(
      `/construction/works/bulk-confirm-supervisor`,
      { work_ids: workIds },
    );
    return response.data.data;
  },

  // Engineer (final).
  async confirmWorkEngineer(workId) {
    const response = await apiClient.post(`/construction/works/${workId}/confirm-engineer`, {});
    return response.data.data;
  },
  async rejectWorkEngineer(workId, note = '') {
    const response = await apiClient.post(
      `/construction/works/${workId}/reject-engineer`,
      { note },
    );
    return response.data.data;
  },
  async bulkConfirmEngineer(workIds) {
    const response = await apiClient.post(
      `/construction/works/bulk-confirm-engineer`,
      { work_ids: workIds },
    );
    return response.data.data;
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

  async updateTeamMember(projectId, memberId, data) {
    const response = await apiClient.put(`/construction/projects/${projectId}/team/${memberId}`, data);
    return response.data.data;
  },

  async transferTeamMember(projectId, memberId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/team/${memberId}/transfer`, data);
    return response.data.data;
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
  // WBS (Work Breakdown Structure)
  // =====================================================

  async listWBS(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/wbs`, { params });
    return response.data.data;
  },

  async getWBSTree(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/wbs/tree`, { params });
    return response.data.data;
  },

  async createWBS(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/wbs`, data);
    return response.data.data;
  },

  async updateWBS(id, data) {
    const response = await apiClient.put(`/construction/wbs/${id}`, data);
    return response.data.data;
  },

  async deleteWBS(id) {
    await apiClient.delete(`/construction/wbs/${id}`);
  },

  async reorderWBS(items) {
    const response = await apiClient.post('/construction/wbs/reorder', { items });
    return response.data.data;
  },

  // =====================================================
  // ACTIVITY LOG
  // =====================================================

  async listActivityLog(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/activity-log`, { params });
    return response.data;
  },

  // =====================================================
  // ESTIMATES (Versioned Smeta)
  // =====================================================

  async listEstimates(projectId, { scope } = {}) {
    const params = scope ? { scope } : {};
    const response = await apiClient.get(`/construction/projects/${projectId}/estimates`, { params });
    return response.data.data;
  },

  async getEstimate(id) {
    const response = await apiClient.get(`/construction/estimates/${id}`);
    return response.data.data;
  },

  async createEstimate(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/estimates`, data);
    return response.data.data;
  },

  async updateEstimate(id, data) {
    const response = await apiClient.put(`/construction/estimates/${id}`, data);
    return response.data.data;
  },

  async deleteEstimate(id) {
    await apiClient.delete(`/construction/estimates/${id}`);
  },

  async approveEstimate(id) {
    const response = await apiClient.post(`/construction/estimates/${id}/approve`);
    return response.data.data;
  },

  async duplicateEstimate(id) {
    const response = await apiClient.post(`/construction/estimates/${id}/duplicate`);
    return response.data.data;
  },

  // Estimate Lines — supports pagination via params { page, page_size }
  async listEstimateLines(estimateId, params = {}) {
    // Default to large page_size for callers that don't paginate
    const queryParams = { page_size: 5000, ...params };
    const response = await apiClient.get(`/construction/estimates/${estimateId}/lines`, { params: queryParams });
    return response.data.data;
  },

  // Paginated version — returns { data, meta }
  async listEstimateLinesPaginated(estimateId, params = {}) {
    const response = await apiClient.get(`/construction/estimates/${estimateId}/lines`, { params });
    return { data: response.data.data, meta: response.data.meta };
  },

  async createEstimateLine(estimateId, data) {
    const response = await apiClient.post(`/construction/estimates/${estimateId}/lines`, data);
    return response.data.data;
  },

  async bulkCreateEstimateLines(estimateId, lines, { replace = false, sourceType = '', sourceFileName = '' } = {}) {
    // `source_file_name` lets the backend dedupe auto-created Forma 2
    // drafts across estimates extracted from the same uploaded Excel
    // file — see migration 339 and autoCreateForma2FromEstimate.
    const response = await apiClient.post(`/construction/estimates/${estimateId}/lines/bulk`, {
      lines,
      replace,
      source_type: sourceType,
      source_file_name: sourceFileName,
    });
    return response.data.data;
  },

  async createProductsFromEstimate(estimateId) {
    const response = await apiClient.post(`/construction/estimates/${estimateId}/create-products`);
    return response.data.data;
  },

  async updateEstimateLine(estimateId, lineId, data) {
    const response = await apiClient.put(`/construction/estimates/${estimateId}/lines/${lineId}`, data);
    return response.data.data;
  },

  async deleteEstimateLine(estimateId, lineId) {
    await apiClient.delete(`/construction/estimates/${estimateId}/lines/${lineId}`);
  },

  // =====================================================
  // ESTIMATE SUMMARY (Свод)
  // =====================================================

  async listEstimateSummary(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/estimate-summary`);
    return response.data.data;
  },

  async importEstimateSummary(projectId, rows) {
    const response = await apiClient.post(`/construction/projects/${projectId}/estimate-summary/import`, { rows });
    return response.data.data;
  },

  async deleteEstimateSummaryBatch(batchId) {
    await apiClient.delete(`/construction/estimate-summary/${batchId}`);
  },

  // =====================================================
  // CONSTRUCTION DAILY LOGS (WBS-linked progress)
  // =====================================================

  async listConstructionDailyLogs(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/daily-logs`, { params });
    return response.data;
  },

  async createConstructionDailyLog(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/daily-logs`, data);
    return response.data.data;
  },

  async updateConstructionDailyLog(id, data) {
    const response = await apiClient.put(`/construction/daily-logs/${id}`, data);
    return response.data.data;
  },

  async deleteConstructionDailyLog(id) {
    await apiClient.delete(`/construction/daily-logs/${id}`);
  },

  // =====================================================
  // ORGANIZATIONS (for vendor selection)
  // =====================================================

  async listOrganizations() {
    const response = await apiClient.get('/organizations');
    return response.data.data;
  },

  // =====================================================
  // CONSTRUCTION STAGES (Bosqichlar)
  // =====================================================

  // Flat aggregated feed of items that are currently status='in_progress'
  // across the construction module for one project (stages + sub-stages today,
  // pluggable for more sources later). Drives the Jarayon tab.
  async getProjectInProgressItems(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/in-progress`);
    return response.data.data;
  },

  async listStages(projectId, { buildingId } = {}) {
    // Migration 333 — optional building filter. Pass a numeric id to scope
    // stages to one building, 0 for unassigned (project-wide), or nothing for
    // the "Hammasi" tab.
    const params = {};
    if (buildingId !== undefined && buildingId !== null && buildingId !== 'all') {
      params.building_id = Number(buildingId);
    }
    const response = await apiClient.get(`/construction/projects/${projectId}/stages`, { params });
    return response.data.data;
  },

  async createStage(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/stages`, data);
    return response.data.data;
  },

  async updateStage(stageId, data) {
    const response = await apiClient.put(`/construction/stages/${stageId}`, data);
    return response.data.data;
  },

  async deleteStage(stageId) {
    await apiClient.delete(`/construction/stages/${stageId}`);
  },

  async listSubStages(stageId) {
    const response = await apiClient.get(`/construction/stages/${stageId}/sub-stages`);
    return response.data.data;
  },

  async createSubStage(stageId, data) {
    const response = await apiClient.post(`/construction/stages/${stageId}/sub-stages`, data);
    return response.data.data;
  },

  async updateSubStage(subStageId, data) {
    const response = await apiClient.put(`/construction/sub-stages/${subStageId}`, data);
    return response.data.data;
  },

  async deleteSubStage(subStageId) {
    await apiClient.delete(`/construction/sub-stages/${subStageId}`);
  },

  // =====================================================
  // SUB-STAGE MATERIALS
  // =====================================================

  async listSubStageMaterials(subStageId) {
    const response = await apiClient.get(`/construction/sub-stages/${subStageId}/materials`);
    return response.data.data;
  },

  async createSubStageMaterial(subStageId, data) {
    const response = await apiClient.post(`/construction/sub-stages/${subStageId}/materials`, data);
    return response.data.data;
  },

  async updateSubStageMaterial(id, data) {
    const response = await apiClient.put(`/construction/sub-stage-materials/${id}`, data);
    return response.data.data;
  },

  async deleteSubStageMaterial(id) {
    await apiClient.delete(`/construction/sub-stage-materials/${id}`);
  },

  // =====================================================
  // REJA VS FAKT (Plan vs Fact)
  // =====================================================

  async getRejaFakt(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/reja-fakt`, { params });
    return response.data.data;
  },

  // =====================================================
  // SUB-STAGE EQUIPMENT
  // =====================================================

  async listSubStageEquipment(subStageId) {
    const response = await apiClient.get(`/construction/sub-stages/${subStageId}/equipment`);
    return response.data.data;
  },

  async createSubStageEquipment(subStageId, data) {
    const response = await apiClient.post(`/construction/sub-stages/${subStageId}/equipment`, data);
    return response.data.data;
  },

  async updateSubStageEquipment(id, data) {
    const response = await apiClient.put(`/construction/sub-stage-equipment/${id}`, data);
    return response.data.data;
  },

  async deleteSubStageEquipment(id) {
    await apiClient.delete(`/construction/sub-stage-equipment/${id}`);
  },

  async updateSubStageMaterialPlanFact(id, data) {
    const response = await apiClient.put(`/construction/sub-stage-materials/${id}/plan-fact`, data);
    return response.data.data;
  },

  async getRejaFaktAudit(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/reja-fakt/audit`, { params });
    return response.data.data;
  },

  // =====================================================
  // COST CATEGORIES & ACCOUNT MAPPING
  // =====================================================

  async listCostCategories() {
    const response = await apiClient.get('/construction/cost-categories');
    return response.data.data;
  },

  async createCostCategory(data) {
    const response = await apiClient.post('/construction/cost-categories', data);
    return response.data.data;
  },

  async updateCostCategory(id, data) {
    const response = await apiClient.put(`/construction/cost-categories/${id}`, data);
    return response.data.data;
  },

  async getAccountMapping() {
    const response = await apiClient.get('/construction/account-mapping');
    return response.data.data;
  },

  async upsertAccountMapping(entries) {
    // entries: [{key, account_id}, ...]
    const response = await apiClient.put('/construction/account-mapping', entries);
    return response.data.data;
  },

  // =====================================================
  // EXPENSE LINES (Xarajat operatsiyalari)
  // =====================================================

  async listExpenseLines(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/expenses`, { params });
    return response.data.data;
  },

  async createExpenseLine(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/expenses`, data);
    return response.data.data;
  },

  async updateExpenseLine(id, data) {
    const response = await apiClient.put(`/construction/expenses/${id}`, data);
    return response.data.data;
  },

  async deleteExpenseLine(id) {
    await apiClient.delete(`/construction/expenses/${id}`);
  },

  async approveExpenseLine(id) {
    const response = await apiClient.put(`/construction/expenses/${id}/approve`);
    return response.data.data;
  },

  async cancelExpenseLine(id, reason = '') {
    const response = await apiClient.put(`/construction/expenses/${id}/cancel`, { reason });
    return response.data.data;
  },

  // =====================================================
  // PORTFOLIO DASHBOARD
  // =====================================================

  async getPortfolioDashboard() {
    const response = await apiClient.get('/construction/dashboard');
    return response.data.data;
  },

  // =====================================================
  // PROJECT COMPLETION
  // =====================================================

  async commissionProject(projectId, data = {}) {
    const response = await apiClient.put(`/construction/projects/${projectId}/commission`, data);
    return response.data.data;
  },

  // =====================================================
  // MATERIAL USAGE
  // =====================================================

  async listMaterialUsage(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/material-usage`, { params });
    return response.data.data;
  },

  async createMaterialUsage(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/material-usage`, data);
    return response.data.data;
  },

  async updateMaterialUsage(id, data) {
    const response = await apiClient.put(`/construction/material-usage/${id}`, data);
    return response.data.data;
  },

  async deleteMaterialUsage(id) {
    await apiClient.delete(`/construction/material-usage/${id}`);
  },

  async getMaterialSummary(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/material-summary`);
    return response.data.data;
  },

  // =====================================================
  // PROGRESS & GANTT
  // =====================================================

  async getProgressSummary(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/progress-summary`);
    return response.data.data;
  },

  async getGanttData(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/gantt`);
    return response.data.data;
  },

  async getDailyLogSummary(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/daily-logs/summary`, { params });
    return response.data.data;
  },

  // =====================================================
  // SUBCONTRACTS (Pudratchilar)
  // =====================================================

  async listSubcontracts(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/subcontracts`);
    return response.data.data;
  },

  async createSubcontract(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/subcontracts`, data);
    return response.data.data;
  },

  async getSubcontract(id) {
    const response = await apiClient.get(`/construction/subcontracts/${id}`);
    return response.data.data;
  },

  async updateSubcontract(id, data) {
    const response = await apiClient.put(`/construction/subcontracts/${id}`, data);
    return response.data.data;
  },

  async deleteSubcontract(id) {
    await apiClient.delete(`/construction/subcontracts/${id}`);
  },

  async updateSubcontractState(id, data) {
    const response = await apiClient.put(`/construction/subcontracts/${id}/state`, data);
    return response.data.data;
  },

  // =====================================================
  // CONSTRUCTION ACTS (KS-2 / KS-3)
  // =====================================================

  async listActs(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/acts`, { params });
    return response.data.data;
  },

  async createAct(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/acts`, data);
    return response.data.data;
  },

  async getAct(id) {
    const response = await apiClient.get(`/construction/acts/${id}`);
    return response.data.data;
  },

  async deleteAct(id) {
    await apiClient.delete(`/construction/acts/${id}`);
  },

  async previewAutoGenerateKS2(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/acts/generate-ks2/preview`, data);
    return response.data.data;
  },

  async autoGenerateKS2(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/acts/generate-ks2`, data);
    return response.data.data;
  },

  async approveAct(id) {
    const response = await apiClient.put(`/construction/acts/${id}/approve`);
    return response.data.data;
  },

  async rejectAct(id, data) {
    const response = await apiClient.put(`/construction/acts/${id}/reject`, data);
    return response.data.data;
  },

  async generateKS3FromKS2(id) {
    const response = await apiClient.post(`/construction/acts/${id}/generate-ks3`);
    return response.data.data;
  },

  async signAct(id, data) {
    const response = await apiClient.put(`/construction/acts/${id}/sign`, data);
    return response.data.data;
  },

  async cancelAct(id, data) {
    const response = await apiClient.put(`/construction/acts/${id}/cancel`, data);
    return response.data.data;
  },

  async updateActLine(actId, lineId, data) {
    const response = await apiClient.put(`/construction/acts/${actId}/lines/${lineId}`, data);
    return response.data.data;
  },

  async exportActPDF(id) {
    const response = await apiClient.get(`/construction/acts/${id}/export?format=pdf`, { responseType: 'blob' });
    return response.data;
  },

  async generateForma3(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/acts/generate-ks3`, data);
    return response.data.data;
  },

  // =====================================================
  // FORMA 2 (KS-2) — uses /acts endpoints with type filter
  // =====================================================

  async listF2(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/acts`, { params: { ...params, type: 'ks2' } });
    return response.data.data;
  },
  async createF2(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/acts`, { ...data, act_type: 'ks2' });
    return response.data.data;
  },
  async getF2(projectId, f2Id) {
    const response = await apiClient.get(`/construction/acts/${f2Id}`);
    return response.data.data;
  },
  async signF2(projectId, f2Id, data) {
    const response = await apiClient.put(`/construction/acts/${f2Id}/sign`, data);
    return response.data.data;
  },
  async cancelF2(projectId, f2Id, data) {
    const response = await apiClient.put(`/construction/acts/${f2Id}/cancel`, data);
    return response.data.data;
  },
  async updateF2Line(projectId, f2Id, lineId, data) {
    const response = await apiClient.put(`/construction/acts/${f2Id}/lines/${lineId}`, data);
    return response.data.data;
  },
  async submitF2(projectId, f2Id) {
    const response = await apiClient.post(`/construction/projects/${projectId}/f2/${f2Id}/submit`);
    return response.data.data;
  },
  async exportF2PDF(projectId, f2Id) {
    const response = await apiClient.get(`/construction/acts/${f2Id}/export?format=pdf`, { responseType: 'blob' });
    return response.data;
  },
  async exportF2XLSX(projectId, f2Id) {
    const response = await apiClient.get(`/construction/acts/${f2Id}/export?format=xlsx`, { responseType: 'blob' });
    return response.data;
  },
  async deleteF2(projectId, f2Id) {
    // Defensive: reject malformed calls client-side. Dropping `f2Id` used
    // to produce `/construction/acts/undefined` 400s on the backend; we
    // now fail fast so the caller's bug is obvious. `projectId` is kept in
    // the signature for parity with `deleteF19` but not used in the URL
    // because the Forma 2 delete endpoint is project-agnostic.
    if (f2Id === undefined || f2Id === null || f2Id === '') {
      throw new Error('deleteF2: f2Id is required');
    }
    const response = await apiClient.delete(`/construction/acts/${f2Id}`);
    return response.data.data;
  },

  // =====================================================
  // FORMA 3 (KS-3) — uses /acts endpoints with type filter
  // =====================================================

  async listF3(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/acts`, { params: { ...params, type: 'ks3' } });
    return response.data.data;
  },
  async generateF3(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/acts/generate-ks3`, data);
    return response.data.data;
  },
  async getF3(projectId, f3Id) {
    const response = await apiClient.get(`/construction/acts/${f3Id}`);
    return response.data.data;
  },
  async signF3(projectId, f3Id, data) {
    const response = await apiClient.put(`/construction/acts/${f3Id}/sign`, data);
    return response.data.data;
  },
  async exportF3PDF(projectId, f3Id) {
    const response = await apiClient.get(`/construction/acts/${f3Id}/export?format=pdf`, { responseType: 'blob' });
    return response.data;
  },
  async exportF3XLSX(projectId, f3Id) {
    const response = await apiClient.get(`/construction/acts/${f3Id}/export?format=xlsx`, { responseType: 'blob' });
    return response.data;
  },

  // =====================================================
  // FORMA 19 — Material Consumption Tracking
  // =====================================================

  async listF19(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/f19`, { params });
    return response.data.data;
  },
  async createF19(projectId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/f19`, data);
    return response.data.data;
  },
  async getF19Detail(projectId, actId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/f19/${actId}`);
    return response.data.data;
  },
  async addF19ChangeRow(projectId, actId, data) {
    const response = await apiClient.post(`/construction/projects/${projectId}/f19/${actId}/change-row`, data);
    return response.data.data;
  },
  async updateF19Row(projectId, actId, rowId, data) {
    const response = await apiClient.put(`/construction/projects/${projectId}/f19/${actId}/rows/${rowId}`, data);
    return response.data.data;
  },
  async approveF19(projectId, actId) {
    const response = await apiClient.post(`/construction/projects/${projectId}/f19/${actId}/approve`);
    return response.data.data;
  },
  async submitF19(projectId, actId) {
    const response = await apiClient.post(`/construction/projects/${projectId}/f19/${actId}/approve`);
    return response.data.data;
  },
  async deleteF19(projectId, actId) {
    // Defensive: both args must be present. A missing actId used to produce
    // URLs like `/construction/projects/1/f19/undefined` and return 400.
    if (projectId === undefined || projectId === null || projectId === '') {
      throw new Error('deleteF19: projectId is required');
    }
    if (actId === undefined || actId === null || actId === '') {
      throw new Error('deleteF19: actId is required');
    }
    const response = await apiClient.delete(`/construction/projects/${projectId}/f19/${actId}`);
    return response.data.data;
  },
  async exportF19PDF(projectId, f19Id) {
    const response = await apiClient.get(`/construction/acts/${f19Id}/export?format=pdf`, { responseType: 'blob' });
    return response.data;
  },
  async exportF19XLSX(projectId, f19Id) {
    const response = await apiClient.get(`/construction/acts/${f19Id}/export?format=xlsx`, { responseType: 'blob' });
    return response.data;
  },

  // =====================================================
  // SMETA VS FACT ANALYTICS
  // =====================================================

  async getSmetaVsFact(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/smeta-vs-fact`, { params });
    return response.data.data;
  },

  // =====================================================
  // FINANCIAL ANALYSIS (Moliyaviy tahlil)
  // =====================================================

  async getProjectPnL(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/financial/pnl`);
    return response.data.data;
  },

  async getBudgetVsActual(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/financial/budget-actual`);
    return response.data.data;
  },

  async getCostTrend(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/financial/cost-trend`);
    return response.data.data;
  },

  async getPaymentSchedule(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/financial/payment-schedule`);
    return response.data.data;
  },

  // =====================================================
  // REPORTS
  // =====================================================

  async getProjectSummaryReport(projectId) {
    const response = await apiClient.get(`/construction/projects/${projectId}/reports/summary`);
    return response.data.data;
  },

  async getStageBudgetReport(projectId, { buildingId } = {}) {
    // `buildingId` is optional. When present (falsy values are skipped) the
    // backend scopes both the stage rows AND the total_planned / total_actual
    // KPIs to stages belonging to that building, matching the per-block tab
    // behaviour on the Bosqichlar page.
    const params = {};
    if (buildingId !== undefined && buildingId !== null && buildingId !== '' && buildingId !== 'all') {
      params.building_id = buildingId;
    }
    const response = await apiClient.get(
      `/construction/projects/${projectId}/reports/budget`,
      { params },
    );
    return response.data.data;
  },

  async getMaterialsReport(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/reports/materials`, { params });
    return response.data.data;
  },

  async getJournalEntriesReport(projectId, params = {}) {
    const response = await apiClient.get(`/construction/projects/${projectId}/reports/journal-entries`, { params });
    return response.data.data;
  },

  // =====================================================
  // ACT TYPES (user-manageable)
  // =====================================================

  async listActTypes() {
    const response = await apiClient.get('/construction/act-types');
    return response.data.data;
  },

  async createActType(data) {
    const response = await apiClient.post('/construction/act-types', data);
    return response.data.data;
  },

  async deleteActType(id) {
    await apiClient.delete(`/construction/act-types/${id}`);
  },
};

export default constructionService;
