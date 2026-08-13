import { formatDate } from '@/utils/formatDate';
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, CheckCircle, Clock, AlertCircle, ArrowUpRight, ArrowDownLeft,
  RefreshCw, FileText, Upload, Trash2, Check, X, Loader2, ChevronLeft
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import financeService from "@/api/services/finance";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAlertModal } from "@/hooks/useAlertModal";
import AlertModal from "@/components/shared/AlertModal";
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

export default function ReconciliationWorkflow({ bankAccount, onClose }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const { modal, showError, close } = useAlertModal();

  const [reconciliations, setReconciliations] = useState([]);
  const [activeReconciliation, setActiveReconciliation] = useState(null);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewReconciliationModal, setShowNewReconciliationModal] = useState(false);

  // Cleared items tracking
  const [clearedBankTransactions, setClearedBankTransactions] = useState(new Set());
  const [clearedJournalEntries, setClearedJournalEntries] = useState(new Set());

  // New reconciliation form
  const [newReconciliation, setNewReconciliation] = useState({
    statement_date: new Date().toISOString().split('T')[0],
    statement_ending_balance: '',
    notes: ''
  });

  // Load reconciliations list
  const loadReconciliations = useCallback(async () => {
    if (!bankAccount?.id) return;
    setIsLoading(true);
    try {
      const data = await financeService.listBankReconciliations(bankAccount.id);
      setReconciliations(data || []);
    } catch (error) {
      console.error('Failed to load reconciliations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [bankAccount?.id]);

  // Load specific reconciliation with details
  const loadReconciliation = useCallback(async (reconciliationId) => {
    if (!bankAccount?.id || !reconciliationId) return;
    setIsLoading(true);
    try {
      const data = await financeService.getBankReconciliation(bankAccount.id, reconciliationId);
      setReconciliationData(data);
      setActiveReconciliation(data.reconciliation);

      // Initialize cleared items from data
      const clearedBankTx = new Set(
        (data.bank_transactions || [])
          .filter(tx => tx.is_reconciled || tx.status === 'reconciled')
          .map(tx => tx.id)
      );
      const clearedJE = new Set(
        (data.journal_entries || [])
          .filter(je => je.is_reconciled)
          .map(je => je.id)
      );
      setClearedBankTransactions(clearedBankTx);
      setClearedJournalEntries(clearedJE);
    } catch (error) {
      console.error('Failed to load reconciliation:', error);
    } finally {
      setIsLoading(false);
    }
  }, [bankAccount?.id]);

  useEffect(() => {
    loadReconciliations();
  }, [loadReconciliations]);

  const handleCreateReconciliation = async () => {
    if (!newReconciliation.statement_ending_balance) return;
    setIsSaving(true);
    try {
      const result = await financeService.createBankReconciliation(bankAccount.id, {
        statement_date: newReconciliation.statement_date,
        statement_ending_balance: parseFloat(newReconciliation.statement_ending_balance),
        notes: newReconciliation.notes
      });
      setShowNewReconciliationModal(false);
      setNewReconciliation({ statement_date: new Date().toISOString().split('T')[0], statement_ending_balance: '', notes: '' });
      await loadReconciliations();
      // Open the newly created reconciliation
      loadReconciliation(result.id);
    } catch (error) {
      console.error('Failed to create reconciliation:', error);
      showError(error.response?.data?.error?.message || 'Failed to create reconciliation');
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBankTransaction = (txId) => {
    setClearedBankTransactions(prev => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  };

  const handleToggleJournalEntry = (jeId) => {
    setClearedJournalEntries(prev => {
      const next = new Set(prev);
      if (next.has(jeId)) {
        next.delete(jeId);
      } else {
        next.add(jeId);
      }
      return next;
    });
  };

  const handleSaveReconciliation = async () => {
    if (!activeReconciliation?.id) return;
    setIsSaving(true);
    try {
      await financeService.updateBankReconciliation(bankAccount.id, activeReconciliation.id, {
        cleared_bank_transactions: Array.from(clearedBankTransactions),
        cleared_journal_entries: Array.from(clearedJournalEntries),
        notes: activeReconciliation.notes || ''
      });
      await loadReconciliation(activeReconciliation.id);
    } catch (error) {
      console.error('Failed to save reconciliation:', error);
      showError('Failed to save reconciliation');
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteReconciliation = async () => {
    if (!activeReconciliation?.id) return;
    if (!confirm(language === 'uz' ? 'Solishtirishni yakunlashni xohlaysizmi?' : 'Are you sure you want to complete this reconciliation?')) return;

    setIsSaving(true);
    try {
      // Save first
      await financeService.updateBankReconciliation(bankAccount.id, activeReconciliation.id, {
        cleared_bank_transactions: Array.from(clearedBankTransactions),
        cleared_journal_entries: Array.from(clearedJournalEntries),
        notes: activeReconciliation.notes || ''
      });
      // Then complete
      await financeService.completeBankReconciliation(bankAccount.id, activeReconciliation.id);
      setActiveReconciliation(null);
      setReconciliationData(null);
      await loadReconciliations();
    } catch (error) {
      console.error('Failed to complete reconciliation:', error);
      showError(error.response?.data?.error?.message || 'Failed to complete reconciliation');
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReconciliation = async (reconciliationId) => {
    if (!confirm(language === 'uz' ? 'Solishtirishni o\'chirmoqchimisiz?' : 'Are you sure you want to delete this reconciliation?')) return;
    try {
      await financeService.deleteBankReconciliation(bankAccount.id, reconciliationId);
      if (activeReconciliation?.id === reconciliationId) {
        setActiveReconciliation(null);
        setReconciliationData(null);
      }
      await loadReconciliations();
    } catch (error) {
      console.error('Failed to delete reconciliation:', error);
      showError(error.response?.data?.error?.message || 'Failed to delete');
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!reconciliationData) return { clearedBankTotal: 0, clearedBookTotal: 0, difference: 0 };

    let clearedBankTotal = 0;
    (reconciliationData.bank_transactions || []).forEach(tx => {
      if (clearedBankTransactions.has(tx.id)) {
        clearedBankTotal += tx.transaction_type === 'credit' ? tx.amount : -tx.amount;
      }
    });

    let clearedBookTotal = 0;
    (reconciliationData.journal_entries || []).forEach(je => {
      if (clearedJournalEntries.has(je.id)) {
        clearedBookTotal += je.amount;
      }
    });

    const statementBalance = activeReconciliation?.statement_ending_balance || 0;
    const difference = statementBalance - (reconciliationData.reconciliation?.book_balance || 0) - clearedBankTotal;

    return { clearedBankTotal, clearedBookTotal, difference };
  };

  const totals = calculateTotals();

  // Reconciliation List View
  if (!activeReconciliation) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {language === 'uz' ? 'Orqaga' : 'Back'}
            </Button>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {language === 'uz' ? 'Bank Solishtirish' : 'Bank Reconciliation'}
              </h2>
              <p className="text-sm text-slate-500">{bankAccount?.name} - {bankAccount?.account_number}</p>
            </div>
          </div>
          <Button onClick={() => setShowNewReconciliationModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {language === 'uz' ? 'Yangi Solishtirish' : 'New Reconciliation'}
          </Button>
        </div>

        {/* Reconciliations List */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'uz' ? 'Solishtirishlar tarixi' : 'Reconciliation History'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : reconciliations.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {language === 'uz' ? 'Solishtirishlar topilmadi' : 'No reconciliations found'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'uz' ? 'Hisobot sanasi' : 'Statement Date'}</TableHead>
                    <TableHead className="text-right">{language === 'uz' ? 'Hisobot balansi' : 'Statement Balance'}</TableHead>
                    <TableHead className="text-right">{language === 'uz' ? 'Kitob balansi' : 'Book Balance'}</TableHead>
                    <TableHead className="text-right">{language === 'uz' ? 'Farq' : 'Difference'}</TableHead>
                    <TableHead>{language === 'uz' ? 'Holat' : 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.map(rec => (
                    <TableRow key={rec.id} className="cursor-pointer hover:bg-slate-50" onClick={() => loadReconciliation(rec.id)}>
                      <TableCell>{formatDate(rec.statement_date)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(rec.statement_ending_balance, bankAccount?.currency)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(rec.book_balance, bankAccount?.currency)}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={rec.difference && Math.abs(rec.difference) > 0.01 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(rec.difference || 0, bankAccount?.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={rec.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {rec.status === 'completed' ? (language === 'uz' ? 'Yakunlangan' : 'Completed') : (language === 'uz' ? 'Yangi' : 'Draft')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rec.status === 'draft' && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteReconciliation(rec.id); }}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AlertModal modal={modal} close={close} />

        {/* New Reconciliation Modal */}
        <Dialog open={showNewReconciliationModal} onOpenChange={setShowNewReconciliationModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'uz' ? 'Yangi Solishtirish' : 'New Reconciliation'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">{language === 'uz' ? 'Hisobot sanasi' : 'Statement Date'}</label>
                <Input
                  type="date"
                  value={newReconciliation.statement_date}
                  onChange={(e) => setNewReconciliation(prev => ({ ...prev, statement_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{language === 'uz' ? 'Yakuniy balans' : 'Statement Ending Balance'}</label>
                <NumberInput
                  placeholder="0"
                  value={newReconciliation.statement_ending_balance}
                  onChange={(raw) => setNewReconciliation(prev => ({ ...prev, statement_ending_balance: raw }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{language === 'uz' ? 'Izoh' : 'Notes'}</label>
                <Textarea
                  placeholder={language === 'uz' ? 'Ixtiyoriy izoh...' : 'Optional notes...'}
                  value={newReconciliation.notes}
                  onChange={(e) => setNewReconciliation(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewReconciliationModal(false)}>
                {language === 'uz' ? 'Bekor qilish' : 'Cancel'}
              </Button>
              <Button onClick={handleCreateReconciliation} disabled={isSaving || !newReconciliation.statement_ending_balance}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {language === 'uz' ? 'Boshlash' : 'Start'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Active Reconciliation View
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setActiveReconciliation(null); setReconciliationData(null); }}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {language === 'uz' ? 'Orqaga' : 'Back'}
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {language === 'uz' ? 'Solishtirish' : 'Reconciliation'} - {formatDate(activeReconciliation.statement_date)}
            </h2>
            <p className="text-sm text-slate-500">{bankAccount?.name}</p>
          </div>
        </div>
        {activeReconciliation.status === 'draft' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveReconciliation} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {language === 'uz' ? 'Saqlash' : 'Save'}
            </Button>
            <Button onClick={handleCompleteReconciliation} disabled={isSaving || Math.abs(totals.difference) > 0.01}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {language === 'uz' ? 'Yakunlash' : 'Complete'}
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 uppercase">{language === 'uz' ? 'Hisobot balansi' : 'Statement Balance'}</p>
            <p className="text-xl font-bold text-blue-800">{formatCurrency(activeReconciliation.statement_ending_balance, bankAccount?.currency)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50">
          <CardContent className="p-4">
            <p className="text-xs text-slate-600 uppercase">{language === 'uz' ? 'Kitob balansi' : 'Book Balance'}</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(activeReconciliation.book_balance, bankAccount?.currency)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 uppercase">{language === 'uz' ? 'Tozalangan' : 'Cleared'}</p>
            <p className="text-xl font-bold text-green-800">{clearedBankTransactions.size + clearedJournalEntries.size} {language === 'uz' ? 'ta' : 'items'}</p>
          </CardContent>
        </Card>
        <Card className={totals.difference === 0 || Math.abs(totals.difference) < 0.01 ? 'bg-green-50' : 'bg-red-50'}>
          <CardContent className="p-4">
            <p className={`text-xs uppercase ${totals.difference === 0 || Math.abs(totals.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              {language === 'uz' ? 'Farq' : 'Difference'}
            </p>
            <p className={`text-xl font-bold ${totals.difference === 0 || Math.abs(totals.difference) < 0.01 ? 'text-green-800' : 'text-red-800'}`}>
              {formatCurrency(totals.difference, bankAccount?.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bank Statement Transactions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {language === 'uz' ? 'Bank hisoboti tranzaksiyalari' : 'Bank Statement Transactions'}
                <Badge variant="outline">{reconciliationData?.bank_transactions?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {(reconciliationData?.bank_transactions || []).length === 0 ? (
                <p className="text-center py-4 text-slate-500">{language === 'uz' ? 'Tranzaksiyalar yo\'q' : 'No transactions'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{language === 'uz' ? 'Sana' : 'Date'}</TableHead>
                      <TableHead>{language === 'uz' ? 'Tavsif' : 'Description'}</TableHead>
                      <TableHead className="text-right">{language === 'uz' ? 'Summa' : 'Amount'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationData.bank_transactions.map(tx => (
                      <TableRow key={tx.id} className={clearedBankTransactions.has(tx.id) ? 'bg-green-50' : ''}>
                        <TableCell>
                          {activeReconciliation.status === 'draft' ? (
                            <Checkbox
                              checked={clearedBankTransactions.has(tx.id)}
                              onCheckedChange={() => handleToggleBankTransaction(tx.id)}
                            />
                          ) : (
                            tx.is_reconciled && <Check className="w-4 h-4 text-green-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(tx.transaction_date)}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{tx.description || tx.reference || '-'}</TableCell>
                        <TableCell className={`text-right font-mono ${tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount, bankAccount?.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Journal Entries */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {language === 'uz' ? 'Jurnal yozuvlari' : 'Journal Entries'}
                <Badge variant="outline">{reconciliationData?.journal_entries?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {(reconciliationData?.journal_entries || []).length === 0 ? (
                <p className="text-center py-4 text-slate-500">{language === 'uz' ? 'Yozuvlar yo\'q' : 'No entries'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{language === 'uz' ? 'Sana' : 'Date'}</TableHead>
                      <TableHead>{language === 'uz' ? 'Raqam' : 'Entry #'}</TableHead>
                      <TableHead className="text-right">{language === 'uz' ? 'Summa' : 'Amount'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationData.journal_entries.map(je => (
                      <TableRow key={je.id} className={clearedJournalEntries.has(je.id) ? 'bg-green-50' : ''}>
                        <TableCell>
                          {activeReconciliation.status === 'draft' ? (
                            <Checkbox
                              checked={clearedJournalEntries.has(je.id)}
                              onCheckedChange={() => handleToggleJournalEntry(je.id)}
                            />
                          ) : (
                            je.is_reconciled && <Check className="w-4 h-4 text-green-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(je.entry_date)}</TableCell>
                        <TableCell className="text-sm">{je.entry_number}</TableCell>
                        <TableCell className={`text-right font-mono ${je.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(je.amount, bankAccount?.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
