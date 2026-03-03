import React, { useState, useEffect, useMemo } from 'react';
import { bomsService } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  GitBranch,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const EMPTY_OP_FORM = {
  name: '',
  work_center_id: '',
  notes: '',
  run_time_minutes: 30,
  setup_time_minutes: 0,
};

export default function RoutingManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { workCenters } = useManufacturing();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddOpModal, setShowAddOpModal] = useState(false);
  const [showEditOpModal, setShowEditOpModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBom, setSelectedBom] = useState(null);
  const [selectedOp, setSelectedOp] = useState(null);
  const [opForm, setOpForm] = useState(EMPTY_OP_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reloadData = async () => {
    setLoading(true);
    try {
      const bomList = await bomsService.list();
      // Load operations for each BOM in parallel
      const bomsWithOps = await Promise.all(
        bomList.map(async (bom) => {
          const ops = await bomsService.listOperations(bom.id).catch(() => []);
          return { ...bom, operations: ops };
        })
      );
      setBoms(bomsWithOps);
    } catch (error) {
      console.error('Failed to load BOM operations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadData(); }, []);

  // Filter BOMs — only show those with operations, matching search
  const filteredBoms = useMemo(() => {
    return boms.filter(b => {
      const hasOps = b.operations && b.operations.length > 0;
      const matchesSearch = !searchQuery ||
        b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return hasOps && matchesSearch;
    });
  }, [boms, searchQuery]);

  const calculateTotals = (operations) => {
    const totalMinutes = (operations || []).reduce(
      (sum, op) => sum + (op.run_time_minutes || 0) + (op.setup_time_minutes || 0), 0
    );
    const totalCost = (operations || []).reduce(
      (sum, op) => sum + ((op.run_time_minutes + op.setup_time_minutes) / 60 * (op.work_center_hourly_cost || 0)), 0
    );
    return { totalMinutes, totalCost };
  };

  const handleAddOperation = async () => {
    if (!selectedBom) return;
    setIsSubmitting(true);
    try {
      const sequence = ((selectedBom.operations?.length || 0) + 1) * 10;
      await bomsService.createOperation(selectedBom.id, {
        operation_name: opForm.name,
        work_center_id: opForm.work_center_id || undefined,
        notes: opForm.notes || undefined,
        run_time_minutes: opForm.run_time_minutes,
        setup_time_minutes: opForm.setup_time_minutes,
        sequence,
      });
      await reloadData();
      setShowAddOpModal(false);
      setOpForm(EMPTY_OP_FORM);
    } catch (error) {
      console.error('Failed to add operation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOperation = async () => {
    if (!selectedBom || !selectedOp) return;
    setIsSubmitting(true);
    try {
      await bomsService.updateOperation(selectedBom.id, selectedOp.id, {
        operation_name: opForm.name,
        work_center_id: opForm.work_center_id || undefined,
        notes: opForm.notes || undefined,
        run_time_minutes: opForm.run_time_minutes,
        setup_time_minutes: opForm.setup_time_minutes,
      });
      await reloadData();
      setShowEditOpModal(false);
      setSelectedOp(null);
      setOpForm(EMPTY_OP_FORM);
    } catch (error) {
      console.error('Failed to update operation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOperation = async () => {
    if (!selectedBom || !selectedOp) return;
    try {
      await bomsService.deleteOperation(selectedBom.id, selectedOp.id);
      await reloadData();
    } catch (error) {
      console.error('Failed to delete operation:', error);
    } finally {
      setShowDeleteDialog(false);
      setSelectedOp(null);
      setSelectedBom(null);
    }
  };

  const openAddModal = (bom) => {
    setSelectedBom(bom);
    setOpForm(EMPTY_OP_FORM);
    setShowAddOpModal(true);
  };

  const openEditModal = (bom, op) => {
    setSelectedBom(bom);
    setSelectedOp(op);
    setOpForm({
      name: op.operation_name || op.name || '',
      work_center_id: op.work_center_id || '',
      notes: op.notes || '',
      run_time_minutes: op.run_time_minutes || 30,
      setup_time_minutes: op.setup_time_minutes || 0,
    });
    setShowEditOpModal(true);
  };

  const OperationForm = ({ form, onChange }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('operation_name') || "Operatsiya nomi"} *</Label>
          <Input
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder={t('enter_operation_name') || "Operatsiya nomini kiriting"}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('work_center') || "Ish markazi"}</Label>
          <Select
            value={form.work_center_id}
            onValueChange={value => onChange({ ...form, work_center_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('select_work_center') || "Tanlang"} />
            </SelectTrigger>
            <SelectContent>
              {workCenters.filter(wc => wc.id).map(wc => (
                <SelectItem key={wc.id} value={wc.id}>{wc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('run_time_minutes') || "Ishlash vaqti (daq)"}</Label>
          <Input
            type="number"
            value={form.run_time_minutes}
            onChange={e => onChange({ ...form, run_time_minutes: parseInt(e.target.value) || 0 })}
            placeholder="30"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('setup_time') || "Sozlash vaqti (daq)"}</Label>
          <Input
            type="number"
            value={form.setup_time_minutes}
            onChange={e => onChange({ ...form, setup_time_minutes: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('notes') || "Izoh"}</Label>
        <Textarea
          value={form.notes}
          onChange={e => onChange({ ...form, notes: e.target.value })}
          placeholder={t('enter_notes') || "Izoh kiriting..."}
          rows={2}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t('routing_management') || "Texnologik jarayon"}</h2>
          <p className="text-slate-600 mt-1">{t('routing_desc') || "Ishlab chiqarish operatsiyalarini boshqaring"}</p>
        </div>
      </div>

      {/* Search */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('search_routings') || "Mahsulot yoki BOM bo'yicha qidirish..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* BOM Operations List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredBoms.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  {boms.length === 0
                    ? (t('no_boms_found') || "BOM topilmadi")
                    : (t('no_routings_found') || "Operatsiyali BOM topilmadi")}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {t('routing_hint') || "Operatsiyalar BOM tahrirlash orqali qo'shiladi"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredBoms.map(bom => {
              const { totalMinutes, totalCost } = calculateTotals(bom.operations);
              const sortedOps = [...(bom.operations || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

              return (
                <Card key={bom.id} className="bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <GitBranch className="w-5 h-5 text-blue-600" />
                          <div>
                            <CardTitle className="text-lg">{bom.name}</CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                              {bom.product_name || bom.code} • {bom.operations.length} {t('operations') || "operatsiya"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">{t('total_time') || "Jami vaqt"}</p>
                          <p className="font-medium text-sm">{(totalMinutes / 60).toFixed(1)}{t('h') || 'h'}</p>
                        </div>
                        {canCreate(MODULES.MANUFACTURING) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAddModal(bom)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            {t('add_operation') || "Operatsiya"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedBom(bom); setShowViewModal(true); }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Operations Flow */}
                    <div className="flex flex-wrap items-center gap-2">
                      {sortedOps.map((op, index) => (
                        <React.Fragment key={op.id}>
                          <div className="group relative p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{op.sequence}</Badge>
                              <span className="font-medium text-sm">{op.operation_name || op.name}</span>
                              <div className="hidden group-hover:flex gap-1 ml-1">
                                {canUpdate(MODULES.MANUFACTURING) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    onClick={() => openEditModal(bom, op)}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                )}
                                {canDelete(MODULES.MANUFACTURING) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 text-red-500"
                                    onClick={() => { setSelectedBom(bom); setSelectedOp(op); setShowDeleteDialog(true); }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {op.run_time_minutes || 0}{t('min') || 'min'}
                              {(op.setup_time_minutes || 0) > 0 && ` (+${op.setup_time_minutes}${t('min') || 'min'})`}
                            </div>
                            {op.work_center_name && (
                              <div className="text-xs text-slate-400 mt-0.5">{op.work_center_name}</div>
                            )}
                          </div>
                          {index < sortedOps.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Show all BOMs without operations */}
      {!loading && boms.filter(b => !b.operations || b.operations.length === 0).length > 0 && !searchQuery && (
        <div>
          <p className="text-sm text-slate-500 mb-2">{t('boms_without_routing') || "Operatsiyasiz BOMs:"}</p>
          <div className="flex flex-wrap gap-2">
            {boms.filter(b => !b.operations || b.operations.length === 0).map(bom => (
              <div key={bom.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
                <span className="text-sm text-slate-600">{bom.product_name || bom.name}</span>
                {canCreate(MODULES.MANUFACTURING) && (
                  <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => openAddModal(bom)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Operation Modal */}
      <Dialog open={showAddOpModal} onOpenChange={setShowAddOpModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('add_operation') || "Operatsiya qo'shish"}
              {selectedBom && <span className="text-slate-500 font-normal ml-2">— {selectedBom.product_name || selectedBom.name}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <OperationForm form={opForm} onChange={setOpForm} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => { setShowAddOpModal(false); setOpForm(EMPTY_OP_FORM); }}>
              {t('cancel') || "Bekor qilish"}
            </Button>
            <Button
              onClick={handleAddOperation}
              disabled={isSubmitting || !opForm.name}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('add_operation') || "Qo'shish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Operation Modal */}
      <Dialog open={showEditOpModal} onOpenChange={setShowEditOpModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('edit_operation') || "Operatsiyani tahrirlash"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <OperationForm form={opForm} onChange={setOpForm} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => { setShowEditOpModal(false); setSelectedOp(null); setOpForm(EMPTY_OP_FORM); }}>
              {t('cancel') || "Bekor qilish"}
            </Button>
            <Button
              onClick={handleUpdateOperation}
              disabled={isSubmitting || !opForm.name}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('update') || "Yangilash"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View BOM Operations Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('routing_details') || "Texjarayon tafsilotlari"}</DialogTitle>
          </DialogHeader>
          {selectedBom && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('product') || "Mahsulot"}</p>
                  <p className="font-medium">{selectedBom.product_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('bom') || "BOM"}</p>
                  <p className="font-medium">{selectedBom.name}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t('seq') || "№"}</TableHead>
                    <TableHead>{t('operation') || "Operatsiya"}</TableHead>
                    <TableHead>{t('work_center') || "Ish markazi"}</TableHead>
                    <TableHead className="text-right">{t('duration') || "Davomiylik"}</TableHead>
                    <TableHead className="text-right">{t('setup') || "Sozlash"}</TableHead>
                    <TableHead className="text-right">{t('cost') || "Narx"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...(selectedBom.operations || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)).map(op => {
                    const totalMin = (op.run_time_minutes || 0) + (op.setup_time_minutes || 0);
                    const opCost = (totalMin / 60) * (op.work_center_hourly_cost || 0);
                    return (
                      <TableRow key={op.id}>
                        <TableCell><Badge variant="outline">{op.sequence}</Badge></TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{op.operation_name || op.name}</p>
                            {op.notes && <p className="text-sm text-slate-500">{op.notes}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{op.work_center_name || workCenters.find(wc => wc.id === op.work_center_id)?.name || '-'}</TableCell>
                        <TableCell className="text-right">{op.run_time_minutes || 0} {t('min') || 'min'}</TableCell>
                        <TableCell className="text-right">{op.setup_time_minutes || 0} {t('min') || 'min'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(opCost)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {selectedBom.operations && selectedBom.operations.length > 0 && (
                <div className="flex justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-500">{t('total_time') || "Jami vaqt"}</p>
                    <p className="text-xl font-bold">
                      {(calculateTotals(selectedBom.operations).totalMinutes / 60).toFixed(1)}{t('h') || 'h'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('total_cost') || "Jami narx"}</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(calculateTotals(selectedBom.operations).totalCost)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Operation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_operation') || "Operatsiyani o'chirish"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_operation_confirm') || "Bu amalni qaytarib bo'lmaydi. Davom etasizmi?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || "Bekor qilish"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOperation} className="bg-red-600 hover:bg-red-700">
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
