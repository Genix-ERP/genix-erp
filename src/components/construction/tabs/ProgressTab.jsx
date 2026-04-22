import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Table2, TrendingUp, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [progressData, setProgressData] = useState(null); // { items: [...], kpis: {...} }
  const [ganttData, setGanttData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const pageSize = 20;

  // Reset pagination whenever the block filter changes so we always start on
  // page 1 of the filtered list.
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBlock]);

  // Pick the first available block as the active tab once items arrive (or
  // when the currently selected block disappears after a reload). Items
  // without a building_name (project-wide) are intentionally ignored — they
  // don't get their own tab.
  useEffect(() => {
    const items = progressData?.items || [];
    if (items.length === 0) return;
    const keys = Array.from(
      new Set(
        items
          .map((it) => it.building_name)
          .filter((name) => Boolean(name)),
      ),
    );
    if (keys.length === 0) {
      if (selectedBlock !== null) setSelectedBlock(null);
      return;
    }
    if (!selectedBlock || !keys.includes(selectedBlock)) {
      setSelectedBlock(keys[0]);
    }
  }, [progressData, selectedBlock]);

  const STATUS_LABELS = {
    on_track: t('on_track') || 'On track',
    behind: t('behind') || 'Behind',
    completed: t('completed') || 'Bajarildi',
  };

  // Pulls the in-progress feed (stages + sub-stages with status='in_progress'
  // for this project). Replaces the previous WBS-only summary so the Jarayon
  // table reflects every construction item that's currently under way.
  const loadTable = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await constructionService.getProjectInProgressItems(project.id);
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
    // Server-computed KPIs (see GetProjectInProgressItems). Fall back to
    // client-side derivation when an older server build is running.
    const items = progressData.items || [];
    const k = progressData.kpis || {};
    const totalItems = k.total ?? items.length;
    const onTrackCount = k.on_track ?? items.filter((i) => i.bucket === 'on_track').length;
    const behindCount = k.behind ?? items.filter((i) => i.bucket === 'behind').length;
    const avgPct = Number(k.avg_pct ?? 0).toFixed(1);

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
            <p className="text-sm text-slate-500">{t('on_track_count') || "O'z vaqtida"}</p>
            <p className="text-2xl font-bold text-green-600">{onTrackCount}</p>
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
            <p className="text-sm text-slate-500">{t('average_progress') || "O'rtacha jarayon"}</p>
            <p className="text-2xl font-bold text-blue-600">{avgPct}%</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTable = () => {
    if (!progressData) return null;
    const allItems = progressData.items || [];
    // Only items attached to a block/building are shown. Project-wide
    // ("Umumiy") items are hidden so the tab row and table stay aligned with
    // the Stages (Bosqichlar) view, which also has no Umumiy pill.
    const items = allItems.filter((it) => Boolean(it.building_name));

    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          {t('no_in_progress_items') || "Hozirda jarayonda element yo'q"}
        </div>
      );
    }

    // Build an ordered, de-duplicated list of blocks found in the items.
    const blockTabs = (() => {
      const seen = new Map();
      for (const it of items) {
        const key = it.building_name;
        if (!seen.has(key)) seen.set(key, key);
      }
      return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
    })();

    const filteredItems = items.filter(
      (it) => it.building_name === selectedBlock,
    );

    // If the previously-selected tab no longer exists (data reloaded), show
    // an empty-state message rather than a stale pagination UI.
    const hasSelectedBlock = blockTabs.some((b) => b.key === selectedBlock);

    const paginatedItems = filteredItems.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

    const sourceLabel = (src) =>
      src === 'sub_stage' ? (t('sub_stage') || 'Kichik bosqich')
      : src === 'stage'   ? (t('stage') || 'Bosqich')
      : src;

    const sourceBadgeClass = (src) =>
      src === 'sub_stage'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-indigo-50 text-indigo-700 border-indigo-200';

    const fmt = (d) => (d ? String(d).slice(0, 10) : '—');

    return (
      <div>
        {/* Block filter tabs — one tab per building/block. The active block's
            name doubles as the column identity, so the table below no longer
            repeats it per row. */}
        {blockTabs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {blockTabs.map(({ key, label }) => {
              const count = items.filter((it) => it.building_name === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedBlock(key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    selectedBlock === key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {!hasSelectedBlock || filteredItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            {t('no_in_progress_items') || "Hozirda jarayonda element yo'q"}
          </div>
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="text-left py-2 px-3">{t('source') || 'Manba'}</th>
                <th className="text-left py-2 px-3">{t('name') || 'Nomi'}</th>
                <th className="text-center py-2 px-3">{t('planned_window') || 'Reja'}</th>
                <th className="text-center py-2 px-3">{t('actual_start') || 'Haqiqiy boshlanish'}</th>
                <th className="text-left py-2 px-3 w-[200px]">{t('progress') || 'Jarayon'}</th>
                <th className="text-center py-2 px-3">{t('status') || 'Holat'}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const bucket = item.bucket || 'on_track';
                const pct = Number(item.progress_pct) || 0;
                return (
                  <tr key={`${item.source}-${item.id}`} className="border-b hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <Badge variant="outline" className={`text-[10px] ${sourceBadgeClass(item.source)}`}>
                        {sourceLabel(item.source)}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-slate-800">{item.name}</div>
                      {item.parent_name && (
                        <div className="text-[11px] text-slate-500">
                          ↳ {item.parent_name}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center text-xs text-slate-600 whitespace-nowrap">
                      {fmt(item.planned_start)} — {fmt(item.planned_end)}
                    </td>
                    <td className="py-2 px-3 text-center text-xs text-slate-600">
                      {fmt(item.actual_start)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1 bg-slate-200" />
                        <span className="text-xs text-slate-500 min-w-[40px] text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge className={STATUS_BADGE[bucket] || 'bg-slate-100 text-slate-700'}>
                        {STATUS_LABELS[bucket] || bucket}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-slate-500">
              {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredItems.length)} / {filteredItems.length}
            </p>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>1</button>
              <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
              <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
              <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
            </div>
          </div>
        )}
        </>
        )}
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
