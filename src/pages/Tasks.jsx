import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ListTodo, CheckCircle, AlertTriangle, TrendingUp, Plus, MoreHorizontal,
  Archive, ArchiveRestore, Trash2, KanbanSquare, UserX,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';
import taskBoardsService from '@/api/services/taskBoards';
import { BOARD_COLORS, COLOR_DOT } from '@/components/tasks/constants';

export default function Tasks() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [boards, setBoards] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null);
  const [newBoard, setNewBoard] = useState({ name: '', description: '', color: 'blue' });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [boardsData, statsData] = await Promise.all([
        taskBoardsService.listBoards(showArchived ? { include_archived: 'true' } : {}),
        taskBoardsService.getStats(),
      ]);
      setBoards(Array.isArray(boardsData) ? boardsData : []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load task boards:', error);
      toast.error(t('loading_error'));
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoard.name.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await taskBoardsService.createBoard({
        name: newBoard.name.trim(),
        description: newBoard.description,
        color: newBoard.color,
      });
      setShowCreateModal(false);
      setNewBoard({ name: '', description: '', color: 'blue' });
      const boardId = created?.board?.id;
      if (boardId) navigate(`/tasks/${boardId}`);
      else loadData();
    } catch (error) {
      console.error('Failed to create board:', error);
      toast.error(t('board_create_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async (board) => {
    try {
      await taskBoardsService.updateBoard(board.id, { archived: !board.archived_at });
      loadData();
    } catch (error) {
      console.error('Failed to archive board:', error);
      toast.error(t('saving_error'));
    }
  };

  const handleDeleteBoard = async () => {
    if (!confirmDeleteBoard) return;
    try {
      await taskBoardsService.deleteBoard(confirmDeleteBoard.id);
      setConfirmDeleteBoard(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete board:', error);
      toast.error(t('deleting_error'));
    }
  };

  const statCards = [
    {
      label: t('total_tasks_stat'), value: stats?.total_tasks ?? 0,
      icon: ListTodo, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', valueClass: 'text-slate-900',
    },
    {
      label: t('active_tasks_stat'), value: stats?.active_tasks ?? 0,
      icon: CheckCircle, iconBg: 'bg-green-100', iconColor: 'text-green-600', valueClass: 'text-slate-900',
    },
    {
      label: t('overdue_tasks_stat'), value: stats?.overdue_tasks ?? 0,
      icon: AlertTriangle, iconBg: 'bg-red-100', iconColor: 'text-red-600',
      valueClass: (stats?.overdue_tasks ?? 0) > 0 ? 'text-red-600' : 'text-slate-900',
    },
    {
      label: t('completed_month_stat'), value: `${Math.round(stats?.completed_pct_month ?? 0)}%`,
      icon: TrendingUp, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', valueClass: 'text-slate-900',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <p className={`text-3xl font-bold ${card.valueClass}`}>{card.value}</p>
                <p className="text-sm text-slate-500 mt-1">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Boards */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-bold text-slate-900">{t('task_boards')}</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={showArchived ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {t('archived')}
                </Button>
                {canCreate(MODULES.TASKS) && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('new_board')}
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : boards.length === 0 ? (
              <div className="text-center py-16">
                <KanbanSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('no_boards_yet')}</p>
                {canCreate(MODULES.TASKS) && (
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                    {t('create_first_board')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {boards.map((board) => (
                  <Card
                    key={board.id}
                    onClick={() => navigate(`/tasks/${board.id}`)}
                    className="cursor-pointer hover:shadow-lg transition-shadow border-slate-200/70"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOT[board.color] || COLOR_DOT.blue}`} />
                          <h3 className="font-semibold text-slate-900 truncate">{board.name}</h3>
                        </div>
                        {(canUpdate(MODULES.TASKS) || canDelete(MODULES.TASKS)) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              {canUpdate(MODULES.TASKS) && (
                                <DropdownMenuItem onClick={() => handleArchiveToggle(board)}>
                                  {board.archived_at
                                    ? <><ArchiveRestore className="w-4 h-4 mr-2" />{t('unarchive')}</>
                                    : <><Archive className="w-4 h-4 mr-2" />{t('archive')}</>}
                                </DropdownMenuItem>
                              )}
                              {canDelete(MODULES.TASKS) && (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setConfirmDeleteBoard(board)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {t('delete_board')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {board.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{board.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary" className="font-normal">
                          {board.task_count} {t('tasks_suffix')}
                        </Badge>
                        {board.overdue_count > 0 && (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 font-normal">
                            {board.overdue_count} {t('overdue_suffix')}
                          </Badge>
                        )}
                        {board.archived_at && (
                          <Badge variant="outline" className="font-normal">{t('archived')}</Badge>
                        )}
                      </div>

                      {board.orphaned_count > 0 && !board.archived_at && (
                        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                          <UserX className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{board.orphaned_count} {t('orphaned_tasks_banner')}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create board */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new_board')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBoard} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="board-name">{t('board_name')} *</Label>
              <Input
                id="board-name"
                value={newBoard.name}
                onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })}
                placeholder={t('board_name_placeholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-desc">{t('description')}</Label>
              <Textarea
                id="board-desc"
                value={newBoard.description}
                onChange={(e) => setNewBoard({ ...newBoard, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('color')}</Label>
              <div className="flex gap-2">
                {BOARD_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewBoard({ ...newBoard, color })}
                    className={`w-7 h-7 rounded-full ${COLOR_DOT[color]} transition-transform ${
                      newBoard.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'
                    }`}
                    aria-label={t(color)}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || !newBoard.name.trim()}>
                {isSubmitting ? t('creating') : t('create_board')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete board confirm */}
      <Dialog open={!!confirmDeleteBoard} onOpenChange={(open) => !open && setConfirmDeleteBoard(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('confirm_delete_board')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">{t('delete_board_warning')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteBoard(null)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteBoard}>{t('delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
