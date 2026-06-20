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
import { Plus, Trash2, CheckCircle, XCircle, ArrowLeft, FileText, Eye, Download, PenLine, Ban, ImagePlus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import Loader from '@/components/ui/loader';
import { UploadFile } from '@/api/integrations';
import { toast } from 'sonner';

const DEFAULT_TYPE_COLORS = {
  acceptance: 'bg-green-100 text-green-700',
  defect: 'bg-red-100 text-red-700',
  ks2: 'bg-blue-100 text-blue-700',
  ks3: 'bg-purple-100 text-purple-700',
  hidden_work: 'bg-amber-100 text-amber-700',
};

// Format an ISO date string (YYYY-MM-DD, optionally with time) as dd.mm.yyyy
// for display. Returns '' for empty/invalid input. Used only for display —
// the create form keeps ISO because <input type="date"> requires it.
const fmtDate = (s) => {
  if (!s) return '';
  const p = String(s).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : String(s);
};

const STATE_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  signed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const EMPTY_FORM = {
  act_type: '',
  subcontract: '',
  period_from: '',
  period_to: '',
  notes: '',
  photos: [],
};

const ActsTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  // Dynamic act types from API
  const [actTypes, setActTypes] = useState([]);
  const [actTypesLoading, setActTypesLoading] = useState(true);
  const [showNewTypeModal, setShowNewTypeModal] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeSaving, setNewTypeSaving] = useState(false);

  const loadActTypes = useCallback(async () => {
    try {
      const types = await constructionService.listActTypes();
      setActTypes(types || []);
    } catch (e) {
      console.error('Failed to load act types:', e);
      // Fallback to defaults
      setActTypes([
        { value: 'acceptance', label: 'Qabul qilish', color: 'bg-green-100 text-green-700' },
        { value: 'defect', label: 'Nuqson', color: 'bg-red-100 text-red-700' },
        { value: 'ks2', label: 'Forma 2', color: 'bg-blue-100 text-blue-700' },
        { value: 'ks3', label: 'Forma 3', color: 'bg-purple-100 text-purple-700' },
        { value: 'hidden_work', label: 'Yashirin ish', color: 'bg-amber-100 text-amber-700' },
      ]);
    } finally {
      setActTypesLoading(false);
    }
  }, []);

  useEffect(() => { loadActTypes(); }, [loadActTypes]);

  // Build TYPE_LABELS and TYPE_COLORS from dynamic actTypes
  const TYPE_LABELS = {};
  const TYPE_COLORS = {};
  actTypes.forEach(at => {
    TYPE_LABELS[at.value] = at.label;
    TYPE_COLORS[at.value] = at.color || DEFAULT_TYPE_COLORS[at.value] || 'bg-slate-100 text-slate-700';
  });

  const handleCreateActType = async () => {
    if (!newTypeLabel.trim()) return;
    setNewTypeSaving(true);
    try {
      await constructionService.createActType({ label: newTypeLabel.trim() });
      setNewTypeLabel('');
      setShowNewTypeModal(false);
      toast.success('Akt turi yaratildi');
      await loadActTypes();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setNewTypeSaving(false);
    }
  };

  const handleDeleteActType = async (typeId) => {
    try {
      await constructionService.deleteActType(typeId);
      toast.success("Akt turi o'chirildi");
      await loadActTypes();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const STATE_LABELS = {
    draft: t('draft') || 'Qoralama',
    submitted: t('submitted') || 'Yuborilgan',
    approved: t('approved') || 'Tasdiqlangan',
    rejected: t('rejected') || 'Rad etilgan',
    signed: t('signed') || 'Imzolangan',
    cancelled: t('cancelled') || 'Bekor qilingan',
  };

  // List state
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ act_type: '', state: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Detail view state
  const [selectedAct, setSelectedAct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sign dialog
  const [signTarget, setSignTarget] = useState(null);
  const [signRole, setSignRole] = useState('');

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setCurrentPage(1);
    try {
      const params = {};
      if (filters.act_type) params.type = filters.act_type;
      if (filters.state) params.state = filters.state;
      const actsData = await constructionService.listActs(project.id, params);
      setActs(actsData || []);
    } catch (e) {
      console.error('Failed to load acts:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id, filters]);

  useEffect(() => { load(); }, [load]);

  const loadActDetail = async (actId) => {
    setDetailLoading(true);
    try {
      const act = await constructionService.getAct(actId);
      setSelectedAct(act);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setDetailLoading(false);
    }
  };

  // ---- Handlers ----

  const handleCreate = async () => {
    if (!form.act_type.trim()) { setError('Akt turini tanlang'); return; }
    if (!form.period_from || !form.period_to) { setError('Davrni kiriting'); return; }
    setSaving(true);
    setError(null);
    try {
      // Upload photos first
      const uploadedPhotos = [];
      for (const file of form.photos) {
        const uploadResult = await UploadFile(file);
        const fileUrl = uploadResult?.url || uploadResult?.file_url || uploadResult;
        uploadedPhotos.push({ url: fileUrl, filename: file.name });
      }

      const payload = {
        act_type: form.act_type.trim(),
        subcontract_id: 0,
        period_from: form.period_from,
        period_to: form.period_to,
        notes: (form.subcontract.trim() ? `Subpudrat: ${form.subcontract.trim()}\n` : '') + (form.notes || ''),
        photos: uploadedPhotos,
      };
      await constructionService.createAct(project.id, payload);
      setShowCreateModal(false);
      toast.success(t('act_created') || 'Akt yaratildi');
      load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!signTarget || !signRole) return;
    try {
      await constructionService.signAct(signTarget.id, { role: signRole });
      setSignTarget(null);
      setSignRole('');
      toast.success(`Akt imzolandi (${signRole})`);
      if (selectedAct?.id === signTarget.id) await loadActDetail(signTarget.id);
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
      await constructionService.cancelAct(cancelTarget.id, { rejection_reason: cancelReason });
      setCancelTarget(null);
      setCancelReason('');
      toast.success('Akt bekor qilindi');
      if (selectedAct?.id === cancelTarget.id) await loadActDetail(cancelTarget.id);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const handleApprove = async (act) => {
    try {
      await constructionService.approveAct(act.id);
      toast.success('Akt tasdiqlandi');
      if (selectedAct?.id === act.id) await loadActDetail(act.id);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectionReason.trim()) {
      toast.error('Rad etish sababini kiriting'); return;
    }
    try {
      await constructionService.rejectAct(rejectTarget.id, { rejection_reason: rejectionReason });
      setRejectTarget(null);
      setRejectionReason('');
      toast.success('Akt rad etildi');
      if (selectedAct?.id === rejectTarget.id) await loadActDetail(rejectTarget.id);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const handleExportPDF = async (act) => {
    try {
      const blob = await constructionService.exportActPDF(act.id);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await constructionService.deleteAct(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedAct?.id === deleteTarget.id) setSelectedAct(null);
      toast.success("Akt o'chirildi");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

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
            <Button variant="outline" size="sm" onClick={() => handleExportPDF(selectedAct)}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Act info card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {t('act_info') || "Akt ma'lumotlari"}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-slate-500">{t('type') || 'Turi'}</p><p className="font-medium">{TYPE_LABELS[selectedAct.act_type]}</p></div>
              {selectedAct.period_from && <div><p className="text-slate-500">{t('period') || 'Davr'}</p><p className="font-medium">{fmtDate(selectedAct.period_from)} — {fmtDate(selectedAct.period_to)}</p></div>}
              {selectedAct.subcontract_name && <div><p className="text-slate-500">{t('subcontractor') || 'Subpudratchi'}</p><p className="font-medium">{selectedAct.subcontract_name}</p></div>}
              <div><p className="text-slate-500">{t('amount') || 'Summa'}</p><p className="font-medium">{formatCurrency(selectedAct.amount_total || 0)}</p></div>
            </div>
            {selectedAct.notes && <div className="mt-4"><p className="text-slate-500 text-sm">{t('notes') || 'Izohlar'}</p><p className="text-sm mt-1">{selectedAct.notes}</p></div>}
          </CardContent>
        </Card>

        {/* Lines table */}
        {(selectedAct.lines || []).length > 0 && (
          <Card>
            <CardHeader><CardTitle>{t('act_lines') || 'Akt qatorlari'}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2 px-3">#</th>
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
            <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(selectedAct)}>
              <Trash2 className="w-4 h-4 mr-1" /> {t('delete') || "O'chirish"}
            </Button>
          )}
          {(selectedAct.state === 'submitted') && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(selectedAct)}>
                <CheckCircle className="w-4 h-4 mr-1" /> {t('approve') || 'Tasdiqlash'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { setRejectTarget(selectedAct); setRejectionReason(''); }}>
                <XCircle className="w-4 h-4 mr-1" /> {t('reject') || 'Rad etish'}
              </Button>
            </>
          )}
          {(selectedAct.state === 'signed' || selectedAct.state === 'approved') && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => { setCancelTarget(selectedAct); setCancelReason(''); }}>
              <Ban className="w-4 h-4 mr-1" /> {t('cancel_act') || 'Bekor qilish'}
            </Button>
          )}
        </div>

        {/* Reject dialog */}
        <AlertDialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectionReason(''); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t('reject_act') || 'Aktni rad etish'}</AlertDialogTitle><AlertDialogDescription>{t('reject_act_desc') || 'Rad etish sababini kiriting'}</AlertDialogDescription></AlertDialogHeader>
            <div className="px-6 pb-2"><Label>{t('rejection_reason') || 'Sabab'}</Label><Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} /></div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">{t('reject') || 'Rad etish'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel dialog */}
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

        {/* Delete dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t('delete_act_title') || "Aktni o'chirish"}</AlertDialogTitle><AlertDialogDescription>{t('delete_act_desc') || "Haqiqatan ham bu aktni o'chirmoqchimisiz?"}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || "O'chirish"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Sign dialog */}
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
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {t('acts') || 'Aktlar'}</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.act_type || 'all'} onValueChange={v => setFilters(f => ({ ...f, act_type: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_types') || 'Barcha turlar'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_types') || 'Barcha turlar'}</SelectItem>
                {actTypes.map(at => (
                  <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.state || 'all'} onValueChange={v => setFilters(f => ({ ...f, state: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_states') || 'Barcha holatlar'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_states') || 'Barcha holatlar'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                <SelectItem value="submitted">{t('submitted') || 'Yuborilgan'}</SelectItem>
                <SelectItem value="approved">{t('approved') || 'Tasdiqlangan'}</SelectItem>
                <SelectItem value="signed">{t('signed') || 'Imzolangan'}</SelectItem>
                <SelectItem value="rejected">{t('rejected') || 'Rad etilgan'}</SelectItem>
                <SelectItem value="cancelled">{t('cancelled') || 'Bekor qilingan'}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setForm(EMPTY_FORM); setError(null); setShowCreateModal(true); }}>
              <Plus className="w-4 h-4 mr-2" /> {t('create_act') || 'Akt yaratish'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader />
          ) : (acts || []).length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_acts') || "Aktlar yo'q"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                    <th className="text-left py-2 px-3">{t('type') || 'Turi'}</th>
                    <th className="text-left py-2 px-3">{t('period') || 'Davr'}</th>
                    <th className="text-left py-2 px-3">{t('subcontractor') || 'Subpudratchi'}</th>
                    <th className="text-right py-2 px-3">{t('amount') || 'Summa'}</th>
                    <th className="text-left py-2 px-3">{t('state') || 'Holat'}</th>
                    <th className="text-right py-2 px-3">{t('actions') || 'Amallar'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalCount = (acts || []).length;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    const paginatedItems = (acts || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
                    return paginatedItems.map(act => (
                      <tr key={act.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium">{act.name}{act.act_number ? ` #${act.act_number}` : ''}</td>
                        <td className="py-2 px-3"><Badge className={TYPE_COLORS[act.act_type]}>{TYPE_LABELS[act.act_type] || act.act_type}</Badge></td>
                        <td className="py-2 px-3 whitespace-nowrap">{act.period_from ? `${fmtDate(act.period_from)} — ${fmtDate(act.period_to)}` : '—'}</td>
                        <td className="py-2 px-3">{act.subcontract_name || '—'}</td>
                        <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{formatCurrency(act.amount_total || 0)}</td>
                        <td className="py-2 px-3"><Badge className={STATE_COLORS[act.state]}>{STATE_LABELS[act.state] || act.state}</Badge></td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => loadActDetail(act.id)}><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleExportPDF(act)}><Download className="w-4 h-4 text-slate-500" /></Button>
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
                const totalCount = (acts || []).length;
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

      {/* Create Act Modal (acceptance, defect) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('create_act') || 'Akt yaratish'}</DialogTitle><DialogDescription className="sr-only">Create act</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div><Label>{t('act_type') || 'Akt turi'} *</Label>
              <div className="flex gap-2">
                <Select value={form.act_type || ''} onValueChange={v => setForm(f => ({ ...f, act_type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={t('select_act_type') || 'Akt turini tanlang'} /></SelectTrigger>
                  <SelectContent>
                    {actTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => { setNewTypeLabel(''); setShowNewTypeModal(true); }} title={"Yangi tur qo'shish"}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div><Label>{t('subcontract') || 'Subpudrat'}</Label>
              <Input
                value={form.subcontract}
                onChange={e => setForm(f => ({ ...f, subcontract: e.target.value }))}
                placeholder={'Subpudratchi nomi'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('period_from') || 'Boshlanish sanasi'} *</Label><Input type="date" value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))} /></div>
              <div><Label>{t('period_to') || 'Tugash sanasi'} *</Label><Input type="date" value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))} /></div>
            </div>
            <div><Label>{t('notes') || 'Izohlar'}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            {/* Photo upload */}
            <div>
              <Label>{t('photos') || 'Rasmlar'}</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {form.photos.map((file, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }))}
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <ImagePlus className="w-5 h-5 text-slate-400" />
                  <span className="text-[10px] text-slate-400 mt-1">{t('add_photo') || 'Qo\'shish'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) setForm(f => ({ ...f, photos: [...f.photos, ...files] }));
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saqlanmoqda...' : 'Yaratish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Act Type Modal */}
      <Dialog open={showNewTypeModal} onOpenChange={setShowNewTypeModal}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{"Yangi akt turi qo'shish"}</DialogTitle><DialogDescription className="sr-only">Add new act type</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{'Turi nomi'} *</Label>
              <Input
                value={newTypeLabel}
                onChange={e => setNewTypeLabel(e.target.value)}
                placeholder={"Sinov akti"}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateActType(); }}
              />
            </div>
            {/* Existing custom types with delete option */}
            {actTypes.filter(at => !at.is_system).length > 0 && (
              <div>
                <Label className="text-slate-500">{"Qo'shilgan turlar"}</Label>
                <div className="mt-1 space-y-1">
                  {actTypes.filter(at => !at.is_system).map(at => (
                    <div key={at.id} className="flex items-center justify-between bg-slate-50 rounded px-3 py-1.5 text-sm">
                      <span>{at.label}</span>
                      <button onClick={() => handleDeleteActType(at.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTypeModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleCreateActType} disabled={newTypeSaving || !newTypeLabel.trim()}>
              {newTypeSaving ? 'Saqlanmoqda...' : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectionReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('reject_act') || 'Aktni rad etish'}</AlertDialogTitle><AlertDialogDescription>{t('reject_act_desc') || 'Sababini kiriting'}</AlertDialogDescription></AlertDialogHeader>
          <div className="px-6 pb-2"><Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">{t('reject') || 'Rad etish'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

export default ActsTab;
