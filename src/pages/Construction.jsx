import React, { useState, useEffect } from 'react';
import { useConstructionContext } from '@/components/contexts/ConstructionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format } from 'date-fns';

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

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const stats = getProjectStats();

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.client_name?.String || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Status badge config
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

  // Handle form submission
  const handleSubmitProject = async (e) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await updateProject(editingProject.id, projectForm);
      } else {
        await createProject(projectForm);
      }
      setShowProjectModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  // Reset form
  const resetForm = () => {
    setProjectForm({
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
    setEditingProject(null);
  };

  // Open edit modal
  const handleEditProject = (project) => {
    setEditingProject(project);
    setProjectForm({
      code: project.code,
      name: project.name,
      description: project.description?.String || '',
      address: project.address?.String || '',
      city: project.city?.String || '',
      region: project.region?.String || '',
      client_name: project.client_name?.String || '',
      client_phone: project.client_phone?.String || '',
      project_type: project.project_type?.String || '',
      building_type: project.building_type?.String || '',
      total_area: project.total_area?.Float64 || '',
      floors_count: project.floors_count?.Int32 || '',
      contract_amount: project.contract_amount?.Float64 || '',
      planned_start_date: project.planned_start_date?.Time ? format(new Date(project.planned_start_date.Time), 'yyyy-MM-dd') : '',
      planned_end_date: project.planned_end_date?.Time ? format(new Date(project.planned_end_date.Time), 'yyyy-MM-dd') : ''
    });
    setShowProjectModal(true);
  };

  // Handle delete
  const handleDeleteProject = async (id) => {
    if (window.confirm(t('confirm_delete') || "O'chirishni tasdiqlaysizmi?")) {
      await deleteProject(id);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">

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
                  <Building2 className="w-5 h-5 text-green-600" />
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
                  <p className="text-lg font-bold text-slate-900 truncate">
                    {formatCurrency(stats.totalContractAmount)}
                  </p>
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
                  <p className="text-lg font-bold text-slate-900 truncate">
                    {formatCurrency(stats.totalSmeta)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white/80 backdrop-blur-sm border border-slate-200/60 p-1 w-full md:w-auto">
            <TabsTrigger value="projects" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <Building2 className="w-4 h-4 mr-2" />
              {t('projects') || 'Loyihalar'}
            </TabsTrigger>
            <TabsTrigger value="smeta" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <FolderTree className="w-4 h-4 mr-2" />
              {t('smeta') || 'Smeta'}
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white">
              <Camera className="w-4 h-4 mr-2" />
              {t('reports') || 'Hisobotlar'}
            </TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader className="border-b border-slate-200/60 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-800">
                  {t('construction_projects') || 'Qurilish loyihalari'}
                </CardTitle>
                <Button
                  onClick={() => { resetForm(); setShowProjectModal(true); }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_project') || 'Yangi loyiha'}
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                {/* Search and Filter */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder={t('search_projects') || 'Loyihalarni izlash...'}
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

                {/* Projects Grid */}
                {loading ? (
                  <div className="text-center py-8 text-slate-500">
                    {t('loading') || 'Yuklanmoqda...'}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">{t('no_projects') || 'Loyihalar topilmadi'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredProjects.map((project) => (
                      <Card key={project.id} className="hover:shadow-lg transition-shadow border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-xs text-slate-500 font-mono">{project.code}</p>
                              <h3 className="font-semibold text-slate-800 mt-1">{project.name}</h3>
                            </div>
                            {getStatusBadge(project.status)}
                          </div>

                          {project.client_name?.String && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                              <Users className="w-4 h-4" />
                              {project.client_name.String}
                            </div>
                          )}

                          {(project.city?.String || project.region?.String) && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                              <MapPin className="w-4 h-4" />
                              {[project.city?.String, project.region?.String].filter(Boolean).join(', ')}
                            </div>
                          )}

                          {project.contract_amount?.Float64 > 0 && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                              <DollarSign className="w-4 h-4" />
                              {formatCurrency(project.contract_amount.Float64)}
                            </div>
                          )}

                          {/* Progress bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-600">{t('progress') || 'Progress'}</span>
                              <span className="font-medium">{project.progress_percent?.Float64 || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                                style={{ width: `${project.progress_percent?.Float64 || 0}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                            <FolderTree className="w-3 h-3" />
                            {project.sections_count || 0} {t('sections') || "bo'limlar"} •
                            {formatCurrency(project.total_smeta || 0)} {t('smeta') || 'smeta'}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-3 border-t border-slate-100">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditProject(project)}>
                              <Edit className="w-3 h-3 mr-1" />
                              {t('edit') || 'Tahrirlash'}
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteProject(project.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm">
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
          </TabsContent>

          {/* Smeta Tab */}
          <TabsContent value="smeta" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardContent className="p-12 text-center">
                <FolderTree className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {t('smeta_management') || 'Smeta boshqaruvi'}
                </h3>
                <p className="text-slate-500 mb-4">
                  {t('select_project_first') || "Avval loyihani tanlang"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardContent className="p-12 text-center">
                <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {t('photo_reports') || 'Foto hisobotlar'}
                </h3>
                <p className="text-slate-500">
                  {t('coming_soon') || "Tez orada"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
                <Label>{t('client_name') || 'Buyurtmachi'}</Label>
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
                <Select
                  value={projectForm.project_type}
                  onValueChange={(v) => setProjectForm({ ...projectForm, project_type: v })}
                >
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

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowProjectModal(false)} className="flex-1">
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                {editingProject ? (t('update') || 'Yangilash') : (t('create') || 'Yaratish')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
