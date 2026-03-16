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
import { Plus, Trash2, CheckCircle, XCircle, ArrowLeft, FileText, Zap, Eye, Download, PenLine, Ban, Camera, MapPin, Image, Upload, Loader2, ChevronUp, ChevronDown, Send } from 'lucide-react';
import { UploadFile } from '@/api/integrations';
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
};

const EMPTY_F19_FORM = {
  stage_id: '',
  location_axes: '',
  drawing_reference: '',
  works_start_date: '',
  works_end_date: '',
  notes: '',
  photos: [],
  materials_json: [],
};

const FormsTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

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

  // Forma 19 create modal
  const [showF19Modal, setShowF19Modal] = useState(false);
  const [f19Form, setF19Form] = useState(EMPTY_F19_FORM);
  const [f19Saving, setF19Saving] = useState(false);
  const [f19Error, setF19Error] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Auto-generate modals
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  const [autoGenForm, setAutoGenForm] = useState({ subcontract_id: '', period_from: '', period_to: '' });
  const [autoGenSaving, setAutoGenSaving] = useState(false);

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

  const FORMS_TYPES = ['ks2', 'ks3', 'hidden_work'];

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const params = {};
      if (filters.state) params.state = filters.state;

      const [f2s, f3s, f19s, subData, stagesData] = await Promise.all([
        (!filters.act_type || filters.act_type === 'ks2') ? constructionService.listF2(project.id, params).catch(() => []) : Promise.resolve([]),
        (!filters.act_type || filters.act_type === 'ks3') ? constructionService.listF3(project.id, params).catch(() => []) : Promise.resolve([]),
        (!filters.act_type || filters.act_type === 'hidden_work') ? constructionService.listF19(project.id, params).catch(() => []) : Promise.resolve([]),
        constructionService.listSubcontracts(project.id).catch(() => []),
        constructionService.listStages(project.id).catch(() => []),
      ]);
      setActs([...(f2s || []), ...(f3s || []), ...(f19s || [])]);
      setSubcontracts(subData || []);
      setStages(stagesData || []);
    } catch (e) {
      console.error('Failed to load forms:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id, filters]);

  useEffect(() => { load(); }, [load]);

  const loadActDetail = async (actId, actType) => {
    setDetailLoading(true);
    try {
      let act;
      if (actType === 'ks3') {
        act = await constructionService.getF3(project.id, actId);
      } else if (actType === 'hidden_work') {
        act = await constructionService.getF19(project.id, actId);
      } else {
        act = await constructionService.getF2(project.id, actId);
      }
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
      return [...prev, { ...line, qty_period: 0 }];
    });
  };

  const updateSelectedLineQty = (estimateLineId, qty) => {
    setSelectedLines(prev => prev.map(l =>
      l.estimate_line_id === estimateLineId ? { ...l, qty_period: parseFloat(qty) || 0 } : l
    ));
  };

  // ---- Handlers ----

  const handleCreate = async () => {
    if (!form.act_type) { setError('Akt turini tanlang'); return; }
    if (!form.subcontract_id) { setError('Subpudratni tanlang'); return; }
    if (!form.period_from || !form.period_to) { setError('Davrni kiriting'); return; }
    const linesWithQty = selectedLines.filter(l => l.qty_period > 0);
    if (linesWithQty.length === 0) { setError('Kamida bitta qator tanlang va miqdor kiriting'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        act_type: 'ks2',
        subcontract_id: Number(form.subcontract_id),
        period_from: form.period_from,
        period_to: form.period_to,
        notes: form.notes,
        lines: linesWithQty.map(l => ({
          estimate_line_id: l.estimate_line_id,
          name: l.name,
          uom: l.uom,
          quantity: l.qty_period,
          unit_rate: l.unit_rate,
          qty_smeta: l.qty_smeta,
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
    if (!f19Form.stage_id) { setF19Error('Bosqichni tanlang'); return; }
    if (!f19Form.location_axes) { setF19Error("O'qi va belgilarni kiriting"); return; }
    if (!f19Form.works_start_date || !f19Form.works_end_date) { setF19Error('Ish sanalarini kiriting'); return; }
    if (f19Form.photos.length < 2) { setF19Error("Kamida 2 ta rasm yuklang"); return; }
    setF19Saving(true);
    setF19Error(null);
    try {
      await constructionService.createF19(project.id, {
        act_type: 'hidden_work',
        stage_id: Number(f19Form.stage_id),
        location_axes: f19Form.location_axes,
        drawing_reference: f19Form.drawing_reference,
        works_start_date: f19Form.works_start_date,
        works_end_date: f19Form.works_end_date,
        notes: f19Form.notes,
        photos: f19Form.photos,
        materials_json: f19Form.materials_json.filter(m => m.name),
      });
      setShowF19Modal(false);
      toast.success(t('f19_created') || 'Forma 19 yaratildi');
      load();
    } catch (e) {
      setF19Error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setF19Saving(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!autoGenForm.subcontract_id || !autoGenForm.period_from || !autoGenForm.period_to) {
      toast.error("Barcha maydonlarni to'ldiring"); return;
    }
    setAutoGenSaving(true);
    try {
      await constructionService.autoGenerateKS2(project.id, {
        subcontract_id: Number(autoGenForm.subcontract_id),
        period_from: autoGenForm.period_from,
        period_to: autoGenForm.period_to,
      });
      setShowAutoGenModal(false);
      toast.success('KS-2 avtomatik yaratildi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setAutoGenSaving(false);
    }
  };

  const handleGenerateF3 = async () => {
    if (!genF3Form.subcontract_id || !genF3Form.period_from || !genF3Form.period_to) {
      toast.error("Barcha maydonlarni to'ldiring"); return;
    }
    setGenF3Saving(true);
    try {
      await constructionService.generateF3(project.id, {
        subcontract_id: Number(genF3Form.subcontract_id),
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

  const handleExportPDF = async (act) => {
    try {
      let blob;
      if (act.act_type === 'ks2') {
        blob = await constructionService.exportF2PDF(act.id);
      } else if (act.act_type === 'ks3') {
        blob = await constructionService.exportF3PDF(act.id);
      } else if (act.act_type === 'hidden_work') {
        blob = await constructionService.exportF19PDF(act.id);
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
    if (act.act_type !== 'ks2') return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Форма 2 (КС-2)');

      const titleFont = { name: 'Times New Roman', size: 12, bold: true };
      const headerFont = { name: 'Times New Roman', size: 10, bold: true };
      const dataFont = { name: 'Times New Roman', size: 10 };
      const numFmt = '#,##0.00';
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D6E4F0' } };
      const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE4D6' } };
      const thinBorder = {
        top: { style: 'thin', color: { argb: 'B4C6E7' } },
        left: { style: 'thin', color: { argb: 'B4C6E7' } },
        bottom: { style: 'thin', color: { argb: 'B4C6E7' } },
        right: { style: 'thin', color: { argb: 'B4C6E7' } },
      };

      ws.columns = [
        { width: 6 }, { width: 40 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 18 },
      ];

      // Title
      ws.mergeCells('A1:H1');
      const t1 = ws.getCell('A1');
      t1.value = 'АКТ ПРИЁМКИ ВЫПОЛНЕННЫХ РАБОТ (Форма 2 / КС-2)';
      t1.font = titleFont; t1.alignment = { horizontal: 'center' };

      // Info rows
      const info = [
        ['Объект:', act.project_name || ''],
        ['Подрядчик:', act.subcontract_name || ''],
        ['Акт №:', act.act_number || ''],
        ['Период:', `${act.period_from || ''} — ${act.period_to || ''}`],
      ];
      info.forEach((row, i) => {
        ws.getCell(`A${3 + i}`).value = row[0];
        ws.getCell(`A${3 + i}`).font = { ...dataFont, bold: true };
        ws.mergeCells(`B${3 + i}:D${3 + i}`);
        ws.getCell(`B${3 + i}`).value = row[1];
        ws.getCell(`B${3 + i}`).font = dataFont;
      });

      // Table header (row 8)
      const headers = ['№', 'Наименование работ', 'Ед. изм.', 'Кол-во по смете', 'Кол-во за период', 'Цена ед.', 'Стоимость', 'Примечание'];
      const hdrRow = ws.getRow(8);
      headers.forEach((v, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = v; cell.font = headerFont; cell.fill = headerFill; cell.border = thinBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      // Data rows
      const lines = act.lines || [];
      lines.forEach((line, idx) => {
        const r = ws.getRow(9 + idx);
        const vals = [idx + 1, line.name || '', line.uom || '', line.qty_smeta || 0, line.quantity || 0, line.unit_rate || 0, line.total_amount || 0, line.note || ''];
        vals.forEach((v, i) => {
          const cell = r.getCell(i + 1);
          cell.value = v; cell.font = dataFont; cell.border = thinBorder;
          if (i === 0) cell.alignment = { horizontal: 'center' };
          if (i >= 3 && i <= 6 && typeof v === 'number') cell.numFmt = numFmt;
        });
      });

      // Totals
      const totalRowIdx = 9 + lines.length;
      const subtotal = act.amount_total || lines.reduce((s, l) => s + (l.total_amount || 0), 0);
      const vatPct = act.vat_pct || 12;
      const vatAmt = act.vat_amount || subtotal * vatPct / 100;
      const totalWithVat = act.amount_total_with_vat || subtotal + vatAmt;

      const totals = [
        ['Итого', subtotal],
        [`НДС (${vatPct}%)`, vatAmt],
        ['Итого с НДС', totalWithVat],
      ];
      totals.forEach((row, i) => {
        const r = ws.getRow(totalRowIdx + i);
        ws.mergeCells(`A${totalRowIdx + i}:F${totalRowIdx + i}`);
        r.getCell(1).value = row[0]; r.getCell(1).font = headerFont; r.getCell(1).alignment = { horizontal: 'right' };
        r.getCell(7).value = row[1]; r.getCell(7).font = headerFont; r.getCell(7).numFmt = numFmt;
        for (let c = 1; c <= 8; c++) { r.getCell(c).fill = totalFill; r.getCell(c).border = thinBorder; }
      });

      // Signature area
      const sigRow = totalRowIdx + totals.length + 2;
      ws.getCell(`A${sigRow}`).value = 'Подрядчик: _______________'; ws.getCell(`A${sigRow}`).font = dataFont;
      ws.getCell(`E${sigRow}`).value = 'Заказчик: _______________'; ws.getCell(`E${sigRow}`).font = dataFont;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Forma2_${act.act_number || act.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('XLSX yuklab olishda xatolik');
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
    const isF19 = act.act_type === 'hidden_work';
    if (!isKS && !isF19) return null;

    const sigs = [];
    sigs.push({ role: 'contractor', label: t('contractor') || 'Pudratchi', at: act.signed_contractor_at, name: act.signed_contractor_name });
    sigs.push({ role: 'client', label: t('client_tech') || 'Buyurtmachi / Texnadzor', at: act.signed_client_at, name: act.signed_client_name });
    if (isF19) {
      sigs.push({ role: 'designer', label: t('designer') || 'Loyihalovchi', at: act.signed_designer_at, name: act.signed_designer_name });
      sigs.push({ role: 'gasn', label: t('gasn_inspector') || 'GASN inspektori', at: act.signed_gasn_at, name: act.signed_gasn_name });
    }

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

  // --- Forma 19 detail ---
  const Forma19Detail = ({ act }) => {
    if (!act || act.act_type !== 'hidden_work') return null;
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> {t('hidden_work_details') || 'Yashirin ishlar tafsilotlari'}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {act.stage_name && <div><span className="text-slate-500">{t('stage') || 'Bosqich'}:</span> <span className="font-medium">{act.stage_name}</span></div>}
          {act.location_axes && <div><span className="text-slate-500">{t('axes_marks') || "O'qlar, belgilar"}:</span> <span className="font-medium">{act.location_axes}</span></div>}
          {act.drawing_reference && <div><span className="text-slate-500">{t('drawing_ref') || 'Chizma havolasi'}:</span> <span className="font-medium">{act.drawing_reference}</span></div>}
          {act.works_start_date && <div><span className="text-slate-500">{t('work_period') || 'Ish davri'}:</span> <span className="font-medium">{act.works_start_date} — {act.works_end_date}</span></div>}
          {/* Photos */}
          {act.photos && act.photos.length > 0 && (
            <div>
              <p className="text-slate-500 mb-2 flex items-center gap-1"><Image className="w-4 h-4" /> {t('photos') || 'Rasmlar'} ({act.photos.length})</p>
              <div className="flex gap-2 flex-wrap">
                {act.photos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block w-24 h-24 rounded border overflow-hidden bg-slate-100">
                    <img src={p.url} alt={p.filename || `Photo ${i+1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {/* Materials */}
          {act.materials_json && act.materials_json.length > 0 && (
            <div>
              <p className="text-slate-500 mb-1">{t('materials') || 'Materiallar'}</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-1 px-2">№</th><th className="text-left py-1 px-2">{t('name') || 'Nomi'}</th><th className="text-left py-1 px-2">{t('certificate') || 'Sertifikat'}</th></tr></thead>
                <tbody>
                  {act.materials_json.map((m, i) => (
                    <tr key={i} className="border-b"><td className="py-1 px-2">{i+1}</td><td className="py-1 px-2">{m.name}</td><td className="py-1 px-2">{m.certificate_url ? <a href={m.certificate_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Ko'rish</a> : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

  // ======== DETAIL VIEW ========
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
            {selectedAct.act_type === 'ks2' && (
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

        {/* Forma 19 specific details */}
        <Forma19Detail act={selectedAct} />

        {/* Forma 3 cumulative table */}
        <Forma3Detail act={selectedAct} />

        {/* Signing panel - only show when pending */}
        {selectedAct.state === 'pending' && <SignaturePanel act={selectedAct} />}

        {/* Lines table */}
        {(selectedAct.lines || []).length > 0 && (
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
                      {selectedAct.act_type === 'ks2' && <th className="text-right py-2 px-3">{t('qty_smeta') || 'Smeta miqdori'}</th>}
                      <th className="text-right py-2 px-3">{selectedAct.act_type === 'ks2' ? (t('qty_period') || 'Davr miqdori') : (t('quantity') || 'Miqdor')}</th>
                      <th className="text-right py-2 px-3">{t('unit_rate') || 'Birlik narxi'}</th>
                      <th className="text-right py-2 px-3">{t('total_amount') || 'Jami'}</th>
                      {selectedAct.act_type === 'ks2' && <th className="text-left py-2 px-3">{t('note') || 'Izoh'}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAct.lines || []).map((line, idx) => {
                      const isEditing = editingLineId === line.id;
                      const isDraft = selectedAct.state === 'draft';
                      const isKs2 = selectedAct.act_type === 'ks2';
                      return (
                        <tr
                          key={line.id || idx}
                          className={`border-b hover:bg-slate-50 ${isDraft && isKs2 ? 'cursor-pointer' : ''} ${isEditing ? 'bg-blue-50' : ''}`}
                          onClick={() => { if (isDraft && isKs2 && !isEditing) startEditLine(line); }}
                        >
                          <td className="py-2 px-3 text-slate-400">{line.sort_order || idx + 1}</td>
                          <td className="py-2 px-3">{line.name}</td>
                          <td className="py-2 px-3">{line.uom || '—'}</td>
                          {isKs2 && <td className="py-2 px-3 text-right text-slate-500">{line.qty_smeta || '—'}</td>}
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
                          {isKs2 && (
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
                          )}
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
            <Button variant="outline" onClick={() => setShowAutoGenModal(true)}><Zap className="w-4 h-4 mr-2" /> {t('auto_ks2') || 'KS-2 avto'}</Button>
            <Button variant="outline" onClick={() => setShowGenF3Modal(true)}><FileText className="w-4 h-4 mr-2" /> {t('gen_ks3') || 'KS-3 yaratish'}</Button>
            <Button variant="outline" className="text-orange-600 border-orange-300" onClick={() => { setF19Form(EMPTY_F19_FORM); setF19Error(null); setShowF19Modal(true); }}>
              <Camera className="w-4 h-4 mr-2" /> {t('create_f19') || 'Forma 19'}
            </Button>
            <Button onClick={() => { setForm(EMPTY_FORM); setError(null); setSelectedLines([]); setEstimateLines([]); setShowCreateModal(true); }}>
              <Plus className="w-4 h-4 mr-2" /> {t('create_form')}
            </Button>
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
                  {sortedActs.map(act => (
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
                  ))}
                </tbody>
              </table>
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
            <div><Label>{t('subcontract') || 'Subpudrat'} *</Label>
              <Select value={form.subcontract_id || ''} onValueChange={v => { setForm(f => ({ ...f, subcontract_id: v })); loadEstimateLines(v); }}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>{(subcontracts || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || s.partner_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('period_from') || 'Boshlanish'} *</Label><Input type="date" value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))} /></div>
              <div><Label>{t('period_to') || 'Tugash'} *</Label><Input type="date" value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))} /></div>
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
                          <th className="text-left py-2 px-2">{t('name') || 'Nomi'}</th>
                          <th className="text-left py-2 px-2">{t('uom') || "O'lchov"}</th>
                          <th className="text-right py-2 px-2">{t('qty_smeta') || 'Smeta miqdori'}</th>
                          <th className="text-right py-2 px-2">{t('unit_rate') || 'Birlik narxi'}</th>
                          <th className="text-right py-2 px-2 w-32">{t('qty_period') || 'Davr miqdori'}</th>
                          <th className="text-right py-2 px-2">{t('line_total') || 'Qator jami'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estimateLines.map(line => {
                          const isSelected = selectedLines.some(l => l.estimate_line_id === line.estimate_line_id);
                          const selectedLine = selectedLines.find(l => l.estimate_line_id === line.estimate_line_id);
                          const lineTotal = isSelected ? (selectedLine?.qty_period || 0) * line.unit_rate : 0;
                          return (
                            <tr key={line.estimate_line_id} className={`border-b hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleEstimateLine(line)}
                                  className="rounded border-slate-300"
                                />
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
                                    className="w-28 h-7 text-right text-sm"
                                  />
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right font-medium">{isSelected ? formatCurrency(lineTotal) : '—'}</td>
                            </tr>
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
      <Dialog open={showF19Modal} onOpenChange={setShowF19Modal}>
        <DialogContent className="max-w-xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('create_f19') || 'Forma 19 yaratish'}</DialogTitle><DialogDescription className="sr-only">Create Forma 19</DialogDescription></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {f19Error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{f19Error}</p>}
            <div><Label>{t('stage') || 'Bosqich'} *</Label>
              <Select value={f19Form.stage_id || ''} onValueChange={v => setF19Form(f => ({ ...f, stage_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Bosqichni tanlang" /></SelectTrigger>
                <SelectContent>{(stages || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('axes_marks') || "O'qlar, belgilar, kesim"} *</Label><Input value={f19Form.location_axes} onChange={e => setF19Form(f => ({ ...f, location_axes: e.target.value }))} placeholder="A-D / 1-5, отм. -3.200" /></div>
            <div><Label>{t('drawing_ref') || 'Chizma havolasi'}</Label><Input value={f19Form.drawing_reference} onChange={e => setF19Form(f => ({ ...f, drawing_reference: e.target.value }))} placeholder="КЖ-1, лист 5" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('works_start') || 'Ish boshlangan sana'} *</Label><Input type="date" value={f19Form.works_start_date} onChange={e => setF19Form(f => ({ ...f, works_start_date: e.target.value }))} /></div>
              <div><Label>{t('works_end') || 'Ish tugagan sana'} *</Label><Input type="date" value={f19Form.works_end_date} onChange={e => setF19Form(f => ({ ...f, works_end_date: e.target.value }))} /></div>
            </div>
            <div><Label>{t('description') || 'Tavsif'}</Label><Textarea value={f19Form.notes} onChange={e => setF19Form(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Yashirin ishlar tavsifi..." /></div>
            {/* Photos */}
            <div>
              <Label>{t('photos') || 'Rasmlar'} * ({t('min_2') || 'kamida 2 ta'})</Label>
              {f19Form.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3 mt-2">
                  {f19Form.photos.map((p, i) => (
                    <div key={i} className="relative group rounded-lg border overflow-hidden">
                      <img src={p.url} alt={p.filename || `Photo ${i + 1}`} className="w-full h-24 object-cover" />
                      <Button
                        variant="destructive" size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setF19Form(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      <p className="text-[10px] text-slate-500 p-1 truncate">{p.filename || 'Photo'}</p>
                    </div>
                  ))}
                </div>
              )}
              <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${photoUploading ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={photoUploading}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setPhotoUploading(true);
                    try {
                      const uploaded = [];
                      for (const file of files) {
                        const res = await UploadFile(file);
                        uploaded.push({ url: res.url, filename: file.name });
                      }
                      setF19Form(f => ({ ...f, photos: [...f.photos, ...uploaded] }));
                    } catch {
                      toast.error('Rasm yuklashda xatolik');
                    } finally {
                      setPhotoUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
                {photoUploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin text-blue-500" /> <span className="text-sm text-blue-600">Yuklanmoqda...</span></>
                ) : (
                  <><Upload className="w-5 h-5 text-slate-400" /> <span className="text-sm text-slate-500">Rasm yuklash (bir nechta tanlash mumkin)</span></>
                )}
              </label>
            </div>
            {/* Materials */}
            <div>
              <Label>{t('materials') || 'Materiallar'}</Label>
              {f19Form.materials_json.map((m, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={m.name} onChange={e => { const mats = [...f19Form.materials_json]; mats[i] = { ...mats[i], name: e.target.value }; setF19Form(f => ({ ...f, materials_json: mats })); }} placeholder="Material nomi" className="flex-1" />
                  <Input value={m.certificate_url} onChange={e => { const mats = [...f19Form.materials_json]; mats[i] = { ...mats[i], certificate_url: e.target.value }; setF19Form(f => ({ ...f, materials_json: mats })); }} placeholder="Sertifikat URL" className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => { const mats = f19Form.materials_json.filter((_, j) => j !== i); setF19Form(f => ({ ...f, materials_json: mats })); }}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setF19Form(f => ({ ...f, materials_json: [...f.materials_json, { name: '', certificate_url: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> {t('add_material') || "Material qo'shish"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowF19Modal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleCreateF19} disabled={f19Saving}>{f19Saving ? 'Saqlanmoqda...' : 'Yaratish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-generate KS-2 Modal */}
      <Dialog open={showAutoGenModal} onOpenChange={setShowAutoGenModal}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('auto_generate_ks2') || 'KS-2 avtomatik yaratish'}</DialogTitle><DialogDescription className="sr-only">Auto KS-2</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('subcontractor') || 'Subpudratchi'} *</Label>
              <Select value={autoGenForm.subcontract_id || ''} onValueChange={v => setAutoGenForm(f => ({ ...f, subcontract_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>{(subcontracts || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || s.partner_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('period_from') || 'Boshlanish'} *</Label><Input type="date" value={autoGenForm.period_from} onChange={e => setAutoGenForm(f => ({ ...f, period_from: e.target.value }))} /></div>
              <div><Label>{t('period_to') || 'Tugash'} *</Label><Input type="date" value={autoGenForm.period_to} onChange={e => setAutoGenForm(f => ({ ...f, period_to: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoGenModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleAutoGenerate} disabled={autoGenSaving}>{autoGenSaving ? 'Yaratilmoqda...' : 'Yaratish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Forma 3 (KS-3) Modal */}
      <Dialog open={showGenF3Modal} onOpenChange={setShowGenF3Modal}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('gen_ks3') || 'KS-3 (Forma 3) yaratish'}</DialogTitle><DialogDescription className="sr-only">Generate KS-3</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{t('gen_ks3_desc') || "Imzolangan KS-2 aktlar asosida KS-3 hisoboti yaratiladi"}</p>
            <div><Label>{t('subcontractor') || 'Subpudratchi'} *</Label>
              <Select value={genF3Form.subcontract_id || ''} onValueChange={v => setGenF3Form(f => ({ ...f, subcontract_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>{(subcontracts || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || s.partner_name}</SelectItem>)}</SelectContent>
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
