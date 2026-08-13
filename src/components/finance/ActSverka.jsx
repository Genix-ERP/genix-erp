import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, FileCheck, AlertTriangle, CheckCircle2, FileText,
  Users, Trash2, RefreshCw, Eye, ArrowLeft, Printer, Loader2,
  Send, Mail, MessageCircle, ChevronDown, ChevronRight, ChevronLeft, Link2, Check, Copy, Bell,
  Package, Truck, Download
} from "lucide-react";
import { exportReconciliationToExcel } from '@/utils/exportReconciliationExcel';
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
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { getApiErrorMessage } from '@/utils/apiError';
import { toast } from 'sonner';

// Fix share URLs: replace backend's FRONTEND_URL with actual browser origin
const fixShareUrl = (url) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    return `${window.location.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
};

// The act's closing balance, as the server computed it.
//
// closing_balance and our_balance are both `opening + debit - credit` over
// LIVE journal entries, computed server-side on every list row and on detail.
// This screen redid that subtraction in three separate places — the print
// sheet, the detail panel and the table row — and the summary card counting
// "Qoldiqi bor" made a fourth. Four copies of one number, each free to drift
// from the server and from each other the moment the definition changes.
//
// The arithmetic survives only as a fallback for a response predating those
// fields, never as the primary source.
const actClosingBalance = (act) => {
  if (!act) return 0;
  if (typeof act.closing_balance === 'number') return act.closing_balance;
  if (typeof act.our_balance === 'number') return act.our_balance;
  return (act.opening_balance || 0) + (act.our_debit_total || 0) - (act.our_credit_total || 0);
};

// The status state machine, copied from the server that enforces it
// (UpdateReconciliationAct in internal/handler/finance_extra.go).
//
// Every action button is derived from this table, so a button appears exactly
// when the server would accept the transition. The three hand-written
// condition lists it replaces had each drifted somewhere different: confirm
// was not offered from `no_response`, "Solishtirishda xatolik" was offered
// only from `draft` although the server allows it from `sent` too, and
// "Qoralamaga qaytarish" was missing `disputed`. Three lists, three different
// wrong answers — because each was maintained by hand against a rule written
// down somewhere else.
const ALLOWED_TRANSITIONS = {
  draft: ['sent', 'confirmed', 'discrepancy'],
  sent: ['confirmed', 'disputed', 'discrepancy', 'draft'],
  confirmed: ['draft'],
  disputed: ['draft', 'confirmed', 'sent'],
  discrepancy: ['draft', 'confirmed'],
  no_response: ['draft', 'sent', 'confirmed'],
};

const canTransition = (from, to) => (ALLOWED_TRANSITIONS[from || 'draft'] || []).includes(to);

export default function ActSverka() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    createReconciliationAct,
    deleteReconciliationAct,
    bulkGenerateReconciliation,
    updateReconciliationAct,
  } = useFinancials();
  const { formatCurrency } = useCurrencyFormatter();
  const { canCreate, canDelete } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // 'all' | 'customer' | 'vendor' — acts are per-contact, and the same page
  // serves both sides; this narrows the list to one side's counterparties.
  const [partnerTypeFilter, setPartnerTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actToDelete, setActToDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Detail view state
  const [selectedAct, setSelectedAct] = useState(null);
  const [actDetail, setActDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  // Send state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMethod, setSendMethod] = useState('email'); // 'email' or 'whatsapp'
  const [sendEmail, setSendEmail] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendPhone, setSendPhone] = useState('+998');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showSendDropdown, setShowSendDropdown] = useState(false);

  // Reminder state
  const [isReminding, setIsReminding] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);

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

  // Partner picker: searched on the server.
  //
  // This used to call contactsService.list() with no params and filter the
  // result in the browser. GET /contacts defaults to limit=50 (max 100), so
  // the dropdown silently held the first 50 contacts and the search box
  // searched only those — a tenant with 200 partners could not find number 51
  // by typing its name, and nothing said so.
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const params = { limit: 20 };
        if (contactSearch.trim()) params.search = contactSearch.trim();
        const data = await contactsService.list(params);
        const arr = Array.isArray(data) ? data : (data?.items || []);
        if (!cancelled) setContacts(arr);
      } catch (err) {
        console.error('Failed to load contacts:', err);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [contactSearch]);

  // ── The list, the count and the cards all come from the server ──
  //
  // This screen used to read the whole act list out of FinancialsContext,
  // filter and slice it in the browser, and count the summary cards over it.
  // That works only while every act fits in one response: the moment it does
  // not, the search silently stops finding partners and the cards describe
  // whatever happened to be loaded. Searching and counting are now the
  // server's job, and paging is opt-in so no other caller of this endpoint
  // changes behaviour.
  const [acts, setActs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isListLoading, setIsListLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0, confirmed: 0, withDifference: 0, draft: 0, discrepancy: 0,
  });

  // Debounced so a search does not fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const loadActs = useCallback(async () => {
    setIsListLoading(true);
    try {
      const params = { page: currentPage, page_size: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (partnerTypeFilter !== 'all') params.partner_type = partnerTypeFilter;
      const res = await financeService.listReconciliationActsPaginated(params);
      setActs(res?.data || []);
      setTotalCount(res?.meta?.total ?? (res?.data?.length || 0));
    } catch (err) {
      console.error('Failed to load reconciliation acts:', err);
      setActs([]);
      setTotalCount(0);
    } finally {
      setIsListLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter, partnerTypeFilter]);

  useEffect(() => { loadActs(); }, [loadActs]);

  // The cards deliberately ignore statusFilter: they ARE the status
  // breakdown, and are what the user clicks to set that filter. Counting them
  // within the filter would make the selected status equal the total and
  // every other card zero.
  const loadStats = useCallback(async () => {
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (partnerTypeFilter !== 'all') params.partner_type = partnerTypeFilter;
      const s = await financeService.getReconciliationSummary(params);
      setStats({
        total: s?.total || 0,
        confirmed: s?.confirmed || 0,
        withDifference: s?.with_balance || 0,
        draft: s?.draft || 0,
        discrepancy: s?.discrepancy || 0,
      });
    } catch (err) {
      console.error('Failed to load reconciliation summary:', err);
    }
  }, [debouncedSearch, partnerTypeFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, partnerTypeFilter]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedActs = acts;

  // Filtered contacts for dropdown
  // The server already applied the search and the limit; filtering again here
  // would only re-narrow a set that is already correct.
  const filteredContacts = contacts;

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
      disputed: 'bg-red-100 text-red-800',
      discrepancy: 'bg-orange-100 text-orange-800',
      no_response: 'bg-slate-100 text-slate-700'
    };
    const labels = {
      draft: t('draft') || 'Qoralama',
      sent: t('sent') || 'Yuborilgan',
      confirmed: t('confirmed') || 'Tasdiqlangan',
      disputed: t('disputed') || 'Munozarali',
      discrepancy: t('discrepancy') || 'Solishtirishda xatolik',
      // In the status CHECK constraint since migration 297 and reachable
      // through the state machine, so without a label here the badge printed
      // the raw string "no_response" at the user.
      no_response: t('no_response') || 'Javob berilmadi'
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
      await Promise.all([loadActs(), loadStats()]);
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
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkGenerate = async () => {
    setIsSaving(true);
    try {
      await bulkGenerateReconciliation(bulkFormData);
      await Promise.all([loadActs(), loadStats()]);
      setShowBulkModal(false);
    } catch (err) {
      console.error('Failed to bulk generate:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const openActDetail = useCallback(async (act) => {
    setSelectedAct(act);
    setExpandedRows({});
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
      // The server now returns the updated act (B2), so the local patch is a
      // fallback for a backend that predates it rather than the only source.
      const updated = await updateReconciliationAct(selectedAct.id, { status: newStatus });
      const next = (updated && updated.id) ? updated : { status: newStatus };
      setSelectedAct(prev => ({ ...prev, ...next }));
      if (actDetail) setActDetail(prev => ({ ...prev, ...next }));
      await Promise.all([loadActs(), loadStats()]);
    } catch (err) {
      console.error('Failed to update status:', err);
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
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
      await Promise.all([loadActs(), loadStats()]);
      if (selectedAct?.id === actToDelete.id) {
        setSelectedAct(null);
        setActDetail(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setShowDeleteConfirm(false);
      setActToDelete(null);
    }
  };

  const handlePrint = () => {
    if (!actDetail) return;
    const act = actDetail;
    const lines = act.lines || [];
    const closingBalance = actClosingBalance(act);

    const linesHtml = lines.map((l, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${formatDate(l.date)}</td>
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

  const handleExportExcel = async () => {
    if (!actDetail) return;
    try {
      await exportReconciliationToExcel({
        act: actDetail,
        formatCurrency,
        labels: {
          reconciliation_act: t('reconciliation_act') || 'Akt sverka',
          period: t('period') || 'Davr',
          opening_balance: language === 'uz' ? 'Davr boshi qoldiq' : language === 'ru' ? 'Начальный остаток' : 'Opening Balance',
          total_debit: language === 'uz' ? 'Jami sotilgan' : language === 'ru' ? 'Всего продано' : 'Total Sold',
          total_credit: language === 'uz' ? 'Jami to\'langan' : language === 'ru' ? 'Всего оплачено' : 'Total Paid',
          closing_balance: language === 'uz' ? 'Davr oxiri qoldiq' : language === 'ru' ? 'Конечный остаток' : 'Closing Balance',
          date: t('date') || 'Sana',
          document: t('document') || 'Hujjat',
          description: t('description') || 'Tavsif',
          vehicle_number: t('vehicle_number') || 'Mashina raqami',
          product: t('product') || 'Mahsulot',
          products: t('products') || 'mahsulot',
          quantity: t('quantity') || 'Miqdor',
          unit_price: t('unit_price') || 'Narx',
          item_total: t('total') || 'Jami',
          debit: language === 'uz' ? 'Sotilgan' : language === 'ru' ? 'Продано' : 'Sold',
          credit: language === 'uz' ? 'To\'langan' : language === 'ru' ? 'Оплачено' : 'Paid',
          balance: language === 'uz' ? 'Qoldiq' : language === 'ru' ? 'Остаток' : 'Balance',
          period_turnover: t('period_turnover') || "Davr bo'yicha aylanma",
          on_behalf_org: t('print_on_behalf_org') || 'Tashkilot nomidan',
          on_behalf_partner: t('print_on_behalf_partner') || 'Kontragent nomidan',
          signature_hint: t('print_sig_hint') || 'F.I.O. / imzo / muhr',
        },
      });
    } catch (err) {
      console.error('Excel export failed:', err);
    }
  };

  const openSendModal = (method) => {
    setSendMethod(method);
    setSendResult(null);
    setShowSendDropdown(false);
    const act = actDetail || selectedAct;
    // Pre-fill email from contact if available
    if (method === 'email' && act) {
      const contact = contacts.find(c => c.id === (act.partner_id || selectedAct?.partner_id));
      setSendEmail(contact?.email || '');
      setSendSubject(`${t('reconciliation_act') || 'Akt sverka'} — ${act.partner_name} (${act.period_start} – ${act.period_end})`);
      setSendMessage('');
    }
    if (method === 'whatsapp' && act) {
      const contact = contacts.find(c => c.id === (act.partner_id || selectedAct?.partner_id));
      setSendPhone(contact?.phone || '');
    }
    setShowSendModal(true);
  };

  const handleCopyLink = async () => {
    if (!selectedAct) return;
    setShowSendDropdown(false);
    setIsSending(true);
    try {
      const result = await financeService.sendReconciliationAct(selectedAct.id, {
        via: 'link',
      });
      if (result.share_url) {
        const fixedUrl = fixShareUrl(result.share_url);
        await navigator.clipboard.writeText(fixedUrl);
        setSendResult({ message: t('link_copied') || 'Havola nusxalandi', share_url: fixedUrl });
        setShowSendModal(true);
      }
    } catch (err) {
      console.error('Copy link failed:', err);
    } finally {
      setIsSending(false);
    }
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
        subject: sendMethod === 'email' ? sendSubject : '',
        message: sendMethod === 'email' ? sendMessage : '',
      });
      setSendResult({ ...result, share_url: fixShareUrl(result.share_url) });
      // Update local status
      setSelectedAct(prev => ({ ...prev, status: 'sent' }));
      if (actDetail) setActDetail(prev => ({ ...prev, status: 'sent' }));

      if (sendMethod === 'whatsapp' && result.whatsapp_message) {
        const waURL = `https://wa.me/${sendPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(result.whatsapp_message)}`;
        window.open(waURL, '_blank');
      }
    } catch (err) {
      console.error('Send failed:', err);
      setSendResult({ error: getApiErrorMessage(err, "Yuborishda xatolik yuz berdi") });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedAct) return;
    setIsReminding(true);
    setReminderResult(null);
    try {
      const result = await financeService.sendReconciliationReminder(selectedAct.id);
      setReminderResult(result);
      if (result.whatsapp_message && result.phone) {
        const waURL = `https://wa.me/${result.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(result.whatsapp_message)}`;
        window.open(waURL, '_blank');
      }
    } catch (err) {
      console.error('Reminder failed:', err);
      setReminderResult({ error: getApiErrorMessage(err, "Eslatma yuborishda xatolik") });
    } finally {
      setIsReminding(false);
    }
  };

  if (isListLoading && acts.length === 0) {
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
    const closingBalance = actClosingBalance(act);

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
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={handleExportExcel}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
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
                      {t('send_via_email') || 'Email orqali yuborish'}
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-green-50"
                      onClick={() => openSendModal('whatsapp')}
                    >
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      {t('send_via_whatsapp') || 'WhatsApp orqali yuborish'}
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 rounded-b-lg border-t border-slate-100"
                      onClick={handleCopyLink}
                    >
                      <Link2 className="w-4 h-4 text-slate-600" />
                      {t('copy_link') || 'Havolani nusxalash'}
                    </button>
                  </div>
                </>
              )}
            </div>
            {act.status === 'sent' && (!act.response_status || act.response_status === 'no_response') && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handleSendReminder}
                disabled={isReminding}
              >
                {isReminding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bell className="w-4 h-4 mr-1" />}
                {t('send_reminder') || 'Eslatma yuborish'}
              </Button>
            )}
            {canTransition(act.status, 'confirmed') && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleStatusChange('confirmed')}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {t('confirm') || 'Tasdiqlash'}
              </Button>
            )}
            {canTransition(act.status, 'discrepancy') && (
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={() => handleStatusChange('discrepancy')}
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                {t('discrepancy') || 'Solishtirishda xatolik'}
              </Button>
            )}
            {canTransition(act.status, 'draft') && (
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
                  <p className="text-xs text-slate-500 mb-1">{language === 'uz' ? 'Jami sotilgan' : language === 'ru' ? 'Всего продано' : 'Total Sold'}</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(act.our_debit_total || 0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1">{language === 'uz' ? 'Jami to\'langan' : language === 'ru' ? 'Всего оплачено' : 'Total Paid'}</p>
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
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{language === 'uz' ? 'Sotilgan' : language === 'ru' ? 'Продано' : 'Sold'}</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-semibold">{language === 'uz' ? 'To\'langan' : language === 'ru' ? 'Оплачено' : 'Paid'}</TableHead>
                    <TableHead className="w-[140px] text-right text-xs font-semibold">{language === 'uz' ? 'Qoldiq' : language === 'ru' ? 'Остаток' : 'Balance'}</TableHead>
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
                    lines.map((line, idx) => {
                      const hasDetails = line.items && line.items.length > 0;
                      const isExpanded = expandedRows[idx];
                      return (
                        <React.Fragment key={idx}>
                          <TableRow
                            className={`hover:bg-slate-50/50 ${hasDetails ? 'cursor-pointer' : ''}`}
                            onClick={() => hasDetails && setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          >
                            <TableCell className="text-center text-xs text-slate-500">
                              <div className="flex items-center justify-center gap-1">
                                {hasDetails && (
                                  <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                )}
                                {idx + 1}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{formatDate(line.date)}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-600">{line.document || '-'}</TableCell>
                            <TableCell className="text-xs text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <span>{line.description || '-'}</span>
                                {line.vehicle_number && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded border border-amber-200">
                                    <Truck className="w-2.5 h-2.5" />
                                    {line.vehicle_number}
                                  </span>
                                )}
                                {hasDetails && !isExpanded && (
                                  <span className="text-[10px] text-slate-400">
                                    ({line.items.length} {t('products') || 'mahsulot'})
                                  </span>
                                )}
                              </div>
                            </TableCell>
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
                          {hasDetails && isExpanded && (
                            <TableRow className="bg-slate-50/80">
                              <TableCell></TableCell>
                              <TableCell colSpan={6} className="py-2 px-3">
                                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-slate-100/80 text-slate-600">
                                        <th className="text-left py-1.5 px-3 font-medium">
                                          <div className="flex items-center gap-1">
                                            <Package className="w-3 h-3" />
                                            {t('product') || 'Mahsulot'}
                                          </div>
                                        </th>
                                        <th className="text-right py-1.5 px-3 font-medium w-[80px]">{t('quantity') || 'Miqdor'}</th>
                                        <th className="text-right py-1.5 px-3 font-medium w-[100px]">{t('unit_price') || 'Narx'}</th>
                                        <th className="text-right py-1.5 px-3 font-medium w-[110px]">{t('total') || 'Jami'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {line.items.map((item, itemIdx) => (
                                        <tr key={itemIdx} className="border-t border-slate-100 hover:bg-slate-50/50">
                                          <td className="py-1.5 px-3 text-slate-700">{item.product_name || '-'}</td>
                                          <td className="py-1.5 px-3 text-right text-slate-600">{item.quantity}</td>
                                          <td className="py-1.5 px-3 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                                          <td className="py-1.5 px-3 text-right font-medium text-slate-700">{formatCurrency(item.line_total)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
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

            {/* Reminder result toast */}
            {reminderResult && (
              <div className={`p-3 rounded-lg border ${reminderResult.error ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-sm font-medium ${reminderResult.error ? 'text-red-700' : 'text-amber-700'}`}>
                  {reminderResult.error || reminderResult.message}
                </p>
              </div>
            )}

            {/* Sent & Response Info */}
            {(act.sent_at || act.response_status) && (
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="p-4 space-y-3">
                  {act.sent_at && (
                    <div className="flex items-center gap-4 text-sm">
                      <Send className="w-4 h-4 text-blue-500" />
                      <span className="text-slate-600 flex-1">
                        <strong>{act.sent_via === 'email' ? 'Email' : 'WhatsApp'}</strong> orqali yuborilgan:
                        {' '}{act.sent_to}
                        {' '}— {formatDate(act.sent_at)}
                        {act.share_expires_at && (
                          <span className="text-slate-400 ml-2">
                            (havola {new Date(act.share_expires_at) > new Date() ?
                              `${formatDateTime(act.share_expires_at)} gacha amal qiladi` :
                              'muddati tugagan'})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {/* Reminder tracking info */}
                  {act.status === 'sent' && (act.reminder_3d_sent || act.reminder_7d_sent) && (
                    <div className="flex items-center gap-4 text-sm p-2 rounded-lg bg-amber-50">
                      <Bell className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700">
                        {act.reminder_7d_sent
                          ? 'Avtomatik eslatma yuborilgan (7 kun)'
                          : 'Avtomatik eslatma yuborilgan (3 kun)'}
                        {' '}— javob kutilmoqda
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
                            {formatDate(act.responded_at)}
                          </span>
                        )}
                        {act.dispute_note && (
                          <p className="text-red-600 text-xs mt-1">Izoh: {act.dispute_note}</p>
                        )}
                        {act.dispute_amount != null && (
                          <p className="text-red-600 text-xs mt-1">
                            Kontragent summasi: {Number(act.dispute_amount).toLocaleString('uz-UZ')} so&apos;m
                          </p>
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

        {/* Send Modal (detail view) */}
        <Dialog open={showSendModal} onOpenChange={(open) => { setShowSendModal(open); if (!open) setSendResult(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {sendMethod === 'email' ? (
                  <><Mail className="w-5 h-5 text-blue-600" /> {t('send_via_email') || 'Email orqali yuborish'}</>
                ) : sendMethod === 'whatsapp' ? (
                  <><MessageCircle className="w-5 h-5 text-green-600" /> {t('send_via_whatsapp') || 'WhatsApp orqali yuborish'}</>
                ) : (
                  <><Link2 className="w-5 h-5 text-slate-600" /> {t('copy_link') || 'Havolani nusxalash'}</>
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedAct && `${selectedAct.partner_name} — ${selectedAct.period_start} — ${selectedAct.period_end}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {sendMethod === 'email' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      {t('email_address') || 'Email manzil'} *
                    </label>
                    <Input
                      type="email"
                      placeholder="kontragent@example.com"
                      value={sendEmail}
                      onChange={(e) => setSendEmail(e.target.value)}
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      {t('email_subject') || 'Mavzu'}
                    </label>
                    <Input
                      type="text"
                      value={sendSubject}
                      onChange={(e) => setSendSubject(e.target.value)}
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      {t('message_body') || 'Xabar matni'}
                    </label>
                    <textarea
                      rows={3}
                      value={sendMessage}
                      onChange={(e) => setSendMessage(e.target.value)}
                      placeholder={t('optional_message') || 'Qo\'shimcha xabar (ixtiyoriy)'}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : sendMethod === 'whatsapp' ? (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {t('phone_number') || 'Telefon raqam'}
                  </label>
                  <Input
                    type="tel"
                    placeholder="+998901234567"
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
              ) : null}

              {/* Result message */}
              {sendResult && !sendResult.error && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                    <Check className="w-4 h-4" />
                    {sendResult.message}
                  </div>
                  {sendResult.share_url && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <a href={sendResult.share_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate min-w-0">
                          {sendResult.share_url}
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(sendResult.share_url); }}
                          className="flex-shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                          title="Nusxalash"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {sendMethod !== 'whatsapp' && (
                        <button
                          onClick={() => {
                            const act = actDetail || selectedAct;
                            const text = `Akt sverka: ${act?.partner_name || ''}\n${sendResult.share_url}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                          }}
                          className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-md border border-green-200 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp orqali ham yuborish
                        </button>
                      )}
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
                  {sendResult && !sendResult.error ? (t('close') || 'Yopish') : (t('cancel') || 'Bekor qilish')}
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
                    {t('send') || 'Yuborish'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
        {stats.discrepancy > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t('discrepancy') || 'Solishtirishda xatolik'}</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.discrepancy}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        )}
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
              <Select value={partnerTypeFilter} onValueChange={setPartnerTypeFilter}>
                <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t('counterparty') || "Kontragent"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_partners') || 'Barcha kontragentlar'}</SelectItem>
                  <SelectItem value="customer">{t('customers') || 'Mijozlar'}</SelectItem>
                  <SelectItem value="vendor">{t('vendors') || 'Yetkazib beruvchilar'}</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="discrepancy">{t('discrepancy') || 'Solishtirishda xatolik'}</SelectItem>
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
          {paginatedActs.length === 0 ? (
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
            <>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('counterparty') || 'Kontragent'}</TableHead>
                  <TableHead>{t('period') || 'Davr'}</TableHead>
                  <TableHead className="text-right">{language === 'uz' ? 'Boshlang\'ich' : language === 'ru' ? 'Начальный' : 'Opening'}</TableHead>
                  <TableHead className="text-right">{language === 'uz' ? 'Jami sotilgan' : language === 'ru' ? 'Всего продано' : 'Total Sold'}</TableHead>
                  <TableHead className="text-right">{language === 'uz' ? 'Jami to\'langan' : language === 'ru' ? 'Всего оплачено' : 'Total Paid'}</TableHead>
                  <TableHead className="text-right">{language === 'uz' ? 'Qoldiq' : language === 'ru' ? 'Остаток' : 'Balance'}</TableHead>
                  <TableHead className="text-center">{t('status') || 'Holat'}</TableHead>
                  <TableHead className="text-center">Javob</TableHead>
                  <TableHead className="text-center">{t('actions') || 'Amallar'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedActs.map((act) => {
                  const closingBalance = actClosingBalance(act);
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
            {totalPages > 1 && (
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
            )}
            </>
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
              <Input
                placeholder={t('search_or_enter_name') || "Kontragentni qidiring yoki nom kiriting..."}
                value={formData.partner_id ? formData.partner_name : contactSearch}
                onChange={(e) => {
                  setContactSearch(e.target.value);
                  setFormData(prev => ({ ...prev, partner_name: e.target.value, partner_id: '' }));
                  setShowContactDropdown(true);
                }}
                onClick={() => {
                  if (formData.partner_id) {
                    setContactSearch('');
                  }
                  setShowContactDropdown(true);
                }}
                className="bg-slate-50 border-slate-200"
              />
              {showContactDropdown && filteredContacts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredContacts.map(c => {
                    const isSelected = formData.partner_id === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm flex items-center justify-between ${isSelected ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          if (isSelected) {
                            setFormData(prev => ({ ...prev, partner_id: '', partner_name: '' }));
                            setContactSearch('');
                          } else {
                            setFormData(prev => ({ ...prev, partner_id: c.id, partner_name: c.name }));
                            setContactSearch(c.name);
                          }
                          setShowContactDropdown(false);
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{c.code}</span>
                          {isSelected && <span className="text-blue-500 text-xs">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                <><Mail className="w-5 h-5 text-blue-600" /> {t('send_via_email') || 'Email orqali yuborish'}</>
              ) : sendMethod === 'whatsapp' ? (
                <><MessageCircle className="w-5 h-5 text-green-600" /> {t('send_via_whatsapp') || 'WhatsApp orqali yuborish'}</>
              ) : (
                <><Link2 className="w-5 h-5 text-slate-600" /> {t('copy_link') || 'Havolani nusxalash'}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAct && `${selectedAct.partner_name} — ${selectedAct.period_start} — ${selectedAct.period_end}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {sendMethod === 'email' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {t('email_address') || 'Email manzil'} *
                  </label>
                  <Input
                    type="email"
                    placeholder="kontragent@example.com"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {t('email_subject') || 'Mavzu'}
                  </label>
                  <Input
                    type="text"
                    value={sendSubject}
                    onChange={(e) => setSendSubject(e.target.value)}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {t('message_body') || 'Xabar matni'}
                  </label>
                  <textarea
                    rows={3}
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder={t('optional_message') || 'Qo\'shimcha xabar (ixtiyoriy)'}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : sendMethod === 'whatsapp' ? (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('phone_number') || 'Telefon raqam'}
                </label>
                <Input
                  type="tel"
                  placeholder="+998901234567"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
            ) : null}

            {/* Result message */}
            {sendResult && !sendResult.error && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <Check className="w-4 h-4" />
                  {sendResult.message}
                </div>
                {sendResult.share_url && (
                  <div className="mt-2 flex items-center gap-2 min-w-0">
                    <Link2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <a href={sendResult.share_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate min-w-0">
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
                {sendResult && !sendResult.error ? (t('close') || 'Yopish') : (t('cancel') || 'Bekor qilish')}
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
