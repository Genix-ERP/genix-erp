import { formatDate } from '@/utils/formatDate';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Search, FileText, Printer, Download, Filter, Loader2,
  ArrowUpRight, ArrowDownLeft, BookOpen, ChevronLeft, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import financeService from "@/api/services/finance";
import { getApiErrorMessage } from '@/utils/apiError';

export default function AccountCard() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { accounts } = useFinancials();
  const { formatCurrency } = useCurrencyFormatter();

  // Filters
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);
  const [counterpartCode, setCounterpartCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [accountSearch, setAccountSearch] = useState('');

  // Data
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Drill-down entry: the diagnostics panel links here with ?account_id=…&from=…&to=…
  // (genix_diagnostika §1: any figure → account → проводка → document).
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const acc = searchParams.get('account_id');
    if (acc) setSelectedAccountId(acc);
    const f = searchParams.get('from');
    const t2 = searchParams.get('to');
    if (f) setDateFrom(f);
    if (t2) setDateTo(t2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Pagination (client-side for print compatibility)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Filter leaf accounts for selection
  const leafAccounts = useMemo(() => {
    return (accounts || [])
      .filter(a => a.is_leaf !== false && a.is_active !== false)
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    if (!accountSearch) return leafAccounts;
    const q = accountSearch.toLowerCase();
    return leafAccounts.filter(a =>
      (a.code || '').toLowerCase().includes(q) ||
      (a.name || '').toLowerCase().includes(q)
    );
  }, [leafAccounts, accountSearch]);

  const loadAccountCard = useCallback(async () => {
    if (!selectedAccountId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await financeService.getAccountCard({
        account_id: selectedAccountId,
        period_from: dateFrom,
        period_to: dateTo,
        counterpart_code: counterpartCode || undefined,
        contact_name: contactName || undefined,
      });
      setReport(data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load account card:', err);
      setError(getApiErrorMessage(err, 'Failed to load account card'));
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, dateFrom, dateTo, counterpartCode, contactName]);

  // Auto-load when account or dates change
  useEffect(() => {
    if (selectedAccountId) {
      loadAccountCard();
    }
  }, [selectedAccountId, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pagination
  const transactions = report?.transactions || [];
  const totalPages = Math.ceil(transactions.length / pageSize);
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const labels = {
    title: language === 'ru' ? 'Карточка счёта' : language === 'uz' ? 'Hisob kartochkasi' : 'Account Card',
    select_account: language === 'ru' ? 'Выберите счёт' : language === 'uz' ? 'Hisobni tanlang' : 'Select Account',
    search_account: language === 'ru' ? 'Поиск счёта...' : language === 'uz' ? 'Hisob qidirish...' : 'Search account...',
    period_from: language === 'ru' ? 'С' : language === 'uz' ? 'Dan' : 'From',
    period_to: language === 'ru' ? 'По' : language === 'uz' ? 'Gacha' : 'To',
    counterpart: language === 'ru' ? 'Корр. счёт' : language === 'uz' ? 'Korr. hisob' : 'Counterpart',
    contact: language === 'ru' ? 'Контрагент' : language === 'uz' ? 'Kontragent' : 'Contact',
    apply_filter: language === 'ru' ? 'Применить' : language === 'uz' ? 'Qo\'llash' : 'Apply',
    date: language === 'ru' ? 'Дата' : language === 'uz' ? 'Sana' : 'Date',
    document: language === 'ru' ? 'Документ' : language === 'uz' ? 'Hujjat' : 'Document',
    description: language === 'ru' ? 'Описание' : language === 'uz' ? 'Tavsif' : 'Description',
    counterpart_account: language === 'ru' ? 'Корр. счёт' : language === 'uz' ? 'Korr. hisob' : 'Counterpart',
    debit: language === 'ru' ? 'Дебет' : language === 'uz' ? 'Debet' : 'Debit',
    credit: language === 'ru' ? 'Кредит' : language === 'uz' ? 'Kredit' : 'Credit',
    balance: language === 'ru' ? 'Сальдо' : language === 'uz' ? 'Saldo' : 'Balance',
    opening_balance: language === 'ru' ? 'Сальдо на начало' : language === 'uz' ? 'Boshi saldosi' : 'Opening Balance',
    period_turnover: language === 'ru' ? 'Обороты за период' : language === 'uz' ? 'Davr aylanmasi' : 'Period Turnover',
    closing_balance: language === 'ru' ? 'Сальдо на конец' : language === 'uz' ? 'Oxiri saldosi' : 'Closing Balance',
    no_account_selected: language === 'ru' ? 'Выберите счёт для просмотра карточки' : language === 'uz' ? 'Kartochkani ko\'rish uchun hisobni tanlang' : 'Select an account to view its card',
    no_transactions: language === 'ru' ? 'Нет операций за выбранный период' : language === 'uz' ? 'Tanlangan davr uchun operatsiyalar yo\'q' : 'No transactions for selected period',
    print: language === 'ru' ? 'Печать' : language === 'uz' ? 'Chop etish' : 'Print',
    total: language === 'ru' ? 'Итого' : language === 'uz' ? 'Jami' : 'Total',
    account: language === 'ru' ? 'Счёт' : language === 'uz' ? 'Hisob' : 'Account',
    period: language === 'ru' ? 'Период' : language === 'uz' ? 'Davr' : 'Period',
    type_active: language === 'ru' ? 'Активный' : language === 'uz' ? 'Aktiv' : 'Active',
    type_passive: language === 'ru' ? 'Пассивный' : language === 'uz' ? 'Passiv' : 'Passive',
    page_of: language === 'ru' ? 'из' : language === 'uz' ? '/' : 'of',
  };

  const handlePrint = () => {
    if (!report) return;

    const rowsHtml = transactions.map((tx, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${formatDate(tx.date)}</td>
        <td>${tx.entry_number || ''}</td>
        <td>${tx.description || ''}${tx.contact_name ? ' (' + tx.contact_name + ')' : ''}</td>
        <td style="text-align:center;font-family:monospace">${tx.counterpart_code || ''}</td>
        <td style="text-align:right">${tx.debit_amount > 0 ? formatCurrency(tx.debit_amount) : ''}</td>
        <td style="text-align:right">${tx.credit_amount > 0 ? formatCurrency(tx.credit_amount) : ''}</td>
        <td style="text-align:right;font-weight:500">${formatCurrency(tx.running_balance)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <title>${labels.title} - ${report.account_code} ${report.account_name}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 30px; color: #000; font-size: 12px; }
          h1 { text-align: center; font-size: 16px; margin: 0 0 2px 0; text-transform: uppercase; }
          h2 { text-align: center; font-size: 13px; font-weight: normal; color: #333; margin: 0 0 20px 0; }
          .info { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #000; padding: 3px 6px; font-size: 11px; }
          th { background: #f0f0f0; text-align: center; font-weight: bold; }
          .totals td { font-weight: bold; background: #f5f5f5; }
          .summary { margin-top: 15px; }
          .summary td { border: 1px solid #000; padding: 4px 8px; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <h1>${labels.title}</h1>
        <h2>${labels.account}: ${report.account_code} — ${report.account_name}</h2>

        <div class="info">
          <span>${labels.period}: ${formatDate(report.period_from)} — ${formatDate(report.period_to)}</span>
          <span>${language === 'ru' ? 'Тип' : language === 'uz' ? 'Turi' : 'Type'}: ${report.account_type === 'active' ? labels.type_active : labels.type_passive}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px">№</th>
              <th style="width:80px">${labels.date}</th>
              <th style="width:110px">${labels.document}</th>
              <th>${labels.description}</th>
              <th style="width:70px">${labels.counterpart_account}</th>
              <th style="width:100px">${labels.debit}</th>
              <th style="width:100px">${labels.credit}</th>
              <th style="width:110px">${labels.balance}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="totals">
              <td colspan="5">${labels.opening_balance}</td>
              <td colspan="2"></td>
              <td style="text-align:right">${formatCurrency(report.opening_balance)}</td>
            </tr>
            ${rowsHtml}
            <tr class="totals">
              <td colspan="5">${labels.period_turnover}</td>
              <td style="text-align:right">${formatCurrency(report.total_debit)}</td>
              <td style="text-align:right">${formatCurrency(report.total_credit)}</td>
              <td></td>
            </tr>
            <tr class="totals" style="background:#e8e8e8">
              <td colspan="5">${labels.closing_balance}</td>
              <td colspan="2"></td>
              <td style="text-align:right">${formatCurrency(report.closing_balance)}</td>
            </tr>
          </tbody>
        </table>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {labels.title}
                </CardTitle>
                {report && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {report.account_code} — {report.account_name}
                  </p>
                )}
              </div>
            </div>
            {report && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                {labels.print}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Account Selector */}
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">{labels.account}</label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="bg-slate-50">
                  <SelectValue placeholder={labels.select_account} />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder={labels.search_account}
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  {filteredAccounts.slice(0, 100).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="font-mono text-xs mr-2">{acc.code}</span>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">{labels.period_from}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-50"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">{labels.period_to}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-50"
              />
            </div>

            {/* Counterpart filter */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">{labels.counterpart}</label>
              <div className="flex gap-1">
                <Input
                  placeholder="6010, 4010..."
                  value={counterpartCode}
                  onChange={(e) => setCounterpartCode(e.target.value)}
                  className="bg-slate-50"
                />
                <Button size="icon" variant="outline" onClick={loadAccountCard} disabled={!selectedAccountId || isLoading}>
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Contact name filter */}
          <div className="mt-3 max-w-xs">
            <label className="text-xs text-slate-500 mb-1 block">{labels.contact}</label>
            <div className="flex gap-1">
              <Input
                placeholder={labels.contact + '...'}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="bg-slate-50"
                onKeyDown={(e) => { if (e.key === 'Enter') loadAccountCard(); }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--genix-purple)]" />
        </div>
      ) : !selectedAccountId ? (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="py-20 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{labels.title}</h3>
            <p className="text-sm text-slate-500">{labels.no_account_selected}</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="bg-white/80 border-red-200">
          <CardContent className="py-10 text-center text-red-600">{error}</CardContent>
        </Card>
      ) : report ? (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          {/* Summary Cards */}
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">{labels.opening_balance}</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(report.opening_balance)}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600">{labels.debit} ({labels.period_turnover})</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(report.total_debit)}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-orange-600">{labels.credit} ({labels.period_turnover})</p>
                <p className="text-lg font-bold text-orange-700">{formatCurrency(report.total_credit)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600">{labels.closing_balance}</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(report.closing_balance)}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <div className="py-16 text-center text-slate-500">{labels.no_transactions}</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[40px] text-center">№</TableHead>
                        <TableHead className="w-[90px]">{labels.date}</TableHead>
                        <TableHead className="w-[120px]">{labels.document}</TableHead>
                        <TableHead>{labels.description}</TableHead>
                        <TableHead className="w-[80px] text-center">{labels.counterpart_account}</TableHead>
                        <TableHead className="w-[120px] text-right">{labels.debit}</TableHead>
                        <TableHead className="w-[120px] text-right">{labels.credit}</TableHead>
                        <TableHead className="w-[130px] text-right">{labels.balance}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Opening Balance Row */}
                      <TableRow className="bg-slate-50/80 font-semibold">
                        <TableCell colSpan={5} className="text-slate-700">
                          {labels.opening_balance}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(report.opening_balance)}
                        </TableCell>
                      </TableRow>

                      {/* Transaction Rows */}
                      {paginatedTransactions.map((tx, index) => {
                        const rowNum = (currentPage - 1) * pageSize + index + 1;
                        return (
                          <TableRow key={index} className="hover:bg-slate-50/50">
                            <TableCell className="text-center text-xs text-slate-400">
                              {rowNum}
                            </TableCell>
                            <TableCell className="text-sm">
                              {tx.date ? format(new Date(tx.date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-sm font-mono text-xs">
                              {tx.entry_number || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div>{tx.description || '-'}</div>
                              {tx.contact_name && (
                                <div className="text-xs text-slate-400 mt-0.5">{tx.contact_name}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {tx.counterpart_code ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {tx.counterpart_code}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {tx.debit_amount > 0 ? (
                                <span className="text-blue-700 font-medium">{formatCurrency(tx.debit_amount)}</span>
                              ) : ''}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {tx.credit_amount > 0 ? (
                                <span className="text-orange-700 font-medium">{formatCurrency(tx.credit_amount)}</span>
                              ) : ''}
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">
                              {formatCurrency(tx.running_balance)}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Turnover Row */}
                      <TableRow className="bg-slate-100/80 font-semibold border-t-2">
                        <TableCell colSpan={5} className="text-slate-700">
                          {labels.period_turnover}
                        </TableCell>
                        <TableCell className="text-right text-blue-700 font-bold">
                          {formatCurrency(report.total_debit)}
                        </TableCell>
                        <TableCell className="text-right text-orange-700 font-bold">
                          {formatCurrency(report.total_credit)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>

                      {/* Closing Balance Row */}
                      <TableRow className="bg-green-50/80 font-semibold">
                        <TableCell colSpan={5} className="text-green-700 font-bold">
                          {labels.closing_balance}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-green-700 font-bold text-base">
                          {formatCurrency(report.closing_balance)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                      {transactions.length} {language === 'ru' ? 'записей' : language === 'uz' ? 'ta yozuv' : 'records'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-slate-600">
                        {currentPage} {labels.page_of} {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
