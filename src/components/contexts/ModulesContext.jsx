import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { hrService, purchaseService, salesService } from '@/api/services';
import { useCompany } from './CompanyContext';

// Storage keys
const EMPLOYEES_KEY = 'genix_employees';
const PURCHASE_ORDERS_KEY = 'genix_purchase_orders';
const SALES_ORDERS_KEY = 'genix_sales_orders';
const PROJECTS_KEY = 'genix_projects';
const ASSETS_KEY = 'genix_fixed_assets';
const EXPENSES_KEY = 'genix_expense_claims';
const PAYROLLS_KEY = 'genix_payrolls';
const CONTRACTS_KEY = 'genix_contracts';
const PERMISSIONS_KEY = 'genix_employee_permissions';

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

// All available modules for permissions (matching sidebar structure)
// Core modules are always visible, app modules depend on installation
const CORE_MODULES = [
  { id: 'dashboard', name: 'Dashboard', icon: 'LayoutDashboard', isCore: true },
  { id: 'ai_assistant', name: 'AI Assistant', icon: 'Bot', isCore: true },
  { id: 'workflows', name: 'Workflows', icon: 'Zap', isCore: true },
  { id: 'apps', name: 'Apps', icon: 'Grid3x3', isCore: true },
  { id: 'settings', name: 'Settings', icon: 'Settings', isCore: true },
  { id: 'admin_panel', name: 'Admin Panel', icon: 'Shield', isCore: true, adminOnly: true }
];

const APP_MODULES = [
  { id: 'inventory', name: 'Inventory', icon: 'Package', appId: 'inventory' },
  { id: 'customers', name: 'Customers', icon: 'Users', appId: 'crm' },
  { id: 'financials', name: 'Financials', icon: 'DollarSign', appId: 'finance' },
  { id: 'hr', name: 'HR', icon: 'Briefcase', appId: 'hr' },
  { id: 'manufacturing', name: 'Manufacturing', icon: 'Zap', appId: 'manufacturing' },
  { id: 'procurement', name: 'Procurement', icon: 'ShoppingCart', appId: 'procurement' },
  { id: 'projects', name: 'Projects', icon: 'Briefcase', appId: 'projects' },
  { id: 'sales_orders', name: 'Sales Orders', icon: 'ShoppingBag', appId: 'sales_orders' },
  { id: 'assets', name: 'Assets', icon: 'Monitor', appId: 'assets' },
  { id: 'expenses', name: 'Expenses', icon: 'Receipt', appId: 'expenses' },
  { id: 'payroll', name: 'Payroll', icon: 'DollarSign', appId: 'payroll' },
  { id: 'contracts', name: 'Contracts', icon: 'FileText', appId: 'contracts' }
];

const ALL_MODULES = [...CORE_MODULES, ...APP_MODULES];

const ModulesContext = createContext();

