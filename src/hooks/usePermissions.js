import { useMemo } from 'react';
import { useAuth } from '@/components/contexts/AuthContext';
import {
  hasPermission,
  canAccessModule,
  getAllowedOperations,
  hasAnyPermission,
  hasAllPermissions,
  OPERATIONS,
  MODULES
} from '@/config/permissions';

/**
 * Custom hook for permission checking
 * Provides convenient methods to check user permissions
 */
export const usePermissions = () => {
  const { user, isSiteAdmin, isOwner } = useAuth();

  // Get user's permission level
  const userPermission = useMemo(() => {
    // Site admins and owners have 'grant' level permissions
    if (isSiteAdmin?.() || isOwner?.()) {
      return 'grant';
    }
    return user?.permission || 'learner'; // Default to learner if not set
  }, [user, isSiteAdmin, isOwner]);

  // Check if user can perform an operation on a module
  const can = useMemo(() => {
    return (module, operation) => {
      // Site admins and owners can do everything
      if (isSiteAdmin?.() || isOwner?.()) return true;
      return hasPermission(userPermission, module, operation);
    };
  }, [userPermission, isSiteAdmin, isOwner]);

  // Check if user can access a module (at least read)
  const canAccess = useMemo(() => {
    return (module) => {
      if (isSiteAdmin?.() || isOwner?.()) return true;
      return canAccessModule(userPermission, module);
    };
  }, [userPermission, isSiteAdmin, isOwner]);

  // Get all operations user can perform on a module
  const allowedOps = useMemo(() => {
    return (module) => {
      if (isSiteAdmin?.() || isOwner?.()) {
        return [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE];
      }
      return getAllowedOperations(userPermission, module);
    };
  }, [userPermission, isSiteAdmin, isOwner]);

  // Check if user has any of the specified permissions
  const canAny = useMemo(() => {
    return (module, operations) => {
      if (isSiteAdmin?.() || isOwner?.()) return true;
      return hasAnyPermission(userPermission, module, operations);
    };
  }, [userPermission, isSiteAdmin, isOwner]);

  // Check if user has all specified permissions
  const canAll = useMemo(() => {
    return (module, operations) => {
      if (isSiteAdmin?.() || isOwner?.()) return true;
      return hasAllPermissions(userPermission, module, operations);
    };
  }, [userPermission, isSiteAdmin, isOwner]);

  // Convenience methods for common operations
  const canRead = useMemo(() => (module) => can(module, OPERATIONS.READ), [can]);
  const canCreate = useMemo(() => (module) => can(module, OPERATIONS.CREATE), [can]);
  const canUpdate = useMemo(() => (module) => can(module, OPERATIONS.UPDATE), [can]);
  const canDelete = useMemo(() => (module) => can(module, OPERATIONS.DELETE), [can]);

  return {
    userPermission,
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
