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

const JOURNAL_TYPES = [
  { value: 'general', labelKey: 'general', icon: BookOpen, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  { value: 'sales', labelKey: 'sales', icon: ShoppingCart, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'purchase', labelKey: 'purchase', icon: Package, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'cash', labelKey: 'cash', icon: Banknote, color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'bank', labelKey: 'bank', icon: Landmark, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'miscellaneous', labelKey: 'miscellaneous', icon: MoreHorizontal, color: 'bg-teal-100 text-teal-800 border-teal-200' },
];

const getJournalType = (type) => JOURNAL_TYPES.find(jt => jt.value === type) || JOURNAL_TYPES[0];

export default function JournalManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    journals,
    accounts,
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
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

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
    return name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 20);
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
        number_prefix: detail.number_prefix || '',
        is_active: detail.is_active !== false,
        default_debit_account_id: detail.default_debit_account_id || '',
        default_credit_account_id: detail.default_credit_account_id || '',
        bank_account_id: detail.bank_account_id || '',
        suspense_account_id: detail.suspense_account_id || '',
        profit_account_id: detail.profit_account_id || '',
        loss_account_id: detail.loss_account_id || '',
      });
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

  const handleAddPaymentMethod = async (direction) => {
    if (!selectedJournal || allPaymentMethods.length === 0) return;
    const firstPM = allPaymentMethods[0];
    try {
      await financeService.addJournalPaymentMethod(selectedJournal.id, {
        payment_method_id: firstPM.id,
        direction,
        name: firstPM.name,
      });
      loadJournalPaymentMethods(selectedJournal.id);
    } catch (err) {
      console.error('Failed to add payment method:', err);
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
    setCodeManuallyEdited(false);
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
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to create journal';
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedJournal(null); setJournalDetail(null); setIsDirty(false); }}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('back_to_journals')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={jt.color + ' flex items-center gap-1'}>
              <TypeIcon className="w-3 h-3" />
              {t(jt.labelKey)}
            </Badge>
            <Badge className={editForm.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
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

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-500">{t('loading')}</span>
          </div>
        ) : (
          <>
            {/* Journal Name & Code Header */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-500 mb-1 block">{t('name')}</label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => handleUpdateField('name', e.target.value)}
                      className="text-xl font-bold bg-transparent border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20"
                      disabled={!canUpdate(MODULES.FINANCIALS)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-500 mb-1 block">{t('type')}</label>
                      <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 rounded-md border border-slate-200">
                        <TypeIcon className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">{t(jt.labelKey)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-500 mb-1 block">{t('code')}</label>
                      <div className="flex items-center h-10 px-3 bg-slate-50 rounded-md border border-slate-200">
                        <span className="text-sm font-mono font-medium">{detail.code}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                {/* Accounting Information */}
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="p-6">
                    <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-4">
                      {t('accounting_information')}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Account fields */}
                      {isBankOrCash(detail.type) ? (
                        <>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                              {detail.type === 'bank' ? t('default_bank_account') : t('default_cash_account')}
                            </label>
                            <Select
                              value={editForm.default_debit_account_id || 'none'}
                              onValueChange={(v) => {
                                const val = v === 'none' ? '' : v;
                                handleUpdateField('default_debit_account_id', val);
                                handleUpdateField('default_credit_account_id', val);
                              }}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t('none')}</SelectItem>
                                {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('suspense_account')}</label>
                            <Select
                              value={editForm.suspense_account_id || 'none'}
                              onValueChange={(v) => handleUpdateField('suspense_account_id', v === 'none' ? '' : v)}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t('none')}</SelectItem>
                                {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('profit_account')}</label>
                            <Select
                              value={editForm.profit_account_id || 'none'}
                              onValueChange={(v) => handleUpdateField('profit_account_id', v === 'none' ? '' : v)}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t('none')}</SelectItem>
                                {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('loss_account')}</label>
                            <Select
                              value={editForm.loss_account_id || 'none'}
                              onValueChange={(v) => handleUpdateField('loss_account_id', v === 'none' ? '' : v)}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t('none')}</SelectItem>
                                {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                              {detail.type === 'sales' ? t('default_receivable_account') : detail.type === 'purchase' ? t('default_expense_account') : t('default_debit_account')}
                            </label>
                            <Select
                              value={editForm.default_debit_account_id || 'none'}
                              onValueChange={(v) => handleUpdateField('default_debit_account_id', v === 'none' ? '' : v)}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t('none')}</SelectItem>
                                {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                              {detail.type === 'sales' ? t('default_income_account') : detail.type === 'purchase' ? t('default_payable_account') : t('default_credit_account')}
                            </label>
                            <Select
                              value={editForm.default_credit_account_id || 'none'}
                              onValueChange={(v) => handleUpdateField('default_credit_account_id', v === 'none' ? '' : v)}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t('none')}</SelectItem>
                                {(accounts || []).filter(a => a.is_active !== false).map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bank Account Number section for bank journals */}
                    {detail.type === 'bank' && (
                      <div className="mt-6 pt-4 border-t border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-4">
                          {t('bank_account')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('bank_account')}</label>
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
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('short_code')}</label>
                            <Input
                              value={editForm.short_code}
                              onChange={(e) => handleUpdateField('short_code', e.target.value.toUpperCase())}
                              maxLength={10}
                              disabled={!canUpdate(MODULES.FINANCIALS)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
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
                              <TableCell className="text-sm">{pm.pm_name}</TableCell>
                              <TableCell className="text-sm">{pm.name || pm.pm_name}</TableCell>
                              <TableCell className="text-sm text-slate-600">{pm.account_name || '-'}</TableCell>
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
                      {canUpdate(MODULES.FINANCIALS) && allPaymentMethods.length > 0 && (
                        <div className="p-3 border-t border-slate-100">
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700"
                            onClick={() => handleAddPaymentMethod('inbound')}>
                            <Plus className="w-3 h-3 mr-1" /> {t('add_a_line')}
                          </Button>
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
                              <TableCell className="text-sm">{pm.pm_name}</TableCell>
                              <TableCell className="text-sm">{pm.name || pm.pm_name}</TableCell>
                              <TableCell className="text-sm text-slate-600">{pm.account_name || '-'}</TableCell>
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
                      {canUpdate(MODULES.FINANCIALS) && allPaymentMethods.length > 0 && (
                        <div className="p-3 border-t border-slate-100">
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700"
                            onClick={() => handleAddPaymentMethod('outbound')}>
                            <Plus className="w-3 h-3 mr-1" /> {t('add_a_line')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Tab: Advanced Settings */}
              <TabsContent value="settings" className="mt-4">
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="p-6 space-y-4">
                    <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                      {t('advanced_settings')}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">{t('short_code')}</label>
                        <Input
                          value={editForm.short_code}
                          onChange={(e) => handleUpdateField('short_code', e.target.value.toUpperCase())}
                          maxLength={10}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">{t('currency')}</label>
                        <Input
                          value={editForm.currency}
                          onChange={(e) => handleUpdateField('currency', e.target.value.toUpperCase())}
                          maxLength={10}
                          placeholder="UZS"
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">{t('number_prefix')}</label>
                        <Input
                          value={editForm.number_prefix}
                          onChange={(e) => handleUpdateField('number_prefix', e.target.value)}
                          maxLength={10}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description')}</label>
                        <Input
                          value={editForm.description}
                          onChange={(e) => handleUpdateField('description', e.target.value)}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{t('auto_sequence')}</p>
                          <p className="text-xs text-slate-500">{t('auto_number_entries')}</p>
                        </div>
                        <Switch
                          checked={editForm.auto_sequence}
                          onCheckedChange={(checked) => handleUpdateField('auto_sequence', checked)}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{t('active')}</p>
                          <p className="text-xs text-slate-500">{t('can_be_used_in_transactions')}</p>
                        </div>
                        <Switch
                          checked={editForm.is_active}
                          onCheckedChange={(checked) => handleUpdateField('is_active', checked)}
                          disabled={!canUpdate(MODULES.FINANCIALS)}
                        />
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('code')} *</label>
                <Input
                  placeholder={t('auto_generated')}
                  value={createForm.code}
                  onChange={(e) => { setCodeManuallyEdited(true); setCreateForm({...createForm, code: e.target.value.toUpperCase()}); }}
                  maxLength={20}
                />
              </div>
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
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name')} *</label>
              <Input
                value={createForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const updates = { name };
                  if (!codeManuallyEdited) { updates.code = generateCodeFromName(name); }
                  setCreateForm(prev => ({...prev, ...updates}));
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
              </label>
              <Select
                value={createForm.default_debit_account_id}
                onValueChange={(value) => setCreateForm({...createForm, default_debit_account_id: value, default_credit_account_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_account')} />
                </SelectTrigger>
                <SelectContent>
                  {(accounts || []).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1" disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !createForm.name || !createForm.code}
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
