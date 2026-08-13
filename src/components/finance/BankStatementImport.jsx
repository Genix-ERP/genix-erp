import { formatDate } from '@/utils/formatDate';
import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2,
  ArrowLeft, ArrowRight, ArrowDownLeft, ArrowUpRight, X, FileText
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { parseSpreadsheetFile } from '@/components/shared/ImportExport';
import financeService from '@/api/services/finance';
import { getApiErrorMessage } from '@/utils/apiError';

// ─── OFX Parser ───────────────────────────────────────────
function parseOFX(text) {
  const transactions = [];
  // Split by STMTTRN blocks
  const blocks = text.split(/<STMTTRN>/i).slice(1);

  for (const block of blocks) {
    const end = block.search(/<\/STMTTRN>/i);
    const content = end >= 0 ? block.substring(0, end) : block;

    const get = (tag) => {
      const re = new RegExp(`<${tag}>\\s*(.+?)\\s*(?:<|$)`, 'im');
      const m = content.match(re);
      return m ? m[1].trim() : '';
    };

    const trnType = get('TRNTYPE');
    const dtPosted = get('DTPOSTED');
    const amount = parseFloat(get('TRNAMT')) || 0;
    const fitId = get('FITID');
    const name = get('NAME');
    const memo = get('MEMO');

    // Parse date: YYYYMMDD or YYYYMMDDHHMMSS
    let dateStr = '';
    if (dtPosted.length >= 8) {
      const y = dtPosted.substring(0, 4);
      const m = dtPosted.substring(4, 6);
      const d = dtPosted.substring(6, 8);
      dateStr = `${y}-${m}-${d}`;
    }

    if (dateStr && amount !== 0) {
      transactions.push({
        transaction_date: dateStr,
        amount: amount,
        transaction_type: amount >= 0 ? 'credit' : 'debit',
        description: name || memo || trnType || '',
        reference: fitId || '',
      });
    }
  }

  return transactions;
}

// ─── Auto-detect column mapping ───────────────────────────
const DATE_PATTERNS = ['date', 'transaction_date', 'posted', 'value_date', 'sana', 'дата', 'posting_date', 'txn_date'];
const AMOUNT_PATTERNS = ['amount', 'sum', 'summa', 'сумма', 'total', 'value'];
const DEBIT_PATTERNS = ['debit', 'дебет', 'chiqim', 'расход', 'withdrawal'];
const CREDIT_PATTERNS = ['credit', 'кредит', 'kirim', 'приход', 'deposit'];
const DESC_PATTERNS = ['description', 'details', 'memo', 'name', 'tavsif', 'описание', 'narrative', 'particulars', 'purpose'];
const REF_PATTERNS = ['reference', 'ref', 'check', 'fitid', 'номер', 'raqam', 'transaction_id', 'id'];

function autoDetectMapping(headers) {
  const mapping = { date: '', amount: '', debit: '', credit: '', description: '', reference: '' };
  const lower = headers.map(h => String(h).toLowerCase().trim());

  const find = (patterns) => {
    for (const p of patterns) {
      const idx = lower.findIndex(h => h === p || h.includes(p));
      if (idx >= 0) return headers[idx];
    }
    return '';
  };

  mapping.date = find(DATE_PATTERNS);
  mapping.amount = find(AMOUNT_PATTERNS);
  mapping.debit = find(DEBIT_PATTERNS);
  mapping.credit = find(CREDIT_PATTERNS);
  mapping.description = find(DESC_PATTERNS);
  mapping.reference = find(REF_PATTERNS);

  return mapping;
}

