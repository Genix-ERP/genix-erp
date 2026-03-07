
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, Trash2, Pencil, Download, Loader2, ChevronLeft, ChevronRight, RotateCcw, XCircle, Send, ArrowLeftRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAlertModal } from "@/hooks/useAlertModal";
import AlertModal from "@/components/shared/AlertModal";
import AccountCombobox from "@/components/shared/AccountCombobox";
import { MODULES } from "@/config/permissions";
import financeService from "@/api/services/finance";
import { generateDocumentPDF } from "@/components/shared/DocumentPrint";

export default function GeneralLedger() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    journalEntries,
    createJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    cancelJournalEntry,
    postJournalEntry,
    reverseJournalEntry,
    getJournalLines,
    accounts,
    journals,
    isLoading
  } = useFinancials();
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const { modal, showAlert, showError, showSuccess, close } = useAlertModal();

  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedJournalLines, setSelectedJournalLines] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Reverse modal state
  const [reverseDate, setReverseDate] = useState(new Date().toISOString().split('T')[0]);
  const [reverseReason, setReverseReason] = useState('');

  const defaultJournalId = journals.find(j => j.code === 'MISC')?.id || journals.find(j => j.code === 'GEN')?.id || journals[0]?.id || '';

  const emptyEntry = {
    journal_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    tags: [],
    lines: [
      { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
      { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }
    ]
  };

  const [newEntry, setNewEntry] = useState(emptyEntry);

  useEffect(() => {
    setFilteredEntries(journalEntries);
  }, [journalEntries]);

  useEffect(() => {
    let filtered = journalEntries;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = journalEntries.filter(entry =>
        entry.description?.toLowerCase().includes(q) ||
        entry.entry_number?.toLowerCase().includes(q) ||
        entry.reference?.toLowerCase().includes(q) ||
        entry.source_type?.toLowerCase().includes(q) ||
        entry.journal?.name?.toLowerCase().includes(q)
      );
    }
    setFilteredEntries(filtered);
    setCurrentPage(1);
  }, [searchQuery, journalEntries]);

  const [isLoadingLines, setIsLoadingLines] = useState(false);

  const handleSelectEntry = async (entry) => {
    setSelectedEntry(entry);
    setSelectedJournalLines([]);
    setIsLoadingLines(true);
    try {
      const fullEntry = await financeService.getJournalEntry(entry.id);
      if (fullEntry) {
        setSelectedEntry(fullEntry);
        setSelectedJournalLines(fullEntry.lines || []);
      } else {
        const lines = getJournalLines(entry.id);
        setSelectedJournalLines(lines);
      }
    } catch (err) {
      console.error('Failed to fetch journal entry lines:', err);
      const lines = getJournalLines(entry.id);
      setSelectedJournalLines(lines);
    } finally {
      setIsLoadingLines(false);
    }
  };

  const processLines = (lines) => {
    const validLines = lines.filter(line =>
      line.account_id && (parseFloat(line.debit_amount) > 0 || parseFloat(line.credit_amount) > 0)
    );

    if (validLines.length < 2) return null;

    const processedLines = [];
    for (const line of validLines) {
      const debit = parseFloat(line.debit_amount) || 0;
      const credit = parseFloat(line.credit_amount) || 0;
      if (debit > 0 && credit > 0) {
        processedLines.push({ account_id: line.account_id, description: line.description || '', debit_amount: debit, credit_amount: 0 });
        processedLines.push({ account_id: line.account_id, description: line.description || '', debit_amount: 0, credit_amount: credit });
      } else if (debit > 0 || credit > 0) {
        processedLines.push({ account_id: line.account_id, description: line.description || '', debit_amount: debit, credit_amount: credit });
      }
    }
    return processedLines.length >= 2 ? processedLines : null;
  };

  const handleCreateEntry = async () => {
    setIsSaving(true);
    try {
      if (!newEntry.description?.trim()) {
        showError(t('description_required') || 'Description is required');
        setIsSaving(false);
        return;
      }

      const processedLines = processLines(newEntry.lines);
      if (!processedLines) {
        showError(t('minimum_two_lines_required'));
        setIsSaving(false);
        return;
      }

      const totalDebitCheck = processedLines.reduce((sum, l) => sum + l.debit_amount, 0);
      const totalCreditCheck = processedLines.reduce((sum, l) => sum + l.credit_amount, 0);
      if (Math.abs(totalDebitCheck - totalCreditCheck) > 0.01) {
        showError(t('debits_must_equal_credits'));
        setIsSaving(false);
        return;
      }

      const entryData = {
        journal_id: newEntry.journal_id,
        entry_date: newEntry.entry_date,
        description: newEntry.description,
        reference: newEntry.reference,
        tags: newEntry.tags?.length ? newEntry.tags : undefined,
        lines: processedLines
      };

      if (editingEntryId) {
        await updateJournalEntry(editingEntryId, entryData);
      } else {
        await createJournalEntry(entryData);
      }

      resetForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error saving journal entry:', error);
      const msg = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Failed to save journal entry';
      showError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewEntry({ ...emptyEntry, journal_id: defaultJournalId });
    setEditingEntryId(null);
  };

  const addLine = () => {
    setNewEntry(prev => ({
      ...prev,
      lines: [...prev.lines, { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }]
    }));
  };

  const removeLine = (index) => {
    if (newEntry.lines.length <= 2) return;
    setNewEntry(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateLine = (index, field, value) => {
    setNewEntry(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => {
        if (i !== index) return line;
        const updated = { ...line, [field]: value };
        if (field === 'debit_amount' && parseFloat(value) > 0) {
          updated.credit_amount = 0;
        } else if (field === 'credit_amount' && parseFloat(value) > 0) {
          updated.debit_amount = 0;
        }
        return updated;
      })
    }));
  };

  const handleEditEntry = () => {
    if (!selectedEntry) return;
    if (selectedEntry.status !== 'draft') {
      showError(t('cannot_edit_posted_entry') || 'Only draft entries can be edited.');
      return;
    }
    setEditingEntryId(selectedEntry.id);
    setNewEntry({
      journal_id: selectedEntry.journal_id || '',
      entry_date: selectedEntry.entry_date ? new Date(selectedEntry.entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: selectedEntry.description || '',
      reference: selectedEntry.reference || '',
      tags: selectedEntry.tags || [],
      lines: selectedJournalLines.length > 0
        ? selectedJournalLines.map(line => ({
            account_id: line.account_id || '',
            description: line.description || '',
            debit_amount: line.debit_amount || 0,
            credit_amount: line.credit_amount || 0,
          }))
        : [
            { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
            { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }
          ]
    });
    setShowCreateModal(true);
  };

  const handlePostEntry = async () => {
    if (!selectedEntry || selectedEntry.status !== 'draft') return;
    setIsActionLoading(true);
    try {
      await postJournalEntry(selectedEntry.id);
      setSelectedEntry(prev => prev ? { ...prev, status: 'posted' } : prev);
      showSuccess(t('entry_posted_successfully') || 'Journal entry posted successfully');
    } catch (error) {
      const msg = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Failed to post entry';
      showError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancelEntry = async () => {
    if (!selectedEntry || selectedEntry.status !== 'draft') return;
    setIsActionLoading(true);
    try {
      await cancelJournalEntry(selectedEntry.id);
      setSelectedEntry(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      showSuccess(t('entry_cancelled_successfully') || 'Journal entry cancelled');
    } catch (error) {
      const msg = error?.response?.data?.error?.message || error?.message || 'Failed to cancel entry';
      showError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!selectedEntry || selectedEntry.status !== 'draft') return;
    setIsActionLoading(true);
    try {
      await deleteJournalEntry(selectedEntry.id);
      setSelectedEntry(null);
      setSelectedJournalLines([]);
      showSuccess(t('entry_deleted_successfully') || 'Journal entry deleted');
    } catch (error) {
      const msg = error?.response?.data?.error?.message || error?.message || 'Failed to delete entry';
      showError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const openReverseModal = () => {
    if (!selectedEntry || selectedEntry.status !== 'posted') return;
    setReverseDate(new Date().toISOString().split('T')[0]);
    setReverseReason('');
    setShowReverseModal(true);
  };

  const handleReverseEntry = async () => {
    if (!selectedEntry) return;
    setIsActionLoading(true);
    try {
      await reverseJournalEntry(selectedEntry.id, {
        date: reverseDate,
        reason: reverseReason
      });
      setShowReverseModal(false);
      setSelectedEntry(null);
      setSelectedJournalLines([]);
      showSuccess(t('reversal_created_successfully') || 'Reversal entry created as draft');
    } catch (error) {
      const msg = error?.response?.data?.error?.message || error?.message || 'Failed to reverse entry';
      showError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleViewPDF = () => {
    if (!selectedEntry) return;
    const lines = selectedJournalLines.map(line => ({
      account: line.account ? `${line.account.code} - ${line.account.name}` : (line.account_code ? `${line.account_code} - ${line.account_name}` : '-'),
      description: line.description || '-',
      debit: line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-',
      credit: line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-',
    }));

    const statusMap = {
      posted: t('posted') || 'Posted',
      draft: t('draft') || 'Draft',
      cancelled: t('cancelled') || 'Cancelled',
      reversed: t('reversed') || 'Reversed',
    };

    const doc = generateDocumentPDF({
      template: 'invoice',
      title: t('journal_entry') || 'Buxgalteriya yozuvi',
      documentNumber: selectedEntry.entry_number,
      documentDate: selectedEntry.entry_date ? format(new Date(selectedEntry.entry_date), 'dd.MM.yyyy') : '',
      dateLabel: t('date') || 'Date',
      headerFields: [
        { label: t('description') || 'Description', value: selectedEntry.description || '-' },
        { label: t('status') || 'Status', value: statusMap[selectedEntry.status] || selectedEntry.status || '-' },
        { label: t('reference') || 'Reference', value: selectedEntry.reference || '-' },
        { label: t('total') || 'Total', value: formatCurrency(selectedEntry.total_debit || 0) },
      ],
      tableColumns: [
        { key: 'account', label: t('account') || 'Account', width: 55 },
        { key: 'description', label: t('description') || 'Description', width: 55 },
        { key: 'debit', label: t('debit') || 'Debit', align: 'right', width: 35 },
        { key: 'credit', label: t('credit') || 'Credit', align: 'right', width: 35 },
      ],
      tableData: lines,
      totals: [
        { label: `${t('total')} ${t('debit')}`, value: formatCurrency(selectedEntry.total_debit || 0), bold: true },
        { label: `${t('total')} ${t('credit')}`, value: formatCurrency(selectedEntry.total_credit || 0), bold: true },
      ],
    });
    doc.save(`${selectedEntry.entry_number || 'journal-entry'}.pdf`);
  };

  // Calculate totals for display
  const totalDebit = newEntry.lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
  const totalCredit = newEntry.lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const getStatusColor = (status) => {
    const colors = {
      posted: "bg-green-100 text-green-800 border-green-200",
      draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
      reversed: "bg-red-100 text-red-800 border-red-200",
      cancelled: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    const icons = {
      posted: CheckCircle,
      draft: Clock,
      reversed: ArrowLeftRight,
      cancelled: XCircle,
    };
    const Icon = icons[status] || Clock;
    return <Icon className="w-3 h-3" />;
  };

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / pageSize);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredEntries.length);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Journal Entries List */}
      <div className="lg:col-span-2">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader className="border-b border-slate-100 pb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[var(--genix-blue)]" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    {t('journal_entries')}
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {filteredEntries.length} {t('entries_total')}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search') + " " + t('journal_entries').toLowerCase() + "..."}
                    className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {canCreate(MODULES.FINANCIALS) && (
                  <Button
                    onClick={() => {
                      resetForm();
                      setNewEntry(prev => ({ ...prev, journal_id: prev.journal_id || defaultJournalId }));
                      setShowCreateModal(true);
                    }}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                  >
                    <Plus className="w-4 h-4 mr-2" /> {t('new_entry')}
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
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {searchQuery ? t('no_results_found') : t('no_journal_entries')}
                </h3>
                <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'Start by creating your first journal entry to track financial transactions'}
                </p>
                {!searchQuery && canCreate(MODULES.FINANCIALS) && (
                  <Button
                    onClick={() => {
                      resetForm();
                      setNewEntry(prev => ({ ...prev, journal_id: prev.journal_id || defaultJournalId }));
                      setShowCreateModal(true);
                    }}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  >
                    <Plus className="w-4 h-4 mr-2" /> {t('create_first_entry')}
                  </Button>
                )}
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {t('date')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('number')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('description')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('journal')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <DollarSign className="w-4 h-4" />
                          {t('total')}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map(entry => (
                      <TableRow
                        key={entry.id}
                        onClick={() => handleSelectEntry(entry)}
                        className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${
                          selectedEntry?.id === entry.id ? 'bg-blue-50 border-l-4 border-[var(--genix-blue)]' : ''
                        }`}
                      >
                        <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                          {entry.entry_date ? format(new Date(entry.entry_date), 'dd.MM.yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-600 whitespace-nowrap">{entry.entry_number}</TableCell>
                        <TableCell className="text-slate-700 max-w-[250px] truncate">
                          {entry.description || entry.reference || '-'}
                        </TableCell>
                        <TableCell className="text-slate-600 whitespace-nowrap">
                          {entry.journal?.name || '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(entry.total_debit || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge className={`${getStatusColor(entry.reversed_entry_id ? 'reversed' : entry.status)} flex items-center gap-1 w-fit`}>
                              {getStatusIcon(entry.reversed_entry_id ? 'reversed' : entry.status)}
                              {entry.reversed_entry_id ? (t('reversed') || 'reversed') : entry.status}
                            </Badge>
                            {entry.is_reversal && (
                              <Badge variant="outline" className="text-xs">
                                REV
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {filteredEntries.length > pageSize && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <span className="text-sm text-slate-600">
                    {startIndex}-{endIndex} / {filteredEntries.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Journal Details Panel */}
      <div className="lg:col-span-1">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg sticky top-6">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--genix-purple)]" />
              <CardTitle className="text-lg font-bold">
                {t('journal_details')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {selectedEntry ? (
              <div className="space-y-6">
                {/* Entry Header */}
                <div className="pb-4 border-b border-slate-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg text-slate-900 truncate">{selectedEntry.description}</h3>
                      <p className="text-sm text-slate-500 font-mono mt-1">#{selectedEntry.entry_number}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={getStatusColor(selectedEntry.reversed_entry_id ? 'reversed' : selectedEntry.status)}>
                        {selectedEntry.reversed_entry_id ? (t('reversed') || 'reversed') : selectedEntry.status}
                      </Badge>
                      {selectedEntry.is_reversal && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          <RotateCcw className="w-3 h-3 mr-1" />
                          {t('reversal_entry') || 'Teskari yozuv'}
                        </Badge>
                      )}
                      {selectedEntry.reversed_entry_id && !selectedEntry.is_reversal && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                          {t('has_reversal') || 'Teskarilangan'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">{t('date')}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedEntry.entry_date ? format(new Date(selectedEntry.entry_date), 'dd.MM.yyyy') : '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">{t('journal')}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedEntry.journal?.name || '-'}
                      </p>
                    </div>
                    {selectedEntry.reference && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">{t('reference')}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedEntry.reference}
                        </p>
                      </div>
                    )}
                    {selectedEntry.source_type && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">{t('source')}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedEntry.source_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                      </div>
                    )}
                    {selectedEntry.reversal_reason && (
                      <div className="p-3 bg-orange-50 rounded-lg col-span-2">
                        <p className="text-xs text-orange-600 mb-1">{t('reversal_reason') || 'Sabab'}</p>
                        <p className="text-sm font-semibold text-orange-900">{selectedEntry.reversal_reason}</p>
                      </div>
                    )}
                  </div>
                  {/* Tags */}
                  {selectedEntry.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {selectedEntry.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Journal Lines */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[var(--genix-blue)]" />
                    {t('journal_lines')}
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {isLoadingLines ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : selectedJournalLines.length > 0 ? (
                      selectedJournalLines.map(line => (
                        <div key={line.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-700 flex-1 pr-2">
                              {line.account ? `${line.account.code} - ${line.account.name}` : line.description}
                            </p>
                          </div>
                          {line.description && line.account && (
                            <p className="text-xs text-slate-500 mb-2">{line.description}</p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">{t('debit')}</p>
                              <p className="text-sm font-semibold text-green-600 tabular-nums">
                                {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">{t('credit')}</p>
                              <p className="text-sm font-semibold text-red-600 tabular-nums">
                                {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-slate-500">{t('no_lines_found')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="pt-4 border-t-2 border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-600">{t('total')} {t('debit')}</span>
                    <span className="text-sm font-bold text-green-600 tabular-nums">
                      {formatCurrency(selectedEntry.total_debit || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">{t('total')} {t('credit')}</span>
                    <span className="text-sm font-bold text-red-600 tabular-nums">
                      {formatCurrency(selectedEntry.total_credit || 0)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  {/* Draft actions */}
                  {selectedEntry.status === 'draft' && (
                    <>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:opacity-90 text-white"
                          onClick={handlePostEntry}
                          disabled={isActionLoading}
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {t('post') || 'Tasdiqlash'}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 text-sm"
                          onClick={handleEditEntry}
                          disabled={isActionLoading}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          {t('edit')}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 text-sm text-orange-600 border-orange-200 hover:bg-orange-50"
                          onClick={handleCancelEntry}
                          disabled={isActionLoading}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          {t('cancel_entry') || 'Bekor qilish'}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 text-sm text-red-600 border-red-200 hover:bg-red-50"
                          onClick={handleDeleteEntry}
                          disabled={isActionLoading}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          {t('delete')}
                        </Button>
                      </div>
                    </>
                  )}
                  {/* Posted actions */}
                  {selectedEntry.status === 'posted' && !selectedEntry.reversed_entry_id && (
                    <Button
                      variant="outline"
                      className="w-full text-sm text-orange-600 border-orange-200 hover:bg-orange-50"
                      onClick={openReverseModal}
                      disabled={isActionLoading}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      {t('reverse_entry') || 'Teskari yozuv'}
                    </Button>
                  )}
                  {/* Always show PDF */}
                  <Button
                    variant="outline"
                    className="w-full text-sm"
                    onClick={handleViewPDF}
                    disabled={isLoadingLines}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {t('view')} PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  {t('select_entry_details')}
                </h3>
                <p className="text-sm text-slate-500">
                  {t('click_entry_from_list')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Journal Entry Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) { resetForm(); } setShowCreateModal(open); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--genix-blue)]" />
              {editingEntryId ? (t('edit') + ' ' + t('journal_entry')) : (t('create') + ' ' + t('journal_entries'))}
            </DialogTitle>
            <DialogDescription>
              {editingEntryId ? (t('edit_journal_entry_description') || 'Edit the draft journal entry') : (t('create_journal_entry_description'))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('journal')} *
                </label>
                <Select
                  value={newEntry.journal_id}
                  onValueChange={(value) => setNewEntry({...newEntry, journal_id: value})}
                  disabled={!!editingEntryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_journal')} />
                  </SelectTrigger>
                  <SelectContent>
                    {journals.map((journal) => (
                      <SelectItem key={journal.id} value={journal.id}>
                        {journal.code} - {journal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('date')} *
                </label>
                <Input
                  type="date"
                  value={newEntry.entry_date}
                  onChange={(e) => setNewEntry({...newEntry, entry_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('reference')}
                </label>
                <Input
                  placeholder={t('reference')}
                  value={newEntry.reference}
                  onChange={(e) => setNewEntry({...newEntry, reference: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('description')} *
              </label>
              <Input
                placeholder={t('enter_journal_description')}
                value={newEntry.description}
                onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                required
                className={!newEntry.description?.trim() ? 'border-red-300' : ''}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('tags') || 'Teglar'}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t('add_tag') || 'Teg qo\'shing va Enter bosing'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      const tag = e.target.value.trim();
                      if (!newEntry.tags?.includes(tag)) {
                        setNewEntry(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
                      }
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              {newEntry.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {newEntry.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => {
                      setNewEntry(prev => ({ ...prev, tags: prev.tags.filter((_, idx) => idx !== i) }));
                    }}>
                      {tag} &times;
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Journal Lines */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-700">
                  {t('journal_lines')} *
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add_line')}
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">{t('account')}</TableHead>
                      <TableHead className="w-[25%]">{t('description')}</TableHead>
                      <TableHead className="w-[15%] text-right">{t('debit')}</TableHead>
                      <TableHead className="w-[15%] text-right">{t('credit')}</TableHead>
                      <TableHead className="w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newEntry.lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-2">
                          <AccountCombobox
                            accounts={accounts}
                            value={line.account_id}
                            onValueChange={(value) => updateLine(index, 'account_id', value)}
                            placeholder={t('select_account')}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            className="h-9"
                            placeholder={t('description')}
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            className="h-9 text-right"
                            inputMode="decimal"
                            placeholder="0"
                            value={line.debit_amount || ''}
                            onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                updateLine(index, 'debit_amount', val);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            className="h-9 text-right"
                            inputMode="decimal"
                            placeholder="0"
                            value={line.credit_amount || ''}
                            onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                updateLine(index, 'credit_amount', val);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(index)}
                            disabled={newEntry.lines.length <= 2}
                            className="h-9 w-9 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell colSpan={2} className="text-right">
                        {t('total')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Balance indicator */}
            <div className={`p-3 rounded-lg flex items-center justify-between ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm font-medium ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                {isBalanced ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {t('entry_is_balanced')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {t('debits_must_equal_credits')}
                  </span>
                )}
              </p>
              <div className="text-sm tabular-nums">
                <span className="text-green-700 font-medium">Dt: {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="mx-2 text-slate-400">|</span>
                <span className="text-red-700 font-medium">Kt: {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => { resetForm(); setShowCreateModal(false); }}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateEntry}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !newEntry.journal_id || !newEntry.entry_date || !isBalanced || !newEntry.description?.trim()}
              >
                {isSaving ? t('saving') : (editingEntryId ? t('save') : t('create'))}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reverse Entry Modal */}
      <Dialog open={showReverseModal} onOpenChange={setShowReverseModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              {t('reverse_entry') || 'Teskari yozuv yaratish'}
            </DialogTitle>
            <DialogDescription>
              {t('reverse_entry_description') || 'Tasdiqlangan yozuvni bekor qilish uchun teskari yozuv yaratiladi'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">{t('original_entry') || 'Asl yozuv'}</p>
              <p className="text-sm font-semibold text-slate-900">{selectedEntry?.entry_number}</p>
              <p className="text-xs text-slate-500 mt-1">{selectedEntry?.description}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('date')} *
              </label>
              <Input
                type="date"
                value={reverseDate}
                onChange={(e) => setReverseDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('reason') || 'Sabab'}
              </label>
              <Input
                placeholder={t('enter_reversal_reason') || 'Teskari yozuv sababi...'}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
              />
            </div>

            {/* Preview */}
            {selectedJournalLines.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">{t('preview') || 'Natija'}</p>
                <div className="border rounded-lg p-3 bg-orange-50/50 space-y-1">
                  {selectedJournalLines.map((line, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-700">
                        {line.account ? `${line.account.code} - ${line.account.name}` : line.description}
                      </span>
                      <span className="tabular-nums">
                        {line.credit_amount > 0 && <span className="text-green-600">Dt {formatCurrency(line.credit_amount)}</span>}
                        {line.debit_amount > 0 && <span className="text-red-600">Kt {formatCurrency(line.debit_amount)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowReverseModal(false)}
                className="flex-1"
                disabled={isActionLoading}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleReverseEntry}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isActionLoading || !reverseDate}
              >
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                {t('create_reversal') || 'Teskari yozuv yaratish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal modal={modal} close={close} />
    </div>
  );
}
