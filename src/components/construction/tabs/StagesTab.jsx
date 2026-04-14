import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import inventoryService from '@/api/services/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Layers, X, ChevronDown, ChevronRight, Package, Truck, Users, ShieldCheck } from 'lucide-react';
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
    not_started: t('not_started'),
    in_progress: t('in_progress'),
    completed: t('completed'),
  };

  const [stages, setStages] = useState([]);
  const [subStagesMap, setSubStagesMap] = useState({}); // { [stageId]: SubStage[] }
  const [loading, setLoading] = useState(true);

  // Stage modal
  const [showModal, setShowModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalSubStages, setModalSubStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Delete confirmations
  const [deleteStage, setDeleteStage] = useState(null);
  const [deleteSubStage, setDeleteSubStage] = useState(null);

  // Quick add sub-stage
  const [quickAddStageId, setQuickAddStageId] = useState(null);
  const [quickAddName, setQuickAddName] = useState('');

  // Materials
  const [expandedSubStage, setExpandedSubStage] = useState(null); // sub-stage id
  const [subStageMaterials, setSubStageMaterials] = useState({}); // { [subStageId]: Material[] }
  const [materialsLoading, setMaterialsLoading] = useState(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialSubStageId, setMaterialSubStageId] = useState(null);
  const [materialForm, setMaterialForm] = useState({ product_id: '', product_name: '', uom: 'шт', quantity: '', unit_cost: '' });
  const [inventoryProducts, setInventoryProducts] = useState([]);
  // Estimate resources for equipment/employee tabs
  const [estimateEquipmentResources, setEstimateEquipmentResources] = useState([]);
  const [estimateLaborResources, setEstimateLaborResources] = useState([]);
  // Unified modal tab: 'materials' | 'equipment' | 'employee'
  const [modalTab, setModalTab] = useState('materials');
  // Equipment/Employee form (shared)
  const [equipmentForm, setEquipmentForm] = useState({ name: '', work_unit: 'soat', quantity: '', unit_price: '' });
  // Sub-stage equipment data (includes both equipment and employee/labor entries)
  const [subStageEquipment, setSubStageEquipment] = useState({});
  const [equipmentLoading, setEquipmentLoading] = useState(null);

  // Load inventory products + estimate resources for dropdowns
  useEffect(() => {
    if (!project?.id) return;
    // Load inventory products (deduplicate by product_id, aggregate stock)
    inventoryService.listInventory({ limit: 500 })
      .then(d => {
        const map = {};
        (d || []).forEach(item => {
          if (map[item.product_id]) {
            map[item.product_id].quantity_on_hand += item.quantity_on_hand || 0;
            map[item.product_id].quantity_available += item.quantity_available || 0;
            map[item.product_id].quantity_reserved += item.quantity_reserved || 0;
          } else {
            map[item.product_id] = { ...item };
          }
        });
        setInventoryProducts(Object.values(map));
      })
      .catch(() => setInventoryProducts([]));
    // Load estimate resources by type for equipment/employee dropdowns
    constructionService.listEstimateResources(project.id, 'equipment')
      .then(d => setEstimateEquipmentResources(d || []))
      .catch(() => setEstimateEquipmentResources([]));
    constructionService.listEstimateResources(project.id, 'labor')
      .then(d => setEstimateLaborResources(d || []))
      .catch(() => setEstimateLaborResources([]));
  }, [project?.id]);

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

  // Materials helpers
  const loadSubStageMaterials = async (subStageId) => {
    setMaterialsLoading(subStageId);
    try {
      const data = await constructionService.listSubStageMaterials(subStageId);
      setSubStageMaterials(prev => ({ ...prev, [subStageId]: data || [] }));
    } catch (e) {
      console.error(e);
    } finally {
      setMaterialsLoading(null);
    }
  };

  const loadSubStageEquipment = async (subStageId) => {
    setEquipmentLoading(subStageId);
    try {
      const data = await constructionService.listSubStageEquipment(subStageId);
      setSubStageEquipment(prev => ({ ...prev, [subStageId]: data || [] }));
    } catch (e) {
      console.error('Failed to load sub-stage equipment:', e);
      setSubStageEquipment(prev => ({ ...prev, [subStageId]: [] }));
    } finally {
      setEquipmentLoading(null);
    }
  };

  const handleDeleteEquipment = async (equipmentId, subStageId) => {
    try {
      await constructionService.deleteSubStageEquipment(equipmentId);
      await loadSubStageEquipment(subStageId);
      const stageId = findStageForSubStage(subStageId);
      if (stageId) await reloadSubStages(stageId);
    } catch (e) {
      console.error('Failed to delete equipment:', e);
      toast.error(t('error_occurred'));
    }
  };

  const toggleSubStageMaterials = (subStageId) => {
    if (expandedSubStage === subStageId) {
      setExpandedSubStage(null);
    } else {
      setExpandedSubStage(subStageId);
      if (!subStageMaterials[subStageId]) {
        loadSubStageMaterials(subStageId);
      }
      if (!subStageEquipment[subStageId]) {
        loadSubStageEquipment(subStageId);
      }
    }
  };

  const openAddMaterial = (subStageId) => {
    setMaterialSubStageId(subStageId);
    setMaterialForm({ product_id: '', product_name: '', uom: 'шт', quantity: '', unit_cost: '' });
    setEquipmentForm({ name: '', work_unit: 'soat', quantity: '', unit_price: '' });
    setModalTab('materials');
    setShowMaterialModal(true);
  };

  const handleAddMaterial = async () => {
    if (!materialForm.product_name.trim() || !materialSubStageId) return;
    try {
      await constructionService.createSubStageMaterial(materialSubStageId, {
        product_id: materialForm.product_id || '',
        product_name: materialForm.product_name,
        uom: materialForm.uom || 'шт',
        quantity: parseFloat(materialForm.quantity) || 0,
        unit_cost: parseFloat(parsePriceInput(materialForm.unit_cost)) || 0,
      });
      // If product selected from inventory, create reservation
      if (materialForm.product_id) {
        const stageId = findStageForSubStage(materialSubStageId);
        try {
          await inventoryService.createReservation({
            project_id: project.id,
            stage_id: stageId || 0,
            substage_id: materialSubStageId,
            product_id: materialForm.product_id,
            quantity: parseFloat(materialForm.quantity) || 0,
            unit_cost: parseFloat(parsePriceInput(materialForm.unit_cost)) || 0,
          });
        } catch (reserveErr) {
          console.error('Reservation creation failed:', reserveErr);
        }
      }
      setShowMaterialModal(false);
      await loadSubStageMaterials(materialSubStageId);
      const stageId = findStageForSubStage(materialSubStageId);
      if (stageId) await reloadSubStages(stageId);
      const data = await constructionService.listStages(project.id);
      setStages(data || []);
    } catch (e) {
      toast.error(t('error_occurred'));
    }
  };

  const handleAddEquipment = async () => {
    if (!equipmentForm.name.trim() || !materialSubStageId) return;
    try {
      const qty = parseFloat(equipmentForm.quantity) || 0;
      const price = parseFloat(parsePriceInput(equipmentForm.unit_price)) || 0;
      await constructionService.createSubStageEquipment(materialSubStageId, {
        name: equipmentForm.name,
        type: modalTab === 'employee' ? 'employee' : 'equipment',
        work_unit: equipmentForm.work_unit || 'soat',
        quantity: qty,
        plan_quantity: qty,
        unit_price: price,
      });
      setShowMaterialModal(false);
      await loadSubStageMaterials(materialSubStageId);
      await loadSubStageEquipment(materialSubStageId);
      const stageId = findStageForSubStage(materialSubStageId);
      if (stageId) await reloadSubStages(stageId);
      const data = await constructionService.listStages(project.id);
      setStages(data || []);
    } catch (e) {
      toast.error(t('error_occurred'));
    }
  };

  const handleDeleteMaterial = async (materialId, subStageId) => {
    try {
      await constructionService.deleteSubStageMaterial(materialId);
      await loadSubStageMaterials(subStageId);
      const stageId = findStageForSubStage(subStageId);
      if (stageId) await reloadSubStages(stageId);
      const data = await constructionService.listStages(project.id);
      setStages(data || []);
    } catch (e) {
      toast.error(t('error_occurred'));
    }
  };

  const findStageForSubStage = (subStageId) => {
    for (const [stageId, subs] of Object.entries(subStagesMap)) {
      if (subs.some(s => s.id === subStageId)) return parseInt(stageId);
    }
    return null;
  };

  // Quick add sub-stage inline
  const handleQuickAddSubStage = async (stageId) => {
    const name = quickAddName.trim();
    if (!name) return;
    try {
      await constructionService.createSubStage(stageId, { name, status: 'not_started' });
      await reloadSubStages(stageId);
      setQuickAddStageId(null);
      setQuickAddName('');
    } catch (e) {
      toast.error(t('error_occurred'));
    }
  };

  // ── Stage Modal helpers ─────────────────────────────────────────────

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
    const existing = (subStagesMap[stage.id] || []).map(s => ({
      _key: s.id, id: s.id, name: s.name, status: s.status,
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

        const existing = subStagesMap[stageId] || [];
        const existingIds = new Set(existing.map(s => s.id));
        const modalIds = new Set(modalSubStages.filter(s => s.id).map(s => s.id));

        for (const s of existing) {
          if (!modalIds.has(s.id)) {
            await constructionService.deleteSubStage(s.id).catch(() => {});
          }
        }
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
    setSubStagesMap(prev => ({
      ...prev,
      [stageId]: (prev[stageId] || []).map(s => s.id === subId ? { ...s, status: newStatus } : s),
    }));

    try {
      await constructionService.updateSubStage(subId, { status: newStatus });

      const updatedSubs = (subStagesMap[stageId] || []).map(s => s.id === subId ? { ...s, status: newStatus } : s);
      const allDone = updatedSubs.length > 0 && updatedSubs.every(s => s.status === 'completed');

      if (allDone) {
        const stage = stages.find(s => s.id === stageId);
        if (stage && stage.status !== 'completed') {
          await constructionService.updateStage(stageId, { status: 'completed' });
          setStages(prev => prev.map(s => s.id === stageId ? { ...s, status: 'completed' } : s));
        }
      } else {
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
      reloadSubStages(stageId);
    }
  };

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
  const totalMaterials = stages.reduce((s, st) => s + (st.material_total || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('materials')}</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalMaterials)}</p>
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
                              <Badge className="bg-red-100 text-red-700">{t('over_budget')}</Badge>
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
                          {/* Material / equipment / labor totals for stage */}
                          {(stage.material_total > 0 || stage.equipment_total > 0 || stage.labor_total > 0) && (
                            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3 text-sm">
                              {stage.material_total > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Package className="w-4 h-4 text-amber-500" />
                                  <span className="text-amber-700 font-medium">
                                    {t('materials')}: {formatCurrency(stage.material_total)}
                                  </span>
                                </div>
                              )}
                              {stage.equipment_total > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Truck className="w-4 h-4 text-blue-500" />
                                  <span className="text-blue-700 font-medium">
                                    {t('equipment') || 'Texnika'}: {formatCurrency(stage.equipment_total)}
                                  </span>
                                </div>
                              )}
                              {stage.labor_total > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-green-500" />
                                  <span className="text-green-700 font-medium">
                                    {t('labor') || 'Ishchi kuchi'}: {formatCurrency(stage.labor_total)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
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
                          <Button variant="ghost" size="sm" title={t('add_sub_stage')} onClick={() => { setQuickAddStageId(stage.id); setQuickAddName(''); }}>
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(stage)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteStage(stage)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Quick add sub-stage inline */}
                    {quickAddStageId === stage.id && (
                      <div className="border-t bg-slate-50 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            value={quickAddName}
                            onChange={e => setQuickAddName(e.target.value)}
                            placeholder={t('sub_stage_name_placeholder')}
                            className="flex-1 h-8 text-sm"
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleQuickAddSubStage(stage.id);
                              if (e.key === 'Escape') { setQuickAddStageId(null); setQuickAddName(''); }
                            }}
                          />
                          <Button size="sm" className="h-8" onClick={() => handleQuickAddSubStage(stage.id)} disabled={!quickAddName.trim()}>
                            {t('add')}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setQuickAddStageId(null); setQuickAddName(''); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Sub-stages — always visible */}
                    {subs.length > 0 && (
                      <div className="border-t bg-slate-50 px-4 py-2 space-y-1">
                        {subs.map(sub => {
                          const isExpanded = expandedSubStage === sub.id;
                          const materials = subStageMaterials[sub.id] || [];
                          const isLoadingMats = materialsLoading === sub.id;
                          const allEquipment = subStageEquipment[sub.id] || [];
                          const equipmentItems = allEquipment.filter(e => e.type !== 'employee');
                          const laborItems = allEquipment.filter(e => e.type === 'employee');
                          const isLoadingEquip = equipmentLoading === sub.id;
                          const equipmentTotalLocal = equipmentItems.reduce((s, e) => s + (e.total_cost || (e.quantity || e.plan_quantity || 0) * (e.unit_price || 0)), 0);
                          const laborTotalLocal = laborItems.reduce((s, e) => s + (e.total_cost || (e.quantity || e.plan_quantity || 0) * (e.unit_price || 0)), 0);
                          // Prefer backend-provided aggregates (shown without needing to expand); fall back to client values after loading
                          const equipmentCountDisplay = equipmentItems.length > 0 ? equipmentItems.length : (sub.equipment_count || 0);
                          const equipmentTotalDisplay = equipmentItems.length > 0 ? equipmentTotalLocal : (sub.equipment_total || 0);
                          const laborCountDisplay = laborItems.length > 0 ? laborItems.length : (sub.labor_count || 0);
                          const laborTotalDisplay = laborItems.length > 0 ? laborTotalLocal : (sub.labor_total || 0);

                          return (
                            <div key={sub.id}>
                              <div
                                className="flex items-center justify-between bg-white rounded border px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleSubStageMaterials(sub.id)}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div onClick={e => e.stopPropagation()}>
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
                                  </div>
                                  <span className="text-sm">{sub.name}</span>
                                  <div className="flex items-center gap-2 ml-auto mr-2 text-xs font-medium">
                                    {sub.material_total > 0 && (
                                      <span className="text-amber-600">
                                        {sub.material_count} mat. &middot; {formatCurrency(sub.material_total)}
                                      </span>
                                    )}
                                    {equipmentTotalDisplay > 0 && (
                                      <span className="text-blue-600">
                                        {equipmentCountDisplay} tex. &middot; {formatCurrency(equipmentTotalDisplay)}
                                      </span>
                                    )}
                                    {laborTotalDisplay > 0 && (
                                      <span className="text-green-600">
                                        {laborCountDisplay} ish. &middot; {formatCurrency(laborTotalDisplay)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                  <Button
                                    variant="ghost" size="sm"
                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                    onClick={(e) => { e.stopPropagation(); setDeleteSubStage({ sub, stageId: stage.id }); }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded materials/equipment/labor list */}
                              {isExpanded && (
                                <div className="ml-4 mt-1 mb-2 border rounded bg-white p-2 space-y-3">
                                  {/* Materials section */}
                                  <div>
                                    <div className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                                      <Package className="w-3 h-3" />
                                      {t('materials') || 'Materiallar'}
                                    </div>
                                    {isLoadingMats ? (
                                      <p className="text-xs text-slate-400 py-2 text-center">{t('loading')}</p>
                                    ) : materials.length === 0 ? (
                                      <p className="text-xs text-slate-400 py-2 text-center">{t('no_items')}</p>
                                    ) : (
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b text-slate-500">
                                            <th className="text-left py-1 px-1">{t('name')}</th>
                                            <th className="text-right py-1 px-1">{t('unit')}</th>
                                            <th className="text-right py-1 px-1">{t('quantity')}</th>
                                            <th className="text-right py-1 px-1">{t('unit_cost')}</th>
                                            <th className="text-right py-1 px-1">{t('total')}</th>
                                            <th className="w-8"></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {materials.map(mat => (
                                            <tr key={mat.id} className="border-b border-slate-50 hover:bg-slate-50 group">
                                              <td className="py-1 px-1">{mat.product_name}</td>
                                              <td className="py-1 px-1 text-right text-slate-500">{mat.uom}</td>
                                              <td className="py-1 px-1 text-right">{mat.quantity}</td>
                                              <td className="py-1 px-1 text-right">{formatCurrency(mat.unit_cost)}</td>
                                              <td className="py-1 px-1 text-right font-medium">{formatCurrency(mat.total_cost)}</td>
                                              <td className="py-1 px-1 text-center">
                                                <Button
                                                  variant="ghost" size="sm"
                                                  className="h-5 w-5 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                                  onClick={() => handleDeleteMaterial(mat.id, sub.id)}
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </Button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>

                                  {/* Equipment section */}
                                  <div>
                                    <div className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                                      <Truck className="w-3 h-3" />
                                      {t('rf_equipment') || 'Texnika'}
                                    </div>
                                    {isLoadingEquip ? (
                                      <p className="text-xs text-slate-400 py-2 text-center">{t('loading')}</p>
                                    ) : equipmentItems.length === 0 ? (
                                      <p className="text-xs text-slate-400 py-2 text-center">{t('no_items')}</p>
                                    ) : (
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b text-slate-500">
                                            <th className="text-left py-1 px-1">{t('name')}</th>
                                            <th className="text-right py-1 px-1">{t('unit')}</th>
                                            <th className="text-right py-1 px-1">{t('quantity')}</th>
                                            <th className="text-right py-1 px-1">{t('unit_cost')}</th>
                                            <th className="text-right py-1 px-1">{t('total')}</th>
                                            <th className="w-8"></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {equipmentItems.map(eq => {
                                            const qty = eq.quantity || eq.plan_quantity || 0;
                                            const total = eq.total_cost || qty * (eq.unit_price || 0);
                                            return (
                                              <tr key={eq.id} className="border-b border-slate-50 hover:bg-slate-50 group">
                                                <td className="py-1 px-1">{eq.name}</td>
                                                <td className="py-1 px-1 text-right text-slate-500">{eq.work_unit}</td>
                                                <td className="py-1 px-1 text-right">{qty}</td>
                                                <td className="py-1 px-1 text-right">{formatCurrency(eq.unit_price)}</td>
                                                <td className="py-1 px-1 text-right font-medium">{formatCurrency(total)}</td>
                                                <td className="py-1 px-1 text-center">
                                                  <Button
                                                    variant="ghost" size="sm"
                                                    className="h-5 w-5 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                                    onClick={() => handleDeleteEquipment(eq.id, sub.id)}
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </Button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>

                                  {/* Labor section */}
                                  <div>
                                    <div className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                                      <Users className="w-3 h-3" />
                                      {t('rf_employee') || 'Ishchi kuchi'}
                                    </div>
                                    {isLoadingEquip ? (
                                      <p className="text-xs text-slate-400 py-2 text-center">{t('loading')}</p>
                                    ) : laborItems.length === 0 ? (
                                      <p className="text-xs text-slate-400 py-2 text-center">{t('no_items')}</p>
                                    ) : (
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b text-slate-500">
                                            <th className="text-left py-1 px-1">{t('name')}</th>
                                            <th className="text-right py-1 px-1">{t('unit')}</th>
                                            <th className="text-right py-1 px-1">{t('quantity')}</th>
                                            <th className="text-right py-1 px-1">{t('unit_cost')}</th>
                                            <th className="text-right py-1 px-1">{t('total')}</th>
                                            <th className="w-8"></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {laborItems.map(lb => {
                                            const qty = lb.quantity || lb.plan_quantity || 0;
                                            const total = lb.total_cost || qty * (lb.unit_price || 0);
                                            return (
                                              <tr key={lb.id} className="border-b border-slate-50 hover:bg-slate-50 group">
                                                <td className="py-1 px-1">{lb.name}</td>
                                                <td className="py-1 px-1 text-right text-slate-500">{lb.work_unit}</td>
                                                <td className="py-1 px-1 text-right">{qty}</td>
                                                <td className="py-1 px-1 text-right">{formatCurrency(lb.unit_price)}</td>
                                                <td className="py-1 px-1 text-right font-medium">{formatCurrency(total)}</td>
                                                <td className="py-1 px-1 text-center">
                                                  <Button
                                                    variant="ghost" size="sm"
                                                    className="h-5 w-5 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                                    onClick={() => handleDeleteEquipment(lb.id, sub.id)}
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </Button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>

                                  <Button
                                    variant="outline" size="sm"
                                    className="h-7 text-xs w-full mt-1"
                                    onClick={() => openAddMaterial(sub.id)}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    {t('add')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
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

      {/* Add Material / Equipment / Employee Modal */}
      <Dialog open={showMaterialModal} onOpenChange={setShowMaterialModal}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('add')}</DialogTitle>
            <DialogDescription className="sr-only">{t('add')}</DialogDescription>
          </DialogHeader>

          {/* Tab Switcher */}
          <div className="flex border-b border-slate-200 -mx-6 px-6">
            {[
              { key: 'materials', label: t('rf_materials') || 'Materiallar', icon: Package, color: 'amber' },
              { key: 'equipment', label: t('rf_equipment') || 'Texnika', icon: Truck, color: 'blue' },
              { key: 'employee', label: t('rf_employee') || 'Ishchi kuchi', icon: Users, color: 'green' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setModalTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  modalTab === tab.key
                    ? `border-${tab.color}-500 text-${tab.color}-600`
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                style={modalTab === tab.key ? {
                  borderBottomColor: tab.color === 'amber' ? '#f59e0b' : tab.color === 'blue' ? '#3b82f6' : '#22c55e',
                  color: tab.color === 'amber' ? '#d97706' : tab.color === 'blue' ? '#2563eb' : '#16a34a',
                } : {}}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Materials Tab ─── */}
          {modalTab === 'materials' && (
            <div className="space-y-4">
              <div>
                <Label>{t('select_product') || 'Mahsulot tanlang'}</Label>
                <Select
                  value={materialForm.product_id || undefined}
                  onValueChange={(val) => {
                    const p = inventoryProducts.find(ip => ip.product_id === val);
                    if (p) {
                      setMaterialForm(f => ({
                        ...f,
                        product_id: p.product_id,
                        product_name: p.product_name,
                        uom: 'шт',
                        unit_cost: p.unit_cost ? String(p.unit_cost) : '',
                      }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={t('select_product') || 'Mahsulot tanlang'} /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {inventoryProducts.map(p => (
                      <SelectItem key={p.product_id} value={p.product_id}>
                        {p.product_name} — {t('stock') || 'Zaxira'}: {p.quantity_available ?? p.quantity_on_hand ?? 0}
                        {p.unit_cost ? ` (${formatCurrency(p.unit_cost)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {materialForm.product_id && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {t('from_inventory') || 'Inventorydan — zaxira so\'rovi yaratiladi'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('unit')}</Label>
                  <Input
                    value={materialForm.uom}
                    onChange={e => setMaterialForm(f => ({ ...f, uom: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('quantity')}</Label>
                  <Input
                    type="number" step="0.0001" min="0"
                    value={materialForm.quantity}
                    onChange={e => setMaterialForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('unit_cost')}</Label>
                  <Input
                    value={materialForm.unit_cost}
                    onChange={e => setMaterialForm(f => ({ ...f, unit_cost: formatPriceInput(e.target.value) }))}
                    placeholder="0"
                  />
                </div>
              </div>
              {materialForm.quantity && materialForm.unit_cost && (
                <div className="flex justify-between items-center pt-2 border-t text-sm">
                  <span className="text-slate-500">{t('total')}</span>
                  <span className="font-semibold">
                    {formatCurrency((parseFloat(materialForm.quantity) || 0) * (parseFloat(parsePriceInput(materialForm.unit_cost)) || 0))}
                  </span>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMaterialModal(false)}>{t('cancel')}</Button>
                <Button onClick={handleAddMaterial} disabled={!materialForm.product_id}>
                  {t('add')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ─── Equipment Tab (МАШ.-Ч from estimates) ─── */}
          {modalTab === 'equipment' && (
            <div className="space-y-4">
              <div>
                <Label>{t('select_equipment') || 'Texnika tanlang'}</Label>
                {estimateEquipmentResources.length > 0 ? (
                  <Select
                    value={equipmentForm.name || undefined}
                    onValueChange={(val) => {
                      const r = estimateEquipmentResources.find(res => res.name === val);
                      if (r) {
                        // Prefer equipment_rate, fall back to unit_rate, then labor/material rate
                        const rate = r.equipment_rate || r.unit_rate || r.labor_rate || r.material_rate || 0;
                        setEquipmentForm(f => ({
                          ...f,
                          name: r.name,
                          work_unit: 'soat',
                          unit_price: rate ? formatPriceInput(String(rate)) : '',
                        }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t('select_equipment') || 'Texnika tanlang'} /></SelectTrigger>
                    <SelectContent className="max-h-[300px] max-w-[450px]">
                      {estimateEquipmentResources.map(r => {
                        const rate = r.equipment_rate || r.unit_rate || r.labor_rate || r.material_rate || 0;
                        return (
                          <SelectItem key={r.id} value={r.name} title={r.name}>
                            <span className="truncate block max-w-[380px]">{r.name}</span>
                            <span className="text-xs text-slate-400 ml-1">{rate ? formatCurrency(rate) : ''}</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-slate-500 py-2">{t('no_equipment_resources') || 'Smeta resurslarida texnika topilmadi'}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('rf_work_unit') || 'Birlik'}</Label>
                  <Select value={equipmentForm.work_unit} onValueChange={v => setEquipmentForm(f => ({ ...f, work_unit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soat">{t('rf_hour') || 'Soat'}</SelectItem>
                      <SelectItem value="kun">{t('rf_day') || 'Kun'}</SelectItem>
                      <SelectItem value="smena">{t('rf_shift') || 'Smena'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('quantity') || 'Miqdor'}</Label>
                  <Input type="number" step="0.01" min="0" value={equipmentForm.quantity}
                    onChange={e => setEquipmentForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <Label>{t('rf_unit_price') || 'Narxi'}</Label>
                  <Input value={equipmentForm.unit_price}
                    onChange={e => setEquipmentForm(f => ({ ...f, unit_price: formatPriceInput(e.target.value) }))} placeholder="0" />
                </div>
              </div>
              {equipmentForm.quantity && equipmentForm.unit_price && (
                <div className="flex justify-between items-center pt-2 border-t text-sm">
                  <span className="text-blue-600">{t('total')}: {formatCurrency((parseFloat(equipmentForm.quantity) || 0) * (parseFloat(parsePriceInput(equipmentForm.unit_price)) || 0))}</span>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMaterialModal(false)}>{t('cancel')}</Button>
                <Button onClick={handleAddEquipment} disabled={!equipmentForm.name.trim()}>
                  {t('add')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ─── Employee Tab (ЧЕЛ.-Ч from estimates) ─── */}
          {modalTab === 'employee' && (
            <div className="space-y-4">
              <div>
                <Label>{t('select_employee_resource') || 'Ishchi kuchi tanlang'}</Label>
                {estimateLaborResources.length > 0 ? (
                  <Select
                    value={equipmentForm.name || undefined}
                    onValueChange={(val) => {
                      const r = estimateLaborResources.find(res => res.name === val);
                      if (r) {
                        // Prefer labor_rate, fall back to unit_rate, then equipment/material rate
                        const rate = r.labor_rate || r.unit_rate || r.equipment_rate || r.material_rate || 0;
                        setEquipmentForm(f => ({
                          ...f,
                          name: r.name,
                          work_unit: 'soat',
                          unit_price: rate ? formatPriceInput(String(rate)) : '',
                        }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t('select_employee_resource') || 'Ishchi kuchi tanlang'} /></SelectTrigger>
                    <SelectContent className="max-h-[300px] max-w-[450px]">
                      {estimateLaborResources.map(r => {
                        const rate = r.labor_rate || r.unit_rate || r.equipment_rate || r.material_rate || 0;
                        return (
                          <SelectItem key={r.id} value={r.name} title={r.name}>
                            <span className="truncate block max-w-[380px]">{r.name}</span>
                            <span className="text-xs text-slate-400 ml-1">{rate ? formatCurrency(rate) : ''}</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-slate-500 py-2">{t('no_labor_resources') || 'Smeta resurslarida ishchi kuchi topilmadi'}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('rf_work_unit') || 'Birlik'}</Label>
                  <Select value={equipmentForm.work_unit} onValueChange={v => setEquipmentForm(f => ({ ...f, work_unit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soat">{t('rf_hour') || 'Soat'}</SelectItem>
                      <SelectItem value="kun">{t('rf_day') || 'Kun'}</SelectItem>
                      <SelectItem value="smena">{t('rf_shift') || 'Smena'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('quantity') || 'Miqdor'}</Label>
                  <Input type="number" step="0.01" min="0" value={equipmentForm.quantity}
                    onChange={e => setEquipmentForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <Label>{t('rf_unit_price') || 'Narxi'}</Label>
                  <Input value={equipmentForm.unit_price}
                    onChange={e => setEquipmentForm(f => ({ ...f, unit_price: formatPriceInput(e.target.value) }))} placeholder="0" />
                </div>
              </div>
              {equipmentForm.quantity && equipmentForm.unit_price && (
                <div className="flex justify-between items-center pt-2 border-t text-sm">
                  <span className="text-green-600">{t('total')}: {formatCurrency((parseFloat(equipmentForm.quantity) || 0) * (parseFloat(parsePriceInput(equipmentForm.unit_price)) || 0))}</span>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMaterialModal(false)}>{t('cancel')}</Button>
                <Button onClick={handleAddEquipment} disabled={!equipmentForm.name.trim()}>
                  {t('add')}
                </Button>
              </DialogFooter>
            </div>
          )}
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
