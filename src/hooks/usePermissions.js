import { useMemo, useCallback } from 'react';
import { useAuth } from '@/components/contexts/AuthContext';
import { useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';
import {
  OPERATIONS,
  MODULES
} from '@/config/permissions';

/**
 * Custom hook for permission checking
 * Uses the new employee module permissions system for CRUD checks
 */
export const usePermissions = () => {
  const { user, isSiteAdmin, isOwner } = useAuth();
  const {
    isAdmin,
    canAccessModule: empCanAccessModule,
    canCreate: empCanCreate,
    canUpdate: empCanUpdate,
    canDelete: empCanDelete,
    getModulePermissions
  } = useEmployeePermissions();

  // Get user's permission level (for backward compatibility)
  const userPermission = useMemo(() => {
    if (isSiteAdmin?.() || isOwner?.() || isAdmin) {
      return 'grant';
    }
    return user?.permission || 'learner';
  }, [user, isSiteAdmin, isOwner, isAdmin]);

  // Super admin = tenant owner / site admin / system admin. Used to gate
  // destructive actions (e.g. deleting posted sales/manufacturing documents)
  // that should never be available to regular employees, regardless of their
  // granular module permissions.
  const isSuperAdmin = useMemo(
    () => !!(isSiteAdmin?.() || isOwner?.() || isAdmin),
    [isSiteAdmin, isOwner, isAdmin]
  );

  // Check if user can perform an operation on a module
  const can = useCallback((module, operation) => {
    // Site admins and owners can do everything
    if (isSiteAdmin?.() || isOwner?.() || isAdmin) return true;

    // Use the new employee permissions system
    switch (operation) {
      case OPERATIONS.READ:
        return empCanAccessModule(module);
      case OPERATIONS.CREATE:
        return empCanCreate(module);
      case OPERATIONS.UPDATE:
        return empCanUpdate(module);
      case OPERATIONS.DELETE:
        return empCanDelete(module);
      default:
        return false;
    }
  }, [isSiteAdmin, isOwner, isAdmin, empCanAccessModule, empCanCreate, empCanUpdate, empCanDelete]);

  // Check if user can access a module (at least read)
  const canAccess = useCallback((module) => {
    if (isSiteAdmin?.() || isOwner?.() || isAdmin) return true;
    return empCanAccessModule(module);
  }, [isSiteAdmin, isOwner, isAdmin, empCanAccessModule]);

  // Get all operations user can perform on a module
  const allowedOps = useCallback((module) => {
    if (isSiteAdmin?.() || isOwner?.() || isAdmin) {
      return [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE];
    }

    const perms = getModulePermissions(module);
    const ops = [];
    if (perms.read) ops.push(OPERATIONS.READ);
    if (perms.create) ops.push(OPERATIONS.CREATE);
    if (perms.update) ops.push(OPERATIONS.UPDATE);
    if (perms.delete) ops.push(OPERATIONS.DELETE);
    return ops;
  }, [isSiteAdmin, isOwner, isAdmin, getModulePermissions]);

  // Check if user has any of the specified permissions
  const canAny = useCallback((module, operations) => {
    if (isSiteAdmin?.() || isOwner?.() || isAdmin) return true;
    return operations.some(op => can(module, op));
  }, [isSiteAdmin, isOwner, isAdmin, can]);

  // Check if user has all specified permissions
  const canAll = useCallback((module, operations) => {
    if (isSiteAdmin?.() || isOwner?.() || isAdmin) return true;
    return operations.every(op => can(module, op));
  }, [isSiteAdmin, isOwner, isAdmin, can]);

  // Convenience methods for common operations
  const canRead = useCallback((module) => can(module, OPERATIONS.READ), [can]);
  const canCreate = useCallback((module) => can(module, OPERATIONS.CREATE), [can]);
  const canUpdate = useCallback((module) => can(module, OPERATIONS.UPDATE), [can]);
  const canDelete = useCallback((module) => can(module, OPERATIONS.DELETE), [can]);

  return {
    userPermission,
    isSuperAdmin,
    can,
    canAccess,
    allowedOps,
    canAny,
    canAll,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    OPERATIONS,
    MODULES
  };
};

export default usePermissions;
