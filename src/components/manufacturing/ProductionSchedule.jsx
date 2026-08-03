import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Calendar, ChevronLeft, ChevronRight, Factory, AlertTriangle, RotateCcw,
  ExternalLink, X, Minus, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { productionOrdersService } from '@/api/services/manufacturing';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDate } from '@/utils/formatDate';
import { PAL, EmptyNote, Segmented } from '@/components/shared/DashboardKit';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';

// ─── Day math on plain 'YYYY-MM-DD' strings (local midnight, no
// toLocaleDateString, no toISOString timezone drift) ─────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const parseDay = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toISODay = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const addDays = (s, n) => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return toISODay(d);
};
const dayDiff = (a, b) => Math.round((parseDay(a) - parseDay(b)) / 86400000); // a - b in days
const ddmm = (s) => {
  const [, m, d] = String(s).split('-');
  return m && d ? `${d}.${m}` : String(s || '');
};
const todayISO = () => toISODay(new Date());

// Weekday initials by getDay() (0 = Sunday), per language.
const WEEKDAYS = {
  uz: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
};

// Zoom → window shape around the anchor day and column width in px.
const ZOOMS = {
  '2w': { back: 7, fwd: 6, dayWidth: 72 },
  '1m': { back: 14, fwd: 28, dayWidth: 40 }, // default: today ±(14 back / 28 fwd)
  '3m': { back: 28, fwd: 62, dayWidth: 22 },
};

// Status → bar color (PAL order is CVD-validated; identity also lives in the
// rail text + legend, color is a redundant cue).
const STATUS_COLORS = {
  draft: '#94A3B8',
  confirmed: PAL[0].c,
  in_progress: PAL[4].c,
  paused: PAL[1].c,
  completed: PAL[2].c,
  done: PAL[2].c,
};
const LOCKED_STATUSES = new Set(['completed', 'done', 'cancelled', 'closed']);

const MAX_ROWS = 200;
const RAIL_W = 224; // left rail px (w-56)
const ROW_H = 44;
const RESIZE_ZONE = 10; // px from the right edge that acts as a resize handle

