// Permission levels and their capabilities
// Maps permission levels to CRUD operations per module

export const PERMISSION_LEVELS = {
  LEARNER: 'learner',
  BASIC: 'basic',
  IMPORTANT: 'important',
  GRANT: 'grant'
};

// CRUD operations
export const OPERATIONS = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
};

// Module identifiers
export const MODULES = {
  DASHBOARD: 'dashboard',
  INVENTORY: 'inventory',
  CUSTOMERS: 'crm',
  VENDORS: 'vendors',
  SALES: 'sales',
  PURCHASES: 'purchase',
  FINANCIALS: 'finance',
  HR: 'hr',
  CONTRACTS: 'contracts',
  PROJECTS: 'projects',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  COMPANY: 'company',
  ADMIN: 'admin',
  ASSETS: 'assets',
  PAYROLL: 'payroll',
  EXPENSES: 'expenses',
  MANUFACTURING: 'manufacturing',
  CARGO: 'cargo',
  CONSTRUCTION: 'construction',
  DIRECTOR_DASHBOARD: 'director_dashboard'
};

// Permission matrix: defines what each permission level can do in each module
// Format: [permission_level][module] = [array of allowed operations]
export const PERMISSION_MATRIX = {
  [PERMISSION_LEVELS.LEARNER]: {
    [MODULES.DASHBOARD]: [OPERATIONS.READ],
    [MODULES.INVENTORY]: [OPERATIONS.READ],
    [MODULES.CUSTOMERS]: [OPERATIONS.READ],
    [MODULES.VENDORS]: [OPERATIONS.READ],
    [MODULES.SALES]: [OPERATIONS.READ],
    [MODULES.PURCHASES]: [OPERATIONS.READ],
    [MODULES.FINANCIALS]: [OPERATIONS.READ],
    [MODULES.HR]: [], // No access
    [MODULES.CONTRACTS]: [OPERATIONS.READ],
    [MODULES.PROJECTS]: [OPERATIONS.READ],
    [MODULES.REPORTS]: [OPERATIONS.READ],
    [MODULES.SETTINGS]: [], // No access
    [MODULES.COMPANY]: [], // No access
    [MODULES.ADMIN]: [], // No access
    [MODULES.ASSETS]: [OPERATIONS.READ],
    [MODULES.PAYROLL]: [], // No access
    [MODULES.CONSTRUCTION]: [OPERATIONS.READ]
  },

  [PERMISSION_LEVELS.BASIC]: {
    [MODULES.DASHBOARD]: [OPERATIONS.READ],
    [MODULES.INVENTORY]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.CUSTOMERS]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.VENDORS]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.SALES]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.PURCHASES]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.FINANCIALS]: [OPERATIONS.READ],
    [MODULES.HR]: [], // No access
    [MODULES.CONTRACTS]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.PROJECTS]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.REPORTS]: [OPERATIONS.READ],
    [MODULES.SETTINGS]: [OPERATIONS.READ], // Can view settings but not change
    [MODULES.COMPANY]: [], // No access
    [MODULES.ADMIN]: [], // No access
    [MODULES.ASSETS]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.PAYROLL]: [OPERATIONS.READ], // Can view payroll but not modify
    [MODULES.CONSTRUCTION]: [OPERATIONS.READ, OPERATIONS.CREATE]
  },

  [PERMISSION_LEVELS.IMPORTANT]: {
    [MODULES.DASHBOARD]: [OPERATIONS.READ],
    [MODULES.INVENTORY]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.CUSTOMERS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.VENDORS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.SALES]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.PURCHASES]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.FINANCIALS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.HR]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.CONTRACTS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.PROJECTS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.REPORTS]: [OPERATIONS.READ, OPERATIONS.CREATE],
    [MODULES.SETTINGS]: [OPERATIONS.READ],
    [MODULES.COMPANY]: [OPERATIONS.READ], // Can view company info
    [MODULES.ADMIN]: [], // No access
    [MODULES.ASSETS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.PAYROLL]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE],
    [MODULES.CONSTRUCTION]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE]
  },

  [PERMISSION_LEVELS.GRANT]: {
    [MODULES.DASHBOARD]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.INVENTORY]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.CUSTOMERS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.VENDORS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.SALES]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.PURCHASES]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.FINANCIALS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.HR]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.CONTRACTS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.PROJECTS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.REPORTS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.SETTINGS]: [OPERATIONS.READ, OPERATIONS.UPDATE],
    [MODULES.COMPANY]: [OPERATIONS.READ, OPERATIONS.UPDATE],
    [MODULES.ADMIN]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.ASSETS]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.PAYROLL]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE],
    [MODULES.CONSTRUCTION]: [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE]
  }
};

// Helper function to check if a user has permission for a specific operation on a module
export const hasPermission = (userPermission, module, operation) => {
  // Site admins and owners bypass permission checks
  if (!userPermission) return false;

  // If user has 'grant' permission, they have access to everything
  if (userPermission === PERMISSION_LEVELS.GRANT) return true;

  // Check the permission matrix
  const modulePermissions = PERMISSION_MATRIX[userPermission]?.[module] || [];
  return modulePermissions.includes(operation);
};

// Helper function to check if user can access a module at all (has at least read permission)
export const canAccessModule = (userPermission, module) => {
  return hasPermission(userPermission, module, OPERATIONS.READ);
};

// Helper function to get all allowed operations for a user on a specific module
export const getAllowedOperations = (userPermission, module) => {
  if (userPermission === PERMISSION_LEVELS.GRANT) {
    return [OPERATIONS.READ, OPERATIONS.CREATE, OPERATIONS.UPDATE, OPERATIONS.DELETE];
  }
  return PERMISSION_MATRIX[userPermission]?.[module] || [];
};

// Helper to check multiple permissions at once
export const hasAnyPermission = (userPermission, module, operations) => {
  return operations.some(op => hasPermission(userPermission, module, op));
};

// Helper to check if user has all specified permissions
export const hasAllPermissions = (userPermission, module, operations) => {
  return operations.every(op => hasPermission(userPermission, module, op));
};

export default {
  PERMISSION_LEVELS,
  OPERATIONS,
  MODULES,
  PERMISSION_MATRIX,
  hasPermission,
  canAccessModule,
  getAllowedOperations,
  hasAnyPermission,
  hasAllPermissions
};
