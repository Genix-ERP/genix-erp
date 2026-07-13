import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Flag, CheckCircle2, Clock, AlertTriangle, ListTodo } from 'lucide-react';
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, eachWeekOfInterval, endOfWeek, addMonths, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uz } from 'date-fns/locale/uz';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const getDateLocale = (lang) => (lang === 'ru' ? ru : lang === 'uz' ? uz : undefined);
const ROW = 'h-12';

export default function GanttChart({ tasks = [], milestones = [], projectStartDate, projectEndDate }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const dateLocale = getDateLocale(language);
  const localeOpt = dateLocale ? { locale: dateLocale } : {};
  const today = startOfDay(new Date());

  const [viewMode, setViewMode] = useState('month');
  const scrollRef = useRef(null);

  const parse = (d) => { if (!d) return null; const dt = new Date(d); return isNaN(dt) ? null : dt; };
  const taskSpan = (task) => {
    const due = parse(task.due_date);
    let start = parse(task.start_date) || parse(task.created_at);
    if (!due && !start) return null;
    const end = due || start;
    if (!start || start > end) start = addDays(end, -3);
    return { start, end };
  };
  const isOverdue = (task) => {
    const due = parse(task.due_date);
    return due && startOfDay(due) < today && task.status !== 'completed';
  };

  // Group tasks under their milestone; ungrouped go into "Other"
  const groups = useMemo(() => {
    const byId = {};
    milestones.forEach(m => { byId[m.id] = { milestone: m, tasks: [] }; });
    const ungrouped = [];
    tasks.forEach(tk => {
      if (tk.milestone_id && byId[tk.milestone_id]) byId[tk.milestone_id].tasks.push(tk);
      else ungrouped.push(tk);
    });
    const ordered = milestones.slice()
      .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
      .map(m => byId[m.id]);
    return { ordered, ungrouped };
  }, [tasks, milestones]);

  const range = useMemo(() => {
    let start = parse(projectStartDate), end = parse(projectEndDate);
    if (!start || !end) {
      const dates = [];
      tasks.forEach(tk => { const s = taskSpan(tk); if (s) dates.push(s.start, s.end); });
      milestones.forEach(m => { const d = parse(m.due_date || m.target_date); if (d) dates.push(d); });
      dates.push(today);
      start = new Date(Math.min(...dates));
      end = new Date(Math.max(...dates));
    }
    return { start: addDays(start, -7), end: addDays(end, 10) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, milestones, projectStartDate, projectEndDate]);

  const columns = useMemo(() => {
    const { start, end } = range;
    if (viewMode === 'week') {
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(ws => ({
        key: format(ws, 'yyyy-MM-dd'),
        label: `${format(ws, 'dd MMM', localeOpt)} – ${format(endOfWeek(ws, { weekStartsOn: 1 }), 'dd MMM', localeOpt)}`,
      }));
    }
    const months = []; let cur = startOfMonth(start); const last = endOfMonth(end);
    while (cur <= last) { months.push({ key: format(cur, 'yyyy-MM'), label: format(cur, 'MMM yyyy', localeOpt) }); cur = addMonths(cur, 1); }
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, viewMode, language]);

  const pct = (date) => {
    const total = Math.max(differenceInDays(range.end, range.start), 1);
    return (differenceInDays(date, range.start) / total) * 100;
  };
  const barFor = (task) => {
    const span = taskSpan(task); if (!span) return null;
    const left = Math.max(0, pct(span.start));
    const right = Math.min(100, pct(span.end));
    return { left, width: Math.max(1.5, right - left) };
  };

  const statusColor = (s) => ({ completed: 'bg-green-500', in_progress: 'bg-blue-500', review: 'bg-amber-500', todo: 'bg-slate-400' }[s] || 'bg-slate-400');
  const todayPos = pct(today);
  const hasData = tasks.length > 0 || milestones.length > 0;

  const stats = {
    total: tasks.length,
    completed: tasks.filter(tk => tk.status === 'completed').length,
    inProgress: tasks.filter(tk => tk.status === 'in_progress').length,
    overdue: tasks.filter(isOverdue).length,
  };

  // Build flat render rows preserving group structure
  const renderRows = [];
  groups.ordered.forEach(g => {
    renderRows.push({ type: 'group', milestone: g.milestone });
    g.tasks.forEach(tk => renderRows.push({ type: 'task', task: tk }));
  });
  if (groups.ungrouped.length) {
    renderRows.push({ type: 'group', milestone: null });
    groups.ungrouped.forEach(tk => renderRows.push({ type: 'task', task: tk }));
  }

  const summary = [
    { label: t('total_tasks') || 'Total', value: stats.total, icon: ListTodo, cls: 'text-slate-700', bg: 'bg-slate-100' },
    { label: t('in_progress') || 'In progress', value: stats.inProgress, icon: Clock, cls: 'text-blue-600', bg: 'bg-blue-100' },
    { label: t('completed') || 'Completed', value: stats.completed, icon: CheckCircle2, cls: 'text-green-600', bg: 'bg-green-100' },
    { label: t('overdue') || 'Overdue', value: stats.overdue, icon: AlertTriangle, cls: 'text-red-600', bg: 'bg-red-100' },
  ];

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5" />
            {t('timeline') || 'Timeline'}
          </CardTitle>
          {hasData && (
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{t('week_view') || 'Week view'}</SelectItem>
                <SelectItem value="month">{t('month_view') || 'Month view'}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {hasData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {summary.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg} ${s.cls}`}><Icon className="w-5 h-5" /></div>
                  <div>
                    <div className={`text-xl font-bold leading-none ${s.cls}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="py-16 text-center text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>{t('no_tasks_to_display') || 'Nothing to show on the timeline yet'}</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex">
              {/* Fixed left column */}
              <div className="w-60 shrink-0 border-r border-slate-200">
                <div className="h-11 px-4 flex items-center font-semibold text-sm bg-slate-50 border-b border-slate-200">
                  {t('task_name') || 'Name'}
                </div>
                {renderRows.map((r, i) => r.type === 'group' ? (
                  <div key={`g-${i}`} className={`${ROW} px-4 flex items-center gap-2 bg-slate-50/80 border-b border-slate-200`}>
                    <Flag className={`w-3.5 h-3.5 shrink-0 ${r.milestone?.status === 'completed' ? 'text-green-500' : 'text-amber-500'}`} fill="currentColor" />
                    <span className="text-sm font-semibold truncate text-slate-700" title={r.milestone?.title}>
                      {r.milestone ? r.milestone.title : (t('other_tasks') || 'Other tasks')}
                    </span>
                  </div>
                ) : (
                  <div key={r.task.id} className={`${ROW} pl-7 pr-4 flex flex-col justify-center border-b border-slate-100`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(r.task.status)}`} />
                      <span className="text-sm truncate" title={r.task.title}>{r.task.title}</span>
                    </div>
                    {r.task.assignee && <div className="text-xs text-slate-400 truncate pl-4">{r.task.assignee}</div>}
                  </div>
                ))}
              </div>

              {/* Scrollable timeline */}
              <div className="flex-1 overflow-x-auto" ref={scrollRef}>
                <div className="min-w-[680px] relative">
                  {/* Header */}
                  <div className="flex h-11 bg-slate-50 border-b border-slate-200">
                    {columns.map((c) => (
                      <div key={c.key} className="flex-1 min-w-[100px] px-2 flex items-center justify-center text-xs font-medium text-slate-500 border-r border-slate-100 text-center">
                        {c.label}
                      </div>
                    ))}
                  </div>

                  {/* Vertical gridlines */}
                  <div className="absolute top-11 bottom-0 left-0 right-0 flex pointer-events-none">
                    {columns.map((c) => <div key={c.key} className="flex-1 min-w-[100px] border-r border-slate-100" />)}
                  </div>

                  {/* Today line */}
                  {todayPos >= 0 && todayPos <= 100 && (
                    <div className="absolute top-11 bottom-0 w-px bg-red-400 z-20 pointer-events-none" style={{ left: `${todayPos}%` }}>
                      <div className="absolute top-0 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-b">{t('today') || 'Today'}</div>
                    </div>
                  )}

                  {/* Rows */}
                  {renderRows.map((r, i) => {
                    if (r.type === 'group') {
                      const d = parse(r.milestone?.due_date || r.milestone?.target_date);
                      const pos = d ? pct(d) : null;
                      return (
                        <div key={`g-${i}`} className={`${ROW} border-b border-slate-200 bg-slate-50/40 relative`}>
                          {pos != null && pos >= 0 && pos <= 100 && (
                            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10" style={{ left: `${pos}%` }}>
                              <Flag className={`w-4 h-4 ${r.milestone?.status === 'completed' ? 'text-green-500' : 'text-amber-500'}`} fill="currentColor" />
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">{format(d, 'dd MMM', localeOpt)}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    const bar = barFor(r.task);
                    const overdue = isOverdue(r.task);
                    return (
                      <div key={r.task.id} className={`${ROW} border-b border-slate-100 relative hover:bg-slate-50/60`}>
                        {bar ? (
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md ${statusColor(r.task.status)} ${overdue ? 'ring-2 ring-red-400' : ''} flex items-center px-2 overflow-hidden shadow-sm`}
                            style={{ left: `${bar.left}%`, width: `${bar.width}%`, minWidth: '28px' }}
                            title={`${r.task.title}${r.task.due_date ? ' · ' + format(parse(r.task.due_date), 'dd MMM yyyy', localeOpt) : ''}`}
                          >
                            {bar.width > 14 && <span className="text-white text-xs font-medium truncate">{r.task.title}</span>}
                          </div>
                        ) : (
                          <div className="h-full flex items-center pl-2 text-xs text-slate-300">{t('no_date') || 'No date'}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
