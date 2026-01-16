import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { hrService, purchaseService, salesService, financeService, procurementService, projectsService } from '@/api/services';
import { useCompany } from './CompanyContext';
import { checkBackendHealth } from '@/config/dataMode';

// Storage key for permissions only (still using localStorage)
const PERMISSIONS_KEY = 'genix_employee_permissions';

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
      const storageKey = companyId ? `${PERMISSIONS_KEY}_${companyId}` : PERMISSIONS_KEY;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setPermissions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }, [activeCompany]);

  // Initialize all data from backend API
  const loadData = useCallback(async () => {
    if (!activeCompany) return;

    setIsLoading(true);
    try {
      const isAvailable = await checkBackendHealth();
      setBackendAvailable(isAvailable);

      if (!isAvailable) {
        console.warn('Backend not available');
        setIsLoading(false);
        return;
      }

      // Load all data from API in parallel
      const [
        empData,
        poData,
        soData,
        projectsData,
        contractsData,
        expensesData,
        assetsData,
        payrollsData
      ] = await Promise.all([
        hrService.listEmployees().catch(err => { console.warn('Employees API error:', err); return []; }),
        purchaseService.listOrders().catch(err => { console.warn('PO API error:', err); return []; }),
        salesService.listOrders().catch(err => { console.warn('SO API error:', err); return []; }),
        projectsService.listProjects().catch(err => { console.warn('Projects API error:', err); return []; }),
        procurementService.listContracts().catch(err => { console.warn('Contracts API error:', err); return []; }),
        financeService.listExpenses().catch(err => { console.warn('Expenses API error:', err); return []; }),
        financeService.listFixedAssets().catch(err => { console.warn('Assets API error:', err); return []; }),
        hrService.listPayrollPeriods().catch(err => { console.warn('Payroll API error:', err); return []; })
      ]);

      // Set data from API responses
      setEmployees(empData?.items || empData || []);
      setPurchaseOrders(poData?.items || poData || []);
      setSalesOrders(soData?.items || soData || []);
      setProjects(projectsData?.items || projectsData || []);
      setContracts(contractsData?.items || contractsData || []);
      setExpenses(expensesData?.items || expensesData || []);
      setAssets(assetsData?.items || assetsData || []);
      setPayrolls(payrollsData?.items || payrollsData || []);

    } catch (err) {
      console.error('Error loading module data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany]);

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

  // Employee CRUD - API only
  const createEmployee = useCallback(async (data) => {
    const result = await hrService.createEmployee(data);
    if (result && result.id) {
      setEmployees(prev => [result, ...prev]);
      return result;
    }
    throw new Error('Failed to create employee');
  }, []);

  const updateEmployee = useCallback(async (id, data) => {
    const result = await hrService.updateEmployee(id, data);
    if (result) {
      setEmployees(prev => prev.map(e => e.id === id ? result : e));
      return result;
    }
    throw new Error('Failed to update employee');
  }, []);

  const deleteEmployee = useCallback(async (id) => {
    await hrService.deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e.id !== id));
  }, []);

  // Purchase Order CRUD - API only
  const createPurchaseOrder = useCallback(async (data) => {
    const result = await purchaseService.createOrder(data);
    if (result && result.id) {
      setPurchaseOrders(prev => [result, ...prev]);
      return result;
    }
    throw new Error('Failed to create purchase order');
  }, []);

  const updatePurchaseOrder = useCallback(async (id, data) => {
    const result = await purchaseService.updateOrder(id, data);
    if (result) {
      setPurchaseOrders(prev => prev.map(p => p.id === id ? result : p));
      return result;
    }
    throw new Error('Failed to update purchase order');
  }, []);

  const deletePurchaseOrder = useCallback(async (id) => {
    await purchaseService.deleteOrder(id);
    setPurchaseOrders(prev => prev.filter(p => p.id !== id));
  }, []);

  // Sales Order CRUD - API only
  const createSalesOrder = useCallback(async (data) => {
    const result = await salesService.createOrder(data);
    if (result && result.id) {
      setSalesOrders(prev => [result, ...prev]);
      return result;
    }
    throw new Error('Failed to create sales order');
  }, []);

  const updateSalesOrder = useCallback(async (id, data) => {
    const result = await salesService.updateOrder(id, data);
    if (result) {
      setSalesOrders(prev => prev.map(s => s.id === id ? result : s));
      return result;
    }
    throw new Error('Failed to update sales order');
  }, []);

  const deleteSalesOrder = useCallback(async (id) => {
    await salesService.deleteOrder(id);
    setSalesOrders(prev => prev.filter(s => s.id !== id));
  }, []);

  // Project CRUD - API only
  const createProject = useCallback(async (data) => {
    const apiData = {
      project_code: data.project_code,
      project_name: data.project_name || data.name,
      description: data.description,
      client_name: data.client_name,
      start_date: data.start_date,
      end_date: data.end_date,
      budget: data.budget || 0,
      billing_type: data.billing_type,
      priority: data.priority || 'medium',
      status: data.status || 'planning'
    };
    const result = await projectsService.createProject(apiData);
    if (result && result.data) {
      const mappedResult = {
        ...result.data,
        project_name: result.data.name
      };
      setProjects(prev => [mappedResult, ...prev]);
      return mappedResult;
    }
    throw new Error('Failed to create project');
  }, []);

  const updateProject = useCallback(async (id, data) => {
    const apiData = {
      project_name: data.project_name || data.name,
      description: data.description,
      client_name: data.client_name,
      start_date: data.start_date,
      end_date: data.end_date,
      budget: data.budget,
      billing_type: data.billing_type,
      priority: data.priority,
      status: data.status
    };
    const result = await projectsService.updateProject(id, apiData);
    if (result && result.data) {
      const mappedResult = {
        ...result.data,
        project_name: result.data.name
      };
      setProjects(prev => prev.map(p => p.id === id ? mappedResult : p));
      return mappedResult;
    }
    throw new Error('Failed to update project');
  }, []);

  const deleteProject = useCallback(async (id) => {
    await projectsService.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  // Asset CRUD (Fixed Assets) - API only
  const createAsset = useCallback(async (data) => {
    const apiData = {
      code: data.asset_code || data.code,
      name: data.asset_name || data.name,
      description: data.description,
      category_id: data.category_id,
      category: data.asset_category || data.category,
      serial_number: data.serial_number,
      acquisition_date: data.purchase_date || data.acquisition_date,
      acquisition_cost: data.purchase_cost || data.acquisition_cost || 0,
      salvage_value: data.salvage_value || 0,
      useful_life_months: (data.useful_life_years || 5) * 12,
      depreciation_method: data.depreciation_method || 'straight_line',
      location: data.location,
      custodian_name: data.custodian_name,
      warranty_expiry: data.warranty_expiry,
      notes: data.notes
    };
    const result = await financeService.createFixedAsset(apiData);
    if (result && result.id) {
      const mappedResult = {
        ...result,
        asset_name: result.name,
        asset_category: result.category_name || result.category,
        purchase_date: result.acquisition_date,
        purchase_cost: result.acquisition_cost,
        useful_life_years: Math.round(result.useful_life_months / 12)
      };
      setAssets(prev => [mappedResult, ...prev]);
      return mappedResult;
    }
    throw new Error('Failed to create asset');
  }, []);

  const updateAsset = useCallback(async (id, data) => {
    const apiData = {
      name: data.asset_name || data.name,
      description: data.description,
      category_id: data.category_id,
      serial_number: data.serial_number,
      acquisition_date: data.purchase_date || data.acquisition_date,
      acquisition_cost: data.purchase_cost || data.acquisition_cost,
      salvage_value: data.salvage_value,
      useful_life_months: data.useful_life_years ? data.useful_life_years * 12 : data.useful_life_months,
      depreciation_method: data.depreciation_method,
      location: data.location,
      custodian_name: data.custodian_name,
      warranty_expiry: data.warranty_expiry,
      status: data.status,
      notes: data.notes
    };
    const result = await financeService.updateFixedAsset(id, apiData);
    if (result) {
      const mappedResult = {
        ...result,
        asset_name: result.name,
        asset_category: result.category_name || result.category,
        purchase_date: result.acquisition_date,
        purchase_cost: result.acquisition_cost,
        useful_life_years: Math.round(result.useful_life_months / 12)
      };
      setAssets(prev => prev.map(a => a.id === id ? mappedResult : a));
      return mappedResult;
    }
    throw new Error('Failed to update asset');
  }, []);

  const deleteAsset = useCallback(async (id) => {
    await financeService.deleteFixedAsset(id);
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  const disposeAsset = useCallback(async (id, disposalData) => {
    const result = await financeService.disposeFixedAsset(id, {
      disposal_date: disposalData.disposal_date,
      disposal_amount: disposalData.disposal_amount,
      disposal_reason: disposalData.disposal_reason
    });
    if (result) {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, ...result, status: 'disposed' } : a));
      return result;
    }
    throw new Error('Failed to dispose asset');
  }, []);

  // Expense CRUD - API only
  const createExpense = useCallback(async (data) => {
    const apiData = {
      date: data.expense_date || data.claim_date || data.date,
      description: data.description,
      amount: data.amount || 0,
      tax_amount: data.tax_amount || 0,
      currency: data.currency || 'UZS',
      employee_name: data.employee_name,
      vendor_name: data.vendor_name,
      category_id: data.category_id,
      payment_method: data.payment_method,
      reference: data.reference || data.claim_number,
      reimbursable: data.reimbursable || false,
      notes: data.notes
    };
    const result = await financeService.createExpense(apiData);
    if (result && result.id) {
      const mappedResult = {
        ...result,
        claim_number: result.expense_number,
        claim_date: result.expense_date,
        category: result.category_name
      };
      setExpenses(prev => [mappedResult, ...prev]);
      return mappedResult;
    }
    throw new Error('Failed to create expense');
  }, []);

  const updateExpense = useCallback(async (id, data) => {
    const apiData = {
      date: data.expense_date || data.claim_date || data.date,
      description: data.description,
      amount: data.amount,
      tax_amount: data.tax_amount,
      currency: data.currency,
      employee_name: data.employee_name,
      vendor_name: data.vendor_name,
      category_id: data.category_id,
      payment_method: data.payment_method,
      reference: data.reference,
      reimbursable: data.reimbursable,
      notes: data.notes,
      status: data.status
    };
    const result = await financeService.updateExpense(id, apiData);
    if (result) {
      const mappedResult = {
        ...result,
        claim_number: result.expense_number,
        claim_date: result.expense_date,
        category: result.category_name
      };
      setExpenses(prev => prev.map(e => e.id === id ? mappedResult : e));
      return mappedResult;
    }
    throw new Error('Failed to update expense');
  }, []);

  const deleteExpense = useCallback(async (id) => {
    await financeService.deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  const approveExpense = useCallback(async (id) => {
    const result = await financeService.approveExpense(id);
    if (result) {
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: 'approved' } : e));
      return result;
    }
    throw new Error('Failed to approve expense');
  }, []);

  // Payroll CRUD (maps to payroll periods in backend) - API only
  const createPayroll = useCallback(async (data) => {
    const apiData = {
      period_code: data.payroll_number,
      period_name: data.period_name || `Payroll ${data.pay_period_start} - ${data.pay_period_end}`,
      start_date: data.pay_period_start,
      end_date: data.pay_period_end,
      pay_date: data.payment_date,
      notes: data.notes
    };
    const result = await hrService.createPayrollPeriod(apiData);
    if (result && result.id) {
      const mappedResult = {
        ...result,
        payroll_number: result.period_code,
        pay_period_start: result.start_date,
        pay_period_end: result.end_date,
        payment_date: result.pay_date,
        gross_pay: result.total_gross,
        total_deductions: result.total_deductions,
        net_pay: result.total_net
      };
      setPayrolls(prev => [mappedResult, ...prev]);
      return mappedResult;
    }
    throw new Error('Failed to create payroll');
  }, []);

  const updatePayroll = useCallback(async (id, data) => {
    const apiData = {
      period_name: data.period_name,
      start_date: data.pay_period_start,
      end_date: data.pay_period_end,
      pay_date: data.payment_date,
      status: data.status,
      notes: data.notes
    };
    const result = await hrService.updatePayrollPeriod(id, apiData);
    if (result) {
      const mappedResult = {
        ...result,
        payroll_number: result.period_code,
        pay_period_start: result.start_date,
        pay_period_end: result.end_date,
        payment_date: result.pay_date,
        gross_pay: result.total_gross,
        total_deductions: result.total_deductions,
        net_pay: result.total_net
      };
      setPayrolls(prev => prev.map(p => p.id === id ? mappedResult : p));
      return mappedResult;
    }
    throw new Error('Failed to update payroll');
  }, []);

  const deletePayroll = useCallback(async (id) => {
    await hrService.deletePayrollPeriod(id);
    setPayrolls(prev => prev.filter(p => p.id !== id));
  }, []);

  const processPayroll = useCallback(async (id) => {
    const result = await hrService.processPayroll(id);
    if (result) {
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
      return result;
    }
    throw new Error('Failed to process payroll');
  }, []);

  // Contract CRUD - API only
  const createContract = useCallback(async (data) => {
    const apiData = {
      contract_number: data.contract_number,
      title: data.contract_name || data.title,
      supplier_name: data.party_name || data.supplier_name,
      type: data.contract_type || data.type,
      start_date: data.start_date,
      end_date: data.end_date,
      value: data.contract_value || data.value || 0,
      currency: data.currency || 'UZS',
      auto_renew: data.auto_renew || false,
      description: data.description,
      payment_terms: data.billing_cycle || data.payment_terms
    };
    const result = await procurementService.createContract(apiData);
    if (result && result.id) {
      const mappedResult = {
        ...result,
        contract_name: result.title,
        party_name: result.supplier_name,
        contract_value: result.value,
        billing_cycle: result.payment_terms
      };
      setContracts(prev => [mappedResult, ...prev]);
      return mappedResult;
    }
    throw new Error('Failed to create contract');
  }, []);

  const updateContract = useCallback(async (id, data) => {
    const apiData = {
      title: data.contract_name || data.title,
      supplier_name: data.party_name || data.supplier_name,
      type: data.contract_type || data.type,
      start_date: data.start_date,
      end_date: data.end_date,
      value: data.contract_value || data.value,
      currency: data.currency,
      auto_renew: data.auto_renew,
      description: data.description,
      payment_terms: data.billing_cycle || data.payment_terms,
      status: data.status
    };
    const result = await procurementService.updateContract(id, apiData);
    if (result) {
      const mappedResult = {
        ...result,
        contract_name: result.title,
        party_name: result.supplier_name,
        contract_value: result.value,
        billing_cycle: result.payment_terms
      };
      setContracts(prev => prev.map(c => c.id === id ? mappedResult : c));
      return mappedResult;
    }
    throw new Error('Failed to update contract');
  }, []);

  const deleteContract = useCallback(async (id) => {
    await procurementService.deleteContract(id);
    setContracts(prev => prev.filter(c => c.id !== id));
  }, []);

  // Permission CRUD operations (still using localStorage)
  const getEmployeePermissions = useCallback((employeeId) => {
    return permissions[employeeId] || {};
  }, [permissions]);

  const setEmployeePermissions = useCallback((employeeId, modulePermissions) => {
    const updated = { ...permissions, [employeeId]: modulePermissions };
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
    setPermissions(updated);
  }, [permissions]);

  const updateModulePermission = useCallback((employeeId, moduleId, permissionType, value) => {
    const employeePerms = permissions[employeeId] || {};
    const modulePerms = employeePerms[moduleId] || { create: false, read: false, update: false, delete: false };

    const updatedModulePerms = { ...modulePerms, [permissionType]: value };
    const updatedEmployeePerms = { ...employeePerms, [moduleId]: updatedModulePerms };
    const updated = { ...permissions, [employeeId]: updatedEmployeePerms };

    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
    setPermissions(updated);
  }, [permissions]);

  const hasPermission = useCallback((employeeId, moduleId, permissionType) => {
    const employeePerms = permissions[employeeId];
    if (!employeePerms) return false;
    const modulePerms = employeePerms[moduleId];
    if (!modulePerms) return false;
    return modulePerms[permissionType] === true;
  }, [permissions]);

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
      createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder,
      // Sales Order methods
      createSalesOrder, updateSalesOrder, deleteSalesOrder,
      // Project methods
      createProject, updateProject, deleteProject,
      // Asset methods
      createAsset, updateAsset, deleteAsset, disposeAsset,
      // Expense methods
      createExpense, updateExpense, deleteExpense, approveExpense,
      // Payroll methods
      createPayroll, updatePayroll, deletePayroll, processPayroll,
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
