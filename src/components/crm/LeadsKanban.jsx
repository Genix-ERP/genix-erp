import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Kanban, Phone, Mail, Calendar, User, Building, Target,
  Loader2, AlertCircle, Pencil, Trash2, MoreVertical,
  PhoneCall, Clock, CheckCircle, XCircle, UserPlus, Plus,
  GripVertical, Settings2, Trophy, ThumbsDown, X
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
import { pipelineStagesService } from "@/api/services/crm";

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

  // Enriched stages
  const stages = useMemo(() =>
    [...stageList]
      .sort((a, b) => a.sequence - b.sequence)
      .map(stage => {
        const color = resolveColor(stage.color);
        const Icon = STAGE_ICONS[stage.code] || STAGE_ICONS[stage.id] || Target;
        return { ...stage, displayName: stage.name, cc: color, icon: Icon };
      }),
    [stageList]
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
    const updates = { name: editForm.name.trim(), color: editForm.color, is_won: editForm.is_won, is_lost: editForm.is_lost };
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
    }
  }, [editForm, editModal.stage, companyId]);

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
      setKanbanState(prev => ({ ...prev, error: 'Failed to create stage: ' + (e.response?.data?.error?.message || e.message) }));
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
      // Optimistic reorder
      let reordered;
      setStageList(prev => {
        const sorted = [...prev].sort((a, b) => a.sequence - b.sequence);
        const [moved] = sorted.splice(source.index, 1);
        sorted.splice(destination.index, 0, moved);
        reordered = sorted.map((s, i) => ({ ...s, sequence: i }));
        return reordered;
      });
      // Persist each stage's new sequence to backend
      if (reordered) {
        reordered.forEach(s => {
          pipelineStagesService.update(s.id, { sequence: s.sequence }, companyId).catch(e => {
            console.warn('Failed to update stage sequence:', e);
          });
        });
      }
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
  }, [kanbanState.leads, onUpdateLead, companyId]);

  // --- Lead Card ---
  const LeadCard = useCallback(({ lead, isUpdating }) => (
    <Card className="bg-white hover:shadow-lg transition-all duration-200 cursor-grab active:cursor-grabbing relative shadow-sm group">
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
                  <Pencil className="w-4 h-4 mr-2" />{t('edit')}
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
              <Calendar className="w-3 h-3" /><span>{new Date(lead.created_at).toLocaleDateString()}</span>
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
              <div className="text-center bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                <div className="text-lg font-bold text-blue-700">{kanbanState.leads.length}</div>
                <div className="text-[10px] text-slate-600">{t('total_leads') || 'Total'}</div>
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
    </div>
  );
}
