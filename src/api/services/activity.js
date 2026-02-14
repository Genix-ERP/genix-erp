import apiClient from '../client';

export const activityService = {
  // =====================================================
  // ACTIVITY LOGS
  // =====================================================

  async listLogs(modelName, recordId, params = {}) {
    const response = await apiClient.get(`/activity/${modelName}/${recordId}/logs`, { params });
    return response.data.data;
  },

  // =====================================================
  // COMMENTS (CHATTER)
  // =====================================================

  async listComments(modelName, recordId) {
    const response = await apiClient.get(`/activity/${modelName}/${recordId}/comments`);
    return response.data.data;
  },

  async createComment(modelName, recordId, data) {
    const response = await apiClient.post(`/activity/${modelName}/${recordId}/comments`, data);
    return response.data.data;
  },

  async deleteComment(commentId) {
    await apiClient.delete(`/activity/comments/${commentId}`);
  },

  // =====================================================
  // SCHEDULED ACTIVITIES
  // =====================================================

  async listScheduledActivities(modelName, recordId) {
    const response = await apiClient.get(`/activity/${modelName}/${recordId}/scheduled`);
    return response.data.data;
  },

  async createScheduledActivity(modelName, recordId, data) {
    const response = await apiClient.post(`/activity/${modelName}/${recordId}/scheduled`, data);
    return response.data.data;
  },

  async completeScheduledActivity(activityId) {
    const response = await apiClient.put(`/activity/scheduled/${activityId}/complete`);
    return response.data.data;
  },

  async listMyActivities(params = {}) {
    const response = await apiClient.get('/activity/my-activities', { params });
    return response.data.data;
  },
};

export default activityService;
