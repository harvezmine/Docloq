// Owner Activity log — tenant-scoped audit feed, integrity, and blockchain coverage.

import api from './api';

const activityService = {
  getFeed: async ({ action = 'all', from = '', to = '', page = 1, pageSize = 25 } = {}) => {
    const params = { page, pageSize };
    if (action && action !== 'all') params.action = action;
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await api.get('/activity', { params });
    return res.data;
  },
  getIntegrity: async () => {
    const res = await api.get('/activity/integrity');
    return res.data;
  },
  getBlockchain: async () => {
    const res = await api.get('/activity/blockchain');
    return res.data;
  },
};

export default activityService;
