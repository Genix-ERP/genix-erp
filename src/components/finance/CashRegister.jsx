import React, { useState, useEffect, useCallback } from 'react';
import { financeService } from '@/api/services/finance';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Wallet, DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Calendar, User, Receipt, Filter, Download, Printer, TrendingUp, TrendingDown,
  PiggyBank, Banknote, ArrowRightLeft, CheckCircle, AlertTriangle, BookOpen, FileText, FileSpreadsheet, X
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { getApiErrorMessage } from '@/utils/apiError';
import { toast } from 'sonner';

// O'zbekiston BHMS accounting accounts for cash operations (counter accounts).
// Order numbers and the ledger JE come from the SERVER — never generated here.
const ACCOUNTING_ACCOUNTS = [
  { value: '4010', label: '4010 — Debitorlar (Дебиторы)' },
  { value: '6010', label: '6010 — Kreditorlar (Кредиторы)' },
  { value: '4220', label: '4220 — Xodimlar (Работники)' },
  { value: '6710', label: '6710 — Byudjetga to\'lovlar (Платежи в бюджет)' },
  { value: '5110', label: '5110 — Hisob-kitob schyoti (Расчётный счёт)' },
  { value: '9010', label: '9010 — Asosiy daromad (Основной доход)' },
  { value: '9410', label: '9410 — Boshqaruv xarajatlari (Управленческие расходы)' },
];

