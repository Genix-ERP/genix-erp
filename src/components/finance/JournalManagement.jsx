import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Trash2, CheckCircle, ArrowLeft, Save, Loader2,
  BookOpen, AlertCircle, ShoppingCart, Package, Landmark, Banknote, FileText, MoreHorizontal, RefreshCw
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCompany } from "@/components/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useAlertModal } from "@/hooks/useAlertModal";
import AlertModal from "@/components/shared/AlertModal";
import financeService from "@/api/services/finance";
import AccountCombobox from "@/components/shared/AccountCombobox";

const JOURNAL_TYPES = [
  { value: 'general', labelKey: 'general', icon: BookOpen, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  { value: 'sales', labelKey: 'sales', icon: ShoppingCart, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'purchase', labelKey: 'purchase', icon: Package, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'cash', labelKey: 'cash', icon: Banknote, color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'bank', labelKey: 'bank', icon: Landmark, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'miscellaneous', labelKey: 'miscellaneous', icon: MoreHorizontal, color: 'bg-teal-100 text-teal-800 border-teal-200' },
];

const getJournalType = (type) => JOURNAL_TYPES.find(jt => jt.value === type) || JOURNAL_TYPES[0];

const PM_CODE_TO_KEY = { CASH: 'cash', BANK: 'bank_transfer', CARD: 'credit_card', CHECK: 'check' };

export default function JournalManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const tPM = (code, fallbackName) => t(PM_CODE_TO_KEY[code]) || fallbackName || code;
  const {
    journals,
    accounts,
    currencies,
    createJournal,
    updateJournal,
    deleteJournal,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { activeCompany } = useCompany();
  const { modal, showError, close } = useAlertModal();

  // List view state
  const [filteredJournals, setFilteredJournals] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Detail view state
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [journalDetail, setJournalDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("entries");
  const [allowedAccounts, setAllowedAccounts] = useState([]);

  // Journal entries for detail view
  const [journalEntries, setJournalEntries] = useState([]);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesTotalPages, setEntriesTotalPages] = useState(1);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  // Payment methods
  const [journalPaymentMethods, setJournalPaymentMethods] = useState([]);
  const [allPaymentMethods, setAllPaymentMethods] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  // Create form
  const [createForm, setCreateForm] = useState({
    code: '', name: '', type: 'miscellaneous', description: '',
    auto_sequence: true, number_prefix: '',
    default_debit_account_id: '', default_credit_account_id: '',
  });

  // Filtering
  useEffect(() => {
    let filtered = journals;
    if (searchQuery) {
      filtered = filtered.filter(j =>
        j.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter(j => j.type === typeFilter);
    }
    setFilteredJournals(filtered);
  }, [searchQuery, typeFilter, journals]);

  const summaryStats = useMemo(() => ({
    total: journals.length,
    active: journals.filter(j => j.is_active).length,
    types: [...new Set(journals.map(j => j.type))].length,
  }), [journals]);

  const generateCodeFromName = (name) => {
    const code = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 20);
    return code || 'JRN';
  };

  // ========== DETAIL VIEW LOGIC ==========

  const openJournalDetail = useCallback(async (journal) => {
    setSelectedJournal(journal);
    setIsLoadingDetail(true);
    setActiveTab("entries");
    setJournalEntries([]);
    setJournalPaymentMethods([]);
    try {
      const detail = await financeService.getJournal(journal.id);
      setJournalDetail(detail);
      setEditForm({
        name: detail.name || '',
        description: detail.description || '',
        short_code: detail.short_code || '',
        currency: detail.currency || '',
        auto_sequence: detail.auto_sequence !== false,
        dedicated_payment_sequence: detail.dedicated_payment_sequence || false,
        auto_check_on_post: detail.auto_check_on_post || false,
        number_prefix: detail.number_prefix || '',
        is_active: detail.is_active !== false,
        default_debit_account_id: detail.default_debit_account_id || '',
        default_credit_account_id: detail.default_credit_account_id || '',
        bank_account_id: detail.bank_account_id || '',
        suspense_account_id: detail.suspense_account_id || '',
        profit_account_id: detail.profit_account_id || '',
        loss_account_id: detail.loss_account_id || '',
        allowed_account_ids: detail.allowed_account_ids || [],
      });
      setAllowedAccounts(detail.allowed_account_ids || []);
      setIsDirty(false);
      // Load journal entries
      loadJournalEntries(journal.id, 1);
      // Load payment methods for bank/cash
      if (detail.type === 'bank' || detail.type === 'cash') {
        loadJournalPaymentMethods(journal.id);
        loadAllPaymentMethods();
        loadBankAccounts();
      }
    } catch (err) {
      console.error('Failed to load journal detail:', err);
      setJournalDetail(journal);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const loadJournalEntries = async (journalId, page) => {
    setIsLoadingEntries(true);
    try {
      const result = await financeService.listJournalEntries({ journal_id: journalId, page, limit: 10 });
      setJournalEntries(result?.items || result || []);
      setEntriesPage(result?.page || page);
      setEntriesTotalPages(result?.total_pages || 1);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    } finally {
      setIsLoadingEntries(false);
    }
  };

  const loadJournalPaymentMethods = async (journalId) => {
    try {
      const result = await financeService.listJournalPaymentMethods(journalId);
      setJournalPaymentMethods(result || []);
    } catch (err) {
      console.error('Failed to load journal payment methods:', err);
    }
  };

  const loadAllPaymentMethods = async () => {
    try {
      const result = await financeService.listPaymentMethods();
      setAllPaymentMethods(result || []);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const result = await financeService.listBankAccounts();
      setBankAccounts(result || []);
    } catch (err) {
      console.error('Failed to load bank accounts:', err);
    }
  };

  const handleUpdateField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedJournal || !isDirty) return;
    setIsSaving(true);
    try {
      await updateJournal(selectedJournal.id, editForm);
      // Reload detail
      const detail = await financeService.getJournal(selectedJournal.id);
      setJournalDetail(detail);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save journal:', err);
      const errorMsg = err.response?.data?.error?.message || err.message || 'Failed to save';
      showError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPaymentMethod = async (direction, pmId) => {
    if (!selectedJournal || !pmId) return;
    const pm = allPaymentMethods.find(p => p.id === pmId);
    if (!pm) return;
    try {
      await financeService.addJournalPaymentMethod(selectedJournal.id, {
        payment_method_id: pm.id,
        direction,
        name: pm.name,
      });
      loadJournalPaymentMethods(selectedJournal.id);
    } catch (err) {
      console.error('Failed to add payment method:', err);
    }
  };

  const getAvailablePMs = (direction) => {
    const linked = new Set(journalPaymentMethods.filter(pm => pm.direction === direction).map(pm => pm.payment_method_id));
    return allPaymentMethods.filter(pm => !linked.has(pm.id));
  };

  const handleUpdatePMAccount = async (pmId, accountId) => {
    if (!selectedJournal) return;
    try {
      await financeService.updateJournalPaymentMethod(selectedJournal.id, pmId, {
        outstanding_account_id: accountId || null,
      });
      loadJournalPaymentMethods(selectedJournal.id);
    } catch (err) {
      console.error('Failed to update payment method account:', err);
    }
  };

  const handleRemovePaymentMethod = async (pmId) => {
    if (!selectedJournal) return;
    try {
      await financeService.removeJournalPaymentMethod(selectedJournal.id, pmId);
      setJournalPaymentMethods(prev => prev.filter(pm => pm.id !== pmId));
    } catch (err) {
      console.error('Failed to remove payment method:', err);
    }
  };

  // ========== CREATE LOGIC ==========

  const resetCreateForm = () => {
    setCreateForm({
      code: '', name: '', type: 'miscellaneous', description: '',
      auto_sequence: true, number_prefix: '',
      default_debit_account_id: '', default_credit_account_id: '',
    });
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const result = await createJournal({ ...createForm, organization_id: activeCompany?.id });
      resetCreateForm();
      setShowCreateModal(false);
      if (result?.id) {
        openJournalDetail(result);
      }
    } catch (error) {
      const rawMsg = error.response?.data?.error?.message || error.message || '';
      const errorMsg = rawMsg.toLowerCase().includes('already exists')
        ? t('journal_code_exists')
        : rawMsg || t('failed_to_create_journal') || 'Failed to create journal';
      showError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (journal, e) => {
    if (e) e.stopPropagation();
    setSelectedForDelete(journal);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await deleteJournal(selectedForDelete.id);
      if (selectedJournal?.id === selectedForDelete.id) {
        setSelectedJournal(null);
        setJournalDetail(null);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to delete journal';
      showError(errorMsg);
    } finally {
      setIsSaving(false);
      setShowDeleteModal(false);
      setSelectedForDelete(null);
    }
  };

  const isBankOrCash = (type) => type === 'bank' || type === 'cash';

  // ========== DETAIL VIEW ==========
  if (selectedJournal) {
    const detail = journalDetail || selectedJournal;
    const jt = getJournalType(detail.type);
    const TypeIcon = jt.icon;

    return (
      <div className="space-y-4">
        {/* Odoo-style Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedJournal(null); setJournalDetail(null); setIsDirty(false); }}
                className="shrink-0 text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t('back_to_journals')}
              </Button>
              <div className="h-5 w-px bg-slate-200 shrink-0" />
              <div className="flex-1 min-w-0">
                {canUpdate(MODULES.FINANCIALS) ? (
                  <Input
                    value={editForm.name}
                    onChange={(e) => handleUpdateField('name', e.target.value)}
                    className="text-2xl font-bold border-0 border-b border-transparent hover:border-slate-300 focus:border-[var(--genix-blue)] rounded-none px-0 h-auto py-0.5 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
                    disabled={!canUpdate(MODULES.FINANCIALS)}
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-slate-900 truncate">{editForm.name}</h1>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={jt.color + ' flex items-center gap-1 text-xs'}>
                    <TypeIcon className="w-3 h-3" />
                    {t(jt.labelKey)}
                  </Badge>
                  {activeCompany?.name && (
                    <span className="text-xs text-slate-500">{activeCompany.name}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {journalDetail?.entry_count > 0 && (
                <Button variant="outline" size="sm" onClick={() => setActiveTab('entries')}
                  className="text-[var(--genix-blue)] border-[var(--genix-blue)]/30 hover:bg-[var(--genix-blue)]/5 text-xs">
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  {journalDetail.entry_count} {t('journal_entries_tab')}
                </Button>
              )}
              <Badge className={editForm.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                {editForm.is_active ? t('active') : t('inactive')}
              </Badge>
              {isDirty && canUpdate(MODULES.FINANCIALS) && (
                <Button size="sm" onClick={handleSave} disabled={isSaving}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t('save_changes')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-500">{t('loading')}</span>
          </div>
        ) : (
          <>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white border border-slate-200">
                <TabsTrigger value="entries" className="data-[state=active]:bg-[var(--genix-blue)]/10">
                  {t('journal_entries_tab')}
                </TabsTrigger>
                {isBankOrCash(detail.type) && (
                  <>
                    <TabsTrigger value="incoming" className="data-[state=active]:bg-[var(--genix-blue)]/10">
                      {t('incoming_payments')}
                    </TabsTrigger>
                    <TabsTrigger value="outgoing" className="data-[state=active]:bg-[var(--genix-blue)]/10">
                      {t('outgoing_payments')}
                    </TabsTrigger>
                  </>
                )}
                <TabsTrigger value="settings" className="data-[state=active]:bg-[var(--genix-blue)]/10">
                  {t('advanced_settings')}
                </TabsTrigger>
              </TabsList>

              {/* Tab: Journal Entries */}
              <TabsContent value="entries" className="space-y-4 mt-4">
                {/* Accounting Information — Odoo style */}
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="p-6">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">
                      {t('accounting_information')}
                    </h4>

                    {/* Bank / Cash accounts */}
                    {isBankOrCash(detail.type) && (
                      <div className="space-y-4">
                        {detail.type === 'bank' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                            <label className="text-sm font-medium text-slate-700 md:pt-2.5">{t('bank_account')}</label>
                            <div className="md:col-span-2">
                              <Select
                                value={editForm.bank_account_id || 'none'}
                                onValueChange={(v) => handleUpdateField('bank_account_id', v === 'none' ? '' : v)}
                                disabled={!canUpdate(MODULES.FINANCIALS)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t('none')}</SelectItem>
                                  {bankAccounts.map(ba => (
                                    <SelectItem key={ba.id} value={ba.id}>{ba.bank_name} - {ba.account_number}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                          <label className="text-sm font-medium text-slate-700 md:pt-2.5 flex items-center gap-1">
                            {t('suspense_account')}
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold cursor-help" title={t('suspense_account_help') || 'Temporarily holds transactions until reconciled'}>?</span>
                          </label>
                          <div className="md:col-span-2">
                            <AccountCombobox
                              accounts={(accounts || []).filter(a => a.is_active !== false)}
                              value={editForm.suspense_account_id}
                              onValueChange={(v) => handleUpdateField('suspense_account_id', v)}
                              allowNone
                              noneLabel={t('none')}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                          <label className="text-sm font-medium text-slate-700 md:pt-2.5 flex items-center gap-1">
                            {t('profit_account')}
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold cursor-help" title={t('profit_account_help') || 'Account used when a difference gain is recognized'}>?</span>
                          </label>
                          <div className="md:col-span-2">
                            <AccountCombobox
                              accounts={(accounts || []).filter(a => a.is_active !== false)}
                              value={editForm.profit_account_id}
                              onValueChange={(v) => handleUpdateField('profit_account_id', v)}
                              allowNone
                              noneLabel={t('none')}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                          <label className="text-sm font-medium text-slate-700 md:pt-2.5 flex items-center gap-1">
                            {t('loss_account')}
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold cursor-help" title={t('loss_account_help') || 'Account used when a difference loss is recognized'}>?</span>
                          </label>
                          <div className="md:col-span-2">
                            <AccountCombobox
                              accounts={(accounts || []).filter(a => a.is_active !== false)}
                              value={editForm.loss_account_id}
                              onValueChange={(v) => handleUpdateField('loss_account_id', v)}
                              allowNone
                              noneLabel={t('none')}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Non bank/cash accounts */}
                    {!isBankOrCash(detail.type) && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                          <label className="text-sm font-medium text-slate-700 md:pt-2.5">
                            {detail.type === 'sales' ? t('default_receivable_account') : detail.type === 'purchase' ? t('default_expense_account') : t('default_debit_account')}
                          </label>
                          <div className="md:col-span-2">
                            <AccountCombobox
                              accounts={(accounts || []).filter(a => a.is_active !== false)}
                              value={editForm.default_debit_account_id}
                              onValueChange={(v) => handleUpdateField('default_debit_account_id', v)}
                              allowNone
                              noneLabel={t('none')}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                          <label className="text-sm font-medium text-slate-700 md:pt-2.5">
                            {detail.type === 'sales' ? t('default_income_account') : detail.type === 'purchase' ? t('default_payable_account') : t('default_credit_account')}
                          </label>
                          <div className="md:col-span-2">
                            <AccountCombobox
                              accounts={(accounts || []).filter(a => a.is_active !== false)}
                              value={editForm.default_credit_account_id}
                              onValueChange={(v) => handleUpdateField('default_credit_account_id', v)}
                              allowNone
                              noneLabel={t('none')}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dedicated Payment Sequence, Short Code, Currency — shown for all types */}
                    <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-center">
                        <label className="text-sm font-medium text-slate-700">{t('dedicated_payment_sequence') || 'Dedicated Payment Sequence'}</label>
                        <div className="md:col-span-2 flex items-center gap-2">
                          <Switch
                            checked={editForm.dedicated_payment_sequence || false}
                            onCheckedChange={(checked) => handleUpdateField('dedicated_payment_sequence', checked)}
                            disabled={!canUpdate(MODULES.FINANCIALS)}
                          />
                          <span className="text-xs text-slate-500">{t('dedicated_payment_sequence_help') || 'Check this if you want to keep a different sequence for payments'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                        <label className="text-sm font-medium text-slate-700 md:pt-2.5">{t('short_code')}</label>
                        <div className="md:col-span-2">
                          <Input
                            value={editForm.short_code}
                            onChange={(e) => handleUpdateField('short_code', e.target.value.toUpperCase())}
                            maxLength={10}
                            placeholder="e.g. BNK1"
                            disabled={!canUpdate(MODULES.FINANCIALS)}
                            className="max-w-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                        <label className="text-sm font-medium text-slate-700 md:pt-2.5">{t('currency')}</label>
                        <div className="md:col-span-2">
                          <Select
                            value={editForm.currency || '_none'}
                            onValueChange={v => handleUpdateField('currency', v === '_none' ? '' : v)}
                            disabled={!canUpdate(MODULES.FINANCIALS)}
                          >
                            <SelectTrigger className="max-w-xs">
                              <SelectValue placeholder={t('select_currency') || 'Select currency'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">—</SelectItem>
                              {(currencies || []).map(c => (
                                <SelectItem key={c.id} value={c.code}>{c.code} — {c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Journal Entries Table */}
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {t('journal_entries_tab')} {journalDetail?.entry_count > 0 && `(${journalDetail.entry_count})`}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingEntries ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : journalEntries.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        {t('no_entries_for_journal')}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs font-semibold">{t('entry_number')}</TableHead>
                            <TableHead className="text-xs font-semibold">{t('date')}</TableHead>
                            <TableHead className="text-xs font-semibold">{t('reference')}</TableHead>
                            <TableHead className="text-xs font-semibold">{t('description')}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{t('debit')}</TableHead>
                            <TableHead className="text-xs font-semibold text-right">{t('credit')}</TableHead>
                            <TableHead className="text-xs font-semibold text-center">{t('status')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {journalEntries.map(entry => (
                            <TableRow key={entry.id} className="hover:bg-blue-50/50">
                              <TableCell className="font-mono text-sm">{entry.entry_number}</TableCell>
                              <TableCell className="text-sm">{entry.entry_date?.split('T')[0]}</TableCell>
                              <TableCell className="text-sm text-slate-600">{entry.reference || '-'}</TableCell>
                              <TableCell className="text-sm">{entry.description || '-'}</TableCell>
                              <TableCell className="text-sm text-right font-mono">{entry.total_debit?.toLocaleString()}</TableCell>
                              <TableCell className="text-sm text-right font-mono">{entry.total_credit?.toLocaleString()}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={entry.status === 'posted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                  {t(entry.status) || entry.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    {entriesTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 p-3 border-t border-slate-200">
                        <Button variant="outline" size="sm" disabled={entriesPage <= 1}
                          onClick={() => loadJournalEntries(selectedJournal.id, entriesPage - 1)}>
                          &lt;
                        </Button>
                        <span className="text-sm text-slate-500">{entriesPage} / {entriesTotalPages}</span>
                        <Button variant="outline" size="sm" disabled={entriesPage >= entriesTotalPages}
                          onClick={() => loadJournalEntries(selectedJournal.id, entriesPage + 1)}>
                          &gt;
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Incoming Payments */}
              {isBankOrCash(detail.type) && (
                <TabsContent value="incoming" className="mt-4">
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs font-semibold">{t('payment_method') || 'Payment Method'}</TableHead>
                            <TableHead className="text-xs font-semibold">{t('name')}</TableHead>
                            <TableHead className="text-xs font-semibold">{t('outstanding_receipts_account')}</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {journalPaymentMethods.filter(pm => pm.direction === 'inbound').map(pm => (
                            <TableRow key={pm.id}>
                              <TableCell className="text-sm">{tPM(pm.pm_code, pm.pm_name)}</TableCell>
                              <TableCell className="text-sm">{pm.name || tPM(pm.pm_code, pm.pm_name)}</TableCell>
                              <TableCell>
                                {canUpdate(MODULES.FINANCIALS) ? (
                                  <Select
                                    value={pm.outstanding_account_id || '_none'}
                                    onValueChange={v => handleUpdatePMAccount(pm.id, v === '_none' ? null : v)}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder={t('select_account') || 'Select account'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_none">—</SelectItem>
                                      {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.code} {acc.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-sm text-slate-600">{pm.account_name || '—'}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {canUpdate(MODULES.FINANCIALS) && (
                                  <Button variant="ghost" size="sm" onClick={() => handleRemovePaymentMethod(pm.id)}
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {journalPaymentMethods.filter(pm => pm.direction === 'inbound').length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-sm text-slate-400 py-4">
                                —
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {canUpdate(MODULES.FINANCIALS) && getAvailablePMs('inbound').length > 0 && (
                        <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                          <Select key={`add-in-${journalPaymentMethods.length}`} onValueChange={v => handleAddPaymentMethod('inbound', v)}>
                            <SelectTrigger className="w-auto h-8 text-sm text-blue-600 border-dashed">
                              <div className="flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                {t('add_a_line') || 'Add a line'}
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailablePMs('inbound').map(pm => (
                                <SelectItem key={pm.id} value={pm.id}>{tPM(pm.code, pm.name)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Tab: Outgoing Payments */}
              {isBankOrCash(detail.type) && (
                <TabsContent value="outgoing" className="mt-4">
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs font-semibold">{t('payment_method') || 'Payment Method'}</TableHead>
                            <TableHead className="text-xs font-semibold">{t('name')}</TableHead>
                            <TableHead className="text-xs font-semibold">{t('outstanding_payments_account')}</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {journalPaymentMethods.filter(pm => pm.direction === 'outbound').map(pm => (
                            <TableRow key={pm.id}>
                              <TableCell className="text-sm">{tPM(pm.pm_code, pm.pm_name)}</TableCell>
                              <TableCell className="text-sm">{pm.name || tPM(pm.pm_code, pm.pm_name)}</TableCell>
                              <TableCell>
                                {canUpdate(MODULES.FINANCIALS) ? (
                                  <Select
                                    value={pm.outstanding_account_id || '_none'}
                                    onValueChange={v => handleUpdatePMAccount(pm.id, v === '_none' ? null : v)}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder={t('select_account') || 'Select account'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_none">—</SelectItem>
                                      {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.code} {acc.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-sm text-slate-600">{pm.account_name || '—'}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {canUpdate(MODULES.FINANCIALS) && (
                                  <Button variant="ghost" size="sm" onClick={() => handleRemovePaymentMethod(pm.id)}
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {journalPaymentMethods.filter(pm => pm.direction === 'outbound').length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-sm text-slate-400 py-4">
                                —
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {canUpdate(MODULES.FINANCIALS) && getAvailablePMs('outbound').length > 0 && (
                        <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                          <Select key={`add-out-${journalPaymentMethods.length}`} onValueChange={v => handleAddPaymentMethod('outbound', v)}>
                            <SelectTrigger className="w-auto h-8 text-sm text-blue-600 border-dashed">
                              <div className="flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                {t('add_a_line') || 'Add a line'}
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailablePMs('outbound').map(pm => (
                                <SelectItem key={pm.id} value={pm.id}>{tPM(pm.code, pm.name)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Tab: Advanced Settings */}
              <TabsContent value="settings" className="mt-4 space-y-4">
                {/* Control-Access section */}
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="p-6 space-y-5">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                      {t('control_access') || 'Control-Access'}
                    </h4>
                    <p className="text-xs text-slate-400 -mt-3">{t('control_access_hint') || 'Keep empty for no control'}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                      <label className="text-sm font-medium text-slate-700 md:pt-2.5">{t('allowed_accounts') || 'Allowed Accounts'}</label>
                      <div className="md:col-span-2">
                        <Select
                          value="none"
                          onValueChange={(v) => {
                            if (v !== 'none' && !allowedAccounts.includes(v)) {
                              const updated = [...allowedAccounts, v];
                              setAllowedAccounts(updated);
                              handleUpdateField('allowed_account_ids', updated);
                            }
                          }}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('add_allowed_account') || 'Add an account...'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('select_account')}</SelectItem>
                            {(accounts || []).filter(a => a.is_active !== false && !allowedAccounts.includes(a.id)).map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {allowedAccounts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {allowedAccounts.map(accId => {
                              const acc = (accounts || []).find(a => a.id === accId);
                              return acc ? (
                                <span key={accId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                                  {acc.code} {acc.name}
                                  {canUpdate(MODULES.FINANCIALS) && (
                                    <button onClick={() => {
                                      const updated = allowedAccounts.filter(id => id !== accId);
                                      setAllowedAccounts(updated);
                                      handleUpdateField('allowed_account_ids', updated);
                                    }} className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
                                  )}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-center">
                      <label className="text-sm font-medium text-slate-700">{t('auto_check_on_post') || 'Auto-Check on Post'}</label>
                      <div className="md:col-span-2">
                        <Switch
                          checked={editForm.auto_check_on_post || false}
                          onCheckedChange={(checked) => handleUpdateField('auto_check_on_post', checked)}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Other settings */}
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="p-6 space-y-5">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                      {t('other_settings') || 'Other Settings'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                      <label className="text-sm font-medium text-slate-700 md:pt-2.5">{t('number_prefix')}</label>
                      <div className="md:col-span-2">
                        <Input
                          value={editForm.number_prefix}
                          onChange={(e) => handleUpdateField('number_prefix', e.target.value)}
                          maxLength={10}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                          className="max-w-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
                      <label className="text-sm font-medium text-slate-700 md:pt-2.5">{t('description')}</label>
                      <div className="md:col-span-2">
                        <Input
                          value={editForm.description}
                          onChange={(e) => handleUpdateField('description', e.target.value)}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-center">
                      <label className="text-sm font-medium text-slate-700">{t('auto_sequence')}</label>
                      <div className="md:col-span-2 flex items-center gap-2">
                        <Switch
                          checked={editForm.auto_sequence}
                          onCheckedChange={(checked) => handleUpdateField('auto_sequence', checked)}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                        <span className="text-xs text-slate-500">{t('auto_number_entries')}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-center">
                      <label className="text-sm font-medium text-slate-700">{t('active')}</label>
                      <div className="md:col-span-2 flex items-center gap-2">
                        <Switch
                          checked={editForm.is_active}
                          onCheckedChange={(checked) => handleUpdateField('is_active', checked)}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                        <span className="text-xs text-slate-500">{t('can_be_used_in_transactions')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        <AlertModal modal={modal} close={close} />
      </div>
    );
  }

  // ========== LIST VIEW ==========
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_journals')}</p>
                <p className="text-2xl font-bold text-slate-900">{summaryStats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('active')}</p>
                <p className="text-2xl font-bold text-green-600">{summaryStats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('journal_types')}</p>
                <p className="text-2xl font-bold text-purple-600">{summaryStats.types}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Journals Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[var(--genix-blue)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('journals')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredJournals.length} {t('journals_configured')}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_journals')}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px] bg-slate-50">
                  <SelectValue placeholder={t('journal_type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types')}</SelectItem>
                  {JOURNAL_TYPES.map(jt => (
                    <SelectItem key={jt.value} value={jt.value}>
                      {t(jt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_journal')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">{t('loading')}</p>
              </div>
            </div>
          ) : filteredJournals.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? t('no_journals_found') : t('no_journals_configured')}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery ? t('try_adjusting_search') : t('setup_journals')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700">{t('code')}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('name')}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('type')}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('short_code')}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('default_account')}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJournals.map(journal => {
                    const jt = getJournalType(journal.type);
                    const TypeIcon = jt.icon;
                    return (
                      <TableRow
                        key={journal.id}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                        onClick={() => openJournalDetail(journal)}
                      >
                        <TableCell className="font-mono text-sm font-medium text-slate-700">
                          {journal.code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{journal.name}</p>
                            {journal.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{journal.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${jt.color} flex items-center gap-1 w-fit`}>
                            <TypeIcon className="w-3 h-3" />
                            {t(jt.labelKey)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-500">
                          {journal.short_code || '-'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const debitAcc = journal.default_debit_account_id
                              ? (accounts || []).find(a => a.id === journal.default_debit_account_id) : null;
                            const creditAcc = journal.default_credit_account_id
                              ? (accounts || []).find(a => a.id === journal.default_credit_account_id) : null;
                            if (debitAcc && creditAcc && debitAcc.id === creditAcc.id) {
                              return <span className="text-sm text-slate-700">{debitAcc.code} {debitAcc.name}</span>;
                            }
                            if (!debitAcc && !creditAcc) {
                              return <span className="text-sm text-slate-400">—</span>;
                            }
                            return (
                              <div className="space-y-0.5">
                                {debitAcc && <div className="text-sm text-slate-700">{debitAcc.code} {debitAcc.name}</div>}
                                {creditAcc && <div className="text-sm text-slate-700">{creditAcc.code} {creditAcc.name}</div>}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={journal.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }>
                            {journal.is_active ? t('active') : t('inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            {canDelete(MODULES.FINANCIALS) && (
                              <Button variant="ghost" size="sm" onClick={(e) => handleDeleteClick(journal, e)} className="h-8 w-8 p-0">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Journal Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create_journal')}
            </DialogTitle>
            <DialogDescription>
              {t('create_journal_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('journal_type')} *</label>
              <Select value={createForm.type} onValueChange={(value) => setCreateForm({...createForm, type: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOURNAL_TYPES.map(jt => {
                    const Icon = jt.icon;
                    return (
                      <SelectItem key={jt.value} value={jt.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {t(jt.labelKey)}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name')} *</label>
              <Input
                value={createForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setCreateForm(prev => ({...prev, name, code: generateCodeFromName(name)}));
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description')}</label>
              <Input
                placeholder={t('optional')}
                value={createForm.description}
                onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {createForm.type === 'sales' ? t('default_income_account')
                  : createForm.type === 'purchase' ? t('default_expense_account')
                  : createForm.type === 'bank' || createForm.type === 'cash' ? t('default_account')
                  : t('default_account')}
                {(createForm.type === 'cash' || createForm.type === 'bank') && <span className="text-red-500"> *</span>}
              </label>
              <AccountCombobox
                accounts={(accounts || []).filter(acc => {
                  if (createForm.type === 'cash') return acc.code?.startsWith('1000');
                  if (createForm.type === 'bank') return acc.code?.startsWith('1010');
                  return true;
                })}
                value={createForm.default_debit_account_id}
                onValueChange={(value) => setCreateForm({...createForm, default_debit_account_id: value, default_credit_account_id: value})}
                placeholder={t('select_account')}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1" disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !createForm.name || ((createForm.type === 'cash' || createForm.type === 'bank') && !createForm.default_debit_account_id)}
            >
              {isSaving ? t('saving') : t('create_journal')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('delete_journal')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('confirm_delete_journal')}{' '}
              <span className="font-semibold text-slate-900">"{selectedForDelete?.name}"</span>?
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{t('journal_has_entries_warning')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1" disabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={isSaving}>
                <Trash2 className="w-4 h-4 mr-2" />
                {isSaving ? t('deleting') : t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal modal={modal} close={close} />
    </div>
  );
}
