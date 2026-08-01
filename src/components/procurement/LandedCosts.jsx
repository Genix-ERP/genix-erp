import { formatDate } from '@/utils/formatDate';
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  DollarSign,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Ship,
  Calculator,
  Package,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { procurementService } from "@/api/services/procurement";
import { toast } from 'sonner';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  validated: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function LandedCosts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const allocationMethods = [
    { value: 'by_value', label: t('by_value'), description: t('by_value_desc') },
    { value: 'by_quantity', label: t('by_quantity'), description: t('by_quantity_desc') },
    { value: 'equal', label: t('equal_split'), description: t('equal_split_desc') },
  ];

  const [landedCosts, setLandedCosts] = useState([]);
  const [costTypes, setCostTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLC, setSelectedLC] = useState(null);

  // For creating new landed cost
  const [grData, setGrData] = useState(null);
  const [newLC, setNewLC] = useState({
    goods_receipt_id: '',
    cost_date: format(new Date(), 'yyyy-MM-dd'),
    allocation_method: 'by_value',
    notes: '',
    lines: [],
  });

  // Fetch landed costs
  const fetchLandedCosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await procurementService.listLandedCosts();
      setLandedCosts(data || []);
    } catch (error) {
      console.error('Failed to fetch landed costs:', error);
      setLandedCosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch cost types
  const fetchCostTypes = useCallback(async () => {
    try {
      const data = await procurementService.listLandedCostTypes();
      setCostTypes(data || []);
    } catch (error) {
      console.error('Failed to fetch cost types:', error);
      setCostTypes([]);
    }
  }, []);

  useEffect(() => {
    fetchLandedCosts();
    fetchCostTypes();
  }, [fetchLandedCosts, fetchCostTypes]);

  // Filter landed costs
  const filteredCosts = landedCosts.filter(lc => {
    const matchesSearch =
      lc.landed_cost_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lc.gr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lc.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Load GR data for creating landed cost
  const loadGRData = async (grId) => {
    try {
      const data = await procurementService.getGRForLandedCost(grId);
      setGrData(data);

      if (data.has_landed_cost) {
        toast.warning(t('gr_already_has_lc'));
      }

      setNewLC({
        ...newLC,
        goods_receipt_id: grId,
        lines: [{
          cost_type_name: '',
          amount: 0,
          vendor_name: '',
          reference: '',
          notes: '',
        }],
      });
    } catch (error) {
      toast.error(t('failed_load_gr'));
    }
  };

  // Add cost line
  const addCostLine = () => {
    setNewLC({
      ...newLC,
      lines: [
        ...newLC.lines,
        {
          cost_type_name: '',
          amount: 0,
          vendor_name: '',
          reference: '',
          notes: '',
        },
      ],
    });
  };

  // Update cost line
  const updateCostLine = (index, field, value) => {
    const updatedLines = [...newLC.lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    setNewLC({ ...newLC, lines: updatedLines });
  };

  // Remove cost line
  const removeCostLine = (index) => {
    const updatedLines = newLC.lines.filter((_, i) => i !== index);
    setNewLC({ ...newLC, lines: updatedLines });
  };

  // Calculate totals
  const calculateTotalLandedCost = () => {
    return newLC.lines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  };

  // Create landed cost
  const handleCreate = async () => {
    if (!newLC.goods_receipt_id || newLC.lines.length === 0) {
      toast.error(t('select_gr_add_cost'));
      return;
    }

    const validLines = newLC.lines.filter(l => l.cost_type_name && l.amount > 0);
    if (validLines.length === 0) {
      toast.error(t('add_valid_cost_line'));
      return;
    }

    try {
      await procurementService.createLandedCost({
        ...newLC,
        lines: validLines,
      });
      toast.success(t('landed_cost_created'));
      setShowCreateModal(false);
      resetForm();
      fetchLandedCosts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create landed cost');
    }
  };

  // Validate landed cost
  const handleValidate = async (id) => {
    try {
      await procurementService.validateLandedCost(id);
      toast.success(t('landed_cost_validated'));
      fetchLandedCosts();
      if (selectedLC?.id === id) {
        const updated = await procurementService.getLandedCost(id);
        setSelectedLC(updated);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to validate landed cost');
    }
  };

  // Cancel landed cost
  const handleCancel = async (id) => {
    try {
      await procurementService.cancelLandedCost(id);
      toast.success(t('landed_cost_cancelled'));
      fetchLandedCosts();
      if (selectedLC?.id === id) {
        const updated = await procurementService.getLandedCost(id);
        setSelectedLC(updated);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel landed cost');
    }
  };

  // View details
  const handleViewDetails = async (lc) => {
    try {
      const data = await procurementService.getLandedCost(lc.id);
      setSelectedLC(data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error(t('failed_load_lc'));
    }
  };

  // Reset form
  const resetForm = () => {
    setNewLC({
      goods_receipt_id: '',
      cost_date: format(new Date(), 'yyyy-MM-dd'),
      allocation_method: 'by_value',
      notes: '',
      lines: [],
    });
    setGrData(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            {t('landed_costs')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('landed_costs_desc')}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('new_landed_cost')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('search_lc_gr_supplier')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('filter_by_status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses')}</SelectItem>
                <SelectItem value="draft">{t('draft')}</SelectItem>
                <SelectItem value="validated">{t('validated')}</SelectItem>
                <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('lc_number')}</TableHead>
                <TableHead>{t('gr_number')}</TableHead>
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead className="text-right">{t('product_value')}</TableHead>
                <TableHead className="text-right">{t('landed_cost')}</TableHead>
                <TableHead className="text-right">{t('total_cost')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    {t('loading')}...
                  </TableCell>
                </TableRow>
              ) : filteredCosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {t('no_landed_costs_found')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCosts.map((lc) => (
                  <TableRow key={lc.id}>
                    <TableCell className="font-medium">{lc.landed_cost_number}</TableCell>
                    <TableCell>{lc.gr_number}</TableCell>
                    <TableCell>{lc.supplier_name}</TableCell>
                    <TableCell>{formatDate(lc.cost_date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(lc.product_value)}</TableCell>
                    <TableCell className="text-right text-orange-600 font-medium">
                      +{formatCurrency(lc.total_landed_cost)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(lc.total_cost)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[lc.status] || statusColors.draft}>
                        {lc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(lc)}
                          title={t('view')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {lc.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleValidate(lc.id)}
                              title={t('validate')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancel(lc.id)}
                              title={t('cancel')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateModal(open); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              {t('create_landed_cost')}
            </DialogTitle>
            <DialogDescription>
              {t('add_costs_to_products')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* GR Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('goods_receipt_id')} *</Label>
                <Input
                  placeholder={t('enter_gr_id')}
                  value={newLC.goods_receipt_id}
                  onChange={(e) => setNewLC({ ...newLC, goods_receipt_id: e.target.value })}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => loadGRData(newLC.goods_receipt_id)}
                  disabled={!newLC.goods_receipt_id}
                >
                  {t('load_gr_data')}
                </Button>
              </div>
              <div>
                <Label>{t('cost_date')}</Label>
                <Input
                  type="date"
                  value={newLC.cost_date}
                  onChange={(e) => setNewLC({ ...newLC, cost_date: e.target.value })}
                />
              </div>
            </div>

            {/* GR Summary */}
            {grData && (
              <Card className="bg-blue-50">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('gr_number')}:</span>
                      <div className="font-medium">{grData.goods_receipt?.gr_number}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('po_number')}:</span>
                      <div className="font-medium">{grData.goods_receipt?.po_number || '-'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('supplier')}:</span>
                      <div className="font-medium">{grData.goods_receipt?.supplier_name || '-'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('product_value')}:</span>
                      <div className="font-bold text-lg">{formatCurrency(grData.goods_receipt?.product_value)}</div>
                    </div>
                  </div>

                  {/* Product lines from GR */}
                  {grData.lines?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">{t('products_count')} ({grData.lines.length})</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('product')}</TableHead>
                            <TableHead className="text-right">{t('qty')}</TableHead>
                            <TableHead className="text-right">{t('unit_price')}</TableHead>
                            <TableHead className="text-right">{t('total')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grData.lines.map((line, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{line.product_name}</TableCell>
                              <TableCell className="text-right">{line.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(line.unit_price)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(line.total_value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Allocation Method */}
            <div>
              <Label>{t('allocation_method')}</Label>
              <Select
                value={newLC.allocation_method}
                onValueChange={(value) => setNewLC({ ...newLC, allocation_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allocationMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label} - {method.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cost Lines */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-base font-semibold">{t('additional_costs')}</Label>
                <Button variant="outline" size="sm" onClick={addCostLine}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add_cost')}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cost_type')}</TableHead>
                    <TableHead>{t('vendor')}</TableHead>
                    <TableHead>{t('reference')}</TableHead>
                    <TableHead className="text-right">{t('amount')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newLC.lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.cost_type_name}
                          onValueChange={(value) => updateCostLine(index, 'cost_type_name', value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('select_type')} />
                          </SelectTrigger>
                          <SelectContent>
                            {costTypes.map((type) => (
                              <SelectItem key={type.id} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="Other">{t('other')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder={t('vendor_name')}
                          value={line.vendor_name}
                          onChange={(e) => updateCostLine(index, 'vendor_name', e.target.value)}
                          className="w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder={t('invoice_number')}
                          value={line.reference}
                          onChange={(e) => updateCostLine(index, 'reference', e.target.value)}
                          className="w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.amount}
                          onChange={(e) => updateCostLine(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-[120px] text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCostLine(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {newLC.lines.length > 0 && (
                <div className="flex justify-end mt-4 gap-8 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('product_value')}:</span>
                    <span className="ml-2 font-medium">{formatCurrency(grData?.goods_receipt?.product_value || 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('landed_cost')}:</span>
                    <span className="ml-2 font-medium text-orange-600">+{formatCurrency(calculateTotalLandedCost())}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('total')}:</span>
                    <span className="ml-2 font-bold text-lg">
                      {formatCurrency((grData?.goods_receipt?.product_value || 0) + calculateTotalLandedCost())}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label>{t('notes')}</Label>
              <Textarea
                value={newLC.notes}
                onChange={(e) => setNewLC({ ...newLC, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreateModal(false); }}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!grData || newLC.lines.length === 0}
            >
              {t('create_landed_cost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {selectedLC?.landed_cost_number}
            </DialogTitle>
          </DialogHeader>

          {selectedLC && (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
                <TabsTrigger value="costs">{t('cost_lines')} ({selectedLC.lines?.length || 0})</TabsTrigger>
                <TabsTrigger value="allocations">{t('allocations')} ({selectedLC.allocations?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('product_value')}</div>
                      <div className="text-2xl font-bold">{formatCurrency(selectedLC.product_value)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('landed_costs')}</div>
                      <div className="text-2xl font-bold text-orange-600">+{formatCurrency(selectedLC.total_landed_cost)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('total_cost')}</div>
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(selectedLC.total_cost)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('cost_increase')}</div>
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                        {selectedLC.product_value > 0
                          ? ((selectedLC.total_landed_cost / selectedLC.product_value) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('status')}</span>
                      <Badge className={statusColors[selectedLC.status]}>{t(selectedLC.status)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('gr_number')}</span>
                      <span>{selectedLC.gr_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('po_number')}</span>
                      <span>{selectedLC.po_number || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('supplier')}</span>
                      <span>{selectedLC.supplier_name || '-'}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('cost_date')}</span>
                      <span>{formatDate(selectedLC.cost_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('allocation_method')}</span>
                      <span className="capitalize">{selectedLC.allocation_method?.replace('_', ' ')}</span>
                    </div>
                    {selectedLC.validated_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('validated_at')}</span>
                        <span>{format(new Date(selectedLC.validated_at), 'dd.MM.yyyy HH:mm')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {selectedLC.status === 'draft' && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={() => handleValidate(selectedLC.id)}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('validate_apply')}
                    </Button>
                    <Button variant="outline" onClick={() => handleCancel(selectedLC.id)}>
                      <XCircle className="w-4 h-4 mr-2" />
                      {t('cancel')}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="costs">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('cost_type')}</TableHead>
                      <TableHead>{t('vendor')}</TableHead>
                      <TableHead>{t('reference')}</TableHead>
                      <TableHead className="text-right">{t('amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedLC.lines || []).map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.line_number}</TableCell>
                        <TableCell className="font-medium">{line.cost_type_name}</TableCell>
                        <TableCell>{line.vendor_name || '-'}</TableCell>
                        <TableCell>{line.reference || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(line.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="allocations">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-right">{t('qty')}</TableHead>
                      <TableHead className="text-right">{t('original_unit_cost')}</TableHead>
                      <TableHead className="text-right">{t('allocated')}</TableHead>
                      <TableHead className="text-right">{t('new_unit_cost')}</TableHead>
                      <TableHead className="text-right">{t('change')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedLC.allocations || []).map((alloc, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{alloc.product_name}</TableCell>
                        <TableCell className="text-right">{alloc.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(alloc.original_unit_cost)}</TableCell>
                        <TableCell className="text-right text-orange-600">+{formatCurrency(alloc.allocated_amount)}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">{formatCurrency(alloc.new_unit_cost)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-orange-600">
                            +{alloc.original_unit_cost > 0
                              ? (((alloc.new_unit_cost - alloc.original_unit_cost) / alloc.original_unit_cost) * 100).toFixed(1)
                              : 0}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
