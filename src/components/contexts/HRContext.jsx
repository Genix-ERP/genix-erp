import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { hrService } from '@/api/services/hr';

const HRContext = createContext(null);

export function HRProvider({ children }) {
  const [employees, setEmployees] = useState([]);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [payrollEntries, setPayrollEntries] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data from backend on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [employeesData, payrollPeriodsData] = await Promise.all([
        hrService.listEmployees(),
        hrService.listPayrollPeriods(),
      ]);
      setEmployees(employeesData || []);
      setPayrollPeriods(payrollPeriodsData || []);
    } catch (err) {
      console.error('Error loading HR data:', err);
      setError(err.message);
      setEmployees([]);
      setPayrollPeriods([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Employee CRUD
  const createEmployee = useCallback(async (data) => {
    const newEmployee = await hrService.createEmployee(data);
    setEmployees(prev => [...prev, newEmployee]);
    return newEmployee;
  }, []);

  const updateEmployee = useCallback(async (id, updates) => {
    const updated = await hrService.updateEmployee(id, updates);
    setEmployees(prev => prev.map(e => e.id === id ? updated : e));
    return updated;
  }, []);

  const deleteEmployee = useCallback(async (id) => {
    await hrService.deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e.id !== id));
  }, []);

  const getEmployeeById = useCallback((id) => {
    return employees.find(e => e.id === id);
  }, [employees]);

  // Payroll Period CRUD
  const createPayrollPeriod = useCallback(async (data) => {
    const newPeriod = await hrService.createPayrollPeriod(data);
    setPayrollPeriods(prev => [...prev, newPeriod]);
    return newPeriod;
  }, []);

  const updatePayrollPeriod = useCallback(async (id, updates) => {
    const updated = await hrService.updatePayrollPeriod(id, updates);
    setPayrollPeriods(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, []);

  const deletePayrollPeriod = useCallback(async (id) => {
    await hrService.deletePayrollPeriod(id);
    setPayrollPeriods(prev => prev.filter(p => p.id !== id));
  }, []);

  const processPayroll = useCallback(async (id) => {
    const updated = await hrService.processPayroll(id);
    setPayrollPeriods(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, []);

  // Payroll Entry operations
  const loadPayrollEntries = useCallback(async (periodId) => {
    const entries = await hrService.listPayrollEntries(periodId);
    setPayrollEntries(entries || []);
    return entries;
  }, []);

  const createPayrollEntry = useCallback(async (periodId, data) => {
    const newEntry = await hrService.createPayrollEntry(periodId, data);
    setPayrollEntries(prev => [...prev, newEntry]);
    return newEntry;
  }, []);

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
    // Update payroll entry - need period ID
    setPayrollEntries(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePayroll = useCallback(async (id) => {
    setPayrollEntries(prev => prev.filter(p => p.id !== id));
  }, []);

  const approvePayroll = useCallback(async (id) => {
    setPayrollEntries(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
  }, []);

  // Leave Request CRUD (these will need backend implementation)
  const createLeaveRequest = useCallback(async (data) => {
    const employee = employees.find(e => e.id === data.employee_id);
    const newRequest = {
      ...data,
      id: `leave_${Date.now()}`,
      employee_name: employee?.full_name || data.employee_name,
      status: 'pending',
      created_at: new Date().toISOString().split('T')[0],
    };
    setLeaveRequests(prev => [...prev, newRequest]);
    return newRequest;
  }, [employees]);

  const updateLeaveRequest = useCallback(async (id, updates) => {
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const approveLeaveRequest = useCallback(async (id, approverName) => {
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', approved_by: approverName } : r));
  }, []);

  const rejectLeaveRequest = useCallback(async (id, reason) => {
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', rejection_reason: reason } : r));
  }, []);

  // Attendance (will need backend implementation)
  const recordAttendance = useCallback(async (data) => {
    const employee = employees.find(e => e.id === data.employee_id);
    const newRecord = {
      ...data,
      id: `att_${Date.now()}`,
      employee_name: employee?.full_name || data.employee_name,
      created_at: new Date().toISOString(),
    };
    setAttendance(prev => [...prev, newRecord]);
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
  }, []);

  const value = {
    // State
    employees,
    payrolls: payrollEntries, // backward compatibility
    payrollPeriods,
    payrollEntries,
    attendance,
    leaveRequests,
    isLoading,
    error,

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
  };

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
