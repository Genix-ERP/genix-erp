import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import authService from '@/api/services/auth';
import { hrService } from '@/api/services';
import { toast } from 'sonner';

const EmployeePermissionsContext = createContext(null);

// All available modules for permissions
// IMPORTANT:
// - 'id' must match the values in MODULES from @/config/permissions.js (used for permission checks)
// - 'appId' is used to check if the app is installed (matches InstalledAppsContext)
// - 'nameKey' is the translation key for display
export const AVAILABLE_MODULES = [
  // Core modules
  { id: 'dashboard', nameKey: 'dashboard', isCore: true },
  { id: 'ai', nameKey: 'ai_assistant', isCore: true },
  { id: 'settings', nameKey: 'settings', isCore: true },
  // App modules - 'id' must match backend Require() module names
  { id: 'inventory', nameKey: 'inventory', appId: 'inventory' },
  { id: 'crm', nameKey: 'customers', appId: 'crm' },
  { id: 'finance', nameKey: 'financials', appId: 'finance' },
  { id: 'hr', nameKey: 'hr', appId: 'hr' },
  { id: 'manufacturing', nameKey: 'manufacturing', appId: 'manufacturing' },
  { id: 'purchase', nameKey: 'procurement', appId: 'procurement' },
  { id: 'tasks', nameKey: 'tasks_module', appId: 'tasks' },
  { id: 'sales', nameKey: 'sales_orders', appId: 'sales_orders' },
  { id: 'assets', nameKey: 'assets', appId: 'assets' },
  { id: 'expenses', nameKey: 'expenses', appId: 'expenses' },
  { id: 'payroll', nameKey: 'payroll', appId: 'payroll' },
  { id: 'contracts', nameKey: 'contracts', appId: 'contracts' },
  { id: 'cargo', nameKey: 'cargo', appId: 'cargo' },
  { id: 'construction', nameKey: 'construction', appId: 'construction' },
  { id: 'organization', nameKey: 'organization', isCore: true },
];

const PERMISSIONS_CACHE_KEY = 'genix_permissions_cache';

// Current user id from localStorage — readable synchronously at mount,
// before AuthContext finishes its backend fetch.
const getCachedUserId = () => {
  try {
    const raw = localStorage.getItem('genixerp_user') || localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      return u.id || u.email;
    }
  } catch (e) { /* ignore */ }
  return 'default';
};

// Read the cached (already converted) permission state for the current user.
// Lets the sidebar render the full module list on the first paint instead of
// waiting for the permissions request. The backend remains the enforcement
// point — this only affects what the UI shows while fresh data loads.
const readCachedPermissions = () => {
  try {
    const raw = localStorage.getItem(`${PERMISSIONS_CACHE_KEY}_user_${getCachedUserId()}`);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt cache */ }
  return null;
};

const persistPermissionsCache = (payload) => {
  try {
    localStorage.setItem(`${PERMISSIONS_CACHE_KEY}_user_${getCachedUserId()}`, JSON.stringify(payload));
  } catch (e) { /* best-effort cache */ }
};

