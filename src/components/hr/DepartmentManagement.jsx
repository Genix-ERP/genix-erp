import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import apiClient from '@/api/client';
import { FolderTree, Plus, Pencil, Trash2, Search, Users } from 'lucide-react';

export default function DepartmentManagement({ departments, onRefresh }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDepartments = departments.filter(dept => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return dept.name?.toLowerCase().includes(q) || dept.code?.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({
        title: t('error') || 'Error',
        description: t('fill_required_fields') || 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editing) {
        await apiClient.put(`/departments/${editing.id}`, { code: form.code, name: form.name });
      } else {
        await apiClient.post('/departments', { code: form.code, name: form.name });
      }

      toast({
        title: t('success') || 'Success',
        description: editing
          ? (t('department_updated') || 'Department updated')
          : (t('department_created') || 'Department created'),
      });

      setShowModal(false);
      setEditing(null);
      setForm({ code: '', name: '' });
      onRefresh?.();
    } catch (error) {
      console.error('Error saving department:', error);
      toast({
        title: t('error') || 'Error',
        description: error.response?.data?.error?.message || t('failed_to_save_department') || 'Failed to save department',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (deptId) => {
    try {
      await apiClient.delete(`/departments/${deptId}`);
      toast({
        title: t('success') || 'Success',
        description: t('department_deleted') || 'Department deleted',
      });
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast({
        title: t('error') || 'Error',
        description: error.response?.data?.error?.message || t('failed_to_delete_department') || 'Failed to delete department',
        variant: 'destructive',
      });
    }
  };

  const openModal = (dept = null) => {
    if (dept) {
      setEditing(dept);
      setForm({ code: dept.code, name: dept.name });
    } else {
      setEditing(null);
      setForm({ code: '', name: '' });
    }
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderTree className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{departments.length}</p>
              <p className="text-xs text-slate-500">{t('total_departments') || 'Total Departments'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{departments.filter(d => d.employee_count > 0).length || '-'}</p>
              <p className="text-xs text-slate-500">{t('active_departments') || 'With Employees'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <FolderTree className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{t('departments') || 'Departments'}</CardTitle>
                <p className="text-sm text-slate-500">{t('departments_desc') || 'Create and manage departments'}</p>
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
                  {t('add_department') || 'Add Department'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDepartments.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderTree className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {t('no_departments') || 'No departments found'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {t('departments_empty_desc') || 'Create departments to organize your employees.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('code') || 'Code'}</TableHead>
                  <TableHead>{t('name') || 'Name'}</TableHead>
                  <TableHead className="w-[100px]">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.map((dept) => (
                  <TableRow key={dept.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center text-white font-semibold text-xs">
                          {dept.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-mono text-sm">{dept.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canUpdate(MODULES.HR) && (
                          <Button variant="ghost" size="sm" onClick={() => openModal(dept)}>
                            <Pencil className="w-4 h-4 text-slate-500" />
                          </Button>
                        )}
                        {canDelete(MODULES.HR) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(dept.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5" />
              {editing
                ? (t('edit_department') || 'Edit Department')
                : (t('add_department') || 'Add Department')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('code') || 'Code'} *
              </label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={t('enter_code') || 'Enter code'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                {t('name') || 'Name'} *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('enter_name') || 'Enter name'}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
