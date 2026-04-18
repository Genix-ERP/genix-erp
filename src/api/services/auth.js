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

    const { access_token, refresh_token, user } = response.data.data;
    setTokens(access_token, refresh_token);
    // Store tenant ID for API requests (needed for multi-tenant)
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
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
  async login(email, password, tenantId = null, isPhone = false) {
    const payload = isPhone
      ? { phone: email.replace(/\s/g, ''), password }
      : { email, password };
    if (tenantId) {
      payload.tenant_id = tenantId;
    }

    const response = await apiClient.post('/auth/login', payload);

    const { access_token, refresh_token, user } = response.data.data;
    setTokens(access_token, refresh_token);
    // Store tenant ID for API requests (needed for multi-tenant)
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }

    return response.data.data;
  },

  // Google authentication (sign-in or sign-up)
  async googleAuth(credential, tenantId = null, companyName = null) {
    const payload = { credential };
    if (tenantId) payload.tenant_id = tenantId;
    if (companyName) payload.company_name = companyName;

    const res = await apiClient.post('/auth/google', payload);
    const data = res.data.data;

    // If needs_completion, return early (no tokens yet)
    if (data.needs_completion) {
      return data;
    }

    const { access_token, refresh_token, user } = data;
    setTokens(access_token, refresh_token);
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
    }

    // If new user, create initial organization
    if (data.is_new_user) {
      try {
        const cName = companyName || `${user.first_name}'s Company`;
        const cCode = cName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'MAIN';
        await apiClient.post('/organizations', {
          code: cCode,
          name: cName,
          type: 'company',
          country: 'Uzbekistan',
          currency: 'UZS',
          accounting_standard: 'LOCAL_GAAP'
        });
      } catch (orgError) {
        console.error('Error creating initial organization:', orgError);
      }
    }

    return data;
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

  // Get current user from backend - this is the source of truth
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
    return response.data.data;
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

    const { access_token, refresh_token, user } = response.data.data;
    setTokens(access_token, refresh_token);
    // Store tenant ID for API requests (needed for multi-tenant)
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
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
  // Send OTP — to phone (SMS) if phone provided, otherwise to email
  async sendOTP(emailOrPhone, purpose = 'registration', language = 'uz') {
    const isPhone = /^\+?[\d\s\-()]{7,}$/.test(emailOrPhone) && !emailOrPhone.includes('@');
    const response = await apiClient.post('/auth/send-otp', {
      ...(isPhone ? { phone: emailOrPhone } : { email: emailOrPhone }),
      purpose,
      language,
    });
    return response.data.data;
  },

  // Verify OTP code
  async verifyOTP(emailOrPhone, otpCode, purpose = 'registration') {
    const isPhone = /^\+?[\d\s\-()]{7,}$/.test(emailOrPhone) && !emailOrPhone.includes('@');
    const response = await apiClient.post('/auth/verify-otp', {
      ...(isPhone ? { phone: emailOrPhone } : { email: emailOrPhone }),
      otp_code: otpCode,
      purpose,
    });
    return response.data.data;
  },

  // Send OTP to phone via SMS for password reset
  async sendPasswordResetOTP(phone, purpose = 'password_reset', language = 'uz') {
    const response = await apiClient.post('/auth/send-phone-otp', {
      phone,
      purpose,
      language,
    });
    return response.data.data;
  },

  // Verify phone OTP code for password reset
  async verifyPasswordResetOTP(phone, otpCode, purpose = 'password_reset') {
    const response = await apiClient.post('/auth/verify-phone-otp', {
      phone,
      otp_code: otpCode,
      purpose,
    });
    return response.data.data;
  },

  // Reset password with phone OTP verification
  async resetPasswordWithPhone(phone, otpCode, newPassword) {
    const response = await apiClient.post('/auth/reset-password-phone', {
      phone,
      otp_code: otpCode,
      new_password: newPassword,
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
      phone: data.phone || undefined,
      email: data.email || undefined,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      tenant_name: data.companyName,
      tenant_code: tenantCode,
      otp_code: data.otpCode,
    });

    const { access_token, refresh_token, user } = response.data.data;
    setTokens(access_token, refresh_token);
    // Store tenant ID for API requests (needed for multi-tenant)
    if (user.tenant_id) {
      localStorage.setItem('tenantId', user.tenant_id);
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

  // Update email (no verification)
  async updateEmail(email) {
    const response = await apiClient.put('/auth/me/email', { email });
    return response.data.data;
  },

  // Send phone OTP for phone number change
  async sendPhoneOTP(phone) {
    const response = await apiClient.post('/auth/me/phone/send-otp', { phone });
    return response.data.data;
  },

  // Verify phone OTP and update phone number
  async verifyPhoneOTP(phone, otpCode) {
    const response = await apiClient.post('/auth/me/phone/verify-otp', {
      phone,
      otp_code: otpCode,
    });
    return response.data.data;
  },

  // Check if user has a valid access token
  hasToken() {
    return !!localStorage.getItem('accessToken');
  },
};

export default authService;
