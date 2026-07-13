import React, { useState, useEffect } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, DollarSign, Users, Calculator, TrendingUp, Brain, Download, AlertTriangle, CheckCircle, Target, Lightbulb, Edit, Trash2, CreditCard, UserCircle, Printer, Settings as SettingsIcon, History, FileDown, Loader2, X, RotateCcw, Percent, ChevronRight, ChevronDown, Wallet, FileMinus } from 'lucide-react';
import { hrService } from '@/api/services/hr';
import { employeeTaxesService } from '@/api/services/employeeTaxes';
import { toast } from 'sonner';
import EmployeeLoans from '@/components/payroll/EmployeeLoans';
import EmployeePortal from '@/components/payroll/EmployeePortal';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '@/api/client';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useCompany } from '@/components/contexts/CompanyContext';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import * as XLSX from 'xlsx';

export default function Payroll() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { payrolls, employees, createPayroll, updatePayroll, isLoading, refreshData } = useModules();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  // Refresh data when navigating to this page
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { getSetting } = useAdminSettings();
  const { activeCompany } = useCompany();

  const [filteredPayrolls, setFilteredPayrolls] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPayroll, setEditPayroll] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState(null);
  const [showPayMethodDialog, setShowPayMethodDialog] = useState(false);
  const [payingPayrollId, setPayingPayrollId] = useState(null);
  const [selectedPayMethod, setSelectedPayMethod] = useState('cash');
  const [pendingDeductions, setPendingDeductions] = useState([]);
  const [totalPendingDeduction, setTotalPendingDeduction] = useState(0);
  const [deductionPercent, setDeductionPercent] = useState(0);
  const [activeLoans, setActiveLoans] = useState([]);
  const [loanDeductions, setLoanDeductions] = useState({}); // { [loanId]: amount }

  // Per-row expand state for the Payroll Records table. When a user
  // clicks the chevron on a payroll row, we fetch that employee's
  // outstanding debts (active loans + pending shortage deductions —
  // the same two sources the Process Payroll modal pulls from) and
  // render them inline beneath the row. Cached per-payroll-id so
  // re-opening doesn't re-fetch.
  const [expandedPayrollId, setExpandedPayrollId] = useState(null);
  const [debtsByPayroll, setDebtsByPayroll] = useState({});
  const [debtsLoadingId, setDebtsLoadingId] = useState(null);
  const togglePayrollExpand = async (payroll) => {
    if (expandedPayrollId === payroll.id) {
      setExpandedPayrollId(null);
      return;
    }
    setExpandedPayrollId(payroll.id);
    if (debtsByPayroll[payroll.id] !== undefined) return;
    const empId = payroll.employee_id;
    if (!empId) {
      setDebtsByPayroll((m) => ({ ...m, [payroll.id]: { loans: [], deductions: [] } }));
      return;
    }
    setDebtsLoadingId(payroll.id);
    try {
      const [loansRes, dedsRes] = await Promise.allSettled([
        apiClient.get('/employee-loans', { params: { employee_id: empId, status: 'active', limit: 100 } }),
        apiClient.get(`/employees/${empId}/deductions`, { params: { status: 'pending' } }),
      ]);
      const rawLoans = loansRes.status === 'fulfilled'
        ? (loansRes.value?.data?.data ?? loansRes.value?.data ?? [])
        : [];
      const loans = Array.isArray(rawLoans) ? rawLoans : (rawLoans.items || []);
      const deds  = dedsRes.status === 'fulfilled'
        ? (dedsRes.value?.data?.data ?? dedsRes.value?.data ?? [])
        : [];
      setDebtsByPayroll((m) => ({
        ...m,
        [payroll.id]: { loans, deductions: Array.isArray(deds) ? deds : [] },
      }));
    } catch {
      setDebtsByPayroll((m) => ({ ...m, [payroll.id]: { loans: [], deductions: [] } }));
    } finally {
      setDebtsLoadingId(null);
    }
  };

  // Employee-tax catalog (migration 330). Loaded when the payroll-create modal
  // opens. `excludedTaxIds` is the set the user has X-ed out for this entry.
  const [taxCatalog, setTaxCatalog] = useState([]);
  const [excludedTaxIds, setExcludedTaxIds] = useState([]);
  const [taxPreview, setTaxPreview] = useState({
    applied: [],
    total_employee: 0,
    total_employer: 0,
    gross: 0,
    net: 0,
  });

  const [newPayroll, setNewPayroll] = useState({
    payroll_number: '',
    employee_id: '',
    employee_name: '',
    pay_period_start: '',
    pay_period_end: '',
    payment_date: '',
    basic_salary: 0,
    overtime_hours: 0,
    monthly_hours: 208,
    bonuses: 0,
    allowances: 0
  });

  // Load the employee-tax catalog once — used by the create-payroll modal and
  // the edit modal's tax picker. Only active taxes are shown (settings page
  // controls which ones are enabled). Placed after the state declarations it
  // depends on to avoid a temporal dead zone error.
  useEffect(() => {
    let alive = true;
    employeeTaxesService
      .list({ onlyActive: true })
      .then((rows) => { if (alive) setTaxCatalog(rows || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Recompute the tax preview whenever the salary inputs or exclusion set changes.
  useEffect(() => {
    if (!showCreateModal) return;
    if (!taxCatalog.length) {
      setTaxPreview({ applied: [], total_employee: 0, total_employer: 0, gross: 0, net: 0 });
      return;
    }
    const base = Number(newPayroll.basic_salary) || 0;
    const overtimeAmount = (Number(newPayroll.overtime_hours) || 0) * (base / (Number(newPayroll.monthly_hours) || 208) * 1.5);
    const bonus = Number(newPayroll.bonuses) || 0;
    const allowances = Number(newPayroll.allowances) || 0;
    let cancelled = false;
    employeeTaxesService
      .preview({
        baseSalary: base,
        overtimeAmount,
        bonus,
        allowances,
        excludedTaxIds,
      })
      .then((res) => { if (!cancelled && res) setTaxPreview(res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showCreateModal, taxCatalog, excludedTaxIds,
      newPayroll.basic_salary, newPayroll.overtime_hours,
      newPayroll.monthly_hours, newPayroll.bonuses, newPayroll.allowances]);

  useEffect(() => {
    let filtered = payrolls;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Apply employee filter OR search (search takes precedence)
    if (searchQuery) {
      // If user is searching, ignore employee filter
      filtered = filtered.filter(p =>
        p.payroll_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else if (employeeFilter !== 'all') {
      // Only apply employee filter if not searching
      filtered = filtered.filter(p => p.employee_name === employeeFilter);
    }

    setFilteredPayrolls(filtered);
  }, [payrolls, searchQuery, statusFilter, employeeFilter]);

  // Fetch pending deductions when employee is selected
  const fetchPendingDeductions = async (employeeId) => {
    if (!employeeId) {
      setPendingDeductions([]);
      setTotalPendingDeduction(0);
      setDeductionPercent(0);
      return;
    }
    try {
      const res = await apiClient.get(`/employees/${employeeId}/deductions`, { params: { status: 'pending' } });
      const deductions = res.data?.data || res.data || [];
      setPendingDeductions(deductions);
      const total = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
      setTotalPendingDeduction(total);
      setDeductionPercent(total > 0 ? 30 : 0);
    } catch {
      setPendingDeductions([]);
      setTotalPendingDeduction(0);
      setDeductionPercent(0);
    }
  };

  // Fetch active employee loans
  const fetchActiveLoans = async (employeeId) => {
    if (!employeeId) {
      setActiveLoans([]);
      setLoanDeductions({});
      return;
    }
    try {
      const res = await apiClient.get('/employee-loans', { params: { employee_id: employeeId, status: 'active', limit: 100 } });
      const raw = res.data?.data ?? res.data ?? [];
      const loans = Array.isArray(raw) ? raw : (raw.items || []);
      setActiveLoans(loans);
      // Pre-fill deduction with suggested monthly_payment (capped by remaining_amount)
      const prefill = {};
      loans.forEach(l => {
        const suggest = Math.min(Number(l.monthly_payment || 0), Number(l.remaining_amount || 0));
        prefill[l.id] = suggest > 0 ? suggest : 0;
      });
      setLoanDeductions(prefill);
    } catch {
      setActiveLoans([]);
      setLoanDeductions({});
    }
  };

  const shortageDeductionAmount = Math.round(totalPendingDeduction * deductionPercent / 100);
  const totalLoanDeduction = Object.values(loanDeductions).reduce((s, v) => s + (Number(v) || 0), 0);

  // Payroll tax rates from settings (defaults: Uzbekistan 2024-2026 rates)
  const incomeTaxRate = parseFloat(getSetting('payroll.tax.income_tax_rate', '12')) / 100;
  const socialInsuranceRate = parseFloat(getSetting('payroll.tax.social_insurance_rate', '1')) / 100;
  const taxFreeMinimum = parseFloat(getSetting('payroll.tax.tax_free_minimum', '0'));

  const calculatePayroll = (data, shortageAmount = 0, loanAmount = 0) => {
    const basicSalary = parseFloat(data.basic_salary) || 0;
    const overtimeHours = parseFloat(data.overtime_hours) || 0;
    const monthlyHours = parseFloat(data.monthly_hours) || 208;
    const overtimePay = overtimeHours * (basicSalary / monthlyHours);
    const bonuses = parseFloat(data.bonuses) || 0;
    const allowances = parseFloat(data.allowances) || 0;

    const grossPay = basicSalary + overtimePay + bonuses + allowances;

    // Income tax (НДФЛ / JSHSHO): default 12% in Uzbekistan
    const taxableAmount = Math.max(0, grossPay - taxFreeMinimum);
    const taxDeduction = Math.round(taxableAmount * incomeTaxRate);

    // Social insurance (INPS): default 1% employee side
    const socialSecurity = Math.round(grossPay * socialInsuranceRate);

    const otherDeductions = shortageAmount + loanAmount;
    const totalDeductions = taxDeduction + socialSecurity + otherDeductions;
    const netPay = grossPay - totalDeductions;

    return {
      overtime_pay: overtimePay,
      gross_pay: grossPay,
      tax_deduction: taxDeduction,
      social_security: socialSecurity,
      health_insurance: 0,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_pay: netPay
    };
  };

  const handleCreatePayroll = async () => {
    const calculated = calculatePayroll(newPayroll, shortageDeductionAmount, totalLoanDeduction);

    const payrollData = {
      ...newPayroll,
      payroll_number: '',
      basic_salary: parseFloat(newPayroll.basic_salary),
      overtime_hours: parseFloat(newPayroll.overtime_hours),
      bonuses: parseFloat(newPayroll.bonuses),
      allowances: parseFloat(newPayroll.allowances),
      ...calculated,
      deduction_percent: deductionPercent,
      excluded_tax_ids: excludedTaxIds, // migration 330: opt-out list per entry
      status: 'calculated',
      payment_method: 'bank_transfer'
    };

    await createPayroll(payrollData);

    // Record loan payments for each loan with a deduction amount > 0
    for (const loan of activeLoans) {
      const amount = Number(loanDeductions[loan.id] || 0);
      if (amount <= 0) continue;
      try {
        // Find the next pending payment on this loan and mark it paid with this amount.
        // If the backend requires an explicit payment id, we POST a new payment of this amount.
        await apiClient.post(`/employee-loans/${loan.id}/payments`, {
          amount,
          payment_date: newPayroll.payment_date || new Date().toISOString().slice(0, 10),
          method: 'salary_deduction',
          note: `Deducted from payroll`,
        }).catch(async () => {
          // Fallback: if there's no generic payments endpoint, try mark-paid on first pending payment
          try {
            const schedRes = await apiClient.get(`/employee-loans/${loan.id}`);
            const payments = schedRes.data?.data?.payments || schedRes.data?.payments || [];
            const pending = payments.find(p => p.status !== 'paid');
            if (pending) {
              await apiClient.post(`/employee-loans/${loan.id}/payments/${pending.id}/mark-paid`, { amount });
            }
          } catch { /* ignore */ }
        });
      } catch (err) {
        console.warn('Failed to record loan payment', err);
      }
    }

    setShowCreateModal(false);

    setNewPayroll({
      payroll_number: '',
      employee_id: '',
      employee_name: '',
      pay_period_start: '',
      pay_period_end: '',
      payment_date: '',
      basic_salary: 0,
      overtime_hours: 0,
      monthly_hours: 208,
      bonuses: 0,
      allowances: 0
    });
    setPendingDeductions([]);
    setTotalPendingDeduction(0);
    setDeductionPercent(0);
    setActiveLoans([]);
    setLoanDeductions({});
  };

  const updatePayrollStatus = (payrollId, newStatus, paymentMethod) => {
    const data = { status: newStatus };
    if (paymentMethod) data.payment_method = paymentMethod;
    updatePayroll(payrollId, data);
  };

  const handlePayClick = (payrollId) => {
    setPayingPayrollId(payrollId);
    setSelectedPayMethod('cash');
    setShowPayMethodDialog(true);
  };

  const handleConfirmPay = () => {
    updatePayrollStatus(payingPayrollId, 'paid', selectedPayMethod);
    setShowPayMethodDialog(false);
    setPayingPayrollId(null);
  };

  // TT §2.3: auto-create payroll for current month. Creates one period with an
  // entry per active employee, using the tenant's advance_percent setting.
  const [autoCreating, setAutoCreating] = useState(false);
  const handleAutoCreateCurrentMonth = async () => {
    setAutoCreating(true);
    try {
      const r = await hrService.getOrCreateCurrentMonthPayroll();
      if (r?.newly_created) {
        toast.success(t('payroll_auto_created') || "Joriy oy qaydnomasi yaratildi");
      } else {
        toast.info(t('payroll_already_exists') || "Joriy oy qaydnomasi allaqachon mavjud");
      }
      // Refresh list — the existing load function name varies; try a couple.
      if (typeof loadPayrolls === 'function') { await loadPayrolls(); }
      else if (typeof loadData === 'function') { await loadData(); }
      else { window.location.reload(); }
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message
        || t('error_occurred') || 'Xatolik');
    } finally {
      setAutoCreating(false);
    }
  };

  // TT §2.4: toggle advance/remainder paid flag with day-of-month.
  // When marking as paid, open an in-app Dialog so the user can pick the day
  // (leave blank = today, clamped server-side). Unchecking clears flag + day
  // immediately without prompting.
  const [paidDialog, setPaidDialog] = useState({
    open: false,
    kind: null,       // 'advance' | 'remainder'
    entry: null,
    dayInput: '',
    saving: false,
  });

  const toggleTTPaid = async (entry, kind) => {
    const isPaid = kind === 'advance' ? !!entry.advance_paid : !!entry.remainder_paid;
    if (isPaid) {
      // Uncheck — no prompt, just clear.
      try {
        const fn = kind === 'advance' ? hrService.markAdvancePaid : hrService.markRemainderPaid;
        const result = await fn(entry.id, { paid: false, day: null });
        setFilteredPayrolls((prev) => prev.map((p) => (p.id === entry.id ? { ...p, ...result } : p)));
        toast.success(t('saved') || 'Saqlandi');
      } catch (e) {
        toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
      }
      return;
    }
    // Marking as paid — open the day-picker dialog.
    const suggested = String(new Date().getDate()); // today
    setPaidDialog({ open: true, kind, entry, dayInput: suggested, saving: false });
  };

  const submitPaidDialog = async () => {
    const { kind, entry, dayInput } = paidDialog;
    if (!entry || !kind) return;
    let day = null;
    const trimmed = (dayInput || '').trim();
    if (trimmed !== '') {
      const n = parseInt(trimmed, 10);
      if (Number.isNaN(n) || n < 1 || n > 31) {
        toast.error(t('invalid_day_1_31') || '1 dan 31 gacha son kiriting');
        return;
      }
      day = n;
    }
    setPaidDialog((d) => ({ ...d, saving: true }));
    try {
      const fn = kind === 'advance' ? hrService.markAdvancePaid : hrService.markRemainderPaid;
      const result = await fn(entry.id, { paid: true, day });
      setFilteredPayrolls((prev) => prev.map((p) => (p.id === entry.id ? { ...p, ...result } : p)));
      toast.success(t('saved') || 'Saqlandi');
      setPaidDialog({ open: false, kind: null, entry: null, dayInput: '', saving: false });
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
      setPaidDialog((d) => ({ ...d, saving: false }));
    }
  };

  const handleEditPayroll = async (payroll) => {
    // `payroll` here is a PayrollPeriod. The real numeric fields live on the
    // PayrollEntry rows under it. Fetch them before opening the modal so the
    // form shows the actual values instead of zeros.
    let firstEntry = null;
    try {
      const entries = await hrService.listPayrollEntries(payroll.id);
      if (Array.isArray(entries) && entries.length > 0) {
        firstEntry = entries[0];
      }
    } catch (e) {
      // Non-fatal — we'll fall back to zeros below. Show a soft warning only.
      console.warn('Failed to load payroll entries for editing', e);
    }

    setEditPayroll({
      ...payroll,
      entry_id: firstEntry?.id || null,
      employee_name: firstEntry?.employee_name || payroll.employee_name || '',
      basic_salary: firstEntry?.base_salary ?? payroll.basic_salary ?? 0,
      overtime_hours: firstEntry?.overtime_hours ?? payroll.overtime_hours ?? 0,
      overtime_amount: firstEntry?.overtime_amount ?? 0,
      monthly_hours: payroll.monthly_hours || 208,
      bonuses: firstEntry?.bonus ?? payroll.bonuses ?? 0,
      allowances: firstEntry?.allowances ?? payroll.allowances ?? 0,
      income_tax: firstEntry?.income_tax ?? 0,
      social_security: firstEntry?.social_security ?? 0,
      pension: firstEntry?.pension ?? 0,
      other_deductions: firstEntry?.other_deductions ?? 0,
    });
    setShowEditModal(true);
  };

  const handleUpdatePayroll = async () => {
    if (!editPayroll) return;

    const calculated = calculatePayroll(editPayroll);

    try {
      // 1) Save period-level fields (dates, status, notes) through the context
      await updatePayroll(editPayroll.id, {
        employee_name: editPayroll.employee_name,
        pay_period_start: editPayroll.pay_period_start,
        pay_period_end: editPayroll.pay_period_end,
        payment_date: editPayroll.payment_date,
        basic_salary: parseFloat(editPayroll.basic_salary),
        overtime_hours: parseFloat(editPayroll.overtime_hours),
        bonuses: parseFloat(editPayroll.bonuses),
        allowances: parseFloat(editPayroll.allowances),
        ...calculated,
        status: editPayroll.status,
      });

      // 2) Save entry-level numeric fields (base_salary, bonus, etc.)
      if (editPayroll.entry_id) {
        await hrService.updatePayrollEntry(editPayroll.id, editPayroll.entry_id, {
          base_salary: parseFloat(editPayroll.basic_salary) || 0,
          overtime_hours: parseFloat(editPayroll.overtime_hours) || 0,
          overtime_amount: parseFloat(editPayroll.overtime_amount) || 0,
          bonus: parseFloat(editPayroll.bonuses) || 0,
          allowances: parseFloat(editPayroll.allowances) || 0,
          income_tax: parseFloat(editPayroll.income_tax) || 0,
          social_security: parseFloat(editPayroll.social_security) || 0,
          pension: parseFloat(editPayroll.pension) || 0,
          other_deductions: parseFloat(editPayroll.other_deductions) || 0,
          status: editPayroll.status,
        });
      }

      // 3) Refresh list so the updated totals (recomputed server-side) are shown
      if (typeof refreshData === 'function') {
        refreshData();
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
      return;
    }

    setShowEditModal(false);
    setEditPayroll(null);
  };

  const handleDeleteClick = (payroll) => {
    setPayrollToDelete(payroll);
    setShowDeleteDialog(true);
  };

  const handleDeletePayroll = () => {
    if (payrollToDelete) {
      // Update status to 'cancelled' instead of actually deleting
      updatePayroll(payrollToDelete.id, { status: 'cancelled' });
      setShowDeleteDialog(false);
      setPayrollToDelete(null);
    }
  };

  const handleDownloadPayslip = (payroll) => {
    // Format dates properly
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      try {
        return format(new Date(dateStr), 'MMM dd, yyyy');
      } catch {
        return dateStr;
      }
    };

    // Generate CSV payslip content
    const csvContent = [
      ['PAYROLL SLIP'],
      [''],
      ['Payroll Number', payroll.payroll_number],
      ['Employee', payroll.employee_name],
      ['Pay Period Start', formatDate(payroll.pay_period_start)],
      ['Pay Period End', formatDate(payroll.pay_period_end)],
      ['Payment Date', formatDate(payroll.payment_date)],
      [''],
      ['EARNINGS'],
      ['Basic Salary', (payroll.basic_salary || 0).toFixed(2)],
      ['Overtime Pay', (payroll.overtime_pay || 0).toFixed(2)],
      ['Bonuses', (payroll.bonuses || 0).toFixed(2)],
      ['Allowances', (payroll.allowances || 0).toFixed(2)],
      ['GROSS PAY', (payroll.gross_pay || 0).toFixed(2)],
      [''],
      ['DEDUCTIONS'],
      ['Tax', (payroll.tax_deduction || 0).toFixed(2)],
      ['Social Security', (payroll.social_security || 0).toFixed(2)],
      ['Health Insurance', (payroll.health_insurance || 0).toFixed(2)],
      ['Other Deductions', (payroll.other_deductions || 0).toFixed(2)],
      ['TOTAL DEDUCTIONS', (payroll.total_deductions || 0).toFixed(2)],
      [''],
      ['NET PAY', (payroll.net_pay || 0).toFixed(2)],
      [''],
      ['Status', payroll.status?.toUpperCase() || 'N/A'],
      ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')]
    ].map(row => row.join(',')).join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payslip_${payroll.payroll_number}_${payroll.employee_name?.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Qaydnoma (salary payment record) for current filtered payrolls
  const handlePrintQaydnoma = () => {
    const payrollsToShow = filteredPayrolls.filter(p => p.status !== 'cancelled');
    if (payrollsToShow.length === 0) return;

    // Determine period from the payroll entries
    const endDates = payrollsToShow.map(p => p.pay_period_end).filter(Boolean).sort();
    const lastEnd = endDates[endDates.length - 1] ? new Date(endDates[endDates.length - 1]) : new Date();
    const monthNum = lastEnd.getMonth() + 1;
    const yearNum = lastEnd.getFullYear();

    // Month names for each language
    const monthNames = {
      uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
      ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    };
    const monthName = (monthNames[language] || monthNames.uz)[lastEnd.getMonth()];
    const periodLabel = language === 'ru'
      ? `за ${monthName} ${yearNum} года`
      : language === 'en'
        ? `for ${monthName} ${yearNum}`
        : `${yearNum}-yil ${monthName} oyi uchun`;

    // Prefer the per-row snapshot from the backend (TT §2.3.2). Fallback to 40
    // only if the legacy row has no recorded percent — keeps pre-migration
    // payrolls printable.
    const firstRow = payrollsToShow[0] || {};
    const advancePercent = firstRow.advance_percent_used || 40;
    const today = format(new Date(), 'dd.MM.yyyy');
    const currencyLabel = language === 'ru' ? 'сум (UZS)' : language === 'en' ? 'UZS' : "so\u2018m (UZS)";

    // Build employee rows
    let totalSalary = 0;
    let totalAdvance = 0;
    let totalRemainder = 0;

    const rowsHtml = payrollsToShow.map((p, i) => {
      const salary = p.gross_pay || p.basic_salary || p.base_salary || 0;
      // Prefer the server snapshot. Fallback to on-the-fly compute for legacy rows.
      const advance = (p.advance_amount != null && p.advance_amount > 0)
        ? p.advance_amount
        : Math.round(salary * advancePercent / 100);
      const remainder = (p.remainder_amount != null && p.remainder_amount > 0)
        ? p.remainder_amount
        : (salary - advance);
      totalSalary += salary;
      totalAdvance += advance;
      totalRemainder += remainder;

      // TT §2.4: day of month actually paid. Empty cell when not yet paid.
      const advanceDay = p.advance_paid_day ? String(p.advance_paid_day) : '';
      const remainderDay = p.remainder_paid_day ? String(p.remainder_paid_day) : '';

      // Prefer the position snapshot so the print matches what the period was
      // generated with, even if the employee record has since been edited (TT §2.1).
      const emp = employees.find(e => e.id === p.employee_id)
        || employees.find(e => e.full_name === p.employee_name)
        || employees.find(e => `${e.first_name} ${e.last_name}` === p.employee_name);
      const position = p.position_snapshot
        || emp?.job_position_name || emp?.job_title || emp?.position || '-';

      return `
        <tr>
          <td class="c">${i + 1}</td>
          <td class="name">${p.employee_name || '-'}</td>
          <td class="pos">${position}</td>
          <td class="r">${formatCurrency(salary)}</td>
          <td class="r">${formatCurrency(advance)}</td>
          <td class="day-cell c"><b>${advanceDay}</b></td>
          <td class="r">${formatCurrency(remainder)}</td>
          <td class="day-cell c"><b>${remainderDay}</b></td>
          <td class="sig"></td>
        </tr>
      `;
    }).join('');

    // Director name for signature
    const directorName = activeCompany?.director_name || '';

    const html = `
      <html>
      <head>
        <title>${t('qaydnoma_title')} - ${monthNum}/${yearNum}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; padding: 30px 40px; color: #000; font-size: 10pt; }
          .header { text-align: center; margin-bottom: 6px; }
          .header .company { font-size: 13pt; font-weight: bold; margin-bottom: 3px; }
          .header .address { color: #555; font-size: 9pt; margin: 2px 0; }
          .header .stir { color: #555; font-size: 9pt; margin: 2px 0; }
          .divider { border-bottom: 1.5px solid #000; margin: 8px 0 16px 0; }
          .title { text-align: center; margin-bottom: 4px; }
          .title h2 { font-size: 15pt; font-weight: bold; margin: 0 0 3px 0; letter-spacing: 0.5px; }
          .title .period-num { font-size: 11pt; font-weight: bold; margin: 2px 0; }
          .title .period-desc { font-size: 11pt; font-style: italic; margin: 2px 0 18px 0; }
          .meta-row { font-size: 10pt; margin-bottom: 12px; }
          .meta-row b { font-weight: bold; }
          table.main { width: 100%; border-collapse: collapse; margin: 10px 0; }
          table.main th, table.main td { border: 1.5px solid #000; padding: 5px 6px; font-size: 10pt; }
          table.main th { background: #D9D9D9; text-align: center; font-weight: bold; vertical-align: middle; }
          table.main th.day-hdr { background: #FFF2CC; font-size: 9pt; }
          table.main td.c { text-align: center; }
          table.main td.r { text-align: right; }
          table.main td.name { font-size: 9pt; }
          table.main td.pos { font-size: 9pt; }
          table.main td.day-cell { background: #FFFBF0; }
          table.main td.sig { min-width: 80px; }
          .total-row td { background: #F0F0F0; font-weight: bold; }
          .note { margin: 12px 0 6px 0; font-size: 9pt; }
          .note b { font-weight: bold; }
          .note .note-text { font-style: italic; color: #555; }
          .summary { margin: 6px 0; font-size: 10pt; }
          .summary p { margin: 3px 0; }
          .summary b { font-weight: bold; }
          .sig-title { font-size: 11pt; font-weight: bold; margin: 16px 0 8px 0; }
          table.sig-table { width: 100%; border-collapse: collapse; }
          table.sig-table td { border: none; padding: 3px 0; font-size: 10pt; vertical-align: bottom; }
          table.sig-table td.label { width: 28%; font-weight: bold; }
          table.sig-table td.line { width: 38%; }
          table.sig-table td.fname { width: 34%; }
          .footer-note { text-align: center; margin-top: 24px; font-size: 9pt; font-style: italic; color: #666; }
          @media print {
            body { padding: 15px 20px; }
            @page { margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">&laquo;${activeCompany?.company_name || activeCompany?.name || '_______________'}&raquo;</div>
          <div class="address">${activeCompany?.legal_address || '_______________'}</div>
          <div class="stir">STIR: ${activeCompany?.tax_id || '_______________'} &bull; Tel: ${activeCompany?.phone || activeCompany?.director_phone || '_______________'}</div>
        </div>
        <div class="divider"></div>

        <div class="title">
          <h2>${t('qaydnoma_title')}</h2>
          <div class="period-num">${t('qaydnoma_number')} ${monthNum} / ${yearNum}</div>
          <div class="period-desc">${periodLabel}</div>
        </div>

        <div class="meta-row">
          <b>${t('qaydnoma_created_date')}: </b>${today}
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <b>${t('qaydnoma_advance_percent')}: </b>${advancePercent}%
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <b>${t('qaydnoma_currency')}: </b>${currencyLabel}
        </div>

        <table class="main">
          <thead>
            <tr>
              <th style="width:30px">${t('qaydnoma_number')}</th>
              <th style="width:150px">${t('qaydnoma_fio')}</th>
              <th style="width:90px">${t('qaydnoma_position')}</th>
              <th style="width:120px; font-size:9pt">${t('qaydnoma_salary')}</th>
              <th style="width:120px">${t('qaydnoma_advance')}</th>
              <th class="day-hdr" style="width:35px">${t('qaydnoma_day')}</th>
              <th style="width:120px">${t('qaydnoma_remainder')}</th>
              <th class="day-hdr" style="width:35px">${t('qaydnoma_day')}</th>
              <th style="width:100px">${t('qaydnoma_signature')}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="3" class="c"><b>${t('qaydnoma_total')}</b></td>
              <td class="r">${formatCurrency(totalSalary)}</td>
              <td class="r">${formatCurrency(totalAdvance)}</td>
              <td></td>
              <td class="r">${formatCurrency(totalRemainder)}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="note">
          <b>${language === 'ru' ? 'Примечание' : language === 'en' ? 'Note' : 'Izoh'}: </b>
          <span class="note-text">${language === 'ru'
            ? '«День» — конкретная дата выплаты аванса и остатка. Если оплата не произведена, ячейка остаётся пустой.'
            : language === 'en'
              ? '"Day" columns — the exact day when advance and remainder are paid. If payment has not been made, the cell remains empty.'
              : '«Kun» ustunlari — avans va qoldiq to\u2019langan aniq kun raqami. Agar to\u2019lov amalga oshirilmagan bo\u2019lsa, katak bo\u2019sh qoladi.'
          }</span>
        </div>

        <div class="summary">
          <p><b>${t('qaydnoma_total_payable')}: </b>${formatCurrency(totalSalary)} ${currencyLabel}</p>
          <p>
            <b>${t('qaydnoma_advance_amount')}: </b>${formatCurrency(totalAdvance)} ${currencyLabel}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <b>${t('qaydnoma_remainder_amount')}: </b>${formatCurrency(totalRemainder)} ${currencyLabel}
          </p>
          <p><b>${t('qaydnoma_employees_count')}: </b>${payrollsToShow.length} ${language === 'ru' ? 'чел.' : language === 'en' ? 'employees' : 'kishi'}</p>
        </div>

        <div class="sig-title">${language === 'ru' ? 'ПОДПИСИ:' : language === 'en' ? 'SIGNATURES:' : 'IMZOLAR:'}</div>

        <table class="sig-table">
          <tr>
            <td class="label">${t('qaydnoma_prepared_by')}:</td>
            <td class="line">_____________________________</td>
            <td class="fname">/ _______________ /</td>
          </tr>
          <tr><td colspan="3" style="height:12px"></td></tr>
          <tr>
            <td class="label">${t('qaydnoma_approved_by')}:</td>
            <td class="line">_____________________________</td>
            <td class="fname">/ ${directorName || '_______________'} /</td>
          </tr>
        </table>

        <div class="footer-note">${t('qaydnoma_note')}</div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  // Download the monthly payroll vedomost as an Excel workbook.
  // One sheet per payroll_period_id found in the currently-filtered rows,
  // using the backend's aggregated /payroll-periods/:id/vedomost endpoint
  // so every configured tax (NDFL/Profsoyuz/INPS/ESP…) becomes its own
  // column with the right rate header — matches §7.4 + §10 report #1 of
  // ТЗ_Ish_Haqi_Soliq_Tolik.docx.
  const [exportingVedomost, setExportingVedomost] = useState(false);
  const handleExportVedomostXlsx = async () => {
    const payrollsToShow = filteredPayrolls.filter(p => p.status !== 'cancelled');
    if (payrollsToShow.length === 0) return;

    // Collect distinct period ids from the visible rows. If the payroll
    // record doesn't carry a payroll_period_id we just skip it — the
    // vedomost is inherently period-scoped.
    const periodIds = Array.from(
      new Set(payrollsToShow.map(p => p.payroll_period_id).filter(Boolean))
    );
    if (periodIds.length === 0) {
      toast.error(t('vedomost_no_periods') || "Ko'rsatilgan ro'yxatda davr topilmadi");
      return;
    }

    setExportingVedomost(true);
    try {
      const wb = XLSX.utils.book_new();
      for (const periodId of periodIds) {
        const ved = await hrService.getPayrollVedomost(periodId);
        if (!ved) continue;
        const columns = ved.tax_columns || [];

        // Header row — FOT block + one column per tax + summary columns.
        const header = [
          '№',
          t('employee') || 'Xodim',
          t('position') || 'Lavozim',
          'FOT',
          ...columns.map(c => `${c.name} (${Number(c.rate).toFixed(2)}%)`),
          t('total_employee_tax') || 'Ushlanmalar',
          t('total_employer_tax') || 'Ish beruvchi soliqlari',
          t('netto') || 'Netto',
          t('employer_cost') || 'Umumiy xarajat',
        ];

        const aoa = [header];
        (ved.rows || []).forEach((r, idx) => {
          aoa.push([
            idx + 1,
            r.employee_name,
            r.position || '',
            r.fot,
            ...columns.map(c => r.taxes?.[c.code] ?? 0),
            r.total_employee_tax,
            r.total_employer_tax,
            r.netto,
            r.employer_cost,
          ]);
        });

        // Jami (totals) row.
        const totals = ved.totals || {};
        aoa.push([
          '',
          t('total') || 'JAMI',
          '',
          totals.fot || 0,
          ...columns.map(c => totals.taxes?.[c.code] ?? 0),
          totals.total_employee_tax || 0,
          totals.total_employer_tax || 0,
          totals.netto || 0,
          totals.employer_cost || 0,
        ]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Column widths: name/position wider, numbers narrower.
        ws['!cols'] = [
          { wch: 4 }, { wch: 30 }, { wch: 24 }, { wch: 14 },
          ...columns.map(() => ({ wch: 14 })),
          { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
        ];

        const name = (ved.period?.name || ved.period?.code || periodId.slice(0, 8))
          .replace(/[:\\/?*[\]]/g, '-')
          .slice(0, 31); // Excel sheet-name limit
        XLSX.utils.book_append_sheet(wb, ws, name);
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      XLSX.writeFile(wb, `vedomost-${today}.xlsx`);
      toast.success(t('vedomost_export_success') || "Vedomost Excel yuklandi");
    } catch (e) {
      console.error('Failed to export vedomost:', e);
      toast.error(e?.response?.data?.message || t('error_occurred') || "Xatolik");
    } finally {
      setExportingVedomost(false);
    }
  };

  // Download Qaydnoma as .doc file (Word-compatible HTML)
  const handleDownloadQaydnomaDocx = () => {
    const payrollsToShow = filteredPayrolls.filter(p => p.status !== 'cancelled');
    if (payrollsToShow.length === 0) return;

    const endDates = payrollsToShow.map(p => p.pay_period_end).filter(Boolean).sort();
    const lastEnd = endDates[endDates.length - 1] ? new Date(endDates[endDates.length - 1]) : new Date();
    const monthNum = lastEnd.getMonth() + 1;
    const yearNum = lastEnd.getFullYear();

    const monthNames = {
      uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
      ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    };
    const monthName = (monthNames[language] || monthNames.uz)[lastEnd.getMonth()];
    const periodLabel = language === 'ru'
      ? `за ${monthName} ${yearNum} года`
      : language === 'en'
        ? `for ${monthName} ${yearNum}`
        : `${yearNum}-yil ${monthName} oyi uchun`;

    // TT §2.3.2 / §2.4: prefer server-snapshot advance percent + actual paid days
    const firstRow = payrollsToShow[0] || {};
    const advancePercent = firstRow.advance_percent_used || 40;
    const today = format(new Date(), 'dd.MM.yyyy');
    const currencyLabel = language === 'ru' ? 'сум (UZS)' : language === 'en' ? 'UZS' : "so\u2018m (UZS)";

    let totalSalary = 0;
    let totalAdvance = 0;
    let totalRemainder = 0;

    const rowsHtml = payrollsToShow.map((p, i) => {
      const salary = p.gross_pay || p.basic_salary || p.base_salary || 0;
      const advance = (p.advance_amount != null && p.advance_amount > 0)
        ? p.advance_amount
        : Math.round(salary * advancePercent / 100);
      const remainder = (p.remainder_amount != null && p.remainder_amount > 0)
        ? p.remainder_amount
        : (salary - advance);
      totalSalary += salary;
      totalAdvance += advance;
      totalRemainder += remainder;

      const advanceDay = p.advance_paid_day ? String(p.advance_paid_day) : '';
      const remainderDay = p.remainder_paid_day ? String(p.remainder_paid_day) : '';

      const emp = employees.find(e => e.id === p.employee_id)
        || employees.find(e => e.full_name === p.employee_name)
        || employees.find(e => `${e.first_name} ${e.last_name}` === p.employee_name);
      const position = p.position_snapshot
        || emp?.job_position_name || emp?.job_title || emp?.position || '-';

      return `<tr>
        <td align="center" style="width:30px">${i + 1}</td>
        <td style="width:150px; font-size:9pt">${p.employee_name || '-'}</td>
        <td style="width:90px; font-size:9pt">${position}</td>
        <td align="right" style="width:120px">${formatCurrency(salary)}</td>
        <td align="right" style="width:120px">${formatCurrency(advance)}</td>
        <td align="center" style="width:35px; background:#FFFBF0"><b>${advanceDay}</b></td>
        <td align="right" style="width:120px">${formatCurrency(remainder)}</td>
        <td align="center" style="width:35px; background:#FFFBF0"><b>${remainderDay}</b></td>
        <td style="width:100px"></td>
      </tr>`;
    }).join('');

    const directorName = activeCompany?.director_name || '';

    // Word-compatible HTML with mso namespace for page settings
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 1cm; }
          body { font-family: 'Times New Roman', serif; font-size: 10pt; color: #000; }
          table { border-collapse: collapse; }
          .main-table td, .main-table th { border: 1.5px solid #000; padding: 5px 6px; font-size: 10pt; }
          .main-table th { background: #D9D9D9; text-align: center; font-weight: bold; }
          .day-hdr { background: #FFF2CC !important; font-size: 9pt !important; }
          .total-row td { background: #F0F0F0; font-weight: bold; }
          .sig-table td { border: none; padding: 3px 0; font-size: 10pt; }
        </style>
      </head>
      <body>
        <p align="center" style="margin-bottom:3px">
          <b style="font-size:13pt">&laquo;${activeCompany?.company_name || activeCompany?.name || '_______________'}&raquo;</b>
        </p>
        <p align="center" style="margin:2px 0; color:#555; font-size:9pt">
          ${activeCompany?.legal_address || '_______________'}
        </p>
        <p align="center" style="margin:2px 0 8px 0; color:#555; font-size:9pt">
          STIR: ${activeCompany?.tax_id || '_______________'} &bull; Tel: ${activeCompany?.phone || activeCompany?.director_phone || '_______________'}
        </p>
        <hr style="border:none; border-top:1.5px solid #000; margin:8px 0 16px 0">

        <p align="center" style="margin:0 0 3px 0">
          <b style="font-size:15pt">${t('qaydnoma_title')}</b>
        </p>
        <p align="center" style="margin:2px 0; font-size:11pt">
          <b>${t('qaydnoma_number')} ${monthNum} / ${yearNum}</b>
        </p>
        <p align="center" style="margin:2px 0 18px 0; font-size:11pt">
          <i>${periodLabel}</i>
        </p>

        <p style="margin-bottom:12px; font-size:10pt">
          <b>${t('qaydnoma_created_date')}: </b>${today}
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <b>${t('qaydnoma_advance_percent')}: </b>${advancePercent}%
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <b>${t('qaydnoma_currency')}: </b>${currencyLabel}
        </p>

        <table class="main-table" width="100%">
          <thead>
            <tr>
              <th style="width:30px">${t('qaydnoma_number')}</th>
              <th style="width:150px">${t('qaydnoma_fio')}</th>
              <th style="width:90px">${t('qaydnoma_position')}</th>
              <th style="width:120px; font-size:9pt">${t('qaydnoma_salary')}</th>
              <th style="width:120px">${t('qaydnoma_advance')}</th>
              <th class="day-hdr" style="width:35px">${t('qaydnoma_day')}</th>
              <th style="width:120px">${t('qaydnoma_remainder')}</th>
              <th class="day-hdr" style="width:35px">${t('qaydnoma_day')}</th>
              <th style="width:100px">${t('qaydnoma_signature')}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="3" align="center"><b>${t('qaydnoma_total')}</b></td>
              <td align="right">${formatCurrency(totalSalary)}</td>
              <td align="right">${formatCurrency(totalAdvance)}</td>
              <td></td>
              <td align="right">${formatCurrency(totalRemainder)}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <p style="margin:12px 0 6px 0; font-size:9pt">
          <b>${language === 'ru' ? 'Примечание' : language === 'en' ? 'Note' : 'Izoh'}: </b>
          <i style="color:#555">${language === 'ru'
            ? '«День» — конкретная дата выплаты аванса и остатка.'
            : language === 'en'
              ? '"Day" columns — the exact day when advance and remainder are paid.'
              : '«Kun» ustunlari — avans va qoldiq to\u2019langan aniq kun raqami. Agar to\u2019lov amalga oshirilmagan bo\u2019lsa, katak bo\u2019sh qoladi.'
          }</i>
        </p>

        <p style="margin:3px 0"><b>${t('qaydnoma_total_payable')}: </b>${formatCurrency(totalSalary)} ${currencyLabel}</p>
        <p style="margin:3px 0">
          <b>${t('qaydnoma_advance_amount')}: </b>${formatCurrency(totalAdvance)} ${currencyLabel}
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <b>${t('qaydnoma_remainder_amount')}: </b>${formatCurrency(totalRemainder)} ${currencyLabel}
        </p>
        <p style="margin:3px 0 18px 0"><b>${t('qaydnoma_employees_count')}: </b>${payrollsToShow.length} ${language === 'ru' ? 'чел.' : language === 'en' ? 'employees' : 'kishi'}</p>

        <p style="font-size:11pt; font-weight:bold; margin:16px 0 8px 0">${language === 'ru' ? 'ПОДПИСИ:' : language === 'en' ? 'SIGNATURES:' : 'IMZOLAR:'}</p>

        <table class="sig-table" width="100%">
          <tr>
            <td width="28%"><b>${t('qaydnoma_prepared_by')}:</b></td>
            <td width="38%">_____________________________</td>
            <td width="34%">/ _______________ /</td>
          </tr>
          <tr><td colspan="3" style="height:12px"></td></tr>
          <tr>
            <td><b>${t('qaydnoma_approved_by')}:</b></td>
            <td>_____________________________</td>
            <td>/ ${directorName || '_______________'} /</td>
          </tr>
        </table>

        <p align="center" style="margin-top:24px; font-size:9pt; font-style:italic; color:#666">
          ${t('qaydnoma_note')}
        </p>
      </body>
    </html>`;

    // Create blob and download as .doc (Word-compatible HTML)
    const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Qaydnoma_${monthNum}_${yearNum}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      calculated: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-slate-100 text-slate-800'
    };
    return colors[status] || colors.draft;
  };

  const metrics = {
    totalPayrolls: payrolls.length,
    totalGrossPay: payrolls.reduce((sum, p) => sum + (p.gross_pay || 0), 0),
    totalNetPay: payrolls.reduce((sum, p) => sum + (p.net_pay || 0), 0),
    pendingPayments: payrolls.filter(p => p.status === 'approved').length
  };

  // Group payrolls into a calendar-month bucket and stash the original
  // Date so we can sort chronologically. The old slice(-6) picked the
  // last six entries by insertion order — that reflected fetch order
  // (newest payroll first), not the actual month axis, so the bars
  // jumped around. Sorting by date guarantees the chart reads
  // left-to-right oldest → newest.
  const monthlyData = {};
  payrolls.forEach(p => {
    if (!p.pay_period_end) return;
    const d = new Date(p.pay_period_end);
    const key = format(d, 'MM.yy');
    if (!monthlyData[key]) {
      monthlyData[key] = { month: key, amount: 0, _ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
    }
    monthlyData[key].amount += (p.net_pay || 0);
  });
  const chartData = Object.values(monthlyData)
    .sort((a, b) => a._ts - b._ts)
    .slice(-12)
    .map(({ month, amount }) => ({ month, amount }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">

        {/* Tabs */}
        <Tabs defaultValue="payroll" className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="payroll" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <DollarSign className="w-4 h-4" />
              {t('payroll') || 'Ish haqi'}
            </TabsTrigger>
            <TabsTrigger value="loans" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <CreditCard className="w-4 h-4" />
              {t('employee_loans')}
            </TabsTrigger>
            <TabsTrigger value="portal" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <UserCircle className="w-4 h-4" />
              {t('employee_portal')}
            </TabsTrigger>
            {/* TT §3.2 / §5.1: Xodimlar — inline employee list scoped to the Ish haqi module */}
            <TabsTrigger value="employees" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Users className="w-4 h-4" />
              {t('employees') || 'Xodimlar'}
            </TabsTrigger>
            {/* TT §2.6: Tarix (history) */}
            <TabsTrigger value="history" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <History className="w-4 h-4" />
              {t('history') || 'Tarix'}
            </TabsTrigger>
            {/* Sozlamalar tab removed at user request — payroll
                settings (advance %, currency, company name on print
                header) live in the global Settings module instead. */}
          </TabsList>

          <TabsContent value="payroll" className="mt-4 space-y-6">

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_payrolls')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalPayrolls}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('gross_pay')}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalGrossPay)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('net_pay')}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalNetPay)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('pending_payments')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.pendingPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Payroll — smooth gradient area chart matching the
            main Dashboard's revenue chart. Full-month axis, soft
            grid, and a custom tooltip card with the formatted
            amount. Up to 12 trailing months for a proper
            year-over-year read. */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-violet-600" />
                    {t('monthly_payroll')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="payrollGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="month"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={55}
                        tickFormatter={(v) => {
                          const n = Number(v) || 0;
                          if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
                          if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'K';
                          return String(n);
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          boxShadow: '0 10px 24px rgba(15,23,42,0.08)',
                          fontSize: 12,
                        }}
                        labelStyle={{ color: '#475569', fontWeight: 600, marginBottom: 4 }}
                        formatter={(value) => [formatCurrency(value), t('amount')]}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        name={t('amount')}
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        fill="url(#payrollGrad)"
                        dot={false}
                        activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2, fill: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
          </div>
        )}

        {/* Payroll Table */}
        <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{t('payroll_records')}</CardTitle>
                <div className="flex gap-2">
                  {/* Toolbar buttons collapsed to icon-only at user
                      request (DOCX export removed entirely — Vedomost
                      Excel covers the same accounting handoff). Each
                      icon button keeps a `title` tooltip so the
                      original label is still discoverable on hover. */}
                  {filteredPayrolls.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePrintQaydnoma}
                        title={t('print_qaydnoma') || 'Print salary record'}
                        aria-label={t('print_qaydnoma') || 'Print salary record'}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      {/* Vedomost Excel — one sheet per payroll period with
                          every tax pivoted into its own column. */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleExportVedomostXlsx}
                        disabled={exportingVedomost}
                        title={t('vedomost_excel') || 'Vedomost (Excel)'}
                        aria-label={t('vedomost_excel') || 'Vedomost (Excel)'}
                      >
                        {exportingVedomost ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileDown className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
                  {(canCreate(MODULES.PAYROLL) || canCreate(MODULES.HR)) && (
                    <>
                      {/* TT §2.3: one-click auto-create of current month payroll */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAutoCreateCurrentMonth}
                        disabled={autoCreating}
                        title={t('auto_create_payroll_hint') || "Joriy oy uchun barcha xodimlarga qaydnoma avtomatik yaratiladi"}
                        aria-label={t('auto_create_current_month') || 'Joriy oyga yaratish'}
                      >
                        {autoCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                      </Button>
                      <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                        <Plus className="w-4 h-4 mr-2" /> {t('process_payroll')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_payrolls')}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
{/* Employee filter removed - showing payroll periods, not individual entries */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    <SelectItem value="draft">{t('draft')}</SelectItem>
                    <SelectItem value="calculated">{t('calculated')}</SelectItem>
                    <SelectItem value="approved">{t('approved')}</SelectItem>
                    <SelectItem value="paid">{t('paid')}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredPayrolls.length === 0 ? (
                <div className="text-center py-16">
                  <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_payroll_records_yet')}</p>
                  {(canCreate(MODULES.PAYROLL) || canCreate(MODULES.HR)) && (
                    <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('process_first_payroll')}</Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead style={{ width: 36 }} />
                        <TableHead>{t('payroll_number')}</TableHead>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead>{t('period')}</TableHead>
                        <TableHead>{t('gross_pay')}</TableHead>
                        <TableHead>{t('net_pay')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead>{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayrolls.map((payroll) => {
                        const isExpanded = expandedPayrollId === payroll.id;
                        const debts      = debtsByPayroll[payroll.id];
                        const isLoading  = debtsLoadingId === payroll.id;
                        return (
                      <React.Fragment key={payroll.id}>
                        <TableRow className="hover:bg-slate-50">
                          <TableCell className="px-2">
                            <button
                              type="button"
                              onClick={() => togglePayrollExpand(payroll)}
                              className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
                              title={isExpanded ? (t('hide_debts') || 'Yopish') : (t('show_debts') || "Qarzlarni ko'rish")}
                              aria-label={t('show_debts') || "Show debts"}
                            >
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{payroll.payroll_number}</TableCell>
                          <TableCell className="font-medium">{payroll.employee_name || payroll.period_name}</TableCell>
                          <TableCell className="text-sm">
                            {payroll.pay_period_start && payroll.pay_period_end ?
                              `${format(new Date(payroll.pay_period_start), 'dd.MM')} - ${format(new Date(payroll.pay_period_end), 'dd.MM')}`
                              : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(payroll.gross_pay || 0)}</TableCell>
                          <TableCell className="font-semibold text-green-600">{formatCurrency(payroll.net_pay || 0)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(payroll.status)}>{t(payroll.status)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {/* TT §2.4 per-row advance/remainder flags. Title tooltip
                                  shows the actual day paid. */}
                              <Button
                                size="sm" variant="ghost"
                                className={payroll.advance_paid ? 'text-green-600' : 'text-slate-500'}
                                title={payroll.advance_paid
                                  ? `${t('advance_paid') || 'Avans to\'langan'}${payroll.advance_paid_day ? ' — ' + payroll.advance_paid_day : ''}`
                                  : (t('mark_advance_paid') || 'Avansni to\'langan deb belgilash')}
                                onClick={() => toggleTTPaid(payroll, 'advance')}
                              >
                                {payroll.advance_paid ? '🟢' : '⚪'} {t('advance_short') || 'Avans'}
                                {payroll.advance_paid_day ? ` (${payroll.advance_paid_day})` : ''}
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className={payroll.remainder_paid ? 'text-green-600' : 'text-slate-500'}
                                title={payroll.remainder_paid
                                  ? `${t('remainder_paid') || 'Qoldiq to\'langan'}${payroll.remainder_paid_day ? ' — ' + payroll.remainder_paid_day : ''}`
                                  : (t('mark_remainder_paid') || 'Qoldiqni to\'langan deb belgilash')}
                                onClick={() => toggleTTPaid(payroll, 'remainder')}
                              >
                                {payroll.remainder_paid ? '🟢' : '⚪'} {t('remainder_short') || 'Qoldiq'}
                                {payroll.remainder_paid_day ? ` (${payroll.remainder_paid_day})` : ''}
                              </Button>
                              {payroll.status === 'draft' && canUpdate(MODULES.PAYROLL) || canUpdate(MODULES.HR) && (
                                <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => updatePayrollStatus(payroll.id, 'approved')}>
                                  {t('approve')}
                                </Button>
                              )}
                              {payroll.status === 'calculated' && canUpdate(MODULES.PAYROLL) || canUpdate(MODULES.HR) && (
                                <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => updatePayrollStatus(payroll.id, 'approved')}>
                                  {t('approve')}
                                </Button>
                              )}
                              {payroll.status === 'approved' && canUpdate(MODULES.PAYROLL) || canUpdate(MODULES.HR) && (
                                <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handlePayClick(payroll.id)}>
                                  {t('pay')}
                                </Button>
                              )}
                              {(payroll.status === 'draft' || payroll.status === 'calculated') && canUpdate(MODULES.PAYROLL) || canUpdate(MODULES.HR) && (
                                <Button size="sm" variant="ghost" onClick={() => handleEditPayroll(payroll)} title={t('edit')}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleDownloadPayslip(payroll)} title={t('download')}>
                                <Download className="w-4 h-4" />
                              </Button>
                              {(payroll.status === 'draft' || payroll.status === 'calculated') && canDelete(MODULES.PAYROLL) || canDelete(MODULES.HR) && (
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(payroll)} title={t('delete')}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* Expanded debts sub-row — Active loans + pending
                            shortage deductions, mirrored from the same
                            sources the Process Payroll modal pulls from
                            (`/employee-loans?status=active` and
                            `/employees/:id/deductions?status=pending`). */}
                        {isExpanded && (
                          <TableRow key={`debts-${payroll.id}`} className="bg-slate-50/50">
                            <TableCell colSpan={8} className="p-0">
                              <div className="px-6 py-4">
                                {isLoading ? (
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('loading') || 'Yuklanmoqda...'}
                                  </div>
                                ) : !debts ? null : (
                                  (() => {
                                    const loans = debts.loans || [];
                                    const dedns = debts.deductions || [];
                                    const loanTotal = loans.reduce((s, l) => s + (Number(l.remaining_amount) || 0), 0);
                                    const dedTotal  = dedns.reduce((s, d) => s + (Number(d.amount) || 0), 0);
                                    if (loans.length === 0 && dedns.length === 0) {
                                      return (
                                        <div className="text-sm text-slate-500 italic">
                                          {t('no_debts') || "Qarzlar yo'q"}
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Active loans */}
                                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                              <Wallet className="w-4 h-4 text-blue-600" />
                                              {t('active_loans') || 'Faol qarzlar'}
                                              <span className="text-[11px] font-normal text-slate-500">({loans.length})</span>
                                            </div>
                                            <div className="text-sm font-mono text-slate-900">
                                              {formatCurrency(loanTotal)}
                                            </div>
                                          </div>
                                          {loans.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic">
                                              {t('no_active_loans') || "Faol qarz yo'q"}
                                            </div>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {loans.map((l) => (
                                                <div
                                                  key={l.id}
                                                  className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded bg-slate-50"
                                                >
                                                  <div className="min-w-0">
                                                    <div className="font-medium text-slate-800 truncate">
                                                      {l.purpose || l.loan_type || (t('loan') || 'Qarz')}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                      {(t('monthly_payment') || 'Oylik to\'lov')}: <span className="font-mono">{formatCurrency(l.monthly_payment || 0)}</span>
                                                      {l.start_date ? ` · ${format(new Date(l.start_date), 'dd.MM.yyyy')}` : ''}
                                                    </div>
                                                  </div>
                                                  <div className="text-right shrink-0">
                                                    <div className="font-mono font-semibold text-slate-900">
                                                      {formatCurrency(l.remaining_amount || 0)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                      {(t('remaining') || 'Qoldiq')}
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Pending shortage deductions */}
                                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                              <FileMinus className="w-4 h-4 text-orange-600" />
                                              {t('pending_deductions') || 'Kutayotgan ushlanmalar'}
                                              <span className="text-[11px] font-normal text-slate-500">({dedns.length})</span>
                                            </div>
                                            <div className="text-sm font-mono text-slate-900">
                                              {formatCurrency(dedTotal)}
                                            </div>
                                          </div>
                                          {dedns.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic">
                                              {t('no_pending_deductions') || "Ushlanma yo'q"}
                                            </div>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {dedns.map((d) => (
                                                <div
                                                  key={d.id}
                                                  className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded bg-slate-50"
                                                >
                                                  <div className="min-w-0">
                                                    <div className="font-medium text-slate-800 truncate">
                                                      {d.description || d.reason || d.note || (t('shortage') || 'Kamomad')}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                      {d.created_at
                                                        ? format(new Date(d.created_at), 'dd.MM.yyyy')
                                                        : (t('pending') || 'Kutilmoqda')}
                                                    </div>
                                                  </div>
                                                  <div className="font-mono font-semibold text-slate-900 shrink-0">
                                                    {formatCurrency(d.amount || 0)}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_payroll_confirm')} <strong>{payrollToDelete?.payroll_number}</strong>? {t('action_cannot_undone')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setPayrollToDelete(null); }}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePayroll}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Payment Method Dialog */}
        <Dialog open={showPayMethodDialog} onOpenChange={setShowPayMethodDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('select_payment_method') || "To'lov usulini tanlang"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <button
                onClick={() => setSelectedPayMethod('cash')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${selectedPayMethod === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className="text-2xl">💵</span>
                <span className="font-medium">{t('cash') || 'Naqd pul'}</span>
              </button>
              <button
                onClick={() => setSelectedPayMethod('card')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${selectedPayMethod === 'card' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <CreditCard className="w-6 h-6 text-slate-600" />
                <span className="font-medium">{t('plastic_card') || 'Plastik karta'}</span>
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPayMethodDialog(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmPay}>
                {t('confirm_payment') || 'Tasdiqlash'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* TT §2.4 — Mark advance/remainder paid: day-of-month picker.
            Replaces the native window.prompt that previously asked for the day. */}
        <Dialog
          open={paidDialog.open}
          onOpenChange={(open) => {
            if (!paidDialog.saving) {
              setPaidDialog((d) => ({ ...d, open }));
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {paidDialog.kind === 'advance'
                  ? (t('ask_advance_day') || "Avans qaysi kunda to'landi?")
                  : (t('ask_remainder_day') || "Qoldiq qaysi kunda to'landi?")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-500">
                {t('leave_blank_for_today') || "(bo'sh qoldiring — bugungi kun)"}
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('day_of_month') || 'Kun'} (1–31)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder={String(new Date().getDate())}
                  value={paidDialog.dayInput}
                  onChange={(e) =>
                    setPaidDialog((d) => ({ ...d, dayInput: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitPaidDialog();
                    if (e.key === 'Escape' && !paidDialog.saving) {
                      setPaidDialog({ open: false, kind: null, entry: null, dayInput: '', saving: false });
                    }
                  }}
                  autoFocus
                />
              </div>
              {/* Quick-pick buttons for common payroll days */}
              <div className="flex gap-1 flex-wrap">
                {[1, 5, 10, 15, 20, 25, 28].map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    size="sm"
                    onClick={() => setPaidDialog((s) => ({ ...s, dayInput: String(d) }))}
                  >
                    {d}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPaidDialog((s) => ({ ...s, dayInput: String(new Date().getDate()) }))
                  }
                  title={t('today') || 'Bugun'}
                >
                  {t('today') || 'Bugun'}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                disabled={paidDialog.saving}
                onClick={() =>
                  setPaidDialog({ open: false, kind: null, entry: null, dayInput: '', saving: false })
                }
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button onClick={submitPaidDialog} disabled={paidDialog.saving}>
                {paidDialog.saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {t('save') || 'Saqlash'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Payroll Modal */}
        <Dialog
          open={showCreateModal}
          onOpenChange={(open) => {
            setShowCreateModal(open);
            if (!open) setExcludedTaxIds([]);
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('process_payroll')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('employee')} *</label>
                  <Select value={newPayroll.employee_name} onValueChange={(value) => {
                    const selectedEmployee = employees.find(emp => emp.full_name === value);
                    setNewPayroll({
                      ...newPayroll,
                      employee_id: selectedEmployee?.id,
                      employee_name: value,
                      basic_salary: selectedEmployee?.salary || selectedEmployee?.base_salary || 0
                    });
                    if (selectedEmployee?.id) {
                      fetchPendingDeductions(selectedEmployee.id);
                      fetchActiveLoans(selectedEmployee.id);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_employee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.full_name}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('pay_period_start')} *</label>
                  <Input
                    type="date"
                    value={newPayroll.pay_period_start}
                    onChange={(e) => setNewPayroll({...newPayroll, pay_period_start: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('pay_period_end')} *</label>
                  <Input
                    type="date"
                    value={newPayroll.pay_period_end}
                    onChange={(e) => setNewPayroll({...newPayroll, pay_period_end: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payment_date')} *</label>
                  <Input
                    type="date"
                    value={newPayroll.payment_date}
                    onChange={(e) => setNewPayroll({...newPayroll, payment_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">{t('earnings')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('basic_salary')} *</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formatPriceInput(newPayroll.basic_salary)}
                      onChange={(e) => setNewPayroll({...newPayroll, basic_salary: parsePriceInput(e.target.value)})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('overtime_hours')}</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newPayroll.overtime_hours || ''}
                      onChange={(e) => setNewPayroll({...newPayroll, overtime_hours: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('monthly_working_hours')}</label>
                    <Input
                      type="number"
                      placeholder="208"
                      value={newPayroll.monthly_hours || ''}
                      onChange={(e) => setNewPayroll({...newPayroll, monthly_hours: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('bonuses')}</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formatPriceInput(newPayroll.bonuses)}
                      onChange={(e) => setNewPayroll({...newPayroll, bonuses: parsePriceInput(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('allowances')}</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formatPriceInput(newPayroll.allowances)}
                      onChange={(e) => setNewPayroll({...newPayroll, allowances: parsePriceInput(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              {activeLoans.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-800">
                      {language === 'uz' ? "Faol qarzlar (ixtiyoriy ushlash)" : language === 'ru' ? 'Активные займы (удержание опционально)' : 'Active loans (optional deduction)'}
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {activeLoans.map((loan) => {
                      const remaining = Number(loan.remaining_amount || 0);
                      const suggested = Number(loan.monthly_payment || 0);
                      const current = Number(loanDeductions[loan.id] || 0);
                      return (
                        <div key={loan.id} className="bg-white rounded p-2 border border-blue-200">
                          <div className="flex justify-between items-start text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-slate-800 truncate">
                                {loan.loan_number || loan.id?.slice(0, 8)}
                                {loan.reason && <span className="text-slate-500 font-normal"> — {loan.reason}</span>}
                              </div>
                              <div className="text-xs text-slate-500">
                                {language === 'uz' ? 'Qoldiq' : language === 'ru' ? 'Остаток' : 'Remaining'}: <span className="font-semibold">{formatCurrency(remaining)}</span>
                                {suggested > 0 && <>
                                  {' · '}
                                  {language === 'uz' ? 'Oylik' : language === 'ru' ? 'Ежемесячно' : 'Monthly'}: {formatCurrency(suggested)}
                                </>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <label className="text-xs text-slate-600 whitespace-nowrap">
                              {language === 'uz' ? 'Ushlab qolish' : language === 'ru' ? 'Удержать' : 'Deduct'}:
                            </label>
                            <Input
                              type="text"
                              value={formatPriceInput(current)}
                              onChange={(e) => {
                                const v = Math.min(remaining, Math.max(0, parsePriceInput(e.target.value)));
                                setLoanDeductions(prev => ({ ...prev, [loan.id]: v }));
                              }}
                              className="h-8 text-sm bg-white"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs"
                              onClick={() => setLoanDeductions(prev => ({ ...prev, [loan.id]: 0 }))}
                              title={language === 'uz' ? "0 qilish" : 'Zero'}
                            >
                              {language === 'uz' ? 'Ushlamaslik' : language === 'ru' ? 'Не удерживать' : 'Skip'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {totalLoanDeduction > 0 && (
                      <div className="flex justify-between pt-2 border-t border-blue-300 text-sm font-bold text-blue-900">
                        <span>{language === 'uz' ? 'Jami qarz ushlamasi' : language === 'ru' ? 'Итого удержания' : 'Total loan deduction'}:</span>
                        <span>-{formatCurrency(totalLoanDeduction)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {totalPendingDeduction > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-800">{t('shortage_warning')}</h4>
                  </div>
                  <div className="space-y-2 text-sm text-amber-900">
                    {pendingDeductions.map((d, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="truncate mr-2">{d.reason}</span>
                        <span className="font-semibold whitespace-nowrap">{formatCurrency(d.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-amber-300 font-bold">
                      <span>{t('total_shortage')}:</span>
                      <span>{formatCurrency(totalPendingDeduction)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm font-medium text-amber-800 whitespace-nowrap">{t('deduction_percent')}:</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={deductionPercent || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDeductionPercent(val === '' ? 0 : Math.min(100, Math.max(0, parseFloat(val) || 0)));
                      }}
                      className="w-24 bg-white"
                    />
                    <span className="text-sm text-amber-800">%</span>
                    <span className="text-sm font-bold text-red-600 ml-auto">
                      -{formatCurrency(shortageDeductionAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Employee taxes (migration 330) — X to exclude any tax for this entry */}
              {taxCatalog.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Percent className="h-4 w-4 text-slate-600" />
                    <h4 className="font-semibold text-slate-800">
                      {t('employee_taxes') || 'Xodim soliqlari'}
                    </h4>
                    {excludedTaxIds.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 px-2 text-xs"
                        onClick={() => setExcludedTaxIds([])}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        {t('reset') || 'Qayta tiklash'}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {taxCatalog
                      // Only show employee-side taxes here per user
                      // request — employer taxes (Ijtimoiy soliq /
                      // ish beruvchi) are a company expense that
                      // doesn't belong on the employee's payroll modal.
                      // The catalog still tracks them for reporting,
                      // but they're hidden from this UI and excluded
                      // from the deductions summary below.
                      .filter((tax) => tax.payer !== 'employer')
                      .map((tax) => {
                      const excluded = excludedTaxIds.includes(tax.id);
                      const applied = taxPreview.applied?.find((a) => a.tax_id === tax.id);
                      const amount = applied ? applied.amount : 0;
                      return (
                        <div
                          key={tax.id}
                          className={`flex items-center justify-between rounded px-2 py-1.5 ${
                            excluded ? 'bg-slate-100 text-slate-400 line-through' : 'bg-white border border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                tax.payer === 'employer'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {tax.payer === 'employer' ? (t('payer_employer') || 'Ish beruvchi') : (t('payer_employee') || 'Xodim')}
                            </Badge>
                            <span className="font-medium truncate">{tax.name}</span>
                            <span className="text-xs text-slate-500">{Number(tax.rate).toFixed(2)}%</span>
                          </div>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`font-semibold ${tax.payer === 'employee' && !excluded ? 'text-red-600' : ''}`}>
                              {excluded ? '—' : (tax.payer === 'employee' ? '-' : '') + formatCurrency(amount)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title={excluded ? (t('include_tax') || "Qo'shish") : (t('exclude_tax') || "Chiqarib tashlash")}
                              onClick={() => {
                                setExcludedTaxIds((prev) =>
                                  prev.includes(tax.id)
                                    ? prev.filter((x) => x !== tax.id)
                                    : [...prev, tax.id]
                                );
                              }}
                            >
                              {excluded ? <Plus className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex justify-between pt-2 border-t border-slate-300 text-sm">
                      <span className="text-slate-600">{t('employee_tax_total') || "Xodimdan ushlanadi"}:</span>
                      <span className="font-semibold text-red-600">-{formatCurrency(taxPreview.total_employee || 0)}</span>
                    </div>
                    {/* "Employer expense" line removed at user request —
                        it's company-side overhead, not part of the
                        employee's payroll math. The total still flows
                        through `taxPreview.total_employer` for reports
                        / accounting backend, just not displayed here. */}
                  </div>
                </div>
              )}

              {newPayroll.basic_salary > 0 && (() => {
                const calc = calculatePayroll(newPayroll, shortageDeductionAmount, totalLoanDeduction);
                // When employee taxes are configured, prefer the server preview so the
                // UI and the actual saved record match exactly.
                const effectiveDeductions = taxCatalog.length > 0
                  ? (taxPreview.total_employee || 0) + shortageDeductionAmount + totalLoanDeduction
                  : calc.total_deductions + shortageDeductionAmount + totalLoanDeduction;
                const effectiveNet = calc.gross_pay - effectiveDeductions;
                return (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold mb-3">{t('payroll_summary')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{t('gross_pay')}:</span>
                        <span className="font-semibold">{formatCurrency(calc.gross_pay)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>{t('total_deductions')}:</span>
                        <span className="font-semibold">-{formatCurrency(effectiveDeductions)}</span>
                      </div>
                      {shortageDeductionAmount > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>{t('shortage_deduction')} ({deductionPercent}%):</span>
                          <span className="font-semibold">-{formatCurrency(shortageDeductionAmount)}</span>
                        </div>
                      )}
                      {totalLoanDeduction > 0 && (
                        <div className="flex justify-between text-blue-700">
                          <span>{language === 'uz' ? 'Qarz ushlamasi' : language === 'ru' ? 'Удержание займа' : 'Loan deduction'}:</span>
                          <span className="font-semibold">-{formatCurrency(totalLoanDeduction)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t text-lg">
                        <span className="font-bold">{t('net_pay')}:</span>
                        <span className="font-bold text-green-600">{formatCurrency(taxCatalog.length > 0 ? effectiveNet : calc.net_pay)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); setExcludedTaxIds([]); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreatePayroll}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newPayroll.employee_name || !newPayroll.basic_salary}
                >
                  {t('process_payroll')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Payroll Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('edit_payroll')} - {editPayroll?.payroll_number}</DialogTitle>
            </DialogHeader>
            {editPayroll && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('employee')} *</label>
                    <Select value={editPayroll.employee_name} onValueChange={(value) => {
                      const selectedEmployee = employees.find(emp => emp.full_name === value);
                      setEditPayroll({
                        ...editPayroll,
                        employee_name: value,
                        basic_salary: selectedEmployee?.salary || editPayroll.basic_salary
                      });
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.full_name}>{emp.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('pay_period_start')} *</label>
                    <Input
                      type="date"
                      value={editPayroll.pay_period_start}
                      onChange={(e) => setEditPayroll({...editPayroll, pay_period_start: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('pay_period_end')} *</label>
                    <Input
                      type="date"
                      value={editPayroll.pay_period_end}
                      onChange={(e) => setEditPayroll({...editPayroll, pay_period_end: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('payment_date')} *</label>
                    <Input
                      type="date"
                      value={editPayroll.payment_date}
                      onChange={(e) => setEditPayroll({...editPayroll, payment_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">{t('earnings')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('basic_salary')} *</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formatPriceInput(editPayroll.basic_salary)}
                        onChange={(e) => setEditPayroll({...editPayroll, basic_salary: parsePriceInput(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('overtime_hours')}</label>
                      <Input
                        type="number"
                        value={editPayroll.overtime_hours || ''}
                        onChange={(e) => setEditPayroll({...editPayroll, overtime_hours: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('monthly_working_hours')}</label>
                      <Input
                        type="number"
                        value={editPayroll.monthly_hours || ''}
                        onChange={(e) => setEditPayroll({...editPayroll, monthly_hours: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('bonuses')}</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formatPriceInput(editPayroll.bonuses)}
                        onChange={(e) => setEditPayroll({...editPayroll, bonuses: parsePriceInput(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('allowances')}</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formatPriceInput(editPayroll.allowances)}
                        onChange={(e) => setEditPayroll({...editPayroll, allowances: parsePriceInput(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('status')}</label>
                  <Select value={editPayroll.status} onValueChange={(value) => setEditPayroll({...editPayroll, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="calculated">{t('calculated')}</SelectItem>
                      <SelectItem value="approved">{t('approved')}</SelectItem>
                      <SelectItem value="paid">{t('paid')}</SelectItem>
                      <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editPayroll.basic_salary > 0 && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold mb-3">{t('payroll_summary')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{t('gross_pay')}:</span>
                        <span className="font-semibold">{formatCurrency(calculatePayroll(editPayroll).gross_pay)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>{t('total_deductions')}:</span>
                        <span className="font-semibold">-{formatCurrency(calculatePayroll(editPayroll).total_deductions)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t text-lg">
                        <span className="font-bold">{t('net_pay')}:</span>
                        <span className="font-bold text-green-600">{formatCurrency(calculatePayroll(editPayroll).net_pay)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditPayroll(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdatePayroll}
                    className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                    disabled={!editPayroll.employee_name || !editPayroll.basic_salary}
                  >
                    {t('save_changes')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

          </TabsContent>

          <TabsContent value="loans" className="mt-4">
            <EmployeeLoans />
          </TabsContent>

          <TabsContent value="portal" className="mt-4">
            <EmployeePortal />
          </TabsContent>

          {/* TT §3.2 Xodimlar — employees scoped to the payroll module */}
          <TabsContent value="employees" className="mt-4">
            <PayrollEmployeesTab t={t} formatCurrency={formatCurrency} />
          </TabsContent>

          {/* TT §2.6 Tarix — lists all past payrolls with fund/headcount/status */}
          <TabsContent value="history" className="mt-4">
            <PayrollHistoryTab t={t} formatCurrency={formatCurrency} />
          </TabsContent>

          {/* TT §2.2 Sozlamalar — advance percent, currency, company name */}
          <TabsContent value="settings" className="mt-4">
            <PayrollSettingsTab t={t} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TT §2.2 — Sozlamalar (payroll settings) tab
// ─────────────────────────────────────────────────────────────────────
function PayrollSettingsTab({ t }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({ advance_percent: 40, currency: "so'm", company_name: '' });

  useEffect(() => {
    let alive = true;
    hrService.getPayrollSettings()
      .then((s) => { if (alive && s) setForm({
        advance_percent: Number(s.advance_percent ?? 40),
        currency: s.currency || "so'm",
        company_name: s.company_name || '',
      }); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const save = async () => {
    if (form.advance_percent < 0 || form.advance_percent > 100) {
      toast.error(t('advance_percent_range_error') || 'Avans foizi 0 dan 100 gacha bo\'lishi kerak');
      return;
    }
    setSaving(true);
    try {
      await hrService.updatePayrollSettings({
        advance_percent: Number(form.advance_percent),
        currency: form.currency,
        company_name: form.company_name,
      });
      toast.success(t('saved') || 'Saqlandi');
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  const downloadBackup = async () => {
    setExporting(true);
    try {
      const blob = await hrService.exportPayrollBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('backup_exported') || 'Zaxira nusxa yuklandi');
    } catch (e) {
      toast.error(t('error_occurred') || 'Xatolik');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          {t('payroll_settings') || 'Ish haqi sozlamalari'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}</div>
        ) : (
          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('advance_percent') || 'Avans foizi'} (%)
              </label>
              <Input
                type="number" min={0} max={100}
                value={form.advance_percent}
                onChange={(e) => setForm((f) => ({ ...f, advance_percent: Number(e.target.value) }))}
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('advance_percent_hint') || "Bu foiz faqat yangi qaydnomalarga qo'llaniladi."}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('currency') || 'Valyuta'}</label>
              <Input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                placeholder="so'm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('company_name') || 'Tashkilot nomi'}</label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder='MChJ "..."'
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('company_name_hint') || "Chop etish shakli sarlavhasida ko'rinadi."}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('save') || 'Saqlash'}
              </Button>
              <Button variant="outline" onClick={downloadBackup} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                {t('export_backup') || 'Zaxira nusxa (JSON)'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TT §2.6 — Tarix (history) tab
// ─────────────────────────────────────────────────────────────────────
function PayrollHistoryTab({ t, formatCurrency }) {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    let alive = true;
    hrService.listPayrollPeriods({ page: 1, limit: 100 })
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        setPeriods(list);
      })
      .catch(() => alive && setPeriods([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const statusBadge = (s) => {
    const map = {
      draft: 'bg-slate-100 text-slate-700',
      processing: 'bg-blue-100 text-blue-700',
      approved: 'bg-amber-100 text-amber-700',
      paid: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return <Badge className={map[s] || 'bg-slate-100 text-slate-700'}>{t(s) || s}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          {t('history') || 'Tarix'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 p-6">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
          </div>
        ) : periods.length === 0 ? (
          <div className="text-center py-10 text-slate-400">{t('no_data') || "Ma'lumot yo'q"}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('period') || 'Davr'}</TableHead>
                <TableHead className="text-right">{t('employee_count') || 'Xodimlar'}</TableHead>
                <TableHead className="text-right">{t('fund') || 'Fond'}</TableHead>
                <TableHead className="text-right">{t('total_net') || 'Sof summa'}</TableHead>
                <TableHead>{t('status') || 'Holat'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.period_name || p.period_code}
                    <div className="text-xs text-slate-500">{p.start_date} — {p.end_date}</div>
                  </TableCell>
                  <TableCell className="text-right">{p.employee_count || 0}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.total_gross || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.total_net || 0)}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TT §3.2 / §5.1 — Xodimlar (employees) tab scoped to payroll context.
// Shows FIO, position (job_title), monthly salary. Salary can be edited
// inline. Creating or deleting employees is still the HR module's job.
// ─────────────────────────────────────────────────────────────────────
function PayrollEmployeesTab({ t, formatCurrency }) {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Per-row expand state — same pattern as the Payroll Records table:
  // chevron toggles a sub-row that lists the employee's outstanding
  // debts (active loans + pending shortage deductions). Cached per
  // employee id so re-opening doesn't re-fetch.
  const [expandedId, setExpandedId] = useState(null);
  const [debtsByEmp, setDebtsByEmp] = useState({});
  const [debtsLoadingId, setDebtsLoadingId] = useState(null);
  const toggleExpand = async (emp) => {
    if (expandedId === emp.id) { setExpandedId(null); return; }
    setExpandedId(emp.id);
    if (debtsByEmp[emp.id] !== undefined) return;
    setDebtsLoadingId(emp.id);
    try {
      const [loansRes, dedsRes] = await Promise.allSettled([
        apiClient.get('/employee-loans', { params: { employee_id: emp.id, status: 'active', limit: 100 } }),
        apiClient.get(`/employees/${emp.id}/deductions`, { params: { status: 'pending' } }),
      ]);
      const rawLoans = loansRes.status === 'fulfilled'
        ? (loansRes.value?.data?.data ?? loansRes.value?.data ?? [])
        : [];
      const loans = Array.isArray(rawLoans) ? rawLoans : (rawLoans.items || []);
      const deds  = dedsRes.status === 'fulfilled'
        ? (dedsRes.value?.data?.data ?? dedsRes.value?.data ?? [])
        : [];
      setDebtsByEmp((m) => ({ ...m, [emp.id]: { loans, deductions: Array.isArray(deds) ? deds : [] } }));
    } catch {
      setDebtsByEmp((m) => ({ ...m, [emp.id]: { loans: [], deductions: [] } }));
    } finally {
      setDebtsLoadingId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await hrService.listEmployees({ page: 1, limit: 500 });
      const list = Array.isArray(data) ? data : (data?.data || []);
      setEmployees(list);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const startEdit = (emp) => {
    setEditingId(emp.id);
    setEditValue(String(emp.salary || 0));
  };
  const cancelEdit = () => { setEditingId(null); setEditValue(''); };
  const saveEdit = async (emp) => {
    const parsed = parseFloat(editValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error(t('invalid_salary') || "Noto'g'ri summa");
      return;
    }
    setSaving(true);
    try {
      await hrService.updateEmployee(emp.id, { salary: parsed });
      toast.success(t('saved') || 'Saqlandi');
      setEditingId(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          {t('employees') || 'Xodimlar'}
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({employees.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 p-6">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            {t('no_employees') || "Xodimlar yo'q — HR modulidan xodim qo'shing"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 36 }} />
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t('full_name') || "F.I.O."}</TableHead>
                <TableHead>{t('position') || 'Lavozim'}</TableHead>
                <TableHead className="text-right">{t('monthly_salary') || 'Oylik maosh'}</TableHead>
                <TableHead className="w-40">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e, i) => {
                const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.full_name || '—';
                const position = e.job_title || e.position || e.job_position_name || '—';
                const isExpanded = expandedId === e.id;
                const debts      = debtsByEmp[e.id];
                const isLoading  = debtsLoadingId === e.id;
                return (
                  <React.Fragment key={e.id}>
                  <TableRow>
                    <TableCell className="px-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(e)}
                        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
                        title={isExpanded ? (t('hide_debts') || 'Yopish') : (t('show_debts') || "Qarzlarni ko'rish")}
                        aria-label={t('show_debts') || 'Show debts'}
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </TableCell>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell className="text-slate-600">{position}</TableCell>
                    <TableCell className="text-right">
                      {editingId === e.id ? (
                        <Input
                          type="number" min={0}
                          value={editValue}
                          onChange={(ev) => setEditValue(ev.target.value)}
                          className="w-40 text-right"
                        />
                      ) : (
                        <span className="font-medium">{formatCurrency(e.salary || 0)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === e.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => saveEdit(e)} disabled={saving}>
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : (t('save') || 'Saqlash')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>{t('cancel')}</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(e)}>
                          <Edit className="w-4 h-4 mr-1" />
                          {t('edit_salary') || 'Oylikni tahrirlash'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* Debts sub-row — same shape as the Payroll Records
                      table: active loans + pending shortage deductions
                      pulled from /employee-loans + /employees/:id/deductions. */}
                  {isExpanded && (
                    <TableRow className="bg-slate-50/50">
                      <TableCell colSpan={6} className="p-0">
                        <div className="px-6 py-4">
                          {isLoading ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('loading') || 'Yuklanmoqda...'}
                            </div>
                          ) : !debts ? null : (
                            (() => {
                              const loans = debts.loans || [];
                              const dedns = debts.deductions || [];
                              const loanTotal = loans.reduce((s, l) => s + (Number(l.remaining_amount) || 0), 0);
                              const dedTotal  = dedns.reduce((s, d) => s + (Number(d.amount) || 0), 0);
                              if (loans.length === 0 && dedns.length === 0) {
                                return (
                                  <div className="text-sm text-slate-500 italic">
                                    {t('no_debts') || "Qarzlar yo'q"}
                                  </div>
                                );
                              }
                              return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Active loans */}
                                  <div className="bg-white rounded-lg border border-slate-200 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <Wallet className="w-4 h-4 text-blue-600" />
                                        {t('active_loans') || 'Faol qarzlar'}
                                        <span className="text-[11px] font-normal text-slate-500">({loans.length})</span>
                                      </div>
                                      <div className="text-sm font-mono text-slate-900">
                                        {formatCurrency(loanTotal)}
                                      </div>
                                    </div>
                                    {loans.length === 0 ? (
                                      <div className="text-xs text-slate-400 italic">
                                        {t('no_active_loans') || "Faol qarz yo'q"}
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {loans.map((l) => (
                                          <div
                                            key={l.id}
                                            className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded bg-slate-50"
                                          >
                                            <div className="min-w-0">
                                              <div className="font-medium text-slate-800 truncate">
                                                {l.purpose || l.loan_type || (t('loan') || 'Qarz')}
                                              </div>
                                              <div className="text-[11px] text-slate-500">
                                                {(t('monthly_payment') || "Oylik to'lov")}: <span className="font-mono">{formatCurrency(l.monthly_payment || 0)}</span>
                                                {l.start_date ? ` · ${format(new Date(l.start_date), 'dd.MM.yyyy')}` : ''}
                                              </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <div className="font-mono font-semibold text-slate-900">
                                                {formatCurrency(l.remaining_amount || 0)}
                                              </div>
                                              <div className="text-[10px] text-slate-400">
                                                {t('remaining') || 'Qoldiq'}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Pending shortage deductions */}
                                  <div className="bg-white rounded-lg border border-slate-200 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <FileMinus className="w-4 h-4 text-orange-600" />
                                        {t('pending_deductions') || 'Kutayotgan ushlanmalar'}
                                        <span className="text-[11px] font-normal text-slate-500">({dedns.length})</span>
                                      </div>
                                      <div className="text-sm font-mono text-slate-900">
                                        {formatCurrency(dedTotal)}
                                      </div>
                                    </div>
                                    {dedns.length === 0 ? (
                                      <div className="text-xs text-slate-400 italic">
                                        {t('no_pending_deductions') || "Ushlanma yo'q"}
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {dedns.map((d) => (
                                          <div
                                            key={d.id}
                                            className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded bg-slate-50"
                                          >
                                            <div className="min-w-0">
                                              <div className="font-medium text-slate-800 truncate">
                                                {d.description || d.reason || d.note || (t('shortage') || 'Kamomad')}
                                              </div>
                                              <div className="text-[11px] text-slate-500">
                                                {d.created_at
                                                  ? format(new Date(d.created_at), 'dd.MM.yyyy')
                                                  : (t('pending') || 'Kutilmoqda')}
                                              </div>
                                            </div>
                                            <div className="font-mono font-semibold text-slate-900 shrink-0">
                                              {formatCurrency(d.amount || 0)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
