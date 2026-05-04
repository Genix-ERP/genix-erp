import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { projectsService } from '@/api/services/projects';
import { useAdminSettings } from './AdminSettingsContext';
import { useCompany } from './CompanyContext';
import { useEmployeePermissions } from './EmployeePermissionsContext';

const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const { getSetting } = useAdminSettings();
  const { activeCompany } = useCompany();
  const { canAccessModule, isAdmin } = useEmployeePermissions();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin settings for projects module - these affect module behavior
  const projectsSettings = useMemo(() => ({
    // Billing
    defaultBillingType: getSetting('projects.billing.default_type', 'time_materials'),
    allowOvertimeBilling: getSetting('projects.billing.allow_overtime_billing', true),
    defaultHourlyRate: getSetting('projects.billing.default_hourly_rate', 0),

    // Timesheet
    timesheetApprovalRequired: getSetting('projects.timesheet.approval_required', true),
    maxHoursPerDay: getSetting('projects.timesheet.max_hours_per_day', 12),
    timesheetReminderEnabled: getSetting('projects.timesheet.reminder_enabled', true),

    // Tasks
    defaultTaskHours: getSetting('projects.task.default_hours', 8),
    allowSubtasks: getSetting('projects.task.allow_subtasks', true),

    // Stages
    projectStages: getSetting('projects.stages', ['Planning', 'In Progress', 'Review', 'Completed', 'On Hold', 'Cancelled'])
  }), [getSetting]);

  // Load data from backend when company is available
  useEffect(() => {
    if (activeCompany) {
      loadData();
    }
  }, [activeCompany, isAdmin, canAccessModule]);

  const loadData = async () => {
    if (!activeCompany) return;
    // Skip the API call entirely for users without projects access — it
    // would just 403 and clutter the console. Admins always load.
    if (!(isAdmin || canAccessModule('projects'))) {
      setProjects([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const projectsData = await projectsService.listProjects();
      setProjects(projectsData || []);
    } catch (err) {
      console.error('Error loading projects data:', err);
      setError(err.message);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Project CRUD
  const createProject = useCallback(async (data) => {
    const newProject = await projectsService.createProject(data);
    setProjects(prev => [...prev, newProject]);
    return newProject;
  }, []);

  const updateProject = useCallback(async (id, updates) => {
    const updated = await projectsService.updateProject(id, updates);
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await projectsService.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    // Also clear cached tasks, milestones, and time entries for this project
    setTasks(prev => prev.filter(t => t.project_id !== id));
    setMilestones(prev => prev.filter(m => m.project_id !== id));
    setTimeEntries(prev => prev.filter(te => te.project_id !== id));
  }, []);

  const getProjectById = useCallback((id) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  // Task CRUD
  const createTask = useCallback(async (data) => {
    const newTask = await projectsService.createProjectTask(data.project_id, data);
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

  const updateTask = useCallback(async (id, updates) => {
    // Find the task to get project_id
    const task = tasks.find(t => t.id === id);
    if (task) {
      const updated = await projectsService.updateProjectTask(task.project_id, id, updates);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      return updated;
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await projectsService.deleteProjectTask(task.project_id, id);
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  }, [tasks]);

  const getTasksByProject = useCallback(async (projectId) => {
    try {
      const tasksData = await projectsService.listProjectTasks(projectId);
      // Update local cache
      setTasks(prev => {
        const otherTasks = prev.filter(t => t.project_id !== projectId);
        return [...otherTasks, ...(tasksData || [])];
      });
      return tasksData || [];
    } catch (err) {
      console.error('Error loading tasks:', err);
      return tasks.filter(t => t.project_id === projectId);
    }
  }, [tasks]);

  // Milestone CRUD
  const createMilestone = useCallback(async (data) => {
    const newMilestone = await projectsService.createProjectMilestone(data.project_id, data);
    setMilestones(prev => [...prev, newMilestone]);
    return newMilestone;
  }, []);

  const updateMilestone = useCallback(async (id, updates) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const deleteMilestone = useCallback(async (id) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  }, []);

  const getMilestonesByProject = useCallback(async (projectId) => {
    try {
      const milestonesData = await projectsService.listProjectMilestones(projectId);
      // Update local cache
      setMilestones(prev => {
        const otherMilestones = prev.filter(m => m.project_id !== projectId);
        return [...otherMilestones, ...(milestonesData || [])];
      });
      return milestonesData || [];
    } catch (err) {
      console.error('Error loading milestones:', err);
      return milestones.filter(m => m.project_id === projectId);
    }
  }, [milestones]);

  // Time Entry CRUD
  const createTimeEntry = useCallback(async (data) => {
    const newEntry = await projectsService.createTimeEntry(data.project_id, data);
    setTimeEntries(prev => [...prev, newEntry]);
    return newEntry;
  }, []);

  const updateTimeEntry = useCallback(async (id, updates) => {
    setTimeEntries(prev => prev.map(te => te.id === id ? { ...te, ...updates } : te));
  }, []);

  const deleteTimeEntry = useCallback(async (id) => {
    setTimeEntries(prev => prev.filter(te => te.id !== id));
  }, []);

  const getTimeEntriesByProject = useCallback(async (projectId) => {
    try {
      const entriesData = await projectsService.listTimeEntries(projectId);
      // Update local cache
      setTimeEntries(prev => {
        const otherEntries = prev.filter(te => te.project_id !== projectId);
        return [...otherEntries, ...(entriesData || [])];
      });
      return entriesData || [];
    } catch (err) {
      console.error('Error loading time entries:', err);
      return timeEntries.filter(te => te.project_id === projectId);
    }
  }, [timeEntries]);

  // Analytics
  const getProjectAnalytics = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in_progress');
    const completedProjects = projects.filter(p => p.status === 'completed');
    const overdueProjects = projects.filter(p => {
      if (p.status === 'completed' || p.status === 'cancelled') return false;
      return p.end_date && new Date(p.end_date) < new Date();
    });

    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0);
    const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const totalHours = timeEntries.reduce((sum, te) => sum + (te.hours || 0), 0);
    const billableHours = timeEntries.filter(te => te.billable).reduce((sum, te) => sum + (te.hours || 0), 0);

    const avgProgress = activeProjects.length > 0
      ? activeProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / activeProjects.length
      : 0;

    const tasksByStatus = tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      overdueProjects: overdueProjects.length,
      totalBudget,
      totalSpent,
      budgetUtilization,
      totalHours,
      billableHours,
      avgProgress,
      tasksByStatus,
    };
  }, [projects, tasks, timeEntries]);

  // Refresh data from backend
  const refreshData = useCallback(async () => {
    await loadData();
  }, []);

  const value = useMemo(() => ({
    // State
    projects,
    tasks,
    milestones,
    timeEntries,
    isLoading,
    error,

    // Project operations
    createProject,
    updateProject,
    deleteProject,
    getProjectById,

    // Task operations
    createTask,
    updateTask,
    deleteTask,
    getTasksByProject,

    // Milestone operations
    createMilestone,
    updateMilestone,
    deleteMilestone,
    getMilestonesByProject,

    // Time entry operations
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    getTimeEntriesByProject,

    // Analytics
    getProjectAnalytics,

    // Refresh
    refreshData,

    // Admin Settings (from Admin Settings page)
    settings: projectsSettings,
    // Helper functions for settings
    getDefaultBillingType: () => projectsSettings.defaultBillingType,
    isOvertimeBillingAllowed: () => projectsSettings.allowOvertimeBilling,
    getDefaultHourlyRate: () => projectsSettings.defaultHourlyRate,
    isTimesheetApprovalRequired: () => projectsSettings.timesheetApprovalRequired,
    getMaxHoursPerDay: () => projectsSettings.maxHoursPerDay,
    isTimesheetReminderEnabled: () => projectsSettings.timesheetReminderEnabled,
    getDefaultTaskHours: () => projectsSettings.defaultTaskHours,
    areSubtasksAllowed: () => projectsSettings.allowSubtasks,
    getProjectStages: () => projectsSettings.projectStages,
    validateTimeEntry: (hours) => {
      if (hours > projectsSettings.maxHoursPerDay) {
        return { valid: false, message: `Maximum ${projectsSettings.maxHoursPerDay} hours per day allowed` };
      }
      return { valid: true };
    }
  }), [projects, tasks, milestones, timeEntries, isLoading, error, createProject, updateProject, deleteProject, getProjectById, createTask, updateTask, deleteTask, getTasksByProject, createMilestone, updateMilestone, deleteMilestone, getMilestonesByProject, createTimeEntry, updateTimeEntry, deleteTimeEntry, getTimeEntriesByProject, getProjectAnalytics, refreshData, projectsSettings]);

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}

export default ProjectsContext;
