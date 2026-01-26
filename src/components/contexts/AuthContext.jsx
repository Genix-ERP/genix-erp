import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '@/api/services/auth';

const AuthContext = createContext(null);

// Demo users for local/offline authentication (fallback)
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

// Check if backend is available
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const checkBackendAvailable = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/info`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
};

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

  // Check if already has role field (from localStorage or demo)
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

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if backend is available
        const isAvailable = await checkBackendAvailable();
        setBackendAvailable(isAvailable);

        if (isAvailable && authService.isAuthenticated()) {
          // Try to get current user from API
          try {
            const apiUser = await authService.getCurrentUser();
            // Add derived role to user data
            const userData = { ...apiUser, role: deriveRole(apiUser) };
            setUser(userData);
            setIsAuthenticated(true);
            // Update localStorage with role
            localStorage.setItem('genixerp_user', JSON.stringify(userData));
          } catch (err) {
            // If API call fails, try stored user
            const storedUser = authService.getStoredUser();
            if (storedUser) {
              const userData = { ...storedUser, role: deriveRole(storedUser) };
              setUser(userData);
              setIsAuthenticated(true);
            } else {
              setIsAuthenticated(false);
            }
          }
        } else {
          // Check for demo/local user session (check both storage keys)
          const savedUser = localStorage.getItem('genixerp_user') || localStorage.getItem('user');
          if (savedUser) {
            try {
              let userData = JSON.parse(savedUser);

              // Derive role if not set
              if (!userData.role) {
                userData = { ...userData, role: deriveRole(userData) };
              }

              // Auto-sync role for demo users (fixes stale localStorage)
              const demoUser = DEMO_USERS.find(u => u.email === userData.email);
              if (demoUser && userData.role !== demoUser.role) {
                userData = { ...userData, role: demoUser.role };
              }

              // Ensure genixerp_user is set for consistency
              localStorage.setItem('genixerp_user', JSON.stringify(userData));

              setUser(userData);
              setIsAuthenticated(true);
            } catch (e) {
              localStorage.removeItem('genixerp_user');
              localStorage.removeItem('user');
              setIsAuthenticated(false);
            }
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password, tenantId = null) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if backend is available
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        // Use real backend authentication
        const data = await authService.login(email, password, tenantId);
        // Add derived role to user data
        const userData = { ...data.user, role: deriveRole(data.user) };
        setUser(userData);
        setIsAuthenticated(true);
        // Also save to genixerp_user for consistency
        localStorage.setItem('genixerp_user', JSON.stringify(userData));
        // Save tenant info
        if (data.tenant) {
          localStorage.setItem('tenant', JSON.stringify(data.tenant));
        }
        return { success: true, data };
      } else {
        // Fallback to demo users
        const foundUser = DEMO_USERS.find(
          u => u.email === email && u.password === password
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
          localStorage.setItem('genixerp_user', JSON.stringify(userData));
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
        // Derive role from user data (including roles array from backend)
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
        localStorage.setItem('genixerp_user', JSON.stringify(newUser));
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

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (backendAvailable) {
        await authService.logout();
      }
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('genixerp_user');
      localStorage.removeItem('tenant');
      localStorage.removeItem('tenantId');
      setIsLoading(false);
    }
  }, [backendAvailable]);

  // Force sync role from DEMO_USERS (for fixing stale localStorage)
  const syncDemoUserRole = useCallback(() => {
    if (!user?.email) return;
    const demoUser = DEMO_USERS.find(u => u.email === user.email);
    if (demoUser && user.role !== demoUser.role) {
      const updatedUser = { ...user, role: demoUser.role };
      setUser(updatedUser);
      localStorage.setItem('genixerp_user', JSON.stringify(updatedUser));
      return true;
    }
    return false;
  }, [user]);

  const updateUser = useCallback(async (data) => {
    setIsLoading(true);
    setError(null);
    try {
      if (backendAvailable) {
        const updatedUser = await authService.updateCurrentUser(data);
        setUser(updatedUser);
        return { success: true, user: updatedUser };
      } else {
        // Demo mode - update local user
        const updatedUser = { ...user, ...data };
        setUser(updatedUser);
        localStorage.setItem('genixerp_user', JSON.stringify(updatedUser));
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

  const value = {
    user,
    isLoading,
    isAuthenticated,
    error,
    backendAvailable,
    login,
    register,
    logout,
    updateUser,
    changePassword,
    forgotPassword,
    resetPassword,
    clearError,
    syncDemoUserRole,
    // Role helpers
    isSiteAdmin,
    isOwner,
    canManageCompany,
    canManageRoles,
    canAccessAdminPanel,
    ROLE_TYPES,
  };

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
