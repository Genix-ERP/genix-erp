import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Table2, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const STATUS_BADGE = {
  on_track: 'bg-green-100 text-green-700',
  behind: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
};

const STATUS_BAR_COLORS = {
  on_track: '#22c55e',
  behind: '#ef4444',
  completed: '#3b82f6',
};

const ProgressTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [view, setView] = useState('table');
  const [progressData, setProgressData] = useState(null);
  const [ganttData, setGanttData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const STATUS_LABELS = {
    on_track: t('on_track') || 'On track',
    behind: t('behind') || 'Behind',
    completed: t('completed') || 'Bajarildi',
  };

  const loadTable = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await constructionService.getProgressSummary(project.id);
      setProgressData(data);
    } catch (e) {
      setError(t('progress_load_error') || 'Error loading progress data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  const loadGantt = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await constructionService.getGanttData(project.id);
      setGanttData(data);
    } catch (e) {
      setError(t('gantt_load_error') || 'Error loading Gantt data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    if (view === 'table') {
      loadTable();
    } else {
      loadGantt();
    }
  }, [view, loadTable, loadGantt]);

  // ── Gantt data transformation ──────────────────────────────────

  const transformGanttData = (data) => {
    if (!data?.items?.length) return [];

    const projectStart = data.project_start
      ? new Date(data.project_start)
      : new Date(Math.min(...data.items.map((i) => new Date(i.planned_start).getTime())));

    return data.items.map((item) => {
      const plannedStart = new Date(item.planned_start);
      const plannedEnd = new Date(item.planned_end);
      const startOffset = Math.max(0, Math.floor((plannedStart - projectStart) / (1000 * 60 * 60 * 24)));
      const planDuration = Math.max(1, Math.ceil((plannedEnd - plannedStart) / (1000 * 60 * 60 * 24)));
      const actualProgress = Math.round(planDuration * ((item.fact_pct || 0) / 100));

      return {
        name: `${item.wbs_code} ${item.wbs_name}`,
        start_offset: startOffset,
        plan_duration: planDuration,
        actual_progress: actualProgress,
        status: item.status,
        fact_pct: item.fact_pct || 0,
      };
    });
  };

  const getTodayOffset = (data) => {
    if (!data?.project_start) return null;
    const projectStart = new Date(data.project_start);
    const today = new Date();
    const offset = Math.floor((today - projectStart) / (1000 * 60 * 60 * 24));
    return offset >= 0 ? offset : null;
  };

  // ── Render ─────────────────────────────────────────────────────

  const renderSummary = () => {
    if (!progressData) return null;
    const items = progressData.items || [];
    const totalItems = items.length;
    const completedCount = items.filter((i) => i.status === 'completed').length;
    const behindCount = items.filter((i) => i.status === 'behind').length;
    const avgGap =
      totalItems > 0
        ? (items.reduce((sum, i) => sum + ((i.fact_pct || 0) - (i.plan_pct || 0)), 0) / totalItems).toFixed(1)
        : 0;

    return (
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">{t('total_items') || 'Jami elementlar'}</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">{t('completed_count') || 'Bajarilgan'}</p>
            <p className="text-2xl font-bold text-blue-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">{t('behind_count') || 'Kechikkan'}</p>
            <p className="text-2xl font-bold text-red-600">{behindCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">{t('average_gap') || "O'rtacha farq"}</p>
            <p className={`text-2xl font-bold ${Number(avgGap) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(avgGap) >= 0 ? '+' : ''}
              {avgGap}%
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTable = () => {
    if (!progressData) return null;
    const items = progressData.items || [];

    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          {t('no_progress_data') || "Jarayon ma'lumotlari topilmadi"}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="text-left py-2 px-3">{t('wbs_code') || 'WBS kodi'}</th>
              <th className="text-left py-2 px-3">{t('wbs_name') || 'Nomi'}</th>
              <th className="text-center py-2 px-3">{t('plan_pct') || 'Reja %'}</th>
              <th className="text-center py-2 px-3">{t('fact_pct') || 'Fakt %'}</th>
              <th className="text-center py-2 px-3">{t('gap') || 'Farq'}</th>
              <th className="text-center py-2 px-3">{t('status') || 'Holat'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const gap = (item.fact_pct || 0) - (item.plan_pct || 0);
              return (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-xs">{item.wbs_code}</td>
                  <td className="py-2 px-3">{item.wbs_name}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Progress value={item.plan_pct || 0} className="h-2 flex-1 bg-slate-200" />
                      <span className="text-xs text-slate-500 min-w-[36px] text-right">
                        {(item.plan_pct || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={item.fact_pct || 0}
                        className="h-2 flex-1 bg-slate-200"
                      />
                      <span className="text-xs text-slate-500 min-w-[36px] text-right">
                        {(item.fact_pct || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`font-medium ${gap >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {gap >= 0 ? '+' : ''}
                      {gap.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Badge className={STATUS_BADGE[item.status] || 'bg-slate-100 text-slate-700'}>
                      {STATUS_LABELS[item.status] || item.status}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderGantt = () => {
    if (!ganttData) return null;

    const chartData = transformGanttData(ganttData);
    const todayOffset = getTodayOffset(ganttData);

    if (chartData.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          {t('no_gantt_data') || "Gantt ma'lumotlari topilmadi"}
        </div>
      );
    }

    const maxDays = Math.max(...chartData.map((d) => d.start_offset + d.plan_duration)) + 5;

    return (
      <div style={{ height: Math.max(400, chartData.length * 50) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 200, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, maxDays]}
              label={{ value: t('days') || 'Kunlar', position: 'insideBottom', offset: -10 }}
            />
            <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'start_offset') return [value, t('start_day') || 'Boshlanish kuni'];
                if (name === 'plan_duration') return [value, t('plan_duration') || 'Reja davomiyligi'];
                if (name === 'actual_progress') return [value, t('actual_progress') || 'Haqiqiy jarayon'];
                return [value, name];
              }}
            />
            <Legend
              formatter={(value) => {
                if (value === 'start_offset') return t('start_offset_label') || 'Boshlanish';
                if (value === 'plan_duration') return t('plan_duration_label') || 'Reja';
                if (value === 'actual_progress') return t('actual_progress_label') || 'Fakt';
                return value;
              }}
            />
            {todayOffset !== null && (
              <ReferenceLine
                x={todayOffset}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{ value: t('today') || 'Bugun', position: 'top', fill: '#ef4444', fontSize: 12 }}
              />
            )}
            <Bar dataKey="start_offset" stackId="a" fill="transparent" legendType="none" />
            <Bar dataKey="plan_duration" stackId="a" fill="#d1d5db" fillOpacity={0.6} radius={[0, 4, 4, 0]} />
            <Bar dataKey="start_offset" stackId="b" fill="transparent" legendType="none" />
            <Bar
              dataKey="actual_progress"
              stackId="b"
              radius={[0, 4, 4, 0]}
              fill="#3b82f6"
              shape={(props) => {
                const { x, y, width, height, payload } = props;
                const color = STATUS_BAR_COLORS[payload.status] || '#3b82f6';
                return <rect x={x} y={y} width={width} height={height} fill={color} rx={4} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {t('progress') || 'Jarayon'}
        </h3>
        <div className="flex gap-2">
          <Button
            variant={view === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('table')}
          >
            <Table2 className="w-4 h-4 mr-2" />
            {t('table') || 'Jadval'}
          </Button>
          <Button
            variant={view === 'gantt' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('gantt')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Gantt
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">{t('loading')}</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : view === 'table' ? (
        <>
          {renderSummary()}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="w-5 h-5" />
                {t('progress_table') || 'Jarayon jadvali'}
              </CardTitle>
            </CardHeader>
            <CardContent>{renderTable()}</CardContent>
          </Card>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-200 inline-block" />
              {t('on_track') || 'On track'} — {t('progress_on_track_desc') || "Rejada"}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-200 inline-block" />
              {t('behind') || 'Behind'} — {t('progress_behind_desc') || "Kechikkan"}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-200 inline-block" />
              {t('completed') || 'Bajarildi'} — {t('progress_completed_desc') || "Tugallangan"}
            </span>
          </div>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {t('gantt_chart') || 'Gantt diagrammasi'}
            </CardTitle>
          </CardHeader>
          <CardContent>{renderGantt()}</CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProgressTab;
