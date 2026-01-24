
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";

export default function GeneralLedger() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    journalEntries,
    createJournalEntry,
    getJournalLines,
    isLoading
  } = useFinancials();
  const { canCreate } = usePermissions();

  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedJournalLines, setSelectedJournalLines] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newEntry, setNewEntry] = useState({
    journal_number: '',
    company_id: 'default',
    posting_date: new Date().toISOString().split('T')[0],
    description: '',
    journal_type: 'manual',
    status: 'draft',
    total_debit: 0,
    total_credit: 0,
    currency: 'USD'
  });

  useEffect(() => {
    setFilteredEntries(journalEntries);
  }, [journalEntries]);

  useEffect(() => {
    let filtered = journalEntries;
    if (searchQuery) {
      filtered = journalEntries.filter(entry =>
        entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.journal_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredEntries(filtered);
  }, [searchQuery, journalEntries]);

  const handleSelectEntry = (entry) => {
    setSelectedEntry(entry);
    const lines = getJournalLines(entry.id);
    setSelectedJournalLines(lines);
  };

  const handleCreateEntry = () => {
    setIsSaving(true);
    try {
      const entryData = {
        ...newEntry,
        total_debit: parseFloat(newEntry.total_debit) || 0,
        total_credit: parseFloat(newEntry.total_credit) || 0
      };

      createJournalEntry(entryData);

      // Reset form and close modal
      setNewEntry({
        journal_number: '',
        company_id: 'default',
        posting_date: new Date().toISOString().split('T')[0],
        description: '',
        journal_type: 'manual',
        status: 'draft',
        total_debit: 0,
        total_credit: 0,
        currency: 'USD'
      });

      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating journal entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
                          {entry.posting_date ? format(new Date(entry.posting_date), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-600">{entry.journal_number}</TableCell>
                        <TableCell className="text-slate-700">{entry.description}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 tabular-nums">
                          ${(entry.total_debit || 0).toLocaleString()}
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
                      <p className="text-sm text-slate-500 font-mono mt-1">#{selectedEntry.journal_number}</p>
                    </div>
                    <Badge className={getStatusColor(selectedEntry.status)}>
                      {selectedEntry.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">{t('date')}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedEntry.posting_date ? format(new Date(selectedEntry.posting_date), 'MMM dd, yyyy') : '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">{t('total')}</p>
                      <p className="text-sm font-semibold text-slate-900 tabular-nums">
                        ${(selectedEntry.total_debit || 0).toLocaleString()}
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
                                {line.debit_amount > 0 ? `$${line.debit_amount.toLocaleString()}` : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">{t('credit')}</p>
                              <p className="text-sm font-semibold text-red-600 tabular-nums">
                                {line.credit_amount > 0 ? `$${line.credit_amount.toLocaleString()}` : '-'}
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
                      ${(selectedEntry.total_debit || 0).toLocaleString()}
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
                  Click on any entry from the list
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Journal Entry Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create')} {t('journal_entries')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('journal')} # <span className="text-slate-400">({t('optional')})</span>
                </label>
                <Input
                  placeholder={t('auto_generated_if_empty')}
                  value={newEntry.journal_number}
                  onChange={(e) => setNewEntry({...newEntry, journal_number: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('date')} *
                </label>
                <Input
                  type="date"
                  value={newEntry.posting_date}
                  onChange={(e) => setNewEntry({...newEntry, posting_date: e.target.value})}
                  required
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
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('total')} {t('debit')} *
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newEntry.total_debit}
                  onChange={(e) => setNewEntry({...newEntry, total_debit: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('total')} {t('credit')} *
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newEntry.total_credit}
                  onChange={(e) => setNewEntry({...newEntry, total_credit: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>{t('note')}:</strong> {t('debits_must_equal_credits')}. {t('add_detailed_lines_later')}.
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
                disabled={isSaving || !newEntry.description || !newEntry.posting_date}
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
