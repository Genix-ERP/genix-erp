import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, PackagePlus, Truck, ArrowRightLeft, Trash2, ChevronRight,
  ChevronLeft, CheckCircle2, Clock, XCircle, Search, RefreshCw,
  ArrowLeft, Eye, Play, AlertTriangle, FileText, Loader2,
  ClipboardList, Package
} from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { inventoryService, contactsService } from '@/api/services';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIRECTIONS = [
  { value: 'receipt',   icon: PackagePlus,    color: 'green',  labelKey: 'receipt_operations' },
  { value: 'delivery',  icon: Truck,          color: 'blue',   labelKey: 'delivery_operations' },
  { value: 'internal',  icon: ArrowRightLeft, color: 'purple', labelKey: 'internal_transfers' },
  { value: 'write_off', icon: Trash2,         color: 'red',    labelKey: 'write_offs' },
];

const WRITE_OFF_REASONS = [
  'damage', 'expired', 'lost', 'sample', 'donation', 'inventory_diff', 'other'
];

const STATE_CONFIG = {
  draft:       { label: 'Draft',       color: 'bg-slate-100 text-slate-600',   icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',     icon: Play },
  waiting:     { label: 'Waiting',     color: 'bg-amber-100 text-amber-700',   icon: Clock },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-600',       icon: XCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const StateBadge = ({ state, t }) => {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.draft;
  const Icon = cfg.icon;
  const label = t ? (t(state) || cfg.label) : cfg.label;
  return (
    <Badge className={`${cfg.color} gap-1 text-xs`}>
      <Icon className="w-3 h-3" />{label}
    </Badge>
  );
};

const DirectionIcon = ({ direction, className = "w-4 h-4" }) => {
  const d = DIRECTIONS.find(x => x.value === direction);
  if (!d) return null;
  const Icon = d.icon;
  return <Icon className={className} />;
};

const DirectionBadge = ({ direction, t }) => {
  const d = DIRECTIONS.find(x => x.value === direction);
  if (!d) return <Badge>{direction}</Badge>;
  const Icon = d.icon;
  const colorMap = { green: 'bg-green-100 text-green-700', blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700', red: 'bg-red-100 text-red-600' };
  return (
    <Badge className={`${colorMap[d.color]} gap-1 text-xs`}>
      <Icon className="w-3 h-3" />{t(d.labelKey) || direction}
    </Badge>
  );
};

const StepProgress = ({ current, total }) => {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-colors ${
            i + 1 < current ? 'bg-green-500' :
            i + 1 === current ? 'bg-blue-500' :
            'bg-slate-200'
          }`}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">{current}/{total}</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StockOperations() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, MODULES: MOD } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [view, setView] = useState('list'); // 'list' | 'detail' | 'create'
  const [activeDirection, setActiveDirection] = useState('receipt');
  const [operations, setOperations] = useState([]);
  const [summary, setSummary] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOp, setSelectedOp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    operation_type_id: '',
    direction: 'receipt',
    partner_id: '',
    source_document: '',
    priority: 'normal',
    note: '',
    write_off_reason: '',
    lines: [],
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ops, sum, opTypes, prods, cnts] = await Promise.all([
        inventoryService.listStockOperations({ direction: activeDirection }),
        inventoryService.getStockOperationSummary().catch(() => []),
        inventoryService.listOperationTypes({ include_inactive: false }),
        inventoryService.listProducts ? inventoryService.listProducts().catch(() => []) : Promise.resolve([]),
        contactsService.list().catch(() => []),
      ]);
      setOperations(ops || []);
      setSummary(sum || []);
      setOperationTypes((opTypes || []).filter(ot => {
        const dir = ot.operation_type;
        if (activeDirection === 'receipt') return dir === 'incoming';
        if (activeDirection === 'delivery') return dir === 'outgoing';
        if (activeDirection === 'internal') return dir === 'internal';
        return true;
      }));
      setProducts(prods || []);
      setPartners(cnts || []);
    } catch (e) {
      console.error('Failed to load stock operations', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeDirection]);

  useEffect(() => { loadData(); }, [loadData]);

  // Summary counts per direction
  const getCount = (direction, state) => {
    return summary
      .filter(s => s.direction === direction && (state === 'all' || s.state === state))
      .reduce((a, s) => a + s.count, 0);
  };

  const filteredOps = operations.filter(op => {
    if (stateFilter !== 'all' && op.state !== stateFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return op.name?.toLowerCase().includes(q) ||
             op.partner_name?.toLowerCase().includes(q) ||
             op.source_document?.toLowerCase().includes(q);
    }
    return true;
  });

  const openDetail = async (op) => {
    try {
      const full = await inventoryService.getStockOperation(op.id);
      setSelectedOp(full);
      setView('detail');
    } catch {
      setSelectedOp(op);
      setView('detail');
    }
  };

  const handleValidate = async () => {
    if (!selectedOp) return;
    setIsActionLoading(true);
    try {
      const result = await inventoryService.validateStockOperation(selectedOp.id);
      setSelectedOp(prev => ({ ...prev, state: result.state }));
      loadData();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (!selectedOp) return;
    setIsActionLoading(true);
    try {
      const result = await inventoryService.advanceStockOperationStep(selectedOp.id);
      setSelectedOp(prev => ({
        ...prev,
        state: result.state,
        current_step: result.current_step,
      }));
      loadData();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedOp) return;
    setIsActionLoading(true);
    try {
      await inventoryService.cancelStockOperation(selectedOp.id);
      setSelectedOp(prev => ({ ...prev, state: 'cancelled' }));
      loadData();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.operation_type_id || !form.direction) return;
    setIsActionLoading(true);
    try {
      const result = await inventoryService.createStockOperation(form);
      setShowCreateDialog(false);
      resetForm();
      loadData();
      // Open the newly created operation
      const full = await inventoryService.getStockOperation(result.id);
      setSelectedOp(full);
      setView('detail');
    } catch (e) {
      console.error('Failed to create operation', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      operation_type_id: '',
      direction: activeDirection,
      partner_id: '',
      source_document: '',
      priority: 'normal',
      note: '',
      write_off_reason: '',
      lines: [{ product_id: '', expected_qty: 1, done_qty: 0, uom: 'unit', quality_status: 'good' }],
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const addLine = () => {
    setForm(prev => ({
      ...prev,
      lines: [...prev.lines, { product_id: '', expected_qty: 1, done_qty: 0, uom: 'unit', quality_status: 'good' }],
    }));
  };

  const removeLine = (idx) => {
    setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }));
  };

  const updateLine = (idx, field, value) => {
    setForm(prev => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...prev, lines };
    });
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-5">
        {/* Direction tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DIRECTIONS.map(({ value, icon: Icon, color, labelKey }) => {
            const colorMap = {
              green: 'border-green-300 bg-green-50 text-green-800',
              blue: 'border-blue-300 bg-blue-50 text-blue-800',
              purple: 'border-purple-300 bg-purple-50 text-purple-800',
              red: 'border-red-300 bg-red-50 text-red-800',
            };
            const active = activeDirection === value;
            return (
              <button
                key={value}
                onClick={() => setActiveDirection(value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  active ? colorMap[color] + ' shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold text-sm">{t(labelKey) || value}</span>
                </div>
                <div className="text-2xl font-bold">{getCount(value, 'all')}</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-green-600 font-medium">{getCount(value, 'done')} {t('done') || 'done'}</span>
                  <span className="text-xs text-blue-600 font-medium">{getCount(value, 'in_progress')} {t('in_progress') || 'in progress'}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search') || 'Search...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 w-56"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t('all_states') || 'All states'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_states') || 'All states'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                <SelectItem value="in_progress">{t('in_progress') || 'In Progress'}</SelectItem>
                <SelectItem value="waiting">{t('waiting') || 'Waiting'}</SelectItem>
                <SelectItem value="done">{t('done') || 'Done'}</SelectItem>
                <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {canCreate(MOD.INVENTORY) && (
            <Button onClick={openCreateDialog} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
              <Plus className="w-4 h-4 mr-2" />{t('new_operation') || 'New Operation'}
            </Button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : filteredOps.length === 0 ? (
              <div className="text-center py-14">
                <ClipboardList className="w-14 h-14 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">{t('no_operations') || 'No operations found'}</p>
                <p className="text-slate-400 text-sm mt-1">{t('create_first_operation') || 'Create your first stock operation'}</p>
                {canCreate(MOD.INVENTORY) && (
                  <Button className="mt-4" onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" />{t('new_operation') || 'New Operation'}
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('document') || 'Document'}</TableHead>
                    <TableHead>{t('type') || 'Type'}</TableHead>
                    <TableHead>{t('partner') || 'Partner'}</TableHead>
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead>{t('steps') || 'Steps'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOps.map(op => (
                    <TableRow key={op.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetail(op)}>
                      <TableCell className="font-mono font-semibold text-sm">{op.name}</TableCell>
                      <TableCell><DirectionBadge direction={op.direction} t={t} /></TableCell>
                      <TableCell className="text-sm text-slate-600">{op.partner_name || '—'}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {op.date ? format(new Date(op.date), 'dd.MM.yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        <StepProgress current={op.current_step} total={op.total_steps} />
                      </TableCell>
                      <TableCell><StateBadge state={op.state} t={t} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openDetail(op); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('new_stock_operation') || 'New Stock Operation'}</DialogTitle>
              <DialogDescription>{t('new_stock_operation_desc') || 'Create a receipt, delivery, internal transfer, or write-off'}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Direction */}
              <div className="grid grid-cols-2 gap-3">
                {DIRECTIONS.map(({ value, icon: Icon, labelKey }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, direction: value }))}
                    className={`p-3 rounded-lg border-2 text-left transition-all flex items-center gap-2 ${
                      form.direction === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{t(labelKey) || value}</span>
                  </button>
                ))}
              </div>

              {/* Operation Type */}
              <div>
                <Label>{t('operation_type') || 'Operation Type'} *</Label>
                <Select value={form.operation_type_id} onValueChange={v => setForm(f => ({ ...f, operation_type_id: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('select_operation_type') || 'Select operation type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {operationTypes.map(ot => (
                      <SelectItem key={ot.id} value={ot.id}>{ot.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Partner & Source Doc */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{form.direction === 'receipt' ? (t('vendor') || 'Vendor') : (t('customer') || 'Customer')}</Label>
                  <Select value={form.partner_id} onValueChange={v => setForm(f => ({ ...f, partner_id: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t('select_partner') || 'Select partner'} />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('source_document') || 'Source Document'}</Label>
                  <Input
                    className="mt-1"
                    placeholder="PO-2026-001"
                    value={form.source_document}
                    onChange={e => setForm(f => ({ ...f, source_document: e.target.value }))}
                  />
                </div>
              </div>

              {/* Write-off reason */}
              {form.direction === 'write_off' && (
                <div>
                  <Label>{t('write_off_reason') || 'Write-off Reason'} *</Label>
                  <Select value={form.write_off_reason} onValueChange={v => setForm(f => ({ ...f, write_off_reason: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t('select_reason') || 'Select reason'} />
                    </SelectTrigger>
                    <SelectContent>
                      {WRITE_OFF_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{t(`writeoff_${r}`) || r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Product lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t('product_lines') || 'Product Lines'}</Label>
                  <Button variant="outline" size="sm" onClick={addLine}>
                    <Plus className="w-3 h-3 mr-1" />{t('add_line') || 'Add Line'}
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-lg">
                      <div className="col-span-5">
                        <Select value={line.product_id} onValueChange={v => updateLine(idx, 'product_id', v)}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder={t('product') || 'Product'} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.expected_qty}
                          onChange={e => updateLine(idx, 'expected_qty', parseFloat(e.target.value) || 0)}
                          placeholder={t('qty') || 'Qty'}
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={line.lot_number || ''}
                          onChange={e => updateLine(idx, 'lot_number', e.target.value)}
                          placeholder={t('lot') || 'Lot'}
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Select value={line.quality_status} onValueChange={v => updateLine(idx, 'quality_status', v)}>
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">{t('good') || 'Good'}</SelectItem>
                            <SelectItem value="defective">{t('defective') || 'Defective'}</SelectItem>
                            <SelectItem value="rejected">{t('rejected') || 'Rejected'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}>
                          <XCircle className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <Label>{t('note') || 'Note'}</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder={t('operation_note_placeholder') || 'Additional notes...'}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('cancel') || 'Cancel'}</Button>
              <Button
                onClick={handleCreate}
                disabled={isActionLoading || !form.operation_type_id}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {t('create') || 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────

  if (view === 'detail' && selectedOp) {
    const op = selectedOp;
    const canAct = canUpdate(MOD.INVENTORY) && op.state !== 'done' && op.state !== 'cancelled';
    const isLastStep = op.current_step >= op.total_steps;

    return (
      <div className="space-y-5">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setView('list')}>
            <ArrowLeft className="w-4 h-4 mr-1" />{t('back') || 'Back'}
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono">{op.name}</h2>
              <StateBadge state={op.state} t={t} />
              <DirectionBadge direction={op.direction} t={t} />
            </div>
            {op.partner_name && <p className="text-sm text-slate-500">{op.partner_name}</p>}
          </div>
          <div className="flex items-center gap-2">
            {canAct && op.state === 'draft' && (
              <Button onClick={handleValidate} disabled={isActionLoading} variant="outline">
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {t('validate') || 'Validate'}
              </Button>
            )}
            {canAct && op.state === 'in_progress' && (
              <Button
                onClick={handleAdvance}
                disabled={isActionLoading}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> :
                  isLastStep ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />
                }
                {isLastStep ? (t('complete') || 'Complete') : (t('next_step') || 'Next Step')}
              </Button>
            )}
            {canAct && (
              <Button variant="outline" onClick={handleCancel} disabled={isActionLoading} className="text-red-600 border-red-300 hover:bg-red-50">
                <XCircle className="w-4 h-4 mr-1" />{t('cancel') || 'Cancel'}
              </Button>
            )}
          </div>
        </div>

        {/* Step progress bar */}
        {op.total_steps > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-slate-700">{t('progress') || 'Progress'}</span>
                <span className="text-xs text-slate-500">{op.current_step}/{op.total_steps} {t('steps') || 'steps'}</span>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: op.total_steps }, (_, i) => {
                  const stepNum = i + 1;
                  const log = op.step_logs?.find(sl => sl.step_sequence === stepNum);
                  const stepState = log?.state || (stepNum < op.current_step ? 'completed' : stepNum === op.current_step ? 'in_progress' : 'pending');
                  return (
                    <div key={i} className="flex-1 text-center">
                      <div className={`h-3 rounded-full mb-1 ${
                        stepState === 'completed' ? 'bg-green-500' :
                        stepState === 'in_progress' ? 'bg-blue-500' :
                        'bg-slate-200'
                      }`} />
                      <p className="text-[10px] text-slate-500 truncate">{log?.step_name || `Step ${stepNum}`}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Info card */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t('details') || 'Details'}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                [t('document') || 'Document', op.name],
                [t('direction') || 'Direction', (() => {
                  const d = DIRECTIONS.find(x => x.value === op.direction);
                  return d ? (t(d.labelKey) || op.direction) : op.direction;
                })()],
                [t('date') || 'Date', op.date ? format(new Date(op.date), 'dd.MM.yyyy HH:mm') : '—'],
                [t('partner') || 'Partner', op.partner_name || '—'],
                [t('source_document') || 'Source', op.source_document || '—'],
                [t('priority') || 'Priority', t(`priority_${op.priority}`) || op.priority || 'normal'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-right">{val}</span>
                </div>
              ))}
              {op.write_off_reason && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('write_off_reason') || 'Reason'}</span>
                  <Badge className="bg-red-100 text-red-700">{t(`writeoff_${op.write_off_reason}`) || op.write_off_reason}</Badge>
                </div>
              )}
              {op.note && (
                <div className="pt-2 border-t">
                  <p className="text-slate-500 text-xs mb-1">{t('note') || 'Note'}</p>
                  <p className="text-slate-700">{op.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lines */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t('product_lines') || 'Product Lines'}
                  <Badge variant="outline">{op.lines?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!op.lines || op.lines.length === 0 ? (
                  <p className="text-sm text-slate-400 px-4 py-6 text-center">{t('no_lines') || 'No product lines'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('product') || 'Product'}</TableHead>
                        <TableHead className="text-right">{t('expected') || 'Expected'}</TableHead>
                        <TableHead className="text-right">{t('done') || 'Done'}</TableHead>
                        <TableHead>{t('lot') || 'Lot'}</TableHead>
                        <TableHead>{t('quality') || 'Quality'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {op.lines.map(line => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{line.product_name}</p>
                            {line.product_code && <p className="text-xs text-slate-400">{line.product_code}</p>}
                          </TableCell>
                          <TableCell className="text-right">{line.expected_qty} {line.uom}</TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={line.done_qty < line.expected_qty && line.expected_qty > 0 ? 'text-amber-600' : 'text-green-600'}>
                              {line.done_qty} {line.uom}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{line.lot_number || '—'}</TableCell>
                          <TableCell>
                            {line.quality_status === 'good' && <Badge className="bg-green-100 text-green-700 text-xs">{t('good') || 'Good'}</Badge>}
                            {line.quality_status === 'defective' && <Badge className="bg-amber-100 text-amber-700 text-xs">{t('defective') || 'Defective'}</Badge>}
                            {line.quality_status === 'rejected' && <Badge className="bg-red-100 text-red-700 text-xs">{t('rejected') || 'Rejected'}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Step log timeline */}
        {op.step_logs && op.step_logs.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />{t('step_history') || 'Step History'}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {op.step_logs.map((log, i) => (
                  <div key={log.id || i} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      log.state === 'completed' ? 'bg-green-100' :
                      log.state === 'in_progress' ? 'bg-blue-100' :
                      'bg-slate-100'
                    }`}>
                      {log.state === 'completed' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                       log.state === 'in_progress' ? <Play className="w-4 h-4 text-blue-600" /> :
                       <Clock className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{log.step_name || `Step ${log.step_sequence}`}</span>
                        <StateBadge state={log.state} t={t} />
                      </div>
                      {log.started_at && (
                        <p className="text-xs text-slate-400">
                          {t('started') || 'Started'}: {format(new Date(log.started_at), 'dd.MM.yyyy HH:mm')}
                          {log.completed_at && ` → ${format(new Date(log.completed_at), 'dd.MM.yyyy HH:mm')}`}
                        </p>
                      )}
                      {log.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1"><AlertTriangle className="w-3 h-3 inline mr-1" />{log.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
}
