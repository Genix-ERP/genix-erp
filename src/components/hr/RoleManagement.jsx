import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { useInstalledApps } from '@/components/contexts/InstalledAppsContext';
import { AVAILABLE_MODULES } from '@/components/contexts/EmployeePermissionsContext';
import { MODULES } from "@/config/permissions";
import apiClient from '@/api/client';
import { Shield, Plus, Edit, Trash2, Search, Check, X as XIcon, Eye, Users } from 'lucide-react';
import { hrService } from "@/api/services/hr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RoleManagement({ roles, onRefresh }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { isAppInstalled } = useInstalledApps();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', permissions: {} });
  const [searchQuery, setSearchQuery] = useState('');

  // Employee assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRole, setAssignRole] = useState(null);
  const [roleEmployees, setRoleEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState('');
  const [isLoadingAssign, setIsLoadingAssign] = useState(false);

  const getAvailableModules = useCallback(() => {
    return AVAILABLE_MODULES.filter(mod => {
      if (mod.isCore) return false;
      if (mod.appId) return isAppInstalled(mod.appId);
      return true;
    });
  }, [isAppInstalled]);

  const filteredRoles = roles.filter(role => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return role.name?.toLowerCase().includes(q) || role.description?.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!form.name) {
      toast({
        title: t('error') || 'Error',
        description: t('fill_required_fields') || 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const backendPerms = {};
      Object.entries(form.permissions).forEach(([moduleId, perm]) => {
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
        name: form.name,
        code: form.name.toLowerCase().replace(/\s+/g, '_'),
        description: form.description,
        permissions: backendPerms,
      };

      if (editing) {
        await apiClient.put(`/roles/${editing.id}`, payload);
      } else {
        await apiClient.post('/roles', payload);
      }

      toast({
        title: t('success') || 'Success',
        description: editing
          ? (t('role_updated') || 'Role updated')
          : (t('role_created') || 'Role created'),
      });

      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '', permissions: {} });
      onRefresh?.();
    } catch (error) {
      console.error('Error saving role:', error);
      toast({
        title: t('error') || 'Error',
        description: error.response?.data?.error?.message || t('failed_to_save_role') || 'Failed to save role',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (roleId) => {
    try {
      await apiClient.delete(`/roles/${roleId}`);
      toast({
        title: t('success') || 'Success',
        description: t('role_deleted') || 'Role deleted',
      });
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: t('error') || 'Error',
        description: error.response?.data?.error?.message || t('failed_to_delete_role') || 'Failed to delete role',
        variant: 'destructive',
      });
    }
  };

  const openModal = (role = null) => {
    if (role) {
      setEditing(role);
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
      setForm({ name: role.name, description: role.description || '', permissions: perms });
    } else {
      setEditing(null);
      setForm({ name: '', description: '', permissions: {} });
    }
    setShowModal(true);
  };

  const handlePermissionToggle = (moduleId, permType) => {
    setForm(prev => {
      const currentPerms = prev.permissions[moduleId] || { create: false, read: false, update: false, delete: false };
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: { ...currentPerms, [permType]: !currentPerms[permType] },
        },
      };
    });
  };

  const handleFullAccessToggle = (moduleId) => {
    setForm(prev => {
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

  const handleGrantAll = () => {
    const perms = {};
    getAvailableModules().forEach(mod => {
      perms[mod.id] = { create: true, read: true, update: true, delete: true };
    });
    setForm(prev => ({ ...prev, permissions: perms }));
  };

  const handleRevokeAll = () => {
    setForm(prev => ({ ...prev, permissions: {} }));
  };

  // Open assign employees modal for a role
  const handleOpenAssign = async (role) => {
    setAssignRole(role);
    setSelectedEmpToAdd('');
    setIsLoadingAssign(true);
    setShowAssignModal(true);
    try {
      const [empData, assignedData] = await Promise.all([
        hrService.listEmployees({ sort_by: 'full_name', sort_order: 'ASC' }),
        apiClient.get(`/roles/${role.id}/employees`).then(r => r.data?.data || r.data || []).catch(() => []),
      ]);
      setAllEmployees((empData || []).map(e => ({
        id: e.id,
        full_name: e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
        job_title: e.job_title || '',
        email: e.email || '',
      })));
      setRoleEmployees(assignedData);
    } catch {
      setAllEmployees([]);
      setRoleEmployees([]);
    } finally {
      setIsLoadingAssign(false);
    }
  };

  const handleAddEmployeeToRole = async () => {
    if (!assignRole || !selectedEmpToAdd) return;
    try {
      await apiClient.post(`/roles/${assignRole.id}/assign`, { employee_id: selectedEmpToAdd });
      const emp = allEmployees.find(e => e.id === selectedEmpToAdd);
      if (emp) setRoleEmployees(prev => [...prev, emp]);
      setSelectedEmpToAdd('');
      toast({ title: t('success') || 'Success', description: t('role_assigned_successfully') || 'Role assigned' });
    } catch (error) {
      toast({ title: t('error') || 'Error', description: error.response?.data?.error?.message || t('failed_to_assign_role') || 'Failed', variant: 'destructive' });
    }
  };

  const handleRemoveEmployeeFromRole = async (employeeId) => {
    if (!assignRole) return;
    try {
      await apiClient.post(`/roles/${assignRole.id}/unassign`, { employee_id: employeeId });
      setRoleEmployees(prev => prev.filter(e => e.id !== employeeId));
      toast({ title: t('success') || 'Success', description: t('role_removed_successfully') || 'Removed' });
    } catch (error) {
      toast({ title: t('error') || 'Error', description: error.response?.data?.error?.message || t('failed_to_remove_role') || 'Failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Content */}
      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{t('role_configurations') || 'Role Configurations'}</CardTitle>
                <p className="text-sm text-slate-500">{t('role_configurations_desc') || 'Create and manage roles with predefined permissions'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search') || 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              {canCreate(MODULES.HR) && (
                <Button
                  onClick={() => openModal()}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add_role') || 'Add Role'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRoles.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {t('no_roles') || 'No roles found'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {t('roles_empty_desc') || 'Create roles to manage employee permissions.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('name') || 'Name'}</TableHead>
                  <TableHead>{t('description') || 'Description'}</TableHead>
                  <TableHead>{t('permissions') || 'Permissions'}</TableHead>
                  <TableHead>{t('type') || 'Type'}</TableHead>
                  <TableHead className="w-[100px]">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => {
                  const permCount = role.permissions ? Object.keys(role.permissions).length : 0;
                  return (
                    <TableRow key={role.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-[var(--genix-purple)] to-[var(--genix-blue)] rounded-full flex items-center justify-center text-white">
                            <Shield className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{role.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{role.description || '-'}</TableCell>
                      <TableCell>
                        {permCount > 0 ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                            {permCount} {t('modules') || 'modules'}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.is_system ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200">
                            {t('system') || 'System'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t('custom') || 'Custom'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAssign(role)}
                            title={t('assign_employees') || 'Assign Employees'}
                          >
                            <Users className="w-4 h-4 text-blue-500" />
                          </Button>
                          {canUpdate(MODULES.HR) && (
                            <Button variant="ghost" size="sm" onClick={() => openModal(role)}>
                              <Edit className="w-4 h-4 text-slate-500" />
                            </Button>
                          )}
                          {!role.is_system && canDelete(MODULES.HR) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(role.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Employees Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('assign_employees') || 'Assign Employees'} — {assignRole?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add employee */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('select_employee_to_add') || 'Select employee to add'}
              </label>
              <div className="flex gap-2">
                <Select value={selectedEmpToAdd} onValueChange={setSelectedEmpToAdd}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('search_employees') || 'Select employee...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees
                      .filter(e => !roleEmployees.some(re => re.id === e.id))
                      .map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          <div className="flex flex-col">
                            <span>{emp.full_name}</span>
                            {emp.job_title && <span className="text-xs text-slate-400">{emp.job_title}</span>}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddEmployeeToRole}
                  disabled={!selectedEmpToAdd}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add') || 'Add'}
                </Button>
              </div>
            </div>

            {/* Current employees in role */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {t('employees_in_role') || 'Employees in this role'}
                </span>
                {roleEmployees.length > 0 && (
                  <Badge variant="outline" className="text-xs">{roleEmployees.length}</Badge>
                )}
              </div>
              {isLoadingAssign ? (
                <p className="text-sm text-slate-400 text-center py-4">...</p>
              ) : roleEmployees.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                  {t('no_employees_in_role') || 'No employees assigned to this role'}
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {roleEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {(emp.full_name || emp.name)?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{emp.full_name || emp.name}</p>
                          {emp.job_title && <p className="text-xs text-slate-400">{emp.job_title}</p>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveEmployeeFromRole(emp.id)}
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAssignModal(false)}>
                {t('close') || 'Close'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {editing
                ? (t('edit_role') || 'Edit Role')
                : (t('add_role') || 'Add Role')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('role_name') || 'Role Name'} *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('enter_name') || 'Enter name'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('role_description') || 'Description'}
              </label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('enter_description') || 'Enter description'}
              />
            </div>

            {/* Permissions section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  {t('role_permissions') || 'Permissions'}
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGrantAll}
                    className="text-green-600 border-green-200 hover:bg-green-50"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    {t('grant_all') || 'Grant All'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevokeAll}
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
                      const perms = form.permissions[module.id] || { create: false, read: false, update: false, delete: false };
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
                              onCheckedChange={() => handleFullAccessToggle(module.id)}
                              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500"
                            />
                          </TableCell>
                          {['create', 'read', 'update', 'delete'].map((permType) => {
                            const colors = { create: 'green', read: 'blue', update: 'amber', delete: 'red' };
                            const color = colors[permType];
                            return (
                              <TableCell key={permType} className="text-center">
                                <button
                                  onClick={() => handlePermissionToggle(module.id, permType)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                    perms[permType]
                                      ? `bg-${color}-500 text-white shadow-md shadow-${color}-200 scale-105`
                                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                  }`}
                                  style={perms[permType] ? {
                                    backgroundColor: color === 'green' ? '#22c55e' : color === 'blue' ? '#3b82f6' : color === 'amber' ? '#f59e0b' : '#ef4444',
                                    color: 'white',
                                    transform: 'scale(1.05)',
                                  } : {}}
                                >
                                  {perms[permType] ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                                </button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {editing ? (t('save') || 'Save') : (t('add') || 'Add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
