import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Trophy, XCircle,
  LayoutGrid, List, GripVertical, AlertTriangle, Clock, UserPlus,
} from 'lucide-react';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/components/ui/use-toast';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { pipelinesService, pipelineStagesService } from '@/api/services/crm';
import { leadsService } from '@/api/services/leads';
import { formatDate } from '@/utils/formatDate';
import LeadOutcomeDialogs from './LeadOutcomeDialogs';
import LeadDetailSheet from './LeadDetailSheet';

// Default seeded stage names → translated by code; user-renamed stages show
// their own name (custom_name wins when present).
const DEFAULT_STAGE_NAMES = {
  new: 'New', contacted: 'Contacted', in_progress: 'In Progress',
  qualified: 'Negotiation', won: 'Won', lost: 'Lost',
};

const STAGE_COLORS = {
  blue:    { dot: 'bg-blue-500',    top: 'border-t-blue-400' },
  amber:   { dot: 'bg-amber-500',   top: 'border-t-amber-400' },
  purple:  { dot: 'bg-purple-500',  top: 'border-t-purple-400' },
  green:   { dot: 'bg-green-500',   top: 'border-t-green-400' },
  emerald: { dot: 'bg-emerald-500', top: 'border-t-emerald-400' },
  red:     { dot: 'bg-red-500',     top: 'border-t-red-400' },
  gray:    { dot: 'bg-slate-400',   top: 'border-t-slate-300' },
  teal:    { dot: 'bg-teal-500',    top: 'border-t-teal-400' },
  pink:    { dot: 'bg-pink-500',    top: 'border-t-pink-400' },
};
const COLOR_OPTIONS = Object.keys(STAGE_COLORS);
const stageColor = (c) => STAGE_COLORS[c] || STAGE_COLORS.gray;

const STALE_DAYS = 7;

const daysSince = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const initials = (name) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '•';

