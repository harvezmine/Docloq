// Polled per-tenant feature flags; disabled features are hidden entirely, not shown-but-broken.

import { create } from 'zustand';
import api from '@/services/api';

// Default ON so the UI never hides a feature before the flags load.
export const FEATURE_DEFAULTS = {
  blockchain: true,
  verification: true,
  qr: true,
  aiAnalysis: true,
  doki: true,
  osint: true,
};

const useFeatureFlags = create((set, get) => ({
  features: FEATURE_DEFAULTS,
  loaded: false,

  // reloadOnChange forces a full refresh so components cleanly mount/unmount on a flag flip.
  fetchFeatures: async ({ reloadOnChange = false } = {}) => {
    try {
      const res = await api.get('/organizations/features');
      const incoming = res?.data?.data?.features || {};
      const next = { ...FEATURE_DEFAULTS, ...incoming };
      const prev = get().features;
      const wasLoaded = get().loaded;
      set({ features: next, loaded: true });
      if (reloadOnChange && wasLoaded) {
        const changed = Object.keys(next).some((k) => next[k] !== prev[k]);
        if (changed) window.location.reload();
      }
    } catch {
      set({ loaded: true });
    }
  },
}));

export default useFeatureFlags;
