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
import { Plus, Edit, Trash2, Layers, X } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

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
  const [subStagesMap, setSubStagesMap] = useState({}); // { [stageId]: SubStage[] }
  const [loading, setLoading] = useState(true);

  // Stage modal
  const [showModal, setShowModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Inline sub-stages in modal: [{ _key, id?, name, status }]
  const [modalSubStages, setModalSubStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Delete confirmations
  const [deleteStage, setDeleteStage] = useState(null);
  const [deleteSubStage, setDeleteSubStage] = useState(null); // { sub, stageId }

  const loadAllSubStages = useCallback(async (stageList) => {
    if (!stageList.length) return;
    const results = await Promise.allSettled(
      stageList.map(s => constructionService.listSubStages(s.id))
    );
    const map = {};
    stageList.forEach((s, i) => {
      map[s.id] = results[i].status === 'fulfilled' ? (results[i].value || []) : [];
    });
    setSubStagesMap(map);
  }, []);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await constructionService.listStages(project.id);
      const list = data || [];
      setStages(list);
      await loadAllSubStages(list);
    } catch (e) {
      console.error('Failed to load stages:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id, loadAllSubStages]);

  useEffect(() => { load(); }, [load]);

  const reloadSubStages = async (stageId) => {
    try {
      const data = await constructionService.listSubStages(stageId);
      setSubStagesMap(prev => ({ ...prev, [stageId]: data || [] }));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────

  const openCreate = () => {
    setEditingStage(null);
    setForm({ ...EMPTY_FORM, stage_order: stages.length });
    setModalSubStages([]);
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
    // Load existing sub-stages into modal
    const existing = (subStagesMap[stage.id] || []).map(s => ({
      _key: s.id,
      id: s.id,
      name: s.name,
      status: s.status,
    }));
    setModalSubStages(existing);
    setError(null);
    setShowModal(true);
  };

  const addModalSubStage = () => {
    setModalSubStages(prev => [...prev, { _key: Date.now(), name: '', status: 'not_started' }]);
  };

  const updateModalSubStage = (key, field, value) => {
    setModalSubStages(prev => prev.map(s => s._key === key ? { ...s, [field]: value } : s));
  };

  const removeModalSubStage = (key) => {
    setModalSubStages(prev => prev.filter(s => s._key !== key));
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

      let stageId;
      if (editingStage) {
        await constructionService.updateStage(editingStage.id, payload);
        stageId = editingStage.id;

        // Sync sub-stages: delete removed ones, create new ones, update changed ones
        const existing = subStagesMap[stageId] || [];
        const existingIds = new Set(existing.map(s => s.id));
        const modalIds = new Set(modalSubStages.filter(s => s.id).map(s => s.id));

        // Delete removed
        for (const s of existing) {
          if (!modalIds.has(s.id)) {
            await constructionService.deleteSubStage(s.id).catch(() => {});
          }
        }
        // Create new / update existing
        for (const s of modalSubStages) {
          if (!s.name.trim()) continue;
          if (s.id && existingIds.has(s.id)) {
            await constructionService.updateSubStage(s.id, { name: s.name, status: s.status });
          } else if (!s.id) {
            await constructionService.createSubStage(stageId, { name: s.name, status: s.status });
          }
        }
      } else {
        const res = await constructionService.createStage(project.id, payload);
        stageId = res?.id;
        // Create sub-stages
        if (stageId) {
          for (const s of modalSubStages) {
            if (!s.name.trim()) continue;
            await constructionService.createSubStage(stageId, { name: s.name, status: s.status });
          }
        }
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
      toast.error(e?.response?.data?.message || t('error_occurred'));
    }
  };

  const handleSubDelete = async () => {
    if (!deleteSubStage) return;
    try {
      await constructionService.deleteSubStage(deleteSubStage.sub.id);
      setDeleteSubStage(null);
      reloadSubStages(deleteSubStage.stageId);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred'));
    }
  };

  const handleSubStatusChange = async (stageId, subId, newStatus) => {
    // Optimistically update local state
    setSubStagesMap(prev => ({
      ...prev,
      [stageId]: (prev[stageId] || []).map(s => s.id === subId ? { ...s, status: newStatus } : s),
    }));

    try {
      await constructionService.updateSubStage(subId, { status: newStatus });

      // Check if all sub-stages are now completed
      const updatedSubs = (subStagesMap[stageId] || []).map(s => s.id === subId ? { ...s, status: newStatus } : s);
      const allDone = updatedSubs.length > 0 && updatedSubs.every(s => s.status === 'completed');

      if (allDone) {
        // Auto-complete the parent stage
        const stage = stages.find(s => s.id === stageId);
        if (stage && stage.status !== 'completed') {
          await constructionService.updateStage(stageId, { status: 'completed' });
          setStages(prev => prev.map(s => s.id === stageId ? { ...s, status: 'completed' } : s));
        }
      } else {
        // If at least one is in progress, set stage to in_progress
        const stage = stages.find(s => s.id === stageId);
        const anyInProgress = updatedSubs.some(s => s.status === 'in_progress' || s.status === 'completed');
        if (stage && stage.status === 'not_started' && anyInProgress) {
          await constructionService.updateStage(stageId, { status: 'in_progress' });
          setStages(prev => prev.map(s => s.id === stageId ? { ...s, status: 'in_progress' } : s));
        } else if (stage && stage.status === 'completed' && !allDone) {
          await constructionService.updateStage(stageId, { status: 'in_progress' });
          setStages(prev => prev.map(s => s.id === stageId ? { ...s, status: 'in_progress' } : s));
        }
      }
    } catch (e) {
      // Revert on error
      reloadSubStages(stageId);
    }
  };

  // Progress based on sub-stages if they exist, else budget
  const getProgress = (stage) => {
    const subs = subStagesMap[stage.id];
    if (subs && subs.length > 0) {
      return (subs.filter(s => s.status === 'completed').length / subs.length) * 100;
    }
    if (stage.planned_budget > 0) {
      return Math.min(100, (stage.actual_amount / stage.planned_budget) * 100);
    }
    return 0;
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
                const subs = subStagesMap[stage.id] || [];
                const pct = getProgress(stage);
                const overBudget = stage.actual_amount > stage.planned_budget && stage.planned_budget > 0;

                return (
                  <div key={stage.id} className="border rounded-lg overflow-hidden">
                    {/* Stage header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold">{stage.name}</span>
                            <Badge className={STATUS_COLORS[stage.status] || 'bg-slate-100 text-slate-700'}>
                              {STATUS_LABELS[stage.status] || stage.status}
                            </Badge>
                            {overBudget && subs.length === 0 && (
                              <Badge className="bg-red-100 text-red-700">{t('over_budget') || 'Over budget'}</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-slate-600 mb-3">
                            {stage.planned_start && <span>{t('planned_start')}: {stage.planned_start}</span>}
                            {stage.planned_end && <span>{t('planned_end')}: {stage.planned_end}</span>}
                            {stage.planned_budget > 0 && <span>{t('planned_budget')}: {formatCurrency(stage.planned_budget)}</span>}
                            {stage.actual_amount > 0 && (
                              <span className={overBudget ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                                {t('actual_expenses')}: {formatCurrency(stage.actual_amount)}
                              </span>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-slate-400'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 min-w-[36px] text-right">{pct.toFixed(0)}%</span>
                            {subs.length > 0 && (
                              <span className="text-xs text-slate-400">
                                ({subs.filter(s => s.status === 'completed').length}/{subs.length})
                              </span>
                            )}
                          </div>
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

                    {/* Sub-stages — always visible */}
                    {subs.length > 0 && (
                      <div className="border-t bg-slate-50 px-4 py-2 space-y-1">
                        {subs.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between bg-white rounded border px-3 py-1.5">
                            <div className="flex items-center gap-2 flex-1">
                              <Select
                                value={sub.status}
                                onValueChange={v => handleSubStatusChange(stage.id, sub.id, v)}
                              >
                                <SelectTrigger className={`h-6 w-32 text-xs border-0 p-1 font-medium ${STATUS_COLORS[sub.status] || 'bg-slate-100 text-slate-700'}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="not_started">{STATUS_LABELS.not_started}</SelectItem>
                                  <SelectItem value="in_progress">{STATUS_LABELS.in_progress}</SelectItem>
                                  <SelectItem value="completed">{STATUS_LABELS.completed}</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="text-sm">{sub.name}</span>
                            </div>
                            <Button
                              variant="ghost" size="sm"
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => setDeleteSubStage({ sub, stageId: stage.id })}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Stage Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
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
              <Label>{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} />
            </div>

            {/* Inline sub-stages */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('sub_stages')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addModalSubStage}>
                  <Plus className="w-3 h-3 mr-1" />
                  {t('add_sub_stage')}
                </Button>
              </div>
              {modalSubStages.length > 0 && (
                <div className="space-y-2 border rounded-md p-2 bg-slate-50">
                  {modalSubStages.map(sub => (
                    <div key={sub._key} className="flex items-center gap-2">
                      <Input
                        value={sub.name}
                        onChange={e => updateModalSubStage(sub._key, 'name', e.target.value)}
                        placeholder={t('sub_stage_name_placeholder')}
                        className="flex-1 h-8 text-sm"
                      />
                      <Select value={sub.status} onValueChange={v => updateModalSubStage(sub._key, 'status', v)}>
                        <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">{t('not_started')}</SelectItem>
                          <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                          <SelectItem value="completed">{t('completed')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button" variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                        onClick={() => removeModalSubStage(sub._key)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Stage Confirmation */}
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

      {/* Delete Sub-Stage Confirmation */}
      <AlertDialog open={!!deleteSubStage} onOpenChange={() => setDeleteSubStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_sub_stage_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteSubStage?.sub?.name}" {t('delete_sub_stage_desc_suffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubDelete} className="bg-red-600 hover:bg-red-700">{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StagesTab;
