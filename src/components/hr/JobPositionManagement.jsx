import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import apiClient from '@/api/client';
import { Briefcase, Plus, Edit, Trash2, Search } from 'lucide-react';

export default function JobPositionManagement({ jobPositions, onRefresh }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = (jobPositions || []).filter(jp => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return jp.name?.toLowerCase().includes(q) || jp.code?.toLowerCase().includes(q);
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
      const payload = { name: form.name, description: form.description || undefined };
      if (editing) {
        await apiClient.put(`/job-positions/${editing.id}`, payload);
      } else {
        await apiClient.post('/job-positions', payload);
      }

      toast({
        title: t('success') || 'Success',
        description: editing
          ? (t('job_position_updated') || 'Job position updated')
          : (t('job_position_created') || 'Job position created'),
      });

      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '' });
      onRefresh?.();
    } catch (error) {
      toast({
        title: t('error') || 'Error',
        description: error.response?.data?.message || (t('operation_failed') || 'Operation failed'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm_delete') || 'Are you sure you want to delete this job position?')) return;
    try {
      await apiClient.delete(`/job-positions/${id}`);
      toast({
        title: t('success') || 'Success',
        description: t('job_position_deleted') || 'Job position deleted',
      });
      onRefresh?.();
    } catch (error) {
      toast({
        title: t('error') || 'Error',
        description: error.response?.data?.message || (t('operation_failed') || 'Operation failed'),
        variant: 'destructive',
      });
    }
  };

  const openModal = (jp = null) => {
    setEditing(jp);
    setForm(jp ? { name: jp.name, description: jp.description || '' } : { name: '', description: '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('job_positions') || 'Job Positions'}</CardTitle>
                <p className="text-sm text-slate-500">{t('job_positions_desc') || 'Manage job positions in your organization'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search') || 'Search...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {canCreate(MODULES.HR) && (
                <Button
                  onClick={() => openModal()}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  {t('add_job_position') || 'Add Position'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>{t('code') || 'Code'}</TableHead>
                <TableHead>{t('name') || 'Name'}</TableHead>
                <TableHead>{t('description') || 'Description'}</TableHead>
                <TableHead>{t('status') || 'Status'}</TableHead>
                <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                    {t('no_job_positions') || 'No job positions found'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(jp => (
                  <TableRow key={jp.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{jp.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{jp.name}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{jp.description || '—'}</TableCell>
                    <TableCell>
                      <Badge className={jp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                        {jp.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canUpdate(MODULES.HR) && (
                          <Button variant="ghost" size="icon" onClick={() => openModal(jp)}>
                            <Edit className="w-4 h-4 text-slate-500" />
                          </Button>
                        )}
                        {canDelete(MODULES.HR) && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(jp.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? (t('edit_job_position') || 'Edit Job Position') : (t('add_job_position') || 'Add Job Position')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('name') || 'Name'} *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={t('enter_position_name') || 'Lavozim nomini kiriting'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('description') || 'Description'}</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder={t('enter_description') || 'Optional description'}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('cancel') || 'Cancel'}</Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              {editing ? (t('save') || 'Save') : (t('create') || 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
