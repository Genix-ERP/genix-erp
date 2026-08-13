import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConstructionContext } from '@/components/contexts/ConstructionContext';
import { constructionService } from '@/api/services/construction';
import { materialRequestsService } from '@/api/services/materialRequests';
import { hrService } from '@/api/services/hr';
import { inventoryService } from '@/api/services/inventory';
import { Core as Integrations } from '@/api/integrations';
import apiClient from '@/api/client';
import { useCompany } from '@/components/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
  ClipboardList,
  Users,
  MapPin,
  Calendar,
  DollarSign,
  Banknote,
  Search,
  Edit,
  Trash2,
  Eye,
  ChevronRight,
  ChevronLeft,
  Package,
  Truck,
  FileText,
  AlertCircle,
  AlertTriangle,
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
  LayoutDashboard,
  Columns3,
  Upload,
  Download,
  X,
  Image,
  Layers,
  Scale,
  Paperclip,
  ChevronsUpDown,
  Check,
  Copy,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { getApiErrorMessage } from '@/utils/apiError';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ActivityLogPanel } from '@/components/shared/ActivityLog';
import { WBSTree } from '@/components/construction/WBSTree';
// Lazy-load heavy tab components so they're only fetched when the user
// opens the relevant section. This reduces initial bundle size by ~60%.
const MaterialRequestsPanel = lazy(() => import('@/components/construction/material-requests/MaterialRequestsPanel'));
const ActivityTab = lazy(() => import('@/components/construction/tabs/ActivityTab'));
const EstimatesTab = lazy(() => import('@/components/construction/tabs/EstimatesTab'));
// Smeta boshqaruvi — focused per-estimate view: KPI cards (labor / machine /
// material / total), works grouped by section, sub-line breakdown.
// Modeled on the Form2_Works_v2 mockup; uses existing /estimates + /lines
// endpoints, no new backend routes.
const SmetaManagementTab = lazy(() => import('@/components/construction/tabs/SmetaManagementTab'));
const DailyJournalTab = lazy(() => import('@/components/construction/tabs/DailyJournalTab'));
// StagesTabV2 — full v2 mockup (construction_module_v2.html) with the
// foreman → supervisor → engineer approval workflow. The original
// StagesTab is kept around in the repo for reference/rollback but no
// longer mounted.
const StagesTab = lazy(() => import('@/components/construction/tabs/StagesTabV2'));
// Ish grafigi — Gectaro-style Gantt over smeta work items (schedule +
// dependencies + baseline), backed by /construction/projects/:id/schedule.
const WorkScheduleTab = lazy(() => import('@/components/construction/tabs/WorkScheduleTab'));
const ExpensesTab = lazy(() => import('@/components/construction/tabs/ExpensesTab'));
const BudgetTab = lazy(() => import('@/components/construction/tabs/BudgetTab'));
const MaterialUsageTab = lazy(() => import('@/components/construction/tabs/MaterialUsageTab'));
// ProgressTab (Jarayon) was cut in the qurilish-v2 flat IA — its stats
// merged into the rebuilt Umumiy ko'rinish. The component file stays in
// the repo for reference; only the navigation entry and dispatch branch
// were removed.
const SubcontractorsTab = lazy(() => import('@/components/construction/tabs/SubcontractorsTab'));
const ActsTab = lazy(() => import('@/components/construction/tabs/ActsTab'));
const FormsTab = lazy(() => import('@/components/construction/tabs/FormsTab'));
// FinancialTab (Moliya → Tahlil) was removed per product request — the page
// mostly duplicated Byudjet and showed misleading numbers when smeta totals
// weren't loaded. The component file was deleted in the 2026-08 cleanup;
// rebuild it on DashboardKit primitives if the tab is ever reinstated.
const RejaFaktTab = lazy(() => import('@/components/construction/tabs/RejaFaktTab'));
const SmetaVsFactTab = lazy(() => import('@/components/construction/tabs/SmetaVsFactTab'));
const TeamTab = lazy(() => import('@/components/construction/tabs/TeamTab'));
import { ImportModal, ExportModal, ImportExportButtons } from '@/components/shared';
import { ProjectKanban } from '@/components/construction/ProjectKanban';
import MaterialConsolidationModal from '@/components/construction/MaterialConsolidationModal';
import { UZ_REGIONS, citiesForRegion } from '@/components/construction/uzRegions';
import CRMLinkPanel from '@/components/construction/CRMLinkPanel';
import {
  ProgressWidget,
  TimelineWidget,
  TeamWidget,
  VendorsWidget,
  AlertsWidget,
  BudgetMiniWidget
} from '@/components/construction/DashboardWidgets';

