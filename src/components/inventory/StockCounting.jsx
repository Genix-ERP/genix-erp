import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, ClipboardCheck, Calendar, CheckCircle, Clock, AlertCircle,
  Warehouse, Package, ArrowUp, ArrowDown, Minus, Edit, Eye, FileText,
  User, Check, X
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";

export default function StockCounting() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    stockCounts,
    products,
    warehouses,
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

  const [newCount, setNewCount] = useState({
    warehouse_id: '',
    count_date: new Date().toISOString().split('T')[0],
    counted_by: '',
    notes: ''
  });

  const [approvedBy, setApprovedBy] = useState('');

  // Calculate summaries
  const summary = {
    total: stockCounts.length,
    completed: stockCounts.filter(sc => sc.status === 'completed').length,
    inProgress: stockCounts.filter(sc => sc.status === 'in_progress' || sc.status === 'draft').length,
    totalVariance: stockCounts
      .filter(sc => sc.status === 'completed')
      .reduce((sum, sc) => sum + sc.lines.reduce((lineSum, l) => lineSum + Math.abs(l.variance || 0), 0), 0)
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
        notes: ''
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
    await updateStockCountLine(selectedCount.id, productId, parseInt(countedQty) || 0, reason);
    // Refresh selected count
    const updated = stockCounts.find(sc => sc.id === selectedCount.id);
    setSelectedCount(updated);
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

          {activeTab === 'list' && (
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
                    const totalVariance = count.lines?.reduce((sum, l) => sum + Math.abs(l.variance || 0), 0) || 0;
                    const countedLines = count.lines?.filter(l => l.counted_qty !== null).length || 0;

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
                          <span className="text-slate-400">/{count.lines?.length || 0}</span>
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
                          {(count.status === 'draft' || count.status === 'in_progress') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCount(count);
                                setActiveTab('count');
                              }}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {t('continue')}
                            </Button>
                          )}
                          {count.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCount(count);
                                setActiveTab('count');
                              }}
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
                            disabled={selectedCount.lines?.some(l => l.counted_qty === null)}
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

                        return (
                          <TableRow key={line.product_id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">{product?.name || t('unknown')}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{line.system_qty}</TableCell>
                            <TableCell className="text-center">
                              {isEditable ? (
                                <Input
                                  type="number"
                                  value={line.counted_qty ?? ''}
                                  onChange={(e) => handleUpdateLine(line.product_id, e.target.value, line.variance_reason)}
                                  className="w-24 text-center mx-auto"
                                  placeholder="0"
                                />
                              ) : (
                                <span className="font-semibold">{line.counted_qty ?? '-'}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {getVarianceIcon(line.variance)}
                                <span className={`font-semibold ${
                                  line.variance > 0 ? 'text-green-600' :
                                  line.variance < 0 ? 'text-red-600' : 'text-slate-400'
                                }`}>
                                  {line.variance !== null ? (line.variance > 0 ? `+${line.variance}` : line.variance) : '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isEditable && line.variance !== 0 && line.variance !== null ? (
                                <Input
                                  value={line.variance_reason || ''}
                                  onChange={(e) => handleUpdateLine(line.product_id, line.counted_qty, e.target.value)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new_stocktake')}</DialogTitle>
            <DialogDescription>{t('enter_stocktake_details')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">{t('warehouse')}</label>
              <Select
                value={newCount.warehouse_id}
                onValueChange={(v) => setNewCount({ ...newCount, warehouse_id: v })}
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
              <label className="text-sm font-medium">{t('date')}</label>
              <Input
                type="date"
                value={newCount.count_date}
                onChange={(e) => setNewCount({ ...newCount, count_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('counted_by')}</label>
              <Input
                value={newCount.counted_by}
                onChange={(e) => setNewCount({ ...newCount, counted_by: e.target.value })}
                placeholder={t('employee_name')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('notes')}</label>
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
              <label className="text-sm font-medium">{t('approved_by')}</label>
              <Input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder={t('employee_name')}
              />
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
  );
}
