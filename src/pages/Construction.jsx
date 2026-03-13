import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConstructionContext } from '@/components/contexts/ConstructionContext';
import { constructionService } from '@/api/services/construction';
import { hrService } from '@/api/services/hr';
import { inventoryService } from '@/api/services/inventory';
import { Core as Integrations } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Plus,
  FolderTree,
  FileSpreadsheet,
  Camera,
  ClipboardList,
  TrendingUp,
  Users,
  MapPin,
  Calendar,
  DollarSign,
  Search,
  Edit,
  Trash2,
  Eye,
  ChevronRight,
  ChevronLeft,
  Package,
  Truck,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Warehouse,
  UserPlus,
  Settings,
  MoreHorizontal,
  ArrowLeft,
  PlusCircle,
  Receipt,
  Hammer,
  HardHat,
  LayoutGrid,
  Columns3,
  Upload,
  X,
  Image,
  Layers
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ActivityLogPanel } from '@/components/shared/ActivityLog';
import { WBSTree } from '@/components/construction/WBSTree';
import ActivityTab from '@/components/construction/tabs/ActivityTab';
import EstimatesTab from '@/components/construction/tabs/EstimatesTab';
import DailyJournalTab from '@/components/construction/tabs/DailyJournalTab';
import StagesTab from '@/components/construction/tabs/StagesTab';
import ExpensesTab from '@/components/construction/tabs/ExpensesTab';
import BudgetTab from '@/components/construction/tabs/BudgetTab';
import MaterialUsageTab from '@/components/construction/tabs/MaterialUsageTab';
import ProgressTab from '@/components/construction/tabs/ProgressTab';
import SubcontractorsTab from '@/components/construction/tabs/SubcontractorsTab';
import ActsTab from '@/components/construction/tabs/ActsTab';
import FinancialTab from '@/components/construction/tabs/FinancialTab';
import { ImportModal, ExportModal, ImportExportButtons } from '@/components/shared';
import { ReportGenerator } from '@/components/construction/ReportGenerator';
import { ProjectKanban } from '@/components/construction/ProjectKanban';
import {
  ProgressWidget,
  FinancialWidget,
  TimelineWidget,
  TeamWidget,
  VendorsWidget,
  AlertsWidget
} from '@/components/construction/DashboardWidgets';

