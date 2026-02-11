import React, { useState, useEffect, useCallback } from 'react';
import { useConstructionContext } from '@/components/contexts/ConstructionContext';
import { constructionService } from '@/api/services/construction';
import { hrService } from '@/api/services/hr';
import { Core as Integrations } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  Layers,
  List,
  PlusCircle,
  Receipt,
  Briefcase,
  Hammer,
  HardHat,
  LayoutGrid,
  Columns3,
  Upload,
  X,
  Image
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format } from 'date-fns';
import { ActivityLogPanel } from '@/components/shared/ActivityLog';
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
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [team, setTeam] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [photoReports, setPhotoReports] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showDailyLogModal, setShowDailyLogModal] = useState(false);
  const [showPhotoReportModal, setShowPhotoReportModal] = useState(false);
  const [showMaterialRequestModal, setShowMaterialRequestModal] = useState(false);

  // Import/Export modals
  const [showBuildingImportModal, setShowBuildingImportModal] = useState(false);
  const [showBuildingExportModal, setShowBuildingExportModal] = useState(false);
  const [showSmetaImportModal, setShowSmetaImportModal] = useState(false);
  const [showSmetaExportModal, setShowSmetaExportModal] = useState(false);

  // Forms
  const [buildingForm, setBuildingForm] = useState({
    name: '', description: '', building_type: '', building_purpose: '',
    floors_count: '', total_area: '', apartments_count: '', estimated_cost: '',
    status: 'draft'
  });
  const [sectionForm, setSectionForm] = useState({ code: '', name: '', description: '' });
  const [itemForm, setItemForm] = useState({ code: '', name: '', unit: '', quantity: '', unit_price: '' });
  const [teamForm, setTeamForm] = useState({ employee_id: '', role: '', responsibilities: '', start_date: '' });
  const [vendorForm, setVendorForm] = useState({
    id: null, vendor_id: '', vendor_name: '', contract_number: '', contract_date: '', contract_amount: '', currency: 'UZS',
    vendor_type: 'subcontractor', work_scope: '', contact_person: '', contact_phone: '', contact_email: '', start_date: '', end_date: '', notes: ''
  });
  const [materialRequestForm, setMaterialRequestForm] = useState({
    id: null, request_number: '', request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft'
  });
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

  // Smeta export/import columns (sections with items)
  const smetaExportColumns = [
    { key: 'section_name', label: t('section') || "Bo'lim" },
    { key: 'section_code', label: t('section_code') || "Bo'lim kodi" },
    { key: 'item_code', label: t('item_code') || 'Ish kodi' },
    { key: 'item_name', label: t('item_name') || 'Ish nomi' },
    { key: 'unit', label: t('unit') || "O'lchov birligi" },
    { key: 'quantity', label: t('quantity') || 'Miqdor' },
    { key: 'unit_price', label: t('unit_price') || 'Birlik narxi', render: (v) => formatCurrency(v || 0) },
    { key: 'total_price', label: t('total') || 'Jami', render: (v) => formatCurrency(v || 0) },
  ];

  const smetaImportColumns = [
    { key: 'section_name', label: t('section') || "Bo'lim", required: true },
    { key: 'section_code', label: t('section_code') || "Bo'lim kodi" },
    { key: 'item_code', label: t('item_code') || 'Ish kodi' },
    { key: 'item_name', label: t('item_name') || 'Ish nomi', required: true },
    { key: 'unit', label: t('unit') || "O'lchov birligi" },
    { key: 'quantity', label: t('quantity') || 'Miqdor' },
    { key: 'unit_price', label: t('unit_price') || 'Birlik narxi' },
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

  // Handle smeta import
  const handleSmetaImport = async (data) => {
    try {
      // Group items by section
      const sectionMap = new Map();
      for (const row of data) {
        const sectionKey = row.section_name || 'Default';
        if (!sectionMap.has(sectionKey)) {
          sectionMap.set(sectionKey, {
            code: row.section_code || '',
            name: sectionKey,
            items: []
          });
        }
        if (row.item_name) {
          sectionMap.get(sectionKey).items.push({
            code: row.item_code || '',
            name: row.item_name,
            unit: row.unit || 'dona',
            quantity: row.quantity ? parseFloat(row.quantity) : 0,
            unit_price: row.unit_price ? parseFloat(row.unit_price) : 0,
          });
        }
      }

      // Create sections and items
      for (const [, sectionData] of sectionMap) {
        // Check if section already exists
        let section = sections.find(s => s.name === sectionData.name);
        if (!section) {
          section = await constructionService.createSection(project.id, {
            code: sectionData.code,
            name: sectionData.name,
            description: ''
          });
        }

        // Create items for this section
        for (const item of sectionData.items) {
          await constructionService.createItem(section.id, item);
        }
      }

      // Reload sections
      const sectionsData = await constructionService.listSections(project.id);
      setSections(sectionsData || []);
      setShowSmetaImportModal(false);
    } catch (error) {
      console.error('Error importing smeta:', error);
    }
  };

  // Prepare smeta data for export (flatten sections and items)
  const getSmetaExportData = async () => {
    const exportData = [];
    for (const section of sections) {
      try {
        const sectionItems = await constructionService.listItems(section.id);
        if (sectionItems && sectionItems.length > 0) {
          for (const item of sectionItems) {
            exportData.push({
              section_name: section.name,
              section_code: section.code || '',
              item_code: item.code || '',
              item_name: item.name,
              unit: item.unit || '',
              quantity: item.quantity || 0,
              unit_price: item.unit_price || 0,
              total_price: (item.quantity || 0) * (item.unit_price || 0),
            });
          }
        } else {
          // Include section even if no items
          exportData.push({
            section_name: section.name,
            section_code: section.code || '',
            item_code: '',
            item_name: '',
            unit: '',
            quantity: 0,
            unit_price: 0,
            total_price: 0,
          });
        }
      } catch (e) {
        console.error('Error loading items for section:', section.id, e);
      }
    }
    return exportData;
  };

  const [smetaExportData, setSmetaExportData] = useState([]);

  // Load smeta export data when export modal opens
  useEffect(() => {
    if (showSmetaExportModal) {
      getSmetaExportData().then(data => setSmetaExportData(data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSmetaExportModal, sections]);

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
              const buildingsData = await constructionService.listBuildings(project.id);
              setBuildings(buildingsData || []);
            } catch (e) { setBuildings([]); }
            break;
          case 'smeta':
            const sectionsData = await constructionService.listSections(project.id);
            setSections(sectionsData || []);
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
          case 'vendors':
            try {
              const [vendorsData, orgsData] = await Promise.all([
                constructionService.listProjectVendors(project.id),
                constructionService.listOrganizations()
              ]);
              setVendors(vendorsData || []);
              setOrganizations(orgsData || []);
            } catch (e) { setVendors([]); setOrganizations([]); }
            break;
          case 'daily_logs':
            try {
              const logsData = await constructionService.listDailyReports(project.id);
              setDailyLogs(logsData || []);
            } catch (e) { setDailyLogs([]); }
            break;
          case 'photo_reports':
            try {
              const photosData = await constructionService.listPhotoReports(project.id);
              setPhotoReports(photosData || []);
            } catch (e) { setPhotoReports([]); }
            break;
          case 'materials':
            try {
              const materialsData = await constructionService.listMaterialRequests(project.id);
              setMaterialRequests(materialsData || []);
            } catch (e) { setMaterialRequests([]); }
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

  // Load items when section is selected
  useEffect(() => {
    if (selectedSection?.id) {
      const loadItems = async () => {
        try {
          const itemsData = await constructionService.listItems(selectedSection.id);
          setItems(itemsData || []);
        } catch (error) {
          console.error('Error loading items:', error);
          setItems([]);
        }
      };
      loadItems();
    }
  }, [selectedSection?.id]);

  // Handle building creation/update
  const handleCreateBuilding = async (e) => {
    e.preventDefault();
    try {
      const formData = {
        ...buildingForm,
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
        name: '', description: '', building_type: '', building_purpose: '',
        floors_count: '', total_area: '', apartments_count: '', estimated_cost: '',
        status: 'draft'
      });
    } catch (error) {
      console.error('Error saving building:', error);
    }
  };

  // Handle section creation
  const handleCreateSection = async (e) => {
    e.preventDefault();
    try {
      await constructionService.createSection(project.id, sectionForm);
      const sectionsData = await constructionService.listSections(project.id);
      setSections(sectionsData || []);
      setShowSectionModal(false);
      setSectionForm({ code: '', name: '', description: '' });
    } catch (error) {
      console.error('Error creating section:', error);
    }
  };

  // Handle section deletion
  const handleDeleteSection = async (sectionId) => {
    if (!confirm(t('confirm_delete_section') || "Bo'limni o'chirmoqchimisiz? Barcha ishlar ham o'chiriladi!")) return;
    try {
      await constructionService.deleteSection(sectionId);
      const sectionsData = await constructionService.listSections(project.id);
      setSections(sectionsData || []);
      if (selectedSection?.id === sectionId) {
        setSelectedSection(null);
        setItems([]);
      }
    } catch (error) {
      console.error('Error deleting section:', error);
    }
  };

  // Handle section status change (approve/unapprove)
  const handleApproveSectionStatus = async (sectionId, newStatus) => {
    try {
      await constructionService.updateSection(sectionId, { status: newStatus });
      const sectionsData = await constructionService.listSections(project.id);
      setSections(sectionsData || []);
    } catch (error) {
      console.error('Error updating section status:', error);
    }
  };

  // Handle item creation
  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!selectedSection?.id) return;
    try {
      await constructionService.createItem(selectedSection.id, {
        ...itemForm,
        quantity: parseFloat(itemForm.quantity) || 0,
        unit_price: parseFloat(itemForm.unit_price) || 0
      });
      const itemsData = await constructionService.listItems(selectedSection.id);
      setItems(itemsData || []);
      setShowItemModal(false);
      setItemForm({ code: '', name: '', unit: '', quantity: '', unit_price: '' });
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  // Handle item deletion
  const handleDeleteItem = async (itemId) => {
    if (!confirm(t('confirm_delete_item') || "Ishni o'chirmoqchimisiz?")) return;
    try {
      await constructionService.deleteItem(itemId);
      const itemsData = await constructionService.listItems(selectedSection.id);
      setItems(itemsData || []);
      // Refresh sections to update totals
      const sectionsData = await constructionService.listSections(project.id);
      setSections(sectionsData || []);
    } catch (error) {
      console.error('Error deleting item:', error);
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

  // Handle vendor creation/update
  const handleCreateVendor = async (e) => {
    e.preventDefault();
    try {
      const vendorData = {
        vendor_id: vendorForm.vendor_id || '',
        vendor_name: vendorForm.vendor_id ? '' : vendorForm.vendor_name,
        contract_number: vendorForm.contract_number,
        contract_date: vendorForm.contract_date,
        contract_amount: parseFloat(vendorForm.contract_amount) || 0,
        currency: vendorForm.currency || 'UZS',
        vendor_type: vendorForm.vendor_type,
        work_scope: vendorForm.work_scope,
        contact_person: vendorForm.contact_person,
        contact_phone: vendorForm.contact_phone,
        contact_email: vendorForm.contact_email,
        start_date: vendorForm.start_date,
        end_date: vendorForm.end_date,
        notes: vendorForm.notes
      };

      if (vendorForm.id) {
        await constructionService.updateProjectVendor(vendorForm.id, vendorData);
      } else {
        await constructionService.addProjectVendor(project.id, vendorData);
      }
      const vendorsData = await constructionService.listProjectVendors(project.id);
      setVendors(vendorsData || []);
      setShowVendorModal(false);
      setVendorForm({
        id: null, vendor_id: '', vendor_name: '', contract_number: '', contract_date: '', contract_amount: '', currency: 'UZS',
        vendor_type: 'subcontractor', work_scope: '', contact_person: '', contact_phone: '', contact_email: '', start_date: '', end_date: '', notes: ''
      });
    } catch (error) {
      console.error('Error saving vendor:', error);
    }
  };

  // Handle material request creation/update
  const handleCreateMaterialRequest = async (e) => {
    e.preventDefault();
    try {
      const requestData = {
        request_number: materialRequestForm.request_number,
        request_date: materialRequestForm.request_date,
        required_date: materialRequestForm.required_date,
        notes: materialRequestForm.notes
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
        id: null, request_number: '', request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft'
      });
    } catch (error) {
      console.error('Error saving material request:', error);
    }
  };

  // Handle daily log creation/update
  const handleCreateDailyLog = async (e) => {
    e.preventDefault();
    try {
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
        materials_received: dailyLogForm.materials_received
      };

      if (dailyLogForm.id) {
        await constructionService.updateDailyReport(dailyLogForm.id, logData);
      } else {
        await constructionService.createDailyReport(project.id, logData);
      }
      const logsData = await constructionService.listDailyReports(project.id);
      setDailyLogs(logsData || []);
      setShowDailyLogModal(false);
      setDailyLogForm({
        id: null,
        report_date: new Date().toISOString().split('T')[0],
        weather_morning: '', weather_afternoon: '',
        temperature_min: '', temperature_max: '',
        work_summary: '', issues_encountered: '', safety_notes: '',
        workers_count: '', workers_details: '', equipment_used: '', materials_received: ''
      });
    } catch (error) {
      console.error('Error saving daily log:', error);
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
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreview(prev => prev.filter((_, i) => i !== index));
  };

  // Handle photo report creation
  const handleCreatePhotoReport = async (e) => {
    e.preventDefault();
    try {
      setUploadingPhotos(true);

      // Upload photos first
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

      await constructionService.createPhotoReport(project.id, {
        report_date: photoReportForm.report_date,
        report_type: photoReportForm.report_type,
        title: photoReportForm.title,
        description: photoReportForm.description,
        location_description: photoReportForm.location_description,
        weather: photoReportForm.weather,
        temperature: parseFloat(photoReportForm.temperature) || 0,
        photos: uploadedPhotos
      });
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
      console.error('Error creating photo report:', error);
    } finally {
      setUploadingPhotos(false);
    }
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
    setPhotoPreview(photos.map(p => p.url || p));
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
    setPhotoPreview(photos.map(p => p.url || p));
    setPhotoFiles([]);
    setShowPhotoReportModal(true);
  };

  // Handle delete photo report
  const handleDeletePhotoReport = async (reportId) => {
    if (!window.confirm(t('confirm_delete') || 'Haqiqatan ham o\'chirmoqchimisiz?')) {
      return;
    }
    try {
      await constructionService.deletePhotoReport(reportId);
      const photosData = await constructionService.listPhotoReports(project.id);
      setPhotoReports(photosData || []);
    } catch (error) {
      console.error('Error deleting photo report:', error);
    }
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
          items={items}
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
          <TabsTrigger value="smeta" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <FolderTree className="w-4 h-4 mr-2" />
            {t('smeta') || 'Smeta'}
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            {t('team') || 'Jamoa'}
          </TabsTrigger>
          <TabsTrigger value="vendors" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Briefcase className="w-4 h-4 mr-2" />
            {t('vendors') || 'Pudratchilar'}
          </TabsTrigger>
          <TabsTrigger value="materials" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Package className="w-4 h-4 mr-2" />
            {t('materials') || 'Materiallar'}
          </TabsTrigger>
          <TabsTrigger value="daily_logs" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            {t('daily_logs') || 'Kunlik jurnal'}
          </TabsTrigger>
          <TabsTrigger value="photo_reports" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Camera className="w-4 h-4 mr-2" />
            {t('photo_reports') || 'Foto hisobotlar'}
          </TabsTrigger>
          <TabsTrigger value="progress" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            {t('progress') || 'Progress'}
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-2" />
            {t('activity') || 'Faoliyat'}
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
              formatCurrency={formatCurrency}
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
                    <p className="font-medium">{project.project_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('building_type') || 'Bino turi'}</p>
                    <p className="font-medium">{project.building_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('total_area') || 'Umumiy maydon'}</p>
                    <p className="font-medium">{project.total_area ? `${project.total_area} m²` : '-'}</p>
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

            {/* Team Widget */}
            <TeamWidget team={team} />

            {/* Vendors Widget */}
            <VendorsWidget vendors={vendors} formatCurrency={formatCurrency} />
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
                                  onClick={async () => {
                                    if (window.confirm(t('confirm_delete') || "O'chirishni tasdiqlaysizmi?")) {
                                      try {
                                        await constructionService.deleteBuilding(project.id, building.id);
                                        const buildingsData = await constructionService.listBuildings(project.id);
                                        setBuildings(buildingsData || []);
                                      } catch (error) {
                                        console.error('Error deleting building:', error);
                                      }
                                    }
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
        </TabsContent>

        {/* Smeta Tab */}
        <TabsContent value="smeta" className="mt-6">
          {/* Smeta Header with Import/Export */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{t('smeta') || 'Smeta'}</h3>
            <ImportExportButtons
              onImport={() => setShowSmetaImportModal(true)}
              onExport={() => setShowSmetaExportModal(true)}
              exportDisabled={sections.length === 0}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sections List */}
            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t('sections') || "Bo'limlar"}</CardTitle>
                <Button size="sm" onClick={() => setShowSectionModal(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {loading ? (
                    <div className="p-4 text-center text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
                  ) : sections.length === 0 ? (
                    <div className="p-8 text-center">
                      <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">{t('no_sections') || "Bo'limlar yo'q"}</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowSectionModal(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        {t('add_section') || "Bo'lim qo'shish"}
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {sections.map((section) => (
                        <div
                          key={section.id}
                          className={`p-4 cursor-pointer hover:bg-slate-50 group ${selectedSection?.id === section.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                          onClick={() => setSelectedSection(section)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 font-mono">{section.code}</p>
                              <p className="font-medium text-sm truncate">{section.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {section.items_count || 0} {t('items') || 'ta'}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                  >
                                    <MoreHorizontal className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  {section.status !== 'approved' && (
                                    <DropdownMenuItem onClick={() => handleApproveSectionStatus(section.id, 'approved')}>
                                      <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                      {t('approve') || 'Tasdiqlash'}
                                    </DropdownMenuItem>
                                  )}
                                  {section.status === 'approved' && (
                                    <DropdownMenuItem onClick={() => handleApproveSectionStatus(section.id, 'draft')}>
                                      <Clock className="w-4 h-4 mr-2 text-orange-600" />
                                      {t('unapprove') || 'Bekor qilish'}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteSection(section.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {t('delete') || "O'chirish"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-slate-600">
                              {formatCurrency(section.total_cost || 0)}
                            </p>
                            <Badge
                              className={`text-xs ${section.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                            >
                              {section.status === 'approved' ? (t('approved') || 'Tasdiqlangan') : (t('pending') || 'Kutilmoqda')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Items List */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {selectedSection ? `${selectedSection.name} - ${t('items') || 'Ishlar'}` : (t('select_section') || "Bo'limni tanlang")}
                </CardTitle>
                {selectedSection && (
                  <Button size="sm" onClick={() => setShowItemModal(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t('add_item') || 'Ish qo\'shish'}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!selectedSection ? (
                  <div className="text-center py-12">
                    <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">{t('select_section_first') || "Avval bo'limni tanlang"}</p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12">
                    <List className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">{t('no_items') || 'Ishlar mavjud emas'}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowItemModal(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      {t('add_item') || 'Ish qo\'shish'}
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">{t('code') || 'Kod'}</th>
                          <th className="text-left py-3 px-2">{t('name') || 'Nomi'}</th>
                          <th className="text-right py-3 px-2">{t('unit') || "O'lchov"}</th>
                          <th className="text-right py-3 px-2">{t('quantity') || 'Miqdor'}</th>
                          <th className="text-right py-3 px-2">{t('unit_price') || 'Narx'}</th>
                          <th className="text-right py-3 px-2">{t('total') || 'Jami'}</th>
                          <th className="text-right py-3 px-2">{t('progress') || '%'}</th>
                          <th className="text-center py-3 px-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b hover:bg-slate-50 group">
                            <td className="py-3 px-2 font-mono text-xs">{item.code || '-'}</td>
                            <td className="py-3 px-2">{item.name}</td>
                            <td className="py-3 px-2 text-right">{item.unit}</td>
                            <td className="py-3 px-2 text-right">{item.quantity || 0}</td>
                            <td className="py-3 px-2 text-right">{formatCurrency(item.unit_price || 0)}</td>
                            <td className="py-3 px-2 text-right font-medium">{formatCurrency(item.total_price || 0)}</td>
                            <td className="py-3 px-2 text-right">
                              <Badge variant={item.completion_percent >= 100 ? 'default' : 'outline'}>
                                {item.completion_percent || 0}%
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold bg-slate-50">
                          <td colSpan={5} className="py-3 px-2 text-right">{t('total') || 'Jami'}:</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(items.reduce((sum, i) => sum + (i.total_price || 0), 0))}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('subcontractors') || 'Pudratchilar'}</CardTitle>
              <Button onClick={() => {
                setVendorForm({
                  id: null, vendor_id: '', vendor_name: '', contract_number: '', contract_date: '', contract_amount: '', currency: 'UZS',
                  vendor_type: 'subcontractor', work_scope: '', contact_person: '', contact_phone: '', contact_email: '', start_date: '', end_date: '', notes: ''
                });
                setShowVendorModal(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                {t('add_vendor') || 'Pudratchi qo\'shish'}
              </Button>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_vendors') || 'Pudratchilar mavjud emas'}</p>
                  <Button variant="outline" className="mt-4" onClick={() => {
                    setVendorForm({
                      id: null, vendor_id: '', vendor_name: '', contract_number: '', contract_date: '', contract_amount: '', currency: 'UZS',
                      vendor_type: 'subcontractor', work_scope: '', contact_person: '', contact_phone: '', contact_email: '', start_date: '', end_date: '', notes: ''
                    });
                    setShowVendorModal(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_first_vendor') || 'Birinchi pudratchini qo\'shing'}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {vendors.map((vendor) => (
                    <Card key={vendor.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{vendor.vendor_name || 'Vendor'}</h4>
                            <p className="text-sm text-slate-500">{vendor.contract_number}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setVendorForm({
                                  id: vendor.id,
                                  vendor_id: vendor.vendor_id || '',
                                  vendor_name: vendor.vendor_name || '',
                                  vendor_type: vendor.vendor_type || '',
                                  contract_number: vendor.contract_number || '',
                                  contract_amount: vendor.contract_amount || '',
                                  work_scope: vendor.work_scope || '',
                                  contact_person: vendor.contact_person || '',
                                  contact_phone: vendor.contact_phone || '',
                                  start_date: vendor.start_date || '',
                                  end_date: vendor.end_date || '',
                                  notes: vendor.notes || ''
                                });
                                setShowVendorModal(true);
                              }}>
                                <Edit className="w-4 h-4 mr-2" />
                                {t('edit') || 'Tahrirlash'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={async () => {
                                  if (window.confirm(t('confirm_delete') || "O'chirishni tasdiqlaysizmi?")) {
                                    try {
                                      await constructionService.removeProjectVendor(vendor.id);
                                      const vendorsData = await constructionService.listProjectVendors(project.id);
                                      setVendors(vendorsData || []);
                                    } catch (error) {
                                      console.error('Error deleting vendor:', error);
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete') || "O'chirish"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-lg font-bold mt-2">{formatCurrency(vendor.contract_amount || 0)}</p>
                        {vendor.work_scope && (
                          <p className="text-sm text-slate-600 mt-1">{vendor.work_scope}</p>
                        )}
                        {vendor.contact_phone && (
                          <p className="text-xs text-slate-400 mt-2">{vendor.contact_phone}</p>
                        )}
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('material_requests') || 'Material so\'rovlari'}</CardTitle>
                <Button size="sm" onClick={() => {
                  setMaterialRequestForm({
                    id: null, request_number: '', request_date: new Date().toISOString().split('T')[0], required_date: '', notes: '', status: 'draft'
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
                    {materialRequests.map((req) => (
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
                            {req.notes && (
                              <p className="text-sm text-slate-600 mt-2">{req.notes}</p>
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
                                setMaterialRequestForm({
                                  id: req.id,
                                  request_number: req.request_number || '',
                                  request_date: req.request_date || new Date().toISOString().split('T')[0],
                                  required_date: req.required_date || '',
                                  notes: req.notes || '',
                                  status: req.status || 'draft'
                                });
                                setShowMaterialRequestModal(true);
                              }}>
                                <Edit className="w-4 h-4 mr-2" />
                                {t('edit') || 'Tahrirlash'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={async () => {
                                  if (window.confirm(t('confirm_delete') || "O'chirishni tasdiqlaysizmi?")) {
                                    try {
                                      await constructionService.deleteMaterialRequest(req.id);
                                      const materialsData = await constructionService.listMaterialRequests(project.id);
                                      setMaterialRequests(materialsData || []);
                                    } catch (error) {
                                      console.error('Error deleting material request:', error);
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete') || "O'chirish"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('deliveries') || 'Yetkazib berishlar'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">{t('no_deliveries') || 'Yetkazib berishlar mavjud emas'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Daily Logs Tab */}
        <TabsContent value="daily_logs" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('daily_logs') || 'Kunlik jurnal'}</CardTitle>
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
                              <p className="font-medium">{format(new Date(log.report_date), 'dd.MM.yyyy')}</p>
                              <Badge className={
                                log.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                                log.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }>{t(log.verification_status) || log.verification_status}</Badge>
                            </div>
                            {(log.weather_morning || log.weather_afternoon) && (
                              <p className="text-sm text-slate-500 mt-1">
                                {log.weather_morning && `${t('morning') || 'Ertalab'}: ${log.weather_morning}`}
                                {log.weather_morning && log.weather_afternoon && ' | '}
                                {log.weather_afternoon && `${t('afternoon') || 'Kunduzi'}: ${log.weather_afternoon}`}
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
                                  report_date: log.report_date || new Date().toISOString().split('T')[0],
                                  weather_morning: log.weather_morning || '',
                                  weather_afternoon: log.weather_afternoon || '',
                                  temperature_min: log.temperature_min || '',
                                  temperature_max: log.temperature_max || '',
                                  work_summary: log.work_summary || log.summary || '',
                                  issues_encountered: log.issues_encountered || '',
                                  safety_notes: log.safety_notes || '',
                                  workers_count: log.workers_count || '',
                                  workers_details: log.workers_details || '',
                                  equipment_used: log.equipment_used || '',
                                  materials_received: log.materials_received || ''
                                });
                                setShowDailyLogModal(true);
                              }}>
                                <Edit className="w-4 h-4 mr-2" />
                                {t('edit') || 'Tahrirlash'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={async () => {
                                  if (window.confirm(t('confirm_delete') || "O'chirishni tasdiqlaysizmi?")) {
                                    try {
                                      await constructionService.deleteDailyReport(log.id);
                                      const logsData = await constructionService.listDailyReports(project.id);
                                      setDailyLogs(logsData || []);
                                    } catch (error) {
                                      console.error('Error deleting daily log:', error);
                                    }
                                  }
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photo Reports Tab */}
        <TabsContent value="photo_reports" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('photo_reports') || 'Foto hisobotlar'}</CardTitle>
              <Button onClick={() => setShowPhotoReportModal(true)}>
                <Camera className="w-4 h-4 mr-2" />
                {t('new_report') || 'Yangi hisobot'}
              </Button>
            </CardHeader>
            <CardContent>
              {photoReports.length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_photo_reports') || 'Foto hisobotlar mavjud emas'}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowPhotoReportModal(true)}>
                    <Camera className="w-4 h-4 mr-2" />
                    {t('add_first_report') || 'Birinchi hisobotni qo\'shing'}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {photoReports.map((report) => (
                    <Card key={report.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{format(new Date(report.report_date), 'dd.MM.yyyy')}</p>
                            <Badge className="mt-1">{report.review_status}</Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewPhotoReport(report)}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('view') || 'Ko\'rish'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditPhotoReport(report)}>
                                <Edit className="w-4 h-4 mr-2" />
                                {t('edit') || 'Tahrirlash'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeletePhotoReport(report.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete') || 'O\'chirish'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {report.description && (
                          <p className="text-sm text-slate-500 mt-2 line-clamp-2">{report.description}</p>
                        )}
                        {(() => {
                          const photos = parsePhotos(report.photos);
                          return photos.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                              <Camera className="w-3 h-3" />
                              <span>{photos.length} {t('photos') || 'ta rasm'}</span>
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
          <Card>
            <CardHeader>
              <CardTitle>{t('work_progress') || 'Ish bajarilishi'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('progress_tracking') || 'Progress kuzatuvi'}</p>
                <p className="text-sm text-slate-400 mt-2">{t('coming_soon') || 'Tez orada'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="mt-6">
          <ActivityLogPanel
            modelName="construction_project"
            recordId={project.id}
            users={employees.map(e => ({ id: e.id, name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.email }))}
            maxHeight="600px"
          />
        </TabsContent>
      </Tabs>

      {/* Building Modal */}
      <Dialog open={showBuildingModal} onOpenChange={setShowBuildingModal}>
        <DialogContent className="max-w-2xl">
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
                  type="number"
                  value={buildingForm.estimated_cost}
                  onChange={(e) => setBuildingForm({ ...buildingForm, estimated_cost: e.target.value })}
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

      {/* Smeta Import Modal */}
      <ImportModal
        open={showSmetaImportModal}
        onClose={() => setShowSmetaImportModal(false)}
        onImport={handleSmetaImport}
        columns={smetaImportColumns}
        entityName={t('smeta') || 'Smeta'}
        templateColumns={smetaImportColumns}
      />

      {/* Smeta Export Modal */}
      <ExportModal
        open={showSmetaExportModal}
        onClose={() => setShowSmetaExportModal(false)}
        data={smetaExportData}
        columns={smetaExportColumns}
        entityName={t('smeta') || 'Smeta'}
        title={`${project.name} - ${t('smeta') || 'Smeta'}`}
      />

      {/* Section Modal */}
      <Dialog open={showSectionModal} onOpenChange={setShowSectionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('new_section') || "Yangi bo'lim"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSection} className="space-y-4">
            <div>
              <Label>{t('code') || 'Kod'} *</Label>
              <Input
                value={sectionForm.code}
                onChange={(e) => setSectionForm({ ...sectionForm, code: e.target.value })}
                placeholder="BOL-001"
                required
              />
            </div>
            <div>
              <Label>{t('name') || 'Nomi'} *</Label>
              <Input
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                placeholder="Poydevor ishlari"
                required
              />
            </div>
            <div>
              <Label>{t('description') || 'Tavsif'}</Label>
              <Textarea
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSectionModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{t('create') || 'Yaratish'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('new_item') || 'Yangi ish'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('code') || 'Kod'}</Label>
                <Input
                  value={itemForm.code}
                  onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                  placeholder="ISH-001"
                />
              </div>
              <div>
                <Label>{t('unit') || "O'lchov"} *</Label>
                <Input
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  placeholder="m³"
                  required
                />
              </div>
            </div>
            <div>
              <Label>{t('name') || 'Nomi'} *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="Beton quyish"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('quantity') || 'Miqdor'} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>{t('unit_price') || 'Birlik narxi'} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.unit_price}
                  onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowItemModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{t('create') || 'Yaratish'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Team Member Modal */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent>
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

      {/* Vendor Modal */}
      <Dialog open={showVendorModal} onOpenChange={setShowVendorModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{vendorForm.id ? (t('edit_vendor') || "Pudratchini tahrirlash") : (t('add_vendor') || "Pudratchi qo'shish")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateVendor} className="space-y-4">
            {/* Vendor Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('select_organization') || 'Mavjud tashkilot'}</Label>
                <Select
                  value={vendorForm.vendor_id || '__new__'}
                  onValueChange={(value) => setVendorForm({ ...vendorForm, vendor_id: value === '__new__' ? '' : value, vendor_name: value === '__new__' ? vendorForm.vendor_name : '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_organization') || 'Tashkilotni tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">{t('new_vendor') || 'Yangi pudratchi'}</SelectItem>
                    {organizations.filter(org => org.id).map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!vendorForm.vendor_id && (
                <div>
                  <Label>{t('vendor_name') || 'Pudratchi nomi'} *</Label>
                  <Input
                    value={vendorForm.vendor_name}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                    placeholder="Qurilish MChJ"
                    required={!vendorForm.vendor_id}
                  />
                </div>
              )}
              {vendorForm.vendor_id && <div></div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('vendor_type') || 'Turi'}</Label>
                <Select
                  value={vendorForm.vendor_type}
                  onValueChange={(value) => setVendorForm({ ...vendorForm, vendor_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_type') || 'Turni tanlang'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subcontractor">{t('subcontractor') || 'Pudratchi'}</SelectItem>
                    <SelectItem value="supplier">{t('supplier') || 'Yetkazib beruvchi'}</SelectItem>
                    <SelectItem value="consultant">{t('consultant') || 'Maslahatchi'}</SelectItem>
                    <SelectItem value="other">{t('other') || 'Boshqa'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('contract_date') || 'Shartnoma sanasi'}</Label>
                <Input
                  type="date"
                  value={vendorForm.contract_date || ''}
                  onChange={(e) => setVendorForm({ ...vendorForm, contract_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('contract_number') || 'Shartnoma raqami'}</Label>
                <Input
                  value={vendorForm.contract_number}
                  onChange={(e) => setVendorForm({ ...vendorForm, contract_number: e.target.value })}
                  placeholder="SH-2024-001"
                />
              </div>
              <div>
                <Label>{t('contract_amount') || 'Shartnoma summasi'}</Label>
                <Input
                  type="number"
                  value={vendorForm.contract_amount}
                  onChange={(e) => setVendorForm({ ...vendorForm, contract_amount: e.target.value })}
                  placeholder="100000000"
                />
              </div>
            </div>
            <div>
              <Label>{t('work_scope') || 'Ish hajmi'}</Label>
              <Textarea
                value={vendorForm.work_scope}
                onChange={(e) => setVendorForm({ ...vendorForm, work_scope: e.target.value })}
                placeholder={t('work_scope_placeholder') || "Bajaradigan ishlar tavsifi..."}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('contact_person') || "Bog'lanish shaxsi"}</Label>
                <Input
                  value={vendorForm.contact_person}
                  onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                  placeholder="Alisher Karimov"
                />
              </div>
              <div>
                <Label>{t('contact_phone') || 'Telefon'}</Label>
                <Input
                  value={vendorForm.contact_phone}
                  onChange={(e) => setVendorForm({ ...vendorForm, contact_phone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                />
              </div>
              <div>
                <Label>{t('contact_email') || 'Email'}</Label>
                <Input
                  type="email"
                  value={vendorForm.contact_email}
                  onChange={(e) => setVendorForm({ ...vendorForm, contact_email: e.target.value })}
                  placeholder="info@company.uz"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('start_date') || 'Boshlanish sanasi'}</Label>
                <Input
                  type="date"
                  value={vendorForm.start_date}
                  onChange={(e) => setVendorForm({ ...vendorForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('end_date') || 'Tugash sanasi'}</Label>
                <Input
                  type="date"
                  value={vendorForm.end_date}
                  onChange={(e) => setVendorForm({ ...vendorForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowVendorModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!vendorForm.vendor_id && !vendorForm.vendor_name}>
                {t('add') || "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Material Request Modal */}
      <Dialog open={showMaterialRequestModal} onOpenChange={setShowMaterialRequestModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{materialRequestForm.id ? (t('edit_material_request') || "Material so'rovini tahrirlash") : (t('new_material_request') || "Yangi material so'rovi")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMaterialRequest} className="space-y-4">
            <div>
              <Label>{t('request_number') || "So'rov raqami"} *</Label>
              <Input
                value={materialRequestForm.request_number}
                onChange={(e) => setMaterialRequestForm({ ...materialRequestForm, request_number: e.target.value })}
                placeholder="MR-2024-001"
                required
              />
            </div>
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
            <div>
              <Label>{t('notes') || 'Izohlar'}</Label>
              <Textarea
                value={materialRequestForm.notes}
                onChange={(e) => setMaterialRequestForm({ ...materialRequestForm, notes: e.target.value })}
                placeholder={t('notes_placeholder') || "Qo'shimcha ma'lumotlar..."}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMaterialRequestModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!materialRequestForm.request_number || !materialRequestForm.request_date}>
                {t('create') || 'Yaratish'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Daily Log Modal */}
      <Dialog open={showDailyLogModal} onOpenChange={setShowDailyLogModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDailyLogModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!dailyLogForm.report_date}>
                {t('create') || 'Yaratish'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Photo Report Modal */}
      <Dialog open={showPhotoReportModal} onOpenChange={setShowPhotoReportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('new_photo_report') || 'Yangi foto hisobot'}</DialogTitle>
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
                    {photoPreview.map((item, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={item.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
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
              <Button type="submit" disabled={!photoReportForm.report_date || !photoReportForm.title || photoFiles.length === 0 || uploadingPhotos}>
                {uploadingPhotos ? (
                  <>{t('uploading') || 'Yuklanmoqda'}...</>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                  <p className="font-medium">{selectedDailyLog.weather_morning || '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t('weather_afternoon') || 'Kunduzi ob-havo'}</p>
                  <p className="font-medium">{selectedDailyLog.weather_afternoon || '-'}</p>
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
                  <p className="text-sm">{selectedDailyLog.equipment_used}</p>
                </div>
              )}

              {selectedDailyLog.materials_received && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('materials_received') || 'Qabul qilingan materiallar'}</p>
                  <p className="text-sm">{selectedDailyLog.materials_received}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDailyLogViewModal(false)}>
              {t('close') || 'Yopish'}
            </Button>
            <Button onClick={() => {
              setDailyLogForm({
                id: selectedDailyLog.id,
                report_date: selectedDailyLog.report_date || new Date().toISOString().split('T')[0],
                weather_morning: selectedDailyLog.weather_morning || '',
                weather_afternoon: selectedDailyLog.weather_afternoon || '',
                temperature_min: selectedDailyLog.temperature_min || '',
                temperature_max: selectedDailyLog.temperature_max || '',
                work_summary: selectedDailyLog.work_summary || '',
                issues_encountered: selectedDailyLog.issues_encountered || '',
                safety_notes: selectedDailyLog.safety_notes || '',
                workers_count: selectedDailyLog.workers_count || '',
                workers_details: selectedDailyLog.workers_details || '',
                equipment_used: selectedDailyLog.equipment_used || '',
                materials_received: selectedDailyLog.materials_received || ''
              });
              setShowDailyLogViewModal(false);
              setShowDailyLogModal(true);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              {t('edit') || 'Tahrirlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main Component
export default function Construction() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

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

  const [activeTab, setActiveTab] = useState('projects');
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
      [PROJECT_STATUS.APPROVED]: { label: t('approved') || 'Tasdiqlangan', color: 'bg-blue-500' },
      [PROJECT_STATUS.IN_PROGRESS]: { label: t('in_progress') || 'Jarayonda', color: 'bg-orange-500' },
      [PROJECT_STATUS.ON_HOLD]: { label: t('on_hold') || "To'xtatilgan", color: 'bg-yellow-500' },
      [PROJECT_STATUS.COMPLETED]: { label: t('completed') || 'Tugallangan', color: 'bg-green-500' },
      [PROJECT_STATUS.CANCELLED]: { label: t('cancelled') || 'Bekor qilingan', color: 'bg-red-500' }
    };
    const statusConfig = config[status] || config[PROJECT_STATUS.DRAFT];
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

  const handleDeleteProject = async (id) => {
    if (window.confirm(t('confirm_delete') || "O'chirishni tasdiqlaysizmi?")) {
      await deleteProject(id);
    }
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
                  <p className="text-lg font-bold text-slate-900 truncate">{formatCurrency(stats.totalContractAmount)}</p>
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
                  <p className="text-lg font-bold text-slate-900 truncate">{formatCurrency(stats.totalSmeta)}</p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  type="number"
                  value={projectForm.contract_amount}
                  onChange={(e) => setProjectForm({ ...projectForm, contract_amount: e.target.value })}
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
    </div>
  );
}
