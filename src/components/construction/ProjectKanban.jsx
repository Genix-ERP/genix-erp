import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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

// Project status columns
const PROJECT_COLUMNS = [
  {
    id: 'draft',
    title: 'Qoralama',
    color: 'bg-slate-100 border-slate-300',
    headerColor: 'bg-slate-200',
    badge: 'bg-slate-100 text-slate-700',
  },
  {
    id: 'planning',
    title: 'Rejalashtirish',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-100',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'in_progress',
    title: 'Jarayonda',
    color: 'bg-yellow-50 border-yellow-200',
    headerColor: 'bg-yellow-100',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  {
    id: 'on_hold',
    title: "To'xtatilgan",
    color: 'bg-orange-50 border-orange-200',
    headerColor: 'bg-orange-100',
    badge: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'completed',
    title: 'Tugallangan',
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-100',
    badge: 'bg-green-100 text-green-700',
  },
];

// Draggable Project Card
function ProjectCard({ project, onView, onEdit, onDragStart, formatCurrency }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('projectId', project.id.toString());
    e.dataTransfer.setData('currentStatus', project.status);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart && onDragStart(project);
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow bg-white"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 font-mono">{project.code}</p>
              <h4 className="font-medium text-slate-800 text-sm line-clamp-2">{project.name}</h4>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(project)}>
                <Eye className="w-4 h-4 mr-2" />
                Ko'rish
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Edit className="w-4 h-4 mr-2" />
                Tahrirlash
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
            <span className="text-slate-500">Progress</span>
            <span className="font-medium">{project.progress_percent || 0}%</span>
          </div>
          <Progress value={project.progress_percent || 0} className="h-1.5" />
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

// Kanban Column
function KanbanColumn({ column, projects, onDrop, onView, onEdit, formatCurrency }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const projectId = e.dataTransfer.getData('projectId');
    const currentStatus = e.dataTransfer.getData('currentStatus');

    if (projectId && currentStatus !== column.id) {
      onDrop(parseInt(projectId, 10), column.id);
    }
  };

  const columnProjects = projects.filter((p) => p.status === column.id);

  return (
    <div
      className={`flex-shrink-0 w-80 rounded-lg border-2 transition-colors ${
        isDragOver ? 'border-blue-400 bg-blue-50' : column.color
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className={`p-3 rounded-t-lg ${column.headerColor}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{column.title}</h3>
          <Badge className={column.badge}>{columnProjects.length}</Badge>
        </div>
      </div>

      {/* Column Content */}
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="p-3 space-y-3">
          {columnProjects.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Loyihalar yo'q</p>
            </div>
          ) : (
            columnProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onView={onView}
                onEdit={onEdit}
                formatCurrency={formatCurrency}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Main Kanban Board Component
export function ProjectKanban({
  projects,
  onStatusChange,
  onViewProject,
  onEditProject,
  formatCurrency,
}) {
  const handleDrop = useCallback(
    async (projectId, newStatus) => {
      try {
        await onStatusChange(projectId, newStatus);
      } catch (error) {
        console.error('Failed to update project status:', error);
      }
    },
    [onStatusChange]
  );

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max p-2">
        {PROJECT_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            projects={projects}
            onDrop={handleDrop}
            onView={onViewProject}
            onEdit={onEditProject}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    </div>
  );
}

export default ProjectKanban;
