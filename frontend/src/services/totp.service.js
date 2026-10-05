import api from './api';

export const totpService = {
  async getStatus() {
    try {
      const response = await api.get('/totp/status');
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to get 2FA status' 
      };
    }
  },

  // Generates TOTP secret and QR code
  async generateSecret() {
    try {
      const response = await api.post('/totp/generate');
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to generate 2FA secret' 
      };
    }
  },

  async enable(code) {
    try {
      const response = await api.post('/totp/enable', { code });
      return response.data;
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to enable 2FA' 
      };
    }
  },

  async disable(code, password) {
    try {
      const response = await api.post('/totp/disable', { code, password });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to disable 2FA'
      };
    }
  },

  // Requires the PENDING 2FA ticket from login
  async sendEmailOTP(twoFactorToken) {
    try {
      const response = await api.post('/totp/send-email-otp', { twoFactorToken });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send email OTP'
      };
    }
  },

  // Sends PENDING ticket; server returns a VERIFIED ticket on success
  async verifyEmailOTP(code, twoFactorToken) {
    try {
      const response = await api.post('/totp/verify-email-otp', { code, twoFactorToken });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to verify email OTP'
      };
    }
  },
};

export default totpService;
