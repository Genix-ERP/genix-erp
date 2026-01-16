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

  // Milestones
  async listProjectMilestones(projectId) {
    const response = await apiClient.get(`/projects/${projectId}/milestones`);
    return response.data.data;
  },

  async createProjectMilestone(projectId, data) {
    const response = await apiClient.post(`/projects/${projectId}/milestones`, data);
    return response.data;
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
};

export default projectsService;
