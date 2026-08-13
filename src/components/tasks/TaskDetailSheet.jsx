import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Plus, Trash2, Paperclip, Send, Archive, ArchiveRestore, X,
  CheckSquare, MessageSquare, History, Link2, CalendarDays, Search,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';
import taskBoardsService from '@/api/services/taskBoards';
import { hrService } from '@/api/services';
import { PRIORITY_DOT } from '@/components/tasks/constants';

function InitialCircle({ name, active = true, size = 'w-7 h-7 text-xs' }) {
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
        active ? 'bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)]' : 'bg-slate-400'
      }`}
      title={name}
    >
      {name?.charAt(0)?.toUpperCase()}
    </div>
  );
}

export default function TaskDetailSheet({ boardId, taskId, columns, onClose, onChanged }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canUpdate, canDelete } = usePermissions();
  const canEdit = canUpdate(MODULES.TASKS);

  const [detail, setDetail] = useState(null); // { task, checklist, comments, attachments, links }
  const [activity, setActivity] = useState(null);
  const [showActivity, setShowActivity] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [titleDraft, setTitleDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descDirty, setDescDirty] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);
  const [isSendingComment, setIsSendingComment] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState([]);
  const fileInputRef = useRef(null);

  const task = detail?.task;

  const load = useCallback(async () => {
    try {
      const data = await taskBoardsService.getTask(boardId, taskId);
      setDetail(data);
      setTitleDraft(data.task.title);
      setDescDraft(data.task.description || '');
      setDescDirty(false);
    } catch (error) {
      console.error('Failed to load task:', error);
      toast.error(t('loading_error'));
      onClose();
    }
  }, [boardId, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Employee search for the assignee picker (server-side ILIKE)
  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        // listEmployees resolves to response.data.data — the employees ARRAY
        // itself (SuccessWithPagination), not an {employees: [...]} wrapper.
        const res = await hrService.listEmployees({ search: employeeSearch, limit: 10, status: 'active' });
        setEmployeeResults(Array.isArray(res) ? res : res?.employees ?? []);
      } catch {
        setEmployeeResults([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [employeeSearch]);

  const refresh = async () => { await load(); onChanged?.(); };

  const patchTask = async (payload) => {
    try {
      const data = await taskBoardsService.updateTask(boardId, taskId, payload);
      setDetail(data);
      onChanged?.();
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error(t('saving_error'));
      load();
    }
  };

  const handleTitleSave = () => {
    setEditingTitle(false);
    const title = titleDraft.trim();
    if (!title || title === task.title) { setTitleDraft(task.title); return; }
    patchTask({ title });
  };

  const handleColumnChange = async (columnId) => {
    if (columnId === task.column_id) return;
    try {
      await taskBoardsService.moveTask(boardId, taskId, columnId, 0);
      refresh();
    } catch (error) {
      console.error('Failed to move task:', error);
      toast.error(t('move_failed'));
    }
  };

  const handleToggleAssignee = async (employeeId) => {
    const current = (task.assignees || []).map((a) => a.employee_id);
    const next = current.includes(employeeId)
      ? current.filter((id) => id !== employeeId)
      : [...current, employeeId];
    try {
      const data = await taskBoardsService.setAssignees(boardId, taskId, next);
      setDetail(data);
      onChanged?.();
    } catch (error) {
      console.error('Failed to update assignees:', error);
      toast.error(t('saving_error'));
    }
  };

  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    const title = newChecklistItem.trim();
    if (!title) return;
    setNewChecklistItem('');
    try {
      await taskBoardsService.addChecklistItem(boardId, taskId, title);
      refresh();
    } catch (error) {
      console.error('Failed to add checklist item:', error);
      toast.error(t('saving_error'));
    }
  };

  const handleToggleChecklistItem = async (item) => {
    try {
      await taskBoardsService.updateChecklistItem(boardId, taskId, item.id, { is_done: !item.is_done });
      refresh();
    } catch (error) {
      console.error('Failed to update checklist item:', error);
      toast.error(t('saving_error'));
    }
  };

  const handleDeleteChecklistItem = async (item) => {
    try {
      await taskBoardsService.deleteChecklistItem(boardId, taskId, item.id);
      refresh();
    } catch (error) {
      console.error('Failed to delete checklist item:', error);
      toast.error(t('deleting_error'));
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    const body = commentDraft.trim();
    if (!body || isSendingComment) return;
    setIsSendingComment(true);
    try {
      // Only keep mentions whose name is still present in the final text
      const mentions = commentMentions.filter((m) => body.includes(`@${m.name}`));
      await taskBoardsService.addComment(boardId, taskId, body, mentions);
      setCommentDraft('');
      setCommentMentions([]);
      refresh();
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error(t('saving_error'));
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleMention = (assignee) => {
    if (!assignee.user_id) return;
    setCommentDraft((d) => `${d}${d && !d.endsWith(' ') ? ' ' : ''}@${assignee.name} `);
    setCommentMentions((m) => (
      m.some((x) => x.user_id === assignee.user_id)
        ? m
        : [...m, { user_id: assignee.user_id, name: assignee.name }]
    ));
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await taskBoardsService.uploadAttachment(boardId, taskId, file);
      refresh();
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      toast.error(t('upload_error'));
    }
  };

  const handleDeleteAttachment = async (attachment) => {
    try {
      await taskBoardsService.deleteAttachment(boardId, taskId, attachment.id);
      refresh();
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      toast.error(t('deleting_error'));
    }
  };

  const handleShowActivity = async () => {
    const next = !showActivity;
    setShowActivity(next);
    if (next && !activity) {
      try {
        setActivity(await taskBoardsService.listActivity(boardId, taskId));
      } catch {
        setActivity([]);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await taskBoardsService.deleteTask(boardId, taskId);
      onChanged?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error(t('deleting_error'));
    }
  };

  const checklistPct = task && task.checklist_total > 0
    ? Math.round((task.checklist_done / task.checklist_total) * 100)
    : 0;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {!task ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="flex flex-col">
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 text-left space-y-3">
              {/* Title — inline edit */}
              {editingTitle && canEdit ? (
                <Input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(task.title); }
                  }}
                  className="text-lg font-bold"
                />
              ) : (
                <SheetTitle
                  onClick={() => canEdit && setEditingTitle(true)}
                  className={`text-lg leading-snug ${canEdit ? 'cursor-text hover:bg-slate-50 rounded px-1 -mx-1' : ''}`}
                >
                  {task.title}
                </SheetTitle>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {task.completed_at && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t('completed')}</Badge>
                )}
                {task.is_overdue && (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t('overdue_tasks_stat')}</Badge>
                )}
                {task.archived_at && <Badge variant="outline">{t('archived')}</Badge>}
              </div>
            </SheetHeader>

            <div className="px-6 py-4 space-y-6">
              {/* Properties */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">{t('column')}</p>
                  <Select value={task.column_id} onValueChange={handleColumnChange} disabled={!canEdit}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">{t('priority')}</p>
                  <Select
                    value={task.priority}
                    onValueChange={(v) => patchTask({ priority: v })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['urgent', 'high', 'normal', 'low'].map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[p]}`} />
                            {t(`task_priority_${p}`)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">{t('start_date')}</p>
                  <Input
                    type="date"
                    className="h-9"
                    disabled={!canEdit}
                    value={task.start_date ? task.start_date.slice(0, 10) : ''}
                    onChange={(e) => patchTask({ start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">{t('due_date')}</p>
                  <Input
                    type="date"
                    className="h-9"
                    disabled={!canEdit}
                    value={task.due_date ? task.due_date.slice(0, 10) : ''}
                    onChange={(e) => patchTask({ due_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Assignees */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">{t('assignees')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(task.assignees || []).map((a) => (
                    <span
                      key={a.employee_id}
                      className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-slate-100 text-sm"
                    >
                      <InitialCircle name={a.name} active={a.is_active} size="w-5 h-5 text-[10px]" />
                      <span className={a.is_active ? '' : 'line-through text-slate-400'}>{a.name}</span>
                      {a.job_title && <span className="text-xs text-slate-400">· {a.job_title}</span>}
                      {canEdit && (
                        <button onClick={() => handleToggleAssignee(a.employee_id)} className="text-slate-400 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                  {canEdit && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 rounded-full">
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          {t('add_assignee')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" align="start">
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <Input
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            placeholder={t('search_employees')}
                            className="h-8 pl-8 text-sm"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-0.5">
                          {employeeResults.map((emp) => {
                            const isAssigned = (task.assignees || []).some((a) => a.employee_id === emp.id);
                            return (
                              <button
                                key={emp.id}
                                onClick={() => handleToggleAssignee(emp.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm hover:bg-slate-100 ${
                                  isAssigned ? 'bg-blue-50' : ''
                                }`}
                              >
                                <InitialCircle name={emp.full_name || emp.first_name} size="w-6 h-6 text-[10px]" />
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate font-medium text-slate-800">
                                    {emp.full_name || `${emp.first_name} ${emp.last_name}`}
                                  </span>
                                  <span className="block truncate text-xs text-slate-400">
                                    {[emp.job_position_name || emp.job_title, emp.department_name || emp.department].filter(Boolean).join(' · ')}
                                  </span>
                                </span>
                                {isAssigned && <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                              </button>
                            );
                          })}
                          {employeeResults.length === 0 && (
                            <p className="text-center text-xs text-slate-400 py-4">{t('no_results')}</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">{t('description')}</p>
                <Textarea
                  value={descDraft}
                  disabled={!canEdit}
                  onChange={(e) => { setDescDraft(e.target.value); setDescDirty(true); }}
                  placeholder={t('task_desc_placeholder')}
                  rows={4}
                />
                {descDirty && canEdit && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { setDescDraft(task.description || ''); setDescDirty(false); }}
                    >
                      {t('cancel')}
                    </Button>
                    <Button size="sm" onClick={() => { patchTask({ description: descDraft }); setDescDirty(false); }}>
                      {t('save')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700 flex-1">{t('checklist')}</p>
                  {task.checklist_total > 0 && (
                    <span className="text-xs text-slate-500">{task.checklist_done}/{task.checklist_total}</span>
                  )}
                </div>
                {task.checklist_total > 0 && <Progress value={checklistPct} className="h-1.5" />}
                <div className="space-y-1">
                  {(detail.checklist || []).map((item) => (
                    <div key={item.id} className="group flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={item.is_done}
                        disabled={!canEdit}
                        onChange={() => handleToggleChecklistItem(item)}
                        className="rounded border-slate-300 cursor-pointer"
                      />
                      <span className={`flex-1 text-sm ${item.is_done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {item.title}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteChecklistItem(item)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                    <Input
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder={t('add_checklist_item')}
                      className="h-8 text-sm"
                    />
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={!newChecklistItem.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </form>
                )}
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700 flex-1">{t('attachments')}</p>
                  {canEdit && (
                    <>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
                      <Button variant="outline" size="sm" className="h-7" onClick={() => fileInputRef.current?.click()}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        {t('upload')}
                      </Button>
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  {(detail.attachments || []).map((att) => (
                    <div key={att.id} className="group flex items-center gap-2 py-1 text-sm">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/files/${att.file_name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 truncate text-blue-600 hover:underline"
                      >
                        {att.original_name}
                      </a>
                      <span className="text-xs text-slate-400">{Math.round((att.file_size || 0) / 1024)} KB</span>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteAttachment(att)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {(detail.attachments || []).length === 0 && (
                    <p className="text-xs text-slate-400">{t('no_attachments')}</p>
                  )}
                </div>
              </div>

              {/* Linked records (scaffold) */}
              {(detail.links || []).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">{t('linked_record')}</p>
                  </div>
                  {detail.links.map((link) => (
                    <Badge key={link.id} variant="secondary" className="font-normal">
                      {t(link.linked_module)} · {link.linked_id}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Comments */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">{t('comments')}</p>
                </div>
                <div className="space-y-3">
                  {(detail.comments || []).map((comment) => (
                    <div key={comment.id} className="flex gap-2.5">
                      <InitialCircle name={comment.author_name || '?'} size="w-7 h-7 text-xs" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-slate-800">{comment.author_name}</span>
                          <span className="text-xs text-slate-400">
                            {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{comment.body}</p>
                      </div>
                    </div>
                  ))}
                  {(detail.comments || []).length === 0 && (
                    <p className="text-xs text-slate-400">{t('no_comments_yet')}</p>
                  )}
                </div>
                <form onSubmit={handleSendComment} className="space-y-2">
                  <Textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder={t('write_comment')}
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    {(task.assignees || []).filter((a) => a.user_id).length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-slate-500">@</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1.5" align="start">
                          {(task.assignees || []).filter((a) => a.user_id).map((a) => (
                            <button
                              key={a.employee_id}
                              type="button"
                              onClick={() => handleMention(a)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm hover:bg-slate-100"
                            >
                              <InitialCircle name={a.name} size="w-5 h-5 text-[10px]" active={a.is_active} />
                              {a.name}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                    <Button type="submit" size="sm" className="ml-auto" disabled={!commentDraft.trim() || isSendingComment}>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      {t('send')}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Activity */}
              <div className="space-y-2">
                <button
                  onClick={handleShowActivity}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <History className="w-4 h-4 text-slate-400" />
                  {t('activity_log')}
                </button>
                {showActivity && (
                  <div className="space-y-1.5 border-l-2 border-slate-100 pl-3">
                    {(activity || []).map((entry) => (
                      <div key={entry.id} className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{entry.actor_name || t('system')}</span>{' '}
                        {t(`activity_${entry.action}`) !== `activity_${entry.action}`
                          ? t(`activity_${entry.action}`)
                          : entry.action}
                        {entry.action === 'moved' && entry.new_value?.column && (
                          <span> → {entry.new_value.column}</span>
                        )}
                        <span className="text-slate-400"> · {format(new Date(entry.created_at), 'dd.MM HH:mm')}</span>
                      </div>
                    ))}
                    {activity && activity.length === 0 && (
                      <p className="text-xs text-slate-400">{t('no_results')}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
                <CalendarDays className="w-3.5 h-3.5" />
                {t('created')}: {format(new Date(task.created_at), 'dd.MM.yyyy HH:mm')}
                {task.completed_at && (
                  <span className="text-green-600">
                    · {t('completed')}: {format(new Date(task.completed_at), 'dd.MM.yyyy HH:mm')}
                  </span>
                )}
              </div>

              {/* Danger zone */}
              {(canEdit || canDelete(MODULES.TASKS)) && (
                <div className="flex items-center gap-2 pb-6">
                  {canEdit && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => patchTask({ archived: !task.archived_at })}
                    >
                      {task.archived_at
                        ? <><ArchiveRestore className="w-4 h-4 mr-1.5" />{t('unarchive')}</>
                        : <><Archive className="w-4 h-4 mr-1.5" />{t('archive')}</>}
                    </Button>
                  )}
                  {canDelete(MODULES.TASKS) && (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      {t('delete_task')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete confirm */}
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('confirm_delete_task')}</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>{t('cancel')}</Button>
              <Button variant="destructive" onClick={handleDelete}>{t('delete')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
