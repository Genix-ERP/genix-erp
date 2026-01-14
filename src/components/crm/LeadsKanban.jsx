import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Kanban,
  Phone,
  Mail,
  Calendar,
  User,
  Building,
  Target,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  MoreVertical,
  PhoneCall,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/components/utils/translations";

// Portal component for dragging items
const PortalAwareItem = ({ provided, snapshot, children }) => {
  const usePortal = snapshot.isDragging;

  const child = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={{
        ...provided.draggableProps.style,
      }}
      className={snapshot.isDragging ? 'ring-2 ring-blue-400 rounded-lg shadow-2xl' : ''}
    >
      {children}
    </div>
  );

  if (!usePortal) {
    return child;
  }

  return ReactDOM.createPortal(child, document.body);
};

const leadStageConfig = [
  {
    id: 'new',
    colorClass: 'from-blue-500 to-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700',
    icon: UserPlus
  },
  {
    id: 'contacted',
    colorClass: 'from-amber-500 to-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-700',
    icon: Phone
  },
  {
    id: 'in_progress',
    colorClass: 'from-purple-500 to-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    textClass: 'text-purple-700',
    icon: Clock
  },
  {
    id: 'qualified',
    colorClass: 'from-green-500 to-green-600',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    textClass: 'text-green-700',
    icon: CheckCircle
  },
  {
    id: 'lost',
    colorClass: 'from-red-500 to-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    textClass: 'text-red-700',
    icon: XCircle
  }
];

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

  const [kanbanState, setKanbanState] = useState({
    leads: [],
    isDragging: false,
    updatingIds: new Set(),
    error: null
  });

  useEffect(() => {
    if (Array.isArray(leads)) {
      const uniqueLeads = Array.from(
        new Map(leads.map(lead => [lead.id, { ...lead, id: String(lead.id) }])).values()
      );
      setKanbanState(prev => ({
        ...prev,
        leads: uniqueLeads
      }));
    }
  }, [leads]);

  const stages = useMemo(() => leadStageConfig.map(stage => ({
    ...stage,
    name: t(stage.id) || stage.id.replace('_', ' ')
  })), [t]);

  const stageData = useMemo(() => {
    const data = {};
    stages.forEach(stage => {
      const stageLeads = kanbanState.leads.filter(lead => (lead.status || 'new') === stage.id);
      data[stage.id] = {
        leads: stageLeads,
        count: stageLeads.length
      };
    });
    return data;
  }, [kanbanState.leads, stages]);

  const handleDragStart = useCallback(() => {
    setKanbanState(prev => ({ ...prev, isDragging: true, error: null }));
  }, []);

  const handleDragEnd = useCallback(async (result) => {
    setKanbanState(prev => ({ ...prev, isDragging: false }));

    if (!result.destination) {
      return;
    }

    const { draggableId, source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    if (source.droppableId === destination.droppableId) {
      return;
    }

    const lead = kanbanState.leads.find(l => String(l.id) === String(draggableId));

    if (!lead) {
      setKanbanState(prev => ({
        ...prev,
        error: `Lead ${draggableId} not found`
      }));
      return;
    }

    const newStatus = destination.droppableId;

    setKanbanState(prev => ({
      ...prev,
      updatingIds: new Set(prev.updatingIds).add(draggableId)
    }));

    const updatedLead = {
      ...lead,
      status: newStatus
    };

    setKanbanState(prev => ({
      ...prev,
      leads: prev.leads.map(l =>
        String(l.id) === String(draggableId) ? updatedLead : l
      )
    }));

    if (onUpdateLead) {
      onUpdateLead(updatedLead);
    }

    setKanbanState(prev => {
      const newUpdatingIds = new Set(prev.updatingIds);
      newUpdatingIds.delete(draggableId);
      return {
        ...prev,
        updatingIds: newUpdatingIds,
        error: null
      };
    });
  }, [kanbanState.leads, onUpdateLead]);

  const LeadCard = useCallback(({ lead, stage, isUpdating }) => (
    <Card className="bg-white hover:shadow-xl transition-all duration-200 cursor-grab active:cursor-grabbing relative shadow-md hover:scale-[1.02] group">
      {isUpdating && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-xs text-slate-600 font-medium">{t('updating')}...</span>
          </div>
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm text-slate-900 truncate">
                {lead.contact_name || lead.name}
              </h4>
              {lead.company_name && (
                <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  {lead.company_name}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {onCallLead && lead.phone && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onCallLead(lead);
                }}>
                  <PhoneCall className="w-4 h-4 mr-2 text-green-600" />
                  {t('call')}
                </DropdownMenuItem>
              )}
              {onEditLead && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onEditLead(lead);
                }}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {t('edit')}
                </DropdownMenuItem>
              )}
              {onDeleteLead && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLead(lead);
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          {lead.email && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{lead.phone}</span>
            </div>
          )}
          {lead.source && (
            <div className="pt-2 border-t border-slate-100">
              <Badge variant="outline" className="text-xs">
                {t(lead.source) || lead.source}
              </Badge>
            </div>
          )}
          {lead.created_at && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(lead.created_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ), [onCallLead, onEditLead, onDeleteLead, t]);

  return (
    <div className="space-y-6">
      {kanbanState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900">{t('update_failed')}</h4>
            <p className="text-sm text-red-700 mt-1">{kanbanState.error}</p>
          </div>
          <button
            onClick={() => setKanbanState(prev => ({ ...prev, error: null }))}
            className="text-red-600 hover:text-red-800 font-bold text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl overflow-visible">
        <CardHeader className="border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-lg shadow-lg">
                <Kanban className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold">{t('leads_pipeline')}</span>
                <p className="text-sm text-slate-500 font-normal mt-0.5">
                  {kanbanState.isDragging ? t('dragging') : t('drag_to_update')}
                </p>
              </div>
            </CardTitle>
            <div className="flex items-center gap-4">
              {onAddLead && (
                <Button
                  onClick={onAddLead}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('add_lead')}
                </Button>
              )}
              <div className="text-right bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-2 rounded-lg border border-blue-200 shadow-sm">
                <div className="text-2xl font-bold text-blue-700">
                  {kanbanState.leads.length}
                </div>
                <div className="text-xs text-slate-600 font-medium">{t('total_leads')}</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <DragDropContext
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => {
                const { leads: stageLeads, count } = stageData[stage.id] || { leads: [], count: 0 };
                const StageIcon = stage.icon;

                return (
                  <div key={stage.id} className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0">
                    <div className={`${stage.bgClass} ${stage.borderClass} border-2 rounded-t-xl p-3 sm:p-4 shadow-sm`}>
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2">
                          <StageIcon className={`w-4 h-4 ${stage.textClass}`} />
                          <h3 className={`font-semibold ${stage.textClass} text-xs sm:text-sm capitalize`}>
                            {stage.name}
                          </h3>
                        </div>
                        <Badge className={`bg-gradient-to-r ${stage.colorClass} text-white border-0 shadow-md flex-shrink-0 text-xs`}>
                          {count}
                        </Badge>
                      </div>
                    </div>

                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex flex-col gap-3 min-h-[350px] p-3 rounded-b-xl transition-all duration-200 ${
                            snapshot.isDraggingOver
                              ? `${stage.bgClass} border-2 border-dashed ${stage.borderClass} shadow-inner`
                              : 'bg-slate-50/50 border-2 border-slate-100'
                          }`}
                        >
                          {stageLeads.map((lead, index) => {
                            const isUpdating = kanbanState.updatingIds.has(String(lead.id));

                            return (
                              <Draggable
                                key={String(lead.id)}
                                draggableId={String(lead.id)}
                                index={index}
                                isDragDisabled={isUpdating}
                              >
                                {(provided, snapshot) => (
                                  <PortalAwareItem provided={provided} snapshot={snapshot}>
                                    <LeadCard
                                      lead={lead}
                                      stage={stage}
                                      isUpdating={isUpdating}
                                    />
                                  </PortalAwareItem>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                            <div className="text-center py-8 text-slate-400 text-xs">
                              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p>{t('drop_here')}</p>
                            </div>
                          )}
                          {snapshot.isDraggingOver && stageLeads.length === 0 && (
                            <div className="text-center py-8 text-blue-500 text-xs font-medium animate-pulse">
                              <Target className="w-8 h-8 mx-auto mb-2" />
                              <p>{t('release_to_drop')}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Lead Statistics */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--genix-blue)]" />
            {t('lead_summary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {stages.map(stage => {
              const count = stageData[stage.id]?.count || 0;
              const StageIcon = stage.icon;
              return (
                <div key={stage.id} className={`text-center p-4 ${stage.bgClass} rounded-xl border ${stage.borderClass}`}>
                  <StageIcon className={`w-6 h-6 mx-auto mb-2 ${stage.textClass}`} />
                  <div className={`text-2xl font-bold ${stage.textClass}`}>{count}</div>
                  <div className="text-xs text-slate-600 mt-1 capitalize">{stage.name}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
