import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModules } from '@/components/contexts/ModulesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Briefcase, Clock, DollarSign, TrendingUp, Brain, CheckCircle, AlertTriangle, Target, Lightbulb, Edit2, LayoutGrid, Columns, Settings, X, GripVertical } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { analyzeProjects } from '@/api/services/aiAnalytics';
import { contactsService } from '@/api/services/contacts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";

// Default status IDs for Kanban
const DEFAULT_STATUS_IDS = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
const DEFAULT_STATUS_COLORS = {
  planning: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function Projects() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { projects, createProject, updateProject, isLoading } = useModules();
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'kanban'

  // Default statuses with translations
  const DEFAULT_STATUSES = useMemo(() => DEFAULT_STATUS_IDS.map(id => ({
    id,
    label: t(id),
    color: DEFAULT_STATUS_COLORS[id]
  })), [t]);

  // Custom statuses stored in localStorage
  const [customStatuses, setCustomStatuses] = useState(() => {
    const saved = localStorage.getItem('genix_project_statuses');
    if (saved) {
      return JSON.parse(saved);
    }
    return null; // Will be set in useEffect
  });

  const [newStatus, setNewStatus] = useState({ label: '', color: 'bg-blue-100 text-blue-800' });
  const [clients, setClients] = useState([]);

  // AI Analysis
  const projectAnalysis = useMemo(() => analyzeProjects(projects), [projects]);

  const [newProject, setNewProject] = useState({
    project_name: '',
    project_code: '',
    client_name: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    budget: 0,
    billing_type: 'time_material',
    priority: 'medium'
  });

  // Initialize customStatuses with DEFAULT_STATUSES if not saved
  useEffect(() => {
    if (customStatuses === null) {
      setCustomStatuses(DEFAULT_STATUSES);
    }
  }, [DEFAULT_STATUSES, customStatuses]);

  // Fetch clients/contacts for dropdown
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await contactsService.list({ contact_type: 'customer' });
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
        setClients([]);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    let filtered = projects;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        // Convert p.status to string if it's an object
        const pStatus = typeof p.status === 'string' ? p.status : (p.status?.String || p.status?.toString?.() || '');
        return pStatus === statusFilter;
      });
    }
    if (searchQuery) {
      filtered = filtered.filter(p => {
        const projectName = String(p.project_name || '');
        const clientName = String(p.client_name || '');
        return projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
               clientName.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }
    setFilteredProjects(filtered);
  }, [projects, searchQuery, statusFilter]);

  // Save custom statuses to localStorage
  useEffect(() => {
    if (customStatuses !== null) {
      localStorage.setItem('genix_project_statuses', JSON.stringify(customStatuses));
    }
  }, [customStatuses]);

  const handleCreateProject = async () => {
    setIsSubmitting(true);
    try {
      await createProject({
        ...newProject,
        project_code: newProject.project_code || `PRJ-${Date.now()}`,
        budget: parseFloat(newProject.budget) || 0,
        status: 'planning',
        progress_percentage: 0,
        actual_cost: 0,
        total_hours_logged: 0
      });
      setShowCreateModal(false);
      setNewProject({
        project_name: '',
        project_code: '',
        client_name: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        budget: 0,
        billing_type: 'time_material',
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProject = (project, e) => {
    if (e) e.stopPropagation();
    setEditProject({
      ...project,
      budget: project.budget || 0,
      progress_percentage: project.progress_percentage || 0
    });
    setShowEditModal(true);
  };

  const handleUpdateProject = async () => {
    if (!editProject) return;

    setIsSubmitting(true);
    try {
      updateProject(editProject.id, {
        project_name: editProject.project_name,
        project_code: editProject.project_code,
        client_name: editProject.client_name,
        start_date: editProject.start_date,
        end_date: editProject.end_date,
        budget: parseFloat(editProject.budget) || 0,
        billing_type: editProject.billing_type,
        status: editProject.status,
        priority: editProject.priority,
        progress_percentage: parseInt(editProject.progress_percentage) || 0
      });
      setShowEditModal(false);
      setEditProject(null);
    } catch (error) {
      console.error('Error updating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDragStart = (e, project) => {
    e.dataTransfer.setData('projectId', project.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    if (projectId) {
      updateProject(projectId, { status: newStatus });
    }
  };

  const addCustomStatus = () => {
    if (newStatus.label.trim() && customStatuses) {
      const statusId = newStatus.label.toLowerCase().replace(/\s+/g, '_');
      if (!customStatuses.find(s => s.id === statusId)) {
        setCustomStatuses([...customStatuses, {
          id: statusId,
          label: newStatus.label.trim(),
          color: newStatus.color
        }]);
        setNewStatus({ label: '', color: 'bg-blue-100 text-blue-800' });
      }
    }
  };

  const removeCustomStatus = (statusId) => {
    if (!customStatuses) return;
    // Don't remove if there are projects with this status
    const hasProjects = projects.some(p => {
      // Convert p.status to string if it's an object
      const pStatus = typeof p.status === 'string' ? p.status : (p.status?.String || p.status?.toString?.() || '');
      return pStatus === statusId;
    });
    if (hasProjects) {
      alert(t('cannot_remove_status'));
      return;
    }
    setCustomStatuses(customStatuses.filter(s => s.id !== statusId));
  };

  const getStatusColor = (status) => {
    // Convert status to string if it's an object
    const statusStr = typeof status === 'string' ? status : (status?.String || status?.toString?.() || '');
    const found = (customStatuses || []).find(s => s.id === statusStr);
    return found?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    // Convert status to string if it's an object
    const statusStr = typeof status === 'string' ? status : (status?.String || status?.toString?.() || '');
    // For default statuses, always use translation
    if (DEFAULT_STATUS_IDS.includes(statusStr)) {
      return t(statusStr);
    }
    // For custom statuses, use the stored label
    const found = (customStatuses || []).find(s => s.id === statusStr);
    return found?.label || statusStr;
  };

  const getPriorityColor = (priority) => {
    // Convert priority to string if it's an object
    const priorityStr = typeof priority === 'string' ? priority : (priority?.String || priority?.toString?.() || 'medium');
    const colors = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    return colors[priorityStr] || colors.medium;
  };

  const colorOptions = [
    { value: 'bg-gray-100 text-gray-800', label: t('gray') },
    { value: 'bg-blue-100 text-blue-800', label: t('blue') },
    { value: 'bg-green-100 text-green-800', label: t('green') },
    { value: 'bg-yellow-100 text-yellow-800', label: t('yellow') },
    { value: 'bg-orange-100 text-orange-800', label: t('orange') },
    { value: 'bg-red-100 text-red-800', label: t('red') },
    { value: 'bg-purple-100 text-purple-800', label: t('purple') },
    { value: 'bg-pink-100 text-pink-800', label: t('pink') },
    { value: 'bg-indigo-100 text-indigo-800', label: t('indigo') },
    { value: 'bg-teal-100 text-teal-800', label: t('teal') },
  ];

  const metrics = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => {
      const pStatus = typeof p.status === 'string' ? p.status : (p.status?.String || p.status?.toString?.() || '');
      return pStatus === 'active';
    }).length,
    totalBudget: projects.reduce((sum, p) => sum + Number(p.budget || 0), 0),
    avgProgress: projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + Number(p.progress_percentage || 0), 0) / projects.length) : 0
  };

  // Project Card Component
  const ProjectCard = ({ project, draggable = false, hideStatus = false }) => (
    <Card
      className={`bg-white border-slate-200 hover:shadow-lg transition-shadow ${draggable ? 'cursor-move' : 'cursor-pointer'}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => handleDragStart(e, project) : undefined}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-slate-900 mb-1 truncate">{String(project.project_name || '')}</h3>
            <p className="text-sm text-slate-500">{String(project.client_name || '')}</p>
          </div>
          <div className="flex items-center gap-2">
            {!hideStatus && <Badge className={getStatusColor(project.status)}>{getStatusLabel(project.status)}</Badge>}
            {canUpdate(MODULES.PROJECTS) && (
              <Button size="sm" variant="ghost" onClick={(e) => handleEditProject(project, e)} title={t('edit_project')}>
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">{t('progress')}</span>
            <span className="font-semibold">{Number(project.progress_percentage || 0)}%</span>
          </div>
          <Progress value={Number(project.progress_percentage || 0)} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 mb-1">{t('budget')}</p>
            <p className="font-semibold">${Number(project.budget || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">{t('spent')}</p>
            <p className="font-semibold">${Number(project.spent || 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {project.priority && (
            <Badge className={getPriorityColor(project.priority)} variant="outline">
              {t(String(project.priority || 'medium'))}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {Number(project.total_hours || 0).toFixed(1)}h
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  // Helper to get translated status label
  const getTranslatedStatusLabel = (status) => {
    // If it's a default status ID, translate it
    if (DEFAULT_STATUS_IDS.includes(status.id)) {
      return t(status.id);
    }
    // Otherwise use the stored label
    return status.label;
  };

  // Kanban Column Component
  const KanbanColumn = ({ status }) => {
    const columnProjects = filteredProjects.filter(p => {
      // Convert p.status to string if it's an object
      const pStatus = typeof p.status === 'string' ? p.status : (p.status?.String || p.status?.toString?.() || '');
      return pStatus === status.id;
    });

    return (
      <div
        className="flex-shrink-0 w-80 bg-slate-100 rounded-lg p-4"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, status.id)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge className={status.color}>{getTranslatedStatusLabel(status)}</Badge>
            <span className="text-sm text-slate-500">({columnProjects.length})</span>
          </div>
        </div>
        <div className="space-y-3 min-h-[200px]">
          {columnProjects.map(project => (
            <div key={project.id} className="cursor-move">
              <ProjectCard project={project} draggable={true} hideStatus={true} />
            </div>
          ))}
          {columnProjects.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-300 rounded-lg">
              {t('drop_projects_here')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalProjects}</p>
              <p className="text-sm text-slate-600">{t('total_projects')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.activeProjects}</p>
              <p className="text-sm text-slate-600">{t('active_projects')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalBudget.toLocaleString()}</p>
              <p className="text-sm text-slate-600">{t('total_budget')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.avgProgress}%</p>
              <p className="text-sm text-slate-600">{t('avg_progress')}</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(projectAnalysis.insights.length > 0 || projectAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-blue-600" />
                {t('ai_project_insights')}
                <Badge className="bg-blue-100 text-blue-700 text-xs">{t('live')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('total_spent')}</p>
                      <p className="text-lg font-bold text-slate-900">${(projectAnalysis.metrics?.totalSpent || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {projectAnalysis.insights.slice(0, 2).map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                    <div className="flex items-start gap-3">
                      {insight.type === 'positive' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : insight.type === 'warning' || insight.type === 'negative' ? (
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{insight.description}</p>
                        {insight.metric && (
                          <p className="text-lg font-bold text-blue-600 mt-1">{insight.metric}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {projectAnalysis.recommendations.length > 0 && (
                <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900 text-sm mb-2">{t('ai_recommendations')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {projectAnalysis.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs bg-slate-50 rounded-full px-3 py-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              rec.impact === 'high' ? 'bg-red-400' : rec.impact === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                            }`} />
                            <span className="text-slate-700">{rec.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Projects List/Kanban */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle>{t('projects')}</CardTitle>
              <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('grid')}
                    className="h-8"
                  >
                    <LayoutGrid className="w-4 h-4 mr-1" /> {t('grid')}
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('kanban')}
                    className="h-8"
                  >
                    <Columns className="w-4 h-4 mr-1" /> {t('kanban')}
                  </Button>
                </div>

                {/* Status Settings */}
                <Button variant="outline" size="sm" onClick={() => setShowStatusModal(true)}>
                  <Settings className="w-4 h-4 mr-1" /> {t('statuses')}
                </Button>

{canCreate(MODULES.PROJECTS) && (
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  <Plus className="w-4 h-4 mr-2" /> {t('new_project')}
                </Button>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_projects')}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {viewMode === 'grid' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    {(customStatuses || []).map(status => (
                      <SelectItem key={status.id} value={status.id}>{getTranslatedStatusLabel(status)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredProjects.length === 0 && viewMode === 'grid' ? (
              <div className="text-center py-16">
                <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('no_projects_yet')}</p>
                {canCreate(MODULES.PROJECTS) && (
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('create_first_project')}</Button>
                )}
              </div>
            ) : viewMode === 'kanban' ? (
              /* Kanban View */
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {(customStatuses || []).map(status => (
                    <KanbanColumn key={status.id} status={status} />
                  ))}
                </div>
              </div>
            ) : (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Project Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('create_new_project')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('project_name')} *</label>
                  <Input
                    placeholder={t('project_name')}
                    value={newProject.project_name}
                    onChange={(e) => setNewProject({...newProject, project_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('project_code')}</label>
                  <Input
                    placeholder={t('auto_generated')}
                    value={newProject.project_code}
                    onChange={(e) => setNewProject({...newProject, project_code: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('client_name')} *</label>
                <Select
                  value={newProject.client_name}
                  onValueChange={(value) => setNewProject({...newProject, client_name: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_customer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.name || client.company_name}>
                        {client.name || client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('start_date')} *</label>
                  <Input
                    type="date"
                    value={newProject.start_date}
                    onChange={(e) => setNewProject({...newProject, start_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('end_date')}</label>
                  <Input
                    type="date"
                    value={newProject.end_date}
                    onChange={(e) => setNewProject({...newProject, end_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('budget')} *</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({...newProject, budget: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('billing_type')}</label>
                  <Select value={newProject.billing_type} onValueChange={(value) => setNewProject({...newProject, billing_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_price">{t('fixed_price')}</SelectItem>
                      <SelectItem value="time_material">{t('time_material')}</SelectItem>
                      <SelectItem value="milestone">{t('milestone')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('priority')}</label>
                  <Select value={newProject.priority} onValueChange={(value) => setNewProject({...newProject, priority: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('low')}</SelectItem>
                      <SelectItem value="medium">{t('medium')}</SelectItem>
                      <SelectItem value="high">{t('high')}</SelectItem>
                      <SelectItem value="critical">{t('critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateProject}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                  disabled={!newProject.project_name || !newProject.client_name || isSubmitting}
                >
                  {isSubmitting ? t('creating') : t('create_project')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Project Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('edit_project')}</DialogTitle>
            </DialogHeader>
            {editProject && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('project_name')} *</label>
                    <Input
                      value={editProject.project_name}
                      onChange={(e) => setEditProject({...editProject, project_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('project_code')}</label>
                    <Input
                      value={editProject.project_code}
                      onChange={(e) => setEditProject({...editProject, project_code: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('client_name')} *</label>
                  <Select
                    value={editProject.client_name || ''}
                    onValueChange={(value) => setEditProject({...editProject, client_name: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_customer')} />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.name || client.company_name}>
                          {client.name || client.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('start_date')}</label>
                    <Input
                      type="date"
                      value={editProject.start_date?.split('T')[0] || ''}
                      onChange={(e) => setEditProject({...editProject, start_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('end_date')}</label>
                    <Input
                      type="date"
                      value={editProject.end_date?.split('T')[0] || ''}
                      onChange={(e) => setEditProject({...editProject, end_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('budget')}</label>
                    <Input
                      type="number"
                      value={editProject.budget}
                      onChange={(e) => setEditProject({...editProject, budget: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('billing_type')}</label>
                    <Select value={editProject.billing_type || 'time_material'} onValueChange={(value) => setEditProject({...editProject, billing_type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed_price">{t('fixed_price')}</SelectItem>
                        <SelectItem value="time_material">{t('time_material')}</SelectItem>
                        <SelectItem value="milestone">{t('milestone')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('priority')}</label>
                    <Select value={editProject.priority || 'medium'} onValueChange={(value) => setEditProject({...editProject, priority: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t('low')}</SelectItem>
                        <SelectItem value="medium">{t('medium')}</SelectItem>
                        <SelectItem value="high">{t('high')}</SelectItem>
                        <SelectItem value="critical">{t('critical')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('status')}</label>
                    <Select value={editProject.status || 'planning'} onValueChange={(value) => setEditProject({...editProject, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(customStatuses || []).map(status => (
                          <SelectItem key={status.id} value={status.id}>{getTranslatedStatusLabel(status)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('progress_percent')}</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editProject.progress_percentage}
                      onChange={(e) => setEditProject({...editProject, progress_percentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditProject(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateProject}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                    disabled={!editProject.project_name || !editProject.client_name || isSubmitting}
                  >
                    {isSubmitting ? t('saving') : t('save_changes')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Status Management Modal */}
        <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('manage_project_statuses')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Add New Status */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <h4 className="text-sm font-medium">{t('add_new_status')}</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('status_name')}
                    value={newStatus.label}
                    onChange={(e) => setNewStatus({...newStatus, label: e.target.value})}
                    className="flex-1"
                  />
                  <Select value={newStatus.color} onValueChange={(value) => setNewStatus({...newStatus, color: value})}>
                    <SelectTrigger className="w-full sm:w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${opt.value.split(' ')[0]}`} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addCustomStatus} disabled={!newStatus.label.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Existing Statuses */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('current_statuses')}</h4>
                {(customStatuses || []).map((status, index) => (
                  <div key={status.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                      <Badge className={status.color}>{getTranslatedStatusLabel(status)}</Badge>
                      <span className="text-xs text-slate-500">
                        ({projects.filter(p => {
                          const pStatus = typeof p.status === 'string' ? p.status : (p.status?.String || p.status?.toString?.() || '');
                          return pStatus === status.id;
                        }).length} {t('projects')})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCustomStatus(status.id)}
                      disabled={projects.some(p => {
                        const pStatus = typeof p.status === 'string' ? p.status : (p.status?.String || p.status?.toString?.() || '');
                        return pStatus === status.id;
                      })}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => setShowStatusModal(false)}>{t('done')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