// Progress Tracking Tab Component
const ProgressTrackingTab = ({ project, sections, t, formatCurrency, onRefresh }) => {
  const [estimates, setEstimates] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [estimateLines, setEstimateLines] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [completedQty, setCompletedQty] = useState('');
  const [saving, setSaving] = useState(false);

  // Load estimates and their lines
  useEffect(() => {
    const loadData = async () => {
      if (!project?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const estimatesData = await constructionService.listEstimates(project.id);
        const ests = estimatesData || [];
        setEstimates(ests);

        if (ests.length > 0) {
          const linesPromises = ests.map(est =>
            constructionService.listEstimateLines(est.id).then(lines =>
              (lines || []).map(line => ({ ...line, estimate_name: est.name, estimate_code: est.code }))
            )
          );
          const results = await Promise.all(linesPromises);
          setAllItems(results.flat());
        } else {
          setAllItems([]);
        }
      } catch (error) {
        console.error('Error loading estimates for progress:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [project?.id]);

  // Load lines for selected estimate
  useEffect(() => {
    const loadLines = async () => {
      if (!selectedEstimate) {
        setEstimateLines([]);
        return;
      }
      try {
        const lines = await constructionService.listEstimateLines(selectedEstimate.id);
        setEstimateLines(lines || []);
      } catch (error) {
        console.error('Error loading estimate lines:', error);
      }
    };
    loadLines();
  }, [selectedEstimate]);

  // Calculate overall progress
  const calculateProgress = (items) => {
    if (!items || items.length === 0) return { percent: 0, completed: 0, total: 0, byValue: 0 };

    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const doneQty = items.reduce((sum, item) => sum + (item.actual_amount > 0 ? item.quantity : 0), 0);
    const totalValue = items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    const completedValue = items.reduce((sum, item) => sum + (item.actual_amount || 0), 0);

    return {
      percent: totalValue > 0 ? Math.round((completedValue / totalValue) * 100) : 0,
      completed: doneQty,
      total: totalQty,
      byValue: totalValue > 0 ? Math.round((completedValue / totalValue) * 100) : 0,
      completedValue,
      totalValue
    };
  };

  // Calculate estimate progress
  const getEstimateProgress = (estimateId) => {
    const items = allItems.filter(item => item.estimate_id === estimateId);
    return calculateProgress(items);
  };

  const overallProgress = calculateProgress(allItems);

  // Update line progress
  const handleUpdateProgress = async () => {
    if (!editingItem || !selectedEstimate) return;
    setSaving(true);
    try {
      const newActualAmount = parseFloat(completedQty) || 0;

      await constructionService.updateEstimateLine(selectedEstimate.id, editingItem.id, {
        actual_amount: newActualAmount
      });

      // Refresh lines
      const lines = await constructionService.listEstimateLines(selectedEstimate.id);
      setEstimateLines(lines || []);

      // Update allItems
      setAllItems(prev => prev.map(item =>
        item.id === editingItem.id
          ? { ...item, actual_amount: newActualAmount }
          : item
      ));

      setEditingItem(null);
      setCompletedQty('');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error updating progress:', error);
    } finally {
      setSaving(false);
    }
  };

  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 75) return 'bg-blue-500';
    if (percent >= 50) return 'bg-yellow-500';
    if (percent >= 25) return 'bg-orange-500';
    return 'bg-slate-300';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (estimates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('work_progress') || 'Ish bajarilishi'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FolderTree className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_sections_for_progress') || "Progress kuzatish uchun avval smeta bo'limlarini yarating"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-blue-800">{t('overall_progress') || 'Umumiy bajarilish'}</h3>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-900 mb-2">{overallProgress.percent}%</div>
            <Progress value={overallProgress.percent} className="h-2 mb-2" />
            <p className="text-xs text-blue-700">
              {t('by_quantity') || "Hajm bo'yicha"}: {overallProgress.completed.toFixed(1)} / {overallProgress.total.toFixed(1)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-green-800">{t('progress_by_value') || "Qiymat bo'yicha"}</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-900 mb-2">{overallProgress.byValue}%</div>
            <Progress value={overallProgress.byValue} className="h-2 mb-2" />
            <p className="text-xs text-green-700">
              {formatCurrency(overallProgress.completedValue)} / {formatCurrency(overallProgress.totalValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-purple-800">{t('work_items') || 'Ish bandlari'}</h3>
              <ClipboardList className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-purple-900 mb-2">{allItems.length}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-600" />
                {allItems.filter(i => i.completed_quantity >= i.quantity).length} {t('completed') || 'bajarilgan'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-orange-600" />
                {allItems.filter(i => i.completed_quantity > 0 && i.completed_quantity < i.quantity).length} {t('in_progress') || 'jarayonda'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress by Estimate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('progress_by_section') || "Smetalar bo'yicha progress"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {estimates.map((est) => {
              const progress = getEstimateProgress(est.id);
              const isSelected = selectedEstimate?.id === est.id;
              return (
                <div
                  key={est.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  onClick={() => setSelectedEstimate(isSelected ? null : est)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">{est.code}</span>
                      <span className="font-medium text-slate-800">{est.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">{progress.percent}%</span>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full transition-all ${getProgressColor(progress.percent)}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>{progress.completed.toFixed(1)} / {progress.total.toFixed(1)} ({t('quantity') || 'hajm'})</span>
                    <span>{formatCurrency(progress.completedValue)} / {formatCurrency(progress.totalValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Estimate Lines Detail */}
      {selectedEstimate && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selectedEstimate.name} - {t('items') || 'Ishlar'}
            </CardTitle>
            <Badge variant="outline">
              {estimateLines.length} {t('items') || 'ta'}
            </Badge>
          </CardHeader>
          <CardContent>
            {estimateLines.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {t('no_items_in_section') || "Bu smetada qatorlar yo'q"}
              </div>
            ) : (
              <div className="space-y-3">
                {estimateLines.map((item) => {
                  const itemProgress = item.total_amount > 0
                    ? Math.round(((item.actual_amount || 0) / item.total_amount) * 100)
                    : 0;
                  const isEditing = editingItem?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.wbs_code && (
                              <span className="text-xs font-mono text-slate-500">{item.wbs_code}</span>
                            )}
                            <Badge className={`text-xs ${getStatusColor(itemProgress >= 100 ? 'completed' : itemProgress > 0 ? 'in_progress' : 'pending')}`}>
                              {itemProgress >= 100 ? (t('completed') || 'Bajarilgan')
                                : itemProgress > 0 ? (t('in_progress') || 'Jarayonda')
                                : (t('pending') || 'Kutilmoqda')}
                            </Badge>
                          </div>
                          <p className="font-medium text-slate-800 truncate">{item.name}</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {item.quantity} {item.uom} × {formatCurrency(item.unit_rate || 0)} = {formatCurrency(item.total_amount || 0)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-800">{itemProgress}%</p>
                            <p className="text-xs text-slate-500">
                              {formatCurrency(item.actual_amount || 0)} / {formatCurrency(item.total_amount || 0)}
                            </p>
                          </div>
                          {!isEditing ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingItem(item);
                                setCompletedQty(item.actual_amount?.toString() || '0');
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              {t('update') || 'Yangilash'}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={completedQty}
                                onChange={(e) => setCompletedQty(e.target.value)}
                                className="w-24 h-8 text-sm"
                                min="0"
                                max={item.total_amount}
                                step="0.01"
                              />
                              <Button
                                size="sm"
                                onClick={handleUpdateProgress}
                                disabled={saving}
                              >
                                {saving ? '...' : (t('save') || 'Saqlash')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingItem(null);
                                  setCompletedQty('');
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`absolute left-0 top-0 h-full transition-all ${getProgressColor(itemProgress)}`}
                            style={{ width: `${itemProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Tab Components
const ProjectsTab = ({
  projects,
  loading,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onViewProject,
  onStatusChange,
  getStatusBadge,
  formatCurrency,
  t,
  PROJECT_STATUS
}) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'kanban'

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.client_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader className="border-b border-slate-200/60 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-slate-800">
          {t('construction_projects') || 'Qurilish loyihalari'}
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('kanban')}
            >
              <Columns3 className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={onCreateProject} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
            <Plus className="w-4 h-4 mr-2" />
            {t('new_project') || 'Yangi loyiha'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Search and Filter - only show in grid view */}
        {viewMode === 'grid' && (
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t('search_projects') || 'Loyihalarni qidirish...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('all_statuses') || 'Barcha holatlar'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses') || 'Barcha holatlar'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                <SelectItem value="planning">{t('planning') || 'Rejalashtirish'}</SelectItem>
                <SelectItem value="in_progress">{t('in_progress') || 'Jarayonda'}</SelectItem>
                <SelectItem value="on_hold">{t('on_hold') || "To'xtatilgan"}</SelectItem>
                <SelectItem value="completed">{t('completed') || 'Tugallangan'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
        ) : viewMode === 'kanban' ? (
          /* Kanban View */
          <ProjectKanban
            projects={projects}
            onStatusChange={onStatusChange}
            onViewProject={onViewProject}
            onEditProject={onEditProject}
            formatCurrency={formatCurrency}
          />
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_projects') || 'Loyihalar topilmadi'}</p>
          </div>
        ) : (
          /* Grid View */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow border-slate-200 cursor-pointer" onClick={() => onViewProject(project)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{project.name}</h3>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                  {project.client_name && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <Users className="w-4 h-4" />
                      {project.client_name}
                    </div>
                  )}
                  {(project.city || project.region) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <MapPin className="w-4 h-4" />
                      {[project.city, project.region].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {project.contract_amount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                      <DollarSign className="w-4 h-4" />
                      {formatCurrency(project.contract_amount)}
                    </div>
                  )}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{t('progress') || 'Progress'}</span>
                      <span className="font-medium">{project.progress_percent || 0}%</span>
                    </div>
                    <Progress value={project.progress_percent || 0} className="h-2" />
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onEditProject(project); }}>
                      <Edit className="w-3 h-3 mr-1" />
                      {t('edit') || 'Tahrirlash'}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onViewProject(project); }}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Project Detail View with Sub-tabs
const ProjectDetailView = ({
  project,
  onBack,
  t,
  formatCurrency,
  getStatusBadge
}) => {
  const { formatCurrencyCompact } = useCurrencyFormatter();
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [sections, setSections] = useState([]);
  const [team, setTeam] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [photoReports, setPhotoReports] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [projectMaterials, setProjectMaterials] = useState([]);
  const [wbsTree, setWbsTree] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
const [showDailyLogModal, setShowDailyLogModal] = useState(false);
  const [showPhotoReportModal, setShowPhotoReportModal] = useState(false);
  const [showMaterialRequestModal, setShowMaterialRequestModal] = useState(false);

  // Import/Export modals
  const [showBuildingImportModal, setShowBuildingImportModal] = useState(false);
  const [showBuildingExportModal, setShowBuildingExportModal] = useState(false);

  // Forms
  const [buildingForm, setBuildingForm] = useState({
    name: '', code: '', description: '', building_type: '', building_purpose: '',
    floors_count: '', total_area: '', apartments_count: '', estimated_cost: '',
    status: 'draft'
  });
  const [teamForm, setTeamForm] = useState({ employee_id: '', role: '', responsibilities: '', start_date: '' });
  const [materialRequestForm, setMaterialRequestForm] = useState({
    id: null, request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft', items: []
  });
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [inventoryWarehouses, setInventoryWarehouses] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [confirmApprove, setConfirmApprove] = useState({ open: false, requestId: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, onConfirm: null });
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [dailyLogForm, setDailyLogForm] = useState({
    id: null,
    report_date: new Date().toISOString().split('T')[0],
    weather_morning: '', weather_afternoon: '',
    temperature_min: '', temperature_max: '',
    work_summary: '', issues_encountered: '', safety_notes: '',
    workers_count: '', workers_details: '', equipment_used: '', materials_received: ''
  });
  const [selectedDailyLog, setSelectedDailyLog] = useState(null);
  const [showDailyLogViewModal, setShowDailyLogViewModal] = useState(false);
  const [photoReportForm, setPhotoReportForm] = useState({
    report_date: new Date().toISOString().split('T')[0],
    report_type: 'progress',
    title: '',
    description: '',
    location_description: '',
    weather: '',
    temperature: ''
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreview, setPhotoPreview] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [dailyLogFiles, setDailyLogFiles] = useState([]);
  const [dailyLogPhotoPreview, setDailyLogPhotoPreview] = useState([]);
  const [uploadingDailyLog, setUploadingDailyLog] = useState(false);

  // Building export/import columns
  const buildingExportColumns = [
    { key: 'name', label: t('building_name') || 'Bino nomi' },
    { key: 'description', label: t('description') || 'Tavsif' },
    { key: 'building_type', label: t('building_type') || 'Bino turi' },
    { key: 'building_purpose', label: t('building_purpose') || 'Maqsad' },
    { key: 'floors_count', label: t('floors_count') || 'Qavatlar soni' },
    { key: 'total_area', label: t('total_area') || 'Umumiy maydon (m²)' },
    { key: 'apartments_count', label: t('apartments_count') || 'Xonadonlar soni' },
    { key: 'estimated_cost', label: t('estimated_cost') || 'Taxminiy narx', render: (v) => formatCurrency(v || 0) },
    { key: 'status', label: t('status') || 'Holat' },
    { key: 'progress_percent', label: t('progress') || 'Progress (%)' },
  ];

  const buildingImportColumns = [
    { key: 'name', label: t('building_name') || 'Bino nomi', required: true },
    { key: 'description', label: t('description') || 'Tavsif' },
    { key: 'building_type', label: t('building_type') || 'Bino turi' },
    { key: 'building_purpose', label: t('building_purpose') || 'Maqsad' },
    { key: 'floors_count', label: t('floors_count') || 'Qavatlar soni' },
    { key: 'total_area', label: t('total_area') || 'Umumiy maydon (m²)' },
    { key: 'apartments_count', label: t('apartments_count') || 'Xonadonlar soni' },
    { key: 'estimated_cost', label: t('estimated_cost') || 'Taxminiy narx' },
  ];


  // Handle building import
  const handleBuildingImport = async (data) => {
    try {
      for (const row of data) {
        const buildingData = {
          name: row.name,
          description: row.description || '',
          building_type: row.building_type || '',
          building_purpose: row.building_purpose || '',
          floors_count: row.floors_count ? parseInt(row.floors_count, 10) : 0,
          total_area: row.total_area ? parseFloat(row.total_area) : 0,
          apartments_count: row.apartments_count ? parseInt(row.apartments_count, 10) : 0,
          estimated_cost: row.estimated_cost ? parseFloat(row.estimated_cost) : 0,
        };
        await constructionService.createBuilding(project.id, buildingData);
      }
      // Reload buildings
      const buildingsData = await constructionService.listBuildings(project.id);
      setBuildings(buildingsData || []);
      setShowBuildingImportModal(false);
    } catch (error) {
      console.error('Error importing buildings:', error);
    }
  };


  // Load data based on active tab
  useEffect(() => {
    if (!project?.id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        switch (activeSubTab) {
          case 'overview':
            try {
              const [buildingsData, overviewSectionsData, overviewTeamData, overviewVendorsData] = await Promise.all([
                constructionService.listBuildings(project.id),
                constructionService.listSections(project.id),
                constructionService.listTeamMembers(project.id),
                constructionService.listProjectVendors(project.id)
              ]);
              setBuildings(buildingsData || []);
              setSections(overviewSectionsData || []);
              setTeam(overviewTeamData || []);
              setVendors(overviewVendorsData || []);
            } catch (e) {
              console.error('Error loading overview data:', e);
            }
            break;
          case 'buildings':
            try {
              const [buildingsData, wbsData] = await Promise.all([
                constructionService.listBuildings(project.id),
                constructionService.getWBSTree(project.id)
              ]);
              setBuildings(buildingsData || []);
              setWbsTree(wbsData || []);
            } catch (e) { setBuildings([]); setWbsTree([]); }
            break;
          case 'team':
            try {
              const [teamData, employeesData] = await Promise.all([
                constructionService.listTeamMembers(project.id),
                hrService.listEmployees({ limit: 200 })
              ]);
              setTeam(teamData || []);
              setEmployees(employeesData?.items || employeesData || []);
            } catch (e) { setTeam([]); setEmployees([]); }
            break;
          case 'daily_logs':
            try {
              const logsData = await constructionService.listDailyReports(project.id);
              setDailyLogs(logsData || []);
            } catch (e) {
              console.error('Error loading daily logs:', e);
              setDailyLogs([]);
            }
            break;
          case 'photo_reports':
            try {
              const photosData = await constructionService.listPhotoReports(project.id);
              setPhotoReports(photosData || []);
            } catch (e) { setPhotoReports([]); }
            break;
          case 'materials':
            try {
              const [materialsData, productsData, warehousesData, projMatsData] = await Promise.all([
                constructionService.listMaterialRequests(project.id),
                inventoryService.listProducts({ limit: 500, is_stockable: true }),
                inventoryService.listWarehouses({ limit: 100 }),
                constructionService.listProjectMaterials(project.id)
              ]);
              setMaterialRequests(materialsData || []);
              setInventoryProducts(productsData?.items || productsData || []);
              setInventoryWarehouses(warehousesData?.items || warehousesData || []);
              setProjectMaterials(projMatsData || []);
            } catch (e) { setMaterialRequests([]); }
            break;
          case 'estimates':
          case 'daily_journal':
            try {
              const [estBuildings, estWbs] = await Promise.all([
                constructionService.listBuildings(project.id),
                constructionService.getWBSTree(project.id),
              ]);
              setBuildings(estBuildings || []);
              setWbsTree(estWbs || []);
            } catch (e) { setWbsTree([]); }
            break;
          case 'progress':
            try {
              const progressSections = await constructionService.listSections(project.id);
              setSections(progressSections || []);
            } catch (e) { setSections([]); }
            break;
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [project?.id, activeSubTab]);


  // Handle building creation/update
  const handleCreateBuilding = async (e) => {
    e.preventDefault();
    try {
      const autoCode = buildingForm.code ||
        buildingForm.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 20) ||
        'BUILDING';
      const formData = {
        ...buildingForm,
        code: autoCode,
        floors_count: buildingForm.floors_count ? parseInt(buildingForm.floors_count, 10) : 0,
        total_area: buildingForm.total_area ? parseFloat(buildingForm.total_area) : 0,
        apartments_count: buildingForm.apartments_count ? parseInt(buildingForm.apartments_count, 10) : 0,
        estimated_cost: buildingForm.estimated_cost ? parseFloat(buildingForm.estimated_cost) : 0,
      };

      if (buildingForm.id) {
        // Update existing building
        await constructionService.updateBuilding(project.id, buildingForm.id, formData);
      } else {
        // Create new building
        await constructionService.createBuilding(project.id, formData);
      }

      const buildingsData = await constructionService.listBuildings(project.id);
      setBuildings(buildingsData || []);
      setShowBuildingModal(false);
      setBuildingForm({
        name: '', code: '', description: '', building_type: '', building_purpose: '',
        floors_count: '', total_area: '', apartments_count: '', estimated_cost: '',
        status: 'draft'
      });
    } catch (error) {
      console.error('Error saving building:', error);
    }
  };


  // Handle team member creation
  const handleCreateTeamMember = async (e) => {
    e.preventDefault();
    try {
      await constructionService.addTeamMember(project.id, teamForm);
      const teamData = await constructionService.listTeamMembers(project.id);
      setTeam(teamData || []);
      setShowTeamModal(false);
      setTeamForm({ employee_id: '', role: '', responsibilities: '', start_date: '' });
    } catch (error) {
      console.error('Error adding team member:', error);
    }
  };

  // Handle team member removal
  const handleRemoveTeamMember = async (memberId) => {
    if (!confirm(t('confirm_remove_member') || "Jamoa a'zosini o'chirmoqchimisiz?")) return;
    try {
      await constructionService.removeTeamMember(project.id, memberId);
      const teamData = await constructionService.listTeamMembers(project.id);
      setTeam(teamData || []);
    } catch (error) {
      console.error('Error removing team member:', error);
    }
  };

  // Handle material request creation/update
  const handleCreateMaterialRequest = async (e) => {
    e.preventDefault();
    try {
      const requestData = {
        request_date: materialRequestForm.request_date,
        required_date: materialRequestForm.required_date,
        notes: materialRequestForm.notes,
        items: materialRequestForm.items
      };

      if (materialRequestForm.id) {
        await constructionService.updateMaterialRequest(materialRequestForm.id, requestData);
      } else {
        await constructionService.createMaterialRequest(project.id, requestData);
      }
      const materialsData = await constructionService.listMaterialRequests(project.id);
      setMaterialRequests(materialsData || []);
      setShowMaterialRequestModal(false);
      setMaterialRequestForm({
        id: null, request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft', items: []
      });
    } catch (error) {
      console.error('Error saving material request:', error);
    }
  };

  // Add a blank item line to the material request form
  const addMaterialRequestItem = () => {
    setMaterialRequestForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', variant_id: '', warehouse_id: '', quantity: 1, unit_cost: 0, product_name: '', unit_name: '' }]
    }));
  };

  // Update a specific item field
  const updateMaterialRequestItem = async (index, field, value) => {
    setMaterialRequestForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      if (field === 'product_id') {
        const product = inventoryProducts.find(p => p.id === value);
        if (product) {
          items[index].product_name = product.name;
          items[index].unit_name = product.unit_name || product.uom_name || '';
          items[index].unit_cost = product.cost_price || 0;
          items[index].variant_id = ''; // reset variant when product changes
          // Load variants if needed
          if (product.has_variants && !variantsByProduct[value]) {
            inventoryService.listProductVariants(value).then(variants => {
              setVariantsByProduct(prev2 => ({ ...prev2, [value]: variants || [] }));
            });
          }
        }
      }

      if (field === 'variant_id') {
        const productId = items[index].product_id;
        const variants = variantsByProduct[productId] || [];
        const variant = variants.find(v => v.id === value);
        if (variant) {
          // Use variant cost_price if set, otherwise keep product's
          if (variant.cost_price && variant.cost_price > 0) {
            items[index].unit_cost = variant.cost_price;
          }
          items[index].variant_name = variant.variant_name || variant.display_name || '';
        }
      }

      return { ...prev, items };
    });
  };

  // Remove an item line
  const removeMaterialRequestItem = (index) => {
    setMaterialRequestForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Confirm/Approve a material request
  const handleApproveMaterialRequest = (requestId) => {
    setConfirmApprove({ open: true, requestId });
  };

  const doApproveMaterialRequest = async () => {
    const requestId = confirmApprove.requestId;
    setConfirmApprove({ open: false, requestId: null });
    try {
      await constructionService.approveMaterialRequest(requestId, {});
      const [materialsData, projMatsData] = await Promise.all([
        constructionService.listMaterialRequests(project.id),
        constructionService.listProjectMaterials(project.id)
      ]);
      setMaterialRequests(materialsData || []);
      setProjectMaterials(projMatsData || []);
    } catch (error) {
      console.error('Error approving material request:', error);
    }
  };

  // Handle daily log photo selection
  const handleDailyLogPhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const newFiles = files.slice(0, 10 - dailyLogPhotoPreview.length);
    setDailyLogFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDailyLogPhotoPreview(prev => [...prev, { file, preview: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle daily log photo removal
  const handleRemoveDailyLogPhoto = (index) => {
    const item = dailyLogPhotoPreview[index];
    if (typeof item !== 'string') {
      const existingCount = dailyLogPhotoPreview.filter(p => typeof p === 'string').length;
      const newFileIndex = index - existingCount;
      if (newFileIndex >= 0) setDailyLogFiles(prev => prev.filter((_, i) => i !== newFileIndex));
    }
    setDailyLogPhotoPreview(prev => prev.filter((_, i) => i !== index));
  };

  // Handle daily log creation/update
  const handleCreateDailyLog = async (e) => {
    e.preventDefault();
    setUploadingDailyLog(true);

    // Upload new photos first
    const uploadedPhotos = [];
    for (const file of dailyLogFiles) {
      try {
        const uploadResult = await Integrations.UploadFile(file);
        uploadedPhotos.push({ url: uploadResult.url, filename: file.name, size: file.size, type: file.type });
      } catch (uploadError) {
        console.error('Error uploading photo:', uploadError);
      }
    }

    // Combine existing photos with newly uploaded ones
    const existingPhotos = dailyLogPhotoPreview
      .filter(p => typeof p === 'string')
      .map(url => {
        const relativeUrl = url.replace(/^https?:\/\/[^/]+/, '');
        return { url: relativeUrl, filename: 'existing', size: 0, type: 'image/jpeg' };
      });
    const allPhotos = [...existingPhotos, ...uploadedPhotos];

    const logData = {
      report_date: dailyLogForm.report_date,
      weather_morning: dailyLogForm.weather_morning,
      weather_afternoon: dailyLogForm.weather_afternoon,
      temperature_min: parseFloat(dailyLogForm.temperature_min) || 0,
      temperature_max: parseFloat(dailyLogForm.temperature_max) || 0,
      work_summary: dailyLogForm.work_summary,
      issues_encountered: dailyLogForm.issues_encountered,
      safety_notes: dailyLogForm.safety_notes,
      workers_count: parseInt(dailyLogForm.workers_count) || 0,
      workers_details: dailyLogForm.workers_details,
      equipment_used: dailyLogForm.equipment_used,
      materials_received: dailyLogForm.materials_received,
      photos: allPhotos
    };

    try {
      if (dailyLogForm.id) {
        await constructionService.updateDailyReport(dailyLogForm.id, logData);
      } else {
        await constructionService.createDailyReport(project.id, logData);
      }
    } catch (error) {
      console.error('Error saving daily log:', error);
      toast.error(error?.response?.data?.message || 'Failed to save daily log');
      setUploadingDailyLog(false);
      return;
    }

    setUploadingDailyLog(false);
    // Close modal and reset form immediately after successful save
    setShowDailyLogModal(false);
    setDailyLogForm({
      id: null,
      report_date: new Date().toISOString().split('T')[0],
      weather_morning: '', weather_afternoon: '',
      temperature_min: '', temperature_max: '',
      work_summary: '', issues_encountered: '', safety_notes: '',
      workers_count: '', workers_details: '', equipment_used: '', materials_received: ''
    });
    setDailyLogFiles([]);
    setDailyLogPhotoPreview([]);

    // Refresh list separately
    try {
      const logsData = await constructionService.listDailyReports(project.id);
      setDailyLogs(logsData || []);
    } catch (error) {
      console.error('Error refreshing daily logs:', error);
    }
  };

  // Handle photo file selection
  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limit to 10 photos
    const newFiles = files.slice(0, 10 - photoFiles.length);
    setPhotoFiles(prev => [...prev, ...newFiles]);

    // Create previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(prev => [...prev, { file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove photo from selection
  const handleRemovePhoto = (index) => {
    // Check if removing an existing photo (string URL) or new upload (object)
    const item = photoPreview[index];
    const isExisting = typeof item === 'string';

    if (!isExisting) {
      // For new uploads, also remove from photoFiles
      // Find the corresponding file index (new uploads start after existing photos)
      const existingCount = photoPreview.filter(p => typeof p === 'string').length;
      const newFileIndex = index - existingCount;
      if (newFileIndex >= 0) {
        setPhotoFiles(prev => prev.filter((_, i) => i !== newFileIndex));
      }
    }

    setPhotoPreview(prev => prev.filter((_, i) => i !== index));
  };

  // Handle photo report creation or update
  const handleCreatePhotoReport = async (e) => {
    e.preventDefault();
    try {
      setUploadingPhotos(true);

      // Upload new photos first
      const uploadedPhotos = [];
      for (const file of photoFiles) {
        try {
          const uploadResult = await Integrations.UploadFile(file);
          uploadedPhotos.push({
            url: uploadResult.url,
            filename: file.name,
            size: file.size,
            type: file.type
          });
        } catch (uploadError) {
          console.error('Error uploading photo:', uploadError);
        }
      }

      // Combine existing photos (from preview) with newly uploaded ones
      // photoPreview contains full URLs of existing photos when editing
      const existingPhotos = photoReportForm.id ? photoPreview
        .filter(p => typeof p === 'string' && p.includes('/api/v1/files/'))
        .map(fullUrl => {
          // Extract the relative URL part (/api/v1/files/xxx)
          const match = fullUrl.match(/\/api\/v1\/files\/[a-f0-9]+/);
          const relativeUrl = match ? match[0] : fullUrl;
          return { url: relativeUrl, filename: 'existing', size: 0, type: 'image/jpeg' };
        }) : [];
      const allPhotos = [...existingPhotos, ...uploadedPhotos];

      const reportData = {
        report_date: photoReportForm.report_date,
        report_type: photoReportForm.report_type,
        title: photoReportForm.title,
        description: photoReportForm.description,
        location_description: photoReportForm.location_description,
        weather: photoReportForm.weather,
        temperature: parseFloat(photoReportForm.temperature) || 0,
        photos: allPhotos
      };

      if (photoReportForm.id) {
        // Update existing photo report
        await constructionService.updatePhotoReport(photoReportForm.id, reportData);
      } else {
        // Create new photo report
        await constructionService.createPhotoReport(project.id, reportData);
      }

      const photosData = await constructionService.listPhotoReports(project.id);
      setPhotoReports(photosData || []);
      setShowPhotoReportModal(false);
      setPhotoReportForm({
        report_date: new Date().toISOString().split('T')[0],
        report_type: 'progress',
        title: '',
        description: '',
        location_description: '',
        weather: '',
        temperature: ''
      });
      setPhotoFiles([]);
      setPhotoPreview([]);
    } catch (error) {
      console.error('Error saving photo report:', error);
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Helper to get full URL for file
  const getFileUrl = (url) => {
    if (!url) return '';
    // If it's already a full URL (data: or http), return as is
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    // Build full URL from API base
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
    // Remove /api/v1 from base if the url already starts with /api/v1
    if (url.startsWith('/api/v1/')) {
      return apiBase.replace('/api/v1', '') + url;
    }
    return apiBase.replace('/api/v1', '') + url;
  };

  // Extract string value from a JSONB field that the backend stores as [{key: "value"}]
  const jsonbFieldToString = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      return val.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return Object.values(item).join(', ');
        return String(item);
      }).join('; ');
    }
    if (typeof val === 'object') return Object.values(val).join(', ');
    return String(val);
  };

  // Helper to parse photos from report (handles both array and JSON string)
  const parsePhotos = (photos) => {
    if (!photos) return [];
    if (Array.isArray(photos)) return photos;
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Handle view photo report
  const handleViewPhotoReport = (report) => {
    const photos = parsePhotos(report.photos);
    setPhotoReportForm({
      id: report.id,
      report_date: report.report_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      report_type: report.report_type || 'progress',
      title: report.title || '',
      description: report.description || '',
      location_description: report.location_description || '',
      weather: report.weather || '',
      temperature: report.temperature || ''
    });
    // Convert relative URLs to full URLs for display
    setPhotoPreview(photos.map(p => getFileUrl(p.url || p)));
    setShowPhotoReportModal(true);
  };

  // Handle edit photo report
  const handleEditPhotoReport = (report) => {
    const photos = parsePhotos(report.photos);
    setPhotoReportForm({
      id: report.id,
      report_date: report.report_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      report_type: report.report_type || 'progress',
      title: report.title || '',
      description: report.description || '',
      location_description: report.location_description || '',
      weather: report.weather || '',
      temperature: report.temperature || ''
    });
    // Convert relative URLs to full URLs for display
    setPhotoPreview(photos.map(p => getFileUrl(p.url || p)));
    setPhotoFiles([]);
    setShowPhotoReportModal(true);
  };

  // Handle delete photo report
  const handleDeletePhotoReport = (reportId) => {
    setConfirmDelete({
      open: true,
      onConfirm: async () => {
        try {
          await constructionService.deletePhotoReport(reportId);
          const photosData = await constructionService.listPhotoReports(project.id);
          setPhotoReports(photosData || []);
        } catch (error) {
          console.error('Error deleting photo report:', error);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
            {getStatusBadge(project.status)}
          </div>
        </div>
        <ReportGenerator
          project={project}
          sections={sections}
          items={[]}
          buildings={buildings}
        />
        <Button variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          {t('settings') || 'Sozlamalar'}
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="bg-white border border-slate-200 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Eye className="w-4 h-4 mr-2" />
            {t('overview') || 'Umumiy'}
          </TabsTrigger>
          <TabsTrigger value="buildings" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Building2 className="w-4 h-4 mr-2" />
            {t('buildings') || 'Binolar'}
          </TabsTrigger>
          <TabsTrigger value="estimates" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {t('estimates') || 'Smetalar'}
          </TabsTrigger>
          <TabsTrigger value="daily_journal" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Receipt className="w-4 h-4 mr-2" />
            {t('daily_journal') || 'Kunlik jurnal (WBS)'}
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            {t('team') || 'Jamoa'}
          </TabsTrigger>
<TabsTrigger value="materials" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Package className="w-4 h-4 mr-2" />
            {t('materials') || 'Materiallar'}
          </TabsTrigger>
          <TabsTrigger value="daily_logs" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            {t('daily_logs') || 'Kunlik jurnal'}
          </TabsTrigger>
          <TabsTrigger value="progress" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Layers className="w-4 h-4 mr-2" />
            {t('progress_visualization') || 'Jarayon'}
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-2" />
            {t('activity') || 'Faoliyat'}
          </TabsTrigger>
          <TabsTrigger value="stages" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Layers className="w-4 h-4 mr-2" />
            {t('stages') || 'Bosqichlar'}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Receipt className="w-4 h-4 mr-2" />
            {t('expenses') || 'Xarajatlar'}
          </TabsTrigger>
          <TabsTrigger value="budget" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            {t('budget_plan_actual') || 'Byudjet (reja/fakt)'}
          </TabsTrigger>
          <TabsTrigger value="material_usage" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Package className="w-4 h-4 mr-2" />
            {t('material_usage') || 'Material sarfi'}
          </TabsTrigger>
<TabsTrigger value="subcontractors" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <HardHat className="w-4 h-4 mr-2" />
            {t('subcontractors') || 'Pudratchilar'}
          </TabsTrigger>
          <TabsTrigger value="acts" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            {t('acts') || 'Aktlar'}
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            {t('financial_analysis') || 'Moliyaviy tahlil'}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Progress Widget - Full width on small screens */}
            <div className="lg:col-span-1">
              <ProgressWidget project={{
                ...project,
                buildings_count: buildings.length,
                sections_count: sections.length,
                team_count: team.length
              }} />
            </div>

            {/* Financial Widget */}
            <FinancialWidget
              project={{
                ...project,
                total_smeta: sections.reduce((sum, s) => sum + (parseFloat(s.total_cost) || 0), 0)
              }}
              formatCurrency={formatCurrencyCompact}
            />

            {/* Timeline Widget */}
            <TimelineWidget project={project} />

            {/* Project Info Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('project_info') || 'Loyiha ma\'lumotlari'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{t('client_name') || 'Mijoz'}</p>
                    <p className="font-medium">{project.client_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('client_phone') || 'Telefon'}</p>
                    <p className="font-medium">{project.client_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('location') || 'Manzil'}</p>
                    <p className="font-medium">{[project.address, project.city, project.region].filter(Boolean).join(', ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('project_type') || 'Loyiha turi'}</p>
                    <p className="font-medium">{project.project_type ? (t(project.project_type) || project.project_type) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('building_type') || 'Bino turi'}</p>
                    <p className="font-medium">{project.building_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('total_area') || 'Umumiy maydon'}</p>
                    <p className="font-medium">{project.total_area ? `${project.total_area} m²` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('team') || 'Jamoa'}</p>
                    <p className="font-medium">{team.length} {t('members') || "a'zo"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alerts Widget */}
            <AlertsWidget
              project={{
                ...project,
                total_smeta: sections.reduce((sum, s) => sum + (parseFloat(s.total_cost) || 0), 0)
              }}
              sections={sections}
              vendors={vendors}
            />

          </div>
        </TabsContent>

        {/* Buildings Tab */}
        <TabsContent value="buildings" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle>{t('buildings_blocks') || 'Binolar / Bloklar'}</CardTitle>
              <div className="flex items-center gap-2">
                <ImportExportButtons
                  onImport={() => setShowBuildingImportModal(true)}
                  onExport={() => setShowBuildingExportModal(true)}
                  exportDisabled={buildings.length === 0}
                />
                <Button onClick={() => setShowBuildingModal(true)} size="sm" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add_building') || "Bino qo'shish"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="text-center py-8 text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
              ) : buildings.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">{t('no_buildings') || "Hozircha binolar yo'q"}</p>
                  <Button variant="link" onClick={() => setShowBuildingModal(true)} className="mt-2">
                    {t('add_first_building') || "Birinchi binoni qo'shing"}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {buildings.map((building) => (
                    <Card key={building.id} className="border hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-slate-800">{building.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={building.status === 'completed' ? 'bg-green-500' : building.status === 'in_progress' ? 'bg-orange-500' : 'bg-gray-500'}>
                              {t(building.status) || building.status}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setBuildingForm({
                                    id: building.id,
                                    name: building.name,
                                    code: building.code || '',
                                    description: building.description || '',
                                    building_type: building.building_type || '',
                                    building_purpose: building.building_purpose || '',
                                    floors_count: building.floors_count || '',
                                    total_area: building.total_area || '',
                                    apartments_count: building.apartments_count || '',
                                    estimated_cost: building.estimated_cost || '',
                                    status: building.status || 'draft'
                                  });
                                  setShowBuildingModal(true);
                                }}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  {t('edit') || 'Tahrirlash'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setConfirmDelete({
                                      open: true,
                                      onConfirm: async () => {
                                        try {
                                          await constructionService.deleteBuilding(project.id, building.id);
                                          const buildingsData = await constructionService.listBuildings(project.id);
                                          setBuildings(buildingsData || []);
                                        } catch (error) {
                                          console.error('Error deleting building:', error);
                                        }
                                      }
                                    });
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {t('delete') || "O'chirish"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('building_type') || 'Bino turi'}</span>
                            <span className="font-medium">{t(building.building_type) || building.building_type || building.building_purpose || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('floors_count') || 'Qavatlar soni'}</span>
                            <span className="font-medium">{building.floors_count || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('total_area') || 'Umumiy maydon'} (m²)</span>
                            <span className="font-medium">{building.total_area ? `${building.total_area} m²` : '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('apartments') || 'Xonadonlar'}</span>
                            <span className="font-medium">{building.apartments_count || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('estimated_cost') || 'Taxminiy narx'}</span>
                            <span className="font-medium">{building.estimated_cost ? formatCurrency(building.estimated_cost) : '-'}</span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-xs text-slate-500 mb-1">{t('progress') || 'Progress'}</p>
                          <Progress value={building.progress_percent || 0} className="h-2" />
                          <p className="text-xs text-right mt-1">{building.progress_percent || 0}%</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* WBS Tree */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('work_breakdown_structure') || 'Ishlar tuzilmasi (WBS)'}</CardTitle>
            </CardHeader>
            <CardContent>
              <WBSTree
                items={wbsTree}
                projectId={project.id}
                t={t}
                formatCurrency={formatCurrency}
                onCreateItem={async (projectId, data) => {
                  try {
                    await constructionService.createWBS(projectId, data);
                    const wbsData = await constructionService.getWBSTree(project.id);
                    setWbsTree(wbsData || []);
                  } catch (error) {
                    console.error('Error creating WBS item:', error);
                  }
                }}
                onUpdateItem={async (id, data) => {
                  try {
                    await constructionService.updateWBS(id, data);
                    const wbsData = await constructionService.getWBSTree(project.id);
                    setWbsTree(wbsData || []);
                  } catch (error) {
                    console.error('Error updating WBS item:', error);
                  }
                }}
                onDeleteItem={async (id) => {
                  try {
                    await constructionService.deleteWBS(id);
                    const wbsData = await constructionService.getWBSTree(project.id);
                    setWbsTree(wbsData || []);
                  } catch (error) {
                    console.error('Error deleting WBS item:', error);
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Estimates Tab */}
        <TabsContent value="estimates" className="mt-6">
          <EstimatesTab project={project} wbsItems={wbsTree} buildings={buildings} />
        </TabsContent>

        {/* Daily Journal Tab (WBS-linked progress) */}
        <TabsContent value="daily_journal" className="mt-6">
          <DailyJournalTab project={project} wbsItems={wbsTree} buildings={buildings} />
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('project_team') || 'Loyiha jamoasi'}</CardTitle>
              <Button onClick={() => setShowTeamModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                {t('add_member') || "A'zo qo'shish"}
              </Button>
            </CardHeader>
            <CardContent>
              {team.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_team_members') || "Jamoa a'zolari yo'q"}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowTeamModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('add_first_member') || "Birinchi a'zoni qo'shing"}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {team.map((member) => (
                    <Card key={member.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{member.employee_name || 'Xodim'}</h4>
                              <p className="text-sm text-slate-500">{member.position}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveTeamMember(member.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <Badge variant="secondary" className="mb-2">{t(member.role) || member.role}</Badge>
                          {member.responsibilities && (
                            <p className="text-sm text-slate-600 mt-1">{member.responsibilities}</p>
                          )}
                          {member.phone && (
                            <p className="text-xs text-slate-400 mt-2">{member.phone}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials" className="mt-6">
          <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('material_requests') || 'Material so\'rovlari'}</CardTitle>
                <Button size="sm" onClick={() => {
                  setMaterialRequestForm({
                    id: null, request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft', items: []
                  });
                  setShowMaterialRequestModal(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_request') || 'Yangi so\'rov'}
                </Button>
              </CardHeader>
              <CardContent>
                {materialRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">{t('no_material_requests') || 'So\'rovlar mavjud emas'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {materialRequests.map((req) => {
                      let items = [];
                      try {
                        items = Array.isArray(req.items) ? req.items : (typeof req.items === 'string' ? JSON.parse(req.items || '[]') : []);
                      } catch (_) { items = []; }
                      const totalCost = items.reduce((sum, it) => sum + (parseFloat(it.quantity || 0) * parseFloat(it.unit_cost || 0)), 0);
                      return (
                      <div key={req.id} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{req.request_number}</span>
                              <Badge className={
                                req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-slate-100 text-slate-700'
                              }>{t(req.status) || req.status}</Badge>
                            </div>
                            <div className="flex gap-4 mt-1 text-sm text-slate-500">
                              <span>{t('request_date') || 'Sana'}: {format(new Date(req.request_date), 'dd.MM.yyyy')}</span>
                              {req.required_date && (
                                <span>{t('required_date') || 'Kerakli sana'}: {format(new Date(req.required_date), 'dd.MM.yyyy')}</span>
                              )}
                            </div>
                            {items.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {items.map((item, i) => (
                                  <div key={i} className="text-xs text-slate-600 flex justify-between">
                                    <span>{item.product_name || item.product_id}</span>
                                    <span>{item.quantity} × {formatCurrency(item.unit_cost || 0)}</span>
                                  </div>
                                ))}
                                {totalCost > 0 && (
                                  <div className="text-xs font-medium text-slate-700 border-t pt-1 flex justify-between">
                                    <span>Total</span>
                                    <span>{formatCurrency(totalCost)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {req.delivery_name && (
                              <div className="mt-2 flex items-center gap-2 text-xs">
                                <Truck className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-500">{t('delivery') || 'Yetkazib berish'}:</span>
                                <span className="font-medium">{req.delivery_name}</span>
                                <Badge className={
                                  req.delivery_state === 'done' ? 'bg-green-100 text-green-700 text-xs' :
                                  req.delivery_state === 'in_progress' ? 'bg-blue-100 text-blue-700 text-xs' :
                                  req.delivery_state === 'cancelled' ? 'bg-red-100 text-red-700 text-xs' :
                                  'bg-slate-100 text-slate-700 text-xs'
                                }>{t(req.delivery_state) || req.delivery_state}</Badge>
                              </div>
                            )}
                            {req.notes && (
                              <p className="text-sm text-slate-600 mt-2">{req.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {req.status === 'draft' && (
                                  <DropdownMenuItem onClick={() => {
                                    let parsedItems = [];
                                    try { parsedItems = Array.isArray(req.items) ? req.items : (typeof req.items === 'string' ? JSON.parse(req.items || '[]') : []); } catch (_) {}
                                    setMaterialRequestForm({
                                      id: req.id,
                                      request_date: req.request_date ? req.request_date.split('T')[0] : new Date().toISOString().split('T')[0],
                                      required_date: req.required_date ? req.required_date.split('T')[0] : '',
                                      notes: req.notes || '',
                                      status: req.status || 'draft',
                                      items: parsedItems
                                    });
                                    setShowMaterialRequestModal(true);
                                  }}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    {t('edit') || 'Tahrirlash'}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setConfirmDelete({
                                      open: true,
                                      onConfirm: async () => {
                                        try {
                                          await constructionService.deleteMaterialRequest(req.id);
                                          const materialsData = await constructionService.listMaterialRequests(project.id);
                                          setMaterialRequests(materialsData || []);
                                        } catch (error) {
                                          console.error('Error deleting material request:', error);
                                        }
                                      }
                                    });
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {t('delete') || "O'chirish"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('deliveries') || 'Yetkazib berishlar'}</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const deliveries = materialRequests.filter(mr => mr.stock_operation_id && mr.delivery_name);
                  if (deliveries.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">{t('no_deliveries') || 'Yetkazib berishlar mavjud emas'}</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {deliveries.map(mr => (
                        <div key={mr.stock_operation_id} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-sm">{mr.delivery_name}</span>
                              <span className="text-xs text-slate-500 ml-2">← {mr.request_number}</span>
                            </div>
                            <Badge className={
                              mr.delivery_state === 'done' ? 'bg-green-100 text-green-700' :
                              mr.delivery_state === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              mr.delivery_state === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }>{t(mr.delivery_state) || mr.delivery_state}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t('confirm_in_stock_ops') || 'Confirmation is done through Stock Operations'}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Project Materials List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                {t('project_materials') || 'Loyiha materiallari'}
              </CardTitle>
              <p className="text-sm text-slate-500">{t('project_materials_desc') || 'Tasdiqlangan materiallar umumiy ro\'yxati'}</p>
            </CardHeader>
            <CardContent>
              {projectMaterials.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">{t('no_project_materials') || 'Hali hech qanday material tasdiqlanmagan'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-3 font-medium text-slate-600">{t('product')}</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-600">{t('uom')}</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">{t('approved_quantity')}</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">{t('used')}</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">{t('remaining')}</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">{t('unit_cost')}</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectMaterials.map((mat) => {
                        const assigned = mat.assigned_quantity || 0;
                        const remaining = mat.approved_quantity - assigned;
                        return (
                          <tr key={mat.id} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-medium">{mat.product_name}</td>
                            <td className="py-2 px-3 text-slate-500">{mat.uom}</td>
                            <td className="py-2 px-3 text-right">{Number(mat.approved_quantity).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-purple-600">{assigned > 0 ? Number(assigned).toFixed(2) : '-'}</td>
                            <td className={`py-2 px-3 text-right font-medium ${remaining < 0 ? 'text-red-600' : remaining === 0 ? 'text-slate-400' : 'text-green-600'}`}>
                              {Number(remaining).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right">{formatCurrency(mat.unit_cost)}</td>
                            <td className="py-2 px-3 text-right font-medium">{formatCurrency(mat.approved_quantity * mat.unit_cost)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={6} className="py-2 px-3 text-right">{t('total')}:</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(projectMaterials.reduce((s, m) => s + m.approved_quantity * m.unit_cost, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        {/* Daily Logs Tab */}
        <TabsContent value="daily_logs" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('daily_logs') || 'Kunlik jurnal'} ({dailyLogs.length})</CardTitle>
              <Button onClick={() => {
                setDailyLogForm({
                  id: null,
                  report_date: new Date().toISOString().split('T')[0],
                  weather_morning: '', weather_afternoon: '',
                  temperature_min: '', temperature_max: '',
                  work_summary: '', issues_encountered: '', safety_notes: '',
                  workers_count: '', workers_details: '', equipment_used: '', materials_received: ''
                });
                setShowDailyLogModal(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                {t('new_entry') || 'Yangi yozuv'}
              </Button>
            </CardHeader>
            <CardContent>
              {dailyLogs.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_daily_logs') || 'Kunlik yozuvlar mavjud emas'}</p>
                  <Button variant="outline" className="mt-4" onClick={() => {
                    setDailyLogForm({
                      id: null,
                      report_date: new Date().toISOString().split('T')[0],
                      weather_morning: '', weather_afternoon: '',
                      temperature_min: '', temperature_max: '',
                      work_summary: '', issues_encountered: '', safety_notes: '',
                      workers_count: '', workers_details: '', equipment_used: '', materials_received: ''
                    });
                    setShowDailyLogModal(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_first_entry') || 'Birinchi yozuvni qo\'shing'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dailyLogs.map((log) => (
                    <Card key={log.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{log.report_date ? format(new Date(log.report_date), 'dd.MM.yyyy') : '—'}</p>
                            </div>
                            {(log.weather_morning || log.weather_afternoon) && (
                              <p className="text-sm text-slate-500 mt-1">
                                {log.weather_morning && `${t('morning') || 'Ertalab'}: ${t(log.weather_morning) || log.weather_morning}`}
                                {log.weather_morning && log.weather_afternoon && ' | '}
                                {log.weather_afternoon && `${t('afternoon') || 'Kunduzi'}: ${t(log.weather_afternoon) || log.weather_afternoon}`}
                              </p>
                            )}
                            {(log.temperature_min || log.temperature_max) && (
                              <p className="text-sm text-slate-500">
                                {t('temperature') || 'Harorat'}: {log.temperature_min}°C - {log.temperature_max}°C
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedDailyLog(log);
                                setShowDailyLogViewModal(true);
                              }}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('view') || 'Ko\'rish'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setDailyLogForm({
                                  id: log.id,
                                  report_date: log.report_date ? new Date(log.report_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                  weather_morning: log.weather_morning || '',
                                  weather_afternoon: log.weather_afternoon || '',
                                  temperature_min: log.temperature_min || '',
                                  temperature_max: log.temperature_max || '',
                                  work_summary: log.work_summary || log.summary || '',
                                  issues_encountered: log.issues_encountered || '',
                                  safety_notes: log.safety_notes || '',
                                  workers_count: log.workers_count || '',
                                  workers_details: jsonbFieldToString(log.workers_details),
                                  equipment_used: jsonbFieldToString(log.equipment_used),
                                  materials_received: jsonbFieldToString(log.materials_received)
                                });
                                setDailyLogFiles([]);
                                setDailyLogPhotoPreview(parsePhotos(log.photos).map(p => getFileUrl(p.url || p)));
                                setShowDailyLogModal(true);
                              }}>
                                <Edit className="w-4 h-4 mr-2" />
                                {t('edit') || 'Tahrirlash'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setConfirmDelete({
                                    open: true,
                                    onConfirm: async () => {
                                      try {
                                        await constructionService.deleteDailyReport(log.id);
                                        const logsData = await constructionService.listDailyReports(project.id);
                                        setDailyLogs(logsData || []);
                                      } catch (error) {
                                        console.error('Error deleting daily log:', error);
                                      }
                                    }
                                  });
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete') || "O'chirish"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {log.work_summary && (
                          <p className="mt-3 text-sm text-slate-700 line-clamp-2">{log.work_summary}</p>
                        )}
                        <div className="flex gap-4 mt-3 text-sm text-slate-600">
                          <span><Users className="w-4 h-4 inline mr-1" />{log.workers_count || 0} {t('workers') || 'ishchi'}</span>
                        </div>
                        {(() => {
                          const photos = parsePhotos(log.photos);
                          return photos.length > 0 && (
                            <div className="flex gap-1 mt-3 overflow-hidden">
                              {photos.slice(0, 4).map((photo, idx) => (
                                <img
                                  key={idx}
                                  src={getFileUrl(photo.url || photo)}
                                  alt={`photo-${idx}`}
                                  className="w-14 h-14 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setLightboxSrc(getFileUrl(photo.url || photo))}
                                />
                              ))}
                              {photos.length > 4 && (
                                <div className="w-14 h-14 bg-slate-100 rounded-md flex items-center justify-center text-xs text-slate-500">
                                  +{photos.length - 4}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="mt-6">
          <ProgressTab project={project} />
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardContent className="p-6">
              <ActivityTab projectId={project.id} t={t} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stages Tab */}
        <TabsContent value="stages" className="mt-6">
          <StagesTab project={project} />
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-6">
          <ExpensesTab project={project} />
        </TabsContent>

        {/* Budget Plan vs Actual Tab */}
        <TabsContent value="budget" className="mt-6">
          <BudgetTab project={project} />
        </TabsContent>

        {/* Material Usage Tab */}
        <TabsContent value="material_usage" className="mt-6">
          <MaterialUsageTab project={project} />
        </TabsContent>

{/* Subcontractors Tab */}
        <TabsContent value="subcontractors" className="mt-6">
          <SubcontractorsTab project={project} />
        </TabsContent>

        {/* Acts (KS-2/KS-3) Tab */}
        <TabsContent value="acts" className="mt-6">
          <ActsTab project={project} />
        </TabsContent>

        {/* Financial Analysis Tab */}
        <TabsContent value="financial" className="mt-6">
          <FinancialTab project={project} />
        </TabsContent>
      </Tabs>

      {/* Building Modal */}
      <Dialog open={showBuildingModal} onOpenChange={setShowBuildingModal}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{buildingForm.id ? (t('edit_building') || "Binoni tahrirlash") : (t('new_building') || "Yangi bino")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBuilding} className="space-y-4">
            <div>
              <Label>{t('building_name') || 'Bino nomi'} *</Label>
              <Input
                value={buildingForm.name}
                onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                placeholder="A blok - Turar-joy"
                required
              />
            </div>
            <div>
              <Label>{t('description') || 'Tavsif'}</Label>
              <Textarea
                value={buildingForm.description}
                onChange={(e) => setBuildingForm({ ...buildingForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('building_type') || 'Bino turi'}</Label>
                <Select value={buildingForm.building_type} onValueChange={(v) => setBuildingForm({ ...buildingForm, building_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select') || 'Tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">{t('residential') || 'Turar-joy'}</SelectItem>
                    <SelectItem value="commercial">{t('commercial') || 'Tijorat'}</SelectItem>
                    <SelectItem value="parking">{t('parking') || 'Avtoturargoh'}</SelectItem>
                    <SelectItem value="mixed">{t('mixed') || 'Aralash'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('building_purpose') || 'Maqsad'}</Label>
                <Select value={buildingForm.building_purpose} onValueChange={(v) => setBuildingForm({ ...buildingForm, building_purpose: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select') || 'Tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="living">{t('living') || 'Yashash uchun'}</SelectItem>
                    <SelectItem value="non_living">{t('non_living') || 'Yashash uchun emas'}</SelectItem>
                    <SelectItem value="mixed">{t('mixed') || 'Aralash'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('floors_count') || 'Qavatlar soni'}</Label>
                <Input
                  type="number"
                  value={buildingForm.floors_count}
                  onChange={(e) => setBuildingForm({ ...buildingForm, floors_count: e.target.value })}
                  placeholder="16"
                />
              </div>
              <div>
                <Label>{t('total_area') || 'Umumiy maydon (m²)'}</Label>
                <Input
                  type="number"
                  value={buildingForm.total_area}
                  onChange={(e) => setBuildingForm({ ...buildingForm, total_area: e.target.value })}
                  placeholder="5000"
                />
              </div>
              <div>
                <Label>{t('apartments_count') || 'Xonadonlar soni'}</Label>
                <Input
                  type="number"
                  value={buildingForm.apartments_count}
                  onChange={(e) => setBuildingForm({ ...buildingForm, apartments_count: e.target.value })}
                  placeholder="64"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('estimated_cost') || 'Taxminiy narx'}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatPriceInput(buildingForm.estimated_cost)}
                  onChange={(e) => setBuildingForm({ ...buildingForm, estimated_cost: parsePriceInput(e.target.value) })}
                  placeholder="5000000000"
                />
              </div>
              {buildingForm.id && (
                <div>
                  <Label>{t('status') || 'Holat'}</Label>
                  <Select value={buildingForm.status} onValueChange={(v) => setBuildingForm({ ...buildingForm, status: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_status') || 'Holatni tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                      <SelectItem value="in_progress">{t('in_progress') || 'Jarayonda'}</SelectItem>
                      <SelectItem value="completed">{t('completed') || 'Tugallangan'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBuildingModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{buildingForm.id ? (t('update') || 'Yangilash') : (t('create') || 'Yaratish')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Building Import Modal */}
      <ImportModal
        open={showBuildingImportModal}
        onClose={() => setShowBuildingImportModal(false)}
        onImport={handleBuildingImport}
        columns={buildingImportColumns}
        entityName={t('buildings') || 'Binolar'}
        templateColumns={buildingImportColumns}
      />

      {/* Building Export Modal */}
      <ExportModal
        open={showBuildingExportModal}
        onClose={() => setShowBuildingExportModal(false)}
        data={buildings}
        columns={buildingExportColumns}
        entityName={t('buildings') || 'Binolar'}
        title={`${project.name} - ${t('buildings') || 'Binolar'}`}
      />


      {/* Team Member Modal */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('add_team_member') || "Jamoa a'zosini qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTeamMember} className="space-y-4">
            <div>
              <Label>{t('employee') || 'Xodim'} *</Label>
              <Select
                value={teamForm.employee_id}
                onValueChange={(value) => setTeamForm({ ...teamForm, employee_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_employee') || 'Xodimni tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} {emp.position ? `(${emp.position})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('role') || 'Vazifasi'} *</Label>
              <Select
                value={teamForm.role}
                onValueChange={(value) => setTeamForm({ ...teamForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_role') || 'Vazifani tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_manager">{t('project_manager') || 'Loyiha boshqaruvchisi'}</SelectItem>
                  <SelectItem value="chief_engineer">{t('chief_engineer') || 'Bosh muhandis'}</SelectItem>
                  <SelectItem value="site_engineer">{t('site_engineer') || 'Obyekt muhandisi'}</SelectItem>
                  <SelectItem value="foreman">{t('foreman') || 'Prораб'}</SelectItem>
                  <SelectItem value="quantity_surveyor">{t('quantity_surveyor') || 'Smetachi'}</SelectItem>
                  <SelectItem value="safety_officer">{t('safety_officer') || 'Xavfsizlik xodimi'}</SelectItem>
                  <SelectItem value="accountant">{t('accountant') || 'Hisobchi'}</SelectItem>
                  <SelectItem value="other">{t('other') || 'Boshqa'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('responsibilities') || "Mas'uliyatlari"}</Label>
              <Textarea
                value={teamForm.responsibilities}
                onChange={(e) => setTeamForm({ ...teamForm, responsibilities: e.target.value })}
                placeholder={t('responsibilities_placeholder') || "Xodimning asosiy mas'uliyatlari..."}
                rows={3}
              />
            </div>
            <div>
              <Label>{t('start_date') || 'Boshlanish sanasi'}</Label>
              <Input
                type="date"
                value={teamForm.start_date}
                onChange={(e) => setTeamForm({ ...teamForm, start_date: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTeamModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!teamForm.employee_id || !teamForm.role}>
                {t('add') || "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Material Request Modal */}
      <Dialog open={showMaterialRequestModal} onOpenChange={setShowMaterialRequestModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{materialRequestForm.id ? (t('edit_material_request') || "Material so'rovini tahrirlash") : (t('new_material_request') || "Yangi material so'rovi")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMaterialRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('request_date') || "So'rov sanasi"} *</Label>
                <Input
                  type="date"
                  value={materialRequestForm.request_date}
                  onChange={(e) => setMaterialRequestForm({ ...materialRequestForm, request_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>{t('required_date') || 'Kerak bo\'lgan sana'}</Label>
                <Input
                  type="date"
                  value={materialRequestForm.required_date}
                  onChange={(e) => setMaterialRequestForm({ ...materialRequestForm, required_date: e.target.value })}
                />
              </div>
            </div>

            {/* Product Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('materials') || 'Materiallar'}</Label>
                <Button type="button" size="sm" variant="outline" onClick={addMaterialRequestItem}>
                  <Plus className="w-3 h-3 mr-1" />
                  {t('add_item') || "Qo'shish"}
                </Button>
              </div>
              {materialRequestForm.items.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4 border rounded-lg">{t('no_items') || 'Material qo\'shilmagan'}</p>
              )}
              {materialRequestForm.items.length > 0 && (
                <div className="space-y-3 border rounded-lg p-3">
                  {materialRequestForm.items.map((item, index) => {
                    const product = inventoryProducts.find(p => p.id === item.product_id);
                    const productVariants = product?.has_variants ? (variantsByProduct[item.product_id] || []) : [];
                    return (
                      <div key={index} className="rounded-lg border bg-slate-50 p-3 space-y-3 pb-3">
                        {/* Row 1: Product + Variant + Delete */}
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <Select
                              value={item.product_id}
                              onValueChange={(val) => updateMaterialRequestItem(index, 'product_id', val)}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder={t('select_product') || 'Mahsulot'} />
                              </SelectTrigger>
                              <SelectContent>
                                {inventoryProducts.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} {p.code ? `(${p.code})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {product?.has_variants && (
                            <div className="flex-1 min-w-0">
                              <Select
                                value={item.variant_id}
                                onValueChange={(val) => updateMaterialRequestItem(index, 'variant_id', val)}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder={t('select_variant') || 'Variant'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {productVariants.map(v => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.display_name || v.variant_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-500 shrink-0" onClick={() => removeMaterialRequestItem(index)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Row 2: Warehouse | Qty + UOM | Price */}
                        <div className="grid grid-cols-3 gap-2">
                          <Select
                            value={item.warehouse_id}
                            onValueChange={(val) => updateMaterialRequestItem(index, 'warehouse_id', val)}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder={t('warehouse') || 'Ombor'} />
                            </SelectTrigger>
                            <SelectContent>
                              {inventoryWarehouses.map(w => (
                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              className="h-9 text-sm flex-1"
                              placeholder={t('qty') || 'Son'}
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => updateMaterialRequestItem(index, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            />
                            <span className="text-xs text-slate-500 whitespace-nowrap min-w-[30px]">{item.unit_name || product?.unit_name || t('pcs') || 'dona'}</span>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            className="h-9 text-sm"
                            placeholder={t('unit_price') || 'Narx'}
                            value={item.unit_cost === 0 ? '' : item.unit_cost}
                            onChange={(e) => updateMaterialRequestItem(index, 'unit_cost', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Total row */}
                  {materialRequestForm.items.length > 0 && (() => {
                    const total = materialRequestForm.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_cost) || 0), 0);
                    return total > 0 ? (
                      <div className="flex justify-between text-sm font-medium pt-1">
                        <span>{t('total') || 'Jami'}</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            <div>
              <Label>{t('notes') || 'Izohlar'}</Label>
              <Textarea
                value={materialRequestForm.notes}
                onChange={(e) => setMaterialRequestForm({ ...materialRequestForm, notes: e.target.value })}
                placeholder={t('notes_placeholder') || "Qo'shimcha ma'lumotlar..."}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMaterialRequestModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!materialRequestForm.request_date}>
                {materialRequestForm.id ? (t('save') || 'Saqlash') : (t('create') || 'Yaratish')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve Material Request Confirm */}
      <AlertDialog open={confirmApprove.open} onOpenChange={(open) => setConfirmApprove(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_approve_request')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_approve_request_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={doApproveMaterialRequest}>
              {t('confirm') || 'Tasdiqlash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Daily Log Modal */}
      <Dialog open={showDailyLogModal} onOpenChange={setShowDailyLogModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{dailyLogForm.id ? (t('edit_daily_log') || 'Kunlik hisobotni tahrirlash') : (t('new_daily_log') || 'Yangi kunlik hisobot')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDailyLog} className="space-y-4">
            <div>
              <Label>{t('report_date') || 'Hisobot sanasi'} *</Label>
              <Input
                type="date"
                value={dailyLogForm.report_date}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, report_date: e.target.value })}
                required
              />
            </div>

            {/* Weather Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm text-slate-700">{t('weather') || 'Ob-havo'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('weather_morning') || 'Ertalab'}</Label>
                  <Select
                    value={dailyLogForm.weather_morning}
                    onValueChange={(value) => setDailyLogForm({ ...dailyLogForm, weather_morning: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_weather') || 'Tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sunny">{t('sunny') || 'Quyoshli'}</SelectItem>
                      <SelectItem value="cloudy">{t('cloudy') || 'Bulutli'}</SelectItem>
                      <SelectItem value="rainy">{t('rainy') || 'Yomg\'irli'}</SelectItem>
                      <SelectItem value="snowy">{t('snowy') || 'Qorli'}</SelectItem>
                      <SelectItem value="windy">{t('windy') || 'Shamol'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('weather_afternoon') || 'Tushdan keyin'}</Label>
                  <Select
                    value={dailyLogForm.weather_afternoon}
                    onValueChange={(value) => setDailyLogForm({ ...dailyLogForm, weather_afternoon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_weather') || 'Tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sunny">{t('sunny') || 'Quyoshli'}</SelectItem>
                      <SelectItem value="cloudy">{t('cloudy') || 'Bulutli'}</SelectItem>
                      <SelectItem value="rainy">{t('rainy') || 'Yomg\'irli'}</SelectItem>
                      <SelectItem value="snowy">{t('snowy') || 'Qorli'}</SelectItem>
                      <SelectItem value="windy">{t('windy') || 'Shamol'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('temperature_min') || 'Min harorat (°C)'}</Label>
                  <Input
                    type="number"
                    value={dailyLogForm.temperature_min}
                    onChange={(e) => setDailyLogForm({ ...dailyLogForm, temperature_min: e.target.value })}
                    placeholder="-5"
                  />
                </div>
                <div>
                  <Label>{t('temperature_max') || 'Max harorat (°C)'}</Label>
                  <Input
                    type="number"
                    value={dailyLogForm.temperature_max}
                    onChange={(e) => setDailyLogForm({ ...dailyLogForm, temperature_max: e.target.value })}
                    placeholder="15"
                  />
                </div>
              </div>
            </div>

            {/* Work Summary */}
            <div>
              <Label>{t('work_summary') || 'Bajarilgan ishlar'}</Label>
              <Textarea
                value={dailyLogForm.work_summary}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, work_summary: e.target.value })}
                placeholder={t('work_summary_placeholder') || 'Bugun bajarilgan ishlar tavsifi...'}
                rows={3}
              />
            </div>

            {/* Workers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('workers_count') || 'Ishchilar soni'}</Label>
                <Input
                  type="number"
                  value={dailyLogForm.workers_count}
                  onChange={(e) => setDailyLogForm({ ...dailyLogForm, workers_count: e.target.value })}
                  placeholder="25"
                />
              </div>
              <div>
                <Label>{t('equipment_used') || 'Ishlatilgan texnika'}</Label>
                <Input
                  value={dailyLogForm.equipment_used}
                  onChange={(e) => setDailyLogForm({ ...dailyLogForm, equipment_used: e.target.value })}
                  placeholder="Ekskavator, kran..."
                />
              </div>
            </div>

            {/* Issues and Safety */}
            <div>
              <Label>{t('issues_encountered') || 'Yuzaga kelgan muammolar'}</Label>
              <Textarea
                value={dailyLogForm.issues_encountered}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, issues_encountered: e.target.value })}
                placeholder={t('issues_placeholder') || 'Muammolar bo\'lmasa, bo\'sh qoldiring...'}
                rows={2}
              />
            </div>
            <div>
              <Label>{t('safety_notes') || 'Xavfsizlik eslatmalari'}</Label>
              <Textarea
                value={dailyLogForm.safety_notes}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, safety_notes: e.target.value })}
                placeholder={t('safety_notes_placeholder') || 'Xavfsizlik bo\'yicha eslatmalar...'}
                rows={2}
              />
            </div>

            {/* Photo Upload Section */}
            <div>
              <Label>{t('photos') || 'Rasmlar'}</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 space-y-3">
                {/* Upload Area */}
                <label className="flex flex-col items-center cursor-pointer text-center">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-sm text-slate-500">{t('click_to_upload') || 'Rasmlarni yuklash uchun bosing'}</span>
                  <input
                    key={`daily-log-upload-${dailyLogForm.id || 'new'}`}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleDailyLogPhotoSelect}
                    disabled={dailyLogPhotoPreview.length >= 10}
                  />
                </label>
                {/* Photo Previews */}
                {dailyLogPhotoPreview.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {dailyLogPhotoPreview.map((item, index) => {
                      const src = typeof item === 'string' ? item : item.preview;
                      return (
                        <div key={index} className="relative group">
                          <img src={src} alt={`photo-${index}`} className="w-full h-16 object-cover rounded" />
                          <button
                            type="button"
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100"
                            onClick={() => handleRemoveDailyLogPhoto(index)}
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowDailyLogModal(false); setDailyLogFiles([]); setDailyLogPhotoPreview([]); }}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!dailyLogForm.report_date || uploadingDailyLog}>
                {uploadingDailyLog ? `${t('uploading') || 'Yuklanmoqda'}...` : dailyLogForm.id ? (t('save') || 'Saqlash') : (t('create') || 'Yaratish')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Photo Report Modal */}
      <Dialog open={showPhotoReportModal} onOpenChange={setShowPhotoReportModal}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {photoReportForm.id
                ? (t('edit_photo_report') || 'Foto hisobotni tahrirlash')
                : (t('new_photo_report') || 'Yangi foto hisobot')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePhotoReport} className="space-y-4">
            <div>
              <Label>{t('report_date') || 'Hisobot sanasi'} *</Label>
              <Input
                type="date"
                value={photoReportForm.report_date}
                onChange={(e) => setPhotoReportForm({ ...photoReportForm, report_date: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('report_type') || 'Hisobot turi'}</Label>
                <Select
                  value={photoReportForm.report_type}
                  onValueChange={(value) => setPhotoReportForm({ ...photoReportForm, report_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_type') || 'Turni tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="progress">{t('progress') || 'Progress'}</SelectItem>
                    <SelectItem value="quality">{t('quality') || 'Sifat'}</SelectItem>
                    <SelectItem value="safety">{t('safety') || 'Xavfsizlik'}</SelectItem>
                    <SelectItem value="issue">{t('issue') || 'Muammo'}</SelectItem>
                    <SelectItem value="completion">{t('completion') || 'Tugallash'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('weather') || 'Ob-havo'}</Label>
                <Select
                  value={photoReportForm.weather}
                  onValueChange={(value) => setPhotoReportForm({ ...photoReportForm, weather: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_weather') || 'Tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunny">{t('sunny') || 'Quyoshli'}</SelectItem>
                    <SelectItem value="cloudy">{t('cloudy') || 'Bulutli'}</SelectItem>
                    <SelectItem value="rainy">{t('rainy') || "Yomg'irli"}</SelectItem>
                    <SelectItem value="snowy">{t('snowy') || 'Qorli'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('title') || 'Sarlavha'} *</Label>
              <Input
                value={photoReportForm.title}
                onChange={(e) => setPhotoReportForm({ ...photoReportForm, title: e.target.value })}
                placeholder={t('photo_report_title_placeholder') || 'Foto hisobot sarlavhasi'}
                required
              />
            </div>
            <div>
              <Label>{t('description') || 'Tavsif'}</Label>
              <Textarea
                value={photoReportForm.description}
                onChange={(e) => setPhotoReportForm({ ...photoReportForm, description: e.target.value })}
                placeholder={t('photo_report_description_placeholder') || 'Bajarilgan ishlar haqida tavsif...'}
                rows={3}
              />
            </div>
            <div>
              <Label>{t('location_description') || 'Joylashuv'}</Label>
              <Input
                value={photoReportForm.location_description}
                onChange={(e) => setPhotoReportForm({ ...photoReportForm, location_description: e.target.value })}
                placeholder={t('location_placeholder') || "Masalan: A blok, 3-qavat"}
              />
            </div>
            <div>
              <Label>{t('temperature') || 'Harorat'} (°C)</Label>
              <Input
                type="number"
                value={photoReportForm.temperature}
                onChange={(e) => setPhotoReportForm({ ...photoReportForm, temperature: e.target.value })}
                placeholder="20"
              />
            </div>

            {/* Photo Upload Section */}
            <div>
              <Label>{t('photos') || 'Rasmlar'} *</Label>
              <div className="mt-2">
                {/* Upload Area */}
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">
                      {t('click_to_upload') || 'Rasmlarni yuklash uchun bosing'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      PNG, JPG (max 10 ta rasm)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoSelect}
                    disabled={photoFiles.length >= 10}
                  />
                </label>

                {/* Photo Previews */}
                {photoPreview.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {photoPreview.map((item, index) => {
                      // Handle both new uploads (object with preview) and existing photos (URL string)
                      const imgSrc = typeof item === 'string' ? item : (item.preview || item.url);
                      const isExisting = typeof item === 'string';
                      return (
                        <div key={index} className="relative group">
                          <img
                            src={imgSrc}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg"
                          />
                          {isExisting && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5 rounded-b-lg">
                              Mavjud
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {photoFiles.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    {photoFiles.length} {t('photos_selected') || 'ta rasm tanlandi'}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowPhotoReportModal(false);
                setPhotoFiles([]);
                setPhotoPreview([]);
              }}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!photoReportForm.report_date || !photoReportForm.title || (photoFiles.length === 0 && photoPreview.length === 0) || uploadingPhotos}>
                {uploadingPhotos ? (
                  <>{t('uploading') || 'Yuklanmoqda'}...</>
                ) : photoReportForm.id ? (
                  <>{t('update') || 'Yangilash'}</>
                ) : (
                  <>{t('create') || 'Yaratish'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Daily Log View Modal */}
      <Dialog open={showDailyLogViewModal} onOpenChange={setShowDailyLogViewModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('daily_log_details') || 'Kunlik hisobot tafsilotlari'}</DialogTitle>
          </DialogHeader>
          {selectedDailyLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('report_date') || 'Hisobot sanasi'}</p>
                  <p className="font-medium">{format(new Date(selectedDailyLog.report_date), 'dd.MM.yyyy')}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('status') || 'Holat'}</p>
                  <Badge className={
                    selectedDailyLog.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                    selectedDailyLog.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }>{t(selectedDailyLog.verification_status) || selectedDailyLog.verification_status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('weather_morning') || 'Ertalab ob-havo'}</p>
                  <p className="font-medium">{selectedDailyLog.weather_morning ? (t(selectedDailyLog.weather_morning) || selectedDailyLog.weather_morning) : '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('weather_afternoon') || 'Kunduzi ob-havo'}</p>
                  <p className="font-medium">{selectedDailyLog.weather_afternoon ? (t(selectedDailyLog.weather_afternoon) || selectedDailyLog.weather_afternoon) : '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('temperature') || 'Harorat'}</p>
                  <p className="font-medium">{selectedDailyLog.temperature_min}°C - {selectedDailyLog.temperature_max}°C</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('workers_count') || 'Ishchilar soni'}</p>
                  <p className="font-medium">{selectedDailyLog.workers_count || 0}</p>
                </div>
              </div>

              {selectedDailyLog.work_summary && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('work_summary') || 'Bajarilgan ishlar'}</p>
                  <p className="text-sm">{selectedDailyLog.work_summary}</p>
                </div>
              )}

              {selectedDailyLog.issues_encountered && (
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-orange-600 mb-1">{t('issues_encountered') || 'Muammolar'}</p>
                  <p className="text-sm">{selectedDailyLog.issues_encountered}</p>
                </div>
              )}

              {selectedDailyLog.safety_notes && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">{t('safety_notes') || 'Xavfsizlik eslatmalari'}</p>
                  <p className="text-sm">{selectedDailyLog.safety_notes}</p>
                </div>
              )}

              {selectedDailyLog.equipment_used && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('equipment_used') || 'Ishlatilgan jihozlar'}</p>
                  <p className="text-sm">{jsonbFieldToString(selectedDailyLog.equipment_used)}</p>
                </div>
              )}

              {selectedDailyLog.materials_received && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('materials_received') || 'Qabul qilingan materiallar'}</p>
                  <p className="text-sm">{jsonbFieldToString(selectedDailyLog.materials_received)}</p>
                </div>
              )}

              {(() => {
                const photos = parsePhotos(selectedDailyLog.photos);
                return photos.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">{t('photos') || 'Rasmlar'} ({photos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((photo, idx) => (
                        <a key={idx} href={getFileUrl(photo.url || photo)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={getFileUrl(photo.url || photo)}
                            alt={`photo-${idx + 1}`}
                            className="w-full h-28 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDailyLogViewModal(false)}>
              {t('close') || 'Yopish'}
            </Button>
            <Button onClick={() => {
              setDailyLogForm({
                id: selectedDailyLog.id,
                report_date: selectedDailyLog.report_date ? new Date(selectedDailyLog.report_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                weather_morning: selectedDailyLog.weather_morning || '',
                weather_afternoon: selectedDailyLog.weather_afternoon || '',
                temperature_min: selectedDailyLog.temperature_min || '',
                temperature_max: selectedDailyLog.temperature_max || '',
                work_summary: selectedDailyLog.work_summary || '',
                issues_encountered: selectedDailyLog.issues_encountered || '',
                safety_notes: selectedDailyLog.safety_notes || '',
                workers_count: selectedDailyLog.workers_count || '',
                workers_details: jsonbFieldToString(selectedDailyLog.workers_details),
                equipment_used: jsonbFieldToString(selectedDailyLog.equipment_used),
                materials_received: jsonbFieldToString(selectedDailyLog.materials_received)
              });
              setDailyLogFiles([]);
              setDailyLogPhotoPreview(parsePhotos(selectedDailyLog.photos).map(p => getFileUrl(p.url || p)));
              setShowDailyLogViewModal(false);
              setShowDailyLogModal(true);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              {t('edit') || 'Tahrirlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/80"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="fullscreen"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => !open && setConfirmDelete({ open: false, onConfirm: null })}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete') || "O'chirishni tasdiqlaysizmi?"}</AlertDialogTitle>
            <AlertDialogDescription>{t('this_cannot_be_undone')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete({ open: false, onConfirm: null })}>
              {t('cancel') || 'Bekor qilish'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                confirmDelete.onConfirm?.();
                setConfirmDelete({ open: false, onConfirm: null });
              }}
            >
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Main Component
export default function Construction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const {
    projects,
    loading,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    PROJECT_STATUS,
    PROJECT_TYPES,
    getProjectStats
  } = useConstructionContext();

  // Refresh data when navigating to this page
  useEffect(() => {
    loadProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTab = searchParams.get("tab") || "projects";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    region: '',
    project_type: '',
    building_type: '',
    total_area: '',
    floors_count: '',
    contract_amount: '',
    planned_start_date: '',
    planned_end_date: '',
    status: 'draft'
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const stats = getProjectStats();

  const getStatusBadge = (status) => {
    const config = {
      [PROJECT_STATUS.DRAFT]: { label: t('draft') || 'Qoralama', color: 'bg-gray-500' },
      [PROJECT_STATUS.PLANNING]: { label: t('planning') || 'Rejalashtirish', color: 'bg-purple-500' },
      [PROJECT_STATUS.APPROVED]: { label: t('approved') || 'Tasdiqlangan', color: 'bg-blue-500' },
      [PROJECT_STATUS.IN_PROGRESS]: { label: t('in_progress') || 'Jarayonda', color: 'bg-orange-500' },
      [PROJECT_STATUS.ON_HOLD]: { label: t('on_hold') || "To'xtatilgan", color: 'bg-yellow-500' },
      [PROJECT_STATUS.COMPLETED]: { label: t('completed') || 'Tugallangan', color: 'bg-green-500' },
      [PROJECT_STATUS.CANCELLED]: { label: t('cancelled') || 'Bekor qilingan', color: 'bg-red-500' }
    };
    const statusConfig = config[status] || { label: status, color: 'bg-gray-500' };
    return <Badge className={`${statusConfig.color} text-white`}>{statusConfig.label}</Badge>;
  };

  const handleSubmitProject = async (e) => {
    e.preventDefault();
    try {
      // Convert form data - empty strings to null/0 for numeric fields
      const formData = {
        ...projectForm,
        total_area: projectForm.total_area ? parseFloat(projectForm.total_area) : 0,
        floors_count: projectForm.floors_count ? parseInt(projectForm.floors_count, 10) : 0,
        contract_amount: projectForm.contract_amount ? parseFloat(projectForm.contract_amount) : 0,
      };

      if (editingProject) {
        await updateProject(editingProject.id, formData);
      } else {
        await createProject(formData);
      }
      setShowProjectModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const resetForm = () => {
    setProjectForm({
      name: '', description: '', address: '', city: '', region: '',
      project_type: '', building_type: '',
      total_area: '', floors_count: '', contract_amount: '', planned_start_date: '', planned_end_date: '',
      status: 'draft'
    });
    setEditingProject(null);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || '',
      address: project.address || '',
      city: project.city || '',
      region: project.region || '',
      project_type: project.project_type || '',
      building_type: project.building_type || '',
      total_area: project.total_area || '',
      floors_count: project.floors_count || '',
      contract_amount: project.contract_amount || '',
      planned_start_date: project.planned_start_date ? format(new Date(project.planned_start_date), 'yyyy-MM-dd') : '',
      planned_end_date: project.planned_end_date ? format(new Date(project.planned_end_date), 'yyyy-MM-dd') : '',
      status: project.status || 'draft'
    });
    setShowProjectModal(true);
  };

  const [confirmDeleteProject, setConfirmDeleteProject] = useState({ open: false, id: null });

  const handleDeleteProject = (id) => {
    setConfirmDeleteProject({ open: true, id });
  };

  const handleViewProject = (project) => {
    setSelectedProject(project);
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      await constructionService.updateProject(projectId, { status: newStatus });
      await loadProjects();
    } catch (error) {
      console.error('Failed to update project status:', error);
    }
  };

  // If viewing a project, show detail view
  if (selectedProject) {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <ProjectDetailView
          project={selectedProject}
          onBack={() => setSelectedProject(null)}
          t={t}
          formatCurrency={formatCurrency}
          getStatusBadge={getStatusBadge}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('construction') || 'Qurilish'}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('construction_description') || 'Qurilish loyihalari va smeta boshqaruvi'}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_projects') || 'Jami loyihalar'}</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('draft') || 'Qoralama'}</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.draft}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('in_progress') || 'Jarayonda'}</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('completed') || 'Tugallangan'}</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('contract_total') || 'Shartnoma summasi'}</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrencyCompact(stats.totalContractAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_smeta') || 'Jami smeta'}</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrencyCompact(stats.totalSmeta)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects List */}
        <ProjectsTab
          projects={projects}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onCreateProject={() => { resetForm(); setShowProjectModal(true); }}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
          onViewProject={handleViewProject}
          onStatusChange={handleStatusChange}
          getStatusBadge={getStatusBadge}
          formatCurrency={formatCurrency}
          t={t}
          PROJECT_STATUS={PROJECT_STATUS}
        />
      </div>

      {/* Project Modal */}
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? (t('edit_project') || 'Loyihani tahrirlash') : (t('new_project') || 'Yangi loyiha')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitProject} className="space-y-4">
            <div>
              <Label>{t('project_name') || 'Loyiha nomi'} *</Label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>{t('description') || 'Tavsif'}</Label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('address') || 'Manzil'}</Label>
                <Input
                  value={projectForm.address}
                  onChange={(e) => setProjectForm({ ...projectForm, address: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('city') || 'Shahar'}</Label>
                <Input
                  value={projectForm.city}
                  onChange={(e) => setProjectForm({ ...projectForm, city: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('region') || 'Viloyat'}</Label>
                <Input
                  value={projectForm.region}
                  onChange={(e) => setProjectForm({ ...projectForm, region: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('project_type') || 'Loyiha turi'}</Label>
                <Select value={projectForm.project_type} onValueChange={(v) => setProjectForm({ ...projectForm, project_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select') || 'Tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">{t('residential') || 'Turar-joy'}</SelectItem>
                    <SelectItem value="commercial">{t('commercial') || 'Tijorat'}</SelectItem>
                    <SelectItem value="industrial">{t('industrial') || 'Sanoat'}</SelectItem>
                    <SelectItem value="infrastructure">{t('infrastructure') || 'Infratuzilma'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('building_type') || 'Bino turi'}</Label>
                <Input
                  value={projectForm.building_type}
                  onChange={(e) => setProjectForm({ ...projectForm, building_type: e.target.value })}
                  placeholder="9-qavatli turar-joy"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('total_area') || 'Umumiy maydon (m²)'}</Label>
                <Input
                  type="number"
                  value={projectForm.total_area}
                  onChange={(e) => setProjectForm({ ...projectForm, total_area: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('floors_count') || 'Qavatlar soni'}</Label>
                <Input
                  type="number"
                  value={projectForm.floors_count}
                  onChange={(e) => setProjectForm({ ...projectForm, floors_count: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('contract_amount') || 'Shartnoma summasi'}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatPriceInput(projectForm.contract_amount)}
                  onChange={(e) => setProjectForm({ ...projectForm, contract_amount: parsePriceInput(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('planned_start_date') || 'Rejadagi boshlanish'}</Label>
                <Input
                  type="date"
                  value={projectForm.planned_start_date}
                  onChange={(e) => setProjectForm({ ...projectForm, planned_start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('planned_end_date') || 'Rejadagi tugash'}</Label>
                <Input
                  type="date"
                  value={projectForm.planned_end_date}
                  onChange={(e) => setProjectForm({ ...projectForm, planned_end_date: e.target.value })}
                />
              </div>
            </div>

            {editingProject && (
              <div>
                <Label>{t('status') || 'Holat'}</Label>
                <Select value={projectForm.status} onValueChange={(v) => setProjectForm({ ...projectForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_status') || 'Holatni tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                    <SelectItem value="planning">{t('planning') || 'Rejalashtirish'}</SelectItem>
                    <SelectItem value="in_progress">{t('in_progress') || 'Jarayonda'}</SelectItem>
                    <SelectItem value="on_hold">{t('on_hold') || "To'xtatilgan"}</SelectItem>
                    <SelectItem value="completed">{t('completed') || 'Tugallangan'}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled') || 'Bekor qilingan'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowProjectModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                {editingProject ? (t('update') || 'Yangilash') : (t('create') || 'Yaratish')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <AlertDialog open={confirmDeleteProject.open} onOpenChange={(open) => !open && setConfirmDeleteProject({ open: false, id: null })}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete') || "O'chirishni tasdiqlaysizmi?"}</AlertDialogTitle>
            <AlertDialogDescription>{t('this_cannot_be_undone')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteProject({ open: false, id: null })}>
              {t('cancel') || 'Bekor qilish'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                await deleteProject(confirmDeleteProject.id);
                setConfirmDeleteProject({ open: false, id: null });
              }}
            >
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
