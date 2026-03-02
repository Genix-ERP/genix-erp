import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Layers } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const STATUS_COLORS = {
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const EMPTY_FORM = {
  name: '',
  stage_order: 0,
  status: 'not_started',
  planned_budget: '',
  planned_start: '',
  planned_end: '',
  notes: '',
};

const StagesTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const STATUS_LABELS = {
    not_started: t('not_started') || 'Not started',
    in_progress: t('in_progress') || 'In progress',
    completed: t('completed') || 'Completed',
  };

  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [deleteStage, setDeleteStage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await constructionService.listStages(project.id);
      setStages(data || []);
    } catch (e) {
      console.error('Failed to load stages:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingStage(null);
    setForm({ ...EMPTY_FORM, stage_order: stages.length });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (stage) => {
    setEditingStage(stage);
    setForm({
      name: stage.name || '',
      stage_order: stage.stage_order || 0,
      status: stage.status || 'not_started',
      planned_budget: stage.planned_budget ? String(stage.planned_budget) : '',
      planned_start: stage.planned_start ? stage.planned_start.slice(0, 10) : '',
      planned_end: stage.planned_end ? stage.planned_end.slice(0, 10) : '',
      notes: stage.notes || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('stage_name_required')); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        status: form.status || 'not_started',
        stage_order: Number(form.stage_order) || 0,
        planned_budget: form.planned_budget ? parseFloat(parsePriceInput(form.planned_budget)) : 0,
        planned_start: form.planned_start || '',
        planned_end: form.planned_end || '',
        notes: form.notes || '',
      };
      if (editingStage) {
        await constructionService.updateStage(editingStage.id, payload);
      } else {
        await constructionService.createStage(project.id, payload);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || t('error_occurred'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteStage) return;
    try {
      await constructionService.deleteStage(deleteStage.id);
      setDeleteStage(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || t('error_occurred'));
    }
  };

  const totalPlanned = stages.reduce((s, st) => s + (st.planned_budget || 0), 0);
  const totalActual = stages.reduce((s, st) => s + (st.actual_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('total_stages')}</p>
          <p className="text-2xl font-bold">{stages.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('planned_budget_total')}</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPlanned)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('actual_expenses')}</p>
          <p className={`text-2xl font-bold ${totalActual > totalPlanned ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(totalActual)}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            {t('construction_stages')}
          </CardTitle>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t('add_stage')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">{t('loading')}</div>
          ) : stages.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_stages')}</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                {t('add_first_stage')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map((stage) => {
                const pct = stage.planned_budget > 0 ? Math.min(100, (stage.actual_amount / stage.planned_budget) * 100) : 0;
                const overBudget = stage.actual_amount > stage.planned_budget && stage.planned_budget > 0;
                return (
                  <div key={stage.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold">{stage.name}</span>
                          <Badge className={STATUS_COLORS[stage.status] || 'bg-slate-100 text-slate-700'}>
                            {STATUS_LABELS[stage.status] || stage.status}
                          </Badge>
                          {overBudget && (
                            <Badge className="bg-red-100 text-red-700">{t('over_budget') || 'Over budget'}</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-slate-600 mb-3">
                          {stage.planned_start && (
                            <span>{t('planned_start')}: {stage.planned_start}</span>
                          )}
                          {stage.planned_end && (
                            <span>{t('planned_end')}: {stage.planned_end}</span>
                          )}
                          {stage.planned_budget > 0 && (
                            <span>{t('planned_budget')}: {formatCurrency(stage.planned_budget)}</span>
                          )}
                          {stage.actual_amount > 0 && (
                            <span className={overBudget ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                              {t('actual_expenses')}: {formatCurrency(stage.actual_amount)}
                            </span>
                          )}
                        </div>
                        {stage.planned_budget > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${overBudget ? 'bg-red-500' : pct > 90 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 min-w-[40px] text-right">{pct.toFixed(0)}%</span>
                          </div>
                        )}
                        {stage.notes && <p className="text-xs text-slate-400 mt-2">{stage.notes}</p>}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(stage)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteStage(stage)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStage ? t('edit_stage') : t('new_stage')}</DialogTitle>
            <DialogDescription className="sr-only">{editingStage ? t('edit_stage') : t('new_stage')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div>
              <Label>{t('stage_name')}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder={t('stage_name_placeholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('stage_status')}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">{t('not_started')}</SelectItem>
                    <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                    <SelectItem value="completed">{t('completed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('stage_order')}</Label>
                <Input type="number" value={form.stage_order} onChange={e => setForm(f => ({...f, stage_order: e.target.value}))} />
              </div>
            </div>
            <div>
              <Label>{t('planned_budget')}</Label>
              <Input value={form.planned_budget} onChange={e => setForm(f => ({...f, planned_budget: formatPriceInput(e.target.value)}))} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('planned_start')}</Label>
                <Input type="date" value={form.planned_start} onChange={e => setForm(f => ({...f, planned_start: e.target.value}))} />
              </div>
              <div>
                <Label>{t('planned_end')}</Label>
                <Input type="date" value={form.planned_end} onChange={e => setForm(f => ({...f, planned_end: e.target.value}))} />
              </div>
            </div>
            <div>
              <Label>{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteStage} onOpenChange={() => setDeleteStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_stage_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteStage?.name}" {t('delete_stage_desc_suffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StagesTab;
