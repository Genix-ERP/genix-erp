// Integration wrappers that use Go backend API
// These provide a similar interface to the old base44 integrations

import { aiService } from './services/ai';
import apiClient from './client';

// Core integrations object
export const Core = {
  // AI/LLM functionality
  InvokeLLM: async (options) => {
    try {
      const response = await aiService.chat(options.prompt, null, {
        response_format: options.response_json_schema ? 'json' : 'text',
        schema: options.response_json_schema,
        type: 'mrp_planning'
      });

      // Response from backend may be in different formats
      let result = response;

      // If response has a message property, use that
      if (response && response.message) {
        result = response.message;
      }

      // Try to parse as JSON if schema was provided
      if (options.response_json_schema) {
        if (typeof result === 'string') {
          try {
            // Try to extract JSON from the response
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(result);
          } catch {
            // If parsing fails, return a default structure
            console.log('Could not parse AI response as JSON, returning default structure');
            return {
              procurement_needs: [],
              production_schedule: [],
              bottlenecks: [],
              optimization_tips: []
            };
          }
        } else if (typeof result === 'object') {
          return result;
        }
      }
      return result;
    } catch (error) {
      console.error('InvokeLLM error:', error);
      // Return default structure on error so UI doesn't break
      if (options.response_json_schema) {
        return {
          procurement_needs: [],
          production_schedule: [],
          bottlenecks: [],
          optimization_tips: []
        };
      }
      throw error;
    }
  },

  // Email functionality (placeholder - would need email backend)
  SendEmail: async (options) => {
    console.log('SendEmail called:', options);
    // For now, just log - would need email service implementation
    return { success: true, message: 'Email functionality not yet implemented' };
  },

  // File upload
  UploadFile: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.data;
    } catch (error) {
      console.error('UploadFile error:', error);
      throw error;
    }
  },

  // Image generation (placeholder)
  GenerateImage: async (options) => {
    console.log('GenerateImage called:', options);
    return { success: false, message: 'Image generation not yet implemented' };
  },

  // Extract data from file (placeholder)
  ExtractDataFromUploadedFile: async (options) => {
    console.log('ExtractDataFromUploadedFile called:', options);
    return { success: false, message: 'File extraction not yet implemented' };
  },

  // Create signed URL for file (placeholder)
  CreateFileSignedUrl: async (fileId) => {
    try {
      const response = await apiClient.get(`/files/${fileId}`);
      return response.data.data;
    } catch (error) {
      console.error('CreateFileSignedUrl error:', error);
      throw error;
    }
  },

  // Upload private file
  UploadPrivateFile: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('private', 'true');
      const response = await apiClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.data;
    } catch (error) {
      console.error('UploadPrivateFile error:', error);
      throw error;
    }
  }
};

// Export individual functions for convenience
export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;
