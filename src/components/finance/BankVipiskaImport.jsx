import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowDownLeft,
  ArrowUpRight, Loader2, Landmark
} from "lucide-react";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import financeService from '@/api/services/finance';
import { toast } from 'sonner';

// Phase 1 of the bank vipiska import: upload the bank's Excel statement, the
// server parses + auto-classifies every operation, and we show the review
// table (Dt/Kt accounts + status). Posting (Ha/Yo'q) is Phase 2.
export default function BankVipiskaImport() {
  const { language } = useLanguage();
  const { formatCurrency } = useCurrencyFormatter();
  const tr = useCallback((uz, ru, en) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const onPick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await financeService.importBankVipiska(file);
      setResult(res);
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
      toast.error(err?.response?.data?.error || err?.response?.data?.message || err?.message ||
        tr('Yuklashda xatolik', 'Ошибка загрузки', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const txns = result?.transactions || [];

  const statusBadge = (st) => st === 'suggested'
    ? <Badge className="bg-green-100 text-green-800">{tr('Aniqlandi', 'Распознано', 'Detected')}</Badge>
    : <Badge className="bg-amber-100 text-amber-800">{tr('Aniqlanmadi', 'Не распознано', 'Undetected')}</Badge>;

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
                  {tr('Excel faylni yuklang — tizim operatsiyalarni avtomatik ajratadi (tekshirish bosqichi).',
                      'Загрузите Excel — система авто-классифицирует операции (этап проверки).',
                      'Upload the Excel — operations are auto-classified (review stage).')}
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

      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label={tr('Boshlang\'ich qoldiq', 'Остаток на начало', 'Opening balance')} value={formatCurrency(result.opening_balance || 0)} />
            <SummaryCard label={tr('Oxirgi qoldiq', 'Остаток на конец', 'Closing balance')} value={formatCurrency(result.closing_balance || 0)} />
            <SummaryCard label={tr('Kirim (jami)', 'Приход (итого)', 'Total in')} value={formatCurrency(result.total_credit || 0)} valueClass="text-green-600" />
            <SummaryCard label={tr('Chiqim (jami)', 'Расход (итого)', 'Total out')} value={formatCurrency(result.total_debit || 0)} valueClass="text-red-600" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-slate-100 text-slate-700 text-sm px-3 py-1">
              {tr('Hisob', 'Счёт', 'Account')}: <span className="font-mono ml-1">{result.account || '-'}</span>
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 text-sm px-3 py-1">INN: {result.inn || '-'}</Badge>
            <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
              {tr('Aniqlandi', 'Распознано', 'Detected')}: {result.matched_count || 0}
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 text-sm px-3 py-1">
              {tr('Aniqlanmadi', 'Не распознано', 'Undetected')}: {result.unmatched_count || 0}
            </Badge>
            {result.balance_ok
              ? <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{tr('Qoldiq to\'g\'ri', 'Остаток сходится', 'Balance OK')}</Badge>
              : <Badge className="bg-red-100 text-red-800 text-sm px-3 py-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{tr('Qoldiq mos emas', 'Остаток не сходится', 'Balance mismatch')}</Badge>}
          </div>

          {/* Review table */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[var(--genix-purple)]" />
                {tr('Operatsiyalarni tekshirish', 'Проверка операций', 'Review operations')} ({txns.length})
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {tr('Bu bosqichda hech narsa o\'tkazilmaydi — faqat tekshirish. Tasdiqlash (Ha/Yo\'q) keyingi bosqichda.',
                    'На этом этапе ничего не проводится — только проверка. Подтверждение (Да/Нет) — следующий этап.',
                    'Nothing is posted at this stage — review only. Approval (Yes/No) comes next.')}
              </p>
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
                      <TableHead className="font-semibold text-slate-700 text-center">{tr('Dt hisob', 'Дт счёт', 'Dr acct')}</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-center">{tr('Kt hisob', 'Кт счёт', 'Cr acct')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{tr('Kategoriya', 'Категория', 'Category')}</TableHead>
                      <TableHead className="font-semibold text-slate-700">{tr('Holati', 'Статус', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txns.map((t) => (
                      <TableRow key={t.line_number} className="hover:bg-blue-50/50 align-top">
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap">{t.doc_date || '-'}</TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="flex items-center gap-1.5">
                            {t.direction === 'in'
                              ? <ArrowDownLeft className="w-4 h-4 text-green-500 shrink-0" />
                              : <ArrowUpRight className="w-4 h-4 text-red-500 shrink-0" />}
                            <span className="font-medium text-slate-800 truncate">{t.counterparty_name || '-'}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            INN {t.counterparty_inn || '-'} · {t.account_prefix || '—'}…
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.purpose}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-red-600 whitespace-nowrap">
                          {t.direction === 'out' ? formatCurrency(t.amount || 0) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-green-600 whitespace-nowrap">
                          {t.direction === 'in' ? formatCurrency(t.amount || 0) : '—'}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">{t.debet_account_code || '—'}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{t.kredit_account_code || '—'}</TableCell>
                        <TableCell className="text-sm text-slate-600">{t.category || '—'}</TableCell>
                        <TableCell>{statusBadge(t.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !uploading && (
        <div className="text-center py-16 text-slate-400">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr('Vipiska faylini yuklang (.xlsx)', 'Загрузите файл выписки (.xlsx)', 'Upload a vipiska file (.xlsx)')}</p>
        </div>
      )}
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
