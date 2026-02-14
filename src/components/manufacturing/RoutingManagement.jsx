import React, { useState, useEffect, useMemo } from 'react';
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
  Settings as SettingsIcon,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Shuffle,
  Copy,
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

export default function RoutingManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { workCenters } = useManufacturing();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [routings, setRoutings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRouting, setSelectedRouting] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newRouting, setNewRouting] = useState({
    name: '',
    product_id: '',
    description: '',
    operations: [],
  });

  const [newOperation, setNewOperation] = useState({
    sequence: 1,
    name: '',
    work_center_id: '',
    description: '',
    duration_minutes: 0,
    setup_time_minutes: 0,
    cost_per_hour: 0,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  // Load routings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('genix_routings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRoutings(parsed);
      } catch (error) {
        console.error('Error parsing stored routings:', error);
        const sampleRoutings = generateSampleRoutings();
        setRoutings(sampleRoutings);
        localStorage.setItem('genix_routings', JSON.stringify(sampleRoutings));
      }
    } else {
      const sampleRoutings = generateSampleRoutings();
      setRoutings(sampleRoutings);
      localStorage.setItem('genix_routings', JSON.stringify(sampleRoutings));
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage (only after initial load)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('genix_routings', JSON.stringify(routings));
    }
  }, [routings, isInitialized]);

  // Generate sample routings
  const generateSampleRoutings = () => {
    return [
      {
        id: `RT-${Date.now()}-1`,
        name: t('sample_routing_name') || 'Standard Widget Assembly',
        code: 'RT-WIDGET-001',
        product_id: 'prod_1',
        description: t('sample_routing_description') || 'Standard routing for widget production',
        operations: [
          {
            id: 'op_1',
            sequence: 10,
            name: t('material_preparation') || 'Material Preparation',
            work_center_id: workCenters[0]?.id || 'wc_1',
            description: t('prepare_raw_materials') || 'Prepare and check raw materials',
            duration_minutes: 30,
            setup_time_minutes: 10,
            cost_per_hour: 50,
          },
          {
            id: 'op_2',
            sequence: 20,
            name: t('cnc_machining') || 'CNC Machining',
            work_center_id: workCenters[1]?.id || 'wc_2',
            description: t('cnc_cutting_shaping') || 'CNC cutting and shaping',
            duration_minutes: 60,
            setup_time_minutes: 20,
            cost_per_hour: 100,
          },
          {
            id: 'op_3',
            sequence: 30,
            name: t('assembly') || 'Assembly',
            work_center_id: workCenters[0]?.id || 'wc_1',
            description: t('assemble_components') || 'Assemble components',
            duration_minutes: 45,
            setup_time_minutes: 5,
            cost_per_hour: 60,
          },
          {
            id: 'op_4',
            sequence: 40,
            name: t('quality_check') || 'Quality Check',
            work_center_id: workCenters[2]?.id || 'wc_3',
            description: t('final_quality_inspection') || 'Final quality inspection',
            duration_minutes: 15,
            setup_time_minutes: 0,
            cost_per_hour: 40,
          },
        ],
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ];
  };

  // Filter routings
  const filteredRoutings = useMemo(() => {
    return routings.filter(r =>
      !searchQuery ||
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [routings, searchQuery]);

  // Handle create routing
  const handleCreateRouting = () => {
    setIsSubmitting(true);

    const routing = {
      id: `RT-${Date.now()}`,
      ...newRouting,
      code: `RT-${Date.now()}`, // Auto-generate code
      status: 'active',
      created_at: new Date().toISOString(),
    };

    setRoutings(prev => [routing, ...prev]);
    setShowCreateModal(false);
    resetForm();
    setIsSubmitting(false);
  };

  // Handle update routing
  const handleUpdateRouting = () => {
    if (!selectedRouting) return;

    setIsSubmitting(true);

    setRoutings(prev => prev.map(r =>
      r.id === selectedRouting.id ? selectedRouting : r
    ));

    setShowEditModal(false);
    setSelectedRouting(null);
    setIsSubmitting(false);
  };

  // Handle delete routing
  const handleDeleteRouting = () => {
    if (!selectedRouting) return;

    setRoutings(prev => prev.filter(r => r.id !== selectedRouting.id));
    setShowDeleteDialog(false);
    setSelectedRouting(null);
  };

  // Handle add operation
  const handleAddOperation = () => {
    const operation = {
      id: `op_${Date.now()}`,
      ...newOperation,
      sequence: (newRouting.operations.length + 1) * 10,
    };

    setNewRouting({
      ...newRouting,
      operations: [...newRouting.operations, operation],
    });

    setNewOperation({
      sequence: 1,
      name: '',
      work_center_id: '',
      description: '',
      duration_minutes: 0,
      setup_time_minutes: 0,
      cost_per_hour: 0,
    });
  };

  // Handle remove operation
  const handleRemoveOperation = (opId) => {
    setNewRouting({
      ...newRouting,
      operations: newRouting.operations.filter(op => op.id !== opId),
    });
  };

  // Handle move operation
  const handleMoveOperation = (index, direction) => {
    const newOps = [...newRouting.operations];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newOps.length) return;

    [newOps[index], newOps[newIndex]] = [newOps[newIndex], newOps[index]];

    // Renumber sequences
    newOps.forEach((op, idx) => {
      op.sequence = (idx + 1) * 10;
    });

    setNewRouting({ ...newRouting, operations: newOps });
  };

  const resetForm = () => {
    setNewRouting({
      name: '',
      product_id: '',
      description: '',
      operations: [],
    });
    setNewOperation({
      sequence: 1,
      name: '',
      work_center_id: '',
      description: '',
      duration_minutes: 0,
      setup_time_minutes: 0,
      cost_per_hour: 0,
    });
  };

  // Calculate routing totals
  const calculateRoutingTotals = (routing) => {
    const totalDuration = routing.operations.reduce((sum, op) => sum + (op.duration_minutes || 0) + (op.setup_time_minutes || 0), 0);
    const totalCost = routing.operations.reduce((sum, op) => sum + ((op.duration_minutes + op.setup_time_minutes) / 60 * (op.cost_per_hour || 0)), 0);

    return { totalDuration, totalCost };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t('routing_management') || "Texnologik jarayon"}</h2>
          <p className="text-slate-600 mt-1">{t('routing_desc') || "Ishlab chiqarish operatsiyalarini boshqaring"}</p>
        </div>
        {canCreate(MODULES.MANUFACTURING) && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('new_routing') || "Yangi texjarayon"}
          </Button>
        )}
      </div>

      {/* Search */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('search_routings') || "Texjarayonlarni qidirish..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Routings List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRoutings.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_routings_found') || "Texjarayonlar topilmadi"}</p>
            </CardContent>
          </Card>
        ) : (
          filteredRoutings.map(routing => {
            const totals = calculateRoutingTotals(routing);

            return (
              <Card key={routing.id} className="bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-blue-600" />
                        <div>
                          <CardTitle className="text-lg">{routing.name}</CardTitle>
                          <p className="text-sm text-slate-500 mt-1">
                            {routing.code} • {routing.operations.length} {t('operations') || "operatsiya"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <p className="text-sm text-slate-500">{t('total_time') || "Jami vaqt"}</p>
                        <p className="font-medium">{(totals.totalDuration / 60).toFixed(1)}{t('h')}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedRouting(routing); setShowViewModal(true); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            {t('view') || "Ko'rish"}
                          </DropdownMenuItem>
                          {canUpdate(MODULES.MANUFACTURING) && (
                            <DropdownMenuItem onClick={() => { setSelectedRouting(routing); setShowEditModal(true); }}>
                              <Pencil className="w-4 h-4 mr-2" />
                              {t('edit') || "Tahrirlash"}
                            </DropdownMenuItem>
                          )}
                          {canDelete(MODULES.MANUFACTURING) && (
                            <DropdownMenuItem
                              onClick={() => { setSelectedRouting(routing); setShowDeleteDialog(true); }}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('delete') || "O'chirish"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {routing.description && (
                    <p className="text-sm text-slate-600 mb-4">{routing.description}</p>
                  )}

                  {/* Operations Flow */}
                  <div className="flex flex-wrap items-center gap-2">
                    {routing.operations.sort((a, b) => a.sequence - b.sequence).map((op, index) => (
                      <React.Fragment key={op.id}>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{op.sequence}</Badge>
                            <span className="font-medium text-sm">{op.name}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {op.duration_minutes}{t('min')}
                            {op.setup_time_minutes > 0 && ` (+${op.setup_time_minutes}${t('min')})`}
                          </div>
                        </div>
                        {index < routing.operations.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-slate-400" />
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

      {/* Create Routing Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_routing') || "Yangi texjarayon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>{t('routing_name') || "Nomi"} *</Label>
              <Input
                value={newRouting.name}
                onChange={e => setNewRouting({ ...newRouting, name: e.target.value })}
                placeholder={t('enter_routing_name') || "Texjarayon nomini kiriting"}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('description') || "Tavsif"}</Label>
              <Textarea
                value={newRouting.description}
                onChange={e => setNewRouting({ ...newRouting, description: e.target.value })}
                placeholder={t('enter_description') || "Tavsif kiriting..."}
                rows={2}
              />
            </div>

            {/* Operations */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">{t('operations') || "Operatsiyalar"}</h3>

              {/* Existing Operations */}
              {newRouting.operations.length > 0 && (
                <div className="space-y-2 mb-4">
                  {newRouting.operations.map((op, index) => (
                    <div key={op.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMoveOperation(index, 'up')}
                          disabled={index === 0}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMoveOperation(index, 'down')}
                          disabled={index === newRouting.operations.length - 1}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <Badge variant="outline">{op.sequence}</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{op.name}</p>
                        <p className="text-xs text-slate-500">
                          {workCenters.find(wc => wc.id === op.work_center_id)?.name || op.work_center_id} • {op.duration_minutes}{t('min')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveOperation(op.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Operation */}
              <div className="p-4 border border-dashed border-slate-300 rounded-lg space-y-4">
                <h4 className="font-medium text-sm">{t('add_operation') || "Operatsiya qo'shish"}</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('operation_name') || "Operatsiya nomi"}</Label>
                    <Input
                      value={newOperation.name}
                      onChange={e => setNewOperation({ ...newOperation, name: e.target.value })}
                      placeholder={t('enter_operation_name') || "Operatsiya nomini kiriting"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('work_center') || "Ish markazi"}</Label>
                    <Select
                      value={newOperation.work_center_id}
                      onValueChange={value => {
                        const selectedWC = workCenters.find(wc => wc.id === value);
                        setNewOperation({
                          ...newOperation,
                          work_center_id: value,
                          name: selectedWC?.name || newOperation.name,
                          cost_per_hour: selectedWC?.hourly_cost || newOperation.cost_per_hour
                        });
                      }}
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

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('duration_minutes') || "Davomiyligi (daq)"}</Label>
                    <Input
                      type="number"
                      value={newOperation.duration_minutes}
                      onChange={e => setNewOperation({ ...newOperation, duration_minutes: parseInt(e.target.value) || 0 })}
                      placeholder="60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('setup_time') || "Sozlash vaqti (daq)"}</Label>
                    <Input
                      type="number"
                      value={newOperation.setup_time_minutes}
                      onChange={e => setNewOperation({ ...newOperation, setup_time_minutes: parseInt(e.target.value) || 0 })}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('cost_per_hour') || "Soatlik narx"}</Label>
                    <Input
                      type="number"
                      value={newOperation.cost_per_hour}
                      onChange={e => setNewOperation({ ...newOperation, cost_per_hour: parseFloat(e.target.value) || 0 })}
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('operation_description') || "Tavsif"}</Label>
                  <Textarea
                    value={newOperation.description}
                    onChange={e => setNewOperation({ ...newOperation, description: e.target.value })}
                    placeholder={t('enter_operation_description') || "Operatsiya tavsifini kiriting..."}
                    rows={2}
                  />
                </div>

                <Button
                  onClick={handleAddOperation}
                  disabled={!newOperation.name || !newOperation.work_center_id}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add_to_routing') || "Texjarayonga qo'shish"}
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleCreateRouting}
                disabled={isSubmitting || !newRouting.name || newRouting.operations.length === 0}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {t('create_routing') || "Texjarayon yaratish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Routing Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('routing_details') || "Texjarayon tafsilotlari"}</DialogTitle>
          </DialogHeader>
          {selectedRouting && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('routing_name') || "Nomi"}</p>
                  <p className="font-medium">{selectedRouting.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('routing_code') || "Kod"}</p>
                  <p className="font-medium">{selectedRouting.code}</p>
                </div>
              </div>

              {selectedRouting.description && (
                <div>
                  <p className="text-sm text-slate-500">{t('description') || "Tavsif"}</p>
                  <p className="font-medium">{selectedRouting.description}</p>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-3">{t('operations_sequence') || "Operatsiyalar ketma-ketligi"}</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{t('seq') || "№"}</TableHead>
                      <TableHead>{t('operation') || "Operatsiya"}</TableHead>
                      <TableHead>{t('work_center') || "Ish markazi"}</TableHead>
                      <TableHead className="text-right">{t('duration') || "Davomiyligi"}</TableHead>
                      <TableHead className="text-right">{t('setup') || "Sozlash"}</TableHead>
                      <TableHead className="text-right">{t('cost') || "Narx"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRouting.operations.sort((a, b) => a.sequence - b.sequence).map(op => {
                      const totalTime = op.duration_minutes + op.setup_time_minutes;
                      const opCost = (totalTime / 60) * op.cost_per_hour;

                      return (
                        <TableRow key={op.id}>
                          <TableCell>
                            <Badge variant="outline">{op.sequence}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{op.name}</p>
                              {op.description && (
                                <p className="text-sm text-slate-500">{op.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {workCenters.find(wc => wc.id === op.work_center_id)?.name || op.work_center_id}
                          </TableCell>
                          <TableCell className="text-right">{op.duration_minutes} {t('min')}</TableCell>
                          <TableCell className="text-right">{op.setup_time_minutes} {t('min')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(opCost)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">{t('total_time') || "Jami vaqt"}</p>
                  <p className="text-xl font-bold">
                    {(calculateRoutingTotals(selectedRouting).totalDuration / 60).toFixed(1)}{t('h')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('total_cost') || "Jami narx"}</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(calculateRoutingTotals(selectedRouting).totalCost)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Routing Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit_routing') || "Marshrutni tahrirlash"}</DialogTitle>
          </DialogHeader>
          {selectedRouting && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label>{t('routing_name') || "Nomi"} *</Label>
                <Input
                  value={selectedRouting.name}
                  onChange={e => setSelectedRouting({ ...selectedRouting, name: e.target.value })}
                  placeholder={t('enter_routing_name') || "Texjarayon nomini kiriting"}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('description') || "Tavsif"}</Label>
                <Textarea
                  value={selectedRouting.description}
                  onChange={e => setSelectedRouting({ ...selectedRouting, description: e.target.value })}
                  placeholder={t('enter_description') || "Tavsif kiriting..."}
                  rows={2}
                />
              </div>

              {/* Operations */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">{t('operations') || "Operatsiyalar"}</h3>

                {/* Existing Operations */}
                {selectedRouting.operations && selectedRouting.operations.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {selectedRouting.operations.map((op, index) => (
                      <div key={op.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newOps = [...selectedRouting.operations];
                              if (index > 0) {
                                [newOps[index], newOps[index - 1]] = [newOps[index - 1], newOps[index]];
                                newOps.forEach((o, idx) => { o.sequence = (idx + 1) * 10; });
                                setSelectedRouting({ ...selectedRouting, operations: newOps });
                              }
                            }}
                            disabled={index === 0}
                            className="h-6 w-6 p-0"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newOps = [...selectedRouting.operations];
                              if (index < newOps.length - 1) {
                                [newOps[index], newOps[index + 1]] = [newOps[index + 1], newOps[index]];
                                newOps.forEach((o, idx) => { o.sequence = (idx + 1) * 10; });
                                setSelectedRouting({ ...selectedRouting, operations: newOps });
                              }
                            }}
                            disabled={index === selectedRouting.operations.length - 1}
                            className="h-6 w-6 p-0"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <Badge variant="outline">{op.sequence}</Badge>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{op.name}</p>
                          <p className="text-xs text-slate-500">
                            {workCenters.find(wc => wc.id === op.work_center_id)?.name || op.work_center_id} • {op.duration_minutes}{t('min')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const newOps = selectedRouting.operations.filter(o => o.id !== op.id);
                            setSelectedRouting({ ...selectedRouting, operations: newOps });
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Operation */}
                <div className="p-4 border border-dashed border-slate-300 rounded-lg space-y-4">
                  <h4 className="font-medium text-sm">{t('add_operation') || "Operatsiya qo'shish"}</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('operation_name') || "Operatsiya nomi"}</Label>
                      <Input
                        value={newOperation.name}
                        onChange={e => setNewOperation({ ...newOperation, name: e.target.value })}
                        placeholder={t('enter_operation_name') || "Operatsiya nomini kiriting"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('work_center') || "Ish markazi"}</Label>
                      <Select
                        value={newOperation.work_center_id}
                        onValueChange={value => {
                          const selectedWC = workCenters.find(wc => wc.id === value);
                          setNewOperation({
                            ...newOperation,
                            work_center_id: value,
                            name: selectedWC?.name || newOperation.name,
                            cost_per_hour: selectedWC?.hourly_cost || newOperation.cost_per_hour
                          });
                        }}
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

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t('duration_minutes') || "Davomiyligi (daq)"}</Label>
                      <Input
                        type="number"
                        value={newOperation.duration_minutes}
                        onChange={e => setNewOperation({ ...newOperation, duration_minutes: parseInt(e.target.value) || 0 })}
                        placeholder="60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('setup_time') || "Sozlash vaqti (daq)"}</Label>
                      <Input
                        type="number"
                        value={newOperation.setup_time_minutes}
                        onChange={e => setNewOperation({ ...newOperation, setup_time_minutes: parseInt(e.target.value) || 0 })}
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('cost_per_hour') || "Soatlik narx"}</Label>
                      <Input
                        type="number"
                        value={newOperation.cost_per_hour}
                        onChange={e => setNewOperation({ ...newOperation, cost_per_hour: parseFloat(e.target.value) || 0 })}
                        placeholder="100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('operation_description') || "Tavsif"}</Label>
                    <Textarea
                      value={newOperation.description}
                      onChange={e => setNewOperation({ ...newOperation, description: e.target.value })}
                      placeholder={t('enter_operation_description') || "Operatsiya tavsifini kiriting..."}
                      rows={2}
                    />
                  </div>

                  <Button
                    onClick={() => {
                      if (newOperation.name && newOperation.work_center_id) {
                        const operation = {
                          id: `op_${Date.now()}`,
                          ...newOperation,
                          sequence: ((selectedRouting.operations?.length || 0) + 1) * 10,
                        };
                        setSelectedRouting({
                          ...selectedRouting,
                          operations: [...(selectedRouting.operations || []), operation],
                        });
                        setNewOperation({
                          sequence: 1,
                          name: '',
                          work_center_id: '',
                          description: '',
                          duration_minutes: 0,
                          setup_time_minutes: 0,
                          cost_per_hour: 0,
                        });
                      }
                    }}
                    disabled={!newOperation.name || !newOperation.work_center_id}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_to_routing') || "Texjarayonga qo'shish"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedRouting(null); }}>
                  {t('cancel') || "Bekor qilish"}
                </Button>
                <Button
                  onClick={handleUpdateRouting}
                  disabled={isSubmitting || !selectedRouting.name || !selectedRouting.operations || selectedRouting.operations.length === 0}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {t('update') || "Yangilash"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_routing') || "Texjarayonni o'chirish"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_routing_confirm') || "Bu amalni qaytarib bo'lmaydi. Davom etasizmi?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || "Bekor qilish"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRouting} className="bg-red-600 hover:bg-red-700">
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
