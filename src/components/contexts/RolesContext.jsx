import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCompany } from './CompanyContext';

const ROLES_KEY = 'genix_roles';
const USER_ROLES_KEY = 'genix_user_roles';

const RolesContext = createContext();

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

// Default system roles (cannot be deleted or modified)
const SYSTEM_ROLES = {
  site_admin: {
    id: 'site_admin',
    code: 'site_admin',
    name: 'Sayt Administratori',
    name_en: 'Site Administrator',
    description: 'Butun saytni boshqaradi, barcha kompaniyalarga kirish huquqi',
    is_system: true,
    is_global: true, // Not company-specific
    permissions: {
      all: true // Full access to everything
    }
  },
  owner: {
    id: 'owner',
    code: 'owner',
    name: 'Egasi',
    name_en: 'Owner',
    description: 'Kompaniya egasi - obuna, kompaniya sozlamalari va barcha modullar',
    is_system: true,
    is_global: false, // Company-specific
    permissions: {
      company: { create: true, read: true, update: true, delete: true },
      subscription: { read: true, update: true },
      roles: { create: true, read: true, update: true, delete: true },
      users: { create: true, read: true, update: true, delete: true },
      all_modules: true // Full access to all modules
    }
  }
};

// Default custom roles (can be modified by owner)
const DEFAULT_CUSTOM_ROLES = [
  {
    id: 'manager',
    code: 'manager',
    name: 'Menejer',
    name_en: 'Manager',
    description: 'Kundalik operatsiyalarni boshqaradi',
    is_system: false,
    permissions: {
      dashboard: { read: true },
      inventory: { create: true, read: true, update: true, delete: false },
      customers: { create: true, read: true, update: true, delete: false },
      financials: { read: true },
      sales_orders: { create: true, read: true, update: true, delete: false },
      purchase_orders: { create: true, read: true, update: true, delete: false },
      employees: { read: true },
      reports: { read: true }
    }
  },
  {
    id: 'accountant',
    code: 'accountant',
    name: 'Buxgalter',
    name_en: 'Accountant',
    description: 'Moliyaviy operatsiyalarni boshqaradi',
    is_system: false,
    permissions: {
      dashboard: { read: true },
      financials: { create: true, read: true, update: true, delete: true },
      invoices: { create: true, read: true, update: true, delete: true },
      expenses: { create: true, read: true, update: true, delete: true },
      payroll: { create: true, read: true, update: true, delete: true },
      reports: { read: true, create: true }
    }
  },
  {
    id: 'sales_rep',
    code: 'sales_rep',
    name: 'Sotuv vakili',
    name_en: 'Sales Representative',
    description: 'Sotuvlar bilan ishlaydi',
    is_system: false,
    permissions: {
      dashboard: { read: true },
      customers: { create: true, read: true, update: true, delete: false },
      sales_orders: { create: true, read: true, update: true, delete: false },
      inventory: { read: true },
      contracts: { read: true }
    }
  },
  {
    id: 'warehouse_staff',
    code: 'warehouse_staff',
    name: 'Ombor xodimi',
    name_en: 'Warehouse Staff',
    description: 'Ombor operatsiyalarini boshqaradi',
    is_system: false,
    permissions: {
      dashboard: { read: true },
      inventory: { create: true, read: true, update: true, delete: false },
      purchase_orders: { read: true }
    }
  },
  {
    id: 'viewer',
    code: 'viewer',
    name: 'Ko\'ruvchi',
    name_en: 'Viewer',
    description: 'Faqat ko\'rish huquqi',
    is_system: false,
    permissions: {
      dashboard: { read: true },
      inventory: { read: true },
      customers: { read: true },
      financials: { read: true },
      sales_orders: { read: true },
      purchase_orders: { read: true }
    }
  }
];

