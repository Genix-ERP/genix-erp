import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { financeService } from '@/api/services/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Receipt, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  expense_date: new Date().toISOString().split('T')[0],
  description: '',
  stage_id: '',
  cost_category_id: '',
  amount: '',
  currency_code: 'UZS',
  vendor_id: '',
  credit_account_id: '',
  document_url: '',
  quantity: '',
  uom: '',
  unit_price: '',
  supplier_name: '',
};

const ExpensesTab = ({ project, scope }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const STATUS_LABELS = {
    draft: t('draft') || 'Draft',
    approved: t('approved') || 'Approved',
    cancelled: t('cancelled') || 'Cancelled',
  };

  const [subTab, setSubTab] = useState('expenses');

  const [data, setData] = useState({ items: [], total_approved: 0, total_draft: 0, total: 0 });
  const [stages, setStages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLine, setEditingLine] = useState(null);

  // Categories sub-tab state
  const [catLoading, setCatLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', default_debit_account_id: '' });
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [catSaving, setCatSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: '', stage_id: '', category_id: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const params = {};
      if (scope) params.scope = scope;
      if (filters.status) params.status = filters.status;
      if (filters.stage_id) params.stage_id = filters.stage_id;
      if (filters.category_id) params.category_id = filters.category_id;
      const [expData, stageData, catData] = await Promise.all([
        constructionService.listExpenseLines(project.id, params),
        constructionService.listStages(project.id),
        constructionService.listCostCategories(),
      ]);
      setData(expData || { items: [], total_approved: 0, total_draft: 0, total: 0 });
      setStages(stageData || []);
      setCategories(catData || []);
    } catch (e) {
      console.error('Failed to load expenses:', e);
    } finally {
      setLoading(false);
    }
  }, [project?.id, filters, scope]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setCurrentPage(1); }, [filters]);

  const openCreate = () => {
    setEditingLine(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (line) => {
    setEditingLine(line);
    setForm({
      expense_date: line.expense_date ? line.expense_date.slice(0, 10) : EMPTY_FORM.expense_date,
      description: line.description || '',
      stage_id: line.stage_id ? String(line.stage_id) : '',
      cost_category_id: line.cost_category_id ? String(line.cost_category_id) : '',
      amount: line.amount ? String(line.amount) : '',
      currency_code: line.currency_code || 'UZS',
      vendor_id: line.vendor_id || '',
      credit_account_id: line.credit_account_id || '',
      document_url: line.document_url || '',
      quantity: line.quantity ? String(line.quantity) : '',
      uom: line.uom || '',
      unit_price: line.unit_price ? String(line.unit_price) : '',
      supplier_name: line.supplier_name || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.description.trim()) { setError(t('validation_description_required')); return; }
    if (!form.expense_date) { setError(t('validation_date_required')); return; }
    if (!form.cost_category_id) { setError(t('validation_category_required') || 'Kategoriyani tanlang'); return; }
    const amount = parseFloat(parsePriceInput(form.amount));
    if (!amount || amount <= 0) { setError(t('validation_amount_positive')); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        expense_date: form.expense_date,
        description: form.description,
        currency_code: form.currency_code || 'UZS',
        document_url: form.document_url || '',
        uom: form.uom || '',
        vendor_id: form.vendor_id || '',
        credit_account_id: form.credit_account_id || '',
        amount,
        stage_id: form.stage_id ? Number(form.stage_id) : 0,
        cost_category_id: form.cost_category_id ? Number(form.cost_category_id) : 0,
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit_price: form.unit_price ? parseFloat(parsePriceInput(form.unit_price)) : 0,
        supplier_name: form.supplier_name || '',
      };
      if (editingLine) {
        await constructionService.updateExpenseLine(editingLine.id, payload);
      } else {
        await constructionService.createExpenseLine(project.id, payload);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || t('error_occurred'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (line) => {
    try {
      await constructionService.approveExpenseLine(line.id);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await constructionService.deleteExpenseLine(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred'));
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await constructionService.cancelExpenseLine(cancelTarget.id, cancelReason);
      setCancelTarget(null);
      setCancelReason('');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred'));
    }
  };

  // Category CRUD
  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const catData = await constructionService.listCostCategories();
      setCategories(catData || []);
    } catch (e) {
      console.error('Failed to load categories:', e);
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadExpenseAccounts = useCallback(async () => {
    try {
      const res = await financeService.listAccounts({ category: 'expense', limit: 500 });
      setExpenseAccounts(res?.items || res || []);
    } catch (e) {
      console.error('Failed to load expense accounts:', e);
    }
  }, []);

  const openCreateCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', default_debit_account_id: '' });
    loadExpenseAccounts();
    setShowCatModal(true);
  };

  const openEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name || '', default_debit_account_id: cat.default_debit_account_id || '' });
    loadExpenseAccounts();
    setShowCatModal(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return;
    setCatSaving(true);
    try {
      const payload = {
        name: catForm.name,
        default_debit_account_id: catForm.default_debit_account_id || '',
      };
      if (editingCat) {
        await constructionService.updateCostCategory(editingCat.id, payload);
      } else {
        await constructionService.createCostCategory(payload);
      }
      setShowCatModal(false);
      loadCategories();
    } catch (e) {
      console.error('Failed to save category:', e);
    } finally {
      setCatSaving(false);
    }
  };

  const handleToggleCat = async (cat) => {
    try {
      await constructionService.updateCostCategory(cat.id, { is_active: !cat.is_active });
      loadCategories();
    } catch (e) {
      console.error('Failed to toggle category:', e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === 'expenses' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setSubTab('expenses')}
        >
          <Receipt className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          {t('expenses') || 'Xarajatlar'}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === 'categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setSubTab('categories')}
        >
          <Tag className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          {t('categories') || 'Kategoriyalar'}
        </button>
      </div>

      {subTab === 'categories' ? (
        /* ── Categories sub-tab ── */
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {t('expense_categories') || 'Xarajat kategoriyalari'}
            </CardTitle>
            <Button onClick={openCreateCat}>
              <Plus className="w-4 h-4 mr-2" />
              {t('add_category') || "Kategoriya qo'shish"}
            </Button>
          </CardHeader>
          <CardContent>
            {catLoading ? (
              <div className="text-center py-8 text-slate-400">{t('loading') || 'Yuklanmoqda...'}</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{t('no_categories') || "Kategoriyalar yo'q"}</p>
                <Button variant="outline" className="mt-3" onClick={openCreateCat}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add_category') || "Kategoriya qo'shish"}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2 px-3">{t('code') || 'Kod'}</th>
                      <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                      <th className="text-left py-2 px-3">{t('expense_account') || 'Xarajat hisobi'}</th>
                      <th className="text-right py-2 px-3">{t('actions') || 'Amallar'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <tr key={cat.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-sm">{cat.code}</td>
                        <td className="py-2 px-3">{cat.name}</td>
                        <td className="py-2 px-3 text-slate-600">{cat.debit_account_name || '—'}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditCat(cat)}>
                              <Edit className="w-4 h-4" />
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
      ) : (
      <>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('approved_expenses')}</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data.total_approved || 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('draft_expenses')}</p>
          <p className="text-2xl font-bold text-slate-600">{formatCurrency(data.total_draft || 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-slate-500">{t('total_approved_draft')}</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.total || 0)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            {t('expense_operations')}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({...f, status: v === 'all' ? '' : v}))}>
              <SelectTrigger className="w-36"><SelectValue placeholder={t('all_statuses')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses')}</SelectItem>
                <SelectItem value="draft">{t('draft')}</SelectItem>
                <SelectItem value="approved">{t('approved')}</SelectItem>
                <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.stage_id || 'all'} onValueChange={v => setFilters(f => ({...f, stage_id: v === 'all' ? '' : v}))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_stages')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_stages')}</SelectItem>
                {stages.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.category_id || 'all'} onValueChange={v => setFilters(f => ({...f, category_id: v === 'all' ? '' : v}))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('all_categories')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_categories')}</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {t('add_expense')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">{t('loading')}</div>
          ) : (data.items || []).length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_expenses')}</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                {t('add_first_expense')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 px-3">{t('date')}</th>
                    <th className="text-left py-2 px-3">{t('description')}</th>
                    <th className="text-left py-2 px-3">{t('supplier') || 'Taminotchi'}</th>
                    <th className="text-left py-2 px-3">{t('stage')}</th>
                    <th className="text-left py-2 px-3">{t('category')}</th>
                    <th className="text-right py-2 px-3">{t('amount')}</th>
                    <th className="text-left py-2 px-3">{t('status')}</th>
                    <th className="text-right py-2 px-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalCount = (data.items || []).length;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    const paginatedItems = (data.items || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
                    return paginatedItems.map(line => (
                    <tr key={line.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3 whitespace-nowrap">{line.expense_date}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate" title={line.description}>{line.description}</td>
                      <td className="py-2 px-3">{line.supplier_name || '—'}</td>
                      <td className="py-2 px-3">{line.stage_name || '—'}</td>
                      <td className="py-2 px-3">{line.cost_category_name || '—'}</td>
                      <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{formatCurrency(line.amount)}</td>
                      <td className="py-2 px-3">
                        <Badge className={STATUS_COLORS[line.status]}>{STATUS_LABELS[line.status] || line.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          {line.status === 'draft' && (
                            <>
                              <Button variant="ghost" size="sm" title={t('approve')} onClick={() => handleApprove(line)}>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="sm" title={t('edit')} onClick={() => openEdit(line)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title={t('delete')} onClick={() => setDeleteTarget(line)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {line.status === 'approved' && (
                            <Button variant="ghost" size="sm" title={t('cancel_expense')} onClick={() => { setCancelTarget(line); setCancelReason(''); }}>
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                  })()}
                </tbody>
              </table>
              {(() => {
                const totalCount = (data.items || []).length;
                const totalPages = Math.ceil(totalCount / pageSize);
                return totalPages > 1 ? (
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
                ) : null;
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingLine ? t('edit_expense') : t('new_expense')}</DialogTitle>
            <DialogDescription className="sr-only">{editingLine ? t('edit_expense') : t('new_expense')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('expense_date')}</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({...f, expense_date: e.target.value}))} />
              </div>
              <div>
                <Label>{t('currency')}</Label>
                <Select value={form.currency_code} onValueChange={v => setForm(f => ({...f, currency_code: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('expense_description')}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} placeholder={t('expense_description')} />
            </div>
            <div>
              <Label>{t('supplier') || 'Taminotchi'}</Label>
              <Input value={form.supplier_name} onChange={e => setForm(f => ({...f, supplier_name: e.target.value}))} placeholder={t('supplier_name_placeholder') || 'Taminotchi nomini kiriting'} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('expense_stage')}</Label>
                <Select value={form.stage_id || 'none'} onValueChange={v => setForm(f => ({...f, stage_id: v === 'none' ? '' : v}))}>
                  <SelectTrigger><SelectValue placeholder={t('expense_stage')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_stage')}</SelectItem>
                    {stages.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('expense_category')} *</Label>
                <Select value={form.cost_category_id || ''} onValueChange={v => setForm(f => ({...f, cost_category_id: v}))}>
                  <SelectTrigger><SelectValue placeholder={t('expense_category')} /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('expense_amount')}</Label>
              <Input value={form.amount} onChange={e => setForm(f => ({...f, amount: formatPriceInput(e.target.value)}))} placeholder="0" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('quantity')}</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} placeholder="0" />
              </div>
              <div>
                <Label>{t('uom')}</Label>
                <Input value={form.uom} onChange={e => setForm(f => ({...f, uom: e.target.value}))} placeholder="dona, kg, m²" />
              </div>
              <div>
                <Label>{t('unit_price')}</Label>
                <Input value={form.unit_price} onChange={e => setForm(f => ({...f, unit_price: formatPriceInput(e.target.value)}))} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>{t('document_url')}</Label>
              <Input value={form.document_url} onChange={e => setForm(f => ({...f, document_url: e.target.value}))} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_expense_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete_expense_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={() => { setCancelTarget(null); setCancelReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancel_expense_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cancel_expense_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label>{t('cancel_reason')}</Label>
            <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder={t('cancel_reason_placeholder')} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('go_back')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">{t('cancel_expense')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}

      {/* Category Create/Edit Modal */}
      <Dialog open={showCatModal} onOpenChange={setShowCatModal}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingCat ? (t('edit_category') || 'Kategoriyani tahrirlash') : (t('add_category') || "Kategoriya qo'shish")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('name') || 'Nomi'} *</Label>
              <Input
                value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('category_name') || 'Kategoriya nomi'}
              />
            </div>
            <div>
              <Label>{t('expense_account') || 'Xarajat hisobi'}</Label>
              <Select
                value={catForm.default_debit_account_id || 'none'}
                onValueChange={v => setCatForm(f => ({ ...f, default_debit_account_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder={t('select_account') || 'Hisob tanlang'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanlanmagan</SelectItem>
                  {expenseAccounts.map(acc => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.code} — {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleSaveCat} disabled={catSaving || !catForm.name.trim()}>
              {catSaving ? (t('saving') || 'Saqlanmoqda...') : (t('save') || 'Saqlash')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesTab;
