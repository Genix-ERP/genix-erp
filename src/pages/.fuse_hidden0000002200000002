import React, { useState, useEffect, useMemo } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Monitor, TrendingDown, Wrench, DollarSign, AlertTriangle, Brain, CheckCircle, Target, Lightbulb, Edit2, Download, Trash2, ArrowRightLeft, History, Printer, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { analyzeAssets } from '@/api/services/aiAnalytics';
import financeService from '@/api/services/finance';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format } from 'date-fns';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function Assets() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { assets: rawAssets, createAsset, updateAsset, isLoading, refreshData } = useModules();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  // Refresh data when navigating to this page
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  // AI Analysis
  const assetAnalysis = useMemo(() => {
    try {
      return analyzeAssets(rawAssets || [], language, formatCurrencyCompact) || {
        insights: [],
        recommendations: [],
        metrics: {}
      };
    } catch (error) {
      console.error('Error analyzing assets:', error);
      return { insights: [], recommendations: [], metrics: {} };
    }
  }, [rawAssets, language, formatCurrencyCompact]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [assetToTransfer, setAssetToTransfer] = useState(null);
  const [transferData, setTransferData] = useState({ location: '', notes: '', transfer_date: new Date().toISOString().split('T')[0] });
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [assetForMaintenance, setAssetForMaintenance] = useState(null);
  const [maintenanceData, setMaintenanceData] = useState({ date: new Date().toISOString().split('T')[0], type: 'regular_to', description: '', cost: '' });
  const [maintenanceHistory, setMaintenanceHistory] = useState({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [assetForHistory, setAssetForHistory] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  const generateAssetCode = () => `AST-${String((rawAssets?.length || 0) + 1).padStart(3, '0')}`;

  const [newAsset, setNewAsset] = useState({
    asset_name: '',
    asset_code: '',
    asset_category: 'equipment',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_cost: '',
    salvage_value: 0,
    useful_life_years: 5,
    depreciation_method: 'straight_line',
    supplier_name: '',
    // Default to "credit" so purchase posts AP instead of immediately draining
    // the cash/bank account. User settles the debt later via the Pay button.
    payment_method: 'credit',
  });

  // Pay-asset modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [assetToPay, setAssetToPay] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: '',
    method: 'cash',
    paid_at: new Date().toISOString().split('T')[0],
    note: '',
  });
  const [isPaying, setIsPaying] = useState(false);

  // Calculate depreciation for all assets - memoize to prevent infinite loops
  const assets = useMemo(() => {
    return (rawAssets || []).map(asset => {
      const purchaseDate = new Date(asset.purchase_date);
      const yearsElapsed = (new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 365);
      const annualDepreciation = (asset.purchase_cost - (asset.salvage_value || 0)) / asset.useful_life_years;
      const accumulated = Math.min(annualDepreciation * yearsElapsed, asset.purchase_cost - (asset.salvage_value || 0));
      const currentValue = asset.purchase_cost - accumulated;

      return {
        ...asset,
        accumulated_depreciation: accumulated,
        current_value: currentValue
      };
    });
  }, [rawAssets]);

  useEffect(() => {
    let filtered = assets;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(a => a.asset_category === categoryFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.asset_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.asset_code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredAssets(filtered);
  }, [assets, searchQuery, categoryFilter]);

  const handleCreateAsset = async () => {
    setIsSubmitting(true);
    try {
      await createAsset({
        ...newAsset,
        purchase_cost: parseFloat(newAsset.purchase_cost),
        salvage_value: parseFloat(newAsset.salvage_value) || 0,
        useful_life_years: parseInt(newAsset.useful_life_years),
        current_value: parseFloat(newAsset.purchase_cost),
        accumulated_depreciation: 0,
        status: 'active'
      });
      setShowCreateModal(false);
      setNewAsset({
        asset_name: '',
        asset_code: '',
        asset_category: 'equipment',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_cost: '',
        salvage_value: 0,
        useful_life_years: 5,
        depreciation_method: 'straight_line',
        supplier_name: '',
        payment_method: 'credit',
      });
    } catch (error) {
      console.error('Error creating asset:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open the pay modal for a specific asset, prefilling the remaining debt.
  const openPayModal = (asset) => {
    const totalPaid = Number(asset.total_paid) || 0;
    const remaining = Math.max(0, Number(asset.purchase_cost || asset.acquisition_cost || 0) - totalPaid);
    setAssetToPay(asset);
    setPayForm({
      amount: remaining ? String(remaining) : '',
      method: 'cash',
      paid_at: new Date().toISOString().split('T')[0],
      note: '',
    });
    setShowPayModal(true);
  };

  const handleRecordPayment = async () => {
    if (!assetToPay) return;
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return;
    setIsPaying(true);
    try {
      await financeService.recordAssetPayment(assetToPay.id, {
        amount: amt,
        method: payForm.method,
        paid_at: payForm.paid_at,
        note: payForm.note,
      });
      setShowPayModal(false);
      setAssetToPay(null);
      await refreshData();
    } catch (error) {
      console.error('Error recording asset payment:', error);
    } finally {
      setIsPaying(false);
    }
  };

  const handleEditAsset = (asset) => {
    setEditAsset({
      ...asset,
      purchase_cost: asset.purchase_cost || 0,
      useful_life_years: asset.useful_life_years || 5
    });
    setShowEditModal(true);
  };

  const handleUpdateAsset = async () => {
    if (!editAsset) return;

    setIsSubmitting(true);
    try {
      updateAsset(editAsset.id, {
        asset_name: editAsset.asset_name,
        asset_code: editAsset.asset_code,
        asset_category: editAsset.asset_category,
        purchase_date: editAsset.purchase_date,
        purchase_cost: parseFloat(editAsset.purchase_cost) || 0,
        useful_life_years: parseInt(editAsset.useful_life_years) || 5,
        depreciation_method: editAsset.depreciation_method,
        status: editAsset.status,
        salvage_value: parseFloat(editAsset.salvage_value) || 0,
        location: editAsset.location,
        next_maintenance_date: editAsset.next_maintenance_date
      });
      addAuditLog('update', editAsset.id, editAsset.asset_code);
      setShowEditModal(false);
      setEditAsset(null);
    } catch (error) {
      console.error('Error updating asset:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAsset = () => {
    if (assetToDelete) {
      updateAsset(assetToDelete.id, { status: 'disposed', disposal_date: new Date().toISOString().split('T')[0] });
      addAuditLog('delete', assetToDelete.id, assetToDelete.asset_code);
      setShowDeleteDialog(false);
      setAssetToDelete(null);
    }
  };

  const handleTransferAsset = async () => {
    if (assetToTransfer) {
      try {
        await updateAsset(assetToTransfer.id, { location: transferData.location });
        const fromLocation = assetToTransfer.location || 'N/A';
        const description = `${fromLocation} → ${transferData.location}${transferData.notes ? '. ' + transferData.notes : ''}`;
        await financeService.recordMaintenance(assetToTransfer.id, {
          maintenance_type: 'transfer',
          service_date: transferData.transfer_date,
          description,
          cost: 0
        });
        addAuditLog('transfer', assetToTransfer.id, `${assetToTransfer.asset_code} to ${transferData.location}`);
      } catch (err) {
        console.error('Failed to transfer asset:', err);
      }
      setShowTransferModal(false);
      setAssetToTransfer(null);
      setTransferData({ location: '', notes: '', transfer_date: new Date().toISOString().split('T')[0] });
    }
  };

  const handleAddMaintenance = async () => {
    if (assetForMaintenance) {
      try {
        await financeService.recordMaintenance(assetForMaintenance.id, {
          maintenance_type: maintenanceData.type,
          service_date: maintenanceData.date,
          description: maintenanceData.description,
          cost: parseFloat(maintenanceData.cost) || 0
        });
        const records = await financeService.listMaintenance(assetForMaintenance.id);
        setMaintenanceHistory({
          ...maintenanceHistory,
          [assetForMaintenance.id]: records || []
        });
        addAuditLog('maintenance', assetForMaintenance.id, `${assetForMaintenance.asset_code} - ${maintenanceData.type}`);
        setShowMaintenanceModal(false);
        setAssetForMaintenance(null);
        setMaintenanceData({ date: new Date().toISOString().split('T')[0], type: 'regular_to', description: '', cost: '' });
      } catch (err) {
        console.error('Failed to record maintenance:', err);
      }
    }
  };

  const addAuditLog = (action, assetId, details) => {
    const logEntry = {
      id: Date.now(),
      action,
      assetId,
      details,
      timestamp: new Date().toISOString(),
      user: 'Current User'
    };
    setAuditLog([logEntry, ...auditLog]);
  };

  const openHistoryModal = async (asset) => {
    setAssetForHistory(asset);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const records = await financeService.listMaintenance(asset.id);
      setHistoryRecords(records || []);
    } catch (e) {
      console.error('Failed to load history:', e);
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      disposed: 'bg-gray-100 text-gray-800',
      under_maintenance: 'bg-yellow-100 text-yellow-800',
      retired: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.active;
  };

  const metrics = {
    totalAssets: assets.length,
    totalValue: assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0),
    currentValue: assets.reduce((sum, a) => sum + (a.current_value || 0), 0),
    totalDepreciation: assets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0)
  };

  const categoryData = {};
  assets.forEach(a => {
    categoryData[a.asset_category] = (categoryData[a.asset_category] || 0) + (a.current_value || 0);
  });
  const categoryLabels = { buildings: t('category_buildings') || 'Binolar', vehicles: t('category_vehicles') || 'Transport vositalari', equipment: t('category_equipment') || 'Jihozlar', computers: t('category_computers') || 'Kompyuterlar', furniture: t('category_furniture') || 'Mebel', intangible: t('category_intangible') || 'Nomoddiy aktivlar', other: t('category_other_assets') || 'Boshqa' };
  const chartData = Object.entries(categoryData).map(([name, value]) => ({
    name: categoryLabels[name] || t(name),
    value
  }));

  const handleExportAssets = () => {
    if (filteredAssets.length === 0) {
      return;
    }

    // Helper to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        return format(new Date(dateStr), 'dd/MM/yyyy');
      } catch {
        return dateStr;
      }
    };

    // Create CSV content
    const headers = [
      t('asset_code'),
      t('asset_name'),
      t('category'),
      t('status'),
      t('purchase_date'),
      t('purchase_cost'),
      t('useful_life_years'),
      t('depreciation_method'),
      t('salvage_value'),
      t('current_value'),
      t('location')
    ];

    const csvRows = [
      headers.join(','),
      ...filteredAssets.map(asset => [
        `"${asset.asset_code || ''}"`,
        `"${asset.asset_name || ''}"`,
        `"${t(asset.asset_category || '')}"`,
        `"${t(asset.status || '')}"`,
        `"${formatDate(asset.purchase_date)}"`,
        asset.purchase_cost || 0,
        asset.useful_life_years || 0,
        `"${t(asset.depreciation_method || '')}"`,
        asset.salvage_value || 0,
        asset.current_value || 0,
        `"${asset.location || ''}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assets_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_assets')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalAssets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('purchase_value')}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('current_value')}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(metrics.currentValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('depreciation')}</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrencyCompact(metrics.totalDepreciation)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {((assetAnalysis?.insights?.length > 0) || (assetAnalysis?.recommendations?.length > 0)) && (
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-orange-600" />
                {t('ai_asset_insights')}
                <Badge className="bg-orange-100 text-orange-700 text-xs">{t('live')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(assetAnalysis?.insights || []).slice(0, 3).map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-orange-100">
                    <div className="flex items-start gap-3">
                      {insight.type === 'positive' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : insight.type === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{insight.description}</p>
                        {insight.metric && (
                          <p className="text-lg font-bold text-orange-600 mt-1">{insight.metric}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {assetAnalysis?.recommendations?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(assetAnalysis?.recommendations || []).map((rec, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs bg-white rounded-full px-3 py-1.5 border border-orange-100">
                      <Lightbulb className="w-3 h-3 text-yellow-500" />
                      <span className="text-slate-700">{rec.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Category Distribution */}
        {chartData.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t('assets_by_category')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Assets List */}
        <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{t('fixed_assets')}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportAssets}
                    variant="outline"
                    disabled={filteredAssets.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" /> {t('export')}
                  </Button>
                  {canCreate(MODULES.ASSETS) && (
                    <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                      <Plus className="w-4 h-4 mr-2" /> {t('new_asset')}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search_assets')}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_categories')}</SelectItem>
                    <SelectItem value="buildings">{t('category_buildings') || 'Binolar'}</SelectItem>
                    <SelectItem value="vehicles">{t('category_vehicles') || 'Transport vositalari'}</SelectItem>
                    <SelectItem value="equipment">{t('category_equipment') || 'Jihozlar'}</SelectItem>
                    <SelectItem value="computers">{t('category_computers') || 'Kompyuterlar'}</SelectItem>
                    <SelectItem value="furniture">{t('category_furniture') || 'Mebel'}</SelectItem>
                    <SelectItem value="intangible">{t('category_intangible') || 'Nomoddiy aktivlar'}</SelectItem>
                    <SelectItem value="other">{t('category_other_assets') || 'Boshqa'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-16">
                  <Monitor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_assets_yet')}</p>
                  {canCreate(MODULES.ASSETS) && (
                    <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('add_first_asset')}</Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssets.map((asset) => (
                    <Card key={asset.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-lg">{asset.asset_name}</h3>
                              <Badge className={getStatusColor(asset.status)}>{t(asset.status)}</Badge>
                              <Badge variant="outline">{categoryLabels[asset.asset_category] || t(asset.asset_category)}</Badge>
                            </div>
                            <p className="text-sm text-slate-500 mb-3">{asset.asset_code}</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-slate-500">{t('purchase_cost')}</p>
                                <p className="font-semibold">{formatCurrency(asset.purchase_cost || 0)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">{t('current_value')}</p>
                                <p className="font-semibold text-green-600">{formatCurrency(asset.current_value || 0)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">{t('depreciation')}</p>
                                <p className="font-semibold text-orange-600">{formatCurrency(asset.accumulated_depreciation || 0)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">{t('method')}</p>
                                <p className="font-medium">{t(asset.depreciation_method) || asset.depreciation_method}</p>
                              </div>
                            </div>

                            {asset.next_maintenance_date && (
                              <div className="mt-3 flex items-center gap-2 text-sm">
                                <Wrench className="w-4 h-4 text-yellow-600" />
                                <span className="text-slate-600">{t('next_maintenance')}: {asset.next_maintenance_date}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {canUpdate(MODULES.ASSETS) && (
                              <Button size="sm" variant="ghost" onClick={() => handleEditAsset(asset)} title={t('edit_asset')}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            {canUpdate(MODULES.ASSETS) && (
                              <Button size="sm" variant="ghost" onClick={() => { setAssetToTransfer(asset); setShowTransferModal(true); }} title={t('transfer')}>
                                <ArrowRightLeft className="w-4 h-4" />
                              </Button>
                            )}
                            {canUpdate(MODULES.ASSETS) && (
                              <Button size="sm" variant="ghost" onClick={async () => { setAssetForMaintenance(asset); setShowMaintenanceModal(true); try { const records = await financeService.listMaintenance(asset.id); setMaintenanceHistory(prev => ({...prev, [asset.id]: records || []})); } catch(e) { console.error(e); } }} title={t('add_maintenance')}>
                                <Wrench className="w-4 h-4" />
                              </Button>
                            )}
                            {canUpdate(MODULES.ASSETS) && asset.payment_method === 'credit' &&
                              (Number(asset.purchase_cost || asset.acquisition_cost || 0) - Number(asset.total_paid || 0)) > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openPayModal(asset)}
                                title={t('record_payment') || "To'lov qilish"}
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openHistoryModal(asset)} title={t('history') || 'Tarix'}>
                              <History className="w-4 h-4 text-purple-500" />
                            </Button>
                            {asset.status !== 'disposed' && canDelete(MODULES.ASSETS) && (
                              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => { setAssetToDelete(asset); setShowDeleteDialog(true); }} title={t('dispose')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        {/* Create Asset Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('add_fixed_asset')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('asset_name')} *</label>
                <Input
                  placeholder={t('asset_name')}
                  value={newAsset.asset_name}
                  onChange={(e) => setNewAsset({...newAsset, asset_name: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('category')} *</label>
                  <Select value={newAsset.asset_category} onValueChange={(value) => setNewAsset({...newAsset, asset_category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buildings">{t('category_buildings') || 'Binolar'}</SelectItem>
                      <SelectItem value="vehicles">{t('category_vehicles') || 'Transport vositalari'}</SelectItem>
                      <SelectItem value="equipment">{t('category_equipment') || 'Jihozlar'}</SelectItem>
                      <SelectItem value="computers">{t('category_computers') || 'Kompyuterlar'}</SelectItem>
                      <SelectItem value="furniture">{t('category_furniture') || 'Mebel'}</SelectItem>
                      <SelectItem value="intangible">{t('category_intangible') || 'Nomoddiy aktivlar'}</SelectItem>
                      <SelectItem value="other">{t('category_other_assets') || 'Boshqa'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('purchase_date')} *</label>
                  <Input
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({...newAsset, purchase_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('purchase_cost')} *</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newAsset.purchase_cost}
                    onChange={(e) => setNewAsset({...newAsset, purchase_cost: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('salvage_value') || 'Tugatish qiymati'}</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newAsset.salvage_value}
                    onChange={(e) => setNewAsset({...newAsset, salvage_value: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('useful_life_years')} *</label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={newAsset.useful_life_years}
                    onChange={(e) => setNewAsset({...newAsset, useful_life_years: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('depreciation_method')}</label>
                  <Select value={newAsset.depreciation_method} onValueChange={(value) => setNewAsset({...newAsset, depreciation_method: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">{t('straight_line')}</SelectItem>
                      <SelectItem value="declining_balance">{t('declining_balance')}</SelectItem>
                      <SelectItem value="double_declining">{t('double_declining') || 'Ikki karrali kamaytirish'}</SelectItem>
                      <SelectItem value="sum_of_years">{t('sum_of_years') || 'Yillar yig\'indisi'}</SelectItem>
                      <SelectItem value="units_of_production">{t('units_of_production')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('supplier') || 'Yetkazib beruvchi'}</label>
                  <Input
                    placeholder={t('supplier') || 'Yetkazib beruvchi'}
                    value={newAsset.supplier_name}
                    onChange={(e) => setNewAsset({...newAsset, supplier_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payment_method') || "To'lov turi"}</label>
                  <Select value={newAsset.payment_method} onValueChange={(value) => setNewAsset({...newAsset, payment_method: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">{t('on_credit') || 'Qarzga'}</SelectItem>
                      <SelectItem value="cash">{t('cash') || 'Naqd'}</SelectItem>
                      <SelectItem value="bank">{t('bank') || 'Bank'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateAsset}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newAsset.asset_name || !newAsset.purchase_cost || isSubmitting}
                >
                  {isSubmitting ? t('adding') : t('add_asset')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pay Asset Modal — records a payment against a credit-purchased asset
             (debits Accounts Payable, credits the chosen cash/bank account). */}
        <Dialog open={showPayModal} onOpenChange={(open) => { setShowPayModal(open); if (!open) setAssetToPay(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('record_payment') || "To'lov qilish"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {assetToPay && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-medium text-slate-800">{assetToPay.asset_name || assetToPay.name}</div>
                  <div className="mt-1 flex justify-between text-slate-600">
                    <span>{t('purchase_cost')}</span>
                    <span className="font-medium">{formatCurrency(Number(assetToPay.purchase_cost || assetToPay.acquisition_cost || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{t('paid') || "To'langan"}</span>
                    <span className="font-medium">{formatCurrency(Number(assetToPay.total_paid || 0))}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-red-600">
                    <span>{t('remaining_debt') || "Qoldiq qarz"}</span>
                    <span>{formatCurrency(Math.max(0, Number(assetToPay.purchase_cost || assetToPay.acquisition_cost || 0) - Number(assetToPay.total_paid || 0)))}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">{t('amount') || 'Summa'} *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payment_method') || "To'lov turi"} *</label>
                  <Select value={payForm.method} onValueChange={(value) => setPayForm({ ...payForm, method: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t('cash') || 'Naqd'}</SelectItem>
                      <SelectItem value="bank">{t('bank') || 'Bank'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('paid_at') || "To'lov sanasi"} *</label>
                  <Input
                    type="date"
                    value={payForm.paid_at}
                    onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('note') || 'Izoh'}</label>
                <Input
                  placeholder={t('note') || 'Izoh'}
                  value={payForm.note}
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowPayModal(false)} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!payForm.amount || parseFloat(payForm.amount) <= 0 || isPaying}
                >
                  {isPaying ? (t('saving') || '...') : (t('pay') || "To'lash")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Asset Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('edit_asset')}</DialogTitle>
            </DialogHeader>
            {editAsset && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('asset_name')} *</label>
                    <Input
                      value={editAsset.asset_name}
                      onChange={(e) => setEditAsset({...editAsset, asset_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('asset_code')}</label>
                    <Input
                      value={editAsset.asset_code}
                      onChange={(e) => setEditAsset({...editAsset, asset_code: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('category')}</label>
                    <Select value={editAsset.asset_category || 'equipment'} onValueChange={(value) => setEditAsset({...editAsset, asset_category: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buildings">{t('category_buildings') || 'Binolar'}</SelectItem>
                        <SelectItem value="vehicles">{t('category_vehicles') || 'Transport vositalari'}</SelectItem>
                        <SelectItem value="equipment">{t('category_equipment') || 'Jihozlar'}</SelectItem>
                        <SelectItem value="computers">{t('category_computers') || 'Kompyuterlar'}</SelectItem>
                        <SelectItem value="furniture">{t('category_furniture') || 'Mebel'}</SelectItem>
                        <SelectItem value="intangible">{t('category_intangible') || 'Nomoddiy aktivlar'}</SelectItem>
                        <SelectItem value="other">{t('category_other_assets') || 'Boshqa'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('status')}</label>
                    <Select value={editAsset.status || 'active'} onValueChange={(value) => setEditAsset({...editAsset, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('active')}</SelectItem>
                        <SelectItem value="under_maintenance">{t('under_maintenance')}</SelectItem>
                        <SelectItem value="retired">{t('retired')}</SelectItem>
                        <SelectItem value="disposed">{t('disposed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('purchase_date')}</label>
                    <Input
                      type="date"
                      value={editAsset.purchase_date?.split('T')[0] || ''}
                      onChange={(e) => setEditAsset({...editAsset, purchase_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('next_maintenance_date')}</label>
                    <Input
                      type="date"
                      value={editAsset.next_maintenance_date?.split('T')[0] || ''}
                      onChange={(e) => setEditAsset({...editAsset, next_maintenance_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('purchase_cost')}</label>
                    <Input
                      type="number"
                      value={editAsset.purchase_cost}
                      onChange={(e) => setEditAsset({...editAsset, purchase_cost: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('salvage_value')}</label>
                    <Input
                      type="number"
                      value={editAsset.salvage_value || 0}
                      onChange={(e) => setEditAsset({...editAsset, salvage_value: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('useful_life_years')}</label>
                    <Input
                      type="number"
                      value={editAsset.useful_life_years}
                      onChange={(e) => setEditAsset({...editAsset, useful_life_years: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('depreciation_method')}</label>
                    <Select value={editAsset.depreciation_method || 'straight_line'} onValueChange={(value) => setEditAsset({...editAsset, depreciation_method: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="straight_line">{t('straight_line')}</SelectItem>
                        <SelectItem value="declining_balance">{t('declining_balance')}</SelectItem>
                        <SelectItem value="units_of_production">{t('units_of_production')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('location')}</label>
                    <Input
                      placeholder={t('location_placeholder')}
                      value={editAsset.location || ''}
                      onChange={(e) => setEditAsset({...editAsset, location: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditAsset(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateAsset}
                    className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                    disabled={!editAsset.asset_name || isSubmitting}
                  >
                    {isSubmitting ? t('saving') : t('save_changes')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_dispose')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('dispose_asset_confirm')} <strong>{assetToDelete?.asset_name}</strong> ({assetToDelete?.asset_code})? {t('action_cannot_undone')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setAssetToDelete(null); }}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAsset} className="bg-red-600 hover:bg-red-700">
                {t('dispose')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Transfer Asset Modal */}
        <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('transfer_asset')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('asset')}</Label>
                <Input value={`${assetToTransfer?.asset_name} (${assetToTransfer?.asset_code})`} disabled />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('current_location')}</Label>
                <Input value={assetToTransfer?.location || t('not_set')} disabled />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('new_location')} *</Label>
                <Input
                  placeholder={t('enter_location')}
                  value={transferData.location}
                  onChange={(e) => setTransferData({...transferData, location: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('transfer_date')} *</Label>
                <Input
                  type="date"
                  value={transferData.transfer_date}
                  onChange={(e) => setTransferData({...transferData, transfer_date: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('notes')}</Label>
                <Textarea
                  placeholder={t('transfer_notes')}
                  value={transferData.notes}
                  onChange={(e) => setTransferData({...transferData, notes: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowTransferModal(false); setAssetToTransfer(null); setTransferData({ location: '', notes: '', transfer_date: new Date().toISOString().split('T')[0] }); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleTransferAsset}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!transferData.location}
                >
                  {t('transfer')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Maintenance Modal */}
        <Dialog open={showMaintenanceModal} onOpenChange={setShowMaintenanceModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('add_maintenance_record')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('asset')}</Label>
                <Input value={`${assetForMaintenance?.asset_name} (${assetForMaintenance?.asset_code})`} disabled />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1 block">{t('date')} *</Label>
                  <Input
                    type="date"
                    value={maintenanceData.date}
                    onChange={(e) => setMaintenanceData({...maintenanceData, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1 block">{t('type')} *</Label>
                  <Select value={maintenanceData.type} onValueChange={(value) => setMaintenanceData({...maintenanceData, type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular_to">Oddiy TO</SelectItem>
                      <SelectItem value="capital_repair">Kapital ta'mirlash</SelectItem>
                      <SelectItem value="modernization">Modernizatsiya</SelectItem>
                      <SelectItem value="minor_repair">Joriy ta'mirlash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('description')} *</Label>
                <Textarea
                  placeholder={t('maintenance_description')}
                  value={maintenanceData.description}
                  onChange={(e) => setMaintenanceData({...maintenanceData, description: e.target.value})}
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">{t('cost')}</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maintenanceData.cost}
                  onChange={(e) => setMaintenanceData({...maintenanceData, cost: e.target.value})}
                />
              </div>
              {/* Maintenance History */}
              {assetForMaintenance && (maintenanceHistory[assetForMaintenance.id] || []).length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b">
                    <h4 className="text-sm font-medium text-slate-700">{t('maintenance_history') || "Ta'mirlash tarixi"}</h4>
                  </div>
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {maintenanceHistory[assetForMaintenance.id].map((record, idx) => {
                      const typeLabels = { regular_to: 'Oddiy TO', capital_repair: 'Kapital', modernization: 'Modernizatsiya', minor_repair: 'Joriy', transfer: "Ko'chirish" };
                      return (
                        <div key={record.id || idx} className="px-3 py-2 text-sm flex items-center justify-between">
                          <div>
                            <span className="text-slate-500">{record.service_date ? format(new Date(record.service_date), 'dd.MM.yyyy') : record.date}</span>
                            <Badge variant="outline" className="ml-2 text-xs">{typeLabels[record.maintenance_type || record.type] || record.maintenance_type || record.type}</Badge>
                            {record.description && <p className="text-slate-600 text-xs mt-0.5">{record.description}</p>}
                          </div>
                          {(record.cost > 0) && <span className="font-medium text-slate-700">{formatCurrency(record.cost)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowMaintenanceModal(false); setAssetForMaintenance(null); setMaintenanceData({ date: new Date().toISOString().split('T')[0], type: 'regular_to', description: '', cost: '' }); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleAddMaintenance}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!maintenanceData.description}
                >
                  {t('add_record')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Asset History Modal */}
        <Dialog open={showHistoryModal} onOpenChange={(open) => { if (!open) { setShowHistoryModal(false); setAssetForHistory(null); setHistoryRecords([]); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-500" />
                {assetForHistory?.asset_name} — {t('history') || 'Tarix'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {/* Asset Summary */}
              {assetForHistory && (
                <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">{t('asset_code') || 'Kod'}</p>
                    <p className="font-medium">{assetForHistory.asset_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t('acquisition_cost') || 'Xarid tannarxi'}</p>
                    <p className="font-medium">{formatCurrency(assetForHistory.acquisition_cost || assetForHistory.purchase_cost || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t('current_value') || 'Joriy qiymat'}</p>
                    <p className="font-medium text-blue-600">{formatCurrency(assetForHistory.current_value || assetForHistory.book_value || 0)}</p>
                  </div>
                </div>
              )}

              {/* History Records */}
              {historyLoading ? (
                <div className="text-center py-8 text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{t('no_history') || "Hozircha tarix mavjud emas"}</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="divide-y max-h-96 overflow-y-auto">
                      {historyRecords.map((record, idx) => {
                        const typeLabels = {
                          regular_to: 'Oddiy TO',
                          capital_repair: 'Kapital ta\'mirlash',
                          modernization: 'Modernizatsiya',
                          minor_repair: 'Joriy ta\'mirlash',
                          transfer: 'Ko\'chirish'
                        };
                        const typeColors = {
                          regular_to: 'bg-blue-100 text-blue-700',
                          capital_repair: 'bg-red-100 text-red-700',
                          modernization: 'bg-purple-100 text-purple-700',
                          minor_repair: 'bg-yellow-100 text-yellow-700',
                          transfer: 'bg-green-100 text-green-700'
                        };
                        const mainType = record.maintenance_type || record.type;
                        return (
                          <div key={record.id || idx} className="px-4 py-3 hover:bg-slate-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="text-sm text-slate-500 w-24">
                                  {record.service_date ? format(new Date(record.service_date), 'dd.MM.yyyy') : record.date}
                                </div>
                                <Badge className={`text-xs ${typeColors[mainType] || 'bg-gray-100 text-gray-700'}`}>
                                  {typeLabels[mainType] || mainType}
                                </Badge>
                              </div>
                              {record.cost > 0 && (
                                <span className="font-semibold text-slate-800">{formatCurrency(record.cost)}</span>
                              )}
                            </div>
                            {record.description && (
                              <p className="text-sm text-slate-600 mt-1 ml-27">{record.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Total Cost */}
                  <div className="mt-3 flex justify-between items-center px-4 py-2 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-600">{t('total_maintenance_cost') || "Jami xarajatlar"}</span>
                    <span className="text-lg font-bold text-slate-800">
                      {formatCurrency(historyRecords.reduce((sum, r) => sum + (r.cost || 0), 0))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}