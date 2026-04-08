import React, { useState, useEffect, useCallback, useRef } from "react";
import { hrService } from "@/api/services/hr";
import { aiService } from "@/api/services/ai";
import apiClient from "@/api/client";
import { formatPhoneInput, parsePhoneInput } from "@/utils/formatCurrency";
import { useToast } from "@/components/ui/use-toast";
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DepartmentManagement from "@/components/hr/DepartmentManagement";
import JobPositionManagement from "@/components/hr/JobPositionManagement";
import {
  Users,
  Search,
  Plus,
  Briefcase,
  UserCheck,
  UserX,
  Brain,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Shield,
  Check,
  X as XIcon,
  Upload,
  Download,
  Printer,
  Send,
  ChevronsUpDown,
  FolderTree,
  AlertTriangle,
} from "lucide-react";

// Import universal ERP components
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  PrintPreviewModal,
  useAuditTrail,
} from '@/components/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { useModules } from "@/components/contexts/ModulesContext";
import { useCompany } from "@/components/contexts/CompanyContext";
import { useInstalledApps } from "@/components/contexts/InstalledAppsContext";
import { useEmployeePermissions, AVAILABLE_MODULES } from "@/components/contexts/EmployeePermissionsContext";
import { PERMISSION_MATRIX } from "@/config/permissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

