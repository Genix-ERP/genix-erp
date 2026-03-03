import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  Edit,
  MoreHorizontal,
  ClipboardList,
  Users,
  Cloud,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { format } from 'date-fns';

const DailyJournalTab = ({ project, buildings = [] }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [stages, setStages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null });
  const [form, setForm] = useState({
    id: null,
    building_id: '',
    stage_id: '',
    date: new Date().toISOString().split('T')[0],
    end_date: '',
    workers_count: '',
    expected_budget: '',
    weather: '',
    description: '',
    issues: '',
  });

  // Load logs
  const loadLogs = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const params = { page, limit };
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;

      const result = await constructionService.listConstructionDailyLogs(project.id, params);
      setLogs(result?.data || []);
      setTotal(result?.pagination?.total || result?.total || 0);
    } catch (error) {
      console.error('Error loading daily logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [project?.id, page, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!project?.id) return;
    constructionService.listStages(project.id)
      .then(data => setStages(data || []))
      .catch(() => setStages([]));
  }, [project?.id]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterDateFrom, filterDateTo]);

  // Create/update log
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const data = {
        building_id: form.building_id ? parseInt(form.building_id) : 0,
        stage_id: form.stage_id ? parseInt(form.stage_id) : 0,
        date: form.date,
        end_date: form.end_date || null,
        workers_count: parseInt(form.workers_count) || 0,
        expected_budget: parseFloat(form.expected_budget) || 0,
        weather: form.weather,
        description: form.description,
        issues: form.issues,
      };

      if (form.id) {
        await constructionService.updateConstructionDailyLog(form.id, data);
      } else {
        await constructionService.createConstructionDailyLog(project.id, data);
      }

      setShowModal(false);
      resetForm();
      await loadLogs();
    } catch (error) {
      console.error('Error saving daily log:', error);
    }
  };

  // Delete log
  const handleDelete = (logId) => {
    setConfirmDialog({
      open: true,
      title: t('delete') || "O'chirish",
      description: t('confirm_delete') || "O'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.",
      onConfirm: async () => {
        try {
          await constructionService.deleteConstructionDailyLog(logId);
          await loadLogs();
        } catch (error) {
          console.error('Error deleting daily log:', error);
        }
      },
    });
  };

  const resetForm = () => {
    setForm({
      id: null, building_id: '', stage_id: '', date: new Date().toISOString().split('T')[0],
      end_date: '', workers_count: '', expected_budget: '', weather: '', description: '', issues: '',
    });
  };

  const openEditModal = (log) => {
    setForm({
      id: log.id,
      building_id: log.building_id ? String(log.building_id) : '',
      stage_id: log.stage_id ? String(log.stage_id) : '',
      date: log.date ? format(new Date(log.date), 'yyyy-MM-dd') : '',
      end_date: log.end_date ? format(new Date(log.end_date), 'yyyy-MM-dd') : '',
      workers_count: String(log.workers_count || ''),
      expected_budget: String(log.expected_budget || ''),
      weather: log.weather || '',
      description: log.description || '',
      issues: log.issues || '',
    });
    setShowModal(true);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-800">
          {t('daily_journal') || 'Kunlik jurnal (WBS)'}
        </h3>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          {t('new_entry') || 'Yangi yozuv'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs text-slate-500">{t('from') || 'Dan'}</Label>
              <Input
                type="date" className="h-9 w-40"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">{t('to') || 'Gacha'}</Label>
              <Input
                type="date" className="h-9 w-40"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">{t('loading') || 'Yuklanmoqda...'}</CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_daily_logs') || 'Kunlik yozuvlar mavjud emas'}</p>
            <p className="text-sm text-slate-400 mt-1">{t('daily_log_hint') || 'WBS bandlariga bog\'liq kunlik ish hajmini kiriting'}</p>
            <Button variant="outline" className="mt-4" onClick={() => { resetForm(); setShowModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('add_first_entry') || "Birinchi yozuvni qo'shing"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{format(new Date(log.date), 'dd.MM.yyyy')}</p>
                      {log.end_date && (
                        <span className="text-sm text-slate-500">→ {format(new Date(log.end_date), 'dd.MM.yyyy')}</span>
                      )}
                    </div>
                    {(log.building_name || log.stage_name) && (
                      <div className="flex items-center gap-3 mt-0.5">
                        {log.building_name && (
                          <p className="text-xs text-slate-400">{log.building_name}</p>
                        )}
                        {log.stage_name && (
                          <span className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                            <Layers className="w-3 h-3" />
                            {log.stage_name}
                          </span>
                        )}
                      </div>
                    )}
                    {log.stage_name && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500 transition-all"
                            style={{ width: `${log.stage_progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{log.stage_progress || 0}%</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      {log.workers_count > 0 && (
                        <span className="text-slate-500">
                          <Users className="w-3.5 h-3.5 inline mr-1" />
                          {log.workers_count} {t('workers') || 'ishchi'}
                        </span>
                      )}
                      {log.weather && (
                        <span className="text-slate-400">
                          <Cloud className="w-3.5 h-3.5 inline mr-1" />
                          {log.weather}
                        </span>
                      )}
                    </div>
                    {log.description && (
                      <p className="mt-2 text-sm text-slate-700 line-clamp-2">{log.description}</p>
                    )}
                    {log.issues && (
                      <div className="mt-2 flex items-start gap-1.5 text-sm text-orange-600">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{log.issues}</span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(log)}>
                        <Edit className="w-4 h-4 mr-2" />
                        {t('edit') || 'Tahrirlash'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(log.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('delete') || "O'chirish"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {log.reported_name && (
                  <p className="mt-2 text-xs text-slate-400">{t('reported_by') || 'Kiritgan'}: {log.reported_name}</p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-slate-500">
                {t('showing') || "Ko'rsatilmoqda"} {(page - 1) * limit + 1}-{Math.min(page * limit, total)} / {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {form.id ? (t('edit_daily_log') || 'Yozuvni tahrirlash') : (t('new_daily_log') || 'Yangi kunlik yozuv')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('building') || 'Bino'}</Label>
                  <Select value={form.building_id || "none"} onValueChange={(val) => setForm({ ...form, building_id: val === "none" ? "" : val })}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {buildings.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('stage') || 'Bosqich'}</Label>
                  <Select value={form.stage_id || "none"} onValueChange={(val) => setForm({ ...form, stage_id: val === "none" ? "" : val })}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {stages.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('date') || 'Sana'} *</Label>
                  <Input
                    type="date" className="h-8"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('end_date') || 'Tugash sanasi'}</Label>
                  <Input
                    type="date" className="h-8"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('workers_count') || 'Ishchilar soni'}</Label>
                  <Input
                    type="number" min="0" className="h-8"
                    value={form.workers_count}
                    onChange={(e) => setForm({ ...form, workers_count: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('expected_budget') || 'Kutilgan byudjet'}</Label>
                  <Input
                    type="number" min="0" step="0.01" className="h-8"
                    value={form.expected_budget}
                    onChange={(e) => setForm({ ...form, expected_budget: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">{t('weather') || "Ob-havo"}</Label>
                <Input
                  className="h-8"
                  value={form.weather}
                  onChange={(e) => setForm({ ...form, weather: e.target.value })}
                  placeholder={t('weather_placeholder') || "Quyoshli, 25°C"}
                />
              </div>

              <div>
                <Label className="text-xs">{t('description') || 'Tavsif'}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('work_description_placeholder') || "Bajarilgan ishlar tavsifi..."}
                  rows={2}
                />
              </div>

              <div>
                <Label className="text-xs">{t('issues') || "Muammolar"}</Label>
                <Textarea
                  value={form.issues}
                  onChange={(e) => setForm({ ...form, issues: e.target.value })}
                  placeholder={t('issues_placeholder') || "Uchragan muammolar..."}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!form.date}>
                {form.id ? (t('save') || 'Saqlash') : (t('add') || "Qo'shish")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                confirmDialog.onConfirm?.();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DailyJournalTab;
