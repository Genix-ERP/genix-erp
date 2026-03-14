import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Building2, Car, Monitor, Cpu, Wrench, Package,
  TrendingDown, Calendar, DollarSign, Edit2, Trash2,
  Calculator, FileText, AlertTriangle, CheckCircle2, Settings, ArrowRight
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { MODULES } from "@/config/permissions";
import { format, differenceInMonths, addMonths } from "date-fns";
import { financeService } from "@/api/services";

// Asset categories with icons
const assetCategories = [
  { value: 'buildings', labelKey: 'category_buildings', icon: Building2, depreciationYears: 40 },
  { value: 'vehicles', labelKey: 'category_vehicles', icon: Car, depreciationYears: 5 },
  { value: 'equipment', labelKey: 'category_equipment', icon: Wrench, depreciationYears: 10 },
  { value: 'computers', labelKey: 'category_computers', icon: Monitor, depreciationYears: 3 },
  { value: 'furniture', labelKey: 'category_furniture', icon: Package, depreciationYears: 7 },
  { value: 'intangible', labelKey: 'category_intangible', icon: Cpu, depreciationYears: 5 },
  { value: 'other', labelKey: 'category_other_assets', icon: Package, depreciationYears: 5 },
];

// Depreciation methods
const depreciationMethods = [
  { value: 'straight_line', labelKey: 'straight_line' },
  { value: 'declining_balance', labelKey: 'declining_balance' },
  { value: 'double_declining', labelKey: 'double_declining' },
  { value: 'sum_of_years', labelKey: 'sum_of_years' },
  { value: 'units_of_production', labelKey: 'units_of_production' },
];

