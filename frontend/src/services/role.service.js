import api from './api';

const roleService = {
  async getRoles() {
    try {
      const response = await api.get('/roles');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch roles' };
    }
  },

  async getRoleById(id) {
    try {
      const response = await api.get(`/roles/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch role' };
    }
  },

  async createRole(roleData) {
    try {
      const response = await api.post('/roles', roleData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to create role' };
    }
  },

  async updateRole(id, roleData) {
    try {
      const response = await api.put(`/roles/${id}`, roleData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update role' };
    }
  },

  async deleteRole(id) {
    try {
      const response = await api.delete(`/roles/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete role' };
    }
  },

  async assignUsers(roleId, userIds) {
    try {
      const response = await api.post(`/roles/${roleId}/assign`, { userIds });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to assign users' };
    }
  },

  async removeUser(roleId, userId) {
    try {
      const response = await api.delete(`/roles/${roleId}/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to remove user' };
    }
  },

  async getMyPermissions() {
    try {
      const response = await api.get('/roles/my-permissions');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch permissions' };
    }
  },

  // Admin only
  async getUserPermissions(userId) {
    try {
      const response = await api.get(`/roles/user/${userId}/permissions`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch user permissions' };
    }
  },
};

export default roleService;
