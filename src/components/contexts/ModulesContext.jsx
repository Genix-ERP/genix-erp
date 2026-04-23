import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { hrService, purchaseService, salesService, financeService, procurementService, projectsService } from '@/api/services';
import { useCompany } from './CompanyContext';
import { checkBackendHealth } from '@/config/dataMode';

// Storage key for permissions only (still using localStorage)
const PERMISSIONS_KEY = 'genix_employee_permissions';

// All available modules for permissions (matching sidebar structure)
// Core modules are always visible, app modules depend on installation
const CORE_MODULES = [
  { id: 'dashboard', nameKey: 'dashboard', icon: 'LayoutDashboard', isCore: true },
  { id: 'ai_assistant', nameKey: 'ai_assistant', icon: 'Bot', isCore: true },
  { id: 'workflows', nameKey: 'workflows', icon: 'Zap', isCore: true },
  { id: 'apps', nameKey: 'apps', icon: 'Grid3x3', isCore: true },
  { id: 'settings', nameKey: 'settings', icon: 'Settings', isCore: true },
  { id: 'admin_panel', nameKey: 'admin_panel', icon: 'Shield', isCore: true, adminOnly: true }
];

const APP_MODULES = [
  { id: 'inventory', nameKey: 'inventory', icon: 'Package', appId: 'inventory' },
  { id: 'customers', nameKey: 'customers', icon: 'Users', appId: 'crm' },
  { id: 'financials', nameKey: 'financials', icon: 'DollarSign', appId: 'finance' },
  { id: 'hr', nameKey: 'hr', icon: 'Briefcase', appId: 'hr' },
  { id: 'manufacturing', nameKey: 'manufacturing', icon: 'Zap', appId: 'manufacturing' },
  { id: 'procurement', nameKey: 'procurement', icon: 'ShoppingCart', appId: 'procurement' },
  { id: 'projects', nameKey: 'projects', icon: 'Briefcase', appId: 'projects' },
  { id: 'sales_orders', nameKey: 'sales_orders', icon: 'ShoppingBag', appId: 'sales_orders' },
  { id: 'assets', nameKey: 'assets', icon: 'Monitor', appId: 'assets' },
  { id: 'expenses', nameKey: 'expenses', icon: 'Receipt', appId: 'expenses' },
  { id: 'payroll', nameKey: 'payroll', icon: 'DollarSign', appId: 'payroll' },
  { id: 'contracts', nameKey: 'contracts', icon: 'FileText', appId: 'contracts' },
  { id: 'director_dashboard', nameKey: 'director_dashboard', icon: 'BarChart3', appId: 'director_dashboard' }
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
        salesService.listOrders({ page_size: 1000 }).catch(err => { console.warn('SO API error:', err); return []; }),
        projectsService.listProjects().catch(err => { console.warn('Projects API error:', err); return []; }),
        procurementService.listContracts().catch(err => { console.warn('Contracts API error:', err); return []; }),
        financeService.listExpenses().catch(err => { console.warn('Expenses API error:', err); return []; }),
        financeService.listFixedAssets().catch(err => { console.warn('Assets API error:', err); return []; }),
        hrService.listPayrollPeriods().catch(err => { console.warn('Payroll API error:', err); return []; })
      ]);

      // Helper to safely extract array from API response
      const toArray = (d) => Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];

      // Set data from API responses
      setEmployees(toArray(empData));
      setPurchaseOrders(toArray(poData));
      setSalesOrders(toArray(soData));
      // Map backend project fields to frontend expected fields
      const rawProjects = toArray(projectsData);
      const mappedProjects = rawProjects.map(p => ({
        ...p,
        project_name: p.name || p.project_name,
        progress_percentage: p.progress || p.progress_percentage || 0
      }));
      setProjects(mappedProjects);
      // Map backend contract fields to frontend expected fields
      const rawContracts = toArray(contractsData);
      const mappedContracts = rawContracts.map(c => ({
        ...c,
        contract_name: c.title || c.contract_name,
        party_name: c.vendor_name || c.party_name || '',
        contract_value: c.value || c.contract_value || 0,
        billing_cycle: c.terms || c.billing_cycle || 'monthly',
        auto_renew: c.auto_renewal || c.auto_renew || false,
      }));
      setContracts(mappedContracts);
      // Map backend expense fields to frontend expected fields
      // Backend returns: date (not expense_date), expense_number, category (not category_name)
      const rawExpenses = toArray(expensesData);
      const mappedExpenses = rawExpenses.map(e => ({
        ...e,
        claim_number: e.expense_number || e.claim_number,
        expense_date: e.date || e.expense_date || e.claim_date, // Backend returns 'date'
        claim_date: e.date || e.expense_date || e.claim_date,
        category: e.category || e.category_name || 'other', // Backend returns 'category'
      }));
      setExpenses(mappedExpenses);
      // Map backend asset fields to frontend expected fields
      const rawAssets = toArray(assetsData);
      const mappedAssets = rawAssets.map(a => ({
        ...a,
        asset_name: a.name || a.asset_name,
        asset_code: a.code || a.asset_code,
        asset_category: a.category_name || a.category || a.asset_category || 'equipment',
        purchase_date: a.acquisition_date || a.purchase_date,
        purchase_cost: a.acquisition_cost || a.purchase_cost || 0,
        useful_life_years: a.useful_life_months ? Math.round(a.useful_life_months / 12) : (a.useful_life_years || 5),
        salvage_value: a.salvage_value || 0,
        current_value: a.current_value || a.acquisition_cost || a.purchase_cost || 0,
      }));
      setAssets(mappedAssets);
      // Map backend payroll period fields to frontend expected fields
      const rawPayrolls = toArray(payrollsData);
      const mappedPayrolls = rawPayrolls.map(p => ({
        ...p,
        payroll_number: p.period_code || p.payroll_number,
        period_name: p.period_name,
        employee_name: p.employee_name || (p.employee_count > 1 ? `${p.employee_count} employees` : p.period_name),
        employee_count: p.employee_count || 0,
        pay_period_start: p.start_date || p.pay_period_start,
        pay_period_end: p.end_date || p.pay_period_end,
        payment_date: p.pay_date || p.payment_date,
        gross_pay: p.total_gross || p.gross_pay || 0,
        net_pay: p.total_net || p.net_pay || 0,
        deductions: p.total_deductions || p.deductions || 0,
      }));
      setPayrolls(mappedPayrolls);

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
        project_name: result.data.name || result.data.project_name,
        client_name: result.data.client_name || data.client_name,
        progress_percentage: result.data.progress || 0
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
      status: data.status,
      progress: data.progress_percentage !== undefined ? data.progress_percentage : data.progress
    };
    const result = await projectsService.updateProject(id, apiData);
    if (result && result.data) {
      const mappedResult = {
        ...result.data,
        project_name: result.data.name || result.data.project_name,
        progress_percentage: result.data.progress
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
      notes: data.notes,
      supplier_id: data.supplier_id,
      supplier_name: data.supplier_name,
      payment_method: data.payment_method,
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
      description: data.description || 'Expense', // Default description if empty
      amount: data.amount || 0,
      tax_amount: data.tax_amount || 0,
      currency: data.currency || 'UZS',
      employee_name: data.employee_name,
      vendor_name: data.vendor_name,
      category_id: data.category_id,
      category: data.category, // Send category name to backend
      payment_method: data.payment_method,
      reference: data.reference || data.claim_number,
      reimbursable: data.reimbursable || false,
      notes: data.notes,
      // Profit-tax recognition flag — forwarded when caller provides it;
      // backend defaults to TRUE otherwise (migration 336).
      ...(data.is_recognized !== undefined && { is_recognized: Boolean(data.is_recognized) }),
    };
    const result = await financeService.createExpense(apiData);
    if (result && result.id) {
      const mappedResult = {
        ...result,
        claim_number: result.expense_number,
        expense_date: result.date || result.expense_date,
        claim_date: result.date || result.expense_date,
        category: result.category || result.category_name || data.category || 'other',
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
      category: data.category, // Send category name to backend
      payment_method: data.payment_method,
      reference: data.reference,
      reimbursable: data.reimbursable,
      notes: data.notes,
      status: data.status,
      ...(data.is_recognized !== undefined && { is_recognized: Boolean(data.is_recognized) }),
    };
    const result = await financeService.updateExpense(id, apiData);
    if (result) {
      const mappedResult = {
        ...result,
        claim_number: result.expense_number,
        expense_date: result.date || result.expense_date,
        claim_date: result.date || result.expense_date,
        category: result.category || result.category_name || data.category || 'other',
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

  // Flip the profit-tax recognition flag on a single expense. Uses the
  // dedicated PATCH /expenses/:id/recognize endpoint (see §7.2 of
  // ТЗ_Ish_Haqi_Soliq_Tolik.docx) and mirrors the change locally so the
  // Expenses table re-colours immediately without a full reload.
  const recognizeExpense = useCallback(async (id, isRecognized) => {
    const result = await financeService.recognizeExpense(id, isRecognized);
    setExpenses(prev =>
      prev.map(e => (e.id === id ? { ...e, ...(result || {}), is_recognized: Boolean(isRecognized) } : e))
    );
    return result;
  }, []);

  // Payroll CRUD (maps to payroll periods in backend) - API only
  // Creates a payroll period and optionally adds an entry for the employee
  const createPayroll = useCallback(async (data) => {
    // First create the payroll period
    const periodData = {
      period_code: data.payroll_number,
      period_name: data.period_name || `Payroll ${data.pay_period_start} - ${data.pay_period_end}`,
      start_date: data.pay_period_start,
      end_date: data.pay_period_end,
      pay_date: data.payment_date,
      notes: data.notes
    };
    const periodResult = await hrService.createPayrollPeriod(periodData);

    if (periodResult && periodResult.id) {
      // If employee salary data is provided, create a payroll entry
      if (data.employee_id && data.basic_salary > 0) {
        try {
          await hrService.createPayrollEntry(periodResult.id, {
            employee_id: data.employee_id,
            base_salary: data.basic_salary || 0,
            overtime_hours: data.overtime_hours || 0,
            overtime_amount: data.overtime_pay || 0,
            bonus: data.bonuses || 0,
            allowances: data.allowances || 0,
            gross_salary: data.gross_pay || 0,
            income_tax: data.tax_deduction || 0,
            social_security: data.social_security || 0,
            pension: 0,
            other_deductions: data.other_deductions || 0,
            deduction_percent: data.deduction_percent || 0,
            total_deductions: data.total_deductions || 0,
            net_salary: data.net_pay || 0,
            payment_method: data.payment_method || 'bank_transfer',
            status: 'calculated',
            // migration 330: pass through the list of tax IDs the user X-ed out in
            // the payroll modal. If the caller didn't supply the field, we send
            // undefined so the server uses its default (apply all active taxes).
            excluded_tax_ids: Array.isArray(data.excluded_tax_ids) ? data.excluded_tax_ids : undefined,
          });
        } catch (entryError) {
          console.warn('Failed to create payroll entry:', entryError);
        }
      }

      const mappedResult = {
        ...periodResult,
        payroll_number: periodResult.period_code,
        period_name: periodResult.period_name,
        employee_id: data.employee_id || periodResult.employee_id || '',
        employee_name: data.employee_name || periodResult.period_name, // Store employee name for display
        pay_period_start: periodResult.start_date,
        pay_period_end: periodResult.end_date,
        payment_date: periodResult.pay_date,
        gross_pay: data.gross_pay || periodResult.total_gross || 0,
        total_deductions: data.total_deductions || periodResult.total_deductions || 0,
        net_pay: data.net_pay || periodResult.total_net || 0,
        employee_count: data.employee_id ? 1 : (periodResult.employee_count || 0)
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
    // Backend expects: title, vendor_id, contract_type, start_date, value (required)
    // Backend contract_type options: fixed, annual, monthly, project
    const apiData = {
      title: data.title || data.contract_name,
      vendor_id: data.vendor_id,
      contract_type: data.contract_type || 'fixed',
      start_date: data.start_date,
      end_date: data.end_date || undefined,
      value: data.value || data.contract_value || 0,
      auto_renewal: data.auto_renewal || data.auto_renew || false,
      description: data.description,
      terms: data.terms || data.billing_cycle,
    };
    const result = await procurementService.createContract(apiData);
    if (result && result.id) {
      const mappedResult = {
        ...result,
        contract_name: result.title,
        party_name: result.vendor_name || data.party_name || '',
        contract_value: result.value,
        billing_cycle: result.terms
      };
      setContracts(prev => [mappedResult, ...prev]);
      return mappedResult;
    }
    throw new Error('Failed to create contract');
  }, []);

  const updateContract = useCallback(async (id, data) => {
    const apiData = {
      title: data.contract_name || data.title,
      contract_type: data.contract_type,
      start_date: data.start_date,
      end_date: data.end_date,
      value: data.contract_value || data.value,
      auto_renewal: data.auto_renew || data.auto_renewal,
      description: data.description,
      terms: data.billing_cycle || data.terms,
      status: data.status
    };
    const result = await procurementService.updateContract(id, apiData);
    // Update succeeded - update local state with mapped fields
    // Keep original data and merge with any response data
    const updatedContract = {
      ...data,
      id,
      contract_name: data.contract_name || data.title,
      party_name: data.party_name || data.vendor_name || '',
      contract_value: data.contract_value || data.value || 0,
      billing_cycle: data.billing_cycle || data.terms || 'monthly',
      auto_renew: data.auto_renew || data.auto_renewal || false,
    };
    setContracts(prev => prev.map(c => c.id === id ? updatedContract : c));
    return updatedContract;
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

  const value = useMemo(() => ({
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
    createExpense, updateExpense, deleteExpense, approveExpense, recognizeExpense,
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
  }), [employees, purchaseOrders, salesOrders, projects, assets, expenses, payrolls, contracts, isLoading, backendAvailable, createEmployee, updateEmployee, deleteEmployee, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, createSalesOrder, updateSalesOrder, deleteSalesOrder, createProject, updateProject, deleteProject, createAsset, updateAsset, deleteAsset, disposeAsset, createExpense, updateExpense, deleteExpense, approveExpense, createPayroll, updatePayroll, deletePayroll, processPayroll, createContract, updateContract, deleteContract, permissions, getEmployeePermissions, setEmployeePermissions, updateModulePermission, hasPermission, setModuleFullAccess, deleteEmployeePermissions, loadData]);

  return (
    <ModulesContext.Provider value={value}>
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
