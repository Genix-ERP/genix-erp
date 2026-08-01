import apiClient from '../client';

// Vazifalar (task management) service.
// Backend prefix is /task-boards (/tasks is occupied by CRM tasks).
const unwrap = (res) => res.data?.data ?? res.data;

export default {
  // ── Boards ──
  async listBoards(params = {}) {
    return unwrap(await apiClient.get('/task-boards', { params }));
  },
  async getStats() {
    return unwrap(await apiClient.get('/task-boards/stats'));
  },
  async createBoard(data) {
    return unwrap(await apiClient.post('/task-boards', data));
  },
  // Returns { board, columns, tasks }
  async getBoard(boardId) {
    return unwrap(await apiClient.get(`/task-boards/${boardId}`));
  },
  async updateBoard(boardId, data) {
    return unwrap(await apiClient.put(`/task-boards/${boardId}`, data));
  },
  async deleteBoard(boardId) {
    return unwrap(await apiClient.delete(`/task-boards/${boardId}`));
  },

  // ── Columns ──
  async createColumn(boardId, data) {
    return unwrap(await apiClient.post(`/task-boards/${boardId}/columns`, data));
  },
  async updateColumn(boardId, columnId, data) {
    return unwrap(await apiClient.put(`/task-boards/${boardId}/columns/${columnId}`, data));
  },
  async reorderColumns(boardId, columnIds) {
    return unwrap(await apiClient.put(`/task-boards/${boardId}/columns/reorder`, { column_ids: columnIds }));
  },
  async deleteColumn(boardId, columnId, moveTo) {
    const params = moveTo ? { move_to: moveTo } : {};
    return unwrap(await apiClient.delete(`/task-boards/${boardId}/columns/${columnId}`, { params }));
  },

  // ── Tasks ──
  async listTasks(boardId, params = {}) {
    return unwrap(await apiClient.get(`/task-boards/${boardId}/tasks`, { params }));
  },
  async createTask(boardId, data) {
    return unwrap(await apiClient.post(`/task-boards/${boardId}/tasks`, data));
  },
  // Returns { task, checklist, comments, attachments, links }
  async getTask(boardId, taskId) {
    return unwrap(await apiClient.get(`/task-boards/${boardId}/tasks/${taskId}`));
  },
  async updateTask(boardId, taskId, data) {
    return unwrap(await apiClient.put(`/task-boards/${boardId}/tasks/${taskId}`, data));
  },
  async moveTask(boardId, taskId, columnId, position) {
    return unwrap(await apiClient.post(`/task-boards/${boardId}/tasks/${taskId}/move`, {
      column_id: columnId,
      position,
    }));
  },
  async deleteTask(boardId, taskId) {
    return unwrap(await apiClient.delete(`/task-boards/${boardId}/tasks/${taskId}`));
  },
  async setAssignees(boardId, taskId, employeeIds) {
    return unwrap(await apiClient.put(`/task-boards/${boardId}/tasks/${taskId}/assignees`, {
      employee_ids: employeeIds,
    }));
  },

  // ── Cross-module links ──
  async addTaskLink(boardId, taskId, linkedModule, linkedId) {
    return unwrap(await apiClient.post(`/task-boards/${boardId}/tasks/${taskId}/links`, {
      linked_module: linkedModule,
      linked_id: String(linkedId),
    }));
  },

  // ── Checklist ──
  async addChecklistItem(boardId, taskId, title) {
    return unwrap(await apiClient.post(`/task-boards/${boardId}/tasks/${taskId}/checklist`, { title }));
  },
  async updateChecklistItem(boardId, taskId, itemId, data) {
    return unwrap(await apiClient.put(`/task-boards/${boardId}/tasks/${taskId}/checklist/${itemId}`, data));
  },
  async deleteChecklistItem(boardId, taskId, itemId) {
    return unwrap(await apiClient.delete(`/task-boards/${boardId}/tasks/${taskId}/checklist/${itemId}`));
  },

  // ── Comments ──
  async listComments(boardId, taskId) {
    return unwrap(await apiClient.get(`/task-boards/${boardId}/tasks/${taskId}/comments`));
  },
  async addComment(boardId, taskId, body, mentions = []) {
    return unwrap(await apiClient.post(`/task-boards/${boardId}/tasks/${taskId}/comments`, { body, mentions }));
  },
  async deleteComment(boardId, taskId, commentId) {
    return unwrap(await apiClient.delete(`/task-boards/${boardId}/tasks/${taskId}/comments/${commentId}`));
  },

  // ── Attachments ──
  async uploadAttachment(boardId, taskId, file) {
    const form = new FormData();
    form.append('file', file);
    return unwrap(await apiClient.post(`/task-boards/${boardId}/tasks/${taskId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
  async deleteAttachment(boardId, taskId, attachmentId) {
    return unwrap(await apiClient.delete(`/task-boards/${boardId}/tasks/${taskId}/attachments/${attachmentId}`));
  },

  // ── Activity ──
  async listActivity(boardId, taskId) {
    return unwrap(await apiClient.get(`/task-boards/${boardId}/tasks/${taskId}/activity`));
  },

  // ── Cross-board views ──
  async listMyTasks() {
    return unwrap(await apiClient.get('/my-tasks'));
  },
  async listEmployeeTasks(employeeId) {
    return unwrap(await apiClient.get(`/employees/${employeeId}/tasks`));
  },
};
