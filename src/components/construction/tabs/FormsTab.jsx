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
import { Plus, Trash2, CheckCircle, XCircle, ArrowLeft, FileText, Zap, Eye, Download, PenLine, Ban, Loader2, ChevronUp, ChevronDown, Send, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const TYPE_COLORS = {
  ks2: 'bg-blue-100 text-blue-700',
  ks3: 'bg-purple-100 text-purple-700',
  hidden_work: 'bg-orange-100 text-orange-700',
};

const STATE_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-yellow-100 text-yellow-700',
  signed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  act_type: 'ks2',
  subcontract_id: '',
  period_from: '',
  period_to: '',
  notes: '',
  // Forma 2 coefficient & period month/year extensions
  f2_transport_pct: 5,
  f2_other_pct: 17,
  f2_materials_returned: 0,
  period_month_from: '',
  period_month_to: '',
  period_year: '',
};

const MONTH_OPTIONS_RU = [
  { value: 1, label: 'январь' }, { value: 2, label: 'февраль' }, { value: 3, label: 'март' },
  { value: 4, label: 'апрель' }, { value: 5, label: 'май' }, { value: 6, label: 'июнь' },
  { value: 7, label: 'июль' }, { value: 8, label: 'август' }, { value: 9, label: 'сентябрь' },
  { value: 10, label: 'октябрь' }, { value: 11, label: 'ноябрь' }, { value: 12, label: 'декабрь' },
];

const CHANGE_REASONS = [
  { value: 'project_changed', label: "Loyiha o'zgardi" },
  { value: 'client_request', label: 'Mijoz talabi' },
  { value: 'material_shortage', label: 'Material yetmadi' },
  { value: 'material_replacement', label: 'Material almashtirish' },
  { value: 'other', label: 'Boshqa' },
];

const FormsTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  // Check if project has required client details for KS-2 / KS-3
  const REQUIRED_CLIENT_FIELDS = ['client_name', 'client_stir', 'client_bank_name', 'client_bank_account', 'client_mfo', 'client_address'];
  const missingClientFields = REQUIRED_CLIENT_FIELDS.filter(f => !project?.[f]?.trim());
  const hasRequiredClientDetails = missingClientFields.length === 0;

  const FIELD_LABELS = {
    client_name: language === 'ru' ? 'Наименование заказчика' : language === 'uz' ? 'Buyurtmachi nomi' : 'Client Name',
    client_stir: language === 'ru' ? 'ИНН (СТИР)' : 'STIR (TIN)',
    client_bank_name: language === 'ru' ? 'Название банка' : language === 'uz' ? 'Bank nomi' : 'Bank Name',
    client_bank_account: language === 'ru' ? 'Расчётный счёт' : language === 'uz' ? 'Hisob raqami' : 'Settlement Account',
    client_mfo: 'MFO',
    client_address: language === 'ru' ? 'Юридический адрес' : language === 'uz' ? 'Yuridik manzil' : 'Legal Address',
  };

  const clientFieldsWarning = missingClientFields.length > 0
    ? (language === 'ru'
        ? `Заполните данные заказчика в настройках проекта: ${missingClientFields.map(f => FIELD_LABELS[f] || f).join(', ')}`
        : language === 'uz'
          ? `Loyiha sozlamalarida buyurtmachi ma'lumotlarini to'ldiring: ${missingClientFields.map(f => FIELD_LABELS[f] || f).join(', ')}`
          : `Fill in client details in project settings: ${missingClientFields.map(f => FIELD_LABELS[f] || f).join(', ')}`)
    : '';

  const TYPE_LABELS = {
    ks2: t('forma_2') || 'Forma 2 (KS-2)',
    ks3: t('forma_3') || 'Forma 3 (KS-3)',
    hidden_work: t('forma_19') || 'Forma 19',
  };

  const STATE_LABELS = {
    draft: t('draft') || 'Qoralama',
    pending: t('pending') || 'Imzolashda',
    signed: t('signed') || 'Imzolangan',
    cancelled: t('cancelled') || 'Bekor qilingan',
  };

  // List state
  const [acts, setActs] = useState([]);
  const [subcontracts, setSubcontracts] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ act_type: '', state: '' });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Sorting state
  const [sortField, setSortField] = useState('created_date');
  const [sortDir, setSortDir] = useState('desc');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Estimate line picker state for F2 create
  const [estimateLines, setEstimateLines] = useState([]);
  const [selectedLines, setSelectedLines] = useState([]);
  const [estimateLinesLoading, setEstimateLinesLoading] = useState(false);

  // Forma 19 (material consumption) state
  const [showF19CreateModal, setShowF19CreateModal] = useState(false);
  const [f19CreateForm, setF19CreateForm] = useState({ building_id: '', period_from: '', period_to: '', notes: '' });
  const [f19Creating, setF19Creating] = useState(false);
  const [f19Detail, setF19Detail] = useState(null);
  const [f19RowFilter, setF19RowFilter] = useState('all');
  const [showAddChangeModal, setShowAddChangeModal] = useState(false);
  const [changeRowForm, setChangeRowForm] = useState({ material_name: '', unit: '', keldi: 0, sarf: 0, cost_price: 0, change_reason: '', change_note: '' });
  const [changeSaving, setChangeSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editRowForm, setEditRowForm] = useState({});
  const [buildings, setBuildings] = useState([]);

  // Auto-generate modals
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  const [autoGenForm, setAutoGenForm] = useState({ subcontract_id: '', period_from: '', period_to: '' });
  const [autoGenSaving, setAutoGenSaving] = useState(false);
  const [autoGenPreview, setAutoGenPreview] = useState(null); // preview data, null = not yet fetched
  const [autoGenLoadingPreview, setAutoGenLoadingPreview] = useState(false);
  const [showAutoGenConfirm, setShowAutoGenConfirm] = useState(false);

  const [showGenF3Modal, setShowGenF3Modal] = useState(false);
  const [genF3Form, setGenF3Form] = useState({ subcontract_id: '', period_from: '', period_to: '' });
  const [genF3Saving, setGenF3Saving] = useState(false);

  // Detail view state
  const [selectedAct, setSelectedAct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sign dialog
  const [signTarget, setSignTarget] = useState(null);
  const [signRole, setSignRole] = useState('');

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Inline line editing
  const [editingLineId, setEditingLineId] = useState(null);
  const [editLineForm, setEditLineForm] = useState({ qty_period: '', note: '' });

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form-2 detail tab state (smeta lines vs actual materials)
  const [f2DetailTab, setF2DetailTab] = useState('smeta');

  const FORMS_TYPES = ['ks2', 'ks3', 'hidden_work'];

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setCurrentPage(1);
    try {
      const params = {};
      if (filters.state) params.state = filters.state;

      const [f2s, f3s, f19s, subData, stagesData, buildingsData] = await Promise.all([
        (!filters.act_type || filters.act_type === 'ks2') ? constructionService.listF2(project.id, params).catch(() => []) : Promise.resolve([]),
        (!filters.act_type || filters.act_type === 'ks3') ? constructionService.listF3(project.id, params).catch(() => []) : Promise.resolve([]),
        (!filters.act_type || filters.act_type === 'hidden_work') ? constructionService.listF19(project.id, params).catch(() => []) : Promise.resolve([]),
        constructionService.listSubcontracts(project.id).catch(() => []),
        constructionService.listStages(project.id).catch(() => []),
        constructionService.listBuildings(project.id).catch(() => []),
      ]);
      setActs([...(f2s || []), ...(f3s || []), ...(f19s || [])]);
      setSubcontracts(subData || []);
      setStages(stagesData || []);
      setBuildings(buildingsData || []);
    } catch (e) {
      console.error('Failed to load forms:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id, filters]);

  useEffect(() => { load(); }, [load]);

  const loadActDetail = async (actId, actType) => {
    setDetailLoading(true);
    setF2DetailTab('smeta');
    try {
      if (actType === 'hidden_work') {
        const detail = await constructionService.getF19Detail(project.id, actId);
        setF19Detail(detail);
        return;
      }
      let act;
      if (actType === 'ks3') {
        act = await constructionService.getF3(project.id, actId);
      } else {
        act = await constructionService.getF2(project.id, actId);
      }
      console.log('[loadActDetail] fetched act:', { actId, actType, act, id: act?.id, keys: act ? Object.keys(act) : null });
      setSelectedAct(act);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setDetailLoading(false);
    }
  };

  // ---- Estimate line picker ----

  const loadEstimateLines = async (subcontractId) => {
    setEstimateLinesLoading(true);
    try {
      const estimates = await constructionService.listEstimates(project.id);
      const allLines = [];
      for (const est of (estimates || [])) {
        const detail = await constructionService.getEstimate(est.id);
        if (detail?.lines) {
          for (const line of detail.lines) {
            if (line.item_number && !line.resource_type) {
              allLines.push({
                estimate_line_id: line.id,
                name: line.name,
                uom: line.uom,
                qty_smeta: line.quantity || 0,
                unit_rate: line.unit_rate || 0,
                qty_period: 0,
              });
            }
          }
        }
      }
      setEstimateLines(allLines);
    } catch {
      setEstimateLines([]);
    } finally {
      setEstimateLinesLoading(false);
    }
  };

  const toggleEstimateLine = (line) => {
    setSelectedLines(prev => {
      const exists = prev.find(l => l.estimate_line_id === line.estimate_line_id);
      if (exists) {
        return prev.filter(l => l.estimate_line_id !== line.estimate_line_id);
      }
      return [...prev, {
        ...line,
        qty_period: 0,
        // Forma 2 per-line cost-split + hierarchy extensions
        labor_amount: 0,
        equipment_amount: 0,
        materials_amount: 0,
        cables_amount: 0,
        norm_code: '',
        line_number_display: '',
        is_section_header: false,
        section_name: '',
      }];
    });
  };

  const updateSelectedLineQty = (estimateLineId, qty) => {
    setSelectedLines(prev => prev.map(l =>
      l.estimate_line_id === estimateLineId ? { ...l, qty_period: parseFloat(qty) || 0 } : l
    ));
  };

  const updateSelectedLineField = (estimateLineId, field, value) => {
    setSelectedLines(prev => prev.map(l =>
      l.estimate_line_id === estimateLineId ? { ...l, [field]: value } : l
    ));
  };

  // ---- Handlers ----

  const handleCreate = async () => {
    if (!hasRequiredClientDetails) { toast.error(clientFieldsWarning); return; }
    if (!form.act_type) { setError('Akt turini tanlang'); return; }
    if (!form.period_from || !form.period_to) { setError('Davrni kiriting'); return; }
    const linesWithQty = selectedLines.filter(l => l.qty_period > 0);
    if (linesWithQty.length === 0) { setError('Kamida bitta qator tanlang va miqdor kiriting'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        act_type: 'ks2',
        subcontract_id: form.subcontract_id ? Number(form.subcontract_id) : 0,
        period_from: form.period_from,
        period_to: form.period_to,
        notes: form.notes,
        // Forma 2 act-level coefficients and reporting period month/year
        f2_transport_pct: form.f2_transport_pct !== '' ? parseFloat(form.f2_transport_pct) : 5,
        f2_other_pct: form.f2_other_pct !== '' ? parseFloat(form.f2_other_pct) : 17,
        f2_materials_returned: form.f2_materials_returned ? parseFloat(form.f2_materials_returned) : 0,
        period_month_from: form.period_month_from ? parseInt(form.period_month_from, 10) : 0,
        period_month_to: form.period_month_to ? parseInt(form.period_month_to, 10) : 0,
        period_year: form.period_year ? parseInt(form.period_year, 10) : 0,
        lines: linesWithQty.map(l => ({
          estimate_line_id: l.estimate_line_id,
          name: l.name,
          uom: l.uom,
          quantity: l.qty_period,
          unit_rate: l.unit_rate,
          qty_smeta: l.qty_smeta,
          // Forma 2 per-line cost split & hierarchy
          labor_amount: parseFloat(l.labor_amount) || 0,
          equipment_amount: parseFloat(l.equipment_amount) || 0,
          materials_amount: parseFloat(l.materials_amount) || 0,
          cables_amount: parseFloat(l.cables_amount) || 0,
          norm_code: l.norm_code || '',
          line_number_display: l.line_number_display || '',
          is_section_header: !!l.is_section_header,
          section_name: l.section_name || '',
        })),
      };
      await constructionService.createF2(project.id, payload);
      setShowCreateModal(false);
      setSelectedLines([]);
      setEstimateLines([]);
      toast.success(t('act_created') || 'Forma yaratildi');
      load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateF19 = async () => {
    if (!f19CreateForm.period_from || !f19CreateForm.period_to) {
      toast.error('Davrni kiriting');
      return;
    }
    setF19Creating(true);
    try {
      await constructionService.createF19(project.id, {
        building_id: f19CreateForm.building_id ? Number(f19CreateForm.building_id) : undefined,
        period_from: f19CreateForm.period_from,
        period_to: f19CreateForm.period_to,
        notes: f19CreateForm.notes,
      });
      setShowF19CreateModal(false);
      setF19CreateForm({ building_id: '', period_from: '', period_to: '', notes: '' });
      toast.success(t('f19_created') || 'Forma 19 yaratildi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setF19Creating(false);
    }
  };

  const handleApproveF19 = async () => {
    try {
      await constructionService.approveF19(project.id, f19Detail.act.id);
      toast.success("Forma 19 tasdiqlandi");
      const updated = await constructionService.getF19Detail(project.id, f19Detail.act.id);
      setF19Detail(updated);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Xatolik yuz berdi");
    }
  };

  const handleDeleteF19 = async () => {
    try {
      await constructionService.deleteF19(project.id, f19Detail.act.id);
      toast.success("Forma 19 o'chirildi");
      setF19Detail(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Xatolik yuz berdi");
    }
  };

  const handleAddChangeRow = async () => {
    if (!changeRowForm.material_name || !changeRowForm.unit || !changeRowForm.change_reason) {
      toast.error("Majburiy maydonlarni to'ldiring");
      return;
    }
    setChangeSaving(true);
    try {
      await constructionService.addF19ChangeRow(project.id, f19Detail.act.id, {
        material_name: changeRowForm.material_name,
        unit: changeRowForm.unit,
        keldi: parseFloat(changeRowForm.keldi) || 0,
        sarf: parseFloat(changeRowForm.sarf) || 0,
        cost_price: parseFloat(changeRowForm.cost_price) || 0,
        change_reason: changeRowForm.change_reason,
        change_note: changeRowForm.change_note,
      });
      setShowAddChangeModal(false);
      setChangeRowForm({ material_name: '', unit: '', keldi: 0, sarf: 0, cost_price: 0, change_reason: '', change_note: '' });
      toast.success("O'zgarish qatori qo'shildi");
      const updated = await constructionService.getF19Detail(project.id, f19Detail.act.id);
      setF19Detail(updated);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || "Xatolik yuz berdi");
    } finally {
      setChangeSaving(false);
    }
  };

  const startEditF19Row = (row) => {
    setEditingRowId(row.id);
    setEditRowForm({
      boshi: row.boshi || 0,
      keldi: row.keldi || 0,
      sarf: row.sarf || 0,
      cost_price: row.cost_price || 0,
      change_reason: row.change_reason || '',
      change_note: row.change_note || '',
    });
  };

  const saveF19Row = async (rowId) => {
    try {
      await constructionService.updateF19Row(project.id, f19Detail.act.id, rowId, {
        boshi: parseFloat(editRowForm.boshi) || 0,
        keldi: parseFloat(editRowForm.keldi) || 0,
        sarf: parseFloat(editRowForm.sarf) || 0,
        cost_price: parseFloat(editRowForm.cost_price) || 0,
        change_reason: editRowForm.change_reason,
        change_note: editRowForm.change_note,
      });
      setEditingRowId(null);
      const updated = await constructionService.getF19Detail(project.id, f19Detail.act.id);
      setF19Detail(updated);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || "Saqlashda xatolik");
    }
  };

  const cancelEditF19Row = () => {
    setEditingRowId(null);
    setEditRowForm({});
  };

  // Step 1: fetch preview only (no DB write)
  const handleAutoGeneratePreview = async () => {
    if (!hasRequiredClientDetails) { toast.error(clientFieldsWarning); return; }
    if (!autoGenForm.period_from || !autoGenForm.period_to) {
      toast.error("Davrni kiriting"); return;
    }
    setAutoGenLoadingPreview(true);
    try {
      const preview = await constructionService.previewAutoGenerateKS2(project.id, {
        subcontract_id: autoGenForm.subcontract_id ? Number(autoGenForm.subcontract_id) : 0,
        period_from: autoGenForm.period_from,
        period_to: autoGenForm.period_to,
      });
      setAutoGenPreview(preview);
      setShowAutoGenModal(false);
      setShowAutoGenConfirm(true);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setAutoGenLoadingPreview(false);
    }
  };

  // Step 2: user confirmed -> persist the KS-2
  const handleAutoGenerateConfirm = async () => {
    if (!autoGenForm.period_from || !autoGenForm.period_to) {
      toast.error("Davrni kiriting"); return;
    }
    setAutoGenSaving(true);
    try {
      await constructionService.autoGenerateKS2(project.id, {
        subcontract_id: autoGenForm.subcontract_id ? Number(autoGenForm.subcontract_id) : 0,
        period_from: autoGenForm.period_from,
        period_to: autoGenForm.period_to,
      });
      setShowAutoGenConfirm(false);
      setAutoGenPreview(null);
      toast.success('KS-2 avtomatik yaratildi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setAutoGenSaving(false);
    }
  };

  // Go back from the confirm dialog to edit parameters
  const handleAutoGenerateBack = () => {
    setShowAutoGenConfirm(false);
    setAutoGenPreview(null);
    setShowAutoGenModal(true);
  };

  const handleGenerateF3 = async () => {
    if (!hasRequiredClientDetails) { toast.error(clientFieldsWarning); return; }
    if (!genF3Form.period_from || !genF3Form.period_to) {
      toast.error("Davrni kiriting"); return;
    }
    setGenF3Saving(true);
    try {
      await constructionService.generateF3(project.id, {
        subcontract_id: genF3Form.subcontract_id ? Number(genF3Form.subcontract_id) : 0,
        period_from: genF3Form.period_from,
        period_to: genF3Form.period_to,
      });
      setShowGenF3Modal(false);
      toast.success('KS-3 (Forma 3) yaratildi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setGenF3Saving(false);
    }
  };

  const handleSign = async () => {
    if (!signTarget || !signRole) return;
    try {
      if (signTarget.act_type === 'ks2') {
        await constructionService.signF2(signTarget.id, { role: signRole });
      } else if (signTarget.act_type === 'ks3') {
        await constructionService.signF3(signTarget.id, { role: signRole });
      } else if (signTarget.act_type === 'hidden_work') {
        await constructionService.signF19(signTarget.id, { role: signRole });
      }
      setSignTarget(null);
      setSignRole('');
      toast.success(`Akt imzolandi (${signRole})`);
      if (selectedAct?.id === signTarget.id) await loadActDetail(signTarget.id, signTarget.act_type);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) {
      toast.error('Bekor qilish sababini kiriting'); return;
    }
    try {
      if (cancelTarget.act_type === 'ks2') {
        await constructionService.cancelF2(cancelTarget.id, { rejection_reason: cancelReason });
      } else if (cancelTarget.act_type === 'hidden_work') {
        await constructionService.cancelF19(cancelTarget.id, { rejection_reason: cancelReason });
      }
      setCancelTarget(null);
      setCancelReason('');
      toast.success('Akt bekor qilindi');
      if (selectedAct?.id === cancelTarget.id) await loadActDetail(cancelTarget.id, cancelTarget.act_type);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const handleSubmitForSigning = async () => {
    try {
      if (selectedAct.act_type === 'ks2') {
        await constructionService.submitF2(project.id, selectedAct.id);
      } else if (selectedAct.act_type === 'hidden_work') {
        await constructionService.submitF19(project.id, selectedAct.id);
      }
      toast.success("Imzolashga yuborildi");
      loadActDetail(selectedAct.id, selectedAct.act_type);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik');
    }
  };

  const resolveActId = (act) => {
    if (!act) return null;
    const candidates = [act.id, act.act_id, act.ID, act.f2_id, act.f3_id];
    for (const v of candidates) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (!s || s === 'undefined' || s === 'null' || s === 'NaN') continue;
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) return n;
      return s;
    }
    return null;
  };

  const handleExportPDF = async (act) => {
    const actId = resolveActId(act);
    if (!actId) {
      console.warn('[handleExportPDF] act has no id; received:', act);
      toast.error("Akt ID topilmadi. Iltimos, sahifani yangilang va qayta urinib ko'ring.");
      return;
    }
    try {
      let blob;
      if (act.act_type === 'ks2') {
        blob = await constructionService.exportF2PDF(project?.id, actId);
      } else if (act.act_type === 'ks3') {
        blob = await constructionService.exportF3PDF(project?.id, actId);
      } else if (act.act_type === 'hidden_work') {
        blob = await constructionService.exportF19PDF(project?.id, actId);
      }
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${act.name || 'act'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'PDF yuklab olishda xatolik');
    }
  };

  const handleExportXLSX = async (act) => {
    const actId = resolveActId(act);
    if (!actId) {
      console.warn('[handleExportXLSX] act has no id; received:', act);
      toast.error("Akt ID topilmadi. Iltimos, sahifani yangilang va qayta urinib ko'ring.");
      return;
    }
    try {
      let blob;
      if (act.act_type === 'ks2') {
        blob = await constructionService.exportF2XLSX(project.id, actId);
      } else if (act.act_type === 'ks3') {
        blob = await constructionService.exportF3XLSX(project.id, actId);
      } else if (act.act_type === 'hidden_work') {
        blob = await constructionService.exportF19XLSX(project.id, actId);
      } else {
        toast.error("Bu akt turi uchun XLSX eksport qo'llab-quvvatlanmaydi");
        return;
      }
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const prefix = act.act_type === 'ks3' ? 'Forma3' : act.act_type === 'hidden_work' ? 'Forma19' : 'Forma2';
      a.download = `${prefix}_${act.act_number || actId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'XLSX yuklab olishda xatolik');
    }
  };

  const startEditLine = (line) => {
    setEditingLineId(line.id);
    setEditLineForm({ qty_period: String(line.quantity || ''), note: line.note || '' });
  };

  const saveEditLine = async (actId, lineId) => {
    try {
      await constructionService.updateF2Line(project.id, actId, lineId, {
        qty_period: parseFloat(editLineForm.qty_period) || 0,
        note: editLineForm.note,
      });
      setEditingLineId(null);
      const updated = await constructionService.getF2(project.id, actId);
      setSelectedAct(updated);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Saqlashda xatolik');
    }
  };

  const cancelEditLine = () => {
    setEditingLineId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.act_type === 'ks2') {
        await constructionService.deleteF2(deleteTarget.id);
      } else if (deleteTarget.act_type === 'hidden_work') {
        await constructionService.deleteF19(deleteTarget.id);
      }
      setDeleteTarget(null);
      if (selectedAct?.id === deleteTarget.id) setSelectedAct(null);
      toast.success("Akt o'chirildi");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  // --- Sorting helpers ---
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIndicator = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1 inline-flex flex-col leading-none"><ChevronUp className="w-3 h-3" /><ChevronDown className="w-3 h-3 -mt-1" /></span>;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" />
      : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />;
  };

  const sortedActs = [...(acts || [])].sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (sortField === 'amount') { va = a.amount_total_with_vat || a.amount_total || 0; vb = b.amount_total_with_vat || b.amount_total || 0; }
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
  });

  // --- Signing status component ---
  const SignaturePanel = ({ act }) => {
    if (!act) return null;
    const isKS = act.act_type === 'ks2' || act.act_type === 'ks3';
    if (!isKS) return null;

    const sigs = [];
    sigs.push({ role: 'contractor', label: t('contractor') || 'Pudratchi', at: act.signed_contractor_at, name: act.signed_contractor_name });
    sigs.push({ role: 'client', label: t('client_tech') || 'Buyurtmachi / Texnadzor', at: act.signed_client_at, name: act.signed_client_name });

    const totalSigs = sigs.length;
    const signedCount = sigs.filter(s => s.at).length;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><PenLine className="w-5 h-5" /> {t('signatures') || 'Imzolar'}</span>
            <Badge className={signedCount === totalSigs ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
              {signedCount}/{totalSigs}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {sigs.map(sig => (
              <div key={sig.role} className={`p-3 rounded-lg border ${sig.at ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-sm font-medium">{sig.label}</p>
                {sig.at ? (
                  <div className="mt-1">
                    <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t('signed') || 'Imzolangan'}</p>
                    {sig.name && <p className="text-xs text-slate-600">{sig.name}</p>}
                    <p className="text-xs text-slate-400">{new Date(sig.at).toLocaleDateString()}</p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <p className="text-xs text-slate-400">{t('not_signed') || 'Imzolanmagan'}</p>
                    {act.state === 'pending' && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs"
                        onClick={() => { setSignTarget(act); setSignRole(sig.role); }}>
                        <PenLine className="w-3 h-3 mr-1" /> {t('sign') || 'Imzolash'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };


  // --- Forma 3 cumulative detail ---
  const Forma3Detail = ({ act }) => {
    if (!act || act.act_type !== 'ks3') return null;
    return (
      <Card>
        <CardHeader><CardTitle>{t('cumulative_data') || "Yig'ma ma'lumotlar"}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="text-left py-2">{t('indicator') || "Ko'rsatkich"}</th>
                <th className="text-right py-2">{t('from_start') || 'Qurilish boshidan'}</th>
                <th className="text-right py-2">{t('from_year_start') || 'Yil boshidan'}</th>
                <th className="text-right py-2">{t('for_period') || 'Hisobot davri uchun'}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 font-medium">{t('work_cost') || 'Ishlar qiymati'}</td>
                <td className="py-2 text-right">{formatCurrency(act.cumul_from_start || 0)}</td>
                <td className="py-2 text-right">{formatCurrency(act.cumul_from_year_start || 0)}</td>
                <td className="py-2 text-right">{formatCurrency(act.amount_total || 0)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">{t('vat') || 'QQS'} ({act.vat_pct || 12}%)</td>
                <td className="py-2 text-right">{formatCurrency((act.cumul_from_start || 0) * (act.vat_pct || 12) / 100)}</td>
                <td className="py-2 text-right">{formatCurrency((act.cumul_from_year_start || 0) * (act.vat_pct || 12) / 100)}</td>
                <td className="py-2 text-right">{formatCurrency(act.vat_amount || 0)}</td>
              </tr>
              <tr className="font-bold">
                <td className="py-2">{t('total_with_vat') || 'QQS bilan jami'}</td>
                <td className="py-2 text-right">{formatCurrency((act.cumul_from_start || 0) * (1 + (act.vat_pct || 12) / 100))}</td>
                <td className="py-2 text-right">{formatCurrency((act.cumul_from_year_start || 0) * (1 + (act.vat_pct || 12) / 100))}</td>
                <td className="py-2 text-right">{formatCurrency(act.amount_total_with_vat || 0)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  // --- Estimate lines subtotals for create modal ---
  const createModalSubtotal = selectedLines.reduce((sum, l) => sum + (l.qty_period * l.unit_rate), 0);
  const createModalVat = createModalSubtotal * 0.12;
  const createModalTotal = createModalSubtotal + createModalVat;

  // ======== F19 DETAIL VIEW ========
  if (f19Detail) {
    const { act: f19Act, lines: f19Lines = [], summary = {} } = f19Detail;
    const filteredF19Lines = f19RowFilter === 'all'
      ? f19Lines
      : f19Lines.filter(r => f19RowFilter === 'base' ? r.row_type === 'base' : r.row_type === 'change');

    return (
      <div className="space-y-4">
        {/* Back + header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setF19Detail(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t('back') || 'Ortga'}
            </Button>
            <h3 className="text-lg font-semibold">{f19Act.name || 'F19'}</h3>
            <Badge className={STATE_COLORS[f19Act.state]}>{STATE_LABELS[f19Act.state] || f19Act.state}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExportPDF(f19Act)}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportXLSX(f19Act)}>
              <Download className="w-4 h-4 mr-1" /> XLSX
            </Button>
            {f19Act.state === 'draft' && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApproveF19}>
                  <CheckCircle className="w-4 h-4 mr-1" /> {t('approve') || 'Tasdiqlash'}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteF19}>
                  <Trash2 className="w-4 h-4 mr-1" /> {t('delete') || "O'chirish"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-blue-600 font-medium">{t('smeta_total') || "Smeta bo'yicha"}</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(summary.smeta_total || 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="p-4">
              <p className="text-sm text-yellow-600 font-medium">{t('change_total') || "O'zgarishlar (+/-)"}</p>
              <p className="text-xl font-bold text-yellow-700">{formatCurrency(summary.change_total || 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-4">
              <p className="text-sm text-green-600 font-medium">{t('actual_total') || 'Jami haqiqiy'}</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(summary.total || 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4">
              <p className="text-sm text-red-600 font-medium">{t('difference') || 'Farq'}</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(summary.diff || 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter tabs + add change button */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            {[
              { value: 'all', label: t('all') || 'Hammasi' },
              { value: 'base', label: t('base_estimate') || 'Asos smeta' },
              { value: 'change', label: t('changes') || "O'zgarishlar" },
            ].map(tab => (
              <Button
                key={tab.value}
                variant={f19RowFilter === tab.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setF19RowFilter(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {f19Act.state === 'draft' && (
            <Button size="sm" variant="outline" className="text-orange-600 border-orange-300" onClick={() => setShowAddChangeModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> {t('add_change') || "O'zgarish qo'shish"}
            </Button>
          )}
        </div>

        {/* Material table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500">
                    <th className="text-left py-2 px-3">№</th>
                    <th className="text-left py-2 px-3">{t('material_name') || 'Material nomi'}</th>
                    <th className="text-left py-2 px-3">{t('unit') || 'Birlik'}</th>
                    <th className="text-right py-2 px-3">{t('boshi') || 'Boshi'}</th>
                    <th className="text-right py-2 px-3">{t('keldi') || 'Keldi'}</th>
                    <th className="text-right py-2 px-3">{t('sarf') || 'Sarflandi'}</th>
                    <th className="text-right py-2 px-3">{t('qoldi') || 'Qoldi'}</th>
                    <th className="text-right py-2 px-3">{t('price') || 'Narx'}</th>
                    <th className="text-right py-2 px-3">{t('amount') || 'Summa'}</th>
                    <th className="text-left py-2 px-3">{t('row_type') || 'Tur'}</th>
                    <th className="text-left py-2 px-3">{t('reason') || 'Sabab'}</th>
                    {f19Act.state === 'draft' && <th className="text-right py-2 px-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredF19Lines.map((row, idx) => {
                    const isEditing = editingRowId === row.id;
                    const isBase = row.row_type === 'base';
                    const isDraft = f19Act.state === 'draft';
                    const qoldi = (row.boshi || 0) + (row.keldi || 0) - (row.sarf || 0);
                    const summa = (row.sarf || 0) * (row.cost_price || 0);

                    if (isEditing) {
                      const editQoldi = (parseFloat(editRowForm.boshi) || 0) + (parseFloat(editRowForm.keldi) || 0) - (parseFloat(editRowForm.sarf) || 0);
                      const editSumma = (parseFloat(editRowForm.sarf) || 0) * (parseFloat(editRowForm.cost_price) || 0);
                      return (
                        <tr key={row.id} className="border-b bg-blue-50">
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3">{row.material_name}</td>
                          <td className="py-2 px-3">{row.unit}</td>
                          <td className="py-2 px-3 text-right">
                            <Input type="number" step="0.01" value={editRowForm.boshi} onChange={e => setEditRowForm(f => ({ ...f, boshi: e.target.value }))} className="w-20 h-7 text-right text-sm" onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input type="number" step="0.01" value={editRowForm.keldi} onChange={e => setEditRowForm(f => ({ ...f, keldi: e.target.value }))} className="w-20 h-7 text-right text-sm" onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input type="number" step="0.01" value={editRowForm.sarf} onChange={e => setEditRowForm(f => ({ ...f, sarf: e.target.value }))} className="w-20 h-7 text-right text-sm" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') saveF19Row(row.id); if (e.key === 'Escape') cancelEditF19Row(); }} />
                          </td>
                          <td className="py-2 px-3 text-right">{editQoldi.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">
                            <Input type="number" step="0.01" value={editRowForm.cost_price} onChange={e => setEditRowForm(f => ({ ...f, cost_price: e.target.value }))} className="w-24 h-7 text-right text-sm" onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="py-2 px-3 text-right font-medium">{formatCurrency(editSumma)}</td>
                          <td className="py-2 px-3">
                            <Badge className={isBase ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>{isBase ? 'Asos' : "O'zgarish"}</Badge>
                          </td>
                          <td className="py-2 px-3">
                            {!isBase && (
                              <Select value={editRowForm.change_reason || ''} onValueChange={v => setEditRowForm(f => ({ ...f, change_reason: v }))}>
                                <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>{CHANGE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" className="h-7 px-2" onClick={e => { e.stopPropagation(); saveF19Row(row.id); }}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={e => { e.stopPropagation(); cancelEditF19Row(); }}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={row.id || idx}
                        className={`border-b hover:bg-slate-50 ${!isBase ? 'bg-amber-50' : ''} ${isDraft ? 'cursor-pointer' : ''}`}
                        onClick={() => { if (isDraft) startEditF19Row(row); }}
                      >
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3">{row.material_name}</td>
                        <td className="py-2 px-3">{row.unit || '—'}</td>
                        <td className="py-2 px-3 text-right">{row.boshi || 0}</td>
                        <td className="py-2 px-3 text-right">{row.keldi || 0}</td>
                        <td className="py-2 px-3 text-right">{row.sarf || 0}</td>
                        <td className="py-2 px-3 text-right">{qoldi.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(row.cost_price || 0)}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(summa)}</td>
                        <td className="py-2 px-3">
                          <Badge className={isBase ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>{isBase ? 'Asos' : "O'zgarish"}</Badge>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-xs">
                          {!isBase && row.change_reason ? (CHANGE_REASONS.find(r => r.value === row.change_reason)?.label || row.change_reason) : '—'}
                        </td>
                        {isDraft && <td className="py-2 px-3"></td>}
                      </tr>
                    );
                  })}
                  {filteredF19Lines.length === 0 && (
                    <tr><td colSpan={12} className="py-8 text-center text-slate-400">{t('no_data') || "Ma'lumot yo'q"}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Add Change Row Modal */}
        <Dialog open={showAddChangeModal} onOpenChange={setShowAddChangeModal}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>{t('add_change_row') || "O'zgarish qatori qo'shish"}</DialogTitle><DialogDescription className="sr-only">Add change row</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('material_name') || 'Material nomi'} *</Label><Input value={changeRowForm.material_name} onChange={e => setChangeRowForm(f => ({ ...f, material_name: e.target.value }))} placeholder="Material nomi" /></div>
              <div><Label>{t('unit') || 'Birlik'} *</Label><Input value={changeRowForm.unit} onChange={e => setChangeRowForm(f => ({ ...f, unit: e.target.value }))} placeholder="dona, kg, m3..." /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t('keldi') || 'Keldi'}</Label><Input type="number" step="0.01" value={changeRowForm.keldi} onChange={e => setChangeRowForm(f => ({ ...f, keldi: e.target.value }))} /></div>
                <div><Label>{t('sarf') || 'Sarflandi'}</Label><Input type="number" step="0.01" value={changeRowForm.sarf} onChange={e => setChangeRowForm(f => ({ ...f, sarf: e.target.value }))} /></div>
                <div><Label>{t('price') || 'Narx'}</Label><Input type="number" step="0.01" value={changeRowForm.cost_price} onChange={e => setChangeRowForm(f => ({ ...f, cost_price: e.target.value }))} /></div>
              </div>
              <div><Label>{t('change_reason') || "O'zgarish sababi"} *</Label>
                <Select value={changeRowForm.change_reason || ''} onValueChange={v => setChangeRowForm(f => ({ ...f, change_reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                  <SelectContent>{CHANGE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('note') || 'Izoh'}</Label><Textarea value={changeRowForm.change_note} onChange={e => setChangeRowForm(f => ({ ...f, change_note: e.target.value }))} rows={2} placeholder="Izoh..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddChangeModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
              <Button onClick={handleAddChangeRow} disabled={changeSaving}>{changeSaving ? 'Saqlanmoqda...' : "Qo'shish"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ======== DETAIL VIEW (KS2/KS3) ========
  if (selectedAct) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedAct(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t('back') || 'Ortga'}
            </Button>
            <h3 className="text-lg font-semibold">{selectedAct.name}</h3>
            {selectedAct.act_number && <span className="text-sm text-slate-500">#{selectedAct.act_number}</span>}
            <Badge className={TYPE_COLORS[selectedAct.act_type]}>{TYPE_LABELS[selectedAct.act_type] || selectedAct.act_type}</Badge>
            <Badge className={STATE_COLORS[selectedAct.state]}>{STATE_LABELS[selectedAct.state] || selectedAct.state}</Badge>
          </div>
          <div className="flex gap-2">
            {(selectedAct.act_type === 'ks2' || selectedAct.act_type === 'ks3' || selectedAct.act_type === 'hidden_work') && (
              <Button variant="outline" size="sm" onClick={() => handleExportPDF(selectedAct)}>
                <Download className="w-4 h-4 mr-1" /> PDF
              </Button>
            )}
            {(selectedAct.act_type === 'ks2' || selectedAct.act_type === 'ks3') && (
              <Button variant="outline" size="sm" onClick={() => handleExportXLSX(selectedAct)}>
                <Download className="w-4 h-4 mr-1" /> XLSX
              </Button>
            )}
          </div>
        </div>

        {/* Act info card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {t('act_info') || "Akt ma'lumotlari"}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-slate-500">{t('type') || 'Turi'}</p><p className="font-medium">{TYPE_LABELS[selectedAct.act_type]}</p></div>
              {selectedAct.period_from && <div><p className="text-slate-500">{t('period') || 'Davr'}</p><p className="font-medium">{selectedAct.period_from} — {selectedAct.period_to}</p></div>}
              {selectedAct.subcontract_name && <div><p className="text-slate-500">{t('subcontractor') || 'Subpudratchi'}</p><p className="font-medium">{selectedAct.subcontract_name}</p></div>}
              <div><p className="text-slate-500">{t('amount') || 'Summa'}</p><p className="font-medium">{formatCurrency(selectedAct.amount_total || 0)}</p></div>
              {selectedAct.vat_amount > 0 && (
                <>
                  <div><p className="text-slate-500">{t('vat') || 'QQS'} ({selectedAct.vat_pct}%)</p><p className="font-medium">{formatCurrency(selectedAct.vat_amount)}</p></div>
                  <div><p className="text-slate-500">{t('total_with_vat') || 'QQS bilan'}</p><p className="font-medium text-blue-600">{formatCurrency(selectedAct.amount_total_with_vat)}</p></div>
                </>
              )}
            </div>
            {selectedAct.notes && <div className="mt-4"><p className="text-slate-500 text-sm">{t('notes') || 'Izohlar'}</p><p className="text-sm mt-1">{selectedAct.notes}</p></div>}
          </CardContent>
        </Card>

        {/* Forma 3 cumulative table */}
        <Forma3Detail act={selectedAct} />

        {/* Signing panel - only show when pending */}
        {selectedAct.state === 'pending' && <SignaturePanel act={selectedAct} />}

        {/* KS-2 Detail Tabs: Smeta lines + Actual materials */}
        {selectedAct.act_type === 'ks2' && (
          <>
            {/* Tab switcher */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setF2DetailTab('smeta')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${f2DetailTab === 'smeta' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('smeta_lines') || 'Smeta ishlar'} ({(selectedAct.lines || []).length})
              </button>
              <button
                onClick={() => setF2DetailTab('materials')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${f2DetailTab === 'materials' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('actual_materials') || 'Fakt materiallar'} ({(selectedAct.material_usage || []).length})
              </button>
            </div>

            {/* Tab content: Smeta lines */}
            {f2DetailTab === 'smeta' && (selectedAct.lines || []).length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t('smeta_lines') || 'Smeta ishlar'}</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-slate-500">
                          <th className="text-left py-2 px-3">№</th>
                          <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                          <th className="text-left py-2 px-3">{t('uom') || "O'lchov"}</th>
                          <th className="text-right py-2 px-3">{t('qty_smeta') || 'Smeta miqdori'}</th>
                          <th className="text-right py-2 px-3">{t('qty_period') || 'Davr miqdori'}</th>
                          <th className="text-right py-2 px-3">{t('unit_rate') || 'Birlik narxi'}</th>
                          <th className="text-right py-2 px-3">{t('total_amount') || 'Jami'}</th>
                          <th className="text-left py-2 px-3">{t('note') || 'Izoh'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedAct.lines || []).map((line, idx) => {
                          const isEditing = editingLineId === line.id;
                          const isDraft = selectedAct.state === 'draft';
                          return (
                            <tr
                              key={line.id || idx}
                              className={`border-b hover:bg-slate-50 ${isDraft ? 'cursor-pointer' : ''} ${isEditing ? 'bg-blue-50' : ''}`}
                              onClick={() => { if (isDraft && !isEditing) startEditLine(line); }}
                            >
                              <td className="py-2 px-3 text-slate-400">{line.sort_order || idx + 1}</td>
                              <td className="py-2 px-3">{line.name}</td>
                              <td className="py-2 px-3">{line.uom || '—'}</td>
                              <td className="py-2 px-3 text-right text-slate-500">{line.qty_smeta || '—'}</td>
                              <td className="py-2 px-3 text-right">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    value={editLineForm.qty_period}
                                    onChange={e => setEditLineForm(f => ({ ...f, qty_period: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEditLine(selectedAct.id, line.id); if (e.key === 'Escape') cancelEditLine(); }}
                                    className="w-28 h-7 text-right text-sm"
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : line.quantity}
                              </td>
                              <td className="py-2 px-3 text-right">{formatCurrency(line.unit_rate || 0)}</td>
                              <td className="py-2 px-3 text-right font-medium">
                                {isEditing
                                  ? formatCurrency((parseFloat(editLineForm.qty_period) || 0) * (line.unit_rate || 0))
                                  : formatCurrency(line.total_amount || 0)}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {isEditing ? (
                                  <Input
                                    value={editLineForm.note}
                                    onChange={e => setEditLineForm(f => ({ ...f, note: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEditLine(selectedAct.id, line.id); if (e.key === 'Escape') cancelEditLine(); }}
                                    className="h-7 text-sm"
                                    placeholder="Izoh..."
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (line.note || '')}
                              </td>
                              {isEditing && (
                                <td className="py-2 px-3">
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); saveEditLine(selectedAct.id, line.id); }}>
                                      <CheckCircle className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); cancelEditLine(); }}>
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            {f2DetailTab === 'smeta' && (selectedAct.lines || []).length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-slate-400">
                  {t('no_smeta_lines') || 'Smeta qatorlari topilmadi'}
                </CardContent>
              </Card>
            )}

            {/* Tab content: Actual materials used */}
            {f2DetailTab === 'materials' && (
              <Card>
                <CardHeader><CardTitle>{t('actual_materials') || 'Fakt ishlatilgan materiallar'}</CardTitle></CardHeader>
                <CardContent>
                  {(selectedAct.material_usage || []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-slate-500">
                            <th className="text-left py-2 px-3">№</th>
                            <th className="text-left py-2 px-3">{t('material_name') || 'Material nomi'}</th>
                            <th className="text-left py-2 px-3">{t('uom') || "O'lchov"}</th>
                            <th className="text-right py-2 px-3">{t('quantity_used') || 'Ishlatilgan miqdor'}</th>
                            <th className="text-left py-2 px-3">{t('notes') || 'Izoh'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedAct.material_usage || []).map((mu, idx) => (
                            <tr key={mu.id || idx} className="border-b hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 font-medium">{mu.product_name}</td>
                              <td className="py-2 px-3">{mu.uom || '—'}</td>
                              <td className="py-2 px-3 text-right font-semibold">{mu.quantity_used}</td>
                              <td className="py-2 px-3 text-slate-500">{mu.notes || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400">
                      {t('no_materials_used') || 'Bu davr uchun ishlatilgan materiallar topilmadi'}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Non-KS2 lines table (KS-3, etc.) */}
        {selectedAct.act_type !== 'ks2' && (selectedAct.lines || []).length > 0 && (
          <Card>
            <CardHeader><CardTitle>{t('act_lines') || 'Akt qatorlari'}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2 px-3">№</th>
                      <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                      <th className="text-left py-2 px-3">{t('uom') || "O'lchov"}</th>
                      <th className="text-right py-2 px-3">{t('quantity') || 'Miqdor'}</th>
                      <th className="text-right py-2 px-3">{t('unit_rate') || 'Birlik narxi'}</th>
                      <th className="text-right py-2 px-3">{t('total_amount') || 'Jami'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAct.lines || []).map((line, idx) => (
                      <tr key={line.id || idx} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400">{line.sort_order || idx + 1}</td>
                        <td className="py-2 px-3">{line.name}</td>
                        <td className="py-2 px-3">{line.uom || '—'}</td>
                        <td className="py-2 px-3 text-right">{line.quantity}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(line.unit_rate || 0)}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(line.total_amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {selectedAct.state === 'draft' && (
            <>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmitForSigning}>
                <Send className="w-4 h-4 mr-1" /> {t('submit_for_signing') || 'Imzolashga yuborish'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(selectedAct)}>
                <Trash2 className="w-4 h-4 mr-1" /> {t('delete') || "O'chirish"}
              </Button>
            </>
          )}
          {selectedAct.state === 'signed' && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => { setCancelTarget(selectedAct); setCancelReason(''); }}>
              <Ban className="w-4 h-4 mr-1" /> {t('cancel_act') || 'Bekor qilish'}
            </Button>
          )}
        </div>

        {/* Cancel, Delete, Sign dialogs */}
        <AlertDialog open={!!cancelTarget} onOpenChange={() => { setCancelTarget(null); setCancelReason(''); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t('cancel_act') || 'Aktni bekor qilish'}</AlertDialogTitle><AlertDialogDescription>{t('cancel_act_desc') || 'Bekor qilish sababini kiriting'}</AlertDialogDescription></AlertDialogHeader>
            <div className="px-6 pb-2"><Label>{t('reason') || 'Sabab'}</Label><Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} /></div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">{t('confirm_cancel') || 'Bekor qilish'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t('delete_act_title') || "Aktni o'chirish"}</AlertDialogTitle><AlertDialogDescription>{t('delete_act_desc') || "Haqiqatan ham bu aktni o'chirmoqchimisiz?"}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || "O'chirish"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!signTarget} onOpenChange={() => { setSignTarget(null); setSignRole(''); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('sign_act') || 'Aktni imzolash'}</AlertDialogTitle>
              <AlertDialogDescription>{t('sign_act_desc') || `"${signRole}" sifatida imzolaysizmi?`}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleSign} className="bg-blue-600 hover:bg-blue-700">
                <PenLine className="w-4 h-4 mr-1" /> {t('sign') || 'Imzolash'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ======== LIST VIEW ========
  return (
    <div className="space-y-4">
      {/* Warning banner when client details are missing */}
      {!hasRequiredClientDetails && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Ban className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {language === 'ru' ? 'Данные заказчика не заполнены' : language === 'uz' ? 'Buyurtmachi ma\'lumotlari to\'ldirilmagan' : 'Client details are incomplete'}
            </p>
            <p className="text-xs text-amber-600 mt-1">{clientFieldsWarning}</p>
            <p className="text-xs text-amber-600 mt-1">
              {language === 'ru' ? 'Создание Форма 2 (KS-2) и Форма 3 (KS-3) заблокировано до заполнения данных.' : language === 'uz' ? 'Ma\'lumotlar to\'ldirilmaguncha Forma 2 (KS-2) va Forma 3 (KS-3) yaratish bloklangan.' : 'KS-2 and KS-3 creation is blocked until fields are filled.'}
            </p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {t('forms')}</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.act_type || 'all'} onValueChange={v => setFilters(f => ({ ...f, act_type: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_types') || 'Barcha turlar'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_types') || 'Barcha turlar'}</SelectItem>
                <SelectItem value="ks2">{t('forma_2') || 'Forma 2 (KS-2)'}</SelectItem>
                <SelectItem value="ks3">{t('forma_3') || 'Forma 3 (KS-3)'}</SelectItem>
                <SelectItem value="hidden_work">{t('forma_19') || 'Forma 19'}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.state || 'all'} onValueChange={v => setFilters(f => ({ ...f, state: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_states') || 'Barcha holatlar'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_states') || 'Barcha holatlar'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                <SelectItem value="pending">{t('pending') || 'Imzolashda'}</SelectItem>
                <SelectItem value="signed">{t('signed') || 'Imzolangan'}</SelectItem>
                <SelectItem value="cancelled">{t('cancelled') || 'Bekor qilingan'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={!hasRequiredClientDetails} onClick={() => setShowAutoGenModal(true)} title={!hasRequiredClientDetails ? clientFieldsWarning : ''}><Zap className="w-4 h-4 mr-2" /> {t('auto_ks2') || 'KS-2 avto'}</Button>
            <Button variant="outline" disabled={!hasRequiredClientDetails} onClick={() => setShowGenF3Modal(true)} title={!hasRequiredClientDetails ? clientFieldsWarning : ''}><FileText className="w-4 h-4 mr-2" /> {t('gen_ks3') || 'KS-3 yaratish'}</Button>
            <Button variant="outline" className="text-orange-600 border-orange-300" onClick={() => { setF19CreateForm({ building_id: '', period_from: '', period_to: '', notes: '' }); setShowF19CreateModal(true); }}>
              <Plus className="w-4 h-4 mr-2" /> {t('create_f19') || 'Forma 19'}
            </Button>
            {/* Forma yaratish button hidden - other buttons (KS-2 avto, KS-3, Forma 19) cover the same functionality */}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">{t('loading') || 'Yuklanmoqda...'}</div>
          ) : (acts || []).length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_forms')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 px-3 cursor-pointer select-none" onClick={() => handleSort('name')}>
                      {t('name') || 'Nomi'}<SortIndicator field="name" />
                    </th>
                    <th className="text-left py-2 px-3 cursor-pointer select-none" onClick={() => handleSort('act_type')}>
                      {t('type') || 'Turi'}<SortIndicator field="act_type" />
                    </th>
                    <th className="text-left py-2 px-3 cursor-pointer select-none" onClick={() => handleSort('period_from')}>
                      {t('period') || 'Davr'}<SortIndicator field="period_from" />
                    </th>
                    <th className="text-left py-2 px-3 cursor-pointer select-none" onClick={() => handleSort('subcontract_name')}>
                      {t('subcontractor') || 'Subpudratchi'}<SortIndicator field="subcontract_name" />
                    </th>
                    <th className="text-right py-2 px-3 cursor-pointer select-none" onClick={() => handleSort('amount')}>
                      {t('amount') || 'Summa'}<SortIndicator field="amount" />
                    </th>
                    <th className="text-left py-2 px-3 cursor-pointer select-none" onClick={() => handleSort('state')}>
                      {t('state') || 'Holat'}<SortIndicator field="state" />
                    </th>
                    <th className="text-right py-2 px-3">{t('actions') || 'Amallar'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalCount = sortedActs.length;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    const paginatedItems = sortedActs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                    return paginatedItems.map(act => (
                    <tr key={act.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{act.name}{act.act_number ? ` #${act.act_number}` : ''}</td>
                      <td className="py-2 px-3"><Badge className={TYPE_COLORS[act.act_type]}>{TYPE_LABELS[act.act_type] || act.act_type}</Badge></td>
                      <td className="py-2 px-3 whitespace-nowrap">{act.period_from ? `${act.period_from} — ${act.period_to}` : (act.works_start_date ? `${act.works_start_date} — ${act.works_end_date}` : '—')}</td>
                      <td className="py-2 px-3">{act.subcontract_name || '—'}</td>
                      <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{formatCurrency(act.amount_total_with_vat || act.amount_total || 0)}</td>
                      <td className="py-2 px-3"><Badge className={STATE_COLORS[act.state]}>{STATE_LABELS[act.state] || act.state}</Badge></td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => loadActDetail(act.id, act.act_type)}><Eye className="w-4 h-4" /></Button>
                          {(act.act_type === 'ks2' || act.act_type === 'ks3' || act.act_type === 'hidden_work') && (
                            <Button variant="ghost" size="sm" onClick={() => handleExportPDF(act)}><Download className="w-4 h-4 text-slate-500" /></Button>
                          )}
                          {act.state === 'draft' && (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(act)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
              {(() => {
                const totalCount = sortedActs.length;
                const totalPages = Math.ceil(totalCount / pageSize);
                return totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-slate-500">
                      {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} / {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>1</button>
                      <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                      <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                      <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                      <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Form Modal (KS-2 with estimate line picker) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('create_form')}</DialogTitle><DialogDescription className="sr-only">Create form</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div><Label>{t('act_type') || 'Forma turi'} *</Label>
              <Select value={form.act_type || ''} onValueChange={v => setForm(f => ({ ...f, act_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ks2">Forma 2 (KS-2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('subcontract') || 'Subpudrat'}</Label>
              <Select value={form.subcontract_id || 'own'} onValueChange={v => { setForm(f => ({ ...f, subcontract_id: v === 'own' ? '' : v })); loadEstimateLines(v); }}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">{language === 'ru' ? 'Без субподрядчика' : 'Subpudratchisiz'}</SelectItem>
                  {(subcontracts || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || s.partner_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('period_from') || 'Boshlanish'} *</Label><Input type="date" value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))} /></div>
              <div><Label>{t('period_to') || 'Tugash'} *</Label><Input type="date" value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))} /></div>
            </div>

            {/* Forma 2 reporting period (for XLSX/PDF header "отчётный период с ... по ...") */}
            <div className="border rounded-md p-3 bg-slate-50 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Forma 2 uchun hisobot davri / Отчётный период (Форма 2)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Oy (dan) / Месяц (с)</Label>
                  <Select
                    value={form.period_month_from ? String(form.period_month_from) : ''}
                    onValueChange={v => setForm(f => ({ ...f, period_month_from: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS_RU.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Oy (gacha) / Месяц (по)</Label>
                  <Select
                    value={form.period_month_to ? String(form.period_month_to) : ''}
                    onValueChange={v => setForm(f => ({ ...f, period_month_to: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS_RU.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Yil / Год</Label>
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    value={form.period_year}
                    onChange={e => setForm(f => ({ ...f, period_year: e.target.value }))}
                    placeholder={String(new Date().getFullYear())}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Transport xarajati % / Транспорт %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.f2_transport_pct}
                    onChange={e => setForm(f => ({ ...f, f2_transport_pct: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Materiallarni yetkazish xarajati</p>
                </div>
                <div>
                  <Label className="text-xs">Yo'qotish / Bayram % / Потери, праздники %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.f2_other_pct}
                    onChange={e => setForm(f => ({ ...f, f2_other_pct: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Yo'qotish / buzilish / bayram kunlari uchun qo'shimcha %</p>
                </div>
                <div>
                  <Label className="text-xs">Qaytarilgan materiallar / Возврат материалов</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.f2_materials_returned}
                    onChange={e => setForm(f => ({ ...f, f2_materials_returned: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Umumiy summadan chegiriladi</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Koeffitsientlar har bir Forma yaratilganda so'raladi — ular ishchi zarpalatasiga / material narxiga
                yo'qotilgan yoki shikastlangan mahsulotlar va bayram kunlari uchun qo'shilib narxga qo'shiladi.
              </p>
            </div>

            <div><Label>{t('notes') || 'Izohlar'}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>

            {/* Estimate lines picker */}
            {form.subcontract_id && (
              <div>
                <Label className="text-base font-semibold">{t('estimate_lines') || 'Smeta qatorlari'}</Label>
                {estimateLinesLoading ? (
                  <div className="flex items-center gap-2 py-4 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('loading') || 'Yuklanmoqda...'}
                  </div>
                ) : estimateLines.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">{t('no_estimate_lines') || 'Smeta qatorlari topilmadi'}</p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 w-8"></th>
                          <th className="text-left py-2 px-2 w-20">№ / Норма</th>
                          <th className="text-left py-2 px-2">{t('name') || 'Nomi'}</th>
                          <th className="text-left py-2 px-2">{t('uom') || "O'lchov"}</th>
                          <th className="text-right py-2 px-2">{t('qty_smeta') || 'Smeta'}</th>
                          <th className="text-right py-2 px-2">{t('unit_rate') || 'Narx'}</th>
                          <th className="text-right py-2 px-2 w-28">{t('qty_period') || 'Davr'}</th>
                          <th className="text-right py-2 px-2 w-28">З/плата</th>
                          <th className="text-right py-2 px-2 w-28">ЭММ</th>
                          <th className="text-right py-2 px-2 w-28">Материалы</th>
                          <th className="text-right py-2 px-2 w-28">Кабели</th>
                          <th className="text-right py-2 px-2">{t('line_total') || 'Jami'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estimateLines.map(line => {
                          const isSelected = selectedLines.some(l => l.estimate_line_id === line.estimate_line_id);
                          const selectedLine = selectedLines.find(l => l.estimate_line_id === line.estimate_line_id);
                          const lineTotal = isSelected ? (selectedLine?.qty_period || 0) * line.unit_rate : 0;
                          return (
                            <React.Fragment key={line.estimate_line_id}>
                            <tr className={`border-b hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleEstimateLine(line)}
                                  className="rounded border-slate-300"
                                />
                              </td>
                              <td className="py-2 px-2">
                                {isSelected ? (
                                  <Input
                                    type="text"
                                    value={selectedLine?.norm_code || ''}
                                    onChange={e => updateSelectedLineField(line.estimate_line_id, 'norm_code', e.target.value)}
                                    placeholder="Е1-1"
                                    className="w-20 h-7 text-xs"
                                  />
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2">{line.name}</td>
                              <td className="py-2 px-2">{line.uom || '—'}</td>
                              <td className="py-2 px-2 text-right">{line.qty_smeta}</td>
                              <td className="py-2 px-2 text-right">{formatCurrency(line.unit_rate)}</td>
                              <td className="py-2 px-2 text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={selectedLine?.qty_period || ''}
                                    onChange={e => updateSelectedLineQty(line.estimate_line_id, e.target.value)}
                                    className="w-24 h-7 text-right text-sm"
                                  />
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={selectedLine?.labor_amount || ''}
                                    onChange={e => updateSelectedLineField(line.estimate_line_id, 'labor_amount', parseFloat(e.target.value) || 0)}
                                    className="w-24 h-7 text-right text-xs"
                                  />
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={selectedLine?.equipment_amount || ''}
                                    onChange={e => updateSelectedLineField(line.estimate_line_id, 'equipment_amount', parseFloat(e.target.value) || 0)}
                                    className="w-24 h-7 text-right text-xs"
                                  />
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={selectedLine?.materials_amount || ''}
                                    onChange={e => updateSelectedLineField(line.estimate_line_id, 'materials_amount', parseFloat(e.target.value) || 0)}
                                    className="w-24 h-7 text-right text-xs"
                                  />
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={selectedLine?.cables_amount || ''}
                                    onChange={e => updateSelectedLineField(line.estimate_line_id, 'cables_amount', parseFloat(e.target.value) || 0)}
                                    className="w-24 h-7 text-right text-xs"
                                  />
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right font-medium">{isSelected ? formatCurrency(lineTotal) : '—'}</td>
                            </tr>
                            {isSelected && (
                              <tr className="border-b bg-blue-50/40">
                                <td></td>
                                <td colSpan={11} className="py-1 px-2">
                                  <div className="flex items-center gap-4 text-xs text-slate-600">
                                    <label className="flex items-center gap-1">
                                      <input
                                        type="checkbox"
                                        checked={!!selectedLine?.is_section_header}
                                        onChange={e => updateSelectedLineField(line.estimate_line_id, 'is_section_header', e.target.checked)}
                                        className="rounded border-slate-300"
                                      />
                                      <span>РАЗДЕЛ (bo'lim sarlavhasi)</span>
                                    </label>
                                    {selectedLine?.is_section_header && (
                                      <Input
                                        type="text"
                                        value={selectedLine?.section_name || ''}
                                        onChange={e => updateSelectedLineField(line.estimate_line_id, 'section_name', e.target.value)}
                                        placeholder="Bo'lim nomi (masalan: РАЗДЕЛ 1. Монтажные работы)"
                                        className="flex-1 h-7 text-xs"
                                      />
                                    )}
                                    <label className="flex items-center gap-1">
                                      <span>№ qator:</span>
                                      <Input
                                        type="text"
                                        value={selectedLine?.line_number_display || ''}
                                        onChange={e => updateSelectedLineField(line.estimate_line_id, 'line_number_display', e.target.value)}
                                        placeholder="1.1"
                                        className="w-20 h-7 text-xs"
                                      />
                                    </label>
                                  </div>
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Totals */}
                    {selectedLines.length > 0 && (
                      <div className="border-t bg-slate-50 p-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t('subtotal') || 'Jami'}:</span>
                          <span className="font-medium">{formatCurrency(createModalSubtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t('vat') || 'QQS'} (12%):</span>
                          <span className="font-medium">{formatCurrency(createModalVat)}</span>
                        </div>
                        <div className="flex justify-between text-base font-semibold">
                          <span>{t('total_with_vat') || 'QQS bilan jami'}:</span>
                          <span className="text-blue-600">{formatCurrency(createModalTotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saqlanmoqda...' : 'Yaratish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Forma 19 Modal */}
      <Dialog open={showF19CreateModal} onOpenChange={setShowF19CreateModal}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('create_f19') || 'Forma 19 yaratish'}</DialogTitle><DialogDescription className="sr-only">Create Forma 19</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('period_from') || 'Boshlanish'} *</Label><Input type="date" value={f19CreateForm.period_from} onChange={e => setF19CreateForm(f => ({ ...f, period_from: e.target.value }))} /></div>
              <div><Label>{t('period_to') || 'Tugash'} *</Label><Input type="date" value={f19CreateForm.period_to} onChange={e => setF19CreateForm(f => ({ ...f, period_to: e.target.value }))} /></div>
            </div>
            <div><Label>{t('building') || 'Bino'}</Label>
              <Select value={f19CreateForm.building_id || undefined} onValueChange={v => setF19CreateForm(f => ({ ...f, building_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder={t('select_building') || 'Binoni tanlang'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('none') || 'Tanlanmagan'}</SelectItem>
                  {(buildings || []).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('notes') || 'Izohlar'}</Label><Textarea value={f19CreateForm.notes} onChange={e => setF19CreateForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Izoh..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowF19CreateModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleCreateF19} disabled={f19Creating}>{f19Creating ? 'Saqlanmoqda...' : 'Yaratish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-generate KS-2 Modal */}
      <Dialog open={showAutoGenModal} onOpenChange={setShowAutoGenModal}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('auto_generate_ks2') || 'KS-2 avtomatik yaratish'}</DialogTitle><DialogDescription className="sr-only">Auto KS-2</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('subcontractor') || 'Subpudratchi'}</Label>
              <Select value={autoGenForm.subcontract_id || 'own'} onValueChange={v => setAutoGenForm(f => ({ ...f, subcontract_id: v === 'own' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">{language === 'ru' ? 'Без субподрядчика' : 'Subpudratchisiz'}</SelectItem>
                  {(subcontracts || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || s.partner_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('period_from') || 'Boshlanish'} *</Label><Input type="date" value={autoGenForm.period_from} onChange={e => setAutoGenForm(f => ({ ...f, period_from: e.target.value }))} /></div>
              <div><Label>{t('period_to') || 'Tugash'} *</Label><Input type="date" value={autoGenForm.period_to} onChange={e => setAutoGenForm(f => ({ ...f, period_to: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoGenModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleAutoGeneratePreview} disabled={autoGenLoadingPreview}>
              {autoGenLoadingPreview ? 'Tekshirilmoqda...' : (t('next') || "Keyingi")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-generate KS-2 CONFIRM Modal (step 2) */}
      <Dialog open={showAutoGenConfirm} onOpenChange={(o) => { if (!o) { setShowAutoGenConfirm(false); setAutoGenPreview(null); } }}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('confirm_ks2') || "Ko'rib chiqing va tasdiqlang"}</DialogTitle>
            <DialogDescription className="sr-only">Confirm KS-2 generation</DialogDescription>
          </DialogHeader>
          {autoGenPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded">
                  <p className="text-xs text-slate-500">{t('act_name') || 'Akt nomi'}</p>
                  <p className="font-semibold">{autoGenPreview.proposed_name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded">
                  <p className="text-xs text-slate-500">{t('period') || 'Davr'}</p>
                  <p className="font-semibold text-sm">{autoGenPreview.period_from} — {autoGenPreview.period_to}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded">
                  <p className="text-xs text-blue-600">{t('lines_count') || 'Qatorlar'}</p>
                  <p className="font-semibold text-blue-700">{autoGenPreview.lines_count}</p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-xs text-green-600">{t('total_with_vat') || 'Jami (QQS bilan)'}</p>
                  <p className="font-semibold text-green-700">{formatCurrency(autoGenPreview.amount_total_with_vat || 0)}</p>
                </div>
              </div>

              <div className="border rounded max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2 px-3">№</th>
                      <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                      <th className="text-left py-2 px-3">{t('unit') || 'Birlik'}</th>
                      <th className="text-right py-2 px-3">{t('qty_smeta') || 'Smeta soni'}</th>
                      <th className="text-right py-2 px-3">{t('quantity') || 'Bajarilgan'}</th>
                      <th className="text-right py-2 px-3">{t('unit_rate') || 'Narx'}</th>
                      <th className="text-right py-2 px-3">{t('total') || 'Summa'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(autoGenPreview.lines || []).map((ln, i) => (
                      <tr key={i} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3">{ln.name}</td>
                        <td className="py-2 px-3">{ln.uom || '—'}</td>
                        <td className="py-2 px-3 text-right">{ln.qty_smeta || 0}</td>
                        <td className="py-2 px-3 text-right font-medium">{ln.quantity || 0}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(ln.unit_rate || 0)}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(ln.line_total || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-medium border-t-2">
                      <td colSpan={6} className="py-2 px-3 text-right">{t('subtotal') || 'Oraliq summa'}:</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(autoGenPreview.amount_total || 0)}</td>
                    </tr>
                    <tr className="bg-slate-50 text-slate-500 text-xs">
                      <td colSpan={6} className="py-1 px-3 text-right">QQS ({autoGenPreview.vat_pct || 12}%):</td>
                      <td className="py-1 px-3 text-right">{formatCurrency(autoGenPreview.vat_amount || 0)}</td>
                    </tr>
                    <tr className="bg-green-50 font-semibold">
                      <td colSpan={6} className="py-2 px-3 text-right text-green-700">{t('total_with_vat') || 'Jami (QQS bilan)'}:</td>
                      <td className="py-2 px-3 text-right text-green-700">{formatCurrency(autoGenPreview.amount_total_with_vat || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="text-xs text-slate-500">
                {t('confirm_ks2_note') || "Tasdiqlagandan so'ng akt yaratiladi va qoralama holatida saqlanadi. Keyin imzo jarayonidan o'tkazish mumkin."}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleAutoGenerateBack} disabled={autoGenSaving}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t('back') || 'Ortga'}
            </Button>
            <Button onClick={handleAutoGenerateConfirm} disabled={autoGenSaving} className="bg-green-600 hover:bg-green-700">
              {autoGenSaving ? 'Yaratilmoqda...' : (t('confirm_and_create') || 'Tasdiqlash va yaratish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Forma 3 (KS-3) Modal */}
      <Dialog open={showGenF3Modal} onOpenChange={setShowGenF3Modal}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('gen_ks3') || 'KS-3 (Forma 3) yaratish'}</DialogTitle><DialogDescription className="sr-only">Generate KS-3</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{t('gen_ks3_desc') || "Imzolangan KS-2 aktlar asosida KS-3 hisoboti yaratiladi"}</p>
            <div><Label>{t('subcontractor') || 'Subpudratchi'}</Label>
              <Select value={genF3Form.subcontract_id || 'own'} onValueChange={v => setGenF3Form(f => ({ ...f, subcontract_id: v === 'own' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">{language === 'ru' ? 'Без субподрядчика' : 'Subpudratchisiz'}</SelectItem>
                  {(subcontracts || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || s.partner_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('period_from') || 'Boshlanish'} *</Label><Input type="date" value={genF3Form.period_from} onChange={e => setGenF3Form(f => ({ ...f, period_from: e.target.value }))} /></div>
              <div><Label>{t('period_to') || 'Tugash'} *</Label><Input type="date" value={genF3Form.period_to} onChange={e => setGenF3Form(f => ({ ...f, period_to: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenF3Modal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleGenerateF3} disabled={genF3Saving}>{genF3Saving ? 'Yaratilmoqda...' : 'Yaratish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('delete_act_title') || "Aktni o'chirish"}</AlertDialogTitle><AlertDialogDescription>{t('delete_act_desc') || "Haqiqatan ham o'chirmoqchimisiz?"}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || "O'chirish"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FormsTab;
