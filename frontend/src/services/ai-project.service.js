// AI Project service, NotebookLM-style workspace

import api from './api';

const aiProjectService = {
  listProjects: async ({ archived } = {}) => {
    const res = await api.get('/ai-projects', { params: archived ? { archived: 'true' } : {} });
    return res.data;
  },
  createProject: async (payload) => {
    const res = await api.post('/ai-projects', payload);
    return res.data;
  },
  getProject: async (id) => {
    const res = await api.get(`/ai-projects/${id}`);
    return res.data;
  },
  updateProject: async (id, partial) => {
    const res = await api.patch(`/ai-projects/${id}`, partial);
    return res.data;
  },
  archiveProject: async (id) => {
    const res = await api.post(`/ai-projects/${id}/archive`);
    return res.data;
  },
  unarchiveProject: async (id) => {
    const res = await api.post(`/ai-projects/${id}/unarchive`);
    return res.data;
  },
  deleteProject: async (id) => {
    const res = await api.delete(`/ai-projects/${id}`);
    return res.data;
  },

  listSources: async (id) => {
    const res = await api.get(`/ai-projects/${id}/sources`);
    return res.data;
  },
  addDocumentSource: async (id, documentId) => {
    const res = await api.post(`/ai-projects/${id}/sources/document`, { documentId });
    return res.data;
  },
  addUrlSource: async (id, url) => {
    const res = await api.post(`/ai-projects/${id}/sources/url`, { url });
    return res.data;
  },
  addTextSource: async (id, { title, content }) => {
    const res = await api.post(`/ai-projects/${id}/sources/text`, { title, content });
    return res.data;
  },
  addNoteSource: async (id, noteId) => {
    const res = await api.post(`/ai-projects/${id}/sources/note`, { noteId });
    return res.data;
  },
  removeSource: async (id, sourceId) => {
    const res = await api.delete(`/ai-projects/${id}/sources/${sourceId}`);
    return res.data;
  },
  // Unified retry, the server dispatches on source type (document vs url; text/note reject).
  retrySource: async (id, sourceId) => {
    const res = await api.post(`/ai-projects/${id}/sources/${sourceId}/retry`);
    return res.data;
  },

  listChats: async (id) => {
    const res = await api.get(`/ai-projects/${id}/chats`);
    return res.data;
  },
  // sourceIds omitted → all sources answer. An explicit [] means none (the backend honours
  // that rather than falling back to all), so only send the key when a scope is set.
  sendChat: async (id, prompt, sourceIds) => {
    const res = await api.post(`/ai-projects/${id}/chats`, sourceIds ? { prompt, sourceIds } : { prompt });
    return res.data;
  },
  clearChats: async (id) => {
    const res = await api.delete(`/ai-projects/${id}/chats`);
    return res.data;
  },

  listNotes: async (id) => {
    const res = await api.get(`/ai-projects/${id}/notes`);
    return res.data;
  },
  createNote: async (id, payload) => {
    const res = await api.post(`/ai-projects/${id}/notes`, payload);
    return res.data;
  },
  updateNote: async (id, noteId, partial) => {
    const res = await api.patch(`/ai-projects/${id}/notes/${noteId}`, partial);
    return res.data;
  },
  deleteNote: async (id, noteId) => {
    const res = await api.delete(`/ai-projects/${id}/notes/${noteId}`);
    return res.data;
  },

  listOutputs: async (id) => {
    const res = await api.get(`/ai-projects/${id}/outputs`);
    return res.data;
  },
  getOutput: async (id, outputId) => {
    const res = await api.get(`/ai-projects/${id}/outputs/${outputId}`);
    return res.data;
  },
  // Returns 202 + a 'generating' row, generation is detached server-side. Poll listOutputs.
  // instructions = the pre-generate popup text; sourceIds scopes generation.
  createOutput: async (id, kind, { instructions, sourceIds } = {}) => {
    const body = { kind };
    if (instructions) body.instructions = instructions;
    if (sourceIds) body.sourceIds = sourceIds;
    const res = await api.post(`/ai-projects/${id}/outputs`, body);
    return res.data;
  },
  deleteOutput: async (id, outputId) => {
    const res = await api.delete(`/ai-projects/${id}/outputs/${outputId}`);
    return res.data;
  },

  addYouTubeSource: async (id, url) => {
    const res = await api.post(`/ai-projects/${id}/sources/youtube`, { url });
    return res.data;
  },
  addFolderSources: async (id, folderId) => {
    const res = await api.post(`/ai-projects/${id}/sources/folder`, { folderId });
    return res.data;
  },

  // --- sharing ---
  listMembers: async (id) => (await api.get(`/ai-projects/${id}/members`)).data,
  inviteMembers: async (id, userIds) => (await api.post(`/ai-projects/${id}/members`, { userIds })).data,
  removeMember: async (id, userId) => (await api.delete(`/ai-projects/${id}/members/${userId}`)).data,
  respondToInvite: async (id, accept) => (await api.post(`/ai-projects/${id}/members/respond`, { accept })).data,
  listPendingInvites: async () => (await api.get('/ai-projects/invites/pending')).data,
  exposedDocuments: async (id) => (await api.get(`/ai-projects/${id}/exposed-documents`)).data,
  enableShareLink: async (id) => (await api.post(`/ai-projects/${id}/share-link`)).data,
  disableShareLink: async (id) => (await api.delete(`/ai-projects/${id}/share-link`)).data,
  joinViaLink: async (token) => (await api.post(`/ai-projects/join/${token}`)).data,

  // --- provenance ---
  getProvenance: async (id, subjectType, subjectId) =>
    (await api.get(`/ai-projects/${id}/provenance/${subjectType}/${subjectId}`)).data,

  fetchUsage: async ({ days = 30 } = {}) => {
    const res = await api.get('/ai-projects/usage', { params: { days } });
    return res.data;
  },
};

export default aiProjectService;
