import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, ClipboardCheck, Calendar, CheckCircle, Clock, AlertCircle,
  Warehouse, Package, ArrowUp, ArrowDown, Minus, Edit, Eye, FileText,
  User, Check, X, EyeOff, RefreshCw, BarChart3, Target, Repeat, CalendarClock, HelpCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { hrService } from "@/api/services/hr";
import { inventoryService } from "@/api/services/inventory";
import { usePermissions } from "@/hooks/usePermissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Field Help Component - Odoo-style tooltip for field explanations
const FieldHelp = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs bg-slate-800 text-white p-2 rounded-lg shadow-lg">
      <p>{text}</p>
    </TooltipContent>
  </Tooltip>
);

// Label with help tooltip
const LabelWithHelp = ({ label, helpText, required }) => (
  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center">
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

// SAP-style Count Types
const countTypes = [
  { value: 'full', labelKey: 'full_count', descKey: 'count_all_items' },
  { value: 'cycle', labelKey: 'cycle_count', descKey: 'based_on_abc' },
  { value: 'spot', labelKey: 'spot_check', descKey: 'random_sampling' },
  { value: 'annual', labelKey: 'annual_count', descKey: 'year_end_inventory' },
];

// ABC Classification for cycle counting
const abcClasses = [
  { value: 'A', labelKey: 'class_a', descKey: 'high_value_weekly', frequency: 7 },
  { value: 'B', labelKey: 'class_b', descKey: 'medium_value_monthly', frequency: 30 },
  { value: 'C', labelKey: 'class_c', descKey: 'low_value_quarterly', frequency: 90 },
];

// Variance reasons (SAP)
const varianceReasons = [
  { value: 'theft', labelKey: 'theft_shrinkage' },
  { value: 'damage', labelKey: 'damaged_goods' },
  { value: 'miscount', labelKey: 'previous_miscount' },
  { value: 'data_entry', labelKey: 'data_entry_error' },
  { value: 'unreported', labelKey: 'unreported_movement' },
  { value: 'expired', labelKey: 'expired_scrapped' },
  { value: 'other', labelKey: 'other' },
];

export default function StockCounting() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const {
    stockCounts,
    products,
    warehouses,
    inventory,
    createStockCount,
    updateStockCountLine,
    completeStockCount,
    cancelStockCount,
    isLoading
  } = useInventory();

  const [activeTab, setActiveTab] = useState("list");
  const [selectedCount, setSelectedCount] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Cleanup modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowCreateModal(false);
      setShowCompleteModal(false);
    };
  }, []);

  const [newCount, setNewCount] = useState({
    warehouse_id: '',
    count_date: new Date().toISOString().split('T')[0],
    counted_by: '',
    notes: '',
    selected_products: [], // empty = all products, otherwise specific product IDs
    // SAP-style count settings
    count_type: 'full', // full, cycle, spot, annual
    abc_class: '', // A, B, C - for cycle counting
    blind_count: false, // Hide system quantities from counter
    require_recount: true, // Require recount if variance exceeds threshold
    variance_threshold: 5, // % threshold for recount
    allow_multiple_counters: false,
    second_counter: '',
    // Scheduling (SAP)
    scheduled_date: '',
    is_scheduled: false,
    recurrence: 'none', // none, daily, weekly, monthly
  });

  const [approvedBy, setApprovedBy] = useState('');

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await hrService.listEmployees();
        setEmployees(data || []);
      } catch (err) {
        console.error('Error fetching employees:', err);
        // Fallback to empty array if API fails
        setEmployees([]);
      }
    };
    fetchEmployees();
  }, []);

  // Calculate summaries
  const summary = {
    total: stockCounts.length,
    completed: stockCounts.filter(sc => sc.status === 'completed').length,
    inProgress: stockCounts.filter(sc => sc.status === 'in_progress' || sc.status === 'draft').length,
    totalVariance: stockCounts
      .filter(sc => sc.status === 'completed')
      .reduce((sum, sc) => sum + Math.abs(sc.total_variance_value || 0), 0)
  };

  const filteredCounts = stockCounts.filter(sc => {
    const matchesSearch = searchQuery === '' ||
      sc.count_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.counted_by?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sc.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const handleCreateCount = async () => {
    setIsSaving(true);
    try {
      const count = await createStockCount(newCount);
      setNewCount({
        warehouse_id: '',
        count_date: new Date().toISOString().split('T')[0],
        counted_by: '',
        notes: '',
        selected_products: [],
        count_type: 'full',
        abc_class: '',
        blind_count: false,
        require_recount: true,
        variance_threshold: 5,
        allow_multiple_counters: false,
        second_counter: '',
        scheduled_date: '',
        is_scheduled: false,
        recurrence: 'none',
      });
      setShowCreateModal(false);
      setSelectedCount(count);
      setActiveTab('count');
    } catch (err) {
      console.error('Error creating stock count:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLine = async (productId, countedQty, reason) => {
    if (!selectedCount) return;

    // Get current system_qty for variance calculation
    const line = selectedCount.lines?.find(l => l.product_id === productId);
    const inventoryItem = inventory.find(i =>
      i.product_id === productId &&
      i.warehouse_id === selectedCount.warehouse_id
    );
    const systemQty = line?.system_quantity ?? line?.system_qty ?? inventoryItem?.quantity_on_hand ?? inventoryItem?.quantity ?? 0;
    const parsedCountedQty = parseInt(countedQty) || 0;
    const variance = parsedCountedQty - systemQty;

    // Update the line locally immediately for better UX
    const updatedLines = selectedCount.lines.map(l => {
      if (l.product_id === productId) {
        return {
          ...l,
          counted_quantity: parsedCountedQty,
          counted_qty: parsedCountedQty,
          variance_quantity: variance,
          variance: variance,
          variance_reason: reason || null,
          system_quantity: systemQty,
          system_qty: systemQty,
        };
      }
      return l;
    });

    const updatedCount = { ...selectedCount, lines: updatedLines, status: 'in_progress' };
    setSelectedCount(updatedCount);

    // Also persist to context/storage
    await updateStockCountLine(selectedCount.id, productId, parsedCountedQty, reason, systemQty);
  };

  const handleComplete = async () => {
    if (!selectedCount || !approvedBy) return;
    setIsSaving(true);
    try {
      await completeStockCount(selectedCount.id, approvedBy);
      setShowCompleteModal(false);
      setApprovedBy('');
      setSelectedCount(null);
      setActiveTab('list');
    } catch (err) {
      console.error('Error completing stock count:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCount = async (count) => {
    try {
      const fullCount = await inventoryService.getStockCount(count.id);
      setSelectedCount(fullCount);
      setActiveTab('count');
    } catch (err) {
      console.error('Error fetching stock count details:', err);
      // Fallback to list item data
      setSelectedCount(count);
      setActiveTab('count');
    }
  };

  const handleCancel = async () => {
    if (!selectedCount) return;
    await cancelStockCount(selectedCount.id);
    setSelectedCount(null);
    setActiveTab('list');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-700"><Clock className="w-3 h-3 mr-1" /> {t('draft')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700"><Edit className="w-3 h-3 mr-1" /> {t('in_progress')}</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> {t('completed')}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700"><X className="w-3 h-3 mr-1" /> {t('cancelled')}</Badge>;
      default:
        return null;
    }
  };

  const getVarianceIcon = (variance) => {
    if (variance === 0 || variance === null) return <Minus className="w-4 h-4 text-slate-400" />;
    if (variance > 0) return <ArrowUp className="w-4 h-4 text-green-600" />;
    return <ArrowDown className="w-4 h-4 text-red-600" />;
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">{t('total_stocktakes')}</p>
                <p className="text-2xl font-bold text-blue-800">{summary.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">{t('completed')}</p>
                <p className="text-2xl font-bold text-green-800">{summary.completed}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">{t('in_progress')}</p>
                <p className="text-2xl font-bold text-orange-800">{summary.inProgress}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">{t('total_variance')}</p>
                <p className="text-2xl font-bold text-purple-800">{summary.totalVariance}</p>
                <p className="text-xs text-purple-500">{t('units')}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <TabsList className="bg-white/80 backdrop-blur-sm p-1 rounded-lg border border-slate-200">
            <TabsTrigger value="list" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-2" />
              {t('list')}
            </TabsTrigger>
            <TabsTrigger value="count" disabled={!selectedCount} className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              {t('count')}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'list' && canCreate(MODULES.INVENTORY) && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('new_stocktake')}
            </Button>
          )}
        </div>

        {/* List Tab */}
        <TabsContent value="list">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="draft">{t('draft')}</SelectItem>
                <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                <SelectItem value="completed">{t('completed')}</SelectItem>
                <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('count_number')}</TableHead>
                    <TableHead>{t('warehouse')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('counted_by')}</TableHead>
                    <TableHead>{t('products')}</TableHead>
                    <TableHead>{t('variance')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCounts.map((count) => {
                    const warehouse = warehouses.find(w => w.id === count.warehouse_id);
                    const totalVariance = Math.abs(count.total_variance_value || 0);
                    const countedLines = count.counted_count || 0;

                    return (
                      <TableRow key={count.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono font-medium">{count.count_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-slate-400" />
                            {warehouse?.name || t('unknown')}
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(count.count_date), 'dd.MM.yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            {count.counted_by || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{countedLines}</span>
                          <span className="text-slate-400">/{count.line_count || 0}</span>
                        </TableCell>
                        <TableCell>
                          {count.status === 'completed' ? (
                            <Badge variant={totalVariance > 0 ? 'destructive' : 'secondary'}>
                              {totalVariance > 0 ? `±${totalVariance}` : t('matched')}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(count.status)}</TableCell>
                        <TableCell className="text-right">
                          {(count.status === 'draft' || count.status === 'in_progress') && canUpdate(MODULES.INVENTORY) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSelectCount(count)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {t('continue')}
                            </Button>
                          )}
                          {count.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectCount(count)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              {t('view')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        {t('no_stocktakes_found')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Count Tab */}
        <TabsContent value="count">
          {selectedCount && (
            <div className="space-y-4">
              {/* Count Header */}
              <Card className="bg-gradient-to-r from-slate-50 to-slate-100">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedCount.count_number}</h3>
                      <p className="text-sm text-slate-500">
                        {warehouses.find(w => w.id === selectedCount.warehouse_id)?.name} - {format(new Date(selectedCount.count_date), 'dd.MM.yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(selectedCount.status)}
                      {selectedCount.status !== 'completed' && selectedCount.status !== 'cancelled' && (
                        <>
                          <Button variant="outline" size="sm" onClick={handleCancel}>
                            <X className="w-4 h-4 mr-1" />
                            {t('cancel')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setShowCompleteModal(true)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={selectedCount.lines?.some(l => (l.counted_quantity ?? l.counted_qty) === null)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {t('complete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Count Lines */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{t('products')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('product')}</TableHead>
                        <TableHead className="text-center">{t('system_qty')}</TableHead>
                        <TableHead className="text-center">{t('counted')}</TableHead>
                        <TableHead className="text-center">{t('variance')}</TableHead>
                        <TableHead>{t('reason')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCount.lines?.map((line) => {
                        const product = products.find(p => p.id === line.product_id);
                        const isEditable = selectedCount.status !== 'completed' && selectedCount.status !== 'cancelled';
                        const systemQty = line.system_quantity ?? line.system_qty ?? 0;
                        const countedQty = line.counted_quantity ?? line.counted_qty;
                        const hasCounted = countedQty !== null && countedQty !== undefined;
                        const variance = hasCounted ? (line.variance_quantity ?? line.variance ?? (countedQty - systemQty)) : 0;
                        const productName = line.product_name || product?.name || t('unknown');

                        return (
                          <TableRow key={line.id || line.product_id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">{productName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{systemQty}</TableCell>
                            <TableCell className="text-center">
                              {isEditable ? (
                                <Input
                                  type="number"
                                  value={countedQty ?? ''}
                                  onChange={(e) => handleUpdateLine(line.product_id, e.target.value, line.variance_reason)}
                                  className="w-24 text-center mx-auto"
                                  placeholder="0"
                                />
                              ) : (
                                <span className="font-semibold">{countedQty ?? '-'}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {getVarianceIcon(variance)}
                                <span className={`font-semibold ${
                                  variance > 0 ? 'text-green-600' :
                                  variance < 0 ? 'text-red-600' : 'text-slate-400'
                                }`}>
                                  {countedQty !== null && countedQty !== undefined ? (variance > 0 ? `+${variance}` : variance) : '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isEditable && variance !== 0 ? (
                                <Input
                                  value={line.variance_reason || ''}
                                  onChange={(e) => handleUpdateLine(line.product_id, countedQty, e.target.value)}
                                  placeholder={t('enter_reason')}
                                  className="w-full"
                                />
                              ) : (
                                <span className="text-slate-500">{line.variance_reason || '-'}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Count Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_stocktake')}</DialogTitle>
            <DialogDescription>{t('enter_stocktake_details')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* SAP Count Type Selection */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                <ClipboardCheck className="w-3 h-3" /> {t('count_type') || 'Count Type'} (SAP)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {countTypes.map((ct) => (
                  <div
                    key={ct.value}
                    className={`p-2 rounded-lg border cursor-pointer transition-all text-center ${
                      newCount.count_type === ct.value
                        ? 'bg-blue-100 border-blue-400'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                    onClick={() => setNewCount({ ...newCount, count_type: ct.value })}
                  >
                    <p className="text-xs font-medium">{t(ct.labelKey)}</p>
                    <p className="text-[10px] text-slate-500">{t(ct.descKey)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ABC Class for Cycle Count */}
            {newCount.count_type === 'cycle' && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> {t('abc_classification') || 'ABC Classification'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {abcClasses.map((abc) => (
                    <div
                      key={abc.value}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        newCount.abc_class === abc.value
                          ? 'bg-purple-100 border-purple-400'
                          : 'bg-white border-slate-200 hover:border-purple-300'
                      }`}
                      onClick={() => setNewCount({ ...newCount, abc_class: abc.value })}
                    >
                      <p className="text-sm font-bold text-center">{t(abc.labelKey)}</p>
                      <p className="text-[10px] text-slate-500 text-center">{t(abc.descKey)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <LabelWithHelp
                  label={t('warehouse')}
                  required
                  helpText={t('help_count_warehouse') || "Hisoblash o'tkaziladigan ombor. Tanlanganidan so'ng mahsulotlar ro'yxati ko'rsatiladi."}
                />
                <Select
                  value={newCount.warehouse_id}
                  onValueChange={(v) => setNewCount({ ...newCount, warehouse_id: v, selected_products: [] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_warehouse')} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <LabelWithHelp
                  label={t('date')}
                  helpText={t('help_count_date') || "Hisoblash sanasi. Hisobotlarda va tarixda ko'rsatiladi."}
                />
                <Input
                  type="date"
                  value={newCount.count_date}
                  onChange={(e) => setNewCount({ ...newCount, count_date: e.target.value })}
                />
              </div>
            </div>

            {/* Product selection - show products in selected warehouse */}
            <div>
              <LabelWithHelp
                label={t('products')}
                helpText={t('help_count_products') || "Hisoblash uchun mahsulotlarni tanlang. Bo'sh = barcha mahsulotlar hisoblanadi."}
              />
              <p className="text-xs text-slate-500 mb-2">{t('select_products_to_count')}</p>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
                {!newCount.warehouse_id ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    {t('select_warehouse_first')}
                  </p>
                ) : (() => {
                  // Get products from inventory in this warehouse
                  const warehouseProducts = inventory
                    .filter(inv => inv.warehouse_id === newCount.warehouse_id)
                    .map(inv => {
                      const product = products.find(p => p.id === inv.product_id);
                      return product ? { ...product, system_qty: inv.quantity_on_hand ?? inv.quantity ?? 0 } : null;
                    })
                    .filter(Boolean);

                  // If no inventory, show all products with 0 quantity
                  const displayProducts = warehouseProducts.length > 0
                    ? warehouseProducts
                    : products.map(p => ({ ...p, system_qty: 0 }));

                  if (displayProducts.length === 0) {
                    return (
                      <p className="text-sm text-slate-500 text-center py-4">
                        {t('no_products_in_warehouse')}
                      </p>
                    );
                  }

                  return (
                    <>
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Checkbox
                          id="select-all"
                          checked={newCount.selected_products.length === 0 || newCount.selected_products.length === displayProducts.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewCount({ ...newCount, selected_products: [] }); // Empty = all products
                            } else {
                              setNewCount({ ...newCount, selected_products: [] });
                            }
                          }}
                        />
                        <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                          {t('all_products')} ({displayProducts.length})
                        </label>
                      </div>
                      {displayProducts.map(product => (
                        <div key={product.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`product-${product.id}`}
                            checked={newCount.selected_products.length === 0 || newCount.selected_products.includes(product.id)}
                            onCheckedChange={(checked) => {
                              if (newCount.selected_products.length === 0) {
                                // Currently "all" is selected, switch to specific selection
                                const allIds = displayProducts.map(p => p.id);
                                if (!checked) {
                                  setNewCount({ ...newCount, selected_products: allIds.filter(id => id !== product.id) });
                                }
                              } else {
                                if (checked) {
                                  const newSelected = [...newCount.selected_products, product.id];
                                  // If all selected, switch back to empty (all)
                                  if (newSelected.length === displayProducts.length) {
                                    setNewCount({ ...newCount, selected_products: [] });
                                  } else {
                                    setNewCount({ ...newCount, selected_products: newSelected });
                                  }
                                } else {
                                  setNewCount({ ...newCount, selected_products: newCount.selected_products.filter(id => id !== product.id) });
                                }
                              }
                            }}
                          />
                          <label htmlFor={`product-${product.id}`} className="text-sm cursor-pointer flex-1 flex justify-between">
                            <span>{product.name}</span>
                            <span className="text-slate-500">{product.system_qty} {t('units')}</span>
                          </label>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Counter Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <LabelWithHelp
                  label={t('counted_by')}
                  required
                  helpText={t('help_counted_by') || "Hisoblashni amalga oshiruvchi xodim. Mas'uliyat va audit uchun muhim."}
                />
                {employees.length > 0 ? (
                  <Select
                    value={newCount.counted_by}
                    onValueChange={(v) => setNewCount({ ...newCount, counted_by: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_employee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.name || `${emp.first_name} ${emp.last_name}`}>
                          {emp.name || `${emp.first_name} ${emp.last_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={newCount.counted_by}
                    onChange={(e) => setNewCount({ ...newCount, counted_by: e.target.value })}
                    placeholder={t('employee_name')}
                  />
                )}
              </div>
              {newCount.allow_multiple_counters && (
                <div>
                  <LabelWithHelp
                    label={t('second_counter') || 'Second Counter'}
                    helpText={t('help_second_counter') || "Ikkinchi hisoblaguvchi. Mustaqil hisoblash uchun birinchi hisoblaguvchidan farqli bo'lishi kerak."}
                  />
                  {employees.length > 0 ? (
                    <Select
                      value={newCount.second_counter}
                      onValueChange={(v) => setNewCount({ ...newCount, second_counter: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_employee')} />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.filter(e => (e.name || `${e.first_name} ${e.last_name}`) !== newCount.counted_by).map(emp => (
                          <SelectItem key={emp.id} value={emp.name || `${emp.first_name} ${emp.last_name}`}>
                            {emp.name || `${emp.first_name} ${emp.last_name}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={newCount.second_counter}
                      onChange={(e) => setNewCount({ ...newCount, second_counter: e.target.value })}
                      placeholder={t('employee_name')}
                    />
                  )}
                </div>
              )}
            </div>

            {/* SAP Count Options */}
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-medium text-green-700 mb-3 flex items-center gap-1">
                <Target className="w-3 h-3" /> {t('count_options') || 'Count Options'}
              </p>
              <div className="space-y-3">
                {/* Blind Count */}
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-slate-500" />
                    <div>
                      <Label className="text-sm">{t('blind_count') || 'Blind Count'}</Label>
                      <p className="text-xs text-slate-500">{t('blind_count_desc') || 'Hide system quantities from counter'}</p>
                    </div>
                  </div>
                  <Switch
                    checked={newCount.blind_count}
                    onCheckedChange={(checked) => setNewCount({ ...newCount, blind_count: checked })}
                  />
                </div>

                {/* Require Recount */}
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    <div>
                      <Label className="text-sm">{t('require_recount') || 'Require Recount'}</Label>
                      <p className="text-xs text-slate-500">{t('require_recount_desc') || 'If variance exceeds threshold'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {newCount.require_recount && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          className="w-16 h-8 text-center"
                          value={newCount.variance_threshold}
                          onChange={(e) => setNewCount({ ...newCount, variance_threshold: parseInt(e.target.value) || 5 })}
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    )}
                    <Switch
                      checked={newCount.require_recount}
                      onCheckedChange={(checked) => setNewCount({ ...newCount, require_recount: checked })}
                    />
                  </div>
                </div>

                {/* Multiple Counters */}
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <div>
                      <Label className="text-sm">{t('multiple_counters') || 'Multiple Counters'}</Label>
                      <p className="text-xs text-slate-500">{t('multiple_counters_desc') || 'Two people count independently'}</p>
                    </div>
                  </div>
                  <Switch
                    checked={newCount.allow_multiple_counters}
                    onCheckedChange={(checked) => setNewCount({ ...newCount, allow_multiple_counters: checked, second_counter: '' })}
                  />
                </div>
              </div>
            </div>

            {/* Scheduling (SAP) */}
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-orange-700 flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> {t('schedule_count') || 'Schedule Count'}
                </p>
                <Switch
                  checked={newCount.is_scheduled}
                  onCheckedChange={(checked) => setNewCount({ ...newCount, is_scheduled: checked })}
                />
              </div>
              {newCount.is_scheduled && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-xs">{t('scheduled_date') || 'Scheduled Date'}</Label>
                    <Input
                      type="date"
                      className="h-9"
                      value={newCount.scheduled_date}
                      onChange={(e) => setNewCount({ ...newCount, scheduled_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('recurrence') || 'Recurrence'}</Label>
                    <Select
                      value={newCount.recurrence}
                      onValueChange={(v) => setNewCount({ ...newCount, recurrence: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('no_recurrence') || 'No Recurrence'}</SelectItem>
                        <SelectItem value="daily">{t('daily') || 'Daily'}</SelectItem>
                        <SelectItem value="weekly">{t('weekly') || 'Weekly'}</SelectItem>
                        <SelectItem value="monthly">{t('monthly') || 'Monthly'}</SelectItem>
                        <SelectItem value="quarterly">{t('quarterly') || 'Quarterly'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div>
              <LabelWithHelp
                label={t('notes')}
                helpText={t('help_count_notes') || "Hisoblash haqida qo'shimcha izohlar. Maxsus ko'rsatmalar yoki sharhlar uchun."}
              />
              <Textarea
                value={newCount.notes}
                onChange={(e) => setNewCount({ ...newCount, notes: e.target.value })}
                placeholder={t('additional_notes')}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('cancel')}</Button>
              <Button
                onClick={handleCreateCount}
                disabled={isSaving || !newCount.warehouse_id}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {isSaving ? t('creating') : t('start')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Count Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('complete_stocktake')}</DialogTitle>
            <DialogDescription>
              {t('complete_stocktake_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-700">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                {t('stocktake_warning')}
              </p>
            </div>
            <div>
              <LabelWithHelp
                label={t('approved_by')}
                helpText={t('help_approved_by') || "Hisoblashni tasdiqlagan shaxs. Odatda ombor menejeri yoki buxgalter."}
              />
              {employees.length > 0 ? (
                <Select
                  value={approvedBy}
                  onValueChange={setApprovedBy}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_employee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.name || `${emp.first_name} ${emp.last_name}`}>
                        {emp.name || `${emp.first_name} ${emp.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  placeholder={t('employee_name')}
                />
              )}
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCompleteModal(false)}>{t('cancel')}</Button>
              <Button
                onClick={handleComplete}
                disabled={isSaving || !approvedBy}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSaving ? t('completing') : t('confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
