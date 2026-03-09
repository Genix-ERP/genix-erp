// Integration wrappers that use Go backend API
// These provide a similar interface to the old base44 integrations

import { aiService } from './services/ai';
import apiClient from './client';
import { checkBackendHealth, isDemoMode } from '@/config/dataMode';

// Helper function to get default response based on schema
const getDefaultResponse = (schema, errorMessage = 'AI service is currently unavailable. Please try again later.') => {
  if (!schema) {
    return errorMessage;
  }

  const schemaProps = schema.properties || {};

  // Reorder optimization schema
  if (schemaProps.priority_actions || schemaProps.cost_savings_potential) {
    return {
      summary: errorMessage,
      priority_actions: [],
      cost_savings_potential: 'N/A',
      recommendations: []
    };
  }

  // HR analytics schema
  if (schemaProps.workforce_insights || schemaProps.retention_risks) {
    return {
      workforce_insights: [],
      retention_risks: [],
      recommendations: [],
      summary: errorMessage
    };
  }

  // Manufacturing insights schema
  if (schemaProps.efficiency_analysis || schemaProps.quality_insights) {
    return {
      efficiency_analysis: [],
      quality_insights: [],
      recommendations: [],
      summary: errorMessage
    };
  }

  // CRM/Sales schema
  if (schemaProps.lead_scoring || schemaProps.pipeline_analysis) {
    return {
      lead_scoring: [],
      pipeline_analysis: [],
      recommendations: [],
      summary: errorMessage
    };
  }

  // MRP planning schema (default)
  return {
    procurement_needs: [],
    production_schedule: [],
    bottlenecks: [],
    optimization_tips: [],
    summary: errorMessage
  };
};

// Core integrations object
export const Core = {
  // AI/LLM functionality
  InvokeLLM: async (options) => {
    try {
      // Check if backend is available before making the request
      const isBackendAvailable = await checkBackendHealth();

      if (!isBackendAvailable || isDemoMode()) {
        // Backend not available - return demo/default response
        console.warn('AI backend not available, returning default response');
        return getDefaultResponse(
          options.response_json_schema,
          'AI service is running in demo mode. Connect to backend for full functionality.'
        );
      }

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
            // If parsing fails, return a default structure based on schema
            // Could not parse AI response as JSON, returning default structure
            return getDefaultResponse(options.response_json_schema, 'Unable to parse AI response. Please try again.');
          }
        } else if (typeof result === 'object') {
          return result;
        }
      }
      return result;
    } catch (error) {
      // Only log as warning, not error (since this is expected when backend is down)
      console.warn('InvokeLLM: AI service unavailable -', error.message);

      // Return default structure on error so UI doesn't break
      return getDefaultResponse(
        options.response_json_schema,
        'Unable to generate AI analysis at this time. Please check your connection and try again.'
      );
    }
  },

  // Email functionality (placeholder - would need email backend)
  SendEmail: async (options) => {
    // Placeholder - would need email service implementation
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
    // Placeholder - image generation not yet implemented
    return { success: false, message: 'Image generation not yet implemented' };
  },

  // Extract data from file (placeholder)
  ExtractDataFromUploadedFile: async (options) => {
    // Placeholder - file extraction not yet implemented
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
