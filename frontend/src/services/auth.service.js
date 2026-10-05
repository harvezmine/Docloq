import api from './api';
import useAuthStore from '../app/store/auth.store';

// Dev-only fake user for running without a backend
const DEV_BYPASS_USER = {
  id: 'dev-user-001',
  email: 'dev@docloq.local',
  name: 'Developer',
  role: 'owner',
  avatar: null,
  permissions: ['*'],
  createdAt: new Date().toISOString(),
};

export const authService = {
  devBypassLogin() {
    const { loginSuccess } = useAuthStore.getState();

    if (import.meta.env.PROD) {
      console.warn('Dev bypass is disabled in production');
      return { success: false, message: 'Not available in production' };
    }

    loginSuccess({
      user: DEV_BYPASS_USER,
      accessToken: 'dev-access-token-' + Date.now(),
      refreshToken: 'dev-refresh-token-' + Date.now(),
    });

    return { success: true, data: { user: DEV_BYPASS_USER } };
  },

  async login(email, password, captchaToken = null, rememberMe = false) {
    const { setLoading, setError, loginSuccess, setPending2FA } = useAuthStore.getState();

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/login', {
        email,
        password,
        captchaToken,
        rememberMe,
      });

      if (response.data.success) {
        if (response.data.data.requires2FA) {
          // Pending 2FA: user is NOT authenticated yet
          setPending2FA(true);
          return {
            success: true,
            requires2FA: true,
            userId: response.data.data.userId,
            email: response.data.data.email,
            twoFactorToken: response.data.data.twoFactorToken, // pending 2FA ticket
          };
        }

        loginSuccess(response.data.data);
        return { success: true, data: response.data.data };
      }

      return { success: false, message: response.data.message };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
      return { 
        success: false, 
        message,
        attemptsRemaining: error.response?.data?.attemptsRemaining,
      };
    } finally {
      setLoading(false);
    }
  },

  async register(userData) {
    const { setLoading, setError, loginSuccess } = useAuthStore.getState();
    
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/register', userData);

      if (response.data.success) {
        loginSuccess(response.data.data);
        return { success: true, data: response.data.data };
      }

      return { success: false, message: response.data.message };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  },

  async logout() {
    const { logout } = useAuthStore.getState();
    
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Logout locally even if API fails
      console.error('Logout API error:', error);
    } finally {
      logout();
    }
  },

  async getMe() {
    const { setUser, setLoading, logout } = useAuthStore.getState();
    
    try {
      setLoading(true);
      const response = await api.get('/auth/me');

      if (response.data.success) {
        setUser(response.data.data.user);
        return { success: true, data: response.data.data };
      }

      return { success: false, message: response.data.message };
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
      }
      return { success: false, message: error.response?.data?.message };
    } finally {
      setLoading(false);
    }
  },

  async refreshToken() {
    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    
    if (!refreshToken) {
      logout();
      return { success: false };
    }

    try {
      const response = await api.post('/auth/refresh-token', { refreshToken });

      if (response.data.success) {
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        setTokens(accessToken, newRefreshToken);
        return { success: true };
      }

      logout();
      return { success: false };
    } catch {
      logout();
      return { success: false };
    }
  },

  // Sends the PENDING 2FA ticket; server returns a VERIFIED ticket on success
  async verifyTOTP(code, twoFactorToken) {
    try {
      const response = await api.post('/totp/verify-login', { code, twoFactorToken });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Verification failed'
      };
    }
  },

  // Requires the VERIFIED 2FA ticket returned by the verify step
  async completeLogin(twoFactorToken, rememberMe = false) {
    try {
      const response = await api.post('/auth/complete-login', { twoFactorToken, rememberMe });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  },

  // Accepts firstName/lastName/phone/position/departmentId
  async updateProfile(data) {
    const response = await api.patch('/auth/me', data);
    return response.data;
  },

  // Avatar upload, server sniffs magic bytes and re-encodes; returns { avatarUrl }
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteAvatar() {
    const response = await api.delete('/auth/me/avatar');
    return response.data;
  },

  // Self-service password change (authenticated). Signs out other devices on success.
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword });
      return response.data;
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to update password' };
    }
  },

  // Public: request a reset link. Response is intentionally generic (no enumeration).
  async forgotPassword(email, captchaToken = null) {
    try {
      const response = await api.post('/auth/forgot-password', { email, captchaToken });
      return response.data;
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Request failed. Please try again.' };
    }
  },

  // Public: set a new password using the emailed token.
  async resetPassword(token, password) {
    try {
      const response = await api.post('/auth/reset-password', { token, password });
      return response.data;
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Reset failed. Please try again.' };
    }
  },

  async getSessions() {
    const response = await api.get('/auth/sessions');
    return response.data;
  },

  async revokeSession(sessionId) {
    const response = await api.delete(`/auth/sessions/${sessionId}`);
    return response.data;
  },

  async revokeOtherSessions() {
    const response = await api.delete('/auth/sessions');
    return response.data;
  },
};

export default authService;