export function RolesProvider({ children }) {
  const { activeCompany } = useCompany();
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState({}); // userId -> [roleIds]
  const [isLoading, setIsLoading] = useState(true);

  // Load roles from localStorage
  const loadRoles = useCallback(() => {
    if (!activeCompany) return;

    try {
      const companyId = activeCompany?.id;
      const storageKey = getStorageKey(ROLES_KEY, companyId);
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        setRoles(JSON.parse(stored));
      } else {
        // Initialize with default custom roles
        const initialRoles = DEFAULT_CUSTOM_ROLES.map(role => ({
          ...role,
          company_id: companyId,
          created_date: new Date().toISOString()
        }));
        localStorage.setItem(storageKey, JSON.stringify(initialRoles));
        setRoles(initialRoles);
      }

      // Load user-role assignments
      const userRolesKey = getStorageKey(USER_ROLES_KEY, companyId);
      const storedUserRoles = localStorage.getItem(userRolesKey);
      if (storedUserRoles) {
        setUserRoles(JSON.parse(storedUserRoles));
      } else {
        setUserRoles({});
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      setRoles([]);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Listen for company change events
  useEffect(() => {
    const handleCompanyChange = () => {
      loadRoles();
    };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadRoles]);

  // Get all roles (system + custom)
  const getAllRoles = useCallback(() => {
    return [
      SYSTEM_ROLES.site_admin,
      SYSTEM_ROLES.owner,
      ...roles
    ];
  }, [roles]);

  // Get only custom roles (editable by owner)
  const getCustomRoles = useCallback(() => {
    return roles;
  }, [roles]);

  // Get system roles
  const getSystemRoles = useCallback(() => {
    return Object.values(SYSTEM_ROLES);
  }, []);

  // Create a new custom role
  const createRole = useCallback((roleData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ROLES_KEY, companyId);

    const newRole = {
      id: `role_${Date.now()}`,
      code: roleData.code || `custom_${Date.now()}`,
      ...roleData,
      is_system: false,
      company_id: companyId,
      created_date: new Date().toISOString()
    };

    const updated = [...roles, newRole];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setRoles(updated);
    return newRole;
  }, [roles, activeCompany]);

  // Update a custom role
  const updateRole = useCallback((roleId, roleData) => {
    // Cannot update system roles
    const role = roles.find(r => r.id === roleId);
    if (!role || role.is_system) {
      return { success: false, message: 'Tizim rollarini o\'zgartirish mumkin emas' };
    }

    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ROLES_KEY, companyId);

    const updated = roles.map(r =>
      r.id === roleId ? { ...r, ...roleData, updated_date: new Date().toISOString() } : r
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setRoles(updated);
    return { success: true };
  }, [roles, activeCompany]);

  // Delete a custom role
  const deleteRole = useCallback((roleId) => {
    // Cannot delete system roles
    const role = roles.find(r => r.id === roleId);
    if (!role || role.is_system) {
      return { success: false, message: 'Tizim rollarini o\'chirish mumkin emas' };
    }

    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(ROLES_KEY, companyId);

    const updated = roles.filter(r => r.id !== roleId);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setRoles(updated);

    // Remove role from all users
    const userRolesKey = getStorageKey(USER_ROLES_KEY, companyId);
    const updatedUserRoles = {};
    Object.keys(userRoles).forEach(userId => {
      updatedUserRoles[userId] = userRoles[userId].filter(id => id !== roleId);
    });
    localStorage.setItem(userRolesKey, JSON.stringify(updatedUserRoles));
    setUserRoles(updatedUserRoles);

    return { success: true };
  }, [roles, userRoles, activeCompany]);

  // Assign role to user
  const assignRoleToUser = useCallback((userId, roleId) => {
    const companyId = activeCompany?.id;
    const userRolesKey = getStorageKey(USER_ROLES_KEY, companyId);

    const currentRoles = userRoles[userId] || [];
    if (currentRoles.includes(roleId)) {
      return { success: false, message: 'Foydalanuvchida bu rol allaqachon mavjud' };
    }

    const updatedUserRoles = {
      ...userRoles,
      [userId]: [...currentRoles, roleId]
    };
    localStorage.setItem(userRolesKey, JSON.stringify(updatedUserRoles));
    setUserRoles(updatedUserRoles);
    return { success: true };
  }, [userRoles, activeCompany]);

  // Remove role from user
  const removeRoleFromUser = useCallback((userId, roleId) => {
    const companyId = activeCompany?.id;
    const userRolesKey = getStorageKey(USER_ROLES_KEY, companyId);

    const currentRoles = userRoles[userId] || [];
    const updatedUserRoles = {
      ...userRoles,
      [userId]: currentRoles.filter(id => id !== roleId)
    };
    localStorage.setItem(userRolesKey, JSON.stringify(updatedUserRoles));
    setUserRoles(updatedUserRoles);
    return { success: true };
  }, [userRoles, activeCompany]);

  // Set all roles for a user (replace existing)
  const setUserRolesList = useCallback((userId, roleIds) => {
    const companyId = activeCompany?.id;
    const userRolesKey = getStorageKey(USER_ROLES_KEY, companyId);

    const updatedUserRoles = {
      ...userRoles,
      [userId]: roleIds
    };
    localStorage.setItem(userRolesKey, JSON.stringify(updatedUserRoles));
    setUserRoles(updatedUserRoles);
    return { success: true };
  }, [userRoles, activeCompany]);

  // Get roles for a user
  const getUserRoles = useCallback((userId) => {
    const roleIds = userRoles[userId] || [];
    return roleIds.map(id => {
      // Check system roles first
      if (id === 'site_admin') return SYSTEM_ROLES.site_admin;
      if (id === 'owner') return SYSTEM_ROLES.owner;
      // Check custom roles
      return roles.find(r => r.id === id);
    }).filter(Boolean);
  }, [userRoles, roles]);

  // Check if user has a specific role
  const userHasRole = useCallback((userId, roleCode) => {
    const userRolesList = getUserRoles(userId);
    return userRolesList.some(r => r.code === roleCode || r.id === roleCode);
  }, [getUserRoles]);

  // Check if user has permission for a module/action
  const userHasPermission = useCallback((userId, module, action = 'read') => {
    const userRolesList = getUserRoles(userId);

    // Check each role for permission
    for (const role of userRolesList) {
      if (!role) continue;

      // Site admin has all permissions
      if (role.code === 'site_admin' || role.permissions?.all) {
        return true;
      }

      // Owner has all module permissions
      if (role.code === 'owner' || role.permissions?.all_modules) {
        return true;
      }

      // Check specific module permission
      const modulePerms = role.permissions?.[module];
      if (modulePerms) {
        if (typeof modulePerms === 'boolean') {
          return modulePerms;
        }
        if (modulePerms[action]) {
          return true;
        }
      }
    }

    return false;
  }, [getUserRoles]);

  // Check if user is site admin
  const isSiteAdmin = useCallback((userId) => {
    return userHasRole(userId, 'site_admin');
  }, [userHasRole]);

  // Check if user is owner of current company
  const isCompanyOwner = useCallback((userId) => {
    return userHasRole(userId, 'owner');
  }, [userHasRole]);

  // Get role by ID or code
  const getRoleByIdOrCode = useCallback((idOrCode) => {
    if (idOrCode === 'site_admin') return SYSTEM_ROLES.site_admin;
    if (idOrCode === 'owner') return SYSTEM_ROLES.owner;
    return roles.find(r => r.id === idOrCode || r.code === idOrCode);
  }, [roles]);

  return (
    <RolesContext.Provider value={{
      // Data
      roles,
      userRoles,
      isLoading,
      systemRoles: SYSTEM_ROLES,

      // Role CRUD
      getAllRoles,
      getCustomRoles,
      getSystemRoles,
      getRoleByIdOrCode,
      createRole,
      updateRole,
      deleteRole,

      // User-Role assignments
      getUserRoles,
      assignRoleToUser,
      removeRoleFromUser,
      setUserRolesList,
      userHasRole,

      // Permission checks
      userHasPermission,
      isSiteAdmin,
      isCompanyOwner,

      // Refresh
      refreshRoles: loadRoles
    }}>
      {children}
    </RolesContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RolesContext);
  if (!context) {
    throw new Error('useRoles must be used within RolesProvider');
  }
  return context;
}

export { SYSTEM_ROLES };
