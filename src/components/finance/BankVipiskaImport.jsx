import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowDownLeft,
  ArrowUpRight, Loader2, Landmark, Check, User
} from "lucide-react";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import AccountCombobox from '@/components/shared/AccountCombobox';
import financeService from '@/api/services/finance';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

// Bank vipiska import. Phase 1: upload + auto-classify + review. Phase 2: edit
// the detected accounts, then Verify & Post each operation (creates the journal
// entry) or Reject it.
export default function BankVipiskaImport() {
  const { language } = useLanguage();
  const { formatCurrency } = useCurrencyFormatter();
  const { accounts = [] } = useFinancials();
  const tr = useCallback((uz, ru, en) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showConfirm, setShowConfirm] = useState(false);

  // Leaf accounts for the pickers (you post to leaf accounts).
  const leafAccounts = useMemo(
    () => (accounts || []).filter(a => a.is_leaf !== false),
    [accounts]
  );

  // Rows ready to post: not posted/rejected and both accounts chosen.
  const eligible = useMemo(
    () => rows.filter(r => !r.posted && r.status !== 'matched' && r.status !== 'ignored'
      && r.debet_account_id && r.kredit_account_id),
    [rows]
  );
  const eligibleTotal = useMemo(
    () => eligible.reduce((s, r) => s + (r.amount || 0), 0),
    [eligible]
  );

  const onPick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await financeService.importBankVipiska(file);
      // Re-upload of the same file: the server dedupes by content hash and
      // returns the EXISTING import (no transactions array) — load its lines
      // so the review continues where it was, instead of doubling anything.
      if (res?.duplicate) {
        const existing = await financeService.getBankVipiskaTransactions(res.import_id);
        setMeta(res);
        setRows(existing || []);
        toast.info(res?.warnings?.[0] || tr('Bu fayl allaqachon import qilingan — mavjud import ochildi',
          'Этот файл уже импортирован — открыт существующий импорт',
          'This file was already imported — opened the existing import'));
        return;
      }
      setMeta(res);
      setRows((res?.transactions || []).map(t => ({ ...t, posted: false })));
      const n = res?.transaction_count || 0;
      const m = res?.matched_count || 0;
      toast.success(tr(`${n} ta operatsiya yuklandi, ${m} tasi aniqlandi`,
        `Загружено ${n} операций, распознано ${m}`,
        `${n} operations loaded, ${m} classified`));
      if (res && res.balance_ok === false) {
        toast.warning(tr('Diqqat: qoldiq nazorati mos kelmadi',
          'Внимание: контроль остатка не сошёлся', 'Warning: balance check did not reconcile'));
      }
    } catch (err) {
      toast.error(errMsg(err) || tr('Yuklashda xatolik', 'Ошибка загрузки', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const errMsg = (err) => getApiErrorMessage(err, '');

  const patchRow = (id, patch) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  // Persist an account change for a line.
  const changeAccount = async (row, field, value) => {
    const next = { ...row, [field]: value };
    patchRow(row.id, { [field]: value });
    try {
      const res = await financeService.updateBankVipiskaLineAccounts(row.id, {
        debet_account_id: next.debet_account_id || '',
        kredit_account_id: next.kredit_account_id || '',
      });
      patchRow(row.id, { status: res?.status || next.status });
    } catch (err) {
      toast.error(errMsg(err) || tr('Saqlashda xatolik', 'Ошибка сохранения', 'Save failed'));
    }
  };

  // Post all eligible operations one by one.
  const doPostAll = async () => {
    const list = eligible;
    if (list.length === 0) return;
    setPosting(true);
    setProgress({ done: 0, total: list.length });
    let ok = 0, fail = 0;
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      try {
        await financeService.confirmBankVipiskaLine(row.id);
        patchRow(row.id, { posted: true, status: 'matched' });
        ok++;
      } catch (err) {
        fail++;
        if (fail <= 2) toast.error(`#${row.line_number}: ${errMsg(err) || tr('xatolik', 'ошибка', 'error')}`);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setPosting(false);
    setShowConfirm(false);
    toast.success(tr(`${ok} ta operatsiya o'tkazildi${fail ? `, ${fail} tasi xato` : ''}`,
      `Проведено ${ok}${fail ? `, ошибок ${fail}` : ''}`,
      `Posted ${ok}${fail ? `, ${fail} failed` : ''}`));
  };

  const accName = (id) => {
    const a = leafAccounts.find(x => x.id === id);
    return a ? `${a.code}` : '';
  };

  const statusBadge = (row) => {
    if (row.posted || row.status === 'matched')
      return <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" />{tr('O\'tkazildi', 'Проведено', 'Posted')}</Badge>;
    if (row.status === 'ignored')
      return <Badge className="bg-slate-200 text-slate-600">{tr('Rad etildi', 'Отклонено', 'Rejected')}</Badge>;
    if (row.status === 'suggested')
      return <Badge className="bg-blue-100 text-blue-800">{tr('Aniqlandi', 'Распознано', 'Detected')}</Badge>;
    return <Badge className="bg-amber-100 text-amber-800">{tr('Aniqlanmadi', 'Не распознано', 'Undetected')}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Upload header */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Landmark className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">
                  {tr('Bank ko\'chirmasi (vipiska) yuklash', 'Импорт банковской выписки', 'Bank statement (vipiska) import')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-0.5">
                  {tr('Excelni yuklang, hisoblarni tekshiring va tasdiqlang.',
                      'Загрузите Excel, проверьте счета и подтвердите.',
                      'Upload the Excel, review the accounts, and approve.')}
                </p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
            <Button onClick={onPick} disabled={uploading}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? tr('Yuklanmoqda...', 'Загрузка...', 'Uploading...') : tr('Vipiska yuklash', 'Загрузить выписку', 'Upload vipiska')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {meta && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label={tr('Boshlang\'ich qoldiq', 'Остаток на начало', 'Opening balance')} value={formatCurrency(meta.opening_balance || 0)} />
            <SummaryCard label={tr('Oxirgi qoldiq', 'Остаток на конец', 'Closing balance')} value={formatCurrency(meta.closing_balance || 0)} />
            <SummaryCard label={tr('Kirim (jami)', 'Приход (итого)', 'Total in')} value={formatCurrency(meta.total_credit || 0)} valueClass="text-green-600" />
            <SummaryCard label={tr('Chiqim (jami)', 'Расход (итого)', 'Total out')} value={formatCurrency(meta.total_debit || 0)} valueClass="text-red-600" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-slate-100 text-slate-700 text-sm px-3 py-1">
              {tr('Hisob', 'Счёт', 'Account')}: <span className="font-mono ml-1">{meta.account || '-'}</span>
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 text-sm px-3 py-1">INN: {meta.inn || '-'}</Badge>
            {meta.balance_ok
              ? <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{tr('Qoldiq to\'g\'ri', 'Остаток сходится', 'Balance OK')}</Badge>
              : <Badge className="bg-red-100 text-red-800 text-sm px-3 py-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{tr('Qoldiq mos emas', 'Остаток не сходится', 'Balance mismatch')}</Badge>}
          </div>

          {/* Review table */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-[var(--genix-purple)]" />
                    {tr('Operatsiyalarni tekshirish', 'Проверка операций', 'Review operations')} ({rows.length})
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {tr('Hisoblarni tekshiring/o\'zgartiring, so\'ng hammasini bitta tugma bilan o\'tkazing.',
                        'Проверьте/измените счета, затем проведите всё одной кнопкой.',
                        'Review/change the accounts, then post everything with one button.')}
                  </p>
                </div>
                <Button
                  className="bg-green-600 hover:bg-green-700 shrink-0"
                  disabled={eligible.length === 0 || posting}
                  onClick={() => setShowConfirm(true)}
                >
                  {posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  {tr('Hammasini tasdiqlash', 'Подтвердить всё', 'Confirm all')} ({eligible.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">{tr('Sana', 'Дата', 'Date')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{tr('Kontragent', 'Контрагент', 'Counterparty')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">{tr('Debet', 'Дебет', 'Debit')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">{tr('Kredit', 'Кредит', 'Credit')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 min-w-[190px]">{tr('Dt hisob', 'Дт счёт', 'Dr acct')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 min-w-[190px]">{tr('Kt hisob', 'Кт счёт', 'Cr acct')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{tr('Holati', 'Статус', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t) => {
                      const locked = t.posted || t.status === 'matched';
                      return (
                        <TableRow key={t.id} className="hover:bg-blue-50/50 align-top">
                          <TableCell className="text-sm text-slate-600 whitespace-nowrap">{t.doc_date || '-'}</TableCell>
                          <TableCell className="max-w-[300px]">
                            <div className="flex items-center gap-1.5">
                              {t.direction === 'in'
                                ? <ArrowDownLeft className="w-4 h-4 text-green-500 shrink-0" />
                                : <ArrowUpRight className="w-4 h-4 text-red-500 shrink-0" />}
                              <span className="font-medium text-slate-800 truncate">{t.counterparty_name || '-'}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">INN {t.counterparty_inn || '-'} · {t.account_prefix || '—'}…</div>
                            {t.matched_contact_name && (
                              <div className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                                <User className="w-3 h-3" />{tr('Bazada', 'В базе', 'In base')}: {t.matched_contact_name}
                              </div>
                            )}
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.purpose}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-red-600 whitespace-nowrap">
                            {t.direction === 'out' ? formatCurrency(t.amount || 0) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-green-600 whitespace-nowrap">
                            {t.direction === 'in' ? formatCurrency(t.amount || 0) : '—'}
                          </TableCell>
                          <TableCell className="min-w-[190px]">
                            {locked
                              ? <span className="font-mono text-sm">{accName(t.debet_account_id) || t.debet_account_code || '—'}</span>
                              : <AccountCombobox accounts={leafAccounts} value={t.debet_account_id || undefined}
                                  onValueChange={(v) => changeAccount(t, 'debet_account_id', v)}
                                  placeholder={tr('Tanlang', 'Выбрать', 'Select')} />}
                          </TableCell>
                          <TableCell className="min-w-[190px]">
                            {locked
                              ? <span className="font-mono text-sm">{accName(t.kredit_account_id) || t.kredit_account_code || '—'}</span>
                              : <AccountCombobox accounts={leafAccounts} value={t.kredit_account_id || undefined}
                                  onValueChange={(v) => changeAccount(t, 'kredit_account_id', v)}
                                  placeholder={tr('Tanlang', 'Выбрать', 'Select')} />}
                          </TableCell>
                          <TableCell>{statusBadge(t)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!meta && !uploading && (
        <div className="text-center py-16 text-slate-400">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr('Vipiska faylini yuklang (.xlsx)', 'Загрузите файл выписки (.xlsx)', 'Upload a vipiska file (.xlsx)')}</p>
        </div>
      )}

      {/* Confirm-all dialog (TZ §5.3) */}
      <Dialog open={showConfirm} onOpenChange={(o) => { if (!o && !posting) setShowConfirm(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('Hammasini tasdiqlash', 'Подтвердить всё', 'Confirm all')}</DialogTitle>
            <DialogDescription>
              {tr('Operatsiyalarni tekshirdingizmi? Tasdiqlasangiz, ular hisob raqamlari bo\'yicha o\'tkaziladi.',
                  'Вы проверили операции? После подтверждения они будут проведены по счетам.',
                  'Have you reviewed the operations? Once confirmed they will be posted to the accounts.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm py-2">
            <Row k={tr('O\'tkaziladigan operatsiyalar', 'Операций к проводке', 'Operations to post')} v={String(eligible.length)} />
            <Row k={tr('Jami summa', 'Итого сумма', 'Total amount')} v={formatCurrency(eligibleTotal)} />
            {rows.some(r => !r.posted && r.status !== 'ignored' && (!r.debet_account_id || !r.kredit_account_id)) && (
              <p className="text-xs text-amber-600 pt-1">
                {tr('Hisobi tanlanmagan (Aniqlanmadi) operatsiyalar o\'tkazilmaydi.',
                    'Операции без счетов («Не распознано») не будут проведены.',
                    'Operations without accounts ("Undetected") will be skipped.')}
              </p>
            )}
          </div>
          {posting && (
            <div className="text-sm text-slate-600">
              {tr('O\'tkazilmoqda', 'Проводится', 'Posting')}… {progress.done}/{progress.total}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" disabled={posting} onClick={() => setShowConfirm(false)}>{tr('Bekor', 'Отмена', 'Cancel')}</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={posting || eligible.length === 0}
              onClick={doPostAll}>
              {posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {tr('Ha, o\'tkazish', 'Да, провести', 'Yes, post')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, valueClass = 'text-slate-900' }) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-800 text-right">{v || '-'}</span>
    </div>
  );
}
