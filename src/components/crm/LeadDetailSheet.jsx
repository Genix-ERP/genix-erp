import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Phone, Mail, Send, Pencil, Trash2, Trophy, XCircle, Sparkles, Copy,
  ListTodo, MessageSquare, ArrowRightLeft, Clock, PhoneCall, StickyNote,
  CheckCircle2, Circle, Loader2, User, Building2, Handshake, ShoppingBag,
} from 'lucide-react';
import { useTranslation } from '@/components/utils/translations';
import { useToast } from '@/components/ui/use-toast';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { leadsService } from '@/api/services/leads';
import { activitiesService } from '@/api/services/crm';
import { orderStatusClass, orderStatusLabel } from '@/components/sales/orderStatus';
import taskBoardsService from '@/api/services/taskBoards';
import { formatDate, formatDateTime } from '@/utils/formatDate';

const telegramHref = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://t.me/+${digits}` : null;
};

const daysSince = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const TIMELINE_ICONS = {
  stage_change: ArrowRightLeft,
  field_change: Pencil,
  activity: StickyNote,
  call: PhoneCall,
};

// Right-hand side panel for one lead (same Sheet pattern as Vazifalar's
// TaskDetailSheet): contact info, amount, stage move, activity timeline,
// linked tasks, quick actions, AI "keyingi qadam".
export default function LeadDetailSheet({
  leadId,
  onClose,
  onEdit,
  onDelete,
  onCall,
  onWin,
  onLose,
  onChanged,
  stages = [],
  stageLabel = (s) => s?.name || '',
  language = 'uz',
}) {
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const { formatCurrency } = useCurrencyFormatter();

  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [loading, setLoading] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [taskDialog, setTaskDialog] = useState(false);
  const [boards, setBoards] = useState([]);
  const [taskForm, setTaskForm] = useState({ board_id: '', title: '', due_date: '' });
  const [savingTask, setSavingTask] = useState(false);

  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const [l, tl, tk, so] = await Promise.all([
        leadsService.get(leadId),
        leadsService.getTimeline(leadId).catch(() => []),
        leadsService.getTasks(leadId).catch(() => []),
        leadsService.listSalesOrders(leadId).catch(() => []),
      ]);
      setLead(l);
      setTimeline(tl);
      setTasks(tk);
      setOrders(so);
    } catch (err) {
      console.warn('Failed to load lead:', err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    setLead(null);
    setTimeline([]);
    setTasks([]);
    setOrders([]);
    setAiSuggestion(null);
    setNoteText('');
    if (leadId) load();
  }, [leadId, load]);

  const open = !!leadId;
  const isTerminal = !!(lead?.won_at || lead?.lost_at);
  const stale = daysSince(lead?.last_activity_at);
  const isStale = stale != null && stale >= 7 && !isTerminal;

  const moveToStage = async (stageId) => {
    if (!lead || stageId === lead.stage_id) return;
    const target = stages.find((s) => s.id === stageId);
    if (target?.is_won) { onWin?.(lead); return; }
    if (target?.is_lost) { onLose?.(lead); return; }
    try {
      await leadsService.move(lead.id, stageId);
      await load();
      onChanged?.();
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'WON_FLOW_REQUIRED') { onWin?.(lead); return; }
      if (code === 'LOST_REASON_REQUIRED') { onLose?.(lead); return; }
      toast({ variant: 'destructive', title: t('error') || 'Error', description: err.response?.data?.error?.message || '' });
    }
  };

  const saveNote = async () => {
    if (!noteText.trim() || !lead) return;
    setSavingNote(true);
    try {
      await activitiesService.create({
        activity_type: 'note',
        subject: `${t('action_note') || 'Izoh'} — ${lead.contact_name || ''}`.trim(),
        description: noteText.trim(),
        status: 'completed',
        priority: 'low',
        lead_id: lead.id,
      });
      setNoteText('');
      await load();
      onChanged?.();
    } catch (err) {
      toast({ variant: 'destructive', title: t('error') || 'Error', description: err.response?.data?.error?.message || '' });
    } finally {
      setSavingNote(false);
    }
  };

  const openTaskDialog = async () => {
    setTaskDialog(true);
    try {
      const res = await taskBoardsService.listBoards();
      const list = Array.isArray(res) ? res : res?.boards || [];
      setBoards(list);
      if (list.length > 0) setTaskForm((f) => ({ ...f, board_id: f.board_id || list[0].id }));
    } catch {
      setBoards([]);
    }
  };

  const createLinkedTask = async () => {
    if (!taskForm.board_id || !taskForm.title.trim() || !lead) return;
    setSavingTask(true);
    try {
      const created = await taskBoardsService.createTask(taskForm.board_id, {
        title: taskForm.title.trim(),
        due_date: taskForm.due_date || undefined,
      });
      const taskId = created?.id || created?.task?.id;
      if (taskId) {
        await taskBoardsService.addTaskLink(taskForm.board_id, taskId, 'crm_lead', lead.id);
      }
      setTaskDialog(false);
      setTaskForm({ board_id: taskForm.board_id, title: '', due_date: '' });
      toast({ title: t('crm_task_created') || 'Vazifa yaratildi' });
      await load();
      onChanged?.();
    } catch (err) {
      toast({ variant: 'destructive', title: t('error') || 'Error', description: err.response?.data?.error?.message || '' });
    } finally {
      setSavingTask(false);
    }
  };

  // Won-deal handoff: draft a sales order linked to this lead's partner.
  const createOrderFromLead = async () => {
    if (!lead?.partner_id || creatingOrder) return;
    setCreatingOrder(true);
    try {
      const order = await leadsService.createSalesOrder(lead.id);
      toast({
        title: t('success') || 'Muvaffaqiyat',
        description: order?.order_number
          ? `${t('lead_orders_title') || 'Buyurtmalar'}: ${order.order_number}`
          : undefined,
      });
      const so = await leadsService.listSalesOrders(lead.id).catch(() => null);
      if (so) setOrders(so);
      onChanged?.();
    } catch (err) {
      const msg = err.response?.status === 400
        ? (t('lead_not_won_yet') || "Lid hali yutilmagan — avval bitimni yakunlang")
        : err.response?.data?.error?.message || '';
      toast({ variant: 'destructive', title: t('error') || 'Error', description: msg });
    } finally {
      setCreatingOrder(false);
    }
  };

  const askAI = async () => {
    if (!lead) return;
    setAiLoading(true);
    try {
      const res = await leadsService.aiNextStep(lead.id);
      if (res?.ai_configured === false) {
        toast({ title: t('crm_ai_not_configured') || 'AI sozlanmagan', description: t('crm_ai_not_configured_hint') || 'Sozlamalar → AI bo‘limida provayderni ulang.' });
      } else if (res?.suggestion) {
        setAiSuggestion(res.suggestion);
      } else {
        toast({ variant: 'destructive', title: t('error') || 'Error', description: t('crm_ai_unavailable') || 'AI javob bermadi' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: t('error') || 'Error', description: err.response?.data?.error?.message || '' });
    } finally {
      setAiLoading(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard?.writeText(text);
    toast({ title: t('copied') || 'Nusxalandi' });
  };

  const renderTimelineItem = (item, i) => {
    const Icon = TIMELINE_ICONS[item.type] || Clock;
    let body = null;
    if (item.type === 'stage_change') {
      body = (
        <span>
          {item.data.from_stage
            ? <>{item.data.from_stage} <span className="text-slate-400">→</span> {item.data.to_stage}</>
            : <>{t('crm_created_in_stage') || 'Yaratildi'}: {item.data.to_stage}</>}
        </span>
      );
    } else if (item.type === 'field_change') {
      const keys = Object.keys(item.data.new || {});
      body = <span>{(t('crm_fields_changed') || "O'zgartirildi")}: {keys.join(', ')}</span>;
    } else if (item.type === 'activity') {
      body = (
        <span>
          <span className="font-medium">{item.data.subject || item.data.activity_type}</span>
          {item.data.description ? <span className="block text-slate-500">{item.data.description}</span> : null}
        </span>
      );
    } else if (item.type === 'call') {
      body = (
        <span>
          {t(item.data.call_type) || item.data.call_type}
          {item.data.duration > 0 && ` · ${Math.round(item.data.duration / 60)} ${t('crm_min') || 'min'}`}
          {item.data.outcome && ` · ${item.data.outcome}`}
        </span>
      );
    }
    return (
      <div key={i} className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
            <Icon className="h-3 w-3 text-slate-500" />
          </div>
          <div className="w-px flex-1 bg-slate-100" />
        </div>
        <div className="pb-4 text-xs">
          <div className="text-slate-700">{body}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {formatDateTime(item.at)}{item.by ? ` · ${item.by}` : ''}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {loading && !lead ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : lead ? (
          <>
            {/* Header */}
            <SheetHeader className="space-y-3 border-b border-slate-100 p-5 pr-12 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg">{lead.contact_name}</SheetTitle>
                  {lead.company_name && (
                    <p className="flex items-center gap-1 text-sm text-slate-500">
                      <Building2 className="h-3.5 w-3.5" /> {lead.company_name}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {onEdit && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(lead)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(lead)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* status banner / stage move */}
              {lead.won_at ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  <Trophy className="h-4 w-4" />
                  {t('crm_won_at') || 'Yutilgan'}: {formatDate(lead.won_at)}
                  {lead.partner_name && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-normal">
                      <Handshake className="h-3.5 w-3.5" /> {lead.partner_name}
                    </span>
                  )}
                </div>
              ) : lead.lost_at ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <div className="flex items-center gap-2 font-medium">
                    <XCircle className="h-4 w-4" />
                    {t('crm_lost_at') || "Yo'qotilgan"}: {formatDate(lead.lost_at)}
                  </div>
                  {lead.lost_reason_name && (
                    <p className="mt-0.5 pl-6 text-xs">{lead.lost_reason_name}{lead.lost_note ? ` — ${lead.lost_note}` : ''}</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={lead.stage_id || ''} onValueChange={moveToStage}>
                    <SelectTrigger className="h-8 w-[200px] text-sm">
                      <SelectValue placeholder={t('crm_stage') || 'Bosqich'} />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.filter((s) => !s.is_won && !s.is_lost).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{stageLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onWin?.(lead)}>
                    <Trophy className="mr-1 h-3.5 w-3.5" />
                    {t('crm_won') || 'Yutilgan'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50" onClick={() => onLose?.(lead)}>
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    {t('crm_lost') || "Yo'qotilgan"}
                  </Button>
                </div>
              )}
            </SheetHeader>

            <div className="space-y-5 p-5">
              {/* Amount + meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t('crm_deal_amount') || 'Bitim summasi'}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {Number(lead.expected_value) > 0
                      ? (formatCurrency ? formatCurrency(Number(lead.expected_value)) : Number(lead.expected_value).toLocaleString())
                      : <span className="text-sm font-normal italic text-slate-400">{t('crm_no_amount') || 'Kiritilmagan'}</span>}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t('crm_responsible') || "Mas'ul"}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {lead.responsible_name || lead.assigned_to_name || '—'}
                  </p>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('contact_information') || "Bog'lanish"}</p>
                <div className="flex flex-wrap gap-2">
                  {lead.phone && (
                    <>
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <Phone className="h-3.5 w-3.5 text-emerald-600" /> {lead.phone}
                      </a>
                      {telegramHref(lead.phone) && (
                        <a href={telegramHref(lead.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                          <Send className="h-3.5 w-3.5 text-sky-500" /> Telegram
                        </a>
                      )}
                      {onCall && (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => onCall(lead)}>
                          <PhoneCall className="mr-1 h-3.5 w-3.5" />
                          {t('crm_call_via_pbx') || "Qo'ng'iroq"}
                        </Button>
                      )}
                    </>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <Mail className="h-3.5 w-3.5 text-blue-500" /> {lead.email}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                  {lead.source && <span>{t('source') || 'Manba'}: <span className="font-medium text-slate-700">{t(lead.source) || lead.source}</span></span>}
                  <span>{t('created') || 'Yaratilgan'}: {formatDate(lead.created_at)}</span>
                  {lead.last_activity_at && (
                    <span className={isStale ? 'font-medium text-amber-600' : ''}>
                      {t('crm_last_activity') || 'Oxirgi faollik'}: {formatDate(lead.last_activity_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* AI keyingi qadam */}
              {!isTerminal && (
                <div className="space-y-2">
                  {!aiSuggestion ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={askAI}
                      disabled={aiLoading}
                      className={`w-full justify-center border-dashed ${isStale ? 'border-amber-300 text-amber-700' : 'text-slate-600'}`}
                    >
                      {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-[var(--genix-purple)]" />}
                      {t('crm_ai_next_step') || 'AI: keyingi qadam tavsiyasi'}
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('crm_ai_suggestion') || 'AI tavsiyasi'}
                      </p>
                      {aiSuggestion.next_step && <p className="text-sm text-slate-700">{aiSuggestion.next_step}</p>}
                      {aiSuggestion.message && (
                        <div className="rounded-lg border border-purple-100 bg-white p-2.5 text-sm text-slate-700">
                          {aiSuggestion.message}
                          <Button variant="ghost" size="sm" className="mt-1.5 h-7 w-full text-xs" onClick={() => copyText(aiSuggestion.message)}>
                            <Copy className="mr-1 h-3 w-3" />
                            {t('crm_copy_message') || 'Xabarni nusxalash'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tasks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('crm_tasks') || 'Vazifalar'} {tasks.length > 0 && `(${tasks.length})`}
                  </p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-[var(--genix-blue)]" onClick={openTaskDialog}>
                    <ListTodo className="mr-1 h-3.5 w-3.5" />
                    {t('crm_add_task') || "Vazifa qo'yish"}
                  </Button>
                </div>
                {tasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 py-3 text-center text-xs text-slate-400">
                    {t('crm_no_tasks_yet') || "Bog'langan vazifalar yo'q"}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        {task.completed
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                        <span className={`min-w-0 flex-1 truncate ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {task.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {task.board_name}{task.due_date ? ` · ${formatDate(task.due_date)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sales orders (won-deal handoff) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('lead_orders_title') || 'Buyurtmalar'} {orders.length > 0 && `(${orders.length})`}
                  </p>
                  {lead.partner_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-[var(--genix-blue)]"
                      onClick={createOrderFromLead}
                      disabled={creatingOrder}
                    >
                      {creatingOrder
                        ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        : <ShoppingBag className="mr-1 h-3.5 w-3.5" />}
                      {t('lead_create_order') || 'Buyurtma yaratish'}
                    </Button>
                  )}
                </div>
                {orders.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 py-3 text-center text-xs text-slate-400">
                    {lead.partner_id
                      ? (t('lead_orders_empty') || "Bog'langan buyurtmalar yo'q")
                      : (t('lead_not_won_yet') || "Buyurtma yaratish uchun avval bitimni yutilgan deb belgilang")}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {orders.map((order) => (
                      <div key={order.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <ShoppingBag className="h-4 w-4 shrink-0 text-slate-300" />
                        <span className="min-w-0 flex-1 truncate font-mono font-medium text-slate-700">
                          {order.order_number}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${orderStatusClass(order.status)}`}>
                          {orderStatusLabel(t, order.status)}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {order.order_date ? formatDate(order.order_date) : ''}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-800 tabular-nums">
                          {formatCurrency
                            ? formatCurrency(Number(order.total_amount) || 0)
                            : (Number(order.total_amount) || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick note */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('crm_add_note') || 'Izoh yozish'}</p>
                <div className="flex gap-2">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    placeholder={t('crm_note_placeholder') || 'Muzokara natijasi, kelishuvlar...'}
                    className="text-sm"
                  />
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={saveNote} disabled={!noteText.trim() || savingNote}>
                  {savingNote ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="mr-1 h-3.5 w-3.5" />}
                  {t('save') || 'Saqlash'}
                </Button>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('crm_timeline') || 'Faoliyat tarixi'}</p>
                {timeline.length === 0 ? (
                  <p className="py-2 text-xs text-slate-400">{t('crm_no_activity') || "Hozircha faoliyat yo'q"}</p>
                ) : (
                  <div>{timeline.map(renderTimelineItem)}</div>
                )}
              </div>
            </div>

            {/* Task dialog */}
            <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('crm_add_task') || "Vazifa qo'yish"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">{t('crm_task_board') || 'Doska'}</label>
                    <Select value={taskForm.board_id} onValueChange={(v) => setTaskForm((f) => ({ ...f, board_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('crm_select_board') || 'Doskani tanlang'} /></SelectTrigger>
                      <SelectContent>
                        {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {boards.length === 0 && (
                      <p className="text-xs text-amber-600">{t('crm_no_boards') || "Avval Vazifalar bo'limida doska yarating"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">{t('crm_task_title') || 'Vazifa'}</label>
                    <Input
                      value={taskForm.title}
                      onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={t('crm_task_title_placeholder') || "Masalan: Taklif yuborish"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">{t('due_date') || 'Muddat'}</label>
                    <Input
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTaskDialog(false)}>{t('cancel') || 'Bekor qilish'}</Button>
                  <Button onClick={createLinkedTask} disabled={!taskForm.board_id || !taskForm.title.trim() || savingTask}>
                    {savingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('create') || 'Yaratish'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
