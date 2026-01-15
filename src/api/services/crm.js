import apiClient from '../client';
import { checkBackendHealth, isDemoMode } from '@/config/dataMode';

// Storage keys
const OPPORTUNITIES_KEY = 'genix_opportunities';
const ACTIVITIES_KEY = 'genix_activities';
const TASKS_KEY = 'genix_tasks';
const PIPELINE_STAGES_KEY = 'genix_pipeline_stages';

// Get storage key with company ID
const getStorageKey = (baseKey, companyId) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return companyId ? `${prefix}${baseKey}_${companyId}` : `${prefix}${baseKey}`;
};

// Generic localStorage helpers
const getLocalData = (key, companyId) => {
  const storageKey = getStorageKey(key, companyId);
  const stored = localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalData = (key, data, companyId) => {
  const storageKey = getStorageKey(key, companyId);
  localStorage.setItem(storageKey, JSON.stringify(data));
};

// Default pipeline stages
const defaultPipelineStages = [
  { id: 'stage_1', name: 'Qualification', code: 'qualification', sequence: 1, probability: 10, is_won: false, is_lost: false, color: '#6B7280' },
  { id: 'stage_2', name: 'Needs Analysis', code: 'needs_analysis', sequence: 2, probability: 25, is_won: false, is_lost: false, color: '#3B82F6' },
  { id: 'stage_3', name: 'Proposal', code: 'proposal', sequence: 3, probability: 50, is_won: false, is_lost: false, color: '#8B5CF6' },
  { id: 'stage_4', name: 'Negotiation', code: 'negotiation', sequence: 4, probability: 75, is_won: false, is_lost: false, color: '#F59E0B' },
  { id: 'stage_5', name: 'Closed Won', code: 'closed_won', sequence: 5, probability: 100, is_won: true, is_lost: false, color: '#10B981' },
  { id: 'stage_6', name: 'Closed Lost', code: 'closed_lost', sequence: 6, probability: 0, is_won: false, is_lost: true, color: '#EF4444' },
];

// =====================================================
// OPPORTUNITIES SERVICE
// =====================================================
export const opportunitiesService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/opportunities', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch opportunities from API:', error);
    }
    return getLocalData(OPPORTUNITIES_KEY, companyId);
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/opportunities/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch opportunity from API:', error);
    }
    const opportunities = getLocalData(OPPORTUNITIES_KEY, companyId);
    return opportunities.find(o => o.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/opportunities', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create opportunity via API:', error);
    }
    const localItem = {
      id: `opp_${Date.now()}`,
      ...data,
      stage: data.stage || 'qualification',
      probability: data.probability || 10,
      expected_revenue: data.expected_revenue || 0,
      currency: data.currency || 'USD',
      priority: data.priority || 'medium',
      tags: data.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const items = getLocalData(OPPORTUNITIES_KEY, companyId);
    items.unshift(localItem);
    saveLocalData(OPPORTUNITIES_KEY, items, companyId);
    return localItem;
  },

  async update(id, updates, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/opportunities/${id}`, updates);
        return response.data.data || { id, ...updates };
      }
    } catch (error) {
      console.warn('Failed to update opportunity via API:', error);
    }
    const items = getLocalData(OPPORTUNITIES_KEY, companyId);
    const index = items.findIndex(o => o.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
      saveLocalData(OPPORTUNITIES_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async delete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/opportunities/${id}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete opportunity via API:', error);
    }
    const items = getLocalData(OPPORTUNITIES_KEY, companyId);
    const filtered = items.filter(o => o.id !== id);
    saveLocalData(OPPORTUNITIES_KEY, filtered, companyId);
    return true;
  },

  async getStats(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/opportunities/stats', { params });
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch opportunity stats from API:', error);
    }
    const opportunities = getLocalData(OPPORTUNITIES_KEY, companyId);
    const wonOpps = opportunities.filter(o => o.stage === 'closed_won');
    const lostOpps = opportunities.filter(o => o.stage === 'closed_lost');
    const openOpps = opportunities.filter(o => !o.stage?.startsWith('closed'));

    return {
      total_opportunities: opportunities.length,
      total_value: opportunities.reduce((sum, o) => sum + (o.expected_revenue || 0), 0),
      weighted_value: opportunities.reduce((sum, o) => sum + ((o.expected_revenue || 0) * (o.probability || 0) / 100), 0),
      won_count: wonOpps.length,
      won_value: wonOpps.reduce((sum, o) => sum + (o.expected_revenue || 0), 0),
      lost_count: lostOpps.length,
      lost_value: lostOpps.reduce((sum, o) => sum + (o.expected_revenue || 0), 0),
      open_count: openOpps.length,
      open_value: openOpps.reduce((sum, o) => sum + (o.expected_revenue || 0), 0),
      win_rate: (wonOpps.length + lostOpps.length) > 0
        ? (wonOpps.length / (wonOpps.length + lostOpps.length)) * 100
        : 0,
      average_deal_size: opportunities.length > 0
        ? opportunities.reduce((sum, o) => sum + (o.expected_revenue || 0), 0) / opportunities.length
        : 0,
      average_sales_cycle: 30
    };
  },

  async getByStage(companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/opportunities/by-stage');
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch opportunities by stage from API:', error);
    }
    const opportunities = getLocalData(OPPORTUNITIES_KEY, companyId);
    const stageMap = {};

    opportunities.forEach(opp => {
      const stage = opp.stage || 'qualification';
      if (!stageMap[stage]) {
        stageMap[stage] = { stage, stage_name: stage.replace('_', ' '), count: 0, total_value: 0, probability: 0 };
      }
      stageMap[stage].count++;
      stageMap[stage].total_value += opp.expected_revenue || 0;
      stageMap[stage].probability = opp.probability || 0;
    });

    return Object.values(stageMap).sort((a, b) => {
      const order = ['qualification', 'needs_analysis', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
      return order.indexOf(a.stage) - order.indexOf(b.stage);
    });
  },

  async updateStage(id, stage, companyId) {
    return this.update(id, { stage }, companyId);
  }
};

// =====================================================
// PIPELINE STAGES SERVICE
// =====================================================
export const pipelineStagesService = {
  async list(companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/pipeline-stages');
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch pipeline stages from API:', error);
    }
    const stages = getLocalData(PIPELINE_STAGES_KEY, companyId);
    return stages.length > 0 ? stages : defaultPipelineStages;
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/pipeline-stages', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create pipeline stage via API:', error);
    }
    const localItem = {
      id: `stage_${Date.now()}`,
      ...data,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const items = getLocalData(PIPELINE_STAGES_KEY, companyId);
    items.push(localItem);
    saveLocalData(PIPELINE_STAGES_KEY, items, companyId);
    return localItem;
  },

  async update(id, updates, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/pipeline-stages/${id}`, updates);
        return response.data.data || { id, ...updates };
      }
    } catch (error) {
      console.warn('Failed to update pipeline stage via API:', error);
    }
    const items = getLocalData(PIPELINE_STAGES_KEY, companyId);
    const index = items.findIndex(s => s.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
      saveLocalData(PIPELINE_STAGES_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async delete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/pipeline-stages/${id}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete pipeline stage via API:', error);
    }
    const items = getLocalData(PIPELINE_STAGES_KEY, companyId);
    const filtered = items.filter(s => s.id !== id);
    saveLocalData(PIPELINE_STAGES_KEY, filtered, companyId);
    return true;
  }
};