export default function CashRegister() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    cashTransactions,
    getCashBalance,
    cashPosition,
    cashRegisters = [],
    cashOrders = [],
    createCashOrder,
    confirmCashOrder,
    cancelCashOrder,
    getCashBook,
    backendAvailable,
    isLoading
  } = useFinancials();
  const { canCreate } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [activeTab, setActiveTab] = useState('orders');
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [selectedRegister, setSelectedRegister] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newOrder, setNewOrder] = useState({
    order_date: new Date().toISOString().split('T')[0],
    order_type: 'pko',
    amount: '',
    description: '',
    counterparty_name: '',
    account_code: '',
    register_id: '',
    storno_of: null
  });

  // Ledger-derived cash book from GET /cash/book
  const [cashBook, setCashBook] = useState(null);

  // Calculate summaries
  const today = new Date().toISOString().split('T')[0];
  const getDateStr = useCallback((t) => {
    if (!t.transaction_date && !t.order_date && !t.date) return '';
    const dateVal = t.transaction_date || t.order_date || t.date;
    const dateStr = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
    return dateStr.split('T')[0];
  }, []);

  const allOrders = [...cashOrders];

  // Fetch the ledger cash book (drives the Kassa kitobi tab AND the today
  // income/expense stat cards). Default window: last 30 days through today.
  const fetchCashBook = useCallback(async () => {
    if (!backendAvailable) { setCashBook(null); return; }
    const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const book = await getCashBook({
        date_from: dateFrom || defaultFrom,
        date_to: dateTo || todayStr,
        ...(selectedRegister !== 'all' ? { register_id: selectedRegister } : {})
      });
      setCashBook(book && typeof book === 'object' && !Array.isArray(book) ? book : null);
    } catch (err) {
      console.error('Failed to load cash book:', err);
      setCashBook(null);
    }
  }, [backendAvailable, getCashBook, dateFrom, dateTo, selectedRegister]);

  useEffect(() => { fetchCashBook(); }, [fetchCashBook]);

  // Order counts come from meta.total, not from the array in the browser.
  //
  // totalOrders used to be allOrders.length — a count of what had been loaded,
  // presented as a count of what exists. The mobile app already asks the
  // server (page_size=1 + meta.total), so the same screen reported two
  // different numbers depending on which app you opened.
  const [orderCounts, setOrderCounts] = useState({ total: null, confirmed: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [total, confirmed] = await Promise.all([
          financeService.countCashOrders(),
          financeService.countCashOrders({ status: 'confirmed' }),
        ]);
        if (!cancelled) setOrderCounts({ total, confirmed });
      } catch (err) {
        console.error('Failed to count cash orders:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [cashOrders.length]);

  const cashBookDays = cashBook?.days || [];
  const todayBookRow = cashBookDays.find(d => (d.date || '').split('T')[0] === today);

  // Which register drives the header balance: a specific one when selected,
  // otherwise the ledger total of kind='cash' accounts from /cash/balance.
  const activeRegister = selectedRegister !== 'all'
    ? cashRegisters.find(r => r.id === selectedRegister)
    : null;
  const cashGlAccounts = (cashPosition?.accounts || []).filter(a => a.kind === 'cash');
  const currentBalance = activeRegister
    ? (activeRegister.ledger_balance || 0)
    : getCashBalance();
  const balanceCaption = activeRegister
    ? `${activeRegister.account_code || '5010'} ${activeRegister.account_name || 'Kassa'}`
    : (cashGlAccounts.length > 0
        ? cashGlAccounts.map(a => `${a.code} ${a.name}`).join(' + ')
        : '5010 Kassa');

  const summaryStats = {
    currentBalance,
    todayIncome: todayBookRow?.income || 0,
    todayExpense: todayBookRow?.expense || 0,
    // null until the server answers — a 0 here would read as "no orders"
    // rather than "not counted yet".
    totalOrders: orderCounts.total,
    confirmedOrders: orderCounts.confirmed,
  };

  // Cash limit check (against the ledger balance)
  const limitRegister = activeRegister || cashRegisters[0];
  const cashLimitExceeded = limitRegister && limitRegister.limit_amount > 0
    && (limitRegister.ledger_balance || 0) > limitRegister.limit_amount;

  // Filter orders
  useEffect(() => {
    let filtered = [...allOrders];

    if (searchQuery) {
      filtered = filtered.filter(o =>
        o.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.counterparty_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.partner_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (codeFilter) {
      const cf = codeFilter.toLowerCase();
      filtered = filtered.filter(o => o.order_number?.toLowerCase().includes(cf));
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter(o => o.order_type === typeFilter);
    }
    if (selectedRegister !== "all") {
      filtered = filtered.filter(o => o.register_id === selectedRegister);
    }
    if (dateFrom) {
      filtered = filtered.filter(o => {
        const d = getDateStr(o);
        return d && d >= dateFrom;
      });
    }
    if (dateTo) {
      filtered = filtered.filter(o => {
        const d = getDateStr(o);
        return d && d <= dateTo;
      });
    }
    if (!dateFrom && !dateTo) {
      if (dateFilter === "today") {
        filtered = filtered.filter(o => getDateStr(o) === today);
      } else if (dateFilter === "week") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        filtered = filtered.filter(o => getDateStr(o) >= weekAgo);
      } else if (dateFilter === "month") {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        filtered = filtered.filter(o => getDateStr(o) >= monthAgo);
      }
    }
    setFilteredOrders(filtered.sort((a, b) => new Date(b.order_date || b.date) - new Date(a.order_date || a.date)));
  }, [cashOrders, searchQuery, codeFilter, typeFilter, dateFilter, dateFrom, dateTo, selectedRegister, today, getDateStr]);

  // Filter legacy transactions
  useEffect(() => {
    let filtered = [...(cashTransactions || [])];
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredTransactions(filtered.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)));
  }, [cashTransactions, searchQuery]);

  const resetNewOrder = (overrides = {}) => setNewOrder({
    order_date: new Date().toISOString().split('T')[0],
    order_type: 'pko',
    amount: '',
    description: '',
    counterparty_name: '',
    account_code: '',
    register_id: selectedRegister !== 'all' ? selectedRegister : '',
    storno_of: null,
    ...overrides
  });

  // Order number is SERVER-generated (PKO-YYYY-NNNN) — nothing is sent from
  // the client, and an API failure surfaces as a toast instead of a ghost row.
  const handleCreateOrder = async () => {
    setIsSaving(true);
    try {
      await createCashOrder({
        type: newOrder.order_type,
        amount: parseFloat(newOrder.amount) || 0,
        description: newOrder.description,
        date: newOrder.order_date || undefined,
        register_id: newOrder.register_id || undefined,
        counterparty_name: newOrder.counterparty_name || undefined,
        account_code: newOrder.account_code || undefined
      });
      resetNewOrder();
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating cash order:', err);
      toast.error(getApiErrorMessage(err, t('error_occurred') || 'Xatolik yuz berdi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmOrder = async (orderId) => {
    try {
      const result = await confirmCashOrder(orderId);
      const entryNo = result?.entry_number;
      toast.success(`${t('order_confirmed') || 'Order tasdiqlandi'}${entryNo ? ` — JE: ${entryNo}` : ''}`);
      fetchCashBook();
    } catch (err) {
      console.error('Error confirming order:', err);
      toast.error(getApiErrorMessage(err, t('error_occurred') || 'Xatolik yuz berdi'));
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await cancelCashOrder(orderId);
      toast.success(t('order_cancelled') || 'Order bekor qilindi');
    } catch (err) {
      console.error('Error cancelling order:', err);
      toast.error(getApiErrorMessage(err, t('error_occurred') || 'Xatolik yuz berdi'));
    }
  };

  // Confirmed orders are immutable — storno creates the OPPOSITE order with
  // the same amount, referencing the original in the description.
  const handleStorno = (order) => {
    resetNewOrder({
      order_type: order.order_type === 'pko' ? 'rko' : 'pko',
      amount: String(order.amount || ''),
      description: `${t('storno') || 'Storno'} ${order.order_number}: ${order.description || ''}`.trim(),
      counterparty_name: order.counterparty_name || order.partner_name || '',
      account_code: order.account_code || '',
      register_id: order.register_id || '',
      storno_of: order.order_number
    });
    setShowCreateModal(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />{t('confirmed') || 'Confirmed'}</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-700">{t('draft') || 'Draft'}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700">{t('cancelled') || 'Cancelled'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Cash Book rows come from GET /cash/book (ledger-derived) — no client-side
  // running-balance computation. Newest day first for display.
  const cashBookData = [...cashBookDays].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const activeFilterCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (codeFilter ? 1 : 0);
  const clearAllFilters = () => { setDateFrom(''); setDateTo(''); setCodeFilter(''); setSearchQuery(''); setTypeFilter('all'); setDateFilter('all'); };

  // Export to Excel
  const handleExportExcel = async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GenixERP';
    wb.created = new Date();
    const sheetName = (t('cash_orders') || 'Kassa orderlari').substring(0, 31);
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const HEADER_BG = '1E3A5F';
    const HEADER_FG = 'FFFFFF';
    const BORDER_CLR = 'CBD5E1';
    const STRIPE_BG = 'F8FAFC';
    const TOTAL_BG = 'EEF2FF';
    const BRAND_BLUE = '4F46E5';
    const thin = { style: 'thin', color: { argb: BORDER_CLR } };
    const borders = { top: thin, bottom: thin, left: thin, right: thin };
    const thickTop = { style: 'medium', color: { argb: BRAND_BLUE } };
    ws.columns = [
      { width: 5.5 }, { width: 24 }, { width: 13 }, { width: 10 }, { width: 24 },
      { width: 24 }, { width: 40 }, { width: 20 }, { width: 13 },
    ];
    const periodText = `${dateFrom || '...'} — ${dateTo || '...'}`;
    const titleRow = ws.addRow([t('cash_orders') || 'Kassa orderlari (PKO / RKO)']);
    ws.mergeCells(`A${titleRow.number}:I${titleRow.number}`);
    titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: '1E293B' } };
    titleRow.getCell(1).alignment = { vertical: 'middle' };
    titleRow.height = 30;
    const subRow = ws.addRow([`${periodText}  •  ${filteredOrders.length} ${t('entries_total') || 'yozuv'}`]);
    ws.mergeCells(`A${subRow.number}:I${subRow.number}`);
    subRow.getCell(1).font = { size: 10, color: { argb: '64748B' } };
    subRow.height = 18;
    ws.addRow([]);
    const headers = ['№', t('cash_order_number') || 'Order #', t('date') || 'Sana', t('type') || 'Tur', t('counterparty') || 'Kontragent', t('accounting_account') || 'Schyot', t('description') || 'Tavsif', t('amount') || 'Summa', t('status') || 'Holat'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 11, color: { argb: HEADER_FG } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borders;
    });
    let sumAmount = 0;
    filteredOrders.forEach((order, idx) => {
      const amt = order.amount || 0;
      sumAmount += order.order_type === 'pko' ? amt : -amt;
      const isStripe = idx % 2 === 1;
      const row = ws.addRow([
        idx + 1,
        order.order_number || '-',
        order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '-',
        order.order_type === 'pko' ? 'PKO' : 'RKO',
        order.counterparty_name || order.partner_name || '-',
        order.account_code || '-',
        order.description || '-',
        amt,
        order.status || '-',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10 };
        cell.border = borders;
        cell.alignment = { vertical: 'middle' };
        if (isStripe) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_BG } };
        if (colNumber === 8) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
        if (colNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (colNumber === 2) cell.font = { size: 10, name: 'Consolas' };
      });
    });
    const totRow = ws.addRow(['', '', '', '', '', '', t('total') || 'Jami:', Math.abs(sumAmount), '']);
    totRow.height = 28;
    totRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      cell.border = { ...borders, top: { ...thickTop } };
      cell.font = { bold: true, size: 11, color: { argb: '1E293B' } };
      cell.alignment = { vertical: 'middle' };
      if (colNumber === 8) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
    });
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: 9 } };
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kassa_orderlari_${dateFrom || 'all'}_${dateTo || 'all'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Cash Limit Warning */}
      {cashLimitExceeded && (
        <Card className="bg-amber-50 border-amber-300">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">{t('cash_limit_warning') || 'Cash limit exceeded!'}</p>
              <p className="text-sm text-amber-600">
                {t('cash_limit') || 'Cash Limit'}: {formatCurrency(limitRegister.limit_amount)} | {t('cash_balance') || 'Balance'}: {formatCurrency(limitRegister.ledger_balance || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">{t('cash_balance') || 'Cash Balance'}</p>
                <p className="text-3xl font-bold text-emerald-800">{formatCurrencyCompact(summaryStats.currentBalance)}</p>
                <p className="text-xs text-emerald-500 mt-1 font-mono">{balanceCaption}</p>
              </div>
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-7 h-7 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">{t('pko_short') || 'PKO'} ({t('today') || 'Today'})</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrencyCompact(summaryStats.todayIncome)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">{t('rko_short') || 'RKO'} ({t('today') || 'Today'})</p>
                <p className="text-2xl font-bold text-red-800">{formatCurrencyCompact(summaryStats.todayExpense)}</p>
              </div>
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">{t('cash_orders') || 'Cash Orders'}</p>
                <p className="text-2xl font-bold text-blue-800">{summaryStats.totalOrders ?? '—'}</p>
                <p className="text-xs text-blue-500">{summaryStats.confirmedOrders ?? '—'} {t('confirmed') || 'confirmed'}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Register Selector + Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          {cashRegisters.length > 0 && (
            <Select value={selectedRegister} onValueChange={setSelectedRegister}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={t('select_cash_register') || 'Select cash register'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                {cashRegisters.map(reg => (
                  <SelectItem key={reg.id} value={reg.id}>
                    {reg.name} ({reg.currency || 'UZS'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {canCreate(MODULES.FINANCIALS) && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                resetNewOrder({ order_type: 'pko' });
                setShowCreateModal(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <ArrowDownLeft className="w-4 h-4 mr-2" />
              {t('pko_short') || 'PKO'}
            </Button>
            <Button
              onClick={() => {
                resetNewOrder({ order_type: 'rko' });
                setShowCreateModal(true);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              {t('rko_short') || 'RKO'}
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              {t('print') || 'Print'}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              {t('export') || 'Export'}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs: Orders & Cash Book */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm mb-4">
          <TabsTrigger
            value="orders"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
          >
            <Receipt className="w-4 h-4" />
            {t('cash_orders') || 'Cash Orders'}
          </TabsTrigger>
          <TabsTrigger
            value="cashbook"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
          >
            <BookOpen className="w-4 h-4" />
            {t('cash_book') || 'Cash Book'}
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
          >
            <Banknote className="w-4 h-4" />
            {t('cash_transactions') || 'Cash Transactions'}
          </TabsTrigger>
        </TabsList>

        {/* ===== ORDERS TAB ===== */}
        <TabsContent value="orders">
          {/* Search + Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                {/* Search row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={t('search_transaction') || 'Tranzaksiyani qidirish...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 bg-slate-50 border-slate-200"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px] h-10 bg-slate-50">
                      <SelectValue placeholder={t('type') || 'Hammasi'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all') || 'Hammasi'}</SelectItem>
                      <SelectItem value="pko">{t('pko_short') || 'PKO'}</SelectItem>
                      <SelectItem value="rko">{t('rko_short') || 'RKO'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[150px] h-10 bg-slate-50">
                      <SelectValue placeholder={t('period') || 'Hammasi'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all') || 'Hammasi'}</SelectItem>
                      <SelectItem value="today">{t('today') || 'Bugun'}</SelectItem>
                      <SelectItem value="week">{t('this_week') || 'Shu hafta'}</SelectItem>
                      <SelectItem value="month">{t('this_month') || 'Shu oy'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Always-visible filter row */}
                <div className="flex flex-wrap items-end gap-3 p-3 bg-gradient-to-r from-slate-50 to-blue-50/40 rounded-xl border border-slate-200/80">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('from_date') || 'Dan'}
                    </label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="h-9 w-[155px] bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex items-end pb-[6px]">
                    <span className="text-slate-400 text-sm font-medium">—</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('to_date') || 'Gacha'}
                    </label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="h-9 w-[155px] bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-sm"
                    />
                  </div>
                  <div className="w-px h-8 bg-slate-200 mx-1 self-end mb-[2px] hidden sm:block" />
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {t('number') || 'Raqam'}
                    </label>
                    <Input
                      placeholder={t('order_code') || 'Kod...'}
                      value={codeFilter}
                      onChange={e => setCodeFilter(e.target.value)}
                      className="h-9 w-[160px] bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-sm"
                    />
                  </div>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-slate-500 hover:text-red-500 gap-1 transition-colors">
                      <X className="w-3.5 h-3.5" />
                      {t('clear') || 'Tozalash'}
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    onClick={handleExportExcel}
                    className="h-9 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-200/60 rounded-lg px-4"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('export') || 'Export'}</span>
                    <FileSpreadsheet className="w-4 h-4 opacity-70" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('cash_orders') || 'Cash Orders'} (PKO / RKO)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('cash_order_number') || 'Order #'}</TableHead>
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead>{t('counterparty') || 'Counterparty'}</TableHead>
                    <TableHead>{t('accounting_account') || 'Account'}</TableHead>
                    <TableHead>{t('description') || 'Description'}</TableHead>
                    <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead>{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm">
                        <div className="flex flex-col gap-1">
                          <span>{order.order_number}</span>
                          {order.journal_entry_id && (
                            <Badge
                              variant="outline"
                              className="w-fit text-[10px] font-mono bg-indigo-50 text-indigo-700 border-indigo-200"
                              title={t('posted_to_ledger') || 'Ledgerga o\'tkazilgan'}
                            >
                              <FileText className="w-2.5 h-2.5 mr-1" />
                              JE: {order.entry_number || order.journal_entry_id}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '-'}</TableCell>
                      <TableCell>
                        {order.order_type === 'pko' ? (
                          <Badge className="bg-green-100 text-green-700"><ArrowDownLeft className="w-3 h-3 mr-1" />{t('pko_short') || 'PKO'}</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700"><ArrowUpRight className="w-3 h-3 mr-1" />{t('rko_short') || 'RKO'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{order.counterparty_name || order.partner_name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{order.account_code || '-'}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{order.description}</TableCell>
                      <TableCell className={`text-right font-semibold ${order.order_type === 'pko' ? 'text-green-600' : 'text-red-600'}`}>
                        {order.order_type === 'pko' ? '+' : '-'}{formatCurrency(order.amount, order.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {order.status === 'draft' && canCreate(MODULES.FINANCIALS) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleConfirmOrder(order.id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {t('confirm_order') || 'Confirm'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleCancelOrder(order.id)}
                                title={t('cancel') || 'Cancel'}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          {order.status === 'confirmed' && canCreate(MODULES.FINANCIALS) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-300 hover:bg-amber-50"
                              onClick={() => handleStorno(order)}
                              title={t('storno_tooltip') || 'Teskari order yaratish'}
                            >
                              <ArrowRightLeft className="w-3 h-3 mr-1" />
                              {t('storno') || 'Storno'}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost">
                            <Printer className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        {t('no_transactions') || 'No orders found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CASH BOOK TAB ===== */}
        <TabsContent value="cashbook">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  {t('cash_book') || 'Cash Book'}
                  {cashBook?.account_code && (
                    <Badge variant="outline" className="font-mono text-xs">{cashBook.account_code}</Badge>
                  )}
                </CardTitle>
                <Button variant="outline" size="sm">
                  <Printer className="w-4 h-4 mr-2" />
                  {t('print') || 'Print'}
                </Button>
              </div>
              {cashBook && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500 mt-2">
                  <span>{t('opening_balance') || 'Opening Balance'}: <span className="font-semibold text-slate-700">{formatCurrency(cashBook.opening_balance || 0)}</span></span>
                  <span>{t('total_income') || 'Total Income'}: <span className="font-semibold text-green-600">+{formatCurrency(cashBook.total_income || 0)}</span></span>
                  <span>{t('total_expense') || 'Total Expense'}: <span className="font-semibold text-red-600">-{formatCurrency(cashBook.total_expense || 0)}</span></span>
                  <span>{t('closing_balance') || 'Closing Balance'}: <span className="font-semibold text-slate-700">{formatCurrency(cashBook.closing_balance || 0)}</span></span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead className="text-right">{t('opening_balance') || 'Opening Balance'}</TableHead>
                    <TableHead className="text-right text-green-600">{t('total_income') || 'Total Income'}</TableHead>
                    <TableHead className="text-right text-red-600">{t('total_expense') || 'Total Expense'}</TableHead>
                    <TableHead className="text-right">{t('closing_balance') || 'Closing Balance'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashBookData.map((entry) => (
                    <TableRow key={entry.date} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{entry.date ? format(new Date(entry.date), 'dd.MM.yyyy') : '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.opening)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">+{formatCurrency(entry.income)}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">-{formatCurrency(entry.expense)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(entry.closing)}</TableCell>
                    </TableRow>
                  ))}
                  {cashBookData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        {t('no_transactions') || 'No data'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LEGACY TRANSACTIONS TAB ===== */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('cash_transactions') || 'Cash Transactions'}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead>{t('reference') || 'Reference'}</TableHead>
                    <TableHead>{t('description') || 'Description'}</TableHead>
                    <TableHead>{t('category') || 'Category'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead>{t('cashier') || 'Cashier'}</TableHead>
                    <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-slate-50">
                      <TableCell>{transaction.transaction_date ? format(new Date(transaction.transaction_date), 'dd.MM.yyyy') : '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{transaction.reference}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{transaction.description}</TableCell>
                      <TableCell><Badge variant="outline">{transaction.category}</Badge></TableCell>
                      <TableCell>
                        {transaction.type === 'income' ? (
                          <Badge className="bg-green-100 text-green-700">{t('income') || 'Income'}</Badge>
                        ) : transaction.type === 'expense' ? (
                          <Badge className="bg-red-100 text-red-700">{t('expense') || 'Expense'}</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700">{t('transfer') || 'Transfer'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{transaction.cashier || '-'}</TableCell>
                      <TableCell className={`text-right font-semibold ${
                        transaction.type === 'income' ? 'text-green-600' : transaction.type === 'expense' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        {t('no_transactions') || 'No transactions'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create PKO/RKO Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newOrder.order_type === 'pko' ? (
                <><ArrowDownLeft className="w-5 h-5 text-green-600" />{t('pko') || 'Cash Receipt Order (PKO)'}</>
              ) : (
                <><ArrowUpRight className="w-5 h-5 text-red-600" />{t('rko') || 'Cash Disbursement Order (RKO)'}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {newOrder.storno_of
                ? `${t('storno_of') || 'Storno asosi'}: ${newOrder.storno_of}`
                : (t('new_cash_order') || 'New cash order')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">{t('cash_order_number') || 'Order Number'}</label>
              <Input
                disabled
                value=""
                placeholder={t('order_number_auto') || 'Raqam serverda beriladi'}
                className="bg-slate-50 text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('date') || 'Date'}</label>
                <Input
                  type="date"
                  value={newOrder.order_date}
                  onChange={(e) => setNewOrder({ ...newOrder, order_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('type') || 'Type'}</label>
                <Select
                  value={newOrder.order_type}
                  onValueChange={(v) => setNewOrder({ ...newOrder, order_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pko">{t('pko_short') || 'PKO'} — {t('income') || 'Income'}</SelectItem>
                    <SelectItem value="rko">{t('rko_short') || 'RKO'} — {t('expense') || 'Expense'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('amount') || 'Amount'}</label>
              <NumberInput
                value={newOrder.amount}
                onChange={(raw) => setNewOrder({ ...newOrder, amount: raw })}
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('counterparty') || 'Counterparty'}</label>
              <Input
                value={newOrder.counterparty_name}
                onChange={(e) => setNewOrder({ ...newOrder, counterparty_name: e.target.value })}
                placeholder={t('enter_counterparty') || 'Enter counterparty name'}
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('accounting_account') || 'Accounting Account'}</label>
              <Select
                value={newOrder.account_code}
                onValueChange={(v) => setNewOrder({ ...newOrder, account_code: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_accounting_account') || 'Select account'} />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_ACCOUNTS.map(acc => (
                    <SelectItem key={acc.value} value={acc.value}>{acc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cashRegisters.length > 0 && (
              <div>
                <label className="text-sm font-medium">{t('cash_register') || 'Cash Register'}</label>
                <Select
                  value={newOrder.register_id}
                  onValueChange={(v) => setNewOrder({ ...newOrder, register_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_cash_register') || 'Select cash register'} />
                  </SelectTrigger>
                  <SelectContent>
                    {cashRegisters.map(reg => (
                      <SelectItem key={reg.id} value={reg.id}>{reg.name} ({reg.currency || 'UZS'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">{t('description') || 'Description'}</label>
              <Textarea
                value={newOrder.description}
                onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
                placeholder={t('transaction_description') || 'Transaction description'}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('cancel') || 'Cancel'}</Button>
              <Button
                onClick={handleCreateOrder}
                disabled={isSaving || !newOrder.amount || !newOrder.description}
                className={`text-white ${newOrder.order_type === 'pko' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
