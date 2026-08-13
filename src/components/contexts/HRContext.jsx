import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { hrService } from '@/api/services/hr';
import { useAdminSettings } from './AdminSettingsContext';
import { useEmployeePermissions } from './EmployeePermissionsContext';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

const HRContext = createContext(null);

// Storage keys for localStorage fallback
const STORAGE_KEYS = {
  EMPLOYEES: 'genix_hr_employees',
  PAYROLL_PERIODS: 'genix_hr_payroll_periods',
  PAYROLL_ENTRIES: 'genix_hr_payroll_entries',
  LEAVE_REQUESTS: 'genix_hr_leave_requests',
  ATTENDANCE: 'genix_hr_attendance',
};

// Sample demo data
const sampleEmployees = [
  {
    id: 'emp_1',
    full_name: 'Aziz Karimov',
    email: 'aziz@company.uz',
    phone: '+998901234567',
    department: 'Engineering',
    position: 'Senior Developer',
    hire_date: '2022-03-15',
    salary: 15000000,
    status: 'active',
    performance_score: 85,
    turnover_risk: 'low',
  },
  {
    id: 'emp_2',
    full_name: 'Malika Rashidova',
    email: 'malika@company.uz',
    phone: '+998901234568',
    department: 'Sales',
    position: 'Sales Manager',
    hire_date: '2021-06-01',
    salary: 12000000,
    status: 'active',
    performance_score: 92,
    turnover_risk: 'low',
  },
  {
    id: 'emp_3',
    full_name: 'Bobur Alimov',
    email: 'bobur@company.uz',
    phone: '+998901234569',
    department: 'Marketing',
    position: 'Marketing Specialist',
    hire_date: '2023-01-10',
    salary: 8000000,
    status: 'active',
    performance_score: 78,
    turnover_risk: 'medium',
  },
];