export function EmployeePermissionsProvider({ children }) {
  const { user, isAuthenticated, isSiteAdmin, isOwner, backendAvailable } = useAuth();
  // Hydrate synchronously from the per-user cache so consumers (sidebar,
  // company filtering) don't flicker from "no access" to "access" on reload.
  const [cachedState] = useState(readCachedPermissions);
  const [permissions, setPermissions] = useState(cachedState?.permissions || {});
  const [isAdmin, setIsAdmin] = useState(cachedState?.isAdmin === true);
  const [employeeId, setEmployeeId] = useState(cachedState?.employeeId || null);
  const [organizationIds, setOrganizationIds] = useState(
    Array.isArray(cachedState?.organizationIds) ? cachedState.organizationIds : []
  ); // Organizations this employee can access
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load current user's permissions from backend
  const loadPermissions = useCallback(async () => {
    if (!isAuthenticated || !backendAvailable) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.getCurrentUserPermissions();

      if (result.is_admin) {
        setIsAdmin(true);
        setPermissions({});
        setEmployeeId(null);
        setOrganizationIds([]); // Admins have access to all organizations
        persistPermissionsCache({ isAdmin: true, employeeId: null, organizationIds: [], permissions: {} });
      } else {
        setIsAdmin(false);
        setEmployeeId(result.employee_id || null);
        setOrganizationIds(result.organization_ids || []);

        // Convert permissions from backend format to our format
        const perms = {};
        if (result.permissions) {
          Object.entries(result.permissions).forEach(([moduleId, perm]) => {
            perms[moduleId] = {
              create: perm.can_create,
              read: perm.can_read,
              update: perm.can_update,
              delete: perm.can_delete,
            };
          });
        }
        setPermissions(perms);
        persistPermissionsCache({
          isAdmin: false,
          employeeId: result.employee_id || null,
          organizationIds: result.organization_ids || [],
          permissions: perms,
        });
      }
    } catch (err) {
      console.error('Failed to load user permissions:', err);
      setError(err.message);
      // If permissions API fails, fall back to checking if user is admin
      if (isSiteAdmin() || isOwner()) {
        setIsAdmin(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, backendAvailable, isSiteAdmin, isOwner]);

  // Reload permissions when user changes
  useEffect(() => {
    if (isAuthenticated) {
      loadPermissions();
    } else {
      setPermissions({});
      setIsAdmin(false);
      setEmployeeId(null);
      setOrganizationIds([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id, loadPermissions]);

  // Window-focus / visibility refetch removed per user request.
  // Earlier this fired loadPermissions() every time the tab regained
  // focus (debounced to 30s) so permission changes on the backend would
  // surface without a manual reload. Side effect: any consumer that
  // re-renders on permission change (most construction tabs) would
  // re-load its own data too, which looked like an unwanted auto-reload
  // when the user just briefly switched windows.
  //
  // Permissions are now loaded ONCE at login and stay cached until the
  // user explicitly reloads the page (or logs out / back in). If
  // permissions change on the backend while the user is logged in,
  // they'll see the new values on the next page load.

  // Check if user has permission for a specific action on a module
  const hasPermission = useCallback((moduleId, action) => {
    // Admins have all permissions
    if (isAdmin || isSiteAdmin() || isOwner()) {
      return true;
    }

    // Check specific permission
    const modulePerm = permissions[moduleId];
    if (!modulePerm) {
      // If no permissions set for this module, deny access
      return false;
    }

    return modulePerm[action] === true;
  }, [permissions, isAdmin, isSiteAdmin, isOwner]);

  // Check if user can access a module (has at least read permission)
  const canAccessModule = useCallback((moduleId) => {
    return hasPermission(moduleId, 'read');
  }, [hasPermission]);

  // Check if user can create in a module
  const canCreate = useCallback((moduleId) => {
    return hasPermission(moduleId, 'create');
  }, [hasPermission]);

  // Check if user can update in a module
  const canUpdate = useCallback((moduleId) => {
    return hasPermission(moduleId, 'update');
  }, [hasPermission]);

  // Check if user can delete in a module
  const canDelete = useCallback((moduleId) => {
    return hasPermission(moduleId, 'delete');
  }, [hasPermission]);

  // Get all permissions for a module
  const getModulePermissions = useCallback((moduleId) => {
    if (isAdmin || isSiteAdmin() || isOwner()) {
      return { create: true, read: true, update: true, delete: true };
    }
    return permissions[moduleId] || { create: false, read: false, update: false, delete: false };
  }, [permissions, isAdmin, isSiteAdmin, isOwner]);

  // Check if user can access a specific organization
  const canAccessOrganization = useCallback((orgId) => {
    // Admins have access to all organizations
    if (isAdmin || isSiteAdmin() || isOwner()) {
      return true;
    }
    // If no organization restrictions set, allow access (for backwards compatibility)
    if (organizationIds.length === 0) {
      return true;
    }
    // Check if organization is in the allowed list
    return organizationIds.includes(orgId);
  }, [isAdmin, isSiteAdmin, isOwner, organizationIds]);

  // Admin functions: Get permissions for a specific employee
  // Returns { permissions, role_id, role_name } or just permissions for backward compat
  const getEmployeePermissions = useCallback(async (empId, { withRoleInfo = false } = {}) => {
    if (!backendAvailable) return withRoleInfo ? { permissions: {}, role_id: null, role_name: '' } : {};

    try {
      const result = await hrService.getEmployeePermissions(empId);
      const perms = {};
      if (result.permissions) {
        Object.entries(result.permissions).forEach(([moduleId, perm]) => {
          perms[moduleId] = {
            create: perm.can_create,
            read: perm.can_read,
            update: perm.can_update,
            delete: perm.can_delete,
          };
        });
      }
      if (withRoleInfo) {
        return { permissions: perms, role_id: result.role_id || null, role_name: result.role_name || '' };
      }
      return perms;
    } catch (err) {
      console.error('Failed to get employee permissions:', err);
      return withRoleInfo ? { permissions: {}, role_id: null, role_name: '' } : {};
    }
  }, [backendAvailable]);

  // Admin functions: Update permissions for a specific employee
  const updateEmployeePermissions = useCallback(async (empId, newPermissions) => {
    if (!backendAvailable) return false;

    try {
      // Convert to backend format
      const permissionsArray = Object.entries(newPermissions).map(([moduleId, perm]) => ({
        module_id: moduleId,
        can_create: perm.create || false,
        can_read: perm.read || false,
        can_update: perm.update || false,
        can_delete: perm.delete || false,
      }));

      await hrService.updateEmployeePermissions(empId, permissionsArray);

      // If this is the current user, reload permissions
      if (empId === employeeId) {
        await loadPermissions();
      }

      return true;
    } catch (err) {
      console.error('Failed to update employee permissions:', err);
      return false;
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
    }
  }, [backendAvailable, employeeId, loadPermissions]);

  // Admin functions: Update a single module permission for an employee
  const updateEmployeeModulePermission = useCallback(async (empId, moduleId, permissionType, value) => {
    if (!backendAvailable) return false;

    try {
      // First get current permissions for this employee
      const currentPerms = await getEmployeePermissions(empId);
      const modulePerm = currentPerms[moduleId] || { create: false, read: false, update: false, delete: false };

      // Update the specific permission
      const updatedPerm = { ...modulePerm, [permissionType]: value };

      await hrService.updateEmployeeModulePermission(empId, {
        module_id: moduleId,
        can_create: updatedPerm.create,
        can_read: updatedPerm.read,
        can_update: updatedPerm.update,
        can_delete: updatedPerm.delete,
      });

      // If this is the current user, reload permissions
      if (empId === employeeId) {
        await loadPermissions();
      }

      return true;
    } catch (err) {
      console.error('Failed to update module permission:', err);
      return false;
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
    }
  }, [backendAvailable, employeeId, loadPermissions, getEmployeePermissions]);

  // Admin functions: Set full access for an employee on a module
  const setEmployeeModuleFullAccess = useCallback(async (empId, moduleId, hasAccess) => {
    if (!backendAvailable) return false;

    try {
      await hrService.updateEmployeeModulePermission(empId, {
        module_id: moduleId,
        can_create: hasAccess,
        can_read: hasAccess,
        can_update: hasAccess,
        can_delete: hasAccess,
      });

      // If this is the current user, reload permissions
      if (empId === employeeId) {
        await loadPermissions();
      }

      return true;
    } catch (err) {
      console.error('Failed to set module full access:', err);
      return false;
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
    }
  }, [backendAvailable, employeeId, loadPermissions]);

  // Admin functions: Delete all permissions for an employee
  const deleteEmployeePermissions = useCallback(async (empId) => {
    if (!backendAvailable) return false;

    try {
      await hrService.deleteEmployeePermissions(empId);
      return true;
    } catch (err) {
      console.error('Failed to delete employee permissions:', err);
      return false;
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
    }
  }, [backendAvailable]);

  const value = useMemo(() => ({
    // State
    permissions,
    isAdmin,
    employeeId,
    organizationIds,
    isLoading,
    error,

    // Permission check functions
    hasPermission,
    canAccessModule,
    canCreate,
    canUpdate,
    canDelete,
    getModulePermissions,
    canAccessOrganization,

    // Admin functions for managing employee permissions
    getEmployeePermissions,
    updateEmployeePermissions,
    updateEmployeeModulePermission,
    setEmployeeModuleFullAccess,
    deleteEmployeePermissions,

    // Utility
    refreshPermissions: loadPermissions,
    availableModules: AVAILABLE_MODULES,
  }), [permissions, isAdmin, employeeId, organizationIds, isLoading, error, hasPermission, canAccessModule, canCreate, canUpdate, canDelete, getModulePermissions, canAccessOrganization, getEmployeePermissions, updateEmployeePermissions, updateEmployeeModulePermission, setEmployeeModuleFullAccess, deleteEmployeePermissions, loadPermissions]);

  return (
    <EmployeePermissionsContext.Provider value={value}>
      {children}
    </EmployeePermissionsContext.Provider>
  );
}

export function useEmployeePermissions() {
  const context = useContext(EmployeePermissionsContext);
  if (!context) {
    throw new Error('useEmployeePermissions must be used within an EmployeePermissionsProvider');
  }
  return context;
}

export default EmployeePermissionsContext;
