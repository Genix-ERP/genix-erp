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
import { Plus, Edit, Trash2, Users, Star, Play, CheckCircle, XCircle, Paperclip, Upload, FileText, Loader2 } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const STATE_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  terminated: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  contract_number: '',
  partner_name: '',
  work_description: '',
  amount: '',
  currency: 'UZS',
  start_date: '',
  end_date: '',
  retention_pct: '',
  contact_person: '',
  contact_phone: '',
  wbs_ids: [],
  building_ids: [],
  notes: '',
  // Forma 2/3 identity block
  address: '',
  phone: '',
  bank_name: '',
  bank_account: '',
  mfo: '',
  stir: '',
  okonh: '',
  director_name: '',
  chief_accountant_name: '',
};

// Per-subcontractor file attachments: upload + list + view + delete.
function SubcontractFiles({ subId, language }) {
  const tr = (m) => m[language] || m.uz;
  const [files, setFiles] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef(null);

  const load = React.useCallback(async () => {
    try {
      const data = await constructionService.listSubcontractFiles(subId);
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) { /* ignore */ }
  }, [subId]);

  React.useEffect(() => { load(); }, [load]);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const up = await constructionService.uploadRawFile(file);
      await constructionService.createSubcontractFile(subId, {
        file_id: up.id,
        file_url: up.url,
        filename: up.filename || file.name,
        file_size: up.size || file.size,
        mime_type: up.mime_type || file.type,
      });
      toast.success(tr({ uz: 'Fayl yuklandi', ru: 'Файл загружен', en: 'File uploaded' }));
      await load();
    } catch (err) {
      console.error('Subcontract file upload failed', err);
      toast.error(tr({ uz: 'Faylni yuklab bo\'lmadi', ru: 'Не удалось загрузить файл', en: 'Upload failed' }));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (fileId) => {
    try {
      await constructionService.deleteSubcontractFile(subId, fileId);
      await load();
    } catch (err) {
      toast.error(tr({ uz: 'O\'chirib bo\'lmadi', ru: 'Не удалось удалить', en: 'Delete failed' }));
    }
  };

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
          <Paperclip className="w-3 h-3" />
          {tr({ uz: 'Hujjatlar', ru: 'Документы', en: 'Documents' })}
          {files.length > 0 && <span className="text-slate-400">({files.length})</span>}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {tr({ uz: 'Yuklash', ru: 'Загрузить', en: 'Upload' })}
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-slate-400">{tr({ uz: 'Fayl yo\'q', ru: 'Нет файлов', en: 'No files' })}</p>
      ) : (
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-xs">
              <a
                href={f.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-600 hover:text-teal-700 truncate flex-1"
                title={f.filename}
              >
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate">{f.filename}</span>
              </a>
              <button
                type="button"
                onClick={() => onDelete(f.id)}
                className="text-slate-400 hover:text-red-500 shrink-0"
                title={tr({ uz: 'O\'chirish', ru: 'Удалить', en: 'Delete' })}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SubcontractorsTab = ({ project, buildings = [], wbsItems = [] }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const STATE_LABELS = {
    draft: t('draft') || 'Qoralama',
    active: t('active') || 'Faol',
    completed: t('completed') || 'Yakunlangan',
    terminated: t('terminated') || 'Bekor qilingan',
  };

  const [subcontracts, setSubcontracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wbsList, setWbsList] = useState([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await constructionService.listSubcontracts(project.id);
      setSubcontracts(data || []);
    } catch (e) {
      console.error('Failed to load subcontracts:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  const loadOptions = useCallback(async () => {
    if (!project?.id) return;
    try {
      const wbs = await constructionService.listWBS(project.id);
      setWbsList(wbs || []);
    } catch (e) {
      console.error('Failed to load options:', e);
    }
  }, [project?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadOptions(); }, [loadOptions]);

  // ── Modal helpers ─────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      contract_number: item.contract_number || '',
      partner_name: item.partner_name || '',
      work_description: item.work_description || '',
      amount: item.amount ? String(item.amount) : '',
      currency: item.currency || 'UZS',
      start_date: item.start_date ? item.start_date.slice(0, 10) : '',
      end_date: item.end_date ? item.end_date.slice(0, 10) : '',
      retention_pct: item.retention_pct != null ? String(item.retention_pct) : '',
      contact_person: item.contact_person || '',
      contact_phone: item.contact_phone || '',
      wbs_ids: item.wbs_ids || [],
      building_ids: item.building_ids || [],
      notes: item.notes || '',
      address: item.address || '',
      phone: item.phone || '',
      bank_name: item.bank_name || '',
      bank_account: item.bank_account || '',
      mfo: item.mfo || '',
      stir: item.stir || '',
      okonh: item.okonh || '',
      director_name: item.director_name || '',
      chief_accountant_name: item.chief_accountant_name || '',
    });
    setError(null);
    setShowModal(true);
  };

  const toggleWbs = (wbsId) => {
    setForm(f => {
      const ids = f.wbs_ids || [];
      if (ids.includes(wbsId)) {
        return { ...f, wbs_ids: ids.filter(id => id !== wbsId) };
      }
      return { ...f, wbs_ids: [...ids, wbsId] };
    });
  };

  const toggleBuilding = (bldId) => {
    setForm(f => {
      const ids = f.building_ids || [];
      if (ids.includes(bldId)) {
        return { ...f, building_ids: ids.filter(id => id !== bldId) };
      }
      return { ...f, building_ids: [...ids, bldId] };
    });
  };

  const handleSave = async () => {
    if (!form.partner_name?.trim()) { setError(t('partner_required') || 'Hamkor nomini kiriting'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        contract_number: form.contract_number || '',
        partner_name: form.partner_name.trim(),
        work_description: form.work_description || '',
        amount: form.amount ? parseFloat(parsePriceInput(form.amount)) : 0,
        currency: form.currency || 'UZS',
        start_date: form.start_date || '',
        end_date: form.end_date || '',
        retention_pct: form.retention_pct ? parseFloat(form.retention_pct) : 0,
        contact_person: form.contact_person || '',
        contact_phone: form.contact_phone || '',
        wbs_ids: form.wbs_ids || [],
        building_ids: form.building_ids || [],
        notes: form.notes || '',
        address: form.address || '',
        phone: form.phone || '',
        bank_name: form.bank_name || '',
        bank_account: form.bank_account || '',
        mfo: form.mfo || '',
        stir: form.stir || '',
        okonh: form.okonh || '',
        director_name: form.director_name || '',
        chief_accountant_name: form.chief_accountant_name || '',
      };

      if (editing) {
        await constructionService.updateSubcontract(editing.id, payload);
        toast.success(t('subcontract_updated') || 'Pudrat yangilandi');
      } else {
        await constructionService.createSubcontract(project.id, payload);
        toast.success(t('subcontract_created') || 'Pudrat yaratildi');
      }

      setShowModal(false);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await constructionService.deleteSubcontract(deleteTarget.id);
      setDeleteTarget(null);
      toast.success(t('subcontract_deleted') || "Pudrat o'chirildi");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const handleStateChange = async (item, newState) => {
    try {
      await constructionService.updateSubcontractState(item.id, { state: newState });
      toast.success(t('state_updated') || 'Holat yangilandi');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const r = rating || 0;
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${i <= r ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300'}`}
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  const totalAmount = subcontracts.reduce((s, c) => s + (c.amount || 0), 0);
  const activeCount = subcontracts.filter(c => c.state === 'active').length;

  return (
    <div className="space-y-4">
      {/* Subcontracts list (Smetalar / Xarajatlar sub-tabs removed — those
          views are reachable from Smeta boshqaruvi and Moliya). */}
      <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('total_subcontracts') || 'Jami pudratchilar'}</p>
              <p className="text-2xl font-bold">{subcontracts.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('active_subcontracts') || 'Faol pudratlar'}</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-sm text-slate-500">{t('total_contract_amount') || 'Jami shartnoma summasi'}</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('subcontractors') || 'Pudratchilar'}
              </CardTitle>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                {t('add_subcontract') || 'Pudrat qo\'shish'}
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-400">{t('loading')}</div>
              ) : subcontracts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_subcontracts') || 'Pudratchilar topilmadi'}</p>
                  <Button variant="outline" className="mt-4" onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_first_subcontract') || 'Birinchi pudratni qo\'shing'}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subcontracts.map((item) => (
                    <Card key={item.id} className="border">
                      <CardContent className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{item.contract_number || item.name}</p>
                            <p className="text-xs text-slate-500">{item.partner_name}</p>
                          </div>
                          <Badge className={STATE_COLORS[item.state] || 'bg-slate-100 text-slate-700'}>
                            {STATE_LABELS[item.state] || item.state}
                          </Badge>
                        </div>

                        {/* Work description */}
                        {item.work_description && (
                          <p className="text-sm text-slate-600 line-clamp-2">{item.work_description}</p>
                        )}

                        {/* Amount */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">{t('contract_amount') || 'Shartnoma summasi'}</span>
                          <span className="font-semibold text-sm">{formatCurrency(item.amount || 0)}</span>
                        </div>

                        {/* Rating */}
                        {item.rating > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">{t('rating') || 'Reyting'}</span>
                            {renderStars(item.rating)}
                          </div>
                        )}

                        {/* Documents */}
                        <SubcontractFiles subId={item.id} language={language} />

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex gap-1">
                            {item.state === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => handleStateChange(item, 'active')}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                {t('activate') || 'Faollashtirish'}
                              </Button>
                            )}
                            {item.state === 'active' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700"
                                  onClick={() => handleStateChange(item, 'completed')}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {t('complete') || 'Yakunlash'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleStateChange(item, 'terminated')}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  {t('terminate') || 'Bekor qilish'}
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {item.state === 'draft' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing ? (t('edit_subcontract') || 'Pudratni tahrirlash') : (t('new_subcontract') || 'Yangi pudrat')}</DialogTitle>
            <DialogDescription className="sr-only">{editing ? (t('edit_subcontract') || 'Pudratni tahrirlash') : (t('new_subcontract') || 'Yangi pudrat')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

            <div>
              <Label>{language === 'ru' ? 'Номер договора' : language === 'uz' ? 'Shartnoma raqami' : 'Contract number'}</Label>
              <Input
                value={form.contract_number || ''}
                onChange={e => setForm(f => ({ ...f, contract_number: e.target.value }))}
                placeholder="№ 12/2025"
              />
            </div>

            <div>
              <Label>{t('partner') || 'Hamkor'}</Label>
              <Input
                value={form.partner_name}
                onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))}
                placeholder={t('partner_name_placeholder') || 'Hamkor nomini kiriting'}
              />
            </div>

            <div>
              <Label>{t('work_description') || 'Ish tavsifi'}</Label>
              <Textarea
                value={form.work_description}
                onChange={e => setForm(f => ({ ...f, work_description: e.target.value }))}
                placeholder={t('work_description_placeholder') || 'Ish tavsifini kiriting'}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('amount') || 'Summa'}</Label>
                <Input
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: formatPriceInput(e.target.value) }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>{t('currency') || 'Valyuta'}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('start_date') || 'Boshlanish sanasi'}</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t('end_date') || 'Tugash sanasi'}</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>{t('retention_pct') || 'Ushlab qolish foizi (%)'}</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.retention_pct}
                onChange={e => setForm(f => ({ ...f, retention_pct: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('contact_person') || 'Aloqa shaxsi'}</Label>
                <Input
                  value={form.contact_person}
                  onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                  placeholder={t('contact_person_placeholder') || 'Ism familiya'}
                />
              </div>
              <div>
                <Label>{t('contact_phone') || 'Telefon raqami'}</Label>
                <Input
                  value={form.contact_phone}
                  onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                  placeholder="+998 ..."
                />
              </div>
            </div>

            {/* Forma 2 / 3 banking & legal identity block */}
            <div className="border rounded-md p-3 bg-slate-50 space-y-3">
              <div className="text-sm font-semibold text-slate-700">
                {language === 'ru' ? 'Реквизиты для Формы 2 / Формы 3' : 'Forma 2 / Forma 3 uchun rekvizitlar'}
              </div>
              <div>
                <Label>{language === 'ru' ? 'Юридический адрес' : language === 'uz' ? 'Yuridik manzil' : 'Legal Address'}</Label>
                <Input
                  value={form.address || ''}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder={language === 'ru' ? 'г. Ташкент, ...' : language === 'uz' ? 'Toshkent sh., ...' : 'Tashkent, ...'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{language === 'ru' ? 'Телефон организации' : language === 'uz' ? 'Tashkilot telefoni' : 'Organization Phone'}</Label>
                  <Input
                    value={form.phone || ''}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+998 XX XXX XXXX"
                  />
                </div>
                <div>
                  <Label>{language === 'ru' ? 'МФО' : 'MFO'}</Label>
                  <Input
                    value={form.mfo || ''}
                    onChange={e => setForm(f => ({ ...f, mfo: e.target.value }))}
                    placeholder="00440"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{language === 'ru' ? 'Название банка' : language === 'uz' ? 'Bank nomi' : 'Bank Name'}</Label>
                  <Input
                    value={form.bank_name || ''}
                    onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                    placeholder={language === 'ru' ? 'АКБ "..."' : language === 'uz' ? 'AKB "..."' : 'Bank "..."'}
                  />
                </div>
                <div>
                  <Label>{language === 'ru' ? 'Расчётный счёт' : language === 'uz' ? 'Hisob raqam' : 'Settlement Account'}</Label>
                  <Input
                    value={form.bank_account || ''}
                    onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))}
                    placeholder="2020 8000 ..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{language === 'ru' ? 'СТИР (ИНН)' : language === 'uz' ? 'STIR (INN)' : 'TIN (STIR)'}</Label>
                  <Input
                    value={form.stir || ''}
                    onChange={e => setForm(f => ({ ...f, stir: e.target.value }))}
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <Label>{language === 'ru' ? 'ОКОНХ' : 'OKONH'}</Label>
                  <Input
                    value={form.okonh || ''}
                    onChange={e => setForm(f => ({ ...f, okonh: e.target.value }))}
                    placeholder="61124"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{language === 'ru' ? 'Руководитель' : language === 'uz' ? 'Rahbar (direktor)' : 'Director'}</Label>
                  <Input
                    value={form.director_name || ''}
                    onChange={e => setForm(f => ({ ...f, director_name: e.target.value }))}
                    placeholder={language === 'ru' ? 'Ф.И.О' : language === 'uz' ? 'F.I.Sh' : 'Full name'}
                  />
                </div>
                <div>
                  <Label>{language === 'ru' ? 'Главный бухгалтер' : language === 'uz' ? 'Bosh buxgalter' : 'Chief Accountant'}</Label>
                  <Input
                    value={form.chief_accountant_name || ''}
                    onChange={e => setForm(f => ({ ...f, chief_accountant_name: e.target.value }))}
                    placeholder={language === 'ru' ? 'Ф.И.О' : language === 'uz' ? 'F.I.Sh' : 'Full name'}
                  />
                </div>
              </div>
            </div>

            {/* WBS multi-select checkboxes */}
            {wbsList.length > 0 && (
              <div>
                <Label>{t('wbs_items') || 'WBS elementlari'}</Label>
                <div className="border rounded-md p-2 bg-slate-50 max-h-40 overflow-y-auto space-y-1">
                  {wbsList.map(wbs => (
                    <label key={wbs.id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={(form.wbs_ids || []).includes(wbs.id)}
                        onChange={() => toggleWbs(wbs.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm">{wbs.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>{t('notes') || 'Izohlar'}</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
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
            <AlertDialogTitle>{t('delete_subcontract_title') || 'Pudratni o\'chirish'}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" {t('delete_subcontract_desc') || 'pudratini o\'chirmoqchimisiz? Bu amalni qaytarib bo\'lmaydi.'}
            </AlertDialogDescription>
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

export default SubcontractorsTab;
