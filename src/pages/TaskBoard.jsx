import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Plus, Search, MoreHorizontal, GripVertical, Pencil, Trash2,
  LayoutGrid, List, User, CalendarDays, MessageSquare, Paperclip,
  CheckSquare, AlertTriangle, UserX, KanbanSquare, X, Check,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';
import taskBoardsService from '@/api/services/taskBoards';
import TaskDetailSheet from '@/components/tasks/TaskDetailSheet';
import { COLOR_DOT, COLUMN_TINT, COLUMN_COLORS, PRIORITY_DOT } from '@/components/tasks/constants';

// While dragging, render in a portal to <body> so the preview stays under the
// cursor (same trick as construction/ProjectKanban).
function PortalAwareItem({ provided, snapshot, children }) {
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
}

export function AssigneeAvatars({ assignees, max = 3 }) {
  if (!assignees?.length) return null;
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((a) => (
        <div
          key={a.employee_id}
          title={a.name}
          className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white ${
            a.is_active
              ? 'bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)]'
              : 'bg-slate-400'
          }`}
        >
          {a.name?.charAt(0)?.toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600">
          +{extra}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onClick, t }) {
  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-md transition-shadow bg-white">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span
            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.normal}`}
            title={t(`task_priority_${task.priority}`)}
          />
          <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-3 flex-1">{task.title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {task.due_date && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                task.is_overdue
                  ? 'bg-red-100 text-red-700 font-semibold'
                  : task.completed_at ? 'bg-green-50 text-green-700' : 'bg-slate-100'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              {format(new Date(task.due_date), 'dd.MM')}
            </span>
          )}
          {task.checklist_total > 0 && (
            <span className={`inline-flex items-center gap-1 ${task.checklist_done === task.checklist_total ? 'text-green-600' : ''}`}>
              <CheckSquare className="w-3 h-3" />
              {task.checklist_done}/{task.checklist_total}
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {task.comment_count}
            </span>
          )}
          {task.attachment_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="w-3 h-3" />
              {task.attachment_count}
            </span>
          )}
          <span className="ml-auto">
            <AssigneeAvatars assignees={task.assignees} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TaskBoard() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const canManageColumns = canUpdate(MODULES.TASKS);
  const canManageTasks = canUpdate(MODULES.TASKS) || canCreate(MODULES.TASKS);

  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [viewMode, setViewMode] = useState('kanban');
  const [mineOnly, setMineOnly] = useState(false);
  const [myTaskIds, setMyTaskIds] = useState(null); // Set | null
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [quickAddColumn, setQuickAddColumn] = useState(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [editColumn, setEditColumn] = useState(null); // {column, name, color, wip, isDone}
  const [deleteColumn, setDeleteColumn] = useState(null); // {column, moveTo}
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: '', color: 'gray' });

  const loadBoard = useCallback(async () => {
    try {
      const data = await taskBoardsService.getBoard(boardId);
      setBoard(data.board);
      setColumns(data.columns || []);
      setTasks(data.tasks || []);
      setNotFound(false);
    } catch (error) {
      if (error?.response?.status === 404) setNotFound(true);
      else {
        console.error('Failed to load board:', error);
        toast.error(t('loading_error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setIsLoading(true); loadBoard(); }, [loadBoard]);

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // "Mening vazifalarim" — ids from the cross-board endpoint
  useEffect(() => {
    if (!mineOnly || myTaskIds) return;
    taskBoardsService.listMyTasks()
      .then((list) => setMyTaskIds(new Set((list || []).map((x) => x.id))))
      .catch(() => setMyTaskIds(new Set()));
  }, [mineOnly, myTaskIds]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (search && !task.title.toLowerCase().includes(search)) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    if (overdueOnly && !task.is_overdue) return false;
    if (mineOnly && myTaskIds && !myTaskIds.has(task.id)) return false;
    return true;
  }), [tasks, search, priorityFilter, overdueOnly, mineOnly, myTaskIds]);

  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach((c) => { map[c.id] = []; });
    filteredTasks.forEach((task) => {
      (map[task.column_id] = map[task.column_id] || []).push(task);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [columns, filteredTasks]);

  const hasActiveFilters = search || priorityFilter !== 'all' || overdueOnly || mineOnly;

  // ── Drag & drop (optimistic, rolls back by reloading on failure) ──
  const handleDragEnd = useCallback(async (result) => {
    const { type, source, destination, draggableId } = result;
    if (!destination) return;

    if (type === 'COLUMN') {
      if (source.index === destination.index) return;
      const reordered = [...columns];
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      setColumns(reordered.map((c, i) => ({ ...c, position: i })));
      try {
        await taskBoardsService.reorderColumns(boardId, reordered.map((c) => c.id));
      } catch (error) {
        console.error('Failed to reorder columns:', error);
        toast.error(t('move_failed'));
        loadBoard();
      }
      return;
    }

    // CARD
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const prevTasks = tasks;
    const destColumn = columns.find((c) => c.id === destination.droppableId);

    // Optimistic local re-position
    setTasks((current) => {
      const next = current.map((task) => ({ ...task }));
      const moved = next.find((task) => task.id === draggableId);
      if (!moved) return current;
      next.forEach((task) => {
        if (task.id === draggableId) return;
        if (task.column_id === source.droppableId && task.position > moved.position) task.position -= 1;
      });
      next.forEach((task) => {
        if (task.id === draggableId) return;
        if (task.column_id === destination.droppableId && task.position >= destination.index) task.position += 1;
      });
      moved.column_id = destination.droppableId;
      moved.position = destination.index;
      if (destColumn?.is_done_column) {
        moved.completed_at = moved.completed_at || new Date().toISOString();
        moved.is_overdue = false;
      } else {
        moved.completed_at = null;
      }
      return next;
    });

    try {
      const res = await taskBoardsService.moveTask(boardId, draggableId, destination.droppableId, destination.index);
      if (res?.wip_exceeded) toast.warning(t('wip_exceeded'));
    } catch (error) {
      console.error('Failed to move task:', error);
      setTasks(prevTasks);
      toast.error(t('move_failed'));
      loadBoard();
    }
  }, [boardId, columns, tasks, loadBoard]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quick add ──
  const handleQuickAdd = async (columnId) => {
    const title = quickAddTitle.trim();
    if (!title) return;
    setQuickAddTitle('');
    try {
      await taskBoardsService.createTask(boardId, { title, column_id: columnId });
      loadBoard();
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error(t('task_create_error'));
    }
  };

  // ── Column management ──
  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumn.name.trim()) return;
    try {
      await taskBoardsService.createColumn(boardId, { name: newColumn.name.trim(), color: newColumn.color });
      setShowAddColumn(false);
      setNewColumn({ name: '', color: 'gray' });
      loadBoard();
    } catch (error) {
      console.error('Failed to create column:', error);
      toast.error(t('saving_error'));
    }
  };

  const handleSaveColumn = async (e) => {
    e.preventDefault();
    if (!editColumn?.name.trim()) return;
    try {
      const payload = {
        name: editColumn.name.trim(),
        color: editColumn.color,
        is_done_column: editColumn.isDone,
      };
      const wip = parseInt(editColumn.wip, 10);
      if (editColumn.wip === '' || Number.isNaN(wip)) payload.remove_wip_limit = true;
      else payload.wip_limit = wip;
      await taskBoardsService.updateColumn(boardId, editColumn.column.id, payload);
      setEditColumn(null);
      loadBoard();
    } catch (error) {
      console.error('Failed to update column:', error);
      toast.error(t('saving_error'));
    }
  };

  const handleDeleteColumn = async () => {
    if (!deleteColumn) return;
    const colTasks = tasksByColumn[deleteColumn.column.id] || [];
    if (colTasks.length > 0 && !deleteColumn.moveTo) return;
    try {
      await taskBoardsService.deleteColumn(boardId, deleteColumn.column.id, deleteColumn.moveTo || undefined);
      setDeleteColumn(null);
      loadBoard();
    } catch (error) {
      console.error('Failed to delete column:', error);
      toast.error(t('deleting_error'));
    }
  };

  // ── Render ──
  if (notFound) {
    return (
      <div className="p-8 text-center">
        <KanbanSquare className="w-16 h-16 text-slate-300 mx-auto mb-4 mt-16" />
        <p className="text-slate-500 mb-4">{t('board_not_found')}</p>
        <Button onClick={() => navigate('/tasks')}>{t('back_to_boards')}</Button>
      </div>
    );
  }

  if (isLoading || !board) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex gap-4 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-80 h-96 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  const listTasks = [...filteredTasks].sort((a, b) => {
    const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return da - db || priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  const columnName = (id) => columns.find((c) => c.id === id)?.name || '';

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-full space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className={`w-3 h-3 rounded-full ${COLOR_DOT[board.color] || COLOR_DOT.blue}`} />
          <h1 className="text-xl font-bold text-slate-900">{board.name}</h1>
          {board.archived_at && <Badge variant="outline">{t('archived')}</Badge>}
        </div>

        {board.orphaned_count > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <UserX className="w-4 h-4 flex-shrink-0" />
            <span>{board.orphaned_count} {t('orphaned_tasks_banner')}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('search_tasks')}
              className="pl-9 bg-white"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_priorities')}</SelectItem>
              {['urgent', 'high', 'normal', 'low'].map((p) => (
                <SelectItem key={p} value={p}>{t(`task_priority_${p}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={overdueOnly ? 'destructive' : 'outline'}
            size="sm"
            className={overdueOnly ? '' : 'bg-white'}
            onClick={() => setOverdueOnly((v) => !v)}
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            {t('overdue_tasks_stat')}
          </Button>
          <Button
            variant={mineOnly ? 'secondary' : 'outline'}
            size="sm"
            className={mineOnly ? '' : 'bg-white'}
            onClick={() => setMineOnly((v) => !v)}
          >
            <User className="w-4 h-4 mr-1.5" />
            {t('my_tasks')}
          </Button>

          <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-1" role="tablist">
            <button
              role="tab"
              aria-selected={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              {t('kanban')}
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List className="w-4 h-4" />
              {t('list_view')}
            </button>
          </div>
        </div>

        {/* Board */}
        {viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="board" direction="horizontal" type="COLUMN">
              {(boardProvided) => (
                <div
                  ref={boardProvided.innerRef}
                  {...boardProvided.droppableProps}
                  className="flex gap-4 overflow-x-auto pb-4 items-start"
                >
                  {columns.map((column, columnIndex) => {
                    const colTasks = tasksByColumn[column.id] || [];
                    const wipExceeded = column.wip_limit != null && colTasks.length > column.wip_limit;
                    return (
                      <Draggable
                        key={column.id}
                        draggableId={`col-${column.id}`}
                        index={columnIndex}
                        isDragDisabled={!canManageColumns}
                      >
                        {(colProvided) => (
                          <div
                            ref={colProvided.innerRef}
                            {...colProvided.draggableProps}
                            className={`flex-shrink-0 w-80 rounded-xl border ${COLUMN_TINT[column.color] || COLUMN_TINT.gray}`}
                          >
                            {/* Column header */}
                            <div className="px-3 py-2.5 flex items-center gap-1.5">
                              {canManageColumns && (
                                <span
                                  {...colProvided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/5"
                                >
                                  <GripVertical className="w-4 h-4 text-slate-400" />
                                </span>
                              )}
                              <h3 className="font-semibold text-sm text-slate-800 truncate flex-1">
                                {column.name}
                              </h3>
                              {column.is_done_column && <Check className="w-3.5 h-3.5 text-green-600" />}
                              <Badge variant="secondary" className="h-5 px-1.5 text-xs font-semibold">
                                {colTasks.length}{column.wip_limit != null ? `/${column.wip_limit}` : ''}
                              </Badge>
                              {wipExceeded && (
                                <Badge className="h-5 px-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-100" title={t('wip_exceeded')}>
                                  WIP!
                                </Badge>
                              )}
                              {canManageColumns && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => setEditColumn({
                                        column,
                                        name: column.name,
                                        color: column.color,
                                        wip: column.wip_limit ?? '',
                                        isDone: column.is_done_column,
                                      })}
                                    >
                                      <Pencil className="w-4 h-4 mr-2" />
                                      {t('edit_column')}
                                    </DropdownMenuItem>
                                    {canDelete(MODULES.TASKS) && (
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onClick={() => setDeleteColumn({ column, moveTo: '' })}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t('delete_column')}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>

                            {/* Cards */}
                            <Droppable droppableId={column.id} type="CARD">
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`px-2.5 pb-2 space-y-2 min-h-[80px] max-h-[calc(100vh-330px)] overflow-y-auto transition-colors rounded-b-xl ${
                                    snapshot.isDraggingOver ? 'bg-blue-100/40' : ''
                                  }`}
                                >
                                  {colTasks.map((task, index) => (
                                    <Draggable
                                      key={task.id}
                                      draggableId={task.id}
                                      index={index}
                                      isDragDisabled={!canManageTasks}
                                    >
                                      {(dp, ds) => (
                                        <PortalAwareItem provided={dp} snapshot={ds}>
                                          <TaskCard task={task} onClick={() => setSelectedTaskId(task.id)} t={t} />
                                        </PortalAwareItem>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                  {colTasks.length === 0 && !snapshot.isDraggingOver && (
                                    <div className="text-center py-6 text-slate-400 text-xs">
                                      {hasActiveFilters ? t('no_tasks_match') : t('drop_tasks_here')}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Droppable>

                            {/* Quick add */}
                            {canCreate(MODULES.TASKS) && (
                              <div className="px-2.5 pb-2.5">
                                {quickAddColumn === column.id ? (
                                  <form
                                    onSubmit={(e) => { e.preventDefault(); handleQuickAdd(column.id); }}
                                    className="flex gap-1.5"
                                  >
                                    <Input
                                      autoFocus
                                      value={quickAddTitle}
                                      onChange={(e) => setQuickAddTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') { setQuickAddColumn(null); setQuickAddTitle(''); }
                                      }}
                                      placeholder={t('task_title_placeholder')}
                                      className="h-8 text-sm bg-white"
                                    />
                                    <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0">
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"
                                      onClick={() => { setQuickAddColumn(null); setQuickAddTitle(''); }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </form>
                                ) : (
                                  <button
                                    onClick={() => { setQuickAddColumn(column.id); setQuickAddTitle(''); }}
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-white/70 hover:text-slate-700 transition-colors"
                                  >
                                    <Plus className="w-4 h-4" />
                                    {t('new_task')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {boardProvided.placeholder}

                  {/* Add column affordance */}
                  {canManageColumns && (
                    <button
                      onClick={() => setShowAddColumn(true)}
                      className="flex-shrink-0 w-72 h-12 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      {t('add_column')}
                    </button>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          /* List view */
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-0">
              {listTasks.length === 0 ? (
                <div className="text-center py-16">
                  <ListTodoIcon />
                  <p className="text-slate-500">
                    {hasActiveFilters ? t('no_tasks_match') : t('no_tasks_yet')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                        <th className="px-4 py-3 font-medium">{t('task_title')}</th>
                        <th className="px-4 py-3 font-medium">{t('column')}</th>
                        <th className="px-4 py-3 font-medium">{t('assignees')}</th>
                        <th className="px-4 py-3 font-medium">{t('priority')}</th>
                        <th className="px-4 py-3 font-medium">{t('due_date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listTasks.map((task) => (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                              <span className={task.completed_at ? 'line-through text-slate-400' : ''}>{task.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{columnName(task.column_id)}</td>
                          <td className="px-4 py-3"><AssigneeAvatars assignees={task.assignees} /></td>
                          <td className="px-4 py-3 text-slate-500">{t(`task_priority_${task.priority}`)}</td>
                          <td className="px-4 py-3">
                            {task.due_date ? (
                              <span className={task.is_overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                                {format(new Date(task.due_date), 'dd.MM.yyyy')}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Task detail side panel */}
      {selectedTaskId && (
        <TaskDetailSheet
          boardId={boardId}
          taskId={selectedTaskId}
          columns={columns}
          onClose={() => setSelectedTaskId(null)}
          onChanged={loadBoard}
        />
      )}

      {/* Add column */}
      <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('add_column')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddColumn} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('column_name')} *</Label>
              <Input
                autoFocus
                value={newColumn.name}
                onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('color')}</Label>
              <div className="flex gap-2">
                {COLUMN_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColumn({ ...newColumn, color })}
                    className={`w-7 h-7 rounded-full ${COLOR_DOT[color]} ${
                      newColumn.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                    }`}
                    aria-label={t(color)}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddColumn(false)}>{t('cancel')}</Button>
              <Button type="submit" disabled={!newColumn.name.trim()}>{t('add')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit column */}
      <Dialog open={!!editColumn} onOpenChange={(open) => !open && setEditColumn(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('edit_column')}</DialogTitle>
          </DialogHeader>
          {editColumn && (
            <form onSubmit={handleSaveColumn} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('column_name')} *</Label>
                <Input
                  value={editColumn.name}
                  onChange={(e) => setEditColumn({ ...editColumn, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('color')}</Label>
                <div className="flex gap-2">
                  {COLUMN_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColumn({ ...editColumn, color })}
                      className={`w-7 h-7 rounded-full ${COLOR_DOT[color]} ${
                        editColumn.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                      }`}
                      aria-label={t(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('wip_limit')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={editColumn.wip}
                  onChange={(e) => setEditColumn({ ...editColumn, wip: e.target.value })}
                  placeholder={t('no_limit')}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editColumn.isDone}
                  onChange={(e) => setEditColumn({ ...editColumn, isDone: e.target.checked })}
                  className="rounded border-slate-300"
                />
                {t('done_column_flag')}
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditColumn(null)}>{t('cancel')}</Button>
                <Button type="submit">{t('save')}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete column */}
      <Dialog open={!!deleteColumn} onOpenChange={(open) => !open && setDeleteColumn(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('delete_column')}</DialogTitle>
          </DialogHeader>
          {deleteColumn && (
            <div className="space-y-4">
              {(tasksByColumn[deleteColumn.column.id] || []).length > 0 ? (
                <>
                  <p className="text-sm text-slate-600">{t('column_has_tasks')}</p>
                  <Select
                    value={deleteColumn.moveTo}
                    onValueChange={(v) => setDeleteColumn({ ...deleteColumn, moveTo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('move_tasks_to')} />
                    </SelectTrigger>
                    <SelectContent>
                      {columns
                        .filter((c) => c.id !== deleteColumn.column.id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <p className="text-sm text-slate-600">{t('confirm_delete_column')}</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteColumn(null)}>{t('cancel')}</Button>
                <Button
                  variant="destructive"
                  disabled={(tasksByColumn[deleteColumn.column.id] || []).length > 0 && !deleteColumn.moveTo}
                  onClick={handleDeleteColumn}
                >
                  {t('delete')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListTodoIcon() {
  return <KanbanSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />;
}
