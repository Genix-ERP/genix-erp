import apiClient, { setTokens, clearTokens } from '../client';

export const authService = {
  // Register a new user
  async register(data) {
    // Generate tenant_code from company name if not provided
    // Append random suffix to ensure uniqueness
    const baseCode = data.companyName?.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40) || 'tenant';
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const tenantCode = data.tenantCode || `${baseCode}_${randomSuffix}`;

    const response = await apiClient.post('/auth/register', {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      tenant_name: data.companyName,
      tenant_code: tenantCode,
    });

    const { access_token, refresh_token, user, tenant } = response.data.data;
    setTokens(access_token, refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }
    if (tenant) {
      localStorage.setItem('tenant', JSON.stringify(tenant));
    }

    // Create the initial organization with the user's company name
    try {
      const companyName = data.companyName || `${data.firstName}'s Company`;
      const companyCode = companyName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'MAIN';
      await apiClient.post('/organizations', {
        code: companyCode,
        name: companyName,
        type: 'company',
        country: 'Uzbekistan',
        currency: 'UZS',
        accounting_standard: 'LOCAL_GAAP'
      });
    } catch (orgError) {
      console.error('Error creating initial organization:', orgError);
      // Don't fail registration if org creation fails
    }

    return response.data.data;
  },

  // Login with optional tenant_id for multi-tenant scenarios
  async login(email, password, tenantId = null) {
    const payload = { email, password };
    if (tenantId) {
      payload.tenant_id = tenantId;
    }

    const response = await apiClient.post('/auth/login', payload);

    const { access_token, refresh_token, user, tenant } = response.data.data;
    setTokens(access_token, refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }
    if (tenant) {
      localStorage.setItem('tenant', JSON.stringify(tenant));
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

  // Get current user's module permissions
  async getCurrentUserPermissions() {
    const response = await apiClient.get('/auth/me/permissions');
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

  // Validate invitation token
  async validateInvite(token) {
    const response = await apiClient.get(`/auth/validate-invite?token=${token}`);
    return response.data.data;
  },

  // Accept invitation and set password
  async acceptInvite(token, password) {
    const response = await apiClient.post('/auth/accept-invite', {
      token,
      password,
    });

    const { access_token, refresh_token, user, tenant } = response.data.data;
    setTokens(access_token, refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }
    if (tenant) {
      localStorage.setItem('tenant', JSON.stringify(tenant));
    }

    return response.data.data;
  },

  // Send invitation to a user (admin only)
  async sendInvite(userId) {
    const response = await apiClient.post('/auth/send-invite', {
      user_id: userId,
    });
    return response.data.data;
  },

  // Send OTP to email for verification
  async sendOTP(email, purpose = 'registration') {
    const response = await apiClient.post('/auth/send-otp', {
      email,
      purpose,
    });
    return response.data.data;
  },

  // Verify OTP code
  async verifyOTP(email, otpCode, purpose = 'registration') {
    const response = await apiClient.post('/auth/verify-otp', {
      email,
      otp_code: otpCode,
      purpose,
    });
    return response.data.data;
  },

  // Register with OTP verification
  async registerWithOTP(data) {
    // Generate tenant_code from company name if not provided
    const baseCode = data.companyName?.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40) || 'tenant';
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const tenantCode = data.tenantCode || `${baseCode}_${randomSuffix}`;

    const response = await apiClient.post('/auth/register-with-otp', {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      tenant_name: data.companyName,
      tenant_code: tenantCode,
      otp_code: data.otpCode,
    });

    const { access_token, refresh_token, user, tenant } = response.data.data;
    setTokens(access_token, refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }
    if (tenant) {
      localStorage.setItem('tenant', JSON.stringify(tenant));
    }

    // Create the initial organization with the user's company name
    try {
      const companyName = data.companyName || `${data.firstName}'s Company`;
      const companyCode = companyName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'MAIN';
      await apiClient.post('/organizations', {
        code: companyCode,
        name: companyName,
        type: 'company',
        country: 'Uzbekistan',
        currency: 'UZS',
        accounting_standard: 'LOCAL_GAAP'
      });
    } catch (orgError) {
      console.error('Error creating initial organization:', orgError);
      // Don't fail registration if org creation fails
    }

    return response.data.data;
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
