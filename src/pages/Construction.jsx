import React, { useState, useEffect, useCallback } from 'react';
import { useConstructionContext } from '@/components/contexts/ConstructionContext';
import { constructionService } from '@/api/services/construction';
import { hrService } from '@/api/services/hr';
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
  Columns3
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format } from 'date-fns';
import { ActivityLogPanel } from '@/components/shared/ActivityLog';
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
                      <p className="text-xs text-slate-500 font-mono">{project.code}</p>
                      <h3 className="font-semibold text-slate-800 mt-1">{project.name}</h3>
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

  // Forms
  const [buildingForm, setBuildingForm] = useState({
    code: '', name: '', description: '', building_type: '', building_purpose: '',
    floors_count: '', total_area: '', apartments_count: '', estimated_cost: ''
  });
  const [sectionForm, setSectionForm] = useState({ code: '', name: '', description: '' });
  const [itemForm, setItemForm] = useState({ code: '', name: '', unit: '', quantity: '', unit_price: '' });
  const [teamForm, setTeamForm] = useState({ employee_id: '', role: '', responsibilities: '', start_date: '' });
  const [vendorForm, setVendorForm] = useState({
    vendor_id: '', vendor_name: '', contract_number: '', contract_date: '', contract_amount: '', currency: 'UZS',
    vendor_type: 'subcontractor', work_scope: '', contact_person: '', contact_phone: '', contact_email: '', start_date: '', end_date: ''
  });
  const [materialRequestForm, setMaterialRequestForm] = useState({
    request_number: '', request_date: new Date().toISOString().split('T')[0], required_date: '', notes: ''
  });
  const [dailyLogForm, setDailyLogForm] = useState({
    report_date: new Date().toISOString().split('T')[0],
    weather_morning: '', weather_afternoon: '',
    temperature_min: '', temperature_max: '',
    work_summary: '', issues_encountered: '', safety_notes: '',
    workers_count: '', workers_details: '', equipment_used: '', materials_received: ''
  });
  const [photoReportForm, setPhotoReportForm] = useState({
    report_date: new Date().toISOString().split('T')[0],
    report_type: 'progress',
    title: '',
    description: '',
    location_description: '',
    weather: '',
    temperature: ''
  });

  // Load data based on active tab
  useEffect(() => {
    if (!project?.id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        switch (activeSubTab) {
          case 'overview':
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

  // Handle building creation
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
      await constructionService.createBuilding(project.id, formData);
      const buildingsData = await constructionService.listBuildings(project.id);
      setBuildings(buildingsData || []);
      setShowBuildingModal(false);
      setBuildingForm({
        code: '', name: '', description: '', building_type: '', building_purpose: '',
        floors_count: '', total_area: '', apartments_count: '', estimated_cost: ''
      });
    } catch (error) {
      console.error('Error creating building:', error);
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
  const handleDeleteSection = async (sectionId, e) => {
    e.stopPropagation();
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

  // Handle vendor creation
  const handleCreateVendor = async (e) => {
    e.preventDefault();
    try {
      await constructionService.addProjectVendor(project.id, {
        vendor_id: vendorForm.vendor_id || '',
        vendor_name: vendorForm.vendor_id ? '' : vendorForm.vendor_name, // Only send name if no org selected
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
        end_date: vendorForm.end_date
      });
      const vendorsData = await constructionService.listProjectVendors(project.id);
      setVendors(vendorsData || []);
      setShowVendorModal(false);
      setVendorForm({
        vendor_id: '', vendor_name: '', contract_number: '', contract_date: '', contract_amount: '', currency: 'UZS',
        vendor_type: 'subcontractor', work_scope: '', contact_person: '', contact_phone: '', contact_email: '', start_date: '', end_date: ''
      });
    } catch (error) {
      console.error('Error adding vendor:', error);
    }
  };

  // Handle material request creation
  const handleCreateMaterialRequest = async (e) => {
    e.preventDefault();
    try {
      await constructionService.createMaterialRequest(project.id, {
        request_number: materialRequestForm.request_number,
        request_date: materialRequestForm.request_date,
        required_date: materialRequestForm.required_date,
        notes: materialRequestForm.notes
      });
      const materialsData = await constructionService.listMaterialRequests(project.id);
      setMaterialRequests(materialsData || []);
      setShowMaterialRequestModal(false);
      setMaterialRequestForm({
        request_number: '', request_date: new Date().toISOString().split('T')[0], required_date: '', notes: ''
      });
    } catch (error) {
      console.error('Error creating material request:', error);
    }
  };

  // Handle daily log creation
  const handleCreateDailyLog = async (e) => {
    e.preventDefault();
    try {
      await constructionService.createDailyReport(project.id, {
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
      });
      const logsData = await constructionService.listDailyReports(project.id);
      setDailyLogs(logsData || []);
      setShowDailyLogModal(false);
      setDailyLogForm({
        report_date: new Date().toISOString().split('T')[0],
        weather_morning: '', weather_afternoon: '',
        temperature_min: '', temperature_max: '',
        work_summary: '', issues_encountered: '', safety_notes: '',
        workers_count: '', workers_details: '', equipment_used: '', materials_received: ''
      });
    } catch (error) {
      console.error('Error creating daily log:', error);
    }
  };

  // Handle photo report creation
  const handleCreatePhotoReport = async (e) => {
    e.preventDefault();
    try {
      await constructionService.createPhotoReport(project.id, {
        report_date: photoReportForm.report_date,
        report_type: photoReportForm.report_type,
        title: photoReportForm.title,
        description: photoReportForm.description,
        location_description: photoReportForm.location_description,
        weather: photoReportForm.weather,
        temperature: parseFloat(photoReportForm.temperature) || 0
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
    } catch (error) {
      console.error('Error creating photo report:', error);
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
          <p className="text-slate-500 text-sm mt-1">{project.code}</p>
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
            <FinancialWidget project={project} formatCurrency={formatCurrency} />

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
            <AlertsWidget project={project} sections={sections} vendors={vendors} />

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
              <Button onClick={() => setShowBuildingModal(true)} size="sm" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                <Plus className="w-4 h-4 mr-2" />
                {t('add_building') || "Bino qo'shish"}
              </Button>
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
                    <Card key={building.id} className="border hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-slate-800">{building.name}</h3>
                            <p className="text-sm text-slate-500">{building.code}</p>
                          </div>
                          <Badge className={building.status === 'completed' ? 'bg-green-500' : building.status === 'in_progress' ? 'bg-orange-500' : 'bg-gray-500'}>
                            {building.status}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('building_type') || 'Bino turi'}</span>
                            <span className="font-medium">{building.building_type || building.building_purpose || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('floors_count') || 'Qavatlar'}</span>
                            <span className="font-medium">{building.floors_count || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('total_area') || 'Maydon'}</span>
                            <span className="font-medium">{building.total_area ? `${building.total_area} m²` : '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('apartments') || 'Xonadonlar'}</span>
                            <span className="font-medium">{building.apartments_count || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('estimated_cost') || 'Smeta'}</span>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => handleDeleteSection(section.id, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {formatCurrency(section.total_cost || 0)}
                          </p>
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
                          <Badge variant="secondary" className="mb-2">{member.role}</Badge>
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
              <Button onClick={() => setShowVendorModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('add_vendor') || 'Pudratchi qo\'shish'}
              </Button>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_vendors') || 'Pudratchilar mavjud emas'}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowVendorModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_first_vendor') || 'Birinchi pudratchini qo\'shing'}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {vendors.map((vendor) => (
                    <Card key={vendor.id}>
                      <CardContent className="p-4">
                        <h4 className="font-semibold">{vendor.vendor_name || 'Vendor'}</h4>
                        <p className="text-sm text-slate-500">{vendor.contract_number}</p>
                        <p className="text-lg font-bold mt-2">{formatCurrency(vendor.contract_amount || 0)}</p>
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
                <Button size="sm" onClick={() => setShowMaterialRequestModal(true)}>
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
                      <div key={req.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">{req.request_number}</span>
                          <Badge>{req.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-500">{format(new Date(req.request_date), 'dd.MM.yyyy')}</p>
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
              <Button onClick={() => setShowDailyLogModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('new_entry') || 'Yangi yozuv'}
              </Button>
            </CardHeader>
            <CardContent>
              {dailyLogs.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_daily_logs') || 'Kunlik yozuvlar mavjud emas'}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowDailyLogModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_first_entry') || 'Birinchi yozuvni qo\'shing'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dailyLogs.map((log) => (
                    <Card key={log.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{format(new Date(log.report_date), 'dd.MM.yyyy')}</p>
                            <p className="text-sm text-slate-500 mt-1">{log.weather}</p>
                          </div>
                          <Badge>{log.verification_status}</Badge>
                        </div>
                        <p className="mt-3">{log.summary}</p>
                        <div className="flex gap-4 mt-3 text-sm text-slate-600">
                          <span><Users className="w-4 h-4 inline mr-1" />{log.workers_count} {t('workers') || 'ishchi'}</span>
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
                    <Card key={report.id}>
                      <CardContent className="p-4">
                        <p className="font-medium">{format(new Date(report.report_date), 'dd.MM.yyyy')}</p>
                        <p className="text-sm text-slate-500">{report.description}</p>
                        <Badge className="mt-2">{report.review_status}</Badge>
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
            <DialogTitle>{t('new_building') || "Yangi bino"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBuilding} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('building_code') || 'Bino kodi'} *</Label>
                <Input
                  value={buildingForm.code}
                  onChange={(e) => setBuildingForm({ ...buildingForm, code: e.target.value })}
                  placeholder="BLOCK-A"
                  required
                />
              </div>
              <div>
                <Label>{t('building_name') || 'Bino nomi'} *</Label>
                <Input
                  value={buildingForm.name}
                  onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                  placeholder="A blok - Turar-joy"
                  required
                />
              </div>
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
            <div>
              <Label>{t('estimated_cost') || 'Taxminiy narx'}</Label>
              <Input
                type="number"
                value={buildingForm.estimated_cost}
                onChange={(e) => setBuildingForm({ ...buildingForm, estimated_cost: e.target.value })}
                placeholder="5000000000"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBuildingModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{t('create') || 'Yaratish'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>{t('add_vendor') || "Pudratchi qo'shish"}</DialogTitle>
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
            <DialogTitle>{t('new_material_request') || "Yangi material so'rovi"}</DialogTitle>
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
            <DialogTitle>{t('new_daily_log') || 'Yangi kunlik hisobot'}</DialogTitle>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPhotoReportModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!photoReportForm.report_date || !photoReportForm.title}>
                {t('create') || 'Yaratish'}
              </Button>
            </DialogFooter>
          </form>
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
    code: '',
    name: '',
    description: '',
    address: '',
    city: '',
    region: '',
    client_name: '',
    client_phone: '',
    project_type: '',
    building_type: '',
    total_area: '',
    floors_count: '',
    contract_amount: '',
    planned_start_date: '',
    planned_end_date: ''
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
      code: '', name: '', description: '', address: '', city: '', region: '',
      client_name: '', client_phone: '', project_type: '', building_type: '',
      total_area: '', floors_count: '', contract_amount: '', planned_start_date: '', planned_end_date: ''
    });
    setEditingProject(null);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setProjectForm({
      code: project.code,
      name: project.name,
      description: project.description || '',
      address: project.address || '',
      city: project.city || '',
      region: project.region || '',
      client_name: project.client_name || '',
      client_phone: project.client_phone || '',
      project_type: project.project_type || '',
      building_type: project.building_type || '',
      total_area: project.total_area || '',
      floors_count: project.floors_count || '',
      contract_amount: project.contract_amount || '',
      planned_start_date: project.planned_start_date ? format(new Date(project.planned_start_date), 'yyyy-MM-dd') : '',
      planned_end_date: project.planned_end_date ? format(new Date(project.planned_end_date), 'yyyy-MM-dd') : ''
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('project_code') || 'Loyiha kodi'} *</Label>
                <Input
                  value={projectForm.code}
                  onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                  placeholder="PRJ-2024-001"
                  required
                  disabled={!!editingProject}
                />
              </div>
              <div>
                <Label>{t('project_name') || 'Loyiha nomi'} *</Label>
                <Input
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label>{t('description') || 'Tavsif'}</Label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('client_name') || 'Mijoz nomi'}</Label>
                <Input
                  value={projectForm.client_name}
                  onChange={(e) => setProjectForm({ ...projectForm, client_name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('client_phone') || 'Telefon'}</Label>
                <Input
                  value={projectForm.client_phone}
                  onChange={(e) => setProjectForm({ ...projectForm, client_phone: e.target.value })}
                />
              </div>
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
