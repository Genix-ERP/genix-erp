import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kanban, DollarSign, Calendar, TrendingUp, Target, Percent, Loader2, AlertCircle, Pencil, Trash2, MoreVertical } from "lucide-react";
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

  // Render in portal when dragging
  return ReactDOM.createPortal(child, document.body);
};

const stageConfig = [
  { 
    id: 'qualification', 
    colorClass: 'from-blue-500 to-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700'
  },
  { 
    id: 'needs_analysis', 
    colorClass: 'from-amber-500 to-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-700'
  },
  { 
    id: 'proposal', 
    colorClass: 'from-purple-500 to-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    textClass: 'text-purple-700'
  },
  { 
    id: 'negotiation', 
    colorClass: 'from-orange-500 to-orange-600',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    textClass: 'text-orange-700'
  },
  { 
    id: 'closed_won', 
    colorClass: 'from-green-500 to-green-600',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    textClass: 'text-green-700'
  },
  { 
    id: 'closed_lost', 
    colorClass: 'from-red-500 to-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    textClass: 'text-red-700'
  }
];

export default function DragDropKanban({ opportunities = [], leads = [], onUpdateOpportunity, onEditOpportunity, onDeleteOpportunity, language = 'en' }) {
  const { t } = useTranslation(language);
  
  const [kanbanState, setKanbanState] = useState({
    opportunities: [],
    isDragging: false,
    updatingIds: new Set(),
    error: null
  });

  useEffect(() => {
    console.log('📥 Received opportunities from parent:', opportunities.length);
    if (Array.isArray(opportunities) && opportunities.length > 0) {
      // Remove duplicates based on ID
      const uniqueOpportunities = Array.from(
        new Map(opportunities.map(opp => [opp.id, { ...opp, id: String(opp.id) }])).values()
      );
      setKanbanState(prev => ({
        ...prev,
        opportunities: uniqueOpportunities
      }));
    }
  }, [opportunities]);

  const stages = useMemo(() => stageConfig.map(stage => ({
    ...stage,
    name: t(stage.id)
  })), [t]);

  const stageData = useMemo(() => {
    const data = {};
    stages.forEach(stage => {
      const stageOpps = kanbanState.opportunities.filter(opp => opp.stage === stage.id);
      data[stage.id] = {
        opportunities: stageOpps,
        count: stageOpps.length,
        value: stageOpps.reduce((sum, opp) => sum + (opp.expected_value || 0), 0)
      };
    });
    return data;
  }, [kanbanState.opportunities, stages]);

  const totalPipelineValue = useMemo(() => 
    kanbanState.opportunities.reduce((sum, opp) => sum + (opp.expected_value || 0), 0),
    [kanbanState.opportunities]
  );

  const handleDragStart = useCallback(() => {
    console.log('🎯 Drag started');
    setKanbanState(prev => ({ ...prev, isDragging: true, error: null }));
  }, []);

  const handleDragEnd = useCallback(async (result) => {
    console.log('🎯 Drag ended', result);
    
    setKanbanState(prev => ({ ...prev, isDragging: false }));

    if (!result.destination) {
      console.log('❌ No destination - drag cancelled');
      return;
    }

    const { draggableId, source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      console.log('❌ Same position - no change needed');
      return;
    }

    if (source.droppableId === destination.droppableId) {
      console.log('ℹ️ Same column - reorder not implemented');
      return;
    }

    console.log(`🔄 Moving opportunity ${draggableId} from ${source.droppableId} to ${destination.droppableId}`);

    const opportunity = kanbanState.opportunities.find(opp => String(opp.id) === String(draggableId));
    
    if (!opportunity) {
      console.error('❌ Opportunity not found:', draggableId);
      setKanbanState(prev => ({ 
        ...prev, 
        error: `Opportunity ${draggableId} not found` 
      }));
      return;
    }

    const newStage = destination.droppableId;
    console.log(`📝 Updating ${opportunity.name} to stage: ${newStage}`);

    setKanbanState(prev => ({
      ...prev,
      updatingIds: new Set(prev.updatingIds).add(draggableId)
    }));

    const updatedOpportunity = {
      ...opportunity,
      stage: newStage
    };

    setKanbanState(prev => ({
      ...prev,
      opportunities: prev.opportunities.map(opp => 
        String(opp.id) === String(draggableId) ? updatedOpportunity : opp
      )
    }));

    // Update via callback (which updates localStorage context)
    if (onUpdateOpportunity) {
      onUpdateOpportunity(updatedOpportunity);
    }

    // Clear updating state
    setKanbanState(prev => {
      const newUpdatingIds = new Set(prev.updatingIds);
      newUpdatingIds.delete(draggableId);
      return {
        ...prev,
        updatingIds: newUpdatingIds,
        error: null
      };
    });

    console.log('✅ Update successful');
  }, [kanbanState.opportunities, onUpdateOpportunity]);

  const OpportunityCard = useCallback(({ opportunity, stage, isUpdating }) => (
    <Card className="bg-white hover:shadow-xl transition-all duration-200 cursor-grab active:cursor-grabbing relative shadow-md hover:scale-[1.02] group">
      {isUpdating && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-xs text-slate-600 font-medium">Updating...</span>
          </div>
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-semibold text-sm text-slate-900 line-clamp-2 leading-tight flex-1 pr-2">
            {opportunity.name}
          </h4>
          {(onEditOpportunity || onDeleteOpportunity) && (
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
                {onEditOpportunity && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onEditOpportunity(opportunity);
                  }}>
                    <Pencil className="w-4 h-4 mr-2" />
                    {t('edit')}
                  </DropdownMenuItem>
                )}
                {onDeleteOpportunity && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteOpportunity(opportunity);
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{t('value')}</span>
            </span>
            <span className="font-bold text-green-600 text-sm">
              ${(opportunity.expected_value || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <Percent className="w-3.5 h-3.5" />
              <span>{t('probability')}</span>
            </span>
            <div className="flex items-center gap-2 flex-1 ml-3 max-w-[120px]">
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div
                  className={`bg-gradient-to-r ${stage.colorClass} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${opportunity.probability || 0}%` }}
                />
              </div>
              <span className="font-semibold text-slate-700 text-xs min-w-[32px] text-right">
                {opportunity.probability || 0}%
              </span>
            </div>
          </div>
          {opportunity.expected_close_date && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
              <Calendar className="w-3.5 h-3.5" />
              <span className="font-medium">{new Date(opportunity.expected_close_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ), [onEditOpportunity, onDeleteOpportunity, t]);

  if (!kanbanState.opportunities || kanbanState.opportunities.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
        <CardContent className="p-12 text-center">
          <Target className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">{t('no_opportunities')}</h3>
          <p className="text-slate-500">{t('create_opportunities')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {kanbanState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900">Update Failed</h4>
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
                <span className="text-xl font-bold">{t('sales_pipeline')}</span>
                <p className="text-sm text-slate-500 font-normal mt-0.5">
                  {kanbanState.isDragging ? t('dragging') : t('drag_to_update')}
                </p>
              </div>
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="text-right bg-gradient-to-br from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200 shadow-sm">
                <div className="text-2xl font-bold text-green-700">
                  ${totalPipelineValue.toLocaleString()}
                </div>
                <div className="text-xs text-slate-600 font-medium">{t('total_pipeline_value')}</div>
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
                const { opportunities: stageOpps, count, value } = stageData[stage.id] || { opportunities: [], count: 0, value: 0 };

                return (
                  <div key={stage.id} className="flex flex-col min-w-[240px] w-[240px] sm:min-w-[280px] sm:w-[280px] flex-shrink-0">
                    <div className={`${stage.bgClass} ${stage.borderClass} border-2 rounded-t-xl p-3 sm:p-4 shadow-sm`}>
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <h3 className={`font-semibold ${stage.textClass} text-xs sm:text-sm truncate flex-1`}>
                          {stage.name}
                        </h3>
                        <Badge className={`bg-gradient-to-r ${stage.colorClass} text-white border-0 shadow-md flex-shrink-0 text-xs`}>
                          {count}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                        <DollarSign className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">${value.toLocaleString()}</span>
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
                          {stageOpps.map((opp, index) => {
                            const isUpdating = kanbanState.updatingIds.has(String(opp.id));
                            
                            return (
                              <Draggable
                                key={String(opp.id)}
                                draggableId={String(opp.id)}
                                index={index}
                                isDragDisabled={isUpdating}
                              >
                                {(provided, snapshot) => (
                                  <PortalAwareItem provided={provided} snapshot={snapshot}>
                                    <OpportunityCard
                                      opportunity={opp}
                                      stage={stage}
                                      isUpdating={isUpdating}
                                    />
                                  </PortalAwareItem>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          {stageOpps.length === 0 && !snapshot.isDraggingOver && (
                            <div className="text-center py-8 text-slate-400 text-xs">
                              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p>{t('drop_here')}</p>
                            </div>
                          )}
                          {snapshot.isDraggingOver && stageOpps.length === 0 && (
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

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--genix-blue)]" />
            {t('lead_summary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{leads.length}</div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1">{t('total_leads')}</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div className="text-2xl sm:text-3xl font-bold text-green-600">
                {leads.filter(l => l.status === 'qualified').length}
              </div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1">{t('qualified')}</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600">
                {kanbanState.opportunities.filter(o => !['closed_won', 'closed_lost'].includes(o.stage)).length}
              </div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1">{t('active_opportunities')}</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
              <div className="text-2xl sm:text-3xl font-bold text-orange-600">
                {leads.length > 0 ? Math.round(kanbanState.opportunities.filter(o => o.stage === 'closed_won').length / leads.length * 100) : 0}%
              </div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1">{t('win_rate')}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}