// Muddatlar — interactive Gantt over GET /production-orders/schedule
// (server date-window query, not the 1000-row context list). Bars are
// drag-movable (whole bar) and resizable (right edge); drops PUT the new
// scheduled dates with an optimistic update + Undo toast.
export default function ProductionSchedule() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();
  const { canUpdate } = usePermissions();
  const canReschedule = canUpdate(MODULES.MANUFACTURING);

  const [zoom, setZoom] = useState('1m');
  const [anchor, setAnchor] = useState(todayISO());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  // { id, mode: 'move'|'resize', startClientX, deltaDays } while dragging.
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null); // mirrors `drag` for pointer handlers
  const movedRef = useRef(false); // suppress click-select after a real drag
  const scrollerRef = useRef(null);

  const { back, fwd, dayWidth } = ZOOMS[zoom] || ZOOMS['1m'];
  const windowFrom = addDays(anchor, -back);
  const windowTo = addDays(anchor, fwd);
  const dayCount = dayDiff(windowTo, windowFrom) + 1;

  // ─── Data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    productionOrdersService
      .getSchedule({ date_from: windowFrom, date_to: windowTo })
      .then((data) => { if (alive) setOrders(Array.isArray(data) ? data : []); })
      .catch((e) => {
        console.error('Failed to load production schedule:', e);
        if (alive) { setOrders([]); setError(getApiErrorMessage(e, t('mfg_gantt_error'))); }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowFrom, windowTo, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  // Scroll so today is in view when the window changes.
  const todayIdx = dayDiff(todayISO(), windowFrom);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (todayIdx >= 0 && todayIdx < dayCount) {
      el.scrollLeft = Math.max(0, todayIdx * dayWidth - el.clientWidth / 3);
    } else {
      el.scrollLeft = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowFrom, windowTo, dayWidth, loading]);

  // ─── Derived rows ────────────────────────────────────────────────────
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(windowFrom, i)),
    [windowFrom, dayCount]
  );

  // Month header segments: consecutive runs of the same MM.YYYY.
  const monthSegments = useMemo(() => {
    const segs = [];
    days.forEach((d) => {
      const [y, m] = d.split('-');
      const label = `${m}.${y}`;
      const last = segs[segs.length - 1];
      if (last && last.label === label) last.span += 1;
      else segs.push({ label, span: 1 });
    });
    return segs;
  }, [days]);

  const rows = useMemo(() => {
    const today = todayISO();
    return orders
      .map((o) => {
        const start = o.scheduled_start || o.scheduled_end;
        const end = o.scheduled_end || o.scheduled_start;
        if (!start) return null;
        return {
          ...o,
          startISO: start,
          endISO: dayDiff(end, start) < 0 ? start : end,
          locked: LOCKED_STATUSES.has(o.status),
          isOverdue: !LOCKED_STATUSES.has(o.status) && dayDiff(end, today) < 0,
        };
      })
      .filter(Boolean);
  }, [orders]);
  const visibleRows = rows.slice(0, MAX_ROWS);
  const hiddenCount = rows.length - visibleRows.length;

  const selected = rows.find((r) => r.id === selectedId) || null;

  // ─── Rescheduling (shared by drag, keyboard and footer buttons) ──────
  const commitDates = useCallback(async (order, newStart, newEnd, { primary = 'start', silent = false } = {}) => {
    const oldStart = order.startISO;
    const oldEnd = order.endISO;
    if (newStart === oldStart && newEnd === oldEnd) return;
    setPendingIds((prev) => new Set(prev).add(order.id));
    setOrders((prev) => prev.map((o) => (
      o.id === order.id ? { ...o, scheduled_start: newStart, scheduled_end: newEnd } : o
    )));
    try {
      await productionOrdersService.update(order.id, { scheduled_start: newStart, scheduled_end: newEnd });
      if (!silent) {
        const fromLabel = ddmm(primary === 'end' ? oldEnd : oldStart);
        const toLabel = ddmm(primary === 'end' ? newEnd : newStart);
        toast.success(`${order.code}: ${fromLabel} → ${toLabel}`, {
          action: {
            label: t('mfg_gantt_undo'),
            onClick: () => commitDates(
              { ...order, startISO: newStart, endISO: newEnd },
              oldStart, oldEnd,
              { silent: true }
            ),
          },
        });
      }
    } catch (e) {
      // Revert the optimistic move.
      setOrders((prev) => prev.map((o) => (
        o.id === order.id ? { ...o, scheduled_start: oldStart, scheduled_end: oldEnd } : o
      )));
      toast.error(getApiErrorMessage(e, t('mfg_gantt_update_failed')));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  }, [t]);

  const shiftOrder = useCallback((order, delta) => {
    if (!canReschedule || order.locked || pendingIds.has(order.id)) return;
    commitDates(order, addDays(order.startISO, delta), addDays(order.endISO, delta), { primary: 'start' });
  }, [canReschedule, pendingIds, commitDates]);

  // ─── Pointer drag ────────────────────────────────────────────────────
  const onBarPointerDown = (e, row) => {
    if (e.button !== 0) return;
    movedRef.current = false;
    if (!canReschedule || row.locked || pendingIds.has(row.id)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mode = rect.right - e.clientX <= RESIZE_ZONE ? 'resize' : 'move';
    const st = { id: row.id, mode, startClientX: e.clientX, deltaDays: 0 };
    dragRef.current = st;
    setDrag(st);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBarPointerMove = (e) => {
    const st = dragRef.current;
    if (!st) return;
    const deltaDays = Math.round((e.clientX - st.startClientX) / dayWidth);
    if (Math.abs(e.clientX - st.startClientX) > 4) movedRef.current = true;
    if (deltaDays !== st.deltaDays) {
      const next = { ...st, deltaDays };
      dragRef.current = next;
      setDrag(next);
    }
  };

  const onBarPointerUp = (e, row) => {
    const st = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (!st || st.id !== row.id) return;
    if (st.deltaDays === 0) return; // plain click → handled by onClick select
    if (st.mode === 'move') {
      commitDates(row, addDays(row.startISO, st.deltaDays), addDays(row.endISO, st.deltaDays), { primary: 'start' });
    } else {
      let newEnd = addDays(row.endISO, st.deltaDays);
      if (dayDiff(newEnd, row.startISO) < 0) newEnd = row.startISO; // never end before start
      commitDates(row, row.startISO, newEnd, { primary: 'end' });
    }
  };

  const onBarKeyDown = (e, row) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedId(row.id);
    } else if (e.key === 'ArrowLeft' && selectedId === row.id) {
      e.preventDefault();
      shiftOrder(row, -1);
    } else if (e.key === 'ArrowRight' && selectedId === row.id) {
      e.preventDefault();
      shiftOrder(row, 1);
    } else if (e.key === 'Escape') {
      setSelectedId(null);
    }
  };

  // ─── Navigation controls ─────────────────────────────────────────────
  const span = back + fwd + 1;
  const goPrev = () => setAnchor((a) => addDays(a, -span));
  const goNext = () => setAnchor((a) => addDays(a, span));
  const goToday = () => setAnchor(todayISO());
  const openOrders = () => navigate('/manufacturing?tab=execute&sub=orders');

  const ZOOM_OPTIONS = [
    { id: '2w', label: t('mfg_gantt_zoom_2w') },
    { id: '1m', label: t('mfg_gantt_zoom_1m') },
    { id: '3m', label: t('mfg_gantt_zoom_3m') },
  ];
  const weekdays = WEEKDAYS[language] || WEEKDAYS.uz;
  const gridWidth = dayCount * dayWidth;

  const statusChip = (status) => {
    const color = STATUS_COLORS[status] || '#94A3B8';
    const key = `status_${status}`;
    const label = t(key);
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        {label === key ? status : label}
      </span>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-8 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm">
        <EmptyNote
          icon={AlertTriangle}
          text={error}
          cta={(
            <Button size="sm" variant="outline" onClick={retry} className="gap-1.5">
              <RotateCcw className="w-4 h-4" />
              {t('retry')}
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-500" />
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={goPrev} aria-label={t('mfg_gantt_prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              {t('mfg_gantt_today')}
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} aria-label={t('mfg_gantt_next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm font-medium text-slate-600 tabular-nums ml-1">
            {ddmm(windowFrom)} — {formatDate(parseDay(windowTo))}
          </span>
        </div>
        <Segmented options={ZOOM_OPTIONS} value={zoom} onChange={setZoom} />
      </div>

      {canReschedule && (
        <p className="text-xs text-slate-400">{t('mfg_gantt_hint')}</p>
      )}

      {/* Gantt */}
      <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm overflow-hidden">
        {visibleRows.length === 0 ? (
          <EmptyNote
            icon={Factory}
            text={t('mfg_gantt_empty')}
            cta={(
              <Button size="sm" onClick={openOrders} className="gap-1.5">
                <Plus className="w-4 h-4" />
                {t('mfg_gantt_empty_cta')}
              </Button>
            )}
          />
        ) : (
          <div ref={scrollerRef} className="overflow-x-auto">
            <div style={{ width: RAIL_W + gridWidth, minWidth: '100%' }}>
              {/* Month header */}
              <div className="flex border-b border-slate-100 bg-slate-50/70">
                <div className="shrink-0 border-r border-slate-200" style={{ width: RAIL_W }} />
                <div className="flex">
                  {monthSegments.map((seg, i) => (
                    <div
                      key={i}
                      className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 py-1 px-2 border-r border-slate-100 truncate"
                      style={{ width: seg.span * dayWidth }}
                    >
                      {seg.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day header */}
              <div className="flex border-b border-slate-200 bg-slate-50/70">
                <div className="shrink-0 border-r border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500" style={{ width: RAIL_W }}>
                  {t('mfg_sub_orders')}
                </div>
                <div className="flex">
                  {days.map((d, i) => {
                    const wd = parseDay(d).getDay();
                    const isWeekend = wd === 0 || wd === 6;
                    const isToday = i === todayIdx;
                    return (
                      <div
                        key={d}
                        className={`text-center py-1 border-r border-slate-100 ${isWeekend ? 'bg-slate-100/70' : ''} ${isToday ? 'bg-blue-50' : ''}`}
                        style={{ width: dayWidth }}
                      >
                        <div className="text-[9px] leading-3 text-slate-400">{weekdays[wd]}</div>
                        <div className={`text-[11px] leading-4 font-semibold tabular-nums ${isToday ? 'text-blue-600' : 'text-slate-600'}`}>
                          {dayWidth >= 34 ? ddmm(d) : d.slice(8, 10)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows */}
              <div className="relative">
                {/* Weekend shading + today line behind all rows */}
                <div className="absolute inset-y-0 pointer-events-none" style={{ left: RAIL_W, width: gridWidth }}>
                  {days.map((d, i) => {
                    const wd = parseDay(d).getDay();
                    if (wd !== 0 && wd !== 6) return null;
                    return (
                      <div
                        key={d}
                        className="absolute inset-y-0 bg-slate-100/50"
                        style={{ left: i * dayWidth, width: dayWidth }}
                      />
                    );
                  })}
                  {todayIdx >= 0 && todayIdx < dayCount && (
                    <div
                      className="absolute inset-y-0 w-px bg-blue-500/70 z-10"
                      style={{ left: todayIdx * dayWidth + Math.floor(dayWidth / 2) }}
                    />
                  )}
                </div>

                {visibleRows.map((row) => {
                  const rawStartIdx = dayDiff(row.startISO, windowFrom);
                  const rawEndIdx = dayDiff(row.endISO, windowFrom);
                  const isDragging = drag?.id === row.id;
                  const dMove = isDragging && drag.mode === 'move' ? drag.deltaDays : 0;
                  const dResize = isDragging && drag.mode === 'resize' ? drag.deltaDays : 0;
                  const effStartIdx = rawStartIdx + dMove;
                  const effEndIdx = Math.max(effStartIdx, rawEndIdx + dMove + dResize);
                  const clampedStart = Math.max(0, effStartIdx);
                  const clampedEnd = Math.min(dayCount - 1, effEndIdx);
                  const barVisible = clampedEnd >= 0 && clampedStart <= dayCount - 1 && clampedEnd >= clampedStart;
                  const cutLeft = effStartIdx < 0;
                  const cutRight = effEndIdx > dayCount - 1;
                  const color = STATUS_COLORS[row.status] || '#94A3B8';
                  const pending = pendingIds.has(row.id);
                  const interactive = canReschedule && !row.locked && !pending;
                  const isSelected = selectedId === row.id;

                  return (
                    <div key={row.id} className={`flex border-b border-slate-100 ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/40'}`} style={{ height: ROW_H }}>
                      {/* Rail */}
                      <button
                        type="button"
                        onClick={() => setSelectedId(isSelected ? null : row.id)}
                        className="shrink-0 border-r border-slate-200 px-3 py-1 text-left overflow-hidden"
                        style={{ width: RAIL_W }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-mono font-medium text-slate-700 truncate">{row.code}</span>
                          {row.isOverdue && (
                            <span className="inline-flex items-center px-1 rounded bg-red-50 text-red-600 text-[9px] font-semibold uppercase shrink-0">
                              {t('overdue')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-slate-500 truncate">{row.product_name || t('unnamed_product')}</span>
                          {statusChip(row.status)}
                        </div>
                      </button>

                      {/* Timeline cell */}
                      <div className="relative" style={{ width: gridWidth }}>
                        {barVisible && (
                          <>
                            {/* Dashed outline at the original slot while dragging */}
                            {isDragging && drag.deltaDays !== 0 && (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md border border-dashed border-slate-300 pointer-events-none"
                                style={{
                                  left: Math.max(0, rawStartIdx) * dayWidth + 1,
                                  width: Math.max(1, (Math.min(dayCount - 1, rawEndIdx) - Math.max(0, rawStartIdx) + 1)) * dayWidth - 2,
                                }}
                              />
                            )}
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`${row.code} ${row.product_name || ''} ${ddmm(row.startISO)} — ${ddmm(row.endISO)}`}
                              onPointerDown={(e) => onBarPointerDown(e, row)}
                              onPointerMove={onBarPointerMove}
                              onPointerUp={(e) => onBarPointerUp(e, row)}
                              onClick={() => { if (!movedRef.current) setSelectedId(row.id); }}
                              onFocus={() => setSelectedId(row.id)}
                              onKeyDown={(e) => onBarKeyDown(e, row)}
                              className={[
                                'absolute top-1/2 -translate-y-1/2 h-6 flex items-center px-2 select-none touch-none',
                                cutLeft ? 'rounded-l-none' : 'rounded-l-md',
                                cutRight ? 'rounded-r-none' : 'rounded-r-md',
                                row.locked ? 'opacity-50' : '',
                                pending ? 'opacity-60 pointer-events-none' : '',
                                interactive ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                                isDragging ? 'shadow-lg z-20 opacity-90' : 'shadow-sm',
                                isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                                row.isOverdue ? 'ring-1 ring-red-500' : '',
                              ].join(' ')}
                              style={{
                                left: clampedStart * dayWidth + 1,
                                width: Math.max(dayWidth - 2, (clampedEnd - clampedStart + 1) * dayWidth - 2),
                                background: color,
                              }}
                            >
                              <span className="text-[10px] text-white font-medium truncate pointer-events-none">
                                {isDragging && drag.deltaDays !== 0
                                  ? `${ddmm(addDays(row.startISO, dMove))} — ${ddmm(addDays(row.endISO, dMove + dResize))}`
                                  : `${row.quantity_planned ?? ''}`}
                              </span>
                              {/* Resize affordance on the right edge */}
                              {interactive && !cutRight && (
                                <span className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize rounded-r-md bg-black/10 pointer-events-none" />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hiddenCount > 0 && (
                <div className="px-4 py-2 text-xs text-slate-500 bg-slate-50/70 border-t border-slate-100">
                  +{hiddenCount} {t('mfg_gantt_more')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {Object.entries(STATUS_COLORS).filter(([s]) => s !== 'done').map(([s, c]) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-3 h-3 rounded" style={{ background: c }} />
            {t(`status_${s}`)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded ring-1 ring-red-500 bg-white" />
          {t('overdue')}
        </span>
      </div>

      {/* Selected-order footer panel (accessible fallback for drag-drop) */}
      {selected && (
        <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-mono font-semibold text-slate-800 truncate">{selected.code}</p>
            <p className="text-xs text-slate-500 truncate">
              {selected.product_name || t('unnamed_product')}
              {selected.work_center_name ? ` · ${selected.work_center_name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 tabular-nums">
            <span>{formatDate(parseDay(selected.startISO))}</span>
            <span className="text-slate-400">→</span>
            <span>{formatDate(parseDay(selected.endISO))}</span>
          </div>
          {statusChip(selected.status)}
          <div className="flex items-center gap-2 ml-auto">
            {canReschedule && !selected.locked && (
              <>
                <Button
                  size="sm" variant="outline" className="gap-1 h-8"
                  disabled={pendingIds.has(selected.id)}
                  onClick={() => shiftOrder(selected, -1)}
                >
                  <Minus className="w-3.5 h-3.5" />
                  {t('mfg_gantt_minus_day')}
                </Button>
                <Button
                  size="sm" variant="outline" className="gap-1 h-8"
                  disabled={pendingIds.has(selected.id)}
                  onClick={() => shiftOrder(selected, 1)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('mfg_gantt_plus_day')}
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={openOrders}>
              <ExternalLink className="w-3.5 h-3.5" />
              {t('mfg_gantt_open')}
            </Button>
            <Button
              size="sm" variant="ghost" className="h-8 w-8 p-0"
              onClick={() => setSelectedId(null)}
              aria-label={t('cancel')}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