// Compact money for the summary chips ("63 000 000" → "63 mln") — the full
// formatted value stays on column headers and cards where there's room.
const compactSum = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${parseFloat((n / 1_000_000_000).toFixed(2))} mlrd`;
  if (abs >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(1))} mln`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)} ming`;
  return `${Math.round(n)}`;
};

// LeadCard lives at module scope on purpose: defined inside PipelineBoard it
// would get a new component identity on every render, and the isDraggingCard
// state flip at drag START would remount every card — replacing the dragged
// DOM node mid-drag and breaking the drag.
function LeadCard({ lead, t, formatCurrency, onOpen }) {
  const stale = daysSince(lead.last_activity_at);
  const isStale = stale != null && stale >= STALE_DAYS && !lead.won_at && !lead.lost_at;
  const noTask = (lead.open_task_count ?? 0) === 0 && !lead.won_at && !lead.lost_at;
  const responsible = lead.responsible_name || lead.assigned_to_name;
  return (
    <div
      onClick={() => onOpen(lead.id)}
      className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{lead.contact_name || lead.name}</p>
          {lead.company_name && (
            <p className="truncate text-xs text-slate-500">{lead.company_name}</p>
          )}
        </div>
        {responsible && (
          <div
            title={responsible}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] text-[10px] font-semibold text-white"
          >
            {initials(responsible)}
          </div>
        )}
      </div>

      {Number(lead.expected_value) > 0 ? (
        <p className="mt-2 text-sm font-bold text-slate-900">
          {formatCurrency ? formatCurrency(Number(lead.expected_value)) : Number(lead.expected_value).toLocaleString()}
        </p>
      ) : (
        <p className="mt-2 text-xs italic text-slate-400">{t('crm_no_amount') || "Summa kiritilmagan"}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {lead.source && (
          <Badge variant="outline" className="h-5 border-slate-200 px-1.5 text-[10px] font-normal text-slate-500">
            {t(lead.source) || lead.source}
          </Badge>
        )}
        {noTask && (
          <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
            <AlertTriangle className="h-3 w-3" />
            {t('crm_no_task') || "Vazifa yo'q"}
          </span>
        )}
        {isStale && (
          <span
            className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"
            title={t('crm_stale_hint') || ''}
          >
            <Clock className="h-3 w-3" />
            {stale} {t('crm_days_short') || 'kun'}
          </span>
        )}
      </div>
    </div>
  );
}

// Portal wrapper so dragged elements render above everything (incl. the
// fixed terminal drop bar, hence the explicit z-index while dragging).
function PortalAware({ provided, snapshot, children, className }) {
  const node = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`${className || ''} ${snapshot.isDragging ? 'z-[9999]' : ''}`}
    >
      {children}
    </div>
  );
  return snapshot.isDragging ? createPortal(node, document.body) : node;
}

export default function PipelineBoard({
  leads = [],
  onRefresh,
  onEditLead,
  onDeleteLead,
  onCallLead,
  onAddLead,
  language = 'uz',
}) {
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const { MODULES, canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const canManageLeads = canUpdate(MODULES.CUSTOMERS);
  // Pipeline/stage CRUD = the "manage pipeline" right (server enforces
  // crm:pipeline:*; module-level UI gate mirrors it on delete-level access)
  const canManagePipeline = canDelete(MODULES.CUSTOMERS);

  const [pipelines, setPipelines] = useState([]);
  const [activePipelineId, setActivePipelineId] = useState(null);
  const [localLeads, setLocalLeads] = useState(leads);
  const [view, setView] = useState('board');
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  // filters
  const [search, setSearch] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // dialogs / panel
  const [wonLead, setWonLead] = useState(null);
  const [lostLead, setLostLead] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [stageDialog, setStageDialog] = useState(null); // {mode:'add'|'edit', stage?}
  const [stageForm, setStageForm] = useState({ name: '', color: 'blue', probability: 50 });
  const [pipelineDialog, setPipelineDialog] = useState(false);
  const [pipelineName, setPipelineName] = useState('');

  useEffect(() => setLocalLeads(leads), [leads]);

  const loadPipelines = useCallback(async () => {
    try {
      const list = await pipelinesService.list();
      setPipelines(list);
      setActivePipelineId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        const def = list.find((p) => p.is_default) || list[0];
        return def?.id || null;
      });
    } catch (err) {
      console.warn('Failed to load pipelines:', err);
    }
  }, []);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);

  const activePipeline = pipelines.find((p) => p.id === activePipelineId);
  const allStages = useMemo(
    () => [...(activePipeline?.stages || [])].sort((a, b) => a.sequence - b.sequence),
    [activePipeline],
  );
  const openStages = allStages.filter((s) => !s.is_won && !s.is_lost);
  const wonStage = allStages.find((s) => s.is_won);
  const lostStage = allStages.find((s) => s.is_lost);

  const stageLabel = useCallback((s) => {
    if (!s) return '';
    if (s.custom_name) return s.custom_name;
    if (DEFAULT_STAGE_NAMES[s.code] === s.name) return t(`crm_stage_${s.code}`) || s.name;
    return s.name;
  }, [t]);

  // ── filtering ──
  const filteredLeads = useMemo(() => {
    let list = localLeads;
    if (activePipelineId) {
      // legacy rows without pipeline_id stay visible on the default pipeline
      list = list.filter((l) => !l.pipeline_id || l.pipeline_id === activePipelineId);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (l.contact_name || '').toLowerCase().includes(q) ||
        (l.company_name || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (l.email || '').toLowerCase().includes(q));
    }
    if (responsibleFilter !== 'all') {
      list = list.filter((l) => (l.responsible_name || l.assigned_to_name || '') === responsibleFilter);
    }
    if (sourceFilter !== 'all') {
      list = list.filter((l) => (l.source || '') === sourceFilter);
    }
    return list;
  }, [localLeads, activePipelineId, search, responsibleFilter, sourceFilter]);

  const responsibles = useMemo(
    () => [...new Set(localLeads.map((l) => l.responsible_name || l.assigned_to_name).filter(Boolean))],
    [localLeads],
  );
  const sources = useMemo(
    () => [...new Set(localLeads.map((l) => l.source).filter(Boolean))],
    [localLeads],
  );

  const leadsByStage = useMemo(() => {
    const map = {};
    allStages.forEach((s) => { map[s.id] = []; });
    const fallback = openStages[0]?.id;
    filteredLeads.forEach((l) => {
      const key = l.stage_id && map[l.stage_id] ? l.stage_id
        : (allStages.find((s) => s.code === l.status)?.id || fallback);
      if (key && map[key]) map[key].push(l);
    });
    return map;
  }, [filteredLeads, allStages, openStages]);

  const columnSum = useCallback(
    (stageId) => (leadsByStage[stageId] || []).reduce((s, l) => s + (Number(l.expected_value) || 0), 0),
    [leadsByStage],
  );

  const wonThisBoard = leadsByStage[wonStage?.id] || [];
  const lostThisBoard = leadsByStage[lostStage?.id] || [];

  // ── drag & drop ──
  const handleDragStart = (start) => {
    if (start.type === 'CARD') setIsDraggingCard(true);
  };

  const handleDragEnd = async (result) => {
    setIsDraggingCard(false);
    const { destination, source, draggableId, type } = result;
    if (!destination) return;

    if (type === 'STAGE') {
      if (!canManagePipeline || destination.index === source.index) return;
      const reordered = [...openStages];
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      const ids = [...reordered.map((s) => s.id), wonStage?.id, lostStage?.id].filter(Boolean);
      // optimistic
      setPipelines((prev) => prev.map((p) => p.id !== activePipelineId ? p : {
        ...p,
        stages: p.stages.map((s) => ({ ...s, sequence: ids.indexOf(s.id) })),
      }));
      try {
        await pipelineStagesService.reorder(ids);
      } catch {
        toast({ variant: 'destructive', title: t('error') || 'Error', description: t('crm_reorder_failed') || 'Failed to reorder stages' });
        loadPipelines();
      }
      return;
    }

    // CARD
    const lead = localLeads.find((l) => l.id === draggableId);
    if (!lead || !canManageLeads) return;

    if (destination.droppableId === 'won-drop') {
      setWonLead(lead);
      return;
    }
    if (destination.droppableId === 'lost-drop') {
      setLostLead(lead);
      return;
    }
    if (destination.droppableId === source.droppableId) return;

    const target = allStages.find((s) => s.id === destination.droppableId);
    if (!target) return;
    if (target.is_won) { setWonLead(lead); return; }
    if (target.is_lost) { setLostLead(lead); return; }

    // optimistic move with rollback
    const prev = localLeads;
    setLocalLeads((ls) => ls.map((l) => (l.id === lead.id
      ? { ...l, stage_id: target.id, status: target.code, won_at: null, lost_at: null, last_activity_at: new Date().toISOString() }
      : l)));
    try {
      await leadsService.move(lead.id, target.id);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      setLocalLeads(prev);
      if (code === 'WON_FLOW_REQUIRED') { setWonLead(lead); return; }
      if (code === 'LOST_REASON_REQUIRED') { setLostLead(lead); return; }
      toast({
        variant: 'destructive',
        title: t('error') || 'Error',
        description: err.response?.data?.error?.message || t('crm_move_failed') || 'Failed to move lead',
      });
    }
  };

  // ── stage CRUD ──
  const openAddStage = () => {
    setStageForm({ name: '', color: 'blue', probability: 50 });
    setStageDialog({ mode: 'add' });
  };
  const openEditStage = (stage) => {
    setStageForm({ name: stageLabel(stage), color: stage.color || 'blue', probability: stage.probability ?? 50 });
    setStageDialog({ mode: 'edit', stage });
  };

  const saveStage = async () => {
    if (!stageForm.name.trim()) return;
    try {
      if (stageDialog.mode === 'add') {
        const code = stageForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)
          || `stage_${Date.now().toString(36)}`;
        await pipelineStagesService.create({
          name: stageForm.name.trim(),
          code: `${code}_${Date.now().toString(36).slice(-4)}`,
          sequence: openStages.length,
          probability: Number(stageForm.probability) || 0,
          color: stageForm.color,
          pipeline_type: 'lead',
          pipeline_id: activePipelineId,
        });
      } else {
        await pipelineStagesService.update(stageDialog.stage.id, {
          name: stageForm.name.trim(),
          custom_name: stageForm.name.trim(),
          probability: Number(stageForm.probability) || 0,
          color: stageForm.color,
        });
      }
      setStageDialog(null);
      loadPipelines();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('error') || 'Error',
        description: err.response?.data?.error?.message || t('crm_stage_save_failed') || 'Failed to save stage',
      });
    }
  };

  const deleteStage = async (stage) => {
    if ((leadsByStage[stage.id] || []).length > 0) {
      toast({ variant: 'destructive', title: t('error') || 'Error', description: t('crm_stage_has_leads') || 'Move the leads out of this stage first' });
      return;
    }
    try {
      await pipelineStagesService.delete(stage.id);
      setStageDialog(null);
      loadPipelines();
    } catch (err) {
      toast({ variant: 'destructive', title: t('error') || 'Error', description: err.response?.data?.error?.message || '' });
    }
  };

  const createPipeline = async () => {
    if (!pipelineName.trim()) return;
    try {
      await pipelinesService.create({ name: pipelineName.trim(), seed_stages: true });
      setPipelineDialog(false);
      setPipelineName('');
      loadPipelines();
    } catch (err) {
      toast({ variant: 'destructive', title: t('error') || 'Error', description: err.response?.data?.error?.message || '' });
    }
  };

  const afterOutcome = () => {
    setWonLead(null);
    setLostLead(null);
    onRefresh?.();
  };

  const summaShort = (v) => (formatCurrency ? formatCurrency(v) : v.toLocaleString());

  // ── list view ──
  const ListView = () => (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('lead') || 'Lid'}</TableHead>
            <TableHead>{t('crm_stage') || 'Bosqich'}</TableHead>
            <TableHead className="text-right">{t('amount') || 'Summa'}</TableHead>
            <TableHead>{t('crm_responsible') || "Mas'ul"}</TableHead>
            <TableHead>{t('source') || 'Manba'}</TableHead>
            <TableHead>{t('crm_last_activity') || 'Oxirgi faollik'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredLeads.map((lead) => {
            const stage = allStages.find((s) => s.id === lead.stage_id) || allStages.find((s) => s.code === lead.status);
            return (
              <TableRow key={lead.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedLeadId(lead.id)}>
                <TableCell>
                  <p className="font-medium text-slate-900">{lead.contact_name}</p>
                  {lead.company_name && <p className="text-xs text-slate-500">{lead.company_name}</p>}
                </TableCell>
                <TableCell>
                  {stage && (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className={`h-2 w-2 rounded-full ${stageColor(stage.color).dot}`} />
                      {stageLabel(stage)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {Number(lead.expected_value) > 0 ? summaShort(Number(lead.expected_value)) : '—'}
                </TableCell>
                <TableCell className="text-sm">{lead.responsible_name || lead.assigned_to_name || '—'}</TableCell>
                <TableCell className="text-sm">{lead.source ? (t(lead.source) || lead.source) : '—'}</TableCell>
                <TableCell className="text-sm text-slate-500">
                  {lead.last_activity_at ? formatDate(lead.last_activity_at) : '—'}
                </TableCell>
              </TableRow>
            );
          })}
          {filteredLeads.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-400">
                {t('crm_no_leads') || 'Lidlar topilmadi'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar — two deliberate tiers so nothing wraps randomly:
          tier 1: funnel identity + won/lost summary · primary actions
          tier 2: search + filters · view toggle */}
      <div className="rounded-xl border border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {pipelines.length > 1 ? (
              <Select value={activePipelineId || ''} onValueChange={setActivePipelineId}>
                <SelectTrigger className="h-9 w-[200px] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="truncate text-base font-semibold text-slate-900">
                {activePipeline?.name || t('crm_pipeline') || 'Voronka'}
              </span>
            )}
            {canManagePipeline && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-slate-400 hover:text-slate-700"
                onClick={() => setPipelineDialog(true)}
                title={t('crm_new_pipeline_title') || 'Yangi voronka'}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {(wonStage || (lostStage && lostThisBoard.length > 0)) && (
            <div className="flex items-center gap-1.5">
              {wonStage && (
                <span
                  title={t('crm_won') || 'Yutilgan'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100"
                >
                  <Trophy className="h-3 w-3" />
                  {wonThisBoard.length}
                  {columnSum(wonStage.id) > 0 && (
                    <span className="text-emerald-600/80">· {compactSum(columnSum(wonStage.id))}</span>
                  )}
                </span>
              )}
              {lostStage && lostThisBoard.length > 0 && (
                <span
                  title={t('crm_lost') || "Yo'qotilgan"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-100"
                >
                  <XCircle className="h-3 w-3" />
                  {lostThisBoard.length}
                </span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {canManagePipeline && view === 'board' && (
              <Button variant="outline" size="sm" className="h-9" onClick={openAddStage}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('crm_add_stage') || "Bosqich qo'shish"}
              </Button>
            )}
            {onAddLead && canCreate(MODULES.CUSTOMERS) && (
              <Button
                size="sm"
                className="h-9 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white shadow-sm"
                onClick={onAddLead}
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                {t('add_lead') || "Lid qo'shish"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
          <div className="relative min-w-[180px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm_search_leads') || 'Qidirish...'}
              className="h-9 w-full border-slate-200 bg-slate-50/50 pl-8 focus:bg-white"
            />
          </div>
          {responsibles.length > 0 && (
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className={`h-9 w-[170px] ${responsibleFilter === 'all' ? 'text-slate-500' : ''}`}>
                <SelectValue placeholder={t('crm_responsible') || "Mas'ul"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('crm_all_responsibles') || "Barcha mas'ullar"}</SelectItem>
                {responsibles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {sources.length > 0 && (
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className={`h-9 w-[170px] ${sourceFilter === 'all' ? 'text-slate-500' : ''}`}>
                <SelectValue placeholder={t('source') || 'Manba'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('crm_all_sources') || 'Barcha manbalar'}</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{t(s) || s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setView('board')}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${view === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title={t('crm_board_view') || 'Doska'}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title={t('crm_list_view') || "Ro'yxat"}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <ListView />
      ) : (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Droppable droppableId="board" type="STAGE" direction="horizontal">
            {(boardProvided) => (
              <div
                ref={boardProvided.innerRef}
                {...boardProvided.droppableProps}
                className="flex gap-3 overflow-x-auto pb-24"
              >
                {openStages.map((stage, index) => (
                  <Draggable
                    key={stage.id}
                    draggableId={stage.id}
                    index={index}
                    isDragDisabled={!canManagePipeline}
                  >
                    {(stageProvided, stageSnapshot) => {
                      // The drag HANDLE is only the column header — putting it
                      // on the whole column (old version) made every touch of
                      // the column body start a column drag, fighting card
                      // drags and the column's own scroll.
                      const columnNode = (
                        <div
                          ref={stageProvided.innerRef}
                          {...stageProvided.draggableProps}
                          className={`w-72 shrink-0 ${stageSnapshot.isDragging ? 'z-[9999]' : ''}`}
                        >
                          <div className={`flex max-h-[70vh] flex-col rounded-xl border border-t-2 border-slate-200 ${stageColor(stage.color).top} bg-slate-50/80 ${stageSnapshot.isDragging ? 'shadow-xl ring-2 ring-blue-200' : ''}`}>
                            {/* column header = the column drag handle */}
                            <div
                              {...stageProvided.dragHandleProps}
                              className="flex items-center justify-between px-3 pb-1 pt-2.5"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {canManagePipeline && (
                                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                                )}
                                <span className={`h-2 w-2 shrink-0 rounded-full ${stageColor(stage.color).dot}`} />
                                <span className="truncate text-sm font-semibold text-slate-800">{stageLabel(stage)}</span>
                                <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                                  {(leadsByStage[stage.id] || []).length}
                                </span>
                              </div>
                              {canManagePipeline && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditStage(stage)}>
                                      <Pencil className="mr-2 h-3.5 w-3.5" />
                                      {t('crm_edit_stage') || 'Tahrirlash'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => deleteStage(stage)}>
                                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                                      {t('delete') || "O'chirish"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            <p className="px-3 pb-2 text-xs font-medium text-slate-500">
                              {summaShort(columnSum(stage.id))}
                            </p>

                            {/* cards */}
                            <Droppable droppableId={stage.id} type="CARD">
                              {(colProvided, colSnapshot) => (
                                <div
                                  ref={colProvided.innerRef}
                                  {...colProvided.droppableProps}
                                  className={`min-h-[80px] flex-1 space-y-2 overflow-y-auto px-2.5 pb-3 transition-colors ${colSnapshot.isDraggingOver ? 'rounded-lg bg-blue-50/60' : ''}`}
                                >
                                  {(leadsByStage[stage.id] || []).map((lead, i) => (
                                    <Draggable
                                      key={lead.id}
                                      draggableId={lead.id}
                                      index={i}
                                      isDragDisabled={!canManageLeads}
                                    >
                                      {(cardProvided, cardSnapshot) => (
                                        <PortalAware provided={cardProvided} snapshot={cardSnapshot}>
                                          <LeadCard
                                            lead={lead}
                                            t={t}
                                            formatCurrency={formatCurrency}
                                            onOpen={setSelectedLeadId}
                                          />
                                        </PortalAware>
                                      )}
                                    </Draggable>
                                  ))}
                                  {colProvided.placeholder}
                                  {(leadsByStage[stage.id] || []).length === 0 && !colSnapshot.isDraggingOver && (
                                    <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                                      {t('drop_leads_here') || 'Lidlarni shu yerga tashlang'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        </div>
                      );
                      return stageSnapshot.isDragging
                        ? createPortal(columnNode, document.body)
                        : columnNode;
                    }}
                  </Draggable>
                ))}
                {boardProvided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Terminal drop bar (Pipedrive-style). ALWAYS mounted — a Droppable
              added after a drag has started is never registered by
              @hello-pangea/dnd, so a conditionally-rendered bar silently
              swallowed every drop. Visibility is CSS-only. */}
          {(wonStage || lostStage) && (
            <div
              aria-hidden={!isDraggingCard}
              // fade only — a translate would move the droppable's rect, and
              // the library captures droppable geometry at drag start, so the
              // zones must always sit exactly where they will be shown
              className={`fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-opacity duration-200 ${isDraggingCard ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              {wonStage && (
                <Droppable droppableId="won-drop" type="CARD">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 text-sm font-semibold transition-colors ${snapshot.isDraggingOver ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-emerald-200 bg-emerald-50/40 text-emerald-600'}`}
                    >
                      <Trophy className="h-4 w-4" />
                      {t('crm_won') || 'Yutilgan'}
                      <div className="h-0 w-0 overflow-hidden">{provided.placeholder}</div>
                    </div>
                  )}
                </Droppable>
              )}
              {lostStage && (
                <Droppable droppableId="lost-drop" type="CARD">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 text-sm font-semibold transition-colors ${snapshot.isDraggingOver ? 'border-red-500 bg-red-50 text-red-700' : 'border-red-200 bg-red-50/40 text-red-500'}`}
                    >
                      <XCircle className="h-4 w-4" />
                      {t('crm_lost') || "Yo'qotilgan"}
                      <div className="h-0 w-0 overflow-hidden">{provided.placeholder}</div>
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          )}
        </DragDropContext>
      )}

      {/* Win / loss dialogs */}
      <LeadOutcomeDialogs
        wonLead={wonLead}
        lostLead={lostLead}
        onClose={() => { setWonLead(null); setLostLead(null); }}
        onDone={afterOutcome}
        language={language}
      />

      {/* Lead detail side panel */}
      <LeadDetailSheet
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onEdit={(lead) => { setSelectedLeadId(null); onEditLead?.(lead); }}
        onDelete={(lead) => { setSelectedLeadId(null); onDeleteLead?.(lead); }}
        onCall={(lead) => { setSelectedLeadId(null); onCallLead?.(lead); }}
        onWin={(lead) => { setSelectedLeadId(null); setWonLead(lead); }}
        onLose={(lead) => { setSelectedLeadId(null); setLostLead(lead); }}
        onChanged={onRefresh}
        stages={allStages}
        stageLabel={stageLabel}
        language={language}
      />

      {/* Stage add/edit dialog */}
      <Dialog open={!!stageDialog} onOpenChange={(open) => !open && setStageDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {stageDialog?.mode === 'add' ? (t('crm_add_stage') || "Bosqich qo'shish") : (t('crm_edit_stage') || 'Bosqichni tahrirlash')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{t('crm_stage_name') || 'Bosqich nomi'}</label>
              <Input
                value={stageForm.name}
                onChange={(e) => setStageForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('crm_stage_name_placeholder') || 'Masalan: Taklif yuborildi'}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{t('color') || 'Rang'}</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.filter((c) => c !== 'emerald' && c !== 'red').map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStageForm((f) => ({ ...f, color: c }))}
                    className={`h-7 w-7 rounded-full ${STAGE_COLORS[c].dot} ${stageForm.color === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{t('crm_probability') || 'Yutish ehtimoli (%)'}</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={stageForm.probability}
                onChange={(e) => setStageForm((f) => ({ ...f, probability: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {stageDialog?.mode === 'edit' && (
              <Button variant="outline" className="mr-auto text-red-600" onClick={() => deleteStage(stageDialog.stage)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {t('delete') || "O'chirish"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setStageDialog(null)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={saveStage}>{t('save') || 'Saqlash'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New pipeline dialog */}
      <Dialog open={pipelineDialog} onOpenChange={setPipelineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('crm_new_pipeline_title') || 'Yangi voronka'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">{t('name') || 'Nomi'}</label>
            <Input
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              placeholder={t('crm_pipeline_name_placeholder') || "Masalan: Ta'mirlash"}
            />
            <p className="pt-1 text-xs text-slate-500">
              {t('crm_new_pipeline_hint') || "Standart bosqichlar bilan yaratiladi — keyin o'zgartirishingiz mumkin."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialog(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={createPipeline}>{t('create') || 'Yaratish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