// Check if backend is available
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const checkBackendAvailable = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/info`);
    return response.ok;
  } catch {
    return false;
  }
};

// Sample data for each module
const sampleEmployees = [
  { id: 'emp_1', full_name: 'John Smith', job_title: 'Software Engineer', department: 'engineering', hire_date: '2023-01-15', status: 'active', performance_score: 4.2, turnover_risk: 'low', salary: 85000 },
  { id: 'emp_2', full_name: 'Sarah Johnson', job_title: 'Marketing Manager', department: 'marketing', hire_date: '2022-06-01', status: 'active', performance_score: 4.5, turnover_risk: 'low', salary: 95000 },
  { id: 'emp_3', full_name: 'Mike Chen', job_title: 'Sales Representative', department: 'sales', hire_date: '2023-03-20', status: 'active', performance_score: 3.8, turnover_risk: 'medium', salary: 65000 },
  { id: 'emp_4', full_name: 'Emily Davis', job_title: 'Financial Analyst', department: 'finance', hire_date: '2021-11-10', status: 'active', performance_score: 4.0, turnover_risk: 'high', salary: 75000 },
  { id: 'emp_5', full_name: 'Robert Wilson', job_title: 'Operations Lead', department: 'operations', hire_date: '2020-08-15', status: 'on_leave', performance_score: 3.5, turnover_risk: 'medium', salary: 70000 }
];

const samplePurchaseOrders = [
  { id: 'po_1', po_number: 'PO-2025-001', vendor_name: 'Office Depot', order_date: '2025-01-05', expected_delivery_date: '2025-01-20', total_amount: 2500, status: 'confirmed', payment_terms: 'net_30', created_date: new Date().toISOString() },
  { id: 'po_2', po_number: 'PO-2025-002', vendor_name: 'TechSupply Inc', order_date: '2025-01-10', expected_delivery_date: '2025-01-25', total_amount: 15000, status: 'sent', payment_terms: 'net_60', created_date: new Date().toISOString() },
  { id: 'po_3', po_number: 'PO-2025-003', vendor_name: 'Industrial Parts Co', order_date: '2025-01-12', expected_delivery_date: '2025-02-01', total_amount: 8500, status: 'draft', payment_terms: 'net_30', created_date: new Date().toISOString() }
];

const sampleSalesOrders = [
  { id: 'so_1', order_number: 'SO-2025-001', customer_name: 'Tech Solutions Inc', order_date: '2025-01-05', delivery_date: '2025-01-15', subtotal: 12000, tax_amount: 960, shipping_cost: 50, total_amount: 13010, status: 'confirmed', payment_status: 'paid', created_date: new Date().toISOString() },
  { id: 'so_2', order_number: 'SO-2025-002', customer_name: 'Global Industries', order_date: '2025-01-08', delivery_date: '2025-01-20', subtotal: 8500, tax_amount: 680, shipping_cost: 75, total_amount: 9255, status: 'processing', payment_status: 'unpaid', created_date: new Date().toISOString() },
  { id: 'so_3', order_number: 'SO-2025-003', customer_name: 'StartUp Labs', order_date: '2025-01-12', delivery_date: '2025-01-25', subtotal: 3500, tax_amount: 280, shipping_cost: 25, total_amount: 3805, status: 'quotation', payment_status: 'unpaid', created_date: new Date().toISOString() }
];

const sampleProjects = [
  { id: 'prj_1', project_name: 'Website Redesign', project_code: 'PRJ-2025-001', client_name: 'Tech Solutions Inc', start_date: '2025-01-01', end_date: '2025-03-31', budget: 50000, actual_cost: 15000, status: 'active', progress_percentage: 30, billing_type: 'fixed_price', priority: 'high', total_hours_logged: 120, created_date: new Date().toISOString() },
  { id: 'prj_2', project_name: 'Mobile App Development', project_code: 'PRJ-2025-002', client_name: 'StartUp Labs', start_date: '2025-02-01', end_date: '2025-06-30', budget: 120000, actual_cost: 0, status: 'planning', progress_percentage: 0, billing_type: 'time_material', priority: 'medium', total_hours_logged: 0, created_date: new Date().toISOString() },
  { id: 'prj_3', project_name: 'CRM Integration', project_code: 'PRJ-2024-015', client_name: 'Global Industries', start_date: '2024-10-01', end_date: '2024-12-31', budget: 35000, actual_cost: 33000, status: 'completed', progress_percentage: 100, billing_type: 'milestone', priority: 'high', total_hours_logged: 450, created_date: new Date().toISOString() }
];

const sampleAssets = [
  { id: 'ast_1', asset_name: 'Dell Server R740', asset_code: 'AST-2023-001', asset_category: 'computers', purchase_date: '2023-01-15', purchase_cost: 25000, salvage_value: 2000, useful_life_years: 5, depreciation_method: 'straight_line', status: 'active', location: 'Data Center A', created_date: new Date().toISOString() },
  { id: 'ast_2', asset_name: 'Toyota Forklift', asset_code: 'AST-2022-015', asset_category: 'vehicles', purchase_date: '2022-06-20', purchase_cost: 45000, salvage_value: 5000, useful_life_years: 10, depreciation_method: 'straight_line', status: 'active', location: 'Warehouse B', created_date: new Date().toISOString() },
  { id: 'ast_3', asset_name: 'Office Furniture Set', asset_code: 'AST-2024-002', asset_category: 'furniture', purchase_date: '2024-03-01', purchase_cost: 8000, salvage_value: 500, useful_life_years: 7, depreciation_method: 'straight_line', status: 'active', location: 'Floor 2', created_date: new Date().toISOString() }
];

const sampleExpenses = [
  { id: 'exp_1', claim_number: 'EXP-2025-001', employee_name: 'John Smith', expense_date: '2025-01-05', claim_date: '2025-01-06', category: 'travel', amount: 350, description: 'Client meeting travel', status: 'approved', created_date: new Date().toISOString() },
  { id: 'exp_2', claim_number: 'EXP-2025-002', employee_name: 'Sarah Johnson', expense_date: '2025-01-08', claim_date: '2025-01-09', category: 'meals', amount: 125, description: 'Team lunch', status: 'submitted', created_date: new Date().toISOString() },
  { id: 'exp_3', claim_number: 'EXP-2025-003', employee_name: 'Mike Chen', expense_date: '2025-01-10', claim_date: '2025-01-11', category: 'office_supplies', amount: 89, description: 'Office supplies purchase', status: 'draft', created_date: new Date().toISOString() }
];

const samplePayrolls = [
  { id: 'pay_1', payroll_number: 'PAY-2025-001', employee_name: 'John Smith', pay_period_start: '2025-01-01', pay_period_end: '2025-01-15', payment_date: '2025-01-20', basic_salary: 3541.67, overtime_hours: 5, overtime_pay: 110.68, bonuses: 500, allowances: 200, gross_pay: 4352.35, tax_deduction: 270.47, social_security: 269.85, health_insurance: 200, total_deductions: 740.32, net_pay: 3612.03, status: 'paid', created_date: new Date().toISOString() },
  { id: 'pay_2', payroll_number: 'PAY-2025-002', employee_name: 'Sarah Johnson', pay_period_start: '2025-01-01', pay_period_end: '2025-01-15', payment_date: '2025-01-20', basic_salary: 3958.33, overtime_hours: 0, overtime_pay: 0, bonuses: 1000, allowances: 300, gross_pay: 5258.33, tax_deduction: 451.67, social_security: 326.02, health_insurance: 200, total_deductions: 977.69, net_pay: 4280.64, status: 'approved', created_date: new Date().toISOString() }
];

const sampleContracts = [
  { id: 'cnt_1', contract_number: 'CNT-2024-001', contract_name: 'Annual Support Agreement', contract_type: 'customer', party_name: 'Tech Solutions Inc', start_date: '2024-01-01', end_date: '2024-12-31', contract_value: 50000, billing_cycle: 'monthly', auto_renew: true, status: 'active', created_date: new Date().toISOString() },
  { id: 'cnt_2', contract_number: 'CNT-2024-002', contract_name: 'Office Lease', contract_type: 'lease', party_name: 'Commercial Properties LLC', start_date: '2024-06-01', end_date: '2027-05-31', contract_value: 180000, billing_cycle: 'monthly', auto_renew: false, status: 'active', created_date: new Date().toISOString() },
  { id: 'cnt_3', contract_number: 'CNT-2025-001', contract_name: 'Software License', contract_type: 'vendor', party_name: 'SaaS Provider Co', start_date: '2025-01-01', end_date: '2025-12-31', contract_value: 12000, billing_cycle: 'annually', auto_renew: true, status: 'active', created_date: new Date().toISOString() }
];

export function ModulesProvider({ children }) {
  const { activeCompany } = useCompany();
  const [employees, setEmployees] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assets, setAssets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Load permissions from localStorage (company-scoped)
  const loadPermissions = useCallback(() => {
    try {
      const companyId = activeCompany?.id;
      const stored = localStorage.getItem(getStorageKey(PERMISSIONS_KEY, companyId));
      if (stored) {
        setPermissions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }, [activeCompany]);

  // Load from localStorage helper (company-scoped)
  const loadFromStorage = useCallback((key, setter, sampleData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(key, companyId);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setter(JSON.parse(stored));
    } else {
      localStorage.setItem(storageKey, JSON.stringify(sampleData));
      setter(sampleData);
    }
  }, [activeCompany]);

  // Initialize all data
  const loadData = useCallback(async () => {
    if (!activeCompany) return;

    setIsLoading(true);
    try {
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        try {
          const [empData, poData, soData] = await Promise.all([
            hrService.listEmployees(),
            purchaseService.listOrders(),
            salesService.listOrders()
          ]);
          if (empData?.length) setEmployees(empData);
          else loadFromStorage(EMPLOYEES_KEY, setEmployees, sampleEmployees);
          if (poData?.length) setPurchaseOrders(poData);
          else loadFromStorage(PURCHASE_ORDERS_KEY, setPurchaseOrders, samplePurchaseOrders);
          if (soData?.length) setSalesOrders(soData);
          else loadFromStorage(SALES_ORDERS_KEY, setSalesOrders, sampleSalesOrders);
        } catch (err) {
          console.warn('API failed, using localStorage:', err);
          loadFromStorage(EMPLOYEES_KEY, setEmployees, sampleEmployees);
          loadFromStorage(PURCHASE_ORDERS_KEY, setPurchaseOrders, samplePurchaseOrders);
          loadFromStorage(SALES_ORDERS_KEY, setSalesOrders, sampleSalesOrders);
        }
      } else {
        loadFromStorage(EMPLOYEES_KEY, setEmployees, sampleEmployees);
        loadFromStorage(PURCHASE_ORDERS_KEY, setPurchaseOrders, samplePurchaseOrders);
        loadFromStorage(SALES_ORDERS_KEY, setSalesOrders, sampleSalesOrders);
      }

      // Always load these from localStorage (no API endpoints yet)
      loadFromStorage(PROJECTS_KEY, setProjects, sampleProjects);
      loadFromStorage(ASSETS_KEY, setAssets, sampleAssets);
      loadFromStorage(EXPENSES_KEY, setExpenses, sampleExpenses);
      loadFromStorage(PAYROLLS_KEY, setPayrolls, samplePayrolls);
      loadFromStorage(CONTRACTS_KEY, setContracts, sampleContracts);

    } catch (err) {
      console.error('Error loading module data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadFromStorage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for company change events
  useEffect(() => {
    const handleCompanyChange = () => {
      loadData();
    };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadData]);

  // Generic CRUD helpers (company-scoped)
  const createItem = useCallback((key, setter, items, newItem) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(key, companyId);
    const itemWithCompany = { ...newItem, company_id: companyId };
    const updated = [itemWithCompany, ...items];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setter(updated);
    return itemWithCompany;
  }, [activeCompany]);

  const updateItem = useCallback((key, setter, items, id, data) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(key, companyId);
    const updated = items.map(item => item.id === id ? { ...item, ...data } : item);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setter(updated);
  }, [activeCompany]);

  const deleteItem = useCallback((key, setter, items, id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(key, companyId);
    const updated = items.filter(item => item.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setter(updated);
  }, [activeCompany]);

  // Employee CRUD
  const createEmployee = useCallback((data) => {
    const newEmp = { id: `emp_${Date.now()}`, ...data, created_date: new Date().toISOString() };
    return createItem(EMPLOYEES_KEY, setEmployees, employees, newEmp);
  }, [employees]);

  const updateEmployee = useCallback((id, data) => {
    updateItem(EMPLOYEES_KEY, setEmployees, employees, id, data);
  }, [employees]);

  const deleteEmployee = useCallback((id) => {
    deleteItem(EMPLOYEES_KEY, setEmployees, employees, id);
  }, [employees]);

  // Purchase Order CRUD
  const createPurchaseOrder = useCallback(async (data) => {
    if (backendAvailable) {
      try {
        const result = await purchaseService.createOrder(data);
        // Check if API returned valid PO data (not just a stub message)
        if (result && result.id && result.vendor_name) {
          setPurchaseOrders(prev => [result, ...prev]);
          return result;
        }
        // API returned stub response, fall through to localStorage
        console.log('API returned stub response, using localStorage');
      } catch (err) {
        console.error('API error:', err);
      }
    }
    // Create locally with all required fields - use unique ID with random suffix
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newPO = {
      id: `po_${uniqueId}`,
      po_number: data.po_number || `PO-${uniqueId}`,
      vendor_name: data.vendor_name,
      order_date: data.order_date,
      expected_delivery_date: data.expected_delivery_date,
      total_amount: data.total_amount || 0,
      payment_terms: data.payment_terms || 'net_30',
      status: data.status || 'draft',
      created_date: new Date().toISOString()
    };
    return createItem(PURCHASE_ORDERS_KEY, setPurchaseOrders, purchaseOrders, newPO);
  }, [backendAvailable, purchaseOrders]);

  const updatePurchaseOrder = useCallback((id, data) => {
    updateItem(PURCHASE_ORDERS_KEY, setPurchaseOrders, purchaseOrders, id, data);
  }, [purchaseOrders]);

  // Sales Order CRUD
  const createSalesOrder = useCallback(async (data) => {
    if (backendAvailable) {
      try {
        const result = await salesService.createOrder(data);
        // Check if API returned valid SO data (not just a stub message)
        if (result && result.id && result.customer_name) {
          setSalesOrders(prev => [result, ...prev]);
          return result;
        }
        // API returned stub response, fall through to localStorage
        console.log('API returned stub response, using localStorage');
      } catch (err) {
        console.error('API error:', err);
      }
    }
    // Create locally with all required fields - use unique ID with random suffix
    const uniqueSOId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newSO = {
      id: `so_${uniqueSOId}`,
      order_number: data.order_number || `SO-${uniqueSOId}`,
      customer_name: data.customer_name,
      order_date: data.order_date,
      delivery_date: data.delivery_date,
      subtotal: data.subtotal || 0,
      tax_amount: data.tax_amount || 0,
      shipping_cost: data.shipping_cost || 0,
      total_amount: data.total_amount || 0,
      status: data.status || 'quotation',
      payment_status: data.payment_status || 'unpaid',
      created_date: new Date().toISOString()
    };
    return createItem(SALES_ORDERS_KEY, setSalesOrders, salesOrders, newSO);
  }, [backendAvailable, salesOrders]);

  const updateSalesOrder = useCallback((id, data) => {
    updateItem(SALES_ORDERS_KEY, setSalesOrders, salesOrders, id, data);
  }, [salesOrders]);

  // Project CRUD
  const createProject = useCallback((data) => {
    const newProject = { id: `prj_${Date.now()}`, project_code: data.project_code || `PRJ-${Date.now()}`, ...data, created_date: new Date().toISOString() };
    return createItem(PROJECTS_KEY, setProjects, projects, newProject);
  }, [projects]);

  const updateProject = useCallback((id, data) => {
    updateItem(PROJECTS_KEY, setProjects, projects, id, data);
  }, [projects]);

  // Asset CRUD
  const createAsset = useCallback((data) => {
    const newAsset = { id: `ast_${Date.now()}`, asset_code: data.asset_code || `AST-${Date.now()}`, ...data, created_date: new Date().toISOString() };
    return createItem(ASSETS_KEY, setAssets, assets, newAsset);
  }, [assets]);

  const updateAsset = useCallback((id, data) => {
    updateItem(ASSETS_KEY, setAssets, assets, id, data);
  }, [assets]);

  // Expense CRUD
  const createExpense = useCallback((data) => {
    const newExpense = { id: `exp_${Date.now()}`, claim_number: data.claim_number || `EXP-${Date.now()}`, ...data, created_date: new Date().toISOString() };
    return createItem(EXPENSES_KEY, setExpenses, expenses, newExpense);
  }, [expenses]);

  const updateExpense = useCallback((id, data) => {
    updateItem(EXPENSES_KEY, setExpenses, expenses, id, data);
  }, [expenses]);

  // Payroll CRUD
  const createPayroll = useCallback((data) => {
    const newPayroll = { id: `pay_${Date.now()}`, payroll_number: data.payroll_number || `PAY-${Date.now()}`, ...data, created_date: new Date().toISOString() };
    return createItem(PAYROLLS_KEY, setPayrolls, payrolls, newPayroll);
  }, [payrolls]);

  const updatePayroll = useCallback((id, data) => {
    updateItem(PAYROLLS_KEY, setPayrolls, payrolls, id, data);
  }, [payrolls]);

  // Contract CRUD
  const createContract = useCallback((data) => {
    const newContract = { id: `cnt_${Date.now()}`, contract_number: data.contract_number || `CNT-${Date.now()}`, ...data, created_date: new Date().toISOString() };
    return createItem(CONTRACTS_KEY, setContracts, contracts, newContract);
  }, [contracts]);

  const updateContract = useCallback((id, data) => {
    updateItem(CONTRACTS_KEY, setContracts, contracts, id, data);
  }, [contracts]);

  const deleteContract = useCallback((id) => {
    deleteItem(CONTRACTS_KEY, setContracts, contracts, id);
  }, [contracts]);

  // Permission CRUD operations
  // Get permissions for a specific employee
  const getEmployeePermissions = useCallback((employeeId) => {
    return permissions[employeeId] || {};
  }, [permissions]);

  // Set permissions for an employee
  const setEmployeePermissions = useCallback((employeeId, modulePermissions) => {
    const updated = { ...permissions, [employeeId]: modulePermissions };
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
    setPermissions(updated);
  }, [permissions]);

  // Update single module permission for an employee
  const updateModulePermission = useCallback((employeeId, moduleId, permissionType, value) => {
    const employeePerms = permissions[employeeId] || {};
    const modulePerms = employeePerms[moduleId] || { create: false, read: false, update: false, delete: false };

    const updatedModulePerms = { ...modulePerms, [permissionType]: value };
    const updatedEmployeePerms = { ...employeePerms, [moduleId]: updatedModulePerms };
    const updated = { ...permissions, [employeeId]: updatedEmployeePerms };

    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
    setPermissions(updated);
  }, [permissions]);

  // Check if employee has specific permission
  const hasPermission = useCallback((employeeId, moduleId, permissionType) => {
    const employeePerms = permissions[employeeId];
    if (!employeePerms) return false;
    const modulePerms = employeePerms[moduleId];
    if (!modulePerms) return false;
    return modulePerms[permissionType] === true;
  }, [permissions]);

  // Set all CRUD permissions for a module at once
  const setModuleFullAccess = useCallback((employeeId, moduleId, hasAccess) => {
    const employeePerms = permissions[employeeId] || {};
    const updatedModulePerms = {
      create: hasAccess,
      read: hasAccess,
      update: hasAccess,
      delete: hasAccess
    };
    const updatedEmployeePerms = { ...employeePerms, [moduleId]: updatedModulePerms };
    const updated = { ...permissions, [employeeId]: updatedEmployeePerms };

    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
    setPermissions(updated);
  }, [permissions]);

  // Delete all permissions for an employee
  const deleteEmployeePermissions = useCallback((employeeId) => {
    const updated = { ...permissions };
    delete updated[employeeId];
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
    setPermissions(updated);
  }, [permissions]);

  // Load permissions on mount
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return (
    <ModulesContext.Provider value={{
      // Data
      employees, purchaseOrders, salesOrders, projects, assets, expenses, payrolls, contracts,
      isLoading, backendAvailable,
      // Employee methods
      createEmployee, updateEmployee, deleteEmployee,
      // Purchase Order methods
      createPurchaseOrder, updatePurchaseOrder,
      // Sales Order methods
      createSalesOrder, updateSalesOrder,
      // Project methods
      createProject, updateProject,
      // Asset methods
      createAsset, updateAsset,
      // Expense methods
      createExpense, updateExpense,
      // Payroll methods
      createPayroll, updatePayroll,
      // Contract methods
      createContract, updateContract, deleteContract,
      // Permission methods
      permissions,
      allModules: ALL_MODULES,
      coreModules: CORE_MODULES,
      appModules: APP_MODULES,
      getEmployeePermissions,
      setEmployeePermissions,
      updateModulePermission,
      hasPermission,
      setModuleFullAccess,
      deleteEmployeePermissions,
      // Refresh
      refreshData: loadData
    }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModulesContext);
  if (!context) {
    throw new Error('useModules must be used within ModulesProvider');
  }
  return context;
}
