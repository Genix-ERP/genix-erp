import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, FileCheck, AlertTriangle, CheckCircle2, FileText,
  Download, Users, Calendar, Eye, Trash2, RefreshCw, FileSpreadsheet
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";

export default function ActSverka() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    reconciliationActs,
    createReconciliationAct,
    updateReconciliationAct,
    deleteReconciliationAct,
    bulkGenerateReconciliation,
    exportReconciliationAct,
    isLoading
  } = useFinancials();
  const { canCreate, canDelete } = usePermissions();

  const [filteredActs, setFilteredActs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedAct, setSelectedAct] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actToDelete, setActToDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    partner_id: '',
    partner_name: '',
    period_start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [bulkFormData, setBulkFormData] = useState({
    period_start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0]
  });

  // Stats
  const stats = useMemo(() => {
    const total = reconciliationActs.length;
    const confirmed = reconciliationActs.filter(a => a.status === 'confirmed').length;
    const withDifference = reconciliationActs.filter(a => Math.abs(a.difference || 0) > 0).length;
    const draft = reconciliationActs.filter(a => a.status === 'draft').length;
    return { total, confirmed, withDifference, draft };
  }, [reconciliationActs]);

  // Filter
  useEffect(() => {
    let result = [...reconciliationActs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        (a.partner_name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }
    setFilteredActs(result);
  }, [reconciliationActs, searchQuery, statusFilter]);

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      disputed: 'bg-red-100 text-red-800'
    };
    const labels = {
      draft: t('draft') || 'Qoralama',
      sent: t('sent') || 'Yuborilgan',
      confirmed: t('confirmed') || 'Tasdiqlangan',
      disputed: t('disputed') || 'Munozarali'
    };
    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('uz-UZ').format(amount || 0);
  };

  const handleCreate = async () => {
    if (!formData.partner_name || !formData.period_start || !formData.period_end) return;
    setIsSaving(true);
    try {
      await createReconciliationAct(formData);
      setShowCreateModal(false);
      setFormData({
        partner_id: '', partner_name: '',
        period_start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (err) {
      console.error('Failed to create act:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkGenerate = async () => {
    setIsSaving(true);
    try {
      await bulkGenerateReconciliation(bulkFormData);
      setShowBulkModal(false);
    } catch (err) {
      console.error('Failed to bulk generate:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = (id, fmt) => {
    const act = reconciliationActs.find(a => a.id === id);
    if (!act) return;

    const html = `
      <html>
      <head>
        <title>Akt sverka - ${act.partner_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { text-align: center; font-size: 20px; margin-bottom: 4px; }
          h2 { text-align: center; font-size: 14px; font-weight: normal; color: #666; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #999; padding: 8px 12px; font-size: 13px; }
          th { background: #f0f0f0; text-align: center; }
          td.right { text-align: right; }
          td.bold { font-weight: bold; }
          .info { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; }
          .info div { margin-right: 24px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 48px; }
          .signatures div { width: 45%; border-top: 1px solid #333; padding-top: 8px; font-size: 13px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>AKT SVERKA</h1>
        <h2>Solishtirma dalolatnoma</h2>
        <div class="info">
          <div><strong>Kontragent:</strong> ${act.partner_name}</div>
          <div><strong>Davr:</strong> ${act.period_start} — ${act.period_end}</div>
          <div><strong>Holat:</strong> ${act.status}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2"></th>
              <th colspan="2">Bizning ma'lumot</th>
              <th colspan="2">Kontragent ma'lumoti</th>
            </tr>
            <tr>
              <th>Debet</th>
              <th>Kredit</th>
              <th>Debet</th>
              <th>Kredit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="bold">Davr boshi qoldiq</td>
              <td class="right">${formatAmount(act.opening_balance)}</td>
              <td></td>
              <td></td>
              <td class="right">${formatAmount(act.opening_balance)}</td>
            </tr>
            <tr>
              <td class="bold">Davr operatsiyalari</td>
              <td class="right">${formatAmount(act.our_debit_total)}</td>
              <td class="right">${formatAmount(act.our_credit_total)}</td>
              <td class="right">${formatAmount(act.partner_debit_total)}</td>
              <td class="right">${formatAmount(act.partner_credit_total)}</td>
            </tr>
            <tr>
              <td class="bold">Davr oxiri qoldiq</td>
              <td class="right bold" colspan="2">${formatAmount(act.our_balance)}</td>
              <td class="right bold" colspan="2">${formatAmount(act.partner_balance)}</td>
            </tr>
            ${Math.abs(act.difference || 0) > 0 ? `
            <tr>
              <td class="bold" style="color:red">Farq</td>
              <td class="right bold" colspan="4" style="color:red">${formatAmount(act.difference)} so'm</td>
            </tr>` : ''}
          </tbody>
        </table>
        ${act.notes ? `<p style="margin-top:16px;font-size:13px"><strong>Izoh:</strong> ${act.notes}</p>` : ''}
        <div class="signatures">
          <div>Tashkilot vakili: _______________</div>
          <div>Kontragent vakili: _______________</div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleDeleteClick = (act) => {
    setActToDelete(act);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!actToDelete) return;
    try {
      await deleteReconciliationAct(actToDelete.id);
      if (selectedAct?.id === actToDelete.id) setShowDetailModal(false);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setShowDeleteConfirm(false);
      setActToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_acts') || 'Jami aktlar'}</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <FileCheck className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('confirmed') || 'Tasdiqlangan'}</p>
                <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('with_difference') || 'Farq bor'}</p>
                <p className="text-2xl font-bold text-red-600">{stats.withDifference}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('draft') || 'Qoralama'}</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.draft}</p>
              </div>
              <FileText className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search_counterparty') || "Kontragent qidirish..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-50 border-slate-200"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t('status') || "Holat"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all') || 'Barchasi'}</SelectItem>
                  <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                  <SelectItem value="sent">{t('sent') || 'Yuborilgan'}</SelectItem>
                  <SelectItem value="confirmed">{t('confirmed') || 'Tasdiqlangan'}</SelectItem>
                  <SelectItem value="disputed">{t('disputed') || 'Munozarali'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {canCreate(MODULES.FINANCIALS) && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowBulkModal(true)}
                    className="border-slate-300"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    {t('bulk_generate') || 'Ommaviy generatsiya'}
                  </Button>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('new_act') || 'Yangi akt'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acts Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="p-0">
          {filteredActs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileCheck className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600">
                {t('no_reconciliation_acts') || "Akt sverka mavjud emas"}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {t('create_first_act') || "Birinchi aktni yarating"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('counterparty') || 'Kontragent'}</TableHead>
                  <TableHead>{t('period') || 'Davr'}</TableHead>
                  <TableHead className="text-right">{t('our_balance') || 'Bizning qoldiq'}</TableHead>
                  <TableHead className="text-right">{t('partner_balance') || 'Kontragent qoldiq'}</TableHead>
                  <TableHead className="text-right">{t('difference') || 'Farq'}</TableHead>
                  <TableHead className="text-center">{t('status') || 'Holat'}</TableHead>
                  <TableHead className="text-center">{t('actions') || 'Amallar'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActs.map((act) => (
                  <TableRow key={act.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => { setSelectedAct(act); setShowDetailModal(true); }}>
                    <TableCell className="font-medium">{act.partner_name}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {act.period_start} — {act.period_end}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(act.our_balance)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(act.partner_balance)}</TableCell>
                    <TableCell className={`text-right font-mono font-bold ${Math.abs(act.difference || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatAmount(act.difference)}
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(act.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedAct(act); setShowDetailModal(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleExport(act.id, 'pdf')}>
                          <Download className="w-4 h-4" />
                        </Button>
                        {canDelete(MODULES.FINANCIALS) && act.status === 'draft' && (
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteClick(act)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Act Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {t('new_reconciliation_act') || "Yangi akt sverka"}
            </DialogTitle>
            <DialogDescription>
              {t('create_act_desc') || "Kontragent bilan solishtirma dalolatnoma yarating"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('counterparty') || 'Kontragent'} *
              </label>
              <Input
                placeholder={t('enter_counterparty') || "Kontragent nomini kiriting"}
                value={formData.partner_name}
                onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                className="bg-slate-50 border-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('period_start') || 'Davr boshi'} *
                </label>
                <Input
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('period_end') || 'Davr oxiri'} *
                </label>
                <Input
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('notes') || 'Izoh'}
              </label>
              <Input
                placeholder={t('optional_notes') || "Qo'shimcha izoh (ixtiyoriy)"}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-slate-50 border-slate-200"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSaving || !formData.partner_name}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {t('create') || 'Yaratish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {t('bulk_generate_acts') || "Ommaviy akt generatsiya"}
            </DialogTitle>
            <DialogDescription>
              {t('bulk_generate_desc') || "Barcha kontragentlar uchun avtomatik akt yaratiladi"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('period_start') || 'Davr boshi'} *
                </label>
                <Input
                  type="date"
                  value={bulkFormData.period_start}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, period_start: e.target.value })}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('period_end') || 'Davr oxiri'} *
                </label>
                <Input
                  type="date"
                  value={bulkFormData.period_end}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, period_end: e.target.value })}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowBulkModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                onClick={handleBulkGenerate}
                disabled={isSaving}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
                {t('generate') || 'Generatsiya qilish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-blue-600" />
              {t('reconciliation_act') || "Akt sverka"} — {selectedAct?.partner_name}
            </DialogTitle>
          </DialogHeader>
          {selectedAct && (
            <div className="space-y-6 py-4">
              {/* Act Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">{t('counterparty') || 'Kontragent'}</p>
                  <p className="text-sm font-semibold">{selectedAct.partner_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('period') || 'Davr'}</p>
                  <p className="text-sm font-semibold">{selectedAct.period_start} — {selectedAct.period_end}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('status') || 'Holat'}</p>
                  {getStatusBadge(selectedAct.status)}
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('opening_balance') || 'Davr boshi qoldiq'}</p>
                  <p className="text-sm font-semibold">{formatAmount(selectedAct.opening_balance)}</p>
                </div>
              </div>

              {/* Summary Table */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead></TableHead>
                    <TableHead className="text-center text-blue-700" colSpan={2}>{t('our_data') || 'Bizning ma\'lumot'}</TableHead>
                    <TableHead className="text-center text-purple-700" colSpan={2}>{t('counterparty_data') || 'Kontragent ma\'lumoti'}</TableHead>
                  </TableRow>
                  <TableRow className="bg-slate-50">
                    <TableHead></TableHead>
                    <TableHead className="text-right text-blue-600">{t('debit') || 'Debet'}</TableHead>
                    <TableHead className="text-right text-blue-600">{t('credit') || 'Kredit'}</TableHead>
                    <TableHead className="text-right text-purple-600">{t('debit') || 'Debet'}</TableHead>
                    <TableHead className="text-right text-purple-600">{t('credit') || 'Kredit'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{t('opening_balance') || 'Davr boshi qoldiq'}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(selectedAct.opening_balance)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(selectedAct.opening_balance)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">{t('period_operations') || 'Davr operatsiyalari'}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(selectedAct.our_debit_total)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(selectedAct.our_credit_total)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(selectedAct.partner_debit_total)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(selectedAct.partner_credit_total)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold bg-slate-50">
                    <TableCell>{t('closing_balance') || 'Davr oxiri qoldiq'}</TableCell>
                    <TableCell className="text-right font-mono" colSpan={2}>{formatAmount(selectedAct.our_balance)}</TableCell>
                    <TableCell className="text-right font-mono" colSpan={2}>{formatAmount(selectedAct.partner_balance)}</TableCell>
                  </TableRow>
                  {Math.abs(selectedAct.difference || 0) > 0 && (
                    <TableRow className="bg-red-50">
                      <TableCell className="font-bold text-red-700">{t('difference') || 'Farq'}</TableCell>
                      <TableCell className="text-right font-mono text-red-700 font-bold" colSpan={4}>
                        {formatAmount(selectedAct.difference)} {t('uzs') || "so'm"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Export buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport(selectedAct.id, 'pdf')}>
                    <Download className="w-4 h-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport(selectedAct.id, 'word')}>
                    <FileText className="w-4 h-4 mr-1" /> Word
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport(selectedAct.id, 'excel')}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  {t('close') || 'Yopish'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('confirm_delete') || "O'chirishni tasdiqlash"}
            </DialogTitle>
            <DialogDescription>
              {t('delete_act_confirmation') || "Haqiqatan ham bu akt sverkani o'chirmoqchimisiz?"}
            </DialogDescription>
          </DialogHeader>
          {actToDelete && (
            <div className="py-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium">{actToDelete.partner_name}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {actToDelete.period_start} — {actToDelete.period_end}
                </p>
              </div>
              <p className="mt-3 text-sm text-red-600">
                {t('action_cannot_be_undone') || "Bu amalni qaytarib bo'lmaydi."}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('delete') || "O'chirish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
