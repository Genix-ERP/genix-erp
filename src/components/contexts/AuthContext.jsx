import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import authService from '@/api/services/auth';
import { checkBackendHealth } from '@/config/dataMode';

const AuthContext = createContext(null);

// Demo users for local/offline authentication (fallback when backend unavailable)
const DEMO_USERS = [
  {
    id: '1',
    email: 'admin@genixerp.com',
    password: 'admin123',
    full_name: 'System Administrator',
    first_name: 'System',
    last_name: 'Administrator',
    role: 'site_admin',
    is_system_admin: true
  },
  {
    id: '2',
    email: 'owner@genixerp.com',
    password: 'owner123',
    full_name: 'Company Owner',
    first_name: 'Company',
    last_name: 'Owner',
    role: 'owner'
  },
  {
    id: '3',
    email: 'user@genixerp.com',
    password: 'user123',
    full_name: 'Demo User',
    first_name: 'Demo',
    last_name: 'User',
    role: 'user'
  }
];

// Use shared cached health check instead of making duplicate /info calls
const checkBackendAvailable = checkBackendHealth;

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

  // Check email for admin (fallback for admin@genixerp.com)
  if (userData.email === 'admin@genixerp.com') return ROLE_TYPES.SITE_ADMIN;

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
        // Check if backend is available
        const isAvailable = await checkBackendAvailable();
        setBackendAvailable(isAvailable);

        if (isAvailable && authService.hasToken()) {
          // Backend available and we have a token - fetch user from backend
          try {
            await fetchUserFromBackend();
          } catch (err) {
            // Token invalid - user needs to login again
            // Token invalid - user needs to re-login
            setIsAuthenticated(false);
          }
        } else if (!isAvailable) {
          // Backend not available - check for demo mode session
          const demoSession = localStorage.getItem('demo_session');
          if (demoSession) {
            try {
              const userData = JSON.parse(demoSession);
              setUser(userData);
              setIsAuthenticated(true);
            } catch (e) {
              localStorage.removeItem('demo_session');
              setIsAuthenticated(false);
            }
          } else {
            setIsAuthenticated(false);
          }
        } else {
          // No token
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

  const login = useCallback(async (identifier, password, tenantId = null) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if backend is available
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        // Use real backend authentication
        const data = await authService.login(identifier, password, tenantId);
        // Derive role from user data returned by login
        const userData = { ...data.user, role: deriveRole(data.user) };
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('genixerp_user', JSON.stringify(userData));
        return { success: true, data };
      } else {
        // Fallback to demo users when backend unavailable
        const foundUser = DEMO_USERS.find(
          u => u.email === identifier && u.password === password
        );

        if (foundUser) {
          const userData = {
            id: foundUser.id,
            email: foundUser.email,
            full_name: foundUser.full_name,
            first_name: foundUser.first_name,
            last_name: foundUser.last_name,
            role: foundUser.role
          };
          setUser(userData);
          setIsAuthenticated(true);
          // Store demo session for persistence
          localStorage.setItem('demo_session', JSON.stringify(userData));
          return { success: true, demo: true };
        }

        throw new Error('Invalid email or password');
      }
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
      const message = err.response?.data?.error?.message || err.message || 'Login failed';
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
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        const result = await authService.register(data);
        // Derive role from user data
        const userData = { ...result.user, role: deriveRole(result.user) };
        setUser(userData);
        setIsAuthenticated(true);
        return { success: true, data: result };
      } else {
        // Demo mode - create local user
        const newUser = {
          id: Date.now().toString(),
          email: data.email,
          full_name: `${data.firstName} ${data.lastName}`,
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'user'
        };
        setUser(newUser);
        setIsAuthenticated(true);
        localStorage.setItem('demo_session', JSON.stringify(newUser));
        return { success: true, demo: true };
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'Registration failed';
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
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        const result = await authService.registerWithOTP(data);
        // Derive role from user data
        const userData = { ...result.user, role: deriveRole(result.user) };
        setUser(userData);
        setIsAuthenticated(true);
        return { success: true, data: result };
      } else {
        // Demo mode - create local user (skip OTP verification)
        const newUser = {
          id: Date.now().toString(),
          email: data.email,
          full_name: `${data.firstName} ${data.lastName}`,
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'owner'
        };
        setUser(newUser);
        setIsAuthenticated(true);
        localStorage.setItem('demo_session', JSON.stringify(newUser));
        return { success: true, demo: true };
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'Registration failed';
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
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (!isAvailable) {
        throw new Error('Backend is not available for Google authentication');
      }

      const data = await authService.googleAuth(credential, tenantId, companyName);

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
      const message = err.response?.data?.error?.message || err.message || 'Google authentication failed';
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
      if (backendAvailable) {
        const updatedUser = await authService.updateCurrentUser(data);
        const userData = { ...updatedUser, role: deriveRole(updatedUser) };
        setUser(userData);
        return { success: true, user: userData };
      } else {
        // Demo mode - update local user
        const updatedUser = { ...user, ...data };
        setUser(updatedUser);
        localStorage.setItem('demo_session', JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Update failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [backendAvailable, user]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setIsLoading(true);
    setError(null);
    try {
      if (backendAvailable) {
        await authService.changePassword(currentPassword, newPassword);
        return { success: true };
      } else {
        // Demo mode - just pretend it worked
        return { success: true, demo: true };
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Password change failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [backendAvailable]);

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

  // Check if current user is site admin
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

  // Check if user can access admin panel (site admin only)
  const canAccessAdminPanel = useCallback(() => {
    return isSiteAdmin();
  }, [isSiteAdmin]);

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
    isSiteAdmin,
    isOwner,
    canManageCompany,
    canManageRoles,
    canAccessAdminPanel,
    ROLE_TYPES,
  }), [user, isLoading, isAuthenticated, error, backendAvailable, login, register, registerWithOTP, loginWithGoogle, logout, updateUser, changePassword, forgotPassword, resetPassword, clearError, refreshUser, isSiteAdmin, isOwner, canManageCompany, canManageRoles, canAccessAdminPanel]);

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
