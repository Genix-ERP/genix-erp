import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import authService from '@/api/services/auth';

const AuthContext = createContext(null);

// System role types
const ROLE_TYPES = {
  SITE_ADMIN: 'site_admin',
  OWNER: 'owner',
  USER: 'user'
};

// Derive role from backend user data
// Backend uses is_system_admin and roles array, frontend expects simple 'role' field
const deriveRole = (userData) => {
  if (!userData) return ROLE_TYPES.USER;

  // Check if already has role field
  if (userData.role) return userData.role;

  // Check is_system_admin flag - this is the site administrator
  if (userData.is_system_admin) return ROLE_TYPES.SITE_ADMIN;

  // Check roles array for admin role
  if (userData.roles && Array.isArray(userData.roles)) {
    const hasSiteAdminRole = userData.roles.some(r =>
      r.code === 'site_admin' || r.code === 'system_admin'
    );
    if (hasSiteAdminRole) return ROLE_TYPES.SITE_ADMIN;

    const hasOwnerRole = userData.roles.some(r =>
      r.code === 'owner' || r.code === 'company_owner'
    );
    if (hasOwnerRole) return ROLE_TYPES.OWNER;
  }

  // SEC-04 (docs/admin-panel/audit.md): the hardcoded email fallback
  // (admin@genixerp.com -> SITE_ADMIN) was a privilege backdoor independent of
  // the real flag. Removed. Platform-admin status now comes solely from the
  // server-provided is_system_admin boolean (checked above).

  return ROLE_TYPES.USER;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Fetch user from backend - this is the source of truth
  const fetchUserFromBackend = useCallback(async () => {
    try {
      const apiUser = await authService.getCurrentUser();
      const userData = { ...apiUser, role: deriveRole(apiUser) };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('genixerp_user', JSON.stringify(userData));
      return userData;
    } catch (err) {
      // Token invalid or expired - clear auth state
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('genixerp_user');
      throw err;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authService.hasToken()) {
          try {
            await fetchUserFromBackend();
            setBackendAvailable(true);
          } catch (err) {
            // Token invalid/expired or backend unreachable — require re-login.
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchUserFromBackend]);

  const login = useCallback(async (email, password, tenantId = null, isPhone = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await authService.login(email, password, tenantId, isPhone);
      setBackendAvailable(true);
      // Derive role from user data returned by login
      const userData = { ...data.user, role: deriveRole(data.user) };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('genixerp_user', JSON.stringify(userData));
      return { success: true, data };
    } catch (err) {
      // Check if this is a tenant selection required error
      if (err.response?.status === 409 && err.response?.data?.data?.tenants) {
        return {
          success: false,
          tenantSelectionRequired: true,
          tenants: err.response.data.data.tenants,
          error: 'Please select a company to continue'
        };
      }
      // Distinguish "no response from server" (network/proxy/CORS issue)
      // from "server responded with an error" so the user sees an honest
      // message and doesn't blame their password.
      const isNetworkError = err.code === 'ERR_NETWORK'
        || err.message === 'Network Error'
        || (!err.response && err.request);
      const message = err.response?.data?.error?.message
        || (isNetworkError ? 'Cannot reach server. Check your connection and try again.' : null)
        || err.message
        || 'Login failed';
      setError(message);
      setIsAuthenticated(false);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.register(data);
      setBackendAvailable(true);
      const userData = { ...result.user, role: deriveRole(result.user) };
      setUser(userData);
      setIsAuthenticated(true);
      return { success: true, data: result };
    } catch (err) {
      const isNetworkError = err.code === 'ERR_NETWORK'
        || err.message === 'Network Error'
        || (!err.response && err.request);
      const message = err.response?.data?.error?.message
        || (isNetworkError ? 'Cannot reach server. Check your connection and try again.' : null)
        || err.message
        || 'Registration failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerWithOTP = useCallback(async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.registerWithOTP(data);
      setBackendAvailable(true);
      const userData = { ...result.user, role: deriveRole(result.user) };
      setUser(userData);
      setIsAuthenticated(true);
      return { success: true, data: result };
    } catch (err) {
      const isNetworkError = err.code === 'ERR_NETWORK'
        || err.message === 'Network Error'
        || (!err.response && err.request);
      const message = err.response?.data?.error?.message
        || (isNetworkError ? 'Cannot reach server. Check your connection and try again.' : null)
        || err.message
        || 'Registration failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential, tenantId = null, companyName = null) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await authService.googleAuth(credential, tenantId, companyName);
      setBackendAvailable(true);

      // If needs_completion, return so frontend can show company name form
      if (data.needs_completion) {
        return { success: false, needsCompletion: true, googleUser: data.google_user };
      }

      const userData = { ...data.user, role: deriveRole(data.user) };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('genixerp_user', JSON.stringify(userData));
      return { success: true, data, isNewUser: !!data.is_new_user };
    } catch (err) {
      // Handle tenant selection required (same as login)
      if (err.response?.status === 409 && err.response?.data?.data?.tenants) {
        return {
          success: false,
          tenantSelectionRequired: true,
          tenants: err.response.data.data.tenants,
          error: 'Please select a company to continue'
        };
      }
      const isNetworkError = err.code === 'ERR_NETWORK'
        || err.message === 'Network Error'
        || (!err.response && err.request);
      const message = err.response?.data?.error?.message
        || (isNetworkError ? 'Cannot reach server. Check your connection and try again.' : null)
        || err.message
        || 'Google authentication failed';
      setError(message);
      setIsAuthenticated(false);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (backendAvailable) {
        await authService.logout();
      }
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      // Clear all cached data to prevent data leakage between users
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('genix_') ||
          key.startsWith('demo_') ||
          key === 'genixerp_user' ||
          key === 'demo_session' ||
          key === 'tenantId' ||
          key === 'accessToken' ||
          key === 'refreshToken'
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      setIsLoading(false);
    }
  }, [backendAvailable]);

  // Refresh user data from backend
  const refreshUser = useCallback(async () => {
    if (!backendAvailable || !authService.hasToken()) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const userData = await fetchUserFromBackend();
      return { success: true, user: userData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [backendAvailable, fetchUserFromBackend]);

  const updateUser = useCallback(async (data) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedUser = await authService.updateCurrentUser(data);
      const userData = { ...updatedUser, role: deriveRole(updatedUser) };
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Update failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.changePassword(currentPassword, newPassword);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Password change failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    setIsLoading(true);
    setError(null);
    try {
      if (backendAvailable) {
        await authService.forgotPassword(email);
        return { success: true };
      } else {
        return { success: true, demo: true, message: 'Demo mode: Password reset not available' };
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Failed to send reset email';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [backendAvailable]);

  const resetPassword = useCallback(async (token, newPassword) => {
    setIsLoading(true);
    setError(null);
    try {
      if (backendAvailable) {
        await authService.resetPassword(token, newPassword);
        return { success: true };
      } else {
        return { success: true, demo: true };
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Password reset failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [backendAvailable]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // SEC-04: the ONLY signal for platform (super) admin is the server-provided
  // is_system_admin flag. Never a tenant role code or an email. Use this — not
  // isSiteAdmin — to gate the platform control plane ("Boshqaruv paneli").
  const isSystemAdmin = useCallback(() => {
    return user?.is_system_admin === true;
  }, [user]);

  // Check if current user is site admin (a TENANT role — gates tenant admin
  // features like Apps/Settings, NOT the platform control plane).
  const isSiteAdmin = useCallback(() => {
    return user?.role === ROLE_TYPES.SITE_ADMIN || user?.is_system_admin === true;
  }, [user]);

  // Check if current user is company owner
  const isOwner = useCallback(() => {
    return user?.role === ROLE_TYPES.OWNER || isSiteAdmin();
  }, [user, isSiteAdmin]);

  // Check if user can manage company (owner or site admin)
  const canManageCompany = useCallback(() => {
    return isOwner() || isSiteAdmin();
  }, [isOwner, isSiteAdmin]);

  // Check if user can manage roles (owner or site admin)
  const canManageRoles = useCallback(() => {
    return isOwner() || isSiteAdmin();
  }, [isOwner, isSiteAdmin]);

  // SEC-04: the platform control plane is for platform staff only — gate on the
  // real is_system_admin flag, not the tenant site-admin role.

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated,
    error,
    backendAvailable,
    login,
    register,
    registerWithOTP,
    loginWithGoogle,
    logout,
    updateUser,
    changePassword,
    forgotPassword,
    resetPassword,
    clearError,
    refreshUser,
    // Role helpers
    isSystemAdmin,
    isSiteAdmin,
    isOwner,
    canManageCompany,
    canManageRoles,
    ROLE_TYPES,
  }), [user, isLoading, isAuthenticated, error, backendAvailable, login, register, registerWithOTP, loginWithGoogle, logout, updateUser, changePassword, forgotPassword, resetPassword, clearError, refreshUser, isSystemAdmin, isSiteAdmin, isOwner, canManageCompany, canManageRoles]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
