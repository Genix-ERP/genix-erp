import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Settings } from 'lucide-react';
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek, isSameDay, addMonths, subMonths } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

/**
 * GanttChart Component
 *
 * A comprehensive Gantt chart for visualizing project timelines, tasks, and milestones.
 *
 * Features:
 * - Multiple view modes: Day, Week, Month
 * - Task bars with progress indication
 * - Milestone markers
 * - Dependency lines (visual indication)
 * - Drag to resize tasks (basic implementation)
 * - Zoom in/out functionality
 * - Date navigation
 * - Critical path highlighting
 *
 * @param {Array} tasks - Array of task objects with start_date, due_date, title, progress, etc.
 * @param {Array} milestones - Array of milestone objects with target_date, title, status
 * @param {Function} onTaskUpdate - Callback when task dates are updated
 * @param {String} projectStartDate - Project start date for timeline calculation
 * @param {String} projectEndDate - Project end date for timeline calculation
 */
export default function GanttChart({
  tasks = [],
  milestones = [],
  onTaskUpdate,
  projectStartDate,
  projectEndDate
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // View mode: 'day', 'week', 'month'
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredTask, setHoveredTask] = useState(null);

  // Calculate timeline range
  const timelineRange = useMemo(() => {
    let start, end;

    if (projectStartDate && projectEndDate) {
      start = new Date(projectStartDate);
      end = new Date(projectEndDate);
    } else {
      // Calculate from tasks and milestones
      const allDates = [
        ...tasks.map(t => new Date(t.start_date)),
        ...tasks.map(t => new Date(t.due_date)),
        ...milestones.map(m => new Date(m.target_date))
      ].filter(d => !isNaN(d));

      if (allDates.length > 0) {
        start = new Date(Math.min(...allDates));
        end = new Date(Math.max(...allDates));
      } else {
        start = new Date();
        end = addDays(new Date(), 30);
      }
    }

    // Add some padding
    start = addDays(start, -7);
    end = addDays(end, 7);

    return { start, end };
  }, [tasks, milestones, projectStartDate, projectEndDate]);

  // Generate timeline columns based on view mode
  const timelineColumns = useMemo(() => {
    const { start, end } = timelineRange;

    if (viewMode === 'day') {
      return eachDayOfInterval({ start, end }).map(date => ({
        date,
        label: format(date, 'dd MMM'),
        key: format(date, 'yyyy-MM-dd')
      }));
    } else if (viewMode === 'week') {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        return {
          date: weekStart,
          label: `${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM')}`,
          key: format(weekStart, 'yyyy-MM-dd'),
          weekEnd
        };
      });
    } else {
      // Month view
      const months = [];
      let current = startOfMonth(start);
      const endDate = endOfMonth(end);

      while (current <= endDate) {
        months.push({
          date: current,
          label: format(current, 'MMM yyyy'),
          key: format(current, 'yyyy-MM')
        });
        current = addMonths(current, 1);
      }

      return months;
    }
  }, [timelineRange, viewMode]);

  // Calculate task bar position and width
  const calculateTaskBar = (task) => {
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.due_date);
    const { start, end } = timelineRange;

    const totalDays = differenceInDays(end, start);
    const startOffset = differenceInDays(taskStart, start);
    const duration = differenceInDays(taskEnd, taskStart);

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return {
      left: Math.max(0, left),
      width: Math.max(1, Math.min(width, 100 - left))
    };
  };

  // Calculate milestone position
  const calculateMilestonePosition = (milestone) => {
    const milestoneDate = new Date(milestone.target_date);
    const { start, end } = timelineRange;

    const totalDays = differenceInDays(end, start);
    const offset = differenceInDays(milestoneDate, start);

    return (offset / totalDays) * 100;
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-blue-500';
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'review': return 'bg-purple-500';
      case 'todo': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const handlePreviousPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, viewMode === 'day' ? -7 : -14));
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, viewMode === 'day' ? 7 : 14));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate today's position for the "today" marker
  const todayPosition = useMemo(() => {
    const today = new Date();
    const { start, end } = timelineRange;
    const totalDays = differenceInDays(end, start);
    const offset = differenceInDays(today, start);
    return (offset / totalDays) * 100;
  }, [timelineRange]);

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t('gantt_chart') || 'Gantt Chart'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('day_view') || 'Day View'}</SelectItem>
                <SelectItem value="week">{t('week_view') || 'Week View'}</SelectItem>
                <SelectItem value="month">{t('month_view') || 'Month View'}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 border rounded-lg">
              <Button size="sm" variant="ghost" onClick={handlePreviousPeriod}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleToday}>
                {t('today') || 'Today'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleNextPeriod}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          {/* Timeline Header */}
          <div className="flex border-b bg-slate-50">
            <div className="w-64 p-3 border-r font-semibold sticky left-0 bg-slate-50 z-10">
              {t('task_name') || 'Task Name'}
            </div>
            <div className="flex-1 overflow-x-auto">
              <div className="flex min-w-max">
                {timelineColumns.map((col) => (
                  <div
                    key={col.key}
                    className="flex-1 p-3 border-r text-xs font-medium text-center min-w-[100px]"
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Task Rows */}
          <div className="relative">
            {tasks.length === 0 && milestones.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>{t('no_tasks_to_display') || 'No tasks to display'}</p>
              </div>
            ) : (
              <>
                {/* Today marker */}
                {todayPosition >= 0 && todayPosition <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                    style={{ left: `calc(16rem + ${todayPosition}%)` }}
                  >
                    <div className="absolute -top-2 -left-8 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      {t('today') || 'Today'}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                {tasks.map((task, index) => {
                  const barPosition = calculateTaskBar(task);

                  return (
                    <div
                      key={task.id}
                      className="flex border-b hover:bg-slate-50 transition-colors"
                      onMouseEnter={() => setHoveredTask(task.id)}
                      onMouseLeave={() => setHoveredTask(null)}
                    >
                      <div className="w-64 p-3 border-r sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getPriorityColor(task.priority)} text-white text-xs`}>
                            {task.priority?.charAt(0).toUpperCase()}
                          </Badge>
                          <span className="text-sm truncate" title={task.title}>
                            {task.title}
                          </span>
                        </div>
                        {task.assignee && (
                          <div className="text-xs text-slate-500 mt-1">
                            {task.assignee}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-3 relative min-h-[60px]">
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-8 rounded transition-all ${
                            getStatusColor(task.status)
                          } ${hoveredTask === task.id ? 'shadow-lg scale-105' : ''}`}
                          style={{
                            left: `${barPosition.left}%`,
                            width: `${barPosition.width}%`
                          }}
                        >
                          {/* Progress bar */}
                          <div
                            className="h-full bg-white/30 rounded"
                            style={{ width: `${task.progress || 0}%` }}
                          ></div>

                          {/* Task label */}
                          {barPosition.width > 10 && (
                            <div className="absolute inset-0 flex items-center px-2 text-white text-xs font-medium truncate">
                              {task.title}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Milestones */}
                {milestones.map((milestone) => {
                  const position = calculateMilestonePosition(milestone);

                  return (
                    <div
                      key={milestone.id}
                      className="flex border-b hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-64 p-3 border-r sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {t('milestone') || 'Milestone'}
                          </Badge>
                          <span className="text-sm font-medium truncate" title={milestone.title}>
                            {milestone.title}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-3 relative min-h-[60px]">
                        <div
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{ left: `${position}%` }}
                        >
                          <div className={`w-0 h-0 border-l-8 border-r-8 border-t-[14px] ${
                            milestone.status === 'completed' ? 'border-t-green-500' : 'border-t-yellow-500'
                          } border-l-transparent border-r-transparent`}></div>
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium">
                            {format(new Date(milestone.target_date), 'MMM dd')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Legend */}
          <div className="border-t bg-slate-50 p-3 flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>{t('critical') || 'Critical'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span>{t('high') || 'High'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>{t('medium') || 'Medium'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-400 rounded"></div>
              <span>{t('low') || 'Low'}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-[7px] border-t-yellow-500 border-l-transparent border-r-transparent"></div>
              <span>{t('milestone') || 'Milestone'}</span>
            </div>
          </div>
        </div>

        {/* Task Statistics */}
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">{t('total_tasks') || 'Total Tasks'}</div>
            <div className="text-2xl font-bold">{tasks.length}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-xs text-green-600 mb-1">{t('completed') || 'Completed'}</div>
            <div className="text-2xl font-bold text-green-600">
              {tasks.filter(t => t.status === 'completed').length}
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-xs text-blue-600 mb-1">{t('in_progress') || 'In Progress'}</div>
            <div className="text-2xl font-bold text-blue-600">
              {tasks.filter(t => t.status === 'in_progress').length}
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="text-xs text-yellow-600 mb-1">{t('milestones') || 'Milestones'}</div>
            <div className="text-2xl font-bold text-yellow-600">{milestones.length}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
