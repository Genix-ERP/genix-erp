import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { hrService } from '@/api/services/hr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, UserPlus, Edit, Trash2, Phone, Mail, Loader2, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { sortBuildings } from '@/utils/naturalSort';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'prorab', label: 'Prorab' },
  { value: 'muhandis', label: 'Muhandis' },
  { value: 'texnik_nazoratchi', label: 'Texnik nazoratchi' },
  { value: 'buxgalter', label: 'Buxgalter' },
  { value: 'project_manager', label: 'Loyiha boshqaruvchisi' },
  { value: 'chief_engineer', label: 'Bosh muhandis' },
  { value: 'site_engineer', label: 'Obyekt muhandisi' },
  { value: 'foreman', label: 'Prorab' },
  { value: 'quantity_surveyor', label: 'Smetachi' },
  { value: 'safety_officer', label: 'Xavfsizlik xodimi' },
  { value: 'accountant', label: 'Hisobchi' },
  { value: 'other', label: 'Boshqa' },
];

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-600',
  on_leave: 'bg-yellow-100 text-yellow-700',
  transferred: 'bg-purple-100 text-purple-700',
};

const EMPTY_FORM = {
  employee_id: '',
  role: '',
  phone: '',
  email: '',
  building_id: '',
  responsibilities: '',
  status: 'active',
};

const TeamTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [members, setMembers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferProjectId, setTransferProjectId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [allProjects, setAllProjects] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const loadData = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [teamData, employeesData, buildingData] = await Promise.all([
        constructionService.listTeamMembers(project.id),
        hrService.listEmployees({ limit: 200 }),
        constructionService.listBuildings(project.id),
      ]);
      setMembers(teamData || []);
      setEmployees(employeesData?.items || employeesData || []);
      // Natural-sort so "block 1 / block 2 / block 10" appear in that order
      // wherever the buildings list is surfaced (block picker, etc.).
      setBuildings(sortBuildings(buildingData || []));
    } catch (e) {
      console.error('Failed to load team data:', e);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    constructionService.listProjects().then(data => setAllProjects(data || [])).catch(() => {});
  }, []);

  const openTransfer = (member) => {
    setTransferTarget(member);
    setTransferProjectId('');
    setTransferNotes('');
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    if (!transferProjectId) return;
    setTransferring(true);
    try {
      await constructionService.transferTeamMember(project.id, transferTarget.id, {
        target_project_id: Number(transferProjectId),
        notes: transferNotes,
      });
      setShowTransferModal(false);
      setTransferTarget(null);
      toast.success(t('member_transferred') || "Jamoa a'zosi ko'chirildi");
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setTransferring(false);
    }
  };

  const openCreate = () => {
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setForm({
      employee_id: member.employee_id ? String(member.employee_id) : '',
      role: member.role || '',
      phone: member.phone || '',
      email: member.email || '',
      building_id: member.building_id ? String(member.building_id) : '',
      responsibilities: member.responsibilities || '',
      status: member.status || 'active',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.employee_id && !editingMember) {
      setError(t('validation_employee_required') || 'Xodimni tanlang');
      return;
    }
    if (!form.role) {
      setError(t('validation_role_required') || 'Vazifani tanlang');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        employee_id: form.employee_id || undefined,
        role: form.role,
        phone: form.phone || '',
        email: form.email || '',
        building_id: form.building_id ? Number(form.building_id) : 0,
        responsibilities: form.responsibilities || '',
        status: form.status || 'active',
      };
      if (editingMember) {
        await constructionService.updateTeamMember(project.id, editingMember.id, payload);
      } else {
        await constructionService.addTeamMember(project.id, payload);
      }
      setShowModal(false);
      toast.success(editingMember
        ? (t('member_updated') || "A'zo yangilandi")
        : (t('member_added') || "A'zo qo'shildi")
      );
      loadData();
    } catch (e) {
      setError(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await constructionService.removeTeamMember(project.id, deleteTarget.id);
      setDeleteTarget(null);
      toast.success(t('member_removed') || "A'zo o'chirildi");
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const getRoleLabel = (role) => {
    const found = ROLE_OPTIONS.find(r => r.value === role);
    return found ? found.label : (t(role) || role);
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: t('active') || 'Faol',
      inactive: t('inactive') || 'Nofaol',
      on_leave: t('on_leave') || "Ta'tilda",
      transferred: t('transferred') || "Ko'chirilgan",
    };
    return labels[status] || status;
  };

  const paginatedMembers = members.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('project_team') || 'Loyiha jamoasi'}
            <Badge variant="outline" className="text-xs">{members.length}</Badge>
          </CardTitle>
          <Button onClick={openCreate}>
            <UserPlus className="w-4 h-4 mr-2" />
            {t('add_member') || "A'zo qo'shish"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_team_members') || "Jamoa a'zolari yo'q"}</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <UserPlus className="w-4 h-4 mr-2" />
                {t('add_first_member') || "Birinchi a'zoni qo'shing"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 px-3">{t('name') || 'Ism'}</th>
                    <th className="text-left py-2 px-3">{t('role') || 'Vazifasi'}</th>
                    <th className="text-left py-2 px-3">{t('phone') || 'Telefon'}</th>
                    <th className="text-left py-2 px-3">{t('email') || 'Email'}</th>
                    <th className="text-left py-2 px-3">{t('building') || 'Bino/WBS'}</th>
                    <th className="text-left py-2 px-3">{t('status') || 'Holat'}</th>
                    <th className="text-right py-2 px-3">{t('actions') || 'Amallar'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMembers.map(member => (
                    <tr key={member.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium">{member.employee_name || member.name || 'Xodim'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary">{getRoleLabel(member.role)}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        {member.phone ? (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Phone className="w-3 h-3" />
                            {member.phone}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3">
                        {member.email ? (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Mail className="w-3 h-3" />
                            {member.email}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3">{member.building_name || member.wbs_name || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge className={STATUS_COLORS[member.status] || STATUS_COLORS.active}>
                          {getStatusLabel(member.status)}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          {member.status !== 'transferred' && (
                            <Button variant="ghost" size="sm" title={t('transfer') || "Ko'chirish"} onClick={() => openTransfer(member)}>
                              <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" title={t('edit') || 'Tahrirlash'} onClick={() => openEdit(member)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title={t('delete') || "O'chirish"} onClick={() => setDeleteTarget(member)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Math.ceil(members.length / pageSize) > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-slate-500">
                    {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, members.length)} / {members.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>1</button>
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-medium px-2">{currentPage} / {Math.ceil(members.length / pageSize)}</span>
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= Math.ceil(members.length / pageSize)} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                    <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= Math.ceil(members.length / pageSize)} onClick={() => setCurrentPage(Math.ceil(members.length / pageSize))}>{Math.ceil(members.length / pageSize)}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingMember ? (t('edit_member') || "A'zoni tahrirlash") : (t('add_team_member') || "Jamoa a'zosini qo'shish")}</DialogTitle>
            <DialogDescription className="sr-only">{editingMember ? (t('edit_member') || "A'zoni tahrirlash") : (t('add_team_member') || "Jamoa a'zosini qo'shish")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

            <div>
              <Label>{t('employee') || 'Xodim'} *</Label>
              <Select
                value={form.employee_id || undefined}
                onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_employee') || 'Xodimni tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.first_name} {emp.last_name} {emp.position ? `(${emp.position})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('role') || 'Vazifasi'} *</Label>
              <Select
                value={form.role || undefined}
                onValueChange={v => setForm(f => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_role') || 'Vazifani tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('phone') || 'Telefon'}</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+998 90 123 45 67"
                />
              </div>
              <div>
                <Label>{t('email') || 'Email'}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <Label>{t('member_building') || 'Biriktirilgan bino'}</Label>
              <Select
                value={form.building_id || 'none'}
                onValueChange={v => setForm(f => ({ ...f, building_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_building') || 'Bino tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('no_building') || 'Tanlanmagan'}</SelectItem>
                  {buildings.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('responsibilities') || "Mas'uliyatlari"}</Label>
              <Textarea
                value={form.responsibilities}
                onChange={e => setForm(f => ({ ...f, responsibilities: e.target.value }))}
                placeholder={t('responsibilities_placeholder') || "Xodimning asosiy mas'uliyatlari..."}
                rows={2}
              />
            </div>

            {editingMember && (
              <div>
                <Label>{t('status') || 'Holat'}</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('active') || 'Faol'}</SelectItem>
                    <SelectItem value="inactive">{t('inactive') || 'Nofaol'}</SelectItem>
                    <SelectItem value="on_leave">{t('on_leave') || "Ta'tilda"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (t('saving') || 'Saqlanmoqda...') : (t('save') || 'Saqlash')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_member_title') || "A'zoni o'chirish"}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete_member_desc') || "Bu jamoa a'zosi loyihadan o'chiriladi. Davom etasizmi?"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || "O'chirish"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('transfer_team_member') || "Jamoa a'zosini ko'chirish"}</DialogTitle>
            <DialogDescription className="sr-only">{t('transfer_team_member') || "Jamoa a'zosini ko'chirish"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {transferTarget && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">{transferTarget.employee_name || transferTarget.name}</span>
                {' '}{t('will_be_transferred') || "boshqa loyihaga ko'chiriladi"}
              </p>
            )}

            <div>
              <Label>{t('target_project') || 'Maqsad loyiha'} *</Label>
              <Select
                value={transferProjectId || undefined}
                onValueChange={v => setTransferProjectId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_project') || 'Loyihani tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  {allProjects
                    .filter(p => p.id !== project?.id)
                    .map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('notes') || 'Izoh'}</Label>
              <Textarea
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder={t('transfer_notes_placeholder') || "Ko'chirish sababi..."}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleTransfer} disabled={transferring || !transferProjectId}>
              {transferring ? (t('transferring') || "Ko'chirilmoqda...") : (t('transfer') || "Ko'chirish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamTab;
