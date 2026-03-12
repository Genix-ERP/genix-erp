import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Package, BarChart3 } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const SUMMARY_STATUS_COLORS = {
  overuse: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  normal: 'bg-green-100 text-green-700',
};

const SUMMARY_ROW_COLORS = {
  overuse: 'bg-red-50',
  warning: 'bg-yellow-50',
  normal: '',
};

const EMPTY_FORM = {
  product_name: '',
  uom: '',
  quantity_used: '',
  usage_date: new Date().toISOString().split('T')[0],
  wbs_id: '',
  building_id: '',
  estimate_line_id: '',
  notes: '',
};

const MaterialUsageTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [subTab, setSubTab] = useState('usage');

  // Usage records state
  const [usageRecords, setUsageRecords] = useState([]);
  const [wbsList, setWbsList] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Summary state
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadUsage = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [usageData, wbsData, buildingData] = await Promise.all([
        constructionService.listMaterialUsage(project.id),
        constructionService.listWBS(project.id),
        constructionService.listBuildings(project.id),
      ]);
      setUsageRecords(usageData || []);
      setWbsList(wbsData || []);
      setBuildings(buildingData || []);
    } catch (e) {
      console.error('Failed to load material usage:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  const loadSummary = useCallback(async () => {
    if (!project?.id) return;
    setSummaryLoading(true);
    try {
      const data = await constructionService.getMaterialSummary(project.id);
      setSummary(data || []);
    } catch (e) {
      console.error('Failed to load material summary:', e);
    } finally {
      setSummaryLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    if (subTab === 'usage') {
      loadUsage();
    } else {
      loadSummary();
    }
  }, [subTab, loadUsage, loadSummary]);

  const openCreate = () => {
    setEditingRecord(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm({
      product_name: record.product_name || '',
      uom: record.uom || '',
      quantity_used: record.quantity_used ? String(record.quantity_used) : '',
      usage_date: record.usage_date ? record.usage_date.slice(0, 10) : EMPTY_FORM.usage_date,
      wbs_id: record.wbs_id ? String(record.wbs_id) : '',
      building_id: record.building_id ? String(record.building_id) : '',
      estimate_line_id: record.estimate_line_id ? String(record.estimate_line_id) : '',
      notes: record.notes || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.product_name.trim()) { setError(t('validation_product_name_required') || 'Mahsulot nomini kiriting'); return; }
    if (!form.usage_date) { setError(t('validation_date_required') || 'Sanani kiriting'); return; }
    const qty = parseFloat(form.quantity_used);
    if (!qty || qty <= 0) { setError(t('validation_quantity_positive') || "Miqdor 0 dan katta bo'lishi kerak"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        product_name: form.product_name,
        uom: form.uom || '',
        quantity_used: qty,
        usage_date: form.usage_date,
        wbs_id: form.wbs_id ? Number(form.wbs_id) : 0,
        building_id: form.building_id ? Number(form.building_id) : 0,
        estimate_line_id: form.estimate_line_id ? Number(form.estimate_line_id) : 0,
        notes: form.notes || '',
      };
      if (editingRecord) {
        await constructionService.updateMaterialUsage(editingRecord.id, payload);
      } else {
        await constructionService.createMaterialUsage(project.id, payload);
      }
      setShowModal(false);
      loadUsage();
    } catch (e) {
      setError(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await constructionService.deleteMaterialUsage(deleteTarget.id);
      setDeleteTarget(null);
      loadUsage();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const STATUS_LABELS = {
    overuse: t('overuse') || 'Ortiqcha sarf',
    warning: t('warning') || 'Ogohlantirish',
    normal: t('normal') || 'Normal',
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === 'usage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setSubTab('usage')}
        >
          <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          {t('usage_records') || 'Sarf yozuvlari'}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === 'summary' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setSubTab('summary')}
        >
          <BarChart3 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          {t('material_summary') || 'Material xulosa'}
        </button>
      </div>

      {subTab === 'summary' ? (
        /* -- Material Summary sub-tab -- */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {t('smeta_vs_actual') || 'Smeta va haqiqiy taqqoslash'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="text-center py-8 text-slate-400">{t('loading') || 'Yuklanmoqda...'}</div>
            ) : summary.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('no_material_summary') || "Material xulosa ma'lumotlari yo'q"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2 px-3">{t('product_name') || 'Mahsulot nomi'}</th>
                      <th className="text-left py-2 px-3">{t('uom') || "O'lchov birligi"}</th>
                      <th className="text-right py-2 px-3">{t('smeta_qty') || 'Smeta miqdori'}</th>
                      <th className="text-right py-2 px-3">{t('actual_qty') || 'Haqiqiy miqdor'}</th>
                      <th className="text-right py-2 px-3">{t('difference') || 'Farq'}</th>
                      <th className="text-left py-2 px-3">{t('status') || 'Holat'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, idx) => (
                      <tr key={idx} className={`border-b hover:bg-slate-50 ${SUMMARY_ROW_COLORS[row.status] || ''}`}>
                        <td className="py-2 px-3">{row.product_name}</td>
                        <td className="py-2 px-3">{row.uom}</td>
                        <td className="py-2 px-3 text-right font-medium">{row.smeta_qty}</td>
                        <td className="py-2 px-3 text-right font-medium">{row.actual_qty}</td>
                        <td className="py-2 px-3 text-right font-medium">{row.difference}</td>
                        <td className="py-2 px-3">
                          <Badge className={SUMMARY_STATUS_COLORS[row.status] || SUMMARY_STATUS_COLORS.normal}>
                            {STATUS_LABELS[row.status] || row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Usage Records sub-tab */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t('material_usage') || 'Material sarfi'}
          </CardTitle>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t('add_usage') || "Sarf qo'shish"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">{t('loading') || 'Yuklanmoqda...'}</div>
          ) : usageRecords.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_material_usage') || "Material sarfi yozuvlari yo'q"}</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                {t('add_first_usage') || "Birinchi yozuvni qo'shing"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 px-3">{t('date') || 'Sana'}</th>
                    <th className="text-left py-2 px-3">{t('product_name') || 'Mahsulot nomi'}</th>
                    <th className="text-left py-2 px-3">{t('uom') || "O'lchov birligi"}</th>
                    <th className="text-right py-2 px-3">{t('quantity_used') || 'Sarflangan miqdor'}</th>
                    <th className="text-left py-2 px-3">{t('wbs') || 'WBS'}</th>
                    <th className="text-left py-2 px-3">{t('building') || 'Bino'}</th>
                    <th className="text-left py-2 px-3">{t('notes') || 'Izohlar'}</th>
                    <th className="text-right py-2 px-3">{t('actions') || 'Amallar'}</th>
                  </tr>
                </thead>
                <tbody>
                  {usageRecords.map(record => (
                    <tr key={record.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3 whitespace-nowrap">{record.usage_date ? record.usage_date.slice(0, 10) : '—'}</td>
                      <td className="py-2 px-3">{record.product_name}</td>
                      <td className="py-2 px-3">{record.uom || '—'}</td>
                      <td className="py-2 px-3 text-right font-medium">{record.quantity_used}</td>
                      <td className="py-2 px-3">{record.wbs_name || '—'}</td>
                      <td className="py-2 px-3">{record.building_name || '—'}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate" title={record.notes}>{record.notes || '—'}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title={t('edit') || 'Tahrirlash'} onClick={() => openEdit(record)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title={t('delete') || "O'chirish"} onClick={() => setDeleteTarget(record)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
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

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingRecord ? (t('edit_usage') || 'Sarfni tahrirlash') : (t('new_usage') || 'Yangi sarf')}</DialogTitle>
            <DialogDescription className="sr-only">{editingRecord ? (t('edit_usage') || 'Sarfni tahrirlash') : (t('new_usage') || 'Yangi sarf')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('product_name') || 'Mahsulot nomi'} *</Label>
                <Input value={form.product_name} onChange={e => setForm(f => ({...f, product_name: e.target.value}))} placeholder={t('product_name') || 'Mahsulot nomi'} />
              </div>
              <div>
                <Label>{t('uom') || "O'lchov birligi"}</Label>
                <Input value={form.uom} onChange={e => setForm(f => ({...f, uom: e.target.value}))} placeholder="dona, kg, m2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('quantity_used') || 'Sarflangan miqdor'} *</Label>
                <Input type="number" value={form.quantity_used} onChange={e => setForm(f => ({...f, quantity_used: e.target.value}))} placeholder="0" />
              </div>
              <div>
                <Label>{t('usage_date') || 'Sarf sanasi'} *</Label>
                <Input type="date" value={form.usage_date} onChange={e => setForm(f => ({...f, usage_date: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('wbs') || 'WBS'}</Label>
                <Select value={form.wbs_id || 'none'} onValueChange={v => setForm(f => ({...f, wbs_id: v === 'none' ? '' : v}))}>
                  <SelectTrigger><SelectValue placeholder={t('select_wbs') || 'WBS tanlang'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_wbs') || 'Tanlanmagan'}</SelectItem>
                    {wbsList.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('building') || 'Bino'}</Label>
                <Select value={form.building_id || 'none'} onValueChange={v => setForm(f => ({...f, building_id: v === 'none' ? '' : v}))}>
                  <SelectTrigger><SelectValue placeholder={t('select_building') || 'Bino tanlang'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_building') || 'Tanlanmagan'}</SelectItem>
                    {buildings.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('estimate_line_id') || 'Smeta qatori (ixtiyoriy)'}</Label>
              <Input type="number" value={form.estimate_line_id} onChange={e => setForm(f => ({...f, estimate_line_id: e.target.value}))} placeholder={t('estimate_line_id_placeholder') || 'Smeta qatori ID'} />
            </div>
            <div>
              <Label>{t('notes') || 'Izohlar'}</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder={t('notes_placeholder') || 'Izoh yozing...'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? (t('saving') || 'Saqlanmoqda...') : (t('save') || 'Saqlash')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_usage_title') || "Sarf yozuvini o'chirish"}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete_usage_desc') || "Bu sarf yozuvi o'chiriladi. Davom etasizmi?"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || "O'chirish"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </div>
  );
};

export default MaterialUsageTab;