export function HRProvider({ children }) {
  const { getSetting } = useAdminSettings();
  const { canAccessModule, isAdmin } = useEmployeePermissions();
  const [employees, setEmployees] = useState([]);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [payrollEntries, setPayrollEntries] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Admin settings for HR module - these affect module behavior
  const hrSettings = useMemo(() => ({
    // Leave types
    leaveTypes: getSetting('hr.leave.types', [
      { id: 'annual', name: 'Annual Leave', days_per_year: 24, carry_forward: true, max_carry_forward: 10 },
      { id: 'sick', name: 'Sick Leave', days_per_year: 15, carry_forward: false, max_carry_forward: 0 },
      { id: 'unpaid', name: 'Unpaid Leave', days_per_year: 0, carry_forward: false, max_carry_forward: 0 },
      { id: 'maternity', name: 'Maternity Leave', days_per_year: 126, carry_forward: false, max_carry_forward: 0 }
    ]),
    leaveApprovalRequired: getSetting('hr.leave.approval_required', true),

    // Expense settings
    expenseCategories: getSetting('hr.expense.categories', [
      { id: 'travel', name: 'Travel', approval_required: true },
      { id: 'meals', name: 'Meals & Entertainment', approval_required: true },
      { id: 'supplies', name: 'Office Supplies', approval_required: false },
      { id: 'equipment', name: 'Equipment', approval_required: true },
      { id: 'other', name: 'Other', approval_required: true }
    ]),
    autoApprovalLimit: getSetting('hr.expense.auto_approval_limit', 100000),

    // Work settings
    hoursPerDay: getSetting('hr.work.hours_per_day', 8),
    daysPerWeek: getSetting('hr.work.days_per_week', 5),
    overtimeMultiplier: getSetting('hr.work.overtime_multiplier', 1.5),

    // Attendance
    attendanceTrackingEnabled: getSetting('hr.attendance.tracking_enabled', false),
    geolocationRequired: getSetting('hr.attendance.geolocation_required', false),

    // Payroll
    payPeriod: getSetting('hr.payroll.pay_period', 'monthly'),
    payrollCurrency: getSetting('hr.payroll.currency', 'UZS')
  }), [getSetting]);

  // Helper functions for localStorage
  const loadFromStorage = (key, defaultValue = []) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const saveToStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  };

  // Load data from backend or localStorage
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const demoMode = isDemoMode();
      const isBackendAvailable = await checkBackendHealth();
      setBackendAvailable(isBackendAvailable);

      if (!demoMode && isBackendAvailable) {
        // Try to load from backend, but skip the calls entirely for users
        // without HR/payroll access — otherwise they 403 and pollute the
        // console. Admins always load.
        const allowHr      = isAdmin || canAccessModule('hr');
        const allowPayroll = isAdmin || canAccessModule('hr') || canAccessModule('payroll');
        const skip = () => Promise.resolve([]);
        try {
          const [employeesData, payrollPeriodsData] = await Promise.all([
            allowHr      ? hrService.listEmployees()      : skip(),
            allowPayroll ? hrService.listPayrollPeriods() : skip(),
          ]);
          setEmployees(employeesData || []);
          setPayrollPeriods(payrollPeriodsData || []);

          // Also save to localStorage as backup
          saveToStorage(STORAGE_KEYS.EMPLOYEES, employeesData || []);
          saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, payrollPeriodsData || []);
        } catch (apiError) {
          console.error('Error loading from backend, falling back to localStorage:', apiError);
          // Fall back to localStorage
          const storedEmployees = loadFromStorage(STORAGE_KEYS.EMPLOYEES, sampleEmployees);
          const storedPayrollPeriods = loadFromStorage(STORAGE_KEYS.PAYROLL_PERIODS, []);
          setEmployees(storedEmployees);
          setPayrollPeriods(storedPayrollPeriods);
        }
      } else {
        // Demo mode or backend not available - use localStorage
        const storedEmployees = loadFromStorage(STORAGE_KEYS.EMPLOYEES);
        const storedPayrollPeriods = loadFromStorage(STORAGE_KEYS.PAYROLL_PERIODS);
        const storedLeaveRequests = loadFromStorage(STORAGE_KEYS.LEAVE_REQUESTS);
        const storedAttendance = loadFromStorage(STORAGE_KEYS.ATTENDANCE);

        // Use sample data if nothing stored
        if (storedEmployees.length === 0) {
          setEmployees(sampleEmployees);
          saveToStorage(STORAGE_KEYS.EMPLOYEES, sampleEmployees);
        } else {
          setEmployees(storedEmployees);
        }

        setPayrollPeriods(storedPayrollPeriods);
        setLeaveRequests(storedLeaveRequests);
        setAttendance(storedAttendance);
      }
    } catch (err) {
      console.error('Error loading HR data:', err);
      setError(err.message);
      // Fall back to sample data
      setEmployees(sampleEmployees);
      setPayrollPeriods([]);
    } finally {
      setIsLoading(false);
    }
  }, [canAccessModule, isAdmin]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Employee CRUD
  const createEmployee = useCallback(async (data) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        const newEmployee = await hrService.createEmployee(data);
        setEmployees(prev => {
          const updated = [...prev, newEmployee];
          saveToStorage(STORAGE_KEYS.EMPLOYEES, updated);
          return updated;
        });
        return newEmployee;
      } catch (err) {
        console.error('Backend error, saving locally:', err);
      
        toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
      }
    }

    // Fallback to local storage
    const newEmployee = {
      ...data,
      id: `emp_${Date.now()}`,
      status: data.status || 'active',
      performance_score: data.performance_score || 0,
      turnover_risk: data.turnover_risk || 'low',
      created_at: new Date().toISOString(),
    };
    setEmployees(prev => {
      const updated = [...prev, newEmployee];
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updated);
      return updated;
    });
    return newEmployee;
  }, [backendAvailable]);

  const updateEmployee = useCallback(async (id, updates) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        const updated = await hrService.updateEmployee(id, updates);
        setEmployees(prev => {
          const newList = prev.map(e => e.id === id ? updated : e);
          saveToStorage(STORAGE_KEYS.EMPLOYEES, newList);
          return newList;
        });
        return updated;
      } catch (err) {
        console.error('Backend error, updating locally:', err);
      
        toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
      }
    }

    // Fallback to local storage
    let updatedEmployee;
    setEmployees(prev => {
      const newList = prev.map(e => {
        if (e.id === id) {
          updatedEmployee = { ...e, ...updates };
          return updatedEmployee;
        }
        return e;
      });
      saveToStorage(STORAGE_KEYS.EMPLOYEES, newList);
      return newList;
    });
    return updatedEmployee;
  }, [backendAvailable]);

  const deleteEmployee = useCallback(async (id) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        await hrService.deleteEmployee(id);
      } catch (err) {
        console.error('Backend error, deleting locally:', err);
      
        toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
      }
    }

    setEmployees(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveToStorage(STORAGE_KEYS.EMPLOYEES, updated);
      return updated;
    });
  }, [backendAvailable]);

  const getEmployeeById = useCallback((id) => {
    return employees.find(e => e.id === id);
  }, [employees]);

  // Payroll Period CRUD
  const createPayrollPeriod = useCallback(async (data) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        const newPeriod = await hrService.createPayrollPeriod(data);
        setPayrollPeriods(prev => {
          const updated = [...prev, newPeriod];
          saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, updated);
          return updated;
        });
        return newPeriod;
      } catch (err) {
        console.error('Backend error, saving locally:', err);
      
        toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
      }
    }

    // Fallback to local storage
    const newPeriod = {
      ...data,
      id: `period_${Date.now()}`,
      status: data.status || 'draft',
      created_at: new Date().toISOString(),
    };
    setPayrollPeriods(prev => {
      const updated = [...prev, newPeriod];
      saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, updated);
      return updated;
    });
    return newPeriod;
  }, [backendAvailable]);

  const updatePayrollPeriod = useCallback(async (id, updates) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        const updated = await hrService.updatePayrollPeriod(id, updates);
        setPayrollPeriods(prev => {
          const newList = prev.map(p => p.id === id ? updated : p);
          saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, newList);
          return newList;
        });
        return updated;
      } catch (err) {
        console.error('Backend error, updating locally:', err);
      
        toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
      }
    }

    // Fallback
    let updatedPeriod;
    setPayrollPeriods(prev => {
      const newList = prev.map(p => {
        if (p.id === id) {
          updatedPeriod = { ...p, ...updates };
          return updatedPeriod;
        }
        return p;
      });
      saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, newList);
      return newList;
    });
    return updatedPeriod;
  }, [backendAvailable]);

  const deletePayrollPeriod = useCallback(async (id) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        await hrService.deletePayrollPeriod(id);
      } catch (err) {
        console.error('Backend error, deleting locally:', err);
      
        toast.error(getApiErrorMessage(err, 'Amalni bajarib bo\'lmadi'));
      }
    }

    setPayrollPeriods(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, updated);
      return updated;
    });
  }, [backendAvailable]);

  const processPayroll = useCallback(async (id) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        const updated = await hrService.processPayroll(id);
        setPayrollPeriods(prev => {
          const newList = prev.map(p => p.id === id ? updated : p);
          saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, newList);
          return newList;
        });
        return updated;
      } catch (err) {
        console.error('Backend error, processing locally:', err);
      }
    }

    // Fallback - just mark as processed
    let processedPeriod;
    setPayrollPeriods(prev => {
      const newList = prev.map(p => {
        if (p.id === id) {
          processedPeriod = { ...p, status: 'processed', processed_at: new Date().toISOString() };
          return processedPeriod;
        }
        return p;
      });
      saveToStorage(STORAGE_KEYS.PAYROLL_PERIODS, newList);
      return newList;
    });
    return processedPeriod;
  }, [backendAvailable]);

  // Payroll Entry operations
  const loadPayrollEntries = useCallback(async (periodId) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        const entries = await hrService.listPayrollEntries(periodId);
        setPayrollEntries(entries || []);
        return entries;
      } catch (err) {
        console.error('Backend error loading payroll entries:', err);
      }
    }

    // Load from local storage
    const storedEntries = loadFromStorage(STORAGE_KEYS.PAYROLL_ENTRIES, []);
    const periodEntries = storedEntries.filter(e => e.period_id === periodId);
    setPayrollEntries(periodEntries);
    return periodEntries;
  }, [backendAvailable]);

  const createPayrollEntry = useCallback(async (periodId, data) => {
    if (backendAvailable && !isDemoMode()) {
      try {
        const newEntry = await hrService.createPayrollEntry(periodId, data);
        setPayrollEntries(prev => [...prev, newEntry]);
        return newEntry;
      } catch (err) {
        console.error('Backend error, saving locally:', err);
      }
    }

    // Fallback
    const newEntry = {
      ...data,
      id: `entry_${Date.now()}`,
      period_id: periodId,
      created_at: new Date().toISOString(),
    };
    setPayrollEntries(prev => {
      const updated = [...prev, newEntry];
      // Save all entries to storage
      const allEntries = loadFromStorage(STORAGE_KEYS.PAYROLL_ENTRIES, []);
      saveToStorage(STORAGE_KEYS.PAYROLL_ENTRIES, [...allEntries, newEntry]);
      return updated;
    });
    return newEntry;
  }, [backendAvailable]);

  // Legacy payroll functions for backward compatibility
  const createPayroll = useCallback(async (data) => {
    // Create a payroll entry under the current/latest period
    const currentPeriod = payrollPeriods.find(p => p.status === 'draft') || payrollPeriods[0];
    if (!currentPeriod) {
      throw new Error('No payroll period available');
    }
    return createPayrollEntry(currentPeriod.id, data);
  }, [payrollPeriods, createPayrollEntry]);

  const updatePayroll = useCallback(async (id, updates) => {
    setPayrollEntries(prev => {
      const newList = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      const allEntries = loadFromStorage(STORAGE_KEYS.PAYROLL_ENTRIES, []);
      const updatedAll = allEntries.map(p => p.id === id ? { ...p, ...updates } : p);
      saveToStorage(STORAGE_KEYS.PAYROLL_ENTRIES, updatedAll);
      return newList;
    });
  }, []);

  const deletePayroll = useCallback(async (id) => {
    setPayrollEntries(prev => {
      const updated = prev.filter(p => p.id !== id);
      const allEntries = loadFromStorage(STORAGE_KEYS.PAYROLL_ENTRIES, []);
      saveToStorage(STORAGE_KEYS.PAYROLL_ENTRIES, allEntries.filter(p => p.id !== id));
      return updated;
    });
  }, []);

  const approvePayroll = useCallback(async (id) => {
    setPayrollEntries(prev => {
      const newList = prev.map(p => p.id === id ? { ...p, status: 'approved' } : p);
      const allEntries = loadFromStorage(STORAGE_KEYS.PAYROLL_ENTRIES, []);
      saveToStorage(STORAGE_KEYS.PAYROLL_ENTRIES, allEntries.map(p => p.id === id ? { ...p, status: 'approved' } : p));
      return newList;
    });
  }, []);

  // Leave Request CRUD
  const createLeaveRequest = useCallback(async (data) => {
    const employee = employees.find(e => e.id === data.employee_id);
    const newRequest = {
      ...data,
      id: `leave_${Date.now()}`,
      employee_name: employee?.full_name || data.employee_name,
      status: 'pending',
      created_at: new Date().toISOString().split('T')[0],
    };
    setLeaveRequests(prev => {
      const updated = [...prev, newRequest];
      saveToStorage(STORAGE_KEYS.LEAVE_REQUESTS, updated);
      return updated;
    });
    return newRequest;
  }, [employees]);

  const updateLeaveRequest = useCallback(async (id, updates) => {
    setLeaveRequests(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      saveToStorage(STORAGE_KEYS.LEAVE_REQUESTS, updated);
      return updated;
    });
  }, []);

  const approveLeaveRequest = useCallback(async (id, approverName) => {
    setLeaveRequests(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: 'approved', approved_by: approverName } : r);
      saveToStorage(STORAGE_KEYS.LEAVE_REQUESTS, updated);
      return updated;
    });
  }, []);

  const rejectLeaveRequest = useCallback(async (id, reason) => {
    setLeaveRequests(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: 'rejected', rejection_reason: reason } : r);
      saveToStorage(STORAGE_KEYS.LEAVE_REQUESTS, updated);
      return updated;
    });
  }, []);

  // Attendance
  const recordAttendance = useCallback(async (data) => {
    const employee = employees.find(e => e.id === data.employee_id);
    const newRecord = {
      ...data,
      id: `att_${Date.now()}`,
      employee_name: employee?.full_name || data.employee_name,
      created_at: new Date().toISOString(),
    };
    setAttendance(prev => {
      const updated = [...prev, newRecord];
      saveToStorage(STORAGE_KEYS.ATTENDANCE, updated);
      return updated;
    });
    return newRecord;
  }, [employees]);

  // Analytics
  const getHRAnalytics = useCallback(() => {
    const activeEmployees = employees.filter(e => e.status === 'active');
    const totalSalary = activeEmployees.reduce((sum, e) => sum + (e.salary || 0), 0);
    const avgSalary = activeEmployees.length > 0 ? totalSalary / activeEmployees.length : 0;

    const departmentCounts = activeEmployees.reduce((acc, e) => {
      acc[e.department] = (acc[e.department] || 0) + 1;
      return acc;
    }, {});

    const pendingPayrolls = payrollPeriods.filter(p => p.status === 'draft' || p.status === 'calculated').length;
    const totalPayrollAmount = payrollEntries.reduce((sum, p) => sum + (p.net_salary || 0), 0);

    const pendingLeaves = leaveRequests.filter(r => r.status === 'pending').length;

    const highTurnoverRisk = activeEmployees.filter(e => e.turnover_risk === 'high').length;
    const avgPerformance = activeEmployees.length > 0
      ? activeEmployees.reduce((sum, e) => sum + (e.performance_score || 0), 0) / activeEmployees.length
      : 0;

    return {
      totalEmployees: activeEmployees.length,
      totalSalary,
      avgSalary,
      departmentCounts,
      pendingPayrolls,
      totalPayrollAmount,
      pendingLeaves,
      highTurnoverRisk,
      avgPerformance,
    };
  }, [employees, payrollPeriods, payrollEntries, leaveRequests]);

  // Refresh data from backend
  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const value = useMemo(() => ({
    // State
    employees,
    payrolls: payrollEntries, // backward compatibility
    payrollPeriods,
    payrollEntries,
    attendance,
    leaveRequests,
    isLoading,
    error,
    backendAvailable,

    // Employee operations
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeById,

    // Payroll Period operations
    createPayrollPeriod,
    updatePayrollPeriod,
    deletePayrollPeriod,
    processPayroll,
    loadPayrollEntries,
    createPayrollEntry,

    // Legacy payroll operations (backward compatibility)
    createPayroll,
    updatePayroll,
    deletePayroll,
    approvePayroll,

    // Leave operations
    createLeaveRequest,
    updateLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,

    // Attendance operations
    recordAttendance,

    // Analytics
    getHRAnalytics,

    // Refresh
    refreshData,

    // Admin Settings (from Admin Settings page)
    settings: hrSettings,
    // Helper functions for settings
    getLeaveTypes: () => hrSettings.leaveTypes,
    getLeaveTypeById: (id) => hrSettings.leaveTypes.find(t => t.id === id),
    isLeaveApprovalRequired: () => hrSettings.leaveApprovalRequired,
    getExpenseCategories: () => hrSettings.expenseCategories,
    getAutoApprovalLimit: () => hrSettings.autoApprovalLimit,
    needsExpenseApproval: (amount, categoryId) => {
      if (amount > hrSettings.autoApprovalLimit) return true;
      const category = hrSettings.expenseCategories.find(c => c.id === categoryId);
      return category?.approval_required ?? true;
    },
    getHoursPerDay: () => hrSettings.hoursPerDay,
    getDaysPerWeek: () => hrSettings.daysPerWeek,
    getOvertimeMultiplier: () => hrSettings.overtimeMultiplier,
    isAttendanceTrackingEnabled: () => hrSettings.attendanceTrackingEnabled,
    isGeolocationRequired: () => hrSettings.geolocationRequired,
    getPayPeriod: () => hrSettings.payPeriod,
    getPayrollCurrency: () => hrSettings.payrollCurrency
  }), [employees, payrollEntries, payrollPeriods, attendance, leaveRequests, isLoading, error, backendAvailable, createEmployee, updateEmployee, deleteEmployee, getEmployeeById, createPayrollPeriod, updatePayrollPeriod, deletePayrollPeriod, processPayroll, loadPayrollEntries, createPayrollEntry, createPayroll, updatePayroll, deletePayroll, approvePayroll, createLeaveRequest, updateLeaveRequest, approveLeaveRequest, rejectLeaveRequest, recordAttendance, getHRAnalytics, refreshData, hrSettings]);

  return (
    <HRContext.Provider value={value}>
      {children}
    </HRContext.Provider>
  );
}

export function useHR() {
  const context = useContext(HRContext);
  if (!context) {
    throw new Error('useHR must be used within an HRProvider');
  }
  return context;
}

export default HRContext;
