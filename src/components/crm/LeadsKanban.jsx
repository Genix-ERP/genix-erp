import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Kanban, Phone, Mail, Calendar, User, Building, Target,
  Loader2, AlertCircle, Edit, Trash2, MoreVertical,
  PhoneCall, Clock, CheckCircle, XCircle, UserPlus, Plus,
  GripVertical, Settings2, Trophy, ThumbsDown, X,
  ChevronDown, ChevronUp, Bell, CalendarDays, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { useCompany } from "@/components/contexts/CompanyContext";
import { pipelineStagesService, activitiesService } from "@/api/services/crm";
import { leadsService } from "@/api/services/leads";
import { formatDate, formatDateTime } from '@/utils/formatDate';

// Portal for dragged cards
const PortalAwareItem = ({ provided, snapshot, children }) => {
  const child = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={provided.draggableProps.style}
      className={snapshot.isDragging ? 'ring-2 ring-blue-400 rounded-lg shadow-2xl' : ''}
    >
      {children}
    </div>
  );
  if (!snapshot.isDragging) return child;
  return ReactDOM.createPortal(child, document.body);
};

// Portal for dragged stage columns (fixes offset in overflow-x-auto containers)
const PortalAwareStage = ({ provided, snapshot, dragHandleProps, children }) => {
  const child = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={provided.draggableProps.style}
      className={`flex flex-col min-w-[260px] w-[260px] flex-shrink-0 rounded-xl overflow-hidden border bg-white ${
        snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-400 opacity-95' : 'border-slate-200'
      }`}
    >
      {children(dragHandleProps)}
    </div>
  );
  if (!snapshot.isDragging) return child;
  return ReactDOM.createPortal(child, document.body);
};

