import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, FileCheck, AlertTriangle, CheckCircle2, FileText,
  Users, Trash2, RefreshCw, Eye, ArrowLeft, Printer, Loader2,
  Send, Mail, MessageCircle, ChevronDown, Link2, Check
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { contactsService } from '@/api/services';
import financeService from "@/api/services/finance";

export default function ActSverka() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    reconciliationActs,
    createReconciliationAct,
    deleteReconciliationAct,
    bulkGenerateReconciliation,
    updateReconciliationAct,
    isLoading
  } = useFinancials();
  const { formatCurrency } = useCurrencyFormatter();
  const { canCreate, canDelete } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actToDelete, setActToDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Detail view state
  const [selectedAct, setSelectedAct] = useState(null);
  const [actDetail, setActDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Send state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMethod, setSendMethod] = useState('email'); // 'email' or 'whatsapp'
  const [sendEmail, setSendEmail] = useState('');
  const [sendPhone, setSendPhone] = useState('+998');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showSendDropdown, setShowSendDropdown] = useState(false);

  // Contacts for partner selector
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

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

  // Load contacts
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const data = await contactsService.list();
        const arr = Array.isArray(data) ? data : (data?.items || []);
        setContacts(arr);
      } catch (err) {
        console.error('Failed to load contacts:', err);
      }
    };
    loadContacts();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = reconciliationActs.length;
    const confirmed = reconciliationActs.filter(a => a.status === 'confirmed').length;
    const withDifference = reconciliationActs.filter(a => {
      const closing = (a.opening_balance || 0) + (a.our_debit_total || 0) - (a.our_credit_total || 0);
      return Math.abs(closing) > 0.01;
    }).length;
    const draft = reconciliationActs.filter(a => a.status === 'draft').length;
    return { total, confirmed, withDifference, draft };
  }, [reconciliationActs]);

  // Filter
  const filteredActs = useMemo(() => {
    let result = [...reconciliationActs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => (a.partner_name || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }
    return result;
  }, [reconciliationActs, searchQuery, statusFilter]);

  // Filtered contacts for dropdown
  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts.slice(0, 20);
    const q = contactSearch.toLowerCase();
    return contacts.filter(c => (c.name || '').toLowerCase().includes(q)).slice(0, 20);
  }, [contacts, contactSearch]);

  const getResponseBadge = (responseStatus) => {
    if (!responseStatus) return null;
    const styles = {
      confirmed: 'bg-emerald-100 text-emerald-800',
      disputed: 'bg-red-100 text-red-800',
      no_response: 'bg-slate-100 text-slate-600'
    };
    const labels = {
      confirmed: 'Kontragent tasdiqladi',
      disputed: 'Kontragent norozilik bildirdi',
      no_response: 'Javob kutilmoqda'
    };
    return (
      <Badge className={styles[responseStatus] || 'bg-slate-100 text-slate-600'}>
        {labels[responseStatus] || responseStatus}
      </Badge>
    );
  };

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

  const handleCreate = async () => {
    if ((!formData.partner_id && !formData.partner_name) || !formData.period_start || !formData.period_end) return;
    setIsSaving(true);
    try {
      const result = await createReconciliationAct(formData);
      setShowCreateModal(false);
      setFormData({
        partner_id: '', partner_name: '',
        period_start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setContactSearch('');
      // Open the newly created act
      if (result?.id) {
        openActDetail(result);
      }
    } catch (err) {
      console.error('Failed to create act:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkGenerate = async () => {
    setIsSaving(true);
    try {
      const result = await bulkGenerateReconciliation(bulkFormData);
      setShowBulkModal(false);
    } catch (err) {
      console.error('Failed to bulk generate:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const openActDetail = useCallback(async (act) => {
    setSelectedAct(act);
    setIsLoadingDetail(true);
    try {
      const detail = await financeService.getReconciliationAct(act.id);
      setActDetail(detail);
    } catch (err) {
      console.error('Failed to load act detail:', err);
      setActDetail(act);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const handleRefresh = async () => {
    if (!selectedAct) return;
    setIsLoadingDetail(true);
    try {
      const refreshed = await financeService.refreshReconciliationAct(selectedAct.id);
      setActDetail(refreshed);
      setSelectedAct(prev => ({ ...prev, ...refreshed }));
    } catch (err) {
      console.error('Failed to refresh act:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedAct) return;
    try {
      await updateReconciliationAct(selectedAct.id, { status: newStatus });
      setSelectedAct(prev => ({ ...prev, status: newStatus }));
      if (actDetail) setActDetail(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDeleteClick = (act, e) => {
    if (e) e.stopPropagation();
    setActToDelete(act);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!actToDelete) return;
    try {
      await deleteReconciliationAct(actToDelete.id);
      if (selectedAct?.id === actToDelete.id) {
        setSelectedAct(null);
        setActDetail(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setShowDeleteConfirm(false);
      setActToDelete(null);
    }
  };

  const handlePrint = () => {
    if (!actDetail) return;
    const act = actDetail;
    const lines = act.lines || [];
    const closingBalance = (act.opening_balance || 0) + (act.our_debit_total || 0) - (act.our_credit_total || 0);

    const linesHtml = lines.map((l, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${l.date}</td>
        <td>${l.document || ''}</td>
        <td>${l.description || ''}</td>
        <td style="text-align:right">${l.debit > 0 ? formatCurrency(l.debit) : ''}</td>
        <td style="text-align:right">${l.credit > 0 ? formatCurrency(l.credit) : ''}</td>
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <title>${t('reconciliation_act')} - ${act.partner_name}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; font-size: 13px; }
          h1 { text-align: center; font-size: 16px; margin-bottom: 2px; text-transform: uppercase; }
          h2 { text-align: center; font-size: 13px; font-weight: normal; color: #333; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #000; padding: 4px 8px; font-size: 12px; }
          th { background: #f5f5f5; text-align: center; font-weight: bold; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
          .signatures div { width: 45%; }
          .sig-line { border-bottom: 1px solid #000; margin-top: 30px; margin-bottom: 4px; }
          .totals td { font-weight: bold; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>${t('print_act_title')}</h1>
        <h2>${t('print_act_subtitle')}</h2>

        <div class="info-row">
          <span><strong>${t('counterparty')}:</strong> ${act.partner_name}</span>
          <span><strong>${t('period')}:</strong> ${act.period_start} — ${act.period_end}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px">№</th>
              <th style="width:90px">${t('date')}</th>
              <th style="width:120px">${t('document')}</th>
              <th>${t('description')}</th>
              <th style="width:120px">${t('debit')}</th>
              <th style="width:120px">${t('credit')}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="totals" style="background:#f9f9f9">
              <td colspan="4">${t('opening_balance')}</td>
              <td style="text-align:right">${act.opening_balance >= 0 ? formatCurrency(act.opening_balance) : ''}</td>
              <td style="text-align:right">${act.opening_balance < 0 ? formatCurrency(Math.abs(act.opening_balance)) : ''}</td>
            </tr>
            ${linesHtml}
            <tr class="totals" style="background:#f0f0f0">
              <td colspan="4">${t('period_turnover')}</td>
              <td style="text-align:right">${formatCurrency(act.our_debit_total || 0)}</td>
              <td style="text-align:right">${formatCurrency(act.our_credit_total || 0)}</td>
            </tr>
            <tr class="totals" style="background:#e8e8e8">
              <td colspan="4">${t('closing_balance')}</td>
              <td style="text-align:right">${closingBalance >= 0 ? formatCurrency(closingBalance) : ''}</td>
              <td style="text-align:right">${closingBalance < 0 ? formatCurrency(Math.abs(closingBalance)) : ''}</td>
            </tr>
          </tbody>
        </table>

        ${act.notes ? `<p style="margin-top:12px"><strong>${t('notes')}:</strong> ${act.notes}</p>` : ''}

        <div class="signatures">
          <div>
            <p><strong>${t('print_on_behalf_org')}:</strong></p>
            <div class="sig-line"></div>
            <p style="font-size:11px;color:#666">${t('print_sig_hint')}</p>
          </div>
          <div>
            <p><strong>${t('print_on_behalf_partner')}:</strong></p>
            <div class="sig-line"></div>
            <p style="font-size:11px;color:#666">${t('print_sig_hint')}</p>
          </div>
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

  const openSendModal = (method) => {
    setSendMethod(method);
    setSendResult(null);
    setShowSendDropdown(false);
    // Pre-fill email from contact if available
    if (method === 'email' && actDetail) {
      const contact = contacts.find(c => c.id === (actDetail.partner_id || selectedAct?.partner_id));
      setSendEmail(contact?.email || '');
    }
    if (method === 'whatsapp' && actDetail) {
      const contact = contacts.find(c => c.id === (actDetail.partner_id || selectedAct?.partner_id));
      setSendPhone(contact?.phone || '');
    }
    setShowSendModal(true);
  };

  const handleSend = async () => {
    if (!selectedAct) return;
    if (sendMethod === 'email' && !sendEmail) return;
    setIsSending(true);
    setSendResult(null);
    try {
      const result = await financeService.sendReconciliationAct(selectedAct.id, {
        via: sendMethod,
        email: sendMethod === 'email' ? sendEmail : '',
        phone: sendMethod === 'whatsapp' ? sendPhone : '',
      });
      setSendResult(result);
      // Update local status
      setSelectedAct(prev => ({ ...prev, status: 'sent' }));
      if (actDetail) setActDetail(prev => ({ ...prev, status: 'sent' }));

      if (sendMethod === 'whatsapp' && result.whatsapp_message) {
        const waURL = `https://wa.me/${sendPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(result.whatsapp_message)}`;
        window.open(waURL, '_blank');
      }
    } catch (err) {
      console.error('Send failed:', err);
      setSendResult({ error: err?.response?.data?.error || "Yuborishda xatolik yuz berdi" });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // ========== DETAIL VIEW ==========
  if (selectedAct) {
    const act = actDetail || selectedAct;
    const lines = act.lines || [];
    const closingBalance = (act.opening_balance || 0) + (act.our_debit_total || 0) - (act.our_credit_total || 0);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedAct(null); setActDetail(null); }}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('back') || 'Orqaga'}
            </Button>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                {t('reconciliation_act') || 'Akt sverka'} — {act.partner_name}
              </h2>
              <p className="text-sm text-slate-500">
                {act.period_start} — {act.period_end}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(act.status || 'draft')}
            {act.response_status && getResponseBadge(act.response_status)}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoadingDetail}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingDetail ? 'animate-spin' : ''}`} />
              {t('refresh') || 'Yangilash'}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              {t('print') || 'Chop etish'}
            </Button>
            {/* Send dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setShowSendDropdown(!showSendDropdown)}
              >
                <Send className="w-4 h-4 mr-1" />
                {t('send') || 'Yuborish'}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
              {showSendDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSendDropdown(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 rounded-t-lg"
                      onClick={() => openSendModal('email')}
                    >
                      <Mail className="w-4 h-4 text-blue-600" />
                      Email orqali
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-green-50 rounded-b-lg"
                      onClick={() => openSendModal('whatsapp')}
                    >
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      WhatsApp orqali
                    </button>
                  </div>
                </>
              )}
            </div>
            {act.status === 'draft' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleStatusChange('confirmed')}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {t('confirm') || 'Tasdiqlash'}
              </Button>
            )}
            {act.status === 'confirmed' && (
              <Button variant="outline" size="sm" onClick={() => handleStatusChange('draft')}>
                {t('revert_to_draft') || 'Qoralamaga qaytarish'}
              </Button>
            )}
          </div>
        </div>

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-500">{t('loading') || 'Yuklanmoqda...'}</span>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1">{t('opening_balance') || 'Davr boshidagi qoldiq'}</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(act.opening_balance || 0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1">{t('total_debit') || 'Jami debet'}</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(act.our_debit_total || 0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1">{t('total_credit') || 'Jami kredit'}</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(act.our_credit_total || 0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1">{t('closing_balance') || 'Davr oxiridagi qoldiq'}</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(closingBalance)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Transaction Lines Table */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-[40px] text-center text-xs font-semibold">№</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold">{t('date') || 'Sana'}</TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold">{t('document') || 'Hujjat'}</TableHead>
                    <TableHead className="text-xs font-semibold">{t('description') || 'Tavsif'}</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{t('debit') || 'Debet'}</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{t('credit') || 'Kredit'}</TableHead>
                    <TableHead className="w-[140px] text-right text-xs font-semibold">{t('balance') || 'Qoldiq'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  <TableRow className="bg-slate-50/50 font-medium">
                    <TableCell></TableCell>
                    <TableCell colSpan={3} className="text-sm font-semibold text-slate-600 italic">
                      {t('opening_balance') || 'Davr boshidagi qoldiq'}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {formatCurrency(act.opening_balance || 0)}
                    </TableCell>
                  </TableRow>

                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        {t('no_transactions') || "Bu davr uchun operatsiyalar topilmadi"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50">
                        <TableCell className="text-center text-xs text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="text-xs text-slate-600">{line.date}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-600">{line.document || '-'}</TableCell>
                        <TableCell className="text-xs text-slate-700">{line.description || '-'}</TableCell>
                        <TableCell className="text-right text-xs">
                          {line.debit > 0 ? (
                            <span className="text-blue-600 font-medium">{formatCurrency(line.debit)}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {line.credit > 0 ? (
                            <span className="text-red-600 font-medium">{formatCurrency(line.credit)}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {formatCurrency(line.running_balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}

                  {/* Totals Row */}
                  <TableRow className="bg-slate-100/80 border-t-2 border-slate-300">
                    <TableCell></TableCell>
                    <TableCell colSpan={3} className="text-sm font-bold text-slate-700">
                      {t('period_turnover') || "Davr bo'yicha aylanma"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-blue-700">
                      {formatCurrency(act.our_debit_total || 0)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-red-700">
                      {formatCurrency(act.our_credit_total || 0)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {/* Closing Balance Row */}
                  <TableRow className="bg-slate-50/80 border-t border-slate-200">
                    <TableCell></TableCell>
                    <TableCell colSpan={3} className="text-sm font-bold text-slate-800">
                      {t('closing_balance') || 'Davr oxiridagi qoldiq'}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-sm font-bold text-slate-800">
                      {formatCurrency(closingBalance)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>

            {/* Sent & Response Info */}
            {(act.sent_at || act.response_status) && (
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4 space-y-3">
                  {act.sent_at && (
                    <div className="flex items-center gap-4 text-sm">
                      <Send className="w-4 h-4 text-blue-500" />
                      <span className="text-slate-600">
                        <strong>{act.sent_via === 'email' ? 'Email' : 'WhatsApp'}</strong> orqali yuborilgan:
                        {' '}{act.sent_to}
                        {' '}— {new Date(act.sent_at).toLocaleDateString('uz-UZ')}
                      </span>
                    </div>
                  )}
                  {act.response_status && (
                    <div className={`flex items-center gap-4 text-sm p-2 rounded-lg ${
                      act.response_status === 'confirmed' ? 'bg-emerald-50' :
                      act.response_status === 'disputed' ? 'bg-red-50' : 'bg-slate-50'
                    }`}>
                      {act.response_status === 'confirmed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : act.response_status === 'disputed' ? (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <span className={`font-medium ${
                          act.response_status === 'confirmed' ? 'text-emerald-700' :
                          act.response_status === 'disputed' ? 'text-red-700' : 'text-slate-600'
                        }`}>
                          {act.response_status === 'confirmed' ? 'Kontragent tasdiqladi' :
                           act.response_status === 'disputed' ? 'Kontragent norozilik bildirdi' :
                           'Javob kutilmoqda'}
                        </span>
                        {act.respondent_name && (
                          <span className="text-slate-500 ml-2">({act.respondent_name})</span>
                        )}
                        {act.responded_at && (
                          <span className="text-slate-400 ml-2 text-xs">
                            {new Date(act.responded_at).toLocaleDateString('uz-UZ')}
                          </span>
                        )}
                        {act.dispute_note && (
                          <p className="text-red-600 text-xs mt-1">Izoh: {act.dispute_note}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {act.notes && (
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1">{t('notes') || 'Izoh'}</p>
                  <p className="text-sm text-slate-700">{act.notes}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  // ========== LIST VIEW ==========
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
                <p className="text-sm text-slate-500">{t('with_balance') || 'Qoldiqi bor'}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.withDifference}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
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
                  <TableHead className="text-right">{t('opening') || 'Boshlanish'}</TableHead>
                  <TableHead className="text-right">{t('debit') || 'Debet'}</TableHead>
                  <TableHead className="text-right">{t('credit') || 'Kredit'}</TableHead>
                  <TableHead className="text-right">{t('closing') || 'Tugash'}</TableHead>
                  <TableHead className="text-center">{t('status') || 'Holat'}</TableHead>
                  <TableHead className="text-center">Javob</TableHead>
                  <TableHead className="text-center">{t('actions') || 'Amallar'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActs.map((act) => {
                  const closingBalance = (act.opening_balance || 0) + (act.our_debit_total || 0) - (act.our_credit_total || 0);
                  return (
                    <TableRow
                      key={act.id}
                      className="hover:bg-blue-50/50 cursor-pointer"
                      onClick={() => openActDetail(act)}
                    >
                      <TableCell className="font-medium">{act.partner_name}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {act.period_start} — {act.period_end}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(act.opening_balance || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-blue-600">
                        {formatCurrency(act.our_debit_total || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">
                        {formatCurrency(act.our_credit_total || 0)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-semibold ${Math.abs(closingBalance) > 0.01 ? 'text-slate-800' : 'text-green-600'}`}>
                        {formatCurrency(closingBalance)}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(act.status)}</TableCell>
                      <TableCell className="text-center">
                        {act.response_status ? getResponseBadge(act.response_status) : (
                          act.status === 'sent' ? <Badge className="bg-slate-100 text-slate-500">Kutilmoqda</Badge> : <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => openActDetail(act)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canDelete(MODULES.FINANCIALS) && act.status === 'draft' && (
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={(e) => handleDeleteClick(act, e)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Act Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { setShowCreateModal(open); if (!open) { setContactSearch(''); setShowContactDropdown(false); } }}>
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
            {/* Partner selector */}
            <div className="relative">
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('counterparty') || 'Kontragent'} *
              </label>
              {formData.partner_id ? (
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="flex-1 text-sm font-medium">{formData.partner_name}</span>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setFormData(prev => ({ ...prev, partner_id: '', partner_name: '' }));
                    setContactSearch('');
                  }}>
                    &times;
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder={t('search_or_enter_name') || "Kontragentni qidiring yoki nom kiriting..."}
                    value={contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setFormData(prev => ({ ...prev, partner_name: e.target.value, partner_id: '' }));
                      setShowContactDropdown(true);
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    className="bg-slate-50 border-slate-200"
                  />
                  {showContactDropdown && filteredContacts.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                      {filteredContacts.map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm flex items-center justify-between"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, partner_id: c.id, partner_name: c.name }));
                            setContactSearch(c.name);
                            setShowContactDropdown(false);
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-slate-400">{c.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
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
                disabled={isSaving || (!formData.partner_id && !formData.partner_name)}
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
              {t('bulk_generate_desc') || "Jurnal yozuvlarida operatsiyasi bor barcha kontragentlar uchun avtomatik akt yaratiladi"}
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

      {/* Send Modal */}
      <Dialog open={showSendModal} onOpenChange={(open) => { setShowSendModal(open); if (!open) setSendResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sendMethod === 'email' ? (
                <><Mail className="w-5 h-5 text-blue-600" /> Email orqali yuborish</>
              ) : (
                <><MessageCircle className="w-5 h-5 text-green-600" /> WhatsApp orqali yuborish</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAct && `${selectedAct.partner_name} — ${selectedAct.period_start} — ${selectedAct.period_end}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {sendMethod === 'email' ? (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Email manzil *
                </label>
                <Input
                  type="email"
                  placeholder="kontragent@example.com"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Telefon raqam
                </label>
                <Input
                  type="tel"
                  placeholder="+998901234567"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
            )}

            {/* Result message */}
            {sendResult && !sendResult.error && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <Check className="w-4 h-4" />
                  {sendResult.message}
                </div>
                {sendResult.share_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <Link2 className="w-3 h-3 text-slate-400" />
                    <a href={sendResult.share_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate">
                      {sendResult.share_url}
                    </a>
                  </div>
                )}
              </div>
            )}
            {sendResult?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{sendResult.error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowSendModal(false)}>
                {sendResult && !sendResult.error ? 'Yopish' : 'Bekor qilish'}
              </Button>
              {(!sendResult || sendResult.error) && (
                <Button
                  onClick={handleSend}
                  disabled={isSending || (sendMethod === 'email' && !sendEmail)}
                  className={sendMethod === 'email'
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                  }
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : sendMethod === 'email' ? (
                    <Mail className="w-4 h-4 mr-2" />
                  ) : (
                    <MessageCircle className="w-4 h-4 mr-2" />
                  )}
                  Yuborish
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
