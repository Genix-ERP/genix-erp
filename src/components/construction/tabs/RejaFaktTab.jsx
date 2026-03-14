import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, ChevronDown, ChevronRight, Package, Wrench, Edit, TrendingUp, TrendingDown, Minus, AlertTriangle, Download, Clock, Printer } from 'lucide-react';
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

const RejaFaktTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSubStages, setExpandedSubStages] = useState({});

  // Filters
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyOverBudget, setOnlyOverBudget] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Stages list for filter dropdown
  const [allStages, setAllStages] = useState([]);
  const [subStageFilter, setSubStageFilter] = useState('all');

  // Modals
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editMaterial, setEditMaterial] = useState(null);
  const [editEquipment, setEditEquipment] = useState(null);
  const [targetSubStageId, setTargetSubStageId] = useState(null);
  const [materialForm, setMaterialForm] = useState({ product_name: '', uom: 'шт', plan_quantity: '', fact_quantity: '', unit_cost: '', note: '' });
  const [equipmentForm, setEquipmentForm] = useState({ name: '', work_unit: 'soat', plan_quantity: '', fact_quantity: '', unit_price: '', note: '' });
  const [deleteItem, setDeleteItem] = useState(null);

  // History dialog
  const [historyItem, setHistoryItem] = useState(null); // { type, id, name }
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Budget warnings shown flag
  const [budgetWarningsShown, setBudgetWarningsShown] = useState(false);

  // Products for material dropdown
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!project?.id) return;
    constructionService.listProjectMaterials(project.id)
      .then(d => setProducts(d || []))
      .catch(() => setProducts([]));
    constructionService.listStages(project.id)
      .then(d => setAllStages(d || []))
      .catch(() => setAllStages([]));
  }, [project?.id]);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const params = {};
      if (stageFilter !== 'all') params.stage_id = stageFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const result = await constructionService.getRejaFakt(project.id, params);
      setData(result);
    } catch (e) {
      console.error('Failed to load reja-fakt:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id, stageFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Budget warning toasts — show once when data first loads
  useEffect(() => {
    if (!data?.stages?.length || budgetWarningsShown) return;
    setBudgetWarningsShown(true);
    const warnings = [];
    for (const stage of data.stages) {
      const pct = stage.plan_total > 0 ? (stage.fact_total / stage.plan_total * 100) : 0;
      if (pct > 100) {
        warnings.push({ name: stage.name, type: 'over' });
      } else if (pct > 90) {
        warnings.push({ name: stage.name, type: 'approaching' });
      }
    }
    if (warnings.length > 0) {
      const overList = warnings.filter(w => w.type === 'over');
      const approachList = warnings.filter(w => w.type === 'approaching');
      if (overList.length > 0) {
        toast.error(`${t('rf_budget_warning_title')}: ${overList.map(w => `"${w.name}" ${t('rf_budget_over_msg')}`).join(', ')}`);
      }
      if (approachList.length > 0) {
        toast.warning(`${t('rf_budget_warning_title')}: ${approachList.map(w => `"${w.name}" ${t('rf_budget_approaching_msg')}`).join(', ')}`);
      }
    }
  }, [data, budgetWarningsShown, t]);

  const toggleSubStage = (subStageId) => {
    setExpandedSubStages(prev => ({ ...prev, [subStageId]: !prev[subStageId] }));
  };

  // ── Material CRUD ────────────────────────────────────────

  const openAddMaterial = (subStageId) => {
    setTargetSubStageId(subStageId);
    setEditMaterial(null);
    setMaterialForm({ product_name: '', uom: 'шт', plan_quantity: '', fact_quantity: '', unit_cost: '', note: '' });
    setShowMaterialModal(true);
  };

  const openEditMaterial = (mat) => {
    setTargetSubStageId(mat.sub_stage_id);
    setEditMaterial(mat);
    setMaterialForm({
      product_name: mat.product_name,
      uom: mat.uom,
      plan_quantity: String(mat.plan_quantity || 0),
      fact_quantity: String(mat.fact_quantity || 0),
      unit_cost: String(mat.unit_cost || 0),
      note: mat.note || '',
    });
    setShowMaterialModal(true);
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.product_name.trim()) return;
    try {
      if (editMaterial) {
        await constructionService.updateSubStageMaterialPlanFact(editMaterial.id, {
          plan_quantity: parseFloat(materialForm.plan_quantity) || 0,
          fact_quantity: parseFloat(materialForm.fact_quantity) || 0,
          unit_cost: parseFloat(parsePriceInput(materialForm.unit_cost)) || 0,
          note: materialForm.note || '',
        });
      } else {
        await constructionService.createSubStageMaterial(targetSubStageId, {
          product_name: materialForm.product_name,
          uom: materialForm.uom || 'шт',
          quantity: parseFloat(materialForm.plan_quantity) || 0,
          unit_cost: parseFloat(parsePriceInput(materialForm.unit_cost)) || 0,
        });
      }
      setShowMaterialModal(false);
      load();
    } catch (e) {
      toast.error(t('error_occurred'));
    }
  };

  // ── Equipment CRUD ────────────────────────────────────────

  const openAddEquipment = (subStageId) => {
    setTargetSubStageId(subStageId);
    setEditEquipment(null);
    setEquipmentForm({ name: '', work_unit: 'soat', plan_quantity: '', fact_quantity: '', unit_price: '', note: '' });
    setShowEquipmentModal(true);
  };

  const openEditEquipment = (eq) => {
    setTargetSubStageId(eq.sub_stage_id);
    setEditEquipment(eq);
    setEquipmentForm({
      name: eq.name,
      work_unit: eq.work_unit,
      plan_quantity: String(eq.plan_quantity || 0),
      fact_quantity: String(eq.fact_quantity || 0),
      unit_price: String(eq.unit_price || 0),
      note: eq.note || '',
    });
    setShowEquipmentModal(true);
  };

  const handleSaveEquipment = async () => {
    if (!equipmentForm.name.trim()) return;
    try {
      const payload = {
        name: equipmentForm.name,
        work_unit: equipmentForm.work_unit || 'soat',
        plan_quantity: parseFloat(equipmentForm.plan_quantity) || 0,
        fact_quantity: parseFloat(equipmentForm.fact_quantity) || 0,
        unit_price: parseFloat(parsePriceInput(equipmentForm.unit_price)) || 0,
        note: equipmentForm.note || '',
      };
      if (editEquipment) {
        await constructionService.updateSubStageEquipment(editEquipment.id, payload);
      } else {
        await constructionService.createSubStageEquipment(targetSubStageId, payload);
      }
      setShowEquipmentModal(false);
      load();
    } catch (e) {
      toast.error(t('error_occurred'));
    }
  };

  // ── Delete ────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      if (deleteItem.type === 'material') {
        await constructionService.deleteSubStageMaterial(deleteItem.id);
      } else {
        await constructionService.deleteSubStageEquipment(deleteItem.id);
      }
      setDeleteItem(null);
      load();
    } catch (e) {
      toast.error(t('error_occurred'));
    }
  };

  // ── History ────────────────────────────────────────

  const openHistory = async (type, id, name) => {
    setHistoryItem({ type, id, name });
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const result = await constructionService.getRejaFaktAudit(project.id, { item_type: type, item_id: id });
      setHistoryData(result || []);
    } catch (e) {
      console.error('Failed to load audit:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Print / PDF ────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  // ── Export Excel ────────────────────────────────────────

  const handleExportExcel = () => {
    if (!data?.stages?.length) return;
    const rows = [];
    rows.push([t('rf_stage_total'), t('rf_sub_stage'), t('rf_type'), t('name'), t('unit'), t('rf_plan_qty'), t('rf_fact_qty'), t('rf_unit_price'), t('rf_plan_sum'), t('rf_fact_sum'), t('rf_diff'), t('rf_note')]);

    for (const stage of data.stages) {
      for (const sub of stage.sub_stages || []) {
        for (const mat of sub.materials || []) {
          rows.push([stage.name, sub.name, t('rf_materials'), mat.product_name, mat.uom, mat.plan_quantity, mat.fact_quantity, mat.unit_cost, mat.plan_amount, mat.fact_amount, mat.difference, mat.note || '']);
        }
        for (const eq of sub.equipment || []) {
          rows.push([stage.name, sub.name, t('rf_equipment'), eq.name, workUnitLabel(eq.work_unit), eq.plan_quantity, eq.fact_quantity, eq.unit_price, eq.plan_amount, eq.fact_amount, eq.difference, eq.note || '']);
        }
      }
    }

    // Build CSV
    const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reja-vs-fakt-${project?.name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Helpers ────────────────────────────────────────

  const diffColor = (diff) => {
    if (diff > 0) return 'text-green-600';
    if (diff < 0) return 'text-red-600';
    return 'text-slate-500';
  };

  const diffBg = (diff) => {
    if (diff > 0) return 'bg-green-50';
    if (diff < 0) return 'bg-red-50';
    return '';
  };

  // Row color: green if savings, red if over, yellow if >90%, gray if no fact
  const rowClass = (planAmt, factAmt, factQty) => {
    if (factQty === 0 && planAmt > 0) return 'bg-slate-50 text-slate-400'; // gray — not started
    const diff = planAmt - factAmt;
    if (diff < 0) return 'bg-red-50'; // over budget
    if (planAmt > 0 && factAmt / planAmt >= 0.9) return 'bg-amber-50'; // approaching 90%
    if (diff > 0) return 'bg-green-50'; // savings
    return '';
  };

  // Budget status color for percentage
  const budgetPctColor = (pct) => {
    if (pct > 100) return 'text-red-600';
    if (pct > 90) return 'text-amber-600';
    return 'text-green-600';
  };

  const budgetBarColor = (pct) => {
    if (pct > 100) return 'bg-red-500';
    if (pct > 90) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const DiffIcon = ({ diff }) => {
    if (diff > 0) return <TrendingDown className="w-3 h-3 text-green-600" />;
    if (diff < 0) return <TrendingUp className="w-3 h-3 text-red-600" />;
    return <Minus className="w-3 h-3 text-slate-400" />;
  };

  const workUnitLabel = (unit) => {
    const labels = { soat: t('rf_hour'), kun: t('rf_day'), smena: t('rf_shift') };
    return labels[unit] || unit;
  };

  // Progress: completed sub-stages / total sub-stages
  const getSubStageProgress = (stage) => {
    const subs = stage.sub_stages || [];
    if (subs.length === 0) return 0;
    const completed = subs.filter(s => s.status === 'completed').length;
    return (completed / subs.length) * 100;
  };

  // All sub-stages derived from data (for filter dropdown)
  const allSubStages = (data?.stages || []).flatMap(s => (s.sub_stages || []).map(sub => ({ id: sub.id, name: sub.name, stage_name: s.name })));

  // Reset sub-stage filter when stage filter changes
  useEffect(() => { setSubStageFilter('all'); }, [stageFilter]);

  // Filter stages by over-budget, search, sub-stage
  const filterStages = (stages) => {
    if (!onlyOverBudget && !searchQuery && subStageFilter === 'all') return stages;
    return stages.map(stage => {
      let subs = stage.sub_stages || [];
      if (subStageFilter !== 'all') {
        subs = subs.filter(sub => String(sub.id) === subStageFilter);
      }
      if (onlyOverBudget) {
        subs = subs.filter(sub => sub.difference < 0);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        subs = subs.map(sub => ({
          ...sub,
          materials: (sub.materials || []).filter(m => m.product_name.toLowerCase().includes(q)),
          equipment: (sub.equipment || []).filter(e => e.name.toLowerCase().includes(q)),
        })).filter(sub => sub.materials.length > 0 || sub.equipment.length > 0);
      }
      return { ...stage, sub_stages: subs };
    }).filter(stage => (stage.sub_stages || []).length > 0);
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">{t('loading')}</div>;
  }

  const summary = data?.summary || {};
  const stages = filterStages(data?.stages || []);

  return (
    <div className="space-y-4 pb-28">
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .space-y-4, .space-y-4 * { visibility: visible; }
          .space-y-4 { position: absolute; left: 0; top: 0; width: 100%; }
          .fixed { display: none !important; }
          button, .flex.gap-1 { display: none !important; }
          table { font-size: 10px; }
          @page { margin: 1cm; size: landscape; }
        }
      `}</style>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-48">
          <Label className="text-xs text-slate-500">{t('stage')}</Label>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rf_all_stages')}</SelectItem>
              {allStages.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs text-slate-500">{t('status')}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rf_all_statuses')}</SelectItem>
              <SelectItem value="not_started">{t('not_started')}</SelectItem>
              <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
              <SelectItem value="completed">{t('completed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs text-slate-500">{t('rf_sub_stage')}</Label>
          <Select value={subStageFilter} onValueChange={setSubStageFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              {allSubStages.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs text-slate-500">{t('rf_search')}</Label>
          <Input
            className="h-9"
            placeholder={t('rf_search_placeholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 h-9">
          <Checkbox
            id="over-budget-filter"
            checked={onlyOverBudget}
            onCheckedChange={setOnlyOverBudget}
          />
          <Label htmlFor="over-budget-filter" className="text-xs text-red-600 cursor-pointer">
            {t('rf_only_over_budget')}
          </Label>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data?.stages?.length}>
            <Printer className="w-4 h-4 mr-1" />
            {t('rf_print')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!data?.stages?.length}>
            <Download className="w-4 h-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Project Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{t('rf_plan_total')}</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(summary.plan_total || 0)}</p>
            <div className="flex gap-2 text-[10px] text-slate-400 mt-1">
              <span>{t('rf_materials_short')} {formatCurrency(summary.material_plan_total || 0)}</span>
              <span>{t('rf_equipment_short')} {formatCurrency(summary.equipment_plan_total || 0)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{t('rf_fact_total')}</p>
            <p className="text-xl font-bold">{formatCurrency(summary.fact_total || 0)}</p>
            <div className="flex gap-2 text-[10px] text-slate-400 mt-1">
              <span>{t('rf_materials_short')} {formatCurrency(summary.material_fact_total || 0)}</span>
              <span>{t('rf_equipment_short')} {formatCurrency(summary.equipment_fact_total || 0)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className={diffBg(summary.difference)}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{t('rf_difference')}</p>
            <p className={`text-xl font-bold ${diffColor(summary.difference)}`}>
              {formatCurrency(Math.abs(summary.difference || 0))}
            </p>
            <p className={`text-xs ${diffColor(summary.difference)}`}>
              {(summary.difference || 0) > 0 ? t('rf_savings') : (summary.difference || 0) < 0 ? t('rf_over') : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{t('rf_budget_used')}</p>
            <p className={`text-xl font-bold ${budgetPctColor(summary.budget_used_pct || 0)}`}>
              {(summary.budget_used_pct || 0).toFixed(1)}%
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${budgetBarColor(summary.budget_used_pct || 0)}`}
                style={{ width: `${Math.min(100, summary.budget_used_pct || 0)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{t('rf_completion')}</p>
            <p className="text-xl font-bold text-blue-600">
              {stages.length > 0 ? (stages.reduce((sum, s) => sum + getSubStageProgress(s), 0) / stages.length).toFixed(0) : 0}%
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${stages.length > 0 ? Math.min(100, stages.reduce((sum, s) => sum + getSubStageProgress(s), 0) / stages.length) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stages */}
      {stages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            {t('rf_no_data')}
          </CardContent>
        </Card>
      ) : (
        stages.map(stage => {
          const stagePct = stage.plan_total > 0 ? (stage.fact_total / stage.plan_total * 100) : 0;
          const stageProgress = getSubStageProgress(stage);

          return (
            <Card key={stage.id} className="overflow-hidden">
              {/* Stage Header */}
              <CardHeader className={`py-3 ${diffBg(stage.difference)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{stage.name}</CardTitle>
                    <Badge className={STATUS_COLORS[stage.status]}>{t(stage.status)}</Badge>
                    {stage.difference < 0 && (
                      <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('rf_over')}
                      </Badge>
                    )}
                    {stage.difference >= 0 && stagePct > 90 && stagePct <= 100 && (
                      <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('rf_warning')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-blue-600">{t('rf_plan')}: {formatCurrency(stage.plan_total)}</span>
                    <span>{t('rf_fact')}: {formatCurrency(stage.fact_total)}</span>
                    <span className={`font-medium ${diffColor(stage.difference)}`}>
                      {t('rf_diff')}: {formatCurrency(Math.abs(stage.difference))}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Sub-stages */}
                {(stage.sub_stages || []).map(sub => {
                  const isExpanded = expandedSubStages[sub.id];
                  const materials = sub.materials || [];
                  const equipment = sub.equipment || [];
                  const subPct = sub.plan_total > 0 ? (sub.fact_total / sub.plan_total * 100) : 0;

                  return (
                    <div key={sub.id} className="border-t">
                      {/* Sub-stage header */}
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        onClick={() => toggleSubStage(sub.id)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <span className="font-medium text-sm">{sub.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {materials.length} {t('rf_materials_short')} / {equipment.length} {t('rf_equipment_short')}
                          </Badge>
                          {sub.difference < 0 && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          {sub.difference >= 0 && subPct > 90 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-blue-600">{formatCurrency(sub.plan_total)}</span>
                          <span>{formatCurrency(sub.fact_total)}</span>
                          <span className={`font-medium ${diffColor(sub.difference)}`}>
                            <DiffIcon diff={sub.difference} />
                          </span>
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-4">
                          {/* Materials Table */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <Package className="w-4 h-4 text-amber-500" />
                                {t('rf_materials')}
                                {sub.material_plan_total > 0 && (
                                  <span className="text-xs font-normal text-slate-500">
                                    ({t('rf_plan')}: {formatCurrency(sub.material_plan_total)} / {t('rf_fact')}: {formatCurrency(sub.material_fact_total)})
                                  </span>
                                )}
                              </h4>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAddMaterial(sub.id)}>
                                <Plus className="w-3 h-3 mr-1" />
                                {t('add')}
                              </Button>
                            </div>

                            {materials.length > 0 ? (
                              <div className="border rounded-lg overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-50">
                                    <tr className="text-slate-600">
                                      <th className="text-left px-3 py-2">{t('name')}</th>
                                      <th className="text-center px-2 py-2">{t('unit')}</th>
                                      <th className="text-right px-2 py-2 text-blue-600">{t('rf_plan_qty')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_fact_qty')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_unit_price')}</th>
                                      <th className="text-right px-2 py-2 text-blue-600">{t('rf_plan_sum')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_fact_sum')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_diff')}</th>
                                      <th className="text-left px-2 py-2">{t('rf_note')}</th>
                                      <th className="w-16"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {materials.map(mat => (
                                      <tr key={mat.id} className={`border-t hover:bg-slate-50/50 group transition-colors ${rowClass(mat.plan_amount, mat.fact_amount, mat.fact_quantity)}`}>
                                        <td className="px-3 py-2">{mat.product_name}</td>
                                        <td className="px-2 py-2 text-center text-slate-500">{mat.uom}</td>
                                        <td className="px-2 py-2 text-right text-blue-600">{mat.plan_quantity}</td>
                                        <td className={`px-2 py-2 text-right ${mat.fact_quantity === 0 ? 'text-slate-300' : ''}`}>{mat.fact_quantity}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(mat.unit_cost)}</td>
                                        <td className="px-2 py-2 text-right text-blue-600">{formatCurrency(mat.plan_amount)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(mat.fact_amount)}</td>
                                        <td className={`px-2 py-2 text-right font-medium ${diffColor(mat.difference)}`}>
                                          {formatCurrency(Math.abs(mat.difference))}
                                        </td>
                                        <td className="px-2 py-2 text-slate-400 max-w-[120px] truncate" title={mat.note || ''}>{mat.note || '—'}</td>
                                        <td className="px-2 py-2 text-center">
                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openHistory('material', mat.id, mat.product_name)}>
                                              <Clock className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditMaterial(mat)}>
                                              <Edit className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => setDeleteItem({ type: 'material', id: mat.id })}>
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-slate-50 font-medium text-xs">
                                    <tr className="border-t">
                                      <td colSpan={5} className="px-3 py-2 text-right">{t('rf_materials_total')}:</td>
                                      <td className="px-2 py-2 text-right text-blue-600">{formatCurrency(sub.material_plan_total)}</td>
                                      <td className="px-2 py-2 text-right">{formatCurrency(sub.material_fact_total)}</td>
                                      <td className={`px-2 py-2 text-right ${diffColor(sub.material_plan_total - sub.material_fact_total)}`}>
                                        {formatCurrency(Math.abs(sub.material_plan_total - sub.material_fact_total))}
                                      </td>
                                      <td colSpan={2}></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 py-2">{t('rf_no_materials')}</p>
                            )}
                          </div>

                          {/* Equipment Table */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-blue-500" />
                                {t('rf_equipment')}
                                {sub.equip_plan_total > 0 && (
                                  <span className="text-xs font-normal text-slate-500">
                                    ({t('rf_plan')}: {formatCurrency(sub.equip_plan_total)} / {t('rf_fact')}: {formatCurrency(sub.equip_fact_total)})
                                  </span>
                                )}
                              </h4>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAddEquipment(sub.id)}>
                                <Plus className="w-3 h-3 mr-1" />
                                {t('add')}
                              </Button>
                            </div>

                            {equipment.length > 0 ? (
                              <div className="border rounded-lg overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-50">
                                    <tr className="text-slate-600">
                                      <th className="text-left px-3 py-2">{t('name')}</th>
                                      <th className="text-center px-2 py-2">{t('rf_work_unit')}</th>
                                      <th className="text-right px-2 py-2 text-blue-600">{t('rf_plan_qty')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_fact_qty')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_unit_price')}</th>
                                      <th className="text-right px-2 py-2 text-blue-600">{t('rf_plan_sum')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_fact_sum')}</th>
                                      <th className="text-right px-2 py-2">{t('rf_diff')}</th>
                                      <th className="text-left px-2 py-2">{t('rf_note')}</th>
                                      <th className="w-16"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {equipment.map(eq => (
                                      <tr key={eq.id} className={`border-t hover:bg-slate-50/50 group transition-colors ${rowClass(eq.plan_amount, eq.fact_amount, eq.fact_quantity)}`}>
                                        <td className="px-3 py-2">{eq.name}</td>
                                        <td className="px-2 py-2 text-center text-slate-500">{workUnitLabel(eq.work_unit)}</td>
                                        <td className="px-2 py-2 text-right text-blue-600">{eq.plan_quantity}</td>
                                        <td className={`px-2 py-2 text-right ${eq.fact_quantity === 0 ? 'text-slate-300' : ''}`}>{eq.fact_quantity}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(eq.unit_price)}</td>
                                        <td className="px-2 py-2 text-right text-blue-600">{formatCurrency(eq.plan_amount)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(eq.fact_amount)}</td>
                                        <td className={`px-2 py-2 text-right font-medium ${diffColor(eq.difference)}`}>
                                          {formatCurrency(Math.abs(eq.difference))}
                                        </td>
                                        <td className="px-2 py-2 text-slate-400 max-w-[120px] truncate" title={eq.note || ''}>{eq.note || '—'}</td>
                                        <td className="px-2 py-2 text-center">
                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openHistory('equipment', eq.id, eq.name)}>
                                              <Clock className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditEquipment(eq)}>
                                              <Edit className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => setDeleteItem({ type: 'equipment', id: eq.id })}>
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-slate-50 font-medium text-xs">
                                    <tr className="border-t">
                                      <td colSpan={5} className="px-3 py-2 text-right">{t('rf_equipment_total')}:</td>
                                      <td className="px-2 py-2 text-right text-blue-600">{formatCurrency(sub.equip_plan_total)}</td>
                                      <td className="px-2 py-2 text-right">{formatCurrency(sub.equip_fact_total)}</td>
                                      <td className={`px-2 py-2 text-right ${diffColor(sub.equip_plan_total - sub.equip_fact_total)}`}>
                                        {formatCurrency(Math.abs(sub.equip_plan_total - sub.equip_fact_total))}
                                      </td>
                                      <td colSpan={2}></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 py-2">{t('rf_no_equipment')}</p>
                            )}
                          </div>

                          {/* Sub-stage Summary */}
                          <div className={`rounded-lg p-3 border ${diffBg(sub.difference)}`}>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                              <div>
                                <span className="text-slate-500">{t('rf_materials_plan')}</span>
                                <p className="font-medium text-blue-600">{formatCurrency(sub.material_plan_total)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">{t('rf_equipment_plan')}</span>
                                <p className="font-medium text-blue-600">{formatCurrency(sub.equip_plan_total)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500 text-blue-600">{t('rf_plan_total')}</span>
                                <p className="font-bold text-blue-600">{formatCurrency(sub.plan_total)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">{t('rf_fact_total')}</span>
                                <p className="font-bold">{formatCurrency(sub.fact_total)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">{t('rf_completion')}</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                                    <div
                                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                                      style={{ width: `${sub.status === 'completed' ? 100 : sub.status === 'in_progress' ? 50 : 0}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px]">{sub.status === 'completed' ? '100%' : sub.status === 'in_progress' ? '50%' : '0%'}</span>
                                </div>
                              </div>
                            </div>
                            <div className={`mt-2 pt-2 border-t text-sm font-semibold flex items-center gap-2 ${diffColor(sub.difference)}`}>
                              <DiffIcon diff={sub.difference} />
                              {t('rf_difference')}: {formatCurrency(Math.abs(sub.difference))}
                              {sub.difference > 0 ? ` (${t('rf_savings')})` : sub.difference < 0 ? ` (${t('rf_over')})` : ''}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Stage Summary Footer */}
                <div className={`border-t px-4 py-3 ${diffBg(stage.difference)}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{t('rf_stage_total')}: {stage.name}</span>
                      {stage.difference < 0 && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-blue-600">{t('rf_plan')}: {formatCurrency(stage.plan_total)}</span>
                      <span>{t('rf_fact')}: {formatCurrency(stage.fact_total)}</span>
                      <span className={`font-bold ${diffColor(stage.difference)}`}>
                        {t('rf_diff')}: {formatCurrency(Math.abs(stage.difference))}
                        {stage.difference > 0 && ` (${t('rf_savings')})`}
                        {stage.difference < 0 && ` (${t('rf_over')})`}
                      </span>
                    </div>
                  </div>
                  {/* Stage progress bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${stageProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, stageProgress)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{stageProgress.toFixed(0)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Sticky Project Summary at Bottom */}
      {(data?.stages?.length || 0) > 0 && (
        <div className="fixed bottom-0 left-[var(--sidebar-width)] right-0 bg-white border-t shadow-lg z-40 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
            <span className="font-bold">{t('rf_project_total')}</span>
            <div className="flex items-center gap-6">
              <span className="text-blue-600 font-medium">{t('rf_plan')}: {formatCurrency(summary.plan_total || 0)}</span>
              <span className="font-medium">{t('rf_fact')}: {formatCurrency(summary.fact_total || 0)}</span>
              <span className={`font-bold ${diffColor(summary.difference)}`}>
                {t('rf_diff')}: {formatCurrency(Math.abs(summary.difference || 0))}
              </span>
              <span className={`font-medium ${budgetPctColor(summary.budget_used_pct || 0)}`}>
                {(summary.budget_used_pct || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Material Modal */}
      <Dialog open={showMaterialModal} onOpenChange={setShowMaterialModal}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editMaterial ? t('rf_edit_material') : t('rf_add_material')}</DialogTitle>
            <DialogDescription className="sr-only">{editMaterial ? t('rf_edit_material') : t('rf_add_material')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editMaterial && (
              <div>
                <Label>{t('name')}</Label>
                {products.length > 0 ? (
                  <Select
                    value={materialForm.product_name || 'custom'}
                    onValueChange={(val) => {
                      if (val === 'custom') {
                        setMaterialForm(f => ({ ...f, product_name: '', uom: 'шт', unit_cost: '' }));
                      } else {
                        const p = products.find(pr => pr.product_name === val);
                        if (p) {
                          setMaterialForm(f => ({
                            ...f,
                            product_name: p.product_name,
                            uom: p.uom || 'шт',
                            unit_cost: p.unit_cost ? String(p.unit_cost) : '',
                          }));
                        }
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t('select_product')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">{t('other')}</SelectItem>
                      {products.map(p => (
                        <SelectItem key={p.product_id || p.id} value={p.product_name}>
                          {p.product_name}{p.uom ? ` (${p.uom})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {(products.length === 0 || !products.some(p => p.product_name === materialForm.product_name)) && (
                  <Input
                    className={products.length > 0 ? 'mt-2' : ''}
                    value={materialForm.product_name}
                    onChange={e => setMaterialForm(f => ({ ...f, product_name: e.target.value }))}
                    placeholder={t('product_name')}
                  />
                )}
              </div>
            )}
            {editMaterial && (
              <div>
                <Label>{t('name')}</Label>
                <Input value={materialForm.product_name} disabled className="bg-slate-50" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('rf_plan_qty')}</Label>
                <Input
                  type="number" step="0.0001" min="0"
                  value={materialForm.plan_quantity}
                  onChange={e => setMaterialForm(f => ({ ...f, plan_quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t('rf_fact_qty')}</Label>
                <Input
                  type="number" step="0.0001" min="0"
                  value={materialForm.fact_quantity}
                  onChange={e => setMaterialForm(f => ({ ...f, fact_quantity: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('unit')}</Label>
                <Input
                  value={materialForm.uom}
                  onChange={e => setMaterialForm(f => ({ ...f, uom: e.target.value }))}
                  disabled={!!editMaterial}
                />
              </div>
              <div>
                <Label>{t('rf_unit_price')}</Label>
                <Input
                  value={materialForm.unit_cost}
                  onChange={e => setMaterialForm(f => ({ ...f, unit_cost: formatPriceInput(e.target.value) }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label>{t('rf_note')}</Label>
              <Textarea
                value={materialForm.note}
                onChange={e => setMaterialForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
                placeholder={t('rf_note_placeholder')}
              />
            </div>
            {(materialForm.plan_quantity || materialForm.fact_quantity) && materialForm.unit_cost && (
              <div className="flex justify-between items-center pt-2 border-t text-sm">
                <span className="text-blue-600">{t('rf_plan')}: {formatCurrency((parseFloat(materialForm.plan_quantity) || 0) * (parseFloat(parsePriceInput(materialForm.unit_cost)) || 0))}</span>
                <span>{t('rf_fact')}: {formatCurrency((parseFloat(materialForm.fact_quantity) || 0) * (parseFloat(parsePriceInput(materialForm.unit_cost)) || 0))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaterialModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleSaveMaterial} disabled={!materialForm.product_name.trim()}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Equipment Modal */}
      <Dialog open={showEquipmentModal} onOpenChange={setShowEquipmentModal}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editEquipment ? t('rf_edit_equipment') : t('rf_add_equipment')}</DialogTitle>
            <DialogDescription className="sr-only">{editEquipment ? t('rf_edit_equipment') : t('rf_add_equipment')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('name')}</Label>
              <Input
                value={equipmentForm.name}
                onChange={e => setEquipmentForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('rf_equipment_name_placeholder')}
                disabled={!!editEquipment}
              />
            </div>
            <div>
              <Label>{t('rf_work_unit')}</Label>
              <Select value={equipmentForm.work_unit} onValueChange={v => setEquipmentForm(f => ({ ...f, work_unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soat">{t('rf_hour')}</SelectItem>
                  <SelectItem value="kun">{t('rf_day')}</SelectItem>
                  <SelectItem value="smena">{t('rf_shift')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('rf_plan_qty')}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={equipmentForm.plan_quantity}
                  onChange={e => setEquipmentForm(f => ({ ...f, plan_quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t('rf_fact_qty')}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={equipmentForm.fact_quantity}
                  onChange={e => setEquipmentForm(f => ({ ...f, fact_quantity: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t('rf_unit_price')}</Label>
              <Input
                value={equipmentForm.unit_price}
                onChange={e => setEquipmentForm(f => ({ ...f, unit_price: formatPriceInput(e.target.value) }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label>{t('rf_note')}</Label>
              <Textarea
                value={equipmentForm.note}
                onChange={e => setEquipmentForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
                placeholder={t('rf_note_placeholder')}
              />
            </div>
            {(equipmentForm.plan_quantity || equipmentForm.fact_quantity) && equipmentForm.unit_price && (
              <div className="flex justify-between items-center pt-2 border-t text-sm">
                <span className="text-blue-600">{t('rf_plan')}: {formatCurrency((parseFloat(equipmentForm.plan_quantity) || 0) * (parseFloat(parsePriceInput(equipmentForm.unit_price)) || 0))}</span>
                <span>{t('rf_fact')}: {formatCurrency((parseFloat(equipmentForm.fact_quantity) || 0) * (parseFloat(parsePriceInput(equipmentForm.unit_price)) || 0))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEquipmentModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleSaveEquipment} disabled={!equipmentForm.name.trim()}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rf_delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('rf_delete_confirm_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={!!historyItem} onOpenChange={() => setHistoryItem(null)}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t('rf_history')}: {historyItem?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('rf_history')}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {historyLoading ? (
              <p className="text-center text-slate-400 py-4">{t('loading')}</p>
            ) : historyData.length === 0 ? (
              <p className="text-center text-slate-400 py-4">{t('rf_no_history')}</p>
            ) : (
              historyData.map(entry => (
                <div key={entry.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <Badge className={
                      entry.action === 'create' ? 'bg-green-100 text-green-700' :
                      entry.action === 'delete' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {t(`rf_action_${entry.action}`)}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.user_name && (
                    <p className="text-xs text-slate-500 mb-1">
                      {t('rf_changed_by')}: {entry.user_name}
                    </p>
                  )}
                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div className="mt-1 space-y-1">
                      {Object.entries(entry.changes).map(([field, change]) => (
                        <div key={field} className="text-xs bg-slate-50 rounded px-2 py-1 flex items-center gap-2">
                          <span className="font-medium">{field}</span>
                          <span className="text-slate-400">{t('rf_field_changed')}</span>
                          <span className="text-red-500 line-through">{String(change.old ?? '')}</span>
                          <span>→</span>
                          <span className="text-green-600">{String(change.new ?? '')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RejaFaktTab;
