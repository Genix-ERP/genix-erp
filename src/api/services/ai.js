import apiClient from '../client';

export const aiService = {
  // Get AI capabilities
  async getCapabilities() {
    const response = await apiClient.get('/ai/capabilities');
    return response.data.data;
  },

  // Chat with AI
  async chat(message, conversationId = null, context = {}) {
    const response = await apiClient.post('/ai/chat', {
      message,
      conversation_id: conversationId,
      context,
    });
    return response.data.data;
  },

  // Transcribe a recorded audio blob to text (server-side Whisper).
  async transcribe(blob, language = '') {
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    if (language) form.append('language', language);
    const response = await apiClient.post('/ai/transcribe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  // Agentic chat — the model reads real ERP data via tools and proposes writes.
  // history: prior turns returned by the previous call. approved: a write the
  // user just confirmed ({tool, args}) — the agent executes it then continues.
  async agentChat(message, history = [], approved = null) {
    const response = await apiClient.post('/ai/agent', { message, history, approved });
    return response.data.data; // { type, message?, history?, steps?, pending_action?, assistant_note? }
  },

  // Conversations
  async listConversations(params = {}) {
    const response = await apiClient.get('/ai/conversations', { params });
    return response.data.data;
  },

  async createConversation(data = {}) {
    const response = await apiClient.post('/ai/conversations', data);
    return response.data.data;
  },

  async getConversation(id) {
    const response = await apiClient.get(`/ai/conversations/${id}`);
    return response.data.data;
  },

  async deleteConversation(id) {
    await apiClient.delete(`/ai/conversations/${id}`);
  },

  async addMessage(conversationId, data) {
    const response = await apiClient.post(`/ai/conversations/${conversationId}/messages`, data);
    return response.data.data;
  },

  // Prompts
  async listPrompts(params = {}) {
    const response = await apiClient.get('/ai/prompts', { params });
    return response.data.data;
  },

  async createPrompt(data) {
    const response = await apiClient.post('/ai/prompts', data);
    return response.data.data;
  },

  async getPrompt(id) {
    const response = await apiClient.get(`/ai/prompts/${id}`);
    return response.data.data;
  },

  async updatePrompt(id, data) {
    const response = await apiClient.put(`/ai/prompts/${id}`, data);
    return response.data.data;
  },

  async deletePrompt(id) {
    await apiClient.delete(`/ai/prompts/${id}`);
  },

  // Invoice Extraction
  async extractInvoice(imageBase64, mimeType) {
    const response = await apiClient.post('/ai/extract-invoice', {
      image_base64: imageBase64,
      mime_type: mimeType,
    });
    return response.data.data;
  },

  // Usage Statistics
  async getUsageStats() {
    const response = await apiClient.get('/ai/usage');
    return response.data.data;
  },
};

export default aiService;
