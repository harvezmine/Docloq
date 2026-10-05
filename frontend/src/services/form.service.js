// Form Service - API calls for form templates, instances, workflow

import api from './api';

const formService = {
  getTemplates: async () => {
    const response = await api.get('/forms/templates');
    return response.data;
  },

  getTemplate: async (id) => {
    const response = await api.get(`/forms/templates/${id}`);
    return response.data;
  },

  createTemplate: async (data) => {
    const response = await api.post('/forms/templates', data);
    return response.data;
  },

  updateTemplate: async (id, data) => {
    const response = await api.put(`/forms/templates/${id}`, data);
    return response.data;
  },

  deleteTemplate: async (id) => {
    const response = await api.delete(`/forms/templates/${id}`);
    return response.data;
  },

  // Create a blank document-backed template (opens blank DOCX in OnlyOffice)
  createBlankTemplate: async (data = {}) => {
    const response = await api.post('/forms/templates/create-blank', data);
    return response.data;
  },

  // Upload a file as template (PDF auto-converts to DOCX)
  uploadFileTemplate: async (file, data = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (data.title) formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.icon) formData.append('icon', data.icon);
    if (data.category) formData.append('category', data.category);
    const response = await api.post('/forms/templates/upload-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // mode: 'edit' (default) or 'view' (read-only)
  getTemplateDocument: async (id, mode = 'edit') => {
    const response = await api.get(`/forms/templates/${id}/document?mode=${mode}`);
    return response.data;
  },

  getInstances: async () => {
    const response = await api.get('/forms/instances');
    return response.data;
  },

  getInstance: async (id) => {
    const response = await api.get(`/forms/instances/${id}`);
    return response.data;
  },

  createInstance: async (data) => {
    const response = await api.post('/forms/instances', data);
    return response.data;
  },

  updateInstance: async (id, data) => {
    const response = await api.put(`/forms/instances/${id}`, data);
    return response.data;
  },

  deleteInstance: async (id) => {
    const response = await api.delete(`/forms/instances/${id}`);
    return response.data;
  },

  updateWorkflowStep: async (id, data) => {
    const response = await api.put(`/forms/workflow-steps/${id}`, data);
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/forms/users');
    return response.data;
  },
};

export default formService;