// ─── Parse date from various formats ──────────────────────
function parseDate(val, onAmbiguous) {
  if (!val) return '';
  const s = String(val).trim();

  // Excel serial number
  if (/^\d{5}$/.test(s)) {
    const d = new Date((parseInt(s) - 25569) * 86400000);
    return d.toISOString().split('T')[0];
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

  // DD.MM.YYYY / DD-MM-YYYY — dot/dash separated is always day-first
  const dmy = s.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // Slash-separated is ambiguous (01/02/2026): a component > 12 decides the
  // order; otherwise default to DD/MM (bank statements here are UZ-format)
  // and flag the row via onAmbiguous.
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const first = parseInt(slash[1], 10);
    const second = parseInt(slash[2], 10);
    let day = first, month = second;
    if (first > 12) {
      day = first; month = second; // must be DD/MM
    } else if (second > 12) {
      day = second; month = first; // must be MM/DD
    } else if (onAmbiguous) {
      onAmbiguous(); // both <= 12 — assumed DD/MM
    }
    if (month < 1 || month > 12) return '';
    return `${slash[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try native parse as fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  return '';
}

// ─── STEPS ────────────────────────────────────────────────
const STEP_UPLOAD = 0;
const STEP_MAP = 1;
const STEP_PREVIEW = 2;
const STEP_DONE = 3;

export default function BankStatementImport({ open, onOpenChange, bankAccount, onImportComplete }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(STEP_UPLOAD);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({ date: '', amount: '', debit: '', credit: '', description: '', reference: '' });
  const [isOFX, setIsOFX] = useState(false);
  const [ofxTransactions, setOfxTransactions] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setStep(STEP_UPLOAD);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({ date: '', amount: '', debit: '', credit: '', description: '', reference: '' });
    setIsOFX(false);
    setOfxTransactions([]);
    setParseError('');
    setIsImporting(false);
    setImportResult(null);
    setImportError('');
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // ─── File handling ────────────────────────────
  const processFile = useCallback(async (f) => {
    setFile(f);
    setParseError('');

    const ext = f.name.split('.').pop().toLowerCase();

    if (ext === 'ofx' || ext === 'qfx') {
      // OFX file
      try {
        const text = await f.text();
        const txns = parseOFX(text);
        if (txns.length === 0) {
          setParseError(t('no_transactions_found') || 'No transactions found in file');
          return;
        }
        setIsOFX(true);
        setOfxTransactions(txns);
        setStep(STEP_PREVIEW); // Skip mapping for OFX
      } catch {
        setParseError(t('import_error') || 'Failed to parse file');
      }
    } else {
      // CSV / XLSX
      try {
        const result = await parseSpreadsheetFile(f);
        if (!result.rows || result.rows.length === 0) {
          setParseError(t('no_transactions_found') || 'No transactions found in file');
          return;
        }
        setHeaders(result.headers.map(String));
        setRows(result.rows);
        setIsOFX(false);

        // Auto-detect mapping
        const detected = autoDetectMapping(result.headers.map(String));
        setMapping(detected);
        setStep(STEP_MAP);
      } catch {
        setParseError(t('import_error') || 'Failed to parse file');
      }
    }
  }, [t]);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) processFile(f);
  };

  // ─── Build transactions from mapped CSV/XLSX data ─────
  const getMappedTransactions = (onAmbiguousDate) => {
    if (isOFX) return ofxTransactions;

    return rows
      .map(row => {
        const dateVal = mapping.date ? row[mapping.date] : '';
        const parsedDate = parseDate(dateVal, onAmbiguousDate);
        if (!parsedDate) return null;

        let amount = 0;
        let txType = '';

        if (mapping.debit && mapping.credit) {
          // Separate debit/credit columns
          const debitVal = parseFloat(String(row[mapping.debit] || '').replace(/[^0-9.-]/g, '')) || 0;
          const creditVal = parseFloat(String(row[mapping.credit] || '').replace(/[^0-9.-]/g, '')) || 0;
          if (creditVal > 0) {
            amount = creditVal;
            txType = 'credit';
          } else if (debitVal > 0) {
            amount = debitVal;
            txType = 'debit';
          } else {
            return null;
          }
        } else if (mapping.amount) {
          const rawAmount = parseFloat(String(row[mapping.amount] || '').replace(/[^0-9.-]/g, '')) || 0;
          if (rawAmount === 0) return null;
          amount = Math.abs(rawAmount);
          txType = rawAmount >= 0 ? 'credit' : 'debit';
        } else {
          return null;
        }

        const description = mapping.description ? String(row[mapping.description] || '') : '';
        const reference = mapping.reference ? String(row[mapping.reference] || '') : '';

        return {
          transaction_date: parsedDate,
          amount,
          transaction_type: txType,
          description,
          reference,
        };
      })
      .filter(Boolean);
  };

  // ─── Import ───────────────────────────────────
  const handleImport = async () => {
    const transactions = getMappedTransactions();
    if (transactions.length === 0) return;

    setIsImporting(true);
    setImportError('');

    try {
      const result = await financeService.importBankStatement(bankAccount.id, { transactions });
      setImportResult(result);
      setStep(STEP_DONE);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      setImportError(getApiErrorMessage(err, t('import_error') || 'Import failed'));
    } finally {
      setIsImporting(false);
    }
  };

  // ─── Computed values ──────────────────────────
  // Rows whose slash-date could be either DD/MM or MM/DD (both parts <= 12) —
  // parsed as DD/MM, surfaced as a warning in the preview.
  let ambiguousDateCount = 0;
  const transactions = step >= STEP_PREVIEW ? getMappedTransactions(() => { ambiguousDateCount += 1; }) : [];
  const credits = transactions.filter(tx => tx.transaction_type === 'credit');
  const debits = transactions.filter(tx => tx.transaction_type === 'debit');
  const totalCredits = credits.reduce((s, tx) => s + tx.amount, 0);
  const totalDebits = debits.reduce((s, tx) => s + tx.amount, 0);

  const canProceedToPreview = mapping.date && (mapping.amount || (mapping.debit && mapping.credit));

  // ─── RENDER ───────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t('import_bank_statement') || 'Import Bank Statement'}
            {bankAccount && (
              <Badge variant="outline" className="ml-2 font-normal">
                {bankAccount.name} - {bankAccount.currency}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[
            t('upload') || 'Upload',
            ...(isOFX ? [] : [t('column_mapping') || 'Mapping']),
            t('preview') || 'Preview',
          ].map((label, i) => {
            const stepIdx = isOFX ? (i === 0 ? STEP_UPLOAD : STEP_PREVIEW) : i;
            const isActive = step === stepIdx || (isOFX && i === 1 && step === STEP_PREVIEW);
            const isCompleted = step > stepIdx;
            return (
              <React.Fragment key={i}>
                {i > 0 && <div className="flex-1 h-px bg-slate-200" />}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  isActive ? 'bg-blue-100 text-blue-700' :
                  isCompleted ? 'bg-green-100 text-green-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {isCompleted ? <CheckCircle className="w-3 h-3" /> : null}
                  {label}
                </div>
              </React.Fragment>
            );
          })}
          {step === STEP_DONE && (
            <>
              <div className="flex-1 h-px bg-slate-200" />
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" />
                {t('completed') || 'Done'}
              </div>
            </>
          )}
        </div>

        {/* ─── STEP 0: File Upload ─── */}
        {step === STEP_UPLOAD && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.ofx,.qfx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="text-slate-700 font-medium">
                {t('drag_drop_file') || 'Drag & drop file here or click to browse'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {t('supported_formats') || 'Supported formats'}: CSV, XLSX, XLS, OFX
              </p>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {parseError}
              </div>
            )}

            {file && !parseError && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setParseError(''); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 1: Column Mapping ─── */}
        {step === STEP_MAP && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {file?.name} — {rows.length} {t('rows') || 'rows'}
              </p>
              <Button variant="ghost" size="sm" onClick={() => { reset(); }}>
                <X className="w-4 h-4 mr-1" /> {t('change_file') || 'Change file'}
              </Button>
            </div>

            {/* Mapping Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
              {[
                { key: 'date', label: t('date') || 'Date', required: true },
                { key: 'amount', label: t('amount') || 'Amount', required: !mapping.debit && !mapping.credit },
                { key: 'debit', label: t('debit') || 'Debit', required: false },
                { key: 'credit', label: t('credit') || 'Credit', required: false },
                { key: 'description', label: t('description') || 'Description', required: false },
                { key: 'reference', label: t('reference') || 'Reference', required: false },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <Select
                    value={mapping[key] || '_none_'}
                    onValueChange={(v) => setMapping(prev => ({ ...prev, [key]: v === '_none_' ? '' : v }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t('select_column') || 'Select column'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">— {t('skip') || 'Skip'} —</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Mapping hint */}
            {(mapping.debit || mapping.credit) && (
              <p className="text-xs text-slate-500 px-1">
                {language === 'uz'
                  ? "Debet va Kredit ustunlari alohida tanlanganda, Summa ustuni e'tiborga olinmaydi."
                  : language === 'ru'
                  ? 'Когда выбраны отдельные столбцы Дебет и Кредит, столбец Сумма игнорируется.'
                  : 'When separate Debit and Credit columns are selected, the Amount column is ignored.'}
              </p>
            )}

            {/* Preview first 5 rows */}
            {rows.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">{t('preview') || 'Preview'} ({t('first') || 'first'} 5)</p>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">{t('date') || 'Date'}</TableHead>
                        <TableHead className="text-xs text-right">{t('amount') || 'Amount'}</TableHead>
                        <TableHead className="text-xs">{t('type') || 'Type'}</TableHead>
                        <TableHead className="text-xs">{t('description') || 'Description'}</TableHead>
                        <TableHead className="text-xs">{t('reference') || 'Reference'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 5).map((row, i) => {
                        const dateVal = mapping.date ? parseDate(row[mapping.date]) : '';
                        let amount = 0, txType = '';
                        if (mapping.debit && mapping.credit) {
                          const dv = parseFloat(String(row[mapping.debit] || '').replace(/[^0-9.-]/g, '')) || 0;
                          const cv = parseFloat(String(row[mapping.credit] || '').replace(/[^0-9.-]/g, '')) || 0;
                          if (cv > 0) { amount = cv; txType = 'credit'; }
                          else if (dv > 0) { amount = dv; txType = 'debit'; }
                        } else if (mapping.amount) {
                          const raw = parseFloat(String(row[mapping.amount] || '').replace(/[^0-9.-]/g, '')) || 0;
                          amount = Math.abs(raw);
                          txType = raw >= 0 ? 'credit' : 'debit';
                        }
                        const desc = mapping.description ? String(row[mapping.description] || '') : '';
                        const ref = mapping.reference ? String(row[mapping.reference] || '') : '';

                        return (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{dateVal || <span className="text-red-400">—</span>}</TableCell>
                            <TableCell className={`text-xs text-right font-mono ${txType === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {amount > 0 ? (txType === 'credit' ? '+' : '-') + amount.toLocaleString() : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {txType ? (
                                <Badge className={`text-[10px] ${txType === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {txType === 'credit' ? t('income') || 'Credit' : t('expense') || 'Debit'}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{desc || '—'}</TableCell>
                            <TableCell className="text-xs font-mono">{ref || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="w-4 h-4 mr-1" /> {t('back') || 'Back'}
              </Button>
              <Button
                onClick={() => setStep(STEP_PREVIEW)}
                disabled={!canProceedToPreview}
              >
                {t('preview_import') || 'Preview & Import'} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Preview & Import ─── */}
        {step === STEP_PREVIEW && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-xs text-slate-500">{t('total') || 'Total'}</p>
                <p className="text-lg font-bold text-slate-800">{transactions.length}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xs text-green-600 flex items-center justify-center gap-1"><ArrowDownLeft className="w-3 h-3" /> {t('income') || 'Credits'}</p>
                <p className="text-lg font-bold text-green-700">{credits.length}</p>
                <p className="text-xs text-green-600">{formatCurrency(totalCredits, bankAccount?.currency)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-xs text-red-600 flex items-center justify-center gap-1"><ArrowUpRight className="w-3 h-3" /> {t('expense') || 'Debits'}</p>
                <p className="text-lg font-bold text-red-700">{debits.length}</p>
                <p className="text-xs text-red-600">{formatCurrency(totalDebits, bankAccount?.currency)}</p>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto border rounded-lg max-h-[40vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 sticky top-0">
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">{t('date') || 'Date'}</TableHead>
                    <TableHead className="text-xs">{t('description') || 'Description'}</TableHead>
                    <TableHead className="text-xs">{t('reference') || 'Reference'}</TableHead>
                    <TableHead className="text-xs">{t('type') || 'Type'}</TableHead>
                    <TableHead className="text-xs text-right">{t('amount') || 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, i) => (
                    <TableRow key={i} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                      <TableCell className="text-xs">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate">{tx.description || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{tx.reference || '—'}</TableCell>
                      <TableCell className="text-xs">
                        <Badge className={`text-[10px] ${tx.transaction_type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {tx.transaction_type === 'credit' ? (
                            <><ArrowDownLeft className="w-3 h-3 mr-0.5" /> {t('income') || 'Credit'}</>
                          ) : (
                            <><ArrowUpRight className="w-3 h-3 mr-0.5" /> {t('expense') || 'Debit'}</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-xs text-right font-mono font-medium ${tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount, bankAccount?.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {ambiguousDateCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {language === 'uz'
                  ? `${ambiguousDateCount} ta qatorda sana formati noaniq — KK/OO (kun/oy) deb qabul qilindi`
                  : language === 'ru'
                  ? `Строк с неоднозначной датой: ${ambiguousDateCount} — принято как ДД/ММ (день/месяц)`
                  : `${ambiguousDateCount} row(s) have an ambiguous date — assumed DD/MM (day/month)`}
              </div>
            )}

            {importError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {importError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(isOFX ? STEP_UPLOAD : STEP_MAP)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> {t('back') || 'Back'}
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || transactions.length === 0}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('importing') || 'Importing...'}</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> {t('import') || 'Import'} {transactions.length} {t('transactions') || 'transactions'}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Done ─── */}
        {step === STEP_DONE && importResult && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">
              {t('import_complete') || 'Import Complete'}
            </h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-green-600">{importResult.imported}</span>{' '}
                {t('transactions_imported') || 'transactions imported'}
              </p>
              {importResult.duplicates > 0 && (
                <p>
                  <span className="font-semibold text-orange-600">{importResult.duplicates}</span>{' '}
                  {t('duplicates_skipped') || 'duplicates skipped'}
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-4">
              {t('close') || 'Close'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
