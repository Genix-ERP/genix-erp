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
import { Plus, Trash2, CheckCircle, XCircle, ArrowLeft, FileText, Zap, Eye } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const TYPE_COLORS = {
  ks2: 'bg-blue-100 text-blue-700',
  ks3: 'bg-purple-100 text-purple-700',
  hidden_work: 'bg-orange-100 text-orange-700',
  acceptance: 'bg-green-100 text-green-700',
  defect: 'bg-red-100 text-red-700',
};

const STATE_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  act_type: '',
  subcontract_id: '',
  period_from: '',
  period_to: '',
  notes: '',
};

const ActsTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const TYPE_LABELS = {
    ks2: 'KS-2',
    ks3: 'KS-3',
    hidden_work: t('hidden_work') || 'Yashirin ish',
    acceptance: t('acceptance') || 'Qabul qilish',
    defect: t('defect') || 'Nuqson',
  };

  const STATE_LABELS = {
    draft: t('draft') || 'Qoralama',
    submitted: t('submitted') || 'Yuborilgan',
    approved: t('approved') || 'Tasdiqlangan',
    rejected: t('rejected') || 'Rad etilgan',
  };

  // List state
  const [acts, setActs] = useState([]);
  const [subcontracts, setSubcontracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ act_type: '', state: '' });

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-generate KS-2 modal state
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  const [autoGenForm, setAutoGenForm] = useState({ subcontract_id: '', period_from: '', period_to: '' });
  const [autoGenSaving, setAutoGenSaving] = useState(false);

  // Detail view state
  const [selectedAct, setSelectedAct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const params = {};
      if (filters.act_type) params.act_type = filters.act_type;
      if (filters.state) params.state = filters.state;
      const [actsData, subData] = await Promise.all([
        constructionService.listActs(project.id, params),
        constructionService.listSubcontracts(project.id),
      ]);
      setActs(actsData || []);
      setSubcontracts(subData || []);
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
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setDetailLoading(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!form.act_type) { setError(t('validation_type_required') || 'Akt turini tanlang'); return; }
    if (!form.subcontract_id) { setError(t('validation_subcontract_required') || 'Subpudratni tanlang'); return; }
    if (!form.period_from || !form.period_to) { setError(t('validation_period_required') || 'Davrni kiriting'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        act_type: form.act_type,
        subcontract_id: Number(form.subcontract_id),
        period_from: form.period_from,
        period_to: form.period_to,
        notes: form.notes || '',
      };
      await constructionService.createAct(project.id, payload);
      setShowCreateModal(false);
      toast.success(t('act_created') || 'Akt yaratildi');
      load();
    } catch (e) {
      setError(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const openAutoGen = () => {
    setAutoGenForm({ subcontract_id: '', period_from: '', period_to: '' });
    setShowAutoGenModal(true);
  };

  const handleAutoGenerate = async () => {
    if (!autoGenForm.subcontract_id || !autoGenForm.period_from || !autoGenForm.period_to) {
      toast.error(t('fill_all_fields') || 'Barcha maydonlarni to\'ldiring');
      return;
    }
    setAutoGenSaving(true);
    try {
      await constructionService.autoGenerateKS2(project.id, {
        subcontract_id: Number(autoGenForm.subcontract_id),
        period_from: autoGenForm.period_from,
        period_to: autoGenForm.period_to,
      });
      setShowAutoGenModal(false);
      toast.success(t('ks2_generated') || 'KS-2 avtomatik yaratildi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setAutoGenSaving(false);
    }
  };

  const handleApprove = async (act) => {
    try {
      await constructionService.approveAct(act.id);
      toast.success(t('act_approved') || 'Akt tasdiqlandi');
      if (selectedAct?.id === act.id) {
        await loadActDetail(act.id);
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      toast.error(t('rejection_reason_required') || 'Rad etish sababini kiriting');
      return;
    }
    try {
      await constructionService.rejectAct(rejectTarget.id, { rejection_reason: rejectionReason });
      setRejectTarget(null);
      setRejectionReason('');
      toast.success(t('act_rejected') || 'Akt rad etildi');
      if (selectedAct?.id === rejectTarget.id) {
        await loadActDetail(rejectTarget.id);
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const handleGenerateKS3 = async (act) => {
    try {
      await constructionService.generateKS3FromKS2(act.id);
      toast.success(t('ks3_generated') || 'KS-3 yaratildi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await constructionService.deleteAct(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedAct?.id === deleteTarget.id) {
        setSelectedAct(null);
      }
      toast.success(t('act_deleted') || 'Akt o\'chirildi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  // Detail view
  if (selectedAct) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedAct(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('back') || 'Ortga'}
          </Button>
          <h3 className="text-lg font-semibold">{selectedAct.name}</h3>
          <Badge className={TYPE_COLORS[selectedAct.act_type]}>{TYPE_LABELS[selectedAct.act_type] || selectedAct.act_type}</Badge>
          <Badge className={STATE_COLORS[selectedAct.state]}>{STATE_LABELS[selectedAct.state] || selectedAct.state}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t('act_info') || 'Akt ma\'lumotlari'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">{t('type') || 'Turi'}</p>
                <p className="font-medium">{TYPE_LABELS[selectedAct.act_type] || selectedAct.act_type}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('period') || 'Davr'}</p>
                <p className="font-medium">{selectedAct.period_from} — {selectedAct.period_to}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('subcontractor') || 'Subpudratchi'}</p>
                <p className="font-medium">{selectedAct.subcontract_name || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('amount') || 'Summa'}</p>
                <p className="font-medium">{formatCurrency(selectedAct.amount || 0)}</p>
              </div>
            </div>
            {selectedAct.notes && (
              <div className="mt-4">
                <p className="text-slate-500 text-sm">{t('notes') || 'Izohlar'}</p>
                <p className="text-sm mt-1">{selectedAct.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lines table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('act_lines') || 'Akt qatorlari'}</CardTitle>
          </CardHeader>
          <CardContent>
            {(selectedAct.lines || []).length === 0 ? (
              <div className="text-center py-8 text-slate-400">{t('no_lines') || 'Qatorlar yo\'q'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                      <th className="text-left py-2 px-3">{t('uom') || 'O\'lchov birligi'}</th>
                      <th className="text-right py-2 px-3">{t('quantity') || 'Miqdor'}</th>
                      <th className="text-right py-2 px-3">{t('unit_rate') || 'Birlik narxi'}</th>
                      <th className="text-right py-2 px-3">{t('total_amount') || 'Jami summa'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAct.lines || []).map((line, idx) => (
                      <tr key={line.id || idx} className="border-b hover:bg-slate-50">
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
            )}
          </CardContent>
        </Card>

        {/* Action buttons based on state */}
        <div className="flex gap-2">
          {selectedAct.state === 'draft' && (
            <>
              <Badge className="bg-slate-100 text-slate-700 text-sm px-3 py-1">{t('draft') || 'Qoralama'}</Badge>
              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(selectedAct)}>
                <Trash2 className="w-4 h-4 mr-1" />
                {t('delete') || 'O\'chirish'}
              </Button>
            </>
          )}
          {selectedAct.state === 'submitted' && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(selectedAct)}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {t('approve') || 'Tasdiqlash'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { setRejectTarget(selectedAct); setRejectionReason(''); }}>
                <XCircle className="w-4 h-4 mr-1" />
                {t('reject') || 'Rad etish'}
              </Button>
            </>
          )}
          {selectedAct.state === 'approved' && selectedAct.act_type === 'ks2' && (
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => handleGenerateKS3(selectedAct)}>
              <FileText className="w-4 h-4 mr-1" />
              {t('generate_ks3') || 'KS-3 yaratish'}
            </Button>
          )}
        </div>

        {/* Reject dialog */}
        <AlertDialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectionReason(''); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('reject_act') || 'Aktni rad etish'}</AlertDialogTitle>
              <AlertDialogDescription>{t('reject_act_desc') || 'Rad etish sababini kiriting'}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-6 pb-2">
              <Label>{t('rejection_reason') || 'Rad etish sababi'}</Label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder={t('rejection_reason_placeholder') || 'Sababni kiriting...'}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">{t('reject') || 'Rad etish'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('delete_act_title') || 'Aktni o\'chirish'}</AlertDialogTitle>
              <AlertDialogDescription>{t('delete_act_desc') || 'Haqiqatan ham bu aktni o\'chirmoqchimisiz?'}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || 'O\'chirish'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('acts') || 'Aktlar'}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.act_type || 'all'} onValueChange={v => setFilters(f => ({ ...f, act_type: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_types') || 'Barcha turlar'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_types') || 'Barcha turlar'}</SelectItem>
                <SelectItem value="ks2">KS-2</SelectItem>
                <SelectItem value="ks3">KS-3</SelectItem>
                <SelectItem value="hidden_work">{t('hidden_work') || 'Yashirin ish'}</SelectItem>
                <SelectItem value="acceptance">{t('acceptance') || 'Qabul qilish'}</SelectItem>
                <SelectItem value="defect">{t('defect') || 'Nuqson'}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.state || 'all'} onValueChange={v => setFilters(f => ({ ...f, state: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_states') || 'Barcha holatlar'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_states') || 'Barcha holatlar'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                <SelectItem value="submitted">{t('submitted') || 'Yuborilgan'}</SelectItem>
                <SelectItem value="approved">{t('approved') || 'Tasdiqlangan'}</SelectItem>
                <SelectItem value="rejected">{t('rejected') || 'Rad etilgan'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={openAutoGen}>
              <Zap className="w-4 h-4 mr-2" />
              {t('auto_generate_ks2') || 'KS-2 avtomatik yaratish'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {t('create_act') || 'Akt yaratish'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">{t('loading') || 'Yuklanmoqda...'}</div>
          ) : (acts || []).length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_acts') || 'Aktlar yo\'q'}</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                {t('create_first_act') || 'Birinchi aktni yarating'}
              </Button>
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
                  {(acts || []).map(act => (
                    <tr key={act.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{act.name}</td>
                      <td className="py-2 px-3">
                        <Badge className={TYPE_COLORS[act.act_type]}>{TYPE_LABELS[act.act_type] || act.act_type}</Badge>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">{act.period_from} — {act.period_to}</td>
                      <td className="py-2 px-3">{act.subcontract_name || '—'}</td>
                      <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{formatCurrency(act.amount || 0)}</td>
                      <td className="py-2 px-3">
                        <Badge className={STATE_COLORS[act.state]}>{STATE_LABELS[act.state] || act.state}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title={t('view') || 'Ko\'rish'} onClick={() => loadActDetail(act.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {act.state === 'submitted' && (
                            <>
                              <Button variant="ghost" size="sm" title={t('approve') || 'Tasdiqlash'} onClick={() => handleApprove(act)}>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="sm" title={t('reject') || 'Rad etish'} onClick={() => { setRejectTarget(act); setRejectionReason(''); }}>
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {act.state === 'approved' && act.act_type === 'ks2' && (
                            <Button variant="ghost" size="sm" title={t('generate_ks3') || 'KS-3 yaratish'} onClick={() => handleGenerateKS3(act)}>
                              <FileText className="w-4 h-4 text-purple-600" />
                            </Button>
                          )}
                          {act.state === 'draft' && (
                            <Button variant="ghost" size="sm" title={t('delete') || 'O\'chirish'} onClick={() => setDeleteTarget(act)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
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

      {/* Create Act Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('create_act') || 'Akt yaratish'}</DialogTitle>
            <DialogDescription className="sr-only">{t('create_act') || 'Akt yaratish'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div>
              <Label>{t('act_type') || 'Akt turi'} *</Label>
              <Select value={form.act_type || ''} onValueChange={v => setForm(f => ({ ...f, act_type: v }))}>
                <SelectTrigger><SelectValue placeholder={t('select_act_type') || 'Akt turini tanlang'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ks2">KS-2</SelectItem>
                  <SelectItem value="ks3">KS-3</SelectItem>
                  <SelectItem value="hidden_work">{t('hidden_work') || 'Yashirin ish'}</SelectItem>
                  <SelectItem value="acceptance">{t('acceptance') || 'Qabul qilish'}</SelectItem>
                  <SelectItem value="defect">{t('defect') || 'Nuqson'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('subcontract') || 'Subpudrat'} *</Label>
              <Select value={form.subcontract_id || ''} onValueChange={v => setForm(f => ({ ...f, subcontract_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('select_subcontract') || 'Subpudratni tanlang'} /></SelectTrigger>
                <SelectContent>
                  {(subcontracts || []).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name || s.contractor_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('period_from') || 'Boshlanish sanasi'} *</Label>
                <Input type="date" value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))} />
              </div>
              <div>
                <Label>{t('period_to') || 'Tugash sanasi'} *</Label>
                <Input type="date" value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>{t('notes') || 'Izohlar'}</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder={t('notes_placeholder') || 'Izoh kiriting...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? (t('saving') || 'Saqlanmoqda...') : (t('create') || 'Yaratish')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-generate KS-2 Modal */}
      <Dialog open={showAutoGenModal} onOpenChange={setShowAutoGenModal}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('auto_generate_ks2') || 'KS-2 avtomatik yaratish'}</DialogTitle>
            <DialogDescription className="sr-only">{t('auto_generate_ks2') || 'KS-2 avtomatik yaratish'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('subcontractor') || 'Subpudratchi'} *</Label>
              <Select value={autoGenForm.subcontract_id || ''} onValueChange={v => setAutoGenForm(f => ({ ...f, subcontract_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('select_subcontract') || 'Subpudratni tanlang'} /></SelectTrigger>
                <SelectContent>
                  {(subcontracts || []).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name || s.contractor_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('period_from') || 'Boshlanish sanasi'} *</Label>
                <Input type="date" value={autoGenForm.period_from} onChange={e => setAutoGenForm(f => ({ ...f, period_from: e.target.value }))} />
              </div>
              <div>
                <Label>{t('period_to') || 'Tugash sanasi'} *</Label>
                <Input type="date" value={autoGenForm.period_to} onChange={e => setAutoGenForm(f => ({ ...f, period_to: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoGenModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleAutoGenerate} disabled={autoGenSaving}>
              {autoGenSaving ? (t('generating') || 'Yaratilmoqda...') : (t('generate') || 'Yaratish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectionReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reject_act') || 'Aktni rad etish'}</AlertDialogTitle>
            <AlertDialogDescription>{t('reject_act_desc') || 'Rad etish sababini kiriting'}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label>{t('rejection_reason') || 'Rad etish sababi'}</Label>
            <Textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder={t('rejection_reason_placeholder') || 'Sababni kiriting...'}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">{t('reject') || 'Rad etish'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_act_title') || 'Aktni o\'chirish'}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete_act_desc') || 'Haqiqatan ham bu aktni o\'chirmoqchimisiz?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || 'O\'chirish'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ActsTab;
