import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, RefreshCw, TrendingUp, TrendingDown, Globe, DollarSign,
  Euro, Coins, History, Calendar, ArrowRightLeft, Edit, Trash2, Check,
  AlertTriangle, BarChart3, Download
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAlertModal } from "@/hooks/useAlertModal";
import AlertModal from "@/components/shared/AlertModal";
import { toast } from 'sonner';

export default function CurrencyManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    currencies,
    createCurrency,
    updateCurrency,
    deleteCurrency,
    exchangeRates,
    setExchangeRate,
    getLatestExchangeRate,
    convertCurrency,
    exchangeDiffs = [],
    syncExchangeRates,
    revalueCurrency,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const { modal, showError, close } = useAlertModal();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isRevaluing, setIsRevaluing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [showRevalueModal, setShowRevalueModal] = useState(false);
  const [revalueDate, setRevalueDate] = useState(new Date().toISOString().split('T')[0]);

  const [activeTab, setActiveTab] = useState("currencies");
  const [chartCurrency, setChartCurrency] = useState('USD');
  const [showCreateCurrencyModal, setShowCreateCurrencyModal] = useState(false);
  const [showSetRateModal, setShowSetRateModal] = useState(false);
  const [showConverterModal, setShowConverterModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newCurrency, setNewCurrency] = useState({
    code: '',
    name: '',
    symbol: '',
    decimal_places: 2
  });

  const [newRate, setNewRate] = useState({
    from_currency: 'USD',
    rate: '',
    date: new Date().toISOString().split('T')[0],
    source: 'Manual'
  });

  const [converter, setConverter] = useState({
    amount: 1,
    from: 'USD',
    to: 'UZS',
    result: null
  });

  const foreignCurrencies = useMemo(() => currencies.filter(c => !c.is_base), [currencies]);

  // Get currency icon
  const getCurrencyIcon = (code) => {
    switch (code) {
      case 'USD':
        return <DollarSign className="w-5 h-5" />;
      case 'EUR':
        return <Euro className="w-5 h-5" />;
      default:
        return <Coins className="w-5 h-5" />;
    }
  };

  // Auto-convert when inputs change
  useEffect(() => {
    if (converter.amount && converter.from && converter.to) {
      const result = convertCurrency(parseFloat(converter.amount) || 0, converter.from, converter.to);
      setConverter(prev => ({ ...prev, result }));
    }
  }, [converter.amount, converter.from, converter.to, convertCurrency]);

  const handleCreateCurrency = async () => {
    setIsSaving(true);
    try {
      await createCurrency(newCurrency);
      setNewCurrency({ code: '', name: '', symbol: '', decimal_places: 2 });
      setShowCreateCurrencyModal(false);
    } catch (err) {
      console.error('Error creating currency:', err);
      const errorMsg = err.response?.data?.error?.message || err.message || 'Failed to create currency';
      showError(errorMsg);
    
      toast.error((err?.response?.data?.message) || (err?.response?.data?.error) || err?.message || 'Amalni bajarib bo\'lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetRate = async () => {
    setIsSaving(true);
    try {
      await setExchangeRate(newRate.from_currency, {
        rate: parseFloat(newRate.rate),
        date: newRate.date,
        source: newRate.source
      });
      setNewRate({
        from_currency: 'USD',
        rate: '',
        date: new Date().toISOString().split('T')[0],
        source: 'Manual'
      });
      setShowSetRateModal(false);
    } catch (err) {
      console.error('Error setting exchange rate:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Get rates history for a currency
  const getRateHistory = (currencyCode) => {
    return exchangeRates
      .filter(r => r.from_currency === currencyCode)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Calculate rate change — returns { delta, percent } or null
  const getRateChange = (currencyCode) => {
    const history = getRateHistory(currencyCode);
    if (history.length === 0) return null;
    const latest = history[0];
    // Prefer backend-provided previous_rate / rate_change fields
    if (latest.previous_rate && latest.previous_rate > 0) {
      const delta = latest.rate_change || (latest.rate - latest.previous_rate);
      const percent = latest.rate_change_percent != null
        ? latest.rate_change_percent.toFixed(1)
        : ((delta / latest.previous_rate) * 100).toFixed(1);
      return { delta: Math.round(delta), percent };
    }
    // Fallback: compare last two history entries
    if (history.length < 2) return null;
    const current = history[0].rate;
    const previous = history[1].rate;
    const delta = current - previous;
    const percent = ((delta) / previous * 100).toFixed(1);
    return { delta: Math.round(delta), percent };
  };

  // Handle CBU sync
  const handleSyncRates = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await syncExchangeRates();
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Error syncing rates:', err);
      setSyncError(err.message || 'Sinxronlash xatosi');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle revaluation
  const handleRevalue = async () => {
    setIsRevaluing(true);
    try {
      await revalueCurrency({ date: revalueDate });
      setShowRevalueModal(false);
    } catch (err) {
      console.error('Error revaluing currency:', err);
    } finally {
      setIsRevaluing(false);
    }
  };

  // Exchange diff stats
  const diffStats = {
    totalPositive: exchangeDiffs.filter(d => d.type === 'positive').reduce((s, d) => s + (d.amount_uzs || 0), 0),
    totalNegative: exchangeDiffs.filter(d => d.type === 'negative').reduce((s, d) => s + (d.amount_uzs || 0), 0),
    total: exchangeDiffs.length
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {currencies.filter(c => !c.is_base).slice(0, 3).map((currency) => {
          const latestRate = getLatestExchangeRate(currency.code);
          const rateChange = getRateChange(currency.code);
          return (
            <Card key={currency.code} className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      {getCurrencyIcon(currency.code)}
                    </div>
                    <div>
                      <p className="font-semibold">{currency.code}</p>
                      <p className="text-xs text-slate-500">{currency.name}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {latestRate ? formatCurrency(latestRate.rate) : '-'}
                    </p>
                  </div>
                  {rateChange && (
                    <Badge className={rateChange.delta >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {rateChange.delta >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {rateChange.delta >= 0 ? '+' : ''}{rateChange.percent}%
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">{t('currencies') || 'Currencies'}</p>
                <p className="text-2xl font-bold text-purple-800">{currencies.length}</p>
                <p className="text-xs text-purple-500">{currencies.filter(c => c.is_active).length} {t('active_currencies') || 'active'}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Converter */}
      <Card className="bg-gradient-to-r from-[var(--genix-navy)]/5 to-[var(--genix-purple)]/5">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <NumberInput
                value={converter.amount}
                onChange={(raw) => setConverter({ ...converter, amount: raw })}
                className="w-32 text-center font-semibold"
              />
              <Select value={converter.from} onValueChange={(v) => setConverter({ ...converter, from: v })}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRightLeft className="w-6 h-6 text-slate-400" />

            <div className="flex items-center gap-2 flex-1">
              <Select value={converter.to} onValueChange={(v) => setConverter({ ...converter, to: v })}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="px-4 py-2 bg-white rounded-lg border min-w-[120px] text-center">
                <span className={`font-semibold ${converter.result === null ? 'text-slate-400 text-sm' : ''}`}>
                  {converter.from === converter.to
                    ? formatCurrency(parseFloat(converter.amount) || 0, converter.to)
                    : converter.result !== null
                      ? formatCurrency(converter.result, converter.to)
                      : (t('rate_not_set') || "Kurs kiritilmagan")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <TabsList className="bg-white/80 backdrop-blur-sm p-1 rounded-lg border border-slate-200">
            <TabsTrigger value="currencies" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <Coins className="w-4 h-4 mr-2" />
              {t('currencies') || 'Currencies'}
            </TabsTrigger>
            <TabsTrigger value="rates" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <History className="w-4 h-4 mr-2" />
              {t('rates_history') || 'Rate History'}
            </TabsTrigger>
            <TabsTrigger value="exchange_diffs" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t('exchange_diffs') || 'Exchange Diffs'}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {/* Sync status */}
            {lastSyncTime && !syncError && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" />
                {t('synced') || 'Yangilandi'}: {format(lastSyncTime, 'dd.MM.yyyy, HH:mm')}
              </span>
            )}
            {syncError && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {syncError}
              </span>
            )}
            {canCreate(MODULES.FINANCIALS) && (
              <Button
                onClick={handleSyncRates}
                disabled={isSyncing}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? (t('loading') || 'Syncing...') : syncError ? (t('retry') || 'Qayta urinish') : (t('sync_from_cbu') || 'Sync from CBU')}
              </Button>
            )}
            {activeTab === 'currencies' && canCreate(MODULES.FINANCIALS) && (
              <Button
                onClick={() => setShowCreateCurrencyModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('new_currency') || 'New Currency'}
              </Button>
            )}
            {activeTab === 'rates' && canCreate(MODULES.FINANCIALS) && (
              <Button
                onClick={() => setShowSetRateModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('set_rate') || 'Set Rate'}
              </Button>
            )}
            {activeTab === 'exchange_diffs' && canCreate(MODULES.FINANCIALS) && (
              <Button
                onClick={() => setShowRevalueModal(true)}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {t('revaluation') || 'Revaluation'}
              </Button>
            )}
          </div>
        </div>

        {/* Currencies Tab */}
        <TabsContent value="currencies">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('code') || 'Code'}</TableHead>
                    <TableHead>{t('currency_name') || 'Name'}</TableHead>
                    <TableHead>{t('symbol') || 'Symbol'}</TableHead>
                    <TableHead>{t('current_rate') || 'Current Rate'}</TableHead>
                    <TableHead>{t('change') || 'Change'}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((currency) => {
                    const latestRate = getLatestExchangeRate(currency.code);
                    const rateChange = getRateChange(currency.code);
                    return (
                      <TableRow key={currency.code} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                              {getCurrencyIcon(currency.code)}
                            </div>
                            <span className="font-semibold">{currency.code}</span>
                            {currency.is_base && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs font-semibold px-2 py-0.5" title={t('base_currency_tooltip') || "Tizimning asosiy valyutasi — barcha kurslar shu valyutaga nisbatan hisoblanadi"}>
                                ★ {t('base_currency') || 'Asosiy valyuta'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{currency.name}</TableCell>
                        <TableCell className="text-lg">{currency.symbol}</TableCell>
                        <TableCell className="font-semibold">
                          {currency.is_base ? (
                            <span className="text-slate-400">1.00</span>
                          ) : (
                            latestRate ? formatCurrency(latestRate.rate) : <span className="text-slate-400">{t('rate_not_set') || "Kiritilmagan"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rateChange ? (
                            <div className={`flex items-center gap-1 text-sm font-medium ${rateChange.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {rateChange.delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              <span>{rateChange.delta >= 0 ? '+' : ''}{rateChange.delta.toLocaleString()} so'm</span>
                              <span className="text-xs opacity-70">({rateChange.delta >= 0 ? '+' : ''}{rateChange.percent}%)</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={currency.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {currency.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!currency.is_base && canUpdate(MODULES.FINANCIALS) && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setNewRate({ ...newRate, from_currency: currency.code });
                                  setShowSetRateModal(true);
                                }}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rates History Tab */}
        <TabsContent value="rates">
          {/* Chart Section */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('rate_chart') || 'Kurs grafigi'}</CardTitle>
                <Select value={chartCurrency} onValueChange={setChartCurrency}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {foreignCurrencies.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const chartData = exchangeRates
                  .filter(r => r.from_currency === chartCurrency)
                  .sort((a, b) => new Date(a.effective_date || a.date) - new Date(b.effective_date || b.date))
                  .map(r => ({
                    date: format(new Date(r.effective_date || r.date), 'dd.MM'),
                    fullDate: format(new Date(r.effective_date || r.date), 'dd.MM.yyyy'),
                    rate: r.rate,
                  }));
                if (chartData.length === 0) {
                  return <p className="text-center text-slate-500 py-8">{t('no_rates_history') || 'Kurs tarixi mavjud emas'}</p>;
                }
                const rates = chartData.map(d => d.rate);
                const minRate = Math.floor(Math.min(...rates) * 0.999);
                const maxRate = Math.ceil(Math.max(...rates) * 1.001);
                return (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[minRate, maxRate]} tick={{ fontSize: 12 }} tickFormatter={v => new Intl.NumberFormat('uz-UZ').format(v)} />
                      <Tooltip
                        formatter={(value) => [new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(value) + " so'm", 'Kurs']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                      />
                      <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('date') || 'Sana'}</TableHead>
                    <TableHead>{t('currency') || 'Valyuta'}</TableHead>
                    <TableHead className="text-right">{t('previous_rate') || 'Oldingi kurs'}</TableHead>
                    <TableHead className="text-right">{t('rate') || 'Joriy kurs'}</TableHead>
                    <TableHead className="text-right">{t('change') || "O'zgarish"}</TableHead>
                    <TableHead>{t('source') || 'Manba'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeRates
                    .sort((a, b) => new Date(b.effective_date || b.date) - new Date(a.effective_date || a.date))
                    .map((rate) => {
                      const change = rate.rate_change || 0;
                      const changePct = rate.rate_change_percent || 0;
                      const prevRate = rate.previous_rate || 0;
                      return (
                        <TableRow key={rate.id} className="hover:bg-slate-50">
                          <TableCell>{format(new Date(rate.effective_date || rate.date), 'dd.MM.yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{rate.from_currency}</Badge>
                              <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                              <Badge variant="outline">{rate.to_currency}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-500">
                            {prevRate > 0 ? formatCurrency(prevRate) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold font-mono">
                            {formatCurrency(rate.rate)}
                          </TableCell>
                          <TableCell className="text-right">
                            {prevRate > 0 ? (
                              <span className={`text-sm font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {change > 0 ? '+' : ''}{Math.round(change).toLocaleString()} so'm
                                <span className="ml-1 text-xs">({change > 0 ? '+' : ''}{changePct.toFixed(1)}%)</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{rate.source === 'CBU' ? (t('source_cbu') || 'MB') : rate.source === 'manual' || rate.source === 'Manual' ? (t('source_manual') || "Qo'lda") : rate.source}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {exchangeRates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        {t('no_rates_history') || 'No rate history'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exchange Diffs Tab */}
        <TabsContent value="exchange_diffs">
          {/* Diff Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">{t('positive_diff') || 'Positive Diff'}</p>
                    <p className="text-xl font-bold text-green-800">
                      {new Intl.NumberFormat('uz-UZ').format(diffStats.totalPositive)} so'm
                    </p>
                    <p className="text-xs text-green-500 mt-1">Kt 9540</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 font-medium">{t('negative_diff') || 'Negative Diff'}</p>
                    <p className="text-xl font-bold text-red-800">
                      {new Intl.NumberFormat('uz-UZ').format(diffStats.totalNegative)} so'm
                    </p>
                    <p className="text-xs text-red-500 mt-1">Dt 9620</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 font-medium">{t('exchange_diff') || 'Net Diff'}</p>
                    <p className={`text-xl font-bold ${diffStats.totalPositive - diffStats.totalNegative >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                      {new Intl.NumberFormat('uz-UZ').format(diffStats.totalPositive - diffStats.totalNegative)} so'm
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{diffStats.total} {t('total') || 'total'}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('currency') || 'Currency'}</TableHead>
                    <TableHead>{t('period') || 'Period'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead className="text-right">{t('amount') || 'Amount'} (UZS)</TableHead>
                    <TableHead>{t('accounting_account') || 'Account'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeDiffs.map((diff) => (
                    <TableRow key={diff.id} className="hover:bg-slate-50">
                      <TableCell>
                        <Badge variant="outline">{diff.currency_code || diff.currency_id}</Badge>
                      </TableCell>
                      <TableCell>
                        {diff.period_start && diff.period_end ? (
                          `${format(new Date(diff.period_start), 'dd.MM.yyyy')} — ${format(new Date(diff.period_end), 'dd.MM.yyyy')}`
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {diff.type === 'positive' ? (
                          <Badge className="bg-green-100 text-green-700">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {t('positive_diff') || 'Positive'}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {t('negative_diff') || 'Negative'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${diff.type === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                        {diff.type === 'positive' ? '+' : '-'}{new Intl.NumberFormat('uz-UZ').format(diff.amount_uzs)} so'm
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {diff.type === 'positive' ? 'Kt 9540' : 'Dt 9620'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {exchangeDiffs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        {t('no_transactions') || 'No exchange differences found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Currency Modal */}
      <Dialog open={showCreateCurrencyModal} onOpenChange={setShowCreateCurrencyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new_currency') || 'New Currency'}</DialogTitle>
            <DialogDescription>{t('add_new_currency') || 'Add new currency'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('code') || 'Code'}</label>
                <Input
                  value={newCurrency.code}
                  onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                  placeholder="USD"
                  maxLength={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('symbol') || 'Symbol'}</label>
                <Input
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                  placeholder="$"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('currency_name') || 'Name'}</label>
              <Input
                value={newCurrency.name}
                onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                placeholder="US Dollar"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('decimal_places') || 'Decimal places'}</label>
              <Select
                value={String(newCurrency.decimal_places)}
                onValueChange={(v) => setNewCurrency({ ...newCurrency, decimal_places: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateCurrencyModal(false)}>{t('cancel') || 'Cancel'}</Button>
              <Button
                onClick={handleCreateCurrency}
                disabled={isSaving || !newCurrency.code || !newCurrency.name}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revaluation Modal */}
      <Dialog open={showRevalueModal} onOpenChange={setShowRevalueModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('currency_revaluation') || 'Currency Revaluation'}</DialogTitle>
            <DialogDescription>{t('revaluation') || 'Calculate exchange differences for the period end'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">{t('date') || 'Date'}</label>
              <Input
                type="date"
                value={revalueDate}
                onChange={(e) => setRevalueDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRevalueModal(false)}>{t('cancel') || 'Cancel'}</Button>
              <Button
                onClick={handleRevalue}
                disabled={isRevaluing}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isRevaluing ? (t('loading') || 'Processing...') : (t('revaluation') || 'Revalue')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal modal={modal} close={close} />

      {/* Set Rate Modal */}
      <Dialog open={showSetRateModal} onOpenChange={setShowSetRateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('set_rate') || 'Set Rate'}</DialogTitle>
            <DialogDescription>{t('update_currency_rate') || 'Update currency rate'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">{t('currency') || 'Currency'}</label>
              <Select
                value={newRate.from_currency}
                onValueChange={(v) => setNewRate({ ...newRate, from_currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.filter(c => !c.is_base).map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('rate') || 'Rate'} (1 {newRate.from_currency} = ? UZS)</label>
              <NumberInput
                value={newRate.rate}
                onChange={(raw) => setNewRate({ ...newRate, rate: raw })}
                placeholder="12 650"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('date') || 'Date'}</label>
              <Input
                type="date"
                value={newRate.date}
                onChange={(e) => setNewRate({ ...newRate, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('source') || 'Source'}</label>
              <Select
                value={newRate.source}
                onValueChange={(v) => setNewRate({ ...newRate, source: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBU">{t('central_bank') || 'Central Bank of Uzbekistan'}</SelectItem>
                  <SelectItem value="Manual">{t('manual_entry') || 'Manual entry'}</SelectItem>
                  <SelectItem value="Market">{t('market_rate') || 'Market rate'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowSetRateModal(false)}>{t('cancel') || 'Cancel'}</Button>
              <Button
                onClick={handleSetRate}
                disabled={isSaving || !newRate.rate}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
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
