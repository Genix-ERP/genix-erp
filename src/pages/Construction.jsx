import React, { useState, useEffect, useCallback } from 'react';
import { useConstructionContext } from '@/components/contexts/ConstructionContext';
import { constructionService } from '@/api/services/construction';
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
  HardHat
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format } from 'date-fns';

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
  getStatusBadge,
  formatCurrency,
  t,
  PROJECT_STATUS
}) => {
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
        <Button onClick={onCreateProject} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
          <Plus className="w-4 h-4 mr-2" />
          {t('new_project') || 'Yangi loyiha'}
        </Button>
      </CardHeader>
      <CardContent className="p-6">
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
              <SelectItem value="in_progress">{t('in_progress') || 'Jarayonda'}</SelectItem>
              <SelectItem value="completed">{t('completed') || 'Tugallangan'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500">{t('loading') || 'Yuklanmoqda...'}</div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_projects') || 'Loyihalar topilmadi'}</p>
          </div>
        ) : (
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
  const [vendors, setVendors] = useState([]);
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
            // Team loading would go here when API is ready
            break;
          case 'vendors':
            try {
              const vendorsData = await constructionService.listProjectVendors(project.id);
              setVendors(vendorsData || []);
            } catch (e) { setVendors([]); }
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
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

            {/* Financial Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('financial_summary') || 'Moliyaviy'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">{t('contract_amount') || 'Shartnoma'}</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(project.contract_amount || 0)}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-slate-500">{t('total_smeta') || 'Smeta'}</p>
                  <p className="text-xl font-semibold">{formatCurrency(project.total_smeta || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('progress') || 'Progress'}</p>
                  <Progress value={project.progress_percent || 0} className="h-3 mt-2" />
                  <p className="text-right text-sm mt-1">{project.progress_percent || 0}%</p>
                </div>
              </CardContent>
            </Card>

            {/* Timeline Card */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>{t('timeline') || 'Vaqt jadvali'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-sm text-slate-500">{t('planned_start') || 'Rejadagi boshlanish'}</p>
                    <p className="font-medium">{project.planned_start_date ? format(new Date(project.planned_start_date), 'dd.MM.yyyy') : '-'}</p>
                  </div>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full relative">
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      style={{ width: `${project.progress_percent || 0}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-500">{t('planned_end') || 'Rejadagi tugash'}</p>
                    <p className="font-medium">{project.planned_end_date ? format(new Date(project.planned_end_date), 'dd.MM.yyyy') : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                          className={`p-4 cursor-pointer hover:bg-slate-50 ${selectedSection?.id === section.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                          onClick={() => setSelectedSection(section)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-slate-500 font-mono">{section.code}</p>
                              <p className="font-medium text-sm">{section.name}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {section.items_count || 0} {t('items') || 'ta'}
                            </Badge>
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
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b hover:bg-slate-50">
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
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold bg-slate-50">
                          <td colSpan={5} className="py-3 px-2 text-right">{t('total') || 'Jami'}:</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(items.reduce((sum, i) => sum + (i.total_price || 0), 0))}</td>
                          <td></td>
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
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('no_team_members') || "Jamoa a'zolari yo'q"}</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowTeamModal(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('add_first_member') || "Birinchi a'zoni qo'shing"}
                </Button>
              </div>
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
