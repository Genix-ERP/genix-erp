import apiClient from '../client';

export const projectsService = {
  // Projects
  async listProjects(params = {}) {
    const response = await apiClient.get('/projects', { params });
    return response.data.data;
  },

  async getProject(id) {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },

  async createProject(data) {
    const response = await apiClient.post('/projects', data);
    return response.data;
  },

  async updateProject(id, data) {
    const response = await apiClient.put(`/projects/${id}`, data);
    return response.data;
  },

  async deleteProject(id) {
    await apiClient.delete(`/projects/${id}`);
  },

  // Tasks
  async listProjectTasks(projectId) {
    const response = await apiClient.get(`/projects/${projectId}/tasks`);
    return response.data.data;
  },

  async createProjectTask(projectId, data) {
    const response = await apiClient.post(`/projects/${projectId}/tasks`, data);
    return response.data;
  },

  async updateProjectTask(projectId, taskId, data) {
    const response = await apiClient.put(`/projects/${projectId}/tasks/${taskId}`, data);
    return response.data;
  },

  async deleteProjectTask(projectId, taskId) {
    await apiClient.delete(`/projects/${projectId}/tasks/${taskId}`);
  },

  // Task Stages (kanban columns)
  async listProjectStages(projectId) {
    const response = await apiClient.get(`/projects/${projectId}/stages`);
    return response.data.data;
  },

  async createProjectStage(projectId, data) {
    const response = await apiClient.post(`/projects/${projectId}/stages`, data);
    return response.data.data;
  },

  async updateProjectStage(projectId, stageId, data) {
    const response = await apiClient.put(`/projects/${projectId}/stages/${stageId}`, data);
    return response.data;
  },

  async deleteProjectStage(projectId, stageId) {
    await apiClient.delete(`/projects/${projectId}/stages/${stageId}`);
  },

  // Task Notes
  async listTaskNotes(projectId, taskId) {
    const response = await apiClient.get(`/projects/${projectId}/tasks/${taskId}/notes`);
    return response.data.data;
  },

  async createTaskNote(projectId, taskId, data) {
    const response = await apiClient.post(`/projects/${projectId}/tasks/${taskId}/notes`, data);
    return response.data.data;
  },

  // Milestone substages
  async listMilestoneSubstages(projectId, milestoneId) {
    const response = await apiClient.get(`/projects/${projectId}/milestones/${milestoneId}/substages`);
    return response.data.data;
  },
  async createMilestoneSubstage(projectId, milestoneId, data) {
    const response = await apiClient.post(`/projects/${projectId}/milestones/${milestoneId}/substages`, data);
    return response.data.data;
  },
  async updateMilestoneSubstage(projectId, milestoneId, substageId, data) {
    const response = await apiClient.put(`/projects/${projectId}/milestones/${milestoneId}/substages/${substageId}`, data);
    return response.data;
  },
  async deleteMilestoneSubstage(projectId, milestoneId, substageId) {
    await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}/substages/${substageId}`);
  },

  // Milestone attachments (files)
  async listMilestoneAttachments(projectId, milestoneId) {
    const response = await apiClient.get(`/projects/${projectId}/milestones/${milestoneId}/attachments`);
    return response.data.data;
  },
  async uploadMilestoneAttachment(projectId, milestoneId, file, description) {
    const form = new FormData();
    form.append('file', file);
    if (description) form.append('description', description);
    const response = await apiClient.post(`/projects/${projectId}/milestones/${milestoneId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
  async deleteMilestoneAttachment(projectId, milestoneId, attachmentId) {
    await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}/attachments/${attachmentId}`);
  },

  // Milestones
  async listProjectMilestones(projectId) {
    const response = await apiClient.get(`/projects/${projectId}/milestones`);
    return response.data.data;
  },

  async createProjectMilestone(projectId, data) {
    const response = await apiClient.post(`/projects/${projectId}/milestones`, data);
    return response.data;
  },

  async updateProjectMilestone(projectId, milestoneId, data) {
    const response = await apiClient.put(`/projects/${projectId}/milestones/${milestoneId}`, data);
    return response.data;
  },

  async deleteProjectMilestone(projectId, milestoneId) {
    await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}`);
  },

  // Time Entries
  async listTimeEntries(projectId) {
    const response = await apiClient.get(`/projects/${projectId}/time-entries`);
    return response.data.data;
  },

  async createTimeEntry(projectId, data) {
    const response = await apiClient.post(`/projects/${projectId}/time-entries`, data);
    return response.data;
  },

  // Project Expenses
  async listProjectExpenses(projectId) {
    const response = await apiClient.get(`/projects/${projectId}/expenses`);
    return response.data.data;
  },

  async createProjectExpense(projectId, data) {
    const response = await apiClient.post(`/projects/${projectId}/expenses`, data);
    return response.data;
  },

  async deleteProjectExpense(projectId, expenseId) {
    await apiClient.delete(`/projects/${projectId}/expenses/${expenseId}`);
  },

  // Team Members
  async listTeamMembers(projectId) {
    const response = await apiClient.get(`/projects/${projectId}/team-members`);
    return response.data.data;
  },

  async addTeamMember(projectId, data) {
    const response = await apiClient.post(`/projects/${projectId}/team-members`, data);
    return response.data;
  },

  async removeTeamMember(projectId, memberId) {
    await apiClient.delete(`/projects/${projectId}/team-members/${memberId}`);
  },
};

export default projectsService;
