import React, { useCallback } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Users,
  MapPin,
  DollarSign,
  Calendar,
  GripVertical,
  Eye,
  Edit,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// Project status columns config (titles resolved via t() at render time)
const PROJECT_COLUMNS = [
  {
    id: 'draft',
    titleKey: 'draft',
    color: 'bg-slate-100 border-slate-300',
    headerColor: 'bg-slate-200',
    badge: 'bg-slate-100 text-slate-700',
  },
  {
    id: 'planning',
    titleKey: 'planning',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-100',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'in_progress',
    titleKey: 'in_progress',
    color: 'bg-yellow-50 border-yellow-200',
    headerColor: 'bg-yellow-100',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  {
    id: 'on_hold',
    titleKey: 'on_hold',
    color: 'bg-orange-50 border-orange-200',
    headerColor: 'bg-orange-100',
    badge: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'completed',
    titleKey: 'completed',
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-100',
    badge: 'bg-green-100 text-green-700',
  },
];

// While dragging, render the card in a portal to <body> so its transform is
// measured against the viewport — this keeps the drag preview locked under the
// cursor (the old native-drag image drifted on high-DPI screens).
const PortalAwareItem = ({ provided, snapshot, children }) => {
  const child = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={{ ...provided.draggableProps.style }}
      className={snapshot.isDragging ? 'rounded-xl shadow-2xl' : ''}
    >
      {children}
    </div>
  );
  if (!snapshot.isDragging) return child;
  return ReactDOM.createPortal(child, document.body);
};

// Project Card (visual only — drag is handled by the Draggable wrapper)
function ProjectCard({ project, progress, onView, onEdit, formatCurrency, t }) {
  return (
    <Card
      onClick={() => onView(project)}
      className="cursor-pointer hover:shadow-lg transition-shadow bg-white"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-400" />
            <div>
              <h4 className="font-medium text-slate-800 text-sm line-clamp-2">{project.name}</h4>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(project)}>
                <Eye className="w-4 h-4 mr-2" />
                {t('view') || "Ko'rish"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Edit className="w-4 h-4 mr-2" />
                {t('edit') || 'Tahrirlash'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {project.client_name && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Users className="w-3 h-3" />
            <span className="truncate">{project.client_name}</span>
          </div>
        )}

        {(project.city || project.region) && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{[project.city, project.region].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {project.contract_amount > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
            <DollarSign className="w-3 h-3" />
            <span className="font-medium">{formatCurrency(project.contract_amount)}</span>
          </div>
        )}

        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">{t('progress') || 'Progress'}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {project.planned_end_date && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(project.planned_end_date), 'dd.MM.yyyy')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Kanban Column — a Droppable target for one status
function KanbanColumn({ column, projects, readinessById, onView, onEdit, formatCurrency, t }) {
  const columnProjects = projects.filter((p) => p.status === column.id);

  return (
    <div className={`flex-shrink-0 w-80 rounded-lg border-2 ${column.color}`}>
      {/* Column Header */}
      <div className={`p-3 rounded-t-lg ${column.headerColor}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{t(column.titleKey) || column.titleKey}</h3>
          <Badge className={column.badge}>{columnProjects.length}</Badge>
        </div>
      </div>

      {/* Column Content (droppable) */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-3 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto transition-colors ${
              snapshot.isDraggingOver ? 'bg-blue-50/60' : ''
            }`}
            style={{ minHeight: 120 }}
          >
            {columnProjects.length === 0 && !snapshot.isDraggingOver ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{t('no_projects') || "Loyihalar yo'q"}</p>
              </div>
            ) : (
              columnProjects.map((project, index) => {
                // Same progress source as the grid cards: computed
                // cost-weighted readiness from /projects/stats, falling
                // back to the manual progress_percent column.
                const computed = readinessById ? readinessById[project.id] : undefined;
                const progress = typeof computed === 'number'
                  ? Math.round(computed)
                  : (Number(project.progress_percent) || 0);
                return (
                  <Draggable key={project.id} draggableId={String(project.id)} index={index}>
                    {(dp, ds) => (
                      <PortalAwareItem provided={dp} snapshot={ds}>
                        <ProjectCard
                          project={project}
                          progress={progress}
                          onView={onView}
                          onEdit={onEdit}
                          formatCurrency={formatCurrency}
                          t={t}
                        />
                      </PortalAwareItem>
                    )}
                  </Draggable>
                );
              })
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// Main Kanban Board Component
export function ProjectKanban({
  projects,
  // Optional map of project id → computed readiness % (from
  // /construction/projects/stats). Cards fall back to the manual
  // progress_percent column when absent.
  readinessById,
  onStatusChange,
  onViewProject,
  onEditProject,
  formatCurrency,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const handleDragEnd = useCallback(
    (result) => {
      const { draggableId, source, destination } = result;
      if (!destination) return; // dropped outside any column
      if (destination.droppableId === source.droppableId) return; // same column
      Promise.resolve(onStatusChange(parseInt(draggableId, 10), destination.droppableId)).catch(
        (error) => console.error('Failed to update project status:', error),
      );
    },
    [onStatusChange],
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max p-2">
          {PROJECT_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              projects={projects}
              readinessById={readinessById}
              onView={onViewProject}
              onEdit={onEditProject}
              formatCurrency={formatCurrency}
              t={t}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}

export default ProjectKanban;
