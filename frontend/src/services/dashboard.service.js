// Dashboard Service - API calls for dashboard stats

import api from './api';

const dashboardService = {
  // Get aggregated dashboard stats
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },
};

export default dashboardService;
