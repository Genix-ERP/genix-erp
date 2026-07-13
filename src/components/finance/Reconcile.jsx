import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Scale, Search, User, Building2, ArrowDownLeft, ArrowUpRight,
  Link2, Wallet, CheckCircle, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useSales } from "@/components/contexts/SalesContext";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import financeService from "@/api/services/finance";
import { toast } from 'sonner';

// Odoo-style reconciliation: list each partner's balance (due + unallocated
// credit), drill into a partner to see their open documents and available
// credit, then apply that credit to settle open invoices/bills.
export default function Reconcile() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const { refreshData: refreshSalesData } = useSales();
  const { refreshData: refreshFinancials } = useFinancials();

  const tr = useCallback((uz, ru, en) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);

  const [direction, setDirection] = useState('customer');
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [selectedPartner, setSelectedPartner] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const isCustomer = direction === 'customer';

  const loadBalances = useCallback(async (dir) => {
    setLoading(true);
    try {
      const data = await financeService.getPartnerBalances(dir);
      setBalances(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load partner balances:', err);
      toast.error(err?.response?.data?.error || err?.message || tr('Yuklab bo\'lmadi', 'Не удалось загрузить', 'Failed to load'));
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { loadBalances(direction); }, [direction, loadBalances]);

  const loadLedger = useCallback(async (partner, dir) => {
    setLedgerLoading(true);
    try {
      const data = await financeService.getPartnerLedger(partner.contact_id, dir);
      setLedger(data || null);
    } catch (err) {
      console.error('Failed to load partner ledger:', err);
      toast.error(err?.response?.data?.error || err?.message || tr('Yuklab bo\'lmadi', 'Не удалось загрузить', 'Failed to load'));
      setLedger(null);
    } finally {
      setLedgerLoading(false);
    }
  }, [tr]);

  const openPartner = (partner) => {
    setSelectedPartner(partner);
    setLedger(null);
    loadLedger(partner, direction);
  };

  const closePartner = () => {
    setSelectedPartner(null);
    setLedger(null);
  };

  // Apply available credit to one document (backend caps at doc due & credit).
  const applyToDoc = async (doc) => {
    if (!selectedPartner) return;
    setApplying(true);
    try {
      const res = await financeService.reconcilePartnerCredit({
        contact_id: selectedPartner.contact_id,
        direction,
        document_id: doc.id,
        amount: 0, // settle as much as the available credit allows
      });
      const applied = res?.applied || 0;
      toast.success(
        `${formatCurrency(applied)} ` +
        (res?.fully_paid
          ? tr('to\'liq yopildi', 'полностью закрыто', 'fully settled')
          : tr('hisobga olindi', 'зачтено', 'applied'))
      );
      await loadLedger(selectedPartner, direction);
      await loadBalances(direction);
      try { await refreshSalesData(); } catch { /* ignore */ }
      try { await refreshFinancials(); } catch { /* ignore */ }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || tr('Xatolik', 'Ошибка', 'Error'));
    } finally {
      setApplying(false);
    }
  };

  // Auto-match: apply credit oldest-first across all open docs until exhausted.
  const autoMatch = async () => {
    if (!selectedPartner || !ledger) return;
    setApplying(true);
    try {
      let applied = 0;
      for (const doc of (ledger.open_docs || [])) {
        const res = await financeService.reconcilePartnerCredit({
          contact_id: selectedPartner.contact_id,
          direction,
          document_id: doc.id,
          amount: 0,
        }).catch(() => null);
        if (res?.applied) applied += res.applied;
      }
      if (applied > 0.001) {
        toast.success(`${formatCurrency(applied)} ${tr('hisobga olindi', 'зачтено', 'applied')}`);
      } else {
        toast.info(tr('Hisobga olinadigan kredit yo\'q', 'Нет кредита для зачёта', 'No credit to apply'));
      }
      await loadLedger(selectedPartner, direction);
      await loadBalances(direction);
      try { await refreshSalesData(); } catch { /* ignore */ }
      try { await refreshFinancials(); } catch { /* ignore */ }
    } finally {
      setApplying(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = balances;
    if (q) list = list.filter(p => (p.name || '').toLowerCase().includes(q));
    return list;
  }, [balances, search]);

  const totals = useMemo(() => ({
    due: balances.reduce((s, p) => s + (p.due || 0), 0),
    credit: balances.reduce((s, p) => s + (p.credit || 0), 0),
    partners: balances.length,
  }), [balances]);

  const subTabClass = "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600";

  return (
    <div className="space-y-6">
      {/* Direction toggle */}
      <Tabs value={direction} onValueChange={(v) => { setDirection(v); setSearch(''); }}>
        <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm">
          <TabsTrigger value="customer" className={subTabClass}>
            <ArrowDownLeft className="w-4 h-4" />
            {tr('Mijozlar', 'Клиенты', 'Customers')}
          </TabsTrigger>
          <TabsTrigger value="vendor" className={subTabClass}>
            <ArrowUpRight className="w-4 h-4" />
            {tr('Yetkazib beruvchilar', 'Поставщики', 'Vendors')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{isCustomer ? tr('Jami qarz', 'Итого долг', 'Total due') : tr('Jami to\'lov', 'Итого к оплате', 'Total payable')}</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.due)}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{tr('Bo\'sh kredit (balans)', 'Свободный кредит', 'Unallocated credit')}</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.credit)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{isCustomer ? tr('Mijozlar', 'Клиенты', 'Customers') : tr('Yetkazib beruvchilar', 'Поставщики', 'Vendors')}</p>
              <p className="text-2xl font-bold text-slate-900">{totals.partners}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              {isCustomer ? <User className="w-6 h-6 text-slate-600" /> : <Building2 className="w-6 h-6 text-slate-600" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partner balances list (Odoo-style) */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Scale className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {tr('Solishtirish', 'Сопоставление', 'Reconcile')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {tr('Kreditni ochiq hujjatlarga taqsimlash', 'Зачёт кредита по открытым документам', 'Apply credit to open documents')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={tr('Qidirish...', 'Поиск...', 'Search...')}
                  className="pl-9 bg-slate-50 h-9 w-[200px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={() => loadBalances(direction)} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-[var(--genix-purple)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              {tr('Ma\'lumot yo\'q', 'Нет данных', 'No data')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700">{isCustomer ? tr('Mijoz', 'Клиент', 'Customer') : tr('Yetkazib beruvchi', 'Поставщик', 'Vendor')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{tr('Hisob-faktura', 'Выставлено', 'Invoiced')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{tr('To\'langan', 'Оплачено', 'Paid')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{tr('Qarz', 'Долг', 'Due')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">{tr('Bo\'sh kredit', 'Кредит', 'Credit')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">{tr('Amal', 'Действие', 'Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.contact_id} className="hover:bg-blue-50/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isCustomer ? <User className="w-4 h-4 text-blue-500" /> : <Building2 className="w-4 h-4 text-orange-500" />}
                          <span className="font-medium text-slate-800">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{formatCurrency(p.invoiced || 0)}</TableCell>
                      <TableCell className="text-right tabular-nums text-green-600">{formatCurrency(p.paid || 0)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-red-600">{(p.due || 0) > 0.001 ? formatCurrency(p.due) : '-'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-green-700">
                        {(p.credit || 0) > 0.001 ? formatCurrency(p.credit) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 border-[var(--genix-purple)]/30 text-[var(--genix-purple)] hover:bg-[var(--genix-purple)]/5"
                          onClick={() => openPartner(p)}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          {tr('Solishtirish', 'Сопоставить', 'Reconcile')}
                          {(p.credit || 0) > 0.001 && (
                            <Badge className="ml-1 bg-green-100 text-green-700 text-[10px] px-1.5 py-0">{formatCurrency(p.credit)}</Badge>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconcile dialog */}
      <Dialog open={!!selectedPartner} onOpenChange={(o) => { if (!o) closePartner(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Scale className="w-5 h-5 text-[var(--genix-purple)]" />
              {selectedPartner?.name}
            </DialogTitle>
            <DialogDescription>
              {tr('Ochiq hujjatlar va mavjud kreditni solishtirish', 'Сопоставление открытых документов и доступного кредита', 'Match open documents with available credit')}
            </DialogDescription>
          </DialogHeader>

          {ledgerLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[var(--genix-purple)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : ledger ? (
            <div className="space-y-4 py-2">
              {/* Credit banner */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-slate-600">{tr('Mavjud kredit', 'Доступный кредит', 'Available credit')}:</span>
                  <span className="font-bold text-green-700">{formatCurrency(ledger.credit_available || 0)}</span>
                </div>
                {(ledger.credit_available || 0) > 0.001 && (ledger.open_docs || []).length > 0 && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={autoMatch} disabled={applying}>
                    <Link2 className="w-4 h-4 mr-1" />
                    {tr('Avtomatik solishtirish', 'Авто-сопоставление', 'Auto-match')}
                  </Button>
                )}
              </div>

              {/* Open documents */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  {tr('Ochiq hujjatlar', 'Открытые документы', 'Open documents')} ({(ledger.open_docs || []).length})
                </p>
                {(ledger.open_docs || []).length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">{tr('Ochiq hujjatlar yo\'q', 'Нет открытых документов', 'No open documents')}</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold text-slate-700">{tr('Raqam', 'Номер', 'Number')}</TableHead>
                          <TableHead className="font-semibold text-slate-700">{tr('Sana', 'Дата', 'Date')}</TableHead>
                          <TableHead className="font-semibold text-slate-700 text-right">{tr('Jami', 'Итого', 'Total')}</TableHead>
                          <TableHead className="font-semibold text-slate-700 text-right">{tr('Qarz', 'Долг', 'Due')}</TableHead>
                          <TableHead className="font-semibold text-slate-700 text-center">{tr('Amal', 'Действие', 'Action')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ledger.open_docs || []).map((doc) => (
                          <TableRow key={doc.id} className="hover:bg-blue-50/50">
                            <TableCell className="font-mono text-sm">{doc.invoice_number || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {doc.invoice_date ? format(new Date(doc.invoice_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(doc.total_amount || 0)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-red-600">{formatCurrency(doc.due || 0)}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50"
                                disabled={applying || (ledger.credit_available || 0) <= 0.001}
                                onClick={() => applyToDoc(doc)}
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                {tr('Kreditni qo\'llash', 'Зачесть', 'Apply credit')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {(ledger.credit_available || 0) <= 0.001 && (ledger.open_docs || []).length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    {tr('Bu kontragentda bo\'sh kredit yo\'q. Avval to\'lov kiriting (To\'lovlar bo\'limida).',
                        'У контрагента нет свободного кредита. Сначала зарегистрируйте платёж (раздел Платежи).',
                        'No available credit for this partner. Register a payment first (Payments section).')}
                  </p>
                )}
              </div>

              {/* Payments behind the credit */}
              {(ledger.payments || []).length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    {tr('Taqsimlanmagan to\'lovlar', 'Нераспределённые платежи', 'Unallocated payments')}
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold text-slate-700">{tr('Raqam', 'Номер', 'Number')}</TableHead>
                          <TableHead className="font-semibold text-slate-700">{tr('Sana', 'Дата', 'Date')}</TableHead>
                          <TableHead className="font-semibold text-slate-700 text-right">{tr('Summa', 'Сумма', 'Amount')}</TableHead>
                          <TableHead className="font-semibold text-slate-700 text-right">{tr('Bo\'sh', 'Свободно', 'Unallocated')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ledger.payments || []).map((pay) => (
                          <TableRow key={pay.id}>
                            <TableCell className="font-mono text-sm">{pay.payment_number || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {pay.payment_date ? format(new Date(pay.payment_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(pay.amount || 0)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-green-700">{formatCurrency(pay.unallocated || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">{tr('Ma\'lumot yo\'q', 'Нет данных', 'No data')}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