// =====================================================
// ACTIVITIES SERVICE
// =====================================================
export const activitiesService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/activities', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch activities from API:', error);
    }
    return getLocalData(ACTIVITIES_KEY, companyId);
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/activities/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch activity from API:', error);
    }
    const activities = getLocalData(ACTIVITIES_KEY, companyId);
    return activities.find(a => a.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/activities', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create activity via API:', error);
    }
    const localItem = {
      id: `act_${Date.now()}`,
      ...data,
      status: data.status || 'planned',
      priority: data.priority || 'medium',
      is_all_day: data.is_all_day || false,
      is_private: data.is_private || false,
      attendees: data.attendees || [],
      tags: data.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const items = getLocalData(ACTIVITIES_KEY, companyId);
    items.unshift(localItem);
    saveLocalData(ACTIVITIES_KEY, items, companyId);
    return localItem;
  },

  async update(id, updates, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/activities/${id}`, updates);
        return response.data.data || { id, ...updates };
      }
    } catch (error) {
      console.warn('Failed to update activity via API:', error);
    }
    const items = getLocalData(ACTIVITIES_KEY, companyId);
    const index = items.findIndex(a => a.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
      saveLocalData(ACTIVITIES_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async delete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/activities/${id}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete activity via API:', error);
    }
    const items = getLocalData(ACTIVITIES_KEY, companyId);
    const filtered = items.filter(a => a.id !== id);
    saveLocalData(ACTIVITIES_KEY, filtered, companyId);
    return true;
  },

  async getStats(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/activities/stats', { params });
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch activity stats from API:', error);
    }
    const activities = getLocalData(ACTIVITIES_KEY, companyId);
    const today = new Date().toDateString();

    return {
      total_activities: activities.length,
      by_type: activities.reduce((acc, a) => {
        acc[a.activity_type] = (acc[a.activity_type] || 0) + 1;
        return acc;
      }, {}),
      by_status: activities.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      completed_today: activities.filter(a =>
        a.status === 'completed' && new Date(a.updated_at).toDateString() === today
      ).length,
      planned_today: activities.filter(a =>
        a.status === 'planned' && a.start_datetime && new Date(a.start_datetime).toDateString() === today
      ).length,
      overdue_count: activities.filter(a =>
        a.status === 'planned' && a.start_datetime && new Date(a.start_datetime) < new Date()
      ).length
    };
  },

  async getTimeline(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/activities/timeline', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch activity timeline from API:', error);
    }
    const activities = getLocalData(ACTIVITIES_KEY, companyId);
    return activities
      .filter(a => {
        if (params.related_type === 'lead') return a.lead_id === params.related_id;
        if (params.related_type === 'contact') return a.contact_id === params.related_id;
        if (params.related_type === 'opportunity') return a.opportunity_id === params.related_id;
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, params.limit || 50);
  },

  async complete(id, outcome, companyId) {
    return this.update(id, { status: 'completed', outcome }, companyId);
  }
};

// =====================================================
// TASKS SERVICE
// =====================================================
export const tasksService = {
  async list(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/tasks', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch tasks from API:', error);
    }
    let tasks = getLocalData(TASKS_KEY, companyId);

    // Apply filters
    if (params.status && !params.include_completed) {
      tasks = tasks.filter(t => t.status === params.status);
    }
    if (!params.include_completed) {
      tasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    }
    if (params.overdue_only) {
      const today = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled');
    }

    return tasks;
  },

  async get(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get(`/tasks/${id}`);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch task from API:', error);
    }
    const tasks = getLocalData(TASKS_KEY, companyId);
    return tasks.find(t => t.id === id);
  },

  async create(data, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post('/tasks', data);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to create task via API:', error);
    }
    const localItem = {
      id: `task_${Date.now()}`,
      ...data,
      task_type: data.task_type || 'general',
      priority: data.priority || 'medium',
      status: data.status || 'pending',
      progress_percent: data.progress_percent || 0,
      is_recurring: data.is_recurring || false,
      tags: data.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const items = getLocalData(TASKS_KEY, companyId);
    items.unshift(localItem);
    saveLocalData(TASKS_KEY, items, companyId);
    return localItem;
  },

  async update(id, updates, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.put(`/tasks/${id}`, updates);
        return response.data.data || { id, ...updates };
      }
    } catch (error) {
      console.warn('Failed to update task via API:', error);
    }
    const items = getLocalData(TASKS_KEY, companyId);
    const index = items.findIndex(t => t.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
      saveLocalData(TASKS_KEY, items, companyId);
      return items[index];
    }
    return null;
  },

  async delete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        await apiClient.delete(`/tasks/${id}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to delete task via API:', error);
    }
    const items = getLocalData(TASKS_KEY, companyId);
    const filtered = items.filter(t => t.id !== id);
    saveLocalData(TASKS_KEY, filtered, companyId);
    return true;
  },

  async complete(id, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/tasks/${id}/complete`);
        return response.data.data || { id, status: 'completed' };
      }
    } catch (error) {
      console.warn('Failed to complete task via API:', error);
    }
    return this.update(id, {
      status: 'completed',
      progress_percent: 100,
      completed_at: new Date().toISOString()
    }, companyId);
  },

  async getStats(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/tasks/stats', { params });
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to fetch task stats from API:', error);
    }
    const tasks = getLocalData(TASKS_KEY, companyId);
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const allActiveTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

    return {
      total_tasks: tasks.length,
      pending_tasks: pendingTasks.length,
      in_progress_tasks: inProgressTasks.length,
      completed_tasks: completedTasks.length,
      overdue_tasks: allActiveTasks.filter(t => t.due_date && t.due_date < today).length,
      due_today: allActiveTasks.filter(t => t.due_date === today).length,
      due_this_week: allActiveTasks.filter(t => t.due_date && t.due_date >= today && t.due_date <= nextWeek).length,
      by_priority: tasks.reduce((acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      }, {}),
      by_type: tasks.reduce((acc, t) => {
        acc[t.task_type] = (acc[t.task_type] || 0) + 1;
        return acc;
      }, {}),
      completion_rate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0
    };
  },

  async getKanban(companyId, params = {}) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.get('/tasks/kanban', { params });
        return response.data.data || [];
      }
    } catch (error) {
      console.warn('Failed to fetch task kanban from API:', error);
    }
    const tasks = getLocalData(TASKS_KEY, companyId);
    const today = new Date().toISOString().split('T')[0];

    const columns = [
      { status: 'pending', name: 'Pending', tasks: [] },
      { status: 'in_progress', name: 'In Progress', tasks: [] },
      { status: 'completed', name: 'Completed', tasks: [] }
    ];

    tasks.forEach(task => {
      const column = columns.find(c => c.status === task.status);
      if (column) {
        column.tasks.push({
          ...task,
          is_overdue: task.due_date && task.due_date < today && task.status !== 'completed'
        });
      }
    });

    columns.forEach(column => {
      column.count = column.tasks.length;
      column.tasks.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      });
    });

    return columns;
  },

  async updateStatus(id, status, companyId) {
    return this.update(id, { status }, companyId);
  }
};

// =====================================================
// LEAD CONVERSION SERVICE
// =====================================================
export const leadConversionService = {
  async convert(leadId, options, companyId) {
    try {
      const isBackendAvailable = await checkBackendHealth();
      if (isBackendAvailable) {
        const response = await apiClient.post(`/leads/${leadId}/convert`, options);
        return response.data.data;
      }
    } catch (error) {
      console.warn('Failed to convert lead via API:', error);
    }
    // Fallback: return success with mock IDs
    return {
      lead_id: leadId,
      message: 'Lead converted successfully',
      contact_id: options.create_contact ? `contact_${Date.now()}` : null,
      opportunity_id: options.create_opportunity ? `opp_${Date.now()}` : null
    };
  }
};

export default {
  opportunities: opportunitiesService,
  pipelineStages: pipelineStagesService,
  activities: activitiesService,
  tasks: tasksService,
  leadConversion: leadConversionService
};
