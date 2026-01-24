import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, RefreshCw, TrendingUp, TrendingDown, Globe, DollarSign,
  Euro, Coins, History, Calendar, ArrowRightLeft, Edit, Trash2, Check
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
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [activeTab, setActiveTab] = useState("currencies");
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

  // Handle currency conversion
  const handleConvert = () => {
    const result = convertCurrency(parseFloat(converter.amount) || 0, converter.from, converter.to);
    setConverter({ ...converter, result });
  };

  useEffect(() => {
    if (converter.amount && converter.from && converter.to) {
      handleConvert();
    }
  }, [converter.amount, converter.from, converter.to]);

  const handleCreateCurrency = async () => {
    setIsSaving(true);
    try {
      await createCurrency(newCurrency);
      setNewCurrency({ code: '', name: '', symbol: '', decimal_places: 2 });
      setShowCreateCurrencyModal(false);
    } catch (err) {
      console.error('Error creating currency:', err);
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

  const formatCurrency = (amount, currency = 'UZS') => {
    if (currency === 'UZS') {
      return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  // Get rates history for a currency
  const getRateHistory = (currencyCode) => {
    return exchangeRates
      .filter(r => r.from_currency === currencyCode)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Calculate rate change
  const getRateChange = (currencyCode) => {
    const history = getRateHistory(currencyCode);
    if (history.length < 2) return null;
    const current = history[0].rate;
    const previous = history[1].rate;
    return ((current - previous) / previous * 100).toFixed(2);
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
                      {latestRate ? new Intl.NumberFormat('uz-UZ').format(latestRate.rate) : '-'}
                    </p>
                    <p className="text-xs text-slate-500">so'm</p>
                  </div>
                  {rateChange && (
                    <Badge className={parseFloat(rateChange) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {parseFloat(rateChange) >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {rateChange}%
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
              <Input
                type="number"
                value={converter.amount}
                onChange={(e) => setConverter({ ...converter, amount: e.target.value })}
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
                <span className="font-semibold">
                  {converter.result !== null ? formatCurrency(converter.result, converter.to) : '-'}
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
          </TabsList>

          <div className="flex gap-2">
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
                          </div>
                        </TableCell>
                        <TableCell>{currency.name}</TableCell>
                        <TableCell className="text-lg">{currency.symbol}</TableCell>
                        <TableCell className="font-semibold">
                          {currency.is_base ? (
                            <Badge variant="outline">{t('base_currency') || 'Base currency'}</Badge>
                          ) : (
                            latestRate ? `${new Intl.NumberFormat('uz-UZ').format(latestRate.rate)} so'm` : '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {rateChange && (
                            <Badge className={parseFloat(rateChange) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {parseFloat(rateChange) >= 0 ? '+' : ''}{rateChange}%
                            </Badge>
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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead>{t('currency') || 'Currency'}</TableHead>
                    <TableHead>{t('rate') || 'Rate'}</TableHead>
                    <TableHead>{t('source') || 'Source'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeRates
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((rate) => (
                      <TableRow key={rate.id} className="hover:bg-slate-50">
                        <TableCell>{format(new Date(rate.date), 'dd.MM.yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{rate.from_currency}</Badge>
                            <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                            <Badge variant="outline">{rate.to_currency}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {new Intl.NumberFormat('uz-UZ').format(rate.rate)} so'm
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{rate.source}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  {exchangeRates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                        {t('no_rates_history') || 'No rate history'}
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
              <Input
                type="number"
                value={newRate.rate}
                onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                placeholder="12650"
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
