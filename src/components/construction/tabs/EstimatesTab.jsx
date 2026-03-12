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
  Layers,
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { ImportModal, ExportModal, ImportExportButtons } from '@/components/shared';

const EstimatesTab = ({ project, wbsItems = [], buildings = [] }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [estimates, setEstimates] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null); // building object or 'project' for unassigned
  const [expandedEstimate, setExpandedEstimate] = useState(null); // estimate id
  const [estimateLines, setEstimateLines] = useState({}); // { [estimateId]: lines[] }
  const [loading, setLoading] = useState(true);
  const [linesLoading, setLinesLoading] = useState(null); // estimate id being loaded
  const [products, setProducts] = useState([]);

  // Modals
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);

  // Forms
  const [estimateForm, setEstimateForm] = useState({
    name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12'
  });
  const [lineForm, setLineForm] = useState({
    id: null, estimate_id: null, product_id: '', name: '', uom: '', quantity: '',
    material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0'
  });
  const [addLines, setAddLines] = useState([{ product_id: '', quantity: '' }]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'default' });

  // Import/Export
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState([]);

  const exportColumns = [
    { key: 'estimate_name', label: t('estimate') || 'Smeta' },
    { key: 'name', label: t('name') || 'Nomi' },
    { key: 'uom', label: t('unit') || "O'lchov birligi" },
    { key: 'quantity', label: t('quantity') || 'Miqdor' },
    { key: 'material_rate', label: t('material') || 'Material', render: (v) => formatCurrency(v || 0) },
    { key: 'labor_rate', label: t('labor') || 'Ish haqi', render: (v) => formatCurrency(v || 0) },
    { key: 'equipment_rate', label: t('equipment') || 'Jihozlar', render: (v) => formatCurrency(v || 0) },
    { key: 'unit_rate', label: t('unit_rate') || 'Birlik narxi', render: (v) => formatCurrency(v || 0) },
    { key: 'total_amount', label: t('total') || 'Jami', render: (v) => formatCurrency(v || 0) },
  ];

  const importColumns = [
    { key: 'estimate_name', label: t('estimate') || 'Smeta', required: true },
    { key: 'name', label: t('name') || 'Nomi', required: true },
    { key: 'uom', label: t('unit') || "O'lchov birligi" },
    { key: 'quantity', label: t('quantity') || 'Miqdor' },
    { key: 'material_rate', label: t('material') || 'Material' },
    { key: 'labor_rate', label: t('labor') || 'Ish haqi' },
    { key: 'equipment_rate', label: t('equipment') || 'Jihozlar' },
  ];

  const handleImport = async (data) => {
    if (!selectedBuilding) return;
    const buildingId = selectedBuilding === 'project' ? 0 : selectedBuilding.id;
    try {
      // Group rows by estimate_name
      const grouped = {};
      for (const row of data) {
        const estName = row.estimate_name || 'Imported';
        if (!grouped[estName]) grouped[estName] = [];
        grouped[estName].push(row);
      }

      for (const [estName, rows] of Object.entries(grouped)) {
        // Find existing draft estimate with same name for this building, or create new
        let est = estimates.find(e =>
          e.name === estName &&
          e.state === 'draft' &&
          (selectedBuilding === 'project' ? !e.building_id : e.building_id === buildingId)
        );
        let estId;
        if (est) {
          estId = est.id;
        } else {
          const created = await constructionService.createEstimate(project.id, {
            name: estName,
            building_id: buildingId,
            overhead_pct: 0,
            profit_pct: 0,
            vat_pct: 12,
          });
          estId = created.id;
        }

        for (const row of rows) {
          await constructionService.createEstimateLine(estId, {
            name: row.name,
            uom: row.uom || 'шт',
            quantity: row.quantity ? parseFloat(row.quantity) : 0,
            material_rate: row.material_rate ? parseFloat(row.material_rate) : 0,
            labor_rate: row.labor_rate ? parseFloat(row.labor_rate) : 0,
            equipment_rate: row.equipment_rate ? parseFloat(row.equipment_rate) : 0,
            sort_order: 0,
          });
        }
      }

      await loadEstimates();
      setShowImportModal(false);
    } catch (error) {
      console.error('Error importing estimates:', error);
    }
  };

  const expandedLines = expandedEstimate ? (estimateLines[expandedEstimate] || []) : [];

  // Prepare export data: all lines from all filtered estimates
  const handlePrepareExport = async () => {
    const ests = getFilteredEstimates();
    const allRows = [];
    for (const est of ests) {
      let lines = estimateLines[est.id];
      if (!lines) {
        try {
          const data = await constructionService.getEstimate(est.id);
          lines = data?.lines || [];
          setEstimateLines(prev => ({ ...prev, [est.id]: lines }));
        } catch {
          lines = [];
        }
      }
      for (const line of lines) {
        allRows.push({
          estimate_name: `${est.name} (v${est.version})`,
          name: line.name,
          uom: line.uom,
          quantity: line.quantity,
          material_rate: line.material_rate,
          labor_rate: line.labor_rate,
          equipment_rate: line.equipment_rate,
          unit_rate: line.unit_rate || ((line.material_rate || 0) + (line.labor_rate || 0) + (line.equipment_rate || 0)),
          total_amount: line.total_amount || 0,
        });
      }
    }
    setExportData(allRows);
    setShowExportModal(true);
  };

  // Load estimates
  const loadEstimates = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await constructionService.listEstimates(project.id);
      setEstimates(data || []);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  // Auto-select first building
  useEffect(() => {
    if (!selectedBuilding && buildings.length > 0) {
      setSelectedBuilding(buildings[0]);
    }
  }, [buildings]);

  useEffect(() => {
    if (!project?.id) return;
    constructionService.listProjectMaterials(project.id)
      .then(data => setProducts(data || []))
      .catch(() => setProducts([]));
  }, [project?.id]);

  // Load lines for an estimate
  const loadEstimateLines = async (estimateId) => {
    setLinesLoading(estimateId);
    try {
      const data = await constructionService.getEstimate(estimateId);
      setEstimateLines(prev => ({ ...prev, [estimateId]: data?.lines || [] }));
    } catch (error) {
      console.error('Error loading estimate lines:', error);
      setEstimateLines(prev => ({ ...prev, [estimateId]: [] }));
    } finally {
      setLinesLoading(null);
    }
  };

  // Toggle estimate expansion
  const handleToggleEstimate = (estId) => {
    if (expandedEstimate === estId) {
      setExpandedEstimate(null);
    } else {
      setExpandedEstimate(estId);
      if (!estimateLines[estId]) {
        loadEstimateLines(estId);
      }
    }
  };

  // Create estimate
  const handleCreateEstimate = async (e) => {
    e.preventDefault();
    try {
      const buildingId = estimateForm.building_id ? parseInt(estimateForm.building_id) : 0;
      await constructionService.createEstimate(project.id, {
        name: estimateForm.name,
        building_id: buildingId,
        overhead_pct: parseFloat(estimateForm.overhead_pct) || 0,
        profit_pct: parseFloat(estimateForm.profit_pct) || 0,
        vat_pct: parseFloat(estimateForm.vat_pct) || 0,
      });
      setShowEstimateModal(false);
      setEstimateForm({ name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12' });
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
          if (expandedEstimate === est.id) {
            setExpandedEstimate(null);
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
    const estId = lineForm.estimate_id;
    if (!estId) return;
    try {
      if (lineForm.id) {
        const data = {
          name: lineForm.name,
          uom: lineForm.uom || 'шт',
          quantity: parseFloat(lineForm.quantity) || 0,
          material_rate: parseFloat(parsePriceInput(lineForm.material_rate)) || 0,
          labor_rate: parseFloat(parsePriceInput(lineForm.labor_rate)) || 0,
          equipment_rate: parseFloat(parsePriceInput(lineForm.equipment_rate)) || 0,
          sort_order: parseInt(lineForm.sort_order) || 0,
        };
        await constructionService.updateEstimateLine(estId, lineForm.id, data);
      } else {
        const baseLaborRate = parseFloat(parsePriceInput(lineForm.labor_rate)) || 0;
        const baseEquipmentRate = parseFloat(parsePriceInput(lineForm.equipment_rate)) || 0;
        const currentLines = estimateLines[estId] || [];
        const baseSortOrder = currentLines.length;

        for (let i = 0; i < addLines.length; i++) {
          const row = addLines[i];
          if (!row.product_id) continue;
          const mat = products.find(p => String(p.product_id) === row.product_id);
          if (!mat) continue;
          const qty = parseFloat(row.quantity) || 0;
          if (qty <= 0) continue;
          await constructionService.createEstimateLine(estId, {
            name: mat.product_name,
            uom: mat.uom || 'шт',
            quantity: qty,
            material_rate: mat.unit_cost || 0,
            labor_rate: baseLaborRate,
            equipment_rate: baseEquipmentRate,
            sort_order: baseSortOrder + i,
          });
        }
      }

      await loadEstimateLines(estId);
      await loadEstimates();
      setShowLineModal(false);
      setLineForm({ id: null, estimate_id: null, product_id: '', name: '', uom: '', quantity: '', material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0' });
      setAddLines([{ product_id: '', quantity: '' }]);
    } catch (error) {
      console.error('Error saving line:', error);
    }
  };

  // Delete line
  const handleDeleteLine = (estId, lineId) => {
    setConfirmDialog({
      open: true,
      title: t('delete') || "O'chirish",
      description: t('confirm_delete') || "O'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.",
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await constructionService.deleteEstimateLine(estId, lineId);
          await loadEstimateLines(estId);
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

  // Get estimates for current building selection
  const getFilteredEstimates = () => {
    if (selectedBuilding === 'project') {
      return estimates.filter(e => !e.building_id);
    }
    if (selectedBuilding?.id) {
      return estimates.filter(e => e.building_id === selectedBuilding.id);
    }
    return [];
  };

  const filteredEstimates = getFilteredEstimates();

  // Build left sidebar items: buildings + "Butun loyiha" if there are unassigned estimates
  const unassignedCount = estimates.filter(e => !e.building_id).length;

  return (
    <div className="space-y-4">
      {/* Import/Export Header */}
      <div className="flex items-center justify-end">
        <ImportExportButtons
          onImport={() => setShowImportModal(true)}
          onExport={handlePrepareExport}
          importDisabled={!selectedBuilding}
          exportDisabled={!selectedBuilding || filteredEstimates.length === 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Buildings List */}
      <Card className="lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('buildings_blocks') || 'Binolar / Bloklar'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {buildings.length === 0 && unassignedCount === 0 ? (
              <div className="p-8 text-center">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">{t('no_buildings') || "Binolar yo'q"}</p>
              </div>
            ) : (
              <div className="divide-y">
                {buildings.map((building) => {
                  const buildingEstimates = estimates.filter(e => e.building_id === building.id);
                  const totalAmount = buildingEstimates.reduce((sum, e) => sum + (e.amount_total || 0), 0);
                  const isSelected = selectedBuilding?.id === building.id;
                  return (
                    <div
                      key={building.id}
                      className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                      onClick={() => {
                        setSelectedBuilding(building);
                        setExpandedEstimate(null);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">
                          {building.code ? `${building.code} - ${building.name}` : building.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 ml-6">
                        <span className="text-xs text-slate-400">{buildingEstimates.length} {t('estimates_count') || 'smeta'}</span>
                        {totalAmount > 0 && (
                          <span className="text-xs font-medium text-slate-600">{formatCurrency(totalAmount)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* "Butun loyiha" for unassigned estimates */}
                {unassignedCount > 0 && (
                  <div
                    className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedBuilding === 'project' ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                    onClick={() => {
                      setSelectedBuilding('project');
                      setExpandedEstimate(null);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{t('entire_project') || "Butun loyiha"}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 ml-6">
                      <span className="text-xs text-slate-400">{unassignedCount} {t('estimates_count') || 'smeta'}</span>
                      <span className="text-xs font-medium text-slate-600">
                        {formatCurrency(estimates.filter(e => !e.building_id).reduce((s, e) => s + (e.amount_total || 0), 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right: Estimates with expandable lines */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {selectedBuilding === 'project'
              ? (t('entire_project') || "Butun loyiha")
              : selectedBuilding?.name
                ? (selectedBuilding.code ? `${selectedBuilding.code} - ${selectedBuilding.name}` : selectedBuilding.name)
                : (t('select_building_first') || "Avval bino tanlang")}
          </CardTitle>
          {selectedBuilding && (
            <Button size="sm" onClick={() => {
              setEstimateForm({
                name: '',
                building_id: selectedBuilding === 'project' ? '' : String(selectedBuilding.id),
                overhead_pct: '0', profit_pct: '0', vat_pct: '12'
              });
              setShowEstimateModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              {t('create_estimate') || "Smeta yaratish"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!selectedBuilding ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('select_building_first') || "Avval bino tanlang"}</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
          ) : filteredEstimates.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_estimates') || "Smetalar yo'q"}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => {
                setEstimateForm({
                  name: '',
                  building_id: selectedBuilding === 'project' ? '' : String(selectedBuilding.id),
                  overhead_pct: '0', profit_pct: '0', vat_pct: '12'
                });
                setShowEstimateModal(true);
              }}>
                <Plus className="w-4 h-4 mr-1" />
                {t('create_estimate') || "Smeta yaratish"}
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-3">
                {filteredEstimates.map((est) => {
                  const isExpanded = expandedEstimate === est.id;
                  const lines = estimateLines[est.id] || [];
                  const isLoadingLines = linesLoading === est.id;

                  return (
                    <div key={est.id} className={`border rounded-lg overflow-hidden ${isExpanded ? 'border-blue-300 shadow-sm' : 'border-slate-200'}`}>
                      {/* Estimate card header */}
                      <div
                        className={`px-4 py-3 cursor-pointer group transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => handleToggleEstimate(est.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <Badge variant="outline" className="text-xs font-mono">v{est.version}</Badge>
                            <span className="font-medium">{est.name}</span>
                            {est.is_current && <Badge className="bg-blue-500 text-white text-xs">{t('current') || 'Faol'}</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${getStateColor(est.state)}`}>
                              {getStateLabel(est.state)}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
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
                        </div>
                        <div className="flex items-center justify-between ml-6">
                          <span className="text-sm text-slate-500">{est.lines_count || 0} {t('lines') || 'qator'}</span>
                          <span className="text-base font-semibold">{formatCurrency(est.amount_total || 0)}</span>
                        </div>
                      </div>

                      {/* Expanded: lines table */}
                      {isExpanded && (
                        <div className="border-t border-blue-200 bg-slate-50/70">
                          {/* Add line button */}
                          {est.state === 'draft' && (
                            <div className="px-4 py-2 flex justify-end border-b border-slate-200">
                              <Button size="sm" variant="outline" onClick={() => {
                                const currentLines = estimateLines[est.id] || [];
                                setLineForm({ id: null, estimate_id: est.id, product_id: '', name: '', uom: '', quantity: '', material_rate: '', labor_rate: '', equipment_rate: '', sort_order: String(currentLines.length) });
                                setAddLines([{ product_id: '', quantity: '' }]);
                                setShowLineModal(true);
                              }}>
                                <Plus className="w-4 h-4 mr-1" />
                                {t('add_line') || "Qator qo'shish"}
                              </Button>
                            </div>
                          )}

                          {isLoadingLines ? (
                            <div className="text-center py-6 text-slate-500 text-sm">{t('loading') || 'Yuklanmoqda...'}</div>
                          ) : lines.length === 0 ? (
                            <div className="text-center py-6">
                              <p className="text-slate-400 text-sm">{t('no_lines') || "Qatorlar yo'q"}</p>
                            </div>
                          ) : (
                            <div className="px-2 pb-2">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">{t('name') || 'Nomi'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500">{t('unit') || "O'lchov"}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500">{t('quantity') || 'Miqdor'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500">{t('material') || 'Material'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500">{t('labor') || 'Ish haqi'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500">{t('equipment') || 'Jihozlar'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500">{t('unit_rate') || 'Birlik'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500">{t('total') || 'Jami'}</th>
                                      {est.state === 'draft' && <th className="w-16"></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map((line) => (
                                      <tr key={line.id} className="border-b border-slate-100 hover:bg-white group">
                                        <td className="py-2 px-2 text-xs">{line.name}</td>
                                        <td className="py-2 px-2 text-right text-xs text-slate-600">{line.uom}</td>
                                        <td className="py-2 px-2 text-right text-xs">{line.quantity}</td>
                                        <td className="py-2 px-2 text-right text-xs">{formatCurrency(line.material_rate)}</td>
                                        <td className="py-2 px-2 text-right text-xs">{formatCurrency(line.labor_rate)}</td>
                                        <td className="py-2 px-2 text-right text-xs">{formatCurrency(line.equipment_rate)}</td>
                                        <td className="py-2 px-2 text-right text-xs font-medium">{formatCurrency(line.unit_rate)}</td>
                                        <td className="py-2 px-2 text-right text-xs font-medium">{formatCurrency(line.total_amount)}</td>
                                        {est.state === 'draft' && (
                                          <td className="py-2 px-2 text-center">
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                              <Button
                                                variant="ghost" size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => {
                                                  setLineForm({
                                                    id: line.id,
                                                    estimate_id: est.id,
                                                    product_id: line.product_id ? String(line.product_id) : '',
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
                                                <Edit className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                variant="ghost" size="sm"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeleteLine(est.id, line.id)}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="font-semibold bg-white">
                                      <td colSpan={7} className="py-2 px-2 text-right text-xs">{t('direct_cost') || "To'g'ridan-to'g'ri xarajat"}:</td>
                                      <td className="py-2 px-2 text-right text-xs">{formatCurrency(est.amount_direct || 0)}</td>
                                      {est.state === 'draft' && <td></td>}
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>

                              {/* Summary */}
                              <div className="mt-2 mx-2 border-t pt-2 space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">{t('direct_cost') || "To'g'ridan-to'g'ri xarajat"}</span>
                                  <span className="font-medium">{formatCurrency(est.amount_direct || 0)}</span>
                                </div>
                                {est.overhead_pct > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">{t('overhead') || "Qo'shimcha xarajatlar"} ({est.overhead_pct}%)</span>
                                    <span>{formatCurrency((est.amount_direct || 0) * (est.overhead_pct / 100))}</span>
                                  </div>
                                )}
                                {est.profit_pct > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">{t('profit') || 'Foyda'} ({est.profit_pct}%)</span>
                                    <span>{formatCurrency((est.amount_direct || 0) * (1 + est.overhead_pct / 100) * (est.profit_pct / 100))}</span>
                                  </div>
                                )}
                                {est.vat_pct > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">QQS ({est.vat_pct}%)</span>
                                    <span>{formatCurrency(
                                      (est.amount_direct || 0) * (1 + est.overhead_pct / 100) * (1 + est.profit_pct / 100) * (est.vat_pct / 100)
                                    )}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold text-sm border-t pt-1">
                                  <span>{t('total') || 'Jami'}</span>
                                  <span>{formatCurrency(est.amount_total || 0)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Create Estimate Modal */}
      <Dialog open={showEstimateModal} onOpenChange={setShowEstimateModal}>
        <DialogContent aria-describedby={undefined}>
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
              {buildings.length > 0 && (
                <div>
                  <Label>{t('buildings_blocks') || 'Bino / Blok'}</Label>
                  <Select
                    value={estimateForm.building_id || "none"}
                    onValueChange={(val) => setEstimateForm({ ...estimateForm, building_id: val === "none" ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_building') || "Bino tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('entire_project') || "Butun loyiha"}</SelectItem>
                      {buildings.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.code ? `${b.code} - ${b.name}` : b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{lineForm.id ? (t('edit_line') || "Qatorni tahrirlash") : (t('add_line') || "Qator qo'shish")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLine}>
            {lineForm.id ? (
              <div className="space-y-4">
                <div>
                  <Label>{t('product') || 'Mahsulot'}</Label>
                  <p className="mt-1 text-sm font-medium">{lineForm.name}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>{t('quantity') || 'Miqdor'}</Label>
                    <Input
                      type="number" step="0.0001" min="0"
                      value={lineForm.quantity}
                      onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('unit') || "O'lchov birligi"}</Label>
                    <p className="mt-2 text-sm text-slate-600">{lineForm.uom || '—'}</p>
                  </div>
                  <div>
                    <Label>{t('material_rate') || 'Material'}</Label>
                    <Input
                      value={lineForm.material_rate}
                      onChange={(e) => setLineForm({ ...lineForm, material_rate: formatPriceInput(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm font-semibold">{t('products') || 'Mahsulotlar'}</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAddLines(prev => [...prev, { product_id: '', quantity: '' }])}>
                      <Plus className="w-3 h-3 mr-1" /> {t('add_line') || "Qo'shish"}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {addLines.map((row, idx) => {
                      const mat = row.product_id ? products.find(p => String(p.product_id) === row.product_id) : null;
                      return (
                        <div key={idx} className="flex gap-3 items-end bg-slate-50 p-2 rounded">
                          <div className="flex-[2] min-w-0">
                            {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('product') || 'Mahsulot'}</label>}
                            <Select
                              value={row.product_id || "none"}
                              onValueChange={(val) => {
                                setAddLines(prev => prev.map((r, i) => i === idx ? { ...r, product_id: val === "none" ? '' : val } : r));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_product') || "Tanlang"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-</SelectItem>
                                {products.map(p => (
                                  <SelectItem key={p.product_id} value={String(p.product_id)}>
                                    {p.product_name}{p.uom ? ` (${p.uom})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24 flex-shrink-0">
                            {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('qty') || 'Miqdor'}</label>}
                            <Input
                              type="number" step="0.0001" min="0"
                              placeholder="0"
                              value={row.quantity}
                              onChange={(e) => {
                                setAddLines(prev => prev.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r));
                              }}
                            />
                          </div>
                          <div className="w-32 flex-shrink-0 text-right">
                            {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('price') || 'Narxi'}</label>}
                            <p className="text-sm py-2 text-slate-600 whitespace-nowrap">{mat?.unit_cost ? formatCurrency(mat.unit_cost) : '—'}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {idx === 0 && <label className="text-xs text-transparent mb-1 block">.</label>}
                            <Button
                              type="button" size="sm" variant="ghost"
                              onClick={() => setAddLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                              disabled={addLines.length === 1}
                              className="text-red-500 h-9 w-9 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  let grandTotal = 0;
                  for (const row of addLines) {
                    if (!row.product_id) continue;
                    const mat = products.find(p => String(p.product_id) === row.product_id);
                    const qty = parseFloat(row.quantity) || 0;
                    const unitRate = mat?.unit_cost || 0;
                    grandTotal += qty * unitRate;
                  }
                  return grandTotal > 0 ? (
                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="text-sm text-slate-500">{t('total') || 'Jami'}</span>
                      <span className="text-base font-semibold">{formatCurrency(grandTotal)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowLineModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!lineForm.id && !addLines.some(r => r.product_id && parseFloat(r.quantity) > 0)}>
                {lineForm.id ? (t('save') || 'Saqlash') : (t('add') || "Qo'shish")}
              </Button>
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

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        columns={importColumns}
        entityName={t('estimates') || 'Smetalar'}
        templateColumns={importColumns}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={exportData}
        columns={exportColumns}
        entityName={t('estimates') || 'Smetalar'}
        title={selectedBuilding === 'project' ? (t('entire_project') || 'Butun loyiha') : (selectedBuilding?.name || '')}
      />
    </div>
  );
};

export default EstimatesTab;
