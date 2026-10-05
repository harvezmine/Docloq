// Organization / Company Profile API Service

import api from './api';

const organizationService = {
  getProfile: () => api.get('/organizations/profile'),
  updateProfile: (data) => api.put('/organizations/profile', data),
};

export default organizationService;
