import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  LayoutGrid,
  Columns,
  Eye,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Upload,
  Download,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uz } from 'date-fns/locale/uz';
import GanttChart from '@/components/projects/GanttChart';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useModules } from '@/components/contexts/ModulesContext';
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { projectsService } from '@/api/services/projects';
import { exportTimeEntriesToExcel, parseTimeEntriesFile } from '@/utils/timeEntriesExcel';
import { hrService } from '@/api/services/hr';
import { contactsService } from '@/api/services/contacts';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  // Locale-aware date formatter (months/weekdays in the current language)
  const dfLocale = language === 'ru' ? ru : language === 'uz' ? uz : undefined;
  const fmt = (date, pattern) => format(date, pattern, dfLocale ? { locale: dfLocale } : undefined);
  const { projects, updateProject } = useModules();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

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

  const { user } = useAuth();

  // Tasks view: 'list' (table) or 'kanban' (board)
  const [taskView, setTaskView] = useState('kanban');
  // Filter to tasks assigned to the current user
  const [onlyMine, setOnlyMine] = useState(false);
  // Filter tasks by milestone (stage); 'all' = no filter
  const [taskMilestoneFilter, setTaskMilestoneFilter] = useState('all');
  // Per-stage priority sort: { [stage_key]: 'none' | 'desc' | 'asc' }
  const [stageSort, setStageSort] = useState({});
  const cycleStageSort = (key) => setStageSort(prev => {
    const cur = prev[key] || 'none';
    const next = cur === 'none' ? 'desc' : cur === 'desc' ? 'asc' : 'none';
    return { ...prev, [key]: next };
  });
  const sortByPriority = (arr, mode) => {
    if (!mode || mode === 'none') return arr;
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...arr].sort((a, b) => {
      const ra = rank[a.priority] || 0, rb = rank[b.priority] || 0;
      return mode === 'desc' ? rb - ra : ra - rb;
    });
  };
  // Refs for the custom kanban drag preview (native drag image is unreliable here)
  const taskDragPreviewRef = useRef(null);
  const taskDragMoveRef = useRef(null);

  // Selected assignee ids for the task create/edit dialog (multi-assignee)
  const [formAssigneeIds, setFormAssigneeIds] = useState([]);

  // Backend-driven task stages (kanban columns)
  const [stages, setStages] = useState([]);
  const [viewTask, setViewTask] = useState(null);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageName, setStageName] = useState('');
  // Generic confirm modal: { title, message, confirmLabel, onConfirm }
  const [confirmModal, setConfirmModal] = useState(null);
  const requestConfirm = (cfg) => setConfirmModal(cfg);
  // Task notes modal
  const [notesTask, setNotesTask] = useState(null);
  const [taskNotes, setTaskNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Milestone substages + files
  const [expandedMilestone, setExpandedMilestone] = useState(null);
  const [milestoneTaskView, setMilestoneTaskView] = useState('kanban');
  const [substagesByMilestone, setSubstagesByMilestone] = useState({});
  const [newSubstage, setNewSubstage] = useState({ title: '', description: '', status: 'pending', due_date: '' });
  const [filesMilestone, setFilesMilestone] = useState(null);
  const [milestoneFiles, setMilestoneFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

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
    task_id: '',
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

  // Expense categories: built-in keys + tenant-wide custom ones from the backend
  const DEFAULT_EXPENSE_CATEGORIES = ['travel', 'materials', 'equipment', 'software', 'services', 'other'];
  const [customExpenseCategories, setCustomExpenseCategories] = useState([]); // [{id, name}]
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const categoryLabel = (c) => DEFAULT_EXPENSE_CATEGORIES.includes(c) ? (t(c) || c) : c;

  const loadExpenseCategories = async () => {
    try {
      const data = await projectsService.listExpenseCategories();
      setCustomExpenseCategories(data || []);
    } catch (error) {
      console.error('Error loading expense categories:', error);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await projectsService.createExpenseCategory(name);
      await loadExpenseCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(t('error_saving_category') || 'Error saving category');
    }
    setNewExpense(prev => ({ ...prev, category: name }));
    setNewCategoryName('');
    setShowCategoryDialog(false);
  };

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    milestone_id: '',
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

  // Load tenant-wide expense categories
  useEffect(() => {
    loadExpenseCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the project's stored progress in sync with task completion, so the
  // Projects list card and the average-progress KPI match the detail page.
  useEffect(() => {
    if (!project || tasks.length === 0) return;
    const total = tasks.length;
    const completed = tasks.filter(tk => tk.status === 'completed').length;
    const pct = Math.round((completed / total) * 100);
    const current = project.progress_percentage ?? project.progress ?? 0;
    if (pct !== current) {
      updateProject(projectId, { progress_percentage: pct }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

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

  // Resolve the current user's employee id (direct link or by matching email).
  // Declared before any early return to keep hook order stable.
  const currentEmployeeId = useMemo(() => {
    if (!user) return null;
    if (user.employee_id) return user.employee_id;
    const email = (user.email || '').toLowerCase();
    const match = employeesList.find(e => (e.email || '').toLowerCase() === email && email);
    return match?.id || null;
  }, [user, employeesList]);

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
    // Load stages (kanban columns) from API
    await loadStages(id);
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

  const loadStages = async (id) => {
    try {
      const data = await projectsService.listProjectStages(id);
      setStages(data || []);
    } catch (error) {
      console.error('Error loading stages:', error);
      setStages([]);
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
      const assignees = formAssigneeIds.map(id => ({ employee_id: id, employee_name: employees.find(e => e.id === id)?.name || '' }));
      await projectsService.createProjectTask(projectId, {
        title: newTask.title,
        description: newTask.description,
        assignees,
        milestone_id: newTask.milestone_id || undefined,
        priority: newTask.priority,
        status: newTask.status,
        due_date: newTask.due_date || undefined,
        estimated_hours: parseFloat(newTask.estimated_hours) || 0,
      });
      await loadTasks(projectId);
      setShowTaskDialog(false);
      resetNewTask();
      setFormAssigneeIds([]);
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(t('error_creating_task') || 'Error creating task');
    }
  };

  const handleUpdateTask = async () => {
    try {
      const assignees = formAssigneeIds.map(id => ({ employee_id: id, employee_name: employees.find(e => e.id === id)?.name || '' }));
      await projectsService.updateProjectTask(projectId, editingTask.id, {
        title: editingTask.title,
        description: editingTask.description,
        assignees,
        milestone_id: editingTask.milestone_id || '',
        priority: editingTask.priority,
        status: editingTask.status,
        due_date: editingTask.due_date || undefined,
        estimated_hours: parseFloat(editingTask.estimated_hours) || 0,
      });
      await loadTasks(projectId);
      setShowTaskDialog(false);
      setEditingTask(null);
      setFormAssigneeIds([]);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('error_updating_task') || 'Error updating task');
    }
  };

  // Open the task dialog with assignee selection prefilled
  const openNewTask = () => { resetNewTask(); setEditingTask(null); setFormAssigneeIds([]); setShowTaskDialog(true); };
  const openEditTask = (task) => { setEditingTask(task); setFormAssigneeIds((task.assignees || []).map(a => a.employee_id)); setShowTaskDialog(true); };
  const toggleFormAssignee = (id) => setFormAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleDeleteTask = (task) => {
    const taskId = typeof task === 'string' ? task : task.id;
    const title = typeof task === 'string' ? '' : task.title;
    requestConfirm({
      title: t('delete_task') || 'Delete task',
      message: (t('confirm_delete_task') || 'Are you sure you want to delete this task?') + (title ? `\n\n"${title}"` : ''),
      confirmLabel: t('delete') || 'Delete',
      onConfirm: async () => {
        try {
          await projectsService.deleteProjectTask(projectId, taskId);
          await loadTasks(projectId);
        } catch (error) {
          console.error('Error deleting task:', error);
          toast.error(t('error_deleting_task') || 'Error deleting task');
        }
      },
    });
  };

  // Quick status change from the list/kanban without opening the edit dialog
  const handleTaskStatusChange = async (task, newStatus) => {
    if (!task || task.status === newStatus) return;
    try {
      await projectsService.updateProjectTask(projectId, task.id, { status: newStatus });
      await loadTasks(projectId);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error(t('error_updating_task') || 'Error updating task');
    }
  };

  // ---- Kanban drag-and-drop (custom preview that stays under the cursor) ----
  const handleTaskDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';

    const node = e.currentTarget;
    const rect = node.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Hide the native drag image; render our own so it tracks the cursor exactly.
    const transparent = new Image();
    transparent.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(transparent, 0, 0);

    const preview = node.cloneNode(true);
    preview.style.position = 'fixed';
    preview.style.top = '0';
    preview.style.left = '0';
    preview.style.width = `${rect.width}px`;
    preview.style.margin = '0';
    preview.style.boxShadow = '0 10px 25px rgba(0,0,0,0.18)';
    preview.style.pointerEvents = 'none';
    preview.style.zIndex = '99999';
    preview.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;
    document.body.appendChild(preview);
    taskDragPreviewRef.current = preview;

    const move = (ev) => {
      if (ev.clientX === 0 && ev.clientY === 0) return;
      preview.style.transform = `translate(${ev.clientX - offsetX}px, ${ev.clientY - offsetY}px)`;
    };
    taskDragMoveRef.current = move;
    document.addEventListener('dragover', move);
    node.style.opacity = '0.4';
  };

  const handleTaskDragEnd = (e) => {
    e.currentTarget.style.opacity = '';
    if (taskDragMoveRef.current) {
      document.removeEventListener('dragover', taskDragMoveRef.current);
      taskDragMoveRef.current = null;
    }
    if (taskDragPreviewRef.current) {
      taskDragPreviewRef.current.remove();
      taskDragPreviewRef.current = null;
    }
  };

  const handleTaskDrop = (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(tk => tk.id === taskId);
    if (task) handleTaskStatusChange(task, newStatus);
  };

  // Change a task's assignee inline (from the card)
  const handleTaskAssigneeChange = async (task, assigneeId) => {
    try {
      await projectsService.updateProjectTask(projectId, task.id, {
        assignee_id: assigneeId || undefined,
        assignee_name: assigneeId ? employees.find(e => e.id === assigneeId)?.name : '',
      });
      await loadTasks(projectId);
    } catch (error) {
      console.error('Error updating assignee:', error);
      toast.error(t('error_updating_task') || 'Error updating task');
    }
  };

  // ---- Task notes ----
  const openNotes = async (task) => {
    setNotesTask(task);
    setNewNote('');
    setTaskNotes([]);
    setLoadingNotes(true);
    try {
      const data = await projectsService.listTaskNotes(projectId, task.id);
      setTaskNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
      setTaskNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleAddNote = async () => {
    const note = newNote.trim();
    if (!note || !notesTask) return;
    try {
      const created = await projectsService.createTaskNote(projectId, notesTask.id, {
        note,
        created_by_name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '',
      });
      setTaskNotes(prev => [created, ...prev]);
      setNewNote('');
      loadTasks(projectId); // refresh note counts on cards/list
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(t('error_saving_note') || 'Error saving note');
    }
  };

  // ---- Stage (kanban column) management ----
  const openAddStage = () => {
    setEditingStage(null);
    setStageName('');
    setShowStageDialog(true);
  };

  const openEditStage = (stage) => {
    setEditingStage(stage);
    setStageName(stageLabel(stage));
    setShowStageDialog(true);
  };

  const handleSaveStage = async () => {
    const name = stageName.trim();
    if (!name) return;
    try {
      if (editingStage) {
        await projectsService.updateProjectStage(projectId, editingStage.id, { name });
      } else {
        await projectsService.createProjectStage(projectId, { name });
      }
      await loadStages(projectId);
      setShowStageDialog(false);
      setEditingStage(null);
      setStageName('');
    } catch (error) {
      console.error('Error saving stage:', error);
      toast.error(t('error_saving_stage') || 'Error saving stage');
    }
  };

  const handleDeleteStage = (stage) => {
    requestConfirm({
      title: t('delete_stage') || 'Delete stage',
      message: (t('confirm_delete_stage') || 'Are you sure you want to delete this stage?') + `\n\n"${stageLabel(stage)}"`,
      confirmLabel: t('delete') || 'Delete',
      onConfirm: async () => {
        try {
          await projectsService.deleteProjectStage(projectId, stage.id);
          await loadStages(projectId);
        } catch (error) {
          // Backend blocks deletion when the stage still has tasks
          const msg = error?.response?.data?.error?.message || error?.response?.data?.error || error?.response?.data?.message;
          toast.error(msg || t('error_deleting_stage') || 'Cannot delete this stage');
        }
      },
    });
  };

  // Show the localized label for the seeded defaults, but the moment a stage is
  // renamed (name differs from the original default), show the custom name.
  const DEFAULT_STAGE_NAMES = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', completed: 'Completed' };
  const stageLabel = (stage) => {
    const def = DEFAULT_STAGE_NAMES[stage.stage_key];
    if (def && stage.name === def) return t(stage.stage_key) || stage.name;
    return stage.name;
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
      toast.error(t('error_creating_milestone') || 'Error creating milestone');
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
      toast.error(t('error_updating_milestone') || 'Error updating milestone');
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
      toast.error(t('error_completing_milestone') || 'Error completing milestone');
    }
  };

  // Change a milestone's status from the inline dropdown
  const handleMilestoneStatusChange = async (milestone, status) => {
    if (!milestone || milestone.status === status) return;
    try {
      await projectsService.updateProjectMilestone(projectId, milestone.id, { status });
      await loadMilestones(projectId);
    } catch (error) {
      console.error('Error updating milestone status:', error);
      toast.error(t('error_updating_milestone') || 'Error updating milestone');
    }
  };

  // ---- Milestone substages ----
  const loadSubstages = async (milestoneId) => {
    try {
      const data = await projectsService.listMilestoneSubstages(projectId, milestoneId);
      setSubstagesByMilestone(prev => ({ ...prev, [milestoneId]: data || [] }));
    } catch (error) {
      console.error('Error loading substages:', error);
      setSubstagesByMilestone(prev => ({ ...prev, [milestoneId]: [] }));
    }
  };

  const toggleExpandMilestone = (milestoneId) => {
    setExpandedMilestone(expandedMilestone === milestoneId ? null : milestoneId);
  };

  const handleAddSubstage = async (milestoneId) => {
    const title = newSubstage.title.trim();
    if (!title) return;
    try {
      await projectsService.createMilestoneSubstage(projectId, milestoneId, {
        title,
        description: newSubstage.description || undefined,
        status: newSubstage.status,
        due_date: newSubstage.due_date || undefined,
      });
      setNewSubstage({ title: '', description: '', status: 'pending', due_date: '' });
      await loadSubstages(milestoneId);
    } catch (error) {
      console.error('Error adding substage:', error);
      toast.error(t('error_saving_substage') || 'Error saving substage');
    }
  };

  const handleSubstageStatusChange = async (milestoneId, substage, status) => {
    try {
      await projectsService.updateMilestoneSubstage(projectId, milestoneId, substage.id, { status });
      await loadSubstages(milestoneId);
    } catch (error) {
      console.error('Error updating substage:', error);
    }
  };

  const handleDeleteSubstage = (milestoneId, substage) => {
    requestConfirm({
      title: t('delete') || 'Delete',
      message: `"${substage.title}"`,
      confirmLabel: t('delete') || 'Delete',
      onConfirm: async () => {
        try {
          await projectsService.deleteMilestoneSubstage(projectId, milestoneId, substage.id);
          await loadSubstages(milestoneId);
        } catch (error) {
          console.error('Error deleting substage:', error);
        }
      },
    });
  };

  // ---- Milestone files ----
  const openFiles = async (milestone) => {
    setFilesMilestone(milestone);
    setMilestoneFiles([]);
    setLoadingFiles(true);
    try {
      const data = await projectsService.listMilestoneAttachments(projectId, milestone.id);
      setMilestoneFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
      setMilestoneFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !filesMilestone) return;
    setUploadingFile(true);
    try {
      const created = await projectsService.uploadMilestoneAttachment(projectId, filesMilestone.id, file);
      setMilestoneFiles(prev => [created, ...prev]);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(t('error_uploading_file') || 'Error uploading file');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (attachmentId) => {
    try {
      await projectsService.deleteMilestoneAttachment(projectId, filesMilestone.id, attachmentId);
      setMilestoneFiles(prev => prev.filter(f => f.id !== attachmentId));
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  // Milestone status options + styling
  const MILESTONE_STATUSES = [
    { id: 'pending', label: t('pending') || 'Pending', color: 'bg-slate-100 text-slate-700' },
    { id: 'in_progress', label: t('in_progress') || 'In Progress', color: 'bg-blue-100 text-blue-700' },
    { id: 'completed', label: t('completed') || 'Completed', color: 'bg-green-100 text-green-700' },
  ];
  const milestoneStatusMeta = (status) => MILESTONE_STATUSES.find(s => s.id === status) || MILESTONE_STATUSES[0];

  // Derive a milestone's status from its tasks: completed if all done, in-progress
  // if any started/done, pending otherwise. Returns null when there are no tasks.
  const deriveMilestoneStatus = (mTasks) => {
    if (!mTasks || mTasks.length === 0) return null;
    if (mTasks.every(tk => tk.status === 'completed')) return 'completed';
    const anyActive = mTasks.some(tk => tk.status && tk.status !== 'todo');
    return anyActive ? 'in_progress' : 'pending';
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
      toast.error(t('error_adding_team_member') || 'Error adding team member');
    }
  };

  const handleRemoveTeamMember = async (memberId) => {
    if (window.confirm(t('confirm_remove') || 'Remove this team member?')) {
      try {
        await projectsService.removeTeamMember(projectId, memberId);
        await loadTeamMembers(projectId);
      } catch (error) {
        console.error('Error removing team member:', error);
        toast.error(t('error_removing_team_member') || 'Error removing team member');
      }
    }
  };

  // Time Entry Handlers
  const handleCreateTimeEntry = async () => {
    try {
      await projectsService.createTimeEntry(projectId, {
        employee_id: newTimeEntry.employee_id,
        employee_name: newTimeEntry.employee_name || employees.find(e => e.id === newTimeEntry.employee_id)?.name,
        task_id: newTimeEntry.task_id || undefined,
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
      toast.error(t('error_creating_time_entry') || 'Error creating time entry');
    }
  };

  // Export time entries to a styled Excel file
  const handleExportTime = async () => {
    try {
      const tasksById = {};
      tasks.forEach(tk => { tasksById[tk.id] = tk.title; });
      const labelKeys = ['time_entries', 'total_hours', 'billable_hours', 'billable_amount', 'date', 'employee', 'task', 'hours', 'billable', 'hourly_rate', 'amount', 'description', 'yes', 'no', 'total'];
      const labels = {};
      labelKeys.forEach(k => { labels[k] = t(k); });
      await exportTimeEntriesToExcel({
        projectName: project?.project_name || '',
        entries: timeEntries,
        tasksById,
        labels,
        formatDate: (d) => fmt(parseISO(d), 'dd.MM.yyyy'),
      });
    } catch (error) {
      console.error('Error exporting time entries:', error);
      toast.error(t('error_exporting') || 'Error exporting');
    }
  };

  // Import time entries from an Excel/CSV file
  const handleImportTime = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseTimeEntriesFile(file);
      const pick = (row, keys) => {
        for (const k of keys) {
          const found = Object.keys(row).find(h => h.trim().toLowerCase() === k.toLowerCase());
          if (found && row[found] !== '') return row[found];
        }
        return '';
      };
      const parseDate = (v) => {
        if (!v) return '';
        if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return d.toISOString().split('T')[0]; }
        const s = String(v).trim();
        const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        const d = new Date(s); return isNaN(d) ? '' : d.toISOString().split('T')[0];
      };
      let imported = 0, skipped = 0;
      for (const row of rows) {
        const empName = String(pick(row, ['Xodim', 'Employee', 'Сотрудник'])).trim();
        const emp = employees.find(x => (x.name || '').trim().toLowerCase() === empName.toLowerCase());
        const hours = parseFloat(pick(row, ['Soat', 'Hours', 'Часы'])) || 0;
        const date = parseDate(pick(row, ['Sana', 'Date', 'Дата']));
        if (!emp || !hours || !date) { skipped++; continue; }
        const billRaw = String(pick(row, ['Hisob-kitobga kiradi', 'Billable', 'Оплачиваемый'])).trim().toLowerCase();
        const billable = ['ha', 'yes', 'да', 'true', '1'].includes(billRaw);
        const rate = parseFloat(String(pick(row, ['Soatlik narx', 'Hourly rate', 'Ставка'])).replace(/[^\d.]/g, '')) || 0;
        const taskName = String(pick(row, ['Vazifa', 'Task', 'Задача'])).trim();
        const task = taskName ? tasks.find(tk => (tk.title || '').trim().toLowerCase() === taskName.toLowerCase()) : null;
        try {
          await projectsService.createTimeEntry(projectId, {
            employee_id: emp.id,
            employee_name: emp.name,
            task_id: task?.id || undefined,
            date,
            hours,
            description: String(pick(row, ['Tavsif', 'Description', 'Описание']) || ''),
            billable,
            hourly_rate: rate,
          });
          imported++;
        } catch { skipped++; }
      }
      await loadTimeEntries(projectId);
      toast.success(`${t('imported') || 'Imported'}: ${imported}${skipped ? ` · ${t('skipped') || 'skipped'}: ${skipped}` : ''}`);
    } catch (error) {
      console.error('Error importing time entries:', error);
      toast.error(t('error_importing') || 'Error importing');
    } finally {
      e.target.value = '';
    }
  };

  const resetNewTimeEntry = () => {
    setNewTimeEntry({
      employee_id: currentEmployeeId || '',
      employee_name: currentEmployeeId ? (employees.find(e => e.id === currentEmployeeId)?.name || '') : '',
      task_id: '',
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
      toast.error(t('error_creating_expense') || 'Error creating expense');
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

    const config = statusConfig[status];
    if (config) {
      const Icon = config.icon;
      return (
        <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
          <Icon className="w-3 h-3" />
          {config.label}
        </Badge>
      );
    }

    // Custom stage: use the stage's stored name/color
    const stage = stages.find(s => s.stage_key === status);
    return (
      <Badge className={`w-fit ${stage?.color || 'bg-slate-100 text-slate-700'}`}>
        {stage ? stage.name : (status || '-')}
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

  // Left-border accent + dot color by priority (used on cards / list rows)
  const priorityAccent = (priority) => ({
    low: 'border-l-slate-300',
    medium: 'border-l-blue-400',
    high: 'border-l-amber-400',
    critical: 'border-l-red-500',
  }[priority] || 'border-l-slate-300');

  const priorityDot = (priority) => ({
    low: 'bg-slate-300',
    medium: 'bg-blue-400',
    high: 'bg-amber-400',
    critical: 'bg-red-500',
  }[priority] || 'bg-slate-300');

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

  // ---- Overview report metrics (computed from live data) ----
  const reportLoggedHours = timeEntries.reduce((s, e) => s + (e.hours || 0), 0);
  const reportBillableHours = timeEntries.filter(e => e.billable).reduce((s, e) => s + (e.hours || 0), 0);
  const reportBillableAmount = timeEntries.filter(e => e.billable).reduce((s, e) => s + (e.amount || 0), 0);
  const reportExpensesTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const reportSpent = Number(project?.spent || 0);
  const reportBudget = Number(project?.budget || 0);
  const reportBudgetPct = reportBudget > 0 ? (reportSpent / reportBudget) * 100 : 0;
  const reportRemaining = reportBudget - reportSpent;
  const reportTodayStr = new Date().toDateString();
  const reportOverdue = tasks.filter(tk => {
    const d = tk.due_date ? new Date(tk.due_date) : null;
    return d && d < new Date(reportTodayStr) && tk.status !== 'completed';
  }).length;
  const reportTaskPct = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
  const reportMilestonePct = milestoneStats.total > 0 ? Math.round((milestoneStats.completed / milestoneStats.total) * 100) : 0;

  // Tasks shown in list/kanban, optionally filtered to the current user + milestone
  let displayedTasks = tasks;
  const isMine = (tk) => currentEmployeeId && (
    (tk.assignees && tk.assignees.some(a => a.employee_id === currentEmployeeId)) || tk.assignee_id === currentEmployeeId
  );
  if (onlyMine) displayedTasks = displayedTasks.filter(isMine);
  if (taskMilestoneFilter !== 'all') displayedTasks = displayedTasks.filter(tk => (tk.milestone_id || '') === taskMilestoneFilter);
  const myTaskCount = tasks.filter(isMine).length;

  // Inline status dropdown (uses backend stages), shared by list + card
  const renderStatusSelect = (task, widthClass = 'w-[150px]') => (
    canUpdate(MODULES.PROJECTS) && stages.length > 0 ? (
      <Select value={task.status || stages[0]?.stage_key} onValueChange={(v) => handleTaskStatusChange(task, v)}>
        <SelectTrigger className={`${widthClass} h-8`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stages.map(s => (
            <SelectItem key={s.id} value={s.stage_key}>{stageLabel(s)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : getStatusBadge(task.status)
  );

  // Normalize a task's assignees to [{id, name}] (falls back to the legacy single field)
  const taskAssignees = (task) => {
    if (task.assignees && task.assignees.length) return task.assignees.map(a => ({ id: a.employee_id, name: a.employee_name }));
    if (task.assignee_id) return [{ id: task.assignee_id, name: task.assignee_name }];
    return [];
  };

  // Stacked avatars for a task's assignees
  const renderAssigneeAvatars = (task, size = 'md') => {
    const list = taskAssignees(task);
    const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-[11px]';
    if (list.length === 0) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="w-3.5 h-3.5" />{t('unassigned') || 'Unassigned'}
        </span>
      );
    }
    const shown = list.slice(0, 3);
    const extra = list.length - shown.length;
    return (
      <div className="flex items-center" title={list.map(a => a.name).filter(Boolean).join(', ')}>
        <div className="flex -space-x-2">
          {shown.map((a, i) => (
            <div key={a.id || i} className={`${dim} rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-semibold ring-2 ring-white`}>
              {(a.name || '?').trim().charAt(0).toUpperCase()}
            </div>
          ))}
          {extra > 0 && (
            <div className={`${dim} rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold ring-2 ring-white`}>+{extra}</div>
          )}
        </div>
        {list.length === 1 && <span className="ml-2 text-xs text-slate-600 truncate max-w-[110px]">{list[0].name}</span>}
      </div>
    );
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                {t('progress') || 'Progress'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Auto-derive from task completion; fall back to the stored
                // project.progress only when there are no tasks.
                const p = taskStats.total > 0 ? reportTaskPct : (project.progress || 0);
                return (
                  <>
                    <div className="text-2xl font-bold">{p}%</div>
                    <Progress value={p} className="mt-2" />
                  </>
                );
              })()}
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
                {formatCurrencyCompact(project.budget || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrencyCompact(project.spent || 0)} {t('spent') || 'spent'}
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
                {project.start_date && fmt(parseISO(project.start_date), 'MMM dd, yyyy')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('to') || 'to'} {project.end_date && fmt(parseISO(project.end_date), 'MMM dd, yyyy')}
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
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle>{t('tasks') || 'Tasks'}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Stage (milestone) filter */}
                    {milestones.length > 0 && (
                      <Select value={taskMilestoneFilter} onValueChange={setTaskMilestoneFilter}>
                        <SelectTrigger className="h-8 w-[170px]">
                          <SelectValue placeholder={t('all_stages') || 'All stages'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('all_stages') || 'All stages'}</SelectItem>
                          {milestones.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {/* My tasks filter */}
                    <Button
                      variant={onlyMine ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setOnlyMine(v => !v)}
                      disabled={!currentEmployeeId}
                      title={!currentEmployeeId ? (t('no_linked_employee') || 'Your account is not linked to an employee') : ''}
                    >
                      <User className="w-4 h-4 mr-1.5" />
                      {t('my_tasks') || 'My tasks'}
                      <span className={`ml-1.5 text-xs rounded-full px-1.5 ${onlyMine ? 'bg-white/25' : 'bg-slate-100'}`}>{myTaskCount}</span>
                    </Button>

                    {/* List / Kanban toggle */}
                    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                      <Button
                        variant={taskView === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setTaskView('list')}
                      >
                        <LayoutGrid className="w-4 h-4 mr-1.5" />
                        {t('list_view') || 'List'}
                      </Button>
                      <Button
                        variant={taskView === 'kanban' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setTaskView('kanban')}
                      >
                        <Columns className="w-4 h-4 mr-1.5" />
                        {t('kanban_view') || 'Kanban'}
                      </Button>
                    </div>
                    {canCreate(MODULES.PROJECTS) && (
                      <Button onClick={openNewTask}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('new_task') || 'New Task'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Task Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                  {[
                    { value: taskStats.total, label: t('total') || 'Total', icon: ListTodo, accent: 'slate', ring: 'ring-slate-200', iconBg: 'bg-slate-100 text-slate-600', num: 'text-slate-900' },
                    { value: taskStats.in_progress, label: t('in_progress') || 'In Progress', icon: Clock, accent: 'blue', ring: 'ring-blue-100', iconBg: 'bg-blue-100 text-blue-600', num: 'text-blue-600' },
                    { value: taskStats.completed, label: t('completed') || 'Completed', icon: CheckCircle, accent: 'green', ring: 'ring-green-100', iconBg: 'bg-green-100 text-green-600', num: 'text-green-600' },
                    { value: taskStats.todo, label: t('todo') || 'To Do', icon: AlertCircle, accent: 'amber', ring: 'ring-amber-100', iconBg: 'bg-amber-100 text-amber-600', num: 'text-amber-600' },
                  ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={i} className={`relative overflow-hidden rounded-xl bg-white ring-1 ${s.ring} p-4 shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className={`text-3xl font-bold leading-none ${s.num}`}>{s.value}</div>
                            <div className="text-xs font-medium text-slate-500 mt-2">{s.label}</div>
                          </div>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tasks: empty / list / kanban */}
                {tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <ListTodo className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('no_tasks') || 'No tasks yet'}</p>
                  </div>
                ) : taskView === 'list' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('task') || 'Task'}</TableHead>
                        <TableHead>{t('assignee') || 'Assignee'}</TableHead>
                        <TableHead>{t('priority') || 'Priority'}</TableHead>
                        <TableHead>{t('finish_date') || 'Finish date'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedTasks.map((task) => {
                        return (
                        <TableRow key={task.id} className="group hover:bg-slate-50/70 align-top">
                          <TableCell className="max-w-[360px]">
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${priorityDot(task.priority)}`} title={task.priority} />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 line-clamp-2 break-words">{task.title}</div>
                                {task.description && (
                                  <div className="text-xs text-muted-foreground line-clamp-1 break-words">{task.description}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{renderAssigneeAvatars(task, 'sm')}</TableCell>
                          <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-600 whitespace-nowrap">
                              {task.due_date ? fmt(parseISO(task.due_date), 'MMM dd, yyyy') : '-'}
                            </span>
                          </TableCell>
                          <TableCell>{renderStatusSelect(task)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => openNotes(task)} title={t('notes') || 'Notes'}>
                                <MessageSquare className="w-4 h-4" />
                                {task.note_count > 0 && (
                                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">{task.note_count}</span>
                                )}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewTask(task)} title={t('view') || 'View'}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canUpdate(MODULES.PROJECTS) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTask(task)} title={t('edit') || 'Edit'}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {canDelete(MODULES.PROJECTS) && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => handleDeleteTask(task)} title={t('delete') || 'Delete'}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  /* Kanban board (stages from backend, editable) */
                  <div className="flex gap-5 overflow-x-auto pb-2 items-start">
                    {stages.map((col) => {
                      const sortMode = stageSort[col.stage_key] || 'none';
                      const colTasks = sortByPriority(displayedTasks.filter(tk => (tk.status || stages[0]?.stage_key) === col.stage_key), sortMode);
                      const sortTitle = sortMode === 'desc' ? (t('most_urgent_first') || 'Most urgent first') : sortMode === 'asc' ? (t('least_urgent_first') || 'Least urgent first') : (t('sort_priority') || 'Sort by priority');
                      return (
                        <div
                          key={col.id}
                          className="flex-shrink-0 w-[360px] flex flex-col rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleTaskDrop(e, col.stage_key)}
                        >
                          {/* Column header */}
                          <div className="group flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/70">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`px-2.5 py-1 rounded-md text-sm font-semibold truncate ${col.color || 'bg-slate-200 text-slate-700'}`}>
                                {stageLabel(col)}
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-full min-w-[22px] text-center px-1.5 py-0.5">
                                {colTasks.length}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 ${sortMode !== 'none' ? 'text-blue-600' : 'text-slate-400'}`}
                                onClick={() => cycleStageSort(col.stage_key)}
                                title={sortTitle}
                              >
                                {sortMode === 'desc' ? <ArrowDownWideNarrow className="w-4 h-4" /> : sortMode === 'asc' ? <ArrowUpNarrowWide className="w-4 h-4" /> : <ArrowUpDown className="w-4 h-4" />}
                              </Button>
                              {canUpdate(MODULES.PROJECTS) && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditStage(col)} title={t('edit') || 'Edit'}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDeleteStage(col)} title={t('delete') || 'Delete'}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Cards */}
                          <div className="p-3 space-y-3 min-h-[160px] flex-1">
                            {colTasks.map((task) => {
                              return (
                              <Card
                                key={task.id}
                                draggable={canUpdate(MODULES.PROJECTS)}
                                onDragStart={(e) => handleTaskDragStart(e, task)}
                                onDragEnd={handleTaskDragEnd}
                                className={`group bg-white border border-slate-200 border-l-[6px] ${priorityAccent(task.priority)} rounded-xl cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-0.5 transition-all`}
                              >
                                <CardContent className="p-5 space-y-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-bold text-lg leading-snug text-slate-800 line-clamp-2">{task.title}</div>
                                    <div className="flex items-center -mr-1.5 -mt-1 shrink-0">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => setViewTask(task)} title={t('view') || 'View'}>
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="relative h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => openNotes(task)} title={t('notes') || 'Notes'}>
                                        <MessageSquare className="w-4 h-4" />
                                        {task.note_count > 0 && (
                                          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">{task.note_count}</span>
                                        )}
                                      </Button>
                                    </div>
                                  </div>

                                  {task.description && (
                                    <div className="text-sm text-muted-foreground line-clamp-3">{task.description}</div>
                                  )}

                                  <div className="flex items-center gap-2 flex-wrap">
                                    {getPriorityBadge(task.priority)}
                                    {task.due_date && (
                                      <span className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md px-2 py-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {fmt(parseISO(task.due_date), 'MMM dd')}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
                                    {renderAssigneeAvatars(task)}
                                    {renderStatusSelect(task, 'w-[118px]')}
                                  </div>

                                  {/* Edit / Delete split row */}
                                  {(canUpdate(MODULES.PROJECTS) || canDelete(MODULES.PROJECTS)) && (
                                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        disabled={!canUpdate(MODULES.PROJECTS)}
                                        onClick={() => openEditTask(task)}
                                      >
                                        <Edit className="w-4 h-4 mr-1.5" />
                                        {t('edit') || 'Edit'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                        disabled={!canDelete(MODULES.PROJECTS)}
                                        onClick={() => handleDeleteTask(task)}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1.5" />
                                        {t('delete') || 'Delete'}
                                      </Button>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                              );
                            })}
                            {colTasks.length === 0 && (
                              <div className="flex items-center justify-center h-24 text-slate-400 text-xs border-2 border-dashed border-slate-300/80 rounded-xl">
                                {t('drop_here') || ''}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add stage column */}
                    {canCreate(MODULES.PROJECTS) && (
                      <button
                        onClick={openAddStage}
                        className="flex-shrink-0 w-72 self-stretch min-h-[200px] rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors"
                      >
                        <span className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <Plus className="w-5 h-5" />
                        </span>
                        {t('add_stage') || 'Add stage'}
                      </button>
                    )}
                  </div>
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
                    {milestones.map((milestone) => {
                      const expanded = expandedMilestone === milestone.id;
                      const mTasks = tasks.filter(tk => tk.milestone_id === milestone.id);
                      // Derive status from tasks when the milestone has any; else use stored status
                      const derivedStatus = deriveMilestoneStatus(mTasks);
                      const effectiveStatus = derivedStatus || milestone.status;
                      const meta = milestoneStatusMeta(effectiveStatus);
                      return (
                      <Card key={milestone.id} className="overflow-hidden border-slate-200">
                        {/* Header row */}
                        <div className="flex items-start gap-3 p-4">
                          <div
                            role="button"
                            onClick={() => toggleExpandMilestone(milestone.id)}
                            className="mt-1 text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
                            title={expanded ? (t('collapse') || 'Collapse') : (t('expand') || 'Expand')}
                          >
                            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </div>

                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpandMilestone(milestone.id)}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg text-slate-800">{milestone.title}</h3>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${meta.color}`}>{meta.label}</span>
                              {mTasks.length > 0 && (
                                <span className="text-xs text-slate-500">
                                  {mTasks.filter(tk => tk.status === 'completed').length}/{mTasks.length} {t('tasks') || 'tasks'}
                                </span>
                              )}
                            </div>
                            {milestone.description && (
                              <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                              {milestone.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {fmt(parseISO(milestone.due_date), 'MMM dd, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {mTasks.length === 0 && canUpdate(MODULES.PROJECTS) && (
                              <Select value={milestone.status || 'pending'} onValueChange={(v) => handleMilestoneStatusChange(milestone, v)}>
                                <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {MILESTONE_STATUSES.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openFiles(milestone)} title={t('files') || 'Files'}>
                              <Paperclip className="w-4 h-4" />
                            </Button>
                            {canUpdate(MODULES.PROJECTS) && (
                              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setEditingMilestone(milestone); setShowMilestoneDialog(true); }} title={t('edit') || 'Edit'}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {canDelete(MODULES.PROJECTS) && (
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-red-600" onClick={() => handleDeleteMilestone(milestone.id)} title={t('delete') || 'Delete'}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expanded: this milestone's tasks (kanban / list) */}
                        {expanded && (
                          <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-700">{t('tasks') || 'Tasks'} ({mTasks.length})</div>
                              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-white">
                                <Button variant={milestoneTaskView === 'list' ? 'default' : 'ghost'} size="sm" className="h-7 px-2.5" onClick={() => setMilestoneTaskView('list')}>
                                  <LayoutGrid className="w-3.5 h-3.5 mr-1" />{t('list_view') || 'List'}
                                </Button>
                                <Button variant={milestoneTaskView === 'kanban' ? 'default' : 'ghost'} size="sm" className="h-7 px-2.5" onClick={() => setMilestoneTaskView('kanban')}>
                                  <Columns className="w-3.5 h-3.5 mr-1" />{t('kanban_view') || 'Kanban'}
                                </Button>
                              </div>
                            </div>

                            {mTasks.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t('no_tasks') || 'No tasks yet'}</p>
                            ) : milestoneTaskView === 'list' ? (
                              <div className="space-y-2">
                                {mTasks.map((task) => (
                                    <div key={task.id} className={`flex items-center gap-3 bg-white rounded-lg border border-slate-200 border-l-4 ${priorityAccent(task.priority)} p-3 hover:shadow-md transition-shadow`}>
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewTask(task)}>
                                        <div className="font-medium text-slate-800 truncate">{task.title}</div>
                                        <div className="mt-1">{renderAssigneeAvatars(task, 'sm')}</div>
                                      </div>
                                      {task.due_date && <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" />{fmt(parseISO(task.due_date), 'MMM dd')}</span>}
                                      {renderStatusSelect(task, 'w-[130px]')}
                                    </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex gap-3 overflow-x-auto pb-1">
                                {stages.map((col) => {
                                  const cTasks = mTasks.filter(tk => (tk.status || stages[0]?.stage_key) === col.stage_key);
                                  return (
                                    <div key={col.id} className="flex-shrink-0 w-60 bg-white rounded-xl border border-slate-200 p-2"
                                      onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleTaskDrop(e, col.stage_key)}>
                                      <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b border-slate-100">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${col.color || 'bg-slate-200 text-slate-700'}`}>{stageLabel(col)}</span>
                                        <span className="text-xs text-slate-500">{cTasks.length}</span>
                                      </div>
                                      <div className="space-y-2 min-h-[60px]">
                                        {cTasks.map((task) => (
                                            <div key={task.id}
                                              draggable={canUpdate(MODULES.PROJECTS)}
                                              onDragStart={(e) => handleTaskDragStart(e, task)}
                                              onDragEnd={handleTaskDragEnd}
                                              onClick={() => setViewTask(task)}
                                              className={`bg-white rounded-lg border border-slate-200 border-l-4 ${priorityAccent(task.priority)} p-2.5 cursor-pointer hover:shadow-md transition-shadow`}>
                                              <div className="font-medium text-sm text-slate-800 line-clamp-2">{task.title}</div>
                                              <div className="flex items-center justify-between gap-2 mt-1.5">
                                                {renderAssigneeAvatars(task, 'sm')}
                                                {task.due_date && (
                                                  <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" />{fmt(parseISO(task.due_date), 'MMM dd')}</span>
                                                )}
                                              </div>
                                            </div>
                                        ))}
                                        {cTasks.length === 0 && <div className="h-10 rounded-lg border-2 border-dashed border-slate-200" />}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
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
              }}
            />
          </TabsContent>

          {/* Time Entries Tab */}
          <TabsContent value="time" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle>{t('time_entries') || 'Time Entries'}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExportTime} disabled={timeEntries.length === 0}>
                      <Download className="w-4 h-4 mr-2" />
                      {t('export') || 'Export'}
                    </Button>
                    {canCreate(MODULES.PROJECTS) && (
                      <label className="inline-flex">
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportTime} />
                        <span className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-50">
                          <Upload className="w-4 h-4 mr-2" />
                          {t('import') || 'Import'}
                        </span>
                      </label>
                    )}
                    {canCreate(MODULES.PROJECTS) && (
                      <Button onClick={() => { resetNewTimeEntry(); setShowTimeEntryDialog(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('log_time') || 'Log Time'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Time Entry Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-blue-100 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0).toFixed(1)} {t('hours_short') || 'h'}
                    </div>
                    <div className="text-xs text-blue-600">{t('total_hours') || 'Total Hours'}</div>
                  </div>
                  <div className="text-center p-3 bg-green-100 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {timeEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.hours || 0), 0).toFixed(1)} {t('hours_short') || 'h'}
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
                        <TableHead>{t('task') || 'Task'}</TableHead>
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
                            {entry.date && fmt(parseISO(entry.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {entry.employee_name || t('unknown') || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm text-slate-600">
                            {entry.task_id ? (tasks.find(tk => tk.id === entry.task_id)?.title || '-') : <span className="text-slate-400">{t('no_task') || '—'}</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.hours} {t('hours_short') || 'h'}</Badge>
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
                            {expense.expense_date && fmt(parseISO(expense.expense_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{expense.category ? categoryLabel(expense.category) : (t('general') || 'General')}</Badge>
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
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: t('task_completion') || 'Tasks done', value: `${taskStats.completed}/${taskStats.total}`, sub: `${reportTaskPct}%`, icon: ListTodo, cls: 'text-blue-600', bg: 'bg-blue-100' },
                { label: t('milestones') || 'Milestones', value: `${milestoneStats.completed}/${milestoneStats.total}`, sub: `${reportMilestonePct}%`, icon: Target, cls: 'text-amber-600', bg: 'bg-amber-100' },
                { label: t('total_hours') || 'Hours logged', value: `${reportLoggedHours.toFixed(1)} ${t('hours_short') || 'h'}`, sub: `${reportBillableHours.toFixed(1)} ${t('billable_hours') || 'billable'}`, icon: Clock, cls: 'text-purple-600', bg: 'bg-purple-100' },
                { label: t('overdue') || 'Overdue', value: `${reportOverdue}`, sub: t('tasks') || 'tasks', icon: AlertCircle, cls: reportOverdue > 0 ? 'text-red-600' : 'text-slate-600', bg: reportOverdue > 0 ? 'bg-red-100' : 'bg-slate-100' },
              ].map((k, i) => {
                const Icon = k.icon;
                return (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${k.bg} ${k.cls}`}><Icon className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <div className={`text-xl font-bold leading-none ${k.cls}`}>{k.value}</div>
                        <div className="text-xs text-slate-500 mt-1 truncate">{k.label} · {k.sub}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Task status breakdown */}
              <Card>
                <CardHeader><CardTitle className="text-base">{t('tasks') || 'Tasks'} {t('by_status') || 'by status'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {stages.length === 0 || taskStats.total === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('no_tasks') || 'No tasks yet'}</p>
                  ) : stages.map((s) => {
                    const count = tasks.filter(tk => (tk.status || stages[0]?.stage_key) === s.stage_key).length;
                    const pctv = taskStats.total > 0 ? (count / taskStats.total) * 100 : 0;
                    return (
                      <div key={s.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.color || 'bg-slate-100 text-slate-700'}`}>{stageLabel(s)}</span></span>
                          <span className="font-semibold text-slate-700">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pctv}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Budget report */}
              <Card>
                <CardHeader><CardTitle className="text-base">{t('budget') || 'Budget'}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-slate-800">{formatCurrencyCompact(reportBudget)}</div>
                      <div className="text-xs text-slate-500">{t('budget') || 'Budget'}</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-orange-600">{formatCurrencyCompact(reportSpent)}</div>
                      <div className="text-xs text-slate-500">{t('spent') || 'Spent'}</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${reportRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrencyCompact(reportRemaining)}</div>
                      <div className="text-xs text-slate-500">{t('remaining') || 'Remaining'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('budget_utilization') || 'Budget utilization'}</span>
                      <span className={`font-semibold ${reportBudgetPct > 100 ? 'text-red-600' : ''}`}>{Math.round(reportBudgetPct)}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${reportBudgetPct > 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(reportBudgetPct, 100)}%` }} />
                    </div>
                    {reportBudgetPct > 100 && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t('over_budget') || 'Over budget'}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Time & billing report */}
              <Card>
                <CardHeader><CardTitle className="text-base">{t('time') || 'Time'} & {t('billing_type') || 'billing'}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-blue-50">
                      <div className="text-lg font-bold text-blue-600">{reportLoggedHours.toFixed(1)} {t('hours_short') || 'h'}</div>
                      <div className="text-xs text-blue-600">{t('total_hours') || 'Total'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50">
                      <div className="text-lg font-bold text-green-600">{reportBillableHours.toFixed(1)} {t('hours_short') || 'h'}</div>
                      <div className="text-xs text-green-600">{t('billable_hours') || 'Billable'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50">
                      <div className="text-lg font-bold text-purple-600">{formatCurrencyCompact(reportBillableAmount)}</div>
                      <div className="text-xs text-purple-600">{t('billable_amount') || 'Amount'}</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm mt-4 pt-3 border-t border-slate-100">
                    <span className="text-slate-500">{t('total_expenses') || 'Total expenses'}</span>
                    <span className="font-semibold">{formatCurrency(reportExpensesTotal)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Project details */}
              <Card>
                <CardHeader><CardTitle className="text-base">{t('project_details') || 'Project details'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">{t('project_code') || 'Project code'}</span>
                    <span className="text-sm font-medium">{project.project_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">{t('billing_type') || 'Billing type'}</span>
                    <span className="text-sm font-medium">{t(project.billing_type) || project.billing_type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">{t('priority') || 'Priority'}</span>
                    {getPriorityBadge(project.priority)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">{t('status') || 'Status'}</span>
                    <span className="text-sm font-medium">{t(project.status) || project.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">{t('timeline') || 'Timeline'}</span>
                    <span className="text-sm font-medium">
                      {project.start_date ? fmt(parseISO(project.start_date), 'MMM dd, yyyy') : '-'}
                      {project.end_date ? ` → ${fmt(parseISO(project.end_date), 'MMM dd, yyyy')}` : ''}
                    </span>
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
              <div>
                <Label>{t('assignees') || 'Assignees'}</Label>
                <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-0.5">
                  {employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1 py-2">{t('no_employees') || 'No employees'}</p>
                  ) : employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300"
                        checked={formAssigneeIds.includes(emp.id)}
                        onChange={() => toggleFormAssignee(emp.id)}
                      />
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-[10px] font-semibold">
                        {(emp.name || '?').trim().charAt(0).toUpperCase()}
                      </span>
                      {emp.name}
                    </label>
                  ))}
                </div>
                {formAssigneeIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{formAssigneeIds.length} {t('selected') || 'selected'}</p>
                )}
              </div>
              <div>
                <Label>{t('finish_date') || 'Finish date'}</Label>
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
              <div>
                <Label>{t('milestone') || 'Stage'}</Label>
                <Select
                  value={editingTask ? (editingTask.milestone_id || 'none') : (newTask.milestone_id || 'none')}
                  onValueChange={(value) => {
                    const v = value === 'none' ? '' : value;
                    if (editingTask) {
                      setEditingTask({ ...editingTask, milestone_id: v });
                    } else {
                      setNewTask({ ...newTask, milestone_id: v });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_stage') || 'Select stage'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_stage') || 'No stage'}</SelectItem>
                    {milestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
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

        {/* View Task Dialog */}
        <Dialog open={!!viewTask} onOpenChange={(open) => { if (!open) setViewTask(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{viewTask?.title}</DialogTitle>
            </DialogHeader>
            {viewTask && (
              <div className="space-y-4">
                {viewTask.description && (
                  <div>
                    <Label className="text-muted-foreground">{t('description') || 'Description'}</Label>
                    <p className="text-sm mt-1">{viewTask.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t('assignees') || 'Assignees'}</Label>
                    <div className="mt-1">{renderAssigneeAvatars(viewTask, 'sm')}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('status') || 'Status'}</Label>
                    <div className="mt-1">{getStatusBadge(viewTask.status)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('priority') || 'Priority'}</Label>
                    <div className="mt-1">{getPriorityBadge(viewTask.priority)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('finish_date') || 'Finish date'}</Label>
                    <p className="text-sm mt-1">{viewTask.due_date ? fmt(parseISO(viewTask.due_date), 'MMM dd, yyyy') : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('hours_logged') || 'Hours'}</Label>
                    {(() => {
                      const logged = timeEntries.filter(e => e.task_id === viewTask.id).reduce((s, e) => s + (e.hours || 0), 0);
                      const est = Number(viewTask.estimated_hours || 0);
                      const over = est > 0 && logged > est;
                      return (
                        <p className={`text-sm mt-1 font-medium ${over ? 'text-red-600' : ''}`}>
                          {logged.toFixed(1)} {est > 0 ? `/ ${est.toFixed(1)} ` : ''}{t('hours_short') || 'h'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              {canUpdate(MODULES.PROJECTS) && (
                <Button onClick={() => { const tk = viewTask; setViewTask(null); openEditTask(tk); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  {t('edit') || 'Edit'}
                </Button>
              )}
              <Button variant="outline" onClick={() => setViewTask(null)}>{t('close') || 'Close'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Task Notes Modal */}
        <Dialog open={!!notesTask} onOpenChange={(open) => { if (!open) { setNotesTask(null); setTaskNotes([]); setNewNote(''); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                {t('notes') || 'Notes'}{notesTask ? ` — ${notesTask.title}` : ''}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('write_a_note') || 'Write a note...'}
                rows={3}
                className="w-full resize-none"
              />
              <div className="flex justify-end">
                <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t('add_note') || 'Add'}
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {loadingNotes ? (
                <div className="text-center py-6">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : taskNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('no_notes_yet') || 'No notes yet'}</p>
              ) : (
                taskNotes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-[10px] font-semibold">
                          {(n.created_by_name || '?').trim().charAt(0).toUpperCase()}
                        </div>
                        {n.created_by_name || (t('unknown') || 'Unknown')}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {n.created_at ? fmt(parseISO(n.created_at), 'MMM dd, HH:mm') : ''}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{n.note}</p>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesTask(null)}>{t('close') || 'Close'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add expense category */}
        <Dialog open={showCategoryDialog} onOpenChange={(o) => { setShowCategoryDialog(o); if (!o) setNewCategoryName(''); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('add_category') || 'Add category'}</DialogTitle>
            </DialogHeader>
            <div>
              <Label>{t('category') || 'Category'}</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                placeholder={t('category') || 'Category'}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCategoryDialog(false); setNewCategoryName(''); }}>{t('cancel') || 'Cancel'}</Button>
              <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>{t('add') || 'Add'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Milestone Files Modal */}
        <Dialog open={!!filesMilestone} onOpenChange={(open) => { if (!open) { setFilesMilestone(null); setMilestoneFiles([]); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                {t('files') || 'Files'}{filesMilestone ? ` — ${filesMilestone.title}` : ''}
              </DialogTitle>
            </DialogHeader>

            {canUpdate(MODULES.PROJECTS) && (
              <label className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors ${uploadingFile ? 'opacity-60 pointer-events-none' : ''}`}>
                <input type="file" className="hidden" onChange={handleUploadFile} disabled={uploadingFile} />
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">{uploadingFile ? (t('uploading') || 'Uploading...') : (t('upload_file') || 'Upload file')}</span>
              </label>
            )}

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {loadingFiles ? (
                <div className="text-center py-6">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : milestoneFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('no_files') || 'No files yet'}</p>
              ) : (
                milestoneFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.original_name}</div>
                      <div className="text-xs text-muted-foreground">{(f.file_size / 1024).toFixed(0)} KB</div>
                    </div>
                    <a
                      href={`${(import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/api\/v1\/?$/, '')}${f.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 shrink-0"
                      title={t('download') || 'Download'}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {canDelete(MODULES.PROJECTS) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 shrink-0" onClick={() => handleDeleteFile(f.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFilesMilestone(null)}>{t('close') || 'Close'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stage (kanban column) Dialog */}
        <Dialog open={showStageDialog} onOpenChange={(open) => { setShowStageDialog(open); if (!open) { setEditingStage(null); setStageName(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingStage ? (t('edit_stage') || 'Edit stage') : (t('new_stage') || 'New stage')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t('stage_name') || 'Stage name'}</Label>
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStage(); }}
                placeholder={t('stage_name') || 'Stage name'}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowStageDialog(false); setEditingStage(null); setStageName(''); }}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button onClick={handleSaveStage} disabled={!stageName.trim()}>
                {editingStage ? (t('update') || 'Update') : (t('create') || 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm (delete) Modal */}
        <Dialog open={!!confirmModal} onOpenChange={(open) => { if (!open) setConfirmModal(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </span>
                {confirmModal?.title}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{confirmModal?.message}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmModal(null)}>{t('cancel') || 'Cancel'}</Button>
              <Button
                variant="destructive"
                onClick={async () => { const fn = confirmModal?.onConfirm; setConfirmModal(null); if (fn) await fn(); }}
              >
                {confirmModal?.confirmLabel || (t('delete') || 'Delete')}
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
                <Label>{t('milestone_name') || 'Stage name'}</Label>
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
                <Label>{t('finish_date') || 'Finish date'}</Label>
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
              <div>
                <Label>{t('task') || 'Task'}</Label>
                <Select
                  value={newTimeEntry.task_id || 'none'}
                  onValueChange={(value) => setNewTimeEntry({ ...newTimeEntry, task_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_task') || 'Select task'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_task') || 'No task (project)'}</SelectItem>
                    {tasks.map((tk) => (
                      <SelectItem key={tk.id} value={tk.id}>{tk.title}</SelectItem>
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
                    type="text"
                    inputMode="decimal"
                    value={formatPriceInput(newTimeEntry.hourly_rate)}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hourly_rate: parsePriceInput(e.target.value) })}
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
                    onValueChange={(value) => {
                      if (value === '__add__') { setShowCategoryDialog(true); return; }
                      setNewExpense({ ...newExpense, category: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_category') || 'Select category'} />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                      ))}
                      {customExpenseCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value="__add__" className="text-blue-600 font-medium">
                        + {t('add_category') || 'Add category'}
                      </SelectItem>
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
                    type="text"
                    inputMode="decimal"
                    value={formatPriceInput(newExpense.amount)}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: parsePriceInput(e.target.value) })}
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
