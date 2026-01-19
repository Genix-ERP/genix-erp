import React, { useState, useEffect, useCallback } from "react";
import { hrService } from "@/api/services/hr";
import { aiService } from "@/api/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Users,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  Briefcase,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { useModules } from "@/components/contexts/ModulesContext";
import { useInstalledApps } from "@/components/contexts/InstalledAppsContext";
import { PERMISSION_MATRIX } from "@/config/permissions";

export default function HR() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { coreModules, appModules, getEmployeePermissions, setEmployeePermissions } = useModules();
  const { isAppInstalled } = useInstalledApps();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

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
  const [isAssessingRisk, setIsAssessingRisk] = useState(false);
  const { addAuditLog } = useAuditTrail('employees');

  // Export columns configuration
  const exportColumns = [
    { key: 'full_name', label: t('full_name') || "To'liq ismi" },
    { key: 'email', label: t('email') || 'Email' },
    { key: 'phone', label: t('phone') || 'Telefon' },
    { key: 'job_title', label: t('job_title') || 'Lavozimi' },
    { key: 'department', label: t('department') || "Bo'lim" },
    { key: 'hire_date', label: t('hire_date') || 'Ishga kirgan sana', render: (v) => v || '-' },
    { key: 'salary', label: t('salary') || 'Maosh', render: (v) => `${(v || 0).toLocaleString()} UZS` },
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
      { label: "Bo'lim", value: getDepartmentName(employee.department) },
      { label: 'Email', value: employee.email },
      { label: 'Telefon', value: employee.phone },
      { label: 'Ishga kirgan', value: employee.hire_date },
    ],
    tableColumns: [],
    tableData: [],
    totals: [
      { label: 'Oylik maosh', value: `${(employee.salary || 0).toLocaleString()} UZS`, bold: true },
    ],
  });

  const [newEmployee, setNewEmployee] = useState({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    department: 'engineering',
    hire_date: new Date().toISOString().split('T')[0],
    salary: '',
    status: 'active',
    performance_score: 3,
    turnover_risk: 'low',
    permission: 'basic'
  });

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
          console.log("Could not parse AI risk assessment response");
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

      const prompt = `You are the HR AI of Genix. Analyze this workforce data and provide insights on retention, performance, and cost efficiency:
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
          console.log("Could not parse AI response as JSON");
        }
      }
    } catch (error) {
      console.error("Error generating AI insights:", error);
    }
  }, [employees]);

  const handleAddEmployee = async () => {
    if (!newEmployee.full_name || !newEmployee.job_title) {
      console.log("Validation failed: full_name or job_title is missing");
      return;
    }

    setIsSubmitting(true);
    try {
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

      console.log("Creating employee with data:", employeeData);
      await hrService.createEmployee(employeeData);
      console.log("Employee created successfully");

      setShowAddModal(false);
      setNewEmployee({
        full_name: '',
        email: '',
        phone: '',
        job_title: '',
        department: 'engineering',
        hire_date: new Date().toISOString().split('T')[0],
        salary: '',
        status: 'active',
        performance_score: 3,
        turnover_risk: 'low',
        permission: 'basic'
      });
      await loadEmployees();
    } catch (error) {
      console.error("Error adding employee:", error);
      alert("Failed to add employee: " + (error.response?.data?.error?.message || error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee({
      ...employee,
      salary: employee.salary || ''
    });
    setShowEditModal(true);
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
      setShowEditModal(false);
      setSelectedEmployee(null);
      await loadEmployees();
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Failed to update employee: " + (error.response?.data?.error?.message || error.message || "Unknown error"));
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

  const handleManagePermissions = (employee) => {
    try {
      setSelectedEmployee(employee);
      // Load current permissions into editing state
      let currentPerms = getEmployeePermissions(employee.id);

      // If no permissions set yet, initialize based on employee's permission level
      if (Object.keys(currentPerms).length === 0 && employee.permission) {
        currentPerms = getDefaultPermissionsForLevel(employee.permission);
      }

      setEditingPermissions(currentPerms);
      setPermissionsSaved(false);
      setShowPermissionsModal(true);
    } catch (error) {
      console.error('Error opening permissions modal:', error);
      // Still open the modal even if there's an error initializing permissions
      setSelectedEmployee(employee);
      setEditingPermissions({});
      setPermissionsSaved(false);
      setShowPermissionsModal(true);
    }
  };

  // Get available modules (only modules visible in sidebar)
  const getAvailableModules = useCallback(() => {
    const modules = [];

    // Add core modules (always visible)
    coreModules.forEach(m => {
      if (!m.adminOnly) {
        modules.push(m);
      }
    });

    // Add installed app modules only
    appModules.forEach(m => {
      if (isAppInstalled(m.appId)) {
        modules.push(m);
      }
    });

    // Add admin panel at the end
    const adminModule = coreModules.find(m => m.adminOnly);
    if (adminModule) {
      modules.push(adminModule);
    }

    return modules;
  }, [coreModules, appModules, isAppInstalled]);

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
  const handleSavePermissions = () => {
    if (!selectedEmployee) return;
    setEmployeePermissions(selectedEmployee.id, editingPermissions);
    setPermissionsSaved(true);
    setTimeout(() => setPermissionsSaved(false), 2000);
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
      setShowDeleteDialog(false);
      setSelectedEmployee(null);
      await loadEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("Failed to delete employee: " + (error.response?.data?.error?.message || error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadEmployees();
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
      filtered = filtered.filter(e => e.department === departmentFilter);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    setFilteredEmployees(filtered);
  }, [employees, searchQuery, departmentFilter, statusFilter]);
  
  const metrics = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter(e => e.status === 'active').length,
    highTurnoverRisk: employees.filter(e => e.turnover_risk === 'high').length,
    avgPerformance: (employees.length > 0 ? employees.reduce((sum, e) => sum + (e.performance_score || 3), 0) / employees.length : 0).toFixed(1)
  };

  const getRiskColor = (risk) => ({ low: "text-green-600", medium: "text-yellow-600", high: "text-red-600" }[risk] || "text-slate-600");

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><Users className="w-8 h-8 text-[var(--genix-blue)]" /><div><p className="text-2xl font-bold">{metrics.totalEmployees}</p><p className="text-sm text-slate-500">{t('total_employees')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><UserCheck className="w-8 h-8 text-green-600" /><div><p className="text-2xl font-bold">{metrics.activeEmployees}</p><p className="text-sm text-slate-500">{t('active_employees')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><UserX className="w-8 h-8 text-red-600" /><div><p className="text-2xl font-bold">{metrics.highTurnoverRisk}</p><p className="text-sm text-slate-500">{t('high_turnover_risk')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex justify-between items-center"><TrendingUp className="w-8 h-8 text-purple-600" /><div><p className="text-2xl font-bold">{metrics.avgPerformance}/5</p><p className="text-sm text-slate-500">{t('avg_performance')}</p></div></div></CardContent></Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Input placeholder={t('search_employees_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t('all_departments')}/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_departments')}</SelectItem>
                  <SelectItem value="engineering">{t('engineering')}</SelectItem>
                  <SelectItem value="sales">{t('sales')}</SelectItem>
                  <SelectItem value="marketing">{t('marketing')}</SelectItem>
                  <SelectItem value="finance">{t('finance')}</SelectItem>
                  <SelectItem value="operations">{t('operations')}</SelectItem>
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
                    onClick={() => setShowAddModal(true)}
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
                  <TableHead>{t('table_header_performance')}</TableHead>
                  <TableHead>{t('table_header_turnover_risk')}</TableHead>
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
                    <TableCell><Badge variant="outline">{t(e.department)}</Badge></TableCell>
                    <TableCell>{new Date(e.hire_date).toLocaleDateString()}</TableCell>
                    <TableCell>{e.performance_score}/5</TableCell>
                    <TableCell className={getRiskColor(e.turnover_risk)}>{t(e.turnover_risk)}</TableCell>
                    <TableCell><Badge>{t(e.status)}</Badge></TableCell>
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
                          {canUpdate(MODULES.HR) && (
                            <DropdownMenuItem onClick={() => handleEditEmployee(e)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {t('edit') || 'Edit'}
                            </DropdownMenuItem>
                          )}
                          {canUpdate(MODULES.HR) && (
                            <DropdownMenuItem onClick={() => handleManagePermissions(e)}>
                              <Shield className="mr-2 h-4 w-4" />
                              {t('manage_permissions') || 'Manage Permissions'}
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
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('full_name')} *</Label>
                <Input
                  value={newEmployee.full_name}
                  onChange={e => setNewEmployee({...newEmployee, full_name: e.target.value})}
                  placeholder={t('enter_full_name')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input
                    type="email"
                    value={newEmployee.email}
                    onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                    placeholder={t('enter_email')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('phone')}</Label>
                  <Input
                    value={newEmployee.phone}
                    onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})}
                    placeholder={t('enter_phone')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('job_title')} *</Label>
                <Input
                  value={newEmployee.job_title}
                  onChange={e => setNewEmployee({...newEmployee, job_title: e.target.value})}
                  placeholder={t('enter_job_title')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('department')}</Label>
                  <Select
                    value={newEmployee.department}
                    onValueChange={value => setNewEmployee({...newEmployee, department: value})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">{t('engineering')}</SelectItem>
                      <SelectItem value="sales">{t('sales')}</SelectItem>
                      <SelectItem value="marketing">{t('marketing')}</SelectItem>
                      <SelectItem value="finance">{t('finance')}</SelectItem>
                      <SelectItem value="operations">{t('operations')}</SelectItem>
                      <SelectItem value="hr">{t('hr')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('hire_date')}</Label>
                  <Input
                    type="date"
                    value={newEmployee.hire_date}
                    onChange={e => setNewEmployee({...newEmployee, hire_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('salary')}</Label>
                  <Input
                    type="number"
                    value={newEmployee.salary}
                    onChange={e => setNewEmployee({...newEmployee, salary: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('status')}</Label>
                  <Select
                    value={newEmployee.status}
                    onValueChange={value => setNewEmployee({...newEmployee, status: value})}
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

              <div className="space-y-2">
                <Label>{t('permission')}</Label>
                <Select
                  value={newEmployee.permission}
                  onValueChange={value => setNewEmployee({...newEmployee, permission: value})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="learner">{t('learner')}</SelectItem>
                    <SelectItem value="basic">{t('basic')}</SelectItem>
                    <SelectItem value="important">{t('important')}</SelectItem>
                    <SelectItem value="grant">{t('grant')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleAddEmployee}
                  disabled={isSubmitting || !newEmployee.full_name || !newEmployee.job_title}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  {isSubmitting ? t('saving') : t('add_employee')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Employee Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-lg">
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
                    <p className="font-medium">{selectedEmployee.phone || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Briefcase className="w-4 h-4" />
                      {t('department') || 'Department'}
                    </div>
                    <Badge variant="outline">{t(selectedEmployee.department)}</Badge>
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
                    <p className="font-medium">${parseFloat(selectedEmployee.salary || 0).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      {t('performance') || 'Performance'}
                    </div>
                    <p className="font-medium">{selectedEmployee.performance_score}/5</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-500 text-sm">{t('status') || 'Status'}</div>
                    <Badge>{t(selectedEmployee.status)}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Brain className="w-4 h-4" />
                      {t('turnover_risk') || 'Turnover Risk'}
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">AI</Badge>
                    </div>
                    <span className={`font-medium ${getRiskColor(selectedEmployee.turnover_risk)}`}>
                      {t(selectedEmployee.turnover_risk)}
                    </span>
                  </div>
                </div>

                {/* AI Risk Reason */}
                {selectedEmployee.risk_reason && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-2 text-purple-700 text-sm font-medium mb-1">
                      <Brain className="w-4 h-4" />
                      AI Risk Assessment
                    </div>
                    <p className="text-sm text-purple-600">{selectedEmployee.risk_reason}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowViewModal(false)}>
                    {t('close') || 'Close'}
                  </Button>
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
                      type="email"
                      value={selectedEmployee.email}
                      onChange={e => setSelectedEmployee({...selectedEmployee, email: e.target.value})}
                      placeholder={t('enter_email')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('phone')}</Label>
                    <Input
                      value={selectedEmployee.phone}
                      onChange={e => setSelectedEmployee({...selectedEmployee, phone: e.target.value})}
                      placeholder={t('enter_phone')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('job_title')} *</Label>
                  <Input
                    value={selectedEmployee.job_title}
                    onChange={e => setSelectedEmployee({...selectedEmployee, job_title: e.target.value})}
                    placeholder={t('enter_job_title')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('department')}</Label>
                    <Select
                      value={selectedEmployee.department}
                      onValueChange={value => setSelectedEmployee({...selectedEmployee, department: value})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engineering">{t('engineering')}</SelectItem>
                        <SelectItem value="sales">{t('sales')}</SelectItem>
                        <SelectItem value="marketing">{t('marketing')}</SelectItem>
                        <SelectItem value="finance">{t('finance')}</SelectItem>
                        <SelectItem value="operations">{t('operations')}</SelectItem>
                        <SelectItem value="hr">{t('hr')}</SelectItem>
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
                      type="number"
                      value={selectedEmployee.salary}
                      onChange={e => setSelectedEmployee({...selectedEmployee, salary: e.target.value})}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('performance_score') || 'Performance Score'}</Label>
                    <Select
                      value={String(selectedEmployee.performance_score)}
                      onValueChange={value => setSelectedEmployee({...selectedEmployee, performance_score: parseInt(value)})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Poor</SelectItem>
                        <SelectItem value="2">2 - Below Average</SelectItem>
                        <SelectItem value="3">3 - Average</SelectItem>
                        <SelectItem value="4">4 - Good</SelectItem>
                        <SelectItem value="5">5 - Excellent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('turnover_risk') || 'Turnover Risk'}</Label>
                    <Select
                      value={selectedEmployee.turnover_risk}
                      onValueChange={value => setSelectedEmployee({...selectedEmployee, turnover_risk: value})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t('low') || 'Low'}</SelectItem>
                        <SelectItem value="medium">{t('medium') || 'Medium'}</SelectItem>
                        <SelectItem value="high">{t('high') || 'High'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('permission')}</Label>
                  <Select
                    value={selectedEmployee.permission || 'basic'}
                    onValueChange={value => setSelectedEmployee({...selectedEmployee, permission: value})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="learner">{t('learner')}</SelectItem>
                      <SelectItem value="basic">{t('basic')}</SelectItem>
                      <SelectItem value="important">{t('important')}</SelectItem>
                      <SelectItem value="grant">{t('grant')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowEditModal(false)}>
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateEmployee}
                    disabled={isSubmitting || !selectedEmployee.full_name || !selectedEmployee.job_title}
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
                    <p className="text-sm font-normal text-slate-500 mt-0.5">{selectedEmployee?.full_name} - {selectedEmployee?.job_title}</p>
                  </div>
                </DialogTitle>
              </div>
            </DialogHeader>
            {selectedEmployee && (
              <div className="flex-1 overflow-hidden flex flex-col">
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
      </div>
    </div>
  );
}