export default function HR() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { coreModules, appModules } = useModules();
  const { isAppInstalled } = useInstalledApps();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { getEmployeePermissions, updateEmployeePermissions } = useEmployeePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { activeCompany, companies: userCompanies } = useCompany();

  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [insights, setInsights] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [isAssessingRisk, setIsAssessingRisk] = useState(false);
  const [employeeDeductions, setEmployeeDeductions] = useState([]);
  const [salaryCalc, setSalaryCalc] = useState(null);
  const [loadingDeductions, setLoadingDeductions] = useState(false);
  const { addAuditLog } = useAuditTrail('employees');
  const { toast } = useToast();

  // Export columns configuration
  const exportColumns = [
    { key: 'full_name', label: t('full_name') || "To'liq ismi" },
    { key: 'email', label: t('email') || 'Email' },
    { key: 'phone', label: t('phone') || 'Telefon' },
    { key: 'job_title', label: t('job_title') || 'Lavozimi' },
    { key: 'department', label: t('department') || "Bo'lim" },
    { key: 'hire_date', label: t('hire_date') || 'Ishga kirgan sana', render: (v) => v || '-' },
    { key: 'salary', label: t('salary') || 'Maosh', render: (v) => formatCurrency(v || 0) },
    { key: 'status', label: t('status') || 'Holat' },
    { key: 'performance_score', label: t('performance_score') || 'Samaradorlik bali' },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'full_name', label: t('full_name') || "To'liq ismi", required: true },
    { key: 'email', label: t('email') || 'Email', required: true },
    { key: 'phone', label: t('phone') || 'Telefon' },
    { key: 'job_title', label: t('job_title') || 'Lavozimi', required: true },
    { key: 'department', label: t('department') || "Bo'lim", required: true },
    { key: 'hire_date', label: t('hire_date') || 'Ishga kirgan sana' },
    { key: 'salary', label: t('salary') || 'Maosh' },
    { key: 'status', label: t('status') || 'Holat' },
    { key: 'performance_score', label: t('performance_score') || 'Samaradorlik bali' },
  ];

  const handleImport = async (data) => {
    for (const row of data) {
      const employeeData = {
        full_name: row.full_name,
        email: row.email,
        phone: row.phone || '',
        job_title: row.job_title,
        department: row.department || 'general',
        hire_date: row.hire_date || new Date().toISOString().split('T')[0],
        salary: parseFloat(row.salary) || 0,
        status: row.status || 'active',
        performance_score: row.performance_score ? parseFloat(row.performance_score) : 3,
        turnover_risk: row.turnover_risk || 'low',
      };
      hrService.createEmployee(employeeData);
    }
    addAuditLog('create', 'batch', `${data.length} employees imported`);
    loadEmployees();
  };

  const generatePrintConfig = (employee) => ({
    template: 'payslip',
    title: 'Xodim ma\'lumotlari',
    documentNumber: employee.id,
    documentDate: new Date().toLocaleDateString('uz-UZ'),
    headerFields: [
      { label: 'Xodim', value: employee.full_name },
      { label: 'Lavozim', value: employee.job_title },
      { label: "Bo'lim", value: employee.department || '-' },
      { label: 'Email', value: employee.email },
      { label: 'Telefon', value: employee.phone },
      { label: 'Ishga kirgan', value: employee.hire_date },
    ],
    tableColumns: [],
    tableData: [],
    totals: [
      { label: 'Oylik maosh', value: formatCurrency(employee.salary || 0), bold: true },
    ],
  });

  const [newEmployee, setNewEmployee] = useState({
    full_name: '',
    email: '',
    phone: '+998',
    job_title: '',
    job_position_id: '',
    role_id: '',
    department: '',
    hire_date: new Date().toISOString().split('T')[0],
    salary: '',
    status: 'active',
    performance_score: 3,
    turnover_risk: 'low',
    permission: 'important',
    organization_ids: [],
  });
  const [organizations, setOrganizations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [jobPositions, setJobPositions] = useState([]);
  const generatePassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const all = letters + digits;
    // Use crypto.getRandomValues() for cryptographically secure randomness
    const secureRandom = (max) => {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] % max;
    };
    // Ensure at least 1 letter and 1 digit
    let chars = [
      letters.charAt(secureRandom(letters.length)),
      digits.charAt(secureRandom(digits.length)),
    ];
    for (let i = 2; i < 8; i++) {
      chars.push(all.charAt(secureRandom(all.length)));
    }
    // Shuffle (Fisher-Yates with secure random)
    for (let i = chars.length - 1; i > 0; i--) {
      const j = secureRandom(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  };

  const handleSendCredentials = async (employee, method) => {
    try {
      const password = generatePassword();
      await apiClient.post('/send-credentials', {
        email: employee.email,
        password: password,
        method: method === 'phone' ? 'sms' : 'email',
        phone: employee.phone || '',
      });
      toast({
        title: t('success'),
        description: method === 'phone'
          ? (t('password_sent_to_phone') || 'Parol telefonga yuborildi')
          : (t('password_sent_to_email') || 'Parol emailga yuborildi'),
      });
    } catch (error) {
      toast({ title: t('error'), description: error.response?.data?.error?.message || t('password_send_error') || 'Parol yuborishda xatolik', variant: 'destructive' });
    }
  };

  // AI-based turnover risk assessment
  const assessTurnoverRisk = useCallback(async (employeesList) => {
    if (!employeesList || employeesList.length === 0) return employeesList;

    setIsAssessingRisk(true);
    try {
      const employeeData = employeesList.map(emp => ({
        id: emp.id,
        full_name: emp.full_name,
        department: emp.department,
        hire_date: emp.hire_date,
        performance_score: emp.performance_score,
        salary: emp.salary,
        status: emp.status,
        tenure_months: Math.floor((new Date() - new Date(emp.hire_date)) / (1000 * 60 * 60 * 24 * 30))
      }));

      const prompt = `As an HR AI analyst, assess the turnover risk for each employee based on their data.

Employee Data:
${JSON.stringify(employeeData, null, 2)}

Risk Factors to Consider:
- Low performance score (1-2) = higher risk
- Very short tenure (<6 months) or medium tenure (1-2 years) = higher risk (new hires adjusting or employees seeking growth)
- Long tenure (>5 years) with low performance = medium risk
- High performers with long tenure = low risk
- Department patterns (some departments may have higher turnover)

Return a JSON object with employee IDs and their assessed risk levels:
{ "assessments": [{ "id": "employee-uuid", "risk": "low|medium|high", "reason": "brief reason" }] }

Only return the JSON, no other text.`;

      const result = await aiService.chat(prompt, null, { type: 'hr_risk_assessment' });

      let assessments = [];
      if (result?.assessments) {
        assessments = result.assessments;
      } else if (typeof result?.message === 'string') {
        try {
          // Try to extract JSON from the response
          const jsonMatch = result.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.assessments) {
              assessments = parsed.assessments;
            }
          }
        } catch (e) {
          // Could not parse AI risk assessment response
        }
      }

      // Update employees with AI-assessed risk
      if (assessments.length > 0) {
        const updatedEmployees = employeesList.map(emp => {
          const assessment = assessments.find(a => a.id === emp.id);
          if (assessment) {
            return { ...emp, turnover_risk: assessment.risk, risk_reason: assessment.reason };
          }
          return emp;
        });
        return updatedEmployees;
      }

      return employeesList;
    } catch (error) {
      console.error("Error assessing turnover risk:", error);
      return employeesList;
    } finally {
      setIsAssessingRisk(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await hrService.listEmployees({ sort_by: 'hire_date', sort_order: 'DESC' });
      // Map backend response to frontend format
      const mapped = (data || []).map(emp => ({
        id: emp.id,
        full_name: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        email: emp.email || '',
        phone: emp.phone || '',
        job_title: emp.job_title || '',
        department_id: emp.department_id || '',
        department: emp.department || 'other',
        hire_date: emp.hire_date,
        salary: emp.salary || 0,
        status: emp.status || 'active',
        performance_score: emp.performance_score || 3,
        turnover_risk: emp.turnover_risk || 'low',
        permission: emp.permission || 'basic'
      }));

      // Run AI turnover risk assessment
      const assessedEmployees = await assessTurnoverRisk(mapped);
      setEmployees(assessedEmployees);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  }, [assessTurnoverRisk]);

  const generateInsights = useCallback(async () => {
    try {
      // Use current employees state for insights
      if (employees.length === 0) return;

      const highTurnoverRiskCount = employees.filter(e => e.turnover_risk === 'high').length;
      const avgPerformance = employees.length > 0 ? employees.reduce((sum, e) => sum + (e.performance_score || 0), 0) / employees.length : 0;

      const prompt = `You are the HR AI of Yuksalish. Analyze this workforce data and provide insights on retention, performance, and cost efficiency:
        - Total Employees: ${employees.length}
        - High Turnover Risks: ${highTurnoverRiskCount}
        - Average Performance Score: ${avgPerformance.toFixed(2)}/5
        - Department breakdown: ${JSON.stringify(employees.reduce((acc, e) => { acc[e.department] = (acc[e.department] || 0) + 1; return acc; }, {}))}

        Provide 3 actionable insights with clear recommendations. Return as JSON with format: { "insights": [{ "title": "", "description": "", "recommendation": "", "priority": "high|medium|low" }] }`;

      const insightsResult = await aiService.chat(prompt, null, { type: 'hr_analysis' });

      // Parse the response - it may be a string or already parsed
      if (insightsResult?.insights) {
        setInsights(insightsResult.insights);
      } else if (typeof insightsResult?.message === 'string') {
        try {
          const parsed = JSON.parse(insightsResult.message);
          if (parsed.insights) {
            setInsights(parsed.insights);
          }
        } catch {
          // Could not parse AI response as JSON
        }
      }
    } catch (error) {
      console.error("Error generating AI insights:", error);
    }
  }, [employees]);

  const handleAddEmployee = async () => {
    if (submittingRef.current) return;
    if (!newEmployee.full_name || !newEmployee.phone) {
      toast({
        title: t('error') || 'Xato',
        description: t('required_fields_error') || "Ism va telefon to'ldirilishi shart",
        variant: 'destructive',
      });
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      // Backend auto-creates user account when employee is created
      const employeeData = {
        full_name: newEmployee.full_name,
        email: newEmployee.email || '',
        phone: newEmployee.phone || '',
        job_title: newEmployee.job_title,
        department: newEmployee.department,
        hire_date: newEmployee.hire_date,
        salary: parseFloat(newEmployee.salary) || 0,
        status: newEmployee.status,
        performance_score: parseFloat(newEmployee.performance_score) || 3,
        turnover_risk: newEmployee.turnover_risk,
        permission: newEmployee.permission
      };

      const createdEmployee = await hrService.createEmployee(employeeData);

      // Assign to selected organizations
      if (newEmployee.organization_ids.length > 0 && createdEmployee?.id) {
        for (let i = 0; i < newEmployee.organization_ids.length; i++) {
          try {
            await apiClient.post('/employee-organizations', {
              employee_id: createdEmployee.id,
              organization_id: newEmployee.organization_ids[i],
              is_primary: i === 0,
            });
          } catch (orgErr) {
            console.error("Error assigning organization:", orgErr);
          }
        }
      }

      toast({
        title: t('success') || 'Muvaffaqiyatli',
        description: t('employee_created_success') || 'Xodim va foydalanuvchi hisobi yaratildi.',
      });

      setShowAddModal(false);
      setNewEmployee({
        full_name: '', email: '', phone: '+998', job_title: '',
        job_position_id: '', role_id: '',
        department: '', hire_date: new Date().toISOString().split('T')[0],
        salary: '', status: 'active', performance_score: 3,
        turnover_risk: 'low', permission: 'important', organization_ids: activeCompany?.id ? [activeCompany.id] : []
      });
      await loadEmployees();
    } catch (error) {
      console.error("Error adding employee:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || error.response?.data?.message || error.message || "Xodim qo'shishda xatolik yuz berdi",
        variant: 'destructive',
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleViewEmployee = async (employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
    // Load deductions and salary calculation
    setLoadingDeductions(true);
    try {
      const [deductions, salary] = await Promise.all([
        hrService.listEmployeeDeductions(employee.id).catch(() => []),
        hrService.calculateSalary(employee.id).catch(() => null),
      ]);
      setEmployeeDeductions(deductions || []);
      setSalaryCalc(salary);
    } catch (err) {
      console.error('Error loading deductions:', err);
    } finally {
      setLoadingDeductions(false);
    }
  };

  const handleCancelDeduction = async (employeeId, deductionId) => {
    const reason = prompt("Bekor qilish sababi:");
    if (!reason) return;
    try {
      await hrService.cancelDeduction(employeeId, deductionId, { reason });
      // Refresh
      const deductions = await hrService.listEmployeeDeductions(employeeId).catch(() => []);
      setEmployeeDeductions(deductions || []);
      const salary = await hrService.calculateSalary(employeeId).catch(() => null);
      setSalaryCalc(salary);
      toast({ title: "Kamomad bekor qilindi" });
    } catch (err) {
      toast({ title: "Xatolik", description: err.response?.data?.message || 'Xatolik yuz berdi', variant: 'destructive' });
    }
  };

  const handleEditEmployee = async (employee) => {
    let phone = employee.phone || '+998';
    if (phone && !phone.startsWith('+')) {
      phone = phone.startsWith('998') ? '+' + phone : '+998' + phone;
    }
    setSelectedEmployee({
      ...employee,
      phone,
      salary: employee.salary || '',
      organization_ids: [],
      _orig_org_ids: []
    });
    setShowEditModal(true);
    // Load employee's current organizations
    try {
      const res = await apiClient.get(`/employees/${employee.id}/organizations`);
      const orgs = res.data?.data || res.data || [];
      const orgIds = orgs.map(o => o.organization_id);
      setSelectedEmployee(prev => prev ? ({
        ...prev,
        organization_ids: orgIds,
        _orig_org_ids: orgIds,
        _org_assignments: orgs
      }) : prev);
    } catch {}
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    setIsSubmitting(true);
    try {
      const employeeData = {
        full_name: selectedEmployee.full_name,
        email: selectedEmployee.email || '',
        phone: selectedEmployee.phone || '',
        job_title: selectedEmployee.job_title,
        department: selectedEmployee.department,
        hire_date: selectedEmployee.hire_date,
        salary: parseFloat(selectedEmployee.salary) || 0,
        status: selectedEmployee.status,
        performance_score: parseFloat(selectedEmployee.performance_score) || 3,
        turnover_risk: selectedEmployee.turnover_risk,
        permission: selectedEmployee.permission
      };

      await hrService.updateEmployee(selectedEmployee.id, employeeData);

      // Handle organization assignments
      const currentIds = selectedEmployee.organization_ids || [];
      const origIds = selectedEmployee._orig_org_ids || [];
      const assignments = selectedEmployee._org_assignments || [];

      // Remove orgs that were unchecked
      for (const a of assignments) {
        if (!currentIds.includes(a.organization_id)) {
          await apiClient.delete(`/employee-organizations/${a.id}`).catch(() => {});
        }
      }
      // Add orgs that were newly checked
      for (let i = 0; i < currentIds.length; i++) {
        if (!origIds.includes(currentIds[i])) {
          await apiClient.post('/employee-organizations', {
            employee_id: selectedEmployee.id,
            organization_id: currentIds[i],
            is_primary: currentIds.length === 1 || (i === 0 && assignments.length === 0),
          }).catch(() => {});
        }
      }

      // Assign role if changed (auto-applies permissions)
      if (selectedEmployee.job_title) {
        const selectedRole = roles.find(r => r.name === selectedEmployee.job_title);
        if (selectedRole) {
          try {
            await apiClient.post(`/roles/${selectedRole.id}/assign`, {
              employee_id: selectedEmployee.id,
            });
          } catch (roleErr) {
            console.error("Error assigning role:", roleErr);
          }
        }
      }

      setShowEditModal(false);
      setSelectedEmployee(null);
      await loadEmployees();
    } catch (error) {
      console.error("Error updating employee:", error);
      toast.error("Failed to update employee: " + (error.response?.data?.error?.message || error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (employee) => {
    setSelectedEmployee(employee);
    setShowDeleteDialog(true);
  };


  // Local state for editing permissions before saving
  const [editingPermissions, setEditingPermissions] = useState({});
  const [permissionsSaved, setPermissionsSaved] = useState(false);
  const [employeeRoleInfo, setEmployeeRoleInfo] = useState({ role_id: null, role_name: '' });
  const permSavedTimeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (permSavedTimeoutRef.current) clearTimeout(permSavedTimeoutRef.current); };
  }, []);

  // Get default permissions based on employee permission level
  const getDefaultPermissionsForLevel = useCallback((permissionLevel) => {
    const modules = {};

    // Get all available modules
    const availableModules = [];
    coreModules.forEach(m => {
      if (!m.adminOnly) availableModules.push(m);
    });
    appModules.forEach(m => {
      if (isAppInstalled(m.appId)) availableModules.push(m);
    });
    const adminModule = coreModules.find(m => m.adminOnly);
    if (adminModule) availableModules.push(adminModule);

    // Map module IDs to permission module keys
    const moduleIdMapping = {
      'dashboard': 'dashboard',
      'inventory': 'inventory',
      'customers': 'customers',
      'vendors': 'vendors',
      'sales': 'sales',
      'purchases': 'purchases',
      'financials': 'financials',
      'hr': 'hr',
      'contracts': 'contracts',
      'projects': 'projects',
      'reports': 'reports',
      'settings': 'settings',
      'company': 'company',
      'admin': 'admin'
    };

    // Build permissions object based on permission level
    availableModules.forEach(module => {
      const moduleKey = moduleIdMapping[module.id];
      if (moduleKey && PERMISSION_MATRIX[permissionLevel]?.[moduleKey]) {
        const ops = PERMISSION_MATRIX[permissionLevel][moduleKey];
        modules[module.id] = {
          create: ops.includes('create'),
          read: ops.includes('read'),
          update: ops.includes('update'),
          delete: ops.includes('delete')
        };
      }
    });

    return modules;
  }, [coreModules, appModules, isAppInstalled]);

  const handleManagePermissions = async (employee) => {
    try {
      setSelectedEmployee(employee);
      setEditingPermissions({});
      setPermissionsSaved(false);
      setEmployeeRoleInfo({ role_id: null, role_name: '' });
      setShowPermissionsModal(true);

      // Load current permissions from backend (with role info)
      const result = await getEmployeePermissions(employee.id, { withRoleInfo: true });
      const currentPerms = result.permissions || {};
      setEmployeeRoleInfo({ role_id: result.role_id, role_name: result.role_name });

      // If no permissions set yet, initialize based on employee's permission level
      if (Object.keys(currentPerms).length === 0 && employee.permission) {
        const defaultPerms = getDefaultPermissionsForLevel(employee.permission);
        setEditingPermissions(defaultPerms);
      } else {
        setEditingPermissions(currentPerms);
      }
    } catch (error) {
      console.error('Error opening permissions modal:', error);
      setSelectedEmployee(employee);
      setEditingPermissions({});
      setPermissionsSaved(false);
      setEmployeeRoleInfo({ role_id: null, role_name: '' });
      setShowPermissionsModal(true);
    }
  };

  // Get available modules (only modules visible in sidebar)
  const getAvailableModules = useCallback(() => {
    // Use AVAILABLE_MODULES from EmployeePermissionsContext as the source of truth
    // Filter to show only installed app modules - exclude core modules (dashboard, ai_assistant, settings)
    // as they are always accessible and shouldn't have permissions managed
    const modules = AVAILABLE_MODULES.filter(m => {
      // Skip core modules - they are always accessible without permissions
      if (m.isCore) return false;
      // App modules should be installed - use appId for installation check
      return isAppInstalled(m.appId || m.id);
    }).map(m => ({
      id: m.id,        // This is the permission module ID (matches MODULES constant)
      nameKey: m.nameKey,
      isCore: false,
      adminOnly: false
    }));

    return modules;
  }, [isAppInstalled]);

  // Handle toggle for individual CRUD permission (local state only)
  const handlePermissionToggle = (moduleId, permType) => {
    setEditingPermissions(prev => {
      const modulePerms = prev[moduleId] || { create: false, read: false, update: false, delete: false };
      return {
        ...prev,
        [moduleId]: {
          ...modulePerms,
          [permType]: !modulePerms[permType]
        }
      };
    });
    setPermissionsSaved(false);
  };

  // Handle toggle for full module access (local state only)
  const handleFullAccessToggle = (moduleId) => {
    setEditingPermissions(prev => {
      const modulePerms = prev[moduleId] || { create: false, read: false, update: false, delete: false };
      const hasFullAccess = modulePerms.create && modulePerms.read && modulePerms.update && modulePerms.delete;
      return {
        ...prev,
        [moduleId]: {
          create: !hasFullAccess,
          read: !hasFullAccess,
          update: !hasFullAccess,
          delete: !hasFullAccess
        }
      };
    });
    setPermissionsSaved(false);
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedEmployee) return;
    setIsSubmitting(true);
    try {
      const success = await updateEmployeePermissions(selectedEmployee.id, editingPermissions);
      if (success) {
        setPermissionsSaved(true);
        if (permSavedTimeoutRef.current) clearTimeout(permSavedTimeoutRef.current);
        permSavedTimeoutRef.current = setTimeout(() => setPermissionsSaved(false), 2000);
        toast({
          title: t('success') || 'Success',
          description: t('permissions_saved') || 'Permissions saved successfully',
        });
      } else {
        toast({
          title: t('error') || 'Error',
          description: t('error_saving_permissions') || 'Failed to save permissions',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: t('error') || 'Error',
        description: error.message || t('error_saving_permissions') || 'Failed to save permissions',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grant all permissions
  const handleGrantAllPermissions = () => {
    const allPerms = {};
    getAvailableModules().forEach(m => {
      allPerms[m.id] = { create: true, read: true, update: true, delete: true };
    });
    setEditingPermissions(allPerms);
    setPermissionsSaved(false);
  };

  // Revoke all permissions
  const handleRevokeAllPermissions = () => {
    setEditingPermissions({});
    setPermissionsSaved(false);
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    setIsSubmitting(true);
    try {
      await hrService.deleteEmployee(selectedEmployee.id);

      toast({
        title: t('success') || 'Muvaffaqiyatli',
        description: t('employee_deleted') || "Xodim o'chirildi",
      });

      setShowDeleteDialog(false);
      setSelectedEmployee(null);
      await loadEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || error.message || t('delete_employee_error') || "Xodimni o'chirishda xatolik",
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshDepartments = useCallback(() => {
    apiClient.get('/departments').then(res => {
      setDepartments(res.data?.data || res.data || []);
    }).catch(() => {});
  }, []);

  const refreshJobPositions = useCallback(() => {
    apiClient.get('/job-positions').then(res => {
      setJobPositions(res.data?.data || res.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadEmployees();
    // Load organizations for company assignment
    apiClient.get('/organizations').then(res => {
      setOrganizations(res.data?.data || res.data || []);
    }).catch(() => {});
    // Load departments
    refreshDepartments();
    // Load roles
    apiClient.get('/roles').then(res => {
      setRoles(res.data?.data || res.data || []);
    }).catch(() => {});
    // Load job positions
    refreshJobPositions();
  }, [loadEmployees]);

  // Generate insights when employees data changes
  useEffect(() => {
    if (employees.length > 0) {
      generateInsights();
    }
  }, [employees.length]);

  useEffect(() => {
    let filtered = employees;
    if (searchQuery) {
      filtered = filtered.filter(e => e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || e.job_title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (departmentFilter !== "all") {
      const selectedDept = departments.find(d => d.id === departmentFilter);
      const selectedDeptName = selectedDept?.name?.toLowerCase() || '';
      filtered = filtered.filter(e =>
        e.department_id === departmentFilter ||
        (selectedDeptName && (e.department || '').toLowerCase() === selectedDeptName)
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    setFilteredEmployees(filtered);
  }, [employees, searchQuery, departmentFilter, statusFilter]);
  
  const metrics = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter(e => e.status === 'active').length,
    totalSalaries: employees.filter(e => e.status === 'active').reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0),
  };

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <Card className="bg-white border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 mb-1">{t('total_employees')}</p>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{metrics.totalEmployees}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 mb-1">{t('active_employees')}</p>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{metrics.activeEmployees}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 mb-1">{t('total_salaries') || 'Total Salaries'}</p>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{formatCurrencyCompact(metrics.totalSalaries)}</p>
                </div>
                <div className="bg-emerald-100 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm p-1 md:p-2 rounded-xl border border-slate-200/60 shadow-lg">
            <TabsTrigger
              value="employees"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('employees') || 'Employees'}</span>
              <span className="sm:hidden">{t('employees') || 'Employees'}</span>
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <FolderTree className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('departments') || 'Departments'}</span>
              <span className="sm:hidden">{t('departments') || 'Departments'}</span>
            </TabsTrigger>
            <TabsTrigger
              value="job_positions"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Briefcase className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('job_positions') || 'Job Positions'}</span>
              <span className="sm:hidden">{t('job_positions') || 'Job Positions'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-6 mt-6">

        {/* Filters and Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Input placeholder={t('search_employees_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t('all_departments')}/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_departments')}</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t('all_statuses')}/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_statuses')}</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="on_leave">{t('on_leave')}</SelectItem>
                  <SelectItem value="terminated">{t('terminated')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                {canCreate(MODULES.HR) && (
                  <Button
                    onClick={() => {
                      if (activeCompany?.id) {
                        setNewEmployee(prev => ({...prev, organization_ids: [activeCompany.id]}));
                      }
                      setShowAddModal(true);
                    }}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_employee') || 'Xodim qo\'shish'}
                  </Button>
                )}
                <ImportExportButtons
                  onImport={() => setShowImportModal(true)}
                  onExport={() => setShowExportModal(true)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Directory */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader><CardTitle>{t('employee_directory_title')}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table_header_employee')}</TableHead>
                  <TableHead>{t('table_header_department')}</TableHead>
                  <TableHead>{t('table_header_hire_date')}</TableHead>
                  <TableHead>{t('table_header_status')}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{e.full_name}</p>
                        <p className="text-sm text-slate-500">{e.job_title}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{e.department || '-'}</Badge></TableCell>
                    <TableCell>{new Date(e.hire_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={
                        e.status === 'active' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' :
                        e.status === 'on_leave' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' :
                        e.status === 'terminated' ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' :
                        ''
                      } variant="outline">
                        {t(e.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewEmployee(e)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('view') || 'View Details'}
                          </DropdownMenuItem>
                          {e.status !== 'terminated' && canUpdate(MODULES.HR) && (
                            <DropdownMenuItem onClick={() => handleEditEmployee(e)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {t('edit') || 'Edit'}
                            </DropdownMenuItem>
                          )}
                          {e.status !== 'terminated' && canUpdate(MODULES.HR) && (
                            <DropdownMenuItem onClick={() => handleManagePermissions(e)}>
                              <Shield className="mr-2 h-4 w-4" />
                              {t('manage_permissions') || 'Manage Permissions'}
                            </DropdownMenuItem>
                          )}
                          {e.status !== 'terminated' && e.email && (
                            <DropdownMenuItem onClick={() => handleSendCredentials(e, 'email')}>
                              <Mail className="mr-2 h-4 w-4" />
                              {t('send_email') || 'Send email'}
                            </DropdownMenuItem>
                          )}
                          {e.status !== 'terminated' && e.phone && (
                            <DropdownMenuItem onClick={() => handleSendCredentials(e, 'phone')}>
                              <Send className="mr-2 h-4 w-4" />
                              {t('send_sms') || 'Send SMS'}
                            </DropdownMenuItem>
                          )}
                          {canDelete(MODULES.HR) && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(e)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('delete') || 'Delete'}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* AI HR Insights - Moved to bottom */}
        {insights && insights.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
              <h3 className="text-xl font-bold text-[var(--genix-navy)]">{t('ai_hr_insights')}</h3>
              <Badge className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)]">{t('ai_powered')}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {insights.map((insight, index) => (
                <Card key={index} className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base">{insight.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-600">{insight.description}</p>
                    <div className="p-3 bg-[var(--genix-light-blue)]/30 rounded-lg">
                      <p className="text-sm font-medium text-[var(--genix-blue)]">
                        💡 {insight.recommendation}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Add Employee Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('add_employee')}</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[70vh] pr-1">
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">{t('full_name')} *</Label>
                  <Input
                    value={newEmployee.full_name}
                    onChange={e => setNewEmployee({...newEmployee, full_name: e.target.value})}
                    placeholder={t('enter_full_name')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('email')}</Label>
                  <Input
                    value={newEmployee.email}
                    onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                    placeholder={t('enter_email')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('phone')} *</Label>
                  <Input
                    value={formatPhoneInput(newEmployee.phone)}
                    onChange={e => setNewEmployee({...newEmployee, phone: parsePhoneInput(e.target.value)})}
                    placeholder="+998 XX XXX XXXX"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('job_position') || 'Job Position'}</Label>
                  <Select
                    value={newEmployee.job_position_id}
                    onValueChange={value => setNewEmployee({...newEmployee, job_position_id: value})}
                  >
                    <SelectTrigger><SelectValue placeholder={t('select_job_position') || 'Select position'} /></SelectTrigger>
                    <SelectContent>
                      {jobPositions.map(jp => (
                        <SelectItem key={jp.id} value={jp.id}>{jp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('department')}</Label>
                  <Select
                    value={newEmployee.department}
                    onValueChange={value => setNewEmployee({...newEmployee, department: value})}
                  >
                    <SelectTrigger><SelectValue placeholder={t('select_department') || 'Select dept'} /></SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('hire_date')}</Label>
                  <Input
                    type="date"
                    value={newEmployee.hire_date}
                    onChange={e => setNewEmployee({...newEmployee, hire_date: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('salary')}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={formatPriceInput(newEmployee.salary)}
                    onChange={e => setNewEmployee({...newEmployee, salary: parsePriceInput(e.target.value)})}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('status')}</Label>
                  <Select
                    value={newEmployee.status}
                    onValueChange={value => setNewEmployee({...newEmployee, status: value})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('active')}</SelectItem>
                      <SelectItem value="on_leave">{t('on_leave')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {userCompanies.length > 0 && (
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">{t('companies') || 'Kompaniyalar'}</Label>
                    {userCompanies.length === 1 ? (
                      <Input value={userCompanies[0].company_name || userCompanies[0].name} disabled className="bg-slate-50" />
                    ) : (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal">
                              <span className="truncate">
                                {newEmployee.organization_ids.length > 0
                                  ? userCompanies.filter(o => newEmployee.organization_ids.includes(o.id)).map(o => o.company_name || o.name).join(', ')
                                  : (t('select_companies') || 'Kompaniyalarni tanlang')}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
                            <div className="max-h-36 overflow-y-auto">
                              {userCompanies.map(org => (
                                <label key={org.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={newEmployee.organization_ids.includes(org.id)}
                                    onChange={(e) => {
                                      const ids = e.target.checked
                                        ? [...newEmployee.organization_ids, org.id]
                                        : newEmployee.organization_ids.filter(id => id !== org.id);
                                      setNewEmployee({...newEmployee, organization_ids: ids});
                                    }}
                                    className="rounded border-slate-300"
                                  />
                                  <span className="text-sm">{org.company_name || org.name}</span>
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleAddEmployee}
                disabled={isSubmitting || !newEmployee.full_name || !newEmployee.phone}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                {isSubmitting ? t('saving') : t('add_employee')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Employee Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('employee_details') || 'Employee Details'}</DialogTitle>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {selectedEmployee.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{selectedEmployee.full_name}</h3>
                    <p className="text-slate-500">{selectedEmployee.job_title}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Mail className="w-4 h-4" />
                      {t('email') || 'Email'}
                    </div>
                    <p className="font-medium">{selectedEmployee.email || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Phone className="w-4 h-4" />
                      {t('phone') || 'Phone'}
                    </div>
                    <p className="font-medium">{selectedEmployee.phone ? formatPhoneInput(selectedEmployee.phone.startsWith('+') ? selectedEmployee.phone : (selectedEmployee.phone.startsWith('998') ? '+' + selectedEmployee.phone : '+998' + selectedEmployee.phone)) : '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Briefcase className="w-4 h-4" />
                      {t('department') || 'Department'}
                    </div>
                    <Badge variant="outline">{departments.find(d => d.id === selectedEmployee.department_id || d.id === selectedEmployee.department)?.name || selectedEmployee.department || '-'}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Calendar className="w-4 h-4" />
                      {t('hire_date') || 'Hire Date'}
                    </div>
                    <p className="font-medium">{new Date(selectedEmployee.hire_date).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <DollarSign className="w-4 h-4" />
                      {t('salary') || 'Salary'}
                    </div>
                    <p className="font-medium">{formatCurrency(parseFloat(selectedEmployee.salary || 0))}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-500 text-sm">{t('status') || 'Status'}</div>
                    <Badge>{t(selectedEmployee.status)}</Badge>
                  </div>
                </div>

                {/* Deductions Section */}
                {!loadingDeductions && employeeDeductions.length > 0 && (
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-semibold text-sm text-orange-700 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Kamomadlar ({employeeDeductions.filter(d => d.status === 'pending').length} kutilmoqda)
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {employeeDeductions.map(d => (
                        <div key={d.id} className={`flex items-center justify-between p-2 rounded text-sm ${
                          d.status === 'pending' ? 'bg-orange-50 border border-orange-200' :
                          d.status === 'deducted' ? 'bg-green-50 border border-green-200' :
                          d.status === 'cancelled' ? 'bg-gray-50 border border-gray-200 opacity-60' :
                          'bg-slate-50'
                        }`}>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{d.reason}</p>
                            <p className="text-xs text-slate-500">
                              {d.status === 'pending' ? 'Kutilmoqda' :
                               d.status === 'deducted' ? 'Ushlab olingan' :
                               d.status === 'cancelled' ? 'Bekor qilingan' : d.status}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="font-semibold text-red-600 whitespace-nowrap">
                              -{formatCurrency(d.amount)}
                            </span>
                            {d.status === 'pending' && canUpdate(MODULES.HR) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                onClick={() => handleCancelDeduction(selectedEmployee.id, d.id)}
                              >
                                <XIcon className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {salaryCalc && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Asosiy maosh:</span>
                          <span className="font-medium">{formatCurrency(salaryCalc.base_salary)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Kamomadlar:</span>
                          <span className="font-medium">-{formatCurrency(salaryCalc.total_deduction)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t pt-1">
                          <span>To'lanadigan:</span>
                          <span className="text-green-700">{formatCurrency(salaryCalc.net_salary)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowViewModal(false)}>
                    {t('close') || 'Close'}
                  </Button>
                  {canUpdate(MODULES.HR) && (
                    <Button
                      onClick={() => {
                        setShowViewModal(false);
                        handleEditEmployee(selectedEmployee);
                      }}
                      className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      {t('edit') || 'Edit'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Employee Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('edit_employee') || 'Edit Employee'}</DialogTitle>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('full_name')} *</Label>
                  <Input
                    value={selectedEmployee.full_name}
                    onChange={e => setSelectedEmployee({...selectedEmployee, full_name: e.target.value})}
                    placeholder={t('enter_full_name')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('email')}</Label>
                    <Input
                      value={selectedEmployee.email}
                      onChange={e => setSelectedEmployee({...selectedEmployee, email: e.target.value})}
                      placeholder={t('enter_email')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('phone')}</Label>
                    <Input
                      value={formatPhoneInput(selectedEmployee.phone)}
                      onChange={e => setSelectedEmployee({...selectedEmployee, phone: parsePhoneInput(e.target.value)})}
                      placeholder="+998 XX XXX XXXX"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('department')}</Label>
                    <Select
                      value={selectedEmployee.department_id || selectedEmployee.department || ''}
                      onValueChange={value => setSelectedEmployee({...selectedEmployee, department: value, department_id: value})}
                    >
                      <SelectTrigger><SelectValue placeholder={t('select_department') || "Bo'limni tanlang"} /></SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('hire_date')}</Label>
                    <Input
                      type="date"
                      value={selectedEmployee.hire_date?.split('T')[0]}
                      onChange={e => setSelectedEmployee({...selectedEmployee, hire_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('salary')}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formatPriceInput(selectedEmployee.salary)}
                      onChange={e => setSelectedEmployee({...selectedEmployee, salary: parsePriceInput(e.target.value)})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('status')}</Label>
                    <Select
                      value={selectedEmployee.status}
                      onValueChange={value => setSelectedEmployee({...selectedEmployee, status: value})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('active')}</SelectItem>
                        <SelectItem value="on_leave">{t('on_leave')}</SelectItem>
                        <SelectItem value="terminated">{t('terminated')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {userCompanies.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('companies') || 'Kompaniyalar'}</Label>
                    {userCompanies.length === 1 ? (
                      <Input value={userCompanies[0].company_name || userCompanies[0].name} disabled className="bg-slate-50" />
                    ) : (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal h-auto min-h-[40px]">
                              <span className="truncate">
                                {(selectedEmployee.organization_ids || []).length === 0
                                  ? (t('select_companies') || 'Kompaniyalarni tanlang')
                                  : userCompanies.filter(o => (selectedEmployee.organization_ids || []).includes(o.id)).map(o => o.company_name || o.name).join(', ')}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
                            <div className="max-h-48 overflow-y-auto">
                              {userCompanies.map(org => (
                                <label key={org.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={(selectedEmployee.organization_ids || []).includes(org.id)}
                                    onChange={(e) => {
                                      const ids = e.target.checked
                                        ? [...(selectedEmployee.organization_ids || []), org.id]
                                        : (selectedEmployee.organization_ids || []).filter(id => id !== org.id);
                                      setSelectedEmployee({...selectedEmployee, organization_ids: ids});
                                    }}
                                    className="rounded border-slate-300"
                                  />
                                  <span className="text-sm">{org.company_name || org.name}</span>
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        {(selectedEmployee.organization_ids || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {userCompanies.filter(o => (selectedEmployee.organization_ids || []).includes(o.id)).map(org => (
                              <span key={org.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
                                {org.company_name || org.name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ids = (selectedEmployee.organization_ids || []).filter(id => id !== org.id);
                                    setSelectedEmployee({...selectedEmployee, organization_ids: ids});
                                  }}
                                  className="ml-0.5 hover:text-blue-900 font-bold"
                                >×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowEditModal(false)}>
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateEmployee}
                    disabled={isSubmitting || !selectedEmployee.full_name}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  >
                    {isSubmitting ? t('saving') : (t('save_changes') || 'Save Changes')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('delete_employee') || 'Delete Employee'}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_employee_confirm') || `Are you sure you want to delete ${selectedEmployee?.full_name}? This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteEmployee}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? t('deleting') || 'Deleting...' : t('delete') || 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Permissions Management Modal */}
        <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-purple)] to-[var(--genix-blue)] rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-xl">{t('manage_permissions') || 'Manage Permissions'}</span>
                    <p className="text-sm font-normal text-slate-500 mt-0.5">
                      {selectedEmployee?.full_name} - {selectedEmployee?.job_title}
                      {employeeRoleInfo.role_name && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {t('role')}: {employeeRoleInfo.role_name}
                        </span>
                      )}
                    </p>
                  </div>
                </DialogTitle>
              </div>
            </DialogHeader>
            {selectedEmployee && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Role sync warning */}
                {employeeRoleInfo.role_name && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mx-1 mt-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {t('role_sync_warning') || `Bu xodim "${employeeRoleInfo.role_name}" roliga ega. Ruxsatlarni o'zgartirish shu roldagi barcha xodimlarga ta'sir qiladi.`}
                    </span>
                  </div>
                )}
                {/* Quick Actions Bar */}
                <div className="flex items-center justify-between py-4 bg-gradient-to-r from-slate-50 to-white px-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGrantAllPermissions}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      {t('grant_all') || 'Grant All'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRevokeAllPermissions}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XIcon className="w-4 h-4 mr-1" />
                      {t('revoke_all') || 'Revoke All'}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> {t('create') || 'Create'}</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> {t('read') || 'Read'}</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> {t('update') || 'Update'}</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> {t('delete') || 'Delete'}</span>
                  </div>
                </div>

                {/* Permissions Table */}
                <div className="flex-1 overflow-auto border rounded-xl shadow-sm">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2">
                        <TableHead className="font-semibold text-slate-700 py-4">{t('module') || 'Module'}</TableHead>
                        <TableHead className="text-center w-28 font-semibold text-slate-700">{t('full_access') || 'Full Access'}</TableHead>
                        <TableHead className="text-center w-16">
                          <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center font-bold text-sm">C</div>
                        </TableHead>
                        <TableHead className="text-center w-16">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center font-bold text-sm">R</div>
                        </TableHead>
                        <TableHead className="text-center w-16">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center font-bold text-sm">U</div>
                        </TableHead>
                        <TableHead className="text-center w-16">
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center font-bold text-sm">D</div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getAvailableModules().map((module, index) => {
                        const perms = editingPermissions[module.id] || { create: false, read: false, update: false, delete: false };
                        const hasFullAccess = perms.create && perms.read && perms.update && perms.delete;
                        const hasAnyAccess = perms.create || perms.read || perms.update || perms.delete;

                        return (
                          <TableRow
                            key={module.id}
                            className={`transition-colors ${hasAnyAccess ? 'bg-green-50/30' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}
                          >
                            <TableCell className="py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                  module.isCore ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                  {module.isCore ? <Shield className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </div>
                                <div>
                                  <span className="font-medium text-slate-800">{t(module.nameKey) || module.nameKey}</span>
                                  <Badge
                                    variant="outline"
                                    className={`ml-2 text-[10px] px-1.5 py-0 ${
                                      module.isCore ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                      module.adminOnly ? 'bg-red-50 text-red-600 border-red-200' :
                                      'bg-blue-50 text-blue-600 border-blue-200'
                                    }`}
                                  >
                                    {module.isCore ? t('core') || 'Core' : module.adminOnly ? t('admin') || 'Admin' : t('app') || 'App'}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={hasFullAccess}
                                onCheckedChange={() => handleFullAccessToggle(module.id)}
                                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.id, 'create')}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                  perms.create
                                    ? 'bg-green-500 text-white shadow-md shadow-green-200 scale-105'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {perms.create ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                              </button>
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.id, 'read')}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                  perms.read
                                    ? 'bg-blue-500 text-white shadow-md shadow-blue-200 scale-105'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {perms.read ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                              </button>
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.id, 'update')}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                  perms.update
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-200 scale-105'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {perms.update ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                              </button>
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.id, 'delete')}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                  perms.delete
                                    ? 'bg-red-500 text-white shadow-md shadow-red-200 scale-105'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {perms.delete ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer with Save Button */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t bg-white">
                  <p className="text-xs text-slate-500">
                    {getAvailableModules().length} {t('modules_available') || 'modules available'}
                  </p>
                  <div className="flex items-center gap-3">
                    {permissionsSaved && (
                      <span className="text-sm text-green-600 flex items-center gap-1 animate-pulse">
                        <Check className="w-4 h-4" /> {t('permissions_saved') || 'Saved!'}
                      </span>
                    )}
                    <Button variant="outline" onClick={() => setShowPermissionsModal(false)}>
                      {t('cancel') || 'Cancel'}
                    </Button>
                    <Button
                      onClick={handleSavePermissions}
                      className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 px-6"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {t('save_permissions') || 'Save Permissions'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Import Modal */}
        <ImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
          columns={importColumns}
          entityName={t('employees') || 'Xodimlar'}
        />

        {/* Export Modal */}
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          data={filteredEmployees}
          columns={exportColumns}
          entityName={t('employees') || 'Xodimlar'}
          title={t('employees_list') || "Xodimlar ro'yxati"}
        />

        {/* Print Preview Modal */}
        {selectedEmployee && showPrintPreview && (
          <PrintPreviewModal
            open={showPrintPreview}
            onClose={() => {
              setShowPrintPreview(false);
            }}
            config={generatePrintConfig(selectedEmployee)}
            filename={`employee_${selectedEmployee.id}`}
          />
        )}
          </TabsContent>

          <TabsContent value="departments">
            <DepartmentManagement departments={departments} onRefresh={refreshDepartments} />
          </TabsContent>

          <TabsContent value="job_positions">
            <JobPositionManagement jobPositions={jobPositions} onRefresh={refreshJobPositions} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}