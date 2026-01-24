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
import { Calendar, Receipt, Clock, MapPin, Wallet, Building2, Users, Plus, Check, X as XIcon, Search } from 'lucide-react';

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

// Map expense category IDs to translation keys
const EXPENSE_CATEGORY_TRANSLATION_KEYS = {
  travel: 'travel',
  meals: 'meals',
  supplies: 'office_supplies',
  equipment: 'equipment',
  other: 'other',
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

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

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
                  {t(LEAVE_TYPE_TRANSLATION_KEYS[leaveType.id]) || leaveType.name}
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
                {t(EXPENSE_CATEGORY_TRANSLATION_KEYS[category.id]) || category.name}
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
