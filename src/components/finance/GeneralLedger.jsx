
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";

export default function GeneralLedger() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    journalEntries,
    createJournalEntry,
    getJournalLines,
    accounts,
    journals,
    isLoading
  } = useFinancials();
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedJournalLines, setSelectedJournalLines] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newEntry, setNewEntry] = useState({
    journal_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
      { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }
    ]
  });

  useEffect(() => {
    setFilteredEntries(journalEntries);
  }, [journalEntries]);

  useEffect(() => {
    let filtered = journalEntries;
    if (searchQuery) {
      filtered = journalEntries.filter(entry =>
        entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.entry_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredEntries(filtered);
  }, [searchQuery, journalEntries]);

  const handleSelectEntry = (entry) => {
    setSelectedEntry(entry);
    const lines = getJournalLines(entry.id);
    setSelectedJournalLines(lines);
  };

  const handleCreateEntry = async () => {
    setIsSaving(true);
    try {
      // Filter out empty lines and validate
      const validLines = newEntry.lines.filter(line =>
        line.account_id && (parseFloat(line.debit_amount) > 0 || parseFloat(line.credit_amount) > 0)
      );

      if (validLines.length < 2) {
        alert(t('minimum_two_lines_required'));
        setIsSaving(false);
        return;
      }

      // Check if balanced
      const totalDebit = validLines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
      const totalCredit = validLines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        alert(t('debits_must_equal_credits'));
        setIsSaving(false);
        return;
      }

      // Split lines that have both debit and credit into two separate backend lines
      const processedLines = [];
      for (const line of validLines) {
        const debit = parseFloat(line.debit_amount) || 0;
        const credit = parseFloat(line.credit_amount) || 0;
        if (debit > 0 && credit > 0) {
          // Split into two lines with the same account
          processedLines.push({
            account_id: line.account_id,
            description: line.description || '',
            debit_amount: debit,
            credit_amount: 0
          });
          processedLines.push({
            account_id: line.account_id,
            description: line.description || '',
            debit_amount: 0,
            credit_amount: credit
          });
        } else if (debit > 0 || credit > 0) {
          processedLines.push({
            account_id: line.account_id,
            description: line.description || '',
            debit_amount: debit,
            credit_amount: credit
          });
        }
      }

      if (processedLines.length < 2) {
        alert(t('minimum_two_lines_required'));
        setIsSaving(false);
        return;
      }

      const entryData = {
        journal_id: newEntry.journal_id,
        entry_date: newEntry.entry_date,
        description: newEntry.description,
        reference: newEntry.reference,
        lines: processedLines
      };

      await createJournalEntry(entryData);

      // Reset form and close modal
      setNewEntry({
        journal_id: '',
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        lines: [
          { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
          { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }
        ]
      });

      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating journal entry:', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to create journal entry';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const addLine = () => {
    setNewEntry(prev => ({
      ...prev,
      lines: [...prev.lines, { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }]
    }));
  };

  const removeLine = (index) => {
    if (newEntry.lines.length <= 2) return; // Keep minimum 2 lines
    setNewEntry(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateLine = (index, field, value) => {
    setNewEntry(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    }));
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
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    const icons = {
      posted: CheckCircle,
      draft: Clock,
      reversed: AlertCircle
    };
    const Icon = icons[status] || Clock;
    return <Icon className="w-3 h-3" />;
  };

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
                    onClick={() => setShowCreateModal(true)}
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
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  >
                    <Plus className="w-4 h-4 mr-2" /> {t('create_first_entry')}
                  </Button>
                )}
              </div>
            ) : (
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
                      <TableHead className="font-semibold text-slate-700">{t('journal')} #</TableHead>
                      <TableHead className="font-semibold text-slate-700">{t('description')}</TableHead>
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
                    {filteredEntries.map(entry => (
                      <TableRow 
                        key={entry.id} 
                        onClick={() => handleSelectEntry(entry)} 
                        className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${
                          selectedEntry?.id === entry.id ? 'bg-blue-50 border-l-4 border-[var(--genix-blue)]' : ''
                        }`}
                      >
                        <TableCell className="font-medium text-slate-700">
                          {entry.entry_date ? format(new Date(entry.entry_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-600">{entry.entry_number}</TableCell>
                        <TableCell className="text-slate-700">{entry.description}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(entry.total_debit || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(entry.status)} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(entry.status)}
                            {entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                    <Badge className={getStatusColor(selectedEntry.status)}>
                      {selectedEntry.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">{t('date')}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedEntry.entry_date ? format(new Date(selectedEntry.entry_date), 'MMM dd, yyyy') : '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">{t('total')}</p>
                      <p className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(selectedEntry.total_debit || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Journal Lines */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[var(--genix-blue)]" />
                    {t('journal_lines')}
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedJournalLines.length > 0 ? (
                      selectedJournalLines.map(line => (
                        <div key={line.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-700 flex-1 pr-2">{line.description}</p>
                          </div>
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
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{t('total')} {t('debit')}/{t('credit')}</span>
                    <span className="text-lg font-bold text-[var(--genix-blue)] tabular-nums">
                      {formatCurrency(selectedEntry.total_debit || 0)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 text-sm">
                    {t('edit')}
                  </Button>
                  <Button variant="outline" className="flex-1 text-sm">
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

      {/* Create Journal Entry Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create')} {t('journal_entries')}
            </DialogTitle>
            <DialogDescription>
              {t('create_journal_entry_description')}
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
                {t('description')}
              </label>
              <Input
                placeholder={t('enter_journal_description')}
                value={newEntry.description}
                onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
              />
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
                          <Select
                            value={line.account_id}
                            onValueChange={(value) => updateLine(index, 'account_id', value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={t('select_account')} />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                            type="number"
                            placeholder="0.00"
                            value={line.debit_amount || ''}
                            onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            className="h-9 text-right"
                            type="number"
                            placeholder="0.00"
                            value={line.credit_amount || ''}
                            onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
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
                      <TableCell className="text-right">
                        {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Balance indicator */}
            <div className={`p-3 rounded-lg ${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-sm ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                {isBalanced ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {t('entry_is_balanced')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {t('debits_must_equal_credits')} ({t('difference')}: {Math.abs(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateEntry}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !newEntry.journal_id || !newEntry.entry_date || !isBalanced}
              >
                {isSaving ? t('saving') : t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
