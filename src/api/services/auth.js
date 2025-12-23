import apiClient, { setTokens, clearTokens } from '../client';

export const authService = {
  // Register a new user
  async register(data) {
    const response = await apiClient.post('/auth/register', {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      company_name: data.companyName,
      tenant_code: data.tenantCode,
    });

    const { access_token, refresh_token, user } = response.data.data;
    setTokens(access_token, refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }

    return response.data.data;
  },

  // Login
  async login(email, password) {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    const { access_token, refresh_token, user } = response.data.data;
    setTokens(access_token, refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }

    return response.data.data;
  },

  // Logout
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      clearTokens();
    }
  },

  // Get current user
  async getCurrentUser() {
    const response = await apiClient.get('/auth/me');
    return response.data.data;
  },

  // Update current user
  async updateCurrentUser(data) {
    const response = await apiClient.put('/auth/me', data);
    const user = response.data.data;
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    const response = await apiClient.put('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  // Forgot password
  async forgotPassword(email) {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Reset password
  async resetPassword(token, newPassword) {
    const response = await apiClient.post('/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    return response.data;
  },

  // Verify email
  async verifyEmail(token) {
    const response = await apiClient.post('/auth/verify-email', { token });
    return response.data;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  },

  // Get stored user
  getStoredUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

export default authService;
