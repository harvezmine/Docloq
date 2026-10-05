import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import roleService from '@/services/role.service';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      pending2FA: false,
      permissions: null,
      hasFullAccess: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setTokens: (accessToken, refreshToken) => set({ 
        accessToken, 
        refreshToken,
        isAuthenticated: !!accessToken,
      }),

      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      clearError: () => set({ error: null }),

      setPending2FA: (pending) => set({ pending2FA: pending }),

      fetchPermissions: async () => {
        try {
          const res = await roleService.getMyPermissions();
          set({
            permissions: res?.data?.permissions || {},
            hasFullAccess: res?.data?.hasFullAccess || false,
          });
        } catch (err) {
          console.error('Failed to fetch permissions:', err);
          set({ permissions: {}, hasFullAccess: false });
        }
      },

      loginSuccess: (data) => {
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          pending2FA: false,
        });
        setTimeout(() => get().fetchPermissions(), 100);
      },

      logout: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        pending2FA: false,
        permissions: null,
        hasFullAccess: false,
      }),

      updateUser: (userData) => set((state) => ({
        user: { ...state.user, ...userData },
      })),

      hasRole: (roles) => {
        const { user } = get();
        if (!user) return false;
        if (typeof roles === 'string') {
          return user.role === roles;
        }
        return roles.includes(user.role);
      },

      isAdmin: () => {
        const { user } = get();
        return ['owner', 'admin'].includes(user?.role);
      },

      canAccessDocument: (documentId) => {
        const { hasFullAccess, permissions, user } = get();
        if (['owner', 'admin'].includes(user?.role) || hasFullAccess) return true;
        if (!permissions) return false;
        const key = `document:${documentId}`;
        return permissions[key] && permissions[key] !== 'none';
      },

      canAccessFolder: (folderId) => {
        const { hasFullAccess, permissions, user } = get();
        if (['owner', 'admin'].includes(user?.role) || hasFullAccess) return true;
        if (!permissions) return false;
        const key = `folder:${folderId}`;
        return permissions[key] && permissions[key] !== 'none';
      },

      getPermissionLevel: (resourceType, resourceId) => {
        const { hasFullAccess, permissions, user } = get();
        if (['owner', 'admin'].includes(user?.role) || hasFullAccess) return 'admin';
        if (!permissions) return 'none';
        return permissions[`${resourceType}:${resourceId}`] || 'none';
      },
    }),
    {
      name: 'docloq-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export { useAuthStore };
export default useAuthStore;