// Status transitions allowed for projects. Completed / cancelled are terminal;
// reopening requires moving back through in_progress explicitly.
const ALLOWED_PROJECT_TRANSITIONS = Object.freeze({
  draft: ['planning', 'in_progress', 'cancelled'],
  planning: ['draft', 'in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: ['in_progress'],
  cancelled: ['draft'],
});

// Tab Components
const ProjectsTab = ({
  projects,
  loading,
  loadError,
  onRetry,
  readinessById,
  // Full per-project stats map (id → {readiness_pct, actual_amount,
  // overdue_works}) + a flag telling whether the stats fetch succeeded.
  // A project MISSING from the map has no estimate and no costs yet —
  // the card shows the "Smeta hali tuzilmagan" variant instead of facts.
  statsById,
  statsReady,
  formatCurrencyCompact,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onViewProject,
  onOpenFiles,
  onStatusChange,
  getStatusBadge,
  formatCurrency,
  t,
  PROJECT_STATUS
}) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'kanban'

  // Debounce the search query by 200ms so filtering runs after the user stops
  // typing, rather than on every keystroke. Memoize the filtered list to
  // avoid recomputing on unrelated re-renders.
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const filteredProjects = React.useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query && statusFilter === 'all') return projects;
    return projects.filter((p) => {
      const matchesSearch =
        !query ||
        (p.name || '').toLowerCase().includes(query) ||
        (p.code || '').toLowerCase().includes(query) ||
        (p.client_name || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, debouncedSearch, statusFilter]);

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            {t('construction_projects') || 'Qurilish loyihalari'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {filteredProjects.length === projects.length
              ? `${projects.length} ${t('projects_total_suffix') || 'loyiha'}`
              : `${filteredProjects.length} / ${projects.length} ${t('projects_total_suffix') || 'loyiha'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle — minimalist segmented control */}
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label={t('view_mode') || "Ko'rinish"}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              aria-label={t('grid_view') || 'Panel ko\'rinishi'}
              title={t('grid_view') || 'Panel ko\'rinishi'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              aria-label={t('kanban_view') || 'Kanban ko\'rinishi'}
              title={t('kanban_view') || 'Kanban ko\'rinishi'}
            >
              <Columns3 className="w-4 h-4" />
            </button>
          </div>
          <Button
            onClick={onCreateProject}
            className="h-9 rounded-lg bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-md hover:opacity-90 cursor-pointer transition-opacity"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('new_project') || 'Yangi loyiha'}
          </Button>
        </div>
      </header>

      <div className="p-6">
        {/* Search and Filter - only show in grid view */}
        {viewMode === 'grid' && (
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t('search_projects') || 'Loyihalarni qidirish...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 h-10 bg-slate-50 border-slate-200">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 animate-pulse">
                <div className="h-4 w-1/2 bg-slate-200 rounded mb-3" />
                <div className="h-3 w-1/3 bg-slate-200 rounded mb-4" />
                <div className="h-2 w-full bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-16 max-w-md mx-auto" role="alert">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-red-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1.5">
              {t('error_occurred') || 'Xatolik yuz berdi'}
            </h3>
            <p className="text-sm text-slate-500 mb-5 break-words">{loadError}</p>
            <Button variant="outline" className="cursor-pointer" onClick={() => onRetry && onRetry()}>
              {t('retry') || 'Qayta urinish'}
            </Button>
          </div>
        ) : viewMode === 'kanban' ? (
          <ProjectKanban
            projects={filteredProjects}
            readinessById={readinessById}
            statsById={statsById}
            onStatusChange={onStatusChange}
            onViewProject={onViewProject}
            onEditProject={onEditProject}
            formatCurrency={formatCurrency}
          />
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
              <Building2 className="w-8 h-8 text-slate-400" strokeWidth={1.5} />
            </div>
            {searchQuery || statusFilter !== 'all' ? (
              <>
                <h3 className="text-base font-semibold text-slate-900 mb-1.5">
                  {t('no_projects_found') || 'Loyihalar topilmadi'}
                </h3>
                <p className="text-sm text-slate-500 mb-5">
                  {t('no_projects_found_hint') || "Qidiruv yoki filtrni o'zgartirib ko'ring"}
                </p>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  {t('clear_filters') || 'Filtrlarni tozalash'}
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-slate-900 mb-1.5">
                  {t('no_projects_yet') || "Hozircha loyihalar yo'q"}
                </h3>
                <p className="text-sm text-slate-500 mb-5">
                  {t('create_first_project_hint') ||
                    "Birinchi qurilish loyihangizni yarating va boshqaruvni boshlang"}
                </p>
                <Button
                  onClick={onCreateProject}
                  className="cursor-pointer bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-md hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t('create_first_project') || 'Birinchi loyihani yaratish'}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              // Prefer the computed cost-weighted readiness from /stats;
              // fall back to the manual progress_percent field.
              const computed = readinessById ? readinessById[project.id] : undefined;
              const progress = typeof computed === 'number'
                ? Math.round(computed)
                : (Number(project.progress_percent) || 0);
              const statEntry = statsById ? statsById[project.id] : undefined;
              const overdueWorks = Number(statEntry?.overdue_works) || 0;
              // No per_project entry at all == no edinich estimate AND no
              // approved costs — a brand-new/sparse project. Only trust this
              // when the stats fetch actually succeeded.
              const noEstimateYet = statsReady && !statEntry;
              return (
                <article
                  key={project.id}
                  onClick={() => onViewProject(project)}
                  className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-all cursor-pointer hover:border-slate-300 hover:shadow-sm focus-within:ring-2 focus-within:ring-slate-300"
                  tabIndex={0}
                  role="button"
                  aria-label={`${project.name} — ${t('view_details') || "Batafsil ko'rish"}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onViewProject(project);
                    }
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-2">
                        {project.name}
                      </h3>
                      {project.code && (
                        <span className="mt-1 inline-block font-mono text-[11px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                          {project.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {project.viewer_role === 'subcontractor' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-orange-100 text-orange-700">
                          {t('subcontractor') || 'Subpudratchi'}
                        </span>
                      )}
                      {getStatusBadge(project.status)}
                    </div>
                  </div>

                  {/* Meta rows */}
                  <dl className="space-y-2 text-sm mb-5">
                    {project.client_name && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />
                        <dd className="truncate">{project.client_name}</dd>
                      </div>
                    )}
                    {(project.city || project.region) && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />
                        <dd className="truncate">{[project.city, project.region].filter(Boolean).join(', ')}</dd>
                      </div>
                    )}
                    {project.contract_amount > 0 && (
                      <div className="flex items-center gap-2 text-slate-900">
                        <Banknote className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />
                        <dd className="font-medium tabular-nums">{formatCurrency(project.contract_amount)}</dd>
                      </div>
                    )}
                    {project.planned_end_date && (() => {
                      const end = new Date(project.planned_end_date);
                      const overdue =
                        !Number.isNaN(end.getTime()) &&
                        end < new Date() &&
                        !['completed', 'cancelled'].includes(project.status);
                      return (
                        <div className={cn('flex items-center gap-2', overdue ? 'text-red-600' : 'text-slate-600')}>
                          <Calendar className={cn('w-3.5 h-3.5 shrink-0', overdue ? 'text-red-400' : 'text-slate-400')} strokeWidth={2} />
                          <dd className="tabular-nums">
                            {t('deadline') || 'Muddat'}: {Number.isNaN(end.getTime())
                              ? project.planned_end_date
                              : end.toLocaleDateString('ru-RU')}
                          </dd>
                          {overdue && (
                            <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-1.5 py-px text-[10px] font-medium text-red-600 whitespace-nowrap">
                              {t('pf_overdue_chip') || 'kechikkan'}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </dl>

                  {/* Progress — cost-weighted readiness (conventions §2) */}
                  <div className="mb-4 mt-auto">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-500">
                        {t('progress_label') || 'Bajarilish'}
                      </span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] transition-all duration-300"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Facts row — Fakt (approved CEL money) + overdue works chip.
                      Sparse variant for projects without any estimate/costs. */}
                  {noEstimateYet ? (
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 min-h-[40px]">
                      <span className="text-xs text-slate-400 truncate">
                        {t('pf_no_estimate') || 'Smeta hali tuzilmagan'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2.5 text-xs text-[var(--genix-blue)] hover:text-[var(--genix-blue)] hover:bg-blue-50 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewProject(project, { group: 'smeta', tab: 'estimates' });
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {t('pf_create_estimate') || 'Smeta tuzish'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs min-h-[40px]">
                      <span className="text-slate-500 truncate">
                        {t('pf_fact_label') || 'Fakt'}:{' '}
                        <span className="font-medium text-slate-700 tabular-nums">
                          {statEntry && typeof statEntry.actual_amount === 'number'
                            ? formatCurrencyCompact(statEntry.actual_amount)
                            : '—'}
                        </span>
                      </span>
                      {overdueWorks > 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-600 whitespace-nowrap shrink-0">
                          {(t('pf_works_overdue_chip') || '{n} ish kechikkan').replace('{n}', String(overdueWorks))}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-3 mt-3 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                      title={t('edit') || 'Tahrirlash'}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1.5" />
                      {t('edit') || 'Tahrirlash'}
                    </Button>
                    {/* Files icon button — overlaid badge in the top-right
                        shows how many files are uploaded for this project
                        (zero = no badge so the icon stays clean). */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); onOpenFiles && onOpenFiles(project); }}
                        aria-label={t('files') || 'Fayllar'}
                        title={t('files') || 'Fayllar'}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      {typeof project.files_count === 'number' && project.files_count > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold leading-[16px] text-center pointer-events-none shadow-sm"
                          aria-hidden="true"
                        >
                          {project.files_count > 99 ? '99+' : project.files_count}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                      aria-label={t('delete') || "O'chirish"}
                      title={t('delete') || "O'chirish"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Chevron indicator on hover */}
                  <ChevronRight
                    className="absolute top-5 right-5 w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

// Overview tab content — memoized to avoid re-renders when unrelated state changes
const OverviewTabContent = React.memo(function OverviewTabContent({
  project,
  buildings,
  sections,
  team,
  vendors,
  acts,
  // v2 /progress payload (fetched by ProjectDetailView) — the single
  // source for every progress/budget number on this screen.
  progressData,
  t,
  setActiveGroup,
  setActiveTab,
  // Forwarded from ProjectDetailView so the inline status dropdown in
  // ProgressWidget can call the parent's update handler. Optional.
  onProjectStatusChange,
}) {
  const EMPTY = '—';
  // Location parts kept as a list (not a single comma-joined string) so the
  // overview card can render them on separate lines — region / city / street
  // address all carry distinct meaning and the comma-join made them read
  // like one long sentence on real projects (e.g. "Marg'ilon, Farg'ona viloyati").
  const locationParts = [project.region, project.city, project.address].filter(Boolean);
  const locationStr = locationParts.join(', '); // still used by other call sites for tooltips

  // Forma 19 == Material yig'indisi (materials consolidation) modal.
  const [matConsOpen, setMatConsOpen] = useState(false);

  const quickActions = [
    {
      id: 'forma19',
      label: 'Forma 19',
      icon: FileText,
      hint: t('forma_19_hint') || "Material sarflangani bo'yicha rasmiy hisobot",
      // Forma 19 IS the material consolidation (Material yig'indisi). Open that
      // modal directly so the user can review and Save it to project files.
      go: () => { setMatConsOpen(true); },
    },
    {
      // Forma 3 (KS-3) lives in the same forms tab alongside Forma 2 /
      // Forma 19 — the user reaches the Create Forma 3 dialog from
      // the toolbar there. Quick action just lands them on the page.
      id: 'forma3',
      label: 'Forma 3',
      icon: FileSpreadsheet,
      hint: t('forma_3_hint') || "Bajarilgan ish qiymati to'g'risidagi ma'lumotnoma",
      go: () => { setActiveGroup('hujjatlar'); setActiveTab('forms'); },
    },
    {
      id: 'journal',
      label: t('journal') || 'Jurnal',
      icon: ClipboardList,
      hint: t('journal_hint') || "Kunlik ish, ob-havo, ishchilar hisoboti",
      go: () => { setActiveGroup('hujjatlar'); setActiveTab('daily_logs'); },
    },
    {
      id: 'expense',
      label: t('expense') || 'Xarajat',
      icon: DollarSign,
      hint: t('expense_hint') || "Loyiha bo'yicha xarajatlarni ro'yxatga olish",
      go: () => { setActiveGroup('moliya'); setActiveTab('expenses'); },
    },
  ];

  // NOTE: `client_name` is intentionally NOT in this list. The construction
  // project create/edit forms don't collect a client name — rendering the
  // row here always left a blank "Mijoz nomi" field with an em-dash in the
  // overview card, which looked like missing data rather than an
  // inapplicable field.
  const infoItems = [
    {
      label: t('project_address') || 'Manzil',
      // JSX so each part (Viloyat, Shahar, Manzil) renders on its own line.
      // Falls back to EMPTY when nothing's filled in so the muted-grey
      // styling in the renderer below still kicks in.
      value: locationParts.length > 0 ? (
        <span className="flex flex-col gap-0.5">
          {locationParts.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </span>
      ) : EMPTY,
    },
    {
      label: t('project_type') || 'Loyiha turi',
      value: project.project_type ? (t(project.project_type) || project.project_type) : EMPTY,
    },
    // "Bino turi" row removed per product feedback — the field rarely
    // carried meaningful data on real projects and the value was
    // duplicated/contradicted by `project_type` above.
    //
    // "Loyiha ombori" — the project's chosen default warehouse (migration
    // 365). Only rendered when an explicit warehouse is set on the
    // project. When the field is empty the runtime auto-picks per the
    // org-aware fallback chain, and showing a placeholder row in the
    // info card just adds noise — the user explicitly asked to hide it
    // when no warehouse is selected.
    ...(project.warehouse_name
      ? [{
          label: t('project_warehouse') || 'Loyiha ombori',
          value: project.warehouse_name,
        }]
      : []),
    {
      label: t('total_area') || 'Umumiy maydon',
      value: project.total_area ? `${project.total_area} m²` : EMPTY,
    },
    {
      // "Jamoa" → "Ishchi soni" — the metric is a headcount, not a
      // generic team-name, so the label reads more accurately. We
      // render just the bare count (no "a'zo" / "members" suffix)
      // because the label already names the unit.
      label: t('worker_count') || 'Ishchi soni',
      value: team.length > 0 ? String(team.length) : EMPTY,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <ProgressWidget
        project={{
          ...project,
          buildings_count: buildings.length,
          sections_count: sections.length,
          team_count: team.length,
        }}
        progressData={progressData}
        onStatusChange={onProjectStatusChange}
      />

      <TimelineWidget project={project} progressData={progressData} />

      {/* Quick Action Buttons — clean panel */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {t('quick_actions') || 'Tezkor amallar'}
          </h3>
        </div>
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.go}
                  title={action.hint}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                  <span className="truncate">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Byudjet mini — reja (smeta) vs fakt (CEL) from /progress. */}
      <BudgetMiniWidget progressData={progressData} />

      {/* Project Info — clean dl */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {t('project_info') || "Loyiha ma'lumotlari"}
          </h3>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 px-5 pb-5">
          {infoItems.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd
                className={cn(
                  'text-sm',
                  value === EMPTY ? 'text-slate-400' : 'font-medium text-slate-900'
                )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Alerts Widget */}
      <AlertsWidget
        project={{
          ...project,
          total_smeta: sections.reduce((sum, s) => sum + (parseFloat(s.total_cost) || 0), 0),
        }}
        sections={sections}
        vendors={vendors}
        acts={acts}
        progressData={progressData}
        onNavigate={(group, tab) => { setActiveGroup(group); setActiveTab(tab); }}
      />

      {/* Forma 19 == Material yig'indisi. Opened from the Tez amallar
         "Forma 19" quick action; Saqlash writes it to project documents. */}
      <MaterialConsolidationModal
        open={matConsOpen}
        onClose={() => setMatConsOpen(false)}
        projectId={project?.id}
        projectName={project?.name}
      />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────
// Qurilish v2 flat IA — static navigation shape + legacy URL redirects.
//
// NAV_STRUCTURE mirrors the NAV_GROUPS defined inside ProjectDetailView
// (which layers localized labels/icons on top); it exists at module scope
// so the URL normalizer below can validate ?group=&tab= params without
// needing t(). Groups with an empty tab list beyond the first entry are
// single-tab groups — clicking them activates that implicit tab and no
// sub-pill row is rendered.
const NAV_STRUCTURE = [
  { key: 'dashboard',   tabs: ['overview'] },
  { key: 'grafik',      tabs: ['work_schedule'] },
  { key: 'smeta',       tabs: ['smeta_management', 'stages', 'estimates', 'buildings'] },
  { key: 'moliya',      tabs: ['budget', 'reja_fakt', 'expenses'] },
  { key: 'materiallar', tabs: ['material_requests'] },
  { key: 'hujjatlar',   tabs: ['forms', 'acts', 'daily_logs', 'activity'] },
  { key: 'jamoa',       tabs: ['team_tab', 'subcontractors'] },
];

// Old (v1) `?group=&tab=` deep links → their new home in the flat IA.
// Consulted once when ProjectDetailView initializes state from the URL;
// the URL-sync effect then rewrites the address bar to the new form, so
// no old bookmark or notification link breaks.
const LEGACY_ROUTES = {
  'qurilish/buildings':       { group: 'smeta',     tab: 'buildings' },
  'qurilish/progress':        { group: 'dashboard', tab: 'overview' },
  'qurilish/stages':          { group: 'smeta',     tab: 'stages' },
  'qurilish/work_schedule':   { group: 'grafik',    tab: 'work_schedule' },
  'qurilish/reja_fakt':       { group: 'moliya',    tab: 'reja_fakt' },
  'qurilish/estimates':       { group: 'smeta',     tab: 'estimates' },
  'hujjatlar/subcontractors': { group: 'jamoa',     tab: 'subcontractors' },
};

// Pure: (group, tab) from the URL → a valid v2 (group, tab) pair.
// Order: exact legacy pair → legacy group/tab catch-alls → validation
// (unknown group falls back to 'dashboard'; a tab the group doesn't own
// falls back to the group's first tab).
const normalizeProjectRoute = (group, tab) => {
  const legacy = LEGACY_ROUTES[`${group}/${tab}`];
  if (legacy) return legacy;
  // Old top-level "Smeta boshqaruvi" group — every tab it held maps to the
  // new Smeta home segment.
  if (group === 'smeta_boshqaruvi') return { group: 'smeta', tab: 'smeta_management' };
  // Orphan 'team' tab (pre-TeamTab full page) → Jamoa.
  if (tab === 'team') return { group: 'jamoa', tab: 'team_tab' };
  const g = NAV_STRUCTURE.find((x) => x.key === group) || NAV_STRUCTURE[0];
  return { group: g.key, tab: g.tabs.includes(tab) ? tab : g.tabs[0] };
};

// Project Detail View with Sub-tabs
const ProjectDetailView = ({
  project,
  onBack,
  t,
  formatCurrency,
  getStatusBadge,
  // Optional: when supplied, the overview ProgressWidget renders an
  // inline status dropdown that calls this handler (instead of the
  // read-only progress label). Parent component owns the API + refresh.
  onProjectStatusChange,
}) => {
  const { language } = useLanguage();

  // Persist active group / tab in the URL so a hard refresh (or a
  // copy-pasted link) lands the user back on the same view. Falls
  // back to the previous defaults ('dashboard' / 'overview') when the
  // params aren't present. The two-way sync below keeps the URL in
  // step with state changes from the in-page navigation.
  const [projectViewParams, setProjectViewParams] = useSearchParams();
  // Normalize BEFORE state init so legacy v1 links (see LEGACY_ROUTES) land
  // on the right v2 view; the sync effect below then rewrites the URL.
  const initialRoute = normalizeProjectRoute(
    projectViewParams.get('group') || 'dashboard',
    projectViewParams.get('tab') || 'overview',
  );
  const [activeGroup, setActiveGroup] = useState(initialRoute.group);
  const [activeTab,   setActiveTab]   = useState(initialRoute.tab);
  // Whenever the user navigates, mirror the change to the URL. We use
  // `replace: true` so each click doesn't push a new history entry —
  // the back button still does what users expect (return to the
  // project list), not walk through every tab they touched.
  useEffect(() => {
    const next = new URLSearchParams(projectViewParams);
    let changed = false;
    if (next.get('group') !== activeGroup) {
      if (activeGroup === 'dashboard') next.delete('group');
      else next.set('group', activeGroup);
      changed = true;
    }
    if (next.get('tab') !== activeTab) {
      if (activeTab === 'overview') next.delete('tab');
      else next.set('tab', activeTab);
      changed = true;
    }
    if (changed) setProjectViewParams(next, { replace: true });
    // We intentionally don't list projectViewParams in deps — that
    // would re-run on every URL change and create a feedback loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup, activeTab]);

  // Top-level navigation — qurilish-v2 flat IA (conventions §3): seven
  // groups, one level deep. Single-tab groups carry a `tab` field (the
  // implicit tab the group click activates) and render no sub-pill row.
  // Keep NAV_STRUCTURE (module scope, above ProjectDetailView) in sync
  // with any key change here — it validates URL params.
  const NAV_GROUPS = [
    { key: 'dashboard', label: t('nav_overview') || "Umumiy ko'rinish", icon: LayoutDashboard, subs: [], tab: 'overview' },
    { key: 'grafik', label: t('nav_work_schedule') || 'Ish grafigi', icon: Calendar, subs: [], tab: 'work_schedule' },
    { key: 'smeta', label: t('nav_smeta') || 'Smeta', icon: ClipboardList, subs: [
      { key: 'smeta_management', label: t('nav_smeta_home') || 'Ishlar va hajmlar' },
      { key: 'stages', label: t('nav_stages') || 'Bosqichlar' },
      { key: 'estimates', label: t('nav_estimates_registry') || "Smetalar ro'yxati" },
      { key: 'buildings', label: t('nav_buildings') || 'Binolar' },
    ]},
    { key: 'moliya', label: t('nav_finance') || 'Moliya', icon: DollarSign, subs: [
      { key: 'budget', label: t('nav_budget') || 'Byudjet' },
      { key: 'reja_fakt', label: t('nav_plan_fact') || 'Reja vs Fakt' },
      { key: 'expenses', label: t('nav_expenses') || 'Xarajatlar' },
    ]},
    { key: 'materiallar', label: t('nav_materials') || 'Materiallar', icon: Package, subs: [], tab: 'material_requests' },
    { key: 'hujjatlar', label: t('nav_documents') || 'Hujjatlar', icon: FileText, subs: [
      { key: 'forms', label: t('nav_forms') || 'Formalar' },
      { key: 'acts', label: t('nav_acts') || 'Aktlar' },
      { key: 'daily_logs', label: t('nav_daily_log') || 'Kunlik jurnal' },
      { key: 'activity', label: t('nav_activity') || 'Faoliyat' },
    ]},
    // Subpudratchilar moved from Hujjatlar → Jamoa (people/organizations
    // belong together, documents stay documents).
    { key: 'jamoa', label: t('nav_team') || 'Jamoa', icon: Users, subs: [
      { key: 'team_tab', label: t('nav_team_members') || "Jamoa a'zolari" },
      { key: 'subcontractors', label: t('nav_subcontractors') || 'Subpudratchilar' },
    ]},
  ];

  const handleGroupClick = (group) => {
    setActiveGroup(group.key);
    if (group.subs.length === 0) {
      // Single-tab group — activate its implicit tab.
      setActiveTab(group.tab || 'overview');
    } else {
      setActiveTab(group.subs[0].key);
    }
  };

  const currentGroup = NAV_GROUPS.find(g => g.key === activeGroup) || NAV_GROUPS[0];
  // Locale-aware natural sort for building names so "Blok 2" comes before
  // "Blok 10". Also keeps the order stable after a create/import — the
  // backend `listBuildings` endpoint doesn't guarantee a specific order,
  // and without sorting on every load the freshly inserted block jumps
  // to the end of the list (Blok 2, Blok 1, Blok 3, Blok 4 in the
  // user's report) until a manual refresh.
  const sortBuildings = (rows) => (rows || []).slice().sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
  );
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [sections, setSections] = useState([]);
  // Acts list for the Umumiy ko'rinish alerts widget — surfaces any
  // construction_act whose period_to deadline is within the next 5 days
  // and not already approved/cancelled. Loaded alongside the other
  // overview data in the activeTab='overview' branch below.
  const [acts, setActs] = useState([]);
  const [team, setTeam] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [projectMaterials, setProjectMaterials] = useState([]);
  const [wbsTree, setWbsTree] = useState([]);
  const [loading, setLoading] = useState(false);

  // v2 progress payload (GET /projects/:id/progress) — the ONE progress
  // number (qurilish-v2 conventions §2). Powers the overview widgets AND
  // the live badge on the Ish grafigi tab, so it lives here (not inside
  // the overview branch): fetched once per project, re-fetched whenever
  // the user returns to the overview so freshly confirmed works show up.
  const [progressData, setProgressData] = useState(null);
  const progressFetchedFor = React.useRef(null);
  useEffect(() => {
    if (!project?.id) return;
    if (activeTab !== 'overview' && progressFetchedFor.current === project.id) return;
    if (progressFetchedFor.current !== project.id) setProgressData(null); // don't show the previous project's numbers
    progressFetchedFor.current = project.id;
    let cancelled = false;
    constructionService.getProjectProgress(project.id)
      .then((data) => { if (!cancelled) setProgressData(data || null); })
      .catch(() => { if (!cancelled) setProgressData(null); });
    return () => { cancelled = true; };
  }, [project?.id, activeTab]);

  // Ochiq zayavkalar soni — Materiallar tabidagi jonli badge. Same
  // project-scoped stats endpoint the MaterialRequestsPanel KPI cards use.
  const [openRequestsCount, setOpenRequestsCount] = useState(null);
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    materialRequestsService.stats({ project_id: project.id })
      .then((s) => { if (!cancelled) setOpenRequestsCount(typeof s?.open_count === 'number' ? s.open_count : null); })
      .catch(() => { if (!cancelled) setOpenRequestsCount(null); });
    return () => { cancelled = true; };
  }, [project?.id]);

  // Modals
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  // Block "Ko'rish" (view) modal — holds the building being previewed, null = closed.
  const [viewBuilding, setViewBuilding] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
const [showDailyLogModal, setShowDailyLogModal] = useState(false);
  const [showMaterialRequestModal, setShowMaterialRequestModal] = useState(false);

  // Import/Export modals
  const [showBuildingImportModal, setShowBuildingImportModal] = useState(false);
  const [showBuildingExportModal, setShowBuildingExportModal] = useState(false);

  // Building files
  const [showBuildingFilesModal, setShowBuildingFilesModal] = useState(false);
  const [buildingFilesTarget, setBuildingFilesTarget] = useState(null); // { id, name }
  const [buildingFiles, setBuildingFiles] = useState([]);
  const [buildingFilesLoading, setBuildingFilesLoading] = useState(false);
  const [uploadingBuildingFile, setUploadingBuildingFile] = useState(false);

  // Forms
  // commercial_units_count was always on the backend (entity.go:329 —
  // ConstructionBuilding.CommercialUnitsCount) but the form never carried
  // it. With the new "residential_non_residential" building type the
  // apartments field splits into TWO inputs, one for residential
  // apartments (apartments_count) and one for non-residential units
  // (commercial_units_count), so we now thread the second field through.
  const [buildingForm, setBuildingForm] = useState({
    name: '', code: '', description: '', building_type: '', building_purpose: '',
    floors_count: '', total_area: '', apartments_count: '', commercial_units_count: '',
    estimated_cost: '', status: 'draft', subcontractor_org_ids: [],
    // CRM link fields — only persisted via the separate setBuildingCRMLink
    // PUT after the main building save succeeds. crm_block_id can be null;
    // current_crm_stage defaults to 'foundation'; crm_auto_sync defaults true.
    crm_block_id: null, current_crm_stage: 'foundation', crm_auto_sync: true,
  });
  const [teamForm, setTeamForm] = useState({ employee_id: '', role: '', responsibilities: '', start_date: '' });
  const [materialRequestForm, setMaterialRequestForm] = useState({
    id: null, request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft', items: [],
    subcontract_id: '', building_id: ''
  });
  const [projectSubcontracts, setProjectSubcontracts] = useState([]);
  // Tenant companies (organizations) — candidate internal subcontractors that
  // the owner can assign to a block in the building modal.
  const [orgs, setOrgs] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [inventoryWarehouses, setInventoryWarehouses] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [confirmApprove, setConfirmApprove] = useState({ open: false, requestId: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, onConfirm: null, title: null, description: null });
  // Clone-estimates modal — opened from the block card "..." menu. The
  // user picks a sibling source block; on confirm we POST to the backend
  // which copies every estimate (Единич, ВОР, Ресурс) + all their lines
  // into the target. Same project only. Backend refuses if target already
  // has estimates (the menu entry below is disabled in that case, this is
  // the race / direct-call guard). Shape: { open, target, sourceId } | null.
  const [cloneEstimatesModal, setCloneEstimatesModal] = useState(null);
  const [cloneEstimatesBusy, setCloneEstimatesBusy] = useState(false);
  // Duplicate-building modal — opened from the block card "..." → Nusxalash.
  // Lets the user pick HOW MANY copies to create. Each copy is a full clone
  // (estimates + lines + stages + files). Shape: { building, count } | null.
  const [duplicateModal, setDuplicateModal] = useState(null);
  // Estimate counts per building id — keyed by Number(building.id). Used
  // to (a) disable the "Klonlash" menu entry on blocks that already have
  // estimates, since they're not eligible as a clone TARGET, and (b)
  // surface "no estimates yet" on candidate SOURCES inside the modal.
  // Loaded once per project alongside the buildings list — see the
  // listEstimates effect lower down.
  const [estimateCountByBuildingId, setEstimateCountByBuildingId] = useState({});
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [dailyLogForm, setDailyLogForm] = useState({
    id: null,
    report_date: new Date().toISOString().split('T')[0],
    weather_morning: '', weather_afternoon: '',
    temperature_min: '', temperature_max: '',
    work_summary: '', issues_encountered: '', safety_notes: '',
    workers_count: '', workers_details: '', equipment_used: '', materials_received: '',
    // Bajarilgan hajm + birlik — KS-2 auto-generation reads these; without
    // them web journal entries always contributed 0 volume.
    quantity_done: '', uom: ''
  });
  const [selectedDailyLog, setSelectedDailyLog] = useState(null);
  const [showDailyLogViewModal, setShowDailyLogViewModal] = useState(false);
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
      setBuildings(sortBuildings(buildingsData));
      setShowBuildingImportModal(false);
    } catch (error) {
      console.error('Error importing buildings:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };


  // Load data based on active tab
  useEffect(() => {
    if (!project?.id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        switch (activeTab) {
          case 'overview':
            try {
              // Acts are pulled alongside the other overview data so the
              // AlertsWidget can flag deadlines within 5 days. .catch on
              // the acts promise so a permissions hiccup on /acts doesn't
              // crater the rest of the overview load.
              const [buildingsData, overviewSectionsData, overviewTeamData, overviewVendorsData, overviewActsData] = await Promise.all([
                constructionService.listBuildings(project.id),
                constructionService.listSections(project.id),
                constructionService.listTeamMembers(project.id),
                constructionService.listProjectVendors(project.id),
                constructionService.listActs(project.id).catch(() => []),
              ]);
              setBuildings(sortBuildings(buildingsData));
              setSections(overviewSectionsData || []);
              setTeam(overviewTeamData || []);
              setVendors(overviewVendorsData || []);
              setActs(Array.isArray(overviewActsData) ? overviewActsData : (overviewActsData?.data || []));
            } catch (e) {
              console.error('Error loading overview data:', e);
            }
            break;
          case 'buildings':
            try {
              // Estimate counts power the Klonlash menu entry on each
              // block card: target must be empty, so we need to know
              // which blocks already have estimates to disable the
              // "clone INTO this" path and surface counts on candidate
              // sources inside the modal.
              const [buildingsData, wbsData, allEstimates, orgsData] = await Promise.all([
                constructionService.listBuildings(project.id),
                constructionService.getWBSTree(project.id),
                constructionService.listEstimates(project.id).catch(() => []),
                constructionService.listOrganizations().catch(() => []),
              ]);
              setBuildings(sortBuildings(buildingsData));
              setWbsTree(wbsData || []);
              setOrgs(Array.isArray(orgsData) ? orgsData : (orgsData?.items || []));
              const counts = {};
              for (const e of (allEstimates || [])) {
                const bid = Number(e?.building_id || 0);
                if (!bid) continue;
                counts[bid] = (counts[bid] || 0) + 1;
              }
              setEstimateCountByBuildingId(counts);
            } catch (e) { setBuildings([]); setWbsTree([]); setEstimateCountByBuildingId({}); }
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
          case 'materials':
            {
              const results = await Promise.allSettled([
                constructionService.listMaterialRequests(project.id),
                inventoryService.listProducts({ limit: 100 }),
                inventoryService.listWarehouses({ limit: 100 }),
                constructionService.listProjectMaterials(project.id),
                constructionService.listSubcontracts(project.id)
              ]);
              setMaterialRequests(results[0].status === 'fulfilled' ? (results[0].value || []) : []);
              setInventoryProducts(results[1].status === 'fulfilled' ? (results[1].value?.items || results[1].value || []) : []);
              setInventoryWarehouses(results[2].status === 'fulfilled' ? (results[2].value?.items || results[2].value || []) : []);
              setProjectMaterials(results[3].status === 'fulfilled' ? (results[3].value || []) : []);
              setProjectSubcontracts(results[4].status === 'fulfilled' ? (results[4].value || []) : []);
            }
            break;
          case 'estimates':
          case 'daily_journal':
            try {
              const [estBuildings, estWbs, estSubcontracts] = await Promise.all([
                constructionService.listBuildings(project.id),
                constructionService.getWBSTree(project.id),
                constructionService.listSubcontracts(project.id),
              ]);
              setBuildings(sortBuildings(estBuildings));
              setWbsTree(estWbs || []);
              setProjectSubcontracts(estSubcontracts || []);
            } catch (e) { setWbsTree([]); }
            break;
          // (case 'progress' removed with the Jarayon tab — qurilish-v2
          // flat IA folded its stats into the Umumiy ko'rinish rebuild.)
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [project?.id, activeTab]);


  // Handle building creation/update
  const handleCreateBuilding = async (e) => {
    e.preventDefault();

    // Validation
    const name = buildingForm.name?.trim();
    if (!name) {
      toast.error(t('building_name_required') || 'Bino nomi shart');
      return;
    }
    const floors = buildingForm.floors_count ? parseInt(buildingForm.floors_count, 10) : 0;
    if (buildingForm.floors_count && (!Number.isFinite(floors) || floors < 0 || floors > 200)) {
      toast.error(t('invalid_floors_count') || "Qavatlar soni noto'g'ri (0-200)");
      return;
    }
    const area = buildingForm.total_area ? parseFloat(buildingForm.total_area) : 0;
    if (buildingForm.total_area && (!Number.isFinite(area) || area < 0)) {
      toast.error(t('invalid_total_area') || "Umumiy maydon noto'g'ri");
      return;
    }
    const apartments = buildingForm.apartments_count ? parseInt(buildingForm.apartments_count, 10) : 0;
    if (buildingForm.apartments_count && (!Number.isFinite(apartments) || apartments < 0)) {
      toast.error(t('invalid_apartments_count') || "Xonadonlar soni noto'g'ri");
      return;
    }
    // commercial_units_count — only relevant for the residential_non_residential
    // type, but parsed unconditionally so the value round-trips on edits where
    // the user later switched the type back to something else.
    const commercialUnits = buildingForm.commercial_units_count
      ? parseInt(buildingForm.commercial_units_count, 10)
      : 0;
    if (buildingForm.commercial_units_count
        && (!Number.isFinite(commercialUnits) || commercialUnits < 0)) {
      toast.error(t('invalid_commercial_units_count') || "Noturar xonalar soni noto'g'ri");
      return;
    }
    const estCost = buildingForm.estimated_cost ? parseFloat(buildingForm.estimated_cost) : 0;
    if (buildingForm.estimated_cost && (!Number.isFinite(estCost) || estCost < 0)) {
      toast.error(t('invalid_estimated_cost') || "Taxminiy qiymat noto'g'ri");
      return;
    }

    try {
      // Auto-generate a code from the building name when the user
      // didn't type one. The deterministic transform ("Block 2" →
      // "BLOCK_2") used to collide whenever two buildings in the
      // same project shared a name; the backend now uniquifies on
      // collision (suffixing -2, -3, ...), but we pre-empt the
      // collision here too so the user SEES the resolved code in
      // the form before submit instead of being surprised by it
      // post-save.
      const baseCode = (buildingForm.code && buildingForm.code.trim()) ||
        name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 20) ||
        'BUILDING';

      // Only attempt local dedup when this is a NEW building. For
      // edits we keep whatever code the row already has.
      let autoCode = baseCode;
      if (!buildingForm.id && Array.isArray(buildings)) {
        const existing = new Set(
          buildings.map((b) => String(b.code || '').toUpperCase())
        );
        if (existing.has(baseCode.toUpperCase())) {
          for (let n = 2; n < 100; n++) {
            const candidate = `${baseCode}-${n}`;
            if (!existing.has(candidate.toUpperCase())) {
              autoCode = candidate;
              break;
            }
          }
        }
      }

      const formData = {
        ...buildingForm,
        name,
        code: autoCode,
        floors_count: floors,
        total_area: area,
        apartments_count: apartments,
        commercial_units_count: commercialUnits,
        estimated_cost: estCost,
      };

      let savedBuildingId = buildingForm.id;
      if (buildingForm.id) {
        await constructionService.updateBuilding(project.id, buildingForm.id, formData);
        toast.success(t('building_updated') || 'Bino yangilandi');
      } else {
        const created = await constructionService.createBuilding(project.id, formData);
        savedBuildingId = created?.id || created?.data?.id || savedBuildingId;
        toast.success(t('building_created') || "Bino qo'shildi");
      }

      // Persist CRM link separately — backend has dedicated /crm-link route
      // (the main building POST/PUT does not touch crm_block_id). Only send
      // if the parent project is linked to CRM, otherwise the call is a
      // no-op at best (no CRM block can be picked).
      if (savedBuildingId && project?.crm_project_id) {
        try {
          await constructionService.setBuildingCRMLink(project.id, savedBuildingId, {
            crmBlockId: buildingForm.crm_block_id ?? null,
            currentStage: buildingForm.current_crm_stage || 'foundation',
            autoSync: buildingForm.crm_auto_sync !== false,
          });
        } catch (linkErr) {
          // Non-fatal: building itself saved fine. Surface a warning so the
          // operator knows the CRM link didn't persist and can retry.
          console.warn('CRM link save failed:', linkErr);
          toast.error(t('crm_link_save_failed') || 'CRM ulanish saqlanmadi');
        }
      }

      const buildingsData = await constructionService.listBuildings(project.id);
      setBuildings(sortBuildings(buildingsData));
      setShowBuildingModal(false);
      setBuildingForm({
        name: '', code: '', description: '', building_type: '', building_purpose: '',
        floors_count: '', total_area: '', apartments_count: '', commercial_units_count: '',
        estimated_cost: '', status: 'draft', subcontractor_org_ids: [],
        crm_block_id: null, current_crm_stage: 'foundation', crm_auto_sync: true,
      });
    } catch (error) {
      console.error('Error saving building:', error);
      // Backend errors live at response.data.error.message; keep the older
      // .data.message as a fallback for any endpoint using the flat shape.
      const msg = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || t('error_occurred') || 'Xatolik yuz berdi';
      toast.error(msg);
    }
  };

  // Building files helpers
  const openBuildingFiles = async (building) => {
    setBuildingFilesTarget({ id: building.id, name: building.name });
    setShowBuildingFilesModal(true);
    setBuildingFilesLoading(true);
    try {
      const data = await constructionService.listBuildingFiles(project.id, building.id);
      setBuildingFiles(data || []);
    } catch (e) {
      console.error('Error loading building files:', e);
      setBuildingFiles([]);
    } finally {
      setBuildingFilesLoading(false);
    }
  };

  const handleBuildingFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length || !buildingFilesTarget) return;

    // Mirror the backend's STORAGE_MAX_FILE_SIZE default (100MB). Catching
    // it here avoids a wasted multipart upload and gives the user an
    // instant, translated error instead of a generic 400 from the API.
    const MAX_FILE_BYTES = 100 * 1024 * 1024;
    const oversized = Array.from(files).find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      const limitMB = Math.floor(MAX_FILE_BYTES / (1024 * 1024));
      toast.error(
        (t('file_too_large') || "Fayl hajmi {limit} MB dan oshmasligi kerak").replace('{limit}', limitMB)
      );
      e.target.value = '';
      return;
    }

    setUploadingBuildingFile(true);
    try {
      for (const file of files) {
        const uploaded = await Integrations.UploadFile(file);
        await constructionService.createBuildingFile(project.id, buildingFilesTarget.id, {
          file_id: uploaded.id,
          file_url: uploaded.url,
          filename: uploaded.filename || file.name,
          file_size: uploaded.size || file.size,
          mime_type: uploaded.mime_type || file.type,
        });
      }
      const data = await constructionService.listBuildingFiles(project.id, buildingFilesTarget.id);
      setBuildingFiles(data || []);
      // Keep the Fayllar-button badge in sync with the real count from the
      // refreshed file list, without refetching the whole buildings query.
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === buildingFilesTarget.id
            ? { ...b, files_count: (data || []).length }
            : b,
        ),
      );
      toast.success(t('file_uploaded') || 'Fayl yuklandi');
    } catch (err) {
      console.error('Error uploading building file:', err);
      // Backend's size check may still trip if the env var is set lower
      // than our local default — surface the same translated message.
      const apiMsg = err?.response?.data?.message || err?.response?.data?.error || '';
      if (/file size exceeds/i.test(apiMsg)) {
        const limitMB = Math.floor(MAX_FILE_BYTES / (1024 * 1024));
        toast.error(
          (t('file_too_large') || "Fayl hajmi {limit} MB dan oshmasligi kerak").replace('{limit}', limitMB)
        );
      } else {
        toast.error(t('error_occurred') || 'Xatolik yuz berdi');
      }
    } finally {
      setUploadingBuildingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteBuildingFile = (fileId) => {
    if (!buildingFilesTarget) return;
    setConfirmDelete({
      open: true,
      title: t('confirm_delete_file') || "Faylni o'chirishni tasdiqlaysizmi?",
      description:
        t('file_delete_warning') ||
        "Fayl butunlay o'chiriladi va qayta tiklab bo'lmaydi.",
      onConfirm: async () => {
        try {
          await constructionService.deleteBuildingFile(project.id, buildingFilesTarget.id, fileId);
          setBuildingFiles(prev => prev.filter(f => f.id !== fileId));
          // Decrement the Fayllar-button badge for this building.
          setBuildings((prev) =>
            prev.map((b) =>
              b.id === buildingFilesTarget.id
                ? { ...b, files_count: Math.max(0, (Number(b.files_count) || 0) - 1) }
                : b,
            ),
          );
          toast.success(t('file_deleted') || "Fayl o'chirildi");
        } catch (err) {
          console.error('Error deleting building file:', err);
          toast.error(t('error_occurred') || 'Xatolik yuz berdi');
        }
      },
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Download a building file through apiClient instead of an <a href> link.
  // file_url is "/api/v1/files/{id}" — a path relative to the page origin.
  // In dev (Vite at :5173, API at :8080) the browser would resolve it to
  // localhost:5173/api/v1/files/... and Vite would serve index.html, which
  // gets saved as a blank xlsx. apiClient has the right baseURL so it hits
  // the actual file endpoint and we trigger save-as with the original name.
  const handleDownloadBuildingFile = async (file) => {
    try {
      const url = (file.file_url || '').replace(/^\/?api\/v1\/?/, '/');
      const response = await apiClient.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: file.mime_type || response.headers?.['content-type'] || 'application/octet-stream',
      });
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file.filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after a tick so Safari can finish streaming.
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error('Error downloading building file:', err);
      toast.error(t('error_occurred') || 'Xatolik yuz berdi');
    }
  };


  // Handle team member creation
  const handleCreateTeamMember = async (e) => {
    e.preventDefault();
    if (!teamForm.employee_id) {
      toast.error(t('select_employee') || 'Xodimni tanlang');
      return;
    }
    if (!teamForm.role?.trim()) {
      toast.error(t('role_required') || 'Rol/lavozim shart');
      return;
    }
    try {
      await constructionService.addTeamMember(project.id, teamForm);
      const teamData = await constructionService.listTeamMembers(project.id);
      setTeam(teamData || []);
      setShowTeamModal(false);
      setTeamForm({ employee_id: '', role: '', responsibilities: '', start_date: '' });
      toast.success(t('team_member_added') || "Jamoa a'zosi qo'shildi");
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.error(t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  // Handle team member removal
  const handleRemoveTeamMember = (memberId) => {
    setConfirmDelete({
      open: true,
      title: t('confirm_remove_member') || "Jamoa a'zosini o'chirmoqchimisiz?",
      description:
        t('team_member_remove_warning') ||
        "A'zoning loyihadagi vazifalari saqlanib qoladi, lekin u loyihadan chiqariladi.",
      onConfirm: async () => {
        try {
          await constructionService.removeTeamMember(project.id, memberId);
          const teamData = await constructionService.listTeamMembers(project.id);
          setTeam(teamData || []);
          toast.success(t('team_member_removed') || "Jamoa a'zosi o'chirildi");
        } catch (error) {
          console.error('Error removing team member:', error);
          toast.error(t('error_occurred') || 'Xatolik yuz berdi');
        }
      },
    });
  };

  // Handle material request creation/update
  const handleCreateMaterialRequest = async (e) => {
    e.preventDefault();

    // Validation: required dates + at least one valid item
    if (!materialRequestForm.request_date) {
      toast.error(t('request_date_required') || 'Talab sanasi kiritilishi shart');
      return;
    }
    if (!materialRequestForm.items || materialRequestForm.items.length === 0) {
      toast.error(t('add_at_least_one_item') || "Kamida bitta material qo'shing");
      return;
    }
    const invalidItem = materialRequestForm.items.find(
      (it) => !it.product_id || !Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0
    );
    if (invalidItem) {
      toast.error(
        t('invalid_material_item') || "Barcha materiallarni va miqdorni to'g'ri kiriting"
      );
      return;
    }
    if (
      materialRequestForm.required_date &&
      materialRequestForm.request_date &&
      materialRequestForm.required_date < materialRequestForm.request_date
    ) {
      toast.error(
        t('required_before_request') ||
          'Kerakli sana talab sanasidan oldin bo\'lishi mumkin emas'
      );
      return;
    }

    try {
      const scId = materialRequestForm.subcontract_id ? parseInt(materialRequestForm.subcontract_id) : 0;
      const bldId = materialRequestForm.building_id ? parseInt(materialRequestForm.building_id) : 0;
      // Strip internal _key before sending to backend
      const cleanItems = materialRequestForm.items.map(({ _key, ...rest }) => rest);
      const requestData = {
        request_date: materialRequestForm.request_date,
        required_date: materialRequestForm.required_date,
        notes: materialRequestForm.notes,
        items: cleanItems,
        bill_subcontractor: scId > 0,
        subcontract_id: scId,
        building_id: bldId,
      };

      if (materialRequestForm.id) {
        await constructionService.updateMaterialRequest(materialRequestForm.id, requestData);
        toast.success(t('material_request_updated') || 'So\'rov yangilandi');
      } else {
        await constructionService.createMaterialRequest(project.id, requestData);
        toast.success(t('material_request_created') || 'Material so\'rovi yaratildi');
      }
      const materialsData = await constructionService.listMaterialRequests(project.id);
      setMaterialRequests(materialsData || []);
      setShowMaterialRequestModal(false);
      setMaterialRequestForm({
        id: null, request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft', items: [],
        subcontract_id: '', building_id: ''
      });
    } catch (error) {
      console.error('Error saving material request:', error);
      const msg = error?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi';
      toast.error(msg);
    }
  };

  // Add a blank item line to the material request form. Pre-fills
  // warehouse_id with the project's chosen default (migration 365) so
  // every line of every request defaults to the same warehouse — the
  // user can still override per line if a specific material legitimately
  // ships from elsewhere. Empty string when the project has no default,
  // letting the per-line picker appear blank as before.
  const addMaterialRequestItem = () => {
    const defaultWarehouseID = project?.warehouse_id || '';
    setMaterialRequestForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          product_id: '',
          variant_id: '',
          warehouse_id: defaultWarehouseID,
          quantity: 1,
          unit_cost: 0,
          product_name: '',
          unit_name: '',
        },
      ],
    }));
  };

  // Update a specific item field
  const updateMaterialRequestItem = async (index, field, value) => {
    // Capture the stable key at the moment of update so async updates find the
    // right row even if the user reorders/removes items before the promise resolves.
    let targetKey = null;
    setMaterialRequestForm(prev => {
      const items = [...prev.items];
      const current = items[index];
      if (!current) return prev;
      targetKey = current._key || current.id || index;
      items[index] = { ...current, [field]: value };

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
            }).catch(err => console.error('Failed to load variants:', err));
          }
        }
      }

      if (field === 'variant_id') {
        const productId = items[index].product_id;
        const variants = variantsByProduct[productId] || [];
        const variant = variants.find(v => v.id === value);
        if (variant) {
          if (variant.cost_price && variant.cost_price > 0) {
            items[index].unit_cost = variant.cost_price;
          }
          items[index].variant_name = variant.variant_name || variant.display_name || '';
        }
      }

      return { ...prev, items };
    });

    // Warehouse fetch is async — do it after state update to avoid index drift.
    if (field === 'warehouse_id' && value && targetKey != null) {
      const snapshot = materialRequestForm.items[index];
      const productId = snapshot?.product_id;
      const variantId = snapshot?.variant_id;
      if (!productId) return;
      try {
        const invData = await inventoryService.listInventory({ product_id: productId, warehouse_id: value });
        if (!invData || invData.length === 0) return;
        let match = invData[0];
        if (variantId) {
          const variantMatch = invData.find(i => i.variant_id === variantId);
          if (variantMatch) match = variantMatch;
        }
        if (!match.unit_cost || match.unit_cost <= 0) return;

        setMaterialRequestForm(prev2 => {
          const updatedItems = prev2.items.map(it => {
            const key = it._key || it.id;
            if (key === targetKey) {
              return { ...it, unit_cost: match.unit_cost };
            }
            return it;
          });
          return { ...prev2, items: updatedItems };
        });
      } catch (err) {
        console.error('Failed to fetch inventory price:', err);
      }
    }
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
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
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

    // Validation: date cannot be future; temperature sanity checks
    const today = new Date().toISOString().split('T')[0];
    if (!dailyLogForm.report_date) {
      toast.error(t('report_date_required') || 'Hisobot sanasi shart');
      return;
    }
    if (dailyLogForm.report_date > today) {
      toast.error(t('future_date_not_allowed') || "Kelajakdagi sana bo'lishi mumkin emas");
      return;
    }
    const tMin = parseFloat(dailyLogForm.temperature_min);
    const tMax = parseFloat(dailyLogForm.temperature_max);
    if (
      Number.isFinite(tMin) &&
      Number.isFinite(tMax) &&
      tMin > tMax
    ) {
      toast.error(
        t('temp_min_over_max') ||
          "Min harorat Max haroratdan katta bo'lishi mumkin emas"
      );
      return;
    }
    const workersNum = parseInt(dailyLogForm.workers_count, 10);
    if (dailyLogForm.workers_count && (!Number.isFinite(workersNum) || workersNum < 0 || workersNum > 10000)) {
      toast.error(t('invalid_workers_count') || "Ishchilar soni noto'g'ri");
      return;
    }

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
      // Optional executed volume — feeds KS-2 (Forma-2) auto-generation.
      quantity_done: Number(dailyLogForm.quantity_done) || 0,
      uom: (dailyLogForm.uom || '').trim(),
      photos: allPhotos
    };

    try {
      if (dailyLogForm.id) {
        await constructionService.updateDailyReport(dailyLogForm.id, logData);
        toast.success(t('daily_log_updated') || 'Kunlik hisobot yangilandi');
      } else {
        await constructionService.createDailyReport(project.id, logData);
        toast.success(t('daily_log_created') || 'Kunlik hisobot saqlandi');
      }
    } catch (error) {
      console.error('Error saving daily log:', error);
      toast.error(
        error?.response?.data?.message ||
          t('daily_log_save_failed') ||
          'Kunlik hisobotni saqlashda xatolik'
      );
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
      workers_count: '', workers_details: '', equipment_used: '', materials_received: '',
      quantity_done: '', uom: ''
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

  return (
    <div className="space-y-6">
      {/* Full-page blocking overlay while a block is being duplicated.
          Block cloning can take several seconds in production (it copies
          every estimate, line, stage, and file), and the success toast only
          appears once the backend responds. Until then we blur the whole
          page and show a spinner so the user knows work is in progress and
          can't fire a second duplication or navigate away mid-flight. */}
      {cloneEstimatesBusy && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white/40 backdrop-blur-sm cursor-wait"
          role="status"
          aria-live="assertive"
          aria-busy="true"
        >
          <Loader2 className="h-12 w-12 animate-spin text-[#185FA5]" />
          <p className="text-sm font-medium text-slate-700">
            {t('cloning_in_progress') || 'Nusxalanmoqda, kuting...'}
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-9 w-9 p-0 shrink-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label={t('back_to_projects') || 'Loyihalar ro\'yxatiga qaytish'}
            title={t('back_to_projects') || 'Loyihalar ro\'yxatiga qaytish'}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            {/* Breadcrumb above the title: "Qurilish · Loyihalar · {project name}" */}
            <div className="text-[12px] text-slate-500 mb-1 truncate">
              {t('construction') || 'Qurilish'} ·{' '}
              {t('nav_projects') || 'Loyihalar'} ·{' '}
              <span className="text-slate-700">{project.name}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight truncate">
                {project.name}
              </h1>
              {getStatusBadge(project.status)}
            </div>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3 flex-wrap">
          {/* StagesTabV2 portals its "Прораб / Технадзор / Гл.инженер"
             role switcher into this slot when active, so the demo role
             selector lives in the topbar exactly like the v2 mockup
             instead of sitting below the navigation tabs. The element
             is empty whenever the Bosqichlar tab is not the active
             tab — the portal mounts and unmounts automatically with
             the StagesTabV2 component. */}
          <div id="stages-tab-topbar-slot" className="contents" />
        </div>
      </div>

      {/* Navigation — primary tabs (segmented) */}
      <nav
        className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-0 -mb-px"
        role="tablist"
        aria-label={t('project_sections') || "Loyiha bo'limlari"}
      >
        {NAV_GROUPS.map((group) => {
          const Icon = group.icon;
          const isActive = activeGroup === group.key;
          // Live badges (conventions §3): Ish grafigi — muddati o'tgan
          // ishlar soni (red); Materiallar — ochiq zayavkalar soni (amber).
          // null/0 → no chip, so a failed stats call degrades silently.
          const badge =
            group.key === 'grafik' && Number(progressData?.works_overdue) > 0
              ? { count: Number(progressData.works_overdue), cls: 'bg-red-100 text-red-700' }
              : group.key === 'materiallar' && Number(openRequestsCount) > 0
                ? { count: Number(openRequestsCount), cls: 'bg-amber-100 text-amber-700' }
                : null;
          return (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`group-panel-${group.key}`}
              onClick={() => handleGroupClick(group)}
              className={cn(
                'relative inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1',
                isActive
                  ? 'text-slate-900 bg-white border border-slate-200 border-b-white z-10'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-slate-900' : 'text-slate-400')} strokeWidth={2} />
              {group.label}
              {badge && (
                <span
                  className={cn(
                    'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none',
                    badge.cls
                  )}
                >
                  {badge.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sub-navigation — clean pill chips */}
      {currentGroup.subs.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={currentGroup.label}
        >
          {currentGroup.subs.map((sub) => {
            const isActive = activeTab === sub.key;
            return (
              <button
                key={sub.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(sub.key)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                )}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content */}
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#185FA5]" />
              <span className="sr-only">{t('loading') || 'Yuklanmoqda...'}</span>
            </div>
          }
        >
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <OverviewTabContent
            project={project}
            buildings={buildings}
            sections={sections}
            team={team}
            vendors={vendors}
            acts={acts}
            progressData={progressData}
            t={t}
            setActiveGroup={setActiveGroup}
            setActiveTab={setActiveTab}
            onProjectStatusChange={onProjectStatusChange}
          />
        )}

        {/* Buildings Tab */}
        {activeTab === 'buildings' && (<>
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
                    <Card key={building.id} className="border hover:shadow-md transition-shadow overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          {/* min-w-0 lets the flex item shrink below its
                              intrinsic content width so a long no-space
                              building name (e.g. user-entered gibberish)
                              wraps inside the card instead of overflowing
                              and pushing the action buttons off the right
                              edge. break-words handles natural word
                              boundaries; [overflow-wrap:anywhere] forces
                              breaks even inside contiguous strings so the
                              UI stays bounded for adversarial inputs. */}
                          <div className="min-w-0 flex-1">
                            <h3
                              className="font-semibold text-slate-800 break-words [overflow-wrap:anywhere]"
                              title={building.name}
                            >
                              {building.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Inline status switcher — single click to change
                               Qoralama → Jarayonda → Tugallangan without
                               opening the edit modal. The button is colored
                               to match the previous Badge palette so visual
                               state-at-a-glance is preserved. */}
                            <Select
                              value={building.status || 'draft'}
                              onValueChange={async (newStatus) => {
                                if (!newStatus || newStatus === building.status) return;
                                const prev = buildings;
                                setBuildings(buildings.map((b) =>
                                  b.id === building.id ? { ...b, status: newStatus } : b
                                ));
                                try {
                                  await constructionService.updateBuilding(project.id, building.id, { status: newStatus });
                                  toast.success(t('status_updated') || 'Holat yangilandi');
                                } catch (error) {
                                  console.error('Error updating building status:', error);
                                  setBuildings(prev);
                                  toast.error(t('error_occurred') || 'Xatolik yuz berdi');
                                }
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  'h-7 w-auto min-w-[110px] gap-1 rounded-full border-0 px-3 py-0 text-xs font-medium text-white focus:ring-0 focus:ring-offset-0',
                                  building.status === 'completed'
                                    ? 'bg-green-500 hover:bg-green-600'
                                    : building.status === 'in_progress'
                                    ? 'bg-orange-500 hover:bg-orange-600'
                                    : 'bg-gray-500 hover:bg-gray-600'
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">{t('draft') || 'Qoralama'}</SelectItem>
                                <SelectItem value="in_progress">{t('in_progress') || 'Jarayonda'}</SelectItem>
                                <SelectItem value="completed">{t('completed') || 'Tugallangan'}</SelectItem>
                              </SelectContent>
                            </Select>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewBuilding(building)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  {t('view') || "Ko'rish"}
                                </DropdownMenuItem>
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
                                    commercial_units_count: building.commercial_units_count || '',
                                    estimated_cost: building.estimated_cost || '',
                                    status: building.status || 'draft',
                                    subcontractor_org_ids: (building.subcontractor_org_ids || []).map(String),
                                    crm_block_id: building.crm_block_id ?? null,
                                    current_crm_stage: building.current_crm_stage || 'foundation',
                                    crm_auto_sync: building.crm_auto_sync ?? true,
                                  });
                                  setShowBuildingModal(true);
                                }}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  {t('edit') || 'Tahrirlash'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openBuildingFiles(building)}>
                                  <Paperclip className="w-4 h-4 mr-2" />
                                  {t('files') || 'Fayllar'}
                                </DropdownMenuItem>
                                {/* Nusxalash — duplicates this block. Backend creates a
                                    brand new sibling building ("<name> Copy") in the
                                    same project and copies every estimate, line, stage,
                                    and file across. No target picker, no "is it empty"
                                    gating — every click produces a fresh block.
                                    Disabled only while a previous duplication is still
                                    in flight on this same source. */}
                                <DropdownMenuItem
                                  disabled={!!cloneEstimatesBusy}
                                  onClick={() => {
                                    if (cloneEstimatesBusy) return;
                                    setDuplicateModal({ building, count: 1 });
                                  }}
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  {t('clone_estimates') || 'Nusxalash'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setConfirmDelete({
                                      open: true,
                                      title:
                                        t('confirm_delete_building') ||
                                        "Binoni o'chirishni tasdiqlaysizmi?",
                                      description:
                                        t('delete_building_warning') ||
                                        `"${building.name}" binosi va unga tegishli barcha ma'lumotlar o'chiriladi.`,
                                      onConfirm: async () => {
                                        try {
                                          await constructionService.deleteBuilding(project.id, building.id);
                                          const buildingsData = await constructionService.listBuildings(project.id);
                                          setBuildings(sortBuildings(buildingsData));
                                          toast.success(t('building_deleted') || "Bino o'chirildi");
                                        } catch (error) {
                                          console.error('Error deleting building:', error);
                                          toast.error(t('error_occurred') || 'Xatolik yuz berdi');
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
                            {/* The `total_area` translation already
                               includes "(m²)" in every locale, so the
                               extra " (m²)" suffix here was rendering
                               the unit twice ("Total Area (m²) (m²)"). */}
                            <span className="text-slate-500">{t('total_area') || 'Umumiy maydon (m²)'}</span>
                            <span className="font-medium">{building.total_area ? `${building.total_area} m²` : '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('apartments') || 'Xonadonlar'}</span>
                            <span className="font-medium">{building.apartments_count || '-'}</span>
                          </div>
                          {/* "Taxminiy xarajat" row removed — there's no input
                             for it in the create/edit building modal, so the
                             value was always "-" and looked like missing data. */}
                        </div>
                        <div className="mt-4">
                          <p className="text-xs text-slate-500 mb-1">{t('progress') || 'Progress'}</p>
                          <Progress value={building.progress_percent || 0} className="h-2" />
                          <p className="text-xs text-right mt-1">{building.progress_percent || 0}%</p>
                        </div>
                        {/* Files button — opens the existing modal where users can
                            upload new files and download/delete attached ones. */}
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-center text-slate-700 hover:text-slate-900"
                            onClick={() => openBuildingFiles(building)}
                          >
                            <Paperclip className="w-4 h-4 mr-2" />
                            {t('files') || 'Fayllar'}
                            {typeof building.files_count === 'number' && building.files_count > 0 && (
                              <Badge variant="secondary" className="ml-2">{building.files_count}</Badge>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* "Ishlar tuzilmasi (WBS)" section removed from the Binolar tab —
             the team uses the Smeta boshqaruvi flow for work structure now,
             so the empty WBS tree below the buildings card was just noise. */}
        </>)}

        {/* Estimates Tab */}
        {activeTab === 'estimates' && (
          <EstimatesTab project={project} wbsItems={wbsTree} buildings={buildings} subcontracts={projectSubcontracts} />
        )}

        {/* Smeta boshqaruvi — drilled-in per-estimate dashboard. */}
        {activeTab === 'smeta_management' && (
          <SmetaManagementTab project={project} />
        )}

        {/* Daily Journal Tab (WBS-linked progress) */}
        {activeTab === 'daily_journal' && (
          <DailyJournalTab project={project} wbsItems={wbsTree} buildings={buildings} />
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
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
                            aria-label={t('remove_member') || "A'zoni o'chirish"}
                            title={t('remove_member') || "A'zoni o'chirish"}
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
        )}

        {/* Materials Tab - Removed: reservations now handled via Inventory */}
        {false && activeTab === 'materials' && (
          <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('material_requests') || 'Material so\'rovlari'}</CardTitle>
                <Button size="sm" onClick={() => {
                  setMaterialRequestForm({
                    id: null, request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft', items: [],
        subcontract_id: ''
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
                                    // Ensure every item has a stable _key for React rendering and async updates
                                    const keyed = parsedItems.map((it, i) => ({
                                      ...it,
                                      _key: it._key || it.id || `edit-${req.id}-${i}`,
                                    }));
                                    setMaterialRequestForm({
                                      id: req.id,
                                      request_date: req.request_date ? req.request_date.split('T')[0] : new Date().toISOString().split('T')[0],
                                      required_date: req.required_date ? req.required_date.split('T')[0] : '',
                                      notes: req.notes || '',
                                      status: req.status || 'draft',
                                      items: keyed,
                                      subcontract_id: req.subcontract_id ? String(req.subcontract_id) : '',
                                      building_id: req.building_id ? String(req.building_id) : '',
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
                                      title:
                                        t('confirm_delete_material_request') ||
                                        "Material so'rovini o'chirishni tasdiqlaysizmi?",
                                      description:
                                        t('material_request_delete_warning') ||
                                        "So'rov va unga tegishli qatorlar o'chiriladi. Tasdiqlangan so'rovlarni o'chirib bo'lmaydi.",
                                      onConfirm: async () => {
                                        try {
                                          await constructionService.deleteMaterialRequest(req.id);
                                          const materialsData = await constructionService.listMaterialRequests(project.id);
                                          setMaterialRequests(materialsData || []);
                                          toast.success(t('material_request_deleted') || "So'rov o'chirildi");
                                        } catch (error) {
                                          console.error('Error deleting material request:', error);
                                          toast.error(t('error_occurred') || 'Xatolik yuz berdi');
                                        }
                                      },
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
        )}

        {/* Daily Logs Tab */}
        {activeTab === 'daily_logs' && (
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
                  workers_count: '', workers_details: '', equipment_used: '', materials_received: '',
                  quantity_done: '', uom: ''
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
                      workers_count: '', workers_details: '', equipment_used: '', materials_received: '',
                      quantity_done: '', uom: ''
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
                                  materials_received: jsonbFieldToString(log.materials_received),
                                  quantity_done: log.quantity_done || '',
                                  uom: log.uom || ''
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
                                    title:
                                      t('confirm_delete_daily_log') ||
                                      "Kunlik hisobotni o'chirishni tasdiqlaysizmi?",
                                    description:
                                      t('daily_log_delete_warning') ||
                                      "Hisobot va biriktirilgan suratlar o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
                                    onConfirm: async () => {
                                      try {
                                        await constructionService.deleteDailyReport(log.id);
                                        const logsData = await constructionService.listDailyReports(project.id);
                                        setDailyLogs(logsData || []);
                                        toast.success(t('daily_log_deleted') || "Hisobot o'chirildi");
                                      } catch (error) {
                                        console.error('Error deleting daily log:', error);
                                        toast.error(t('error_occurred') || 'Xatolik yuz berdi');
                                      }
                                    },
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
                          {Number(log.quantity_done) > 0 && (
                            <span className="tabular-nums">· {log.quantity_done} {log.uom || ''}</span>
                          )}
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
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <Card>
            <CardContent className="p-6">
              <ActivityTab projectId={project.id} t={t} />
            </CardContent>
          </Card>
        )}

        {/* Stages Tab */}
        {activeTab === 'stages' && (
          <StagesTab
            project={project}
            setActiveGroup={setActiveGroup}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Ish grafigi (work schedule Gantt) Tab */}
        {activeTab === 'work_schedule' && (
          <WorkScheduleTab
            project={project}
            onOpenSmeta={() => { setActiveGroup('smeta'); setActiveTab('smeta_management'); }}
          />
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <ExpensesTab project={project} />
        )}

        {/* Budget Plan vs Actual Tab */}
        {activeTab === 'budget' && (
          <BudgetTab project={project} />
        )}

        {/* Reja vs Fakt Tab */}
        {activeTab === 'reja_fakt' && (
          <RejaFaktTab project={project} />
        )}

        {/* Material Usage Tab */}
        {activeTab === 'material_usage' && (
          <MaterialUsageTab project={project} />
        )}

        {/* Subcontractors Tab */}
        {activeTab === 'subcontractors' && (
          <SubcontractorsTab project={project} buildings={buildings} wbsItems={wbsTree} />
        )}

        {/* Material zayavkalari (loyiha ko'lami) */}
        {activeTab === 'material_requests' && (
          <MaterialRequestsPanel mode="project" projectId={project.id} />
        )}

        {/* Forms (Forma 2/3/19) Tab */}
        {activeTab === 'forms' && (
          <FormsTab project={project} />
        )}

        {/* Acts (Acceptance/Defect) Tab */}
        {activeTab === 'acts' && (
          <ActsTab project={project} />
        )}

        {/* Smeta vs Fact Tab */}
        {activeTab === 'smeta_vs_fact' && (
          <SmetaVsFactTab project={project} />
        )}

        {/* Financial Analysis (Tahlil) tab removed — see comment in
            sidebar definition. The render slot is kept here as a no-op
            stub so any deep-link with ?tab=financial still loads the
            page without exploding. */}

        {/* Team Tab (Full) */}
        {activeTab === 'team_tab' && (
          <TeamTab project={project} />
        )}
        </Suspense>
      </div>

      {/* Building view (Ko'rish) modal — read-only block detail. */}
      <Dialog open={!!viewBuilding} onOpenChange={(o) => { if (!o) setViewBuilding(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby="building-view-help">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{viewBuilding?.name || '—'}</span>
              {viewBuilding?.status && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {viewBuilding.status === 'completed' ? (t('completed') || 'Tugallangan')
                    : viewBuilding.status === 'in_progress' ? (t('in_progress') || 'Jarayonda')
                    : (t('draft') || 'Qoralama')}
                </span>
              )}
            </DialogTitle>
            <p id="building-view-help" className="text-sm text-slate-500">
              {t('building_details') || "Blok ma'lumotlari"}
            </p>
          </DialogHeader>
          {viewBuilding && (() => {
            const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
            const num = (v) => (Number(v) ? Number(v).toLocaleString('ru-RU') : '—');
            const rows = [
              [t('code') || 'Kod', dash(viewBuilding.code)],
              [t('building_type') || 'Bino turi', dash(viewBuilding.building_type)],
              [t('building_purpose') || 'Bino maqsadi', dash(viewBuilding.building_purpose)],
              [t('floors_count') || 'Qavatlar soni', num(viewBuilding.floors_count)],
              [t('total_area') || 'Umumiy maydon (m²)', num(viewBuilding.total_area)],
              [t('apartments_count') || 'Xonadonlar', num(viewBuilding.apartments_count)],
              [t('commercial_units') || 'Tijorat birliklari', num(viewBuilding.commercial_units_count)],
              [t('estimated_cost') || 'Taxminiy narx', Number(viewBuilding.estimated_cost) ? `${Number(viewBuilding.estimated_cost).toLocaleString('ru-RU')} ${t('currency_som') || "so'm"}` : '—'],
            ];
            return (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="text-sm text-slate-500">{label}</span>
                      <span className="text-sm font-medium text-slate-900 text-right break-words">{value}</span>
                    </div>
                  ))}
                </div>
                {viewBuilding.description && (
                  <div className="rounded-lg border border-slate-200 px-4 py-2.5">
                    <p className="text-xs text-slate-500 mb-1">{t('description') || 'Tavsif'}</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{viewBuilding.description}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => { const b = viewBuilding; setViewBuilding(null); openBuildingFiles(b); }}>
                    <Paperclip className="w-4 h-4 mr-2" />
                    {t('files') || 'Fayllar'}
                  </Button>
                  <Button onClick={() => setViewBuilding(null)}>
                    {t('close') || 'Yopish'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Building Modal */}
      <Dialog open={showBuildingModal} onOpenChange={setShowBuildingModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="building-form-help">
          <DialogHeader>
            <DialogTitle>{buildingForm.id ? (t('edit_building') || "Binoni tahrirlash") : (t('new_building') || "Yangi bino")}</DialogTitle>
            <p id="building-form-help" className="text-sm text-slate-500">
              {t('building_form_help') || "Loyihadagi bino/blok haqida ma'lumot kiriting."}
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateBuilding} className="space-y-4">
            <div>
              <Label htmlFor="bld-name">
                {t('building_name') || 'Bino nomi'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bld-name"
                value={buildingForm.name}
                onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                placeholder={t('building_name_placeholder') || "A blok, 16 qavatli uy"}
                required
                maxLength={150}
              />
            </div>
            <div>
              <Label htmlFor="bld-desc">{t('description') || 'Tavsif'}</Label>
              <Textarea
                id="bld-desc"
                value={buildingForm.description}
                onChange={(e) => setBuildingForm({ ...buildingForm, description: e.target.value })}
                rows={2}
                placeholder={t('optional') || "Ixtiyoriy"}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bld-type">{t('building_type') || 'Bino turi'}</Label>
                <Select value={buildingForm.building_type} onValueChange={(v) => setBuildingForm({ ...buildingForm, building_type: v })}>
                  <SelectTrigger id="bld-type">
                    <SelectValue placeholder={t('select') || 'Tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">{t('residential') || 'Turar-joy'}</SelectItem>
                    <SelectItem value="non_residential">{t('non_residential') || 'Noturar'}</SelectItem>
                    <SelectItem value="residential_non_residential">{t('residential_non_residential') || 'Turar/noturar'}</SelectItem>
                    <SelectItem value="commercial">{t('commercial') || 'Tijorat'}</SelectItem>
                    <SelectItem value="parking">{t('parking') || 'Avtoturargoh'}</SelectItem>
                    <SelectItem value="mixed">{t('mixed') || 'Aralash'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bld-floors">{t('floors_count') || 'Qavatlar soni'}</Label>
                <Input
                  id="bld-floors"
                  type="number"
                  min="0"
                  max="200"
                  step="1"
                  inputMode="numeric"
                  value={buildingForm.floors_count}
                  onChange={(e) => setBuildingForm({ ...buildingForm, floors_count: e.target.value })}
                  placeholder="16"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bld-area">{t('total_area') || 'Umumiy maydon (m²)'}</Label>
                <NumberInput
                  id="bld-area"
                  value={buildingForm.total_area}
                  onChange={(raw) => setBuildingForm({ ...buildingForm, total_area: raw })}
                  placeholder="5000"
                />
              </div>
              {/* Units field — shape depends on building_type:
                    • non_residential                → single "Noturar xonalar" input
                      (mapped to commercial_units_count on the backend).
                    • residential_non_residential    → row collapses, two inputs are
                      rendered below in a separate grid: "Turar xonadonlar"
                      (apartments_count) + "Noturar xonalar"
                      (commercial_units_count).
                    • everything else (incl. blank)  → single "Xonadonlar soni"
                      input (apartments_count), original behaviour. */}
              {buildingForm.building_type === 'non_residential' ? (
                <div>
                  <Label htmlFor="bld-non-res-units">{t('non_residential_units') || 'Noturar xonalar'}</Label>
                  <NumberInput
                    id="bld-non-res-units"
                    allowDecimal={false}
                    value={buildingForm.commercial_units_count}
                    onChange={(raw) => setBuildingForm({ ...buildingForm, commercial_units_count: raw })}
                    placeholder="32"
                  />
                </div>
              ) : buildingForm.building_type === 'residential_non_residential' ? (
                // Placeholder to keep the 2-col grid balanced; the real
                // inputs live in the next grid below where both sit on
                // their own row, side by side, with full width each.
                <div />
              ) : (
                <div>
                  <Label htmlFor="bld-apts">{t('apartments_count') || 'Xonadonlar soni'}</Label>
                  <NumberInput
                    id="bld-apts"
                    allowDecimal={false}
                    value={buildingForm.apartments_count}
                    onChange={(raw) => setBuildingForm({ ...buildingForm, apartments_count: raw })}
                    placeholder="64"
                  />
                </div>
              )}
            </div>
            {/* When building is mixed residential + non-residential, give
               each unit-count input its own labelled cell on a dedicated
               row so both numbers are equally prominent. */}
            {buildingForm.building_type === 'residential_non_residential' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bld-res-units">{t('residential_units') || 'Turar xonadonlar'}</Label>
                  <NumberInput
                    id="bld-res-units"
                    allowDecimal={false}
                    value={buildingForm.apartments_count}
                    onChange={(raw) => setBuildingForm({ ...buildingForm, apartments_count: raw })}
                    placeholder="64"
                  />
                </div>
                <div>
                  <Label htmlFor="bld-non-res-units-mix">{t('non_residential_units') || 'Noturar xonalar'}</Label>
                  <NumberInput
                    id="bld-non-res-units-mix"
                    allowDecimal={false}
                    value={buildingForm.commercial_units_count}
                    onChange={(raw) => setBuildingForm({ ...buildingForm, commercial_units_count: raw })}
                    placeholder="12"
                  />
                </div>
              </div>
            )}
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

            {/* CRM block link — only meaningful once the building has been
                saved (so we have an ID for the /crm-link PUT) AND the parent
                project is linked to a CRM project (so we can filter the
                block dropdown by it). */}
            {buildingForm.id && project?.crm_project_id && (
              <CRMLinkPanel
                mode="block"
                crmProjectId={project.crm_project_id}
                value={{
                  crmBlockId: buildingForm.crm_block_id,
                  currentStage: buildingForm.current_crm_stage,
                  autoSync: buildingForm.crm_auto_sync,
                }}
                onChange={(v) => setBuildingForm({
                  ...buildingForm,
                  crm_block_id: v.crmBlockId,
                  current_crm_stage: v.currentStage,
                  crm_auto_sync: v.autoSync,
                })}
                language={language}
              />
            )}
            {buildingForm.id && !project?.crm_project_id && (
              <div className="border rounded-lg p-3 bg-amber-50 border-amber-200 text-xs text-amber-800">
                {(() => {
                  // t() returns the key itself when no translation exists, so
                  // the || fallback never fires. Detect that and hand back the
                  // hand-rolled Uzbek message instead of the raw key.
                  const translated = t('link_project_to_crm_first');
                  if (!translated || translated === 'link_project_to_crm_first') {
                    return "Avval loyihani CRM bilan bog'lang (loyihani tahrirlash) — keyin shu binoni CRM blokiga ulay olasiz.";
                  }
                  return translated;
                })()}
              </div>
            )}

            {/* Subcontractor assignment — owner-controlled. The companies/partners
                picked here are the only ones that will see and work this block.
                A block may be assigned to several subcontractors. Hidden for
                subcontractor viewers; the backend also rejects their writes. */}
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2" style={{ display: project?.viewer_role === 'subcontractor' ? 'none' : undefined }}>
              <Label className="text-slate-700 font-semibold">
                {language === 'ru' ? 'Субподрядчики блока (компании)' : language === 'uz' ? 'Blok subpudratchilari (kompaniyalar)' : 'Block subcontractors (companies)'}
              </Label>
              {(() => {
                // Candidate companies = tenant orgs other than this project's
                // owner company. Picking one auto-creates its subcontract.
                const ownerOrgId = project?.organization_id ? String(project.organization_id) : null;
                const candidates = (orgs || []).filter((o) => String(o.id) !== ownerOrgId);
                if (candidates.length === 0) {
                  return (
                    <p className="text-xs text-slate-400">
                      {language === 'ru' ? 'Нет других компаний в этом тенанте.'
                        : language === 'uz' ? "Bu tenantda boshqa kompaniyalar yo'q."
                        : 'No other companies in this tenant.'}
                    </p>
                  );
                }
                return (
                  <>
                    <div className="max-h-40 overflow-y-auto border rounded-md divide-y bg-white">
                      {candidates.map((o) => {
                        const oid = String(o.id);
                        const checked = (buildingForm.subcontractor_org_ids || []).map(String).includes(oid);
                        return (
                          <label key={oid} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={checked}
                              onChange={() => setBuildingForm((f) => {
                                const cur = (f.subcontractor_org_ids || []).map(String);
                                return {
                                  ...f,
                                  subcontractor_org_ids: cur.includes(oid)
                                    ? cur.filter((x) => x !== oid)
                                    : [...cur, oid],
                                };
                              })}
                            />
                            <span>{o.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {language === 'ru' ? 'Выбранная компания получит субподряд по этому блоку и увидит его в своих проектах.'
                        : language === 'uz' ? "Tanlangan kompaniya shu blok bo'yicha subpudrat oladi va uni o'z loyihalarida ko'radi."
                        : 'A picked company gets a subcontract for this block and sees it in its projects.'}
                    </p>
                  </>
                );
              })()}
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBuildingModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{buildingForm.id ? (t('update') || 'Yangilash') : (t('create') || 'Yaratish')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* (Removed) The old clone-estimates modal was a target-picker;
          the new "Nusxalash" flow always creates a brand-new sibling
          block server-side, so no UI input is needed. The state
          variables `cloneEstimatesModal` / `setCloneEstimatesModal`
          are kept around because the rest of this file still references
          them in dead-code paths; they no longer drive any visible UI. */}
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg" aria-describedby="clone-estimates-help">
          <DialogHeader>
            <DialogTitle>
              {t('clone_estimates') || 'Smetalarni klonlash'}
            </DialogTitle>
          </DialogHeader>
          <div id="clone-estimates-help" className="space-y-4 text-sm">
            <p className="text-slate-600">
              {(t('clone_estimates_help') ||
                "Boshqa blokdagi barcha smetalar (Единич, ВОР, Ресурс), ularning satrlari va bosqichlari joriy blokga nusxalanadi. FAKT ma'lumotlari (bajarilgan ish, sana, status) nusxalanmaydi. Bu amal blokda hozircha smeta bo'lmaganda ishlaydi.")}
            </p>

            <div>
              <Label className="text-slate-500 text-xs">
                {t('target_block') || 'Maqsad blok'}
              </Label>
              <div className="mt-1 font-medium">
                {cloneEstimatesModal?.target?.name || '—'}
              </div>
            </div>

            <div>
              <Label htmlFor="clone-source-block">
                {t('source_block') || 'Manba blok'}
              </Label>
              <Select
                value={cloneEstimatesModal?.sourceId || ''}
                onValueChange={(v) =>
                  setCloneEstimatesModal((m) => (m ? { ...m, sourceId: v } : m))
                }
              >
                <SelectTrigger id="clone-source-block" className="mt-1">
                  <SelectValue placeholder={t('select') || 'Tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  {(buildings || [])
                    .filter((b) => Number(b?.id) !== Number(cloneEstimatesModal?.target?.id))
                    .filter((b) => (estimateCountByBuildingId[Number(b?.id)] || 0) > 0)
                    .map((b) => {
                      const n = estimateCountByBuildingId[Number(b?.id)] || 0;
                      return (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name} · {n} {t('smeta_short') || 'smeta'}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">
                {(t('clone_source_hint') ||
                  "Faqat smetasi bor bloklar ko'rsatiladi.")}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={cloneEstimatesBusy}
              onClick={() => setCloneEstimatesModal(null)}
            >
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              type="button"
              disabled={cloneEstimatesBusy || !cloneEstimatesModal?.sourceId}
              onClick={async () => {
                const target = cloneEstimatesModal?.target;
                const sourceId = cloneEstimatesModal?.sourceId;
                if (!target?.id || !sourceId || !project?.id) return;
                setCloneEstimatesBusy(true);
                try {
                  const res = await constructionService.cloneBuildingEstimates(
                    project.id, target.id, sourceId,
                  );
                  toast.success(
                    `${t('clone_done') || 'Nusxalash bajarildi'}: ` +
                    `${res?.estimates_created ?? 0} smeta · ` +
                    `${res?.lines_created ?? 0} satr · ` +
                    `${res?.stages_created ?? 0} bosqich · ` +
                    `${res?.files_created ?? 0} fayl`,
                  );
                  // Refresh block list AND estimate counts so the menu
                  // entry on the target is now correctly disabled and
                  // the Smetalar tab shows the copies on next visit.
                  try {
                    const [buildingsData, allEstimates] = await Promise.all([
                      constructionService.listBuildings(project.id),
                      constructionService.listEstimates(project.id).catch(() => []),
                    ]);
                    setBuildings(sortBuildings(buildingsData));
                    const counts = {};
                    for (const e of (allEstimates || [])) {
                      const bid = Number(e?.building_id || 0);
                      if (!bid) continue;
                      counts[bid] = (counts[bid] || 0) + 1;
                    }
                    setEstimateCountByBuildingId(counts);
                  } catch { /* non-fatal — the next tab visit will reload */ }
                  setCloneEstimatesModal(null);
                } catch (err) {
                  // The backend uses two error envelope shapes depending on
                  // which helper fired:
                  //   { success:false, code: "TARGET_NOT_EMPTY", error: "string" }  ← gin.H from CloneBuildingEstimates
                  //   { success:false, error: { code: 500, message: "..." } }       ← response.InternalError wrapper
                  // Read `code` from either, and pull the human-readable
                  // text out of whichever string-shaped field actually has
                  // one. toast.error must receive a string — passing the
                  // object directly broke React with "Objects are not valid
                  // as a React child (found: object with keys {code, message})".
                  const data = err?.response?.data || {};
                  const code = data.code
                    || (typeof data.error === 'object' ? data.error?.code : undefined);
                  const backendMessage = typeof data.error === 'string'
                    ? data.error
                    : (data.error?.message || data.message);
                  const msg = code === 'TARGET_NOT_EMPTY'
                    ? (t('clone_target_not_empty') ||
                       "Maqsad blokda allaqachon smeta bor.")
                    : code === 'SOURCE_EMPTY'
                    ? (t('clone_source_empty') ||
                       "Manba blokda smeta yo'q.")
                    : (backendMessage || err?.message ||
                       (t('error_occurred') || 'Xatolik yuz berdi'));
                  toast.error(String(msg));
                } finally {
                  setCloneEstimatesBusy(false);
                }
              }}
            >
              {cloneEstimatesBusy
                ? (t('cloning') || 'Nusxalanmoqda...')
                : (t('clone') || 'Nusxalash')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate-building modal — asks how many copies to create, then
          clones the source block that many times. Each call is sequential so
          the backend's "<name> Copy", "Copy (2)", "Copy (3)"… auto-numbering
          stays correct. The full-page blur loader (cloneEstimatesBusy) covers
          the whole run. */}
      <Dialog open={!!duplicateModal} onOpenChange={(o) => { if (!o && !cloneEstimatesBusy) setDuplicateModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('duplicate_building') || 'Binoni nusxalash'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-500">
              {duplicateModal?.building?.name
                ? `"${duplicateModal.building.name}" — ${t('how_many_copies') || 'nechta nusxa yaratamiz?'}`
                : (t('how_many_copies') || 'Nechta nusxa yaratamiz?')}
            </p>
            <div>
              <Label htmlFor="dup-count">{t('copies_count') || 'Nusxalar soni'}</Label>
              <Input
                id="dup-count"
                type="number"
                min={1}
                max={50}
                className="mt-1"
                value={duplicateModal?.count ?? 1}
                onChange={(e) => {
                  const v = e.target.value;
                  setDuplicateModal((m) => (m ? { ...m, count: v } : m));
                }}
              />
              <p className="text-xs text-slate-400 mt-1">
                {t('copies_count_hint') || "Har bir nusxa smeta, satr, bosqich va fayllar bilan to'liq ko'chiriladi (1–50)."}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!!cloneEstimatesBusy}
              onClick={() => setDuplicateModal(null)}
            >
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              type="button"
              disabled={!!cloneEstimatesBusy || !duplicateModal?.building?.id}
              onClick={async () => {
                const building = duplicateModal?.building;
                if (!building?.id || !project?.id) return;
                const n = Math.max(1, Math.min(50, Math.floor(Number(duplicateModal?.count) || 1)));
                setDuplicateModal(null);
                setCloneEstimatesBusy(Number(building.id));
                let ok = 0;
                let fail = 0;
                let lastErr = '';
                // Sequential — each copy must commit before the next so the
                // backend sees the previous "<name> Copy" and increments.
                for (let i = 0; i < n; i++) {
                  try {
                    await constructionService.duplicateBuilding(project.id, building.id);
                    ok += 1;
                  } catch (err) {
                    fail += 1;
                    const data = err?.response?.data || {};
                    lastErr = typeof data.error === 'string'
                      ? data.error
                      : (data.error?.message || data.message || err?.message || '');
                  }
                }
                // Refresh the block list + estimate counts once at the end.
                try {
                  const [buildingsData, allEstimates] = await Promise.all([
                    constructionService.listBuildings(project.id),
                    constructionService.listEstimates(project.id).catch(() => []),
                  ]);
                  setBuildings(sortBuildings(buildingsData));
                  const counts = {};
                  for (const e of (allEstimates || [])) {
                    const bid = Number(e?.building_id || 0);
                    if (!bid) continue;
                    counts[bid] = (counts[bid] || 0) + 1;
                  }
                  setEstimateCountByBuildingId(counts);
                } catch { /* non-fatal */ }
                if (ok > 0) {
                  toast.success(
                    `${t('duplicate_done') || 'Nusxalash bajarildi'}: ` +
                    `${ok} ${t('copies_short') || 'nusxa'}` +
                    (fail > 0 ? ` · ${fail} ${t('failed_short') || 'xato'}` : ''),
                  );
                }
                if (ok === 0) {
                  toast.error(String(lastErr || (t('error_occurred') || 'Xatolik yuz berdi')));
                }
                setCloneEstimatesBusy(false);
              }}
            >
              {cloneEstimatesBusy
                ? (t('cloning') || 'Nusxalanmoqda...')
                : (t('create') || 'Yaratish')}
            </Button>
          </DialogFooter>
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
        <DialogContent aria-describedby="team-form-help">
          <DialogHeader>
            <DialogTitle>{t('add_team_member') || "Jamoa a'zosini qo'shish"}</DialogTitle>
            <p id="team-form-help" className="text-sm text-slate-500">
              {t('team_form_help') ||
                "Loyihada ishtirok etadigan xodimni tanlang va uning vazifasini belgilang."}
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateTeamMember} className="space-y-4">
            <div>
              <Label htmlFor="team-employee">
                {t('employee') || 'Xodim'} <span className="text-red-500">*</span>
              </Label>
              {employees.length === 0 ? (
                <div className="mt-1 p-3 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-800">
                  {t('no_employees_hint') ||
                    "Xodimlar ro'yxati bo'sh. Avval \"Xodimlar boshqaruvi\" modulida xodim qo'shing."}
                </div>
              ) : (
                <Select
                  value={teamForm.employee_id}
                  onValueChange={(value) => setTeamForm({ ...teamForm, employee_id: value })}
                >
                  <SelectTrigger id="team-employee">
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
              )}
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
                  <SelectItem value="foreman">{t('foreman') || 'Prorab'}</SelectItem>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="mr-help">
          <DialogHeader>
            <DialogTitle>{materialRequestForm.id ? (t('edit_material_request') || "Material so'rovini tahrirlash") : (t('new_material_request') || "Yangi material so'rovi")}</DialogTitle>
            <p id="mr-help" className="text-sm text-slate-500">
              {t('material_request_help') ||
                "Qurilish uchun kerak bo'ladigan materiallarni tanlang. So'rov tasdiqlangach, omborga avtomatik ravishda zayavka ketadi."}
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateMaterialRequest} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mr-req-date">
                  {t('request_date') || "So'rov sanasi"} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mr-req-date"
                  type="date"
                  value={materialRequestForm.request_date}
                  onChange={(e) => setMaterialRequestForm({ ...materialRequestForm, request_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mr-needed-date">{t('required_date') || 'Kerak bo\'lgan sana'}</Label>
                <Input
                  id="mr-needed-date"
                  type="date"
                  value={materialRequestForm.required_date}
                  onChange={(e) => setMaterialRequestForm({ ...materialRequestForm, required_date: e.target.value })}
                  min={materialRequestForm.request_date || undefined}
                />
              </div>
            </div>

            {/* Building selector */}
            {buildings.length > 0 && (
              <div>
                <Label>{t('building') || 'Bino'}</Label>
                <Select
                  value={materialRequestForm.building_id || "none"}
                  onValueChange={(val) => setMaterialRequestForm({ ...materialRequestForm, building_id: val === "none" ? '' : val })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('select_building') || 'Bino tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('all_buildings') || 'Barcha binolar'}</SelectItem>
                    {buildings.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                    const rowKey = item._key || item.id || `item-${index}`;
                    return (
                      <div key={rowKey} className="rounded-lg border bg-slate-50 p-3 space-y-3 pb-3">
                        {/* Row 1: Product + Variant + Delete */}
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-red-500 shrink-0 self-end sm:self-center"
                            onClick={() => removeMaterialRequestItem(index)}
                            aria-label={t('remove_item') || "Qatorni o'chirish"}
                            title={t('remove_item') || "Qatorni o'chirish"}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Row 2: Warehouse | Qty + UOM | Price */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            <NumberInput
                              className="h-9 text-sm flex-1"
                              placeholder={t('qty') || 'Son'}
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(raw) => updateMaterialRequestItem(index, 'quantity', raw === '' ? 0 : parseFloat(raw) || 0)}
                            />
                            <span className="text-xs text-slate-500 whitespace-nowrap min-w-[30px]">{item.unit_name || product?.unit_name || t('pcs') || 'dona'}</span>
                          </div>
                          <NumberInput
                            className="h-9 text-sm"
                            placeholder={t('unit_price') || 'Narx'}
                            value={item.unit_cost === 0 ? '' : item.unit_cost}
                            onChange={(raw) => updateMaterialRequestItem(index, 'unit_cost', raw === '' ? 0 : parseFloat(raw) || 0)}
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

            {/* Subcontractor selection */}
            {projectSubcontracts.length > 0 && (
              <div>
                <Label>{t('subcontractor') || 'Pudratchi'}</Label>
                <Select
                  value={materialRequestForm.subcontract_id || "none"}
                  onValueChange={(val) => setMaterialRequestForm({ ...materialRequestForm, subcontract_id: val === "none" ? '' : val })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('select_subcontractor') || 'Pudratchi tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_subcontractor') || 'Pudratchi tanlanmagan (kompaniya)'}</SelectItem>
                    {projectSubcontracts.map(sc => (
                      <SelectItem key={sc.id} value={String(sc.id)}>
                        {sc.name} — {sc.partner_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
      <Dialog
        open={showDailyLogModal}
        onOpenChange={(open) => {
          setShowDailyLogModal(open);
          if (!open) {
            setDailyLogFiles([]);
            setDailyLogPhotoPreview([]);
            setDailyLogForm({
              id: null,
              report_date: new Date().toISOString().split('T')[0],
              weather_morning: '',
              weather_afternoon: '',
              temperature_min: '',
              temperature_max: '',
              work_summary: '',
              issues_encountered: '',
              safety_notes: '',
              workers_count: '',
              workers_details: '',
              equipment_used: '',
              materials_received: '',
              quantity_done: '',
              uom: '',
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="daily-log-help">
          <DialogHeader>
            <DialogTitle>{dailyLogForm.id ? (t('edit_daily_log') || 'Kunlik hisobotni tahrirlash') : (t('new_daily_log') || 'Yangi kunlik hisobot')}</DialogTitle>
            <p id="daily-log-help" className="text-sm text-slate-500">
              {t('daily_log_help') ||
                "Kun davomida bajarilgan ishlar, ob-havo va ishchilar haqida qisqacha yozing. Yulduzcha (*) majburiy maydon."}
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateDailyLog} className="space-y-4">
            <div>
              <Label htmlFor="dl-date">
                {t('report_date') || 'Hisobot sanasi'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dl-date"
                type="date"
                value={dailyLogForm.report_date}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, report_date: e.target.value })}
                required
                max={new Date().toISOString().split('T')[0]}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dl-tmin">{t('temperature_min') || 'Min harorat (°C)'}</Label>
                  <Input
                    id="dl-tmin"
                    type="number"
                    min="-60"
                    max="60"
                    step="0.1"
                    inputMode="decimal"
                    value={dailyLogForm.temperature_min}
                    onChange={(e) => setDailyLogForm({ ...dailyLogForm, temperature_min: e.target.value })}
                    placeholder="-5"
                  />
                </div>
                <div>
                  <Label htmlFor="dl-tmax">{t('temperature_max') || 'Max harorat (°C)'}</Label>
                  <Input
                    id="dl-tmax"
                    type="number"
                    min="-60"
                    max="60"
                    step="0.1"
                    inputMode="decimal"
                    value={dailyLogForm.temperature_max}
                    onChange={(e) => setDailyLogForm({ ...dailyLogForm, temperature_max: e.target.value })}
                    placeholder="15"
                  />
                </div>
              </div>
            </div>

            {/* Work Summary */}
            <div>
              <Label htmlFor="dl-summary">{t('work_summary') || 'Bajarilgan ishlar'}</Label>
              <Textarea
                id="dl-summary"
                value={dailyLogForm.work_summary}
                onChange={(e) => setDailyLogForm({ ...dailyLogForm, work_summary: e.target.value })}
                placeholder={t('work_summary_placeholder') || 'Bugun bajarilgan ishlar tavsifi...'}
                rows={3}
              />
            </div>

            {/* Executed volume — optional, but without it KS-2 (Forma-2)
                auto-generation gets 0 volume from journal entries. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dl-qty-done">{t('dl_quantity_done') || 'Bajarilgan hajm'}</Label>
                <Input
                  id="dl-qty-done"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={dailyLogForm.quantity_done}
                  onChange={(e) => setDailyLogForm({ ...dailyLogForm, quantity_done: e.target.value })}
                  placeholder="12.5"
                />
              </div>
              <div>
                <Label htmlFor="dl-uom">{t('dl_uom') || 'Birlik'}</Label>
                <Input
                  id="dl-uom"
                  value={dailyLogForm.uom}
                  onChange={(e) => setDailyLogForm({ ...dailyLogForm, uom: e.target.value })}
                  placeholder="m3"
                  maxLength={20}
                />
              </div>
            </div>

            {/* Workers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dl-workers">{t('workers_count') || 'Ishchilar soni'}</Label>
                <Input
                  id="dl-workers"
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  inputMode="numeric"
                  value={dailyLogForm.workers_count}
                  onChange={(e) => setDailyLogForm({ ...dailyLogForm, workers_count: e.target.value })}
                  placeholder="25"
                />
              </div>
              <div>
                <Label htmlFor="dl-equipment">{t('equipment_used') || 'Ishlatilgan texnika'}</Label>
                <Input
                  id="dl-equipment"
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
                          <img
                            src={src}
                            alt={`photo-${index}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-16 object-cover rounded"
                          />
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

      {/* Daily Log View Modal */}
      <Dialog open={showDailyLogViewModal} onOpenChange={setShowDailyLogViewModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby="dl-view-help">
          <DialogHeader>
            <DialogTitle>{t('daily_log_details') || 'Kunlik hisobot tafsilotlari'}</DialogTitle>
            <p id="dl-view-help" className="sr-only">
              {t('daily_log_view_help') || 'Tanlangan kunlik hisobot haqida batafsil maʼlumot'}
            </p>
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
                materials_received: jsonbFieldToString(selectedDailyLog.materials_received),
                quantity_done: selectedDailyLog.quantity_done || '',
                uom: selectedDailyLog.uom || ''
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

      {/* Building Files Modal */}
      <Dialog open={showBuildingFilesModal} onOpenChange={setShowBuildingFilesModal}>
        {/* Wider (max-w-3xl) + taller (max-h-[90vh]) so a typical building's
            file list fits without having to scroll inside the modal. The
            overflow-y-auto is kept as a safety net for very long lists. */}
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="bld-files-help">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {buildingFilesTarget?.name} — {t('files') || 'Fayllar'}
            </DialogTitle>
            <p id="bld-files-help" className="text-sm text-slate-500">
              {t('building_files_help') ||
                "Binoga tegishli hujjatlar, suratlar va chizmalarni biriktiring."}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <input
                id="building-file-upload"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
                className="hidden"
                onChange={handleBuildingFileUpload}
              />
              <Button
                variant="outline" size="sm" className="w-full"
                disabled={uploadingBuildingFile}
                onClick={() => document.getElementById('building-file-upload')?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadingBuildingFile ? (t('uploading') || 'Yuklanmoqda...') : (t('upload_file') || 'Fayl yuklash')}
              </Button>
            </div>

            {buildingFilesLoading ? (
              <div className="text-center py-8 text-slate-400">{t('loading') || 'Yuklanmoqda...'}</div>
            ) : buildingFiles.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t('no_files') || "Fayllar yo'q"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {buildingFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">
                        {file.mime_type?.includes('pdf') ? (
                          <FileText className="w-8 h-8 text-red-500" />
                        ) : file.mime_type?.includes('image') ? (
                          <Image className="w-8 h-8 text-blue-500" />
                        ) : file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel') ? (
                          <FileSpreadsheet className="w-8 h-8 text-green-500" />
                        ) : (
                          <FileText className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold break-words" title={file.filename}>{file.filename}</p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(file.file_size)}
                          {file.created_at && ` · ${format(new Date(file.created_at), 'dd.MM.yyyy HH:mm')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {/* Download via apiClient (correct backend baseURL) — see
                         handleDownloadBuildingFile above. */}
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100"
                        onClick={() => handleDownloadBuildingFile(file)}
                        title={t('download') || 'Yuklab olish'}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                        onClick={() => handleDeleteBuildingFile(file.id)}
                        title={t('delete') || "O'chirish"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={confirmDelete.open}
        onOpenChange={(open) => !open && setConfirmDelete({ open: false, onConfirm: null, title: null, description: null })}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete.title || t('confirm_delete') || "O'chirishni tasdiqlaysizmi?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete.description || t('this_cannot_be_undone') || "Bu amalni ortga qaytarib bo'lmaydi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete({ open: false, onConfirm: null, title: null, description: null })}>
              {t('cancel') || 'Bekor qilish'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                confirmDelete.onConfirm?.();
                setConfirmDelete({ open: false, onConfirm: null, title: null, description: null });
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
  const { activeCompany } = useCompany();

  const {
    projects,
    loading,
    loadError,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    PROJECT_STATUS,
    PROJECT_TYPES,
    getProjectStats
  } = useConstructionContext();

  // Initial load lives in ConstructionContext (gated on installed app +
  // module access) — no extra fetch here, or the page fires the request
  // three times and bypasses the access gate.

  // Portfolio stats: ONE fetch of /construction/projects/stats feeds the KPI
  // strip (totals), the per-card fakt/overdue chips (per_project) and the
  // computed cost-weighted readiness bars. Best-effort: on failure the KPI
  // strip hides and cards fall back to the manual progress_percent field.
  const [projectStats, setProjectStats] = useState(null);
  const [projectStatsLoading, setProjectStatsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    constructionService.getProjectStats()
      .then((stats) => {
        if (cancelled) return;
        setProjectStats(stats || null);
        setProjectStatsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setProjectStats(null);
          setProjectStatsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // id → full per_project entry ({readiness_pct, actual_amount, overdue_works}).
  // A project with NO entry here has neither an edinich estimate nor approved
  // costs — the card shows the "Smeta hali tuzilmagan" empty variant.
  const statsByProjectId = React.useMemo(() => {
    if (!projectStats) return null;
    const map = {};
    (projectStats.per_project || []).forEach((p) => {
      if (p && p.id != null) map[p.id] = p;
    });
    return map;
  }, [projectStats]);

  // Narrow map consumed by the grid/kanban progress bars (kept for
  // back-compat with the existing readiness fallback logic).
  const readinessById = React.useMemo(() => {
    if (!statsByProjectId) return null;
    const map = {};
    Object.values(statsByProjectId).forEach((p) => {
      if (typeof p.readiness_pct === 'number') map[p.id] = p.readiness_pct;
    });
    return map;
  }, [statsByProjectId]);

  // Warehouses for the project form's "Loyiha ombori" picker. Loaded
  // once on mount and reused for both the create modal and the inline
  // edit affordance on the project info card. Sorted alphabetically so
  // the dropdown is predictable for users with many sites.
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    inventoryService.listWarehouses({ limit: 100 })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.items || []);
        setWarehouses(list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      })
      .catch(() => setWarehouses([]));
  }, []);

  const activeTab = searchParams.get("tab") || "projects";
  const setActiveTab = (tab) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', tab);
    return next;
  }, { replace: true });
  const selectedProjectId = searchParams.get('projectId');
  const selectedProject = selectedProjectId
    ? projects.find((p) => String(p.id) === String(selectedProjectId)) || null
    : null;
  // Sahifa darajasidagi segment: «Loyihalar | Material zayavkalari».
  // Bildirishnoma deep-linklari ?view=requests&mrId=N bilan keladi.
  const activeView = searchParams.get('view') || 'projects';
  const setActiveView = (view) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (view === 'projects') next.delete('view');
    else next.set('view', view);
    next.delete('projectId');
    return next;
  }, { replace: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
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
    status: 'draft',
    // Optional default warehouse for material reservations and material
    // requests. Empty string = no preference; backend falls back to its
    // existing auto-pick chain (highest-stock → oldest-active).
    warehouse_id: '',
    // Forma 2 / Forma 3 client (Заказчик) identity
    client_name: '',
    client_phone: '',
    client_contact: '',
    client_address: '',
    client_bank_name: '',
    client_bank_account: '',
    client_mfo: '',
    client_stir: '',
    client_okonh: '',
    contract_number: '',
    object_full_name: '',
    client_director_name: '',
    client_chief_accountant_name: '',
  });

  // Open state for the two searchable combobox dropdowns (region/city) on
  // the project create/edit form. Kept separate from `projectForm` so the
  // popovers don't trigger a full form re-render when toggled.
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const stats = getProjectStats();

  const getStatusBadge = (status) => {
    // Clean, subtle badges — background tint + dark text instead of solid color
    const config = {
      [PROJECT_STATUS.DRAFT]: {
        label: t('draft') || 'Qoralama',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      },
      [PROJECT_STATUS.PLANNING]: {
        label: t('planning') || 'Rejalashtirish',
        className: 'bg-violet-50 text-violet-700 border-violet-200',
      },
      [PROJECT_STATUS.APPROVED]: {
        label: t('approved') || 'Tasdiqlangan',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      [PROJECT_STATUS.IN_PROGRESS]: {
        label: t('in_progress') || 'Jarayonda',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      [PROJECT_STATUS.ON_HOLD]: {
        label: t('on_hold') || "To'xtatilgan",
        className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      },
      [PROJECT_STATUS.COMPLETED]: {
        label: t('completed') || 'Tugallangan',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      [PROJECT_STATUS.CANCELLED]: {
        label: t('cancelled') || 'Bekor qilingan',
        className: 'bg-red-50 text-red-700 border-red-200',
      },
    };
    const cfg = config[status] || { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' };
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
          cfg.className
        )}
      >
        {cfg.label}
      </span>
    );
  };

  const handleSubmitProject = async (e) => {
    e.preventDefault();

    // Validation
    const name = projectForm.name?.trim();
    if (!name) {
      toast.error(t('project_name_required') || 'Loyiha nomi kiritilishi shart');
      return;
    }
    if (name.length < 2) {
      toast.error(t('project_name_too_short') || "Loyiha nomi kamida 2 belgidan iborat bo'lishi kerak");
      return;
    }

    const totalAreaNum = projectForm.total_area ? parseFloat(projectForm.total_area) : 0;
    if (projectForm.total_area && (!Number.isFinite(totalAreaNum) || totalAreaNum < 0)) {
      toast.error(t('invalid_total_area') || "Umumiy maydon noto'g'ri kiritildi");
      return;
    }

    const floorsNum = projectForm.floors_count ? parseInt(projectForm.floors_count, 10) : 0;
    if (projectForm.floors_count && (!Number.isFinite(floorsNum) || floorsNum < 0 || floorsNum > 200)) {
      toast.error(t('invalid_floors_count') || "Qavatlar soni noto'g'ri (0-200)");
      return;
    }

    // Contract amount is no longer collected on the project form (Shartnoma
    // summasi section removed per product feedback). Existing projects keep
    // whatever amount is already in DB; new ones default to 0 and the value
    // can be set later via a different flow when one exists.
    const contractNum = projectForm.contract_amount
      ? parseFloat(parsePriceInput(String(projectForm.contract_amount)))
      : 0;

    if (
      projectForm.planned_start_date &&
      projectForm.planned_end_date &&
      projectForm.planned_end_date < projectForm.planned_start_date
    ) {
      toast.error(
        t('end_before_start') ||
          'Tugash sanasi boshlanish sanasidan oldin bo\'lishi mumkin emas'
      );
      return;
    }

    // Reject any planned date outside the ±5 year window around today.
    // The HTML5 min/max on the inputs already prevents picker selection,
    // but typed values bypass that — so we re-check on submit too.
    {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fmtIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const lo = (() => { const d = new Date(today); d.setFullYear(d.getFullYear() - 5); return fmtIso(d); })();
      const hi = (() => { const d = new Date(today); d.setFullYear(d.getFullYear() + 5); return fmtIso(d); })();
      const outOfRange = (s) => s && (s < lo || s > hi);
      if (outOfRange(projectForm.planned_start_date) || outOfRange(projectForm.planned_end_date)) {
        toast.error(
          t('date_out_of_range') ||
            "Sana bugundan ±5 yil oraliqida bo'lishi kerak"
        );
        return;
      }
    }

    try {
      // Convert form data - empty strings to null/0 for numeric fields
      const formData = {
        ...projectForm,
        name,
        total_area: totalAreaNum,
        floors_count: floorsNum,
        contract_amount: contractNum,
      };

      if (editingProject) {
        await updateProject(editingProject.id, formData);
        // Sync the CRM link as a separate PUT (the main update endpoint
        // doesn't know about crm_project_id; the dedicated /crm-link route
        // owns that field so the regular form stays small and stable).
        if (projectForm.crm_project_id !== editingProject.crm_project_id) {
          try {
            await constructionService.setProjectCRMLink(editingProject.id, projectForm.crm_project_id);
          } catch (e) {
            // Non-fatal — the project itself saved; surface the CRM error
            // to the user but don't block the save.
            console.warn('Failed to update CRM link:', e);
            toast.error(t('crm_link_failed') || 'CRM bog\'lash xatosi');
          }
        }
        toast.success(t('project_updated') || 'Loyiha yangilandi');
      } else {
        await createProject(formData);
        toast.success(t('project_created') || 'Loyiha yaratildi');
      }
      setShowProjectModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving project:', error);
      const msg = error?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi';
      toast.error(msg);
    }
  };

  const resetForm = () => {
    setProjectForm({
      name: '', description: '', address: '', city: '', region: '',
      project_type: '', building_type: '',
      total_area: '', floors_count: '', contract_amount: '', planned_start_date: '', planned_end_date: '',
      status: 'draft',
      warehouse_id: '',
      // Client (Buyurtmachi / Customer) fields are left BLANK by default.
      // In construction ERP the "client" is the external customer ordering
      // the work — NOT the user's own organization. Pre-filling these with
      // activeCompany.* caused projects to be saved with the contractor's
      // own name as the client (see Forma 2 DALOLATNOMA bug reported by user).
      // User enters the real client info explicitly.
      client_name: '',
      client_phone: '',
      client_contact: '',
      client_address: '',
      client_bank_name: '',
      client_bank_account: '',
      client_mfo: '',
      client_stir: '',
      client_okonh: '',
      contract_number: '', object_full_name: '',
      client_director_name: '',
      client_chief_accountant_name: '',
      // CRM link starts unset on a new project. The CRMLinkPanel only
      // appears for edits (gated on editingProject), so this default is
      // mostly defensive — keeps the form shape consistent.
      crm_project_id: null,
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
      status: project.status || 'draft',
      warehouse_id: project.warehouse_id || '',
      client_name: project.client_name || '',
      client_phone: project.client_phone || '',
      client_contact: project.client_contact || '',
      client_address: project.client_address || '',
      client_bank_name: project.client_bank_name || '',
      client_bank_account: project.client_bank_account || '',
      client_mfo: project.client_mfo || '',
      client_stir: project.client_stir || '',
      client_okonh: project.client_okonh || '',
      contract_number: project.contract_number || '',
      object_full_name: project.object_full_name || '',
      client_director_name: project.client_director_name || '',
      client_chief_accountant_name: project.client_chief_accountant_name || '',
      // CRM link — copy through so the CRMLinkPanel dropdown pre-fills with
      // the currently-linked project. Backend includes crm_project_id in
      // the list/detail SELECT (see df3afe7); we were silently dropping it
      // here, which is why the dropdown looked empty on every reopen even
      // though the link was persisted server-side.
      crm_project_id: project.crm_project_id ?? null,
    });
    setShowProjectModal(true);
  };

  const [confirmDeleteProject, setConfirmDeleteProject] = useState({ open: false, id: null });
  const [confirmDeleteFile, setConfirmDeleteFile] = useState({ open: false, fileId: null });

  // Project Files modal state
  const [showProjectFilesModal, setShowProjectFilesModal] = useState(false);
  const [projectFilesTarget, setProjectFilesTarget] = useState(null); // { id, name }
  const [projectFiles, setProjectFiles] = useState([]);
  const [projectFilesLoading, setProjectFilesLoading] = useState(false);
  const [uploadingProjectFile, setUploadingProjectFile] = useState(false);
  const [projectFileCustomName, setProjectFileCustomName] = useState('');
  const [projectFileDescription, setProjectFileDescription] = useState('');
  const [pendingProjectFile, setPendingProjectFile] = useState(null); // File object awaiting upload after name entry

  const openProjectFiles = async (project) => {
    setProjectFilesTarget({ id: project.id, name: project.name });
    setShowProjectFilesModal(true);
    setProjectFilesLoading(true);
    setProjectFileCustomName('');
    setProjectFileDescription('');
    setPendingProjectFile(null);
    try {
      const data = await constructionService.listProjectFiles(project.id);
      setProjectFiles(data || []);
    } catch (e) {
      console.error('Error loading project files:', e);
      setProjectFiles([]);
    } finally {
      setProjectFilesLoading(false);
    }
  };

  const handleSelectProjectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingProjectFile(file);
    // Pre-fill with file name (without extension) as default
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setProjectFileCustomName(baseName);
    e.target.value = '';
  };

  const handleUploadProjectFile = async () => {
    if (!pendingProjectFile || !projectFilesTarget) return;
    if (!projectFileCustomName.trim()) {
      toast.error(t('name_required') || "Nom kiritish shart");
      return;
    }
    setUploadingProjectFile(true);
    try {
      const uploaded = await Integrations.UploadFile(pendingProjectFile);
      // Preserve original extension in saved filename
      const originalExt = pendingProjectFile.name.match(/\.[^/.]+$/)?.[0] || '';
      const finalName = projectFileCustomName.trim().endsWith(originalExt)
        ? projectFileCustomName.trim()
        : projectFileCustomName.trim() + originalExt;
      await constructionService.createProjectFile(projectFilesTarget.id, {
        file_id: uploaded.id,
        file_url: uploaded.url,
        filename: finalName,
        file_size: uploaded.size || pendingProjectFile.size,
        mime_type: uploaded.mime_type || pendingProjectFile.type,
        description: projectFileDescription,
      });
      const data = await constructionService.listProjectFiles(projectFilesTarget.id);
      setProjectFiles(data || []);
      setPendingProjectFile(null);
      setProjectFileCustomName('');
      setProjectFileDescription('');
      toast.success(t('file_uploaded') || 'Fayl yuklandi');
    } catch (err) {
      console.error('Error uploading project file:', err);
      toast.error(t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setUploadingProjectFile(false);
    }
  };

  const handleDeleteProjectFile = (fileId) => {
    if (!projectFilesTarget) return;
    setConfirmDeleteFile({
      open: true,
      fileId,
    });
  };

  const doDeleteProjectFile = async () => {
    const fileId = confirmDeleteFile.fileId;
    setConfirmDeleteFile({ open: false, fileId: null });
    if (!projectFilesTarget || !fileId) return;
    try {
      await constructionService.deleteProjectFile(projectFilesTarget.id, fileId);
      setProjectFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success(t('file_deleted') || "Fayl o'chirildi");
    } catch (err) {
      console.error('Error deleting project file:', err);
      toast.error(t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  // Download a project file: fetches through the authenticated API client
  // and triggers a browser download with the custom filename preserved.
  const handleDownloadProjectFile = async (file) => {
    try {
      // file.file_url is typically "/api/v1/files/{id}" — strip the "/api/v1" prefix
      // because apiClient already has it in its baseURL
      const url = (file.file_url || '').replace(/^\/?api\/v1\/?/, '/');
      const response = await apiClient.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: file.mime_type || response.headers?.['content-type'] || 'application/octet-stream',
      });
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file.filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after a tick so Safari can finish streaming
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error('Error downloading project file:', err);
      toast.error(t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const formatProjectFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDeleteProject = (id) => {
    setConfirmDeleteProject({ open: true, id });
  };

  // Opens the project detail view. Optional `route` ({group, tab}) lands the
  // user on a specific detail tab — used by the card's "Smeta tuzish" CTA to
  // jump straight to Smeta → Smetalar ro'yxati. ProjectDetailView reads and
  // normalizes these params on mount (normalizeProjectRoute).
  const handleViewProject = (project, route) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('projectId', project.id);
      if (route?.group) next.set('group', route.group);
      if (route?.tab) next.set('tab', route.tab);
      return next;
    });
  };

  const handleBackToProjects = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('projectId');
      return next;
    });
  };

  const handleStatusChange = async (projectId, newStatus) => {
    const current = projects.find((p) => p.id === projectId);
    if (current && current.status && current.status !== newStatus) {
      const allowed = ALLOWED_PROJECT_TRANSITIONS[current.status] || [];
      if (!allowed.includes(newStatus)) {
        toast.error(
          t('invalid_status_transition') ||
            `"${current.status}" holatidan "${newStatus}" holatiga o'tib bo'lmaydi`
        );
        return;
      }
    }
    try {
      await constructionService.updateProject(projectId, { status: newStatus });
      await loadProjects();
      toast.success(t('status_updated') || 'Holat yangilandi');
    } catch (error) {
      console.error('Failed to update project status:', error);
      const msg = error?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi';
      toast.error(msg);
    }
  };

  // If viewing a project, show detail view
  if (selectedProject) {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <ProjectDetailView
          project={selectedProject}
          onBack={handleBackToProjects}
          t={t}
          formatCurrency={formatCurrency}
          getStatusBadge={getStatusBadge}
          // Inline status changes from the ProgressWidget go through the
          // standard updateProject endpoint, then trigger loadProjects so
          // selectedProject (derived from the projects array) re-renders
          // with the new value. Errors surface via toast like the rest of
          // the project mutations.
          onProjectStatusChange={async (newStatus) => {
            try {
              await constructionService.updateProject(selectedProject.id, { status: newStatus });
              await loadProjects();
              toast.success(t('status_updated') || 'Holat yangilandi');
            } catch (error) {
              console.error('Failed to update project status:', error);
              const msg = error?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi';
              toast.error(msg);
            }
          }}
        />
      </div>
    );
  }

  // Status filter chips — one compact pill per dropdown status so the two
  // filter controls always stay in sync. "Jami" first.
  const STATUS_FILTER_CHIPS = [
    {
      key: 'all',
      label: t('total') || 'Jami',
      value: stats.total,
      hint: t('show_all_projects') || "Barcha loyihalarni ko'rsatish",
    },
    {
      key: 'draft',
      label: t('draft') || 'Qoralama',
      value: stats.draft,
      hint: t('draft_projects_hint') || "Qoralama: tayyorlash bosqichidagi loyihalar",
    },
    {
      key: 'planning',
      label: t('planning') || 'Rejalashtirish',
      value: stats.planning,
      hint: t('planning') || 'Rejalashtirish bosqichidagi loyihalar',
    },
    {
      key: 'in_progress',
      label: t('in_progress') || 'Jarayonda',
      value: stats.inProgress,
      hint: t('in_progress_projects_hint') || "Jarayonda: qurilish ketayotgan loyihalar",
    },
    {
      key: 'on_hold',
      label: t('on_hold') || "To'xtatilgan",
      value: stats.onHold,
      hint: t('on_hold') || "To'xtatib turilgan loyihalar",
    },
    {
      key: 'completed',
      label: t('completed') || 'Tugallangan',
      value: stats.completed,
      hint: t('completed_projects_hint') || "Tugallangan: yakunlangan loyihalar",
    },
  ];

  // Portfolio KPI strip values — all from the single /projects/stats payload.
  const perProjectStats = projectStats?.per_project || [];
  const readinessEntries = perProjectStats.filter((p) => p && typeof p.readiness_pct === 'number');
  const avgReadiness = readinessEntries.length > 0
    ? Math.round(readinessEntries.reduce((sum, p) => sum + p.readiness_pct, 0) / readinessEntries.length)
    : null;
  const overdueWorksTotal = perProjectStats.reduce(
    (sum, p) => sum + (Number(p?.overdue_works) || 0), 0,
  );
  const PORTFOLIO_KPIS = projectStats ? [
    {
      key: 'contract_total',
      label: t('pf_contract_total') || 'Jami shartnoma',
      value: formatCurrencyCompact(projectStats.totals?.contract_total || 0),
    },
    {
      key: 'actual_total',
      label: t('pf_actual_total') || 'Haqiqiy xarajat',
      value: formatCurrencyCompact(projectStats.totals?.actual_total || 0),
    },
    {
      key: 'avg_readiness',
      label: t('pf_avg_readiness') || "O'rtacha bajarilish",
      value: avgReadiness == null ? '—' : `${avgReadiness}%`,
    },
    {
      key: 'overdue_works',
      label: t('pf_overdue_works') || "Muddati o'tgan ishlar",
      value: overdueWorksTotal,
      danger: overdueWorksTotal > 0,
    },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8">
        {/* Sahifa segmenti: Loyihalar | Material zayavkalari (6.1-bo'lim) */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {[
            { key: 'projects', label: t('construction_view_projects') || 'Loyihalar' },
            { key: 'requests', label: t('construction_view_requests') || 'Material zayavkalari' },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setActiveView(v.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeView === v.key
                  ? 'bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {activeView === 'requests' && (
          <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
            <MaterialRequestsPanel mode="construction" />
          </Suspense>
        )}

        {activeView === 'projects' && (
        <>
        {/* Portfolio KPI strip + status filter chips */}
        <div className="space-y-4">
          {/* KPI strip — one slim row from /projects/stats. Skeleton while
              loading; hidden entirely when the stats fetch failed (cards
              below still work off the manual fields). */}
          {projectStatsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-24 bg-slate-200 rounded mb-2.5" />
                  <div className="h-5 w-32 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : projectStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PORTFOLIO_KPIS.map(({ key, label, value, danger }) => (
                <div key={key} className="glass-card rounded-xl p-4 min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
                  <p
                    className={cn(
                      'mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums truncate leading-tight',
                      danger ? 'text-red-600' : 'text-slate-900'
                    )}
                  >
                    {danger && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
                    )}
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Status filter — compact pill chips, one per dropdown status so
              the two filter controls always stay in sync */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('status') || 'Holat'}>
            {STATUS_FILTER_CHIPS.map(({ key, label, value, hint }) => {
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  aria-pressed={isActive}
                  title={hint}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--genix-blue)]',
                    isActive
                      ? 'border-[var(--genix-blue)] bg-blue-50/60 text-[var(--genix-blue)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  )}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      'inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none',
                      isActive ? 'bg-[var(--genix-blue)] text-white' : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Projects List */}
        <ProjectsTab
          projects={projects}
          loading={loading}
          loadError={loadError}
          onRetry={loadProjects}
          readinessById={readinessById}
          statsById={statsByProjectId}
          statsReady={!projectStatsLoading && !!projectStats}
          formatCurrencyCompact={formatCurrencyCompact}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onCreateProject={() => { resetForm(); setShowProjectModal(true); }}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
          onViewProject={handleViewProject}
          onOpenFiles={openProjectFiles}
          onStatusChange={handleStatusChange}
          getStatusBadge={getStatusBadge}
          formatCurrency={formatCurrency}
          t={t}
          PROJECT_STATUS={PROJECT_STATUS}
        />
        </>
        )}
      </div>

      {/* Project Modal */}
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="project-form-help">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? (t('edit_project') || 'Loyihani tahrirlash') : (t('new_project') || 'Yangi loyiha')}
            </DialogTitle>
            <p id="project-form-help" className="text-sm text-slate-500">
              {t('project_form_help') ||
                "Yulduzcha (*) bilan belgilangan maydonlar majburiy. Boshqa maydonlarni keyin ham to'ldirishingiz mumkin."}
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmitProject} className="space-y-5">
            {/* SECTION 1: Basic info */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                {t('basic_info') || "Asosiy ma'lumotlar"}
              </h3>
              <div>
                <Label htmlFor="project-name">
                  {t('project_name') || 'Loyiha nomi'} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="project-name"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder={t('project_name_placeholder') || "Yangi shahar TJM 10-uy"}
                  required
                  maxLength={200}
                />
              </div>

              <div>
                {/* Label changed Tavsif → Izoh per product feedback. The
                   underlying field stays `description` to keep DB schema
                   and existing data intact; only the human-facing label
                   uses the dedicated `project_note` translation key. */}
                <Label htmlFor="project-desc">{t('project_note') || 'Izoh'}</Label>
                <Textarea
                  id="project-desc"
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows={2}
                  placeholder={t('project_desc_placeholder') || "Loyiha haqida qisqacha..."}
                />
              </div>
            </section>

            <Separator />

            {/* SECTION 2: Location — flow goes broad-to-narrow, top-down:
               Viloyat first (12 regions + Toshkent shahri + Qoraqalpog'iston),
               then Shahar/Tuman scoped to the chosen region, then the
               specific street address. Picking the region clears any
               previously selected city, since the prior city wouldn't
               necessarily exist in the new region's list. */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                {t('project_address') || 'Manzil'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Viloyat — searchable combobox. Popover + Command lets the
                   user type to filter the 14 regions instead of scrolling
                   a long native <select>. */}
                <div>
                  <Label htmlFor="proj-region">{t('region') || 'Viloyat'}</Label>
                  <Popover open={regionPickerOpen} onOpenChange={setRegionPickerOpen} modal>
                    <PopoverTrigger asChild>
                      <Button
                        id="proj-region"
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full min-w-0 justify-between font-normal text-left"
                      >
                        <span className={cn('truncate min-w-0 flex-1', !projectForm.region && 'text-muted-foreground')}>
                          {projectForm.region || (t('select') || 'Tanlash')}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <Command>
                        <CommandInput placeholder={t('search') || 'Qidirish…'} />
                        <CommandList>
                          <CommandEmpty>
                            <div className="py-2 text-xs text-muted-foreground">
                              {t('not_found') || 'Topilmadi'}
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value=""
                              onSelect={() => {
                                setProjectForm({ ...projectForm, region: '', city: '' });
                                setRegionPickerOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={cn('mr-2 h-4 w-4', !projectForm.region ? 'opacity-100' : 'opacity-0')} />
                              <span className="text-muted-foreground">{t('select') || '— tanlang —'}</span>
                            </CommandItem>
                            {UZ_REGIONS.map((r) => (
                              <CommandItem
                                key={r.key}
                                value={r.name}
                                onSelect={() => {
                                  // Clear city if the previously-chosen city
                                  // isn't part of the new region's list.
                                  const nextCity = projectForm.city && citiesForRegion(r.name).includes(projectForm.city)
                                    ? projectForm.city : '';
                                  setProjectForm({ ...projectForm, region: r.name, city: nextCity });
                                  setRegionPickerOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check className={cn('mr-2 h-4 w-4', projectForm.region === r.name ? 'opacity-100' : 'opacity-0')} />
                                {r.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Shahar — also searchable. Disabled until a region is
                   chosen since the city list is region-scoped. */}
                <div>
                  <Label htmlFor="proj-city">{t('city') || 'Shahar'}</Label>
                  <Popover open={cityPickerOpen} onOpenChange={setCityPickerOpen} modal>
                    <PopoverTrigger asChild>
                      <Button
                        id="proj-city"
                        type="button"
                        variant="outline"
                        role="combobox"
                        disabled={!projectForm.region}
                        className="w-full min-w-0 justify-between font-normal text-left"
                      >
                        <span className={cn('truncate min-w-0 flex-1', !projectForm.city && 'text-muted-foreground')}>
                          {projectForm.city || (projectForm.region
                            ? (t('select') || 'Tanlash')
                            : (t('pick_region_first') || 'Avval viloyatni tanlang'))}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <Command>
                        <CommandInput placeholder={t('search') || 'Qidirish…'} />
                        <CommandList>
                          <CommandEmpty>
                            <div className="py-2 text-xs text-muted-foreground">
                              {t('not_found') || 'Topilmadi'}
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value=""
                              onSelect={() => {
                                setProjectForm({ ...projectForm, city: '' });
                                setCityPickerOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={cn('mr-2 h-4 w-4', !projectForm.city ? 'opacity-100' : 'opacity-0')} />
                              <span className="text-muted-foreground">{t('select') || '— tanlang —'}</span>
                            </CommandItem>
                            {citiesForRegion(projectForm.region).map((c) => (
                              <CommandItem
                                key={c}
                                value={c}
                                onSelect={() => {
                                  setProjectForm({ ...projectForm, city: c });
                                  setCityPickerOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check className={cn('mr-2 h-4 w-4', projectForm.city === c ? 'opacity-100' : 'opacity-0')} />
                                {c}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="proj-address">{t('street_house_number') || "Ko'cha va uy raqami"}</Label>
                  <Input
                    id="proj-address"
                    value={projectForm.address}
                    onChange={(e) => setProjectForm({ ...projectForm, address: e.target.value })}
                    placeholder={t('address_placeholder') || "Ko'cha, uy raqami"}
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* SECTION 3: Project details */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <HardHat className="w-4 h-4 text-orange-600" />
                {t('project_details') || "Loyiha tafsilotlari"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="proj-type">{t('project_type') || 'Loyiha turi'}</Label>
                  <Select
                    value={projectForm.project_type}
                    onValueChange={(v) => setProjectForm({ ...projectForm, project_type: v })}
                  >
                    <SelectTrigger id="proj-type">
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
                  <Label htmlFor="proj-area">{t('total_area') || 'Umumiy maydon (m²)'}</Label>
                  <NumberInput
                    id="proj-area"
                    value={projectForm.total_area}
                    onChange={(raw) => setProjectForm({ ...projectForm, total_area: raw })}
                  />
                </div>
                <div>
                  <Label htmlFor="proj-floors">{t('floors_count') || 'Qavatlar soni'}</Label>
                  <Input
                    id="proj-floors"
                    type="number"
                    min="0"
                    max="200"
                    step="1"
                    inputMode="numeric"
                    value={projectForm.floors_count}
                    onChange={(e) => setProjectForm({ ...projectForm, floors_count: e.target.value })}
                  />
                </div>
              </div>

              {/* Default warehouse for materials. Optional — when empty the
                  backend falls back to its existing auto-pick. When set,
                  every material reservation (foreman submit) and every
                  material request created on this project lands on this
                  warehouse, so there's no more cross-charging or random
                  tiebreakers. The "(none)" sentinel uses a non-empty
                  string because Radix Select forbids "" as an item value;
                  it's translated back to empty string before submit. */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="proj-warehouse">
                    {t('project_warehouse') || 'Loyiha ombori'}
                    <span className="text-slate-400 font-normal ml-1">
                      ({t('optional') || 'ixtiyoriy'})
                    </span>
                  </Label>
                  <Select
                    value={projectForm.warehouse_id || '__none__'}
                    onValueChange={(v) => setProjectForm({
                      ...projectForm,
                      warehouse_id: v === '__none__' ? '' : v,
                    })}
                  >
                    <SelectTrigger id="proj-warehouse">
                      <SelectValue placeholder={t('select_warehouse') || 'Ombor tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {t('no_default_warehouse') || "(Avtomatik tanlash)"}
                      </SelectItem>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}{w.code ? ` · ${w.code}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('project_warehouse_hint') ||
                      "Material so'rovlari va YAKUNIY ish tasdiqlovi shu omborga yoziladi"}
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            {/* SECTION 4: Schedule */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                {t('schedule') || 'Muddatlar'}
              </h3>
              {/* Date bounds: a project's planned start/end must fall within
                 a ±5 year window around today. Stops the placeholder
                 `0001-01-01` and other obviously-bogus values from sneaking
                 in via keyboard typing. The end-date `min` follows the
                 typed start so the picker can't even offer an earlier day. */}
              {(() => {
                const today = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const fmtIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const minDate = (() => { const d = new Date(today); d.setFullYear(d.getFullYear() - 5); return fmtIso(d); })();
                const maxDate = (() => { const d = new Date(today); d.setFullYear(d.getFullYear() + 5); return fmtIso(d); })();
                const start = projectForm.planned_start_date;
                const end = projectForm.planned_end_date;
                const startOutOfRange = !!start && (start < minDate || start > maxDate);
                const endOutOfRange = !!end && (end < minDate || end > maxDate);
                const endBeforeStart = !!start && !!end && end < start;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="proj-start">{t('planned_start_date') || 'Rejadagi boshlanish'}</Label>
                      <Input
                        id="proj-start"
                        type="date"
                        value={start}
                        min={minDate}
                        max={maxDate}
                        onChange={(e) => setProjectForm({ ...projectForm, planned_start_date: e.target.value })}
                      />
                      {startOutOfRange && (
                        <p className="text-xs text-red-500 mt-1">
                          {t('date_out_of_range') ||
                            "Sana bugundan ±5 yil oraliqida bo'lishi kerak"}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="proj-end">{t('planned_end_date') || 'Rejadagi tugash'}</Label>
                      <Input
                        id="proj-end"
                        type="date"
                        value={end}
                        // End must be >= start AND within the ±5 year window.
                        // We pick whichever lower bound is later so both
                        // constraints hold simultaneously.
                        min={(start && start > minDate) ? start : minDate}
                        max={maxDate}
                        onChange={(e) => setProjectForm({ ...projectForm, planned_end_date: e.target.value })}
                      />
                      {endOutOfRange && (
                        <p className="text-xs text-red-500 mt-1">
                          {t('date_out_of_range') ||
                            "Sana bugundan ±5 yil oraliqida bo'lishi kerak"}
                        </p>
                      )}
                      {endBeforeStart && !endOutOfRange && (
                        <p className="text-xs text-red-500 mt-1">
                          {t('end_before_start') ||
                            "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* Financials section (Shartnoma summasi input) removed —
               not collected at project creation any more. The
               `contract_amount` field still flows through the form
               state (with default 0) so the backend payload stays
               schema-compatible for both new and edited projects. */}

            {editingProject && (
              <>
                <Separator />
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-slate-600" />
                    {t('status') || 'Holat'}
                  </h3>
                  <div>
                    <Label htmlFor="proj-status">{t('status') || 'Holat'}</Label>
                    {/* Only the current status + transitions the kanban would
                        also allow (ALLOWED_PROJECT_TRANSITIONS) — previously
                        this Select could jump to any status and bypass the
                        transition rules. */}
                    <Select
                      value={projectForm.status}
                      onValueChange={(v) => setProjectForm({ ...projectForm, status: v })}
                    >
                      <SelectTrigger id="proj-status">
                        <SelectValue placeholder={t('select_status') || 'Holatni tanlang'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const current = editingProject?.status || projectForm.status || 'draft';
                          const allowed = new Set([current, ...(ALLOWED_PROJECT_TRANSITIONS[current] || [])]);
                          const labels = {
                            draft: t('draft') || 'Qoralama',
                            planning: t('planning') || 'Rejalashtirish',
                            in_progress: t('in_progress') || 'Jarayonda',
                            on_hold: t('on_hold') || "To'xtatilgan",
                            completed: t('completed') || 'Tugallangan',
                            cancelled: t('cancelled') || 'Bekor qilingan',
                          };
                          return Object.entries(labels)
                            .filter(([value]) => allowed.has(value))
                            .map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </section>

                {/* CRM linkage — only shown when editing an existing project
                    because we need its server-side id to PUT /crm-link.
                    The save handler below picks up projectForm.crm_project_id
                    and forwards it via constructionService.setProjectCRMLink. */}
                <Separator />
                <section>
                  <CRMLinkPanel
                    mode="project"
                    value={projectForm.crm_project_id}
                    onChange={(crmId) => setProjectForm({ ...projectForm, crm_project_id: crmId })}
                    language={language}
                  />
                </section>
              </>
            )}

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setShowProjectModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {editingProject ? (t('update') || 'Yangilash') : (t('create') || 'Yaratish')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Files Modal */}
      <Dialog open={showProjectFilesModal} onOpenChange={(open) => {
        setShowProjectFilesModal(open);
        if (!open) {
          setPendingProjectFile(null);
          setProjectFileCustomName('');
          setProjectFileDescription('');
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" aria-describedby="proj-files-help">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              {projectFilesTarget?.name} — {t('files') || 'Fayllar'}
            </DialogTitle>
            <p id="proj-files-help" className="text-sm text-slate-500">
              {t('project_files_help') ||
                "Shartnomalar, sxemalar, ruxsatnomalar va boshqa hujjatlarni biriktiring."}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            {/* Upload area */}
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
              {!pendingProjectFile ? (
                <>
                  <input
                    id="project-file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar,.txt"
                    className="hidden"
                    onChange={handleSelectProjectFile}
                  />
                  <Button
                    variant="outline" size="sm" className="w-full border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => document.getElementById('project-file-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {t('select_file') || 'Fayl tanlash'}
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate flex-1">{pendingProjectFile.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatProjectFileSize(pendingProjectFile.size)}</span>
                  </div>
                  <div>
                    <Label htmlFor="project-file-name" className="text-xs text-slate-600">
                      {t('file_name') || 'Fayl nomi'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="project-file-name"
                      value={projectFileCustomName}
                      onChange={(e) => setProjectFileCustomName(e.target.value)}
                      placeholder={t('enter_file_name') || 'Fayl nomini kiriting'}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="project-file-desc" className="text-xs text-slate-600">
                      {t('description') || 'Izoh'}
                    </Label>
                    <Input
                      id="project-file-desc"
                      value={projectFileDescription}
                      onChange={(e) => setProjectFileDescription(e.target.value)}
                      placeholder={t('optional') || "Ixtiyoriy"}
                      className="h-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={uploadingProjectFile || !projectFileCustomName.trim()}
                      onClick={handleUploadProjectFile}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingProjectFile ? (t('uploading') || 'Yuklanmoqda...') : (t('upload') || 'Yuklash')}
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={uploadingProjectFile}
                      onClick={() => {
                        setPendingProjectFile(null);
                        setProjectFileCustomName('');
                        setProjectFileDescription('');
                      }}
                    >
                      {t('cancel') || 'Bekor qilish'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Files list */}
            {projectFilesLoading ? (
              <div className="text-center py-8 text-slate-400">{t('loading') || 'Yuklanmoqda...'}</div>
            ) : projectFiles.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t('no_files') || "Fayllar yo'q"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">
                        {file.mime_type?.includes('pdf') ? (
                          <FileText className="w-8 h-8 text-red-500" />
                        ) : file.mime_type?.includes('image') ? (
                          <Image className="w-8 h-8 text-blue-500" />
                        ) : file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel') ? (
                          <FileSpreadsheet className="w-8 h-8 text-green-500" />
                        ) : (
                          <FileText className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Filenames can be long (especially Свод reports
                            that include project name + period + mode in the
                            filename). break-words lets them wrap onto a
                            second line instead of being truncated and
                            losing the .xlsx extension off the right edge. */}
                        <p className="text-lg font-bold break-words" title={file.filename}>{file.filename}</p>
                        {file.description && (
                          <p className="text-xs text-slate-500 break-words">{file.description}</p>
                        )}
                        <p className="text-xs text-slate-400">
                          {formatProjectFileSize(file.file_size)}
                          {file.created_at && ` · ${format(new Date(file.created_at), 'dd.MM.yyyy HH:mm')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0"
                        onClick={() => handleDownloadProjectFile(file)}
                        title={t('download') || 'Yuklab olish'}
                      >
                        <Download className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                        onClick={() => handleDeleteProjectFile(file.id)}
                        title={t('delete') || "O'chirish"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <AlertDialog open={confirmDeleteProject.open} onOpenChange={(open) => !open && setConfirmDeleteProject({ open: false, id: null })}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete_project') || "Loyihani o'chirishni tasdiqlaysizmi?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_project_warning') ||
                "Loyiha, barcha binolar, smetalar, materiallar, hisobotlar va fayllar butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteProject({ open: false, id: null })}>
              {t('cancel') || 'Bekor qilish'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                try {
                  await deleteProject(confirmDeleteProject.id);
                  toast.success(t('project_deleted') || "Loyiha o'chirildi");
                } catch (e) {
                  console.error('Error deleting project:', e);
                  toast.error(t('error_occurred') || 'Xatolik yuz berdi');
                } finally {
                  setConfirmDeleteProject({ open: false, id: null });
                }
              }}
            >
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete File Confirmation */}
      <AlertDialog open={confirmDeleteFile.open} onOpenChange={(open) => !open && setConfirmDeleteFile({ open: false, fileId: null })}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete_file') || "Faylni o'chirishni tasdiqlaysizmi?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('file_delete_warning') || "Fayl butunlay o'chiriladi va qayta tiklab bo'lmaydi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteFile({ open: false, fileId: null })}>
              {t('cancel') || 'Bekor qilish'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={doDeleteProjectFile}
            >
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
