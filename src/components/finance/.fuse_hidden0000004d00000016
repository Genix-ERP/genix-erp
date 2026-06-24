import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Calendar, Lock, Unlock, ChevronRight, ChevronDown,
  CalendarDays, CalendarRange, Check, X, AlertTriangle, Settings
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { format, addMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export default function FiscalPeriods() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    fiscalYears = [],
    fiscalPeriods = [],
    createFiscalYear,
    updateFiscalYear,
    closeFiscalYear,
    createFiscalPeriod,
    closeFiscalPeriod,
    reopenFiscalPeriod,
    isLoading
  } = useFinancials();
  const { canCreate } = usePermissions();

  const [showCreateYearModal, setShowCreateYearModal] = useState(false);
  const [showCloseYearModal, setShowCloseYearModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [expandedYears, setExpandedYears] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const [yearFormData, setYearFormData] = useState({
    name: '',
    code: '',
    start_date: '',
    end_date: '',
    auto_generate_periods: true,
    period_type: 'monthly', // monthly, quarterly
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    const openYears = fiscalYears.filter(y => y.status === 'open').length;
    const closedYears = fiscalYears.filter(y => y.status === 'closed').length;
    const openPeriods = fiscalPeriods.filter(p => p.status === 'open').length;
    const closedPeriods = fiscalPeriods.filter(p => p.status === 'closed').length;
    return { openYears, closedYears, openPeriods, closedPeriods };
  }, [fiscalYears, fiscalPeriods]);

  const toggleYearExpand = (yearId) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(yearId)) {
        next.delete(yearId);
      } else {
        next.add(yearId);
      }
      return next;
    });
  };

  const handleCreateYear = async () => {
    setIsSaving(true);
    try {
      const newYear = await createFiscalYear({
        ...yearFormData,
        status: 'open'
      });

      // Auto-generate periods if enabled
      if (yearFormData.auto_generate_periods && newYear) {
        const startDate = new Date(yearFormData.start_date);
        const endDate = new Date(yearFormData.end_date);
        const periods = [];

        if (yearFormData.period_type === 'monthly') {
          let currentDate = startDate;
          let periodNum = 1;
          while (currentDate < endDate) {
            const periodStart = startOfMonth(currentDate);
            const periodEnd = endOfMonth(currentDate);
            periods.push({
              fiscal_year_id: newYear.id,
              name: format(currentDate, 'MMMM yyyy'),
              code: `${yearFormData.code}-P${String(periodNum).padStart(2, '0')}`,
              period_number: periodNum,
              start_date: format(periodStart, 'yyyy-MM-dd'),
              end_date: format(periodEnd > endDate ? endDate : periodEnd, 'yyyy-MM-dd'),
              status: 'open'
            });
            currentDate = addMonths(currentDate, 1);
            periodNum++;
          }
        } else if (yearFormData.period_type === 'quarterly') {
          let currentDate = startDate;
          let periodNum = 1;
          while (currentDate < endDate) {
            const periodStart = currentDate;
            const periodEnd = addMonths(currentDate, 3);
            periods.push({
              fiscal_year_id: newYear.id,
              name: `Q${periodNum} ${format(currentDate, 'yyyy')}`,
              code: `${yearFormData.code}-Q${periodNum}`,
              period_number: periodNum,
              start_date: format(periodStart, 'yyyy-MM-dd'),
              end_date: format(periodEnd > endDate ? endDate : periodEnd, 'yyyy-MM-dd'),
              status: 'open'
            });
            currentDate = addMonths(currentDate, 3);
            periodNum++;
          }
        }

        // Create all periods
        for (const period of periods) {
          await createFiscalPeriod(period);
        }
      }

      setShowCreateYearModal(false);
      resetYearForm();
    } catch (error) {
      console.error('Error creating fiscal year:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseYear = async () => {
    if (!selectedYear) return;
    setIsSaving(true);
    try {
      // Close all open periods first
      const yearPeriods = fiscalPeriods.filter(p => p.fiscal_year_id === selectedYear.id);
      for (const period of yearPeriods) {
        if (period.status === 'open') {
          await closeFiscalPeriod(period.id);
        }
      }
      // Then close the year
      await closeFiscalYear(selectedYear.id);
      setShowCloseYearModal(false);
      setSelectedYear(null);
    } catch (error) {
      console.error('Error closing fiscal year:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePeriod = async (period) => {
    setIsSaving(true);
    try {
      if (period.status === 'open') {
        await closeFiscalPeriod(period.id);
      } else {
        await reopenFiscalPeriod(period.id);
      }
    } catch (error) {
      console.error('Error toggling period:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetYearForm = () => {
    const currentYear = new Date().getFullYear();
    setYearFormData({
      name: `Fiscal Year ${currentYear}`,
      code: `FY${currentYear}`,
      start_date: `${currentYear}-01-01`,
      end_date: `${currentYear}-12-31`,
      auto_generate_periods: true,
      period_type: 'monthly',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-100 text-green-700"><Unlock className="w-3 h-3 mr-1" /> {t('open') || 'Open'}</Badge>;
      case 'closed':
        return <Badge className="bg-red-100 text-red-700"><Lock className="w-3 h-3 mr-1" /> {t('closed') || 'Closed'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getYearPeriods = (yearId) => {
    return fiscalPeriods.filter(p => p.fiscal_year_id === yearId).sort((a, b) => a.period_number - b.period_number);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <CalendarRange className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">{t('open_years') || 'Open Years'}</p>
                <p className="text-2xl font-bold text-blue-800">{stats.openYears}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-500/20 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">{t('closed_years') || 'Closed Years'}</p>
                <p className="text-2xl font-bold text-slate-800">{stats.closedYears}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">{t('open_periods') || 'Open Periods'}</p>
                <p className="text-2xl font-bold text-green-800">{stats.openPeriods}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Check className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-medium">{t('closed_periods') || 'Closed Periods'}</p>
                <p className="text-2xl font-bold text-amber-800">{stats.closedPeriods}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{t('fiscal_periods') || 'Fiscal Periods'}</CardTitle>
                <p className="text-sm text-slate-500">{t('manage_fiscal_years_periods') || 'Manage fiscal years and accounting periods'}</p>
              </div>
            </div>
            {canCreate(MODULES.FINANCIALS) && (
              <Button
                onClick={() => { resetYearForm(); setShowCreateYearModal(true); }}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('new_fiscal_year') || 'New Fiscal Year'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {fiscalYears.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {t('no_fiscal_years') || 'No fiscal years defined'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {t('fiscal_year_description') || 'Create fiscal years to manage your accounting periods and control when transactions can be posted.'}
              </p>
              {canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => { resetYearForm(); setShowCreateYearModal(true); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_fiscal_year') || 'Create First Fiscal Year'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>{t('code') || 'Code'}</TableHead>
                  <TableHead>{t('name') || 'Name'}</TableHead>
                  <TableHead>{t('start_date') || 'Start Date'}</TableHead>
                  <TableHead>{t('end_date') || 'End Date'}</TableHead>
                  <TableHead>{t('periods') || 'Periods'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fiscalYears.map((year) => {
                  const yearPeriods = getYearPeriods(year.id);
                  const isExpanded = expandedYears.has(year.id);
                  const openPeriodsCount = yearPeriods.filter(p => p.status === 'open').length;

                  return (
                    <React.Fragment key={year.id}>
                      <TableRow className="hover:bg-slate-50">
                        <TableCell>
                          <button
                            onClick={() => toggleYearExpand(year.id)}
                            className="p-1 hover:bg-slate-200 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono font-medium">{year.code}</TableCell>
                        <TableCell className="font-medium">{year.name}</TableCell>
                        <TableCell>{format(new Date(year.start_date), 'dd.MM.yyyy')}</TableCell>
                        <TableCell>{format(new Date(year.end_date), 'dd.MM.yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {openPeriodsCount}/{yearPeriods.length} {t('open') || 'open'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(year.status)}</TableCell>
                        <TableCell>
                          {year.status === 'open' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSelectedYear(year); setShowCloseYearModal(true); }}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Lock className="w-4 h-4 mr-1" /> {t('close_year') || 'Close Year'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && yearPeriods.map((period) => (
                        <TableRow key={period.id} className="bg-slate-50/50">
                          <TableCell></TableCell>
                          <TableCell className="pl-8 font-mono text-sm text-slate-600">{period.code}</TableCell>
                          <TableCell className="text-slate-700">{period.name}</TableCell>
                          <TableCell className="text-slate-600">{format(new Date(period.start_date), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className="text-slate-600">{format(new Date(period.end_date), 'dd.MM.yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">P{period.period_number}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(period.status)}</TableCell>
                          <TableCell>
                            {year.status === 'open' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTogglePeriod(period)}
                                disabled={isSaving}
                              >
                                {period.status === 'open' ? (
                                  <><Lock className="w-4 h-4 mr-1" /> {t('close') || 'Close'}</>
                                ) : (
                                  <><Unlock className="w-4 h-4 mr-1" /> {t('reopen') || 'Reopen'}</>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Fiscal Year Modal */}
      <Dialog open={showCreateYearModal} onOpenChange={setShowCreateYearModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create_fiscal_year') || 'Create Fiscal Year'}
            </DialogTitle>
            <DialogDescription>
              {t('fiscal_year_modal_description') || 'Define a new fiscal year for your accounting.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('code') || 'Code'} *</label>
                <Input
                  placeholder="e.g., FY2025"
                  value={yearFormData.code}
                  onChange={(e) => setYearFormData({ ...yearFormData, code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name') || 'Name'} *</label>
                <Input
                  placeholder="e.g., Fiscal Year 2025"
                  value={yearFormData.name}
                  onChange={(e) => setYearFormData({ ...yearFormData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('start_date') || 'Start Date'} *</label>
                <Input
                  type="date"
                  value={yearFormData.start_date}
                  onChange={(e) => setYearFormData({ ...yearFormData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('end_date') || 'End Date'} *</label>
                <Input
                  type="date"
                  value={yearFormData.end_date}
                  onChange={(e) => setYearFormData({ ...yearFormData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto_generate"
                checked={yearFormData.auto_generate_periods}
                onCheckedChange={(checked) => setYearFormData({ ...yearFormData, auto_generate_periods: checked })}
              />
              <label htmlFor="auto_generate" className="text-sm font-medium text-slate-700 cursor-pointer">
                {t('auto_generate_periods') || 'Auto-generate accounting periods'}
              </label>
            </div>

            {yearFormData.auto_generate_periods && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('period_type') || 'Period Type'}</label>
                <Select
                  value={yearFormData.period_type}
                  onValueChange={(v) => setYearFormData({ ...yearFormData, period_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('monthly') || 'Monthly (12 periods)'}</SelectItem>
                    <SelectItem value="quarterly">{t('quarterly') || 'Quarterly (4 periods)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateYearModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleCreateYear}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !yearFormData.code || !yearFormData.name || !yearFormData.start_date || !yearFormData.end_date}
            >
              {isSaving ? (t('creating') || 'Creating...') : (t('create') || 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Year Confirmation Modal */}
      <Dialog open={showCloseYearModal} onOpenChange={setShowCloseYearModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('close_fiscal_year') || 'Close Fiscal Year'}
            </DialogTitle>
            <DialogDescription>
              {t('close_year_warning') || 'This will close all open periods and prevent any further transactions from being posted to this fiscal year. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedYear && (
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">{t('closing_year') || 'Closing'}:</p>
                <p className="font-semibold text-slate-900">{selectedYear.name} ({selectedYear.code})</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseYearModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleCloseYear}
              variant="destructive"
              disabled={isSaving}
            >
              {isSaving ? (t('closing') || 'Closing...') : (t('close_year') || 'Close Year')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