export default function FixedAssets() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    fixedAssets = [],
    depreciationEntries = [],
    accounts = [],
    createFixedAsset,
    updateFixedAsset,
    deleteFixedAsset,
    disposeFixedAsset,
    runDepreciationForPeriod,
    isLoading,
    refreshData
  } = useFinancials();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDepreciationModal, setShowDepreciationModal] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showMaintenanceResult, setShowMaintenanceResult] = useState(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("assets");
  const [isSaving, setIsSaving] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: 'regular_to',
    service_date: format(new Date(), 'yyyy-MM-dd'),
    cost: '',
    extension_months: '',
    description: '',
    performed_by: '',
    document_number: '',
    payment_account_code: '1000',
    next_service_date: '',
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', paid_at: format(new Date(), 'yyyy-MM-dd'), note: '' });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'equipment',
    description: '',
    acquisition_date: '',
    acquisition_cost: '',
    salvage_value: '',
    useful_life_months: '',
    depreciation_method: 'straight_line',
    asset_account_id: '',
    depreciation_account_id: '',
    expense_account_id: '',
    location: '',
    serial_number: '',
    status: 'active',
    supplier_name: '',
    document_number: '',
    document_date: '',
    payment_method: 'cash',
  });

  const [disposeFormData, setDisposeFormData] = useState({
    disposal_date: '',
    disposal_amount: '',
    reason: 'sold',
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    const activeAssets = fixedAssets.filter(a => a.status === 'active');
    const totalOriginalCost = activeAssets.reduce((sum, a) => sum + (a.acquisition_cost || 0), 0);
    const totalDepreciation = activeAssets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
    const totalNetBookValue = totalOriginalCost - totalDepreciation;
    const disposedAssets = fixedAssets.filter(a => a.status === 'disposed').length;
    const thisMonthDepr = activeAssets
      .filter(a => (a.remaining_months || 0) > 0)
      .reduce((sum, a) => sum + (a.monthly_depr || 0), 0);

    return {
      activeCount: activeAssets.length,
      totalOriginalCost,
      totalDepreciation,
      totalNetBookValue,
      disposedAssets,
      thisMonthDepr
    };
  }, [fixedAssets]);

  // Filter assets
  const filteredAssets = useMemo(() => {
    let filtered = fixedAssets;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(a => a.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }
    return filtered;
  }, [fixedAssets, categoryFilter, statusFilter]);

  // Calculate depreciation for an asset
  const calculateDepreciation = (asset) => {
    if (!asset || !asset.acquisition_date || !asset.acquisition_cost || !asset.useful_life_months) {
      return { monthlyDepreciation: 0, accumulatedDepreciation: 0, netBookValue: asset?.acquisition_cost || 0, depreciationProgress: 0 };
    }

    const cost = asset.acquisition_cost;
    const salvage = asset.salvage_value || 0;
    const depreciableAmount = cost - salvage;
    const usefulLifeMonths = asset.useful_life_months;
    const acquisitionDate = new Date(asset.acquisition_date);
    const today = new Date();
    const monthsElapsed = Math.max(0, differenceInMonths(today, acquisitionDate));

    let monthlyDepreciation = 0;
    let accumulatedDepreciation = 0;

    switch (asset.depreciation_method) {
      case 'straight_line':
        monthlyDepreciation = depreciableAmount / usefulLifeMonths;
        accumulatedDepreciation = Math.min(monthlyDepreciation * monthsElapsed, depreciableAmount);
        break;
      case 'declining_balance':
        const rate = 1 / (usefulLifeMonths / 12);
        let remainingValue = cost;
        for (let i = 0; i < Math.min(monthsElapsed, usefulLifeMonths); i++) {
          const yearlyDep = remainingValue * rate;
          monthlyDepreciation = yearlyDep / 12;
          accumulatedDepreciation += monthlyDepreciation;
          if ((i + 1) % 12 === 0) {
            remainingValue -= yearlyDep;
          }
        }
        accumulatedDepreciation = Math.min(accumulatedDepreciation, depreciableAmount);
        break;
      case 'double_declining':
        const ddRate = 2 / (usefulLifeMonths / 12);
        let ddRemainingValue = cost;
        for (let i = 0; i < Math.min(monthsElapsed, usefulLifeMonths); i++) {
          const yearlyDep = ddRemainingValue * ddRate;
          monthlyDepreciation = yearlyDep / 12;
          accumulatedDepreciation += monthlyDepreciation;
          if ((i + 1) % 12 === 0) {
            ddRemainingValue -= yearlyDep;
          }
        }
        accumulatedDepreciation = Math.min(accumulatedDepreciation, depreciableAmount);
        break;
      default:
        monthlyDepreciation = depreciableAmount / usefulLifeMonths;
        accumulatedDepreciation = Math.min(monthlyDepreciation * monthsElapsed, depreciableAmount);
    }

    const netBookValue = cost - accumulatedDepreciation;
    const depreciationProgress = (accumulatedDepreciation / depreciableAmount) * 100;

    return {
      monthlyDepreciation,
      accumulatedDepreciation,
      netBookValue,
      depreciationProgress: Math.min(depreciationProgress, 100)
    };
  };

  const handleCreateAsset = async () => {
    setIsSaving(true);
    try {
      await createFixedAsset({
        ...formData,
        acquisition_cost: parseFloat(formData.acquisition_cost) || 0,
        salvage_value: parseFloat(formData.salvage_value) || 0,
        useful_life_months: parseInt(formData.useful_life_months) || 60,
        accumulated_depreciation: 0,
      });
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating asset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAsset = async () => {
    if (!selectedAsset) return;
    setIsSaving(true);
    try {
      await updateFixedAsset(selectedAsset.id, {
        ...formData,
        acquisition_cost: parseFloat(formData.acquisition_cost) || 0,
        salvage_value: parseFloat(formData.salvage_value) || 0,
        useful_life_months: parseInt(formData.useful_life_months) || 60,
      });
      setShowEditModal(false);
      setSelectedAsset(null);
      resetForm();
    } catch (error) {
      console.error('Error updating asset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async (asset) => {
    if (window.confirm(t('confirm_delete_asset') || 'Are you sure you want to delete this asset?')) {
      try {
        await deleteFixedAsset(asset.id);
      } catch (error) {
        console.error('Error deleting asset:', error);
      }
    }
  };

  const handleRunDepreciation = async () => {
    setIsSaving(true);
    try {
      const period = format(new Date(), 'yyyy-MM');
      await runDepreciationForPeriod(period);
      setShowDepreciationModal(false);
    } catch (error) {
      console.error('Error running depreciation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisposeAsset = async () => {
    if (!selectedAsset) return;
    setIsSaving(true);
    try {
      const disposalAmount = parseFloat(disposeFormData.disposal_amount) || 0;

      await disposeFixedAsset(selectedAsset.id, {
        disposal_date: disposeFormData.disposal_date,
        disposal_amount: disposalAmount,
        reason: disposeFormData.reason,
      });

      setShowDisposeModal(false);
      setSelectedAsset(null);
      setDisposeFormData({ disposal_date: '', disposal_amount: '', reason: 'sold' });
    } catch (error) {
      console.error('Error disposing asset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const openMaintenanceModal = async (asset) => {
    setSelectedAsset(asset);
    setMaintenanceForm({
      maintenance_type: 'regular_to',
      service_date: format(new Date(), 'yyyy-MM-dd'),
      cost: '',
      extension_months: '',
      description: '',
      performed_by: '',
      document_number: '',
      payment_account_code: '1000',
      next_service_date: '',
    });
    try {
      const history = await financeService.listMaintenance(asset.id);
      setMaintenanceHistory(history || []);
    } catch { setMaintenanceHistory([]); }
    setShowMaintenanceModal(true);
  };

  const handleRecordMaintenance = async () => {
    if (!selectedAsset) return;
    setIsSaving(true);
    try {
      const result = await financeService.recordMaintenance(selectedAsset.id, {
        ...maintenanceForm,
        cost: parseFloat(maintenanceForm.cost) || 0,
        extension_months: parseInt(maintenanceForm.extension_months) || 0,
      });
      setShowMaintenanceModal(false);
      setShowMaintenanceResult(result);
      if (refreshData) refreshData();
    } catch (error) {
      console.error('Error recording maintenance:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const maintenanceTypeLabels = {
    regular_to: { uz: 'Oddiy TO', en: 'Regular Maintenance' },
    capital_repair: { uz: 'Kapital ta\'mirlash', en: 'Capital Repair' },
    modernization: { uz: 'Modernizatsiya', en: 'Modernization' },
    minor_repair: { uz: 'Joriy ta\'mirlash', en: 'Minor Repair' },
  };

  const openEditModal = (asset) => {
    setSelectedAsset(asset);
    setFormData({
      name: asset.name || '',
      code: asset.code || '',
      category: asset.category || 'equipment',
      description: asset.description || '',
      acquisition_date: asset.acquisition_date || '',
      acquisition_cost: asset.acquisition_cost?.toString() || '',
      salvage_value: asset.salvage_value?.toString() || '',
      useful_life_months: asset.useful_life_months?.toString() || '',
      depreciation_method: asset.depreciation_method || 'straight_line',
      asset_account_id: asset.asset_account_id || '',
      depreciation_account_id: asset.depreciation_account_id || '',
      expense_account_id: asset.expense_account_id || '',
      location: asset.location || '',
      serial_number: asset.serial_number || '',
      status: asset.status || 'active',
    });
    setShowEditModal(true);
  };

  const openDisposeModal = (asset) => {
    setSelectedAsset(asset);
    setDisposeFormData({
      disposal_date: format(new Date(), 'yyyy-MM-dd'),
      disposal_amount: '',
      reason: 'sold',
    });
    setShowDisposeModal(true);
  };

  const openPaymentModal = async (asset) => {
    setSelectedAsset(asset);
    setPaymentForm({ amount: '', method: 'cash', paid_at: format(new Date(), 'yyyy-MM-dd'), note: '' });
    try {
      const history = await financeService.listAssetPayments(asset.id);
      setPaymentHistory(history || []);
    } catch { setPaymentHistory([]); }
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedAsset) return;
    setIsSaving(true);
    try {
      await financeService.recordAssetPayment(selectedAsset.id, {
        ...paymentForm,
        amount: parseFloat(paymentForm.amount) || 0,
      });
      setShowPaymentModal(false);
      if (refreshData) refreshData();
    } catch (error) {
      console.error('Error recording payment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    const defaultCategory = assetCategories.find(c => c.value === 'equipment');
    const num = (fixedAssets?.length || 0) + 1;
    setFormData({
      name: '',
      code: `FA-${String(num).padStart(3, '0')}`,
      category: 'equipment',
      description: '',
      acquisition_date: format(new Date(), 'yyyy-MM-dd'),
      acquisition_cost: '',
      salvage_value: '0',
      useful_life_months: String(defaultCategory.depreciationYears * 12),
      depreciation_method: 'straight_line',
      asset_account_id: '',
      depreciation_account_id: '',
      expense_account_id: '',
      location: '',
      serial_number: '',
      status: 'active',
      supplier_name: '',
      document_number: '',
      document_date: '',
      payment_method: 'cash',
    });
  };

  const getCategoryInfo = (categoryValue) => {
    return assetCategories.find(c => c.value === categoryValue) || assetCategories[0];
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> {t('active') || 'Active'}</Badge>;
      case 'disposed':
        return <Badge className="bg-slate-100 text-slate-700"><Trash2 className="w-3 h-3 mr-1" /> {t('disposed') || 'Disposed'}</Badge>;
      case 'fully_depreciated':
        return <Badge className="bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3 mr-1" /> {t('fully_depreciated') || 'Fully Depreciated'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">{t('active_assets') || 'Active Assets'}</p>
                <p className="text-2xl font-bold text-blue-800">{stats.activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">{t('original_cost') || 'Original Cost'}</p>
                <p className="text-lg font-bold text-green-800">{formatCurrencyCompact(stats.totalOriginalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-medium">{t('accumulated_depreciation') || 'Acc. Depreciation'}</p>
                <p className="text-lg font-bold text-amber-800">{formatCurrencyCompact(stats.totalDepreciation)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600 font-medium">{t('net_book_value') || 'Net Book Value'}</p>
                <p className="text-lg font-bold text-purple-800">{formatCurrencyCompact(stats.totalNetBookValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-500/20 rounded-lg flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">{t('disposed') || 'Disposed'}</p>
                <p className="text-2xl font-bold text-slate-800">{stats.disposedAssets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-indigo-600 font-medium">{t('this_month_depreciation') || 'Bu oy amortizatsiya'}</p>
                <p className="text-lg font-bold text-indigo-800">{formatCurrencyCompact(stats.thisMonthDepr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-purple)]/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[var(--genix-purple)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{t('fixed_assets') || 'Fixed Assets'}</CardTitle>
                <p className="text-sm text-slate-500">{t('fixed_assets_description') || 'Manage your fixed assets and depreciation'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('all_categories') || 'All Categories'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_categories') || 'All Categories'}</SelectItem>
                  {assetCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{t(cat.labelKey) || cat.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder={t('all_statuses') || 'All Statuses'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                  <SelectItem value="active">{t('active') || 'Active'}</SelectItem>
                  <SelectItem value="disposed">{t('disposed') || 'Disposed'}</SelectItem>
                </SelectContent>
              </Select>
              {canUpdate(MODULES.ASSETS) && (
                <Button
                  variant="outline"
                  onClick={() => setShowDepreciationModal(true)}
                >
                  <Calculator className="w-4 h-4 mr-2" /> {t('run_depreciation') || 'Run Depreciation'}
                </Button>
              )}
              {canCreate(MODULES.ASSETS) && (
                <Button
                  onClick={() => { resetForm(); setShowCreateModal(true); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('new_asset') || 'New Asset'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {t('no_assets') || 'No fixed assets found'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {t('assets_empty_description') || 'Register your fixed assets to track depreciation and manage your capital investments.'}
              </p>
              {canCreate(MODULES.ASSETS) && (
                <Button
                  onClick={() => { resetForm(); setShowCreateModal(true); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('add_first_asset') || 'Add First Asset'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('code') || 'Code'}</TableHead>
                  <TableHead>{t('asset_name') || 'Asset Name'}</TableHead>
                  <TableHead>{t('category') || 'Category'}</TableHead>
                  <TableHead className="text-right">{t('original_cost') || 'Cost'}</TableHead>
                  <TableHead className="text-right">{'Joriy qiymat'}</TableHead>
                  <TableHead className="text-right">{'Oylik amor.'}</TableHead>
                  <TableHead>{'Qolgan oy'}</TableHead>
                  <TableHead>{t('depreciation') || 'Depreciation'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => {
                  const categoryInfo = getCategoryInfo(asset.category);
                  const CategoryIcon = categoryInfo.icon;
                  const depreciableAmount = (asset.acquisition_cost || 0) - (asset.salvage_value || 0);
                  const accumulated = asset.accumulated_depreciation || 0;
                  const bookValue = asset.book_value != null ? asset.book_value : ((asset.acquisition_cost || 0) - accumulated);
                  const progress = depreciableAmount > 0 ? Math.min((accumulated / depreciableAmount) * 100, 100) : 0;

                  return (
                    <TableRow key={asset.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-medium">{asset.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            {asset.serial_number && (
                              <p className="text-xs text-slate-500">S/N: {asset.serial_number}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t(categoryInfo.labelKey) || categoryInfo.value}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(asset.acquisition_cost || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-purple-600">
                        {formatCurrency(asset.current_value || bookValue)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(asset.monthly_depr || 0)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {asset.remaining_months != null ? `${asset.remaining_months} oy` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress
                            value={progress}
                            className="h-2 [&>div]:bg-amber-500"
                          />
                          <span className="text-xs text-slate-500">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(asset.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {asset.status === 'active' && canUpdate(MODULES.ASSETS) && (
                            <Button variant="ghost" size="sm" onClick={() => openMaintenanceModal(asset)} title="Texnik xizmat">
                              <Settings className="w-4 h-4 text-blue-500" />
                            </Button>
                          )}
                          {asset.status === 'active' && asset.payment_method === 'credit' && asset.remaining_debt > 0 && canCreate(MODULES.ASSETS) && (
                            <Button variant="ghost" size="sm" onClick={() => openPaymentModal(asset)} title="To'lov">
                              <DollarSign className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                          {canUpdate(MODULES.ASSETS) && (
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(asset)} title={t('edit') || 'Edit'}>
                              <Edit2 className="w-4 h-4 text-slate-500" />
                            </Button>
                          )}
                          {asset.status === 'active' && canDelete(MODULES.ASSETS) && (
                            <Button variant="ghost" size="sm" onClick={() => openDisposeModal(asset)} title={t('dispose') || 'Dispose'}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Asset Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedAsset(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--genix-blue)]" />
              {showEditModal ? (t('edit_asset') || 'Edit Asset') : (t('new_asset') || 'New Asset')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('category') || 'Category'} *</label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => {
                    const cat = assetCategories.find(c => c.value === v);
                    setFormData({
                      ...formData,
                      category: v,
                      useful_life_months: String(cat.depreciationYears * 12)
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assetCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{t(cat.labelKey) || cat.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('asset_name') || 'Asset Name'} *</label>
              <Input
                placeholder={t('asset_name_placeholder') || 'Enter asset name'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('serial_number') || 'Serial Number'}</label>
                <Input
                  placeholder={t('optional')}
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('location') || 'Location'}</label>
                <Input
                  placeholder={t('location_placeholder')}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            {/* Financial Info */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-slate-900 mb-3">{t('financial_details') || 'Financial Details'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('acquisition_date') || 'Acquisition Date'} *</label>
                  <Input
                    type="date"
                    value={formData.acquisition_date}
                    onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('acquisition_cost') || 'Acquisition Cost'} *</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatPriceInput(formData.acquisition_cost)}
                    onChange={(e) => setFormData({ ...formData, acquisition_cost: parsePriceInput(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('salvage_value') || 'Salvage Value'}</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatPriceInput(formData.salvage_value)}
                    onChange={(e) => setFormData({ ...formData, salvage_value: parsePriceInput(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('useful_life_months') || 'Useful Life (months)'}</label>
                  <Input
                    type="number"
                    placeholder="60"
                    value={formData.useful_life_months}
                    onChange={(e) => setFormData({ ...formData, useful_life_months: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('depreciation_method') || 'Depreciation Method'}</label>
                  <Select value={formData.depreciation_method} onValueChange={(v) => setFormData({ ...formData, depreciation_method: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {depreciationMethods.map(m => (
                        <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Accounting */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-slate-900 mb-3">{t('accounting') || 'Accounting'}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('asset_account') || 'Asset Account'}</label>
                  <Select value={formData.asset_account_id || 'none'} onValueChange={(v) => setFormData({ ...formData, asset_account_id: v === 'none' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select') || 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('none') || 'None'}</SelectItem>
                      {accounts.filter(a => a.type === 'asset').map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('depreciation_account') || 'Accum. Depr. Account'}</label>
                  <Select value={formData.depreciation_account_id || 'none'} onValueChange={(v) => setFormData({ ...formData, depreciation_account_id: v === 'none' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select') || 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('none') || 'None'}</SelectItem>
                      {accounts.filter(a => a.type === 'asset').map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('expense_account') || 'Expense Account'}</label>
                  <Select value={formData.expense_account_id || 'none'} onValueChange={(v) => setFormData({ ...formData, expense_account_id: v === 'none' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select') || 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('none') || 'None'}</SelectItem>
                      {accounts.filter(a => a.type === 'expense').map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Supplier / Purchase Info */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-slate-900 mb-3">Xarid ma'lumotlari</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Yetkazib beruvchi</label>
                  <Input
                    placeholder="Yetkazib beruvchi nomi"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">To'lov usuli</label>
                  <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Naqd pul</SelectItem>
                      <SelectItem value="bank">Bank o'tkazmasi</SelectItem>
                      <SelectItem value="credit">Nasiya (kredit)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Hujjat raqami</label>
                  <Input
                    placeholder="Shartnoma/faktura raqami"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Hujjat sanasi</label>
                  <Input
                    type="date"
                    value={formData.document_date}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>
              </div>
              {formData.payment_method === 'credit' && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  Nasiya xaridi: aktiv yaratilganda Dt 1500 / Kt 2000 (Kreditorlik qarzi). To'lovlar alohida kiritiladi.
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description') || 'Description'}</label>
              <Textarea
                placeholder={t('asset_description') || 'Asset description...'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={showEditModal ? handleUpdateAsset : handleCreateAsset}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.name || !formData.acquisition_cost}
            >
              {isSaving ? (t('saving') || 'Saving...') : showEditModal ? (t('save') || 'Save') : (t('create') || 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Depreciation Modal */}
      <Dialog open={showDepreciationModal} onOpenChange={setShowDepreciationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('run_depreciation') || 'Run Depreciation'}
            </DialogTitle>
            <DialogDescription>
              {t('run_depreciation_description') || 'Calculate and post depreciation for all active assets for the current period.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">{t('depreciation_summary') || 'Summary'}:</p>
              <p className="font-medium">{stats.activeCount} {t('active_assets') || 'active assets'}</p>
              <p className="text-sm text-slate-500">{t('period') || 'Period'}: {format(new Date(), 'MMMM yyyy')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepreciationModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleRunDepreciation}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || stats.activeCount === 0}
            >
              {isSaving ? (t('processing') || 'Processing...') : (t('run_depreciation') || 'Run Depreciation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispose Asset Modal */}
      <Dialog open={showDisposeModal} onOpenChange={(open) => {
        if (!open) {
          setShowDisposeModal(false);
          setSelectedAsset(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('dispose_asset') || 'Dispose Asset'}
            </DialogTitle>
            <DialogDescription>
              {t('dispose_asset_description') || 'Record the disposal of this fixed asset.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedAsset && (
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="font-medium">{selectedAsset.name}</p>
                <p className="text-sm text-slate-500">{t('net_book_value') || 'NBV'}: {formatCurrency(selectedAsset.book_value != null ? selectedAsset.book_value : ((selectedAsset.acquisition_cost || 0) - (selectedAsset.accumulated_depreciation || 0)))}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('disposal_date') || 'Disposal Date'} *</label>
              <Input
                type="date"
                value={disposeFormData.disposal_date}
                onChange={(e) => setDisposeFormData({ ...disposeFormData, disposal_date: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('disposal_amount') || 'Disposal Amount'}</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={formatPriceInput(disposeFormData.disposal_amount)}
                onChange={(e) => setDisposeFormData({ ...disposeFormData, disposal_amount: parsePriceInput(e.target.value) })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Sababi *</label>
              <Select value={disposeFormData.reason} onValueChange={(v) => setDisposeFormData({ ...disposeFormData, reason: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sold">Sotilgan</SelectItem>
                  <SelectItem value="destroyed">Yaroqsiz bo'lgan</SelectItem>
                  <SelectItem value="expired">Muddati tugagan</SelectItem>
                  <SelectItem value="stolen">O'g'irlangan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {disposeFormData.reason === 'sold' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                Sotilganda: tushum kassaga kirim qilinadi, foyda/zarar hisoblanadi.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisposeModal(false)} disabled={isSaving}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleDisposeAsset}
              variant="destructive"
              disabled={isSaving || !disposeFormData.disposal_date || !disposeFormData.reason}
            >
              {isSaving ? (t('processing') || 'Processing...') : (t('dispose') || 'Dispose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Modal */}
      <Dialog open={showMaintenanceModal} onOpenChange={(open) => {
        if (!open) { setShowMaintenanceModal(false); setSelectedAsset(null); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Texnik xizmat ko'rsatish
            </DialogTitle>
            <DialogDescription>
              {selectedAsset?.name} ({selectedAsset?.code})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current asset info */}
            <div className="bg-blue-50 p-3 rounded-lg grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-blue-600 font-medium">Joriy qiymat</span>
                <p className="font-bold">{formatCurrency(selectedAsset?.current_value || selectedAsset?.book_value || 0)}</p>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Qolgan muddat</span>
                <p className="font-bold">{selectedAsset?.remaining_months || selectedAsset?.useful_life_months || 0} oy</p>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Oylik amortizatsiya</span>
                <p className="font-bold">{formatCurrency(selectedAsset?.monthly_depr || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Xizmat turi *</label>
                <Select
                  value={maintenanceForm.maintenance_type}
                  onValueChange={(v) => setMaintenanceForm({...maintenanceForm, maintenance_type: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular_to">Oddiy TO</SelectItem>
                    <SelectItem value="capital_repair">Kapital ta'mirlash</SelectItem>
                    <SelectItem value="modernization">Modernizatsiya</SelectItem>
                    <SelectItem value="minor_repair">Joriy ta'mirlash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Xizmat sanasi *</label>
                <Input
                  type="date"
                  value={maintenanceForm.service_date}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, service_date: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Xarajat summasi</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatPriceInput(maintenanceForm.cost)}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, cost: parsePriceInput(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">To'lov hisob</label>
                <Select
                  value={maintenanceForm.payment_account_code}
                  onValueChange={(v) => setMaintenanceForm({...maintenanceForm, payment_account_code: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1000 - Kassa</SelectItem>
                    <SelectItem value="1010">1010 - Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(maintenanceForm.maintenance_type === 'regular_to' || maintenanceForm.maintenance_type === 'modernization') && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Muddat uzayishi (oy)</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="12"
                  value={maintenanceForm.extension_months}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, extension_months: e.target.value})}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Bajaruvchi</label>
                <Input
                  placeholder="Tashqi kompaniya nomi"
                  value={maintenanceForm.performed_by}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, performed_by: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('document_number') || 'Hujjat raqami'}</label>
                <Input
                  placeholder={t('optional') || 'Ixtiyoriy'}
                  value={maintenanceForm.document_number}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, document_number: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('next_service_date') || 'Keyingi TO sanasi'}</label>
                <Input
                  type="date"
                  value={maintenanceForm.next_service_date}
                  onChange={(e) => setMaintenanceForm({...maintenanceForm, next_service_date: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('notes') || 'Izoh'}</label>
              <Textarea
                placeholder="Texnik xizmat haqida izoh..."
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({...maintenanceForm, description: e.target.value})}
                rows={2}
              />
            </div>

            {/* Maintenance History */}
            {maintenanceHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Texnik xizmat tarixi</h4>
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {maintenanceHistory.map(m => (
                    <div key={m.id} className="p-2 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-medium">{maintenanceTypeLabels[m.maintenance_type]?.uz || m.maintenance_type}</span>
                        <span className="text-slate-500 ml-2">{m.service_date}</span>
                      </div>
                      <div className="text-right">
                        {m.cost > 0 && <span className="text-red-600">{formatCurrency(m.cost)}</span>}
                        {m.life_extension_months > 0 && <span className="text-green-600 ml-2">+{m.life_extension_months} oy</span>}
                        {m.value_increase > 0 && <span className="text-blue-600 ml-2">+{formatCurrency(m.value_increase)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaintenanceModal(false)} disabled={isSaving}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button onClick={handleRecordMaintenance} disabled={isSaving || !maintenanceForm.service_date}>
              {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Result Modal */}
      <Dialog open={!!showMaintenanceResult} onOpenChange={(open) => { if (!open) setShowMaintenanceResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              Texnik xizmat muvaffaqiyatli qayd etildi
            </DialogTitle>
          </DialogHeader>
          {showMaintenanceResult && (
            <div className="space-y-3 py-4">
              <p className="text-sm font-medium text-slate-600">
                {maintenanceTypeLabels[showMaintenanceResult.maintenance_type]?.uz || showMaintenanceResult.maintenance_type}
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left p-2 font-medium"></th>
                      <th className="text-right p-2 font-medium">Oldin</th>
                      <th className="text-center p-2 w-8"></th>
                      <th className="text-right p-2 font-medium">Keyin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2 text-slate-600">Muddat (oy)</td>
                      <td className="p-2 text-right">{showMaintenanceResult.useful_life_before}</td>
                      <td className="p-2 text-center"><ArrowRight className="w-3 h-3 text-slate-400 mx-auto" /></td>
                      <td className="p-2 text-right font-medium">
                        {showMaintenanceResult.useful_life_after}
                        {showMaintenanceResult.life_extension_months > 0 && (
                          <span className="text-green-600 text-xs ml-1">(+{showMaintenanceResult.life_extension_months})</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 text-slate-600">Oylik amor.</td>
                      <td className="p-2 text-right">{formatCurrency(showMaintenanceResult.monthly_depr_before)}</td>
                      <td className="p-2 text-center"><ArrowRight className="w-3 h-3 text-slate-400 mx-auto" /></td>
                      <td className="p-2 text-right font-medium">{formatCurrency(showMaintenanceResult.monthly_depr_after)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 text-slate-600">Qiymat</td>
                      <td className="p-2 text-right">{formatCurrency(showMaintenanceResult.value_before)}</td>
                      <td className="p-2 text-center"><ArrowRight className="w-3 h-3 text-slate-400 mx-auto" /></td>
                      <td className="p-2 text-right font-medium">
                        {formatCurrency(showMaintenanceResult.value_after)}
                        {showMaintenanceResult.value_increase > 0 && (
                          <span className="text-blue-600 text-xs ml-1">(+{formatCurrency(showMaintenanceResult.value_increase)})</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowMaintenanceResult(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => {
        if (!open) { setShowPaymentModal(false); setSelectedAsset(null); }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Nasiya to'lovi
            </DialogTitle>
            <DialogDescription>
              {selectedAsset?.name} — Qolgan qarz: {formatCurrency((selectedAsset?.acquisition_cost || 0) - (selectedAsset?.total_paid || 0))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Summa *</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatPriceInput(paymentForm.amount)}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: parsePriceInput(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">To'lov usuli *</label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({...paymentForm, method: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Naqd pul</SelectItem>
                    <SelectItem value="bank">Bank o'tkazmasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Sana *</label>
                <Input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(e) => setPaymentForm({...paymentForm, paid_at: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Izoh</label>
                <Input
                  placeholder="Ixtiyoriy izoh"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({...paymentForm, note: e.target.value})}
                />
              </div>
            </div>

            {/* Payment History */}
            {paymentHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">To'lovlar tarixi</h4>
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {paymentHistory.map(p => (
                    <div key={p.id} className="p-2 text-xs flex justify-between items-center">
                      <div>
                        <span className="text-slate-500">{p.paid_at}</span>
                        <span className="ml-2">{p.method === 'cash' ? 'Naqd' : 'Bank'}</span>
                      </div>
                      <span className="font-medium text-green-600">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)} disabled={isSaving}>
              Bekor qilish
            </Button>
            <Button onClick={handleRecordPayment} disabled={isSaving || !paymentForm.amount || !paymentForm.paid_at}>
              {isSaving ? 'Saqlanmoqda...' : 'To\'lash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
