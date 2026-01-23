import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Calendar,
  DollarSign,
  Target,
  ListTodo,
  Users,
  FileText,
  BarChart3,
  GanttChartSquare,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import GanttChart from '@/components/projects/GanttChart';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useModules } from '@/components/contexts/ModulesContext';
import { usePermissions } from "@/hooks/usePermissions";

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { projects, updateProject } = useModules();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [team, setTeam] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);

  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);

  const [editingTask, setEditingTask] = useState(null);
  const [editingMilestone, setEditingMilestone] = useState(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    priority: 'medium',
    status: 'todo',
    due_date: '',
    estimated_hours: 0,
  });

  const [newMilestone, setNewMilestone] = useState({
    title: '',
    description: '',
    due_date: '',
    deliverables: '',
  });

  const [newTeamMember, setNewTeamMember] = useState({
    employee_id: '',
    role: '',
    allocation_percent: 100,
  });

  // Sample employees
  const [employees] = useState([
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
    { id: '3', name: 'Bob Johnson' },
    { id: '4', name: 'Alice Williams' },
  ]);

  // Load project data
  useEffect(() => {
    if (projectId && projects) {
      const foundProject = projects.find(p => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
        loadProjectData(projectId);
      }
    }
  }, [projectId, projects]);

  const loadProjectData = (id) => {
    // Load from localStorage
    const tasksKey = `genix_project_tasks_${id}`;
    const milestonesKey = `genix_project_milestones_${id}`;
    const teamKey = `genix_project_team_${id}`;
    const timeEntriesKey = `genix_project_time_entries_${id}`;

    const storedTasks = localStorage.getItem(tasksKey);
    const storedMilestones = localStorage.getItem(milestonesKey);
    const storedTeam = localStorage.getItem(teamKey);
    const storedTimeEntries = localStorage.getItem(timeEntriesKey);

    if (storedTasks) setTasks(JSON.parse(storedTasks));
    if (storedMilestones) setMilestones(JSON.parse(storedMilestones));
    if (storedTeam) setTeam(JSON.parse(storedTeam));
    if (storedTimeEntries) setTimeEntries(JSON.parse(storedTimeEntries));
  };

  const saveData = (key, data) => {
    localStorage.setItem(`genix_project_${key}_${projectId}`, JSON.stringify(data));
  };

  const handleCreateTask = () => {
    const task = {
      ...newTask,
      id: `TASK-${Date.now()}`,
      project_id: projectId,
      created_at: new Date().toISOString(),
    };
    const updatedTasks = [...tasks, task];
    setTasks(updatedTasks);
    saveData('tasks', updatedTasks);
    setShowTaskDialog(false);
    resetNewTask();
  };

  const handleUpdateTask = () => {
    const updatedTasks = tasks.map(t => t.id === editingTask.id ? editingTask : t);
    setTasks(updatedTasks);
    saveData('tasks', updatedTasks);
    setShowTaskDialog(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId) => {
    if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      setTasks(updatedTasks);
      saveData('tasks', updatedTasks);
    }
  };

  const handleCreateMilestone = () => {
    const milestone = {
      ...newMilestone,
      id: `MS-${Date.now()}`,
      project_id: projectId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    const updatedMilestones = [...milestones, milestone];
    setMilestones(updatedMilestones);
    saveData('milestones', updatedMilestones);
    setShowMilestoneDialog(false);
    resetNewMilestone();
  };

  const handleUpdateMilestone = () => {
    const updatedMilestones = milestones.map(m =>
      m.id === editingMilestone.id ? editingMilestone : m
    );
    setMilestones(updatedMilestones);
    saveData('milestones', updatedMilestones);
    setShowMilestoneDialog(false);
    setEditingMilestone(null);
  };

  const handleCompleteMilestone = (milestoneId) => {
    const updatedMilestones = milestones.map(m =>
      m.id === milestoneId ? { ...m, status: 'completed', completed_date: new Date().toISOString() } : m
    );
    setMilestones(updatedMilestones);
    saveData('milestones', updatedMilestones);
  };

  const handleAddTeamMember = () => {
    const employee = employees.find(e => e.id === newTeamMember.employee_id);
    const member = {
      ...newTeamMember,
      id: `TM-${Date.now()}`,
      project_id: projectId,
      employee_name: employee?.name || '',
      added_at: new Date().toISOString(),
    };
    const updatedTeam = [...team, member];
    setTeam(updatedTeam);
    saveData('team', updatedTeam);
    setShowTeamDialog(false);
    resetNewTeamMember();
  };

  const handleRemoveTeamMember = (memberId) => {
    if (window.confirm(t('confirm_remove') || 'Remove this team member?')) {
      const updatedTeam = team.filter(m => m.id !== memberId);
      setTeam(updatedTeam);
      saveData('team', updatedTeam);
    }
  };

  const resetNewTask = () => {
    setNewTask({
      title: '',
      description: '',
      assignee: '',
      priority: 'medium',
      status: 'todo',
      due_date: '',
      estimated_hours: 0,
    });
  };

  const resetNewMilestone = () => {
    setNewMilestone({
      title: '',
      description: '',
      due_date: '',
      deliverables: '',
    });
  };

  const resetNewTeamMember = () => {
    setNewTeamMember({
      employee_id: '',
      role: '',
      allocation_percent: 100,
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      todo: { variant: 'secondary', icon: ListTodo, label: t('todo') || 'To Do' },
      in_progress: { variant: 'default', icon: Clock, label: t('in_progress') || 'In Progress' },
      review: { variant: 'warning', icon: AlertCircle, label: t('review') || 'Review' },
      completed: { variant: 'success', icon: CheckCircle, label: t('completed') || 'Completed' },
    };

    const config = statusConfig[status] || statusConfig.todo;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { variant: 'secondary', label: t('low') || 'Low' },
      medium: { variant: 'default', label: t('medium') || 'Medium' },
      high: { variant: 'warning', label: t('high') || 'High' },
      critical: { variant: 'destructive', label: t('critical') || 'Critical' },
    };

    const config = priorityConfig[priority] || priorityConfig.medium;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p>{t('loading') || 'Loading...'}</p>
      </div>
    );
  }

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    todo: tasks.filter(t => t.status === 'todo').length,
  };

  const milestoneStats = {
    total: milestones.length,
    completed: milestones.filter(m => m.status === 'completed').length,
    pending: milestones.filter(m => m.status === 'pending').length,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('back') || 'Back'}
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">{project.project_name}</h1>
            <p className="text-muted-foreground">{project.client_name}</p>
          </div>
        </div>

        {/* Project Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                {t('progress') || 'Progress'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.progress || 0}%</div>
              <Progress value={project.progress || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {t('budget') || 'Budget'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(project.budget || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ${(project.spent || 0).toLocaleString()} {t('spent') || 'spent'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('timeline') || 'Timeline'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold">
                {project.start_date && format(parseISO(project.start_date), 'MMM dd, yyyy')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('to') || 'to'} {project.end_date && format(parseISO(project.end_date), 'MMM dd, yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('team') || 'Team'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{team.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('members') || 'members'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="tasks" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <ListTodo className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tasks') || 'Tasks'} ({taskStats.total})</span>
            </TabsTrigger>
            <TabsTrigger value="milestones" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">{t('milestones') || 'Milestones'} ({milestoneStats.total})</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <GanttChartSquare className="w-4 h-4" />
              <span className="hidden sm:inline">{t('timeline') || 'Timeline'}</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t('team') || 'Team'} ({team.length})</span>
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('overview') || 'Overview'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('tasks') || 'Tasks'}</CardTitle>
                  {canCreate(MODULES.PROJECTS) && (
                    <Button onClick={() => { resetNewTask(); setEditingTask(null); setShowTaskDialog(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('new_task') || 'New Task'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Task Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-slate-100 rounded-lg">
                    <div className="text-2xl font-bold">{taskStats.total}</div>
                    <div className="text-xs text-muted-foreground">{t('total') || 'Total'}</div>
                  </div>
                  <div className="text-center p-3 bg-blue-100 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{taskStats.in_progress}</div>
                    <div className="text-xs text-blue-600">{t('in_progress') || 'In Progress'}</div>
                  </div>
                  <div className="text-center p-3 bg-green-100 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
                    <div className="text-xs text-green-600">{t('completed') || 'Completed'}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-100 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{taskStats.todo}</div>
                    <div className="text-xs text-gray-600">{t('todo') || 'To Do'}</div>
                  </div>
                </div>

                {/* Tasks Table */}
                {tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <ListTodo className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('no_tasks') || 'No tasks yet'}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('task') || 'Task'}</TableHead>
                        <TableHead>{t('assignee') || 'Assignee'}</TableHead>
                        <TableHead>{t('priority') || 'Priority'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead>{t('due_date') || 'Due Date'}</TableHead>
                        <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-xs text-muted-foreground">{task.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {employees.find(e => e.id === task.assignee)?.name || t('unassigned') || 'Unassigned'}
                            </div>
                          </TableCell>
                          <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                          <TableCell>{getStatusBadge(task.status)}</TableCell>
                          <TableCell>
                            {task.due_date ? format(parseISO(task.due_date), 'MMM dd, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canUpdate(MODULES.PROJECTS) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setEditingTask(task); setShowTaskDialog(true); }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {canDelete(MODULES.PROJECTS) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTask(task.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Milestones Tab */}
          <TabsContent value="milestones" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('milestones') || 'Milestones'}</CardTitle>
                  {canCreate(MODULES.PROJECTS) && (
                    <Button onClick={() => { resetNewMilestone(); setEditingMilestone(null); setShowMilestoneDialog(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('new_milestone') || 'New Milestone'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {milestones.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('no_milestones') || 'No milestones yet'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {milestones.map((milestone) => (
                      <Card key={milestone.id} className={milestone.status === 'completed' ? 'bg-green-50' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">{milestone.title}</h3>
                                <Badge variant={milestone.status === 'completed' ? 'success' : 'secondary'}>
                                  {milestone.status === 'completed' ? t('completed') : t('pending')}
                                </Badge>
                              </div>
                              {milestone.description && (
                                <p className="text-sm text-muted-foreground mb-2">{milestone.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {t('due') || 'Due'}: {format(parseISO(milestone.due_date), 'MMM dd, yyyy')}
                                </div>
                                {milestone.completed_date && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    {t('completed_on') || 'Completed'}: {format(parseISO(milestone.completed_date), 'MMM dd, yyyy')}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {milestone.status !== 'completed' && canUpdate(MODULES.PROJECTS) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCompleteMilestone(milestone.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {t('complete') || 'Complete'}
                                </Button>
                              )}
                              {canUpdate(MODULES.PROJECTS) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setEditingMilestone(milestone); setShowMilestoneDialog(true); }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('team_members') || 'Team Members'}</CardTitle>
                  {canCreate(MODULES.PROJECTS) && (
                    <Button onClick={() => { resetNewTeamMember(); setShowTeamDialog(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('add_member') || 'Add Member'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {team.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('no_team_members') || 'No team members yet'}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('member') || 'Member'}</TableHead>
                        <TableHead>{t('role') || 'Role'}</TableHead>
                        <TableHead>{t('allocation') || 'Allocation'}</TableHead>
                        <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <span className="font-medium">{member.employee_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{member.role}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={member.allocation_percent} className="w-20" />
                              <span className="text-sm">{member.allocation_percent}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {canDelete(MODULES.PROJECTS) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTeamMember(member.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab with Gantt Chart */}
          <TabsContent value="timeline" className="mt-6">
            <GanttChart
              tasks={tasks.map(task => ({
                ...task,
                assignee: task.assignee_name
              }))}
              milestones={milestones}
              projectStartDate={project.start_date}
              projectEndDate={project.end_date}
              onTaskUpdate={(taskId, updates) => {
                // Handle task date updates if needed
                console.log('Task update:', taskId, updates);
              }}
            />
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('project_details') || 'Project Details'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">{t('project_code') || 'Project Code'}</Label>
                    <p className="font-medium">{project.project_code}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('billing_type') || 'Billing Type'}</Label>
                    <p className="font-medium">{project.billing_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('priority') || 'Priority'}</Label>
                    <div className="mt-1">{getPriorityBadge(project.priority)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('status') || 'Status'}</Label>
                    <p className="font-medium capitalize">{project.status}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('statistics') || 'Statistics'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{t('task_completion') || 'Task Completion'}</span>
                        <span className="text-sm font-semibold">
                          {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}%
                        </span>
                      </div>
                      <Progress value={taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{t('milestone_completion') || 'Milestone Completion'}</span>
                        <span className="text-sm font-semibold">
                          {milestoneStats.total > 0 ? Math.round((milestoneStats.completed / milestoneStats.total) * 100) : 0}%
                        </span>
                      </div>
                      <Progress value={milestoneStats.total > 0 ? (milestoneStats.completed / milestoneStats.total) * 100 : 0} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{t('budget_utilization') || 'Budget Utilization'}</span>
                        <span className="text-sm font-semibold">
                          {project.budget > 0 ? Math.round(((project.spent || 0) / project.budget) * 100) : 0}%
                        </span>
                      </div>
                      <Progress value={project.budget > 0 ? ((project.spent || 0) / project.budget) * 100 : 0} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Task Dialog */}
        <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTask ? (t('edit_task') || 'Edit Task') : (t('new_task') || 'New Task')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('title') || 'Title'}</Label>
                <Input
                  value={editingTask?.title || newTask.title}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, title: e.target.value });
                    } else {
                      setNewTask({ ...newTask, title: e.target.value });
                    }
                  }}
                  placeholder={t('enter_title') || 'Enter task title'}
                />
              </div>
              <div>
                <Label>{t('description') || 'Description'}</Label>
                <Textarea
                  value={editingTask?.description || newTask.description}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, description: e.target.value });
                    } else {
                      setNewTask({ ...newTask, description: e.target.value });
                    }
                  }}
                  placeholder={t('enter_description') || 'Enter description'}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('assignee') || 'Assignee'}</Label>
                  <Select
                    value={editingTask?.assignee || newTask.assignee}
                    onValueChange={(value) => {
                      if (editingTask) {
                        setEditingTask({ ...editingTask, assignee: value });
                      } else {
                        setNewTask({ ...newTask, assignee: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_assignee') || 'Select assignee'} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('due_date') || 'Due Date'}</Label>
                  <Input
                    type="date"
                    value={editingTask?.due_date || newTask.due_date}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditingTask({ ...editingTask, due_date: e.target.value });
                      } else {
                        setNewTask({ ...newTask, due_date: e.target.value });
                      }
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t('priority') || 'Priority'}</Label>
                  <Select
                    value={editingTask?.priority || newTask.priority}
                    onValueChange={(value) => {
                      if (editingTask) {
                        setEditingTask({ ...editingTask, priority: value });
                      } else {
                        setNewTask({ ...newTask, priority: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('low') || 'Low'}</SelectItem>
                      <SelectItem value="medium">{t('medium') || 'Medium'}</SelectItem>
                      <SelectItem value="high">{t('high') || 'High'}</SelectItem>
                      <SelectItem value="critical">{t('critical') || 'Critical'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('status') || 'Status'}</Label>
                  <Select
                    value={editingTask?.status || newTask.status}
                    onValueChange={(value) => {
                      if (editingTask) {
                        setEditingTask({ ...editingTask, status: value });
                      } else {
                        setNewTask({ ...newTask, status: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">{t('todo') || 'To Do'}</SelectItem>
                      <SelectItem value="in_progress">{t('in_progress') || 'In Progress'}</SelectItem>
                      <SelectItem value="review">{t('review') || 'Review'}</SelectItem>
                      <SelectItem value="completed">{t('completed') || 'Completed'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('estimated_hours') || 'Est. Hours'}</Label>
                  <Input
                    type="number"
                    value={editingTask?.estimated_hours || newTask.estimated_hours}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditingTask({ ...editingTask, estimated_hours: parseFloat(e.target.value) });
                      } else {
                        setNewTask({ ...newTask, estimated_hours: parseFloat(e.target.value) });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowTaskDialog(false); setEditingTask(null); }}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={editingTask ? handleUpdateTask : handleCreateTask}>
                {editingTask ? t('update') : t('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Milestone Dialog */}
        <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMilestone ? (t('edit_milestone') || 'Edit Milestone') : (t('new_milestone') || 'New Milestone')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('title') || 'Title'}</Label>
                <Input
                  value={editingMilestone?.title || newMilestone.title}
                  onChange={(e) => {
                    if (editingMilestone) {
                      setEditingMilestone({ ...editingMilestone, title: e.target.value });
                    } else {
                      setNewMilestone({ ...newMilestone, title: e.target.value });
                    }
                  }}
                  placeholder={t('enter_title') || 'Enter milestone title'}
                />
              </div>
              <div>
                <Label>{t('description') || 'Description'}</Label>
                <Textarea
                  value={editingMilestone?.description || newMilestone.description}
                  onChange={(e) => {
                    if (editingMilestone) {
                      setEditingMilestone({ ...editingMilestone, description: e.target.value });
                    } else {
                      setNewMilestone({ ...newMilestone, description: e.target.value });
                    }
                  }}
                  placeholder={t('enter_description') || 'Enter description'}
                  rows={3}
                />
              </div>
              <div>
                <Label>{t('due_date') || 'Due Date'}</Label>
                <Input
                  type="date"
                  value={editingMilestone?.due_date || newMilestone.due_date}
                  onChange={(e) => {
                    if (editingMilestone) {
                      setEditingMilestone({ ...editingMilestone, due_date: e.target.value });
                    } else {
                      setNewMilestone({ ...newMilestone, due_date: e.target.value });
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowMilestoneDialog(false); setEditingMilestone(null); }}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={editingMilestone ? handleUpdateMilestone : handleCreateMilestone}>
                {editingMilestone ? t('update') : t('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Team Member Dialog */}
        <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('add_team_member') || 'Add Team Member'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('employee') || 'Employee'}</Label>
                <Select
                  value={newTeamMember.employee_id}
                  onValueChange={(value) => setNewTeamMember({ ...newTeamMember, employee_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_employee') || 'Select employee'} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter(emp => !team.find(t => t.employee_id === emp.id))
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('role') || 'Role'}</Label>
                <Input
                  value={newTeamMember.role}
                  onChange={(e) => setNewTeamMember({ ...newTeamMember, role: e.target.value })}
                  placeholder={t('enter_role') || 'e.g., Developer, Designer'}
                />
              </div>
              <div>
                <Label>{t('allocation_percent') || 'Allocation %'}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newTeamMember.allocation_percent}
                  onChange={(e) => setNewTeamMember({ ...newTeamMember, allocation_percent: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTeamDialog(false)}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleAddTeamMember}>
                {t('add') || 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
