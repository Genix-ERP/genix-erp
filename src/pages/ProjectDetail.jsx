import React, { useState, useEffect, useCallback } from 'react';
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
  Receipt,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import GanttChart from '@/components/projects/GanttChart';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useModules } from '@/components/contexts/ModulesContext';
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { projectsService } from '@/api/services/projects';
import { hrService } from '@/api/services/hr';
import { contactsService } from '@/api/services/contacts';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { projects, updateProject } = useModules();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

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

  // Time Entry & Expense states
  const [showTimeEntryDialog, setShowTimeEntryDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [isLoadingTimeEntries, setIsLoadingTimeEntries] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [vendorsList, setVendorsList] = useState([]);

  const [newTimeEntry, setNewTimeEntry] = useState({
    employee_id: '',
    employee_name: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
    billable: true,
    hourly_rate: '',
  });

  const [newExpense, setNewExpense] = useState({
    category: '',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    employee_id: '',
    employee_name: '',
    vendor_id: '',
    vendor_name: '',
    billable: true,
    notes: '',
  });

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

  // Load employees from API
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await hrService.listEmployees();
        setEmployeesList(data?.items || data || []);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployeesList([]);
      }
    };
    fetchEmployees();
  }, []);

  // Load vendors (contacts with type 'vendor' or 'both')
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const data = await contactsService.list({ type: 'vendor' });
        // Also get contacts with type 'both' (customer and vendor)
        const bothData = await contactsService.list({ type: 'both' });
        const allVendors = [...(data || []), ...(bothData || [])];
        setVendorsList(allVendors);
      } catch (error) {
        console.error('Error fetching vendors:', error);
        setVendorsList([]);
      }
    };
    fetchVendors();
  }, []);

  // For backwards compatibility with task assignee
  const employees = employeesList.map(emp => ({
    id: emp.id,
    name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.employee_number
  }));

  // Vendors list for dropdown
  const vendors = vendorsList.map(v => ({
    id: v.id,
    name: v.name || v.company_name
  }));

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

  const loadProjectData = async (id) => {
    // Load tasks from API
    await loadTasks(id);
    // Load milestones from API
    await loadMilestones(id);
    // Load team members from API
    await loadTeamMembers(id);
    // Load time entries from API
    await loadTimeEntries(id);
    // Load expenses from API
    await loadExpenses(id);
  };

  const loadTasks = async (id) => {
    try {
      const data = await projectsService.listProjectTasks(id);
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  };

  const loadMilestones = async (id) => {
    try {
      const data = await projectsService.listProjectMilestones(id);
      setMilestones(data || []);
    } catch (error) {
      console.error('Error loading milestones:', error);
      setMilestones([]);
    }
  };

  const loadTeamMembers = async (id) => {
    setIsLoadingTeam(true);
    try {
      const data = await projectsService.listTeamMembers(id);
      setTeam(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
      setTeam([]);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const loadTimeEntries = async (id) => {
    setIsLoadingTimeEntries(true);
    try {
      const data = await projectsService.listTimeEntries(id);
      setTimeEntries(data || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
      setTimeEntries([]);
    } finally {
      setIsLoadingTimeEntries(false);
    }
  };

  const loadExpenses = async (id) => {
    setIsLoadingExpenses(true);
    try {
      const data = await projectsService.listProjectExpenses(id);
      setExpenses(data || []);
    } catch (error) {
      console.error('Error loading expenses:', error);
      setExpenses([]);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      await projectsService.createProjectTask(projectId, {
        title: newTask.title,
        description: newTask.description,
        assignee_id: newTask.assignee || undefined,
        assignee_name: newTask.assignee ? employees.find(e => e.id === newTask.assignee)?.name : undefined,
        priority: newTask.priority,
        status: newTask.status,
        due_date: newTask.due_date || undefined,
        estimated_hours: parseFloat(newTask.estimated_hours) || 0,
      });
      await loadTasks(projectId);
      setShowTaskDialog(false);
      resetNewTask();
    } catch (error) {
      console.error('Error creating task:', error);
      alert(t('error_creating_task') || 'Error creating task');
    }
  };

  const handleUpdateTask = async () => {
    try {
      const assigneeId = editingTask.assignee_id || editingTask.assignee;
      await projectsService.updateProjectTask(projectId, editingTask.id, {
        title: editingTask.title,
        description: editingTask.description,
        assignee_id: assigneeId || undefined,
        assignee_name: assigneeId ? employees.find(e => e.id === assigneeId)?.name : undefined,
        priority: editingTask.priority,
        status: editingTask.status,
        due_date: editingTask.due_date || undefined,
        estimated_hours: parseFloat(editingTask.estimated_hours) || 0,
      });
      await loadTasks(projectId);
      setShowTaskDialog(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      alert(t('error_updating_task') || 'Error updating task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
      try {
        await projectsService.deleteProjectTask(projectId, taskId);
        await loadTasks(projectId);
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleCreateMilestone = async () => {
    try {
      await projectsService.createProjectMilestone(projectId, {
        title: newMilestone.title,
        description: newMilestone.description,
        due_date: newMilestone.due_date,
      });
      await loadMilestones(projectId);
      setShowMilestoneDialog(false);
      resetNewMilestone();
    } catch (error) {
      console.error('Error creating milestone:', error);
      alert(t('error_creating_milestone') || 'Error creating milestone');
    }
  };

  const handleUpdateMilestone = async () => {
    try {
      await projectsService.updateProjectMilestone(projectId, editingMilestone.id, {
        title: editingMilestone.title,
        description: editingMilestone.description,
        due_date: editingMilestone.due_date,
        status: editingMilestone.status,
      });
      await loadMilestones(projectId);
      setShowMilestoneDialog(false);
      setEditingMilestone(null);
    } catch (error) {
      console.error('Error updating milestone:', error);
      alert(t('error_updating_milestone') || 'Error updating milestone');
    }
  };

  const handleCompleteMilestone = async (milestoneId) => {
    try {
      await projectsService.updateProjectMilestone(projectId, milestoneId, {
        status: 'completed',
      });
      await loadMilestones(projectId);
    } catch (error) {
      console.error('Error completing milestone:', error);
      alert(t('error_completing_milestone') || 'Error completing milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
      try {
        await projectsService.deleteProjectMilestone(projectId, milestoneId);
        await loadMilestones(projectId);
      } catch (error) {
        console.error('Error deleting milestone:', error);
      }
    }
  };

  const handleAddTeamMember = async () => {
    try {
      const employee = employees.find(e => e.id === newTeamMember.employee_id);
      await projectsService.addTeamMember(projectId, {
        employee_id: newTeamMember.employee_id,
        employee_name: employee?.name || '',
        role: newTeamMember.role,
        allocation_percent: newTeamMember.allocation_percent,
      });
      await loadTeamMembers(projectId);
      setShowTeamDialog(false);
      resetNewTeamMember();
    } catch (error) {
      console.error('Error adding team member:', error);
      alert(t('error_adding_team_member') || 'Error adding team member');
    }
  };

  const handleRemoveTeamMember = async (memberId) => {
    if (window.confirm(t('confirm_remove') || 'Remove this team member?')) {
      try {
        await projectsService.removeTeamMember(projectId, memberId);
        await loadTeamMembers(projectId);
      } catch (error) {
        console.error('Error removing team member:', error);
        alert(t('error_removing_team_member') || 'Error removing team member');
      }
    }
  };

  // Time Entry Handlers
  const handleCreateTimeEntry = async () => {
    try {
      await projectsService.createTimeEntry(projectId, {
        employee_id: newTimeEntry.employee_id,
        employee_name: newTimeEntry.employee_name,
        date: newTimeEntry.date,
        hours: parseFloat(newTimeEntry.hours) || 0,
        description: newTimeEntry.description,
        billable: newTimeEntry.billable,
        hourly_rate: parseFloat(newTimeEntry.hourly_rate) || 0,
      });
      await loadTimeEntries(projectId);
      setShowTimeEntryDialog(false);
      resetNewTimeEntry();
    } catch (error) {
      console.error('Error creating time entry:', error);
      alert(t('error_creating_time_entry') || 'Error creating time entry');
    }
  };

  const resetNewTimeEntry = () => {
    setNewTimeEntry({
      employee_id: '',
      employee_name: '',
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: '',
      billable: true,
      hourly_rate: '',
    });
  };

  // Expense Handlers
  const handleCreateExpense = async () => {
    try {
      await projectsService.createProjectExpense(projectId, {
        category: newExpense.category,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount) || 0,
        expense_date: newExpense.expense_date,
        employee_id: newExpense.employee_id || undefined,
        employee_name: newExpense.employee_name || undefined,
        vendor_id: newExpense.vendor_id || undefined,
        vendor_name: newExpense.vendor_name || undefined,
        billable: newExpense.billable,
        notes: newExpense.notes || undefined,
      });
      await loadExpenses(projectId);
      setShowExpenseDialog(false);
      resetNewExpense();
    } catch (error) {
      console.error('Error creating expense:', error);
      alert(t('error_creating_expense') || 'Error creating expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm(t('confirm_delete') || 'Are you sure?')) {
      try {
        await projectsService.deleteProjectExpense(projectId, expenseId);
        await loadExpenses(projectId);
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  const resetNewExpense = () => {
    setNewExpense({
      category: '',
      description: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      employee_id: '',
      employee_name: '',
      vendor_id: '',
      vendor_name: '',
      billable: true,
      notes: '',
    });
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
                {formatCurrency(project.budget || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(project.spent || 0)} {t('spent') || 'spent'}
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
            <TabsTrigger value="time" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">{t('time') || 'Time'} ({timeEntries.length})</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('expenses') || 'Expenses'} ({expenses.length})</span>
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
                              {task.assignee_name || employees.find(e => e.id === task.assignee_id)?.name || t('unassigned') || 'Unassigned'}
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
                {isLoadingTeam ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : team.length === 0 ? (
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

          {/* Time Entries Tab */}
          <TabsContent value="time" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('time_entries') || 'Time Entries'}</CardTitle>
                  {canCreate(MODULES.PROJECTS) && (
                    <Button onClick={() => { resetNewTimeEntry(); setShowTimeEntryDialog(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('log_time') || 'Log Time'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Time Entry Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-blue-100 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0).toFixed(1)}h
                    </div>
                    <div className="text-xs text-blue-600">{t('total_hours') || 'Total Hours'}</div>
                  </div>
                  <div className="text-center p-3 bg-green-100 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {timeEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.hours || 0), 0).toFixed(1)}h
                    </div>
                    <div className="text-xs text-green-600">{t('billable_hours') || 'Billable'}</div>
                  </div>
                  <div className="text-center p-3 bg-purple-100 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(timeEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.amount || 0), 0))}
                    </div>
                    <div className="text-xs text-purple-600">{t('billable_amount') || 'Billable Amount'}</div>
                  </div>
                </div>

                {/* Time Entries Table */}
                {isLoadingTimeEntries ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : timeEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('no_time_entries') || 'No time entries yet'}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('date') || 'Date'}</TableHead>
                        <TableHead>{t('employee') || 'Employee'}</TableHead>
                        <TableHead>{t('hours') || 'Hours'}</TableHead>
                        <TableHead>{t('description') || 'Description'}</TableHead>
                        <TableHead>{t('billable') || 'Billable'}</TableHead>
                        <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {entry.date && format(parseISO(entry.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {entry.employee_name || t('unknown') || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.hours}h</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {entry.description || '-'}
                          </TableCell>
                          <TableCell>
                            {entry.billable ? (
                              <Badge className="bg-green-100 text-green-700">{t('yes') || 'Yes'}</Badge>
                            ) : (
                              <Badge variant="secondary">{t('no') || 'No'}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.amount ? formatCurrency(entry.amount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('expenses') || 'Expenses'}</CardTitle>
                  {canCreate(MODULES.PROJECTS) && (
                    <Button onClick={() => { resetNewExpense(); setShowExpenseDialog(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('add_expense') || 'Add Expense'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Expense Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-red-100 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(expenses.reduce((sum, e) => sum + (e.amount || 0), 0))}
                    </div>
                    <div className="text-xs text-red-600">{t('total_expenses') || 'Total Expenses'}</div>
                  </div>
                  <div className="text-center p-3 bg-orange-100 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(expenses.filter(e => e.billable).reduce((sum, e) => sum + (e.amount || 0), 0))}
                    </div>
                    <div className="text-xs text-orange-600">{t('billable_expenses') || 'Billable'}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-100 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{expenses.length}</div>
                    <div className="text-xs text-gray-600">{t('entries') || 'Entries'}</div>
                  </div>
                </div>

                {/* Expenses Table */}
                {isLoadingExpenses ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('no_expenses') || 'No expenses yet'}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('date') || 'Date'}</TableHead>
                        <TableHead>{t('category') || 'Category'}</TableHead>
                        <TableHead>{t('description') || 'Description'}</TableHead>
                        <TableHead>{t('vendor') || 'Vendor'}</TableHead>
                        <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            {expense.expense_date && format(parseISO(expense.expense_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{expense.category || t('general') || 'General'}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {expense.description}
                          </TableCell>
                          <TableCell>{expense.vendor_name || expense.employee_name || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(expense.amount || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              expense.status === 'paid' ? 'bg-green-100 text-green-700' :
                              expense.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                              expense.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }>
                              {t(expense.status) || expense.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canDelete(MODULES.PROJECTS) && expense.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteExpense(expense.id)}
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
                    <p className="font-medium">{t(project.billing_type) || project.billing_type}</p>
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
                    value={editingTask?.assignee_id || editingTask?.assignee || newTask.assignee}
                    onValueChange={(value) => {
                      if (editingTask) {
                        setEditingTask({ ...editingTask, assignee_id: value, assignee: value });
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

        {/* Time Entry Dialog */}
        <Dialog open={showTimeEntryDialog} onOpenChange={setShowTimeEntryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('log_time') || 'Log Time'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('employee') || 'Employee'} *</Label>
                <Select
                  value={newTimeEntry.employee_id}
                  onValueChange={(value) => {
                    const emp = employees.find(e => e.id === value);
                    setNewTimeEntry({
                      ...newTimeEntry,
                      employee_id: value,
                      employee_name: emp?.name || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_employee') || 'Select employee'} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('date') || 'Date'} *</Label>
                  <Input
                    type="date"
                    value={newTimeEntry.date}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t('hours') || 'Hours'} *</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={newTimeEntry.hours}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: e.target.value })}
                    placeholder="0.0"
                  />
                </div>
              </div>
              <div>
                <Label>{t('description') || 'Description'}</Label>
                <Textarea
                  value={newTimeEntry.description}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                  placeholder={t('what_did_you_work_on') || 'What did you work on?'}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('hourly_rate') || 'Hourly Rate'}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newTimeEntry.hourly_rate}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hourly_rate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="billable"
                    checked={newTimeEntry.billable}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, billable: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="billable">{t('billable') || 'Billable'}</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTimeEntryDialog(false)}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateTimeEntry}
                disabled={!newTimeEntry.employee_id || !newTimeEntry.hours || !newTimeEntry.date}
              >
                {t('log_time') || 'Log Time'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expense Dialog */}
        <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('add_expense') || 'Add Expense'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('category') || 'Category'}</Label>
                  <Select
                    value={newExpense.category}
                    onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_category') || 'Select category'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="travel">{t('travel') || 'Travel'}</SelectItem>
                      <SelectItem value="materials">{t('materials') || 'Materials'}</SelectItem>
                      <SelectItem value="equipment">{t('equipment') || 'Equipment'}</SelectItem>
                      <SelectItem value="software">{t('software') || 'Software'}</SelectItem>
                      <SelectItem value="services">{t('services') || 'Services'}</SelectItem>
                      <SelectItem value="other">{t('other') || 'Other'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('date') || 'Date'} *</Label>
                  <Input
                    type="date"
                    value={newExpense.expense_date}
                    onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>{t('description') || 'Description'} *</Label>
                <Input
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder={t('expense_description') || 'What was this expense for?'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('amount') || 'Amount'} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>{t('vendor') || 'Vendor'}</Label>
                  <Select
                    value={newExpense.vendor_id}
                    onValueChange={(value) => {
                      const vendor = vendors.find(v => v.id === value);
                      setNewExpense({
                        ...newExpense,
                        vendor_id: value,
                        vendor_name: vendor?.name || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_vendor') || 'Select vendor'} />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t('employee') || 'Employee'}</Label>
                <Select
                  value={newExpense.employee_id}
                  onValueChange={(value) => {
                    const emp = employees.find(e => e.id === value);
                    setNewExpense({
                      ...newExpense,
                      employee_id: value,
                      employee_name: emp?.name || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_employee') || 'Select employee'} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('notes') || 'Notes'}</Label>
                <Textarea
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  placeholder={t('additional_notes') || 'Additional notes'}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="expense_billable"
                  checked={newExpense.billable}
                  onChange={(e) => setNewExpense({ ...newExpense, billable: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="expense_billable">{t('billable_to_client') || 'Billable to client'}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateExpense}
                disabled={!newExpense.description || !newExpense.amount || !newExpense.expense_date}
              >
                {t('add_expense') || 'Add Expense'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
