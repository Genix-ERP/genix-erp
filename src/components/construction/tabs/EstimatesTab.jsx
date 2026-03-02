import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  MoreHorizontal,
  FileSpreadsheet,
  Edit,
  Archive,
  Layers,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

const EstimatesTab = ({ project, wbsItems = [] }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [estimates, setEstimates] = useState([]);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linesLoading, setLinesLoading] = useState(false);

  // Modals
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);

  // Forms
  const [estimateForm, setEstimateForm] = useState({
    name: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12'
  });
  const [lineForm, setLineForm] = useState({
    id: null, wbs_id: '', name: '', uom: '', quantity: '',
    material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0'
  });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'default' });

  // Load estimates
  const loadEstimates = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await constructionService.listEstimates(project.id);
      setEstimates(data || []);
      // Auto-select current estimate
      const current = (data || []).find(e => e.is_current);
      if (current && !selectedEstimate) {
        setSelectedEstimate(current);
      }
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  // Load lines when estimate is selected
  useEffect(() => {
    if (!selectedEstimate?.id) {
      setLines([]);
      return;
    }
    const loadLines = async () => {
      setLinesLoading(true);
      try {
        const data = await constructionService.getEstimate(selectedEstimate.id);
        setLines(data?.lines || []);
      } catch (error) {
        console.error('Error loading estimate lines:', error);
        setLines([]);
      } finally {
        setLinesLoading(false);
      }
    };
    loadLines();
  }, [selectedEstimate?.id]);

  // Create estimate
  const handleCreateEstimate = async (e) => {
    e.preventDefault();
    try {
      await constructionService.createEstimate(project.id, {
        name: estimateForm.name,
        overhead_pct: parseFloat(estimateForm.overhead_pct) || 0,
        profit_pct: parseFloat(estimateForm.profit_pct) || 0,
        vat_pct: parseFloat(estimateForm.vat_pct) || 0,
      });
      setShowEstimateModal(false);
      setEstimateForm({ name: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12' });
      await loadEstimates();
    } catch (error) {
      console.error('Error creating estimate:', error);
    }
  };

  // Approve estimate
  const handleApprove = (est) => {
    setConfirmDialog({
      open: true,
      title: t('approve') || 'Tasdiqlash',
      description: t('confirm_approve_estimate') || "Smetani tasdiqlaysizmi? Oldingi smeta arxivlanadi.",
      variant: 'default',
      onConfirm: async () => {
        try {
          await constructionService.approveEstimate(est.id);
          await loadEstimates();
          setSelectedEstimate(prev => prev?.id === est.id ? { ...prev, state: 'approved', is_current: true } : prev);
        } catch (error) {
          console.error('Error approving estimate:', error);
        }
      },
    });
  };

  // Duplicate estimate
  const handleDuplicate = async (est) => {
    try {
      await constructionService.duplicateEstimate(est.id);
      await loadEstimates();
    } catch (error) {
      console.error('Error duplicating estimate:', error);
    }
  };

  // Delete estimate
  const handleDeleteEstimate = (est) => {
    if (est.state !== 'draft') return;
    setConfirmDialog({
      open: true,
      title: t('delete') || "O'chirish",
      description: t('confirm_delete') || "O'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.",
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await constructionService.deleteEstimate(est.id);
          if (selectedEstimate?.id === est.id) {
            setSelectedEstimate(null);
            setLines([]);
          }
          await loadEstimates();
        } catch (error) {
          console.error('Error deleting estimate:', error);
        }
      },
    });
  };

  // Create/update line
  const handleSaveLine = async (e) => {
    e.preventDefault();
    if (!selectedEstimate?.id) return;
    try {
      const data = {
        wbs_id: lineForm.wbs_id ? parseInt(lineForm.wbs_id) : 0,
        name: lineForm.name,
        uom: lineForm.uom || 'шт',
        quantity: parseFloat(lineForm.quantity) || 0,
        material_rate: parsePriceInput(lineForm.material_rate),
        labor_rate: parsePriceInput(lineForm.labor_rate),
        equipment_rate: parsePriceInput(lineForm.equipment_rate),
        sort_order: parseInt(lineForm.sort_order) || 0,
      };

      if (lineForm.id) {
        await constructionService.updateEstimateLine(selectedEstimate.id, lineForm.id, data);
      } else {
        await constructionService.createEstimateLine(selectedEstimate.id, data);
      }

      // Reload lines and estimates (totals changed)
      const estData = await constructionService.getEstimate(selectedEstimate.id);
      setLines(estData?.lines || []);
      await loadEstimates();
      setShowLineModal(false);
      setLineForm({ id: null, wbs_id: '', name: '', uom: '', quantity: '', material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0' });
    } catch (error) {
      console.error('Error saving line:', error);
    }
  };

  // Delete line
  const handleDeleteLine = (lineId) => {
    setConfirmDialog({
      open: true,
      title: t('delete') || "O'chirish",
      description: t('confirm_delete') || "O'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.",
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await constructionService.deleteEstimateLine(selectedEstimate.id, lineId);
          const estData = await constructionService.getEstimate(selectedEstimate.id);
          setLines(estData?.lines || []);
          await loadEstimates();
        } catch (error) {
          console.error('Error deleting line:', error);
        }
      },
    });
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'archived': return 'bg-slate-100 text-slate-600';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStateLabel = (state) => {
    switch (state) {
      case 'approved': return t('approved') || 'Tasdiqlangan';
      case 'archived': return t('archived') || 'Arxivlangan';
      default: return t('draft') || 'Qoralama';
    }
  };

  // Flatten WBS items for dropdown
  const flatWBS = [];
  const flattenWBS = (items, level = 0) => {
    (items || []).forEach(item => {
      flatWBS.push({ ...item, level });
      if (item.children) flattenWBS(item.children, level + 1);
    });
  };
  flattenWBS(wbsItems);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Estimates List */}
      <Card className="lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('estimates') || 'Smetalar'}</CardTitle>
          <Button size="sm" onClick={() => setShowEstimateModal(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="p-4 text-center text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
            ) : estimates.length === 0 ? (
              <div className="p-8 text-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">{t('no_estimates') || "Smetalar yo'q"}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowEstimateModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('create_estimate') || "Smeta yaratish"}
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {estimates.map((est) => (
                  <div
                    key={est.id}
                    className={`p-4 cursor-pointer hover:bg-slate-50 group ${selectedEstimate?.id === est.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                    onClick={() => setSelectedEstimate(est)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">v{est.version}</Badge>
                          {est.is_current && <Badge className="bg-blue-500 text-white text-xs">Joriy</Badge>}
                        </div>
                        <p className="font-medium text-sm mt-1 truncate">{est.name}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0">
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {est.state === 'draft' && (
                            <DropdownMenuItem onClick={() => handleApprove(est)}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                              {t('approve') || 'Tasdiqlash'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicate(est)}>
                            <Copy className="w-4 h-4 mr-2" />
                            {t('duplicate') || 'Nusxalash'}
                          </DropdownMenuItem>
                          {est.state === 'draft' && (
                            <DropdownMenuItem onClick={() => handleDeleteEstimate(est)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('delete') || "O'chirish"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-medium text-slate-700">{formatCurrency(est.amount_total || 0)}</p>
                      <Badge className={`text-xs ${getStateColor(est.state)}`}>
                        {getStateLabel(est.state)}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {est.lines_count || 0} {t('lines') || 'qator'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Lines Table */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {selectedEstimate
              ? `${selectedEstimate.name} (v${selectedEstimate.version})`
              : (t('select_estimate') || "Smetani tanlang")}
          </CardTitle>
          {selectedEstimate && selectedEstimate.state === 'draft' && (
            <Button size="sm" onClick={() => {
              setLineForm({ id: null, wbs_id: '', name: '', uom: '', quantity: '', material_rate: '', labor_rate: '', equipment_rate: '', sort_order: String(lines.length) });
              setShowLineModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              {t('add_line') || "Qator qo'shish"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!selectedEstimate ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('select_estimate_first') || "Avval smetani tanlang"}</p>
            </div>
          ) : linesLoading ? (
            <div className="text-center py-12 text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
          ) : lines.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_lines') || "Qatorlar yo'q"}</p>
              {selectedEstimate.state === 'draft' && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => {
                  setLineForm({ id: null, wbs_id: '', name: '', uom: '', quantity: '', material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0' });
                  setShowLineModal(true);
                }}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add_line') || "Qator qo'shish"}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">WBS</th>
                      <th className="text-left py-3 px-2">{t('name') || 'Nomi'}</th>
                      <th className="text-right py-3 px-2">{t('unit') || "O'lchov"}</th>
                      <th className="text-right py-3 px-2">{t('quantity') || 'Miqdor'}</th>
                      <th className="text-right py-3 px-2">{t('material') || 'Material'}</th>
                      <th className="text-right py-3 px-2">{t('labor') || 'Ish haqi'}</th>
                      <th className="text-right py-3 px-2">{t('equipment') || 'Jihozlar'}</th>
                      <th className="text-right py-3 px-2">{t('unit_rate') || 'Birlik'}</th>
                      <th className="text-right py-3 px-2">{t('total') || 'Jami'}</th>
                      {selectedEstimate.state === 'draft' && <th className="text-center py-3 px-2 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b hover:bg-slate-50 group">
                        <td className="py-3 px-2 font-mono text-xs text-slate-500">{line.wbs_code || '-'}</td>
                        <td className="py-3 px-2">{line.name}</td>
                        <td className="py-3 px-2 text-right text-slate-600">{line.uom}</td>
                        <td className="py-3 px-2 text-right">{line.quantity}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(line.material_rate)}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(line.labor_rate)}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(line.equipment_rate)}</td>
                        <td className="py-3 px-2 text-right font-medium">{formatCurrency(line.unit_rate)}</td>
                        <td className="py-3 px-2 text-right font-medium">{formatCurrency(line.total_amount)}</td>
                        {selectedEstimate.state === 'draft' && (
                          <td className="py-3 px-2 text-center">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setLineForm({
                                    id: line.id,
                                    wbs_id: line.wbs_id ? String(line.wbs_id) : '',
                                    name: line.name,
                                    uom: line.uom,
                                    quantity: String(line.quantity),
                                    material_rate: formatPriceInput(String(line.material_rate)),
                                    labor_rate: formatPriceInput(String(line.labor_rate)),
                                    equipment_rate: formatPriceInput(String(line.equipment_rate)),
                                    sort_order: String(line.sort_order),
                                  });
                                  setShowLineModal(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteLine(line.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-slate-50">
                      <td colSpan={8} className="py-3 px-2 text-right">{t('direct_cost') || "To'g'ridan-to'g'ri xarajat"}:</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(selectedEstimate.amount_direct || 0)}</td>
                      {selectedEstimate.state === 'draft' && <td></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Summary Footer */}
              <div className="mt-4 border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('direct_cost') || "To'g'ridan-to'g'ri xarajat"}</span>
                  <span className="font-medium">{formatCurrency(selectedEstimate.amount_direct || 0)}</span>
                </div>
                {selectedEstimate.overhead_pct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('overhead') || 'Qo\'shimcha xarajatlar'} ({selectedEstimate.overhead_pct}%)</span>
                    <span>{formatCurrency((selectedEstimate.amount_direct || 0) * (selectedEstimate.overhead_pct / 100))}</span>
                  </div>
                )}
                {selectedEstimate.profit_pct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('profit') || 'Foyda'} ({selectedEstimate.profit_pct}%)</span>
                    <span>{formatCurrency((selectedEstimate.amount_direct || 0) * (1 + selectedEstimate.overhead_pct / 100) * (selectedEstimate.profit_pct / 100))}</span>
                  </div>
                )}
                {selectedEstimate.vat_pct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">QQS ({selectedEstimate.vat_pct}%)</span>
                    <span>{formatCurrency(
                      (selectedEstimate.amount_direct || 0) * (1 + selectedEstimate.overhead_pct / 100) * (1 + selectedEstimate.profit_pct / 100) * (selectedEstimate.vat_pct / 100)
                    )}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{t('total') || 'Jami'}</span>
                  <span>{formatCurrency(selectedEstimate.amount_total || 0)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Estimate Modal */}
      <Dialog open={showEstimateModal} onOpenChange={setShowEstimateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create_estimate') || "Yangi smeta yaratish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEstimate}>
            <div className="space-y-4">
              <div>
                <Label>{t('name') || 'Nomi'} *</Label>
                <Input
                  value={estimateForm.name}
                  onChange={(e) => setEstimateForm({ ...estimateForm, name: e.target.value })}
                  placeholder={t('estimate_name_placeholder') || "Asosiy smeta"}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <Label className="text-xs">{t('overhead') || "Qo'shimcha"}, %</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={estimateForm.overhead_pct}
                    onChange={(e) => setEstimateForm({ ...estimateForm, overhead_pct: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('profit') || 'Foyda'}, %</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={estimateForm.profit_pct}
                    onChange={(e) => setEstimateForm({ ...estimateForm, profit_pct: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">QQS, %</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={estimateForm.vat_pct}
                    onChange={(e) => setEstimateForm({ ...estimateForm, vat_pct: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowEstimateModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{t('create') || 'Yaratish'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Line Modal */}
      <Dialog open={showLineModal} onOpenChange={setShowLineModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lineForm.id ? (t('edit_line') || "Qatorni tahrirlash") : (t('add_line') || "Qator qo'shish")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLine}>
            <div className="space-y-4">
              <div>
                <Label>WBS</Label>
                <Select value={lineForm.wbs_id || "none"} onValueChange={(val) => setLineForm({ ...lineForm, wbs_id: val === "none" ? "" : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_wbs') || "WBS tanlang (ixtiyoriy)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {flatWBS.map(wbs => (
                      <SelectItem key={wbs.id} value={String(wbs.id)}>
                        {'  '.repeat(wbs.level)}{wbs.code} - {wbs.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('name') || 'Nomi'} *</Label>
                <Input
                  value={lineForm.name}
                  onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('unit') || "O'lchov birligi"}</Label>
                  <Input
                    value={lineForm.uom}
                    onChange={(e) => setLineForm({ ...lineForm, uom: e.target.value })}
                    placeholder="шт"
                  />
                </div>
                <div>
                  <Label>{t('quantity') || 'Miqdor'}</Label>
                  <Input
                    type="number" step="0.0001" min="0"
                    value={lineForm.quantity}
                    onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t('material_rate') || 'Material'}</Label>
                  <Input
                    value={lineForm.material_rate}
                    onChange={(e) => setLineForm({ ...lineForm, material_rate: formatPriceInput(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>{t('labor_rate') || 'Ish haqi'}</Label>
                  <Input
                    value={lineForm.labor_rate}
                    onChange={(e) => setLineForm({ ...lineForm, labor_rate: formatPriceInput(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>{t('equipment_rate') || 'Jihozlar'}</Label>
                  <Input
                    value={lineForm.equipment_rate}
                    onChange={(e) => setLineForm({ ...lineForm, equipment_rate: formatPriceInput(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowLineModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{lineForm.id ? (t('save') || 'Saqlash') : (t('add') || "Qo'shish")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
              onClick={() => {
                confirmDialog.onConfirm?.();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {confirmDialog.variant === 'destructive' ? (t('delete') || "O'chirish") : (t('confirm') || 'Tasdiqlash')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EstimatesTab;
