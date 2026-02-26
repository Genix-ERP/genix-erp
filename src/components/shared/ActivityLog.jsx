import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Clock,
  History,
  Send,
  Plus,
  Check,
  Calendar,
  Phone,
  Mail,
  Video,
  ClipboardList,
  Bell,
  User,
  MoreVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  Edit3,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from "date-fns";
import { uz } from "date-fns/locale";
import { activityService } from "@/api/services/activity";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { toast } from "sonner";

// Activity types with icons
const ACTIVITY_TYPES = {
  call: { labelKey: "activity_call", icon: Phone, color: "bg-blue-100 text-blue-700" },
  meeting: { labelKey: "activity_meeting", icon: Video, color: "bg-purple-100 text-purple-700" },
  email: { labelKey: "email", icon: Mail, color: "bg-green-100 text-green-700" },
  todo: { labelKey: "activity_task", icon: ClipboardList, color: "bg-orange-100 text-orange-700" },
  reminder: { labelKey: "activity_reminder", icon: Bell, color: "bg-yellow-100 text-yellow-700" },
};

// Log activity types
const LOG_TYPES = {
  create: { labelKey: "log_created", color: "bg-green-100 text-green-700" },
  update: { labelKey: "log_updated", color: "bg-blue-100 text-blue-700" },
  delete: { labelKey: "log_deleted", color: "bg-red-100 text-red-700" },
  comment: { labelKey: "comment", color: "bg-slate-100 text-slate-700" },
  status_change: { labelKey: "log_status_change", color: "bg-purple-100 text-purple-700" },
  assignment: { labelKey: "log_assignment", color: "bg-orange-100 text-orange-700" },
};

// Hook for activity log data
export function useActivityLog(modelName, recordId) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [logs, setLogs] = useState([]);
  const [comments, setComments] = useState([]);
  const [scheduledActivities, setScheduledActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!modelName || !recordId) return;
    try {
      const data = await activityService.listLogs(modelName, recordId);
      setLogs(data || []);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    }
  }, [modelName, recordId]);

  const fetchComments = useCallback(async () => {
    if (!modelName || !recordId) return;
    try {
      const data = await activityService.listComments(modelName, recordId);
      setComments(data || []);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    }
  }, [modelName, recordId]);

  const fetchScheduledActivities = useCallback(async () => {
    if (!modelName || !recordId) return;
    try {
      const data = await activityService.listScheduledActivities(modelName, recordId);
      setScheduledActivities(data || []);
    } catch (error) {
      console.error("Failed to fetch scheduled activities:", error);
    }
  }, [modelName, recordId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLogs(), fetchComments(), fetchScheduledActivities()]);
    setLoading(false);
  }, [fetchLogs, fetchComments, fetchScheduledActivities]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = async (content) => {
    try {
      await activityService.createComment(modelName, recordId, { content });
      await fetchComments();
      await fetchLogs();
      toast.success("Izoh qo'shildi");
    } catch (error) {
      toast.error("Izoh qo'shishda xatolik");
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await activityService.deleteComment(commentId);
      await fetchComments();
      toast.success("Izoh o'chirildi");
    } catch (error) {
      toast.error("Izohni o'chirishda xatolik");
    }
  };

  const scheduleActivity = async (data) => {
    try {
      await activityService.createScheduledActivity(modelName, recordId, data);
      await fetchScheduledActivities();
      toast.success(t('activity_scheduled') || "Activity scheduled");
    } catch (error) {
      toast.error(t('activity_schedule_error') || "Error scheduling activity");
    }
  };

  const completeActivity = async (activityId) => {
    try {
      await activityService.completeScheduledActivity(activityId);
      await fetchScheduledActivities();
      await fetchLogs();
      toast.success(t('activity_completed') || "Activity completed");
    } catch (error) {
      toast.error(t('error_occurred') || "An error occurred");
    }
  };

  return {
    logs,
    comments,
    scheduledActivities,
    loading,
    refresh,
    addComment,
    deleteComment,
    scheduleActivity,
    completeActivity,
  };
}

