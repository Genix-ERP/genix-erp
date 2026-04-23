import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
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
  ChevronLeft,
  FolderOpen,
  Package,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { ImportExportButtons } from '@/components/shared';
import SmetaImportModal from '@/components/construction/SmetaImportModal';
import SmetaExportModal from '@/components/construction/SmetaExportModal';
import SmetaSummaryView from '@/components/construction/SmetaSummaryView';
import SublineModal from '@/components/construction/SublineModal';
import EstimateLineEditModal from '@/components/construction/EstimateLineEditModal';

const EstimatesTab = ({ project, wbsItems = [], buildings = [], scope, subcontracts = [] }) => {
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
  const [showEditEstimateModal, setShowEditEstimateModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);

  // Sub-line modals (migration 332). `sublineParent` is the parent row when
  // adding a new sub-line; `lineToEdit` is the row being edited in the full
  // edit modal (can be parent or sub-line).
  const [sublineDialog, setSublineDialog] = useState({ open: false, parent: null, estimateId: null, nextSeq: 1, initial: null });
  const [editLineDialog, setEditLineDialog] = useState({ open: false, line: null, parent: null, estimateId: null });

  // Forms
  const [estimateForm, setEstimateForm] = useState({
    name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '', source_type: 'vor'
  });
  const [editEstimateForm, setEditEstimateForm] = useState({
    id: null, name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12', source_type: 'vor'
  });
  const [lineForm, setLineForm] = useState({
    id: null, estimate_id: null, product_id: '', name: '', uom: '', quantity: '',
    material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0'
  });
  const [addLines, setAddLines] = useState([{ product_id: '', quantity: '' }]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'default' });

  // Source type filter for estimates list
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Import/Export
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // importColumns removed - SmetaImportModal handles parsing directly

  const handleImport = async ({ estimateName, buildingId, lines, sourceType, sectionNames, subcontractId, sourceFileName }) => {
    try {
      // Find existing draft estimate with same name for this building, or create new
      let est = estimates.find(e =>
        e.name === estimateName &&
        e.state === 'draft' &&
        (buildingId === 0 ? !e.building_id : e.building_id === buildingId)
      );
      let estId;
      let isExisting = false;
      if (est) {
        estId = est.id;
        isExisting = true;
      } else {
        const createData = {
          name: estimateName,
          building_id: buildingId,
          overhead_pct: 0,
          profit_pct: 0,
          vat_pct: 12,
          source_type: sourceType || '',
        };
        if (subcontractId) createData.subcontract_id = subcontractId;
        const created = await constructionService.createEstimate(project.id, createData);
        estId = created.id;
      }

      // Bulk create all lines (replace existing if re-importing to same estimate).
      // `sourceFileName` lets the backend dedupe auto-created Forma 2 drafts —
      // multiple estimate types extracted from the same uploaded Excel file
      // will merge into one Forma 2 instead of producing one per type.
      const bulkResult = await constructionService.bulkCreateEstimateLines(estId, lines, {
        replace: isExisting,
        sourceType: sourceType || '',
        sourceFileName: sourceFileName || '',
      });

      // Show toast if products were auto-created from resource lines
      if (bulkResult?.products_created > 0) {
        toast.success(`${bulkResult.products_created} ${t('products_auto_created') || "ta mahsulot avtomatik yaratildi"}`);
      }

      // Show toast if Forma 2 was auto-created from VOR/Edinich estimate
      if (bulkResult?.forma2_created) {
        toast.success(t('forma2_auto_created') || "Forma 2 avtomatik yaratildi", {
          description: t('forma2_auto_created_desc') || "Smetadan barcha qatorlar bilan qoralama Forma 2 yaratildi",
        });
      }

      // Auto-create construction stages from section headers in the
      // uploaded file. The parser splits each source type into sections
      // (ВОР → "Блок №1"/"Блок №2"; Единич → work-category rows; Ресурс →
      // "ТРУДОВЫЕ РЕСУРСЫ"/"СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ"/…), and each
      // section becomes a stage scoped to the estimate's building.
      //
      // Dedupe by (building_id, upper-cased name) so re-importing or
      // importing a sibling type from the same file doesn't create
      // duplicate stages — and so the same section name in a different
      // block is still allowed to produce its own stage.
      if (sectionNames?.length > 0) {
        // Scope the existence check to this building — migration 333 made
        // stages building-aware, so "Блок №1" in building A and "Блок №1"
        // in building B are legitimately separate stages.
        let existingStages = [];
        try {
          existingStages = await constructionService.listStages(
            project.id,
            buildingId > 0 ? { buildingId } : undefined,
          );
        } catch (e) {
          // ignore — we'll attempt to create all stages
        }
        const existingNames = new Set(
          (existingStages || [])
            .filter(s => (buildingId > 0 ? Number(s.building_id) === Number(buildingId) : !s.building_id))
            .map(s => (s.name || '').toUpperCase())
        );

        for (let i = 0; i < sectionNames.length; i++) {
          const name = sectionNames[i];
          if (!name) continue;
          const key = name.toUpperCase();
          if (existingNames.has(key)) continue;
          try {
            await constructionService.createStage(project.id, {
              name,
              status: 'not_started',
              planned_budget: 0,
              // 0 = project-wide (backend maps to NULL via nullInt64FromVal).
              building_id: buildingId > 0 ? Number(buildingId) : 0,
            });
            // Remember in the local dedupe set so duplicate section names
            // within a single import (rare but possible) don't insert twice.
            existingNames.add(key);
          } catch (e) {
            console.error('Failed to create stage:', name, e);
          }
        }
      }

      await loadEstimates();
    } catch (error) {
      console.error('Error importing estimates:', error);
      throw error;
    }
  };

  const [summaryKey, setSummaryKey] = useState(0);

  const handleImportSvod = async (rows) => {
    try {
      await constructionService.importEstimateSummary(project.id, rows);
      setSummaryKey((k) => k + 1);
    } catch (error) {
      console.error('Error importing svod:', error);
      throw error;
    }
  };

  const expandedLines = expandedEstimate ? (estimateLines[expandedEstimate] || []) : [];


  // Load estimates
  const loadEstimates = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await constructionService.listEstimates(project.id, scope ? { scope } : {});
      setEstimates(data || []);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
    }
  }, [project?.id, scope]);

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

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sourceTypeFilter]);

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
      const createData = {
        name: estimateForm.name,
        building_id: buildingId,
        overhead_pct: parseFloat(estimateForm.overhead_pct) || 0,
        profit_pct: parseFloat(estimateForm.profit_pct) || 0,
        vat_pct: parseFloat(estimateForm.vat_pct) || 0,
        source_type: estimateForm.source_type || '',
      };
      if (estimateForm.subcontract_id) {
        createData.subcontract_id = parseInt(estimateForm.subcontract_id);
      }
      await constructionService.createEstimate(project.id, createData);
      setShowEstimateModal(false);
      setEstimateForm({ name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '', source_type: 'vor' });
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

  // Edit estimate (open modal pre-populated)
  const handleEditEstimate = (est) => {
    setEditEstimateForm({
      id: est.id,
      name: est.name || '',
      building_id: est.building_id ? String(est.building_id) : '',
      overhead_pct: String(est.overhead_pct || 0),
      profit_pct: String(est.profit_pct || 0),
      vat_pct: String(est.vat_pct || 0),
      source_type: est.source_type || 'vor',
    });
    setShowEditEstimateModal(true);
  };

  // Update estimate
  const handleUpdateEstimate = async (e) => {
    e.preventDefault();
    try {
      const buildingId = editEstimateForm.building_id ? parseInt(editEstimateForm.building_id) : 0;
      const data = {
        name: editEstimateForm.name,
        building_id: buildingId,
        overhead_pct: parseFloat(editEstimateForm.overhead_pct) || 0,
        profit_pct: parseFloat(editEstimateForm.profit_pct) || 0,
        vat_pct: parseFloat(editEstimateForm.vat_pct) || 0,
      };
      await constructionService.updateEstimate(editEstimateForm.id, data);
      setShowEditEstimateModal(false);
      await loadEstimates();
      // Reload lines if this estimate is expanded
      if (expandedEstimate === editEstimateForm.id) {
        await loadEstimateLines(editEstimateForm.id);
      }
    } catch (error) {
      console.error('Error updating estimate:', error);
    }
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
    let filtered = [];
    if (selectedBuilding === 'project') {
      filtered = estimates.filter(e => !e.building_id);
    } else if (selectedBuilding?.id) {
      filtered = estimates.filter(e => e.building_id === selectedBuilding.id);
    }
    if (sourceTypeFilter !== 'all') {
      filtered = filtered.filter(e => (e.source_type || '') === sourceTypeFilter);
    }
    return filtered;
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
          onExport={() => setShowExportModal(true)}
          importDisabled={false}
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
                  // Get unique subcontractor names for this building (subcontract mode)
                  // Show subcontractors linked to building via junction table + from estimates
                  const subNames = [...new Set([
                    ...subcontracts
                      .filter(sc => (sc.building_ids || []).includes(building.id))
                      .map(sc => sc.partner_name || sc.name),
                    ...buildingEstimates.map(e => e.subcontract_name).filter(Boolean),
                  ].filter(Boolean))];
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
                      {subNames.length > 0 && (
                        <div className="ml-6 mt-0.5">
                          {subNames.map((name, i) => (
                            <span key={i} className="text-xs text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mr-1">{name}</span>
                          ))}
                        </div>
                      )}
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
                overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '',
                source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : 'vor'
              });
              setShowEstimateModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              {t('create_estimate') || "Smeta yaratish"}
            </Button>
          )}
        </CardHeader>
        {selectedBuilding && (
          <div className="flex items-center gap-1 px-6 pb-3 border-b">
            {[
              { key: 'all', label: t('all') || 'Barchasi' },
              { key: 'vor', label: 'ВОР' },
              { key: 'edinich', label: 'Единич' },
              { key: 'resurs', label: 'Ресурс' },
            ].map(tab => {
              const count = tab.key === 'all'
                ? (selectedBuilding === 'project' ? estimates.filter(e => !e.building_id) : estimates.filter(e => e.building_id === selectedBuilding?.id)).length
                : (selectedBuilding === 'project' ? estimates.filter(e => !e.building_id && e.source_type === tab.key) : estimates.filter(e => e.building_id === selectedBuilding?.id && e.source_type === tab.key)).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSourceTypeFilter(tab.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    sourceTypeFilter === tab.key
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab.label} {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
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
                  overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '',
                  source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : 'vor'
                });
                setShowEstimateModal(true);
              }}>
                <Plus className="w-4 h-4 mr-1" />
                {t('create_estimate') || "Smeta yaratish"}
              </Button>
            </div>
          ) : (
            // Use a plain scrollable div instead of Radix <ScrollArea>: the
            // Radix viewport is `display: table`, which lets any descendant
            // with an intrinsic min-width (like the resurs table's
            // min-w-[1200px]) widen the viewport itself. That swallowed the
            // inner overflow-x-auto and made horizontal scrolling impossible.
            // A native block-level scroll container keeps the viewport
            // constrained so the table can overflow and scroll horizontally.
            <div className="h-[600px] overflow-y-auto">
              <div className="p-4 space-y-3">
                {(() => {
                  const totalCount = filteredEstimates.length;
                  const totalPages = Math.ceil(totalCount / pageSize);
                  const paginatedEstimates = filteredEstimates.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                  return paginatedEstimates.map((est) => {
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
                            {est.source_type && (() => {
                              const sourceLabels = {
                                vor: { uz: 'ВОР', ru: 'ВОР', color: 'bg-blue-100 text-blue-700' },
                                edinich: { uz: 'Единич', ru: 'Единич', color: 'bg-purple-100 text-purple-700' },
                                resurs: { uz: 'Ресурс', ru: 'Ресурс', color: 'bg-green-100 text-green-700' },
                              };
                              const info = sourceLabels[est.source_type];
                              if (!info) return null;
                              return <Badge className={`text-xs ${info.color}`}>{info[language] || info.ru}</Badge>;
                            })()}
                            {est.subcontract_name && <Badge className="bg-orange-100 text-orange-700 text-xs">{est.subcontract_name}</Badge>}
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
                                  <DropdownMenuItem onClick={() => handleEditEstimate(est)}>
                                    <Edit className="w-4 h-4 mr-2 text-blue-600" />
                                    {t('edit_estimate') || 'Tahrirlash'}
                                  </DropdownMenuItem>
                                )}
                                {est.state === 'draft' && (
                                  <DropdownMenuItem onClick={() => handleApprove(est)}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                    {t('approve') || 'Tasdiqlash'}
                                  </DropdownMenuItem>
                                )}
                                {est.source_type === 'resurs' && (
                                  <DropdownMenuItem onClick={async () => {
                                    try {
                                      const result = await constructionService.createProductsFromEstimate(est.id);
                                      if (result?.products_created > 0) {
                                        toast.success(`${result.products_created} ${t('products_created_success') || "ta mahsulot yaratildi"}`);
                                      } else {
                                        toast.info(t('all_products_already_exist') || "Barcha mahsulotlar allaqachon mavjud");
                                      }
                                    } catch (err) {
                                      console.error(err);
                                      toast.error(t('error_occurred') || 'Xatolik yuz berdi');
                                    }
                                  }}>
                                    <Package className="w-4 h-4 mr-2 text-green-600" />
                                    {t('create_products') || "Mahsulotlar yaratish"}
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
                              {/*
                                For resurs estimates the table has up to 10
                                columns (Nomi + 5 numeric rates + actions),
                                which don't fit on a typical desktop viewport
                                once sidebar + panel widths are taken out.
                                Give the table a minimum width so the
                                wrapping div's overflow-x-auto actually kicks
                                in and the user can scroll to the rightmost
                                columns (Material / Ish haqi / Jihozlar /
                                Birlik narxi / Jami) instead of having them
                                squeezed to 30-40px with the values wrapped
                                across two lines.
                              */}
                              <div className="overflow-x-auto">
                                <table
                                  className={`w-full text-sm table-fixed ${est.source_type === 'resurs' ? 'min-w-[1400px]' : 'min-w-[900px]'}`}
                                >
                                  <colgroup>
                                    <col style={{ width: '56px' }} />
                                    {est.source_type !== 'resurs' && <col style={{ width: '120px' }} />}
                                    <col />{/* Nomi — absorbs remaining width */}
                                    <col style={{ width: '110px' }} />
                                    <col style={{ width: '100px' }} />
                                    {est.source_type === 'resurs' && <>
                                      <col style={{ width: '110px' }} />
                                      <col style={{ width: '110px' }} />
                                      <col style={{ width: '110px' }} />
                                      <col style={{ width: '120px' }} />
                                      <col style={{ width: '130px' }} />
                                    </>}
                                    {est.state === 'draft' && <col style={{ width: '96px' }} />}
                                  </colgroup>
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">№</th>
                                      {est.source_type !== 'resurs' && <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('code') || 'Shifr'}</th>}
                                      <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">{t('name') || 'Nomi'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('unit') || "O'lchov"}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('quantity') || 'Miqdor'}</th>
                                      {est.source_type === 'resurs' && <>
                                        <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('material') || 'Material'}</th>
                                        <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('labor') || 'Ish haqi'}</th>
                                        <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('equipment') || 'Jihozlar'}</th>
                                        <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('unit_rate') || 'Birlik narxi'}</th>
                                        <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('total') || 'Jami'}</th>
                                      </>}
                                      {est.state === 'draft' && <th className="whitespace-nowrap"></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      // Group lines by parent. Two mechanisms, in order of precedence:
                                      //   1. Explicit FK (`parent_line_id`) set by the SublineModal flow.
                                      //   2. Implicit hierarchy detected from the item_number pattern
                                      //      `{base}-{seq}` (e.g. "3-1" is a child of "3"). This covers
                                      //      data imported from Excel/SNiP files where the numbering
                                      //      expresses the relationship but no FK was written.
                                      const byParent = new Map(); // parent_line_id -> children[]
                                      const roots = [];

                                      // Build an item_number -> line.id lookup for the implicit pass.
                                      // We only use top-level rows (no parent already set) as potential
                                      // parents so we don't stack 3-1-1 as child of 3-1.
                                      const itemNumToId = new Map();
                                      for (const ln of lines) {
                                        if (!ln.parent_line_id && ln.item_number) {
                                          itemNumToId.set(String(ln.item_number), ln.id);
                                        }
                                      }

                                      // Classify: a row is a sub-line if (a) it has parent_line_id,
                                      // or (b) its item_number looks like "N-M" (N, M both numeric)
                                      // AND an item_number "N" exists in this estimate.
                                      for (const ln of lines) {
                                        let effectiveParentId = null;
                                        if (ln.parent_line_id) {
                                          effectiveParentId = ln.parent_line_id;
                                        } else if (typeof ln.item_number === 'string') {
                                          // Only split on the LAST hyphen, and only when both sides are
                                          // plain integers. This avoids misinterpreting codes like
                                          // "E0102-057-02" (not all-numeric segments).
                                          const m = ln.item_number.match(/^(\d+)-(\d+)$/);
                                          if (m) {
                                            const base = m[1];
                                            const resolved = itemNumToId.get(base);
                                            if (resolved && resolved !== ln.id) {
                                              effectiveParentId = resolved;
                                            }
                                          }
                                        }

                                        if (effectiveParentId) {
                                          const arr = byParent.get(effectiveParentId) || [];
                                          arr.push(ln);
                                          byParent.set(effectiveParentId, arr);
                                        } else {
                                          roots.push(ln);
                                        }
                                      }
                                      const rows = [];
                                      const colSpan = est.source_type === 'resurs' ? 10 : 6;

                                      const renderLine = (line, isSubline, parent) => {
                                        // Sub-lines (podkator) get a green tint + left accent border so they're
                                        // visually distinct from regular estimate rows.
                                        const rowClass = isSubline
                                          ? 'border-b border-slate-100 hover:bg-emerald-50/70 group bg-emerald-50/40 border-l-[3px] border-l-emerald-400'
                                          : 'border-b border-slate-100 hover:bg-white group';
                                        return (
                                          <tr key={line.id} className={rowClass}>
                                            <td className="py-2 px-2 text-xs whitespace-nowrap">
                                              {isSubline
                                                ? <span className="pl-6 font-mono text-emerald-700 whitespace-nowrap">{line.item_number}</span>
                                                : <span className="font-medium text-slate-500 whitespace-nowrap">{line.item_number}</span>}
                                            </td>
                                            {est.source_type !== 'resurs' && <td className={`py-2 px-2 text-xs ${isSubline ? 'text-emerald-700/80' : 'text-slate-500'}`}>{line.code}</td>}
                                            <td className={`py-2 px-2 text-xs ${isSubline ? 'text-emerald-900' : ''}`}>
                                              {isSubline && (
                                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                                                  line.resource_type === 'labor' ? 'bg-blue-500' :
                                                  line.resource_type === 'equipment' ? 'bg-amber-500' :
                                                  line.resource_type === 'material' ? 'bg-emerald-600' : 'bg-emerald-400'
                                                }`} />
                                              )}
                                              {line.name}
                                              {isSubline && Number(line.norm_rate) > 0 && (
                                                <span className="text-[10px] text-emerald-700/70 ml-2">
                                                  ({t('norm') || 'Norma'} {line.norm_rate})
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-2 text-right text-xs text-slate-600 whitespace-nowrap">{line.uom}</td>
                                            <td className="py-2 px-2 text-right text-xs whitespace-nowrap">{line.quantity}</td>
                                            {est.source_type === 'resurs' && <>
                                              <td className="py-2 px-2 text-right text-xs whitespace-nowrap">{formatCurrency(line.material_rate)}</td>
                                              <td className="py-2 px-2 text-right text-xs whitespace-nowrap">{formatCurrency(line.labor_rate)}</td>
                                              <td className="py-2 px-2 text-right text-xs whitespace-nowrap">{formatCurrency(line.equipment_rate)}</td>
                                              <td className="py-2 px-2 text-right text-xs font-medium whitespace-nowrap">{formatCurrency(line.unit_rate)}</td>
                                              <td className="py-2 px-2 text-right text-xs font-medium whitespace-nowrap">{formatCurrency(line.total_amount)}</td>
                                            </>}
                                            {est.state === 'draft' && (
                                              <td className="py-2 px-2 text-center">
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 justify-end">
                                                  {!isSubline && (
                                                    <Button
                                                      variant="ghost" size="sm"
                                                      className="h-6 w-6 p-0"
                                                      title={t('add_subline') || "Podkator qo'shish"}
                                                      onClick={() => {
                                                        const children = byParent.get(line.id) || [];
                                                        const nextSeq = children.reduce((mx, c) => Math.max(mx, Number(c.subline_seq) || 0), 0) + 1;
                                                        setSublineDialog({ open: true, parent: line, estimateId: est.id, nextSeq, initial: null });
                                                      }}
                                                    >
                                                      <Plus className="w-3 h-3" />
                                                    </Button>
                                                  )}
                                                  <Button
                                                    variant="ghost" size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => setEditLineDialog({ open: true, line, parent: parent || null, estimateId: est.id })}
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
                                        );
                                      };

                                      for (const parent of roots) {
                                        rows.push(renderLine(parent, false, null));
                                        const children = byParent.get(parent.id) || [];
                                        for (const c of children) {
                                          rows.push(renderLine(c, true, parent));
                                        }
                                        if (children.length > 0 && est.source_type === 'resurs') {
                                          const subTotal = children.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);
                                          rows.push(
                                            <tr key={`subtotal-${parent.id}`} className="bg-emerald-50/60 border-b border-slate-100 border-l-[3px] border-l-emerald-400">
                                              <td className="py-1.5 px-2" />
                                              {est.source_type !== 'resurs' && <td />}
                                              <td className="py-1.5 px-2 text-xs text-emerald-800 italic" colSpan={colSpan - 2}>
                                                {parent.item_number}-{t('subline_total_label') || "qator podkatorlar jami"}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-xs font-semibold text-emerald-700">
                                                {formatCurrency(subTotal)}
                                              </td>
                                              {est.state === 'draft' && <td />}
                                            </tr>
                                          );
                                        }
                                        // Also render any orphan lines that claim this as parent by item_number
                                        // (legacy rows linked via parent_item_number only)
                                      }

                                      // Render orphans (parent_line_id unset and parent_item_number points to nothing)
                                      return rows;
                                    })()}
                                  </tbody>
                                  {est.source_type === 'resurs' && (
                                    <tfoot>
                                      <tr className="font-semibold bg-white">
                                        <td colSpan={8} className="py-2 px-2 text-right text-xs">{t('direct_cost') || "To'g'ridan-to'g'ri xarajat"}:</td>
                                        <td className="py-2 px-2 text-right text-xs">{formatCurrency(est.amount_direct || 0)}</td>
                                        {est.state === 'draft' && <td></td>}
                                      </tr>
                                    </tfoot>
                                  )}
                                </table>
                              </div>

                              {/* Summary — only for resurs type */}
                              {est.source_type === 'resurs' && (
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
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
                {(() => {
                  const totalCount = filteredEstimates.length;
                  const totalPages = Math.ceil(totalCount / pageSize);
                  return totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-slate-500">
                        {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} / {totalCount}
                      </p>
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>1</button>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Svod Summary (only in main estimates view) */}
      {!scope && <SmetaSummaryView key={summaryKey} projectId={project?.id} />}

      {/* Create Estimate Modal */}
      <Dialog open={showEstimateModal} onOpenChange={setShowEstimateModal}>
        <DialogContent aria-describedby={undefined} className="overflow-visible">
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
              <div>
                <Label>Smeta turi *</Label>
                <Select
                  value={estimateForm.source_type}
                  onValueChange={(val) => setEstimateForm({ ...estimateForm, source_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vor">ВОР — Ishlar ro'yxati</SelectItem>
                    <SelectItem value="edinich">Единич — Batafsil miqdor</SelectItem>
                    <SelectItem value="resurs">Ресурс — Resurslar narxi</SelectItem>
                  </SelectContent>
                </Select>
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
              {scope === 'subcontract' && subcontracts.length > 0 && (
                <div>
                  <Label>{t('subcontractor') || 'Pudratchi'} *</Label>
                  <Select
                    value={estimateForm.subcontract_id || "none"}
                    onValueChange={(val) => setEstimateForm({ ...estimateForm, subcontract_id: val === "none" ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_subcontractor') || "Pudratchi tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {subcontracts.map(sc => (
                        <SelectItem key={sc.id} value={String(sc.id)}>
                          {sc.name}{sc.partner_name ? ` - ${sc.partner_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {estimateForm.source_type === 'resurs' && (
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
              )}
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

      {/* Edit Estimate Modal */}
      <Dialog open={showEditEstimateModal} onOpenChange={setShowEditEstimateModal}>
        <DialogContent aria-describedby={undefined} className="overflow-visible">
          <DialogHeader>
            <DialogTitle>{t('edit_estimate') || "Smetani tahrirlash"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEstimate}>
            <div className="space-y-4">
              <div>
                <Label>{t('name') || 'Nomi'} *</Label>
                <Input
                  value={editEstimateForm.name}
                  onChange={(e) => setEditEstimateForm({ ...editEstimateForm, name: e.target.value })}
                  placeholder={t('estimate_name_placeholder') || "Asosiy smeta"}
                  required
                />
              </div>
              <div>
                <Label>Smeta turi</Label>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {editEstimateForm.source_type === 'vor' ? 'ВОР — Ishlar ro\'yxati' :
                   editEstimateForm.source_type === 'edinich' ? 'Единич — Batafsil miqdor' :
                   editEstimateForm.source_type === 'resurs' ? 'Ресурс — Resurslar narxi' : editEstimateForm.source_type}
                </p>
              </div>
              {buildings.length > 0 && (
                <div>
                  <Label>{t('buildings_blocks') || 'Bino / Blok'}</Label>
                  <Select
                    value={editEstimateForm.building_id || "none"}
                    onValueChange={(val) => setEditEstimateForm({ ...editEstimateForm, building_id: val === "none" ? '' : val })}
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
              {editEstimateForm.source_type === 'resurs' && (
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <Label className="text-xs">{t('overhead') || "Qo'shimcha"}, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={editEstimateForm.overhead_pct}
                      onChange={(e) => setEditEstimateForm({ ...editEstimateForm, overhead_pct: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('profit') || 'Foyda'}, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={editEstimateForm.profit_pct}
                      onChange={(e) => setEditEstimateForm({ ...editEstimateForm, profit_pct: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">QQS, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={editEstimateForm.vat_pct}
                      onChange={(e) => setEditEstimateForm({ ...editEstimateForm, vat_pct: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowEditEstimateModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{t('save') || 'Saqlash'}</Button>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('name') || 'Nomi'}</Label>
                    <Input
                      value={lineForm.name}
                      onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                      placeholder={t('line_name') || 'Qator nomi'}
                    />
                  </div>
                  <div>
                    <Label>{t('unit') || "O'lchov birligi"}</Label>
                    <Input
                      value={lineForm.uom}
                      onChange={(e) => setLineForm({ ...lineForm, uom: e.target.value })}
                      placeholder={t('uom_placeholder') || "шт, м, кг..."}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('quantity') || 'Miqdor'}</Label>
                    <NumberInput
                      value={lineForm.quantity}
                      onChange={(raw) => setLineForm({ ...lineForm, quantity: raw })}
                    />
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
                <div className="grid grid-cols-2 gap-4">
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
                            <NumberInput
                              placeholder="0"
                              value={row.quantity}
                              onChange={(raw) => {
                                setAddLines(prev => prev.map((r, i) => i === idx ? { ...r, quantity: raw } : r));
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
      <SmetaImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        onImportSvod={handleImportSvod}
        buildings={buildings}
        project={project}
        subcontracts={scope === 'subcontract' ? subcontracts : []}
        scope={scope}
      />

      {/* Export Modal */}
      <SmetaExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        estimates={getFilteredEstimates()}
        estimateLines={estimateLines}
        loadEstimateLines={loadEstimateLines}
        selectedBuilding={selectedBuilding}
        project={project}
      />

      {/* Sub-line add / edit modal (migration 332) */}
      <SublineModal
        open={sublineDialog.open}
        onClose={() => setSublineDialog({ open: false, parent: null, estimateId: null, nextSeq: 1, initial: null })}
        parent={sublineDialog.parent}
        estimateId={sublineDialog.estimateId}
        projectId={project?.id}
        nextSeq={sublineDialog.nextSeq}
        initial={sublineDialog.initial}
        onSaved={async () => {
          if (sublineDialog.estimateId) {
            await loadEstimateLines(sublineDialog.estimateId);
            await loadEstimates();
          }
        }}
      />

      {/* Full edit modal — used by the pencil icon on any line */}
      <EstimateLineEditModal
        open={editLineDialog.open}
        onClose={() => setEditLineDialog({ open: false, line: null, parent: null, estimateId: null })}
        line={editLineDialog.line}
        parent={editLineDialog.parent}
        estimateId={editLineDialog.estimateId}
        onSaved={async () => {
          if (editLineDialog.estimateId) {
            await loadEstimateLines(editLineDialog.estimateId);
            await loadEstimates();
          }
        }}
      />
    </div>
  );
};

export default EstimatesTab;
