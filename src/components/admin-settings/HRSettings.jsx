import React, { useState, useEffect, useCallback } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle, SettingsDivider } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import apiClient from '@/api/client';
import { hrService } from "@/api/services/hr";
import { Calendar, Receipt, Clock, MapPin, Wallet, Building2, Users, Plus, Check, X as XIcon, Search, Pencil, Trash2, FolderTree, Shield, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { AVAILABLE_MODULES } from '@/components/contexts/EmployeePermissionsContext';
import { useInstalledApps } from '@/components/contexts/InstalledAppsContext';

// PAY_PERIODS is defined inside component to use translations

// Map leave type IDs to translation keys
const LEAVE_TYPE_TRANSLATION_KEYS = {
  annual: 'annual_leave',
  sick: 'sick_leave',
  personal: 'personal_leave',
  unpaid: 'unpaid_leave',
  maternity: 'maternity_leave',
  paternity: 'paternity_leave',
};

// Map leave type names to translation keys (fallback when id is missing)
const LEAVE_TYPE_NAME_KEYS = {
  'Annual Leave': 'annual_leave',
  'Sick Leave': 'sick_leave',
  'Personal Leave': 'personal_leave',
  'Unpaid Leave': 'unpaid_leave',
  'Maternity Leave': 'maternity_leave',
  'Paternity Leave': 'paternity_leave',
};

// Map expense category IDs to translation keys
const EXPENSE_CATEGORY_TRANSLATION_KEYS = {
  travel: 'travel',
  meals: 'meals',
  supplies: 'office_supplies',
  equipment: 'equipment',
  other: 'other',
};

// Map expense category names to translation keys (fallback when id is missing)
const EXPENSE_CATEGORY_NAME_KEYS = {
  'Travel': 'travel',
  'Meals': 'meals',
  'Office Supplies': 'office_supplies',
  'Equipment': 'equipment',
  'Other': 'other',
};

export default function HRSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();
  const { toast } = useToast();

  const hr = settings.hr || {};

  const PAY_PERIODS = [
    { value: 'weekly', label: t('weekly') },
    { value: 'bi-weekly', label: t('bi_weekly') },
    { value: 'monthly', label: t('monthly') }
  ];

  const { isAppInstalled } = useInstalledApps();

  // Department management state
  const [departments, setDepartments] = useState([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ code: '', name: '' });

  // Role management state
  const [roles, setRoles] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: {} });

  // Load departments
  const loadDepartments = useCallback(async () => {
    try {
      const response = await apiClient.get('/departments');
      setDepartments(response.data?.data || []);
    } catch (error) {
      console.error("Error loading departments:", error);
    }
  }, []);

  // Save department (create or update)
  const handleSaveDepartment = async () => {
    if (!deptForm.code || !deptForm.name) {
      toast({
        title: t('error') || 'Xato',
        description: t('fill_required_fields') || "Majburiy maydonlarni to'ldiring",
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingDept) {
        await apiClient.put(`/departments/${editingDept.id}`, {
          code: deptForm.code,
          name: deptForm.name,
        });
      } else {
        await apiClient.post('/departments', {
          code: deptForm.code,
          name: deptForm.name,
        });
      }

      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: editingDept
          ? (t('department_updated') || "Bo'lim yangilandi")
          : (t('department_created') || "Bo'lim yaratildi"),
      });

      setShowDeptModal(false);
      setEditingDept(null);
      setDeptForm({ code: '', name: '' });
      await loadDepartments();
    } catch (error) {
      console.error("Error saving department:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || t('failed_to_save_department') || "Bo'limni saqlashda xatolik",
        variant: 'destructive',
      });
    }
  };

  // Delete department
  const handleDeleteDepartment = async (deptId) => {
    try {
      await apiClient.delete(`/departments/${deptId}`);
      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: t('department_deleted') || "Bo'lim o'chirildi",
      });
      await loadDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || t('failed_to_delete_department') || "Bo'limni o'chirishda xatolik",
        variant: 'destructive',
      });
    }
  };

  // Open add/edit modal
  const handleOpenDeptModal = (dept = null) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({ code: dept.code, name: dept.name });
    } else {
      setEditingDept(null);
      setDeptForm({ code: '', name: '' });
    }
    setShowDeptModal(true);
  };

  // ========== Role management functions ==========

  // Get available modules for permission assignment (filtered by installed apps, excluding core)
  const getAvailableModules = useCallback(() => {
    return AVAILABLE_MODULES.filter(mod => {
      // Skip core modules (dashboard, ai_assistant, settings) - accessible to everyone
      if (mod.isCore) return false;
      if (mod.appId) return isAppInstalled(mod.appId);
      return true;
    });
  }, [isAppInstalled]);

  // Load roles
  const loadRoles = useCallback(async () => {
    try {
      const response = await apiClient.get('/roles');
      setRoles(response.data?.data || []);
    } catch (error) {
      console.error("Error loading roles:", error);
    }
  }, []);

  // Save role (create or update)
  const handleSaveRole = async () => {
    if (!roleForm.name) {
      toast({
        title: t('error') || 'Xato',
        description: t('fill_required_fields') || "Majburiy maydonlarni to'ldiring",
        variant: 'destructive',
      });
      return;
    }

    try {
      // Convert form permissions to backend format
      const backendPerms = {};
      Object.entries(roleForm.permissions).forEach(([moduleId, perm]) => {
        if (perm.create || perm.read || perm.update || perm.delete) {
          backendPerms[moduleId] = {
            can_create: perm.create || false,
            can_read: perm.read || false,
            can_update: perm.update || false,
            can_delete: perm.delete || false,
          };
        }
      });

      const payload = {
        name: roleForm.name,
        code: roleForm.name.toLowerCase().replace(/\s+/g, '_'),
        description: roleForm.description,
        permissions: backendPerms,
      };

      if (editingRole) {
        await apiClient.put(`/roles/${editingRole.id}`, payload);
      } else {
        await apiClient.post('/roles', payload);
      }

      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: editingRole
          ? (t('role_updated') || 'Rol yangilandi')
          : (t('role_created') || 'Rol yaratildi'),
      });

      setShowRoleModal(false);
      setEditingRole(null);
      setRoleForm({ name: '', description: '', permissions: {} });
      await loadRoles();
    } catch (error) {
      console.error("Error saving role:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || t('failed_to_save_role') || 'Rolni saqlashda xatolik',
        variant: 'destructive',
      });
    }
  };

  // Delete role
  const handleDeleteRole = async (roleId) => {
    try {
      await apiClient.delete(`/roles/${roleId}`);
      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: t('role_deleted') || "Rol o'chirildi",
      });
      await loadRoles();
    } catch (error) {
      console.error("Error deleting role:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || t('failed_to_delete_role') || "Rolni o'chirishda xatolik",
        variant: 'destructive',
      });
    }
  };

  // Open add/edit role modal
  const handleOpenRoleModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      // Convert backend permissions format to form format
      const perms = {};
      if (role.permissions) {
        Object.entries(role.permissions).forEach(([moduleId, perm]) => {
          perms[moduleId] = {
            create: perm.can_create || false,
            read: perm.can_read || false,
            update: perm.can_update || false,
            delete: perm.can_delete || false,
          };
        });
      }
      setRoleForm({
        name: role.name,
        description: role.description || '',
        permissions: perms,
      });
    } else {
      setEditingRole(null);
      setRoleForm({ name: '', description: '', permissions: {} });
    }
    setShowRoleModal(true);
  };

  // Toggle a single permission for role form
  const handleRolePermissionToggle = (moduleId, permType) => {
    setRoleForm(prev => {
      const currentPerms = prev.permissions[moduleId] || { create: false, read: false, update: false, delete: false };
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: {
            ...currentPerms,
            [permType]: !currentPerms[permType],
          },
        },
      };
    });
  };

  // Toggle full access for a module in role form
  const handleRoleFullAccessToggle = (moduleId) => {
    setRoleForm(prev => {
      const currentPerms = prev.permissions[moduleId] || { create: false, read: false, update: false, delete: false };
      const hasFullAccess = currentPerms.create && currentPerms.read && currentPerms.update && currentPerms.delete;
      const newValue = !hasFullAccess;
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: { create: newValue, read: newValue, update: newValue, delete: newValue },
        },
      };
    });
  };

  // Grant all permissions in role form
  const handleRoleGrantAll = () => {
    const perms = {};
    getAvailableModules().forEach(mod => {
      perms[mod.id] = { create: true, read: true, update: true, delete: true };
    });
    setRoleForm(prev => ({ ...prev, permissions: perms }));
  };

  // Revoke all permissions in role form
  const handleRoleRevokeAll = () => {
    setRoleForm(prev => ({ ...prev, permissions: {} }));
  };

  // Employee company assignment state
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCompanyAssignModal, setShowCompanyAssignModal] = useState(false);
  const [employeeOrganizations, setEmployeeOrganizations] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [selectedOrgToAssign, setSelectedOrgToAssign] = useState('');

  // Load employees
  const loadEmployees = useCallback(async () => {
    try {
      const data = await hrService.listEmployees({ sort_by: 'full_name', sort_order: 'ASC' });
      const mapped = (data || []).map(emp => ({
        id: emp.id,
        full_name: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        email: emp.email || '',
        job_title: emp.job_title || '',
        department: emp.department || 'other',
        status: emp.status || 'active',
      }));
      setEmployees(mapped);
      setFilteredEmployees(mapped);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  }, []);

  // Load employee's organization assignments
  const loadEmployeeOrganizations = useCallback(async (employeeId) => {
    try {
      const response = await apiClient.get(`/employees/${employeeId}/organizations`);
      setEmployeeOrganizations(response.data?.data || []);
    } catch (error) {
      console.error("Error loading employee organizations:", error);
      setEmployeeOrganizations([]);
    }
  }, []);

  // Load available organizations
  const loadAvailableOrganizations = useCallback(async () => {
    try {
      const response = await apiClient.get('/organizations');
      setAvailableOrganizations(response.data?.data || []);
    } catch (error) {
      console.error("Error loading organizations:", error);
      setAvailableOrganizations([]);
    }
  }, []);

  // Assign employee to organization
  const handleAssignToOrganization = async () => {
    if (!selectedEmployee || !selectedOrgToAssign) return;

    try {
      await apiClient.post('/employee-organizations', {
        employee_id: selectedEmployee.id,
        organization_id: selectedOrgToAssign,
        is_primary: employeeOrganizations.length === 0,
      });

      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: t('employee_assigned_to_company') || "Xodim kompaniyaga qo'shildi",
      });

      await loadEmployeeOrganizations(selectedEmployee.id);
      setSelectedOrgToAssign('');
    } catch (error) {
      console.error("Error assigning employee:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || t('failed_to_assign_employee') || "Xodimni qo'shishda xatolik",
        variant: 'destructive',
      });
    }
  };

  // Remove employee from organization
  const handleRemoveFromOrganization = async (assignmentId) => {
    try {
      await apiClient.delete(`/employee-organizations/${assignmentId}`);

      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: t('employee_removed_from_company') || "Xodim kompaniyadan olib tashlandi",
      });

      if (selectedEmployee) {
        await loadEmployeeOrganizations(selectedEmployee.id);
      }
    } catch (error) {
      console.error("Error removing employee:", error);
      toast({
        title: t('error') || 'Xato',
        description: error.response?.data?.error?.message || t('failed_to_remove_employee') || "Xodimni olib tashlashda xatolik",
        variant: 'destructive',
      });
    }
  };

  // Set primary organization
  const handleSetPrimaryOrganization = async (assignmentId) => {
    try {
      await apiClient.put(`/employee-organizations/${assignmentId}`, {
        is_primary: true,
      });

      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: t('primary_company_set') || "Asosiy kompaniya o'rnatildi",
      });

      if (selectedEmployee) {
        await loadEmployeeOrganizations(selectedEmployee.id);
      }
    } catch (error) {
      console.error("Error setting primary:", error);
      toast({
        title: t('error') || 'Xato',
        description: t('failed_to_set_primary') || "Asosiy kompaniyani o'rnatishda xatolik",
        variant: 'destructive',
      });
    }
  };

  // Open company assignment modal
  const handleManageCompanies = (employee) => {
    setSelectedEmployee(employee);
    loadEmployeeOrganizations(employee.id);
    loadAvailableOrganizations();
    setShowCompanyAssignModal(true);
  };

  // Filter employees based on search
  useEffect(() => {
    if (employeeSearchQuery) {
      const filtered = employees.filter(e =>
        e.full_name.toLowerCase().includes(employeeSearchQuery.toLowerCase()) ||
        e.email.toLowerCase().includes(employeeSearchQuery.toLowerCase())
      );
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [employeeSearchQuery, employees]);

  // Load data on mount
  useEffect(() => {
    loadEmployees();
    loadDepartments();
    loadRoles();
  }, [loadEmployees, loadDepartments, loadRoles]);

  return (
    <div className="space-y-4">
      {/* Leave Management */}
      <SettingsSection
        title={t('leave_management')}
        description={t('leave_management_desc')}
        icon={Calendar}
        onReset={() => resetSection('hr')}
        resetLabel={t('reset')}
      >
        <SettingsToggle
          label={t('require_leave_approval')}
          description={t('require_leave_approval_desc')}
          checked={hr.leave?.approval_required ?? true}
          onChange={(checked) => updateSetting('hr.leave.approval_required', checked)}
        />

        <SettingsDivider label={t('leave_types')} />

        <div className="space-y-3">
          {(hr.leave?.types || []).map((leaveType, index) => (
            <div key={leaveType.id} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-slate-800">
                  {t(LEAVE_TYPE_TRANSLATION_KEYS[leaveType.id] || LEAVE_TYPE_NAME_KEYS[leaveType.name] || leaveType.name)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500">{t('days_per_year')}</label>
                  <Input
                    type="number"
                    min="0"
                    value={leaveType.days_per_year}
                    onChange={(e) => {
                      const newTypes = [...(hr.leave?.types || [])];
                      newTypes[index] = { ...newTypes[index], days_per_year: parseInt(e.target.value) || 0 };
                      updateSetting('hr.leave.types', newTypes);
                    }}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    checked={leaveType.carry_forward}
                    onChange={(e) => {
                      const newTypes = [...(hr.leave?.types || [])];
                      newTypes[index] = { ...newTypes[index], carry_forward: e.target.checked };
                      updateSetting('hr.leave.types', newTypes);
                    }}
                    className="w-4 h-4"
                  />
                  <label className="text-sm">{t('allow_carry_forward')}</label>
                </div>
                {leaveType.carry_forward && (
                  <div>
                    <label className="text-xs text-slate-500">{t('max_carry_forward')}</label>
                    <Input
                      type="number"
                      min="0"
                      value={leaveType.max_carry_forward}
                      onChange={(e) => {
                        const newTypes = [...(hr.leave?.types || [])];
                        newTypes[index] = { ...newTypes[index], max_carry_forward: parseInt(e.target.value) || 0 };
                        updateSetting('hr.leave.types', newTypes);
                      }}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Expense Settings */}
      <SettingsSection
        title={t('expense_settings')}
        description={t('expense_settings_desc')}
        icon={Receipt}
      >
        <SettingsRow>
          <SettingsField label={t('auto_approval_limit')} description={t('auto_approval_limit_desc')}>
            <Input
              type="number"
              min="0"
              value={hr.expense?.auto_approval_limit || 100000}
              onChange={(e) => updateSetting('hr.expense.auto_approval_limit', parseInt(e.target.value) || 0)}
            />
          </SettingsField>
        </SettingsRow>

        <SettingsDivider label={t('expense_categories')} />

        <div className="space-y-2">
          {(hr.expense?.categories || []).map((category, index) => (
            <div key={category.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium">
                {t(EXPENSE_CATEGORY_TRANSLATION_KEYS[category.id] || EXPENSE_CATEGORY_NAME_KEYS[category.name] || category.name)}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={category.approval_required}
                  onChange={(e) => {
                    const newCategories = [...(hr.expense?.categories || [])];
                    newCategories[index] = { ...newCategories[index], approval_required: e.target.checked };
                    updateSetting('hr.expense.categories', newCategories);
                  }}
                  className="w-4 h-4"
                />
                <label className="text-xs text-slate-500">{t('requires_approval')}</label>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Work Hours */}
      <SettingsSection
        title={t('work_hours')}
        description={t('work_hours_desc')}
        icon={Clock}
      >
        <SettingsRow>
          <SettingsField label={t('hours_per_day')}>
            <Input
              type="number"
              min="1"
              max="24"
              value={hr.work?.hours_per_day || 8}
              onChange={(e) => updateSetting('hr.work.hours_per_day', parseInt(e.target.value) || 8)}
            />
          </SettingsField>
          <SettingsField label={t('days_per_week')}>
            <Input
              type="number"
              min="1"
              max="7"
              value={hr.work?.days_per_week || 5}
              onChange={(e) => updateSetting('hr.work.days_per_week', parseInt(e.target.value) || 5)}
            />
          </SettingsField>
          <SettingsField label={t('overtime_multiplier')}>
            <Input
              type="number"
              min="1"
              max="3"
              step="0.5"
              value={hr.work?.overtime_multiplier || 1.5}
              onChange={(e) => updateSetting('hr.work.overtime_multiplier', parseFloat(e.target.value) || 1.5)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Attendance Tracking */}
      <SettingsSection
        title={t('attendance_tracking')}
        description={t('attendance_tracking_desc')}
        icon={MapPin}
      >
        <div className="space-y-3">
          <SettingsToggle
            label={t('enable_attendance_tracking')}
            description={t('enable_attendance_tracking_desc')}
            checked={hr.attendance?.tracking_enabled ?? false}
            onChange={(checked) => updateSetting('hr.attendance.tracking_enabled', checked)}
          />
          {hr.attendance?.tracking_enabled && (
            <SettingsToggle
              label={t('require_geolocation')}
              description={t('require_geolocation_desc')}
              checked={hr.attendance?.geolocation_required ?? false}
              onChange={(checked) => updateSetting('hr.attendance.geolocation_required', checked)}
            />
          )}
        </div>
      </SettingsSection>

      {/* Payroll Settings */}
      <SettingsSection
        title={t('payroll_settings')}
        description={t('payroll_settings_desc')}
        icon={Wallet}
      >
        <SettingsRow>
          <SettingsField label={t('pay_period')}>
            <Select
              value={hr.payroll?.pay_period || 'monthly'}
              onValueChange={(value) => updateSetting('hr.payroll.pay_period', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAY_PERIODS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label={t('payroll_currency')}>
            <Select
              value={hr.payroll?.currency || 'UZS'}
              onValueChange={(value) => updateSetting('hr.payroll.currency', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UZS">UZS - O'zbek so'mi</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Departments */}
      <SettingsSection
        title={t('departments') || "Bo'limlar"}
        description={t('departments_desc') || "Bo'limlarni yaratish va boshqarish"}
        icon={FolderTree}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => handleOpenDeptModal()}
              className="gap-2 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              <Plus className="w-4 h-4" />
              {t('add_department') || "Bo'lim qo'shish"}
            </Button>
          </div>

          {departments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              {t('no_departments') || "Bo'limlar topilmadi"}
            </p>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {dept.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{dept.name}</p>
                      <p className="text-sm text-slate-500">{dept.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDeptModal(dept)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteDepartment(dept.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Department Add/Edit Modal */}
      <Dialog open={showDeptModal} onOpenChange={setShowDeptModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5" />
              {editingDept
                ? (t('edit_department') || "Bo'limni tahrirlash")
                : (t('add_department') || "Bo'lim qo'shish")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('code') || 'Kod'} *
              </label>
              <Input
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                placeholder={t('enter_code') || 'Kodni kiriting'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('name') || 'Nomi'} *
              </label>
              <Input
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder={t('enter_name') || 'Nomini kiriting'}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDeptModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                onClick={handleSaveDepartment}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                {editingDept ? (t('save') || 'Saqlash') : (t('add') || "Qo'shish")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Configurations */}
      <SettingsSection
        title={t('role_configurations') || "Rollarni sozlash"}
        description={t('role_configurations_desc') || "Oldindan belgilangan ruxsatlar bilan rollarni yaratish va boshqarish"}
        icon={Shield}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => handleOpenRoleModal()}
              className="gap-2 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              <Plus className="w-4 h-4" />
              {t('add_role') || "Rol qo'shish"}
            </Button>
          </div>

          {roles.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              {t('no_roles') || "Rollar topilmadi"}
            </p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => {
                const permCount = role.permissions ? Object.keys(role.permissions).length : 0;
                return (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-purple)] to-[var(--genix-blue)] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{role.name}</p>
                        <div className="flex items-center gap-2">
                          {permCount > 0 && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                              {permCount} {t('modules') || 'modules'}
                            </Badge>
                          )}
                          {role.is_system && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                              {t('system') || 'System'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenRoleModal(role)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteRole(role.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Role Add/Edit Modal */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {editingRole
                ? (t('edit_role') || "Rolni tahrirlash")
                : (t('add_role') || "Rol qo'shish")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 py-4">
            {/* Role basic info */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('role_name') || 'Rol nomi'} *
              </label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder={t('enter_name') || 'Nomini kiriting'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('role_description') || 'Tavsif'}
              </label>
              <Input
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder={t('enter_description') || 'Tavsifni kiriting'}
              />
            </div>

            {/* Permissions section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  {t('role_permissions') || 'Ruxsatlar'}
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRoleGrantAll}
                    className="text-green-600 border-green-200 hover:bg-green-50"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    {t('grant_all') || 'Grant All'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRoleRevokeAll}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XIcon className="w-4 h-4 mr-1" />
                    {t('revoke_all') || 'Revoke All'}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 justify-end">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> {t('create') || 'Create'}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> {t('read') || 'Read'}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> {t('update') || 'Update'}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> {t('delete') || 'Delete'}</span>
              </div>

              <div className="border rounded-xl shadow-sm overflow-auto max-h-96">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2">
                      <TableHead className="font-semibold text-slate-700 py-3">{t('module') || 'Module'}</TableHead>
                      <TableHead className="text-center w-28 font-semibold text-slate-700">{t('full_access') || 'Full Access'}</TableHead>
                      <TableHead className="text-center w-14">
                        <div className="w-7 h-7 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center font-bold text-xs">C</div>
                      </TableHead>
                      <TableHead className="text-center w-14">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center font-bold text-xs">R</div>
                      </TableHead>
                      <TableHead className="text-center w-14">
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center font-bold text-xs">U</div>
                      </TableHead>
                      <TableHead className="text-center w-14">
                        <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center font-bold text-xs">D</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getAvailableModules().map((module, index) => {
                      const perms = roleForm.permissions[module.id] || { create: false, read: false, update: false, delete: false };
                      const hasFullAccess = perms.create && perms.read && perms.update && perms.delete;
                      const hasAnyAccess = perms.create || perms.read || perms.update || perms.delete;

                      return (
                        <TableRow
                          key={module.id}
                          className={`transition-colors ${hasAnyAccess ? 'bg-green-50/30' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}
                        >
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-medium text-sm text-slate-800">{t(module.nameKey) || module.nameKey}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={hasFullAccess}
                              onCheckedChange={() => handleRoleFullAccessToggle(module.id)}
                              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => handleRolePermissionToggle(module.id, 'create')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                perms.create
                                  ? 'bg-green-500 text-white shadow-md shadow-green-200 scale-105'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {perms.create ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => handleRolePermissionToggle(module.id, 'read')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                perms.read
                                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200 scale-105'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {perms.read ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => handleRolePermissionToggle(module.id, 'update')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                perms.update
                                  ? 'bg-amber-500 text-white shadow-md shadow-amber-200 scale-105'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {perms.update ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => handleRolePermissionToggle(module.id, 'delete')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                perms.delete
                                  ? 'bg-red-500 text-white shadow-md shadow-red-200 scale-105'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {perms.delete ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowRoleModal(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              onClick={handleSaveRole}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {editingRole ? (t('save') || 'Saqlash') : (t('add') || "Qo'shish")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Company Assignments */}
      <SettingsSection
        title={t('employee_company_assignments') || 'Xodim kompaniya tayinlashlari'}
        description={t('employee_company_assignments_desc') || "Xodimlarni kompaniyalarga tayinlash va boshqarish"}
        icon={Building2}
      >
        <div className="space-y-4">
          {/* Search employees */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('search_employees') || "Xodimlarni qidirish..."}
              value={employeeSearchQuery}
              onChange={(e) => setEmployeeSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Employee list with company management */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                {t('no_employees_found') || 'Xodimlar topilmadi'}
              </p>
            ) : (
              filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center text-white font-semibold">
                      {employee.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{employee.full_name}</p>
                      <p className="text-sm text-slate-500">{employee.job_title || employee.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManageCompanies(employee)}
                    className="gap-2"
                  >
                    <Building2 className="w-4 h-4" />
                    {t('manage_companies') || 'Kompaniyalar'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Company Assignment Modal */}
      <Dialog open={showCompanyAssignModal} onOpenChange={setShowCompanyAssignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t('manage_companies') || 'Kompaniyalarni boshqarish'}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center text-white font-semibold">
                  {selectedEmployee.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{selectedEmployee.full_name}</p>
                  <p className="text-sm text-slate-500">{selectedEmployee.job_title}</p>
                </div>
              </div>

              {/* Current assignments */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  {t('assigned_companies') || 'Tayinlangan kompaniyalar'}
                </p>
                {employeeOrganizations.length === 0 ? (
                  <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    {t('no_companies_assigned') || 'Hech qanday kompaniya tayinlanmagan'}
                  </p>
                ) : (
                  employeeOrganizations.map((eo) => (
                    <div key={eo.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">{eo.organization_name}</span>
                        <span className="text-xs text-slate-400">({eo.organization_code})</span>
                        {eo.is_primary && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                            {t('primary') || 'Asosiy'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!eo.is_primary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimaryOrganization(eo.id)}
                            title={t('set_as_primary') || 'Asosiy qilib belgilash'}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveFromOrganization(eo.id)}
                        >
                          <XIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add to organization */}
              <div className="pt-4 border-t space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  {t('add_to_company') || "Kompaniyaga qo'shish"}
                </p>
                <div className="flex gap-2">
                  <Select value={selectedOrgToAssign} onValueChange={setSelectedOrgToAssign}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('select_company') || 'Kompaniyani tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOrganizations
                        .filter(org => !employeeOrganizations.some(eo => eo.organization_id === org.id))
                        .map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name} ({org.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAssignToOrganization}
                    disabled={!selectedOrgToAssign}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('add') || "Qo'shish"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => setShowCompanyAssignModal(false)}>
                  {t('close') || 'Yopish'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