// Comment Input Component
function CommentInput({ onSubmit, placeholder }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const displayPlaceholder = placeholder || t('write_comment') || "Write a comment...";
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent("");
      setIsExpanded(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-white">
      {isExpanded ? (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={displayPlaceholder}
            rows={3}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsExpanded(false);
                setContent("");
              }}
            >
              {t('cancel') || 'Cancel'}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
              <Send className="w-4 h-4 mr-1" />
              {t('send') || 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <button
          className="w-full text-left text-slate-500 hover:text-slate-700"
          onClick={() => setIsExpanded(true)}
        >
          {displayPlaceholder}
        </button>
      )}
    </div>
  );
}

// Activity Timeline Item
function ActivityTimelineItem({ log }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const logType = LOG_TYPES[log.activity_type] || LOG_TYPES.update;
  const [showChanges, setShowChanges] = useState(false);

  const hasFieldChanges =
    log.field_changes && Object.keys(log.field_changes).length > 0;

  return (
    <div className="flex gap-3 pb-4 border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
        <History className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{log.user_name || t('system') || "System"}</span>
          <Badge variant="outline" className={`text-xs ${logType.color}`}>
            {t(logType.labelKey)}
          </Badge>
          {log.old_status && log.new_status && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span className="px-1.5 py-0.5 bg-slate-100 rounded">{log.old_status}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                {log.new_status}
              </span>
            </div>
          )}
        </div>
        {log.title && <p className="text-sm text-slate-700 mt-1">{log.title}</p>}
        {log.description && (
          <p className="text-sm text-slate-500 mt-0.5">{log.description}</p>
        )}
        {hasFieldChanges && (
          <button
            className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1"
            onClick={() => setShowChanges(!showChanges)}
          >
            {showChanges ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {t('view_changes') || 'View changes'}
          </button>
        )}
        {showChanges && hasFieldChanges && (
          <div className="mt-2 p-2 bg-slate-50 rounded text-xs space-y-1">
            {Object.entries(log.field_changes).map(([field, changes]) => (
              <div key={field} className="flex items-center gap-2">
                <span className="font-medium text-slate-600">{field}:</span>
                <span className="text-red-500 line-through">{changes.old || "-"}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="text-green-600">{changes.new || "-"}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1">
          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: uz })}
        </p>
      </div>
    </div>
  );
}

// Comment Item
function CommentItem({ comment, onDelete }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <div className="flex gap-3 pb-4 border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
        {comment.user_name?.charAt(0) || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{comment.user_name || t('user') || "User"}</span>
            <span className="text-xs text-slate-400">
              {format(new Date(comment.created_at), "dd.MM.yyyy HH:mm")}
            </span>
          </div>
          {onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDelete(comment.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('delete') || 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{comment.content}</p>
        {/* Threaded replies */}
        {comment.replies?.length > 0 && (
          <div className="mt-3 ml-4 pl-4 border-l-2 border-slate-200 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Scheduled Activity Item
function ScheduledActivityItem({ activity, onComplete }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const activityType = ACTIVITY_TYPES[activity.activity_type] || ACTIVITY_TYPES.todo;
  const Icon = activityType.icon;

  const isOverdue = isPast(new Date(activity.due_date)) && activity.status === "pending";
  const isDueToday = isToday(new Date(activity.due_date));
  const isDueTomorrow = isTomorrow(new Date(activity.due_date));

  const getDueDateLabel = () => {
    if (isDueToday) return t('today') || "Today";
    if (isDueTomorrow) return t('tomorrow') || "Tomorrow";
    return format(new Date(activity.due_date), "dd.MM.yyyy");
  };

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        isOverdue
          ? "bg-red-50 border-red-200"
          : isDueToday
          ? "bg-orange-50 border-orange-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${activityType.color}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{activity.summary}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={`text-xs ${
                  isOverdue ? "bg-red-100 text-red-700" : "bg-slate-100"
                }`}
              >
                <Calendar className="w-3 h-3 mr-1" />
                {getDueDateLabel()}
                {activity.due_time && ` ${activity.due_time}`}
              </Badge>
              {activity.assigned_to_name && (
                <Badge variant="outline" className="text-xs">
                  <User className="w-3 h-3 mr-1" />
                  {activity.assigned_to_name}
                </Badge>
              )}
            </div>
          </div>
          {activity.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:bg-green-50"
              onClick={() => onComplete(activity.id)}
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
          {activity.status === "done" && (
            <Badge className="bg-green-100 text-green-700">
              <Check className="w-3 h-3 mr-1" />
              {t('done') || 'Done'}
            </Badge>
          )}
        </div>
        {activity.note && (
          <p className="text-sm text-slate-500 mt-2">{activity.note}</p>
        )}
      </div>
    </div>
  );
}

// Schedule Activity Modal
function ScheduleActivityModal({ open, onClose, onSubmit, users = [] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [form, setForm] = useState({
    activity_type: "todo",
    summary: "",
    note: "",
    due_date: format(new Date(), "yyyy-MM-dd"),
    due_time: "",
    assigned_to: "",
  });

  const handleSubmit = () => {
    if (!form.summary || !form.due_date) {
      toast.error(t('fill_required_fields') || "Please fill in required fields");
      return;
    }
    onSubmit(form);
    setForm({
      activity_type: "todo",
      summary: "",
      note: "",
      due_date: format(new Date(), "yyyy-MM-dd"),
      due_time: "",
      assigned_to: "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('schedule_activity') || 'Schedule Activity'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('type') || 'Type'}</label>
            <Select
              value={form.activity_type}
              onValueChange={(value) => setForm({ ...form, activity_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_TYPES).map(([key, { labelKey, icon: Icon }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {t(labelKey)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('title') || 'Title'} *</label>
            <Input
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder={t('activity_title') || "Activity title"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t('date') || 'Date'} *</label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t('time') || 'Time'}</label>
              <Input
                type="time"
                value={form.due_time}
                onChange={(e) => setForm({ ...form, due_time: e.target.value })}
              />
            </div>
          </div>

          {users.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1 block">{t('assignee') || 'Assignee'}</label>
              <Select
                value={form.assigned_to}
                onValueChange={(value) => setForm({ ...form, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select') || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">{t('note') || 'Note'}</label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t('additional_info') || "Additional information..."}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel') || 'Cancel'}
          </Button>
          <Button onClick={handleSubmit}>
            <Plus className="w-4 h-4 mr-1" />
            {t('add') || 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Activity Log Component
export function ActivityLogPanel({
  modelName,
  recordId,
  users = [],
  readOnly = false,
  maxHeight = "500px",
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    logs,
    comments,
    scheduledActivities,
    loading,
    refresh,
    addComment,
    deleteComment,
    scheduleActivity,
    completeActivity,
  } = useActivityLog(modelName, recordId);

  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const pendingActivities = scheduledActivities.filter((a) => a.status === "pending");

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-slate-600" />
          <span className="font-semibold">{t('activity') || 'Activity'}</span>
          {pendingActivities.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {pendingActivities.length} {t('pending') || 'pending'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={() => setShowScheduleModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              {t('schedule') || 'Schedule'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chatter" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="chatter" className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {t('comments') || 'Comments'}
              {comments.length > 0 && (
                <Badge variant="outline" className="ml-1 text-xs">
                  {comments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {t('plans') || 'Plans'}
              {pendingActivities.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {pendingActivities.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <History className="w-4 h-4" />
              {t('history') || 'History'}
              {logs.length > 0 && (
                <Badge variant="outline" className="ml-1 text-xs">
                  {logs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chatter">
            <div className="space-y-4">
              {!readOnly && <CommentInput onSubmit={addComment} />}
              <ScrollArea style={{ maxHeight }}>
                <div className="space-y-4 pr-4">
                  {comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('no_comments') || 'No comments'}</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        onDelete={readOnly ? null : deleteComment}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="activities">
            <ScrollArea style={{ maxHeight }}>
              <div className="space-y-3 pr-4">
                {scheduledActivities.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t('no_scheduled_activities') || 'No scheduled activities'}</p>
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setShowScheduleModal(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {t('schedule') || 'Schedule'}
                      </Button>
                    )}
                  </div>
                ) : (
                  scheduledActivities.map((activity) => (
                    <ScheduledActivityItem
                      key={activity.id}
                      activity={activity}
                      onComplete={completeActivity}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history">
            <ScrollArea style={{ maxHeight }}>
              <div className="space-y-4 pr-4">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t('no_activity_history') || 'No activity history'}</p>
                  </div>
                ) : (
                  logs.map((log) => <ActivityTimelineItem key={log.id} log={log} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>

      <ScheduleActivityModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSubmit={scheduleActivity}
        users={users}
      />
    </Card>
  );
}

export default ActivityLogPanel;