// Color presets
const STAGE_COLORS = [
  { id: 'blue', bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', gradient: 'from-blue-500 to-blue-600' },
  { id: 'amber', bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', gradient: 'from-amber-500 to-amber-600' },
  { id: 'purple', bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', gradient: 'from-purple-500 to-purple-600' },
  { id: 'green', bg: 'bg-green-500', light: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', gradient: 'from-green-500 to-green-600' },
  { id: 'red', bg: 'bg-red-500', light: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', gradient: 'from-red-500 to-red-600' },
  { id: 'teal', bg: 'bg-teal-500', light: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', gradient: 'from-teal-500 to-teal-600' },
  { id: 'pink', bg: 'bg-pink-500', light: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', gradient: 'from-pink-500 to-pink-600' },
  { id: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', gradient: 'from-indigo-500 to-indigo-600' },
  { id: 'orange', bg: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', gradient: 'from-orange-500 to-orange-600' },
  { id: 'cyan', bg: 'bg-cyan-500', light: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', gradient: 'from-cyan-500 to-cyan-600' },
];

const STAGE_ICONS = {
  new: UserPlus,
  contacted: Phone,
  in_progress: Clock,
  qualified: CheckCircle,
  lost: XCircle,
};

const DEFAULT_STAGES = [
  { id: 'new', name: 'New', color: 'blue', sequence: 0, is_won: false, is_lost: false, is_folded: false },
  { id: 'contacted', name: 'Contacted', color: 'amber', sequence: 1, is_won: false, is_lost: false, is_folded: false },
  { id: 'in_progress', name: 'In Progress', color: 'purple', sequence: 2, is_won: false, is_lost: false, is_folded: false },
  { id: 'qualified', name: 'Qualified', color: 'green', sequence: 3, is_won: true, is_lost: false, is_folded: false },
  { id: 'lost', name: 'Lost', color: 'red', sequence: 4, is_won: false, is_lost: true, is_folded: false },
];

// Default stage codes that have translations available.
// If a stage has a default code AND no custom_name override, we show the translated version.
// If the user edited the name (custom_name is set), we show their custom name in all languages.
const DEFAULT_STAGE_CODES = new Set(['new', 'contacted', 'in_progress', 'qualified', 'lost']);

function getColor(colorId) {
  return STAGE_COLORS.find(c => c.id === colorId) || STAGE_COLORS[0];
}

// Generate code from name for backend
function generateCode(name) {
  let code = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!code) code = 'stage_' + Date.now();
  return code;
}

// Map backend color (hex or color name) to our Tailwind color config
function resolveColor(color) {
  if (!color) return STAGE_COLORS[0];
  // If it's one of our color IDs
  const found = STAGE_COLORS.find(c => c.id === color);
  if (found) return found;
  // Default
  return STAGE_COLORS[0];
}

export default function LeadsKanban({
  leads = [],
  onUpdateLead,
  onEditLead,
  onDeleteLead,
  onCallLead,
  onAddLead,
  language = 'en'
}) {
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;

  // Stage state - loaded from backend API
  const [stageList, setStageList] = useState(DEFAULT_STAGES);
  const [stagesLoading, setStagesLoading] = useState(true);

  // Edit modal
  const [editModal, setEditModal] = useState({ open: false, stage: null });
  const [editForm, setEditForm] = useState({ name: '', color: 'blue', is_won: false, is_lost: false });

  // Add modal
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', color: 'blue', is_won: false, is_lost: false });

  // Lead detail modal — opens when the user clicks a lead card body.
  // Holds the lead being viewed and an optional click guard so a drag
  // gesture doesn't accidentally open the detail modal too.
  const [leadDetailModal, setLeadDetailModal] = useState({ open: false, lead: null });
  // Audit logs for the lead currently shown in the detail modal —
  // moved here from the Edit Lead form so the change history is
  // visible during the read-only view rather than buried inside the
  // edit dialog.
  const [leadDetailAuditLogs, setLeadDetailAuditLogs] = useState([]);
  const [leadDetailHistoryOpen, setLeadDetailHistoryOpen] = useState(false);

  // Scheduled follow-ups for the lead being viewed. Each item is a
  // CRM activity (call/meeting/email/follow_up) created via the
  // structured "Schedule follow-up" panel in LeadForm. We fetch on
  // detail-modal open and refresh after marking-completed.
  const [leadDetailFollowups, setLeadDetailFollowups] = useState([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);

  const refreshFollowups = useCallback(async (leadId) => {
    if (!leadId) return;
    setFollowupsLoading(true);
    try {
      const list = await activitiesService.list(companyId, { lead_id: leadId, limit: 50 });
      // Filter on the client to be safe — list endpoint may not honor lead_id
      // depending on backend behavior. Sort upcoming/planned first by date.
      const items = (Array.isArray(list) ? list : []).filter(
        (a) => a.lead_id === leadId
      );
      items.sort((a, b) => {
        const da = new Date(a.start_datetime || a.reminder_datetime || a.created_at).getTime();
        const db = new Date(b.start_datetime || b.reminder_datetime || b.created_at).getTime();
        return da - db;
      });
      setLeadDetailFollowups(items);
    } catch (err) {
      console.warn('Failed to fetch follow-ups:', err);
      setLeadDetailFollowups([]);
    } finally {
      setFollowupsLoading(false);
    }
  }, [companyId]);

  // Fetch audit logs + follow-ups whenever the detail modal opens for
  // a different lead. Uses the same `leadsService.getAuditLogs(id)`
  // the Edit Lead form was using, plus activitiesService.list filtered
  // by lead_id for the scheduled follow-ups list.
  useEffect(() => {
    if (!leadDetailModal.open || !leadDetailModal.lead?.id) {
      setLeadDetailAuditLogs([]);
      setLeadDetailHistoryOpen(false);
      setLeadDetailFollowups([]);
      return;
    }
    leadsService
      .getAuditLogs(leadDetailModal.lead.id)
      .then((logs) => setLeadDetailAuditLogs(Array.isArray(logs) ? logs : []))
      .catch(() => setLeadDetailAuditLogs([]));
    refreshFollowups(leadDetailModal.lead.id);
  }, [leadDetailModal.open, leadDetailModal.lead?.id, refreshFollowups]);

  // Mark a follow-up as completed (status='completed') — keeps the row
  // in the list (so users can see it was done) but greys it out.
  const handleCompleteFollowup = async (activityId) => {
    try {
      await activitiesService.update(activityId, { status: 'completed' }, companyId);
      if (leadDetailModal.lead?.id) refreshFollowups(leadDetailModal.lead.id);
    } catch (err) {
      console.warn('Failed to complete follow-up:', err);
    }
  };

  // Field-label + value-formatter helpers for the change-history list,
  // matching the formatting that used to live inside LeadForm.
  const detailFieldLabels = {
    contact_name: t('contact_name'),
    company_name: t('company_name'),
    email: t('email'),
    phone: t('phone'),
    status: t('status'),
    source: t('source'),
    notes: t('notes'),
    assigned_to: t('sales_person'),
    expected_value: t('expected_value'),
  };
  const detailFormatFieldValue = (field, value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'status' || field === 'source') return t(value) || value;
    return String(value);
  };

  // Seed defaults for this org if none exist (handles new orgs created after migrations)
  const seedDefaultsForOrg = useCallback(async () => {
    const results = [];
    for (const stage of DEFAULT_STAGES) {
      try {
        const result = await pipelineStagesService.create({
          name: stage.name,
          code: stage.id,
          color: stage.color,
          sequence: stage.sequence,
          is_won: stage.is_won,
          is_lost: stage.is_lost,
          pipeline_type: 'lead',
          organization_id: companyId,
          probability: stage.is_won ? 100 : (stage.is_lost ? 0 : 50),
        }, companyId);
        if (result) results.push(result);
      } catch (e) {
        // Ignore duplicate key errors — stage already exists
      }
    }
    return results;
  }, [companyId]);

  // Load stages from backend
  const loadStagesFromAPI = useCallback(async () => {
    setStagesLoading(true);
    try {
      let data = await pipelineStagesService.list(companyId, 'lead');
      if (!data || data.length === 0) {
        // No lead stages for this org — seed defaults via API
        await seedDefaultsForOrg();
        // Re-fetch to get the actual DB records with real UUIDs
        try { data = await pipelineStagesService.list(companyId, 'lead'); } catch (_) { /* ignore */ }
      }
      if (data && data.length > 0) {
        setStageList(data.map(s => ({
          ...s,
          is_won: s.is_won ?? false,
          is_lost: s.is_lost ?? false,
          is_folded: false,
        })));
      } else {
        setStageList(DEFAULT_STAGES);
      }
    } catch (e) {
      console.warn('Failed to load lead stages:', e);
      setStageList(DEFAULT_STAGES);
    } finally {
      setStagesLoading(false);
    }
  }, [companyId, seedDefaultsForOrg]);

  useEffect(() => {
    loadStagesFromAPI();
  }, [loadStagesFromAPI]);

  const [kanbanState, setKanbanState] = useState({
    leads: [],
    isDragging: false,
    dragType: null,
    updatingIds: new Set(),
    error: null
  });

  useEffect(() => {
    if (Array.isArray(leads)) {
      const uniqueLeads = Array.from(
        new Map(leads.map(lead => [lead.id, { ...lead, id: String(lead.id) }])).values()
      );
      setKanbanState(prev => ({ ...prev, leads: uniqueLeads }));
    }
  }, [leads]);

  // Enriched stages with translation support
  const stages = useMemo(() =>
    [...stageList]
      .sort((a, b) => a.sequence - b.sequence)
      .map(stage => {
        const color = resolveColor(stage.color);
        const Icon = STAGE_ICONS[stage.code] || STAGE_ICONS[stage.id] || Target;
        const code = stage.code || stage.id;
        // If stage has a custom_name (user edited), always show that.
        // If it's a known default code with no custom name, use translation.
        // Otherwise fall back to the name field.
        const hasCustomName = !!stage.custom_name;
        const isTranslatable = DEFAULT_STAGE_CODES.has(code);
        const displayName = hasCustomName ? stage.custom_name : (isTranslatable ? t(code) : stage.name);
        return { ...stage, displayName, cc: color, icon: Icon };
      }),
    [stageList, t]
  );

  // Match leads to stages by code (leads have status field that matches stage code)
  const stageData = useMemo(() => {
    const data = {};
    stages.forEach(stage => {
      const stageCode = stage.code || stage.id;
      const sl = kanbanState.leads.filter(lead => (lead.status || 'new') === stageCode);
      data[stage.id] = { leads: sl, count: sl.length, code: stageCode };
    });
    const knownCodes = new Set(stages.map(s => s.code || s.id));
    const unknown = kanbanState.leads.filter(l => !knownCodes.has(l.status || 'new'));
    if (unknown.length > 0 && stages.length > 0) {
      const first = stages[0].id;
      if (data[first]) {
        data[first].leads = [...data[first].leads, ...unknown];
        data[first].count += unknown.length;
      }
    }
    return data;
  }, [kanbanState.leads, stages]);

  // --- Stage CRUD ---
  const openEditModal = useCallback((stage) => {
    setEditForm({ name: stage.name, color: stage.color, is_won: stage.is_won, is_lost: stage.is_lost });
    setEditModal({ open: true, stage });
  }, []);

  const saveEditModal = useCallback(async () => {
    if (!editForm.name.trim() || !editModal.stage) return;
    const trimmedName = editForm.name.trim();
    const code = editModal.stage.code || editModal.stage.id;
    // If user changed the name on a default stage, store as custom_name.
    // If they cleared it back or it's a non-default stage, custom_name tracks the display name.
    const isDefaultCode = DEFAULT_STAGE_CODES.has(code);
    const customName = isDefaultCode ? trimmedName : null;
    const updates = {
      name: trimmedName,
      custom_name: customName,
      color: editForm.color,
      is_won: editForm.is_won,
      is_lost: editForm.is_lost,
    };
    // Optimistic update
    setStageList(prev => prev.map(s =>
      s.id === editModal.stage.id ? { ...s, ...updates } : s
    ));
    setEditModal({ open: false, stage: null });
    // Persist to backend
    try {
      await pipelineStagesService.update(editModal.stage.id, updates, companyId);
    } catch (e) {
      console.warn('Failed to update stage:', e);
      // Revert optimistic update on failure
      loadStagesFromAPI();
    }
  }, [editForm, editModal.stage, companyId, loadStagesFromAPI]);

  const openAddModal = useCallback(() => {
    const usedColors = new Set(stageList.map(s => s.color));
    const nextColor = STAGE_COLORS.find(c => !usedColors.has(c.id))?.id || 'blue';
    setAddForm({ name: '', color: nextColor, is_won: false, is_lost: false });
    setAddModal(true);
  }, [stageList]);

  const saveAddModal = useCallback(async () => {
    if (!addForm.name.trim()) return;
    // Generate a unique code — append suffix if code already exists
    let code = generateCode(addForm.name);
    const existingCodes = new Set(stageList.map(s => s.code));
    if (existingCodes.has(code)) {
      let suffix = 2;
      while (existingCodes.has(code + '_' + suffix)) suffix++;
      code = code + '_' + suffix;
    }
    const maxSeq = Math.max(...stageList.map(s => s.sequence), -1);
    const newStage = {
      name: addForm.name.trim(),
      code,
      color: addForm.color,
      sequence: maxSeq + 1,
      is_won: addForm.is_won,
      is_lost: addForm.is_lost,
      pipeline_type: 'lead',
      organization_id: companyId,
      probability: addForm.is_won ? 100 : (addForm.is_lost ? 0 : 50),
    };
    setAddModal(false);
    try {
      const created = await pipelineStagesService.create(newStage, companyId);
      if (created) {
        setStageList(prev => [...prev, { ...created, is_folded: false }]);
      }
    } catch (e) {
      console.warn('Failed to create stage:', e);
      setKanbanState(prev => ({ ...prev, error: t('failed_to_create_stage') || 'Failed to create stage' }));
      // Reload stages from backend to stay in sync
      loadStagesFromAPI();
    }
  }, [addForm, stageList, companyId]);

  const handleDeleteStage = useCallback(async (stageId) => {
    if (stageList.length <= 1) return;
    const stageToDelete = stageList.find(s => s.id === stageId);
    const stageCode = stageToDelete?.code || stageId;
    const stgLeads = kanbanState.leads.filter(l => (l.status || 'new') === stageCode);
    const remaining = stageList.filter(s => s.id !== stageId);
    if (stgLeads.length > 0 && remaining.length > 0) {
      const targetCode = remaining[0].code || remaining[0].id;
      stgLeads.forEach(lead => {
        if (onUpdateLead) onUpdateLead({ ...lead, status: targetCode });
      });
      setKanbanState(prev => ({
        ...prev,
        leads: prev.leads.map(l => (l.status || 'new') === stageCode ? { ...l, status: targetCode } : l)
      }));
    }
    setStageList(prev => prev.filter(s => s.id !== stageId));
    setEditModal({ open: false, stage: null });
    try {
      await pipelineStagesService.delete(stageId, companyId);
    } catch (e) {
      console.warn('Failed to delete stage:', e);
      // Revert on failure — reload from backend
      loadStagesFromAPI();
    }
  }, [kanbanState.leads, stageList, onUpdateLead, companyId]);

  const handleToggleFold = useCallback((stageId) => {
    setStageList(prev => prev.map(s => s.id === stageId ? { ...s, is_folded: !s.is_folded } : s));
  }, []);

  // --- Drag and drop ---
  const handleDragStart = useCallback((start) => {
    setKanbanState(prev => ({
      ...prev, isDragging: true, dragType: start.type === 'STAGE' ? 'stage' : 'card', error: null
    }));
  }, []);

  const handleDragEnd = useCallback((result) => {
    setKanbanState(prev => ({ ...prev, isDragging: false, dragType: null }));
    if (!result.destination) return;
    const { draggableId, source, destination, type } = result;

    if (type === 'STAGE') {
      if (source.index === destination.index) return;
      // Compute the reordered list synchronously OUTSIDE of setState.
      // (React 18 batches state updates and the updater function isn't
      // guaranteed to run before the next line of this handler — the
      // previous version assigned `reordered` inside the updater and
      // then checked it on the very next line, which left it as
      // `undefined` and silently skipped the PUT requests, so
      // sequences never persisted to the backend.)
      const sorted = [...stageList].sort((a, b) => a.sequence - b.sequence);
      const [moved] = sorted.splice(source.index, 1);
      sorted.splice(destination.index, 0, moved);
      const reordered = sorted.map((s, i) => ({ ...s, sequence: i }));
      // Optimistic UI update.
      setStageList(reordered);
      // Persist each stage's new sequence to the backend.
      reordered.forEach(s => {
        pipelineStagesService.update(s.id, { sequence: s.sequence }, companyId).catch(e => {
          console.warn('Failed to update stage sequence:', e);
        });
      });
      return;
    }

    // Card drag between stages — droppableId is the stage code
    if (source.droppableId === destination.droppableId) return;
    const lead = kanbanState.leads.find(l => String(l.id) === String(draggableId));
    if (!lead) return;
    const newStatus = destination.droppableId;
    setKanbanState(prev => ({
      ...prev,
      leads: prev.leads.map(l => String(l.id) === String(draggableId) ? { ...l, status: newStatus } : l)
    }));
    if (onUpdateLead) onUpdateLead({ ...lead, status: newStatus });
  }, [kanbanState.leads, onUpdateLead, companyId, stageList]);

  // --- Lead Card ---
  const LeadCard = useCallback(({ lead, isUpdating }) => (
    <Card
      className="bg-white hover:shadow-lg transition-all duration-200 cursor-grab active:cursor-grabbing relative shadow-sm group"
      // Card body click → open detail modal. The dropdown menu uses
      // stopPropagation so its actions don't double-fire this handler.
      // For drag gestures, react-beautiful-dnd consumes the pointer
      // events past a movement threshold so click won't fire after a
      // real drag.
      onClick={() => setLeadDetailModal({ open: true, lead })}
    >
      {isUpdating && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-lg z-10">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        </div>
      )}
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm text-slate-900 truncate">{lead.contact_name || lead.name}</h4>
              {lead.company_name && (
                <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                  <Building className="w-3 h-3" />{lead.company_name}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {canUpdate(MODULES.CUSTOMERS) && onCallLead && lead.phone && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCallLead(lead); }}>
                  <PhoneCall className="w-4 h-4 mr-2 text-green-600" />{t('call')}
                </DropdownMenuItem>
              )}
              {canUpdate(MODULES.CUSTOMERS) && onEditLead && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditLead(lead); }}>
                  <Edit className="w-4 h-4 mr-2" />{t('edit')}
                </DropdownMenuItem>
              )}
              {canDelete(MODULES.CUSTOMERS) && onDeleteLead && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteLead(lead); }} className="text-red-600 focus:text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />{t('delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-1">
          {lead.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Mail className="w-3 h-3 text-slate-400" /><span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Phone className="w-3 h-3 text-slate-400" /><span>{lead.phone}</span>
            </div>
          )}
          {lead.source && (
            <Badge variant="outline" className="text-xs mt-1">{t(lead.source) || lead.source}</Badge>
          )}
          {lead.created_at && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="w-3 h-3" /><span>{formatDate(lead.created_at)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ), [onCallLead, onEditLead, onDeleteLead, t, canUpdate, canDelete]);

  // Stage form used by both edit and add modals
  const renderStageForm = (form, setFormFn, onSave, onCancel, title, saveLabel, showDelete, stageId) => (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 py-4">
        <div className="space-y-2">
          <Label>{t('name') || 'Name'}</Label>
          <Input
            value={form.name}
            onChange={(e) => setFormFn(prev => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
            placeholder={t('stage_name') || 'Stage name'}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>{t('color') || 'Color'}</Label>
          <div className="flex flex-wrap gap-2">
            {STAGE_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFormFn(prev => ({ ...prev, color: c.id }))}
                className={`w-8 h-8 rounded-full ${c.bg} transition-all ${
                  form.color === c.id ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-green-600" />
              <div>
                <Label>{t('is_won_stage') || 'Won Stage'}</Label>
                <p className="text-xs text-slate-500">{t('won_stage_desc') || 'Leads here are successfully converted'}</p>
              </div>
            </div>
            <Switch
              checked={form.is_won}
              onCheckedChange={(v) => setFormFn(prev => ({ ...prev, is_won: v, is_lost: v ? false : prev.is_lost }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <div>
                <Label>{t('is_lost_stage') || 'Lost Stage'}</Label>
                <p className="text-xs text-slate-500">{t('lost_stage_desc') || 'Leads here are considered lost'}</p>
              </div>
            </div>
            <Switch
              checked={form.is_lost}
              onCheckedChange={(v) => setFormFn(prev => ({ ...prev, is_lost: v, is_won: v ? false : prev.is_won }))}
            />
          </div>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between">
        <div>
          {showDelete && stageList.length > 1 && (
            <Button variant="destructive" size="sm" onClick={() => handleDeleteStage(stageId)}>
              <Trash2 className="w-4 h-4 mr-1" />{t('delete') || 'Delete'}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>{t('cancel') || 'Cancel'}</Button>
          <Button onClick={onSave} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
            {saveLabel}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );

  return (
    <div className="space-y-4">
      {kanbanState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{kanbanState.error}</span>
          <button onClick={() => setKanbanState(prev => ({ ...prev, error: null }))} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pipeline board */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl overflow-visible">
        <CardHeader className="border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-lg">
                <Kanban className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold">{t('leads_pipeline') || 'Leads Pipeline'}</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={openAddModal}>
                <Plus className="w-4 h-4 mr-1" />{t('add_stage') || 'Add Stage'}
              </Button>
              {canCreate(MODULES.CUSTOMERS) && onAddLead && (
                <Button size="sm" onClick={onAddLead} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                  <UserPlus className="w-4 h-4 mr-1" />{t('add_lead') || 'Add Lead'}
                </Button>
              )}
              <div className="flex items-center gap-2.5 bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-200/70 shadow-sm">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-600">
                  <Target className="w-4 h-4" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-base font-bold text-blue-700 tabular-nums">{kanbanState.leads.length}</span>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5">{t('total_leads') || 'Total'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <Droppable droppableId="stages-board" direction="horizontal" type="STAGE">
              {(boardProvided) => (
                <div
                  ref={boardProvided.innerRef}
                  {...boardProvided.droppableProps}
                  className="flex gap-3 overflow-x-auto pb-2"
                >
                  {stages.map((stage, stageIndex) => {
                    const stageCode = stage.code || stage.id;
                    const { leads: stageLeads, count } = stageData[stage.id] || { leads: [], count: 0 };
                    const { light, border, text, gradient } = stage.cc;

                    return (
                      <Draggable key={stage.id} draggableId={`stage-${stage.id}`} index={stageIndex}>
                        {(stageProvided, stageSnapshot) => (
                          <PortalAwareStage provided={stageProvided} snapshot={stageSnapshot} dragHandleProps={stageProvided.dragHandleProps}>
                            {(handleProps) => (
                            <>
                            {/* Stage header - compact, drag handle flush with title */}
                            <div className={`${light} px-2 py-2 flex items-center gap-1`}>
                              <div
                                {...handleProps}
                                className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5 flex-shrink-0"
                              >
                                <GripVertical className={`w-4 h-4 ${text} opacity-40`} />
                              </div>
                              <stage.icon className={`w-4 h-4 ${text} flex-shrink-0`} />
                              <span className={`font-semibold text-sm ${text} capitalize truncate flex-1`}>
                                {stage.displayName}
                              </span>
                              {stage.is_won && <Trophy className="w-3.5 h-3.5 text-green-600 flex-shrink-0" title="Won stage" />}
                              {stage.is_lost && <ThumbsDown className="w-3.5 h-3.5 text-red-600 flex-shrink-0" title="Lost stage" />}
                              <Badge className={`bg-gradient-to-r ${gradient} text-white border-0 text-xs px-1.5 py-0 h-5`}>
                                {count}
                              </Badge>
                              <button
                                onClick={() => openEditModal(stage)}
                                className={`p-1 rounded hover:bg-black/10 ${text} opacity-40 hover:opacity-100 transition-opacity flex-shrink-0`}
                                title={t('edit_stage') || 'Edit stage'}
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Cards area */}
                            {!stage.is_folded ? (
                              <Droppable droppableId={stageCode} type="CARD">
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex flex-col gap-2 min-h-[300px] p-2 transition-colors ${
                                      snapshot.isDraggingOver
                                        ? `${light} border-t-2 border-dashed ${border}`
                                        : 'bg-slate-50/50 border-t border-slate-100'
                                    }`}
                                  >
                                    {stageLeads.map((lead, index) => {
                                      const isUpdating = kanbanState.updatingIds.has(String(lead.id));
                                      return (
                                        <Draggable key={String(lead.id)} draggableId={String(lead.id)} index={index} isDragDisabled={isUpdating}>
                                          {(prov, snap) => (
                                            <PortalAwareItem provided={prov} snapshot={snap}>
                                              <LeadCard lead={lead} isUpdating={isUpdating} />
                                            </PortalAwareItem>
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                    {provided.placeholder}
                                    {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                                      <div className="text-center py-8 text-slate-400 text-xs">
                                        <Target className="w-6 h-6 mx-auto mb-1 opacity-30" />
                                        <p>{t('drop_here') || 'Drop here'}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Droppable>
                            ) : (
                              <Droppable droppableId={stageCode} type="CARD">
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`p-2 cursor-pointer ${snapshot.isDraggingOver ? light : 'bg-slate-50/50'}`}
                                    onClick={() => handleToggleFold(stage.id)}
                                  >
                                    <div className="text-center py-2 text-slate-400 text-xs">
                                      {count} {t('leads') || 'leads'} &middot; {t('click_to_expand') || 'Click to expand'}
                                    </div>
                                    <div className="hidden">{provided.placeholder}</div>
                                  </div>
                                )}
                              </Droppable>
                            )}
                            </>
                            )}
                          </PortalAwareStage>
                        )}
                      </Draggable>
                    );
                  })}
                  {boardProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Edit Stage Modal */}
      <Dialog open={editModal.open} onOpenChange={(open) => { if (!open) setEditModal({ open: false, stage: null }); }}>
        {renderStageForm(
          editForm, setEditForm, saveEditModal,
          () => setEditModal({ open: false, stage: null }),
          t('edit_stage') || 'Edit Stage',
          t('save_changes') || 'Save Changes',
          true, editModal.stage?.id
        )}
      </Dialog>

      {/* Add Stage Modal */}
      <Dialog open={addModal} onOpenChange={setAddModal}>
        {renderStageForm(
          addForm, setAddForm, saveAddModal,
          () => setAddModal(false),
          t('add_stage') || 'Add Stage',
          t('add') || 'Add',
          false, null
        )}
      </Dialog>

      {/* Lead Detail Modal — opens on lead-card click. Read-only view
          with action shortcuts (Call / Edit / Delete) that dispatch to
          the existing handlers passed in from the parent. */}
      <Dialog
        open={leadDetailModal.open}
        onOpenChange={(open) => { if (!open) setLeadDetailModal({ open: false, lead: null }); }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('lead_details')}
            </DialogTitle>
          </DialogHeader>
          {leadDetailModal.lead && (() => {
            const lead = leadDetailModal.lead;
            const stage = stageList.find(s => s.code === lead.status || s.id === lead.stage_id);
            return (
              <>
              <div className="space-y-5 py-4 px-6 overflow-y-auto flex-1 min-h-0">
                {/* Header — name, company, stage badge */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 truncate">
                      {lead.contact_name || lead.name || '—'}
                    </h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                      <Building className="w-3.5 h-3.5 flex-shrink-0" />
                      {lead.company_name || t('no_company')}
                    </p>
                    {stage && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {stage.custom_name || stage.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Contact information */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                    {t('contact_information')}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {lead.email
                        ? <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline truncate">{lead.email}</a>
                        : <span className="text-slate-400 italic">{t('no_email')}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {lead.phone
                        ? <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a>
                        : <span className="text-slate-400 italic">{t('no_phone')}</span>}
                    </div>
                  </div>
                </div>

                {/* Additional information */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                    {t('additional_information')}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">{t('source') || 'Source'}</div>
                      <div className="text-slate-800">
                        {lead.source ? (t(lead.source) || lead.source) : <span className="text-slate-400 italic">{t('no_source')}</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">{t('created') || 'Created'}</div>
                      <div className="text-slate-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {lead.created_at ? formatDate(lead.created_at) : '—'}
                      </div>
                    </div>
                    {lead.updated_at && (
                      <div className="col-span-2">
                        <div className="text-xs text-slate-500 mb-0.5">{t('updated') || 'Updated'}</div>
                        <div className="text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(lead.updated_at)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes & follow-ups — both kinds of activities live
                    in the same list. Scheduled follow-ups (call /
                    meeting / email with a datetime) fire reminder
                    notifications via the backend worker; notes are
                    free-text comments saved without a schedule. We
                    split them into two visual groups so it's clear
                    which ones still need action. */}
                {(() => {
                  // Only render scheduled-style activities here. Notes
                  // are merged into the Change History timeline below
                  // instead of getting their own section.
                  const isNote = (a) => a.activity_type === 'note';
                  const followups = leadDetailFollowups.filter(a => !isNote(a));

                  return (
                    <>
                      {/* Scheduled follow-ups */}
                      <div className="border-t pt-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                          <Bell className="w-4 h-4 text-[var(--genix-blue)]" />
                          {t('scheduled_followups') || 'Scheduled follow-ups'}
                          {followups.length > 0 && (
                            <span className="text-xs font-normal text-slate-500">
                              ({followups.length})
                            </span>
                          )}
                        </div>

                        {followupsLoading ? (
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t('loading') || 'Loading...'}
                          </div>
                        ) : followups.length === 0 ? (
                          <div className="text-xs text-slate-500 italic">
                            {t('no_followups') || 'No follow-ups scheduled. Add one when editing this lead.'}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {followups.map((act) => {
                              const due = act.start_datetime || act.reminder_datetime;
                              const dueDate = due ? new Date(due) : null;
                              const isPast = dueDate && dueDate.getTime() < Date.now();
                              const isCompleted = act.status === 'completed';
                              const isCancelled = act.status === 'cancelled';
                              const ActionIcon = act.activity_type === 'call' ? Phone
                                : act.activity_type === 'meeting' ? CalendarDays
                                : act.activity_type === 'email' ? Mail
                                : Bell;
                              return (
                                <div
                                  key={act.id}
                                  className={`border rounded-lg p-3 text-sm flex items-start gap-3 ${
                                    isCompleted ? 'bg-slate-50 opacity-60' :
                                    isCancelled ? 'bg-slate-50 opacity-50 line-through' :
                                    isPast ? 'bg-amber-50 border-amber-200' :
                                    'bg-white'
                                  }`}
                                >
                                  <ActionIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                    isCompleted ? 'text-slate-400' :
                                    isPast ? 'text-amber-600' :
                                    'text-[var(--genix-blue)]'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-slate-800">
                                        {t(`action_${act.activity_type === 'follow_up' ? 'other' : act.activity_type}`) ||
                                          act.activity_type}
                                      </span>
                                      {isCompleted && (
                                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                                          {t('completed') || 'Completed'}
                                        </span>
                                      )}
                                      {!isCompleted && !isCancelled && isPast && (
                                        <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                          {t('overdue') || 'Overdue'}
                                        </span>
                                      )}
                                    </div>
                                    {dueDate && (
                                      <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {dueDate.toLocaleString(undefined, { hour12: false })}
                                      </div>
                                    )}
                                    {act.description && (
                                      <div className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">
                                        {act.description}
                                      </div>
                                    )}
                                  </div>
                                  {!isCompleted && !isCancelled && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="flex-shrink-0 h-7 px-2 text-green-700 hover:text-green-800 hover:bg-green-50"
                                      onClick={() => handleCompleteFollowup(act.id)}
                                      title={t('mark_completed') || 'Mark completed'}
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </>
                  );
                })()}

                {/* Unified Change History — merges audit-log diffs and
                    note-type activities into a single chronological
                    timeline. Each entry is either:
                      • a field-change row (from audit_log) with old → new diffs
                      • a note row (from activities where activity_type='note')
                    Sorted desc by created_at so the newest is at the top.
                    Notes used to live in their own "Izohlar" section but
                    the user wanted them rolled into the change-history
                    timeline so all lead activity is in one place. */}
                {(() => {
                  // Build the unified timeline.
                  const noteEntries = leadDetailFollowups
                    .filter(a => a.activity_type === 'note')
                    .map(a => ({
                      kind: 'note',
                      id: `note_${a.id}`,
                      created_at: a.created_at,
                      user_name: a.created_by_name || null,
                      description: a.description || '',
                    }));

                  const auditEntries = leadDetailAuditLogs
                    .map(log => {
                      const oldVals = typeof log.old_values === 'string'
                        ? JSON.parse(log.old_values || '{}')
                        : (log.old_values || {});
                      const newVals = typeof log.new_values === 'string'
                        ? JSON.parse(log.new_values || '{}')
                        : (log.new_values || {});
                      const changedFields = Object.keys(newVals).filter(
                        // 'notes' is excluded because notes are now
                        // stored as separate `activities` (note-type)
                        // and the lead's notes column is always cleared
                        // on save — so the diffs are just noise.
                        k => !['updated_at', 'id', 'company_id', 'tenant_id', 'created_at', 'notes'].includes(k)
                          && JSON.stringify(oldVals[k]) !== JSON.stringify(newVals[k])
                      );
                      if (changedFields.length === 0) return null;
                      return {
                        kind: 'audit',
                        id: `audit_${log.id}`,
                        created_at: log.created_at,
                        user_name: log.user_name || log.user_email,
                        oldVals,
                        newVals,
                        changedFields,
                      };
                    })
                    .filter(Boolean);

                  const timeline = [...noteEntries, ...auditEntries].sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );

                  if (timeline.length === 0) return null;

                  return (
                    <div className="border-t pt-3">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 w-full"
                        onClick={() => setLeadDetailHistoryOpen(o => !o)}
                      >
                        <Clock className="w-4 h-4" />
                        {t('change_history') || "Change history"} ({timeline.length})
                        {leadDetailHistoryOpen
                          ? <ChevronUp className="w-4 h-4 ml-auto" />
                          : <ChevronDown className="w-4 h-4 ml-auto" />}
                      </button>
                      {leadDetailHistoryOpen && (
                        <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                          {timeline.map((entry) => {
                            if (entry.kind === 'note') {
                              return (
                                <div
                                  key={entry.id}
                                  className="border border-amber-200 bg-amber-50/60 rounded-lg p-3 text-sm"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-slate-800 flex items-center gap-1.5">
                                      <Edit className="w-3.5 h-3.5 text-amber-600" />
                                      {entry.user_name || t('action_note') || 'Note'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {entry.created_at ? formatDateTime(entry.created_at) : ''}
                                    </span>
                                  </div>
                                  <div className="text-slate-800 whitespace-pre-wrap text-xs">
                                    {entry.description || '—'}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={entry.id} className="border rounded-lg p-3 bg-slate-50 text-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-slate-800">
                                    {entry.user_name}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatDateTime(entry.created_at)}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {entry.changedFields.map(field => (
                                    <div key={field} className="flex flex-wrap gap-1 text-xs">
                                      <span className="font-medium text-slate-600">
                                        {detailFieldLabels[field] || field}:
                                      </span>
                                      <span className="text-red-600 line-through">
                                        {detailFormatFieldValue(field, entry.oldVals[field])}
                                      </span>
                                      <span className="text-slate-400">&rarr;</span>
                                      <span className="text-green-600">
                                        {detailFormatFieldValue(field, entry.newVals[field])}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
              {/* Sticky action footer — pinned to the bottom of the
                  modal regardless of how tall the body grows. Buttons
                  wrap onto multiple rows if the viewport is narrow so
                  Close stays visible even with long Uzbek labels. */}
              <div className="flex flex-wrap gap-2 justify-end px-6 py-3 border-t bg-white flex-shrink-0">
                {canDelete(MODULES.CUSTOMERS) && onDeleteLead && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      const target = leadDetailModal.lead;
                      setLeadDetailModal({ open: false, lead: null });
                      onDeleteLead(target);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('delete') || 'Delete'}
                  </Button>
                )}
                {canUpdate(MODULES.CUSTOMERS) && onCallLead && lead.phone && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      const target = leadDetailModal.lead;
                      setLeadDetailModal({ open: false, lead: null });
                      onCallLead(target);
                    }}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 gap-2"
                  >
                    <PhoneCall className="w-4 h-4" />
                    {t('call') || 'Call'}
                  </Button>
                )}
                {canUpdate(MODULES.CUSTOMERS) && onEditLead && (
                  <Button
                    type="button"
                    onClick={() => {
                      const target = leadDetailModal.lead;
                      setLeadDetailModal({ open: false, lead: null });
                      onEditLead(target);
                    }}
                    className="gap-2 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90"
                  >
                    <Edit className="w-4 h-4" />
                    {t('edit') || 'Edit'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setLeadDetailModal({ open: false, lead: null })}
                >
                  {t('close') || 'Close'}
                </Button>
              </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
